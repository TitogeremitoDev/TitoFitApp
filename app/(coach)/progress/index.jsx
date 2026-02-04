/* coach/progress/index.jsx
   ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD DE PROGRESO DE CLIENTES
   - Lista de clientes con indicadores rápidos
   - Flecha de tendencia (mejora/empeora)
   - Días sin entrenar, sesiones por semana
   - Clic → página de análisis detallado
   ═══════════════════════════════════════════════════════════════════════════ */

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
import { EnhancedTextInput } from '../../../components/ui';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import { RPE_COLORS, RPE_LABELS } from '../../../src/utils/calculateKPIs';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';

export default function ProgressDashboard() {
    const router = useRouter();
    const { token } = useAuth();
    const [clients, setClients] = useState([]);
    const [clientsProgress, setClientsProgress] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Search and Sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name', 'sessions'

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    // ═══════════════════════════════════════════════════════════════════════════
    // CARGAR CLIENTES Y SU PROGRESO
    // ═══════════════════════════════════════════════════════════════════════════
    const fetchClientsAndProgress = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);

            // 1. Obtener lista de clientes
            const clientsRes = await fetch(`${API_URL}/api/trainers/clients`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const clientsData = await clientsRes.json();

            if (!clientsData.success) {
                console.warn('[Progress] Error cargando clientes');
                return;
            }

            const clientsList = clientsData.clients || [];
            setClients(clientsList);

            // 2. Para cada cliente, obtener sus últimos workouts
            const progressMap = {};

            await Promise.all(
                clientsList.map(async (client) => {
                    try {
                        // Obtener workouts del cliente (últimas 4 semanas)
                        const fourWeeksAgo = new Date();
                        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

                        const workoutsRes = await fetch(
                            `${API_URL}/api/workouts/by-user/${client._id}?limit=100&startDate=${fourWeeksAgo.toISOString()}`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        const workoutsData = await workoutsRes.json();

                        if (workoutsData.success) {
                            progressMap[client._id] = calcularProgreso(workoutsData.workouts || []);
                        } else {
                            progressMap[client._id] = getDefaultProgress();
                        }
                    } catch (e) {
                        console.warn(`[Progress] Error cargando workouts de ${client.nombre}:`, e);
                        progressMap[client._id] = getDefaultProgress();
                    }
                })
            );

            setClientsProgress(progressMap);
        } catch (error) {
            console.error('[Progress] Error:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [token, API_URL]);

    useEffect(() => {
        fetchClientsAndProgress();
    }, [fetchClientsAndProgress]);

    // ═══════════════════════════════════════════════════════════════════════════
    // CÁLCULO DE PROGRESO
    // ═══════════════════════════════════════════════════════════════════════════
    const getDefaultProgress = () => ({
        tendencia: 0,
        diasSinEntrenar: null,
        sesionesSemana: 0,
        ultimaSesion: null,
        volumenSemanaActual: 0,
        volumenSemanaAnterior: 0,
        ultimoRPE: null,
        ultimoRPENote: null,
    });

    const calcularProgreso = (sessions) => {
        if (!sessions || sessions.length === 0) {
            return getDefaultProgress();
        }

        const ahora = new Date();
        const haceUnaSemana = new Date(ahora);
        haceUnaSemana.setDate(haceUnaSemana.getDate() - 7);
        const haceDosSemanas = new Date(ahora);
        haceDosSemanas.setDate(haceDosSemanas.getDate() - 14);

        // Separar sesiones por semana
        const semanaActual = sessions.filter(s => new Date(s.date) >= haceUnaSemana);
        const semanaAnterior = sessions.filter(s => {
            const fecha = new Date(s.date);
            return fecha >= haceDosSemanas && fecha < haceUnaSemana;
        });

        // Calcular volúmenes (Workout tiene totalVolume directo)
        const volumenSemanaActual = semanaActual.reduce((acc, s) => acc + (s.totalVolume || 0), 0);
        const volumenSemanaAnterior = semanaAnterior.reduce((acc, s) => acc + (s.totalVolume || 0), 0);

        // Calcular tendencia (% cambio)
        let tendencia = 0;
        if (volumenSemanaAnterior > 0) {
            tendencia = ((volumenSemanaActual - volumenSemanaAnterior) / volumenSemanaAnterior) * 100;
        } else if (volumenSemanaActual > 0) {
            tendencia = 100; // Si no había nada antes, es mejoría
        }

        // Última sesión y días sin entrenar
        const sessionsDates = sessions.map(s => new Date(s.date)).sort((a, b) => b - a);
        const ultimaSesion = sessionsDates[0];
        const diasSinEntrenar = ultimaSesion
            ? Math.floor((ahora - ultimaSesion) / (1000 * 60 * 60 * 24))
            : null;

        // Obtener último RPE de la sesión más reciente
        const sessionsSorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
        const ultimaSession = sessionsSorted[0];
        const ultimoRPE = ultimaSession?.sessionRPE || null;
        const ultimoRPENote = ultimaSession?.sessionNote || null;

        return {
            tendencia: Math.round(tendencia),
            diasSinEntrenar,
            sesionesSemana: semanaActual.length,
            ultimaSesion,
            volumenSemanaActual,
            volumenSemanaAnterior,
            ultimoRPE,
            ultimoRPENote,
        };
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS DE UI
    // ═══════════════════════════════════════════════════════════════════════════
    const getTendenciaInfo = (tendencia) => {
        if (tendencia > 5) return { icon: 'trending-up', color: '#10b981', text: `+${tendencia}%` };
        if (tendencia < -5) return { icon: 'trending-down', color: '#ef4444', text: `${tendencia}%` };
        return { icon: 'remove', color: '#6b7280', text: '0%' };
    };

    const formatUltimaSesion = (fecha) => {
        if (!fecha) return 'Sin datos';
        const dias = Math.floor((new Date() - new Date(fecha)) / (1000 * 60 * 60 * 24));
        if (dias === 0) return 'Hoy';
        if (dias === 1) return 'Ayer';
        return `Hace ${dias} días`;
    };

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchClientsAndProgress(true);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER TARJETA DE CLIENTE
    // ═══════════════════════════════════════════════════════════════════════════
    const renderClientCard = ({ item: client }) => {
        const progress = clientsProgress[client._id] || getDefaultProgress();
        const tendenciaInfo = getTendenciaInfo(progress.tendencia);
        const alertaDias = progress.diasSinEntrenar !== null && progress.diasSinEntrenar >= 4;

        return (
            <TouchableOpacity
                style={styles.clientCard}
                onPress={() => router.push({
                    pathname: '/(coach)/progress/[clientId]',
                    params: { clientId: client._id, clientName: client.nombre }
                })}
                activeOpacity={0.7}
            >
                {/* Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.clientInfo}>
                        <View style={{ marginRight: 10 }}>
                            <AvatarWithInitials
                                avatarUrl={client.avatarUrl}
                                name={client.nombre}
                                size={42}
                            />
                        </View>
                        <View style={styles.clientDetails}>
                            <Text style={styles.clientName}>{client.nombre}</Text>
                            <Text style={styles.clientEmail}>{client.email}</Text>
                        </View>
                    </View>

                    {/* Tendencia */}
                    <View style={[styles.tendenciaBadge, { backgroundColor: tendenciaInfo.color + '20' }]}>
                        <Ionicons name={tendenciaInfo.icon} size={20} color={tendenciaInfo.color} />
                        <Text style={[styles.tendenciaText, { color: tendenciaInfo.color }]}>
                            {tendenciaInfo.text}
                        </Text>
                    </View>

                    {/* 🆕 RPE Battery Ring */}
                    {progress.ultimoRPE && (
                        <View style={styles.rpeBatteryContainer}>
                            <View style={[
                                styles.rpeBatteryRing,
                                {
                                    borderColor: RPE_COLORS[progress.ultimoRPE] || '#CBD5E1',
                                    borderWidth: progress.ultimoRPE >= 4 ? 4 : 2,
                                }
                            ]}>
                                <View style={[
                                    styles.rpeBatteryFill,
                                    {
                                        backgroundColor: RPE_COLORS[progress.ultimoRPE] || '#CBD5E1',
                                        height: `${(progress.ultimoRPE / 5) * 100}%`,
                                    }
                                ]} />
                            </View>
                            {progress.ultimoRPENote && (
                                <View style={styles.rpeBatteryNoteDot} />
                            )}
                        </View>
                    )}
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                    {/* Última sesión */}
                    <View style={styles.statItem}>
                        <Ionicons name="time-outline" size={16} color="#64748b" />
                        <Text style={styles.statText}>
                            {formatUltimaSesion(progress.ultimaSesion)}
                        </Text>
                    </View>

                    {/* Sesiones/semana */}
                    <View style={styles.statItem}>
                        <Ionicons name="calendar-outline" size={16} color="#64748b" />
                        <Text style={styles.statText}>
                            {progress.sesionesSemana}/sem
                        </Text>
                    </View>

                    {/* Alerta si no entrena */}
                    {alertaDias && (
                        <View style={styles.alertBadge}>
                            <Ionicons name="warning" size={14} color="#f59e0b" />
                            <Text style={styles.alertText}>
                                {progress.diasSinEntrenar}d sin gym
                            </Text>
                        </View>
                    )}
                </View>

                {/* Barra de progreso visual */}
                <View style={styles.progressBarContainer}>
                    <View
                        style={[
                            styles.progressBar,
                            {
                                width: `${Math.min(100, Math.max(0, progress.sesionesSemana * 20))}%`,
                                backgroundColor: progress.sesionesSemana >= 3 ? '#10b981' :
                                    progress.sesionesSemana >= 2 ? '#f59e0b' : '#ef4444'
                            }
                        ]}
                    />
                </View>

                {/* Flecha para indicar acción */}
                <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>Ver análisis detallado</Text>
                    <Ionicons name="chevron-forward" size={18} color="#3b82f6" />
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="analytics-outline" size={80} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Sin Datos de Progreso</Text>
            <Text style={styles.emptyText}>
                Aún no tienes clientes con entrenamientos registrados.
            </Text>
        </View>
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════

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
            case 'sessions':
                result.sort((a, b) => (clientsProgress[b._id]?.sesionesSemana || 0) - (clientsProgress[a._id]?.sesionesSemana || 0));
                break;
            case 'recent':
            default:
                result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        return result;
    }, [clients, clientsProgress, searchQuery, sortBy]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <CoachHeader
                    title="Progreso"
                    subtitle="Análisis de clientes"
                    icon="stats-chart"
                    iconColor="#ef4444"
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ef4444" />
                    <Text style={styles.loadingText}>Cargando progreso...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Progreso"
                subtitle="Análisis de clientes"
                icon="stats-chart"
                iconColor="#ef4444"
                badge={`${clients.length} clientes`}
            />

            {/* Search and Sort Bar */}
            <View style={styles.searchSortBar}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color="#94a3b8" />
                    <EnhancedTextInput
                        style={styles.searchInput}
                        containerStyle={{ flex: 1 }}
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
                        style={[styles.sortBtn, sortBy === 'sessions' && styles.sortBtnActive]}
                        onPress={() => setSortBy('sessions')}
                    >
                        <Ionicons name="barbell-outline" size={16} color={sortBy === 'sessions' ? '#fff' : '#64748b'} />
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
                        colors={['#ef4444']}
                    />
                }
            />
        </SafeAreaView>
    );
}

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
    searchInput: {
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
        backgroundColor: '#ef4444',
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
    tendenciaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    tendenciaText: {
        fontSize: 14,
        fontWeight: '700',
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    alertBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    alertText: {
        fontSize: 11,
        color: '#d97706',
        fontWeight: '600',
    },

    // Barra de progreso
    progressBarContainer: {
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        marginBottom: 12,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 3,
    },

    // Footer
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
    },
    footerText: {
        fontSize: 13,
        color: '#3b82f6',
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

    // 🆕 RPE Battery Ring Styles
    rpeBatteryContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 10,
        position: 'relative',
    },
    rpeBatteryRing: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        overflow: 'hidden',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    rpeBatteryFill: {
        width: '100%',
        borderRadius: 0,
    },
    rpeBatteryNoteDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#3b82f6',
    },
});
