/* app/(coach)/nutrition/components/WeeklyMealPlanner/index.jsx
 * 🎨 SMART DAY TEMPLATES - Sin calendario
 * - Solo Templates (Día Entreno / Día Descanso)
 * - Cada comida tiene opciones independientes (Desayuno: 2, Comida: 7, etc)
 * - Sin weekMap (no L-M-X-J-V-S-D)
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    Modal,
    useWindowDimensions,
    Image, // Added Image
    ActivityIndicator,
    Alert,
} from 'react-native';
import { EnhancedTextInput } from '../../../../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import MealCard, { ImageSelectionModal } from './MealCard';
import MacroSummaryFooter from './MacroSummaryFooter';
import SmartFoodDrawer from '../SmartFoodDrawer';
import ActionsFooter from './ActionsFooter'; // Import Footer
import axios from 'axios'; // Import Axios
import FoodCreatorModal from '../../../../../components/FoodCreatorModal'; // 🟢 Import Creator
import { saveFood } from '../../../../../src/services/foodService'; // 🟢 Import Save Service

// Helper: UUID Generator (Lightweight)
const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Helper: Hydrate Template (Regenerate IDs to avoid shared references)
const hydrateTemplate = (templateData) => {
    // 1. Deep Clone FIRST (Break all references)
    const clonedData = JSON.parse(JSON.stringify(templateData));

    const idMap = {}; // Old ID -> New ID mapping

    // 2. Regenerate IDs for DayTemplates
    const newDayTemplates = (clonedData.dayTemplates || []).map(day => {
        // Generate new Day ID
        const newDayId = `template_${Date.now()}_${uuidv4().substr(0, 8)}`;
        idMap[day.id] = newDayId; // Map old ID to new

        return {
            ...day,
            id: newDayId,
            // Regenerate IDs for Meals
            meals: (day.meals || []).map(meal => {
                const newMealId = `meal_${newDayId}_${uuidv4().substr(0, 8)}`;
                return {
                    ...meal,
                    id: newMealId,
                    // Regenerate IDs for Options
                    options: (meal.options || []).map(opt => ({
                        ...opt,
                        id: `option_${uuidv4().substr(0, 8)}`
                    }))
                };
            })
        };
    });

    // 3. Remap Week Schedule (weekMap) using the ID mapping
    const newWeekMap = {};
    if (clonedData.weekMap) {
        Object.entries(clonedData.weekMap).forEach(([dayKey, oldTemplateId]) => {
            // Only map if the old ID exists in our new map (clean up ghosts)
            if (idMap[oldTemplateId]) {
                newWeekMap[dayKey] = idMap[oldTemplateId];
            } else if (newDayTemplates.length > 0) {
                // Fallback: If ID not found, assign first available template? 
                // Better to leave empty or assign first to avoid broken UI.
                // Let's safe-guard:
                newWeekMap[dayKey] = newDayTemplates[0].id;
            }
        });
    }

    return {
        ...clonedData,
        dayTemplates: newDayTemplates,
        weekMap: newWeekMap,
        mealStructure: clonedData.mealStructure || []
    };
};

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
// Import shared constants
import { MEAL_STRUCTURES } from '../../../../../src/constants/nutrition';

// Import shared units
import { UNIT_CONVERSIONS } from '../../../../../src/constants/units';

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
export default function WeeklyMealPlanner({ initialData, onDataChange, showFooter = true, clientId }) {
    const { width: windowWidth } = useWindowDimensions();

    // State
    // 🛑 INITIALIZATION FIX: Always hydrate initialData to prevent shared reference bugs
    const [plan, setPlan] = useState(() => {
        if (initialData) {
            return hydrateTemplate(initialData);
        }
        return createDefaultPlan();
    });

    // 🛑 REF SYNC: Mantener una referencia mutable al plan para evitar cierres obsoletos (Stale Closures)
    const planRef = useRef(plan);
    // FORCE SYNC: Update ref on every render to guarantee handleActivate sees what the User sees
    planRef.current = plan;

    // DEBUG: Verify Render State
    // console.log('🎨 WeeklyMealPlanner Render. Foods:', plan.dayTemplates[0]?.meals[0]?.options[0]?.foods?.length || 0);

    const [selectedTemplateId, setSelectedTemplateId] = useState(() =>
        plan.dayTemplates[0]?.id || null
    );
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
    const [activeModal, setActiveModal] = useState(null);
    const [editingTemplate, setEditingTemplate] = useState(null);

    // Actions State
    const [isSaving, setIsSaving] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    // Template Form State
    const [templateName, setTemplateName] = useState('');
    const [templateFolder, setTemplateFolder] = useState('');

    // Import Data State
    const [availableTemplates, setAvailableTemplates] = useState([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

    // 🟢 SMART EDIT STATE
    const [smartEditData, setSmartEditData] = useState(null);
    const [showSmartEditModal, setShowSmartEditModal] = useState(false);

    // 🟢 GLOBAL IMAGE MODAL (To prevent unmounting issues)
    // Store complete option object to survive ID regeneration
    const [imageModalState, setImageModalState] = useState({ visible: false, option: null });

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTIONS & LOGIC (CORREGIDO PARA ENVIAR DATOS REALES)
    // ═══════════════════════════════════════════════════════════════════════════

    // Helper: Construir Payload Inteligente (USANDO REF PARA EVITAR STALE STATE)
    const buildSmartPayload = (status) => {
        const currentPlan = planRef.current; // Leer siempre el más fresco

        // 1. Detectar si el plan actual tiene comida (Importado o Manual rellenado)
        const hasFood = currentPlan.dayTemplates.some(day =>
            day.meals?.some(meal =>
                meal.options?.some(opt => (opt.foods && opt.foods.length > 0))
            )
        );

        // 2. Determinar el target (Cliente)
        // Usamos la prop clientId si existe, o el userId del plan inicial
        const targetId = clientId || initialData?.userId || currentPlan.userId;

        if (!targetId) {
            alert("Error: No se ha especificado el cliente (target)");
            throw new Error("Missing target clientId");
        }

        console.log(`📦 Construyendo Payload. ¿Tiene comida? ${hasFood ? 'SI' : 'NO'}`);

        return {
            target: targetId,
            status: status, // 'draft' o 'active'

            // 🛑 TRUCO DEL ALMENDRUCO PARA EL BACKEND:
            // Si hay comida, forzamos 'complete' y enviamos los datos en la RAÍZ.
            // Esto activa el "Camino B" (Root/Import) en tu backend nuevo y gana las elecciones.
            mode: hasFood ? 'complete' : 'mealplan',
            planType: 'complete',

            // DATOS EN LA RAÍZ (Para que el Backend Sanitizer los coja)
            name: currentPlan.name,
            description: currentPlan.globalNotes || '',
            dayTemplates: currentPlan.dayTemplates, // <--- AQUÍ VA LA IMPORTACIÓN
            weekMap: currentPlan.weekMap || {},
            mealStructure: currentPlan.mealStructure || [],

            // También lo enviamos en mealPlan por si acaso (redundancia segura)
            mealPlan: {
                dayTemplates: currentPlan.dayTemplates,
                weekMap: currentPlan.weekMap,
                mealStructure: currentPlan.mealStructure
            }
        };
    };

    // 1. Guardar Borrador (Save Draft)
    const handleSaveDraft = async () => {
        try {
            setIsSaving(true);
            const payload = buildSmartPayload('draft');

            // Llamada API Real
            const res = await axios.post('https://consistent-donna-titogeremito-29c943bc.koyeb.app/api/nutrition-plans', payload);

            if (res.data.success) {
                if (Platform.OS === 'web') window.alert('✅ Borrador guardado');
                else Alert.alert('Éxito', 'Borrador guardado correctamente');
            }

        } catch (error) {
            console.error('Error saving draft:', error);
            alert('Error al guardar borrador: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsSaving(false);
        }
    };

    // 2. Guardar Plantilla (Sin cambios, ya funcionaba con /templates)
    const handleSaveTemplate = async () => {
        try {
            setIsSaving(true);
            const payload = {
                name: templateName,
                folder: templateFolder,
                ...plan,
                planType: 'complete'
            };
            // Asegúrate que esta URL es correcta
            await axios.post('https://consistent-donna-titogeremito-29c943bc.koyeb.app/api/nutrition-plans/templates', payload);

            setShowSaveTemplateModal(false);
            setTemplateName('');
            alert('Plantilla guardada correctamente');
        } catch (error) {
            console.error('Error saving template', error);
            alert('Error al guardar plantilla');
        } finally {
            setIsSaving(false);
        }
    };

    // 4. Activar Plan (EL MÁS IMPORTANTE)
    const handleActivate = async () => {
        try {
            setIsActivating(true);

            // Construimos el payload "Ganador"
            const rawPayload = buildSmartPayload('active');

            // 🛑 DEEP CLONE: Evitar transmutación por referencias compartidas durante el envío
            const payload = JSON.parse(JSON.stringify(rawPayload));

            // 🚨 CHIVATO DE SEGURIDAD 🚨
            const totalFoodsInState = payload.dayTemplates?.reduce((acc, day) =>
                acc + (day.meals?.reduce((mAcc, meal) =>
                    mAcc + (meal.options?.reduce((oAcc, opt) => oAcc + (opt.foods?.length || 0), 0) || 0), 0) || 0), 0);

            console.log("-----------------------------------------");
            console.log("🔥 INTENTO DE ENVÍO AL BACKEND 🔥");
            console.log("📍 Target (Client ID):", clientId);
            console.log("🍎 Alimentos detectados en el PAYLOAD:", totalFoodsInState);
            console.log("📦 PAYLOAD REAL (Copia plana):", payload);
            console.log("-----------------------------------------");

            // DEBUG: Inspect Payload content before sending
            // console.log('🐞 DEBUG PAYLOAD BEFORE SEND (Activate):', payload);
            if (payload.dayTemplates.length === 0) console.error('❌ ERROR: dayTemplates is EMPTY');
            if (payload.dayTemplates.length === 0) console.error('❌ ERROR: dayTemplates is EMPTY');
            if (payload.dayTemplates[0]?.meals[0]?.options[0]?.foods?.length === 0) console.warn('⚠️ WARNING: No foods in first meal option');

            console.log('🚀 Enviando Activación...', payload);

            // Llamada API Real
            const res = await axios.post('https://consistent-donna-titogeremito-29c943bc.koyeb.app/api/nutrition-plans', payload);

            if (res.data.success) {
                console.log('✅ Plan Activado:', res.data.plan);
                if (Platform.OS === 'web') window.alert('🚀 Plan activado y enviado al cliente');
                else Alert.alert('Éxito', 'Plan activado correctamente');

                // Opcional: Actualizar estado local si el backend devuelve datos nuevos
                // setPlan(hydrateTemplate(res.data.plan)); 
            }

        } catch (error) {
            console.error('Error activating plan:', error);
            alert('Error al activar: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsActivating(false);
        }
    };

    // 3. Import Template (Fetch & Hydrate)
    const handleOpenImport = async () => {
        setShowImportModal(true);
        setIsLoadingTemplates(true);
        try {
            const res = await axios.get('https://consistent-donna-titogeremito-29c943bc.koyeb.app/api/nutrition-plans/templates/list');
            if (res.data.success) {
                setAvailableTemplates(res.data.templates);
            }
        } catch (error) {
            console.error('Error loading templates', error);
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    const handleImportTemplate = async (templateId) => {
        try {
            setIsLoadingTemplates(true);
            const res = await axios.get(`https://consistent-donna-titogeremito-29c943bc.koyeb.app/api/nutrition-plans/templates/${templateId}`);
            if (res.data.success) {
                // 🛑 CRITICAL: Hydrate with refreshed IDs to avoid "Zombie Selectors" and collisions
                const hydratedPlan = hydrateTemplate(res.data.template);

                setPlan(hydratedPlan);
                // 🛑 CRITICAL PROPAGATION: Notify parent immediately!
                if (onDataChange) {
                    onDataChange(hydratedPlan);
                }
                setShowImportModal(false);

                // 🛑 RESET SELECTION: Force select the newly generated ID of the first day
                if (hydratedPlan.dayTemplates.length > 0) {
                    setSelectedTemplateId(hydratedPlan.dayTemplates[0].id);
                }
            }
        } catch (error) {
            console.error('Error importing', error);
            if (Platform.OS === 'web') {
                window.alert('Error al importar');
            } else {
                Alert.alert('Error', 'Error al importar');
            }
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    // Sync initial state with parent if generated internally
    useEffect(() => {
        if (!initialData && onDataChange) {
            onDataChange(plan);
        }
    }, []);

    // 🛑 REF SYNC: Reference to track last emitted plan to prevent loops
    const lastEmittedRef = useRef(null);

    // Sync with external initialData updates (e.g. async fetch)
    useEffect(() => {
        if (initialData) {
            // 🛑 LOOP PROTECTION: Only hydrate if data is DIFFERENT from what we just sent
            // Simple reference equality check works because parent passes the exact object back
            if (initialData === lastEmittedRef.current) {
                return;
            }

            // 🛑 CRITICAL: Re-Hydrate on external updates too to prevent mirror effects if reloading
            // But be careful not to overwrite user edits if this triggers unexpectedly.
            // Usually initialData only changes on mount or explicit reload.
            // Let's assume safe to hydrate.
            const hydrated = hydrateTemplate(initialData);
            setPlan(hydrated);

            // Check if current selection is still valid in new data
            if (!hydrated.dayTemplates.find(t => t.id === selectedTemplateId)) {
                setSelectedTemplateId(hydrated.dayTemplates[0]?.id || null);
            }
        }
    }, [initialData]);

    // Update plan
    const updatePlan = useCallback((updater) => {
        setPlan(prev => {
            const newPlan = typeof updater === 'function' ? updater(prev) : updater;

            // Store reference before emitting
            lastEmittedRef.current = newPlan;

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

    const replaceFoodInMeal = (mealId, optionId, foodIndex, newFoods) => {
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
                                    foods: [
                                        ...o.foods.slice(0, foodIndex),
                                        ...newFoods,
                                        ...o.foods.slice(foodIndex + 1)
                                    ],
                                }
                            ),
                        }
                    ),
                }
            ),
        }));
    };

    // 💊 SUPPLEMENT HANDLERS (A nivel de Meal, no de Option)
    const addSupplementToMeal = (mealId, supplement) => {
        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t =>
                t.id !== selectedTemplateId ? t : {
                    ...t,
                    meals: t.meals.map(m =>
                        m.id !== mealId ? m : {
                            ...m,
                            supplements: [...(m.supplements || []), supplement],
                        }
                    ),
                }
            ),
        }));
    };

    const removeSupplementFromMeal = (mealId, suppIndex) => {
        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t =>
                t.id !== selectedTemplateId ? t : {
                    ...t,
                    meals: t.meals.map(m =>
                        m.id !== mealId ? m : {
                            ...m,
                            supplements: (m.supplements || []).filter((_, i) => i !== suppIndex),
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

    const updateOptionImage = (templateId, mealId, optionId, imageUri) => {
        updatePlan(prev => ({
            ...prev,
            dayTemplates: prev.dayTemplates.map(t =>
                t.id !== templateId ? t : {
                    ...t,
                    meals: t.meals.map(m =>
                        m.id !== mealId ? m : {
                            ...m,
                            options: m.options.map(o =>
                                o.id !== optionId ? o : { ...o, image: imageUri }
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

    // 🟢 HANDLE OPEN IMAGE MODAL
    // 🟢 HANDLE OPEN IMAGE MODAL
    const handleOpenImageModal = (mealId, optionId) => {
        // Find and store the complete option object
        const meal = currentTemplate?.meals?.find(m => m.id === mealId);
        const option = meal?.options?.find(o => o.id === optionId);

        if (option) {
            setImageModalState({
                visible: true,
                option: { ...option }, // Clone to prevent mutation issues
                mealId,
                optionId
            });
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════
    const isDesktop = windowWidth >= 1024;

    // 🟢 HANDLER: SMART EDIT (Promote to Recipe)
    const handleSmartEdit = (option) => {
        // Convert Option Foods to Creator Ingredients format
        const ingredients = (option.foods || []).map(f => {
            // 🟢 RECONSTRUCT FOOD ITEM STRUCTURE
            // The plan stores flattened data (kcal, protein...), but Creator expects nested { nutrients }
            const reconstructedItem = {
                _id: f.sourceId || `temp_${Math.random()}`,
                name: f.name,
                image: f.image,
                brand: 'Planificado',
                nutrients: {
                    kcal: f.kcal || 0,
                    protein: f.protein || 0,
                    carbs: f.carbs || 0,
                    fat: f.fat || 0,
                }
            };

            return {
                item: f.food || reconstructedItem, // Use existing if available, else reconstructed
                quantity: String(f.amount || 100),
                unit: f.unit || 'g'
            };
        });

        setSmartEditData({
            name: option.name,
            isComposite: true,
            ingredients: ingredients,
            // Fallback empty description
            instructions: ''
        });
        setShowSmartEditModal(true);
    };

    // 🟢 HANDLER: SAVE SMART RECIPE
    const handleSaveSmartRecipe = async (foodData) => {
        try {
            await saveFood(foodData);
            Alert.alert('¡Receta Creada!', 'La receta se ha guardado en tu librería.');
            setShowSmartEditModal(false);
            setSmartEditData(null);
        } catch (error) {
            console.error('Error saving smart recipe:', error);
            Alert.alert('Error', 'No se pudo guardar la receta.');
        }
    };

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

                        {/* IMPORT BUTTON (Header) */}
                        <TouchableOpacity
                            style={styles.importBtn}
                            onPress={handleOpenImport}
                        >
                            <Ionicons name="download-outline" size={18} color="#64748b" />
                            <Text style={styles.importBtnText}>Importar</Text>
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
                    onAddFood={(templateId, mealId, optionId, mealName) => {
                        // Switch to the correct template if needed (though View usually shows all)
                        // But for Modal context we need IDs
                        setActiveModal({ type: 'food', mealId, optionId, mealName });
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
                                onAddFood={(optionId) => setActiveModal({ type: 'food', mealId: meal.id, optionId, mealName: meal.name })}
                                onAddSupplement={(supplement) => addSupplementToMeal(meal.id, supplement)}
                                onRemoveFood={(optionId, foodIdx) => removeFoodFromMeal(meal.id, optionId, foodIdx)}
                                onUpdateFood={(optionId, foodIdx, data) => updateFoodInMeal(meal.id, optionId, foodIdx, data)}
                                onRemoveSupplement={(suppIdx) => removeSupplementFromMeal(meal.id, suppIdx)}
                                onAddOption={() => addOptionToMeal(meal.id)}
                                onRemoveOption={(optionId) => removeOptionFromMeal(meal.id, optionId)}
                                onDuplicateOption={(optionId) => duplicateOption(meal.id, optionId)}
                                onEditOptionName={(optionId, newName) => updateOptionName(currentTemplate.id, meal.id, optionId, newName)}
                                onUpdateOptionImage={(optionId, uri) => updateOptionImage(currentTemplate.id, meal.id, optionId, uri)}
                                onBulkRename={(mode) => bulkRenameOptions(currentTemplate.id, meal.id, mode)}
                                // 🟢 PASS SMART EDIT HANDLER
                                onSmartEdit={handleSmartEdit}
                                // 🟢 PASS IMAGE MODAL HANDLER
                                onOpenImageModal={(optionId) => handleOpenImageModal(meal.id, optionId)}
                            />
                        ))}
                    </View>

                    <View style={{ height: 120 }} />
                </ScrollView>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ACTIONS FOOTER */}
            {/* ═══════════════════════════════════════════════════════════════ */}

            {/* Restore Macro Summary Footer - Floating stats above actions */}
            <MacroSummaryFooter
                macros={templateMacros}
                targets={currentTemplate?.targetMacros}
            />

            {showFooter && (
                <ActionsFooter
                    planName={plan.name}
                    onChangePlanName={(text) => updatePlan(prev => ({ ...prev, name: text }))}
                    isSaving={isSaving}
                    isActivating={isActivating}
                    onSaveDraft={handleSaveDraft}
                    onSaveTemplate={() => setShowSaveTemplateModal(true)}
                    onActivate={handleActivate}
                />
            )}

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
                    mealName: activeModal?.mealName, // Pass Name explicitly
                }}
                onAddFoods={(foodsData) => {
                    // Batch add foods to the meal
                    foodsData.forEach(({ food, amount, unit, calculatedMacros }) => {
                        // 🟢 FIX: Preserve base nutrients for unit conversion (a_gusto -> gramos)
                        const baseNutrients = food.nutrients || {};
                        const savedPer100g = {
                            kcal: baseNutrients.kcal || 0,
                            protein: baseNutrients.protein || 0,
                            carbs: baseNutrients.carbs || 0,
                            fat: baseNutrients.fat || 0,
                        };

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
                            // 🟢 RECIPE/COMPOSITE SUPPORT
                            isComposite: food.isComposite,
                            ingredients: food.ingredients,
                            // 🟢 FIX: Save base nutrients for recalculation when switching from a_gusto
                            _savedPer100g: savedPer100g,
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

            <ImportTemplateModal
                visible={showImportModal}
                isLoading={isLoadingTemplates}
                templates={availableTemplates}
                onClose={() => setShowImportModal(false)}
                onSelect={handleImportTemplate}
            />
            {/* 🟢 FOOD CREATOR MODAL (SMART EDIT) */}
            {showSmartEditModal && (
                <FoodCreatorModal
                    visible={showSmartEditModal}
                    initialData={smartEditData}
                    onClose={() => setShowSmartEditModal(false)}
                    onSave={handleSaveSmartRecipe}
                />
            )}
            {/* 🟢 IMAGE SELECTION MODAL */}
            <ImageSelectionModal
                visible={imageModalState.visible}
                option={imageModalState.option}
                onClose={() => setImageModalState({ visible: false, option: null })}
                onUpdateImage={(uri) => {
                    // 1. Update the option in the modal state (for immediate preview)
                    setImageModalState(prev => ({
                        ...prev,
                        option: prev.option ? { ...prev.option, image: uri } : null
                    }));

                    // 2. Also update the plan (uses stored mealId/optionId)
                    if (imageModalState.mealId && imageModalState.optionId) {
                        updateOptionImage(selectedTemplateId, imageModalState.mealId, imageModalState.optionId, uri);
                    }
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

                    <EnhancedTextInput
                        containerStyle={styles.modalInputContainer}
                        style={styles.modalInputText}
                        value={name}
                        onChangeText={setName}
                        placeholder="Nombre del alimento"
                        placeholderTextColor="#94a3b8"
                        autoFocus
                    />

                    <View style={styles.modalRow}>
                        <EnhancedTextInput
                            containerStyle={[styles.modalInputContainer, { flex: 1 }]}
                            style={styles.modalInputText}
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="100"
                            keyboardType="numeric"
                        />
                        <EnhancedTextInput
                            containerStyle={[styles.modalInputContainer, { width: 60, marginLeft: 8 }]}
                            style={styles.modalInputText}
                            value={unit}
                            onChangeText={setUnit}
                            placeholder="g"
                        />
                    </View>

                    <Text style={styles.modalLabel}>Macros (por {amount}{unit})</Text>
                    <View style={styles.macrosRow}>
                        <View style={styles.macroInput}>
                            <Text style={styles.macroLabel}>Kcal</Text>
                            <EnhancedTextInput containerStyle={styles.macroFieldContainer} style={styles.macroFieldText} value={kcal} onChangeText={setKcal} placeholder="0" keyboardType="numeric" />
                        </View>
                        <View style={styles.macroInput}>
                            <Text style={[styles.macroLabel, { color: '#3b82f6' }]}>P</Text>
                            <EnhancedTextInput containerStyle={styles.macroFieldContainer} style={styles.macroFieldText} value={protein} onChangeText={setProtein} placeholder="0" keyboardType="numeric" />
                        </View>
                        <View style={styles.macroInput}>
                            <Text style={[styles.macroLabel, { color: '#22c55e' }]}>C</Text>
                            <EnhancedTextInput containerStyle={styles.macroFieldContainer} style={styles.macroFieldText} value={carbs} onChangeText={setCarbs} placeholder="0" keyboardType="numeric" />
                        </View>
                        <View style={styles.macroInput}>
                            <Text style={[styles.macroLabel, { color: '#f59e0b' }]}>G</Text>
                            <EnhancedTextInput containerStyle={styles.macroFieldContainer} style={styles.macroFieldText} value={fat} onChangeText={setFat} placeholder="0" keyboardType="numeric" />
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
                    <EnhancedTextInput
                        containerStyle={styles.modalInputContainer}
                        style={styles.modalInputText}
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
                                    <EnhancedTextInput containerStyle={styles.macroFieldContainer} style={styles.macroFieldText} value={protein} onChangeText={setProtein} keyboardType="numeric" />
                                </View>
                                <View style={styles.macroInput}>
                                    <Text style={[styles.macroLabel, { color: '#22c55e' }]}>Carbos (g)</Text>
                                    <EnhancedTextInput containerStyle={styles.macroFieldContainer} style={styles.macroFieldText} value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
                                </View>
                                <View style={styles.macroInput}>
                                    <Text style={[styles.macroLabel, { color: '#f59e0b' }]}>Grasa (g)</Text>
                                    <EnhancedTextInput containerStyle={styles.macroFieldContainer} style={styles.macroFieldText} value={fat} onChangeText={setFat} keyboardType="numeric" />
                                </View>
                            </View>
                        </>
                    ) : (
                        <>
                            {/* Mode: Kcal + Percentages */}
                            <View style={styles.kcalInputBox}>
                                <Text style={styles.kcalInputLabel}>🔥 Kcal Totales</Text>
                                <EnhancedTextInput
                                    containerStyle={styles.kcalInputFieldContainer}
                                    style={styles.kcalInputFieldText}
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
                                    <EnhancedTextInput containerStyle={styles.macroFieldContainer} style={styles.macroFieldText} value={proteinPct} onChangeText={setProteinPct} keyboardType="numeric" />
                                </View>
                                <View style={styles.macroInput}>
                                    <Text style={[styles.macroLabel, { color: '#22c55e' }]}>C %</Text>
                                    <EnhancedTextInput containerStyle={styles.macroFieldContainer} style={styles.macroFieldText} value={carbsPct} onChangeText={setCarbsPct} keyboardType="numeric" />
                                </View>
                                <View style={styles.macroInput}>
                                    <Text style={[styles.macroLabel, { color: '#f59e0b' }]}>G %</Text>
                                    <EnhancedTextInput containerStyle={styles.macroFieldContainer} style={styles.macroFieldText} value={fatPct} onChangeText={setFatPct} keyboardType="numeric" />
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
                                    <View style={styles.mealRowInner}>
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
                                                        <EnhancedTextInput
                                                            containerStyle={styles.optionTitleInputContainer}
                                                            style={styles.optionTitleInputText}
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
                                                        onPress={() => onAddFood(template.id, meal.id, option.id, mealDef.name)} // Pass mealDef.name
                                                    >
                                                        {option.foods && option.foods.length > 0 ? (
                                                            <>
                                                                {option.foods.slice(0, 4).map((food, fIdx) => {
                                                                    const isRecipe = food.isRecipe || food.isComposite;
                                                                    const hasSubIngredients = isRecipe && food.subIngredients?.length > 0;

                                                                    return (
                                                                        <View key={fIdx} style={styles.richRow}>
                                                                            {/* Left: Image or Fallback */}
                                                                            {food.image ? (
                                                                                <View style={{ position: 'relative' }}>
                                                                                    <Image
                                                                                        source={{ uri: food.image }}
                                                                                        style={styles.foodThumb}
                                                                                        resizeMode="cover"
                                                                                    />
                                                                                    {isRecipe && (
                                                                                        <View style={styles.recipeBadge}>
                                                                                            <Ionicons name="restaurant" size={10} color="#fff" />
                                                                                        </View>
                                                                                    )}
                                                                                </View>
                                                                            ) : (
                                                                                <View style={styles.foodThumbPlaceholder}>
                                                                                    <Ionicons name={isRecipe ? "restaurant" : "restaurant-outline"} size={16} color={isRecipe ? "#8b5cf6" : "#94a3b8"} />
                                                                                </View>
                                                                            )}

                                                                            {/* Right: Details */}
                                                                            <View style={styles.foodInfo}>
                                                                                <Text style={[styles.foodName, isRecipe && { color: '#8b5cf6' }]} numberOfLines={1}>
                                                                                    {food.name} {isRecipe && '🍳'}
                                                                                </Text>
                                                                                <Text style={styles.foodMeta}>
                                                                                    {food.amount} {food.unit}
                                                                                    {/* Always show calories if > 0 */}
                                                                                    {food.kcal > 0 && ` • 🔥 ${Math.round(food.kcal)}`}
                                                                                </Text>
                                                                                {/* Show subIngredients summary */}
                                                                                {hasSubIngredients && (
                                                                                    <Text style={styles.subIngredientsSummary}>
                                                                                        ↳ {food.subIngredients.slice(0, 3).map(s => s.name).join(', ')}
                                                                                        {food.subIngredients.length > 3 && ` +${food.subIngredients.length - 3}`}
                                                                                    </Text>
                                                                                )}
                                                                            </View>
                                                                        </View>
                                                                    );
                                                                })}

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

                                    {/* 💊 Supplements (if any) - full width below options */}
                                    {meal?.supplements?.length > 0 && (
                                        <View style={styles.weeklySupplementsRow}>
                                            {meal.supplements.map((supp, idx) => (
                                                <View key={supp.id || idx} style={styles.weeklySupplementPill}>
                                                    <Text style={styles.weeklySupplementText}>
                                                        💊 {supp.name} — {supp.amount} {supp.unit}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
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
// ═══════════════════════════════════════════════════════════════════════════
// IMPORT TEMPLATE MODAL
// ═══════════════════════════════════════════════════════════════════════════
function ImportTemplateModal({ visible, isLoading, templates, onClose, onSelect }) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Importar Plantilla</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {isLoading ? (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#4f46e5" />
                            <Text style={{ marginTop: 12, color: '#64748b' }}>Cargando rutinas de nutrición...</Text>
                        </View>
                    ) : templates.length === 0 ? (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                            <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
                            <Text style={{ marginTop: 12, color: '#64748b', textAlign: 'center' }}>
                                No se encontraron plantillas guardadas
                            </Text>
                        </View>
                    ) : (
                        <ScrollView style={{ maxHeight: 400 }}>
                            {templates.map(t => (
                                <TouchableOpacity
                                    key={t._id}
                                    style={styles.templateItem}
                                    onPress={() => onSelect(t._id)}
                                >
                                    <View style={styles.templateIcon}>
                                        <Ionicons name="nutrition" size={20} color="#4f46e5" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.templateName}>{t.name}</Text>
                                        <Text style={styles.templateInfo}>
                                            {t.planType === 'complete' ? 'Plan Completo' : 'Macros Flexibles'} • {new Date(t.createdAt).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}



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
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    mealRowInner: {
        flexDirection: 'row',
        minHeight: 120,
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
    optionTitleInputContainer: {
        flex: 1,
        padding: 2,
        borderBottomWidth: 1,
        borderBottomColor: 'transparent',
    },
    optionTitleInputText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
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

    // 💊 Weekly Structure View - Supplements
    weeklySupplementsRow: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 8,
        paddingLeft: 148, // Align with options (past mealLabelColumn)
    },
    weeklySupplementPill: {
        backgroundColor: '#f5f3ff',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#e9d5ff',
    },
    weeklySupplementText: {
        fontSize: 11,
        color: '#7c3aed',
        fontWeight: '500',
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
    recipeBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#8b5cf6',
        borderRadius: 8,
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    subIngredientsSummary: {
        fontSize: 9,
        color: '#8b5cf6',
        fontWeight: '500',
        marginTop: 2,
        fontStyle: 'italic',
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
    modalInputContainer: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
    },
    modalInputText: {
        fontSize: 15,
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
    macroFieldContainer: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 10,
        width: '100%',
    },
    macroFieldText: {
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
    kcalInputFieldContainer: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#f59e0b',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        width: 150,
    },
    kcalInputFieldText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#f59e0b',
        textAlign: 'center',
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
    // New Import Button
    importBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginLeft: 8,
    },
    importBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        width: '100%',
        maxWidth: 500,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        ...Platform.select({
            web: { boxShadow: '0 10px 25px rgba(0,0,0,0.1)' },
            default: { elevation: 5 },
        }),
        maxHeight: '80%'
    },
    modalContentSmall: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        ...Platform.select({
            web: { boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
            default: { elevation: 10 }
        })
    },
    modalContentLarge: {
        width: '90%',
        maxWidth: 600,
        height: '80%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        ...Platform.select({
            web: { boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
            default: { elevation: 10 }
        })
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 8,
        marginTop: 12,
    },
    textInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        color: '#1e293b',
    },
    templateItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    templateItemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
    },
    templateItemFolder: {
        fontSize: 12,
        color: '#94a3b8',
    },
});
