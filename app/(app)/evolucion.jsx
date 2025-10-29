/* app/evolucion.jsx
    ────────────────────────────────────────────────────────────────────────
    ¡NUEVO! Dashboard de Evolución.
    Lee el 'GLOBAL_LOG' y replica la lógica de tu Google Sheet 'Results'.
    CORREGIDO: Eliminado import 'intl/locale...' y añadido import 'Platform'.
    MODIFICADO: Eliminado título, ajustes Picker, y lógica de gráfico mejorada.
    MODIFICADO: Eliminado texto placeholder, añadido console.log.
    CORREGIDO: Lógica para mostrar gráfico con 1 solo punto y estilo del placeholder.
    AÑADIDO: Agrupación por Semana y corrección error "Assignment to constant".
    CORREGIDO: Error "Assignment to constant" al duplicar 1 punto.
    CORREGIDO: Aviso 'value prop on select should not be null'.
    CORREGIDO: Placeholder ahora se oculta completamente.
    AÑADIDO: Botón de Actualizar datos en la cabecera.
    CORREGIDO: Placeholder completamente eliminado (renderiza null).
    CORREGIDO: Eliminado minHeight de chartContainer y reemplazado TouchableOpacity por Pressable.
    ──────────────────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  // TouchableOpacity, // <--- Eliminado
  Pressable, // <--- Añadido
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-chart-kit';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';


const screenWidth = Dimensions.get('window').width;

// Métricas que podemos calcular (como en tu 'Results')
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
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Azul
  labelColor: (opacity = 1) => `rgba(209, 213, 219, ${opacity})`,
  propsForDots: { r: '5', strokeWidth: '2', stroke: '#3B82F6' },
};

// --- Funciones Helper ---

function getFiltros(log) {
  const musculos = new Map();
  log.forEach((entry) => {
    if (!entry.muscle || !entry.exercise) return;
    if (!musculos.has(entry.muscle)) { musculos.set(entry.muscle, new Set()); }
    musculos.get(entry.muscle).add(entry.exercise);
  });
  const listaMusculos = Array.from(musculos.keys()).sort();
  const mapEjercicios = new Map();
  musculos.forEach((ejSet, mus) => { mapEjercicios.set(mus, Array.from(ejSet).sort()); });
  return { listaMusculos, mapEjercicios };
}

function agregarDatosParaGrafico(logFiltrado, metrica, ejeX) {
  console.log('[agregarDatosParaGrafico] Iniciando agregación...');
  console.log('[agregarDatosParaGrafico] Datos filtrados:', logFiltrado);
  console.log('[agregarDatosParaGrafico] Métrica:', metrica, 'Eje X:', ejeX);

  // 1. Agrupar por la unidad del eje X (fecha, sesión o semana)
  const grupos = new Map();
  logFiltrado.forEach((entry) => {
    let clave;
    const entryDate = new Date(entry.date);
    entry._sortDate = entryDate;

    if (ejeX === 'date') { clave = entry.date.split('T')[0]; }
    else if (ejeX === 'week') { clave = entry.week ? Number(entry.week) : 0; }
    else { clave = `${entry.routineName} | ${entry.date.split('T')[0]}`; }

    if (!grupos.has(clave)) { grupos.set(clave, []); }
    grupos.get(clave).push(entry);
  });
  console.log('[agregarDatosParaGrafico] Datos agrupados por clave:', grupos);

  // 2. Calcular la métrica para cada grupo
  const dataPuntos = [];
  grupos.forEach((entries, clave) => {
    let valorMetrica = 0;
    const repsTotales = entries.reduce((acc, e) => acc + (e.reps || 0), 0);
    const volTotal = entries.reduce((acc, e) => acc + (e.volume || 0), 0);

    switch (metrica) {
      case 'volume': valorMetrica = volTotal; break;
      case 'e1RM_max': valorMetrica = Math.max(0, ...entries.map((e) => e.e1RM || 0)); break;
      case 'load_avg':
        const cargaPonderadaTotal = entries.reduce((acc, e) => acc + ((e.load || 0) * (e.reps || 0)), 0);
        valorMetrica = repsTotales > 0 ? cargaPonderadaTotal / repsTotales : 0; break;
      case 'reps': valorMetrica = repsTotales; break;
    }
    const sortDate = entries[0]._sortDate || new Date();
    dataPuntos.push({ clave: clave, valor: valorMetrica, fechaSort: sortDate });
  });

  // 3. Ordenar siempre por fecha real
  dataPuntos.sort((a, b) => a.fechaSort - b.fechaSort);
  console.log('[agregarDatosParaGrafico] Puntos de datos calculados y ordenados:', dataPuntos);

  // 4. Formatear para el gráfico
  let finalLabels = [];
  let finalData = dataPuntos.map(p => p.valor);

  if (ejeX === 'date') { finalLabels = dataPuntos.map(p => p.fechaSort.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })); }
  else if (ejeX === 'week') {
     const weekLabels = dataPuntos.map(p => `S${p.clave}`);
     finalLabels = weekLabels.length > 7 ? weekLabels.map(l => l.replace('Semana ', 'S')) : weekLabels;
  } else { finalLabels = dataPuntos.map((_, i) => String(i + 1)); }

  // Lógica para 0 o 1 punto
  if (finalData.length === 0) { console.log(`[agregarDatosParaGrafico] No hay puntos (0), devolviendo null.`); return null; }
  if (finalData.length === 1) {
     console.log(`[agregarDatosParaGrafico] Solo hay 1 punto, duplicando para el gráfico.`);
     const singleLabel = finalLabels[0];
     const singleDataPoint = finalData[0];
     return { labels: [singleLabel, singleLabel], datasets: [{ data: [singleDataPoint, singleDataPoint], color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, strokeWidth: 3 }] };
  }

  console.log('[agregarDatosParaGrafico] Datos finales para gráfico:', { labels: finalLabels, datasets: [{ data: finalData }] });
  return { labels: finalLabels, datasets: [{ data: finalData, color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, strokeWidth: 3 }] };
}


// --- Componente Principal ---
export default function EvolucionScreen() {
  const router = useRouter();
  const [log, setLog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selMusculo, setSelMusculo] = useState('');
  const [selEjercicio, setSelEjercicio] = useState('');
  const [selMetrica, setSelMetrica] = useState(METRICAS[0].value);
  const [selEjeX, setSelEjeX] = useState(EJES_X[0].value);

  const cargarLog = useCallback(async () => {
    console.log('[EvolucionScreen] Iniciando carga de datos...');
    setIsRefreshing(true);
    try {
      const logJson = await AsyncStorage.getItem('GLOBAL_LOG');
      const logData = logJson ? JSON.parse(logJson) : [];
      console.log('[EvolucionScreen] GLOBAL_LOG cargado:', logData);
      setLog(logData);
    } catch (e) { console.warn('Error cargando GLOBAL_LOG', e); Alert.alert('Error', 'No se pudo cargar el historial.'); }
    finally { setIsLoading(false); setIsRefreshing(false); console.log('[EvolucionScreen] Carga de datos finalizada.'); }
  }, []);

  useEffect(() => { cargarLog(); }, [cargarLog]);

  const { listaMusculos, mapEjercicios } = useMemo(() => getFiltros(log), [log]);
  const listaEjercicios = useMemo(() => {
    if (!selMusculo) return [];
    return mapEjercicios.get(selMusculo) || [];
  }, [selMusculo, mapEjercicios]);

  const datosGrafico = useMemo(() => {
    if (!selMusculo) return null;
    const logFiltrado = log.filter((entry) => (entry.muscle === selMusculo) && (!selEjercicio || entry.exercise === selEjercicio));
    console.log('[EvolucionScreen] Log filtrado para gráfico:', logFiltrado);
    return agregarDatosParaGrafico(logFiltrado, selMetrica, selEjeX);
  }, [log, selMusculo, selEjercicio, selMetrica, selEjeX]);

  const handleMusculoChange = (musculo) => { setSelMusculo(musculo); setSelEjercicio(''); };
  const handleClearDatabase = () => {
     Alert.alert("Borrar Historial", "¿Seguro? No se puede deshacer.",
      [{ text: "Cancelar", style: "cancel" },
       { text: "Borrar", style: "destructive", onPress: async () => {
            await AsyncStorage.setItem('GLOBAL_LOG', '[]'); setLog([]); setSelMusculo(''); setSelEjercicio('');
            Alert.alert("Historial borrado", "El historial ha sido eliminado.");
      }}]);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
          {/* Usamos Pressable en headerLeft */}
          <Stack.Screen options={{ title: 'Cargando...', headerTitleStyle: { color: '#E5E7EB' }, headerStyle: { backgroundColor: '#0D1B2A' }, headerTintColor: '#E5E7EB', headerLeft: () => (<Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}><Ionicons name="arrow-back" size={24} color="#E5E7EB" /></Pressable>) }} />
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Cargando historial...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
        {/* Usamos Pressable en headerLeft y headerRight */}
        <Stack.Screen options={{
            title: 'Evolución',
            headerTitleStyle: { color: '#E5E7EB' },
            headerStyle: { backgroundColor: '#0D1B2A' },
            headerTintColor: '#E5E7EB',
            headerLeft: () => (<Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}><Ionicons name="arrow-back" size={24} color="#E5E7EB" /></Pressable>),
            headerRight: () => (<Pressable onPress={cargarLog} style={({ pressed }) => [styles.headerButton, { marginRight: 5 }, pressed && styles.headerButtonPressed]} disabled={isRefreshing}>{isRefreshing ? (<ActivityIndicator size="small" color="#E5E7EB" />) : (<Ionicons name="refresh-outline" size={24} color="#E5E7EB" />)}</Pressable>),
        }} />

      {/* --- Controles --- */}
      <View style={styles.controles}>
        <Text style={styles.label}></Text>
        <Picker selectedValue={selMusculo} onValueChange={handleMusculoChange} style={styles.picker} itemStyle={styles.pickerItem} dropdownIconColor="#E5E7EB">
          <Picker.Item label="Selecciona un músculo..." value="" style={styles.pickerPlaceholder}/>
          {listaMusculos.map((m) => (<Picker.Item key={m} label={m} value={m} />))}
        </Picker>
        <Text style={styles.label}></Text>
        <Picker selectedValue={selEjercicio} onValueChange={setSelEjercicio} enabled={!!selMusculo} style={styles.picker} itemStyle={styles.pickerItem} dropdownIconColor="#E5E7EB">
          <Picker.Item label="Todos los ejercicios..." value="" style={styles.pickerPlaceholder}/>
          {listaEjercicios.map((e) => (<Picker.Item key={e} label={e} value={e} />))}
        </Picker>
        <Text style={styles.label}></Text>
        <Picker selectedValue={selMetrica} onValueChange={setSelMetrica} style={styles.picker} itemStyle={styles.pickerItem} dropdownIconColor="#E5E7EB">
          {METRICAS.map((m) => (<Picker.Item key={m.value} label={m.label} value={m.value} />))}
        </Picker>
        <Text style={styles.label}></Text>
        <Picker selectedValue={selEjeX} onValueChange={setSelEjeX} style={styles.picker} itemStyle={styles.pickerItem} dropdownIconColor="#E5E7EB">
          {EJES_X.map((e) => (<Picker.Item key={e.value} label={e.label} value={e.value} />))}
        </Picker>
      </View>

      {/* --- Gráfico --- */}
      <View style={styles.chartContainer}>
        {isRefreshing ? (
            <ActivityIndicator size="large" color="#3B82F6" style={{ height: 300 }}/>
        ) : datosGrafico ? (
          <LineChart data={datosGrafico} width={screenWidth - 32} height={300} chartConfig={chartConfig} bezier style={styles.chart} />
        ) : (
          // Si no hay datos, no renderiza nada aquí
          null
        )}
      </View>

      {/* Botón para borrar la base de datos (Usando Pressable) */}
      <Pressable
          onPress={handleClearDatabase}
          style={({ pressed }) => [
              styles.clearButton,
              pressed && styles.clearButtonPressed
          ]}
        >
        <Ionicons name="trash-outline" size={16} color="#FCA5A5" style={{marginRight: 8}}/>
        <Text style={styles.clearButtonText}>Borrar Historial de Progreso</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {  backgroundColor: '#0D1B2A', padding: 10 ,marginTop:30, flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#E5E7EB' },
  header: { fontSize: 24, fontWeight: 'bold', color: '#E5E7EB', marginBottom: 16, textAlign: 'center' },
  controles: { backgroundColor: '#111827', borderRadius: 30, padding: 16, marginBottom: 24, paddingTop: 5 },
  label: { fontSize: 14, fontWeight: '600', color: '#9CA3AF', marginTop: 10, marginBottom: 0 },
  picker: { height: Platform.OS === 'ios' ? 120 : 50, width: '100%', color: '#E5E7EB', marginTop: Platform.OS === 'android' ? 0 : -20, backgroundColor: '#1C2A3A', borderRadius: 8 },
  pickerItem: { color: '#E5E7EB', fontSize: 16 },
  pickerPlaceholder: { color: '#6B7280', fontSize: 16 },
  // --- CORRECCIÓN PLACEHOLDER ---
  chartContainer: {
      alignItems: 'center',
      // minHeight: 316, // <- Eliminado para que colapse si no hay gráfico
      marginBottom: 8, // Añadido un margen inferior por si acaso
  },
  // --- FIN CORRECCIÓN ---
  chart: { borderRadius: 16, marginVertical: 8 },
  clearButton: {
    marginTop: 32,
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
  clearButtonPressed: { // Estilo para Pressable presionado
    borderColor: '#F87171', // Un rojo más intenso
    backgroundColor: 'rgba(252, 165, 165, 0.1)', // Fondo rojo muy sutil
  },
  clearButtonText: { color: '#FCA5A5', textAlign: 'center', fontWeight: 'bold' },
  // Estilos para botones de cabecera (Pressable)
  headerButton: {
      padding: 10, // Área táctil más grande
  },
  headerButtonPressed: {
      opacity: 0.6,
  },
});