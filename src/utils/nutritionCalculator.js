/**
 * nutritionCalculator.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Cálculos nutricionales basados en:
 * - BMR (Mifflin–St Jeor)
 * - TDEE con factor de actividad
 * - Macros según objetivo (Volumen/Definición) y género
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// FACTORES DE ACTIVIDAD
// ═══════════════════════════════════════════════════════════════════════════
export const ACTIVITY_FACTORS = {
    1.2: 'Sedentario (poco o ningún ejercicio)',
    1.375: 'Ligero (1-3 días/semana)',
    1.55: 'Moderado (3-5 días/semana)',
    1.725: 'Activo (6-7 días/semana)',
    1.9: 'Muy activo (2x día o trabajo físico)',
};

// ═══════════════════════════════════════════════════════════════════════════
// PRESETS DE MACROS
// ═══════════════════════════════════════════════════════════════════════════
const MACRO_PRESETS = {
    // Hombre - Volumen
    M_VOL: { proteinPerKg: 2.0, fatPercent: 0.25 },
    // Mujer - Volumen
    F_VOL: { proteinPerKg: 1.8, fatPercent: 0.30 },
    // Hombre - Definición
    M_DEF: { proteinPerKg: 2.4, fatPercent: 0.25 },
    // Mujer - Definición
    F_DEF: { proteinPerKg: 2.2, fatPercent: 0.30 },
};

// Grasas mínimas por kg (guardrail)
const MIN_FAT_PER_KG = {
    male: 0.6,
    female: 0.7,
};

// ═══════════════════════════════════════════════════════════════════════════
// CÁLCULO DE BMR (Mifflin–St Jeor)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Calcula el metabolismo basal (BMR)
 * @param {number} weight - Peso en kg
 * @param {number} height - Altura en cm
 * @param {number} age - Edad en años
 * @param {string} gender - 'hombre' o 'mujer'
 * @returns {number} BMR en kcal
 */
export function calculateBMR(weight, height, age, gender) {
    if (!weight || !height || !age) return 0;

    const W = parseFloat(weight);
    let H = parseFloat(height);
    const A = parseFloat(age);

    // Si la altura es menor a 3, está en metros → convertir a cm
    // (nadie mide menos de 3 metros ni más de 3 cm)
    if (H < 3) {
        H = H * 100;
    }

    // Hombre: BMR = 10·W + 6.25·H − 5·A + 5
    // Mujer:  BMR = 10·W + 6.25·H − 5·A − 161
    const isMale = gender?.toLowerCase().includes('hombre') ||
        gender?.toLowerCase().includes('masculino') ||
        gender?.toLowerCase() === 'male' ||
        gender?.toLowerCase() === 'm';

    const bmr = 10 * W + 6.25 * H - 5 * A + (isMale ? 5 : -161);
    return Math.round(bmr);
}

// ═══════════════════════════════════════════════════════════════════════════
// CÁLCULO DE TDEE (Gasto Total Diario)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Calcula el gasto calórico de mantenimiento (TDEE)
 * @param {number} bmr - Metabolismo basal
 * @param {number} activityFactor - Factor de actividad (1.2 - 1.9)
 * @returns {number} TDEE en kcal
 */
export function calculateTDEE(bmr, activityFactor = 1.55) {
    return Math.round(bmr * activityFactor);
}

// ═══════════════════════════════════════════════════════════════════════════
// CÁLCULO DE KCAL OBJETIVO
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Calcula las kcal objetivo según el objetivo
 * @param {number} tdee - TDEE
 * @param {string} objetivo - 'volumen', 'definicion', 'mantener', 'ganar_peso', 'definir'
 * @param {boolean} isRestDay - Si es día de descanso (solo aplica en definición)
 * @returns {number} KCAL objetivo
 */
export function calculateTargetKcal(tdee, objetivo, isRestDay = false) {
    const obj = objetivo?.toLowerCase() || '';

    // Detectar volumen/bulking
    const isVolumen = obj.includes('volumen') ||
        obj.includes('masa') ||
        obj.includes('ganar') ||
        obj === 'ganar_peso';

    // Detectar mantenimiento
    const isMantener = obj.includes('mantener') ||
        obj === 'mantener' ||
        obj.includes('recomp');

    if (isVolumen) {
        return tdee + 250;
    } else if (isMantener) {
        return tdee; // Mantenimiento: sin ajuste
    } else {
        // Definición: -250 días entrenamiento, -350 días descanso
        return tdee - (isRestDay ? 350 : 250);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CÁLCULO DE MACROS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Calcula los macronutrientes
 * @param {number} targetKcal - Calorías objetivo
 * @param {number} weight - Peso en kg
 * @param {string} gender - 'hombre' o 'mujer'
 * @param {string} objetivo - 'volumen' o 'definicion'
 * @returns {Object} { protein, fat, carbs, proteinKcal, fatKcal, carbsKcal }
 */
export function calculateMacros(targetKcal, weight, gender, objetivo) {
    if (!targetKcal || !weight) {
        return { protein: 0, fat: 0, carbs: 0, proteinKcal: 0, fatKcal: 0, carbsKcal: 0 };
    }

    const obj = objetivo?.toLowerCase() || '';

    const isMale = gender?.toLowerCase().includes('hombre') ||
        gender?.toLowerCase().includes('masculino') ||
        gender?.toLowerCase() === 'male' ||
        gender?.toLowerCase() === 'm';

    const isVolumen = obj.includes('volumen') ||
        obj.includes('masa') ||
        obj.includes('ganar') ||
        obj === 'ganar_peso';

    const isMantener = obj.includes('mantener') ||
        obj === 'mantener' ||
        obj.includes('recomp');

    // Seleccionar preset (mantener usa preset de volumen para macros más generosos)
    const presetKey = `${isMale ? 'M' : 'F'}_${(isVolumen || isMantener) ? 'VOL' : 'DEF'}`;
    const preset = MACRO_PRESETS[presetKey];

    // Proteína (g) = peso × proteinPerKg
    const protein = Math.round(weight * preset.proteinPerKg);
    const proteinKcal = protein * 4;

    // Grasa (kcal) = KCAL × fatPercent
    let fatKcal = Math.round(targetKcal * preset.fatPercent);
    let fat = Math.round(fatKcal / 9);

    // Guardrail: grasa mínima
    const minFat = Math.round(weight * (isMale ? MIN_FAT_PER_KG.male : MIN_FAT_PER_KG.female));
    if (fat < minFat) {
        fat = minFat;
        fatKcal = fat * 9;
    }

    // Carbohidratos = resto
    const carbsKcal = targetKcal - proteinKcal - fatKcal;
    const carbs = Math.max(0, Math.round(carbsKcal / 4));

    return {
        protein,
        fat,
        carbs,
        proteinKcal,
        fatKcal,
        carbsKcal: Math.max(0, carbsKcal),
        proteinPerKg: preset.proteinPerKg,
        fatPercent: Math.round(preset.fatPercent * 100),
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// CÁLCULO DE AGUA
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Calcula la ingesta de agua recomendada
 * @param {number} weight - Peso en kg
 * @param {number} trainingHours - Horas de entrenamiento (0 para días descanso)
 * @returns {Object} { liters, ml, formula }
 */
export function calculateWater(weight, trainingHours = 0) {
    if (!weight) return { liters: 0, ml: 0, formula: '' };

    // Base: 35ml por kg
    const baseMl = 35 * weight;
    // Extra por ejercicio: 600ml por hora
    const extraMl = 600 * trainingHours;
    const totalMl = Math.round(baseMl + extraMl);

    return {
        liters: (totalMl / 1000).toFixed(1),
        ml: totalMl,
        baseMl: Math.round(baseMl),
        extraMl: Math.round(extraMl),
        formula: `${Math.round(baseMl)}ml base + ${Math.round(extraMl)}ml ejercicio`,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// PASOS RECOMENDADOS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Obtiene la recomendación de pasos según objetivo
 * @param {string} objetivo - 'volumen' o 'definicion'
 * @returns {Object} { min, max, text }
 */
export function getStepsRecommendation(objetivo) {
    const obj = objetivo?.toLowerCase() || '';

    const isVolumen = obj.includes('volumen') ||
        obj.includes('masa') ||
        obj.includes('ganar') ||
        obj === 'ganar_peso';

    const isMantener = obj.includes('mantener') ||
        obj === 'mantener' ||
        obj.includes('recomp');

    if (isVolumen) {
        return {
            min: 6000,
            max: 8000,
            text: '6.000 - 8.000 pasos/día',
            tipo: 'Volumen',
        };
    } else if (isMantener) {
        return {
            min: 7000,
            max: 10000,
            text: '7.000 - 10.000 pasos/día',
            tipo: 'Mantenimiento',
        };
    } else {
        return {
            min: 8000,
            max: 12000,
            text: '8.000 - 12.000 pasos/día',
            tipo: 'Definición',
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN COMPLETA DE CÁLCULO
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Calcula todos los valores nutricionales
 * @param {Object} userInfo - { edad, peso, altura, genero }
 * @param {string} objetivo - 'volumen' o 'definicion'
 * @param {number} activityFactor - Factor de actividad (1.2-1.9)
 * @returns {Object} Todos los cálculos nutricionales
 */
export function calculateFullNutrition(userInfo, objetivo, activityFactor = 1.55) {
    const { edad, peso, altura, genero } = userInfo || {};

    if (!edad || !peso || !altura || !genero) {
        return null;
    }

    const bmr = calculateBMR(peso, altura, edad, genero);
    const tdee = calculateTDEE(bmr, activityFactor);

    const obj = objetivo?.toLowerCase() || '';

    const isVolumen = obj.includes('volumen') ||
        obj.includes('masa') ||
        obj.includes('ganar') ||
        obj === 'ganar_peso';

    const isMantener = obj.includes('mantener') ||
        obj === 'mantener' ||
        obj.includes('recomp');

    // Día de entrenamiento
    const kcalTraining = calculateTargetKcal(tdee, objetivo, false);
    const macrosTraining = calculateMacros(kcalTraining, peso, genero, objetivo);
    const waterTraining = calculateWater(peso, 1.5); // 1.5h promedio

    // Día de descanso (solo relevante en definición)
    const kcalRest = calculateTargetKcal(tdee, objetivo, true);
    const macrosRest = calculateMacros(kcalRest, peso, genero, objetivo);
    const waterRest = calculateWater(peso, 0);

    const steps = getStepsRecommendation(objetivo);

    return {
        // Datos base
        bmr,
        tdee,
        activityFactor,
        objetivo: isVolumen ? 'Volumen' : (isMantener ? 'Mantenimiento' : 'Definición'),
        isVolumen,
        isMantener,

        // Día de entrenamiento
        training: {
            kcal: kcalTraining,
            ...macrosTraining,
            water: waterTraining,
        },

        // Día de descanso
        rest: {
            kcal: kcalRest,
            ...macrosRest,
            water: waterRest,
        },

        // Pasos
        steps,

        // Diferencia (para mostrar)
        kcalDifference: isVolumen ? 250 : (isMantener ? 0 : -250),
        kcalDifferenceRest: isVolumen ? 250 : (isMantener ? 0 : -350),
    };
}
