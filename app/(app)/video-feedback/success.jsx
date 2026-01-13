// app/(app)/video-feedback/success.jsx
// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA DE ÉXITO CON SHARE A INSTAGRAM STORIES
// Sistema de Tiers: FREEUSER solo guarda, PREMIUM comparte + favoritos
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    Animated,
    Platform,
    Alert,
    Modal
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import { useAuth } from '../../../context/AuthContext';

// Importar solo en native
let Share, MediaLibrary;
if (Platform.OS !== 'web') {
    Share = require('react-native-share').default;
    MediaLibrary = require('expo-media-library');
}

export default function VideoSuccessScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const stickerRef = useRef(null);
    const { user, token } = useAuth();

    const { feedbackId, exerciseName, isPR, videoPath } = params;

    // Tier del usuario
    const isPremium = user?.tipoUsuario !== 'FREEUSER';

    // Estados
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [saving, setSaving] = useState(false);

    // Animaciones
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Animación de entrada
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true
            })
        ]).start();
    }, []);

    const API_URL = process.env.EXPO_PUBLIC_API_URL;

    // ═══════════════════════════════════════════════════════════════════════════
    // GUARDAR EN GALERÍA (TODOS LOS USUARIOS)
    // ═══════════════════════════════════════════════════════════════════════════
    const handleSaveToGallery = async () => {
        try {
            setSaving(true);

            // Pedir permiso
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para guardar el video.');
                return;
            }

            if (videoPath) {
                await MediaLibrary.saveToLibraryAsync(videoPath);
                Alert.alert('¡Guardado!', 'Tu video se ha guardado en la galería.');
            } else {
                Alert.alert('Error', 'No se encontró el video para guardar.');
            }
        } catch (error) {
            console.error('[Success] Error guardando:', error);
            Alert.alert('Error', 'No se pudo guardar el video.');
        } finally {
            setSaving(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPARTIR EN INSTAGRAM STORIES (TODOS LOS USUARIOS - MARKETING)
    // ═══════════════════════════════════════════════════════════════════════════
    const handleShareToStories = async () => {
        try {
            // Capturar el sticker
            let stickerUri = null;
            if (stickerRef.current) {
                stickerUri = await stickerRef.current.capture();
            }

            // Preparar opciones de share
            const shareOptions = {
                social: Share.Social.INSTAGRAM_STORIES,
                backgroundBottomColor: '#000000',
                backgroundTopColor: '#1a1a2e',
                appId: 'com.german92.titofitapp',
            };

            // AÑADIR VIDEO DE FONDO (CRÍTICO)
            if (videoPath) {
                shareOptions.backgroundVideo = videoPath;
            }

            // Si tenemos sticker, añadirlo correctamente según plataforma
            if (stickerUri) {
                if (Platform.OS === 'android') {
                    // Android requiere Base64 con prefijo
                    shareOptions.stickerImage = `data:image/png;base64,${stickerUri}`;
                } else {
                    // iOS funciona con file path
                    shareOptions.stickerImage = stickerUri;
                }
            }

            await Share.shareSingle(shareOptions);

        } catch (error) {
            console.log('[Success] Error compartiendo IG:', error);
            // Si falla IG Stories, ofrecer share normal CON EL VIDEO
            try {
                let shareUrl = videoPath;
                if (Platform.OS === 'android' && !shareUrl?.startsWith('file://')) {
                    shareUrl = `file://${shareUrl}`;
                }
                await Share.open({
                    message: `💪 Acabo de enviar un video de mi técnica de ${exerciseName} para que mi coach me corrija. #TotalGains`,
                    url: shareUrl,
                    type: 'video/*',
                });
            } catch (e) {
                console.log('[Success] Share cancelado');
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPARTIR EN TIKTOK (TODOS LOS USUARIOS - MARKETING)
    // ═══════════════════════════════════════════════════════════════════════════
    const handleShareToTikTok = async () => {
        try {
            // TikTok requiere el video directamente
            if (videoPath) {
                let shareUrl = videoPath;
                // Asegurar formato file:// en Android
                if (Platform.OS === 'android' && !shareUrl.startsWith('file://')) {
                    shareUrl = `file://${shareUrl}`;
                }

                await Share.shareSingle({
                    social: Share.Social.TIKTOK,
                    url: shareUrl,
                    title: `${exerciseName || 'Mi entreno'} 💪 #TotalGains #Fitness`,
                });
            } else {
                // Fallback: share general
                await Share.open({
                    message: `💪 Entrenamiento de ${exerciseName || 'hoy'} con TotalGains! #Fitness #GymTok`,
                });
            }
        } catch (error) {
            console.log('[Success] Error compartiendo TikTok:', error);
            // Fallback a share general CON EL VIDEO
            try {
                let shareUrl = videoPath;
                if (Platform.OS === 'android' && !shareUrl?.startsWith('file://')) {
                    shareUrl = `file://${shareUrl}`;
                }
                await Share.open({
                    message: `💪 Entrenamiento de ${exerciseName || 'hoy'} con TotalGains! #Fitness #GymTok`,
                    url: shareUrl,
                    type: 'video/*',
                });
            } catch (e) {
                console.log('[Success] Share TikTok cancelado');
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // MARCAR COMO FAVORITO (SOLO PREMIUM)
    // ═══════════════════════════════════════════════════════════════════════════
    const handleToggleFavorite = async () => {
        if (!isPremium) {
            setShowUpgradeModal(true);
            return;
        }

        if (!feedbackId) return;

        try {
            const response = await fetch(`${API_URL}/api/video-feedback/${feedbackId}/favorite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isFavorite: !isFavorite })
            });

            const data = await response.json();
            if (data.success) {
                setIsFavorite(data.feedback.isFavorite);
            } else {
                Alert.alert('Error', data.message || 'No se pudo actualizar favorito');
            }
        } catch (error) {
            console.error('[Success] Error toggling favorite:', error);
            Alert.alert('Error', 'Error de conexión');
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // NAVEGACIÓN
    // ═══════════════════════════════════════════════════════════════════════════
    const handleContinue = () => {
        router.replace('/(app)/entreno');
    };

    const handleGoHome = () => {
        router.replace('/(app)/home');
    };

    const handleGoToPayment = () => {
        setShowUpgradeModal(false);
        router.push('/(app)/payment');
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

            {/* Sticker para captura (oculto) */}
            <ViewShot
                ref={stickerRef}
                options={{
                    format: 'png',
                    quality: 0.8,
                    // Android requiere base64 para stickerImage en react-native-share
                    result: Platform.OS === 'android' ? 'base64' : 'tmpfile'
                }}
                style={styles.stickerCapture}
            >
                <View style={styles.sticker}>
                    {/* Logo de la App */}
                    <Image
                        source={require('../../../assets/images/logo.png')}
                        style={styles.stickerLogo}
                        resizeMode="contain"
                    />
                    <View style={styles.stickerBadge}>
                        <Text style={styles.stickerText}>ENTRENAMIENTO</Text>
                    </View>
                    {exerciseName && (
                        <Text style={styles.stickerExercise}>{exerciseName.toUpperCase()}</Text>
                    )}
                    <Text style={styles.stickerBrand}>TOTALGAINS</Text>

                    {/* Redes Sociales */}
                    <View style={styles.stickerSocialRow}>
                        <View style={styles.stickerSocialItem}>
                            <Ionicons name="logo-instagram" size={12} color="#ccc" />
                            <Text style={styles.stickerSocialText}>@TotalGainsFitnes</Text>
                        </View>
                        <View style={styles.stickerSocialItem}>
                            <Ionicons name="logo-tiktok" size={12} color="#ccc" />
                            <Text style={styles.stickerSocialText}>@totalgainsapp</Text>
                        </View>
                    </View>
                </View>
            </ViewShot>

            {/* Contenido visible */}
            <View style={styles.content}>
                {/* Animación de éxito */}
                <Animated.View
                    style={[
                        styles.successCircle,
                        {
                            transform: [{ scale: scaleAnim }],
                            opacity: opacityAnim
                        }
                    ]}
                >
                    <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={60} color="#fff" />
                    </View>
                </Animated.View>

                {/* Texto */}
                <Animated.View style={{ opacity: opacityAnim }}>
                    <Text style={styles.title}>
                        {isPR === 'true' ? '🚀 ¡NUEVO PR!' : '¡Video Enviado!'}
                    </Text>
                    <Text style={styles.subtitle}>
                        Tu coach recibirá una notificación y podrá revisar tu técnica
                    </Text>

                    {exerciseName && (
                        <View style={styles.exerciseBadge}>
                            <Ionicons name="barbell" size={18} color="#4361ee" />
                            <Text style={styles.exerciseText}>{exerciseName}</Text>
                        </View>
                    )}
                </Animated.View>

                {/* Botones */}
                <View style={styles.buttons}>
                    {/* Guardar en Galería (TODOS) */}
                    <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={handleSaveToGallery}
                        disabled={saving}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="download-outline" size={20} color="#fff" />
                        <Text style={styles.saveBtnText}>
                            {saving ? 'Guardando...' : 'Guardar en galería'}
                        </Text>
                    </TouchableOpacity>

                    {/* Redes sociales - horizontal */}
                    <View style={styles.socialRow}>
                        {/* Instagram (TODOS - MARKETING) */}
                        <TouchableOpacity
                            style={styles.socialBtn}
                            onPress={handleShareToStories}
                            activeOpacity={0.8}
                        >
                            <View style={styles.instagramGradient}>
                                <Ionicons name="logo-instagram" size={22} color="#fff" />
                                <Text style={styles.socialBtnText}>Stories</Text>
                            </View>
                        </TouchableOpacity>

                        {/* TikTok (TODOS - MARKETING) */}
                        <TouchableOpacity
                            style={styles.socialBtn}
                            onPress={handleShareToTikTok}
                            activeOpacity={0.8}
                        >
                            <View style={styles.tiktokGradient}>
                                <Ionicons name="musical-notes" size={22} color="#fff" />
                                <Text style={styles.socialBtnText}>TikTok</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Favorito (SOLO PREMIUM) */}
                    <TouchableOpacity
                        style={[styles.favoriteBtn, !isPremium && styles.lockedBtn]}
                        onPress={handleToggleFavorite}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name={isFavorite ? "star" : "star-outline"}
                            size={20}
                            color={isFavorite ? "#fbbf24" : "#888"}
                        />
                        <Text style={[styles.favoriteBtnText, isFavorite && { color: '#fbbf24' }]}>
                            {isFavorite ? 'En favoritos' : 'Añadir a favoritos'}
                        </Text>
                        {!isPremium && (
                            <Ionicons name="lock-closed" size={14} color="#666" style={{ marginLeft: 4 }} />
                        )}
                    </TouchableOpacity>

                    {/* Continuar entrenando */}
                    <TouchableOpacity
                        style={styles.continueBtn}
                        onPress={handleContinue}
                    >
                        <Ionicons name="barbell-outline" size={20} color="#fff" />
                        <Text style={styles.continueBtnText}>Seguir entrenando</Text>
                    </TouchableOpacity>

                    {/* Ir a home */}
                    <TouchableOpacity
                        style={styles.homeBtn}
                        onPress={handleGoHome}
                    >
                        <Text style={styles.homeBtnText}>Ir al inicio</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Modal Upgrade */}
            <Modal
                visible={showUpgradeModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowUpgradeModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <TouchableOpacity
                            style={styles.modalClose}
                            onPress={() => setShowUpgradeModal(false)}
                        >
                            <Ionicons name="close" size={24} color="#888" />
                        </TouchableOpacity>

                        <View style={styles.modalIcon}>
                            <Ionicons name="star" size={48} color="#fbbf24" />
                        </View>

                        <Text style={styles.modalTitle}>Función Premium ⭐</Text>
                        <Text style={styles.modalText}>
                            Guardar videos en favoritos está disponible solo para usuarios Premium. ¡Tus videos favoritos no expiran!
                        </Text>

                        <TouchableOpacity
                            style={styles.upgradeBtn}
                            onPress={handleGoToPayment}
                        >
                            <Text style={styles.upgradeBtnText}>Ver Planes Premium</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.laterBtn}
                            onPress={() => setShowUpgradeModal(false)}
                        >
                            <Text style={styles.laterBtnText}>Tal vez después</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a14',
    },
    // Sticker oculto para captura
    stickerCapture: {
        position: 'absolute',
        left: -1000,
        top: -1000,
    },
    sticker: {
        backgroundColor: '#1a1a2e',
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#4361ee',
        minWidth: 200,
        // Sombra para dar profundidad
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    stickerLogo: {
        width: 80,
        height: 80,
        marginBottom: 12,
    },
    stickerBadge: {
        backgroundColor: '#4361ee',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 8,
    },
    stickerEmoji: {
        fontSize: 40,
        marginBottom: 8,
    },
    stickerText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
    },
    stickerBrand: {
        color: '#4361ee',
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: 1,
        marginTop: 4,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    stickerExercise: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 4,
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    stickerSocialRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: 12,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    stickerSocialItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    stickerSocialText: {
        color: '#ccc',
        fontSize: 10,
        fontWeight: '600',
    },
    // Contenido principal
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    successCircle: {
        marginBottom: 32,
    },
    checkCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        color: '#888',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 20,
    },
    exerciseBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#1a1a2e',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        alignSelf: 'center',
    },
    exerciseText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    buttons: {
        marginTop: 48,
        width: '100%',
        gap: 12,
    },
    // Nuevo: Botón guardar galería
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: '#22c55e',
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    // Social row horizontal
    socialRow: {
        flexDirection: 'row',
        gap: 12,
    },
    socialBtn: {
        flex: 1,
        borderRadius: 14,
        overflow: 'hidden',
    },
    socialBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    shareBtn: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    // Nuevo: Estado bloqueado
    lockedBtn: {
        opacity: 0.6,
    },
    instagramGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        backgroundColor: '#E1306C', // Instagram pink
    },
    tiktokGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        backgroundColor: '#000', // TikTok black
    },
    shareBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    // Nuevo: Botón favorito
    favoriteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#1a1a2e',
        borderWidth: 1,
        borderColor: '#333',
    },
    favoriteBtnText: {
        color: '#888',
        fontSize: 15,
        fontWeight: '600',
    },
    continueBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: '#4361ee',
    },
    continueBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    homeBtn: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    homeBtnText: {
        color: '#666',
        fontSize: 15,
    },
    // Nuevo: Modal upgrade
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalCard: {
        backgroundColor: '#1a1a2e',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    modalClose: {
        position: 'absolute',
        top: 12,
        right: 12,
        padding: 8,
    },
    modalIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fbbf2420',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 12,
    },
    modalText: {
        color: '#888',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    upgradeBtn: {
        backgroundColor: '#fbbf24',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    upgradeBtnText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    },
    laterBtn: {
        paddingVertical: 12,
        marginTop: 8,
    },
    laterBtnText: {
        color: '#666',
        fontSize: 14,
    },
});
