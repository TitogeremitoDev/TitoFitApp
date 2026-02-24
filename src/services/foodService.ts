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
const USE_BACKEND = true;
const USE_OPENFOODFACTS = true;
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app').replace(/\/+$/, '') + '/api';

// ─────────────────────────────────────────────────────────
// SEARCH CACHE (30s TTL, avoids repeated API calls)
// ─────────────────────────────────────────────────────────
const CACHE_TTL = 30_000; // 30 seconds
const searchCache = new Map<string, { data: FoodItem[]; ts: number }>();

const getCached = (key: string): FoodItem[] | null => {
    const entry = searchCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) {
        searchCache.delete(key);
        return null;
    }
    return entry.data;
};

const setCache = (key: string, data: FoodItem[]) => {
    searchCache.set(key, { data, ts: Date.now() });
    // Keep cache bounded (max 50 entries)
    if (searchCache.size > 50) {
        const oldest = searchCache.keys().next().value;
        if (oldest) searchCache.delete(oldest);
    }
};

// ─────────────────────────────────────────────────────────
// TOKEN HELPER (read once per search session, not per layer)
// ─────────────────────────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenTs = 0;
const TOKEN_CACHE_TTL = 60_000; // 1 minute

const getToken = async (): Promise<string | null> => {
    if (_cachedToken && Date.now() - _tokenTs < TOKEN_CACHE_TTL) return _cachedToken;
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    _cachedToken = await AsyncStorage.getItem('totalgains_token');
    _tokenTs = Date.now();
    return _cachedToken;
};

export const invalidateTokenCache = () => {
    _cachedToken = null;
    _tokenTs = 0;
};

export const clearSearchCache = () => {
    searchCache.clear();
};

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
    // Recipe fields
    isComposite?: boolean;
    instructions?: string;
    prepTime?: number;
    ingredients?: any[]; // Snapshot of ingredients
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
    options: {
        layer?: 'LOCAL' | 'CLOUD' | 'API' | 'ALL' | 'RECIPE' | 'RAW';
        tag?: string;
        skipExternal?: boolean;
    } = {}
): Promise<FoodItem[]> => {
    const { layer = 'ALL', tag, skipExternal = false } = options;
    const normalizedQuery = query.toLowerCase().trim();

    // Check cache first
    const cacheKey = `${normalizedQuery}|${layer}|${tag || ''}|${skipExternal}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    let results: FoodItem[] = [];

    // ───────────────────────────────────────────────────────
    // 1. LOCAL LAYER (Always first, instant, offline)
    // ───────────────────────────────────────────────────────
    if (layer === 'ALL' || layer === 'LOCAL') {
        let localResults = LOCAL_FOODS as FoodItem[];

        if (normalizedQuery) {
            localResults = localResults.filter(f =>
                f.name.toLowerCase().includes(normalizedQuery)
            );
        }

        if (tag) {
            localResults = localResults.filter(f => f.tags?.includes(tag));
        }

        results.push(...localResults);
    }

    // ───────────────────────────────────────────────────────
    // 2. CLOUD LAYER (Backend MongoDB)
    // ───────────────────────────────────────────────────────
    if ((layer === 'ALL' || layer === 'CLOUD' || layer === 'RECIPE' || layer === 'RAW') && USE_BACKEND) {
        try {
            const params = new URLSearchParams();
            if (normalizedQuery) params.append('q', normalizedQuery);
            if (tag) params.append('tag', tag);
            if (layer !== 'ALL') params.append('layer', layer);
            params.append('limit', '50');

            const token = await getToken();

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
    // 3. API LAYER (OpenFoodFacts via Backend Proxy)
    // ───────────────────────────────────────────────────────
    if (!skipExternal && (layer === 'ALL' || layer === 'API') && USE_OPENFOODFACTS && normalizedQuery) {
        if (results.length < 10) {
            try {
                const apiResults = await searchExternalFoods(normalizedQuery);
                results.push(...apiResults);
            } catch (error) {
                console.error('[API] External search failed:', error);
            }
        }
    }

    // ───────────────────────────────────────────────────────
    // 4. FILTER 0-KCAL JUNK + DEDUPLICATE & SORT
    // ───────────────────────────────────────────────────────
    const SPICE_TAGS = ['Especia', 'Condimento', 'spices', 'condiments', 'seasonings', 'herbs', 'sauces'];
    results = results.filter(f => {
        const kcal = f.nutrients?.kcal || 0;
        if (kcal > 0) return true;
        return f.tags?.some(t => SPICE_TAGS.includes(t)) || false;
    });
    results = deduplicateByName(results);
    results = sortByPriority(results);

    // Store in cache
    setCache(cacheKey, results);

    return results;
};

// ─────────────────────────────────────────────────────────
// EXPORTED EXTERNAL SEARCH (Direct OpenFoodFacts)
// Calls OFF directly from the client (browser/app).
// Backend proxy removed — Koyeb IPs are blocked by OFF.
// Atwater validation + 0-kcal filter are in searchOpenFoodFacts.
// ─────────────────────────────────────────────────────────
export const searchExternalFoods = async (query: string, signal?: AbortSignal): Promise<FoodItem[]> => {
    if (!USE_OPENFOODFACTS || !query.trim()) return [];

    try {
        return await searchOpenFoodFacts(query, signal);
    } catch (e) {
        return [];
    }
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

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Error importando alimento (${response.status})`);
    }

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

    const token = await getToken();

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

    // Invalidate search cache so lists show the new/updated food immediately
    searchCache.clear();

    return data.food || data;
};

// ─────────────────────────────────────────────────────────
// SAVE FROM PLAN (Reverse Clone)
// ─────────────────────────────────────────────────────────
export const saveFoodFromPlan = async (payload: {
    name: string;
    items: any[];
    instructions?: string;
    image?: string;
}): Promise<FoodItem> => {
    const token = await getToken();

    if (!token) throw new Error('No hay sesión activa');

    const response = await fetch(`${API_BASE_URL}/foods/save-from-plan`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar receta desde plan');
    }

    const data = await response.json();
    return data.food;
};

// ─────────────────────────────────────────────────────────
// TOGGLE FAVORITE (Clone-on-Favorite)
// ─────────────────────────────────────────────────────────
export const toggleFavorite = async (food: FoodItem): Promise<{ food: FoodItem | null; action: string }> => {
    const token = await getToken();

    if (!token) {
        throw new Error('No hay sesión activa');
    }

    // Validate _id for CLOUD layer (must be valid MongoDB ObjectId)
    const isValidObjectId = (id: any): boolean =>
        typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);

    let body: any;

    if (food.layer === 'CLOUD' && isValidObjectId(food._id)) {
        body = { layer: 'CLOUD', foodId: food._id };
    } else {
        // For LOCAL/API or invalid _id: send foodData WITHOUT _id
        // Backend will create a new document or match by name
        const { _id, ...cleanData } = food as any;
        body = { layer: food.layer || 'LOCAL', foodData: cleanData };
    }

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

    searchCache.clear();
    return response.json();
};

// ─────────────────────────────────────────────────────────
// GET FOOD BY ID
// ─────────────────────────────────────────────────────────
export const getFoodById = async (id: string): Promise<FoodItem | null> => {
    if (!USE_BACKEND || !id) return null;

    const token = await getToken();
    if (!token) return null;

    const response = await fetch(`${API_BASE_URL}/foods/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return null;
    return response.json();
};

// ─────────────────────────────────────────────────────────
// DELETE FOOD
// ─────────────────────────────────────────────────────────
export const deleteFood = async (id: string): Promise<boolean> => {
    if (!USE_BACKEND) return true;

    const token = await getToken();

    if (!token) throw new Error('No hay sesión activa');

    const response = await fetch(`${API_BASE_URL}/foods/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al eliminar alimento');
    }

    searchCache.clear();
    return true;
};

// ─────────────────────────────────────────────────────────
// GET FAVORITES
// ─────────────────────────────────────────────────────────
export const getFavorites = async (): Promise<FoodItem[]> => {
    const token = await getToken();

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

const SPICE_CATEGORIES = ['spices', 'condiments', 'seasonings', 'herbs', 'sauces', 'vinegars', 'mustards', 'salt', 'pepper'];

const isSpiceOrCondiment = (product: any): boolean => {
    const categories = product.categories_tags || [];
    return categories.some((cat: string) =>
        SPICE_CATEGORIES.some(spice => cat.toLowerCase().includes(spice))
    );
};

const searchOpenFoodFacts = async (query: string, externalSignal?: AbortSignal): Promise<FoodItem[]> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout (OFF can be very slow)

    // If caller passes an AbortSignal, link it so cancellation propagates
    if (externalSignal) {
        if (externalSignal.aborted) { clearTimeout(timeoutId); return []; }
        externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    // Use Spanish regional endpoint (faster from ES/LATAM) with v2-compatible search
    const params = new URLSearchParams({
        search_terms: query,
        search_simple: '1',
        action: 'process',
        json: '1',
        page_size: '8',
        fields: 'product_name,product_name_es,nutriments,image_front_small_url,image_url,code,brands,categories_tags'
    });
    const url = `https://es.openfoodfacts.org/cgi/search.pl?${params}`;

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await response.json();

        if (!data.products) return [];

        const filtered = data.products
            .filter((p: any) => {
                const kcal = p.nutriments?.['energy-kcal_100g'] || 0;
                const protein = p.nutriments?.proteins_100g || 0;
                const carbs = p.nutriments?.carbohydrates_100g || 0;
                const fat = p.nutriments?.fat_100g || 0;

                if (!p.product_name) return false;

                // Filter 0-kcal (except spices)
                if (kcal === 0 && !isSpiceOrCondiment(p)) return false;

                // Filter foods with all macros at 0 (incomplete data)
                if (kcal > 0 && protein === 0 && carbs === 0 && fat === 0) return false;

                // Atwater sanity check: expected kcal vs reported kcal (40% tolerance)
                if (kcal > 0 && (protein + carbs + fat) > 0) {
                    const expectedKcal = (protein * 4) + (carbs * 4) + (fat * 9);
                    if (expectedKcal > 0 && Math.abs(kcal - expectedKcal) / expectedKcal > 0.4) return false;
                }

                return true;
            })
            .slice(0, 5);

        return filtered.map((p: any) => ({
            _id: `off_${p.code}`,
            name: p.product_name_es || p.product_name,
            brand: p.brands,
            layer: 'API' as const,
            isSystem: true,
            nutrients: {
                kcal: Math.round(p.nutriments?.['energy-kcal_100g'] || 0),
                protein: Math.round((p.nutriments?.proteins_100g || 0) * 10) / 10,
                carbs: Math.round((p.nutriments?.carbohydrates_100g || 0) * 10) / 10,
                fat: Math.round((p.nutriments?.fat_100g || 0) * 10) / 10,
                fiber: Math.round((p.nutriments?.fiber_100g || 0) * 10) / 10,
            },
            image: p.image_front_small_url || p.image_url,
            tags: p.categories_tags?.slice(0, 3).map((t: string) => t.replace('en:', '')) || []
        }));
    } catch (e: any) {
        clearTimeout(timeoutId);
        // Silently ignore AbortError (user typed new query) and timeouts
        return [];
    }
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
