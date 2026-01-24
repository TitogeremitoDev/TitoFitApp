/* app/(coach)/nutrition/components/SmartFoodDrawer.jsx
 * 🍽️ SMART FOOD DRAWER - Panel lateral para añadir alimentos
 * - Multi-selección con checkboxes
 * - Conversión de unidades (gramos, cucharadas, etc.)
 * - Tabs: Favoritos, Recientes, Global
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Animated,
    Platform,
    useWindowDimensions,
    Pressable,
    Image,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import food service (uses correct API + token)
import { searchFoods, getFavorites, saveFood } from '../../../../src/services/foodService';

// Import local foods data
import localFoods from '../../../../src/constants/localFoods.json';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// Unit conversions (grams equivalent for 1 unit)
const UNIT_CONVERSIONS = {
    gramos: { factor: 1, label: 'g', labelLong: 'Gramos' },
    cucharada: { factor: 15, label: 'cda', labelLong: 'Cucharada' },
    cucharadita: { factor: 5, label: 'cdta', labelLong: 'Cucharadita' },
    taza: { factor: 200, label: 'taza', labelLong: 'Taza' },
    puñado: { factor: 30, label: 'puñado', labelLong: 'Puñado' },
    rebanada: { factor: 30, label: 'reb', labelLong: 'Rebanada' },
    scoop: { factor: 30, label: 'scoop', labelLong: 'Scoop' },
};

// Drawer mode tabs
const MODE_TABS = [
    { id: 'search', label: 'Buscar', icon: 'search-outline' },
    { id: 'manual', label: 'Manual', icon: 'create-outline' },
    { id: 'quick', label: 'Rápido', icon: 'flash-outline' },
];

// Food filter tabs (for search mode)
const FOOD_TABS = [
    { id: 'global', label: 'Global', icon: 'globe-outline' },
    { id: 'recientes', label: 'Recientes', icon: 'time-outline' },
    { id: 'favoritos', label: 'Favoritos', icon: 'star-outline' },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Calculate macros for given amount and unit
// ═══════════════════════════════════════════════════════════════════════════
const calculateMacros = (baseNutrients, amount, unitKey) => {
    const conversion = UNIT_CONVERSIONS[unitKey] || UNIT_CONVERSIONS.gramos;
    const gramsEquivalent = amount * conversion.factor;
    const multiplier = gramsEquivalent / 100; // Base nutrients are per 100g

    return {
        kcal: Math.round((baseNutrients.kcal || 0) * multiplier),
        protein: Math.round((baseNutrients.protein || 0) * multiplier * 10) / 10,
        carbs: Math.round((baseNutrients.carbs || 0) * multiplier * 10) / 10,
        fat: Math.round((baseNutrients.fat || 0) * multiplier * 10) / 10,
    };
};

// Tag display mapping
const TAG_DISPLAY = {
    'HIGH_PROTEIN': { icon: '🥩', label: 'Alta Prot' },
    'Alta Proteína': { icon: '🥩', label: 'Alta Prot' },
    'LOW_CARB': { icon: '📉', label: 'Low Carb' },
    'GLUTEN_FREE': { icon: '🚫', label: 'Sin Gluten' },
    'Sin Gluten': { icon: '🚫', label: 'Sin Gluten' },
    'VEGAN': { icon: '🌱', label: 'Vegano' },
    'Vegano': { icon: '🌱', label: 'Vegano' },
    'VEGETARIAN': { icon: '🥬', label: 'Vegetariano' },
    'Integral': { icon: '🌾', label: 'Integral' },
    'Desayuno': { icon: '🌅', label: 'Desayuno' },
    'Snack': { icon: '🍿', label: 'Snack' },
    'Proteína': { icon: '🥩', label: 'Proteína' },
    'Carbo': { icon: '🍚', label: 'Carbo' },
    'Lácteo': { icon: '🥛', label: 'Lácteo' },
    'Fruta': { icon: '🍎', label: 'Fruta' },
    'Vegetal': { icon: '🥦', label: 'Vegetal' },
};

// ═══════════════════════════════════════════════════════════════════════════
// FOOD ROW ITEM COMPONENT (Data-Rich Design)
// ═══════════════════════════════════════════════════════════════════════════
function FoodRowItem({
    food,
    isSelected,
    onToggleSelect,
    onQuickAdd,
    selectionData, // { amount, unit }
    onUpdateSelection,
}) {
    const [expanded, setExpanded] = useState(false);
    const baseNutrients = food.nutrients || {};

    // Current calculated macros - ALWAYS reactive to input changes
    const displayMacros = useMemo(() => {
        const amount = selectionData?.amount ?? 100;
        const unit = selectionData?.unit ?? 'gramos';
        return calculateMacros(baseNutrients, amount, unit);
    }, [baseNutrients, selectionData]);

    const handleToggle = () => {
        if (isSelected) {
            onToggleSelect(food, false);
            setExpanded(false);
        } else {
            onToggleSelect(food, true, { amount: 100, unit: 'gramos' });
            setExpanded(true);
        }
    };

    const handleAmountChange = (text) => {
        const amount = parseFloat(text) || 0;
        console.log('handleAmountChange - food:', food, 'nutrients:', food?.nutrients);
        // Always include food object to ensure it's stored
        onUpdateSelection(food._id, { food, amount, unit: selectionData?.unit || 'gramos' });
    };

    const handleUnitChange = (unitKey) => {
        // Reset amount: 100 for grams, 1 for other units
        const newAmount = unitKey === 'gramos' ? 100 : 1;
        console.log('handleUnitChange - food:', food, 'nutrients:', food?.nutrients);
        // Always include food object to ensure it's stored
        onUpdateSelection(food._id, { food, amount: newAmount, unit: unitKey });
    };

    // Get displayable tags (ALL of them, rendering decides how many)
    const displayTags = useMemo(() => {
        if (!food.tags || food.tags.length === 0) return [];
        return food.tags
            .filter(tag => TAG_DISPLAY[tag])
            .map(tag => TAG_DISPLAY[tag]);
    }, [food.tags]);

    const extraTagsCount = displayTags.length > 2 ? displayTags.length - 2 : 0;

    return (
        <View style={styles.foodRow}>
            {/* Checkbox */}
            <TouchableOpacity
                style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                onPress={handleToggle}
            >
                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
            </TouchableOpacity>

            {/* BLOCK 1: Food Info (Left - Flex Grow) */}
            <View style={styles.foodInfoBlock}>
                {/* Thumbnail */}
                {food.image ? (
                    <Image
                        source={{ uri: food.image }}
                        style={styles.foodThumb}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={styles.foodThumbPlaceholder}>
                        <Ionicons name="fast-food-outline" size={18} color="#94a3b8" />
                    </View>
                )}

                {/* Text Content */}
                <View style={styles.foodTextContent}>
                    <Text style={styles.foodName} numberOfLines={1}>{food.name}</Text>
                    {/* Tags Row */}
                    {displayTags.length > 0 && (
                        <View style={styles.tagsRow}>
                            {(expanded ? displayTags : displayTags.slice(0, 2)).map((tag, idx) => (
                                <View key={idx} style={styles.tagBadge}>
                                    <Text style={styles.tagText}>{tag.icon} {tag.label}</Text>
                                </View>
                            ))}
                            {!expanded && extraTagsCount > 0 && (
                                <TouchableOpacity
                                    style={styles.tagBadgeExtra}
                                    onPress={() => setExpanded(true)}
                                >
                                    <Text style={styles.tagTextExtra}>+{extraTagsCount}</Text>
                                </TouchableOpacity>
                            )}
                            {expanded && extraTagsCount > 0 && (
                                <TouchableOpacity
                                    style={styles.tagBadgeExtra}
                                    onPress={() => setExpanded(false)}
                                >
                                    <Text style={styles.tagTextExtra}>−</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>
            </View>

            {/* BLOCK 2: Stats + Input (Center-Right) */}
            <View style={styles.controlBlock}>
                {/* A. Dynamic Macros (Vertical Column) */}
                <View style={styles.statsColumn}>
                    <Text style={styles.kcalBadge}>🔥 {displayMacros.kcal}</Text>
                    <Text style={[styles.macroNum, { color: '#3b82f6' }]}>P:{Math.round(displayMacros.protein)}</Text>
                    <Text style={[styles.macroNum, { color: '#22c55e' }]}>C:{Math.round(displayMacros.carbs)}</Text>
                    <Text style={[styles.macroNum, { color: '#f59e0b' }]}>G:{Math.round(displayMacros.fat)}</Text>
                </View>

                {/* B. Inline Input Group + Weight Hint */}
                <View style={styles.inputWrapper}>
                    <View style={styles.inlineInputGroup}>
                        <TextInput
                            style={styles.inlineInputNumber}
                            value={String(selectionData?.amount || 100)}
                            onChangeText={handleAmountChange}
                            keyboardType="numeric"
                            selectTextOnFocus
                        />
                        <TouchableOpacity
                            style={styles.inlineUnitPicker}
                            onPress={() => {
                                const units = Object.keys(UNIT_CONVERSIONS);
                                const currentIndex = units.indexOf(selectionData?.unit || 'gramos');
                                const nextIndex = (currentIndex + 1) % units.length;
                                handleUnitChange(units[nextIndex]);
                            }}
                        >
                            <Text style={styles.inlineUnitText}>
                                {UNIT_CONVERSIONS[selectionData?.unit]?.label || 'g'}
                            </Text>
                            <Ionicons name="chevron-down" size={10} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                    {/* Gram Equivalent Hint */}
                    {selectionData?.unit && selectionData?.unit !== 'gramos' && (
                        <Text style={styles.gramHint}>
                            ≈ {Math.round((selectionData?.amount || 1) * UNIT_CONVERSIONS[selectionData?.unit]?.factor)}g
                        </Text>
                    )}
                </View>
            </View>


        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DRAWER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function SmartFoodDrawer({
    visible,
    onClose,
    onAddFoods, // (foods: Array<{ food, amount, unit, calculatedMacros }>) => void
    context, // { templateId, mealId, optionId }
}) {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isDesktop = windowWidth >= 768;
    const drawerWidth = isDesktop ? Math.min(windowWidth * 0.35, 450) : windowWidth;

    // Animation
    const slideAnim = useRef(new Animated.Value(drawerWidth)).current;
    const flashAnim = useRef(new Animated.Value(0)).current;

    // Drawer Mode State
    const [drawerMode, setDrawerMode] = useState('search'); // 'search' | 'manual' | 'quick'

    // Search Mode State
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('global');
    const [selections, setSelections] = useState({}); // { foodId: { food, amount, unit } }
    const [allFoods, setAllFoods] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [recentFoods, setRecentFoods] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Manual Mode State
    const [manualForm, setManualForm] = useState({
        name: '',
        kcal: '',
        protein: '',
        carbs: '',
        fat: '',
        quantity: '1',
        unit: 'porción',
    });
    const [saveToLibrary, setSaveToLibrary] = useState(false);

    // Quick Mode State
    const [quickForm, setQuickForm] = useState({
        kcal: '',
        protein: '',
        carbs: '',
        fat: '',
    });

    // Toast State
    const [toast, setToast] = useState({ visible: false, message: '' });

    // Show toast helper
    const showToast = useCallback((message) => {
        setToast({ visible: true, message });
        setTimeout(() => setToast({ visible: false, message: '' }), 2000);
    }, []);

    // Flash animation helper
    const triggerFlash = useCallback(() => {
        Animated.sequence([
            Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
            Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
        ]).start();
    }, [flashAnim]);

    // Fetch foods using foodService
    const fetchFoods = useCallback(async (query = '') => {
        try {
            setIsLoading(true);
            // searchFoods handles LOCAL + CLOUD + API layers
            const results = await searchFoods(query);
            setAllFoods(results);
        } catch (error) {
            console.error('[SmartDrawer] Search error:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch favorites using foodService
    const fetchFavorites = useCallback(async () => {
        try {
            const favs = await getFavorites();
            setFavorites(favs);
        } catch (error) {
            console.error('[SmartDrawer] Favorites error:', error);
        }
    }, []);

    // Load recent foods from localStorage
    const loadRecentFoods = useCallback(async () => {
        try {
            const stored = await AsyncStorage.getItem('recentFoods');
            if (stored) {
                setRecentFoods(JSON.parse(stored));
            }
        } catch (error) {
            console.error('[SmartDrawer] Recent foods load error:', error);
        }
    }, []);

    // Initial fetch when drawer opens
    useEffect(() => {
        if (visible) {
            fetchFoods();
            fetchFavorites();
            loadRecentFoods();
        }
    }, [visible, fetchFoods, fetchFavorites, loadRecentFoods]);

    // Debounced search
    useEffect(() => {
        if (!visible) return;

        const timeoutId = setTimeout(() => {
            if (activeTab === 'global' && searchQuery.trim().length >= 2) {
                fetchFoods(searchQuery);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, activeTab, visible, fetchFoods]);

    // Animate in/out
    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: drawerWidth,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, drawerWidth]);

    // Combine and filter foods based on search and tab
    const filteredFoods = useMemo(() => {
        // Tab-specific sources
        if (activeTab === 'favoritos') {
            return favorites;
        }

        if (activeTab === 'recientes') {
            return recentFoods;
        }

        // Global tab: Use allFoods from searchFoods (already merged LOCAL + CLOUD + API)
        // If no search, show all; searchFoods already handles this
        return allFoods;
    }, [activeTab, allFoods, favorites, recentFoods]);

    // Get display name for current meal
    const mealDisplayName = useMemo(() => {
        if (!context?.mealId) return null;
        const mealIdLower = context.mealId.toLowerCase();

        // Extract meal type from IDs like 'meal_desayuno_123456'
        if (mealIdLower.includes('desayuno')) return 'Desayuno';
        if (mealIdLower.includes('comida') || mealIdLower.includes('almuerzo')) return 'Comida';
        if (mealIdLower.includes('cena')) return 'Cena';
        return 'Snack';
    }, [context?.mealId]);

    // Smart suggestions based on meal context (desayuno, comida, cena, snack)
    const suggestedFoods = useMemo(() => {
        if (!context?.mealId) return [];
        const mealIdLower = context.mealId.toLowerCase();

        // Determine which tags to search based on mealId content
        let relevantTags = ['Snack', 'snack', 'SNACK', 'merienda', 'Merienda'];

        if (mealIdLower.includes('desayuno')) {
            relevantTags = ['Desayuno', 'desayuno', 'DESAYUNO', 'breakfast'];
        } else if (mealIdLower.includes('comida') || mealIdLower.includes('almuerzo')) {
            relevantTags = ['Almuerzo', 'almuerzo', 'ALMUERZO', 'Comida', 'comida', 'lunch'];
        } else if (mealIdLower.includes('cena')) {
            relevantTags = ['Cena', 'cena', 'CENA', 'dinner'];
        }

        // Filter allFoods by matching tags
        const matches = allFoods.filter(food =>
            food.tags?.some(tag => relevantTags.includes(tag))
        );
        return matches.slice(0, 5); // Limit to 5 suggestions
    }, [context?.mealId, allFoods]);

    // Selection handlers
    const handleToggleSelect = useCallback((food, selected, initialData) => {
        setSelections(prev => {
            if (selected) {
                return { ...prev, [food._id]: { food, ...initialData } };
            } else {
                const { [food._id]: _, ...rest } = prev;
                return rest;
            }
        });
    }, []);

    const handleUpdateSelection = useCallback((foodId, data) => {
        setSelections(prev => ({
            ...prev,
            [foodId]: { ...prev[foodId], ...data },
        }));
    }, []);

    // Save foods to recent list
    const saveToRecent = useCallback(async (foods) => {
        try {
            const stored = await AsyncStorage.getItem('recentFoods');
            let recent = stored ? JSON.parse(stored) : [];

            // Add new foods at the beginning (avoiding duplicates)
            foods.forEach(f => {
                recent = recent.filter(r => r._id !== f._id && r.name !== f.name);
                recent.unshift(f);
            });

            // Keep only last 20
            recent = recent.slice(0, 20);

            await AsyncStorage.setItem('recentFoods', JSON.stringify(recent));
            setRecentFoods(recent);
        } catch (error) {
            console.error('[SmartDrawer] Save recent error:', error);
        }
    }, []);

    const handleQuickAdd = useCallback((food) => {
        // Quick add with default 100g
        const macros = calculateMacros(food.nutrients, 100, 'gramos');
        onAddFoods([{
            food,
            amount: 100,
            unit: 'gramos',
            calculatedMacros: macros,
        }]);
        // Save to recent
        saveToRecent([food]);
    }, [onAddFoods, saveToRecent]);

    const handleAddSelected = useCallback(() => {
        const validSelections = Object.values(selections).filter(sel => {
            // Extra validation
            if (!sel || !sel.food || !sel.food.nutrients) {
                console.warn('Invalid selection found:', sel);
                return false;
            }
            return true;
        });

        if (validSelections.length === 0) {
            console.warn('No valid selections to add');
            return;
        }

        const foodsToAdd = validSelections.map(sel => ({
            food: sel.food,
            amount: sel.amount || 100,
            unit: sel.unit || 'gramos',
            calculatedMacros: calculateMacros(sel.food.nutrients, sel.amount || 100, sel.unit || 'gramos'),
        }));

        onAddFoods(foodsToAdd);
        // Save to recent
        saveToRecent(foodsToAdd.map(f => f.food));
        setSelections({});
    }, [selections, onAddFoods, saveToRecent]);

    // ═══════════════════════════════════════════════════════════════════════════
    // MANUAL MODE HANDLER
    // ═══════════════════════════════════════════════════════════════════════════
    const handleManualAdd = useCallback(async () => {
        const { name, kcal, protein, carbs, fat, quantity, unit } = manualForm;

        if (!name.trim()) {
            showToast('⚠️ Introduce un nombre');
            return;
        }

        const nutrients = {
            kcal: parseFloat(kcal) || 0,
            protein: parseFloat(protein) || 0,
            carbs: parseFloat(carbs) || 0,
            fat: parseFloat(fat) || 0,
        };

        const foodData = {
            _id: `custom_${Date.now()}`,
            name: name.trim(),
            nutrients,
            isCustom: true,
            layer: 'CUSTOM',
        };

        // Save to library if toggle is ON
        if (saveToLibrary) {
            try {
                const saved = await saveFood({
                    name: name.trim(),
                    nutrients,
                    tags: [],
                });
                foodData._id = saved._id;
                foodData.isCustom = false;
                foodData.layer = 'CLOUD';
                showToast('✅ Guardado en tu biblioteca');
            } catch (error) {
                console.error('[Manual] Save error:', error);
                showToast('⚠️ Error al guardar, añadido solo a esta dieta');
            }
        }

        // Add to meal
        onAddFoods([{
            food: foodData,
            amount: parseFloat(quantity) || 1,
            unit,
            calculatedMacros: nutrients,
        }]);

        // Reset form
        setManualForm({
            name: '',
            kcal: '',
            protein: '',
            carbs: '',
            fat: '',
            quantity: '1',
            unit: 'porción',
        });

        if (!saveToLibrary) {
            showToast('✅ Añadido a la dieta');
        }
    }, [manualForm, saveToLibrary, onAddFoods, showToast]);

    // ═══════════════════════════════════════════════════════════════════════════
    // QUICK MODE HANDLER
    // ═══════════════════════════════════════════════════════════════════════════
    const handleQuickMacrosAdd = useCallback(() => {
        const { kcal, protein, carbs, fat } = quickForm;

        const nutrients = {
            kcal: parseFloat(kcal) || 0,
            protein: parseFloat(protein) || 0,
            carbs: parseFloat(carbs) || 0,
            fat: parseFloat(fat) || 0,
        };

        // Must have at least one value
        if (nutrients.kcal === 0 && nutrients.protein === 0 && nutrients.carbs === 0 && nutrients.fat === 0) {
            showToast('⚠️ Introduce al menos un valor');
            return;
        }

        const quickFood = {
            _id: `quick_${Date.now()}`,
            name: 'Ajuste Rápido',
            nutrients,
            isCustom: true,
            isQuickAdjust: true,
            layer: 'QUICK',
        };

        // Trigger flash animation
        triggerFlash();

        // Add to meal
        onAddFoods([{
            food: quickFood,
            amount: 1,
            unit: 'ajuste',
            calculatedMacros: nutrients,
        }]);

        // Show toast
        showToast('⚡ Macros ajustados correctamente');

        // Reset form
        setQuickForm({ kcal: '', protein: '', carbs: '', fat: '' });

        // Panel stays open for persistent behavior (user can close manually)
    }, [quickForm, onAddFoods, showToast, triggerFlash]);

    // Switch to Manual mode with prefilled name (from "Not Found" CTA)
    const switchToManualWithName = useCallback((name) => {
        setManualForm(prev => ({ ...prev, name }));
        setDrawerMode('manual');
    }, []);

    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            {/* Backdrop */}
            {isDesktop ? null : (
                <Pressable style={styles.backdrop} onPress={onClose} />
            )}

            {/* Floating Drawer */}
            <Animated.View
                style={[
                    styles.drawer,
                    isDesktop ? styles.drawerFloating : styles.drawerMobile,
                    {
                        width: drawerWidth,
                        transform: [{ translateX: slideAnim }],
                    }
                ]}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <Text style={styles.headerTitle}>🍽️ Añadir Alimentos</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Mode Tabs */}
                    <View style={styles.modeTabs}>
                        {MODE_TABS.map(tab => (
                            <TouchableOpacity
                                key={tab.id}
                                style={[styles.modeTab, drawerMode === tab.id && styles.modeTabActive]}
                                onPress={() => setDrawerMode(tab.id)}
                            >
                                <Ionicons
                                    name={tab.icon}
                                    size={18}
                                    color={drawerMode === tab.id ? '#fff' : '#64748b'}
                                />
                                <Text style={[
                                    styles.modeTabText,
                                    drawerMode === tab.id && styles.modeTabTextActive
                                ]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Search Bar (only in search mode) */}
                    {drawerMode === 'search' && (
                        <>
                            <View style={styles.searchContainer}>
                                <Ionicons name="search" size={18} color="#94a3b8" />
                                <TextInput
                                    style={styles.searchInput}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Buscar alimento..."
                                    placeholderTextColor="#94a3b8"
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Food Filter Tabs */}
                            <View style={styles.tabs}>
                                {FOOD_TABS.map(tab => (
                                    <TouchableOpacity
                                        key={tab.id}
                                        style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                                        onPress={() => setActiveTab(tab.id)}
                                    >
                                        <Ionicons
                                            name={tab.icon}
                                            size={16}
                                            color={activeTab === tab.id ? '#3b82f6' : '#64748b'}
                                        />
                                        <Text style={[
                                            styles.tabText,
                                            activeTab === tab.id && styles.tabTextActive
                                        ]}>
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    )}
                </View>

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* CONTENT: Search Mode */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {drawerMode === 'search' && (
                    <ScrollView
                        style={styles.foodList}
                        contentContainerStyle={styles.foodListContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Loading Indicator */}
                        {isLoading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="#3b82f6" />
                                <Text style={styles.loadingText}>Buscando...</Text>
                            </View>
                        )}

                        {/* Smart Suggestions for current meal */}
                        {suggestedFoods.length > 0 && (
                            <View style={styles.suggestionsSection}>
                                <View style={styles.suggestionHeader}>
                                    <Text style={styles.suggestionTitle}>
                                        ⚡ Sugerencias para {mealDisplayName || 'esta comida'}
                                    </Text>
                                </View>
                                {suggestedFoods.map(food => (
                                    <FoodRowItem
                                        key={`suggest-${food._id}`}
                                        food={food}
                                        isSelected={!!selections[food._id]}
                                        selectionData={selections[food._id]}
                                        onToggleSelect={handleToggleSelect}
                                        onUpdateSelection={handleUpdateSelection}
                                        onQuickAdd={handleQuickAdd}
                                    />
                                ))}
                            </View>
                        )}

                        {/* Search Results Header */}
                        {filteredFoods.length > 0 && (
                            <Text style={styles.resultsHeader}>
                                {searchQuery.trim() ? 'Resultados' : 'Todos los alimentos'}
                            </Text>
                        )}

                        {filteredFoods.map(food => (
                            <FoodRowItem
                                key={food._id}
                                food={food}
                                isSelected={!!selections[food._id]}
                                selectionData={selections[food._id]}
                                onToggleSelect={handleToggleSelect}
                                onUpdateSelection={handleUpdateSelection}
                                onQuickAdd={handleQuickAdd}
                            />
                        ))}

                        {/* Not Found CTA */}
                        {filteredFoods.length === 0 && searchQuery.trim().length > 0 && (
                            <View style={styles.notFoundContainer}>
                                <Ionicons name="search-outline" size={48} color="#cbd5e1" />
                                <Text style={styles.notFoundText}>
                                    No se encontró "{searchQuery}"
                                </Text>
                                <TouchableOpacity
                                    style={styles.createNowBtn}
                                    onPress={() => switchToManualWithName(searchQuery)}
                                >
                                    <Ionicons name="add-circle" size={20} color="#fff" />
                                    <Text style={styles.createNowText}>
                                        Crear "{searchQuery}" ahora
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {filteredFoods.length === 0 && searchQuery.trim().length === 0 && (
                            <View style={styles.emptyState}>
                                <Ionicons name="nutrition-outline" size={48} color="#cbd5e1" />
                                <Text style={styles.emptyText}>Escribe para buscar alimentos</Text>
                            </View>
                        )}

                        {/* Bottom padding for floating button */}
                        <View style={{ height: 100 }} />
                    </ScrollView>
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* CONTENT: Manual Mode */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {drawerMode === 'manual' && (
                    <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
                        <Text style={styles.formLabel}>Nombre del alimento</Text>
                        <TextInput
                            style={styles.formInput}
                            value={manualForm.name}
                            onChangeText={(v) => setManualForm(p => ({ ...p, name: v }))}
                            placeholder="Ej: Pastel de cumpleaños"
                            placeholderTextColor="#94a3b8"
                        />

                        <View style={styles.formRow}>
                            <View style={styles.formCol}>
                                <Text style={styles.formLabel}>Cantidad</Text>
                                <TextInput
                                    style={styles.formInput}
                                    value={manualForm.quantity}
                                    onChangeText={(v) => setManualForm(p => ({ ...p, quantity: v }))}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.formCol}>
                                <Text style={styles.formLabel}>Unidad</Text>
                                <TextInput
                                    style={styles.formInput}
                                    value={manualForm.unit}
                                    onChangeText={(v) => setManualForm(p => ({ ...p, unit: v }))}
                                    placeholder="Porción"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                        </View>

                        <Text style={styles.formSectionTitle}>Macros (por esa cantidad)</Text>

                        <View style={styles.macroGrid}>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🔥</Text>
                                <TextInput
                                    style={styles.macroInput}
                                    value={manualForm.kcal}
                                    onChangeText={(v) => setManualForm(p => ({ ...p, kcal: v }))}
                                    keyboardType="numeric"
                                    placeholder="Kcal"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🥩</Text>
                                <TextInput
                                    style={styles.macroInput}
                                    value={manualForm.protein}
                                    onChangeText={(v) => setManualForm(p => ({ ...p, protein: v }))}
                                    keyboardType="numeric"
                                    placeholder="Prot"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🍚</Text>
                                <TextInput
                                    style={styles.macroInput}
                                    value={manualForm.carbs}
                                    onChangeText={(v) => setManualForm(p => ({ ...p, carbs: v }))}
                                    keyboardType="numeric"
                                    placeholder="Carb"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🥑</Text>
                                <TextInput
                                    style={styles.macroInput}
                                    value={manualForm.fat}
                                    onChangeText={(v) => setManualForm(p => ({ ...p, fat: v }))}
                                    keyboardType="numeric"
                                    placeholder="Gras"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                        </View>

                        {/* Save to Library Toggle */}
                        <TouchableOpacity
                            style={styles.toggleRow}
                            onPress={() => setSaveToLibrary(!saveToLibrary)}
                        >
                            <View style={[styles.toggleBox, saveToLibrary && styles.toggleBoxActive]}>
                                {saveToLibrary && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </View>
                            <Text style={styles.toggleText}>Guardar en mi Biblioteca</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.addNowBtn} onPress={handleManualAdd}>
                            <Ionicons name="add-circle" size={22} color="#fff" />
                            <Text style={styles.addNowText}>AÑADIR AHORA</Text>
                        </TouchableOpacity>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* CONTENT: Quick Mode */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {drawerMode === 'quick' && (
                    <Animated.View
                        style={[
                            styles.formContainer,
                            {
                                backgroundColor: flashAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['#fff', '#dcfce7']
                                })
                            }
                        ]}
                    >
                        <Text style={styles.quickTitle}>⚡ Ajuste Rápido de Macros</Text>
                        <Text style={styles.quickSubtitle}>
                            Añade macros directamente sin crear un alimento
                        </Text>

                        <View style={styles.macroGrid}>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🔥</Text>
                                <TextInput
                                    style={styles.macroInput}
                                    value={quickForm.kcal}
                                    onChangeText={(v) => setQuickForm(p => ({ ...p, kcal: v }))}
                                    keyboardType="numeric"
                                    placeholder="Kcal"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🥩</Text>
                                <TextInput
                                    style={styles.macroInput}
                                    value={quickForm.protein}
                                    onChangeText={(v) => setQuickForm(p => ({ ...p, protein: v }))}
                                    keyboardType="numeric"
                                    placeholder="+20g"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🍚</Text>
                                <TextInput
                                    style={styles.macroInput}
                                    value={quickForm.carbs}
                                    onChangeText={(v) => setQuickForm(p => ({ ...p, carbs: v }))}
                                    keyboardType="numeric"
                                    placeholder="+30g"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🥑</Text>
                                <TextInput
                                    style={styles.macroInput}
                                    value={quickForm.fat}
                                    onChangeText={(v) => setQuickForm(p => ({ ...p, fat: v }))}
                                    keyboardType="numeric"
                                    placeholder="+10g"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                        </View>

                        {/* Quick Add Button */}
                        <TouchableOpacity
                            style={styles.quickAddMacrosBtn}
                            onPress={handleQuickMacrosAdd}
                        >
                            <Ionicons name="flash" size={20} color="#fff" />
                            <Text style={styles.quickAddMacrosText}>Añadir Macros</Text>
                        </TouchableOpacity>

                    </Animated.View>
                )}

                {/* Floating Add Button (Search Mode Only) */}
                {drawerMode === 'search' && Object.keys(selections).length > 0 && (
                    <View style={styles.floatingFooter}>
                        <TouchableOpacity
                            style={styles.addSelectedBtn}
                            onPress={handleAddSelected}
                        >
                            <Ionicons name="add-circle" size={22} color="#fff" />
                            <Text style={styles.addSelectedText}>
                                Añadir {Object.keys(selections).length} alimento{Object.keys(selections).length > 1 ? 's' : ''}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Toast Notification */}
                {toast.visible && (
                    <View style={styles.toast}>
                        <Text style={styles.toastText}>{toast.message}</Text>
                    </View>
                )}
            </Animated.View>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'stretch',
        zIndex: 1000,
        // Allow interaction with background on desktop
        pointerEvents: 'box-none',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    drawer: {
        backgroundColor: '#fff',
        overflow: 'hidden',
        pointerEvents: 'auto',
    },
    drawerFloating: {
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
        borderLeftWidth: 1,
        borderLeftColor: '#e2e8f0',
        ...Platform.select({
            web: { boxShadow: '-10px 0 40px rgba(0,0,0,0.15)' },
            default: { elevation: 24 },
        }),
    },
    drawerMobile: {
        height: '100%',
        ...Platform.select({
            web: { boxShadow: '-4px 0 24px rgba(0,0,0,0.1)' },
            default: { elevation: 24 },
        }),
    },

    // Header
    header: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    closeBtn: {
        padding: 4,
    },

    // Search
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#1e293b',
    },

    // Tabs
    tabs: {
        flexDirection: 'row',
        gap: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
    },
    tabActive: {
        backgroundColor: '#eff6ff',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    tabTextActive: {
        color: '#3b82f6',
    },

    // Food List
    foodList: {
        flex: 1,
    },
    foodListContent: {
        padding: 12,
    },

    // Food Row
    foodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,

        borderRadius: 10,
        marginBottom: 6,
        minHeight: 60,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#d1d5db',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    checkboxSelected: {
        backgroundColor: '#22c55e',
        borderColor: '#22c55e',
    },
    foodInfo: {
        flex: 1,
    },
    foodMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    foodName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    foodThumb: {
        width: 36,
        height: 36,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    foodThumbPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Data-Rich Food Row
    foodCenterContent: {
        flex: 1,
        gap: 1,
    },
    foodTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
    },
    kcalBadge: {
        fontSize: 12,
        fontWeight: '700',
        color: '#f97316',
    },
    foodMeta: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 1,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 3,
        marginTop: 2,
    },
    tagBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
    },
    tagText: {
        fontSize: 9,
        color: '#64748b',
    },
    tagBadgeExtra: {
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
    },
    tagTextExtra: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: '600',
    },

    // Smart Inline Layout
    foodInfoBlock: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
    },
    foodTextContent: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
    },
    controlBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statsColumn: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    kcalBadge: {
        fontSize: 12,
        fontWeight: '800',
        color: '#f97316',
    },
    macroNum: {
        fontSize: 9,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    // Input Wrapper (contains input group + gram hint)
    inputWrapper: {
        alignItems: 'center',
    },
    inlineInputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 28,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 6,
        backgroundColor: '#f8fafc',
        overflow: 'hidden',
    },
    inlineInputNumber: {
        width: 36,
        height: '100%',
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
        padding: 0,
        backgroundColor: '#fff',
    },
    inlineUnitPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: 8,
        height: '100%',
        backgroundColor: '#f8fafc',
        borderLeftWidth: 1,
        borderLeftColor: '#e2e8f0',
        minWidth: 50,
    },
    inlineUnitText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#475569',
    },
    gramHint: {
        fontSize: 9,
        color: '#94a3b8',
        marginTop: 2,
    },
    quickAddBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#22c55e',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
    },

    // Expanded Section
    expandedSection: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    amountInput: {
        width: 60,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        textAlign: 'center',
    },
    unitScroll: {
        flex: 1,
    },
    unitChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        marginRight: 6,
    },
    unitChipSelected: {
        backgroundColor: '#3b82f6',
    },
    unitChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    unitChipTextSelected: {
        color: '#fff',
    },
    calculatedMacros: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        flexWrap: 'wrap',
    },
    calculatedLabel: {
        fontSize: 12,
        color: '#94a3b8',
    },
    calculatedValue: {
        fontSize: 12,
        fontWeight: '600',
    },
    calculatedSeparator: {
        marginHorizontal: 6,
        color: '#cbd5e1',
    },

    // Loading State
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    loadingText: {
        fontSize: 13,
        color: '#64748b',
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 14,
        color: '#94a3b8',
    },

    // Floating Footer
    floatingFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    addSelectedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#22c55e',
        paddingVertical: 14,
        borderRadius: 12,
    },
    addSelectedText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },

    // Mode Tabs
    modeTabs: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    modeTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
    },
    modeTabActive: {
        backgroundColor: '#3b82f6',
    },
    modeTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    modeTabTextActive: {
        color: '#fff',
    },

    // Not Found / Create Now
    notFoundContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    notFoundText: {
        marginTop: 12,
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
    },
    createNowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 20,
        backgroundColor: '#3b82f6',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
    },
    createNowText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },

    // Form Styles (Manual Mode)
    formContainer: {
        flex: 1,
        padding: 16,
    },
    formLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 6,
        marginTop: 12,
    },
    formInput: {
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#1e293b',
    },
    formRow: {
        flexDirection: 'row',
        gap: 12,
    },
    formCol: {
        flex: 1,
    },
    formSectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 20,
        marginBottom: 12,
    },
    macroGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    macroInputBox: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    macroEmoji: {
        fontSize: 18,
    },
    macroInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 20,
        paddingVertical: 10,
    },
    toggleBox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleBoxActive: {
        backgroundColor: '#22c55e',
        borderColor: '#22c55e',
    },
    toggleText: {
        fontSize: 14,
        color: '#475569',
    },
    addNowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#22c55e',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 24,
    },
    addNowText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },

    // Quick Mode
    quickTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
        marginTop: 20,
    },
    quickSubtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
    quickAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#adadadff',
        paddingVertical: 16,
        borderRadius: 12,
        marginTop: 24,
    },
    quickAddMacrosBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#3b82f6',
        paddingVertical: 14,
        borderRadius: 10,
        marginTop: 20,
    },
    quickAddMacrosText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },

    // Toast
    toast: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        backgroundColor: '#1e293b',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    toastText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },

    // Suggestions Section
    suggestionsSection: {
        backgroundColor: '#f0fdf4',
        borderRadius: 12,
        marginBottom: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    suggestionHeader: {
        marginBottom: 8,
    },
    suggestionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#15803d',
    },
    resultsHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginTop: 8,
    },
});
