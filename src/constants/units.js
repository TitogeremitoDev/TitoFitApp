/**
 * Sistema Unificado de Unidades y Porciones
 * Usado en: SmartFoodDrawer, WeeklyMealPlanner
 */
export const UNIT_CONVERSIONS = {
    gramos: { factor: 1, label: 'g', labelLong: 'Gramos' },
    unidad: { factor: 1, label: 'ud', labelLong: 'Unidad' }, // Factor 1 por defecto (variable según alimento)
    cucharada: { factor: 15, label: 'cda', labelLong: 'Cucharada' },
    cucharadita: { factor: 5, label: 'cdta', labelLong: 'Cucharadita' },
    taza: { factor: 200, label: 'taza', labelLong: 'Taza' },
    puñado: { factor: 30, label: 'puñado', labelLong: 'Puñado' },
    rebanada: { factor: 30, label: 'reb', labelLong: 'Rebanada' },
    scoop: { factor: 30, label: 'scoop', labelLong: 'Scoop' },
    a_gusto: { factor: 0, label: 'Libre', labelLong: 'A gusto / Sin pesar' },
};
