// app/(app)/video-feedback/preview.jsx
// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA DE PREVIEW Y GUARDADO DE VIDEO (Simplificado)
// Se eliminó el MultiSlider de recorte porque:
//  1. El trim nunca se aplicaba realmente al video
//  2. Instagram y TikTok ya tienen herramientas de recorte nativas
//  3. Simplifica la UX reduciendo fricción
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
} from 'react-native';
import Video from 'react-native-video';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import ViewShot from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function VideoPreviewScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const { user, token } = useAuth();
    const videoRef = useRef(null);
    const viewShotRef = useRef(null);

    const { videoPath, duration, exerciseId, exerciseName, serieKey } = params;

    // Estado
    const [paused, setPaused] = useState(false);
    const [thumbnailUri, setThumbnailUri] = useState(null);
    const [videoDuration, setVideoDuration] = useState(0);

    // ═══════════════════════════════════════════════════════════════════════════
    // CAPTURAR THUMBNAIL (frame 1)
    // ═══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        const captureTimeout = setTimeout(async () => {
            if (viewShotRef.current) {
                try {
                    const uri = await viewShotRef.current.capture();
                    setThumbnailUri(uri);
                    console.log('[Preview] Thumbnail capturado:', uri);
                } catch (err) {
                    console.warn('[Preview] Error capturando thumbnail:', err);
                }
            }
        }, 500);

        return () => clearTimeout(captureTimeout);
    }, []);

    // ═══════════════════════════════════════════════════════════════════════════
    // LOGICA DE VIDEO
    // ═══════════════════════════════════════════════════════════════════════════
    const handleLoad = (meta) => {
        const dur = meta.duration;
        setVideoDuration(dur);
    };

    const formatTime = (seconds) => {
        if (!seconds && seconds !== 0) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // GUARDAR
    // ═══════════════════════════════════════════════════════════════════════════
    const handleSaveVideo = async () => {
        if (!videoPath) {
            Alert.alert('Error', 'No hay video para guardar');
            return;
        }

        try {
            await AsyncStorage.setItem('pending_video_feedback', JSON.stringify({
                videoPath,
                thumbnailUri,
                duration: parseInt(duration) || videoDuration || 0,
                exerciseId,
                exerciseName,
                serieKey,
                trimStart: 0,
                trimEnd: videoDuration || 0
            }));
            router.back();
        } catch (err) {
            console.error('[Preview] Error guardando video:', err);
            Alert.alert('Error', 'Error al guardar el video');
        }
    };

    const handleDiscard = () => {
        Alert.alert(
            'Descartar video',
            '¿Seguro que quieres descartar este video?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Descartar', style: 'destructive', onPress: () => router.back() }
            ]
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER PRINCIPAL
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top, paddingBottom: insets.bottom + 100 }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleDiscard} style={styles.headerBtn}>
                        <Ionicons name="trash-outline" size={24} color="#ef4444" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Vista previa</Text>
                    <View style={styles.headerBtn} />
                </View>

                {/* Video Preview */}
                <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.8 }}>
                    <View style={styles.videoContainer}>
                        <Video
                            ref={videoRef}
                            source={{ uri: videoPath }}
                            style={styles.video}
                            resizeMode="contain"
                            repeat={true}
                            paused={paused}
                            onLoad={handleLoad}
                            onError={(e) => console.error('[Preview] Error video:', e)}
                        />
                        <TouchableOpacity
                            style={styles.playOverlay}
                            onPress={() => setPaused(!paused)}
                            activeOpacity={0.8}
                        >
                            {paused && (
                                <View style={styles.playButton}>
                                    <Ionicons name="play" size={40} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </ViewShot>

                {/* Ejercicio info */}
                <View style={styles.exerciseCard}>
                    <View style={styles.exerciseRow}>
                        <Ionicons name="barbell" size={20} color="#4361ee" />
                        <Text style={styles.exerciseName}>{exerciseName || 'Ejercicio'}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={16} color="#888" />
                        <Text style={styles.infoText}>
                            Duración: {formatTime(videoDuration || parseInt(duration) || 0)}
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Ionicons name="information-circle-outline" size={16} color="#888" />
                        <Text style={styles.infoText}>
                            Podrás recortar el video al compartirlo en Instagram o TikTok
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Botones - Fixed at bottom */}
            <View style={[styles.bottomButtons, { paddingBottom: insets.bottom + 16 }]}>
                <TouchableOpacity
                    style={styles.discardBtn}
                    onPress={handleDiscard}
                >
                    <Text style={styles.discardText}>Descartar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.uploadBtn}
                    onPress={handleSaveVideo}
                >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.uploadText}>Guardar Video</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a14',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
        flexGrow: 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    headerBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    videoContainer: {
        backgroundColor: '#000',
        borderRadius: 16,
        overflow: 'hidden',
        height: 380,
        alignSelf: 'center',
        width: '75%',
    },
    video: {
        flex: 1,
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 6,
    },
    exerciseCard: {
        marginTop: 20,
        backgroundColor: '#1a1a2e',
        borderRadius: 16,
        padding: 16,
        gap: 12,
    },
    exerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    exerciseName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 4,
    },
    infoText: {
        color: '#666',
        fontSize: 12,
        flex: 1,
    },
    bottomButtons: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 16,
        backgroundColor: '#0a0a14',
        borderTopWidth: 1,
        borderTopColor: '#1a1a2e',
    },
    discardBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#1a1a2e',
        alignItems: 'center',
    },
    discardText: {
        color: '#888',
        fontSize: 16,
        fontWeight: '600',
    },
    uploadBtn: {
        flex: 2,
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#4361ee',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
