/* app/(app)/seguimiento/index.jsx - Sistema de Seguimiento Completo */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Pressable,
    Platform,
    useWindowDimensions,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useAchievements } from '../../../context/AchievementsContext';
import { calculateFullNutrition } from '../../../src/utils/nutritionCalculator';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES REUTILIZABLES
// ═══════════════════════════════════════════════════════════════════════════

// Sección expandible (Accordion)
const ExpandableSection = ({ title, icon, children, expanded, onToggle, color = '#3B82F6' }) => (
    <View style={styles.accordionContainer}>
        <TouchableOpacity
            style={[styles.accordionHeader, { borderLeftColor: color }]}
            onPress={onToggle}
            activeOpacity={0.7}
        >
            <View style={styles.accordionTitleRow}>
                <Text style={styles.accordionIcon}>{icon}</Text>
                <Text style={styles.accordionTitle}>{title}</Text>
            </View>
            <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#9CA3AF"
            />
        </TouchableOpacity>
        {expanded && (
            <View style={styles.accordionContent}>
                {children}
            </View>
        )}
    </View>
);

// Campo numérico simple
const NumberInput = ({ label, value, onChangeText, placeholder, suffix = '' }) => (
    <View style={styles.inputRow}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.inputWrapper}>
            <TextInput
                style={styles.numberInput}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
            />
            {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
        </View>
    </View>
);

// Campo de medición compacto (para filas de 2)
const MeasureInput = ({ label, value, onChangeText, placeholder }) => (
    <View style={styles.measureItem}>
        <Text style={styles.measureLabel}>{label}</Text>
        <View style={styles.measureInputRow}>
            <TextInput
                style={styles.measureInput}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
            />
            <Text style={styles.measureSuffix}>cm</Text>
        </View>
    </View>
);

// Selector de escala (1-5 o 1-10)
const ScaleSelector = ({ label, value, onChange, max = 5, labels = [] }) => (
    <View style={styles.scaleContainer}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.scaleRow}>
            {Array.from({ length: max }, (_, i) => i + 1).map((num) => (
                <TouchableOpacity
                    key={num}
                    style={[
                        styles.scaleBtn,
                        value === num && styles.scaleBtnActive
                    ]}
                    onPress={() => onChange(num)}
                >
                    <Text style={[
                        styles.scaleBtnText,
                        value === num && styles.scaleBtnTextActive
                    ]}>
                        {num}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
        {labels.length > 0 && (
            <View style={styles.scaleLabels}>
                <Text style={styles.scaleLabelText}>{labels[0]}</Text>
                <Text style={styles.scaleLabelText}>{labels[1]}</Text>
            </View>
        )}
    </View>
);

// Selector de ánimo con emojis
const MoodSelector = ({ value, onChange }) => {
    const moods = [
        { emoji: '😢', label: 'Mal', value: 1 },
        { emoji: '😕', label: 'Regular', value: 2 },
        { emoji: '😐', label: 'Normal', value: 3 },
        { emoji: '🙂', label: 'Bien', value: 4 },
        { emoji: '😄', label: 'Genial', value: 5 },
    ];

    return (
        <View style={styles.moodContainer}>
            <Text style={styles.inputLabel}>Ánimo</Text>
            <View style={styles.moodRow}>
                {moods.map((mood) => (
                    <TouchableOpacity
                        key={mood.value}
                        style={[
                            styles.moodBtn,
                            value === mood.value && styles.moodBtnActive
                        ]}
                        onPress={() => onChange(mood.value)}
                    >
                        <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                        <Text style={[
                            styles.moodLabel,
                            value === mood.value && styles.moodLabelActive
                        ]}>
                            {mood.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

// Selector Sí/Medio/No
const TripleChoice = ({ label, value, onChange }) => {
    const options = [
        { label: '✅ Sí', value: 'si', color: '#10B981' },
        { label: '🤔 Medio', value: 'medio', color: '#F59E0B' },
        { label: '❌ No', value: 'no', color: '#EF4444' },
    ];

    return (
        <View style={styles.tripleContainer}>
            <Text style={styles.inputLabel}>{label}</Text>
            <View style={styles.tripleRow}>
                {options.map((opt) => (
                    <TouchableOpacity
                        key={opt.value}
                        style={[
                            styles.tripleBtn,
                            value === opt.value && { backgroundColor: opt.color + '30', borderColor: opt.color }
                        ]}
                        onPress={() => onChange(opt.value)}
                    >
                        <Text style={[
                            styles.tripleBtnText,
                            value === opt.value && { color: opt.color }
                        ]}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

// Campo de texto para comentarios
const CommentInput = ({ label, value, onChangeText, placeholder }) => (
    <View style={styles.commentContainer}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TextInput
            style={styles.commentInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={2}
        />
    </View>
);

// Separador de subsección
const SubsectionTitle = ({ title, icon }) => (
    <View style={styles.subsectionHeader}>
        <Text style={styles.subsectionIcon}>{icon}</Text>
        <Text style={styles.subsectionTitle}>{title}</Text>
    </View>
);

// ═══════════════════════════════════════════════════════════════════════════
// CALENDARIO MENSUAL
// ═══════════════════════════════════════════════════════════════════════════

const DAYS_OF_WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * Calendario mensual que muestra días con datos
 * @param {Set} dailyDates - Fechas con datos diarios (formato 'YYYY-MM-DD')
 * @param {Set} weeklyDates - Fechas de inicio de semana con check-in semanal
 */
const MonthlyCalendar = ({ dailyDates = new Set(), weeklyDates = new Set() }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Primer día del mes (0=domingo, 1=lunes...)
    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay() - 1; // Ajustar para que lunes sea 0
    if (startDay < 0) startDay = 6;

    // Días en el mes
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Generar array de días
    const days = [];
    // Espacios vacíos antes del primer día
    for (let i = 0; i < startDay; i++) {
        days.push({ day: null, key: `empty-${i}` });
    }
    // Días del mes
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const hasDaily = dailyDates.has(dateStr);
        const hasWeekly = weeklyDates.has(dateStr);
        const isToday = new Date().toISOString().split('T')[0] === dateStr;
        days.push({ day: d, dateStr, hasDaily, hasWeekly, isToday, key: dateStr });
    }

    const goToPrevMonth = () => {
        setCurrentMonth(new Date(year, month - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentMonth(new Date(year, month + 1, 1));
    };

    return (
        <View style={styles.calendarContainer}>
            {/* Header con navegación */}
            <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={goToPrevMonth} style={styles.calendarArrow}>
                    <Ionicons name="chevron-back" size={24} color="#9CA3AF" />
                </TouchableOpacity>
                <Text style={styles.calendarMonthText}>
                    {MONTHS[month]} {year}
                </Text>
                <TouchableOpacity onPress={goToNextMonth} style={styles.calendarArrow}>
                    <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
                </TouchableOpacity>
            </View>

            {/* Días de la semana */}
            <View style={styles.calendarWeekHeader}>
                {DAYS_OF_WEEK.map(day => (
                    <Text key={day} style={styles.calendarWeekDay}>{day}</Text>
                ))}
            </View>

            {/* Grid de días */}
            <View style={styles.calendarGrid}>
                {days.map(({ day, hasDaily, hasWeekly, isToday, key }) => (
                    <View key={key} style={styles.calendarDayCell}>
                        {day !== null ? (
                            <View style={[
                                styles.calendarDay,
                                isToday && styles.calendarDayToday
                            ]}>
                                <Text style={[
                                    styles.calendarDayText,
                                    isToday && styles.calendarDayTextToday
                                ]}>
                                    {day}
                                </Text>
                                {/* Indicadores */}
                                <View style={styles.calendarIndicators}>
                                    {hasDaily && <View style={styles.calendarDotDaily} />}
                                    {hasWeekly && <View style={styles.calendarDotWeekly} />}
                                </View>
                            </View>
                        ) : null}
                    </View>
                ))}
            </View>

            {/* Leyenda */}
            <View style={styles.calendarLegend}>
                <View style={styles.calendarLegendItem}>
                    <View style={[styles.calendarDotDaily, { marginRight: 4 }]} />
                    <Text style={styles.calendarLegendText}>Diario</Text>
                </View>
                <View style={styles.calendarLegendItem}>
                    <View style={[styles.calendarDotWeekly, { marginRight: 4 }]} />
                    <Text style={styles.calendarLegendText}>Semanal</Text>
                </View>
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE DE MACROS CON CUADRADOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula el color según la desviación del objetivo
 * @param {number} consumed - Valor consumido
 * @param {number} target - Valor objetivo
 * @returns {string} Color hex
 */
const getDeviationColor = (consumed, target) => {
    if (!target || target === 0 || consumed === null || consumed === undefined || consumed === '') {
        return '#6B7280'; // Gris si no hay datos
    }
    const deviation = Math.abs((consumed - target) / target);
    if (deviation <= 0.05) return '#10B981'; // Verde - dentro del 5%
    if (deviation <= 0.10) return '#F59E0B'; // Naranja - 5-10%
    return '#EF4444'; // Rojo - más del 10%
};

/**
 * Input GRANDE para Kcal - Prominente al top
 */
const KcalBigInput = ({ value, target, onChangeText }) => {
    const numValue = parseFloat(value) || 0;
    const numTarget = parseFloat(target) || 0;
    const percentage = numTarget > 0 ? Math.min((numValue / numTarget) * 100, 100) : 0;
    const color = getDeviationColor(numValue, numTarget);

    return (
        <View style={styles.kcalBigContainer}>
            <View style={styles.kcalHeader}>
                <Text style={styles.kcalEmoji}>🔥</Text>
                <Text style={styles.kcalLabel}>Calorías</Text>
                {numTarget > 0 && (
                    <Text style={[styles.kcalPercentage, { color }]}>
                        {Math.round(percentage)}%
                    </Text>
                )}
            </View>
            <View style={styles.kcalInputRow}>
                <TextInput
                    style={[styles.kcalInput, { borderColor: color }]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder="0"
                    placeholderTextColor="#6B7280"
                    keyboardType="numeric"
                />
                <Text style={styles.kcalUnit}>kcal</Text>
            </View>
            {numTarget > 0 && (
                <View style={styles.kcalProgressContainer}>
                    <View style={styles.kcalProgressBg}>
                        <View style={[styles.kcalProgressFill, { width: `${percentage}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={styles.kcalTargetText}>de {numTarget} kcal</Text>
                </View>
            )}
        </View>
    );
};

/**
 * Input COMPACTO para Macros - Solo borde con color
 */
const CompactMacroInput = ({ label, value, target, onChangeText, emoji }) => {
    const numValue = parseFloat(value) || 0;
    const numTarget = parseFloat(target) || 0;
    const color = getDeviationColor(numValue, numTarget);

    return (
        <View style={styles.compactMacroItem}>
            <Text style={styles.compactMacroEmoji}>{emoji}</Text>
            <TextInput
                style={[styles.compactMacroInput, { borderColor: color }]}
                value={value}
                onChangeText={onChangeText}
                placeholder="0"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
            />
            <Text style={styles.compactMacroLabel}>{label}</Text>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function SeguimientoScreen() {
    const { user, token } = useAuth();
    const { processDailyCheckin, processWeeklyCheckin } = useAchievements();

    // Estados de secciones expandidas
    const [diarioExpanded, setDiarioExpanded] = useState(false);
    const [semanalExpanded, setSemanalExpanded] = useState(false);
    const [nutricionExpanded, setNutricionExpanded] = useState(false);

    // Modal cámara
    const [cameraModalVisible, setCameraModalVisible] = useState(false);

    // ─────────────────────────────────────────────────────────────────────────
    // ESTADOS DATOS MÍNIMOS (Siempre visibles)
    // ─────────────────────────────────────────────────────────────────────────
    const [minimalData, setMinimalData] = useState({
        peso: '',
        animo: 3,
        kcalConsumed: '',
        proteinConsumed: '',
        carbsConsumed: '',
        fatConsumed: '',
    });
    const [minimalDataSaved, setMinimalDataSaved] = useState(false);
    const [minimalDataLoading, setMinimalDataLoading] = useState(true);

    // Objetivos de nutrición (cargados del sistema)
    const [nutritionTargets, setNutritionTargets] = useState({
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ESTADOS CALENDARIO
    // ─────────────────────────────────────────────────────────────────────────
    const [filledDailyDates, setFilledDailyDates] = useState(new Set());
    const [filledWeeklyDates, setFilledWeeklyDates] = useState(new Set());

    // ─────────────────────────────────────────────────────────────────────────
    // ESTADOS CHECK-IN DIARIO
    // ─────────────────────────────────────────────────────────────────────────
    const [diario, setDiario] = useState({
        peso: '',
        sueno: '',
        animo: 3,
        energia: 3,
        hambre: 3,
        pasos: '',
        haIdoBien: '',
        nota: '',
        // Macros (pre-rellenados desde datos mínimos)
        kcalConsumed: '',
        proteinConsumed: '',
        carbsConsumed: '',
        fatConsumed: '',
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ESTADOS CHECK-IN SEMANAL
    // ─────────────────────────────────────────────────────────────────────────
    const [semanal, setSemanal] = useState({
        // Nutrición
        nutriAdherencia: 5,
        nutriSaciedad: 3,
        nutriGI: 3,
        nutriDeposiciones: 3,
        nutriComidasLibres: '',
        nutriComentario: '',
        // Entrenamiento
        entrenoAdherencia: 5,
        entrenoRendimiento: 5,
        entrenoFatiga: 3,
        entrenoMolestias: false,
        entrenoMolestiasTexto: '',
        entrenoComentario: '',
        // Sensaciones
        sensMotivacion: 3,
        sensEstres: 3,
        sensEmocional: 3,
        sensSuenoMedio: '',
        sensComentario: '',
        // Reflexión
        topMejorar: '',
        topBien: '',
        // Mediciones
        medCuello: '',
        medHombros: '',
        medPecho: '',
        medCintura: '',
        medPierna: '',
        medGemelo: '',
    });

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS
    // ─────────────────────────────────────────────────────────────────────────
    const updateDiario = (key, value) => setDiario(prev => ({ ...prev, [key]: value }));
    const updateSemanal = (key, value) => setSemanal(prev => ({ ...prev, [key]: value }));
    const updateMinimalData = (key, value) => setMinimalData(prev => ({ ...prev, [key]: value }));

    // Verificar si es usuario premium (no FREEUSER)
    const isPremium = useMemo(() => {
        if (!user) return false;
        return ['PREMIUM', 'CLIENTE', 'ENTRENADOR', 'ADMINISTRADOR'].includes(user.tipoUsuario);
    }, [user]);

    // ─────────────────────────────────────────────────────────────────────────
    // CARGAR OBJETIVOS DE NUTRICIÓN Y DATOS DEL DÍA
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const loadNutritionAndData = async () => {
            setMinimalDataLoading(true);
            try {
                const today = new Date().toISOString().split('T')[0];

                // 1. Cargar objetivos de nutrición
                if (isPremium && token) {
                    try {
                        // Intentar cargar plan del coach primero
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
                            // Si no hay plan del coach, calcular automáticamente
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
                        console.log('[Seguimiento] Error cargando nutrición:', e.message);
                    }
                } else {
                    // Para FREEUSER, calcular automáticamente
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

                // 2. Cargar datos del día actual
                if (user?.tipoUsuario === 'FREEUSER') {
                    // Cargar desde AsyncStorage
                    const storageKey = `minimal_data_${today}`;
                    const saved = await AsyncStorage.getItem(storageKey);
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        setMinimalData(parsed);
                        setMinimalDataSaved(true);
                        // Pre-rellenar diario
                        setDiario(prev => ({
                            ...prev,
                            peso: parsed.peso || '',
                            animo: parsed.animo || 3,
                            kcalConsumed: parsed.kcalConsumed || '',
                            proteinConsumed: parsed.proteinConsumed || '',
                            carbsConsumed: parsed.carbsConsumed || '',
                            fatConsumed: parsed.fatConsumed || '',
                        }));
                    }
                } else if (token) {
                    // Cargar desde la nube
                    try {
                        const res = await axios.get(`/monitoring/daily?startDate=${today}&endDate=${today}`);
                        if (res.data?.data?.length > 0) {
                            const todayData = res.data.data[0];
                            setMinimalData({
                                peso: todayData.peso?.toString() || '',
                                animo: todayData.animo || 3,
                                kcalConsumed: todayData.kcalConsumed?.toString() || '',
                                proteinConsumed: todayData.proteinConsumed?.toString() || '',
                                carbsConsumed: todayData.carbsConsumed?.toString() || '',
                                fatConsumed: todayData.fatConsumed?.toString() || '',
                            });
                            setMinimalDataSaved(true);
                            // Pre-rellenar diario
                            setDiario(prev => ({
                                ...prev,
                                peso: todayData.peso?.toString() || '',
                                animo: todayData.animo || 3,
                                sueno: todayData.sueno?.toString() || '',
                                energia: todayData.energia || 3,
                                hambre: todayData.hambre || 3,
                                pasos: todayData.pasos?.toString() || '',
                                haIdoBien: todayData.haIdoBien || '',
                                nota: todayData.nota || '',
                                kcalConsumed: todayData.kcalConsumed?.toString() || '',
                                proteinConsumed: todayData.proteinConsumed?.toString() || '',
                                carbsConsumed: todayData.carbsConsumed?.toString() || '',
                                fatConsumed: todayData.fatConsumed?.toString() || '',
                            }));
                        }
                    } catch (e) {
                        console.log('[Seguimiento] Error cargando datos del día:', e.message);
                    }
                }
            } catch (error) {
                console.error('[Seguimiento] Error cargando datos:', error);
            } finally {
                setMinimalDataLoading(false);
            }
        };

        loadNutritionAndData();
    }, [user, token, isPremium]);

    // ─────────────────────────────────────────────────────────────────────────
    // CARGAR FECHAS PARA EL CALENDARIO
    // ─────────────────────────────────────────────────────────────────────────
    const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);

    useEffect(() => {
        const loadCalendarDates = async () => {
            try {
                const dailySet = new Set();
                const weeklySet = new Set();

                if (user?.tipoUsuario === 'FREEUSER') {
                    // Cargar desde AsyncStorage
                    const daysKey = 'daily_monitoring_days';
                    const weeksKey = 'weekly_monitoring_weeks';

                    const savedDays = await AsyncStorage.getItem(daysKey);
                    const savedWeeks = await AsyncStorage.getItem(weeksKey);

                    if (savedDays) {
                        JSON.parse(savedDays).forEach(d => dailySet.add(d));
                    }
                    if (savedWeeks) {
                        JSON.parse(savedWeeks).forEach(w => weeklySet.add(w));
                    }

                    // También verificar minimal_data guardados
                    const today = new Date();
                    for (let i = 0; i < 90; i++) { // Últimos 90 días
                        const d = new Date(today);
                        d.setDate(d.getDate() - i);
                        const dateStr = d.toISOString().split('T')[0];
                        const minimalKey = `minimal_data_${dateStr}`;
                        const minimalData = await AsyncStorage.getItem(minimalKey);
                        if (minimalData) {
                            dailySet.add(dateStr);
                        }
                    }
                    console.log('[Calendar] FREEUSER - Días cargados:', dailySet.size);
                } else if (token) {
                    // Cargar desde la nube - últimos 90 días
                    const endDate = new Date().toISOString().split('T')[0];
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - 90);
                    const startDateStr = startDate.toISOString().split('T')[0];

                    try {
                        const res = await fetch(`${API_URL}/api/monitoring/daily?startDate=${startDateStr}&endDate=${endDate}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const data = await res.json();
                        if (data?.data) {
                            data.data.forEach(entry => {
                                if (entry.date) {
                                    dailySet.add(entry.date.split('T')[0]);
                                }
                            });
                        }
                        console.log('[Calendar] Cloud - Días cargados:', dailySet.size);
                    } catch (e) {
                        console.log('[Calendar] Error cargando datos diarios:', e.message);
                    }

                    try {
                        const resWeekly = await fetch(`${API_URL}/api/monitoring/weekly?limit=20`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const dataWeekly = await resWeekly.json();
                        if (dataWeekly?.data) {
                            dataWeekly.data.forEach(entry => {
                                if (entry.weekStartDate) {
                                    weeklySet.add(entry.weekStartDate.split('T')[0]);
                                }
                            });
                        }
                        console.log('[Calendar] Cloud - Semanas cargadas:', weeklySet.size);
                    } catch (e) {
                        console.log('[Calendar] Error cargando datos semanales:', e.message);
                    }
                }

                setFilledDailyDates(dailySet);
                setFilledWeeklyDates(weeklySet);
            } catch (error) {
                console.error('[Calendar] Error cargando fechas:', error);
            }
        };

        if (user) {
            loadCalendarDates();
        }
    }, [user, token, calendarRefreshTrigger]);

    // ─────────────────────────────────────────────────────────────────────────
    // GUARDAR DATOS MÍNIMOS
    // ─────────────────────────────────────────────────────────────────────────
    const handleGuardarMinimalData = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const dataToSave = { ...minimalData, date: today };

            if (user?.tipoUsuario === 'FREEUSER') {
                // Guardar en local
                const storageKey = `minimal_data_${today}`;
                await AsyncStorage.setItem(storageKey, JSON.stringify(dataToSave));

                // Sincronizar peso al perfil local
                if (minimalData.peso && parseFloat(minimalData.peso) > 0) {
                    await AsyncStorage.setItem('USER_PESO', String(minimalData.peso));
                }
            } else {
                // Guardar en la nube
                await axios.post('/monitoring/daily', dataToSave);
            }

            // Pre-rellenar el check-in diario
            setDiario(prev => ({
                ...prev,
                peso: minimalData.peso,
                animo: minimalData.animo,
                kcalConsumed: minimalData.kcalConsumed,
                proteinConsumed: minimalData.proteinConsumed,
                carbsConsumed: minimalData.carbsConsumed,
                fatConsumed: minimalData.fatConsumed,
            }));

            setMinimalDataSaved(true);
            // Refrescar calendario para mostrar el día actual
            setCalendarRefreshTrigger(prev => prev + 1);
            Alert.alert('✅ Guardado', 'Datos básicos guardados correctamente');
        } catch (error) {
            console.error('[SEGUIMIENTO] Error guardando datos mínimos:', error);
            Alert.alert('Error', 'No se pudieron guardar los datos básicos');
        }
    };

    // Valores iniciales para resetear
    const initialDiario = {
        peso: '',
        sueno: '',
        animo: 3,
        energia: 3,
        hambre: 3,
        pasos: '',
        haIdoBien: '',
        nota: '',
        kcalConsumed: '',
        proteinConsumed: '',
        carbsConsumed: '',
        fatConsumed: '',
    };

    const initialSemanal = {
        nutriAdherencia: 5,
        nutriSaciedad: 3,
        nutriGI: 3,
        nutriDeposiciones: 3,
        nutriComidasLibres: '',
        nutriComentario: '',
        entrenoAdherencia: 5,
        entrenoRendimiento: 5,
        entrenoFatiga: 3,
        entrenoMolestias: false,
        entrenoMolestiasTexto: '',
        entrenoComentario: '',
        sensMotivacion: 3,
        sensEstres: 3,
        sensEmocional: 3,
        sensSuenoMedio: '',
        sensComentario: '',
        topMejorar: '',
        topBien: '',
        medCuello: '',
        medHombros: '',
        medPecho: '',
        medCintura: '',
        medPierna: '',
        medGemelo: '',
    };

    const handleGuardarDiario = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const dataToSave = { ...diario, date: today };

            if (user?.tipoUsuario === 'FREEUSER') {
                // Guardar en local (AsyncStorage)
                const storageKey = `daily_monitoring_${today}`;
                await AsyncStorage.setItem(storageKey, JSON.stringify(dataToSave));

                // También guardar en lista de días registrados
                const daysKey = 'daily_monitoring_days';
                const existingDays = await AsyncStorage.getItem(daysKey);
                const days = existingDays ? JSON.parse(existingDays) : [];
                if (!days.includes(today)) {
                    days.push(today);
                    await AsyncStorage.setItem(daysKey, JSON.stringify(days));
                }

                // 📌 Sincronizar peso al perfil local del usuario
                if (diario.peso && parseFloat(diario.peso) > 0) {
                    await AsyncStorage.setItem('USER_PESO', String(diario.peso));
                }
            } else {
                // Guardar en la nube (backend sincroniza peso automáticamente)
                await axios.post('/monitoring/daily', dataToSave);
            }

            // 🏆 Procesar logros de seguimiento (siempre, independiente de donde se guarde)
            const unlockedAchievements = processDailyCheckin(diario);

            if (unlockedAchievements && unlockedAchievements.length > 0) {
                Alert.alert('🏆 ¡Logro desbloqueado!',
                    `Has desbloqueado: ${unlockedAchievements.map(a => a.name).join(', ')}`);
            } else {
                Alert.alert('✅ Guardado', 'Check-in diario guardado correctamente');
            }

            // Refrescar calendario
            setCalendarRefreshTrigger(prev => prev + 1);
            // Resetear campos
            setDiario(initialDiario);
        } catch (error) {
            console.error('[SEGUIMIENTO] Error guardando diario:', error);
            Alert.alert('Error', 'No se pudo guardar el check-in diario');
        }
    };

    const handleGuardarSemanal = async () => {
        try {
            // Calcular inicio de semana (lunes)
            const now = new Date();
            const dayOfWeek = now.getDay();
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - diff);
            const weekKey = weekStart.toISOString().split('T')[0];

            const dataToSave = { ...semanal, weekStartDate: weekKey };

            if (user?.tipoUsuario === 'FREEUSER') {
                // Guardar en local (AsyncStorage)
                const storageKey = `weekly_monitoring_${weekKey}`;
                await AsyncStorage.setItem(storageKey, JSON.stringify(dataToSave));

                // También guardar en lista de semanas registradas
                const weeksKey = 'weekly_monitoring_weeks';
                const existingWeeks = await AsyncStorage.getItem(weeksKey);
                const weeks = existingWeeks ? JSON.parse(existingWeeks) : [];
                if (!weeks.includes(weekKey)) {
                    weeks.push(weekKey);
                    await AsyncStorage.setItem(weeksKey, JSON.stringify(weeks));
                }

                // 📌 Recalcular AF localmente para FREEUSER
                try {
                    const { computeAF } = await import('../../../src/utils/afCalculator');

                    // Obtener pasos de los últimos 7 días
                    let totalPasos = 0;
                    let daysWithPasos = 0;
                    for (let i = 0; i < 7; i++) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const dateKey = d.toISOString().split('T')[0];
                        const dailyData = await AsyncStorage.getItem(`daily_monitoring_${dateKey}`);
                        if (dailyData) {
                            const parsed = JSON.parse(dailyData);
                            if (parsed.pasos && parseFloat(parsed.pasos) > 0) {
                                totalPasos += parseFloat(parsed.pasos);
                                daysWithPasos++;
                            }
                        }
                    }
                    const pasosMedia = daysWithPasos > 0 ? Math.round(totalPasos / daysWithPasos) : 0;

                    // Contar días de entreno (workouts guardados)
                    const workoutDaysStr = await AsyncStorage.getItem('workout_days_this_week');
                    const entrenosFuerzaSemana = workoutDaysStr ? JSON.parse(workoutDaysStr).length : 0;

                    // Cardio del perfil (usar valor por defecto si no existe)
                    const cardio = 'moderado'; // TODO: obtener de perfil local

                    const af = computeAF({ pasosMedia, cardio, entrenosFuerzaSemana });
                    await AsyncStorage.setItem('USER_AF', String(af));
                    await AsyncStorage.setItem('USER_PASOS_MEDIA', String(pasosMedia));
                } catch (afError) {
                    console.log('[AF] Error calculando AF local:', afError);
                }
            } else {
                // Guardar en la nube
                await axios.post('/monitoring/weekly', dataToSave);

                // 📌 Recalcular AF en el servidor
                try {
                    await axios.post('/monitoring/recalculate-af');
                } catch (afError) {
                    console.log('[AF] Error recalculando AF:', afError);
                }
            }

            // 🏆 Procesar logros de seguimiento semanal
            const unlockedAchievements = processWeeklyCheckin(semanal);

            if (unlockedAchievements && unlockedAchievements.length > 0) {
                Alert.alert('🏆 ¡Logro desbloqueado!',
                    `Has desbloqueado: ${unlockedAchievements.map(a => a.name).join(', ')}`);
            } else {
                Alert.alert('✅ Guardado', 'Check-in semanal guardado correctamente');
            }

            // Refrescar calendario
            setCalendarRefreshTrigger(prev => prev + 1);
            // Resetear campos
            setSemanal(initialSemanal);
        } catch (error) {
            console.error('[SEGUIMIENTO] Error guardando semanal:', error);
            Alert.alert('Error', 'No se pudo guardar el check-in semanal');
        }
    };

    return (
        <View style={styles.root}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#0B1220', '#0D1B2A', '#111827']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* Blobs decorativos */}
            <View style={[styles.blob, styles.blobTop]} />
            <View style={[styles.blob, styles.blobBottom]} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>📏 Seguimiento</Text>
                    <Text style={styles.headerSubtitle}>Registra tu progreso diario y semanal</Text>
                </View>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* SECCIÓN DATOS MÍNIMOS (Siempre visible) */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <View style={styles.minimalDataCard}>
                    <View style={styles.minimalDataHeader}>
                        <Text style={styles.minimalDataIcon}>📊</Text>
                        <Text style={styles.minimalDataTitle}>Datos de Hoy</Text>
                        {minimalDataSaved && (
                            <View style={styles.savedBadge}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={styles.savedBadgeText}>Guardado</Text>
                            </View>
                        )}
                    </View>

                    {minimalDataLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#3B82F6" />
                            <Text style={styles.loadingText}>Cargando datos...</Text>
                        </View>
                    ) : (
                        <>
                            {/* Peso */}
                            <View style={styles.minimalInputRow}>
                                <Text style={styles.minimalInputLabel}>⚖️ Peso</Text>
                                <View style={styles.minimalInputWrapper}>
                                    <TextInput
                                        style={styles.minimalNumberInput}
                                        value={minimalData.peso}
                                        onChangeText={(v) => updateMinimalData('peso', v)}
                                        placeholder="75.5"
                                        placeholderTextColor="#6B7280"
                                        keyboardType="numeric"
                                    />
                                    <Text style={styles.minimalInputSuffix}>kg</Text>
                                </View>
                            </View>

                            {/* Macros Consumidos - Diseño condensado */}
                            <Text style={styles.macrosSectionTitle}>🍽️ Macros Consumidos (opcional)</Text>

                            {/* Kcal prominente arriba */}
                            <KcalBigInput
                                value={minimalData.kcalConsumed}
                                target={nutritionTargets.kcal}
                                onChangeText={(v) => updateMinimalData('kcalConsumed', v)}
                            />

                            {/* Macros en fila compacta */}
                            <View style={styles.compactMacrosRow}>
                                <CompactMacroInput
                                    emoji="🥩"
                                    label="Prot"
                                    value={minimalData.proteinConsumed}
                                    target={nutritionTargets.protein}
                                    onChangeText={(v) => updateMinimalData('proteinConsumed', v)}
                                />
                                <CompactMacroInput
                                    emoji="🍚"
                                    label="Carbs"
                                    value={minimalData.carbsConsumed}
                                    target={nutritionTargets.carbs}
                                    onChangeText={(v) => updateMinimalData('carbsConsumed', v)}
                                />
                                <CompactMacroInput
                                    emoji="🥑"
                                    label="Grasas"
                                    value={minimalData.fatConsumed}
                                    target={nutritionTargets.fat}
                                    onChangeText={(v) => updateMinimalData('fatConsumed', v)}
                                />
                            </View>

                            {/* Botón Guardar */}
                            <TouchableOpacity
                                style={[
                                    styles.minimalSaveBtn,
                                    minimalDataSaved && styles.minimalSaveBtnSaved
                                ]}
                                onPress={handleGuardarMinimalData}
                            >
                                <Ionicons
                                    name={minimalDataSaved ? "checkmark-done" : "save-outline"}
                                    size={20}
                                    color="#FFF"
                                />
                                <Text style={styles.minimalSaveBtnText}>
                                    {minimalDataSaved ? 'Actualizar Datos' : 'Guardar Datos Básicos'}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* SECCIÓN DIARIO */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <ExpandableSection
                    title="Check-in Diario 30s"
                    icon="📅"
                    expanded={diarioExpanded}
                    onToggle={() => setDiarioExpanded(!diarioExpanded)}
                    color="#10B981"
                >
                    <NumberInput
                        label="Peso Hoy"
                        value={diario.peso}
                        onChangeText={(v) => updateDiario('peso', v)}
                        placeholder="75.5"
                        suffix="kg"
                    />

                    <NumberInput
                        label="Horas de sueño"
                        value={diario.sueno}
                        onChangeText={(v) => updateDiario('sueno', v)}
                        placeholder="7.5"
                        suffix="h"
                    />

                    <MoodSelector
                        value={diario.animo}
                        onChange={(v) => updateDiario('animo', v)}
                    />

                    <ScaleSelector
                        label="Energía"
                        value={diario.energia}
                        onChange={(v) => updateDiario('energia', v)}
                        max={5}
                        labels={['Baja', 'Alta']}
                    />

                    <ScaleSelector
                        label="Hambre"
                        value={diario.hambre}
                        onChange={(v) => updateDiario('hambre', v)}
                        max={5}
                        labels={['Poca', 'Mucha']}
                    />

                    <NumberInput
                        label="Pasos"
                        value={diario.pasos}
                        onChangeText={(v) => updateDiario('pasos', v)}
                        placeholder="8000"
                    />

                    <TripleChoice
                        label="¿Hoy ha ido bien?"
                        value={diario.haIdoBien}
                        onChange={(v) => updateDiario('haIdoBien', v)}
                    />

                    <CommentInput
                        label="Nota opcional"
                        value={diario.nota}
                        onChangeText={(v) => updateDiario('nota', v)}
                        placeholder="Algo que quieras recordar..."
                    />

                    <TouchableOpacity style={styles.saveBtn} onPress={handleGuardarDiario}>
                        <Ionicons name="save-outline" size={20} color="#FFF" />
                        <Text style={styles.saveBtnText}>Guardar Diario</Text>
                    </TouchableOpacity>
                </ExpandableSection>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* SECCIÓN SEMANAL */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <ExpandableSection
                    title="Check-in Semanal 5min"
                    icon="📊"
                    expanded={semanalExpanded}
                    onToggle={() => setSemanalExpanded(!semanalExpanded)}
                    color="#3B82F6"
                >
                    {/* NUTRICIÓN */}
                    <SubsectionTitle title="Nutrición" icon="🍽️" />

                    <ScaleSelector
                        label="Adherencia a la dieta"
                        value={semanal.nutriAdherencia}
                        onChange={(v) => updateSemanal('nutriAdherencia', v)}
                        max={10}
                        labels={['Nada', 'Perfecto']}
                    />

                    <ScaleSelector
                        label="Saciedad general"
                        value={semanal.nutriSaciedad}
                        onChange={(v) => updateSemanal('nutriSaciedad', v)}
                        max={5}
                        labels={['Siempre hambre', 'Muy saciado']}
                    />

                    <ScaleSelector
                        label="Gastrointestinal"
                        value={semanal.nutriGI}
                        onChange={(v) => updateSemanal('nutriGI', v)}
                        max={5}
                        labels={['Mal', 'Perfecto']}
                    />

                    <ScaleSelector
                        label="Deposiciones"
                        value={semanal.nutriDeposiciones}
                        onChange={(v) => updateSemanal('nutriDeposiciones', v)}
                        max={5}
                        labels={['Mal', 'Regular']}
                    />

                    <NumberInput
                        label="Comidas libres"
                        value={semanal.nutriComidasLibres}
                        onChangeText={(v) => updateSemanal('nutriComidasLibres', v)}
                        placeholder="2"
                    />

                    <CommentInput
                        label="Comentario nutrición"
                        value={semanal.nutriComentario}
                        onChangeText={(v) => updateSemanal('nutriComentario', v)}
                        placeholder="¿Cómo te has sentido esta semana con la dieta?"
                    />

                    {/* ENTRENAMIENTO */}
                    <SubsectionTitle title="Entrenamiento" icon="💪" />

                    <ScaleSelector
                        label="Adherencia al plan"
                        value={semanal.entrenoAdherencia}
                        onChange={(v) => updateSemanal('entrenoAdherencia', v)}
                        max={10}
                        labels={['Nada', 'Todo']}
                    />

                    <ScaleSelector
                        label="Rendimiento"
                        value={semanal.entrenoRendimiento}
                        onChange={(v) => updateSemanal('entrenoRendimiento', v)}
                        max={10}
                        labels={['Muy bajo', 'Excelente']}
                    />

                    <ScaleSelector
                        label="Fatiga acumulada"
                        value={semanal.entrenoFatiga}
                        onChange={(v) => updateSemanal('entrenoFatiga', v)}
                        max={5}
                        labels={['Ninguna', 'Mucha']}
                    />

                    <View style={styles.toggleRow}>
                        <Text style={styles.inputLabel}>¿Molestias o lesión?</Text>
                        <TouchableOpacity
                            style={[
                                styles.toggleBtn,
                                semanal.entrenoMolestias && styles.toggleBtnActive
                            ]}
                            onPress={() => updateSemanal('entrenoMolestias', !semanal.entrenoMolestias)}
                        >
                            <Text style={styles.toggleBtnText}>
                                {semanal.entrenoMolestias ? 'Sí' : 'No'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {semanal.entrenoMolestias && (
                        <CommentInput
                            label="Describe la molestia"
                            value={semanal.entrenoMolestiasTexto}
                            onChangeText={(v) => updateSemanal('entrenoMolestiasTexto', v)}
                            placeholder="¿Qué zona? ¿Desde cuándo?"
                        />
                    )}

                    <CommentInput
                        label="Comentario entrenamiento"
                        value={semanal.entrenoComentario}
                        onChangeText={(v) => updateSemanal('entrenoComentario', v)}
                        placeholder="¿Cómo han ido los entrenos?"
                    />

                    {/* SENSACIONES */}
                    <SubsectionTitle title="Sensaciones" icon="🧠" />

                    <ScaleSelector
                        label="Motivación"
                        value={semanal.sensMotivacion}
                        onChange={(v) => updateSemanal('sensMotivacion', v)}
                        max={5}
                        labels={['Baja', 'Alta']}
                    />

                    <ScaleSelector
                        label="Estrés"
                        value={semanal.sensEstres}
                        onChange={(v) => updateSemanal('sensEstres', v)}
                        max={5}
                        labels={['Poco', 'Mucho']}
                    />

                    <ScaleSelector
                        label="Estado emocional"
                        value={semanal.sensEmocional}
                        onChange={(v) => updateSemanal('sensEmocional', v)}
                        max={5}
                        labels={['Mal', 'Genial']}
                    />

                    <NumberInput
                        label="Sueño medio"
                        value={semanal.sensSuenoMedio}
                        onChangeText={(v) => updateSemanal('sensSuenoMedio', v)}
                        placeholder="7"
                        suffix="h/noche"
                    />

                    <CommentInput
                        label="Comentario sensaciones"
                        value={semanal.sensComentario}
                        onChangeText={(v) => updateSemanal('sensComentario', v)}
                        placeholder="¿Cómo te has sentido en general?"
                    />

                    {/* REFLEXIÓN */}
                    <SubsectionTitle title="Reflexión" icon="💭" />

                    <CommentInput
                        label="🎯 Top 1 cosa a mejorar"
                        value={semanal.topMejorar}
                        onChangeText={(v) => updateSemanal('topMejorar', v)}
                        placeholder="¿Qué podrías hacer mejor la próxima semana?"
                    />

                    <CommentInput
                        label="🏆 Top 1 cosa que hice bien"
                        value={semanal.topBien}
                        onChangeText={(v) => updateSemanal('topBien', v)}
                        placeholder="¿De qué te sientes orgulloso/a?"
                    />

                    {/* MEDICIONES (Opcional) */}
                    <SubsectionTitle title="Mediciones (Opcional)" icon="📐" />

                    <View style={styles.measureRow}>
                        <MeasureInput label="Cuello" value={semanal.medCuello} onChangeText={(v) => updateSemanal('medCuello', v)} placeholder="38" />
                        <MeasureInput label="Hombros" value={semanal.medHombros} onChangeText={(v) => updateSemanal('medHombros', v)} placeholder="120" />
                    </View>
                    <View style={styles.measureRow}>
                        <MeasureInput label="Pecho" value={semanal.medPecho} onChangeText={(v) => updateSemanal('medPecho', v)} placeholder="100" />
                        <MeasureInput label="Cintura" value={semanal.medCintura} onChangeText={(v) => updateSemanal('medCintura', v)} placeholder="80" />
                    </View>
                    <View style={styles.measureRow}>
                        <MeasureInput label="Pierna" value={semanal.medPierna} onChangeText={(v) => updateSemanal('medPierna', v)} placeholder="60" />
                        <MeasureInput label="Gemelo" value={semanal.medGemelo} onChangeText={(v) => updateSemanal('medGemelo', v)} placeholder="38" />
                    </View>

                    <TouchableOpacity style={styles.saveBtn} onPress={handleGuardarSemanal}>
                        <Ionicons name="save-outline" size={20} color="#FFF" />
                        <Text style={styles.saveBtnText}>Guardar Semanal</Text>
                    </TouchableOpacity>
                </ExpandableSection>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* BOTONES ADICIONALES */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.feedbackBtn}>
                        <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFF" />
                        <Text style={styles.feedbackBtnText}>Feedback del Entrenador</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cameraBtn}
                        onPress={() => setCameraModalVisible(true)}
                    >
                        <Ionicons name="camera-outline" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Calendario mensual */}
                <MonthlyCalendar
                    dailyDates={filledDailyDates}
                    weeklyDates={filledWeeklyDates}
                />

                {/* Espaciado inferior */}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Modal Cámara - Building in Progress */}
            <Modal
                visible={cameraModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCameraModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Pressable
                            style={styles.modalClose}
                            onPress={() => setCameraModalVisible(false)}
                        >
                            <Ionicons name="close-circle" size={32} color="#9CA3AF" />
                        </Pressable>
                        <Text style={styles.modalEmoji}>🚧📷</Text>
                        <Text style={styles.modalTitle}>Building in Progress</Text>
                        <Text style={styles.modalText}>
                            La funcionalidad de fotos de progreso estará disponible próximamente.
                        </Text>
                        <TouchableOpacity
                            style={styles.modalBtn}
                            onPress={() => setCameraModalVisible(false)}
                        >
                            <Text style={styles.modalBtnText}>Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════

const CARD_BG = 'rgba(255,255,255,0.08)';
const BORDER = 'rgba(255,255,255,0.18)';

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    blob: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 160,
        opacity: 0.25,
        backgroundColor: '#3B82F6',
        filter: Platform.OS === 'web' ? 'blur(70px)' : undefined,
    },
    blobTop: { top: -40, left: -40 },
    blobBottom: { bottom: -30, right: -30, backgroundColor: '#10B981' },

    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        ...(Platform.OS === 'web' && {
            maxWidth: 520,
            alignSelf: 'center',
            width: '100%',
        }),
        overflow: 'hidden',
    },

    // Header
    header: {
        marginBottom: 24,
        alignItems: 'center',
    },
    headerTitle: {
        color: '#E5E7EB',
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    headerSubtitle: {
        color: '#9CA3AF',
        fontSize: 14,
    },

    // Accordion
    accordionContainer: {
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderColor: BORDER,
        overflow: 'hidden',
    },
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
        borderLeftWidth: 4,
    },
    accordionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    accordionIcon: {
        fontSize: 22,
    },
    accordionTitle: {
        color: '#E5E7EB',
        fontSize: 18,
        fontWeight: '700',
    },
    accordionContent: {
        padding: 18,
        paddingTop: 0,
    },

    // Section hint
    sectionHint: {
        color: '#9CA3AF',
        fontSize: 12,
        marginBottom: 16,
        textAlign: 'center',
        fontStyle: 'italic',
    },

    // Input Row
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 10,
    },
    inputLabel: {
        color: '#E5E7EB',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    numberInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#FFF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        fontSize: 16,
        minWidth: 70,
        textAlign: 'center',
    },
    inputSuffix: {
        color: '#9CA3AF',
        marginLeft: 8,
        fontSize: 14,
    },

    // Scale Selector
    scaleContainer: {
        marginBottom: 16,
    },
    scaleRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'flex-start',
    },
    scaleBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
        minWidth: 40,
        maxWidth: 50,
        alignItems: 'center',
    },
    scaleBtnActive: {
        backgroundColor: '#3B82F6',
    },
    scaleBtnText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
    },
    scaleBtnTextActive: {
        color: '#FFF',
    },
    scaleLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
        maxWidth: Platform.OS === 'web' ? 280 : '100%',
    },
    scaleLabelText: {
        color: '#6B7280',
        fontSize: 11,
    },

    // Mood Selector
    moodContainer: {
        marginBottom: 16,
    },
    moodRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 2,
    },
    moodBtn: {
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        minWidth: 65,
        maxWidth: 90,
    },
    moodBtnActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    moodEmoji: {
        fontSize: 24,
        marginBottom: 4,
    },
    moodLabel: {
        color: '#9CA3AF',
        fontSize: 10,
    },
    moodLabelActive: {
        color: '#3B82F6',
        fontWeight: '600',
    },

    // Triple Choice
    tripleContainer: {
        marginBottom: 16,
    },
    tripleRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        flexWrap: 'wrap',
    },
    tripleBtn: {
        flex: 1,
        minWidth: 100,
        maxWidth: 180,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: BORDER,
    },
    tripleBtnText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
    },

    // Comment Input
    commentContainer: {
        marginBottom: 16,
    },
    commentInput: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        color: '#FFF',
        padding: 12,
        borderRadius: 10,
        fontSize: 14,
        minHeight: 60,
        textAlignVertical: 'top',
    },

    // Subsection
    subsectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 14,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    subsectionIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    subsectionTitle: {
        color: '#E5E7EB',
        fontSize: 16,
        fontWeight: '700',
    },

    // Toggle
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    toggleBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    toggleBtnActive: {
        backgroundColor: '#EF4444',
    },
    toggleBtnText: {
        color: '#FFF',
        fontWeight: '600',
    },

    // Measurements
    measureRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
        maxWidth: '100%',
    },
    measureItem: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 10,
    },
    measureLabel: {
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
    },
    measureInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    measureInput: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#FFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        fontSize: 16,
        textAlign: 'center',
        maxWidth: '80%',
    },
    measureSuffix: {
        color: '#6B7280',
        fontSize: 12,
        marginLeft: 6,
    },

    // ═══ KCAL BIG INPUT ═══
    kcalBigContainer: {
        marginBottom: 16,
    },
    kcalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    kcalEmoji: {
        fontSize: 20,
        marginRight: 8,
    },
    kcalLabel: {
        color: '#E5E7EB',
        fontSize: 18,
        fontWeight: '700',
        flex: 1,
    },
    kcalPercentage: {
        fontSize: 16,
        fontWeight: '700',
    },
    kcalInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    kcalInput: {
        maxWidth: '80%',
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        borderWidth: 2,
    },
    kcalUnit: {
        color: '#9CA3AF',
        fontSize: 16,
        marginLeft: 10,
        fontWeight: '600',
    },
    kcalProgressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    kcalProgressBg: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    kcalProgressFill: {
        height: '100%',
        borderRadius: 3,
    },
    kcalTargetText: {
        color: '#9CA3AF',
        fontSize: 12,
    },

    // ═══ COMPACT MACRO INPUT ═══
    compactMacrosRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    compactMacroItem: {
        flex: 1,
        alignItems: 'center',
    },
    compactMacroEmoji: {
        fontSize: 16,
        marginBottom: 4,
    },
    compactMacroInput: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#FFF',
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderRadius: 8,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        borderWidth: 2,
    },
    compactMacroLabel: {
        color: '#9CA3AF',
        fontSize: 10,
        marginTop: 4,
        fontWeight: '600',
    },

    // Save Button
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10B981',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 16,
        gap: 8,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },

    // Action Buttons
    actionButtons: {
        flexDirection: 'row',
        marginTop: 8,
        marginBottom: 16,
        gap: 12,
    },
    feedbackBtn: {
        flex: 4, // 80%
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 10,
    },
    feedbackBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    cameraBtn: {
        flex: 1, // 20%
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F59E0B',
        paddingVertical: 16,
        borderRadius: 14,
    },

    // Placeholder
    placeholderContent: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    placeholderEmoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    placeholderTitle: {
        color: '#E5E7EB',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    placeholderText: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#374151',
    },
    modalClose: {
        position: 'absolute',
        top: 10,
        right: 10,
    },
    modalEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    modalTitle: {
        color: '#E5E7EB',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 10,
    },
    modalText: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    modalBtn: {
        backgroundColor: '#3B82F6',
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 10,
    },
    modalBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ESTILOS DATOS MÍNIMOS
    // ═══════════════════════════════════════════════════════════════════════════
    minimalDataCard: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        padding: 18,
        marginBottom: 20,
    },
    minimalDataHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10,
    },
    minimalDataIcon: {
        fontSize: 24,
    },
    minimalDataTitle: {
        color: '#E5E7EB',
        fontSize: 20,
        fontWeight: '700',
        flex: 1,
    },
    savedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    savedBadgeText: {
        color: '#10B981',
        fontSize: 12,
        fontWeight: '600',
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 30,
        gap: 10,
    },
    loadingText: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    minimalInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 10,
    },
    minimalInputLabel: {
        color: '#E5E7EB',
        fontSize: 16,
        fontWeight: '600',
    },
    minimalInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    minimalNumberInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        fontSize: 18,
        minWidth: 80,
        textAlign: 'center',
        fontWeight: '600',
    },
    minimalInputSuffix: {
        color: '#9CA3AF',
        marginLeft: 8,
        fontSize: 14,
    },
    macrosSectionTitle: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
        marginTop: 4,
    },
    macrosGrid: {
        gap: 12,
    },
    minimalSaveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3B82F6',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 16,
        gap: 8,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    minimalSaveBtnSaved: {
        backgroundColor: '#10B981',
    },
    minimalSaveBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ESTILOS MACRO SQUARES INPUT
    // ═══════════════════════════════════════════════════════════════════════════
    macroSquaresContainer: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 14,
    },
    macroSquaresHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    macroSquaresEmoji: {
        fontSize: 18,
    },
    macroSquaresLabel: {
        color: '#E5E7EB',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    macroSquaresTarget: {
        fontSize: 14,
        fontWeight: '700',
    },
    macroSquaresRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    squaresContainer: {
        flexDirection: 'row',
        gap: 6,
    },
    macroSquare: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    macroSquarePartial: {
        height: '100%',
        borderRadius: 5,
    },
    macroInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    macroNumberInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#FFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        fontSize: 16,
        minWidth: 70,
        textAlign: 'center',
        fontWeight: '600',
        borderWidth: 2,
    },
    macroUnit: {
        color: '#9CA3AF',
        marginLeft: 6,
        fontSize: 12,
    },
    macroTargetText: {
        color: '#6B7280',
        fontSize: 11,
        marginTop: 8,
        textAlign: 'right',
    },

    // ═══ CALENDARIO MENSUAL ═══
    calendarContainer: {
        marginTop: 20,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    calendarArrow: {
        padding: 8,
    },
    calendarMonthText: {
        color: '#E5E7EB',
        fontSize: 16,
        fontWeight: '700',
    },
    calendarWeekHeader: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    calendarWeekDay: {
        flex: 1,
        textAlign: 'center',
        color: '#6B7280',
        fontSize: 11,
        fontWeight: '600',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    calendarDayCell: {
        width: '14.28%',
        aspectRatio: 1,
        padding: 2,
    },
    calendarDay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
    },
    calendarDayToday: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    calendarDayText: {
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '500',
    },
    calendarDayTextToday: {
        color: '#3B82F6',
        fontWeight: '700',
    },
    calendarIndicators: {
        flexDirection: 'row',
        gap: 2,
        marginTop: 2,
    },
    calendarDotDaily: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#10B981',
    },
    calendarDotWeekly: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#8B5CF6',
    },
    calendarLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    calendarLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    calendarLegendText: {
        color: '#6B7280',
        fontSize: 10,
    },
});
