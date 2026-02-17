import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert,
    ActivityIndicator,
    useWindowDimensions,
    Platform,
    SafeAreaView,
    ScrollView,
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../../../components/ui';
import { StatusBar } from 'expo-status-bar';
import { Stack, router, useFocusEffect } from 'expo-router';
import CoachHeader from '../components/CoachHeader';
import FoodListCard from '../../../components/FoodListCard';
import FoodGridCard from '../../../components/FoodGridCard';
import FoodMiniCard from '../../../components/FoodMiniCard';
import FoodCreatorModal from '../../../components/FoodCreatorModal';
import FoodLibrarySidebar, { FilterState } from '../../../components/FoodLibrarySidebar';

import { searchFoods, saveFood, deleteFood, getDiscoveryFoods, LAYER_ICONS, FoodItem } from '../../../src/services/foodService';

export default function FoodLibraryScreen() {
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 720;

    // Data State
    const [foods, setFoods] = useState<FoodItem[]>([]); // Search Results
    const [initialFoods, setInitialFoods] = useState<FoodItem[]>([]); // Discovery Data
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    // Filter & Sort State
    const [filters, setFilters] = useState<FilterState>({
        onlyFavorites: false,
        types: [],
        goals: [],
        macros: []
    });
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [sortBy, setSortBy] = useState<'recent' | 'calories_asc' | 'protein_desc' | 'name'>('recent');

    // View Mode (Ingredients vs Recipes)
    const [viewMode, setViewMode] = useState<'INGREDIENTS' | 'RECIPES'>('INGREDIENTS');

    // Modals
    const [creatorVisible, setCreatorVisible] = useState(false);
    const [editingFood, setEditingFood] = useState<FoodItem | null>(null);



    // 1. Refresh data on screen focus (syncs favorites from other screens)
    useFocusEffect(
        useCallback(() => {
            loadDiscoveryData();
        }, [])
    );

    const loadDiscoveryData = async () => {
        try {
            const data = await searchFoods("");
            setInitialFoods(data as FoodItem[]);
        } catch (e) { console.log(e); }
    };

    // 2. Search Handler
    useEffect(() => {
        if (searchQuery.trim().length > 0) {
            loadFoods(searchQuery);
        } else {
            setFoods([]);
        }
    }, [searchQuery]);

    const loadFoods = async (query: string) => {
        setLoading(true);
        try {
            // 1. Fast Load (Local + Cloud)
            const internalResults = await searchFoods(query, { skipExternal: true });
            setFoods(internalResults);

            setLoading(false); // Show results immediately

            // 2. Slow Load (External API - Background)
            // Only trigger if we have few results
            if (internalResults.length < 10) {
                const { searchExternalFoods } = require('../../../src/services/foodService');
                const externalResults = await searchExternalFoods(query);

                if (externalResults.length > 0) {
                    setFoods(prev => {
                        // Deduplicate (External shouldn't override Local/Cloud if exists)
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
    // 🧠 MAIN FILTERING ENGINE
    // ─────────────────────────────────────────────────────────
    const processedFoods = useMemo(() => {
        // 1. Source: If search is active use 'foods', else 'initialFoods'
        let source = searchQuery.length > 0 ? foods : initialFoods;

        // 2. Filter
        let result = source.filter(item => {
            // Favorites
            if (filters.onlyFavorites) {
                // Mock logic: return false or check a future isFavorite field
                return item.isFavorite === true;
            }

            // View Mode Filter (Recipes vs Ingredients)
            // Backend sends 'isComposite' boolean.
            if (viewMode === 'RECIPES') {
                if (!item.isComposite) return false;
            } else {
                // Ingredients (Raw)
                if (item.isComposite) return false;
            }

            // Types (OR Logic)
            if (filters.types.length > 0) {
                const hasType = item.tags?.some(t => filters.types.includes(t));
                if (!hasType) return false;
            }

            // Goals (OR Logic mostly)
            if (filters.goals.length > 0) {
                const hasGoal = item.tags?.some(t => filters.goals.includes(t));
                if (!hasGoal) return false;
            }

            // Macros (OR Logic)
            if (filters.macros.length > 0) {
                const hasMacro = item.tags?.some(t => filters.macros.includes(t));
                if (!hasMacro) return false;
            }

            return true;
        });

        // 3. Sort
        result.sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'calories_asc') return a.nutrients.kcal - b.nutrients.kcal;
            if (sortBy === 'protein_desc') return b.nutrients.protein - a.nutrients.protein;
            // Recent (default) - assuming seeded order is "recent" or adding timestamp later
            return 0;
        });

        return result;
    }, [foods, initialFoods, searchQuery, filters, sortBy, viewMode]);

    // Handlers
    const handleCreateNew = () => { setEditingFood(null); setCreatorVisible(true); };
    const handleEdit = (food: FoodItem) => { setEditingFood(food); setCreatorVisible(true); };
    const handleSaveFood = async (foodData: any) => {
        setLoading(true);
        try {
            const savedFood = await saveFood(foodData);

            // Helper to Upsert (Update if exists, Insert if new)
            const upsertFood = (list: FoodItem[]) => {
                const index = list.findIndex(f => f._id === savedFood._id);
                if (index !== -1) {
                    // Update existing
                    const newList = [...list];
                    newList[index] = savedFood as FoodItem;
                    return newList;
                } else {
                    // Insert new
                    return [savedFood as FoodItem, ...list];
                }
            };

            setFoods(prev => upsertFood(prev));
            setInitialFoods(prev => upsertFood(prev));

            setCreatorVisible(false);
            Alert.alert("Guardado", "El plato se ha guardado correctamente.");
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
            Alert.alert("Eliminado", "El alimento ha sido eliminado.");
        } catch (error: any) {
            Alert.alert("Error", error.message || "No se pudo eliminar");
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

    // Toggle Favorite (Clone-on-Favorite for LOCAL/API)
    const handleToggleFavorite = async (food: FoodItem) => {
        try {
            const { toggleFavorite } = require('../../../src/services/foodService');
            const result = await toggleFavorite(food);

            if (result.action === 'cloned_and_favorited') {
                // Cloned: add the new CLOUD item to both lists
                setInitialFoods(prev => [result.food, ...prev]);
                setFoods(prev => [result.food, ...prev]);
            } else if (result.action === 'removed_deleted' || !result.food) {
                // Zombie cleanup: backend hard-deleted the food, remove from lists
                setFoods(prev => prev.filter(f => f._id !== food._id));
                setInitialFoods(prev => prev.filter(f => f._id !== food._id));
            } else {
                // Update the food's isFavorite status in lists
                const updateFavorite = (list: FoodItem[]) =>
                    list.map(f => f._id === result.food._id ? { ...f, isFavorite: result.food.isFavorite } : f);

                setFoods(updateFavorite);
                setInitialFoods(updateFavorite);
            }
        } catch (error) {
            console.error('Toggle favorite error:', error);
            Alert.alert('Error', 'No se pudo marcar como favorito');
        }
    };

    // Open food in modal for viewing/editing
    const handleOpenFood = (food: FoodItem) => {
        setEditingFood(food);
        setCreatorVisible(true);
    };

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
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {/* New Recipe Button */}
                        <TouchableOpacity
                            onPress={() => router.push('/(coach)/food-library/create-recipe')}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#fff',
                                borderWidth: 1,
                                borderColor: '#e2e8f0',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 20,
                                gap: 4
                            }}
                        >
                            <Text style={{ fontSize: 14 }}>🍲</Text>
                            <Text style={{ color: '#1e293b', fontWeight: '600', fontSize: 13 }}>
                                Crear Receta
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleCreateNew}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#eff6ff',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 20,
                                gap: 4
                            }}
                        >
                            <Ionicons name="add" size={18} color="#3b82f6" />
                            <Text style={{ color: '#3b82f6', fontWeight: '600', fontSize: 13 }}>
                                Alimento
                            </Text>
                        </TouchableOpacity>
                    </View>
                }
            />

            {/* TABS (Ingredients vs Recipes) */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
                <TouchableOpacity
                    onPress={() => setViewMode('INGREDIENTS')}
                    style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
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
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
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
            </View>

            <View style={{ flex: 1, flexDirection: 'row' }}>

                {/* SIDEBAR (Desktop only) */}
                {isLargeScreen && (
                    <FoodLibrarySidebar
                        filters={filters}
                        onUpdate={setFilters}
                    />
                )}

                {/* MAIN CONTENT */}
                <View style={{ flex: 1 }}>

                    {/* Top Bar: Search + Filter Toggle (Mobile) + Sort */}
                    <View style={styles.topBar}>
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color="#94a3b8" />
                            <EnhancedTextInput
                                containerStyle={styles.searchInputContainer}
                                style={styles.searchInputText}
                                placeholder="Buscar (e.g. Arroz, Pollo)..."
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

                        {/* Mobile Filter Button */}
                        {!isLargeScreen && (
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

                        {/* Sort Dropdown Sim (Button for now) */}
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => {
                                // Simple toggle sort for demo
                                if (sortBy === 'recent') setSortBy('calories_asc');
                                else if (sortBy === 'calories_asc') setSortBy('protein_desc');
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
                        <Text style={{ color: '#4f46e5', fontSize: 13, fontWeight: '600' }}>
                            {sortBy === 'calories_asc' ? 'Menos Calorías' : sortBy === 'protein_desc' ? 'Más Proteína' : 'Más Recientes'}
                        </Text>
                    </View>

                    {/* CONTENT GRID */}
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, paddingBottom: 100 }}>
                        {/* 2. Favorites Carousel (Only if showing 'All' and not searching) */}
                        {searchQuery === '' && !filters.onlyFavorites && initialFoods.some(f => f.isFavorite) && (
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

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            {processedFoods.map((item) => (
                                <View key={item._id} style={{ width: isLargeScreen ? '33.33%' : '50%', padding: 6 }}>
                                    <FoodGridCard
                                        item={item}
                                        onPress={() => handleOpenFood(item)}
                                        isFavorite={item.isFavorite}
                                        onToggleFavorite={() => handleToggleFavorite(item)}
                                    />
                                </View>
                            ))}
                        </View>

                        {/* EMPTY STATE */}
                        {processedFoods.length === 0 && (
                            <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                                <Ionicons name="nutrition-outline" size={48} color="#cbd5e1" />
                                <Text style={{ marginTop: 16, fontSize: 16, color: '#64748b', textAlign: 'center' }}>
                                    Vaya, no hemos encontrado alimentos con esa combinación exacta.
                                </Text>
                                <TouchableOpacity onPress={() => setFilters({ onlyFavorites: false, types: [], goals: [], macros: [] })} style={{ marginTop: 12 }}>
                                    <Text style={{ color: '#4f46e5', fontWeight: '600' }}>Limpiar filtros</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
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

            {/* Creator Modal */}
            <FoodCreatorModal
                visible={creatorVisible}
                onClose={() => setCreatorVisible(false)}
                onSave={handleSaveFood}
                onDelete={handleDeleteFood}
                initialData={editingFood as any}
            />
        </SafeAreaView>
    );
}

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
