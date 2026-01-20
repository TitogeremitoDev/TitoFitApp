import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Modal, View, Text, StyleSheet, SafeAreaView, FlatList, RefreshControl,
    ActivityIndicator, TouchableOpacity, LayoutAnimation, Platform, UIManager, TextInput,
    useWindowDimensions, Animated, Pressable
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import FeedbackChatModal from '../../../components/FeedbackChatModal';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

// ═══════════════════════════════════════════════════════════════════════════
// COLOR PALETTE - Professional Blue Theme
// ═══════════════════════════════════════════════════════════════════════════
const COLORS = {
    primary: '#2563EB',        // Azul eléctrico
    primaryDark: '#1D4ED8',    // Azul profundo (hover)
    primaryLight: '#3B82F6',   // Azul claro
    success: '#10b981',        // Verde (para tendencias positivas)
    warning: '#f59e0b',        // Amarillo/Naranja
    danger: '#ef4444',         // Rojo
    neutral: '#6b7280',        // Gris
    background: '#f1f5f9',     // Fondo principal
    cardBg: '#ffffff',         // Fondo tarjetas
    expandedBg: '#0f172a',     // Fondo expandido (dark mode)
    border: '#e2e8f0',         // Bordes claros
    borderDark: '#1e293b',     // Bordes oscuros
    textPrimary: '#1e293b',    // Texto principal
    textSecondary: '#64748b',  // Texto secundario
    textMuted: '#94a3b8',      // Texto apagado
};

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// Sistema de semáforo para status ring (Instagram-style)
const getStatusRingColor = (client) => {
    const days = client.daysSinceLastTracking;
    const hasPaymentIssue = client.paymentPending;

    if (hasPaymentIssue) return COLORS.danger; // Pago pendiente = rojo
    if (days === null) return COLORS.neutral;
    if (days > 7) return COLORS.danger;  // Check-in perdido
    if (days > 4) return COLORS.warning; // Necesita atención
    return COLORS.primary; // Todo al día = azul corporativo
};

// Texto legible para tiempo transcurrido
const getReadableTime = (days, lastDate) => {
    if (days === null || days === undefined) return 'Sin datos';
    if (days === 0) return 'Activo hoy';
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days}d`;
    if (lastDate) {
        return new Date(lastDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
    return `Hace ${days}d`;
};

// Tendencia de peso contextual basada en objetivo del atleta
const getContextualWeightTrend = (weightTrend, goal) => {
    if (weightTrend === null || weightTrend === undefined) {
        return { icon: 'remove', color: COLORS.neutral, text: '--' };
    }

    const isGainingWeight = weightTrend > 0;
    const isLosingWeight = weightTrend < 0;
    const absValue = Math.abs(weightTrend).toFixed(1);

    // Objetivos de pérdida de peso
    const lossGoals = ['perdida', 'definicion', 'cutting', 'bajada'];
    // Objetivos de ganancia
    const gainGoals = ['volumen', 'ganancia', 'bulking', 'musculo'];

    const normalizedGoal = (goal || '').toLowerCase();
    const wantsToLose = lossGoals.some(g => normalizedGoal.includes(g));
    const wantsToGain = gainGoals.some(g => normalizedGoal.includes(g));

    if (wantsToLose) {
        // Quiere perder: bajar = verde, subir = rojo
        return {
            icon: isLosingWeight ? 'arrow-down' : isGainingWeight ? 'arrow-up' : 'remove',
            color: isLosingWeight ? COLORS.success : isGainingWeight ? COLORS.danger : COLORS.neutral,
            text: `${isGainingWeight ? '+' : ''}${weightTrend.toFixed(1)}kg`
        };
    } else if (wantsToGain) {
        // Quiere ganar: subir = verde, bajar = rojo
        return {
            icon: isGainingWeight ? 'arrow-up' : isLosingWeight ? 'arrow-down' : 'remove',
            color: isGainingWeight ? COLORS.success : isLosingWeight ? COLORS.danger : COLORS.neutral,
            text: `${isGainingWeight ? '+' : ''}${weightTrend.toFixed(1)}kg`
        };
    }

    // Sin objetivo específico: neutro
    return {
        icon: isGainingWeight ? 'arrow-up' : isLosingWeight ? 'arrow-down' : 'remove',
        color: COLORS.neutral,
        text: `${isGainingWeight ? '+' : ''}${weightTrend.toFixed(1)}kg`
    };
};

const getFeedbackColor = (days) => {
    if (days === null) return COLORS.neutral;
    if (days < 7) return COLORS.primary;  // Azul - todo bien
    if (days < 14) return COLORS.warning;
    return COLORS.danger;
};

const getFeedbackText = (days) => {
    if (days === null) return 'Sin feedback';
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    return `Hace ${days}d`;
};

const getE1rmIcon = (trend) => {
    if (trend === 'improving') return { name: 'trending-up', color: COLORS.success };
    if (trend === 'declining') return { name: 'trending-down', color: COLORS.danger };
    return { name: 'remove', color: COLORS.neutral };
};

// Sistema de colores: Seguimiento (>4 días naranja, >7 días rojo)
const getTrackingColor = (days) => {
    if (days === null) return COLORS.neutral;
    if (days <= 4) return COLORS.primary;  // Azul corporativo
    if (days <= 7) return COLORS.warning;
    return COLORS.danger;
};

// Sistema de colores: Entrenos (<3/semana rojo)
const getWorkoutsColor = (workouts) => {
    if (workouts >= 3) return COLORS.success;
    if (workouts >= 2) return COLORS.warning;
    return COLORS.danger;
};

// Mood emoji basado en valor 1-5
const getMoodEmoji = (mood) => {
    if (mood === null) return { emoji: '❓', color: COLORS.neutral };
    if (mood >= 4.5) return { emoji: '😄', color: COLORS.success };
    if (mood >= 3.5) return { emoji: '🙂', color: '#22c55e' };
    if (mood >= 2.5) return { emoji: '😐', color: COLORS.warning };
    if (mood >= 1.5) return { emoji: '😔', color: '#f97316' };
    return { emoji: '😢', color: COLORS.danger };
};

// Tabs configuration para la vista expandida
const EXPANDED_TABS = [
    { id: 'chat', icon: 'chatbubble', label: 'Chat', route: 'communication' },
    { id: 'entreno', icon: 'barbell', label: 'Entreno', route: 'progress' },
    { id: 'nutricion', icon: 'nutrition', label: 'Nutrición', route: 'nutrition' },
    { id: 'progreso', icon: 'trending-up', label: 'Progreso', route: 'seguimiento_coach' },
    { id: 'pagos', icon: 'card', label: 'Pagos', route: 'billing' },
];

// Helper: Formatear fecha de feedback
const formatFeedbackDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

// Helper: Texto de tiempo desde feedback
const getFeedbackTimeText = (days) => {
    if (days === null || days === undefined) return { text: 'Sin datos', status: 'neutral' };
    if (days === 0) return { text: 'Al día', status: 'good' };
    if (days === 1) return { text: 'Ayer', status: 'good' };
    if (days <= 3) return { text: `Hace ${days}d`, status: 'good' };
    if (days <= 7) return { text: `Hace ${days}d`, status: 'warning' };
    return { text: `Hace ${days}d`, status: 'danger' };
};

export default function ClientsScreen() {
    const router = useRouter();
    const { token, refreshUser } = useAuth();
    const { width: screenWidth } = useWindowDimensions();

    // Responsive breakpoints
    const isDesktop = screenWidth >= 1024;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;
    const isMobile = screenWidth < 768;

    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [maxClients, setMaxClients] = useState(5);
    const [expandedClients, setExpandedClients] = useState({});
    const [activeTab, setActiveTab] = useState({}); // Per-client active tab

    // Search and Sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name', 'tracking'
    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        clientId: null,
        clientName: ''
    });

    // More menu state (3-dot menu)
    const [moreMenuVisible, setMoreMenuVisible] = useState(null);

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

    // ═══════════════════════════════════════════════════════════════════════════
    // ARCHIVAR CLIENTE - Libera cuota SIN borrar datos
    // El cliente pierde acceso pero mantiene todo su historial
    // ═══════════════════════════════════════════════════════════════════════════
    const handleArchiveClient = async (clientId, clientName) => {
        try {
            const response = await fetch(
                `${API_URL}/api/clients/${clientId}/archive`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const data = await response.json();

            if (data.success) {
                console.log(`[Archive] ✅ ${clientName} archivado. Nuevo conteo: ${data.newClientCount}/${data.maxClients}`);

                // 1. Refrescar lista de clientes
                await fetchClients();

                // 2. CRÍTICO: Refrescar datos del usuario para actualizar banner de over-quota
                // Esto hace que el banner rojo desaparezca INSTANTÁNEAMENTE
                if (refreshUser) {
                    await refreshUser();
                }
            } else {
                alert(data.message || 'Error al archivar');
            }
        } catch (error) {
            console.error('[Archive] Error:', error);
            alert('Error de conexión al archivar');
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
        const statusRingColor = getStatusRingColor(item);
        const feedbackColor = getFeedbackColor(item.daysSinceLastFeedback);
        const e1rmInfo = getE1rmIcon(item.e1rmTrend);
        const trackingColor = getTrackingColor(item.daysSinceLastTracking);
        const workoutsColor = getWorkoutsColor(item.workoutsThisWeek ?? 0);
        const moodInfo = getMoodEmoji(item.avgMood);
        const weightTrendInfo = getContextualWeightTrend(item.weightTrend, item.goal);
        const lastActivityText = getReadableTime(item.daysSinceLastTracking, item.lastTrackingDate);
        const currentTab = activeTab[item._id] || 'chat';
        const isMenuOpen = moreMenuVisible === item._id;

        // Calculate completed/target workouts
        const completedWorkouts = item.workoutsThisWeek ?? 0;
        const targetWorkouts = item.targetWorkoutsPerWeek ?? 5;

        return (
            <View style={styles.clientCard}>
                {/* Header - Siempre visible */}
                <View style={styles.clientHeader}>
                    {/* Avatar con Status Ring (Instagram-style) - Clickable para expandir */}
                    <TouchableOpacity
                        style={styles.avatarContainer}
                        onPress={() => toggleExpand(item._id)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.statusRing, { borderColor: statusRingColor }]}>
                            <View style={styles.avatarInner}>
                                <AvatarWithInitials
                                    avatarUrl={item.avatarUrl}
                                    name={item.nombre}
                                    size={40}
                                />
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Nombre y detalles - Clickable para expandir */}
                    <TouchableOpacity
                        style={styles.clientDetails}
                        onPress={() => toggleExpand(item._id)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.nameRow}>
                            <Text style={styles.clientName}>{item.nombre}</Text>
                            {item.unreadMessages > 0 && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadText}>{item.unreadMessages}</Text>
                                </View>
                            )}
                            {/* Estado badge - texto legible */}
                            <View style={[styles.statusBadge, { backgroundColor: statusRingColor + '15' }]}>
                                <Text style={[styles.statusBadgeText, { color: statusRingColor }]}>
                                    {lastActivityText}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.clientEmail} numberOfLines={1}>{item.email}</Text>

                        {/* Rutina actual - azul corporativo */}
                        <View style={styles.routineRow}>
                            <Ionicons name="fitness" size={12} color={COLORS.primary} />
                            <Text style={[styles.routineText, { color: item.currentRoutineName ? COLORS.primary : COLORS.warning }]} numberOfLines={1}>
                                {item.currentRoutineName
                                    ? `${item.currentRoutineName} • ${item.daysWithRoutine}d`
                                    : '⚠️ Sin rutina asignada'}
                            </Text>
                        </View>

                        {/* Métricas compactas en header */}
                        <View style={styles.metaRow}>
                            {/* Cumplimiento de entrenos (X/Y format) */}
                            <View style={[styles.statusPill, { backgroundColor: workoutsColor + '15', borderColor: workoutsColor }]}>
                                <Ionicons name="barbell" size={12} color={workoutsColor} />
                                <Text style={[styles.statusPillText, { color: workoutsColor }]}>
                                    {completedWorkouts}/{targetWorkouts}
                                </Text>
                            </View>
                            {/* Ánimo */}
                            <View style={[styles.moodBadge, { backgroundColor: moodInfo.color + '15' }]}>
                                <Text style={styles.moodEmoji}>{moodInfo.emoji}</Text>
                            </View>
                            {/* Compliance % (si disponible) */}
                            {item.complianceRate !== undefined && (
                                <View style={[styles.complianceBadge, {
                                    backgroundColor: item.complianceRate >= 80 ? COLORS.success + '15' :
                                        item.complianceRate >= 60 ? COLORS.warning + '15' : COLORS.danger + '15'
                                }]}>
                                    <Text style={[styles.complianceText, {
                                        color: item.complianceRate >= 80 ? COLORS.success :
                                            item.complianceRate >= 60 ? COLORS.warning : COLORS.danger
                                    }]}>
                                        {item.complianceRate}%
                                    </Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>

                    {/* Acciones del header: 3 puntos + Chevron */}
                    <View style={styles.headerActions}>
                        {/* More Menu (3 dots) */}
                        <TouchableOpacity
                            style={styles.moreMenuBtn}
                            onPress={() => setMoreMenuVisible(isMenuOpen ? null : item._id)}
                        >
                            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                        {/* Chevron para expandir/colapsar */}
                        <TouchableOpacity
                            onPress={() => toggleExpand(item._id)}
                            activeOpacity={0.7}
                            style={{ padding: 4 }}
                        >
                            <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={22}
                                color={COLORS.textMuted}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Dropdown More Menu - SIEMPRE VISIBLE (fuera del expandido) */}
                {isMenuOpen && (
                    <View style={styles.moreMenuDropdown}>
                        <TouchableOpacity
                            style={styles.moreMenuItem}
                            onPress={() => {
                                setMoreMenuVisible(null);
                                router.push({
                                    pathname: '/(coach)/client-detail/[clientId]',
                                    params: { clientId: item._id, clientName: item.nombre, tab: 'edit' }
                                });
                            }}
                        >
                            <Ionicons name="create-outline" size={18} color={COLORS.textSecondary} />
                            <Text style={styles.moreMenuText}>Editar Perfil</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.moreMenuItem}
                            onPress={() => {
                                setMoreMenuVisible(null);
                                // ToDo: Implementar pausar atleta
                            }}
                        >
                            <Ionicons name="pause-circle-outline" size={18} color={COLORS.textSecondary} />
                            <Text style={styles.moreMenuText}>Pausar Cliente</Text>
                        </TouchableOpacity>
                        <View style={styles.moreMenuDivider} />
                        <TouchableOpacity
                            style={styles.moreMenuItem}
                            onPress={() => {
                                setMoreMenuVisible(null);
                                handleArchiveClient(item._id, item.nombre);
                            }}
                        >
                            <Ionicons name="archive-outline" size={18} color={COLORS.warning} />
                            <Text style={[styles.moreMenuText, { color: COLORS.warning }]}>Archivar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.moreMenuItem}
                            onPress={() => {
                                setMoreMenuVisible(null);
                                handleDeleteClient(item._id, item.nombre);
                            }}
                        >
                            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                            <Text style={[styles.moreMenuText, { color: COLORS.danger }]}>Eliminar cliente</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Contenido Expandible - Rediseño profesional */}
                {isExpanded && (
                    <View style={[styles.expandedContent, isDesktop && styles.expandedContentDesktop]}>

                        {/* ═══════════════════════════════════════════════════════════════════ */}
                        {/* MINI CARDS - Siempre visibles (compactas) */}
                        {/* ═══════════════════════════════════════════════════════════════════ */}
                        <View style={[styles.miniCardsGrid, !isMobile && styles.miniCardsGridDesktop]}>
                            {/* Card 1: SEGUIMIENTO */}
                            <TouchableOpacity
                                style={styles.miniCard}
                                onPress={() => router.push({
                                    pathname: '/(coach)/seguimiento_coach/[clientId]',
                                    params: { clientId: item._id, clientName: item.nombre }
                                })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.miniCardLabel}>SEGUIMIENTO</Text>
                                <Text style={styles.miniCardValue}>
                                    {item.lastTrackingDate
                                        ? formatFeedbackDate(item.lastTrackingDate)
                                        : '--'}
                                </Text>
                                {(() => {
                                    const feedbackInfo = getFeedbackTimeText(item.daysSinceLastTracking);
                                    const statusColor = feedbackInfo.status === 'good' ? COLORS.success
                                        : feedbackInfo.status === 'warning' ? COLORS.warning
                                            : feedbackInfo.status === 'danger' ? COLORS.danger
                                                : COLORS.textMuted;
                                    return (
                                        <Text style={[styles.miniCardStatus, { color: statusColor }]}>
                                            {feedbackInfo.status === 'good' ? '✓ ' : feedbackInfo.status === 'warning' ? '⚠ ' : ''}{feedbackInfo.text}
                                        </Text>
                                    );
                                })()}
                            </TouchableOpacity>

                            {/* Card 2: ENTRENOS */}
                            <TouchableOpacity
                                style={styles.miniCard}
                                onPress={() => router.push({
                                    pathname: '/(coach)/progress/[clientId]',
                                    params: { clientId: item._id, clientName: item.nombre }
                                })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.miniCardLabel}>ENTRENOS</Text>
                                <View style={styles.miniCardRow}>
                                    <Text style={styles.miniCardValue}>{completedWorkouts}</Text>
                                    <Text style={styles.miniCardUnit}>/{targetWorkouts}</Text>
                                </View>
                                {/* Puntos visuales */}
                                <View style={styles.workoutDotsRow}>
                                    {Array.from({ length: Math.min(targetWorkouts, 7) }).map((_, i) => (
                                        <View
                                            key={i}
                                            style={[
                                                styles.workoutDotMini,
                                                { backgroundColor: i < completedWorkouts ? COLORS.primary : '#E2E8F0' }
                                            ]}
                                        />
                                    ))}
                                </View>
                            </TouchableOpacity>

                            {/* Card 3: PESO */}
                            <TouchableOpacity
                                style={styles.miniCard}
                                onPress={() => router.push({
                                    pathname: '/(coach)/seguimiento_coach/[clientId]',
                                    params: { clientId: item._id, clientName: item.nombre }
                                })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.miniCardLabel}>PESO</Text>
                                <View style={styles.miniCardRow}>
                                    <Text style={styles.miniCardValue}>
                                        {item.currentWeight ? item.currentWeight : '--'}
                                    </Text>
                                    <Text style={styles.miniCardUnit}>kg</Text>
                                </View>
                                {item.weightTrend !== null && (
                                    <View style={[styles.miniTrendRow, { backgroundColor: weightTrendInfo.color + '20' }]}>
                                        <Ionicons name={weightTrendInfo.icon} size={10} color={weightTrendInfo.color} />
                                        <Text style={[styles.miniTrendText, { color: weightTrendInfo.color }]}>
                                            {weightTrendInfo.text}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Card 4: ÁNIMO */}
                            <View style={styles.miniCard}>
                                <Text style={styles.miniCardLabel}>ÁNIMO</Text>
                                <View style={styles.miniCardRow}>
                                    <Text style={styles.miniMoodEmoji}>{moodInfo.emoji}</Text>
                                    <Text style={styles.miniCardValue}>
                                        {item.avgMood != null ? item.avgMood.toFixed(1) : '--'}
                                    </Text>
                                </View>
                                {/* Estrellas visuales */}
                                <View style={styles.starsRowMini}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Ionicons
                                            key={star}
                                            name={star <= Math.round(item.avgMood || 0) ? 'star' : 'star-outline'}
                                            size={10}
                                            color={star <= Math.round(item.avgMood || 0) ? '#fbbf24' : '#E2E8F0'}
                                        />
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* Tab Bar - Navegación horizontal */}
                        <View style={styles.tabBar}>
                            {EXPANDED_TABS.map((tab) => {
                                const isActive = currentTab === tab.id;
                                return (
                                    <TouchableOpacity
                                        key={tab.id}
                                        style={[styles.tabButton, isActive && styles.tabButtonActive]}
                                        onPress={() => {
                                            setActiveTab(prev => ({ ...prev, [item._id]: tab.id }));
                                            if (tab.route === 'communication') {
                                                openFeedbackChat(item._id, item.nombre);
                                            } else if (tab.route === 'billing') {
                                                router.push('/(coach)/billing');
                                            } else if (tab.route) {
                                                router.push({
                                                    pathname: `/(coach)/${tab.route}/[clientId]`,
                                                    params: { clientId: item._id, clientName: item.nombre }
                                                });
                                            }
                                        }}
                                    >
                                        <Ionicons
                                            name={tab.icon}
                                            size={18}
                                            color={isActive ? '#fff' : COLORS.textMuted}
                                        />
                                        {(isDesktop || isTablet || isActive) && (
                                            <Text style={[
                                                styles.tabButtonText,
                                                isActive && styles.tabButtonTextActive
                                            ]}>
                                                {tab.label}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
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

    // Skeleton placeholder para carga rápida
    const renderSkeleton = () => (
        <View style={styles.skeletonCard}>
            <View style={styles.skeletonRow}>
                <View style={styles.skeletonAvatar} />
                <View style={styles.skeletonTextContainer}>
                    <View style={[styles.skeletonLine, { width: '60%' }]} />
                    <View style={[styles.skeletonLine, { width: '80%', marginTop: 8 }]} />
                    <View style={[styles.skeletonLine, { width: '40%', marginTop: 8 }]} />
                </View>
            </View>
        </View>
    );

    // Filter and sort clients (MUST be before any early return to follow hooks rules)
    const filteredClients = React.useMemo(() => {
        let result = [...clients];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(c =>
                c.nombre?.toLowerCase().includes(q) ||
                c.email?.toLowerCase().includes(q)
            );
        }
        switch (sortBy) {
            case 'name':
                result.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
                break;
            case 'tracking':
                result.sort((a, b) => (b.daysSinceLastTracking ?? 999) - (a.daysSinceLastTracking ?? 999));
                break;
            case 'recent':
            default:
                result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        return result;
    }, [clients, searchQuery, sortBy]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <CoachHeader
                    title="Clientes"
                    icon="people"
                    iconColor="#10b981"
                    badge={`0 / ${maxClients}`}
                />
                <View style={styles.list}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <View key={i}>{renderSkeleton()}</View>
                    ))}
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

            {/* Search and Sort Bar */}
            <View style={styles.searchSortBar}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar cliente..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.sortButtons}>
                    <TouchableOpacity
                        style={[styles.sortBtn, sortBy === 'recent' && styles.sortBtnActive]}
                        onPress={() => setSortBy('recent')}
                    >
                        <Ionicons name="time-outline" size={16} color={sortBy === 'recent' ? '#fff' : '#64748b'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.sortBtn, sortBy === 'name' && styles.sortBtnActive]}
                        onPress={() => setSortBy('name')}
                    >
                        <Ionicons name="text-outline" size={16} color={sortBy === 'name' ? '#fff' : '#64748b'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.sortBtn, sortBy === 'tracking' && styles.sortBtnActive]}
                        onPress={() => setSortBy('tracking')}
                    >
                        <Ionicons name="alert-circle-outline" size={16} color={sortBy === 'tracking' ? '#fff' : '#64748b'} />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={filteredClients}
                keyExtractor={(item) => item._id}
                renderItem={renderClientCard}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={clients.length === 0 ? styles.emptyList : styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        colors={['#2563EB']}
                    />
                }
                // Performance optimizations
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}
                getItemLayout={(data, index) => ({
                    length: 100, // Altura aproximada de cada card (sin expandir)
                    offset: 100 * index,
                    index
                })}
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
    // Search and Sort
    searchSortBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 38,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1e293b',
    },
    sortButtons: {
        flexDirection: 'row',
        gap: 6,
    },
    sortBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    sortBtnActive: {
        backgroundColor: '#2563EB',
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

    // Skeleton Styles
    skeletonCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    skeletonRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    skeletonAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#e2e8f0',
        marginRight: 12,
    },
    skeletonTextContainer: {
        flex: 1,
    },
    skeletonLine: {
        height: 12,
        borderRadius: 6,
        backgroundColor: '#e2e8f0',
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

    // ═══════════════════════════════════════════════════════════════════════════
    // NEW PROFESSIONAL STYLES
    // ═══════════════════════════════════════════════════════════════════════════

    // Avatar with Status Ring (Instagram-style)
    avatarContainer: {
        marginRight: 12,
    },
    statusRing: {
        padding: 3, // Gap between avatar and ring
        borderWidth: 2.5,
        borderRadius: 25,
    },
    avatarInner: {
        backgroundColor: '#fff',
        borderRadius: 22,
        padding: 1,
    },

    // Status Badge (readable time)
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        marginLeft: 4,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },

    // Header Actions
    headerActions: {
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Compliance Badge
    complianceBadge: {
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
    },
    complianceText: {
        fontSize: 11,
        fontWeight: '700',
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

    // Expanded Content - Desktop variant
    expandedContentDesktop: {
        flexDirection: 'column',
        padding: 20,
    },

    // Expanded Header (Quick Actions + More Menu)
    expandedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    quickActions: {
        flexDirection: 'row',
        gap: 8,
    },
    quickActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    quickActionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2563EB',
    },
    moreMenuBtn: {
        padding: 8,
        borderRadius: 8,
    },

    // More Menu Dropdown
    moreMenuDropdown: {
        position: 'absolute',
        top: 60,
        right: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 8,
        minWidth: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 1000,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    moreMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    moreMenuText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b',
    },
    moreMenuDivider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        marginVertical: 6,
    },

    // Metrics Bar (horizontal)
    metricsBar: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    metricItem: {
        flex: 1,
        alignItems: 'center',
    },
    metricLabel: {
        fontSize: 11,
        color: '#94a3b8',
        marginBottom: 4,
    },
    metricValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    metricValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metricDivider: {
        width: 1,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 8,
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    trendText: {
        fontSize: 11,
        fontWeight: '600',
    },

    // Tab Bar
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 4,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    tabButtonActive: {
        backgroundColor: '#2563EB',
    },
    tabButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94a3b8',
    },
    tabButtonTextActive: {
        color: '#ffffff',
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
    archiveButton: {
        borderColor: '#fcd34d',
        backgroundColor: '#fffbeb',
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

    // ═══════════════════════════════════════════════════════════════════════════
    // SUMMARY TAB STYLES - Dashboard Ejecutivo
    // ═══════════════════════════════════════════════════════════════════════════
    summaryContainer: {
        marginTop: 16,
    },
    summaryCardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    summaryCardsGridDesktop: {
        flexWrap: 'nowrap',
    },
    summaryCard: {
        width: '48%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        minHeight: 120,
    },
    summaryCardLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    summaryCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    summaryCardValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1e293b',
    },
    summaryCardUnit: {
        fontSize: 14,
        fontWeight: '500',
        color: '#94a3b8',
    },
    summaryStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    summaryStatusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    summaryCardBar: {
        height: 4,
        backgroundColor: '#e2e8f0',
        borderRadius: 2,
        marginTop: 8,
        overflow: 'hidden',
    },
    summaryBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    summarySubtext: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },
    summaryTrendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    summaryTrendText: {
        fontSize: 12,
        fontWeight: '600',
    },
    summaryMoodEmoji: {
        fontSize: 28,
    },

    // Workout Dots
    workoutDotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    workoutDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },

    // Stars Row
    starsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        marginBottom: 4,
    },

    // Volume Chart Card
    volumeChartCard: {
        marginTop: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    volumeChartHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    volumeChartTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
    },
    volumeChartSubtitle: {
        fontSize: 11,
        color: '#94a3b8',
    },
    volumeChartContent: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 16,
    },
    miniBarChart: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        height: 60,
        flex: 1,
    },
    miniBarWrapper: {
        flex: 1,
        alignItems: 'center',
        height: '100%',
        justifyContent: 'flex-end',
    },
    miniBar: {
        width: '80%',
        borderRadius: 4,
        minHeight: 8,
    },
    miniBarLabel: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 4,
    },
    volumeChartInfo: {
        alignItems: 'center',
        paddingLeft: 16,
        borderLeftWidth: 1,
        borderLeftColor: '#e2e8f0',
    },
    volumeChartMetric: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    volumeChartValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    volumeChartDesc: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 4,
        textAlign: 'center',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // MINI CARDS (Compactas, siempre visibles)
    // ═══════════════════════════════════════════════════════════════════════════
    miniCardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    miniCardsGridDesktop: {
        flexWrap: 'nowrap',
    },
    miniCard: {
        flex: 1,
        minWidth: '22%',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    miniCardLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 0.3,
        marginBottom: 4,
    },
    miniCardValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
    },
    miniCardUnit: {
        fontSize: 11,
        fontWeight: '500',
        color: '#94a3b8',
        marginLeft: 2,
    },
    miniCardRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    miniCardStatus: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    miniTrendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    miniTrendText: {
        fontSize: 9,
        fontWeight: '600',
    },
    miniMoodEmoji: {
        fontSize: 16,
        marginRight: 4,
    },
    workoutDotMini: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    starsRowMini: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        marginTop: 2,
    },
});
