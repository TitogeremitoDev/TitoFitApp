/* app/(coach)/nutrition/templates.jsx - Gestión de Planes Nutricionales */

import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
    SectionList,
    Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import * as DocumentPicker from 'expo-document-picker';
import { uploadDietPdf, saveImportedDiet } from '../../../src/services/aiNutritionService';
import DietStagingModal from './components/DietStagingModal';

const DAY_COLORS = [
    '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
];

export default function NutritionTemplatesScreen() {
    const router = useRouter();
    const { token } = useAuth();

    const [templates, setTemplates] = useState([]);
    const [folders, setFolders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState({});

    // Modal para crear carpeta
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // AI PDF Import State
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showStagingModal, setShowStagingModal] = useState(false);
    const [parsedPlan, setParsedPlan] = useState(null);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    useFocusEffect(
        useCallback(() => {
            fetchTemplates();
        }, [])
    );

    const fetchTemplates = async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);

            const res = await fetch(`${API_URL}/api/nutrition-plans/templates/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setTemplates(data.templates || []);
                setFolders(data.folders || []);
                // Expand all folders by default
                const expanded = {};
                (data.folders || []).forEach(f => { expanded[f] = true; });
                expanded['__uncategorized__'] = true;
                setExpandedFolders(prev => ({ ...expanded, ...prev }));
            }

        } catch (error) {
            console.error('[Templates] Error:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchTemplates(true);
    };

    // Organizar templates por carpetas
    const sections = useMemo(() => {
        const result = [];

        // Templates sin carpeta
        const uncategorized = templates.filter(t => !t.folder);
        if (uncategorized.length > 0) {
            result.push({
                title: 'Sin carpeta',
                key: '__uncategorized__',
                data: uncategorized,
            });
        }

        // Templates por carpeta
        folders.forEach(folder => {
            const folderTemplates = templates.filter(t => t.folder === folder);
            if (folderTemplates.length > 0) {
                result.push({
                    title: folder,
                    key: folder,
                    data: folderTemplates,
                });
            }
        });

        return result;
    }, [templates, folders]);

    const toggleFolder = (key) => {
        setExpandedFolders(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const deleteTemplate = async (templateId) => {
        if (Platform.OS === 'web') {
            if (window.confirm('¿Estás seguro de que quieres eliminar este plan nutricional?')) {
                try {
                    const res = await fetch(`${API_URL}/api/nutrition-plans/templates/${templateId}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.success) {
                        setTemplates(templates.filter(t => t._id !== templateId));
                    }
                } catch (e) {
                    console.error('[Templates] Delete error:', e);
                }
            }
        } else {
            Alert.alert(
                'Eliminar plan',
                '¿Estás seguro de que quieres eliminar este plan nutricional?',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                const res = await fetch(`${API_URL}/api/nutrition-plans/templates/${templateId}`, {
                                    method: 'DELETE',
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                const data = await res.json();
                                if (data.success) {
                                    setTemplates(templates.filter(t => t._id !== templateId));
                                }
                            } catch (e) {
                                console.error('[Templates] Delete error:', e);
                            }
                        }
                    }
                ]
            );
        }
    };

    const createFolder = () => {
        if (!newFolderName.trim()) return;
        // Just add to local folders list - it will be used when creating templates
        if (!folders.includes(newFolderName.trim())) {
            setFolders([...folders, newFolderName.trim()]);
        }
        setNewFolderName('');
        setShowFolderModal(false);
    };

    const handleImportPdf = async () => {
        try {
            console.log('Pick document...');
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const file = result.assets[0];
            setIsUploading(true);

            // Upload and Parse - We pass the full result object now
            const response = await uploadDietPdf(result, token);

            if (response.success) {
                setParsedPlan(response.plan);
                setShowStagingModal(true);
            } else {
                Alert.alert('Error', response.message || 'No se pudo importar el plan.');
            }

        } catch (error) {
            console.error('Import Error:', error);
            Alert.alert('Error', 'Falló la importación del archivo.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleConfirmImport = async () => {
        // Real Save Logic
        try {
            setIsSaving(true); // Pass this to modal if needed, or manage modal prop
            // Note: Since dietStagingModal has its own isSaving prop, 
            // we should probably just set a state here that is passed down to it.
            // Oh wait, I am in templates.jsx scope. I need a state here usually.
            // But let's check current state definitions. 
            // Ah, I don't have isSaving state defined in templates.jsx yet, only isUploading.

            // Calling the new service
            const response = await saveImportedDiet(parsedPlan, token);

            if (response.success) {
                Alert.alert('Éxito', 'Plan guardado correctamente.');
                setShowStagingModal(false);
                fetchTemplates(); // Refresh list to show new template!
            } else {
                Alert.alert('Error', response.message || 'No se pudo guardar el plan.');
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Error desconocido al guardar.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderSectionHeader = ({ section }) => (
        <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleFolder(section.key)}
        >
            <View style={styles.sectionHeaderLeft}>
                <Ionicons
                    name={section.key === '__uncategorized__' ? 'documents-outline' : 'folder'}
                    size={20}
                    color="#8b5cf6"
                />
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionCount}>
                    <Text style={styles.sectionCountText}>{section.data.length}</Text>
                </View>
            </View>
            <Ionicons
                name={expandedFolders[section.key] ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#64748b"
            />
        </TouchableOpacity>
    );

    const renderTemplateCard = ({ item, section }) => {
        if (!expandedFolders[section.key]) return null;

        const dayCount = item.customPlan?.dayTargets?.length || 0;
        const firstDay = item.customPlan?.dayTargets?.[0];

        return (
            <TouchableOpacity
                style={styles.templateCard}
                onPress={() => router.push({
                    pathname: '/(coach)/nutrition/template-editor',
                    params: { templateId: item._id }
                })}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: DAY_COLORS[0] + '20' }]}>
                        <Ionicons name="document-text" size={24} color={DAY_COLORS[0]} />
                    </View>
                    <View style={styles.cardInfo}>
                        <Text style={styles.templateName}>{item.name || 'Sin nombre'}</Text>
                        {item.description ? (
                            <Text style={styles.templateDesc} numberOfLines={1}>
                                {item.description}
                            </Text>
                        ) : null}
                    </View>
                    <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => deleteTemplate(item._id)}
                    >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                </View>

                <View style={styles.cardStats}>
                    <View style={styles.stat}>
                        <Ionicons name="calendar-outline" size={14} color="#64748b" />
                        <Text style={styles.statText}>{dayCount} tipos de día</Text>
                    </View>
                    {firstDay?.kcal ? (
                        <View style={styles.stat}>
                            <Ionicons name="flame-outline" size={14} color="#ef4444" />
                            <Text style={styles.statText}>{firstDay.kcal} kcal</Text>
                        </View>
                    ) : null}
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="nutrition-outline" size={80} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Sin Planes</Text>
            <Text style={styles.emptyText}>
                Crea planes nutricionales para reutilizarlos con tus clientes.
            </Text>
        </View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <CoachHeader title="Planes Nutricionales" showBack />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#22c55e" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader title="Planes Nutricionales" showBack />

            {/* Action Buttons Row */}
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 12 }}>
                <TouchableOpacity
                    style={[styles.createFolderBtn, { flex: 1, marginHorizontal: 0 }]}
                    onPress={() => setShowFolderModal(true)}
                >
                    <Ionicons name="folder-open-outline" size={18} color="#8b5cf6" />
                    <Text style={styles.createFolderBtnText}>Nueva Carpeta</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.createFolderBtn, { flex: 1, marginHorizontal: 0, backgroundColor: '#22c55e15', borderColor: '#22c55e30' }]}
                    onPress={handleImportPdf}
                    disabled={isUploading}
                >
                    {isUploading ? <ActivityIndicator size="small" color="#22c55e" /> : <Ionicons name="cloud-upload-outline" size={18} color="#22c55e" />}
                    <Text style={[styles.createFolderBtnText, { color: '#22c55e' }]}>
                        {isUploading ? 'Analizando...' : 'Importar PDF'}
                    </Text>
                </TouchableOpacity>
            </View>

            {templates.length === 0 ? (
                renderEmpty()
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item._id}
                    renderSectionHeader={renderSectionHeader}
                    renderItem={renderTemplateCard}
                    contentContainerStyle={styles.listContent}
                    stickySectionHeadersEnabled={false}
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                />
            )}

            {/* FAB para crear nuevo plan */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/(coach)/nutrition/template-editor')}
            >
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Modal para crear carpeta */}
            <Modal
                visible={showFolderModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowFolderModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Nueva Carpeta</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            placeholder="Nombre de la carpeta"
                            placeholderTextColor="#94a3b8"
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => {
                                    setNewFolderName('');
                                    setShowFolderModal(false);
                                }}
                            >
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalCreateBtn}
                                onPress={createFolder}
                            >
                                <Text style={styles.modalCreateText}>Crear</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* AI Staging Modal */}
            <DietStagingModal
                visible={showStagingModal}
                plan={parsedPlan}
                onClose={() => setShowStagingModal(false)}
                onConfirm={handleConfirmImport}
                isSaving={isSaving}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    createFolderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8b5cf615',
        marginHorizontal: 16,
        marginTop: 12,
        padding: 10,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: '#8b5cf630',
    },
    createFolderBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8b5cf6',
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    sectionCount: {
        backgroundColor: '#8b5cf620',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    sectionCountText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8b5cf6',
    },
    templateCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        marginLeft: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardInfo: {
        flex: 1,
    },
    templateName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    templateDesc: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    deleteBtn: {
        padding: 8,
    },
    cardStats: {
        flexDirection: 'row',
        gap: 16,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 12,
        color: '#64748b',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 16,
    },
    emptyText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    modalCreateBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        backgroundColor: '#8b5cf6',
        alignItems: 'center',
    },
    modalCreateText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});
