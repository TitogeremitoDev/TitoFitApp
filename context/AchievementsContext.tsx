/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 CONTEXT DE LOGROS ESTILO STEAM - TOTALGAINS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Gestiona el estado de logros desbloqueados, estadísticas del usuario,
 * y la cola de toasts para mostrar logros recién desbloqueados.
 */

// Declaración de __DEV__ (variable global de React Native)
declare const __DEV__: boolean;

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { ACHIEVEMENTS, TOTAL_ACHIEVEMENTS } from '../src/data/achievements';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const UNLOCKED_ACHIEVEMENTS_KEY = 'totalgains_unlocked_achievements';
const USER_STATS_KEY = 'totalgains_user_stats';

// Estadísticas iniciales por defecto
const DEFAULT_STATS = {
    // ═══════════════════════════════════════════════════════════════════════
    // ACUMULADOS TOTALES (nunca se resetean)
    // ═══════════════════════════════════════════════════════════════════════
    accumulatedReps: 0,
    accumulatedVolumeKg: 0,
    accumulatedLegVolumeKg: 0,
    accumulatedPushVolumeKg: 0,
    accumulatedPullVolumeKg: 0,
    totalWorkouts: 0,
    totalPRs: 0,
    totalSteps: 0,
    totalCheckins: 0,
    totalWeeklyCheckins: 0,

    // ═══════════════════════════════════════════════════════════════════════
    // SESIÓN ACTUAL (se actualizan cada entreno)
    // ═══════════════════════════════════════════════════════════════════════
    sessionVolumeKg: 0,
    sessionReps: 0,
    muscleGroups: [] as string[],
    muscleGroupsWorked: 0,
    coreExercisesCount: 0,
    workoutHour: 0,
    workoutDurationMinutes: 0,
    workoutsToday: 0,
    legVolumeRatio: 0,
    pushVolumeRatio: 0,
    pullVolumeRatio: 0,

    // ═══════════════════════════════════════════════════════════════════════
    // STREAKS Y CONSTANCIA
    // ═══════════════════════════════════════════════════════════════════════
    currentStreak: 0,
    workoutsThisWeek: 0,
    weeksOnTarget: 0,
    daysOnTarget: 0,
    daysSinceLastWorkout: 0,
    consecutiveMondays: 0,
    consecutiveFridays: 0,
    lastWorkoutDate: null as string | null,

    // Check-in streaks
    checkinStreak: 0,
    weeklyCheckinStreak: 0,
    lastCheckinDate: null as string | null,
    lastWeeklyCheckinDate: null as string | null,

    // ═══════════════════════════════════════════════════════════════════════
    // SEGUIMIENTO DIARIO
    // ═══════════════════════════════════════════════════════════════════════
    // Peso corporal
    bodyWeight: 0,
    weightLogs: 0,
    firstWeightLog: false,

    // Pasos
    dailySteps: 0,
    daysOver5kSteps: 0,
    daysOver8kSteps: 0,
    daysOver10kSteps: 0,
    weeksWith10kDaily: 0,

    // Sueño
    sleepHours: 0,
    sleepDays7h: 0,
    sleepDays8h: 0,
    sleepStreak7h: 0,
    sleepStreak8h: 0,
    avgSleepHours: 0,

    // Ánimo
    moodScore: 3,
    goodMoodDays: 0,
    greatMoodDays: 0,
    moodStreak4Plus: 0,

    // Energía
    energyScore: 3,
    highEnergyDays: 0,
    energyStreak4Plus: 0,

    // ═══════════════════════════════════════════════════════════════════════
    // SEGUIMIENTO SEMANAL
    // ═══════════════════════════════════════════════════════════════════════
    // Nutrición
    nutritionAdherence: 0,
    nutritionAdherenceStreak8Plus: 0,
    perfectNutritionWeeks: 0,

    // Entrenamiento
    trainingAdherence: 0,
    trainingAdherenceStreak8Plus: 0,

    // Sensaciones
    motivationScore: 3,
    stressScore: 3,
    lowStressWeeks: 0,
    highMotivationWeeks: 0,

    // Reflexiones
    weeklyReflections: 0,
    improvementNotes: 0,

    // ═══════════════════════════════════════════════════════════════════════
    // HÁBITOS
    // ═══════════════════════════════════════════════════════════════════════
    workoutsWithWarmup: 0,
    workoutsWithMobility: 0,
    consecutiveWaterGoalDays: 0,
    consecutiveSleepGoalDays: 0,
    daysWithoutInjury: 0,

    // ═══════════════════════════════════════════════════════════════════════
    // MENTALIDAD
    // ═══════════════════════════════════════════════════════════════════════
    completedDespiteFatigue: false,
    completedDespiteLowMotivation: false,
    completedDespiteStress: false,
    noDistractionsWorkout: false,
    focusModeWorkouts: 0,
    noSkippedSets: false,

    // ═══════════════════════════════════════════════════════════════════════
    // SOCIAL
    // ═══════════════════════════════════════════════════════════════════════
    sharedWorkouts: 0,
    referrals: 0,
    assignedRoutines: 0,

    // ═══════════════════════════════════════════════════════════════════════
    // PRs DE EJERCICIOS ESPECÍFICOS
    // ═══════════════════════════════════════════════════════════════════════
    benchPR: 0,
    squatPR: 0,
    deadliftPR: 0,
    legPressPR: 0,
    ohpPR: 0,
    bigThreeTotal: 0,
    prSessions: 0,

    // ═══════════════════════════════════════════════════════════════════════
    // VOLUMEN SEMANAL/MENSUAL
    // ═══════════════════════════════════════════════════════════════════════
    weeklyVolumeKg: 0,
    monthlyVolumeKg: 0,
    weeklyVolumeIncrease: 0,
    monthlyVolumeIncrease: 0,

    // ═══════════════════════════════════════════════════════════════════════
    // EASTER EGGS
    // ═══════════════════════════════════════════════════════════════════════
    workoutAfterUpdate: false,
    justCompletedWorkout: false,
    yearsTraining: 0,
    progressingConsistently: false,
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

// Tipos para el contexto
type Achievement = {
    id: string;
    name: string;
    points?: number;
    unlockCondition: (stats: UserStats) => boolean;
    [key: string]: any;
};

type UserStats = typeof DEFAULT_STATS;

const AchievementsContext = createContext<any>(null);

export const AchievementsProvider = ({ children }: { children: React.ReactNode }) => {
    const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
    const [userStats, setUserStats] = useState<UserStats>(DEFAULT_STATS);
    const [toastQueue, setToastQueue] = useState<Achievement[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [serverPoints, setServerPoints] = useState<number | null>(null); // Puntos del servidor (para usuarios premium)

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
    // PERSISTIR DATOS (Local siempre + Cloud para premium)
    // ─────────────────────────────────────────────────────────────────────────

    // Flag para saber si el usuario es premium (se puede pasar desde AuthContext)
    const isPremiumRef = useRef(false);

    const setIsPremium = useCallback((value: boolean) => {
        isPremiumRef.current = value;
    }, []);

    const saveUnlockedAchievements = useCallback(async (newUnlockedSet: Set<string>) => {
        try {
            const unlockedArray = Array.from(newUnlockedSet);
            // Siempre guardar en local
            await AsyncStorage.setItem(UNLOCKED_ACHIEVEMENTS_KEY, JSON.stringify(unlockedArray));

            // Si es premium, también guardar en la nube
            if (isPremiumRef.current) {
                try {
                    await axios.patch('/progress', { unlockedAchievements: unlockedArray });
                } catch (cloudError) {
                    console.warn('[Achievements] Error syncing achievements to cloud:', cloudError);
                }
            }
        } catch (error) {
            console.error('[Achievements] Error saving unlocked:', error);
        }
    }, []);

    const saveUserStats = useCallback(async (newStats: Partial<UserStats>) => {
        try {
            // Siempre guardar en local
            await AsyncStorage.setItem(USER_STATS_KEY, JSON.stringify(newStats));

            // Si es premium, también guardar en la nube
            if (isPremiumRef.current) {
                try {
                    await axios.patch('/progress', newStats);
                } catch (cloudError) {
                    console.warn('[Achievements] Error syncing stats to cloud:', cloudError);
                }
            }
        } catch (error) {
            console.error('[Achievements] Error saving stats:', error);
        }
    }, []);

    // Función para sincronizar con la nube (llamar al cambiar a premium)
    const syncWithCloud = useCallback(async () => {
        if (!isPremiumRef.current) return;

        try {
            console.log('[Achievements] Sincronizando con la nube...');

            // Preparar datos locales para sync
            const localStats = { ...userStats };
            const localAchievements = Array.from(unlockedIds);

            // Llamar endpoint de sync que hace merge inteligente
            const response = await axios.post('/progress/sync', {
                ...localStats,
                unlockedAchievements: localAchievements
            });

            if (response.data?.success && response.data?.data) {
                const cloudData = response.data.data;

                // Actualizar estado local con datos merged
                setUserStats(cloudData);
                await AsyncStorage.setItem(USER_STATS_KEY, JSON.stringify(cloudData));

                if (cloudData.unlockedAchievements) {
                    setUnlockedIds(new Set(cloudData.unlockedAchievements));
                    await AsyncStorage.setItem(
                        UNLOCKED_ACHIEVEMENTS_KEY,
                        JSON.stringify(cloudData.unlockedAchievements)
                    );
                }

                console.log('[Achievements] Sincronización completada:', response.data.action);
            }
        } catch (error) {
            console.error('[Achievements] Error syncing with cloud:', error);
        }
    }, [userStats, unlockedIds]);

    // Cargar desde la nube para usuarios premium (solo una vez)
    const hasLoadedFromCloudRef = useRef(false);

    const loadFromCloud = useCallback(async () => {
        if (!isPremiumRef.current) return;
        if (hasLoadedFromCloudRef.current) return; // Evitar múltiples cargas

        hasLoadedFromCloudRef.current = true;

        try {
            // 1. Cargar stats de progreso
            const progressResponse = await axios.get('/progress');
            if (progressResponse.data?.success && progressResponse.data?.data) {
                const cloudData = progressResponse.data.data;

                // Merge con datos locales (tomar el mayor)
                setUserStats(prev => {
                    const merged = { ...prev };
                    Object.keys(cloudData).forEach(key => {
                        if (typeof cloudData[key] === 'number' && typeof merged[key as keyof typeof merged] === 'number') {
                            (merged as any)[key] = Math.max(cloudData[key], (merged as any)[key]);
                        } else if (cloudData[key] !== undefined) {
                            (merged as any)[key] = cloudData[key];
                        }
                    });
                    return merged;
                });
                console.log('[Achievements] Stats cargadas desde la nube');
            }

            // 2. Cargar achievements del usuario (del nuevo endpoint)
            // En un try-catch separado para que no afecte si el endpoint no existe
            try {
                const achievementsResponse = await axios.get('/achievements');
                const data = achievementsResponse.data;

                if (data?.achievementsComplete) {
                    const serverAchievements: string[] = data.achievementsComplete;

                    // Merge achievements locales con los del servidor
                    setUnlockedIds(prev => {
                        const merged = new Set([...prev, ...serverAchievements]);
                        // Guardar en local también
                        AsyncStorage.setItem(
                            UNLOCKED_ACHIEVEMENTS_KEY,
                            JSON.stringify(Array.from(merged))
                        );
                        console.log(`[Achievements] ${serverAchievements.length} logros del servidor, total: ${merged.size}`);
                        return merged;
                    });
                }

                // Cargar puntos del servidor (tienen prioridad sobre cálculo local)
                if (typeof data?.points === 'number') {
                    setServerPoints(data.points);
                    console.log(`[Achievements] Puntos del servidor: ${data.points}`);
                }
            } catch (achievementError: any) {
                // Si el endpoint no existe (404) o falla (500), simplemente ignoramos y usamos datos locales
                // Esto es esperado mientras el endpoint no esté desplegado en producción
                const status = achievementError?.response?.status;
                if (status !== 404 && status !== 500) {
                    console.warn('[Achievements] Error cargando achievements:', achievementError?.message);
                }
            }

        } catch (error) {
            console.warn('[Achievements] Error loading from cloud:', error);
            hasLoadedFromCloudRef.current = false; // Permitir reintentar en caso de error
        }
    }, []); // Sin dependencias - solo se ejecuta una vez

    // ─────────────────────────────────────────────────────────────────────────
    // ACTUALIZAR ESTADÍSTICAS
    // ─────────────────────────────────────────────────────────────────────────
    const updateStats = useCallback((partialStats: Partial<UserStats>) => {
        setUserStats(prev => {
            const newStats = { ...prev, ...partialStats };
            saveUserStats(newStats);
            return newStats;
        });
    }, [saveUserStats]);

    // ─────────────────────────────────────────────────────────────────────────
    // VERIFICAR Y DESBLOQUEAR LOGROS
    // ─────────────────────────────────────────────────────────────────────────
    const checkAchievements = useCallback((workoutSummary: Partial<UserStats> = {}, context: 'workout' | 'checkin' | 'weekly' = 'workout') => {
        // Combinar stats guardadas con las del evento actual
        // justCompletedWorkout será true SOLO si el contexto es 'workout'
        const combinedStats = {
            ...userStats,
            ...workoutSummary,
            justCompletedWorkout: context === 'workout',
        };

        const newlyUnlocked: Achievement[] = [];
        const currentUnlocked = new Set<string>(unlockedIds);

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

            // Sincronizar con el endpoint de achievements (en background)
            if (isPremiumRef.current) {
                try {
                    const achievementsToSync = newlyUnlocked.map(a => ({
                        id: a.id,
                        points: a.points || 0
                    }));
                    axios.post('/achievements/sync', { achievements: achievementsToSync })
                        .then((response) => {
                            console.log('[Achievements] Sincronizados con servidor:', response.data);
                        })
                        .catch((error) => {
                            console.warn('[Achievements] Error syncing to server:', error);
                        });
                } catch (e) {
                    console.warn('[Achievements] Error preparando sync:', e);
                }
            }
        }

        return newlyUnlocked;
    }, [unlockedIds, userStats, saveUnlockedAchievements]);

    // ─────────────────────────────────────────────────────────────────────────
    // PROCESAR WORKOUT COMPLETADO
    // ─────────────────────────────────────────────────────────────────────────
    const processWorkoutCompletion = useCallback((workoutData: any) => {
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
            daysSinceLastWorkout = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Extraer grupos musculares
        const muscleGroups: string[] = workoutData.muscleGroups || [];
        const uniqueMuscleGroups: string[] = [...new Set(muscleGroups.map((m: string) => m?.toUpperCase()))];
        const coreExercisesCount = muscleGroups.filter((m: string) =>
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

        // Verificar logros (contexto explícito: workout)
        return checkAchievements(workoutStats, 'workout');
    }, [userStats, updateStats, checkAchievements]);

    // ─────────────────────────────────────────────────────────────────────────
    // PROCESAR CHECK-IN DIARIO
    // ─────────────────────────────────────────────────────────────────────────
    const processDailyCheckin = useCallback((checkinData: any) => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Verificar si es un nuevo día (para streaks)
        const lastCheckin = userStats.lastCheckinDate;
        let checkinStreak = userStats.checkinStreak || 0;

        if (lastCheckin) {
            const lastDate = new Date(lastCheckin);
            const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // Día consecutivo
                checkinStreak += 1;
            } else if (diffDays > 1) {
                // Se rompió el streak
                checkinStreak = 1;
            }
            // Si es el mismo día, no cambia el streak
        } else {
            checkinStreak = 1;
        }

        // Parsear valores
        const peso = parseFloat(checkinData.peso) || 0;
        const sueno = parseFloat(checkinData.sueno) || 0;
        const animo = checkinData.animo || 3;
        const energia = checkinData.energia || 3;
        const pasos = parseInt(checkinData.pasos) || 0;

        // Calcular stats actualizadas
        const newStats = {
            // Fecha del último check-in
            lastCheckinDate: today,
            checkinStreak,
            totalCheckins: (userStats.totalCheckins || 0) + 1,

            // Peso corporal
            bodyWeight: peso > 0 ? peso : userStats.bodyWeight,
            weightLogs: peso > 0 ? (userStats.weightLogs || 0) + 1 : userStats.weightLogs,
            firstWeightLog: peso > 0 || userStats.firstWeightLog,

            // Pasos
            dailySteps: pasos,
            totalSteps: (userStats.totalSteps || 0) + pasos,
            daysOver5kSteps: pasos >= 5000 ? (userStats.daysOver5kSteps || 0) + 1 : userStats.daysOver5kSteps,
            daysOver8kSteps: pasos >= 8000 ? (userStats.daysOver8kSteps || 0) + 1 : userStats.daysOver8kSteps,
            daysOver10kSteps: pasos >= 10000 ? (userStats.daysOver10kSteps || 0) + 1 : userStats.daysOver10kSteps,

            // Sueño
            sleepHours: sueno,
            sleepDays7h: sueno >= 7 ? (userStats.sleepDays7h || 0) + 1 : userStats.sleepDays7h,
            sleepDays8h: sueno >= 8 ? (userStats.sleepDays8h || 0) + 1 : userStats.sleepDays8h,
            sleepStreak7h: sueno >= 7 ? (userStats.sleepStreak7h || 0) + 1 : 0,
            sleepStreak8h: sueno >= 8 ? (userStats.sleepStreak8h || 0) + 1 : 0,

            // Ánimo
            moodScore: animo,
            goodMoodDays: animo >= 4 ? (userStats.goodMoodDays || 0) + 1 : userStats.goodMoodDays,
            greatMoodDays: animo >= 5 ? (userStats.greatMoodDays || 0) + 1 : userStats.greatMoodDays,
            moodStreak4Plus: animo >= 4 ? (userStats.moodStreak4Plus || 0) + 1 : 0,

            // Energía
            energyScore: energia,
            highEnergyDays: energia >= 4 ? (userStats.highEnergyDays || 0) + 1 : userStats.highEnergyDays,
            energyStreak4Plus: energia >= 4 ? (userStats.energyStreak4Plus || 0) + 1 : 0,
        };

        // Actualizar estadísticas
        updateStats(newStats);

        // Verificar logros
        return checkAchievements(newStats, 'checkin');
    }, [userStats, updateStats, checkAchievements]);

    // ─────────────────────────────────────────────────────────────────────────
    // PROCESAR CHECK-IN SEMANAL
    // ─────────────────────────────────────────────────────────────────────────
    const processWeeklyCheckin = useCallback((weeklyData: any) => {
        const now = new Date();
        const weekKey = now.toISOString().split('T')[0];

        // Verificar streak semanal
        const lastWeekly = userStats.lastWeeklyCheckinDate;
        let weeklyStreak = userStats.weeklyCheckinStreak || 0;

        if (lastWeekly) {
            const lastDate = new Date(lastWeekly);
            const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays >= 5 && diffDays <= 9) {
                // Una semana aproximada (5-9 días)
                weeklyStreak += 1;
            } else if (diffDays > 9) {
                // Se rompió el streak
                weeklyStreak = 1;
            }
        } else {
            weeklyStreak = 1;
        }

        // Parsear valores
        const nutriAdherencia = weeklyData.nutriAdherencia || 5;
        const entrenoAdherencia = weeklyData.entrenoAdherencia || 5;
        const sensMotivacion = weeklyData.sensMotivacion || 3;
        const sensEstres = weeklyData.sensEstres || 3;
        const sensSuenoMedio = parseFloat(weeklyData.sensSuenoMedio) || 0;
        const hasReflection = (weeklyData.topMejorar?.trim() || weeklyData.topBien?.trim()) ? 1 : 0;

        // Calcular stats actualizadas
        const newStats = {
            // Fecha del último check-in semanal
            lastWeeklyCheckinDate: weekKey,
            weeklyCheckinStreak: weeklyStreak,
            totalWeeklyCheckins: (userStats.totalWeeklyCheckins || 0) + 1,

            // Nutrición
            nutritionAdherence: nutriAdherencia,
            nutritionAdherenceStreak8Plus: nutriAdherencia >= 8
                ? (userStats.nutritionAdherenceStreak8Plus || 0) + 1
                : 0,
            perfectNutritionWeeks: nutriAdherencia >= 9
                ? (userStats.perfectNutritionWeeks || 0) + 1
                : userStats.perfectNutritionWeeks,

            // Entrenamiento
            trainingAdherence: entrenoAdherencia,
            trainingAdherenceStreak8Plus: entrenoAdherencia >= 8
                ? (userStats.trainingAdherenceStreak8Plus || 0) + 1
                : 0,

            // Sensaciones
            motivationScore: sensMotivacion,
            stressScore: sensEstres,
            highMotivationWeeks: sensMotivacion >= 4
                ? (userStats.highMotivationWeeks || 0) + 1
                : userStats.highMotivationWeeks,
            lowStressWeeks: sensEstres <= 2
                ? (userStats.lowStressWeeks || 0) + 1
                : userStats.lowStressWeeks,

            // Sueño promedio
            avgSleepHours: sensSuenoMedio > 0 ? sensSuenoMedio : userStats.avgSleepHours,

            // Reflexiones
            weeklyReflections: (userStats.weeklyReflections || 0) + 1,
            improvementNotes: (userStats.improvementNotes || 0) + hasReflection,
        };

        // Actualizar estadísticas
        updateStats(newStats);

        // Verificar logros
        return checkAchievements(newStats, 'weekly');
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

    const isAchievementUnlocked = useCallback((achievementId: string) =>
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
    const debugUnlockAchievement = useCallback((achievementId: string) => {
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
        serverPoints, // Puntos del servidor (para usuarios premium)

        // Toasts
        hasToasts,
        nextToast,
        toastQueue,
        popToast,

        // Acciones principales
        processWorkoutCompletion,
        processDailyCheckin,
        processWeeklyCheckin,
        checkAchievements,
        updateStats,

        // Consultas
        isAchievementUnlocked,
        getUnlockedAchievements,
        getLockedAchievements,

        // Cloud sync (para premium)
        setIsPremium,
        syncWithCloud,
        loadFromCloud,

        // Debug (solo dev)
        debugUnlockAchievement,
        debugResetAll,
    }), [
        isLoading, userStats, unlockedIds, unlockedCount, progressPercent, serverPoints,
        hasToasts, nextToast, toastQueue, popToast,
        processWorkoutCompletion, processDailyCheckin, processWeeklyCheckin,
        checkAchievements, updateStats,
        isAchievementUnlocked, getUnlockedAchievements, getLockedAchievements,
        setIsPremium, syncWithCloud, loadFromCloud,
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
