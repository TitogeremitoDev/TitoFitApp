/* app/evolucion.jsx
   ────────────────────────────────────────────────────────────────────────
   Dashboard de Evolución + BOTÓN NUEVO:
   - "Volcar progreso de rutina activa": lee AsyncStorage:
       • active_routine
       • rutinas (para obtener nombre)
       • routine_<id> (estructura de la rutina)
       • progress (reps/kg por set)
     y genera entradas en GLOBAL_LOG por cada set con reps>0 o peso>0.
   - No borra nada. Evita duplicar volcados "bulk" anteriores por huella.
   - Mantiene el resto de comportamiento igual.
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
      datasets: [{ data: [v, v], color: (op=1)=>`rgba(59,130,246,${op})`, strokeWidth: 3 }],
    };
  }
  return {
    labels,
    datasets: [{ data, color: (op=1)=>`rgba(59,130,246,${op})`, strokeWidth: 3 }],
  };
}

/* ───────── Componente ───────── */
export default function EvolucionScreen() {
  const router = useRouter();
  const [log, setLog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selMusculo, setSelMusculo] = useState('');
  const [selEjercicio, setSelEjercicio] = useState('');
  const [selMetrica, setSelMetrica] = useState(METRICAS[0].value);
  const [selEjeX, setSelEjeX] = useState(EJES_X[0].value);
  const [isBulking, setIsBulking] = useState(false);

  const cargarLog = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const logJson = await AsyncStorage.getItem('GLOBAL_LOG');
      const logData = logJson ? JSON.parse(logJson) : [];
      setLog(logData);
    } catch (e) {
      console.warn('Error cargando GLOBAL_LOG', e);
      Alert.alert('Error', 'No se pudo cargar el historial.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  useEffect(() => { cargarLog(); }, [cargarLog]);

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
    Alert.alert(
      'Borrar Historial',
      '¿Seguro? No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: async () => {
            await AsyncStorage.setItem('GLOBAL_LOG', '[]');
            setLog([]);
            setSelMusculo(''); setSelEjercicio('');
            Alert.alert('Historial borrado', 'El historial ha sido eliminado.');
        }},
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

      {/* NUEVO: Botón de volcado masivo desde rutina activa */}
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

      {/* Botón para borrar historial */}
      <Pressable
        onPress={handleClearDatabase}
        style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
      >
        <Ionicons name="trash-outline" size={16} color="#FCA5A5" style={{ marginRight: 8 }} />
        <Text style={styles.clearButtonText}>Borrar Historial de Progreso</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0D1B2A', padding: 10, marginTop: 30, flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#E5E7EB' },

  controles: { backgroundColor: '#111827', borderRadius: 30, padding: 16, marginBottom: 24, paddingTop: 5 },
  label: { fontSize: 14, fontWeight: '600', color: '#9CA3AF', marginTop: 10, marginBottom: 0 },
  picker: {
    height: Platform.OS === 'ios' ? 120 : 50,
    width: '100%',
    color: '#E5E7EB',
    marginTop: Platform.OS === 'android' ? 0 : -20,
    backgroundColor: '#1C2A3A',
    borderRadius: 8,
  },
  pickerItem: { color: '#E5E7EB', fontSize: 16 },
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

  // Botón borrar historial
  clearButton: {
    marginTop: 16,
    marginBottom: 64,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonPressed: { borderColor: '#F87171', backgroundColor: 'rgba(252, 165, 165, 0.1)' },
  clearButtonText: { color: '#FCA5A5', textAlign: 'center', fontWeight: 'bold' },

  // Header buttons
  headerButton: { padding: 10 },
  headerButtonPressed: { opacity: 0.6 },
});
