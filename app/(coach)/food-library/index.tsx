import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert,
    ActivityIndicator,
    Platform,
    SafeAreaView,
    ScrollView,
    Modal,
    Image,
} from 'react-native';
import { useStableWindowDimensions } from '../../../src/hooks/useStableBreakpoint';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../../../components/ui';
import { StatusBar } from 'expo-status-bar';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import CoachHeader from '../components/CoachHeader';
import FoodGridCard from '../../../components/FoodGridCard';
import FoodMiniCard from '../../../components/FoodMiniCard';
import FoodCreatorModal from '../../../components/FoodCreatorModal';
import FoodLibrarySidebar, { FilterState } from '../../../components/FoodLibrarySidebar';

import { searchFoods, searchExternalFoods, saveFood, deleteFood, getDiscoveryFoods, clearSearchCache, LAYER_ICONS, FoodItem } from '../../../src/services/foodService';
import {
    listCombos,
    searchCombos,
    deleteCombo,
    toggleComboFavorite,
    createCombo,
    updateCombo,
    clearComboCache,
} from '../../../src/services/mealComboService';
import { UNIT_CONVERSIONS, calculateMacrosForAmount } from '../../../src/constants/units';
import * as ImagePicker from 'expo-image-picker';

// ─────────────────────────────────────────────────────────
// Adapter: Map MealCombo → FoodItem shape for FoodGridCard
// ─────────────────────────────────────────────────────────
const comboToGridItem = (combo: any): FoodItem & { _comboSource: any; _itemType: string; _comboFoodCount: number } => ({
    _id: combo._id,
    name: combo.name,
    brand: combo.category !== 'otro' ? combo.category : undefined,
    layer: 'CLOUD' as any,
    isSystem: false,
    ownerId: combo.ownerId,
    nutrients: {
        kcal: combo.totals?.kcal || 0,
        protein: combo.totals?.protein || 0,
        carbs: combo.totals?.carbs || 0,
        fat: combo.totals?.fat || 0,
    },
    image: combo.image,
    tags: combo.tags || [],
    usageCount: combo.usageCount || 0,
    isFavorite: combo.isFavorite || false,
    isComposite: false,
    ingredients: combo.foods || [],
    _comboSource: combo,
    _itemType: 'combo',
    _comboFoodCount: combo.foods?.length || 0,
});

const isItemDeletable = (item: any): boolean => {
    if (item._itemType === 'combo') return true; // All combos belong to the coach
    return !item.isSystem; // Only coach-created ingredients/recipes
};

export default function FoodLibraryScreen() {
    const { width } = useStableWindowDimensions();
    const isLargeScreen = width > 720;
    const params = useLocalSearchParams<{ tab?: string }>();

    // Data State
    const [foods, setFoods] = useState<FoodItem[]>([]); // Search Results
    const [initialFoods, setInitialFoods] = useState<FoodItem[]>([]); // Discovery Data
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    // Combo State
    const [combos, setCombos] = useState<any[]>([]);
    const [comboCreatorVisible, setComboCreatorVisible] = useState(false);
    const [editingCombo, setEditingCombo] = useState<any>(null);

    // Filter & Sort State
    const [filters, setFilters] = useState<FilterState>({
        onlyFavorites: false,
        types: [],
        goals: [],
        macros: []
    });
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [sortBy, setSortBy] = useState<'recent' | 'calories_asc' | 'protein_desc' | 'name'>('recent');

    // View Mode
    const [viewMode, setViewMode] = useState<'INGREDIENTS' | 'RECIPES' | 'COMBOS'>(
        params.tab === 'combos' ? 'COMBOS' : 'INGREDIENTS'
    );

    // Modals
    const [creatorVisible, setCreatorVisible] = useState(false);
    const [editingFood, setEditingFood] = useState<FoodItem | null>(null);

    // Handle tab param changes
    useEffect(() => {
        if (params.tab === 'combos') setViewMode('COMBOS');
    }, [params.tab]);

    // 1. Refresh data on screen focus
    useFocusEffect(
        useCallback(() => {
            clearSearchCache();
            clearComboCache();
            loadDiscoveryData();
            loadCombos();
        }, [])
    );

    const loadDiscoveryData = async () => {
        try {
            const [ingredientData, recipeData] = await Promise.all([
                searchFoods("", { layer: 'RAW' }),
                searchFoods("", { layer: 'RECIPE' })
            ]);
            const merged = [...ingredientData, ...recipeData];
            setInitialFoods(merged as FoodItem[]);
        } catch (e) { console.log('[FoodLibrary] Load error:', e); }
    };

    const loadCombos = async () => {
        try {
            const result = await listCombos();
            setCombos(result || []);
        } catch (e) { console.log('[FoodLibrary] Combos load error:', e); }
    };

    // 2. Search Handler
    useEffect(() => {
        if (viewMode === 'COMBOS') {
            if (searchQuery.trim().length > 0) {
                searchCombos(searchQuery).then(r => setCombos(r || [])).catch(() => {});
            } else {
                loadCombos();
            }
        } else {
            if (searchQuery.trim().length > 0) {
                loadFoods(searchQuery);
            } else {
                setFoods([]);
            }
        }
    }, [searchQuery, viewMode]);

    const loadFoods = async (query: string) => {
        setLoading(true);
        try {
            const internalResults = await searchFoods(query, { skipExternal: true });
            setFoods(internalResults);
            setLoading(false);

            if (internalResults.length < 10) {
                const externalResults = await searchExternalFoods(query);
                if (externalResults.length > 0) {
                    setFoods(prev => {
                        const existingIds = new Set(prev.map(p => p.name.toLowerCase()));
                        const newItems = externalResults.filter(e => !existingIds.has(e.name.toLowerCase()));
                        return [...prev, ...newItems];
                    });
                }
            }
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────
    // MAIN FILTERING ENGINE
    // ─────────────────────────────────────────────────────────
    const processedFoods = useMemo(() => {
        // COMBOS MODE: separate data source
        if (viewMode === 'COMBOS') {
            let items = combos.map(comboToGridItem);

            if (filters.onlyFavorites) {
                items = items.filter(c => c.isFavorite);
            }
            if (filters.types.length > 0) {
                items = items.filter(c => c.tags?.some((t: string) => filters.types.includes(t)));
            }

            items.sort((a, b) => {
                if (sortBy === 'name') return a.name.localeCompare(b.name);
                if (sortBy === 'calories_asc') return (a.nutrients?.kcal || 0) - (b.nutrients?.kcal || 0);
                if (sortBy === 'protein_desc') return (b.nutrients?.protein || 0) - (a.nutrients?.protein || 0);
                return 0;
            });

            return items;
        }

        // INGREDIENTS / RECIPES MODE: existing logic
        let source = searchQuery.length > 0 ? foods : initialFoods;

        let result = source.filter(item => {
            if (filters.onlyFavorites) {
                return item.isFavorite === true;
            }

            if (viewMode === 'RECIPES') {
                if (!item.isComposite) return false;
            } else {
                if (item.isComposite) return false;
            }

            if (filters.types.length > 0) {
                const hasType = item.tags?.some(t => filters.types.includes(t));
                if (!hasType) return false;
            }
            if (filters.goals.length > 0) {
                const hasGoal = item.tags?.some(t => filters.goals.includes(t));
                if (!hasGoal) return false;
            }
            if (filters.macros.length > 0) {
                const hasMacro = item.tags?.some(t => filters.macros.includes(t));
                if (!hasMacro) return false;
            }

            return true;
        });

        result.sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'calories_asc') return a.nutrients.kcal - b.nutrients.kcal;
            if (sortBy === 'protein_desc') return b.nutrients.protein - a.nutrients.protein;
            return 0;
        });

        return result;
    }, [foods, initialFoods, combos, searchQuery, filters, sortBy, viewMode]);

    // ─────────────────────────────────────────────────────────
    // Food Handlers
    // ─────────────────────────────────────────────────────────
    const handleCreateNew = () => { setEditingFood(null); setCreatorVisible(true); };
    const handleSaveFood = async (foodData: any) => {
        setLoading(true);
        try {
            const savedFood = await saveFood(foodData);
            const upsertFood = (list: FoodItem[]) => {
                const index = list.findIndex(f => f._id === savedFood._id);
                if (index !== -1) {
                    const newList = [...list];
                    newList[index] = savedFood as FoodItem;
                    return newList;
                }
                return [savedFood as FoodItem, ...list];
            };
            setFoods(prev => upsertFood(prev));
            setInitialFoods(prev => upsertFood(prev));
            setCreatorVisible(false);
        } catch (error) {
            Alert.alert("Error", "No se pudo guardar el plato");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFood = async (id: string) => {
        try {
            await deleteFood(id);
            setFoods(prev => prev.filter(f => f._id !== id));
            setInitialFoods(prev => prev.filter(f => f._id !== id));
            setCreatorVisible(false);
        } catch (error: any) {
            Alert.alert("Error", error.message || "No se pudo eliminar");
        }
    };

    const handleToggleFavorite = useCallback(async (food: FoodItem) => {
        try {
            const { toggleFavorite } = require('../../../src/services/foodService');
            const result = await toggleFavorite(food);
            if (result.action === 'cloned_and_favorited') {
                setInitialFoods(prev => [result.food, ...prev]);
                setFoods(prev => [result.food, ...prev]);
            } else if (result.action === 'removed_deleted' || !result.food) {
                setFoods(prev => prev.filter(f => f._id !== food._id));
                setInitialFoods(prev => prev.filter(f => f._id !== food._id));
            } else {
                const updateFav = (list: FoodItem[]) =>
                    list.map(f => f._id === result.food._id ? { ...f, isFavorite: result.food.isFavorite } : f);
                setFoods(updateFav);
                setInitialFoods(updateFav);
            }
        } catch (error) {
            console.error('Toggle favorite error:', error);
        }
    }, []);

    const handleOpenFood = useCallback((food: FoodItem) => {
        setEditingFood(food);
        setCreatorVisible(true);
    }, []);

    // ─────────────────────────────────────────────────────────
    // Combo Handlers
    // ─────────────────────────────────────────────────────────
    const handleOpenCombo = useCallback((gridItem: any) => {
        setEditingCombo(gridItem._comboSource || null);
        setComboCreatorVisible(true);
    }, []);

    const handleToggleComboFavorite = useCallback(async (gridItem: any) => {
        const result = await toggleComboFavorite(gridItem._id);
        if (result) {
            setCombos(prev => prev.map(c =>
                c._id === gridItem._id ? { ...c, isFavorite: result.isFavorite } : c
            ));
        }
    }, []);

    const handleDeleteCombo = async (id: string) => {
        const confirmed = Platform.OS === 'web'
            ? window.confirm('¿Eliminar este combo? Esta acción no se puede deshacer.')
            : await new Promise<boolean>(resolve => {
                Alert.alert('Eliminar Combo', '¿Eliminar este combo?', [
                    { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                    { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
                ]);
            });
        if (confirmed) {
            await deleteCombo(id);
            setCombos(prev => prev.filter(c => c._id !== id));
            setComboCreatorVisible(false);
        }
    };

    const handleSaveCombo = async (comboData: any) => {
        try {
            let saved;
            if (comboData._id) {
                saved = await updateCombo(comboData._id, comboData);
            } else {
                saved = await createCombo(comboData);
            }
            if (saved) {
                setCombos(prev => {
                    const idx = prev.findIndex(c => c._id === saved._id);
                    if (idx !== -1) {
                        const updated = [...prev];
                        updated[idx] = saved;
                        return updated;
                    }
                    return [saved, ...prev];
                });
            }
            setComboCreatorVisible(false);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Error al guardar combo');
        }
    };

    const handleDuplicateCombo = async (combo: any) => {
        try {
            const duplicated = await createCombo({
                name: `Copia de ${combo.name}`,
                description: combo.description || '',
                category: combo.category || 'otro',
                tags: combo.tags || [],
                foods: combo.foods || [],
                supplements: combo.supplements || [],
                image: combo.image || undefined,
            });
            if (duplicated) {
                setCombos(prev => [duplicated, ...prev]);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Error al duplicar combo');
        }
    };

    const getActiveFilterCount = () => {
        let count = 0;
        if (filters.onlyFavorites) count++;
        count += filters.types.length;
        count += filters.goals.length;
        count += filters.macros.length;
        return count;
    };

    // ─────────────────────────────────────────────────────────
    // Render helpers
    // ─────────────────────────────────────────────────────────
    const getItemType = (item: any): 'ingredient' | 'recipe' | 'combo' => {
        if (item._itemType === 'combo') return 'combo';
        if (item.isComposite) return 'recipe';
        return 'ingredient';
    };

    const handleItemPress = useCallback((item: any) => {
        if (item._itemType === 'combo') {
            handleOpenCombo(item);
        } else {
            handleOpenFood(item);
        }
    }, [handleOpenCombo, handleOpenFood]);

    const handleItemFavorite = useCallback((item: any) => {
        if (item._itemType === 'combo') {
            handleToggleComboFavorite(item);
        } else {
            handleToggleFavorite(item);
        }
    }, [handleToggleComboFavorite, handleToggleFavorite]);

    const handleItemDelete = useCallback(async (item: any) => {
        const name = item.name || 'este elemento';
        const confirmed = Platform.OS === 'web'
            ? window.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)
            : await new Promise<boolean>(resolve => {
                Alert.alert('Eliminar', `¿Eliminar "${name}"?`, [
                    { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                    { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
                ]);
            });
        if (!confirmed) return;

        if (item._itemType === 'combo') {
            await deleteCombo(item._id);
            setCombos(prev => prev.filter(c => c._id !== item._id));
        } else {
            await deleteFood(item._id);
            setFoods(prev => prev.filter(f => f._id !== item._id));
            setInitialFoods(prev => prev.filter(f => f._id !== item._id));
        }
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />

            {/* Header */}
            <CoachHeader
                title="Biblioteca de Alimentos"
                subtitle="Gestiona tus platos y productos"
                icon={null}
                badge={null}
                rightContent={
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                            onPress={handleCreateNew}
                            style={{
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: viewMode === 'INGREDIENTS' ? '#eff6ff' : '#fff',
                                borderWidth: 1, borderColor: viewMode === 'INGREDIENTS' ? '#bfdbfe' : '#e2e8f0',
                                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4
                            }}
                        >
                            <Ionicons name="nutrition-outline" size={15} color="#3b82f6" />
                            <Text style={{ color: '#3b82f6', fontWeight: '600', fontSize: 12 }}>Alimento</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.push('/(coach)/food-library/create-recipe')}
                            style={{
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: viewMode === 'RECIPES' ? '#ecfdf5' : '#fff',
                                borderWidth: 1, borderColor: viewMode === 'RECIPES' ? '#bbf7d0' : '#e2e8f0',
                                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4
                            }}
                        >
                            <Ionicons name="restaurant-outline" size={15} color="#16a34a" />
                            <Text style={{ color: '#16a34a', fontWeight: '600', fontSize: 12 }}>Receta</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => { setEditingCombo(null); setComboCreatorVisible(true); }}
                            style={{
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: viewMode === 'COMBOS' ? '#fffbeb' : '#fff',
                                borderWidth: 1, borderColor: viewMode === 'COMBOS' ? '#fde68a' : '#e2e8f0',
                                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4
                            }}
                        >
                            <Ionicons name="layers-outline" size={15} color="#d97706" />
                            <Text style={{ color: '#d97706', fontWeight: '600', fontSize: 12 }}>Combo</Text>
                        </TouchableOpacity>
                    </View>
                }
            />

            {/* TABS */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
                <TouchableOpacity
                    onPress={() => setViewMode('INGREDIENTS')}
                    style={{
                        flex: 1, paddingVertical: 10, alignItems: 'center',
                        borderBottomWidth: 2,
                        borderBottomColor: viewMode === 'INGREDIENTS' ? '#4f46e5' : 'transparent'
                    }}
                >
                    <Text style={{
                        color: viewMode === 'INGREDIENTS' ? '#4f46e5' : '#64748b',
                        fontWeight: '600'
                    }}>🍎 Ingredientes</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setViewMode('RECIPES')}
                    style={{
                        flex: 1, paddingVertical: 10, alignItems: 'center',
                        borderBottomWidth: 2,
                        borderBottomColor: viewMode === 'RECIPES' ? '#4f46e5' : 'transparent'
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 16 }}>🍲</Text>
                        <Text style={{
                            color: viewMode === 'RECIPES' ? '#4f46e5' : '#64748b',
                            fontWeight: '600'
                        }}>Mis Recetas</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setViewMode('COMBOS')}
                    style={{
                        flex: 1, paddingVertical: 10, alignItems: 'center',
                        borderBottomWidth: 2,
                        borderBottomColor: viewMode === 'COMBOS' ? '#d97706' : 'transparent'
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="layers" size={16} color={viewMode === 'COMBOS' ? '#d97706' : '#94a3b8'} />
                        <Text style={{
                            color: viewMode === 'COMBOS' ? '#d97706' : '#64748b',
                            fontWeight: '600'
                        }}>Mis Combos</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <View style={{ flex: 1, flexDirection: 'row' }}>

                {/* SIDEBAR (Desktop only) — hide for combos */}
                {isLargeScreen && viewMode !== 'COMBOS' && (
                    <FoodLibrarySidebar
                        filters={filters}
                        onUpdate={setFilters}
                    />
                )}

                {/* MAIN CONTENT */}
                <View style={{ flex: 1 }}>

                    {/* Top Bar */}
                    <View style={styles.topBar}>
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color="#94a3b8" />
                            <EnhancedTextInput
                                containerStyle={styles.searchInputContainer}
                                style={styles.searchInputText}
                                placeholder={viewMode === 'COMBOS' ? 'Buscar combos...' : 'Buscar (e.g. Arroz, Pollo)...'}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                returnKeyType="search"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color="#cbd5e1" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {!isLargeScreen && viewMode !== 'COMBOS' && (
                            <TouchableOpacity
                                style={[styles.iconButton, getActiveFilterCount() > 0 && styles.iconButtonActive]}
                                onPress={() => setShowMobileFilters(true)}
                            >
                                <Ionicons name="options" size={20} color={getActiveFilterCount() > 0 ? '#fff' : '#64748b'} />
                                {getActiveFilterCount() > 0 && (
                                    <View style={styles.badge}><Text style={styles.badgeText}>{getActiveFilterCount()}</Text></View>
                                )}
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => {
                                if (sortBy === 'recent') setSortBy('calories_asc');
                                else if (sortBy === 'calories_asc') setSortBy('protein_desc');
                                else if (sortBy === 'protein_desc') setSortBy('name');
                                else setSortBy('recent');
                            }}
                        >
                            <Ionicons name="swap-vertical" size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Sort Indicator */}
                    <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: '#64748b', fontSize: 13 }}>
                            Mostrando {processedFoods.length} resultados
                        </Text>
                        <Text style={{ color: viewMode === 'COMBOS' ? '#d97706' : '#4f46e5', fontSize: 13, fontWeight: '600' }}>
                            {sortBy === 'calories_asc' ? 'Menos Calorías' : sortBy === 'protein_desc' ? 'Más Proteína' : sortBy === 'name' ? 'A-Z' : 'Más Recientes'}
                        </Text>
                    </View>

                    {/* CONTENT GRID */}
                    <FlatList
                        key={`${isLargeScreen ? 'lg' : 'sm'}_${viewMode}`}
                        data={processedFoods}
                        numColumns={isLargeScreen ? 3 : 2}
                        keyExtractor={(item) => item._id}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ padding: 10, paddingBottom: 100 }}
                        ListHeaderComponent={
                            <>
                                {/* Favorites Carousel (Ingredients/Recipes only) */}
                                {viewMode !== 'COMBOS' && searchQuery === '' && !filters.onlyFavorites && initialFoods.some(f => f.isFavorite) && (
                                    <View style={{ marginBottom: 20 }}>
                                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12, paddingHorizontal: 6 }}>
                                            ⭐ Tus Favoritos
                                        </Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 6 }}>
                                            {initialFoods.filter(f => f.isFavorite).map((item) => (
                                                <FoodMiniCard key={item._id} item={item} onPress={() => handleOpenFood(item)} />
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {/* Combo Favorites Carousel */}
                                {viewMode === 'COMBOS' && searchQuery === '' && combos.some(c => c.isFavorite) && (
                                    <View style={{ marginBottom: 20 }}>
                                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#92400e', marginBottom: 12, paddingHorizontal: 6 }}>
                                            ⭐ Combos Favoritos
                                        </Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 6 }}>
                                            {combos.filter(c => c.isFavorite).map(c => {
                                                const gridItem = comboToGridItem(c);
                                                return <FoodMiniCard key={c._id} item={gridItem as any} onPress={() => handleOpenCombo(gridItem)} />;
                                            })}
                                        </ScrollView>
                                    </View>
                                )}

                                {/* RECIPES EMPTY STATE */}
                                {viewMode === 'RECIPES' && processedFoods.length === 0 && searchQuery === '' && (
                                    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                                        <Text style={{ fontSize: 40, marginBottom: 10 }}>🍲</Text>
                                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#1e293b', textAlign: 'center' }}>
                                            Aún no has creado recetas
                                        </Text>
                                        <Text style={{ marginTop: 8, fontSize: 14, color: '#64748b', textAlign: 'center', maxWidth: 300 }}>
                                            Crea "Platos Maestros" agrupando ingredientes (ej: Arroz con Pollo) para usarlos rápidamente en tus planes.
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => router.push('/(coach)/food-library/create-recipe')}
                                            style={{ marginTop: 20, backgroundColor: '#4f46e5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '600' }}>Crear mi primera receta</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* COMBOS EMPTY STATE */}
                                {viewMode === 'COMBOS' && processedFoods.length === 0 && searchQuery === '' && (
                                    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                                        <Ionicons name="layers-outline" size={56} color="#fbbf24" />
                                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#1e293b', textAlign: 'center', marginTop: 12 }}>
                                            Aún no tienes combos
                                        </Text>
                                        <Text style={{ marginTop: 8, fontSize: 14, color: '#64748b', textAlign: 'center', maxWidth: 300 }}>
                                            Crea combos de comida agrupando alimentos (ej: Avena + Plátano + Leche) para insertarlos rápidamente en tus planes.
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => { setEditingCombo(null); setComboCreatorVisible(true); }}
                                            style={{ marginTop: 20, backgroundColor: '#d97706', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '600' }}>Crear mi primer combo</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        }
                        renderItem={({ item }) => (
                            <View style={{ flex: 1, padding: 6, maxWidth: isLargeScreen ? '33.33%' : '50%' }}>
                                <FoodGridCard
                                    item={item}
                                    itemType={getItemType(item)}
                                    onPress={handleItemPress}
                                    isFavorite={item.isFavorite}
                                    onToggleFavorite={handleItemFavorite}
                                    onDelete={handleItemDelete}
                                    canDelete={isItemDeletable(item)}
                                />
                            </View>
                        )}
                        ListEmptyComponent={
                            searchQuery.length > 0 ? (
                                <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                                    <Ionicons name={viewMode === 'COMBOS' ? 'layers-outline' : 'nutrition-outline'} size={48} color="#cbd5e1" />
                                    <Text style={{ marginTop: 16, fontSize: 16, color: '#64748b', textAlign: 'center' }}>
                                        No se encontraron resultados para "{searchQuery}"
                                    </Text>
                                </View>
                            ) : null
                        }
                    />
                </View>
            </View>

            {/* MOBILE FILTERS MODAL */}
            <Modal visible={showMobileFilters} animationType="slide" presentationStyle="pageSheet">
                <FoodLibrarySidebar
                    filters={filters}
                    onUpdate={setFilters}
                    onClose={() => setShowMobileFilters(false)}
                />
            </Modal>

            {/* Food Creator Modal */}
            <FoodCreatorModal
                visible={creatorVisible}
                onClose={() => setCreatorVisible(false)}
                onSave={handleSaveFood}
                onDelete={handleDeleteFood}
                initialData={editingFood as any}
            />

            {/* ════════════════════════════════════════════════════════ */}
            {/* COMBO CREATOR/EDITOR MODAL */}
            {/* ════════════════════════════════════════════════════════ */}
            <ComboEditorModal
                visible={comboCreatorVisible}
                onClose={() => { setComboCreatorVisible(false); setEditingCombo(null); }}
                onSave={handleSaveCombo}
                onDelete={handleDeleteCombo}
                onDuplicate={handleDuplicateCombo}
                initialData={editingCombo}
            />
        </SafeAreaView>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBO EDITOR MODAL — Inline component (same file to avoid circular deps)
// Supports: create, edit, duplicate, delete, add foods from DB, AI generate
// ═══════════════════════════════════════════════════════════════════════════

const COMBO_CATEGORIES = [
    { id: 'desayuno', label: 'Desayuno', icon: 'sunny-outline' },
    { id: 'almuerzo', label: 'Almuerzo', icon: 'restaurant-outline' },
    { id: 'comida', label: 'Comida', icon: 'restaurant-outline' },
    { id: 'merienda', label: 'Merienda', icon: 'cafe-outline' },
    { id: 'cena', label: 'Cena', icon: 'moon-outline' },
    { id: 'snack', label: 'Snack', icon: 'nutrition-outline' },
    { id: 'pre-entreno', label: 'Pre-Entreno', icon: 'barbell-outline' },
    { id: 'post-entreno', label: 'Post-Entreno', icon: 'fitness-outline' },
    { id: 'otro', label: 'Otro', icon: 'ellipsis-horizontal' },
];

function ComboEditorModal({ visible, onClose, onSave, onDelete, onDuplicate, initialData }: {
    visible: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    onDelete: (id: string) => void;
    onDuplicate: (combo: any) => void;
    initialData: any;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [category, setCategory] = useState('otro');
    const [comboFoods, setComboFoods] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [editingAmountIdx, setEditingAmountIdx] = useState<number | null>(null);

    // Food search
    const [foodSearch, setFoodSearch] = useState('');
    const [foodResults, setFoodResults] = useState<any[]>([]);
    const [searchingFoods, setSearchingFoods] = useState(false);

    // AI
    const [showAI, setShowAI] = useState(false);
    const [aiDesc, setAiDesc] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    // Image
    const [comboImage, setComboImage] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [imageTab, setImageTab] = useState<'upload' | 'url' | 'ai'>('upload');
    const [imageAiLoading, setImageAiLoading] = useState(false);

    const { width: modalScreenWidth } = useStableWindowDimensions();
    const isWideModal = modalScreenWidth > 720;
    const isEditing = !!initialData?._id;

    const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app').replace(/\/+$/, '') + '/api';

    // Reset form when modal opens/changes
    useEffect(() => {
        if (visible) {
            if (initialData) {
                setName(initialData.name || '');
                setDescription(initialData.description || '');
                setNotes(initialData.notes || '');
                setCategory(initialData.category || 'otro');
                setComboFoods(initialData.foods?.map((f: any) => ({ ...f })) || []);
                setComboImage(initialData.image || '');
                setImageUrl(initialData.image || '');
            } else {
                setName('');
                setDescription('');
                setNotes('');
                setCategory('otro');
                setComboFoods([]);
                setComboImage('');
                setImageUrl('');
            }
            setFoodSearch('');
            setFoodResults([]);
            setShowAI(false);
            setAiDesc('');
            setEditingAmountIdx(null);
            setImageTab('upload');
        }
    }, [visible, initialData]);

    // Image handlers
    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            setComboImage(result.assets[0].uri);
        }
    };

    const handleUrlSubmit = () => {
        if (imageUrl.trim()) setComboImage(imageUrl.trim());
    };

    const handleAiImage = async () => {
        if (!name.trim() || name.trim().length < 2) {
            Alert.alert('Error', 'Escribe el nombre del combo primero');
            return;
        }
        setImageAiLoading(true);
        try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const token = await AsyncStorage.getItem('totalgains_token');
            if (!token) { Alert.alert('Error', 'Sesión no válida'); return; }
            const response = await fetch(`${API_BASE_URL}/foods/ai-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ foodName: name.trim(), index: 0 }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error generando imagen');
            if (data.success && (data.image?.dataUrl || data.image?.url)) {
                setComboImage(data.image.dataUrl || data.image.url);
            } else {
                throw new Error('No se encontró imagen');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'No se pudo generar la imagen');
        } finally {
            setImageAiLoading(false);
        }
    };

    // Food search debounce
    useEffect(() => {
        if (foodSearch.trim().length < 2) { setFoodResults([]); return; }
        const timer = setTimeout(async () => {
            setSearchingFoods(true);
            try {
                const results = await searchFoods(foodSearch, { skipExternal: true });
                setFoodResults(results.slice(0, 15));
            } catch { }
            setSearchingFoods(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [foodSearch]);

    // Add food to combo
    const addFood = (food: any) => {
        const amount = 100;
        const nutrients = food.nutrients || {};
        setComboFoods(prev => [...prev, {
            name: food.name,
            amount,
            unit: 'gramos',
            kcal: Math.round(nutrients.kcal || 0),
            protein: Math.round((nutrients.protein || 0) * 10) / 10,
            carbs: Math.round((nutrients.carbs || 0) * 10) / 10,
            fat: Math.round((nutrients.fat || 0) * 10) / 10,
            foodId: food._id,
            sourceId: food._id,
            sourceType: food.layer || 'CLOUD',
            image: food.image,
            isComposite: food.isComposite || false,
            subIngredients: food.ingredients || [],
            _nutrientsPer100g: nutrients,
        }]);
        setFoodSearch('');
        setFoodResults([]);
    };

    // Units available for cycling (subset of UNIT_CONVERSIONS most useful for combos)
    const COMBO_UNIT_KEYS = ['gramos', 'unidad', 'ración', 'cucharada', 'cucharadita', 'taza', 'puñado', 'scoop', 'rebanada', 'loncha', 'rodaja', 'a_gusto'];

    // Recalculate macros for a food given amount + unit
    const recalcMacros = (food: any, amount: number, unit: string) => {
        const per100g = food._nutrientsPer100g || {
            kcal: (food.kcal / (food.amount || 100)) * 100,
            protein: (food.protein / (food.amount || 100)) * 100,
            carbs: (food.carbs / (food.amount || 100)) * 100,
            fat: (food.fat / (food.amount || 100)) * 100,
        };
        if (unit === 'a_gusto') {
            return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
        }
        const macros = calculateMacrosForAmount(amount, unit, per100g, food.name);
        return macros;
    };

    // Update food amount (keeps current unit)
    const updateFoodAmount = (index: number, newAmount: string) => {
        const amount = parseFloat(newAmount) || 0;
        setComboFoods(prev => prev.map((f, i) => {
            if (i !== index) return f;
            const macros = recalcMacros(f, amount, f.unit || 'gramos');
            return { ...f, amount, ...macros };
        }));
    };

    // Cycle through units
    const cycleUnit = (index: number) => {
        setComboFoods(prev => prev.map((f, i) => {
            if (i !== index) return f;
            const currentKey = f.unit || 'gramos';
            const currentIdx = COMBO_UNIT_KEYS.indexOf(currentKey);
            const nextIdx = (currentIdx + 1) % COMBO_UNIT_KEYS.length;
            const nextUnit = COMBO_UNIT_KEYS[nextIdx];
            // When switching to a_gusto, amount stays but macros zero out
            const newAmount = nextUnit === 'a_gusto' ? 0 : (nextUnit === 'gramos' ? 100 : 1);
            const macros = recalcMacros(f, newAmount, nextUnit);
            return { ...f, unit: nextUnit, amount: newAmount, ...macros };
        }));
    };

    const removeFood = (index: number) => {
        setComboFoods(prev => prev.filter((_, i) => i !== index));
        if (editingAmountIdx === index) setEditingAmountIdx(null);
    };

    // Totals
    const totals = useMemo(() => {
        return comboFoods.reduce((acc, f) => ({
            kcal: acc.kcal + (f.kcal || 0),
            protein: acc.protein + (f.protein || 0),
            carbs: acc.carbs + (f.carbs || 0),
            fat: acc.fat + (f.fat || 0),
        }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    }, [comboFoods]);

    // AI Generate
    const handleAIGenerate = async () => {
        if (aiDesc.trim().length < 3) return;
        setAiLoading(true);
        try {
            const { aiGenerateCombo } = require('../../../src/services/mealComboService');
            const result = await aiGenerateCombo(aiDesc.trim(), category);
            if (result?.foods) {
                setName(result.name || name);
                setDescription(result.description || '');
                if (result.category && result.category !== 'otro') setCategory(result.category);
                setComboFoods(result.foods.map((f: any) => ({
                    ...f,
                    _nutrientsPer100g: {
                        kcal: f.amount ? (f.kcal / f.amount) * 100 : f.kcal,
                        protein: f.amount ? (f.protein / f.amount) * 100 : f.protein,
                        carbs: f.amount ? (f.carbs / f.amount) * 100 : f.carbs,
                        fat: f.amount ? (f.fat / f.amount) * 100 : f.fat,
                    },
                })));
                setShowAI(false);
                setAiDesc('');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Error generando combo con IA');
        }
        setAiLoading(false);
    };

    // Auto-generate image if none set
    const autoGenerateImage = async (comboName: string): Promise<string | undefined> => {
        try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const token = await AsyncStorage.getItem('totalgains_token');
            if (!token) return undefined;
            const response = await fetch(`${API_BASE_URL}/foods/ai-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ foodName: comboName, index: 0 }),
            });
            const data = await response.json();
            if (data.success && (data.image?.dataUrl || data.image?.url)) {
                return data.image.dataUrl || data.image.url;
            }
        } catch (e) {
            console.log('[ComboEditor] Auto-image failed:', e);
        }
        return undefined;
    };

    // Save
    const handleSave = async () => {
        if (!name.trim()) { Alert.alert('Error', 'Introduce un nombre'); return; }
        if (comboFoods.length === 0) { Alert.alert('Error', 'Añade al menos un alimento'); return; }
        setSaving(true);

        try {
            // Auto-generate image if none set
            let finalImage = comboImage;
            if (!finalImage) {
                finalImage = await autoGenerateImage(name.trim()) || '';
                if (finalImage) setComboImage(finalImage);
            }

            const cleanFoods = comboFoods.map(({ _nutrientsPer100g, ...rest }) => rest);
            await onSave({
                ...(initialData?._id ? { _id: initialData._id } : {}),
                name: name.trim(),
                description: description.trim(),
                notes: notes.trim(),
                category,
                image: finalImage || undefined,
                foods: cleanFoods,
            });
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Error al guardar el combo');
        } finally {
            setSaving(false);
        }
    };

    // % of total for each food
    const getFoodPct = (food: any) => {
        if (!totals.kcal) return 0;
        return Math.round(((food.kcal || 0) / totals.kcal) * 100);
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={[modalStyles.container, isWideModal && { maxWidth: 680 }]}>
                    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        {/* Header */}
                        <View style={modalStyles.header}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="layers" size={24} color="#d97706" />
                                <Text style={modalStyles.title}>{isEditing ? 'Editar Combo' : 'Nuevo Combo'}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {/* Name */}
                        <Text style={modalStyles.label}>Nombre del combo</Text>
                        <EnhancedTextInput
                            containerStyle={modalStyles.input}
                            style={{ fontSize: 15, color: '#1e293b' }}
                            value={name}
                            onChangeText={setName}
                            placeholder="Ej: Desayuno proteico"
                            placeholderTextColor="#94a3b8"
                        />

                        {/* Description */}
                        <Text style={modalStyles.label}>Descripción (opcional)</Text>
                        <EnhancedTextInput
                            containerStyle={modalStyles.input}
                            style={{ fontSize: 14, color: '#1e293b' }}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Breve descripción..."
                            placeholderTextColor="#94a3b8"
                        />

                        {/* Notes */}
                        <Text style={modalStyles.label}>Notas del entrenador (opcional)</Text>
                        <EnhancedTextInput
                            containerStyle={[modalStyles.input, { minHeight: 70 }]}
                            style={{ fontSize: 14, color: '#1e293b', textAlignVertical: 'top' }}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Ej: Preparar la noche anterior, mezclar todo en batidora..."
                            placeholderTextColor="#94a3b8"
                            multiline
                            numberOfLines={3}
                        />

                        {/* Category */}
                        <Text style={modalStyles.label}>Categoría</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                {COMBO_CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            modalStyles.chip,
                                            category === cat.id && { backgroundColor: '#d97706' }
                                        ]}
                                        onPress={() => setCategory(cat.id)}
                                    >
                                        <Ionicons name={cat.icon as any} size={14} color={category === cat.id ? '#fff' : '#64748b'} />
                                        <Text style={[
                                            modalStyles.chipText,
                                            category === cat.id && { color: '#fff' }
                                        ]}>{cat.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        {/* ═══ IMAGE SECTION ═══ */}
                        <Text style={modalStyles.label}>Imagen</Text>
                        <View style={modalStyles.imageSection}>
                            {/* Preview or Auto-generate prompt */}
                            {comboImage ? (
                                <View style={{ position: 'relative', marginBottom: 8 }}>
                                    <Image source={{ uri: comboImage }} style={modalStyles.imagePreview} resizeMode="cover" accessibilityLabel={`Imagen del combo ${name}`} />
                                    <TouchableOpacity
                                        style={modalStyles.imageRemoveBtn}
                                        onPress={() => { setComboImage(''); setImageUrl(''); }}
                                    >
                                        <Ionicons name="close-circle" size={24} color="#ef4444" />
                                    </TouchableOpacity>
                                    {/* Regenerate button overlay */}
                                    <TouchableOpacity
                                        style={[modalStyles.imageRemoveBtn, { left: 6, right: undefined }]}
                                        onPress={handleAiImage}
                                        disabled={imageAiLoading}
                                    >
                                        {imageAiLoading
                                            ? <ActivityIndicator size="small" color="#8b5cf6" />
                                            : <Ionicons name="refresh-circle" size={24} color="#8b5cf6" />
                                        }
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                /* Quick AI generate button — most common action */
                                <TouchableOpacity
                                    style={[modalStyles.imageAutoBtn, imageAiLoading && { opacity: 0.6 }]}
                                    onPress={handleAiImage}
                                    disabled={imageAiLoading}
                                >
                                    {imageAiLoading ? (
                                        <ActivityIndicator size="small" color="#8b5cf6" />
                                    ) : (
                                        <Ionicons name="sparkles" size={22} color="#8b5cf6" />
                                    )}
                                    <View>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>
                                            {imageAiLoading ? 'Generando imagen...' : 'Generar imagen con IA'}
                                        </Text>
                                        <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                                            {imageAiLoading ? 'Buscando la mejor foto...' : 'Auto · Se genera también al guardar si no hay foto'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {/* Alternative options row (compact) */}
                            {!comboImage && (
                                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                                    <TouchableOpacity
                                        style={modalStyles.imageAltBtn}
                                        onPress={handlePickImage}
                                    >
                                        <Ionicons name="folder-outline" size={14} color="#94a3b8" />
                                        <Text style={{ fontSize: 11, color: '#64748b' }}>Subir archivo</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[modalStyles.imageAltBtn, imageTab === 'url' && { borderColor: '#fde68a', backgroundColor: '#fffdf7' }]}
                                        onPress={() => setImageTab(imageTab === 'url' ? 'upload' : 'url')}
                                    >
                                        <Ionicons name="link-outline" size={14} color="#94a3b8" />
                                        <Text style={{ fontSize: 11, color: '#64748b' }}>Pegar URL</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* URL input (expandable) */}
                            {!comboImage && imageTab === 'url' && (
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                                    <EnhancedTextInput
                                        containerStyle={[modalStyles.input, { flex: 1, marginBottom: 0 }]}
                                        style={{ fontSize: 13, color: '#1e293b' }}
                                        value={imageUrl}
                                        onChangeText={setImageUrl}
                                        placeholder="https://ejemplo.com/imagen.jpg"
                                        placeholderTextColor="#94a3b8"
                                        onSubmitEditing={handleUrlSubmit}
                                        autoFocus
                                    />
                                    <TouchableOpacity
                                        style={{ backgroundColor: '#d97706', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' }}
                                        onPress={handleUrlSubmit}
                                    >
                                        <Ionicons name="checkmark" size={18} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* ═══ TOTALS BAR ═══ */}
                        {comboFoods.length > 0 && (
                            <View style={modalStyles.totalsBar}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="flame" size={16} color="#f97316" />
                                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#f97316' }}>{Math.round(totals.kcal)}</Text>
                                    <Text style={{ fontSize: 11, color: '#94a3b8' }}>kcal</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#3b82f6' }}>P:{Math.round(totals.protein)}g</Text>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#22c55e' }}>C:{Math.round(totals.carbs)}g</Text>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#f59e0b' }}>G:{Math.round(totals.fat)}g</Text>
                                </View>
                                <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400e' }}>{comboFoods.length} alimentos</Text>
                                </View>
                            </View>
                        )}

                        {/* ═══ FOOD CARDS (MealCard style) ═══ */}
                        <Text style={modalStyles.label}>Alimentos</Text>
                        <View style={isWideModal ? { flexDirection: 'row', flexWrap: 'wrap', gap: 6 } : undefined}>
                        {comboFoods.map((food, idx) => {
                            const pct = getFoodPct(food);
                            return (
                                <View key={`${food.name}_${idx}`} style={[
                                    modalStyles.foodCard,
                                    isWideModal && { width: '48.5%' as any }
                                ]}>
                                    {/* Top Row: Name + Close */}
                                    <View style={modalStyles.foodTopRow}>
                                        <Text style={modalStyles.foodName} numberOfLines={1}>{food.name}</Text>
                                        <TouchableOpacity onPress={() => removeFood(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            <Ionicons name="close" size={14} color="#9ca3af" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Main Row: Photo + Macros + Amount */}
                                    <View style={modalStyles.foodMainRow}>
                                        {/* Photo */}
                                        {food.image ? (
                                            <Image source={{ uri: food.image }} style={modalStyles.foodPhoto} resizeMode="cover" />
                                        ) : (
                                            <View style={[modalStyles.foodPhoto, modalStyles.foodPhotoPlaceholder, food.isComposite && { backgroundColor: '#dcfce7' }]}>
                                                <Ionicons
                                                    name={food.isComposite ? "restaurant" : "fast-food-outline"}
                                                    size={16}
                                                    color={food.isComposite ? "#22c55e" : "#94a3b8"}
                                                />
                                            </View>
                                        )}

                                        {/* Macros */}
                                        <View style={{ flex: 1, marginLeft: 8 }}>
                                            <View style={modalStyles.foodMacrosRow}>
                                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#f97316' }}>
                                                    🔥{Math.round(food.kcal)}
                                                </Text>
                                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#3b82f6' }}>
                                                    P:{Math.round(food.protein)}
                                                </Text>
                                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#22c55e' }}>
                                                    C:{Math.round(food.carbs)}
                                                </Text>
                                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#f59e0b' }}>
                                                    G:{Math.round(food.fat)}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Right: % badge + Amount + Unit */}
                                        <View style={{ alignItems: 'flex-end', gap: 3 }}>
                                            <View style={[
                                                modalStyles.pctBadge,
                                                pct >= 50 && { backgroundColor: '#fee2e2' }
                                            ]}>
                                                <Text style={[
                                                    modalStyles.pctText,
                                                    pct >= 50 && { color: '#ef4444' }
                                                ]}>{pct}%</Text>
                                            </View>

                                            {(food.unit === 'a_gusto') ? (
                                                <TouchableOpacity onPress={() => cycleUnit(idx)} style={{ alignItems: 'center' }}>
                                                    <Text style={[modalStyles.foodAmountText, { fontSize: 13 }]}>Libre</Text>
                                                </TouchableOpacity>
                                            ) : editingAmountIdx === idx ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                    <EnhancedTextInput
                                                        containerStyle={modalStyles.amountInputContainer}
                                                        style={modalStyles.amountInputText}
                                                        value={String(food.amount || 100)}
                                                        onChangeText={(v: string) => updateFoodAmount(idx, v)}
                                                        keyboardType="numeric"
                                                        selectTextOnFocus
                                                        onBlur={() => setEditingAmountIdx(null)}
                                                        autoFocus
                                                    />
                                                </View>
                                            ) : (
                                                <TouchableOpacity
                                                    onPress={() => setEditingAmountIdx(idx)}
                                                    style={{ alignItems: 'center' }}
                                                >
                                                    <Text style={modalStyles.foodAmountText}>{food.amount || 100}</Text>
                                                </TouchableOpacity>
                                            )}

                                            {/* Unit label — tap to cycle + gram equiv */}
                                            <TouchableOpacity onPress={() => cycleUnit(idx)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                {food.unit && food.unit !== 'gramos' && food.unit !== 'g' && food.unit !== 'a_gusto' && (
                                                    <Text style={{ fontSize: 9, color: '#94a3b8' }}>
                                                        ≈{Math.round((food.amount || 1) * (UNIT_CONVERSIONS[food.unit as keyof typeof UNIT_CONVERSIONS]?.factor || 100))}g
                                                    </Text>
                                                )}
                                                <Text style={modalStyles.unitLabel}>
                                                    {UNIT_CONVERSIONS[food.unit as keyof typeof UNIT_CONVERSIONS]?.labelLong || food.unit || 'Gramos'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                        </View>

                        {/* Empty state for foods */}
                        {comboFoods.length === 0 && (
                            <View style={modalStyles.emptyFoods}>
                                <Ionicons name="fast-food-outline" size={32} color="#cbd5e1" />
                                <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                                    Busca alimentos abajo para añadirlos al combo
                                </Text>
                            </View>
                        )}

                        {/* ═══ FOOD SEARCH ═══ */}
                        <View style={modalStyles.searchBar}>
                            <Ionicons name="search" size={18} color="#94a3b8" />
                            <EnhancedTextInput
                                containerStyle={{ flex: 1 }}
                                style={{ fontSize: 14, color: '#1e293b' }}
                                value={foodSearch}
                                onChangeText={setFoodSearch}
                                placeholder="Buscar alimento para añadir..."
                                placeholderTextColor="#94a3b8"
                            />
                            {searchingFoods && <ActivityIndicator size="small" color="#d97706" />}
                        </View>

                        {/* Search Results — card rows like SmartFoodDrawer */}
                        {foodResults.length > 0 && (
                            <View style={modalStyles.searchResults}>
                                <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                                    {foodResults.map((food, idx) => (
                                        <TouchableOpacity
                                            key={food._id || idx}
                                            style={modalStyles.searchResultCard}
                                            onPress={() => addFood(food)}
                                            activeOpacity={0.7}
                                        >
                                            {/* Photo */}
                                            {food.image ? (
                                                <Image source={{ uri: food.image }} style={modalStyles.searchResultPhoto} resizeMode="cover" />
                                            ) : (
                                                <View style={[modalStyles.searchResultPhoto, modalStyles.searchResultPhotoPlaceholder, food.isComposite && { backgroundColor: '#dcfce7' }]}>
                                                    <Ionicons
                                                        name={food.isComposite ? "restaurant" : "fast-food-outline"}
                                                        size={14}
                                                        color={food.isComposite ? "#22c55e" : "#94a3b8"}
                                                    />
                                                </View>
                                            )}

                                            {/* Info */}
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }} numberOfLines={1}>{food.name}</Text>
                                                <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#f97316' }}>
                                                        🔥{Math.round(food.nutrients?.kcal || 0)}
                                                    </Text>
                                                    <Text style={{ fontSize: 10, color: '#3b82f6' }}>
                                                        P:{Math.round(food.nutrients?.protein || 0)}
                                                    </Text>
                                                    <Text style={{ fontSize: 10, color: '#22c55e' }}>
                                                        C:{Math.round(food.nutrients?.carbs || 0)}
                                                    </Text>
                                                    <Text style={{ fontSize: 10, color: '#f59e0b' }}>
                                                        G:{Math.round(food.nutrients?.fat || 0)}
                                                    </Text>
                                                    <Text style={{ fontSize: 10, color: '#94a3b8' }}>/100g</Text>
                                                </View>
                                            </View>

                                            {/* Recipe badge */}
                                            {food.isComposite && (
                                                <View style={{ backgroundColor: '#16a34a', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginRight: 4 }}>
                                                    <Text style={{ fontSize: 8, fontWeight: '800', color: '#fff' }}>RECETA</Text>
                                                </View>
                                            )}

                                            {/* Add button */}
                                            <Ionicons name="add-circle" size={26} color="#d97706" />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* ═══ AI SECTION ═══ */}
                        {!showAI ? (
                            <TouchableOpacity
                                style={modalStyles.aiButton}
                                onPress={() => setShowAI(true)}
                            >
                                <Ionicons name="sparkles" size={18} color="#8b5cf6" />
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#8b5cf6' }}>Crear con IA</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={modalStyles.aiBox}>
                                <Text style={modalStyles.label}>Describe el combo que necesitas</Text>
                                <EnhancedTextInput
                                    containerStyle={modalStyles.input}
                                    style={{ fontSize: 14, color: '#1e293b' }}
                                    value={aiDesc}
                                    onChangeText={setAiDesc}
                                    placeholder="Ej: Desayuno alto en proteína para definición"
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                />
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        style={[modalStyles.actionBtn, { backgroundColor: '#8b5cf6', flex: 1, opacity: aiLoading ? 0.6 : 1 }]}
                                        onPress={handleAIGenerate}
                                        disabled={aiLoading}
                                    >
                                        {aiLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sparkles" size={16} color="#fff" />}
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{aiLoading ? 'Generando...' : 'Generar'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[modalStyles.actionBtn, { backgroundColor: '#f1f5f9' }]}
                                        onPress={() => setShowAI(false)}
                                    >
                                        <Text style={{ color: '#64748b', fontWeight: '600', fontSize: 14 }}>Cancelar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* ═══ ACTION BUTTONS ═══ */}
                        <View style={{ marginTop: 20, gap: 10 }}>
                            <TouchableOpacity
                                style={[modalStyles.actionBtn, { backgroundColor: '#d97706', opacity: saving ? 0.6 : 1 }]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{saving ? 'Guardando...' : 'Guardar Combo'}</Text>
                            </TouchableOpacity>

                            {isEditing && (
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        style={[modalStyles.actionBtn, { backgroundColor: '#f1f5f9', flex: 1 }]}
                                        onPress={() => { onDuplicate(initialData); onClose(); }}
                                    >
                                        <Ionicons name="copy-outline" size={18} color="#d97706" />
                                        <Text style={{ color: '#d97706', fontWeight: '600', fontSize: 14 }}>Duplicar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[modalStyles.actionBtn, { backgroundColor: '#fef2f2', flex: 1 }]}
                                        onPress={() => onDelete(initialData._id)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                        <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 14 }}>Eliminar</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        width: '100%',
        maxWidth: 520,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b',
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 6,
        marginTop: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },

    // ═══ TOTALS BAR ═══
    totalsBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fffbeb',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#fde68a',
    },

    // ═══ FOOD CARDS (MealCard-style) ═══
    foodCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#fde68a',
        overflow: 'hidden',
    },
    foodTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: 4,
        backgroundColor: '#fffdf7',
    },
    foodName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        marginRight: 8,
    },
    foodMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingBottom: 8,
        gap: 6,
    },
    foodPhoto: {
        width: 36,
        height: 36,
        borderRadius: 8,
    },
    foodPhotoPlaceholder: {
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    foodMacrosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    pctBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        minWidth: 32,
        alignItems: 'center',
    },
    pctText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
    },
    foodAmountText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#d97706',
        textAlign: 'center',
    },
    amountInputContainer: {
        width: 54,
        backgroundColor: '#fffbeb',
        borderRadius: 6,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    amountInputText: {
        fontSize: 14,
        color: '#d97706',
        textAlign: 'center',
        fontWeight: '700',
    },
    unitLabel: {
        fontSize: 10,
        color: '#d97706',
        fontWeight: '600',
        textDecorationLine: 'underline',
        textDecorationStyle: 'dotted',
    },

    // ═══ IMAGE SECTION ═══
    imageSection: {
        marginBottom: 12,
    },
    imagePreview: {
        width: '100%',
        height: 140,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
    },
    imageRemoveBtn: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 12,
    },
    imageTabs: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8,
    },
    imageTabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    imageTabActive: {
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a',
    },
    imageTabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94a3b8',
    },
    imageAutoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#faf5ff',
        borderWidth: 1.5,
        borderColor: '#ddd6fe',
    },
    imageAltBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },

    // ═══ EMPTY STATE ═══
    emptyFoods: {
        alignItems: 'center',
        paddingVertical: 24,
        gap: 8,
        backgroundColor: '#fafafa',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderStyle: 'dashed',
        marginBottom: 8,
    },

    // ═══ SEARCH BAR ═══
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginTop: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },

    // ═══ SEARCH RESULTS (card rows like SmartFoodDrawer) ═══
    searchResults: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
        overflow: 'hidden',
    },
    searchResultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    searchResultPhoto: {
        width: 32,
        height: 32,
        borderRadius: 6,
    },
    searchResultPhotoPlaceholder: {
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ═══ AI SECTION ═══
    aiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        marginTop: 8,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#ddd6fe',
        borderStyle: 'dashed',
    },
    aiBox: {
        backgroundColor: '#faf5ff',
        borderRadius: 12,
        padding: 14,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#ddd6fe',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    topBar: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        alignItems: 'center'
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        paddingHorizontal: 12, height: 44, borderRadius: 10,
        borderWidth: 1, borderColor: '#e2e8f0'
    },
    searchInputContainer: { flex: 1, marginLeft: 10 },
    searchInputText: { fontSize: 15 },
    iconButton: {
        width: 44, height: 44, borderRadius: 10, backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: '#e2e8f0'
    },
    iconButtonActive: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5'
    },
    badge: {
        position: 'absolute', top: -5, right: -5,
        backgroundColor: '#ef4444', width: 18, height: 18, borderRadius: 9,
        alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff'
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' }
});
