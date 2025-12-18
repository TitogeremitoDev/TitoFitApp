/* app/evolucion.jsx
   ────────────────────────────────────────────────────────────────────────
   Dashboard de Evolución MEJORADO:
   - Premium: carga datos desde la nube (MongoDB)
   - FreeUser: sigue usando AsyncStorage local
   - Muestra totales acumulados (reps, peso, trabajo)
   - Sistema de medallas/emojis según progreso 🏆
   ──────────────────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Pressable,
  Alert,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

// KPI Utilities (mismo sistema que coach progress)
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
} from '../../../src/utils/calculateKPIs';

// ═══════════════════════════════════════════════════════════════════════════
// SISTEMA DE MEDALLAS / EMOJIS
// ═══════════════════════════════════════════════════════════════════════════

const MEDALLAS_REPS = [
  { min: 0, max: 2000, emoji: '🪵', nombre: 'Madera', next: 'Hierro (2K+ reps)' },
  { min: 2001, max: 10000, emoji: '🔩', nombre: 'Hierro', next: 'Bronce (10K+ reps)' },
  { min: 10001, max: 25000, emoji: '🥉', nombre: 'Bronce', next: 'Plata (25K+ reps)' },
  { min: 25001, max: 50000, emoji: '🥈', nombre: 'Plata', next: 'Oro (50K+ reps)' },
  { min: 50001, max: 100000, emoji: '🥇', nombre: 'Oro', next: 'Diamante (100K+ reps)' },
  { min: 100001, max: Infinity, emoji: '💎', nombre: 'Diamante', next: '¡MÁXIMO NIVEL!' },
];

const MEDALLAS_PESO = [
  { min: 0, max: 2000, emoji: '🐱', nombre: 'Gato', next: 'Perro (2K+ kg)' },
  { min: 2001, max: 10000, emoji: '🐕', nombre: 'Perro', next: 'León (10K+ kg)' },
  { min: 10001, max: 30000, emoji: '🦁', nombre: 'León', next: 'Tigre (30K+ kg)' },
  { min: 30001, max: 60000, emoji: '🐅', nombre: 'Tigre', next: 'Oso (60K+ kg)' },
  { min: 60001, max: 100000, emoji: '🐻', nombre: 'Oso', next: 'Rinoceronte (100K+ kg)' },
  { min: 100001, max: 200000, emoji: '🦏', nombre: 'Rinoceronte', next: 'Elefante (200K+ kg)' },
  { min: 200001, max: Infinity, emoji: '🐘', nombre: 'Elefante', next: '¡MÁXIMO NIVEL!' },
];

const MEDALLAS_TRABAJO = [
  { min: 0, max: 20000, emoji: '💡', nombre: 'Bombilla', next: 'Patines (20K+ vol)' },
  { min: 20001, max: 100000, emoji: '🛼', nombre: 'Patines', next: 'Bici (100K+ vol)' },
  { min: 100001, max: 300000, emoji: '🚲', nombre: 'Bici', next: 'Moto (300K+ vol)' },
  { min: 300001, max: 1000000, emoji: '🏍️', nombre: 'Moto', next: 'Coche (1M+ vol)' },
  { min: 1000001, max: Infinity, emoji: '🚗', nombre: 'Coche', next: '¡MÁXIMO NIVEL!' },
];

function getMedalla(valor, medallas) {
  for (const m of medallas) {
    if (valor >= m.min && valor <= m.max) return m;
  }
  return medallas[0];
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString('es-ES');
}


const MAX_WEEKS = 12;

// Métricas que podemos calcular
const METRICAS = [
  { label: 'Volumen (Reps * Carga)', value: 'volume' },
  { label: 'e1RM (Máx)', value: 'e1RM_max' },
  { label: 'Carga Promedio (ponderada)', value: 'load_avg' },
  { label: 'Reps Totales', value: 'reps' },
];

// Eje X que podemos elegir
const EJES_X = [
  { label: 'Por Fecha', value: 'date' },
  { label: 'Por Sesión', value: 'session' },
  { label: 'Por Semana', value: 'week' },
];

// Colores del gráfico
const chartConfig = {
  backgroundColor: '#111827',
  backgroundGradientFrom: '#0D1B2A',
  backgroundGradientTo: '#111827',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(209, 213, 219, ${opacity})`,
  propsForDots: { r: '5', strokeWidth: '2', stroke: '#3B82F6' },
  fillShadowGradient: '#3b82f6',
  fillShadowGradientOpacity: 0.3,
};

// BarChart config para KPIs
const barChartConfig = {
  backgroundColor: '#111827',
  backgroundGradientFrom: '#0D1B2A',
  backgroundGradientTo: '#111827',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(209, 213, 219, ${opacity})`,
  barPercentage: 0.65,
  fillShadowGradient: '#6366f1',
  fillShadowGradientOpacity: 1,
  propsForBackgroundLines: {
    strokeDasharray: '',
    stroke: '#1f2937',
    strokeWidth: 1,
  },
};

/* Helpers */
function normalizeDias(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((d) => (Array.isArray(d) ? d : []));
  if (typeof raw === 'object') {
    const keys = Object.keys(raw).sort((a, b) => {
      const na = parseInt(String(a).replace(/[^\d]/g, ''), 10) || 0;
      const nb = parseInt(String(b).replace(/[^\d]/g, ''), 10) || 0;
      return na - nb;
    });
    return keys.map((k) => (Array.isArray(raw[k]) ? raw[k] : []));
  }
  return [];
}
function getFiltros(log) {
  const musculos = new Map();
  log.forEach((entry) => {
    if (!entry.muscle || !entry.exercise) return;
    if (!musculos.has(entry.muscle)) musculos.set(entry.muscle, new Set());
    musculos.get(entry.muscle).add(entry.exercise);
  });
  const listaMusculos = Array.from(musculos.keys()).sort();
  const mapEjercicios = new Map();
  musculos.forEach((ejSet, mus) => mapEjercicios.set(mus, Array.from(ejSet).sort()));
  return { listaMusculos, mapEjercicios };
}
function agregarDatosParaGrafico(logFiltrado, metrica, ejeX) {
  const grupos = new Map();
  logFiltrado.forEach((entry) => {
    let clave;
    const entryDate = new Date(entry.date);
    entry._sortDate = entryDate;
    if (ejeX === 'date') clave = entry.date.split('T')[0];
    else if (ejeX === 'week') clave = entry.week ? Number(entry.week) : 0;
    else clave = `${entry.routineName} | ${entry.date.split('T')[0]}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(entry);
  });

  const dataPuntos = [];
  grupos.forEach((entries, clave) => {
    let valorMetrica = 0;
    const repsTotales = entries.reduce((acc, e) => acc + (e.reps || 0), 0);
    const volTotal = entries.reduce((acc, e) => acc + (e.volume || 0), 0);
    switch (metrica) {
      case 'volume': valorMetrica = volTotal; break;
      case 'e1RM_max': valorMetrica = Math.max(0, ...entries.map((e) => e.e1RM || 0)); break;
      case 'load_avg':
        const cargaPond = entries.reduce((acc, e) => acc + ((e.load || 0) * (e.reps || 0)), 0);
        valorMetrica = repsTotales > 0 ? cargaPond / repsTotales : 0; break;
      case 'reps': valorMetrica = repsTotales; break;
    }
    const sortDate = entries[0]._sortDate || new Date();
    dataPuntos.push({ clave, valor: valorMetrica, fechaSort: sortDate });
  });

  dataPuntos.sort((a, b) => a.fechaSort - b.fechaSort);

  let labels = [];
  const data = dataPuntos.map(p => p.valor);
  if (data.length === 0) return null;

  if (ejeX === 'date') {
    labels = dataPuntos.map(p =>
      p.fechaSort.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
    );
  } else if (ejeX === 'week') {
    const wk = dataPuntos.map(p => `S${p.clave}`);
    labels = wk.length > 7 ? wk.map(l => l.replace('Semana ', 'S')) : wk;
  } else {
    labels = dataPuntos.map((_, i) => String(i + 1));
  }

  if (data.length === 1) {
    const single = labels[0];
    const v = data[0];
    return {
      labels: [single, single],
      datasets: [{ data: [v, v], color: (op = 1) => `rgba(59,130,246,${op})`, strokeWidth: 3 }],
    };
  }
  return {
    labels,
    datasets: [{ data, color: (op = 1) => `rgba(59,130,246,${op})`, strokeWidth: 3 }],
  };
}

/* ───────── Componente ───────── */
export default function EvolucionScreen() {
  const router = useRouter();
  const { user, token } = useAuth();

  // 📐 Responsive: usar ancho de ventana dinámico
  const { width: windowWidth } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isLargeScreen = windowWidth > 768;
  const isSmallScreen = windowWidth < 400;

  // Ancho del contenido: 90% en web grande, 100% en móvil
  const contentWidth = isWeb && isLargeScreen
    ? Math.min(windowWidth * 0.9, 1200) // Max 1200px en web
    : windowWidth;

  // Ancho de los gráficos - menos padding en pantallas pequeñas
  const chartPadding = isSmallScreen ? 16 : 32;
  const chartWidth = contentWidth - chartPadding;

  const [log, setLog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selMusculo, setSelMusculo] = useState('');
  const [selEjercicio, setSelEjercicio] = useState('');
  const [selMetrica, setSelMetrica] = useState(METRICAS[0].value);
  const [selEjeX, setSelEjeX] = useState(EJES_X[0].value);
  const [isBulking, setIsBulking] = useState(false);
  const [dataSource, setDataSource] = useState('local'); // 'local' o 'cloud'

  // 📊 KPI System 2.0 (igual que coach progress)
  const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'table'
  const [selectedKpi, setSelectedKpi] = useState('volume');
  const [kpiModalVisible, setKpiModalVisible] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selKpiMusculo, setSelKpiMusculo] = useState('TOTAL');
  const [selKpiEjercicio, setSelKpiEjercicio] = useState('');

  // Modales para filtros (iOS compatible)
  const [muscleModalVisible, setMuscleModalVisible] = useState(false);
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);

  // Estado para tabla expandible por rutina (current expandido por defecto)
  const [expandedRoutines, setExpandedRoutines] = useState({ current: true });

  // Modal para ver notas
  const [noteModal, setNoteModal] = useState({ visible: false, note: null });

  // Colores de prioridad de notas
  const NOTE_COLORS = {
    high: '#ef4444',    // Rojo
    normal: '#f97316',  // Naranja
    low: '#22c55e',     // Verde
    custom: '#3b82f6',  // Azul
  };

  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

  // Determinar si el usuario es premium
  const isPremium = useMemo(() => {
    if (!user) return false;
    return ['PREMIUM', 'CLIENTE', 'ENTRENADOR', 'ADMINISTRADOR'].includes(user.tipoUsuario);
  }, [user]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFORMAR WORKOUTS DE MONGODB A FORMATO GLOBAL_LOG
  // ═══════════════════════════════════════════════════════════════════════════
  const transformarWorkoutsALog = useCallback((workouts) => {
    const logEntries = [];

    if (!Array.isArray(workouts)) return logEntries;

    workouts.forEach((workout) => {
      const fecha = workout.date || new Date().toISOString();
      const nombreRutina = workout.routineNameSnapshot || 'Entreno';
      const semana = workout.week || 1;

      (workout.exercises || []).forEach((ejercicio) => {
        const musculo = ejercicio.muscleGroup || 'SIN GRUPO';
        const nombreEjercicio = ejercicio.exerciseName || 'Ejercicio';

        (ejercicio.sets || []).forEach((set, setIdx) => {
          const reps = Number(set.actualReps) || 0;
          const load = Number(set.weight) || 0;

          if (reps > 0 || load > 0) {
            const volume = reps * load;
            const e1RM = reps > 0 && load > 0 ? load * (1 + reps / 30) : 0;

            logEntries.push({
              id: `${workout._id}-${ejercicio.exerciseId || ejercicio.exerciseName}-${setIdx}`,
              date: fecha,
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

    return logEntries;
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // CARGAR DATOS (DESDE NUBE O LOCAL SEGÚN TIPO DE USUARIO)
  // ═══════════════════════════════════════════════════════════════════════════

  // Estado para almacenar workouts de la API directamente (para KPIs)
  const [cloudWorkouts, setCloudWorkouts] = useState([]);

  const cargarLog = useCallback(async () => {
    setIsRefreshing(true);
    try {
      let logData = [];

      // Premium: cargar desde la nube
      if (isPremium && token) {
        try {

          const response = await fetch(`${API_URL}/api/workouts?limit=500`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.workouts)) {
              // Guardar los workouts originales directamente (para KPIs)
              setCloudWorkouts(data.workouts);


              // También transformar a log para totales y compatibilidad
              logData = transformarWorkoutsALog(data.workouts);
              setDataSource('cloud');
            }
          } else {
            console.warn('[Evolucion] Error API, usando local');
            const logJson = await AsyncStorage.getItem('GLOBAL_LOG');
            logData = logJson ? JSON.parse(logJson) : [];
            setCloudWorkouts([]);
            setDataSource('local');
          }
        } catch (apiError) {
          console.warn('[Evolucion] Error API:', apiError);
          const logJson = await AsyncStorage.getItem('GLOBAL_LOG');
          logData = logJson ? JSON.parse(logJson) : [];
          setCloudWorkouts([]);
          setDataSource('local');
        }
      } else {
        // FREEUSER: cargar desde AsyncStorage local

        const logJson = await AsyncStorage.getItem('GLOBAL_LOG');
        logData = logJson ? JSON.parse(logJson) : [];

        if (logData.length > 0) {

        }
        setCloudWorkouts([]);
        setDataSource('local');
      }

      setLog(logData);
    } catch (e) {
      console.warn('Error cargando historial', e);
      Alert.alert('Error', 'No se pudo cargar el historial.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isPremium, token, API_URL, transformarWorkoutsALog]);

  useEffect(() => { cargarLog(); }, [cargarLog]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CÁLCULO DE TOTALES GLOBALES
  // ═══════════════════════════════════════════════════════════════════════════
  const totales = useMemo(() => {
    let totalReps = 0;
    let totalPeso = 0;
    let totalTrabajo = 0;

    log.forEach((entry) => {
      totalReps += Number(entry.reps) || 0;
      totalPeso += Number(entry.load) || 0;
      totalTrabajo += Number(entry.volume) || 0;
    });

    return {
      reps: totalReps,
      peso: totalPeso,
      trabajo: totalTrabajo,
      medallaReps: getMedalla(totalReps, MEDALLAS_REPS),
      medallaPeso: getMedalla(totalPeso, MEDALLAS_PESO),
      medallaTrabajo: getMedalla(totalTrabajo, MEDALLAS_TRABAJO),
    };
  }, [log]);

  const { listaMusculos, mapEjercicios } = useMemo(() => getFiltros(log), [log]);
  const listaEjercicios = useMemo(() => {
    if (!selMusculo) return [];
    return mapEjercicios.get(selMusculo) || [];
  }, [selMusculo, mapEjercicios]);

  const datosGrafico = useMemo(() => {
    if (!selMusculo) return null;
    const logFiltrado = log.filter((e) =>
      e.muscle === selMusculo && (!selEjercicio || e.exercise === selEjercicio)
    );
    return agregarDatosParaGrafico(logFiltrado, selMetrica, selEjeX);
  }, [log, selMusculo, selEjercicio, selMetrica, selEjeX]);

  // ═══════════════════════════════════════════════════════════════════════════
  // KPI 2.0 CALCULATIONS - Usar cloudWorkouts directamente o reconstruir desde log
  // ═══════════════════════════════════════════════════════════════════════════
  const sessions = useMemo(() => {
    // Si tenemos cloudWorkouts (datos de la nube), ordenarlos y usarlos
    // Esto es exactamente como funciona coach/progress/[clientId].jsx
    if (cloudWorkouts.length > 0) {

      // Ordenar: primero por fecha descendente, luego por semana descendente
      const sorted = [...cloudWorkouts].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        const dayA = dateA.toISOString().split('T')[0];
        const dayB = dateB.toISOString().split('T')[0];
        if (dayA !== dayB) {
          return dayB.localeCompare(dayA);
        }
        return (b.week || 0) - (a.week || 0);
      });
      return sorted;
    }

    // Si no hay cloudWorkouts, reconstruir desde log (FREEUSER/local)

    const sessionMap = new Map();

    log.forEach(entry => {
      // Usar routineId + fecha + dayIndex + semana como clave para separar correctamente los días
      // Esto permite separar entrenamientos de diferentes rutinas y diferentes días
      const dateStr = entry.date?.split('T')[0] || 'unknown';
      const week = entry.week || 1;
      const dayIdx = entry.dayIndex ?? 0;
      // Incluir routineId o routineName para separar por rutina
      const routineKey = entry.routineId || entry.routineName || 'unknown';
      const sessionKey = `${routineKey}_${dateStr}_D${dayIdx}_W${week}`;

      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, {
          date: entry.date,
          week: week,
          dayIndex: dayIdx,
          dayLabel: entry.dayLabel || `Día ${dayIdx + 1}`,
          routineId: entry.routineId || entry.routineName || 'unknown',
          routineNameSnapshot: entry.routineName || 'Entreno',
          exercises: []
        });
      }

      const session = sessionMap.get(sessionKey);
      let exercise = session.exercises.find(e => e.exerciseName === entry.exercise);
      if (!exercise) {
        exercise = {
          exerciseName: entry.exercise,
          muscleGroup: entry.muscle,
          sets: []
        };
        session.exercises.push(exercise);
      }

      exercise.sets.push({
        actualReps: entry.reps || 0,
        weight: entry.load || 0,
        targetRepsMin: null,
        targetRepsMax: null
      });
    });

    // Ordenar: primero por fecha descendente, luego por semana descendente (a misma fecha)
    const result = Array.from(sessionMap.values());
    result.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      // Primero comparar fechas (solo día, sin hora)
      const dayA = dateA.toISOString().split('T')[0];
      const dayB = dateB.toISOString().split('T')[0];
      if (dayA !== dayB) {
        return dayB.localeCompare(dayA); // Descendente por fecha
      }
      // Si misma fecha, ordenar por semana descendente
      return (b.week || 0) - (a.week || 0);
    });

    return result;
  }, [cloudWorkouts, log]);

  // Lista de músculos para KPIs
  const listaMusculosKpi = useMemo(() => {
    const muscleSet = new Set(['TOTAL']);
    sessions.forEach(s => {
      s.exercises?.forEach(e => {
        if (e.muscleGroup) muscleSet.add(e.muscleGroup);
      });
    });
    return Array.from(muscleSet).sort();
  }, [sessions]);

  // Lista de ejercicios según músculo seleccionado (para KPIs)
  const listaEjerciciosKpi = useMemo(() => {
    if (selKpiMusculo === 'TOTAL') return [];
    const ejercSet = new Set();
    sessions.forEach(s => {
      s.exercises?.forEach(e => {
        if (e.muscleGroup === selKpiMusculo && e.exerciseName) {
          ejercSet.add(e.exerciseName);
        }
      });
    });
    return Array.from(ejercSet).sort();
  }, [sessions, selKpiMusculo]);

  // Sesiones filtradas por periodo
  const filteredSessions = useMemo(() => {
    return filterByPeriod(sessions, selectedPeriod);
  }, [sessions, selectedPeriod]);

  // KPI: Volumen (% mejora semanal)
  const volumeData = useMemo(() => {
    const data = calcVolumeByWeek(filteredSessions, selKpiMusculo, selKpiEjercicio);
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
  }, [filteredSessions, selKpiMusculo, selKpiEjercicio]);

  // KPI: Intensidad
  const intensityData = useMemo(() => {
    const data = calcIntensityByWeek(filteredSessions, selKpiMusculo, selKpiEjercicio);
    if (data.length === 0) return null;
    const lastValue = data[data.length - 1]?.value || 0;
    return {
      labels: data.map(d => d.label),
      datasets: [{ data: data.map(d => d.value), strokeWidth: 3 }],
      lastValue,
      lastAvgLoad: data[data.length - 1]?.avgLoad || 0
    };
  }, [filteredSessions, selKpiMusculo, selKpiEjercicio]);

  // KPI: Cumplimiento
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

  // KPI: Carga Alta
  const heavySetsData = useMemo(() => {
    const data = calcHeavySetsByWeek(filteredSessions, selKpiMusculo, selKpiEjercicio);
    if (data.length === 0) return null;
    const lastValue = data[data.length - 1]?.value || 0;
    const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length;
    return {
      labels: data.map(d => d.label),
      datasets: [{ data: data.map(d => d.value) }],
      lastValue,
      avgValue: avgValue.toFixed(0)
    };
  }, [filteredSessions, selKpiMusculo, selKpiEjercicio]);

  // KPI: Balance Muscular
  const muscleBalanceData = useMemo(() => {
    const data = calcMuscleBalance(filteredSessions);
    if (data.length === 0) return null;
    return {
      labels: data.map(d => d.muscle.substring(0, 4)),
      datasets: [{ data: data.map(d => d.share) }],
      fullData: data
    };
  }, [filteredSessions]);

  // KPI: PRs
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

  // KPI actual seleccionado
  const currentKpi = useMemo(() => {
    return KPI_OPTIONS.find(k => k.id === selectedKpi) || KPI_OPTIONS[0];
  }, [selectedKpi]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AGRUPAR DATOS POR RUTINA → DÍA (igual que coach/progress)
  // Estructura: Rutina → Días → Ejercicios → Sesiones S1/S2 con flechas
  // ═══════════════════════════════════════════════════════════════════════════

  // Helper para comparar tendencias
  const getRepStatus = (actual, min, max) => {
    if (!actual) return 'none';
    if (min && actual < min) return 'below';
    if (max && actual > max) return 'above';
    return 'inRange';
  };

  const getRepStatusColor = (status) => {
    switch (status) {
      case 'below': return '#ef4444';
      case 'above': return '#3b82f6';
      case 'inRange': return '#22c55e';
      default: return '#E5E7EB';
    }
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

  // Estado para expandir días
  const [expandedDays, setExpandedDays] = useState({});
  const [expandedExercises, setExpandedExercises] = useState({});

  const toggleDay = (routineName, dayIndex) => {
    const key = `${routineName}-${dayIndex}`;
    setExpandedDays(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleExercise = (routineName, dayIndex, exerciseName) => {
    const key = `${routineName}-${dayIndex}-${exerciseName}`;
    setExpandedExercises(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Toggle para expandir rutinas
  const toggleRoutine = (routineName) => {
    setExpandedRoutines(prev => ({
      ...prev,
      [routineName]: !prev[routineName]
    }));
  };

  // Handlers
  const handleKpiMusculoChange = (musculo) => {
    setSelKpiMusculo(musculo);
    setSelKpiEjercicio('');
  };

  const handleMusculoChange = (musculo) => { setSelMusculo(musculo); setSelEjercicio(''); };

  const handleClearDatabase = () => {
    if (dataSource === 'cloud') {
      Alert.alert('Datos en la nube', 'Los datos están guardados en la nube y no se pueden borrar desde aquí.');
      return;
    }
    Alert.alert(
      'Borrar Historial',
      '¿Seguro? No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar', style: 'destructive', onPress: async () => {
            await AsyncStorage.setItem('GLOBAL_LOG', '[]');
            setLog([]);
            setSelMusculo(''); setSelEjercicio('');
            Alert.alert('Historial borrado', 'El historial ha sido eliminado.');
          }
        },
      ]
    );
  };



  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Stack.Screen
          options={{
            title: 'Cargando...',
            headerTitleStyle: { color: '#E5E7EB' },
            headerStyle: { backgroundColor: '#0D1B2A' },
            headerTintColor: '#E5E7EB',
            headerLeft: () => (
              <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}>
                <Ionicons name="arrow-back" size={24} color="#E5E7EB" />
              </Pressable>
            ),
          }}
        />
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Cargando historial...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Evolución',
          headerTitleStyle: { color: '#E5E7EB' },
          headerStyle: { backgroundColor: '#0D1B2A' },
          headerTintColor: '#E5E7EB',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}>
              <Ionicons name="arrow-back" size={24} color="#E5E7EB" />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={cargarLog} style={({ pressed }) => [styles.headerButton, { marginRight: 5 }, pressed && styles.headerButtonPressed]} disabled={isRefreshing}>
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#E5E7EB" />
              ) : (
                <Ionicons name="refresh-outline" size={24} color="#E5E7EB" />
              )}
            </Pressable>
          ),
        }}
      />

      {/* Contenedor responsive */}
      <View style={[
        styles.responsiveContainer,
        {
          width: contentWidth,
          alignSelf: isWeb && isLargeScreen ? 'center' : 'stretch',
          paddingHorizontal: isSmallScreen ? 4 : 8,
        }
      ]}>

        {/* ═══════════════════════════════════════════════════════════════════════════
          TOGGLE: GRÁFICA vs TABLA
          ═══════════════════════════════════════════════════════════════════════════ */}
        <View style={styles.viewModeToggle}>
          <Pressable
            style={[styles.viewModeBtn, viewMode === 'chart' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('chart')}
          >
            <Ionicons name="bar-chart-outline" size={18} color={viewMode === 'chart' ? '#fff' : '#9ca3af'} />
            <Text style={[styles.viewModeBtnText, viewMode === 'chart' && styles.viewModeBtnTextActive]}>
              Gráfica
            </Text>
          </Pressable>
          <Pressable
            style={[styles.viewModeBtn, viewMode === 'table' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('table')}
          >
            <Ionicons name="list-outline" size={18} color={viewMode === 'table' ? '#fff' : '#9ca3af'} />
            <Text style={[styles.viewModeBtnText, viewMode === 'table' && styles.viewModeBtnTextActive]}>
              Tabla
            </Text>
          </Pressable>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════════
          VISTA GRÁFICA - KPI SYSTEM
          ═══════════════════════════════════════════════════════════════════════════ */}
        {viewMode === 'chart' && (
          <>
            {/* Period Filter */}
            <View style={styles.periodFilter}>
              {PERIOD_OPTIONS.map(p => (
                <Pressable
                  key={p.id}
                  style={[styles.periodBtn, selectedPeriod === p.id && styles.periodBtnActive]}
                  onPress={() => setSelectedPeriod(p.id)}
                >
                  <Text style={[styles.periodBtnText, selectedPeriod === p.id && styles.periodBtnTextActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* KPI Selector */}
            <Pressable style={styles.kpiSelector} onPress={() => setKpiModalVisible(true)}>
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

            {/* Muscle/Exercise Filters - Modal-based for iOS */}
            {currentKpi.useFilters && (
              <View style={styles.kpiFilters}>
                <View style={styles.kpiFilterRow}>
                  <Text style={styles.kpiFilterLabel}>Músculo:</Text>
                  <Pressable
                    style={styles.filterButton}
                    onPress={() => setMuscleModalVisible(true)}
                  >
                    <Text style={styles.filterButtonText}>
                      {selKpiMusculo === 'TOTAL' ? 'Todos' : selKpiMusculo}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#9ca3af" />
                  </Pressable>
                </View>
                {selKpiMusculo !== 'TOTAL' && listaEjerciciosKpi.length > 0 && (
                  <View style={styles.kpiFilterRow}>
                    <Text style={styles.kpiFilterLabel}>Ejercicio:</Text>
                    <Pressable
                      style={styles.filterButton}
                      onPress={() => setExerciseModalVisible(true)}
                    >
                      <Text style={styles.filterButtonText}>
                        {selKpiEjercicio || 'Todos'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#9ca3af" />
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* Chart Rendering */}
            <View style={styles.chartContainer}>
              {/* VOLUMEN */}
              {selectedKpi === 'volume' && volumeData && (
                <>
                  <View style={styles.chartHeader}>
                    <Text style={styles.chartTitle}>
                      Volumen {selKpiMusculo !== 'TOTAL' ? `(${selKpiMusculo})` : ''}
                    </Text>
                    <View style={styles.chartSummary}>
                      <Text style={[styles.chartSummaryValue, { color: volumeData.lastValue >= 0 ? '#10b981' : '#ef4444' }]}>
                        {volumeData.lastValue >= 0 ? '+' : ''}{volumeData.lastValue}%
                      </Text>
                      <Text style={styles.chartSummaryLabel}>vs semana 1</Text>
                    </View>
                  </View>
                  <LineChart
                    data={volumeData}
                    width={chartWidth}
                    height={220}
                    chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})` }}
                    bezier
                    style={styles.chart}
                    yAxisSuffix="%"
                  />
                  <Text style={styles.chartSubInfo}>Total período: {volumeData.totalVolK}k kg</Text>
                </>
              )}

              {/* INTENSIDAD */}
              {selectedKpi === 'intensity' && intensityData && (
                <>
                  <View style={styles.chartHeader}>
                    <Text style={styles.chartTitle}>
                      Intensidad {selKpiMusculo !== 'TOTAL' ? `(${selKpiMusculo})` : ''}
                    </Text>
                    <View style={styles.chartSummary}>
                      <Text style={[styles.chartSummaryValue, { color: intensityData.lastValue >= 0 ? '#3b82f6' : '#ef4444' }]}>
                        {intensityData.lastValue >= 0 ? '+' : ''}{intensityData.lastValue}%
                      </Text>
                      <Text style={styles.chartSummaryLabel}>vs semana 1</Text>
                    </View>
                  </View>
                  <LineChart
                    data={intensityData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    yAxisSuffix="%"
                  />
                  <Text style={styles.chartSubInfo}>Carga media: {intensityData.lastAvgLoad} kg/rep</Text>
                </>
              )}

              {/* CUMPLIMIENTO */}
              {selectedKpi === 'compliance' && complianceWeeklyData && (
                <>
                  <View style={styles.chartHeader}>
                    <Text style={styles.chartTitle}>Cumplimiento del Plan</Text>
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
                    width={chartWidth}
                    height={220}
                    chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})` }}
                    bezier
                    style={styles.chart}
                    yAxisSuffix="%"
                  />
                  <Text style={styles.chartSubInfo}>Media: {complianceWeeklyData.avgValue}% de sets en rango</Text>
                </>
              )}

              {/* CARGA ALTA */}
              {selectedKpi === 'heavySets' && heavySetsData && (
                <>
                  <View style={styles.chartHeader}>
                    <Text style={styles.chartTitle}>
                      Carga Alta {selKpiMusculo !== 'TOTAL' ? `(${selKpiMusculo})` : ''}
                    </Text>
                    <View style={styles.chartSummary}>
                      <Text style={styles.chartSummaryValue}>{heavySetsData.lastValue}%</Text>
                      <Text style={styles.chartSummaryLabel}>última semana</Text>
                    </View>
                  </View>
                  <BarChart
                    data={heavySetsData}
                    width={chartWidth}
                    height={220}
                    chartConfig={{ ...barChartConfig, color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})` }}
                    style={styles.chart}
                    yAxisSuffix="%"
                    showValuesOnTopOfBars
                  />
                  <Text style={styles.chartSubInfo}>Media: {heavySetsData.avgValue}% sets ≥85% máximo</Text>
                </>
              )}

              {/* BALANCE MUSCULAR */}
              {selectedKpi === 'muscleBalance' && muscleBalanceData && (
                <>
                  <View style={styles.chartHeader}>
                    <Text style={styles.chartTitle}>Balance Muscular</Text>
                    <View style={styles.chartSummary}>
                      <Text style={styles.chartSummaryValue}>{muscleBalanceData.fullData?.[0]?.share || 0}%</Text>
                      <Text style={styles.chartSummaryLabel}>{muscleBalanceData.fullData?.[0]?.muscle || '-'}</Text>
                    </View>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    style={styles.horizontalChartScroll}
                  >
                    <BarChart
                      data={muscleBalanceData}
                      width={muscleBalanceData.labels.length * 60}
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
                    {muscleBalanceData.fullData?.slice(0, 6).map((m, i) => (
                      <View key={i} style={styles.muscleBalanceItem}>
                        <Text style={styles.muscleBalanceShare}>{m.share}%</Text>
                        <Text style={styles.muscleBalanceName} numberOfLines={1}>{m.muscle}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* PRs */}
              {selectedKpi === 'prCount' && prCountData && (
                <>
                  <View style={styles.chartHeader}>
                    <Text style={styles.chartTitle}>PRs (Récords Personales)</Text>
                    <View style={styles.chartSummary}>
                      <Text style={[styles.chartSummaryValue, { color: '#eab308' }]}>{prCountData.totalPRs}</Text>
                      <Text style={styles.chartSummaryLabel}>en el período</Text>
                    </View>
                  </View>
                  <BarChart
                    data={prCountData}
                    width={chartWidth}
                    height={220}
                    chartConfig={{ ...barChartConfig, color: (opacity = 1) => `rgba(234, 179, 8, ${opacity})` }}
                    style={styles.chart}
                    showValuesOnTopOfBars
                  />
                  <Text style={styles.chartSubInfo}>{currentKpi.description}</Text>
                </>
              )}

              {/* No data */}
              {((selectedKpi === 'volume' && !volumeData) ||
                (selectedKpi === 'intensity' && !intensityData) ||
                (selectedKpi === 'compliance' && !complianceWeeklyData) ||
                (selectedKpi === 'heavySets' && !heavySetsData) ||
                (selectedKpi === 'muscleBalance' && !muscleBalanceData) ||
                (selectedKpi === 'prCount' && !prCountData)) && (
                  <View style={styles.noDataContainer}>
                    <Ionicons name="bar-chart-outline" size={48} color="#475569" />
                    <Text style={styles.noDataText}>Sin datos para este período</Text>
                  </View>
                )}
            </View>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════
          VISTA TABLA - IGUAL QUE COACH PROGRESS (Rutina → Día → Semanas)
          ═══════════════════════════════════════════════════════════════════════════ */}
        {viewMode === 'table' && (
          <View style={styles.tableContainer}>

            {/* RUTINAS ANTIGUAS (primero, si existen) */}
            {datosPorRutina.old.length > 0 && (
              <View style={styles.routineSectionOld}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="archive-outline" size={18} color="#9ca3af" />
                  <Text style={styles.routineSectionTitleOld}>Rutinas Anteriores</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{datosPorRutina.old.length}</Text>
                  </View>
                </View>
                {datosPorRutina.old.map((rutina, rIdx) => (
                  <View key={rIdx} style={styles.routineCardOld}>
                    <Pressable
                      style={styles.routineHeaderOld}
                      onPress={() => toggleRoutine(rutina.routineName)}
                    >
                      <View style={styles.routineHeaderLeft}>
                        <Text style={styles.routineNameOld}>{rutina.routineName}</Text>
                        <Text style={styles.routineDateOld}>Última: {rutina.lastDate}</Text>
                      </View>
                      <View style={styles.routineHeaderRight}>
                        <View style={styles.sessionsBadgeOld}>
                          <Text style={styles.sessionsBadgeTextOld}>{rutina.dias?.length || 0} días</Text>
                        </View>
                        <Ionicons
                          name={expandedRoutines[rutina.routineName] ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#6b7280"
                        />
                      </View>
                    </Pressable>

                    {expandedRoutines[rutina.routineName] && (
                      <View style={styles.routineContent}>
                        {rutina.dias.map((dia, diaIdx) => (
                          <View key={diaIdx} style={styles.dayBlock}>
                            <Pressable
                              style={styles.dayHeader}
                              onPress={() => toggleDay(rutina.routineName, dia.dayIndex)}
                            >
                              <Text style={styles.dayLabel}>{dia.dayLabel}</Text>
                              <View style={styles.dayMeta}>
                                <Text style={styles.daySessionCount}>{dia.exercises?.length || 0} ej. • {dia.totalSessions} ses.</Text>
                                <Ionicons
                                  name={expandedDays[`${rutina.routineName}-${dia.dayIndex}`] ? 'chevron-up' : 'chevron-down'}
                                  size={18}
                                  color="#9ca3af"
                                />
                              </View>
                            </Pressable>

                            {expandedDays[`${rutina.routineName}-${dia.dayIndex}`] && (
                              <View style={styles.dayContent}>
                                {dia.exercises.map((exercise, exIdx) => (
                                  <View key={exIdx} style={styles.exerciseBlock}>
                                    <View style={styles.exerciseBlockHeader}>
                                      <Text style={styles.exerciseMuscleTag}>{exercise.muscleGroup}</Text>
                                      <Text style={styles.exerciseBlockName} numberOfLines={1}>{exercise.exerciseName}</Text>
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.sessionsCarousel}>
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
                                                <Text style={styles.setColReps}>{set.reps ?? '-'}</Text>
                                                {set.repTrend === 'up' && <Ionicons name="caret-up" size={10} color="#22c55e" />}
                                              </View>
                                              <View style={styles.setColData}>
                                                <Text style={styles.setColKg}>{set.weight ?? '-'}</Text>
                                                {set.weightTrend === 'up' && <Ionicons name="caret-up" size={10} color="#22c55e" />}
                                              </View>
                                              <Pressable
                                                onPress={() => set.notes?.value && setNoteModal({ visible: true, note: set.notes })}
                                                style={[styles.setColNoteBtn, set.notes?.value ? { backgroundColor: NOTE_COLORS[set.notes.value] } : styles.setColNoteBtnEmpty]}
                                              />
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
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* RUTINA ACTUAL (después de antiguas) */}
            {datosPorRutina.current ? (
              <View style={styles.routineSection}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="fitness-outline" size={18} color="#60a5fa" />
                  <Text style={styles.routineSectionTitle}>Rutina Actual</Text>
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>ACTIVA</Text>
                  </View>
                </View>
                <View style={styles.routineCard}>
                  {/* Cabecera de rutina */}
                  <Pressable
                    style={styles.routineHeaderBlue}
                    onPress={() => toggleRoutine('current')}
                  >
                    <View style={styles.routineHeaderLeft}>
                      <Text style={styles.routineNameBlue}>{datosPorRutina.current.routineName}</Text>
                      <Text style={styles.routineDateBlue}>Última: {datosPorRutina.current.lastDate}</Text>
                    </View>
                    <View style={styles.routineHeaderRight}>
                      <View style={styles.sessionsBadge}>
                        <Text style={styles.sessionsBadgeText}>{datosPorRutina.current.dias?.length || 0} días</Text>
                      </View>
                      <Ionicons
                        name={expandedRoutines['current'] ? 'chevron-up' : 'chevron-down'}
                        size={22}
                        color="#60a5fa"
                      />
                    </View>
                  </Pressable>

                  {/* Contenido: Días */}
                  {expandedRoutines['current'] && (
                    <View style={styles.routineContent}>
                      {datosPorRutina.current.dias.map((dia, diaIdx) => (
                        <View key={diaIdx} style={styles.dayBlock}>
                          {/* Cabecera del día */}
                          <Pressable
                            style={styles.dayHeader}
                            onPress={() => toggleDay('current', dia.dayIndex)}
                          >
                            <Text style={styles.dayLabel}>{dia.dayLabel}</Text>
                            <View style={styles.dayMeta}>
                              <Text style={styles.daySessionCount}>{dia.exercises?.length || 0} ej. • {dia.totalSessions} ses.</Text>
                              <Ionicons
                                name={expandedDays[`current-${dia.dayIndex}`] ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color="#9ca3af"
                              />
                            </View>
                          </Pressable>

                          {/* Ejercicios del día */}
                          {expandedDays[`current-${dia.dayIndex}`] && (
                            <View style={styles.dayContent}>
                              {dia.exercises.map((exercise, exIdx) => (
                                <View key={exIdx} style={styles.exerciseBlock}>
                                  {/* Cabecera del ejercicio */}
                                  <View style={styles.exerciseBlockHeader}>
                                    <Text style={styles.exerciseMuscleTag}>{exercise.muscleGroup}</Text>
                                    <Text style={styles.exerciseBlockName} numberOfLines={1}>{exercise.exerciseName}</Text>
                                  </View>

                                  {/* Sesiones S1, S2, S3... lado a lado */}
                                  <ScrollView horizontal showsHorizontalScrollIndicator style={styles.sessionsCarousel}>
                                    {exercise.sesiones.map((sesion, sIdx) => (
                                      <View key={sIdx} style={styles.sessionBox}>
                                        {/* Header: S1 fecha */}
                                        <View style={styles.sessionBoxHeader}>
                                          <Text style={styles.sessionBoxNum}>S{sesion.week}</Text>
                                          <Text style={styles.sessionBoxDate}>{sesion.date}</Text>
                                        </View>

                                        {/* Header de tabla */}
                                        <View style={styles.setHeaderRow}>
                                          <Text style={styles.setHeaderCell}>S</Text>
                                          <Text style={styles.setHeaderCellData}>Rep</Text>
                                          <Text style={styles.setHeaderCellData}>Kg</Text>
                                          <Text style={styles.setHeaderCellNote}>📝</Text>
                                        </View>

                                        {/* Rows de sets */}
                                        {sesion.sets.map((set, setIdx) => (
                                          <View key={setIdx} style={styles.setTableRow}>
                                            <Text style={styles.setColNum}>{set.setNumber}</Text>
                                            <View style={styles.setColData}>
                                              <Text style={styles.setColReps}>{set.reps ?? '-'}</Text>
                                              {set.repTrend === 'up' && <Ionicons name="caret-up" size={10} color="#22c55e" />}
                                            </View>
                                            <View style={styles.setColData}>
                                              <Text style={styles.setColKg}>{set.weight ?? '-'}</Text>
                                              {set.weightTrend === 'up' && <Ionicons name="caret-up" size={10} color="#22c55e" />}
                                            </View>
                                            <Pressable
                                              onPress={() => set.notes?.value && setNoteModal({ visible: true, note: set.notes })}
                                              style={[styles.setColNoteBtn, set.notes?.value ? { backgroundColor: NOTE_COLORS[set.notes.value] } : styles.setColNoteBtnEmpty]}
                                            />
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
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <Ionicons name="barbell-outline" size={48} color="#475569" />
                <Text style={styles.noDataText}>¡Empieza a entrenar para ver tu progreso!</Text>
                <Text style={styles.noDataSubtext}>Tus sesiones aparecerán aquí</Text>
              </View>
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════
          SECCIÓN DE TOTALES CON MEDALLAS 🏆
          ═══════════════════════════════════════════════════════════════════════════ */}
        <View style={styles.totalesSection}>
          <View style={styles.totalesHeader}>
            <Text style={styles.totalesTitle}>🏆 Tu Progreso Total</Text>
            <View style={styles.dataSourceBadge}>
              <Ionicons
                name={dataSource === 'cloud' ? 'cloud' : 'phone-portrait'}
                size={12}
                color={dataSource === 'cloud' ? '#10b981' : '#6b7280'}
              />
              <Text style={[
                styles.dataSourceText,
                { color: dataSource === 'cloud' ? '#10b981' : '#6b7280' }
              ]}>
                {dataSource === 'cloud' ? 'Nube' : 'Local'}
              </Text>
            </View>
          </View>

          {/* Tarjeta: Repeticiones */}
          <View style={styles.totalCard}>
            <View style={styles.totalCardLeft}>
              <Text style={styles.totalCardIcon}>📊</Text>
              <View>
                <Text style={styles.totalCardLabel}>Repeticiones Totales</Text>
                <Text style={styles.totalCardValue}>{formatNumber(totales.reps)}</Text>
              </View>
            </View>
            <View style={styles.medallaBadge}>
              <Text style={styles.medallaEmoji}>{totales.medallaReps.emoji}</Text>
              <Text style={styles.medallaNombre}>{totales.medallaReps.nombre}</Text>
            </View>
          </View>

          {/* Tarjeta: Peso Levantado */}
          <View style={styles.totalCard}>
            <View style={styles.totalCardLeft}>
              <Text style={styles.totalCardIcon}>🏋️</Text>
              <View>
                <Text style={styles.totalCardLabel}>Peso Total Levantado</Text>
                <Text style={styles.totalCardValue}>{formatNumber(totales.peso)} kg</Text>
              </View>
            </View>
            <View style={styles.medallaBadge}>
              <Text style={styles.medallaEmoji}>{totales.medallaPeso.emoji}</Text>
              <Text style={styles.medallaNombre}>{totales.medallaPeso.nombre}</Text>
            </View>
          </View>

          {/* Tarjeta: Trabajo Total */}
          <View style={styles.totalCard}>
            <View style={styles.totalCardLeft}>
              <Text style={styles.totalCardIcon}>💪</Text>
              <View>
                <Text style={styles.totalCardLabel}>Trabajo Total (Volumen)</Text>
                <Text style={styles.totalCardValue}>{formatNumber(totales.trabajo)}</Text>
              </View>
            </View>
            <View style={styles.medallaBadge}>
              <Text style={styles.medallaEmoji}>{totales.medallaTrabajo.emoji}</Text>
              <Text style={styles.medallaNombre}>{totales.medallaTrabajo.nombre}</Text>
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════════
          KPI SELECTOR MODAL
          ═══════════════════════════════════════════════════════════════════════════ */}
        <Modal
          visible={kpiModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setKpiModalVisible(false)}
        >
          <Pressable style={styles.kpiModalOverlay} onPress={() => setKpiModalVisible(false)}>
            <View style={styles.kpiModalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.kpiModalHeader}>
                <Text style={styles.kpiModalTitle}>Seleccionar KPI</Text>
                <Pressable onPress={() => setKpiModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </Pressable>
              </View>
              <FlatList
                data={KPI_OPTIONS}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.kpiModalItem, selectedKpi === item.id && styles.kpiModalItemActive]}
                    onPress={() => {
                      setSelectedKpi(item.id);
                      setKpiModalVisible(false);
                    }}
                  >
                    <Text style={styles.kpiModalItemIcon}>{item.icon}</Text>
                    <View style={styles.kpiModalItemText}>
                      <Text style={[styles.kpiModalItemName, selectedKpi === item.id && styles.kpiModalItemNameActive]}>
                        {item.name}
                      </Text>
                      <Text style={styles.kpiModalItemDesc}>{item.description}</Text>
                    </View>
                    {selectedKpi === item.id && (
                      <Ionicons name="checkmark-circle" size={22} color="#3b82f6" />
                    )}
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Modal>

        {/* ═══════════════════════════════════════════════════════════════════════════
          MUSCLE SELECTOR MODAL
          ═══════════════════════════════════════════════════════════════════════════ */}
        <Modal
          visible={muscleModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setMuscleModalVisible(false)}
        >
          <Pressable style={styles.kpiModalOverlay} onPress={() => setMuscleModalVisible(false)}>
            <View style={styles.kpiModalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.kpiModalHeader}>
                <Text style={styles.kpiModalTitle}>Seleccionar Músculo</Text>
                <Pressable onPress={() => setMuscleModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#9ca3af" />
                </Pressable>
              </View>
              <FlatList
                data={listaMusculosKpi}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.kpiModalItem, selKpiMusculo === item && styles.kpiModalItemActive]}
                    onPress={() => {
                      handleKpiMusculoChange(item);
                      setMuscleModalVisible(false);
                    }}
                  >
                    <Text style={[styles.kpiModalItemName, selKpiMusculo === item && styles.kpiModalItemNameActive]}>
                      {item === 'TOTAL' ? 'Todos los músculos' : item}
                    </Text>
                    {selKpiMusculo === item && (
                      <Ionicons name="checkmark-circle" size={22} color="#3b82f6" />
                    )}
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Modal>

        {/* ═══════════════════════════════════════════════════════════════════════════
          EXERCISE SELECTOR MODAL
          ═══════════════════════════════════════════════════════════════════════════ */}
        <Modal
          visible={exerciseModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setExerciseModalVisible(false)}
        >
          <Pressable style={styles.kpiModalOverlay} onPress={() => setExerciseModalVisible(false)}>
            <View style={styles.kpiModalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.kpiModalHeader}>
                <Text style={styles.kpiModalTitle}>Seleccionar Ejercicio</Text>
                <Pressable onPress={() => setExerciseModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#9ca3af" />
                </Pressable>
              </View>
              <FlatList
                data={[{ id: '', name: 'Todos los ejercicios' }, ...listaEjerciciosKpi.map(e => ({ id: e, name: e }))]}
                keyExtractor={(item) => item.id || 'all'}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.kpiModalItem, selKpiEjercicio === item.id && styles.kpiModalItemActive]}
                    onPress={() => {
                      setSelKpiEjercicio(item.id);
                      setExerciseModalVisible(false);
                    }}
                  >
                    <Text style={[styles.kpiModalItemName, selKpiEjercicio === item.id && styles.kpiModalItemNameActive]}>
                      {item.name}
                    </Text>
                    {selKpiEjercicio === item.id && (
                      <Ionicons name="checkmark-circle" size={22} color="#3b82f6" />
                    )}
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Modal>

        {/* ═══════════════════════════════════════════════════════════════════════════
          NOTE VIEW MODAL
          ═══════════════════════════════════════════════════════════════════════════ */}
        <Modal
          visible={noteModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setNoteModal({ visible: false, note: null })}
        >
          <Pressable
            style={styles.noteModalOverlay}
            onPress={() => setNoteModal({ visible: false, note: null })}
          >
            <View style={styles.noteModalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.noteModalHeader}>
                <View style={styles.noteModalPriority}>
                  <View
                    style={[
                      styles.notePriorityDot,
                      { backgroundColor: NOTE_COLORS[noteModal.note?.value] || '#6b7280' }
                    ]}
                  />
                  <Text style={styles.notePriorityLabel}>
                    {noteModal.note?.value === 'high' && '🔴 Alta prioridad'}
                    {noteModal.note?.value === 'normal' && '🟠 Media'}
                    {noteModal.note?.value === 'low' && '🟢 Ok'}
                    {noteModal.note?.value === 'custom' && '🔵 Nota'}
                  </Text>
                </View>
                <Pressable onPress={() => setNoteModal({ visible: false, note: null })}>
                  <Ionicons name="close" size={24} color="#9ca3af" />
                </Pressable>
              </View>
              <Text style={styles.noteModalText}>
                {noteModal.note?.note || 'Sin texto adicional'}
              </Text>
            </View>
          </Pressable>
        </Modal>

      </View>{/* Cierre responsiveContainer */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0D1B2A', padding: 10, marginTop: 30, flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#E5E7EB' },

  // Contenedor responsive para web
  responsiveContainer: {
    flex: 1,
    paddingHorizontal: 6,
    maxWidth: '100%'
  },

  controles: { backgroundColor: '#111827', borderRadius: 30, padding: 16, marginBottom: 24, paddingTop: 5 },
  label: { fontSize: 14, fontWeight: '600', color: '#9CA3AF', marginTop: 25, marginBottom: 0 },
  picker: {
    height: Platform.OS === 'ios' ? 120 : 50,
    width: '100%',
    color: '#E5E7EB',
    marginTop: Platform.OS === 'android' ? 0 : -20,
    backgroundColor: '#1C2A3A',
    borderRadius: 8,
  },
  pickerItem: { color: '#E5E7EB', fontSize: 16, },
  pickerPlaceholder: { color: '#6B7280', fontSize: 16 },

  chartContainer: {
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
    overflow: 'visible',
  },
  chart: {
    borderRadius: 16,
    marginVertical: 8,
    marginLeft: -16, // Compensar el padding para que el gráfico use todo el ancho
  },
  horizontalChartScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },

  // NUEVO: Botón "Volcar progreso"
  bulkButton: {
    marginTop: 8,
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: '#1D4ED8',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  bulkButtonPressed: { transform: [{ translateY: 1 }], opacity: 0.9 },
  bulkButtonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },

  // Header buttons
  headerButton: { padding: 10 },
  headerButtonPressed: { opacity: 0.6 },

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTILOS SECCIÓN TOTALES CON MEDALLAS
  // ═══════════════════════════════════════════════════════════════════════════
  totalesSection: {
    marginTop: 24,
    marginBottom: 16,
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  totalesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  dataSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  dataSourceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a2332',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d3a4d',
  },
  totalCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  totalCardIcon: {
    fontSize: 28,
  },
  totalCardLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  totalCardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#E5E7EB',
  },
  // Cuadrado destacado para la medalla
  medallaBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a3a4f',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#3b5068',
    minWidth: 80,
  },
  medallaEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  medallaNombre: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FCD34D',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KPI 2.0 STYLES
  // ═══════════════════════════════════════════════════════════════════════════

  // View Mode Toggle
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  viewModeBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    gap: 6,
  },
  viewModeBtnActive: {
    backgroundColor: '#3b82f6',
  },
  viewModeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  viewModeBtnTextActive: {
    color: '#fff',
  },

  // Period Filter
  periodFilter: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodBtnActive: {
    backgroundColor: '#3b82f6',
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  periodBtnTextActive: {
    color: '#fff',
  },

  // KPI Selector
  kpiSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  kpiSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  kpiSelectorIconWrap: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiSelectorIcon: {
    fontSize: 22,
  },
  kpiSelectorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#60a5fa',
  },
  kpiSelectorDesc: {
    fontSize: 11,
    color: '#93c5fd',
    marginTop: 2,
  },
  kpiSelectorChevron: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    padding: 6,
  },

  // KPI Filters
  kpiFilters: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  kpiFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiFilterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    width: 70,
  },
  kpiFilterPicker: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  kpiPickerStyle: {
    height: 44,
    color: '#E5E7EB',
  },

  // Chart Header & Summary
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E5E7EB',
    flex: 1,
  },
  chartSummary: {
    alignItems: 'flex-end',
  },
  chartSummaryValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#3b82f6',
  },
  chartSummaryLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  chartSubInfo: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },

  // Horizontal scroll chart - Con soporte para web y scrollbar estilizado
  horizontalChartScroll: {
    marginHorizontal: 0,
    paddingBottom: 12,
    maxWidth: '100%',
    ...(Platform.OS === 'web' && {
      overflowX: 'auto',
      overflowY: 'hidden',
      display: 'block',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'thin',
      scrollbarColor: '#6366f1 #1f2937',
    }),
  },

  // Muscle Balance Legend - Responsive
  muscleBalanceLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
    paddingHorizontal: 8,
  },
  muscleBalanceItem: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 75,
    maxWidth: 120,
  },
  muscleBalanceShare: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366f1',
  },
  muscleBalanceName: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 2,
    textAlign: 'center',
  },

  // No Data
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#111827',
    borderRadius: 16,
  },
  noDataText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },

  // KPI Modal
  kpiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  kpiModalContent: {
    backgroundColor: '#1f2937',
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
    borderBottomColor: '#374151',
  },
  kpiModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  kpiModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    gap: 12,
  },
  kpiModalItemActive: {
    backgroundColor: '#1e3a5f',
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
    color: '#E5E7EB',
  },
  kpiModalItemNameActive: {
    color: '#60a5fa',
  },
  kpiModalItemDesc: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },

  // Filter Button (modal-based selector)
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '500',
  },

  // Table Styles
  tableContainer: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  tableSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E5E7EB',
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  tableRowEven: {
    backgroundColor: '#1f2937',
  },
  tableHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    paddingVertical: 10,
    paddingHorizontal: 6,
    textAlign: 'center',
    backgroundColor: '#1f2937',
  },
  tableCell: {
    fontSize: 12,
    color: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 6,
    textAlign: 'center',
  },

  // Routine Card Styles (for table view)
  routineCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#1e3a5f',
  },
  routineHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  routineIcon: {
    fontSize: 24,
  },
  routineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  routineSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  routineContent: {
    padding: 12,
  },

  // Estilos para días (botones desplegables)
  dayBlock: {
    marginBottom: 6,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 1,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f3f4f6',
    letterSpacing: 0.3,
  },
  dayMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  daySessionCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#60a5fa',
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dayContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 8,
  },

  exerciseBlock: {
    marginBottom: 16,
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 10,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
  },
  exerciseMuscle: {
    fontSize: 11,
    color: '#9ca3af',
    backgroundColor: '#1f2937',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // Week & Day Compact Styles
  weekBlock: {
    marginBottom: 4,
  },
  weekHeader: {
    backgroundColor: '#374151',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  weekTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  // Estilos de días ya definidos arriba (dayBlock, dayHeader, dayContent)
  dayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60a5fa',
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dayTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayExerciseCount: {
    fontSize: 11,
    color: '#6b7280',
  },

  // Exercise Compact
  exerciseCompact: {
    marginBottom: 10,
    backgroundColor: '#111827',
    borderRadius: 6,
    padding: 8,
  },
  exerciseCompactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  exerciseMuscleCompact: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    backgroundColor: '#374151',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  exerciseNameCompact: {
    fontSize: 13,
    fontWeight: '600',
    color: '#60a5fa',
    flex: 1,
  },

  // Sets Table Compact
  setsTable: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  setsTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    paddingVertical: 4,
  },
  setsTableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  setHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    textAlign: 'center',
  },
  setCell: {
    fontSize: 12,
    color: '#E5E7EB',
    textAlign: 'center',
  },

  // Note Circle (compact)
  noteCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  noteBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Note Modal
  noteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noteModalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#374151',
  },
  noteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  noteModalPriority: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notePriorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  notePriorityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  noteModalText: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
  },

  // Coach Progress Style - Routine Section
  routineSection: {
    marginBottom: 20,
  },
  routineSectionOld: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  routineSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#60a5fa',
    flex: 1,
  },
  routineSectionTitleOld: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9ca3af',
    flex: 1,
  },
  activeBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
  },
  routineHeaderLeft: {
    flex: 1,
  },
  routineHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sessionsBadge: {
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sessionsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#60a5fa',
  },
  sessionsBadgeOld: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sessionsBadgeTextOld: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
  },
  noDataSubtext: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 6,
  },
  routineHeaderBlue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e3a5f',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  routineNameBlue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#60a5fa',
  },
  routineDateBlue: {
    fontSize: 12,
    color: '#38bdf8',
    marginTop: 2,
  },
  routineCardOld: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  routineHeaderOld: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  routineNameOld: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  routineDateOld: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },

  // Exercise Block
  exerciseBlock: {
    marginBottom: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
  },
  exerciseBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  exerciseMuscleTag: {
    fontSize: 9,
    fontWeight: '800',
    color: '#60a5fa',
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exerciseBlockName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E5E7EB',
    flex: 1,
  },

  // Sessions Carousel (S1, S2 side by side)
  sessionsCarousel: {
    flexDirection: 'row',
  },
  sessionBox: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 8,
    marginRight: 10,
    minWidth: 130,
  },
  sessionBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  sessionBoxNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3b82f6',
  },
  sessionBoxDate: {
    fontSize: 11,
    color: '#9ca3af',
  },

  // Set Table Rows
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  setHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    width: 24,
    textAlign: 'center',
  },
  setHeaderCellData: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    width: 40,
    textAlign: 'center',
  },
  setHeaderCellNote: {
    fontSize: 10,
    width: 24,
    textAlign: 'center',
  },
  setTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  setColNum: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    width: 24,
    textAlign: 'center',
  },
  setColData: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    gap: 2,
  },
  setColReps: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  setColKg: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  setColNoteBtn: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: 4,
  },
  setColNoteBtnEmpty: {
    backgroundColor: '#374151',
  },
});
