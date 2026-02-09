/* app/(coach)/seguimiento_coach/index.jsx - Sistema de Seguimiento de Clientes (Coach) */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const MOOD_EMOJIS = ['', '😢', '😕', '😐', '🙂', '😄'];

const getEnergyLabel = (score) => {
    if (!score) return '--';
    if (score >= 4) return 'Alta';
    if (score === 3) return 'Media';
    return 'Baja';
};

const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Sin actividad';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const getObjetivoTag = (objetivo) => {
    if (!objetivo) return null;
    const lower = objetivo.toLowerCase();
    if (lower.includes('volumen') || lower.includes('masa') || lower.includes('ganar')) {
        return { text: 'Volumen', color: '#8b5cf6', bgColor: '#f3e8ff', icon: 'trending-up' };
    }
    if (lower.includes('definición') || lower.includes('definicion') || lower.includes('perder') || lower.includes('bajar')) {
        return { text: 'Definición', color: '#ef4444', bgColor: '#fee2e2', icon: 'trending-down' };
    }
    if (lower.includes('mantener') || lower.includes('recomp')) {
        return { text: 'Mantenimiento', color: '#3b82f6', bgColor: '#dbeafe', icon: 'remove' };
    }
    return { text: 'General', color: '#64748b', bgColor: '#f1f5f9', icon: 'fitness' };
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE TARJETA (BIOFEEDBACK CARD)
// ═══════════════════════════════════════════════════════════════════════════

const BiofeedbackCard = ({ client, onPress }) => {
    const router = useRouter();

    // Status Logic
    const isActionRequired = client.status === 'action_required';
    const isAtRisk = client.status === 'at_risk';

    // Helper for badges (Simplified for dense view)
    const getRecencyColor = (days) => {
        if (days === 0) return '#10b981'; // Green
        if (days === 1) return '#f59e0b'; // Yellow
        if (days === undefined || days === null) return '#94a3b8';
        return '#ef4444'; // Red
    };

    const dailyColor = getRecencyColor(client.daysSinceDaily);
    const weeklyColor = getRecencyColor(client.weeksSinceWeekly); // Assuming days/weeks logic matches

    const moodEmoji = client.avgAnimo ? MOOD_EMOJIS[client.avgAnimo] : '—';
    const weightTrendColor = client.weightChange > 0 ? '#10b981' : (client.weightChange < 0 ? '#ef4444' : '#94a3b8');

    return (
        <TouchableOpacity
            style={[
                styles.card,
                isActionRequired && styles.cardActionRequired
            ]}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <View style={styles.cardContent}>

                {/* 1. LEFT: Avatar + Name + Mini Check-in Status */}
                <View style={styles.leftSection}>
                    <AvatarWithInitials
                        avatarUrl={client.profilePhoto}
                        name={client.nombre}
                        size={42}
                    />
                    <View style={styles.userInfo}>
                        <Text style={styles.userName} numberOfLines={1}>{client.nombre}</Text>
                        <View style={styles.badgesRow}>
                            {/* Mini Badge: Daily Recentness */}
                            <View style={styles.miniBadgeSimple}>
                                <Ionicons name="time" size={10} color={dailyColor} />
                                <Text style={[styles.miniBadgeText, { color: dailyColor }]}>
                                    {client.daysSinceDaily === 0 ? 'Hoy' : (client.daysSinceDaily === 1 ? 'Ayer' : `${client.daysSinceDaily}d`)}
                                </Text>
                            </View>
                            <Text style={styles.divider}>|</Text>
                            {/* Mini Badge: Weekly Recentness */}
                            <View style={styles.miniBadgeSimple}>
                                <Ionicons name="calendar" size={10} color={client.weeksSinceWeekly === 0 ? '#10b981' : '#f59e0b'} />
                                <Text style={[styles.miniBadgeText, { color: client.weeksSinceWeekly === 0 ? '#10b981' : '#f59e0b' }]}>
                                    {client.weeksSinceWeekly === 0 ? 'Esta sem' : `${client.weeksSinceWeekly} sem`}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 2. MIDDLE: Dense Metrics (Sleep | Energy | Mood | Weight) */}
                <View style={styles.metricsRow}>
                    {/* Sleep */}
                    <View style={styles.metricCompact}>
                        <Text style={styles.metricValue}>{client.avgSueno ? client.avgSueno : '-'}</Text>
                        <Text style={styles.metricLabel}>Sueño</Text>
                    </View>

                    {/* Energy */}
                    <View style={styles.metricCompact}>
                        <Text style={styles.metricValue}>{client.avgEnergia ? client.avgEnergia : '-'}</Text>
                        <Text style={styles.metricLabel}>Energía</Text>
                    </View>

                    {/* Mood (Just Emoji) */}
                    <View style={styles.metricCompact}>
                        <Text style={styles.emojiSmall}>{moodEmoji}</Text>
                        <Text style={styles.metricLabel}>Ánimo</Text>
                    </View>

                    {/* Weight + Trend */}
                    <View style={styles.metricCompact}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <Text style={styles.metricValue}>
                                {client.avgWeight7d ? `${Math.round(client.avgWeight7d)}` : '-'}
                            </Text>
                            {client.weightChange !== 0 && client.weightChange && (
                                <Text style={{ fontSize: 9, color: weightTrendColor, fontWeight: '700' }}>
                                    {client.weightChange > 0 ? '↑' : '↓'}
                                </Text>
                            )}
                        </View>
                        <Text style={styles.metricLabel}>Kg</Text>
                    </View>
                </View>

                {/* 3. RIGHT: Status Icon / Action */}
                <View style={styles.rightSection}>
                    {isActionRequired ? (
                        <View style={styles.iconButtonAction}>
                            <Ionicons name="alert-circle" size={24} color="#3b82f6" />
                        </View>
                    ) : (
                        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function CoachSeguimientoScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('priority'); // 'priority' | 'recent' | 'name'

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    const fetchClientsSummary = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);
            const res = await fetch(`${API_URL}/api/monitoring/coach/clients-summary`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setClients(data.clients || []);
            }
        } catch (error) {
            console.error('[Seguimiento] Error:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [token, API_URL]);

    useEffect(() => {
        fetchClientsSummary();
    }, [fetchClientsSummary]);

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchClientsSummary(true);
    };

    const filteredAndSortedClients = useMemo(() => {
        let result = [...clients];

        // 1. Filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(c =>
                c.nombre?.toLowerCase().includes(q) ||
                c.email?.toLowerCase().includes(q)
            );
        }

        // 2. Sort
        switch (sortBy) {
            case 'name':
                result.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
                break;
            case 'recent':
                result.sort((a, b) => {
                    const dateA = a.lastCheckInTimestamp ? new Date(a.lastCheckInTimestamp) : new Date(0);
                    const dateB = b.lastCheckInTimestamp ? new Date(b.lastCheckInTimestamp) : new Date(0);
                    return dateB - dateA;
                });
                break;
            case 'priority':
            default:
                // Primary Sort: Priority (1=Action Required, 2=At Risk, 3=Ok)
                result.sort((a, b) => {
                    const pA = a.priority || 3;
                    const pB = b.priority || 3;
                    if (pA !== pB) return pA - pB;

                    // Secondary Sort: Most recent interaction first (for Action Required)
                    const dateA = a.lastCheckInTimestamp ? new Date(a.lastCheckInTimestamp) : new Date(0);
                    const dateB = b.lastCheckInTimestamp ? new Date(b.lastCheckInTimestamp) : new Date(0);
                    return dateB - dateA;
                });
                break;
        }
        return result;
    }, [clients, searchQuery, sortBy]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <CoachHeader title="Seguimiento" subtitle="Check-ins de clientes" icon="resize-outline" iconColor="#3b82f6" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Cargando panel de control...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Seguimiento"
                subtitle="Check-ins de clientes"
                badge={`${clients.length}`}
                icon="resize-outline"
                iconColor="#3b82f6"
                onBackPress={() => router.push('/(coach)')}
            />

            <View style={styles.controlsBar}>
                {/* Search */}
                <View style={styles.searchBox}>
                    <Ionicons name="search" size={16} color="#94a3b8" />
                    <EnhancedTextInput
                        placeholder="Buscar cliente..."
                        placeholderTextColor="#94a3b8"
                        style={styles.input}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Sort Toggle */}
                <TouchableOpacity
                    style={styles.sortButton}
                    onPress={() => {
                        const next = sortBy === 'priority' ? 'recent' : (sortBy === 'recent' ? 'name' : 'priority');
                        setSortBy(next);
                    }}
                >
                    <Ionicons name="filter" size={16} color="#64748b" />
                    <Text style={styles.sortButtonText}>
                        {sortBy === 'priority' ? 'Prioridad' : (sortBy === 'recent' ? 'Recientes' : 'A-Z')}
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredAndSortedClients}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <BiofeedbackCard
                        client={item}
                        onPress={() => router.push({
                            pathname: '/(coach)/seguimiento_coach/[clientId]',
                            params: { clientId: item._id, clientName: item.nombre }
                        })}
                    />
                )}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="stats-chart" size={64} color="#e2e8f0" />
                        <Text style={styles.emptyTitle}>Sin resultados</Text>
                        <Text style={styles.emptyText}>No hay clientes que coincidan con tu búsqueda.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

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
    loadingText: {
        marginTop: 12,
        color: '#94a3b8',
    },
    controlsBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 12,
        paddingTop: 8,
        gap: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 40,
        gap: 8,
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#1e293b',
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        borderRadius: 8,
        height: 40,
        gap: 6,
    },
    sortButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#94a3b8',
        marginTop: 16,
    },
    emptyText: {
        color: '#94a3b8',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // DENSE COMPACT ROW STYLES
    // ─────────────────────────────────────────────────────────────────────────
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    cardActionRequired: {
        borderLeftWidth: 3,
        borderLeftColor: '#3b82f6',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },

    // 1. LEFT: User Info
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1.5, // Takes most width
    },
    userInfo: {
        gap: 2,
        flex: 1,
    },
    userName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    badgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    miniBadgeSimple: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    miniBadgeText: {
        fontSize: 11,
        fontWeight: '500',
    },
    divider: {
        fontSize: 10,
        color: '#cbd5e1',
    },

    // 2. MIDDLE: Dense Metrics
    metricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
    },
    metricCompact: {
        alignItems: 'center',
        minWidth: 32,
    },
    metricValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    metricLabel: {
        fontSize: 9,
        color: '#94a3b8',
    },
    emojiSmall: {
        fontSize: 12,
    },

    // 3. RIGHT: Action
    rightSection: {
        paddingLeft: 4,
    },
    iconButtonAction: {
        // Just centering
    },
});
