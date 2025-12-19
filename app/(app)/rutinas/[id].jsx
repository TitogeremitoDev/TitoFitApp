// app/(app)/rutinas/[id].jsx
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
  Platform,
  Modal,
  ScrollView,
  Pressable,
  ActionSheetIOS
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXTRA_OPCIONES = ['Ninguno', 'Descendentes', 'Mio Reps', 'Parciales'];

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

const SerieRow = React.memo(({ diaKey, ejercicioId, s, index, updateSerieCampo, toggleSerieExtra, deleteSerie }) => {
  return (
    <View style={styles.serieRow}>
      <Text style={styles.serieLabel}>Serie {index + 1}</Text>

      <TextInput
        style={styles.serieInput}
        placeholder="min"
        keyboardType="numeric"
        value={String(s.repMin ?? '')}
        onChangeText={(v) => updateSerieCampo(diaKey, ejercicioId, s.id, 'repMin', v)}
      />
      <Text style={{ marginHorizontal: 6, color: '#94a3b8' }}>–</Text>
      <TextInput
        style={styles.serieInput}
        placeholder="max"
        keyboardType="numeric"
        value={String(s.repMax ?? '')}
        onChangeText={(v) => updateSerieCampo(diaKey, ejercicioId, s.id, 'repMax', v)}
      />

      <TouchableOpacity
        style={styles.extraPill}
        onPress={() => toggleSerieExtra(diaKey, ejercicioId, s.id)}
      >
        <Text style={styles.extraPillTxt}>{s.extra || 'Ninguno'}</Text>
        <Ionicons name="chevron-down-outline" size={16} color="#475569" />
      </TouchableOpacity>

      <IconBtn
        onPress={() => deleteSerie(diaKey, ejercicioId, s.id)}
        icon="close-circle"
        tint="#ef4444"
      />
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
  deleteSerie,
  muscles,
  exercises,
  onMuscleChange,
  onExerciseChange,
}) => {
  const diaKey = section.title;
  const abierto = isOpen(item.id);
  const isValidated = !!item.dbId || exercises.some(e => e.name === item.nombre && e.muscle === item.musculo);

  return (
    <View style={styles.card}>
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
          <View style={styles.inlineRow}>
            <Text style={styles.inlineLabel}>Músculo</Text>
            {Platform.OS === 'ios' ? (
              <TouchableOpacity
                style={[styles.iosPickerButton, { flex: 1 }]}
                onPress={() => {
                  const options = ['Cancelar', ...muscles];
                  ActionSheetIOS.showActionSheetWithOptions(
                    { options, cancelButtonIndex: 0, title: 'Seleccionar Músculo' },
                    (buttonIndex) => {
                      if (buttonIndex > 0) {
                        onMuscleChange(diaKey, item.id, muscles[buttonIndex - 1]);
                      }
                    }
                  );
                }}
              >
                <Text style={[styles.iosPickerText, !item.musculo && { color: '#94a3b8' }]}>
                  {item.musculo || 'Seleccionar...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#64748b" />
              </TouchableOpacity>
            ) : (
              <View style={[styles.pickerWrapper, { flex: 1 }]}>
                <Picker
                  selectedValue={item.musculo ?? ''}
                  onValueChange={(val) => onMuscleChange(diaKey, item.id, val)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar..." value="" />
                  {muscles.map(m => <Picker.Item key={m} label={m} value={m} />)}
                </Picker>
              </View>
            )}
          </View>

          <View style={[styles.inlineRow, { marginTop: 8 }]}>
            <Text style={styles.inlineLabel}>Ejercicio</Text>
            {Platform.OS === 'ios' ? (
              <TouchableOpacity
                style={[styles.iosPickerButton, { flex: 1 }, !item.musculo && { opacity: 0.5 }]}
                disabled={!item.musculo}
                onPress={() => {
                  const filteredExercises = exercises.filter(e => e.muscle === item.musculo);
                  const options = ['Cancelar', ...filteredExercises.map(e => e.name)];
                  ActionSheetIOS.showActionSheetWithOptions(
                    { options, cancelButtonIndex: 0, title: 'Seleccionar Ejercicio' },
                    (buttonIndex) => {
                      if (buttonIndex > 0) {
                        onExerciseChange(diaKey, item.id, filteredExercises[buttonIndex - 1]._id);
                      }
                    }
                  );
                }}
              >
                <Text style={[styles.iosPickerText, !item.nombre && { color: '#94a3b8' }]}>
                  {item.nombre || (item.musculo ? 'Seleccionar...' : 'Primero selecciona músculo')}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#64748b" />
              </TouchableOpacity>
            ) : (
              <View style={[styles.pickerWrapper, { flex: 1 }]}>
                <Picker
                  selectedValue={item.dbId || exercises.find(e => e.name === item.nombre && e.muscle === item.musculo)?._id || ''}
                  onValueChange={(val) => onExerciseChange(diaKey, item.id, val)}
                  style={styles.picker}
                  enabled={!!item.musculo}
                >
                  <Picker.Item label={item.musculo ? "Seleccionar..." : "Primero selecciona músculo"} value="" />
                  {exercises.filter(e => e.muscle === item.musculo).map(e => (
                    <Picker.Item key={e._id} label={e.name} value={e._id} />
                  ))}
                </Picker>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Series */}
      {abierto && (
        <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
          <View style={styles.serieHeadRow}>
            <Text style={[styles.serieLabel, { fontWeight: '700' }]}>#</Text>
            <Text style={styles.headCol}>Min</Text>
            <Text style={styles.headCol}>Max</Text>
            <Text style={[styles.headCol, { flex: 1, textAlign: 'left' }]}>Técnica</Text>
            <Text style={{ width: 28 }} />
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
      )}
    </View>
  );
});

/* ───────────────────────── Main Component ───────────────────────── */
export default function UserRoutineEditorScreen() {
  const router = useRouter();
  const { id, name, days: paramDays } = useLocalSearchParams();
  const { token, user } = useAuth();
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const [routineName, setRoutineName] = useState(name || '');
  const [days, setDays] = useState(paramDays ? parseInt(paramDays) : 3);
  const [rutina, setRutina] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [diasAbiertos, setDiasAbiertos] = useState({});
  const [openSet, setOpenSet] = useState(new Set());

  // Selector State
  const [muscles, setMuscles] = useState([]);
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [addingToDay, setAddingToDay] = useState(null);

  // 🔒 Estado para detectar si es rutina de entrenador (no editable)
  const [isTrainerRoutine, setIsTrainerRoutine] = useState(false);

  const isFirstLoad = useRef(true);

  /* ───────── Initial Load ───────── */
  useEffect(() => {
    fetchMuscles();
    fetchAllExercises();
    if (id) {
      // 🔒 Detectar si es rutina de entrenador (prefijo srv_)
      if (id.startsWith('srv_')) {
        setIsTrainerRoutine(true);
      }
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
  }, [id]);

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
      // 1. Intentar cargar desde AsyncStorage (Local)
      const localData = await AsyncStorage.getItem(`routine_${routineId}`);

      if (localData) {
        const parsedData = JSON.parse(localData);
        // Si viene de AsyncStorage, probablemente es el objeto directo de días
        const diasKeys = Object.keys(parsedData).filter(k => k.startsWith('dia'));
        const diasCount = diasKeys.length;

        setRutina(normalizeRoutine(parsedData));
        setDays(diasCount || 1);

        const open = {};
        Object.keys(parsedData).forEach((k) => (open[k] = true));
        setDiasAbiertos(open);
        setLoading(false);
        return;
      }

      // 🆕 Si es un ID local (r-xxx) y no hay datos, inicializar vacío
      // No intentar cargar de API porque no existe ahí
      const isLocalId = routineId && routineId.startsWith('r-');
      if (isLocalId) {
        console.log('[Rutinas] ID local sin datos, inicializando rutina vacía');
        const init = normalizeRoutine({});
        for (let i = 1; i <= days; i++) init[`dia${i}`] = [];
        setRutina(init);
        const open = {};
        Object.keys(init).forEach((k) => (open[k] = true));
        setDiasAbiertos(open);
        setLoading(false);
        return;
      }

      // 2. Si no está en local y es ID de MongoDB, intentar API (Server/Premium)
      const response = await fetch(`${API_URL}/api/routines/${routineId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 404) {
        if (!routineName) {
          Alert.alert('Aviso', 'No se encontró la rutina, se creará una nueva.');
        }
        const init = normalizeRoutine({});
        for (let i = 1; i <= days; i++) init[`dia${i}`] = [];
        setRutina(init);
        return;
      }

      const data = await response.json();
      if (data.success && data.routine) {
        processRoutineData(data.routine);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Error al cargar rutina');
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

    // 🔒 Detectar si tiene trainerId (rutina asignada por entrenador)
    if (r.trainerId) {
      setIsTrainerRoutine(true);
    }
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
        // Los ejercicios ya están cargados
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
          { id: `s-${newId}-0`, repMin: '8', repMax: '12', extra: 'Ninguno' },
          { id: `s-${newId}-1`, repMin: '8', repMax: '12', extra: 'Ninguno' },
          { id: `s-${newId}-2`, repMin: '8', repMax: '12', extra: 'Ninguno' },
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

    // Reset
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
          { id: newId, repMin: '8', repMax: '12', extra: 'Ninguno' },
        ];
        return { ...e, series };
      });
      return { ...prev, [diaKey]: newList };
    });
  }, []);

  /* ───────── Save ───────── */
  const handleSaveRoutine = async () => {
    // 🔒 Bloquear si es rutina de entrenador
    if (isTrainerRoutine) {
      Alert.alert(
        '🔒 Rutina Bloqueada',
        'Esta rutina fue asignada por tu entrenador y no puede ser modificada. Contacta con tu entrenador si necesitas cambios.',
        [{ text: 'Entendido', style: 'default' }]
      );
      return;
    }

    if (!routineName.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para la rutina');
      return;
    }

    setSaving(true);

    // VERIFICAR SI ES USUARIO FREE
    const isFreeUser = user?.tipoUsuario === 'FREEUSER';

    try {
      const daysArray = [];
      const entries = Object.entries(rutina);
      for (let i = 0; i < entries.length; i++) {
        daysArray.push(entries[i][1] || []);
      }

      // SI ES FREEUSER, GUARDAR SOLO EN LOCAL
      if (isFreeUser) {
        try {
          // Guardar en AsyncStorage
          await AsyncStorage.setItem(`routine_${id}`, JSON.stringify(rutina));

          // Actualizar la lista de rutinas en AsyncStorage
          const rutinasStr = await AsyncStorage.getItem('rutinas');
          let rutinas = rutinasStr ? JSON.parse(rutinasStr) : [];

          const existingIndex = rutinas.findIndex(r => r.id === id);
          if (existingIndex >= 0) {
            // Actualizar rutina existente
            rutinas[existingIndex] = {
              ...rutinas[existingIndex],
              nombre: routineName,
              updatedAt: new Date().toISOString()
            };
          } else {
            // Agregar nueva rutina
            rutinas.push({
              id: id,
              nombre: routineName,
              origen: 'local',
              updatedAt: new Date().toISOString(),
              folder: null
            });
          }

          await AsyncStorage.setItem('rutinas', JSON.stringify(rutinas));

          // Mostrar aviso de usuario FREE
          if (Platform.OS === 'web') {
            const goToPremium = window.confirm('⚠️ RUTINA GUARDADA LOCALMENTE\n\nComo usuario gratuito, tu rutina se ha guardado solo en tu dispositivo. Para sincronizar en la nube y acceder desde cualquier lugar, mejora a Premium.\n\n¿Quieres mejorar a Premium ahora?');
            if (goToPremium) {
              window.location.href = '../payment';
            } else {
              router.back();
            }
          } else {
            Alert.alert(
              '⚠️ Rutina Guardada Localmente',
              'Como usuario gratuito, tu rutina se ha guardado solo en tu dispositivo. Para sincronizar en la nube y acceder desde cualquier lugar, mejora a Premium.',
              [
                { text: 'Ahora no', style: 'cancel', onPress: () => router.back() },
                { text: 'Mejorar a Premium', style: 'default', onPress: () => router.push('../payment') }
              ]
            );
            return;
          }
        } catch (error) {
          console.error('Error guardando localmente:', error);
          Alert.alert('Error', 'No se pudo guardar la rutina localmente');
        }
        setSaving(false);
        return;
      }

      // SI NO ES FREEUSER, GUARDAR EN MONGODB (CÓDIGO EXISTENTE)
      const payload = {
        nombre: routineName,
        dias: entries.length,
        diasArr: daysArray,
        division: 'Personalizada',
        enfoque: 'General',
        nivel: 'Intermedio'
      };

      // VERIFICAR SI EL ID ES LOCAL O DE MONGODB
      const isLocalId = id && (id.startsWith('r-') || (id.length !== 24));

      // Si es ID local, siempre crear nueva rutina (POST)
      // Si es ID de MongoDB válido (24 caracteres hex), intentar actualizar (PUT)
      const endpoint = (id && !isLocalId) ? `${API_URL}/api/routines/${id}` : `${API_URL}/api/routines`;
      const method = (id && !isLocalId) ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      // Si el PUT falla con 404, intentar crear nueva rutina
      if (response.status === 404 && id && !isLocalId) {
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
          // ACTUALIZAR AsyncStorage con el nuevo ID
          if (isLocalId && retryData.routine?._id) {
            const newMongoId = retryData.routine._id;
            const rutinasStr = await AsyncStorage.getItem('rutinas');
            if (rutinasStr) {
              const rutinas = JSON.parse(rutinasStr);
              const updatedRutinas = rutinas.map(r =>
                r.id === id ? { ...r, id: newMongoId, origen: 'server' } : r
              );
              await AsyncStorage.setItem('rutinas', JSON.stringify(updatedRutinas));

              // 🆕 Cachear el contenido con el nuevo ID
              await AsyncStorage.setItem(`routine_${newMongoId}`, JSON.stringify(rutina));

              await AsyncStorage.removeItem(`routine_${id}`);
            }
          }
          Alert.alert('Éxito', 'Rutina creada como nueva');
          router.back();
          return;
        } else {
          Alert.alert('Error', retryData.message || 'Error al guardar');
          return;
        }
      }

      const data = await response.json();

      if (data.success) {
        // Si era ID local y se creó correctamente, actualizar AsyncStorage
        if (isLocalId && data.routine?._id && method === 'POST') {
          const newMongoId = data.routine._id;
          const rutinasStr = await AsyncStorage.getItem('rutinas');
          if (rutinasStr) {
            const rutinas = JSON.parse(rutinasStr);
            const updatedRutinas = rutinas.map(r =>
              r.id === id ? { ...r, id: newMongoId, origen: 'server' } : r
            );
            await AsyncStorage.setItem('rutinas', JSON.stringify(updatedRutinas));

            // 🆕 Cachear el contenido de la rutina con el nuevo ID para uso inmediato
            await AsyncStorage.setItem(`routine_${newMongoId}`, JSON.stringify(rutina));
            console.log('[Rutinas] ✅ Rutina cacheada con nuevo ID:', newMongoId);

            // Eliminar el storage local con el ID viejo
            await AsyncStorage.removeItem(`routine_${id}`);
          }
        }
        Alert.alert('Éxito', 'Rutina guardada');
        router.back();
      } else {
        Alert.alert('Error', data.message || 'Error al guardar');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
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
    const dayNum = parseInt(diaKey.replace('dia', ''));
    const isAdding = addingToDay === dayNum;

    return (
      <View style={styles.dayFooter}>
        {isAdding && (
          <View style={styles.selectorContainer}>
            <View style={styles.pickerGroup}>
              <Text style={styles.pickerLabel}>Músculo</Text>
              {Platform.OS === 'ios' ? (
                <TouchableOpacity
                  style={styles.iosPickerButton}
                  onPress={() => {
                    const options = ['Cancelar', ...muscles];
                    ActionSheetIOS.showActionSheetWithOptions(
                      { options, cancelButtonIndex: 0, title: 'Seleccionar Músculo' },
                      (buttonIndex) => {
                        if (buttonIndex > 0) {
                          const selected = muscles[buttonIndex - 1];
                          setSelectedMuscle(selected);
                          fetchExercisesForMuscle(selected);
                        }
                      }
                    );
                  }}
                >
                  <Text style={[styles.iosPickerText, !selectedMuscle && { color: '#94a3b8' }]}>
                    {selectedMuscle || 'Seleccionar...'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#64748b" />
                </TouchableOpacity>
              ) : (
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedMuscle}
                    onValueChange={(val) => {
                      setSelectedMuscle(val);
                      fetchExercisesForMuscle(val);
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccionar..." value="" />
                    {muscles.map(m => <Picker.Item key={m} label={m} value={m} />)}
                  </Picker>
                </View>
              )}
            </View>

            {selectedMuscle && (
              <View style={styles.pickerGroup}>
                <Text style={styles.pickerLabel}>Ejercicio</Text>
                {loadingExercises ? (
                  <ActivityIndicator color="#3b82f6" style={{ padding: 14 }} />
                ) : Platform.OS === 'ios' ? (
                  <TouchableOpacity
                    style={styles.iosPickerButton}
                    onPress={() => {
                      const filteredExercises = exercises.filter(e => e.muscle === selectedMuscle);
                      const options = ['Cancelar', ...filteredExercises.map(e => e.name)];
                      ActionSheetIOS.showActionSheetWithOptions(
                        { options, cancelButtonIndex: 0, title: 'Seleccionar Ejercicio' },
                        (buttonIndex) => {
                          if (buttonIndex > 0) {
                            const selected = filteredExercises[buttonIndex - 1];
                            setSelectedExercise(selected._id);
                          }
                        }
                      );
                    }}
                  >
                    <Text style={[styles.iosPickerText, !selectedExercise && { color: '#94a3b8' }]}>
                      {exercises.find(e => e._id === selectedExercise)?.name || 'Seleccionar...'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#64748b" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={selectedExercise}
                      onValueChange={setSelectedExercise}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {exercises.filter(e => e.muscle === selectedMuscle).map(e => (
                        <Picker.Item key={e._id} label={e.name} value={e._id} />
                      ))}
                    </Picker>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmAddBtn, !selectedExercise && { backgroundColor: '#94a3b8' }]}
              onPress={addExerciseFromSelector}
              disabled={!selectedExercise}
            >
              <Text style={styles.confirmAddText}>Guardar Ejercicio</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.addExerciseCTA, isAdding && { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
          onPress={() => {
            if (isAdding) {
              setAddingToDay(null);
              setSelectedMuscle('');
              setSelectedExercise('');
            } else {
              setAddingToDay(dayNum);
            }
          }}
          activeOpacity={0.88}
        >
          <Ionicons name={isAdding ? "close-circle-outline" : "add-circle-outline"} size={20} color={isAdding ? "#ef4444" : "#10b981"} />
          <Text style={[styles.addExerciseCTATxt, isAdding && { color: '#ef4444' }]}>
            {isAdding ? 'Cancelar' : 'Añadir ejercicio'}
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
        renderItem={({ item, section }) => (
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
            deleteSerie={deleteSerie}
            muscles={muscles}
            exercises={exercises}
            onMuscleChange={onMuscleChange}
            onExerciseChange={onExerciseChange}
          />
        )}
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
            <TextInput
              style={styles.titleInput}
              placeholder="Nombre de la rutina"
              value={routineName}
              onChangeText={setRoutineName}
            />
          </View>
        }
        ListFooterComponent={
          <View style={{ padding: 16 }}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveRoutine}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar Rutina</Text>}
            </TouchableOpacity>
          </View>
        }
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
  titleInput: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    borderColor: '#656b72ff',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    paddingBottom: 6,
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
    marginHorizontal: 12,
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

  /* Series */
  serieHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  headCol: { flex: 1, textAlign: 'center', fontWeight: '700', color: '#334155' },

  serieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.6,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  serieLabel: { width: 50, fontSize: 12, color: '#334155' },
  serieInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    color: '#1e293b',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 12,
    textAlign: 'center',
    width: 40,
    marginLeft: 6,
  },

  extraPill: {
    flex: 2,  // ✅ CAMBIAR de 1 a 2 para más espacio
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,  // ✅ CAMBIAR de 6 a 4
    marginLeft: 8,  // ✅ CAMBIAR (eliminar duplicado)
    paddingHorizontal: 8,  // ✅ CAMBIAR de 12 a 8
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  extraPillTxt: { fontSize: 10, fontWeight: '600', color: '#334155' },
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
  pickerLabel: { fontSize: 14, fontWeight: '600', color: '#0369a1', marginBottom: 4 },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0073ffff',
    overflow: 'hidden',
    minHeight: 50,
    justifyContent: 'center',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  // iOS ActionSheet button style
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
  confirmAddBtn: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmAddText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
  ;