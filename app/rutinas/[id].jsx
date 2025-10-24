import { useLocalSearchParams } from 'expo-router';
// <--- Importaciones optimizadas
import { useState, useLayoutEffect, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SectionList,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ─── Listas fijas ───────────────────── */
const MUSCULOS = [
  'BICEPS', 'CUADRICEPS', 'DELTOIDES', 'ESPALDA', 'FEMORAL',
  'GEMELOS', 'GLUTEO', 'PECTORAL', 'TRICEPS', 'OTROS',
];
const EXTRAS = ['Ninguno', 'Descendentes', 'Mio Reps', 'Parciales'];


// <--- Componente RenderItem movido fuera y "memoizado"
const RenderItem = memo(({ item, isOpen, onToggle, onUpdateSerie }) => {
  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onToggle}>
        <Text style={styles.cardHeader}>
          {item.musculo} — {item.nombre}
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.seriesBox}>
          {item.series.map((s, i) => (
            <View key={i} style={styles.serieRow}>
              <Text style={styles.serieLabel}>Serie {i + 1}</Text>

              <TextInput
                placeholder="min"
                keyboardType="numeric"
                style={styles.repInput}
                value={s.repMin}
                onChangeText={(v) => onUpdateSerie(item.id, i, { repMin: v })}
              />
              <TextInput
                placeholder="max"
                keyboardType="numeric"
                style={styles.repInput}
                value={s.repMax}
                onChangeText={(v) => onUpdateSerie(item.id, i, { repMax: v })}
              />

              <Picker
                selectedValue={s.extra}
                onValueChange={(v) => onUpdateSerie(item.id, i, { extra: v })}
                style={styles.extraPicker}
              >
                {EXTRAS.map(e => <Picker.Item key={e} label={e} value={e} />)}
              </Picker>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

// <--- Corrección del error 'display name'
RenderItem.displayName = 'RenderItem';


/* ─── Componente ─────────────────────── */
export default function EditarRutina() {
  /* 1. Parámetros */
  const { id, dias } = useLocalSearchParams();
  const diasTotales = Number(dias) > 0 ? Number(dias) : 1;
  const navigation = useNavigation();

  /* 2. Estado principal */
  const [ejerciciosPorDia, setEjerciciosPorDia] = useState(
    () => Array.from({ length: diasTotales }, () => [])
  );
  const [diaSel, setDiaSel] = useState(1);
  const [openId, setOpenId] = useState(null); // Qué item está abierto

  /* 3. Formulario */
  const [musculo, setMusculo] = useState('');
  const [nombre, setNombre] = useState('');
  const [nSeries, setNSeries] = useState('');

  /* 4. Cargar rutina si existe */
  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(`routine_${id}`);
        if (!json) return;

        const cargado = JSON.parse(json);

        /* Ajustar al nº de días actual */
        let ajustado = cargado;
        if (cargado.length < diasTotales) {
          ajustado = [
            ...cargado,
            ...Array.from({ length: diasTotales - cargado.length }, () => []),
          ];
        } else if (cargado.length > diasTotales) {
          ajustado = cargado.slice(0, diasTotales);
        }

        setEjerciciosPorDia(ajustado);
      } catch (e) {
        console.warn('No se pudo cargar rutina', e);
      }
    })();
  }, [id, diasTotales]);

  /* 5. Guardado automático */
  useEffect(() => {
    AsyncStorage.setItem(`routine_${id}`, JSON.stringify(ejerciciosPorDia))
      .catch(e => console.warn('No se pudo guardar', e));
  }, [ejerciciosPorDia, id]);

  /* 6. Añadir ejercicio */
  const addEjercicio = useCallback(() => {
    if (!musculo || !nombre || !nSeries) return;
    const nuevo = {
      id: Date.now().toString(),
      musculo,
      nombre,
      series: Array(Number(nSeries)).fill({
        repMin: '', repMax: '', extra: 'Ninguno',
      }),
    };
    setEjerciciosPorDia(prev => {
      const copia = [...prev];
      copia[diaSel - 1] = [...copia[diaSel - 1], nuevo];
      return copia;
    });
    setMusculo(''); setNombre(''); setNSeries('');
  }, [musculo, nombre, nSeries, diaSel]); // <--- Dependencias

  /* 7. Editar serie */
  const updateSerie = useCallback((ejId, serieIdx, changes) =>
    setEjerciciosPorDia(prev => prev.map(dia =>
      dia.map(ej => {
        if (ej.id !== ejId) return ej;
        const nuevas = ej.series.map((s, i) =>
          i === serieIdx ? { ...s, ...changes } : s
        );
        return { ...ej, series: nuevas };
      })
    )),
  []); // <--- Array vacío (no usa nada de fuera)

  /* 8. Botón Guardar manual (por si el usuario prefiere) */
  const guardarRutinaManual = useCallback(async () => {
    try {
      await AsyncStorage.setItem(`routine_${id}`, JSON.stringify(ejerciciosPorDia));
      alert('Rutina guardada ✅');
    } catch {
      alert('No se pudo guardar');
    }
  }, [id, ejerciciosPorDia]); // <--- Dependencias

  /* 9. Cabecera con botón Guardar */
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={guardarRutinaManual} style={styles.saveBtn}>
          <Text style={styles.saveTxt}>Guardar</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, guardarRutinaManual]); // <--- Array limpio


  /* 10. SectionList */
  const sections = useMemo(() => ejerciciosPorDia.map((ej, i) => ({
    title: `Día ${i + 1}`,
    data: ej,
  })), [ejerciciosPorDia]); // <--- Dependencia

  const handleToggleItem = useCallback((itemId) => {
    setOpenId(prevId => (prevId === itemId ? null : itemId));
  }, []);

  /* ─────────── UI ─────────── */
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Rutina #{id}</Text>

      <Text style={styles.label}>Día</Text>
      <Picker selectedValue={diaSel} onValueChange={setDiaSel} style={styles.picker}>
        {Array.from({ length: diasTotales }, (_, i) => (
          <Picker.Item key={i + 1} label={`Día ${i + 1}`} value={i + 1} />
        ))}
      </Picker>

      <Text style={styles.label}>Músculo</Text>
      <Picker selectedValue={musculo} onValueChange={setMusculo} style={styles.picker}>
        <Picker.Item label="Selecciona músculo..." value="" />
        {MUSCULOS.map(m => <Picker.Item key={m} label={m} value={m} />)}
      </Picker>

      <Text style={styles.label}>Nombre ejercicio</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Remo polea alta"
        value={nombre}
        onChangeText={setNombre}
      />

      <Text style={styles.label}>Nº series</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 4"
        keyboardType="numeric"
        value={nSeries}
        onChangeText={setNSeries}
      />

      <TouchableOpacity style={styles.addBtn} onPress={addEjercicio}>
        <Text style={styles.addTxt}>AÑADIR EJERCICIO</Text>
      </TouchableOpacity>

      <SectionList
        style={{ marginTop: 24 }}
        sections={sections}
        keyExtractor={it => it.id}
        renderItem={({ item }) => (
          <RenderItem
            item={item}
            isOpen={item.id === openId}
            onToggle={() => handleToggleItem(item.id)}
            onUpdateSerie={updateSerie}
          />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 20 }}>
            Sin ejercicios aún
          </Text>
        }
        stickySectionHeadersEnabled={false}
        extraData={openId} // <--- Importante para que sepa cuándo re-renderizar
      />
    </View>
  );
}

/* ─── Estilos ─── */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f4f4f4' },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  label: { marginTop: 12, fontWeight: 'bold' },
  picker: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, backgroundColor: '#fff' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginTop: 4, backgroundColor: '#fff' },
  addBtn: { marginTop: 16, backgroundColor: '#10b981', padding: 12, borderRadius: 8, alignItems: 'center' },
  addTxt: { color: '#fff', fontWeight: 'bold' },

  sectionHeader: { fontWeight: 'bold', fontSize: 16, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 12, elevation: 2 },
  cardHeader: { padding: 12, fontWeight: '600', fontSize: 15 },
  seriesBox: { paddingHorizontal: 12, paddingBottom: 10 },
  serieRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  serieLabel: { width: 60 },
  repInput: { width: 60, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 6, marginHorizontal: 4 },
  extraPicker: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 6 },

  saveBtn: { backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, marginRight: 8 },
  saveTxt: { color: '#fff', fontWeight: 'bold' },
});