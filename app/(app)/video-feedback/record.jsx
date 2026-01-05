// app/(app)/video-feedback/record.jsx
// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA DE GRABACIÓN DE VIDEO CON TIMER 60s
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    StatusBar,
    Alert,
    ActivityIndicator,
    Pressable
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Solo importar VisionCamera en native (no web)
let Camera, useCameraDevice, useCameraFormat, useCameraPermission, useMicrophonePermission;
if (Platform.OS !== 'web') {
    const VisionCamera = require('react-native-vision-camera');
    Camera = VisionCamera.Camera;
    useCameraDevice = VisionCamera.useCameraDevice;
    useCameraFormat = VisionCamera.useCameraFormat;
    useCameraPermission = VisionCamera.useCameraPermission;
    useMicrophonePermission = VisionCamera.useMicrophonePermission;
}

// Mock hooks para web
const useWebDevice = () => null;
const useWebFormat = () => null;
const useWebCameraPermission = () => ({ hasPermission: false, requestPermission: () => Promise.resolve(false) });
const useWebMicPermission = () => ({ hasPermission: false, requestPermission: () => Promise.resolve(false) });

const MAX_DURATION = 120; // 120 segundos máximo (2 minutos)

export default function VideoRecordScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const cameraRef = useRef(null);

    const { exerciseId, exerciseName, serieKey } = params;

    // Estados
    const [isRecording, setIsRecording] = useState(false);
    const [recordedTime, setRecordedTime] = useState(0);
    const [cameraPosition, setCameraPosition] = useState('back');
    const [flash, setFlash] = useState('off');
    const [videoPath, setVideoPath] = useState(null);

    // Permisos de cámara y micrófono (solo native)
    const cameraPermission = Platform.OS !== 'web' ? useCameraPermission() : useWebCameraPermission();
    const micPermission = Platform.OS !== 'web' ? useMicrophonePermission() : useWebMicPermission();

    // Solicitar permisos al montar
    useEffect(() => {
        const requestPermissions = async () => {
            if (Platform.OS === 'web') return;

            if (!cameraPermission.hasPermission) {
                console.log('[VideoRecord] Solicitando permiso de cámara...');
                await cameraPermission.requestPermission();
            }
            if (!micPermission.hasPermission) {
                console.log('[VideoRecord] Solicitando permiso de micrófono...');
                await micPermission.requestPermission();
            }
        };
        requestPermissions();
    }, []);

    // Dispositivo de cámara (usar mocks en web)
    const device = Platform.OS !== 'web' ? useCameraDevice(cameraPosition) : useWebDevice();
    const format = Platform.OS !== 'web' ? useCameraFormat(device, [
        { videoResolution: { width: 1280, height: 720 } },
        { fps: 30 }
    ]) : useWebFormat();

    // ═══════════════════════════════════════════════════════════════════════════
    // TIMER DE GRABACIÓN
    // ═══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordedTime(prev => {
                    if (prev >= MAX_DURATION - 1) {
                        handleStopRecording();
                        return MAX_DURATION;
                    }
                    return prev + 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    // ═══════════════════════════════════════════════════════════════════════════
    // FORMATO DE TIEMPO
    // ═══════════════════════════════════════════════════════════════════════════
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // INICIAR GRABACIÓN
    // ═══════════════════════════════════════════════════════════════════════════
    const handleStartRecording = useCallback(async () => {
        if (!cameraRef.current) return;

        try {
            setIsRecording(true);
            setRecordedTime(0);

            cameraRef.current.startRecording({
                flash: flash,
                fileType: 'mp4',
                videoBitRate: 'low', // Ayuda a reducir tamaño
                onRecordingFinished: (video) => {
                    console.log('[VideoRecord] Grabación finalizada:', video.path);
                    setVideoPath(video.path);
                    setIsRecording(false);

                    // Navegar a la pantalla de trimmer/preview
                    router.replace({
                        pathname: '/video-feedback/preview',
                        params: {
                            videoPath: video.path,
                            duration: recordedTime,
                            exerciseId,
                            exerciseName,
                            serieKey
                        }
                    });
                },
                onRecordingError: (error) => {
                    console.error('[VideoRecord] Error de grabación:', error);
                    setIsRecording(false);
                    Alert.alert('Error', 'Error al grabar el video. Intenta de nuevo.');
                }
            });
        } catch (error) {
            console.error('[VideoRecord] Error iniciando grabación:', error);
            setIsRecording(false);
        }
    }, [flash, exerciseId, exerciseName, serieKey, recordedTime, router]);

    // ═══════════════════════════════════════════════════════════════════════════
    // PARAR GRABACIÓN
    // ═══════════════════════════════════════════════════════════════════════════
    const handleStopRecording = useCallback(async () => {
        if (!cameraRef.current || !isRecording) return;

        try {
            await cameraRef.current.stopRecording();
        } catch (error) {
            console.error('[VideoRecord] Error parando grabación:', error);
        }
    }, [isRecording]);

    // ═══════════════════════════════════════════════════════════════════════════
    // CAMBIAR CÁMARA
    // ═══════════════════════════════════════════════════════════════════════════
    const handleFlipCamera = useCallback(() => {
        setCameraPosition(prev => prev === 'back' ? 'front' : 'back');
    }, []);

    // ═══════════════════════════════════════════════════════════════════════════
    // TOGGLE FLASH
    // ═══════════════════════════════════════════════════════════════════════════
    const handleToggleFlash = useCallback(() => {
        setFlash(prev => prev === 'off' ? 'on' : 'off');
    }, []);

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    // Web fallback - camera not available on web
    if (Platform.OS === 'web') {
        return (
            <View style={styles.webFallbackContainer}>
                <View style={styles.webFallbackContent}>
                    <Ionicons name="phone-portrait-outline" size={64} color="#4361ee" />
                    <Text style={styles.webFallbackTitle}>Cámara no disponible</Text>
                    <Text style={styles.webFallbackText}>
                        La grabación de video solo está disponible en Android e iOS
                    </Text>
                    <Pressable style={styles.webFallbackBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={20} color="#fff" />
                        <Text style={styles.webFallbackBtnText}>Volver</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    // Verificar permisos antes de mostrar cámara
    if (Platform.OS !== 'web' && (!cameraPermission.hasPermission || !micPermission.hasPermission)) {
        return (
            <View style={styles.loadingContainer}>
                <Ionicons name="camera-outline" size={64} color="#4361ee" />
                <Text style={styles.loadingText}>
                    {!cameraPermission.hasPermission ? 'Permiso de cámara requerido' : 'Permiso de micrófono requerido'}
                </Text>
                <TouchableOpacity
                    style={styles.permissionBtn}
                    onPress={async () => {
                        if (!cameraPermission.hasPermission) await cameraPermission.requestPermission();
                        if (!micPermission.hasPermission) await micPermission.requestPermission();
                    }}
                >
                    <Text style={styles.permissionBtnText}>Conceder Permisos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backBtnAlt} onPress={() => router.back()}>
                    <Text style={styles.backBtnText}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!device) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4361ee" />
                <Text style={styles.loadingText}>Cargando cámara...</Text>
            </View>
        );
    }

    const progress = recordedTime / MAX_DURATION;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Cámara */}
            <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                format={format}
                isActive={true}
                video={true}
                audio={true}
            />

            {/* Overlay superior */}
            <View style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}>
                {/* Botón cerrar */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.closeButton}
                    disabled={isRecording}
                >
                    <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>

                {/* Ejercicio */}
                <View style={styles.exerciseContainer}>
                    <Text style={styles.exerciseName} numberOfLines={1}>
                        {exerciseName || 'Ejercicio'}
                    </Text>
                </View>

                {/* Flash */}
                <TouchableOpacity
                    onPress={handleToggleFlash}
                    style={styles.flashButton}
                    disabled={isRecording}
                >
                    <Ionicons
                        name={flash === 'on' ? 'flash' : 'flash-off'}
                        size={24}
                        color="#fff"
                    />
                </TouchableOpacity>
            </View>

            {/* Timer */}
            <View style={[styles.timerContainer, { top: insets.top + 60 }]}>
                <View style={[styles.timerBg, isRecording && styles.timerBgRecording]}>
                    <View style={styles.timerInner}>
                        {isRecording && (
                            <View style={styles.recordingDot} />
                        )}
                        <Text style={styles.timerText}>
                            {formatTime(recordedTime)} / {formatTime(MAX_DURATION)}
                        </Text>
                    </View>

                    {/* Barra de progreso */}
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${progress * 100}%` },
                                progress > 0.8 && styles.progressDanger
                            ]}
                        />
                    </View>
                </View>
            </View>

            {/* Overlay inferior */}
            <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 20 }]}>
                {/* Cambiar cámara */}
                <TouchableOpacity
                    onPress={handleFlipCamera}
                    style={styles.sideButton}
                    disabled={isRecording}
                >
                    <Ionicons name="camera-reverse" size={28} color="#fff" />
                </TouchableOpacity>

                {/* Botón de grabación */}
                <TouchableOpacity
                    onPress={isRecording ? handleStopRecording : handleStartRecording}
                    style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                    activeOpacity={0.7}
                >
                    <View style={[styles.recordInner, isRecording && styles.recordInnerActive]}>
                        {isRecording ? (
                            <View style={styles.stopIcon} />
                        ) : null}
                    </View>
                </TouchableOpacity>

                {/* Placeholder para simetría */}
                <View style={styles.sideButton}>
                    <Text style={styles.hintText}>
                        {isRecording ? 'Tap para parar' : 'Tap para grabar'}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#fff',
        marginTop: 12,
        fontSize: 16,
    },
    topOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        zIndex: 10,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    exerciseContainer: {
        flex: 1,
        marginHorizontal: 12,
        alignItems: 'center',
    },
    exerciseName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    flashButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerContainer: {
        position: 'absolute',
        top: 100,
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 10,
    },
    timerBg: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        padding: 12,
        minWidth: 180,
    },
    timerBgRecording: {
        backgroundColor: 'rgba(239,68,68,0.3)',
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    timerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
    },
    timerText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        marginTop: 8,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#4361ee',
        borderRadius: 2,
    },
    progressDanger: {
        backgroundColor: '#ef4444',
    },
    bottomOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 40,
        zIndex: 10,
    },
    sideButton: {
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    hintText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
        textAlign: 'center',
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#fff',
    },
    recordButtonActive: {
        borderColor: '#ef4444',
    },
    recordInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#ef4444',
    },
    recordInnerActive: {
        width: 32,
        height: 32,
        borderRadius: 6,
    },
    stopIcon: {
        width: 24,
        height: 24,
        backgroundColor: '#fff',
        borderRadius: 4,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -12 }, { translateY: -12 }],
    },
    // Web fallback styles
    webFallbackContainer: {
        flex: 1,
        backgroundColor: '#0a0a14',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    webFallbackContent: {
        alignItems: 'center',
        maxWidth: 400,
    },
    webFallbackTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        marginTop: 24,
        marginBottom: 12,
        textAlign: 'center',
    },
    webFallbackText: {
        color: '#888',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    webFallbackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#4361ee',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    webFallbackBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    // Permission styles
    permissionBtn: {
        backgroundColor: '#4361ee',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        marginTop: 24,
    },
    permissionBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    backBtnAlt: {
        marginTop: 16,
        paddingVertical: 10,
    },
    backBtnText: {
        color: '#888',
        fontSize: 14,
    },
});
