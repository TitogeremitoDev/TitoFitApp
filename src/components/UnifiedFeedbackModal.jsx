// src/components/UnifiedFeedbackModal.jsx
// ═══════════════════════════════════════════════════════════════════════════
// MODAL UNIFICADO DE FEEDBACK
// Combina: Importancia + Video/Foto + Nota de texto/voz + Celebración
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    Pressable,
    StyleSheet,
    Image,
    ActivityIndicator,
    Platform,
    Animated,
    Share,
    Alert, // Added Alert import
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioRecorder, useAudioPlayer, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════
const NOTE_VALUES = [
    { key: 'high', label: 'Alta', color: '#ef4444', emoji: '🔴' },
    { key: 'normal', label: 'Media', color: '#f97316', emoji: '🟠' },
    { key: 'low', label: 'Ok', color: '#22c55e', emoji: '🟢' },
    { key: 'custom', label: 'Nota', color: '#3b82f6', emoji: '🔵' },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function UnifiedFeedbackModal({
    visible,
    onClose,
    serieKey,
    exerciseId,
    exerciseName,
    initialValue = 'low', // Default: Ok (🟢)
    initialNote = '',
    initialAudioUri = null,
    initialMediaUri = null,
    initialMediaType = null,
    initialTrimStart = 0,
    initialTrimEnd = 0,
    onSave,
    theme,
}) {
    const router = useRouter();

    // States
    const [importance, setImportance] = useState(initialValue);
    const [noteText, setNoteText] = useState(initialNote);
    const [audioUri, setAudioUri] = useState(initialAudioUri);
    const [mediaUri, setMediaUri] = useState(initialMediaUri);
    const [mediaType, setMediaType] = useState(initialMediaType);
    const [trimStart, setTrimStart] = useState(initialTrimStart);
    const [trimEnd, setTrimEnd] = useState(initialTrimEnd);

    // Celebration state
    const [isSuccess, setIsSuccess] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Audio recording logic with expo-audio hooks
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const audioPlayer = useAudioPlayer(audioUri);
    const [isPlaying, setIsPlaying] = useState(false);
    const timerRef = useRef(null);

    // Animación para el estado de éxito
    const successAnim = useRef(new Animated.Value(0)).current;

    // Reset when modal opens with new data
    useEffect(() => {
        if (visible) {
            setImportance(initialValue);
            setNoteText(initialNote);
            setAudioUri(initialAudioUri);
            setMediaUri(initialMediaUri);
            setMediaType(initialMediaType);
            setTrimStart(initialTrimStart);
            setTrimEnd(initialTrimEnd);
            setIsRecording(false);
            setRecordingTime(0); // Reset recording time
            setIsSuccess(false);
            setIsSaving(false);
            successAnim.setValue(0);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            // expo-audio cleanup handled by hooks
        };
    }, [visible, initialValue, initialNote, initialAudioUri, initialMediaUri, initialMediaType, initialTrimStart, initialTrimEnd]);

    // Cleanup audio on unmount - handled by expo-audio hooks automatically

    // ═══════════════════════════════════════════════════════════════════════════
    // AUDIO RECORDING (expo-audio hooks)
    // ═══════════════════════════════════════════════════════════════════════════
    const startRecording = async () => {
        try {
            const status = await AudioModule.requestRecordingPermissionsAsync();
            if (!status.granted) {
                Alert.alert('Permiso denegado', 'Necesitamos acceso al micrófono');
                return;
            }

            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });

            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(t => t + 1);
            }, 1000);
        } catch (err) {
            console.error('[UnifiedModal] Error starting recording:', err);
        }
    };

    const stopRecording = async () => {
        if (!audioRecorder.isRecording) return;
        try {
            clearInterval(timerRef.current);
            setIsRecording(false);
            await audioRecorder.stop();
            const uri = audioRecorder.uri;
            setAudioUri(uri);
        } catch (err) {
            console.error('[UnifiedModal] Error stopping recording:', err);
        }
    };

    const playAudio = async () => {
        if (!audioUri || !audioPlayer) return;
        try {
            setIsPlaying(true);
            audioPlayer.seekTo(0);
            audioPlayer.play();
        } catch (err) {
            console.error('[UnifiedModal] Error playing audio:', err);
        }
    };

    // Track when audio finishes playing
    useEffect(() => {
        if (audioPlayer && !audioPlayer.playing && isPlaying) {
            setIsPlaying(false);
        }
    }, [audioPlayer?.playing, isPlaying]);

    const deleteAudio = async () => {
        setAudioUri(null);
        setIsPlaying(false);
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // NAVIGATION TO CAMERA
    // ═══════════════════════════════════════════════════════════════════════════
    const handleRecordVideo = () => {
        // Cerrar modal y navegar a cámara
        onClose();
        router.push({
            pathname: '/video-feedback/record',
            params: {
                exerciseId,
                exerciseName,
                serieKey,
                returnToFeedback: 'true' // Flag para saber que debe volver al modal
            }
        });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // SELECCIONAR ARCHIVO (VIDEO/FOTO/AUDIO)
    // ═══════════════════════════════════════════════════════════════════════════
    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['video/*', 'image/*', 'audio/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets ? result.assets[0] : result;
            const { uri, mimeType, name } = file;

            console.log('[UnifiedFeedbackModal] File picked:', { uri, mimeType, name });

            // Determinar tipo de media con fallback a extensión
            let detectedType = null;

            // Primero intentar con mimeType
            if (mimeType?.startsWith('video/')) {
                detectedType = 'video';
            } else if (mimeType?.startsWith('image/')) {
                detectedType = 'photo';
            } else if (mimeType?.startsWith('audio/')) {
                detectedType = 'audio';
            }

            // Fallback: detectar por extensión si mimeType es null/undefined
            if (!detectedType && name) {
                const ext = name.toLowerCase().split('.').pop();
                console.log('[UnifiedFeedbackModal] Fallback extension detection:', ext);

                const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'];
                const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'];
                const audioExtensions = ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac'];

                if (videoExtensions.includes(ext)) {
                    detectedType = 'video';
                } else if (imageExtensions.includes(ext)) {
                    detectedType = 'photo';
                } else if (audioExtensions.includes(ext)) {
                    detectedType = 'audio';
                }
            }

            // Último fallback: detectar por URI
            if (!detectedType && uri) {
                const uriLower = uri.toLowerCase();
                if (uriLower.match(/\.(jpg|jpeg|png|gif|webp|heic)$/)) {
                    detectedType = 'photo';
                } else if (uriLower.match(/\.(mp4|mov|avi|mkv|webm)$/)) {
                    detectedType = 'video';
                } else if (uriLower.match(/\.(mp3|m4a|wav|aac)$/)) {
                    detectedType = 'audio';
                }
            }

            console.log('[UnifiedFeedbackModal] Detected type:', detectedType);

            if (detectedType === 'video') {
                setMediaUri(uri);
                setMediaType('video');
                setTrimStart(0);
                setTrimEnd(0);
            } else if (detectedType === 'photo') {
                setMediaUri(uri);
                setMediaType('photo');
            } else if (detectedType === 'audio') {
                setAudioUri(uri);
            } else {
                Alert.alert('Formato no soportado', `No se pudo detectar el tipo de archivo. MimeType: ${mimeType || 'desconocido'}`);
            }
        } catch (err) {
            console.error('[UnifiedFeedbackModal] Error picking file:', err);
            Alert.alert('Error', 'No se pudo seleccionar el archivo');
        }
    };

    const handleTakePhoto = () => {
        onClose();
        router.push({
            pathname: '/video-feedback/photo',
            params: {
                exerciseId,
                exerciseName,
                serieKey,
                returnToFeedback: 'true'
            }
        });
    };

    const deleteMedia = () => {
        setMediaUri(null);
        setMediaType(null);
        setTrimStart(0);
        setTrimEnd(0);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ENVIAR FEEDBACK (Fire & Forget)
    // ═══════════════════════════════════════════════════════════════════════════
    const handleSend = async () => {
        // 1. Guardar nota inmediatamente
        onSave(serieKey, importance, noteText, audioUri, mediaUri, mediaType, trimStart, trimEnd);

        // 2. Si hay media, mostrar estado de éxito con opción de compartir
        if (mediaUri) {
            setIsSuccess(true);
            Animated.spring(successAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }).start();
            // SIN auto-cierre - el usuario cierra cuando quiera
        } else {
            // Sin media, cerrar directamente
            onClose();
        }
    };

    const handleClose = () => {
        setIsSuccess(false);
        onClose();
    };

    const handleDelete = () => {
        onSave(serieKey, null, null, null, null, null);
        onClose();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPARTIR EN INSTAGRAM
    // ═══════════════════════════════════════════════════════════════════════════
    const shareToInstagram = async () => {
        try {
            // Por ahora, usar Share nativo. Para Stories reales necesitaríamos react-native-share
            await Share.share({
                message: `💪 Set completado: ${exerciseName}\n#TotalGains #Workout`,
                url: mediaUri,
            });
        } catch (err) {
            console.error('[UnifiedModal] Error sharing:', err);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════════
    const isDarkMode = theme?.background === '#0d0d0d';
    const hasExistingData = initialValue || initialNote || initialAudioUri || initialMediaUri;

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: ESTADO DE ÉXITO (Celebración)
    // ═══════════════════════════════════════════════════════════════════════════
    const renderSuccessState = () => {
        const scale = successAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.5, 1],
        });

        return (
            <Animated.View style={[styles.successContainer, { transform: [{ scale }] }]}>
                {/* Check animado */}
                <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={48} color="#fff" />
                </View>

                <Text style={[styles.successTitle, { color: theme?.text || '#fff' }]}>
                    ¡Recibido! 🔥
                </Text>
                <Text style={[styles.successSubtitle, { color: theme?.textSecondary || '#94a3b8' }]}>
                    Tu coach lo verá pronto
                </Text>

                {/* Botón de Instagram (solo si hay media) */}
                {mediaUri && (
                    <TouchableOpacity
                        style={styles.instagramBtn}
                        onPress={shareToInstagram}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['#833ab4', '#fd1d1d', '#fcb045']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.instagramGradient}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="logo-instagram" size={20} color="#fff" />
                                <Ionicons name="logo-tiktok" size={18} color="#fff" />
                            </View>
                            <Text style={styles.instagramText}>Presume en tus redes</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Botón cerrar */}
                <TouchableOpacity onPress={handleClose} style={styles.closeSuccessBtn}>
                    <Text style={[styles.closeSuccessText, { color: theme?.textSecondary || '#94a3b8' }]}>
                        Seguir entrenando →
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: FORMULARIO
    // ═══════════════════════════════════════════════════════════════════════════
    const renderFormState = () => (
        <>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme?.text || '#fff' }]}>
                    Feedback al Coach
                </Text>
                <Pressable onPress={onClose} hitSlop={12}>
                    <Ionicons name="close" size={22} color={theme?.textSecondary || '#94a3b8'} />
                </Pressable>
            </View>

            {/* Ejercicio */}
            {exerciseName && (
                <Text style={[styles.exerciseName, { color: theme?.primary || '#10b981' }]}>
                    {exerciseName}
                </Text>
            )}

            {/* ─────────── IMPORTANCIA ─────────── */}
            <Text style={[styles.sectionLabel, { color: theme?.textSecondary || '#94a3b8' }]}>
                ¿Cómo ha ido?
            </Text>
            <View style={styles.valueRow}>
                {NOTE_VALUES.map((item) => (
                    <TouchableOpacity
                        key={item.key}
                        onPress={() => setImportance(item.key)}
                        activeOpacity={0.7}
                        style={[
                            styles.valueBtn,
                            {
                                borderColor: importance === item.key ? item.color : theme?.border || '#333',
                                backgroundColor: importance === item.key ? item.color + '15' : 'transparent',
                            }
                        ]}
                    >
                        <Text style={styles.emoji}>{item.emoji}</Text>
                        <Text style={[
                            styles.valueTxt,
                            { color: importance === item.key ? item.color : theme?.textSecondary || '#94a3b8' }
                        ]}>
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ─────────── MEDIA (Video/Foto) ─────────── */}
            <Text style={[styles.sectionLabel, { color: theme?.textSecondary || '#94a3b8' }]}>
                📹 Adjuntar (opcional)
            </Text>

            {/* Preview de media capturada */}
            {mediaUri && (
                <View style={styles.mediaPreview}>
                    {mediaType === 'photo' ? (
                        <Image source={{ uri: mediaUri }} style={styles.mediaThumbnail} resizeMode="cover" />
                    ) : (
                        <View style={[styles.mediaThumbnail, styles.videoPlaceholder]}>
                            <Ionicons name="videocam" size={32} color="#10b981" />
                            <Text style={styles.videoLabel}>Video listo</Text>
                        </View>
                    )}
                    <TouchableOpacity
                        style={styles.deleteMediaBtn}
                        onPress={deleteMedia}
                        activeOpacity={0.8}
                    >
                        <View style={styles.deleteMediaCircle}>
                            <Ionicons name="close" size={16} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {!mediaUri ? (
                <View style={styles.mediaRow}>
                    <TouchableOpacity
                        style={[styles.mediaBtn, { backgroundColor: theme?.primary + '20' || '#10b98120' }]}
                        onPress={handleRecordVideo}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="videocam" size={24} color={theme?.primary || '#10b981'} />
                        <Text style={[styles.mediaBtnText, { color: theme?.primary || '#10b981' }]}>
                            Video
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.mediaBtn, { backgroundColor: '#22c55e20' }]}
                        onPress={handleTakePhoto}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="camera" size={24} color="#22c55e" />
                        <Text style={[styles.mediaBtnText, { color: '#22c55e' }]}>
                            Foto
                        </Text>
                    </TouchableOpacity>

                    {/* Botón Subir Archivo (Carpeta) */}
                    <TouchableOpacity
                        style={[styles.folderBtn, { borderColor: theme?.border || '#333' }]}
                        onPress={handlePickFile}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="folder-open-outline" size={22} color={theme?.textSecondary || '#94a3b8'} />
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.mediaRow}>
                    {/* Botón para cambiar/añadir otro video */}
                    <TouchableOpacity
                        style={[
                            styles.mediaBtn,
                            { backgroundColor: mediaType === 'video' ? '#10b981' : (theme?.primary + '20' || '#10b98120') }
                        ]}
                        onPress={handleRecordVideo}
                        activeOpacity={0.7}
                    >
                        {mediaType === 'video' ? (
                            <Ionicons name="checkmark-circle" size={24} color="#fff" />
                        ) : (
                            <Ionicons name="videocam" size={24} color={theme?.primary || '#10b981'} />
                        )}
                        <Text style={[styles.mediaBtnText, { color: mediaType === 'video' ? '#fff' : (theme?.primary || '#10b981') }]}>
                            Video
                        </Text>
                    </TouchableOpacity>

                    {/* Botón Foto con check si es foto */}
                    <TouchableOpacity
                        style={[
                            styles.mediaBtn,
                            { backgroundColor: mediaType === 'photo' ? '#22c55e' : '#22c55e20' }
                        ]}
                        onPress={handleTakePhoto}
                        activeOpacity={0.7}
                    >
                        {mediaType === 'photo' ? (
                            <Ionicons name="checkmark-circle" size={24} color="#fff" />
                        ) : (
                            <Ionicons name="camera" size={24} color="#22c55e" />
                        )}
                        <Text style={[styles.mediaBtnText, { color: mediaType === 'photo' ? '#fff' : '#22c55e' }]}>
                            Foto
                        </Text>
                    </TouchableOpacity>

                    {/* Botón eliminar media */}
                    <TouchableOpacity
                        style={styles.deleteMediaSmallBtn}
                        onPress={deleteMedia}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            )}

            {/* ─────────── NOTA DE TEXTO + VOZ ─────────── */}
            <View style={styles.inputRow}>
                <TextInput
                    style={[styles.input, {
                        backgroundColor: theme?.inputBackground || '#1a1a2e',
                        borderColor: theme?.inputBorder || '#333',
                        color: theme?.inputText || '#fff',
                        flex: 1,
                    }]}
                    placeholder="Añade un comentario..."
                    placeholderTextColor={theme?.placeholder || '#666'}
                    value={noteText}
                    onChangeText={setNoteText}
                    multiline
                    maxLength={500}
                />
                {!audioUri && !isRecording && (
                    <TouchableOpacity
                        onPress={startRecording}
                        style={[styles.micBtnInline, { backgroundColor: theme?.primary || '#4361ee' }]}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="mic" size={20} color="#fff" />
                    </TouchableOpacity>
                )}
                {isRecording && (
                    <TouchableOpacity
                        onPress={stopRecording}
                        style={[styles.micBtnInline, { backgroundColor: '#ef4444' }]}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="stop" size={18} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Indicador grabando */}
            {isRecording && (
                <View style={styles.recordingRow}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingTime}>
                        Grabando {formatTime(recordingTime)}
                    </Text>
                </View>
            )}

            {/* Audio grabado */}
            {audioUri && !isRecording && (
                <View style={styles.audioRow}>
                    <TouchableOpacity
                        onPress={playAudio}
                        style={[styles.playBtn, { borderColor: theme?.border || '#333' }]}
                        activeOpacity={0.7}
                    >
                        <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color={theme?.primary || '#4361ee'} />
                    </TouchableOpacity>
                    <Text style={[styles.audioLabel, { color: theme?.textSecondary || '#94a3b8', flex: 1 }]}>
                        🎤 Nota de voz
                    </Text>
                    <TouchableOpacity onPress={deleteAudio} hitSlop={8}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            )}

            {/* ─────────── ACCIONES ─────────── */}
            <View style={styles.actions}>
                {hasExistingData && (
                    <TouchableOpacity
                        onPress={handleDelete}
                        style={[styles.deleteBtn, { borderColor: theme?.border || '#333' }]}
                        activeOpacity={0.8}
                    >
                        <Text style={{ fontSize: 16 }}>🗑️</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    onPress={handleSend}
                    style={[styles.sendBtn, {
                        backgroundColor: isDarkMode ? '#ffffff' : '#10b981'
                    }]}
                    activeOpacity={0.85}
                >
                    <Ionicons
                        name="paper-plane"
                        size={18}
                        color={isDarkMode ? '#1a1a1a' : '#ffffff'}
                    />
                    <Text style={[styles.sendTxt, { color: isDarkMode ? '#1a1a1a' : '#ffffff' }]}>
                        Enviar Feedback
                    </Text>
                </TouchableOpacity>
            </View>
        </>
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER PRINCIPAL
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.card, {
                    backgroundColor: theme?.backgroundSecondary || '#1a1a2e',
                    borderColor: theme?.border || '#333'
                }]}>
                    {isSuccess ? renderSuccessState() : renderFormState()}
                </View>
            </View>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
    exerciseName: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 4,
    },
    // Importance selector
    valueRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    valueBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: '48%',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1.5,
    },
    emoji: {
        fontSize: 14,
    },
    valueTxt: {
        fontSize: 13,
        fontWeight: '600',
    },
    // Media buttons
    mediaRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    mediaBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
    mediaBtnText: {
        fontSize: 15,
        fontWeight: '600',
    },
    deleteMediaSmallBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    folderBtn: {
        width: 50,
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    // Media preview
    mediaPreview: {
        position: 'relative',
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    mediaThumbnail: {
        width: '100%',
        height: 120,
    },
    mediaOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteMediaBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    deleteMediaCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoPlaceholder: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#10b981',
        borderRadius: 12,
    },
    videoLabel: {
        color: '#10b981',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    // Input & audio
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        minHeight: 60,
        textAlignVertical: 'top',
        fontSize: 14,
    },
    micBtnInline: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
    },
    recordingTime: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ef4444',
    },
    audioRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
        padding: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(67, 97, 238, 0.1)',
    },
    playBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioLabel: {
        fontSize: 13,
    },
    // Actions
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 16,
    },
    deleteBtn: {
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    sendBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
    sendTxt: {
        fontSize: 15,
        fontWeight: '700',
    },
    // Success state
    successContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    checkCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
    },
    successSubtitle: {
        fontSize: 14,
        marginBottom: 24,
    },
    instagramBtn: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    instagramGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 24,
    },
    instagramText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    closeSuccessBtn: {
        paddingVertical: 12,
    },
    closeSuccessText: {
        fontSize: 14,
    },
});
