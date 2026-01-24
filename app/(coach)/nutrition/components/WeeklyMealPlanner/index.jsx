/* app/(coach)/nutrition/components/WeeklyMealPlanner/index.jsx
 * 🎨 SMART DAY TEMPLATES - Sin calendario
 * - Solo Templates (Día Entreno / Día Descanso)
 * - Cada comida tiene opciones independientes (Desayuno: 2, Comida: 7, etc)
 * - Sin weekMap (no L-M-X-J-V-S-D)
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
    Image, // Added Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MealCard from './MealCard';
import MacroSummaryFooter from './MacroSummaryFooter';
import SmartFoodDrawer from '../SmartFoodDrawer';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const MEAL_STRUCTURES = {
    3: [
        { id: 'desayuno', name: 'Desayuno', icon: '🌅', suggestedTime: '08:00' },
        { id: 'comida', name: 'Comida', icon: '🍽️', suggestedTime: '14:00' },
        { id: 'cena', name: 'Cena', icon: '🌙', suggestedTime: '21:00' },
    ],
    4: [
        { id: 'desayuno', name: 'Desayuno', icon: '🌅', suggestedTime: '08:00' },
        { id: 'comida', name: 'Comida', icon: '🍽️', suggestedTime: '14:00' },
        { id: 'merienda', name: 'Merienda', icon: '🥪', suggestedTime: '18:00' },
        { id: 'cena', name: 'Cena', icon: '🌙', suggestedTime: '21:00' },
    ],
    5: [
        { id: 'desayuno', name: 'Desayuno', icon: '🌅', suggestedTime: '08:00' },
        { id: 'media_manana', name: 'Media Mañana', icon: '🍎', suggestedTime: '11:00' },
        { id: 'comida', name: 'Comida', icon: '🍽️', suggestedTime: '14:00' },
        { id: 'merienda', name: 'Merienda', icon: '🥪', suggestedTime: '18:00' },
        { id: 'cena', name: 'Cena', icon: '🌙', suggestedTime: '21:00' },
    ],
    6: [
        { id: 'desayuno', name: 'Desayuno', icon: '🌅', suggestedTime: '08:00' },
        { id: 'media_manana', name: 'Media Mañana', icon: '🍎', suggestedTime: '11:00' },
        { id: 'comida', name: 'Comida', icon: '🍽️', suggestedTime: '14:00' },
        { id: 'merienda', name: 'Merienda', icon: '🥪', suggestedTime: '18:00' },
        { id: 'cena', name: 'Cena', icon: '🌙', suggestedTime: '21:00' },
        { id: 'recena', name: 'Recena', icon: '🥛', suggestedTime: '23:00' },
    ]
};

// Unit conversion labels (matches SmartFoodDrawer)
const UNIT_CONVERSIONS = {
    gramos: { label: 'g' },
    cucharada: { label: 'cda' },
    cucharadita: { label: 'cdta' },
    taza: { label: 'taza' },
    puñado: { label: 'puñado' },
    unidad: { label: 'ud' },
    rebanada: { label: 'reb' },
    scoop: { label: 'scoop' },
};

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
    const mealStructure = MEAL_STRUCTURES[3];

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
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
    const [activeModal, setActiveModal] = useState(null);
    const [editingTemplate, setEditingTemplate] = useState(null);

    // Sync initial state with parent if generated internally
    useEffect(() => {
        if (!initialData && onDataChange) {
            onDataChange(plan);
        }
    }, []);

    // Sync with external initialData updates (e.g. async fetch)
    useEffect(() => {
        if (initialData) {
            setPlan(initialData);
            // Optionally reset selected template if current is invalid, 
            // but usually we want to keep selection or default to first.
            // If the plan changed completely, we might want to reset selection:
            if (!initialData.dayTemplates.find(t => t.id === selectedTemplateId)) {
                setSelectedTemplateId(initialData.dayTemplates[0]?.id || null);
            }
        }
    }, [initialData]);

    // Update plan
    const updatePlan = useCallback((updater) => {
        setPlan(prev => {
            const newPlan = typeof updater === 'function' ? updater(prev) : updater;
            // Defer parent update to avoid "Cannot update while rendering" error
            // checks strictly if onDataChange exists
            if (onDataChange) {
                setTimeout(() => {
                    onDataChange(newPlan);
                }, 0);
            }
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
            MEAL_STRUCTURES[3]
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

    const updateTemplateName = (templateId, name, icon, macros, mealCount) => {
        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t => {
                if (t.id !== templateId) return t;

                // Handle meal structure changes if count changed
                let newMeals = t.meals;
                const currentCount = t.meals?.length || 0;

                if (mealCount && mealCount !== currentCount) {
                    const structure = MEAL_STRUCTURES[mealCount] || MEAL_STRUCTURES[3];

                    // Re-map meals based on new structure
                    newMeals = structure.map((def, idx) => {
                        // Try to find existing meal by name (fuzzy match logic could go here)
                        // For now, strict name match to preserve data
                        const existingMeal = t.meals.find(m => m.name === def.name);

                        if (existingMeal) {
                            return {
                                ...existingMeal,
                                order: idx,
                                icon: def.icon,
                                suggestedTime: def.suggestedTime
                            };
                        }

                        // If not found, create new empty meal
                        return createEmptyMeal(def);
                    });
                }

                return {
                    ...t,
                    name,
                    icon: icon || t.icon,
                    targetMacros: macros || t.targetMacros,
                    meals: newMeals
                };
            }),
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
                            options: m.options.map((o, idx) => {
                                // If optionId is provided, match by ID.
                                // If optionId is null (e.g. from card shortcut), default to first option (idx === 0)
                                const isTarget = optionId ? o.id === optionId : idx === 0;
                                return !isTarget ? o : {
                                    ...o,
                                    foods: [...o.foods, food],
                                };
                            }),
                        }
                    ),
                }
            ),
        }));
        // Don't close modal - user may want to add more foods
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

    const updateFoodInMeal = (mealId, optionId, foodIndex, data) => {
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
                                    foods: o.foods.map((food, i) =>
                                        i !== foodIndex ? food : { ...food, ...data }
                                    ),
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

    const updateOptionName = (templateId, mealId, optionId, newName) => {
        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t =>
                t.id !== templateId ? t : {
                    ...t,
                    meals: t.meals.map(m =>
                        m.id !== mealId ? m : {
                            ...m,
                            options: m.options.map(o =>
                                o.id !== optionId ? o : { ...o, name: newName }
                            ),
                        }
                    ),
                }
            ),
        }));
    };

    const bulkRenameOptions = (templateId, mealId, mode) => {
        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t => {
                if (t.id !== templateId) return t;

                return {
                    ...t,
                    meals: t.meals.map(m => {
                        if (m.id !== mealId) return m;

                        // Rename logic
                        const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
                        const newOptions = m.options.map((option, idx) => {
                            let newName = option.name;
                            if (mode === 'weekly') {
                                newName = weekDays[idx % 7];
                            } else if (mode === 'numeric') {
                                newName = `Opción ${idx + 1}`;
                            }
                            return { ...option, name: newName };
                        });

                        return { ...m, options: newOptions };
                    })
                };
            }),
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
                            <View
                                key={template.id}
                                style={[
                                    styles.templateTab,
                                    selectedTemplateId === template.id && styles.templateTabActive,
                                    selectedTemplateId === template.id && { borderColor: template.color },
                                ]}
                            >
                                <TouchableOpacity
                                    style={styles.templateTabContent}
                                    onPress={() => setSelectedTemplateId(template.id)}
                                >
                                    <Text style={styles.templateTabIcon}>{template.icon}</Text>
                                    <View style={styles.templateTabInfo}>
                                        <Text style={[
                                            styles.templateTabName,
                                            selectedTemplateId === template.id && { color: template.color }
                                        ]}>
                                            {template.name}
                                        </Text>
                                        <Text style={styles.templateTabKcal}>
                                            {template.targetMacros.kcal} kcal
                                        </Text>
                                        {/* Macros summary shown on selected tab */}
                                        {selectedTemplateId === template.id && (
                                            <Text style={styles.templateTabMacros}>
                                                P:{template.targetMacros.protein} C:{template.targetMacros.carbs} G:{template.targetMacros.fat}
                                            </Text>
                                        )}
                                    </View>
                                </TouchableOpacity>

                                {/* Action buttons for selected tab */}
                                {selectedTemplateId === template.id && (
                                    <View style={styles.templateTabActions}>
                                        <TouchableOpacity
                                            style={styles.templateActionBtn}
                                            onPress={() => setEditingTemplate(template)}
                                        >
                                            <Ionicons name="settings-outline" size={16} color={template.color} />
                                        </TouchableOpacity>
                                        {plan.dayTemplates.length > 1 && (
                                            <TouchableOpacity
                                                style={styles.templateActionBtn}
                                                onPress={() => deleteTemplate(template.id)}
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </View>
                        ))}

                        <TouchableOpacity style={styles.addTemplateBtn} onPress={addTemplate}>
                            <Ionicons name="add" size={20} color="#64748b" />
                            <Text style={styles.addTemplateBtnText}>Añadir Tipo</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.viewToggleBtn, viewMode === 'table' && styles.viewToggleBtnActive]}
                            onPress={() => setViewMode(prev => prev === 'cards' ? 'table' : 'cards')}
                        >
                            <Ionicons
                                name={viewMode === 'cards' ? "grid-outline" : "albums-outline"}
                                size={16}
                                color={viewMode === 'table' ? "#3b82f6" : "#64748b"}
                            />
                            <Text style={[styles.viewToggleBtnText, viewMode === 'table' && { color: '#3b82f6' }]}>
                                {viewMode === 'cards' ? 'Vista tabla' : 'Vista cards'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>

            {/* Template info bar removed - integrated into tabs */}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* MAIN CONTENT (Cards vs Table) */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {viewMode === 'table' ? (
                <WeeklyStructureView
                    plan={plan}
                    onUpdateOptionName={updateOptionName}
                    onBulkRename={bulkRenameOptions}
                    onAddFood={(templateId, mealId, optionId) => {
                        // Switch to the correct template if needed (though View usually shows all)
                        // But for Modal context we need IDs
                        setActiveModal({ type: 'food', mealId, optionId });
                        // If we need to set templateId context for the drawer:
                        setSelectedTemplateId(templateId);
                    }}
                />
            ) : (
                <ScrollView
                    style={styles.mealsScroll}
                    contentContainerStyle={styles.mealsScrollContent}
                >
                    <View style={[
                        styles.mealsGrid,
                        Platform.OS === 'web' && isDesktop && {
                            flexDirection: 'column',
                            gap: 24,
                        }
                    ]}>
                        {currentTemplate?.meals.map(meal => (
                            <MealCard
                                key={meal.id}
                                meal={meal}
                                templateColor={currentTemplate.color}
                                onAddFood={(optionId) => setActiveModal({ type: 'food', mealId: meal.id, optionId })}
                                onAddSupplement={() => setActiveModal({ type: 'supplement', mealId: meal.id, optionId: null })}
                                onRemoveFood={(optionId, foodIdx) => removeFoodFromMeal(meal.id, optionId, foodIdx)}
                                onUpdateFood={(optionId, foodIdx, data) => updateFoodInMeal(meal.id, optionId, foodIdx, data)}
                                onRemoveSupplement={(optionId, suppIdx) => { }}
                                onAddOption={() => addOptionToMeal(meal.id)}
                                onRemoveOption={(optionId) => removeOptionFromMeal(meal.id, optionId)}
                                onDuplicateOption={(optionId) => duplicateOption(meal.id, optionId)}
                                onEditOptionName={(optionId, newName) => updateOptionName(currentTemplate.id, meal.id, optionId, newName)}
                                onBulkRename={(mode) => bulkRenameOptions(currentTemplate.id, meal.id, mode)}
                            />
                        ))}
                    </View>

                    <View style={{ height: 120 }} />
                </ScrollView>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* FLOATING FOOTER */}
            {/* ═══════════════════════════════════════════════════════════════ */}


            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SMART FOOD DRAWER */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <SmartFoodDrawer
                visible={activeModal?.type === 'food'}
                onClose={() => setActiveModal(null)}
                context={{
                    templateId: selectedTemplateId,
                    mealId: activeModal?.mealId,
                    optionId: activeModal?.optionId,
                }}
                onAddFoods={(foodsData) => {
                    // Batch add foods to the meal
                    foodsData.forEach(({ food, amount, unit, calculatedMacros }) => {
                        addFoodToMeal(activeModal.mealId, activeModal.optionId, {
                            name: food.name,
                            image: food.image, // Include food photo
                            amount,
                            unit: UNIT_CONVERSIONS[unit]?.label || 'g',
                            kcal: calculatedMacros.kcal,
                            protein: calculatedMacros.protein,
                            carbs: calculatedMacros.carbs,
                            fat: calculatedMacros.fat,
                            sourceType: food.layer || 'local',
                            sourceId: food._id,
                        });
                    });
                    // Don't close the drawer - let user add more foods
                }}
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* MODAL: Edit Template */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <EditTemplateModal
                visible={!!editingTemplate}
                template={editingTemplate}
                onClose={() => setEditingTemplate(null)}
                onSave={(name, icon, macros, mealCount) => {
                    if (editingTemplate) {
                        updateTemplateName(editingTemplate.id, name, icon, macros, mealCount);
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
    const [mode, setMode] = useState('macros'); // 'macros' or 'kcal'
    const [mealCount, setMealCount] = useState(template?.meals?.length || 3);

    // Mode: macros (auto-calc kcal)
    const [protein, setProtein] = useState(String(template?.targetMacros?.protein || 150));
    const [carbs, setCarbs] = useState(String(template?.targetMacros?.carbs || 200));
    const [fat, setFat] = useState(String(template?.targetMacros?.fat || 70));

    // Mode: kcal (with percentages)
    const [kcal, setKcal] = useState(String(template?.targetMacros?.kcal || 2000));
    const [proteinPct, setProteinPct] = useState('30');
    const [carbsPct, setCarbsPct] = useState('40');
    const [fatPct, setFatPct] = useState('30');

    // Auto-calculate kcal from macros: P×4 + C×4 + G×9
    const calculatedKcal = React.useMemo(() => {
        const p = parseInt(protein) || 0;
        const c = parseInt(carbs) || 0;
        const g = parseInt(fat) || 0;
        return (p * 4) + (c * 4) + (g * 9);
    }, [protein, carbs, fat]);

    // Calculate macros from kcal + percentages
    const macrosFromKcal = React.useMemo(() => {
        const k = parseInt(kcal) || 2000;
        const pPct = parseInt(proteinPct) || 30;
        const cPct = parseInt(carbsPct) || 40;
        const gPct = parseInt(fatPct) || 30;
        return {
            protein: Math.round((k * pPct / 100) / 4),
            carbs: Math.round((k * cPct / 100) / 4),
            fat: Math.round((k * gPct / 100) / 9),
        };
    }, [kcal, proteinPct, carbsPct, fatPct]);

    React.useEffect(() => {
        if (template) {
            setName(template.name);
            setIcon(template.icon);
            setProtein(String(template.targetMacros?.protein || 150));
            setCarbs(String(template.targetMacros?.carbs || 200));
            setFat(String(template.targetMacros?.fat || 70));
            setKcal(String(template.targetMacros?.kcal || 2000));
            setMealCount(template.meals?.length || 3);
        }
    }, [template]);

    const handleSave = () => {
        const macros = mode === 'macros' ? {
            kcal: calculatedKcal,
            protein: parseInt(protein) || 150,
            carbs: parseInt(carbs) || 200,
            fat: parseInt(fat) || 70,
        } : {
            kcal: parseInt(kcal) || 2000,
            protein: macrosFromKcal.protein,
            carbs: macrosFromKcal.carbs,
            fat: macrosFromKcal.fat,
        };

        onSave(name, icon, macros, mealCount);
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

                    {/* Mode Toggle */}
                    <Text style={styles.modalLabel}>Método de cálculo</Text>
                    <View style={styles.modeToggle}>
                        <TouchableOpacity
                            style={[styles.modeBtn, mode === 'macros' && styles.modeBtnActive]}
                            onPress={() => setMode('macros')}
                        >
                            <Text style={[styles.modeBtnText, mode === 'macros' && styles.modeBtnTextActive]}>
                                📊 Macros → Kcal
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeBtn, mode === 'kcal' && styles.modeBtnActive]}
                            onPress={() => setMode('kcal')}
                        >
                            <Text style={[styles.modeBtnText, mode === 'kcal' && styles.modeBtnTextActive]}>
                                🔥 Kcal + %
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Meal Count Selector */}
                    <Text style={styles.modalLabel}>Número de Comidas</Text>
                    <View style={styles.mealCountRow}>
                        {[3, 4, 5, 6].map(count => (
                            <TouchableOpacity
                                key={count}
                                style={[styles.mealCountOption, mealCount === count && styles.mealCountOptionActive]}
                                onPress={() => setMealCount(count)}
                            >
                                <Text style={[styles.mealCountText, mealCount === count && styles.mealCountTextActive]}>
                                    {count}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {mode === 'macros' ? (
                        <>
                            {/* Mode: Macros -> Auto Kcal */}
                            <View style={styles.calculatedKcalBox}>
                                <Text style={styles.calculatedKcalLabel}>🔥 Kcal Totales (calculadas)</Text>
                                <Text style={styles.calculatedKcalValue}>{calculatedKcal}</Text>
                                <Text style={styles.calculatedKcalFormula}>P×4 + C×4 + G×9</Text>
                            </View>

                            <View style={styles.macrosRow}>
                                <View style={styles.macroInput}>
                                    <Text style={[styles.macroLabel, { color: '#3b82f6' }]}>Proteína (g)</Text>
                                    <TextInput style={styles.macroField} value={protein} onChangeText={setProtein} keyboardType="numeric" />
                                </View>
                                <View style={styles.macroInput}>
                                    <Text style={[styles.macroLabel, { color: '#22c55e' }]}>Carbos (g)</Text>
                                    <TextInput style={styles.macroField} value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
                                </View>
                                <View style={styles.macroInput}>
                                    <Text style={[styles.macroLabel, { color: '#f59e0b' }]}>Grasa (g)</Text>
                                    <TextInput style={styles.macroField} value={fat} onChangeText={setFat} keyboardType="numeric" />
                                </View>
                            </View>
                        </>
                    ) : (
                        <>
                            {/* Mode: Kcal + Percentages */}
                            <View style={styles.kcalInputBox}>
                                <Text style={styles.kcalInputLabel}>🔥 Kcal Totales</Text>
                                <TextInput
                                    style={styles.kcalInputField}
                                    value={kcal}
                                    onChangeText={setKcal}
                                    keyboardType="numeric"
                                    placeholder="2000"
                                />
                            </View>

                            <Text style={[styles.modalLabel, { marginTop: 8 }]}>Distribución (%)</Text>
                            <View style={styles.macrosRow}>
                                <View style={styles.macroInput}>
                                    <Text style={[styles.macroLabel, { color: '#3b82f6' }]}>P %</Text>
                                    <TextInput style={styles.macroField} value={proteinPct} onChangeText={setProteinPct} keyboardType="numeric" />
                                </View>
                                <View style={styles.macroInput}>
                                    <Text style={[styles.macroLabel, { color: '#22c55e' }]}>C %</Text>
                                    <TextInput style={styles.macroField} value={carbsPct} onChangeText={setCarbsPct} keyboardType="numeric" />
                                </View>
                                <View style={styles.macroInput}>
                                    <Text style={[styles.macroLabel, { color: '#f59e0b' }]}>G %</Text>
                                    <TextInput style={styles.macroField} value={fatPct} onChangeText={setFatPct} keyboardType="numeric" />
                                </View>
                            </View>

                            {/* Show calculated grams */}
                            <View style={styles.calculatedGramsBox}>
                                <Text style={styles.calculatedGramsText}>
                                    = P:{macrosFromKcal.protein}g · C:{macrosFromKcal.carbs}g · G:{macrosFromKcal.fat}g
                                </Text>
                            </View>
                        </>
                    )}

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
// BLUEPRINT VIEW (Stacked Timeline Blocks)
// ═══════════════════════════════════════════════════════════════════════════
function WeeklyStructureView({ plan, onUpdateOptionName, onBulkRename, onAddFood }) { // Added onAddFood prop
    return (
        <ScrollView style={styles.structureContainer} contentContainerStyle={styles.structureContent}>
            {plan.dayTemplates.map(template => (
                <View key={template.id} style={styles.dayBlock}>
                    {/* Level 1: Day Header */}
                    <View style={[styles.dayBlockHeader, { borderLeftColor: template.color }]}>
                        <View style={styles.dayHeaderLeft}>
                            <Text style={styles.dayHeaderTitle}>{template.icon} {template.name}</Text>
                            <View style={[styles.dayKcalBadge, { backgroundColor: template.color + '20' }]}>
                                <Text style={[styles.dayKcalText, { color: template.color }]}>
                                    {template.targetMacros.kcal} kcal
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Level 2: Meal Rows */}
                    <View style={styles.dayMealsContainer}>
                        {plan.mealStructure.map(mealDef => {
                            // Find the specific meal instance for this template
                            const meal = template.meals.find(m => m.name === mealDef.name);
                            const options = meal?.options || [];

                            return (
                                <View key={mealDef.id} style={styles.mealRow}>
                                    {/* Left Column: Meal Label & Tools */}
                                    <View style={styles.mealLabelColumn}>
                                        <View style={styles.mealIconCircle}>
                                            <Text style={styles.mealIcon}>{mealDef.icon}</Text>
                                        </View>
                                        <Text style={styles.mealName}>{mealDef.name}</Text>
                                        {/* Time removed as requested */}

                                        {/* Bulk Rename Tools */}
                                        <View style={styles.bulkToolsContainer}>
                                            <TouchableOpacity
                                                style={styles.bulkToolBtn}
                                                onPress={() => onBulkRename(template.id, meal.id, 'weekly')}
                                            >
                                                <Text style={styles.bulkToolText}>📅 Semanal</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.bulkToolBtn}
                                                onPress={() => onBulkRename(template.id, meal.id, 'numeric')}
                                            >
                                                <Text style={styles.bulkToolText}>🔢 Numérico</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Right Column: Dynamic Options Grid */}
                                    <View style={styles.optionsGrid}>
                                        {options.length > 0 ? (
                                            options.map((option, idx) => (
                                                <View key={option.id} style={styles.optionCard}>
                                                    {/* Card Header with Editable Title */}
                                                    <View style={styles.optionHeader}>
                                                        <TextInput
                                                            style={styles.optionTitleInput}
                                                            value={option.name}
                                                            onChangeText={(text) => onUpdateOptionName(template.id, meal.id, option.id, text)}
                                                            placeholder={`Opción ${idx + 1}`}
                                                            placeholderTextColor="#94a3b8"
                                                        />
                                                        {/* 'A' badge removed */}
                                                    </View>

                                                    {/* Card Body: Rich Ingredient Stack */}
                                                    <TouchableOpacity
                                                        style={styles.richStackContainer}
                                                        onPress={() => onAddFood(template.id, meal.id, option.id)} // Functionality restored
                                                    >
                                                        {option.foods && option.foods.length > 0 ? (
                                                            <>
                                                                {option.foods.slice(0, 4).map((food, fIdx) => (
                                                                    <View key={fIdx} style={styles.richRow}>
                                                                        {/* Left: Image or Fallback */}
                                                                        {food.image ? (
                                                                            <Image
                                                                                source={{ uri: food.image }}
                                                                                style={styles.foodThumb}
                                                                                resizeMode="cover"
                                                                            />
                                                                        ) : (
                                                                            <View style={styles.foodThumbPlaceholder}>
                                                                                <Ionicons name="restaurant-outline" size={16} color="#94a3b8" />
                                                                            </View>
                                                                        )}

                                                                        {/* Right: Details */}
                                                                        <View style={styles.foodInfo}>
                                                                            <Text style={styles.foodName} numberOfLines={1}>
                                                                                {food.name}
                                                                            </Text>
                                                                            <Text style={styles.foodMeta}>
                                                                                {food.amount} {food.unit}
                                                                                {/* Always show calories if > 0 */}
                                                                                {food.kcal > 0 && ` • 🔥 ${Math.round(food.kcal)}`}
                                                                            </Text>
                                                                        </View>
                                                                    </View>
                                                                ))}

                                                                {/* Overflow Footer */}
                                                                {option.foods.length > 4 && (
                                                                    <View style={styles.overflowFooter}>
                                                                        <Text style={styles.overflowText}>
                                                                            + {option.foods.length - 4} ingredientes menores...
                                                                        </Text>
                                                                    </View>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <View style={styles.emptyStackPlaceholder}>
                                                                <Ionicons name="basket-outline" size={24} color="#e2e8f0" />
                                                                <Text style={styles.emptyOptionText}>Añadir alimentos</Text>
                                                            </View>
                                                        )}
                                                    </TouchableOpacity>

                                                    {/* Card Footer: Macros Totals */}
                                                    {option.foods && option.foods.length > 0 && (
                                                        <View style={styles.optionMacros}>
                                                            {/* Calculate totals on the fly */}
                                                            {(() => {
                                                                const totals = option.foods.reduce((acc, f) => ({
                                                                    kcal: acc.kcal + (f.kcal || 0),
                                                                    p: acc.p + (f.protein || 0),
                                                                    c: acc.c + (f.carbs || 0),
                                                                    g: acc.g + (f.fat || 0),
                                                                }), { kcal: 0, p: 0, c: 0, g: 0 });

                                                                return (
                                                                    <>
                                                                        <Text style={styles.totalKcalText}>{Math.round(totals.kcal)} kcal</Text>
                                                                        <View style={styles.verticalDivider} />
                                                                        <Text style={[styles.miniMacroText, { color: '#3b82f6' }]}>P:{Math.round(totals.p)}</Text>
                                                                        <Text style={[styles.miniMacroText, { color: '#22c55e' }]}>C:{Math.round(totals.c)}</Text>
                                                                        <Text style={[styles.miniMacroText, { color: '#f59e0b' }]}>G:{Math.round(totals.g)}</Text>
                                                                    </>
                                                                );
                                                            })()}
                                                        </View>
                                                    )}
                                                </View>
                                            ))
                                        ) : (
                                            <View style={styles.emptyMealPlaceholder}>
                                                <Text style={styles.emptyMealText}>Sin opciones configuradas</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
            ))}
            <View style={{ height: 100 }} />
        </ScrollView>
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
    // Blueprint View Styles
    structureContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    structureContent: {
        padding: 16,
        paddingBottom: 100,
        gap: 24,
    },
    dayBlock: {
        backgroundColor: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        ...Platform.select({
            web: { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
            default: { elevation: 1 },
        }),
    },
    dayBlockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        borderLeftWidth: 6, // Color coded strip
    },
    dayHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dayHeaderTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dayKcalBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    dayKcalText: {
        fontSize: 12,
        fontWeight: '700',
    },
    dayMealsContainer: {
        padding: 0,
    },
    mealRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        minHeight: 120, // Increased for bulk tools
    },
    // Left Column
    mealLabelColumn: {
        width: 140, // Fixed width
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRightWidth: 1,
        borderRightColor: '#f1f5f9',
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    mealIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    mealIcon: {
        fontSize: 16,
    },
    mealName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 2,
    },
    mealTime: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
        marginBottom: 8,
    },
    bulkToolsContainer: {
        gap: 4,
        marginTop: 4,
        width: '100%',
    },
    bulkToolBtn: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 6,
        alignItems: 'center',
    },
    bulkToolText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
    },
    // Right Column
    optionsGrid: {
        flex: 1,
        flexDirection: 'row',
        padding: 12,
        gap: 12,
    },
    optionCard: {
        flex: 1, // MAGIC: Distribute space equally
        minWidth: 140, // Minimum readable width
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 10,
        flexDirection: 'column',
    },
    optionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    optionTitleInput: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        padding: 2,
        borderBottomWidth: 1,
        borderBottomColor: 'transparent', // Show underline only on focus ideally, or subtle always
    },
    primaryBadge: {
        backgroundColor: '#eff6ff',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    primaryBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#3b82f6',
    },
    // Ingredient Cluster
    ingredientCluster: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        alignContent: 'flex-start',
        marginBottom: 8,
    },
    ingredientPill: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        maxWidth: Platform.OS === 'web' ? '100%' : 100, // Safe max width
    },
    ingredientPillText: {
        fontSize: 10,
        color: '#475569',
        fontWeight: '500',
    },
    emptyOptionText: {
        fontSize: 11,
        color: '#cbd5e1',
        fontStyle: 'italic',
    },
    // Macros Footer
    optionMacros: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 'auto', // Push to bottom
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
    },
    totalKcalText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748b',
    },
    verticalDivider: {
        width: 1,
        height: 10,
        backgroundColor: '#e2e8f0',
    },
    miniMacroBadge: {
        backgroundColor: '#f8fafc',
        paddingHorizontal: 4,
        borderRadius: 3,
    },
    miniMacroText: {
        fontSize: 9,
        fontWeight: '700',
    },
    emptyMealPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    emptyMealText: {
        color: '#cbd5e1',
        fontSize: 12,
        fontStyle: 'italic',
    },


    // Template Tabs (Existing)
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
    templateTabContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    templateTabInfo: {
        // container for name, kcal, macros
    },
    templateTabMacros: {
        fontSize: 10,
        color: '#94a3b8',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginTop: 2,
    },
    templateTabActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 8,
    },
    templateActionBtn: {
        padding: 4,
        borderRadius: 4,
        backgroundColor: '#f8fafc',
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
    viewToggleBtn: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#fff',
        marginLeft: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewToggleBtnActive: {
        backgroundColor: '#eff6ff',
        borderColor: '#3b82f6',
    },
    viewToggleBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginLeft: 6
    },
    // Rich Ingredient Stack Styles
    richStackContainer: {
        flex: 1,
        paddingTop: 4,
        marginBottom: 8,
    },
    richRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    foodThumb: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    foodThumbPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    foodInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    foodName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 2,
    },
    foodMeta: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '500',
    },
    overflowFooter: {
        marginTop: 6,
        paddingHorizontal: 4,
    },
    overflowText: {
        fontSize: 10,
        color: '#94a3b8',
        fontStyle: 'italic',
    },
    emptyStackPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 20,
        opacity: 0.8,
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
    // Auto-calculated kcal display
    calculatedKcalBox: {
        backgroundColor: '#fef3c7',
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    calculatedKcalLabel: {
        fontSize: 12,
        color: '#92400e',
        marginBottom: 4,
    },
    calculatedKcalValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#f59e0b',
    },
    calculatedKcalFormula: {
        fontSize: 10,
        color: '#b45309',
        marginTop: 4,
    },
    // Mode toggle
    modeToggle: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        padding: 4,
        marginBottom: 16,
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    modeBtnActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    modeBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    modeBtnTextActive: {
        color: '#1e293b',
    },
    // Kcal input mode
    kcalInputBox: {
        backgroundColor: '#fef3c7',
        borderRadius: 10,
        padding: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    kcalInputLabel: {
        fontSize: 12,
        color: '#92400e',
        marginBottom: 8,
    },
    kcalInputField: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#f59e0b',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        fontSize: 24,
        fontWeight: '800',
        color: '#f59e0b',
        textAlign: 'center',
        width: 150,
    },
    calculatedGramsBox: {
        backgroundColor: '#e0f2fe',
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        marginBottom: 16,
    },
    calculatedGramsText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0369a1',
    },
    // Meal Count Selector
    mealCountRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    mealCountOption: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    mealCountOptionActive: {
        backgroundColor: '#dbeafe',
        borderColor: '#3b82f6',
    },
    mealCountText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#64748b',
    },
    mealCountTextActive: {
        color: '#3b82f6',
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
