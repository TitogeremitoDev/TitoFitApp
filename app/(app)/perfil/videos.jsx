/* app/(app)/perfil/videos.jsx
    Videoteca de ejercicios - Ahora carga datos desde MongoDB (campo videoId)
    - Estilo profesional y premium
    - Buscador integrado
    - Categorías por músculo con iconos
    - Modal de video mejorado
    ──────────────────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
    LayoutAnimation,
    Platform,
    UIManager,
    Modal,
    useWindowDimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { EnhancedTextInput } from '../../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import YoutubeIframe from 'react-native-youtube-iframe';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Mapeo de iconos por músculo
const MUSCLE_ICONS = {
    'PECHO': 'fitness',
    'ESPALDA': 'reorder-four',
    'PIERNAS': 'walk',
    'GLÚTEOS': 'accessibility',
    'HOMBROS': 'body',
    'BÍCEPS': 'barbell',
    'TRÍCEPS': 'flash',
    'ABDOMEN': 'apps',
    'CORE': 'apps',
    'CARDIO': 'heart',
    'ANTEBRAZOS': 'hand-left',
    'CADERA': 'body-outline',
};

export default function VideosScreen() {
    const router = useRouter();
    const { user, token } = useAuth();
    const { theme, isDark } = useTheme();

    // Dynamic dimensions for responsive modal
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const modalWidth = Math.min(screenWidth * 0.95, 600); // maxWidth 600 for web

    const [openMuscle, setOpenMuscle] = useState(null);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [playing, setPlaying] = useState(false);
    const [showVideoPlayer, setShowVideoPlayer] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Estado para datos de MongoDB
    const [exercisesByMuscle, setExercisesByMuscle] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    // Cargar ejercicios desde MongoDB al montar
    useEffect(() => {
        fetchExercisesFromCloud();
    }, []);

    const fetchExercisesFromCloud = async () => {
        try {
            setIsLoading(true);
            setLoadError(null);

            const response = await fetch(`${API_URL}/api/exercises`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Error al cargar ejercicios');
            }

            const data = await response.json();
            const exercises = data.exercises || data || [];

            // Agrupar ejercicios por músculo
            const grouped = {};
            for (const ex of exercises) {
                const muscle = (ex.muscle || '').trim().toUpperCase();
                if (!muscle) continue;

                if (!grouped[muscle]) {
                    grouped[muscle] = {};
                }

                const name = (ex.name || '').trim();
                if (!name) continue;

                const videoId = (ex.videoId || '').trim();
                grouped[muscle][name] = {
                    id: videoId,
                    formato: '16:9',
                };
            }

            setExercisesByMuscle(grouped);
        } catch (error) {
            console.error('[Videos] Error fetching exercises:', error);
            setLoadError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Filtrado de ejercicios por búsqueda
    const filteredExercises = useMemo(() => {
        if (!searchQuery.trim()) return exercisesByMuscle;

        const query = searchQuery.toLowerCase();
        const filtered = {};

        Object.entries(exercisesByMuscle).forEach(([muscle, exercises]) => {
            const filteredEx = {};
            let hasMatches = muscle.toLowerCase().includes(query);

            Object.entries(exercises).forEach(([name, data]) => {
                if (name.toLowerCase().includes(query) || hasMatches) {
                    filteredEx[name] = data;
                }
            });

            if (Object.keys(filteredEx).length > 0) {
                filtered[muscle] = filteredEx;
            }
        });

        return filtered;
    }, [exercisesByMuscle, searchQuery]);

    const toggleMuscle = (muscle) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenMuscle(openMuscle === muscle ? null : muscle);
    };

    const handleExercisePress = (videoData) => {
        if (user?.tipoUsuario === 'FREE' || user?.tipoUsuario === 'FREEUSER') {
            setShowUpgradeModal(true);
            return;
        }

        if (!videoData || !videoData.id || videoData.id.startsWith('VIDEO_ID_')) {
            alert('Video no disponible aún para este ejercicio.');
            return;
        }
        setSelectedVideo(videoData);
        setShowVideoPlayer(true);
        setTimeout(() => {
            setPlaying(true);
        }, 100);
    };

    const closeModal = () => {
        setPlaying(false);
        setShowVideoPlayer(false);
        setSelectedVideo(null);
    };

    const closeUpgradeModal = () => {
        setShowUpgradeModal(false);
    };

    const goToPayment = () => {
        setShowUpgradeModal(false);
        router.push('/payment');
    };

    const onStateChange = (state) => {
        if (state === 'ended') {
            setPlaying(false);
            closeModal();
        }
        if (state === 'error') {
            alert('Error al reproducir el video');
            closeModal();
        }
    };

    const listaMusculos = Object.keys(filteredExercises).sort();

    // --- CÁLCULO DE ALTURA DINÁMICO ---
    let videoHeight = (modalWidth * 9) / 16;
    if (selectedVideo?.formato === '9:16') {
        videoHeight = (modalWidth * 16) / 9;
        const maxHeight = screenHeight * 0.85;
        if (videoHeight > maxHeight) {
            videoHeight = maxHeight;
        }
    }

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }, styles.centerContent]}>
                <Stack.Screen
                    options={{
                        title: 'Videoteca',
                        headerTitleStyle: { color: theme.text, fontWeight: '800' },
                        headerStyle: { backgroundColor: theme.background },
                        headerTintColor: theme.text,
                        headerLeft: () => (
                            <Pressable
                                onPress={() => router.back()}
                                style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
                            >
                                <Ionicons name="arrow-back" size={24} color={theme.text} />
                            </Pressable>
                        ),
                    }}
                />
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Sincronizando videoteca...</Text>
            </View>
        );
    }

    if (loadError) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }, styles.centerContent]}>
                <Stack.Screen options={{ title: 'Error' }} />
                <Ionicons name="alert-circle" size={64} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{loadError}</Text>
                <Pressable
                    style={[styles.retryButton, { backgroundColor: theme.primary }]}
                    onPress={fetchExercisesFromCloud}
                >
                    <Text style={styles.retryButtonText}>Reintentar</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTransparent: false,
                    safeAreaInsets: { top: 0 },
                    title: '',
                    headerStyle: { backgroundColor: theme.background },
                    headerShadowVisible: false,
                    headerLeft: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Pressable
                                onPress={() => router.back()}
                                style={({ pressed }) => [styles.headerButton, { backgroundColor: theme.backgroundSecondary }, pressed && styles.headerButtonPressed]}
                            >
                                <Ionicons name="arrow-back" size={24} color={theme.text} />
                            </Pressable>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text, textTransform: 'uppercase' }}>VIDEOTECA</Text>
                        </View>
                    ),
                }}
            />

            <View style={styles.searchContainer}>
                <View style={[styles.searchWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                    <Ionicons name="search" size={20} color={theme.textTertiary} />
                    <EnhancedTextInput
                        style={{ fontSize: 20, fontWeight: '1000' }}
                        containerStyle={{ flex: 1, marginLeft: 10 }}
                        placeholder="Buscar ejercicio o músculo..."
                        placeholderTextColor={theme.textTertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <Pressable onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
                        </Pressable>
                    )}
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {listaMusculos.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={[styles.emptyIconCircle, { backgroundColor: theme.backgroundSecondary }]}>
                            <Ionicons name="search-outline" size={48} color={theme.textTertiary} />
                        </View>
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                            No encontramos resultados para "{searchQuery}"
                        </Text>
                    </View>
                ) : (
                    listaMusculos.map((muscle) => {
                        const isOpen = openMuscle === muscle;
                        const iconName = MUSCLE_ICONS[muscle] || 'fitness';
                        const count = Object.keys(filteredExercises[muscle]).length;

                        return (
                            <View key={muscle} style={[
                                styles.muscleGroup,
                                {
                                    backgroundColor: theme.backgroundSecondary,
                                    borderColor: isOpen ? theme.primary : theme.border,
                                    borderWidth: 1,
                                }
                            ]}>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.muscleButton,
                                        pressed && { opacity: 0.8 }
                                    ]}
                                    onPress={() => toggleMuscle(muscle)}
                                >
                                    <View style={styles.muscleInfo}>
                                        <View style={[styles.iconBox, { backgroundColor: isOpen ? theme.primary : isDark ? '#2D3748' : '#EDF2F7' }]}>
                                            <Ionicons
                                                name={iconName}
                                                size={20}
                                                color={isOpen ? '#FFF' : theme.textSecondary}
                                            />
                                        </View>
                                        <View style={styles.muscleTextContainer}>
                                            <Text style={[styles.muscleButtonText, { color: theme.text }]}>
                                                {muscle}
                                            </Text>
                                            <Text style={[styles.muscleCount, { color: theme.textTertiary }]}>
                                                {count} {count === 1 ? 'ejercicio' : 'ejercicios'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={[styles.chevronBox, { backgroundColor: isOpen ? theme.primary + '20' : 'transparent' }]}>
                                        <Ionicons
                                            name={isOpen ? 'chevron-up' : 'chevron-down'}
                                            size={18}
                                            color={isOpen ? theme.primary : theme.textTertiary}
                                        />
                                    </View>
                                </Pressable>

                                {isOpen && (
                                    <View style={[styles.exerciseList, { borderTopColor: theme.border }]}>
                                        <LinearGradient
                                            colors={[theme.backgroundSecondary, theme.background]}
                                            style={styles.exerciseGradient}
                                        >
                                            {Object.entries(filteredExercises[muscle]).map(([exercise, videoData], idx) => (
                                                <Pressable
                                                    key={exercise}
                                                    style={({ pressed }) => [
                                                        styles.exerciseButton,
                                                        pressed && { backgroundColor: theme.primary + '10' },
                                                        idx !== count - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border + '50' }
                                                    ]}
                                                    onPress={() => handleExercisePress(videoData)}
                                                >
                                                    <View style={[styles.playIndicator, { backgroundColor: videoData.id ? theme.primary + '15' : theme.background }]}>
                                                        <Ionicons
                                                            name={videoData.id ? "play" : "play-outline"}
                                                            size={14}
                                                            color={videoData.id ? theme.primary : theme.textTertiary}
                                                        />
                                                    </View>
                                                    <Text style={[
                                                        styles.exerciseButtonText,
                                                        { color: theme.text },
                                                        !videoData.id && { color: theme.textTertiary }
                                                    ]}>
                                                        {exercise}
                                                    </Text>
                                                    {!videoData.id ? (
                                                        <View style={[styles.statusBadge, { backgroundColor: isDark ? '#2D3748' : '#EDF2F7' }]}>
                                                            <Text style={[styles.statusBadgeText, { color: theme.textTertiary }]}>Próximamente</Text>
                                                        </View>
                                                    ) : (
                                                        <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                                                    )}
                                                </Pressable>
                                            ))}
                                        </LinearGradient>
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* --- MODAL DE VIDEO PLAYER --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showVideoPlayer}
                onRequestClose={closeModal}
            >
                <BlurView intensity={30} style={StyleSheet.absoluteFill}>
                    <Pressable style={styles.modalOverlay} onPress={closeModal}>
                        <Pressable style={[styles.modalContent, { width: modalWidth, height: videoHeight, backgroundColor: '#000' }]}>
                            {selectedVideo && (
                                <YoutubeIframe
                                    height={videoHeight}
                                    width={modalWidth}
                                    play={playing}
                                    videoId={selectedVideo.id}
                                    onChangeState={onStateChange}
                                />
                            )}
                            <Pressable onPress={closeModal} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </Pressable>
                        </Pressable>
                    </Pressable>
                </BlurView>
            </Modal>

            {/* --- MODAL DE UPGRADE --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showUpgradeModal}
                onRequestClose={closeUpgradeModal}
            >
                <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.upgradeModalOverlay}>
                    <View style={[styles.upgradeModalContent, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                        <LinearGradient
                            colors={[theme.primary, theme.primary + '80']}
                            style={styles.upgradeHeaderIcon}
                        >
                            <Ionicons name="star" size={32} color="#FFF" />
                        </LinearGradient>

                        <Text style={[styles.upgradeModalTitle, { color: theme.text }]}>Contenido Premium</Text>
                        <Text style={[styles.upgradeModalText, { color: theme.textSecondary }]}>
                            Desbloquea nuestra videoteca completa y cientos de ejercicios guiados subiendo de nivel.
                        </Text>

                        <Pressable
                            style={[styles.upgradeButton, { backgroundColor: theme.primary }]}
                            onPress={goToPayment}
                        >
                            <Text style={styles.upgradeButtonText}>VER PLANES PREMIUM</Text>
                            <Ionicons name="arrow-forward" size={18} color="#FFF" />
                        </Pressable>

                        <Pressable style={styles.upgradeCancelButton} onPress={closeUpgradeModal}>
                            <Text style={[styles.upgradeCancelText, { color: theme.textTertiary }]}>Más tarde</Text>
                        </Pressable>
                    </View>
                </BlurView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleContainer: {

        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    titleDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginLeft: 4,
        marginTop: 4,
    },
    headerButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    headerButtonPressed: {
        opacity: 0.7,
    },
    searchContainer: {
        marginTop: 30,
        paddingHorizontal: 20,
        paddingBottom: 15,
        paddingTop: 5,
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
        borderRadius: 16,
        paddingHorizontal: 15,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 20,
        marginLeft: 10,
        fontWeight: '1000',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    loadingText: {
        fontSize: 16,
        marginTop: 16,
        fontWeight: '600',
    },
    errorText: {
        fontSize: 15,
        marginTop: 16,
        textAlign: 'center',
        paddingHorizontal: 40,
        lineHeight: 22,
    },
    retryButton: {
        marginTop: 24,
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 14,
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    emptyContainer: {
        paddingVertical: 100,
        alignItems: 'center',
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: 24,
    },
    muscleGroup: {
        marginBottom: 12,
        borderRadius: 20,
        overflow: 'hidden',
        // Shadow for premium feel
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    muscleButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 16,
    },
    muscleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    muscleTextContainer: {
        flex: 1,
    },
    muscleButtonText: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    muscleCount: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    chevronBox: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    exerciseList: {
        borderTopWidth: 1,
    },
    exerciseGradient: {
        paddingVertical: 5,
    },
    exerciseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
    },
    playIndicator: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    exerciseButtonText: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    upgradeModalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    upgradeModalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 30,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
    },
    upgradeHeaderIcon: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    upgradeModalTitle: {
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 10,
        textAlign: 'center',
    },
    upgradeModalText: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    upgradeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 25,
        borderRadius: 16,
        width: '100%',
        marginBottom: 12,
        gap: 10,
    },
    upgradeButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    upgradeCancelButton: {
        paddingVertical: 10,
    },
    upgradeCancelText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
