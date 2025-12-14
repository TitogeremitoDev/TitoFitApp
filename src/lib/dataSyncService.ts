// src/lib/dataSyncService.ts
// Servicio de sincronización bidireccional de datos
// - FREE → PREMIUM: Sube datos locales a MongoDB
// - PREMIUM → FREE: Descarga datos de MongoDB a local

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE = ((process.env.EXPO_PUBLIC_API_URL as string) || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app').replace(/\/+$/, '');

// Tipos de usuario que se consideran "premium" (tienen acceso a la nube)
const PREMIUM_TYPES = ['PREMIUM', 'CLIENTE', 'ENTRENADOR', 'ADMINISTRADOR'];
const FREE_TYPE = 'FREEUSER';

export type SyncDirection = 'upload' | 'download';
export type SyncResult = {
    success: boolean;
    direction: SyncDirection;
    itemsSynced: number;
    error?: string;
};

/**
 * Determina si un tipo de usuario tiene acceso a la nube
 */
export function isPremiumType(tipoUsuario: string | undefined): boolean {
    return PREMIUM_TYPES.includes(tipoUsuario || '');
}

/**
 * Determina la dirección de sincronización basada en el cambio de plan
 * @returns 'upload' si pasa de FREE a PREMIUM, 'download' si pasa de PREMIUM a FREE, null si no hay cambio relevante
 */
export function getSyncDirection(
    previousType: string | undefined,
    newType: string
): SyncDirection | null {
    const wasPremium = isPremiumType(previousType);
    const isPremium = isPremiumType(newType);

    if (!wasPremium && isPremium) {
        // FREE → PREMIUM: subir datos locales a la nube
        return 'upload';
    } else if (wasPremium && !isPremium) {
        // PREMIUM → FREE: descargar datos de la nube a local
        return 'download';
    }
    return null; // No hay cambio de categoría
}

/**
 * Sube datos locales a la nube (FREE → PREMIUM)
 * Usa el endpoint existente de workouts
 */
export async function syncLocalToCloud(token: string): Promise<SyncResult> {
    try {
        console.log('[DataSync] Iniciando subida de datos locales a la nube...');

        // 1. Leer GLOBAL_LOG local
        const globalLogJson = await AsyncStorage.getItem('GLOBAL_LOG');
        const localLog: any[] = globalLogJson ? JSON.parse(globalLogJson) : [];

        if (localLog.length === 0) {
            console.log('[DataSync] No hay datos locales para subir');
            return { success: true, direction: 'upload', itemsSynced: 0 };
        }

        // 2. Agrupar entradas del log por fecha y rutina para crear workouts
        const workoutGroups = new Map<string, any[]>();

        localLog.forEach((entry) => {
            // Crear clave única por día + rutina
            const dateKey = entry.date?.split('T')[0] || 'unknown';
            const routineName = entry.routineName || 'Rutina';
            const groupKey = `${dateKey}|${routineName}`;

            if (!workoutGroups.has(groupKey)) {
                workoutGroups.set(groupKey, []);
            }
            workoutGroups.get(groupKey)!.push(entry);
        });

        let itemsSynced = 0;

        // 3. Para cada grupo, crear un workout y enviarlo a la API
        for (const [groupKey, entries] of workoutGroups) {
            try {
                // Agrupar por ejercicio
                const exerciseMap = new Map<string, any[]>();
                entries.forEach((e) => {
                    const key = `${e.muscle}|${e.exercise}`;
                    if (!exerciseMap.has(key)) {
                        exerciseMap.set(key, []);
                    }
                    exerciseMap.get(key)!.push(e);
                });

                // Construir estructura de workout
                const exercises = Array.from(exerciseMap.entries()).map(([key, sets], orderIndex) => {
                    const [muscleGroup, exerciseName] = key.split('|');
                    return {
                        exerciseId: null,
                        exerciseName,
                        muscleGroup,
                        orderIndex,
                        sets: sets.map((s, idx) => ({
                            setNumber: s.setIndex || idx + 1,
                            actualReps: s.reps || 0,
                            weight: s.load || 0,
                            status: 'inRange',
                        })),
                    };
                });

                const firstEntry = entries[0];
                const totalVolume = entries.reduce((sum, e) => sum + (e.volume || 0), 0);

                const workoutPayload = {
                    routineId: firstEntry.routineId || null,
                    routineNameSnapshot: firstEntry.routineName || 'Rutina',
                    dayIndex: 1,
                    dayLabel: `Día sincronizado`,
                    week: firstEntry.week || 1,
                    date: firstEntry.date || new Date().toISOString(),
                    status: 'completed',
                    exercises,
                    totalSets: entries.length,
                    totalVolume,
                    durationMinutes: 0,
                    fromLocalSync: true, // Marcar como sincronizado desde local
                };

                const response = await axios.post(`${API_BASE}/api/workouts`, workoutPayload, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (response.data?.success || response.status === 200 || response.status === 201) {
                    itemsSynced += entries.length;
                    console.log(`[DataSync] Workout sincronizado: ${groupKey} (${entries.length} sets)`);
                }
            } catch (err) {
                console.warn(`[DataSync] Error subiendo workout ${groupKey}:`, err);
                // Continuar con el siguiente grupo
            }
        }

        console.log(`[DataSync] Subida completada: ${itemsSynced} registros sincronizados`);
        return { success: true, direction: 'upload', itemsSynced };

    } catch (error) {
        console.error('[DataSync] Error en syncLocalToCloud:', error);
        return {
            success: false,
            direction: 'upload',
            itemsSynced: 0,
            error: error instanceof Error ? error.message : 'Error desconocido'
        };
    }
}

/**
 * Descarga datos de la nube a local (PREMIUM → FREE)
 * Transforma workouts de MongoDB a formato GLOBAL_LOG
 */
export async function syncCloudToLocal(token: string): Promise<SyncResult> {
    try {
        console.log('[DataSync] Iniciando descarga de datos de la nube a local...');

        // 1. Descargar workouts de la nube
        const response = await axios.get(`${API_BASE}/api/workouts?limit=1000`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const workouts = response.data?.workouts || [];

        if (workouts.length === 0) {
            console.log('[DataSync] No hay datos en la nube para descargar');
            return { success: true, direction: 'download', itemsSynced: 0 };
        }

        // 2. Transformar workouts a formato GLOBAL_LOG
        const logEntries: any[] = [];

        workouts.forEach((workout: any) => {
            const fecha = workout.date || new Date().toISOString();
            const nombreRutina = workout.routineNameSnapshot || 'Entreno';
            const semana = workout.week || 1;

            (workout.exercises || []).forEach((ejercicio: any) => {
                const musculo = ejercicio.muscleGroup || 'SIN GRUPO';
                const nombreEjercicio = ejercicio.exerciseName || 'Ejercicio';

                (ejercicio.sets || []).forEach((set: any, setIdx: number) => {
                    const reps = Number(set.actualReps) || 0;
                    const load = Number(set.weight) || 0;

                    if (reps > 0 || load > 0) {
                        const volume = reps * load;
                        const e1RM = reps > 0 && load > 0 ? load * (1 + reps / 30) : 0;

                        logEntries.push({
                            id: `cloud-${workout._id}-${ejercicio.exerciseId || ejercicio.exerciseName}-${setIdx}`,
                            date: fecha,
                            routineId: workout.routineId || null,
                            routineName: nombreRutina,
                            week: semana,
                            muscle: musculo,
                            exercise: nombreEjercicio,
                            setIndex: setIdx + 1,
                            reps,
                            load,
                            volume,
                            e1RM,
                            fromCloud: true,
                        });
                    }
                });
            });
        });

        // 3. Leer log local existente y fusionar evitando duplicados
        const existingLogJson = await AsyncStorage.getItem('GLOBAL_LOG');
        const existingLog: any[] = existingLogJson ? JSON.parse(existingLogJson) : [];

        // Crear set de IDs existentes para evitar duplicados
        const existingIds = new Set(existingLog.map(e => e.id));

        // Filtrar solo entradas nuevas
        const newEntries = logEntries.filter(e => !existingIds.has(e.id));

        // Fusionar y guardar
        const mergedLog = [...existingLog, ...newEntries];
        await AsyncStorage.setItem('GLOBAL_LOG', JSON.stringify(mergedLog));

        console.log(`[DataSync] Descarga completada: ${newEntries.length} nuevos registros guardados localmente`);
        return { success: true, direction: 'download', itemsSynced: newEntries.length };

    } catch (error) {
        console.error('[DataSync] Error en syncCloudToLocal:', error);
        return {
            success: false,
            direction: 'download',
            itemsSynced: 0,
            error: error instanceof Error ? error.message : 'Error desconocido'
        };
    }
}

/**
 * Maneja la transición de plan y ejecuta la sincronización apropiada
 * Retorna una promesa que resuelve cuando la sincronización termina
 */
export async function handlePlanTransition(
    previousType: string | undefined,
    newType: string,
    token: string,
    onProgress?: (direction: SyncDirection, progress: number) => void
): Promise<SyncResult | null> {
    const direction = getSyncDirection(previousType, newType);

    if (!direction) {
        console.log('[DataSync] No hay cambio de categoría de plan, omitiendo sincronización');
        return null;
    }

    console.log(`[DataSync] Detectado cambio de plan: ${previousType} → ${newType} (${direction})`);

    // Notificar inicio
    if (onProgress) {
        onProgress(direction, 0);
    }

    let result: SyncResult;

    if (direction === 'upload') {
        result = await syncLocalToCloud(token);
    } else {
        result = await syncCloudToLocal(token);
    }

    // Notificar finalización
    if (onProgress) {
        onProgress(direction, 100);
    }

    return result;
}
