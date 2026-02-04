import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

/**
 * Servicio para gestión de Avatares (Compresión y Subida)
 */
export const avatarService = {

    /**
     * Comprime y redimensiona la imagen seleccionada
     * @param {string} uri - URI de la imagen original
     * @returns {Promise<object>} - Objeto con uri (la librería retorna string directo)
     */
    processImage: async (uri) => {
        try {
            if (Platform.OS === 'web') {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        // Mantener aspect ratio si se desea, o forzar 800x800
                        const MAX_SIZE = 800;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_SIZE) {
                                height *= MAX_SIZE / width;
                                width = MAX_SIZE;
                            }
                        } else {
                            if (height > MAX_SIZE) {
                                width *= MAX_SIZE / height;
                                height = MAX_SIZE;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        // Retornar Data URL
                        resolve({ uri: canvas.toDataURL('image/jpeg', 0.8) });
                    };
                    img.onerror = (e) => {
                        console.warn('[AvatarService] Web resize failed, using original:', e);
                        resolve({ uri: uri });
                    };
                    img.src = uri;
                });
            }

            // Native compression - Dynamic require to avoid Web issues
            const { Image: CompressorImage } = require('react-native-compressor');

            const resultUri = await CompressorImage.compress(uri, {
                compressionMethod: 'manual',
                maxWidth: 800,
                maxHeight: 800,
                quality: 0.8,
            });

            return { uri: resultUri };
        } catch (error) {
            console.warn('[AvatarService] Compression failed, using original image:', error);
            return { uri: uri };
        }
    },

    /**
     * Sube el avatar al servidor
     * @param {string} imageUri - URI local de la imagen
     * @param {string} token - Token de autenticación del usuario
     * @returns {Promise<string>} - URL del avatar subido
     */
    uploadAvatar: async (imageUri, token) => {
        try {
            // 1. Procesar imagen (Compresión)
            const processedImage = await avatarService.processImage(imageUri);

            // 2. Preparar FormData
            const formData = new FormData();

            const filename = imageUri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            if (Platform.OS === 'web') {
                // En Web necesitamos un Blob real
                const response = await fetch(processedImage.uri);
                const blob = await response.blob();
                console.log(`[AvatarService] Web Upload: Size=${blob.size}, Type=${blob.type}`);
                formData.append('avatar', blob, 'avatar.jpg'); // Enforce safe filename
            } else {
                // En Native usamos el objeto { uri, name, type }
                formData.append('avatar', {
                    uri: Platform.OS === 'android' ? processedImage.uri : processedImage.uri.replace('file://', ''),
                    name: `avatar_${Date.now()}.jpg`,
                    type: 'image/jpeg'
                });
            }

            // 3. Subir
            const response = await fetch(`${API_URL}/api/users/avatar`, {
                method: 'POST',
                body: formData,
                headers: {
                    Authorization: `Bearer ${token}`,
                    // No poner 'Content-Type': 'multipart/form-data', fetch lo pone solo con el boundary
                }
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Error al subir avatar');
            }

            return data.avatarUrl;
        } catch (error) {
            console.error('[AvatarService] Upload error:', error);
            throw error;
        }
    },

    /**
     * Elimina el avatar actual del usuario
     * @param {string} token - Token de autenticación
     */
    deleteAvatar: async (token) => {
        try {
            const response = await fetch(`${API_URL}/api/users/avatar`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Error al eliminar avatar');
            }

            return true;
        } catch (error) {
            console.error('[AvatarService] Delete error:', error);
            throw error;
        }
    }
};
