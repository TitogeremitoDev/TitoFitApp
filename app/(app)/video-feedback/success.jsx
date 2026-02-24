// app/(app)/video-feedback/success.jsx
// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA DE ÉXITO CON SHARE A INSTAGRAM STORIES / TIKTOK
// Sistema de BRANDING: Logo del coach + "Powered by TotalGains"
// Misma estética que el sistema de compartir de Nutrición
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
    Modal,
    Dimensions,
    ScrollView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../../context/AuthContext';
import { useTrainer } from '../../../context/TrainerContext';
import { useCoachBranding } from '../../../context/CoachBrandingContext';

// Importar solo en native
let Share, MediaLibrary;
if (Platform.OS !== 'web') {
    Share = require('react-native-share').default;
    MediaLibrary = require('expo-media-library');
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const PREVIEW_WIDTH = SCREEN_WIDTH - 80;
const PREVIEW_HEIGHT = PREVIEW_WIDTH * (16 / 9);

export default function VideoSuccessScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const { user, token } = useAuth();
    const { trainer } = useTrainer();
    const { branding: coachBranding, activeTheme } = useCoachBranding();

    const { feedbackId, exerciseName, isPR, videoPath, thumbnailUri: paramThumbnail } = params;

    // Tier del usuario
    const isPremium = user?.tipoUsuario !== 'FREEUSER';

    // Coach info (from TrainerContext — logo in trainerProfile)
    const coachName = trainer?.profile?.brandName || trainer?.nombre || 'mi entrenador';
    const coachLogoUrl = trainer?.profile?.logoUrl || null;
    const coachColor = activeTheme?.colors?.primary || '#60a5fa';

    // Estados
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showStoryModal, setShowStoryModal] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [saving, setSaving] = useState(false);

    // Refs
    const stickerRef = useRef(null);        // Sticker para IG Stories (sobre video)
    const storyImageRef = useRef(null);     // Story completa para compartir como imagen

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
    // COMPARTIR EN INSTAGRAM STORIES (Abre modal con branding, como Nutrición)
    // ═══════════════════════════════════════════════════════════════════════════
    const handleShareToStories = () => {
        // Abrir el modal de story con branding (idéntico al flujo de nutrición)
        setShowStoryModal(true);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPARTIR EN TIKTOK (TODOS LOS USUARIOS)
    // ═══════════════════════════════════════════════════════════════════════════
    const handleShareToTikTok = async () => {
        try {
            if (videoPath) {
                let shareUrl = videoPath;
                if (Platform.OS === 'android' && !shareUrl.startsWith('file://')) {
                    shareUrl = `file://${shareUrl}`;
                }

                await Share.shareSingle({
                    social: Share.Social.TIKTOK,
                    url: shareUrl,
                    title: `${exerciseName || 'Mi entreno'} 💪 #TotalGains #Fitness`,
                });
            } else {
                await Share.open({
                    message: `💪 Entrenamiento de ${exerciseName || 'hoy'} con TotalGains! #Fitness #GymTok`,
                });
            }
        } catch (error) {
            console.log('[Success] Error compartiendo TikTok:', error);
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
    // COMPARTIR IMAGEN CON BRANDING (Estilo idéntico a Nutrición)
    // ═══════════════════════════════════════════════════════════════════════════
    const handleShareStoryImage = async () => {
        try {
            if (!storyImageRef.current) return;
            const uri = await storyImageRef.current.capture();

            const available = await Sharing.isAvailableAsync();
            if (!available) {
                Alert.alert('Error', 'Compartir no está disponible en este dispositivo.');
                return;
            }
            await Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                dialogTitle: 'Compartir en Stories',
            });
            setShowStoryModal(false);
        } catch (error) {
            console.error('[Story] Share error:', error);
            Alert.alert('Error', 'No se pudo compartir la imagen.');
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

            {/* ═══════════════════════════════════════════════════════════════
                STICKER OCULTO PARA IG STORIES (Se superpone al video)
                Con branding del coach — Estilo consistente con Nutrición
            ═══════════════════════════════════════════════════════════════ */}
            <ViewShot
                ref={stickerRef}
                options={{
                    format: 'png',
                    quality: 0.9,
                    result: Platform.OS === 'android' ? 'base64' : 'tmpfile'
                }}
                style={styles.stickerCapture}
            >
                <View style={[styles.sticker, { borderColor: coachColor }]}>
                    {/* Ejercicio badge */}
                    <View style={[styles.stickerExerciseBadge, { backgroundColor: coachColor + '20' }]}>
                        <Text style={styles.stickerExerciseEmoji}>🏋️</Text>
                        <Text style={[styles.stickerExerciseText, { color: coachColor }]}>
                            {(exerciseName || 'ENTRENAMIENTO').toUpperCase()}
                        </Text>
                    </View>

                    {/* Coach Logo */}
                    {coachLogoUrl ? (
                        <Image
                            source={{ uri: coachLogoUrl }}
                            style={[styles.stickerCoachLogo, { borderColor: coachColor }]}
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={[styles.stickerCoachLogoFallback, { backgroundColor: coachColor }]}>
                            <Text style={styles.stickerCoachLogoText}>
                                {coachName.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}

                    {/* Coach name */}
                    <Text style={styles.stickerCoachName} numberOfLines={1}>
                        {coachName}
                    </Text>

                    {/* Powered by */}
                    <View style={styles.stickerPoweredRow}>
                        <Image
                            source={require('../../../assets/images/logo.png')}
                            style={styles.stickerAppLogo}
                            resizeMode="contain"
                        />
                        <Text style={styles.stickerPoweredText}>Powered by TotalGains</Text>
                    </View>
                </View>
            </ViewShot>

            {/* ═══════════════════════════════════════════════════════════════
                CONTENIDO VISIBLE
            ═══════════════════════════════════════════════════════════════ */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
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
                                <Ionicons name="barbell" size={18} color={coachColor} />
                                <Text style={styles.exerciseText}>{exerciseName}</Text>
                            </View>
                        )}
                    </Animated.View>

                    {/* ═══════════════════════════════════════════════════════
                        SECCIÓN DE COMPARTIR — Estilo idéntico a Nutrición
                    ═══════════════════════════════════════════════════════ */}
                    <View style={styles.shareSection}>
                        <Text style={styles.shareSectionTitle}>📱 Comparte tu entreno</Text>
                    </View>

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

                        {/* Instagram Stories — Abre modal con branding (como Nutrición) */}
                        <TouchableOpacity
                            style={styles.igStoryBtn}
                            onPress={handleShareToStories}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#f09433', '#e6683c', '#dc2743', '#cc2366', '#bc1888']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.igStoryBtnGradient}
                            >
                                <Ionicons name="logo-instagram" size={22} color="#fff" />
                                <Text style={styles.igStoryBtnText}>Compartir en Stories</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* TikTok */}
                        <TouchableOpacity
                            style={styles.socialBtn}
                            onPress={handleShareToTikTok}
                            activeOpacity={0.8}
                        >
                            <View style={styles.tiktokGradient}>
                                <Ionicons name="musical-notes" size={22} color="#fff" />
                                <Text style={styles.socialBtnText}>Compartir en TikTok</Text>
                            </View>
                        </TouchableOpacity>

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
                            style={[styles.continueBtn, { backgroundColor: coachColor }]}
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
            </ScrollView>

            {/* ═══════════════════════════════════════════════════════════════
                MODAL: Story con branding — IDÉNTICO A NUTRICIÓN
                Foto/thumbnail ocupa TODA la pantalla, layout encima
            ═══════════════════════════════════════════════════════════════ */}
            <Modal
                visible={showStoryModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowStoryModal(false)}
            >
                <View style={storyStyles.overlay}>
                    <View style={[storyStyles.container, { backgroundColor: '#1a1a2e' }]}>
                        <TouchableOpacity
                            style={storyStyles.closeBtn}
                            onPress={() => setShowStoryModal(false)}
                        >
                            <Ionicons name="close-circle" size={32} color="#888" />
                        </TouchableOpacity>

                        <Text style={storyStyles.title}>
                            Comparte tu entreno 💪
                        </Text>
                        <Text style={storyStyles.subtitle}>
                            Comparte tu entrenamiento con branding
                        </Text>

                        {/* Story Preview (captured by ViewShot) — IDÉNTICO a Nutrición */}
                        <View style={storyStyles.previewWrapper}>
                            <ViewShot
                                ref={storyImageRef}
                                options={{ format: 'png', quality: 1, width: 1080, height: 1920 }}
                                style={storyStyles.storyCanvas}
                            >
                                {/* Background photo — ocupa TODO como en Nutrición */}
                                {paramThumbnail ? (
                                    <Image
                                        source={{ uri: paramThumbnail }}
                                        style={storyStyles.storyPhoto}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <LinearGradient
                                        colors={['#1a1a2e', '#16213e', '#0f3460']}
                                        style={storyStyles.storyPhoto}
                                    />
                                )}

                                {/* Dark gradient overlay at bottom */}
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                                    style={storyStyles.storyGradient}
                                />

                                {/* Top badge: Ejercicio (arriba-izquierda, como Nutrición) */}
                                <View style={storyStyles.storyTopBadge}>
                                    <Text style={storyStyles.storyTopBadgeText}>
                                        🏋️ {exerciseName || 'Entrenamiento'}
                                    </Text>
                                </View>

                                {/* Bottom content: message + logo (idéntico a Nutrición) */}
                                <View style={storyStyles.storyBottomContent}>
                                    <View style={storyStyles.storyTextBlock}>
                                        <Text style={storyStyles.storyMainText}>
                                            Entrenando con{'\n'}
                                            <Text style={[storyStyles.storyCoachName, { color: coachColor }]}>
                                                {coachName}
                                            </Text>
                                        </Text>
                                        <Text style={storyStyles.storyAppText}>
                                            Powered by TotalGains 💪
                                        </Text>
                                    </View>

                                    {/* Coach logo */}
                                    {coachLogoUrl ? (
                                        <Image
                                            source={{ uri: coachLogoUrl }}
                                            style={[storyStyles.storyLogo, { borderColor: coachColor }]}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <View style={[storyStyles.storyLogoFallback, { backgroundColor: coachColor }]}>
                                            <Text style={storyStyles.storyLogoFallbackText}>
                                                {coachName.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </ViewShot>
                        </View>

                        {/* Action buttons */}
                        <TouchableOpacity
                            style={storyStyles.shareBtn}
                            onPress={handleShareStoryImage}
                        >
                            <LinearGradient
                                colors={['#f09433', '#e6683c', '#dc2743', '#cc2366', '#bc1888']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={storyStyles.shareBtnGradient}
                            >
                                <Ionicons name="logo-instagram" size={22} color="#FFF" />
                                <Text style={storyStyles.shareBtnText}>Compartir en Stories</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={storyStyles.skipBtn}
                            onPress={() => setShowStoryModal(false)}
                        >
                            <Text style={storyStyles.skipBtnText}>
                                Ahora no
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS - Story Modal (estilo Nutrición)
// ═══════════════════════════════════════════════════════════════════════════
const storyStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    container: {
        width: '100%',
        maxWidth: 380,
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
        color: '#fff',
        marginTop: 8,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#888',
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
    storyPoweredRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    storyAppLogo: {
        width: 18,
        height: 18,
        borderRadius: 4,
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
        borderColor: '#333',
        backgroundColor: '#0d0d1a',
    },
    skipBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS PRINCIPALES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a14',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    // Sticker oculto para captura
    stickerCapture: {
        position: 'absolute',
        left: -1000,
        top: -1000,
    },
    sticker: {
        backgroundColor: '#1a1a2e',
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 2,
        minWidth: 220,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    stickerExerciseBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        marginBottom: 12,
    },
    stickerExerciseEmoji: {
        fontSize: 16,
    },
    stickerExerciseText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    stickerCoachLogo: {
        width: 64,
        height: 64,
        borderRadius: 16,
        borderWidth: 2,
        marginBottom: 8,
    },
    stickerCoachLogoFallback: {
        width: 64,
        height: 64,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    stickerCoachLogoText: {
        color: '#FFF',
        fontSize: 28,
        fontWeight: '900',
    },
    stickerCoachName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    stickerPoweredRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    stickerAppLogo: {
        width: 16,
        height: 16,
        borderRadius: 3,
    },
    stickerPoweredText: {
        color: '#aaa',
        fontSize: 10,
        fontWeight: '600',
    },
    // Contenido principal
    content: {
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    successCircle: {
        marginBottom: 24,
    },
    checkCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
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
        fontSize: 26,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 16,
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
    // Share section
    shareSection: {
        width: '100%',
        marginTop: 24,
        marginBottom: 8,
    },
    shareSectionTitle: {
        color: '#ccc',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 12,
    },
    // Buttons
    buttons: {
        marginTop: 16,
        width: '100%',
        gap: 10,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#22c55e',
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    // IG Stories button (principal — como Nutrición)
    igStoryBtn: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
    },
    igStoryBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
    },
    igStoryBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
    },
    // TikTok & social buttons
    socialBtn: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
    },
    socialBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    tiktokGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        backgroundColor: '#000',
        borderRadius: 14,
    },
    lockedBtn: {
        opacity: 0.6,
    },
    favoriteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#1a1a2e',
        borderWidth: 1,
        borderColor: '#333',
    },
    favoriteBtnText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
    },
    continueBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
    },
    continueBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    homeBtn: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    homeBtnText: {
        color: '#666',
        fontSize: 14,
    },
    // Modal upgrade
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
