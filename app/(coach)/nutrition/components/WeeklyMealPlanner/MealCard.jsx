/* app/(coach)/nutrition/components/WeeklyMealPlanner/MealCard.jsx
 * 🎨 MEAL SECTION with HORIZONTAL OPTIONS CAROUSEL
 * - Each meal is a section header with horizontal scroll of option cards
 * - Add/Duplicate/Edit options
 * - No limit on options per meal
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    Image,
    Modal,
    Alert,
    ActivityIndicator
} from 'react-native';
import { EnhancedTextInput } from '../../../../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { getRecipePlaceholder } from '../../../../../src/utils/recipePlaceholder';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app').replace(/\/+$/, '') + '/api';

import { UNIT_CONVERSIONS } from '../../../../../src/constants/units';
import { SUPPLEMENT_TIMINGS } from '../../../../../src/constants/commonSupplements';
import SmartScalingModal from '../SmartScalingModal';
import SupplementDrawer from '../SupplementDrawer';

// 🔄 Web Drag & Drop - Shared drag state (module-level for cross-component access)
let _draggedFood = null;
let _autoScrollCleanup = null;

// 🔄 Find the nearest scrollable parent (ScrollView renders as div with overflow)
const findScrollParent = (el) => {
    let node = el;
    while (node && node !== document.body) {
        const { overflowY } = window.getComputedStyle(node);
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
            return node;
        }
        node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
};

// 🔄 Auto-scroll: edge proximity + mouse wheel during drag
const startAutoScroll = (sourceNode) => {
    let frame = null;
    const EDGE = 80;
    const MAX_SPEED = 18;
    let lastY = 0;
    const scroller = findScrollParent(sourceNode);

    const onDragOver = (e) => { lastY = e.clientY; };

    // Mouse wheel during drag: try on scroller, document, AND window (browsers vary)
    const onWheel = (e) => {
        if (_draggedFood && scroller) {
            scroller.scrollTop += e.deltaY > 0 ? 60 : -60;
        }
    };

    const tick = () => {
        if (scroller) {
            const rect = scroller.getBoundingClientRect();
            if (lastY > 0 && lastY < rect.top + EDGE) {
                const speed = Math.ceil(MAX_SPEED * (1 - (lastY - rect.top) / EDGE));
                scroller.scrollTop -= speed;
            } else if (lastY > rect.bottom - EDGE && lastY < rect.bottom) {
                const speed = Math.ceil(MAX_SPEED * (1 - (rect.bottom - lastY) / EDGE));
                scroller.scrollTop += speed;
            }
        }
        frame = requestAnimationFrame(tick);
    };

    document.addEventListener('dragover', onDragOver);
    // Attach wheel to multiple targets - browsers are inconsistent during drag
    scroller && scroller.addEventListener('wheel', onWheel, { passive: true });
    document.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    frame = requestAnimationFrame(tick);

    return () => {
        document.removeEventListener('dragover', onDragOver);
        scroller && scroller.removeEventListener('wheel', onWheel);
        document.removeEventListener('wheel', onWheel);
        window.removeEventListener('wheel', onWheel);
        cancelAnimationFrame(frame);
    };
};

// 🔄 Web-only Drag Handle (native addEventListener - RNW props don't forward drag events)
const DragHandle = Platform.OS === 'web'
    ? React.memo(({ food }) => {
        const ref = useRef(null);
        const foodRef = useRef(food);
        foodRef.current = food;

        useEffect(() => {
            const node = ref.current;
            if (!node || !node.setAttribute) return;

            node.setAttribute('draggable', 'true');
            node.style.cursor = 'grab';

            const handleDragStart = (evt) => {
                const food = foodRef.current;
                _draggedFood = food;
                evt.dataTransfer.effectAllowed = 'copy';
                evt.dataTransfer.setData('text/plain', food?.name || '');

                // Custom drag image: pill with food name + macros
                const ghost = document.createElement('div');
                ghost.style.cssText = 'position:fixed;top:-1000px;left:-1000px;display:flex;align-items:center;gap:8px;padding:8px 14px;background:#fff;border:2px solid #3b82f6;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-family:system-ui;z-index:99999;max-width:280px;';
                if (food?.image) {
                    const img = document.createElement('img');
                    img.src = food.image;
                    img.style.cssText = 'width:32px;height:32px;border-radius:6px;object-fit:cover;flex-shrink:0;';
                    ghost.appendChild(img);
                }
                const text = document.createElement('div');
                text.style.cssText = 'display:flex;flex-direction:column;min-width:0;';
                text.innerHTML = `<span style="font-size:13px;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${food?.name || 'Alimento'}</span><span style="font-size:10px;color:#64748b;">🔥${Math.round(food?.kcal||0)} · P:${Math.round(food?.protein||0)} · C:${Math.round(food?.carbs||0)} · G:${Math.round(food?.fat||0)}</span>`;
                ghost.appendChild(text);
                document.body.appendChild(ghost);
                evt.dataTransfer.setDragImage(ghost, 20, 20);
                requestAnimationFrame(() => document.body.removeChild(ghost));

                if (node.parentElement) node.parentElement.style.opacity = '0.4';

                // Start auto-scroll
                _autoScrollCleanup = startAutoScroll(node);
            };
            const handleDragEnd = () => {
                _draggedFood = null;
                if (node.parentElement) node.parentElement.style.opacity = '1';
                // Stop auto-scroll
                if (_autoScrollCleanup) { _autoScrollCleanup(); _autoScrollCleanup = null; }
            };

            node.addEventListener('dragstart', handleDragStart);
            node.addEventListener('dragend', handleDragEnd);
            return () => {
                node.removeEventListener('dragstart', handleDragStart);
                node.removeEventListener('dragend', handleDragEnd);
                if (_autoScrollCleanup) { _autoScrollCleanup(); _autoScrollCleanup = null; }
            };
        }, []);

        return (
            <View ref={ref} style={{ padding: 4, marginRight: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ionicons name="reorder-two" size={14} color="#cbd5e1" />
            </View>
        );
    })
    : () => null;

// 🔄 Web-only Drop Zone hook (native addEventListener - RNW props don't forward drag events)
const useDropZone = Platform.OS === 'web'
    ? (ref, onDropFood) => {
        const [isDragOver, setIsDragOver] = useState(false);
        const counterRef = useRef(0);
        const cbRef = useRef(onDropFood);
        cbRef.current = onDropFood;
        const attachedRef = useRef(false);

        useEffect(() => {
            // Retry pattern: ref.current may not be ready on first effect
            const attach = () => {
                const node = ref.current;
                if (!node || attachedRef.current) return;
                attachedRef.current = true;

                const onOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
                const onEnter = (e) => {
                    e.preventDefault();
                    counterRef.current++;
                    if (counterRef.current === 1) setIsDragOver(true);
                };
                const onLeave = () => {
                    counterRef.current--;
                    if (counterRef.current <= 0) { counterRef.current = 0; setIsDragOver(false); }
                };
                const onDrop = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    counterRef.current = 0;
                    setIsDragOver(false);
                    if (_draggedFood) {
                        const cloned = JSON.parse(JSON.stringify(_draggedFood));
                        cbRef.current?.(cloned);
                        _draggedFood = null;
                    }
                };

                // capture:true → intercepts events BEFORE children, so drop works anywhere on the card
                node.addEventListener('dragover', onOver, true);
                node.addEventListener('dragenter', onEnter, true);
                node.addEventListener('dragleave', onLeave, true);
                node.addEventListener('drop', onDrop, true);
            };

            attach();
            // Fallback: if ref wasn't ready, retry after a tick
            if (!attachedRef.current) {
                const timer = setTimeout(attach, 100);
                return () => clearTimeout(timer);
            }
        }, [ref]);

        return isDragOver;
    }
    : () => false;

// Meal icons
const MEAL_ICONS = {
    'Desayuno': { icon: 'sunny', color: '#f59e0b' },
    'Media Mañana': { icon: 'cafe', color: '#22c55e' },
    'Almuerzo': { icon: 'restaurant', color: '#3b82f6' },
    'Comida': { icon: 'restaurant', color: '#3b82f6' },
    'Merienda': { icon: 'nutrition', color: '#8b5cf6' },
    'Cena': { icon: 'moon', color: '#6366f1' },
    'Recena': { icon: 'bed', color: '#64748b' },
};

// 🟢 NEW HELPER: Unified Editable Input with Web Fixes
const EditablePortionControl = ({
    amount,
    unit,
    onUpdate, // (amount, unit, shouldClose) => void
    styleWrapper,
    styleInput,
    styleUnit
}) => {
    const [tempAmount, setTempAmount] = useState(String(amount === 0 ? '' : amount));
    const [localUnit, setLocalUnit] = useState(unit);

    // Sync Props
    useEffect(() => { setTempAmount(String(amount === 0 && tempAmount === '' ? '' : amount)); }, [amount]);
    useEffect(() => { setLocalUnit(unit); }, [unit]);

    const inputRef = useRef(null);
    const changingUnitRef = useRef(false);

    const commitChanges = (finalUnit = localUnit, shouldClose = false) => {
        const val = parseFloat(tempAmount);
        const stableVal = !isNaN(val) ? val : amount;
        onUpdate(stableVal, finalUnit, shouldClose);
    };

    const handleBlur = () => {
        const delayedCommit = () => {
            if (changingUnitRef.current) return;
            commitChanges(localUnit, true); // Close on Blur
        };

        if (Platform.OS === 'web') {
            setTimeout(delayedCommit, 500);
        } else {
            if (changingUnitRef.current) return;
            delayedCommit();
        }
    };

    const handleCycle = () => {
        changingUnitRef.current = true;

        // Cycle Logic
        const keys = Object.keys(UNIT_CONVERSIONS);

        const cleanUnit = (localUnit || '').trim();
        let currentIdx = keys.findIndex(k => k === cleanUnit || UNIT_CONVERSIONS[k].label === cleanUnit);
        if (currentIdx === -1) currentIdx = 0;

        const nextKey = keys[(currentIdx + 1) % keys.length];

        setLocalUnit(nextKey); // Optimistic
        commitChanges(nextKey, false); // Keep open on Cycle

        // Keep focus
        requestAnimationFrame(() => inputRef.current?.focus());
        setTimeout(() => { changingUnitRef.current = false; }, 600);
    };

    return (
        <View style={[{ flexDirection: 'row', alignItems: 'center' }, styleWrapper]}>
            <EnhancedTextInput
                ref={inputRef}
                containerStyle={{ minWidth: 40 }}
                style={[{ textAlign: 'center' }, styleInput]}
                value={tempAmount}
                onChangeText={setTempAmount}
                keyboardType="numeric"
                autoFocus
                selectTextOnFocus
                onBlur={handleBlur}
                onSubmitEditing={() => inputRef.current?.blur()} // Triggers onBlur
            />
            <TouchableOpacity
                onPressIn={() => changingUnitRef.current = true}
                onPress={handleCycle}
                style={styleUnit}
            >
                <Text style={[{ fontSize: 12, color: '#64748b', fontWeight: '600' }, styleUnit?.text]}>
                    {UNIT_CONVERSIONS[localUnit]?.label || localUnit}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

export default function MealCard({
    meal,
    templateColor = '#3b82f6',
    onAddFood,
    onAddSupplement,
    onRemoveFood,
    onUpdateFood,
    onReplaceFood, // 🟢 NEW PROP
    onDropFood, // 🔄 Web DnD: drop food into option
    onRemoveSupplement,
    onAddOption,
    onRemoveOption,
    onDuplicateOption,
    onEditOptionName,
    onUpdateOptionNote,
    onBulkRename,
    onUpdateOptionImage,
    onSmartEdit,
    onOpenImageModal,
    onToggleFavorite, // ❤️ Favorite toggle
    favoriteIds, // ❤️ Set of favorite food IDs
}) {
    const mealConfig = MEAL_ICONS[meal.name] || { icon: 'restaurant', color: '#64748b' };
    const optionsCount = meal.options?.length || 0;

    // 🟢 Refs for Edit Mode (prevent blur on unit change)
    const changingUnitRef = useRef(false);
    const inputRef = useRef(null);

    // 🟢 RECIPE SCALING STATE
    const [scalingRecipe, setScalingRecipe] = useState(null);
    const [scalingContext, setScalingContext] = useState(null); // { optionId, foodIdx }

    // 💊 SUPPLEMENT DRAWER STATE
    const [showSupplementDrawer, setShowSupplementDrawer] = useState(false);

    // Helper para obtener label de timing
    const getTimingLabel = (timingId) => {
        const timing = SUPPLEMENT_TIMINGS.find(t => t.id === timingId);
        return timing ? timing.icon : '🍽️';
    };

    // Click on Recipe -> Open Modal for Editing
    const handleRecipeClick = (optionId, foodIdx, food) => {
        setScalingRecipe(food);
        setScalingContext({ optionId, foodIdx });
    };

    // Handle Update from Modal
    const handleSmartUpdate = (items, mode) => {
        if (!scalingContext) return;
        const { optionId, foodIdx } = scalingContext;

        // Helper: Transform Modal Item to Plan Format
        const transformItem = (item) => ({
            ...item.food, // Inherit base props (id, name, image, ingredients if block)
            // Overwrite quantity and macros
            amount: item.amount,
            unit: item.unit,
            kcal: item.calculatedMacros.kcal,
            protein: item.calculatedMacros.protein,
            carbs: item.calculatedMacros.carbs,
            fat: item.calculatedMacros.fat,
            // Ensure compatibility
            sourceType: mode === 'explode' ? 'AI_GENERATED' : (item.food.sourceType || 'manual'),
            isComposite: mode === 'block' ? true : false
        });

        if (mode === 'block') {
            // Replace with single upgraded block item
            if (items.length > 0) {
                const newItem = transformItem(items[0]);
                onUpdateFood?.(optionId, foodIdx, newItem);
            }
        } else if (mode === 'explode') {
            // Replace with multiple items
            const newFoods = items.map(transformItem);
            onReplaceFood?.(optionId, foodIdx, newFoods);
        }

        setScalingRecipe(null);
        setScalingContext(null);
    };


    return (
        <View style={styles.mealSection}>
            {/* ══════════════════════════════════════════════════════════════ */}
            {/* SECTION HEADER */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                    <View style={[styles.mealIcon, { backgroundColor: mealConfig.color + '15' }]}>
                        <Ionicons name={mealConfig.icon} size={18} color={mealConfig.color} />
                    </View>
                    <Text style={styles.sectionTitle}>{meal.name.toUpperCase()}</Text>
                    <View style={styles.optionsBadge}>
                        <Text style={styles.optionsBadgeText}>
                            {optionsCount} {optionsCount === 1 ? 'opción' : 'opciones'}
                        </Text>
                    </View>

                    {/* NEW: Bulk Rename Tools */}
                    <View style={{ flexDirection: 'row', gap: 6, marginLeft: 12 }}>
                        <TouchableOpacity
                            style={styles.bulkToolBtn}
                            onPress={() => onBulkRename?.('weekly')}
                        >
                            <Text style={styles.bulkToolText}>📅 Semanal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.bulkToolBtn}
                            onPress={() => onBulkRename?.('numeric')}
                        >
                            <Text style={styles.bulkToolText}>🔢 Numérico</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {/* 💊 SUPPLEMENT BUTTON */}
                    <TouchableOpacity
                        style={[styles.addOptionBtn, { backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#e9d5ff' }]}
                        onPress={() => setShowSupplementDrawer(true)}
                    >
                        <Text style={{ fontSize: 14 }}>💊</Text>
                        <Text style={[styles.addOptionBtnText, { color: '#7c3aed' }]}>
                            {meal.supplements?.length > 0 ? meal.supplements.length : 'Supps'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.addOptionBtn} onPress={onAddOption}>
                        <Ionicons name="add" size={16} color="#3b82f6" />
                        <Text style={styles.addOptionBtnText}>Añadir Opción</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 💊 SUPPLEMENTS SECTION (A nivel de comida) */}
            {meal.supplements?.length > 0 && (
                <View style={styles.supplementsSection}>
                    <View style={styles.supplementsHeader}>
                        <Text style={styles.supplementsTitle}>💊 Suplementos de esta comida</Text>
                    </View>
                    <View style={styles.supplementsList}>
                        {meal.supplements.map((supp, idx) => (
                            <View key={supp.id || idx} style={styles.supplementItem}>
                                <Text style={styles.supplementTiming}>{getTimingLabel(supp.timing)}</Text>
                                <View style={styles.supplementInfo}>
                                    <Text style={styles.supplementName}>{supp.name}</Text>
                                    <Text style={styles.supplementDose}>
                                        {supp.amount} {supp.unit}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.supplementRemove}
                                    onPress={() => onRemoveSupplement?.(idx)}
                                >
                                    <Ionicons name="close-circle" size={18} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* OPTIONS CAROUSEL (Horizontal Scroll) */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.optionsCarousel}
            >
                {meal.options?.map((option, index) => (
                    <OptionCard
                        key={option.id}
                        option={option}
                        index={index}
                        isOnlyOption={optionsCount === 1}
                        templateColor={templateColor}
                        onAddFood={() => onAddFood(option.id)}
                        onRemoveFood={(foodIdx) => onRemoveFood(option.id, foodIdx)}
                        onUpdateFood={(foodIdx, data) => onUpdateFood?.(option.id, foodIdx, data)}
                        onDuplicate={() => onDuplicateOption?.(option.id)}
                        onDelete={() => onRemoveOption?.(option.id)}
                        onEditName={(newName) => onEditOptionName?.(option.id, newName)}
                        onUpdateNote={(note) => onUpdateOptionNote?.(option.id, note)}
                        onOpenImageModal={() => onOpenImageModal?.(option.id)}
                        onSmartEdit={onSmartEdit}
                        onRecipeClick={(foodIdx, food) => handleRecipeClick(option.id, foodIdx, food)}
                        onToggleFavorite={onToggleFavorite}
                        favoriteIds={favoriteIds}
                        onDropFood={(food) => onDropFood?.(option.id, food)}
                    />
                ))}
            </ScrollView>

            {/* Recalculate Modal */}
            {scalingRecipe && (
                <SmartScalingModal
                    visible={!!scalingRecipe}
                    recipe={scalingRecipe}
                    onClose={() => setScalingRecipe(null)}
                    onAdd={handleSmartUpdate}
                />
            )}

            {/* 💊 Supplement Drawer */}
            <SupplementDrawer
                visible={showSupplementDrawer}
                onClose={() => setShowSupplementDrawer(false)}
                mealName={meal.name}
                onAdd={(supplement) => {
                    onAddSupplement?.(supplement);
                    setShowSupplementDrawer(false);
                }}
            />
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW: DEDICATED IMAGE MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
function ExpandableRecipeItem({
    food,
    index,
    onUpdate,
    onRemove,
    onRecipeClick
}) {
    const [expanded, setExpanded] = useState(false);
    const [editingIngIdx, setEditingIngIdx] = useState(null);
    const [editAmount, setEditAmount] = useState('');

    const placeholder = getRecipePlaceholder(food.name);

    // 🧠 LOCAL FORK LOGIC: Modify ingredient -> Recalculate Parent
    const handleIngredientChange = (ingIdx, newQtyString) => {
        const newQty = parseFloat(newQtyString);
        if (isNaN(newQty) || newQty < 0) return;

        // 1. Deep Clone (Fork)
        const newFood = JSON.parse(JSON.stringify(food));

        // 🟢 Support both ingredients and subIngredients
        const ingredientsKey = newFood.ingredients?.length > 0 ? 'ingredients' : 'subIngredients';
        if (!newFood[ingredientsKey]) newFood[ingredientsKey] = [];

        const targetIng = newFood[ingredientsKey][ingIdx];
        if (!targetIng) return;

        const oldQty = targetIng.amount || 0;
        if (oldQty === newQty) return; // No change

        // 2. Update Ingredient
        const ratio = oldQty > 0 ? newQty / oldQty : 1; // Prevent div by 0

        targetIng.amount = newQty;

        // Recalculate macros for this ingredient (Snapshot based)
        let currentMacros = targetIng.nutrients || targetIng.cachedMacros || {};

        const newMacros = {
            kcal: (currentMacros.kcal || 0) * ratio,
            protein: (currentMacros.protein || 0) * ratio,
            carbs: (currentMacros.carbs || 0) * ratio,
            fat: (currentMacros.fat || 0) * ratio,
        };

        targetIng.nutrients = newMacros;
        targetIng.cachedMacros = newMacros;

        // 3. Recalculate Parent (Sum of all ingredients)
        let total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
        newFood[ingredientsKey].forEach(ing => {
            const n = ing.nutrients || ing.cachedMacros || {};
            total.kcal += n.kcal || 0;
            total.protein += n.protein || 0;
            total.carbs += n.carbs || 0;
            total.fat += n.fat || 0;
        });

        newFood.kcal = Math.round(total.kcal);
        newFood.protein = Math.round(total.protein * 10) / 10;
        newFood.carbs = Math.round(total.carbs * 10) / 10;
        newFood.fat = Math.round(total.fat * 10) / 10;

        // 4. Propagate Update
        onUpdate(newFood);
        setEditingIngIdx(null);
    };

    // 🟢 SMART SCALING: Update Recipe Portion -> Scale ALL Ingredients
    const [isEditingAmount, setIsEditingAmount] = useState(false);
    const [recipeAmountStr, setRecipeAmountStr] = useState('');

    const handleRecipePortionChange = () => {
        setIsEditingAmount(false);
        const newAmount = parseFloat(recipeAmountStr);
        if (isNaN(newAmount) || newAmount <= 0) return;

        const oldAmount = food.amount || 1;
        if (newAmount === oldAmount) return;

        const ratio = newAmount / oldAmount;

        // 1. Clone
        const newFood = JSON.parse(JSON.stringify(food));
        if (!newFood.ingredients) newFood.ingredients = [];

        // 2. Scale Items
        newFood.ingredients.forEach(ing => {
            // Scale Amount
            ing.amount = Math.round((ing.amount * ratio) * 100) / 100;

            // Scale Macros
            const n = ing.nutrients || ing.cachedMacros || {};
            const scaledMacros = {
                kcal: (n.kcal || 0) * ratio,
                protein: (n.protein || 0) * ratio,
                carbs: (n.carbs || 0) * ratio,
                fat: (n.fat || 0) * ratio
            };
            ing.nutrients = scaledMacros;
            ing.cachedMacros = scaledMacros; // Update cache
        });

        // 3. Scale Parent Macros
        newFood.amount = newAmount;
        newFood.kcal = Math.round(newFood.kcal * ratio);
        newFood.protein = Math.round(newFood.protein * ratio * 10) / 10;
        newFood.carbs = Math.round(newFood.carbs * ratio * 10) / 10;
        newFood.fat = Math.round(newFood.fat * ratio * 10) / 10;

        // 4. Save
        onUpdate(newFood);
    };

    return (
        <View style={styles.recipeContainer}>
            {/* COMPACT HEADER (Click to Expand) */}
            <TouchableOpacity
                style={[styles.recipeCard, expanded && styles.recipeCardExpanded]}
                onPress={() => setExpanded(!expanded)}
                activeOpacity={0.9}
            >
                {/* 🔄 Drag Handle (Web only) */}
                <DragHandle food={food} />
                {/* Image */}
                {food.image ? (
                    <Image source={{ uri: food.image }} style={styles.recipeImage} />
                ) : (
                    <View style={[styles.recipeImage, { backgroundColor: placeholder.backgroundColor, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={styles.fontSize24}>{placeholder.icon}</Text>
                    </View>
                )}

                <View style={styles.recipeContent}>
                    <View style={styles.recipeHeader}>
                        <View style={styles.recipeBadge}>
                            <Ionicons name="restaurant" size={10} color="#fff" />
                            <Text style={styles.recipeBadgeText}>RECETA</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            {/* Smart Edit / Tools */}
                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); onRecipeClick(); }}>
                                <Ionicons name="create-outline" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                            {/* Remove */}
                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); onRemove(); }}>
                                <Ionicons name="close" size={18} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.recipeName} numberOfLines={1}>{food.name}</Text>
                        <Ionicons
                            name={expanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color="#64748b"
                            style={{ marginRight: 4 }}
                        />
                    </View>

                    <View style={styles.recipeFooter}>
                        {/* Macro Pills Row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {/* Kcal */}
                            <View style={[styles.macroPill, { backgroundColor: '#fff7ed' }]}>
                                <Ionicons name="flame" size={10} color="#f97316" />
                                <Text style={[styles.macroPillText, { color: '#f97316' }]}>{Math.round(food.kcal || 0)}</Text>
                            </View>

                            {/* Protein */}
                            <View style={[styles.macroPill, { backgroundColor: '#eff6ff' }]}>
                                <Text style={styles.fontSize10}>🥩</Text>
                                <Text style={[styles.macroPillText, { color: '#3b82f6' }]}>{Math.round(food.protein || 0)}g</Text>
                            </View>

                            {/* Carbs */}
                            <View style={[styles.macroPill, { backgroundColor: '#f0fdf4' }]}>
                                <Text style={styles.fontSize10}>🌾</Text>
                                <Text style={[styles.macroPillText, { color: '#22c55e' }]}>{Math.round(food.carbs || 0)}g</Text>
                            </View>

                            {/* Fat */}
                            <View style={[styles.macroPill, { backgroundColor: '#fffbeb' }]}>
                                <Text style={styles.fontSize10}>🥑</Text>
                                <Text style={[styles.macroPillText, { color: '#f59e0b' }]}>{Math.round(food.fat || 0)}g</Text>
                            </View>
                        </View>

                        {isEditingAmount ? (
                            <EnhancedTextInput
                                containerStyle={styles.ingInputContainer}
                                style={styles.ingInputText}
                                value={recipeAmountStr}
                                onChangeText={setRecipeAmountStr}
                                keyboardType="numeric"
                                autoFocus
                                selectTextOnFocus
                                onBlur={handleRecipePortionChange}
                                onSubmitEditing={handleRecipePortionChange}
                            />
                        ) : (
                            <TouchableOpacity
                                onPress={() => {
                                    setIsEditingAmount(true);
                                    setRecipeAmountStr(String(food.amount || 1));
                                }}
                            >
                                <Text style={styles.recipePortion}>
                                    {food.amount || 1} {food.unit || 'Ración'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>

            {/* EXPANDED INGREDIENTS LIST */}
            {expanded && (
                <View style={styles.ingredientsList}>
                    {/* 🟢 CHECK BOTH: ingredients (from FoodCreator) OR subIngredients (from AI import) */}
                    {(food.ingredients || food.subIngredients)?.map((ing, i) => {
                        const name = ing.name || ing.cachedName || 'Ingrediente';
                        const qty = ing.amount || 0;
                        const rawUnit = ing.unit || 'gramos';

                        // Resolve Unit Label from Constants
                        const unitKey = Object.keys(UNIT_CONVERSIONS).find(k => k === rawUnit || UNIT_CONVERSIONS[k].label === rawUnit) || 'gramos';
                        const displayUnit = UNIT_CONVERSIONS[unitKey]?.label || rawUnit;

                        const isEditing = editingIngIdx === i;
                        // 🟢 Check multiple sources: nutrients object, cachedMacros, OR direct fields (subIngredients from AI)
                        const macros = ing.nutrients || ing.cachedMacros || {
                            kcal: ing.kcal || 0,
                            protein: ing.protein || 0,
                            carbs: ing.carbs || 0,
                            fat: ing.fat || 0
                        };

                        // 🟢 ROBUST IMAGE CHECK
                        // Recipes from DB might allow 'image' or 'food.image' or 'item.image' (populated)
                        const thumbUri = ing.image
                            || (typeof ing.food === 'object' && ing.food?.image)
                            || (typeof ing.item === 'object' && ing.item?.image)
                            || null;

                        // 🟢 SMART LOIGC: Handle Unit or Amount updates
                        const handleSmartUpdate = (newAmount, newKey = unitKey) => {
                            // 1. If only amount changed (same unit)
                            if (newKey === unitKey) {
                                handleIngredientChange(i, newAmount);
                                return;
                            }

                            // 2. Unit Changed -> Complex Logic (Snapshot/Restore)
                            const nextUnitData = UNIT_CONVERSIONS[newKey];

                            // Clone & Update
                            const newFood = JSON.parse(JSON.stringify(food));
                            const ingredientsKey = (newFood.ingredients && newFood.ingredients.length > 0) ? 'ingredients' : 'subIngredients';
                            if (!newFood[ingredientsKey]) newFood[ingredientsKey] = [];

                            const targetIng = newFood[ingredientsKey][i];

                            const currentFactor = UNIT_CONVERSIONS[unitKey]?.factor || 0;
                            const newFactor = nextUnitData.factor;

                            // Use the submitted amount for calculation basis
                            const baseQty = newAmount >= 0 ? newAmount : qty;
                            const weightInGramsForSnapshot = baseQty * currentFactor;

                            // SNAPSHOT logic
                            let perGramSnapshot = targetIng._savedPerGram;
                            if (!perGramSnapshot && weightInGramsForSnapshot > 0) {
                                perGramSnapshot = {
                                    kcal: (macros.kcal || 0) / weightInGramsForSnapshot,
                                    protein: (macros.protein || 0) / weightInGramsForSnapshot,
                                    carbs: (macros.carbs || 0) / weightInGramsForSnapshot,
                                    fat: (macros.fat || 0) / weightInGramsForSnapshot
                                };
                            }

                            // A) Going TO "Libre"
                            if (newFactor === 0) {
                                targetIng.unit = newKey;
                                targetIng.amount = 0; // Force 0
                                if (perGramSnapshot) targetIng._savedPerGram = perGramSnapshot;
                                targetIng.nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
                                targetIng.cachedMacros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
                                targetIng.kcal = 0; targetIng.protein = 0; targetIng.carbs = 0; targetIng.fat = 0;
                            }
                            // B) Coming FROM "Libre"
                            else if (currentFactor === 0) {
                                targetIng.unit = newKey;
                                let defaultAmount = newKey === 'gramos' ? 100 : 1;
                                targetIng.amount = defaultAmount;

                                const newWeightInGrams = defaultAmount * newFactor;
                                let restored = false;

                                if (targetIng._savedPerGram) {
                                    const snap = targetIng._savedPerGram;
                                    const newMacros = {
                                        kcal: snap.kcal * newWeightInGrams,
                                        protein: snap.protein * newWeightInGrams,
                                        carbs: snap.carbs * newWeightInGrams,
                                        fat: snap.fat * newWeightInGrams
                                    };
                                    targetIng.nutrients = newMacros;
                                    targetIng.cachedMacros = newMacros;
                                    targetIng.kcal = newMacros.kcal; targetIng.protein = newMacros.protein;
                                    targetIng.carbs = newMacros.carbs; targetIng.fat = newMacros.fat;
                                    restored = true;
                                }

                                if (!restored) {
                                    const originalItem = targetIng.food || targetIng.item;
                                    if (originalItem) {
                                        const baseMacros = originalItem.nutrients || originalItem.cachedMacros || {
                                            kcal: originalItem.kcal || 0, protein: originalItem.protein || 0, carbs: originalItem.carbs || 0, fat: originalItem.fat || 0
                                        };
                                        targetIng.nutrients = { ...baseMacros };
                                        targetIng.cachedMacros = { ...baseMacros };
                                        targetIng.kcal = baseMacros.kcal; targetIng.protein = baseMacros.protein;
                                        targetIng.carbs = baseMacros.carbs; targetIng.fat = baseMacros.fat;
                                    }
                                }
                            }
                            // C) Normal Conversion
                            else {
                                if (perGramSnapshot) targetIng._savedPerGram = perGramSnapshot;
                                targetIng.unit = newKey;

                                const amountChanged = Math.abs(qty - newAmount) > 0.01;

                                if (amountChanged) {
                                    // 🟢 Correction: User changed Amount AND Unit
                                    targetIng.amount = newAmount;

                                    // 1. Snapshot / Density (Preferred)
                                    if (perGramSnapshot) {
                                        const newWeight = newAmount * newFactor;
                                        if (!targetIng.nutrients) targetIng.nutrients = {};

                                        targetIng.nutrients.kcal = perGramSnapshot.kcal * newWeight;
                                        targetIng.nutrients.protein = perGramSnapshot.protein * newWeight;
                                        targetIng.nutrients.carbs = perGramSnapshot.carbs * newWeight;
                                        targetIng.nutrients.fat = perGramSnapshot.fat * newWeight;

                                        targetIng.kcal = Math.round(targetIng.nutrients.kcal);
                                        targetIng.protein = Math.round(targetIng.nutrients.protein * 10) / 10;
                                        targetIng.carbs = Math.round(targetIng.nutrients.carbs * 10) / 10;
                                        targetIng.fat = Math.round(targetIng.nutrients.fat * 10) / 10;
                                    }
                                    // 2. Fallback to Ratio
                                    else {
                                        const currentWeight = qty * (UNIT_CONVERSIONS[unitKey]?.factor || 1);

                                        if (currentWeight > 0) {
                                            const newWeight = newAmount * newFactor;
                                            const ratio = newWeight / currentWeight;

                                            // Update macros based on density
                                            if (targetIng.nutrients) {
                                                targetIng.nutrients.kcal = Math.round((targetIng.nutrients.kcal || 0) * ratio);
                                                targetIng.nutrients.protein = Math.round((targetIng.nutrients.protein || 0) * ratio);
                                                targetIng.nutrients.carbs = Math.round((targetIng.nutrients.carbs || 0) * ratio);
                                                targetIng.nutrients.fat = Math.round((targetIng.nutrients.fat || 0) * ratio);
                                            }
                                            // Also update root props if they exist
                                            targetIng.kcal = Math.round((targetIng.kcal || 0) * ratio);
                                            targetIng.protein = Math.round((targetIng.protein || 0) * ratio * 10) / 10;
                                            targetIng.carbs = Math.round((targetIng.carbs || 0) * ratio * 10) / 10;
                                            targetIng.fat = Math.round((targetIng.fat || 0) * ratio * 10) / 10;
                                        }
                                    }
                                } else {
                                    // 🟢 Conversion: Only Unit changed
                                    if (newFactor > 0) {
                                        const rawNewAmount = weightInGramsForSnapshot / newFactor;
                                        targetIng.amount = Math.round(rawNewAmount * 100) / 100;
                                    } else {
                                        targetIng.amount = baseQty;
                                    }
                                    // Macros preserved
                                }
                            }

                            // 3. Recalculate Totals
                            let total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
                            newFood[ingredientsKey].forEach(ing => {
                                const n = ing.nutrients || ing.cachedMacros || {
                                    kcal: ing.kcal || 0, protein: ing.protein || 0, carbs: ing.carbs || 0, fat: ing.fat || 0
                                };
                                total.kcal += n.kcal || 0;
                                total.protein += n.protein || 0;
                                total.carbs += n.carbs || 0;
                                total.fat += n.fat || 0;
                            });

                            newFood.kcal = Math.round(total.kcal);
                            newFood.protein = Math.round(total.protein * 10) / 10;
                            newFood.carbs = Math.round(total.carbs * 10) / 10;
                            newFood.fat = Math.round(total.fat * 10) / 10;

                            onUpdate(newFood);
                        };

                        return (
                            <View key={i} style={styles.ingredientRow}>
                                {/* 1. Thumbnail */}
                                {thumbUri ? (
                                    <Image source={{ uri: thumbUri }} style={styles.ingThumb} />
                                ) : (
                                    <View style={styles.ingThumbPlaceholder}>
                                        <Ionicons name="restaurant" size={12} color="#cbd5e1" />
                                    </View>
                                )}

                                {/* 2. Info */}
                                <View style={{ flex: 1, marginHorizontal: 8 }}>
                                    <Text style={styles.ingName} numberOfLines={1}>{name}</Text>
                                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                                        <Text style={styles.ingMacro}>🔥 {Math.round(macros.kcal)}</Text>
                                        <Text style={[styles.ingMacro, { color: '#3b82f6' }]}>P:{Math.round(macros.protein)}</Text>
                                        <Text style={[styles.ingMacro, { color: '#22c55e' }]}>C:{Math.round(macros.carbs)}</Text>
                                        <Text style={[styles.ingMacro, { color: '#f59e0b' }]}>G:{Math.round(macros.fat)}</Text>
                                    </View>
                                </View>

                                {/* 3. Editable Quantity & Unit using Helper */}
                                <View style={styles.ingRight}>
                                    {isEditing ? (
                                        <EditablePortionControl
                                            amount={qty}
                                            unit={unitKey}
                                            styleInput={styles.ingInput}
                                            styleUnit={{ minWidth: 24, alignItems: 'center' }}
                                            onUpdate={(newAmt, newKey, shouldClose) => {
                                                handleSmartUpdate(newAmt, newKey);
                                                if (shouldClose) setEditingIngIdx(null);
                                            }}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => { setEditingIngIdx(i); setEditAmount(String(qty)); }}
                                            style={{ flexDirection: 'row', alignItems: 'center' }}
                                        >
                                            <View style={styles.ingQtyTouch}>
                                                <Text style={styles.ingQty}>{Math.round(qty * 100) / 100}</Text>
                                            </View>
                                            <View style={{ minWidth: 24, alignItems: 'center' }}>
                                                <Text style={styles.ingUnit}>{displayUnit}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        );
                    })}

                    <View style={styles.ingFooter}>
                        <Text style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
                            📝 Editando localmente. Macros recalculadas.
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}

function ImageSelectionModal({ visible, option, onClose, onUpdateImage }) {
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    if (!visible || !option) return null;


    // 1. GALLERY
    const handlePickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert("Permiso denegado", "Se necesita acceso a la galería.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.7,
        });

        if (!result.canceled) {
            onUpdateImage(result.assets[0].uri);
        }
    };

    // 2. PRE-DEFINED URL
    const handleUrlSubmit = () => {
        if (!imageUrlInput.trim()) return;
        onUpdateImage(imageUrlInput.trim());
        setImageUrlInput('');
    };

    // 3. AI GENERATION
    const handleAiGenerate = async () => {
        if (!option.name || !option.name.trim() || option.name.includes('Copiar')) {
            Alert.alert('Nombre requerido', 'Ponle un nombre descriptivo a la opción (ej: "Lasaña") para generar la imagen.');
            return;
        }

        try {
            setIsGeneratingAI(true);
            const token = await AsyncStorage.getItem('totalgains_token');
            if (!token) throw new Error('No token');

            const response = await fetch(`${API_BASE_URL}/foods/ai-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    foodName: option.name.trim(),
                    index: Math.floor(Math.random() * 20) // 🟢 Increased variety
                })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                const rawImg = data.image?.dataUrl || data.image?.url;
                if (rawImg) {
                    let img = rawImg.startsWith('/')
                        ? (process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app').replace(/\/+$/, '') + rawImg
                        : rawImg;

                    // 🟢 FORCE CACHE BUSTING if it's a URL (not base64)
                    if (img.startsWith('http')) {
                        img = `${img}${img.includes('?') ? '&' : '?'}t=${Date.now()}`;
                    }

                    onUpdateImage(img);
                } else {
                    Alert.alert('Sin resultados', 'No se encontró imagen.');
                }
            } else {
                Alert.alert('Error', data.message || 'Error generador');
            }

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Falló la generación.');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.imageModalContent}>
                    <Text style={styles.modalTitle}>📸 Portada de la Opción</Text>

                    {/* Preview Current Image */}
                    {option.image && (
                        <View style={styles.modalWithImageContainer}>
                            <Image
                                source={{ uri: option.image }}
                                style={styles.modalImagePreview}
                                onError={(e) => console.log("Img Err:", e.nativeEvent.error)}
                            />
                        </View>
                    )}

                    {/* A. GALLERY */}
                    <TouchableOpacity style={styles.imgOptionBtn} onPress={handlePickImage}>
                        <Ionicons name="images-outline" size={20} color="#3b82f6" />
                        <View>
                            <Text style={styles.imgOptionTitle}>Galería de Fotos</Text>
                            <Text style={styles.imgOptionSub}>Subir desde tu dispositivo</Text>
                        </View>
                    </TouchableOpacity>

                    {/* B. AI GENERATION */}
                    <TouchableOpacity style={styles.imgOptionBtn} onPress={handleAiGenerate} disabled={isGeneratingAI}>
                        {isGeneratingAI ? <ActivityIndicator size="small" color="#8b5cf6" /> : <Ionicons name="sparkles" size={20} color="#8b5cf6" />}
                        <View>
                            <Text style={styles.imgOptionTitle}>Generar con AI</Text>
                            <Text style={styles.imgOptionSub}>Usar nombre: "{option.name || 'Sin nombre'}"</Text>
                        </View>
                    </TouchableOpacity>

                    {/* C. URL INPUT */}
                    <View style={styles.urlInputBlock}>
                        <Text style={styles.urlLabel}>O pegar enlace:</Text>
                        <View style={styles.urlRow}>
                            <EnhancedTextInput
                                containerStyle={styles.urlInputContainer}
                                style={styles.urlInputText}
                                placeholder="https://..."
                                value={imageUrlInput}
                                onChangeText={setImageUrlInput}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity style={styles.urlSendBtn} onPress={handleUrlSubmit}>
                                <Ionicons name="arrow-forward" size={16} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.closeModalBtn} onPress={onClose}>
                        <Text style={styles.closeModalText}>Listo / Cerrar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// OPTION CARD (Individual option within carousel)
// ═══════════════════════════════════════════════════════════════════════════
function OptionCard({
    option,
    index,
    isOnlyOption,
    templateColor,
    onAddFood,
    onRemoveFood,
    onUpdateFood,
    onDuplicate,
    onDelete,
    onEditName,
    onUpdateNote,
    onOpenImageModal, // 🟢 NEW prop (Lifted State)
    onSmartEdit, // 🟢 NEW prop
    onRecipeClick, // 🟢 NEW prop for opening modal
    onToggleFavorite, // ❤️ Favorite toggle
    favoriteIds, // ❤️ Set of favorite food IDs
    onDropFood, // 🔄 Web DnD: handle dropped food
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [showNote, setShowNote] = useState(!!option.coachNote);
    const [localNote, setLocalNote] = useState(option.coachNote || '');
    const noteTimerRef = useRef(null);
    const [editingFoodIdx, setEditingFoodIdx] = useState(null);
    const [editAmount, setEditAmount] = useState('');
    const [editUnit, setEditUnit] = useState('gramos');

    // 🔄 Web Drag & Drop - Drop zone (native events via hook)
    const dropZoneRef = useRef(null);
    const isDragOver = useDropZone(dropZoneRef, onDropFood);

    // 🟢 Helper: Cycle to next unit
    const cycleUnit = (currentUnit) => {
        const keys = Object.keys(UNIT_CONVERSIONS);
        const currentIdx = keys.indexOf(currentUnit);
        const nextKey = keys[(currentIdx + 1) % keys.length];

        // DEBUG: Temporary alert
        console.log('🔄 CYCLING UNIT:', { currentUnit, currentIdx, nextKey });
        if (Platform.OS === 'web') alert(`Debug: Cur: ${currentUnit} -> Next: ${nextKey}`);
        else Alert.alert('Debug', `Cur: ${currentUnit} (${currentIdx}) -> Next: ${nextKey}`);

        return nextKey;
    };

    // Removed local Image logic

    // Calculate macros
    const optionMacros = option.foods?.reduce(
        (acc, food) => ({
            kcal: acc.kcal + (food.kcal || 0),
            protein: acc.protein + (food.protein || 0),
            carbs: acc.carbs + (food.carbs || 0),
            fat: acc.fat + (food.fat || 0),
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    ) || { kcal: 0, protein: 0, carbs: 0, fat: 0 };

    const hasFoods = option.foods?.length > 0;

    return (
        <View ref={dropZoneRef} style={[styles.optionCard, isDragOver && styles.dropZoneActive]}>
            {/* Option Header */}
            <View style={[styles.optionHeader, { borderLeftColor: templateColor }]}>
                <View style={styles.optionTitleRow}>
                    {/* NEW: Thumbnail if exists */}
                    {/* NEW: Thumbnail or Placeholder */}
                    {/* NEW: Thumbnail or Placeholder */}
                    {/* Fallback to first food image if option has no image */}
                    {(() => {
                        // 1. Try explicit Option Image
                        // 2. Try First Food Image (Robust check)
                        const firstFood = option.foods?.[0];
                        const fallbackImage = firstFood?.image
                            || (typeof firstFood?.item === 'object' && firstFood?.item?.image)
                            || (typeof firstFood?.food === 'object' && firstFood?.food?.image);

                        const displayImage = option.image || fallbackImage;

                        return (
                            <TouchableOpacity onPress={onOpenImageModal}>
                                {displayImage ? (
                                    <Image
                                        source={{ uri: displayImage }}
                                        style={{ width: 28, height: 28, borderRadius: 6, marginRight: 8, backgroundColor: '#f1f5f9' }}
                                    />
                                ) : (
                                    <View style={{ width: 28, height: 28, borderRadius: 6, marginRight: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1' }}>
                                        <Ionicons name="camera-outline" size={14} color="#94a3b8" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })()}
                    {/* NEW: Editable Title */}
                    <EnhancedTextInput
                        containerStyle={styles.optionNameInputContainer}
                        style={styles.optionNameInputText}
                        value={option.name}
                        onChangeText={onEditName}
                        placeholder={`Opción ${index + 1}`}
                        placeholderTextColor="#94a3b8"
                        multiline
                    />
                </View>

                {/* Action buttons */}
                <View style={styles.optionActions}>

                    {/* 🟢 EDIT RECIPE BUTTON (Smart Edit) */}
                    <TouchableOpacity
                        style={styles.optionActionBtn}
                        onPress={() => onSmartEdit(option)}
                    >
                        <Ionicons name="create-outline" size={14} color="#64748b" />
                    </TouchableOpacity>

                    {/* Duplicate */}
                    <TouchableOpacity
                        style={styles.optionActionBtn}
                        onPress={onDuplicate}
                    >
                        <Ionicons name="copy-outline" size={14} color="#64748b" />
                    </TouchableOpacity>

                    {/* Delete */}
                    {!isOnlyOption && (
                        <TouchableOpacity
                            style={styles.optionActionBtn}
                            onPress={onDelete}
                        >
                            <Ionicons name="trash-outline" size={14} color="#ef4444" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Macros Badge */}
            {optionMacros.kcal > 0 && (
                <View style={styles.optionMacros}>
                    <Text style={styles.optionMacrosText}>
                        {Math.round(optionMacros.kcal)} kcal
                        {' · '}
                        <Text style={{ color: '#3b82f6' }}>P:{Math.round(optionMacros.protein)}</Text>
                        {' · '}
                        <Text style={{ color: '#22c55e' }}>C:{Math.round(optionMacros.carbs)}</Text>
                        {' · '}
                        <Text style={{ color: '#f59e0b' }}>G:{Math.round(optionMacros.fat)}</Text>
                    </Text>
                </View>
            )}

            {/* Foods List */}
            <View style={styles.optionFoods}>
                {!hasFoods ? (
                    <TouchableOpacity style={styles.emptyOption} onPress={onAddFood}>
                        <Ionicons name="add" size={24} color="#d1d5db" />
                        <Text style={styles.emptyOptionText}>Añadir alimentos</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        {option.foods.map((food, foodIdx) => {
                            // Calculate percentage of total option kcal
                            const pct = optionMacros.kcal > 0
                                ? Math.round((food.kcal / optionMacros.kcal) * 100)
                                : 0;

                            // 🎨 POLYMORPHIC UI: Recipe (Expandable) vs Ingredient Row
                            // STRICTer check: Must be explicitly composite OR have actual ingredients
                            if (food.isComposite || (Array.isArray(food.ingredients) && food.ingredients.length > 0)) {
                                return (
                                    <ExpandableRecipeItem
                                        key={`${food.name}_${foodIdx}`}
                                        food={food}
                                        index={foodIdx}
                                        onUpdate={(newFood) => onUpdateFood?.(foodIdx, newFood)}
                                        onRemove={() => onRemoveFood(foodIdx)}
                                        onRecipeClick={() => onRecipeClick?.(foodIdx, food)} // Opens Smart Modal if desired
                                    />
                                );
                            }

                            return (
                                <View key={`${food.name}_${foodIdx}`} style={styles.foodCard}>
                                    {/* 🔄 Drag Handle (Web only) */}
                                    <DragHandle food={food} />
                                    {/* Left: Photo or Placeholder */}
                                    {food.image ? (
                                        <Image source={{ uri: food.image }} style={styles.foodPhoto} />
                                    ) : (
                                        <View style={styles.foodPhotoPlaceholder}>
                                            <Ionicons name="fast-food-outline" size={18} color="#94a3b8" />
                                        </View>
                                    )}

                                    {/* ❤️ Favorite Button */}
                                    <TouchableOpacity
                                        onPress={() => {
                                            const isValidId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
                                            const realId = food.foodId || food._id;
                                            const hasValidId = isValidId(realId);

                                            const foodForFav = {
                                                ...food,
                                                _id: hasValidId ? realId : undefined,
                                                // If valid ID, assume CLOUD unless specified otherwise. If invalid ID, force LOCAL to clone.
                                                layer: hasValidId ? (food.layer || 'CLOUD') : 'LOCAL',
                                                nutrients: food.nutrients || {
                                                    kcal: food.kcal || 0,
                                                    protein: food.protein || 0,
                                                    carbs: food.carbs || 0,
                                                    fat: food.fat || 0,
                                                },
                                            };
                                            onToggleFavorite?.(foodForFav);
                                        }}
                                        style={styles.foodFavBtn}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Ionicons
                                            name={(() => {
                                                const isFav = favoriteIds?.has(food.foodId) ||
                                                    favoriteIds?.has(food._id) ||
                                                    favoriteIds?.has(food.name?.toLowerCase?.().trim()) ||
                                                    food.isFavorite;
                                                return isFav ? 'heart' : 'heart-outline';
                                            })()}
                                            size={14}
                                            color={(() => {
                                                const isFav = favoriteIds?.has(food.foodId) ||
                                                    favoriteIds?.has(food._id) ||
                                                    favoriteIds?.has(food.name?.toLowerCase?.().trim()) ||
                                                    food.isFavorite;
                                                return isFav ? '#ef4444' : '#cbd5e1';
                                            })()}
                                        />
                                    </TouchableOpacity>

                                    {/* Center: Name + Macros */}
                                    <View style={styles.foodDetails}>
                                        <Text style={styles.foodName} numberOfLines={1}>{food.name}</Text>
                                        <View style={styles.foodMacrosRow}>
                                            {food.unit === 'a_gusto' ? (
                                                <View style={{ backgroundColor: '#ecfccb', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' }}>
                                                    <Text style={{ color: '#4d7c0f', fontSize: 10, fontWeight: '700' }}>CONSUMO LIBRE</Text>
                                                </View>
                                            ) : (
                                                <>
                                                    <Text style={styles.foodKcal}>🔥 {Math.round(food.kcal || 0)}</Text>
                                                    <Text style={[styles.foodMacro, { color: '#3b82f6' }]}>P:{Math.round(food.protein || 0)}</Text>
                                                    <Text style={[styles.foodMacro, { color: '#22c55e' }]}>C:{Math.round(food.carbs || 0)}</Text>
                                                    <Text style={[styles.foodMacro, { color: '#f59e0b' }]}>G:{Math.round(food.fat || 0)}</Text>
                                                </>
                                            )}
                                        </View>
                                    </View>

                                    {/* Right: Percentage + Portion */}
                                    <View style={styles.foodRightSection}>
                                        {/* Percentage Badge */}
                                        <View style={[styles.pctBadge, pct >= 50 && { backgroundColor: '#fee2e2' }]}>
                                            <Text style={[styles.pctText, pct >= 50 && { color: '#ef4444' }]}>{pct}%</Text>
                                        </View>

                                        {/* Editable Portion */}
                                        {/* Editable Portion */}
                                        {editingFoodIdx === foodIdx ? (
                                            <EditablePortionControl
                                                amount={food.amount || 0}
                                                unit={food.unit || 'gramos'}
                                                styleInput={styles.foodAmountInput}
                                                styleUnit={styles.foodAmountUnit}
                                                onUpdate={(newAmt, newUnit, shouldClose) => {
                                                    const wasLibre = (food.unit === 'a_gusto' || food.unit === 'Libre');
                                                    const isNewLibre = (newUnit === 'a_gusto' || newUnit === 'Libre');

                                                    let updates = { amount: newAmt, unit: newUnit };

                                                    // 1. To Libre
                                                    if (!wasLibre && isNewLibre) {
                                                        const curAmt = food.amount || 100;
                                                        // 🟢 FIX: Convert to grams using unit factor before calculating per-100g
                                                        const unitFactor = UNIT_CONVERSIONS[food.unit]?.factor ?? 1;
                                                        const curWeightGrams = curAmt * unitFactor;

                                                        if (curWeightGrams > 0) {
                                                            updates._savedPer100g = {
                                                                kcal: (food.kcal || 0) * 100 / curWeightGrams,
                                                                protein: (food.protein || 0) * 100 / curWeightGrams,
                                                                carbs: (food.carbs || 0) * 100 / curWeightGrams,
                                                                fat: (food.fat || 0) * 100 / curWeightGrams
                                                            };
                                                        } else if (food._savedPer100g) updates._savedPer100g = food._savedPer100g;

                                                        // Force visual 0
                                                        updates.amount = 0;
                                                        updates.kcal = 0; updates.protein = 0; updates.carbs = 0; updates.fat = 0;
                                                    }
                                                    // 2. From Libre
                                                    else if (wasLibre && !isNewLibre) {
                                                        const restoreAmt = newAmt > 0 ? newAmt : 100; // Default 100 if coming from 0
                                                        updates.amount = restoreAmt;

                                                        if (food._savedPer100g) {
                                                            const base = food._savedPer100g;
                                                            // 🟢 FIX: Convert restoreAmt to grams using new unit factor
                                                            const newUnitFactor = UNIT_CONVERSIONS[newUnit]?.factor ?? 1;
                                                            const restoreWeightGrams = restoreAmt * newUnitFactor;

                                                            updates.kcal = Math.round(base.kcal * restoreWeightGrams / 100);
                                                            updates.protein = Math.round(base.protein * restoreWeightGrams / 100 * 10) / 10;
                                                            updates.carbs = Math.round(base.carbs * restoreWeightGrams / 100 * 10) / 10;
                                                            updates.fat = Math.round(base.fat * restoreWeightGrams / 100 * 10) / 10;
                                                        }
                                                    }
                                                    // 3. Normal (Amount or Unit change)
                                                    else {
                                                        const amountChanged = Math.abs((food.amount || 0) - newAmt) > 0.01;
                                                        const unitChanged = updates.unit !== food.unit;

                                                        // A. Unit Changed
                                                        if (unitChanged) {
                                                            const oldFactor = UNIT_CONVERSIONS[food.unit]?.factor ?? 1;
                                                            const newFactor = UNIT_CONVERSIONS[newUnit]?.factor ?? 1;

                                                            // 🛡️ SAFETY: Detect risky conversions that could cause multiplication explosion
                                                            // - From a_gusto (factor 0) to anything
                                                            // - Between units with factor 1 (Libre/unidad -> gramos)
                                                            const isFromAGusto = oldFactor === 0 || food.unit === 'a_gusto' || food.unit === 'Libre';
                                                            const isRiskyConversion = isFromAGusto || (oldFactor === 1 && newFactor === 1);

                                                            if (amountChanged) {
                                                                // 🟢 Correction: User changed Amount AND Unit
                                                                updates.amount = newAmt;

                                                                // 1. Try Density (Preferred - accurate)
                                                                if (food._savedPer100g) {
                                                                    const base = food._savedPer100g;
                                                                    const newWeight = newAmt * newFactor;
                                                                    updates.kcal = Math.round(base.kcal * newWeight / 100);
                                                                    updates.protein = Math.round(base.protein * newWeight / 100 * 10) / 10;
                                                                    updates.carbs = Math.round(base.carbs * newWeight / 100 * 10) / 10;
                                                                    updates.fat = Math.round(base.fat * newWeight / 100 * 10) / 10;
                                                                }
                                                                // 2. Risky? -> PRESERVE MACROS (assume user is defining weight for current macros)
                                                                else if (isRiskyConversion) {
                                                                    // Do NOT touch macros - user says "these calories are for this new amount"
                                                                }
                                                                // 3. Normal Ratio Fallback
                                                                else {
                                                                    const oldWeight = (food.amount || 0) * oldFactor;
                                                                    if (oldWeight > 0) {
                                                                        const ratio = (newAmt * newFactor) / oldWeight;
                                                                        updates.kcal = Math.round((food.kcal || 0) * ratio);
                                                                        updates.protein = Math.round((food.protein || 0) * ratio * 10) / 10;
                                                                        updates.carbs = Math.round((food.carbs || 0) * ratio * 10) / 10;
                                                                        updates.fat = Math.round((food.fat || 0) * ratio * 10) / 10;
                                                                    }
                                                                }
                                                            }
                                                            // 🟢 Conversion: User ONLY switched Unit
                                                            else {
                                                                // If from a_gusto or risky, preserve amount and macros
                                                                // CRITICAL FIX: If switching to 'gramos' or 'ml' from risky unit, default to 100g to anchor density
                                                                if (isFromAGusto || oldFactor === 0) {
                                                                    if (newUnit === 'gramos' || newUnit === 'ml') {
                                                                        updates.amount = 100; // Force 100g default anchor
                                                                    } else {
                                                                        updates.amount = food.amount || 1;
                                                                    }
                                                                    // Macros preserved
                                                                }
                                                                else if (newFactor > 0) {
                                                                    const weight = (food.amount || 0) * oldFactor;
                                                                    updates.amount = Math.round((weight / newFactor) * 100) / 100;
                                                                }
                                                                // Macros always preserved in pure unit conversion
                                                            }
                                                        }
                                                        // B. Only Amount Changed
                                                        else if (amountChanged && (food.amount || 0) > 0) {
                                                            const ratio = newAmt / food.amount;
                                                            updates.kcal = Math.round((food.kcal || 0) * ratio);
                                                            updates.protein = Math.round((food.protein || 0) * ratio * 10) / 10;
                                                            updates.carbs = Math.round((food.carbs || 0) * ratio * 10) / 10;
                                                            updates.fat = Math.round((food.fat || 0) * ratio * 10) / 10;
                                                        }
                                                    }

                                                    if (updates.amount !== food.amount || updates.unit !== food.unit) {
                                                        onUpdateFood?.(foodIdx, updates);
                                                    }
                                                    if (shouldClose) setEditingFoodIdx(null);
                                                }}
                                            />
                                        ) : (
                                            <TouchableOpacity
                                                style={[styles.foodAmount, { flexDirection: 'row', alignItems: 'center', gap: 2 }]}
                                                onPress={() => {
                                                    setEditingFoodIdx(foodIdx);
                                                    setEditAmount(String(food.amount || 100));
                                                    setEditUnit(food.unit || 'gramos');
                                                }}
                                            >
                                                {(food.unit === 'a_gusto' || food.unit === 'Libre') ? (
                                                    <Text style={styles.libreText}>Libre</Text>
                                                ) : (
                                                    <>
                                                        <Text style={styles.foodAmountText}>
                                                            {food.amount}
                                                        </Text>
                                                        <Text style={[styles.foodAmountText, { fontSize: 13, color: '#94a3b8' }]}>
                                                            {UNIT_CONVERSIONS[food.unit]?.label || food.unit}
                                                        </Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        )}


                                        {/* Remove Button */}
                                        <TouchableOpacity
                                            style={styles.foodRemove}
                                            onPress={() => onRemoveFood(foodIdx)}
                                        >
                                            <Ionicons name="close" size={14} color="#9ca3af" />
                                        </TouchableOpacity>
                                    </View>

                                </View>
                            );
                        })}

                        <TouchableOpacity style={styles.addFoodBtn} onPress={onAddFood}>
                            <Ionicons name="add-circle-outline" size={14} color="#3b82f6" />
                            <Text style={styles.addFoodBtnText}>Añadir</Text>
                        </TouchableOpacity>
                    </>
                )
                }
            </View >

            {/* Supplements (if any) */}
            {
                option.supplements?.length > 0 && (
                    <View style={styles.supplementsRow}>
                        {option.supplements.map((supp, idx) => (
                            <Text key={idx} style={styles.supplementPill}>💊 {supp.name}</Text>
                        ))}
                    </View>
                )
            }

            {/* Coach Note */}
            {showNote ? (
                <View style={styles.coachNoteContainer}>
                    <View style={styles.coachNoteHeader}>
                        <Text style={styles.coachNoteLabel}>📝 Nota</Text>
                        <TouchableOpacity
                            onPress={() => {
                                clearTimeout(noteTimerRef.current);
                                setLocalNote('');
                                onUpdateNote?.('');
                                setShowNote(false);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="close" size={14} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                    <EnhancedTextInput
                        containerStyle={styles.coachNoteInputContainer}
                        style={styles.coachNoteInput}
                        value={localNote}
                        onChangeText={(text) => {
                            setLocalNote(text);
                            clearTimeout(noteTimerRef.current);
                            noteTimerRef.current = setTimeout(() => onUpdateNote?.(text), 400);
                        }}
                        onBlur={() => {
                            clearTimeout(noteTimerRef.current);
                            onUpdateNote?.(localNote);
                        }}
                        placeholder="Ej: Mézclalo todo en la batidora..."
                        placeholderTextColor="#94a3b8"
                        multiline
                    />
                </View>
            ) : (
                <TouchableOpacity
                    style={styles.addNoteBtn}
                    onPress={() => setShowNote(true)}
                >
                    <Text style={styles.addNoteBtnText}>
                        📝 Añadir Nota
                    </Text>
                </TouchableOpacity>
            )}
        </View >
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    // Section
    mealSection: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    mealIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
        letterSpacing: 0.5,
    },
    // New Bulk Tool Button
    bulkToolBtn: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 6,
        alignItems: 'center',
        ...Platform.select({
            default: { elevation: 1 },
            web: { boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
        })
    },
    bulkToolText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
    },
    optionsBadge: {
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    optionsBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    addOptionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#eff6ff',
    },
    addOptionBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3b82f6',
    },
    // Carousel
    optionsCarousel: {
        paddingLeft: 4,
        paddingRight: 20,
        gap: 12,
    },
    // Option Card
    optionCard: {
        width: 260,
        backgroundColor: '#fff',
        borderRadius: 14,
        overflow: 'hidden',
        ...Platform.select({
            web: {
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            },
            default: {
                elevation: 2,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
            }
        }),
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: '#f8fafc',
        borderLeftWidth: 4,
    },
    optionTitleRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    optionNameInput: {
        flex: 1, // Allow taking space for wrapping
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        padding: 0,
        ...Platform.select({
            web: { outlineStyle: 'none' }
        })
    },
    optionNameInputContainer: {
        flex: 1,
        padding: 0,
    },
    optionNameInputText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        ...Platform.select({
            web: { outlineStyle: 'none' }
        })
    },
    optionName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 2,
    },
    optionActions: {
        flexDirection: 'row',
        gap: 6,
    },
    optionActionBtn: {
        padding: 6,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    // Macros
    optionMacros: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#fafafa',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    optionMacrosText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
    },
    // Foods
    optionFoods: {
        padding: 12,
        minHeight: 100,
    },
    // 🔄 Web DnD: Drop zone highlight
    dropZoneActive: {
        // boxShadow inset works with overflow:hidden (border doesn't)
        ...Platform.select({
            web: { boxShadow: 'inset 0 0 0 3px #3b82f6', backgroundColor: '#eff6ff' },
            default: {},
        }),
    },
    emptyOption: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#e5e7eb',
        borderRadius: 10,
        padding: 20,
    },
    emptyOptionText: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 6,
    },
    foodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    foodIcon: {
        fontSize: 14,
        color: '#d1d5db',
        marginRight: 8,
    },
    foodName: {
        flex: 1,
        fontSize: 13,
        color: '#374151',
    },
    foodAmount: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 6,
    },
    foodAmountText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6b7280',
    },
    libreText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#4d7c0f',
        backgroundColor: '#ecfccb',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    foodAmountEdit: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#3b82f6',
        borderRadius: 4,
        paddingHorizontal: 4,
    },
    foodAmountInput: {
        width: 40,
        fontSize: 11,
        fontWeight: '600',
        color: '#1e293b',
        textAlign: 'center',
        padding: 2,
    },
    foodAmountUnit: {
        fontSize: 10,
        color: '#64748b',
        marginRight: 2,
    },
    foodRemove: {
        padding: 6,
        marginLeft: 4,
    },

    // NEW: Rich Food Card Styles
    foodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fafafa',
        borderRadius: 8,
        padding: 8,
        marginBottom: 6,
        gap: 8,
    },
    foodPhoto: {
        width: 36,
        height: 36,
        borderRadius: 6,
    },
    foodPhotoPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    foodFavBtn: {
        marginHorizontal: 4,
        padding: 2,
    },
    foodDetails: {
        flex: 1,
        minWidth: 0,
    },
    foodMacrosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    foodKcal: {
        fontSize: 10,
        fontWeight: '700',
        color: '#f97316',
    },
    foodMacro: {
        fontSize: 9,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    foodRightSection: {
        alignItems: 'flex-end',
        gap: 4,
    },
    pctBadge: {
        backgroundColor: '#e0f2fe',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    pctText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#0ea5e9',
    },
    addFoodBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        paddingVertical: 4,
    },
    addFoodBtnText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#3b82f6',
    },
    // Supplements (Option level - legacy)
    supplementsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
    supplementPill: {
        fontSize: 11,
        color: '#6366f1',
        backgroundColor: '#f5f3ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    // 📝 Coach Note
    coachNoteContainer: {
        marginHorizontal: 12,
        marginBottom: 12,
        backgroundColor: '#fefce8',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    coachNoteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    coachNoteLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#92400e',
    },
    coachNoteInputContainer: {
        backgroundColor: 'transparent',
        padding: 0,
        margin: 0,
        borderWidth: 0,
    },
    coachNoteInput: {
        fontSize: 13,
        color: '#78350f',
        minHeight: 36,
        textAlignVertical: 'top',
    },
    addNoteBtn: {
        paddingHorizontal: 12,
        paddingBottom: 10,
    },
    addNoteBtnText: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
    },
    // 💊 Supplements Section (Meal level)
    supplementsSection: {
        marginHorizontal: 4,
        marginBottom: 12,
        backgroundColor: '#faf5ff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e9d5ff',
        overflow: 'hidden',
    },
    supplementsHeader: {
        backgroundColor: '#f3e8ff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e9d5ff',
    },
    supplementsTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7c3aed',
    },
    supplementsList: {
        padding: 8,
        gap: 6,
    },
    supplementItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        gap: 10,
        ...Platform.select({
            web: { boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
            default: { elevation: 1 }
        }),
    },
    supplementTiming: {
        fontSize: 16,
    },
    supplementInfo: {
        flex: 1,
    },
    supplementName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    supplementDose: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
    supplementRemove: {
        padding: 4,
    },
    // Add Option Card
    addOptionCard: {
        width: 120,
        minHeight: 150,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#e5e7eb',
        borderRadius: 14,
        backgroundColor: '#fafafa',
    },
    addOptionCardText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 8,
    },
    addOptionCardText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 8,
    },

    // 🧑‍🍳 RECIPE CARD STYLES (Polymorphic)
    recipeCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 0, // 🟢 FIXED: Connects to ingredients
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        height: 72, // Slightly more compact
    },
    recipeImage: {
        width: 72,
        height: '100%',
        backgroundColor: '#f1f5f9',
    },
    recipeImageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },

    // 🟢 IMAGE MODAL STYLES
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center', // 🟢 Center horizontally
        padding: 24,
    },
    imageModalContent: {
        width: '100%', // Mobile responsive
        maxWidth: 420, // 🟢 Limit width on Web/Desktop
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        // shadow for elevation
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 20,
        textAlign: 'center',
    },
    modalWithImageContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    modalImagePreview: {
        width: '100%',
        height: 180,
        borderRadius: 12,
        resizeMode: 'cover',
        backgroundColor: '#f1f5f9',
    },
    imgOptionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    imgOptionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
    },
    imgOptionSub: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    urlInputBlock: {
        marginTop: 8,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    urlLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
    },
    urlRow: {
        flexDirection: 'row',
        gap: 8,
    },
    urlInput: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#334155',
    },
    urlInputContainer: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    urlInputText: {
        fontSize: 14,
        color: '#334155',
    },
    urlSendBtn: {
        backgroundColor: '#3b82f6',
        width: 44,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeModalBtn: {
        marginTop: 20,
        alignItems: 'center',
    },
    closeModalText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748b',
    },
    recipeContent: {
        flex: 1,
        padding: 8,
        justifyContent: 'space-between',
    },
    recipeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    recipeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#3b82f6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    recipeBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700',
    },
    recipeName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
        marginVertical: 4,
    },
    recipeFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    recipeMacros: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    recipePortion: {
        fontSize: 11,
        fontWeight: '700',
        color: '#3b82f6',
    },
    recipeCardExpanded: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    // Expandable Ingredients
    ingredientsList: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        padding: 10,
        paddingTop: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderTopWidth: 0,
        marginBottom: 8,
    },
    ingredientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    ingThumb: {
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    ingThumbPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    ingName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 2,
    },
    ingMacro: {
        fontSize: 10,
        fontWeight: '500',
        color: '#64748b',
    },
    ingRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    ingQtyTouch: {
        backgroundColor: '#fff',
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 6,
        minWidth: 36,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    ingQty: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a'
    },
    ingInput: {
        width: 40,
        height: 24,
        padding: 0,
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#3b82f6',
        borderRadius: 4,
        color: '#3b82f6'
    },
    ingInputContainer: {
        width: 40,
        height: 24,
        padding: 0,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#3b82f6',
        borderRadius: 4,
    },
    ingInputText: {
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        color: '#3b82f6',
    },
    ingUnit: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94a3b8',
        width: 16, // Compact
        textAlign: 'center'
    },
    ingFooter: {
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc'
    },
    recipeContainer: {
        marginBottom: 12, // Gap between recipes
    },
    // Modern Macro Pills
    macroPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 12,
        gap: 4,
    },
    macroPillText: {
        fontSize: 10,
        fontWeight: '600',
    },
    // Estilos reutilizables
    flex1: {
        flex: 1,
    },
    rowGap6: {
        flexDirection: 'row',
        gap: 6,
    },
    rowGap8: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    rowSpaceBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rowCenterGap6: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    fontSize10: {
        fontSize: 10,
    },
    fontSize24: {
        fontSize: 24,
    },
});

// Export ImageSelectionModal for use in index.jsx
export { ImageSelectionModal };
