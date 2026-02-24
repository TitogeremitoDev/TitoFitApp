// src/services/aiNutritionService.js
import { Platform } from 'react-native';

const POLL_INTERVAL = 2000; // 2 segundos entre cada consulta
const MAX_POLL_TIME = 120000; // 2 minutos máximo de polling

/**
 * Polls an AI job until it completes, fails, or times out.
 * @param {string} jobId - The job ID to poll
 * @param {string} token - Auth token
 * @param {AbortSignal|null} signal - Optional AbortSignal for cancellation
 * @returns {Promise<Object>} The job result
 */
const pollJobResult = async (jobId, token, signal = null) => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_POLL_TIME) {
        // Check if cancelled
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        const pollRes = await fetch(`${API_URL}/api/ai/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: signal
        });

        const pollData = await pollRes.json();

        if (pollData.status === 'completed') {
            // Return in the same format the caller expects
            return { success: true, plan: pollData.plan };
        }

        if (pollData.status === 'failed') {
            return { success: false, message: pollData.message || 'Error al procesar con IA' };
        }

        // Wait before next poll
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, POLL_INTERVAL);
            if (signal) {
                signal.addEventListener('abort', () => {
                    clearTimeout(timeout);
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            }
        });
    }

    return { success: false, message: 'Tiempo de espera agotado. Intenta con un archivo más pequeño.' };
};

export const uploadDietPdf = async (fileResult, token, signal = null) => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    // Extract file asset from Expo Document Picker result
    const fileAsset = fileResult.assets ? fileResult.assets[0] : fileResult; // Handle both full object or direct asset

    const formData = new FormData();

    if (Platform.OS === 'web') {
        // WEB: Try using the native File object if available (best for web)
        if (fileAsset.file) {
            formData.append('file', fileAsset.file);
        } else {
            // WEB Fallback: If no File object, fetch blob from URI (sometimes needed for Expo Web)
            try {
                const res = await fetch(fileAsset.uri);
                const blob = await res.blob();
                formData.append('file', blob, fileAsset.name || 'document.pdf');
            } catch (e) {
                console.error('Web Blob conversion failed:', e);
                // Last resort try
                formData.append('file', {
                    uri: fileAsset.uri,
                    name: fileAsset.name || 'document.pdf',
                    type: fileAsset.mimeType || 'application/pdf'
                });
            }
        }
    } else {
        // MOBILE (iOS/Android): Standard React Native FormData object
        formData.append('file', {
            uri: fileAsset.uri,
            name: fileAsset.name || 'document.pdf',
            type: fileAsset.mimeType || 'application/pdf'
        });
    }

    try {
        // Step 1: Upload file → get jobId (immediate response)
        const fetchOptions = {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        };

        // Don't pass signal to the upload itself - it's fast
        // We only use signal for the polling phase
        const response = await fetch(`${API_URL}/api/ai/parse-diet`, fetchOptions);

        // Safe parsing: Check for JSON content-type or status
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Upload Error] Status:', response.status, 'Body:', errorText);
            try {
                const errorJson = JSON.parse(errorText);
                return { success: false, message: errorJson.message || 'Error del servidor' };
            } catch (e) {
                return { success: false, message: `Error del servidor (${response.status})` };
            }
        }

        const data = await response.json();

        if (!data.success || !data.jobId) {
            return { success: false, message: data.message || 'Error al enviar archivo' };
        }

        // Step 2: Poll for result (this is where the signal matters for cancellation)
        return await pollJobResult(data.jobId, token, signal);

    } catch (error) {
        if (error.name === 'AbortError') {
            throw error; // Re-throw AbortError so the caller can handle it
        }
        console.error('Error uploading diet PDF:', error);
        return { success: false, message: error.message || 'Error de conexión' };
    }
};

/**
 * Saves an imported AI diet plan using the Backend Adapter.
 * The backend now handles food creation, deduplication, and schema mapping.
 */
export const saveImportedDiet = async (plan, token) => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    try {
        console.log('[AI Service] Sending plan to backend adapter...');
        const response = await fetch(`${API_URL}/api/nutrition-plans/import-ai`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                aiResult: plan,
                clientName: 'Cliente Importado' // Optional metadata
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return { success: false, message: errData.error || `Error del servidor (${response.status})` };
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Error saving imported diet:', error);
        return { success: false, message: error.message || 'Error de conexión' };
    }
};
