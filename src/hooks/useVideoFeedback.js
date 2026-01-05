// src/hooks/useVideoFeedback.js
// ═══════════════════════════════════════════════════════════════════════════
// HOOK PARA SISTEMA DE VIDEO FEEDBACK
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

// Solo importar compressor en native
let Video;
if (Platform.OS !== 'web') {
    Video = require('react-native-compressor').Video;
}

const UPLOAD_QUEUE_KEY = 'video_feedback_upload_queue';

/**
 * Hook para gestionar subida de video feedback a R2
 */
export function useVideoFeedback(apiUrl, token) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);

    // ═══════════════════════════════════════════════════════════════════════════
    // Comprimir video a 720p (solo native)
    // ═══════════════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════════
    // Comprimir video a 720p (solo native)
    // ═══════════════════════════════════════════════════════════════════════════
    const compressVideo = useCallback(async (videoUri, trimStart = 0, trimEnd = 0) => {
        // Skip compression on web
        if (Platform.OS === 'web' || !Video) {
            console.log('[VideoFeedback] Web detected, skipping compression');
            return videoUri;
        }

        try {
            // 🔧 Usar compressionMethod: 'auto' que funciona mejor en diferentes dispositivos Android
            // El modo 'manual' con maxSize causa problemas de MediaCodec en algunos dispositivos
            const options = {
                compressionMethod: 'auto',  // WhatsApp-like compression, más compatible
            };

            console.log('[VideoFeedback] Comprimiendo video con modo auto:', videoUri);
            const result = await Video.compress(
                videoUri,
                options,
                (progress) => {
                    setProgress(Math.round(progress * 30));
                }
            );
            console.log('[VideoFeedback] Video comprimido:', result);

            // 🆕 CRÍTICO: Verificar que el archivo comprimido no está corrupto
            // El compresor en emulador puede devolver un archivo vacío sin lanzar error
            try {
                const checkResponse = await fetch(result);
                if (checkResponse.ok) {
                    const blob = await checkResponse.blob();
                    console.log('[VideoFeedback] Tamaño archivo comprimido:', blob.size, 'bytes');

                    // Si el archivo comprimido es muy pequeño (< 1KB), usar el original
                    if (blob.size < 1000) {
                        console.warn('[VideoFeedback] ⚠️ Archivo comprimido corrupto/vacío, usando original');
                        return videoUri;
                    }
                }
            } catch (checkErr) {
                console.warn('[VideoFeedback] ⚠️ Error verificando archivo comprimido, usando original:', checkErr.message);
                return videoUri;
            }

            return result;
        } catch (err) {
            // Fallback: si la compresión falla, usar el video original
            console.warn('[VideoFeedback] ⚠️ Error comprimiendo video, usando original:', err.message);
            return videoUri;
        }
    }, []);

    // ═══════════════════════════════════════════════════════════════════════════
    // Obtener presigned URL del backend
    // ═══════════════════════════════════════════════════════════════════════════
    const getUploadUrl = useCallback(async (mediaType, contentType, exerciseData = {}) => {
        const response = await fetch(`${apiUrl}/api/video-feedback/upload-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                mediaType,
                contentType,
                ...exerciseData
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error obteniendo URL de subida');
        }

        return response.json();
    }, [apiUrl, token]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Subir archivo a R2 usando presigned URL
    // ═══════════════════════════════════════════════════════════════════════════
    const uploadToR2 = useCallback(async (uploadUrl, fileUri, contentType) => {
        console.log('[VideoFeedback] Subiendo archivo:', fileUri);
        console.log('[VideoFeedback] Content-Type:', contentType);

        try {
            // Normalizar URI para fetch
            let normalizedUri = fileUri;

            // En Android, asegurar formato correcto
            if (Platform.OS === 'android') {
                // Si es una ruta absoluta sin esquema, añadir file://
                if (fileUri.startsWith('/') && !fileUri.startsWith('file://')) {
                    normalizedUri = 'file://' + fileUri;
                }
            }

            console.log('[VideoFeedback] URI para fetch:', normalizedUri);

            // Leer el archivo como blob
            const fileResponse = await fetch(normalizedUri);
            if (!fileResponse.ok) {
                console.error('[VideoFeedback] Error leyendo archivo:', fileResponse.status);
                throw new Error('No se pudo leer el archivo de media');
            }

            const blob = await fileResponse.blob();
            console.log('[VideoFeedback] Blob creado, size:', blob.size, 'bytes');

            // Verificar que el blob no esté vacío
            if (!blob.size || blob.size < 100) {
                console.error('[VideoFeedback] ⚠️ Blob vacío o muy pequeño');
                throw new Error('El archivo de video parece estar vacío o corrupto');
            }

            // Subir a R2 usando PUT
            console.log('[VideoFeedback] Iniciando upload a R2...');
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': contentType,
                },
                body: blob,
            });

            console.log('[VideoFeedback] Upload response status:', uploadResponse.status);

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text().catch(() => '');
                console.error('[VideoFeedback] Upload failed:', errorText);
                throw new Error('Error subiendo archivo a R2: ' + uploadResponse.status);
            }

            console.log('[VideoFeedback] ✅ Archivo subido correctamente');
            return true;
        } catch (err) {
            console.error('[VideoFeedback] ❌ Error en uploadToR2:', err);
            throw err;
        }
    }, []);



    // ═══════════════════════════════════════════════════════════════════════════
    // Confirmar subida en backend
    // ═══════════════════════════════════════════════════════════════════════════
    const confirmUpload = useCallback(async (feedbackId, duration, thumbnailKey) => {
        const response = await fetch(`${apiUrl}/api/video-feedback/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ feedbackId, duration, thumbnailKey })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error confirmando subida');
        }

        return response.json();
    }, [apiUrl, token]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Flujo completo de subida
    // ═══════════════════════════════════════════════════════════════════════════
    const uploadVideoFeedback = useCallback(async ({
        videoUri,
        exerciseId,
        exerciseName,
        serieKey,
        athleteNote,
        duration,
        thumbnailUri,
        trimStart,
        trimEnd
    }) => {
        console.log('[VideoFeedback] 🎬 Iniciando uploadVideoFeedback');
        console.log('[VideoFeedback] - videoUri:', videoUri);
        console.log('[VideoFeedback] - exerciseName:', exerciseName);
        console.log('[VideoFeedback] - serieKey:', serieKey);

        setUploading(true);
        setProgress(0);
        setError(null);

        try {
            // 1. Verificar conexión
            console.log('[VideoFeedback] 1️⃣ Verificando conexión...');
            const networkState = await Network.getNetworkStateAsync();
            if (!networkState.isConnected || !networkState.isInternetReachable) {
                console.log('[VideoFeedback] ❌ Sin conexión');
                return {
                    queued: true,
                    message: 'Video guardado en cola (offline no implementado full aún)'
                };
            }
            console.log('[VideoFeedback] ✅ Conexión OK');

            // 2. Comprimir Video (y recortar si aplica)
            console.log('[VideoFeedback] 2️⃣ Comprimiendo video...');
            setProgress(5);
            const compressedUri = await compressVideo(videoUri, trimStart, trimEnd);
            console.log('[VideoFeedback] ✅ Video comprimido/procesado:', compressedUri);
            setProgress(30);

            // 3. Obtener presigned URL
            console.log('[VideoFeedback] 3️⃣ Obteniendo URL firmada del backend...');
            const { uploadUrl, feedbackId, thumbnailUploadUrl, thumbnailKey } = await getUploadUrl(
                'video',
                'video/mp4',
                { exerciseId, exerciseName, serieKey, athleteNote }
            );
            console.log('[VideoFeedback] ✅ URL obtenida, feedbackId:', feedbackId);
            setProgress(35);

            // 4. Subir video a R2
            console.log('[VideoFeedback] 4️⃣ Subiendo video a R2...');
            await uploadToR2(uploadUrl, compressedUri, 'video/mp4');
            console.log('[VideoFeedback] ✅ Video subido a R2');
            setProgress(80);

            // 5. Subir thumbnail si existe
            if (thumbnailUri && thumbnailUploadUrl) {
                console.log('[VideoFeedback] 5️⃣ Subiendo thumbnail...');
                await uploadToR2(thumbnailUploadUrl, thumbnailUri, 'image/jpeg');
                console.log('[VideoFeedback] ✅ Thumbnail subido');
                setProgress(90);
            }

            // 6. Confirmar en backend
            console.log('[VideoFeedback] 6️⃣ Confirmando en backend...');
            const result = await confirmUpload(feedbackId, duration, thumbnailKey);
            console.log('[VideoFeedback] ✅ SUBIDA COMPLETA:', feedbackId);
            setProgress(100);

            setUploading(false);
            return { success: true, feedback: result };

        } catch (err) {
            console.error('[VideoFeedback] ❌ Error en subida:', err);
            console.error('[VideoFeedback] ❌ Error message:', err.message);
            setError(err.message);
            setUploading(false);
            return { success: false, error: err.message };
        }
    }, [compressVideo, getUploadUrl, uploadToR2, confirmUpload]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Flujo de subida de FOTO
    // ═══════════════════════════════════════════════════════════════════════════
    const uploadPhotoFeedback = useCallback(async ({
        photoUri,
        exerciseId,
        exerciseName,
        serieKey,
        athleteNote
    }) => {
        setUploading(true);
        setProgress(0);
        setError(null);

        try {
            // 1. Verificar conexión
            const networkState = await Network.getNetworkStateAsync();
            if (!networkState.isConnected) {
                setUploading(false);
                return { queued: true, message: 'Sin conexión. Inténtalo cuando tengas conexión.' };
            }

            setProgress(10);

            // 2. Obtener presigned URL
            const { uploadUrl, feedbackId } = await getUploadUrl(
                'photo',
                'image/jpeg',
                { exerciseId, exerciseName, serieKey, athleteNote }
            );
            setProgress(30);

            // 3. Subir foto a R2
            await uploadToR2(uploadUrl, photoUri, 'image/jpeg');
            setProgress(80);

            // 4. Confirmar en backend
            const result = await confirmUpload(feedbackId, null, null);
            setProgress(100);

            setUploading(false);
            return { success: true, feedback: result };

        } catch (err) {
            console.error('[PhotoFeedback] Error en subida:', err);
            setError(err.message);
            setUploading(false);
            return { success: false, error: err.message };
        }
    }, [getUploadUrl, uploadToR2, confirmUpload]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Flujo de subida de AUDIO
    // ═══════════════════════════════════════════════════════════════════════════
    const uploadAudioFeedback = useCallback(async ({
        audioUri,
        exerciseId,
        exerciseName,
        serieKey,
        athleteNote
    }) => {
        setUploading(true);
        setProgress(0);
        setError(null);

        try {
            // 1. Verificar conexión
            const networkState = await Network.getNetworkStateAsync();
            if (!networkState.isConnected) {
                setUploading(false);
                return { queued: true, message: 'Sin conexión. Inténtalo cuando tengas conexión.' };
            }

            setProgress(10);

            // 2. Obtener presigned URL
            const { uploadUrl, feedbackId } = await getUploadUrl(
                'audio',
                'audio/m4a', // Default for expo-audio/av usually
                { exerciseId, exerciseName, serieKey, athleteNote }
            );
            setProgress(30);

            // 3. Subir audio a R2
            await uploadToR2(uploadUrl, audioUri, 'audio/m4a');
            setProgress(80);

            // 4. Confirmar en backend
            const result = await confirmUpload(feedbackId, null, null);
            setProgress(100);

            setUploading(false);
            return { success: true, feedback: result };

        } catch (err) {
            console.error('[AudioFeedback] Error en subida:', err);
            setError(err.message);
            setUploading(false);
            return { success: false, error: err.message };
        }
    }, [getUploadUrl, uploadToR2, confirmUpload]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Cola offline
    // ═══════════════════════════════════════════════════════════════════════════
    const addToUploadQueue = useCallback(async (item) => {
        const queue = await AsyncStorage.getItem(UPLOAD_QUEUE_KEY);
        const items = queue ? JSON.parse(queue) : [];
        items.push(item);
        await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(items));
    }, []);

    const getUploadQueue = useCallback(async () => {
        const queue = await AsyncStorage.getItem(UPLOAD_QUEUE_KEY);
        return queue ? JSON.parse(queue) : [];
    }, []);

    const clearUploadQueue = useCallback(async () => {
        await AsyncStorage.removeItem(UPLOAD_QUEUE_KEY);
    }, []);

    const processUploadQueue = useCallback(async () => {
        const queue = await getUploadQueue();
        if (queue.length === 0) return;

        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected) return;

        console.log(`[VideoFeedback] Procesando ${queue.length} items en cola`);

        for (const item of queue) {
            try {
                await uploadVideoFeedback(item);
            } catch (err) {
                console.error('[VideoFeedback] Error procesando cola:', err);
            }
        }

        await clearUploadQueue();
    }, [getUploadQueue, uploadVideoFeedback, clearUploadQueue]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Obtener feedbacks del usuario
    // ═══════════════════════════════════════════════════════════════════════════
    const getMyFeedbacks = useCallback(async (page = 1) => {
        const response = await fetch(`${apiUrl}/api/video-feedback/my-feedbacks?page=${page}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error obteniendo feedbacks');
        return response.json();
    }, [apiUrl, token]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Obtener inbox (para coach)
    // ═══════════════════════════════════════════════════════════════════════════
    const getInbox = useCallback(async (options = {}) => {
        const { page = 1, mediaType, responded } = options;
        const params = new URLSearchParams({ page });
        if (mediaType) params.append('mediaType', mediaType);
        if (responded !== undefined) params.append('responded', responded);

        const response = await fetch(`${apiUrl}/api/video-feedback/inbox?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error obteniendo inbox');
        return response.json();
    }, [apiUrl, token]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Obtener un feedback específico
    // ═══════════════════════════════════════════════════════════════════════════
    const getFeedback = useCallback(async (feedbackId) => {
        const response = await fetch(`${apiUrl}/api/video-feedback/${feedbackId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error obteniendo feedback');
        return response.json();
    }, [apiUrl, token]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Responder (coach)
    // ═══════════════════════════════════════════════════════════════════════════
    const respondToFeedback = useCallback(async (feedbackId, { text, audioKey, annotations }) => {
        const response = await fetch(`${apiUrl}/api/video-feedback/${feedbackId}/respond`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text, audioKey, annotations })
        });
        if (!response.ok) throw new Error('Error enviando respuesta');
        return response.json();
    }, [apiUrl, token]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Toggle favorito
    // ═══════════════════════════════════════════════════════════════════════════
    const toggleFavorite = useCallback(async (feedbackId, isFavorite) => {
        const response = await fetch(`${apiUrl}/api/video-feedback/${feedbackId}/favorite`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isFavorite })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error actualizando favorito');
        }
        return response.json();
    }, [apiUrl, token]);

    return {
        // Estado
        uploading,
        progress,
        error,

        // Subida
        uploadVideoFeedback,
        uploadPhotoFeedback,
        uploadAudioFeedback,
        compressVideo,

        // Cola offline
        processUploadQueue,
        getUploadQueue,

        // Consultas
        getMyFeedbacks,
        getInbox,
        getFeedback,

        // Acciones
        respondToFeedback,
        toggleFavorite
    };
}

export default useVideoFeedback;
