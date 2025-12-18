/* app/(coach)/nutrition/index.jsx - Lista de Clientes para Nutrición */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import { calculateFullNutrition } from '../../../src/utils/nutritionCalculator';

export default function NutritionClientsScreen() {
    const router = useRouter();
    const { token } = useAuth();

    const [clients, setClients] = useState([]);
    const [nutritionPlans, setNutritionPlans] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    useEffect(() => {
        fetchClientsWithNutrition();
    }, []);

    const fetchClientsWithNutrition = async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);

            // Fetch clients
            const clientsRes = await fetch(`${API_URL}/api/trainers/clients`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const clientsData = await clientsRes.json();

            if (clientsData.success) {
                setClients(clientsData.clients || []);
            }

            // Fetch nutrition plans (if endpoint exists)
            try {
                const plansRes = await fetch(`${API_URL}/api/nutrition-plans/coach/all`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const plansData = await plansRes.json();
                if (plansData.success && plansData.plans) {
                    // Convert to map by clientId
                    const plansMap = {};
                    plansData.plans.forEach(p => {
                        plansMap[p.target] = p;
                    });
                    setNutritionPlans(plansMap);
                }
            } catch (e) {
                // Endpoint doesn't exist yet - that's fine
                console.log('[NutritionClients] Plans endpoint not available yet');
            }

        } catch (error) {
            console.error('[NutritionClients] Error:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchClientsWithNutrition(true);
    };

    // Calculate auto nutrition for display
    const getClientNutritionSummary = (client) => {
        const plan = nutritionPlans[client._id];
        const info = client.info_user || {};

        // If has custom plan active
        if (plan && plan.mode === 'custom' && plan.status === 'active') {
            const dayTarget = plan.customPlan?.dayTargets?.[0];
            return {
                mode: 'custom',
                kcal: dayTarget?.kcal || '---',
                hasCoachPlan: true,
            };
        }

        // Calculate auto nutrition
        if (info.edad && info.peso && info.altura && info.genero) {
            const nutrition = calculateFullNutrition(info, info.objetivos, client.af || 1.55);
            if (nutrition) {
                return {
                    mode: 'auto',
                    kcal: nutrition.training.kcal,
                    hasCoachPlan: false,
                };
            }
        }

        return {
            mode: 'none',
            kcal: '---',
            hasCoachPlan: false,
        };
    };

    const formatHeight = (altura) => {
        if (!altura) return '---';
        // If in meters (< 3), convert to readable format
        if (altura < 3) return `${(altura * 100).toFixed(0)} cm`;
        return `${altura} cm`;
    };

    const renderClientCard = ({ item }) => {
        const info = item.info_user || {};
        const nutritionSummary = getClientNutritionSummary(item);
        const plan = nutritionPlans[item._id];

        // Status badge
        let statusBadge = null;
        if (plan?.status === 'active') {
            statusBadge = { color: '#10b981', text: 'Activo', icon: 'checkmark-circle' };
        } else if (plan?.status === 'draft') {
            statusBadge = { color: '#f59e0b', text: 'Borrador', icon: 'create' };
        }

        return (
            <TouchableOpacity
                style={styles.clientCard}
                onPress={() => router.push({
                    pathname: '/(coach)/nutrition/[clientId]',
                    params: { clientId: item._id, clientName: item.nombre }
                })}
                activeOpacity={0.7}
            >
                {/* Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarText}>
                            {item.nombre?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                    </View>
                    <View style={styles.clientInfo}>
                        <Text style={styles.clientName}>{item.nombre}</Text>
                        {statusBadge && (
                            <View style={[styles.statusBadge, { backgroundColor: statusBadge.color + '20' }]}>
                                <Ionicons name={statusBadge.icon} size={12} color={statusBadge.color} />
                                <Text style={[styles.statusText, { color: statusBadge.color }]}>
                                    {statusBadge.text}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Ionicons name="resize-outline" size={16} color="#64748b" />
                        <Text style={styles.statValue}>{formatHeight(info.altura)}</Text>
                        <Text style={styles.statLabel}>Altura</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons name="barbell-outline" size={16} color="#64748b" />
                        <Text style={styles.statValue}>{info.peso || '---'} kg</Text>
                        <Text style={styles.statLabel}>Peso</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons name="person-outline" size={16} color="#64748b" />
                        <Text style={styles.statValue}>
                            {info.genero === 'hombre' ? '♂' : info.genero === 'mujer' ? '♀' : '---'}
                        </Text>
                        <Text style={styles.statLabel}>Género</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons name="flame-outline" size={16} color="#64748b" />
                        <Text style={[styles.statValue, nutritionSummary.mode === 'custom' && styles.customValue]}>
                            {typeof nutritionSummary.kcal === 'number'
                                ? nutritionSummary.kcal.toLocaleString()
                                : nutritionSummary.kcal}
                        </Text>
                        <Text style={styles.statLabel}>kcal</Text>
                    </View>
                </View>

                {/* Objetivo row */}
                <View style={styles.objetivoRow}>
                    <View style={[
                        styles.objetivoBadge,
                        { backgroundColor: info.objetivos?.includes('volumen') ? '#3b82f620' : '#ef444420' }
                    ]}>
                        <Ionicons
                            name={info.objetivos?.includes('volumen') ? 'trending-up' : 'trending-down'}
                            size={14}
                            color={info.objetivos?.includes('volumen') ? '#3b82f6' : '#ef4444'}
                        />
                        <Text style={[
                            styles.objetivoText,
                            { color: info.objetivos?.includes('volumen') ? '#3b82f6' : '#ef4444' }
                        ]}>
                            {info.objetivos?.includes('volumen') ? 'Volumen' :
                                info.objetivos?.includes('definici') ? 'Definición' :
                                    info.objetivos || 'Sin objetivo'}
                        </Text>
                    </View>

                    <View style={[
                        styles.modeBadge,
                        { backgroundColor: nutritionSummary.mode === 'custom' ? '#8b5cf620' : '#64748b15' }
                    ]}>
                        <Ionicons
                            name={nutritionSummary.mode === 'custom' ? 'create' : 'calculator'}
                            size={12}
                            color={nutritionSummary.mode === 'custom' ? '#8b5cf6' : '#64748b'}
                        />
                        <Text style={[
                            styles.modeText,
                            { color: nutritionSummary.mode === 'custom' ? '#8b5cf6' : '#64748b' }
                        ]}>
                            {nutritionSummary.mode === 'custom' ? 'Personalizado' : 'Auto'}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="nutrition-outline" size={80} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Sin Clientes</Text>
            <Text style={styles.emptyText}>
                No tienes clientes asignados. Comparte tu código de entrenador para que se vinculen.
            </Text>
        </View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <CoachHeader
                    title="Nutrición"
                    subtitle="Planes nutricionales"
                    icon="nutrition"
                    iconColor="#22c55e"
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#22c55e" />
                    <Text style={styles.loadingText}>Cargando clientes...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Nutrición"
                subtitle={`${clients.length} clientes`}
                icon="nutrition"
                iconColor="#22c55e"
            />

            {/* Planes Nutricionales Button */}
            <TouchableOpacity
                style={styles.templatesBtn}
                onPress={() => router.push('/(coach)/nutrition/templates')}
            >
                <View style={styles.templatesBtnLeft}>
                    <Ionicons name="nutrition" size={20} color="#8b5cf6" />
                    <Text style={styles.templatesBtnText}>Planes Nutricionales</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#8b5cf6" />
            </TouchableOpacity>

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
                        colors={['#22c55e']}
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
    list: {
        padding: 16,
    },
    emptyList: {
        flex: 1,
    },

    // Templates Button
    templatesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#8b5cf615',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#8b5cf630',
    },
    templatesBtnLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    templatesBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#8b5cf6',
    },

    // Client Card
    clientCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#22c55e',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    clientInfo: {
        flex: 1,
    },
    clientName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1e293b',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 4,
        marginTop: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },

    // Stats Grid
    statsGrid: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 4,
    },
    statLabel: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    customValue: {
        color: '#8b5cf6',
    },

    // Objetivo row
    objetivoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    objetivoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    objetivoText: {
        fontSize: 12,
        fontWeight: '600',
    },
    modeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    modeText: {
        fontSize: 12,
        fontWeight: '500',
    },

    // Empty state
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 16,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 22,
    },
});
