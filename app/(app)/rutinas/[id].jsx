// app/rutinas/[id].jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';

const EXTRA_OPCIONES = ['Ninguno', 'Descendentes', 'Mio Reps', 'Parciales'];
const STORAGE_PREFIX = 'routine_';

/* ───────────────────────── Helpers de IDs y normalización ───────────────────────── */
const uid = () =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(4);

/** Garantiza: día1..n, todos los ejercicios con id y series con id/valores por defecto */
const normalizeRoutine = (input) => {
  const out = {};
  const entries = Object.entries(input || {});
  const base = entries.length ? entries : [['dia1', []]];

  base.forEach(([_, list], dIdx) => {
    const dayKey = `dia${dIdx + 1}`; // desde 1
    const safeList = Array.isArray(list) ? list : [];
    const normList = safeList.map((ej) => {
      const ejId = ej?.id ?? `ej-${uid()}`;
      const rawSeries = Array.isArray(ej?.series) ? ej.series : [];
      const series = rawSeries.map((s, sIdx) => ({
        ...s,
        id: s?.id ?? `s-${ejId}-${sIdx}-${uid()}`,
        repMin: s?.repMin ?? '6',
        repMax: s?.repMax ?? '8',
        extra: s?.extra ?? 'Ninguno',
      }));
      return {
        musculo: '',
        nombre: '',
        extra: 'Ninguno',
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

/* ───────────────────────────────── Componentes Extraídos ─────────────────────────────── */

const SerieRow = React.memo(({ diaKey, ejercicioId, s, index, theme, updateSerieCampo, toggleSerieExtra, deleteSerie }) => {
  return (
    <View style={[styles.serieRow, { borderColor: theme.border, backgroundColor: theme.inputBackground }]}>
      <Text style={[styles.serieLabel, { color: theme.text }]}>Serie {index + 1}</Text>

      <TextInput
        style={[styles.serieInput, {
          borderColor: theme.inputBorder,
          backgroundColor: theme.inputBackground,
          color: theme.inputText
        }]}
        placeholder="min"
        placeholderTextColor={theme.placeholder}
        keyboardType="numeric"
        value={String(s.repMin ?? '')}
        onChangeText={(v) =>
          updateSerieCampo(diaKey, ejercicioId, s.id, 'repMin', v)
        }
      />
      <Text style={{ marginHorizontal: 6, color: theme.textTertiary }}>–</Text>
      <TextInput
        style={[styles.serieInput, {
          borderColor: theme.inputBorder,
          backgroundColor: theme.inputBackground,
          color: theme.inputText
        }]}
        placeholder="max"
        placeholderTextColor={theme.placeholder}
        keyboardType="numeric"
        value={String(s.repMax ?? '')}
        onChangeText={(v) =>
          updateSerieCampo(diaKey, ejercicioId, s.id, 'repMax', v)
        }
      />

      <TouchableOpacity
        style={[styles.extraPill, { borderColor: theme.inputBorder, backgroundColor: theme.backgroundTertiary }]}
        onPress={() => toggleSerieExtra(diaKey, ejercicioId, s.id)}
      >
        <Text style={[styles.extraPillTxt, { color: theme.text }]}>{s.extra || 'Ninguno'}</Text>
        <Ionicons name="chevron-down-outline" size={16} color={theme.text} />
      </TouchableOpacity>

      <View style={{ flex: 1 }} />

      <IconBtn
        onPress={() => deleteSerie(diaKey, ejercicioId, s.id)}
        icon="close-circle"
        tint={theme.danger}
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
  theme
}) => {
  const diaKey = section.title;
  const abierto = isOpen(item.id);

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
      {/* Header ejercicio */}
      <View style={[styles.cardHeaderContainer, { borderColor: theme.cardHeaderBorder }]}>
        <TouchableOpacity
          onPress={() => toggleOpen(item.id)}
          style={styles.cardHeaderTouchable}
        >
          <Text style={[styles.cardHeader, { color: theme.text }]}>
            {(item.musculo || 'MÚSCULO')} — {(item.nombre || 'Nombre ejercicio')}
          </Text>
        </TouchableOpacity>

        <View style={styles.moveControls}>
          <IconBtn onPress={() => moveExercise(diaKey, item.id, -1)} icon="arrow-up" tint={theme.primary} />
          <IconBtn onPress={() => moveExercise(diaKey, item.id, +1)} icon="arrow-down" tint={theme.primary} />
          <IconBtn onPress={() => addExerciseAfter(diaKey, item.id)} icon="add" tint={theme.success} />
          <IconBtn onPress={() => deleteExercise(diaKey, item.id)} icon="remove" tint={theme.danger} />
          <IconBtn onPress={() => toggleOpen(item.id)} icon={abierto ? 'chevron-down' : 'chevron-forward'} tint={theme.textSecondary} />
        </View>
      </View>

      {/* Editar musculo / nombre */}
      {abierto && (
        <View style={styles.editBlock}>
          <View style={styles.inlineRow}>
            <Text style={[styles.inlineLabel, { color: theme.textSecondary }]}>Músculo</Text>
            <TextInput
              style={[styles.inlineInput, {
                flex: 1,
                borderColor: theme.inputBorder,
                backgroundColor: theme.inputBackground,
                color: theme.inputText
              }]}
              placeholder="Ej: ESPALDA"
              placeholderTextColor={theme.placeholder}
              value={item.musculo ?? ''}
              onChangeText={(v) =>
                updateEjercicioCampo(diaKey, item.id, 'musculo', v.toUpperCase())
              }
            />
          </View>

          <View style={[styles.inlineRow, { marginTop: 8 }]}>
            <Text style={[styles.inlineLabel, { color: theme.textSecondary }]}>Nombre</Text>
            <TextInput
              style={[styles.inlineInput, {
                flex: 1,
                borderColor: theme.inputBorder,
                backgroundColor: theme.inputBackground,
                color: theme.inputText
              }]}
              placeholder="Ej: Remo sentado máquina (agarre neutro)"
              placeholderTextColor={theme.placeholder}
              value={item.nombre ?? ''}
              onChangeText={(v) => updateEjercicioCampo(diaKey, item.id, 'nombre', v)}
            />
          </View>
        </View>
      )}

      {/* Series */}
      {abierto && (
        <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
          <View style={styles.serieHeadRow}>
            <Text style={[styles.serieLabel, { fontWeight: '700', color: theme.text }]}>#</Text>
            <Text style={[styles.headCol, { color: theme.text }]}>Min</Text>
            <Text style={[styles.headCol, { color: theme.text }]}>Max</Text>
            <Text style={[styles.headCol, { flex: 1, textAlign: 'left', color: theme.text }]}>Técnica</Text>
            <Text style={{ width: 28 }} />
          </View>

          {item.series?.map((s, idx) => (
            <SerieRow
              key={s.id}
              diaKey={diaKey}
              ejercicioId={item.id}
              s={s}
              index={idx}
              theme={theme}
              updateSerieCampo={updateSerieCampo}
              toggleSerieExtra={toggleSerieExtra}
              deleteSerie={deleteSerie}
            />
          ))}

          <TouchableOpacity
            style={[styles.addSerieBtn, { backgroundColor: theme.successLight, borderColor: theme.successBorder }]}
            onPress={() => addSerie(diaKey, item.id)}
          >
            <Ionicons name="add-circle-outline" size={20} color={theme.successText} />
            <Text style={[styles.addSerieTxt, { color: theme.successText }]}>Añadir serie</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

/* ───────────────────────────────── Componente principal ─────────────────────────────── */
export default function RoutineEditorScreen() {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const router = useRouter();
  const storageKey = `${STORAGE_PREFIX}${id}`;

  const [rutina, setRutina] = useState({});
  const [diasAbiertos, setDiasAbiertos] = useState({});
  const [openSet, setOpenSet] = useState(new Set());           // ejercicios abiertos
  const [routineName, setRoutineName] = useState(String(id));  // título visible
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isFirstLoad = useRef(true);

  /* ───────── Carga inicial + normalización ───────── */
  useEffect(() => {
    (async () => {
      try {
        // Obtener nombre humano de la rutina desde la lista maestra
        const listJSON = await AsyncStorage.getItem('rutinas');
        if (listJSON) {
          const lista = JSON.parse(listJSON);
          const meta = (lista || []).find((r) => r?.id === id);
          if (meta?.nombre) setRoutineName(meta.nombre);
        }

        // Cargar datos de la rutina y normalizar
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) || {};
          const normalized = normalizeRoutine(parsed);
          setRutina(normalized);

          const open = {};
          Object.keys(normalized).forEach((k) => (open[k] = true));
          setDiasAbiertos(open);

          // Persistir ya normalizado
          await AsyncStorage.setItem(storageKey, JSON.stringify(normalized));
        } else {
          const init = normalizeRoutine({ dia1: [] });
          setRutina(init);
          setDiasAbiertos({ dia1: true });
          await AsyncStorage.setItem(storageKey, JSON.stringify(init));
        }
        // Reset unsaved changes after initial load
        setTimeout(() => {
          isFirstLoad.current = false;
        }, 500);
      } catch (e) {
        console.warn('Error cargando rutina', e);
      }
    })();
  }, [storageKey, id]);

  // Marcar esta rutina como activa al abrir el editor (para que Entreno la lea)
  useEffect(() => {
    if (!id) return;
    AsyncStorage.multiSet([
      ['active_routine', String(id)],
      ['active_routine_name', routineName || String(id)],
    ]).catch(() => { });
  }, [id, routineName]);

  /* ───────── Control de Cambios ───────── */
  useEffect(() => {
    if (isFirstLoad.current) return;
    if (Object.keys(rutina).length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [rutina]);

  const saveRoutine = useCallback(async () => {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(rutina));
      setHasUnsavedChanges(false);
      Alert.alert('Éxito', 'Rutina guardada correctamente');
    } catch (e) {
      console.warn('No se pudo guardar rutina', e);
      Alert.alert('Error', 'No se pudo guardar la rutina');
    }
  }, [storageKey, rutina]);

  // Interceptar salida sin guardar
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasUnsavedChanges) {
        return;
      }

      // Prevenir navegación
      e.preventDefault();

      Alert.alert(
        'Cambios sin guardar',
        'No has guardado la rutina. ¿Quieres guardarla antes de salir?',
        [
          { text: 'No guardar', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
          { text: 'Cancelar', style: 'cancel', onPress: () => { } },
          {
            text: 'Guardar',
            onPress: async () => {
              await AsyncStorage.setItem(storageKey, JSON.stringify(rutina));
              setHasUnsavedChanges(false);
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges, rutina, storageKey]);


  /* ───────── Open/close ejercicio ───────── */
  const isOpen = useCallback((eid) => openSet.has(eid), [openSet]);
  const toggleOpen = useCallback((eid) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      next.has(eid) ? next.delete(eid) : next.add(eid);
      return next;
    }), []);

  const openAllInDay = useCallback(
    (diaKey) => {
      setOpenSet((prev) => {
        const next = new Set(prev);
        for (const ej of rutina[diaKey] || []) next.add(ej.id);
        return next;
      });
    },
    [rutina]
  );
  const closeAllInDay = useCallback(
    (diaKey) => {
      setOpenSet((prev) => {
        const next = new Set(prev);
        for (const ej of rutina[diaKey] || []) next.delete(ej.id);
        return next;
      });
    },
    [rutina]
  );

  /* ───────── DÍAS: mover/añadir/eliminar/toggle ───────── */
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
      return fromEntriesOrdered(next);
    });
  }, []);

  const onDeleteDay = useCallback((diaKey) => {
    Alert.alert('Eliminar día', '¿Seguro que quieres eliminar este día?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          setRutina((prev) => {
            const entries = Object.entries(prev).filter(([k]) => k !== diaKey);
            return fromEntriesOrdered(entries);
          }),
      },
    ]);
  }, []);

  const onToggleDia = useCallback((diaKey) => {
    setDiasAbiertos((prev) => ({ ...prev, [diaKey]: !prev[diaKey] }));
  }, []);

  /* ───────── EJERCICIOS: mover/añadir/eliminar/editar ───────── */
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
        extra: 'Ninguno',
        series: [
          { id: `s-${newId}-0`, repMin: '6', repMax: '8', extra: 'Ninguno' },
          { id: `s-${newId}-1`, repMin: '6', repMax: '8', extra: 'Ninguno' },
          { id: `s-${newId}-2`, repMin: '6', repMax: '8', extra: 'Ninguno' },
        ],
      };

      const newList = [
        ...dayList.slice(0, insertPos),
        newEj,
        ...dayList.slice(insertPos),
      ];

      setOpenSet((s) => new Set([...s, newId])); // abre el nuevo
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
        extra: 'Ninguno',
        series: [
          { id: `s-${newId}-0`, repMin: '6', repMax: '8', extra: 'Ninguno' },
          { id: `s-${newId}-1`, repMin: '6', repMax: '8', extra: 'Ninguno' },
          { id: `s-${newId}-2`, repMin: '6', repMax: '8', extra: 'Ninguno' },
        ],
      };
      setOpenSet((s) => new Set([...s, newId]));
      return { ...prev, [diaKey]: [...dayList, newEj] };
    });
  }, []);

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

  /* ───────── SERIES: editar/toggle técnica/add/delete ───────── */
  const updateSerieCampo = useCallback(
    (diaKey, ejercicioId, serieId, campo, val) => {
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
    },
    []
  );

  const toggleSerieExtra = useCallback(
    (diaKey, ejercicioId, serieId) => {
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
    },
    []
  );

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
          { id: newId, repMin: '6', repMax: '8', extra: 'Ninguno' },
        ];
        return { ...e, series };
      });
      return { ...prev, [diaKey]: newList };
    });
  }, []);

  /* ───────── Secciones para SectionList ───────── */
  const sections = useMemo(() => {
    return Object.entries(rutina).map(([key, list], idx) => ({
      key,
      title: key,
      ord: idx + 1,                   // ← número de día por POSICIÓN (sin NaN)
      data: diasAbiertos[key] ? list : [],
    }));
  }, [rutina, diasAbiertos]);

  /* ───────── UI ───────── */
  const HeaderApp = () => (
    <View style={[styles.headerTop, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>{routineName}</Text>
      <Text style={[styles.subtitle, { color: theme.textTertiary }]}>Editor de rutina</Text>
    </View>
  );

  const DiaHeader = ({ diaKey, ord }) => {
    const label = `Día ${Number.isFinite(Number(ord)) ? ord : 1}`;
    const expanded = !!diasAbiertos[diaKey];
    return (
      <View style={[styles.sectionHeaderContainer, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
        <TouchableOpacity
          style={styles.sectionHeaderTitleContainer}
          onPress={() => onToggleDia(diaKey)}
          activeOpacity={0.8}
        >
          <Text style={[styles.sectionHeader, { color: theme.text }]}>{label}</Text>
          <Ionicons
            name={expanded ? 'chevron-down-outline' : 'chevron-forward-outline'}
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
        <View style={styles.sectionHeaderControls}>
          <IconBtn onPress={() => openAllInDay(diaKey)} icon="expand-outline" tint={theme.textSecondary} />
          <IconBtn onPress={() => closeAllInDay(diaKey)} icon="contract-outline" tint={theme.textSecondary} />
          <IconBtn onPress={() => moveDay(diaKey, -1)} icon="arrow-up" tint={theme.primary} />
          <IconBtn onPress={() => moveDay(diaKey, +1)} icon="arrow-down" tint={theme.primary} />
          <IconBtn onPress={() => insertDayAfter(diaKey)} icon="add" tint={theme.success} />
          <IconBtn onPress={() => onDeleteDay(diaKey)} icon="remove" tint={theme.danger} />
        </View>
      </View>
    );
  };

  const DiaFooter = ({ diaKey }) => (
    <View style={[styles.dayFooter, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight }]}>
      <TouchableOpacity
        style={[styles.addExerciseCTA, { backgroundColor: theme.successLight, borderColor: theme.successBorder }]}
        onPress={() => addExerciseAtEnd(diaKey)}
        activeOpacity={0.88}
      >
        <Ionicons name="add-circle-outline" size={20} color={theme.successText} />
        <Text style={[styles.addExerciseCTATxt, { color: theme.successText }]}>Añadir ejercicio</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <HeaderApp />
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
            theme={theme}
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
        ListFooterComponent={
          <View style={{ padding: 16 }}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={saveRoutine}
            >
              <Text style={styles.saveButtonText}>Guardar Rutina</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

/* ───────────────────────── IconBtn ───────────────────────── */
function IconBtn({ onPress, icon, tint }) {
  const { theme } = useTheme();
  const finalTint = tint || theme.textSecondary;

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
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.iconBtnRound, { backgroundColor: theme.iconButton, borderColor: theme.border }]}>
      <Ionicons name={map[icon]} size={18} color={finalTint} />
    </TouchableOpacity>
  );
}

/* ───────────────────────── Styles ───────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1 },

  headerTop: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 0.6,
  },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { marginTop: 2, fontSize: 12 },

  /* Día */
  sectionHeaderContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionHeader: { fontSize: 16, fontWeight: '700' },
  sectionHeaderControls: { flexDirection: 'row', alignItems: 'center' },

  dayFooter: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 0.6,
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
  },
  addExerciseCTATxt: { fontWeight: '700', fontSize: 13 },

  iconBtnRound: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 999,
    marginLeft: 6,
    borderWidth: 1,
  },

  /* Card ejercicio */
  card: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 0.6,
    overflow: 'hidden',
  },
  cardHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.6,
  },
  cardHeaderTouchable: { flex: 1 },
  cardHeader: { fontSize: 14, fontWeight: '700' },
  moveControls: { flexDirection: 'row', alignItems: 'center' },

  /* Bloque edición musculo/nombre */
  editBlock: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineLabel: { width: 70, fontSize: 12, fontWeight: '600' },
  inlineInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
  },

  /* Series */
  serieHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  headCol: { width: 70, textAlign: 'center', fontWeight: '700' },

  serieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.6,
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  serieLabel: { width: 70, fontSize: 12 },
  serieInput: {
    width: 64,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    textAlign: 'center',
  },

  extraPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  extraPillTxt: { fontSize: 12, fontWeight: '700' },

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
  },
  addSerieTxt: { fontWeight: '800', fontSize: 13 },

  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});