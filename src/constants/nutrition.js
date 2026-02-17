/* src/constants/nutrition.js */

// All available meal types the coach can choose from
export const ALL_MEAL_TYPES = [
    { id: 'desayuno', name: 'Desayuno', icon: '🌅', suggestedTime: '08:00' },
    { id: 'media_manana', name: 'Media Mañana', icon: '🍎', suggestedTime: '11:00' },
    { id: 'almuerzo', name: 'Almuerzo', icon: '🍽️', suggestedTime: '13:00' },
    { id: 'comida', name: 'Comida', icon: '🥘', suggestedTime: '14:00' },
    { id: 'merienda', name: 'Merienda', icon: '🥪', suggestedTime: '18:00' },
    { id: 'cena', name: 'Cena', icon: '🌙', suggestedTime: '21:00' },
    { id: 'recena', name: 'Recena', icon: '🥛', suggestedTime: '23:00' },
];

export const MEAL_STRUCTURES = {
    3: [
        { id: 'desayuno', name: 'Desayuno', icon: '🌅', suggestedTime: '08:00' },
        { id: 'comida', name: 'Comida', icon: '🍽️', suggestedTime: '14:00' },
        { id: 'cena', name: 'Cena', icon: '🌙', suggestedTime: '21:00' },
    ],
    4: [
        { id: 'desayuno', name: 'Desayuno', icon: '🌅', suggestedTime: '08:00' },
        { id: 'comida', name: 'Comida', icon: '🍽️', suggestedTime: '14:00' },
        { id: 'merienda', name: 'Merienda', icon: '🥪', suggestedTime: '18:00' },
        { id: 'cena', name: 'Cena', icon: '🌙', suggestedTime: '21:00' },
    ],
    5: [
        { id: 'desayuno', name: 'Desayuno', icon: '🌅', suggestedTime: '08:00' },
        { id: 'media_manana', name: 'Media Mañana', icon: '🍎', suggestedTime: '11:00' },
        { id: 'comida', name: 'Comida', icon: '🍽️', suggestedTime: '14:00' },
        { id: 'merienda', name: 'Merienda', icon: '🥪', suggestedTime: '18:00' },
        { id: 'cena', name: 'Cena', icon: '🌙', suggestedTime: '21:00' },
    ],
    6: [
        { id: 'desayuno', name: 'Desayuno', icon: '🌅', suggestedTime: '08:00' },
        { id: 'media_manana', name: 'Media Mañana', icon: '🍎', suggestedTime: '11:00' },
        { id: 'comida', name: 'Comida', icon: '🍽️', suggestedTime: '14:00' },
        { id: 'merienda', name: 'Merienda', icon: '🥪', suggestedTime: '18:00' },
        { id: 'cena', name: 'Cena', icon: '🌙', suggestedTime: '21:00' },
        { id: 'recena', name: 'Recena', icon: '🥛', suggestedTime: '23:00' },
    ]
};

export const DAY_COLORS = [
    '#22c55e', // Verde
    '#3b82f6', // Azul
    '#f59e0b', // Naranja
    '#ef4444', // Rojo
    '#8b5cf6', // Morado
    '#06b6d4', // Cyan
    '#ec4899', // Rosa
    '#84cc16', // Lima
];
