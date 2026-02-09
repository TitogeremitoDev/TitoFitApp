/**
 * (coach)/feedbacks/index.jsx - Centro de Feedbacks Profesionales
 * Lista de clientes para crear y gestionar feedback reports
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { useFeedbackBubble } from '../../../context/FeedbackBubbleContext';
import FeedbackReportModal from '../../../components/FeedbackReportModal';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';
// Componentes mejorados para iOS
import {
    EnhancedTouchable as TouchableOpacity,
    EnhancedTextInput as TextInput,
} from '../../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// ═══════════════════════════════════════════════════════════════════════════
// TRAFFIC LIGHT BADGE
// ═══════════════════════════════════════════════════════════════════════════

const TrafficLightBadge = ({ status }) => {
    const config = {
        green: { color: '#10b981', label: 'Progreso', icon: '🟢' },
        yellow: { color: '#f59e0b', label: 'Consolidación', icon: '🟡' },
        red: { color: '#ef4444', label: 'Ajustes', icon: '🔴' },
        none: { color: '#6b7280', label: 'Sin feedback', icon: '⚪' }
    };
    const { color, label, icon } = config[status] || config.none;

    return (
        <View style={[styles.trafficBadge, { backgroundColor: color + '20' }]}>
            <Text style={styles.trafficIcon}>{icon}</Text>
            <Text style={[styles.trafficLabel, { color }]}>{label}</Text>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT CARD
// ═══════════════════════════════════════════════════════════════════════════

const ClientFeedbackCard = ({ client, onPress, lastFeedback }) => {
    const hasDraft = lastFeedback?.status === 'draft';
    const daysSinceLast = lastFeedback?.sentAt
        ? Math.floor((Date.now() - new Date(lastFeedback.sentAt)) / (1000 * 60 * 60 * 24))
        : null;

    return (
        <TouchableOpacity
            style={[styles.clientCard, hasDraft && styles.clientCardDraft]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {/* Avatar */}
            <View style={styles.clientAvatar}>
                <AvatarWithInitials
                    avatarUrl={client.avatarUrl}
                    name={client.nombre}
                    size={48}
                />
                {hasDraft && (
                    <View style={styles.draftDot}>
                        <Ionicons name="pencil" size={10} color="#fff" />
                    </View>
                )}
            </View>

            {/* Info */}
            <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{client.nombre}</Text>
                <Text style={styles.clientMeta}>
                    {daysSinceLast !== null
                        ? `Último feedback: hace ${daysSinceLast} días`
                        : 'Sin feedbacks aún'}
                </Text>
            </View>

            {/* Traffic Light */}
            <TrafficLightBadge status={lastFeedback?.trafficLight || 'none'} />

            {/* Arrow */}
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE CARD
// ═══════════════════════════════════════════════════════════════════════════

const ResponseCard = ({ item }) => {
    const [expanded, setExpanded] = useState(false);
    const getHighlightText = (h) => typeof h === 'object' ? h.text : h;

    return (
        <TouchableOpacity
            style={[styles.responseCard, expanded && styles.responseCardExpanded]}
            onPress={() => setExpanded(!expanded)}
            activeOpacity={0.7}
        >
            <View style={styles.responseHeader}>
                <View style={styles.clientAvatar}>
                    <AvatarWithInitials
                        avatarUrl={item.client?.avatarUrl || item.clientAvatar || item.clientPhoto}
                        name={item.clientName}
                        size={48}
                    />
                </View>
                <View style={styles.responseHeaderInfo}>
                    <Text style={styles.clientName}>{item.clientName}</Text>
                    <Text style={styles.responseDate}>
                        Respondido: {new Date(item.clientResponse?.respondedAt).toLocaleDateString('es-ES')}
                    </Text>
                </View>
                <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#94a3b8"
                />
            </View>

            {/* Vista colapsada - solo resumen */}
            {!expanded && (
                <>
                    <View style={styles.feedbackSummaryBox}>
                        <Text style={styles.feedbackSummaryLabel}>Tu feedback:</Text>
                        {item.highlights?.slice(0, 2).map((h, i) => (
                            <Text key={i} style={styles.feedbackSummaryItem}>• {getHighlightText(h)}</Text>
                        ))}
                        {(item.highlights?.length > 2 || item.technicalNotes?.length > 0 || item.actionPlan?.length > 0) && (
                            <Text style={styles.feedbackSummaryMore}>Toca para ver más...</Text>
                        )}
                    </View>
                </>
            )}

            {/* Vista expandida - todo el feedback */}
            {expanded && (
                <>
                    {/* Semáforo */}
                    {item.trafficLight && (
                        <View style={[
                            styles.trafficLightBadge,
                            {
                                backgroundColor: item.trafficLight === 'green' ? '#dcfce7' :
                                    item.trafficLight === 'yellow' ? '#fef9c3' : '#fee2e2'
                            }
                        ]}>
                            <Text style={{
                                color: item.trafficLight === 'green' ? '#16a34a' :
                                    item.trafficLight === 'yellow' ? '#ca8a04' : '#dc2626'
                            }}>
                                {item.trafficLight === 'green' ? '🟢 Excelente' :
                                    item.trafficLight === 'yellow' ? '🟡 A mejorar' : '🔴 Atención'}
                            </Text>
                        </View>
                    )}

                    {/* Logros / Lo que has hecho bien */}
                    {item.highlights?.length > 0 && (
                        <View style={styles.feedbackSection}>
                            <View style={[styles.feedbackSectionHeader, { borderLeftColor: '#22c55e' }]}>
                                <Text style={styles.feedbackSectionTitle}>✨ Lo que has hecho bien</Text>
                            </View>
                            {item.highlights.map((h, i) => (
                                <Text key={i} style={styles.feedbackSectionItem}>• {getHighlightText(h)}</Text>
                            ))}
                        </View>
                    )}

                    {/* Análisis Técnico */}
                    {item.technicalNotes?.length > 0 && (
                        <View style={styles.feedbackSection}>
                            <View style={[styles.feedbackSectionHeader, { borderLeftColor: '#3b82f6' }]}>
                                <Text style={styles.feedbackSectionTitle}>📊 Análisis Técnico</Text>
                            </View>
                            {item.technicalNotes.map((n, i) => (
                                <Text key={i} style={styles.feedbackSectionItem}>• {getHighlightText(n)}</Text>
                            ))}
                        </View>
                    )}

                    {/* Plan de Acción */}
                    {item.actionPlan?.length > 0 && (
                        <View style={styles.feedbackSection}>
                            <View style={[styles.feedbackSectionHeader, { borderLeftColor: '#f59e0b' }]}>
                                <Text style={styles.feedbackSectionTitle}>🎯 Plan de Acción</Text>
                            </View>
                            {item.actionPlan.map((a, i) => (
                                <Text key={i} style={styles.feedbackSectionItem}>• {getHighlightText(a)}</Text>
                            ))}
                        </View>
                    )}
                </>
            )}

            {/* Respuesta del cliente - siempre visible */}
            <View style={styles.clientResponseBox}>
                <View style={styles.clientResponseHeader}>
                    <Ionicons name="chatbubble" size={16} color="#10b981" />
                    <Text style={styles.clientResponseLabel}>Respuesta del cliente:</Text>
                </View>
                <Text style={styles.clientResponseText}>{item.clientResponse?.text}</Text>
            </View>
        </TouchableOpacity>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function FeedbacksScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { token } = useAuth();
    const { setActiveClient } = useFeedbackBubble();

    const [clients, setClients] = useState([]);
    const [feedbackSummary, setFeedbackSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [prefillData, setPrefillData] = useState(null);

    // Estado para feedbacks con respuestas
    const [respondedFeedbacks, setRespondedFeedbacks] = useState([]);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD DATA
    // ─────────────────────────────────────────────────────────────────────────

    const loadData = useCallback(async () => {
        try {
            const [clientsRes, summaryRes] = await Promise.all([
                fetch(`${API_URL}/api/trainers/clients-extended`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_URL}/api/feedback-reports/summary`, {
                    headers: { Authorization: `Bearer ${token}` }
                }).catch(() => ({ json: () => ({ success: false }) })) // Graceful fallback
            ]);

            const clientsData = await clientsRes.json();
            const summaryData = await summaryRes.json();

            if (clientsData.clients) {
                setClients(clientsData.clients);

                // Check if we have prefill from FAB
                if (params.clientId && params.prefillData) {
                    const client = clientsData.clients.find(c => c._id === params.clientId);
                    if (client) {
                        try {
                            const prefill = JSON.parse(params.prefillData);
                            setSelectedClient(client);
                            setPrefillData(prefill);
                            setModalVisible(true);
                            // Clear params to avoid re-opening
                            router.setParams({ clientId: undefined, prefillData: undefined });
                        } catch (e) {
                            console.log('[Feedbacks] Error parsing prefill:', e);
                        }
                    }
                }
            }
            if (summaryData.success) {
                setFeedbackSummary(summaryData.summary || {});
            }

            // Cargar feedbacks con respuestas del cliente
            try {
                const respondedRes = await fetch(`${API_URL}/api/feedback-reports/with-responses`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const respondedData = await respondedRes.json();
                if (respondedData.success) {
                    setRespondedFeedbacks(respondedData.reports || []);
                }
            } catch (e) {
                console.log('[Feedbacks] Error loading responses:', e);
            }
        } catch (error) {
            console.error('[Feedbacks] Error loading:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token, params.clientId, params.prefillData]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Handle Deep Link for Feedback Modal (Web Back Button Support)
    useEffect(() => {
        if (params.feedbackClientId && clients.length > 0) {
            const client = clients.find(c => c._id === params.feedbackClientId);
            if (client) {
                setSelectedClient(client);
                setModalVisible(true);
            }
        } else if (!params.feedbackClientId && Platform.OS === 'web' && modalVisible) {
            setModalVisible(false);
            setSelectedClient(null);
        }
    }, [params.feedbackClientId, clients]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS
    // ─────────────────────────────────────────────────────────────────────────

    const openFeedbackModal = (client) => {
        if (Platform.OS === 'web') {
            router.push({ pathname: '/(coach)/feedbacks', params: { feedbackClientId: client._id } });
        } else {
            setSelectedClient(client);
            setModalVisible(true);
        }
        setPrefillData(null);
        // Activar también el bubble para tomar notas si lo desea
        setActiveClient(client._id, client.nombre);
    };

    const closeFeedbackModal = () => {
        if (Platform.OS === 'web' && params.feedbackClientId) {
            router.back();
            return;
        }
        setModalVisible(false);
        setSelectedClient(null);
        setPrefillData(null);
        loadData(); // Refresh after closing
    };

    // ─────────────────────────────────────────────────────────────────────────
    // FILTER & SEARCH
    // ─────────────────────────────────────────────────────────────────────────

    const filteredClients = clients
        .filter(client => {
            const matchesSearch = client.nombre?.toLowerCase().includes(searchQuery.toLowerCase());
            const summary = feedbackSummary[client._id] || {};

            if (activeFilter === 'pending') {
                // Clients without recent feedback (>7 days or none)
                const daysSince = summary.lastSentAt
                    ? Math.floor((Date.now() - new Date(summary.lastSentAt)) / (1000 * 60 * 60 * 24))
                    : 999;
                return matchesSearch && daysSince > 7;
            }
            if (activeFilter === 'drafts') {
                return matchesSearch && summary.hasDraft;
            }
            return matchesSearch;
        })
        .sort((a, b) => {
            // Prioritize drafts, then by days since last feedback
            const aSum = feedbackSummary[a._id] || {};
            const bSum = feedbackSummary[b._id] || {};
            if (aSum.hasDraft && !bSum.hasDraft) return -1;
            if (!aSum.hasDraft && bSum.hasDraft) return 1;
            return (bSum.daysSinceLast || 999) - (aSum.daysSinceLast || 999);
        });

    // ─────────────────────────────────────────────────────────────────────────
    // STATS
    // ─────────────────────────────────────────────────────────────────────────

    const stats = {
        total: clients.length,
        pending: clients.filter(c => {
            const s = feedbackSummary[c._id];
            const days = s?.lastSentAt
                ? Math.floor((Date.now() - new Date(s.lastSentAt)) / (1000 * 60 * 60 * 24))
                : 999;
            return days > 7;
        }).length,
        drafts: clients.filter(c => feedbackSummary[c._id]?.hasDraft).length,
        responses: respondedFeedbacks.length
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Cargando clientes...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#1e293b', '#334155']}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => router.canGoBack() ? router.back() : router.replace('/(coach)')}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>📋 Feedbacks</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{stats.total}</Text>
                        <Text style={styles.statLabel}>Clientes</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{stats.pending}</Text>
                        <Text style={styles.statLabel}>Pendientes</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: '#3b82f6' }]}>{stats.drafts}</Text>
                        <Text style={styles.statLabel}>Borradores</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Search */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#94a3b8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar cliente..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterTabs}>
                {[
                    { id: 'all', label: 'Todos', icon: 'people' },
                    { id: 'pending', label: 'Pendientes', icon: 'alert-circle' },
                    { id: 'drafts', label: 'Borradores', icon: 'create' },
                    { id: 'responses', label: 'Respuestas', icon: 'chatbubbles', badge: stats.responses }
                ].map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.filterTab, activeFilter === tab.id && styles.filterTabActive]}
                        onPress={() => setActiveFilter(tab.id)}
                    >
                        <Ionicons
                            name={tab.icon}
                            size={16}
                            color={activeFilter === tab.id ? '#fff' : '#64748b'}
                        />
                        <Text style={[
                            styles.filterTabText,
                            activeFilter === tab.id && styles.filterTabTextActive
                        ]}>
                            {tab.label}
                        </Text>
                        {tab.badge > 0 && (
                            <View style={styles.filterTabBadge}>
                                <Text style={styles.filterTabBadgeText}>{tab.badge}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Responses List - cuando se selecciona pestaña Respuestas */}
            {activeFilter === 'responses' ? (
                <FlatList
                    data={respondedFeedbacks}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={['#3b82f6']}
                        />
                    }
                    renderItem={({ item }) => <ResponseCard item={item} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e1" />
                            <Text style={styles.emptyTitle}>Sin respuestas aún</Text>
                            <Text style={styles.emptySubtitle}>Las respuestas de tus clientes aparecerán aquí</Text>
                        </View>
                    }
                />
            ) : (
                /* Clients List */
                <FlatList
                    data={filteredClients}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={['#3b82f6']}
                        />
                    }
                    renderItem={({ item }) => (
                        <ClientFeedbackCard
                            client={item}
                            lastFeedback={feedbackSummary[item._id]?.lastFeedback}
                            onPress={() => openFeedbackModal(item)}
                        />
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="document-text-outline" size={64} color="#cbd5e1" />
                            <Text style={styles.emptyTitle}>
                                {activeFilter === 'pending' ? 'Todos al día' :
                                    activeFilter === 'drafts' ? 'Sin borradores' :
                                        'Sin clientes'}
                            </Text>
                            <Text style={styles.emptySubtitle}>
                                {activeFilter === 'pending' ? '¡Excelente trabajo!' : ''}
                            </Text>
                        </View>
                    }
                />
            )
            }

            {/* Feedback Report Modal */}
            <FeedbackReportModal
                visible={modalVisible}
                onClose={() => {
                    closeFeedbackModal();
                    setPrefillData(null);
                }}
                client={selectedClient}
                clients={clients} // Pass full client list for sidebar
                onSwitchClient={(client) => {
                    setSelectedClient(client);
                    // No need to close modal, just switch data
                }}
                prefillData={prefillData}
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
        backgroundColor: '#f8fafc',
        minHeight: '100%'
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
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20
    },
    backBtn: {
        padding: 4
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff'
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 16
    },
    statItem: {
        alignItems: 'center'
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff'
    },
    statLabel: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: 'rgba(255,255,255,0.2)'
    },

    // Search
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        margin: 16,
        marginBottom: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: '#1e293b'
    },

    // Filter Tabs
    filterTabs: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        gap: 8,
        marginBottom: 8
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    filterTabActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6'
    },
    filterTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b'
    },
    filterTabTextActive: {
        color: '#fff'
    },

    // List
    listContent: {
        padding: 16,
        paddingTop: 8
    },

    // Client Card
    clientCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    clientCardDraft: {
        borderWidth: 2,
        borderColor: '#3b82f6',
        borderStyle: 'dashed'
    },
    clientAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
    },
    clientAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#64748b'
    },
    draftDot: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff'
    },
    clientInfo: {
        flex: 1,
        marginLeft: 12
    },
    clientName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b'
    },
    clientMeta: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2
    },

    // Traffic Light Badge
    trafficBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        marginRight: 8,
        gap: 4
    },
    trafficIcon: {
        fontSize: 10
    },
    trafficLabel: {
        fontSize: 11,
        fontWeight: '600'
    },

    // Empty
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 16
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8
    },

    // Filter Tab Badge
    filterTabBadge: {
        backgroundColor: '#10b981',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginLeft: 4
    },
    filterTabBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700'
    },

    // Response Card
    responseCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: '#10b981'
    },
    responseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12
    },
    responseHeaderInfo: {
        flex: 1,
        marginLeft: 12
    },
    responseDate: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2
    },

    // Feedback Summary Box
    feedbackSummaryBox: {
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 10,
        marginBottom: 12
    },
    feedbackSummaryLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 6
    },
    feedbackSummaryItem: {
        fontSize: 13,
        color: '#475569',
        marginLeft: 4,
        marginTop: 2
    },
    feedbackSummaryMore: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
        fontStyle: 'italic'
    },

    // Client Response Box
    clientResponseBox: {
        backgroundColor: '#ecfdf5',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#a7f3d0'
    },
    clientResponseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6
    },
    clientResponseLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669'
    },
    clientResponseText: {
        fontSize: 14,
        color: '#065f46',
        lineHeight: 20
    },

    // Expanded Card
    responseCardExpanded: {
        borderLeftColor: '#3b82f6',
        borderLeftWidth: 4
    },
    trafficLightBadge: {
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginBottom: 12
    },
    feedbackSection: {
        marginBottom: 12
    },
    feedbackSectionHeader: {
        borderLeftWidth: 4,
        paddingLeft: 10,
        marginBottom: 6
    },
    feedbackSectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b'
    },
    feedbackSectionItem: {
        fontSize: 13,
        color: '#475569',
        paddingLeft: 14,
        marginTop: 4,
        lineHeight: 18
    }
});
