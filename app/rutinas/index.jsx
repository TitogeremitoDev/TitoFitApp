/*  app/rutinas/index.jsx
   ───────────────────────────────────────────────
   ▸ Crear / seleccionar / eliminar rutinas
   ▸ Guardar en AsyncStorage
   ▸ Botón “IMPORTAR CSV”  →  abre selector y genera rutina
   ▸ Compatible con CSV delimitado por ,  ó  ;
   
*/
import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, FlatList, Alert, Pressable,Button, Platform
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem     from 'expo-file-system';
import Papa                from 'papaparse';
import { decode as atob } from 'base-64';

/* ───────────────────────────────────────────── */
export default function RutinasHome() {
  /* Estados */
  const [rutinas,   setRutinas]   = useState([]);
  const [selectedId,setSelected]  = useState(null);
  const [nombre,    setNombre]    = useState('');
  const [dias,      setDias]      = useState('');
  const [error,     setError]     = useState('');

  /* ─────────── CARGA INICIAL ─────────── */
  useEffect(() => {
    (async () => {
      const all = await AsyncStorage.multiGet(['rutinas','active_routine']);
      const lista   = all[0][1];
      const activa  = all[1][1];
      if (lista)  setRutinas(JSON.parse(lista));
      if (activa) setSelected(activa);
    })();
  }, []);

  /* Guardar lista helper */
  const saveList = (list) =>
    AsyncStorage.setItem('rutinas', JSON.stringify(list));


  /* ─────────── CREAR ─────────── */
  const crearRutina = () => {
    if (!nombre.trim()) return setError('Introduce un nombre');
    const n = Number(dias);
    if (!n || n <= 0)  return setError('Días inválidos');

    const nueva = {
      id: Date.now().toString(),
      nombre: nombre.trim(),
      dias: n,
      fecha: new Date().toLocaleDateString(),
    };
    const listaActual = [...rutinas, nueva];
    setRutinas(listaActual);
    saveList(listaActual);
    setNombre(''); setDias(''); setError('');
  };

  /* ─────────── ELIMINAR ─────────── */
const eliminarRutina = (id) => {
  if (confirm('¿Eliminar rutina?')) {           // `confirm` funciona en web y móvil (JS runtime)
    const nueva = rutinas.filter(r => r.id !== id);
    setRutinas(nueva);
    AsyncStorage.setItem('rutinas', JSON.stringify(nueva));
    AsyncStorage.removeItem(`routine_${id}`);
    if (selectedId === id) {
      setSelected(null);
      AsyncStorage.multiRemove(['active_routine','active_routine_name']);
    }
  }
};
  /* ─────────── IMPORTAR CSV ─────────── */
const importarRutina = async () => {
  try {
    console.log("HOLIWI");
    /* ─── Seleccionar ─── */
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: 'text/*',
    });
if (picked.canceled || picked.type === 'cancel') return
console.log('Archivo seleccionado:', picked);

    /* ─── Leer CSV a texto ─── */
   let csvRaw = '';

if (Platform.OS === 'web') {
  /* ── 1. FileList (picked.output[0]) ── */
  if (picked.output?.[0]) {
    csvRaw = await picked.output[0].text();
  }
  /* ── 2. assets[0].file (otros navegadores) ── */
  else if (picked.assets?.[0]?.file) {
    csvRaw = await picked.assets[0].file.text();
  }
  /* ── 3. data:text/csv;base64,…  (Expo Web) ── */
  else if (picked.assets?.[0]?.uri?.startsWith('data:text')) {
    const base64 = picked.assets[0].uri.split(',')[1];
    csvRaw = atob(base64);            // ← decodificamos aquí
  } else {
    alert('No se pudo leer el archivo'); return;
  }
} else {
  /* ── Android / iOS ── */
  const uri = picked.assets?.[0]?.uri ?? picked.uri;
  csvRaw = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

alert('Paso 2: longitud CSV = ' + csvRaw.length);   // ← ahora verás > 0

    console.log('CSV RAW >>>', csvRaw.slice(0, 120));

    /* ─── Normaliza separador ─── */
    // if (!csvRaw.includes(',') && csvRaw.includes(';'))
    //   csvRaw = csvRaw.replace(/;/g, ',');

    /* ─── Parsear ─── */

if (csvRaw.startsWith('"') && csvRaw.endsWith('"')) {
  csvRaw = csvRaw.slice(1, -1).replace(/""/g, '"');
}
csvRaw = csvRaw.replace(/\r\n|\r/g, '\n');
    

const { data } = Papa.parse(csvRaw, {
  header: true,
  skipEmptyLines: true,
  delimiter: ',',   // ← tu archivo usa comas
});
console.log('Filas OK:', data.length, data[0]);

    console.log('Filas parseadas:', data.length, data[0]);
    if (!data.length) return alert('CSV vacío o cabeceras incorrectas');

    /* ─── Validar columnas principales ─── */
    const nombreRut = data[0].rutinaNombre?.trim?.();
    const diasRut   = Number(data[0].dias);
    if (!nombreRut || !diasRut)
      return alert('rutinaNombre o dias ausentes');

    /* ─── Construir estructura ejercicios ─── */
    const idRut  = Date.now().toString();
    const diasArr = Array.from({ length: diasRut }, () => []);

    data.forEach(f => {
      const d = Number(f.dia) - 1;
      if (d < 0 || d >= diasRut) return;

      let ej = diasArr[d].find(
        e => e.musculo === f.musculo && e.nombre === f.ejercicio
      );
      if (!ej) {
        ej = { id:`${idRut}_${d}_${diasArr[d].length}`,
               musculo:f.musculo, nombre:f.ejercicio, series:[] };
        diasArr[d].push(ej);
      }
      ej.series.push({
        repMin:f.repMin, repMax:f.repMax, extra:f.extra || 'Ninguno',
      });
    });

    /* ─── Añadir a lista + persistir ─── */
    const nuevaRut = {
      id:idRut, nombre:nombreRut, dias:diasRut,
      fecha:new Date().toLocaleDateString(),
    };
    setRutinas(prev => {
      const lista = [...prev, nuevaRut];
      AsyncStorage.multiSet([
        ['rutinas', JSON.stringify(lista)],
        [`routine_${idRut}`, JSON.stringify(diasArr)],
      ]);
      console.log('Rutina añadida, total:', lista.length);
      return lista;
    });

    alert('Rutina importada ✅');
  } catch (err) {
    console.error('ERROR IMPORTANDO', err);
    alert('Fallo al importar CSV');
  }
};


  /* ─────────── TARJETA ─────────── */
  const Card = ({ item }) => {
    const activo = item.id === selectedId;
    return (
      <Pressable
        style={[styles.card, activo && styles.cardActive]}
        onPress={()=>{
          setSelected(item.id);
          AsyncStorage.multiSet([
            ['active_routine',item.id],
            ['active_routine_name',item.nombre],
          ]);
        }}
      >
        <View style={{ flex:1 }}>
          <Text style={[styles.cardTitle, activo && styles.cardTitleActive]}>
            {item.nombre}
          </Text>
          <Text style={styles.cardSubtitle}>
            {item.fecha} • {item.dias} día{item.dias>1&&'s'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.modBtn}
          onPress={(e)=>{e.stopPropagation(); router.push(`/rutinas/${item.id}?dias=${item.dias}`);}}
        ><Text style={styles.btnText}>Mod</Text></TouchableOpacity>

          <TouchableOpacity
            style={styles.delBtn}
            onPress={() => eliminarRutina(item.id)}
          >
            <Text style={styles.btnText}>Del</Text>
          </TouchableOpacity>
      </Pressable>
    );
  };    

  /* ─────────── UI ─────────── */
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nombre rutina</Text>
      <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />

      <Text style={styles.label}>Días / semana</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={dias}
        onChangeText={setDias}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.addBtn} onPress={crearRutina}>
        <Text style={styles.addTxt}>CREAR</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.impBtn} onPress={importarRutina}>
        <Text style={styles.impTxt}>IMPORTAR CSV</Text>
      </TouchableOpacity>

      <FlatList
        style={{marginTop:24}}
        data={rutinas}
        keyExtractor={it=>it.id}
        renderItem={Card}
        ListEmptyComponent={<Text style={{textAlign:'center',marginTop:40}}>Sin rutinas</Text>}
      />
    </View>
  );
}

/* ─────────── ESTILOS ─────────── */
const styles = StyleSheet.create({
  container:{ flex:1, padding:20, backgroundColor:'#f5f5f5' },
  label:{ fontWeight:'bold', marginTop:12 },
  input:{ backgroundColor:'#fff', borderWidth:1, borderColor:'#ddd',
          borderRadius:8, padding:8, marginTop:4 },
  addBtn:{ marginTop:16, backgroundColor:'#3b82f6',
           padding:12, borderRadius:8, alignItems:'center' },
  addTxt:{ color:'#fff', fontWeight:'bold' },
  impBtn:{ marginTop:12, backgroundColor:'#059669',
           padding:12, borderRadius:8, alignItems:'center' },
  impTxt:{ color:'#fff', fontWeight:'bold' },
  error:{ color:'#dc2626', marginTop:6 },

  card:{ flexDirection:'row', alignItems:'center', gap:8,
         backgroundColor:'#fff', padding:12, borderRadius:10,
         marginBottom:12, elevation:2 },
  cardActive:{ borderColor:'#10b981', borderWidth:2, backgroundColor:'#e6f9f2' },
  cardTitle:{ fontWeight:'bold', fontSize:16 },
  cardTitleActive:{ color:'#059669' },
  cardSubtitle:{ color:'#555' },

  modBtn:{ backgroundColor:'#10b981', padding:8, borderRadius:6 },
  delBtn:{ backgroundColor:'#ef4444', padding:8, borderRadius:6 },
  btnText:{ color:'#fff', fontSize:12 },
});
