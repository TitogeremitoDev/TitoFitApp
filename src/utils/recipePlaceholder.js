// src/utils/recipePlaceholder.js

/**
 * PALETA DE COLORES CULINARIOS
 * Colores vibrantes pero elegantes para fondos de comida.
 */
const FOOD_COLORS = [
    '#fca5a5', // Red 300
    '#fdba74', // Orange 300
    '#fde047', // Yellow 300
    '#bef264', // Lime 300
    '#86efac', // Green 300
    '#67e8f9', // Cyan 300
    '#93c5fd', // Blue 300
    '#c4b5fd', // Violet 300
    '#f0abfc', // Fuchsia 300
    '#fda4af', // Rose 300
];

/**
 * DICCIONARIO SEMÁNTICO
 * Mapea palabras clave a iconos y colores específicos.
 * Orden: Prioridad de arriba a abajo.
 */
const SEMANTIC_MAP = [
    { keywords: ['pollo', 'chicken', 'pavo', 'turkey', 'ave'], icon: '🍗', color: '#fb923c' }, // Orange
    { keywords: ['carne', 'meat', 'ternera', 'beef', 'bistec', 'steak', 'cerdo', 'pork'], icon: '🥩', color: '#f87171' }, // Red
    { keywords: ['pescado', 'fish', 'salmon', 'salmón', 'atun', 'atún', 'merluza', 'bacalao'], icon: '🐟', color: '#60a5fa' }, // Blue
    { keywords: ['hamburguesa', 'burger'], icon: '🍔', color: '#fbbf24' }, // Yellow
    { keywords: ['pizza'], icon: '🍕', color: '#fca5a5' }, // Red Light
    { keywords: ['ensalada', 'salad', 'verde', 'vegetal', 'vegan', 'tofu'], icon: '🥗', color: '#4ade80' }, // Green
    { keywords: ['arroz', 'rice', 'paella', 'risotto', 'bowl'], icon: '🍚', color: '#2dd4bf' }, // Teal
    { keywords: ['pasta', 'espagueti', 'spaghetti', 'macarrones', 'fideos', 'noodle'], icon: '🍝', color: '#fde047' }, // Yellow
    { keywords: ['huevo', 'egg', 'tortilla', 'revuelto', 'omelette'], icon: '🍳', color: '#fef08a' }, // Yellow Light
    { keywords: ['pan', 'bread', 'tostada', 'toast', 'bocadillo', 'sandwich'], icon: '🥪', color: '#fdba74' }, // Orange Light
    { keywords: ['patata', 'potato', 'frito', 'fries'], icon: '🍟', color: '#fcd34d' }, // Amber
    { keywords: ['sopa', 'soup', 'caldo', 'crema', 'pure', 'puré'], icon: '🥣', color: '#fb923c' },
    { keywords: ['postre', 'dessert', 'pastel', 'cake', 'dulce', 'sweet', 'chocolate'], icon: '🍰', color: '#f472b6' }, // Pink
    { keywords: ['fruta', 'fruit', 'manzana', 'apple', 'platano', 'banana'], icon: '🍎', color: '#ef4444' },
    { keywords: ['batido', 'smoothie', 'shake', 'proteina'], icon: '🥤', color: '#c084fc' }, // Purple
    { keywords: ['cafe', 'coffee', 'te', 'tea'], icon: '☕', color: '#a8a29e' }, // Brown-ish
];

/**
 * Genera un placeholder semántico basado en el nombre de la comida.
 * Fallback: Usa un hash del nombre para elegir un color consistente.
 * 
 * @param {string} name - Nombre de la comida/receta
 * @returns {{ icon: string, color: string, backgroundColor: string }}
 */
export const getRecipePlaceholder = (name) => {
    if (!name) return { icon: '🍽️', color: '#cbd5e1', backgroundColor: '#f1f5f9' };

    const normalized = name.toLowerCase();

    // 1. Búsqueda Semántica
    for (const entry of SEMANTIC_MAP) {
        if (entry.keywords.some(k => normalized.includes(k))) {
            return {
                icon: entry.icon,
                color: '#fff', // Iconos suelen verse bien sobre fondo coloreado, o usamos el color como fondo
                backgroundColor: entry.color
            };
        }
    }

    // 2. Fallback Consistente (Hash)
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % FOOD_COLORS.length;
    const bg = FOOD_COLORS[index];

    return {
        icon: '🍲',
        color: '#fff',
        backgroundColor: bg
    };
};
