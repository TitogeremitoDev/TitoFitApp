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
// TDEE & GOAL HELPER
// ═══════════════════════════════════════════════════════════════════════════
const calculateTDEE = (info, af = 1.55) => {
    if (!info?.peso || !info?.altura || !info?.edad) return 2000;
    let bmr;
    if (info.genero === 'masculino' || info.genero === 'male') {
        bmr = 10 * info.peso + 6.25 * info.altura - 5 * info.edad + 5;
    } else {
        bmr = 10 * info.peso + 6.25 * info.altura - 5 * info.edad - 161;
    }
    return Math.round(bmr * af);
};

const getGoalContext = (targetKcal, tdee) => {
    if (!targetKcal || typeof targetKcal !== 'number') return { label: 'Mantenimiento', color: '#10b981', bg: '#ecfdf5' };

    const diff = targetKcal - tdee;
    if (diff < -100) return { label: `Déficit (${diff})`, value: `${diff} kcal`, color: '#f59e0b', bg: '#fffbeb' };
    if (diff > 100) return { label: `Superávit (+${diff})`, value: `+${diff} kcal`, color: '#3b82f6', bg: '#eff6ff' };
    return { label: 'Mantenimiento', value: 'Normocalórico', color: '#10b981', bg: '#ecfdf5' };
};

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
                    const hasMeals = plan.mealStructure?.length > 0 || plan.dayTemplates?.some(dt => dt.meals?.length > 0);
                    const effectivePlanType = hasMeals ? 'complete' : 'flex';

                    return {
                        mode: effectivePlanType,
                        planType: effectivePlanType,
                        kcal: firstTemplate?.targetMacros?.kcal || '---',
                        protein: firstTemplate?.targetMacros?.protein || 0,
                        carbs: firstTemplate?.targetMacros?.carbs || 0,
                        fats: firstTemplate?.targetMacros?.fats || 0,
                        hasCoachPlan: true,
                        planName: plan.name,
                    };
                case 'flex':
                    return {
                        mode: 'flex',
                        planType: 'flex',
                        kcal: plan.fixedMacros?.kcal || '---',
                        protein: plan.fixedMacros?.protein || 0,
                        carbs: plan.fixedMacros?.carbs || 0,
                        fats: plan.fixedMacros?.fats || 0,
                        hasCoachPlan: true,
                        planName: plan.name,
                    };
                case 'auto':
                    // Calculate dynamically using autoConfig
                    if (plan.autoConfig) {
                        if (info.peso && info.altura && info.edad) {
                            const { activityFactor, adjustmentPercentage, proteinPerKg } = plan.autoConfig;
                            const tdee = calculateTDEE(info, activityFactor);
                            const kcal = Math.round(tdee * (1 + (adjustmentPercentage || 0) / 100));
                            const protein = Math.round(info.peso * (proteinPerKg || 2));
                            // Estimate remaining macros (simplified)
                            const remainingKcal = kcal - (protein * 4);
                            const fats = Math.round((remainingKcal * 0.25) / 9);
                            const carbs = Math.round((remainingKcal * 0.75) / 4);

                            return {
                                mode: 'auto',
                                planType: 'auto',
                                kcal,
                                protein,
                                carbs,
                                fats,
                                hasCoachPlan: true,
                                planName: plan.name,
                            };
                        } else {
                            // Plan exists but data missing to calculate
                            return {
                                mode: 'auto',
                                planType: 'auto',
                                kcal: '---',
                                protein: 0,
                                carbs: 0,
                                fats: 0,
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
                    protein: nutrition.training.protein,
                    carbs: nutrition.training.carbs,
                    fats: nutrition.training.fats,
                    hasCoachPlan: false,
                };
            }
        }

        return { mode: 'none', planType: null, kcal: 2000, protein: 150, hasCoachPlan: false };
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

        // Nutrition specific current/latest (Mock/Implied if not available)
        const currentKcal = metrics.nutrition?.todayKcal ?? (adherenceScore ? Math.round(2000 * (adherenceScore / 100)) : 0);
        const currentProtein = metrics.nutrition?.todayProtein ?? (adherenceScore ? Math.round(150 * (adherenceScore / 100)) : 0);

        return { adherenceScore, weightTrend, currentWeight, daysInactive, lastCheckIn, currentKcal, currentProtein };
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

    // Helper for Goal Badge (Visual map)
    const getPhaseBadge = (goal) => {
        const map = {
            'perder_peso': { label: 'Definición', color: '#ec4899', bgColor: '#fce7f3' }, // Pink
            'ganar_masa': { label: 'Volumen', color: '#8b5cf6', bgColor: '#ede9fe' }, // Purple
            'mantenimiento': { label: 'Mantenimiento', color: '#f59e0b', bgColor: '#fef3c7' }, // Amber
            'recomposicion': { label: 'Recomp.', color: '#3b82f6', bgColor: '#eff6ff' }, // Blue
        };
        return map[goal] || { label: 'General', color: '#64748b', bgColor: '#f1f5f9' };
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER CLIENT CARD - HORIZONTAL TARGETS DESIGN (User Request)
    // ═══════════════════════════════════════════════════════════════════════════
    const renderClientCard = ({ item }) => {
        const info = item.info_user || {};
        const nutritionSummary = getClientNutritionSummary(item);

        // Contexts
        const tdee = calculateTDEE(info, item.af);
        const goalContext = getGoalContext(nutritionSummary.kcal, tdee);
        const phaseBadge = getPhaseBadge(info.objetivos);
        const isSensitive = isSensitiveClient(item);

        return (
            <TouchableOpacity
                style={styles.clientCardHorizontal}
                onPress={() => router.push({
                    pathname: '/(coach)/nutrition/[clientId]',
                    params: { clientId: item._id, clientName: item.nombre }
                })}
                activeOpacity={0.7}
            >
                {/* ─── LEFT: PROFILE ───────────────────────────────────────── */}
                <View style={styles.cardLeftSection}>
                    <AvatarWithInitials
                        avatarUrl={item.avatarUrl || item.profilePic}
                        name={item.nombre}
                        size={48}
                    />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.clientNameH} numberOfLines={1}>{item.nombre}</Text>
                            <View style={[styles.phaseBadgeH, { backgroundColor: phaseBadge.bgColor }]}>
                                <Text style={[styles.phaseBadgeTextH, { color: phaseBadge.color }]}>{phaseBadge.label}</Text>
                            </View>
                        </View>
                        <Text style={styles.clientSubtextH}>
                            AF {item.af || 1.55} • {info.peso || '--'}kg {nutritionSummary.planName ? `• ${nutritionSummary.planName}` : ''}
                        </Text>
                    </View>
                </View>

                {/* ─── VERTICAL DIVIDER ──────────────────────────────────── */}
                <View style={styles.cardDividerV} />

                {/* ─── RIGHT: TARGETS & MACROS ───────────────────────────── */}
                <View style={styles.cardRightSection}>
                    {nutritionSummary.hasCoachPlan || !nutritionSummary.warning ? (
                        <View style={{ alignItems: 'flex-end' }}>
                            {/* Target Calories */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                <Ionicons name="disc-outline" size={18} color="#ef4444" style={{ marginRight: 4 }} />
                                <Text style={styles.targetKcalText}>
                                    {typeof nutritionSummary.kcal === 'number' ? nutritionSummary.kcal.toLocaleString() : nutritionSummary.kcal}
                                    <Text style={{ fontSize: 14, fontWeight: '400', color: '#64748b' }}> kcal</Text>
                                </Text>
                            </View>

                            {/* Macros Row */}
                            <View style={styles.macrosRowH}>
                                <Text style={styles.macroTextH}>
                                    <Text style={{ color: '#ef4444', fontWeight: '700' }}>P: </Text>
                                    {nutritionSummary.protein || 0}g
                                </Text>
                                <Text style={styles.macroDot}>•</Text>
                                <Text style={styles.macroTextH}>
                                    <Text style={{ color: '#3b82f6', fontWeight: '700' }}>C: </Text>
                                    {nutritionSummary.carbs || 0}g
                                </Text>
                                <Text style={styles.macroDot}>•</Text>
                                <Text style={styles.macroTextH}>
                                    <Text style={{ color: '#eab308', fontWeight: '700' }}>G: </Text>
                                    {nutritionSummary.fats || 0}g
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>Sin objetivos definidos</Text>
                            <TouchableOpacity style={{ marginTop: 4 }} onPress={(e) => {
                                e.stopPropagation();
                                router.push({ pathname: '/(coach)/nutrition/templates', params: { assignTo: item._id } });
                            }}>
                                <Text style={{ color: '#4f46e5', fontSize: 13, fontWeight: '600' }}>+ Asignar</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ─── TCA CHECKBOX ────────────────────────────────────────── */}
                <TouchableOpacity
                    onPress={(e) => {
                        e.stopPropagation();
                        handleToggleSensitive(item);
                    }}
                    style={styles.tcaCheckbox}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.6}
                >
                    <View style={[
                        styles.tcaCheckboxBox,
                        isSensitive && styles.tcaCheckboxBoxActive,
                    ]}>
                        {isSensitive && (
                            <Ionicons name="shield-checkmark" size={14} color="#fff" />
                        )}
                    </View>
                    <Text style={[
                        styles.tcaCheckboxLabel,
                        isSensitive && styles.tcaCheckboxLabelActive,
                    ]}>TCA</Text>
                </TouchableOpacity>
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

            {/* Combos Banner */}
            <TouchableOpacity
                style={[styles.plansBanner, { backgroundColor: '#d97706', marginTop: 0 }]}
                onPress={() => router.push('/(coach)/food-library?tab=combos')}
            >
                <View style={styles.plansBannerContent}>
                    <View style={[styles.plansBannerIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <Ionicons name="layers" size={22} color="#fff" />
                    </View>
                    <View>
                        <Text style={styles.plansBannerTitle}>Combos de Comida</Text>
                        <Text style={styles.plansBannerSubtitle}>Opciones guardadas para insertar rápidamente</Text>
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
                style={{ flex: 1 }}
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
        paddingBottom: 100,
    },
    emptyList: {
        flex: 1,
    },

    // ════ NEW NUTRITION CARD STYLES ════
    clientCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
            android: { elevation: 2 },
            web: { overflow: 'visible', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
        }),
    },

    // COL 1: Identity
    cardColLeft: {
        alignItems: 'center',
        width: 80,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 8,
    },
    statusDot: {
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
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 6,
    },
    goalChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#ecfdf5',
    },
    goalChipText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#10b981',
        textAlign: 'center',
    },

    // COL 2: Center Metrics
    cardColCenter: {
        flex: 1,
        justifyContent: 'space-between',
        gap: 12,
        borderLeftWidth: 1,
        borderLeftColor: '#f1f5f9',
        paddingLeft: 16,
    },
    metricRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    metricLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94a3b8',
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // Weight
    weightValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    bigValueText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    unitText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748b',
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 2,
    },
    trendText: {
        fontSize: 11,
        fontWeight: '700',
    },

    // Bar
    barLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    barValueText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748b',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    adherenceMiniBadge: {
        marginLeft: 10,
        alignItems: 'flex-end',
    },
    adherenceMiniText: {
        fontSize: 14,
        fontWeight: '800',
    },
    adherenceLabel: {
        fontSize: 9,
        color: '#94a3b8',
    },

    // Protein Pill
    proteinPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 6,
    },
    semaphoreDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    proteinText: {
        fontSize: 11,
        color: '#3b82f6',
        fontWeight: '500',
    },

    // COL 3: Actions
    cardColRight: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 8,
    },
    // ════ CLIENT CARD - HORIZONTAL TARGETS ════
    clientCardHorizontal: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12, // Reduced padding for compactness
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4 },
            android: { elevation: 2 },
            web: { overflow: 'visible', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' },
        }),
    },

    // Left Section (Profile)
    cardLeftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1.2, // Give slightly more space to name if long
    },
    clientNameH: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
        maxWidth: 120,
    },
    phaseBadgeH: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    phaseBadgeTextH: {
        fontSize: 9,
        fontWeight: '700',
    },
    clientSubtextH: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },

    // Vertical Divider
    cardDividerV: {
        width: 1,
        height: '80%',
        backgroundColor: '#e2e8f0',
        marginHorizontal: 12,
    },

    // Right Section (Targets)
    cardRightSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    targetKcalText: {
        fontSize: 20,
        fontWeight: '800',
        color: '#ef4444',
    },
    macrosRowH: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    macroTextH: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '500',
    },
    macroDot: {
        fontSize: 10,
        color: '#cbd5e1',
        marginHorizontal: 6,
    },

    // TCA Checkbox
    tcaCheckbox: {
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 10,
        gap: 3,
    },
    tcaCheckboxBox: {
        width: 24,
        height: 24,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#d1d5db',
        backgroundColor: '#f9fafb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tcaCheckboxBoxActive: {
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
    },
    tcaCheckboxLabel: {
        fontSize: 8,
        fontWeight: '700',
        color: '#b0b7c3',
        letterSpacing: 0.5,
    },
    tcaCheckboxLabelActive: {
        color: '#f59e0b',
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
