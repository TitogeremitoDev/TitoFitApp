/* app/entreno/index.jsx
────────────────────────────────────────────────────────────────────────────
Pantalla principal de entrenamiento — v4.0 ULTIMATE EDITION 🔥
- Última sesión por RUTINA (last_session_<id>), rehidratación al foco.
- Carruseles corrigidos anti-NaN y claves re-montables tras hidratar.
- Estados: C / NC / OE (compat con datos antiguos "OJ").
- Guardado consolidado al final del día con botón "Terminar Día".
- Los ejercicios sin estado usan valores del día anterior automáticamente.
- 🔥 NUEVO: Modal épico con estadísticas comparativas y análisis de mejora
  • 1RM Estimado con fórmula científica
  • Volumen Total (clave para hipertrofia)
  • Carga Media (intensidad promedio)
  • Comparación automática con semana anterior
  • Destacado de mayor mejora por ejercicio
  • Animaciones y diseño premium
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
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import YoutubeIframe from 'react-native-youtube-iframe';
import Stopwatch from '../../components/Stopwatch';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
// ⚠️ Ajusta la ruta si tu JSON cambia de sitio:
import rawDB from '../../src/data/exercises.json';

const { width } = Dimensions.get('window');
const ARROW_W = 56;
const ESTADOS = ['C', 'NC', 'OE']; // ← OJ → OE
const SEMANAS_MAX = 200;

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

/* ───────── Cálculo de 1RM (Fórmula Epley) ───────── */
function calculate1RM(peso, reps) {
  if (!peso || !reps || reps <= 0) return 0;
  const p = Number(peso);
  const r = Number(reps);
  if (isNaN(p) || isNaN(r)) return 0;
  // Fórmula: 1RM ≈ Peso / (1.0278 - 0.0278 × Reps)
  return p / (1.0278 - 0.0278 * r);
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
  const { theme } = useTheme();
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
      style={[styles.carouselWrap, { 
        borderColor: theme.border,
        backgroundColor: theme.backgroundSecondary 
      }]}
      onLayout={(e) => setWrapW(e.nativeEvent.layout.width)}
    >
      <Pressable
        onPress={() => move(-1)}
        android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
        hitSlop={12}
        style={({ pressed }) => [
          styles.arrowBtn,
          styles.arrowLeft,
          { 
            backgroundColor: theme.iconButton,
            borderColor: theme.borderLight
          },
          pressed && styles.arrowBtnPressed,
        ]}
      >
        <Text style={[styles.arrowGlyph, { color: theme.text }]}>‹</Text>
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
          { 
            backgroundColor: theme.iconButton,
            borderColor: theme.borderLight
          },
          pressed && styles.arrowBtnPressed,
        ]}
      >
        <Text style={[styles.arrowGlyph, { color: theme.text }]}>›</Text>
      </Pressable>
    </View>
  );
}

function WeeksCarousel({ selected, onChange }) {
  const { theme } = useTheme();
  const data = Array.from({ length: SEMANAS_MAX }, (_, i) => i + 1);
  return (
    <Carousel
      key={`weeks-${selected ?? 1}`}
      data={data}
      onIndexChange={(i) => onChange(i + 1)}
      initialIndex={Math.max(0, (selected || 1) - 1)}
      renderItem={({ item }) => (
        <View style={[styles.centerPill, { 
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder
        }]}>
          <Text style={[styles.bigLabel, { color: theme.text }, selected === item && { color: theme.primary }]}>
            Semana {item}
          </Text>
        </View>
      )}
    />
  );
}

function DaysCarousel({ total, selected, onChange }) {
  const { theme } = useTheme();
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
        <View style={[styles.centerPill, { 
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder
        }]}>
          <Text style={[styles.bigLabel, { color: theme.text }, safeSelected === item - 1 && { color: theme.primary }]}>
            Día {item}
          </Text>
        </View>
      )}
    />
  );
}

/* ───────── 🔥 Modal de Estadísticas ÉPICO 🔥 ───────── */
function StatsModal({ visible, onClose, stats }) {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible, scaleAnim, fadeAnim]);

  if (!stats) return null;

  const { current, previous, bestImprovement } = stats;

  const getDiffColor = (diff) => {
    if (!diff || diff === 0) return theme.textSecondary;
    return diff > 0 ? '#10b981' : '#ef4444';
  };

  const getDiffIcon = (diff) => {
    if (!diff || diff === 0) return 'remove';
    return diff > 0 ? 'trending-up' : 'trending-down';
  };

  const formatNumber = (num) => {
    if (num == null || isNaN(num)) return '0';
    return Number(num).toFixed(1);
  };

  const formatDiff = (diff) => {
    if (diff == null || isNaN(diff)) return '';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${formatNumber(diff)}`;
  };

  const formatPercent = (diff, prev) => {
    if (!prev || prev === 0 || !diff) return '';
    const percent = (diff / prev) * 100;
    const sign = percent > 0 ? '+' : '';
    return ` (${sign}${percent.toFixed(1)}%)`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.statsModalOverlay}>
        <Animated.View
          style={[
            styles.statsModalCard,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Icono de cierre */}
          <Pressable onPress={onClose} style={styles.statsModalClose}>
            <Ionicons name="close-circle" size={32} color={theme.textSecondary} />
          </Pressable>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            style={styles.statsScrollView}
            contentContainerStyle={styles.statsScrollContent}
          >
            {/* 🏆 Encabezado con trofeo */}
            <View style={styles.statsHeader}>
              <View style={styles.trophyContainer}>
                <Ionicons name="trophy" size={64} color="#fbbf24" />
              </View>
              <Text style={[styles.statsTitle, { color: theme.text }]}>
                ¡Enhorabuena!
              </Text>
              <Text style={[styles.statsSubtitle, { color: theme.primary }]}>
                Has superado tus metas
              </Text>
            </View>

            {/* 💪 Imagen motivacional */}
            <View style={styles.motivationalSection}>
              <View style={styles.dumbbellContainer}>
                <Ionicons name="barbell" size={80} color={theme.primary} />
              </View>
            </View>

            {/* 📊 Estadísticas comparativas */}
            <View style={styles.statsSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {previous ? '📊 Comparación con Semana Anterior' : '📊 Estadísticas de Hoy'}
              </Text>
{/* Volumen Total */}
              <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.statHeader}>
                  <Ionicons name="cube" size={24} color="#8b5cf6" />
                  <Text style={[styles.statTitle, { color: theme.text }]}>Volumen Total</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={[styles.statValue, { color: theme.primary }]}>
                    {formatNumber(current.volume)} kg
                  </Text>
                  {previous && (
                    <View style={styles.statDiff}>
                      <Ionicons
                        name={getDiffIcon(current.volume - previous.volume)}
                        size={20}
                        color={getDiffColor(current.volume - previous.volume)}
                      />
                      <Text style={[styles.statDiffText, { color: getDiffColor(current.volume - previous.volume) }]}>
                        {formatDiff(current.volume - previous.volume)}
                        {formatPercent(current.volume - previous.volume, previous.volume)}
                      </Text>
                    </View>
                  )}
                </View>
                {previous && (
                  <Text style={[styles.statPrevious, { color: theme.textSecondary }]}>
                    Anterior: {formatNumber(previous.volume)} kg
                  </Text>
                )}
              </View>
              {/* 1RM Estimado */}
              <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.statHeader}>
                  <Ionicons name="flash" size={24} color="#f59e0b" />
                  <Text style={[styles.statTitle, { color: theme.text }]}>1RM Estimado</Text>
                </View>
                <View style={styles.statRow}>

                  {previous && (
                    <View style={styles.statDiff}>
                      <Ionicons
                        name={getDiffIcon(current.oneRM - previous.oneRM)}
                        size={20}
                        color={getDiffColor(current.oneRM - previous.oneRM)}
                      />
                      <Text style={[styles.statDiffText, { color: getDiffColor(current.oneRM - previous.oneRM) }]}>
                        {formatDiff(current.oneRM - previous.oneRM)}
                        {formatPercent(current.oneRM - previous.oneRM, previous.oneRM)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              

              {/* Carga Media */}
              <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.statHeader}>
                  <Ionicons name="analytics" size={24} color="#06b6d4" />
                  <Text style={[styles.statTitle, { color: theme.text }]}>Carga Media</Text>
                </View>
                <View style={styles.statRow}>
                  {previous && (
                    <View style={styles.statDiff}>
                      <Ionicons
                        name={getDiffIcon(current.avgLoad - previous.avgLoad)}
                        size={20}
                        color={getDiffColor(current.avgLoad - previous.avgLoad)}
                      />
                      <Text style={[styles.statDiffText, { color: getDiffColor(current.avgLoad - previous.avgLoad) }]}>
                        {formatDiff(current.avgLoad - previous.avgLoad)}
                        {formatPercent(current.avgLoad - previous.avgLoad, previous.avgLoad)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* 🌟 Mayor mejora */}
            {bestImprovement && (
              <View style={[styles.bestImprovementSection, { backgroundColor: theme.success + '20', borderColor: theme.success }]}>
                <View style={styles.bestImprovementHeader}>
                  <Ionicons name="star" size={28} color="#fbbf24" />
                  <Text style={[styles.bestImprovementTitle, { color: theme.text }]}>
                    ¡Tu Mayor Mejora!
                  </Text>
                </View>
                <Text style={[styles.bestImprovementExercise, { color: theme.primary }]}>
                  {bestImprovement.exercise}
                </Text>
                <Text style={[styles.bestImprovementText, { color: theme.text }]}>
                  {bestImprovement.metric}: {formatDiff(bestImprovement.improvement)}{' '}
                  {bestImprovement.unit}
                  {formatPercent(bestImprovement.improvement, bestImprovement.previous)}
                </Text>
                <Text style={[styles.motivationalText, { color: theme.success }]}>
                  ¡Sigue así! 💪
                </Text>
              </View>
            )}

            {/* Botón de cerrar */}
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.primary }]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.closeButtonText}>¡Genial! 🎉</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ───────── Componente principal ───────── */
export default function Entreno() {
  const { theme } = useTheme();
  const navigation = useNavigation();
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
  
  // Modal de Sin Rutina Activa
  const [showNoRoutineModal, setShowNoRoutineModal] = useState(false);

  // 🔥 NUEVO: Modal de estadísticas
  const [statsModal, setStatsModal] = useState({ visible: false, stats: null });

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
      setShowNoRoutineModal(true);
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

  /* ───────── Cambio de estado SIN guardado inmediato ───────── */
  const setEstadoEjLocal = (clave, val) => {
    // Solo cambio local del estado, NO guardamos en AsyncStorage aquí
    const nextVal = val === 'OJ' ? 'OE' : val;
    setProg((prev) => ({ ...prev, [clave]: nextVal }));
  };

  /* ───────── Buscar datos del día anterior ───────── */
  const findPrevDayData = (exerciseId, serieIdx, field) => {
    // Buscar en el día anterior de esta semana
    if (diaIdx > 0) {
      const keyPrevDay = `${semana}|${diaIdx - 1}|${exerciseId}|${serieIdx}`;
      const data = prog[keyPrevDay]?.[field];
      if (data) return data;
    }
    
    // Si no hay día anterior en esta semana, buscar en la última semana
    for (let w = semana - 1; w > 0; w--) {
      const key = `${w}|${diaIdx}|${exerciseId}|${serieIdx}`;
      const data = prog[key]?.[field];
      if (data) return data;
    }
    
    return null;
  };

  /* ───────── Calcular estadísticas de una sesión ───────── */
  const calculateSessionStats = (ejerciciosDia, week) => {
    let totalVolume = 0;
    let totalReps = 0;
    let max1RM = 0;
    const exerciseStats = {};

    ejerciciosDia.forEach((ejercicio) => {
      let exerciseVolume = 0;
      let exerciseReps = 0;
      let exercise1RM = 0;

      (ejercicio.series || []).forEach((serie, idx) => {
        const serieKey = `${week}|${diaIdx}|${ejercicio.id}|${idx}`;
        const datosSerie = prog[serieKey] || {};
        const reps = Number(datosSerie.reps) || 0;
        const peso = Number(datosSerie.peso) || 0;

        if (reps > 0 && peso > 0) {
          const volume = reps * peso;
          exerciseVolume += volume;
          exerciseReps += reps;
          totalVolume += volume;
          totalReps += reps;

          const serieRM = calculate1RM(peso, reps);
          if (serieRM > exercise1RM) exercise1RM = serieRM;
          if (serieRM > max1RM) max1RM = serieRM;
        }
      });

      exerciseStats[ejercicio.id] = {
        name: ejercicio.nombre,
        volume: exerciseVolume,
        reps: exerciseReps,
        oneRM: exercise1RM,
        avgLoad: exerciseReps > 0 ? exerciseVolume / exerciseReps : 0,
      };
    });

    return {
      oneRM: max1RM,
      volume: totalVolume,
      avgLoad: totalReps > 0 ? totalVolume / totalReps : 0,
      totalReps,
      exerciseStats,
    };
  };

  /* ───────── Encontrar mayor mejora ───────── */
  const findBestImprovement = (currentStats, previousStats) => {
    if (!previousStats) return null;

    let bestImprovement = null;
    let maxImprovementPercent = 0;

    Object.keys(currentStats.exerciseStats).forEach((exerciseId) => {
      const current = currentStats.exerciseStats[exerciseId];
      const previous = previousStats.exerciseStats[exerciseId];

      if (!previous) return;

      // Comparar volumen
      if (previous.volume > 0) {
        const volumeDiff = current.volume - previous.volume;
        const volumePercent = (volumeDiff / previous.volume) * 100;
        if (volumePercent > maxImprovementPercent) {
          maxImprovementPercent = volumePercent;
          bestImprovement = {
            exercise: current.name,
            metric: 'Volumen',
            improvement: volumeDiff,
            previous: previous.volume,
            unit: 'kg',
          };
        }
      }

      // Comparar 1RM
      if (previous.oneRM > 0) {
        const rmDiff = current.oneRM - previous.oneRM;
        const rmPercent = (rmDiff / previous.oneRM) * 100;
        if (rmPercent > maxImprovementPercent) {
          maxImprovementPercent = rmPercent;
          bestImprovement = {
            exercise: current.name,
            metric: '1RM Estimado',
            improvement: rmDiff,
            previous: previous.oneRM,
            unit: 'kg',
          };
        }
      }

      // Comparar carga media
      if (previous.avgLoad > 0) {
        const avgDiff = current.avgLoad - previous.avgLoad;
        const avgPercent = (avgDiff / previous.avgLoad) * 100;
        if (avgPercent > maxImprovementPercent) {
          maxImprovementPercent = avgPercent;
          bestImprovement = {
            exercise: current.name,
            metric: 'Carga Media',
            improvement: avgDiff,
            previous: previous.avgLoad,
            unit: 'kg',
          };
        }
      }
    });

    return bestImprovement;
  };

  /* ───────── Guardar todo el día con estadísticas ───────── */
  const saveAllDayData = async () => {
    try {
      const ejerciciosDia = (diasEj[diaIdx] || []).filter(Boolean);
      
      if (ejerciciosDia.length === 0) {
        Alert.alert('Sin ejercicios', 'No hay ejercicios en este día para guardar.');
        return;
      }

      let ejerciciosProcesados = 0;
      let ejerciciosConEstado = 0;
      let ejerciciosSinEstado = 0;
      const now = new Date().toISOString();
      const logEntriesToAdd = [];

      // Crear una copia del progreso actual
      const nextProg = { ...prog };

      // Recorrer cada ejercicio del día
      for (const ejercicio of ejerciciosDia) {
        const ejerKey = `${semana}|${diaIdx}|${ejercicio.id}`;
        const currentState = prog[ejerKey];

        // Si tiene estado (C, NC, OE), procesar normalmente
        if (ESTADOS.includes(currentState) || currentState === 'OJ') {
          ejerciciosConEstado++;
          
          // Si el estado es 'C', agregar al log global
          if (currentState === 'C' || currentState === 'OJ') {
            const seriesData = (ejercicio.series || []).map((serie, idx) => {
              const serieKey = `${ejerKey}|${idx}`;
              const datosSerie = prog[serieKey] || {};
              const reps = Number(datosSerie.reps) || 0;
              const load = Number(datosSerie.peso) || 0;
              const volume = reps * load;
              const e1RM = reps > 0 ? load * (1 + reps / 30) : 0;
              
              return {
                id: `${now}-${ejercicio.id}-${idx}`,
                date: now,
                routineName: rutina?.nombre || 'Rutina Desconocida',
                week: semana,
                muscle: ejercicio.musculo,
                exercise: ejercicio.nombre,
                setIndex: idx + 1,
                reps,
                load,
                volume,
                e1RM,
              };
            });
            
            logEntriesToAdd.push(...seriesData);
          }
        } else {
          // Sin estado: usar datos del día anterior
          ejerciciosSinEstado++;
          
          // Buscar si hay datos del día anterior para copiar
          let hayDatosAnteriores = false;
          
          for (let idx = 0; idx < (ejercicio.series || []).length; idx++) {
            const serieKey = `${ejerKey}|${idx}`;
            const prevReps = findPrevDayData(ejercicio.id, idx, 'reps');
            const prevPeso = findPrevDayData(ejercicio.id, idx, 'peso');
            
            if (prevReps || prevPeso) {
              hayDatosAnteriores = true;
              // Copiar los datos del día anterior si no hay datos actuales
              if (!prog[serieKey]?.reps && prevReps) {
                nextProg[serieKey] = { ...(nextProg[serieKey] || {}), reps: prevReps };
              }
              if (!prog[serieKey]?.peso && prevPeso) {
                nextProg[serieKey] = { ...(nextProg[serieKey] || {}), peso: prevPeso };
              }
            }
          }
        }
        
        ejerciciosProcesados++;
      }

      // Actualizar el estado con los nuevos datos
      setProg(nextProg);

      // Guardar en AsyncStorage
      if (activeId) {
        const sessionData = JSON.stringify({
          lastSemana: semana,
          lastDiaIdx: diaIdx,
          updatedAt: Date.now(),
        });
        
        await AsyncStorage.multiSet([
          ['progress', JSON.stringify(nextProg)],
          [sessionKeyFor(activeId), sessionData],
        ]);
      } else {
        await AsyncStorage.setItem('progress', JSON.stringify(nextProg));
      }

      // Guardar en GLOBAL_LOG si hay entradas
      if (logEntriesToAdd.length > 0) {
        const currentLogJson = await AsyncStorage.getItem('GLOBAL_LOG');
        const currentLog = currentLogJson ? JSON.parse(currentLogJson) : [];
        const updatedLog = [...currentLog, ...logEntriesToAdd];
        await AsyncStorage.setItem('GLOBAL_LOG', JSON.stringify(updatedLog));
      }

      // 🔥 CALCULAR ESTADÍSTICAS Y MOSTRAR MODAL ÉPICO
      const currentStats = calculateSessionStats(ejerciciosDia, semana);
      const previousStats = semana > 1 ? calculateSessionStats(ejerciciosDia, semana - 1) : null;
      const bestImprovement = findBestImprovement(currentStats, previousStats);

      setStatsModal({
        visible: true,
        stats: {
          current: currentStats,
          previous: previousStats,
          bestImprovement,
        },
      });

    } catch (e) {
      console.error('Error al guardar el día:', e);
      Alert.alert('Error', 'No se pudo guardar el día completo. Por favor, intenta de nuevo.');
    }
  };

  const setSerieDato = async (serieKey, campo, val) => {
    const nextProg = {
      ...prog,
      [serieKey]: { ...(prog[serieKey] || {}), [campo]: val },
    };
    setProg(nextProg);

    // Guardado inmediato para las series (mantener comportamiento original)
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

  if (!rutina) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modal Sin Rutina Activa */}
        <Modal
          visible={showNoRoutineModal}
          transparent
          animationType={Platform.OS === 'android' ? 'slide' : 'fade'}
          onRequestClose={() => setShowNoRoutineModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.noRoutineCard, { 
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border
            }]}>
              <View style={styles.noRoutineIconContainer}>
                <Ionicons name="fitness-outline" size={64} color={theme.primary} />
              </View>

              <Text style={[styles.noRoutineTitle, { color: theme.text }]}>
                Sin rutina activa
              </Text>
              
              <Text style={[styles.noRoutineDescription, { color: theme.textSecondary }]}>
                Para comenzar a entrenar, primero necesitas seleccionar una rutina activa.
              </Text>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setShowNoRoutineModal(false);
                  navigation.navigate('rutinas/index');
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="list-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.actionButtonText}>Ir a Rutinas</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => setShowNoRoutineModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

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
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.text }]}>{rutina.nombre}</Text>

          <View style={styles.center}>
            <Stopwatch />
          </View>

          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: theme.primary }]}
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
          contentContainerStyle={{ paddingBottom: 20 }}
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
              <View style={[styles.card, { 
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder
              }]}>
                <TouchableOpacity
                  style={[styles.cardHeader, { borderColor: theme.cardHeaderBorder }]}
                  onPress={() => setOpenId(abierto ? null : item.id)}
                >
                  <Text style={[styles.cardTxt, { color: theme.text }]}>
                    {item.musculo} — {item.nombre}
                  </Text>
                  <Ionicons
                    name={abierto ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>

                {/* Estados + Herramientas (TC/Vídeo) */}
                <View style={styles.stateToolsRow}>
                  <View style={styles.stateRow}>
                    {ESTADOS.map((e) => (
                      <TouchableOpacity
                        key={e}
                        style={[
                          styles.radio,
                          { borderColor: theme.border },
                          currentState === e && [styles.radioSel, { 
                            backgroundColor: theme.success,
                            borderColor: theme.success
                          }]
                        ]}
                        onPress={() => setEstadoEjLocal(ejerKey, e)}
                      >
                        <Text
                          style={[
                            styles.radioTxt,
                            { color: theme.text },
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
                      style={[styles.toolBtn, { 
                        backgroundColor: theme.backgroundTertiary,
                        borderColor: theme.border
                      }]}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.toolBtnTxt, { color: theme.text }]}>TC</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => onOpenVideo(item)}
                      style={[styles.toolBtn, styles.toolBtnIcon, { 
                        backgroundColor: theme.backgroundTertiary,
                        borderColor: theme.border
                      }]}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="videocam-outline" size={16} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                </View>

                {abierto && (
                  <View style={styles.seriesBox}>
                    <View style={styles.serieRowHeader}>
                      <Text style={[styles.serieLabel, { fontWeight: 'bold', color: theme.textSecondary }]}>#</Text>
                      <View style={styles.inputCol}>
                        <Text style={[styles.colLabel, { color: theme.textSecondary }]}>Reps</Text>
                      </View>
                      <View style={styles.inputCol}>
                        <Text style={[styles.colLabel, { color: theme.textSecondary }]}>Kg</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                    </View>

                    {(item.series || []).map((serie, idx) => {
                      const serieKey = `${ejerKey}|${idx}`;
                      const prevReps = findPrev(semana, diaIdx, item.id, idx, 'reps');
                      const prevKg = findPrev(semana, diaIdx, item.id, idx, 'peso');
                      const curr = prog[serieKey] || {};

                      let bgColor = theme.cardBackground;
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
                        <View key={idx} style={[styles.serieRow, { 
                          backgroundColor: bgColor,
                          borderColor: theme.border
                        }]}>
                          <Text style={[styles.serieLabel, { color: theme.textSecondary }]}>Serie {idx + 1}</Text>

                          {/* Reps */}
                          <View style={styles.inputWithTrend}>
                            <TextInput
                              style={[styles.serieInput, {
                                borderColor: theme.inputBorder,
                                backgroundColor: theme.inputBackground,
                                color: theme.inputText
                              }]}
                              placeholder={prevReps ? String(prevReps) : ''}
                              placeholderTextColor={theme.placeholder}
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
                              style={[styles.serieInput, {
                                borderColor: theme.inputBorder,
                                backgroundColor: theme.inputBackground,
                                color: theme.inputText
                              }]}
                              placeholder={prevKg ? String(prevKg) : ''}
                              placeholderTextColor={theme.placeholder}
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
                          {prevExceeded && <Text style={[styles.sp, { color: theme.primary }]}>¡SP!</Text>}

                          <Text style={[styles.extraTxt, { color: theme.textSecondary }]}>
                            {EXTRA_ABBR[serie?.extra] || ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: theme.textSecondary }}>Sin ejercicios</Text>}
          ListFooterComponent={
            ejerciciosDia.length > 0 ? (
              <View style={styles.footerButtonContainer}>
                <TouchableOpacity
                  style={[styles.saveDayButton, { backgroundColor: theme.success }]}
                  onPress={saveAllDayData}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle" size={28} color="#fff" />
                  <Text style={styles.saveDayButtonText}>Terminar Día y Guardar Registro</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      </View>

      {/* 🔥 Modal de Estadísticas ÉPICO */}
      <StatsModal
        visible={statsModal.visible}
        onClose={() => setStatsModal({ visible: false, stats: null })}
        stats={statsModal.stats}
      />

      {/* Modal Técnica Correcta */}
      <Modal
        visible={techModal.visible}
        transparent
        animationType={Platform.OS === 'android' ? 'slide' : 'fade'}
        onRequestClose={() => setTechModal((s) => ({ ...s, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { 
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border
          }]}>
            <Pressable
              onPress={() => setTechModal((s) => ({ ...s, visible: false }))}
              style={styles.modalClose}
            >
              <Ionicons name="close-outline" size={24} color={theme.text} />
            </Pressable>

            <Text style={[styles.modalTitle, { color: theme.text }]}>Técnica: {techModal.title}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {(techModal.tips || []).map((t, i) => (
                <View key={i} style={styles.tipRow}>
                  <Text style={[styles.tipBullet, { color: theme.primary }]}>•</Text>
                  <Text style={[styles.tipText, { color: theme.textSecondary }]}>{t}</Text>
                </View>
              ))}
              {!techModal.tips?.length && (
                <Text style={[styles.tipText, { color: theme.textSecondary }]}>No hay detalles de técnica.</Text>
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
          <View style={[styles.videoCard, { 
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border
          }]}>
            <Pressable
              onPress={() =>
                setVideoModal((s) => ({ ...s, visible: false, playing: false }))
              }
              style={styles.modalClose}
            >
              <Ionicons name="close-outline" size={24} color={theme.text} />
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
              <Text style={{ color: theme.text }}>Vídeo no disponible</Text>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ───────── styles ───────── */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
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
    borderWidth: 3,
    borderRadius: 12,
    minHeight: 52,
    overflow: 'hidden',
    paddingHorizontal: ARROW_W,
  },
  slide: { alignItems: 'center', justifyContent: 'center' },
  centerPill: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  bigLabel: { fontSize: 18, fontWeight: '700' },
  arrowBtn: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: ARROW_W,
    borderRadius: 10,
    borderWidth: 1,
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
  arrowGlyph: { fontSize: 20, fontWeight: '700' },

  card: {
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
    borderWidth: 0.6,
    paddingBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 0.6,
  },
  cardTxt: { flex: 1, fontSize: 14, fontWeight: '600' },

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

  radio: { borderWidth: 1, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10 },
  radioSel: {},
  radioTxt: { fontSize: 11, fontWeight: 'bold' },
  radioTxtSel: { color: '#fff' },

  toolBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  toolBtnIcon: { paddingHorizontal: 9 },
  toolBtnTxt: { fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },

  seriesBox: { marginTop: 8 },
  serieRowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 10 },
  colLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },

  /* Fila de series */
  serieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.6,
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
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 12,
    textAlign: 'center',
  },

  extraTxt: { marginLeft: 'auto', fontSize: 12, fontWeight: '600' },
  sp: { marginLeft: 8, fontSize: 12, fontWeight: '700', flexShrink: 0 },

  // Botón al final de la lista (no flotante) ✅
  footerButtonContainer: {
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
  },
  saveDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
    minWidth: 240,
  },
  saveDayButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 12,
    letterSpacing: 0.5,
    textAlign: 'center',
    padding:0
  },

  // 🔥 Estilos del Modal de Estadísticas ÉPICO 🔥
  statsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    maxHeight: '100%',
    
  },
  statsModalCard: {
    width: '95%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    overflow: 'hidden',
    flexShrink: 0,
  },
  statsModalClose: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 10,
  },
  statsScrollView: {
    flex: 1,
    maxHeight: '100%',
  },
  statsScrollContent: {
    paddingBottom: 20,
  },
  statsHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  trophyContainer: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 100,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
  },
  statsTitle: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  statsSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  motivationalSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  dumbbellContainer: {
    padding: 16,
  },
  statsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  statCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  statDiff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDiffText: {
    fontSize: 16,
    fontWeight: '700',
  },
  statPrevious: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  bestImprovementSection: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 2,
    alignItems: 'center',
  },
  bestImprovementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  bestImprovementTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  bestImprovementExercise: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  bestImprovementText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  motivationalText: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  closeButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Modales originales
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
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  videoCard: {
    width: '94%',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
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
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tipBullet: { fontSize: 18, lineHeight: 18, marginTop: 2 },
  tipText: { fontSize: 14, lineHeight: 20 },

  // Modal Sin Rutina Activa
  noRoutineCard: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  noRoutineIconContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 50,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  noRoutineTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  noRoutineDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1.5,
    width: '100%',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});