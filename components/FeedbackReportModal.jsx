/**
 * FeedbackReportModal.jsx - Modal para crear/editar Feedback Reports
 * Formulario estructurado con secciones: Highlights, Análisis, Plan
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useFeedbackDraft } from '../context/FeedbackDraftContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import ConfirmModal from './ConfirmModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// ═══════════════════════════════════════════════════════════════════════════
// VIDEO PREVIEW PLAYER (expo-video wrapper)
// ═══════════════════════════════════════════════════════════════════════════

const VideoPreviewPlayer = ({ uri, style }) => {
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
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════════════════

const SectionHeader = ({ emoji, title, color, count = 0 }) => (
    <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
        <Text style={styles.sectionEmoji}>{emoji}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count > 0 && (
            <View style={[styles.countBadge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.countText, { color }]}>{count}</Text>
            </View>
        )}
    </View>
);

// ═══════════════════════════════════════════════════════════════════════════
// ITEM INPUT (reusable for highlights, notes, actions)
// ═══════════════════════════════════════════════════════════════════════════

const ItemInput = ({ items, setItems, placeholder, color, onViewMedia }) => {
    const [newItem, setNewItem] = useState('');

    const addItem = () => {
        if (!newItem.trim()) return;
        setItems([...items, { text: newItem.trim(), id: Date.now().toString() }]);
        setNewItem('');
    };

    const removeItem = (id) => {
        setItems(items.filter(item => item.id !== id));
    };

    return (
        <View style={styles.itemInputContainer}>
            {/* Existing Items - with support for media */}
            {items.map((item) => (
                <View
                    key={item.id}
                    style={[
                        styles.itemRow,
                        item.sourceMediaUrl && styles.importedNoteCard
                    ]}
                >
                    {/* If item has media (photo from Coach Studio) */}
                    {item.sourceMediaUrl ? (
                        <View style={styles.importedNoteContent}>
                            <View style={styles.importedNoteHeader}>
                                <View style={styles.importedNoteBadge}>
                                    <Ionicons
                                        name={item.mediaType === 'photo' ? 'image' : 'videocam'}
                                        size={12}
                                        color="#10b981"
                                    />
                                    <Text style={[styles.importedNoteExercise, { color: '#10b981' }]}>
                                        {item.exerciseName || 'Foto de progreso'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => removeItem(item.id)}
                                    style={styles.itemRemove}
                                >
                                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.importedNoteText}>{item.text}</Text>
                            <TouchableOpacity
                                style={styles.viewMediaLink}
                                onPress={() => onViewMedia?.(item)}
                            >
                                <Ionicons
                                    name={item.mediaType === 'photo' ? 'image' : 'play-circle'}
                                    size={14}
                                    color="#10b981"
                                />
                                <Text style={[styles.viewMediaLinkText, { color: '#10b981' }]}>
                                    {item.mediaType === 'photo' ? 'Ver foto' : 'Ver video'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <View style={[styles.itemDot, { backgroundColor: color }]} />
                            <Text style={styles.itemText}>{item.text}</Text>
                            <TouchableOpacity
                                onPress={() => removeItem(item.id)}
                                style={styles.itemRemove}
                            >
                                <Ionicons name="close-circle" size={20} color="#ef4444" />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            ))}

            {/* Add New */}
            <View style={styles.addItemRow}>
                <TextInput
                    style={styles.addItemInput}
                    value={newItem}
                    onChangeText={setNewItem}
                    placeholder={placeholder}
                    placeholderTextColor="#94a3b8"
                    onSubmitEditing={addItem}
                    returnKeyType="done"
                />
                <TouchableOpacity
                    style={[styles.addItemBtn, { backgroundColor: color }]}
                    onPress={addItem}
                    disabled={!newItem.trim()}
                >
                    <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// TECHNICAL NOTE INPUT (with visual cards for imported notes)
// ═══════════════════════════════════════════════════════════════════════════

const TechnicalNoteInput = ({ items, setItems, placeholder, color, onViewMedia }) => {
    const [newItem, setNewItem] = useState('');

    const addItem = () => {
        if (!newItem.trim()) return;
        setItems([...items, { text: newItem.trim(), id: Date.now().toString() }]);
        setNewItem('');
    };

    const removeItem = (id) => {
        setItems(items.filter(item => item.id !== id));
    };

    return (
        <View style={styles.itemInputContainer}>
            {/* Existing Items - With visual cards for imported notes */}
            {items.map((item) => (
                <View
                    key={item.id}
                    style={[
                        styles.itemRow,
                        item.exerciseName && styles.importedNoteCard
                    ]}
                >
                    {/* If imported note, show exercise context */}
                    {item.exerciseName ? (
                        <View style={styles.importedNoteContent}>
                            <View style={styles.importedNoteHeader}>
                                <View style={styles.importedNoteBadge}>
                                    <Ionicons name="barbell" size={12} color="#3b82f6" />
                                    <Text style={styles.importedNoteExercise}>
                                        {item.exerciseName}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => removeItem(item.id)}
                                    style={styles.itemRemove}
                                >
                                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.importedNoteText}>{item.text}</Text>
                            {/* Link al media original del atleta */}
                            {item.sourceMediaUrl && (
                                <TouchableOpacity
                                    style={styles.viewMediaLink}
                                    onPress={() => onViewMedia?.(item)}
                                >
                                    <Ionicons
                                        name={item.mediaType === 'photo' ? 'image' : 'play-circle'}
                                        size={14}
                                        color="#8b5cf6"
                                    />
                                    <Text style={styles.viewMediaLinkText}>
                                        {item.mediaType === 'photo' ? 'Ver foto del atleta' : 'Ver video del atleta'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            {item.videoUrl && (
                                <View style={styles.importedVideoTag}>
                                    <Ionicons name="logo-youtube" size={12} color="#ef4444" />
                                    <Text style={styles.importedVideoText}>Video referencia adjunto</Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        <>
                            <View style={[styles.itemDot, { backgroundColor: color }]} />
                            <Text style={styles.itemText}>{item.text}</Text>
                            <TouchableOpacity
                                onPress={() => removeItem(item.id)}
                                style={styles.itemRemove}
                            >
                                <Ionicons name="close-circle" size={20} color="#ef4444" />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            ))}

            {/* Add New */}
            <View style={styles.addItemRow}>
                <TextInput
                    style={styles.addItemInput}
                    value={newItem}
                    onChangeText={setNewItem}
                    placeholder={placeholder}
                    placeholderTextColor="#94a3b8"
                    onSubmitEditing={addItem}
                    returnKeyType="done"
                />
                <TouchableOpacity
                    style={[styles.addItemBtn, { backgroundColor: color }]}
                    onPress={addItem}
                    disabled={!newItem.trim()}
                >
                    <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// TRAFFIC LIGHT SELECTOR
// ═══════════════════════════════════════════════════════════════════════════

const TrafficLightSelector = ({ value, onChange }) => {
    const options = [
        { id: 'green', icon: '🟢', label: 'Progreso', color: '#10b981' },
        { id: 'yellow', icon: '🟡', label: 'Consolidación', color: '#f59e0b' },
        { id: 'red', icon: '🔴', label: 'Ajustes', color: '#ef4444' }
    ];

    return (
        <View style={styles.trafficContainer}>
            <Text style={styles.trafficTitle}>Estado de la Semana</Text>
            <View style={styles.trafficRow}>
                {options.map(opt => (
                    <TouchableOpacity
                        key={opt.id}
                        style={[
                            styles.trafficOption,
                            value === opt.id && { backgroundColor: opt.color + '20', borderColor: opt.color }
                        ]}
                        onPress={() => onChange(opt.id)}
                    >
                        <Text style={styles.trafficIcon}>{opt.icon}</Text>
                        <Text style={[
                            styles.trafficLabel,
                            value === opt.id && { color: opt.color, fontWeight: '700' }
                        ]}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function FeedbackReportModal({ visible, onClose, client, prefillData = null }) {
    const { token } = useAuth();
    const { drafts, clearDrafts, removeTechnicalNote } = useFeedbackDraft();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [snapshotData, setSnapshotData] = useState(null);

    // Form State
    const [trafficLight, setTrafficLight] = useState('green');
    const [weekNumber, setWeekNumber] = useState('');
    const [highlights, setHighlights] = useState([]);
    const [technicalNotes, setTechnicalNotes] = useState([]);
    const [actionPlan, setActionPlan] = useState([]);

    // Modal states for confirmations (cross-platform)
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [modalMessage, setModalMessage] = useState({ title: '', message: '' });
    const [shouldCloseOnSuccess, setShouldCloseOnSuccess] = useState(false);

    // Media Preview Modal (for viewing athlete videos/photos)
    const [mediaPreviewItem, setMediaPreviewItem] = useState(null);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD CLIENT DATA (Snapshot)
    // ─────────────────────────────────────────────────────────────────────────

    const loadSnapshot = useCallback(async () => {
        if (!client?._id || !visible) return;

        setLoading(true);
        try {
            // Cargar métricas actuales del cliente para el snapshot
            const res = await fetch(`${API_URL}/api/feedback-reports/snapshot/${client._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setSnapshotData(data.snapshot);
            }
        } catch (error) {
            console.log('[FeedbackModal] Snapshot not available yet');
            // Graceful fallback - snapshot will be null
        } finally {
            setLoading(false);
        }
    }, [client?._id, visible, token]);

    useEffect(() => {
        if (visible) {
            loadSnapshot();

            // Check for prefill data from FAB
            if (prefillData) {
                console.log('[FeedbackModal] Recibiendo prefillData:', JSON.stringify(prefillData));

                // Pre-fill from FAB data
                setTrafficLight(prefillData.trafficLight || 'green');

                // Logros (antes highlights)
                const logrosData = prefillData.highlights || [];
                console.log('[FeedbackModal] Logros recibidos:', logrosData);
                setHighlights(
                    logrosData.map((text, i) => ({
                        text: typeof text === 'string' ? text : text.text,
                        id: `prefill-h-${i}`
                    }))
                );

                // Análisis Técnico
                const analysisData = prefillData.analysis || '';
                console.log('[FeedbackModal] Análisis recibido:', analysisData);
                setTechnicalNotes(
                    analysisData ? [{ text: analysisData, id: 'prefill-n-0' }] : []
                );

                // Plan de Acción
                const actionData = prefillData.actionItems || [];
                console.log('[FeedbackModal] Plan de acción recibido:', actionData);
                setActionPlan(
                    actionData.map((text, i) => ({
                        text: typeof text === 'string' ? text : text.text,
                        id: `prefill-a-${i}`
                    }))
                );
            } else {
                // Reset form
                setTrafficLight('green');
                setWeekNumber('');
                setActionPlan([]);

                // 🆕 Load highlights drafts (including photos from Coach Studio)
                if (drafts.highlights.length > 0) {
                    const draftHighlights = drafts.highlights.map(h => ({
                        text: h.text,
                        id: h.id,
                        exerciseName: h.exerciseName || null,
                        thumbnail: h.thumbnail || null,
                        sourceMediaUrl: h.sourceMediaUrl || null,
                        sourceMediaKey: h.sourceMediaKey || null,
                        mediaType: h.mediaType || null
                    }));
                    setHighlights(draftHighlights);
                } else {
                    setHighlights([]);
                }

                // 🆕 Load drafts from context into technicalNotes
                if (drafts.technicalNotes.length > 0) {
                    const draftNotes = drafts.technicalNotes.map(note => ({
                        text: note.text,
                        id: note.id,
                        exerciseName: note.exerciseName,
                        thumbnail: note.thumbnail,
                        videoUrl: note.videoUrl,
                        sourceMediaUrl: note.sourceMediaUrl,
                        sourceMediaKey: note.sourceMediaKey || null,
                        sourceMediaType: note.sourceMediaType || note.mediaType || null,
                        mediaType: note.mediaType || note.sourceMediaType || 'video'
                    }));
                    setTechnicalNotes(draftNotes);
                } else {
                    setTechnicalNotes([]);
                }
            }
        }
    }, [visible, loadSnapshot, prefillData, drafts.technicalNotes, drafts.highlights]);

    // ─────────────────────────────────────────────────────────────────────────
    // SAVE / SEND
    // ─────────────────────────────────────────────────────────────────────────

    const handleSave = async (send = false) => {
        if (highlights.length === 0 && technicalNotes.length === 0) {
            setModalMessage({
                title: '⚠️ Campos requeridos',
                message: 'Añade al menos un logro o nota técnica'
            });
            setShowValidationModal(true);
            return;
        }

        setSaving(true);
        try {
            const payload = {
                clientId: client._id,
                trafficLight,
                weekNumber: weekNumber || null,
                highlights: highlights.map(h => ({
                    text: h.text,
                    sourceMediaUrl: h.sourceMediaUrl || null,
                    sourceMediaKey: h.sourceMediaKey || null,
                    mediaType: h.mediaType || null,
                    exerciseName: h.exerciseName || null
                })),
                technicalNotes: technicalNotes.map(n => ({
                    text: n.text,
                    category: 'other',
                    sourceMediaUrl: n.sourceMediaUrl || null,
                    sourceMediaKey: n.sourceMediaKey || null, // 🆕 Key de R2 para regenerar URL
                    sourceMediaType: n.sourceMediaType || n.mediaType || null, // 🆕 Tipo de media
                    exerciseName: n.exerciseName || null,
                    videoUrl: n.videoUrl || null
                })),
                actionPlan: actionPlan.map(a => ({ text: a.text })),
                snapshotData: snapshotData || {},
                status: send ? 'sent' : 'draft'
            };

            const res = await fetch(`${API_URL}/api/feedback-reports`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                // Limpiar borradores después de enviar
                if (send) {
                    clearDrafts();
                }

                setModalMessage({
                    title: send ? '✅ Enviado' : '💾 Guardado',
                    message: send ? 'El feedback ha sido enviado al cliente' : 'Borrador guardado correctamente'
                });
                setShouldCloseOnSuccess(true);
                setShowSuccessModal(true);
            } else {
                setModalMessage({
                    title: 'Error',
                    message: data.message || 'No se pudo guardar'
                });
                setShowErrorModal(true);
            }
        } catch (error) {
            console.error('[FeedbackModal] Save error:', error);
            setModalMessage({
                title: 'Error',
                message: 'Error de conexión. Inténtalo de nuevo.'
            });
            setShowErrorModal(true);
        } finally {
            setSaving(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <KeyboardAvoidingView
                    style={styles.keyboardView}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                        <View style={styles.headerCenter}>
                            <Text style={styles.headerTitle}>📋 Nuevo Feedback</Text>
                            <Text style={styles.headerSubtitle}>{client?.nombre || 'Cliente'}</Text>
                        </View>
                        <View style={{ width: 40 }} />
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#8b5cf6" />
                            <Text style={styles.loadingText}>Cargando datos...</Text>
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.content}
                            contentContainerStyle={styles.contentInner}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Snapshot Preview (if available) */}
                            {snapshotData && (
                                <View style={styles.snapshotCard}>
                                    <Text style={styles.snapshotTitle}>📊 Métricas de la Semana</Text>
                                    <View style={styles.snapshotRow}>
                                        <View style={styles.snapshotItem}>
                                            <Text style={styles.snapshotValue}>{snapshotData.workoutsCompleted || 0}</Text>
                                            <Text style={styles.snapshotLabel}>Entrenos</Text>
                                        </View>
                                        <View style={styles.snapshotItem}>
                                            <Text style={styles.snapshotValue}>{snapshotData.weightAvg?.toFixed(1) || '--'}</Text>
                                            <Text style={styles.snapshotLabel}>Peso (kg)</Text>
                                        </View>
                                        <View style={styles.snapshotItem}>
                                            <Text style={styles.snapshotValue}>{snapshotData.compliancePercent || 0}%</Text>
                                            <Text style={styles.snapshotLabel}>Cumplimiento</Text>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Week Number */}
                            <View style={styles.weekInputRow}>
                                <Text style={styles.weekLabel}>Semana del plan:</Text>
                                <TextInput
                                    style={styles.weekInput}
                                    value={weekNumber}
                                    onChangeText={setWeekNumber}
                                    placeholder="Ej: 4 de 12"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>

                            {/* Traffic Light */}
                            <TrafficLightSelector
                                value={trafficLight}
                                onChange={setTrafficLight}
                            />

                            {/* Logros */}
                            <SectionHeader
                                emoji="✨"
                                title="Logros"
                                color="#10b981"
                                count={highlights.length}
                            />
                            <Text style={styles.sectionHint}>Lo que ha ido bien esta semana</Text>
                            <ItemInput
                                items={highlights}
                                setItems={setHighlights}
                                placeholder="Añadir logro..."
                                color="#10b981"
                                onViewMedia={(item) => setMediaPreviewItem(item)}
                            />

                            {/* Technical Notes */}
                            <SectionHeader
                                emoji="📊"
                                title="Análisis Técnico"
                                color="#3b82f6"
                                count={technicalNotes.length}
                            />
                            <Text style={styles.sectionHint}>Observaciones sobre entreno, nutrición, técnica...</Text>
                            <TechnicalNoteInput
                                items={technicalNotes}
                                setItems={setTechnicalNotes}
                                placeholder="Añadir nota técnica..."
                                color="#3b82f6"
                                onViewMedia={(item) => setMediaPreviewItem(item)}
                            />

                            {/* Action Plan */}
                            <SectionHeader
                                emoji="🎯"
                                title="Plan de Acción"
                                color="#f59e0b"
                                count={actionPlan.length}
                            />
                            <Text style={styles.sectionHint}>Qué hacer la próxima semana</Text>
                            <ItemInput
                                items={actionPlan}
                                setItems={setActionPlan}
                                placeholder="Añadir acción..."
                                color="#f59e0b"
                            />

                            <View style={{ height: 20 }} />
                        </ScrollView>
                    )}

                    {/* Footer Actions */}
                    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                        <TouchableOpacity
                            style={styles.draftBtn}
                            onPress={() => handleSave(false)}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#8b5cf6" />
                            ) : (
                                <>
                                    <Ionicons name="save-outline" size={18} color="#8b5cf6" />
                                    <Text style={styles.draftBtnText}>Guardar Borrador</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.sendBtn}
                            onPress={() => handleSave(true)}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="send" size={18} color="#fff" />
                                    <Text style={styles.sendBtnText}>Enviar</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>

            {/* Modal de validación */}
            <ConfirmModal
                visible={showValidationModal}
                onClose={() => setShowValidationModal(false)}
                onConfirm={() => { }}
                title={modalMessage.title}
                message={modalMessage.message}
                confirmText="Entendido"
                cancelText=""
                icon="alert-circle-outline"
            />

            {/* Modal de éxito */}
            <ConfirmModal
                visible={showSuccessModal}
                onClose={() => {
                    setShowSuccessModal(false);
                    if (shouldCloseOnSuccess) {
                        setShouldCloseOnSuccess(false);
                        onClose();
                    }
                }}
                onConfirm={() => { }}
                title={modalMessage.title}
                message={modalMessage.message}
                confirmText="OK"
                cancelText=""
                icon="checkmark-circle-outline"
            />

            {/* Modal de error */}
            <ConfirmModal
                visible={showErrorModal}
                onClose={() => setShowErrorModal(false)}
                onConfirm={() => { }}
                title={modalMessage.title}
                message={modalMessage.message}
                confirmText="Entendido"
                cancelText=""
                confirmStyle="destructive"
                icon="close-circle-outline"
            />

            {/* Media Preview Modal (video/foto del atleta) */}
            <Modal
                visible={!!mediaPreviewItem}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setMediaPreviewItem(null)}
            >
                <View style={styles.mediaPreviewOverlay}>
                    <View style={styles.mediaPreviewContainer}>
                        {/* Header */}
                        <View style={styles.mediaPreviewHeader}>
                            <View style={styles.mediaPreviewBadge}>
                                <Ionicons name="barbell" size={14} color="#3b82f6" />
                                <Text style={styles.mediaPreviewExercise}>
                                    {mediaPreviewItem?.exerciseName || 'Ejercicio'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setMediaPreviewItem(null)}
                                style={styles.mediaPreviewClose}
                            >
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {/* Media Content */}
                        <View style={styles.mediaPreviewContent}>
                            {mediaPreviewItem?.mediaType === 'photo' ? (
                                <Image
                                    source={{ uri: mediaPreviewItem?.sourceMediaUrl }}
                                    style={styles.mediaPreviewImage}
                                    contentFit="contain"
                                />
                            ) : (
                                <VideoPreviewPlayer
                                    uri={mediaPreviewItem?.sourceMediaUrl}
                                    style={styles.mediaPreviewVideo}
                                />
                            )}
                        </View>

                        {/* Current Note */}
                        <View style={styles.mediaPreviewNote}>
                            <Text style={styles.mediaPreviewNoteLabel}>Tu feedback:</Text>
                            <Text style={styles.mediaPreviewNoteText}>
                                {mediaPreviewItem?.text}
                            </Text>
                        </View>

                        {/* Actions */}
                        <View style={styles.mediaPreviewActions}>
                            <TouchableOpacity
                                style={styles.mediaPreviewEditBtn}
                                onPress={() => {
                                    // Abrir link externo como alternativa
                                    if (mediaPreviewItem?.sourceMediaUrl) {
                                        Linking.openURL(mediaPreviewItem.sourceMediaUrl);
                                    }
                                }}
                            >
                                <Ionicons name="open-outline" size={18} color="#64748b" />
                                <Text style={styles.mediaPreviewEditBtnText}>Abrir en navegador</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.mediaPreviewDoneBtn}
                                onPress={() => setMediaPreviewItem(null)}
                            >
                                <Text style={styles.mediaPreviewDoneBtnText}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#f8fafc'
    },
    keyboardView: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12
    },
    loadingText: {
        color: '#64748b',
        fontSize: 14
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
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b'
    },
    headerSubtitle: {
        fontSize: 13,
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

    // Snapshot
    snapshotCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0'
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

    // Week Input
    weekInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 12
    },
    weekLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b'
    },
    weekInput: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        fontSize: 14,
        color: '#1e293b'
    },

    // Traffic Light
    trafficContainer: {
        marginBottom: 24
    },
    trafficTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 12
    },
    trafficRow: {
        flexDirection: 'row',
        gap: 12
    },
    trafficOption: {
        flex: 1,
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0'
    },
    trafficIcon: {
        fontSize: 24,
        marginBottom: 4
    },
    trafficLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500'
    },

    // Section Header
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 12,
        borderLeftWidth: 4,
        marginTop: 16,
        marginBottom: 8
    },
    sectionEmoji: {
        fontSize: 18,
        marginRight: 8
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1
    },
    countBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    countText: {
        fontSize: 12,
        fontWeight: '700'
    },
    sectionHint: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 12,
        marginLeft: 16
    },

    // Item Input
    itemInputContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 8
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    itemDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 12
    },
    itemText: {
        flex: 1,
        fontSize: 14,
        color: '#1e293b'
    },
    itemRemove: {
        padding: 4
    },
    addItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 12
    },
    addItemInput: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    addItemBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },

    // Footer
    footer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        gap: 12
    },
    draftBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        backgroundColor: '#f5f3ff',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#8b5cf6'
    },
    draftBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#8b5cf6'
    },
    sendBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        backgroundColor: '#8b5cf6',
        borderRadius: 12
    },
    sendBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff'
    },

    // Imported Note Cards (from MediaFeedbackResponseModal)
    importedNoteCard: {
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: 0,
        borderWidth: 0,
        borderLeftWidth: 4,
        borderLeftColor: '#3b82f6',
        backgroundColor: '#eff6ff',
        borderRadius: 8,
        marginBottom: 8,
    },
    importedNoteContent: {
        flex: 1,
        padding: 12,
    },
    importedNoteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    importedNoteBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#dbeafe',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    importedNoteExercise: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1d4ed8',
        textTransform: 'uppercase',
    },
    importedNoteText: {
        fontSize: 14,
        color: '#1e293b',
        lineHeight: 20,
    },
    importedVideoTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
    },
    importedVideoText: {
        fontSize: 11,
        color: '#10b981',
        fontWeight: '500',
    },
    // Link para ver video original del atleta
    viewMediaLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        backgroundColor: '#f3e8ff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    viewMediaLinkText: {
        fontSize: 12,
        color: '#8b5cf6',
        fontWeight: '600',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // MEDIA PREVIEW MODAL STYLES
    // ═══════════════════════════════════════════════════════════════════════════

    mediaPreviewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    mediaPreviewContainer: {
        backgroundColor: '#1e293b',
        borderRadius: 20,
        width: '100%',
        maxWidth: 500,
        maxHeight: '90%',
        overflow: 'hidden',
    },
    mediaPreviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    mediaPreviewBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#dbeafe',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    mediaPreviewExercise: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1d4ed8',
        textTransform: 'uppercase',
    },
    mediaPreviewClose: {
        padding: 4,
    },
    mediaPreviewContent: {
        width: '100%',
        height: 280,
        backgroundColor: '#000',
    },
    mediaPreviewImage: {
        width: '100%',
        height: '100%',
    },
    mediaPreviewVideo: {
        width: '100%',
        height: '100%',
    },
    mediaPreviewNote: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    mediaPreviewNoteLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94a3b8',
        marginBottom: 6,
    },
    mediaPreviewNoteText: {
        fontSize: 14,
        color: '#e2e8f0',
        lineHeight: 20,
    },
    mediaPreviewActions: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    mediaPreviewEditBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    mediaPreviewEditBtnText: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '500',
    },
    mediaPreviewDoneBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#8b5cf6',
    },
    mediaPreviewDoneBtnText: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '600',
    },
});
