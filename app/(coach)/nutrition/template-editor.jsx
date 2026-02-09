/* app/(coach)/nutrition/template-editor.jsx - Editor de Planes Nutricionales */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { EnhancedTextInput } from '../../../components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import WeeklyMealPlanner from './components/WeeklyMealPlanner';

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

// Componente para input numérico compacto
const MacroInput = ({ label, value, onChange, placeholder, suffix, color = '#64748b' }) => (
    <View style={styles.macroInputWrapper}>
        <View style={[styles.macroInputContainer, { borderColor: color + '40' }]}>
            <Text style={[styles.macroInputLabel, { color }]}>{label}</Text>
            <EnhancedTextInput
                containerStyle={styles.macroInputInner}
                style={styles.macroInputText}
                value={value != null ? String(value) : ''}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor="#cbd5e1"
                keyboardType="numeric"
            />
            {suffix ? <Text style={styles.macroInputSuffix}>{suffix}</Text> : null}
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

    // Validación: suma de porcentajes
    const totalPct = (parseFloat(dayTarget.protein_pct) || 0) +
        (parseFloat(dayTarget.carbs_pct) || 0) +
        (parseFloat(dayTarget.fat_pct) || 0);
    const pctWarning = macroMode === 'percent' && totalPct > 0 && Math.abs(totalPct - 100) > 5;

    const dayColor = dayTarget.color || DAY_COLORS[index % DAY_COLORS.length];

    return (
        <View style={[styles.dayTargetCard, { borderLeftColor: dayColor }]}>
            <View style={styles.cardHeaderRow}>
                {/* Name Input */}
                <View style={[styles.dayNameInputWrapper, { borderLeftColor: dayColor }]}>
                    <EnhancedTextInput
                        containerStyle={styles.dayNameInputContainer}
                        style={styles.dayTargetNameText}
                        value={dayTarget.name}
                        onChangeText={(v) => onUpdate(index, 'name', v)}
                        placeholder={`Tipo de día ${index + 1}`}
                        placeholderTextColor="#94a3b8"
                    />
                </View>

                {/* Training Toggle (Compact Icon) */}
                <TouchableOpacity
                    style={[
                        styles.compactToggle,
                        dayTarget.isTrainingDay ? styles.toggleActive : styles.toggleInactive
                    ]}
                    onPress={() => onUpdate(index, 'isTrainingDay', !dayTarget.isTrainingDay)}
                >
                    <Ionicons
                        name={dayTarget.isTrainingDay ? 'barbell' : 'bed'}
                        size={16}
                        color={dayTarget.isTrainingDay ? '#fff' : '#64748b'}
                    />
                </TouchableOpacity>

                {/* Delete */}
                <TouchableOpacity onPress={() => onDelete(index)} style={styles.compactDeleteBtn}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
            </View>

            {/* Color & Mode Row */}
            <View style={styles.controlsRow}>
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

                <View style={styles.modeSwitch}>
                    <TouchableOpacity
                        style={[styles.modeSwitchItem, macroMode === 'percent' && styles.modeSwitchActive]}
                        onPress={() => onUpdate(index, 'macroMode', 'percent')}
                    >
                        <Text style={[styles.modeSwitchText, macroMode === 'percent' && styles.modeSwitchTextActive]}>%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeSwitchItem, macroMode === 'grams' && styles.modeSwitchActive]}
                        onPress={() => onUpdate(index, 'macroMode', 'grams')}
                    >
                        <Text style={[styles.modeSwitchText, macroMode === 'grams' && styles.modeSwitchTextActive]}>g</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.divider} />

            {/* INPUTS GRID */}
            <View style={styles.inputsGrid}>
                {/* Modo PORCENTAJE */}
                {macroMode === 'percent' && (
                    <>
                        <MacroInput
                            label="Kcal Objetivo"
                            value={dayTarget.kcal?.toString() || ''}
                            onChange={(v) => onUpdate(index, 'kcal', v ? parseInt(v) : '')}
                            placeholder="2500"
                            color="#1e293b"
                        />
                        <View style={styles.rowBreak} />
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
                    </>
                )}

                {/* Modo GRAMOS */}
                {macroMode === 'grams' && (
                    <>
                        <MacroInput
                            label="Proteína"
                            value={dayTarget.protein_g?.toString() || ''}
                            onChange={(v) => onUpdate(index, 'protein_g', v ? parseInt(v) : '')}
                            placeholder="160"
                            suffix="g"
                            color="#ef4444"
                        />
                        <MacroInput
                            label="Carbs"
                            value={dayTarget.carbs_g?.toString() || ''}
                            onChange={(v) => onUpdate(index, 'carbs_g', v ? parseInt(v) : '')}
                            placeholder="200"
                            suffix="g"
                            color="#3b82f6"
                        />
                        <MacroInput
                            label="Grasas"
                            value={dayTarget.fat_g?.toString() || ''}
                            onChange={(v) => onUpdate(index, 'fat_g', v ? parseInt(v) : '')}
                            placeholder="60"
                            suffix="g"
                            color="#f59e0b"
                        />
                    </>
                )}
            </View>

            {/* Resultado calculado */}
            {(macroMode === 'percent' ? calculatedMacros : calculatedKcal) && (
                <View style={styles.resultBar}>
                    {macroMode === 'percent' && calculatedMacros ? (
                        <>
                            <Text style={styles.resultLabel}>Estimado:</Text>
                            <Text style={styles.resultValue}>⚡ {dayTarget.kcal || 0}</Text>
                            <Text style={[styles.resultValue, { color: '#ef4444' }]}>P: {calculatedMacros.protein}g</Text>
                            <Text style={[styles.resultValue, { color: '#3b82f6' }]}>C: {calculatedMacros.carbs}g</Text>
                            <Text style={[styles.resultValue, { color: '#f59e0b' }]}>G: {calculatedMacros.fat}g</Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.resultLabel}>Total Calórico:</Text>
                            <Text style={[styles.resultValue, { fontSize: 15, color: '#22c55e' }]}>
                                ⚡ {calculatedKcal} kcal
                            </Text>
                        </>
                    )}
                </View>
            )}

            {pctWarning && (
                <Text style={styles.warningTextSmall}>⚠️ La suma de % no es 100% ({totalPct}%)</Text>
            )}

            {/* Extras Grid */}
            <View style={styles.extrasGrid}>
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
                    placeholder="8k"
                    suffix=""
                    color="#10b981"
                />
                <MacroInput
                    label="Fibra"
                    value={dayTarget.fiber_g?.toString() || ''}
                    onChange={(v) => onUpdate(index, 'fiber_g', v ? parseInt(v) : '')}
                    placeholder="25"
                    suffix="g"
                    color="#84cc16"
                />
            </View>

            {/* Notes */}
            <EnhancedTextInput
                containerStyle={styles.notesInputCompact}
                style={styles.notesInputText}
                value={dayTarget.notes || ''}
                onChangeText={(v) => onUpdate(index, 'notes', v)}
                placeholder="Notas o instrucciones (opcional)"
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
            onChange(dayKey, dayTargets[0]?.id || null);
        } else {
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

export default function TemplateEditorScreen() {
    const router = useRouter();
    const { templateId, mode: paramMode } = useLocalSearchParams();
    const { token } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [templateFolder, setTemplateFolder] = useState('');
    const [folders, setFolders] = useState([]);
    const [showFolderPicker, setShowFolderPicker] = useState(false);

    // Editor mode: 'custom' (flex/macros) or 'mealplan' (complete with foods)
    const [editorMode, setEditorMode] = useState(paramMode || 'custom');

    // Custom mode state
    const [dayTargets, setDayTargets] = useState([]);
    const [weekSchedule, setWeekSchedule] = useState({
        monday: null, tuesday: null, wednesday: null, thursday: null,
        friday: null, saturday: null, sunday: null
    });

    // Mealplan mode state
    const [mealPlan, setMealPlan] = useState(null);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';
    const isEditing = !!templateId;

    useEffect(() => {
        fetchFolders();
        if (templateId) {
            fetchTemplate();
        } else {
            if (editorMode === 'custom') addDayTarget();
            setIsLoading(false);
        }
    }, [templateId]);

    const fetchFolders = async () => {
        try {
            const res = await fetch(`${API_URL}/api/nutrition-plans/templates/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setFolders(data.folders || []);
            }
        } catch (e) {
            console.log('[TemplateEditor] Could not fetch folders');
        }
    };

    const fetchTemplate = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`${API_URL}/api/nutrition-plans/templates/${templateId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.template) {
                const t = data.template;
                setTemplateName(t.name || '');
                setTemplateDescription(t.description || '');
                setTemplateFolder(t.folder || '');

                // Auto-detect template type
                const hasMeals = t.planType === 'complete' ||
                    (t.dayTemplates && t.dayTemplates.length > 0 && t.dayTemplates[0]?.meals?.length > 0);

                if (hasMeals) {
                    setEditorMode('mealplan');
                    setMealPlan({
                        name: t.name,
                        dayTemplates: t.dayTemplates || [],
                        weekMap: t.weekMap || {},
                        mealStructure: t.mealStructure || [],
                    });
                } else {
                    setEditorMode('custom');
                    setDayTargets(t.customPlan?.dayTargets || []);
                    setWeekSchedule(t.customPlan?.weekSchedule || {});
                }
            }
        } catch (error) {
            console.error('[TemplateEditor] Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Add new day target
    const addDayTarget = () => {
        const newTarget = {
            id: `day_${Date.now()}`,
            name: dayTargets.length === 0 ? 'Día de entrenamiento' : 'Día de descanso',
            isTrainingDay: dayTargets.length === 0,
            macroMode: 'grams',
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
            if (Platform.OS === 'web') {
                window.alert('Mínimo requerido: Necesitas al menos un tipo de día');
            } else {
                Alert.alert('Mínimo requerido', 'Necesitas al menos un tipo de día');
            }
            return;
        }

        if (Platform.OS === 'web') {
            if (window.confirm('Eliminar tipo de día: ¿Estás seguro?')) {
                const updated = dayTargets.filter((_, i) => i !== index);
                setDayTargets(updated);
            }
        } else {
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
        }
    };

    const updateWeekSchedule = (day, targetId) => {
        setWeekSchedule({ ...weekSchedule, [day]: targetId });
    };

    const handleSave = async () => {
        if (!templateName.trim()) {
            if (Platform.OS === 'web') {
                window.alert('Nombre requerido: Por favor introduce un nombre para el plan');
            } else {
                Alert.alert('Nombre requerido', 'Por favor introduce un nombre para el plan');
            }
            return;
        }

        try {
            setIsSaving(true);

            let body = {
                templateId: templateId || undefined,
                name: templateName.trim(),
                description: templateDescription.trim(),
                folder: templateFolder.trim() || null,
            };

            if (editorMode === 'mealplan') {
                // Mealplan mode: save dayTemplates with foods
                body.dayTemplates = mealPlan?.dayTemplates || [];
                body.weekMap = mealPlan?.weekMap || {};
                body.mealStructure = mealPlan?.mealStructure || [];
                body.planType = 'complete';
            } else {
                // Custom/Flex mode: save dayTargets with macros
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

                body.customPlan = {
                    dayTargets: processedDayTargets,
                    weekSchedule,
                };
                body.planType = 'flex';
            }

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
                if (Platform.OS === 'web') {
                    if (window.confirm(isEditing ? '✅ Plan actualizado' : '✅ Plan creado')) {
                        router.canGoBack() ? router.back() : router.replace('/(coach)');
                    } else {
                        // Even if cancelled, we probably should go back or stay? 
                        // Usually 'OK' implies navigation.
                        router.canGoBack() ? router.back() : router.replace('/(coach)');
                    }
                } else {
                    Alert.alert(
                        '✅ Guardado',
                        isEditing ? 'Plan actualizado' : 'Plan creado',
                        [{ text: 'OK', onPress: () => router.canGoBack() ? router.back() : router.replace('/(coach)') }]
                    );
                }
            } else {
                if (Platform.OS === 'web') {
                    window.alert('Error: ' + (data.message || 'No se pudo guardar'));
                } else {
                    Alert.alert('Error', data.message || 'No se pudo guardar');
                }
            }
        } catch (error) {
            console.error('[TemplateEditor] Save error:', error);
            if (Platform.OS === 'web') {
                window.alert('Error: Error de conexión');
            } else {
                Alert.alert('Error', 'Error de conexión');
            }
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
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(coach)')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1e293b" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>
                        {isEditing ? 'Editar Plan' : 'Nuevo Plan'}
                    </Text>
                </View>
                <View style={styles.headerRight} />
            </View>

            {/* Mode Selector (only when creating new) */}
            {!isEditing && (
                <View style={styles.modeSelector}>
                    <TouchableOpacity
                        style={[styles.modeBtn, editorMode === 'mealplan' && styles.modeBtnActive]}
                        onPress={() => setEditorMode('mealplan')}
                    >
                        <Ionicons name="restaurant" size={18} color={editorMode === 'mealplan' ? '#fff' : '#64748b'} />
                        <Text style={[styles.modeBtnText, editorMode === 'mealplan' && styles.modeBtnTextActive]}>Completa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, editorMode === 'custom' && styles.modeBtnActive]}
                        onPress={() => setEditorMode('custom')}
                    >
                        <Ionicons name="create" size={18} color={editorMode === 'custom' ? '#fff' : '#64748b'} />
                        <Text style={[styles.modeBtnText, editorMode === 'custom' && styles.modeBtnTextActive]}>Flex</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Mode badge when editing */}
            {isEditing && (
                <View style={styles.modeBadgeRow}>
                    <View style={[styles.modeBadge, { backgroundColor: editorMode === 'mealplan' ? '#22c55e20' : '#3b82f620' }]}>
                        <Ionicons
                            name={editorMode === 'mealplan' ? 'restaurant' : 'create'}
                            size={14}
                            color={editorMode === 'mealplan' ? '#22c55e' : '#3b82f6'}
                        />
                        <Text style={[styles.modeBadgeText, { color: editorMode === 'mealplan' ? '#22c55e' : '#3b82f6' }]}>
                            {editorMode === 'mealplan' ? 'Dieta Completa' : 'Plan Flex'}
                        </Text>
                    </View>
                </View>
            )}

            {/* METADATA (name, description, folder) - always in a ScrollView section */}
            {editorMode === 'custom' ? (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    {/* Nombre y descripción */}
                    <View style={styles.templateInfoSection}>
                        <Text style={styles.sectionTitle}>Información</Text>
                        <EnhancedTextInput
                            containerStyle={styles.templateNameInputContainer}
                            style={styles.templateNameInputText}
                            value={templateName}
                            onChangeText={setTemplateName}
                            placeholder="Nombre del plan (ej: Dieta volumen 3000kcal)"
                            placeholderTextColor="#94a3b8"
                        />
                        <EnhancedTextInput
                            containerStyle={styles.templateDescInputContainer}
                            style={styles.templateDescInputText}
                            value={templateDescription}
                            onChangeText={setTemplateDescription}
                            placeholder="Descripción opcional..."
                            placeholderTextColor="#94a3b8"
                            multiline
                        />

                        {/* Folder Picker */}
                        <TouchableOpacity
                            style={styles.folderPickerBtn}
                            onPress={() => setShowFolderPicker(!showFolderPicker)}
                        >
                            <Ionicons name="folder-outline" size={18} color="#8b5cf6" />
                            <Text style={styles.folderPickerText}>
                                {templateFolder || 'Sin carpeta'}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color="#64748b" />
                        </TouchableOpacity>

                        {showFolderPicker && (
                            <View style={styles.folderDropdown}>
                                <TouchableOpacity
                                    style={[styles.folderOption, !templateFolder && styles.folderOptionActive]}
                                    onPress={() => { setTemplateFolder(''); setShowFolderPicker(false); }}
                                >
                                    <Text style={styles.folderOptionText}>Sin carpeta</Text>
                                </TouchableOpacity>
                                {folders.map(f => (
                                    <TouchableOpacity
                                        key={f}
                                        style={[styles.folderOption, templateFolder === f && styles.folderOptionActive]}
                                        onPress={() => { setTemplateFolder(f); setShowFolderPicker(false); }}
                                    >
                                        <Text style={styles.folderOptionText}>{f}</Text>
                                    </TouchableOpacity>
                                ))}
                                <EnhancedTextInput
                                    containerStyle={styles.newFolderInputContainer}
                                    style={styles.newFolderInputText}
                                    placeholder="Nueva carpeta..."
                                    placeholderTextColor="#94a3b8"
                                    onSubmitEditing={(e) => {
                                        const val = e.nativeEvent.text.trim();
                                        if (val && !folders.includes(val)) {
                                            setFolders([...folders, val]);
                                        }
                                        if (val) setTemplateFolder(val);
                                        setShowFolderPicker(false);
                                    }}
                                />
                            </View>
                        )}
                    </View>

                    {/* Day Targets */}
                    <View style={styles.customSection}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Tipos de Día</Text>
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

                    {/* Save Button */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.saveBtn}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="save" size={20} color="#fff" />
                                    <Text style={styles.saveBtnText}>
                                        {isEditing ? 'Actualizar Plan' : 'Guardar Plan'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            ) : (
                /* MEALPLAN MODE */
                <View style={{ flex: 1 }}>
                    {/* Compact metadata row */}
                    <View style={styles.mealplanMetaRow}>
                        <EnhancedTextInput
                            containerStyle={styles.mealplanNameInputContainer}
                            style={styles.mealplanNameInputText}
                            value={templateName}
                            onChangeText={setTemplateName}
                            placeholder="Nombre del plan..."
                            placeholderTextColor="#94a3b8"
                        />
                        <TouchableOpacity
                            style={styles.folderPickerBtnCompact}
                            onPress={() => setShowFolderPicker(!showFolderPicker)}
                        >
                            <Ionicons name="folder-outline" size={16} color="#8b5cf6" />
                            <Text style={{ fontSize: 12, color: '#8b5cf6' }} numberOfLines={1}>
                                {templateFolder || 'Carpeta'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {showFolderPicker && (
                        <View style={[styles.folderDropdown, { marginHorizontal: 12, marginBottom: 8 }]}>
                            <TouchableOpacity
                                style={[styles.folderOption, !templateFolder && styles.folderOptionActive]}
                                onPress={() => { setTemplateFolder(''); setShowFolderPicker(false); }}
                            >
                                <Text style={styles.folderOptionText}>Sin carpeta</Text>
                            </TouchableOpacity>
                            {folders.map(f => (
                                <TouchableOpacity
                                    key={f}
                                    style={[styles.folderOption, templateFolder === f && styles.folderOptionActive]}
                                    onPress={() => { setTemplateFolder(f); setShowFolderPicker(false); }}
                                >
                                    <Text style={styles.folderOptionText}>{f}</Text>
                                </TouchableOpacity>
                            ))}
                            <EnhancedTextInput
                                containerStyle={styles.newFolderInputContainer}
                                style={styles.newFolderInputText}
                                placeholder="Nueva carpeta..."
                                placeholderTextColor="#94a3b8"
                                onSubmitEditing={(e) => {
                                    const val = e.nativeEvent.text.trim();
                                    if (val && !folders.includes(val)) {
                                        setFolders([...folders, val]);
                                    }
                                    if (val) setTemplateFolder(val);
                                    setShowFolderPicker(false);
                                }}
                            />
                        </View>
                    )}

                    {/* WeeklyMealPlanner */}
                    <WeeklyMealPlanner
                        clientId={null}
                        initialData={mealPlan}
                        onDataChange={(data) => setMealPlan(data)}
                        showFooter={false}
                    />

                    {/* Save Footer */}
                    <View style={styles.mealplanFooter}>
                        <TouchableOpacity
                            style={styles.saveBtn}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="save" size={20} color="#fff" />
                                    <Text style={styles.saveBtnText}>
                                        {isEditing ? 'Actualizar Plan' : 'Guardar Plan'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}
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
    // Mode Selector
    modeSelector: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 4,
        backgroundColor: '#e2e8f0',
        borderRadius: 10,
        padding: 3,
    },
    modeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 8,
    },
    modeBtnActive: {
        backgroundColor: '#22c55e',
    },
    modeBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    modeBtnTextActive: {
        color: '#fff',
    },
    modeBadgeRow: {
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 4,
    },
    modeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    modeBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    // Mealplan metadata
    mealplanMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    mealplanNameInputContainer: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    mealplanNameInputText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    folderPickerBtnCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#8b5cf610',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#8b5cf630',
    },
    mealplanFooter: {
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#fff',
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

    // Template Info
    templateInfoSection: {
        marginBottom: 20,
    },
    templateNameInput: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 10,
    },
    templateNameInputContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 10,
    },
    templateNameInputText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },
    templateDescInput: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        fontSize: 14,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minHeight: 60,
        textAlignVertical: 'top',
        marginBottom: 10,
    },
    templateDescInputContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minHeight: 60,
        marginBottom: 10,
    },
    templateDescInputText: {
        fontSize: 14,
        color: '#1e293b',
        textAlignVertical: 'top',
    },
    folderPickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#8b5cf610',
        padding: 12,
        borderRadius: 10,
        gap: 8,
        borderWidth: 1,
        borderColor: '#8b5cf630',
    },
    folderPickerText: {
        flex: 1,
        fontSize: 14,
        color: '#8b5cf6',
        fontWeight: '500',
    },
    folderDropdown: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    folderOption: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    folderOptionActive: {
        backgroundColor: '#8b5cf615',
    },
    folderOptionText: {
        fontSize: 14,
        color: '#1e293b',
    },
    newFolderInput: {
        padding: 12,
        fontSize: 14,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
    },
    newFolderInputContainer: {
        padding: 12,
        backgroundColor: '#f8fafc',
    },
    newFolderInputText: {
        fontSize: 14,
        color: '#1e293b',
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

    // Day Target Card (Dense)
    dayTargetCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    dayNameInputWrapper: {
        flex: 1,
        position: 'relative',
    },
    dayNameInputContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    dayTargetNameText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    compactToggle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleActive: {
        backgroundColor: '#10b981',
    },
    toggleInactive: {
        backgroundColor: '#e2e8f0',
    },
    compactDeleteBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#fee2e2',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Controls Row
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    colorPickerRow: {
        flexDirection: 'row',
        gap: 6,
    },
    colorDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    colorDotActive: {
        borderWidth: 2,
        borderColor: '#1e293b',
        transform: [{ scale: 1.1 }],
    },
    modeSwitch: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        padding: 2,
    },
    modeSwitchItem: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    modeSwitchActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    modeSwitchText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    modeSwitchTextActive: {
        color: '#0f172a',
    },

    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 8,
    },

    // Grids
    inputsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    rowBreak: {
        width: '100%',
        height: 0,
    },
    macroInputWrapper: {
        flex: 1,
        minWidth: '30%',
    },
    macroInputContainer: {
        backgroundColor: '#fdfdfd',
        borderRadius: 8,
        borderWidth: 1,
        padding: 6,
    },
    macroInputLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginBottom: 2,
    },
    macroInputInner: {
        padding: 4,
        backgroundColor: '#f8fafc',
        borderRadius: 6,
    },
    macroInputText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
        padding: 0,
    },
    macroInputSuffix: {
        position: 'absolute',
        right: 8,
        bottom: 8,
        fontSize: 10,
        color: '#94a3b8',
    },

    // Results & Extras
    resultBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 8,
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    resultLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    resultValue: {
        fontSize: 12,
        color: '#1e293b',
        fontWeight: '700',
    },
    warningTextSmall: {
        fontSize: 11,
        color: '#d97706',
        marginBottom: 8,
        fontWeight: '500',
    },
    extrasGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    notesInputCompact: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 8,
        minHeight: 40,
        borderWidth: 1,
        borderColor: '#f1f5f9',
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

    // Action Buttons
    actionButtons: {
        marginTop: 20,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#22c55e',
        gap: 8,
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});
