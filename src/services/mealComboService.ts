/**
 * mealComboService.ts
 *
 * Service for managing Meal Combos (reusable meal presets).
 * Follows the same token/API pattern as foodService.ts.
 */

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app').replace(/\/+$/, '') + '/api';

// ─────────────────────────────────────────────────────────
// TOKEN HELPER
// ─────────────────────────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenTs = 0;
const TOKEN_CACHE_TTL = 60_000;

const getToken = async (): Promise<string | null> => {
    if (_cachedToken && Date.now() - _tokenTs < TOKEN_CACHE_TTL) return _cachedToken;
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    _cachedToken = await AsyncStorage.getItem('totalgains_token');
    _tokenTs = Date.now();
    return _cachedToken;
};

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────
export interface ComboFood {
    name: string;
    amount: number;
    unit: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    sourceType?: string;
    sourceId?: string;
    foodId?: string;
    image?: string;
    isRecipe?: boolean;
    isComposite?: boolean;
    subIngredients?: any[];
}

export interface ComboSupplement {
    name: string;
    amount: number;
    unit: string;
    dosage?: string;
    timing?: string;
}

export interface MealCombo {
    _id: string;
    name: string;
    description?: string;
    notes?: string;
    ownerId: string;
    category: string;
    tags: string[];
    foods: ComboFood[];
    supplements: ComboSupplement[];
    totals: {
        kcal: number;
        protein: number;
        carbs: number;
        fat: number;
    };
    image?: string;
    isFavorite: boolean;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
}

// ─────────────────────────────────────────────────────────
// CACHE (30s TTL)
// ─────────────────────────────────────────────────────────
const CACHE_TTL = 30_000;
const comboCache = new Map<string, { data: MealCombo[]; ts: number }>();

const getCached = (key: string): MealCombo[] | null => {
    const entry = comboCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) {
        comboCache.delete(key);
        return null;
    }
    return entry.data;
};

export const clearComboCache = () => {
    comboCache.clear();
};

// ─────────────────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────────────────

/**
 * Search combos (for SmartFoodDrawer integration)
 */
export const searchCombos = async (
    query: string = '',
    options: { category?: string } = {}
): Promise<MealCombo[]> => {
    const cacheKey = `combo:${query}:${options.category || 'all'}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const token = await getToken();
        if (!token) return [];

        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (options.category) params.set('category', options.category);

        const res = await fetch(`${API_BASE_URL}/meal-combos/search?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return [];

        const data = await res.json();
        const combos = data.combos || [];

        comboCache.set(cacheKey, { data: combos, ts: Date.now() });
        return combos;

    } catch (error) {
        console.error('[mealComboService] searchCombos error:', error);
        return [];
    }
};

/**
 * List all combos (for management screen)
 */
export const listCombos = async (
    options: { category?: string; favorite?: boolean } = {}
): Promise<MealCombo[]> => {
    try {
        const token = await getToken();
        if (!token) return [];

        const params = new URLSearchParams();
        if (options.category) params.set('category', options.category);
        if (options.favorite) params.set('favorite', 'true');

        const res = await fetch(`${API_BASE_URL}/meal-combos?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return [];

        const data = await res.json();
        return data.combos || [];

    } catch (error) {
        console.error('[mealComboService] listCombos error:', error);
        return [];
    }
};

/**
 * Create a new combo
 */
export const createCombo = async (comboData: {
    name: string;
    description?: string;
    notes?: string;
    category?: string;
    tags?: string[];
    foods: ComboFood[];
    supplements?: ComboSupplement[];
    image?: string;
}): Promise<MealCombo | null> => {
    try {
        const token = await getToken();
        if (!token) return null;

        const res = await fetch(`${API_BASE_URL}/meal-combos`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(comboData)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error creating combo');
        }

        const data = await res.json();
        clearComboCache();
        return data.combo;

    } catch (error) {
        console.error('[mealComboService] createCombo error:', error);
        throw error;
    }
};

/**
 * Save existing meal option as combo
 */
export const saveFromMeal = async (mealData: {
    name: string;
    category?: string;
    foods: any[];
    supplements?: any[];
    image?: string;
}): Promise<MealCombo | null> => {
    try {
        const token = await getToken();
        if (!token) return null;

        const res = await fetch(`${API_BASE_URL}/meal-combos/from-meal`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mealData)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error saving combo from meal');
        }

        const data = await res.json();
        clearComboCache();
        return data.combo;

    } catch (error) {
        console.error('[mealComboService] saveFromMeal error:', error);
        throw error;
    }
};

/**
 * Update an existing combo
 */
export const updateCombo = async (
    id: string,
    updates: Partial<{
        name: string;
        description: string;
        notes: string;
        category: string;
        tags: string[];
        foods: ComboFood[];
        supplements: ComboSupplement[];
        image: string;
    }>
): Promise<MealCombo | null> => {
    try {
        const token = await getToken();
        if (!token) return null;

        const res = await fetch(`${API_BASE_URL}/meal-combos/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error updating combo');
        }

        const data = await res.json();
        clearComboCache();
        return data.combo;

    } catch (error) {
        console.error('[mealComboService] updateCombo error:', error);
        throw error;
    }
};

/**
 * Delete a combo
 */
export const deleteCombo = async (id: string): Promise<boolean> => {
    try {
        const token = await getToken();
        if (!token) return false;

        const res = await fetch(`${API_BASE_URL}/meal-combos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return false;

        clearComboCache();
        return true;

    } catch (error) {
        console.error('[mealComboService] deleteCombo error:', error);
        return false;
    }
};

/**
 * Toggle favorite on a combo
 */
export const toggleComboFavorite = async (id: string): Promise<{ isFavorite: boolean } | null> => {
    try {
        const token = await getToken();
        if (!token) return null;

        const res = await fetch(`${API_BASE_URL}/meal-combos/${id}/favorite`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return null;

        const data = await res.json();
        clearComboCache();
        return { isFavorite: data.combo?.isFavorite ?? false };

    } catch (error) {
        console.error('[mealComboService] toggleFavorite error:', error);
        return null;
    }
};

/**
 * Increment usage count (fire and forget)
 */
export const trackComboUsage = async (id: string): Promise<void> => {
    try {
        const token = await getToken();
        if (!token) return;

        fetch(`${API_BASE_URL}/meal-combos/${id}/use`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {}); // Fire and forget

    } catch {
        // Silent fail
    }
};

/**
 * AI-generate a combo from a description
 */
export const aiGenerateCombo = async (
    description: string,
    category?: string
): Promise<{
    name: string;
    description: string;
    category: string;
    foods: ComboFood[];
    tags: string[];
} | null> => {
    try {
        const token = await getToken();
        if (!token) return null;

        const res = await fetch(`${API_BASE_URL}/meal-combos/ai-generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ description, category })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error generating combo with AI');
        }

        const data = await res.json();
        return data.combo;

    } catch (error) {
        console.error('[mealComboService] aiGenerateCombo error:', error);
        throw error;
    }
};
