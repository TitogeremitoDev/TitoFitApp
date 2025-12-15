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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';

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

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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
        const moodEmoji = client.avgAnimo ? MOOD_EMOJIS[client.avgAnimo] : '❓';

        // Determinar si hay registros nuevos sin ver
        const hasUnviewedDaily = client.daysSinceDaily !== null && !client.dailyViewed;
        const hasUnviewedWeekly = client.weeksSinceWeekly !== null && !client.weeklyViewed;
        const hasUnviewed = hasUnviewedDaily || hasUnviewedWeekly;

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
                            <Ionicons name="person-circle" size={44} color="#0ea5e9" />
                            {hasUnviewed && <View style={styles.unviewedDot} />}
                        </View>
                        <View style={styles.clientDetails}>
                            <Text style={styles.clientName}>{client.nombre}</Text>
                            <Text style={styles.clientEmail}>{client.email}</Text>
                        </View>
                    </View>

                    {/* Icono visto/no visto */}
                    {!hasUnviewed && client.daysSinceDaily !== null && (
                        <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                    )}
                </View>

                {/* Badges de seguimiento */}
                <View style={styles.badgesRow}>
                    {/* Diario */}
                    <View style={[styles.badge, { backgroundColor: dailyColor + '20', borderColor: dailyColor }]}>
                        <Ionicons name="calendar" size={14} color={dailyColor} />
                        <Text style={[styles.badgeText, { color: dailyColor }]}>
                            Diario: {formatDaysAgo(client.daysSinceDaily)}
                        </Text>
                    </View>

                    {/* Semanal */}
                    <View style={[styles.badge, { backgroundColor: weeklyColor + '20', borderColor: weeklyColor }]}>
                        <Ionicons name="calendar-outline" size={14} color={weeklyColor} />
                        <Text style={[styles.badgeText, { color: weeklyColor }]}>
                            Semanal: {formatWeeksAgo(client.weeksSinceWeekly)}
                        </Text>
                    </View>
                </View>

                {/* Preview rápido */}
                <View style={styles.previewRow}>
                    {/* Ánimo */}
                    <View style={styles.previewItem}>
                        <Text style={styles.previewEmoji}>{moodEmoji}</Text>
                        <Text style={styles.previewLabel}>Ánimo</Text>
                    </View>

                    {/* Peso */}
                    <View style={styles.previewItem}>
                        {client.currentWeight ? (
                            <>
                                <Text style={styles.previewValue}>{client.currentWeight} kg</Text>
                                {client.weightChange !== null && (
                                    <View style={styles.weightChangeRow}>
                                        <Ionicons
                                            name={client.weightChange > 0 ? 'arrow-up' : 'arrow-down'}
                                            size={12}
                                            color={client.weightChange > 0 ? '#10b981' : '#ef4444'}
                                        />
                                        <Text style={[
                                            styles.weightChangeText,
                                            { color: client.weightChange > 0 ? '#10b981' : '#ef4444' }
                                        ]}>
                                            {Math.abs(client.weightChange)}%
                                        </Text>
                                    </View>
                                )}
                            </>
                        ) : (
                            <Text style={styles.previewValue}>-- kg</Text>
                        )}
                        <Text style={styles.previewLabel}>Peso</Text>
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
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <CoachHeader
                    title="Seguimiento"
                    subtitle="Check-ins de clientes"
                    icon="resize-outline"
                    iconColor="#0ea5e9"
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
    unviewedDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
        borderWidth: 2,
        borderColor: '#fff',
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
        paddingTop: 12,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    previewItem: {
        alignItems: 'center',
        flex: 1,
    },
    previewEmoji: {
        fontSize: 24,
        marginBottom: 4,
    },
    previewValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    previewLabel: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    weightChangeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    weightChangeText: {
        fontSize: 11,
        fontWeight: '600',
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
