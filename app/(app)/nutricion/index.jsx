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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import {
    calculateFullNutrition,
    ACTIVITY_FACTORS,
} from '../../../src/utils/nutritionCalculator';

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
const MacroCircle = ({ value, total, color, label, grams }) => {
    const percentage = Math.min((value / total) * 100, 100);

    return (
        <View style={styles.macroCircleContainer}>
            <View style={[styles.macroCircleOuter, { borderColor: color + '30' }]}>
                <View style={[styles.macroCircleInner, { backgroundColor: color + '15' }]}>
                    <Text style={[styles.macroCircleValue, { color }]}>{grams}</Text>
                    <Text style={[styles.macroCircleUnit, { color: color + '99' }]}>g</Text>
                </View>
            </View>
            <Text style={styles.macroCircleLabel}>{label}</Text>
            <Text style={[styles.macroCirclePercent, { color }]}>{Math.round(percentage)}%</Text>
        </View>
    );
};

// Componente de barra horizontal de macros
const MacroBar = ({ protein, fat, carbs, proteinKcal, fatKcal, carbsKcal, totalKcal }) => {
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
                    <Text style={styles.macroBarLegendText}>P {Math.round(pPct)}%</Text>
                </View>
                <View style={styles.macroBarLegendItem}>
                    <View style={[styles.macroBarLegendDot, { backgroundColor: '#f59e0b' }]} />
                    <Text style={styles.macroBarLegendText}>G {Math.round(fPct)}%</Text>
                </View>
                <View style={styles.macroBarLegendItem}>
                    <View style={[styles.macroBarLegendDot, { backgroundColor: '#3b82f6' }]} />
                    <Text style={styles.macroBarLegendText}>C {Math.round(cPct)}%</Text>
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
    const [todayTarget, setTodayTarget] = useState(null);
    const [planMode, setPlanMode] = useState('auto'); // 'auto' | 'custom'
    const [selectedDayIndex, setSelectedDayIndex] = useState(null); // Para ver otros días

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    const isPremium = useMemo(() => {
        if (!user) return false;
        return ['PREMIUM', 'CLIENTE', 'ENTRENADOR', 'ADMINISTRADOR'].includes(user.tipoUsuario);
    }, [user]);

    useEffect(() => {
        const loadUserData = async () => {
            setIsLoading(true);
            try {
                // 1. Primero intentar cargar plan del coach (para cualquier premium)
                if (isPremium && token) {
                    try {
                        console.log('[Nutricion] Buscando plan del coach...');
                        const res = await fetch(`${API_URL}/api/nutrition-plans/my-plan`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const data = await res.json();
                        console.log('[Nutricion] Respuesta my-plan:', data);
                        if (data.success && data.plan && data.mode === 'custom') {
                            console.log('[Nutricion] ✅ Plan personalizado del coach encontrado');
                            setCoachPlan(data.plan);
                            setTodayTarget(data.todayTarget);
                            setPlanMode('custom');
                            setDataSource('coach');
                        } else {
                            console.log('[Nutricion] No hay plan custom activo, usando auto');
                        }
                    } catch (e) {
                        console.log('[Nutricion] Error buscando plan:', e.message);
                    }
                }

                // 2. Cargar datos del usuario desde la nube (todos los usuarios)
                console.log('[Nutricion] Cargando info_user desde la nube...');
                setUserInfo(user?.info_user || {});
                setActivityFactor(user?.info_user?.af || 1.55);
                if (planMode !== 'custom') setDataSource('cloud');
            } catch (error) {
                console.error('[Nutricion] Error cargando datos:', error);
                setUserInfo(user?.info_user || {});
                setActivityFactor(user?.info_user?.af || 1.55);
            } finally {
                setIsLoading(false);
            }
        };

        loadUserData();
    }, [user, isPremium, token]);

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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#0a0f1a' }]}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header compacto */}
                <View style={styles.compactHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color="#94a3b8" />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>🍎 Nutrición</Text>
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
                    <View style={styles.emptyCard}>
                        <Ionicons name="alert-circle-outline" size={60} color="#64748b" />
                        <Text style={styles.emptyTitle}>Datos Incompletos</Text>
                        <Text style={styles.emptyText}>
                            Necesitamos tu edad, peso, altura y género para calcular tus necesidades.
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyButton}
                            onPress={() => router.push('/perfil/informacion-personal')}
                        >
                            <Ionicons name="person-add" size={20} color="#fff" />
                            <Text style={styles.emptyButtonText}>Completar Perfil</Text>
                        </TouchableOpacity>
                    </View>
                ) : planMode === 'custom' && todayTarget ? (
                    /* ═══════════════════════════════════════════════════════════════
                       VISTA PLAN DEL ENTRENADOR
                    ═══════════════════════════════════════════════════════════════ */
                    <>
                        {/* Plan Name & Description Header */}
                        {(coachPlan?.name || coachPlan?.description) && (
                            <View style={styles.planInfoCard}>
                                {coachPlan?.name && (
                                    <Text style={styles.planInfoName}>{coachPlan.name}</Text>
                                )}
                                {coachPlan?.description && (
                                    <Text style={styles.planInfoDescription}>{coachPlan.description}</Text>
                                )}
                            </View>
                        )}

                        {/* 📅 Weekly Schedule Preview */}
                        {(() => {
                            const WEEK_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                            const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
                            const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                            const activeIdx = selectedDayIndex !== null ? selectedDayIndex : todayIdx;

                            const dayId = coachPlan?.customPlan?.weekSchedule?.[WEEK_KEYS[activeIdx]];
                            const activeDay = coachPlan?.customPlan?.dayTargets?.find(d => d.id === dayId) || todayTarget;

                            // Unique day types for legend
                            const dayTypes = [...new Map(
                                coachPlan?.customPlan?.dayTargets?.map(d => [d.id, d]) || []
                            ).values()];

                            return (
                                <>
                                    <View style={styles.weekPreviewCard}>
                                        <Text style={styles.weekPreviewTitle}>📅 Tu Semana</Text>

                                        {/* Legend */}
                                        <View style={styles.weekLegend}>
                                            {dayTypes.map((dt, i) => (
                                                <View key={dt.id} style={styles.weekLegendItem}>
                                                    <View style={[styles.weekLegendDot, { backgroundColor: dt.color || DAY_COLORS[i % DAY_COLORS.length] }]} />
                                                    <Text style={styles.weekLegendText}>{dt.name || `Tipo ${i + 1}`}</Text>
                                                </View>
                                            ))}
                                        </View>

                                        {/* Week row - clickable */}
                                        <View style={styles.weekPreviewRow}>
                                            {WEEK_LABELS.map((day, idx) => {
                                                const dayIdForIdx = coachPlan?.customPlan?.weekSchedule?.[WEEK_KEYS[idx]];
                                                const dayData = coachPlan?.customPlan?.dayTargets?.find(d => d.id === dayIdForIdx);
                                                const dayTargetIdx = coachPlan?.customPlan?.dayTargets?.findIndex(d => d.id === dayIdForIdx) ?? 0;
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
                                                        <Text style={styles.weekPreviewDayLabel}>{day}</Text>
                                                        <Text style={styles.weekPreviewDayName}>
                                                            {dayData?.name?.charAt(0) || '?'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>

                                    {/* 🎯 Día Seleccionado */}
                                    <View style={styles.coachDayCard}>
                                        <View style={[styles.coachDayHeader, { backgroundColor: activeDay?.color || '#22c55e' }]}>
                                            <Ionicons
                                                name={activeDay?.isTrainingDay ? 'barbell' : 'bed'}
                                                size={24}
                                                color="#fff"
                                            />
                                            <View>
                                                <Text style={styles.coachDayTitle}>{activeDay?.name || 'Sin asignar'}</Text>
                                                <Text style={styles.coachDaySubtitle}>
                                                    {selectedDayIndex !== null
                                                        ? ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][activeIdx]
                                                        : 'Hoy'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* KCAL Grande */}
                                        <View style={styles.coachKcalRow}>
                                            <Text style={styles.coachKcalValue}>{activeDay?.kcal || '---'}</Text>
                                            <Text style={styles.coachKcalUnit}>kcal</Text>
                                        </View>

                                        {/* Macros */}
                                        <View style={styles.coachMacrosRow}>
                                            <View style={styles.coachMacroItem}>
                                                <Text style={[styles.coachMacroValue, { color: '#ef4444' }]}>
                                                    {activeDay?.protein_g || '---'}g
                                                </Text>
                                                <Text style={styles.coachMacroLabel}>Proteína</Text>
                                            </View>
                                            <View style={styles.coachMacroItem}>
                                                <Text style={[styles.coachMacroValue, { color: '#3b82f6' }]}>
                                                    {activeDay?.carbs_g || '---'}g
                                                </Text>
                                                <Text style={styles.coachMacroLabel}>Carbs</Text>
                                            </View>
                                            <View style={styles.coachMacroItem}>
                                                <Text style={[styles.coachMacroValue, { color: '#f59e0b' }]}>
                                                    {activeDay?.fat_g || '---'}g
                                                </Text>
                                                <Text style={styles.coachMacroLabel}>Grasas</Text>
                                            </View>
                                        </View>

                                        {/* Extras Grid */}
                                        <View style={styles.coachExtrasGrid}>
                                            <View style={styles.coachExtraItem}>
                                                <Ionicons name="water" size={20} color="#0ea5e9" />
                                                <Text style={styles.coachExtraValue}>
                                                    {activeDay?.water_ml ? `${(Number(activeDay.water_ml) / 1000).toFixed(1)}L` : '---'}
                                                </Text>
                                                <Text style={styles.coachExtraLabel}>Agua</Text>
                                            </View>
                                            <View style={styles.coachExtraItem}>
                                                <Ionicons name="footsteps" size={20} color="#22c55e" />
                                                <Text style={styles.coachExtraValue}>
                                                    {activeDay?.steps_target ? Number(activeDay.steps_target).toLocaleString() : '---'}
                                                </Text>
                                                <Text style={styles.coachExtraLabel}>Pasos</Text>
                                            </View>
                                            <View style={styles.coachExtraItem}>
                                                <Ionicons name="leaf" size={20} color="#84cc16" />
                                                <Text style={styles.coachExtraValue}>
                                                    {activeDay?.fiber_g ? `${activeDay.fiber_g}g` : '---'}
                                                </Text>
                                                <Text style={styles.coachExtraLabel}>Fibra</Text>
                                            </View>
                                            <View style={styles.coachExtraItem}>
                                                <Ionicons name="flash" size={20} color="#a855f7" />
                                                <Text style={styles.coachExtraValue}>
                                                    {activeDay?.sodium_mg ? `${activeDay.sodium_mg}mg` : '---'}
                                                </Text>
                                                <Text style={styles.coachExtraLabel}>Sal</Text>
                                            </View>
                                        </View>

                                        {/* Notas del coach */}
                                        {activeDay?.notes && (
                                            <View style={styles.coachNotesBox}>
                                                <Ionicons name="chatbubble-ellipses" size={16} color="#8b5cf6" />
                                                <Text style={styles.coachNotesText}>{activeDay.notes}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Footer Coach */}
                                    <View style={styles.coachFooter}>
                                        <Ionicons name="person-circle" size={20} color="#8b5cf6" />
                                        <Text style={styles.coachFooterText}>
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
                        <View style={styles.mainCard}>
                            <View style={styles.mainCardHeader}>
                                <View style={styles.mainCardIcon}>
                                    <Text style={styles.mainCardEmoji}>🔥</Text>
                                </View>
                                <Text style={styles.mainCardTitle}>Calorías Diarias</Text>
                            </View>

                            {/* Big number */}
                            <View style={styles.bigNumberContainer}>
                                <Text style={[styles.bigNumber, { color: objetivoColor }]}>
                                    {nutrition.training.kcal.toLocaleString()}
                                </Text>
                                <Text style={styles.bigNumberUnit}>kcal/día</Text>
                            </View>

                            {/* Breakdown */}
                            <View style={styles.kcalBreakdown}>
                                <View style={styles.kcalBreakdownItem}>
                                    <Text style={styles.kcalBreakdownLabel}>BMR</Text>
                                    <Text style={styles.kcalBreakdownValue}>{nutrition.bmr}</Text>
                                </View>
                                <View style={styles.kcalBreakdownDivider} />
                                <View style={styles.kcalBreakdownItem}>
                                    <Text style={styles.kcalBreakdownLabel}>TDEE</Text>
                                    <Text style={styles.kcalBreakdownValue}>{nutrition.tdee}</Text>
                                </View>
                                <View style={styles.kcalBreakdownDivider} />
                                <View style={styles.kcalBreakdownItem}>
                                    <Text style={styles.kcalBreakdownLabel}>Ajuste</Text>
                                    <Text style={[styles.kcalBreakdownValue, { color: objetivoColor }]}>
                                        {nutrition.kcalDifference > 0 ? '+' : ''}{nutrition.kcalDifference}
                                    </Text>
                                </View>
                            </View>

                            {/* AF Badge */}
                            <View style={styles.afContainer}>
                                <Ionicons name="fitness" size={14} color="#64748b" />
                                <Text style={styles.afText}>
                                    AF {nutrition.activityFactor} • {ACTIVITY_FACTORS[nutrition.activityFactor]?.split('(')[0] || 'Personalizado'}
                                </Text>
                            </View>
                        </View>

                        {/* 🥩 Card Macros Visual */}
                        <View style={styles.macrosCard}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardEmoji}>🥩</Text>
                                <Text style={styles.cardTitle}>Macronutrientes</Text>
                            </View>

                            {/* Macro circles */}
                            <View style={styles.macroCirclesRow}>
                                <MacroCircle
                                    value={nutrition.training.proteinKcal}
                                    total={nutrition.training.kcal}
                                    color="#ef4444"
                                    label="Proteína"
                                    grams={nutrition.training.protein}
                                />
                                <MacroCircle
                                    value={nutrition.training.fatKcal}
                                    total={nutrition.training.kcal}
                                    color="#f59e0b"
                                    label="Grasas"
                                    grams={nutrition.training.fat}
                                />
                                <MacroCircle
                                    value={nutrition.training.carbsKcal}
                                    total={nutrition.training.kcal}
                                    color="#3b82f6"
                                    label="Carbos"
                                    grams={nutrition.training.carbs}
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
                            />

                            {/* Details */}
                            <View style={styles.macroDetails}>
                                <View style={styles.macroDetailRow}>
                                    <Text style={styles.macroDetailLabel}>🥩 Proteína</Text>
                                    <Text style={styles.macroDetailValue}>
                                        {nutrition.training.protein}g ({nutrition.training.proteinPerKg}g/kg)
                                    </Text>
                                </View>
                                <View style={styles.macroDetailRow}>
                                    <Text style={styles.macroDetailLabel}>🥑 Grasas</Text>
                                    <Text style={styles.macroDetailValue}>
                                        {nutrition.training.fat}g ({nutrition.training.fatPercent}%)
                                    </Text>
                                </View>
                                <View style={styles.macroDetailRow}>
                                    <Text style={styles.macroDetailLabel}>🍚 Carbohidratos</Text>
                                    <Text style={styles.macroDetailValue}>
                                        {nutrition.training.carbs}g (resto)
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Para Definición: mostrar diferencia días */}
                        {!nutrition.isVolumen && (
                            <View style={styles.defCard}>
                                <Text style={styles.defCardTitle}>📊 Ajuste por tipo de día</Text>
                                <View style={styles.defColumns}>
                                    <View style={[styles.defColumn, { backgroundColor: '#10b98120' }]}>
                                        <Ionicons name="barbell" size={24} color="#10b981" />
                                        <Text style={styles.defColumnLabel}>Entrenamiento</Text>
                                        <Text style={[styles.defColumnValue, { color: '#10b981' }]}>
                                            {nutrition.training.kcal}
                                        </Text>
                                        <Text style={styles.defColumnUnit}>kcal ({nutrition.kcalDifference})</Text>
                                    </View>
                                    <View style={[styles.defColumn, { backgroundColor: '#64748b20' }]}>
                                        <Ionicons name="bed" size={24} color="#64748b" />
                                        <Text style={styles.defColumnLabel}>Descanso</Text>
                                        <Text style={[styles.defColumnValue, { color: '#64748b' }]}>
                                            {nutrition.rest.kcal}
                                        </Text>
                                        <Text style={styles.defColumnUnit}>kcal ({nutrition.kcalDifferenceRest})</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* 💧 Card Hidratación */}
                        <View style={styles.waterCard}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardEmoji}>💧</Text>
                                <Text style={styles.cardTitle}>Hidratación</Text>
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

                                <View style={styles.waterBoxRest}>
                                    <Ionicons name="bed" size={20} color="#64748b" />
                                    <Text style={[styles.waterBoxLabel, { color: '#64748b' }]}>Descanso</Text>
                                    <Text style={[styles.waterBoxValue, { color: '#94a3b8' }]}>
                                        {nutrition.rest.water.liters}L
                                    </Text>
                                    <Text style={styles.waterBoxFormula}>Base</Text>
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
                            <Ionicons name="information-circle" size={16} color="#64748b" />
                            <Text style={styles.infoFooterText}>
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
        paddingBottom: 32,
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
        gap: Math.min(6, width * 0.015),
    },
    weekPreviewDay: {
        width: (width - 40 - 6 * 6) / 7, // (screenWidth - padding - gaps) / 7 days
        minWidth: 36,
        maxWidth: 60,
        alignItems: 'center',
        paddingVertical: Math.min(10, width * 0.025),
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
