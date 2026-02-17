/**
 * FoodSearchModal.jsx
 * Modal de búsqueda inteligente de alimentos (Local + API)
 *
 * Features:
 * - Búsqueda fuzzy local (Fuse.js)
 * - Indicador de "Buscando en API..." si es necesario (simulado o prop)
 * - Filtros por Etiquetas (Desayuno, Proteína, etc.)
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    Modal,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    ScrollView,
    Keyboard,
    ActivityIndicator,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from './ui';
import Fuse from 'fuse.js';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// Componente de Item de Alimento (Versión Mini para Lista)
// ─────────────────────────────────────────────────────────────
const FoodSearchItem = React.memo(({ food, onSelect, isFavorite, onToggleFavorite }) => {
    const isApi = food.source === 'api';

    return (
        <TouchableOpacity
            style={styles.foodItem}
            onPress={() => onSelect(food)}
            activeOpacity={0.7}
        >
            <View style={styles.foodImageContainer}>
                {food.image ? (
                    <Image source={{ uri: food.image }} style={styles.foodImage} />
                ) : (
                    <View style={styles.foodImagePlaceholder}>
                        <Ionicons name="restaurant" size={16} color="#94a3b8" />
                    </View>
                )}
            </View>

            <View style={styles.foodInfo}>
                <Text style={styles.foodName} numberOfLines={1}>
                    {food.name}
                    {food.brand && <Text style={styles.foodBrand}> ({food.brand})</Text>}
                </Text>

                {/* Micros Summary */}
                <View style={styles.macrosRow}>
                    <Text style={styles.macroText}>🔥 {Math.round(food.nutrients.kcal)}</Text>
                    <Text style={[styles.macroText, { color: '#ef4444' }]}>P: {Math.round(food.nutrients.protein)}</Text>
                    <Text style={[styles.macroText, { color: '#3b82f6' }]}>C: {Math.round(food.nutrients.carbs)}</Text>
                    <Text style={[styles.macroText, { color: '#eab308' }]}>G: {Math.round(food.nutrients.fat)}</Text>
                </View>
            </View>

            {isApi && (
                <View style={styles.apiBadge}>
                    <Ionicons name="cloud-download" size={12} color="#3b82f6" />
                </View>
            )}

            {/* Favorite Button */}
            <TouchableOpacity
                onPress={(e) => {
                    e.stopPropagation?.();
                    onToggleFavorite?.(food);
                }}
                style={styles.favBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={18}
                    color={isFavorite ? '#ef4444' : '#cbd5e1'}
                />
            </TouchableOpacity>
        </TouchableOpacity>
    );
});
FoodSearchItem.displayName = 'FoodSearchItem';

// ─────────────────────────────────────────────────────────────
// Chip de Filtro
// ─────────────────────────────────────────────────────────────
const FilterChip = React.memo(({ label, isActive, onPress }) => (
    <TouchableOpacity
        style={[styles.chip, isActive && styles.chipActive]}
        onPress={onPress}
        activeOpacity={0.8}
    >
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
            {label}
        </Text>
    </TouchableOpacity>
));
FilterChip.displayName = 'FilterChip';

// ─────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────
const FoodSearchModal = ({
    visible,
    onClose,
    onSelect,
    foods = [], // Local foods
    onSearchApi, // Function to trigger external API search (optional)
    isLoadingApi = false,
    onToggleFavorite, // ❤️ Favorite toggle handler
    favoriteIds = new Set(), // ❤️ Set of favorite food IDs
}) => {
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('TODO');
    const inputRef = useRef(null);

    // Reset y autofocus
    useEffect(() => {
        if (visible) {
            setTimeout(() => inputRef.current?.focus(), 300);
        } else {
            setQuery('');
            setActiveFilter('TODO');
        }
    }, [visible]);

    // Configurar Fuse
    const fuse = useMemo(() => {
        return new Fuse(foods, {
            keys: ['name', 'brand', 'tags'],
            threshold: 0.4,
        });
    }, [foods]);

    // Filtrar resultados (Logic: Local First)
    const filteredResults = useMemo(() => {
        let results = foods;

        if (query.length >= 2) {
            results = fuse.search(query).map(r => r.item);
        }

        if (activeFilter !== 'TODO') {
            results = results.filter(f => f.tags && f.tags.includes(activeFilter));
        }

        return results;
    }, [query, activeFilter, foods, fuse]);

    // Trigger API search if local results are few
    useEffect(() => {
        if (query.length > 2 && filteredResults.length < 5 && onSearchApi) {
            const timeout = setTimeout(() => {
                onSearchApi(query);
            }, 800); // Debounce API call
            return () => clearTimeout(timeout);
        }
    }, [query, filteredResults.length, onSearchApi]);

    const FILTERS = ['TODO', 'Desayuno', 'Comida', 'Cena', 'Snack', 'Vegano', 'Alto Proteína', 'Sin Gluten'];

    const handleSelect = useCallback((food) => {
        onSelect(food);
        onClose();
        Keyboard.dismiss();
    }, [onSelect, onClose]);

    const renderItem = useCallback(({ item }) => (
        <FoodSearchItem
            food={item}
            onSelect={handleSelect}
            isFavorite={favoriteIds.has(item._id) || item.isFavorite}
            onToggleFavorite={onToggleFavorite}
        />
    ), [handleSelect, favoriteIds, onToggleFavorite]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Buscar Alimento</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#374151" />
                    </TouchableOpacity>
                </View>

                {/* Barra de Búsqueda */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
                    <EnhancedTextInput
                        ref={inputRef}
                        style={styles.searchInputText}
                        containerStyle={styles.searchInputContainer}
                        placeholder="Pollo, Arroz, Manzana..."
                        placeholderTextColor="#9ca3af"
                        value={query}
                        onChangeText={setQuery}
                        autoCapitalize="sentences"
                        returnKeyType="search"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
                            <Ionicons name="close-circle" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filtros */}
                <View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipsContent}
                        style={{ maxHeight: 50 }}
                    >
                        {FILTERS.map(filter => (
                            <FilterChip
                                key={filter}
                                label={filter}
                                isActive={activeFilter === filter}
                                onPress={() => setActiveFilter(filter)}
                            />
                        ))}
                    </ScrollView>
                </View>

                {/* Lista de Resultados */}
                <View style={styles.listContainer}>
                    {isLoadingApi && (
                        <View style={{ padding: 10, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#667eea" />
                            <Text style={{ fontSize: 10, color: '#94a3b8' }}>Buscando en API global...</Text>
                        </View>
                    )}

                    <FlatList
                        data={filteredResults}
                        renderItem={renderItem}
                        keyExtractor={(item) => item._id || Math.random().toString()}
                        contentContainerStyle={styles.listContent}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                        ListEmptyComponent={
                            !isLoadingApi ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="nutrition-outline" size={48} color="#d1d5db" />
                                    <Text style={styles.emptyTitle}>No encontrado</Text>
                                    <Text style={styles.emptySubtitle}>
                                        Intenta buscar otra cosa o crea un nuevo plato.
                                    </Text>
                                </View>
                            ) : null
                        }
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        backgroundColor: '#fff',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    closeBtn: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        height: 48,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInputContainer: {
        flex: 1,
    },
    searchInputText: {
        fontSize: 16,
        color: '#111827',
    },
    clearBtn: {
        padding: 4,
    },
    chipsContent: {
        paddingHorizontal: 16,
        gap: 8,
        paddingBottom: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipActive: {
        backgroundColor: '#1e293b',
        borderColor: '#1e293b',
    },
    chipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    chipTextActive: {
        color: '#fff',
    },
    listContainer: {
        flex: 1,
        backgroundColor: '#fff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
    listContent: {
        paddingBottom: 40,
    },
    foodItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    foodImageContainer: {
        width: 40,
        height: 40,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        overflow: 'hidden',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    foodImage: {
        width: '100%',
        height: '100%',
    },
    foodImagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    foodInfo: {
        flex: 1,
    },
    foodName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    foodBrand: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '400',
    },
    macrosRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 2,
    },
    macroText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
    },
    apiBadge: {
        marginLeft: 8,
        padding: 4,
        backgroundColor: '#eff6ff',
        borderRadius: 4,
    },
    favBtn: {
        marginLeft: 8,
        padding: 4,
    },
    initialStateContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    initialStateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
    },
    initialStateTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    clearHistoryBtn: {
        fontSize: 12,
        color: '#ef4444',
        fontWeight: '600',
    },
    separator: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginLeft: 68, // Offset by image width + margin
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyTitle: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
    },
    emptySubtitle: {
        marginTop: 8,
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
    },
});

export default FoodSearchModal;
