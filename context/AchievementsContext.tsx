/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 CONTEXT DE LOGROS ESTILO STEAM - TOTALGAINS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Gestiona el estado de logros desbloqueados, estadísticas del usuario,
 * y la cola de toasts para mostrar logros recién desbloqueados.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACHIEVEMENTS, TOTAL_ACHIEVEMENTS } from '../src/data/achievements';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const UNLOCKED_ACHIEVEMENTS_KEY = 'totalgains_unlocked_achievements';
const USER_STATS_KEY = 'totalgains_user_stats';

// Estadísticas iniciales por defecto
const DEFAULT_STATS = {
    // Acumulados totales
    accumulatedReps: 0,
    accumulatedVolumeKg: 0,
    totalWorkouts: 0,
    totalPRs: 0,

    // Sesión actual (se actualizan cada entreno)
    sessionVolumeKg: 0,
    sessionReps: 0,
    muscleGroups: [],
    muscleGroupsWorked: 0,
    coreExercisesCount: 0,
    workoutHour: 0,
    workoutDurationMinutes: 0,
    workoutsToday: 0,

    // Streaks y constancia
    currentStreak: 0,
    workoutsThisWeek: 0,
    weeksOnTarget: 0,
    daysOnTarget: 0,
    daysSinceLastWorkout: 0,
    consecutiveMondays: 0,
    consecutiveFridays: 0,
    lastWorkoutDate: null,

    // Hábitos
    workoutsWithWarmup: 0,
    workoutsWithMobility: 0,
    consecutiveWaterGoalDays: 0,
    consecutiveSleepGoalDays: 0,
    daysWithoutInjury: 0,

    // Mentalidad
    completedDespiteFatigue: false,
    completedDespiteLowMotivation: false,
    completedDespiteStress: false,
    noDistractionsWorkout: false,
    focusModeWorkouts: 0,

    // Social
    sharedWorkouts: 0,
    referrals: 0,
    assignedRoutines: 0,

    // Easter eggs
    workoutAfterUpdate: false,
    justCompletedWorkout: false,

    // Volumen comparativo
    weeklyVolumeIncrease: 0,
    monthlyVolumeIncrease: 0,
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const AchievementsContext = createContext(null);

export const AchievementsProvider = ({ children }) => {
    const [unlockedIds, setUnlockedIds] = useState(new Set());
    const [userStats, setUserStats] = useState(DEFAULT_STATS);
    const [toastQueue, setToastQueue] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // ─────────────────────────────────────────────────────────────────────────
    // CARGAR DATOS AL INICIO
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const loadData = async () => {
            try {
                const [unlockedJson, statsJson] = await AsyncStorage.multiGet([
                    UNLOCKED_ACHIEVEMENTS_KEY,
                    USER_STATS_KEY,
                ]);

                if (unlockedJson[1]) {
                    const unlockedArray = JSON.parse(unlockedJson[1]);
                    setUnlockedIds(new Set(unlockedArray));
                }

                if (statsJson[1]) {
                    const savedStats = JSON.parse(statsJson[1]);
                    setUserStats(prev => ({ ...prev, ...savedStats }));
                }
            } catch (error) {
                console.error('[Achievements] Error loading data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // PERSISTIR DATOS
    // ─────────────────────────────────────────────────────────────────────────
    const saveUnlockedAchievements = useCallback(async (newUnlockedSet) => {
        try {
            const unlockedArray = Array.from(newUnlockedSet);
            await AsyncStorage.setItem(UNLOCKED_ACHIEVEMENTS_KEY, JSON.stringify(unlockedArray));
        } catch (error) {
            console.error('[Achievements] Error saving unlocked:', error);
        }
    }, []);

    const saveUserStats = useCallback(async (newStats) => {
        try {
            await AsyncStorage.setItem(USER_STATS_KEY, JSON.stringify(newStats));
        } catch (error) {
            console.error('[Achievements] Error saving stats:', error);
        }
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // ACTUALIZAR ESTADÍSTICAS
    // ─────────────────────────────────────────────────────────────────────────
    const updateStats = useCallback((partialStats) => {
        setUserStats(prev => {
            const newStats = { ...prev, ...partialStats };
            saveUserStats(newStats);
            return newStats;
        });
    }, [saveUserStats]);

    // ─────────────────────────────────────────────────────────────────────────
    // VERIFICAR Y DESBLOQUEAR LOGROS
    // ─────────────────────────────────────────────────────────────────────────
    const checkAchievements = useCallback((workoutSummary = {}) => {
        // Combinar stats guardadas con las del workout actual
        const combinedStats = {
            ...userStats,
            ...workoutSummary,
            justCompletedWorkout: true,
        };

        const newlyUnlocked = [];
        const currentUnlocked = new Set(unlockedIds);

        // Revisar cada logro
        ACHIEVEMENTS.forEach(achievement => {
            // Skip si ya está desbloqueado
            if (currentUnlocked.has(achievement.id)) return;

            // Verificar condición
            try {
                if (achievement.unlockCondition(combinedStats)) {
                    currentUnlocked.add(achievement.id);
                    newlyUnlocked.push(achievement);
                    console.log(`[Achievements] 🏆 Desbloqueado: ${achievement.name}`);
                }
            } catch (error) {
                console.warn(`[Achievements] Error checking "${achievement.id}":`, error);
            }
        });

        // Si hay nuevos logros, actualizar estado
        if (newlyUnlocked.length > 0) {
            setUnlockedIds(currentUnlocked);
            saveUnlockedAchievements(currentUnlocked);

            // Agregar a la cola de toasts
            setToastQueue(prev => [...prev, ...newlyUnlocked]);
        }

        return newlyUnlocked;
    }, [unlockedIds, userStats, saveUnlockedAchievements]);

    // ─────────────────────────────────────────────────────────────────────────
    // PROCESAR WORKOUT COMPLETADO
    // ─────────────────────────────────────────────────────────────────────────
    const processWorkoutCompletion = useCallback((workoutData) => {
        const now = new Date();
        const hour = now.getHours();
        const today = now.toDateString();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, 5 = Friday
        const isMonday = dayOfWeek === 1;
        const isFriday = dayOfWeek === 5;

        // Obtener fecha del último entreno
        const lastWorkoutDate = userStats.lastWorkoutDate
            ? new Date(userStats.lastWorkoutDate).toDateString()
            : null;
        const isNewDay = lastWorkoutDate !== today;
        const workoutsToday = isNewDay ? 1 : (userStats.workoutsToday || 0) + 1;

        // Calcular días desde último entreno
        let daysSinceLastWorkout = 0;
        if (userStats.lastWorkoutDate) {
            const lastDate = new Date(userStats.lastWorkoutDate);
            daysSinceLastWorkout = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        }

        // Extraer grupos musculares
        const muscleGroups = workoutData.muscleGroups || [];
        const uniqueMuscleGroups = [...new Set(muscleGroups.map(m => m?.toUpperCase()))];
        const coreExercisesCount = muscleGroups.filter(m =>
            ['CORE', 'ABS', 'ABDOMEN', 'ABDOMINAL', 'OBLICUO'].some(c =>
                m?.toUpperCase().includes(c)
            )
        ).length;

        // Preparar estadísticas del workout
        const workoutStats = {
            // Sesión actual
            sessionVolumeKg: workoutData.totalVolumeKg || 0,
            sessionReps: workoutData.totalReps || 0,
            muscleGroups: uniqueMuscleGroups,
            muscleGroupsWorked: uniqueMuscleGroups.length,
            coreExercisesCount,
            workoutHour: hour,
            workoutDurationMinutes: workoutData.durationMinutes || 0,
            workoutsToday,
            daysSinceLastWorkout: isNewDay ? daysSinceLastWorkout : userStats.daysSinceLastWorkout,

            // Acumulados (sumando a los existentes)
            accumulatedReps: (userStats.accumulatedReps || 0) + (workoutData.totalReps || 0),
            accumulatedVolumeKg: (userStats.accumulatedVolumeKg || 0) + (workoutData.totalVolumeKg || 0),
            totalWorkouts: (userStats.totalWorkouts || 0) + 1,

            // Actualizar fecha
            lastWorkoutDate: now.toISOString(),

            // Streak (simplificado - en producción sería más complejo)
            currentStreak: daysSinceLastWorkout <= 1 ? (userStats.currentStreak || 0) + 1 : 1,

            // Lunes/Viernes consecutivos
            consecutiveMondays: isMonday
                ? (userStats.consecutiveMondays || 0) + 1
                : userStats.consecutiveMondays || 0,
            consecutiveFridays: isFriday
                ? (userStats.consecutiveFridays || 0) + 1
                : userStats.consecutiveFridays || 0,
        };

        // Actualizar estadísticas
        updateStats(workoutStats);

        // Verificar logros
        return checkAchievements(workoutStats);
    }, [userStats, updateStats, checkAchievements]);

    // ─────────────────────────────────────────────────────────────────────────
    // GESTIÓN DE COLA DE TOASTS
    // ─────────────────────────────────────────────────────────────────────────
    const popToast = useCallback(() => {
        if (toastQueue.length === 0) return null;
        const [first, ...rest] = toastQueue;
        setToastQueue(rest);
        return first;
    }, [toastQueue]);

    const hasToasts = useMemo(() => toastQueue.length > 0, [toastQueue]);
    const nextToast = useMemo(() => toastQueue[0] || null, [toastQueue]);

    // ─────────────────────────────────────────────────────────────────────────
    // ESTADÍSTICAS DE PROGRESO
    // ─────────────────────────────────────────────────────────────────────────
    const unlockedCount = useMemo(() => unlockedIds.size, [unlockedIds]);
    const progressPercent = useMemo(() =>
        Math.round((unlockedIds.size / TOTAL_ACHIEVEMENTS) * 100),
        [unlockedIds]
    );

    const isAchievementUnlocked = useCallback((achievementId) =>
        unlockedIds.has(achievementId),
        [unlockedIds]
    );

    const getUnlockedAchievements = useCallback(() =>
        ACHIEVEMENTS.filter(a => unlockedIds.has(a.id)),
        [unlockedIds]
    );

    const getLockedAchievements = useCallback(() =>
        ACHIEVEMENTS.filter(a => !unlockedIds.has(a.id)),
        [unlockedIds]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // DEBUG: Desbloquear manualmente (solo desarrollo)
    // ─────────────────────────────────────────────────────────────────────────
    const debugUnlockAchievement = useCallback((achievementId) => {
        if (__DEV__) {
            const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
            if (achievement && !unlockedIds.has(achievementId)) {
                const newUnlocked = new Set(unlockedIds);
                newUnlocked.add(achievementId);
                setUnlockedIds(newUnlocked);
                saveUnlockedAchievements(newUnlocked);
                setToastQueue(prev => [...prev, achievement]);
                console.log(`[Achievements] DEBUG: Desbloqueado manual: ${achievement.name}`);
                return true;
            }
        }
        return false;
    }, [unlockedIds, saveUnlockedAchievements]);

    const debugResetAll = useCallback(async () => {
        if (__DEV__) {
            setUnlockedIds(new Set());
            setUserStats(DEFAULT_STATS);
            setToastQueue([]);
            await AsyncStorage.multiRemove([UNLOCKED_ACHIEVEMENTS_KEY, USER_STATS_KEY]);
            console.log('[Achievements] DEBUG: Reset completo');
        }
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // VALOR DEL CONTEXTO
    // ─────────────────────────────────────────────────────────────────────────
    const value = useMemo(() => ({
        // Estado
        isLoading,
        userStats,
        unlockedIds,
        unlockedCount,
        progressPercent,
        totalAchievements: TOTAL_ACHIEVEMENTS,

        // Toasts
        hasToasts,
        nextToast,
        toastQueue,
        popToast,

        // Acciones principales
        processWorkoutCompletion,
        checkAchievements,
        updateStats,

        // Consultas
        isAchievementUnlocked,
        getUnlockedAchievements,
        getLockedAchievements,

        // Debug (solo dev)
        debugUnlockAchievement,
        debugResetAll,
    }), [
        isLoading, userStats, unlockedIds, unlockedCount, progressPercent,
        hasToasts, nextToast, toastQueue, popToast,
        processWorkoutCompletion, checkAchievements, updateStats,
        isAchievementUnlocked, getUnlockedAchievements, getLockedAchievements,
        debugUnlockAchievement, debugResetAll,
    ]);

    return (
        <AchievementsContext.Provider value={value}>
            {children}
        </AchievementsContext.Provider>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// HOOK DE USO
// ═══════════════════════════════════════════════════════════════════════════

export const useAchievements = () => {
    const ctx = useContext(AchievementsContext);
    if (!ctx) {
        throw new Error('useAchievements debe usarse dentro de <AchievementsProvider>');
    }
    return ctx;
};

export default AchievementsContext;
