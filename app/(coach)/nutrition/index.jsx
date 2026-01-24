import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    TextInput,
    Platform,
    Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';
import { calculateFullNutrition } from '../../../src/utils/nutritionCalculator';

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

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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
                console.log('[NutritionClients] Current nutrition endpoint not available yet');
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

        // If client has an active plan
        // DEBUG: Check plan for this client
        if (plan) {
            console.log(`[NutritionDebug] Client ${client.nombre} has plan:`, {
                type: plan.planType,
                status: plan.status,
                macros: plan.fixedMacros,
                auto: plan.autoConfig
            });
        }

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
        console.log(`[NutritionDebug] Fallback for ${client.nombre} - No active plan matched switch`);
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

    // Filter and sort clients
    const filteredClients = useMemo(() => {
        let result = [...clients];

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(c => c.nombre?.toLowerCase().includes(q));
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

        // Weight trend arrow and color
        let trendIcon = null;
        let trendColor = '#64748b';
        let trendText = '';
        if (stats.weightTrend !== 0 && stats.currentWeight) {
            if (stats.weightTrend < 0) {
                trendIcon = 'arrow-down';
                trendColor = phaseBadge.label === 'Volumen' ? '#ef4444' : '#10b981';
                trendText = `${stats.weightTrend.toFixed(1)}`;
            } else if (stats.weightTrend > 0) {
                trendIcon = 'arrow-up';
                trendColor = phaseBadge.label === 'Volumen' ? '#10b981' : '#ef4444';
                trendText = `+${stats.weightTrend.toFixed(1)}`;
            }
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
                {/* Row 1: Avatar + Name + Phase Badge + AI Dot */}
                <View style={styles.cardRow1}>
                    {/* Avatar with status border and hover tooltip */}
                    <Pressable
                        style={[styles.avatarWrapper]}
                        onHoverIn={() => Platform.OS === 'web' && setHoveredClientId(item._id)}
                        onHoverOut={() => Platform.OS === 'web' && setHoveredClientId(null)}
                    >
                        <View style={[
                            styles.avatarBorder,
                            { borderColor: stats.adherenceScore >= 75 ? '#10b981' : stats.adherenceScore >= 50 ? '#f59e0b' : '#ef4444' }
                        ]}>
                            <AvatarWithInitials
                                avatarUrl={item.avatarUrl || item.profilePic}
                                name={item.nombre}
                                size={56}
                            />
                        </View>

                        {/* Hover Tooltip (Web only) */}
                        {Platform.OS === 'web' && hoveredClientId === item._id && (
                            <View style={styles.avatarTooltip}>
                                <View style={styles.tooltipArrow} />
                                <Text style={styles.tooltipTitle}>{item.nombre}</Text>

                                {/* AI Health Status */}
                                <View style={styles.tooltipRow}>
                                    <View style={[styles.tooltipDot, { backgroundColor: aiHealth.color }]} />
                                    <Text style={styles.tooltipLabel}>Estado IA:</Text>
                                    <Text style={styles.tooltipValueHighlight}>{aiHealth.label}</Text>
                                </View>
                                <Text style={styles.tooltipHint}>{aiHealth.tooltip}</Text>

                                <View style={styles.tooltipDivider} />

                                {/* Adherence */}
                                <View style={styles.tooltipRow}>
                                    <Ionicons name="checkmark-circle" size={12} color="#fff" />
                                    <Text style={styles.tooltipLabel}>Adherencia:</Text>
                                    <Text style={styles.tooltipValue}>{stats.adherenceScore ?? '--'}%</Text>
                                </View>

                                {/* Weight Trend */}
                                <View style={styles.tooltipRow}>
                                    <Ionicons name="trending-up" size={12} color="#fff" />
                                    <Text style={styles.tooltipLabel}>Tendencia peso:</Text>
                                    <Text style={styles.tooltipValue}>
                                        {stats.weightTrend !== 0 ? `${stats.weightTrend > 0 ? '+' : ''}${stats.weightTrend.toFixed(1)} kg` : 'Estable'}
                                    </Text>
                                </View>

                                {/* Days Active */}
                                <View style={styles.tooltipRow}>
                                    <Ionicons name="calendar" size={12} color="#fff" />
                                    <Text style={styles.tooltipLabel}>Última actividad:</Text>
                                    <Text style={styles.tooltipValue}>{stats.lastCheckIn}</Text>
                                </View>

                                {/* Calories */}
                                <View style={styles.tooltipRow}>
                                    <Ionicons name="flame" size={12} color="#fff" />
                                    <Text style={styles.tooltipLabel}>Calorías:</Text>
                                    <Text style={styles.tooltipValue}>
                                        {typeof nutritionSummary.kcal === 'number' ? `${nutritionSummary.kcal.toLocaleString()} kcal` : '--'}
                                    </Text>
                                </View>

                                <View style={styles.tooltipFooter}>
                                    <Text style={styles.tooltipFooterText}>Haz clic para ver detalles</Text>
                                </View>
                            </View>
                        )}
                    </Pressable>

                    <View style={styles.nameSection}>
                        <View style={styles.nameRow}>
                            <Text style={styles.clientName}>{item.nombre}</Text>
                            {/* AI Health Dot */}
                            <View style={[styles.aiDot, { backgroundColor: aiHealth.color }]} />
                        </View>
                        <Text style={styles.lastCheckIn}>
                            <Ionicons name="time-outline" size={11} color="#94a3b8" /> Último check-in: {stats.lastCheckIn}
                        </Text>
                    </View>

                    {/* Phase Badge */}
                    <View style={[styles.phaseBadge, { backgroundColor: phaseBadge.bgColor }]}>
                        <Ionicons name={phaseBadge.icon} size={12} color={phaseBadge.color} />
                        <Text style={[styles.phaseBadgeText, { color: phaseBadge.color }]}>{phaseBadge.label}</Text>
                    </View>
                </View>

                {/* Row 2: Metrics Grid */}
                <View style={styles.metricsRow}>
                    {/* Weight */}
                    <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>PESO</Text>
                        <View style={styles.metricValueRow}>
                            <Text style={styles.metricValue}>
                                {stats.currentWeight || info.peso || '--'}
                                <Text style={styles.metricUnit}> kg</Text>
                            </Text>
                            {trendIcon && (
                                <View style={[styles.trendBadge, { backgroundColor: `${trendColor}20` }]}>
                                    <Ionicons name={trendIcon} size={10} color={trendColor} />
                                    <Text style={[styles.trendText, { color: trendColor }]}>{trendText}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Calories + Plan Type */}
                    <View style={styles.metricItem}>
                        <View style={styles.metricLabelRow}>
                            <Text style={styles.metricLabel}>CALORÍAS</Text>
                            {nutritionSummary.planType && (
                                <View style={[
                                    styles.planTypeBadge,
                                    nutritionSummary.planType === 'auto' && styles.planTypeBadgeAuto,
                                    nutritionSummary.planType === 'flex' && styles.planTypeBadgeFlex,
                                    nutritionSummary.planType === 'complete' && styles.planTypeBadgeComplete,
                                ]}>
                                    <Text style={styles.planTypeBadgeText}>
                                        {nutritionSummary.planType === 'auto' ? '🤖' :
                                            nutritionSummary.planType === 'flex' ? '🔀' : '📋'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.metricValue, nutritionSummary.hasCoachPlan && styles.customValue]}>
                            {typeof nutritionSummary.kcal === 'number'
                                ? nutritionSummary.kcal.toLocaleString()
                                : nutritionSummary.kcal}
                            <Text style={styles.metricUnit}> kcal</Text>
                        </Text>
                    </View>

                    {/* Adherence Ring */}
                    <View style={styles.adherenceItem}>
                        <Text style={styles.metricLabel}>ADHERENCIA</Text>
                        <AdherenceRing percentage={stats.adherenceScore} size={44} />
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.actionBtn} onPress={(e) => {
                            e.stopPropagation();
                            router.push({
                                pathname: '/(coach)/nutrition/[clientId]',
                                params: { clientId: item._id, clientName: item.nombre }
                            });
                        }}>
                            <Ionicons name="document-text-outline" size={18} color="#64748b" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={(e) => {
                            e.stopPropagation();
                            router.push({
                                pathname: '/(coach)/seguimiento_coach/[clientId]',
                                params: { clientId: item._id, clientName: item.nombre }
                            });
                        }}>
                            <Ionicons name="stats-chart-outline" size={18} color="#64748b" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={(e) => {
                            e.stopPropagation();
                            // Chat action
                        }}>
                            <Ionicons name="chatbubble-outline" size={18} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Row 3: Bottom info */}
                <View style={styles.bottomRow}>
                    {/* Goal text */}
                    <View style={styles.goalInfo}>
                        <Ionicons name="fitness" size={12} color="#64748b" />
                        <Text style={styles.goalText}>{info.objetivos || 'Sin objetivo'}</Text>
                    </View>

                    {/* Height */}
                    <View style={styles.heightInfo}>
                        <Ionicons name="resize-outline" size={12} color="#64748b" />
                        <Text style={styles.heightText}>
                            {info.altura ? (info.altura < 3 ? `${Math.round(info.altura * 100)} cm` : `${info.altura} cm`) : '-- cm'}
                        </Text>
                    </View>

                    {/* Plan mode badge */}
                    <View style={[
                        styles.modeBadge,
                        {
                            backgroundColor: nutritionSummary.planType === 'complete' ? '#8b5cf620' :
                                nutritionSummary.planType === 'flex' ? '#f59e0b20' :
                                    nutritionSummary.planType === 'auto' ? '#10b98120' : '#64748b15'
                        }
                    ]}>
                        <Ionicons
                            name={
                                nutritionSummary.planType === 'complete' ? 'clipboard' :
                                    nutritionSummary.planType === 'flex' ? 'shuffle' :
                                        nutritionSummary.planType === 'auto' ? 'calculator' : 'help-circle-outline'
                            }
                            size={10}
                            color={
                                nutritionSummary.planType === 'complete' ? '#8b5cf6' :
                                    nutritionSummary.planType === 'flex' ? '#f59e0b' :
                                        nutritionSummary.planType === 'auto' ? '#10b981' : '#64748b'
                            }
                        />
                        <Text style={[
                            styles.modeText,
                            {
                                color: nutritionSummary.planType === 'complete' ? '#8b5cf6' :
                                    nutritionSummary.planType === 'flex' ? '#f59e0b' :
                                        nutritionSummary.planType === 'auto' ? '#10b981' : '#64748b'
                            }
                        ]}>
                            {nutritionSummary.planType === 'complete' ? 'Completo' :
                                nutritionSummary.planType === 'flex' ? 'Flex' :
                                    nutritionSummary.planType === 'auto' ? 'Auto' : 'Sin Plan'}
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
                                <Ionicons name="pulse-outline" size={14} color={sortBy === 'aiHealth' ? '#3b82f6' : '#64748b'} />
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

            {/* Search Input */}
            <View style={styles.searchBar}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={16} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar cliente por nombre o etiqueta..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                    <View style={styles.cmdK}>
                        <Text style={styles.cmdKText}>⌘K</Text>
                    </View>
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
                        colors={['#22c55e']}
                    />
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
        paddingBottom: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 40,
        gap: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
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

    // Client Card - Smart Design
    clientCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'visible',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
            android: { elevation: 1 },
            web: { overflow: 'visible' },
        }),
    },

    // Row 1: Avatar + Name + Phase
    cardRow1: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        overflow: 'visible',
        zIndex: 100,
    },
    avatarBorder: {
        borderWidth: 3,
        borderRadius: 32,
        padding: 2,
    },
    nameSection: {
        flex: 1,
        marginLeft: 10,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    clientName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    aiDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    lastCheckIn: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    phaseBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    phaseBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },

    // Row 2: Metrics
    metricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    metricItem: {
        flex: 1,
        alignItems: 'center',
    },
    metricLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94a3b8',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    metricLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    metricValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metricValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    metricUnit: {
        fontSize: 12,
        fontWeight: '400',
        color: '#64748b',
    },
    customValue: {
        color: '#8b5cf6',
    },
    // Plan Type Badges
    planTypeBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    planTypeBadgeAuto: {
        backgroundColor: '#ede9fe',
    },
    planTypeBadgeFlex: {
        backgroundColor: '#dbeafe',
    },
    planTypeBadgeComplete: {
        backgroundColor: '#d1fae5',
    },
    planTypeBadgeText: {
        fontSize: 10,
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 2,
    },
    trendText: {
        fontSize: 10,
        fontWeight: '600',
    },
    adherenceItem: {
        alignItems: 'center',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 4,
        marginLeft: 8,
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Row 3: Bottom info
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        gap: 12,
    },
    goalInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    goalText: {
        fontSize: 11,
        color: '#64748b',
    },
    heightInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    heightText: {
        fontSize: 11,
        color: '#64748b',
    },
    modeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
        marginLeft: 'auto',
    },
    modeText: {
        fontSize: 10,
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

    // Avatar Wrapper for tooltip
    avatarWrapper: {
        position: 'relative',
        zIndex: 9999,
        overflow: 'visible',
    },

    // Hover Tooltip Styles (Web only)
    avatarTooltip: {
        position: 'absolute',
        left: '100%',
        top: '50%',
        transform: [{ translateY: -80 }],
        marginLeft: 12,
        width: 220,
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        padding: 14,
        zIndex: 99999,
        ...Platform.select({
            web: {
                boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)',
            },
        }),
    },
    tooltipArrow: {
        position: 'absolute',
        left: -6,
        top: 30,
        width: 12,
        height: 12,
        backgroundColor: '#3b82f6',
        transform: [{ rotate: '45deg' }],
    },
    tooltipTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 10,
    },
    tooltipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    tooltipDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    tooltipLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.8)',
    },
    tooltipValue: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
        marginLeft: 'auto',
    },
    tooltipValueHighlight: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fef08a',
        marginLeft: 'auto',
    },
    tooltipHint: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        fontStyle: 'italic',
        marginBottom: 8,
        marginLeft: 14,
    },
    tooltipDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginVertical: 8,
    },
    tooltipFooter: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.2)',
    },
    tooltipFooterText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
    },
});
