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
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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

const ItemInput = ({ items, setItems, placeholder, color }) => {
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
            {/* Existing Items */}
            {items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                    <View style={[styles.itemDot, { backgroundColor: color }]} />
                    <Text style={styles.itemText}>{item.text}</Text>
                    <TouchableOpacity
                        onPress={() => removeItem(item.id)}
                        style={styles.itemRemove}
                    >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </TouchableOpacity>
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
                // Pre-fill from FAB data
                setTrafficLight(prefillData.trafficLight || 'green');
                setHighlights(
                    (prefillData.highlights || []).map((text, i) => ({
                        text: typeof text === 'string' ? text : text.text,
                        id: `prefill-h-${i}`
                    }))
                );
                setTechnicalNotes(
                    (prefillData.analysis ? [prefillData.analysis] : []).map((text, i) => ({
                        text: typeof text === 'string' ? text : text.text,
                        id: `prefill-n-${i}`
                    }))
                );
                setActionPlan(
                    (prefillData.actionItems || []).map((text, i) => ({
                        text: typeof text === 'string' ? text : text.text,
                        id: `prefill-a-${i}`
                    }))
                );
            } else {
                // Reset form
                setTrafficLight('green');
                setWeekNumber('');
                setHighlights([]);
                setTechnicalNotes([]);
                setActionPlan([]);
            }
        }
    }, [visible, loadSnapshot, prefillData]);

    // ─────────────────────────────────────────────────────────────────────────
    // SAVE / SEND
    // ─────────────────────────────────────────────────────────────────────────

    const handleSave = async (send = false) => {
        if (highlights.length === 0 && technicalNotes.length === 0) {
            Alert.alert('⚠️', 'Añade al menos un highlight o nota técnica');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                clientId: client._id,
                trafficLight,
                weekNumber: weekNumber || null,
                highlights: highlights.map(h => ({ text: h.text })),
                technicalNotes: technicalNotes.map(n => ({ text: n.text, category: 'other' })),
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
                Alert.alert(
                    send ? '✅ Enviado' : '💾 Guardado',
                    send ? 'El feedback ha sido enviado al cliente' : 'Borrador guardado',
                    [{ text: 'OK', onPress: onClose }]
                );
            } else {
                Alert.alert('Error', data.message || 'No se pudo guardar');
            }
        } catch (error) {
            console.error('[FeedbackModal] Save error:', error);
            Alert.alert('Error', 'Error de conexión');
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
            <KeyboardAvoidingView
                style={[styles.container, { paddingTop: insets.top }]}
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

                        {/* Highlights */}
                        <SectionHeader
                            emoji="✨"
                            title="Highlights"
                            color="#10b981"
                            count={highlights.length}
                        />
                        <Text style={styles.sectionHint}>Lo que ha ido bien esta semana</Text>
                        <ItemInput
                            items={highlights}
                            setItems={setHighlights}
                            placeholder="Añadir highlight..."
                            color="#10b981"
                        />

                        {/* Technical Notes */}
                        <SectionHeader
                            emoji="📊"
                            title="Análisis Técnico"
                            color="#3b82f6"
                            count={technicalNotes.length}
                        />
                        <Text style={styles.sectionHint}>Observaciones sobre entreno, nutrición, técnica...</Text>
                        <ItemInput
                            items={technicalNotes}
                            setItems={setTechnicalNotes}
                            placeholder="Añadir nota técnica..."
                            color="#3b82f6"
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

                        <View style={{ height: 100 }} />
                    </ScrollView>
                )}

                {/* Footer Actions */}
                <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
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
    }
});
