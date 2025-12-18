/* app/(app)/perfil/videos.jsx
    Videoteca de ejercicios - Ahora carga datos desde MongoDB (campo videoId)
    - Modal de video con soporte para 16:9 y 9:16 (shorts)
    - Modal de upgrade para usuarios FREE
    ──────────────────────────────────────────────────────────────────────── */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Dimensions,
    ActivityIndicator,
    LayoutAnimation,
    Platform,
    UIManager,
    Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import YoutubeIframe from 'react-native-youtube-iframe';
import { useAuth } from '../../../context/AuthContext';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- CÁLCULOS DE TAMAÑO ---
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const modalWidth = screenWidth * 0.95;

export default function VideosScreen() {
    const router = useRouter();
    const { user, token } = useAuth();
    const [openMuscle, setOpenMuscle] = useState(null);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [playing, setPlaying] = useState(false);
    const [showVideoPlayer, setShowVideoPlayer] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // Estado para datos de MongoDB
    const [exercisesByMuscle, setExercisesByMuscle] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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

                // Usar videoId del ejercicio de MongoDB
                const videoId = (ex.videoId || '').trim();
                grouped[muscle][name] = {
                    id: videoId,
                    formato: '16:9', // Por defecto 16:9, se puede añadir un campo en MongoDB para shorts
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

    const toggleMuscle = (muscle) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenMuscle(openMuscle === muscle ? null : muscle);
    };

    const handleExercisePress = (videoData) => {
        // Si el usuario es FREE, mostrar modal de upgrade
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

    const listaMusculos = Object.keys(exercisesByMuscle).sort();

    // --- CÁLCULO DE ALTURA DINÁMICO ---
    let videoHeight = (modalWidth * 9) / 16; // Default 16:9
    if (selectedVideo?.formato === '9:16') {
        videoHeight = (modalWidth * 16) / 9;
        const maxHeight = screenHeight * 0.85;
        if (videoHeight > maxHeight) {
            videoHeight = maxHeight;
        }
    }

    // Mostrar loading mientras se cargan los ejercicios
    if (isLoading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <Stack.Screen
                    options={{
                        title: 'Videoteca',
                        headerTitleStyle: { color: '#E5E7EB' },
                        headerStyle: { backgroundColor: '#0D1B2A' },
                        headerTintColor: '#E5E7EB',
                        headerLeft: () => (
                            <Pressable
                                onPress={() => router.back()}
                                style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
                            >
                                <Ionicons name="arrow-back" size={24} color="#E5E7EB" />
                            </Pressable>
                        ),
                    }}
                />
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Cargando videoteca...</Text>
            </View>
        );
    }

    // Mostrar error si hubo problema al cargar
    if (loadError) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <Stack.Screen
                    options={{
                        title: 'Videoteca',
                        headerTitleStyle: { color: '#E5E7EB' },
                        headerStyle: { backgroundColor: '#0D1B2A' },
                        headerTintColor: '#E5E7EB',
                        headerLeft: () => (
                            <Pressable
                                onPress={() => router.back()}
                                style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
                            >
                                <Ionicons name="arrow-back" size={24} color="#E5E7EB" />
                            </Pressable>
                        ),
                    }}
                />
                <Ionicons name="alert-circle" size={64} color="#EF4444" />
                <Text style={styles.errorText}>{loadError}</Text>
                <Pressable style={styles.retryButton} onPress={fetchExercisesFromCloud}>
                    <Text style={styles.retryButtonText}>Reintentar</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Videoteca',
                    headerTitleStyle: { color: '#E5E7EB' },
                    headerStyle: { backgroundColor: '#0D1B2A' },
                    headerTintColor: '#E5E7EB',
                    headerLeft: () => (
                        <Pressable
                            onPress={() => router.back()}
                            style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
                        >
                            <Ionicons name="arrow-back" size={24} color="#E5E7EB" />
                        </Pressable>
                    ),
                }}
            />

            <Text style={styles.instructionText}>
                Selecciona un grupo muscular y luego un ejercicio:
            </Text>

            {listaMusculos.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="videocam-off" size={48} color="#6B7280" />
                    <Text style={styles.emptyText}>No hay ejercicios con videos disponibles</Text>
                </View>
            ) : (
                listaMusculos.map((muscle) => {
                    const isOpen = openMuscle === muscle;
                    return (
                        <View key={muscle} style={styles.muscleGroup}>
                            <Pressable
                                style={({ pressed }) => [styles.muscleButton, pressed && styles.muscleButtonPressed]}
                                onPress={() => toggleMuscle(muscle)}
                            >
                                <Text style={styles.muscleButtonText}>{muscle}</Text>
                                <Ionicons
                                    name={isOpen ? 'chevron-down-outline' : 'chevron-forward-outline'}
                                    size={20}
                                    color="#E5E7EB"
                                />
                            </Pressable>

                            {isOpen && (
                                <View style={styles.exerciseList}>
                                    {Object.entries(exercisesByMuscle[muscle]).map(([exercise, videoData]) => (
                                        <Pressable
                                            key={exercise}
                                            style={({ pressed }) => [styles.exerciseButton, pressed && styles.exerciseButtonPressed]}
                                            onPress={() => handleExercisePress(videoData)}
                                        >
                                            <Ionicons
                                                name={videoData.id ? 'play-circle' : 'play-circle-outline'}
                                                size={18}
                                                color={videoData.id ? '#10B981' : '#6B7280'}
                                                style={{ marginRight: 8 }}
                                            />
                                            <Text style={[
                                                styles.exerciseButtonText,
                                                !videoData.id && styles.exerciseNoVideo
                                            ]}>
                                                {exercise}
                                            </Text>
                                            {!videoData.id && (
                                                <Text style={styles.noVideoTag}>Sin video</Text>
                                            )}
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })
            )}

            <View style={{ height: 64 }} />

            {/* --- MODAL DE VIDEO PLAYER --- */}
            <Modal
                animationType={Platform.OS === 'android' ? 'slide' : 'fade'}
                transparent={true}
                visible={showVideoPlayer}
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: videoHeight }]}>
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
                            <Ionicons name="close-outline" size={30} color="#FFFFFF" />
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* --- MODAL DE UPGRADE PARA USUARIOS FREE --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showUpgradeModal}
                onRequestClose={closeUpgradeModal}
            >
                <View style={styles.upgradeModalOverlay}>
                    <View style={styles.upgradeModalContent}>
                        <Pressable onPress={closeUpgradeModal} style={styles.upgradeModalClose}>
                            <Ionicons name="close-circle" size={32} color="#9CA3AF" />
                        </Pressable>

                        <Ionicons name="lock-closed" size={64} color="#10B981" style={{ marginBottom: 20 }} />

                        <Text style={styles.upgradeModalTitle}>Sube de Nivel</Text>
                        <Text style={styles.upgradeModalText}>
                            Para acceder a nuestros videos exclusivos, necesitas mejorar tu plan.
                        </Text>

                        <Pressable style={styles.upgradeButton} onPress={goToPayment}>
                            <Ionicons name="add-circle" size={24} color="#FFF" />
                            <Text style={styles.upgradeButtonText}>Ver Planes</Text>
                        </Pressable>

                        <Pressable style={styles.upgradeCancelButton} onPress={closeUpgradeModal}>
                            <Text style={styles.upgradeCancelText}>Tal vez más tarde</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0D1B2A',
        paddingHorizontal: 16,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerButton: {
        padding: 10,
    },
    headerButtonPressed: {
        opacity: 0.6,
    },
    loadingText: {
        color: '#9CA3AF',
        fontSize: 16,
        marginTop: 16,
    },
    errorText: {
        color: '#EF4444',
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 20,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#10B981',
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
    },
    instructionText: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        marginVertical: 20,
    },
    muscleGroup: {
        marginBottom: 8,
        backgroundColor: '#111827',
        borderRadius: 12,
        overflow: 'hidden',
    },
    muscleButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 16,
        backgroundColor: '#1F2937',
    },
    muscleButtonPressed: {
        backgroundColor: '#374151',
    },
    muscleButtonText: {
        color: '#E5E7EB',
        fontSize: 16,
        fontWeight: '600',
    },
    exerciseList: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderTopColor: '#374151',
    },
    exerciseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginBottom: 4,
    },
    exerciseButtonPressed: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    exerciseButtonText: {
        color: '#D1D5DB',
        fontSize: 14,
        flex: 1,
    },
    exerciseNoVideo: {
        color: '#6B7280',
    },
    noVideoTag: {
        color: '#6B7280',
        fontSize: 10,
        backgroundColor: '#1F2937',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: modalWidth,
        backgroundColor: '#000',
        borderRadius: 15,
        overflow: 'hidden',
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        top: -10,
        right: -10,
        zIndex: 10,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 20,
    },
    // Estilos para el modal de upgrade
    upgradeModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    upgradeModalContent: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#374151',
    },
    upgradeModalClose: {
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 10,
    },
    upgradeModalTitle: {
        color: '#E5E7EB',
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 10,
        textAlign: 'center',
    },
    upgradeModalText: {
        color: '#9CA3AF',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 24,
    },
    upgradeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10B981',
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 12,
        marginBottom: 15,
        gap: 10,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    upgradeButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
    upgradeCancelButton: {
        paddingVertical: 10,
    },
    upgradeCancelText: {
        color: '#6B7280',
        fontSize: 14,
    },
});
