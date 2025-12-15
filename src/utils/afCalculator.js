/**
 * AF (Activity Factor) Calculator - Frontend
 * Used for FREEUSER local calculation
 */

/**
 * Calculate AF from daily step average
 * @param {number} steps - Average daily steps
 * @returns {number} AF value
 */
export function afFromSteps(steps) {
    if (steps < 6000) return 1.2;
    if (steps < 10000) return 1.375;
    if (steps < 13000) return 1.55;
    if (steps < 16000) return 1.725;
    return 1.9;
}

/**
 * Calculate AF override from cardio level
 * @param {string} cardio - nada | minimo | moderado | intenso | muy_intenso
 * @returns {number} AF value or 0 if no override
 */
export function afFromCardio(cardio) {
    switch (cardio) {
        case 'moderado': return 1.55;
        case 'intenso': return 1.725;
        case 'muy_intenso': return 1.9;
        default: return 0;
    }
}

/**
 * Bump AF to next tier
 * @param {number} af - Current AF
 * @returns {number} Next tier AF
 */
export function bumpTier(af) {
    if (af <= 1.2) return 1.375;
    if (af <= 1.375) return 1.55;
    if (af <= 1.55) return 1.725;
    return 1.9;
}

/**
 * Compute final AF
 * @param {object} params - { pasosMedia, cardio, entrenosFuerzaSemana }
 * @returns {number} Final AF value (1.2 - 1.9)
 */
export function computeAF({ pasosMedia = 0, cardio = 'nada', entrenosFuerzaSemana = 0 }) {
    const afSteps = afFromSteps(pasosMedia);
    const afCardio = afFromCardio(cardio);

    let af = Math.max(afSteps, afCardio);

    // Bonus: strength training + decent steps → bump 1 tier
    if (entrenosFuerzaSemana >= 4 && pasosMedia >= 8000) {
        af = bumpTier(af);
    }

    return Math.max(1.2, Math.min(1.9, af));
}

export default { afFromSteps, afFromCardio, bumpTier, computeAF };
