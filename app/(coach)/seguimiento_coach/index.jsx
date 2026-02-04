/* app/(coach)/seguimiento/index.jsx - Sistema de Seguimiento de Clientes (Coach) */

import React, { useState, useEffect, useCallback } from 'react';
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
    useWindowDimensions,
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

const getDailyBadgeColor = (days) => {
    if (days === null) return '#6b7280'; // Sin datos
    if (days < 3) return '#10b981'; // Verde
    if (days <= 5) return '#f59e0b'; // Naranja
    return '#ef4444'; // Rojo
};

const getWeeklyBadgeColor = (weeks) => {
    if (weeks === null) return '#6b7280'; // Sin datos
    if (weeks < 1) return '#10b981'; // Verde
    if (weeks <= 2) return '#f59e0b'; // Naranja
    return '#ef4444'; // Rojo
};

const formatDaysAgo = (days) => {
    if (days === null) return 'Sin datos';
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    return `${days}d`;
};

const formatWeeksAgo = (weeks) => {
    if (weeks === null) return 'Sin datos';
    if (weeks === 0) return 'Esta semana';
    if (weeks === 1) return '1 sem';
    return `${weeks} sem`;
};

const getObjetivoTag = (objetivo) => {
    if (!objetivo) return null;
    const lower = objetivo.toLowerCase();
    if (lower.includes('volumen') || lower.includes('masa') || lower.includes('ganar')) {
        return { text: 'Volumen', color: '#3b82f6', icon: 'trending-up' };
    }
    if (lower.includes('definición') || lower.includes('definicion') || lower.includes('perder') || lower.includes('bajar')) {
        return { text: 'Definición', color: '#ef4444', icon: 'trending-down' };
    }
    if (lower.includes('mantener') || lower.includes('recomp')) {
        return { text: 'Mantener', color: '#f59e0b', icon: 'remove' };
    }
    return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function CoachSeguimientoScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Search and Sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name', 'daily'

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    // ─────────────────────────────────────────────────────────────────────────
    // CARGAR DATOS
    // ─────────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER TARJETA DE CLIENTE
    // ─────────────────────────────────────────────────────────────────────────
    const renderClientCard = ({ item: client }) => {
        const dailyColor = getDailyBadgeColor(client.daysSinceDaily);
        const weeklyColor = getWeeklyBadgeColor(client.weeksSinceWeekly);
        const objetivoTag = getObjetivoTag(client.objetivo);
        // Use neutral gray emoji instead of alarming ❓ for missing mood
        const moodEmoji = client.avgAnimo ? MOOD_EMOJIS[client.avgAnimo] : '—';

        // Determinar si hay registros nuevos sin ver
        const hasUnviewedDaily = client.daysSinceDaily !== null && !client.dailyViewed;
        const hasUnviewedWeekly = client.weeksSinceWeekly !== null && !client.weeklyViewed;
        const hasUnviewed = hasUnviewedDaily || hasUnviewedWeekly;
        const hasUnreadNotes = client.unreadNotesCount > 0;

        return (
            <TouchableOpacity
                style={styles.clientCard}
                onPress={() => router.push({
                    pathname: '/(coach)/seguimiento_coach/[clientId]',
                    params: { clientId: client._id, clientName: client.nombre }
                })}
                activeOpacity={0.7}
            >
                {/* Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.clientInfo}>
                        <View style={styles.avatarContainer}>
                            <AvatarWithInitials
                                avatarUrl={client.profilePhoto}
                                name={client.nombre}
                                size={48}
                            />
                            {hasUnviewed && <View style={styles.unviewedDot} />}
                        </View>
                        <View style={styles.clientDetails}>
                            <Text style={styles.clientName}>{client.nombre}</Text>
                            <Text style={styles.clientEmail} numberOfLines={1}>{client.email}</Text>
                        </View>
                    </View>

                    {/* Icono visto/no visto + Notas */}
                    <View style={styles.headerBadges}>
                        {hasUnreadNotes && (
                            <View style={styles.notesBadge}>
                                <Ionicons name="document-text" size={14} color="#8b5cf6" />
                                <Text style={styles.notesBadgeText}>{client.unreadNotesCount}</Text>
                            </View>
                        )}
                        {!hasUnviewed && client.daysSinceDaily !== null && (
                            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                        )}
                    </View>
                </View>

                {/* Badges de seguimiento */}
                <View style={styles.badgesRow}>
                    {/* Diario */}
                    <View style={[styles.badge, { backgroundColor: dailyColor + '18', borderColor: dailyColor }]}>
                        <Ionicons name="calendar" size={14} color={dailyColor} />
                        <Text style={[styles.badgeText, { color: dailyColor }]}>
                            Diario: {formatDaysAgo(client.daysSinceDaily)}
                        </Text>
                    </View>

                    {/* Semanal */}
                    <View style={[styles.badge, { backgroundColor: weeklyColor + '18', borderColor: weeklyColor }]}>
                        <Ionicons name="calendar-outline" size={14} color={weeklyColor} />
                        <Text style={[styles.badgeText, { color: weeklyColor }]}>
                            Semanal: {formatWeeksAgo(client.weeksSinceWeekly)}
                        </Text>
                    </View>
                </View>

                {/* Preview rápido - Mejorado */}
                <View style={styles.previewRow}>
                    {/* Ánimo */}
                    <View style={styles.previewItem}>
                        <Text style={styles.previewEmoji}>{moodEmoji}</Text>
                        <Text style={styles.previewLabel}>Ánimo</Text>
                    </View>

                    {/* Peso - Media 7 días */}
                    <View style={styles.previewItem}>
                        <View style={styles.weightContainer}>
                            <Ionicons name="scale-outline" size={16} color="#64748b" />
                            {client.avgWeight7d ? (
                                <>
                                    <Text style={styles.previewValue}>{client.avgWeight7d} kg</Text>
                                    {client.weightChange !== null && client.weightChange !== 0 && (
                                        <View style={[
                                            styles.weightChangeBadge,
                                            { backgroundColor: client.weightChange > 0 ? '#10b98120' : '#ef444420' }
                                        ]}>
                                            <Ionicons
                                                name={client.weightChange > 0 ? 'arrow-up' : 'arrow-down'}
                                                size={10}
                                                color={client.weightChange > 0 ? '#10b981' : '#ef4444'}
                                            />
                                            <Text style={[
                                                styles.weightChangeText,
                                                { color: client.weightChange > 0 ? '#10b981' : '#ef4444' }
                                            ]}>
                                                {Math.abs(client.weightChange).toFixed(1)}%
                                            </Text>
                                        </View>
                                    )}
                                </>
                            ) : (
                                <Text style={styles.previewValueMuted}>-- kg</Text>
                            )}
                        </View>
                        <Text style={styles.previewLabel}>Media 7d</Text>
                    </View>

                    {/* Objetivo */}
                    <View style={styles.previewItem}>
                        {objetivoTag ? (
                            <View style={[styles.objetivoTag, { backgroundColor: objetivoTag.color + '20' }]}>
                                <Ionicons name={objetivoTag.icon} size={14} color={objetivoTag.color} />
                                <Text style={[styles.objetivoText, { color: objetivoTag.color }]}>
                                    {objetivoTag.text}
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.noData}>Sin objetivo</Text>
                        )}
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>Ver seguimiento completo</Text>
                    <Ionicons name="chevron-forward" size={18} color="#0ea5e9" />
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="resize-outline" size={80} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Sin Clientes</Text>
            <Text style={styles.emptyText}>
                Aún no tienes clientes vinculados para ver su seguimiento.
            </Text>
        </View>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    // Filter and sort clients (MUST be before any early return)
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
            case 'daily':
                result.sort((a, b) => (b.daysSinceDaily ?? 999) - (a.daysSinceDaily ?? 999));
                break;
            case 'recent':
            default:
                break;
        }
        return result;
    }, [clients, searchQuery, sortBy]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <CoachHeader
                    title="Seguimiento"
                    subtitle="Check-ins de clientes"
                    icon="resize-outline"
                    iconColor="#0ea5e9"
                    onBackPress={() => router.push('/(coach)')}
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0ea5e9" />
                    <Text style={styles.loadingText}>Cargando seguimiento...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Seguimiento"
                subtitle="Check-ins de clientes"
                icon="resize-outline"
                iconColor="#0ea5e9"
                badge={`${clients.length} clientes`}
                onBackPress={() => router.push('/(coach)')}
            />

            {/* Search and Sort Bar */}
            <View style={styles.searchSortBar}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color="#94a3b8" />
                    <EnhancedTextInput
                        containerStyle={styles.searchInputContainer}
                        style={styles.searchInputText}
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
                        style={[styles.sortBtn, sortBy === 'daily' && styles.sortBtnActive]}
                        onPress={() => setSortBy('daily')}
                    >
                        <Ionicons name="alert-circle-outline" size={16} color={sortBy === 'daily' ? '#fff' : '#64748b'} />
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
                        colors={['#0ea5e9']}
                    />
                }
            />
        </SafeAreaView>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
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
    searchInputContainer: {
        flex: 1,
    },
    searchInputText: {
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
        backgroundColor: '#0ea5e9',
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
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#64748b',
    },

    // Tarjeta de cliente
    clientCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    clientInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatarImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#0ea5e9',
    },
    unviewedDot: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ef4444',
        borderWidth: 2,
        borderColor: '#fff',
    },
    headerBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    notesBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#8b5cf620',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    notesBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8b5cf6',
    },
    clientDetails: {
        marginLeft: 12,
        flex: 1,
    },
    clientName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1e293b',
    },
    clientEmail: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },

    // Badges
    badgesRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 14,
        flexWrap: 'wrap',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        gap: 5,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
    },

    // Preview
    previewRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 14,
        paddingBottom: 14,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#fafafa',
        marginHorizontal: -16,
        paddingHorizontal: 16,
    },
    previewItem: {
        alignItems: 'center',
        flex: 1,
    },
    previewEmoji: {
        fontSize: 26,
        marginBottom: 4,
    },
    weightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    previewValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    previewValueMuted: {
        fontSize: 15,
        fontWeight: '600',
        color: '#94a3b8',
    },
    previewLabel: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 4,
        fontWeight: '500',
    },
    weightChangeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 2,
    },
    weightChangeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    weightChangeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    objetivoTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    objetivoText: {
        fontSize: 12,
        fontWeight: '600',
    },
    noData: {
        fontSize: 12,
        color: '#94a3b8',
    },

    // Footer
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 12,
        gap: 4,
    },
    footerText: {
        fontSize: 13,
        color: '#0ea5e9',
        fontWeight: '600',
    },

    // Empty state
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
});
