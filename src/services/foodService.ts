/**
 * foodService.ts (V2)
 * 
 * 3-Layer Architecture:
 * - LOCAL: Bundled JSON (50 items, always available offline)
 * - CLOUD: Backend MongoDB (System + Coach foods)
 * - API: OpenFoodFacts (Fallback, infinite catalog)
 */

import LOCAL_FOODS from '../constants/localFoods.json';

// ─────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────
const USE_BACKEND = true; // ✅ Connected to Koyeb
const USE_OPENFOODFACTS = true;
const API_BASE_URL = 'https://consistent-donna-titogeremito-29c943bc.koyeb.app/api';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────
export interface FoodItem {
    _id: string;
    name: string;
    brand?: string;
    layer: 'LOCAL' | 'CLOUD' | 'API';
    isSystem: boolean;
    ownerId?: string;
    nutrients: {
        kcal: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber?: number;
    };
    image?: string;
    tags?: string[];
    usageCount?: number;
    isFavorite?: boolean;
    servingSize?: {
        unit: string;    // Ej: "Unidad", "Rebanada", "Scoop"
        weight: number;  // Equivalencia en gramos
    };
}

// ─────────────────────────────────────────────────────────
// LAYER ICONS (For UI reference)
// ─────────────────────────────────────────────────────────
export const LAYER_ICONS = {
    LOCAL: '📦',
    CLOUD: '☁️',
    API: '🌐'
};

// ─────────────────────────────────────────────────────────
// SEARCH FOODS (Hybrid 3-Layer)
// ─────────────────────────────────────────────────────────
export const searchFoods = async (
    query: string,
    options: { layer?: 'LOCAL' | 'CLOUD' | 'API' | 'ALL'; tag?: string } = {}
): Promise<FoodItem[]> => {
    const { layer = 'ALL', tag } = options;
    const normalizedQuery = query.toLowerCase().trim();

    let results: FoodItem[] = [];

    // ───────────────────────────────────────────────────────
    // 1. LOCAL LAYER (Always first, instant, offline)
    // ───────────────────────────────────────────────────────
    if (layer === 'ALL' || layer === 'LOCAL') {
        let localResults = LOCAL_FOODS as FoodItem[];

        // Filter by query
        if (normalizedQuery) {
            localResults = localResults.filter(f =>
                f.name.toLowerCase().includes(normalizedQuery)
            );
        }

        // Filter by tag
        if (tag) {
            localResults = localResults.filter(f => f.tags?.includes(tag));
        }

        results.push(...localResults);
    }

    // ───────────────────────────────────────────────────────
    // 2. CLOUD LAYER (Backend MongoDB)
    // ───────────────────────────────────────────────────────
    if ((layer === 'ALL' || layer === 'CLOUD') && USE_BACKEND) {
        try {
            const params = new URLSearchParams();
            if (normalizedQuery) params.append('q', normalizedQuery);
            if (tag) params.append('tag', tag);

            // Get auth token
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const token = await AsyncStorage.getItem('totalgains_token');

            const response = await fetch(`${API_BASE_URL}/foods/search?${params}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await response.json();

            const cloudResults = (data.foods || []).map((f: any) => ({
                ...f,
                layer: 'CLOUD' as const
            }));

            results.push(...cloudResults);
        } catch (error) {
            console.error('[CLOUD] Search failed:', error);
        }
    }

    // ───────────────────────────────────────────────────────
    // 3. API LAYER (OpenFoodFacts - Fallback)
    // ───────────────────────────────────────────────────────
    if ((layer === 'ALL' || layer === 'API') && USE_OPENFOODFACTS && normalizedQuery) {
        // Only fetch if we have less than 10 local/cloud results
        if (results.length < 10) {
            try {
                const apiResults = await searchOpenFoodFacts(normalizedQuery);
                results.push(...apiResults);
            } catch (error) {
                console.error('[API] OpenFoodFacts failed:', error);
            }
        }
    }

    // ───────────────────────────────────────────────────────
    // 4. DEDUPLICATE & SORT
    // ───────────────────────────────────────────────────────
    results = deduplicateByName(results);
    results = sortByPriority(results);

    return results;
};

// ─────────────────────────────────────────────────────────
// GET DISCOVERY (Empty Query = Dashboard)
// ─────────────────────────────────────────────────────────
export const getDiscoveryFoods = async (): Promise<{
    favorites: FoodItem[];
    recent: FoodItem[];
    catalog: FoodItem[];
}> => {
    // For now, return LOCAL foods organized
    const allLocal = LOCAL_FOODS as FoodItem[];

    // Auto-enrich tags (Client-side simulation)
    const enriched = allLocal.map(f => enrichTags(f));

    return {
        favorites: [], // TODO: From user preferences
        recent: enriched.slice(0, 5), // TODO: From usage history
        catalog: enriched
    };
};

// ─────────────────────────────────────────────────────────
// IMPORT TO CLOUD (Copy API food to user's library)
// ─────────────────────────────────────────────────────────
export const importToCloud = async (food: FoodItem): Promise<FoodItem> => {
    if (!USE_BACKEND) {
        // Mock save
        return {
            ...food,
            _id: 'cloud_' + Date.now(),
            layer: 'CLOUD',
            isSystem: false,
            ownerId: 'me'
        };
    }

    const response = await fetch(`${API_BASE_URL}/foods/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(food)
    });

    return response.json();
};

// ─────────────────────────────────────────────────────────
// SAVE FOOD (Create or Update)
// ─────────────────────────────────────────────────────────
export const saveFood = async (foodData: Partial<FoodItem>): Promise<FoodItem> => {
    if (!USE_BACKEND) {
        // Mock save
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    ...foodData,
                    _id: foodData._id || 'cloud_' + Date.now(),
                    layer: 'CLOUD',
                    isSystem: false,
                    ownerId: 'me'
                } as FoodItem);
            }, 500);
        });
    }

    // Get auth token
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const token = await AsyncStorage.getItem('totalgains_token');

    if (!token) {
        throw new Error('No hay sesión activa');
    }

    const method = foodData._id ? 'PUT' : 'POST';
    const url = foodData._id
        ? `${API_BASE_URL}/foods/${foodData._id}`
        : `${API_BASE_URL}/foods`;

    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(foodData)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar alimento');
    }

    const data = await response.json();
    return data.food || data;
};

// ─────────────────────────────────────────────────────────
// TOGGLE FAVORITE (Clone-on-Favorite)
// ─────────────────────────────────────────────────────────
export const toggleFavorite = async (food: FoodItem): Promise<{ food: FoodItem | null; action: string }> => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const token = await AsyncStorage.getItem('totalgains_token');

    if (!token) {
        throw new Error('No hay sesión activa');
    }

    const body = food.layer === 'CLOUD'
        ? { layer: 'CLOUD', foodId: food._id }
        : { layer: food.layer, foodData: food };

    const response = await fetch(`${API_BASE_URL}/foods/favorite`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al marcar favorito');
    }

    return response.json();
};

// ─────────────────────────────────────────────────────────
// GET FAVORITES
// ─────────────────────────────────────────────────────────
export const getFavorites = async (): Promise<FoodItem[]> => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const token = await AsyncStorage.getItem('totalgains_token');

    if (!token) return [];

    const response = await fetch(`${API_BASE_URL}/foods/favorites`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.foods || [];
};

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

const searchOpenFoodFacts = async (query: string): Promise<FoodItem[]> => {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.products) return [];

    return data.products.map((p: any) => ({
        _id: `off_${p.code}`,
        name: p.product_name || 'Desconocido',
        brand: p.brands,
        layer: 'API' as const,
        isSystem: true,
        nutrients: {
            kcal: p.nutriments?.['energy-kcal_100g'] || 0,
            protein: p.nutriments?.proteins_100g || 0,
            carbs: p.nutriments?.carbohydrates_100g || 0,
            fat: p.nutriments?.fat_100g || 0,
            fiber: p.nutriments?.fiber_100g || 0,
        },
        image: p.image_front_small_url || p.image_url,
        tags: p.categories_tags?.slice(0, 3).map((t: string) => t.replace('en:', '')) || []
    }));
};

const enrichTags = (food: FoodItem): FoodItem => {
    const tags = [...(food.tags || [])];
    const { kcal, protein, carbs, fat } = food.nutrients;

    if (kcal < 100 && !tags.includes('DEFINICION')) tags.push('DEFINICION');
    if (kcal > 300 && !tags.includes('VOLUMEN')) tags.push('VOLUMEN');
    if (protein > 15 && !tags.includes('ALTA_PROTEINA')) tags.push('ALTA_PROTEINA');
    if (carbs < 5 && !tags.includes('LOW_CARB')) tags.push('LOW_CARB');
    if (fat < 3 && !tags.includes('BAJO_GRASA')) tags.push('BAJO_GRASA');

    return { ...food, tags: [...new Set(tags)] };
};

const deduplicateByName = (foods: FoodItem[]): FoodItem[] => {
    const seen = new Map<string, FoodItem>();

    for (const food of foods) {
        const key = food.name.toLowerCase().trim();
        // SHADOWING: CLOUD (user's clone) > LOCAL > API
        // This ensures user's favorited/cloned foods hide the originals
        if (!seen.has(key) || getPriority(food.layer) > getPriority(seen.get(key)!.layer)) {
            seen.set(key, food);
        }
    }

    return Array.from(seen.values());
};

const getPriority = (layer: string): number => {
    switch (layer) {
        case 'CLOUD': return 3;  // User's clones/favorites take priority
        case 'LOCAL': return 2;
        case 'API': return 1;
        default: return 0;
    }
};

const sortByPriority = (foods: FoodItem[]): FoodItem[] => {
    return foods.sort((a, b) => getPriority(b.layer) - getPriority(a.layer));
};
