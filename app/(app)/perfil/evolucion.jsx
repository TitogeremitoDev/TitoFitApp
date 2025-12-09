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
  Dimensions,
  ActivityIndicator,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-chart-kit';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

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

const screenWidth = Dimensions.get('window').width;
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
  const [log, setLog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selMusculo, setSelMusculo] = useState('');
  const [selEjercicio, setSelEjercicio] = useState('');
  const [selMetrica, setSelMetrica] = useState(METRICAS[0].value);
  const [selEjeX, setSelEjeX] = useState(EJES_X[0].value);
  const [isBulking, setIsBulking] = useState(false);
  const [dataSource, setDataSource] = useState('local'); // 'local' o 'cloud'

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
  // CARGAR LOG (DESDE NUBE O LOCAL SEGÚN TIPO DE USUARIO)
  // ═══════════════════════════════════════════════════════════════════════════
  const cargarLog = useCallback(async () => {
    setIsRefreshing(true);
    try {
      let logData = [];

      // Premium: cargar desde la nube
      if (isPremium && token) {
        try {
          console.log('[Evolucion] Cargando desde la nube (Premium)...');
          const response = await fetch(`${API_URL}/api/workouts?limit=500`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.workouts)) {
              logData = transformarWorkoutsALog(data.workouts);
              setDataSource('cloud');
              console.log(`[Evolucion] Cargados ${logData.length} registros de la nube`);
            }
          } else {
            console.warn('[Evolucion] Error API, usando local');
            // Fallback a local si la API falla
            const logJson = await AsyncStorage.getItem('GLOBAL_LOG');
            logData = logJson ? JSON.parse(logJson) : [];
            setDataSource('local');
          }
        } catch (apiError) {
          console.warn('[Evolucion] Error API:', apiError);
          // Fallback a local
          const logJson = await AsyncStorage.getItem('GLOBAL_LOG');
          logData = logJson ? JSON.parse(logJson) : [];
          setDataSource('local');
        }
      } else {
        // FREEUSER: cargar desde AsyncStorage local
        console.log('[Evolucion] Cargando desde local (FREEUSER)...');
        const logJson = await AsyncStorage.getItem('GLOBAL_LOG');
        logData = logJson ? JSON.parse(logJson) : [];
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

  // NUEVO — Volcado masivo desde rutina activa
  const bulkFillFromActiveRoutine = useCallback(async () => {
    try {
      setIsBulking(true);

      // 1) Leer rutina activa y estructuras
      const [[, activeId], [, listJSON], [, progressStr]] = await AsyncStorage.multiGet([
        'active_routine',
        'rutinas',
        'progress',
      ]);
      if (!activeId) {
        Alert.alert('Sin rutina activa', 'Selecciona una rutina en Rutinas antes de volcar.');
        return;
      }
      const lista = listJSON ? JSON.parse(listJSON) : [];
      const meta = lista.find((r) => r && r.id === activeId);
      const nombreRutina = meta?.nombre || 'Rutina';

      const storedRoutine = await AsyncStorage.getItem(`routine_${activeId}`);
      if (!storedRoutine) {
        Alert.alert('Rutina no disponible', 'No se ha encontrado la rutina activa en el almacenamiento.');
        return;
      }
      const diasNorm = normalizeDias(JSON.parse(storedRoutine));
      const totalDias = Array.isArray(diasNorm) ? diasNorm.length : 0;

      const prog = progressStr ? JSON.parse(progressStr) : {};

      // 2) Construir índice ejercicio -> {musculo, nombre, sets}
      const ejMap = new Map();
      for (let d = 0; d < totalDias; d++) {
        const ejercicios = (diasNorm[d] || []).filter(Boolean);
        ejercicios.forEach((ej) => {
          ejMap.set(String(ej.id), {
            musculo: ej.musculo,
            nombre: ej.nombre,
            sets: Array.isArray(ej.series) ? ej.series.length : 0,
          });
        });
      }
      if (ejMap.size === 0) {
        Alert.alert('Rutina vacía', 'La rutina activa no tiene ejercicios.');
        return;
      }

      // 3) Preparar entradas de log a partir de progress
      const nowISO = new Date().toISOString();
      const newEntries = [];

      // Revisamos TODAS las claves de progress que correspondan a la rutina activa:
      // Formato esperado: `${semana}|${dIdx}|${ej.id}|${sIdx}`
      Object.keys(prog || {}).forEach((k) => {
        const parts = String(k).split('|');
        if (parts.length !== 4) return;
        const [wStr, dStr, ejId, sStr] = parts;
        const semana = Math.max(1, Math.min(Number(wStr) || 1, MAX_WEEKS));
        const diaIdx = Math.max(0, Number(dStr) || 0);
        const setIndex = Math.max(0, Number(sStr) || 0);

        // Validar que ese ejercicio pertenece a la rutina activa
        if (!ejMap.has(String(ejId))) return;

        const dato = prog[k] || {};
        const reps = Number(dato.reps) || 0;
        const load = Number(dato.peso) || 0;

        // Solo generamos entrada si hay reps o peso, para evitar ruido vacío
        if (reps <= 0 && load <= 0) return;

        const volume = reps * load;
        const e1RM = reps > 0 ? load * (1 + reps / 30) : 0;

        const ejInfo = ejMap.get(String(ejId));
        // Huella determinista para evitar duplicar volcados anteriores
        const fingerprint = `bulk|${activeId}|${semana}|${diaIdx}|${ejId}|${setIndex}`;

        newEntries.push({
          id: fingerprint,            // determinista
          bulk: true,                 // marca de volcado
          date: nowISO,               // fecha del volcado masivo
          routineName: nombreRutina,
          week: semana,
          muscle: ejInfo.musculo,
          exercise: ejInfo.nombre,
          setIndex: setIndex + 1,     // humano
          reps,
          load,
          volume,
          e1RM,
        });
      });

      if (newEntries.length === 0) {
        Alert.alert('Sin datos que volcar', 'No hay reps/kg guardados en esta rutina.');
        return;
      }

      // 4) Escribir en GLOBAL_LOG evitando duplicados de volcados anteriores
      const currJson = await AsyncStorage.getItem('GLOBAL_LOG');
      const curr = currJson ? JSON.parse(currJson) : [];

      const existingIds = new Set(curr.filter(e => e?.bulk && e?.id).map(e => e.id));
      // Evitar duplicar: si ya existe esa id de bulk, la quitamos y sustituimos
      const filtered = curr.filter(e => !(e?.bulk && existingIds.has(e.id)));

      // Añadimos los nuevos (si había alguno con misma id en curr sin bulk, lo dejamos; sólo limpiamos bulk duplicado)
      const finalLog = [...filtered.filter(e => !(e?.bulk && newEntries.some(ne => ne.id === e.id))), ...newEntries];

      await AsyncStorage.setItem('GLOBAL_LOG', JSON.stringify(finalLog));
      await cargarLog();

      Alert.alert('Volcado completado', `Se han añadido ${newEntries.length} sets al historial para "${nombreRutina}".`);
    } catch (err) {
      console.warn('Bulk fill error', err);
      Alert.alert('Error', 'No se pudo volcar el progreso de la rutina activa.');
    } finally {
      setIsBulking(false);
    }
  }, [cargarLog]);

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

      {/* --- Controles --- */}
      <View style={styles.controles}>
        <Text style={styles.label}></Text>
        <Picker
          selectedValue={selMusculo}
          onValueChange={handleMusculoChange}
          style={styles.picker}
          itemStyle={styles.pickerItem}
          dropdownIconColor="#E5E7EB"
        >
          <Picker.Item label="Selecciona un músculo..." value="" style={styles.pickerPlaceholder} />
          {listaMusculos.map((m) => (
            <Picker.Item key={m} label={m} value={m} />
          ))}
        </Picker>

        <Text style={styles.label}></Text>
        <Picker
          selectedValue={selEjercicio}
          onValueChange={setSelEjercicio}
          enabled={!!selMusculo}
          style={styles.picker}
          itemStyle={styles.pickerItem}
          dropdownIconColor="#E5E7EB"
        >
          <Picker.Item label="Todos los ejercicios..." value="" style={styles.pickerPlaceholder} />
          {listaEjercicios.map((e) => (
            <Picker.Item key={e} label={e} value={e} />
          ))}
        </Picker>

        <Text style={styles.label}></Text>
        <Picker
          selectedValue={selMetrica}
          onValueChange={setSelMetrica}
          style={styles.picker}
          itemStyle={styles.pickerItem}
          dropdownIconColor="#E5E7EB"
        >
          {METRICAS.map((m) => (
            <Picker.Item key={m.value} label={m.label} value={m.value} />
          ))}
        </Picker>

        <Text style={styles.label}></Text>
        <Picker
          selectedValue={selEjeX}
          onValueChange={setSelEjeX}
          style={styles.picker}
          itemStyle={styles.pickerItem}
          dropdownIconColor="#E5E7EB"
        >
          {EJES_X.map((e) => (
            <Picker.Item key={e.value} label={e.label} value={e.value} />
          ))}
        </Picker>
      </View>

      {/* --- Gráfico --- */}
      <View style={styles.chartContainer}>
        {isRefreshing ? (
          <ActivityIndicator size="large" color="#3B82F6" style={{ height: 300 }} />
        ) : datosGrafico ? (
          <LineChart data={datosGrafico} width={screenWidth - 32} height={300} chartConfig={chartConfig} bezier style={styles.chart} />
        ) : null}
      </View>

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

      {/* Solo mostrar botón de volcado para usuarios locales (FREEUSER) */}
      {dataSource === 'local' && (
        <Pressable
          onPress={bulkFillFromActiveRoutine}
          disabled={isBulking}
          style={({ pressed }) => [
            styles.bulkButton,
            pressed && styles.bulkButtonPressed,
            isBulking && { opacity: 0.6 },
          ]}
        >
          {isBulking ? (
            <>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.bulkButtonText}>Volcando progreso…</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.bulkButtonText}>Volcar progreso de rutina activa</Text>
            </>
          )}
        </Pressable>
      )}


    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0D1B2A', padding: 10, marginTop: 30, flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#E5E7EB' },

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

  chartContainer: { alignItems: 'center', marginBottom: 8 },
  chart: { borderRadius: 16, marginVertical: 8 },

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
});
