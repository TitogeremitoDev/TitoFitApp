/* app/entreno/index.jsx --------------------------------------------------
   Pantalla principal de entrenamiento – v1.1
   -----------------------------------------------------------------------
   • Guarda Reps/Kg en AsyncStorage al instante (persisten al cerrar app).
   • KeyboardAvoidingView para que el teclado no tape las últimas series.
   • Muestra “¡SP!” si la semana previa superó repMax.
--------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

const { width } = Dimensions.get('window');
const ESTADOS     = ['C', 'NC', 'OJ'];
const SEMANAS_MAX = 12;

const EXTRA_ABBR = {
  Descendentes: 'DESC',
  'Mio Reps': 'MR',
  Parciales: 'PARC',
};

function getTrendIcon(curr, prev) {
  if (prev == null || curr == null || curr === '') return null;
  const c = Number(curr);
  const p = Number(prev);
  if (isNaN(c) || isNaN(p)) return null;
  if (c > p) return { name: 'arrow-up',   color: '#3b82f6' };
  if (c < p) return { name: 'arrow-down', color: '#ef4444' };
  return       { name: 'remove',    color: '#6b7280' };
}

/* ───────── reusable carousel ───────── */
function Carousel({ data, renderItem, onIndexChange }) {
  const listRef = useRef(null);
  const idxRef  = useRef(0);

  const move = (dir) => {
    let next = idxRef.current + dir;
    next = Math.max(0, Math.min(next, data.length - 1));
    idxRef.current = next;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    onIndexChange?.(next);
  };

  return (
    <View style={styles.carouselWrap}>
      <TouchableOpacity style={styles.arrowLeft} onPress={() => move(-1)}>
        <Text style={styles.arrowTxt}>‹</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={data}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(ev) => {
          const i = Math.round(ev.nativeEvent.contentOffset.x / width);
          idxRef.current = i;
          onIndexChange?.(i);
        }}
      />

      <TouchableOpacity style={styles.arrowRight} onPress={() => move(1)}>
        <Text style={styles.arrowTxt}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

function WeeksCarousel({ selected, onChange, onExport }) {
  const data = Array.from({ length: SEMANAS_MAX }, (_, i) => i + 1);
  return (
    <View>
      <Carousel
        data={data}
        onIndexChange={(i) => onChange(i + 1)}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={[styles.bigLabel, selected === item && styles.bigLabelSel]}>
              Semana {item}
            </Text>
          </View>
        )}
      />
      <TouchableOpacity style={styles.exportBtn} onPress={onExport}>
        <Ionicons name="download-outline" size={16} color="#fff" />
        <Text style={styles.exportTxt}>Excel Semana</Text>
      </TouchableOpacity>
    </View>
  );
}

function DaysCarousel({ total, selected, onChange }) {
  const data = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <Carousel
      data={data}
      onIndexChange={onChange}
      renderItem={({ item }) => (
        <View style={styles.slide}>
          <Text style={[styles.bigLabel, selected === item - 1 && styles.bigLabelSel]}>
            Día {item}
          </Text>
        </View>
      )}
    />
  );
}

/* ───────── main component ───────── */
export default function Entreno() {
  const [rutina, setRutina] = useState(null);
  const [diasEj, setDiasEj] = useState([]);
  const [semana, setSemana] = useState(1);
  const [diaIdx, setDiaIdx] = useState(0);
  const [prog, setProg]     = useState({});
  const [openId, setOpenId] = useState(null);

  /* cargar rutina + progreso */
  useEffect(() => {
    (async () => {
      const [[, idAct], [, listJSON]] = await AsyncStorage.multiGet(
        ['active_routine', 'rutinas']
      );
      if (!idAct) {
        Alert.alert('Sin rutina activa', 'Selecciona una rutina en Rutinas');
        return;
      }
      const lista   = JSON.parse(listJSON || '[]');
      const activa  = lista.find((r) => r.id === idAct);
      const stored  = await AsyncStorage.getItem(`routine_${idAct}`);
      const progStr = await AsyncStorage.getItem('progress');
      setRutina(activa);
      setDiasEj(JSON.parse(stored || '[]'));
      setProg(JSON.parse(progStr || '{}'));
    })();
  }, []);

  /* helpers */
  const setEstadoEj = async (clave, val) => {
    const next = { ...prog, [clave]: val };
    setProg(next);
    await AsyncStorage.setItem('progress', JSON.stringify(next));
  };

  const setSerieDato = async (serieKey, campo, val) => {
    const next = {
      ...prog,
      [serieKey]: { ...(prog[serieKey] || {}), [campo]: val },
    };
    setProg(next);
    await AsyncStorage.setItem('progress', JSON.stringify(next));
  };

  const findPrev = (week, d, eId, sIdx, field) => {
    for (let w = week - 1; w > 0; w--) {
      const key = `${w}|${d}|${eId}|${sIdx}`;
      const data = prog[key]?.[field];
      if (data) return data;
    }
    return null;
  };

  /* exportar Excel (sin cambios respecto a v1.0) */
  const exportWeekToExcel = async () => {
    try {
      if (!rutina) return;
      const wsData = [];

      for (let dIdx = 0; dIdx < rutina.dias; dIdx++) {
        wsData.push([`DÍA ${dIdx + 1}`]);
        wsData.push(['NOMBRE', 'REPS', 'CARGA']);

        const ejercicios = (diasEj[dIdx] || []).filter(Boolean);
        if (ejercicios.length === 0) {
          wsData.push(['', '', '']);
          wsData.push([]);
          continue;
        }

        ejercicios.forEach((ej) => {
          wsData.push([`${ej.musculo} — ${ej.nombre}`, '', '']);
          ej.series.forEach((_, sIdx) => {
            const key = `${semana}|${dIdx}|${ej.id}|${sIdx}`;
            const d   = prog[key] || {};
            wsData.push(['', d.reps ?? '', d.peso ?? '']);
          });
          wsData.push([]);
        });
        wsData.push([]);
      }

      const wb  = XLSX.utils.book_new();
      const ws  = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, `Semana_${semana}`);
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileUri = FileSystem.documentDirectory + `semana-${semana}.xlsx`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: `Progreso semana ${semana}`,
        });
      } else {
        Alert.alert('Archivo guardado', fileUri);
      }
    } catch (err) {
      console.warn('Export error', err);
      Alert.alert('Error', 'No se pudo generar el Excel');
    }
  };

  if (!rutina) return <View style={styles.container} />;

  const ejerciciosDia = (diasEj[diaIdx] || []).filter(Boolean);

  /* ───────── render ───────── */
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>{rutina.nombre}</Text>

        <WeeksCarousel
          selected={semana}
          onChange={setSemana}
          onExport={exportWeekToExcel}
        />
        <DaysCarousel
          total={rutina.dias}
          selected={diaIdx}
          onChange={setDiaIdx}
        />

        <FlatList
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          style={{ marginTop: 12 }}
          data={ejerciciosDia}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => {
            if (!item) return null;

            const ejerKey = `${semana}|${diaIdx}|${item.id}`;
            const abierto = openId === item.id;

            return (
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => setOpenId(abierto ? null : item.id)}
                >
                  <Text style={styles.cardTxt}>
                    {item.musculo} — {item.nombre}
                  </Text>
                  <Ionicons
                    name={abierto ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#374151"
                  />
                </TouchableOpacity>

                <View style={styles.radioRow}>
                  {ESTADOS.map((e) => (
                    <TouchableOpacity
                      key={e}
                      style={[
                        styles.radio,
                        prog[ejerKey] === e && styles.radioSel,
                      ]}
                      onPress={() => setEstadoEj(ejerKey, e)}
                    >
                      <Text
                        style={[
                          styles.radioTxt,
                          prog[ejerKey] === e && styles.radioTxtSel,
                        ]}
                      >
                        {e}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {abierto && (
                  <View style={styles.seriesBox}>
                    <View style={styles.serieRowHeader}>
                      <Text style={[styles.serieLabel, { fontWeight: 'bold' }]}>
                        #
                      </Text>
                      <View style={styles.inputCol}>
                        <Text style={styles.colLabel}>Reps</Text>
                      </View>
                      <View style={styles.inputCol}>
                        <Text style={styles.colLabel}>Kg</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                    </View>

                    {item.series.map((serie, idx) => {
                      const serieKey = `${ejerKey}|${idx}`;
                      const prevReps = findPrev(
                        semana,
                        diaIdx,
                        item.id,
                        idx,
                        'reps'
                      );
                      const prevKg = findPrev(
                        semana,
                        diaIdx,
                        item.id,
                        idx,
                        'peso'
                      );
                      const curr = prog[serieKey] || {};

                      /* Color fila */
                      let bgColor = '#fff';
                      const repMin = serie.repMin ? Number(serie.repMin) : null;
                      const repMax = serie.repMax ? Number(serie.repMax) : null;
                      const reps = curr.reps ? Number(curr.reps) : null;
                      if (
                        reps !== null &&
                        repMin !== null &&
                        repMax !== null
                      ) {
                        if (reps < repMin) bgColor = '#fecaca';
                        else if (reps > repMax) bgColor = '#bfdbfe';
                        else bgColor = '#bbf7d0';
                      }

                      /* Flag SP */
                      const prevExceeded =
                        prevReps !== null &&
                        repMax !== null &&
                        Number(prevReps) > repMax;

                      const iconReps = getTrendIcon(curr.reps, prevReps);
                      const iconKg = getTrendIcon(curr.peso, prevKg);

                      return (
                        <View
                          key={idx}
                          style={[styles.serieRow, { backgroundColor: bgColor }]}
                        >
                          <Text style={styles.serieLabel}>
                            Serie {idx + 1}
                          </Text>

                          {/* Reps */}
                          <View style={styles.inputWithTrend}>
                            <TextInput
                              style={styles.serieInput}
                              placeholder={prevReps ? String(prevReps) : ''}
                              keyboardType="numeric"
                              value={curr.reps || ''}
                              onChangeText={(v) =>
                                setSerieDato(serieKey, 'reps', v)
                              }
                            />
                            {iconReps && (
                              <Ionicons
                                name={iconReps.name}
                                size={14}
                                color={iconReps.color}
                                style={styles.trendIcon}
                              />
                            )}
                          </View>

                          {/* Kg */}
                          <View style={styles.inputWithTrend}>
                            <TextInput
                              style={styles.serieInput}
                              placeholder={prevKg ? String(prevKg) : ''}
                              keyboardType="numeric"
                              value={curr.peso || ''}
                              onChangeText={(v) =>
                                setSerieDato(serieKey, 'peso', v)
                              }
                            />
                            {iconKg && (
                              <Ionicons
                                name={iconKg.name}
                                size={14}
                                color={iconKg.color}
                                style={styles.trendIcon}
                              />
                            )}
                          </View>

                          {/* SP flag */}
                          {prevExceeded && (
                            <Text style={styles.sp}>¡SP!</Text>
                          )}

                          <Text style={styles.extraTxt}>
                            {EXTRA_ABBR[serie.extra] || ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center' }}>Sin ejercicios</Text>
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/* ───────── styles ───────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  carouselWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#d1d5db',
    borderWidth: 3,
    borderRadius: 8,
    marginBottom: 10,
  },
  slide: { width, alignItems: 'center', justifyContent: 'center' },
  bigLabel: { fontSize: 18, color: '#374151' },
  bigLabelSel: { color: '#3b82f6', fontWeight: 'bold' },
  arrowLeft: { position: 'absolute', left: 10, top: '40%', zIndex: 10 },
  arrowRight: { position: 'absolute', right: 10, top: '40%', zIndex: 10 },
  arrowTxt: { fontSize: 32, color: '#374151' },

  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 6,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  exportTxt: { color: '#fff', fontSize: 12, marginLeft: 4 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
    borderWidth: 0.6,
    borderColor: '#e5e7eb',
    paddingBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 0.6,
    borderColor: '#e5e7eb',
  },
  cardTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },

  radioRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  radio: {
    borderWidth: 1,
    borderColor: '#9ca3af',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  radioSel: { backgroundColor: '#10b981', borderColor: '#10b981' },
  radioTxt: { fontSize: 11, fontWeight: 'bold' },
  radioTxtSel: { color: '#fff' },

  seriesBox: { marginTop: 8 },
  serieRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 10,
  },
  colLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  serieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.6,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  serieLabel: { width: 70, fontSize: 12 },
  inputCol: { width: 60, alignItems: 'center' },
  inputWithTrend: {
    width: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendIcon: { position: 'absolute', right: -18 },
  serieInput: {
    width: 60,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: '#fff',
  },
  extraTxt: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  sp: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
    marginLeft: 6,
  },
});
