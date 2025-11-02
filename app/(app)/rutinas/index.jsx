/* app/rutinas/index.jsx
   ───────────────────────────────────────────────
   ▸ Crear / seleccionar / eliminar rutinas
   ▸ Guardar en AsyncStorage
   ▸ IMPORTAR CSV
   ▸ Al CREAR o IMPORTAR se marca la rutina como ACTIVA.
   ▸ FIX: Botón ELIMINAR funciona (nada de anidar botones en un Pressable padre).
*/

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, Image, Linking, ImageBackground,
  TouchableOpacity, FlatList, Alert, Platform,
  ActivityIndicator, Modal, SafeAreaView
} from 'react-native';
import { router, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem     from 'expo-file-system';
import Papa                from 'papaparse';
import { decode as atob } from 'base-64';
import { Ionicons } from '@expo/vector-icons';

const EXTRAS = ['Ninguno', 'Descendentes', 'Mio Reps', 'Parciales'];

export default function RutinasHome() {
  const [rutinas,   setRutinas]   = useState([]);
  const [selectedId,setSelected]  = useState(null);
  const [nombre,    setNombre]    = useState('');
  const [dias,      setDias]      = useState('');
  const [error,     setError]     = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [isOfferModalVisible, setIsOfferModalVisible] = useState(false);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await AsyncStorage.multiGet(['rutinas', 'active_routine']);
      const listaJson = all[0]?.[1];
      const activa = all[1]?.[1];
      let listaParsed = [];
      if (listaJson) {
        try {
          const parsed = JSON.parse(listaJson);
          if (Array.isArray(parsed)) listaParsed = parsed;
        } catch (e) { console.error("Error parsing 'rutinas':", e); }
      }
      listaParsed = listaParsed.filter(r => r && r.id);
      setRutinas(listaParsed);
      if (activa && listaParsed.some(r => r.id === activa)) {
        setSelected(activa);
      } else if (activa) {
        setSelected(null);
        await AsyncStorage.multiRemove(['active_routine', 'active_routine_name']);
      } else {
        setSelected(null);
      }
    } catch (e) {
      console.error("Error loading initial data:", e);
      Alert.alert("Error", "No se pudieron cargar las rutinas.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  const saveList = async (list) => {
    try {
      const listToSave = list.filter(r => r && r.id);
      await AsyncStorage.setItem('rutinas', JSON.stringify(listToSave));
    } catch (e) {
      console.error("Error saving routines list:", e);
      Alert.alert("Error", "No se pudo guardar la lista.");
    }
  }

  /* ─────────── CREAR (marca activa) ─────────── */
  const crearRutina = async () => {
    setError('');
    if (!nombre.trim()) return setError('Introduce un nombre');
    const n = Number(dias);
    if (!n || n <= 0 || n > 7) return setError('Nº días inválido (1-7)');

    const nueva = {
      id: `custom_${Date.now()}`,
      nombre: nombre.trim(),
      dias: n,
      fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    };
    const listaActual = [...rutinas, nueva];
    setRutinas(listaActual);
    await saveList(listaActual);

    await AsyncStorage.multiSet([
      ['active_routine', nueva.id],
      ['active_routine_name', nueva.nombre],
    ]);
    setSelected(nueva.id);

    setNombre(''); setDias('');
    router.push(`/rutinas/${nueva.id}?dias=${nueva.dias}`);
  };

  /* ─────────── ELIMINAR ─────────── */
  const confirmarEliminar = (item) => {
    if (!item || !item.id || !item.nombre) return;
    Alert.alert(
      'Eliminar rutina',
      `¿Borrar "${item.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => eliminarRutina(item.id) },
      ],
      { cancelable: true }
    );
  };

  const eliminarRutina = async (id) => {
    try {
      const nueva = rutinas.filter(r => r.id !== id);
      setRutinas(nueva);
      await AsyncStorage.setItem('rutinas', JSON.stringify(nueva));
      await AsyncStorage.multiRemove([
        `routine_${id}`,
        `last_session_${id}`,
      ]);
      if (selectedId === id) {
        setSelected(null);
        await AsyncStorage.multiRemove(['active_routine', 'active_routine_name']);
      }
    } catch (e) {
      console.error('Eliminar rutina error', e);
      Alert.alert('Error', 'No se pudo eliminar.');
      loadInitialData();
    }
  };

  /* ─────────── SELECCIONAR RUTINA ACTIVA ─────────── */
  const handleSelectRoutine = async (item) => {
    if (!item || !item.id) return;
    setSelected(item.id);
    try {
      await AsyncStorage.multiSet([
        ['active_routine', item.id],
        ['active_routine_name', item.nombre || 'Rutina'],
      ]);
    } catch (e) {
      console.error("Error setting active routine:", e);
      Alert.alert("Error", "No se pudo seleccionar.");
      setSelected(null);
    }
  };

  /* ─────────── IMPORTAR CSV (marca activa) ─────────── */
  const importarRutina = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: 'text/*' });
      if (picked.canceled) return;

      let csvRaw = '';
      const asset = picked.assets?.[0];
      if (!asset || !asset.uri) { alert('No se pudo acceder al archivo.'); return; }

      if (Platform.OS === 'web') {
        if (asset.file) { csvRaw = await asset.file.text(); }
        else if (asset.uri?.startsWith('data:text/')) {
          const base64 = asset.uri.split(',')[1];
          try { csvRaw = atob(base64); } catch (e) { alert('Error decodificando.'); return; }
        } else { alert('No se pudo leer archivo web.'); return; }
      } else {
        csvRaw = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      }

      if (!csvRaw) { alert('Archivo vacío.'); return; }
      csvRaw = csvRaw.replace(/\r\n|\r/g, '\n').trim();
      const delimiter = csvRaw.includes(';') ? ';' : ',';
      const parseResult = Papa.parse(csvRaw, { header: true, skipEmptyLines: 'greedy', delimiter, dynamicTyping: false });
      const data = Array.isArray(parseResult.data) ? parseResult.data : [];
      const errors = parseResult.errors;
      if (errors.length > 0) console.warn("Errores parseo CSV:", errors);
      if (data.length === 0) { alert('CSV vacío o formato incorrecto.'); return; }

      const firstRow = data[0];
      const nombreRut = firstRow?.rutinaNombre?.trim();
      const diasRut = Number(firstRow?.dias);

      if (!nombreRut || !diasRut || isNaN(diasRut) || diasRut <= 0 || diasRut > 7) {
        alert('Cabeceras "rutinaNombre" o "dias" (1-7) inválidas.');
        return;
      }
      if (rutinas.some(r => r.nombre === nombreRut)) {
        Alert.alert("Duplicada", `Ya existe "${nombreRut}".`);
        return;
      }

      const idRut = `csv_${Date.now()}`;
      const diasArr = Array.from({ length: diasRut }, () => []);
      let parseError = false;

      data.forEach((f, index) => {
        const diaNum = Number(f.dia);
        const d = diaNum - 1;
        const musculo = f.musculo?.trim().toUpperCase();
        const ejercicio = f.ejercicio?.trim();
        if (isNaN(diaNum) || d < 0 || d >= diasRut || !musculo || !ejercicio) {
          console.warn(`Saltando fila ${index + 2}: inválida.`, f);
          parseError = true;
          return;
        }
        const extraValue = f.extra?.trim() || 'Ninguno';
        const validExtra = EXTRAS.includes(extraValue) ? extraValue : 'Ninguno';
        const repMinValue = String(f.repMin || '').replace(/[^0-9]/g, '');
        const repMaxValue = String(f.repMax || '').replace(/[^0-9]/g, '');
        let ej = diasArr[d].find(e => e.musculo === musculo && e.nombre === ejercicio);
        if (!ej) { ej = { id: `${idRut}_d${d}_ej${diasArr[d].length}`, musculo, nombre: ejercicio, series: [] }; diasArr[d].push(ej); }
        ej.series.push({ repMin: repMinValue, repMax: repMaxValue, extra: validExtra });
      });

      if (parseError) { Alert.alert("Aviso", "Algunas filas del CSV se ignoraron por datos inválidos."); }

      const nuevaRut = {
        id: idRut,
        nombre: nombreRut,
        dias: diasRut,
        fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
      };
      const listaActualizada = [...rutinas, nuevaRut];
      setRutinas(listaActualizada);

      await AsyncStorage.multiSet([
        ['rutinas', JSON.stringify(listaActualizada)],
        [`routine_${idRut}`, JSON.stringify(diasArr)],
        ['active_routine', idRut],
        ['active_routine_name', nombreRut],
      ]);
      setSelected(idRut);

      Alert.alert('Éxito', `Rutina "${nombreRut}" importada.`);
    } catch (err) {
      console.error('ERROR IMPORTANDO CSV', err);
      let message = 'Fallo al importar CSV.';
      if (err instanceof Error && err.message) message += `\nDetalle: ${err.message}`;
      else if (typeof err === 'string') message += `\nDetalle: ${err}`;
      Alert.alert('Error', message);
    }
  };

  /* Tarjeta de rutina
     ─ Clave: NO usamos Pressable como contenedor general.
     ─ La zona izquierda (texto) es la que selecciona.
     ─ Los botones Editar/Eliminar son táctiles independientes. */
  const Card = ({ item }) => {
    if (!item || !item.id) return null;
    const activo = item.id === selectedId;
    return (
      <View style={[styles.card, activo && styles.cardActive]}>
        {/* Zona izquierda: seleccionar rutina */}
        <TouchableOpacity
          style={{ flex: 1, marginRight: 8 }}
          onPress={() => handleSelectRoutine(item)}
          activeOpacity={0.8}
        >
          <Text style={[styles.cardTitle, activo && styles.cardTitleActive]}>
            {item.nombre || 'Rutina Desconocida'}
          </Text>
          <Text style={[styles.cardSubtitle, activo && styles.cardSubtitleActive]}>
            {item.fecha} • {item.dias} día{item.dias !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>

        {/* Editar */}
        <TouchableOpacity
          style={[styles.cardButton, styles.modBtn]}
          onPress={() => router.push(`/rutinas/${item.id}?dias=${item.dias}`)}
          hitSlop={10}
          activeOpacity={0.85}
        >
          <Ionicons name="pencil-outline" size={18} color="#fff" />
        </TouchableOpacity>

        {/* Eliminar */}
        <TouchableOpacity
          style={[styles.cardButton, styles.delBtn]}
          onPress={() => confirmarEliminar(item)}
          hitSlop={10}
          activeOpacity={0.85}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <ActivityIndicator size="large" color="#3b82f6"/>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Gestionar Rutinas" }} />

        {/* Crear Nueva Rutina */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Crear Nueva Rutina</Text>
          <Text style={styles.label}>Nombre rutina</Text>
          <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Mi Rutina PPL"/>
          <Text style={styles.label}>Días / semana (1-7)</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={dias} onChangeText={setDias} maxLength={1} placeholder="Ej: 3"/>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.addBtn} onPress={crearRutina}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }}/>
            <Text style={styles.addTxt}>CREAR RUTINA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.impBtn} onPress={importarRutina}>
            <Ionicons name="document-text-outline" size={18} color="#fff" style={{ marginRight: 8 }}/>
            <Text style={styles.impTxt}>IMPORTAR DESDE CSV</Text>
          </TouchableOpacity>
        </View>

        {/* Mis Rutinas */}
        <Text style={[styles.sectionTitle, { marginTop: 15 }]}>Mis Rutinas Guardadas</Text>
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 80 }}
          data={rutinas}
          keyExtractor={item => item?.id || Math.random().toString()}
          renderItem={({item}) => <Card item={item} />}
          ListEmptyComponent={<Text style={styles.emptyListText}>Aún no has creado ni importado ninguna rutina.</Text>}
        />
      </View>

      {/* Banner y Modal (no relevante a la lógica de eliminar) */}
      <TouchableOpacity style={styles.promoBanner} onPress={() => setIsOfferModalVisible(true)} activeOpacity={0.8}>
        <Ionicons name="sparkles-outline" size={18} color="#f59e0b" style={{ marginRight: 8 }}/>
        <Text style={styles.promoBannerText}>Rutinas genéricas... ¿Quieres dar el cambio? ¡Pincha aquí!</Text>
        <Ionicons name="arrow-forward-circle-outline" size={18} color="#f59e0b" style={{ marginLeft: 8 }}/>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={false}
        visible={isOfferModalVisible}
        onRequestClose={() => setIsOfferModalVisible(false)}
        statusBarTranslucent={true}
      >
        <SafeAreaView style={styles.offerModalContainer}>
          <TouchableOpacity style={styles.offerModalCloseButton} onPress={() => setIsOfferModalVisible(false)}>
            <Ionicons name="close-circle" size={32} color="#cccccc" />
          </TouchableOpacity>

        <View style={styles.offerRoot}>
          <ImageBackground
            source={require('../../../assets/images/fitness/promocion.png')}
            style={styles.offerBg}
            resizeMode="cover"
          />
          <View style={styles.offerFooter}>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => Linking.openURL('https://forms.gle/MGM5xtFx7hYgSGNW8')}
              activeOpacity={0.9}
            >
              <Text style={styles.ctaBtnText}>Quiero mi plan personalizado</Text>
            </TouchableOpacity>
          </View>
        </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

/* ─────────── ESTILOS ─────────── */
const styles = StyleSheet.create({
  container:{ flex:1, paddingHorizontal:16, paddingTop: 16, backgroundColor:'#f8fafc' },
  sectionContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, borderWidth: 1, borderColor: '#e5e7eb' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#1f2937' },
  label:{ fontWeight:'500', marginTop:10, marginBottom: 4, color: '#4b5563'},
  input:{ backgroundColor:'#fff', borderWidth:1, borderColor:'#d1d5db', borderRadius:8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 10, fontSize: 15, },
  addBtn:{ marginTop: 16, backgroundColor:'#2563eb', padding: 14, borderRadius:8, alignItems:'center', elevation: 2, flexDirection: 'row', justifyContent: 'center' },
  addTxt:{ color:'#fff', fontWeight:'600', fontSize: 15 },
  impBtn:{ marginTop: 8, backgroundColor:'#6366f1', padding: 12, borderRadius:8, alignItems:'center', flexDirection: 'row', justifyContent: 'center', elevation: 2, minHeight: 48 },
  impTxt:{ color:'#fff', fontWeight:'600', fontSize: 14, marginLeft: 4 },
  error:{ color:'#dc2626', marginTop: 8, fontSize: 13, textAlign: 'center' },
  emptyListText: { textAlign:'center', marginTop:30, color: '#6b7280', fontSize: 15 },
  loadingText: { marginTop: 10, color: '#6b7280' },

  card:{ flexDirection:'row', alignItems:'center', gap: 10, backgroundColor:'#fff', paddingVertical: 14, paddingHorizontal: 12, borderRadius:10, marginBottom:10, elevation: 1, borderWidth: 1, borderColor: '#e5e7eb', },
  cardActive:{ borderColor:'#3b82f6', borderWidth: 1.5, backgroundColor:'#eff6ff', },
  cardTitle:{ fontWeight:'600', fontSize:16, color: '#1f2937'},
  cardTitleActive:{ color:'#1d4ed8' },
  cardSubtitle:{ color:'#6b7280', fontSize: 13 },
  cardSubtitleActive:{ color:'#2563eb' },
  cardButton: { padding: 9, borderRadius: 18, justifyContent: 'center', alignItems: 'center', },
  modBtn:{ backgroundColor:'#3b82f6' },
  delBtn:{ backgroundColor:'#ef4444', marginLeft: 4 },

  promoBanner: {
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
  },
  promoBannerText: { color: '#f59e0b', fontSize: 13, fontWeight: '500', textAlign: 'center', flexShrink: 1, marginHorizontal: 5, },

  offerModalContainer: { flex: 1, backgroundColor: '#0B1220' },
  offerModalCloseButton: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 60, right: 15, zIndex: 10, padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 20, },
  offerRoot: { flex: 1, backgroundColor: '#000' },
  offerBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  offerFooter: { position: 'absolute', left: 16, right: 16, bottom: 100, alignItems: 'center' },
  ctaBtn: { width: '100%', maxWidth: 420, backgroundColor: '#3b82f6', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, elevation: 3 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
