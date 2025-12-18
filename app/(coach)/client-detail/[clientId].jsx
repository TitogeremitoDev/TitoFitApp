/* app/(coach)/client-detail/[clientId].jsx
   ═══════════════════════════════════════════════════════════════════════════
   PÁGINA DE DETALLE COMPLETO DEL CLIENTE
   - Secciones expandibles: Entrenamiento, Evolución, Dieta
   - Placeholders: Pagos, Mensajes (En Construcción)
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Pressable,
    Dimensions,
    LayoutAnimation,
    Platform,
    UIManager,
    Modal,
    FlatList,
    TextInput,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useAuth } from '../../../context/AuthContext';
import { calculateFullNutrition } from '../../../src/utils/nutritionCalculator';
import {
    calcVolumeByWeek,
    calcIntensityByWeek,
    calcPlanComplianceByWeek,
    calcHeavySetsByWeek,
    filterByPeriod,
} from '../../../src/utils/calculateKPIs';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const screenWidth = Dimensions.get('window').width;

// ═══════════════════════════════════════════════════════════════════════════
// CHART CONFIG
// ═══════════════════════════════════════════════════════════════════════════
const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#f8fafc',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
    propsForDots: { r: '4', strokeWidth: '2', stroke: '#3b82f6' },
    fillShadowGradient: '#3b82f6',
    fillShadowGradientOpacity: 0.3,
    propsForBackgroundLines: {
        strokeDasharray: '',
        stroke: '#e2e8f0',
        strokeWidth: 1,
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS RING COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const ProgressRing = ({ percentage, color, size = 60 }) => {
    const strokeWidth = 6;
    const normalizedPercentage = Math.min(100, Math.max(0, percentage));

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
                position: 'absolute',
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: '#e2e8f0',
            }} />
            <View style={{
                width: size - strokeWidth * 2,
                height: size - strokeWidth * 2,
                borderRadius: (size - strokeWidth * 2) / 2,
                backgroundColor: `${color}20`,
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color }}>
                    {Math.round(normalizedPercentage)}%
                </Text>
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPANDABLE SECTION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const ExpandableSection = ({
    title,
    emoji,
    color,
    isExpanded,
    onToggle,
    children,
    disabled = false,
    buildingInProgress = false
}) => (
    <View style={[styles.sectionCard, disabled && styles.sectionCardDisabled]}>
        <TouchableOpacity
            style={styles.sectionHeader}
            onPress={onToggle}
            disabled={disabled}
            activeOpacity={0.7}
        >
            <View style={[styles.sectionIconBox, { backgroundColor: color + '20' }]}>
                <Text style={styles.sectionEmoji}>{emoji}</Text>
            </View>
            <Text style={[styles.sectionTitle, disabled && styles.sectionTitleDisabled]}>{title}</Text>
            {buildingInProgress && (
                <View style={styles.buildingBadge}>
                    <Text style={styles.buildingText}>🚧 En construcción</Text>
                </View>
            )}
            {!disabled && (
                <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color="#64748b"
                />
            )}
        </TouchableOpacity>
        {isExpanded && !disabled && (
            <View style={styles.sectionContent}>
                {children}
            </View>
        )}
    </View>
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function ClientDetailScreen() {
    const router = useRouter();
    const { clientId, clientName } = useLocalSearchParams();
    const { token } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [clientInfo, setClientInfo] = useState(null);

    // Training data
    const [sessions, setSessions] = useState([]);
    const [trainingKpi, setTrainingKpi] = useState('volume');

    // Evolution data
    const [dailyRecords, setDailyRecords] = useState([]);
    const [weeklyRecords, setWeeklyRecords] = useState([]);
    const [nutritionTargets, setNutritionTargets] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

    // Diet data
    const [nutritionPlan, setNutritionPlan] = useState(null);

    // Expanded sections
    const [expandedSections, setExpandedSections] = useState({
        training: true,
        evolution: false,
        diet: false,
        payments: false,
        messages: false,
    });

    // Modal de feedbacks no leídos
    const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);

    // Modal de generar feedback
    const [sendFeedbackModalVisible, setSendFeedbackModalVisible] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [feedbackType, setFeedbackType] = useState('general');
    const [sendingFeedback, setSendingFeedback] = useState(false);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    // Enviar feedback al cliente
    const handleSendFeedback = async () => {
        if (!feedbackMessage.trim()) return;

        try {
            setSendingFeedback(true);
            const response = await fetch(`${API_URL}/api/feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    clientId,
                    message: feedbackMessage.trim(),
                    type: feedbackType,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setSendFeedbackModalVisible(false);
                setFeedbackMessage('');
                setFeedbackType('general');
                // TODO: Mostrar toast de éxito
            }
        } catch (error) {
            console.error('[SendFeedback] Error:', error);
        } finally {
            setSendingFeedback(false);
        }
    };
    const chartWidth = Math.min(screenWidth - 64, 500);

    const toggleSection = (section) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // FETCH DATA
    // ═══════════════════════════════════════════════════════════════════════════
    const fetchAllData = useCallback(async () => {
        try {
            setIsLoading(true);

            // 1. Client Info
            const clientRes = await fetch(`${API_URL}/api/users/${clientId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const clientData = await clientRes.json();
            if (clientData.success && clientData.user) {
                setClientInfo(clientData.user);

                // Calculate nutrition targets
                const info = clientData.user.info_user;
                if (info) {
                    const nutrition = calculateFullNutrition(
                        info,
                        info.objetivoPrincipal || 'volumen',
                        info.af || 1.55
                    );
                    if (nutrition) {
                        setNutritionTargets({
                            kcal: nutrition.training.kcal,
                            protein: nutrition.training.protein,
                            carbs: nutrition.training.carbs,
                            fat: nutrition.training.fat,
                        });
                    }
                }
            }

            // 2. Training sessions
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            const workoutsRes = await fetch(
                `${API_URL}/api/workouts/by-user/${clientId}?limit=200&startDate=${threeMonthsAgo.toISOString()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const workoutsData = await workoutsRes.json();
            if (workoutsData.success) {
                setSessions(workoutsData.workouts || []);
            }

            // 3. Monitoring history (evolution)
            const historyRes = await fetch(`${API_URL}/api/monitoring/coach/client/${clientId}/history`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const historyData = await historyRes.json();
            if (historyData.success) {
                setDailyRecords(historyData.daily || []);
                setWeeklyRecords(historyData.weekly || []);
            }

            // 4. Nutrition plan
            const nutritionRes = await fetch(`${API_URL}/api/nutrition/${clientId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const nutritionData = await nutritionRes.json();
            if (nutritionData.success) {
                setNutritionPlan(nutritionData.plan);
            }

        } catch (error) {
            console.error('[ClientDetail] Error:', error);
        } finally {
            setIsLoading(false);
        }
    }, [clientId, token, API_URL]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // ═══════════════════════════════════════════════════════════════════════════
    // KPI CALCULATIONS - TRAINING
    // ═══════════════════════════════════════════════════════════════════════════
    const filteredSessions = useMemo(() => filterByPeriod(sessions, '90d'), [sessions]);

    const volumeData = useMemo(() => {
        const data = calcVolumeByWeek(filteredSessions, 'TOTAL', '');
        if (data.length === 0) return null;
        return {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.value), strokeWidth: 3 }],
            rawData: data,
        };
    }, [filteredSessions]);

    const intensityData = useMemo(() => {
        const data = calcIntensityByWeek(filteredSessions, 'TOTAL', '');
        if (data.length === 0) return null;
        return {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.value), strokeWidth: 3 }],
        };
    }, [filteredSessions]);

    const complianceData = useMemo(() => {
        const data = calcPlanComplianceByWeek(filteredSessions);
        if (data.length === 0) return null;
        const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length;
        return {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.value), strokeWidth: 3 }],
            avgValue: avgValue.toFixed(0),
        };
    }, [filteredSessions]);

    const heavySetsData = useMemo(() => {
        const data = calcHeavySetsByWeek(filteredSessions, 'TOTAL', '');
        if (data.length === 0) return null;
        return {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.value) }],
        };
    }, [filteredSessions]);

    const getTrainingChartData = () => {
        switch (trainingKpi) {
            case 'intensity': return intensityData;
            case 'compliance': return complianceData;
            case 'heavySets': return heavySetsData;
            default: return volumeData;
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // EVOLUTION CALCULATIONS
    // ═══════════════════════════════════════════════════════════════════════════
    const sortedDailyData = useMemo(() => {
        return [...dailyRecords].sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [dailyRecords]);

    const targetWeight = useMemo(() => clientInfo?.info_user?.pesoObjetivo || null, [clientInfo]);
    const currentWeight = useMemo(() => {
        const entries = sortedDailyData.filter(d => d.peso && d.peso > 0);
        return entries.length > 0 ? entries[entries.length - 1].peso : null;
    }, [sortedDailyData]);

    const weightChartData = useMemo(() => {
        const entries = sortedDailyData.filter(d => d.peso && d.peso > 0);
        if (entries.length < 1) return null;

        const labels = entries.map(d => {
            const date = new Date(d.date);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        });

        return {
            labels: labels.length > 7 ? labels.filter((_, i) => i % Math.ceil(labels.length / 7) === 0) : labels,
            datasets: [{ data: entries.map(d => d.peso), strokeWidth: 3 }],
        };
    }, [sortedDailyData]);

    const macroCompliance = useMemo(() => {
        const entries = sortedDailyData.filter(d => d.kcalConsumed && d.kcalConsumed > 0);
        if (entries.length === 0 || nutritionTargets.kcal === 0) return null;

        const avgKcal = entries.reduce((acc, d) => acc + (d.kcalConsumed || 0), 0) / entries.length;
        const avgProtein = entries.reduce((acc, d) => acc + (d.proteinConsumed || 0), 0) / entries.length;
        const avgCarbs = entries.reduce((acc, d) => acc + (d.carbsConsumed || 0), 0) / entries.length;
        const avgFat = entries.reduce((acc, d) => acc + (d.fatConsumed || 0), 0) / entries.length;

        return {
            kcal: (avgKcal / nutritionTargets.kcal) * 100,
            protein: (avgProtein / nutritionTargets.protein) * 100,
            carbs: (avgCarbs / nutritionTargets.carbs) * 100,
            fat: (avgFat / nutritionTargets.fat) * 100,
        };
    }, [sortedDailyData, nutritionTargets]);

    // Último feedback/nota del usuario
    const lastFeedback = useMemo(() => {
        // Buscar última nota en registros diarios
        const dailyWithNotes = [...dailyRecords]
            .filter(d => d.nota && d.nota.trim())
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        // Buscar comentarios en registros semanales
        const weeklyWithNotes = [...weeklyRecords]
            .filter(w => w.nutriComentario || w.topMejorar || w.topBien)
            .sort((a, b) => new Date(b.weekStartDate) - new Date(a.weekStartDate));

        const lastDaily = dailyWithNotes[0];
        const lastWeekly = weeklyWithNotes[0];

        // Comparar cuál es más reciente
        if (lastDaily && lastWeekly) {
            const dailyDate = new Date(lastDaily.date);
            const weeklyDate = new Date(lastWeekly.weekStartDate);
            if (dailyDate > weeklyDate) {
                return { type: 'daily', data: lastDaily, date: dailyDate };
            } else {
                return { type: 'weekly', data: lastWeekly, date: weeklyDate };
            }
        } else if (lastDaily) {
            return { type: 'daily', data: lastDaily, date: new Date(lastDaily.date) };
        } else if (lastWeekly) {
            return { type: 'weekly', data: lastWeekly, date: new Date(lastWeekly.weekStartDate) };
        }
        return null;
    }, [dailyRecords, weeklyRecords]);

    // Feedbacks no leídos (coachViewedAt === null Y tienen contenido)
    const unreadFeedbacks = useMemo(() => {
        const unreadDaily = dailyRecords
            .filter(d => !d.coachViewedAt && d.nota && d.nota.trim())
            .map(d => ({
                type: 'daily',
                date: new Date(d.date),
                content: d.nota,
                id: d._id,
            }));

        const unreadWeekly = weeklyRecords
            .filter(w => !w.coachViewedAt && (w.nutriComentario || w.topMejorar || w.topBien))
            .map(w => ({
                type: 'weekly',
                date: new Date(w.weekStartDate),
                content: w.topBien ? `🏆 ${w.topBien}` : w.topMejorar ? `🎯 ${w.topMejorar}` : `🍽️ ${w.nutriComentario}`,
                fullData: w,
                id: w._id,
            }));

        return [...unreadDaily, ...unreadWeekly]
            .sort((a, b) => b.date - a.date);
    }, [dailyRecords, weeklyRecords]);

    // Agrupar feedbacks: última semana directo, resto por año/mes
    const [expandedMonths, setExpandedMonths] = useState({});
    const groupedFeedbacks = useMemo(() => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const recentMessages = unreadFeedbacks.filter(f => f.date >= oneWeekAgo);
        const olderMessages = unreadFeedbacks.filter(f => f.date < oneWeekAgo);

        // Agrupar mensajes antiguos por año/mes
        const monthGroups = {};
        olderMessages.forEach(msg => {
            const year = msg.date.getFullYear();
            const month = msg.date.getMonth();
            const key = `${year}-${month}`;
            const monthName = msg.date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

            if (!monthGroups[key]) {
                monthGroups[key] = { key, label: monthName, messages: [] };
            }
            monthGroups[key].messages.push(msg);
        });

        return {
            recent: recentMessages,
            older: Object.values(monthGroups).sort((a, b) => b.key.localeCompare(a.key)),
        };
    }, [unreadFeedbacks]);

    const toggleMonth = (monthKey) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#1e293b" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Cargando...</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>{clientName || 'Cliente'}</Text>
                    <Text style={styles.headerSubtitle}>Vista completa</Text>
                </View>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

                {/* ════════════════════════════════════════════════════════════ */}
                {/* 💪 ENTRENAMIENTO */}
                {/* ════════════════════════════════════════════════════════════ */}
                <ExpandableSection
                    title="Entrenamiento"
                    emoji="💪"
                    color="#8b5cf6"
                    isExpanded={expandedSections.training}
                    onToggle={() => toggleSection('training')}
                >
                    {/* KPI Selector */}
                    <View style={styles.kpiSelector}>
                        {[
                            { id: 'volume', label: 'Volumen', icon: 'trending-up' },
                            { id: 'intensity', label: 'Intensidad', icon: 'flash' },
                            { id: 'compliance', label: 'Cumplimiento', icon: 'checkmark-circle' },
                            { id: 'heavySets', label: 'Carga Alta', icon: 'barbell' },
                        ].map(kpi => (
                            <TouchableOpacity
                                key={kpi.id}
                                style={[styles.kpiButton, trainingKpi === kpi.id && styles.kpiButtonActive]}
                                onPress={() => setTrainingKpi(kpi.id)}
                            >
                                <Ionicons
                                    name={kpi.icon}
                                    size={16}
                                    color={trainingKpi === kpi.id ? '#fff' : '#64748b'}
                                />
                                <Text style={[styles.kpiButtonText, trainingKpi === kpi.id && styles.kpiButtonTextActive]}>
                                    {kpi.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Chart */}
                    {getTrainingChartData() ? (
                        <>
                            <LineChart
                                data={getTrainingChartData()}
                                width={chartWidth}
                                height={180}
                                chartConfig={chartConfig}
                                bezier
                                style={styles.chart}
                            />
                            <Text style={styles.chartDescription}>
                                {trainingKpi === 'volume' && '📈 Volumen total por semana (kg × reps). Indica la carga de trabajo acumulada.'}
                                {trainingKpi === 'intensity' && '⚡ Intensidad relativa semanal. Mide el peso medio utilizado respecto al máximo.'}
                                {trainingKpi === 'compliance' && '✅ % de cumplimiento del plan asignado vs series completadas.'}
                                {trainingKpi === 'heavySets' && '🏋️ Series con carga alta (>80% e1RM) por semana.'}
                            </Text>
                        </>
                    ) : (
                        <View style={styles.noDataBox}>
                            <Ionicons name="analytics-outline" size={40} color="#cbd5e1" />
                            <Text style={styles.noDataText}>Sin datos de entrenamiento</Text>
                        </View>
                    )}

                    {/* Summary */}
                    <View style={styles.summaryRow}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryValue}>{sessions.length}</Text>
                            <Text style={styles.summaryLabel}>Sesiones</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryValue}>{complianceData?.avgValue || '--'}%</Text>
                            <Text style={styles.summaryLabel}>Cumplimiento</Text>
                        </View>
                    </View>
                </ExpandableSection>

                {/* ════════════════════════════════════════════════════════════ */}
                {/* 📊 EVOLUCIÓN */}
                {/* ════════════════════════════════════════════════════════════ */}
                <ExpandableSection
                    title="Evolución"
                    emoji="📊"
                    color="#10b981"
                    isExpanded={expandedSections.evolution}
                    onToggle={() => toggleSection('evolution')}
                >
                    {/* Weight Summary */}
                    <View style={styles.weightSummary}>
                        <View style={styles.weightItem}>
                            <Text style={styles.weightLabel}>Actual</Text>
                            <Text style={styles.weightValue}>{currentWeight ? `${currentWeight} kg` : '--'}</Text>
                        </View>
                        <View style={styles.weightDivider} />
                        <View style={styles.weightItem}>
                            <Text style={styles.weightLabel}>Objetivo</Text>
                            <Text style={styles.weightValue}>{targetWeight ? `${targetWeight} kg` : '--'}</Text>
                        </View>
                        {currentWeight && targetWeight && (
                            <>
                                <View style={styles.weightDivider} />
                                <View style={styles.weightItem}>
                                    <Text style={styles.weightLabel}>Diferencia</Text>
                                    <Text style={[styles.weightValue, { color: currentWeight <= targetWeight ? '#10b981' : '#f59e0b' }]}>
                                        {Math.abs(currentWeight - targetWeight).toFixed(1)} kg
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>

                    {/* Weight Chart */}
                    {weightChartData ? (
                        <>
                            <LineChart
                                data={weightChartData}
                                width={chartWidth}
                                height={160}
                                chartConfig={{
                                    ...chartConfig,
                                    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                                }}
                                bezier
                                style={styles.chart}
                                yAxisSuffix=" kg"
                            />
                            <Text style={styles.chartDescription}>
                                📊 Evolución del peso corporal a lo largo del tiempo. Tendencia hacia el objetivo.
                            </Text>
                        </>
                    ) : (
                        <View style={styles.noDataBox}>
                            <Ionicons name="scale-outline" size={40} color="#cbd5e1" />
                            <Text style={styles.noDataText}>Sin datos de peso</Text>
                        </View>
                    )}

                    {/* Macro Compliance */}
                    {macroCompliance && (
                        <View style={styles.macroGrid}>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroEmoji}>🔥</Text>
                                <ProgressRing percentage={macroCompliance.kcal} color="#ef4444" />
                                <Text style={styles.macroLabel}>Kcal</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroEmoji}>🥩</Text>
                                <ProgressRing percentage={macroCompliance.protein} color="#3b82f6" />
                                <Text style={styles.macroLabel}>Proteína</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroEmoji}>🍞</Text>
                                <ProgressRing percentage={macroCompliance.carbs} color="#f59e0b" />
                                <Text style={styles.macroLabel}>Carbos</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroEmoji}>🥑</Text>
                                <ProgressRing percentage={macroCompliance.fat} color="#10b981" />
                                <Text style={styles.macroLabel}>Grasa</Text>
                            </View>
                        </View>
                    )}

                    {/* Último Feedback del Usuario */}
                    {(lastFeedback || unreadFeedbacks.length > 0) && (
                        <View style={styles.feedbackCard}>
                            <TouchableOpacity
                                style={styles.feedbackHeader}
                                onPress={() => unreadFeedbacks.length > 0 && setFeedbackModalVisible(true)}
                                disabled={unreadFeedbacks.length === 0}
                            >
                                <Ionicons name="chatbubble-ellipses" size={18} color="#8b5cf6" />
                                <Text style={styles.feedbackTitle}>Último mensaje del cliente</Text>
                                {unreadFeedbacks.length > 0 && (
                                    <View style={styles.unreadBadge}>
                                        <Text style={styles.unreadBadgeText}>{unreadFeedbacks.length}</Text>
                                    </View>
                                )}
                                {lastFeedback && (
                                    <Text style={styles.feedbackDate}>
                                        {lastFeedback.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                    </Text>
                                )}
                            </TouchableOpacity>
                            {lastFeedback && lastFeedback.type === 'daily' ? (
                                <Text style={styles.feedbackText}>"{lastFeedback.data.nota}"</Text>
                            ) : lastFeedback ? (
                                <View>
                                    {lastFeedback.data.topBien && (
                                        <Text style={styles.feedbackText}>🏆 {lastFeedback.data.topBien}</Text>
                                    )}
                                    {lastFeedback.data.topMejorar && (
                                        <Text style={styles.feedbackText}>🎯 {lastFeedback.data.topMejorar}</Text>
                                    )}
                                    {lastFeedback.data.nutriComentario && (
                                        <Text style={styles.feedbackText}>🍽️ {lastFeedback.data.nutriComentario}</Text>
                                    )}
                                </View>
                            ) : null}
                            {unreadFeedbacks.length > 0 && (
                                <TouchableOpacity
                                    style={styles.viewAllUnreadBtn}
                                    onPress={() => setFeedbackModalVisible(true)}
                                >
                                    <Text style={styles.viewAllUnreadText}>
                                        Ver {unreadFeedbacks.length} mensaje{unreadFeedbacks.length > 1 ? 's' : ''} sin leer
                                    </Text>
                                    <Ionicons name="arrow-forward" size={16} color="#8b5cf6" />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </ExpandableSection>

                {/* ════════════════════════════════════════════════════════════ */}
                {/* 🍽️ DIETA */}
                {/* ════════════════════════════════════════════════════════════ */}
                <ExpandableSection
                    title="Dieta"
                    emoji="🍽️"
                    color="#ec4899"
                    isExpanded={expandedSections.diet}
                    onToggle={() => toggleSection('diet')}
                >
                    {nutritionPlan ? (
                        <View>
                            <View style={styles.dietHeader}>
                                <Text style={styles.dietStatus}>
                                    {nutritionPlan.status === 'published' ? '✅ Publicado' : '📝 Borrador'}
                                </Text>
                            </View>

                            {nutritionPlan.dayTargets?.length > 0 ? (
                                <View style={styles.dayTargetsGrid}>
                                    {nutritionPlan.dayTargets.map((day, idx) => (
                                        <View key={idx} style={[styles.dayTargetCard, { borderLeftColor: day.color || '#3b82f6' }]}>
                                            <Text style={styles.dayTargetName}>{day.name || `Día ${idx + 1}`}</Text>
                                            <View style={styles.dayTargetMacros}>
                                                <Text style={styles.dayTargetMacro}>🔥 {day.kcal || '--'}</Text>
                                                <Text style={styles.dayTargetMacro}>🥩 {day.protein || '--'}g</Text>
                                                <Text style={styles.dayTargetMacro}>🍞 {day.carbs || '--'}g</Text>
                                                <Text style={styles.dayTargetMacro}>🥑 {day.fat || '--'}g</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <Text style={styles.noDataText}>Sin tipos de día configurados</Text>
                            )}
                        </View>
                    ) : (
                        <View style={styles.noDataBox}>
                            <Ionicons name="nutrition-outline" size={40} color="#cbd5e1" />
                            <Text style={styles.noDataText}>Sin plan nutricional asignado</Text>
                        </View>
                    )}
                </ExpandableSection>

                {/* ════════════════════════════════════════════════════════════ */}
                {/* 💳 PAGOS - EN CONSTRUCCIÓN */}
                {/* ════════════════════════════════════════════════════════════ */}
                <ExpandableSection
                    title="Pagos"
                    emoji="💳"
                    color="#22c55e"
                    isExpanded={false}
                    onToggle={() => { }}
                    disabled={true}
                    buildingInProgress={true}
                />

                {/* ════════════════════════════════════════════════════════════ */}
                {/* 💬 MENSAJES - EN CONSTRUCCIÓN */}
                {/* ════════════════════════════════════════════════════════════ */}
                <ExpandableSection
                    title="Mensajes"
                    emoji="💬"
                    color="#3b82f6"
                    isExpanded={false}
                    onToggle={() => { }}
                    disabled={true}
                    buildingInProgress={true}
                />

                {/* ════════════════════════════════════════════════════════════ */}
                {/* 📝 GENERAR FEEDBACK */}
                {/* ════════════════════════════════════════════════════════════ */}
                <TouchableOpacity
                    style={styles.generateFeedbackBtn}
                    onPress={() => setSendFeedbackModalVisible(true)}
                    activeOpacity={0.8}
                >
                    <Ionicons name="create" size={22} color="#fff" />
                    <Text style={styles.generateFeedbackText}>Generar Feedback</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Modal de Enviar Feedback */}
            <Modal
                visible={sendFeedbackModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSendFeedbackModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.sendFeedbackContainer}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalTitleRow}>
                                <Ionicons name="create" size={24} color="#10b981" />
                                <Text style={styles.modalTitle}>Enviar Feedback</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSendFeedbackModalVisible(false)}>
                                <Ionicons name="close-circle" size={28} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        {/* Type Selector */}
                        <View style={styles.feedbackTypeRow}>
                            {[
                                { id: 'general', label: 'General', icon: 'chatbubble' },
                                { id: 'entreno', label: 'Entreno', icon: 'barbell' },
                                { id: 'nutricion', label: 'Nutrición', icon: 'nutrition' },
                                { id: 'evolucion', label: 'Evolución', icon: 'trending-up' },
                            ].map(type => (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[styles.feedbackTypeBtn, feedbackType === type.id && styles.feedbackTypeBtnActive]}
                                    onPress={() => setFeedbackType(type.id)}
                                >
                                    <Ionicons
                                        name={type.icon}
                                        size={16}
                                        color={feedbackType === type.id ? '#fff' : '#64748b'}
                                    />
                                    <Text style={[styles.feedbackTypeLabel, feedbackType === type.id && styles.feedbackTypeLabelActive]}>
                                        {type.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Message Input */}
                        <TextInput
                            style={styles.feedbackInput}
                            placeholder="Escribe tu mensaje para el cliente..."
                            placeholderTextColor="#94a3b8"
                            value={feedbackMessage}
                            onChangeText={setFeedbackMessage}
                            multiline
                            numberOfLines={5}
                            textAlignVertical="top"
                        />

                        {/* Send Button */}
                        <TouchableOpacity
                            style={[styles.sendFeedbackBtn, !feedbackMessage.trim() && styles.sendFeedbackBtnDisabled]}
                            onPress={handleSendFeedback}
                            disabled={!feedbackMessage.trim() || sendingFeedback}
                        >
                            {sendingFeedback ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane" size={20} color="#fff" />
                                    <Text style={styles.sendFeedbackBtnText}>Enviar Feedback</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal de Feedbacks No Leídos */}
            <Modal
                visible={feedbackModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setFeedbackModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalTitleRow}>
                                <Ionicons name="chatbubbles" size={24} color="#8b5cf6" />
                                <Text style={styles.modalTitle}>Mensajes sin leer</Text>
                                <View style={styles.modalBadge}>
                                    <Text style={styles.modalBadgeText}>{unreadFeedbacks.length}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setFeedbackModalVisible(false)}>
                                <Ionicons name="close-circle" size={28} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalList}>
                            {/* Mensajes de la última semana */}
                            {groupedFeedbacks.recent.length > 0 && (
                                <View style={styles.modalSection}>
                                    <View style={styles.modalSectionHeader}>
                                        <Ionicons name="time" size={16} color="#10b981" />
                                        <Text style={styles.modalSectionTitle}>Última semana</Text>
                                        <View style={styles.modalSectionBadge}>
                                            <Text style={styles.modalSectionBadgeText}>{groupedFeedbacks.recent.length}</Text>
                                        </View>
                                    </View>
                                    {groupedFeedbacks.recent.map(item => (
                                        <View key={item.id} style={styles.modalFeedbackItem}>
                                            <View style={styles.modalFeedbackHeader}>
                                                <View style={[styles.modalTypeBadge, { backgroundColor: item.type === 'daily' ? '#dbeafe' : '#fef3c7' }]}>
                                                    <Text style={[styles.modalTypeText, { color: item.type === 'daily' ? '#3b82f6' : '#d97706' }]}>
                                                        {item.type === 'daily' ? 'Diario' : 'Semanal'}
                                                    </Text>
                                                </View>
                                                <Text style={styles.modalFeedbackDate}>
                                                    {item.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                                </Text>
                                            </View>
                                            <Text style={styles.modalFeedbackContent}>{item.content}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Mensajes antiguos agrupados por mes */}
                            {groupedFeedbacks.older.length > 0 && (
                                <View style={styles.modalSection}>
                                    <View style={styles.modalSectionHeader}>
                                        <Ionicons name="folder" size={16} color="#f59e0b" />
                                        <Text style={styles.modalSectionTitle}>Historial</Text>
                                    </View>

                                    {groupedFeedbacks.older.map(monthGroup => (
                                        <View key={monthGroup.key} style={styles.monthFolder}>
                                            <TouchableOpacity
                                                style={styles.monthFolderHeader}
                                                onPress={() => toggleMonth(monthGroup.key)}
                                            >
                                                <Ionicons
                                                    name={expandedMonths[monthGroup.key] ? 'folder-open' : 'folder'}
                                                    size={18}
                                                    color="#f59e0b"
                                                />
                                                <Text style={styles.monthFolderTitle}>{monthGroup.label}</Text>
                                                <View style={styles.monthFolderBadge}>
                                                    <Text style={styles.monthFolderBadgeText}>{monthGroup.messages.length}</Text>
                                                </View>
                                                <Ionicons
                                                    name={expandedMonths[monthGroup.key] ? 'chevron-up' : 'chevron-down'}
                                                    size={18}
                                                    color="#94a3b8"
                                                />
                                            </TouchableOpacity>

                                            {expandedMonths[monthGroup.key] && (
                                                <View style={styles.monthFolderContent}>
                                                    {monthGroup.messages.map(item => (
                                                        <View key={item.id} style={[styles.modalFeedbackItem, styles.folderItem]}>
                                                            <View style={styles.modalFeedbackHeader}>
                                                                <View style={[styles.modalTypeBadge, { backgroundColor: item.type === 'daily' ? '#dbeafe' : '#fef3c7' }]}>
                                                                    <Text style={[styles.modalTypeText, { color: item.type === 'daily' ? '#3b82f6' : '#d97706' }]}>
                                                                        {item.type === 'daily' ? 'Diario' : 'Semanal'}
                                                                    </Text>
                                                                </View>
                                                                <Text style={styles.modalFeedbackDate}>
                                                                    {item.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                                                </Text>
                                                            </View>
                                                            <Text style={styles.modalFeedbackContent}>{item.content}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Empty State */}
                            {unreadFeedbacks.length === 0 && (
                                <View style={styles.modalEmptyState}>
                                    <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                                    <Text style={styles.modalEmptyText}>¡Todo al día!</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#64748b',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Section Card
    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    sectionCardDisabled: {
        opacity: 0.6,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    sectionIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionEmoji: {
        fontSize: 22,
    },
    sectionTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: '700',
        color: '#1e293b',
    },
    sectionTitleDisabled: {
        color: '#94a3b8',
    },
    sectionContent: {
        padding: 16,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },

    // Building Badge
    buildingBadge: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    buildingText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#d97706',
    },

    // KPI Selector
    kpiSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    kpiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    kpiButtonActive: {
        backgroundColor: '#8b5cf6',
        borderColor: '#8b5cf6',
    },
    kpiButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    kpiButtonTextActive: {
        color: '#fff',
    },

    // Chart
    chart: {
        borderRadius: 12,
        marginVertical: 8,
        alignSelf: 'center',
    },
    chartDescription: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 8,
        paddingHorizontal: 8,
        fontStyle: 'italic',
    },

    // No Data
    noDataBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
    },
    noDataText: {
        marginTop: 8,
        fontSize: 14,
        color: '#94a3b8',
    },

    // Summary Row
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
    },
    summaryLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },

    // Weight Summary
    weightSummary: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    weightItem: {
        alignItems: 'center',
        flex: 1,
    },
    weightLabel: {
        fontSize: 11,
        color: '#94a3b8',
        marginBottom: 4,
    },
    weightValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    weightDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 8,
    },

    // Macro Grid
    macroGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    macroItem: {
        alignItems: 'center',
        gap: 6,
    },
    macroEmoji: {
        fontSize: 18,
    },
    macroLabel: {
        fontSize: 11,
        color: '#64748b',
    },

    // Feedback Card
    feedbackCard: {
        backgroundColor: '#faf5ff',
        borderRadius: 12,
        padding: 14,
        marginTop: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#8b5cf6',
    },
    feedbackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    feedbackTitle: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: '#8b5cf6',
    },
    feedbackDate: {
        fontSize: 11,
        color: '#94a3b8',
    },
    feedbackText: {
        fontSize: 14,
        color: '#1e293b',
        lineHeight: 20,
        marginTop: 4,
    },

    // Diet
    dietHeader: {
        marginBottom: 12,
    },
    dietStatus: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    dayTargetsGrid: {
        gap: 10,
    },
    dayTargetCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 12,
        borderLeftWidth: 4,
    },
    dayTargetName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 6,
    },
    dayTargetMacros: {
        flexDirection: 'row',
        gap: 12,
    },
    dayTargetMacro: {
        fontSize: 12,
        color: '#64748b',
    },

    // Unread Badge (WhatsApp style)
    unreadBadge: {
        backgroundColor: '#22c55e',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        paddingHorizontal: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unreadBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    viewAllUnreadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 8,
        backgroundColor: '#ede9fe',
        borderRadius: 8,
    },
    viewAllUnreadText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8b5cf6',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '75%',
        paddingBottom: 30,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    modalBadge: {
        backgroundColor: '#8b5cf6',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    modalBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    modalList: {
        padding: 16,
        gap: 12,
    },
    modalFeedbackItem: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 14,
        borderLeftWidth: 3,
        borderLeftColor: '#8b5cf6',
    },
    modalFeedbackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    modalTypeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    modalTypeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    modalFeedbackDate: {
        fontSize: 12,
        color: '#94a3b8',
    },
    modalFeedbackContent: {
        fontSize: 14,
        color: '#1e293b',
        lineHeight: 20,
    },
    modalEmptyState: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    modalEmptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#10b981',
    },

    // Modal Sections
    modalSection: {
        marginBottom: 20,
    },
    modalSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    modalSectionTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    modalSectionBadge: {
        backgroundColor: '#10b981',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    modalSectionBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },

    // Month Folders
    monthFolder: {
        marginBottom: 8,
        backgroundColor: '#fffbeb',
        borderRadius: 10,
        overflow: 'hidden',
    },
    monthFolderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
    },
    monthFolderTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        textTransform: 'capitalize',
    },
    monthFolderBadge: {
        backgroundColor: '#f59e0b',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    monthFolderBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    monthFolderContent: {
        padding: 10,
        paddingTop: 0,
        gap: 8,
    },
    folderItem: {
        backgroundColor: '#fff',
        marginTop: 6,
    },

    // Generate Feedback Button
    generateFeedbackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#10b981',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 14,
        marginTop: 8,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    generateFeedbackText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },

    // Send Feedback Modal
    sendFeedbackContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 40,
    },
    feedbackTypeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginVertical: 16,
    },
    feedbackTypeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    feedbackTypeBtnActive: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    feedbackTypeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    feedbackTypeLabelActive: {
        color: '#fff',
    },
    feedbackInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 16,
        fontSize: 15,
        color: '#1e293b',
        minHeight: 120,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 16,
    },
    sendFeedbackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#10b981',
        paddingVertical: 14,
        borderRadius: 12,
    },
    sendFeedbackBtnDisabled: {
        backgroundColor: '#94a3b8',
    },
    sendFeedbackBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
});
