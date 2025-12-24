/* app/(coach)/nutrition/[clientId].jsx - Editor de Plan Nutricional */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
    FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { useFeedbackBubble } from '../../../context/FeedbackBubbleContext';
import { calculateFullNutrition, ACTIVITY_FACTORS } from '../../../src/utils/nutritionCalculator';

const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Lunes', short: 'L' },
    { key: 'tuesday', label: 'Martes', short: 'M' },
    { key: 'wednesday', label: 'Miércoles', short: 'X' },
    { key: 'thursday', label: 'Jueves', short: 'J' },
    { key: 'friday', label: 'Viernes', short: 'V' },
    { key: 'saturday', label: 'Sábado', short: 'S' },
    { key: 'sunday', label: 'Domingo', short: 'D' },
];

// Paleta de colores para tipos de día
const DAY_COLORS = [
    '#22c55e', // Verde - entreno
    '#3b82f6', // Azul
    '#f59e0b', // Naranja - descanso
    '#ef4444', // Rojo - refeed
    '#8b5cf6', // Morado
    '#06b6d4', // Cyan
    '#ec4899', // Rosa
    '#84cc16', // Lima
];

// Componente para input numérico
const MacroInput = ({ label, value, onChange, placeholder, suffix, color = '#64748b' }) => (
    <View style={styles.macroInputContainer}>
        <Text style={styles.macroInputLabel}>{label}</Text>
        <View style={styles.macroInputRow}>
            <TextInput
                style={[styles.macroInput, { borderColor: color + '40' }]}
                value={value != null ? String(value) : ''}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
            />
            {suffix ? <Text style={[styles.macroInputSuffix, { color }]}>{suffix}</Text> : null}
        </View>
    </View>
);

// Componente para tarjeta de tipo de día
const DayTargetCard = ({ dayTarget, index, onUpdate, onDelete }) => {
    // Modo de entrada de macros: 'percent' o 'grams'
    const macroMode = dayTarget.macroMode || 'grams';

    // Calcular kcal desde gramos (modo 'grams')
    const calculatedKcal = useMemo(() => {
        const p = parseFloat(dayTarget.protein_g) || 0;
        const c = parseFloat(dayTarget.carbs_g) || 0;
        const f = parseFloat(dayTarget.fat_g) || 0;
        if (p || c || f) {
            return Math.round(p * 4 + c * 4 + f * 9);
        }
        return null;
    }, [dayTarget.protein_g, dayTarget.carbs_g, dayTarget.fat_g]);

    // Calcular gramos desde porcentajes (modo 'percent')
    const calculatedMacros = useMemo(() => {
        if (macroMode !== 'percent' || !dayTarget.kcal) return null;
        const kcal = parseFloat(dayTarget.kcal) || 0;
        const pPct = parseFloat(dayTarget.protein_pct) || 30;
        const cPct = parseFloat(dayTarget.carbs_pct) || 45;
        const fPct = parseFloat(dayTarget.fat_pct) || 25;

        return {
            protein: Math.round((kcal * (pPct / 100)) / 4),
            carbs: Math.round((kcal * (cPct / 100)) / 4),
            fat: Math.round((kcal * (fPct / 100)) / 9),
        };
    }, [macroMode, dayTarget.kcal, dayTarget.protein_pct, dayTarget.carbs_pct, dayTarget.fat_pct]);

    // Valores a mostrar según modo
    const displayKcal = macroMode === 'grams' ? (dayTarget.kcal || calculatedKcal) : dayTarget.kcal;
    const displayProtein = macroMode === 'percent' ? calculatedMacros?.protein : dayTarget.protein_g;
    const displayCarbs = macroMode === 'percent' ? calculatedMacros?.carbs : dayTarget.carbs_g;
    const displayFat = macroMode === 'percent' ? calculatedMacros?.fat : dayTarget.fat_g;

    // Validación: suma de porcentajes
    const totalPct = (parseFloat(dayTarget.protein_pct) || 0) +
        (parseFloat(dayTarget.carbs_pct) || 0) +
        (parseFloat(dayTarget.fat_pct) || 0);
    const pctWarning = macroMode === 'percent' && totalPct > 0 && Math.abs(totalPct - 100) > 5;

    const dayColor = dayTarget.color || DAY_COLORS[index % DAY_COLORS.length];

    return (
        <View style={[styles.dayTargetCard, { borderLeftWidth: 4, borderLeftColor: dayColor }]}>
            {/* Color picker row */}
            <View style={styles.colorPickerRow}>
                {DAY_COLORS.map((color) => (
                    <TouchableOpacity
                        key={color}
                        style={[
                            styles.colorDot,
                            { backgroundColor: color },
                            dayColor === color && styles.colorDotActive
                        ]}
                        onPress={() => onUpdate(index, 'color', color)}
                    />
                ))}
            </View>

            <View style={styles.dayTargetHeader}>
                <TextInput
                    style={[styles.dayTargetName, { borderLeftColor: dayColor }]}
                    value={dayTarget.name}
                    onChangeText={(v) => onUpdate(index, 'name', v)}
                    placeholder={`Tipo de día ${index + 1}`}
                    placeholderTextColor="#94a3b8"
                />
                <TouchableOpacity onPress={() => onDelete(index)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
            </View>

            {/* Toggle día de entreno */}
            <TouchableOpacity
                style={styles.trainingToggle}
                onPress={() => onUpdate(index, 'isTrainingDay', !dayTarget.isTrainingDay)}
            >
                <Ionicons
                    name={dayTarget.isTrainingDay ? 'barbell' : 'bed'}
                    size={16}
                    color={dayTarget.isTrainingDay ? '#10b981' : '#64748b'}
                />
                <Text style={[
                    styles.trainingToggleText,
                    { color: dayTarget.isTrainingDay ? '#10b981' : '#64748b' }
                ]}>
                    {dayTarget.isTrainingDay ? 'Día de entrenamiento' : 'Día de descanso'}
                </Text>
            </TouchableOpacity>

            {/* Toggle modo macros: % o g */}
            <View style={styles.macroModeContainer}>
                <TouchableOpacity
                    style={[styles.macroModeBtn, macroMode === 'percent' && styles.macroModeBtnActive]}
                    onPress={() => onUpdate(index, 'macroMode', 'percent')}
                >
                    <Ionicons name="pie-chart" size={14} color={macroMode === 'percent' ? '#fff' : '#64748b'} />
                    <Text style={[styles.macroModeText, macroMode === 'percent' && styles.macroModeTextActive]}>
                        Kcal + %
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.macroModeBtn, macroMode === 'grams' && styles.macroModeBtnActive]}
                    onPress={() => onUpdate(index, 'macroMode', 'grams')}
                >
                    <Ionicons name="scale" size={14} color={macroMode === 'grams' ? '#fff' : '#64748b'} />
                    <Text style={[styles.macroModeText, macroMode === 'grams' && styles.macroModeTextActive]}>
                        Gramos
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Modo PORCENTAJE */}
            {macroMode === 'percent' && (
                <View style={styles.macrosGrid}>
                    <MacroInput
                        label="Kcal"
                        value={dayTarget.kcal?.toString() || ''}
                        onChange={(v) => onUpdate(index, 'kcal', v ? parseInt(v) : '')}
                        placeholder="2500"
                        suffix=""
                        color="#ef4444"
                    />
                    <MacroInput
                        label="Prot %"
                        value={dayTarget.protein_pct?.toString() || ''}
                        onChange={(v) => onUpdate(index, 'protein_pct', v ? parseInt(v) : '')}
                        placeholder="30"
                        suffix="%"
                        color="#ef4444"
                    />
                    <MacroInput
                        label="Carbs %"
                        value={dayTarget.carbs_pct?.toString() || ''}
                        onChange={(v) => onUpdate(index, 'carbs_pct', v ? parseInt(v) : '')}
                        placeholder="45"
                        suffix="%"
                        color="#3b82f6"
                    />
                    <MacroInput
                        label="Grasas %"
                        value={dayTarget.fat_pct?.toString() || ''}
                        onChange={(v) => onUpdate(index, 'fat_pct', v ? parseInt(v) : '')}
                        placeholder="25"
                        suffix="%"
                        color="#f59e0b"
                    />
                </View>
            )}

            {/* Resultado calculado (modo %) */}
            {macroMode === 'percent' && calculatedMacros && (
                <View style={styles.calculatedRow}>
                    <Text style={styles.calculatedLabel}>→</Text>
                    <Text style={styles.calculatedValue}>P: {calculatedMacros.protein}g</Text>
                    <Text style={styles.calculatedValue}>C: {calculatedMacros.carbs}g</Text>
                    <Text style={styles.calculatedValue}>G: {calculatedMacros.fat}g</Text>
                </View>
            )}

            {pctWarning && (
                <View style={styles.warningRow}>
                    <Ionicons name="warning" size={14} color="#f59e0b" />
                    <Text style={styles.warningText}>Suma {totalPct}% (debería ser ~100%)</Text>
                </View>
            )}

            {/* Modo GRAMOS */}
            {macroMode === 'grams' && (
                <>
                    <View style={styles.macrosGrid}>
                        <MacroInput
                            label="Proteína"
                            value={dayTarget.protein_g?.toString() || ''}
                            onChange={(v) => onUpdate(index, 'protein_g', v ? parseInt(v) : '')}
                            placeholder="180"
                            suffix="g"
                            color="#ef4444"
                        />
                        <MacroInput
                            label="Carbs"
                            value={dayTarget.carbs_g?.toString() || ''}
                            onChange={(v) => onUpdate(index, 'carbs_g', v ? parseInt(v) : '')}
                            placeholder="300"
                            suffix="g"
                            color="#3b82f6"
                        />
                        <MacroInput
                            label="Grasas"
                            value={dayTarget.fat_g?.toString() || ''}
                            onChange={(v) => onUpdate(index, 'fat_g', v ? parseInt(v) : '')}
                            placeholder="80"
                            suffix="g"
                            color="#f59e0b"
                        />
                    </View>
                    {calculatedKcal && (
                        <View style={styles.calculatedRow}>
                            <Text style={styles.calculatedLabel}>= </Text>
                            <Text style={[styles.calculatedValue, { color: '#22c55e', fontWeight: '700' }]}>
                                {calculatedKcal} kcal
                            </Text>
                        </View>
                    )}
                </>
            )}

            {/* Extras row */}
            <View style={styles.extrasRow}>
                <MacroInput
                    label="Agua"
                    value={dayTarget.water_ml?.toString() || ''}
                    onChange={(v) => onUpdate(index, 'water_ml', v ? parseInt(v) : '')}
                    placeholder="3000"
                    suffix="ml"
                    color="#0ea5e9"
                />
                <MacroInput
                    label="Pasos"
                    value={dayTarget.steps_target?.toString() || ''}
                    onChange={(v) => onUpdate(index, 'steps_target', v ? parseInt(v) : '')}
                    placeholder="8000"
                    suffix=""
                    color="#22c55e"
                />
                <MacroInput
                    label="Fibra"
                    value={dayTarget.fiber_g?.toString() || ''}
                    onChange={(v) => onUpdate(index, 'fiber_g', v ? parseInt(v) : '')}
                    placeholder="30"
                    suffix="g"
                    color="#84cc16"
                />
            </View>

            {/* Notas */}
            <TextInput
                style={styles.notesInput}
                value={dayTarget.notes || ''}
                onChangeText={(v) => onUpdate(index, 'notes', v)}
                placeholder="Instrucciones del día (opcional)"
                placeholderTextColor="#94a3b8"
                multiline
            />
        </View>
    );
};

// Componente para selector de semana - una fila, pulsar cambia tipo
const WeekSchedulePicker = ({ weekSchedule, dayTargets, onChange }) => {
    // Ciclar al siguiente tipo de día
    const cycleDay = (dayKey) => {
        const currentId = weekSchedule[dayKey];
        if (!currentId) {
            // Si no tiene asignado, asignar el primero
            onChange(dayKey, dayTargets[0]?.id || null);
        } else {
            // Encontrar el siguiente tipo
            const currentIdx = dayTargets.findIndex(d => d.id === currentId);
            const nextIdx = (currentIdx + 1) % dayTargets.length;
            onChange(dayKey, dayTargets[nextIdx]?.id || null);
        }
    };

    // Obtener datos del día asignado
    const getAssignedData = (dayKey) => {
        const assignedId = weekSchedule[dayKey];
        if (!assignedId) return { color: '#94a3b8', name: '?' };
        const dt = dayTargets.find(d => d.id === assignedId);
        const idx = dayTargets.findIndex(d => d.id === assignedId);
        return {
            color: dt?.color || DAY_COLORS[idx] || '#64748b',
            name: dt?.name?.charAt(0) || '?'
        };
    };

    return (
        <View style={styles.weekScheduleContainer}>
            <Text style={styles.sectionTitle}>📅 Calendario Semanal</Text>
            <Text style={styles.sectionSubtitle}>Toca cada día para cambiar el tipo</Text>

            {/* Leyenda */}
            <View style={styles.dayTypeLegend}>
                {dayTargets.map((dt, idx) => (
                    <View key={dt.id} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: dt.color || DAY_COLORS[idx] }]} />
                        <Text style={styles.legendText}>{dt.name?.substring(0, 6) || `T${idx + 1}`}</Text>
                    </View>
                ))}
            </View>

            {/* Una sola fila de días */}
            <View style={styles.weekRowSimple}>
                {DAYS_OF_WEEK.map(day => {
                    const { color, name } = getAssignedData(day.key);
                    return (
                        <TouchableOpacity
                            key={day.key}
                            style={[styles.weekDayBtn, { backgroundColor: color }]}
                            onPress={() => cycleDay(day.key)}
                        >
                            <Text style={styles.weekDayBtnLabel}>{day.short}</Text>
                            <Text style={styles.weekDayBtnType}>{name}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

export default function ClientNutritionEditor() {
    const router = useRouter();
    const { clientId, clientName } = useLocalSearchParams();
    const { token, user } = useAuth();
    const { theme } = useTheme();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingAsTemplate, setIsSavingAsTemplate] = useState(false);
    const [clientData, setClientData] = useState(null);
    const [mode, setMode] = useState('auto'); // 'auto' | 'custom'
    const [planName, setPlanName] = useState('');
    const [planDescription, setPlanDescription] = useState('');
    const [dayTargets, setDayTargets] = useState([]);
    const [weekSchedule, setWeekSchedule] = useState({
        monday: null, tuesday: null, wednesday: null, thursday: null,
        friday: null, saturday: null, sunday: null
    });

    // Template loading
    const [templates, setTemplates] = useState([]);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    useEffect(() => {
        fetchClientData();
    }, [clientId]);

    const fetchClientData = async () => {
        try {
            setIsLoading(true);

            // Fetch client info
            const clientRes = await fetch(`${API_URL}/api/trainers/clients`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const clientsData = await clientRes.json();
            const client = clientsData.clients?.find(c => c._id === clientId);
            setClientData(client);

            // Try to fetch existing plan
            try {
                const planRes = await fetch(`${API_URL}/api/nutrition-plans/${clientId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (planRes.ok) {
                    const planData = await planRes.json();
                    if (planData.success && planData.plan) {
                        setMode(planData.plan.mode || 'auto');
                        setPlanName(planData.plan.name || '');
                        setPlanDescription(planData.plan.description || '');
                        if (planData.plan.customPlan) {
                            setDayTargets(planData.plan.customPlan.dayTargets || []);
                            setWeekSchedule(planData.plan.customPlan.weekSchedule || {});
                        }
                    }
                }
            } catch (e) {
                console.log('[Editor] No existing plan found');
            }

        } catch (error) {
            console.error('[Editor] Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto nutrition calculation
    const autoNutrition = useMemo(() => {
        if (!clientData?.info_user) return null;
        const info = clientData.info_user;
        if (!info.edad || !info.peso || !info.altura || !info.genero) return null;
        return calculateFullNutrition(info, info.objetivos, clientData.af || 1.55);
    }, [clientData]);

    // Add new day target
    const addDayTarget = () => {
        const newTarget = {
            id: `day_${Date.now()}`,
            name: dayTargets.length === 0 ? 'Día de entrenamiento' : 'Día de descanso',
            isTrainingDay: dayTargets.length === 0,
            macroMode: 'grams', // 'grams' o 'percent'
            color: DAY_COLORS[dayTargets.length % DAY_COLORS.length],
            kcal: '',
            protein_g: '',
            carbs_g: '',
            fat_g: '',
            protein_pct: '',
            carbs_pct: '',
            fat_pct: '',
            water_ml: '',
            steps_target: '',
            fiber_g: '',
            notes: '',
        };
        setDayTargets([...dayTargets, newTarget]);
    };

    const updateDayTarget = (index, field, value) => {
        const updated = [...dayTargets];
        updated[index] = { ...updated[index], [field]: value };
        setDayTargets(updated);
    };

    const deleteDayTarget = (index) => {
        if (dayTargets.length <= 1) {
            Alert.alert('Mínimo requerido', 'Necesitas al menos un tipo de día');
            return;
        }
        Alert.alert(
            'Eliminar tipo de día',
            '¿Estás seguro?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: () => {
                        const updated = dayTargets.filter((_, i) => i !== index);
                        setDayTargets(updated);
                    }
                }
            ]
        );
    };

    const updateWeekSchedule = (day, targetId) => {
        setWeekSchedule({ ...weekSchedule, [day]: targetId });
    };

    // Fetch templates for loading
    const fetchTemplates = async () => {
        try {
            setLoadingTemplates(true);
            const res = await fetch(`${API_URL}/api/nutrition-plans/templates/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setTemplates(data.templates || []);
            }
        } catch (error) {
            console.error('[Editor] Error fetching templates:', error);
        } finally {
            setLoadingTemplates(false);
        }
    };

    // Apply template to current plan
    const applyTemplate = (template) => {
        if (template.customPlan) {
            setDayTargets(template.customPlan.dayTargets || []);
            setWeekSchedule(template.customPlan.weekSchedule || {});
        }
        setMode('custom');
        setShowTemplateModal(false);
        Alert.alert('✅ Plan cargado', `Se ha aplicado el plan "${template.name}"`);
    };

    // Open template modal
    const openTemplateModal = () => {
        fetchTemplates();
        setShowTemplateModal(true);
    };

    // Save current plan as a template
    const saveAsTemplate = async () => {
        if (mode !== 'custom' || dayTargets.length === 0) {
            Alert.alert('Sin datos', 'Necesitas tener un plan personalizado con al menos un tipo de día');
            return;
        }

        Alert.prompt(
            'Guardar como Plan',
            'Introduce un nombre para guardar este plan como reutilizable:',
            async (templateName) => {
                if (!templateName?.trim()) return;

                try {
                    setIsSavingAsTemplate(true);

                    // Process dayTargets
                    const processedDayTargets = dayTargets.map((dt, idx) => {
                        const processed = { ...dt };
                        if (!processed.color) {
                            processed.color = DAY_COLORS[idx % DAY_COLORS.length];
                        }
                        if (dt.macroMode === 'percent' && dt.kcal) {
                            const kcal = parseFloat(dt.kcal) || 0;
                            const pPct = parseFloat(dt.protein_pct) || 30;
                            const cPct = parseFloat(dt.carbs_pct) || 45;
                            const fPct = parseFloat(dt.fat_pct) || 25;
                            processed.protein_g = Math.round((kcal * (pPct / 100)) / 4);
                            processed.carbs_g = Math.round((kcal * (cPct / 100)) / 4);
                            processed.fat_g = Math.round((kcal * (fPct / 100)) / 9);
                        } else if (dt.macroMode === 'grams' || !dt.macroMode) {
                            if (dt.protein_g || dt.carbs_g || dt.fat_g) {
                                const p = parseFloat(dt.protein_g) || 0;
                                const c = parseFloat(dt.carbs_g) || 0;
                                const f = parseFloat(dt.fat_g) || 0;
                                processed.kcal = Math.round(p * 4 + c * 4 + f * 9);
                            }
                        }
                        return processed;
                    });

                    const body = {
                        name: templateName.trim(),
                        description: planDescription.trim() || `Plan basado en ${clientName || 'cliente'}`,
                        customPlan: {
                            dayTargets: processedDayTargets,
                            weekSchedule,
                        },
                    };

                    const res = await fetch(`${API_URL}/api/nutrition-plans/templates`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify(body),
                    });

                    const data = await res.json();
                    if (data.success) {
                        Alert.alert('✅ Guardado', 'Plan guardado como reutilizable');
                    } else {
                        Alert.alert('Error', data.message || 'No se pudo guardar');
                    }
                } catch (error) {
                    console.error('[Editor] Save as template error:', error);
                    Alert.alert('Error', 'Error de conexión');
                } finally {
                    setIsSavingAsTemplate(false);
                }
            },
            'plain-text',
            planName || ''
        );
    };

    const handleSave = async (status = 'draft') => {
        try {
            setIsSaving(true);

            // Procesar dayTargets para calcular valores finales antes de guardar
            const processedDayTargets = dayTargets.map((dt, idx) => {
                const processed = { ...dt };

                // Asegurar que tiene color
                if (!processed.color) {
                    processed.color = DAY_COLORS[idx % DAY_COLORS.length];
                }

                // Si está en modo porcentaje, calcular los gramos
                if (dt.macroMode === 'percent' && dt.kcal) {
                    const kcal = parseFloat(dt.kcal) || 0;
                    const pPct = parseFloat(dt.protein_pct) || 30;
                    const cPct = parseFloat(dt.carbs_pct) || 45;
                    const fPct = parseFloat(dt.fat_pct) || 25;

                    processed.protein_g = Math.round((kcal * (pPct / 100)) / 4);
                    processed.carbs_g = Math.round((kcal * (cPct / 100)) / 4);
                    processed.fat_g = Math.round((kcal * (fPct / 100)) / 9);
                }
                // Si está en modo gramos, SIEMPRE calcular kcal desde los gramos
                else if (dt.macroMode === 'grams' || !dt.macroMode) {
                    if (dt.protein_g || dt.carbs_g || dt.fat_g) {
                        const p = parseFloat(dt.protein_g) || 0;
                        const c = parseFloat(dt.carbs_g) || 0;
                        const f = parseFloat(dt.fat_g) || 0;
                        // SIEMPRE recalcular - no mantener el kcal viejo
                        processed.kcal = Math.round(p * 4 + c * 4 + f * 9);
                    }
                }

                return processed;
            });

            const plan = {
                target: clientId,
                mode,
                status,
                name: planName.trim(),
                description: planDescription.trim(),
                customPlan: mode === 'custom' ? {
                    dayTargets: processedDayTargets,
                    weekSchedule,
                } : null,
            };

            const res = await fetch(`${API_URL}/api/nutrition-plans`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(plan),
            });

            const data = await res.json();
            if (data.success) {
                Alert.alert(
                    '✅ Guardado',
                    status === 'active' ? 'Plan activado correctamente' : 'Borrador guardado',
                    [{ text: 'OK', onPress: () => router.back() }]
                );
            } else {
                Alert.alert('Error', data.message || 'No se pudo guardar');
            }
        } catch (error) {
            console.error('[Save] Error:', error);
            Alert.alert('Error', 'Error de conexión');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#22c55e" />
                    <Text style={styles.loadingText}>Cargando...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1e293b" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Plan Nutricional</Text>
                    <Text style={styles.headerSubtitle}>{clientName || 'Cliente'}</Text>
                </View>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* Mode Selector */}
                <View style={styles.modeSelector}>
                    <TouchableOpacity
                        style={[styles.modeBtn, mode === 'auto' && styles.modeBtnActive]}
                        onPress={() => setMode('auto')}
                    >
                        <Ionicons
                            name="calculator"
                            size={20}
                            color={mode === 'auto' ? '#fff' : '#64748b'}
                        />
                        <Text style={[styles.modeBtnText, mode === 'auto' && styles.modeBtnTextActive]}>
                            Auto (Fórmula)
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, mode === 'custom' && styles.modeBtnActive]}
                        onPress={() => {
                            setMode('custom');
                            if (dayTargets.length === 0) addDayTarget();
                        }}
                    >
                        <Ionicons
                            name="create"
                            size={20}
                            color={mode === 'custom' ? '#fff' : '#64748b'}
                        />
                        <Text style={[styles.modeBtnText, mode === 'custom' && styles.modeBtnTextActive]}>
                            Personalizado
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* AUTO MODE - Preview */}
                {mode === 'auto' && (
                    <View style={styles.autoPreview}>
                        <Text style={styles.sectionTitle}>🔢 Cálculo Automático</Text>
                        <Text style={styles.sectionSubtitle}>
                            Basado en los datos del cliente (BMR × AF + objetivo)
                        </Text>

                        {autoNutrition ? (
                            <View style={styles.autoCard}>
                                <View style={styles.autoRow}>
                                    <Text style={styles.autoLabel}>Objetivo</Text>
                                    <Text style={[styles.autoValue, {
                                        color: autoNutrition.isVolumen ? '#3b82f6' : '#ef4444'
                                    }]}>
                                        {autoNutrition.objetivo}
                                    </Text>
                                </View>
                                <View style={styles.autoRow}>
                                    <Text style={styles.autoLabel}>Kcal (entreno)</Text>
                                    <Text style={styles.autoValueBig}>{autoNutrition.training.kcal}</Text>
                                </View>
                                <View style={styles.autoRow}>
                                    <Text style={styles.autoLabel}>Proteína</Text>
                                    <Text style={styles.autoValue}>{autoNutrition.training.protein}g</Text>
                                </View>
                                <View style={styles.autoRow}>
                                    <Text style={styles.autoLabel}>Carbs</Text>
                                    <Text style={styles.autoValue}>{autoNutrition.training.carbs}g</Text>
                                </View>
                                <View style={styles.autoRow}>
                                    <Text style={styles.autoLabel}>Grasas</Text>
                                    <Text style={styles.autoValue}>{autoNutrition.training.fat}g</Text>
                                </View>
                                <View style={styles.autoRow}>
                                    <Text style={styles.autoLabel}>Agua (entreno)</Text>
                                    <Text style={styles.autoValue}>{autoNutrition.training.water.liters}L</Text>
                                </View>
                                <View style={styles.autoRow}>
                                    <Text style={styles.autoLabel}>Pasos</Text>
                                    <Text style={styles.autoValue}>{autoNutrition.steps.text}</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.noDataCard}>
                                <Ionicons name="alert-circle-outline" size={40} color="#f59e0b" />
                                <Text style={styles.noDataText}>
                                    El cliente no tiene datos completos (edad, peso, altura, género)
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* CUSTOM MODE */}
                {mode === 'custom' && (
                    <>
                        {/* Plan Name & Description */}
                        <View style={styles.planInfoSection}>
                            <Text style={styles.sectionTitle}>📝 Información del Plan</Text>
                            <TextInput
                                style={styles.planNameInput}
                                value={planName}
                                onChangeText={setPlanName}
                                placeholder="Nombre del plan (ej: Dieta definición Juan)"
                                placeholderTextColor="#94a3b8"
                            />
                            <TextInput
                                style={styles.planDescInput}
                                value={planDescription}
                                onChangeText={setPlanDescription}
                                placeholder="Descripción opcional..."
                                placeholderTextColor="#94a3b8"
                                multiline
                            />
                        </View>

                        {/* Action Buttons Row */}
                        <View style={styles.templateActionsRow}>
                            <TouchableOpacity
                                style={styles.loadTemplateBtn}
                                onPress={openTemplateModal}
                            >
                                <Ionicons name="download-outline" size={18} color="#8b5cf6" />
                                <Text style={styles.loadTemplateBtnText}>Cargar Plan</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.saveAsTemplateBtn}
                                onPress={saveAsTemplate}
                                disabled={isSavingAsTemplate}
                            >
                                {isSavingAsTemplate ? (
                                    <ActivityIndicator size="small" color="#22c55e" />
                                ) : (
                                    <>
                                        <Ionicons name="bookmark-outline" size={18} color="#22c55e" />
                                        <Text style={styles.saveAsTemplateBtnText}>Guardar como Plan</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.customSection}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>📋 Tipos de Día</Text>
                                <TouchableOpacity style={styles.addBtn} onPress={addDayTarget}>
                                    <Ionicons name="add" size={20} color="#22c55e" />
                                    <Text style={styles.addBtnText}>Añadir</Text>
                                </TouchableOpacity>
                            </View>

                            {dayTargets.map((dt, idx) => (
                                <DayTargetCard
                                    key={dt.id}
                                    dayTarget={dt}
                                    index={idx}
                                    onUpdate={updateDayTarget}
                                    onDelete={deleteDayTarget}
                                />
                            ))}
                        </View>

                        {dayTargets.length > 0 && (
                            <WeekSchedulePicker
                                weekSchedule={weekSchedule}
                                dayTargets={dayTargets}
                                onChange={updateWeekSchedule}
                            />
                        )}
                    </>
                )}

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.draftBtn}
                        onPress={() => handleSave('draft')}
                        disabled={isSaving}
                    >
                        <Ionicons name="save-outline" size={20} color="#64748b" />
                        <Text style={styles.draftBtnText}>Guardar Borrador</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.activateBtn}
                        onPress={() => handleSave('active')}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                <Text style={styles.activateBtnText}>Activar Plan</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Template Selection Modal */}
            <Modal
                visible={showTemplateModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowTemplateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Cargar Plan</Text>
                            <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {loadingTemplates ? (
                            <View style={styles.modalLoading}>
                                <ActivityIndicator size="large" color="#8b5cf6" />
                            </View>
                        ) : templates.length === 0 ? (
                            <View style={styles.modalEmpty}>
                                <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
                                <Text style={styles.modalEmptyText}>No tienes planes guardados</Text>
                                <Text style={styles.modalEmptySubtext}>
                                    Crea planes desde el menú de Nutrición
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={templates}
                                keyExtractor={(item) => item._id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.templateItem}
                                        onPress={() => applyTemplate(item)}
                                    >
                                        <View style={styles.templateItemLeft}>
                                            <Ionicons name="document-text" size={24} color="#8b5cf6" />
                                            <View>
                                                <Text style={styles.templateItemName}>{item.name}</Text>
                                                {item.description ? (
                                                    <Text style={styles.templateItemDesc} numberOfLines={1}>
                                                        {item.description}
                                                    </Text>
                                                ) : null}
                                                <Text style={styles.templateItemMeta}>
                                                    {item.customPlan?.dayTargets?.length || 0} tipos de día
                                                </Text>
                                            </View>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}
                                contentContainerStyle={styles.templateList}
                            />
                        )}
                    </View>
                </View>
            </Modal>
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
        color: '#64748b',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backBtn: {
        padding: 8,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#64748b',
    },
    headerRight: {
        width: 40,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },

    // Mode Selector
    modeSelector: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    modeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#e2e8f0',
        gap: 8,
    },
    modeBtnActive: {
        backgroundColor: '#22c55e',
        borderColor: '#22c55e',
    },
    modeBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    modeBtnTextActive: {
        color: '#fff',
    },

    // Sections
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },

    // Auto Preview
    autoPreview: {
        marginBottom: 20,
    },
    autoCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    autoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    autoLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    autoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    autoValueBig: {
        fontSize: 20,
        fontWeight: '700',
        color: '#22c55e',
    },
    noDataCard: {
        backgroundColor: '#fffbeb',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fcd34d',
    },
    noDataText: {
        fontSize: 14,
        color: '#92400e',
        textAlign: 'center',
        marginTop: 12,
    },

    // Custom Section
    customSection: {
        marginBottom: 20,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 4,
    },
    addBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#22c55e',
    },

    // Day Target Card
    dayTargetCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    dayTargetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    colorPickerRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        flexWrap: 'wrap',
    },
    colorDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorDotActive: {
        borderColor: '#1e293b',
        transform: [{ scale: 1.1 }],
    },
    dayTargetName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        padding: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        marginRight: 8,
    },
    deleteBtn: {
        padding: 8,
    },
    trainingToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8,
    },
    trainingToggleText: {
        fontSize: 13,
        fontWeight: '500',
    },

    // Macro Mode Toggle
    macroModeContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    macroModeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 6,
    },
    macroModeBtnActive: {
        backgroundColor: '#8b5cf6',
        borderColor: '#8b5cf6',
    },
    macroModeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    macroModeTextActive: {
        color: '#fff',
    },

    // Calculated Row
    calculatedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        padding: 8,
        borderRadius: 8,
        marginBottom: 10,
        gap: 12,
    },
    calculatedLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    calculatedValue: {
        fontSize: 13,
        color: '#1e293b',
        fontWeight: '600',
    },

    // Warning Row
    warningRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fffbeb',
        padding: 8,
        borderRadius: 8,
        marginBottom: 10,
        gap: 6,
    },
    warningText: {
        fontSize: 12,
        color: '#92400e',
    },

    // Macros Grid - Wrap style para móviles
    macrosGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    extrasRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    macroInputContainer: {
        width: '23%',
        minWidth: 65,
    },
    macroInputLabel: {
        fontSize: 10,
        color: '#64748b',
        marginBottom: 2,
        textAlign: 'center',
    },
    macroInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    macroInput: {
        width: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 6,
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
        borderWidth: 1.5,
        textAlign: 'center',
    },
    macroInputSuffix: {
        fontSize: 10,
        fontWeight: '600',
        marginLeft: 2,
        position: 'absolute',
        right: 4,
        top: 8,
    },
    notesInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
        color: '#1e293b',
        minHeight: 50,
        textAlignVertical: 'top',
    },

    // Week Schedule
    weekScheduleContainer: {
        marginBottom: 20,
    },
    dayTypeLegend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    legendText: {
        fontSize: 12,
        color: '#64748b',
    },
    weekRowSimple: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 6,
    },
    weekDayBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        minWidth: 40,
    },
    weekDayBtnLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
        opacity: 0.9,
    },
    weekDayBtnType: {
        fontSize: 16,
        fontWeight: '800',
        color: '#fff',
        marginTop: 2,
    },
    weekGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    weekDayItem: {
        flex: 1,
        minWidth: 45,
        alignItems: 'center',
    },
    weekDayLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 6,
    },
    weekDayDropdown: {
        gap: 4,
    },
    weekDayOption: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    weekDayOptionActive: {
        backgroundColor: '#22c55e',
    },
    weekDayOptionText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748b',
        textAlign: 'center',
    },
    weekDayOptionTextActive: {
        color: '#fff',
    },

    // Action Buttons
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    draftBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        gap: 8,
    },
    draftBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    activateBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#22c55e',
        gap: 8,
    },
    activateBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },

    // Plan Info Section
    planInfoSection: {
        marginBottom: 16,
    },
    planNameInput: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginTop: 8,
        marginBottom: 8,
    },
    planDescInput: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minHeight: 50,
        textAlignVertical: 'top',
    },

    // Template Actions Row
    templateActionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    loadTemplateBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8b5cf615',
        padding: 12,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: '#8b5cf630',
    },
    loadTemplateBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8b5cf6',
    },
    saveAsTemplateBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#22c55e15',
        padding: 12,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: '#22c55e30',
    },
    saveAsTemplateBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#22c55e',
    },

    // Template Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '70%',
        minHeight: 300,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    modalLoading: {
        padding: 60,
        alignItems: 'center',
    },
    modalEmpty: {
        padding: 40,
        alignItems: 'center',
    },
    modalEmptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 12,
    },
    modalEmptySubtext: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
        textAlign: 'center',
    },
    templateList: {
        padding: 16,
    },
    templateItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    templateItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    templateItemName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    templateItemDesc: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    templateItemMeta: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
});
