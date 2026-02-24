/**
 * chat/[conversationId].jsx - Pantalla de Chat Individual
 * Reutiliza lógica similar a FeedbackChatModal pero para conversaciones sociales
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Keyboard,
    Linking,
    Image,
    Modal,
    Alert,
    BackHandler,
    Pressable,
    Dimensions,
} from 'react-native';
import Video from 'react-native-video';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useChatTheme } from '../../../context/ChatThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatAudioPlayer from '../../../src/components/chat/ChatAudioPlayer';
import SignedImage, { getCachedUrl } from '../../../src/components/shared/SignedImage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import ChatAttachmentMenu, { showAttachmentMenuIOS } from '../../../src/components/chat/ChatAttachmentMenu';
import ChatAudioRecorder from '../../../src/components/chat/ChatAudioRecorder';
import ChatDocumentBubble from '../../../src/components/chat/ChatDocumentBubble';
import ChatMessageAudioPlayer from '../../../src/components/chat/ChatMessageAudioPlayer';
import BroadcastModal from '../../../components/BroadcastModal';
// Componentes mejorados para iOS
import {
    EnhancedScrollView as ScrollView,
    EnhancedTouchable as TouchableOpacity,
    EnhancedTextInput as TextInput,
} from '../../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// ═══════════════════════════════════════════════════════════════════════════
// FEEDBACK PREVIEW MODAL (Improved v2)
// ═══════════════════════════════════════════════════════════════════════════
const FeedbackPreviewModal = ({ visible, onClose, data, loading, onRetry }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const insets = useSafeAreaInsets();

    // Determinar qué tipo de media mostrar
    const mediaType = data?.mediaType || 'video';
    const hasNote = data?.athleteNote || data?.note;
    const hasCoachResponse = data?.coachResponse?.text;

    return (
        <Modal
            animationType="slide"
            transparent={false}
            visible={visible}
            onRequestClose={onClose}
            presentationStyle="fullScreen"
        >
            <View style={[styles.previewModalContainer, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.previewModalHeader}>
                    <TouchableOpacity onPress={onClose} style={styles.previewCloseBtn}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.previewHeaderCenter}>
                        <Text style={styles.previewModalTitle} numberOfLines={1}>
                            {loading ? 'Cargando...' : data?.exerciseName || 'Feedback'}
                        </Text>
                        {data?.setNumber && (
                            <View style={styles.previewSerieBadge}>
                                <Text style={styles.previewSerieBadgeText}>Serie {data.setNumber}</Text>
                            </View>
                        )}
                    </View>
                    <View style={{ width: 44 }} />
                </View>

                {/* Content */}
                <ScrollView
                    style={styles.previewScrollContent}
                    contentContainerStyle={styles.previewScrollInner}
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <View style={styles.previewLoading}>
                            <ActivityIndicator size="large" color="#8b5cf6" />
                            <Text style={styles.previewLoadingText}>Cargando contenido...</Text>
                        </View>
                    ) : data ? (
                        <>
                            {/* ═══ Video Display ═══ */}
                            {mediaType === 'video' && data.mediaUrl && (
                                <View style={styles.previewMediaContainer}>
                                    <Video
                                        source={{ uri: data.mediaUrl }}
                                        style={styles.previewVideoFull}
                                        controls={true}
                                        resizeMode="contain"
                                        ignoreSilentSwitch="ignore"
                                        paused={false}
                                        repeat={false}
                                    />
                                </View>
                            )}

                            {/* ═══ Photo Display ═══ */}
                            {mediaType === 'photo' && data.mediaUrl && (
                                <View style={styles.previewMediaContainer}>
                                    <Image
                                        source={{ uri: data.mediaUrl }}
                                        style={styles.previewImageFull}
                                        resizeMode="contain"
                                    />
                                </View>
                            )}

                            {/* ═══ Audio Player (Inline) ═══ */}
                            {mediaType === 'audio' && (
                                <View style={styles.audioPlayerSection}>
                                    <View style={styles.audioPlayerCard}>
                                        {/* Waveform Icon */}
                                        <View style={styles.audioWaveformIcon}>
                                            <Ionicons name="mic" size={28} color="#fff" />
                                        </View>

                                        {/* Player Controls */}
                                        <View style={styles.audioPlayerControls}>
                                            <Text style={styles.audioPlayerTitle}>Audio del atleta</Text>

                                            {/* Progress Bar Placeholder */}
                                            <View style={styles.audioProgressContainer}>
                                                <View style={styles.audioProgressBar}>
                                                    <View style={[styles.audioProgressFill, { width: '0%' }]} />
                                                </View>
                                                <Text style={styles.audioTimeText}>
                                                    0:00 / {data.duration ? `${Math.floor((data.duration / 1000) / 60)}:${String(Math.floor((data.duration / 1000) % 60)).padStart(2, '0')}` : '-:--'}
                                                </Text>
                                            </View>

                                            {/* Control Buttons Row */}
                                            <View style={styles.audioControlsRow}>
                                                {/* Play Button - opens in external player */}
                                                <TouchableOpacity
                                                    style={styles.audioPlayPauseBtn}
                                                    onPress={() => data.mediaUrl && Linking.openURL(data.mediaUrl)}
                                                >
                                                    <Ionicons name="play" size={20} color="#fff" />
                                                    <Text style={styles.audioPlayBtnText}>Reproducir</Text>
                                                </TouchableOpacity>

                                                {/* Speed Indicator */}
                                                <View style={styles.audioSpeedBtn}>
                                                    <Text style={styles.audioSpeedText}>1x</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>

                                    {/* AI Transcription Toggle */}
                                    {(data.transcription || data.summary) && (
                                        <View style={styles.transcriptionSection}>
                                            <View style={styles.transcriptionHeader}>
                                                <Ionicons name="sparkles" size={18} color="#8b5cf6" />
                                                <Text style={styles.transcriptionLabel}>Transcripción IA</Text>
                                            </View>

                                            {data.summary && (
                                                <View style={styles.transcriptionSummary}>
                                                    <Text style={styles.transcriptionSummaryLabel}>RESUMEN</Text>
                                                    <Text style={styles.transcriptionSummaryText}>{data.summary}</Text>
                                                </View>
                                            )}

                                            {data.transcription && (
                                                <View style={styles.transcriptionFull}>
                                                    <Text style={styles.transcriptionFullLabel}>TRANSCRIPCIÓN</Text>
                                                    <Text style={styles.transcriptionFullText}>{data.transcription}</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Pending Transcription */}
                                    {data.transcriptionStatus === 'pending' && (
                                        <View style={styles.transcriptionPending}>
                                            <ActivityIndicator size="small" color="#8b5cf6" />
                                            <Text style={styles.transcriptionPendingText}>
                                                Transcribiendo audio con IA...
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* ═══ Athlete Note ═══ */}
                            {hasNote && (
                                <View style={styles.previewNoteCard}>
                                    <View style={styles.previewNoteHeader}>
                                        <Ionicons name="chatbubble-ellipses" size={18} color="#10b981" />
                                        <Text style={styles.previewNoteLabel}>Nota del atleta</Text>
                                    </View>
                                    <Text style={styles.previewNoteText}>"{hasNote}"</Text>
                                </View>
                            )}

                            {/* ═══ Coach Response (if exists) ═══ */}
                            {hasCoachResponse && (
                                <View style={styles.previewCoachCard}>
                                    <View style={styles.previewNoteHeader}>
                                        <Ionicons name="person" size={18} color="#4361ee" />
                                        <Text style={[styles.previewNoteLabel, { color: '#4361ee' }]}>Respuesta del coach</Text>
                                    </View>
                                    <Text style={styles.previewNoteText}>{hasCoachResponse}</Text>
                                </View>
                            )}

                            {/* ═══ Metadata ═══ */}
                            <View style={styles.previewMetadata}>
                                <View style={styles.previewMetaRow}>
                                    <Ionicons name="time-outline" size={16} color="#64748b" />
                                    <Text style={styles.previewMetaText}>
                                        {data.createdAt ? new Date(data.createdAt).toLocaleDateString('es-ES', {
                                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                        }) : 'Fecha no disponible'}
                                    </Text>
                                </View>
                                <View style={styles.previewMetaRow}>
                                    <Ionicons
                                        name={mediaType === 'video' ? 'videocam' : mediaType === 'photo' ? 'image' : 'mic'}
                                        size={16}
                                        color="#64748b"
                                    />
                                    <Text style={styles.previewMetaText}>
                                        {mediaType === 'video' ? 'Video' : mediaType === 'photo' ? 'Foto' : 'Audio'}
                                    </Text>
                                </View>
                            </View>
                        </>
                    ) : (
                        <View style={styles.previewError}>
                            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
                            <Text style={styles.previewErrorText}>No se pudo cargar el contenido</Text>
                            {onRetry && (
                                <TouchableOpacity style={styles.previewRetryBtn} onPress={onRetry}>
                                    <Ionicons name="refresh" size={20} color="#fff" />
                                    <Text style={styles.previewRetryText}>Reintentar</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </ScrollView>

                {/* Footer - Close Button */}
                <View style={[styles.previewFooter, { paddingBottom: insets.bottom + 16 }]}>
                    <TouchableOpacity style={styles.previewCloseFullBtn} onPress={onClose}>
                        <Text style={styles.previewCloseFullText}>Cerrar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};


// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════════════════════

const MessageBubble = ({ message, isOwn, isTrainerChat, showSender, theme, isDark, fontSize, onPreviewPress, onMediaPress, onComparisonPhotoPress }) => {
    const router = useRouter();
    const getTypeColor = (type) => {
        const colors = {
            entreno: '#8b5cf6',
            nutricion: '#10b981',
            evolucion: '#3b82f6',
            seguimiento: '#f59e0b',
            video_feedback_response: '#4361ee',
            general: theme?.textSecondary || '#64748b'
        };
        return colors[type] || colors.general;
    };

    // Usar propiedades específicas del chatTheme para burbujas
    const bubbleOwnBg = theme?.bubbleOwn || theme?.primary || '#8b5cf6';
    const bubbleOtherBg = theme?.bubbleOther || theme?.cardBackground || '#fff';
    const bubbleOtherBorder = theme?.border || '#e2e8f0';
    const textOwn = theme?.bubbleOwnText || '#fff';
    const textOther = theme?.bubbleOtherText || theme?.text || '#1e293b';
    const timeOwn = 'rgba(255,255,255,0.7)';
    const timeOther = theme?.textSecondary || '#94a3b8';

    // Detectar si es respuesta a video feedback
    const isVideoResponse = message.type === 'video_feedback_response';

    // Extraer YouTube link del mensaje si existe
    const extractYouTubeLink = (text) => {
        if (!text) return null;
        const match = text.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+)/);
        return match ? match[1] : null;
    };

    const youtubeLink = extractYouTubeLink(message.message);

    // Limpiar mensaje: quitar YouTube links y placeholders de media
    let cleanMessage = youtubeLink
        ? message.message.replace(/📺.*$/s, '').trim()
        : (message.message || '');
    // Strip media placeholders ([image], [audio], [video], [document])
    cleanMessage = cleanMessage.replace(/^\[(image|audio|video|document)\]$/i, '').trim();

    return (
        <View style={[
            styles.messageBubble,
            isOwn
                ? [styles.messageBubbleOwn, { backgroundColor: bubbleOwnBg }]
                : [styles.messageBubbleOther, { backgroundColor: bubbleOtherBg, borderColor: bubbleOtherBorder }]
        ]}>
            {/* Sender name for groups */}
            {showSender && !isOwn && (
                <Text style={[styles.senderName, { color: theme?.primary || '#8b5cf6' }]}>
                    {message.senderId?.nombre || 'Usuario'}
                </Text>
            )}

            {/* 📊 Comparison Card */}
            {message.metadata?.isComparison && message.metadata?.compareData && (
                <Pressable
                    style={({ pressed }) => [styles.comparisonCard, pressed && { opacity: 0.8 }]}
                    onPress={() => onComparisonPhotoPress?.(message.metadata.compareData)}
                >
                    <View style={styles.comparisonHeader}>
                        <Ionicons name="git-compare" size={14} color="#0ea5e9" />
                        <Text style={styles.comparisonTitle}>Comparativa de progreso</Text>
                        {message.metadata.compareData.delta && (
                            <View style={styles.comparisonDeltaBadge}>
                                <Text style={styles.comparisonDeltaText}>{message.metadata.compareData.delta}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.comparisonPhotos}>
                        <View style={styles.comparisonPhotoCol}>
                            <Text style={styles.comparisonLabel}>Antes</Text>
                            <SignedImage
                                r2Key={message.metadata.compareData.olderPhotoKey}
                                fallbackUrl={message.metadata.compareData.olderPhotoUrl}
                                style={styles.comparisonPhotoImg}
                            />
                            <Text style={styles.comparisonDate}>
                                {new Date(message.metadata.compareData.olderDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                            </Text>
                        </View>
                        <View style={styles.comparisonArrow}>
                            <Ionicons name="arrow-forward" size={16} color={isOwn ? 'rgba(255,255,255,0.5)' : '#94a3b8'} />
                        </View>
                        <View style={styles.comparisonPhotoCol}>
                            <Text style={styles.comparisonLabel}>Después</Text>
                            <SignedImage
                                r2Key={message.metadata.compareData.newerPhotoKey}
                                fallbackUrl={message.metadata.compareData.newerPhotoUrl}
                                style={styles.comparisonPhotoImg}
                            />
                            <Text style={styles.comparisonDate}>
                                {new Date(message.metadata.compareData.newerDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.comparisonTapHint}>
                        <Ionicons name="expand-outline" size={12} color="#0ea5e9" />
                        <Text style={styles.comparisonTapHintText}>Pulsa para ampliar</Text>
                    </View>
                </Pressable>
            )}

            {/* 📹 Video/Photo Feedback Response - Opens Modal */}
            {(isVideoResponse || message.metadata?.isVideoFeedbackResponse) &&
                message.metadata?.originalMediaType !== 'audio' && (
                    <TouchableOpacity
                        style={styles.feedbackQuoteCard}
                        activeOpacity={0.8}
                        onPress={() => {
                            console.log('[Chat] Quote pressed:', message.metadata);
                            const refId = message.referenceId || message.metadata?.referenceId || message.metadata?.feedbackId;
                            if (onPreviewPress && refId) {
                                onPreviewPress(refId);
                            } else {
                                console.warn('[Chat] No preview handler or reference ID');
                            }
                        }}
                    >
                        {/* Preview Thumbnail / Fallback Icon */}
                        <View style={styles.feedbackQuotePreview}>
                            {message.metadata?.originalThumbnail ? (
                                <Image
                                    source={{ uri: message.metadata.originalThumbnail }}
                                    style={styles.feedbackQuoteThumbnail}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={styles.feedbackQuoteIconBg}>
                                    <Ionicons
                                        name={
                                            message.metadata?.originalMediaType === 'video' ? 'videocam' :
                                                message.metadata?.originalMediaType === 'photo' ? 'image' : 'document-text'
                                        }
                                        size={24}
                                        color="#fff"
                                    />
                                </View>
                            )}
                            {/* Play overlay for video */}
                            {message.metadata?.originalMediaType === 'video' && (
                                <View style={styles.feedbackQuotePlayOverlay}>
                                    <Ionicons name="play" size={16} color="#fff" />
                                </View>
                            )}
                        </View>

                        {/* Info Text */}
                        <View style={styles.feedbackQuoteInfo}>
                            <Text style={styles.feedbackQuoteTitle} numberOfLines={1}>
                                {message.metadata?.exerciseName || 'Feedback'}
                            </Text>
                            <View style={styles.feedbackQuoteMeta}>
                                <Text style={styles.feedbackQuoteSubtext}>
                                    Serie {message.metadata?.setNumber || 1}
                                </Text>
                                <View style={styles.feedbackQuoteDot} />
                                <Text style={styles.feedbackQuoteTap}>Ver contenido</Text>
                            </View>
                        </View>

                        <Ionicons name="chevron-forward" size={18} color="#4361ee" />
                    </TouchableOpacity>
                )}

            {/* 🎙️ Audio Feedback - WhatsApp-style Inline Player */}
            {(isVideoResponse || message.metadata?.isVideoFeedbackResponse) &&
                message.metadata?.originalMediaType === 'audio' && (
                    <ChatAudioPlayer
                        feedbackId={message.referenceId || message.metadata?.referenceId || message.metadata?.feedbackId}
                        exerciseName={message.metadata?.exerciseName}
                        setNumber={message.metadata?.setNumber}
                    />
                )}

            {/* Inline Media Attachment (WhatsApp-style) */}
            {message.mediaUrl && message.mediaType && (
                <>
                    {(message.mediaType === 'image' || message.mediaType === 'video') && (
                        <TouchableOpacity
                            style={styles.chatMediaContainer}
                            activeOpacity={0.9}
                            onPress={() => {
                                if (onMediaPress) {
                                    onMediaPress({
                                        mediaUrl: message.mediaUrl,
                                        mediaType: message.mediaType,
                                    });
                                }
                            }}
                        >
                            {message.mediaType === 'image' && (
                                <SignedImage
                                    r2Key={message.mediaUrl}
                                    style={styles.chatMediaImage}
                                />
                            )}
                            {message.mediaType === 'video' && (
                                <View style={styles.chatMediaVideo}>
                                    <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                                    <Text style={styles.chatMediaVideoLabel}>Video</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                    {message.mediaType === 'audio' && (
                        <ChatMessageAudioPlayer
                            r2Key={message.mediaUrl}
                            duration={message.duration}
                            isOwn={isOwn}
                        />
                    )}
                    {message.mediaType === 'document' && (
                        <ChatDocumentBubble
                            r2Key={message.mediaUrl}
                            fileName={message.fileName}
                            isOwn={isOwn}
                        />
                    )}
                </>
            )}

            {/* Type badge for trainer chat (not for video_feedback_response) */}
            {isTrainerChat && message.type !== 'general' && !isVideoResponse && (
                <View style={[styles.typeBadge, { backgroundColor: getTypeColor(message.type) + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: getTypeColor(message.type) }]}>
                        {message.type.charAt(0).toUpperCase() + message.type.slice(1)}
                    </Text>
                </View>
            )}

            {cleanMessage ? (
                <Text style={[
                    styles.messageText,
                    { color: isOwn ? textOwn : textOther, fontSize: fontSize || 15 }
                ]}>
                    {cleanMessage}
                </Text>
            ) : null}

            {/* YouTube Link - Rendered as tappable card */}
            {youtubeLink && (
                <TouchableOpacity
                    style={styles.youtubeCard}
                    onPress={() => Linking.openURL(youtubeLink)}
                >
                    <Ionicons name="logo-youtube" size={20} color="#ef4444" />
                    <Text style={styles.youtubeCardText} numberOfLines={1}>
                        Ver video de ejemplo
                    </Text>
                    <Ionicons name="open-outline" size={16} color="#64748b" />
                </TouchableOpacity>
            )}

            <Text style={[
                styles.messageTime,
                { color: isOwn ? timeOwn : timeOther }
            ]}>
                {new Date(message.createdAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit'
                })}
            </Text>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function ConversationScreen() {
    const router = useRouter();
    const { conversationId, displayName, displayImage, isTrainerChat, type } = useLocalSearchParams();
    const { token, user } = useAuth();
    const { chatTheme, fontSizeValue } = useChatTheme();
    const isDark = chatTheme.isDark;
    const insets = useSafeAreaInsets();
    const flatListRef = useRef(null);

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [messageType, setMessageType] = useState('general');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Media Attachment States
    const [attachment, setAttachment] = useState(null); // { uri, type: 'image'|'video'|'audio'|'document', fileName, mimeType? }
    const [uploading, setUploading] = useState(false);
    const [attachMenuVisible, setAttachMenuVisible] = useState(false);
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);

    const isTrainer = isTrainerChat === 'true';
    const isGroup = type === 'group';

    // Category tabs configuration
    const CATEGORY_TABS = [
        { key: 'all', label: 'Todo', icon: 'chatbubbles-outline', color: '#64748b' },
        { key: 'general', label: 'General', icon: 'chatbubble-outline', color: '#64748b' },
        { key: 'entreno', label: 'Entreno', icon: 'barbell-outline', color: '#8b5cf6' },
        { key: 'nutricion', label: 'Nutrición', icon: 'nutrition-outline', color: '#10b981' },
        { key: 'evolucion', label: 'Evolución', icon: 'analytics-outline', color: '#3b82f6' },
        { key: 'seguimiento', label: 'Seguimiento', icon: 'calendar-outline', color: '#f59e0b' }
    ];

    // Filter messages by selected category (memoized to avoid array copies on every render)
    const filteredMessages = useMemo(() => {
        const filtered = selectedCategory === 'all'
            ? messages
            : messages.filter(m => m.type === selectedCategory);
        // Pre-reverse for inverted FlatList (single copy instead of per-render)
        return [...filtered].reverse();
    }, [messages, selectedCategory]);

    // 🆕 Preview Logic
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // 🆕 Fullscreen Media Modal (images/videos)
    const [mediaModalVisible, setMediaModalVisible] = useState(false);
    const [mediaModalData, setMediaModalData] = useState(null); // { mediaUrl, mediaType, signedUrl }

    // 📊 Comparison fullscreen modal
    const [comparisonModalVisible, setComparisonModalVisible] = useState(false);
    const [comparisonModalData, setComparisonModalData] = useState(null); // { olderPhotoUrl, newerPhotoUrl, olderDate, newerDate, delta }

    const handleMediaPress = async (data) => {
        try {
            // If mediaUrl is already a full URL (legacy messages), use directly
            if (data.mediaUrl && data.mediaUrl.startsWith('http')) {
                setMediaModalData({
                    mediaUrl: data.mediaUrl,
                    mediaType: data.mediaType,
                    signedUrl: data.mediaUrl
                });
                setMediaModalVisible(true);
                return;
            }

            // Check SignedImage cache first (avoids duplicate API call)
            const cached = getCachedUrl(data.mediaUrl);
            if (cached) {
                setMediaModalData({
                    mediaUrl: data.mediaUrl,
                    mediaType: data.mediaType,
                    signedUrl: cached
                });
                setMediaModalVisible(true);
                return;
            }

            // Fetch signed URL from R2 key (uses token from useAuth closure)
            const res = await fetch(`${API_URL}/api/chat/media-url`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ key: data.mediaUrl })
            });
            const result = await res.json();
            if (result.success) {
                setMediaModalData({
                    mediaUrl: data.mediaUrl,
                    mediaType: data.mediaType,
                    signedUrl: result.url
                });
                setMediaModalVisible(true);
            } else {
                Alert.alert('Error', 'No se pudo cargar el contenido');
            }
        } catch (err) {
            console.error('[Chat] Error opening media:', err);
            Alert.alert('Error', 'No se pudo abrir el contenido');
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 🆕 MEDIA PICKER FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    // Pick from gallery (+ button)
    const pickFromGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                quality: 0.8,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                setAttachment({
                    uri: asset.uri,
                    type: asset.type === 'video' ? 'video' : 'image',
                    fileName: asset.fileName || `${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
                    width: asset.width,
                    height: asset.height,
                    duration: asset.duration
                });
            }
        } catch (error) {
            console.error('[Chat] Gallery picker error:', error);
            Alert.alert('Error', 'No se pudo abrir la galería');
        }
    };

    // Launch camera directly (📷 button)
    const launchCamera = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                quality: 0.8,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                setAttachment({
                    uri: asset.uri,
                    type: asset.type === 'video' ? 'video' : 'image',
                    fileName: asset.fileName || `${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
                    width: asset.width,
                    height: asset.height,
                    duration: asset.duration
                });
            }
        } catch (error) {
            console.error('[Chat] Camera error:', error);
            Alert.alert('Error', 'No se pudo abrir la cámara');
        }
    };

    // Upload media to R2 and get key
    const uploadMedia = async (mediaUri, mediaType, fileName, mimeType) => {
        try {
            // Determine contentType based on mediaType
            let contentType;
            if (mediaType === 'video') contentType = 'video/mp4';
            else if (mediaType === 'image') contentType = 'image/jpeg';
            else if (mediaType === 'audio') contentType = mimeType || 'audio/m4a';
            else if (mediaType === 'document') contentType = mimeType || 'application/pdf';
            else contentType = 'application/octet-stream';

            // 1. Get presigned upload URL
            const urlRes = await fetch(`${API_URL}/api/chat/upload-url`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileName,
                    contentType,
                    conversationId
                })
            });

            const urlData = await urlRes.json();
            if (!urlData.success) throw new Error(urlData.message);

            // 2. Upload file to R2
            const fileResponse = await fetch(mediaUri);
            const blob = await fileResponse.blob();

            const uploadRes = await fetch(urlData.uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: {
                    'Content-Type': contentType
                }
            });

            if (!uploadRes.ok) {
                throw new Error(`R2 upload failed: ${uploadRes.status}`);
            }

            return urlData.key;
        } catch (error) {
            console.error('[Chat] Upload error:', error);
            throw error;
        }
    };

    // Pick document (PDF, DOC, XLS, TXT, etc.)
    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/plain',
                ],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                setAttachment({
                    uri: asset.uri,
                    type: 'document',
                    fileName: asset.name || `document_${Date.now()}.pdf`,
                    mimeType: asset.mimeType || 'application/pdf',
                    fileSize: asset.size,
                });
            }
        } catch (error) {
            console.error('[Chat] Document picker error:', error);
            Alert.alert('Error', 'No se pudo seleccionar el archivo');
        }
    };

    // Attachment menu handler
    const showAttachmentMenu = () => {
        if (Platform.OS === 'ios') {
            showAttachmentMenuIOS({
                onCamera: launchCamera,
                onGallery: pickFromGallery,
                onDocument: pickDocument,
            });
        } else {
            setAttachMenuVisible(true);
        }
    };

    // Auto-send voice messages (WhatsApp-style)
    useEffect(() => {
        if (attachment?._autoSend) {
            handleSend();
        }
    }, [attachment]);

    // Clear attachment
    const clearAttachment = () => {
        setAttachment(null);
    };

    const handlePreviewFeedback = async (feedbackId) => {
        if (!feedbackId) return;
        try {
            setLoadingPreview(true);
            setPreviewModalVisible(true);
            setPreviewData(null);

            console.log('[Chat] Loading preview for:', feedbackId);
            const response = await fetch(`${API_URL}/api/video-feedback/${feedbackId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                setPreviewData(data);
            } else {
                console.error('[Preview] Error:', data.error);
                // Could retry or show error
            }
        } catch (error) {
            console.error('[Preview] Request error:', error);
        } finally {
            setLoadingPreview(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD MESSAGES
    // ─────────────────────────────────────────────────────────────────────────

    const loadMessages = useCallback(async () => {
        console.log('[Chat] loadMessages called for conversation:', conversationId);
        try {
            setLoading(true);
            const url = `${API_URL}/api/conversations/${conversationId}/messages?limit=100`;
            console.log('[Chat] Fetching:', url);

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            console.log('[Chat] loadMessages response:', data.success, 'messages:', data.messages?.length);

            if (data.success) {
                setMessages(data.messages || []);
                console.log('[Chat] Messages state updated to:', data.messages?.length);
            } else {
                console.error('[Chat] loadMessages failed:', data.message);
            }
        } catch (error) {
            console.error('[Chat] loadMessages Error:', error);
        } finally {
            setLoading(false);
        }
    }, [conversationId, token]);

    useEffect(() => {
        console.log('[Chat] Initial useEffect triggered');
        loadMessages();
    }, [loadMessages]);

    // ─────────────────────────────────────────────────────────────────────────
    // ANDROID BACK HANDLER - Navigate back to chat list instead of exiting
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            router.back();
            return true;
        });

        return () => backHandler.remove();
    }, [router]);

    // Con inverted=true, el scroll al último mensaje es automático
    // No se necesita scrollToEnd manual

    // ─────────────────────────────────────────────────────────────────────────
    // ADAPTIVE POLLING - Reduces server load by 70-80%
    // ─────────────────────────────────────────────────────────────────────────

    const lastActivityRef = useRef(Date.now());
    const lastModifiedRef = useRef(null);
    const isBackgroundRef = useRef(false);

    // Track user activity
    const updateActivity = useCallback(() => {
        lastActivityRef.current = Date.now();
    }, []);

    // Get adaptive poll interval based on user activity
    const getPollInterval = useCallback(() => {
        if (isBackgroundRef.current) return 60000; // 60s in background

        const idleTime = Date.now() - lastActivityRef.current;
        if (idleTime > 60000) return 10000; // 10s after 1 min idle
        return 2000; // 2s when active
    }, []);

    // Adaptive polling for real-time messages
    useEffect(() => {
        let pollTimeoutId = null;

        const poll = async () => {
            try {
                const headers = { Authorization: `Bearer ${token}` };

                // Add If-Modified-Since header for 304 optimization
                if (lastModifiedRef.current) {
                    headers['If-Modified-Since'] = lastModifiedRef.current;
                }

                const res = await fetch(
                    `${API_URL}/api/conversations/${conversationId}/messages?limit=100`,
                    { headers }
                );

                // Handle 304 Not Modified - no new messages
                if (res.status === 304) {
                    pollTimeoutId = setTimeout(poll, getPollInterval());
                    return;
                }

                // Store Last-Modified header for next request
                const lastModified = res.headers.get('Last-Modified');
                if (lastModified) {
                    lastModifiedRef.current = lastModified;
                }

                const data = await res.json();

                if (data.success && data.messages) {
                    // Deduplicar mensajes por _id para evitar keys duplicadas
                    const uniqueMessages = data.messages.reduce((acc, msg) => {
                        if (msg._id && !acc.find(m => m._id === msg._id)) {
                            acc.push(msg);
                        }
                        return acc;
                    }, []);

                    const newCount = uniqueMessages.length;
                    const lastNewId = newCount > 0 ? uniqueMessages[newCount - 1]?._id : '';

                    setMessages(currentMessages => {
                        const currentCount = currentMessages.length;
                        const lastCurrentId = currentCount > 0 ? currentMessages[currentCount - 1]?._id : '';

                        // Actualizar si hay diferencia en cantidad o en el último mensaje
                        if (newCount !== currentCount || lastNewId !== lastCurrentId) {
                            console.log('[Chat] ✅ Actualizando de', currentCount, 'a', newCount);
                            // Cap a 150 mensajes para evitar WatchdogTermination por RAM
                            const capped = uniqueMessages.length > 150 ? uniqueMessages.slice(-150) : uniqueMessages;
                            return capped;
                        }
                        return currentMessages;
                    });
                }
            } catch (error) {
                console.error('[Chat Polling] Error:', error);
            }

            // Schedule next poll with adaptive interval
            pollTimeoutId = setTimeout(poll, getPollInterval());
        };

        // Start polling
        pollTimeoutId = setTimeout(poll, getPollInterval());

        return () => {
            if (pollTimeoutId) clearTimeout(pollTimeoutId);
        };
    }, [conversationId, token, getPollInterval]);

    // ─────────────────────────────────────────────────────────────────────────
    // SEND MESSAGE
    // ─────────────────────────────────────────────────────────────────────────

    const handleSend = async () => {
        // Allow send if there's text OR attachment
        if ((!newMessage.trim() && !attachment) || sending) return;

        Keyboard.dismiss();
        setSending(true);

        try {
            let mediaUrl = null;
            let mediaType = null;
            let fileName = null;
            let duration = null;

            // Upload attachment first if present
            if (attachment) {
                setUploading(true);
                try {
                    mediaUrl = await uploadMedia(attachment.uri, attachment.type, attachment.fileName, attachment.mimeType);
                    mediaType = attachment.type;
                    fileName = attachment.fileName;
                    duration = attachment.duration || null;
                } catch (uploadError) {
                    console.error('[Chat] Upload failed:', uploadError);
                    Alert.alert('Error', 'No se pudo subir el archivo');
                    setSending(false);
                    setUploading(false);
                    return;
                }
                setUploading(false);
            }

            const res = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: newMessage.trim() || '',
                    type: isTrainer ? messageType : 'general',
                    mediaUrl,
                    mediaType,
                    fileName,
                    duration
                })
            });

            const data = await res.json();

            if (data.success) {
                setMessages(prev => {
                    const updated = [...prev, data.message];
                    return updated.length > 150 ? updated.slice(-150) : updated;
                });
                setNewMessage('');
                setMessageType('general');
                setAttachment(null); // Clear attachment
            }
        } catch (error) {
            console.error('[ConversationScreen] Error sending:', error);
            Alert.alert('Error', 'No se pudo enviar el mensaje');
        } finally {
            setSending(false);
            setUploading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: chatTheme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: chatTheme.cardBackground, borderBottomColor: chatTheme.border }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={chatTheme.text} />
                </TouchableOpacity>

                {/* Avatar */}
                <View style={[styles.headerAvatar, { backgroundColor: chatTheme.textTertiary, overflow: 'hidden' }]}>
                    {displayImage ? (
                        <Image
                            source={{ uri: displayImage }}
                            style={{ width: '100%', height: '100%', borderRadius: 18 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <Text style={styles.headerAvatarText}>
                            {displayName?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                    )}
                </View>

                <View style={styles.headerInfo}>
                    <Text style={[styles.headerTitle, { color: chatTheme.text }]} numberOfLines={1}>
                        {displayName || 'Chat'}
                    </Text>
                    {isTrainer && (
                        <View style={[styles.coachBadge, { backgroundColor: chatTheme.primary + '20' }]}>
                            <Text style={[styles.coachBadgeText, { color: chatTheme.primary }]}>Coach</Text>
                        </View>
                    )}
                    {isGroup && (
                        <View style={[styles.groupBadge, { backgroundColor: chatTheme.header + '20' }]}>
                            <Text style={[styles.groupBadgeText, { color: chatTheme.header }]}>Grupo</Text>
                        </View>
                    )}
                </View>

                {isTrainer && (
                    <TouchableOpacity
                        style={styles.broadcastBtn}
                        onPress={() => setBroadcastModalVisible(true)}
                    >
                        <Ionicons name="megaphone" size={18} color={chatTheme.primary} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.moreBtn}>
                    <Ionicons name="ellipsis-vertical" size={20} color={chatTheme.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* KeyboardAvoidingView envuelve Messages + Input para que todo suba con el teclado */}
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Messages */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={chatTheme.primary} />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={filteredMessages}
                        inverted={true}
                        keyExtractor={(item, idx) => item._id || `msg-${idx}`}
                        renderItem={({ item }) => (
                            <MessageBubble
                                message={item}
                                isOwn={item.senderId?._id === user?._id || item.senderId === user?._id}
                                isTrainerChat={isTrainer}
                                showSender={isGroup}
                                theme={chatTheme}
                                isDark={isDark}
                                fontSize={fontSizeValue}
                                onPreviewPress={handlePreviewFeedback}

                                onMediaPress={handleMediaPress}
                                onComparisonPhotoPress={(compareData) => {
                                    setComparisonModalData(compareData);
                                    setComparisonModalVisible(true);
                                }}
                            />
                        )}
                        contentContainerStyle={styles.messagesList}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        removeClippedSubviews={true}
                        maxToRenderPerBatch={10}
                        windowSize={10}
                        initialNumToRender={20}
                        ListEmptyComponent={
                            <View style={styles.emptyMessages}>
                                <Ionicons name="chatbubble-ellipses-outline" size={48} color={chatTheme.textTertiary} />
                                <Text style={[styles.emptyText, { color: chatTheme.textSecondary }]}>
                                    {selectedCategory === 'all'
                                        ? 'Inicia la conversación'
                                        : `Sin mensajes de ${CATEGORY_TABS.find(t => t.key === selectedCategory)?.label || selectedCategory}`
                                    }
                                </Text>
                            </View>
                        }
                    />
                )}

                {/* Input Area */}
                {/* Category Selector (filters view + sets message type) */}
                {isTrainer && (
                    <View style={[styles.typeSelector, { backgroundColor: chatTheme.cardBackground, borderTopColor: chatTheme.border }]}>
                        {[
                            { type: 'all', icon: 'apps-outline', color: '#64748b', label: 'Todo' },
                            { type: 'general', icon: 'chatbubble-outline', color: '#64748b', label: 'General' },
                            { type: 'entreno', icon: 'barbell-outline', color: '#8b5cf6', label: 'Entreno' },
                            { type: 'nutricion', icon: 'nutrition-outline', color: '#10b981', label: 'Nutrición' },
                            { type: 'evolucion', icon: 'analytics-outline', color: '#3b82f6', label: 'Evolución' },
                            { type: 'seguimiento', icon: 'calendar-outline', color: '#f59e0b', label: 'Seguim.' }
                        ].map(({ type: t, icon, color, label }) => {
                            const isActive = selectedCategory === t;
                            return (
                                <TouchableOpacity
                                    key={t}
                                    style={[
                                        styles.typeBtn,
                                        { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9' },
                                        isActive && { backgroundColor: color + '20', borderColor: color, borderWidth: 2 }
                                    ]}
                                    onPress={() => {
                                        setSelectedCategory(t);
                                        // When selecting a category, also set message type (except 'all')
                                        if (t !== 'all') setMessageType(t);
                                    }}
                                >
                                    <Ionicons
                                        name={icon}
                                        size={18}
                                        color={isActive ? color : chatTheme.textSecondary}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Attachment Preview */}
                {attachment && (
                    <View style={[styles.attachmentPreview, { backgroundColor: chatTheme.cardBackground }]}>
                        {attachment.type === 'image' ? (
                            <Image source={{ uri: attachment.uri }} style={styles.attachmentThumb} />
                        ) : attachment.type === 'document' ? (
                            <View style={[styles.attachmentThumb, styles.documentThumb]}>
                                <Ionicons name="document-text" size={24} color="#fff" />
                            </View>
                        ) : attachment.type === 'audio' ? (
                            <View style={[styles.attachmentThumb, styles.audioThumb]}>
                                <Ionicons name="mic" size={24} color="#fff" />
                            </View>
                        ) : (
                            <View style={[styles.attachmentThumb, styles.videoThumb]}>
                                <Ionicons name="videocam" size={24} color="#fff" />
                            </View>
                        )}
                        <Text style={[styles.attachmentName, { color: chatTheme.text }]} numberOfLines={1}>
                            {attachment.fileName}
                        </Text>
                        <TouchableOpacity onPress={clearAttachment} style={styles.attachmentRemove}>
                            <Ionicons name="close-circle" size={24} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Input Bar */}
                {isRecordingAudio ? (
                    <ChatAudioRecorder
                        theme={chatTheme}
                        insets={insets}
                        onRecordingComplete={(uri, durationMs) => {
                            setIsRecordingAudio(false);
                            setAttachment({
                                uri,
                                type: 'audio',
                                fileName: `voice_${Date.now()}.m4a`,
                                mimeType: 'audio/m4a',
                                duration: durationMs,
                                _autoSend: true,
                            });
                        }}
                        onCancel={() => setIsRecordingAudio(false)}
                    />
                ) : (
                    <View style={[styles.inputContainer, {
                        backgroundColor: chatTheme.cardBackground,
                        borderTopColor: chatTheme.border,
                        paddingBottom: Math.max(insets.bottom, 12)
                    }]}>
                        {/* [+] Attachment Menu Button */}
                        <TouchableOpacity
                            style={styles.mediaBtn}
                            onPress={showAttachmentMenu}
                            disabled={sending}
                        >
                            <Ionicons name="add" size={26} color={chatTheme.primary} />
                        </TouchableOpacity>

                        {/* Text Input */}
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: chatTheme.inputBackground,
                                color: chatTheme.text
                            }]}
                            value={newMessage}
                            onChangeText={setNewMessage}
                            placeholder="Escribe un mensaje..."
                            placeholderTextColor={chatTheme.textTertiary}
                            multiline
                            maxLength={2000}
                            blurOnSubmit={false}
                            autoCorrect={true}
                            autoCapitalize="sentences"
                            returnKeyType="default"
                            textAlignVertical="center"
                            onKeyPress={(e) => {
                                if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />

                        {/* Right button: Mic (no text) OR Send (with text/attachment) */}
                        {(newMessage.trim() || attachment) ? (
                            <TouchableOpacity
                                style={[styles.sendBtn, { backgroundColor: chatTheme.primary }]}
                                onPress={handleSend}
                                disabled={sending || uploading}
                            >
                                {(sending || uploading) ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="send" size={20} color="#fff" />
                                )}
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.mediaBtn}
                                onPress={() => setIsRecordingAudio(true)}
                                disabled={sending}
                            >
                                <Ionicons name="mic-outline" size={24} color={chatTheme.primary} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Android Attachment Menu */}
                <ChatAttachmentMenu
                    visible={attachMenuVisible}
                    onClose={() => setAttachMenuVisible(false)}
                    onCamera={launchCamera}
                    onGallery={pickFromGallery}
                    onDocument={pickDocument}
                />
            </KeyboardAvoidingView>

            {/* 🆕 Preview Modal */}
            <FeedbackPreviewModal
                visible={previewModalVisible}
                onClose={() => setPreviewModalVisible(false)}
                data={previewData}
                loading={loadingPreview}
                onRetry={() => previewData?._id && handlePreviewFeedback(previewData._id)}
            />

            {/* 🆕 Fullscreen Media Modal (Images/Videos) */}
            <Modal
                visible={mediaModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setMediaModalVisible(false)}
            >
                <View style={styles.fullscreenMediaModal}>
                    {/* Close Button */}
                    <TouchableOpacity
                        style={styles.fullscreenCloseBtn}
                        onPress={() => setMediaModalVisible(false)}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>

                    {/* Media Content */}
                    {mediaModalData?.mediaType === 'image' && mediaModalData?.signedUrl && (
                        <Image
                            source={{ uri: mediaModalData.signedUrl }}
                            style={styles.fullscreenImage}
                            resizeMode="contain"
                            onError={() => {
                                Alert.alert('Error', 'No se pudo cargar la imagen. Inténtalo de nuevo.');
                                setMediaModalVisible(false);
                            }}
                        />
                    )}
                    {mediaModalData?.mediaType === 'video' && mediaModalData?.signedUrl && (
                        <Video
                            source={{ uri: mediaModalData.signedUrl }}
                            style={styles.fullscreenVideo}
                            controls={true}
                            resizeMode="contain"
                            repeat={false}
                        />
                    )}
                </View>
            </Modal>

            {/* 📊 Fullscreen Comparison Modal */}
            <Modal
                visible={comparisonModalVisible}
                transparent={false}
                animationType="fade"
                onRequestClose={() => setComparisonModalVisible(false)}
                presentationStyle="fullScreen"
            >
                <View style={styles.comparisonModalBg}>
                    {/* Close Button */}
                    <Pressable
                        style={styles.comparisonModalClose}
                        onPress={() => setComparisonModalVisible(false)}
                        hitSlop={16}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </Pressable>

                    {comparisonModalData && (() => {
                        const screenW = Dimensions.get('window').width;
                        const photoW = (screenW - 24) / 2; // 8px padding each side + 8px gap
                        const photoH = photoW * (4 / 3);
                        return (
                            <View style={styles.comparisonModalContent}>
                                {/* Delta badge */}
                                {comparisonModalData.delta && (
                                    <View style={styles.comparisonFullDeltaBadge}>
                                        <Ionicons name="time-outline" size={14} color="#0ea5e9" />
                                        <Text style={styles.comparisonFullDeltaText}>{comparisonModalData.delta}</Text>
                                    </View>
                                )}

                                {/* Photos side by side - edge to edge */}
                                <View style={styles.comparisonFullPhotos}>
                                    {/* Antes */}
                                    <View style={styles.comparisonFullCol}>
                                        <Text style={styles.comparisonFullLabel}>Antes</Text>
                                        <SignedImage
                                            r2Key={comparisonModalData.olderPhotoKey}
                                            fallbackUrl={comparisonModalData.olderPhotoUrl}
                                            style={{ width: photoW, height: photoH, borderRadius: 10, backgroundColor: '#1a1a1f' }}
                                        />
                                        <Text style={styles.comparisonFullDate}>
                                            {new Date(comparisonModalData.olderDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </Text>
                                    </View>

                                    {/* Después */}
                                    <View style={styles.comparisonFullCol}>
                                        <Text style={styles.comparisonFullLabel}>Después</Text>
                                        <SignedImage
                                            r2Key={comparisonModalData.newerPhotoKey}
                                            fallbackUrl={comparisonModalData.newerPhotoUrl}
                                            style={{ width: photoW, height: photoH, borderRadius: 10, backgroundColor: '#1a1a1f' }}
                                        />
                                        <Text style={styles.comparisonFullDate}>
                                            {new Date(comparisonModalData.newerDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </Text>
                                    </View>

                                    {/* Arrow overlay centered between photos */}
                                    <View style={styles.comparisonFullArrowOverlay}>
                                        <View style={styles.comparisonFullArrowCircle}>
                                            <Ionicons name="arrow-forward" size={18} color="#fff" />
                                        </View>
                                    </View>
                                </View>

                                {/* Note if exists */}
                                {comparisonModalData.note ? (
                                    <Text style={styles.comparisonFullNote}>{comparisonModalData.note}</Text>
                                ) : null}
                            </View>
                        );
                    })()}
                </View>
            </Modal>

            {/* Broadcast Modal (trainer only) */}
            <BroadcastModal
                visible={broadcastModalVisible}
                onClose={() => setBroadcastModalVisible(false)}
            />
        </SafeAreaView >
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },

    // 🆕 Preview Modal Styles (Fullscreen v2)
    previewModalContainer: {
        flex: 1,
        backgroundColor: '#0a0a14'
    },
    previewModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a2e'
    },
    previewCloseBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center'
    },
    previewHeaderCenter: {
        flex: 1,
        alignItems: 'center',
        gap: 6
    },
    previewModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff'
    },
    previewSerieBadge: {
        backgroundColor: '#8b5cf6',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12
    },
    previewSerieBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600'
    },
    previewScrollContent: {
        flex: 1
    },
    previewScrollInner: {
        paddingBottom: 20
    },
    previewLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80
    },
    previewLoadingText: {
        color: '#888',
        marginTop: 12,
        fontSize: 14
    },
    previewMediaContainer: {
        width: '100%',
        backgroundColor: '#000',
        aspectRatio: 9 / 16,
        maxHeight: 500
    },
    previewVideoFull: {
        width: '100%',
        height: '100%'
    },
    previewImageFull: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000'
    },
    previewAudioContainer: {
        margin: 16,
        backgroundColor: '#1a1a2e',
        borderRadius: 16,
        padding: 16,
        gap: 12
    },
    previewAudioPlayer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16
    },
    previewAudioPlayBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    previewAudioInfo: {
        flex: 1
    },
    previewAudioTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    },
    previewAudioSubtitle: {
        color: '#888',
        fontSize: 13,
        marginTop: 4
    },
    previewAudioOpenBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#333'
    },
    previewAudioOpenText: {
        color: '#8b5cf6',
        fontSize: 14
    },
    previewNoteCard: {
        margin: 16,
        marginTop: 8,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#10b981'
    },
    previewNoteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    previewNoteLabel: {
        color: '#10b981',
        fontSize: 13,
        fontWeight: '600'
    },
    previewNoteText: {
        color: '#e0e0e0',
        fontSize: 15,
        fontStyle: 'italic',
        lineHeight: 22
    },
    previewCoachCard: {
        margin: 16,
        marginTop: 0,
        backgroundColor: 'rgba(67, 97, 238, 0.1)',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#4361ee'
    },
    previewMetadata: {
        marginHorizontal: 16,
        marginTop: 8,
        padding: 12,
        backgroundColor: '#1a1a2e',
        borderRadius: 8,
        gap: 8
    },
    previewMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    previewMetaText: {
        color: '#888',
        fontSize: 13
    },
    previewError: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        gap: 12
    },
    previewErrorText: {
        color: '#ef4444',
        fontSize: 16
    },
    previewRetryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#8b5cf6',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 8
    },
    previewRetryText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    },

    // Audio Player Styles
    audioPlayerSection: {
        padding: 16
    },
    audioPlayerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        borderRadius: 16,
        padding: 16,
        gap: 16
    },
    audioWaveformIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    audioPlayerControls: {
        flex: 1
    },
    audioPlayerTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8
    },
    audioProgressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10
    },
    audioProgressBar: {
        flex: 1,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2
    },
    audioProgressFill: {
        height: '100%',
        backgroundColor: '#8b5cf6',
        borderRadius: 2
    },
    audioTimeText: {
        color: '#888',
        fontSize: 11,
        minWidth: 60
    },
    audioControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    audioPlayPauseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#8b5cf6',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8
    },
    audioPlayBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600'
    },
    audioSpeedBtn: {
        backgroundColor: '#333',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6
    },
    audioSpeedText: {
        color: '#8b5cf6',
        fontSize: 12,
        fontWeight: '600'
    },

    // Transcription Styles
    transcriptionSection: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        marginTop: 12,
        padding: 16
    },
    transcriptionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12
    },
    transcriptionLabel: {
        color: '#8b5cf6',
        fontSize: 14,
        fontWeight: '600'
    },
    transcriptionSummary: {
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8
    },
    transcriptionSummaryLabel: {
        color: '#8b5cf6',
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 6
    },
    transcriptionSummaryText: {
        color: '#e0e0e0',
        fontSize: 14,
        lineHeight: 20
    },
    transcriptionFull: {
        paddingTop: 8
    },
    transcriptionFullLabel: {
        color: '#888',
        fontSize: 10,
        fontWeight: '600',
        marginBottom: 6
    },
    transcriptionFullText: {
        color: '#ccc',
        fontSize: 13,
        lineHeight: 20
    },
    transcriptionPending: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderRadius: 8,
        padding: 14,
        marginTop: 12
    },
    transcriptionPendingText: {
        color: '#8b5cf6',
        fontSize: 13
    },

    previewFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#1a1a2e'
    },
    previewCloseFullBtn: {
        backgroundColor: '#1a1a2e',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center'
    },
    previewCloseFullText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    },
    keyboardAvoidingContainer: {
        flex: 1
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 14
    },
    backBtn: {
        padding: 4
    },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        gap: 8
    },
    headerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8
    },
    headerAvatarText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        maxWidth: '70%'
    },
    coachBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    coachBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff'
    },
    groupBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    groupBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff'
    },
    broadcastBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(139, 92, 246, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreBtn: {
        padding: 4
    },

    // Loading
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },

    // Messages List
    messagesList: {
        padding: 16,
        flexGrow: 1
    },
    emptyMessages: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 80
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 12
    },

    // Message Bubble
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8
    },
    messageBubbleOwn: {
        alignSelf: 'flex-end',
        backgroundColor: '#8b5cf6',
        borderBottomRightRadius: 4
    },
    messageBubbleOther: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    senderName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8b5cf6',
        marginBottom: 4
    },
    typeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginBottom: 6
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: '600'
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20
    },
    messageTextOwn: {
        color: '#fff'
    },
    messageTextOther: {
        color: '#1e293b'
    },
    messageTime: {
        fontSize: 11,
        marginTop: 4,
        alignSelf: 'flex-end'
    },
    messageTimeOwn: {
        color: 'rgba(255,255,255,0.7)'
    },
    messageTimeOther: {
        color: '#94a3b8'
    },

    // Type Selector
    typeSelector: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0'
    },
    typeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f1f5f9'
    },
    typeBtnActive: {
        backgroundColor: '#8b5cf6'
    },
    typeBtnText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748b'
    },
    typeBtnTextActive: {
        color: '#fff'
    },

    // Input
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        gap: 10
    },
    input: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: '#1e293b',
        maxHeight: 100
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    sendBtnDisabled: {
        backgroundColor: '#cbd5e1'
    },

    // 🆕 WhatsApp-style Media Buttons
    mediaBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center'
    },
    mediaButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },

    // 🆕 Attachment Preview
    attachmentPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0'
    },
    attachmentThumb: {
        width: 48,
        height: 48,
        borderRadius: 8,
        marginRight: 12
    },
    videoThumb: {
        backgroundColor: '#4361ee',
        justifyContent: 'center',
        alignItems: 'center'
    },
    documentThumb: {
        backgroundColor: '#f59e0b',
        justifyContent: 'center',
        alignItems: 'center'
    },
    audioThumb: {
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    attachmentName: {
        flex: 1,
        fontSize: 14
    },
    attachmentRemove: {
        padding: 4
    },

    // 🆕 Inline Chat Media (WhatsApp-style)
    chatMediaContainer: {
        marginBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
        maxWidth: 250
    },
    chatMediaImage: {
        width: 250,
        height: 200,
        borderRadius: 12
    },
    chatMediaVideo: {
        width: 250,
        height: 150,
        backgroundColor: '#1e293b',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    chatMediaVideoLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 4
    },

    // 🆕 Fullscreen Media Modal
    fullscreenMediaModal: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    fullscreenCloseBtn: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20
    },
    fullscreenImage: {
        width: '100%',
        height: '80%'
    },
    fullscreenVideo: {
        width: '100%',
        height: '80%'
    },

    // 📊 Fullscreen Comparison Modal
    comparisonModalBg: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    comparisonModalClose: {
        position: 'absolute',
        top: 50,
        right: 16,
        zIndex: 20,
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 20,
    },
    comparisonModalContent: {
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    comparisonFullDeltaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(14, 165, 233, 0.2)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16,
    },
    comparisonFullDeltaText: {
        color: '#0ea5e9',
        fontSize: 14,
        fontWeight: '700',
    },
    comparisonFullPhotos: {
        flexDirection: 'row',
        gap: 8,
    },
    comparisonFullCol: {
        alignItems: 'center',
    },
    comparisonFullLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    comparisonFullDate: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        marginTop: 8,
        fontWeight: '500',
    },
    comparisonFullArrowOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
    },
    comparisonFullArrowCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    comparisonFullNote: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic',
        paddingHorizontal: 16,
    },

    // Video Feedback Response Card (Legacy)
    videoResponseCard: {
        backgroundColor: '#4361ee10',
        padding: 10,
        borderRadius: 10,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#4361ee'
    },
    videoResponseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    videoResponseTitle: {
        color: '#4361ee',
        fontSize: 13,
        fontWeight: '600'
    },

    // 📊 Comparison Card in Chat
    comparisonCard: {
        backgroundColor: 'rgba(14, 165, 233, 0.08)',
        borderRadius: 10,
        padding: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: 'rgba(14, 165, 233, 0.2)',
        minWidth: 240,
    },
    comparisonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    comparisonTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0ea5e9',
        flex: 1,
    },
    comparisonDeltaBadge: {
        backgroundColor: 'rgba(14, 165, 233, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    comparisonDeltaText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#0ea5e9',
    },
    comparisonPhotos: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    comparisonPhotoCol: {
        flex: 1,
        alignItems: 'center',
    },
    comparisonLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    comparisonPhotoImg: {
        width: '100%',
        aspectRatio: 3 / 4,
        borderRadius: 8,
        backgroundColor: '#1a1a1f',
    },
    comparisonDate: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 3,
    },
    comparisonArrow: {
        paddingHorizontal: 2,
    },
    comparisonTapHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: 6,
        opacity: 0.6,
    },
    comparisonTapHintText: {
        fontSize: 10,
        color: '#0ea5e9',
        fontWeight: '500',
    },

    // 🆕 Enhanced Feedback Quote Card
    feedbackQuoteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8faff',
        borderWidth: 1,
        borderColor: '#dbeafe',
        borderRadius: 8,
        padding: 6,
        marginBottom: 6,
        gap: 8
    },
    feedbackQuotePreview: {
        width: 40,
        height: 40,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#4361ee',
        position: 'relative'
    },
    feedbackQuoteThumbnail: {
        width: '100%',
        height: '100%'
    },
    feedbackQuoteIconBg: {
        width: '100%',
        height: '100%',
        backgroundColor: '#4361ee',
        justifyContent: 'center',
        alignItems: 'center'
    },
    feedbackQuotePlayOverlay: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 8,
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center'
    },
    feedbackQuoteInfo: {
        flex: 1
    },
    feedbackQuoteTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 2
    },
    feedbackQuoteMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    feedbackQuoteSubtext: {
        fontSize: 10,
        color: '#64748b'
    },
    feedbackQuoteDot: {
        width: 2,
        height: 2,
        borderRadius: 1,
        backgroundColor: '#94a3b8'
    },
    feedbackQuoteTap: {
        fontSize: 12,
        color: '#4361ee',
        fontWeight: '500'
    },

    // Inline Chat Audio Player
    inlineChatAudioCard: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8
    },
    inlineChatAudioHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10
    },
    inlineChatAudioIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    inlineChatAudioInfo: {
        flex: 1
    },
    inlineChatAudioTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b'
    },
    inlineChatAudioSubtext: {
        fontSize: 11,
        color: '#64748b'
    },
    inlineChatAudioProgress: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10
    },
    inlineChatAudioProgressBar: {
        flex: 1,
        height: 4,
        backgroundColor: 'rgba(139, 92, 246, 0.3)',
        borderRadius: 2
    },
    inlineChatAudioProgressFill: {
        height: '100%',
        backgroundColor: '#8b5cf6',
        borderRadius: 2
    },
    inlineChatAudioTime: {
        fontSize: 11,
        color: '#64748b',
        minWidth: 30
    },
    inlineChatAudioControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    inlineChatAudioPlayBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    inlineChatAudioSpeedBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderRadius: 6
    },
    inlineChatAudioSpeedText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#8b5cf6'
    },
    inlineChatAudioAiBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderRadius: 6,
        marginLeft: 'auto'
    },
    inlineChatAudioAiText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#8b5cf6'
    },

    // YouTube Link Card
    youtubeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f1f5f9',
        padding: 10,
        borderRadius: 10,
        marginTop: 8
    },
    youtubeCardText: {
        flex: 1,
        color: '#1e293b',
        fontSize: 13,
        fontWeight: '500'
    }
});
