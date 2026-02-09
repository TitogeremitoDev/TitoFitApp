/* app/(coach)/nutrition/templates.jsx - Gestión de Planes Nutricionales */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Modal,
    SectionList,
    Platform,
} from 'react-native';
import { EnhancedTextInput } from '../../../components/ui';
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

    // New Plan Type Modal
    const [showNewPlanModal, setShowNewPlanModal] = useState(false);

    // AI Progress State
    const [aiProgressMessage, setAiProgressMessage] = useState('');
    const [aiShowRetry, setAiShowRetry] = useState(false);
    const [lastPickedFile, setLastPickedFile] = useState(null);
    const aiAbortControllerRef = useRef(null);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

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

    // Mensajes progresivos para la importación de IA (hasta 120s)
    const AI_PROGRESS_MESSAGES = [
        { time: 0, message: 'Subiendo archivo...' },
        { time: 3000, message: 'Extrayendo texto del documento...' },
        { time: 8000, message: 'Analizando estructura del plan...' },
        { time: 15000, message: 'Identificando comidas y alimentos...' },
        { time: 25000, message: 'Calculando valores nutricionales...' },
        { time: 40000, message: 'Procesando con IA (esto puede tardar)...' },
        { time: 60000, message: 'Tardando más de lo esperado...' },
        { time: 80000, message: 'Casi listo, un momento más...' },
        { time: 100000, message: 'Finalizando proceso...' },
    ];

    const handleImportPdf = async (retryFile = null) => {
        try {
            let result = retryFile;

            if (!retryFile) {
                console.log('Pick document...');
                result = await DocumentPicker.getDocumentAsync({
                    type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
                    copyToCacheDirectory: true
                });

                if (result.canceled) return;
            }

            // Guardar archivo para posible retry
            setLastPickedFile(result);
            setAiShowRetry(false);

            // Cancelar petición anterior si existe
            if (aiAbortControllerRef.current) {
                aiAbortControllerRef.current.abort();
            }

            // Crear nuevo AbortController
            const abortController = new AbortController();
            aiAbortControllerRef.current = abortController;

            setIsUploading(true);
            setAiProgressMessage(AI_PROGRESS_MESSAGES[0].message);

            // Configurar mensajes progresivos
            const progressTimeouts = [];
            AI_PROGRESS_MESSAGES.slice(1).forEach(({ time, message }) => {
                const timeout = setTimeout(() => {
                    if (!abortController.signal.aborted) {
                        setAiProgressMessage(message);
                    }
                }, time);
                progressTimeouts.push(timeout);
            });

            // Timeout de 120 segundos (el proceso de IA es muy largo)
            const timeoutId = setTimeout(() => {
                abortController.abort();
            }, 120000);

            // Upload and Parse - We pass the full result object now
            const response = await uploadDietPdf(result, token, abortController.signal);

            // Limpiar timeouts
            clearTimeout(timeoutId);
            progressTimeouts.forEach(t => clearTimeout(t));

            if (response.success) {
                setParsedPlan(response.plan);
                setShowStagingModal(true);
                setLastPickedFile(null);
            } else {
                setAiShowRetry(true);
                Alert.alert('Error', response.message || 'No se pudo importar el plan.');
            }

        } catch (error) {
            console.error('Import Error:', error);

            if (error.name === 'AbortError') {
                setAiShowRetry(true);
                Alert.alert(
                    'Timeout',
                    'La solicitud ha tardado demasiado. ¿Quieres intentarlo de nuevo?',
                    [
                        { text: 'Cancelar', style: 'cancel', onPress: () => setAiShowRetry(false) },
                        { text: 'Reintentar', onPress: () => handleImportPdf(lastPickedFile) }
                    ]
                );
            } else {
                setAiShowRetry(true);
                Alert.alert('Error', 'Falló la importación del archivo.');
            }
        } finally {
            setIsUploading(false);
            setAiProgressMessage('');
            aiAbortControllerRef.current = null;
        }
    };

    const handleCancelImport = () => {
        if (aiAbortControllerRef.current) {
            aiAbortControllerRef.current.abort();
        }
        setIsUploading(false);
        setAiProgressMessage('');
        setAiShowRetry(false);
    };

    const handleConfirmImport = async (finalPlan) => {
        // Use the edited plan from the staging modal (includes auto-fetched images)
        const planToSave = finalPlan || parsedPlan;

        try {
            setIsSaving(true);

            // Calling the new service with the edited plan
            const response = await saveImportedDiet(planToSave, token);

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

        // Detect template type
        const isMealPlan = item.planType === 'complete' ||
            (item.dayTemplates && item.dayTemplates.length > 0 && item.dayTemplates[0]?.meals?.length > 0);

        const dayCount = isMealPlan
            ? (item.dayTemplates?.length || 0)
            : (item.customPlan?.dayTargets?.length || 0);

        const firstDayKcal = isMealPlan
            ? (item.dayTemplates?.[0]?.targetMacros?.kcal || 0)
            : (item.customPlan?.dayTargets?.[0]?.kcal || 0);

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
                    <View style={[styles.iconContainer, { backgroundColor: isMealPlan ? '#22c55e20' : DAY_COLORS[0] + '20' }]}>
                        <Ionicons name={isMealPlan ? 'restaurant' : 'create'} size={24} color={isMealPlan ? '#22c55e' : DAY_COLORS[0]} />
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
                        <Ionicons name={isMealPlan ? 'restaurant-outline' : 'calendar-outline'} size={14} color="#64748b" />
                        <Text style={styles.statText}>
                            {isMealPlan ? `${dayCount} días · Completa` : `${dayCount} tipos de día · Flex`}
                        </Text>
                    </View>
                    {firstDayKcal ? (
                        <View style={styles.stat}>
                            <Ionicons name="flame-outline" size={14} color="#ef4444" />
                            <Text style={styles.statText}>{Math.round(firstDayKcal)} kcal</Text>
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
                    onPress={() => handleImportPdf()}
                    disabled={isUploading}
                >
                    {isUploading ? <ActivityIndicator size="small" color="#22c55e" /> : <Ionicons name="cloud-upload-outline" size={18} color="#22c55e" />}
                    <Text style={[styles.createFolderBtnText, { color: '#22c55e' }]}>
                        {isUploading ? 'Procesando...' : 'Importar PDF'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* AI Progress Banner */}
            {isUploading && aiProgressMessage && (
                <View style={styles.aiProgressBanner}>
                    <View style={styles.aiProgressContent}>
                        <ActivityIndicator size="small" color="#22c55e" style={{ marginRight: 10 }} />
                        <Text style={styles.aiProgressText}>{aiProgressMessage}</Text>
                    </View>
                    <TouchableOpacity onPress={handleCancelImport} style={styles.aiCancelBtn}>
                        <Text style={styles.aiCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Retry Banner */}
            {!isUploading && aiShowRetry && lastPickedFile && (
                <View style={styles.aiRetryBanner}>
                    <Text style={styles.aiRetryText}>La importación falló</Text>
                    <TouchableOpacity onPress={() => handleImportPdf(lastPickedFile)} style={styles.aiRetryBtn}>
                        <Ionicons name="refresh" size={14} color="#22c55e" />
                        <Text style={styles.aiRetryBtnText}>Reintentar</Text>
                    </TouchableOpacity>
                </View>
            )}

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
                onPress={() => setShowNewPlanModal(true)}
            >
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Modal para elegir tipo de plan */}
            <Modal
                visible={showNewPlanModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowNewPlanModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Nuevo Plan Nutricional</Text>
                        <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
                            Selecciona el tipo de plan que quieres crear
                        </Text>

                        <TouchableOpacity
                            style={{ backgroundColor: '#f0fdf4', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#22c55e30' }}
                            onPress={() => {
                                setShowNewPlanModal(false);
                                router.push({ pathname: '/(coach)/nutrition/template-editor', params: { mode: 'mealplan' } });
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <Ionicons name="restaurant" size={22} color="#22c55e" />
                                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b' }}>Dieta Completa</Text>
                            </View>
                            <Text style={{ fontSize: 12, color: '#64748b', marginLeft: 32 }}>
                                Plan con comidas y alimentos detallados
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#3b82f630' }}
                            onPress={() => {
                                setShowNewPlanModal(false);
                                router.push({ pathname: '/(coach)/nutrition/template-editor', params: { mode: 'custom' } });
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <Ionicons name="create" size={22} color="#3b82f6" />
                                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b' }}>Plan Flex</Text>
                            </View>
                            <Text style={{ fontSize: 12, color: '#64748b', marginLeft: 32 }}>
                                Solo objetivos de macros por tipo de día
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalCancelBtn}
                            onPress={() => setShowNewPlanModal(false)}
                        >
                            <Text style={styles.modalCancelText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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
                        <EnhancedTextInput
                            containerStyle={styles.modalInputContainer}
                            style={styles.modalInputText}
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
    modalInputContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 16,
    },
    modalInputText: {
        fontSize: 15,
        color: '#1e293b',
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

    // AI Progress Styles
    aiProgressBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f0fdf4',
        marginHorizontal: 16,
        marginTop: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    aiProgressContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    aiProgressText: {
        fontSize: 13,
        color: '#166534',
        fontWeight: '500',
        flex: 1,
    },
    aiCancelBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#dcfce7',
    },
    aiCancelText: {
        fontSize: 12,
        color: '#15803d',
        fontWeight: '600',
    },
    aiRetryBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fef2f2',
        marginHorizontal: 16,
        marginTop: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    aiRetryText: {
        fontSize: 13,
        color: '#dc2626',
        fontWeight: '500',
    },
    aiRetryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    aiRetryBtnText: {
        fontSize: 12,
        color: '#22c55e',
        fontWeight: '600',
    },
});
