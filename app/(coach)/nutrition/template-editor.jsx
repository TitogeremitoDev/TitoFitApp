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
            <EnhancedTextInput
                containerStyle={[styles.macroInputContainer, { borderColor: color + '40' }]}
                style={styles.macroInputText}
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
                <EnhancedTextInput
                    containerStyle={[styles.dayTargetNameContainer, { borderLeftColor: dayColor }]}
                    style={styles.dayTargetNameText}
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
            <EnhancedTextInput
                containerStyle={styles.notesInputContainer}
                style={styles.notesInputText}
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
    const { templateId } = useLocalSearchParams();
    const { token } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [templateFolder, setTemplateFolder] = useState('');
    const [folders, setFolders] = useState([]);
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [dayTargets, setDayTargets] = useState([]);
    const [weekSchedule, setWeekSchedule] = useState({
        monday: null, tuesday: null, wednesday: null, thursday: null,
        friday: null, saturday: null, sunday: null
    });

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';
    const isEditing = !!templateId;

    useEffect(() => {
        fetchFolders();
        if (templateId) {
            fetchTemplate();
        } else {
            addDayTarget();
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
                setTemplateName(data.template.name || '');
                setTemplateDescription(data.template.description || '');
                setTemplateFolder(data.template.folder || '');
                setDayTargets(data.template.customPlan?.dayTargets || []);
                setWeekSchedule(data.template.customPlan?.weekSchedule || {});
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

            // Procesar dayTargets para calcular valores finales
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
                templateId: templateId || undefined,
                name: templateName.trim(),
                description: templateDescription.trim(),
                folder: templateFolder.trim() || null,
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

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* Nombre y descripción */}
                <View style={styles.templateInfoSection}>
                    <Text style={styles.sectionTitle}>📝 Información</Text>
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
    dayTargetNameContainer: {
        flex: 1,
        padding: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        marginRight: 8,
    },
    dayTargetNameText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
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

    // Macros Grid
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
    macroInputContainer: {
        width: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderWidth: 1.5,
    },
    macroInputText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
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
    notesInputContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        minHeight: 50,
    },
    notesInputText: {
        fontSize: 13,
        color: '#1e293b',
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
