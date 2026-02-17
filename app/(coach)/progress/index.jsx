/* coach/progress/index.jsx
   ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD DE PROGRESO DE CLIENTES (CARD VIEW DESIGN)
   - Diseño unificado con la vista de Clientes
   - KPIs visuales: Fuerza (Tendencia), Volumen Total, Asistencia
   - Alertas inteligentes
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity
} from 'react-native';
import { EnhancedTextInput } from '../../../components/ui';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import ProgressListRow from '../components/ProgressListRow';

export default function ProgressDashboard() {
    const router = useRouter();
    const { token } = useAuth();
    const [clients, setClients] = useState([]);
    const [clientsProgress, setClientsProgress] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Search and Sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name', 'performance'

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    // ═══════════════════════════════════════════════════════════════════════════
    // CARGAR CLIENTES Y SU PROGRESO
    // ═══════════════════════════════════════════════════════════════════════════
    const fetchClientsAndProgress = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);

            // 1. Obtener lista de clientes EXTENDIDA (para tener rutinas, avatar, etc.)
            // Usamos el mismo endpoint que en la vista de Clientes para consistencia
            const clientsRes = await fetch(`${API_URL}/api/trainers/clients-extended`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const clientsData = await clientsRes.json();

            if (!clientsData.success) {
                console.warn('[Progress] Error cargando clientes');
                return;
            }

            const clientsList = clientsData.clients || [];
            setClients(clientsList);

            // 2. Obtener workouts de TODOS los clientes en una sola llamada (bulk)
            // Necesitamos esto para calcular las tendencias (trends) de volúmenes de 7 días
            const fourWeeksAgo = new Date();
            fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
            const userIds = clientsList.map(c => c._id);

            const progressMap = {};

            try {
                const bulkRes = await fetch(`${API_URL}/api/workouts/bulk-by-users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        userIds,
                        startDate: fourWeeksAgo.toISOString(),
                        limit: 100,
                    }),
                });
                const bulkData = await bulkRes.json();

                if (bulkData.success && bulkData.workoutsByUser) {
                    // Procesar todos los workouts agrupados por usuario
                    for (const client of clientsList) {
                        const workouts = bulkData.workoutsByUser[client._id] || [];
                        progressMap[client._id] = calcularProgreso(workouts);
                    }
                } else {
                    // Si el bulk falla, no bloqueamos, usamos datos vacíos o fallback
                    console.warn('Bulk endpoint returned unsuccessful');
                }
            } catch (bulkError) {
                console.warn('[Progress] Bulk fetch error:', bulkError);
            }

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
    // CÁLCULO DE PROGRESO (Logica de Negocio)
    // ═══════════════════════════════════════════════════════════════════════════
    const getDefaultProgress = () => ({
        tendencia: 0,
        diasSinEntrenar: null,
        sesionesSemana: 0,
        ultimaSesion: null,
        volumenSemanaActual: 0,
        volumenSemanaAnterior: 0,
        ultimoRPE: null,
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
            tendencia = 100; // Si no había nada antes, es mejoría inicial
        }

        // Última sesión y días sin entrenar
        const sessionsDates = sessions.map(s => new Date(s.date)).sort((a, b) => b - a);
        const ultimaSesion = sessionsDates[0];
        const diasSinEntrenar = ultimaSesion
            ? Math.floor((ahora - ultimaSesion) / (1000 * 60 * 60 * 24))
            : null;

        return {
            tendencia: Math.round(tendencia),
            diasSinEntrenar,
            sesionesSemana: semanaActual.length,
            ultimaSesion,
            volumenSemanaActual,
            volumenSemanaAnterior,
        };
    };

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchClientsAndProgress(true);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    const filteredClients = React.useMemo(() => {
        let result = [...clients];

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(c =>
                c.nombre?.toLowerCase().includes(q) ||
                c.email?.toLowerCase().includes(q)
            );
        }

        // Sort
        switch (sortBy) {
            case 'name':
                result.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
                break;
            case 'performance':
                // Sort by trend descending
                result.sort((a, b) => (clientsProgress[b._id]?.tendencia || 0) - (clientsProgress[a._id]?.tendencia || 0));
                break;
            case 'recent':
            default:
                // Sort by active status (days since last tracking ascending which means more recent)
                result.sort((a, b) => {
                    const daysA = clientsProgress[a._id]?.diasSinEntrenar ?? 999;
                    const daysB = clientsProgress[b._id]?.diasSinEntrenar ?? 999;
                    return daysA - daysB;
                });
        }
        return result;
    }, [clients, clientsProgress, searchQuery, sortBy]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <CoachHeader title="Progreso" subtitle="Análisis de rendimiento de clientes" icon="stats-chart" iconColor="#2563EB" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={styles.loadingText}>Cargando rendimiento...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Progreso"
                subtitle="Análisis de rendimiento de clientes"
                icon="stats-chart"
                iconColor="#2563EB" // Changed to Blue as per prompt
                badge={`${clients.length} clientes activos`}
                showBack={false}
            />

            {/* Search and Sort Bar */}
            <View style={styles.searchSortBar}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color="#94a3b8" />
                    <EnhancedTextInput
                        style={styles.searchInput}
                        containerStyle={{ flex: 1 }}
                        placeholder="Buscar por nombre, rutina o correo..."
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

                {/* Sort Toggle Buttons */}
                <View style={styles.sortButtons}>
                    <TouchableOpacity
                        style={[styles.sortBtn, sortBy === 'recent' && styles.sortBtnActive]}
                        onPress={() => setSortBy('recent')}
                    >
                        <Ionicons name="time" size={16} color={sortBy === 'recent' ? '#2563EB' : '#64748b'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.sortBtn, sortBy === 'performance' && styles.sortBtnActive]}
                        onPress={() => setSortBy('performance')}
                    >
                        <Ionicons name="trending-up" size={16} color={sortBy === 'performance' ? '#2563EB' : '#64748b'} />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={filteredClients}
                keyExtractor={(item) => item._id}
                style={{ flex: 1 }}
                renderItem={({ item }) => (
                    <ProgressListRow
                        client={item}
                        progress={clientsProgress[item._id]}
                        onPress={() => router.push({
                            pathname: '/(coach)/progress/[clientId]',
                            params: { clientId: item._id, clientName: item.nombre }
                        })}
                    />
                )}
                ListEmptyComponent={
                    !isLoading && (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="analytics-outline" size={80} color="#cbd5e1" />
                            <Text style={styles.emptyTitle}>Sin Datos de Progreso</Text>
                            <Text style={styles.emptyText}>
                                No se encontraron clientes activos con datos recientes.
                            </Text>
                        </View>
                    )
                }
                contentContainerStyle={[styles.list, filteredClients.length === 0 && styles.listEmpty]}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        colors={['#2563EB']}
                    />
                }
                showsVerticalScrollIndicator={false}
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
        paddingVertical: 12,
        gap: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 42,
        gap: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchInput: {
        fontSize: 14,
        color: '#1e293b',
    },
    sortButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    sortBtn: {
        width: 42,
        height: 42,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sortBtnActive: {
        borderColor: '#bfdbfe',
        backgroundColor: '#eff6ff',
    },
    list: {
        padding: 16,
    },
    listEmpty: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748b',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 16,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
});
