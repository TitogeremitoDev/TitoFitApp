/* app/(coach)/seguimiento/[clientId].jsx - Detalle de Seguimiento de un Cliente */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
    useWindowDimensions,
    Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useAuth } from '../../../context/AuthContext';
import { useFeedbackBubble } from '../../../context/FeedbackBubbleContext';
import { calculateFullNutrition } from '../../../src/utils/nutritionCalculator';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const MOOD_EMOJIS = ['', '😢', '😕', '😐', '🙂', '😄'];

const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (dateStr) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

// ═══════════════════════════════════════════════════════════════════════════
// CHART CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const chartConfig = {
    backgroundColor: '#fff',
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
    propsForDots: { r: '4', strokeWidth: '2', stroke: '#0ea5e9' },
    fillShadowGradient: '#0ea5e9',
    fillShadowGradientOpacity: 0.2,
    propsForBackgroundLines: {
        strokeDasharray: '',
        stroke: '#e2e8f0',
        strokeWidth: 1,
    },
};

const barChartConfig = {
    ...chartConfig,
    color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
    fillShadowGradient: '#8b5cf6',
};

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS RING COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const ProgressRing = ({ percentage, color, size = 70 }) => {
    const strokeWidth = 8;
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
                <Text style={{ fontSize: 14, fontWeight: '700', color }}>
                    {Math.round(normalizedPercentage)}%
                </Text>
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function ClientSeguimientoDetailScreen() {
    const { clientId, clientName } = useLocalSearchParams();
    const router = useRouter();
    const { token } = useAuth();
    const { width: windowWidth } = useWindowDimensions();

    // Chart dimensions
    const isWeb = Platform.OS === 'web';
    const chartWidth = isWeb ? Math.min(windowWidth - 64, 600) : windowWidth - 48;

    // Estados principales
    const [dailyRecords, setDailyRecords] = useState([]);
    const [weeklyRecords, setWeeklyRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('daily');

    // 📊 NUEVO: View mode (data | stats)
    const [viewMode, setViewMode] = useState('data');

    // 📊 NUEVO: Client info and nutrition targets for stats
    const [clientInfo, setClientInfo] = useState(null);
    const [nutritionTargets, setNutritionTargets] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

    // 📂 NUEVO: Estado para meses expandidos (histórico colapsado por mes)
    const [expandedMonths, setExpandedMonths] = useState({});

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    // ─────────────────────────────────────────────────────────────────────────
    // CARGAR DATOS Y MARCAR COMO VISTO
    // ─────────────────────────────────────────────────────────────────────────
    const fetchClientHistory = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);

            // Cargar historial de seguimiento
            const res = await fetch(`${API_URL}/api/monitoring/coach/client/${clientId}/history`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (data.success) {
                setDailyRecords(data.daily || []);
                setWeeklyRecords(data.weekly || []);
            }

            // 📊 NUEVO: Cargar info del cliente para estadísticas
            try {
                const clientRes = await fetch(`${API_URL}/api/users/${clientId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const clientData = await clientRes.json();
                if (clientData.success && clientData.user) {
                    setClientInfo(clientData.user);

                    // Calcular objetivos de nutrición del cliente
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
            } catch (e) {
                console.log('[Seguimiento Detail] Error cargando info cliente:', e.message);
            }

            // Marcar como visto al entrar
            await fetch(`${API_URL}/api/monitoring/coach/mark-viewed`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ clientId, type: 'both' }),
            });
        } catch (error) {
            console.error('[Seguimiento Detail] Error:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [clientId, token, API_URL]);

    useEffect(() => {
        fetchClientHistory();
    }, [fetchClientHistory]);

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchClientHistory(true);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 📊 CHART DATA CALCULATIONS (para vista de estadísticas)
    // ─────────────────────────────────────────────────────────────────────────

    // Ordenar dailyRecords por fecha
    const sortedDailyData = useMemo(() => {
        return [...dailyRecords].sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [dailyRecords]);

    // Peso objetivo del cliente
    const targetWeight = useMemo(() => {
        return clientInfo?.info_user?.pesoObjetivo || null;
    }, [clientInfo]);

    // Peso actual
    const currentWeight = useMemo(() => {
        const weightEntries = sortedDailyData.filter(d => d.peso && d.peso > 0);
        return weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].peso : null;
    }, [sortedDailyData]);

    // Weight chart data
    const weightChartData = useMemo(() => {
        const weightEntries = sortedDailyData.filter(d => d.peso && d.peso > 0);
        if (weightEntries.length < 2) return null;

        const labels = weightEntries.map(d => {
            const date = new Date(d.date);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        });

        return {
            labels: labels.length > 7 ? labels.filter((_, i) => i % Math.ceil(labels.length / 7) === 0) : labels,
            datasets: [{
                data: weightEntries.map(d => d.peso),
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                strokeWidth: 3,
            }],
        };
    }, [sortedDailyData]);

    // Mood chart data
    const moodChartData = useMemo(() => {
        const moodEntries = sortedDailyData.filter(d => d.animo && d.animo > 0);
        if (moodEntries.length < 2) return null;

        const labels = moodEntries.map(d => {
            const date = new Date(d.date);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        });

        return {
            labels: labels.length > 7 ? labels.filter((_, i) => i % Math.ceil(labels.length / 7) === 0) : labels,
            datasets: [{
                data: moodEntries.map(d => d.animo),
                color: (opacity = 1) => `rgba(251, 191, 36, ${opacity})`,
                strokeWidth: 3,
            }],
        };
    }, [sortedDailyData]);

    // Average mood
    const avgMood = useMemo(() => {
        const moodEntries = sortedDailyData.filter(d => d.animo && d.animo > 0);
        if (moodEntries.length === 0) return null;
        const sum = moodEntries.reduce((acc, d) => acc + d.animo, 0);
        return (sum / moodEntries.length).toFixed(1);
    }, [sortedDailyData]);

    // Macro compliance percentages
    const macroCompliance = useMemo(() => {
        const entriesWithMacros = sortedDailyData.filter(d => d.kcalConsumed && d.kcalConsumed > 0);
        if (entriesWithMacros.length === 0) return null;

        const avgKcal = entriesWithMacros.reduce((acc, d) => acc + (d.kcalConsumed || 0), 0) / entriesWithMacros.length;
        const avgProtein = entriesWithMacros.reduce((acc, d) => acc + (d.proteinConsumed || 0), 0) / entriesWithMacros.length;
        const avgCarbs = entriesWithMacros.reduce((acc, d) => acc + (d.carbsConsumed || 0), 0) / entriesWithMacros.length;
        const avgFat = entriesWithMacros.reduce((acc, d) => acc + (d.fatConsumed || 0), 0) / entriesWithMacros.length;

        return {
            kcal: nutritionTargets.kcal > 0 ? (avgKcal / nutritionTargets.kcal) * 100 : 0,
            protein: nutritionTargets.protein > 0 ? (avgProtein / nutritionTargets.protein) * 100 : 0,
            carbs: nutritionTargets.carbs > 0 ? (avgCarbs / nutritionTargets.carbs) * 100 : 0,
            fat: nutritionTargets.fat > 0 ? (avgFat / nutritionTargets.fat) * 100 : 0,
        };
    }, [sortedDailyData, nutritionTargets]);

    // Sleep chart data
    const sleepChartData = useMemo(() => {
        const sleepEntries = sortedDailyData.filter(d => d.sueno && d.sueno > 0);
        if (sleepEntries.length < 2) return null;

        const labels = sleepEntries.map(d => {
            const date = new Date(d.date);
            return `${date.getDate()}`;
        });

        return {
            labels: labels.length > 7 ? labels.filter((_, i) => i % Math.ceil(labels.length / 7) === 0) : labels,
            datasets: [{ data: sleepEntries.map(d => d.sueno) }],
        };
    }, [sortedDailyData]);

    // Average sleep
    const avgSleep = useMemo(() => {
        const sleepEntries = sortedDailyData.filter(d => d.sueno && d.sueno > 0);
        if (sleepEntries.length === 0) return null;
        const sum = sleepEntries.reduce((acc, d) => acc + d.sueno, 0);
        return (sum / sleepEntries.length).toFixed(1);
    }, [sortedDailyData]);

    // Hunger vs Adherence data
    const hungerAdherenceData = useMemo(() => {
        if (weeklyRecords.length === 0) return null;

        const dataPoints = [];
        weeklyRecords.forEach(week => {
            if (!week.nutriAdherencia) return;

            const weekStart = new Date(week.weekStartDate);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);

            const weekDailyData = sortedDailyData.filter(d => {
                const date = new Date(d.date);
                return date >= weekStart && date < weekEnd && d.hambre;
            });

            if (weekDailyData.length > 0) {
                const avgHunger = weekDailyData.reduce((acc, d) => acc + d.hambre, 0) / weekDailyData.length;
                dataPoints.push({
                    hunger: avgHunger,
                    adherence: week.nutriAdherencia,
                });
            }
        });

        return dataPoints.length >= 2 ? dataPoints : null;
    }, [sortedDailyData, weeklyRecords]);

    // ─────────────────────────────────────────────────────────────────────────
    // 📂 AGRUPAR REGISTROS POR MES (mes actual suelto, anteriores colapsados)
    // ─────────────────────────────────────────────────────────────────────────
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const groupRecordsByMonth = (records, dateField = 'date') => {
        const currentMonthRecords = [];
        const historicalGroups = {};

        records.forEach(record => {
            const recordDate = new Date(dateField === 'weekStartDate' ? record.weekStartDate : record.date);
            const year = recordDate.getFullYear();
            const month = recordDate.getMonth();

            if (year === currentYear && month === currentMonth) {
                currentMonthRecords.push(record);
            } else {
                const key = `${year}-${String(month + 1).padStart(2, '0')}`;
                if (!historicalGroups[key]) {
                    historicalGroups[key] = {
                        key,
                        year,
                        month,
                        label: recordDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
                        records: [],
                    };
                }
                historicalGroups[key].records.push(record);
            }
        });

        // Ordenar grupos por fecha descendente
        const sortedGroups = Object.values(historicalGroups).sort((a, b) => {
            if (b.year !== a.year) return b.year - a.year;
            return b.month - a.month;
        });

        return { currentMonthRecords, historicalGroups: sortedGroups };
    };

    const groupedDailyRecords = useMemo(() => {
        return groupRecordsByMonth(dailyRecords, 'date');
    }, [dailyRecords, currentYear, currentMonth]);

    const groupedWeeklyRecords = useMemo(() => {
        return groupRecordsByMonth(weeklyRecords, 'weekStartDate');
    }, [weeklyRecords, currentYear, currentMonth]);

    const toggleMonth = (key) => {
        setExpandedMonths(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER DAILY RECORD
    // ─────────────────────────────────────────────────────────────────────────
    const renderDailyRecord = (record) => (
        <View key={record._id} style={styles.recordCard}>
            <View style={styles.recordHeader}>
                <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                {record.coachViewedAt && (
                    <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                )}
            </View>

            <View style={styles.recordGrid}>
                {record.peso && (
                    <View style={styles.recordItem}>
                        <Ionicons name="scale-outline" size={18} color="#64748b" />
                        <Text style={styles.recordValue}>{record.peso} kg</Text>
                        <Text style={styles.recordLabel}>Peso</Text>
                    </View>
                )}

                {record.sueno && (
                    <View style={styles.recordItem}>
                        <Ionicons name="bed-outline" size={18} color="#64748b" />
                        <Text style={styles.recordValue}>{record.sueno}h</Text>
                        <Text style={styles.recordLabel}>Sueño</Text>
                    </View>
                )}

                {record.animo && (
                    <View style={styles.recordItem}>
                        <Text style={styles.moodEmoji}>{MOOD_EMOJIS[record.animo]}</Text>
                        <Text style={styles.recordLabel}>Ánimo</Text>
                    </View>
                )}

                {record.energia && (
                    <View style={styles.recordItem}>
                        <Ionicons name="flash" size={18} color="#f59e0b" />
                        <Text style={styles.recordValue}>{record.energia}/5</Text>
                        <Text style={styles.recordLabel}>Energía</Text>
                    </View>
                )}

                {record.hambre && (
                    <View style={styles.recordItem}>
                        <Ionicons name="restaurant-outline" size={18} color="#64748b" />
                        <Text style={styles.recordValue}>{record.hambre}/5</Text>
                        <Text style={styles.recordLabel}>Hambre</Text>
                    </View>
                )}

                {record.pasos && (
                    <View style={styles.recordItem}>
                        <Ionicons name="footsteps-outline" size={18} color="#64748b" />
                        <Text style={styles.recordValue}>{record.pasos.toLocaleString()}</Text>
                        <Text style={styles.recordLabel}>Pasos</Text>
                    </View>
                )}
            </View>

            {record.haIdoBien && (
                <View style={styles.haIdoBienRow}>
                    <Text style={styles.haIdoBienLabel}>¿Ha ido bien?</Text>
                    <View style={[
                        styles.haIdoBienBadge,
                        {
                            backgroundColor: record.haIdoBien === 'si' ? '#10b98120' :
                                record.haIdoBien === 'medio' ? '#f59e0b20' : '#ef444420'
                        }
                    ]}>
                        <Text style={[
                            styles.haIdoBienText,
                            {
                                color: record.haIdoBien === 'si' ? '#10b981' :
                                    record.haIdoBien === 'medio' ? '#f59e0b' : '#ef4444'
                            }
                        ]}>
                            {record.haIdoBien === 'si' ? '✅ Sí' :
                                record.haIdoBien === 'medio' ? '🤔 Medio' : '❌ No'}
                        </Text>
                    </View>
                </View>
            )}

            {record.nota && (
                <View style={styles.notaContainer}>
                    <Text style={styles.notaLabel}>Nota:</Text>
                    <Text style={styles.notaText}>{record.nota}</Text>
                </View>
            )}
        </View>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER WEEKLY RECORD
    // ─────────────────────────────────────────────────────────────────────────
    const renderWeeklyRecord = (record) => (
        <View key={record._id} style={styles.recordCard}>
            <View style={styles.recordHeader}>
                <Text style={styles.recordDate}>Semana del {formatDate(record.weekStartDate)}</Text>
                {record.coachViewedAt && (
                    <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                )}
            </View>

            {/* Nutrición */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>🍽️</Text>
                <Text style={styles.sectionTitle}>Nutrición</Text>
            </View>
            <View style={styles.recordGrid}>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.nutriAdherencia || '--'}/10</Text>
                    <Text style={styles.recordLabel}>Adherencia</Text>
                </View>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.nutriSaciedad || '--'}/5</Text>
                    <Text style={styles.recordLabel}>Saciedad</Text>
                </View>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.nutriGI || '--'}/5</Text>
                    <Text style={styles.recordLabel}>Gastroint.</Text>
                </View>
            </View>
            {record.nutriComentario && (
                <Text style={styles.comentarioText}>{record.nutriComentario}</Text>
            )}

            {/* Entrenamiento */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>💪</Text>
                <Text style={styles.sectionTitle}>Entrenamiento</Text>
            </View>
            <View style={styles.recordGrid}>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.entrenoAdherencia || '--'}/10</Text>
                    <Text style={styles.recordLabel}>Adherencia</Text>
                </View>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.entrenoRendimiento || '--'}/10</Text>
                    <Text style={styles.recordLabel}>Rendimiento</Text>
                </View>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.entrenoFatiga || '--'}/5</Text>
                    <Text style={styles.recordLabel}>Fatiga</Text>
                </View>
            </View>
            {record.entrenoMolestias && (
                <View style={styles.alertBox}>
                    <Ionicons name="warning" size={16} color="#ef4444" />
                    <Text style={styles.alertText}>
                        Molestias: {record.entrenoMolestiasTexto || 'Sí'}
                    </Text>
                </View>
            )}

            {/* Sensaciones */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>🧠</Text>
                <Text style={styles.sectionTitle}>Sensaciones</Text>
            </View>
            <View style={styles.recordGrid}>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.sensMotivacion || '--'}/5</Text>
                    <Text style={styles.recordLabel}>Motivación</Text>
                </View>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.sensEstres || '--'}/5</Text>
                    <Text style={styles.recordLabel}>Estrés</Text>
                </View>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.sensEmocional || '--'}/5</Text>
                    <Text style={styles.recordLabel}>Emocional</Text>
                </View>
            </View>

            {/* Reflexión */}
            {(record.topMejorar || record.topBien) && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionEmoji}>💭</Text>
                        <Text style={styles.sectionTitle}>Reflexión</Text>
                    </View>
                    {record.topMejorar && (
                        <View style={styles.reflexionItem}>
                            <Text style={styles.reflexionLabel}>🎯 A mejorar:</Text>
                            <Text style={styles.reflexionText}>{record.topMejorar}</Text>
                        </View>
                    )}
                    {record.topBien && (
                        <View style={styles.reflexionItem}>
                            <Text style={styles.reflexionLabel}>🏆 Lo hice bien:</Text>
                            <Text style={styles.reflexionText}>{record.topBien}</Text>
                        </View>
                    )}
                </>
            )}

            {/* Mediciones */}
            {(record.medCuello || record.medHombros || record.medPecho || record.medCintura) && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionEmoji}>📐</Text>
                        <Text style={styles.sectionTitle}>Mediciones</Text>
                    </View>
                    <View style={styles.recordGrid}>
                        {record.medCuello && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medCuello} cm</Text>
                                <Text style={styles.recordLabel}>Cuello</Text>
                            </View>
                        )}
                        {record.medHombros && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medHombros} cm</Text>
                                <Text style={styles.recordLabel}>Hombros</Text>
                            </View>
                        )}
                        {record.medPecho && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medPecho} cm</Text>
                                <Text style={styles.recordLabel}>Pecho</Text>
                            </View>
                        )}
                        {record.medCintura && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medCintura} cm</Text>
                                <Text style={styles.recordLabel}>Cintura</Text>
                            </View>
                        )}
                    </View>
                </>
            )}
        </View>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 📊 RENDER STATS VIEW (Vista de Estadísticas)
    // ─────────────────────────────────────────────────────────────────────────
    const renderStatsView = () => (
        <ScrollView
            contentContainerStyle={styles.statsScrollContent}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    colors={['#0ea5e9']}
                />
            }
        >
            {/* PESO OBJETIVO (solo lectura) */}
            <View style={styles.statsCard}>
                <View style={styles.statsCardHeader}>
                    <Text style={styles.statsCardIcon}>🎯</Text>
                    <Text style={styles.statsCardTitle}>PESO OBJETIVO</Text>
                </View>
                {targetWeight ? (
                    <View style={styles.targetContent}>
                        <Text style={styles.targetWeight}>{targetWeight} kg</Text>
                        <Text style={styles.targetSubtext}>
                            Peso actual: <Text style={styles.targetValue}>{currentWeight || '--'} kg</Text>
                        </Text>
                        {currentWeight && targetWeight && (
                            <Text style={[styles.targetDiff, { color: currentWeight <= targetWeight ? '#10b981' : '#f59e0b' }]}>
                                {currentWeight > targetWeight
                                    ? `↓ ${(currentWeight - targetWeight).toFixed(1)} kg para meta`
                                    : currentWeight < targetWeight
                                        ? `↑ ${(targetWeight - currentWeight).toFixed(1)} kg para meta`
                                        : '✅ ¡Meta alcanzada!'}
                            </Text>
                        )}
                    </View>
                ) : (
                    <Text style={styles.noDataText}>El cliente no tiene peso objetivo configurado</Text>
                )}
            </View>

            {/* EVOLUCIÓN DEL PESO */}
            <View style={styles.statsCard}>
                <View style={styles.statsCardHeader}>
                    <Text style={styles.statsCardIcon}>📊</Text>
                    <Text style={styles.statsCardTitle}>Evolución del Peso</Text>
                </View>
                {weightChartData ? (
                    <LineChart
                        data={weightChartData}
                        width={chartWidth}
                        height={180}
                        chartConfig={{
                            ...chartConfig,
                            color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                        }}
                        bezier
                        style={styles.chart}
                        yAxisSuffix=" kg"
                    />
                ) : (
                    <View style={styles.noChartData}>
                        <Ionicons name="scale-outline" size={40} color="#cbd5e1" />
                        <Text style={styles.noDataText}>Datos insuficientes de peso</Text>
                    </View>
                )}
            </View>

            {/* ESTADO DE ÁNIMO */}
            <View style={styles.statsCard}>
                <View style={styles.statsCardHeader}>
                    <Text style={styles.statsCardIcon}>😊</Text>
                    <Text style={styles.statsCardTitle}>Estado de Ánimo</Text>
                    {avgMood && (
                        <View style={styles.avgBadge}>
                            <Text style={styles.avgBadgeText}>{MOOD_EMOJIS[Math.round(avgMood)]} {avgMood}</Text>
                        </View>
                    )}
                </View>
                {moodChartData ? (
                    <LineChart
                        data={moodChartData}
                        width={chartWidth}
                        height={160}
                        chartConfig={{
                            ...chartConfig,
                            color: (opacity = 1) => `rgba(251, 191, 36, ${opacity})`,
                        }}
                        bezier
                        style={styles.chart}
                        fromZero
                        segments={4}
                    />
                ) : (
                    <View style={styles.noChartData}>
                        <Ionicons name="happy-outline" size={40} color="#cbd5e1" />
                        <Text style={styles.noDataText}>Datos insuficientes de ánimo</Text>
                    </View>
                )}
            </View>

            {/* CUMPLIMIENTO DE DIETA */}
            <View style={styles.statsCard}>
                <View style={styles.statsCardHeader}>
                    <Text style={styles.statsCardIcon}>🍽️</Text>
                    <Text style={styles.statsCardTitle}>Cumplimiento de Dieta</Text>
                </View>
                {macroCompliance ? (
                    <View style={styles.macroGrid}>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroEmoji}>🔥</Text>
                            <ProgressRing
                                percentage={macroCompliance.kcal}
                                color={macroCompliance.kcal >= 90 && macroCompliance.kcal <= 105 ? '#10B981' :
                                    macroCompliance.kcal >= 80 && macroCompliance.kcal <= 115 ? '#F59E0B' : '#EF4444'}
                            />
                            <Text style={styles.macroLabel}>Kcal</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroEmoji}>🥩</Text>
                            <ProgressRing
                                percentage={macroCompliance.protein}
                                color={macroCompliance.protein >= 90 && macroCompliance.protein <= 105 ? '#10B981' :
                                    macroCompliance.protein >= 80 && macroCompliance.protein <= 115 ? '#F59E0B' : '#EF4444'}
                            />
                            <Text style={styles.macroLabel}>Proteína</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroEmoji}>🍞</Text>
                            <ProgressRing
                                percentage={macroCompliance.carbs}
                                color={macroCompliance.carbs >= 90 && macroCompliance.carbs <= 105 ? '#10B981' :
                                    macroCompliance.carbs >= 80 && macroCompliance.carbs <= 115 ? '#F59E0B' : '#EF4444'}
                            />
                            <Text style={styles.macroLabel}>Carbos</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroEmoji}>🥑</Text>
                            <ProgressRing
                                percentage={macroCompliance.fat}
                                color={macroCompliance.fat >= 90 && macroCompliance.fat <= 105 ? '#10B981' :
                                    macroCompliance.fat >= 80 && macroCompliance.fat <= 115 ? '#F59E0B' : '#EF4444'}
                            />
                            <Text style={styles.macroLabel}>Grasa</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.noChartData}>
                        <Ionicons name="nutrition-outline" size={40} color="#cbd5e1" />
                        <Text style={styles.noDataText}>Sin datos de macros</Text>
                    </View>
                )}
            </View>

            {/* HORAS DE SUEÑO */}
            <View style={styles.statsCard}>
                <View style={styles.statsCardHeader}>
                    <Text style={styles.statsCardIcon}>😴</Text>
                    <Text style={styles.statsCardTitle}>Horas de Sueño</Text>
                    {avgSleep && (
                        <View style={[styles.avgBadge, { backgroundColor: parseFloat(avgSleep) >= 7 ? '#10b98120' : '#f59e0b20' }]}>
                            <Text style={[styles.avgBadgeText, { color: parseFloat(avgSleep) >= 7 ? '#10b981' : '#f59e0b' }]}>
                                ⌀ {avgSleep}h
                            </Text>
                        </View>
                    )}
                </View>
                {sleepChartData ? (
                    <BarChart
                        data={sleepChartData}
                        width={chartWidth}
                        height={160}
                        chartConfig={barChartConfig}
                        style={styles.chart}
                        yAxisSuffix="h"
                        showValuesOnTopOfBars
                        fromZero
                    />
                ) : (
                    <View style={styles.noChartData}>
                        <Ionicons name="bed-outline" size={40} color="#cbd5e1" />
                        <Text style={styles.noDataText}>Datos insuficientes de sueño</Text>
                    </View>
                )}
            </View>

            {/* HAMBRE VS ADHERENCIA */}
            <View style={styles.statsCard}>
                <View style={styles.statsCardHeader}>
                    <Text style={styles.statsCardIcon}>📈</Text>
                    <Text style={styles.statsCardTitle}>Hambre vs Adherencia</Text>
                </View>
                {hungerAdherenceData ? (
                    <View style={styles.correlationContainer}>
                        <View style={styles.correlationGrid}>
                            {hungerAdherenceData.slice(-6).map((point, index) => (
                                <View key={index} style={styles.correlationPoint}>
                                    <Text style={styles.correlationHunger}>🍽️ {point.hunger.toFixed(1)}</Text>
                                    <View style={[
                                        styles.correlationBar,
                                        {
                                            height: point.adherence * 8,
                                            backgroundColor: point.adherence >= 7 ? '#10b981' :
                                                point.adherence >= 5 ? '#f59e0b' : '#ef4444'
                                        }
                                    ]} />
                                    <Text style={styles.correlationAdherence}>{point.adherence}/10</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    <View style={styles.noChartData}>
                        <Ionicons name="analytics-outline" size={40} color="#cbd5e1" />
                        <Text style={styles.noDataText}>Datos insuficientes para correlación</Text>
                    </View>
                )}
            </View>

            <View style={{ height: 24 }} />
        </ScrollView>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{clientName || 'Cliente'}</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0ea5e9" />
                    <Text style={styles.loadingText}>Cargando historial...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const records = activeTab === 'daily' ? dailyRecords : weeklyRecords;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{clientName || 'Cliente'}</Text>
            </View>

            {/* 📊 VIEW MODE SELECTOR */}
            <View style={styles.viewModeRow}>
                <TouchableOpacity
                    style={[styles.viewModeBtn, viewMode === 'data' && styles.viewModeBtnActive]}
                    onPress={() => setViewMode('data')}
                >
                    <Ionicons
                        name="list"
                        size={18}
                        color={viewMode === 'data' ? '#fff' : '#64748b'}
                    />
                    <Text style={[styles.viewModeText, viewMode === 'data' && styles.viewModeTextActive]}>
                        Datos por día
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.viewModeBtn, viewMode === 'stats' && styles.viewModeBtnActive]}
                    onPress={() => setViewMode('stats')}
                >
                    <Ionicons
                        name="stats-chart"
                        size={18}
                        color={viewMode === 'stats' ? '#fff' : '#64748b'}
                    />
                    <Text style={[styles.viewModeText, viewMode === 'stats' && styles.viewModeTextActive]}>
                        Gráficos
                    </Text>
                </TouchableOpacity>
            </View>

            {/* CONTENIDO CONDICIONAL */}
            {viewMode === 'stats' ? (
                renderStatsView()
            ) : (
                <>
                    {/* Tabs Diario/Semanal */}
                    <View style={styles.tabsRow}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'daily' && styles.tabActive]}
                            onPress={() => setActiveTab('daily')}
                        >
                            <Ionicons
                                name="calendar"
                                size={18}
                                color={activeTab === 'daily' ? '#0ea5e9' : '#64748b'}
                            />
                            <Text style={[styles.tabText, activeTab === 'daily' && styles.tabTextActive]}>
                                Diario ({dailyRecords.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'weekly' && styles.tabActive]}
                            onPress={() => setActiveTab('weekly')}
                        >
                            <Ionicons
                                name="calendar-outline"
                                size={18}
                                color={activeTab === 'weekly' ? '#0ea5e9' : '#64748b'}
                            />
                            <Text style={[styles.tabText, activeTab === 'weekly' && styles.tabTextActive]}>
                                Semanal ({weeklyRecords.length})
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={onRefresh}
                                colors={['#0ea5e9']}
                            />
                        }
                    >
                        {records.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="document-text-outline" size={60} color="#cbd5e1" />
                                <Text style={styles.emptyTitle}>Sin registros</Text>
                                <Text style={styles.emptyText}>
                                    {activeTab === 'daily'
                                        ? 'Este cliente aún no ha registrado check-ins diarios.'
                                        : 'Este cliente aún no ha registrado check-ins semanales.'}
                                </Text>
                            </View>
                        ) : (
                            <>
                                {/* Registros del mes actual (sueltos) */}
                                {activeTab === 'daily' ? (
                                    <>
                                        {groupedDailyRecords.currentMonthRecords.length > 0 && (
                                            <View style={styles.monthSection}>
                                                <View style={styles.monthHeaderCurrent}>
                                                    <Text style={styles.monthLabel}>📅 Este mes</Text>
                                                    <Text style={styles.monthCount}>
                                                        {groupedDailyRecords.currentMonthRecords.length} registros
                                                    </Text>
                                                </View>
                                                {groupedDailyRecords.currentMonthRecords.map(renderDailyRecord)}
                                            </View>
                                        )}
                                        {/* Meses anteriores (colapsados) */}
                                        {groupedDailyRecords.historicalGroups.map(group => (
                                            <View key={group.key} style={styles.monthSection}>
                                                <TouchableOpacity
                                                    style={styles.monthHeaderCollapsible}
                                                    onPress={() => toggleMonth(`daily-${group.key}`)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons
                                                        name={expandedMonths[`daily-${group.key}`] ? 'chevron-down' : 'chevron-forward'}
                                                        size={20}
                                                        color="#64748b"
                                                    />
                                                    <Text style={styles.monthLabelCollapsible}>
                                                        📁 {group.label}
                                                    </Text>
                                                    <Text style={styles.monthCount}>{group.records.length}</Text>
                                                </TouchableOpacity>
                                                {expandedMonths[`daily-${group.key}`] && (
                                                    <View style={styles.monthRecords}>
                                                        {group.records.map(renderDailyRecord)}
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        {groupedWeeklyRecords.currentMonthRecords.length > 0 && (
                                            <View style={styles.monthSection}>
                                                <View style={styles.monthHeaderCurrent}>
                                                    <Text style={styles.monthLabel}>📅 Este mes</Text>
                                                    <Text style={styles.monthCount}>
                                                        {groupedWeeklyRecords.currentMonthRecords.length} registros
                                                    </Text>
                                                </View>
                                                {groupedWeeklyRecords.currentMonthRecords.map(renderWeeklyRecord)}
                                            </View>
                                        )}
                                        {/* Meses anteriores (colapsados) */}
                                        {groupedWeeklyRecords.historicalGroups.map(group => (
                                            <View key={group.key} style={styles.monthSection}>
                                                <TouchableOpacity
                                                    style={styles.monthHeaderCollapsible}
                                                    onPress={() => toggleMonth(`weekly-${group.key}`)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons
                                                        name={expandedMonths[`weekly-${group.key}`] ? 'chevron-down' : 'chevron-forward'}
                                                        size={20}
                                                        color="#64748b"
                                                    />
                                                    <Text style={styles.monthLabelCollapsible}>
                                                        📁 {group.label}
                                                    </Text>
                                                    <Text style={styles.monthCount}>{group.records.length}</Text>
                                                </TouchableOpacity>
                                                {expandedMonths[`weekly-${group.key}`] && (
                                                    <View style={styles.monthRecords}>
                                                        {group.records.map(renderWeeklyRecord)}
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </ScrollView>
                </>
            )}
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderColor: '#5f9ae92d',
        borderWidth: 10,
        borderRadius: 50,

    },
    backBtn: {
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
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

    // Tabs
    tabsRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        gap: 6,
    },
    tabActive: {
        backgroundColor: '#0ea5e920',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    tabTextActive: {
        color: '#0ea5e9',
    },

    // Content
    scrollContent: {
        padding: 16,
    },

    // Record Card
    recordCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    recordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    recordDate: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    recordGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 8,
    },
    recordItem: {
        alignItems: 'center',
        minWidth: 70,
    },
    recordValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 4,
    },
    recordLabel: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    moodEmoji: {
        fontSize: 24,
    },

    // Ha ido bien
    haIdoBienRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    haIdoBienLabel: {
        fontSize: 13,
        color: '#64748b',
    },
    haIdoBienBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    haIdoBienText: {
        fontSize: 12,
        fontWeight: '600',
    },

    // Nota
    notaContainer: {
        marginTop: 12,
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 8,
    },
    notaLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 4,
    },
    notaText: {
        fontSize: 13,
        color: '#1e293b',
        lineHeight: 20,
    },

    // Sections
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
        gap: 6,
    },
    sectionEmoji: {
        fontSize: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    comentarioText: {
        fontSize: 13,
        color: '#64748b',
        fontStyle: 'italic',
        marginBottom: 8,
    },

    // Alert
    alertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        padding: 10,
        borderRadius: 8,
        marginTop: 8,
        gap: 8,
    },
    alertText: {
        fontSize: 13,
        color: '#ef4444',
        flex: 1,
    },

    // Reflexion
    reflexionItem: {
        marginBottom: 8,
    },
    reflexionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    reflexionText: {
        fontSize: 13,
        color: '#1e293b',
        marginTop: 2,
    },

    // Empty
    emptyContainer: {
        alignItems: 'center',
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
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 32,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW MODE SELECTOR
    // ═══════════════════════════════════════════════════════════════════════════
    viewModeRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    viewModeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        gap: 8,
    },
    viewModeBtnActive: {
        backgroundColor: '#0ea5e9',
    },
    viewModeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    viewModeTextActive: {
        color: '#fff',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // STATS VIEW
    // ═══════════════════════════════════════════════════════════════════════════
    statsScrollContent: {
        padding: 16,
        gap: 16,
    },
    statsCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    statsCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    statsCardIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    statsCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
    },

    // Target Weight
    targetContent: {
        alignItems: 'center',
    },
    targetWeight: {
        fontSize: 40,
        fontWeight: '800',
        color: '#0ea5e9',
    },
    targetSubtext: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 8,
    },
    targetValue: {
        fontWeight: '600',
        color: '#1e293b',
    },
    targetDiff: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 6,
    },
    noDataText: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        paddingVertical: 16,
    },
    noChartData: {
        alignItems: 'center',
        paddingVertical: 24,
    },

    // Charts
    chart: {
        borderRadius: 12,
        marginVertical: 8,
    },
    avgBadge: {
        backgroundColor: '#fbbf2420',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    avgBadgeText: {
        color: '#fbbf24',
        fontSize: 12,
        fontWeight: '600',
    },

    // Macro Grid
    macroGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
    },
    macroItem: {
        alignItems: 'center',
        paddingVertical: 8,
        width: '25%',
    },
    macroEmoji: {
        fontSize: 20,
        marginBottom: 8,
    },
    macroLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 8,
    },

    // Correlation Chart
    correlationContainer: {
        paddingVertical: 8,
    },
    correlationGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        height: 100,
        marginBottom: 8,
    },
    correlationPoint: {
        alignItems: 'center',
    },
    correlationHunger: {
        color: '#64748b',
        fontSize: 10,
        marginBottom: 4,
    },
    correlationBar: {
        width: 24,
        borderRadius: 4,
        minHeight: 8,
    },
    correlationAdherence: {
        color: '#1e293b',
        fontSize: 10,
        marginTop: 4,
        fontWeight: '600',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // MONTH GROUPING (Historical records collapsed by month)
    // ═══════════════════════════════════════════════════════════════════════════
    monthSection: {
        marginBottom: 8,
    },
    monthHeaderCurrent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#0ea5e910',
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#0ea5e9',
    },
    monthLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0ea5e9',
    },
    monthCount: {
        fontSize: 12,
        color: '#64748b',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    monthHeaderCollapsible: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 14,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 8,
    },
    monthLabelCollapsible: {
        fontSize: 15,
        fontWeight: '600',
        color: '#475569',
        flex: 1,
    },
    monthRecords: {
        marginTop: 12,
        paddingLeft: 4,
    },
});
