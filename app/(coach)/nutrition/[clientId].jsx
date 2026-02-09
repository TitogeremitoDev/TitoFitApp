/* app/(coach)/nutrition/[clientId].jsx - Editor de Plan Nutricional */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Modal,
    FlatList,
    Platform,
    useWindowDimensions,
    Image,
    Dimensions,
} from 'react-native';
import { EnhancedTextInput } from '../../../components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { useFeedbackBubble } from '../../../context/FeedbackBubbleContext';
import { calculateFullNutrition, ACTIVITY_FACTORS } from '../../../src/utils/nutritionCalculator';
import ClientSidebar from '../../../src/components/coach/ClientSidebar';
import WeeklyMealPlanner from './components/WeeklyMealPlanner';
import { generateAndShareNutritionPDF } from '../../../src/services/pdfGenerator';

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

const CoachNutritionTopRightCard = ({ autoNutrition, clientName, clientData, isWideScreen }) => {
    // Fallback defaults if autoNutrition is missing (e.g. missing profile data)
    const defaults = {
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    const data = autoNutrition?.training || defaults;
    const isVolumen = autoNutrition?.isVolumen ?? true;
    const isMantener = autoNutrition?.isMantener ?? false;
    const objetivo = autoNutrition?.objetivo || 'Perfil Incompleto';

    const goalColor = isVolumen ? '#3b82f6' : (isMantener ? '#f59e0b' : '#ef4444');

    // Mobile / Compact View
    if (!isWideScreen) {
        return (
            <View style={[styles.headerCardCompact, { borderColor: goalColor + '40', backgroundColor: goalColor + '10' }]}>
                <Text style={{ fontSize: 16 }}>🔥</Text>
                <Text style={[styles.headerCardKcalCompact, { color: goalColor }]}>{data.kcal || '---'}</Text>
                <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>kcal</Text>
            </View>
        );
    }

    // Desktop / Full View
    return (
        <View style={styles.headerCardContainer}>
            {/* Left: Profile Mini */}
            <View style={styles.headerCardProfile}>
                <View style={[styles.headerAvatar, { backgroundColor: goalColor, overflow: 'hidden' }]}>
                    {clientData?.avatarUrl ? (
                        <Image
                            source={{ uri: clientData.avatarUrl }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                    ) : (
                        <Text style={styles.headerAvatarText}>
                            {clientName ? clientName.substring(0, 2).toUpperCase() : 'CL'}
                        </Text>
                    )}
                </View>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.headerClientName} numberOfLines={1}>{clientName || 'Cliente'}</Text>
                        {autoNutrition ? (
                            <View style={[styles.headerBadge, { backgroundColor: goalColor + '20' }]}>
                                <Text style={[styles.headerBadgeText, { color: goalColor }]}>
                                    {objetivo}
                                </Text>
                            </View>
                        ) : (
                            <View style={[styles.headerBadge, { backgroundColor: '#cbd5e1' }]}>
                                <Text style={[styles.headerBadgeText, { color: '#64748b', fontSize: 9 }]}>
                                    PERFIL INCOMPLETO
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.headerSubtext}>
                        AF {clientData?.af || 1.55} • {clientData?.info_user?.peso || '--'}kg
                    </Text>
                </View>
            </View>

            <View style={styles.headerDivider} />

            {/* Right: Targets */}
            <View style={styles.headerCardTargets}>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.headerTargetKcal, { color: goalColor }]}>
                        🎯 {data.kcal ? data.kcal.toLocaleString() : '---'} <Text style={{ fontSize: 14, color: '#64748b' }}>kcal</Text>
                    </Text>
                </View>
                <View style={styles.headerMacrosRow}>
                    <Text style={styles.headerMacroItem}><Text style={{ fontWeight: '700', color: '#ef4444' }}>P:</Text> {data.protein}g</Text>
                    <Text style={styles.headerMacroDot}>•</Text>
                    <Text style={styles.headerMacroItem}><Text style={{ fontWeight: '700', color: '#3b82f6' }}>C:</Text> {data.carbs}g</Text>
                    <Text style={styles.headerMacroDot}>•</Text>
                    <Text style={styles.headerMacroItem}><Text style={{ fontWeight: '700', color: '#f59e0b' }}>G:</Text> {data.fat}g</Text>
                </View>
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
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [clientData, setClientData] = useState(null);
    const [mode, setMode] = useState('auto'); // 'auto' | 'custom' | 'mealplan'
    const [planName, setPlanName] = useState('');
    const [planDescription, setPlanDescription] = useState('');
    const [dayTargets, setDayTargets] = useState([]);
    const [weekSchedule, setWeekSchedule] = useState({
        monday: null, tuesday: null, wednesday: null, thursday: null,
        friday: null, saturday: null, sunday: null
    });
    const [isEditingName, setIsEditingName] = useState(false);

    // 🍽️ Meal Plan state (for 'mealplan' mode)
    const [mealPlan, setMealPlan] = useState(null);

    // 🛡️ Sensitive Mode (TCA)
    const [hideMacros, setHideMacros] = useState(false);

    // Template loading
    const [templates, setTemplates] = useState([]);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Force local connection to ensure we hit the user's local DB
    const API_URL = 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    // 🖥️ Responsive layout
    const { width: windowWidth } = useWindowDimensions();
    const isWideScreen = windowWidth >= 1024;

    // 🖥️ SIDEBAR: States for collapsible client list
    const [sidebarClients, setSidebarClients] = useState([]);
    const [sidebarLoading, setSidebarLoading] = useState(true);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Fetch sidebar clients
    const fetchSidebarClients = useCallback(async () => {
        if (!isWideScreen) return;
        try {
            setSidebarLoading(true);
            const res = await fetch(`${API_URL}/api/monitoring/coach/sidebar-status?context=nutrition`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setSidebarClients(data.clients || []);
            }
        } catch (error) {
            console.error('[Sidebar Nutrition] Error:', error);
        } finally {
            setSidebarLoading(false);
        }
    }, [token, API_URL, isWideScreen]);

    useEffect(() => {
        if (isWideScreen) {
            fetchSidebarClients();
        }
    }, [isWideScreen, fetchSidebarClients]);

    // Handle sidebar client selection
    const handleSidebarClientSelect = (client) => {
        router.push({
            pathname: '/(coach)/nutrition/[clientId]',
            params: { clientId: client._id, clientName: client.nombre }
        });
    };

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
                        // Force custom mode if planType is flex, otherwise trust mode or default to auto
                        const resolvedMode = (planData.plan.planType === 'flex') ? 'custom' : (planData.plan.mode || 'auto');

                        setMode(resolvedMode);
                        setPlanName(planData.plan.name || '');
                        setPlanDescription(planData.plan.description || '');

                        if (planData.plan.customPlan) {
                            setDayTargets(planData.plan.customPlan.dayTargets || []);
                            setWeekSchedule(planData.plan.customPlan.weekSchedule || {});
                        } else if (resolvedMode === 'custom' && planData.plan.dayTemplates) {
                            // 🛑 LEGACY HYDRATION: Fallback for when data is at root (legacy schema)
                            // Map dayTemplates -> dayTargets
                            const mappedTargets = planData.plan.dayTemplates.map(dt => {
                                // Extract macros from targetMacros or root
                                const macros = dt.targetMacros || {};
                                return {
                                    id: dt.id,
                                    name: dt.name,
                                    color: dt.color,
                                    // Use explicit flag if present, otherwise fallback to name guess
                                    isTrainingDay: (dt.isTraining !== undefined) ? dt.isTraining : (dt.name?.toLowerCase().includes('entreno') || false),
                                    macroMode: 'grams', // Default to grams for hydration
                                    kcal: macros.kcal || dt.kcal || '',
                                    protein_g: macros.protein || dt.protein_g || '',
                                    carbs_g: macros.carbs || dt.carbs_g || '',
                                    fat_g: macros.fat || dt.fat_g || '',
                                    water_ml: macros.water || dt.water_ml || '',
                                    steps_target: macros.steps || dt.steps_target || '',
                                    fiber_g: macros.fiber || dt.fiber_g || '',
                                    notes: dt.notes || ''
                                };
                            });
                            setDayTargets(mappedTargets);
                            setWeekSchedule(planData.plan.weekMap || {});
                        }

                        // Load mealPlan data for 'mealplan' mode
                        if (planData.plan.mealPlan) {
                            setMealPlan(planData.plan.mealPlan);
                        }
                    }
                    // Load Client Settings (Sensitive Mode)
                    if (planData.clientSettings) {
                        setHideMacros(planData.clientSettings.hideMacros);
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

    // Toggle Sensitive Mode
    const toggleSensitiveMode = async () => {
        const newValue = !hideMacros;
        setHideMacros(newValue); // Optimistic update
        try {
            const res = await fetch(`${API_URL}/api/nutrition-plans/clients/${clientId}/settings`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ hideMacros: newValue })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            if (Platform.OS === 'web') {
                // Toast or simple alert
                // console.log("Modo sensible actualizado");
            }
        } catch (error) {
            console.error("Error updating sensitive mode:", error);
            setHideMacros(!newValue); // Rollback
            Alert.alert('Error', 'No se pudo actualizar el modo sensible.');
        }
    };

    // Auto nutrition calculation
    const autoNutrition = useMemo(() => {
        if (!clientData?.info_user) return null;
        const info = clientData.info_user;
        if (!info.edad || !info.peso || !info.altura || !info.genero) return null;
        return calculateFullNutrition(info, info.objetivoPrincipal || info.objetivos || 'volumen', clientData.af || 1.55);
    }, [clientData]);

    // Add new day target
    const addDayTarget = (copyFrom = null) => {
        let newTarget;

        if (copyFrom) {
            newTarget = {
                ...copyFrom,
                id: `day_${Date.now()}`,
                name: `${copyFrom.name} (Copia)`,
                meals: [] // Don't copy meals, just targets
            };
        } else {
            const isTraining = dayTargets.length % 2 === 0; // Alternar simple
            newTarget = {
                id: `day_${Date.now()}`,
                name: isTraining ? 'Día de entrenamiento' : 'Día de descanso',
                color: DAY_COLORS[dayTargets.length % DAY_COLORS.length],
                // Modo macros: gramos por defecto
                macroMode: 'grams',
                // Valores iniciales vacíos o por defecto
                kcal: '',
                protein_g: '',
                carbs_g: '',
                fat_g: '',
                // Manual input fields
                water_ml: '',
                steps_target: '',
                fiber_g: '',

                notes: '',
                meals: []
            };
        }
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
            if (window.confirm('¿Estás seguro de eliminar este tipo de día?')) {
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
        // 1. Detect Plan Type
        const isMealPlan = template.planType === 'complete' || (template.dayTemplates && template.dayTemplates.length > 0 && template.dayTemplates[0].meals?.length > 0);

        if (isMealPlan) {
            // Apply as Meal Plan
            setMode('mealplan');
            setMealPlan({
                name: template.name,
                globalNotes: template.globalNotes || '', // If stored
                mealStructure: template.mealStructure || [],
                dayTemplates: template.dayTemplates || [],
                weekMap: template.weekMap || {}
            });
            // Hydrate simple Custom data too just in case they switch back
            // (Optional, or leave empty)
        } else {
            // Apply as Custom/Flex Plan
            setMode('custom');
            if (template.customPlan) {
                setDayTargets(template.customPlan.dayTargets || []);
                setWeekSchedule(template.customPlan.weekSchedule || {});
            } else {
                // Fallback for flat templates that might be flex but saved flat
                setDayTargets((template.dayTemplates || []).map(dt => ({
                    id: dt.id,
                    name: dt.name,
                    color: dt.color,
                    // Map back macros
                    kcal: dt.targetMacros?.kcal,
                    protein_g: dt.targetMacros?.protein,
                    carbs_g: dt.targetMacros?.carbs,
                    fat_g: dt.targetMacros?.fat,
                    // ... other fields
                    notes: dt.notes
                })));
                setWeekSchedule(template.weekMap || {});
            }
        }

        setShowTemplateModal(false);
        if (Platform.OS === 'web') {
            window.alert(`✅ Plan cargado: Se ha aplicado el plan "${template.name}"`);
        } else {
            Alert.alert('✅ Plan cargado', `Se ha aplicado el plan "${template.name}"`);
        }
    };

    // 🛑 LOG DE CONTROL: Vigilar sincronización con el hijo (WeeklyMealPlanner)
    useEffect(() => {
        // Safe access to deep property
        const foodCount = mealPlan?.dayTemplates?.[0]?.meals?.[0]?.options?.[0]?.foods?.length || 0;
        console.log("👀 PLAN EN EL PADRE ACTUALIZADO:", foodCount, "alimentos en el primer plato.");
    }, [mealPlan]);

    // Open template modal
    const openTemplateModal = () => {
        fetchTemplates();
        setShowTemplateModal(true);
    };

    // Save current plan as a template
    const saveAsTemplate = async () => {
        // Validation per mode
        if (mode === 'custom' && dayTargets.length === 0) {
            Alert.alert('Sin datos', 'Necesitas tener un plan personalizado con al menos un tipo de día');
            return;
        }
        if (mode === 'mealplan' && (!mealPlan?.dayTemplates || mealPlan.dayTemplates.length === 0)) {
            Alert.alert('Sin datos', 'El plan de comidas está vacío');
            return;
        }

        // Función para procesar y guardar como template
        const doSaveAsTemplate = async (templateName) => {
            if (!templateName?.trim()) return;

            try {
                setIsSavingAsTemplate(true);

                let body = {
                    name: templateName.trim(),
                    description: planDescription.trim() || `Plan basado en ${clientName || 'cliente'}`,
                    planType: mode === 'mealplan' ? 'complete' : 'flex'
                };

                if (mode === 'mealplan') {
                    // MealPlan mode: spread the mealPlan object (already matches structure)
                    body = {
                        ...body,
                        dayTemplates: mealPlan.dayTemplates,
                        weekMap: mealPlan.weekMap,
                        mealStructure: mealPlan.mealStructure
                    };
                } else {
                    // Custom/Flex mode: Process dayTargets to dayTemplates
                    const processedDayTemplates = dayTargets.map((dt, idx) => {
                        // Logic to convert simpler dayTarget to full dayTemplate or similar
                        // Note: Backend expects dayTemplates array
                        let macros = {};
                        if (dt.macroMode === 'percent' && dt.kcal) {
                            const kcal = parseFloat(dt.kcal) || 0;
                            const pPct = parseFloat(dt.protein_pct) || 30;
                            const cPct = parseFloat(dt.carbs_pct) || 45;
                            const fPct = parseFloat(dt.fat_pct) || 25;
                            macros = {
                                kcal,
                                protein: Math.round((kcal * (pPct / 100)) / 4),
                                carbs: Math.round((kcal * (cPct / 100)) / 4),
                                fat: Math.round((kcal * (fPct / 100)) / 9),
                                // Include extras
                                water: parseFloat(dt.water_ml) || 0,
                                steps: parseFloat(dt.steps_target) || 0,
                                fiber: parseFloat(dt.fiber_g) || 0
                            };
                        } else {
                            macros = {
                                kcal: parseFloat(dt.kcal) || 0,
                                protein: parseFloat(dt.protein_g) || 0,
                                carbs: parseFloat(dt.carbs_g) || 0,
                                fat: parseFloat(dt.fat_g) || 0,
                                // Include extras
                                water: parseFloat(dt.water_ml) || 0,
                                steps: parseFloat(dt.steps_target) || 0,
                                fiber: parseFloat(dt.fiber_g) || 0
                            };
                            // Auto calc kcal if missing? Backend might not care for flex but good to have
                            if (!macros.kcal && (macros.protein || macros.carbs || macros.fat)) {
                                macros.kcal = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
                            }
                        }

                        return {
                            id: dt.id,
                            name: dt.name,
                            color: dt.color || DAY_COLORS[idx % DAY_COLORS.length],
                            // Pass isTraining flag explicitly
                            isTraining: dt.isTrainingDay || false,
                            targetMacros: macros,
                            meals: [], // Empty for flex/custom
                            notes: dt.notes || ''
                        };
                    });

                    body = {
                        ...body,
                        dayTemplates: processedDayTemplates,
                        weekMap: weekSchedule,
                        mealStructure: []
                    };
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
                        window.alert('✅ Guardado: Plan exportado como plantilla');
                    } else {
                        Alert.alert('✅ Guardado', 'Plan exportado como plantilla');
                    }
                } else {
                    throw new Error(data.message || 'No se pudo guardar');
                }
            } catch (error) {
                console.error('[Editor] Save as template error:', error);
                if (Platform.OS === 'web') {
                    window.alert('Error: ' + error.message);
                } else {
                    Alert.alert('Error', error.message);
                }
            } finally {
                setIsSavingAsTemplate(false);
            }
        };

        // En web usamos window.prompt, en móvil Alert.prompt
        if (Platform.OS === 'web') {
            const templateName = window.prompt('Exportar Dieta\n\nIntroduce un nombre para guardar esta dieta:', planName || '');
            if (templateName) {
                doSaveAsTemplate(templateName);
            }
        } else {
            Alert.prompt(
                'Exportar Dieta',
                'Introduce un nombre para guardar esta dieta:',
                (templateName) => doSaveAsTemplate(templateName),
                'plain-text',
                planName || ''
            );
        }
    };

    // 📄 Export as PDF (share)
    const handleExportPDF = async () => {
        if (isExportingPDF) return;

        // Validate there's a plan to export
        if (mode === 'mealplan' && (!mealPlan?.dayTemplates || mealPlan.dayTemplates.length === 0)) {
            Alert.alert('Sin datos', 'El plan de comidas está vacío. Necesitas tener comidas para exportar.');
            return;
        }
        if (mode !== 'mealplan') {
            Alert.alert('Solo Meal Plan', 'La exportación a PDF solo está disponible para planes con comidas completas (modo Meal Plan).');
            return;
        }

        setIsExportingPDF(true);
        try {
            const coachBranding = {
                primaryColor: theme?.primary || '#3b82f6',
                coachName: user?.nombre || 'Entrenador',
                logoUrl: user?.trainerProfile?.logoUrl || null,
            };

            await generateAndShareNutritionPDF({
                plan: mealPlan,
                coachBranding,
                clientName: clientName || 'Cliente',
                hideMacros,
            });
        } catch (error) {
            console.error('[Coach PDF Export] Error:', error);
            if (Platform.OS === 'web') {
                window.alert('Error al generar PDF: ' + error.message);
            } else {
                Alert.alert('Error', 'No se pudo generar el PDF: ' + error.message);
            }
        } finally {
            setIsExportingPDF(false);
        }
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

            // 🛑 SMART PAYLOAD LOGIC (Mirrored from WeeklyMealPlanner)
            let finalMode = mode;
            let rootData = {};

            // If in mealplan mode, check if we have actual food to save
            if (mode === 'mealplan' && mealPlan && mealPlan.dayTemplates) {
                const hasFood = mealPlan.dayTemplates.some(day =>
                    day.meals?.some(meal =>
                        meal.options?.some(opt => (opt.foods && opt.foods.length > 0))
                    )
                );

                if (hasFood) {
                    finalMode = 'complete';
                    // Flatten data to root for backend sanitizer
                    rootData = {
                        dayTemplates: mealPlan.dayTemplates.map(dt => ({
                            id: dt.id, // 🛑 CRITICAL: Ensure ID is sent!
                            name: dt.name,
                            icon: dt.icon,
                            color: dt.color,
                            targetMacros: dt.targetMacros,
                            meals: dt.meals,
                            notes: dt.notes
                        })),
                        weekMap: mealPlan.weekMap || {},
                        mealStructure: mealPlan.mealStructure || [],
                        planType: 'complete',
                    };
                }
            }

            const rawPayload = {
                target: clientId,
                mode: finalMode,
                planType: (mode === 'custom') ? 'flex' : (rootData.planType || 'daily'),
                status,
                name: planName.trim(),
                description: planDescription.trim(),
                customPlan: mode === 'custom' ? {
                    dayTargets: processedDayTargets,
                    weekSchedule,
                } : null,
                mealPlan: mode === 'mealplan' ? mealPlan : null,
                ...rootData, // Spread root data if exists
            };

            // 🛑 DEEP CLONE: Evitar transmutación por referencias compartidas durante el envío
            const payload = JSON.parse(JSON.stringify(rawPayload));

            // 🚨 CHIVATO DE SEGURIDAD 🚨
            let totalFoodsInState = 0;
            if (payload.dayTemplates) {
                totalFoodsInState = payload.dayTemplates.reduce((acc, day) =>
                    acc + (day.meals?.reduce((mAcc, meal) =>
                        mAcc + (meal.options?.reduce((oAcc, opt) => oAcc + (opt.foods?.length || 0), 0) || 0), 0) || 0), 0);
            }

            console.log("-----------------------------------------");
            console.log("🔥 INTENTO DE ENVÍO AL BACKEND (PARENT) 🔥");
            console.log("📍 Target (Client ID):", clientId);
            console.log("🍎 Alimentos detectados en el PAYLOAD:", totalFoodsInState);
            console.log("📦 PAYLOAD REAL (Copia plana):", payload);
            console.log("-----------------------------------------");

            const res = await fetch(`${API_URL}/api/nutrition-plans`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.success) {
                // ✅ UX MEJORA: Simular limpieza de caché y feedback visual
                if (Platform.OS === 'web') {
                    window.alert('✅ Plan guardado y sincronizado correctamente con el cliente.');
                    router.canGoBack() ? router.back() : router.replace('/(coach)');
                } else {
                    Alert.alert(
                        '✅ Plan Guardado',
                        'El plan se ha asignado correctamente. Se han limpiado los datos temporales del cliente.',
                        [{
                            text: 'Volver',
                            onPress: () => router.canGoBack() ? router.back() : router.replace('/(coach)')
                        }]
                    );
                }
            } else {
                if (Platform.OS === 'web') {
                    window.alert('⚠️ Error al guardar: ' + (data.message || 'Inténtalo de nuevo.'));
                } else {
                    Alert.alert('Error', data.message || 'No se pudo guardar el plan.');
                }
            }
        } catch (error) {
            console.error('[Save] Error:', error);
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
                    {isEditingName ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <EnhancedTextInput
                                value={planName}
                                onChangeText={setPlanName}
                                containerStyle={{
                                    borderBottomWidth: 1,
                                    borderBottomColor: '#22c55e',
                                    minWidth: 150,
                                    paddingVertical: 0,
                                }}
                                style={{
                                    fontSize: 18,
                                    fontWeight: '700',
                                    color: '#1e293b',
                                    textAlign: 'center',
                                }}
                                autoFocus
                                onBlur={() => setIsEditingName(false)}
                                placeholder="Nombre del Plan"
                            />
                            <TouchableOpacity onPress={() => setIsEditingName(false)}>
                                <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                            onPress={() => setIsEditingName(true)}
                        >
                            <Text style={styles.headerTitle}>
                                {planName || 'Plan Nutricional'}
                            </Text>
                            <Ionicons name="create-outline" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                    {/* Subtitle hidden on mobile if needed or kept simple */}
                    {!isWideScreen && <Text style={styles.headerSubtitle}>{clientName || 'Cliente'}</Text>}
                </View>

                {/* Right Area: Nutrition Card */}
                <View style={styles.headerRight}>
                    <CoachNutritionTopRightCard
                        autoNutrition={autoNutrition}
                        clientName={clientName}
                        clientData={clientData}
                        isWideScreen={isWideScreen}
                    />
                </View>
            </View>

            {/* 🖥️ Main layout with Sidebar + Content */}
            <View style={styles.mainLayoutWrapper}>
                {/* Sidebar - only on wide screens */}
                {isWideScreen && (
                    <ClientSidebar
                        clients={sidebarClients}
                        isLoading={sidebarLoading}
                        currentClientId={clientId}
                        onClientSelect={handleSidebarClientSelect}
                        isCollapsed={sidebarCollapsed}
                        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                        context="nutrition"
                    />
                )}

                <View style={{ flex: 1 }}>
                    {/* SENSITIVE MODE TOGGLE */}
                    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#fff',
                            padding: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: hideMacros ? '#f59e0b' : '#e2e8f0',
                            marginBottom: 10
                        }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e293b' }}>
                                    🛡️ Modo Sensible (TCA)
                                </Text>
                                <Text style={{ fontSize: 12, color: '#64748b' }}>
                                    Oculta calorías y macros al cliente
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={{
                                    width: 44,
                                    height: 24,
                                    borderRadius: 12,
                                    backgroundColor: hideMacros ? '#f59e0b' : '#e2e8f0',
                                    padding: 2,
                                    alignItems: hideMacros ? 'flex-end' : 'flex-start',
                                }}
                                onPress={toggleSensitiveMode}
                            >
                                <View style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    backgroundColor: '#fff',
                                    shadowColor: "#000",
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 1.41,
                                    elevation: 2,
                                }} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* GLOBAL MODE SELECTOR (Always Visible) */}
                    <View style={[styles.modeSelector, { paddingHorizontal: 16, paddingTop: 0, marginBottom: 10 }]}>
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
                                Auto
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
                                Flex
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeBtn, mode === 'mealplan' && styles.modeBtnActive]}
                            onPress={() => setMode('mealplan')}
                        >
                            <Ionicons
                                name="restaurant"
                                size={20}
                                color={mode === 'mealplan' ? '#fff' : '#64748b'}
                            />
                            <Text style={[styles.modeBtnText, mode === 'mealplan' && styles.modeBtnTextActive]}>
                                Completa
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* 1. SCROLLABLE CONTENT (Auto & Custom) */}
                    {mode !== 'mealplan' && (
                        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

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
                                        <EnhancedTextInput
                                            containerStyle={styles.planNameInputContainer}
                                            style={styles.planNameInputText}
                                            value={planName}
                                            onChangeText={setPlanName}
                                            placeholder="Nombre del plan (ej: Dieta definición Juan)"
                                            placeholderTextColor="#94a3b8"
                                        />
                                        <EnhancedTextInput
                                            containerStyle={styles.planDescInputContainer}
                                            style={styles.planDescInputText}
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
                        </ScrollView>
                    )}

                    {/* 2. MEALPLAN MODE (Full Height) */}
                    {mode === 'mealplan' && (
                        <View style={{ flex: 1 }}>
                            <WeeklyMealPlanner
                                clientId={clientId}
                                initialData={mealPlan}
                                onDataChange={(data) => setMealPlan(data)}
                                showFooter={false}
                            />
                        </View>
                    )}

                    {/* 3. FIXED FOOTER (Always Visible) */}
                    <View style={styles.actionButtonsFixed}>
                        <TouchableOpacity
                            style={styles.draftBtn}
                            onPress={() => handleSave('draft')}
                            disabled={isSaving}
                        >
                            <Ionicons name="save-outline" size={20} color="#64748b" />
                            <Text style={styles.draftBtnText}>Guardar Borrador</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.draftBtn, { flex: 0.8, backgroundColor: '#fcd34d' }]}
                            onPress={saveAsTemplate}
                            disabled={isSavingAsTemplate}
                        >
                            {isSavingAsTemplate ? (
                                <ActivityIndicator size="small" color="#92400e" />
                            ) : (
                                <>
                                    <Ionicons name="download-outline" size={20} color="#92400e" />
                                    <Text style={[styles.draftBtnText, { color: '#92400e' }]}>Exportar Dieta</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        {mode === 'mealplan' && (
                            <TouchableOpacity
                                style={[styles.draftBtn, { flex: 0.8, backgroundColor: '#dbeafe' }]}
                                onPress={handleExportPDF}
                                disabled={isExportingPDF}
                            >
                                {isExportingPDF ? (
                                    <ActivityIndicator size="small" color="#1d4ed8" />
                                ) : (
                                    <>
                                        <Ionicons name="document-text-outline" size={20} color="#1d4ed8" />
                                        <Text style={[styles.draftBtnText, { color: '#1d4ed8' }]}>Exportar PDF</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.activateBtn, { flex: 1.2 }]} // Give more space to "Activar"
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
                </View>
            </View>

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
    mainLayoutWrapper: {
        flex: 1,
        flexDirection: 'row',
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
        // Allow it to take necessary width
        minWidth: 40,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    // New Header Card Styles
    headerCardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 16,
        // Shadow for "pop"
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    headerCardProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerAvatarText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    headerClientName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        maxWidth: 120,
    },
    headerBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    headerBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    headerSubtext: {
        fontSize: 11,
        color: '#64748b',
    },
    headerDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#cbd5e1',
    },
    headerCardTargets: {
        alignItems: 'flex-end',
    },
    headerTargetKcal: {
        fontSize: 18,
        fontWeight: '800',
        lineHeight: 22,
    },
    headerMacrosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    headerMacroItem: {
        fontSize: 11,
        color: '#475569',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    headerMacroDot: {
        fontSize: 10,
        color: '#cbd5e1',
    },

    // Compact Header
    headerCardCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        gap: 6,
    },
    headerCardKcalCompact: {
        fontSize: 14,
        fontWeight: '700',
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
    },
    planNameInputContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    planNameInputText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
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
    planDescInputContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minHeight: 50,
    },
    planDescInputText: {
        fontSize: 14,
        color: '#1e293b',
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
        maxHeight: Dimensions.get('window').height * 0.7,
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

    mealPlanContainer: {
        flex: 1,
        marginHorizontal: -16,
        marginTop: -16,
        minHeight: 500,
    },
    actionButtonsFixed: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        flexDirection: 'row',
        gap: 12,
        paddingBottom: Platform.OS === 'ios' ? 0 : 16, // SafeArea handles iOS usually, but extra padding good
    },
});
