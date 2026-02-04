/**
 * UserMediaViewerModal.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * Modal simple para que el usuario vea su propia multimedia (video/foto/audio)
 * Sin opciones de respuesta del coach - solo visualización
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Image,
    useWindowDimensions,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer } from 'expo-audio';
import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// ═══════════════════════════════════════════════════════════════════════════
// VIDEO PLAYER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const VideoPlayer = ({ uri, style }) => {
    const player = useVideoPlayer(uri, player => {
        player.loop = false;
    });

    if (!uri) return null;

    return (
        <VideoView
            style={style}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
            contentFit="contain"
        />
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO PLAYER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const AudioPlayerSection = ({ uri }) => {
    const audioPlayer = useAudioPlayer(uri ? { uri } : null);
    const [isPlaying, setIsPlaying] = useState(false);

    const handlePlayPause = () => {
        if (audioPlayer) {
            if (isPlaying) {
                audioPlayer.pause();
            } else {
                audioPlayer.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    return (
        <View style={styles.audioContainer}>
            <View style={styles.audioWaveform}>
                <Ionicons name="musical-notes" size={48} color="#8b5cf6" />
            </View>
            <TouchableOpacity
                style={styles.audioPlayBtn}
                onPress={handlePlayPause}
            >
                <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={32}
                    color="#fff"
                />
                <Text style={styles.audioPlayText}>
                    {isPlaying ? 'Pausar' : 'Reproducir'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function UserMediaViewerModal({ visible, onClose, feedback }) {
    const insets = useSafeAreaInsets();
    const { width: windowWidth } = useWindowDimensions();
    const { token } = useAuth();
    const isWeb = Platform.OS === 'web';

    const [mediaUrl, setMediaUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Cargar URL firmada fresca cuando se abre el modal
    useEffect(() => {
        if (visible && feedback?._id) {
            loadMediaUrl();
        }
        return () => {
            setMediaUrl(null);
            setError(null);
        };
    }, [visible, feedback?._id]);

    const loadMediaUrl = async () => {
        if (!feedback?._id || !token) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/api/video-feedback/${feedback._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setMediaUrl(data.mediaUrl);
            } else {
                setError('No se pudo cargar el contenido');
            }
        } catch (err) {
            console.error('[UserMediaViewer] Error:', err);
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    if (!feedback) return null;

    const mediaTypeLabel = {
        video: 'Video',
        photo: 'Foto',
        audio: 'Audio'
    }[feedback.mediaType] || 'Media';

    const mediaTypeIcon = {
        video: 'videocam',
        photo: 'image',
        audio: 'mic'
    }[feedback.mediaType] || 'document';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="arrow-back" size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>
                            <Ionicons name={mediaTypeIcon} size={18} color="#8b5cf6" /> Mi {mediaTypeLabel}
                        </Text>
                        <Text style={styles.headerDate}>
                            {new Date(feedback.createdAt).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'long',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentInner}
                >
                    {/* Exercise Info */}
                    {feedback.exerciseName && (
                        <View style={styles.exerciseCard}>
                            <Ionicons name="barbell" size={20} color="#3b82f6" />
                            <Text style={styles.exerciseName}>{feedback.exerciseName}</Text>
                        </View>
                    )}

                    {/* Media Container */}
                    <View style={styles.mediaContainer}>
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#8b5cf6" />
                                <Text style={styles.loadingText}>Cargando...</Text>
                            </View>
                        ) : error ? (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle" size={48} color="#ef4444" />
                                <Text style={styles.errorText}>{error}</Text>
                                <TouchableOpacity style={styles.retryBtn} onPress={loadMediaUrl}>
                                    <Text style={styles.retryBtnText}>Reintentar</Text>
                                </TouchableOpacity>
                            </View>
                        ) : mediaUrl ? (
                            <>
                                {feedback.mediaType === 'photo' && (
                                    <Image
                                        source={{ uri: mediaUrl }}
                                        style={styles.image}
                                        resizeMode="contain"
                                    />
                                )}
                                {feedback.mediaType === 'video' && (
                                    isWeb ? (
                                        <video
                                            src={mediaUrl}
                                            controls
                                            style={{ width: '100%', maxHeight: 400, borderRadius: 12, backgroundColor: '#000' }}
                                        />
                                    ) : (
                                        <VideoPlayer uri={mediaUrl} style={styles.video} />
                                    )
                                )}
                                {feedback.mediaType === 'audio' && (
                                    <AudioPlayerSection uri={mediaUrl} />
                                )}
                            </>
                        ) : null}
                    </View>

                    {/* Athlete Note */}
                    {feedback.athleteNote && (
                        <View style={styles.noteCard}>
                            <Text style={styles.noteLabel}>Mi nota:</Text>
                            <Text style={styles.noteText}>{feedback.athleteNote}</Text>
                        </View>
                    )}

                    {/* Coach Response (if exists) */}
                    {feedback.coachResponse?.text && (
                        <View style={styles.coachResponseCard}>
                            <View style={styles.coachResponseHeader}>
                                <Ionicons name="chatbubble" size={16} color="#10b981" />
                                <Text style={styles.coachResponseTitle}>Respuesta de tu entrenador</Text>
                            </View>
                            <Text style={styles.coachResponseText}>{feedback.coachResponse.text}</Text>
                            {feedback.coachResponse.respondedAt && (
                                <Text style={styles.coachResponseDate}>
                                    {new Date(feedback.coachResponse.respondedAt).toLocaleDateString('es-ES', {
                                        day: 'numeric',
                                        month: 'short'
                                    })}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Status Badge */}
                    <View style={styles.statusContainer}>
                        {feedback.coachResponse?.respondedAt ? (
                            <View style={[styles.statusBadge, { backgroundColor: '#10b98120' }]}>
                                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                                <Text style={[styles.statusText, { color: '#10b981' }]}>Respondido</Text>
                            </View>
                        ) : feedback.viewedByCoach ? (
                            <View style={[styles.statusBadge, { backgroundColor: '#3b82f620' }]}>
                                <Ionicons name="eye" size={16} color="#3b82f6" />
                                <Text style={[styles.statusText, { color: '#3b82f6' }]}>Visto por tu entrenador</Text>
                            </View>
                        ) : (
                            <View style={[styles.statusBadge, { backgroundColor: '#f59e0b20' }]}>
                                <Ionicons name="time" size={16} color="#f59e0b" />
                                <Text style={[styles.statusText, { color: '#f59e0b' }]}>Pendiente de ver</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>

                {/* Close Button */}
                <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
                    <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                        <Text style={styles.doneBtnText}>Cerrar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0'
    },
    closeBtn: {
        padding: 4
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b'
    },
    headerDate: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2
    },
    content: {
        flex: 1
    },
    contentInner: {
        padding: 16
    },
    exerciseCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        gap: 8
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#3b82f6'
    },
    mediaContainer: {
        backgroundColor: '#0f172a',
        borderRadius: 16,
        overflow: 'hidden',
        minHeight: 250,
        marginBottom: 16
    },
    loadingContainer: {
        flex: 1,
        minHeight: 250,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingText: {
        color: '#94a3b8',
        marginTop: 12,
        fontSize: 14
    },
    errorContainer: {
        flex: 1,
        minHeight: 250,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    errorText: {
        color: '#ef4444',
        marginTop: 12,
        fontSize: 14,
        textAlign: 'center'
    },
    retryBtn: {
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#8b5cf6',
        borderRadius: 8
    },
    retryBtnText: {
        color: '#fff',
        fontWeight: '600'
    },
    video: {
        width: '100%',
        height: 350
    },
    image: {
        width: '100%',
        height: 350
    },
    audioContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 250
    },
    audioWaveform: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#8b5cf620',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24
    },
    audioPlayBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#8b5cf6',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 25,
        gap: 8
    },
    audioPlayText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff'
    },
    noteCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#3b82f6'
    },
    noteLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 4
    },
    noteText: {
        fontSize: 14,
        color: '#1e293b',
        lineHeight: 20
    },
    coachResponseCard: {
        backgroundColor: '#f0fdf4',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#10b981'
    },
    coachResponseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8
    },
    coachResponseTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#10b981'
    },
    coachResponseText: {
        fontSize: 14,
        color: '#1e293b',
        lineHeight: 20
    },
    coachResponseDate: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 8
    },
    statusContainer: {
        alignItems: 'center',
        marginTop: 8
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6
    },
    statusText: {
        fontSize: 13,
        fontWeight: '500'
    },
    footer: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        padding: 16
    },
    doneBtn: {
        backgroundColor: '#8b5cf6',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center'
    },
    doneBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff'
    }
});
