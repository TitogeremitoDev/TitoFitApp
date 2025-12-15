// src/utils/calculateKPIs.js
// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE CÁLCULO DE KPIs PARA COACH PROGRESS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Agrupar sesiones por semana
 */
export const groupByWeek = (sessions) => {
    const weeks = new Map();

    sessions.forEach(session => {
        const date = new Date(session.date);
        const weekNum = session.week ?? getWeekNumber(date);

        if (!weeks.has(weekNum)) {
            weeks.set(weekNum, { week: weekNum, sessions: [], date });
        }
        weeks.get(weekNum).sessions.push(session);
    });

    return Array.from(weeks.values()).sort((a, b) => a.week - b.week);
};

/**
 * Filtrar sesiones por periodo
 */
export const filterByPeriod = (sessions, period) => {
    const now = new Date();
    let cutoff;

    switch (period) {
        case '7d':
            cutoff = new Date(now.setDate(now.getDate() - 7));
            break;
        case '30d':
            cutoff = new Date(now.setDate(now.getDate() - 30));
            break;
        case '90d':
            cutoff = new Date(now.setDate(now.getDate() - 90));
            break;
        default: // 'all'
            return sessions;
    }

    return sessions.filter(s => new Date(s.date) >= cutoff);
};

/**
 * Obtener número de semana del año
 */
const getWeekNumber = (date) => {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    return Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: FILTRAR EJERCICIOS POR MÚSCULO/EJERCICIO
// ═══════════════════════════════════════════════════════════════════════════
export const filterExercises = (session, selMusculo, selEjercicio) => {
    if (!session.exercises) return [];

    return session.exercises.filter(ex => {
        const muscle = ex.muscleGroup || '';
        const name = ex.exerciseName || '';

        if (selMusculo && selMusculo !== 'TOTAL' && muscle !== selMusculo) {
            return false;
        }
        if (selEjercicio && name !== selEjercicio) {
            return false;
        }
        return true;
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// KPI: INTENSIDAD RELATIVA (%)
// Fórmula: ((avgLoadPerRep / baseline) - 1) * 100
// Agrupación: Por semana, con filtros opcionales
// ═══════════════════════════════════════════════════════════════════════════
export const calcIntensityByWeek = (sessions, selMusculo = 'TOTAL', selEjercicio = '') => {
    const weeks = groupByWeek(sessions);
    let baseline = null;

    return weeks.map(({ week, sessions: weekSessions }) => {
        let totalVolume = 0;
        let totalReps = 0;

        weekSessions.forEach(session => {
            const exercises = filterExercises(session, selMusculo, selEjercicio);
            exercises.forEach(ex => {
                ex.sets?.forEach(set => {
                    const reps = set.actualReps || 0;
                    const weight = set.weight || 0;
                    totalVolume += reps * weight;
                    totalReps += reps;
                });
            });
        });

        const avgLoad = totalReps > 0 ? totalVolume / totalReps : 0;

        // Primera semana es el baseline
        if (baseline === null && avgLoad > 0) {
            baseline = avgLoad;
        }

        const intensity = baseline && baseline > 0
            ? ((avgLoad / baseline) - 1) * 100
            : 0;

        return {
            week,
            label: `S${week}`,
            value: Math.round(intensity * 10) / 10,
            avgLoad: Math.round(avgLoad * 10) / 10
        };
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// KPI 2: VOLUMEN ÚTIL (%)
// Fórmula: Σ(inRange volume) / Σ(total volume) * 100
// Agrupación: Por periodo (7d/30d/90d/all)
// ═══════════════════════════════════════════════════════════════════════════
export const calcUsefulVolume = (sessions) => {
    let usefulVol = 0;
    let totalVol = 0;

    sessions.forEach(session => {
        session.exercises?.forEach(ex => {
            ex.sets?.forEach(set => {
                const vol = (set.weight || 0) * (set.actualReps || 0);
                totalVol += vol;

                // Determinar si está en rango
                const reps = set.actualReps || 0;
                const min = set.targetRepsMin;
                const max = set.targetRepsMax;
                const inRange = (!min || reps >= min) && (!max || reps <= max);

                if (inRange && vol > 0) {
                    usefulVol += vol;
                }
            });
        });
    });

    return {
        useful: Math.round(usefulVol),
        total: Math.round(totalVol),
        percentage: totalVol > 0 ? Math.round((usefulVol / totalVol) * 1000) / 10 : 0
    };
};

// ═══════════════════════════════════════════════════════════════════════════
// KPI 3: CUMPLIMIENTO DEL PLAN (% sets inRange)
// Fórmula: count(inRange) / totalSets * 100
// Agrupación: Card=30d, Chart=weekly
// ═══════════════════════════════════════════════════════════════════════════
export const calcPlanComplianceByWeek = (sessions) => {
    const weeks = groupByWeek(sessions);

    return weeks.map(({ week, sessions: weekSessions }) => {
        let inRange = 0;
        let total = 0;

        weekSessions.forEach(session => {
            session.exercises?.forEach(ex => {
                ex.sets?.forEach(set => {
                    total++;
                    const reps = set.actualReps || 0;
                    const min = set.targetRepsMin;
                    const max = set.targetRepsMax;

                    if ((!min || reps >= min) && (!max || reps <= max)) {
                        inRange++;
                    }
                });
            });
        });

        return {
            week,
            label: `S${week}`,
            value: total > 0 ? Math.round((inRange / total) * 1000) / 10 : 0,
            inRange,
            total
        };
    });
};

export const calcPlanComplianceTotal = (sessions) => {
    let inRange = 0;
    let total = 0;

    sessions.forEach(session => {
        session.exercises?.forEach(ex => {
            ex.sets?.forEach(set => {
                total++;
                const reps = set.actualReps || 0;
                const min = set.targetRepsMin;
                const max = set.targetRepsMax;

                if ((!min || reps >= min) && (!max || reps <= max)) {
                    inRange++;
                }
            });
        });
    });

    return {
        inRange,
        total,
        percentage: total > 0 ? Math.round((inRange / total) * 1000) / 10 : 0
    };
};

// ═══════════════════════════════════════════════════════════════════════════
// KPI: RATIO CARGA ALTA (%)
// Fórmula: heavySet = weight >= 0.85 * maxWeight (del periodo completo)
// Agrupación: Por semana, con filtros opcionales
// ═══════════════════════════════════════════════════════════════════════════
export const calcHeavySetsByWeek = (sessions, selMusculo = 'TOTAL', selEjercicio = '') => {
    const weeks = groupByWeek(sessions);

    // Primero: encontrar el peso máximo HISTÓRICO por ejercicio (de todo el periodo)
    const exerciseMaxWeight = new Map();
    sessions.forEach(session => {
        const exercises = filterExercises(session, selMusculo, selEjercicio);
        exercises.forEach(ex => {
            const name = ex.exerciseName || 'unknown';
            const currentMax = exerciseMaxWeight.get(name) || 0;
            ex.sets?.forEach(set => {
                if ((set.weight || 0) > currentMax) {
                    exerciseMaxWeight.set(name, set.weight);
                }
            });
        });
    });

    return weeks.map(({ week, sessions: weekSessions }) => {
        let heavySets = 0;
        let totalSets = 0;

        weekSessions.forEach(session => {
            const exercises = filterExercises(session, selMusculo, selEjercicio);
            exercises.forEach(ex => {
                const name = ex.exerciseName || 'unknown';
                const maxWeight = exerciseMaxWeight.get(name) || 0;
                const threshold = maxWeight * 0.85; // 85% del máximo histórico

                ex.sets?.forEach(set => {
                    if ((set.weight || 0) > 0) {
                        totalSets++;
                        if (set.weight >= threshold && threshold > 0) {
                            heavySets++;
                        }
                    }
                });
            });
        });

        return {
            week,
            label: `S${week}`,
            value: totalSets > 0 ? Math.round((heavySets / totalSets) * 100) : 0,
            heavySets,
            totalSets
        };
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// KPI 6: BALANCE POR MÚSCULO (share %)
// Fórmula: volMusc / volTotal * 100
// Agrupación: Por periodo (30d/90d típico)
// ═══════════════════════════════════════════════════════════════════════════
export const calcMuscleBalance = (sessions) => {
    const muscleVolumes = {};
    let totalVol = 0;

    sessions.forEach(session => {
        session.exercises?.forEach(ex => {
            const muscle = ex.muscleGroup || 'OTROS';
            let exerciseVol = 0;

            ex.sets?.forEach(set => {
                exerciseVol += (set.weight || 0) * (set.actualReps || 0);
            });

            muscleVolumes[muscle] = (muscleVolumes[muscle] || 0) + exerciseVol;
            totalVol += exerciseVol;
        });
    });

    return Object.entries(muscleVolumes)
        .map(([muscle, volume]) => ({
            muscle,
            volume: Math.round(volume),
            share: totalVol > 0 ? Math.round((volume / totalVol) * 1000) / 10 : 0
        }))
        .sort((a, b) => b.share - a.share);
};

// ═══════════════════════════════════════════════════════════════════════════
// KPI 7: PR COUNT (récords por periodo)
// Fórmula: e1RM = weight * (1 + reps/30); PR si e1RM > max_histórico * 1.005
// Agrupación: Por semana
// ═══════════════════════════════════════════════════════════════════════════
export const calcPRCountByWeek = (sessions) => {
    const weeks = groupByWeek(sessions);

    // Historial de max e1RM por ejercicio
    const exerciseMaxE1RM = new Map();

    return weeks.map(({ week, sessions: weekSessions }) => {
        let prCount = 0;
        const prsThisWeek = [];

        weekSessions.forEach(session => {
            session.exercises?.forEach(ex => {
                const name = ex.exerciseName || 'unknown';
                let bestE1RM = 0;

                // Encontrar mejor e1RM de esta sesión para este ejercicio
                ex.sets?.forEach(set => {
                    const reps = set.actualReps || 0;
                    const weight = set.weight || 0;
                    if (reps > 0 && weight > 0) {
                        const e1RM = weight * (1 + reps / 30);
                        if (e1RM > bestE1RM) bestE1RM = e1RM;
                    }
                });

                // Comparar con histórico
                const historicalMax = exerciseMaxE1RM.get(name) || 0;

                if (bestE1RM > historicalMax * 1.005 && bestE1RM > 0) {
                    prCount++;
                    prsThisWeek.push(name);
                    exerciseMaxE1RM.set(name, bestE1RM);
                } else if (bestE1RM > historicalMax) {
                    // Actualizar max aunque no sea PR (< 0.5% mejora)
                    exerciseMaxE1RM.set(name, bestE1RM);
                }
            });
        });

        return {
            week,
            label: `S${week}`,
            value: prCount,
            exercises: prsThisWeek
        };
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES DE KPIs
// ═══════════════════════════════════════════════════════════════════════════
export const KPI_OPTIONS = [
    {
        id: 'volume',
        name: 'Volumen',
        icon: '📊',
        chartType: 'line',
        aggregation: 'weekly',
        description: 'Evolución del volumen total (kg×reps) por semana',
        unit: '%',
        useFilters: true
    },
    {
        id: 'intensity',
        name: 'Intensidad',
        icon: '💪',
        chartType: 'line',
        aggregation: 'weekly',
        description: 'Carga media por repetición vs primera semana',
        unit: '%',
        useFilters: true
    },
    {
        id: 'compliance',
        name: 'Cumplimiento',
        icon: '✅',
        chartType: 'line',
        aggregation: 'weekly',
        description: '% de sets dentro del rango de reps objetivo',
        unit: '%',
        useFilters: false
    },
    {
        id: 'heavySets',
        name: 'Carga Alta',
        icon: '🏋️',
        chartType: 'bar',
        aggregation: 'weekly',
        description: '% sets con ≥85% del peso máximo usado ese ejercicio',
        unit: '%',
        useFilters: true
    },
    {
        id: 'muscleBalance',
        name: 'Balance',
        icon: '⚖️',
        chartType: 'bar',
        aggregation: 'period',
        description: '% de volumen por grupo muscular',
        unit: '%',
        useFilters: false
    },
    {
        id: 'prCount',
        name: 'PRs',
        icon: '🏆',
        chartType: 'bar',
        aggregation: 'weekly',
        description: 'Récords personales estimados (e1RM)',
        unit: '',
        useFilters: true
    }
];

export const PERIOD_OPTIONS = [
    { id: '7d', label: '7 días' },
    { id: '30d', label: '30 días' },
    { id: '90d', label: '90 días' },
    { id: 'all', label: 'Todo' }
];

// ═══════════════════════════════════════════════════════════════════════════
// NUEVO KPI: VOLUMEN (% mejora semanal)
// Fórmula: ((volSemana / baseline) - 1) * 100
// ═══════════════════════════════════════════════════════════════════════════
export const calcVolumeByWeek = (sessions, selMusculo = 'TOTAL', selEjercicio = '') => {
    const weeks = groupByWeek(sessions);
    let baseline = null;

    return weeks.map(({ week, sessions: weekSessions }) => {
        let totalVolume = 0;

        weekSessions.forEach(session => {
            const exercises = filterExercises(session, selMusculo, selEjercicio);
            exercises.forEach(ex => {
                ex.sets?.forEach(set => {
                    totalVolume += (set.weight || 0) * (set.actualReps || 0);
                });
            });
        });

        // Primera semana es el baseline
        if (baseline === null && totalVolume > 0) {
            baseline = totalVolume;
        }

        const percentChange = baseline && baseline > 0
            ? ((totalVolume / baseline) - 1) * 100
            : 0;

        return {
            week,
            label: `S${week}`,
            value: Math.round(percentChange * 10) / 10,
            volume: Math.round(totalVolume),
            volumeK: (totalVolume / 1000).toFixed(1)
        };
    });
};

