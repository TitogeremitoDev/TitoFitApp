/**
 * Sistema Unificado de Unidades y Porciones
 * Usado en: SmartFoodDrawer, WeeklyMealPlanner, DailyMealList, RecipeWalkthroughModal
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSIONES BASE (factor = gramos por unidad)
// ═══════════════════════════════════════════════════════════════════════════
export const UNIT_CONVERSIONS = {
    gramos: { factor: 1, label: 'g', labelLong: 'Gramos' },
    g: { factor: 1, label: 'g', labelLong: 'Gramos' },
    ml: { factor: 1, label: 'ml', labelLong: 'Mililitros' },
    unidad: { factor: 100, label: 'ud', labelLong: 'Unidad' }, // Default, override with servingSize
    cucharada: { factor: 15, label: 'cda', labelLong: 'Cucharada' },
    cucharadita: { factor: 5, label: 'cdta', labelLong: 'Cucharadita' },
    taza: { factor: 200, label: 'taza', labelLong: 'Taza' },
    puñado: { factor: 30, label: 'puñado', labelLong: 'Puñado' },
    rebanada: { factor: 30, label: 'reb', labelLong: 'Rebanada' },
    scoop: { factor: 30, label: 'scoop', labelLong: 'Scoop' },
    ración: { factor: 100, label: 'ración', labelLong: 'Ración' },
    loncha: { factor: 20, label: 'loncha', labelLong: 'Loncha' },
    rodaja: { factor: 15, label: 'rodaja', labelLong: 'Rodaja' },
    diente: { factor: 5, label: 'diente', labelLong: 'Diente' },
    a_gusto: { factor: 0, label: 'Libre', labelLong: 'A gusto / Sin pesar' },
};

// ═══════════════════════════════════════════════════════════════════════════
// PESOS POR DEFECTO SEGÚN NOMBRE DEL ALIMENTO
// (cuando no hay servingSize disponible)
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_WEIGHTS_BY_NAME = {
    'huevo': 60,
    'clara': 33,
    'yema': 17,
    'manzana': 180,
    'plátano': 120,
    'naranja': 200,
    'kiwi': 75,
    'yogur': 125,
};

// ═══════════════════════════════════════════════════════════════════════════
// PLURALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════
const UNIT_PLURALS = {
    'unidad': 'unidades',
    'ración': 'raciones',
    'rebanada': 'rebanadas',
    'cucharada': 'cucharadas',
    'cucharadita': 'cucharaditas',
    'taza': 'tazas',
    'puñado': 'puñados',
    'scoop': 'scoops',
    'loncha': 'lonchas',
    'rodaja': 'rodajas',
    'pieza': 'piezas',
    'diente': 'dientes',
};

/**
 * Formatea cantidad + unidad con pluralización correcta
 * @param {number} amount - Cantidad
 * @param {string} unit - Unidad
 * @returns {string} Texto formateado (ej: "2 unidades", "A gusto")
 */
export function formatUnitWithAmount(amount, unit) {
    if (!unit) return `${amount}`;

    const unitLower = unit.toLowerCase();

    // Caso especial: a_gusto siempre muestra "Libre"
    if (unitLower === 'a_gusto' || unitLower === 'a gusto' || unitLower === 'libre') {
        return 'Libre';
    }

    // Si amount es 0 o undefined, solo mostrar la unidad o vacío
    if (!amount || amount === 0) {
        return 'Libre';
    }

    // Formatear número (evitar decimales innecesarios)
    const formattedAmount = Number.isInteger(amount) ? amount : parseFloat(amount.toFixed(1));

    // Gramos y mililitros no se pluralizan
    if (unitLower === 'g' || unitLower === 'ml' || unitLower === 'kg' || unitLower === 'l' || unitLower === 'gramos') {
        return `${formattedAmount} ${unit}`;
    }

    // Cantidad 1 = singular
    if (formattedAmount === 1) {
        return `${formattedAmount} ${unit}`;
    }

    // Pluralizar
    const plural = UNIT_PLURALS[unitLower] || unit + 's';
    return `${formattedAmount} ${plural}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSIÓN A GRAMOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene el peso en gramos de una unidad para un alimento
 * @param {string} unit - Unidad (ej: "unidad", "scoop")
 * @param {string} foodName - Nombre del alimento (para buscar peso específico)
 * @param {Object} servingSize - { unit, weight } del FoodItem si está disponible
 * @returns {number} Peso en gramos de una unidad
 */
export function getUnitWeightInGrams(unit, foodName = '', servingSize = null) {
    const unitLower = (unit || '').toLowerCase();
    const nameLower = (foodName || '').toLowerCase();

    // 1. Gramos y ml = 1:1 SIEMPRE (independiente de servingSize)
    if (unitLower === 'g' || unitLower === 'ml' || unitLower === 'gramos') {
        return 1;
    }

    // 2. Si tenemos servingSize del alimento Y define un peso real
    //    (no la referencia estándar "per 100g" donde unit="g")
    if (servingSize?.weight && servingSize.weight > 0 &&
        servingSize.unit && servingSize.unit.toLowerCase() !== 'g') {
        return servingSize.weight;
    }

    // 3. Buscar peso específico por nombre del alimento
    for (const [key, weight] of Object.entries(DEFAULT_WEIGHTS_BY_NAME)) {
        if (nameLower.includes(key)) {
            return weight;
        }
    }

    // 4. Usar factor de UNIT_CONVERSIONS
    const conversion = UNIT_CONVERSIONS[unitLower];
    if (conversion) {
        return conversion.factor;
    }

    // 5. Fallback: 100g
    return 100;
}

/**
 * Convierte cantidad + unidad a gramos totales
 * @param {number} amount - Cantidad
 * @param {string} unit - Unidad
 * @param {string} foodName - Nombre del alimento
 * @param {Object} servingSize - ServingSize del FoodItem
 * @returns {number} Gramos totales
 */
export function convertToGrams(amount, unit, foodName = '', servingSize = null) {
    if (!amount || amount <= 0) return 0;

    const unitLower = (unit || 'g').toLowerCase();

    // a_gusto no tiene cantidad definida
    if (unitLower === 'a_gusto' || unitLower === 'a gusto') {
        return 0;
    }

    const unitWeight = getUnitWeightInGrams(unit, foodName, servingSize);
    return amount * unitWeight;
}

/**
 * Calcula macros correctamente considerando unidades especiales
 * @param {number} amount - Cantidad
 * @param {string} unit - Unidad
 * @param {Object} nutrientsPer100g - { kcal, protein, carbs, fat } por 100g
 * @param {string} foodName - Nombre del alimento
 * @param {Object} servingSize - ServingSize del FoodItem
 * @returns {{ kcal: number, protein: number, carbs: number, fat: number }} { kcal, protein, carbs, fat }
 */
export function calculateMacrosForAmount(amount, unit, nutrientsPer100g, foodName = '', servingSize = null) {
    const gramsTotal = convertToGrams(amount, unit, foodName, servingSize);

    if (gramsTotal <= 0 || !nutrientsPer100g) {
        return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    }

    const factor = gramsTotal / 100;

    // Helper para redondear correctamente y evitar problemas de punto flotante
    const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;

    return {
        kcal: Math.round((nutrientsPer100g.kcal || 0) * factor),
        protein: round1((nutrientsPer100g.protein || 0) * factor),
        carbs: round1((nutrientsPer100g.carbs || 0) * factor),
        fat: round1((nutrientsPer100g.fat || 0) * factor),
    };
}
