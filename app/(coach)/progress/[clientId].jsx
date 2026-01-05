/* coach/progress/[clientId].jsx
   ═══════════════════════════════════════════════════════════════════════════
   ANÁLISIS DETALLADO DE CLIENTE - CHARTS 2.0
   - Sistema de KPIs avanzado con 6 métricas
   - Selector modal de KPI (cross-platform)
   - Filtro de periodo (7d/30d/90d/all)
   - Tarjetas de resumen + gráficos por semana
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    Pressable,
    Dimensions,
    Modal,
    TouchableOpacity,
    FlatList,
    Platform,
    ActionSheetIOS,
    useWindowDimensions,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Picker } from '@react-native-picker/picker'
import { useAuth } from '../../../context/AuthContext';
import { useFeedbackBubble } from '../../../context/FeedbackBubbleContext';
import MediaFeedbackResponseModal from '../../../src/components/coach/MediaFeedbackResponseModal';
import InlineAudioPlayer from '../../../src/components/coach/InlineAudioPlayer';

// KPI Utilities
import {
    KPI_OPTIONS,
    PERIOD_OPTIONS,
    filterByPeriod,
    filterExercises,
    calcVolumeByWeek,
    calcIntensityByWeek,
    calcPlanComplianceByWeek,
    calcPlanComplianceTotal,
    calcHeavySetsByWeek,
    calcMuscleBalance,
    calcPRCountByWeek,
    calcSessionRPEByDay,
    RPE_COLORS,
    RPE_LABELS,
} from '../../../src/utils/calculateKPIs';

const screenWidth = Dimensions.get('window').width;

// Configuración del gráfico
const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#f8fafc',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
    propsForDots: { r: '5', strokeWidth: '2', stroke: '#3b82f6' },
    fillShadowGradient: '#3b82f6',
    fillShadowGradientOpacity: 0.3,
};

// Configuración para BarChart - colores más vibrantes
const barChartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#f8fafc',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`, // Indigo más vibrante
    labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
    barPercentage: 0.65,
    fillShadowGradient: '#6366f1',
    fillShadowGradientOpacity: 1,
    propsForBackgroundLines: {
        strokeDasharray: '',
        stroke: '#e2e8f0',
        strokeWidth: 1,
    },
};

export default function ClientProgressDetail() {
    const router = useRouter();
    const { clientId, clientName } = useLocalSearchParams();
    const { token } = useAuth();

    // 🖥️ Responsive layout - split view on large screens
    const { width: windowWidth } = useWindowDimensions();
    const isLargeScreen = windowWidth >= 900; // Tablet/Desktop threshold

    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [temporalidad, setTemporalidad] = useState('semanas');

    // 📊 KPI System 2.0
    const [selectedKpi, setSelectedKpi] = useState('volume');
    const [kpiModalVisible, setKpiModalVisible] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState('30d');

    // Nuevos estados para filtros
    const [selMusculo, setSelMusculo] = useState('TOTAL'); // 'TOTAL' = todos
    const [selEjercicio, setSelEjercicio] = useState('');

    // 📊 Modales para pickers Android
    const [androidMusculoModal, setAndroidMusculoModal] = useState(false);
    const [androidEjercicioModal, setAndroidEjercicioModal] = useState(false);

    // 📊 Vista: gráfica o tabla detallada
    const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'table' | 'comments' | 'multimedia'

    // 📝 Modal de notas del cliente
    const [noteModal, setNoteModal] = useState({ visible: false, note: null });

    // 📹 Video Feedback (Multimedia)
    const [videoFeedbacks, setVideoFeedbacks] = useState([]);
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const [selectedFeedback, setSelectedFeedback] = useState(null);
    const [loadingVideos, setLoadingVideos] = useState(false);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    // ═══════════════════════════════════════════════════════════════════════════
    // CARGAR WORKOUTS
    // ═══════════════════════════════════════════════════════════════════════════
    const cargarSesiones = useCallback(async () => {
        try {
            setIsLoading(true);
            const tressMesesAtras = new Date();
            tressMesesAtras.setMonth(tressMesesAtras.getMonth() - 3);

            const response = await fetch(
                `${API_URL}/api/workouts/by-user/${clientId}?limit=200&startDate=${tressMesesAtras.toISOString()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const data = await response.json();
            if (data.success) {
                setSessions(data.workouts || []);
            }
        } catch (error) {
            console.error('[ClientProgress] Error:', error);
        } finally {
            setIsLoading(false);
        }
    }, [clientId, token, API_URL]);

    useEffect(() => {
        cargarSesiones();
        cargarVideoFeedbacks();
    }, [cargarSesiones]);

    // ═══════════════════════════════════════════════════════════════════════════
    // CARGAR VIDEO FEEDBACKS DEL CLIENTE
    // ═══════════════════════════════════════════════════════════════════════════
    const cargarVideoFeedbacks = useCallback(async () => {
        try {
            setLoadingVideos(true);
            const response = await fetch(
                `${API_URL}/api/video-feedback/inbox?athleteId=${clientId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await response.json();
            // El backend devuelve { feedbacks, total, pendingCount, page, pages }
            if (data.feedbacks) {
                setVideoFeedbacks(data.feedbacks);
                console.log('[ClientProgress] Video feedbacks cargados:', data.feedbacks.length);
                // 🔍 DEBUG: Log first 3 feedbacks for debugging
                console.log('[DEBUG] Sample feedbacks:', data.feedbacks.slice(0, 5).map(f => ({
                    exerciseName: f.exerciseName,
                    serieKey: f.serieKey,
                    r2Key: f.r2Key,
                    createdAt: f.createdAt,
                    mediaType: f.mediaType
                })));
            }
        } catch (error) {
            console.error('[ClientProgress] Error loading video feedbacks:', error);
        } finally {
            setLoadingVideos(false);
        }
    }, [clientId, token, API_URL]);

    const handleVideoResponseSent = (feedbackId) => {
        // Actualizar el feedback como respondido
        setVideoFeedbacks(prev => prev.map(f =>
            f._id === feedbackId
                ? { ...f, status: 'responded', viewedByCoach: true }
                : f
        ));
        setVideoModalVisible(false);
    };

    // Marcar feedback como visto cuando el coach lo abre
    const markFeedbackAsViewed = async (feedbackId) => {
        if (!feedbackId || !token || !API_URL) return;

        try {
            const response = await fetch(`${API_URL}/api/video-feedback/${feedbackId}/view`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                // Actualizar estado local
                setVideoFeedbacks(prev => prev.map(f =>
                    f._id === feedbackId
                        ? { ...f, viewedByCoach: true }
                        : f
                ));
                console.log('[ClientProgress] ✅ Feedback marcado como visto:', feedbackId);
            }
        } catch (error) {
            console.error('[ClientProgress] Error marcando como visto:', error);
        }
    };

    // Marcar todas las notas de texto de una semana como vistas
    const markWeekNotesAsViewed = async (weekDays) => {
        if (!weekDays || !token || !API_URL) return;

        // Obtener IDs únicos de sesiones de esta semana
        const sessionIds = [...new Set(weekDays.map(d => d.sessionId).filter(Boolean))];

        // Marcar cada sesión como vista
        for (const sessionId of sessionIds) {
            try {
                await fetch(`${API_URL}/api/workouts/${sessionId}/mark-notes-viewed`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (error) {
                console.error('[ClientProgress] Error marcando notas como vistas:', error);
            }
        }

        if (sessionIds.length > 0) {
            console.log(`[ClientProgress] ✅ ${sessionIds.length} sesiones marcadas como vistas`);

            // Actualizar estado local de sessions para reflejar el cambio
            setSessions(prev => prev.map(s => {
                if (sessionIds.includes(s._id)) {
                    return {
                        ...s,
                        exercises: s.exercises?.map(ex => ({
                            ...ex,
                            sets: ex.sets?.map(set => ({
                                ...set,
                                notes: set.notes ? { ...set.notes, viewedByCoach: true } : set.notes
                            }))
                        }))
                    };
                }
                return s;
            }));
        }
    };

    // ═════════════════════════════════════════════════════════════════════════
    // EXTRAER LISTA DE MÚSCULOS Y EJERCICIOS
    // ═══════════════════════════════════════════════════════════════════════════
    const { listaMusculos, mapEjercicios } = useMemo(() => {
        const muscSet = new Set();
        const ejMap = new Map(); // musculo -> Set<ejercicio>

        sessions.forEach((session) => {
            session.exercises?.forEach((ej) => {
                const musc = ej.muscleGroup || 'SIN GRUPO';
                const nombre = ej.exerciseName || 'Sin nombre';
                muscSet.add(musc);
                if (!ejMap.has(musc)) ejMap.set(musc, new Set());
                ejMap.get(musc).add(nombre);
            });
        });

        const muscArr = ['TOTAL', ...Array.from(muscSet).sort()];
        const ejMapArr = new Map();
        ejMap.forEach((v, k) => ejMapArr.set(k, Array.from(v).sort()));

        return { listaMusculos: muscArr, mapEjercicios: ejMapArr };
    }, [sessions]);

    const listaEjercicios = useMemo(() => {
        if (selMusculo === 'TOTAL' || !selMusculo) return [];
        return mapEjercicios.get(selMusculo) || [];
    }, [selMusculo, mapEjercicios]);

    // Reset ejercicio cuando cambia músculo
    const handleMusculoChange = (musculo) => {
        setSelMusculo(musculo);
        setSelEjercicio('');
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // FILTRAR Y AGRUPAR DATOS POR PERÍODO
    // ═══════════════════════════════════════════════════════════════════════════
    const datosAgrupados = useMemo(() => {
        if (!sessions || sessions.length === 0) return [];

        const grupos = new Map();
        const ahora = new Date();

        sessions.forEach((session) => {
            const fecha = new Date(session.date);
            let clave;

            if (temporalidad === 'total') {
                clave = 'Total acumulado';
            } else if (temporalidad === 'semanas') {
                // Calcular número de semana del año
                const startOfYear = new Date(fecha.getFullYear(), 0, 1);
                const weekNum = Math.ceil(((fecha - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
                clave = `Semana ${weekNum}`;
            } else {
                // Mes completo en español
                const mes = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                clave = mes.charAt(0).toUpperCase() + mes.slice(1);
            }

            if (!grupos.has(clave)) {
                grupos.set(clave, {
                    periodo: clave,
                    volumen: 0,
                    reps: 0,
                    cargaTotal: 0,
                    numSesiones: 0,
                    fechaSort: fecha,
                });
            }

            const grupo = grupos.get(clave);

            // Filtrar por músculo/ejercicio
            session.exercises?.forEach((ej) => {
                const musc = ej.muscleGroup || 'SIN GRUPO';
                const nombre = ej.exerciseName || '';

                // Si es TOTAL, incluir todo. Si no, filtrar
                if (selMusculo !== 'TOTAL' && musc !== selMusculo) return;
                if (selEjercicio && nombre !== selEjercicio) return;

                ej.sets?.forEach((s) => {
                    const reps = s.actualReps || 0;
                    const peso = s.weight || 0;
                    grupo.reps += reps;
                    grupo.volumen += reps * peso;
                    grupo.cargaTotal += peso;
                });
            });

            grupo.numSesiones += 1;
            if (fecha > grupo.fechaSort) grupo.fechaSort = fecha;
        });

        // Convertir a array y calcular media
        const resultado = Array.from(grupos.values())
            .filter(g => g.volumen > 0 || selMusculo === 'TOTAL')
            .map((g) => ({
                ...g,
                cargaMedia: g.reps > 0 ? Math.round(g.volumen / g.reps * 10) / 10 : 0,
            }));

        // Ordenar por fecha
        return resultado.sort((a, b) => b.fechaSort - a.fechaSort);
    }, [sessions, temporalidad, selMusculo, selEjercicio]);

    // ═══════════════════════════════════════════════════════════════════════════
    // DATOS PARA GRÁFICO (ordenados por week cuando hay misma fecha)
    // ═══════════════════════════════════════════════════════════════════════════
    const datosGrafico = useMemo(() => {
        if (!sessions || sessions.length === 0) return null;

        // Agrupar por week (semana de la rutina) en lugar de solo fecha
        const porWeek = new Map();

        sessions.forEach((session) => {
            const fecha = new Date(session.date);
            const week = session.week ?? 1;

            // Usar week como clave principal para agrupar
            const weekKey = `S${week}`;

            if (!porWeek.has(weekKey)) {
                porWeek.set(weekKey, {
                    fecha,
                    week,
                    volumen: 0,
                    label: weekKey
                });
            }

            const grupo = porWeek.get(weekKey);

            // Mantener la fecha más reciente para ordenar si hay empate
            if (fecha > grupo.fecha) {
                grupo.fecha = fecha;
            }

            session.exercises?.forEach((ej) => {
                const musc = ej.muscleGroup || 'SIN GRUPO';
                const nombre = ej.exerciseName || '';

                if (selMusculo !== 'TOTAL' && musc !== selMusculo) return;
                if (selEjercicio && nombre !== selEjercicio) return;

                ej.sets?.forEach((s) => {
                    const reps = s.actualReps || 0;
                    const peso = s.weight || 0;
                    grupo.volumen += reps * peso;
                });
            });
        });

        // Convertir a array y ordenar por week (ascendente)
        const datos = Array.from(porWeek.values())
            .sort((a, b) => a.week - b.week);

        if (datos.length === 0 || datos.every(d => d.volumen === 0)) return null;

        const labels = datos.map(d => d.label);
        const values = datos.map(d => d.volumen);

        if (values.length === 1) {
            return {
                labels: [labels[0], labels[0]],
                datasets: [{ data: [values[0], values[0]], strokeWidth: 3 }],
            };
        }

        return {
            labels,
            datasets: [{ data: values, strokeWidth: 3 }],
        };
    }, [sessions, selMusculo, selEjercicio]);

    // ═══════════════════════════════════════════════════════════════════════════
    // KPI CALCULATIONS 2.0
    // ═══════════════════════════════════════════════════════════════════════════

    // Sesiones filtradas por periodo
    const filteredSessions = useMemo(() => {
        return filterByPeriod(sessions, selectedPeriod);
    }, [sessions, selectedPeriod]);

    // NUEVO: KPI Volumen (% mejora semanal) - CON FILTROS
    const volumeData = useMemo(() => {
        const data = calcVolumeByWeek(filteredSessions, selMusculo, selEjercicio);
        if (data.length === 0) return null;
        const lastValue = data[data.length - 1]?.value || 0;
        const totalVol = data.reduce((sum, d) => sum + (d.volume || 0), 0);
        return {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.value), strokeWidth: 3 }],
            rawData: data,
            lastValue,
            totalVolK: (totalVol / 1000).toFixed(1)
        };
    }, [filteredSessions, selMusculo, selEjercicio]);

    // KPI: Intensidad Relativa (semanal) - CON FILTROS
    const intensityData = useMemo(() => {
        const data = calcIntensityByWeek(filteredSessions, selMusculo, selEjercicio);
        if (data.length === 0) return null;
        const lastValue = data[data.length - 1]?.value || 0;
        return {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.value), strokeWidth: 3 }],
            lastValue,
            lastAvgLoad: data[data.length - 1]?.avgLoad || 0
        };
    }, [filteredSessions, selMusculo, selEjercicio]);

    // KPI: Cumplimiento del Plan (semanal)
    const complianceWeeklyData = useMemo(() => {
        const data = calcPlanComplianceByWeek(filteredSessions);
        if (data.length === 0) return null;
        const lastValue = data[data.length - 1]?.value || 0;
        const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length;
        return {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.value), strokeWidth: 3 }],
            lastValue,
            avgValue: avgValue.toFixed(1)
        };
    }, [filteredSessions]);

    const complianceTotalData = useMemo(() => {
        return calcPlanComplianceTotal(filterByPeriod(sessions, '30d'));
    }, [sessions]);

    // KPI: Carga Alta (semanal) - CON FILTROS
    const heavySetsData = useMemo(() => {
        const data = calcHeavySetsByWeek(filteredSessions, selMusculo, selEjercicio);
        if (data.length === 0) return null;
        const lastValue = data[data.length - 1]?.value || 0;
        const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length;
        return {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.value) }],
            lastValue,
            avgValue: avgValue.toFixed(0)
        };
    }, [filteredSessions, selMusculo, selEjercicio]);

    // KPI: Balance Muscular (periodo)
    const muscleBalanceData = useMemo(() => {
        const data = calcMuscleBalance(filteredSessions);
        if (data.length === 0) return null;
        return {
            labels: data.map(d => d.muscle.substring(0, 4)),
            datasets: [{ data: data.map(d => d.share) }],
            fullData: data
        };
    }, [filteredSessions]);

    // KPI: PR Count (semanal) - CON FILTROS
    const prCountData = useMemo(() => {
        const data = calcPRCountByWeek(filteredSessions);
        if (data.length === 0) return null;
        const totalPRs = data.reduce((sum, d) => sum + d.value, 0);
        return {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.value) }],
            totalPRs
        };
    }, [filteredSessions]);

    // 🆕 KPI: Sensación (Session RPE)
    const sessionRPEData = useMemo(() => {
        const data = calcSessionRPEByDay(filteredSessions);
        if (data.data.length === 0) return null;
        return data;
    }, [filteredSessions]);

    // Obtener info del KPI seleccionado
    const currentKpi = useMemo(() => {
        return KPI_OPTIONS.find(k => k.id === selectedKpi) || KPI_OPTIONS[0];
    }, [selectedKpi]);

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════════
    const calcularCambio = (actual, anterior) => {
        if (!anterior || anterior === 0) return actual > 0 ? 100 : 0;
        return Math.round(((actual - anterior) / anterior) * 100);
    };

    const getCambioStyle = (cambio) => {
        if (cambio > 0) return { color: '#10b981', icon: 'arrow-up' };
        if (cambio < 0) return { color: '#ef4444', icon: 'arrow-down' };
        return { color: '#6b7280', icon: 'remove' };
    };

    const totales = useMemo(() => {
        return datosAgrupados.reduce(
            (acc, d) => ({
                volumen: acc.volumen + d.volumen,
                reps: acc.reps + d.reps,
                sesiones: acc.sesiones + d.numSesiones,
            }),
            { volumen: 0, reps: 0, sesiones: 0 }
        );
    }, [datosAgrupados]);

    const tendenciaGeneral = useMemo(() => {
        if (datosAgrupados.length < 2) return 0;
        const actual = datosAgrupados[0]?.volumen || 0;
        const anterior = datosAgrupados[1]?.volumen || 0;
        return calcularCambio(actual, anterior);
    }, [datosAgrupados]);

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 DATOS PARA TABLA DETALLADA DE EJERCICIOS
    // ═══════════════════════════════════════════════════════════════════════════
    const NOTE_COLORS = {
        high: '#ef4444',   // 🔴
        normal: '#f97316', // 🟠
        low: '#22c55e',    // 🟢
        custom: '#3b82f6', // 🔵
        media: '#8b5cf6',  // 🟣 Purple for media-only feedback
    };

    // Palabras clave de dolor/alerta para destacar comentarios críticos
    const PAIN_KEYWORDS = ['dolor', 'molestia', 'pinchazo', 'lesión', 'daño', 'mal', 'pincha', 'duele', 'molesta', 'lesion'];
    const hasPainKeyword = (text) => text && PAIN_KEYWORDS.some(kw => text.toLowerCase().includes(kw));

    // Helper para normalizar nombres de ejercicios (quitar acentos y palabras comunes)
    const normalizeExerciseName = (name) => {
        if (!name) return '';
        return name
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
            .replace(/\b(en|al|el|la|los|las|de|del|con)\b/g, '') // Quitar artículos
            .replace(/\s+/g, ' ') // Normalizar espacios
            .trim();
    };

    // Helper para encontrar TODOS los feedbacks asociados a un set específico
    const findAllMediaForSet = (exerciseName, setNumber, weekNumber) => {
        const normalizedSearch = normalizeExerciseName(exerciseName);

        return videoFeedbacks.filter(fb => {
            const normalizedFeedback = normalizeExerciseName(fb.exerciseName);
            const nameMatch = normalizedFeedback === normalizedSearch ||
                normalizedSearch.includes(normalizedFeedback) ||
                normalizedFeedback.includes(normalizedSearch);

            if (!nameMatch) return false;

            if (fb.serieKey) {
                const parts = fb.serieKey.split('|');
                if (parts.length >= 4) {
                    const fbWeek = parseInt(parts[0], 10);
                    const setIdx = parseInt(parts[parts.length - 1], 10);
                    return fbWeek === weekNumber && setIdx + 1 === setNumber;
                }
                const setIdx = parseInt(parts[parts.length - 1], 10);
                return setIdx + 1 === setNumber;
            }
            return fb.setNumber === setNumber;
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    // Helper para encontrar AUDIO asociado a un set (para inline player)
    const findAudioForSet = (exerciseName, setNumber, weekNumber) => {
        const allMedia = findAllMediaForSet(exerciseName, setNumber, weekNumber);
        return allMedia.find(fb => fb.mediaType === 'audio');
    };

    // Helper para encontrar VISUAL (foto/video) asociado a un set (para modal)
    const findVisualForSet = (exerciseName, setNumber, weekNumber) => {
        const allMedia = findAllMediaForSet(exerciseName, setNumber, weekNumber);
        return allMedia.find(fb => fb.mediaType === 'video' || fb.mediaType === 'photo');
    };

    // Alias para retrocompatibilidad
    const findVideoForSet = findVisualForSet;

    const getRepStatus = (actual, min, max) => {
        if (!actual) return 'none';
        if (min && actual < min) return 'below';  // 🔴
        if (max && actual > max) return 'above';  // 🔵
        return 'inRange'; // 🟢
    };

    const getRepStatusColor = (status) => {
        switch (status) {
            case 'below': return '#ef4444';  // Rojo
            case 'above': return '#3b82f6';  // Azul
            case 'inRange': return '#22c55e'; // Verde
            default: return '#6b7280';
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 📅 DATOS AGRUPADOS POR DÍA DE LA RUTINA
    // Estructura: Día 1 → ejercicios → sesiones de cada ejercicio
    // ═══════════════════════════════════════════════════════════════════════════
    const datosPorDia = useMemo(() => {
        if (!sessions || sessions.length === 0) return [];

        // Agrupar sesiones por dayIndex
        const diasMap = new Map();

        sessions.forEach((session) => {
            const dayIdx = session.dayIndex ?? 0;
            const dayLabel = session.dayLabel || `Día ${dayIdx + 1}`;

            if (!diasMap.has(dayIdx)) {
                diasMap.set(dayIdx, {
                    dayIndex: dayIdx,
                    dayLabel,
                    routineName: session.routineNameSnapshot || 'Rutina',
                    sessionsData: [], // Array de sesiones de este día
                });
            }

            // Añadir esta sesión a las sesiones de este día
            diasMap.get(dayIdx).sessionsData.push({
                sessionId: session._id,
                date: new Date(session.date),
                week: session.week ?? 1, // Semana de la rutina
                exercises: session.exercises || [],
            });
        });

        // Procesar cada día
        const resultado = Array.from(diasMap.values()).map(dia => {
            // Ordenar sesiones: primero por fecha (más antigua primero), luego por week
            dia.sessionsData.sort((a, b) => {
                const dateDiff = a.date - b.date; // Más antigua primero
                if (dateDiff !== 0) return dateDiff;
                return (a.week ?? 1) - (b.week ?? 1); // Menor week primero
            });

            // Obtener ejercicios únicos de la primera sesión (orden de la rutina)
            const primeraSession = dia.sessionsData[0];
            const ejerciciosUnicos = [];
            const ejerciciosVistos = new Set();

            // Recorrer todas las sesiones para obtener todos los ejercicios
            dia.sessionsData.forEach(s => {
                s.exercises.forEach(ex => {
                    if (!ejerciciosVistos.has(ex.exerciseName)) {
                        ejerciciosVistos.add(ex.exerciseName);
                        ejerciciosUnicos.push({
                            exerciseName: ex.exerciseName,
                            muscleGroup: ex.muscleGroup || 'SIN GRUPO',
                        });
                    }
                });
            });

            // Para cada ejercicio, recopilar datos de todas las sesiones
            const ejerciciosConSesiones = ejerciciosUnicos
                .filter(ej => {
                    // Aplicar filtros
                    if (selMusculo !== 'TOTAL' && ej.muscleGroup !== selMusculo) return false;
                    if (selEjercicio && ej.exerciseName !== selEjercicio) return false;
                    return true;
                })
                .map(ej => {
                    // Obtener datos de este ejercicio en cada sesión
                    // Las sesiones ya están ordenadas: fecha asc + week asc (más antigua primero)
                    const sesionesEjercicio = dia.sessionsData.map((s, sIdx) => {
                        const exData = s.exercises.find(e => e.exerciseName === ej.exerciseName);
                        if (!exData) return null;

                        // Obtener sesión ANTERIOR (más antigua, índice menor)
                        // La Sesión 1 (sIdx=0) no tiene anterior, así que no tendrá flechas
                        const prevSession = sIdx > 0 ? dia.sessionsData[sIdx - 1] : null;
                        const prevExData = prevSession?.exercises?.find(e => e.exerciseName === ej.exerciseName);

                        const setsConTrend = (exData.sets || []).map((set, setIdx) => {
                            const prevSet = prevExData?.sets?.[setIdx];
                            return {
                                setNumber: set.setNumber || setIdx + 1,
                                reps: set.actualReps,
                                weight: set.weight,
                                targetMin: set.targetRepsMin,
                                targetMax: set.targetRepsMax,
                                status: getRepStatus(set.actualReps, set.targetRepsMin, set.targetRepsMax),
                                notes: set.notes || null,
                                // Flecha UP solo si mejora respecto a sesión anterior
                                repTrend: (prevSet?.actualReps && set.actualReps && set.actualReps > prevSet.actualReps)
                                    ? 'up' : null,
                                weightTrend: (prevSet?.weight && set.weight && set.weight > prevSet.weight)
                                    ? 'up' : null,
                            };
                        });

                        return {
                            sessionIdx: sIdx + 1, // Sesión 1 = más antigua
                            week: s.week,
                            date: s.date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
                            sets: setsConTrend,
                        };
                    }).filter(Boolean);

                    return {
                        ...ej,
                        sesiones: sesionesEjercicio,
                    };
                });

            return {
                ...dia,
                exercises: ejerciciosConSesiones,
                totalSessions: dia.sessionsData.length,
            };
        });

        // Ordenar por dayIndex
        return resultado.sort((a, b) => a.dayIndex - b.dayIndex);
    }, [sessions, selMusculo, selEjercicio]);

    // Estado para días expandidos
    const [expandedDays, setExpandedDays] = useState({});

    const toggleDay = (routineId, dayIndex) => {
        const key = `${routineId}-${dayIndex}`;
        setExpandedDays(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 📋 DATOS AGRUPADOS POR RUTINA → DÍA (PARA VISTA TABLA)
    // ═══════════════════════════════════════════════════════════════════════════
    const datosPorRutina = useMemo(() => {
        if (!sessions || sessions.length === 0) return { current: null, old: [] };

        // Agrupar sesiones por routineId
        const rutinasMap = new Map();

        sessions.forEach((session) => {
            const routineId = session.routineId || session.routineNameSnapshot || 'unknown';
            const routineName = session.routineNameSnapshot || 'Rutina';

            if (!rutinasMap.has(routineId)) {
                rutinasMap.set(routineId, {
                    routineId,
                    routineName,
                    lastDate: new Date(session.date),
                    sessionsData: [],
                });
            }

            const rutina = rutinasMap.get(routineId);
            const sessionDate = new Date(session.date);
            if (sessionDate > rutina.lastDate) {
                rutina.lastDate = sessionDate;
            }
            rutina.sessionsData.push(session);
        });

        // Ordenar por fecha más reciente
        const rutinasArray = Array.from(rutinasMap.values())
            .sort((a, b) => b.lastDate - a.lastDate);

        // Procesar cada rutina
        const procesarRutina = (rutina) => {
            const diasMap = new Map();

            rutina.sessionsData.forEach((session) => {
                const dayIdx = session.dayIndex ?? 0;
                const dayLabel = session.dayLabel || `Día ${dayIdx + 1}`;

                if (!diasMap.has(dayIdx)) {
                    diasMap.set(dayIdx, {
                        dayIndex: dayIdx,
                        dayLabel,
                        sessionsData: [],
                    });
                }

                diasMap.get(dayIdx).sessionsData.push({
                    sessionId: session._id,
                    date: new Date(session.date),
                    week: session.week ?? 1,
                    exercises: session.exercises || [],
                });
            });

            // Procesar cada día
            const dias = Array.from(diasMap.values()).map(dia => {
                dia.sessionsData.sort((a, b) => {
                    const dateDiff = a.date - b.date;
                    if (dateDiff !== 0) return dateDiff;
                    return (a.week ?? 1) - (b.week ?? 1);
                });

                // Ejercicios únicos
                const ejerciciosVistos = new Set();
                const ejerciciosUnicos = [];
                dia.sessionsData.forEach(s => {
                    s.exercises.forEach(ex => {
                        if (!ejerciciosVistos.has(ex.exerciseName)) {
                            ejerciciosVistos.add(ex.exerciseName);
                            ejerciciosUnicos.push({
                                exerciseName: ex.exerciseName,
                                muscleGroup: ex.muscleGroup || 'SIN GRUPO',
                            });
                        }
                    });
                });

                // Ejercicios con sesiones y trends
                const ejerciciosConSesiones = ejerciciosUnicos.map(ej => {
                    const sesionesEjercicio = dia.sessionsData.map((s, sIdx) => {
                        const exData = s.exercises.find(e => e.exerciseName === ej.exerciseName);
                        if (!exData) return null;

                        const prevSession = sIdx > 0 ? dia.sessionsData[sIdx - 1] : null;
                        const prevExData = prevSession?.exercises?.find(e => e.exerciseName === ej.exerciseName);

                        const setsConTrend = (exData.sets || []).map((set, setIdx) => {
                            const prevSet = prevExData?.sets?.[setIdx];
                            return {
                                setNumber: set.setNumber || setIdx + 1,
                                reps: set.actualReps,
                                weight: set.weight,
                                targetMin: set.targetRepsMin,
                                targetMax: set.targetRepsMax,
                                status: getRepStatus(set.actualReps, set.targetRepsMin, set.targetRepsMax),
                                notes: set.notes || null,
                                repTrend: (prevSet?.actualReps && set.actualReps && set.actualReps > prevSet.actualReps) ? 'up' : null,
                                weightTrend: (prevSet?.weight && set.weight && set.weight > prevSet.weight) ? 'up' : null,
                            };
                        });

                        return {
                            sessionIdx: sIdx + 1,
                            week: s.week,
                            date: s.date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
                            sets: setsConTrend,
                        };
                    }).filter(Boolean);

                    return { ...ej, sesiones: sesionesEjercicio };
                });

                return {
                    ...dia,
                    exercises: ejerciciosConSesiones,
                    totalSessions: dia.sessionsData.length,
                };
            }).sort((a, b) => a.dayIndex - b.dayIndex);

            return {
                routineId: rutina.routineId,
                routineName: rutina.routineName,
                lastDate: rutina.lastDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                dias,
            };
        };

        // Rutina actual = la más reciente
        const current = rutinasArray.length > 0 ? procesarRutina(rutinasArray[0]) : null;
        const old = rutinasArray.slice(1).map(procesarRutina);

        return { current, old };
    }, [sessions]);

    // Estado para rutinas expandidas
    const [expandedRoutines, setExpandedRoutines] = useState({ current: true });

    const toggleRoutine = (routineId) => {
        setExpandedRoutines(prev => ({
            ...prev,
            [routineId]: !prev[routineId]
        }));
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 💬 DATOS AGRUPADOS POR COMENTARIOS (SOLO SETS CON NOTAS)
    // Ordena de más reciente a más antigua, agrupa por semana
    // ═══════════════════════════════════════════════════════════════════════════

    // Helper para detectar si un set tiene videoFeedback asociado
    const hasVideoFeedbackForSet = (exerciseName, setNumber, weekNumber) => {
        const normalizedSearch = normalizeExerciseName(exerciseName);
        return videoFeedbacks.some(fb => {
            const normalizedFeedback = normalizeExerciseName(fb.exerciseName);
            const nameMatch = normalizedFeedback === normalizedSearch ||
                normalizedSearch.includes(normalizedFeedback) ||
                normalizedFeedback.includes(normalizedSearch);
            if (!nameMatch) return false;

            if (fb.serieKey) {
                const parts = fb.serieKey.split('|');
                if (parts.length >= 4) {
                    const fbWeek = parseInt(parts[0], 10);
                    const setIdx = parseInt(parts[parts.length - 1], 10);
                    return fbWeek === weekNumber && setIdx + 1 === setNumber;
                }
                const setIdx = parseInt(parts[parts.length - 1], 10);
                return setIdx + 1 === setNumber;
            }
            return fb.setNumber === setNumber;
        });
    };

    const comentariosPorRutina = useMemo(() => {
        if (!sessions || sessions.length === 0) return { current: null, old: [] };

        // Agrupar sesiones por routineId
        const rutinasMap = new Map();

        sessions.forEach((session) => {
            const routineId = session.routineId || session.routineNameSnapshot || 'unknown';
            const routineName = session.routineNameSnapshot || 'Rutina';

            if (!rutinasMap.has(routineId)) {
                rutinasMap.set(routineId, {
                    routineId,
                    routineName,
                    lastDate: new Date(session.date),
                    sessionsData: [],
                });
            }

            const rutina = rutinasMap.get(routineId);
            const sessionDate = new Date(session.date);
            if (sessionDate > rutina.lastDate) rutina.lastDate = sessionDate;
            rutina.sessionsData.push(session);
        });

        // Ordenar rutinas por fecha más reciente
        const rutinasArray = Array.from(rutinasMap.values())
            .sort((a, b) => b.lastDate - a.lastDate);

        // Procesar cada rutina extrayendo solo comentarios
        const procesarRutina = (rutina) => {
            // Ordenar sesiones de MÁS RECIENTE a MÁS ANTIGUA
            const sesionesOrdenadas = [...rutina.sessionsData].sort((a, b) =>
                new Date(b.date) - new Date(a.date)
            );

            // Agrupar por semana (week)
            const semanasMap = new Map();

            sesionesOrdenadas.forEach((session) => {
                const week = session.week ?? 1;
                const dayIdx = session.dayIndex ?? 0;
                const dayLabel = session.dayLabel || `Día ${dayIdx + 1}`;
                const sessionDate = new Date(session.date);

                // Extraer ejercicios con comentarios O CON MEDIA (video/foto/audio)
                const ejerciciosConComentarios = [];
                (session.exercises || []).forEach((ex) => {
                    // Incluir sets que tienen nota de texto O que tienen media feedback
                    const setsConFeedback = (ex.sets || []).filter((s, idx) => {
                        const hasTextNote = s.notes?.value && s.notes?.note;
                        const setNum = s.setNumber || idx + 1;
                        const hasMedia = hasVideoFeedbackForSet(ex.exerciseName, setNum, week);
                        return hasTextNote || hasMedia;
                    });
                    if (setsConFeedback.length > 0) {
                        ejerciciosConComentarios.push({
                            exerciseName: ex.exerciseName,
                            muscleGroup: ex.muscleGroup || 'SIN GRUPO',
                            sets: setsConFeedback.map((s, idx) => {
                                const setNum = s.setNumber || idx + 1;
                                const hasTextNote = s.notes?.value && s.notes?.note;
                                return {
                                    setNumber: setNum,
                                    weight: s.weight,
                                    reps: s.actualReps,
                                    noteValue: hasTextNote ? s.notes.value : 'media',
                                    noteText: hasTextNote ? s.notes.note : null,
                                    hasPain: hasTextNote ? hasPainKeyword(s.notes.note) : false,
                                    hasMediaOnly: !hasTextNote,
                                };
                            }),
                        });
                    }
                });

                if (ejerciciosConComentarios.length > 0 || session.sessionRPE) {
                    if (!semanasMap.has(week)) {
                        semanasMap.set(week, { week, dias: [] });
                    }
                    semanasMap.get(week).dias.push({
                        sessionId: session._id, // 🆕 Para marcar notas como vistas
                        dayIndex: dayIdx,
                        dayLabel,
                        date: sessionDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                        dateSort: sessionDate,
                        exercises: ejerciciosConComentarios,
                        // 🆕 RPE de la sesión
                        sessionRPE: session.sessionRPE || null,
                        sessionNote: session.sessionNote || null,
                        rpeColor: RPE_COLORS[session.sessionRPE] || null,
                        rpeLabel: RPE_LABELS[session.sessionRPE] || null,
                    });
                }
            });

            // Ordenar semanas descendente (más reciente primero)
            const semanas = Array.from(semanasMap.values())
                .sort((a, b) => b.week - a.week)
                .map(sem => ({
                    ...sem,
                    dias: sem.dias.sort((a, b) => b.dateSort - a.dateSort), // Más reciente primero dentro de semana
                }));

            const totalComentarios = semanas.reduce((acc, sem) =>
                acc + sem.dias.reduce((acc2, d) =>
                    acc2 + d.exercises.reduce((acc3, ex) => acc3 + ex.sets.length, 0)
                    , 0)
                , 0);

            return {
                routineId: rutina.routineId,
                routineName: rutina.routineName,
                lastDate: rutina.lastDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                semanas,
                totalComentarios,
            };
        };

        const current = rutinasArray.length > 0 ? procesarRutina(rutinasArray[0]) : null;
        const old = rutinasArray.slice(1).map(procesarRutina).filter(r => r.totalComentarios > 0);

        return { current, old };
    }, [sessions, videoFeedbacks]);

    // 🆕 Sesiones con RPE y notas para vista de comentarios (prioritario)
    const sessionRPEComments = useMemo(() => {
        if (!sessions || sessions.length === 0) return [];

        return sessions
            .filter(s => s.sessionRPE && s.sessionRPE >= 1 && s.sessionRPE <= 5)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 20) // Últimas 20 sesiones con RPE
            .map(s => ({
                id: s._id,
                date: new Date(s.date).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                dayLabel: s.dayLabel || 'Sesión',
                routineName: s.routineNameSnapshot || 'Rutina',
                rpe: s.sessionRPE,
                note: s.sessionNote || null,
                color: RPE_COLORS[s.sessionRPE] || '#CBD5E1',
                label: RPE_LABELS[s.sessionRPE] || '',
            }));
    }, [sessions]);

    // Contar notas de texto no vistas (para el badge de pendientes)
    const unviewedTextNotesCount = useMemo(() => {
        let count = 0;
        sessions.forEach(session => {
            session.exercises?.forEach(ex => {
                ex.sets?.forEach(set => {
                    // Contar si tiene nota de texto y no está marcada como vista
                    if (set.notes?.note && !set.notes.viewedByCoach) {
                        count++;
                    }
                });
            });
        });
        return count;
    }, [sessions]);

    // Estado para semanas expandidas en comentarios
    const [expandedWeeks, setExpandedWeeks] = useState({});

    // 🆕 Expandir por defecto la última semana (la primera en la lista ordenada descendente)
    useEffect(() => {
        if (comentariosPorRutina.current?.semanas?.length > 0) {
            const latestWeek = comentariosPorRutina.current.semanas[0].week;
            const key = `current-${latestWeek}`;
            setExpandedWeeks(prev => {
                // Solo establecer si está vacío (primera carga) para no interferir con el usuario
                if (Object.keys(prev).length === 0) {
                    return { [key]: true };
                }
                return prev;
            });
        }
    }, [comentariosPorRutina.current]);
    const toggleWeek = (routineKey, week, weekDays) => {
        const key = `${routineKey}-${week}`;
        const isCurrentlyExpanded = expandedWeeks[key];

        // Si vamos a expandir (no está expandido actualmente), marcar notas como vistas
        if (!isCurrentlyExpanded && weekDays) {
            markWeekNotesAsViewed(weekDays);
        }

        setExpandedWeeks(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#1e293b" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Cargando...</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header - siempre full width */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>{clientName || 'Cliente'}</Text>
                    <Text style={styles.headerSubtitle}>Análisis de progreso</Text>
                </View>
                <View style={[styles.tendenciaBadge, { backgroundColor: getCambioStyle(tendenciaGeneral).color + '20' }]}>
                    <Ionicons name={getCambioStyle(tendenciaGeneral).icon} size={18} color={getCambioStyle(tendenciaGeneral).color} />
                    <Text style={[styles.tendenciaText, { color: getCambioStyle(tendenciaGeneral).color }]}>
                        {tendenciaGeneral > 0 ? '+' : ''}{tendenciaGeneral}%
                    </Text>
                </View>
            </View>

            {/* 🖥️ Split View Container - flex row on large screens */}
            <View style={[
                styles.splitViewWrapper,
                isLargeScreen && selectedFeedback && styles.splitViewWrapperActive
            ]}>
                {/* Main Content - shrinks when panel open */}
                <ScrollView
                    style={[
                        styles.content,
                        isLargeScreen && selectedFeedback && styles.contentWithPanel
                    ]}
                    showsVerticalScrollIndicator={false}
                >

                    {/* === TOGGLE GRÁFICA / TABLA === */}
                    <View style={styles.viewModeContainer}>
                        <Pressable
                            style={[styles.viewModeBtn, viewMode === 'chart' && styles.viewModeBtnActive]}
                            onPress={() => setViewMode('chart')}
                        >
                            <Ionicons name="analytics" size={18} color={viewMode === 'chart' ? '#fff' : '#64748b'} />
                            <Text style={[styles.viewModeText, viewMode === 'chart' && styles.viewModeTextActive]}>
                                Gráfica
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[styles.viewModeBtn, viewMode === 'table' && styles.viewModeBtnActive]}
                            onPress={() => setViewMode('table')}
                        >
                            <Ionicons name="grid" size={18} color={viewMode === 'table' ? '#fff' : '#64748b'} />
                            <Text style={[styles.viewModeText, viewMode === 'table' && styles.viewModeTextActive]}>
                                Tabla
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[styles.viewModeBtn, viewMode === 'comments' && styles.viewModeBtnActive]}
                            onPress={() => setViewMode('comments')}
                        >
                            <Ionicons name="chatbubbles-outline" size={18} color={viewMode === 'comments' ? '#fff' : '#64748b'} />
                            <Text style={[styles.viewModeText, viewMode === 'comments' && styles.viewModeTextActive]}>
                                Notas/Media
                            </Text>
                            {/* Contador de pendientes: media + notas de texto no vistas */}
                            {(() => {
                                const unviewedMedia = videoFeedbacks.filter(f => !f.viewedByCoach && !f.coachResponse?.respondedAt).length;
                                const totalPending = unviewedMedia + unviewedTextNotesCount;
                                return totalPending > 0 ? (
                                    <View style={styles.videoBadge}>
                                        <Text style={styles.videoBadgeText}>{totalPending}</Text>
                                    </View>
                                ) : null;
                            })()}
                        </Pressable>
                    </View>

                    {/* ════════════════════════════════════════════════════════════════
                    CHARTS 2.0 - SISTEMA DE KPIs
                   ════════════════════════════════════════════════════════════════ */}
                    {viewMode === 'chart' && (
                        <>
                            {/* ═══ PERIOD FILTER ═══ */}
                            <View style={styles.periodFilter}>
                                {PERIOD_OPTIONS.map(p => (
                                    <Pressable
                                        key={p.id}
                                        style={[
                                            styles.periodBtn,
                                            selectedPeriod === p.id && styles.periodBtnActive
                                        ]}
                                        onPress={() => setSelectedPeriod(p.id)}
                                    >
                                        <Text style={[
                                            styles.periodBtnText,
                                            selectedPeriod === p.id && styles.periodBtnTextActive
                                        ]}>
                                            {p.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* ═══ KPI SELECTOR ═══ */}
                            <Pressable
                                style={styles.kpiSelector}
                                onPress={() => setKpiModalVisible(true)}
                            >
                                <View style={styles.kpiSelectorLeft}>
                                    <View style={styles.kpiSelectorIconWrap}>
                                        <Text style={styles.kpiSelectorIcon}>{currentKpi.icon}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.kpiSelectorTitle}>{currentKpi.name}</Text>
                                        <Text style={styles.kpiSelectorDesc} numberOfLines={1}>{currentKpi.description}</Text>
                                    </View>
                                </View>
                                <View style={styles.kpiSelectorChevron}>
                                    <Ionicons name="chevron-down" size={18} color="#fff" />
                                </View>
                            </Pressable>

                            {/* ═══ FILTROS MÚSCULO/EJERCICIO (solo para KPIs que lo usen) ═══ */}
                            {currentKpi.useFilters && (
                                <View style={styles.kpiFilters}>
                                    <View style={styles.kpiFilterRow}>
                                        <Text style={styles.kpiFilterLabel}>Músculo:</Text>
                                        {Platform.OS === 'ios' ? (
                                            <TouchableOpacity
                                                style={styles.iosPickerButton}
                                                onPress={() => {
                                                    const options = ['Cancelar', ...listaMusculos.map(m => m === 'TOTAL' ? 'Todos' : m)];
                                                    ActionSheetIOS.showActionSheetWithOptions(
                                                        { options, cancelButtonIndex: 0, title: 'Seleccionar Músculo' },
                                                        (buttonIndex) => {
                                                            if (buttonIndex > 0) {
                                                                handleMusculoChange(listaMusculos[buttonIndex - 1]);
                                                            }
                                                        }
                                                    );
                                                }}
                                            >
                                                <Text style={styles.iosPickerText}>
                                                    {selMusculo === 'TOTAL' ? 'Todos' : selMusculo}
                                                </Text>
                                                <Ionicons name="chevron-down" size={18} color="#64748b" />
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity
                                                style={styles.iosPickerButton}
                                                onPress={() => setAndroidMusculoModal(true)}
                                            >
                                                <Text style={styles.iosPickerText}>
                                                    {selMusculo === 'TOTAL' ? 'Todos' : selMusculo}
                                                </Text>
                                                <Ionicons name="chevron-down" size={18} color="#64748b" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    {selMusculo !== 'TOTAL' && listaEjercicios.length > 0 && (
                                        <View style={styles.kpiFilterRow}>
                                            <Text style={styles.kpiFilterLabel}>Ejercicio:</Text>
                                            {Platform.OS === 'ios' ? (
                                                <TouchableOpacity
                                                    style={styles.iosPickerButton}
                                                    onPress={() => {
                                                        const options = ['Cancelar', 'Todos', ...listaEjercicios];
                                                        ActionSheetIOS.showActionSheetWithOptions(
                                                            { options, cancelButtonIndex: 0, title: 'Seleccionar Ejercicio' },
                                                            (buttonIndex) => {
                                                                if (buttonIndex === 1) {
                                                                    setSelEjercicio('');
                                                                } else if (buttonIndex > 1) {
                                                                    setSelEjercicio(listaEjercicios[buttonIndex - 2]);
                                                                }
                                                            }
                                                        );
                                                    }}
                                                >
                                                    <Text style={styles.iosPickerText}>
                                                        {selEjercicio || 'Todos'}
                                                    </Text>
                                                    <Ionicons name="chevron-down" size={18} color="#64748b" />
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity
                                                    style={styles.iosPickerButton}
                                                    onPress={() => setAndroidEjercicioModal(true)}
                                                >
                                                    <Text style={styles.iosPickerText}>
                                                        {selEjercicio || 'Todos'}
                                                    </Text>
                                                    <Ionicons name="chevron-down" size={18} color="#64748b" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* ═══ CHART RENDERING ═══ */}
                            <View style={styles.chartContainer}>

                                {/* KPI: VOLUMEN */}
                                {selectedKpi === 'volume' && volumeData && (
                                    <>
                                        <View style={styles.chartHeader}>
                                            <Text style={styles.sectionTitle}>
                                                Volumen {selMusculo !== 'TOTAL' ? `(${selMusculo})` : ''}
                                                {selEjercicio ? ` - ${selEjercicio}` : ''}
                                            </Text>
                                            <View style={styles.chartSummary}>
                                                <Text style={[styles.chartSummaryValue, {
                                                    color: volumeData.lastValue >= 0 ? '#10b981' : '#ef4444'
                                                }]}>
                                                    {volumeData.lastValue >= 0 ? '+' : ''}{volumeData.lastValue}%
                                                </Text>
                                                <Text style={styles.chartSummaryLabel}>vs semana 1</Text>
                                            </View>
                                        </View>
                                        <LineChart
                                            data={volumeData}
                                            width={screenWidth - 32}
                                            height={220}
                                            chartConfig={{
                                                ...chartConfig,
                                                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                                            }}
                                            bezier
                                            style={styles.chart}
                                            yAxisSuffix="%"
                                        />
                                        <Text style={styles.chartSubInfo}>
                                            Total período: {volumeData.totalVolK}k kg
                                        </Text>
                                    </>
                                )}

                                {/* KPI: INTENSIDAD */}
                                {selectedKpi === 'intensity' && intensityData && (
                                    <>
                                        <View style={styles.chartHeader}>
                                            <Text style={styles.sectionTitle}>
                                                Intensidad {selMusculo !== 'TOTAL' ? `(${selMusculo})` : ''}
                                                {selEjercicio ? ` - ${selEjercicio}` : ''}
                                            </Text>
                                            <View style={styles.chartSummary}>
                                                <Text style={[styles.chartSummaryValue, {
                                                    color: intensityData.lastValue >= 0 ? '#3b82f6' : '#ef4444'
                                                }]}>
                                                    {intensityData.lastValue >= 0 ? '+' : ''}{intensityData.lastValue}%
                                                </Text>
                                                <Text style={styles.chartSummaryLabel}>vs semana 1</Text>
                                            </View>
                                        </View>
                                        <LineChart
                                            data={intensityData}
                                            width={screenWidth - 32}
                                            height={220}
                                            chartConfig={chartConfig}
                                            bezier
                                            style={styles.chart}
                                            yAxisSuffix="%"
                                        />
                                        <Text style={styles.chartSubInfo}>
                                            Carga media: {intensityData.lastAvgLoad} kg/rep
                                        </Text>
                                    </>
                                )}

                                {/* KPI: CUMPLIMIENTO */}
                                {selectedKpi === 'compliance' && complianceWeeklyData && (
                                    <>
                                        <View style={styles.chartHeader}>
                                            <Text style={styles.sectionTitle}>Cumplimiento del Plan</Text>
                                            <View style={styles.chartSummary}>
                                                <Text style={[styles.chartSummaryValue, {
                                                    color: complianceWeeklyData.lastValue >= 80 ? '#10b981' :
                                                        complianceWeeklyData.lastValue >= 60 ? '#f59e0b' : '#ef4444'
                                                }]}>
                                                    {complianceWeeklyData.lastValue}%
                                                </Text>
                                                <Text style={styles.chartSummaryLabel}>última semana</Text>
                                            </View>
                                        </View>
                                        <LineChart
                                            data={complianceWeeklyData}
                                            width={screenWidth - 32}
                                            height={220}
                                            chartConfig={{
                                                ...chartConfig,
                                                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                                            }}
                                            bezier
                                            style={styles.chart}
                                            yAxisSuffix="%"
                                        />
                                        <Text style={styles.chartSubInfo}>
                                            Media: {complianceWeeklyData.avgValue}% de sets en rango
                                        </Text>
                                    </>
                                )}

                                {/* KPI: CARGA ALTA */}
                                {selectedKpi === 'heavySets' && heavySetsData && (
                                    <>
                                        <View style={styles.chartHeader}>
                                            <Text style={styles.sectionTitle}>
                                                Carga Alta {selMusculo !== 'TOTAL' ? `(${selMusculo})` : ''}
                                                {selEjercicio ? ` - ${selEjercicio}` : ''}
                                            </Text>
                                            <View style={styles.chartSummary}>
                                                <Text style={styles.chartSummaryValue}>
                                                    {heavySetsData.lastValue}%
                                                </Text>
                                                <Text style={styles.chartSummaryLabel}>última semana</Text>
                                            </View>
                                        </View>
                                        <BarChart
                                            data={heavySetsData}
                                            width={screenWidth - 32}
                                            height={220}
                                            chartConfig={{
                                                ...barChartConfig,
                                                color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                                            }}
                                            style={styles.chart}
                                            yAxisSuffix="%"
                                            showValuesOnTopOfBars
                                        />
                                        <Text style={styles.chartSubInfo}>
                                            Media: {heavySetsData.avgValue}% sets con ≥85% del máximo
                                        </Text>
                                    </>
                                )}

                                {/* KPI: BALANCE MUSCULAR */}
                                {selectedKpi === 'muscleBalance' && muscleBalanceData && (
                                    <>
                                        <View style={styles.chartHeader}>
                                            <Text style={styles.sectionTitle}>Balance Muscular</Text>
                                            <View style={styles.chartSummary}>
                                                <Text style={styles.chartSummaryValue}>
                                                    {muscleBalanceData.fullData?.[0]?.share || 0}%
                                                </Text>
                                                <Text style={styles.chartSummaryLabel}>
                                                    {muscleBalanceData.fullData?.[0]?.muscle || '-'}
                                                </Text>
                                            </View>
                                        </View>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={true}
                                            style={styles.horizontalChartScroll}
                                        >
                                            <BarChart
                                                data={muscleBalanceData}
                                                width={Math.max(screenWidth - 32, muscleBalanceData.labels.length * 60)}
                                                height={220}
                                                chartConfig={{
                                                    ...barChartConfig,
                                                    barPercentage: 0.6,
                                                }}
                                                style={styles.chart}
                                                yAxisSuffix="%"
                                                showValuesOnTopOfBars
                                            />
                                        </ScrollView>
                                        <View style={styles.muscleBalanceLegend}>
                                            {muscleBalanceData.fullData?.slice(0, 8).map((m, i) => (
                                                <View key={i} style={styles.muscleBalanceItem}>
                                                    <Text style={styles.muscleBalanceShare}>{m.share}%</Text>
                                                    <Text style={styles.muscleBalanceName}>{m.muscle}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </>
                                )}

                                {/* 🆕 KPI: Sensación (Session RPE) */}
                                {selectedKpi === 'sessionRPE' && sessionRPEData && (
                                    <>
                                        <View style={styles.chartHeader}>
                                            <Text style={styles.sectionTitle}>Sensación 🔵</Text>
                                            <View style={styles.chartSummary}>
                                                <Text style={[styles.chartSummaryValue, { color: '#3b82f6' }]}>
                                                    {sessionRPEData.average}/5
                                                </Text>
                                                <Text style={styles.chartSummaryLabel}>promedio</Text>
                                            </View>
                                        </View>

                                        {/* Streak indicator */}
                                        {sessionRPEData.maxStreak >= 3 && (
                                            <View style={styles.rpeStreakBadge}>
                                                <Text style={styles.rpeStreakText}>
                                                    🔥 {sessionRPEData.maxStreak} días en Modo Bestia
                                                </Text>
                                            </View>
                                        )}

                                        {/* Custom RPE Bar Chart */}
                                        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.horizontalScroll}>
                                            <View style={styles.rpeBarContainer}>
                                                {sessionRPEData.data.map((item, index) => (
                                                    <View key={index} style={styles.rpeBarWrapper}>
                                                        <View
                                                            style={[
                                                                styles.rpeBar,
                                                                {
                                                                    height: (item.value / 5) * 100,
                                                                    backgroundColor: item.color,
                                                                    shadowColor: item.value >= 4 ? item.color : 'transparent',
                                                                    shadowOpacity: item.value >= 4 ? 0.6 : 0,
                                                                    shadowRadius: item.value >= 4 ? 8 : 0,
                                                                    elevation: item.value >= 4 ? 4 : 0,
                                                                }
                                                            ]}
                                                        />
                                                        {item.hasNote && (
                                                            <View style={styles.rpeNoteDot} />
                                                        )}
                                                        <Text style={styles.rpeBarLabel}>{item.label}</Text>
                                                        <Text style={[styles.rpeBarValue, { color: item.color }]}>
                                                            {item.value}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </ScrollView>

                                        {/* Stats summary */}
                                        <View style={styles.rpeSummaryRow}>
                                            <View style={styles.rpeSummaryItem}>
                                                <Text style={styles.rpeSummaryLabel}>Sesiones</Text>
                                                <Text style={styles.rpeSummaryValue}>{sessionRPEData.totalSessions}</Text>
                                            </View>
                                            <View style={styles.rpeSummaryItem}>
                                                <Text style={styles.rpeSummaryLabel}>Modo Bestia</Text>
                                                <Text style={[styles.rpeSummaryValue, { color: RPE_COLORS[5] }]}>
                                                    {sessionRPEData.modoBestaCount}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={styles.chartSubInfo}>{currentKpi.description}</Text>
                                    </>
                                )}

                                {/* KPI: PRs */}
                                {selectedKpi === 'prCount' && prCountData && (
                                    <>
                                        <View style={styles.chartHeader}>
                                            <Text style={styles.sectionTitle}>PRs (Récords Personales)</Text>
                                            <View style={styles.chartSummary}>
                                                <Text style={[styles.chartSummaryValue, { color: '#eab308' }]}>
                                                    {prCountData.totalPRs}
                                                </Text>
                                                <Text style={styles.chartSummaryLabel}>en el período</Text>
                                            </View>
                                        </View>
                                        <BarChart
                                            data={prCountData}
                                            width={screenWidth - 32}
                                            height={220}
                                            chartConfig={{
                                                ...barChartConfig,
                                                color: (opacity = 1) => `rgba(234, 179, 8, ${opacity})`,
                                            }}
                                            style={styles.chart}
                                            showValuesOnTopOfBars
                                        />
                                        <Text style={styles.chartSubInfo}>
                                            {currentKpi.description}
                                        </Text>
                                    </>
                                )}

                                {/* No data fallback */}
                                {((selectedKpi === 'volume' && !volumeData) ||
                                    (selectedKpi === 'intensity' && !intensityData) ||
                                    (selectedKpi === 'compliance' && !complianceWeeklyData) ||
                                    (selectedKpi === 'heavySets' && !heavySetsData) ||
                                    (selectedKpi === 'muscleBalance' && !muscleBalanceData) ||
                                    (selectedKpi === 'sessionRPE' && !sessionRPEData) ||
                                    (selectedKpi === 'prCount' && !prCountData)) && (
                                        <View style={styles.noDataContainer}>
                                            <Ionicons name="bar-chart-outline" size={48} color="#cbd5e1" />
                                            <Text style={styles.noDataText}>Sin datos para este período</Text>
                                        </View>
                                    )}
                            </View>

                            {/* Selector de agrupación para tabla */}
                            <Text style={styles.sectionTitle}>📊 Tabla Comparativa</Text>
                            <View style={styles.selectorContainer}>
                                <Pressable
                                    style={[styles.selectorButton, temporalidad === 'semanas' && styles.selectorActive]}
                                    onPress={() => setTemporalidad('semanas')}
                                >
                                    <Text style={[styles.selectorText, temporalidad === 'semanas' && styles.selectorTextActive]}>
                                        Semanas
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.selectorButton, temporalidad === 'meses' && styles.selectorActive]}
                                    onPress={() => setTemporalidad('meses')}
                                >
                                    <Text style={[styles.selectorText, temporalidad === 'meses' && styles.selectorTextActive]}>
                                        Meses
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.selectorButton, temporalidad === 'total' && styles.selectorActive]}
                                    onPress={() => setTemporalidad('total')}
                                >
                                    <Text style={[styles.selectorText, temporalidad === 'total' && styles.selectorTextActive]}>
                                        Total
                                    </Text>
                                </Pressable>
                            </View>

                            {/* Tabla comparativa */}
                            {datosAgrupados.length > 0 && (
                                <View style={styles.tableContainer}>


                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Período</Text>
                                        <Text style={styles.tableHeaderCell}>Volumen</Text>
                                        <Text style={styles.tableHeaderCell}>Reps</Text>
                                        <Text style={styles.tableHeaderCell}>Carga</Text>
                                        <Text style={styles.tableHeaderCell}>Ses.</Text>
                                    </View>

                                    {datosAgrupados.map((dato, index) => {
                                        const anterior = datosAgrupados[index + 1];
                                        const cambioVol = anterior ? calcularCambio(dato.volumen, anterior.volumen) : 0;
                                        const cambioReps = anterior ? calcularCambio(dato.reps, anterior.reps) : 0;
                                        const cambioCarga = anterior ? calcularCambio(dato.cargaMedia, anterior.cargaMedia) : 0;
                                        const cambioSes = anterior ? dato.numSesiones - anterior.numSesiones : 0;

                                        return (
                                            <View key={dato.periodo} style={styles.tableRow}>
                                                <Text style={[styles.tableCell, styles.tableCellPeriodo, { flex: 1.2 }]}>
                                                    {dato.periodo}
                                                </Text>

                                                <View style={styles.tableCellValue}>
                                                    <Text style={styles.tableValue}>{(dato.volumen / 1000).toFixed(1)}k</Text>
                                                    {anterior && (
                                                        <View style={[styles.cambioTag, { backgroundColor: getCambioStyle(cambioVol).color + '15' }]}>
                                                            <Ionicons name={getCambioStyle(cambioVol).icon} size={10} color={getCambioStyle(cambioVol).color} />
                                                            <Text style={[styles.cambioText, { color: getCambioStyle(cambioVol).color }]}>
                                                                {cambioVol > 0 ? '+' : ''}{cambioVol}%
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>

                                                <View style={styles.tableCellValue}>
                                                    <Text style={styles.tableValue}>{dato.reps}</Text>
                                                    {anterior && (
                                                        <View style={[styles.cambioTag, { backgroundColor: getCambioStyle(cambioReps).color + '15' }]}>
                                                            <Ionicons name={getCambioStyle(cambioReps).icon} size={10} color={getCambioStyle(cambioReps).color} />
                                                        </View>
                                                    )}
                                                </View>

                                                <View style={styles.tableCellValue}>
                                                    <Text style={styles.tableValue}>{dato.cargaMedia}</Text>
                                                    {anterior && (
                                                        <View style={[styles.cambioTag, { backgroundColor: getCambioStyle(cambioCarga).color + '15' }]}>
                                                            <Ionicons name={getCambioStyle(cambioCarga).icon} size={10} color={getCambioStyle(cambioCarga).color} />
                                                        </View>
                                                    )}
                                                </View>

                                                <View style={styles.tableCellValue}>
                                                    <Text style={styles.tableValue}>{dato.numSesiones}</Text>
                                                    {anterior && cambioSes !== 0 && (
                                                        <Text style={[styles.cambioSmall, { color: getCambioStyle(cambioSes).color }]}>
                                                            {cambioSes > 0 ? '+' : ''}{cambioSes}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* Resumen de totales */}
                            <View style={styles.totalesContainer}>
                                <Text style={styles.sectionTitle}>📋 Resumen Total</Text>
                                <View style={styles.totalesGrid}>
                                    <View style={styles.totalItem}>
                                        <Text style={styles.totalLabel}>Volumen Total</Text>
                                        <Text style={styles.totalValue}>{(totales.volumen / 1000).toFixed(1)}k kg</Text>
                                    </View>
                                    <View style={styles.totalItem}>
                                        <Text style={styles.totalLabel}>Reps Totales</Text>
                                        <Text style={styles.totalValue}>{totales.reps.toLocaleString()}</Text>
                                    </View>
                                    <View style={styles.totalItem}>
                                        <Text style={styles.totalLabel}>Sesiones</Text>
                                        <Text style={styles.totalValue}>{totales.sesiones}</Text>
                                    </View>
                                    <View style={styles.totalItem}>
                                        <Text style={styles.totalLabel}>Tendencia</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Ionicons
                                                name={getCambioStyle(tendenciaGeneral).icon}
                                                size={20}
                                                color={getCambioStyle(tendenciaGeneral).color}
                                            />
                                            <Text style={[styles.totalValue, { color: getCambioStyle(tendenciaGeneral).color }]}>
                                                {tendenciaGeneral > 0 ? 'Mejorando' : tendenciaGeneral < 0 ? 'Bajando' : 'Estable'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </>
                    )}

                    {/* ════════════════════════════════════════════════════════════════
                   VISTA TABLA DETALLADA
                   ════════════════════════════════════════════════════════════════ */}
                    {viewMode === 'table' && (
                        <View style={styles.detailedTableContainer}>
                            {/* Sin datos */}
                            {!datosPorRutina.current && datosPorRutina.old.length === 0 ? (
                                <View style={styles.noDataContainer}>
                                    <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
                                    <Text style={styles.noDataText}>Sin sesiones registradas</Text>
                                </View>
                            ) : (
                                <>
                                    {/* RUTINA ACTUAL */}
                                    {datosPorRutina.current && (
                                        <View style={styles.routineSection}>
                                            <Text style={styles.routineSectionTitle}>📋 Rutina Actual</Text>
                                            <View style={styles.routineCard}>
                                                <Pressable onPress={() => toggleRoutine('current')} style={styles.routineHeader}>
                                                    <View style={styles.routineHeaderLeft}>
                                                        <Text style={styles.routineName}>{datosPorRutina.current.routineName}</Text>
                                                        <Text style={styles.routineDate}>Última: {datosPorRutina.current.lastDate}</Text>
                                                    </View>
                                                    <Ionicons name={expandedRoutines['current'] ? 'chevron-up' : 'chevron-down'} size={22} color="#3b82f6" />
                                                </Pressable>

                                                {expandedRoutines['current'] && (
                                                    <View style={styles.routineContent}>
                                                        {datosPorRutina.current.dias.map((dia) => {
                                                            const dayKey = `current-${dia.dayIndex}`;
                                                            const isDayExpanded = expandedDays[dayKey];
                                                            return (
                                                                <View key={dia.dayIndex} style={styles.dayCard}>
                                                                    <Pressable onPress={() => toggleDay('current', dia.dayIndex)} style={styles.dayHeader}>
                                                                        <Text style={styles.dayLabel}>{dia.dayLabel}</Text>
                                                                        <View style={styles.dayHeaderRight}>
                                                                            <Text style={styles.dayStats}>{dia.exercises.length} ej. • {dia.totalSessions} ses.</Text>
                                                                            <Ionicons name={isDayExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#64748b" />
                                                                        </View>
                                                                    </Pressable>
                                                                    {isDayExpanded && (
                                                                        <View style={styles.dayContent}>
                                                                            {dia.exercises.map((exercise, exIdx) => (
                                                                                <View key={exIdx} style={styles.exerciseBlock}>
                                                                                    <View style={styles.exerciseBlockHeader}>
                                                                                        <Text style={styles.exerciseMuscleTag}>{exercise.muscleGroup}</Text>
                                                                                        <Text style={styles.exerciseBlockName} numberOfLines={1}>{exercise.exerciseName}</Text>
                                                                                    </View>
                                                                                    <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.sessionsCarousel} contentContainerStyle={styles.sessionsCarouselContent}>
                                                                                        {exercise.sesiones.map((sesion, sIdx) => (
                                                                                            <View key={sIdx} style={styles.sessionBox}>
                                                                                                <View style={styles.sessionBoxHeader}>
                                                                                                    <Text style={styles.sessionBoxNum}>S{sesion.week}</Text>
                                                                                                    <Text style={styles.sessionBoxDate}>{sesion.date}</Text>
                                                                                                </View>
                                                                                                <View style={styles.setHeaderRow}>
                                                                                                    <Text style={styles.setHeaderCell}>S</Text>
                                                                                                    <Text style={styles.setHeaderCellData}>Rep</Text>
                                                                                                    <Text style={styles.setHeaderCellData}>Kg</Text>
                                                                                                    <Text style={styles.setHeaderCellNote}>📝</Text>
                                                                                                </View>
                                                                                                {sesion.sets.map((set, setIdx) => (
                                                                                                    <View key={setIdx} style={styles.setTableRow}>
                                                                                                        <Text style={styles.setColNum}>{set.setNumber}</Text>
                                                                                                        <View style={styles.setColData}>
                                                                                                            <Text style={[styles.setColReps, { color: getRepStatusColor(set.status) }]}>{set.reps ?? '-'}</Text>
                                                                                                            {set.repTrend === 'up' && <Ionicons name="caret-up" size={10} color="#22c55e" />}
                                                                                                        </View>
                                                                                                        <View style={styles.setColData}>
                                                                                                            <Text style={styles.setColKg}>{set.weight ?? '-'}</Text>
                                                                                                            {set.weightTrend === 'up' && <Ionicons name="caret-up" size={10} color="#22c55e" />}
                                                                                                        </View>
                                                                                                        {/* 📝 Botón de media/nota - detecta todo el contenido disponible */}
                                                                                                        {(() => {
                                                                                                            // Buscar todos los medios para este set
                                                                                                            const visualMedia = findVisualForSet(exercise.exerciseName, set.setNumber, sesion.week);
                                                                                                            const audioMedia = findAudioForSet(exercise.exerciseName, set.setNumber, sesion.week);
                                                                                                            const hasNote = set.notes?.note;

                                                                                                            // Determinar emoji por prioridad: video > foto > audio > nota
                                                                                                            let icon = null;
                                                                                                            let iconColor = '#fff';
                                                                                                            let bgColor = styles.setColNoteBtnEmpty;

                                                                                                            if (visualMedia?.mediaType === 'video') {
                                                                                                                icon = 'videocam';
                                                                                                                bgColor = { backgroundColor: '#ef4444' }; // Rojo para video
                                                                                                            } else if (visualMedia?.mediaType === 'photo') {
                                                                                                                icon = 'image';
                                                                                                                bgColor = { backgroundColor: '#3b82f6' }; // Azul para foto
                                                                                                            } else if (audioMedia) {
                                                                                                                icon = 'mic';
                                                                                                                bgColor = { backgroundColor: '#8b5cf6' }; // Púrpura para audio
                                                                                                            } else if (hasNote || set.notes?.value) {
                                                                                                                icon = 'chatbubble';
                                                                                                                bgColor = { backgroundColor: NOTE_COLORS[set.notes?.value] || '#10b981' };
                                                                                                            }

                                                                                                            const hasContent = visualMedia || audioMedia || hasNote || set.notes?.value;

                                                                                                            return (
                                                                                                                <TouchableOpacity
                                                                                                                    onPress={() => {
                                                                                                                        if (!hasContent) return;

                                                                                                                        // Prioridad: visual > audio > nota
                                                                                                                        if (visualMedia) {
                                                                                                                            setSelectedFeedback(visualMedia);
                                                                                                                            setVideoModalVisible(true);
                                                                                                                            markFeedbackAsViewed(visualMedia._id);
                                                                                                                        } else if (audioMedia) {
                                                                                                                            setSelectedFeedback(audioMedia);
                                                                                                                            setVideoModalVisible(true);
                                                                                                                        } else if (hasNote || set.notes?.value) {
                                                                                                                            // Crear pseudo-feedback para nota de texto
                                                                                                                            const pseudoFeedback = {
                                                                                                                                _id: `table-note-${sesion.week}-${exercise.exerciseName}-${set.setNumber}`,
                                                                                                                                exerciseName: exercise.exerciseName,
                                                                                                                                athleteNote: set.notes?.note || '',
                                                                                                                                mediaType: 'text-note',
                                                                                                                                setNumber: set.setNumber,
                                                                                                                                createdAt: sesion.date,
                                                                                                                                athleteId: clientId,
                                                                                                                            };
                                                                                                                            setSelectedFeedback(pseudoFeedback);
                                                                                                                            setVideoModalVisible(true);
                                                                                                                        }
                                                                                                                    }}
                                                                                                                    style={[styles.setColNoteBtn, hasContent ? bgColor : styles.setColNoteBtnEmpty]}
                                                                                                                    activeOpacity={hasContent ? 0.6 : 1}
                                                                                                                >
                                                                                                                    {icon && <Ionicons name={icon} size={8} color={iconColor} />}
                                                                                                                </TouchableOpacity>
                                                                                                            );
                                                                                                        })()}
                                                                                                    </View>
                                                                                                ))}
                                                                                            </View>
                                                                                        ))}
                                                                                    </ScrollView>
                                                                                </View>
                                                                            ))}
                                                                        </View>
                                                                    )}
                                                                </View>
                                                            );
                                                        })}
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    )}

                                    {/* RUTINAS ANTIGUAS */}
                                    {datosPorRutina.old.length > 0 && (
                                        <View style={styles.routineSection}>
                                            <Text style={styles.routineSectionTitle}>📦 Rutinas Antiguas</Text>
                                            {datosPorRutina.old.map((rutina) => (
                                                <View key={rutina.routineId} style={styles.routineCardOld}>
                                                    <Pressable onPress={() => toggleRoutine(rutina.routineId)} style={styles.routineHeaderOld}>
                                                        <View style={styles.routineHeaderLeft}>
                                                            <Text style={styles.routineNameOld}>{rutina.routineName}</Text>
                                                            <Text style={styles.routineDateOld}>Última: {rutina.lastDate}</Text>
                                                        </View>
                                                        <Ionicons name={expandedRoutines[rutina.routineId] ? 'chevron-up' : 'chevron-down'} size={20} color="#64748b" />
                                                    </Pressable>
                                                    {expandedRoutines[rutina.routineId] && (
                                                        <View style={styles.routineContent}>
                                                            {rutina.dias.map((dia) => {
                                                                const dayKey = `${rutina.routineId}-${dia.dayIndex}`;
                                                                const isDayExpanded = expandedDays[dayKey];
                                                                return (
                                                                    <View key={dia.dayIndex} style={styles.dayCard}>
                                                                        <Pressable onPress={() => toggleDay(rutina.routineId, dia.dayIndex)} style={styles.dayHeader}>
                                                                            <Text style={styles.dayLabel}>{dia.dayLabel}</Text>
                                                                            <View style={styles.dayHeaderRight}>
                                                                                <Text style={styles.dayStats}>{dia.exercises.length} ej. • {dia.totalSessions} ses.</Text>
                                                                                <Ionicons name={isDayExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#64748b" />
                                                                            </View>
                                                                        </Pressable>
                                                                        {isDayExpanded && (
                                                                            <View style={styles.dayContent}>
                                                                                {dia.exercises.map((exercise, exIdx) => (
                                                                                    <View key={exIdx} style={styles.exerciseBlock}>
                                                                                        <View style={styles.exerciseBlockHeader}>
                                                                                            <Text style={styles.exerciseMuscleTag}>{exercise.muscleGroup}</Text>
                                                                                            <Text style={styles.exerciseBlockName} numberOfLines={1}>{exercise.exerciseName}</Text>
                                                                                        </View>
                                                                                        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.sessionsCarousel} contentContainerStyle={styles.sessionsCarouselContent}>
                                                                                            {exercise.sesiones.map((sesion, sIdx) => (
                                                                                                <View key={sIdx} style={styles.sessionBox}>
                                                                                                    <View style={styles.sessionBoxHeader}>
                                                                                                        <Text style={styles.sessionBoxNum}>S{sesion.week}</Text>
                                                                                                        <Text style={styles.sessionBoxDate}>{sesion.date}</Text>
                                                                                                    </View>
                                                                                                    <View style={styles.setHeaderRow}>
                                                                                                        <Text style={styles.setHeaderCell}>S</Text>
                                                                                                        <Text style={styles.setHeaderCellData}>Rep</Text>
                                                                                                        <Text style={styles.setHeaderCellData}>Kg</Text>
                                                                                                        <Text style={styles.setHeaderCellNote}>📝</Text>
                                                                                                    </View>
                                                                                                    {sesion.sets.map((set, setIdx) => (
                                                                                                        <View key={setIdx} style={styles.setTableRow}>
                                                                                                            <Text style={styles.setColNum}>{set.setNumber}</Text>
                                                                                                            <View style={styles.setColData}>
                                                                                                                <Text style={[styles.setColReps, { color: getRepStatusColor(set.status) }]}>{set.reps ?? '-'}</Text>
                                                                                                                {set.repTrend === 'up' && <Ionicons name="caret-up" size={10} color="#22c55e" />}
                                                                                                            </View>
                                                                                                            <View style={styles.setColData}>
                                                                                                                <Text style={styles.setColKg}>{set.weight ?? '-'}</Text>
                                                                                                                {set.weightTrend === 'up' && <Ionicons name="caret-up" size={10} color="#22c55e" />}
                                                                                                            </View>
                                                                                                            {/* 📝 Botón de media/nota - detecta todo el contenido disponible */}
                                                                                                            {(() => {
                                                                                                                const visualMedia = findVisualForSet(exercise.exerciseName, set.setNumber, sesion.week);
                                                                                                                const audioMedia = findAudioForSet(exercise.exerciseName, set.setNumber, sesion.week);
                                                                                                                const hasNote = set.notes?.note;

                                                                                                                let icon = null;
                                                                                                                let bgColor = styles.setColNoteBtnEmpty;

                                                                                                                if (visualMedia?.mediaType === 'video') {
                                                                                                                    icon = 'videocam';
                                                                                                                    bgColor = { backgroundColor: '#ef4444' };
                                                                                                                } else if (visualMedia?.mediaType === 'photo') {
                                                                                                                    icon = 'image';
                                                                                                                    bgColor = { backgroundColor: '#3b82f6' };
                                                                                                                } else if (audioMedia) {
                                                                                                                    icon = 'mic';
                                                                                                                    bgColor = { backgroundColor: '#8b5cf6' };
                                                                                                                } else if (hasNote || set.notes?.value) {
                                                                                                                    icon = 'chatbubble';
                                                                                                                    bgColor = { backgroundColor: NOTE_COLORS[set.notes?.value] || '#10b981' };
                                                                                                                }

                                                                                                                const hasContent = visualMedia || audioMedia || hasNote || set.notes?.value;

                                                                                                                return (
                                                                                                                    <TouchableOpacity
                                                                                                                        onPress={() => {
                                                                                                                            if (!hasContent) return;
                                                                                                                            if (visualMedia) {
                                                                                                                                setSelectedFeedback(visualMedia);
                                                                                                                                setVideoModalVisible(true);
                                                                                                                                markFeedbackAsViewed(visualMedia._id);
                                                                                                                            } else if (audioMedia) {
                                                                                                                                setSelectedFeedback(audioMedia);
                                                                                                                                setVideoModalVisible(true);
                                                                                                                            } else if (hasNote || set.notes?.value) {
                                                                                                                                const pseudoFeedback = {
                                                                                                                                    _id: `old-table-${sesion.week}-${exercise.exerciseName}-${set.setNumber}`,
                                                                                                                                    exerciseName: exercise.exerciseName,
                                                                                                                                    athleteNote: set.notes?.note || '',
                                                                                                                                    mediaType: 'text-note',
                                                                                                                                    setNumber: set.setNumber,
                                                                                                                                    createdAt: sesion.date,
                                                                                                                                    athleteId: clientId,
                                                                                                                                };
                                                                                                                                setSelectedFeedback(pseudoFeedback);
                                                                                                                                setVideoModalVisible(true);
                                                                                                                            }
                                                                                                                        }}
                                                                                                                        style={[styles.setColNoteBtn, hasContent ? bgColor : styles.setColNoteBtnEmpty]}
                                                                                                                        activeOpacity={hasContent ? 0.6 : 1}
                                                                                                                    >
                                                                                                                        {icon && <Ionicons name={icon} size={8} color="#fff" />}
                                                                                                                    </TouchableOpacity>
                                                                                                                );
                                                                                                            })()}
                                                                                                        </View>
                                                                                                    ))}
                                                                                                </View>
                                                                                            ))}
                                                                                        </ScrollView>
                                                                                    </View>
                                                                                ))}
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                );
                                                            })}
                                                        </View>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                    )}

                    {/* ════════════════════════════════════════════════════════════════
                    💬 VISTA COMENTARIOS - FEEDBACK VISUAL DEL CLIENTE
                   ════════════════════════════════════════════════════════════════ */}
                    {viewMode === 'comments' && (
                        <View style={styles.commentsContainer}>
                            {/* Sin comentarios ni RPE */}
                            {(!comentariosPorRutina.current || comentariosPorRutina.current.semanas?.length === 0) && comentariosPorRutina.old.length === 0 ? (
                                <View style={styles.noDataContainer}>
                                    <Ionicons name="chatbubble-ellipses-outline" size={48} color="#cbd5e1" />
                                    <Text style={styles.noDataText}>Sin comentarios registrados</Text>
                                    <Text style={styles.noDataSubtext}>Los comentarios del cliente aparecerán aquí</Text>
                                </View>
                            ) : (
                                <>
                                    {/* RUTINA ACTUAL */}
                                    {comentariosPorRutina.current && comentariosPorRutina.current.semanas?.length > 0 && (
                                        <View style={styles.commentsRoutineSection}>
                                            <View style={styles.commentsRoutineHeader}>
                                                <Text style={styles.commentsRoutineLabel}>📋 Rutina Actual</Text>
                                                <View style={styles.commentsBadge}>
                                                    <Text style={styles.commentsBadgeText}>{comentariosPorRutina.current.totalComentarios}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.commentsRoutineName}>{comentariosPorRutina.current.routineName}</Text>

                                            {comentariosPorRutina.current.semanas.map((semana) => {
                                                // Calcular RPE promedio de la semana
                                                const diasConRPE = semana.dias.filter(d => d.sessionRPE);
                                                const avgRPE = diasConRPE.length > 0
                                                    ? Math.round((diasConRPE.reduce((sum, d) => sum + d.sessionRPE, 0) / diasConRPE.length) * 10) / 10
                                                    : null;
                                                const avgColor = avgRPE ? RPE_COLORS[Math.round(avgRPE)] || '#64748b' : null;
                                                const avgLabel = avgRPE ? RPE_LABELS[Math.round(avgRPE)] || '' : '';

                                                return (
                                                    <View key={semana.week} style={styles.commentsWeekGroup}>
                                                        <Pressable
                                                            onPress={() => toggleWeek('current', semana.week, semana.dias)}
                                                            style={styles.commentsWeekHeaderPressable}
                                                        >
                                                            <View style={styles.commentsWeekBadge}>
                                                                <Text style={styles.commentsWeekBadgeText}>Semana {semana.week}</Text>
                                                            </View>
                                                            <View style={styles.commentsWeekRight}>
                                                                {/* 🆕 RPE promedio de la semana */}
                                                                {avgRPE && (
                                                                    <View style={[styles.commentsWeekRpeBadge, { backgroundColor: avgColor + '20', borderColor: avgColor }]}>
                                                                        <Text style={[styles.commentsWeekRpeText, { color: avgColor }]}>
                                                                            {avgRPE} {avgLabel}
                                                                        </Text>
                                                                    </View>
                                                                )}
                                                                <Text style={styles.commentsWeekCount}>
                                                                    {semana.dias.reduce((acc, d) => acc + d.exercises.reduce((a, e) => a + e.sets.length, 0), 0)} notas
                                                                </Text>
                                                                <Ionicons
                                                                    name={expandedWeeks[`current-${semana.week}`] ? 'chevron-up' : 'chevron-down'}
                                                                    size={18}
                                                                    color="#64748b"
                                                                />
                                                            </View>
                                                        </Pressable>

                                                        {expandedWeeks[`current-${semana.week}`] && semana.dias.map((dia, dIdx) => (
                                                            <View key={`${dia.dayIndex}-${dIdx}`} style={styles.commentsDaySection}>
                                                                <View style={styles.commentsDayHeaderRow}>
                                                                    <Text style={styles.commentsDayHeader}>
                                                                        {dia.dayLabel} • {dia.date}
                                                                    </Text>
                                                                    {dia.sessionRPE && (
                                                                        <View style={[styles.commentsDayRpeBadge, { backgroundColor: dia.rpeColor + '20', borderColor: dia.rpeColor }]}>
                                                                            <Text style={[styles.commentsDayRpeText, { color: dia.rpeColor }]}>
                                                                                {dia.sessionRPE}/5 {dia.rpeLabel}
                                                                            </Text>
                                                                        </View>
                                                                    )}
                                                                </View>

                                                                {/* Session note if exists */}
                                                                {dia.sessionNote && (
                                                                    <View style={[styles.commentsDaySessionNote, { borderLeftColor: dia.rpeColor }]}>
                                                                        <Text style={styles.commentsDaySessionNoteText}>"{dia.sessionNote}"</Text>
                                                                    </View>
                                                                )}

                                                                {dia.exercises.map((exercise, exIdx) => (
                                                                    <View key={exIdx} style={styles.commentsExerciseBlockCompact}>
                                                                        <Text style={styles.commentsExerciseLineCompact} numberOfLines={1}>
                                                                            <Text style={styles.commentsExerciseMuscleInline}>{exercise.muscleGroup}</Text>
                                                                            {' '}{exercise.exerciseName}
                                                                        </Text>

                                                                        {exercise.sets.map((set, setIdx) => {
                                                                            // Buscar media visual (foto/video) y audio por separado
                                                                            const visualMedia = findVisualForSet(exercise.exerciseName, set.setNumber, semana.week);
                                                                            const audioMedia = findAudioForSet(exercise.exerciseName, set.setNumber, semana.week);
                                                                            const hasAnyMedia = visualMedia || audioMedia;

                                                                            return (
                                                                                <View
                                                                                    key={setIdx}
                                                                                    style={[
                                                                                        styles.commentCardCompact,
                                                                                        set.hasPain && styles.commentCardWarning,
                                                                                        hasAnyMedia && styles.commentCardWithVideo
                                                                                    ]}
                                                                                >
                                                                                    <View style={styles.commentCardCompactRow}>
                                                                                        <View style={[
                                                                                            styles.commentSemaphoreCompact,
                                                                                            { backgroundColor: NOTE_COLORS[set.noteValue] || '#6b7280' }
                                                                                        ]} />
                                                                                        <Text style={styles.commentSetLabelCompact}>S{set.setNumber}</Text>
                                                                                        <Text style={styles.commentDataCompact}>
                                                                                            {set.weight ?? '-'}kg × {set.reps ?? '-'}
                                                                                        </Text>
                                                                                        {set.hasPain && <Text style={styles.commentPainIconCompact}>⚠️</Text>}

                                                                                        {/* Icono de foto/video a la derecha (abre modal) */}
                                                                                        {visualMedia && (() => {
                                                                                            const isPending = !visualMedia.viewedByCoach && !visualMedia.coachResponse?.respondedAt;
                                                                                            const isPhoto = visualMedia.mediaType === 'photo';

                                                                                            return (
                                                                                                <Pressable
                                                                                                    style={[
                                                                                                        styles.inlineVideoBtn,
                                                                                                        isPending && styles.inlineVideoBtnPending
                                                                                                    ]}
                                                                                                    onPress={() => {
                                                                                                        setSelectedFeedback(visualMedia);
                                                                                                        setVideoModalVisible(true);
                                                                                                        markFeedbackAsViewed(visualMedia._id);
                                                                                                    }}
                                                                                                >
                                                                                                    <Ionicons
                                                                                                        name={isPhoto ? 'image' : 'videocam'}
                                                                                                        size={14}
                                                                                                        color={isPending ? '#fff' : '#4361ee'}
                                                                                                    />
                                                                                                    {isPending && (
                                                                                                        <View style={styles.inlineVideoPendingDot} />
                                                                                                    )}
                                                                                                </Pressable>
                                                                                            );
                                                                                        })()}

                                                                                        {/* Botón responder a nota de texto (solo si no hay visual NI audio) */}
                                                                                        {set.noteText && !visualMedia && !audioMedia && (
                                                                                            <Pressable
                                                                                                style={styles.inlineReplyBtn}
                                                                                                onPress={() => {
                                                                                                    // Crear pseudo-feedback para notas de texto
                                                                                                    const pseudoFeedback = {
                                                                                                        _id: `note-${dia.sessionId}-${exercise.exerciseName}-${set.setNumber}`,
                                                                                                        exerciseName: exercise.exerciseName,
                                                                                                        athleteNote: set.noteText,
                                                                                                        mediaType: 'text-note',
                                                                                                        setNumber: set.setNumber,
                                                                                                        serieKey: `${semana.week}|${dia.dayIndex}|${exIdx}|${set.setNumber - 1}`,
                                                                                                        createdAt: dia.dateSort,
                                                                                                        athleteId: clientId,
                                                                                                    };
                                                                                                    setSelectedFeedback(pseudoFeedback);
                                                                                                    setVideoModalVisible(true);
                                                                                                }}
                                                                                            >
                                                                                                <Ionicons name="chatbubble-outline" size={14} color="#4361ee" />
                                                                                            </Pressable>
                                                                                        )}
                                                                                    </View>

                                                                                    {/* Texto de nota */}
                                                                                    {set.noteText ? (
                                                                                        <Text style={styles.commentTextCompact} numberOfLines={2}>"{set.noteText}"</Text>
                                                                                    ) : visualMedia?.athleteNote ? (
                                                                                        <Text style={styles.commentTextCompact} numberOfLines={2}>
                                                                                            {visualMedia.mediaType === 'photo' ? '📷' : '📹'} "{visualMedia.athleteNote}"
                                                                                        </Text>
                                                                                    ) : audioMedia?.athleteNote ? (
                                                                                        <Text style={styles.commentTextCompact} numberOfLines={2}>
                                                                                            🎤 "{audioMedia.athleteNote}"
                                                                                        </Text>
                                                                                    ) : set.hasMediaOnly && !audioMedia ? (
                                                                                        <Text style={[styles.commentTextCompact, { fontStyle: 'italic', color: '#64748b' }]} numberOfLines={1}>
                                                                                            {visualMedia?.mediaType === 'photo' ? '📷 Foto enviada' : '📹 Video enviado'}
                                                                                        </Text>
                                                                                    ) : null}

                                                                                    {/* Audio inline player (debajo de la nota) + botón responder si no hay visual */}
                                                                                    {audioMedia && (
                                                                                        <View style={styles.audioRowContainer}>
                                                                                            <View style={{ flex: 1 }}>
                                                                                                <InlineAudioPlayer
                                                                                                    feedback={audioMedia}
                                                                                                    onViewed={markFeedbackAsViewed}
                                                                                                />
                                                                                            </View>
                                                                                            {/* Botón responder a audio (sin visual media) */}
                                                                                            {!visualMedia && (
                                                                                                <Pressable
                                                                                                    style={styles.inlineReplyBtn}
                                                                                                    onPress={() => {
                                                                                                        setSelectedFeedback(audioMedia);
                                                                                                        setVideoModalVisible(true);
                                                                                                    }}
                                                                                                >
                                                                                                    <Ionicons name="chatbubble-outline" size={14} color="#4361ee" />
                                                                                                </Pressable>
                                                                                            )}
                                                                                        </View>
                                                                                    )}
                                                                                </View>
                                                                            );
                                                                        })}
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        ))}
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}

                                    {/* RUTINAS ANTIGUAS CON COMENTARIOS */}
                                    {comentariosPorRutina.old.length > 0 && (
                                        <View style={styles.commentsOldSection}>
                                            <Text style={styles.commentsOldLabel}>📦 Rutinas Anteriores</Text>
                                            {comentariosPorRutina.old.map((rutina) => (
                                                <View key={rutina.routineId} style={styles.commentsOldRoutine}>
                                                    <Pressable
                                                        onPress={() => toggleRoutine(rutina.routineId)}
                                                        style={styles.commentsOldRoutineHeader}
                                                    >
                                                        <View style={styles.commentsOldRoutineInfo}>
                                                            <Text style={styles.commentsOldRoutineName}>{rutina.routineName}</Text>
                                                            <Text style={styles.commentsOldRoutineDate}>Última: {rutina.lastDate}</Text>
                                                        </View>
                                                        <View style={styles.commentsOldRoutineRight}>
                                                            <View style={styles.commentsBadgeSmall}>
                                                                <Text style={styles.commentsBadgeSmallText}>{rutina.totalComentarios}</Text>
                                                            </View>
                                                            <Ionicons
                                                                name={expandedRoutines[rutina.routineId] ? 'chevron-up' : 'chevron-down'}
                                                                size={18}
                                                                color="#64748b"
                                                            />
                                                        </View>
                                                    </Pressable>

                                                    {expandedRoutines[rutina.routineId] && (
                                                        <View style={styles.commentsOldRoutineContent}>
                                                            {rutina.semanas.map((semana) => (
                                                                <View key={semana.week} style={styles.commentsWeekGroupSmall}>
                                                                    <Text style={styles.commentsWeekLabelSmall}>Semana {semana.week}</Text>
                                                                    {semana.dias.map((dia, dIdx) => (
                                                                        <View key={`${dia.dayIndex}-${dIdx}`}>
                                                                            <View style={styles.commentsDayHeaderRow}>
                                                                                <Text style={styles.commentsDayHeaderSmall}>
                                                                                    {dia.dayLabel} • {dia.date}
                                                                                </Text>
                                                                                {dia.sessionRPE && (
                                                                                    <View style={[styles.commentsDayRpeBadgeSmall, { backgroundColor: dia.rpeColor + '20', borderColor: dia.rpeColor }]}>
                                                                                        <Text style={[styles.commentsDayRpeTextSmall, { color: dia.rpeColor }]}>
                                                                                            {dia.sessionRPE}/5
                                                                                        </Text>
                                                                                    </View>
                                                                                )}
                                                                            </View>
                                                                            {dia.exercises.map((exercise, exIdx) => (
                                                                                <View key={exIdx} style={styles.commentsExerciseBlockSmall}>
                                                                                    <Text style={styles.commentsExerciseNameSmall}>
                                                                                        {exercise.muscleGroup} - {exercise.exerciseName}
                                                                                    </Text>
                                                                                    {exercise.sets.map((set, setIdx) => (
                                                                                        <View
                                                                                            key={setIdx}
                                                                                            style={[
                                                                                                styles.commentCardSmall,
                                                                                                set.hasPain && styles.commentCardWarning
                                                                                            ]}
                                                                                        >
                                                                                            <View style={styles.commentCardSmallLeft}>
                                                                                                <Text style={styles.commentSetLabelSmall}>S{set.setNumber}</Text>
                                                                                                <Text style={styles.commentDataSmall}>
                                                                                                    {set.weight ?? '-'}kg × {set.reps ?? '-'}
                                                                                                </Text>
                                                                                                {set.hasPain && <Text>⚠️</Text>}
                                                                                                <View style={[
                                                                                                    styles.commentSemaphoreSmall,
                                                                                                    { backgroundColor: NOTE_COLORS[set.noteValue] || '#6b7280' }
                                                                                                ]} />
                                                                                            </View>
                                                                                            <Text style={styles.commentTextSmall} numberOfLines={2}>
                                                                                                "{set.noteText}"
                                                                                            </Text>
                                                                                        </View>
                                                                                    ))}
                                                                                </View>
                                                                            ))}
                                                                        </View>
                                                                    ))}
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>

                {/* 🖥️ Panel lateral - solo visible en pantallas grandes con feedback seleccionado */}
                {isLargeScreen && selectedFeedback && (
                    <View style={styles.splitViewPanel}>
                        <MediaFeedbackResponseModal
                            visible={true}
                            onClose={() => {
                                setVideoModalVisible(false);
                                setSelectedFeedback(null);
                            }}
                            feedback={selectedFeedback}
                            onResponseSent={handleVideoResponseSent}
                            isInline={true}
                        />
                    </View>
                )}
            </View>


            {/* ═══ KPI SELECTOR MODAL ═══ */}
            <Modal
                visible={kpiModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setKpiModalVisible(false)}
            >
                <Pressable
                    style={styles.kpiModalOverlay}
                    onPress={() => setKpiModalVisible(false)}
                >
                    <View style={styles.kpiModalContent}>
                        <View style={styles.kpiModalHeader}>
                            <Text style={styles.kpiModalTitle}>📊 Seleccionar KPI</Text>
                            <Pressable onPress={() => setKpiModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </Pressable>
                        </View>
                        <FlatList
                            data={KPI_OPTIONS}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={[
                                        styles.kpiModalItem,
                                        selectedKpi === item.id && styles.kpiModalItemActive
                                    ]}
                                    onPress={() => {
                                        setSelectedKpi(item.id);
                                        setKpiModalVisible(false);
                                    }}
                                >
                                    <Text style={styles.kpiModalItemIcon}>{item.icon}</Text>
                                    <View style={styles.kpiModalItemText}>
                                        <Text style={[
                                            styles.kpiModalItemName,
                                            selectedKpi === item.id && styles.kpiModalItemNameActive
                                        ]}>
                                            {item.name}
                                        </Text>
                                        <Text style={styles.kpiModalItemDesc}>{item.description}</Text>
                                    </View>
                                    {selectedKpi === item.id && (
                                        <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
                                    )}
                                </Pressable>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>

            {/* ═══ ANDROID MUSCLE PICKER MODAL ═══ */}
            <Modal
                visible={androidMusculoModal}
                transparent
                animationType="slide"
                onRequestClose={() => setAndroidMusculoModal(false)}
            >
                <Pressable
                    style={styles.kpiModalOverlay}
                    onPress={() => setAndroidMusculoModal(false)}
                >
                    <View style={styles.kpiModalContent}>
                        <View style={styles.kpiModalHeader}>
                            <Text style={styles.kpiModalTitle}>💪 Seleccionar Músculo</Text>
                            <Pressable onPress={() => setAndroidMusculoModal(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </Pressable>
                        </View>
                        <FlatList
                            data={listaMusculos}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={[
                                        styles.androidPickerItem,
                                        selMusculo === item && styles.androidPickerItemActive
                                    ]}
                                    onPress={() => {
                                        handleMusculoChange(item);
                                        setAndroidMusculoModal(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.androidPickerItemText,
                                        selMusculo === item && styles.androidPickerItemTextActive
                                    ]}>
                                        {item === 'TOTAL' ? 'Todos' : item}
                                    </Text>
                                    {selMusculo === item && (
                                        <Ionicons name="checkmark-circle" size={22} color="#3b82f6" />
                                    )}
                                </Pressable>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>

            {/* ═══ ANDROID EXERCISE PICKER MODAL ═══ */}
            <Modal
                visible={androidEjercicioModal}
                transparent
                animationType="slide"
                onRequestClose={() => setAndroidEjercicioModal(false)}
            >
                <Pressable
                    style={styles.kpiModalOverlay}
                    onPress={() => setAndroidEjercicioModal(false)}
                >
                    <View style={styles.kpiModalContent}>
                        <View style={styles.kpiModalHeader}>
                            <Text style={styles.kpiModalTitle}>🏋️ Seleccionar Ejercicio</Text>
                            <Pressable onPress={() => setAndroidEjercicioModal(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </Pressable>
                        </View>
                        <FlatList
                            data={['', ...listaEjercicios]}
                            keyExtractor={(item, index) => item || `todos-${index}`}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={[
                                        styles.androidPickerItem,
                                        selEjercicio === item && styles.androidPickerItemActive
                                    ]}
                                    onPress={() => {
                                        setSelEjercicio(item);
                                        setAndroidEjercicioModal(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.androidPickerItemText,
                                        selEjercicio === item && styles.androidPickerItemTextActive
                                    ]}>
                                        {item || 'Todos'}
                                    </Text>
                                    {selEjercicio === item && (
                                        <Ionicons name="checkmark-circle" size={22} color="#3b82f6" />
                                    )}
                                </Pressable>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>

            {/* Modal de Nota del Cliente */}
            <Modal visible={noteModal.visible} transparent animationType="fade" onRequestClose={() => setNoteModal({ visible: false, note: null })}>
                <View style={styles.noteModalOverlay}>
                    <View style={styles.noteModalCard}>
                        <View style={styles.noteModalHeader}>
                            <View style={[styles.noteModalBadge, { backgroundColor: NOTE_COLORS[noteModal.note?.value] || '#6b7280' }]}>
                                <Text style={styles.noteModalBadgeText}>
                                    {noteModal.note?.value === 'high' ? '🔴 Alta' :
                                        noteModal.note?.value === 'normal' ? '🟠 Media' :
                                            noteModal.note?.value === 'low' ? '🟢 Ok' : '🔵 Nota'}
                                </Text>
                            </View>
                            <Pressable onPress={() => setNoteModal({ visible: false, note: null })}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </Pressable>
                        </View>
                        <Text style={styles.noteModalLabel}>Nota del cliente:</Text>
                        <Text style={styles.noteModalText}>{noteModal.note?.note || 'Sin texto'}</Text>
                    </View>
                </View>
            </Modal>


            {/* 📹 Modal overlay - solo en pantallas pequeñas */}
            {!isLargeScreen && (
                <MediaFeedbackResponseModal
                    visible={videoModalVisible}
                    onClose={() => {
                        setVideoModalVisible(false);
                        setSelectedFeedback(null);
                    }}
                    feedback={selectedFeedback}
                    onResponseSent={handleVideoResponseSent}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#64748b',
    },
    tendenciaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
    },
    tendenciaText: {
        fontSize: 13,
        fontWeight: '700',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // === FILTROS CON SELECTORES ESTILIZADOS ===
    filtersCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    filterGroup: {
        marginBottom: 12,
    },
    filterLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    filterLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    selectWrapper: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        position: 'relative',
    },
    picker: {
        height: 50,
        color: '#1e293b',
        paddingRight: 40,
    },
    selectIcon: {
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: [{ translateY: -9 }],
        pointerEvents: 'none',
    },
    activeFilterBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        marginTop: 4,
        gap: 10,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    activeFilterText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#3b82f6',
        flex: 1,
    },
    clearFilterBtn: {
        padding: 4,
    },

    // Selector temporalidad
    selectorContainer: {
        flexDirection: 'row',
        backgroundColor: '#e2e8f0',
        borderRadius: 10,
        padding: 4,
        marginBottom: 20,
    },
    selectorButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    selectorActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    selectorText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    selectorTextActive: {
        color: '#1e293b',
    },

    // Gráfico
    chartContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 12,
    },
    chart: {
        borderRadius: 12,
        marginTop: 8,
    },

    // Sin datos
    noDataContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 32,
        marginBottom: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    noDataText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 12,
    },

    // Tabla
    tableContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: 10,
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        marginBottom: 8,
    },
    tableHeaderCell: {
        flex: 1,
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        alignItems: 'center',
    },
    tableCell: {
        flex: 1,
        fontSize: 13,
        color: '#1e293b',
        textAlign: 'center',
    },
    tableCellPeriodo: {
        fontWeight: '600',
        textAlign: 'left',
    },
    tableCellValue: {
        flex: 1,
        alignItems: 'center',
    },
    tableValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    cambioTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        marginTop: 4,
        gap: 2,
    },
    cambioText: {
        fontSize: 10,
        fontWeight: '600',
    },
    cambioSmall: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },

    // Totales
    totalesContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    totalesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    totalItem: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#f8fafc',
        padding: 14,
        borderRadius: 12,
    },
    totalLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },

    // === TOGGLE GRÁFICA / TABLA ===
    viewModeContainer: {
        flexDirection: 'row',
        backgroundColor: '#e2e8f0',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    viewModeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
    },
    viewModeBtnActive: {
        backgroundColor: '#3b82f6',
        shadowColor: '#3b82f6',
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    viewModeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    viewModeTextActive: {
        color: '#fff',
    },

    // === TABLA DETALLADA ===
    detailedTableContainer: {
        marginBottom: 16,
    },
    exerciseCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    exerciseHeader: {
        marginBottom: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    exerciseMuscle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#3b82f6',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    exerciseName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        marginTop: 2,
    },
    sessionCarousel: {
        flexDirection: 'row',
    },
    sessionColumn: {
        minWidth: 70,
        marginRight: 8,
        padding: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
    },
    sessionDate: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 8,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    setRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 4,
    },
    setCell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    setCellValue: {
        fontSize: 13,
        fontWeight: '700',
    },
    setCellValueWeight: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    noteDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    noteDotEmpty: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: 'transparent',
    },

    // === MODAL DE NOTAS ===
    noteModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    noteModalCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 320,
    },
    noteModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    noteModalBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    noteModalBadgeText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    noteModalLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 8,
    },
    noteModalText: {
        fontSize: 15,
        color: '#1e293b',
        lineHeight: 22,
    },

    // === SESSION ACCORDION STYLES ===
    sessionCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#f8fafc',
    },
    sessionHeaderLeft: {
        flex: 1,
    },
    sessionDateHeader: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        textTransform: 'capitalize',
    },
    sessionDayLabel: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    sessionHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sessionExCount: {
        fontSize: 12,
        color: '#64748b',
    },
    sessionContent: {
        padding: 12,
        paddingTop: 8,
    },
    exerciseRow: {
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    exerciseInfo: {
        marginBottom: 8,
    },
    exerciseMuscleSmall: {
        fontSize: 9,
        fontWeight: '700',
        color: '#3b82f6',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    exerciseNameSmall: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    setsContainer: {
        gap: 6,
    },
    setRowNew: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        gap: 12,
    },
    setNumber: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94a3b8',
        width: 20,
    },
    setCellNew: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    setCellValueNew: {
        fontSize: 14,
        fontWeight: '700',
    },
    setCellWeightNew: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },
    noteDotNew: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginLeft: 'auto',
    },
    noteDotEmptyNew: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        backgroundColor: 'transparent',
        marginLeft: 'auto',
    },

    // === ROUTINE SECTION STYLES ===
    routineSection: {
        marginBottom: 20,
    },
    routineSectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 12,
    },
    routineCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#3b82f6',
        overflow: 'hidden',
        shadowColor: '#3b82f6',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    routineHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#eff6ff',
    },
    routineHeaderLeft: {
        flex: 1,
    },
    routineName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e40af',
    },
    routineDate: {
        fontSize: 11,
        color: '#3b82f6',
        marginTop: 2,
    },
    routineContent: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    routineCardOld: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 10,
        overflow: 'hidden',
    },
    routineHeaderOld: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#f8fafc',
    },
    routineNameOld: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    routineDateOld: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 2,
    },

    // === DAY ACCORDION STYLES ===
    dayCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    dayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#f1f5f9',
    },
    dayHeaderLeft: {
        flex: 1,
    },
    dayLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    dayRoutine: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    dayHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dayStats: {
        fontSize: 11,
        color: '#64748b',
    },
    dayContent: {
        padding: 12,
    },
    exerciseBlock: {
        marginBottom: 16,
    },
    exerciseBlockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    exerciseMuscleTag: {
        fontSize: 9,
        fontWeight: '700',
        color: '#fff',
        backgroundColor: '#3b82f6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        textTransform: 'uppercase',
    },
    exerciseBlockName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
        flex: 1,
    },
    sessionsCarousel: {
        flexDirection: 'row',
    },
    sessionBox: {
        minWidth: 100,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    sessionsCarouselContent: {
        paddingRight: 16,
    },
    sessionBoxHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 8,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    sessionBoxNum: {
        fontSize: 12,
        fontWeight: '800',
        color: '#3b82f6',
    },
    sessionBoxDate: {
        fontSize: 10,
        fontWeight: '500',
        color: '#64748b',
    },
    setHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 4,
        marginBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    setHeaderCell: {
        width: 24, // S column
        fontSize: 9,
        fontWeight: '700',
        color: '#94a3b8',
        textAlign: 'center',
    },
    setHeaderCellData: {
        width: 42, // Rep/Kg columns - matches setColData
        fontSize: 9,
        fontWeight: '700',
        color: '#94a3b8',
        textAlign: 'left',
        paddingLeft: 4,
    },
    setHeaderCellNote: {
        width: 24,
        fontSize: 9,
        textAlign: 'center',
    },
    setTableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    setColNum: {
        width: 24,
        fontSize: 11,
        fontWeight: '700',
        color: '#94a3b8',
        textAlign: 'center',
    },
    setColData: {
        width: 42, // Ancho fijo que reserva espacio para número + flecha
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingLeft: 4,
    },
    setColReps: {
        fontSize: 13,
        fontWeight: '700',
    },
    setColKg: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
    },
    setColNoteBtn: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginLeft: 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    setColNoteBtnEmpty: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // KPI 2.0 STYLES
    // ═══════════════════════════════════════════════════════════════════════════

    // KPI Cards
    kpiCardsContainer: {
        marginBottom: 16,
        paddingLeft: 4,
    },
    kpiCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginRight: 12,
        minWidth: 100,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    kpiCardIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    kpiCardValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1e293b',
    },
    kpiCardLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 2,
    },

    // Period Filter
    periodFilter: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    periodBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    periodBtnActive: {
        backgroundColor: '#3b82f6',
    },
    periodBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    periodBtnTextActive: {
        color: '#fff',
    },

    // Horizontal scrollable chart
    horizontalChartScroll: {
        marginHorizontal: -16,
        paddingHorizontal: 16,
    },

    // Chart Header & Summary
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    chartSummary: {
        alignItems: 'flex-end',
    },
    chartSummaryValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#3b82f6',
    },
    chartSummaryLabel: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    chartDescription: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 12,
        paddingHorizontal: 16,
        fontStyle: 'italic',
    },
    chartSubInfo: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 8,
        fontWeight: '500',
    },

    // KPI Filters
    kpiFilters: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    kpiFilterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    kpiFilterLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
        width: 70,
    },
    kpiFilterPicker: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        height: 40,
        justifyContent: 'center',
    },
    kpiPickerStyle: {
        height: 40,
    },
    // iOS ActionSheet button styles
    iosPickerButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 40,
    },
    iosPickerText: {
        fontSize: 14,
        color: '#1e293b',
    },

    // Android Picker Modal Items
    androidPickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    androidPickerItemActive: {
        backgroundColor: '#eff6ff',
    },
    androidPickerItemText: {
        fontSize: 15,
        color: '#334155',
    },
    androidPickerItemTextActive: {
        color: '#3b82f6',
        fontWeight: '600',
    },

    // KPI Selector - Estilo de botón más visible
    kpiSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f0f9ff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#3b82f6',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    kpiSelectorLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    kpiSelectorIconWrap: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    kpiSelectorIcon: {
        fontSize: 24,
    },
    kpiSelectorTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e40af',
    },
    kpiSelectorDesc: {
        fontSize: 11,
        color: '#3b82f6',
        marginTop: 2,
    },
    kpiSelectorChevron: {
        backgroundColor: '#3b82f6',
        borderRadius: 20,
        padding: 8,
    },

    // KPI Modal
    kpiModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    kpiModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '70%',
        paddingBottom: 32,
    },
    kpiModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    kpiModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    kpiModalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 12,
    },
    kpiModalItemActive: {
        backgroundColor: '#eff6ff',
    },
    kpiModalItemIcon: {
        fontSize: 28,
    },
    kpiModalItemText: {
        flex: 1,
    },
    kpiModalItemName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    kpiModalItemNameActive: {
        color: '#3b82f6',
    },
    kpiModalItemDesc: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },

    // Donut Chart (Volumen Útil)
    donutContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        paddingVertical: 24,
    },
    donutCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 16,
        borderColor: '#10b981',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0fdf4',
    },
    donutValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#10b981',
    },
    donutLabel: {
        fontSize: 12,
        color: '#64748b',
    },
    donutLegend: {
        gap: 12,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    legendText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },

    // Muscle Balance Legend
    muscleBalanceLegend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        marginTop: 12,
    },
    muscleBalanceItem: {
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    muscleBalanceShare: {
        fontSize: 16,
        fontWeight: '700',
        color: '#3b82f6',
    },
    muscleBalanceName: {
        fontSize: 11,
        color: '#64748b',
    },

    // PR Count
    prTotal: {
        textAlign: 'center',
        fontSize: 14,
        color: '#64748b',
        marginTop: 8,
    },

    // 🆕 RPE Bar Chart Styles (Blue Energy)
    rpeStreakBadge: {
        backgroundColor: '#dbeafe',
        borderWidth: 1,
        borderColor: '#3b82f6',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 8,
        alignSelf: 'center',
        marginBottom: 12,
    },
    rpeStreakText: {
        color: '#2563eb',
        fontSize: 13,
        fontWeight: '700',
    },
    rpeBarContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 16,
        height: 160,
        gap: 10,
    },
    rpeBarWrapper: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: 40,
    },
    rpeBar: {
        width: 28,
        borderRadius: 6,
        minHeight: 20,
    },
    rpeNoteDot: {
        position: 'absolute',
        top: -4,
        right: 2,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#3b82f6',
    },
    rpeBarLabel: {
        fontSize: 9,
        color: '#64748b',
        marginTop: 6,
    },
    rpeBarValue: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
    rpeSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 32,
        marginTop: 12,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
    },
    rpeSummaryItem: {
        alignItems: 'center',
    },
    rpeSummaryLabel: {
        fontSize: 11,
        color: '#64748b',
        marginBottom: 4,
    },
    rpeSummaryValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },

    // 🆕 RPE MOOD CARDS (Comments Priority Section)
    rpeCommentsSection: {
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    rpeCommentsSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    rpeCommentsSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    rpeCommentsBadge: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    rpeCommentsBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    rpeMoodCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 10,
        flexDirection: 'row',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    rpeMoodCardBestia: {
        backgroundColor: '#eff6ff', // Light blue tint
        borderWidth: 1,
        borderColor: '#3b82f6',
        shadowColor: '#3b82f6',
        shadowOpacity: 0.2,
        elevation: 3,
    },
    rpeMoodCardNe: {
        opacity: 0.7,
        backgroundColor: '#f8fafc',
    },
    rpeMoodCardBorder: {
        width: 5,
    },
    rpeMoodCardContent: {
        flex: 1,
        padding: 12,
    },
    rpeMoodCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    rpeMoodCardLeft: {
        flex: 1,
    },
    rpeMoodCardLevel: {
        fontSize: 16,
        fontWeight: '700',
    },
    rpeMoodCardDate: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    rpeMoodCardRing: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 3,
        backgroundColor: '#f1f5f9',
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    rpeMoodCardRingFill: {
        width: '100%',
    },
    rpeMoodCardRoutine: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    rpeMoodCardNote: {
        fontSize: 13,
        color: '#475569',
        fontStyle: 'italic',
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 💬 COMENTARIOS VIEW STYLES
    // ═══════════════════════════════════════════════════════════════════════════
    commentsContainer: {
        marginBottom: 16,
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
    },
    commentsRoutineSection: {
        marginBottom: 20,
    },
    commentsRoutineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    commentsRoutineLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    commentsBadge: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    commentsBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },
    commentsRoutineName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#3b82f6',
        marginBottom: 16,
    },
    commentsWeekGroup: {
        marginBottom: 20,
    },
    commentsWeekHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    commentsWeekHeaderPressable: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
    },
    commentsWeekRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    commentsWeekCount: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    // 🆕 RPE Badge in Week Header
    commentsWeekRpeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
    },
    commentsWeekRpeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    commentsWeekBadge: {
        backgroundColor: '#6366f1',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    commentsWeekBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    commentsDaySection: {
        marginBottom: 12,
        paddingLeft: 10,
        borderLeftWidth: 2,
        borderLeftColor: '#e2e8f0',
    },
    commentsDayHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
    },
    // 🆕 RPE in Day Header
    commentsDayHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 8,
    },
    commentsDayRpeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
    },
    commentsDayRpeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    commentsDayRpeBadgeSmall: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
    },
    commentsDayRpeTextSmall: {
        fontSize: 10,
        fontWeight: '700',
    },
    commentsDaySessionNote: {
        backgroundColor: '#f0f9ff',
        borderLeftWidth: 3,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginBottom: 10,
    },
    commentsDaySessionNoteText: {
        fontSize: 12,
        color: '#475569',
        fontStyle: 'italic',
    },
    commentsExerciseBlock: {
        marginBottom: 12,
    },
    commentsExerciseHeader: {
        marginBottom: 8,
    },
    commentsExerciseMuscle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#3b82f6',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    commentsExerciseName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        marginTop: 2,
    },
    // Compact exercise styles
    commentsExerciseBlockCompact: {
        marginBottom: 8,
    },
    commentsExerciseLineCompact: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 6,
    },
    commentsExerciseMuscleInline: {
        fontSize: 11,
        fontWeight: '700',
        color: '#3b82f6',
        textTransform: 'uppercase',
    },
    commentCardCompact: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    commentCardCompactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    commentSemaphoreCompact: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    commentSetLabelCompact: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
    },
    commentDataCompact: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    commentPainIconCompact: {
        fontSize: 12,
    },
    commentTextCompact: {
        fontSize: 12,
        color: '#374151',
        fontStyle: 'italic',
        lineHeight: 16,
    },
    commentCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    commentCardWarning: {
        borderColor: '#fecaca',
        borderWidth: 2,
        backgroundColor: '#fef2f2',
    },
    commentCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    commentSetInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    commentSetLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    commentDataBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    commentDataText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    commentIndicators: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    commentPainBadge: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    commentPainIcon: {
        fontSize: 16,
    },
    commentSemaphore: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    commentText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
        fontStyle: 'italic',
    },

    // Old Routines (collapsed style)
    commentsOldSection: {
        marginTop: 16,
    },
    commentsOldLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 12,
    },
    commentsOldRoutine: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
    },
    commentsOldRoutineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
    },
    commentsOldRoutineInfo: {
        flex: 1,
    },
    commentsOldRoutineName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    commentsOldRoutineDate: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    commentsOldRoutineRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    commentsBadgeSmall: {
        backgroundColor: '#94a3b8',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    commentsBadgeSmallText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    commentsOldRoutineContent: {
        padding: 14,
        paddingTop: 0,
    },
    commentsWeekGroupSmall: {
        marginBottom: 12,
    },
    commentsWeekLabelSmall: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6366f1',
        marginBottom: 8,
    },
    commentsDayHeaderSmall: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 6,
    },
    commentsExerciseBlockSmall: {
        marginBottom: 8,
    },
    commentsExerciseNameSmall: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 4,
    },
    commentCardSmall: {
        flexDirection: 'column',
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    commentCardSmallLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    commentSetLabelSmall: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
    },
    commentDataSmall: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    commentSemaphoreSmall: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    commentTextSmall: {
        fontSize: 12,
        color: '#374151',
        fontStyle: 'italic',
    },
    noDataSubtext: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
    },
    // ═══════════════════════════════════════════════════════════════════════════
    // VIDEO FEEDBACK STYLES
    // ═══════════════════════════════════════════════════════════════════════════
    videoBadge: {
        backgroundColor: '#ef4444',
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 6,
    },
    videoBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    // === INLINE VIDEO BUTTON ===
    commentCardWithVideo: {
        borderLeftWidth: 3,
        borderLeftColor: '#4361ee',
    },
    inlineVideoBtn: {
        marginLeft: 'auto',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#4361ee',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    inlineVideoBtnPending: {
        backgroundColor: '#4361ee',
        borderColor: '#4361ee',
    },
    inlineVideoPendingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#fbbf24',
    },
    inlineReplyBtn: {
        marginLeft: 'auto',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#e0e7ff',
        flexDirection: 'row',
        alignItems: 'center',
    },
    audioRowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    inlineVideoNote: {
        fontSize: 11,
        color: '#4361ee',
        marginTop: 4,
        fontStyle: 'italic',
    },
    videoGrid: {
        gap: 12,
        paddingVertical: 8,
    },
    videoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    videoCardResponded: {
        backgroundColor: '#f0fdf4',
        borderColor: '#10b98130',
    },
    videoThumb: {
        width: 50,
        height: 50,
        borderRadius: 10,
        backgroundColor: '#4361ee15',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    pendingBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
        borderWidth: 2,
        borderColor: '#fff',
    },
    videoCardInfo: {
        flex: 1,
    },
    videoExerciseName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    videoMeta: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    videoNote: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
        marginTop: 4,
    },
    // 🖥️ Split View Styles for Large Screens
    splitViewWrapper: {
        flex: 1,
    },
    splitViewWrapperActive: {
        flexDirection: 'row',
    },
    contentWithPanel: {
        flex: 1,
        maxWidth: 'calc(100% - 420px)',
    },
    splitViewPanel: {
        width: 420,
        backgroundColor: '#0a0a14',
        borderLeftWidth: 1,
        borderLeftColor: '#1e293b',
    },
});

