// app/(app)/video-feedback/preview.jsx
// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA DE PREVIEW Y SUBIDA DE VIDEO
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator,
    useWindowDimensions
} from 'react-native';
import Video from 'react-native-video';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import ViewShot from 'react-native-view-shot';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
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

    // Trimming State
    const [videoDuration, setVideoDuration] = useState(0);
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(0);

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
        setTrimEnd(dur);
    };

    const handleProgress = (prog) => {
        const currentTime = prog.currentTime;
        if (currentTime >= trimEnd) {
            videoRef.current?.seek(trimStart);
        }
    };

    const handleValuesChange = (values) => {
        const newStart = values[0];
        const newEnd = values[1];

        if (newStart !== trimStart) {
            videoRef.current?.seek(newStart);
        } else if (newEnd !== trimEnd) {
            // Preview end frame roughly
            videoRef.current?.seek(newEnd);
        }

        setTrimStart(newStart);
        setTrimEnd(newEnd);
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
                trimStart,
                trimEnd
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
                            repeat={false}
                            paused={paused}
                            onLoad={handleLoad}
                            onProgress={handleProgress}
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

                {/* Trimming Controls */}
                <View style={styles.trimContainer}>
                    <Text style={styles.trimTitle}>Recortar Video</Text>

                    <View style={{ alignItems: 'center', marginVertical: 10 }}>
                        <MultiSlider
                            values={[trimStart, trimEnd]}
                            sliderLength={useWindowDimensions().width - 80}
                            onValuesChange={handleValuesChange}
                            min={0}
                            max={videoDuration || 10}
                            step={1}
                            allowOverlap={false}
                            minMarkerOverlapDistance={5}
                            selectedStyle={{ backgroundColor: '#10b981' }}
                            unselectedStyle={{ backgroundColor: '#333' }}
                            markerStyle={{
                                backgroundColor: '#fff',
                                height: 20,
                                width: 20,
                                borderRadius: 10,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.3,
                                shadowRadius: 2,
                            }}
                            trackStyle={{ height: 4 }}
                        />
                    </View>

                    <View style={styles.timeRow}>
                        <Text style={styles.timeLabel}>Inicio: {formatTime(trimStart)}</Text>
                        <Text style={styles.timeLabel}>Fin: {formatTime(trimEnd)}</Text>
                    </View>
                </View>

                {/* Ejercicio */}
                <View style={styles.exerciseRow}>
                    <Ionicons name="barbell" size={20} color="#4361ee" />
                    <Text style={styles.exerciseName}>{exerciseName || 'Ejercicio'}</Text>
                </View>

                {/* Info */}
                <View style={styles.infoRow}>
                    <Ionicons name="information-circle-outline" size={16} color="#888" />
                    <Text style={styles.infoText}>
                        Duración final: {formatTime(trimEnd - trimStart)}
                    </Text>
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
        height: 300,
        alignSelf: 'center',
        width: '60%',
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
    exerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        marginBottom: 6,
    },
    exerciseName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    noteContainer: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
    },
    noteLabel: {
        color: '#888',
        fontSize: 13,
        marginBottom: 8,
    },
    noteInput: {
        color: '#fff',
        fontSize: 15,
        minHeight: 80,
        textAlignVertical: 'top',
        backgroundColor: '#0d0d1a',
        borderRadius: 8,
        padding: 12,
        marginTop: 4,
    },
    charCount: {
        color: '#555',
        fontSize: 12,
        textAlign: 'right',
        marginTop: 4,
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
    progressContainer: {
        marginTop: 16,
        paddingHorizontal: 4,
    },
    progressBar: {
        height: 6,
        backgroundColor: '#333',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#4361ee',
        borderRadius: 3,
    },
    progressText: {
        color: '#888',
        fontSize: 12,
        marginTop: 6,
        textAlign: 'center',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ef444420',
        padding: 12,
        borderRadius: 8,
        marginTop: 16,
        gap: 8,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 13,
        flex: 1,
    },
    // Trimming Styles
    trimContainer: {
        marginTop: 20,
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 16,
    },
    trimTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    sliderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
    },
    timeLabel: {
        color: '#ccc',
        fontSize: 12,
        width: 60,
        fontVariant: ['tabular-nums'],
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
    uploadBtnDisabled: {
        opacity: 0.6,
    },
    uploadText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
