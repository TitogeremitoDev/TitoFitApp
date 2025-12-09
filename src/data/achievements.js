/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 SISTEMA DE LOGROS ESTILO STEAM - TOTALGAINS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 46 logros gamificados para motivar el progreso del usuario.
 * Cada logro tiene una función de desbloqueo pura que recibe las estadísticas.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORÍAS DE LOGROS
// ═══════════════════════════════════════════════════════════════════════════

export const ACHIEVEMENT_CATEGORIES = {
    volumen: { name: 'Volumen', emoji: '💪', color: '#8b5cf6' },
    constancia: { name: 'Constancia', emoji: '📆', color: '#10b981' },
    intensidad: { name: 'Intensidad', emoji: '🔥', color: '#ef4444' },
    habitos: { name: 'Hábitos', emoji: '🎯', color: '#3b82f6' },
    mentalidad: { name: 'Mentalidad', emoji: '🧠', color: '#f59e0b' },
    social: { name: 'Social', emoji: '👥', color: '#ec4899' },
    easter_egg: { name: 'Secretos', emoji: '🥚', color: '#6b7280' },
};

// ═══════════════════════════════════════════════════════════════════════════
// DEFINICIÓN DE TODOS LOS LOGROS
// ═══════════════════════════════════════════════════════════════════════════

export const ACHIEVEMENTS = [
    // ─────────────────────────────────────────────────────────────────────────
    // 📊 VOLUMEN - Logros basados en repeticiones y peso acumulado
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'canijo',
        name: 'Canijo',
        description: 'Has conseguido tus primeras 1.000 repeticiones acumuladas.',
        emoji: '🧒',
        category: 'volumen',
        targetValue: 1000,
        progressKey: 'accumulatedReps',
        unlockCondition: (stats) => stats.accumulatedReps >= 1000,
    },
    {
        id: 'no_tan_canijo',
        name: 'Ya no tan canijo',
        description: 'Has llegado a 5.000 repeticiones acumuladas.',
        emoji: '😏',
        category: 'volumen',
        targetValue: 5000,
        progressKey: 'accumulatedReps',
        unlockCondition: (stats) => stats.accumulatedReps >= 5000,
    },
    {
        id: 'reps_machine',
        name: 'Máquina de reps',
        description: 'Has llegado a 10.000 repeticiones acumuladas.',
        emoji: '⚙️',
        category: 'volumen',
        targetValue: 10000,
        progressKey: 'accumulatedReps',
        unlockCondition: (stats) => stats.accumulatedReps >= 10000,
    },
    {
        id: 'reps_legend',
        name: 'Leyenda de las reps',
        description: 'Has llegado a 50.000 repeticiones acumuladas.',
        emoji: '🏛️',
        category: 'volumen',
        targetValue: 50000,
        progressKey: 'accumulatedReps',
        unlockCondition: (stats) => stats.accumulatedReps >= 50000,
    },
    {
        id: 'tonelada_uno',
        name: 'Primera tonelada',
        description: 'Has levantado 1.000 kg de volumen total en un solo entreno.',
        emoji: '🏋️',
        category: 'volumen',
        targetValue: 1000,
        progressKey: 'sessionVolumeKg',
        unlockCondition: (stats) => stats.sessionVolumeKg >= 1000,
    },
    {
        id: 'tonelada_cinco',
        name: 'Cinco toneladas',
        description: 'Has levantado 5.000 kg de volumen total en un solo entreno.',
        emoji: '🛠️',
        category: 'volumen',
        targetValue: 5000,
        progressKey: 'sessionVolumeKg',
        unlockCondition: (stats) => stats.sessionVolumeKg >= 5000,
    },
    {
        id: 'tonelada_diez',
        name: 'Diez toneladas',
        description: 'Has levantado 10.000 kg de volumen total en un solo entreno.',
        emoji: '💣',
        category: 'volumen',
        targetValue: 10000,
        progressKey: 'sessionVolumeKg',
        unlockCondition: (stats) => stats.sessionVolumeKg >= 10000,
    },
    {
        id: 'despegue',
        name: 'Despegue',
        description: 'Has generado un trabajo mecánico equivalente a la potencia de un cohete al despegar.',
        emoji: '🚀',
        category: 'volumen',
        targetValue: 50000,
        progressKey: 'accumulatedVolumeKg',
        unlockCondition: (stats) => stats.accumulatedVolumeKg >= 50000,
    },
    {
        id: 'ultra_volumen_semana',
        name: 'Semana monstruo',
        description: 'Has superado tu volumen medio semanal en +30%.',
        emoji: '🧟',
        category: 'volumen',
        unlockCondition: (stats) => stats.weeklyVolumeIncrease >= 30,
    },
    {
        id: 'ultra_volumen_mes',
        name: 'Mes monstruo',
        description: 'Has superado tu volumen medio mensual en +30%.',
        emoji: '👹',
        category: 'volumen',
        unlockCondition: (stats) => stats.monthlyVolumeIncrease >= 30,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 📆 CONSTANCIA - Logros de streaks y consistencia
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'day_one_war',
        name: 'Día 1 de guerra',
        description: 'Completas tu primer entreno registrado.',
        emoji: '🗡️',
        category: 'constancia',
        targetValue: 1,
        progressKey: 'totalWorkouts',
        unlockCondition: (stats) => stats.totalWorkouts >= 1,
    },
    {
        id: 'three_in_a_row',
        name: 'No es casualidad',
        description: 'Entrenas 3 días seguidos.',
        emoji: '📆',
        category: 'constancia',
        unlockCondition: (stats) => stats.currentStreak >= 3,
    },
    {
        id: 'week_streak',
        name: 'Semana blindada',
        description: 'Entrenas 4+ días en 7 días.',
        emoji: '🧱',
        category: 'constancia',
        targetValue: 4,
        progressKey: 'workoutsThisWeek',
        unlockCondition: (stats) => stats.workoutsThisWeek >= 4,
    },
    {
        id: 'two_weeks_streak',
        name: 'Dos semanas en modo bestia',
        description: 'Mantienes 2 semanas cumpliendo tu objetivo mínimo de entrenos.',
        emoji: '🐗',
        category: 'constancia',
        unlockCondition: (stats) => stats.weeksOnTarget >= 2,
    },
    {
        id: 'month_streak',
        name: 'Mes sin excusas',
        description: 'Mantienes tu frecuencia mínima de entreno durante 30 días.',
        emoji: '📅',
        category: 'constancia',
        targetValue: 30,
        progressKey: 'daysOnTarget',
        unlockCondition: (stats) => stats.daysOnTarget >= 30,
    },
    {
        id: 'quarter_streak',
        name: 'Trimestre de guerra',
        description: 'Mantienes la frecuencia durante 90 días.',
        emoji: '🛡️',
        category: 'constancia',
        targetValue: 90,
        progressKey: 'daysOnTarget',
        unlockCondition: (stats) => stats.daysOnTarget >= 90,
    },
    {
        id: 'year_streak',
        name: 'Año TotalGains',
        description: 'Entrenas de forma constante durante 365 días.',
        emoji: '🔥',
        category: 'constancia',
        targetValue: 365,
        progressKey: 'daysOnTarget',
        unlockCondition: (stats) => stats.daysOnTarget >= 365,
    },
    {
        id: 'comeback',
        name: 'Vuelves al ring',
        description: 'Vuelves a entrenar tras 14+ días sin entrenos.',
        emoji: '🥊',
        category: 'constancia',
        unlockCondition: (stats) => stats.daysSinceLastWorkout >= 14 && stats.justCompletedWorkout,
    },
    {
        id: 'media_luna',
        name: 'Media Luna',
        description: 'Entreno completado después de las 22:00.',
        emoji: '🌙',
        category: 'constancia',
        unlockCondition: (stats) => {
            const hour = stats.workoutHour;
            return hour >= 22 || hour < 5;
        },
    },
    {
        id: 'amanecer_hierros',
        name: 'Amanecer de hierro',
        description: 'Entreno completado antes de las 7:00.',
        emoji: '🌅',
        category: 'constancia',
        unlockCondition: (stats) => stats.workoutHour >= 5 && stats.workoutHour < 7,
    },
    {
        id: 'doble_sesion',
        name: 'Doble sesión',
        description: '2 entrenos en el mismo día.',
        emoji: '♻️',
        category: 'constancia',
        unlockCondition: (stats) => stats.workoutsToday >= 2,
    },
    {
        id: 'never_skip_monday',
        name: 'Nunca saltas lunes',
        description: 'Entrenas 4 lunes seguidos.',
        emoji: '💼',
        category: 'constancia',
        unlockCondition: (stats) => stats.consecutiveMondays >= 4,
    },
    {
        id: 'friday_iron_club',
        name: 'Viernes de hierro',
        description: 'Entrenas 4 viernes seguidos.',
        emoji: '🍺',
        category: 'constancia',
        unlockCondition: (stats) => stats.consecutiveFridays >= 4,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 🔥 INTENSIDAD - Logros de rendimiento y PRs
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'primer_pr',
        name: 'Primer PR',
        description: 'Registras tu primer récord personal en cualquier ejercicio.',
        emoji: '🥇',
        category: 'intensidad',
        targetValue: 1,
        progressKey: 'totalPRs',
        unlockCondition: (stats) => stats.totalPRs >= 1,
    },
    {
        id: 'pr_hunter',
        name: 'Cazador de PRs',
        description: 'Consigues 5 PRs distintos.',
        emoji: '🎯',
        category: 'intensidad',
        targetValue: 5,
        progressKey: 'totalPRs',
        unlockCondition: (stats) => stats.totalPRs >= 5,
    },
    {
        id: 'pr_maniac',
        name: 'Maníaco de PRs',
        description: 'Consigues 20 PRs distintos.',
        emoji: '🤪',
        category: 'intensidad',
        targetValue: 20,
        progressKey: 'totalPRs',
        unlockCondition: (stats) => stats.totalPRs >= 20,
    },
    {
        id: 'short_and_brutal',
        name: 'Corto pero criminal',
        description: 'Entreno < 25 min con alto volumen.',
        emoji: '⏱️',
        category: 'intensidad',
        unlockCondition: (stats) => stats.workoutDurationMinutes < 25 && stats.sessionVolumeKg >= 2000,
    },
    {
        id: 'maraton_hierros',
        name: 'Maratón de hierro',
        description: 'Entreno de 90+ minutos.',
        emoji: '🐢',
        category: 'intensidad',
        unlockCondition: (stats) => stats.workoutDurationMinutes >= 90,
    },
    {
        id: 'full_body_destroyer',
        name: 'Full body destroyer',
        description: 'Entreno con 3+ grupos musculares grandes.',
        emoji: '💀',
        category: 'intensidad',
        unlockCondition: (stats) => stats.muscleGroupsWorked >= 3,
    },
    {
        id: 'leg_day_real',
        name: 'Leg Day de verdad',
        description: 'Entreno de pierna con volumen alto.',
        emoji: '🦵',
        category: 'intensidad',
        unlockCondition: (stats) =>
            stats.muscleGroups?.some(m => ['PIERNA', 'CUÁDRICEPS', 'ISQUIO', 'GLÚTEOS', 'LEG'].some(leg =>
                m?.toUpperCase().includes(leg)
            )) && stats.sessionVolumeKg >= 3000,
    },
    {
        id: 'push_day_king',
        name: 'Rey del empuje',
        description: 'Entreno centrado en empuje con volumen alto.',
        emoji: '🧱',
        category: 'intensidad',
        unlockCondition: (stats) =>
            stats.muscleGroups?.some(m => ['PECHO', 'HOMBRO', 'TRÍCEPS', 'CHEST', 'SHOULDER'].some(push =>
                m?.toUpperCase().includes(push)
            )) && stats.sessionVolumeKg >= 2500,
    },
    {
        id: 'pull_day_king',
        name: 'Rey del tirón',
        description: 'Entreno centrado en tirón con volumen alto.',
        emoji: '🪝',
        category: 'intensidad',
        unlockCondition: (stats) =>
            stats.muscleGroups?.some(m => ['ESPALDA', 'BÍCEPS', 'DORSAL', 'BACK', 'BICEP'].some(pull =>
                m?.toUpperCase().includes(pull)
            )) && stats.sessionVolumeKg >= 2500,
    },
    {
        id: 'core_killer',
        name: 'Core Killer',
        description: 'Varios ejercicios de core en una sesión.',
        emoji: '🔥',
        category: 'intensidad',
        unlockCondition: (stats) => stats.coreExercisesCount >= 3,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 🎯 HÁBITOS - Logros de rutinas saludables
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'calentado_siempre',
        name: 'Nunca en frío',
        description: 'Calentamiento registrado en 10 entrenos.',
        emoji: '🔥',
        category: 'habitos',
        unlockCondition: (stats) => stats.workoutsWithWarmup >= 10,
    },
    {
        id: 'mobility_fan',
        name: 'Mobility Fan',
        description: 'Movilidad/estiramientos en 15 entrenos.',
        emoji: '🤸',
        category: 'habitos',
        unlockCondition: (stats) => stats.workoutsWithMobility >= 15,
    },
    {
        id: 'hydrated',
        name: 'Hidratado como un pro',
        description: 'Objetivo de agua cumplido 7 días seguidos.',
        emoji: '💧',
        category: 'habitos',
        unlockCondition: (stats) => stats.consecutiveWaterGoalDays >= 7,
    },
    {
        id: 'sleep_guardian',
        name: 'Guardián del sueño',
        description: 'Objetivo de sueño cumplido 7 días seguidos.',
        emoji: '😴',
        category: 'habitos',
        unlockCondition: (stats) => stats.consecutiveSleepGoalDays >= 7,
    },
    {
        id: 'injury_free',
        name: '0 lesiones',
        description: '3 meses sin marcar lesiones.',
        emoji: '🩹',
        category: 'habitos',
        unlockCondition: (stats) => stats.daysWithoutInjury >= 90,
    },
    {
        id: 'warmup_religion',
        name: 'Calentamiento es religión',
        description: '30 entrenos con calentamiento.',
        emoji: '🕯️',
        category: 'habitos',
        unlockCondition: (stats) => stats.workoutsWithWarmup >= 30,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 🧠 MENTALIDAD - Logros de persistencia mental
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'no_pain_no_gain',
        name: 'No Pain No Gain',
        description: 'Completas un entreno duro aun marcando fatiga alta.',
        emoji: '😈',
        category: 'mentalidad',
        unlockCondition: (stats) => stats.completedDespiteFatigue,
    },
    {
        id: 'mala_gana_mode',
        name: 'Ni con mala gana fallas',
        description: 'Día de baja motivación pero entreno completado.',
        emoji: '😤',
        category: 'mentalidad',
        unlockCondition: (stats) => stats.completedDespiteLowMotivation,
    },
    {
        id: 'storm_session',
        name: 'Tormenta interior',
        description: 'Día muy estresante, entreno completado.',
        emoji: '⛈️',
        category: 'mentalidad',
        unlockCondition: (stats) => stats.completedDespiteStress,
    },
    {
        id: 'no_mobile',
        name: 'Móvil en la taquilla',
        description: 'Entreno marcado como "sin distracciones".',
        emoji: '📵',
        category: 'mentalidad',
        unlockCondition: (stats) => stats.noDistractionsWorkout,
    },
    {
        id: 'focus_mode',
        name: 'Modo túnel',
        description: '5 entrenos marcados como "focus total".',
        emoji: '🎧',
        category: 'mentalidad',
        unlockCondition: (stats) => stats.focusModeWorkouts >= 5,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 👥 SOCIAL - Logros de comunidad y compartir
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'first_share',
        name: 'Presume un poco',
        description: 'Compartes un entreno al menos una vez.',
        emoji: '📸',
        category: 'social',
        unlockCondition: (stats) => stats.sharedWorkouts >= 1,
    },
    {
        id: 'share_streak',
        name: 'Evangelizador del hierro',
        description: 'Compartes entreno 5 veces.',
        emoji: '📣',
        category: 'social',
        unlockCondition: (stats) => stats.sharedWorkouts >= 5,
    },
    {
        id: 'referral_one',
        name: 'Recluta 1 discípulo',
        description: '1 amigo se registra con tu código.',
        emoji: '🧑‍🎓',
        category: 'social',
        targetValue: 1,
        progressKey: 'referrals',
        unlockCondition: (stats) => stats.referrals >= 1,
    },
    {
        id: 'referral_five',
        name: 'Crea tu ejército',
        description: '5 amigos se registran con tu código.',
        emoji: '🪖',
        category: 'social',
        targetValue: 5,
        progressKey: 'referrals',
        unlockCondition: (stats) => stats.referrals >= 5,
    },
    {
        id: 'referral_ten',
        name: 'Reclutador de élite',
        description: '10 amigos se registran con tu código.',
        emoji: '🎖️',
        category: 'social',
        targetValue: 10,
        progressKey: 'referrals',
        unlockCondition: (stats) => stats.referrals >= 10,
    },
    {
        id: 'referral_twenty',
        name: 'Líder de legión',
        description: '20 amigos se registran con tu código.',
        emoji: '👑',
        category: 'social',
        targetValue: 20,
        progressKey: 'referrals',
        unlockCondition: (stats) => stats.referrals >= 20,
    },
    {
        id: 'coach_mode_on',
        name: 'Modo coach activado',
        description: 'Asignas una rutina a otra persona (rol entrenador).',
        emoji: '🧠',
        category: 'social',
        unlockCondition: (stats) => stats.assignedRoutines >= 1,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 🥚 EASTER EGGS - Logros ocultos y especiales
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'bug_survivor',
        name: 'Sobreviviste al bug',
        description: 'Tras actualizar de versión, completas un entreno el mismo día.',
        emoji: '🐞',
        category: 'easter_egg',
        isHidden: true,
        unlockCondition: (stats) => stats.workoutAfterUpdate,
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene un logro por su ID
 */
export const getAchievementById = (id) => ACHIEVEMENTS.find(a => a.id === id);

/**
 * Filtra logros por categoría
 */
export const getAchievementsByCategory = (category) =>
    ACHIEVEMENTS.filter(a => a.category === category);

/**
 * Cuenta logros por categoría
 */
export const countAchievementsByCategory = () => {
    const counts = {};
    Object.keys(ACHIEVEMENT_CATEGORIES).forEach(cat => {
        counts[cat] = ACHIEVEMENTS.filter(a => a.category === cat).length;
    });
    return counts;
};

/**
 * Total de logros disponibles
 */
export const TOTAL_ACHIEVEMENTS = ACHIEVEMENTS.length;

export default ACHIEVEMENTS;
