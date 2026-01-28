// src/services/aiNutritionService.js
import { Platform } from 'react-native';

export const uploadDietPdf = async (fileResult, token) => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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
        const response = await fetch(`${API_URL}/api/ai/parse-diet`, {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        // Safe parsing: Check for JSON content-type or status
        const contentType = response.headers.get('content-type');
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Upload Error] Status:', response.status, 'Body:', errorText);
            try {
                // Try to parse error as JSON if possible
                const errorJson = JSON.parse(errorText);
                return { success: false, message: errorJson.message || 'Error del servidor' };
            } catch (e) {
                // If not JSON (e.g. HTML 500 page), return generic error
                return { success: false, message: `Error del servidor (${response.status})` };
            }
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error uploading diet PDF:', error);
        return { success: false, message: error.message || 'Error de conexión' };
    }
};

/**
 * Saves an imported AI diet plan to the database.
 * 1. Deduplicates and creates new foods (Batch).
 * 2. Maps the plan to the final Schema.
 * 3. Saves the template.
 */
/**
 * Saves an imported AI diet plan using the Backend Adapter.
 * The backend now handles food creation, deduplication, and schema mapping.
 */
export const saveImportedDiet = async (plan, token) => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Error saving imported diet:', error);
        return { success: false, message: error.message || 'Error de conexión' };
    }
};
