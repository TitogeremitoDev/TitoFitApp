// src/components/coach/VideoFeedbackResponseModal.jsx
// ═══════════════════════════════════════════════════════════════════════════
// MODAL DE RESPUESTA A VIDEO FEEDBACK DEL ATLETA
// Con respuestas rápidas, grabación de audio, y biblioteca de recursos YouTube
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    StyleSheet,
    Linking,
    Alert,
    ActivityIndicator,
    Platform,
    useWindowDimensions,
    KeyboardAvoidingView,
    Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import Video from 'react-native-video';
import { useAuth } from '../../../context/AuthContext';
import { useFeedbackDraft } from '../../../context/FeedbackDraftContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SmartFeedbackInput from './SmartFeedbackInput';
import VideoSearchPicker from './VideoSearchPicker';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function VideoFeedbackResponseModal({
    visible,
    onClose,
    feedback,       // VideoFeedback object
    onResponseSent  // Callback when response is successfully sent
}) {
    const { token } = useAuth();
    const { addTechnicalNote } = useFeedbackDraft();
    const insets = useSafeAreaInsets();
    const { width: windowWidth } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isLargeScreen = windowWidth > 768; // Desktop/tablet

    // Estados
    const [message, setMessage] = useState('');
    const [externalUrl, setExternalUrl] = useState('');
    const [snippets, setSnippets] = useState([]); // 🆕 TrainerSnippets for Ghost Text
    const [selectedVideo, setSelectedVideo] = useState(null); // 🆕 For VideoSearchPicker
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    // 🆕 Media URL from R2
    const [mediaUrl, setMediaUrl] = useState(null);
    const [loadingMedia, setLoadingMedia] = useState(false);

    // Audio recording with expo-audio hooks
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const [recordingUri, setRecordingUri] = useState(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingInterval = useRef(null);

    // UI states
    const [showResources, setShowResources] = useState(false);

    // 🆕 Audio Player for athlete's audio feedback
    const [isPlayingAthleteAudio, setIsPlayingAthleteAudio] = useState(false);
    const athleteAudioPlayer = useAudioPlayer(mediaUrl && feedback?.mediaType === 'audio' ? mediaUrl : null);

    // ═══════════════════════════════════════════════════════════════════════════
    // CARGAR DATOS INICIALES
    // ═══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (visible) {
            loadSnippets(); // 🆕 Load TrainerSnippets instead of quickReplies
            loadMediaUrl();
        }
        return () => {
            // Cleanup audio on close
            if (audioRecorder.isRecording) {
                audioRecorder.stop();
            }
            if (recordingInterval.current) {
                clearInterval(recordingInterval.current);
            }
            // 🆕 Clear media on close
            setMediaUrl(null);
        };
    }, [visible]);

    // 🆕 Cargar URL de media desde R2
    const loadMediaUrl = async () => {
        if (!feedback?._id) return;

        try {
            setLoadingMedia(true);
            const response = await fetch(`${API_URL}/api/video-feedback/${feedback._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.mediaUrl) {
                console.log('[MediaModal] URL cargada:', data.mediaType, data.mediaUrl.slice(0, 100));
                setMediaUrl(data.mediaUrl);
            }
        } catch (error) {
            console.error('[MediaModal] Error loading media URL:', error);
        } finally {
            setLoadingMedia(false);
        }
    };

    // 🆕 Load TrainerSnippets for Ghost Text autocomplete
    const loadSnippets = async () => {
        try {
            const res = await fetch(`${API_URL}/api/trainer-snippets/trainer`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.snippets) {
                setSnippets(data.snippets);
                console.log('[MediaModal] Loaded', data.snippets.length, 'snippets');
            }
        } catch (error) {
            console.error('[Modal] Error loading snippets:', error);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // AUDIO RECORDING (expo-audio)
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
            setRecordingDuration(0);

            recordingInterval.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('[Modal] Error starting recording:', error);
            Alert.alert('Error', 'No se pudo grabar');
        }
    };

    const stopRecording = async () => {
        try {
            if (recordingInterval.current) clearInterval(recordingInterval.current);
            await audioRecorder.stop();
            const uri = audioRecorder.uri;
            setRecordingUri(uri);
        } catch (error) {
            console.error('[Modal] Error stopping recording:', error);
        }
    };

    const clearRecording = () => {
        setRecordingUri(null);
        setRecordingDuration(0);
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ENVIAR RESPUESTA
    // ═══════════════════════════════════════════════════════════════════════════
    const handleSendResponse = async () => {
        if (!message.trim() && !recordingUri && !externalUrl) {
            Alert.alert('Vacío', 'Añade un mensaje, audio o enlace');
            return;
        }

        setSending(true);

        try {
            // Construir mensaje con URL si existe
            let fullMessage = message.trim();
            if (externalUrl) {
                fullMessage += `\n\n📺 ${selectedResource?.title || 'Ver video'}: ${externalUrl}`;
            }

            // TODO: Si hay audio, subirlo a R2 y obtener URL
            let audioUrl = null;
            if (recordingUri) {
                // Por ahora, placeholder - implementar subida a R2
                console.log('[Modal] Audio recorded at:', recordingUri);
                // audioUrl = await uploadAudioToR2(recordingUri);
            }

            // Enviar al chat
            const response = await fetch(`${API_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    clientId: feedback.athleteId,
                    message: fullMessage,
                    type: 'video_feedback_response',
                    referenceId: feedback._id,
                    referenceType: 'VideoFeedback',
                    isCoach: true
                })
            });

            const data = await response.json();

            if (data.success) {
                // Marcar feedback como respondido (opcional, si tienes endpoint)
                try {
                    await fetch(`${API_URL}/api/video-feedback/${feedback._id}/respond`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            text: fullMessage,
                            audioUrl
                        })
                    });
                } catch (e) {
                    console.log('[Modal] Could not mark as responded:', e);
                }

                Alert.alert('¡Enviado!', 'Tu respuesta se ha enviado al chat del cliente');
                onResponseSent?.(feedback._id);
                handleClose();
            } else {
                Alert.alert('Error', data.message || 'No se pudo enviar');
            }
        } catch (error) {
            console.error('[Modal] Error sending:', error);
            Alert.alert('Error', 'Error de conexión');
        } finally {
            setSending(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════════════════
    const handleClose = () => {
        setMessage('');
        setExternalUrl('');
        setSelectedVideo(null);
        setRecordingUri(null);
        setRecordingDuration(0);
        onClose();
    };

    if (!feedback) return null;

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <View style={[styles.container, { maxWidth: isWeb ? 600 : undefined, alignSelf: isWeb ? 'center' : undefined, width: isWeb ? '100%' : undefined }]}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
                    <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Responder Video</Text>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* 🆕 Media Preview (Video/Photo/Audio) */}
                        <View style={styles.mediaPreviewSection}>
                            <View style={styles.mediaHeader}>
                                <View style={styles.videoInfo}>
                                    <Text style={styles.videoExercise}>
                                        {feedback.exerciseName || 'Ejercicio'}
                                    </Text>
                                    <Text style={styles.videoMeta}>
                                        Serie {feedback.setNumber || '?'} • {feedback.athleteNote || 'Sin nota'}
                                    </Text>
                                </View>
                            </View>

                            {/* Media Content */}
                            <View style={styles.mediaContainer}>
                                {loadingMedia ? (
                                    <View style={styles.mediaLoading}>
                                        <ActivityIndicator size="large" color="#4361ee" />
                                        <Text style={styles.mediaLoadingText}>Cargando media...</Text>
                                    </View>
                                ) : mediaUrl ? (
                                    <>
                                        {feedback.mediaType === 'photo' ? (
                                            <Image
                                                source={{ uri: mediaUrl }}
                                                style={styles.mediaImage}
                                                resizeMode="contain"
                                            />
                                        ) : feedback.mediaType === 'video' ? (
                                            isWeb ? (
                                                <video
                                                    src={mediaUrl}
                                                    controls
                                                    style={{ width: '100%', maxHeight: 300, borderRadius: 12 }}
                                                />
                                            ) : (
                                                <Video
                                                    source={{ uri: mediaUrl }}
                                                    style={styles.mediaVideo}
                                                    controls={true}
                                                    resizeMode="contain"
                                                    paused={true}
                                                />
                                            )
                                        ) : feedback.mediaType === 'audio' ? (
                                            <View style={styles.audioPreview}>
                                                <Ionicons name="musical-notes" size={48} color="#4361ee" />
                                                <Text style={styles.audioLabel}>Audio del atleta</Text>
                                                <TouchableOpacity
                                                    style={styles.audioPlayBtn}
                                                    onPress={() => {
                                                        if (athleteAudioPlayer) {
                                                            if (isPlayingAthleteAudio) {
                                                                athleteAudioPlayer.pause();
                                                            } else {
                                                                athleteAudioPlayer.play();
                                                            }
                                                            setIsPlayingAthleteAudio(!isPlayingAthleteAudio);
                                                        }
                                                    }}
                                                >
                                                    <Ionicons
                                                        name={isPlayingAthleteAudio ? "pause" : "play"}
                                                        size={32}
                                                        color="#fff"
                                                    />
                                                    <Text style={styles.audioPlayBtnText}>
                                                        {isPlayingAthleteAudio ? 'Pausar' : 'Reproducir'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <View style={styles.mediaPlaceholder}>
                                                <Ionicons name="document" size={48} color="#4361ee" />
                                                <Text style={styles.mediaPlaceholderText}>Media desconocida</Text>
                                            </View>
                                        )}
                                    </>
                                ) : (
                                    <View style={styles.mediaPlaceholder}>
                                        <Ionicons
                                            name={feedback.mediaType === 'photo' ? 'image' : feedback.mediaType === 'audio' ? 'mic' : 'videocam'}
                                            size={48}
                                            color="#4361ee"
                                        />
                                        <Text style={styles.mediaPlaceholderText}>
                                            {feedback.mediaType === 'photo' ? 'Foto no disponible' :
                                                feedback.mediaType === 'audio' ? 'Audio no disponible' :
                                                    'Video no disponible'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* 🆕 Tu Respuesta - con sugerencias */}
                        <View style={[styles.section, { zIndex: 100 }]}>
                            <Text style={styles.sectionTitle}>📝 Tu Respuesta</Text>
                            <SmartFeedbackInput
                                value={message}
                                onChangeText={setMessage}
                                snippets={snippets}
                                exerciseName={feedback?.exerciseName || ''}
                                placeholder="Escribe tu feedback aquí..."
                            />
                        </View>

                        {/* Audio Recording - Solo en móvil (no funciona en web) */}
                        {!(isWeb && isLargeScreen) && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>🎙️ Audio (Opcional)</Text>
                                {isWeb ? (
                                    <View style={styles.webOnlyMessage}>
                                        <Ionicons name="phone-portrait-outline" size={20} color="#888" />
                                        <Text style={styles.webOnlyText}>
                                            Solo disponible en Android e iOS
                                        </Text>
                                    </View>
                                ) : !recordingUri ? (
                                    <View style={styles.audioRow}>
                                        {!audioRecorder.isRecording ? (
                                            <TouchableOpacity
                                                style={styles.recordBtn}
                                                onPress={startRecording}
                                            >
                                                <Ionicons name="mic" size={24} color="#fff" />
                                                <Text style={styles.recordBtnText}>Grabar Audio</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity
                                                style={[styles.recordBtn, styles.recordingBtn]}
                                                onPress={stopRecording}
                                            >
                                                <View style={styles.recordingDot} />
                                                <Text style={styles.recordBtnText}>
                                                    {formatDuration(recordingDuration)} - Detener
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ) : (
                                    <View style={styles.recordedAudio}>
                                        <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                                        <Text style={styles.recordedText}>
                                            Audio grabado ({formatDuration(recordingDuration)})
                                        </Text>
                                        <TouchableOpacity onPress={clearRecording}>
                                            <Ionicons name="trash" size={20} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* 🆕 Video YouTube Search */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>📺 Recurso YouTube (Opcional)</Text>
                            <VideoSearchPicker
                                token={token}
                                selectedVideo={selectedVideo}
                                onSelectVideo={(video) => {
                                    setSelectedVideo(video);
                                    setExternalUrl(video.url);
                                }}
                                onClear={() => {
                                    setSelectedVideo(null);
                                    setExternalUrl('');
                                }}
                            />
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* Action Buttons */}
                <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
                    {/* PRIMARY: Añadir al Feedback (Solid Blue) */}
                    <TouchableOpacity
                        style={[styles.addToFeedbackBtn, sending && styles.sendingBtn]}
                        onPress={() => {
                            if (!message.trim() && !recordingUri && !externalUrl) {
                                Alert.alert('Sin contenido', 'Escribe un mensaje, graba audio o selecciona un video.');
                                return;
                            }
                            addTechnicalNote({
                                id: Date.now().toString(),
                                text: message,
                                exerciseName: feedback?.exerciseName || 'Ejercicio',
                                thumbnail: feedback?.thumbnailUrl || null,
                                videoUrl: externalUrl || null, // Video YouTube del coach
                                sourceMediaUrl: mediaUrl || null, // Video/foto original del atleta
                                mediaType: feedback?.mediaType || 'video'
                            });
                            setMessage('');
                            setExternalUrl('');
                            setSelectedVideo(null);
                            Alert.alert('✓ Añadido', 'Nota guardada en el borrador del feedback');
                            handleClose();
                        }}
                        disabled={sending}
                    >
                        <Ionicons name="clipboard" size={20} color="#fff" />
                        <Text style={styles.addToFeedbackBtnText}>Añadir al Feedback</Text>
                    </TouchableOpacity>

                    {/* SECONDARY: Enviar Ahora (Outline) */}
                    <TouchableOpacity
                        style={[styles.sendNowBtn, sending && styles.sendingBtn]}
                        onPress={handleSendResponse}
                        disabled={sending}
                    >
                        {sending ? (
                            <ActivityIndicator color="#4361ee" />
                        ) : (
                            <>
                                <Ionicons name="send" size={18} color="#4361ee" />
                                <Text style={styles.sendNowBtnText}>Enviar ahora</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a14',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a2e',
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        gap: 20,
    },
    // Video Preview
    videoPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#1a1a2e',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#4361ee30',
    },
    videoThumb: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#4361ee20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoInfo: {
        flex: 1,
    },
    videoExercise: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    videoMeta: {
        color: '#888',
        fontSize: 13,
        marginTop: 4,
    },
    // Sections
    section: {
        gap: 10,
    },
    sectionTitle: {
        color: '#888',
        fontSize: 13,
        fontWeight: '600',
    },
    // Quick Replies
    quickRepliesRow: {
        flexDirection: 'row',
        gap: 8,
    },
    quickReplyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#1a1a2e',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    quickReplyEmoji: {
        fontSize: 16,
    },
    quickReplyText: {
        color: '#fff',
        fontSize: 13,
        maxWidth: 100,
    },
    // Text Input
    textInput: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 14,
        color: '#fff',
        fontSize: 15,
        minHeight: 100,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#333',
    },
    // Audio
    audioRow: {
        flexDirection: 'row',
    },
    recordBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#4361ee',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
    },
    recordingBtn: {
        backgroundColor: '#ef4444',
    },
    recordBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#fff',
    },
    recordedAudio: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#10b98120',
        padding: 12,
        borderRadius: 10,
    },
    recordedText: {
        flex: 1,
        color: '#10b981',
        fontSize: 14,
    },
    // Resources
    resourceOptions: {
        gap: 10,
    },
    resourceBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#1a1a2e',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#4361ee50',
    },
    resourceBtnText: {
        color: '#4361ee',
        fontSize: 14,
        fontWeight: '600',
    },
    urlInput: {
        backgroundColor: '#1a1a2e',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#333',
    },
    selectedResource: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#1a1a2e',
        padding: 12,
        borderRadius: 8,
    },
    selectedResourceText: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
    },
    resourcesList: {
        backgroundColor: '#1a1a2e',
        borderRadius: 8,
        marginTop: 8,
        overflow: 'hidden',
    },
    resourceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    resourceItemText: {
        color: '#fff',
        fontSize: 14,
    },
    // Footer
    footer: {
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        borderTopWidth: 1,
        borderTopColor: '#1a1a2e',
        flexDirection: 'row',
        gap: 12,
    },
    // PRIMARY: Añadir al Feedback (Solid Blue)
    addToFeedbackBtn: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#4361ee',
        paddingVertical: 14,
        borderRadius: 12,
    },
    addToFeedbackBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    // SECONDARY: Enviar ahora (Outline)
    sendNowBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'transparent',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#4361ee',
    },
    sendNowBtnText: {
        color: '#4361ee',
        fontSize: 14,
        fontWeight: '600',
    },
    sendingBtn: {
        opacity: 0.7,
    },
    sendBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    // Web-only message for unavailable features
    webOnlyMessage: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#1a1a2e',
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    webOnlyText: {
        color: '#888',
        fontSize: 14,
        fontStyle: 'italic',
    },
    // 🆕 Media Preview Styles
    mediaPreviewSection: {
        backgroundColor: '#1a1a2e',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#4361ee30',
    },
    mediaHeader: {
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    mediaContainer: {
        minHeight: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111',
    },
    mediaImage: {
        width: '100%',
        height: 300,
    },
    mediaVideo: {
        width: '100%',
        height: 300,
    },
    mediaLoading: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    mediaLoadingText: {
        color: '#888',
        fontSize: 14,
    },
    mediaPlaceholder: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    mediaPlaceholderText: {
        color: '#666',
        fontSize: 14,
    },
    audioPreview: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    audioLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    audioPlayBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10b981',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        marginTop: 12,
        gap: 8,
    },
    audioPlayBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
