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
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

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

/* ───────────────────────────────── Componente principal ─────────────────────────────── */
export default function RoutineEditorScreen() {
  const { id } = useLocalSearchParams();
  const storageKey = `${STORAGE_PREFIX}${id}`;

  const [rutina, setRutina] = useState({});
  const [diasAbiertos, setDiasAbiertos] = useState({});
  const [openSet, setOpenSet] = useState(new Set());           // ejercicios abiertos
  const [routineName, setRoutineName] = useState(String(id));  // título visible

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
    ]).catch(() => {});
  }, [id, routineName]);

  /* ───────── Guardado con debounce ───────── */
  const saveTimeout = useRef(null);
  const scheduleSave = useCallback(
    (next) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        try {
          await AsyncStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {
          console.warn('No se pudo guardar rutina', e);
        }
      }, 220);
    },
    [storageKey]
  );

  useEffect(() => {
    if (!rutina || Object.keys(rutina).length === 0) return;
    scheduleSave(rutina);
  }, [rutina, scheduleSave]);

  /* ───────── Open/close ejercicio ───────── */
  const isOpen = (eid) => openSet.has(eid);
  const toggleOpen = (eid) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      next.has(eid) ? next.delete(eid) : next.add(eid);
      return next;
    });

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
    <View style={styles.headerTop}>
      <Text style={styles.title}>{routineName}</Text>
      <Text style={styles.subtitle}>Editor de rutina</Text>
    </View>
  );

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
            color="#374151"
          />
        </TouchableOpacity>
        <View style={styles.sectionHeaderControls}>
          <IconBtn onPress={() => openAllInDay(diaKey)} icon="expand-outline" />
          <IconBtn onPress={() => closeAllInDay(diaKey)} icon="contract-outline" />
          <IconBtn onPress={() => moveDay(diaKey, -1)} icon="arrow-up" tint="#3b82f6" />
          <IconBtn onPress={() => moveDay(diaKey, +1)} icon="arrow-down" tint="#3b82f6" />
          <IconBtn onPress={() => insertDayAfter(diaKey)} icon="add" tint="#10b981" />
          <IconBtn onPress={() => onDeleteDay(diaKey)} icon="remove" tint="#ef4444" />
        </View>
      </View>
    );
  };

  const DiaFooter = ({ diaKey }) => (
    <View style={styles.dayFooter}>
      <TouchableOpacity
        style={styles.addExerciseCTA}
        onPress={() => addExerciseAtEnd(diaKey)}
        activeOpacity={0.88}
      >
        <Ionicons name="add-circle-outline" size={20} color="#10b981" />
        <Text style={styles.addExerciseCTATxt}>Añadir ejercicio</Text>
      </TouchableOpacity>
    </View>
  );

  const SerieRow = ({ diaKey, ejercicioId, s, index }) => {
    return (
      <View style={styles.serieRow}>
        <Text style={styles.serieLabel}>Serie {index + 1}</Text>

        <TextInput
          style={styles.serieInput}
          placeholder="min"
          keyboardType="numeric"
          value={String(s.repMin ?? '')}
          onChangeText={(v) =>
            updateSerieCampo(diaKey, ejercicioId, s.id, 'repMin', v)
          }
        />
        <Text style={{ marginHorizontal: 6, color: '#6b7280' }}>–</Text>
        <TextInput
          style={styles.serieInput}
          placeholder="max"
          keyboardType="numeric"
          value={String(s.repMax ?? '')}
          onChangeText={(v) =>
            updateSerieCampo(diaKey, ejercicioId, s.id, 'repMax', v)
          }
        />

        <TouchableOpacity
          style={styles.extraPill}
          onPress={() => toggleSerieExtra(diaKey, ejercicioId, s.id)}
        >
          <Text style={styles.extraPillTxt}>{s.extra || 'Ninguno'}</Text>
          <Ionicons name="chevron-down-outline" size={16} color="#1f2937" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <IconBtn
          onPress={() => deleteSerie(diaKey, ejercicioId, s.id)}
          icon="close-circle"
          tint="#ef4444"
        />
      </View>
    );
  };

  const RenderItem = ({ item, section }) => {
    const diaKey = section.title;
    const abierto = isOpen(item.id);

    return (
      <View style={styles.card}>
        {/* Header ejercicio */}
        <View style={styles.cardHeaderContainer}>
          <TouchableOpacity
            onPress={() => toggleOpen(item.id)}
            style={styles.cardHeaderTouchable}
          >
            <Text style={styles.cardHeader}>
              {(item.musculo || 'MÚSCULO')} — {(item.nombre || 'Nombre ejercicio')}
            </Text>
          </TouchableOpacity>

          <View style={styles.moveControls}>
            <IconBtn onPress={() => moveExercise(diaKey, item.id, -1)} icon="arrow-up" tint="#3b82f6" />
            <IconBtn onPress={() => moveExercise(diaKey, item.id, +1)} icon="arrow-down" tint="#3b82f6" />
            <IconBtn onPress={() => addExerciseAfter(diaKey, item.id)} icon="add" tint="#10b981" />
            <IconBtn onPress={() => deleteExercise(diaKey, item.id)} icon="remove" tint="#ef4444" />
            <IconBtn onPress={() => toggleOpen(item.id)} icon={abierto ? 'chevron-down' : 'chevron-forward'} />
          </View>
        </View>

        {/* Editar musculo / nombre */}
        {abierto && (
          <View style={styles.editBlock}>
            <View style={styles.inlineRow}>
              <Text style={styles.inlineLabel}>Músculo</Text>
              <TextInput
                style={[styles.inlineInput, { flex: 1 }]}
                placeholder="Ej: ESPALDA"
                value={item.musculo ?? ''}
                onChangeText={(v) =>
                  updateEjercicioCampo(diaKey, item.id, 'musculo', v.toUpperCase())
                }
              />
            </View>

            <View style={[styles.inlineRow, { marginTop: 8 }]}>
              <Text style={styles.inlineLabel}>Nombre</Text>
              <TextInput
                style={[styles.inlineInput, { flex: 1 }]}
                placeholder="Ej: Remo sentado máquina (agarre neutro)"
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
  };

  return (
    <View style={styles.container}>
      <HeaderApp />
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item?.id ?? `idx-${index}-${uid()}`}
        renderItem={RenderItem}
        renderSectionHeader={({ section }) => (
          <DiaHeader diaKey={section.title} ord={section.ord} />
        )}
        renderSectionFooter={({ section: { title } }) =>
          diasAbiertos[title] ? <DiaFooter diaKey={title} /> : null
        }
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        extraData={{ openSetSize: openSet.size, diasAbiertos }}
      />
    </View>
  );
}

/* ───────────────────────── IconBtn ───────────────────────── */
function IconBtn({ onPress, icon, tint = '#4b5563' }) {
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
      <Ionicons name={map[icon]} size={18} color={tint} />
    </TouchableOpacity>
  );
}

/* ───────────────────────── Styles ───────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },

  headerTop: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 0.6,
    borderColor: '#e5e7eb',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#6b7280' },

  /* Día */
  sectionHeaderContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.6,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#111827' },
  sectionHeaderControls: { flexDirection: 'row', alignItems: 'center' },

  dayFooter: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 0.6,
    borderColor: '#eef2f7',
  },
  addExerciseCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  addExerciseCTATxt: { color: '#065f46', fontWeight: '700', fontSize: 13 },

  iconBtnRound: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  /* Card ejercicio */
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 0.6,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  cardHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.6,
    borderColor: '#eef2f7',
  },
  cardHeaderTouchable: { flex: 1 },
  cardHeader: { fontSize: 14, fontWeight: '700', color: '#111827' },
  moveControls: { flexDirection: 'row', alignItems: 'center' },

  /* Bloque edición musculo/nombre */
  editBlock: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineLabel: { width: 70, color: '#374151', fontSize: 12, fontWeight: '600' },
  inlineInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontSize: 13,
  },

  /* Series */
  serieHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  headCol: { width: 70, textAlign: 'center', fontWeight: '700', color: '#111827' },

  serieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.6,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  serieLabel: { width: 70, fontSize: 12, color: '#111827' },
  serieInput: {
    width: 64,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: '#fff',
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
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  extraPillTxt: { fontSize: 12, color: '#1f2937', fontWeight: '700' },

  addSerieBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  addSerieTxt: { color: '#065f46', fontWeight: '800', fontSize: 13 },
});
