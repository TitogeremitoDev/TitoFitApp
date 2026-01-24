/* app/(app)/perfil/transformacion.jsx
   ────────────────────────────────────────────────────────────────────────
   Dashboard de Transformación:
   - Peso objetivo con línea horizontal en gráfico
   - Evolución del peso (LineChart)
   - Estado de ánimo (LineChart)
   - Cumplimiento de dieta (4 Pie Charts)
   - Horas de sueño (BarChart + trend line)
   - Hambre vs Adherencia (correlation chart)
   - Modal de felicitación cuando alcanza peso objetivo
   ──────────────────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    useWindowDimensions,
    ActivityIndicator,
    Pressable,
    Alert,
    Platform,
    Modal,
    TextInput,
    TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, BarChart, ProgressChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { calculateFullNutrition } from '../../../src/utils/nutritionCalculator';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// ═══════════════════════════════════════════════════════════════════════════
// CHART CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════

// Chart configs moved inside component for dynamic theming

// ═══════════════════════════════════════════════════════════════════════════
// MOOD EMOJIS
// ═══════════════════════════════════════════════════════════════════════════

const MOOD_EMOJIS = {
    1: '😢',
    2: '😕',
    3: '😐',
    4: '🙂',
    5: '😄',
};

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM PIE CHART COMPONENT (since react-native-chart-kit's PieChart is complex)
// ═══════════════════════════════════════════════════════════════════════════

const MacroPieChart = ({ label, emoji, percentage, color }) => {
    const { theme } = useTheme();
    const displayPercentage = Math.min(100, Math.max(0, percentage));
    const circumference = 2 * Math.PI * 35;
    const strokeDasharray = `${(displayPercentage / 100) * circumference} ${circumference}`;

    // Color based on deviation from 100%
    const getStatusColor = (pct) => {
        if (pct >= 90 && pct <= 105) return theme.success || '#10B981'; // Green - on target
        if (pct >= 80 && pct <= 115) return '#F59E0B'; // Orange - slightly off (Keep standard warning color or use theme ?)
        return '#EF4444'; // Red - far off (theme.error)
    };

    const statusColor = getStatusColor(percentage);
    const statusText = percentage >= 90 && percentage <= 105 ? 'Bien' :
        percentage >= 80 && percentage <= 115 ? 'Revisar' : 'Atención';
    const statusEmoji = percentage >= 90 && percentage <= 105 ? '✅' :
        percentage >= 80 && percentage <= 115 ? '⚠️' : '❌';

    return (
        <View style={helperStyles.pieChartItem}>
            <Text style={helperStyles.pieChartEmoji}>{emoji}</Text>
            <View style={helperStyles.pieChartCircleContainer}>
                <View style={helperStyles.pieChartCircle}>
                    <View style={[helperStyles.pieChartBg, { borderColor: theme.border }]} />
                    <View style={[
                        helperStyles.pieChartProgress,
                        {
                            borderColor: statusColor,
                            transform: [{ rotate: '-90deg' }],
                            borderTopColor: 'transparent',
                            borderRightColor: 'transparent',
                            borderBottomColor: displayPercentage > 50 ? statusColor : 'transparent',
                        }
                    ]} />
                    <Text style={helperStyles.pieChartPercentage}>{Math.round(percentage)}%</Text>
                </View>
            </View>
            <Text style={helperStyles.pieChartLabel}>{label}</Text>
            <Text style={[helperStyles.pieChartStatus, { color: statusColor }]}>
                {statusEmoji} {statusText}
            </Text>
        </View>
    );
};

// Simple progress ring using SVG-like approach with Views
const ProgressRing = ({ percentage, color, size = 70 }) => {
    const { theme } = useTheme();
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const normalizedPercentage = Math.min(100, Math.max(0, percentage));

    return (
        <View style={[helperStyles.progressRing, { width: size, height: size }]}>
            {/* Background circle */}
            <View style={[
                helperStyles.progressRingBg,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: strokeWidth,
                    borderColor: theme.border,
                }
            ]} />
            {/* Progress indicator using a simple fill approach */}
            <View style={[
                helperStyles.progressRingFill,
                {
                    width: size - strokeWidth * 2,
                    height: size - strokeWidth * 2,
                    borderRadius: (size - strokeWidth * 2) / 2,
                    backgroundColor: `${color}20`,
                }
            ]}>
                <Text style={[helperStyles.progressRingText, { color }]}>
                    {Math.round(normalizedPercentage)}%
                </Text>
            </View>
        </View>
    );
};


// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function TransformacionScreen() {
    const router = useRouter();
    const { user, token, refreshUser } = useAuth();
    const { theme, isDark } = useTheme();
    const { width: windowWidth } = useWindowDimensions();

    const isWeb = Platform.OS === 'web';
    const isLargeScreen = windowWidth > 768;
    const isSmallScreen = windowWidth < 400;
    const contentWidth = isWeb && isLargeScreen ? Math.min(windowWidth * 0.9, 1200) : windowWidth;
    // Fix overflow: Card has marginHorizontal: 8 (total 16) + padding: 16 (total 32)
    // Plus container paddingHorizontal: 8 (total 16). Total spacing = 64.
    const chartPadding = isSmallScreen ? 48 : 64;
    const chartWidth = contentWidth - chartPadding;

    // Helper for colors
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 156, g: 163, b: 175 }; // Default gray
    };

    // Dynamic Chart Config
    const chartConfig = useMemo(() => {
        const textRgb = hexToRgb(theme.textSecondary || '#9ca3af');

        return {
            backgroundColor: theme.cardBackground || '#1f2937',
            backgroundGradientFrom: theme.cardBackground || '#1f2937',
            backgroundGradientTo: theme.cardBackground || '#1f2937',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(${textRgb.r}, ${textRgb.g}, ${textRgb.b}, ${opacity})`,
            propsForDots: { r: '4', strokeWidth: '2', stroke: theme.primary || '#3b82f6' },
            fillShadowGradient: theme.primary || '#3b82f6',
            fillShadowGradientOpacity: 0.3,
            propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: theme.border || '#374151',
                strokeWidth: 1,
            },
        };
    }, [theme]);

    const barChartConfig = useMemo(() => ({
        ...chartConfig,
        color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
        fillShadowGradient: '#8b5cf6',
    }), [chartConfig]);

    // ─────────────────────────────────────────────────────────────────────────
    // STATES
    // ─────────────────────────────────────────────────────────────────────────
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [dailyData, setDailyData] = useState([]);
    const [weeklyData, setWeeklyData] = useState([]);
    const [nutritionTargets, setNutritionTargets] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

    // Target weight
    const [targetWeight, setTargetWeight] = useState(null);
    const [targetWeightModal, setTargetWeightModal] = useState(false);
    const [newTargetWeight, setNewTargetWeight] = useState('');
    const [goalReachedModal, setGoalReachedModal] = useState(false);
    const [goalChecked, setGoalChecked] = useState(false);

    // Determine if premium
    const isPremium = useMemo(() => {
        if (!user) return false;
        return ['PREMIUM', 'CLIENTE', 'ENTRENADOR', 'ADMINISTRADOR'].includes(user.tipoUsuario);
    }, [user]);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD DATA
    // ─────────────────────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            // Load target weight from user profile
            if (user?.info_user?.pesoObjetivo) {
                setTargetWeight(user.info_user.pesoObjetivo);
            }

            // Load nutrition targets
            if (isPremium && token) {
                try {
                    const res = await fetch(`${API_URL}/api/nutrition-plans/my-plan`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.success && data.todayTarget) {
                        setNutritionTargets({
                            kcal: data.todayTarget.kcal || 0,
                            protein: data.todayTarget.protein_g || 0,
                            carbs: data.todayTarget.carbs_g || 0,
                            fat: data.todayTarget.fat_g || 0,
                        });
                    } else {
                        // Calculate auto nutrition
                        const nutrition = calculateFullNutrition(
                            user?.info_user,
                            user?.info_user?.objetivoPrincipal || 'volumen',
                            user?.info_user?.af || 1.55
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
                } catch (e) {
                    console.log('[Transformacion] Error loading nutrition:', e.message);
                }
            } else {
                const nutrition = calculateFullNutrition(
                    user?.info_user,
                    user?.info_user?.objetivoPrincipal || 'volumen',
                    user?.info_user?.af || 1.55
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

            // Load daily monitoring data
            if (isPremium && token) {
                try {
                    const endDate = new Date().toISOString().split('T')[0];
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - 30);
                    const startDateStr = startDate.toISOString().split('T')[0];

                    const res = await fetch(
                        `${API_URL}/api/monitoring/daily?startDate=${startDateStr}&endDate=${endDate}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const data = await res.json();
                    if (data?.data) {
                        setDailyData(data.data.sort((a, b) => new Date(a.date) - new Date(b.date)));
                    }
                } catch (e) {
                    console.log('[Transformacion] Error loading daily:', e.message);
                }

                // Load weekly monitoring
                try {
                    const res = await fetch(`${API_URL}/api/monitoring/weekly?limit=12`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data?.data) {
                        setWeeklyData(data.data.sort((a, b) =>
                            new Date(a.weekStartDate) - new Date(b.weekStartDate)
                        ));
                    }
                } catch (e) {
                    console.log('[Transformacion] Error loading weekly:', e.message);
                }
            } else {
                // FREEUSER - Load from AsyncStorage
                const allData = [];
                const today = new Date();
                for (let i = 0; i < 30; i++) {
                    const d = new Date(today);
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toISOString().split('T')[0];

                    const minimalKey = `minimal_data_${dateStr}`;
                    const dailyKey = `daily_monitoring_${dateStr}`;

                    const minimalData = await AsyncStorage.getItem(minimalKey);
                    const fullData = await AsyncStorage.getItem(dailyKey);

                    if (minimalData || fullData) {
                        const parsed = minimalData ? JSON.parse(minimalData) : JSON.parse(fullData);
                        allData.push({ ...parsed, date: dateStr });
                    }
                }
                setDailyData(allData.sort((a, b) => new Date(a.date) - new Date(b.date)));
            }

        } catch (error) {
            console.error('[Transformacion] Error loading data:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [user, token, isPremium]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Check if goal reached
    useEffect(() => {
        if (goalChecked || !targetWeight) return;

        // Use current weight from user profile
        const currentUserWeight = user?.info_user?.peso;
        if (!currentUserWeight) return;

        // Determine direction: if target > current, user wants to GAIN weight
        const wantsToGain = targetWeight > currentUserWeight;

        // Check if goal reached based on direction
        if (wantsToGain && currentUserWeight >= targetWeight) {
            setGoalReachedModal(true);
        } else if (!wantsToGain && currentUserWeight <= targetWeight) {
            setGoalReachedModal(true);
        }
        setGoalChecked(true);
    }, [targetWeight, user, goalChecked]);

    // ─────────────────────────────────────────────────────────────────────────
    // SAVE TARGET WEIGHT
    // ─────────────────────────────────────────────────────────────────────────
    const handleSaveTargetWeight = async () => {
        const weight = parseFloat(newTargetWeight);
        if (isNaN(weight) || weight <= 0) {
            Alert.alert('Error', 'Por favor introduce un peso válido');
            return;
        }

        try {
            if (isPremium && token) {
                await axios.put('/users/info', {
                    info_user: { ...user.info_user, pesoObjetivo: weight }
                });
                await refreshUser();
            } else {
                // Save locally for FREEUSER
                await AsyncStorage.setItem('TARGET_WEIGHT', String(weight));
            }

            setTargetWeight(weight);
            setTargetWeightModal(false);
            setNewTargetWeight('');
            setGoalChecked(false); // Re-check goal
            Alert.alert('✅ Guardado', 'Peso objetivo actualizado');
        } catch (error) {
            console.error('[Transformacion] Error saving target:', error);
            Alert.alert('Error', 'No se pudo guardar el peso objetivo');
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // CHART DATA CALCULATIONS
    // ─────────────────────────────────────────────────────────────────────────

    // Weight chart data
    const weightChartData = useMemo(() => {
        const weightEntries = dailyData.filter(d => d.peso && d.peso > 0);
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
    }, [dailyData]);

    // Current weight from user profile (most reliable source)
    const currentWeight = useMemo(() => {
        return user?.info_user?.peso || null;
    }, [user]);

    // Weight progress percentage - simple direct comparison
    const weightProgress = useMemo(() => {
        if (!targetWeight || !currentWeight) return null;

        // If already at or past target
        if (currentWeight === targetWeight) return 100;

        // Determine direction: target > current = wants to GAIN, target < current = wants to LOSE
        const wantsToGain = targetWeight > currentWeight;

        // Calculate how much progress has been made
        // Use initial weight from profile or assume a reasonable starting point
        const initialWeight = dailyData.filter(d => d.peso && d.peso > 0)[0]?.peso || currentWeight;

        const totalNeeded = Math.abs(targetWeight - initialWeight);
        if (totalNeeded === 0) return currentWeight === targetWeight ? 100 : 0;

        if (wantsToGain) {
            // Gaining: progress = how much we've gained from initial towards target
            const gained = currentWeight - initialWeight;
            if (gained < 0) return 0; // Going wrong direction
            return Math.min(100, (gained / totalNeeded) * 100);
        } else {
            // Losing: progress = how much we've lost from initial towards target
            const lost = initialWeight - currentWeight;
            if (lost < 0) return 0; // Going wrong direction (gaining instead of losing)
            return Math.min(100, (lost / totalNeeded) * 100);
        }
    }, [targetWeight, currentWeight, dailyData]);

    // Mood chart data
    const moodChartData = useMemo(() => {
        const moodEntries = dailyData.filter(d => d.animo && d.animo > 0);
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
    }, [dailyData]);

    // Average mood
    const avgMood = useMemo(() => {
        const moodEntries = dailyData.filter(d => d.animo && d.animo > 0);
        if (moodEntries.length === 0) return null;
        const sum = moodEntries.reduce((acc, d) => acc + d.animo, 0);
        return (sum / moodEntries.length).toFixed(1);
    }, [dailyData]);

    // Macro compliance percentages
    const macroCompliance = useMemo(() => {
        const entriesWithMacros = dailyData.filter(d =>
            d.kcalConsumed && d.kcalConsumed > 0
        );

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
    }, [dailyData, nutritionTargets]);

    // Sleep chart data
    const sleepChartData = useMemo(() => {
        const sleepEntries = dailyData.filter(d => d.sueno && d.sueno > 0);
        if (sleepEntries.length < 2) return null;

        const labels = sleepEntries.map(d => {
            const date = new Date(d.date);
            return `${date.getDate()}`;
        });

        return {
            labels: labels.length > 7 ? labels.filter((_, i) => i % Math.ceil(labels.length / 7) === 0) : labels,
            datasets: [{
                data: sleepEntries.map(d => d.sueno),
            }],
        };
    }, [dailyData]);

    // Average sleep
    const avgSleep = useMemo(() => {
        const sleepEntries = dailyData.filter(d => d.sueno && d.sueno > 0);
        if (sleepEntries.length === 0) return null;
        const sum = sleepEntries.reduce((acc, d) => acc + d.sueno, 0);
        return (sum / sleepEntries.length).toFixed(1);
    }, [dailyData]);

    // Hunger vs Adherence data
    const hungerAdherenceData = useMemo(() => {
        // Daily hunger averages per week matched with weekly adherence
        if (weeklyData.length === 0) return null;

        const dataPoints = [];
        weeklyData.forEach(week => {
            if (!week.nutriAdherencia) return;

            // Find daily data for this week
            const weekStart = new Date(week.weekStartDate);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);

            const weekDailyData = dailyData.filter(d => {
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
    }, [dailyData, weeklyData]);

    // Calculate correlation insight
    const hungerInsight = useMemo(() => {
        if (!hungerAdherenceData || hungerAdherenceData.length < 2) return null;

        // Simple correlation check
        const highHunger = hungerAdherenceData.filter(d => d.hunger >= 4);
        const lowHunger = hungerAdherenceData.filter(d => d.hunger <= 2);

        const avgAdherenceHighHunger = highHunger.length > 0
            ? highHunger.reduce((acc, d) => acc + d.adherence, 0) / highHunger.length
            : null;
        const avgAdherenceLowHunger = lowHunger.length > 0
            ? lowHunger.reduce((acc, d) => acc + d.adherence, 0) / lowHunger.length
            : null;

        if (avgAdherenceHighHunger !== null && avgAdherenceLowHunger !== null) {
            if (avgAdherenceHighHunger < avgAdherenceLowHunger - 1) {
                return '📉 Mayor hambre parece correlacionar con menor adherencia. Considera aumentar proteína/fibra.';
            } else if (avgAdherenceHighHunger > avgAdherenceLowHunger + 1) {
                return '📈 Interesante: tu adherencia es mayor cuando tienes más hambre. ¡Buen control!';
            }
        }
        return '📊 Sigue registrando datos para ver patrones entre hambre y adherencia.';
    }, [hungerAdherenceData]);

    // ─────────────────────────────────────────────────────────────────────────
    // DYNAMIC STYLES
    // ─────────────────────────────────────────────────────────────────────────
    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        center: {
            justifyContent: 'center',
            alignItems: 'center',
        },
        loadingText: {
            color: theme.textSecondary,
            marginTop: 12,
            fontSize: 16,
        },
        responsiveContainer: {
            paddingHorizontal: 8,
        },
        headerButton: {
            padding: 8,
        },

        // Target Section
        targetSection: {
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            padding: 16,
            marginTop: 16,
            marginHorizontal: 8,
            borderWidth: 1,
            borderColor: theme.border,
        },
        targetHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
        },
        targetIcon: {
            fontSize: 24,
            marginRight: 8,
        },
        targetTitle: {
            color: theme.text,
            fontSize: 14,
            fontWeight: '700',
            letterSpacing: 1,
            flex: 1,
        },
        editButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 8,
            backgroundColor: theme.primary + '20',
        },
        editButtonText: {
            color: theme.primary,
            fontSize: 14,
            fontWeight: '600',
            marginLeft: 4,
        },
        targetContent: {
            alignItems: 'center',
        },
        targetWeight: {
            color: theme.text,
            fontSize: 48,
            fontWeight: '800',
        },
        targetStats: {
            alignItems: 'center',
            marginTop: 8,
        },
        currentWeightLabel: {
            color: theme.textSecondary,
            fontSize: 14,
        },
        currentWeightValue: {
            color: theme.text,
            fontWeight: '600',
        },
        diffText: {
            color: theme.success || '#10B981',
            fontSize: 14,
            fontWeight: '600',
            marginTop: 4,
        },
        progressBarContainer: {
            width: '100%',
            marginTop: 16,
            alignItems: 'center',
        },
        progressBarBg: {
            width: '100%',
            height: 8,
            backgroundColor: theme.border,
            borderRadius: 4,
            overflow: 'hidden',
        },
        progressBarFill: {
            height: '100%',
            backgroundColor: theme.success || '#10B981',
            borderRadius: 4,
        },
        progressText: {
            color: theme.textSecondary,
            fontSize: 12,
            marginTop: 6,
        },
        noTargetText: {
            color: theme.textSecondary,
            fontSize: 14,
            textAlign: 'center',
            paddingVertical: 16,
        },

        // Chart Sections
        chartSection: {
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            padding: 16,
            marginTop: 16,
            marginHorizontal: 8,
            borderWidth: 1,
            borderColor: theme.border,
        },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
        },
        sectionIcon: {
            fontSize: 20,
            marginRight: 8,
        },
        sectionTitle: {
            color: theme.text,
            fontSize: 16,
            fontWeight: '700',
            flex: 1,
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
        chartWrapper: {
            alignItems: 'center',
        },
        chart: {
            borderRadius: 12,
            marginVertical: 8,
        },
        // Target weight line overlay styles
        targetLineOverlay: {
            position: 'absolute',
            flexDirection: 'row',
            alignItems: 'center',
            zIndex: 10,
        },
        targetLine: {
            flex: 1,
            height: 2,
            backgroundColor: '#EF4444',
            borderStyle: 'dashed',
        },
        targetLineBadge: {
            backgroundColor: '#EF444420',
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#EF4444',
            marginLeft: 4,
        },
        targetLineBadgeText: {
            color: '#EF4444',
            fontSize: 10,
            fontWeight: '700',
        },
        targetLineInfo: {
            width: '100%',
            paddingHorizontal: 16,
            marginTop: 8,
        },
        targetLineLegend: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        targetLineDash: {
            width: 20,
            height: 2,
            backgroundColor: '#EF4444',
            marginRight: 8,
            borderStyle: 'dashed',
        },
        targetLineLegendText: {
            color: theme.textSecondary,
            fontSize: 12,
        },
        noDataContainer: {
            alignItems: 'center',
            paddingVertical: 32,
        },
        noDataText: {
            color: theme.textSecondary,
            fontSize: 14,
            textAlign: 'center',
            marginTop: 12,
        },

        // Pie Charts Grid
        pieChartsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-around',
        },
        pieChartCard: {
            alignItems: 'center',
            padding: 12,
            width: '45%',
            marginBottom: 12,
        },
        pieCardEmoji: {
            fontSize: 24,
            marginBottom: 8,
        },
        pieCardLabel: {
            color: theme.textSecondary,
            fontSize: 12,
            marginTop: 8,
        },

        // Progress Ring
        progressRing: {
            justifyContent: 'center',
            alignItems: 'center',
        },
        progressRingBg: {
            position: 'absolute',
        },
        progressRingFill: {
            justifyContent: 'center',
            alignItems: 'center',
        },
        progressRingText: {
            fontSize: 14,
            fontWeight: '700',
        },

        // Sleep Legend
        sleepLegend: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
        },
        sleepLegendDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
            marginRight: 6,
        },
        sleepLegendText: {
            color: theme.textSecondary,
            fontSize: 12,
        },

        // Correlation Chart
        correlationContainer: {
            paddingVertical: 8,
        },
        correlationGrid: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'flex-end',
            height: 120,
            marginBottom: 16,
        },
        correlationPoint: {
            alignItems: 'center',
        },
        correlationHunger: {
            color: theme.textSecondary,
            fontSize: 10,
            marginBottom: 4,
        },
        correlationBar: {
            width: 24,
            borderRadius: 4,
            minHeight: 8,
        },
        correlationAdherence: {
            color: theme.text,
            fontSize: 10,
            marginTop: 4,
            fontWeight: '600',
        },
        insightBox: {
            backgroundColor: theme.border, // or cardBackground
            borderRadius: 8,
            padding: 12,
        },
        insightText: {
            color: theme.text,
            fontSize: 13,
            lineHeight: 18,
        },

        // Modals
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        modalContent: {
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 400,
            borderWidth: 1,
            borderColor: theme.border,
        },
        modalTitle: {
            color: theme.text,
            fontSize: 20,
            fontWeight: '700',
            textAlign: 'center',
        },
        modalSubtitle: {
            color: theme.textSecondary,
            fontSize: 14,
            textAlign: 'center',
            marginTop: 8,
            marginBottom: 20,
        },
        modalInputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.background,
            borderRadius: 12,
            paddingHorizontal: 16,
            marginBottom: 20,
        },
        modalInput: {
            flex: 1,
            color: theme.text,
            fontSize: 24,
            fontWeight: '700',
            paddingVertical: 16,
            textAlign: 'center',
        },
        modalInputSuffix: {
            color: theme.textSecondary,
            fontSize: 18,
            marginLeft: 8,
        },
        modalButtons: {
            flexDirection: 'row',
            gap: 12,
        },
        modalCancelBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: theme.border,
            alignItems: 'center',
        },
        modalCancelText: {
            color: theme.text,
            fontSize: 16,
            fontWeight: '600',
        },
        modalSaveBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: theme.primary,
            alignItems: 'center',
        },
        modalSaveText: {
            color: theme.primaryText,
            fontSize: 16,
            fontWeight: '600',
        },

        // Celebration Modal
        celebrationModal: {
            alignItems: 'center',
        },
        celebrationEmoji: {
            fontSize: 48,
            marginBottom: 16,
        },
        celebrationTitle: {
            color: theme.success || '#10B981',
            fontSize: 28,
            fontWeight: '800',
            marginBottom: 8,
        },
        celebrationSubtitle: {
            color: theme.text,
            fontSize: 16,
            textAlign: 'center',
            marginBottom: 16,
        },
        celebrationText: {
            color: theme.textSecondary,
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 24,
            lineHeight: 20,
        },

        // Legacy pie chart styles (kept for reference)
        pieChartItem: {
            alignItems: 'center',
            width: '25%',
        },
        pieChartEmoji: {
            fontSize: 20,
            marginBottom: 4,
        },
        pieChartCircleContainer: {
            width: 50,
            height: 50,
            marginVertical: 8,
        },
        pieChartCircle: {
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: theme.background,
            justifyContent: 'center',
            alignItems: 'center',
        },
        pieChartBg: {
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: 25,
            borderWidth: 4,
        },
        pieChartProgress: {
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: 25,
            borderWidth: 4,
        },
        pieChartPercentage: {
            color: theme.text,
            fontSize: 10,
            fontWeight: '700',
        },
        pieChartLabel: {
            color: theme.textSecondary,
            fontSize: 10,
            textAlign: 'center',
        },
        pieChartStatus: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 2,
        },
    }), [theme]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <Stack.Screen options={{
                    title: 'Cargando...',
                    headerTitleStyle: { color: theme.text },
                    headerStyle: { backgroundColor: theme.background },
                    headerTintColor: theme.text
                }} />
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.loadingText}>Cargando datos...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Mi Transformación',
                    headerTitleStyle: { color: theme.text },
                    headerStyle: { backgroundColor: theme.background },
                    headerTintColor: theme.text,
                    headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={styles.headerButton}>
                            <Ionicons name="arrow-back" size={24} color={theme.text} />
                        </Pressable>
                    ),
                    headerRight: () => (
                        <Pressable onPress={loadData} style={styles.headerButton} disabled={isRefreshing}>
                            {isRefreshing ? (
                                <ActivityIndicator size="small" color={theme.text} />
                            ) : (
                                <Ionicons name="refresh-outline" size={24} color={theme.text} />
                            )}
                        </Pressable>
                    ),
                }}
            />

            <View style={[styles.responsiveContainer, { width: contentWidth, alignSelf: isWeb && isLargeScreen ? 'center' : 'stretch' }]}>

                {/* ═══════════════════════════════════════════════════════════════════════════
                    TARGET WEIGHT SECTION
                    ═══════════════════════════════════════════════════════════════════════════ */}
                <View style={styles.targetSection}>
                    <View style={styles.targetHeader}>
                        <Text style={styles.targetIcon}>🎯</Text>
                        <Text style={styles.targetTitle}>PESO OBJETIVO</Text>
                        <Pressable
                            style={styles.editButton}
                            onPress={() => {
                                setNewTargetWeight(targetWeight ? String(targetWeight) : '');
                                setTargetWeightModal(true);
                            }}
                        >
                            <Ionicons name="pencil" size={18} color="#3B82F6" />
                            <Text style={styles.editButtonText}>Editar</Text>
                        </Pressable>
                    </View>

                    {targetWeight ? (
                        <View style={styles.targetContent}>
                            <Text style={styles.targetWeight}>{targetWeight} kg</Text>
                            <View style={styles.targetStats}>
                                <Text style={styles.currentWeightLabel}>
                                    Peso actual: <Text style={styles.currentWeightValue}>{currentWeight || '--'} kg</Text>
                                </Text>
                                {currentWeight && targetWeight && (
                                    <Text style={styles.diffText}>
                                        {currentWeight > targetWeight
                                            ? `↓ ${(currentWeight - targetWeight).toFixed(1)} kg para meta`
                                            : currentWeight < targetWeight
                                                ? `↑ ${(targetWeight - currentWeight).toFixed(1)} kg para meta`
                                                : '✅ ¡Meta alcanzada!'}
                                    </Text>
                                )}
                            </View>
                        </View>
                    ) : (
                        <Text style={styles.noTargetText}>Define tu peso objetivo para empezar</Text>
                    )}
                </View>

                {/* ═══════════════════════════════════════════════════════════════════════════
                    WEIGHT EVOLUTION CHART
                    ═══════════════════════════════════════════════════════════════════════════ */}
                <View style={styles.chartSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionIcon}>📊</Text>
                        <Text style={styles.sectionTitle}>Evolución del Peso</Text>
                    </View>

                    {weightChartData ? (
                        <View style={styles.chartWrapper}>
                            <LineChart
                                data={weightChartData}
                                width={chartWidth}
                                height={200}
                                chartConfig={{
                                    ...chartConfig,
                                    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                                }}
                                bezier
                                style={styles.chart}
                                yAxisSuffix=" kg"
                                withHorizontalLines={false}
                                withVerticalLines={false}
                            />
                        </View>
                    ) : (
                        <View style={styles.noDataContainer}>
                            <Ionicons name="scale-outline" size={48} color="#475569" />
                            <Text style={styles.noDataText}>Registra tu peso en Seguimiento para ver la gráfica</Text>
                        </View>
                    )}
                </View>

                {/* ═══════════════════════════════════════════════════════════════════════════
                    MOOD CHART
                    ═══════════════════════════════════════════════════════════════════════════ */}
                <View style={styles.chartSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionIcon}>😊</Text>
                        <Text style={styles.sectionTitle}>Estado de Ánimo</Text>
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
                            height={180}
                            chartConfig={{
                                ...chartConfig,
                                color: (opacity = 1) => `rgba(251, 191, 36, ${opacity})`,
                            }}
                            bezier
                            style={styles.chart}
                            yAxisInterval={1}
                            fromZero
                            segments={4}
                        />
                    ) : (
                        <View style={styles.noDataContainer}>
                            <Ionicons name="happy-outline" size={48} color="#475569" />
                            <Text style={styles.noDataText}>Registra tu ánimo para ver la tendencia</Text>
                        </View>
                    )}
                </View>

                {/* ═══════════════════════════════════════════════════════════════════════════
                    MACRO COMPLIANCE - 4 PIE CHARTS
                    ═══════════════════════════════════════════════════════════════════════════ */}
                <View style={styles.chartSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionIcon}>🍽️</Text>
                        <Text style={styles.sectionTitle}>Cumplimiento de Dieta</Text>
                    </View>

                    {macroCompliance ? (
                        <View style={styles.pieChartsGrid}>
                            <View style={styles.pieChartCard}>
                                <Text style={styles.pieCardEmoji}>🔥</Text>
                                <ProgressRing
                                    percentage={macroCompliance.kcal}
                                    color={macroCompliance.kcal >= 90 && macroCompliance.kcal <= 105 ? '#10B981' :
                                        macroCompliance.kcal >= 80 && macroCompliance.kcal <= 115 ? '#F59E0B' : '#EF4444'}
                                />
                                <Text style={styles.pieCardLabel}>Kcal</Text>
                            </View>
                            <View style={styles.pieChartCard}>
                                <Text style={styles.pieCardEmoji}>🥩</Text>
                                <ProgressRing
                                    percentage={macroCompliance.protein}
                                    color={macroCompliance.protein >= 90 && macroCompliance.protein <= 105 ? '#10B981' :
                                        macroCompliance.protein >= 80 && macroCompliance.protein <= 115 ? '#F59E0B' : '#EF4444'}
                                />
                                <Text style={styles.pieCardLabel}>Proteína</Text>
                            </View>
                            <View style={styles.pieChartCard}>
                                <Text style={styles.pieCardEmoji}>🍞</Text>
                                <ProgressRing
                                    percentage={macroCompliance.carbs}
                                    color={macroCompliance.carbs >= 90 && macroCompliance.carbs <= 105 ? '#10B981' :
                                        macroCompliance.carbs >= 80 && macroCompliance.carbs <= 115 ? '#F59E0B' : '#EF4444'}
                                />
                                <Text style={styles.pieCardLabel}>Carbos</Text>
                            </View>
                            <View style={styles.pieChartCard}>
                                <Text style={styles.pieCardEmoji}>🥑</Text>
                                <ProgressRing
                                    percentage={macroCompliance.fat}
                                    color={macroCompliance.fat >= 90 && macroCompliance.fat <= 105 ? '#10B981' :
                                        macroCompliance.fat >= 80 && macroCompliance.fat <= 115 ? '#F59E0B' : '#EF4444'}
                                />
                                <Text style={styles.pieCardLabel}>Grasa</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.noDataContainer}>
                            <Ionicons name="nutrition-outline" size={48} color="#475569" />
                            <Text style={styles.noDataText}>Registra tus macros para ver el cumplimiento</Text>
                        </View>
                    )}
                </View>

                {/* ═══════════════════════════════════════════════════════════════════════════
                    SLEEP CHART - BARS + LINE
                    ═══════════════════════════════════════════════════════════════════════════ */}
                <View style={styles.chartSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionIcon}>😴</Text>
                        <Text style={styles.sectionTitle}>Horas de Sueño</Text>
                        {avgSleep && (
                            <View style={[styles.avgBadge, { backgroundColor: parseFloat(avgSleep) >= 7 ? '#10b98120' : '#f59e0b20' }]}>
                                <Text style={[styles.avgBadgeText, { color: parseFloat(avgSleep) >= 7 ? '#10b981' : '#f59e0b' }]}>
                                    ⌀ {avgSleep}h
                                </Text>
                            </View>
                        )}
                    </View>

                    {sleepChartData ? (
                        <View style={styles.chartWrapper}>
                            <BarChart
                                data={sleepChartData}
                                width={chartWidth}
                                height={180}
                                chartConfig={{
                                    ...barChartConfig,
                                    color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                                }}
                                style={styles.chart}
                                yAxisSuffix="h"
                                showValuesOnTopOfBars
                                fromZero
                            />
                            <View style={styles.sleepLegend}>
                                <View style={[styles.sleepLegendDot, { backgroundColor: '#10b981' }]} />
                                <Text style={styles.sleepLegendText}>≥7h ideal</Text>
                                <View style={[styles.sleepLegendDot, { backgroundColor: '#f59e0b', marginLeft: 16 }]} />
                                <Text style={styles.sleepLegendText}>6-7h revisar</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.noDataContainer}>
                            <Ionicons name="bed-outline" size={48} color="#475569" />
                            <Text style={styles.noDataText}>Registra tus horas de sueño para ver patrones</Text>
                        </View>
                    )}
                </View>

                {/* ═══════════════════════════════════════════════════════════════════════════
                    HUNGER VS ADHERENCE
                    ═══════════════════════════════════════════════════════════════════════════ */}
                <View style={styles.chartSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionIcon}>🍽️</Text>
                        <Text style={styles.sectionTitle}>Hambre vs Adherencia</Text>
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
                            <View style={styles.insightBox}>
                                <Text style={styles.insightText}>{hungerInsight}</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.noDataContainer}>
                            <Ionicons name="analytics-outline" size={48} color="#475569" />
                            <Text style={styles.noDataText}>Completa check-ins semanales para ver correlaciones</Text>
                        </View>
                    )}
                </View>

                {/* Spacer at bottom */}
                <View style={{ height: 40 }} />
            </View>

            {/* ═══════════════════════════════════════════════════════════════════════════
                TARGET WEIGHT MODAL
                ═══════════════════════════════════════════════════════════════════════════ */}
            <Modal
                visible={targetWeightModal}
                transparent
                animationType="fade"
                onRequestClose={() => setTargetWeightModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>🎯 Peso Objetivo</Text>
                        <Text style={styles.modalSubtitle}>¿Cuál es tu meta de peso?</Text>

                        <View style={styles.modalInputRow}>
                            <TextInput
                                style={styles.modalInput}
                                value={newTargetWeight}
                                onChangeText={setNewTargetWeight}
                                placeholder="Ej: 75"
                                placeholderTextColor="#6B7280"
                                keyboardType="numeric"
                            />
                            <Text style={styles.modalInputSuffix}>kg</Text>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setTargetWeightModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalSaveBtn}
                                onPress={handleSaveTargetWeight}
                            >
                                <Text style={styles.modalSaveText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════════════
                GOAL REACHED MODAL
                ═══════════════════════════════════════════════════════════════════════════ */}
            <Modal
                visible={goalReachedModal}
                transparent
                animationType="fade"
                onRequestClose={() => setGoalReachedModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, styles.celebrationModal]}>
                        <Text style={styles.celebrationEmoji}>🎉🏆🎉</Text>
                        <Text style={styles.celebrationTitle}>¡FELICIDADES!</Text>
                        <Text style={styles.celebrationSubtitle}>Has alcanzado tu peso objetivo de {targetWeight} kg</Text>

                        <Text style={styles.celebrationText}>
                            ¡Increíble trabajo! Tu constancia ha dado frutos.
                            ¿Listo para un nuevo reto?
                        </Text>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setGoalReachedModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cerrar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSaveBtn, { backgroundColor: '#10b981' }]}
                                onPress={() => {
                                    setGoalReachedModal(false);
                                    setNewTargetWeight('');
                                    setTargetWeightModal(true);
                                }}
                            >
                                <Text style={styles.modalSaveText}>Nuevo Objetivo</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER COMPONENT STYLES (Static)
// ═══════════════════════════════════════════════════════════════════════════
const helperStyles = StyleSheet.create({
    // Pie Charts Grid
    pieChartItem: {
        alignItems: 'center',
        width: '25%',
    },
    pieChartEmoji: {
        fontSize: 20,
        marginBottom: 4,
    },
    pieChartCircleContainer: {
        width: 50,
        height: 50,
        marginVertical: 8,
    },
    pieChartCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pieChartBg: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 25,
        borderWidth: 4,
    },
    pieChartProgress: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 25,
        borderWidth: 4,
    },
    pieChartPercentage: {
        fontSize: 10,
        fontWeight: '700',
    },
    pieChartLabel: {
        color: '#9CA3AF', // Default fallback, but likely unused as layout structure
        fontSize: 10,
        textAlign: 'center',
    },
    pieChartStatus: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },

    // Progress Ring
    progressRing: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressRingBg: {
        position: 'absolute',
    },
    progressRingFill: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressRingText: {
        fontWeight: '700',
    },
});
