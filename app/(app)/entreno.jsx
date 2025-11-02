/* app/entreno/index.jsx
────────────────────────────────────────────────────────────────────────────
Pantalla principal de entrenamiento — v2.1
- Última sesión por RUTINA (last_session_<id>), rehidratación al foco.
- Carruseles corrigidos anti-NaN y claves re-montables tras hidratar.
- Estados: C / NC / OE (compat con datos antiguos "OJ").
- Botones extra por ejercicio:
  • TC: Modal con Técnica Correcta desde exercises.json.
  • Vídeo: Modal con reproductor YouTube (react-native-youtube-iframe).
- Búsqueda robusta por músculo + nombre (tolerante a tildes/puntuación).
──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
  Modal,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import YoutubeIframe from 'react-native-youtube-iframe';
import Stopwatch from '../../components/Stopwatch';

// ⚠️ Ajusta la ruta si tu JSON cambia de sitio:
import rawDB from '../../src/data/exercises.json';

const { width } = Dimensions.get('window');
const ARROW_W = 56;
const ESTADOS = ['C', 'NC', 'OE']; // ← OJ → OE
const SEMANAS_MAX = 12;

const EXTRA_ABBR = {
  Descendentes: 'DESC',
  'Mio Reps': 'MR',
  Parciales: 'PARC',
};

const sessionKeyFor = (routineId) => `last_session_${routineId || 'global'}`;

function getTrendIcon(curr, prev) {
  if (prev == null || curr == null || curr === '') return null;
  const c = Number(curr);
  const p = Number(prev);
  if (isNaN(c) || isNaN(p)) return null;
  if (c > p) return { name: 'arrow-up', color: '#3b82f6' };
  if (c < p) return { name: 'arrow-down', color: '#ef4444' };
  return { name: 'remove', color: '#6b7280' };
}

/* ───────── Normalización de rutina guardada ───────── */
/** Convierte {dia1:[], dia2:[]} o [][] a [][] siempre ordenado por día */
function normalizeDias(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((d) => (Array.isArray(d) ? d : []));
  }
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

/* ───────── Index de ejercicios (por músculo y nombre) ───────── */
const normalizeStr = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tildes
    .replace(/[^a-z0-9 ]+/g, '') // símbolos
    .replace(/\s+/g, ' ')
    .trim();

function buildExerciseIndex(db) {
  // Estructura: { MUSCULO: { byName: {originalName: obj}, byNorm: {normName: obj} } }
  const out = {};
  for (const grupo of db || []) {
    const mus = String(grupo?.musculo || '').trim();
    if (!mus) continue;
    if (!out[mus]) out[mus] = { byName: {}, byNorm: {} };
    for (const ej of grupo?.ejercicios || []) {
      const name = String(ej?.nombre || '').trim();
      if (!name) continue;
      out[mus].byName[name] = ej;
      out[mus].byNorm[normalizeStr(name)] = ej;
    }
  }
  return out;
}
const EX_INDEX = buildExerciseIndex(rawDB);

function findExercise(musculo, nombre) {
  const group = EX_INDEX[String(musculo || '').trim()];
  if (!group) {
    // Fallback: buscar por nombre en TODOS los músculos si el músculo no cuadra
    const norm = normalizeStr(nombre);
    for (const mus of Object.keys(EX_INDEX)) {
      const g = EX_INDEX[mus];
      if (g.byName[nombre]) return g.byName[nombre];
      if (g.byNorm[norm]) return g.byNorm[norm];
    }
    return null;
  }
  // 1) exacto
  if (group.byName[nombre]) return group.byName[nombre];
  // 2) normalizado
  const norm = normalizeStr(nombre);
  if (group.byNorm[norm]) return group.byNorm[norm];
  // 3) incluye/contiene (búsqueda tolerante)
  const candidates = Object.keys(group.byNorm);
  const hit = candidates.find((k) => k.includes(norm) || norm.includes(k));
  return hit ? group.byNorm[hit] : null;
}

/* ───────── Carrusel reutilizable ───────── */
function Carousel({ data, renderItem, onIndexChange, initialIndex = 0 }) {
  const listRef = useRef(null);
  const [wrapW, setWrapW] = useState(Dimensions.get('window').width);
  const SLIDE_W = Math.max(1, wrapW - ARROW_W * 2);

  const safeInitial = Math.max(0, Math.min(initialIndex, Math.max(0, data.length - 1)));
  const idxRef = useRef(safeInitial);

  const move = (dir) => {
    let next = idxRef.current + dir;
    next = Math.max(0, Math.min(next, Math.max(0, data.length - 1)));
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
          <View style={[styles.slide, { width: SLIDE_W }]}>{renderItem(props)}</View>
        )}
        getItemLayout={(_, i) => ({
          length: SLIDE_W,
          offset: SLIDE_W * i,
          index: i,
        })}
        onMomentumScrollEnd={(ev) => {
          const i = Math.round(ev.nativeEvent.contentOffset.x / (SLIDE_W || 1));
          const clamped = Math.max(0, Math.min(i, Math.max(0, data.length - 1)));
          idxRef.current = clamped;
          onIndexChange?.(clamped);
        }}
      />

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
      key={`weeks-${selected ?? 1}`}
      data={data}
      onIndexChange={(i) => onChange(i + 1)}
      initialIndex={Math.max(0, (selected || 1) - 1)}
      renderItem={({ item }) => (
        <View style={styles.centerPill}>
          <Text style={[styles.bigLabel, selected === item && styles.bigLabelSel]}>
            Semana {item}
          </Text>
        </View>
      )}
    />
  );
}

function DaysCarousel({ total, selected, onChange }) {
  const safeTotal =
    Math.max(1, Number.isFinite(Number(total)) ? Number(total) : 0) || 1;
  const data = Array.from({ length: safeTotal }, (_, i) => i + 1);
  const safeSelected = Math.max(0, Math.min(selected || 0, safeTotal - 1));

  return (
    <Carousel
      key={`days-${safeSelected}-${safeTotal}`}
      data={data}
      onIndexChange={onChange}
      initialIndex={safeSelected}
      renderItem={({ item }) => (
        <View style={styles.centerPill}>
          <Text style={[styles.bigLabel, safeSelected === item - 1 && styles.bigLabelSel]}>
            Día {item}
          </Text>
        </View>
      )}
    />
  );
}

/* ───────── Componente principal ───────── */
export default function Entreno() {
  const [activeId, setActiveId] = useState(null);  // rutina activa
  const [hydrated, setHydrated] = useState(false); // ya cargamos última sesión
  const [rutina, setRutina] = useState(null);
  const [diasEj, setDiasEj] = useState([]); // siempre [][] tras normalizar
  const [semana, setSemana] = useState(1);
  const [diaIdx, setDiaIdx] = useState(0);
  const [prog, setProg] = useState({});
  const [openId, setOpenId] = useState(null);

  // Modales de Técnica y Vídeo
  const [techModal, setTechModal] = useState({ visible: false, title: '', tips: [] });
  const [videoModal, setVideoModal] = useState({ visible: false, videoId: null, playing: false });

  const listRef = useRef(null);

  /* Guardado de última sesión (semana/día) — por RUTINA */
  const saveLastSession = useCallback(
    async (w, d) => {
      if (!activeId || !hydrated) return; // no escribas hasta hidratar y conocer rutina
      try {
        const lastSemana = Math.max(1, Number(w) || 1);
        const lastDiaIdx = Math.max(0, Number(d) || 0);
        await AsyncStorage.setItem(
          sessionKeyFor(activeId),
          JSON.stringify({ lastSemana, lastDiaIdx, updatedAt: Date.now() })
        );
      } catch {}
    },
    [activeId, hydrated]
  );

  /* Hidratar todo (rutina activa, días, progreso y última sesión) */
  const hydrate = useCallback(async () => {
    const result = await AsyncStorage.multiGet([
      'active_routine',
      'rutinas',
      'progress',
    ]);

    const idAct = result[0]?.[1] || null;
    setActiveId(idAct);

    const listJSON = result[1]?.[1] || '[]';
    const progStr = result[2]?.[1] || '{}';

    if (!idAct) {
      Alert.alert('Sin rutina activa', 'Selecciona una rutina en Rutinas');
      setHydrated(true);
      return;
    }

    const lista = JSON.parse(listJSON || '[]');
    const activa = lista.find((r) => r && r.id === idAct) || null;
    const stored = await AsyncStorage.getItem(`routine_${idAct}`);

    const diasNorm = normalizeDias(stored ? JSON.parse(stored) : []);
    const metaBase = activa || { id: idAct, nombre: 'Rutina' };

    setRutina({ ...metaBase, dias: diasNorm.length || 1 });
    setDiasEj(diasNorm);
    setProg(JSON.parse(progStr || '{}'));

    try {
      const sessionStr = await AsyncStorage.getItem(sessionKeyFor(idAct));
      if (sessionStr) {
        const { lastSemana, lastDiaIdx } = JSON.parse(sessionStr);
        const total = diasNorm.length || 1;
        const safeDia = Math.max(0, Math.min(Number(lastDiaIdx) || 0, total - 1));
        const safeSem = Math.max(1, Math.min(Number(lastSemana) || 1, SEMANAS_MAX));
        setSemana(safeSem);
        setDiaIdx(safeDia);
      } else {
        setSemana(1);
        setDiaIdx(0);
      }
    } catch {}

    setHydrated(true);
  }, []);

  // Al montar
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Cada vez que la pantalla vuelve a foco
  useFocusEffect(
    useCallback(() => {
      hydrate();
    }, [hydrate])
  );

  // Re-clamp cuando cambie el nº de días y persistir la posición (ya hidratados)
  const totalDias = useMemo(() => {
    const metaDias = Number(rutina?.dias);
    if (Number.isFinite(metaDias) && metaDias > 0) return metaDias;
    return Array.isArray(diasEj) ? Math.max(1, diasEj.length) : 1;
  }, [rutina, diasEj]);

  useEffect(() => {
    if (!hydrated) return;
    if (diaIdx > totalDias - 1) {
      const newIdx = Math.max(0, totalDias - 1);
      setDiaIdx(newIdx);
      saveLastSession(semana, newIdx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDias, hydrated]);

  // Persistir última sesión ante cambios (solo cuando ya cargamos sesión previa)
  useEffect(() => {
    if (!hydrated) return;
    saveLastSession(semana, diaIdx);
  }, [semana, diaIdx, hydrated, saveLastSession]);

  const setEstadoEj = async (clave, val, ejercicioCompleto) => {
    // Compat: si tenías "OJ" guardado, lo tratamos como "OE" a partir de ahora
    const nextVal = val === 'OJ' ? 'OE' : val;

    const nextProg = { ...prog, [clave]: nextVal };
    setProg(nextProg);

    // Persistimos también la última sesión por rutina (si hidratados)
    if (activeId) {
      const sessionData = JSON.stringify({
        lastSemana: semana,
        lastDiaIdx: diaIdx,
        updatedAt: Date.now(),
      });
      try {
        await AsyncStorage.multiSet([
          ['progress', JSON.stringify(nextProg)],
          [sessionKeyFor(activeId), sessionData],
        ]);
      } catch (e) {
        console.warn('No se pudo guardar el estado/sesión', e);
      }
    } else {
      try {
        await AsyncStorage.setItem('progress', JSON.stringify(nextProg));
      } catch {}
    }

    // Log global al marcar 'C'
    if (nextVal === 'C' && ejercicioCompleto) {
      try {
        const now = new Date().toISOString();
        const logEntriesToAdd = (ejercicioCompleto.series || []).map((serie, idx) => {
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
            reps,
            load,
            volume,
            e1RM,
          };
        });

        const currentLogJson = await AsyncStorage.getItem('GLOBAL_LOG');
        const currentLog = currentLogJson ? JSON.parse(currentLogJson) : [];
        const updatedLog = [...currentLog, ...logEntriesToAdd];
        await AsyncStorage.setItem('GLOBAL_LOG', JSON.stringify(updatedLog));
      } catch (e) {
        console.warn('No se pudo añadir al GLOBAL_LOG', e);
      }
    }
  };

  const setSerieDato = async (serieKey, campo, val) => {
    const nextProg = {
      ...prog,
      [serieKey]: { ...(prog[serieKey] || {}), [campo]: val },
    };
    setProg(nextProg);

    if (activeId) {
      const sessionData = JSON.stringify({
        lastSemana: semana,
        lastDiaIdx: diaIdx,
        updatedAt: Date.now(),
      });

      try {
        await AsyncStorage.multiSet([
          ['progress', JSON.stringify(nextProg)],
          [sessionKeyFor(activeId), sessionData],
        ]);
      } catch (e) {
        console.warn('No se pudo guardar el dato de serie o la sesión', e);
      }
    } else {
      try {
        await AsyncStorage.setItem('progress', JSON.stringify(nextProg));
      } catch {}
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

      for (let dIdx = 0; dIdx < totalDias; dIdx++) {
        const ejercicios = (diasEj[dIdx] || []).filter(Boolean);

        ejercicios.forEach((ej) => {
          wsData.push([`${ej.musculo} — ${ej.nombre}`, 'REPS', 'CARGA']);
          const sets = Array.isArray(ej.series) ? ej.series.length : 0;
          const maxSets = Math.max(sets, 5);
          for (let sIdx = 0; sIdx < maxSets; sIdx++) {
            const key = `${semana}|${dIdx}|${ej.id}|${sIdx}`;
            const d = prog[key] || {};
            wsData.push(['', d.reps ?? '', d.peso ?? '']);
          }
        });

        if (dIdx < totalDias - 1) wsData.push([]);
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

  const bringCardIntoView = (idx) => {
    try {
      listRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.3,
      });
    } catch {}
  };

  // Abrir Técnica Correcta (TC)
  const onOpenTC = (item) => {
    const ej = findExercise(item.musculo, item.nombre);
    if (!ej || !Array.isArray(ej.tecnicaCorrecta) || ej.tecnicaCorrecta.length === 0) {
      Alert.alert('Técnica no disponible', 'No hay técnica registrada para este ejercicio.');
      return;
    }
    setTechModal({ visible: true, title: item.nombre, tips: ej.tecnicaCorrecta });
  };

  // Abrir Vídeo
  const onOpenVideo = (item) => {
    const ej = findExercise(item.musculo, item.nombre);
    const id = ej?.videoId?.trim();
    if (!id) {
      Alert.alert('Vídeo no disponible', 'No hay vídeo asignado a este ejercicio.');
      return;
    }
    setVideoModal({ visible: true, videoId: id, playing: true });
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

        {/* Carruseles */}
        <WeeksCarousel
          selected={semana}
          onChange={(w) => {
            setSemana(w);
            if (hydrated) saveLastSession(w, diaIdx);
          }}
        />
        <View style={{ height: 8 }} />
        <DaysCarousel
          total={totalDias}
          selected={diaIdx}
          onChange={(d) => {
            setDiaIdx(d);
            if (hydrated) saveLastSession(semana, d);
          }}
        />

        <FlatList
          ref={listRef}
          contentContainerStyle={{ paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
          style={{ marginTop: 12 }}
          data={ejerciciosDia}
          keyExtractor={(it, i) => (it?.id ? String(it.id) : `idx-${i}`)}
          renderItem={({ item, index }) => {
            if (!item) return null;

            const ejerKey = `${semana}|${diaIdx}|${item.id}`;
            const abierto = openId === item.id;

            // Compat visual con datos antiguos "OJ" -> se muestra como OE
            const currentState = prog[ejerKey] === 'OJ' ? 'OE' : prog[ejerKey];

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

                {/* Estados + Herramientas (TC/Vídeo) */}
                <View style={styles.stateToolsRow}>
                  <View style={styles.stateRow}>
                    {ESTADOS.map((e) => (
                      <TouchableOpacity
                        key={e}
                        style={[styles.radio, currentState === e && styles.radioSel]}
                        onPress={() => setEstadoEj(ejerKey, e, item)}
                      >
                        <Text
                          style={[
                            styles.radioTxt,
                            currentState === e && styles.radioTxtSel,
                          ]}
                        >
                          {e}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.toolsRow}>
                    <TouchableOpacity
                      onPress={() => onOpenTC(item)}
                      style={styles.toolBtn}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.toolBtnTxt}>TC</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => onOpenVideo(item)}
                      style={[styles.toolBtn, styles.toolBtnIcon]}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="videocam-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>

                {abierto && (
                  <View style={styles.seriesBox}>
                    <View style={styles.serieRowHeader}>
                      <Text style={[styles.serieLabel, { fontWeight: 'bold' }]}>#</Text>
                      <View style={styles.inputCol}>
                        <Text style={styles.colLabel}>Reps</Text>
                      </View>
                      <View style={styles.inputCol}>
                        <Text style={styles.colLabel}>Kg</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                    </View>

                    {(item.series || []).map((serie, idx) => {
                      const serieKey = `${ejerKey}|${idx}`;
                      const prevReps = findPrev(semana, diaIdx, item.id, idx, 'reps');
                      const prevKg = findPrev(semana, diaIdx, item.id, idx, 'peso');
                      const curr = prog[serieKey] || {};

                      let bgColor = '#fff';
                      const repMin = serie?.repMin != null ? Number(serie.repMin) : null;
                      const repMax = serie?.repMax != null ? Number(serie.repMax) : null;
                      const reps = curr?.reps != null ? Number(curr.reps) : null;
                      if (reps !== null && repMin !== null && repMax !== null) {
                        if (reps < repMin) bgColor = '#fecaca';
                        else if (reps > repMax) bgColor = '#bfdbfe';
                        else bgColor = '#bbf7d0';
                      }

                      const prevExceeded =
                        prevReps !== null && repMax !== null && Number(prevReps) > repMax;
                      const iconReps = getTrendIcon(curr.reps, prevReps);
                      const iconKg = getTrendIcon(curr.peso, prevKg);

                      return (
                        <View key={idx} style={[styles.serieRow, { backgroundColor: bgColor }]}>
                          <Text style={styles.serieLabel}>Serie {idx + 1}</Text>

                          {/* Reps */}
                          <View style={styles.inputWithTrend}>
                            <TextInput
                              style={styles.serieInput}
                              placeholder={prevReps ? String(prevReps) : ''}
                              keyboardType="numeric"
                              value={curr.reps || ''}
                              onFocus={() => {
                                try {
                                  listRef.current?.scrollToIndex({
                                    index,
                                    animated: true,
                                    viewPosition: 0.3,
                                  });
                                } catch {}
                              }}
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
                          {prevExceeded && <Text style={styles.sp}>¡SP!</Text>}

                          <Text style={styles.extraTxt}>{EXTRA_ABBR[serie?.extra] || ''}</Text>
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

      {/* Modal Técnica Correcta */}
      <Modal
        visible={techModal.visible}
        transparent
        animationType={Platform.OS === 'android' ? 'slide' : 'fade'}
        onRequestClose={() => setTechModal((s) => ({ ...s, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable
              onPress={() => setTechModal((s) => ({ ...s, visible: false }))}
              style={styles.modalClose}
            >
              <Ionicons name="close-outline" size={24} color="#fff" />
            </Pressable>

            <Text style={styles.modalTitle}>Técnica: {techModal.title}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {(techModal.tips || []).map((t, i) => (
                <View key={i} style={styles.tipRow}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>{t}</Text>
                </View>
              ))}
              {!techModal.tips?.length && (
                <Text style={styles.tipText}>No hay detalles de técnica.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Vídeo */}
      <Modal
        visible={videoModal.visible}
        transparent
        animationType={Platform.OS === 'android' ? 'slide' : 'fade'}
        onRequestClose={() =>
          setVideoModal((s) => ({ ...s, visible: false, playing: false }))
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.videoCard}>
            <Pressable
              onPress={() =>
                setVideoModal((s) => ({ ...s, visible: false, playing: false }))
              }
              style={styles.modalClose}
            >
              <Ionicons name="close-outline" size={24} color="#fff" />
            </Pressable>
            {videoModal.videoId ? (
              <YoutubeIframe
                height={(Dimensions.get('window').width * 9) / 16}
                width={Dimensions.get('window').width * 0.9}
                play={videoModal.playing}
                videoId={videoModal.videoId}
                onChangeState={(st) => {
                  if (st === 'ended' || st === 'error') {
                    setVideoModal((s) => ({ ...s, playing: false, visible: false }));
                  }
                }}
              />
            ) : (
              <Text style={{ color: '#fff' }}>Vídeo no disponible</Text>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ───────── styles ───────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa', padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, zIndex: 10 },
  title: { flexShrink: 1, fontSize: 18, fontWeight: 'bold', marginRight: 10, maxWidth: '45%' },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  exportBtn: {
    marginLeft: 8,
    flexShrink: 0,
    flexGrow: 0,
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
    elevation: 3,
  },
  exportTxt: { color: '#fff', fontSize: 13, marginLeft: 6, fontWeight: '600' },

  carouselWrap: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#d1d5db',
    borderWidth: 3,
    borderRadius: 12,
    minHeight: 52,
    overflow: 'hidden',
    paddingHorizontal: ARROW_W,
    backgroundColor: '#f8fafc',
  },
  slide: { alignItems: 'center', justifyContent: 'center' },
  centerPill: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  bigLabel: { fontSize: 18, color: '#1f2937', fontWeight: '700' },
  bigLabelSel: { color: '#3b82f6' },
  arrowBtn: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: ARROW_W,
    borderRadius: 10,
    backgroundColor: '#F2EAD9',
    borderWidth: 1,
    borderColor: '#e6d9bf',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  arrowLeft: { left: 6 },
  arrowRight: { right: 6 },
  arrowBtnPressed: { transform: [{ translateY: 1 }], shadowOpacity: 0.05, elevation: 1 },
  arrowGlyph: { fontSize: 20, fontWeight: '700', color: '#374151' },

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

  stateToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 8,
    gap: 8,
  },
  stateRow: { flexDirection: 'row', gap: 6, flexShrink: 1, flexWrap: 'wrap' },
  toolsRow: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexShrink: 0,
  },

  radio: { borderWidth: 1, borderColor: '#9ca3af', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10 },
  radioSel: { backgroundColor: '#10b981', borderColor: '#10b981' },
  radioTxt: { fontSize: 11, fontWeight: 'bold' },
  radioTxtSel: { color: '#fff' },

  toolBtn: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  toolBtnIcon: { paddingHorizontal: 9 },
  toolBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },

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

  inputWithTrend: {
    position: 'relative',
    width: 90,
    paddingRight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginRight: 0,
    flexShrink: 0,
  },
  trendIcon: {
    position: 'absolute',
    right: 10,
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

  extraTxt: { marginLeft: 'auto', fontSize: 12, fontWeight: '600', color: '#374151' },
  sp: { marginLeft: 8, fontSize: 12, fontWeight: '700', color: '#1e40af', flexShrink: 0 },

  // Modales
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '94%',
    maxWidth: 720,
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  videoCard: {
    width: '94%',
    backgroundColor: '#000',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    right: -8,
    top: -8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    padding: 6,
    zIndex: 10,
  },
  modalTitle: { color: '#E5E7EB', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tipBullet: { color: '#93C5FD', fontSize: 18, lineHeight: 18, marginTop: 2 },
  tipText: { color: '#E5E7EB', fontSize: 14, lineHeight: 20 },
});
