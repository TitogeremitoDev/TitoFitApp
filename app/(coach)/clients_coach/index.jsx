import React, { useState, useEffect, useCallback } from 'react';
import {
    Modal, View, Text, StyleSheet, SafeAreaView, FlatList, RefreshControl,
    ActivityIndicator, TouchableOpacity, LayoutAnimation, Platform, UIManager, TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import FeedbackChatModal from '../../../components/FeedbackChatModal';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const getFeedbackColor = (days) => {
    if (days === null) return '#6b7280'; // Sin datos - gris
    if (days < 7) return '#10b981'; // Verde - menos de 7 días
    if (days < 14) return '#f59e0b'; // Naranja - 7-14 días
    return '#ef4444'; // Rojo - más de 14 días
};

const getFeedbackText = (days) => {
    if (days === null) return 'Sin feedback';
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    return `Hace ${days}d`;
};

const getE1rmIcon = (trend) => {
    if (trend === 'improving') return { name: 'trending-up', color: '#10b981' };
    if (trend === 'declining') return { name: 'trending-down', color: '#ef4444' };
    return { name: 'remove', color: '#6b7280' };
};

// Sistema de colores: Seguimiento (>4 días naranja, >7 días rojo)
const getTrackingColor = (days) => {
    if (days === null) return '#6b7280'; // Sin datos - gris
    if (days <= 4) return '#10b981'; // Verde - 0-4 días
    if (days <= 7) return '#f59e0b'; // Naranja - 5-7 días
    return '#ef4444'; // Rojo - más de 7 días
};

// Sistema de colores: Entrenos (<3/semana rojo)
const getWorkoutsColor = (workouts) => {
    if (workouts >= 3) return '#10b981'; // Verde
    if (workouts >= 2) return '#f59e0b'; // Naranja
    return '#ef4444'; // Rojo
};

// Mood emoji basado en valor 1-5
const getMoodEmoji = (mood) => {
    if (mood === null) return { emoji: '❓', color: '#6b7280' };
    if (mood >= 4.5) return { emoji: '😄', color: '#10b981' };
    if (mood >= 3.5) return { emoji: '🙂', color: '#22c55e' };
    if (mood >= 2.5) return { emoji: '😐', color: '#f59e0b' };
    if (mood >= 1.5) return { emoji: '😔', color: '#f97316' };
    return { emoji: '😢', color: '#ef4444' };
};

export default function ClientsScreen() {
    const router = useRouter();
    const { token } = useAuth();

    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [maxClients, setMaxClients] = useState(5);
    const [expandedClients, setExpandedClients] = useState({});
    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        clientId: null,
        clientName: ''
    });

    // Feedback modal state - Usando el nuevo Chat Modal
    const [chatModalVisible, setChatModalVisible] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    const openFeedbackChat = (clientId, clientName) => {
        setSelectedClient({ _id: clientId, nombre: clientName });
        setChatModalVisible(true);
    };

    const closeFeedbackChat = () => {
        setChatModalVisible(false);
        setSelectedClient(null);
        fetchClients(); // Refresh to update unread counts
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);

            // Usar el nuevo endpoint extendido
            const response = await fetch(`${API_URL}/api/trainers/clients-extended`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success) {
                setClients(data.clients || []);
                setMaxClients(data.maxClients || 5);
            }
        } catch (error) {
            console.error('[ClientsScreen] Error fetching clients:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const toggleExpand = useCallback((clientId) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedClients(prev => ({
            ...prev,
            [clientId]: !prev[clientId]
        }));
    }, []);

    const handleDeleteClient = (clientId, clientName) => {
        setConfirmModal({ visible: true, clientId, clientName });
    };

    const confirmDelete = async () => {
        const { clientId } = confirmModal;
        setConfirmModal({ visible: false, clientId: null, clientName: '' });

        try {
            const response = await fetch(
                `${API_URL}/api/trainers/clients/${clientId}`,
                {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            const data = await response.json();
            if (data.success) {
                fetchClients();
            }
        } catch (error) {
            console.error('[DELETE] Error deleting client:', error);
        }
    };

    const cancelDelete = () => {
        setConfirmModal({ visible: false, clientId: null, clientName: '' });
    };

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchClients(true);
    };

    const renderClientCard = ({ item }) => {
        const isExpanded = expandedClients[item._id];
        const feedbackColor = getFeedbackColor(item.daysSinceLastFeedback);
        const e1rmInfo = getE1rmIcon(item.e1rmTrend);
        const trackingColor = getTrackingColor(item.daysSinceLastTracking);
        const workoutsColor = getWorkoutsColor(item.workoutsThisWeek ?? 0);
        const moodInfo = getMoodEmoji(item.avgMood);

        return (
            <View style={styles.clientCard}>
                {/* Header - Siempre visible */}
                <TouchableOpacity
                    style={styles.clientHeader}
                    onPress={() => toggleExpand(item._id)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="person-circle" size={44} color="#3b82f6" />
                    <View style={styles.clientDetails}>
                        <View style={styles.nameRow}>
                            <Text style={styles.clientName}>{item.nombre}</Text>
                            {item.unreadMessages > 0 && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadText}>{item.unreadMessages}</Text>
                                </View>
                            )}
                            {/* Mood Badge */}
                            <View style={[styles.moodBadge, { backgroundColor: moodInfo.color + '20' }]}>
                                <Text style={styles.moodEmoji}>{moodInfo.emoji}</Text>
                            </View>
                        </View>
                        <Text style={styles.clientEmail}>{item.email}</Text>
                        {/* Rutina actual */}
                        <View style={styles.routineRow}>
                            <Ionicons name="fitness" size={12} color="#8b5cf6" />
                            <Text style={styles.routineText} numberOfLines={1}>
                                {item.currentRoutineName
                                    ? `${item.currentRoutineName} • ${item.daysWithRoutine}d`
                                    : 'Sin rutina asignada'}
                            </Text>
                        </View>
                        <View style={styles.metaRow}>
                            {/* Seguimiento con color */}
                            <View style={[styles.statusPill, { backgroundColor: trackingColor + '20', borderColor: trackingColor }]}>
                                <Ionicons name="calendar" size={12} color={trackingColor} />
                                <Text style={[styles.statusPillText, { color: trackingColor }]}>
                                    {item.daysSinceLastTracking !== null ? `${item.daysSinceLastTracking}d` : '--'}
                                </Text>
                            </View>
                            {/* Entrenos con color */}
                            <View style={[styles.statusPill, { backgroundColor: workoutsColor + '20', borderColor: workoutsColor }]}>
                                <Ionicons name="barbell" size={12} color={workoutsColor} />
                                <Text style={[styles.statusPillText, { color: workoutsColor }]}>
                                    {item.workoutsThisWeek ?? 0}/sem
                                </Text>
                            </View>
                            {/* Progreso con color */}
                            <View style={[styles.statusPill, { backgroundColor: e1rmInfo.color + '20', borderColor: e1rmInfo.color }]}>
                                <Ionicons name={e1rmInfo.name} size={12} color={e1rmInfo.color} />
                            </View>
                            {/* Feedback */}
                            <View style={[styles.statusPill, { backgroundColor: feedbackColor + '20', borderColor: feedbackColor }]}>
                                <Ionicons name="chatbox" size={12} color={feedbackColor} />
                            </View>
                        </View>
                    </View>
                    <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={24}
                        color="#94a3b8"
                    />
                </TouchableOpacity>

                {/* Contenido Expandible */}
                {isExpanded && (
                    <View style={styles.expandedContent}>
                        {/* Resumen de Estado */}
                        <View style={styles.statsRow}>
                            {/* Último Seguimiento con color */}
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Seguimiento</Text>
                                <View style={[styles.statValueBox, { borderColor: trackingColor }]}>
                                    <Ionicons name="calendar" size={14} color={trackingColor} />
                                    <Text style={[styles.statValue, { color: trackingColor }]}>
                                        {item.lastTrackingDate
                                            ? new Date(item.lastTrackingDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                                            : '--'}
                                    </Text>
                                </View>
                            </View>

                            {/* Entrenos esta semana con color */}
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Entrenos</Text>
                                <View style={[styles.statValueBox, { borderColor: workoutsColor }]}>
                                    <Ionicons name="barbell" size={14} color={workoutsColor} />
                                    <Text style={[styles.statValue, { color: workoutsColor }]}>
                                        {item.workoutsThisWeek ?? 0}/sem
                                    </Text>
                                </View>
                            </View>

                            {/* Estado de ánimo medio */}
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Ánimo</Text>
                                <View style={[styles.statValueBox, { borderColor: moodInfo.color }]}>
                                    <Text style={styles.moodEmojiLarge}>{moodInfo.emoji}</Text>
                                    <Text style={[styles.statValue, { color: moodInfo.color }]}>
                                        {item.avgMood != null ? item.avgMood.toFixed(1) : '--'}
                                    </Text>
                                </View>
                            </View>

                            {/* Tendencia e1RM */}
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Progreso</Text>
                                <View style={[styles.statValueBox, { borderColor: e1rmInfo.color }]}>
                                    <Ionicons name={e1rmInfo.name} size={14} color={e1rmInfo.color} />
                                    <Text style={[styles.statValue, { color: e1rmInfo.color }]}>
                                        {item.e1rmTrend === 'improving' ? 'Mejora' : item.e1rmTrend === 'declining' ? 'Baja' : 'Estable'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Peso */}
                        <View style={styles.weightRow}>
                            <View style={styles.weightItem}>
                                <Text style={styles.weightLabel}>Peso Actual</Text>
                                <Text style={styles.weightValue}>
                                    {item.currentWeight ? `${item.currentWeight} kg` : '--'}
                                </Text>
                            </View>
                            <View style={styles.weightItem}>
                                <Text style={styles.weightLabel}>Objetivo</Text>
                                <Text style={styles.weightValue}>
                                    {item.targetWeight ? `${item.targetWeight} kg` : '--'}
                                </Text>
                            </View>
                            <View style={styles.weightItem}>
                                <Text style={styles.weightLabel}>Tendencia</Text>
                                <View style={styles.trendRow}>
                                    {item.weightTrend !== null && (
                                        <>
                                            <Ionicons
                                                name={item.weightTrend > 0 ? 'arrow-up' : item.weightTrend < 0 ? 'arrow-down' : 'remove'}
                                                size={14}
                                                color={item.weightTrend > 0 ? '#ef4444' : item.weightTrend < 0 ? '#10b981' : '#6b7280'}
                                            />
                                            <Text style={[
                                                styles.trendValue,
                                                { color: item.weightTrend > 0 ? '#ef4444' : item.weightTrend < 0 ? '#10b981' : '#6b7280' }
                                            ]}>
                                                {Math.abs(item.weightTrend)} kg
                                            </Text>
                                        </>
                                    )}
                                    {item.weightTrend === null && <Text style={styles.noData}>--</Text>}
                                </View>
                            </View>
                        </View>

                        {/* Botón Ver Toda la Información */}
                        <TouchableOpacity
                            style={styles.viewAllButton}
                            onPress={() => router.push({
                                pathname: '/(coach)/client-detail/[clientId]',
                                params: { clientId: item._id, clientName: item.nombre }
                            })}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="expand-outline" size={20} color="#fff" />
                            <Text style={styles.viewAllButtonText}>Ver toda la información</Text>
                            <Ionicons name="arrow-forward" size={18} color="#fff" />
                        </TouchableOpacity>

                        {/* Botones de Acción */}
                        <View style={styles.actionsRow}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.messageButton]}
                                onPress={() => router.push({
                                    pathname: '/(coach)/communication',
                                    params: { preselectedClient: item._id }
                                })}
                            >
                                <Text style={[styles.actionLabel, { color: '#3b82f6' }]}>Mensaje</Text>
                                <Ionicons name="chatbubble" size={22} color="#3b82f6" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.paymentsButton]}
                                onPress={() => router.push({
                                    pathname: '/(coach)/payments',
                                    params: { clientId: item._id }
                                })}
                            >
                                <Text style={[styles.actionLabel, { color: '#10b981' }]}>Pagos</Text>
                                <Ionicons name="card" size={22} color="#10b981" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.evolutionButton]}
                                onPress={() => router.push({
                                    pathname: '/(coach)/progress/[clientId]',
                                    params: { clientId: item._id, clientName: item.nombre }
                                })}
                            >
                                <Text style={[styles.actionLabel, { color: '#eab308' }]}>Evolución</Text>
                                <Ionicons name="trending-up" size={22} color="#eab308" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.trainingButton]}
                                onPress={() => router.push({
                                    pathname: '/(coach)/seguimiento_coach/[clientId]',
                                    params: { clientId: item._id, clientName: item.nombre }
                                })}
                            >
                                <Text style={[styles.actionLabel, { color: '#8b5cf6' }]}>Entreno</Text>
                                <Ionicons name="barbell" size={22} color="#8b5cf6" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.nutritionButton]}
                                onPress={() => router.push({
                                    pathname: '/(coach)/nutrition/[clientId]',
                                    params: { clientId: item._id, clientName: item.nombre }
                                })}
                            >
                                <Text style={[styles.actionLabel, { color: '#ec4899' }]}>Nutrición</Text>
                                <Ionicons name="nutrition" size={22} color="#ec4899" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.feedbackButton]}
                                onPress={() => openFeedbackChat(item._id, item.nombre)}
                            >
                                <Text style={[styles.actionLabel, { color: '#10b981' }]}>Feedback</Text>
                                <Ionicons name="chatbubbles" size={22} color="#10b981" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.deleteButton]}
                                onPress={() => handleDeleteClient(item._id, item.nombre)}
                            >
                                <Text style={[styles.actionLabel, { color: '#ef4444' }]}>Eliminar</Text>
                                <Ionicons name="trash" size={22} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={80} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Sin Clientes Asignados</Text>
            <Text style={styles.emptyText}>
                Comparte tu código de entrenador para que los usuarios puedan vincularse contigo.
            </Text>
        </View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <CoachHeader
                    title="Clientes"
                    icon="people"
                    iconColor="#10b981"
                    badge={`0 / ${maxClients}`}
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={styles.loadingText}>Cargando clientes...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Clientes"
                icon="people"
                iconColor="#10b981"
                badge={`${clients.length} / ${maxClients}`}
            />

            <FlatList
                data={clients}
                keyExtractor={(item) => item._id}
                renderItem={renderClientCard}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={clients.length === 0 ? styles.emptyList : styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        colors={['#10b981']}
                    />
                }
            />

            {/* Modal de Feedback Chat */}
            <FeedbackChatModal
                visible={chatModalVisible}
                onClose={closeFeedbackChat}
                clientId={selectedClient?._id}
                clientName={selectedClient?.nombre}
                isCoach={true}
            />

            {/* Modal de Confirmación */}
            <Modal
                transparent={true}
                visible={confirmModal.visible}
                animationType="fade"
                onRequestClose={cancelDelete}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Ionicons name="warning" size={48} color="#ef4444" />
                            <Text style={styles.modalTitle}>Eliminar Cliente</Text>
                        </View>

                        <Text style={styles.modalMessage}>
                            ¿Desvincular a {confirmModal.clientName}? El cliente podrá volver a vincularse con otro entrenador.
                        </Text>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={cancelDelete}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.deleteButtonModal]}
                                onPress={confirmDelete}
                            >
                                <Text style={styles.deleteButtonText}>Eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    list: {
        padding: 16,
    },
    emptyList: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#64748b',
    },

    // Client Card
    clientCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    clientHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    clientDetails: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    clientName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1e293b',
    },
    unreadBadge: {
        backgroundColor: '#ef4444',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        minWidth: 20,
        alignItems: 'center',
    },
    unreadText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    clientEmail: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 10,
    },
    routineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    routineText: {
        fontSize: 12,
        color: '#8b5cf6',
        fontWeight: '500',
        flex: 1,
    },
    clientDate: {
        fontSize: 12,
        color: '#94a3b8',
    },
    feedbackPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        gap: 4,
    },
    feedbackText: {
        fontSize: 11,
        fontWeight: '600',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
        gap: 3,
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '600',
    },
    moodBadge: {
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 4,
    },
    moodEmoji: {
        fontSize: 12,
    },
    moodEmojiLarge: {
        fontSize: 16,
    },
    statValueBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        gap: 4,
    },

    // Expanded Content
    expandedContent: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        padding: 16,
        backgroundColor: '#fafbfc',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statLabel: {
        fontSize: 11,
        color: '#94a3b8',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    // Weight Row
    weightRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    weightItem: {
        alignItems: 'center',
        flex: 1,
    },
    weightLabel: {
        fontSize: 10,
        color: '#94a3b8',
        marginBottom: 4,
    },
    weightValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    trendValue: {
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 2,
    },
    noData: {
        fontSize: 13,
        color: '#94a3b8',
    },

    // Action Buttons
    actionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    actionButton: {
        width: '30%',
        minWidth: 70,
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        gap: 4,
    },
    actionLabel: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
    },
    messageButton: {
        borderColor: '#93c5fd',
        backgroundColor: '#eff6ff',
    },
    paymentsButton: {
        borderColor: '#86efac',
        backgroundColor: '#f0fdf4',
    },
    evolutionButton: {
        borderColor: '#fde047',
        backgroundColor: '#fefce8',
    },
    trainingButton: {
        borderColor: '#c4b5fd',
        backgroundColor: '#faf5ff',
    },
    nutritionButton: {
        borderColor: '#f9a8d4',
        backgroundColor: '#fdf2f8',
    },
    deleteButton: {
        borderColor: '#fca5a5',
        backgroundColor: '#fef2f2',
    },

    // View All Button
    viewAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#6366f1',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    viewAllButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },

    // Empty State
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 16,
    },
    emptyText: {
        fontSize: 16,
        color: '#94a3b8',
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 32,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '90%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 12,
    },
    modalMessage: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
    },
    deleteButtonModal: {
        backgroundColor: '#ef4444',
    },
    deleteButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },

    // Feedback Button
    feedbackButton: {
        backgroundColor: '#ecfdf5',
        borderColor: '#10b981',
    },

    // Feedback Modal
    feedbackModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    feedbackModalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 40,
    },
    feedbackModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    feedbackModalTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    feedbackModalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
    },
    feedbackTypeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    feedbackTypeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    feedbackTypeBtnActive: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    feedbackTypeLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    feedbackTypeLabelActive: {
        color: '#fff',
    },
    feedbackInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: '#1e293b',
        minHeight: 100,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
    },
    sendFeedbackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#10b981',
        paddingVertical: 12,
        borderRadius: 12,
    },
    sendFeedbackBtnDisabled: {
        backgroundColor: '#94a3b8',
    },
    sendFeedbackBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
});
