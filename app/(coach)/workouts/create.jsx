// app/(coach)/workouts/create.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  ActionSheetIOS,
  Image,
  ScrollView,
  Dimensions,
  Pressable,
} from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../../context/AuthContext';
import ExerciseSearchModal from '../../../components/ExerciseSearchModal';

const EXTRA_OPCIONES = ['Ninguno', 'Descendentes', 'Mio Reps', 'Parciales', 'Biserie'];

/* ───────────────────────── Helpers ───────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(4);

const normalizeRoutine = (input) => {
  const out = {};
  const entries = Object.entries(input || {});
  const base = entries.length ? entries : [['dia1', []]];

  base.forEach(([_, list], dIdx) => {
    const dayKey = `dia${dIdx + 1}`;
    const safeList = Array.isArray(list) ? list : [];
    const normList = safeList.map((ej) => {
      const ejId = ej?.id ?? `ej-${uid()}`;
      const rawSeries = Array.isArray(ej?.series) ? ej.series : [];
      const series = rawSeries.map((s, sIdx) => ({
        ...s,
        id: s?.id ?? `s-${ejId}-${sIdx}-${uid()}`,
        repMin: s?.repMin ?? '8',
        repMax: s?.repMax ?? '12',
        extra: s?.extra ?? 'Ninguno',
        nota: s?.nota ?? '',
      }));
      return {
        musculo: '',
        nombre: '',
        dbId: null,
        ...ej,
        id: ejId,
        series,
      };
    });
    out[dayKey] = normList;
  });

  return out;
};

const fromEntriesOrdered = (entries) => {
  const obj = {};
  for (const [k, v] of entries) obj[k] = v;
  return obj;
};

const nextDayKey = (entries) => {
  const nums = entries
    .map(([k]) => parseInt(String(k).replace('dia', ''), 10))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `dia${max + 1}`;
};

/* ───────────────────────── Components ───────────────────────── */

const SerieRow = React.memo(({ diaKey, ejercicioId, s, index, updateSerieCampo, toggleSerieExtra, deleteSerie, toggleFallo }) => {
  // Detectar si está en modo Fallo
  const isFallo = String(s.repMin).toLowerCase() === 'fallo' || String(s.repMax).toLowerCase() === 'fallo';
  const isBiserie = s.extra === 'Biserie';

  return (
    <View style={styles.serieRowContainer}>
      <View style={[styles.serieRow, isBiserie && styles.serieRowBiserie]}>
        {/* Columna: S# (ancho fijo) */}
        <View style={styles.colS}>
          <Text style={styles.serieLabel}>S{index + 1}</Text>
          {isFallo && <Text style={styles.miniIcon}>🔥</Text>}
          {isBiserie && <Text style={styles.miniIcon}>🔗</Text>}
        </View>

        {/* Columna: Fallo toggle (ancho fijo) */}
        <View style={styles.colFallo}>
          <TouchableOpacity
            style={[styles.falloBtn, isFallo && styles.falloBtnActive]}
            onPress={() => toggleFallo(diaKey, ejercicioId, s.id)}
          >
            <Text style={[styles.falloBtnTxt, isFallo && styles.falloBtnTxtActive]} numberOfLines={1}>
              Fallo
            </Text>
          </TouchableOpacity>
        </View>

        {/* Columna: Reps Min-Max (ancho fijo) */}
        <View style={styles.colReps}>
          {!isFallo ? (
            <>
              <TextInput
                style={styles.serieInputSmall}
                placeholder="8"
                keyboardType="numeric"
                value={String(s.repMin ?? '')}
                onChangeText={(v) => updateSerieCampo(diaKey, ejercicioId, s.id, 'repMin', v)}
              />
              <Text style={styles.repsSeparator}>–</Text>
              <TextInput
                style={styles.serieInputSmall}
                placeholder="12"
                keyboardType="numeric"
                value={String(s.repMax ?? '')}
                onChangeText={(v) => updateSerieCampo(diaKey, ejercicioId, s.id, 'repMax', v)}
              />
            </>
          ) : (
            <Text style={styles.falloIndicatorSmall}>Al Fallo</Text>
          )}
        </View>

        {/* Columna: Técnica (flex) */}
        <View style={styles.colTecnica}>
          <TouchableOpacity
            style={[styles.extraPillCompact, isBiserie && styles.extraPillBiserie]}
            onPress={() => toggleSerieExtra(diaKey, ejercicioId, s.id)}
          >
            <Text style={[styles.extraPillTxtCompact, isBiserie && styles.extraPillTxtBiserie]} numberOfLines={1}>
              {s.extra || 'Ninguno'}
            </Text>
            <Ionicons name="chevron-down-outline" size={14} color={isBiserie ? '#92400e' : '#64748b'} />
          </TouchableOpacity>
        </View>

        {/* Columna: Delete (ancho fijo) */}
        <View style={styles.colDelete}>
          <IconBtn
            onPress={() => deleteSerie(diaKey, ejercicioId, s.id)}
            icon="close-circle"
            tint="#ef4444"
          />
        </View>
      </View>

      {/* Nota del entrenador */}
      <View style={styles.notaRow}>
        <Ionicons name="chatbubble-ellipses-outline" size={14} color="#6b7280" style={{ marginRight: 6 }} />
        <TextInput
          style={styles.notaInput}
          placeholder="Nota para el cliente (ej: Controlar la bajada...)"
          placeholderTextColor="#9ca3af"
          value={s.nota || ''}
          onChangeText={(v) => updateSerieCampo(diaKey, ejercicioId, s.id, 'nota', v)}
        />
      </View>
    </View>
  );
});

const ExerciseCard = React.memo(({
  item,
  section,
  isOpen,
  toggleOpen,
  moveExercise,
  addExerciseAfter,
  deleteExercise,
  updateEjercicioCampo,
  addSerie,
  updateSerieCampo,
  toggleSerieExtra,
  toggleFallo,
  deleteSerie,
  muscles,
  exercises,
  onMuscleChange,
  onExerciseChange,
  onOpenExerciseSearch,
  setImageModal, // 🆕 Props para modales de preview
  setVideoModal,
  setTechModal,
  isBiserie = false,
}) => {
  const diaKey = section.title;
  const abierto = isOpen(item.id);
  const isValidated = !!item.dbId || exercises.some(e => e.name === item.nombre && e.muscle === item.musculo);

  // 🔍 Obtener datos del ejercicio actual para preview
  const currentExercise = exercises.find(e => e._id === item.dbId || (e.name === item.nombre && e.muscle === item.musculo));
  const hasImage = !!currentExercise?.imagen_ejercicio_ID?.trim();
  const hasTips = Array.isArray(currentExercise?.instructions) && currentExercise.instructions.length > 0;
  const hasVideo = !!currentExercise?.videoId?.trim();

  return (
    <View style={[styles.card, isBiserie && styles.cardBiserie]}>
      {/* Header ejercicio */}
      <View style={styles.cardHeaderContainer}>
        <TouchableOpacity
          onPress={() => toggleOpen(item.id)}
          style={styles.cardHeaderTouchable}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.cardHeader}>
              {(item.musculo || 'MÚSCULO')} — {(item.nombre || 'Nombre ejercicio')}
            </Text>
            <View style={[styles.validationBadge, { backgroundColor: isValidated ? '#dcfce7' : '#fee2e2' }]}>
              <Text style={{ fontSize: 12 }}>{isValidated ? '✅' : '❌'}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.moveControls}>
          <IconBtn onPress={() => moveExercise(diaKey, item.id, -1)} icon="arrow-up" tint="#3b82f6" />
          <IconBtn onPress={() => moveExercise(diaKey, item.id, +1)} icon="arrow-down" tint="#3b82f6" />
          <IconBtn onPress={() => addExerciseAfter(diaKey, item.id)} icon="add" tint="#10b981" />
          <IconBtn onPress={() => deleteExercise(diaKey, item.id)} icon="remove" tint="#ef4444" />
        </View>
      </View>

      {/* Editar musculo / nombre */}
      {abierto && (
        <View style={styles.editBlock}>
          {/* 🔍 Botón de Búsqueda Inteligente de Ejercicio */}
          <TouchableOpacity
            style={styles.exerciseSearchButton}
            onPress={() => onOpenExerciseSearch(diaKey, item.id)}
            activeOpacity={0.8}
          >
            <View style={styles.exerciseSearchContent}>
              <Ionicons name="search" size={18} color="#3b82f6" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                {item.nombre ? (
                  <>
                    <Text style={styles.exerciseSearchName}>{item.nombre}</Text>
                    <Text style={styles.exerciseSearchMuscle}>{item.musculo}</Text>
                  </>
                ) : (
                  <Text style={styles.exerciseSearchPlaceholder}>
                    🔍 Buscar ejercicio...
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
          </TouchableOpacity>

          {/* 📷 Botones de Vista Previa (solo si hay ejercicio seleccionado) */}
          {item.nombre && currentExercise && (
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={[styles.previewBtn, !hasImage && styles.previewBtnDisabled]}
                onPress={() => {
                  if (hasImage) {
                    setImageModal({
                      visible: true,
                      imageUrl: currentExercise.imagen_ejercicio_ID,
                      title: currentExercise.name
                    });
                  }
                }}
                disabled={!hasImage}
              >
                <Text style={styles.previewBtnTxt}>📸</Text>
                <Text style={[styles.previewBtnLabel, !hasImage && styles.previewBtnTxtDisabled]}>
                  Imagen
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.previewBtn, !hasTips && styles.previewBtnDisabled]}
                onPress={() => {
                  if (hasTips) {
                    setTechModal({
                      visible: true,
                      title: currentExercise.name,
                      tips: currentExercise.instructions
                    });
                  }
                }}
                disabled={!hasTips}
              >
                <Text style={styles.previewBtnTxt}>📖</Text>
                <Text style={[styles.previewBtnLabel, !hasTips && styles.previewBtnTxtDisabled]}>
                  Técnica
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.previewBtn, !hasVideo && styles.previewBtnDisabled]}
                onPress={() => {
                  if (hasVideo) {
                    setVideoModal({
                      visible: true,
                      videoId: currentExercise.videoId,
                      playing: true,
                      title: currentExercise.name
                    });
                  }
                }}
                disabled={!hasVideo}
              >
                <Text style={styles.previewBtnTxt}>🎬</Text>
                <Text style={[styles.previewBtnLabel, !hasVideo && styles.previewBtnTxtDisabled]}>
                  Video
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Series */}
      {abierto && (
        <View style={styles.seriesContainer}>
          <View style={styles.serieHeadRow}>
            <Text style={styles.headColS}>#</Text>
            <Text style={styles.headColFallo}>Fallo</Text>
            <Text style={styles.headColReps}>Reps</Text>
            <Text style={styles.headColTecnica}>Técnica</Text>
            <View style={styles.headColDelete} />
          </View>

          {item.series?.map((s, idx) => (
            <SerieRow
              key={s.id}
              diaKey={diaKey}
              ejercicioId={item.id}
              s={s}
              index={idx}
              updateSerieCampo={updateSerieCampo}
              toggleSerieExtra={toggleSerieExtra}
              toggleFallo={toggleFallo}
              deleteSerie={deleteSerie}
            />
          ))}

          <TouchableOpacity
            style={styles.addSerieBtn}
            onPress={() => addSerie(diaKey, item.id)}
          >
            <Ionicons name="add-circle-outline" size={20} color="#10b981" />
            <Text style={styles.addSerieTxt}>Añadir serie</Text>
          </TouchableOpacity>
        </View>
      )
      }
    </View >
  );
});

/* ───────────────────────── Main Component ───────────────────────── */
export default function CreateRoutineScreen() {
  const router = useRouter();
  // 🆕 Añadir parámetros para CurrentRoutine
  const { id, currentRoutineId, isCurrentRoutine, clientId, clientName, name, days: paramDays } = useLocalSearchParams();
  const { token, user } = useAuth();
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const [routineName, setRoutineName] = useState(name || '');
  const [days, setDays] = useState(paramDays ? parseInt(paramDays) : 3);
  const [rutina, setRutina] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 🆕 Estado para CurrentRoutine
  const [editingCurrentRoutineId, setEditingCurrentRoutineId] = useState(currentRoutineId || null);
  const [editingClientInfo, setEditingClientInfo] = useState(
    clientId ? { id: clientId, name: clientName } : null
  );

  const [diasAbiertos, setDiasAbiertos] = useState({});
  const [openSet, setOpenSet] = useState(new Set());

  // Selector State
  const [muscles, setMuscles] = useState([]);
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [addingToDay, setAddingToDay] = useState(null);

  const isFirstLoad = useRef(true);

  // 🆕 Estado para modal de confirmación al modificar CurrentRoutine
  const [showResetModal, setShowResetModal] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState(null);

  // 🆕 Estados para vista previa de ejercicio
  const [techModal, setTechModal] = useState({ visible: false, title: '', tips: [] });
  const [videoModal, setVideoModal] = useState({ visible: false, videoId: null, playing: false, title: '' });
  const [imageModal, setImageModal] = useState({ visible: false, imageUrl: null, title: '' });

  // 🔍 Estado para modal de búsqueda de ejercicios
  // mode: 'ADD' = crear ejercicio nuevo al final del día
  // mode: 'REPLACE' = reemplazar ejercicio existente
  const [exerciseSearchModal, setExerciseSearchModal] = useState({
    visible: false,
    mode: null, // 'ADD' | 'REPLACE'
    targetDia: null,
    targetExerciseId: null, // Solo usado en modo REPLACE
  });

  /* ───────── Initial Load ───────── */
  useEffect(() => {
    fetchMuscles();
    fetchAllExercises();

    // 🆕 Si hay currentRoutineId, cargar desde CurrentRoutines API
    if (currentRoutineId && isCurrentRoutine === 'true') {
      loadCurrentRoutine(currentRoutineId);
    } else if (id) {
      loadRoutine(id);
    } else {
      const init = normalizeRoutine({});
      for (let i = 1; i <= days; i++) init[`dia${i}`] = [];
      setRutina(init);
      const open = {};
      Object.keys(init).forEach((k) => (open[k] = true));
      setDiasAbiertos(open);
    }
    setTimeout(() => {
      isFirstLoad.current = false;
    }, 500);
  }, [id, currentRoutineId]);

  // 🆕 Función para cargar CurrentRoutine (rutina asignada a cliente)
  const loadCurrentRoutine = async (crId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/current-routines/${crId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        Alert.alert('Error', 'No se pudo cargar la rutina del cliente');
        return;
      }

      const data = await response.json();
      if (data.success && data.routine) {
        processRoutineData(data.routine);
        setEditingCurrentRoutineId(crId);
        if (data.routine.userId) {
          setEditingClientInfo({
            id: data.routine.userId._id || data.routine.userId,
            name: data.routine.userId.nombre || clientName || 'Cliente'
          });
        }
      }
    } catch (error) {
      console.error('Error loading CurrentRoutine:', error);
      Alert.alert('Error', 'Error de conexión al cargar rutina del cliente');
    } finally {
      setLoading(false);
    }
  };

  const fetchMuscles = async () => {
    try {
      const response = await fetch(`${API_URL}/api/exercises/muscles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setMuscles([...data.muscles, 'OTRO']);
      } else {
        setMuscles(['PECHO', 'ESPALDA', 'PIERNAS', 'HOMBRO', 'BICEPS', 'TRICEPS', 'ABDOMEN', 'CARDIO', 'OTRO']);
      }
    } catch (error) {
      setMuscles(['PECHO', 'ESPALDA', 'PIERNAS', 'HOMBRO', 'BICEPS', 'TRICEPS', 'ABDOMEN', 'CARDIO', 'OTRO']);
    }
  };

  const loadRoutine = async (routineId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/routines/${routineId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 404) {
        const listResponse = await fetch(`${API_URL}/api/routines`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const listData = await listResponse.json();

        if (listData.success && Array.isArray(listData.routines)) {
          const foundRoutine = listData.routines.find(r => r._id === routineId);
          if (foundRoutine) {
            processRoutineData(foundRoutine);
            return;
          }
        }

        if (!routineName) {
          Alert.alert('Aviso', 'No se encontró la rutina, se creará una nueva.');
          const init = normalizeRoutine({});
          for (let i = 1; i <= days; i++) init[`dia${i}`] = [];
          setRutina(init);
        }
        return;
      }

      const data = await response.json();
      if (data.success && data.routine) {
        processRoutineData(data.routine);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Error de conexión al cargar rutina');
    } finally {
      setLoading(false);
    }
  };

  const processRoutineData = (r) => {
    setRoutineName(r.nombre);
    setDays(r.dias);

    const loadedData = {};
    if (Array.isArray(r.diasArr)) {
      r.diasArr.forEach((dayExercises, idx) => {
        const dayKey = `dia${idx + 1}`;
        loadedData[dayKey] = dayExercises.map(ex => ({
          id: `ej-${uid()}`,
          musculo: ex.musculo,
          nombre: ex.nombre,
          dbId: ex.dbId,
          series: ex.series.map(s => ({
            id: `s-${uid()}`,
            repMin: s.repMin,
            repMax: s.repMax,
            extra: s.extra || 'Ninguno',
            nota: s.nota || ''
          }))
        }));
      });
    }

    for (let i = 1; i <= r.dias; i++) {
      if (!loadedData[`dia${i}`]) loadedData[`dia${i}`] = [];
    }

    setRutina(normalizeRoutine(loadedData));
    const open = {};
    Object.keys(loadedData).forEach((k) => (open[k] = true));
    setDiasAbiertos(open);
  };

  const fetchAllExercises = async () => {
    try {
      const response = await fetch(`${API_URL}/api/exercises`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setExercises(data.exercises);
      }
    } catch (error) {
      console.error('Error fetching exercises:', error);
    }
  };

  const fetchExercisesForMuscle = async (muscle) => {
    if (!muscle) {
      return;
    }
    setLoadingExercises(true);
    try {
      const response = await fetch(`${API_URL}/api/exercises?muscle=${muscle}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        // Los ejercicios ya están cargados, no necesitamos hacer nada
      }
    } catch (error) {
      // Ignorar errores
    } finally {
      setLoadingExercises(false);
    }
  };

  /* ───────── Open/close ───────── */
  const isOpen = useCallback((eid) => openSet.has(eid), [openSet]);
  const toggleOpen = useCallback((eid) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      next.has(eid) ? next.delete(eid) : next.add(eid);
      return next;
    }), []);

  const openAllInDay = useCallback((diaKey) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      for (const ej of rutina[diaKey] || []) next.add(ej.id);
      return next;
    });
  }, [rutina]);

  const closeAllInDay = useCallback((diaKey) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      for (const ej of rutina[diaKey] || []) next.delete(ej.id);
      return next;
    });
  }, [rutina]);

  /* ───────── DÍAS ───────── */
  const moveDay = useCallback((diaKey, dir) => {
    setRutina((prev) => {
      const entries = Object.entries(prev);
      const idx = entries.findIndex(([k]) => k === diaKey);
      if (idx < 0) return prev;
      const tgt = idx + dir;
      if (tgt < 0 || tgt >= entries.length) return prev;
      const tmp = entries[idx];
      entries[idx] = entries[tgt];
      entries[tgt] = tmp;
      return fromEntriesOrdered(entries);
    });
  }, []);

  const insertDayAfter = useCallback((diaKey) => {
    setRutina((prev) => {
      const entries = Object.entries(prev);
      const idx = entries.findIndex(([k]) => k === diaKey);
      const newKey = nextDayKey(entries);
      const nuevo = [newKey, []];
      const after = idx >= 0 ? idx + 1 : entries.length;
      const next = [...entries.slice(0, after), nuevo, ...entries.slice(after)];
      setDiasAbiertos((d) => ({ ...d, [newKey]: true }));
      setDays(d => d + 1);
      return fromEntriesOrdered(next);
    });
  }, []);

  const onDeleteDay = useCallback((diaKey) => {
    Alert.alert('Eliminar día', '¿Seguro que quieres eliminar este día?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setRutina((prev) => {
            const entries = Object.entries(prev).filter(([k]) => k !== diaKey);
            setDays(d => Math.max(1, d - 1));
            return fromEntriesOrdered(entries);
          });
        }
      },
    ]);
  }, []);

  const onToggleDia = useCallback((diaKey) => {
    setDiasAbiertos((prev) => ({ ...prev, [diaKey]: !prev[diaKey] }));
  }, []);

  /* ───────── EJERCICIOS ───────── */
  const moveExercise = useCallback((diaKey, ejercicioId, dir) => {
    setRutina((prev) => {
      const dayList = prev[diaKey] || [];
      const idx = dayList.findIndex((e) => e.id === ejercicioId);
      if (idx < 0) return prev;
      const tgt = idx + dir;
      if (tgt < 0 || tgt >= dayList.length) return prev;
      const newList = [...dayList];
      const tmp = newList[idx];
      newList[idx] = newList[tgt];
      newList[tgt] = tmp;
      return { ...prev, [diaKey]: newList };
    });
  }, []);

  const addExerciseAfter = useCallback((diaKey, afterId) => {
    setRutina((prev) => {
      const dayList = prev[diaKey] || [];
      const idx = dayList.findIndex((e) => e.id === afterId);
      const insertPos = idx >= 0 ? idx + 1 : dayList.length;

      const newId = `ej-${uid()}`;
      const newEj = {
        id: newId,
        musculo: '',
        nombre: '',
        dbId: null,
        series: [
          { id: `s-${newId}-0`, repMin: '8', repMax: '12', extra: 'Ninguno', nota: '' },
          { id: `s-${newId}-1`, repMin: '8', repMax: '12', extra: 'Ninguno', nota: '' },
          { id: `s-${newId}-2`, repMin: '8', repMax: '12', extra: 'Ninguno', nota: '' },
        ],
      };

      const newList = [
        ...dayList.slice(0, insertPos),
        newEj,
        ...dayList.slice(insertPos),
      ];

      setOpenSet((s) => new Set([...s, newId]));
      return { ...prev, [diaKey]: newList };
    });
  }, []);

  const addExerciseAtEnd = useCallback((diaKey) => {
    setRutina((prev) => {
      const dayList = prev[diaKey] || [];
      const newId = `ej-${uid()}`;
      const newEj = {
        id: newId,
        musculo: '',
        nombre: '',
        dbId: null,
        series: [
          { id: `s-${newId}-0`, repMin: '8', repMax: '12', extra: 'Ninguno' },
          { id: `s-${newId}-1`, repMin: '8', repMax: '12', extra: 'Ninguno' },
          { id: `s-${newId}-2`, repMin: '8', repMax: '12', extra: 'Ninguno' },
        ],
      };
      setOpenSet((s) => new Set([...s, newId]));
      return { ...prev, [diaKey]: [...dayList, newEj] };
    });
  }, []);

  const addExerciseFromSelector = useCallback(() => {
    if (!addingToDay || !selectedMuscle || !selectedExercise) {
      Alert.alert('Error', 'Selecciona músculo y ejercicio');
      return;
    }

    const diaKey = `dia${addingToDay}`;
    const exerciseObj = exercises.find(e => e._id === selectedExercise);
    const name = exerciseObj ? exerciseObj.name : selectedExercise;

    const newId = `ej-${uid()}`;
    const newEj = {
      id: newId,
      musculo: selectedMuscle,
      nombre: name,
      dbId: exerciseObj?._id || null,
      series: [
        { id: `s-${newId}-0`, repMin: '8', repMax: '12', extra: 'Ninguno' },
        { id: `s-${newId}-1`, repMin: '8', repMax: '12', extra: 'Ninguno' },
        { id: `s-${newId}-2`, repMin: '8', repMax: '12', extra: 'Ninguno' },
        { id: `s-${newId}-3`, repMin: '8', repMax: '12', extra: 'Ninguno' },
      ],
    };

    setRutina(prev => ({
      ...prev,
      [diaKey]: [...(prev[diaKey] || []), newEj]
    }));

    setOpenSet(prev => new Set(prev).add(newId));

    // Reset selector state (keep exercises list for other cards)
    setAddingToDay(null);
    setSelectedMuscle('');
    setSelectedExercise('');
  }, [addingToDay, selectedMuscle, selectedExercise, exercises]);

  const deleteExercise = useCallback((diaKey, ejercicioId) => {
    setRutina((prev) => {
      const newList = (prev[diaKey] || []).filter((e) => e.id !== ejercicioId);
      setOpenSet((s) => {
        const n = new Set(s);
        n.delete(ejercicioId);
        return n;
      });
      return { ...prev, [diaKey]: newList };
    });
  }, []);

  const updateEjercicioCampo = useCallback((diaKey, ejercicioId, campo, valor) => {
    setRutina((prev) => {
      const newList = (prev[diaKey] || []).map((e) =>
        e.id === ejercicioId ? { ...e, [campo]: valor } : e
      );
      return { ...prev, [diaKey]: newList };
    });
  }, []);

  const onMuscleChange = useCallback((diaKey, ejercicioId, muscle) => {
    setRutina((prev) => {
      const newList = (prev[diaKey] || []).map((e) =>
        e.id === ejercicioId ? { ...e, musculo: muscle, nombre: '', dbId: null } : e
      );
      return { ...prev, [diaKey]: newList };
    });
  }, []);

  const onExerciseChange = useCallback((diaKey, ejercicioId, exerciseDbId) => {
    const exercise = exercises.find(e => e._id === exerciseDbId);
    if (!exercise) return;

    setRutina((prev) => {
      const newList = (prev[diaKey] || []).map((e) =>
        e.id === ejercicioId ? { ...e, nombre: exercise.name, dbId: exercise._id } : e
      );
      return { ...prev, [diaKey]: newList };
    });
  }, [exercises]);

  // 🔍 Abrir modal para REEMPLAZAR ejercicio existente
  const openExerciseSearch = useCallback((diaKey, ejercicioId) => {
    setExerciseSearchModal({
      visible: true,
      mode: 'REPLACE',
      targetDia: diaKey,
      targetExerciseId: ejercicioId,
    });
  }, []);

  // 🔍 Abrir modal para AÑADIR ejercicio nuevo al final del día
  const openExerciseSearchForAdd = useCallback((diaKey) => {
    setExerciseSearchModal({
      visible: true,
      mode: 'ADD',
      targetDia: diaKey,
      targetExerciseId: null,
    });
  }, []);

  // 🔍 Manejar selección de ejercicio desde el modal
  const handleExerciseSelect = useCallback((exercise) => {
    const { mode, targetDia, targetExerciseId } = exerciseSearchModal;
    if (!targetDia || !exercise) return;

    if (mode === 'ADD') {
      // MODO AÑADIR: Crear ejercicio nuevo con datos ya rellenos
      const newId = `ej-${uid()}`;
      const newExercise = {
        id: newId,
        musculo: exercise.muscle,
        nombre: exercise.name,
        dbId: exercise._id,
        series: [
          { id: `s-${newId}-0`, repMin: '8', repMax: '12', extra: 'Ninguno', nota: '' },
          { id: `s-${newId}-1`, repMin: '8', repMax: '12', extra: 'Ninguno', nota: '' },
          { id: `s-${newId}-2`, repMin: '8', repMax: '12', extra: 'Ninguno', nota: '' },
        ],
      };

      setRutina((prev) => ({
        ...prev,
        [targetDia]: [...(prev[targetDia] || []), newExercise]
      }));

      // Abrir la card automáticamente
      setOpenSet((s) => new Set([...s, newId]));
    } else if (mode === 'REPLACE' && targetExerciseId) {
      // MODO REEMPLAZAR: Actualizar ejercicio existente
      setRutina((prev) => {
        const newList = (prev[targetDia] || []).map((e) =>
          e.id === targetExerciseId
            ? { ...e, nombre: exercise.name, musculo: exercise.muscle, dbId: exercise._id }
            : e
        );
        return { ...prev, [targetDia]: newList };
      });
    }
  }, [exerciseSearchModal]);

  /* ───────── SERIES ───────── */
  const updateSerieCampo = useCallback((diaKey, ejercicioId, serieId, campo, val) => {
    setRutina((prev) => {
      const newList = (prev[diaKey] || []).map((e) => {
        if (e.id !== ejercicioId) return e;
        const series = (e.series || []).map((s) =>
          s.id === serieId ? { ...s, [campo]: val } : s
        );
        return { ...e, series };
      });
      return { ...prev, [diaKey]: newList };
    });
  }, []);

  const toggleSerieExtra = useCallback((diaKey, ejercicioId, serieId) => {
    setRutina((prev) => {
      const newList = (prev[diaKey] || []).map((e) => {
        if (e.id !== ejercicioId) return e;
        const series = (e.series || []).map((s) => {
          if (s.id !== serieId) return s;
          const curr = s.extra || 'Ninguno';
          const i = EXTRA_OPCIONES.indexOf(curr);
          const next = EXTRA_OPCIONES[(i + 1) % EXTRA_OPCIONES.length];
          return { ...s, extra: next };
        });
        return { ...e, series };
      });
      return { ...prev, [diaKey]: newList };
    });
  }, []);

  // Toggle Fallo mode for a serie
  const toggleFallo = useCallback((diaKey, ejercicioId, serieId) => {
    setRutina((prev) => {
      const newList = (prev[diaKey] || []).map((e) => {
        if (e.id !== ejercicioId) return e;
        const series = (e.series || []).map((s) => {
          if (s.id !== serieId) return s;
          const isFallo = String(s.repMin).toLowerCase() === 'fallo' || String(s.repMax).toLowerCase() === 'fallo';
          if (isFallo) {
            // Volver a modo normal
            return { ...s, repMin: '8', repMax: '12' };
          } else {
            // Activar modo Fallo
            return { ...s, repMin: 'fallo', repMax: 'fallo' };
          }
        });
        return { ...e, series };
      });
      return { ...prev, [diaKey]: newList };
    });
  }, []);

  const deleteSerie = useCallback((diaKey, ejercicioId, serieId) => {
    setRutina((prev) => {
      const newList = (prev[diaKey] || []).map((e) => {
        if (e.id !== ejercicioId) return e;
        const series = (e.series || []).filter((s) => s.id !== serieId);
        return { ...e, series };
      });
      return { ...prev, [diaKey]: newList };
    });
  }, []);

  const addSerie = useCallback((diaKey, ejercicioId) => {
    setRutina((prev) => {
      const newList = (prev[diaKey] || []).map((e) => {
        if (e.id !== ejercicioId) return e;
        const newId = `s-${ejercicioId}-${(e.series?.length || 0) + 1}-${uid()}`;
        const series = [
          ...(e.series || []),
          { id: newId, repMin: '8', repMax: '12', extra: 'Ninguno', nota: '' },
        ];
        return { ...e, series };
      });
      return { ...prev, [diaKey]: newList };
    });
  }, []);

  /* ───────── Save ───────── */
  const handleSaveRoutine = async () => {
    if (!routineName.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para la rutina');
      return;
    }

    setSaving(true);
    try {
      const isFreeUser = user?.tipoUsuario === 'FREEUSER';

      if (isFreeUser) {
        // GUARDADO LOCAL para usuarios FREE
        await AsyncStorage.setItem(`routine_${id}`, JSON.stringify(rutina));

        // Actualizar metadatos en la lista 'rutinas'
        const storedRutinas = await AsyncStorage.getItem('rutinas');
        if (storedRutinas) {
          let rutinasList = JSON.parse(storedRutinas);
          const exists = rutinasList.find(r => r.id === id);
          if (exists) {
            rutinasList = rutinasList.map(r =>
              r.id === id ? { ...r, nombre: routineName, updatedAt: new Date().toISOString() } : r
            );
          } else {
            rutinasList.push({
              id: id,
              nombre: routineName,
              origen: 'local',
              updatedAt: new Date().toISOString(),
              folder: null
            });
          }
          await AsyncStorage.setItem('rutinas', JSON.stringify(rutinasList));
        }

        Alert.alert('Éxito', 'Rutina guardada localmente');
        router.back();
      } else if (editingCurrentRoutineId) {
        // 🆕 Mostrar modal de confirmación para elegir reiniciar o mantener datos
        const daysArray = [];
        const entries = Object.entries(rutina);
        for (let i = 0; i < entries.length; i++) {
          daysArray.push(entries[i][1] || []);
        }

        const payload = {
          nombre: routineName,
          dias: entries.length,
          diasArr: daysArray,
          isModified: true
        };

        // Guardar datos pendientes y mostrar modal
        setPendingSaveData(payload);
        setShowResetModal(true);
        setSaving(false);
        return; // Salir aquí, el guardado real se hace en executeCurrentRoutineSave
      } else {
        // GUARDADO EN MONGODB para usuarios PREMIUM/CLIENTE (rutinas propias)
        const daysArray = [];
        const entries = Object.entries(rutina);
        for (let i = 0; i < entries.length; i++) {
          daysArray.push(entries[i][1] || []);
        }

        const payload = {
          nombre: routineName,
          dias: entries.length,
          diasArr: daysArray,
          division: 'Personalizada',
          enfoque: 'General',
          nivel: 'Intermedio'
        };

        const endpoint = id ? `${API_URL}/api/routines/${id}` : `${API_URL}/api/routines`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (response.status === 404 && id) {
          const retryResponse = await fetch(`${API_URL}/api/routines`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
          const retryData = await retryResponse.json();

          if (retryData.success) {
            Alert.alert('Éxito', 'Rutina creada como nueva en la nube');
            router.back();
            return;
          } else {
            Alert.alert('Error', retryData.message || 'Error al guardar');
            return;
          }
        }

        const data = await response.json();

        if (data.success) {
          Alert.alert('Éxito', 'Rutina guardada en la nube');
          router.back();
        } else {
          Alert.alert('Error', data.message || 'Error al guardar');
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Error al guardar la rutina');
    } finally {
      setSaving(false);
    }
  };

  // 🆕 Función para ejecutar el guardado de CurrentRoutine después de elegir en el modal
  const executeCurrentRoutineSave = async (resetWorkouts) => {
    if (!pendingSaveData) return;

    setShowResetModal(false);
    setSaving(true);

    try {
      const payload = {
        ...pendingSaveData,
        resetWorkouts // Enviar al backend si debe reiniciar los workouts
      };

      const response = await fetch(`${API_URL}/api/current-routines/${editingCurrentRoutineId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        const clientName = editingClientInfo?.name || 'cliente';
        const message = resetWorkouts
          ? `Rutina de ${clientName} actualizada. Datos de entrenamientos reiniciados.`
          : `Rutina de ${clientName} actualizada. Datos de entrenamientos anteriores conservados.`;
        Alert.alert('Éxito', message);
        router.back();
      } else {
        Alert.alert('Error', data.message || 'Error al actualizar la rutina del cliente');
      }
    } catch (error) {
      console.error('Save CurrentRoutine error:', error);
      Alert.alert('Error', 'Error al guardar la rutina');
    } finally {
      setSaving(false);
      setPendingSaveData(null);
    }
  };

  /* ───────── Sections ───────── */
  const sections = useMemo(() => {
    return Object.entries(rutina).map(([key, list], idx) => ({
      key,
      title: key,
      ord: idx + 1,
      data: diasAbiertos[key] ? list : [],
    }));
  }, [rutina, diasAbiertos]);

  /* ───────── UI ───────── */
  const DiaHeader = ({ diaKey, ord }) => {
    const label = `Día ${Number.isFinite(Number(ord)) ? ord : 1}`;
    const expanded = !!diasAbiertos[diaKey];
    return (
      <View style={styles.sectionHeaderContainer}>
        <TouchableOpacity
          style={styles.sectionHeaderTitleContainer}
          onPress={() => onToggleDia(diaKey)}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionHeader}>{label}</Text>
          <Ionicons
            name={expanded ? 'chevron-down-outline' : 'chevron-forward-outline'}
            size={20}
            color="#64748b"
          />
        </TouchableOpacity>
        <View style={styles.sectionHeaderControls}>
          <IconBtn onPress={() => openAllInDay(diaKey)} icon="expand-outline" tint="#64748b" />
          <IconBtn onPress={() => closeAllInDay(diaKey)} icon="contract-outline" tint="#64748b" />
          <IconBtn onPress={() => moveDay(diaKey, -1)} icon="arrow-up" tint="#3b82f6" />
          <IconBtn onPress={() => moveDay(diaKey, +1)} icon="arrow-down" tint="#3b82f6" />
          <IconBtn onPress={() => insertDayAfter(diaKey)} icon="add" tint="#10b981" />
          <IconBtn onPress={() => onDeleteDay(diaKey)} icon="remove" tint="#ef4444" />
        </View>
      </View>
    );
  };

  const DiaFooter = ({ diaKey }) => {
    return (
      <View style={styles.dayFooter}>
        {/* 🆕 Botón Direct-Add: Abre modal y crea ejercicio relleno */}
        <TouchableOpacity
          style={styles.addExerciseCTA}
          onPress={() => openExerciseSearchForAdd(diaKey)}
          activeOpacity={0.88}
        >
          <Ionicons name="add-circle-outline" size={20} color="#10b981" />
          <Text style={styles.addExerciseCTATxt}>
            Añadir ejercicio
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item?.id ?? `idx-${index}-${uid()}`}
        renderItem={({ item, section, index }) => {
          // Detectar si este ejercicio tiene alguna serie marcada como biserie
          const isBiserie = (ej) => {
            if (!ej?.series || !Array.isArray(ej.series)) return false;
            return ej.series.some(serie => {
              const extra = String(serie?.extra || '').toLowerCase().trim();
              return extra === 'biserie' || extra === 'biseries' || extra === 'bs';
            });
          };

          const currentIsBiserie = isBiserie(item);
          const dayExercises = rutina[section.title] || [];
          const nextItem = dayExercises[index + 1];
          const nextIsBiserie = isBiserie(nextItem);

          // Mostrar conector "+" si este Y el siguiente son biseries
          const showBiserieConnector = currentIsBiserie && nextIsBiserie;

          return (
            <>
              <ExerciseCard
                item={item}
                section={section}
                isOpen={isOpen}
                toggleOpen={toggleOpen}
                moveExercise={moveExercise}
                addExerciseAfter={addExerciseAfter}
                deleteExercise={deleteExercise}
                updateEjercicioCampo={updateEjercicioCampo}
                addSerie={addSerie}
                updateSerieCampo={updateSerieCampo}
                toggleSerieExtra={toggleSerieExtra}
                toggleFallo={toggleFallo}
                deleteSerie={deleteSerie}
                muscles={muscles}
                exercises={exercises}
                onMuscleChange={onMuscleChange}
                onExerciseChange={onExerciseChange}
                onOpenExerciseSearch={openExerciseSearch}
                setImageModal={setImageModal}
                setVideoModal={setVideoModal}
                setTechModal={setTechModal}
                isBiserie={currentIsBiserie}
              />

              {/* Conector "+" para biseries */}
              {showBiserieConnector && (
                <View style={styles.biserieConnector}>
                  <View style={styles.biserieLine} />
                  <View style={styles.biseriePlusContainer}>
                    <Text style={styles.biseriePlusText}>+</Text>
                  </View>
                  <View style={styles.biserieLine} />
                </View>
              )}
            </>
          );
        }}
        renderSectionHeader={({ section }) => (
          <DiaHeader diaKey={section.title} ord={section.ord} />
        )}
        renderSectionFooter={({ section: { title } }) =>
          diasAbiertos[title] ? <DiaFooter diaKey={title} /> : null
        }
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        extraData={{ openSetSize: openSet.size, diasAbiertos, rutina }}
        ListHeaderComponent={
          <View style={styles.headerTop}>
            <Text style={styles.inputLabel}>
              <Ionicons name="create-outline" size={14} color="#3b82f6" /> Nombre de la rutina *
            </Text>
            <View style={[
              styles.titleInputContainer,
              !routineName?.trim() && styles.titleInputContainerEmpty
            ]}>
              <TextInput
                style={styles.titleInput}
                placeholder="Ej: Full Body Principiante, Push-Pull-Legs..."
                placeholderTextColor="#94a3b8"
                value={routineName}
                onChangeText={setRoutineName}
              />
              {!routineName?.trim() && (
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredBadgeText}>Requerido</Text>
                </View>
              )}
            </View>
          </View>
        }
        ListFooterComponent={
          <View style={{ padding: 16 }}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveRoutine}
              disabled={saving}
            >
              {user?.tipoUsuario === 'FREEUSER' && (
                <View style={styles.warningContainer}>
                  <Ionicons name="warning-outline" size={16} color="#f59e0b" />
                  <Text style={styles.warningText}>
                    Modo FREE: Las rutinas se guardan solo en este dispositivo. Pasa a Premium para sincronizar en la nube.
                  </Text>
                </View>
              )}
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar Rutina</Text>}
            </TouchableOpacity>
          </View>
        }
      />

      {/* 🆕 Modal de confirmación para reiniciar/mantener datos */}
      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="alert-circle-outline" size={48} color="#f59e0b" style={{ marginBottom: 12 }} />
            <Text style={styles.modalTitle}>¿Qué deseas hacer con los datos de entrenamientos?</Text>
            <Text style={styles.modalDescription}>
              Esta rutina tiene entrenamientos guardados. Puedes reiniciar todos los datos o mantener los datos de ejercicios que sigan existiendo.
            </Text>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonKeep]}
              onPress={() => executeCurrentRoutineSave(false)}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.modalButtonText}>Mantener datos compatibles</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonReset]}
              onPress={() => executeCurrentRoutineSave(true)}
            >
              <Ionicons name="refresh-outline" size={20} color="#fff" />
              <Text style={styles.modalButtonText}>Reiniciar todos los datos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={() => {
                setShowResetModal(false);
                setPendingSaveData(null);
              }}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🆕 Modal Técnica Correcta */}
      <Modal
        visible={techModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setTechModal(s => ({ ...s, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalCard}>
            <Pressable
              onPress={() => setTechModal(s => ({ ...s, visible: false }))}
              style={styles.previewModalClose}
            >
              <Ionicons name="close-outline" size={24} color="#1e293b" />
            </Pressable>

            <Text style={styles.previewModalTitle}>📖 Técnica: {techModal.title}</Text>
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

      {/* 🆕 Modal Video */}
      <Modal
        visible={videoModal.visible}
        transparent
        animationType={Platform.OS === 'android' ? 'slide' : 'fade'}
        onRequestClose={() => setVideoModal(s => ({ ...s, visible: false, playing: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.videoModalCard}>
            <View style={styles.videoModalHeader}>
              <Text style={styles.previewModalTitle} numberOfLines={2}>
                🎬 {videoModal.title}
              </Text>
              <Pressable
                onPress={() => setVideoModal(s => ({ ...s, visible: false, playing: false }))}
                style={styles.previewModalClose}
              >
                <Ionicons name="close-outline" size={24} color="#1e293b" />
              </Pressable>
            </View>
            {videoModal.videoId ? (() => {
              const screenWidth = Dimensions.get('window').width;
              const videoWidth = screenWidth < 600
                ? screenWidth * 0.85
                : Math.min(screenWidth * 0.5, 500);
              const videoHeight = videoWidth * 9 / 16;

              if (Platform.OS === 'web') {
                return (
                  <iframe
                    width={videoWidth}
                    height={videoHeight}
                    src={`https://www.youtube.com/embed/${videoModal.videoId}?autoplay=1&rel=0`}
                    title="YouTube video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ borderRadius: 8 }}
                  />
                );
              }

              return (
                <YoutubeIframe
                  height={videoHeight}
                  width={videoWidth}
                  play={videoModal.playing}
                  videoId={videoModal.videoId}
                  onChangeState={(st) => {
                    if (st === 'ended' || st === 'error') {
                      setVideoModal(s => ({ ...s, playing: false, visible: false }));
                    }
                  }}
                />
              );
            })() : (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Ionicons name="videocam-off-outline" size={48} color="#94a3b8" />
                <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 16, textAlign: 'center' }}>
                  Vídeo no disponible
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 🆕 Modal Imagen del Ejercicio */}
      <Modal
        visible={imageModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModal({ visible: false, imageUrl: null, title: '' })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.imageModalCard}>
            <View style={styles.videoModalHeader}>
              <Text style={styles.previewModalTitle} numberOfLines={2}>
                📸 {imageModal.title}
              </Text>
              <Pressable
                onPress={() => setImageModal({ visible: false, imageUrl: null, title: '' })}
                style={styles.previewModalClose}
              >
                <Ionicons name="close-outline" size={24} color="#1e293b" />
              </Pressable>
            </View>
            {imageModal.imageUrl ? (
              <Image
                source={{ uri: imageModal.imageUrl }}
                style={styles.exerciseImageFull}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>
                Imagen no disponible
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* 🔍 Modal de Búsqueda de Ejercicios */}
      <ExerciseSearchModal
        visible={exerciseSearchModal.visible}
        onClose={() => setExerciseSearchModal({ visible: false, mode: null, targetDia: null, targetExerciseId: null })}
        onSelect={handleExerciseSelect}
        exercises={exercises}
        muscles={muscles}
      />
    </View>
  );
}

/* ───────── IconBtn ───────── */
function IconBtn({ onPress, icon, tint }) {
  const finalTint = tint || '#64748b';

  const map = {
    'arrow-up': 'arrow-up-outline',
    'arrow-down': 'arrow-down-outline',
    add: 'add-circle-outline',
    remove: 'remove-circle-outline',
    'chevron-down': 'chevron-down-outline',
    'chevron-forward': 'chevron-forward-outline',
    'close-circle': 'close-circle-outline',
    'expand-outline': 'expand-outline',
    'contract-outline': 'contract-outline',
  };
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.iconBtnRound}>
      <Ionicons name={map[icon]} size={18} color={finalTint} />
    </TouchableOpacity>
  );
}

/* ───────── Styles ───────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  headerTop: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 0.6,
    borderBottomColor: '#e2e8f0',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 8,
  },
  titleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  titleInputContainerEmpty: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  titleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    paddingVertical: 10,
  },
  requiredBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  requiredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d97706',
  },

  /* Día */
  sectionHeaderContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 0.6,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  sectionHeaderControls: { flexDirection: 'row', alignItems: 'center' },

  dayFooter: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 0.6,
    borderTopColor: '#f1f5f9',
  },

  // 🔍 Estilos del botón de búsqueda de ejercicio
  exerciseSearchButton: {
    marginTop: 10,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    borderStyle: 'dashed',
  },
  exerciseSearchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  exerciseSearchName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  exerciseSearchMuscle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  exerciseSearchPlaceholder: {
    fontSize: 14,
    color: '#64748b',
  },

  addExerciseCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  addExerciseCTATxt: { fontWeight: '700', fontSize: 13, color: '#15803d' },

  iconBtnRound: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 999,
    marginLeft: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  /* Card ejercicio */
  card: {
    marginHorizontal: 8,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 0.6,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  cardHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.6,
    borderBottomColor: '#f1f5f9',
  },
  cardHeaderTouchable: { flex: 1 },
  cardHeader: { fontSize: 14, fontWeight: '700', color: '#334155' },
  moveControls: { flexDirection: 'row', alignItems: 'center' },

  validationBadge: {
    padding: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },

  /* Bloque edición */
  editBlock: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineLabel: { width: 70, fontSize: 12, fontWeight: '600', color: '#64748b', padding: 10 },
  inlineInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    color: '#1e293b',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    padding: 10,
  },

  // Contenedor de series con overflow hidden
  seriesContainer: {
    paddingHorizontal: 6,
    paddingBottom: 10,
    overflow: 'hidden',
  },

  /* Series - Layout de columnas alineadas */
  serieHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  // Estilos para columnas del header (porcentuales)
  headColS: { width: '8%', fontSize: 10, fontWeight: '700', color: '#64748b', textAlign: 'center' },
  headColFallo: { width: '17%', fontSize: 10, fontWeight: '700', color: '#64748b', textAlign: 'center' },
  headColReps: { width: '25%', fontSize: 10, fontWeight: '700', color: '#64748b', textAlign: 'center' },
  headColTecnica: { width: '40%', fontSize: 10, fontWeight: '700', color: '#64748b', textAlign: 'center' },
  headColDelete: { width: '10%' },

  serieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.6,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginTop: 8,
    overflow: 'hidden',
  },

  // Columnas con anchos porcentuales para responsive
  colS: { width: '8%', alignItems: 'center', justifyContent: 'center' },
  colFallo: { width: '17%', alignItems: 'center', justifyContent: 'center' },
  colReps: { width: '25%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  colTecnica: { width: '40%', alignItems: 'center' },
  colDelete: { width: '10%', alignItems: 'center' },

  serieLabel: { fontSize: 10, color: '#334155', fontWeight: '700' },
  miniIcon: { fontSize: 8, marginLeft: 1 },

  serieInputSmall: {
    flex: 1,
    maxWidth: 28,
    minWidth: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    color: '#1e293b',
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 1,
    fontSize: 10,
    textAlign: 'center',
  },
  repsSeparator: { color: '#94a3b8', fontSize: 10, marginHorizontal: 1 },
  falloIndicatorSmall: { fontSize: 8, color: '#ef4444', fontWeight: '600' },

  extraPillCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  extraPillTxtCompact: { fontSize: 10, fontWeight: '600', color: '#475569' },

  extraPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  extraPillTxt: { fontSize: 12, fontWeight: '700', color: '#334155' },

  addSerieBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  addSerieTxt: { fontWeight: '800', fontSize: 13, color: '#15803d' },

  // Contenedor de serie con nota
  serieRowContainer: {
    marginBottom: 8,
  },
  notaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notaInput: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    paddingVertical: 2,
  },

  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#3b82f6',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Selector
  selectorContainer: {
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  pickerGroup: { marginBottom: 12 },
  pickerLabel: { fontSize: 14, fontWeight: '600', color: '#0369a1', marginBottom: 0 },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0073ffff',
    overflow: 'hidden',
    minHeight: Platform.OS === 'android' ? 56 : 50,
    justifyContent: 'center',
  },
  picker: {
    height: Platform.OS === 'android' ? 56 : 50,
    width: '100%',
    color: '#1e293b',
    fontSize: 15,
  },
  pickerItemStyle: {
    fontSize: 15,
    color: '#1e293b',
    paddingVertical: 8,
  },
  confirmAddBtn: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmAddText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  // iOS ActionSheet button styles
  iosPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0073ffff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 50,
  },
  iosPickerText: {
    fontSize: 16,
    color: '#1e293b',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },
  // 🆕 Estilos del modal de confirmación
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '100%',
    marginBottom: 10,
  },
  modalButtonKeep: {
    backgroundColor: '#10b981',
  },
  modalButtonReset: {
    backgroundColor: '#ef4444',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonCancel: {
    marginTop: 8,
    paddingVertical: 10,
  },
  modalCancelText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  // 🔥 Estilos para Fallo y Biserie
  falloBtn: {
    minWidth: 50,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  falloBtnActive: {
    backgroundColor: '#ef4444',
  },
  falloBtnTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ef4444',
  },
  falloBtnTxtActive: {
    color: '#fff',
  },
  falloIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  falloIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  falloBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  falloBadgeText: {
    fontSize: 10,
  },
  biserieBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biserieBadgeText: {
    fontSize: 10,
  },
  serieRowBiserie: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 6,
  },
  extraPillBiserie: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  extraPillTxtBiserie: {
    color: '#92400e',
  },
  // Conectores de biseries
  biserieConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    marginHorizontal: 20,
    zIndex: 10,
    marginTop: -6,
    marginBottom: -6,
  },
  biserieLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#F59E0B',
  },
  biseriePlusContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  biseriePlusText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: -1,
  },
  cardBiserie: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  // 🆕 Estilos para Vista Previa del Ejercicio
  previewContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0369a1',
    marginBottom: 12,
    textAlign: 'center',
  },
  previewImageContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
  },
  // 📷 Estilos de botones de preview (Imagen, Técnica, Video)
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  previewBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    minHeight: 56,
  },
  previewBtnDisabled: {
    opacity: 0.45,
    backgroundColor: '#fafafa',
    borderColor: '#f1f1f1',
  },
  previewBtnTxt: {
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  previewBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginTop: 2,
  },
  previewBtnTxtDisabled: {
    color: '#94a3b8',
  },
  // Estilos para modales de vista previa
  previewModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  previewModalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  previewModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
    paddingRight: 30,
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingRight: 8,
  },
  tipBullet: {
    color: '#3b82f6',
    fontSize: 16,
    marginRight: 8,
    fontWeight: '700',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  videoModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '95%',
    maxWidth: 550,
    alignItems: 'center',
  },
  videoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 12,
  },
  imageModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '95%',
    maxWidth: 500,
    alignItems: 'center',
  },
  exerciseImageFull: {
    width: '100%',
    height: 350,
    borderRadius: 8,
  },
});
