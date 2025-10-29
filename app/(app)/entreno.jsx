/* app/entreno/index.jsx
────────────────────────────────────────────────────────────────────────────
Pantalla principal de entrenamiento — v1.5 (estilo corregido solapamientos)
──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState ,useCallback} from 'react';
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
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import Stopwatch from '../../components/Stopwatch';

const { width } = Dimensions.get('window');
const ARROW_W = 56;
const ESTADOS = ['C', 'NC', 'OJ'];
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
  if (c > p) return { name: 'arrow-up', color: '#3b82f6' };
  if (c < p) return { name: 'arrow-down', color: '#ef4444' };
  return { name: 'remove', color: '#6b7280' };
}

/* ───────── Carrusel reutilizable ───────── */
function Carousel({ data, renderItem, onIndexChange, initialIndex = 0 }) {
  const listRef = useRef(null);
  const validInitialIndex = Math.max(0, Math.min(initialIndex, data.length - 1));
  const idxRef = useRef(validInitialIndex);

  const [wrapW, setWrapW] = useState(Dimensions.get('window').width);
  const SLIDE_W = Math.max(1, wrapW - ARROW_W * 2);

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Move the carousel to the next or previous item.
 * @param {number} dir -1 to move to the previous item, 1 to move to the next item.
 */
/*******  03de15ad-04e8-4d8b-8ce4-7f93d7ef6602  *******/  const move = (dir) => {
    let next = idxRef.current + dir;
    next = Math.max(0, Math.min(next, data.length - 1));
    idxRef.current = next;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    onIndexChange?.(next);
  };

  return (
    <View
      style={styles.carouselWrap}
      onLayout={(e) => setWrapW(e.nativeEvent.layout.width)}
    >
      <Pressable
        onPress={() => move(-1)}
        android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
        hitSlop={12}
        style={({ pressed }) => [
          styles.arrowBtn,
          styles.arrowLeft,
          pressed && styles.arrowBtnPressed,
        ]}
      >
        <Text style={styles.arrowGlyph}>‹</Text>
      </Pressable>

      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(_, i) => String(i)}
        initialScrollIndex={idxRef.current}
        renderItem={(props) => (
          <View style={[styles.slide, { width: SLIDE_W }]}>
            {renderItem(props)}
          </View>
        )}
        getItemLayout={(_, i) => ({
          length: SLIDE_W,
          offset: SLIDE_W * i,
          index: i,
        })}
        onMomentumScrollEnd={(ev) => {
          const i = Math.round(
            ev.nativeEvent.contentOffset.x / (SLIDE_W || 1)
          );
          idxRef.current = i;
          onIndexChange?.(i);
        }} />

      <Pressable
        onPress={() => move(1)}
        android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
        hitSlop={12}
        style={({ pressed }) => [
          styles.arrowBtn,
          styles.arrowRight,
          pressed && styles.arrowBtnPressed,
        ]}
      >
        <Text style={styles.arrowGlyph}>›</Text>
      </Pressable>
    </View>
  );
}

function WeeksCarousel({ selected, onChange }) {
  const data = Array.from({ length: SEMANAS_MAX }, (_, i) => i + 1);
  return (
    <Carousel
      data={data}
      onIndexChange={(i) => onChange(i + 1)}
      initialIndex={selected - 1}
      renderItem={({ item }) => (
        <View style={styles.centerPill}>
          <Text
            style={[styles.bigLabel, selected === item && styles.bigLabelSel]}
          >
            Semana {item}
          </Text>
        </View>
      )}
    />
  );
}

function DaysCarousel({ total, selected, onChange }) {
  const data = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <Carousel
      data={data}
      onIndexChange={onChange}
      initialIndex={selected}
      renderItem={({ item }) => (
        <View style={styles.centerPill}>
          <Text
            style={[
              styles.bigLabel,
              selected === item - 1 && styles.bigLabelSel,
            ]}
          >
            Día {item}
          </Text>
        </View>
      )}
    />
  );
}

/* ───────── Componente principal ───────── */
export default function Entreno() {
  const [rutina, setRutina] = useState(null);
  const [diasEj, setDiasEj] = useState([]);
  const [semana, setSemana] = useState(1);
  const [diaIdx, setDiaIdx] = useState(0);
  const [prog, setProg] = useState({});
  const [openId, setOpenId] = useState(null);

  const listRef = useRef(null);

  useEffect(() => {
    (async () => {
      const [[, idAct], [, listJSON], [, progStr], [, sessionStr]] =
        await AsyncStorage.multiGet([
          'active_routine',
          'rutinas',
          'progress',
          'last_session',
        ]);

      if (!idAct) {
        Alert.alert('Sin rutina activa', 'Selecciona una rutina en Rutinas');
        return;
      }

      const lista = JSON.parse(listJSON || '[]');
      const activa = lista.find((r) => r.id === idAct);
      const stored = await AsyncStorage.getItem(`routine_${idAct}`);

      setRutina(activa);
      setDiasEj(JSON.parse(stored || '[]'));
      setProg(JSON.parse(progStr || '{}'));

      if (activa && sessionStr) {
        const { lastSemana, lastDiaIdx } = JSON.parse(sessionStr);
        if (
          lastSemana > 0 &&
          lastDiaIdx >= 0 &&
          lastDiaIdx < activa.dias
        ) {
          setSemana(lastSemana);
          setDiaIdx(lastDiaIdx);
        }
      }
    })();
  }, []);

  const setEstadoEj = async (clave, val, ejercicioCompleto) => {
    const nextProg = { ...prog, [clave]: val };
    setProg(nextProg);

    const sessionData = JSON.stringify({
      lastSemana: semana,
      lastDiaIdx: diaIdx,
    });

    let logEntriesToAdd = [];
    if (val === 'C' && ejercicioCompleto) {
      const now = new Date().toISOString();
      logEntriesToAdd = ejercicioCompleto.series.map((serie, idx) => {
        const serieKey = `${clave}|${idx}`;
        const datosSerie = prog[serieKey] || {};
        const reps = Number(datosSerie.reps) || 0;
        const load = Number(datosSerie.peso) || 0;
        const volume = reps * load;
        const e1RM = reps > 0 ? load * (1 + reps / 30) : 0;
        return {
          id: `${now}-${ejercicioCompleto.id}-${idx}`,
          date: now,
          routineName: rutina?.nombre || 'Rutina Desconocida',
          week: semana,
          muscle: ejercicioCompleto.musculo,
          exercise: ejercicioCompleto.nombre,
          setIndex: idx + 1,
          reps: reps,
          load: load,
          volume: volume,
          e1RM: e1RM,
        };
      });
    }

    try {
      await AsyncStorage.multiSet([
        ['progress', JSON.stringify(nextProg)],
        ['last_session', sessionData]
      ]);

      if (logEntriesToAdd.length > 0) {
        const currentLogJson = await AsyncStorage.getItem('GLOBAL_LOG');
        const currentLog = currentLogJson ? JSON.parse(currentLogJson) : [];
        const updatedLog = [...currentLog, ...logEntriesToAdd];
        await AsyncStorage.setItem('GLOBAL_LOG', JSON.stringify(updatedLog));
      }
    } catch (e) {
      console.warn('No se pudo guardar el estado, sesión o log', e);
    }
  };

  const setSerieDato = async (serieKey, campo, val) => {
    const nextProg = {
      ...prog,
      [serieKey]: { ...(prog[serieKey] || {}), [campo]: val },
    };
    setProg(nextProg);

    const sessionData = JSON.stringify({
      lastSemana: semana,
      lastDiaIdx: diaIdx,
    });

    try {
      await AsyncStorage.multiSet([
        ['progress', JSON.stringify(nextProg)],
        ['last_session', sessionData]
      ]);
    } catch (e) {
      console.warn('No se pudo guardar el dato de serie o la sesión', e);
    }
  };

  const findPrev = (week, d, eId, sIdx, field) => {
    for (let w = week - 1; w > 0; w--) {
      const key = `${w}|${d}|${eId}|${sIdx}`;
      const data = prog[key]?.[field];
      if (data) return data;
    }
    return null;
  };

  const exportWeekToExcel = async () => {
    try {
      if (!rutina) return;
      const wsData = [];

      for (let dIdx = 0; dIdx < rutina.dias; dIdx++) {
        const ejercicios = (diasEj[dIdx] || []).filter(Boolean);

        ejercicios.forEach((ej) => {
          wsData.push([`${ej.musculo} — ${ej.nombre}`, 'REPS', 'CARGA']);
          for (let sIdx = 0; sIdx < 5; sIdx++) {
            const key = `${semana}|${dIdx}|${ej.id}|${sIdx}`;
            const d = prog[key] || {};
            wsData.push(['', d.reps ?? '', d.peso ?? '']);
          }
        });

        if (dIdx < rutina.dias - 1) wsData.push([]);
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws, `Semana_${semana}`);
      const fileName = `semana-${semana}.xlsx`;

      if (Platform.OS === 'web') {
        XLSX.writeFile(wb, fileName);
      } else {
        const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const fileUri = FileSystem.documentDirectory + fileName;

        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: `Progreso semana ${semana}`,
          });
        } else {
          Alert.alert('Archivo guardado', fileUri);
        }
      }
    } catch (err) {
      console.warn('Export error', err);
      Alert.alert('Error', 'No se pudo generar el Excel');
    }
  };

  if (!rutina) return <View style={styles.container} />;

  const ejerciciosDia = (diasEj[diaIdx] || []).filter(Boolean);

  const listRefLocal = listRef;
  const bringCardIntoView = (idx) => {
    try {
      listRefLocal.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.3,
      });
    } catch { }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}        
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{rutina.nombre}</Text>

          <View style={styles.center}>
            <Stopwatch />
          </View>

          <TouchableOpacity
            style={styles.exportBtn}
            onPress={exportWeekToExcel}
            activeOpacity={0.85}
          >
            <Ionicons name="download-outline" size={16} color="#fff" />
            <Text style={styles.exportTxt}>Excel S</Text>
          </TouchableOpacity>
        </View>

        <WeeksCarousel selected={semana} onChange={setSemana} />
        <View style={{ height: 8 }} />
        <DaysCarousel total={rutina.dias} selected={diaIdx} onChange={setDiaIdx} />

        <FlatList
          ref={listRef}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          style={{ marginTop: 12 }}
          data={ejerciciosDia}
          keyExtractor={(it) => it.id}
          renderItem={({ item, index }) => {
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
                      onPress={() => setEstadoEj(ejerKey, e, item)}
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
                      const prevReps = findPrev(semana, diaIdx, item.id, idx, 'reps');
                      const prevKg = findPrev(semana, diaIdx, item.id, idx, 'peso');
                      const curr = prog[serieKey] || {};

                      let bgColor = '#fff';
                      const repMin = serie.repMin ? Number(serie.repMin) : null;
                      const repMax = serie.repMax ? Number(serie.repMax) : null;
                      const reps = curr.reps ? Number(curr.reps) : null;
                      if (reps !== null && repMin !== null && repMax !== null) {
                        if (reps < repMin) bgColor = '#fecaca';
                        else if (reps > repMax) bgColor = '#bfdbfe';
                        else bgColor = '#bbf7d0';
                      }

                      const prevExceeded = prevReps !== null && repMax !== null && Number(prevReps) > repMax;
                      const iconReps = getTrendIcon(curr.reps, prevReps);
                      const iconKg = getTrendIcon(curr.peso, prevKg);

                      return (
                        <View
                          key={idx}
                          style={[styles.serieRow, { backgroundColor: bgColor }]}
                        >
                          <Text style={styles.serieLabel}>Serie {idx + 1}</Text>

                          {/* Reps */}
                          <View style={styles.inputWithTrend}>
                            <TextInput
                              style={styles.serieInput}
                              placeholder={prevReps ? String(prevReps) : ''}
                              keyboardType="numeric"
                              value={curr.reps || ''}
                              onFocus={() => bringCardIntoView(index)}
                              onChangeText={(v) => setSerieDato(serieKey, 'reps', v)}
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
                              onFocus={() => bringCardIntoView(index)}
                              onChangeText={(v) => setSerieDato(serieKey, 'peso', v)}
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
                          {prevExceeded && (<Text style={styles.sp}>¡SP!</Text>)}

                          <Text style={styles.extraTxt}>{EXTRA_ABBR[serie.extra] || ''}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={{ textAlign: 'center' }}>Sin ejercicios</Text>}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/* ───────── styles ───────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa', padding: 16 },
headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 , zIndex: 10},

title: { flexShrink: 1, fontSize: 18, fontWeight: 'bold', marginRight: 10, maxWidth: '45%' },

center: {
  flexGrow: 1,            // ocupa el hueco central
  alignItems: 'center',   // centra horizontal
  justifyContent: 'center'
},

exportBtn: {
  marginLeft: 8,
  flexShrink: 0,          // que NO se expanda
  flexGrow: 0,            // que NO robe espacio
  flexBasis: 'auto',
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#3b82f6',
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 10,
  shadowColor: '#000',
  shadowOpacity: 0.15,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3
},

exportTxt: { color: '#fff', fontSize: 13, marginLeft: 6, fontWeight: '600' },


  carouselWrap: { position: 'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderColor: '#d1d5db', borderWidth: 3, borderRadius: 12, minHeight: 52, overflow: 'hidden', paddingHorizontal: ARROW_W, backgroundColor: '#f8fafc' },
  slide: { alignItems: 'center', justifyContent: 'center' },
  centerPill: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  bigLabel: { fontSize: 18, color: '#1f2937', fontWeight: '700' },
  bigLabelSel: { color: '#3b82f6' },
  arrowBtn: { position: 'absolute', top: 6, bottom: 6, width: ARROW_W, borderRadius: 10, backgroundColor: '#F2EAD9', borderWidth: 1, borderColor: '#e6d9bf', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  arrowLeft: { left: 6 },
  arrowRight: { right: 6 },
  arrowBtnPressed: { transform: [{ translateY: 1 }], shadowOpacity: 0.05, elevation: 1 },
  arrowGlyph: { fontSize: 20, fontWeight: '700', color: '#374151' },

  card: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 12, elevation: 2, borderWidth: 0.6, borderColor: '#e5e7eb', paddingBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: 0.6, borderColor: '#e5e7eb' },
  cardTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },

  radioRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, marginTop: 6 },
  radio: { borderWidth: 1, borderColor: '#9ca3af', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10 },
  radioSel: { backgroundColor: '#10b981', borderColor: '#10b981' },
  radioTxt: { fontSize: 11, fontWeight: 'bold' },
  radioTxtSel: { color: '#fff' },

  seriesBox: { marginTop: 8 },
  serieRowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 10 },
  colLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },

  /* Fila de series */
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
  serieLabel: { width: 70, fontSize: 12, flexShrink: 0 },

  /* Cabeceras de columna */
  inputCol: { width: 60, alignItems: 'center' },

  /* >>> FIX solapamientos */
  inputWithTrend: {
    position: 'relative',
    width: 90,            // 60 de input + 24 de icono + margen
    paddingRight: 22,     // reserva para el icono
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginRight: 0,
    flexShrink: 0,        // no permitir que se comprima y solape
  },
  trendIcon: {
    position: 'absolute',
    right: 10,             // dentro del paddingRight reservado
    top: '50%',
    transform: [{ translateY: -7 }],
  },
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
  /* <<< FIX solapamientos */

  extraTxt: { marginLeft: 'auto', fontSize: 12, fontWeight: '600', color: '#374151' },
  sp: { marginLeft: 8, fontSize: 12, fontWeight: '700', color: '#1e40af', flexShrink: 0 },
});
