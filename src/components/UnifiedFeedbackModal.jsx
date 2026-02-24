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
    TouchableOpacity,
    Pressable,
    StyleSheet,
    Image,
    ActivityIndicator,
    Platform,
    Animated,
    Alert,
} from 'react-native';
import { EnhancedTextInput } from '../../components/ui';

// Importar react-native-share y FileSystem solo en native (no web)
let RNShare, FileSystem;
if (Platform.OS !== 'web') {
    RNShare = require('react-native-share').default;
    FileSystem = require('expo-file-system/legacy');
}
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import StoryShareModal from './shared/StoryShareModal';
import { useAuth } from '../../context/AuthContext';
import { useTrainer } from '../../context/TrainerContext';
import { useCoachBranding } from '../../context/CoachBrandingContext';
import { getContrastColor } from '../../utils/colors';

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

    // Coach branding contexts
    const { user } = useAuth();
    const { trainer } = useTrainer();
    const { activeTheme } = useCoachBranding();

    const coachName = trainer?.profile?.brandName || trainer?.nombre || 'mi entrenador';
    const coachLogoUrl = trainer?.profile?.logoUrl || null;
    const coachColor = activeTheme?.colors?.primary || '#60a5fa';

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
    const [showStoryModal, setShowStoryModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [videoThumbnailUri, setVideoThumbnailUri] = useState(null);

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
            // En iOS 14+, PHPickerViewController no requiere permisos explícitos.
            // Solo pedimos permisos en Android para compatibilidad.
            if (Platform.OS === 'android') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permiso necesario', 'Se necesita acceso a tu galería para seleccionar fotos o videos.');
                    return;
                }
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                quality: 0.8,
                allowsEditing: false,
            });

            if (result.canceled) return;

            const file = result.assets[0];
            const { uri, type, fileName, mimeType } = file;

            console.log('[UnifiedFeedbackModal] File picked:', { uri, type, fileName, mimeType });

            // ImagePicker devuelve type: 'image' o 'video'
            if (type === 'video' || mimeType?.startsWith('video/')) {
                setMediaUri(uri);
                setMediaType('video');
                setTrimStart(0);
                setTrimEnd(0);
                setVideoThumbnailUri(null);
            } else {
                setMediaUri(uri);
                setMediaType('photo');
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
    const gallerySavePendingRef = useRef(null);

    const handleSend = async () => {
        // 1. Si hay media, mostrar éxito PRIMERO (animación suave antes de trabajo pesado)
        if (mediaUri) {
            // Guardar URI para save a galería DESPUÉS de cerrar modal (evita crash Android)
            if (Platform.OS !== 'web') {
                let uri = mediaUri;
                if (!uri.startsWith('file://') && !uri.startsWith('content://')) {
                    uri = 'file://' + uri;
                }
                gallerySavePendingRef.current = uri;
            }

            setIsSuccess(true);
            Animated.spring(successAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }).start();

            // 2. Guardar DESPUÉS de que la animación arranque (evita jank en Android)
            requestAnimationFrame(() => {
                onSave(serieKey, importance, noteText, audioUri, mediaUri, mediaType, trimStart, trimEnd);
            });
        } else {
            // Sin media, guardar y cerrar directamente
            onSave(serieKey, importance, noteText, audioUri, mediaUri, mediaType, trimStart, trimEnd);
            onClose();
        }
    };

    // Guardar foto/vídeo en galería DESPUÉS de que el modal se cierre (evita crash Android)
    useEffect(() => {
        if (!visible && gallerySavePendingRef.current) {
            const uri = gallerySavePendingRef.current;
            gallerySavePendingRef.current = null;
            const timer = setTimeout(async () => {
                try {
                    const MediaLibrary = require('expo-media-library');
                    await MediaLibrary.saveToLibraryAsync(uri);
                    console.log('[UFM] Guardado en galería OK');
                } catch (e) {
                    console.warn('[UFM] No se pudo guardar en galería:', e.message);
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    const handleClose = () => {
        setIsSuccess(false);
        onClose();
    };

    const handleDelete = () => {
        onSave(serieKey, null, null, null, null, null);
        onClose();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPARTIR EN REDES SOCIALES
    // ═══════════════════════════════════════════════════════════════════════════
    const videoSharePendingRef = useRef(null);

    const shareToSocial = async () => {
        console.log('[UFM] shareToSocial called. mediaType:', mediaType, 'hasMediaUri:', !!mediaUri);
        if (mediaType === 'video' && mediaUri) {
            // Vídeo: cerrar modal primero para evitar crash Android (Intent sobre Modal)
            let uri = mediaUri;
            if (!uri.startsWith('file://') && !uri.startsWith('content://')) {
                uri = 'file://' + uri;
            }
            console.log('[UFM] Video: closing modal first, then share. URI:', uri.substring(0, 60));
            gallerySavePendingRef.current = null; // No duplicar: el share ya entrega el archivo
            videoSharePendingRef.current = uri;
            setIsSuccess(false);
            onClose();
        } else {
            // Foto: abrir StoryShareModal con overlay de branding
            // StoryShareModal guarda la imagen branded → limpiar ref para no duplicar
            gallerySavePendingRef.current = null;
            console.log('[UFM] Photo: opening embedded StoryShareModal');
            setShowStoryModal(true);
        }
    };

    // Compartir vídeo DESPUÉS de que el Modal se haya cerrado
    useEffect(() => {
        if (!visible && videoSharePendingRef.current) {
            const uri = videoSharePendingRef.current;
            videoSharePendingRef.current = null;
            console.log('[UFM] Modal closed, sharing video after 300ms delay...');
            const timer = setTimeout(async () => {
                try {
                    console.log('[UFM] Calling Sharing.shareAsync for video...');
                    const Sharing = require('expo-sharing');
                    const available = await Sharing.isAvailableAsync();
                    if (!available) { console.log('[UFM] Sharing not available'); return; }
                    await Sharing.shareAsync(uri, { mimeType: 'video/mp4', dialogTitle: 'Compartir' });
                    console.log('[UFM] Video share completed OK');
                } catch (err) {
                    console.error('[UFM] Video share error:', err.message);
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════════
    const isDarkMode = theme?.background === '#0d0d0d';
    const hasExistingData = initialValue || initialNote || initialAudioUri || initialMediaUri;

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: ESTADO DE ÉXITO (Celebración + Compartir con branding)
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

                {/* Botón de compartir con branding (solo si hay media) */}
                {mediaUri && (
                    <TouchableOpacity
                        style={styles.shareBtn}
                        onPress={shareToSocial}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['#f09433', '#e6683c', '#dc2743', '#cc2366', '#bc1888']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.shareGradient}
                        >
                            <Ionicons name="logo-instagram" size={22} color="#fff" />
                            <Text style={styles.shareText}>Compartir en Stories</Text>
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
                        <Ionicons name="videocam" size={24} color={theme?.text || '#10b981'} />
                        <Text style={[styles.mediaBtnText, { color: theme?.text || '#10b981' }]}>
                            Video
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.mediaBtn, { backgroundColor: '#22c55e20' }]}
                        onPress={handleTakePhoto}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="camera" size={24} color={theme?.text || '#22c55e'} />
                        <Text style={[styles.mediaBtnText, { color: theme?.text || '#22c55e' }]}>
                            Foto
                        </Text>
                    </TouchableOpacity>

                    {/* Botón Galería */}
                    <TouchableOpacity
                        style={[styles.folderBtn, { borderColor: theme?.border || '#333' }]}
                        onPress={handlePickFile}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="images-outline" size={22} color={theme?.textSecondary || '#94a3b8'} />
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
                            <Ionicons name="videocam" size={24} color={theme?.text || '#10b981'} />
                        )}
                        <Text style={[styles.mediaBtnText, { color: mediaType === 'video' ? '#fff' : (theme?.text || '#10b981') }]}>
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
                            <Ionicons name="camera" size={24} color={theme?.text || '#22c55e'} />
                        )}
                        <Text style={[styles.mediaBtnText, { color: mediaType === 'photo' ? '#fff' : (theme?.text || '#22c55e') }]}>
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
                <EnhancedTextInput
                    containerStyle={[styles.inputContainer, {
                        backgroundColor: theme?.inputBackground || '#1a1a2e',
                        borderColor: theme?.inputBorder || '#333',
                        flex: 1,
                    }]}
                    style={[styles.inputText, {
                        color: theme?.inputText || '#fff',
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
                        <Ionicons name="mic" size={20} color={getContrastColor(theme?.primary || '#4361ee')} />
                    </TouchableOpacity>
                )}
                {isRecording && (
                    <TouchableOpacity
                        onPress={stopRecording}
                        style={[styles.micBtnInline, { backgroundColor: '#ef4444' }]}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="stop" size={18} color={getContrastColor('#ef4444')} />
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
        <>
            <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
                <View style={styles.overlay}>
                    <View style={[styles.card, {
                        backgroundColor: theme?.backgroundSecondary || '#1a1a2e',
                        borderColor: theme?.border || '#333'
                    }]}>
                        {isSuccess ? renderSuccessState() : renderFormState()}
                    </View>
                </View>

                {/* Story Share solo para FOTOS (embedded dentro del mismo Modal) */}
                <StoryShareModal
                    visible={showStoryModal}
                    onClose={() => {
                        setShowStoryModal(false);
                        setIsSuccess(false);
                        onClose();
                    }}
                    photoUri={mediaUri}
                    mediaType="photo"
                    badgeText={`🏋️ ${exerciseName || 'Entrenamiento'}`}
                    mainText="Entrenando con"
                    coachName={coachName}
                    coachLogoUrl={coachLogoUrl}
                    coachColor={coachColor}
                    theme={theme}
                    embedded
                    onCloseParentModal={onClose}
                />
            </Modal>
        </>
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
    inputContainer: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        minHeight: 60,
    },
    inputText: {
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
    // Unified share button
    shareBtn: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    shareGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 24,
    },
    shareText: {
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

// ═══════════════════════════════════════════════════════════════════════════
// storyStyles eliminado — ahora usa StoryShareModal compartido
