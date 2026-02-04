/* app/(app)/nutricion/index.jsx - Pantalla de Nutrición PROFESIONAL */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import ClientMealPlanView from './components/ClientMealPlanView';
import {
    calculateFullNutrition,
    ACTIVITY_FACTORS,
} from '../../../src/utils/nutritionCalculator';
import { getContrastColor } from '../../../utils/colors';

const { width } = Dimensions.get('window');

// Paleta de colores para días (fallback si no tiene color asignado)
const DAY_COLORS = [
    '#22c55e', // Verde
    '#3b82f6', // Azul
    '#f59e0b', // Naranja
    '#ef4444', // Rojo
    '#8b5cf6', // Morado
    '#06b6d4', // Cyan
];

// Componente de barra de progreso circular simplificada
const MacroCircle = ({ value, total, color, label, grams, theme }) => {
    const percentage = Math.min((value / total) * 100, 100);

    return (
        <View style={styles.macroCircleContainer}>
            <View style={[styles.macroCircleOuter, { borderColor: color + '30' }]}>
                <View style={[styles.macroCircleInner, { backgroundColor: color + '15' }]}>
                    <Text style={[styles.macroCircleValue, { color }]}>{grams}</Text>
                    <Text style={[styles.macroCircleUnit, { color: color + '99' }]}>g</Text>
                </View>
            </View>
            <Text style={[styles.macroCircleLabel, { color: theme?.textSecondary || '#94a3b8' }]}>{label}</Text>
            <Text style={[styles.macroCirclePercent, { color }]}>{Math.round(percentage)}%</Text>
        </View>
    );
};

// Componente de barra horizontal de macros
const MacroBar = ({ protein, fat, carbs, proteinKcal, fatKcal, carbsKcal, totalKcal, theme }) => {
    const pPct = (proteinKcal / totalKcal) * 100;
    const fPct = (fatKcal / totalKcal) * 100;
    const cPct = (carbsKcal / totalKcal) * 100;

    return (
        <View style={styles.macroBarContainer}>
            <View style={styles.macroBarTrack}>
                <View style={[styles.macroBarSegment, { backgroundColor: '#ef4444', flex: pPct }]} />
                <View style={[styles.macroBarSegment, { backgroundColor: '#f59e0b', flex: fPct }]} />
                <View style={[styles.macroBarSegment, { backgroundColor: '#3b82f6', flex: cPct }]} />
            </View>
            <View style={styles.macroBarLegend}>
                <View style={styles.macroBarLegendItem}>
                    <View style={[styles.macroBarLegendDot, { backgroundColor: '#ef4444' }]} />
                    <Text style={[styles.macroBarLegendText, { color: theme?.textSecondary || '#94a3b8' }]}>P {Math.round(pPct)}%</Text>
                </View>
                <View style={styles.macroBarLegendItem}>
                    <View style={[styles.macroBarLegendDot, { backgroundColor: '#f59e0b' }]} />
                    <Text style={[styles.macroBarLegendText, { color: theme?.textSecondary || '#94a3b8' }]}>G {Math.round(fPct)}%</Text>
                </View>
                <View style={styles.macroBarLegendItem}>
                    <View style={[styles.macroBarLegendDot, { backgroundColor: '#3b82f6' }]} />
                    <Text style={[styles.macroBarLegendText, { color: theme?.textSecondary || '#94a3b8' }]}>C {Math.round(cPct)}%</Text>
                </View>
            </View>
        </View>
    );
};

export default function NutricionScreen() {
    const router = useRouter();
    const { user, token } = useAuth();
    const { theme, isDark } = useTheme();

    const [isLoading, setIsLoading] = useState(true);
    const [userInfo, setUserInfo] = useState({});
    const [activityFactor, setActivityFactor] = useState(1.55);
    const [dataSource, setDataSource] = useState('cloud');

    // Estado para plan del coach
    const [coachPlan, setCoachPlan] = useState(null);
    const [clientSettings, setClientSettings] = useState({});
    const [todayTarget, setTodayTarget] = useState(null);
    const [planMode, setPlanMode] = useState('auto'); // 'auto' | 'custom'
    const [selectedDayIndex, setSelectedDayIndex] = useState(null); // Para ver otros días
    const [coachInfo, setCoachInfo] = useState(null); // Coach branding for PDF export

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    const isPremium = useMemo(() => {
        if (!user) return false;
        return ['PREMIUM', 'CLIENTE', 'ENTRENADOR', 'ADMINISTRADOR'].includes(user.tipoUsuario);
    }, [user?.tipoUsuario]);

    useEffect(() => {
        const loadUserData = async () => {
            setIsLoading(true);
            try {
                let currentMode = 'auto'; // Default local tracker

                // 1. Primero intentar cargar plan del coach (para cualquier premium)
                if (isPremium && token) {
                    try {
                        console.log('[Nutricion] Buscando plan del coach...');
                        const res = await fetch(`${API_URL}/api/nutrition-plans/my-plan`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const data = await res.json();
                        console.log('[Nutricion] Respuesta my-plan:', data);

                        // ACEPTAR 'custom' (Flex), 'complete' (Meal Plan) O 'mealplan'
                        if (data.success && data.plan && (data.mode === 'custom' || data.mode === 'complete' || data.mode === 'mealplan')) {
                            console.log('[Nutricion] ✅ Plan del coach encontrado:', data.mode);
                            setCoachPlan(data.plan);
                            setClientSettings(data.clientSettings || {});
                            setTodayTarget(data.todayTarget);
                            setCoachInfo(data.coachInfo || null); // Coach branding from API

                            const newMode = (data.mode === 'complete' || data.mode === 'mealplan') ? 'mealplan' : 'custom';
                            setPlanMode(newMode);
                            currentMode = newMode;

                            setDataSource('coach');
                        } else if (data.success && data.plan && data.plan.planType === 'auto') {
                            // Plan automático asignado por el coach
                            console.log('[Nutricion] ✅ Plan AUTO del coach encontrado');
                            currentMode = 'autoCoach';
                        } else {
                            console.log('[Nutricion] No hay plan activo compatible, usando auto');
                        }
                    } catch (e) {
                        console.log('[Nutricion] Error buscando plan:', e.message);
                    }
                }

                // 2. Cargar datos del usuario desde la nube (todos los usuarios)
                console.log('[Nutricion] Cargando info_user desde la nube...');
                setUserInfo(user?.info_user || {});
                setActivityFactor(user?.info_user?.af || 1.55);

                // Solo mostrar auto si NO es CLIENTE (los clientes ven mensaje de espera)
                // Si el coach asignó un plan auto, el cliente ve el modo auto en vez de espera
                if (currentMode !== 'custom' && currentMode !== 'mealplan') {
                    if (user?.tipoUsuario === 'CLIENTE' && currentMode !== 'autoCoach') {
                        setPlanMode('waiting');
                    }
                    setDataSource('cloud');
                }
                console.log('[Nutricion] Datos cargados. currentMode:', currentMode);

            } catch (error) {
                console.error('[Nutricion] Error cargando datos:', error);
                setUserInfo(user?.info_user || {});
                setActivityFactor(user?.info_user?.af || 1.55);
            } finally {
                console.log('[Nutricion] Setting isLoading false');
                setIsLoading(false);
            }
        };

        loadUserData();
    }, [user?._id, user?.tipoUsuario, token]);





    // Priorizar objetivoPrincipal (ganar_peso/definir/mantener) sobre objetivos (texto libre)
    const objetivo = userInfo.objetivoPrincipal || userInfo.objetivos || 'volumen';

    // Calcular nutrición (automática)
    const autoNutrition = useMemo(() => {
        return calculateFullNutrition(userInfo, objetivo, activityFactor);
    }, [userInfo, objetivo, activityFactor]);

    // Usar plan del coach o cálculo automático
    const nutrition = useMemo(() => {
        if (planMode === 'custom' && todayTarget) {
            // Convertir todayTarget a formato similar a autoNutrition
            const kcal = todayTarget.kcal || 0;
            const protein = todayTarget.protein_g || 0;
            const carbs = todayTarget.carbs_g || 0;
            const fat = todayTarget.fat_g || 0;

            return {
                bmr: autoNutrition?.bmr || 0,
                tdee: autoNutrition?.tdee || 0,
                activityFactor,
                objetivo: objetivo === 'ganar_peso' ? 'Volumen' : (objetivo === 'mantener' ? 'Mantenimiento' : 'Definición'),
                isVolumen: objetivo === 'ganar_peso' || objetivo?.includes?.('volumen') || objetivo?.includes?.('ganar'),
                isMantener: objetivo === 'mantener' || objetivo?.includes?.('mantener'),
                training: {
                    kcal,
                    protein,
                    carbs,
                    fat,
                    proteinKcal: protein * 4,
                    fatKcal: fat * 9,
                    carbsKcal: carbs * 4,
                    proteinPerKg: userInfo.peso ? (protein / userInfo.peso).toFixed(1) : 0,
                    fatPercent: kcal ? Math.round((fat * 9 / kcal) * 100) : 0,
                    water: {
                        liters: todayTarget.water_ml ? (todayTarget.water_ml / 1000).toFixed(1) : '---',
                        baseMl: todayTarget.water_ml || 0,
                        extraMl: 0,
                    },
                },
                rest: {
                    kcal,
                    protein,
                    carbs,
                    fat,
                    water: { liters: todayTarget.water_ml ? (todayTarget.water_ml / 1000).toFixed(1) : '---' },
                },
                steps: {
                    text: todayTarget.steps_target ? `${todayTarget.steps_target.toLocaleString()} pasos/día` : '---',
                    min: todayTarget.steps_target || 0,
                    max: todayTarget.steps_target || 0,
                },
                kcalDifference: 0,
                kcalDifferenceRest: 0,
                coachNotes: todayTarget.notes,
                dayName: todayTarget.name,
            };
        }
        return autoNutrition;
    }, [planMode, todayTarget, autoNutrition, userInfo, activityFactor]);

    // Si hay plan del coach, siempre hay datos; si no, depende del cálculo auto
    const hasData = planMode === 'custom' ? todayTarget !== null : nutrition !== null;
    // Colores: Volumen=Azul, Mantenimiento=Naranja, Definición=Rojo
    const objetivoColor = nutrition?.isVolumen ? '#3b82f6' : (nutrition?.isMantener ? '#f59e0b' : '#ef4444');
    const objetivoGradient = nutrition?.isVolumen
        ? ['#1e40af', '#3b82f6']
        : (nutrition?.isMantener
            ? ['#d97706', '#f59e0b']
            : ['#991b1b', '#ef4444']);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary || '#3b82f6'} />
                    <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                        Cargando tu plan...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // 🟢 NUEVA VISTA: Plan de Comidas Completo (Moved here to fix Hook Order)
    if (planMode === 'mealplan' && coachPlan) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <Stack.Screen options={{ headerShown: false }} />

                <ClientMealPlanView
                    plan={coachPlan}
                    todayTarget={todayTarget}
                    theme={theme}
                    user={user}
                    clientSettings={clientSettings}
                    coachInfo={coachInfo}
                />
            </SafeAreaView>
        );
    }

    // 🔒 CLIENTE sin plan asignado: mostrar mensaje de espera
    if (planMode === 'waiting') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={styles.waitingContainer}>
                    <Ionicons name="nutrition-outline" size={80} color={theme.textSecondary} />
                    <Text style={[styles.waitingTitle, { color: theme.text }]}>
                        Sin plan de nutrición
                    </Text>
                    <Text style={[styles.waitingText, { color: theme.textSecondary }]}>
                        Tu entrenador aún no te ha generado una rutina de nutrición. Sé paciente o contacta con él.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // 🔒 CLIENTE con plan auto pero sin datos de perfil: pedir que rellene datos
    if (user?.tipoUsuario === 'CLIENTE' && planMode === 'auto' && !hasData) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={styles.waitingContainer}>
                    <Ionicons name="body-outline" size={80} color={theme.textSecondary} />
                    <Text style={[styles.waitingTitle, { color: theme.text }]}>
                        Completa tu perfil
                    </Text>
                    <Text style={[styles.waitingText, { color: theme.textSecondary }]}>
                        Para ver tu rutina de nutrición, rellena tus datos personales.
                    </Text>
                    <TouchableOpacity
                        style={[styles.emptyButton, { backgroundColor: theme.primary }]}
                        onPress={() => router.push('/perfil/informacion-personal')}
                    >
                        <Ionicons name="person-add" size={20} color={getContrastColor(theme.primary)} />
                        <Text style={[styles.emptyButtonText, { color: getContrastColor(theme.primary) }]}>Rellenar Datos</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header compacto */}
                <View style={[styles.compactHeader, { borderBottomColor: theme.cardBorder }]}>
                    <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.cardBackground }]}>
                        <Ionicons name="arrow-back" size={22} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>🍎 Nutrición</Text>
                        <View style={styles.badgeRow}>
                            <View style={[styles.objetivoBadge, { backgroundColor: objetivoColor + '20' }]}>
                                <Ionicons
                                    name={nutrition?.isVolumen ? 'trending-up' : 'trending-down'}
                                    size={12}
                                    color={objetivoColor}
                                />
                                <Text style={[styles.objetivoBadgeText, { color: objetivoColor }]}>
                                    {nutrition?.objetivo || 'Volumen'}
                                </Text>
                            </View>
                            <View style={[
                                styles.planTypeBadge,
                                { backgroundColor: planMode === 'custom' ? '#8b5cf620' : '#64748b20' }
                            ]}>
                                <Ionicons
                                    name={planMode === 'custom' ? 'person' : 'calculator'}
                                    size={12}
                                    color={planMode === 'custom' ? '#8b5cf6' : '#64748b'}
                                />
                                <Text style={[
                                    styles.planTypeBadgeText,
                                    { color: planMode === 'custom' ? '#8b5cf6' : '#64748b' }
                                ]}>
                                    {planMode === 'custom' ? 'Coach' : 'Auto'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.headerRight} />
                </View>

                {!hasData ? (
                    <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                        <Ionicons name="alert-circle-outline" size={60} color={theme.textSecondary} />
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>Datos Incompletos</Text>
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                            Necesitamos tu edad, peso, altura y género para calcular tus necesidades.
                        </Text>
                        <TouchableOpacity
                            style={[styles.emptyButton, { backgroundColor: theme.primary }]}
                            onPress={() => router.push('/perfil/informacion-personal')}
                        >
                            <Ionicons name="person-add" size={20} color={getContrastColor(theme.primary)} />
                            <Text style={[styles.emptyButtonText, { color: getContrastColor(theme.primary) }]}>Completar Perfil</Text>
                        </TouchableOpacity>
                    </View>
                ) : planMode === 'custom' && todayTarget ? (
                    /* ═══════════════════════════════════════════════════════════════
                       VISTA PLAN DEL ENTRENADOR
                    ═══════════════════════════════════════════════════════════════ */
                    <>
                        {/* Plan Name & Description Header */}
                        {(coachPlan?.name || coachPlan?.description) && (
                            <View style={[styles.planInfoCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                                {coachPlan?.name && (
                                    <Text style={[styles.planInfoName, { color: theme.text }]}>{coachPlan.name}</Text>
                                )}
                                {coachPlan?.description && (
                                    <Text style={[styles.planInfoDescription, { color: theme.textSecondary }]}>{coachPlan.description}</Text>
                                )}
                            </View>
                        )}

                        {/* 📅 Weekly Schedule Preview */}
                        {(() => {
                            const WEEK_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                            const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
                            const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                            const activeIdx = selectedDayIndex !== null ? selectedDayIndex : todayIdx;

                            // Soportar tanto complete (customPlan.weekSchedule/dayTargets) como flex (weekMap/dayTemplates)
                            const weekSchedule = coachPlan?.customPlan?.weekSchedule || coachPlan?.weekMap;
                            const dayTargets = coachPlan?.customPlan?.dayTargets || coachPlan?.dayTemplates;

                            const dayId = weekSchedule?.[WEEK_KEYS[activeIdx]];
                            const rawDay = dayTargets?.find(d => d.id === dayId);
                            // Para flex, mapear targetMacros al formato esperado
                            const activeDay = rawDay?.targetMacros
                                ? { ...rawDay, kcal: rawDay.targetMacros.kcal, protein_g: rawDay.targetMacros.protein, carbs_g: rawDay.targetMacros.carbs, fat_g: rawDay.targetMacros.fat, water_ml: rawDay.targetMacros.water, steps_target: rawDay.targetMacros.steps, fiber_g: rawDay.targetMacros.fiber }
                                : (rawDay || todayTarget);

                            // Unique day types for legend
                            const dayTypes = [...new Map(
                                dayTargets?.map(d => [d.id, d]) || []
                            ).values()];

                            return (
                                <>
                                    <View style={[styles.weekPreviewCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                                        <Text style={[styles.weekPreviewTitle, { color: theme.text }]}>📅 Tu Semana</Text>

                                        {/* Legend */}
                                        <View style={styles.weekLegend}>
                                            {dayTypes.map((dt, i) => (
                                                <View key={dt.id} style={styles.weekLegendItem}>
                                                    <View style={[styles.weekLegendDot, { backgroundColor: dt.color || DAY_COLORS[i % DAY_COLORS.length] }]} />
                                                    <Text style={[styles.weekLegendText, { color: theme.textSecondary }]}>{dt.name || `Tipo ${i + 1}`}</Text>
                                                </View>
                                            ))}
                                        </View>

                                        {/* Week row - clickable */}
                                        <View style={styles.weekPreviewRow}>
                                            {WEEK_LABELS.map((day, idx) => {
                                                const dayIdForIdx = weekSchedule?.[WEEK_KEYS[idx]];
                                                const dayData = dayTargets?.find(d => d.id === dayIdForIdx);
                                                const dayTargetIdx = dayTargets?.findIndex(d => d.id === dayIdForIdx) ?? 0;
                                                const dayColor = dayData?.color || DAY_COLORS[dayTargetIdx % DAY_COLORS.length];
                                                const isToday = idx === todayIdx;
                                                const isSelected = idx === activeIdx;

                                                return (
                                                    <TouchableOpacity
                                                        key={day}
                                                        style={[
                                                            styles.weekPreviewDay,
                                                            { backgroundColor: dayColor },
                                                            isSelected && styles.weekPreviewDaySelected,
                                                            isToday && !isSelected && styles.weekPreviewDayToday
                                                        ]}
                                                        onPress={() => setSelectedDayIndex(idx)}
                                                    >
                                                        <Text style={[styles.weekPreviewDayLabel, { color: getContrastColor(dayColor) }]}>{day}</Text>
                                                        <Text style={[styles.weekPreviewDayName, { color: getContrastColor(dayColor) }]}>
                                                            {dayData?.name?.charAt(0) || '?'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>

                                    {/* 🎯 Día Seleccionado */}
                                    <View style={[styles.coachDayCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                                        <View style={[styles.coachDayHeader, { backgroundColor: activeDay?.color || '#22c55e' }]}>
                                            <Ionicons
                                                name={activeDay?.isTrainingDay ? 'barbell' : 'bed'}
                                                size={24}
                                                color={getContrastColor(activeDay?.color || '#22c55e')}
                                            />
                                            <View>
                                                <Text style={[styles.coachDayTitle, { color: getContrastColor(activeDay?.color || '#22c55e') }]}>{activeDay?.name || 'Sin asignar'}</Text>
                                                <Text style={[styles.coachDaySubtitle, { color: getContrastColor(activeDay?.color || '#22c55e') }]}>
                                                    {selectedDayIndex !== null
                                                        ? ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][activeIdx]
                                                        : 'Hoy'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* KCAL Grande */}
                                        <View style={styles.coachKcalRow}>
                                            <Text style={[styles.coachKcalValue, { color: theme.success }]}>{activeDay?.kcal || '---'}</Text>
                                            <Text style={[styles.coachKcalUnit, { color: theme.textSecondary }]}>kcal</Text>
                                        </View>

                                        {/* Macros */}
                                        <View style={styles.coachMacrosRow}>
                                            <View style={styles.coachMacroItem}>
                                                <Text style={[styles.coachMacroValue, { color: '#ef4444' }]}>
                                                    {activeDay?.protein_g || '---'}g
                                                </Text>
                                                <Text style={[styles.coachMacroLabel, { color: theme.textSecondary }]}>Proteína</Text>
                                            </View>
                                            <View style={styles.coachMacroItem}>
                                                <Text style={[styles.coachMacroValue, { color: '#3b82f6' }]}>
                                                    {activeDay?.carbs_g || '---'}g
                                                </Text>
                                                <Text style={[styles.coachMacroLabel, { color: theme.textSecondary }]}>Carbs</Text>
                                            </View>
                                            <View style={styles.coachMacroItem}>
                                                <Text style={[styles.coachMacroValue, { color: '#f59e0b' }]}>
                                                    {activeDay?.fat_g || '---'}g
                                                </Text>
                                                <Text style={[styles.coachMacroLabel, { color: theme.textSecondary }]}>Grasas</Text>
                                            </View>
                                        </View>

                                        {/* Extras Grid */}
                                        <View style={styles.coachExtrasGrid}>
                                            <View style={styles.coachExtraItem}>
                                                <Ionicons name="water" size={20} color="#0ea5e9" />
                                                <Text style={[styles.coachExtraValue, { color: theme.text }]}>
                                                    {activeDay?.water_ml ? `${(Number(activeDay.water_ml) / 1000).toFixed(1)}L` : '---'}
                                                </Text>
                                                <Text style={[styles.coachExtraLabel, { color: theme.textSecondary }]}>Agua</Text>
                                            </View>
                                            <View style={styles.coachExtraItem}>
                                                <Ionicons name="footsteps" size={20} color="#22c55e" />
                                                <Text style={[styles.coachExtraValue, { color: theme.text }]}>
                                                    {activeDay?.steps_target ? Number(activeDay.steps_target).toLocaleString() : '---'}
                                                </Text>
                                                <Text style={[styles.coachExtraLabel, { color: theme.textSecondary }]}>Pasos</Text>
                                            </View>
                                            <View style={styles.coachExtraItem}>
                                                <Ionicons name="leaf" size={20} color="#84cc16" />
                                                <Text style={[styles.coachExtraValue, { color: theme.text }]}>
                                                    {activeDay?.fiber_g ? `${activeDay.fiber_g}g` : '---'}
                                                </Text>
                                                <Text style={[styles.coachExtraLabel, { color: theme.textSecondary }]}>Fibra</Text>
                                            </View>
                                            <View style={styles.coachExtraItem}>
                                                <Ionicons name="flash" size={20} color="#a855f7" />
                                                <Text style={[styles.coachExtraValue, { color: theme.text }]}>
                                                    {activeDay?.sodium_mg ? `${activeDay.sodium_mg}mg` : '---'}
                                                </Text>
                                                <Text style={[styles.coachExtraLabel, { color: theme.textSecondary }]}>Sal</Text>
                                            </View>
                                        </View>

                                        {/* Notas del coach */}
                                        {activeDay?.notes && (
                                            <View style={[styles.coachNotesBox, { backgroundColor: theme.premium + '15', borderColor: theme.premium + '30' }]}>
                                                <Ionicons name="chatbubble-ellipses" size={16} color={theme.premium} />
                                                <Text style={[styles.coachNotesText, { color: theme.textSecondary }]}>{activeDay.notes}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Footer Coach */}
                                    <View style={[styles.coachFooter, { backgroundColor: theme.premium + '10' }]}>
                                        <Ionicons name="person-circle" size={20} color={theme.premium} />
                                        <Text style={[styles.coachFooterText, { color: theme.premium }]}>
                                            Dieta puesta por tu entrenador
                                        </Text>
                                    </View>
                                </>
                            );
                        })()}
                    </>
                ) : (
                    /* ═══════════════════════════════════════════════════════════════
                       VISTA MODO AUTO (BMR/TDEE)
                    ═══════════════════════════════════════════════════════════════ */
                    <>
                        {/* 🎯 Card Principal KCAL */}
                        <View style={[styles.mainCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                            <View style={styles.mainCardHeader}>
                                <View style={styles.mainCardIcon}>
                                    <Text style={styles.mainCardEmoji}>🔥</Text>
                                </View>
                                <Text style={[styles.mainCardTitle, { color: theme.text }]}>Calorías Diarias</Text>
                            </View>

                            {/* Big number */}
                            <View style={styles.bigNumberContainer}>
                                <Text style={[styles.bigNumber, { color: objetivoColor }]}>
                                    {nutrition.training.kcal.toLocaleString()}
                                </Text>
                                <Text style={[styles.bigNumberUnit, { color: theme.textSecondary }]}>kcal/día</Text>
                            </View>

                            {/* Breakdown */}
                            <View style={[styles.kcalBreakdown, { backgroundColor: theme.inputBackground }]}>
                                <View style={styles.kcalBreakdownItem}>
                                    <Text style={[styles.kcalBreakdownLabel, { color: theme.textSecondary }]}>BMR</Text>
                                    <Text style={[styles.kcalBreakdownValue, { color: theme.text }]}>{nutrition.bmr}</Text>
                                </View>
                                <View style={[styles.kcalBreakdownDivider, { backgroundColor: theme.cardBorder }]} />
                                <View style={styles.kcalBreakdownItem}>
                                    <Text style={[styles.kcalBreakdownLabel, { color: theme.textSecondary }]}>TDEE</Text>
                                    <Text style={[styles.kcalBreakdownValue, { color: theme.text }]}>{nutrition.tdee}</Text>
                                </View>
                                <View style={[styles.kcalBreakdownDivider, { backgroundColor: theme.cardBorder }]} />
                                <View style={styles.kcalBreakdownItem}>
                                    <Text style={[styles.kcalBreakdownLabel, { color: theme.textSecondary }]}>Ajuste</Text>
                                    <Text style={[styles.kcalBreakdownValue, { color: objetivoColor }]}>
                                        {nutrition.kcalDifference > 0 ? '+' : ''}{nutrition.kcalDifference}
                                    </Text>
                                </View>
                            </View>

                            {/* AF Badge */}
                            <View style={styles.afContainer}>
                                <Ionicons name="fitness" size={14} color={theme.textSecondary} />
                                <Text style={[styles.afText, { color: theme.textSecondary }]}>
                                    AF {nutrition.activityFactor} • {ACTIVITY_FACTORS[nutrition.activityFactor]?.split('(')[0] || 'Personalizado'}
                                </Text>
                            </View>
                        </View>

                        {/* 🥩 Card Macros Visual */}
                        <View style={[styles.macrosCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardEmoji}>🥩</Text>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Macronutrientes</Text>
                            </View>

                            {/* Macro circles */}
                            <View style={styles.macroCirclesRow}>
                                <MacroCircle
                                    value={nutrition.training.proteinKcal}
                                    total={nutrition.training.kcal}
                                    color="#ef4444"
                                    label="Proteína"
                                    grams={nutrition.training.protein}
                                    theme={theme}
                                />
                                <MacroCircle
                                    value={nutrition.training.fatKcal}
                                    total={nutrition.training.kcal}
                                    color="#f59e0b"
                                    label="Grasas"
                                    grams={nutrition.training.fat}
                                    theme={theme}
                                />
                                <MacroCircle
                                    value={nutrition.training.carbsKcal}
                                    total={nutrition.training.kcal}
                                    color="#3b82f6"
                                    label="Carbos"
                                    grams={nutrition.training.carbs}
                                    theme={theme}
                                />
                            </View>

                            {/* Macro bar */}
                            <MacroBar
                                protein={nutrition.training.protein}
                                fat={nutrition.training.fat}
                                carbs={nutrition.training.carbs}
                                proteinKcal={nutrition.training.proteinKcal}
                                fatKcal={nutrition.training.fatKcal}
                                carbsKcal={nutrition.training.carbsKcal}
                                totalKcal={nutrition.training.kcal}
                                theme={theme}
                            />

                            {/* Details */}
                            <View style={[styles.macroDetails, { borderTopColor: theme.cardBorder }]}>
                                <View style={styles.macroDetailRow}>
                                    <Text style={[styles.macroDetailLabel, { color: theme.text }]}>🥩 Proteína</Text>
                                    <Text style={[styles.macroDetailValue, { color: theme.textSecondary }]}>
                                        {nutrition.training.protein}g ({nutrition.training.proteinPerKg}g/kg)
                                    </Text>
                                </View>
                                <View style={styles.macroDetailRow}>
                                    <Text style={[styles.macroDetailLabel, { color: theme.text }]}>🥑 Grasas</Text>
                                    <Text style={[styles.macroDetailValue, { color: theme.textSecondary }]}>
                                        {nutrition.training.fat}g ({nutrition.training.fatPercent}%)
                                    </Text>
                                </View>
                                <View style={styles.macroDetailRow}>
                                    <Text style={[styles.macroDetailLabel, { color: theme.text }]}>🍚 Carbohidratos</Text>
                                    <Text style={[styles.macroDetailValue, { color: theme.textSecondary }]}>
                                        {nutrition.training.carbs}g (resto)
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Para Definición: mostrar diferencia días */}
                        {!nutrition.isVolumen && (
                            <View style={[styles.defCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                                <Text style={[styles.defCardTitle, { color: theme.text }]}>📊 Ajuste por tipo de día</Text>
                                <View style={styles.defColumns}>
                                    <View style={[styles.defColumn, { backgroundColor: theme.success + '20' }]}>
                                        <Ionicons name="barbell" size={24} color={theme.success} />
                                        <Text style={[styles.defColumnLabel, { color: theme.textSecondary }]}>Entrenamiento</Text>
                                        <Text style={[styles.defColumnValue, { color: theme.success }]}>
                                            {nutrition.training.kcal}
                                        </Text>
                                        <Text style={[styles.defColumnUnit, { color: theme.textSecondary }]}>kcal ({nutrition.kcalDifference})</Text>
                                    </View>
                                    <View style={[styles.defColumn, { backgroundColor: theme.textSecondary + '20' }]}>
                                        <Ionicons name="bed" size={24} color={theme.textSecondary} />
                                        <Text style={[styles.defColumnLabel, { color: theme.textSecondary }]}>Descanso</Text>
                                        <Text style={[styles.defColumnValue, { color: theme.textSecondary }]}>
                                            {nutrition.rest.kcal}
                                        </Text>
                                        <Text style={[styles.defColumnUnit, { color: theme.textSecondary }]}>kcal ({nutrition.kcalDifferenceRest})</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* 💧 Card Hidratación */}
                        <View style={[styles.waterCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardEmoji}>💧</Text>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Hidratación</Text>
                            </View>

                            <View style={styles.waterGrid}>
                                <LinearGradient
                                    colors={['#0369a1', '#0ea5e9']}
                                    style={styles.waterBox}
                                >
                                    <Ionicons name="barbell" size={20} color="#fff" />
                                    <Text style={styles.waterBoxLabel}>Día Entreno</Text>
                                    <Text style={styles.waterBoxValue}>{nutrition.training.water.liters}L</Text>
                                    <Text style={styles.waterBoxFormula}>
                                        {Math.round(nutrition.training.water.baseMl / 1000 * 10) / 10}L + {Math.round(nutrition.training.water.extraMl / 1000 * 10) / 10}L
                                    </Text>
                                </LinearGradient>

                                <View style={[styles.waterBoxRest, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                                    <Ionicons name="bed" size={20} color={theme.textSecondary} />
                                    <Text style={[styles.waterBoxLabel, { color: theme.textSecondary }]}>Descanso</Text>
                                    <Text style={[styles.waterBoxValue, { color: theme.text }]}>
                                        {nutrition.rest.water.liters}L
                                    </Text>
                                    <Text style={[styles.waterBoxFormula, { color: theme.textSecondary }]}>Base</Text>
                                </View>
                            </View>
                        </View>

                        {/* 👟 Card Pasos */}
                        <LinearGradient
                            colors={objetivoGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.stepsCard}
                        >
                            <View style={styles.stepsContent}>
                                <Text style={styles.stepsEmoji}>👟</Text>
                                <View style={styles.stepsInfo}>
                                    <Text style={styles.stepsTitle}>Pasos Diarios</Text>
                                    <Text style={styles.stepsValue}>{nutrition.steps.text}</Text>
                                    <Text style={styles.stepsSubtitle}>
                                        Recomendación para {nutrition.objetivo}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.stepsTip}>
                                💡 Intenta aumentar pasos los días de descanso para mantener el NEAT
                            </Text>
                        </LinearGradient>

                        {/* Info footer */}
                        <View style={styles.infoFooter}>
                            <Ionicons name="information-circle" size={16} color={theme.textSecondary} />
                            <Text style={[styles.infoFooterText, { color: theme.textSecondary }]}>
                                Calculado para {userInfo.genero}, {userInfo.edad} años, {userInfo.peso}kg, {userInfo.altura}m
                            </Text>
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0f1a',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#94a3b8',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },

    // Compact Header
    compactHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#f1f5f9',
    },
    objetivoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
        marginTop: 4,
    },
    objetivoBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    planTypeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    planTypeBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    headerRight: {
        width: 36,
    },
    dataSourceBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ═══════════════════════════════════════════════
    // COACH PLAN VIEW STYLES
    // ═══════════════════════════════════════════════
    planInfoCard: {
        margin: 20,
        marginBottom: 0,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#8b5cf615',
        borderWidth: 1,
        borderColor: '#8b5cf630',
    },
    planInfoName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#f1f5f9',
        marginBottom: 4,
    },
    planInfoDescription: {
        fontSize: 14,
        color: '#94a3b8',
        lineHeight: 20,
    },
    weekPreviewCard: {
        margin: 20,
        marginBottom: 12,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1e293b',
    },
    weekPreviewTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94a3b8',
        marginBottom: 12,
    },
    weekLegend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 12,
    },
    weekLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    weekLegendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    weekLegendText: {
        fontSize: 11,
        color: '#94a3b8',
    },
    weekPreviewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 4,
    },
    weekPreviewDay: {
        // Calculate: screenWidth - margins(40) - cardPadding(32) - gaps(4*6=24) = available width / 7
        flex: 1,
        maxWidth: 44,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 10,
    },
    weekPreviewDayToday: {
        borderWidth: 2,
        borderColor: '#fff',
        opacity: 0.7,
    },
    weekPreviewDaySelected: {
        borderWidth: 3,
        borderColor: '#fbbf24',
        transform: [{ scale: 1.1 }],
    },
    weekPreviewDayLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
        opacity: 0.8,
    },
    weekPreviewDayName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#fff',
        marginTop: 2,
    },
    coachDayCard: {
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: 20,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1e293b',
        overflow: 'hidden',
    },
    coachDayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    coachDayTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    coachDaySubtitle: {
        fontSize: 12,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    coachKcalRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        paddingVertical: 24,
        gap: 8,
    },
    coachKcalValue: {
        fontSize: 52,
        fontWeight: '800',
        color: '#22c55e',
    },
    coachKcalUnit: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748b',
    },
    coachMacrosRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
        marginHorizontal: 20,
    },
    coachMacroItem: {
        alignItems: 'center',
    },
    coachMacroValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    coachMacroLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    coachExtrasGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 20,
    },
    coachExtraItem: {
        alignItems: 'center',
    },
    coachExtraValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#f1f5f9',
        marginTop: 6,
    },
    coachExtraLabel: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    coachNotesBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#1e1b4b',
        margin: 16,
        marginTop: 0,
        padding: 14,
        borderRadius: 12,
        gap: 10,
    },
    coachNotesText: {
        flex: 1,
        fontSize: 13,
        color: '#c4b5fd',
        lineHeight: 20,
    },
    coachFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
        marginBottom: 20,
    },
    coachFooterText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8b5cf6',
    },

    // Empty state
    emptyCard: {
        margin: 20,
        padding: 40,
        borderRadius: 20,
        backgroundColor: '#111827',
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#f1f5f9',
        marginTop: 16,
    },
    emptyText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 22,
    },
    emptyButton: {
        marginTop: 24,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3b82f6',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    emptyButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },

    // Main KCAL Card
    mainCard: {
        margin: 20,
        marginTop: 16,
        padding: 24,
        borderRadius: 24,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1e293b',
    },
    mainCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    mainCardIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    mainCardEmoji: {
        fontSize: 24,
    },
    mainCardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#f1f5f9',
    },
    bigNumberContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    bigNumber: {
        fontSize: 56,
        fontWeight: '800',
    },
    bigNumberUnit: {
        fontSize: 16,
        color: '#64748b',
        marginTop: -4,
    },
    kcalBreakdown: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
    },
    kcalBreakdownItem: {
        alignItems: 'center',
    },
    kcalBreakdownLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    kcalBreakdownValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#e2e8f0',
    },
    kcalBreakdownDivider: {
        width: 1,
        backgroundColor: '#1e293b',
    },
    afContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
        gap: 6,
    },
    afText: {
        fontSize: 12,
        color: '#64748b',
    },

    // Macros Card
    macrosCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        padding: 20,
        borderRadius: 20,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1e293b',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 10,
    },
    cardEmoji: {
        fontSize: 24,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#f1f5f9',
    },
    macroCirclesRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
    },
    macroCircleContainer: {
        alignItems: 'center',
    },
    macroCircleOuter: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
    },
    macroCircleInner: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    macroCircleValue: {
        fontSize: 20,
        fontWeight: '800',
    },
    macroCircleUnit: {
        fontSize: 10,
        marginTop: -2,
    },
    macroCircleLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 8,
    },
    macroCirclePercent: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    macroBarContainer: {
        marginBottom: 16,
    },
    macroBarTrack: {
        flexDirection: 'row',
        height: 12,
        borderRadius: 6,
        overflow: 'hidden',
    },
    macroBarSegment: {
        height: '100%',
    },
    macroBarLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 10,
        gap: 16,
    },
    macroBarLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    macroBarLegendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    macroBarLegendText: {
        fontSize: 11,
        color: '#94a3b8',
    },
    macroDetails: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
    },
    macroDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    macroDetailLabel: {
        fontSize: 14,
        color: '#94a3b8',
    },
    macroDetailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#e2e8f0',
    },

    // Definition adjustment card
    defCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        padding: 20,
        borderRadius: 20,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1e293b',
    },
    defCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#f1f5f9',
        marginBottom: 16,
        textAlign: 'center',
    },
    defColumns: {
        flexDirection: 'row',
        gap: 12,
    },
    defColumn: {
        flex: 1,
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
    },
    defColumnLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 8,
    },
    defColumnValue: {
        fontSize: 24,
        fontWeight: '800',
        marginTop: 4,
    },
    defColumnUnit: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },

    // Water Card
    waterCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        padding: 20,
        borderRadius: 20,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1e293b',
    },
    waterGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    waterBox: {
        flex: 1,
        alignItems: 'center',
        padding: 20,
        borderRadius: 16,
    },
    waterBoxRest: {
        flex: 1,
        alignItems: 'center',
        padding: 20,
        borderRadius: 16,
        backgroundColor: '#1e293b',
    },
    waterBoxLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 8,
    },
    waterBoxValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        marginTop: 4,
    },
    waterBoxFormula: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 4,
    },

    // Steps Card
    stepsCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        padding: 20,
        borderRadius: 20,
    },
    stepsContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepsEmoji: {
        fontSize: 40,
        marginRight: 16,
    },
    stepsInfo: {
        flex: 1,
    },
    stepsTitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    stepsValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff',
        marginTop: 2,
    },
    stepsSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    stepsTip: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 16,
        textAlign: 'center',
        fontStyle: 'italic',
    },

    // Waiting (CLIENTE sin plan)
    waitingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    waitingTitle: {
        fontSize: 22,
        fontWeight: '800',
        marginTop: 24,
        textAlign: 'center',
    },
    waitingText: {
        fontSize: 15,
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 24,
    },

    // Info Footer
    infoFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        gap: 6,
    },
    infoFooterText: {
        fontSize: 11,
        color: '#64748b',
    },
});
