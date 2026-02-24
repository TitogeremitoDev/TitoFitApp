// src/components/shared/StoryShareModal.jsx
// Componente reutilizable para compartir fotos/vídeos con branding del coach
// Usado en: Nutrición, Entrenamiento (feedback), Seguimiento, Fin de entreno

import React, { useRef, useCallback } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    Image,
    StyleSheet,
    Dimensions,
    Platform,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';

let MediaLibrary;
if (Platform.OS !== 'web') {
    MediaLibrary = require('expo-media-library');
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const PREVIEW_WIDTH = SCREEN_WIDTH - 48;
const PREVIEW_HEIGHT = PREVIEW_WIDTH * (16 / 9);

export default function StoryShareModal({
    visible,
    onClose,
    photoUri,
    videoUri = null,
    videoThumbnailUri = null,
    mediaType = 'photo',
    badgeText = '',
    mainText = '',
    coachName = 'mi entrenador',
    coachLogoUrl = null,
    coachColor = '#60a5fa',
    theme = {},
    embedded = false, // true = renderiza sin <Modal> (para usar dentro de otro Modal)
    onCloseParentModal = null, // callback para cerrar el modal padre antes de compartir (Android crash fix)
}) {
    const storyViewRef = useRef(null);

    // Refs para evitar stale closures en handleShare
    const mediaTypeRef = useRef(mediaType);
    const videoUriRef = useRef(videoUri);
    const photoUriRef = useRef(photoUri);
    mediaTypeRef.current = mediaType;
    videoUriRef.current = videoUri;
    photoUriRef.current = photoUri;

    const handleShare = useCallback(async () => {
        try {
            const currentMediaType = mediaTypeRef.current;
            const currentVideoUri = videoUriRef.current;
            const currentPhotoUri = photoUriRef.current;

            console.log('[StoryShareModal] 1️⃣ handleShare START:', { currentMediaType, hasVideo: !!currentVideoUri, hasPhoto: !!currentPhotoUri, embedded });

            // 1. Capturar imagen branded (para galería siempre, y para compartir si es foto)
            let brandedUri = null;
            try {
                if (storyViewRef.current) {
                    console.log('[StoryShareModal] 2️⃣ Capturing ViewShot...');
                    brandedUri = await storyViewRef.current.capture();
                    console.log('[StoryShareModal] 2️⃣ ViewShot captured OK');
                }
            } catch (captureErr) {
                console.warn('[StoryShareModal] 2️⃣ ViewShot capture FAILED:', captureErr.message);
            }

            // 2. Auto-save imagen branded a galería (silencioso)
            if (brandedUri && Platform.OS !== 'web' && MediaLibrary) {
                try {
                    console.log('[StoryShareModal] 3️⃣ Saving to gallery...');
                    await MediaLibrary.saveToLibraryAsync(brandedUri);
                    console.log('[StoryShareModal] 3️⃣ Gallery save OK');
                } catch (saveErr) {
                    console.warn('[StoryShareModal] 3️⃣ Gallery save FAILED:', saveErr.message);
                }
            }

            // 3. Determinar qué compartir: vídeo real o imagen branded, con fallback
            const isVideo = currentMediaType === 'video' && currentVideoUri;
            let shareUri = isVideo ? currentVideoUri : (brandedUri || currentPhotoUri);
            const shareMime = isVideo ? 'video/mp4' : 'image/png';

            // expo-sharing requiere file:// scheme
            if (shareUri && !shareUri.startsWith('file://') && !shareUri.startsWith('content://') && !shareUri.startsWith('http')) {
                shareUri = 'file://' + shareUri;
            }

            console.log('[StoryShareModal] 4️⃣ Share URI:', shareUri ? shareUri.substring(0, 80) : 'NULL', 'isVideo:', isVideo);

            if (!shareUri) {
                console.warn('[StoryShareModal] 4️⃣ No URI to share!');
                Alert.alert('Error', 'No hay contenido para compartir.');
                return;
            }

            const Sharing = require('expo-sharing');
            const available = await Sharing.isAvailableAsync();
            console.log('[StoryShareModal] 5️⃣ Sharing available:', available);
            if (!available) {
                Alert.alert('Error', 'Compartir no está disponible en este dispositivo.');
                return;
            }

            // Android: cerrar modal padre antes de abrir share Intent (evita crash)
            if (Platform.OS === 'android' && embedded && onCloseParentModal) {
                console.log('[StoryShareModal] 6️⃣ Android embedded: closing parent modal first...');
                onCloseParentModal();
                await new Promise(resolve => setTimeout(resolve, 400));
                console.log('[StoryShareModal] 6️⃣ Parent modal closed, proceeding to share');
            }

            console.log('[StoryShareModal] 7️⃣ Calling Sharing.shareAsync...');
            await Sharing.shareAsync(shareUri, {
                mimeType: shareMime,
                dialogTitle: 'Compartir',
            });
            console.log('[StoryShareModal] 8️⃣ Share completed OK');

            onClose();
        } catch (error) {
            console.error('[StoryShareModal] Share error:', error.message, error.code || '');
            Alert.alert('Error', 'No se pudo compartir.');
        }
    }, [onClose]);

    // Determinar la imagen de fondo
    // Para vídeos: usar thumbnail (debe ser imagen real generada con expo-video-thumbnails)
    // Safety check: no usar URIs de vídeo como fuente de Image (causa crash Android)
    const safeVideoThumb = videoThumbnailUri && !videoThumbnailUri.match(/\.(mp4|mov|avi|mkv|webm)$/i) ? videoThumbnailUri : null;
    const backgroundUri = mediaType === 'photo' ? photoUri : safeVideoThumb;

    if (!visible) return null;

    const content = (
        <View style={[styles.overlay, embedded && styles.overlayEmbedded]}>
            <View style={[styles.container, { backgroundColor: theme.cardBackground || '#1a1a2e' }]}>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                    <Ionicons name="close-circle" size={32} color={theme.textSecondary || '#888'} />
                </TouchableOpacity>

                <Text style={[styles.title, { color: theme.text || '#FFF' }]}>
                    {mediaType === 'video' ? 'Vídeo listo para compartir' : 'Foto lista para compartir'}
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary || '#888' }]}>
                    Comparte en Instagram Stories u otras redes
                </Text>

                {/* Story Preview (captured by ViewShot) */}
                <View style={styles.previewWrapper}>
                    <ViewShot
                        ref={storyViewRef}
                        options={{ format: 'png', quality: 1, width: 1080, height: 1920 }}
                        style={styles.storyCanvas}
                    >
                        {/* Background: foto, thumbnail de vídeo, o gradient fallback */}
                        {backgroundUri ? (
                            <Image
                                source={{ uri: backgroundUri }}
                                style={styles.storyPhoto}
                                resizeMode="cover"
                            />
                        ) : (
                            <LinearGradient
                                colors={['#1a1a2e', '#16213e', '#0f3460']}
                                style={styles.storyPhoto}
                            />
                        )}

                        {/* Play icon overlay para vídeos */}
                        {mediaType === 'video' && (
                            <View style={styles.playIconOverlay}>
                                <View style={styles.playIconCircle}>
                                    <Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 3 }} />
                                </View>
                            </View>
                        )}

                        {/* Dark gradient overlay at bottom */}
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.85)']}
                            style={styles.storyGradient}
                        />

                        {/* Top badge */}
                        <View style={styles.storyTopBadge}>
                            <Text style={styles.storyTopBadgeText}>
                                {badgeText}
                            </Text>
                        </View>

                        {/* Bottom content: message + logo */}
                        <View style={styles.storyBottomContent}>
                            <View style={styles.storyTextBlock}>
                                <Text style={styles.storyMainText}>
                                    {mainText}{'\n'}
                                    <Text style={[styles.storyCoachName, { color: coachColor }]}>
                                        {coachName}
                                    </Text>
                                </Text>
                                <Text style={styles.storyAppText}>
                                    Powered by TotalGains 💪
                                </Text>
                            </View>

                            {coachLogoUrl ? (
                                <Image
                                    source={{ uri: coachLogoUrl }}
                                    style={[styles.storyLogo, { borderColor: coachColor }]}
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={[styles.storyLogoFallback, { backgroundColor: coachColor }]}>
                                    <Text style={styles.storyLogoFallbackText}>
                                        {(coachName || 'E').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </ViewShot>
                </View>

                {/* Share Button */}
                <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                    <LinearGradient
                        colors={['#f09433', '#e6683c', '#dc2743', '#cc2366', '#bc1888']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.shareBtnGradient}
                    >
                        <Ionicons name="logo-instagram" size={22} color="#FFF" />
                        <Text style={styles.shareBtnText}>Compartir en Stories</Text>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Skip Button */}
                <TouchableOpacity
                    style={[styles.skipBtn, {
                        backgroundColor: theme.inputBackground || '#0d0d1a',
                        borderColor: theme.inputBorder || '#333',
                    }]}
                    onPress={onClose}
                >
                    <Text style={[styles.skipBtnText, { color: theme.textSecondary || '#888' }]}>
                        Ahora no
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // embedded=true: renderiza como overlay absoluto (para usar dentro de otro Modal)
    // embedded=false: renderiza con su propio <Modal>
    if (embedded) {
        return content;
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            {content}
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    overlayEmbedded: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
    },
    container: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
    },
    closeBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        marginTop: 8,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        marginBottom: 16,
    },
    previewWrapper: {
        width: PREVIEW_WIDTH,
        height: PREVIEW_HEIGHT,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    storyCanvas: {
        width: PREVIEW_WIDTH,
        height: PREVIEW_HEIGHT,
        backgroundColor: '#000',
    },
    storyPhoto: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    storyGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '45%',
    },
    storyTopBadge: {
        position: 'absolute',
        top: 16,
        left: 16,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    storyTopBadgeText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    storyBottomContent: {
        position: 'absolute',
        bottom: 20,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    storyTextBlock: {
        flex: 1,
        marginRight: 12,
    },
    storyMainText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 22,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    storyCoachName: {
        fontSize: 20,
        fontWeight: '900',
    },
    storyAppText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 6,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    storyLogo: {
        width: 56,
        height: 56,
        borderRadius: 14,
        borderWidth: 2,
    },
    storyLogoFallback: {
        width: 56,
        height: 56,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    storyLogoFallbackText: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '900',
    },
    shareBtn: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 10,
    },
    shareBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
    },
    shareBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
    },
    skipBtn: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 1,
    },
    skipBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
    playIconOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    playIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
