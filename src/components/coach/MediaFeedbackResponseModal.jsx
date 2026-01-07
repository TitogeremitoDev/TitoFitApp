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
// import Markdown from 'react-native-markdown-display'; // ⚠️ Temporarily disabled due to Metro bundler issues

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function VideoFeedbackResponseModal({
    visible,
    onClose,
    feedback,       // VideoFeedback object (primary/priority media)
    allMedia = [],  // 🆕 Array of all media items for this set (video, photo, audio)
    textNote = null, // 🆕 Text note from workout (set.notes?.note)
    onResponseSent, // Callback when response is successfully sent
    isInline = false, // When true, renders without Modal wrapper (for split-view)
    initialAiExpanded = false // 🆕 Auto-expand AI section logic
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
    const [loadingMedia, setLoadingMedia] = useState(false); // ⚠️ Restored
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

    // 🆕 AI Transcription State
    const [aiExpanded, setAiExpanded] = useState(initialAiExpanded);

    // Sync aiExpanded when prop changes or modal opens
    useEffect(() => {
        if (visible) {
            setAiExpanded(initialAiExpanded);
        }
    }, [visible, initialAiExpanded]);
    const [transcriptionData, setTranscriptionData] = useState({
        status: 'none', // pending, completed, failed, none
        text: '',
        summary: ''
    });
    const [retryingAi, setRetryingAi] = useState(false);
    const pollingInterval = useRef(null);

    // Audio recording with expo-audio hooks
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const [recordingUri, setRecordingUri] = useState(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingInterval = useRef(null);

    // UI states
    const [showResources, setShowResources] = useState(false);

    // 🆕 Audio Player for athlete's audio feedback
    const [isPlayingAthleteAudio, setIsPlayingAthleteAudio] = useState(false);
    const [audioDuration, setAudioDuration] = useState(0);
    // Initialize player with null, will load source via useEffect when mediaUrl is ready
    const athleteAudioPlayer = useAudioPlayer(null);

    // ═══════════════════════════════════════════════════════════════════════════
    // CARGAR DATOS INICIALES
    // ═══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (visible && feedback?._id) {
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
            if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
            }
            // 🆕 Clear media and audio state on close
            setMediaUrl(null);
            setIsPlayingAthleteAudio(false);
            setAudioDuration(0);
            setAiExpanded(false);
            setTranscriptionData({ status: 'none', text: '', summary: '' });
        };
    }, [visible, feedback?._id]);

    // 🆕 Cargar URL de media desde R2 (y datos de transcripción)
    const loadMediaUrl = async () => {
        if (!feedback?._id) return;
        // Skip for text-only notes (no media to load)
        if (feedback.mediaType === 'text-note') {
            setLoadingMedia(false);
            return;
        }

        try {
            setLoadingMedia(true);
            const response = await fetch(`${API_URL}/api/video-feedback/${feedback._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            // Set transcription data
            setTranscriptionData({
                status: data.transcriptionStatus || 'none',
                text: data.transcription || '',
                summary: data.summary || ''
            });

            // Start polling if pending
            if (data.transcriptionStatus === 'pending') {
                startPolling(feedback._id);
            }

            if (data.mediaUrl) {
                // console.log('[MediaModal] URL cargada:', data.mediaType, data.mediaUrl.slice(0, 100)); // Cleanup log
                setMediaUrl(data.mediaUrl);
            }
        } catch (error) {
            console.error('[MediaModal] Error loading media URL:', error);
        } finally {
            setLoadingMedia(false);
        }
    };

    const startPolling = (id) => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);

        pollingInterval.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/api/video-feedback/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.transcriptionStatus !== 'pending') {
                    setTranscriptionData({
                        status: data.transcriptionStatus,
                        text: data.transcription || '',
                        summary: data.summary || ''
                    });
                    clearInterval(pollingInterval.current);
                }
            } catch (e) {
                console.log('Polling error:', e);
            }
        }, 5000); // Check every 5s
    };

    // 🆕 Retry Transcription logic
    const handleRetryTranscription = async () => {
        if (!feedback?._id) return;
        setRetryingAi(true);
        try {
            await fetch(`${API_URL}/api/video-feedback/${feedback._id}/retry-transcription`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            // Update state to pending immediately and start polling
            setTranscriptionData(prev => ({ ...prev, status: 'pending' }));
            startPolling(feedback._id);
            Alert.alert('Iniciado', 'La IA está procesando el audio nuevamente...');
        } catch (error) {
            Alert.alert('Error', 'No se pudo reiniciar la transcripción');
        } finally {
            setRetryingAi(false);
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

    // 🆕 Load audio source when mediaUrl becomes available
    useEffect(() => {
        if (athleteAudioPlayer && mediaUrl && feedback?.mediaType === 'audio') {
            console.log('[MediaModal] Loading audio source:', mediaUrl.slice(0, 100));
            athleteAudioPlayer.replace({ uri: mediaUrl });
        }
    }, [mediaUrl, feedback?.mediaType, athleteAudioPlayer]);

    // 🆕 Listen to playback status for audio player
    useEffect(() => {
        if (!athleteAudioPlayer) return;

        // Set up event listener for playback status
        const subscription = athleteAudioPlayer.addListener('playingChange', (event) => {
            setIsPlayingAthleteAudio(event.isPlaying);
        });

        return () => {
            subscription?.remove();
        };
    }, [athleteAudioPlayer]);

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

    // Wrapper: Modal for overlay, View for inline
    const Wrapper = isInline ? View : Modal;
    const wrapperProps = isInline
        ? { style: { flex: 1 } }
        : { visible, animationType: 'slide', presentationStyle: 'pageSheet', onRequestClose: handleClose };

    return (
        <Wrapper {...wrapperProps}>
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
                                        Serie {feedback.setNumber || (feedback.serieKey ? parseInt(feedback.serieKey.split('|')[3]) + 1 : '?')}
                                    </Text>
                                </View>
                                {/* Badges de medios disponibles */}
                                {(allMedia.length > 0 || textNote) && (
                                    <View style={styles.mediaBadges}>
                                        {allMedia.some(m => m.mediaType === 'video') && (
                                            <View style={[styles.mediaBadge, { backgroundColor: '#ef4444' }]}>
                                                <Ionicons name="videocam" size={10} color="#fff" />
                                            </View>
                                        )}
                                        {allMedia.some(m => m.mediaType === 'photo') && (
                                            <View style={[styles.mediaBadge, { backgroundColor: '#3b82f6' }]}>
                                                <Ionicons name="image" size={10} color="#fff" />
                                            </View>
                                        )}
                                        {allMedia.some(m => m.mediaType === 'audio') && (
                                            <View style={[styles.mediaBadge, { backgroundColor: '#8b5cf6' }]}>
                                                <Ionicons name="mic" size={10} color="#fff" />
                                            </View>
                                        )}
                                        {(textNote || feedback.athleteNote) && (
                                            <View style={[styles.mediaBadge, { backgroundColor: '#10b981' }]}>
                                                <Ionicons name="chatbubble" size={10} color="#fff" />
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>

                            {/* Nota del atleta (siempre visible si existe) */}
                            {(textNote || feedback.athleteNote) && (
                                <View style={styles.athleteNoteSection}>
                                    <View style={styles.athleteNoteHeader}>
                                        <Ionicons name="chatbubble-ellipses" size={16} color="#10b981" />
                                        <Text style={styles.athleteNoteLabel}>Nota del atleta</Text>
                                    </View>
                                    <Text style={styles.athleteNoteText}>"{textNote || feedback.athleteNote}"</Text>
                                </View>
                            )}

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
                                                {/* Mostrar nota del atleta si existe */}
                                                {feedback.athleteNote && (
                                                    <Text style={styles.audioNoteText}>"{feedback.athleteNote}"</Text>
                                                )}
                                                {/* 🆕 Audio Controls Row with IA Button */}
                                                <View style={styles.audioControlsRow}>
                                                    <TouchableOpacity
                                                        style={styles.audioPlayBtn}
                                                        onPress={() => {
                                                            if (athleteAudioPlayer) {
                                                                if (isPlayingAthleteAudio) {
                                                                    athleteAudioPlayer.pause();
                                                                } else {
                                                                    athleteAudioPlayer.play();
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <Ionicons
                                                            name={isPlayingAthleteAudio ? "pause" : "play"}
                                                            size={24}
                                                            color="#fff"
                                                        />
                                                        <Text style={styles.audioPlayBtnText}>
                                                            {isPlayingAthleteAudio ? 'Pausar' : 'Reproducir'}
                                                        </Text>
                                                    </TouchableOpacity>

                                                    {/* Botón IA Inline */}
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.aiIconButton,
                                                            transcriptionData.status === 'completed' && styles.aiIconButtonActive,
                                                            (transcriptionData.status === 'pending' || retryingAi) && styles.aiIconButtonLoading
                                                        ]}
                                                        onPress={() => {
                                                            if (transcriptionData.status === 'none' || transcriptionData.status === 'failed') {
                                                                handleRetryTranscription();
                                                            } else {
                                                                // Toggle visibility if needed, or just keep it open
                                                                setAiExpanded(!aiExpanded);
                                                            }
                                                        }}
                                                        disabled={transcriptionData.status === 'pending' || retryingAi}
                                                    >
                                                        {(transcriptionData.status === 'pending' || retryingAi) ? (
                                                            <ActivityIndicator size="small" color="#fff" />
                                                        ) : (
                                                            <Ionicons name="sparkles" size={20} color={transcriptionData.status === 'completed' ? "#fff" : "#8b5cf6"} />
                                                        )}
                                                        <Text style={[styles.aiIconButtonText, transcriptionData.status === 'completed' && { color: '#fff' }]}>
                                                            IA
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>

                                                {/* 🆕 AI Content Display (Below Audio Bar) */}
                                                {(transcriptionData.status === 'completed' || transcriptionData.status === 'pending' || retryingAi) && aiExpanded && (
                                                    <View style={styles.aiContentInline}>
                                                        {transcriptionData.status === 'pending' || retryingAi ? (
                                                            <Text style={styles.aiLoadingTextInline}>✨ Analizando audio...</Text>
                                                        ) : (
                                                            <>
                                                                {transcriptionData.summary ? (
                                                                    <View style={styles.aiSummaryCard}>
                                                                        <Text style={styles.aiSummaryLabel}>RESUMEN</Text>
                                                                        <Text style={styles.aiSummaryText}>{transcriptionData.summary}</Text>
                                                                    </View>
                                                                ) : null}
                                                                <View style={styles.markdownContainer}>
                                                                    {/* Fallback to plain Text */}
                                                                    <Text style={{ color: '#ccc', fontSize: 14, lineHeight: 20 }}>
                                                                        {transcriptionData.text}
                                                                    </Text>
                                                                </View>
                                                            </>
                                                        )}
                                                    </View>
                                                )}

                                                {transcriptionData.status === 'failed' && (
                                                    <View style={styles.aiErrorInline}>
                                                        <Text style={styles.aiErrorText}>Fallo en transcripción</Text>
                                                    </View>
                                                )}
                                            </View>
                                        ) : feedback.mediaType === 'text-note' ? (
                                            // Nota de texto sin media - mostrar nota directamente
                                            <View style={styles.textNotePreview}>
                                                <Text style={styles.textNoteContent}>"{feedback.athleteNote}"</Text>
                                            </View>
                                        ) : (
                                            <View style={styles.mediaPlaceholder}>
                                                <Ionicons name="document" size={48} color="#4361ee" />
                                                <Text style={styles.mediaPlaceholderText}>Media desconocida</Text>
                                            </View>
                                        )}
                                    </>
                                ) : feedback.mediaType === 'text-note' ? (
                                    // Text-note no necesita mediaUrl, mostrar nota directamente
                                    <View style={styles.textNotePreview}>
                                        <Text style={styles.textNoteContent}>"{feedback.athleteNote}"</Text>
                                    </View>
                                ) : (
                                    <View style={styles.mediaPlaceholder}>
                                        <Ionicons
                                            name={feedback.mediaType === 'photo' ? 'image' : feedback.mediaType === 'audio' ? 'mic' : 'videocam'}
                                            size={48}
                                            color="#4361ee"
                                        />
                                        <Text style={styles.mediaPlaceholderText}>
                                            {feedback.mediaType === 'photo' ? 'Foto no disponible' :
                                                feedback.mediaType === 'audio' ? 'Cargando audio...' :
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
                                sourceMediaKey: feedback?.r2Key || null, // 🆕 Key de R2 para regenerar URL
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
        </Wrapper>
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
    // Media Badges
    mediaBadges: {
        flexDirection: 'row',
        gap: 6,
    },
    mediaBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Athlete Note Section
    athleteNoteSection: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#10b981',
    },
    athleteNoteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    athleteNoteLabel: {
        color: '#10b981',
        fontSize: 12,
        fontWeight: '600',
    },
    athleteNoteText: {
        color: '#e0e0e0',
        fontSize: 14,
        fontStyle: 'italic',
        lineHeight: 20,
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
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4361ee',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    audioPlayBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    // New Audio Controls Layout
    audioControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        marginTop: 12,
    },
    aiIconButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#1a1a2e',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#8b5cf6',
    },
    aiIconButtonActive: {
        backgroundColor: '#8b5cf6',
        borderColor: '#8b5cf6',
    },
    aiIconButtonLoading: {
        backgroundColor: '#8b5cf680',
        borderColor: '#8b5cf680',
    },
    aiIconButtonText: {
        color: '#8b5cf6',
        fontWeight: '700',
        fontSize: 14,
    },
    aiContentInline: {
        marginTop: 16,
        width: '100%',
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#333'
    },
    aiLoadingTextInline: {
        color: '#8b5cf6',
        fontSize: 13,
        textAlign: 'center',
        fontStyle: 'italic'
    },
    aiErrorInline: {
        marginTop: 8,
        padding: 8,
        backgroundColor: '#ef444420',
        borderRadius: 8,
    },
    audioNoteText: {
        color: '#fff',
        fontSize: 15,
        fontStyle: 'italic',
        textAlign: 'center',
        marginBottom: 12,
    },
    // Text Note Preview (for notes without media)
    textNotePreview: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    textNoteLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    textNoteBubble: {
        backgroundColor: '#1a1a2e',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#4361ee30',
        marginTop: 8,
        maxWidth: '100%',
    },
    textNoteContent: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 22,
        fontStyle: 'italic',
    },
    // AI Section
    aiSection: {
        marginTop: 16,
        width: '100%',
        backgroundColor: '#13131f',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#8b5cf640'
    },
    aiHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: '#8b5cf615',
    },
    aiHeaderTitle: {
        color: '#8b5cf6',
        fontSize: 14,
        fontWeight: '700',
    },
    aiContent: {
        padding: 12,
    },
    aiLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        justifyContent: 'center',
        padding: 10
    },
    aiLoadingText: {
        color: '#ccc',
        fontSize: 13
    },
    aiError: {
        alignItems: 'center',
        gap: 8
    },
    aiErrorText: {
        color: '#ef4444',
        fontSize: 13
    },
    aiRetryBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#333',
        borderRadius: 8,
        marginTop: 4
    },
    aiRetryText: {
        color: '#fff',
        fontSize: 12
    },
    aiSummaryCard: {
        backgroundColor: '#1f1f2e',
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
        borderLeftWidth: 3,
        borderLeftColor: '#8b5cf6',
    },
    aiSummaryLabel: {
        color: '#8b5cf6',
        fontSize: 10,
        fontWeight: '900',
        marginBottom: 4,
        textTransform: 'uppercase'
    },
    aiSummaryText: {
        color: '#fff',
        fontSize: 14,
        lineHeight: 20,
    },
    markdownContainer: {
        paddingTop: 4
    },
    aiEmpty: {
        alignItems: 'center',
        gap: 8,
        padding: 8
    },
    aiEmptyText: {
        color: '#666',
        fontSize: 13
    }
});

const markdownStyles = {
    body: { color: '#ccc', fontSize: 14 },
    heading1: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    heading2: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    strong: { color: '#fff', fontWeight: 'bold' },
    list_item: { marginVertical: 4 },
    bullet_list: { marginVertical: 8 },
};
