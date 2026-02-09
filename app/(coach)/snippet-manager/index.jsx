/**
 * snippet-manager/index.jsx
 * CMS para que el entrenador gestione sus respuestas rápidas (snippets)
 * Incluye colores por categoría, contador de usos, y clonado de plantillas
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, SafeAreaView, Modal, RefreshControl,
    Platform, useWindowDimensions, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { EnhancedTextInput } from '../../../components/ui';
import CoachHeader from '../components/CoachHeader';
import * as Clipboard from 'expo-clipboard';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// Categorías con colores
const CATEGORIES = {
    correction: { name: '🔴 Corrección', color: '#ef4444', icon: 'alert-circle' },
    praise: { name: '🟢 Bien hecho', color: '#22c55e', icon: 'checkmark-circle' },
    tip: { name: '🔵 Consejo', color: '#3b82f6', icon: 'bulb' },
    general: { name: '⚪ General', color: '#64748b', icon: 'chatbubble' }
};

export default function SnippetManagerScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const { width: screenWidth } = useWindowDimensions();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [snippets, setSnippets] = useState([]);
    const [grouped, setGrouped] = useState({});
    const [total, setTotal] = useState(0);
    const [totalUsage, setTotalUsage] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSnippet, setEditingSnippet] = useState(null);
    const [cloning, setCloning] = useState(false);

    // Modales de confirmación
    const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: null, confirmText: 'Confirmar', danger: false });
    const [infoModal, setInfoModal] = useState({ visible: false, title: '', message: '' });

    // Form state
    const [formCategory, setFormCategory] = useState('general');
    const [formShortLabel, setFormShortLabel] = useState('');
    const [formText, setFormText] = useState('');
    const [formTags, setFormTags] = useState('');
    const [saving, setSaving] = useState(false);

    // Responsive
    const isLargeScreen = screenWidth > 768;

    // Helpers para modales
    const showInfo = (title, message) => {
        setInfoModal({ visible: true, title, message });
    };

    const showConfirm = (title, message, onConfirm, confirmText = 'Confirmar', danger = false) => {
        setConfirmModal({ visible: true, title, message, onConfirm, confirmText, danger });
    };

    // Cargar snippets
    const loadSnippets = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/trainer-snippets/trainer`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setSnippets(data.snippets || []);
                setGrouped(data.grouped || {});
                setTotal(data.total || 0);
                setTotalUsage(data.totalUsage || 0);
            }
        } catch (error) {
            console.error('[SnippetManager] Error:', error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { loadSnippets(); }, [loadSnippets]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadSnippets();
        setRefreshing(false);
    };

    // Clonar plantillas
    const handleCloneDefaults = () => {
        if (total > 0) {
            showInfo('Ya tienes snippets', 'Para importar las plantillas base, primero elimina tus snippets actuales.');
            return;
        }

        showConfirm(
            'Importar Plantillas',
            '¿Importar 98 respuestas rápidas predefinidas? Podrás editarlas después.',
            async () => {
                setCloning(true);
                try {
                    const res = await fetch(`${API_URL}/api/trainer-snippets/clone-defaults`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.success) {
                        showInfo('✅ Éxito', data.message);
                        loadSnippets();
                    } else {
                        showInfo('Error', data.message);
                    }
                } catch (error) {
                    showInfo('Error', 'No se pudieron importar las plantillas');
                } finally {
                    setCloning(false);
                }
            },
            'Importar'
        );
    };

    // Abrir modal para crear/editar
    const openModal = (snippet = null) => {
        if (snippet) {
            setEditingSnippet(snippet);
            setFormCategory(snippet.category);
            setFormShortLabel(snippet.shortLabel);
            setFormText(snippet.text);
            setFormTags(snippet.tags?.join(', ') || '');
        } else {
            setEditingSnippet(null);
            setFormCategory('general');
            setFormShortLabel('');
            setFormText('');
            setFormTags('');
        }
        setModalVisible(true);
    };

    // Guardar snippet
    const handleSave = async () => {
        if (!formShortLabel.trim() || !formText.trim()) {
            showInfo('Error', 'Etiqueta y texto son obligatorios');
            return;
        }

        setSaving(true);
        const tags = formTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

        try {
            const url = editingSnippet
                ? `${API_URL}/api/trainer-snippets/${editingSnippet._id}`
                : `${API_URL}/api/trainer-snippets`;

            const res = await fetch(url, {
                method: editingSnippet ? 'PUT' : 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    category: formCategory,
                    shortLabel: formShortLabel.trim(),
                    text: formText.trim(),
                    tags
                })
            });
            const data = await res.json();
            if (data.success) {
                setModalVisible(false);
                loadSnippets();
            } else {
                showInfo('Error', data.message);
            }
        } catch (error) {
            showInfo('Error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    // Eliminar snippet
    const handleDelete = (snippet) => {
        if (snippet.isSystemDefault) {
            showInfo('No permitido', 'No puedes eliminar snippets del sistema.');
            return;
        }

        showConfirm(
            'Eliminar Snippet',
            `¿Eliminar "${snippet.shortLabel}"?`,
            async () => {
                try {
                    await fetch(`${API_URL}/api/trainer-snippets/${snippet._id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    loadSnippets();
                } catch (error) {
                    showInfo('Error', 'No se pudo eliminar');
                }
            },
            'Eliminar',
            true
        );
    };

    // Copiar texto del snippet
    const handleCopy = async (snippet) => {
        try {
            await Clipboard.setStringAsync(snippet.text);
            // Incrementar uso
            fetch(`${API_URL}/api/trainer-snippets/use/${snippet._id}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            showInfo('✅ Copiado', 'Texto copiado al portapapeles');
        } catch (error) {
            showInfo('Error', 'No se pudo copiar');
        }
    };

    // Obtener snippets filtrados
    const getDisplaySnippets = () => {
        return selectedCategory ? (grouped[selectedCategory] || []) : snippets;
    };

    const displaySnippets = getDisplaySnippets();

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#f59e0b" />
                    <Text style={styles.loadingText}>Cargando snippets...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Respuestas Rápidas"
                subtitle="Snippets para feedback"
                icon="flash"
                iconColor="#f59e0b"
            />

            {/* Stats Bar */}
            <View style={styles.statsBar}>
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{total}</Text>
                    <Text style={styles.statLabel}>Snippets</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#22c55e' }]}>{totalUsage}</Text>
                    <Text style={styles.statLabel}>Usos totales</Text>
                </View>
                <TouchableOpacity
                    style={[styles.actionBtn, cloning && { opacity: 0.6 }]}
                    onPress={handleCloneDefaults}
                    disabled={cloning}
                >
                    {cloning ? (
                        <ActivityIndicator size="small" color="#f59e0b" />
                    ) : (
                        <>
                            <Ionicons name="download-outline" size={18} color="#f59e0b" />
                            <Text style={styles.actionBtnText}>Importar Base</Text>
                        </>
                    )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
                    <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Category Filter */}
            <View style={styles.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
                    <TouchableOpacity
                        style={[styles.filterBtn, !selectedCategory && styles.filterBtnActive]}
                        onPress={() => setSelectedCategory(null)}
                    >
                        <Text style={[styles.filterBtnText, !selectedCategory && styles.filterBtnTextActive]}>Todas</Text>
                    </TouchableOpacity>
                    {Object.entries(CATEGORIES).map(([key, config]) => (
                        <TouchableOpacity
                            key={key}
                            style={[styles.filterBtn, selectedCategory === key && { backgroundColor: config.color, borderColor: config.color }]}
                            onPress={() => setSelectedCategory(selectedCategory === key ? null : key)}
                        >
                            <Text style={[styles.filterBtnText, selectedCategory === key && { color: '#fff' }]}>{config.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Snippet List */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
            >
                {displaySnippets.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="flash-outline" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No hay snippets</Text>
                        <Text style={styles.emptySubtitle}>Pulsa "Importar Base" para cargar 98 respuestas predefinidas</Text>
                    </View>
                ) : (
                    displaySnippets.map((snippet) => (
                        <View key={snippet._id} style={styles.snippetCard}>
                            {/* Color bar left */}
                            <View style={[styles.snippetCatIndicator, { backgroundColor: CATEGORIES[snippet.category]?.color || '#64748b' }]} />

                            {/* Main content */}
                            <View style={styles.snippetMain}>
                                {/* Header */}
                                <View style={styles.snippetHeader}>
                                    <Text style={styles.snippetLabel} numberOfLines={1}>{snippet.shortLabel}</Text>
                                    <View style={styles.usageTag}>
                                        <Ionicons name="analytics-outline" size={12} color="#64748b" />
                                        <Text style={styles.usageText}>{snippet.usageCount || 0}</Text>
                                    </View>
                                </View>

                                {/* Body text */}
                                <Text style={styles.snippetText} numberOfLines={2}>{snippet.text}</Text>

                                {/* Tags and Actions row */}
                                <View style={styles.snippetFooter}>
                                    {/* Tags */}
                                    <View style={styles.tagRow}>
                                        {snippet.tags?.slice(0, 2).map((tag, i) => (
                                            <View key={i} style={styles.tag}>
                                                <Text style={styles.tagText}>{tag}</Text>
                                            </View>
                                        ))}
                                        {snippet.tags?.length > 2 && (
                                            <Text style={styles.moreTags}>+{snippet.tags.length - 2}</Text>
                                        )}
                                    </View>

                                    {/* Actions */}
                                    <View style={styles.snippetActions}>
                                        <TouchableOpacity onPress={() => handleCopy(snippet)} style={styles.snippetActionBtn}>
                                            <Ionicons name="copy-outline" size={18} color="#22c55e" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => openModal(snippet)} style={styles.snippetActionBtn}>
                                            <Ionicons name="create-outline" size={18} color="#3b82f6" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDelete(snippet)} style={styles.snippetActionBtn}>
                                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Create/Edit Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, isLargeScreen && { maxWidth: 600 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingSnippet ? 'Editar Snippet' : 'Nuevo Snippet'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.inputLabel}>Categoría</Text>
                            <View style={styles.catGrid}>
                                {Object.entries(CATEGORIES).map(([key, config]) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={[styles.catOption, formCategory === key && { backgroundColor: config.color, borderColor: config.color }]}
                                        onPress={() => setFormCategory(key)}
                                    >
                                        <Text style={[styles.catOptionText, formCategory === key && { color: '#fff' }]}>{config.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Etiqueta corta *</Text>
                            <EnhancedTextInput
                                containerStyle={styles.inputContainer}
                                style={styles.inputText}
                                value={formShortLabel}
                                onChangeText={setFormShortLabel}
                                placeholder="Ej: Rodillas Valgas"
                                placeholderTextColor="#94a3b8"
                                maxLength={50}
                            />

                            <Text style={styles.inputLabel}>Texto completo *</Text>
                            <EnhancedTextInput
                                containerStyle={[styles.inputContainer, styles.textAreaContainer]}
                                style={[styles.inputText, styles.textAreaText]}
                                value={formText}
                                onChangeText={setFormText}
                                placeholder="El texto que se insertará al pulsar..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                numberOfLines={6}
                            />

                            <Text style={styles.inputLabel}>Tags (separados por coma)</Text>
                            <EnhancedTextInput
                                containerStyle={styles.inputContainer}
                                style={styles.inputText}
                                value={formTags}
                                onChangeText={setFormTags}
                                placeholder="sentadilla, rodilla, técnica"
                                placeholderTextColor="#94a3b8"
                            />
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.saveButton, saving && { opacity: 0.6 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveButtonText}>{editingSnippet ? 'Guardar Cambios' : 'Crear Snippet'}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Info Modal */}
            <Modal visible={infoModal.visible} animationType="fade" transparent>
                <View style={styles.alertOverlay}>
                    <View style={styles.alertCard}>
                        <Text style={styles.alertTitle}>{infoModal.title}</Text>
                        <Text style={styles.alertMessage}>{infoModal.message}</Text>
                        <TouchableOpacity
                            style={styles.alertBtn}
                            onPress={() => setInfoModal({ visible: false, title: '', message: '' })}
                        >
                            <Text style={styles.alertBtnText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Confirm Modal */}
            <Modal visible={confirmModal.visible} animationType="fade" transparent>
                <View style={styles.alertOverlay}>
                    <View style={styles.alertCard}>
                        <Text style={styles.alertTitle}>{confirmModal.title}</Text>
                        <Text style={styles.alertMessage}>{confirmModal.message}</Text>
                        <View style={styles.alertBtns}>
                            <TouchableOpacity
                                style={[styles.alertBtn, styles.alertBtnCancel]}
                                onPress={() => setConfirmModal({ ...confirmModal, visible: false })}
                            >
                                <Text style={styles.alertBtnCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.alertBtn, confirmModal.danger && styles.alertBtnDanger]}
                                onPress={() => {
                                    setConfirmModal({ ...confirmModal, visible: false });
                                    confirmModal.onConfirm?.();
                                }}
                            >
                                <Text style={styles.alertBtnText}>{confirmModal.confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: '#64748b' },

    // Stats Bar
    statsBar: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0'
    },
    statItem: { alignItems: 'center', paddingHorizontal: 16 },
    statNumber: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
    statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
    statDivider: { width: 1, height: 32, backgroundColor: '#e2e8f0' },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#fffbeb', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginLeft: 12, gap: 6
    },
    actionBtnText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
    addBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: '#f59e0b',
        justifyContent: 'center', alignItems: 'center', marginLeft: 8
    },

    // Filter
    filterRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    filterContent: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
    filterBtn: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8
    },
    filterBtnActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
    filterBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    filterBtnTextActive: { color: '#fff' },

    // Content
    content: { flex: 1 },
    contentContainer: { padding: 16 },

    // Empty
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#64748b', marginTop: 16 },
    emptySubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 8, textAlign: 'center' },

    // Snippet Card - Professional Design
    snippetCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2
    },
    snippetCatIndicator: {
        width: 5,
        alignSelf: 'stretch'
    },
    snippetMain: {
        flex: 1,
        padding: 14
    },
    snippetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6
    },
    snippetLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        marginRight: 8
    },
    usageTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    usageText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    snippetText: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
        marginBottom: 10
    },
    snippetFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 5
    },
    tag: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    tagText: { fontSize: 10, color: '#64748b' },
    moreTags: { fontSize: 10, color: '#94a3b8' },
    snippetActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2
    },
    snippetActionBtn: {
        padding: 6,
        borderRadius: 8
    },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalContent: { backgroundColor: '#fff', borderRadius: 24, maxHeight: Dimensions.get('window').height * 0.9, width: '100%', alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
    modalCloseBtn: { padding: 4 },
    modalBody: { padding: 20 },

    inputLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8, marginTop: 16 },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catOption: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 4 },
    catOptionText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    inputContainer: {
        backgroundColor: '#f8fafc', padding: 14, borderRadius: 12,
        borderWidth: 1, borderColor: '#e2e8f0'
    },
    inputText: {
        color: '#1e293b', fontSize: 15,
        ...(Platform.OS === 'web' && { outlineStyle: 'none' })
    },
    textAreaContainer: { minHeight: 100, maxHeight: 200 },
    textAreaText: { textAlignVertical: 'top' },

    saveButton: { backgroundColor: '#f59e0b', padding: 16, margin: 20, borderRadius: 12, alignItems: 'center' },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Alert modals
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    alertCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
    alertTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12, textAlign: 'center' },
    alertMessage: { fontSize: 15, color: '#64748b', lineHeight: 22, textAlign: 'center', marginBottom: 24 },
    alertBtns: { flexDirection: 'row', gap: 12 },
    alertBtn: { flex: 1, backgroundColor: '#f59e0b', padding: 14, borderRadius: 12, alignItems: 'center' },
    alertBtnCancel: { backgroundColor: '#f1f5f9' },
    alertBtnDanger: { backgroundColor: '#ef4444' },
    alertBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    alertBtnCancelText: { color: '#64748b', fontSize: 15, fontWeight: '600' }
});
