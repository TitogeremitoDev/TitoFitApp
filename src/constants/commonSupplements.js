/**
 * commonSupplements.js
 * Lista predefinida de suplementos comunes para autocompletado
 */

export const COMMON_SUPPLEMENTS = [
    // Proteínas
    {
        id: 'whey_protein',
        name: 'Proteína Whey',
        category: 'Proteínas',
        defaultAmount: 30,
        defaultUnit: 'gramos',
        commonSizes: [900, 2000, 2500],
        sizeUnit: 'gramos',
        emoji: '🥛'
    },
    {
        id: 'casein_protein',
        name: 'Caseína',
        category: 'Proteínas',
        defaultAmount: 30,
        defaultUnit: 'gramos',
        commonSizes: [900, 2000],
        sizeUnit: 'gramos',
        emoji: '🥛'
    },

    // Rendimiento
    {
        id: 'creatine',
        name: 'Creatina Monohidrato',
        category: 'Rendimiento',
        defaultAmount: 5,
        defaultUnit: 'gramos',
        commonSizes: [250, 500, 1000],
        sizeUnit: 'gramos',
        emoji: '💪'
    },
    {
        id: 'bcaa',
        name: 'BCAAs',
        category: 'Rendimiento',
        defaultAmount: 5,
        defaultUnit: 'gramos',
        commonSizes: [250, 500],
        sizeUnit: 'gramos',
        emoji: '⚡'
    },
    {
        id: 'pre_workout',
        name: 'Pre-Entreno',
        category: 'Rendimiento',
        defaultAmount: 1,
        defaultUnit: 'scoop',
        commonSizes: [300, 500],
        sizeUnit: 'gramos',
        emoji: '🚀'
    },
    {
        id: 'caffeine',
        name: 'Cafeína',
        category: 'Rendimiento',
        defaultAmount: 200,
        defaultUnit: 'mg',
        commonSizes: [100, 200],
        sizeUnit: 'caps',
        emoji: '☕'
    },
    {
        id: 'beta_alanine',
        name: 'Beta Alanina',
        category: 'Rendimiento',
        defaultAmount: 3,
        defaultUnit: 'gramos',
        commonSizes: [200, 500],
        sizeUnit: 'gramos',
        emoji: '⚡'
    },

    // Ácidos Grasos
    {
        id: 'omega3',
        name: 'Omega 3',
        category: 'Ácidos Grasos',
        defaultAmount: 2,
        defaultUnit: 'caps',
        commonSizes: [60, 90, 120, 180],
        sizeUnit: 'caps',
        emoji: '🐟'
    },

    // Vitaminas
    {
        id: 'vitamin_d3',
        name: 'Vitamina D3',
        category: 'Vitaminas',
        defaultAmount: 1,
        defaultUnit: 'caps',
        commonSizes: [60, 90, 120],
        sizeUnit: 'caps',
        emoji: '☀️'
    },
    {
        id: 'vitamin_c',
        name: 'Vitamina C',
        category: 'Vitaminas',
        defaultAmount: 1000,
        defaultUnit: 'mg',
        commonSizes: [60, 90, 120],
        sizeUnit: 'caps',
        emoji: '🍊'
    },
    {
        id: 'multivitamin',
        name: 'Multivitamínico',
        category: 'Vitaminas',
        defaultAmount: 1,
        defaultUnit: 'caps',
        commonSizes: [60, 90, 120, 180],
        sizeUnit: 'caps',
        emoji: '💊'
    },
    {
        id: 'vitamin_b_complex',
        name: 'Vitaminas B Complex',
        category: 'Vitaminas',
        defaultAmount: 1,
        defaultUnit: 'caps',
        commonSizes: [60, 90, 120],
        sizeUnit: 'caps',
        emoji: '🔋'
    },

    // Minerales
    {
        id: 'magnesium',
        name: 'Magnesio',
        category: 'Minerales',
        defaultAmount: 400,
        defaultUnit: 'mg',
        commonSizes: [60, 90, 120],
        sizeUnit: 'caps',
        emoji: '🧲'
    },
    {
        id: 'zinc',
        name: 'Zinc',
        category: 'Minerales',
        defaultAmount: 15,
        defaultUnit: 'mg',
        commonSizes: [60, 90, 120],
        sizeUnit: 'caps',
        emoji: '🛡️'
    },
    {
        id: 'iron',
        name: 'Hierro',
        category: 'Minerales',
        defaultAmount: 14,
        defaultUnit: 'mg',
        commonSizes: [60, 90],
        sizeUnit: 'caps',
        emoji: '🩸'
    },
    {
        id: 'calcium',
        name: 'Calcio',
        category: 'Minerales',
        defaultAmount: 500,
        defaultUnit: 'mg',
        commonSizes: [60, 90, 120],
        sizeUnit: 'caps',
        emoji: '🦴'
    },

    // Salud Digestiva
    {
        id: 'probiotics',
        name: 'Probióticos',
        category: 'Salud Digestiva',
        defaultAmount: 1,
        defaultUnit: 'caps',
        commonSizes: [30, 60, 90],
        sizeUnit: 'caps',
        emoji: '🦠'
    },
    {
        id: 'digestive_enzymes',
        name: 'Enzimas Digestivas',
        category: 'Salud Digestiva',
        defaultAmount: 1,
        defaultUnit: 'caps',
        commonSizes: [60, 90, 120],
        sizeUnit: 'caps',
        emoji: '🧬'
    },

    // Sueño y Recuperación
    {
        id: 'melatonin',
        name: 'Melatonina',
        category: 'Sueño',
        defaultAmount: 1,
        defaultUnit: 'mg',
        commonSizes: [60, 90, 120],
        sizeUnit: 'caps',
        emoji: '😴'
    },
    {
        id: 'zma',
        name: 'ZMA',
        category: 'Sueño',
        defaultAmount: 3,
        defaultUnit: 'caps',
        commonSizes: [90, 120],
        sizeUnit: 'caps',
        emoji: '🌙'
    },
    {
        id: 'ashwagandha',
        name: 'Ashwagandha',
        category: 'Adaptógenos',
        defaultAmount: 600,
        defaultUnit: 'mg',
        commonSizes: [60, 90, 120],
        sizeUnit: 'caps',
        emoji: '🌿'
    },

    // Articulaciones
    {
        id: 'glucosamine',
        name: 'Glucosamina',
        category: 'Articulaciones',
        defaultAmount: 1500,
        defaultUnit: 'mg',
        commonSizes: [60, 90, 120],
        sizeUnit: 'caps',
        emoji: '🦵'
    },
    {
        id: 'collagen',
        name: 'Colágeno',
        category: 'Articulaciones',
        defaultAmount: 10,
        defaultUnit: 'gramos',
        commonSizes: [300, 500],
        sizeUnit: 'gramos',
        emoji: '✨'
    }
];

// Unidades disponibles para suplementos
export const SUPPLEMENT_UNITS = [
    { id: 'gramos', label: 'g', factor: 1 },
    { id: 'mg', label: 'mg', factor: 0.001 },
    { id: 'caps', label: 'caps', factor: 1 },
    { id: 'scoop', label: 'scoop', factor: 30 },
    { id: 'ml', label: 'ml', factor: 1 }
];

// Timings disponibles
export const SUPPLEMENT_TIMINGS = [
    { id: 'antes', label: 'Antes de comer', icon: '⏰' },
    { id: 'con', label: 'Con la comida', icon: '🍽️' },
    { id: 'despues', label: 'Después de comer', icon: '✅' }
];

// Categorías para agrupar
export const SUPPLEMENT_CATEGORIES = [
    'Proteínas',
    'Rendimiento',
    'Ácidos Grasos',
    'Vitaminas',
    'Minerales',
    'Salud Digestiva',
    'Sueño',
    'Adaptógenos',
    'Articulaciones'
];

// Helper: Buscar suplemento por nombre (fuzzy)
export const findSupplementByName = (name) => {
    const normalized = name.toLowerCase().trim();
    return COMMON_SUPPLEMENTS.find(s =>
        s.name.toLowerCase().includes(normalized) ||
        normalized.includes(s.name.toLowerCase())
    );
};

// Helper: Obtener suplementos por categoría
export const getSupplementsByCategory = (category) => {
    return COMMON_SUPPLEMENTS.filter(s => s.category === category);
};

export default COMMON_SUPPLEMENTS;
