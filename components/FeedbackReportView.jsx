/**
 * FeedbackReportView.jsx - Vista de lectura de un Feedback Report
 * Muestra el feedback estructurado y permite respuesta única del cliente
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Image,
    useWindowDimensions
} from 'react-native';
import { EnhancedTextInput } from './ui';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer } from 'expo-audio';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// ═══════════════════════════════════════════════════════════════════════════
// FOCUS STATE BADGE (Translated traffic light)
// ═══════════════════════════════════════════════════════════════════════════

const FocusStateBadge = ({ trafficLight }) => {
    const config = {
        green: { color: '#10b981', bg: '#10b98120', label: 'Semana de Progreso Excelente', icon: '🚀' },
        yellow: { color: '#f59e0b', bg: '#f59e0b20', label: 'Semana de Consolidación', icon: '💪' },
        red: { color: '#ef4444', bg: '#ef444420', label: 'Semana de Ajustes Necesarios', icon: '🔧' }
    };
    const { color, bg, label, icon } = config[trafficLight] || config.yellow;

    return (
        <View style={[styles.focusBadge, { backgroundColor: bg }]}>
            <Text style={styles.focusIcon}>{icon}</Text>
            <Text style={[styles.focusLabel, { color }]}>{label}</Text>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION CARD - Con callback para abrir media
// ═══════════════════════════════════════════════════════════════════════════

const SectionCard = ({ emoji, title, items, color, onViewMedia }) => {
    if (!items || items.length === 0) return null;

    return (
        <View style={styles.sectionCard}>
            <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
                <Text style={styles.sectionEmoji}>{emoji}</Text>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            <View style={styles.sectionContent}>
                {items.map((item, index) => {
                    // Normalize field names (backend may use either)
                    const mediaType = item.sourceMediaType || item.mediaType;
                    const mediaUrl = item.sourceMediaUrl;

                    return (
                        <View key={index} style={styles.itemRow}>
                            <View style={[styles.itemDot, { backgroundColor: color }]} />
                            <View style={styles.itemContent}>
                                {/* Mostrar nombre del ejercicio si existe */}
                                {item.exerciseName && (
                                    <View style={styles.exerciseBadge}>
                                        <Ionicons name="barbell" size={12} color="#3b82f6" />
                                        <Text style={styles.exerciseName}>{item.exerciseName}</Text>
                                    </View>
                                )}
                                <Text style={styles.itemText}>{item.text}</Text>
                                {/* 🆕 Botón para abrir modal de media */}
                                {mediaUrl && (
                                    <TouchableOpacity
                                        style={styles.videoLink}
                                        onPress={() => onViewMedia?.({
                                            ...item,
                                            sourceMediaType: mediaType,
                                            sourceMediaUrl: mediaUrl
                                        })}
                                    >
                                        <Ionicons
                                            name={mediaType === 'photo' ? 'image' :
                                                mediaType === 'audio' ? 'mic' : 'play-circle'}
                                            size={16}
                                            color="#8b5cf6"
                                        />
                                        <Text style={styles.videoLinkText}>
                                            {mediaType === 'photo' ? 'Ver mi foto' :
                                                mediaType === 'audio' ? 'Escuchar mi audio' :
                                                    'Ver mi video'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA PREVIEW MODAL - Modal inline para ver video/foto/audio
// ═══════════════════════════════════════════════════════════════════════════

// Subcomponente para el video player (necesario porque hooks no pueden ser condicionales)
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

const MediaPreviewModal = ({ visible, onClose, mediaItem }) => {
    const { width: windowWidth } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';

    // Audio player for audio type
    const audioPlayer = useAudioPlayer(mediaItem?.sourceMediaType === 'audio' ? { uri: mediaItem?.sourceMediaUrl } : null);
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

    if (!mediaItem) return null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={mediaStyles.overlay}>
                <View style={[mediaStyles.container, { maxWidth: isWeb ? 600 : windowWidth - 40 }]}>
                    {/* Header */}
                    <View style={mediaStyles.header}>
                        <View style={mediaStyles.titleRow}>
                            <Ionicons
                                name={mediaItem.sourceMediaType === 'photo' ? 'image' :
                                    mediaItem.sourceMediaType === 'audio' ? 'mic' : 'videocam'}
                                size={20}
                                color="#8b5cf6"
                            />
                            <Text style={mediaStyles.title}>
                                {mediaItem.sourceMediaType === 'photo' ? 'Mi Foto' :
                                    mediaItem.sourceMediaType === 'audio' ? 'Mi Audio' :
                                        'Mi Video'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={mediaStyles.closeBtn}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Exercise Badge */}
                    {mediaItem.exerciseName && (
                        <View style={mediaStyles.exerciseBadge}>
                            <Ionicons name="barbell" size={14} color="#3b82f6" />
                            <Text style={mediaStyles.exerciseName}>{mediaItem.exerciseName}</Text>
                        </View>
                    )}

                    {/* Media Content */}
                    <View style={mediaStyles.mediaContainer}>
                        {mediaItem.sourceMediaType === 'photo' ? (
                            <Image
                                source={{ uri: mediaItem.sourceMediaUrl }}
                                style={mediaStyles.image}
                                resizeMode="contain"
                            />
                        ) : mediaItem.sourceMediaType === 'audio' ? (
                            <View style={mediaStyles.audioContainer}>
                                <View style={mediaStyles.audioWaveform}>
                                    <Ionicons name="musical-notes" size={48} color="#8b5cf6" />
                                </View>
                                <TouchableOpacity
                                    style={mediaStyles.audioPlayBtn}
                                    onPress={handlePlayPause}
                                >
                                    <Ionicons
                                        name={isPlaying ? 'pause' : 'play'}
                                        size={32}
                                        color="#fff"
                                    />
                                    <Text style={mediaStyles.audioPlayText}>
                                        {isPlaying ? 'Pausar' : 'Reproducir'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            // Video - usando expo-video
                            isWeb ? (
                                <video
                                    src={mediaItem.sourceMediaUrl}
                                    controls
                                    style={{ width: '100%', maxHeight: 350, borderRadius: 12, backgroundColor: '#000' }}
                                />
                            ) : (
                                <VideoPlayer
                                    uri={mediaItem.sourceMediaUrl}
                                    style={mediaStyles.video}
                                />
                            )
                        )}
                    </View>

                    {/* Coach's Note */}
                    <View style={mediaStyles.noteSection}>
                        <Text style={mediaStyles.noteLabel}>Comentario de tu entrenador:</Text>
                        <Text style={mediaStyles.noteText}>{mediaItem.text}</Text>
                    </View>

                    {/* Close Button */}
                    <TouchableOpacity style={mediaStyles.doneBtn} onPress={onClose}>
                        <Text style={mediaStyles.doneBtnText}>Cerrar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function FeedbackReportView({ visible, report, onClose, onReportUpdated }) {
    const { token, user } = useAuth();
    const insets = useSafeAreaInsets();

    const [responseText, setResponseText] = useState('');
    const [sending, setSending] = useState(false);
    const [showResponseInput, setShowResponseInput] = useState(false);

    // 🆕 Estado para el modal de media
    const [mediaModalItem, setMediaModalItem] = useState(null);

    const hasResponded = !!report?.clientResponse?.text;
    const canRespond = !hasResponded && report?.status === 'read' || report?.status === 'sent';

    // ─────────────────────────────────────────────────────────────────────────
    // SEND RESPONSE
    // ─────────────────────────────────────────────────────────────────────────

    const handleSendResponse = async () => {
        if (!responseText.trim()) {
            Alert.alert('Error', 'Escribe tu respuesta');
            return;
        }

        if (responseText.length > 500) {
            Alert.alert('Error', 'La respuesta no puede superar los 500 caracteres');
            return;
        }

        setSending(true);
        try {
            const res = await fetch(`${API_URL}/api/feedback-reports/${report._id}/respond`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: responseText.trim() })
            });

            const data = await res.json();
            if (data.success) {
                Alert.alert('✅ Enviado', 'Tu respuesta ha sido enviada', [
                    {
                        text: 'OK', onPress: () => {
                            onReportUpdated?.(data.report);
                            setShowResponseInput(false);
                        }
                    }
                ]);
            } else {
                Alert.alert('Error', data.message || 'No se pudo enviar');
            }
        } catch (error) {
            Alert.alert('Error', 'Error de conexión');
        } finally {
            setSending(false);
        }
    };

    if (!report) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={[styles.container, { paddingTop: insets.top }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="arrow-back" size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>📋 Feedback de tu Entrenador</Text>
                        <Text style={styles.headerDate}>
                            {new Date(report.sentAt).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentInner}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Focus State */}
                    <FocusStateBadge trafficLight={report.trafficLight} />

                    {/* Week Info */}
                    {report.weekNumber && (
                        <View style={styles.weekCard}>
                            <Text style={styles.weekLabel}>Semana del Plan</Text>
                            <Text style={styles.weekValue}>{report.weekNumber}</Text>
                        </View>
                    )}

                    {/* Snapshot Data (if available) */}
                    {report.snapshotData && (
                        <View style={styles.snapshotCard}>
                            <Text style={styles.snapshotTitle}>📊 Tus métricas en esta semana</Text>
                            <View style={styles.snapshotRow}>
                                {report.snapshotData.workoutsCompleted !== undefined && (
                                    <View style={styles.snapshotItem}>
                                        <Text style={styles.snapshotValue}>
                                            {report.snapshotData.workoutsCompleted}
                                        </Text>
                                        <Text style={styles.snapshotLabel}>Entrenos</Text>
                                    </View>
                                )}
                                {report.snapshotData.weightAvg && (
                                    <View style={styles.snapshotItem}>
                                        <Text style={styles.snapshotValue}>
                                            {report.snapshotData.weightAvg.toFixed(1)}
                                        </Text>
                                        <Text style={styles.snapshotLabel}>Peso (kg)</Text>
                                    </View>
                                )}
                                {report.snapshotData.compliancePercent !== undefined && (
                                    <View style={styles.snapshotItem}>
                                        <Text style={styles.snapshotValue}>
                                            {report.snapshotData.compliancePercent}%
                                        </Text>
                                        <Text style={styles.snapshotLabel}>Cumplimiento</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Highlights - Con callback para abrir media (fotos de Coach Studio) */}
                    <SectionCard
                        emoji="✨"
                        title="Lo que has hecho bien"
                        items={report.highlights}
                        color="#10b981"
                        onViewMedia={(item) => setMediaModalItem(item)}
                    />

                    {/* Technical Notes - Con callback para abrir media */}
                    <SectionCard
                        emoji="📊"
                        title="Análisis Técnico"
                        items={report.technicalNotes}
                        color="#3b82f6"
                        onViewMedia={(item) => setMediaModalItem(item)}
                    />

                    {/* Action Plan */}
                    <SectionCard
                        emoji="🎯"
                        title="Plan de Acción"
                        items={report.actionPlan}
                        color="#f59e0b"
                    />

                    {/* Client Response (if exists) */}
                    {hasResponded && (
                        <View style={styles.responseCard}>
                            <View style={styles.responseHeader}>
                                <Ionicons name="chatbubble" size={18} color="#8b5cf6" />
                                <Text style={styles.responseTitle}>Tu respuesta</Text>
                            </View>
                            <Text style={styles.responseText}>{report.clientResponse.text}</Text>
                            <Text style={styles.responseDate}>
                                {new Date(report.clientResponse.respondedAt).toLocaleDateString('es-ES')}
                            </Text>
                        </View>
                    )}

                    {/* Response Input */}
                    {canRespond && !hasResponded && (
                        showResponseInput ? (
                            <View style={styles.responseInputCard}>
                                <Text style={styles.responseInputTitle}>💬 Tu respuesta</Text>
                                <Text style={styles.responseInputHint}>
                                    Máximo 500 caracteres • Solo puedes responder una vez
                                </Text>
                                <EnhancedTextInput
                                    containerStyle={styles.responseInputContainer}
                                    style={styles.responseInputText}
                                    value={responseText}
                                    onChangeText={setResponseText}
                                    placeholder="Escribe tu respuesta..."
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                    maxLength={500}
                                />
                                <Text style={styles.charCount}>
                                    {responseText.length}/500
                                </Text>
                                <View style={styles.responseActions}>
                                    <TouchableOpacity
                                        style={styles.cancelBtn}
                                        onPress={() => {
                                            setShowResponseInput(false);
                                            setResponseText('');
                                        }}
                                    >
                                        <Text style={styles.cancelBtnText}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.sendResponseBtn}
                                        onPress={handleSendResponse}
                                        disabled={sending}
                                    >
                                        {sending ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <Ionicons name="send" size={16} color="#fff" />
                                                <Text style={styles.sendResponseBtnText}>Enviar</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.respondBtn}
                                onPress={() => setShowResponseInput(true)}
                            >
                                <Ionicons name="chatbubble-outline" size={20} color="#8b5cf6" />
                                <Text style={styles.respondBtnText}>Responder a tu entrenador</Text>
                            </TouchableOpacity>
                        )
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* 🆕 Modal de Media */}
            <MediaPreviewModal
                visible={!!mediaModalItem}
                onClose={() => setMediaModalItem(null)}
                mediaItem={mediaModalItem}
            />
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

    // Header
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
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b'
    },
    headerDate: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },

    // Content
    content: {
        flex: 1
    },
    contentInner: {
        padding: 20
    },

    // Focus Badge
    focusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        gap: 8
    },
    focusIcon: {
        fontSize: 24
    },
    focusLabel: {
        fontSize: 16,
        fontWeight: '700'
    },

    // Week Card
    weekCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        alignItems: 'center'
    },
    weekLabel: {
        fontSize: 12,
        color: '#64748b'
    },
    weekValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 4
    },

    // Snapshot
    snapshotCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16
    },
    snapshotTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 12
    },
    snapshotRow: {
        flexDirection: 'row',
        justifyContent: 'space-around'
    },
    snapshotItem: {
        alignItems: 'center'
    },
    snapshotValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b'
    },
    snapshotLabel: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2
    },

    // Section Card
    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden'
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderLeftWidth: 4,
        gap: 8
    },
    sectionEmoji: {
        fontSize: 18
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b'
    },
    sectionContent: {
        paddingHorizontal: 16,
        paddingBottom: 16
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 8,
        gap: 12
    },
    itemDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 6
    },
    itemText: {
        flex: 1,
        fontSize: 14,
        color: '#334155',
        lineHeight: 20
    },
    itemContent: {
        flex: 1
    },
    exerciseBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#dbeafe',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 6
    },
    exerciseName: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1d4ed8',
        textTransform: 'uppercase'
    },
    videoLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        backgroundColor: '#f3e8ff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start'
    },
    videoLinkText: {
        fontSize: 12,
        color: '#8b5cf6',
        fontWeight: '600'
    },

    // Response Card (existing response)
    responseCard: {
        backgroundColor: '#f5f3ff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#8b5cf6'
    },
    responseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    responseTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8b5cf6'
    },
    responseText: {
        fontSize: 14,
        color: '#1e293b',
        lineHeight: 20
    },
    responseDate: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 8
    },

    // Respond Button
    respondBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#8b5cf6',
        borderStyle: 'dashed',
        gap: 8
    },
    respondBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#8b5cf6'
    },

    // Response Input
    responseInputCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16
    },
    responseInputTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4
    },
    responseInputHint: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 12
    },
    responseInputContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 14,
        minHeight: 100,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    responseInputText: {
        fontSize: 14,
        color: '#1e293b',
        textAlignVertical: 'top',
    },
    charCount: {
        fontSize: 11,
        color: '#94a3b8',
        textAlign: 'right',
        marginTop: 4
    },
    responseActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b'
    },
    sendResponseBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: '#8b5cf6',
        borderRadius: 12,
        gap: 6
    },
    sendResponseBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff'
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA MODAL STYLES
// ═══════════════════════════════════════════════════════════════════════════

const mediaStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        width: '100%',
        maxHeight: '90%'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b'
    },
    closeBtn: {
        padding: 4
    },
    exerciseBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 12,
        gap: 6
    },
    exerciseName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#3b82f6'
    },
    mediaContainer: {
        backgroundColor: '#0f172a',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
        minHeight: 200
    },
    video: {
        width: '100%',
        height: 300
    },
    image: {
        width: '100%',
        height: 300
    },
    audioContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200
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
    noteSection: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16
    },
    noteLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 6
    },
    noteText: {
        fontSize: 14,
        color: '#1e293b',
        lineHeight: 20
    },
    doneBtn: {
        backgroundColor: '#8b5cf6',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center'
    },
    doneBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff'
    }
});
