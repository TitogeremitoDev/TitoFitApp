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
    Animated,
    Platform,
    Pressable,
    Image,
    ActivityIndicator,
} from 'react-native';
import { EnhancedTextInput } from '../../../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SmartScalingModal from './SmartScalingModal'; // NEW Import
import { useStableWindowDimensions } from '../../../../src/hooks/useStableBreakpoint';

// Import food service (uses correct API + token)
import { searchFoods, searchExternalFoods, getFavorites, saveFood, toggleFavorite } from '../../../../src/services/foodService';

// Import meal combo service
import { searchCombos, toggleComboFavorite, trackComboUsage } from '../../../../src/services/mealComboService';

// Import local foods data
import localFoods from '../../../../src/constants/localFoods.json';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// Import shared units
import { UNIT_CONVERSIONS } from '../../../../src/constants/units';

// Drawer mode tabs
const MODE_TABS = [
    { id: 'search', label: 'Buscar', icon: 'search-outline' },
    { id: 'manual', label: 'Manual', icon: 'create-outline' },
    { id: 'quick', label: 'Rápido', icon: 'flash-outline' },
];

// Food filter tabs (for search mode)
const FOOD_TABS = [
    { id: 'global', label: 'Global', icon: 'globe-outline' },
    { id: 'recetas', label: 'Recetas', icon: 'restaurant-outline' },
    { id: 'combos', label: 'Combos', icon: 'layers-outline' },
    { id: 'recientes', label: 'Recientes', icon: 'time-outline' },
    { id: 'favoritos', label: 'Favoritos', icon: 'star-outline' },
];

// Combo category chips
const COMBO_CATEGORIES = [
    { id: 'all', label: 'Todos' },
    { id: 'desayuno', label: 'Desayuno' },
    { id: 'comida', label: 'Comida' },
    { id: 'cena', label: 'Cena' },
    { id: 'snack', label: 'Snack' },
    { id: 'pre-entreno', label: 'Pre-Entreno' },
    { id: 'post-entreno', label: 'Post-Entreno' },
];

const COMBO_SORT_OPTIONS = [
    { id: 'recent', label: 'Recientes', icon: 'time-outline' },
    { id: 'kcal', label: 'Kcal', icon: 'flame-outline' },
    { id: 'protein', label: 'Proteína', icon: 'fitness-outline' },
    { id: 'carbs', label: 'Carbos', icon: 'leaf-outline' },
    { id: 'fat', label: 'Grasa', icon: 'water-outline' },
    { id: 'name', label: 'A-Z', icon: 'text-outline' },
    { id: 'usage', label: 'Más usados', icon: 'trending-up-outline' },
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
    'Merienda': { icon: '🥪', label: 'Merienda' },
    'Comida': { icon: '🍽️', label: 'Comida' },
    'Almuerzo': { icon: '🍽️', label: 'Almuerzo' },
    'Cena': { icon: '🌙', label: 'Cena' },
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
    onRecipeSelect, // NEW Prop
    onToggleFavorite, // ❤️ Favorite toggle
    isFavorite, // ❤️ Current favorite state
    onOpenFoodEditor, // 🟢 Open food editor from image tap
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
        // 🛑 INTERCEPT RECIPES
        if (food.isComposite && onRecipeSelect) {
            onRecipeSelect(food);
            return;
        }

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
        onUpdateSelection(food._id, { food, amount, unit: selectionData?.unit || 'gramos' });
    };

    const handleUnitChange = (unitKey) => {
        const newAmount = unitKey === 'gramos' ? 100 : 1;
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

    const isRecipe = food.isComposite;

    return (
        <View style={[styles.foodRow, isRecipe && { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' }]}>
            {/* Favorite Button */}
            <TouchableOpacity
                onPress={() => onToggleFavorite?.(food)}
                style={styles.favBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={18}
                    color={isFavorite ? '#ef4444' : '#94a3b8'}
                />
            </TouchableOpacity>

            {/* Checkbox (normal foods) or Recipe Action Button */}
            {isRecipe ? (
                <TouchableOpacity
                    style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
                    onPress={handleToggle}
                >
                    <Ionicons name="add" size={16} color="#fff" />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                    onPress={handleToggle}
                >
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </TouchableOpacity>
            )}

            {/* BLOCK 1: Food Info (Left - Flex Grow) */}
            <View style={styles.foodInfoBlock}>
                {/* Thumbnail (tappable to edit) */}
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => onOpenFoodEditor?.(food)}
                    disabled={!onOpenFoodEditor}
                >
                    {food.image ? (
                        <Image
                            source={{ uri: food.image }}
                            style={styles.foodThumb}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.foodThumbPlaceholder}>
                            <Ionicons name={isRecipe ? "restaurant-outline" : "fast-food-outline"} size={18} color={isRecipe ? "#22c55e" : "#94a3b8"} />
                        </View>
                    )}
                </TouchableOpacity>

                {/* Text Content */}
                <View style={styles.foodTextContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.foodName} numberOfLines={1}>{food.name}</Text>
                        {isRecipe && (
                            <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                <Text style={{ fontSize: 8, fontWeight: '700', color: '#16a34a' }}>RECETA</Text>
                            </View>
                        )}
                    </View>
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
                    {selectionData?.unit === 'a_gusto' ? (
                        <View style={{ backgroundColor: '#ecfccb', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ color: '#4d7c0f', fontSize: 10, fontWeight: '700' }}>LIBRE</Text>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.kcalBadge}>🔥 {displayMacros.kcal}</Text>
                            <Text style={[styles.macroNum, { color: '#3b82f6' }]}>P:{Math.round(displayMacros.protein)}</Text>
                            <Text style={[styles.macroNum, { color: '#22c55e' }]}>C:{Math.round(displayMacros.carbs)}</Text>
                            <Text style={[styles.macroNum, { color: '#f59e0b' }]}>G:{Math.round(displayMacros.fat)}</Text>
                        </>
                    )}
                </View>

                {/* B. Inline Input Group + Weight Hint */}
                <View style={styles.inputWrapper}>
                    <View style={styles.inlineInputGroup}>
                        <EnhancedTextInput
                            containerStyle={styles.inlineInputNumberContainer}
                            style={styles.inlineInputNumberText}
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
    favoritesVersion = 0, // Incremented by parent when favorites change externally
    combosVersion = 0, // Incremented by parent when combos change externally (e.g. save from MealCard)
    onSetOptionImage, // (imageUri) => void — called when combo insert should set option image
    onOpenFoodEditor, // (food) => void — opens FoodCreatorModal for this food
}) {
    const { width: windowWidth } = useStableWindowDimensions();
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
    const [isSearchingExternal, setIsSearchingExternal] = useState(false);
    const externalAbortRef = useRef(null); // Cancel stale external searches

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

    // Combos State
    const [combos, setCombos] = useState([]);
    const [comboCategoryFilter, setComboCategoryFilter] = useState('all');
    const [isLoadingCombos, setIsLoadingCombos] = useState(false);
    const [comboSortBy, setComboSortBy] = useState('recent'); // recent, kcal, protein, carbs, fat, name, usage

    // Smart Scaling State
    const [scalingRecipe, setScalingRecipe] = useState(null);

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
    const fetchFoods = useCallback(async (query = '', options = {}) => {
        // Cancel any previous external search (aborts the actual HTTP request)
        if (externalAbortRef.current?.abort) {
            externalAbortRef.current.abort();
        }

        try {
            setIsLoading(true);

            // 1. Fast Load (Local + Cloud) - Skip External
            const internalResults = await searchFoods(query, { ...options, skipExternal: true });
            setAllFoods(internalResults);
            setIsLoading(false); // Render immediately

            // 2. Slow Load (External API - Background)
            const layer = options.layer || 'ALL';
            const shouldSearchExternal = (layer === 'ALL' || layer === 'API')
                && query.trim().length >= 3
                && internalResults.length < 10;

            if (shouldSearchExternal) {
                // Create a real AbortController so we can cancel the HTTP request
                const abortController = new AbortController();
                externalAbortRef.current = abortController;

                setIsSearchingExternal(true);

                try {
                    const externalResults = await searchExternalFoods(query, abortController.signal);

                    // Only update if this search wasn't aborted by a newer one
                    if (!abortController.signal.aborted) {
                        if (externalResults.length > 0) {
                            setAllFoods(prev => {
                                const existingIds = new Set(prev.map(p => p.name.toLowerCase()));
                                const newItems = externalResults.filter(e => !existingIds.has(e.name.toLowerCase()));
                                return [...prev, ...newItems];
                            });
                        }
                    }
                } finally {
                    // Always reset loading state, even on abort
                    setIsSearchingExternal(false);
                }
            } else {
                setIsSearchingExternal(false);
            }

        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.error('[SmartDrawer] Search error:', error);
                showToast('Error buscando alimentos');
            }
            setIsLoading(false);
            setIsSearchingExternal(false);
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

    // Fetch combos
    const fetchCombos = useCallback(async (query = '', category = 'all') => {
        try {
            setIsLoadingCombos(true);
            const results = await searchCombos(query, { category: category !== 'all' ? category : undefined });
            setCombos(results);
        } catch (error) {
            console.error('[SmartDrawer] Combos error:', error);
            showToast('Error buscando combos');
        } finally {
            setIsLoadingCombos(false);
        }
    }, []);

    // Sorted combos
    const sortedCombos = useMemo(() => {
        const sorted = [...combos];
        switch (comboSortBy) {
            case 'kcal': return sorted.sort((a, b) => (b.totals?.kcal || 0) - (a.totals?.kcal || 0));
            case 'protein': return sorted.sort((a, b) => (b.totals?.protein || 0) - (a.totals?.protein || 0));
            case 'carbs': return sorted.sort((a, b) => (b.totals?.carbs || 0) - (a.totals?.carbs || 0));
            case 'fat': return sorted.sort((a, b) => (a.totals?.fat || 0) - (b.totals?.fat || 0));
            case 'name': return sorted.sort((a, b) => a.name.localeCompare(b.name));
            case 'usage': return sorted.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
            default: return sorted; // 'recent' - already sorted by API (updatedAt desc)
        }
    }, [combos, comboSortBy]);

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

    // ❤️ Set of favorite IDs + names for quick lookup
    const favoriteIds = useMemo(() => {
        const set = new Set();
        favorites.forEach(f => {
            if (f._id) set.add(f._id);
            if (f.name) set.add(f.name.toLowerCase().trim());
        });
        return set;
    }, [favorites]);

    // ❤️ Toggle Favorite Handler
    const handleToggleFavorite = useCallback(async (food) => {
        try {
            const result = await toggleFavorite(food);
            // Await refresh so favoriteIds updates before re-render
            await fetchFavorites();

            const isNowFavorite = !result.action?.startsWith('removed');

            if (result.action === 'removed_deleted' || result.action === 'removed_kept') {
                // Zombie cleanup: backend hard-deleted the CLOUD clone
                // Remove the ghost food from allFoods so user can't click it again
                setAllFoods(prev => {
                    const cleaned = prev.filter(f => f._id !== food._id);
                    // Also mark any remaining food with same name as not-favorite
                    return cleaned.map(f =>
                        f.name?.toLowerCase() === food.name?.toLowerCase()
                            ? { ...f, isFavorite: false }
                            : f
                    );
                });
            } else if (result.action === 'cloned_and_favorited' && result.food) {
                // Cloned from LOCAL/API: mark original as favorite too, don't duplicate
                setAllFoods(prev => {
                    // Mark the original food as favorite
                    const updated = prev.map(f =>
                        (f._id === food._id || f.name?.toLowerCase() === food.name?.toLowerCase())
                            ? { ...f, isFavorite: true }
                            : f
                    );
                    // Only add clone if it doesn't duplicate an existing entry by name
                    const alreadyHasName = updated.some(f =>
                        f.name?.toLowerCase() === result.food.name?.toLowerCase()
                    );
                    return alreadyHasName ? updated : [result.food, ...updated];
                });
            } else {
                // Standard CLOUD toggle: just sync isFavorite
                setAllFoods(prev => prev.map(f =>
                    (f._id === food._id || f.name?.toLowerCase() === food.name?.toLowerCase())
                        ? { ...f, isFavorite: isNowFavorite }
                        : f
                ));
            }

            showToast(isNowFavorite ? '❤️ Añadido a favoritos' : '💔 Eliminado de favoritos');
        } catch (error) {
            console.error('[SmartDrawer] Toggle favorite error:', error);
            showToast('⚠️ Error al cambiar favorito');
        }
    }, [fetchFavorites, showToast]);

    // Initial fetch when drawer opens
    useEffect(() => {
        if (visible) {
            fetchFoods();
            fetchFavorites();
            loadRecentFoods();
        }
    }, [visible, fetchFoods, fetchFavorites, loadRecentFoods]);

    // Sync favorites when parent toggles a favorite (e.g. from MealCard)
    useEffect(() => {
        if (favoritesVersion > 0) {
            const syncAll = async () => {
                const favs = await getFavorites();
                setFavorites(favs);
                // Build lookup sets from fresh favorites
                const favIds = new Set(favs.map(f => f._id));
                const favNames = new Set(favs.map(f => f.name?.toLowerCase?.().trim()));
                // Sync isFavorite flag on all local food objects
                setAllFoods(prev => prev.map(f => ({
                    ...f,
                    isFavorite: favIds.has(f._id) || favNames.has(f.name?.toLowerCase?.().trim())
                })));
            };
            syncAll();
        }
    }, [favoritesVersion]);

    // Re-fetch combos when combosVersion changes (e.g. after saving combo from MealCard)
    useEffect(() => {
        if (combosVersion > 0) {
            fetchCombos('', 'all');
        }
    }, [combosVersion]);

    // Debounced search & Tab Sync
    useEffect(() => {
        if (!visible) return;

        const timeoutId = setTimeout(() => {
            if (activeTab === 'global') {
                if (searchQuery.trim().length >= 2 || searchQuery.trim().length === 0) {
                    fetchFoods(searchQuery, { layer: 'ALL' });
                }
            } else if (activeTab === 'recetas') {
                fetchFoods(searchQuery, { layer: 'RECIPE' });
            } else if (activeTab === 'combos') {
                fetchCombos(searchQuery, comboCategoryFilter);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, activeTab, visible, fetchFoods, fetchCombos, comboCategoryFilter]);

    // Animate in/out
    useEffect(() => {
        let animation;
        if (visible) {
            animation = Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: Platform.OS !== 'web',
                tension: 65,
                friction: 11,
            });
        } else {
            animation = Animated.timing(slideAnim, {
                toValue: drawerWidth,
                duration: 200,
                useNativeDriver: Platform.OS !== 'web',
            });
        }
        animation.start();
        return () => animation.stop();
    }, [visible, drawerWidth]);

    // Pre-fetch combos when drawer opens (fetch every time to stay fresh)
    useEffect(() => {
        if (visible) {
            searchCombos('', {}).then(results => {
                if (results?.length > 0) setCombos(results);
            }).catch(() => {});
        }
    }, [visible]);

    // Combine and filter foods based on search and tab
    const filteredFoods = useMemo(() => {
        // Tab-specific sources
        if (activeTab === 'favoritos') {
            return favorites;
        }

        if (activeTab === 'recientes') {
            return recentFoods;
        }

        // Global OR Recetas tab: Use allFoods from searchFoods (already merged/fetched)
        // If no search, show all; searchFoods function handles this
        return allFoods;
    }, [activeTab, allFoods, favorites, recentFoods]);

    // Get display name for current meal
    const mealDisplayName = useMemo(() => {
        // Prefer explicit name from context
        if (context?.mealName) return context.mealName;

        // Fallback to ID parsing
        if (!context?.mealId) return null;
        const mealIdLower = context.mealId.toLowerCase();

        // Extract meal type from IDs like 'meal_desayuno_123456'
        if (mealIdLower.includes('desayuno')) return 'Desayuno';
        if (mealIdLower.includes('comida') || mealIdLower.includes('almuerzo')) return 'Comida';
        if (mealIdLower.includes('cena')) return 'Cena';
        return 'Snack';
    }, [context?.mealId, context?.mealName]);

    // Smart suggestions based on meal context (desayuno, comida, cena, snack)


    // Smart suggestions based on meal context (desayuno, comida, cena, snack)
    const suggestedFoods = useMemo(() => {
        // Fallback to mealId if mealName missing (backward compatibility)
        const nameSource = context?.mealName || context?.mealId || '';
        const nameLower = nameSource.toLowerCase();

        if (!nameLower) return [];

        // Determine which tags to search based on meal context
        // Default tags for fallback or generic meals
        let relevantTags = ['Snack', 'snack', 'SNACK', 'merienda', 'Merienda', 'Fruta', 'Lácteo', 'Yogur', 'Nueces'];

        if (nameLower.includes('desayuno') || nameLower.includes('breakfast')) {
            relevantTags = ['Desayuno', 'desayuno', 'DESAYUNO', 'breakfast', 'Huevo', 'Avena', 'Pan', 'Fruta', 'Lácteo', 'Café'];
        } else if (nameLower.includes('comida') || nameLower.includes('almuerzo') || nameLower.includes('lunch')) {
            // Lunch: Main proteins, carbs, etc. PLUS explicit Meal Tags
            relevantTags = ['Almuerzo', 'almuerzo', 'ALMUERZO', 'Comida', 'comida', 'COMIDA', 'lunch', 'Proteína', 'Carne', 'Pescado', 'Pollo', 'Arroz', 'Pasta', 'Legumbre'];
        } else if (nameLower.includes('cena') || nameLower.includes('dinner')) {
            // Dinner: Lighter proteins, veggies PLUS explicit Meal Tags
            relevantTags = ['Cena', 'cena', 'CENA', 'dinner', 'Proteína', 'Pescado', 'Huevo', 'Vegetal', 'Verdura', 'Ensalada', 'Ligero'];
        } else if (nameLower.includes('merienda') || nameLower.includes('snack')) {
            relevantTags = ['Snack', 'snack', 'SNACK', 'merienda', 'Merienda', 'Fruta', 'Lácteo', 'Yogur', 'Nueces'];
        }

        // Filter allFoods by matching tags
        const matches = allFoods.filter(food =>
            food.tags?.some(tag => relevantTags.includes(tag))
        );
        return matches.slice(0, 5); // Limit to 5 suggestions
    }, [context?.mealId, context?.mealName, allFoods]);

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
            food: {
                ...sel.food, // 🟢 PRESERVE ORIGINAL PROPERTIES (ingredients, isComposite, etc.)
            },
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

    // Handle Combo Insert (adds all foods from combo at once)
    // Maps combo foods to the SAME format that normal food selection uses,
    // so onAddFoods callback transforms them correctly (image, sourceId, _savedPer100g, etc.)
    const handleComboInsert = useCallback((combo) => {
        if (!combo.foods || combo.foods.length === 0) return;

        const foodsToAdd = combo.foods.map(food => {
            const amount = food.amount || 100;
            const unitKey = food.unit || 'gramos';

            // Combo stores absolute macros for the saved amount.
            // We need to reconstruct per-100g base nutrients so the plan
            // can recalculate when the coach changes amounts/units later.
            const conversion = UNIT_CONVERSIONS[unitKey] || UNIT_CONVERSIONS.gramos;
            const gramsEquiv = amount * (conversion?.factor || 1);
            const divisor = gramsEquiv / 100 || 1;

            const nutrientsPer100g = {
                kcal: Math.round((food.kcal || 0) / divisor),
                protein: Math.round(((food.protein || 0) / divisor) * 10) / 10,
                carbs: Math.round(((food.carbs || 0) / divisor) * 10) / 10,
                fat: Math.round(((food.fat || 0) / divisor) * 10) / 10,
            };

            return {
                food: {
                    _id: food.foodId || food.sourceId || `cf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`,
                    name: food.name,
                    nutrients: nutrientsPer100g,
                    image: food.image,
                    layer: food.sourceType || 'CLOUD',
                    isComposite: food.isComposite || food.isRecipe || false,
                    ingredients: food.subIngredients || [],
                },
                amount,
                unit: unitKey,
                calculatedMacros: {
                    kcal: food.kcal || 0,
                    protein: food.protein || 0,
                    carbs: food.carbs || 0,
                    fat: food.fat || 0,
                },
            };
        });

        onAddFoods(foodsToAdd);
        // Set option image from combo if available
        if (combo.image && onSetOptionImage) {
            onSetOptionImage(combo.image);
        }
        trackComboUsage(combo._id);
        showToast(`📦 Combo "${combo.name}" insertado (${combo.foods.length} alimentos)`);
    }, [onAddFoods, showToast]);

    // Handle Combo Favorite Toggle (with guard against rapid clicks)
    const togglingFavRef = useRef(false);
    const handleToggleComboFavorite = useCallback(async (combo) => {
        if (togglingFavRef.current) return;
        togglingFavRef.current = true;
        try {
            const result = await toggleComboFavorite(combo._id);
            if (result) {
                setCombos(prev => prev.map(c =>
                    c._id === combo._id ? { ...c, isFavorite: result.isFavorite } : c
                ));
                showToast(result.isFavorite ? '❤️ Combo favorito' : '💔 Combo quitado de favoritos');
            }
        } catch (error) {
            showToast('⚠️ Error al cambiar favorito');
        } finally {
            togglingFavRef.current = false;
        }
    }, [showToast]);

    // Handle Recipe Selection (Triggers Modal)
    const handleRecipeSelect = useCallback((food) => {
        setScalingRecipe(food);
    }, []);

    // Handle Smart Add from Modal
    const handleSmartAdd = useCallback((items, mode) => {
        // items is array of { food, amount, unit, calculatedMacros }
        onAddFoods(items);

        const msg = mode === 'block'
            ? `📦 Receta añadida como bloque`
            : `📝 ${items.length} ingredientes desglosados`;
        showToast(msg);

        // Save original recipe to recent
        if (scalingRecipe) saveToRecent([scalingRecipe]);

        // Close scaling modal AFTER saving to recent
        setScalingRecipe(null);

    }, [onAddFoods, scalingRecipe, saveToRecent, showToast]);

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
                                <EnhancedTextInput
                                    containerStyle={styles.searchInputContainer}
                                    style={styles.searchInputText}
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
                                        onPress={() => {
                                            setActiveTab(tab.id);
                                            // This logic should ideally be in a useEffect or a dedicated fetch function
                                            // triggered by activeTab change, but faithfully inserting as requested.
                                            // Note: 'await' cannot be used directly in onPress, this will cause a syntax error.
                                            // Assuming this is a placeholder for a function call that handles fetching.
                                            // For now, it's commented out to maintain syntactical correctness.
                                            /*
                                            let results = [];
                                            if (tab.id === 'favoritos') { // Use tab.id instead of activeTab for immediate effect
                                                results = await getFavorites();
                                                // Client-side filter if query exists
                                                if (debouncedQuery) {
                                                    results = results.filter(f => f.name.toLowerCase().includes(debouncedQuery.toLowerCase()));
                                                }
                                            } else if (tab.id === 'recetas') {
                                                // Fetch recipes from backend
                                                results = await searchFoods(debouncedQuery, { layer: 'RECIPE' });
                                            } else {
                                                // Global or other tabs
                                                const layer = tab.id === 'recientes' ? 'LOCAL' : 'ALL'; 
                                                // Note: 'recientes' logic usually handled differently (local storage), but if using searchFoods:
                                                // Actually 'recientes' usually implies previously used. Let's assume standard browse for now.
                                                // If 'recientes' logic is missing, fallback to ALL or check implementation.
                                                // Re-reading code: 'recientes' logic is likely handled via local storage in useEffect, but here we overwrite.
                                                // Let's keep existing logic and just add 'recetas'.
                                                
                                                // Existing logic likely handled 'recientes' differently? 
                                                // Let's check original code block below.
                                                
                                                results = await searchFoods(debouncedQuery, { 
                                                   layer: tab.id === 'global' ? 'ALL' : 'ALL' 
                                                });
                                            }
                                            */
                                        }}
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
                                        {tab.id === 'combos' && combos.length > 0 && (
                                            <View style={{ backgroundColor: '#d97706', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                                                <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>{combos.length}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    )}
                </View>

                {/* Add Button Bar (Search Mode) - Only show for ingredient tabs (not combos/recetas) */}
                {drawerMode === 'search' && activeTab !== 'combos' && activeTab !== 'recetas' && (
                    <View style={styles.addBar}>
                        <TouchableOpacity
                            style={[
                                styles.addSelectedBtn,
                                Object.keys(selections).length === 0 && styles.addSelectedBtnDisabled
                            ]}
                            onPress={handleAddSelected}
                            disabled={Object.keys(selections).length === 0}
                        >
                            <Ionicons name="add-circle" size={22} color="#fff" />
                            <Text style={styles.addSelectedText}>
                                {Object.keys(selections).length > 0
                                    ? `AÑADIR ${Object.keys(selections).length} ALIMENTO${Object.keys(selections).length > 1 ? 'S' : ''}`
                                    : 'SELECCIONA ALIMENTOS'
                                }
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* CONTENT: Combos Tab */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {drawerMode === 'search' && activeTab === 'combos' && (
                    <ScrollView
                        style={styles.foodList}
                        contentContainerStyle={styles.foodListContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Category Filter Chips */}
                        <View style={{ marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {COMBO_CATEGORIES.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={{
                                        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#f1f5f9',
                                        ...(comboCategoryFilter === cat.id ? { backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#3b82f6' } : {}),
                                    }}
                                    onPress={() => setComboCategoryFilter(cat.id)}
                                >
                                    <Text style={{
                                        fontSize: 12, fontWeight: '500', color: '#64748b',
                                        ...(comboCategoryFilter === cat.id ? { color: '#3b82f6', fontWeight: '700' } : {}),
                                    }}>
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Sort Options */}
                        <View style={{ marginBottom: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                            <Ionicons name="swap-vertical-outline" size={14} color="#94a3b8" style={{ marginRight: 2 }} />
                            {COMBO_SORT_OPTIONS.map(opt => (
                                <TouchableOpacity
                                    key={opt.id}
                                    style={[
                                        { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#f1f5f9' },
                                        comboSortBy === opt.id && { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#d97706' }
                                    ]}
                                    onPress={() => setComboSortBy(opt.id)}
                                >
                                    <Ionicons name={opt.icon} size={12} color={comboSortBy === opt.id ? '#d97706' : '#64748b'} />
                                    <Text style={{ fontSize: 11, fontWeight: comboSortBy === opt.id ? '700' : '500', color: comboSortBy === opt.id ? '#92400e' : '#64748b' }}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Loading */}
                        {isLoadingCombos && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="#3b82f6" />
                                <Text style={styles.loadingText}>Cargando combos...</Text>
                            </View>
                        )}

                        {/* Combo Cards */}
                        {sortedCombos.map(combo => (
                            <View key={combo._id} style={[styles.foodRow, { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', flexDirection: 'column', alignItems: 'stretch', padding: 12 }]}>
                                {/* Top Row: Insert + Image + Name + Favorite */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <TouchableOpacity
                                        style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: '#d97706', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
                                        onPress={() => handleComboInsert(combo)}
                                    >
                                        <Ionicons name="add" size={16} color="#fff" />
                                    </TouchableOpacity>
                                    {combo.image ? (
                                        <Image
                                            source={{ uri: combo.image }}
                                            accessibilityLabel={`Imagen del combo ${combo.name}`}
                                            style={{ width: 36, height: 36, borderRadius: 8, marginRight: 8, backgroundColor: '#f1f5f9' }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={{ width: 36, height: 36, borderRadius: 8, marginRight: 8, backgroundColor: '#fef9c3', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="layers" size={18} color="#d97706" />
                                        </View>
                                    )}
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={[styles.foodName, { color: '#92400e' }]} numberOfLines={1}>{combo.name}</Text>
                                        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                                            <View style={{ backgroundColor: '#fde68a', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                                <Text style={{ fontSize: 9, fontWeight: '700', color: '#92400e' }}>COMBO</Text>
                                            </View>
                                            <Text style={{ fontSize: 10, color: '#b45309' }}>{combo.foods?.length || 0} items</Text>
                                            {combo.category !== 'otro' && (
                                                <Text style={{ fontSize: 10, color: '#92400e' }}>· {combo.category}</Text>
                                            )}
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleToggleComboFavorite(combo)}
                                        style={styles.favBtn}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons
                                            name={combo.isFavorite ? 'heart' : 'heart-outline'}
                                            size={18}
                                            color={combo.isFavorite ? '#ef4444' : '#94a3b8'}
                                        />
                                    </TouchableOpacity>
                                </View>

                                {/* Macro Totals */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fffbeb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginBottom: 8 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#f97316' }}>🔥 {Math.round(combo.totals?.kcal || 0)}</Text>
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#3b82f6' }}>P:{Math.round(combo.totals?.protein || 0)}</Text>
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#22c55e' }}>C:{Math.round(combo.totals?.carbs || 0)}</Text>
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#f59e0b' }}>G:{Math.round(combo.totals?.fat || 0)}</Text>
                                </View>

                                {/* Food List Preview */}
                                <View style={{ gap: 2 }}>
                                    {combo.foods?.slice(0, 4).map((food, idx) => (
                                        <Text key={idx} style={{ fontSize: 11, color: '#78350f' }} numberOfLines={1}>
                                            · {food.name} ({food.amount}{food.unit === 'gramos' ? 'g' : ` ${food.unit}`})
                                        </Text>
                                    ))}
                                    {(combo.foods?.length || 0) > 4 && (
                                        <Text style={{ fontSize: 11, color: '#b45309', fontStyle: 'italic' }}>
                                            +{combo.foods.length - 4} más...
                                        </Text>
                                    )}
                                </View>
                            </View>
                        ))}

                        {/* Empty State */}
                        {sortedCombos.length === 0 && !isLoadingCombos && (
                            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
                                <Ionicons name="layers-outline" size={48} color="#cbd5e1" />
                                <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
                                    {searchQuery.trim() ? `No se encontraron combos para "${searchQuery}"` : 'Aún no tienes combos guardados'}
                                </Text>
                                <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }}>
                                    Guarda combos desde cualquier opción de comida usando el botón de guardar
                                </Text>
                            </View>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* CONTENT: Search Mode (Foods) */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {drawerMode === 'search' && activeTab !== 'combos' && (
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

                        {/* Smart Suggestions for current meal (filtered to favorites on favorites tab, hidden on recientes) */}
                        {(() => {
                            // On favorites tab: only show suggested foods that are also favorites
                            const displaySuggestions = activeTab === 'favoritos'
                                ? suggestedFoods.filter(f => favoriteIds.has(f._id) || favoriteIds.has(f.name?.toLowerCase?.().trim()) || f.isFavorite)
                                : activeTab === 'global'
                                    ? suggestedFoods
                                    : []; // Hide on recientes

                            return displaySuggestions.length > 0 && (
                                <View style={styles.suggestionsSection}>
                                    <View style={styles.suggestionHeader}>
                                        <Text style={styles.suggestionTitle}>
                                            ⚡ Sugerencias para {mealDisplayName || 'esta comida'}
                                        </Text>
                                    </View>
                                    {displaySuggestions.map(food => (
                                        <FoodRowItem
                                            key={`suggest-${food._id}`}
                                            food={food}
                                            isSelected={!!selections[food._id]}
                                            selectionData={selections[food._id]}
                                            onToggleSelect={handleToggleSelect}
                                            onUpdateSelection={handleUpdateSelection}
                                            onQuickAdd={handleQuickAdd}
                                            onRecipeSelect={handleRecipeSelect}
                                            onToggleFavorite={handleToggleFavorite}
                                            isFavorite={favoriteIds.has(food._id) || favoriteIds.has(food.name?.toLowerCase?.().trim()) || food.isFavorite}
                                            onOpenFoodEditor={onOpenFoodEditor}
                                        />
                                    ))}
                                </View>
                            );
                        })()}

                        {/* Search Results Header */}
                        {filteredFoods.length > 0 && (
                            <Text style={styles.resultsHeader}>
                                {activeTab === 'favoritos'
                                    ? '❤️ Tus favoritos'
                                    : activeTab === 'recientes'
                                        ? '🕐 Recientes'
                                        : searchQuery.trim()
                                            ? 'Resultados'
                                            : 'Todos los alimentos'}
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
                                onRecipeSelect={handleRecipeSelect}
                                onToggleFavorite={handleToggleFavorite}
                                isFavorite={favoriteIds.has(food._id) || favoriteIds.has(food.name?.toLowerCase?.().trim()) || food.isFavorite}
                                onOpenFoodEditor={onOpenFoodEditor}
                            />
                        ))}

                        {/* Empty favorites message */}
                        {activeTab === 'favoritos' && filteredFoods.length === 0 && !isLoading && (
                            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
                                <Ionicons name="heart-outline" size={48} color="#cbd5e1" />
                                <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
                                    Aún no tienes favoritos
                                </Text>
                                <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center' }}>
                                    Pulsa ❤️ en cualquier alimento para añadirlo aquí
                                </Text>
                            </View>
                        )}

                        {/* External search loading indicator */}
                        {isSearchingExternal && (
                            <View style={styles.externalSearchingContainer}>
                                <ActivityIndicator size="small" color="#3b82f6" />
                                <Text style={styles.externalSearchingText}>
                                    Buscando en base de datos online...
                                </Text>
                            </View>
                        )}

                        {/* Not Found CTA - only show if NOT still searching externally */}
                        {filteredFoods.length === 0 && searchQuery.trim().length > 0 && !isSearchingExternal && !isLoading && (
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

                    </ScrollView>
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* CONTENT: Manual Mode */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {drawerMode === 'manual' && (
                    <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
                        <Text style={styles.formLabel}>Nombre del alimento</Text>
                        <EnhancedTextInput
                            containerStyle={styles.formInputContainer}
                            style={styles.formInputText}
                            value={manualForm.name}
                            onChangeText={(v) => setManualForm(p => ({ ...p, name: v }))}
                            placeholder="Ej: Pastel de cumpleaños"
                            placeholderTextColor="#94a3b8"
                        />

                        <View style={styles.formRow}>
                            <View style={styles.formCol}>
                                <Text style={styles.formLabel}>Cantidad</Text>
                                <EnhancedTextInput
                                    containerStyle={styles.formInputContainer}
                                    style={styles.formInputText}
                                    value={manualForm.quantity}
                                    onChangeText={(v) => setManualForm(p => ({ ...p, quantity: v }))}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.formCol}>
                                <Text style={styles.formLabel}>Unidad</Text>
                                <EnhancedTextInput
                                    containerStyle={styles.formInputContainer}
                                    style={styles.formInputText}
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
                                <EnhancedTextInput
                                    containerStyle={styles.macroInputContainer}
                                    style={styles.macroInputText}
                                    value={manualForm.kcal}
                                    onChangeText={(v) => setManualForm(p => ({ ...p, kcal: v }))}
                                    keyboardType="numeric"
                                    placeholder="Kcal"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🥩</Text>
                                <EnhancedTextInput
                                    containerStyle={styles.macroInputContainer}
                                    style={styles.macroInputText}
                                    value={manualForm.protein}
                                    onChangeText={(v) => setManualForm(p => ({ ...p, protein: v }))}
                                    keyboardType="numeric"
                                    placeholder="Prot"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🍚</Text>
                                <EnhancedTextInput
                                    containerStyle={styles.macroInputContainer}
                                    style={styles.macroInputText}
                                    value={manualForm.carbs}
                                    onChangeText={(v) => setManualForm(p => ({ ...p, carbs: v }))}
                                    keyboardType="numeric"
                                    placeholder="Carb"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🥑</Text>
                                <EnhancedTextInput
                                    containerStyle={styles.macroInputContainer}
                                    style={styles.macroInputText}
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
                                <EnhancedTextInput
                                    containerStyle={styles.macroInputContainer}
                                    style={styles.macroInputText}
                                    value={quickForm.kcal}
                                    onChangeText={(v) => setQuickForm(p => ({ ...p, kcal: v }))}
                                    keyboardType="numeric"
                                    placeholder="Kcal"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🥩</Text>
                                <EnhancedTextInput
                                    containerStyle={styles.macroInputContainer}
                                    style={styles.macroInputText}
                                    value={quickForm.protein}
                                    onChangeText={(v) => setQuickForm(p => ({ ...p, protein: v }))}
                                    keyboardType="numeric"
                                    placeholder="+20g"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🍚</Text>
                                <EnhancedTextInput
                                    containerStyle={styles.macroInputContainer}
                                    style={styles.macroInputText}
                                    value={quickForm.carbs}
                                    onChangeText={(v) => setQuickForm(p => ({ ...p, carbs: v }))}
                                    keyboardType="numeric"
                                    placeholder="+30g"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={styles.macroInputBox}>
                                <Text style={styles.macroEmoji}>🥑</Text>
                                <EnhancedTextInput
                                    containerStyle={styles.macroInputContainer}
                                    style={styles.macroInputText}
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

                {/* Toast Notification */}
                {toast.visible && (
                    <View style={styles.toast}>
                        <Text style={styles.toastText}>{toast.message}</Text>
                    </View>
                )}
            </Animated.View>

            {/* Smart Scaling Modal */}
            <SmartScalingModal
                visible={!!scalingRecipe}
                recipe={scalingRecipe}
                onClose={() => setScalingRecipe(null)}
                onAdd={handleSmartAdd}
            />
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
        flex: 1,
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
    searchInputContainer: {
        flex: 1,
    },
    searchInputText: {
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
    favBtn: {
        marginRight: 4,
        padding: 2,
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
    inlineInputNumberContainer: {
        width: 36,
        height: '100%',
        padding: 0,
        backgroundColor: '#fff',
    },
    inlineInputNumberText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
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

    // External search loading
    externalSearchingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
        backgroundColor: '#eff6ff',
        borderRadius: 8,
        gap: 8,
    },
    externalSearchingText: {
        fontSize: 12,
        color: '#3b82f6',
        fontWeight: '500',
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

    // Add Bar (sits between header and scroll content)
    addBar: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
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
    addSelectedBtnDisabled: {
        backgroundColor: '#94a3b8',
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
    formInputContainer: {
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    formInputText: {
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
    macroInputContainer: {
        flex: 1,
    },
    macroInputText: {
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
        position: 'sticky',
        bottom: 100,
        zIndex: 1000,
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
    // Quick Add Button Removed
    quickAddBtn: {
        display: 'none',
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
