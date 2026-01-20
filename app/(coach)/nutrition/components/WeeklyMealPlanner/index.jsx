/* app/(coach)/nutrition/components/WeeklyMealPlanner/index.jsx
 * 🎨 SMART DAY TEMPLATES - Sin calendario
 * - Solo Templates (Día Entreno / Día Descanso)
 * - Cada comida tiene opciones independientes (Desayuno: 2, Comida: 7, etc)
 * - Sin weekMap (no L-M-X-J-V-S-D)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
    Modal,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MealCard from './MealCard';
import MacroSummaryFooter from './MacroSummaryFooter';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_MEAL_STRUCTURE = [
    { id: 'desayuno', name: 'Desayuno', icon: '🌅', suggestedTime: '08:30' },
    { id: 'comida', name: 'Comida', icon: '🍽️', suggestedTime: '14:00' },
    { id: 'cena', name: 'Cena', icon: '🌙', suggestedTime: '21:00' },
];

// Create empty meal with one option
const createEmptyMeal = (mealDef) => ({
    id: `meal_${mealDef.id}_${Date.now()}`,
    name: mealDef.name,
    order: 0,
    icon: mealDef.icon,
    suggestedTime: mealDef.suggestedTime,
    options: [{
        id: `option_${Date.now()}`,
        name: 'Opción 1',
        foods: [],
        supplements: [],
    }],
});

// Create empty template
const createEmptyTemplate = (name, icon, color, kcal, mealStructure) => ({
    id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    icon,
    color,
    targetMacros: {
        kcal,
        protein: Math.round(kcal * 0.3 / 4),
        carbs: Math.round(kcal * 0.4 / 4),
        fat: Math.round(kcal * 0.3 / 9),
    },
    meals: mealStructure.map(createEmptyMeal),
    notes: '',
});

// Create default plan
const createDefaultPlan = () => {
    const mealStructure = DEFAULT_MEAL_STRUCTURE;

    return {
        name: 'Nuevo Plan',
        globalNotes: '',
        mealStructure,
        dayTemplates: [
            createEmptyTemplate('Día de Entrenamiento', '💪', '#3b82f6', 2500, mealStructure),
            createEmptyTemplate('Día de Descanso', '💤', '#8b5cf6', 2000, mealStructure),
        ],
    };
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function WeeklyMealPlanner({ initialData, onDataChange }) {
    const { width: windowWidth } = useWindowDimensions();

    // State
    const [plan, setPlan] = useState(() => initialData || createDefaultPlan());
    const [selectedTemplateId, setSelectedTemplateId] = useState(() =>
        plan.dayTemplates[0]?.id || null
    );
    const [activeModal, setActiveModal] = useState(null);
    const [editingTemplate, setEditingTemplate] = useState(null);

    // Update plan
    const updatePlan = useCallback((updater) => {
        setPlan(prev => {
            const newPlan = typeof updater === 'function' ? updater(prev) : updater;
            if (onDataChange) onDataChange(newPlan);
            return newPlan;
        });
    }, [onDataChange]);

    // Current template
    const currentTemplate = useMemo(() =>
        plan.dayTemplates.find(t => t.id === selectedTemplateId) || plan.dayTemplates[0],
        [plan.dayTemplates, selectedTemplateId]
    );

    // Calculate macros
    const templateMacros = useMemo(() => {
        if (!currentTemplate) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };

        let kcal = 0, protein = 0, carbs = 0, fat = 0;
        currentTemplate.meals.forEach(meal => {
            const option = meal.options[0];
            if (option?.foods) {
                option.foods.forEach(food => {
                    kcal += food.kcal || 0;
                    protein += food.protein || 0;
                    carbs += food.carbs || 0;
                    fat += food.fat || 0;
                });
            }
        });
        return { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
    }, [currentTemplate]);

    // ═══════════════════════════════════════════════════════════════════════════
    // TEMPLATE ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    const addTemplate = () => {
        const newTemplate = createEmptyTemplate(
            'Nuevo Tipo de Día',
            '📋',
            '#22c55e',
            2000,
            plan.mealStructure
        );
        updatePlan(prev => ({
            ...prev,
            dayTemplates: [...prev.dayTemplates, newTemplate],
        }));
        setSelectedTemplateId(newTemplate.id);
    };

    const updateTemplateMacros = (templateId, macros) => {
        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t =>
                t.id !== templateId ? t : { ...t, targetMacros: macros }
            ),
        }));
    };

    const updateTemplateName = (templateId, name, icon) => {
        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t =>
                t.id !== templateId ? t : { ...t, name, icon: icon || t.icon }
            ),
        }));
    };

    const deleteTemplate = (templateId) => {
        if (plan.dayTemplates.length <= 1) return;
        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.filter(t => t.id !== templateId),
        }));
        if (selectedTemplateId === templateId) {
            setSelectedTemplateId(plan.dayTemplates.find(t => t.id !== templateId)?.id);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // MEAL/OPTION ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    const addFoodToMeal = (mealId, optionId, food) => {
        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t =>
                t.id !== selectedTemplateId ? t : {
                    ...t,
                    meals: t.meals.map(m =>
                        m.id !== mealId ? m : {
                            ...m,
                            options: m.options.map(o =>
                                o.id !== optionId ? o : {
                                    ...o,
                                    foods: [...o.foods, food],
                                }
                            ),
                        }
                    ),
                }
            ),
        }));
        setActiveModal(null);
    };

    const removeFoodFromMeal = (mealId, optionId, foodIndex) => {
        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t =>
                t.id !== selectedTemplateId ? t : {
                    ...t,
                    meals: t.meals.map(m =>
                        m.id !== mealId ? m : {
                            ...m,
                            options: m.options.map(o =>
                                o.id !== optionId ? o : {
                                    ...o,
                                    foods: o.foods.filter((_, i) => i !== foodIndex),
                                }
                            ),
                        }
                    ),
                }
            ),
        }));
    };

    const addOptionToMeal = (mealId) => {
        const meal = currentTemplate?.meals.find(m => m.id === mealId);
        const optionCount = meal?.options?.length || 0;
        const newOption = {
            id: `option_${Date.now()}`,
            name: `Opción ${optionCount + 1}`,
            foods: [],
            supplements: [],
        };

        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t =>
                t.id !== selectedTemplateId ? t : {
                    ...t,
                    meals: t.meals.map(m =>
                        m.id !== mealId ? m : {
                            ...m,
                            options: [...m.options, newOption],
                        }
                    ),
                }
            ),
        }));
    };

    const removeOptionFromMeal = (mealId, optionId) => {
        const meal = currentTemplate?.meals.find(m => m.id === mealId);
        if (meal?.options?.length <= 1) return; // Keep at least one

        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t =>
                t.id !== selectedTemplateId ? t : {
                    ...t,
                    meals: t.meals.map(m =>
                        m.id !== mealId ? m : {
                            ...m,
                            options: m.options.filter(o => o.id !== optionId),
                        }
                    ),
                }
            ),
        }));
    };

    const duplicateOption = (mealId, optionId) => {
        const meal = currentTemplate?.meals.find(m => m.id === mealId);
        const option = meal?.options?.find(o => o.id === optionId);
        if (!option) return;

        const newOption = {
            id: `option_${Date.now()}`,
            name: `${option.name} (copia)`,
            foods: [...option.foods],
            supplements: [...option.supplements],
        };

        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t =>
                t.id !== selectedTemplateId ? t : {
                    ...t,
                    meals: t.meals.map(m =>
                        m.id !== mealId ? m : {
                            ...m,
                            options: [...m.options, newOption],
                        }
                    ),
                }
            ),
        }));
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════
    const isDesktop = windowWidth >= 1024;

    return (
        <View style={styles.container}>
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* TEMPLATE TABS */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <View style={styles.templateTabs}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.tabsRow}>
                        {plan.dayTemplates.map(template => (
                            <TouchableOpacity
                                key={template.id}
                                style={[
                                    styles.templateTab,
                                    selectedTemplateId === template.id && styles.templateTabActive,
                                    selectedTemplateId === template.id && { borderColor: template.color },
                                ]}
                                onPress={() => setSelectedTemplateId(template.id)}
                                onLongPress={() => setEditingTemplate(template)}
                            >
                                <Text style={styles.templateTabIcon}>{template.icon}</Text>
                                <View>
                                    <Text style={[
                                        styles.templateTabName,
                                        selectedTemplateId === template.id && { color: template.color }
                                    ]}>
                                        {template.name}
                                    </Text>
                                    <Text style={styles.templateTabKcal}>
                                        {template.targetMacros.kcal} kcal
                                    </Text>
                                </View>
                                {selectedTemplateId === template.id && plan.dayTemplates.length > 1 && (
                                    <TouchableOpacity
                                        style={styles.deleteTemplateBtn}
                                        onPress={() => deleteTemplate(template.id)}
                                    >
                                        <Ionicons name="close-circle" size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity style={styles.addTemplateBtn} onPress={addTemplate}>
                            <Ionicons name="add" size={20} color="#64748b" />
                            <Text style={styles.addTemplateBtnText}>Añadir Tipo</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* TEMPLATE INFO BAR */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {currentTemplate && (
                <View style={[styles.templateInfoBar, { backgroundColor: currentTemplate.color + '10' }]}>
                    <Text style={styles.templateInfoText}>
                        {currentTemplate.icon} <Text style={{ fontWeight: '700' }}>{currentTemplate.name}</Text>
                        {' · '}Objetivo: {currentTemplate.targetMacros.kcal} kcal
                        {' · '}P: {currentTemplate.targetMacros.protein}g
                        {' · '}C: {currentTemplate.targetMacros.carbs}g
                        {' · '}G: {currentTemplate.targetMacros.fat}g
                    </Text>
                    <TouchableOpacity
                        style={styles.editMacrosBtn}
                        onPress={() => setEditingTemplate(currentTemplate)}
                    >
                        <Ionicons name="settings-outline" size={16} color={currentTemplate.color} />
                    </TouchableOpacity>
                </View>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* MEALS GRID */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <ScrollView
                style={styles.mealsScroll}
                contentContainerStyle={styles.mealsScrollContent}
            >
                <View style={[
                    styles.mealsGrid,
                    Platform.OS === 'web' && isDesktop && {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 20,
                        alignItems: 'start',
                    }
                ]}>
                    {currentTemplate?.meals.map(meal => (
                        <MealCard
                            key={meal.id}
                            meal={meal}
                            templateColor={currentTemplate.color}
                            onAddFood={(optionId) => setActiveModal({ type: 'food', mealId: meal.id, optionId })}
                            onAddSupplement={(optionId) => setActiveModal({ type: 'supplement', mealId: meal.id, optionId })}
                            onRemoveFood={(optionId, foodIdx) => removeFoodFromMeal(meal.id, optionId, foodIdx)}
                            onRemoveSupplement={(optionId, suppIdx) => { }}
                            onAddOption={() => addOptionToMeal(meal.id)}
                            onRemoveOption={(optionId) => removeOptionFromMeal(meal.id, optionId)}
                            onDuplicateOption={(optionId) => duplicateOption(meal.id, optionId)}
                        />
                    ))}
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* FLOATING FOOTER */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <MacroSummaryFooter
                macros={templateMacros}
                targets={currentTemplate?.targetMacros || { kcal: 2000, protein: 150, carbs: 200, fat: 70 }}
                dayLabel={currentTemplate?.name || 'Día'}
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* MODAL: Add Food */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <AddFoodModal
                visible={activeModal?.type === 'food'}
                onClose={() => setActiveModal(null)}
                onAdd={(food) => addFoodToMeal(activeModal.mealId, activeModal.optionId, food)}
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* MODAL: Edit Template */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <EditTemplateModal
                visible={!!editingTemplate}
                template={editingTemplate}
                onClose={() => setEditingTemplate(null)}
                onSave={(name, icon, macros) => {
                    if (editingTemplate) {
                        updateTemplateName(editingTemplate.id, name, icon);
                        updateTemplateMacros(editingTemplate.id, macros);
                    }
                    setEditingTemplate(null);
                }}
            />
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD FOOD MODAL
// ═══════════════════════════════════════════════════════════════════════════
function AddFoodModal({ visible, onClose, onAdd }) {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('100');
    const [unit, setUnit] = useState('g');
    const [kcal, setKcal] = useState('');
    const [protein, setProtein] = useState('');
    const [carbs, setCarbs] = useState('');
    const [fat, setFat] = useState('');

    const handleAdd = () => {
        if (!name.trim()) return;
        onAdd({
            name: name.trim(),
            amount: parseFloat(amount) || 100,
            unit: unit || 'g',
            kcal: parseFloat(kcal) || 0,
            protein: parseFloat(protein) || 0,
            carbs: parseFloat(carbs) || 0,
            fat: parseFloat(fat) || 0,
            sourceType: 'manual',
        });
        setName(''); setAmount('100'); setKcal(''); setProtein(''); setCarbs(''); setFat('');
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>🍽️ Añadir Alimento</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={styles.modalInput}
                        value={name}
                        onChangeText={setName}
                        placeholder="Nombre del alimento"
                        placeholderTextColor="#94a3b8"
                        autoFocus
                    />

                    <View style={styles.modalRow}>
                        <TextInput
                            style={[styles.modalInput, { flex: 1 }]}
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="100"
                            keyboardType="numeric"
                        />
                        <TextInput
                            style={[styles.modalInput, { width: 60, marginLeft: 8 }]}
                            value={unit}
                            onChangeText={setUnit}
                            placeholder="g"
                        />
                    </View>

                    <Text style={styles.modalLabel}>Macros (por {amount}{unit})</Text>
                    <View style={styles.macrosRow}>
                        <View style={styles.macroInput}>
                            <Text style={styles.macroLabel}>Kcal</Text>
                            <TextInput style={styles.macroField} value={kcal} onChangeText={setKcal} placeholder="0" keyboardType="numeric" />
                        </View>
                        <View style={styles.macroInput}>
                            <Text style={[styles.macroLabel, { color: '#3b82f6' }]}>P</Text>
                            <TextInput style={styles.macroField} value={protein} onChangeText={setProtein} placeholder="0" keyboardType="numeric" />
                        </View>
                        <View style={styles.macroInput}>
                            <Text style={[styles.macroLabel, { color: '#22c55e' }]}>C</Text>
                            <TextInput style={styles.macroField} value={carbs} onChangeText={setCarbs} placeholder="0" keyboardType="numeric" />
                        </View>
                        <View style={styles.macroInput}>
                            <Text style={[styles.macroLabel, { color: '#f59e0b' }]}>G</Text>
                            <TextInput style={styles.macroField} value={fat} onChangeText={setFat} placeholder="0" keyboardType="numeric" />
                        </View>
                    </View>

                    <TouchableOpacity style={styles.modalAddBtn} onPress={handleAdd}>
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.modalAddBtnText}>Añadir Alimento</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// EDIT TEMPLATE MODAL
// ═══════════════════════════════════════════════════════════════════════════
function EditTemplateModal({ visible, template, onClose, onSave }) {
    const [name, setName] = useState(template?.name || '');
    const [icon, setIcon] = useState(template?.icon || '📋');
    const [kcal, setKcal] = useState(String(template?.targetMacros?.kcal || 2000));
    const [protein, setProtein] = useState(String(template?.targetMacros?.protein || 150));
    const [carbs, setCarbs] = useState(String(template?.targetMacros?.carbs || 200));
    const [fat, setFat] = useState(String(template?.targetMacros?.fat || 70));

    React.useEffect(() => {
        if (template) {
            setName(template.name);
            setIcon(template.icon);
            setKcal(String(template.targetMacros?.kcal || 2000));
            setProtein(String(template.targetMacros?.protein || 150));
            setCarbs(String(template.targetMacros?.carbs || 200));
            setFat(String(template.targetMacros?.fat || 70));
        }
    }, [template]);

    const handleSave = () => {
        onSave(name, icon, {
            kcal: parseInt(kcal) || 2000,
            protein: parseInt(protein) || 150,
            carbs: parseInt(carbs) || 200,
            fat: parseInt(fat) || 70,
        });
    };

    const ICONS = ['💪', '💤', '🔥', '🥗', '🍽️', '⚡', '🏋️', '🧘', '📋', '✨'];

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>⚙️ Editar Tipo de Día</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.modalLabel}>Nombre</Text>
                    <TextInput
                        style={styles.modalInput}
                        value={name}
                        onChangeText={setName}
                        placeholder="Día de Entrenamiento"
                    />

                    <Text style={styles.modalLabel}>Icono</Text>
                    <View style={styles.iconRow}>
                        {ICONS.map(i => (
                            <TouchableOpacity
                                key={i}
                                style={[styles.iconOption, icon === i && styles.iconOptionActive]}
                                onPress={() => setIcon(i)}
                            >
                                <Text style={styles.iconOptionText}>{i}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.modalLabel}>Objetivos Macros</Text>
                    <View style={styles.macrosRow}>
                        <View style={styles.macroInput}>
                            <Text style={styles.macroLabel}>Kcal</Text>
                            <TextInput style={styles.macroField} value={kcal} onChangeText={setKcal} keyboardType="numeric" />
                        </View>
                        <View style={styles.macroInput}>
                            <Text style={[styles.macroLabel, { color: '#3b82f6' }]}>P</Text>
                            <TextInput style={styles.macroField} value={protein} onChangeText={setProtein} keyboardType="numeric" />
                        </View>
                        <View style={styles.macroInput}>
                            <Text style={[styles.macroLabel, { color: '#22c55e' }]}>C</Text>
                            <TextInput style={styles.macroField} value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
                        </View>
                        <View style={styles.macroInput}>
                            <Text style={[styles.macroLabel, { color: '#f59e0b' }]}>G</Text>
                            <TextInput style={styles.macroField} value={fat} onChangeText={setFat} keyboardType="numeric" />
                        </View>
                    </View>

                    <TouchableOpacity style={[styles.modalAddBtn, { backgroundColor: '#3b82f6' }]} onPress={handleSave}>
                        <Ionicons name="checkmark" size={20} color="#fff" />
                        <Text style={styles.modalAddBtnText}>Guardar Cambios</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
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
    // Template Tabs
    templateTabs: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    tabsRow: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    templateTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 2,
        borderColor: '#e2e8f0',
    },
    templateTabActive: {
        backgroundColor: '#fff',
        ...Platform.select({
            web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
            default: { elevation: 2 },
        }),
    },
    templateTabIcon: {
        fontSize: 24,
    },
    templateTabName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    templateTabKcal: {
        fontSize: 12,
        color: '#64748b',
    },
    deleteTemplateBtn: {
        marginLeft: 8,
    },
    addTemplateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#d1d5db',
    },
    addTemplateBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    // Template Info Bar
    templateInfoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    templateInfoText: {
        fontSize: 13,
        color: '#475569',
    },
    editMacrosBtn: {
        padding: 6,
    },
    // Meals
    mealsScroll: {
        flex: 1,
    },
    mealsScrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    mealsGrid: {
        gap: 16,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        marginBottom: 12,
    },
    modalRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    modalLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
    },
    macrosRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    macroInput: {
        flex: 1,
        alignItems: 'center',
    },
    macroLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    macroField: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 10,
        width: '100%',
        textAlign: 'center',
    },
    modalAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#22c55e',
        borderRadius: 10,
        paddingVertical: 14,
    },
    modalAddBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    // Icon picker
    iconRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    iconOption: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconOptionActive: {
        backgroundColor: '#dbeafe',
        borderWidth: 2,
        borderColor: '#3b82f6',
    },
    iconOptionText: {
        fontSize: 20,
    },
});
