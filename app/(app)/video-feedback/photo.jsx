// app/(app)/video-feedback/photo.jsx
// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA DE CAPTURA DE FOTO
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    StatusBar,
    Alert,
    ActivityIndicator,
    Image,
    TextInput,
    KeyboardAvoidingView,
    ScrollView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { useVideoFeedback } from '../../../src/hooks/useVideoFeedback';

// Solo importar VisionCamera en native (no web)
let Camera, useCameraDevice, useCameraPermission;
if (Platform.OS !== 'web') {
    const VisionCamera = require('react-native-vision-camera');
    Camera = VisionCamera.Camera;
    useCameraDevice = VisionCamera.useCameraDevice;
    useCameraPermission = VisionCamera.useCameraPermission;
}

// Mock para web
const useWebCameraPermission = () => ({ hasPermission: false, requestPermission: () => Promise.resolve(false) });

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function PhotoCaptureScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const cameraRef = useRef(null);
    const { token } = useAuth();

    const { exerciseId, exerciseName, serieKey } = params;

    // Estados
    const [cameraPosition, setCameraPosition] = useState('back');
    const [flash, setFlash] = useState('off');
    const [photoUri, setPhotoUri] = useState(null);
    const [note, setNote] = useState('');
    const [isTakingPhoto, setIsTakingPhoto] = useState(false);

    // Permiso de cámara
    const cameraPermission = Platform.OS !== 'web' ? useCameraPermission() : useWebCameraPermission();

    // Solicitar permisos al montar
    useEffect(() => {
        if (Platform.OS !== 'web' && !cameraPermission.hasPermission) {
            console.log('[Photo] Solicitando permiso de cámara...');
            cameraPermission.requestPermission();
        }
    }, []);

    // Hook de subida
    const { uploadPhotoFeedback, uploading, progress } = useVideoFeedback(API_URL, token);

    // Dispositivo de cámara
    const device = Platform.OS !== 'web' ? useCameraDevice(cameraPosition) : null;

    // ═══════════════════════════════════════════════════════════════════════════
    // TOMAR FOTO
    // ═══════════════════════════════════════════════════════════════════════════
    const handleTakePhoto = useCallback(async () => {
        if (!cameraRef.current || isTakingPhoto) return;

        try {
            setIsTakingPhoto(true);
            const photo = await cameraRef.current.takePhoto({
                flash: flash,
                qualityPrioritization: 'balanced'
            });
            console.log('[Photo] Foto capturada:', photo.path);
            setPhotoUri(`file://${photo.path}`);
        } catch (error) {
            console.error('[Photo] Error capturando foto:', error);
            Alert.alert('Error', 'No se pudo capturar la foto. Intenta de nuevo.');
        } finally {
            setIsTakingPhoto(false);
        }
    }, [flash, isTakingPhoto]);

    // ═══════════════════════════════════════════════════════════════════════════
    // RETOMAR FOTO
    // ═══════════════════════════════════════════════════════════════════════════
    const handleRetake = () => {
        setPhotoUri(null);
        setNote('');
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // GUARDAR FOTO (no subir - eso se hace al enviar feedback completo)
    // ═══════════════════════════════════════════════════════════════════════════
    const handleSavePhoto = async () => {
        if (!photoUri) return;

        try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            await AsyncStorage.setItem('pending_photo_feedback', JSON.stringify({
                photoUri,
                exerciseId,
                exerciseName,
                serieKey
            }));

            // Volver al entreno
            router.back();
        } catch (err) {
            console.error('[Photo] Error guardando foto:', err);
            Alert.alert('Error', 'Error al guardar la foto');
        }
    };

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

    // Web fallback
    if (Platform.OS === 'web') {
        return (
            <View style={styles.webFallbackContainer}>
                <View style={styles.webFallbackContent}>
                    <Ionicons name="phone-portrait-outline" size={64} color="#10b981" />
                    <Text style={styles.webFallbackTitle}>Cámara no disponible</Text>
                    <Text style={styles.webFallbackText}>
                        La captura de foto solo está disponible en Android e iOS
                    </Text>
                    <TouchableOpacity style={styles.webFallbackBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={20} color="#fff" />
                        <Text style={styles.webFallbackBtnText}>Volver</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Verificar permisos antes de mostrar cámara
    if (Platform.OS !== 'web' && !cameraPermission.hasPermission) {
        return (
            <View style={styles.loadingContainer}>
                <Ionicons name="camera-outline" size={64} color="#10b981" />
                <Text style={styles.loadingText}>Permiso de cámara requerido</Text>
                <TouchableOpacity
                    style={styles.permissionBtn}
                    onPress={() => cameraPermission.requestPermission()}
                >
                    <Text style={styles.permissionBtnText}>Conceder Permiso</Text>
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
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>Iniciando cámara...</Text>
            </View>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PREVIEW DE FOTO CAPTURADA
    // ═══════════════════════════════════════════════════════════════════════════
    if (photoUri) {
        return (
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <StatusBar barStyle="light-content" />

                {/* Foto Preview */}
                <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />

                {/* Overlay con controles */}
                <View style={[styles.previewOverlay, { paddingTop: insets.top + 10 }]}>
                    {/* Header */}
                    <View style={styles.previewHeader}>
                        <TouchableOpacity style={styles.backBtn} onPress={handleRetake}>
                            <Ionicons name="refresh" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.previewTitle}>📸 Vista previa</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Ejercicio */}
                    <View style={styles.exerciseTag}>
                        <Text style={styles.exerciseText} numberOfLines={1}>{exerciseName}</Text>
                    </View>
                </View>

                {/* Controles inferiores */}
                <View style={[styles.previewControls, { paddingBottom: insets.bottom + 20 }]}>
                    {/* Info */}
                    <Text style={styles.previewInfo}>
                        El comentario se añade en el formulario de feedback
                    </Text>

                    {/* Botones */}
                    <View style={styles.previewBtns}>
                        <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake}>
                            <Ionicons name="close" size={24} color="#fff" />
                            <Text style={styles.retakeBtnText}>Repetir</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.uploadBtn}
                            onPress={handleSavePhoto}
                        >
                            <Ionicons name="checkmark-circle" size={24} color="#fff" />
                            <Text style={styles.uploadBtnText}>Guardar Foto</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VISTA DE CÁMARA
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Cámara */}
            <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                photo={true}
            />

            {/* Overlay con controles */}
            <View style={[styles.overlay, { paddingTop: insets.top + 10 }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>📸 Foto</Text>
                    </View>

                    <View style={styles.headerRight}>
                        <TouchableOpacity style={styles.controlBtn} onPress={handleToggleFlash}>
                            <Ionicons
                                name={flash === 'on' ? 'flash' : 'flash-off'}
                                size={24}
                                color="#fff"
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Nombre del ejercicio */}
                <View style={styles.exerciseTag}>
                    <Text style={styles.exerciseText} numberOfLines={1}>{exerciseName}</Text>
                </View>
            </View>

            {/* Controles inferiores */}
            <View style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
                {/* Flip camera */}
                <TouchableOpacity style={styles.sideBtn} onPress={handleFlipCamera}>
                    <Ionicons name="camera-reverse" size={28} color="#fff" />
                </TouchableOpacity>

                {/* Botón captura */}
                <TouchableOpacity
                    style={styles.captureBtn}
                    onPress={handleTakePhoto}
                    disabled={isTakingPhoto}
                >
                    {isTakingPhoto ? (
                        <ActivityIndicator size="large" color="#10b981" />
                    ) : (
                        <View style={styles.captureBtnInner} />
                    )}
                </TouchableOpacity>

                {/* Placeholder derecho */}
                <View style={styles.sideBtn} />
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
        marginTop: 16,
        fontSize: 16,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    headerRight: {
        flexDirection: 'row',
        gap: 8,
    },
    controlBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    exerciseTag: {
        alignSelf: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        maxWidth: '80%',
    },
    exerciseText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    controls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 30,
        paddingTop: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    sideBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#10b981',
    },
    captureBtnInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#10b981',
    },
    // Preview styles
    photoPreview: {
        flex: 1,
    },
    previewOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    previewTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    previewControls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 20,
    },
    noteInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 12,
        color: '#fff',
        fontSize: 15,
        marginBottom: 16,
        maxHeight: 80,
    },
    previewBtns: {
        flexDirection: 'row',
        gap: 12,
    },
    previewInfo: {
        color: '#94a3b8',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 12,
    },
    retakeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#64748b',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    retakeBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    uploadBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10b981',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    uploadBtnDisabled: {
        opacity: 0.7,
    },
    uploadBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    // Web fallback
    webFallbackContainer: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    webFallbackContent: {
        alignItems: 'center',
        gap: 16,
    },
    webFallbackTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
    },
    webFallbackText: {
        fontSize: 15,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 22,
    },
    webFallbackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10b981',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
        marginTop: 16,
    },
    webFallbackBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    // Permission styles
    permissionBtn: {
        backgroundColor: '#10b981',
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
