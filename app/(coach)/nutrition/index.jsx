import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    Platform,
    Switch,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';
import { calculateFullNutrition } from '../../../src/utils/nutritionCalculator';
// Componentes mejorados para iOS
import {
    EnhancedTouchable as TouchableOpacity,
    EnhancedPressable as Pressable,
    EnhancedTextInput as TextInput,
} from '../../../components/ui';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE BADGE HELPER
// ═══════════════════════════════════════════════════════════════════════════
const getPhaseBadge = (objetivo) => {
    const obj = objetivo?.toLowerCase() || '';

    if (obj.includes('volumen') || obj.includes('ganar') || obj.includes('musculo') || obj.includes('músculo')) {
        return { label: 'Volumen', icon: 'rocket', color: '#3b82f6', bgColor: '#dbeafe' };
    }
    if (obj.includes('mantener') || obj.includes('recomp') || obj.includes('mantenimiento')) {
        return { label: 'Mantenimiento', icon: 'sync', color: '#10b981', bgColor: '#d1fae5' };
    }
    if (obj.includes('definici') || obj.includes('perder') || obj.includes('grasa') || obj.includes('cutting')) {
        return { label: 'Definición', icon: 'flame', color: '#ef4444', bgColor: '#fee2e2' };
    }
    return { label: 'Pausado', icon: 'pause', color: '#94a3b8', bgColor: '#f1f5f9' };
};

// ═══════════════════════════════════════════════════════════════════════════
// AI HEALTH SCORE HELPER
// ═══════════════════════════════════════════════════════════════════════════
const getAIHealthStatus = (adherenceScore, weightTrend, daysInactive, objetivo) => {
    // 🔴 Risk: 3+ days without tracking
    if (daysInactive >= 3) {
        return { color: '#ef4444', label: 'Riesgo', tooltip: 'Sin registrar por 3+ días' };
    }

    // 🔵 Stagnant: weight hasn't changed in 3 weeks despite adherence
    const obj = objetivo?.toLowerCase() || '';
    const isWeightLossGoal = obj.includes('definici') || obj.includes('perder') || obj.includes('grasa');
    const isWeightGainGoal = obj.includes('volumen') || obj.includes('ganar');

    if (adherenceScore >= 80 && Math.abs(weightTrend) < 0.2) {
        if (isWeightLossGoal || isWeightGainGoal) {
            return { color: '#3b82f6', label: 'Estancado', tooltip: 'Peso estable con adherencia alta' };
        }
    }

    // 🟢 Normal
    return { color: '#10b981', label: 'Normal', tooltip: 'Todo progresa correctamente' };
};

// ═══════════════════════════════════════════════════════════════════════════
// ADHERENCE RING COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const AdherenceRing = ({ percentage, size = 44 }) => {
    const normalizedPercentage = Math.min(100, Math.max(0, percentage || 0));
    const strokeWidth = 4;

    // Determine color based on percentage
    let color = '#10b981'; // green
    if (normalizedPercentage < 50) color = '#ef4444'; // red
    else if (normalizedPercentage < 75) color = '#f59e0b'; // orange

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            {/* Background ring */}
            <View style={{
                position: 'absolute',
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: '#e2e8f0',
            }} />
            {/* Foreground ring - simplified as background fill for RN */}
            <View style={{
                width: size - strokeWidth * 2,
                height: size - strokeWidth * 2,
                borderRadius: (size - strokeWidth * 2) / 2,
                backgroundColor: `${color}20`,
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color }}>
                    {Math.round(normalizedPercentage)}%
                </Text>
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function NutritionClientsScreen() {
    const router = useRouter();
    const { token } = useAuth();

    const [clients, setClients] = useState([]);
    const [nutritionPlans, setNutritionPlans] = useState({});
    const [clientMetrics, setClientMetrics] = useState({}); // Metrics from monitoring API
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Search and Sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('activity'); // 'name', 'activity', 'aiHealth'
    const [sortMenuOpen, setSortMenuOpen] = useState(false);

    // Hover tooltip state (web only)
    const [hoveredClientId, setHoveredClientId] = useState(null);
    const [hoveredTCAId, setHoveredTCAId] = useState(null);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    useFocusEffect(
        useCallback(() => {
            fetchClientsWithNutrition();
        }, [])
    );

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

            // Fetch nutrition plans (NEW: CurrentNutritionPlan)
            try {
                const plansRes = await fetch(`${API_URL}/api/current-nutrition/coach/all?status=active`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const plansData = await plansRes.json();
                if (plansData.success && plansData.plans) {
                    const plansMap = {};
                    plansData.plans.forEach(p => {
                        // Map by userId (populated field has _id)
                        const clientId = p.userId?._id || p.userId;
                        plansMap[clientId] = p;
                    });
                    setNutritionPlans(plansMap);
                }
            } catch (e) {
                console.log('[NutritionClients] Current nutrition endpoint not available yet', e);
            }

            // Fetch monitoring metrics (for adherence, weight trend, etc.)
            try {
                const metricsRes = await fetch(`${API_URL}/api/monitoring/coach/sidebar-status?context=nutrition`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const metricsData = await metricsRes.json();
                if (metricsData.success && metricsData.clients) {
                    const metricsMap = {};
                    metricsData.clients.forEach(c => {
                        metricsMap[c._id] = c;
                    });
                    setClientMetrics(metricsMap);
                }
            } catch (e) {
                console.log('[NutritionClients] Metrics endpoint not available');
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

    // Calculate nutrition summary based on plan type
    const getClientNutritionSummary = (client) => {
        const plan = nutritionPlans[client._id];
        const info = client.info_user || {};

        if (plan && plan.status === 'active') {
            switch (plan.planType) {
                case 'complete':
                    // Use the first dayTemplate's targetMacros
                    const firstTemplate = plan.dayTemplates?.[0];

                    // Check if it's a "Macro Plan" (Flexible) vs "Meal Plan" (Complete)
                    // If no meals are defined in templates or structure, treat as Flexible/Macro plan
                    const hasMeals = plan.mealStructure?.length > 0 || plan.dayTemplates?.some(dt => dt.meals?.length > 0);
                    const effectivePlanType = hasMeals ? 'complete' : 'flex';

                    return {
                        mode: effectivePlanType,
                        planType: effectivePlanType,
                        kcal: firstTemplate?.targetMacros?.kcal || '---',
                        hasCoachPlan: true,
                        planName: plan.name,
                    };
                case 'flex':
                    return {
                        mode: 'flex',
                        planType: 'flex',
                        kcal: plan.fixedMacros?.kcal || '---',
                        hasCoachPlan: true,
                        planName: plan.name,
                    };
                case 'auto':
                    // Calculate dynamically using autoConfig
                    if (plan.autoConfig) {
                        if (info.peso && info.altura && info.edad) {
                            const { activityFactor, adjustmentPercentage, proteinPerKg } = plan.autoConfig;
                            let bmr;
                            if (info.genero === 'masculino' || info.genero === 'male') {
                                bmr = 10 * info.peso + 6.25 * info.altura - 5 * info.edad + 5;
                            } else {
                                bmr = 10 * info.peso + 6.25 * info.altura - 5 * info.edad - 161;
                            }
                            const tdee = bmr * (activityFactor || 1.55);
                            const kcal = Math.round(tdee * (1 + (adjustmentPercentage || 0) / 100));
                            return {
                                mode: 'auto',
                                planType: 'auto',
                                kcal,
                                hasCoachPlan: true,
                                planName: plan.name,
                            };
                        } else {
                            // Plan exists but data missing to calculate
                            return {
                                mode: 'auto',
                                planType: 'auto',
                                kcal: '---',
                                hasCoachPlan: true,
                                planName: plan.name,
                                warning: true
                            };
                        }
                    }
                    break;
            }
        }

        // Fallback: Calculate auto if client has required data
        if (info.edad && info.peso && info.altura && info.genero) {
            const nutrition = calculateFullNutrition(info, info.objetivos, client.af || 1.55);
            if (nutrition) {
                return {
                    mode: 'none',
                    planType: null,
                    kcal: nutrition.training.kcal,
                    hasCoachPlan: false,
                };
            }
        }

        return { mode: 'none', planType: null, kcal: '---', hasCoachPlan: false };
    };

    // Helper to see if client is TCA (Sensitive Mode)
    const isSensitiveClient = (client) => {
        return client.clientSettings?.hideMacros === true;
    };

    // Calculate adherence and weight trend from metrics
    const getClientStats = (clientId, info) => {
        const metrics = clientMetrics[clientId] || {};

        // Adherence: from sidebar metrics or calculate (default to random for demo)
        let adherenceScore = metrics.adherenceScore ?? metrics.adherence ?? null;
        if (adherenceScore === null && metrics.daysSinceLastTracking !== undefined) {
            // Simple calculation: if tracked recently, higher score
            adherenceScore = metrics.daysSinceLastTracking === 0 ? 95 :
                metrics.daysSinceLastTracking <= 2 ? 80 :
                    metrics.daysSinceLastTracking <= 5 ? 50 : 20;
        }

        // Weight trend: from metrics or calculate from peso
        let weightTrend = metrics.weightTrend ?? 0;
        const currentWeight = metrics.lastWeight ?? info?.peso ?? null;

        // Days inactive
        const daysInactive = metrics.daysSinceLastTracking ?? 0;

        // Last check-in text
        let lastCheckIn = 'Sin actividad';
        if (daysInactive === 0) lastCheckIn = 'Hoy';
        else if (daysInactive === 1) lastCheckIn = 'Ayer';
        else if (daysInactive <= 7) lastCheckIn = `Hace ${daysInactive} días`;
        else lastCheckIn = `Hace ${Math.floor(daysInactive / 7)} semana(s)`;

        return { adherenceScore, weightTrend, currentWeight, daysInactive, lastCheckIn };
    };

    // Handler to toggle Sensitive Mode (TCA)
    const handleToggleSensitive = async (client) => {
        const isCurrentlySensitive = isSensitiveClient(client);
        const newValue = !isCurrentlySensitive;

        // Optimistic Update
        const updatedClients = clients.map(c => {
            if (c._id === client._id) {
                return {
                    ...c,
                    clientSettings: {
                        ...c.clientSettings,
                        hideMacros: newValue
                    }
                };
            }
            return c;
        });
        setClients(updatedClients);

        // API Call
        try {
            const res = await fetch(`${API_URL}/api/nutrition-plans/clients/${client._id}/settings`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ hideMacros: newValue })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
        } catch (error) {
            console.error("Error toggling sensitive mode:", error);
            // Revert on error
            alert("No se pudo actualizar el modo. Verifica tu conexión.");
            // Revert manually
            setClients(prev => prev.map(c => {
                if (c._id === client._id) {
                    return { ...c, clientSettings: { ...c.clientSettings, hideMacros: isCurrentlySensitive } };
                }
                return c;
            }));
        }
    };

    // Filter and sort clients
    const filteredClients = useMemo(() => {
        let result = [...clients];

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(c => {
                const nameMatch = c.nombre?.toLowerCase().includes(q);
                // Also search by tag "tca" or "sensible"
                const tcaMatch = (q.includes('tca') || q.includes('sensible')) && isSensitiveClient(c);
                return nameMatch || tcaMatch;
            });
        }

        // Sort
        switch (sortBy) {
            case 'activity':
                result.sort((a, b) => {
                    const aDays = clientMetrics[a._id]?.daysSinceLastTracking ?? 999;
                    const bDays = clientMetrics[b._id]?.daysSinceLastTracking ?? 999;
                    return aDays - bDays;
                });
                break;
            case 'aiHealth':
                result.sort((a, b) => {
                    const aStats = getClientStats(a._id, a.info_user);
                    const bStats = getClientStats(b._id, b.info_user);
                    const aAI = getAIHealthStatus(aStats.adherenceScore, aStats.weightTrend, aStats.daysInactive, a.info_user?.objetivos);
                    const bAI = getAIHealthStatus(bStats.adherenceScore, bStats.weightTrend, bStats.daysInactive, b.info_user?.objetivos);
                    // Priority: red > blue > green
                    const priority = { '#ef4444': 0, '#3b82f6': 1, '#10b981': 2 };
                    return (priority[aAI.color] ?? 3) - (priority[bAI.color] ?? 3);
                });
                break;
            case 'name':
            default:
                result.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        }

        return result;
    }, [clients, nutritionPlans, clientMetrics, searchQuery, sortBy]);

    // ═══════════════════════════════════════════════════════════════════════
    // RENDER CLIENT CARD - SMART CARD DESIGN
    // ═══════════════════════════════════════════════════════════════════════
    const renderClientCard = ({ item }) => {
        const info = item.info_user || {};
        const nutritionSummary = getClientNutritionSummary(item);
        const stats = getClientStats(item._id, info);
        const phaseBadge = getPhaseBadge(info.objetivos);
        const aiHealth = getAIHealthStatus(stats.adherenceScore, stats.weightTrend, stats.daysInactive, info.objetivos);
        const isSensitive = isSensitiveClient(item);

        return (
            <TouchableOpacity
                style={styles.clientCard}
                onPress={() => router.push({
                    pathname: '/(coach)/nutrition/[clientId]',
                    params: { clientId: item._id, clientName: item.nombre }
                })}
                activeOpacity={0.7}
            >
                {/* ─── COLUMN 1: IDENTITY & STATUS ───────────────────────────── */}
                <View style={styles.cardColLeft}>
                    {/* Avatar */}
                    <View style={styles.avatarContainer}>
                        <AvatarWithInitials
                            avatarUrl={item.avatarUrl || item.profilePic}
                            name={item.nombre}
                            size={52}
                        />
                        {/* AI Status Dot */}
                        <View style={[styles.aiStatusDot, { backgroundColor: aiHealth.color }]} />
                    </View>

                    {/* Name */}
                    <Text style={styles.clientName} numberOfLines={1}>{item.nombre}</Text>

                    {/* Phase Badge */}
                    <View style={[styles.phaseBadgePill, { backgroundColor: phaseBadge.bgColor }]}>
                        <Text style={[styles.phaseBadgePillText, { color: phaseBadge.color }]}>{phaseBadge.label}</Text>
                    </View>

                    {/* Last Active */}
                    <Text style={styles.lastCheckInText}>
                        {stats.lastCheckIn}
                    </Text>
                </View>

                {/* ─── COLUMN 2: METRICS & ACTIONS ───────────────────────────── */}
                <View style={styles.cardColRight}>
                    {/* Header: TCA Toggle */}
                    <View style={styles.colRightHeader}>
                        <View style={{ position: 'relative', zIndex: 200 }}>
                            <Pressable
                                style={styles.tcaSwitchContainer}
                                onHoverIn={() => Platform.OS === 'web' && setHoveredTCAId(item._id)}
                                onHoverOut={() => Platform.OS === 'web' && setHoveredTCAId(null)}
                            >
                                <Text style={[styles.tcaLabel, isSensitive && styles.tcaLabelActive]}>
                                    {isSensitive ? "Modo Seguro (TCA)" : "Visible"}
                                </Text>
                                <Switch
                                    trackColor={{ false: "#e2e8f0", true: "#fef3c7" }} // Amber-100
                                    thumbColor={isSensitive ? "#f59e0b" : "#f4f3f4"}
                                    ios_backgroundColor="#e2e8f0"
                                    onValueChange={() => handleToggleSensitive(item)}
                                    value={isSensitive}
                                    style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
                                />
                            </Pressable>
                            {/* Tooltip */}
                            {Platform.OS === 'web' && hoveredTCAId === item._id && (
                                <View style={styles.tcaTooltip}>
                                    <Text style={styles.tcaTooltipText}>
                                        Activa para ocultar métricas sensibles (calorías, peso) al cliente.
                                    </Text>
                                    <View style={styles.tcaTooltipArrow} />
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Metrics Grid */}
                    <View style={styles.metricsGrid}>
                        {/* Weight */}
                        <View style={styles.metricBox}>
                            <Text style={styles.metaLabel}>PESO</Text>
                            <Text style={styles.metaValue}>
                                {stats.currentWeight || '--'} <Text style={styles.metaUnit}>kg</Text>
                            </Text>
                        </View>

                        {/* Calories */}
                        <View style={styles.metricBox}>
                            <Text style={styles.metaLabel}>KCAL</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={styles.metaValue}>
                                    {typeof nutritionSummary.kcal === 'number'
                                        ? nutritionSummary.kcal.toLocaleString()
                                        : nutritionSummary.kcal
                                    }
                                </Text>
                                {isSensitive && <Ionicons name="shield-checkmark" size={14} color="#f59e0b" />}
                            </View>
                        </View>

                        {/* Adherence */}
                        <View style={styles.metricBoxAdherence}>
                            <AdherenceRing percentage={stats.adherenceScore} size={38} />
                        </View>
                    </View>

                    {/* Actions Footer */}
                    <View style={styles.actionsFooter}>
                        <View style={styles.planInfoRow}>
                            {nutritionSummary.planType && (
                                <Text style={{ fontSize: 10, marginRight: 4 }}>
                                    {nutritionSummary.planType === 'auto' ? '🤖' :
                                        nutritionSummary.planType === 'flex' ? '🔀' : '📋'}
                                </Text>
                            )}
                            <Text style={styles.planNameText} numberOfLines={1}>
                                {nutritionSummary.planName || 'Sin Plan'}
                            </Text>
                        </View>

                        <View style={styles.actionButtonsRow}>
                            <TouchableOpacity style={styles.miniActionBtn} onPress={(e) => {
                                e.stopPropagation();
                                router.push({
                                    pathname: '/(coach)/nutrition/[clientId]',
                                    params: { clientId: item._id, clientName: item.nombre }
                                });
                            }}>
                                <Ionicons name="create-outline" size={16} color="#64748b" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.miniActionBtn} onPress={(e) => {
                                e.stopPropagation();
                                router.push({
                                    pathname: '/(coach)/seguimiento_coach/[clientId]',
                                    params: { clientId: item._id, clientName: item.nombre }
                                });
                            }}>
                                <Ionicons name="stats-chart-outline" size={16} color="#64748b" />
                            </TouchableOpacity>
                        </View>
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

    // ═══════════════════════════════════════════════════════════════════════
    // BULK TOGGLE HANDLER (Global)
    // ═══════════════════════════════════════════════════════════════════════
    const handleBulkToggle = async () => {
        const targets = JSON.parse(JSON.stringify(filteredClients)); // Deep copy targets
        if (targets.length === 0) return;

        // Logic: If ANY visible client is NOT Sensitive (false/undefined) -> Turn ALL ON (true).
        // Only if ALL visible clients are Sensitive (true) -> Turn ALL OFF (false).
        const anyVisible = targets.some(c => !c.clientSettings?.hideMacros);
        const newSensitiveState = anyVisible; // true = make sensitive (hide macros)

        // 1. Optimistic Update
        const updatedClients = clients.map(c => {
            const isTarget = targets.find(t => t._id === c._id);
            if (isTarget) {
                return {
                    ...c,
                    clientSettings: {
                        ...c.clientSettings,
                        hideMacros: newSensitiveState
                    }
                };
            }
            return c;
        });
        setClients(updatedClients);

        // 2. Bulk API Calls (Promise.all)
        try {
            const promises = targets.map(c =>
                fetch(`${API_URL}/api/nutrition-plans/clients/${c._id}/settings`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ hideMacros: newSensitiveState })
                })
            );
            await Promise.all(promises);
        } catch (error) {
            console.error("Error in bulk toggle:", error);
            alert("Error al actualizar algunos clientes. Por favor recarga.");
            onRefresh(); // Revert/Sync on error
        }
    };

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
                subtitle={`${clients.length} clientes activos`}
                icon="nutrition"
                iconColor="#22c55e"
            />

            {/* Planes Nutricionales Banner */}
            <TouchableOpacity
                style={styles.plansBanner}
                onPress={() => router.push('/(coach)/nutrition/templates')}
            >
                <View style={styles.plansBannerContent}>
                    <View style={styles.plansBannerIcon}>
                        <Ionicons name="clipboard" size={22} color="#fff" />
                    </View>
                    <View>
                        <Text style={styles.plansBannerTitle}>Planes Nutricionales</Text>
                        <Text style={styles.plansBannerSubtitle}>Gestiona las plantillas y asignaciones masivas</Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>

            {/* Search and Sort Bar */}
            <View style={styles.searchSortBar}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Listado de Clientes</Text>
                </View>
                <View style={styles.sortWrapper}>
                    <Text style={styles.sortLabel}>Ordenar por:</Text>
                    <TouchableOpacity
                        style={styles.sortDropdown}
                        onPress={() => setSortMenuOpen(!sortMenuOpen)}
                    >
                        <Text style={styles.sortDropdownText}>
                            {sortBy === 'activity' ? 'Actividad Reciente' :
                                sortBy === 'aiHealth' ? 'Estado IA' : 'Nombre'}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color="#64748b" />
                    </TouchableOpacity>

                    {/* Sort Menu Dropdown */}
                    {sortMenuOpen && (
                        <View style={styles.sortMenu}>
                            <TouchableOpacity
                                style={[styles.sortMenuItem, sortBy === 'activity' && styles.sortMenuItemActive]}
                                onPress={() => { setSortBy('activity'); setSortMenuOpen(false); }}
                            >
                                <Ionicons name="time-outline" size={14} color={sortBy === 'activity' ? '#3b82f6' : '#64748b'} />
                                <Text style={[styles.sortMenuItemText, sortBy === 'activity' && styles.sortMenuItemTextActive]}>
                                    Actividad Reciente
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.sortMenuItem, sortBy === 'aiHealth' && styles.sortMenuItemActive]}
                                onPress={() => { setSortBy('aiHealth'); setSortMenuOpen(false); }}
                            >
                                <Ionicons name="medical-outline" size={14} color={sortBy === 'aiHealth' ? '#3b82f6' : '#64748b'} />
                                <Text style={[styles.sortMenuItemText, sortBy === 'aiHealth' && styles.sortMenuItemTextActive]}>
                                    Estado IA
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.sortMenuItem, sortBy === 'name' && styles.sortMenuItemActive]}
                                onPress={() => { setSortBy('name'); setSortMenuOpen(false); }}
                            >
                                <Ionicons name="text-outline" size={14} color={sortBy === 'name' ? '#3b82f6' : '#64748b'} />
                                <Text style={[styles.sortMenuItemText, sortBy === 'name' && styles.sortMenuItemTextActive]}>
                                    Nombre
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>

            {/* Search Input Row */}
            <View style={styles.searchBar}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar cliente por nombre..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* BULK TOGGLE BUTTON (Replaces Filter) */}
                <TouchableOpacity
                    style={[styles.filterTagBtn, { backgroundColor: '#fff', borderColor: '#e2e8f0', flexDirection: 'row', gap: 6 }]}
                    onPress={handleBulkToggle}
                >
                    <Ionicons name="shield-checkmark" size={16} color="#f59e0b" />
                    <Text style={styles.filterTagText}>
                        Global TCA
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Clients List */}
            <FlatList
                data={filteredClients}
                keyExtractor={(item) => item._id}
                renderItem={renderClientCard}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#22c55e" />
                }
                ListEmptyComponent={renderEmpty}
                style={{ overflow: 'visible', zIndex: 1 }} // Help with tooltips
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
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#64748b',
    },

    // Plans Banner
    plansBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 12,
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#3b82f6',
        ...Platform.select({
            ios: { shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
            android: { elevation: 4 },
        }),
    },
    plansBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    plansBannerIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    plansBannerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
    plansBannerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },

    // Search and Sort Bar
    searchSortBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    listTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    sortWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
    },
    sortLabel: {
        fontSize: 12,
        color: '#94a3b8',
    },
    sortDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    sortDropdownText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    sortMenu: {
        position: 'absolute',
        top: 36,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingVertical: 6,
        minWidth: 160,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
            android: { elevation: 8 },
            web: { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
        }),
        zIndex: 100,
    },
    sortMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    sortMenuItemActive: {
        backgroundColor: '#eff6ff',
    },
    sortMenuItemText: {
        fontSize: 13,
        color: '#475569',
    },
    sortMenuItemTextActive: {
        color: '#3b82f6',
        fontWeight: '600',
    },

    // Search Bar
    searchBar: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        gap: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flex: 1,
    },
    filterTagBtn: {
        height: 44,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterTagText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1e293b',
    },
    cmdK: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    cmdKText: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
    },

    list: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 24,
        overflow: 'visible',
    },
    emptyList: {
        flex: 1,
    },

    // Client Card - Smart Design (Redesigned 2-Column)
    clientCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        gap: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
            android: { elevation: 2 },
            web: { overflow: 'visible', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
        }),
    },

    // COL 1: Left (Identity)
    cardColLeft: {
        width: 85,
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: '#f1f5f9',
        paddingRight: 10,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 8,
    },
    aiStatusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#fff',
    },
    clientName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 6,
        lineHeight: 16,
    },
    phaseBadgePill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 100,
        marginBottom: 6,
    },
    phaseBadgePillText: {
        fontSize: 9,
        fontWeight: '700',
    },
    lastCheckInText: {
        fontSize: 9,
        color: '#94a3b8',
        textAlign: 'center',
    },

    // COL 2: Right (Metrics & Actions)
    cardColRight: {
        flex: 1,
        justifyContent: 'space-between',
    },
    colRightHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 10,
    },
    tcaSwitchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingLeft: 10,
        paddingRight: 4,
        paddingVertical: 2,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignSelf: 'flex-start',
        marginLeft: 'auto', // Push to right
    },
    tcaLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
        marginRight: 4,
    },
    tcaLabelActive: {
        color: '#f59e0b',
    },
    tcaTooltip: {
        position: 'absolute',
        bottom: '100%',
        right: 0,
        marginBottom: 8,
        backgroundColor: '#1e293b',
        padding: 8,
        borderRadius: 8,
        width: 150,
        zIndex: 999,
        // Shadow for web
        ...Platform.select({
            web: { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }
        })
    },
    tcaTooltipText: {
        fontSize: 10,
        color: '#fff',
        textAlign: 'center',
        lineHeight: 14,
    },
    tcaTooltipArrow: {
        position: 'absolute',
        bottom: -4,
        right: 12,
        width: 0,
        height: 0,
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderTopWidth: 5,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#1e293b',
    },

    // Metrics Grid
    metricsGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    metricBox: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metricBoxAdherence: {
        width: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metaLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94a3b8',
        marginBottom: 2,
        letterSpacing: 0.5,
    },
    metaValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#334155',
    },
    metaUnit: {
        fontSize: 10,
        fontWeight: '500',
        color: '#94a3b8',
    },

    // Actions Footer
    actionsFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    planInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    planNameText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
    },
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    miniActionBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
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
