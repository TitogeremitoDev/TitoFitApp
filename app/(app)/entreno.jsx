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

import React, { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
  Image,
  AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import YoutubeIframe from 'react-native-youtube-iframe';
import Stopwatch from '../../components/Stopwatch';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
// Componentes mejorados para iOS
import {
  EnhancedScrollView as ScrollView,
  EnhancedTouchable as TouchableOpacity,
  EnhancedPressable as Pressable,
  EnhancedTextInput as TextInput,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAchievements } from '../../context/AchievementsContext';
import { useTrainer } from '../../context/TrainerContext';
import * as Haptics from 'expo-haptics';
import { useAudioRecorder, useAudioPlayer, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import UnifiedFeedbackModal from '../../src/components/UnifiedFeedbackModal';
import { useVideoFeedback } from '../../src/hooks/useVideoFeedback';
import { getContrastColor } from '../../utils/colors';


const { width } = Dimensions.get('window');
const ARROW_W = 56;
const ESTADOS = ['C', 'NC', 'OE']; // ← OJ → OE
const SEMANAS_MAX = 200;
const DEBOUNCE_SAVE_MS = 600; // Debounce para guardado de series (evita writes en cada tecla)

const EXTRA_ABBR = {
  Descendentes: 'DESC',
  'Mio Reps': 'MR',
  Parciales: 'PARC',
  'Rest-Pause': 'RP',
  Biserie: 'BS',
  Biseries: 'BS',
  bs: 'BS',
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

/* ───────── Asegurar IDs únicos en ejercicios ───────── */
const _uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(4);

/**
 * Recorre todos los días/ejercicios y garantiza que cada ejercicio tenga un
 * `id` único.  Si falta o está duplicado, genera uno nuevo con `_uid()`.
 * Devuelve un NUEVO array (no muta el original).
 */
function ensureUniqueExerciseIds(diasArr) {
  if (!Array.isArray(diasArr)) return diasArr;
  const globalSeen = new Set();
  return diasArr.map((dayExercises) => {
    if (!Array.isArray(dayExercises)) return dayExercises;
    return dayExercises.map((ej, idx) => {
      if (ej && (ej.id == null || ej.id === '' || globalSeen.has(ej.id))) {
        const newEj = { ...ej, id: `ej-${_uid()}` };
        globalSeen.add(newEj.id);
        return newEj;
      }
      globalSeen.add(ej.id);
      return ej;
    });
  });
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

/**
 * Construye un índice de ejercicios desde una lista plana de ejercicios de MongoDB
 * Estructura MongoDB: [{ _id, name, muscle, instructions, videoId }, ...]
 * Resultado: { MUSCULO: { byName: {originalName: obj}, byNorm: {normName: obj} } }
 */
function buildExerciseIndex(exercises) {
  const out = {};
  for (const ej of exercises || []) {
    const mus = String(ej?.muscle || '').trim();
    const name = String(ej?.name || '').trim();
    if (!mus || !name) continue;

    if (!out[mus]) out[mus] = { byName: {}, byNorm: {} };

    // Adaptamos la estructura MongoDB a la esperada por el código existente
    // Priorizamos 'instructions' (nuevo formato) sobre 'tecnicaCorrecta' (antiguo)
    const adaptedExercise = {
      nombre: ej.name,
      musculo: ej.muscle,
      tecnicaCorrecta: ej.instructions || ej.tecnicaCorrecta || [],
      videoId: ej.videoId || null,
      imagenEjercicioId: ej.imagen_ejercicio_ID || null,
      _id: ej._id
    };

    out[mus].byName[name] = adaptedExercise;
    out[mus].byNorm[normalizeStr(name)] = adaptedExercise;
  }
  return out;
}

/* ───────── Carrusel reutilizable ───────── */
function Carousel({ data, renderItem, onIndexChange, initialIndex = 0 }) {
  const { theme } = useTheme();
  const listRef = useRef(null);
  const [wrapW, setWrapW] = useState(Dimensions.get('window').width);
  const SLIDE_W = Math.max(150, wrapW - ARROW_W * 2);

  const safeInitial = Math.max(0, Math.min(initialIndex, Math.max(0, data.length - 1)));
  const [currentIndex, setCurrentIndex] = useState(safeInitial);

  // Sync with external initialIndex changes (e.g., when key changes trigger remount)
  useEffect(() => {
    const safe = Math.max(0, Math.min(initialIndex, data.length - 1));
    setCurrentIndex(safe);
  }, [initialIndex, data.length]);

  // Scroll to current index when it changes
  useEffect(() => {
    if (listRef.current && SLIDE_W > 0) {
      listRef.current.scrollToOffset({ offset: currentIndex * SLIDE_W, animated: false });
    }
  }, [currentIndex, SLIDE_W]);

  const move = (dir) => {
    const next = Math.max(0, Math.min(currentIndex + dir, data.length - 1));
    if (next !== currentIndex) {
      setCurrentIndex(next);
      onIndexChange?.(next);
    }
  };

  return (
    <View
      style={[styles.carouselWrap, {
        borderColor: theme.border,
        backgroundColor: theme.backgroundSecondary
      }]}
      onLayout={(e) => {
        const newWidth = e.nativeEvent.layout.width;
        if (newWidth > 100) {
          setWrapW(newWidth);
        }
      }}
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
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(_, i) => String(i)}
        initialScrollIndex={safeInitial}
        renderItem={(props) => (
          <View style={[styles.slide, { width: SLIDE_W }]}>{renderItem(props)}</View>
        )}
        getItemLayout={(_, i) => ({
          length: SLIDE_W,
          offset: SLIDE_W * i,
          index: i,
        })}
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

/* ───────── Selector Colapsable de Semana/Día ───────── */
function CollapsibleWeekDaySelector({ semana, diaIdx, totalDias, onSemanaChange, onDiaChange }) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggleExpand = () => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setExpanded(!expanded);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View>
      {/* Botón colapsado */}
      <TouchableOpacity
        onPress={toggleExpand}
        activeOpacity={0.85}
        style={[
          collapsibleStyles.collapsedButton,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <View style={collapsibleStyles.labelContainer}>
          <Ionicons name="calendar-outline" size={18} color={theme.primary} />
          <Text style={[collapsibleStyles.collapsedText, { color: theme.text }]}>
            S{semana}-D{diaIdx + 1}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
        </Animated.View>
      </TouchableOpacity>

      {/* Carruseles expandidos */}
      {expanded && (
        <View style={collapsibleStyles.expandedContainer}>
          <WeeksCarousel
            selected={semana}
            onChange={onSemanaChange}
          />
          <View style={styles.spacer8} />
          <DaysCarousel
            total={totalDias}
            selected={diaIdx}
            onChange={onDiaChange}
          />
        </View>
      )}
    </View>
  );
}

const collapsibleStyles = StyleSheet.create({
  collapsedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    gap: 10,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsedText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  expandedContainer: {
    marginTop: 8,

  },
});

/* ───────── 📝 Modal de Notas por Serie ───────── */
const NOTE_VALUES = [
  { key: 'high', label: 'Alta', color: '#ef4444', emoji: '🔴' },
  { key: 'normal', label: 'Media', color: '#f97316', emoji: '🟠' },
  { key: 'low', label: 'Ok', color: '#22c55e', emoji: '🟢' },
  { key: 'custom', label: 'Nota', color: '#3b82f6', emoji: '🔵' },
];

function NotesModal({ visible, onClose, serieKey, initialValue, initialNote, initialAudioUri, onSave, theme, initialMediaUri, initialMediaType }) {
  const [value, setValue] = useState(initialValue || 'normal');
  const [noteText, setNoteText] = useState(initialNote || '');
  const [audioUri, setAudioUri] = useState(initialAudioUri || null);
  const [mediaUri, setMediaUri] = useState(initialMediaUri || null);
  const [mediaType, setMediaType] = useState(initialMediaType || null);
  // expo-audio hooks
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const audioPlayer = useAudioPlayer(audioUri);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setValue(initialValue || 'normal');
      setNoteText(initialNote || '');
      setAudioUri(initialAudioUri || null);
      setMediaUri(initialMediaUri || null);
      setMediaType(initialMediaType || null);
      setIsRecording(false);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (sound) sound.unloadAsync();
    };
  }, [visible, initialValue, initialNote, initialAudioUri, initialMediaUri, initialMediaType]);

  // Iniciar grabación (expo-audio)
  const startRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permiso denegado', 'Necesitamos acceso al micrófono');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (err) {
      console.error('[NotesModal] Error starting recording:', err);
    }
  };

  // Parar grabación
  const stopRecording = async () => {
    if (!audioRecorder.isRecording) return;
    try {
      clearInterval(timerRef.current);
      setIsRecording(false);
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setAudioUri(uri);
    } catch (err) {
      console.error('[NotesModal] Error stopping recording:', err);
    }
  };

  // Reproducir audio (expo-audio)
  const playAudio = async () => {
    if (!audioUri || !audioPlayer) return;
    try {
      setIsPlaying(true);
      audioPlayer.seekTo(0);
      audioPlayer.play();
    } catch (err) {
      console.error('[NotesModal] Error playing audio:', err);
    }
  };

  // Track when audio finishes
  useEffect(() => {
    if (audioPlayer && !audioPlayer.playing && isPlaying) {
      setIsPlaying(false);
    }
  }, [audioPlayer?.playing, isPlaying]);

  // Eliminar audio
  const deleteAudio = async () => {
    setAudioUri(null);
    setIsPlaying(false);
  };

  const handleSave = () => {
    onSave(serieKey, value, noteText, audioUri, mediaUri, mediaType);
    onClose();
  };

  const handleDelete = () => {
    onSave(serieKey, null, null, null, null, null);
    onClose();
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isDarkMode = theme.background === '#0d0d0d';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={notesModalStyles.overlay}>
        <View style={[notesModalStyles.card, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <View style={notesModalStyles.header}>
            <Text style={[notesModalStyles.title, { color: theme.text }]}>Nota de Serie</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Selector de valor - Grid 2x2 minimalista */}
          <View style={notesModalStyles.valueRow}>
            {NOTE_VALUES.map((item) => (
              <TouchableOpacity
                key={item.key}
                onPress={() => setValue(item.key)}
                activeOpacity={0.7}
                style={[
                  notesModalStyles.valueBtn,
                  {
                    borderColor: value === item.key ? item.color : theme.border,
                    backgroundColor: value === item.key ? item.color + '15' : 'transparent',
                  }
                ]}
              >
                <Text style={notesModalStyles.emoji}>{item.emoji}</Text>
                <Text style={[
                  notesModalStyles.valueTxt,
                  { color: value === item.key ? item.color : theme.textSecondary }
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Input de texto + Mic (estilo WhatsApp) */}
          <View style={notesModalStyles.inputRow}>
            <TextInput
              style={[notesModalStyles.input, {
                backgroundColor: theme.inputBackground,
                borderColor: theme.inputBorder,
                color: theme.inputText,
                flex: 1,
              }]}
              placeholder="Escribe tu nota aquí..."
              placeholderTextColor={theme.placeholder}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              maxLength={500}
            />
            {!audioUri && !isRecording && (
              <TouchableOpacity
                onPress={startRecording}
                style={[notesModalStyles.micBtnInline, { backgroundColor: theme.primary || '#4361ee' }]}
                activeOpacity={0.7}
              >
                <Ionicons name="mic" size={20} color="#fff" />
              </TouchableOpacity>
            )}
            {isRecording && (
              <TouchableOpacity
                onPress={stopRecording}
                style={[notesModalStyles.micBtnInline, { backgroundColor: '#ef4444' }]}
                activeOpacity={0.7}
              >
                <Ionicons name="stop" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Indicador de grabación */}
          {isRecording && (
            <View style={notesModalStyles.recordingRow}>
              <View style={notesModalStyles.recordingDot} />
              <Text style={[notesModalStyles.recordingTime, { color: '#ef4444' }]}>
                Grabando {formatTime(recordingTime)}
              </Text>
            </View>
          )}

          {/* Audio grabado */}
          {audioUri && !isRecording && (
            <View style={notesModalStyles.audioRow}>
              <TouchableOpacity
                onPress={playAudio}
                style={[notesModalStyles.playBtn, { borderColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color={theme.primary || '#4361ee'} />
              </TouchableOpacity>
              <Text style={[notesModalStyles.audioLabel, { color: theme.textSecondary, flex: 1 }]}>
                🎤 Nota de voz
              </Text>
              <TouchableOpacity onPress={deleteAudio} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Botones */}
          <View style={notesModalStyles.actions}>
            {(initialValue || initialNote || initialAudioUri) && (
              <TouchableOpacity
                onPress={handleDelete}
                style={[notesModalStyles.deleteBtn, { borderColor: theme.border }]}
                activeOpacity={0.8}
              >
                <Text style={styles.fontSize16}>🗑️</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSave}
              style={[notesModalStyles.saveBtn, {
                backgroundColor: isDarkMode ? '#ffffff' : '#1a1a1a'
              }]}
              activeOpacity={0.85}
            >
              <Text style={[notesModalStyles.saveTxt, { color: isDarkMode ? '#1a1a1a' : '#ffffff' }]}>
                Guardar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const notesModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  valueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '48%',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  emoji: {
    fontSize: 14,
  },
  valueTxt: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 70,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  deleteBtn: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  saveBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveTxt: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Estilos WhatsApp
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  micBtnInline: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  recordingTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(67, 97, 238, 0.1)',
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioLabel: {
    fontSize: 13,
  },
});

/* ───────── 🚪 Estilos del Modal de Salida ───────── */
const exitModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  exitBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  exitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  saveBtn: {
    width: '100%',
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

/* ───────── 🎯 RPE Bars Component ───────── */
const RPE_LABELS = {
  1: 'Energía Baja 🪫',
  2: 'Cansado',
  3: 'Buen entreno 💪',
  4: 'Gran sesión 🔥',
  5: '¡Modo Bestia! 🔥'
};

const RPE_COLORS = {
  1: '#bfdbfe', // Blue-200 (muy pálido)
  2: '#93c5fd', // Blue-300
  3: '#3b82f6', // Blue-500 (corporativo)
  4: '#2563eb', // Blue-600
  5: '#1d4ed8'  // Blue-700 (neón)
};

const RPE_HEIGHTS = [16, 24, 32, 40, 48];

function RPEBars({ value, onChange, theme }) {
  const [dragging, setDragging] = useState(false);
  const barsRef = useRef(null);
  const barPositions = useRef([]);

  const handleBarPress = useCallback((index) => {
    const newValue = index + 1;
    if (newValue !== value) {
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync();
      }
      onChange(newValue);
    }
  }, [value, onChange]);

  const handleTouchMove = useCallback((event) => {
    if (!dragging) return;

    const touchX = event.nativeEvent.pageX;

    // Determinar qué barra está más cerca
    for (let i = 0; i < barPositions.current.length; i++) {
      const pos = barPositions.current[i];
      if (pos && touchX >= pos.left && touchX <= pos.right) {
        const newValue = i + 1;
        if (newValue !== value) {
          if (Platform.OS !== 'web') {
            Haptics.selectionAsync();
          }
          onChange(newValue);
        }
        break;
      }
    }
  }, [dragging, value, onChange]);

  const measureBars = useCallback(() => {
    // Esta función se llamará al layout para medir posiciones
  }, []);

  return (
    <View style={rpeStyles.container}>
      <Text style={[rpeStyles.label, { color: theme.textSecondary }]}>
        ¿Cómo ha ido la energía hoy?
      </Text>

      {/* Texto dinámico */}
      <Text style={[rpeStyles.dynamicLabel, {
        color: value ? RPE_COLORS[value] : theme.textSecondary,
        textShadowColor: value === 5 ? '#1d4ed8' : 'transparent',
        textShadowRadius: value === 5 ? 10 : 0,
      }]}>
        {value ? RPE_LABELS[value] : 'Selecciona tu energía'}
      </Text>

      {/* Barras */}
      <View
        ref={barsRef}
        style={rpeStyles.barsContainer}
        onTouchStart={() => setDragging(true)}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setDragging(false)}
      >
        {[1, 2, 3, 4, 5].map((level, index) => {
          const isActive = value && level <= value;
          const barColor = isActive ? RPE_COLORS[level] : '#d1d5db';
          const height = RPE_HEIGHTS[index];

          return (
            <TouchableOpacity
              key={level}
              onPress={() => handleBarPress(index)}
              onLayout={(event) => {
                const layout = event.nativeEvent.layout;
                barPositions.current[index] = {
                  left: layout.x,
                  right: layout.x + layout.width,
                };
              }}
              style={[rpeStyles.barTouchable]}
              activeOpacity={0.7}
            >
              <View
                style={[
                  rpeStyles.bar,
                  {
                    height,
                    backgroundColor: barColor,
                    shadowColor: isActive && level >= 4 ? RPE_COLORS[level] : 'transparent',
                    shadowOpacity: isActive && level >= 4 ? 0.6 : 0,
                    shadowRadius: isActive && level >= 4 ? 8 : 0,
                    elevation: isActive && level >= 4 ? 4 : 0,
                  }
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Subtítulo motivacional */}
      <Text style={[rpeStyles.subtitle, { color: theme.textSecondary }]}>
        Ayúdame a ajustar tu próxima sesión
      </Text>
    </View>
  );
}

function RPENoteInput({ value, onChange, expanded, onExpandToggle, autoExpand, theme, scrollRef }) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoExpand && !expanded) {
      onExpandToggle(true);
    }
  }, [autoExpand]);

  const placeholderText = autoExpand
    ? '¿Todo bien? Cuéntame...'
    : '¿Alguna molestia o récord hoy?';

  // Calcular altura dinámica según contenido
  const lineCount = value ? (value.match(/\n/g) || []).length + 1 : 1;
  const dynamicHeight = Math.max(36, Math.min(lineCount * 20 + 16, 100));

  return (
    <View style={rpeStyles.noteContainer}>
      <TouchableOpacity
        onPress={() => {
          onExpandToggle(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        style={[
          rpeStyles.noteInputWrapper,
          {
            borderColor: isFocused ? theme.primary : theme.border,
            backgroundColor: theme.inputBackground,
          }
        ]}
        activeOpacity={expanded ? 1 : 0.7}
      >
        {expanded ? (
          <TextInput
            ref={inputRef}
            style={[rpeStyles.noteInput, { color: theme.inputText, height: dynamicHeight }]}
            placeholder={placeholderText}
            placeholderTextColor={theme.placeholder}
            value={value}
            onChangeText={onChange}
            onFocus={() => {
              setIsFocused(true);
              // Scroll to make input visible
              setTimeout(() => scrollRef?.current?.scrollToEnd?.({ animated: true }), 200);
            }}
            onBlur={() => setIsFocused(false)}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
          />
        ) : (
          <Text style={[rpeStyles.notePlaceholder, { color: theme.placeholder }]}>
            {placeholderText}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const rpeStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Platform.select({ web: 12, default: 8 }),
    paddingHorizontal: Platform.select({ web: 16, default: 12 }),
  },
  label: {
    fontSize: Platform.select({ web: 15, default: 13 }),
    fontWeight: '600',
    marginBottom: Platform.select({ web: 6, default: 4 }),
  },
  dynamicLabel: {
    fontSize: Platform.select({ web: 18, default: 16 }),
    fontWeight: '700',
    marginBottom: Platform.select({ web: 12, default: 10 }),
    textAlign: 'center',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Platform.select({ web: 14, default: 10 }),
    height: Platform.select({ web: 60, default: 52 }),
    paddingHorizontal: Platform.select({ web: 12, default: 8 }),
  },
  barTouchable: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Platform.select({ web: 10, default: 8 }),
    paddingVertical: Platform.select({ web: 6, default: 4 }),
  },
  bar: {
    width: Platform.select({ web: 28, default: 24 }),
    borderRadius: Platform.select({ web: 8, default: 6 }),
  },
  subtitle: {
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
  noteContainer: {
    width: '100%',
    marginTop: 8,
    paddingHorizontal: 12,
  },
  noteInputWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noteInput: {
    fontSize: 14,
    lineHeight: 20,
  },
  notePlaceholder: {
    fontSize: 14,
  },
});

/* ───────── 🔥 Modal de Estadísticas ÉPICO 🔥 ───────── */
function StatsModal({ visible, onClose, stats, workoutId, onRPESubmit }) {
  const { theme } = useTheme();
  // We use layoutReady to know when the specific view dimensions are set
  const [layoutReady, setLayoutReady] = useState(false);
  const [modalHeight, setModalHeight] = useState(0);

  // 🆕 RPE State
  const [rpe, setRpe] = useState(null);
  const [note, setNote] = useState('');
  const [noteExpanded, setNoteExpanded] = useState(false);

  // Reset state when visibility changes
  useEffect(() => {
    if (!visible) {
      setLayoutReady(false);
      setModalHeight(0);
      setRpe(null);
      setNote('');
      setNoteExpanded(false);
    }
  }, [visible]);

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
        <View
          // Force collapsable false for Android to ensure onLayout fires reliably
          collapsable={false}
          style={[
            styles.statsModalCard,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
              // Only simple opacity transition once we are ready
              opacity: layoutReady ? 1 : 0,
            },
          ]}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            if (height > 0) {
              setModalHeight(height);
              setLayoutReady(true);
            }
          }}
        >
          {/* Icono de cierre */}
          <Pressable onPress={onClose} style={[styles.statsModalClose, { pointerEvents: 'box-none' }]}>
            <View style={{ pointerEvents: 'auto' }}>
              <Ionicons name="close-circle" size={32} color={theme.textSecondary} />
            </View>
          </Pressable>

          {/* Only render ScrollView if we have dimensions to avoid 0-height glitch */}
          {layoutReady && (
            <ScrollView
              style={[styles.statsScrollView, { maxHeight: modalHeight - 40 }]}
              contentContainerStyle={styles.statsScrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              bounces={true}
              removeClippedSubviews={false}
            >
              {/* 🏆 Encabezado compacto (trofeo a la izquierda) */}
              <View style={styles.statsHeaderCompact}>
                <Ionicons name="trophy" size={40} color="#fbbf24" />
                <View style={styles.statsHeaderText}>
                  <Text style={[styles.statsTitleCompact, { color: theme.text }]}>
                    ¡Enhorabuena!
                  </Text>
                  <Text style={[styles.statsSubtitleCompact, { color: theme.primary }]}>
                    Has superado tus metas
                  </Text>
                </View>
              </View>

              {/* 🎯 Sección de RPE Feedback (comprimida) */}
              <View style={[styles.rpeFeedbackSection, { borderColor: theme.border }]}>
                <RPEBars
                  value={rpe}
                  onChange={setRpe}
                  theme={theme}
                />
                <RPENoteInput
                  value={note}
                  onChange={setNote}
                  expanded={noteExpanded}
                  onExpandToggle={setNoteExpanded}
                  autoExpand={rpe && rpe <= 2}
                  theme={theme}
                />
              </View>

              {/* 📊 Estadísticas comparativas - LAYOUT COMPACTO */}
              <View style={styles.statsSection}>
                <Text style={[styles.sectionTitleCompact, { color: theme.text }]}>
                  {previous ? '📊 Comparación Semanal' : '📊 Hoy'}
                </Text>

                {/* Fila horizontal: 1RM + Carga Media */}
                <View style={styles.statsRowHorizontal}>
                  {/* 1RM Estimado */}
                  <View style={[styles.statCardCompact, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                    <View style={styles.statHeaderCompact}>
                      <Ionicons name="flash" size={18} color="#f59e0b" />
                      <Text style={[styles.statTitleCompact, { color: theme.text }]}>1RM</Text>
                    </View>
                    {previous && (
                      <View style={styles.statDiffCompact}>
                        <Ionicons
                          name={getDiffIcon(current.oneRM - previous.oneRM)}
                          size={16}
                          color={getDiffColor(current.oneRM - previous.oneRM)}
                        />
                        <Text style={[styles.statDiffTextCompact, { color: getDiffColor(current.oneRM - previous.oneRM) }]}>
                          {formatDiff(current.oneRM - previous.oneRM)} ({formatPercent(current.oneRM - previous.oneRM, previous.oneRM).replace(' ', '')})
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Carga Media */}
                  <View style={[styles.statCardCompact, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                    <View style={styles.statHeaderCompact}>
                      <Ionicons name="analytics" size={18} color="#06b6d4" />
                      <Text style={[styles.statTitleCompact, { color: theme.text }]}>Carga</Text>
                    </View>
                    {previous && (
                      <View style={styles.statDiffCompact}>
                        <Ionicons
                          name={getDiffIcon(current.avgLoad - previous.avgLoad)}
                          size={16}
                          color={getDiffColor(current.avgLoad - previous.avgLoad)}
                        />
                        <Text style={[styles.statDiffTextCompact, { color: getDiffColor(current.avgLoad - previous.avgLoad) }]}>
                          {formatDiff(current.avgLoad - previous.avgLoad)} ({formatPercent(current.avgLoad - previous.avgLoad, previous.avgLoad).replace(' ', '')})
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Volumen Total - fila completa debajo */}
                <View style={[styles.statCardCompact, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder, marginTop: 8 }]}>
                  <View style={styles.statHeaderCompact}>
                    <Ionicons name="cube" size={18} color="#8b5cf6" />
                    <Text style={[styles.statTitleCompact, { color: theme.text }]}>Volumen: {formatNumber(current.volume)} kg</Text>
                  </View>
                  {previous && (
                    <View style={styles.statDiffCompact}>
                      <Ionicons
                        name={getDiffIcon(current.volume - previous.volume)}
                        size={16}
                        color={getDiffColor(current.volume - previous.volume)}
                      />
                      <Text style={[styles.statDiffTextCompact, { color: getDiffColor(current.volume - previous.volume) }]}>
                        {formatDiff(current.volume - previous.volume)} vs anterior
                      </Text>
                    </View>
                  )}
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
                onPress={() => {
                  // 🆕 Si hay RPE o nota, enviar feedback antes de cerrar
                  if ((rpe || note.trim()) && onRPESubmit && workoutId) {
                    onRPESubmit(workoutId, rpe, note.trim());
                  }
                  onClose();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.closeButtonText}>¡Genial! 🎉</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ───────── Componente principal ───────── */
/* ───────── 🎓 TUTORIAL/ONBOARDING MODAL ───────── */
const TOTAL_TUTORIAL_SLIDES = 5;

function TutorialModal({ visible, onComplete }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef(null);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Estados para el tutorial interactivo
  const [tutorialReps, setTutorialReps] = useState('');
  const [tutorialKg, setTutorialKg] = useState('');

  // Calcular color del fondo según rango 8-12
  const getTutorialBgColor = () => {
    const repsNum = Number(tutorialReps);
    if (tutorialReps === '' || isNaN(repsNum)) return theme.cardBackground;
    if (repsNum < 8) return '#fecaca'; // rojo - por debajo
    if (repsNum > 12) return '#bfdbfe'; // azul - supera
    return '#bbf7d0'; // verde - en rango
  };

  const { user } = useAuth();
  const { trainer } = useTrainer();
  const coachLogo = trainer?.logoUrl || user?.trainerProfile?.logoUrl || null;

  const goToSlide = (index) => {
    if (index < 0 || index >= TOTAL_TUTORIAL_SLIDES) return;
    setCurrentSlide(index);
    scrollViewRef.current?.scrollTo({ x: index * screenWidth, animated: true });
  };

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / screenWidth);
    if (newIndex !== currentSlide && newIndex >= 0 && newIndex < TOTAL_TUTORIAL_SLIDES) {
      setCurrentSlide(newIndex);
    }
  };

  const getCoachMessage = () => {
    switch (currentSlide) {
      case 0: return "¡Bienvenido, recluta! Soy tu coach. Aquí no venimos a jugar, venimos a subir de nivel.";
      case 1: return "Esto nos ayudara a medir tu progreso y tu evolucion. Sin excusas.";
      case 2: return "¡Eso es! Practica aquí. El color te indica si vas bien. ¡Simple!";
      case 3: return "Cada repetición que hagas tiene significado. El sistema analiza todo.";
      case 4: return "Ya tienes las herramientas. Ahora solo falta tu sudor. ¿Estás listo?";
      default: return "A entrenar.";
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={currentSlide === TOTAL_TUTORIAL_SLIDES - 1 ? onComplete : undefined}
    >
      <View style={[tutorialStyles.container, { backgroundColor: theme.background }]}>
        {/* Efectos de fondo */}
        <View style={[tutorialStyles.bgGradientTop, { backgroundColor: theme.primary + '10' }]} />
        <View style={[tutorialStyles.bgGradientBottom, { backgroundColor: theme.success + '10' }]} />

        {/* Barra de progreso */}
        <View style={tutorialStyles.progressBar}>
          {Array.from({ length: TOTAL_TUTORIAL_SLIDES }).map((_, idx) => (
            <View
              key={idx}
              style={[
                tutorialStyles.progressSegment,
                {
                  backgroundColor: idx <= currentSlide ? theme.primary : theme.border,
                },
              ]}
            />
          ))}
        </View>

        {/* Contenido de slides */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={tutorialStyles.slidesContainer}
        >
          {/* SLIDE 1: BIENVENIDA */}
          <View style={[tutorialStyles.slide, { width: screenWidth }]}>
            <View style={tutorialStyles.slideContent}>
              <View style={tutorialStyles.logoContainer}>
                <Image
                  source={
                    coachLogo
                      ? { uri: coachLogo }
                      : require('../../assets/logo.png')
                  }
                  style={[tutorialStyles.logo, coachLogo && { borderRadius: 50 }]} // Style adjustment for round logos
                  resizeMode="contain"
                />
              </View>

              <Text style={[tutorialStyles.mainTitle, { color: theme.text }]}>
                SISTEMA{'\n'}
                <Text style={{ color: theme.primary }}>TOTALGAINS</Text>
              </Text>
              <Text style={[tutorialStyles.subtitle, { color: theme.textSecondary }]}>
                Tu progreso, medido al milímetro.
              </Text>

              <TouchableOpacity
                style={[tutorialStyles.startButton, { backgroundColor: theme.primary }]}
                onPress={() => goToSlide(1)}
                activeOpacity={0.85}
              >
                <Text style={tutorialStyles.startButtonText}>INICIAR TUTORIAL</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          {/* SLIDE 3: TUTORIAL INTERACTIVO - Rellena tus primeros datos */}
          <View style={[tutorialStyles.slide, { width: screenWidth }]}>
            <ScrollView style={tutorialStyles.slideScroll} showsVerticalScrollIndicator={false}>
              <View style={tutorialStyles.slideContent}>
                <Ionicons name="create-outline" size={48} color={theme.primary} style={{ alignSelf: 'center', marginBottom: 16 }} />
                <Text style={[tutorialStyles.slideTitle, { color: theme.text, textAlign: 'center' }]}>
                  Rellena tus{'\n'}primeros datos
                </Text>
                <Text style={[tutorialStyles.slideDescription, { color: theme.textSecondary, textAlign: 'center' }]}>
                  Prueba cómo funciona el sistema de colores. Introduce tus repeticiones y observa el cambio.
                </Text>

                {/* Tarjeta de ejercicio simulado */}
                <View style={[tutorialStyles.interactiveCard, {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder
                }]}>
                  {/* Header del ejercicio */}
                  <View style={[tutorialStyles.interactiveHeader, { borderColor: theme.cardBorder }]}>
                    <Text style={[tutorialStyles.interactiveExerciseName, { color: theme.text }]}>
                      Pecho — Press Banca
                    </Text>
                  </View>

                  {/* Fila de Serie */}
                  <View style={[tutorialStyles.interactiveSerieRow, {
                    backgroundColor: getTutorialBgColor(),
                    borderColor: theme.border
                  }]}>
                    {/* Etiqueta Serie + Rango */}
                    <View style={tutorialStyles.interactiveSerieLabel}>
                      <Text style={{ fontSize: 12, color: theme.textSecondary }}>Serie 1</Text>
                      <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>8-12</Text>
                    </View>

                    {/* Input Reps */}
                    <View style={tutorialStyles.interactiveInputCol}>
                      <Text style={[tutorialStyles.interactiveColLabel, { color: theme.textSecondary }]}>Reps</Text>
                      <TextInput
                        style={[tutorialStyles.interactiveInput, {
                          borderColor: theme.inputBorder,
                          backgroundColor: theme.inputBackground,
                          color: theme.inputText
                        }]}
                        placeholder="10"
                        placeholderTextColor={theme.placeholder}
                        keyboardType="numeric"
                        value={tutorialReps}
                        onChangeText={setTutorialReps}
                      />
                    </View>

                    {/* Input Kg */}
                    <View style={tutorialStyles.interactiveInputCol}>
                      <Text style={[tutorialStyles.interactiveColLabel, { color: theme.textSecondary }]}>Kg</Text>
                      <TextInput
                        style={[tutorialStyles.interactiveInput, {
                          borderColor: theme.inputBorder,
                          backgroundColor: theme.inputBackground,
                          color: theme.inputText
                        }]}
                        placeholder="60"
                        placeholderTextColor={theme.placeholder}
                        keyboardType="numeric"
                        value={tutorialKg}
                        onChangeText={setTutorialKg}
                      />
                    </View>
                  </View>
                </View>

                {/* Leyenda de colores */}
                <View style={[tutorialStyles.colorLegend, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                  <Text style={[tutorialStyles.colorLegendTitle, { color: theme.text }]}>Lógica de colores:</Text>

                  <View style={tutorialStyles.colorLegendRow}>
                    <View style={[tutorialStyles.colorDot, { backgroundColor: '#fecaca' }]} />
                    <Text style={[tutorialStyles.colorLegendText, { color: theme.textSecondary }]}>
                      Rojo: por debajo del rango (menos de 8)
                    </Text>
                  </View>

                  <View style={tutorialStyles.colorLegendRow}>
                    <View style={[tutorialStyles.colorDot, { backgroundColor: '#bbf7d0' }]} />
                    <Text style={[tutorialStyles.colorLegendText, { color: theme.textSecondary }]}>
                      Verde: en el rango (8-12)
                    </Text>
                  </View>

                  <View style={tutorialStyles.colorLegendRow}>
                    <View style={[tutorialStyles.colorDot, { backgroundColor: '#bfdbfe' }]} />
                    <Text style={[tutorialStyles.colorLegendText, { color: theme.textSecondary }]}>
                      Azul: supera el rango (más de 12)
                    </Text>
                  </View>
                </View>

                <Text style={[tutorialStyles.slideDescription, { color: theme.textSecondary, marginTop: 16, textAlign: 'center', fontStyle: 'italic' }]}>
                  ¡Prueba escribiendo diferentes números de repeticiones! {'\n'}
                  ¡Cada semana lucharas contra tu yo anterior!
                </Text>
              </View>
            </ScrollView>
          </View>

          {/* SLIDE 2: LOS BOTONES - Versión equilibrada */}
          <View style={[tutorialStyles.slide, { width: screenWidth }]}>
            <ScrollView style={tutorialStyles.slideScroll} showsVerticalScrollIndicator={false}>
              <View style={[tutorialStyles.slideContent, { paddingBottom: 140 }]}>
                <Text style={[tutorialStyles.slideTitle, { color: theme.text, fontSize: 26, marginBottom: 6 }]}>
                  Lógica del Sistema
                </Text>
                <Text style={[tutorialStyles.slideDescription, { color: theme.textSecondary, marginBottom: 16, fontSize: 14 }]}>
                  Cada serie se clasifica con uno de estos estados:
                </Text>

                {/* Cards estados - en fila horizontal con más info */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                  {/* C */}
                  <View style={[tutorialStyles.miniCard, { backgroundColor: theme.success + '20', borderColor: theme.success + '40', flex: 1, paddingVertical: 16 }]}>
                    <Ionicons name="checkmark-circle" size={40} color={theme.success} />
                    <Text style={[tutorialStyles.miniCardSubtitle, { color: theme.textSecondary, marginTop: 8 }]}>Completado</Text>
                  </View>
                  {/* NC */}
                  <View style={[tutorialStyles.miniCard, { backgroundColor: '#ef4444' + '20', borderColor: '#ef4444' + '40', flex: 1, paddingVertical: 16 }]}>
                    <Ionicons name="close-circle" size={40} color="#ef4444" />
                    <Text style={[tutorialStyles.miniCardSubtitle, { color: theme.textSecondary, marginTop: 8 }]}>Fallado</Text>
                  </View>
                  {/* OE */}
                  <View style={[tutorialStyles.miniCard, { backgroundColor: '#f59e0b' + '20', borderColor: '#f59e0b' + '40', flex: 1, paddingVertical: 16 }]}>
                    <Ionicons name="swap-horizontal" size={40} color="#f59e0b" />
                    <Text style={[tutorialStyles.miniCardSubtitle, { color: theme.textSecondary, marginTop: 8 }]}>Alternativa</Text>
                  </View>
                </View>

                {/* Descripción breve de estados */}
                <Text style={{ color: theme.textSecondary, fontSize: 18, marginBottom: 20, lineHeight: 18, fontWeight: '600', paddingVertical: 20 }}>
                  C = Guardas datos y sumas progreso{'\n'}
                  NC = No se guarda, repites la próxima semana{'\n'}
                  OE = Cambiaste de ejercicio por algún motivo
                </Text>

                {/* Separador visual */}
                <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 16 }} />

                {/* Título herramientas */}
                <Text style={[tutorialStyles.slideDescription, { color: theme.textSecondary, marginBottom: 12, fontSize: 14 }]}>
                  Cada ejercicio tiene botones de ayuda:
                </Text>

                {/* Botones de ayuda en fila */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {/* TC */}
                  <View style={[tutorialStyles.miniCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, flex: 1, paddingVertical: 14 }]}>
                    <View style={{ backgroundColor: theme.backgroundTertiary, padding: 8, borderRadius: 8 }}>
                      <Text style={{ fontWeight: '800', fontSize: 13, color: theme.text }}>TC</Text>
                    </View>
                    <Text style={[tutorialStyles.miniCardSubtitle, { color: theme.textSecondary }]}>Técnica</Text>
                  </View>
                  {/* Imagen */}
                  <View style={[tutorialStyles.miniCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, flex: 1, paddingVertical: 14 }]}>
                    <View style={{ backgroundColor: theme.backgroundTertiary, padding: 8, borderRadius: 8 }}>
                      <Text style={{ fontSize: 16 }}>🖼️</Text>
                    </View>
                    <Text style={[tutorialStyles.miniCardSubtitle, { color: theme.textSecondary }]}>Imagen</Text>
                  </View>
                  {/* Video */}
                  <View style={[tutorialStyles.miniCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, flex: 1, paddingVertical: 14 }]}>
                    <View style={{ backgroundColor: theme.backgroundTertiary, padding: 8, borderRadius: 8 }}>
                      <Ionicons name="videocam" size={18} color={theme.text} />
                    </View>
                    <Text style={[tutorialStyles.miniCardSubtitle, { color: theme.textSecondary }]}>Video</Text>
                  </View>
                </View>

                {/* Descripción breve herramientas */}
                <Text style={{ color: theme.textSecondary, fontSize: 20, textAlign: 'center', marginTop: 8, lineHeight: 18, fontWeight: '600' }}>
                  Ver tips de técnica, fotos del ejercicio o video tutorial
                </Text>
              </View>
            </ScrollView>
          </View>



          {/* SLIDE 4: TUS DATOS */}
          <View style={[tutorialStyles.slide, { width: screenWidth }]}>
            <ScrollView style={tutorialStyles.slideScroll} showsVerticalScrollIndicator={false}>
              <View style={tutorialStyles.slideContent}>
                <Ionicons name="analytics" size={48} color={theme.primary} style={{ alignSelf: 'center', marginBottom: 16 }} />
                <Text style={[tutorialStyles.slideTitle, { color: theme.text, textAlign: 'center' }]}>
                  Tus Datos Cuentan
                </Text>
                <Text style={[tutorialStyles.slideDescription, { color: theme.textSecondary }]}>
                  Cada vez que entrenes, el sistema guardará:
                </Text>

                <View style={[tutorialStyles.dataCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                  <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                  <Text style={[tutorialStyles.dataText, { color: theme.text }]}>Repeticiones por serie</Text>
                </View>

                <View style={[tutorialStyles.dataCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                  <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                  <Text style={[tutorialStyles.dataText, { color: theme.text }]}>Peso levantado</Text>
                </View>

                <View style={[tutorialStyles.dataCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                  <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                  <Text style={[tutorialStyles.dataText, { color: theme.text }]}>Volumen total</Text>
                </View>

                <View style={[tutorialStyles.dataCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                  <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                  <Text style={[tutorialStyles.dataText, { color: theme.text }]}>1RM estimado</Text>
                </View>

                <Text style={[tutorialStyles.slideDescription, { color: theme.textSecondary, marginTop: 24, textAlign: 'center' }]}>
                  Podrás ver tu evolución completa en tu perfil en la sección de evolución.
                </Text>
              </View>
            </ScrollView>
          </View>

          {/* SLIDE 5: MOTIVACIÓN FINAL */}
          <View style={[tutorialStyles.slide, { width: screenWidth }]}>
            <View style={tutorialStyles.slideContent}>
              <View style={tutorialStyles.finalImageContainer}>
                <Image
                  source={
                    coachLogo
                      ? { uri: coachLogo }
                      : require('../../assets/images/fitness/IMAGEN1.jpg')
                  }
                  style={tutorialStyles.finalImage}
                  resizeMode="cover"
                />
                <View style={tutorialStyles.finalImageOverlay} />
                <Text style={tutorialStyles.finalImageText}>
                  NOFUN{'\n'}
                  <Text style={tutorialStyles.finalImageTextAccent}>NOGAIN</Text>
                </Text>
              </View>

              <Text style={[tutorialStyles.finalText, { color: theme.text }]}>
                El sistema está listo. El camino está marcado. Lo único que falta es tu voluntad.
              </Text>

              {/* Nota de recordatorio */}
              <View style={[tutorialStyles.reminderNote, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                <Ionicons name="information-circle" size={18} color={theme.primary} />
                <Text style={[tutorialStyles.reminderText, { color: theme.primary }]}>
                  Puedes volver a ver este tutorial desde Ajustes → Tutoriales
                </Text>
              </View>

              <TouchableOpacity
                style={[tutorialStyles.finalButton, { backgroundColor: theme.success }]}
                onPress={onComplete}
                activeOpacity={0.85}
              >
                <Ionicons name="trophy" size={28} color="#fff" />
                <Text style={tutorialStyles.finalButtonText}>¡A DARLE CAÑA!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Profesor Coach (fijo abajo) */}
        <View style={[tutorialStyles.coachContainer, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={tutorialStyles.coachContent}>
            <View style={tutorialStyles.coachAvatarContainer}>
              <View style={[tutorialStyles.coachAvatarGlow, { backgroundColor: theme.primary + '20' }]} />
              <Image
                source={
                  coachLogo
                    ? { uri: coachLogo }
                    : require('../../assets/images/fitness/IMAGEN1.jpg')
                }
                style={tutorialStyles.coachAvatar}
                resizeMode="cover"
              />
            </View>

            <View style={[tutorialStyles.coachBubble, {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder
            }]}>
              <Text style={[tutorialStyles.coachText, { color: theme.text }]}>
                {getCoachMessage()}
              </Text>
            </View>
          </View>

          {/* Navegación */}
          <View style={tutorialStyles.navigation}>
            <TouchableOpacity
              onPress={() => goToSlide(currentSlide - 1)}
              disabled={currentSlide === 0}
              style={[
                tutorialStyles.navButton,
                { backgroundColor: theme.iconButton },
                currentSlide === 0 && tutorialStyles.navButtonDisabled
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={currentSlide === 0 ? theme.border : theme.text}
              />
            </TouchableOpacity>

            <Text style={[tutorialStyles.navCounter, { color: theme.textSecondary }]}>
              {currentSlide + 1} / {TOTAL_TUTORIAL_SLIDES}
            </Text>

            <TouchableOpacity
              onPress={() => currentSlide === TOTAL_TUTORIAL_SLIDES - 1 ? onComplete() : goToSlide(currentSlide + 1)}
              style={[tutorialStyles.navButton, { backgroundColor: theme.primary }]}
            >
              <Ionicons
                name={currentSlide === TOTAL_TUTORIAL_SLIDES - 1 ? "checkmark" : "chevron-forward"}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ───────── Estilos del Tutorial ───────── */
const tutorialStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgGradientTop: {
    position: 'absolute',
    top: -100,
    left: 0,
    width: '100%',
    height: 300,
    borderRadius: 9999,
    opacity: 0.3,
  },
  bgGradientBottom: {
    position: 'absolute',
    bottom: -100,
    right: 0,
    width: '100%',
    height: 300,
    borderRadius: 9999,
    opacity: 0.3,
  },
  progressBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 8,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  slidesContainer: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  slideScroll: {
    flex: 1,
  },
  slideContent: {
    flex: 1,
    padding: 20,
    paddingBottom: 140,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 40,
  },
  logo: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  mainTitle: {
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 12,
  },
  slideDescription: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ghostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  ghostCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    marginBottom: 24,
  },
  ghostTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 20,
  },
  ghostTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  ghostPrevious: {
    marginBottom: 24,
    opacity: 0.5,
  },
  ghostToday: {
    marginTop: 8,
  },
  ghostLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ghostLabelText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ghostValues: {
    flexDirection: 'row',
    gap: 16,
  },
  ghostValueBox: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  ghostValueNumber: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
  },
  ghostValueLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  ghostBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ghostBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  ghostQuote: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  ghostQuoteText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Estilos del Tutorial Interactivo
  interactiveCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  interactiveHeader: {
    padding: 12,
    borderBottomWidth: 1,
  },
  interactiveExerciseName: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Mini cards para vista compacta
  miniCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  miniCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  miniCardText: {
    fontSize: 10,
    textAlign: 'center',
  },
  miniCardSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  interactiveSerieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    margin: 8,
    borderWidth: 1,
  },
  interactiveSerieLabel: {
    width: 70,
    justifyContent: 'center',
  },
  interactiveInputCol: {
    alignItems: 'center',
    marginHorizontal: 12,
  },
  interactiveColLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  interactiveInput: {
    width: 55,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  colorLegend: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  colorLegendTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  colorLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  colorLegendText: {
    fontSize: 12,
    flex: 1,
  },
  dataCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  dataText: {
    fontSize: 16,
    fontWeight: '600',
  },
  finalImageContainer: {
    width: '100%',
    height: 300,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 32,
    position: 'relative',
  },
  finalImage: {
    width: '100%',
    height: '100%',
  },
  finalImageOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  finalImageText: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    fontStyle: 'italic',
  },
  finalImageTextAccent: {
    color: '#ef4444',
  },
  finalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    fontWeight: '600',
  },
  finalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  finalButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  reminderNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 24,
  },
  reminderText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  coachContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  coachContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 10,
  },
  coachAvatarContainer: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  coachAvatarGlow: {
    position: 'absolute',
    inset: 0,
    borderRadius: 26,
    opacity: 0.3,
  },
  coachAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#334155',
  },
  coachBubble: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    borderWidth: 1,
  },
  coachText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navCounter: {
    fontSize: 14,
    fontWeight: '800',
  },
  ghostToday: {
    marginTop: 8,
  },
  ghostLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ghostLabelText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ghostValues: {
    flexDirection: 'row',
    gap: 16,
  },
  ghostValueBox: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  ghostValueNumber: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
  },
  ghostValueLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  ghostBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ghostBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  ghostQuote: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  ghostQuoteText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  dataCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  dataText: {
    fontSize: 16,
    fontWeight: '600',
  },
  finalImageContainer: {
    width: '100%',
    height: 300,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 32,
    position: 'relative',
  },
  finalImage: {
    width: '100%',
    height: '100%',
  },
  finalImageOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  finalImageText: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    fontStyle: 'italic',
  },
  finalImageTextAccent: {
    color: '#ef4444',
  },
  finalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    fontWeight: '600',
  },
  finalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  finalButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  coachContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
  },
  coachContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 16,
  },
  coachAvatarContainer: {
    position: 'relative',
    width: 64,
    height: 64,
  },
  coachAvatarGlow: {
    position: 'absolute',
    inset: 0,
    borderRadius: 32,
    opacity: 0.3,
  },
  coachAvatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
  },
  coachBubble: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    borderWidth: 1,
  },
  coachText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navCounter: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});

/* ───────── Exercise Card Component ───────── */
function arePropsEqual(prev, next) {
  const { item: pItem, prog: pProg, notes: pNotes, openId: pOpen, semana: pSem, diaIdx: pDia } = prev;
  const { item: nItem, prog: nProg, notes: nNotes, openId: nOpen, semana: nSem, diaIdx: nDia } = next;

  // Basic props
  if (pItem.id !== nItem.id) return false;
  if (pSem !== nSem || pDia !== nDia) return false;
  // Theme check
  if (prev.theme !== next.theme) return false;
  if (prev.showBiserieConnector !== next.showBiserieConnector) return false;

  // Open State
  const wasOpen = pOpen === pItem.id;
  const isOpen = nOpen === nItem.id;
  if (wasOpen !== isOpen) return false;

  // Progress State
  const ejerKey = `${nSem}|${nDia}|${nItem.id}`;
  if (pProg[ejerKey] !== nProg[ejerKey]) return false;

  // Check series
  const series = nItem.series || [];
  for (let i = 0; i < series.length; i++) {
    const sKey = `${ejerKey}|${i}`;
    if (pProg[sKey] !== nProg[sKey]) return false;
    if (pNotes[sKey] !== nNotes[sKey]) return false;
  }

  // Check exercise details
  const pDetails = prev.exerciseDetailsMap.get(pItem.id);
  const nDetails = next.exerciseDetailsMap.get(nItem.id);
  if (pDetails !== nDetails) return false;

  return true;
}

const ExerciseCard = memo(({
  item,
  index,
  prog,
  notes,
  semana,
  diaIdx,
  openId,
  setOpenId,
  setEstadoEjLocal,
  setSerieDato,
  onOpenTC,
  onOpenImage,
  onOpenVideo,
  exerciseDetailsMap,
  theme,
  handleInputFocus,
  flushProgress,
  setNotesModal,
  showBiserieConnector
}) => {
  if (!item) return null;

  const ejerKey = `${semana}|${diaIdx}|${item.id}`;
  const abierto = openId === item.id;

  // Compat visual con datos antiguos "OJ" -> se muestra como OE
  const currentState = prog[ejerKey] === 'OJ' ? 'OE' : prog[ejerKey];

  // Detectar si este ejercicio es parte de una biserie
  const isBiserie = (ej) => {
    if (!ej?.series || !Array.isArray(ej.series)) return false;
    return ej.series.some(serie => {
      const extra = String(serie?.extra || '').toLowerCase().trim();
      return extra === 'biserie' || extra === 'biseries' || extra === 'bs';
    });
  };

  const currentIsBiserie = isBiserie(item);

  const findPrev = (week, d, eId, sIdx, field) => {
    for (let w = week - 1; w > 0; w--) {
      const key = `${w}|${d}|${eId}|${sIdx}`;
      const data = prog[key]?.[field];
      if (data) return data;
    }
    return null;
  };

  return (
    <>
      <View style={[styles.card, {
        backgroundColor: theme.cardBackground,
        borderColor: currentIsBiserie ? '#F59E0B' : theme.cardBorder,
        borderWidth: currentIsBiserie ? 2 : 1,
      }]}>
        {/* Badge BS para biseries */}
        {currentIsBiserie && (
          <View style={styles.biserieBadge}>
            <Text style={styles.biserieBadgeText}>BS</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.cardHeader, { borderColor: theme.cardHeaderBorder, backgroundColor: theme.cardHeaderBg }]}
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
            {/* C - Check (Completado) */}
            <TouchableOpacity
              style={[
                styles.radio,
                {
                  borderColor: currentState === 'C' ? '#22c55e' : '#bbf7d0',
                  backgroundColor: currentState === 'C' ? '#22c55e' : '#f0fdf4'
                }
              ]}
              onPress={() => setEstadoEjLocal(ejerKey, 'C')}
            >
              <Ionicons
                name="checkmark"
                size={16}
                color={currentState === 'C' ? '#fff' : '#86efac'}
              />
            </TouchableOpacity>

            {/* NC - Cruz (No Completado) */}
            <TouchableOpacity
              style={[
                styles.radio,
                {
                  borderColor: currentState === 'NC' ? '#ef4444' : '#fecaca',
                  backgroundColor: currentState === 'NC' ? '#ef4444' : '#fef2f2'
                }
              ]}
              onPress={() => setEstadoEjLocal(ejerKey, 'NC')}
            >
              <Ionicons
                name="close"
                size={16}
                color={currentState === 'NC' ? '#fff' : '#fca5a5'}
              />
            </TouchableOpacity>

            {/* OE - Flechas de Cambio (Orden Ejercicio) */}
            <TouchableOpacity
              style={[
                styles.radio,
                {
                  borderColor: currentState === 'OE' ? '#f97316' : '#fed7aa',
                  backgroundColor: currentState === 'OE' ? '#f97316' : '#fff7ed'
                }
              ]}
              onPress={() => setEstadoEjLocal(ejerKey, 'OE')}
            >
              <Ionicons
                name="swap-horizontal"
                size={16}
                color={currentState === 'OE' ? '#fff' : '#fdba74'}
              />
            </TouchableOpacity>
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
              onPress={() => onOpenImage(item)}
              style={[styles.toolBtn, styles.toolBtnIcon, {
                backgroundColor: theme.backgroundTertiary,
                borderColor: theme.border,
                opacity: exerciseDetailsMap.get(item.id)?.hasImage ? 1 : 0.5
              }]}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 14 }}>
                {exerciseDetailsMap.get(item.id)?.hasImage ? '🖼️' : '🚫'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onOpenVideo(item)}
              style={[styles.toolBtn, styles.toolBtnIcon, {
                backgroundColor: theme.backgroundTertiary,
                borderColor: theme.border,
                opacity: exerciseDetailsMap.get(item.id)?.hasVideo ? 1 : 0.5
              }]}
              activeOpacity={0.85}
            >
              <Ionicons
                name={exerciseDetailsMap.get(item.id)?.hasVideo ? "videocam-outline" : "videocam-off-outline"}
                size={16}
                color={theme.text}
              />
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

              // Detectar si es serie al Fallo
              const repMinRaw = serie?.repMin;
              const repMaxRaw = serie?.repMax;
              const isFallo = String(repMinRaw).toLowerCase() === 'fallo' ||
                String(repMaxRaw).toLowerCase() === 'fallo';

              const repMin = !isFallo && repMinRaw != null ? Number(repMinRaw) : null;
              const repMax = !isFallo && repMaxRaw != null ? Number(repMaxRaw) : null;
              const reps = curr?.reps != null ? Number(curr.reps) : null;

              // Solo aplicar colores si NO es fallo
              if (!isFallo && reps !== null && repMin !== null && repMax !== null && !isNaN(repMin) && !isNaN(repMax)) {
                if (reps < repMin) bgColor = '#fecaca';
                else if (reps > repMax) bgColor = '#bfdbfe';
                else bgColor = '#bbf7d0';
              }

              const prevExceeded =
                !isFallo && prevReps !== null && repMax !== null && Number(prevReps) > repMax;
              const iconReps = getTrendIcon(curr.reps, prevReps);
              const iconKg = getTrendIcon(curr.peso, prevKg);

              return (
                <View key={idx} style={[styles.serieRow, {
                  backgroundColor: bgColor,
                  borderColor: theme.border
                }]}>
                  <View style={{ width: 70, justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>Serie {idx + 1}</Text>
                    {isFallo ? (
                      <Text style={{ fontSize: 10, color: '#ef4444', marginTop: 2, fontWeight: '600' }}>
                        🔥 Fallo
                      </Text>
                    ) : (repMin !== null && repMax !== null && !isNaN(repMin) && !isNaN(repMax)) && (
                      <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>
                        {repMin}-{repMax}
                      </Text>
                    )}
                    {/* Nota del entrenador */}
                    {serie?.nota && serie.nota.trim() !== '' && (
                      <TouchableOpacity
                        onPress={() => Alert.alert('📝 Nota del Coach', serie.nota)}
                        style={{ marginTop: 3 }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 10, color: '#f59e0b' }}>⚠️ Nota</Text>
                      </TouchableOpacity>
                    )}
                  </View>

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
                      onFocus={() => handleInputFocus(index)}
                      onChangeText={(v) => setSerieDato(serieKey, 'reps', v, item, (item.series || []).length)}
                      onBlur={flushProgress}
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
                      onChangeText={(v) => setSerieDato(serieKey, 'peso', v, item, (item.series || []).length)}
                      onBlur={flushProgress}
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

                  {/* 📝 Botón de Feedback Unificado (reemplaza video + notas separados) */}
                  <View style={styles.actionBtns}>
                    <TouchableOpacity
                      onPress={async () => {
                        const existingNote = notes[serieKey];
                        let pendingMediaUri = existingNote?.mediaUri || null;
                        let pendingMediaType = existingNote?.mediaType || null;

                        // 📸 Leer pending photo/video de AsyncStorage si existe
                        try {
                          // Check for pending photo
                          const pendingPhotoJson = await AsyncStorage.getItem('pending_photo_feedback');
                          if (pendingPhotoJson) {
                            const pendingPhoto = JSON.parse(pendingPhotoJson);
                            // Solo usar si es para esta serie
                            if (pendingPhoto.serieKey === serieKey) {
                              pendingMediaUri = pendingPhoto.photoUri;
                              pendingMediaType = 'photo';
                              console.log('[Entreno] 📸 Pending photo encontrada:', pendingMediaUri);
                            }
                            // Limpiar después de leer
                            await AsyncStorage.removeItem('pending_photo_feedback');
                          }

                          // Check for pending video
                          const pendingVideoJson = await AsyncStorage.getItem('pending_video_feedback');
                          if (pendingVideoJson) {
                            const pendingVideo = JSON.parse(pendingVideoJson);
                            // Solo usar si es para esta serie
                            if (pendingVideo.serieKey === serieKey) {
                              pendingMediaUri = pendingVideo.videoPath; // preview.jsx guarda videoPath
                              pendingMediaType = 'video';
                              console.log('[Entreno] 📹 Pending video encontrado:', pendingMediaUri);
                            }
                            // Limpiar después de leer
                            await AsyncStorage.removeItem('pending_video_feedback');
                          }
                        } catch (err) {
                          console.error('[Entreno] Error leyendo pending media:', err);
                        }

                        setNotesModal({
                          visible: true,
                          serieKey,
                          exerciseId: item.id,
                          exerciseName: item.nombre,
                          value: existingNote?.value || 'low',
                          note: existingNote?.note || '',
                          audioUri: existingNote?.audioUri || null,
                          mediaUri: pendingMediaUri,
                          mediaType: pendingMediaType,
                        });
                      }}
                      style={styles.actionBtn}
                      activeOpacity={0.7}
                    >
                      {notes[serieKey] ? (
                        <View style={[
                          styles.noteDot,
                          { backgroundColor: NOTE_VALUES.find(n => n.key === notes[serieKey]?.value)?.color || '#6b7280' }
                        ]} />
                      ) : (
                        <Ionicons name="chatbubble-ellipses" size={15} color="#10b981" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

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
}, arePropsEqual);

export default function Entreno() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { processWorkoutCompletion } = useAchievements();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [activeId, setActiveId] = useState(null);  // rutina activa
  const [hydrated, setHydrated] = useState(false); // ya cargamos última sesión
  const [rutina, setRutina] = useState(null);
  const [diasEj, setDiasEj] = useState([]); // siempre [][] tras normalizar
  const [semana, setSemana] = useState(1);
  const [diaIdx, setDiaIdx] = useState(0);
  const [prog, setProg] = useState({});
  const [openId, setOpenId] = useState(null);

  // Modales de Técnica, Imagen y Vídeo
  const [techModal, setTechModal] = useState({ visible: false, title: '', tips: [] });
  const [videoModal, setVideoModal] = useState({ visible: false, videoId: null, playing: false, title: '' });
  const [imageModal, setImageModal] = useState({ visible: false, imageUrl: null, title: '' });

  // Modal de Sin Rutina Activa
  const [showNoRoutineModal, setShowNoRoutineModal] = useState(false);

  // 🎓 Tutorial Modal (solo primera vez)
  const [showTutorial, setShowTutorial] = useState(false);

  // 🔥 NUEVO: Modal de estadísticas
  const [statsModal, setStatsModal] = useState({ visible: false, stats: null, workoutId: null });

  // Modal de Upgrade para FREEUSER
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // 📝 Sistema de Notas por Serie
  const [notes, setNotes] = useState({}); // { serieKey: { value, note, audioUri, mediaUri, mediaType } }
  const [notesModal, setNotesModal] = useState({
    visible: false,
    serieKey: null,
    exerciseId: null,
    exerciseName: null,
    value: 'low', // Default: Ok (🟢)
    note: '',
    audioUri: null,
    mediaUri: null,
    mediaType: null,
  });


  // 🚪 Modal de confirmación de salida (cambios sin guardar)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const pendingNavigationRef = useRef(null);

  const listRef = useRef(null);

  // ⚡ Refs para debounce del guardado de series (evita AsyncStorage en cada tecla)
  const saveTimeoutRef = useRef(null);
  const pendingProgRef = useRef(null);

  // ⚡ Ref para evitar problemas de orden con flushProgress
  const flushProgressRef = useRef(null);

  // 🆕 Estado para ejercicios desde MongoDB
  const [exercises, setExercises] = useState([]);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const { token } = useAuth();

  // 📹 Hook para subida de media feedback a R2
  const { uploadVideoFeedback, uploadPhotoFeedback, uploadAudioFeedback, uploading: mediaUploading } = useVideoFeedback(API_URL, token);
  // 🆕 Índice dinámico de ejercicios
  const exercisesIndex = useMemo(() => {
    return buildExerciseIndex(exercises);
  }, [exercises]);
  // 🆕 Función findExercise que usa el índice dinámico
  const findExerciseInIndex = useCallback((musculo, nombre) => {
    const group = exercisesIndex[String(musculo || '').trim()];
    if (!group) {
      // Fallback: buscar por nombre en TODOS los músculos
      const norm = normalizeStr(nombre);
      for (const mus of Object.keys(exercisesIndex)) {
        const g = exercisesIndex[mus];
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
  }, [exercisesIndex]);
  // 🆕 Fetch exercises from API
  const fetchAllExercises = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/exercises`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const contentType = response.headers.get('content-type');
      if (!response.ok || !contentType?.includes('application/json')) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setExercises(data.exercises);
      }
    } catch (error) {
      console.error(' fetching exercises:', error);
    }
  }, [API_URL, token]);

  // 🆕 Recuperar TODOS los datos de workout desde la nube (usuarios premium)
  // Carga todos los workouts de la rutina de una vez para evitar múltiples llamadas
  // 🔧 FIX: Añadido parámetro isFromCoach para usar currentRoutineId en lugar de routineId
  const fetchAllCloudProgress = useCallback(async (routineId, diasNorm, isFromCoach = false) => {
    // Solo para usuarios premium y con routineId válido de MongoDB
    if (!token || user?.tipoUsuario === 'FREEUSER' || !routineId?.match(/^[0-9a-fA-F]{24}$/)) {
      return null;
    }

    try {
      // 🔧 FIX: Usar currentRoutineId para rutinas de entrenador
      const queryParam = isFromCoach ? `currentRoutineId=${routineId}` : `routineId=${routineId}`;
      const response = await fetch(
        `${API_URL}/api/workouts?${queryParam}&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();

      if (data.success && data.workouts?.length > 0) {
        console.log(`[Entreno] ☁️ ${data.workouts.length} workouts encontrados en la nube para esta rutina`);

        // Transformar TODOS los workouts de API a formato de progreso local
        const cloudProg = {};
        const cloudNotes = {}; // 📝 Notas desde la nube

        for (const workout of data.workouts) {
          const workoutWeek = workout.week || 1;
          const workoutDayIdx = (workout.dayIndex || 1) - 1; // API usa 1-indexed, convertir a 0-indexed

          // Obtener ejercicios de este día específico
          const exercisesList = diasNorm[workoutDayIdx] || [];

          workout.exercises?.forEach((ex, orderIdx) => {
            // 🔧 FIX: Buscar ejercicio por dbId primero, luego por nombre+músculo, finalmente por posición
            let localEx = null;

            // 1. Intentar match por exerciseId/dbId (más preciso)
            if (ex.exerciseId) {
              localEx = exercisesList.find(e => e.dbId === ex.exerciseId || e.dbId === String(ex.exerciseId));
            }

            // 2. Si no hay match por ID, intentar por nombre + músculo
            if (!localEx && ex.exerciseName) {
              localEx = exercisesList.find(e =>
                e.nombre === ex.exerciseName &&
                e.musculo?.toUpperCase() === ex.muscleGroup?.toUpperCase()
              );
            }

            // 3. Fallback: match por posición (comportamiento original)
            if (!localEx) {
              localEx = exercisesList[orderIdx];
            }

            if (!localEx) return;

            // 🆕 Leer el estado guardado del ejercicio, no asumir 'C'
            const ejerKey = `${workoutWeek}|${workoutDayIdx}|${localEx.id}`;
            // El servidor guarda el estado en ex.status (C, NC, OE)
            if (ex.status && ['C', 'NC', 'OE'].includes(ex.status)) {
              cloudProg[ejerKey] = ex.status;
            } else if (workout.status === 'completed') {
              // Fallback: si no hay status guardado pero el workout está completado,
              // verificar si hay datos en las series para decidir
              const hasData = ex.sets?.some(s => s.actualReps > 0 || s.weight > 0);
              cloudProg[ejerKey] = hasData ? 'C' : 'NC';
            }

            ex.sets?.forEach((set, setIdx) => {
              const serieKey = `${workoutWeek}|${workoutDayIdx}|${localEx.id}|${setIdx}`;
              cloudProg[serieKey] = {
                reps: set.actualReps?.toString() || '',
                peso: set.weight?.toString() || ''
              };

              // 📝 Extraer notas si existen
              if (set.notes && (set.notes.value || set.notes.note)) {
                cloudNotes[serieKey] = {
                  value: set.notes.value || null,
                  note: set.notes.note || ''
                };
              }
            });
          });
        }

        return { cloudProg, cloudNotes };
      }
    } catch (error) {
      console.warn('[Entreno] Error fetching cloud progress:', error);
    }
    return null;
  }, [API_URL, token, user?.tipoUsuario]);


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
      } catch { }
    },
    [activeId, hydrated]
  );

  /* Hidratar todo (rutina activa, días, progreso y última sesión) */
  const hydrate = useCallback(async () => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL;

    // ════════════════════════════════════════════════════════════════════════
    // Leer la rutina activa de AsyncStorage primero
    // ════════════════════════════════════════════════════════════════════════
    const activeRoutineId = await AsyncStorage.getItem('active_routine');
    const isFromCoachFlag = await AsyncStorage.getItem('active_routine_from_coach');

    // ════════════════════════════════════════════════════════════════════════
    // Si la rutina es de coach (flag establecido), cargar de CurrentRoutine
    // Esto funciona incluso si el usuario es también un entrenador con rutinas asignadas
    // ════════════════════════════════════════════════════════════════════════
    if (token && isFromCoachFlag === 'true') {
      try {
        console.log('[Entreno] 👨‍🏫 Rutina de entrenador, cargando de CurrentRoutine...');
        const response = await fetch(`${API_URL}/api/current-routines/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.routines?.length > 0) {
          // 🆕 Buscar la rutina específica que el usuario seleccionó (por activeRoutineId)
          // Si no hay activeRoutineId, tomar la primera
          let currentRoutine = data.routines[0];
          if (activeRoutineId) {
            const found = data.routines.find(r => r._id === activeRoutineId);
            if (found) {
              currentRoutine = found;
            }
          }

          console.log('[Entreno] ✅ CurrentRoutine encontrada:', currentRoutine.nombre);

          // Convertir diasArr a formato normalizado y asegurar IDs únicos
          const diasNorm = ensureUniqueExerciseIds(normalizeDias(currentRoutine.diasArr || []));

          setActiveId(currentRoutine._id);
          setRutina({
            id: currentRoutine._id,
            nombre: currentRoutine.nombre,
            dias: currentRoutine.dias || diasNorm.length || 1,
            isFromCoach: true,
            sourceRoutineId: currentRoutine.sourceRoutineId
          });
          setDiasEj(diasNorm);

          // Cargar última sesión guardada
          try {
            const sessionStr = await AsyncStorage.getItem(sessionKeyFor(currentRoutine._id));
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
          } catch { }

          // Cargar progreso local
          const progStr = await AsyncStorage.getItem('progress') || '{}';
          const localProg = JSON.parse(progStr);
          setProg(localProg);

          // Cargar progreso de la nube - usar el _id de la CurrentRoutine
          const mongoRoutineId = currentRoutine._id;
          if (mongoRoutineId) {
            // 🔧 FIX: Pasar isFromCoach=true para usar currentRoutineId en la query
            const cloudData = await fetchAllCloudProgress(mongoRoutineId, diasNorm, true);
            if (cloudData?.cloudProg && Object.keys(cloudData.cloudProg).length > 0) {
              setProg(prev => ({ ...prev, ...cloudData.cloudProg }));
            }
            if (cloudData?.cloudNotes && Object.keys(cloudData.cloudNotes).length > 0) {
              setNotes(prev => ({ ...prev, ...cloudData.cloudNotes }));
            }
          }

          setHydrated(true);
          return; // Salir, no continuar con flujo normal
        }
        console.log('[Entreno] ⚠️ No hay CurrentRoutines asignadas, usando flujo normal');
      } catch (error) {
        console.error('[Entreno] Error cargando CurrentRoutine:', error);
        // Continuar con flujo normal si hay error
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // FLUJO ORIGINAL: Cargar desde AsyncStorage
    // ════════════════════════════════════════════════════════════════════════
    const result = await AsyncStorage.multiGet([
      'active_routine',
      'active_routine_name', // 🆕 Cargar también el nombre guardado
      'rutinas',
      'progress',
    ]);

    const idAct = result[0]?.[1] || null;
    const savedRoutineName = result[1]?.[1] || null; // 🆕 Nombre guardado
    setActiveId(idAct);

    const listJSON = result[2]?.[1] || '[]';
    const progStr = result[3]?.[1] || '{}';

    if (!idAct) {
      setShowNoRoutineModal(true);
      setHydrated(true);
      return;
    }

    const lista = JSON.parse(listJSON || '[]');
    const activa = lista.find((r) => r && r.id === idAct) || null;
    const stored = await AsyncStorage.getItem(`routine_${idAct}`);

    // ════════════════════════════════════════════════════════════════════════
    // 🆕 FIX: Si no hay datos locales pero es ID de MongoDB, cargar desde API
    // ════════════════════════════════════════════════════════════════════════
    const extractMongoId = (id) => {
      if (!id) return null;
      if (/^[0-9a-fA-F]{24}$/.test(id)) return id;
      if (id.startsWith('srv_')) {
        const mongoId = id.replace('srv_', '');
        if (/^[0-9a-fA-F]{24}$/.test(mongoId)) return mongoId;
      }
      return null;
    };

    let routineData = stored ? JSON.parse(stored) : null;
    const mongoRoutineId = extractMongoId(idAct);

    // Si no hay datos locales pero es un ID de MongoDB, cargar desde la API
    if (!routineData && mongoRoutineId && token && user?.tipoUsuario !== 'FREEUSER') {
      try {
        console.log('[Entreno] 📡 Rutina no encontrada localmente, cargando desde servidor...');
        const response = await fetch(`${API_URL}/api/routines/${mongoRoutineId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.routine) {
          const serverRoutine = data.routine;
          routineData = {};

          // Convertir diasArr a formato {dia1: [], dia2: [], ...}
          // y asegurar que cada ejercicio tenga un ID único
          if (Array.isArray(serverRoutine.diasArr)) {
            serverRoutine.diasArr.forEach((dayExercises, idx) => {
              routineData[`dia${idx + 1}`] = (dayExercises || []).map((ej, ejIdx) => ({
                ...ej,
                id: ej?.id || `ej-${_uid()}`,
              }));
            });
          }

          // Cachear en AsyncStorage para uso futuro (ya con IDs)
          await AsyncStorage.setItem(`routine_${idAct}`, JSON.stringify(routineData));
          console.log('[Entreno] ✅ Rutina cargada y cacheada:', serverRoutine.nombre);
        }
      } catch (error) {
        console.error('[Entreno] Error cargando rutina del servidor:', error);
      }
    }

    const diasNorm = ensureUniqueExerciseIds(normalizeDias(routineData || []));
    // 🆕 Usar nombre guardado como fallback si la rutina no está en la lista
    const metaBase = activa || { id: idAct, nombre: savedRoutineName || 'Rutina Desconocida' };

    setRutina({ ...metaBase, dias: diasNorm.length || 1 });
    setDiasEj(diasNorm);

    // Cargar progreso local primero
    const localProg = JSON.parse(progStr || '{}');
    setProg(localProg);

    // Variables para semana y día
    let currentSemana = 1;
    let currentDiaIdx = 0;

    try {
      const sessionStr = await AsyncStorage.getItem(sessionKeyFor(idAct));
      if (sessionStr) {
        const { lastSemana, lastDiaIdx } = JSON.parse(sessionStr);
        const total = diasNorm.length || 1;
        const safeDia = Math.max(0, Math.min(Number(lastDiaIdx) || 0, total - 1));
        const safeSem = Math.max(1, Math.min(Number(lastSemana) || 1, SEMANAS_MAX));
        currentSemana = safeSem;
        currentDiaIdx = safeDia;
        setSemana(safeSem);
        setDiaIdx(safeDia);
      } else {
        setSemana(1);
        setDiaIdx(0);
      }
    } catch { }

    // Cargar workouts/progreso de la nube
    if (token && user?.tipoUsuario !== 'FREEUSER' && mongoRoutineId) {
      // 🆕 Cargar TODOS los workouts de la rutina de una vez
      const cloudData = await fetchAllCloudProgress(mongoRoutineId, diasNorm);

      if (cloudData) {
        const { cloudProg, cloudNotes } = cloudData;

        if (cloudProg && Object.keys(cloudProg).length > 0) {
          // Fusionar: priorizar datos de la nube sobre locales
          setProg(prev => ({ ...prev, ...cloudProg }));
          console.log('[Entreno] ☁️ Datos recuperados y fusionados de la nube');
        }

        // 📝 Cargar notas desde la nube
        if (cloudNotes && Object.keys(cloudNotes).length > 0) {
          setNotes(prev => ({ ...prev, ...cloudNotes }));
          console.log('[Entreno] 📝 Notas recuperadas de la nube');
        }
      }
    }

    setHydrated(true);
  }, [token, user?.tipoUsuario, fetchAllCloudProgress]);


  // Verificar si es primera vez (mostrar tutorial)
  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const hasSeenTutorial = await AsyncStorage.getItem('has_seen_tutorial');
        if (!hasSeenTutorial && hydrated && rutina) {
          setShowTutorial(true);
        }
      } catch (e) {
        console.warn('Error checking tutorial status', e);
      }
    };
    checkFirstTime();
  }, [hydrated, rutina]);

  // ⚡ Guardar progreso pendiente cuando la app va a background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Usar ref para evitar problemas de orden de definición
        flushProgressRef.current?.();
      }
    });

    return () => {
      subscription?.remove();
      // Limpiar timeout pendiente al desmontar
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const completeTutorial = async () => {
    try {
      await AsyncStorage.setItem('has_seen_tutorial', 'true');
      setShowTutorial(false);
    } catch (e) {
      console.warn('Error saving tutorial status', e);
    }
  };

  // Al montar
  useEffect(() => {
    fetchAllExercises(); // 🆕 Fetch exercises from MongoDB
    hydrate();
  }, [hydrate, fetchAllExercises])

  // Cada vez que la pantalla vuelve a foco
  useFocusEffect(
    useCallback(() => {
      hydrate();

      // Detectar si hay un video pendiente guardado desde preview
      const checkPendingVideo = async () => {
        try {
          const pendingData = await AsyncStorage.getItem('pending_video_feedback');
          if (pendingData) {
            const data = JSON.parse(pendingData);
            // Limpiar el pending
            await AsyncStorage.removeItem('pending_video_feedback');

            // Abrir el modal con el video ya cargado
            const existingNote = notes[data.serieKey] || {};
            setNotesModal({
              visible: true,
              serieKey: data.serieKey,
              exerciseId: data.exerciseId,
              exerciseName: data.exerciseName,
              value: existingNote.value || 'low',
              note: existingNote.note || '',
              audioUri: existingNote.audioUri || null,
              mediaUri: data.videoPath,
              mediaType: 'video',
              trimStart: data.trimStart,
              trimEnd: data.trimEnd,
            });
            return;
          }

          // Detectar si hay una foto pendiente
          const pendingPhoto = await AsyncStorage.getItem('pending_photo_feedback');
          if (pendingPhoto) {
            const data = JSON.parse(pendingPhoto);
            await AsyncStorage.removeItem('pending_photo_feedback');

            const existingNote = notes[data.serieKey] || {};
            setNotesModal({
              visible: true,
              serieKey: data.serieKey,
              exerciseId: data.exerciseId,
              exerciseName: data.exerciseName,
              value: existingNote.value || 'low',
              note: existingNote.note || '',
              audioUri: existingNote.audioUri || null,
              mediaUri: data.photoUri,
              mediaType: 'photo',
            });
          }
        } catch (err) {
          console.error('[Entreno] Error checking pending media:', err);
        }
      };
      checkPendingVideo();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hydrate]) // 🔧 FIX: Removed 'notes' to prevent infinite loop (hydrate updates notes)
  );

  // Re-clamp cuando cambie el nº de días y persistir la posición (ya hidratados)
  const totalDias = useMemo(() => {
    const metaDias = Number(rutina?.dias);
    if (Number.isFinite(metaDias) && metaDias > 0) return metaDias;
    return Array.isArray(diasEj) ? Math.max(1, diasEj.length) : 1;
  }, [rutina, diasEj]);

  // 🚀 OPTIMIZACIÓN: Pre-calcular detalles de ejercicios para evitar lookups en cada render
  const exerciseDetailsMap = useMemo(() => {
    const map = new Map();
    const ejercicios = (diasEj[diaIdx] || []).filter(Boolean);
    for (const ej of ejercicios) {
      const details = findExerciseInIndex(ej.musculo, ej.nombre);
      map.set(ej.id, {
        hasImage: !!details?.imagenEjercicioId?.trim(),
        hasVideo: !!details?.videoId?.trim(),
        details
      });
    }
    return map;
  }, [diasEj, diaIdx, findExerciseInIndex]);

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

  // 🚪 Interceptar navegación cuando hay cambios sin guardar
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Si no hay cambios sin guardar, permitir la navegación
      if (!hasUnsavedChanges) return;

      // Prevenir la navegación por defecto
      e.preventDefault();

      // Guardar la acción de navegación pendiente
      pendingNavigationRef.current = e.data.action;

      // Mostrar el modal de confirmación
      setShowExitModal(true);
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges]);

  // 🌐 Protección adicional para WEB: cierre de pestaña y botón retroceso del navegador
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Manejar cierre de pestaña / recarga de página
    const handleBeforeUnload = (e) => {
      if (!hasUnsavedChanges) return;

      // Mostrar el diálogo nativo del navegador
      e.preventDefault();
      e.returnValue = '¿Seguro que quieres salir? Tienes cambios sin guardar.';
      return e.returnValue;
    };

    // Manejar el botón de retroceso del navegador
    const handlePopState = (e) => {
      if (!hasUnsavedChanges) return;

      // Agregar una entrada al historial para poder interceptar de nuevo
      window.history.pushState(null, '', window.location.href);

      // Mostrar nuestro modal personalizado
      setShowExitModal(true);
    };

    // Agregar entrada inicial al historial para poder interceptar el retroceso
    if (hasUnsavedChanges) {
      window.history.pushState(null, '', window.location.href);
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasUnsavedChanges]);

  /* ───────── Cambio de estado SIN guardado inmediato ───────── */
  const setEstadoEjLocal = useCallback((clave, val) => {
    // Solo cambio local del estado, NO guardamos en AsyncStorage aquí
    const nextVal = val === 'OJ' ? 'OE' : val;
    setProg((prev) => ({ ...prev, [clave]: nextVal }));
    // 🚪 Marcar que hay cambios sin guardar
    setHasUnsavedChanges(true);
  }, []);

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

      // VERIFICAR SI ES USUARIO FREE - Solo usuarios premium guardan en la nube
      const isFreeUser = user?.tipoUsuario === 'FREEUSER';

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
                routineId: activeId || null,
                routineName: rutina?.nombre || 'Rutina Desconocida',
                dayIndex: diaIdx, // 🆕 Para separar por días
                dayLabel: rutina?.dias?.[diaIdx]?.nombre || `Día ${diaIdx + 1}`, // 🆕 Nombre del día
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
          // Sin estado explícito (C/NC/OE) - determinar automáticamente
          ejerciciosSinEstado++;

          // 🆕 Verificar si el usuario rellenó algún dato en las series
          const seriesDelEjercicio = ejercicio.series || [];
          const tieneData = seriesDelEjercicio.some((_, idx) => {
            const serieKey = `${ejerKey}|${idx}`;
            const datosSerie = nextProg[serieKey] || {};
            return (Number(datosSerie.reps) > 0 || Number(datosSerie.peso) > 0);
          });

          // Si rellenó datos → Completado (C), si no → No Completado (NC)
          nextProg[ejerKey] = tieneData ? 'C' : 'NC';
        }

        ejerciciosProcesados++;
      }

      // 🔥 GUARDAR EN LA BASE DE DATOS A TRAVÉS DE LA API
      // 🏆 Flag para saber si el workout ya existía (para no contar logros duplicados)
      let wasUpdated = false;
      let savedWorkoutId = null; // 🆕 Para pasar al modal de RPE

      try {
        // Construir los ejercicios para la API con el esquema del modelo Workout
        const exercisesForAPI = ejerciciosDia.map((ejercicio, orderIndex) => {
          const ejerKey = `${semana}|${diaIdx}|${ejercicio.id}`;
          // Construir las series - solo incluir campos con valores válidos
          const sets = (ejercicio.series || []).map((serie, idx) => {
            const serieKey = `${ejerKey}|${idx}`;
            const datosSerie = nextProg[serieKey] || {};
            // Construir objeto solo con campos que tienen valores válidos
            const set = {
              setNumber: idx + 1,
              status: 'inRange'
            };
            // Solo añadir campos numéricos si tienen valores válidos
            const targetMin = Number(serie?.repMin);
            const targetMax = Number(serie?.repMax);
            const reps = Number(datosSerie.reps);
            const peso = Number(datosSerie.peso);
            if (!isNaN(targetMin) && targetMin > 0) set.targetRepsMin = targetMin;
            if (!isNaN(targetMax) && targetMax > 0) set.targetRepsMax = targetMax;
            if (!isNaN(reps) && reps > 0) set.actualReps = reps;
            if (!isNaN(peso) && peso > 0) set.weight = peso;

            // 📝 Añadir notas si existen
            const serieNote = notes[serieKey];
            if (serieNote && (serieNote.value || serieNote.note)) {
              set.notes = {
                value: serieNote.value || null,
                note: serieNote.note || ''
              };
            }

            return set;
          });
          // 🆕 Incluir el estado del ejercicio (C, NC, OE)
          const exerciseStatus = nextProg[ejerKey] || 'NC';
          return {
            exerciseId: null,
            exerciseName: ejercicio.nombre,
            muscleGroup: ejercicio.musculo,
            orderIndex: orderIndex,
            status: exerciseStatus, // 🆕 Estado guardado por ejercicio
            sets: sets
          };
        });
        // Calcular totalSets y totalVolume
        let totalSets = 0;
        let totalVolume = 0;
        exercisesForAPI.forEach(exercise => {
          totalSets += exercise.sets.length;
          exercise.sets.forEach(set => {
            if (set.actualReps && set.weight) {
              totalVolume += set.actualReps * set.weight;
            }
          });
        });
        // Preparar payload para el API
        // Función para extraer ObjectId de MongoDB (soporta prefijo srv_)
        const extractMongoId = (id) => {
          if (!id) return null;
          if (/^[0-9a-fA-F]{24}$/.test(id)) return id;
          if (id.startsWith('srv_')) {
            const mongoId = id.replace('srv_', '');
            if (/^[0-9a-fA-F]{24}$/.test(mongoId)) return mongoId;
          }
          return null;
        };

        // 🆕 Para rutinas de entrenador, usar sourceRoutineId (referencia a Routine)
        // Para otras rutinas, usar activeId directamente
        const routineIdForWorkout = rutina?.isFromCoach && rutina?.sourceRoutineId
          ? extractMongoId(rutina.sourceRoutineId)
          : extractMongoId(activeId);

        const workoutPayload = {
          routineId: routineIdForWorkout,
          trainerId: rutina?.trainerId || null, // 🆕 Agregar trainerId de la rutina
          routineNameSnapshot: rutina?.nombre || 'Rut Desconocida',
          dayIndex: diaIdx + 1,
          dayLabel: rutina?.dias?.[diaIdx]?.nombre || `Día ${diaIdx + 1}`,
          week: semana,
          date: now,
          status: 'completed',
          exercises: exercisesForAPI,
          totalSets: totalSets,
          totalVolume: totalVolume,
          durationMinutes: 0,
          // 🆕 Agregar referencia a CurrentRoutine para trazabilidad
          currentRoutineId: rutina?.isFromCoach ? activeId : null
        };

        // 🔍 DEBUG: Log para diagnosticar el guardado
        console.log('[Entreno] 📤 Guardando workout:', {
          activeId,
          routineIdForWorkout,
          sourceRoutineId: rutina?.sourceRoutineId,
          isFromCoach: rutina?.isFromCoach,
          trainerId: workoutPayload.trainerId,
          isFreeUser,
          tipoUsuario: user?.tipoUsuario,
          hasToken: !!token,
          hasApiUrl: !!API_URL
        });



        if (API_URL && token && !isFreeUser) {
          const response = await fetch(`${API_URL}/api/workouts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(workoutPayload)
          });

          if (response.ok) {
            const result = await response.json();
            wasUpdated = result.updated === true;
            // 🆕 Capturar workoutId para el modal RPE
            savedWorkoutId = result.workout?._id || null;
            console.log(wasUpdated ? '✅ Workout actualizado:' : '✅ Workout creado:', savedWorkoutId);
          } else {
            const errorData = await response.json();
            console.error('❌ Error al guardar en la API:', errorData);
          }
        }
      } catch (apiError) {
        // No interrumpir el flujo si falla la API, solo loguear
        console.error('❌ Error en la llamada a la API:', apiError);
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

      // 🏆 PROCESAR LOGROS - Estilo Steam
      // Solo contar logros si es un workout NUEVO (no actualización de uno existente)
      // Para usuarios PREMIUM: usamos wasUpdated del API
      // Para usuarios FREE: usamos un sistema local de tracking

      let shouldProcessAchievements = !wasUpdated;

      // Para usuarios FREE, verificar si ya se procesaron logros para este workout localmente
      if (isFreeUser) {
        const workoutKey = `${activeId || 'local'}_${semana}_${diaIdx}`;
        const processedKey = 'totalgains_processed_workouts';

        try {
          const processedJson = await AsyncStorage.getItem(processedKey);
          const processedSet = processedJson ? new Set(JSON.parse(processedJson)) : new Set();

          if (processedSet.has(workoutKey)) {
            shouldProcessAchievements = false;
            console.log('⏭️ Usuario FREE: workout ya procesado localmente:', workoutKey);
          } else {
            // Marcar como procesado para futuras ejecuciones
            processedSet.add(workoutKey);
            await AsyncStorage.setItem(processedKey, JSON.stringify([...processedSet]));
            console.log('📝 Usuario FREE: workout marcado como procesado:', workoutKey);
          }
        } catch (e) {
          console.warn('Error verificando workouts procesados:', e);
        }
      }

      if (shouldProcessAchievements) {
        // Extraer grupos musculares únicos del día
        const muscleGroupsWorked = [...new Set(
          ejerciciosDia.map(ej => ej.musculo).filter(Boolean)
        )];

        processWorkoutCompletion({
          totalVolumeKg: currentStats.volume || 0,
          totalReps: currentStats.totalReps || 0,
          muscleGroups: muscleGroupsWorked,
          durationMinutes: 0, // TODO: integrar cronómetro si disponible
        });
        console.log('🏆 Logros procesados (workout nuevo)');
      } else {
        console.log('⏭️ Logros NO procesados (workout ya existía, solo actualización)');
      }

      // 🚪 Marcar que ya no hay cambios sin guardar
      setHasUnsavedChanges(false);

      setStatsModal({
        visible: true,
        workoutId: savedWorkoutId,
        stats: {
          current: currentStats,
          previous: previousStats,
          bestImprovement,
        },
      });

      // Mostrar aviso para usuarios FREE después del modal de estadísticas
      if (isFreeUser) {
        setTimeout(() => {
          if (Platform.OS === 'web') {
            const goToPremium = window.confirm('⚠️ PROGRESO GUARDADO LOCALMENTE\n\nComo usuario gratuito, tu progreso se ha guardado solo en tu dispositivo. Para sincronizar en la nube y acceder desde cualquier lugar, mejora a Premium.\n\n¿Quieres mejorar a Premium ahora?');
            if (goToPremium) {
              window.location.href = '../payment';
            }
          } else {
            Alert.alert(
              '⚠️ Progreso Guardado Localmente',
              'Como usuario gratuito, tu progreso se ha guardado solo en tu dispositivo. Para sincronizar en la nube y acceder desde cualquier lugar, mejora a Premium.',
              [
                { text: 'Ahora no', style: 'cancel' },
                { text: 'Mejorar a Premium', style: 'default', onPress: () => navigation.navigate('payment') }
              ]
            );
          }
        }, 500); // Delay para que el modal de stats se muestre primero
      }

    } catch (e) {
      console.error('Error al guardar el día:', e);
      Alert.alert('Error', 'No se pudo guardar el día completo. Por favor, intenta de nuevo.');
    }
  };

  // ⚡ Flush: guarda inmediatamente el progreso pendiente (llamar en onBlur, background, etc.)
  const flushProgress = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const pendingData = pendingProgRef.current;
    if (!pendingData) return;

    pendingProgRef.current = null;

    try {
      if (activeId) {
        const sessionData = JSON.stringify({
          lastSemana: semana,
          lastDiaIdx: diaIdx,
          updatedAt: Date.now(),
        });
        await AsyncStorage.multiSet([
          ['progress', JSON.stringify(pendingData)],
          [sessionKeyFor(activeId), sessionData],
        ]);
      } else {
        await AsyncStorage.setItem('progress', JSON.stringify(pendingData));
      }
    } catch (e) {
      console.warn('No se pudo guardar el progreso:', e);
    }
  }, [activeId, semana, diaIdx]);

  // Asignar a ref para que AppState listener pueda acceder
  flushProgressRef.current = flushProgress;

  const setSerieDato = useCallback((serieKey, campo, val, ejercicio = null, totalSeries = 0) => {
    // Convertir coma a punto para compatibilidad con separador decimal europeo
    const normalizedVal = typeof val === 'string' ? val.replace(/,/g, '.') : val;

    // ⚡ Actualización funcional del estado (UI instantánea)
    setProg(prevProg => {
      const nextProg = {
        ...prevProg,
        [serieKey]: { ...(prevProg[serieKey] || {}), [campo]: normalizedVal },
      };
      // Guardar referencia para el debounce
      pendingProgRef.current = nextProg;

      // 🆕 Auto-marcar como Completado si todas las series están rellenas
      if (ejercicio && totalSeries > 0) {
        // Extraer el ejerKey del serieKey (quitar el último |idx)
        const ejerKey = serieKey.split('|').slice(0, 3).join('|');

        // Verificar si TODAS las series tienen reps Y peso
        let allComplete = true;
        for (let i = 0; i < totalSeries; i++) {
          const sKey = `${ejerKey}|${i}`;
          const serieData = nextProg[sKey] || {};
          const hasReps = serieData.reps && String(serieData.reps).trim() !== '';
          const hasPeso = serieData.peso && String(serieData.peso).trim() !== '';
          if (!hasReps || !hasPeso) {
            allComplete = false;
            break;
          }
        }

        // Si todas las series están completas, marcar como 'C'
        if (allComplete && nextProg[ejerKey] !== 'C') {
          nextProg[ejerKey] = 'C';
        }
      }

      return nextProg;
    });

    // 🚪 Marcar que hay cambios sin guardar
    setHasUnsavedChanges(true);

    // ⚡ Debounce: cancelar guardado anterior y programar nuevo
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const dataToSave = pendingProgRef.current;
      if (!dataToSave) return;

      pendingProgRef.current = null;
      saveTimeoutRef.current = null;

      try {
        if (activeId) {
          const sessionData = JSON.stringify({
            lastSemana: semana,
            lastDiaIdx: diaIdx,
            updatedAt: Date.now(),
          });
          await AsyncStorage.multiSet([
            ['progress', JSON.stringify(dataToSave)],
            [sessionKeyFor(activeId), sessionData],
          ]);
        } else {
          await AsyncStorage.setItem('progress', JSON.stringify(dataToSave));
        }
      } catch (e) {
        console.warn('No se pudo guardar el dato de serie:', e);
      }
    }, DEBOUNCE_SAVE_MS);
  }, [activeId, semana, diaIdx]);

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
    } catch { }
  };

  // Abrir Técnica Correcta (TC)
  const onOpenTC = useCallback((item) => {
    const ej = findExerciseInIndex(item.musculo, item.nombre);
    if (!ej || !Array.isArray(ej.tecnicaCorrecta) || ej.tecnicaCorrecta.length === 0) {
      Alert.alert('Técnica no disponible', 'No hay técnica registrada para este ejercicio.');
      return;
    }
    setTechModal({ visible: true, title: item.nombre, tips: ej.tecnicaCorrecta });
  }, [findExerciseInIndex]);

  // Abrir Imagen del ejercicio
  const onOpenImage = useCallback((item) => {
    const ej = findExerciseInIndex(item.musculo, item.nombre);
    const url = ej?.imagenEjercicioId?.trim() || null;
    setImageModal({ visible: true, imageUrl: url, title: item.nombre });
  }, [findExerciseInIndex]);

  // Abrir Vídeo
  const onOpenVideo = useCallback((item) => {
    if (user?.tipoUsuario === 'FREEUSER') {
      setShowUpgradeModal(true);
      return;
    }

    const ej = findExerciseInIndex(item.musculo, item.nombre);
    const id = ej?.videoId?.trim() || null;
    setVideoModal({ visible: true, videoId: id, playing: !!id, title: item.nombre });
  }, [findExerciseInIndex, user?.tipoUsuario]);

  const handleInputFocus = useCallback((index) => {
    try {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.3,
      });
    } catch { }
  }, []);

  const goToPayment = () => {
    setShowUpgradeModal(false);
    navigation.navigate('payment');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{rutina.nombre}</Text>
          </View>

          <View style={styles.headerCenter}>
            <Stopwatch />
          </View>

          <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: theme.primary }]}
              onPress={exportWeekToExcel}
              activeOpacity={0.85}
            >
              <Ionicons name="download-outline" size={16} color={getContrastColor(theme.primary)} />
              <Text style={[styles.exportTxt, { color: getContrastColor(theme.primary) }]}>Excel S</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Selector Colapsable de Semana/Día */}
        <CollapsibleWeekDaySelector
          semana={semana}
          diaIdx={diaIdx}
          totalDias={totalDias}
          onSemanaChange={(w) => {
            setSemana(w);
            if (hydrated) saveLastSession(w, diaIdx);
          }}
          onDiaChange={(d) => {
            setDiaIdx(d);
            if (hydrated) saveLastSession(semana, d);
          }}
        />

        <FlatList
          ref={listRef}
          contentContainerStyle={{ paddingBottom: 300 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          style={{ marginTop: 12 }}
          data={ejerciciosDia}
          keyExtractor={(it, i) => (it?.id ? String(it.id) : `idx-${i}`)}
          renderItem={({ item, index }) => (
            <ExerciseCard
              item={item}
              index={index}
              prog={prog}
              notes={notes}
              semana={semana}
              diaIdx={diaIdx}
              openId={openId}
              setOpenId={setOpenId}
              setEstadoEjLocal={setEstadoEjLocal}
              setSerieDato={setSerieDato}
              onOpenTC={onOpenTC}
              onOpenImage={onOpenImage}
              onOpenVideo={onOpenVideo}
              exerciseDetailsMap={exerciseDetailsMap}
              theme={theme}
              handleInputFocus={handleInputFocus}
              flushProgress={flushProgress}
              setNotesModal={setNotesModal}
              showBiserieConnector={(() => {
                if (!item) return false;
                const isBiserie = (ej) => {
                  if (!ej?.series || !Array.isArray(ej.series)) return false;
                  return ej.series.some(serie => {
                    const extra = String(serie?.extra || '').toLowerCase().trim();
                    return extra === 'biserie' || extra === 'biseries' || extra === 'bs';
                  });
                };
                const currentIsBiserie = isBiserie(item);
                const nextItem = ejerciciosDia[index + 1];
                const nextIsBiserie = isBiserie(nextItem);
                return currentIsBiserie && nextIsBiserie;
              })()}
            />
          )}
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
      </View >

      {/* 🔥 Modal de Estadísticas ÉPICO */}
      <StatsModal
        visible={statsModal.visible}
        onClose={() => {
          setStatsModal({ visible: false, stats: null, workoutId: null });
          // 🏠 Navegar al Home al finalizar el entrenamiento
          navigation.navigate('home');
        }}
        stats={statsModal.stats}
        workoutId={statsModal.workoutId}
        onRPESubmit={async (workoutId, sessionRPE, sessionNote) => {
          // 🆕 PATCH para actualizar solo RPE/nota sin tocar el workout
          if (!workoutId || !API_URL || !token) return;
          try {
            const res = await fetch(`${API_URL}/api/workouts/${workoutId}/feedback`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ sessionRPE, sessionNote })
            });
            if (res.ok) {
              console.log('✅ Feedback RPE guardado');
            } else {
              console.error('❌ Error guardando feedback RPE');
            }
          } catch (e) {
            console.error('❌ Error en PATCH feedback:', e);
          }
        }}
      />

      {/* 📝 Modal Unificado de Feedback */}
      <UnifiedFeedbackModal
        visible={notesModal.visible}
        onClose={() => setNotesModal(s => ({ ...s, visible: false }))}
        serieKey={notesModal.serieKey}
        exerciseId={notesModal.exerciseId}
        exerciseName={notesModal.exerciseName}
        initialValue={notesModal.value}
        initialNote={notesModal.note}
        initialAudioUri={notesModal.audioUri}
        initialMediaUri={notesModal.mediaUri}
        initialMediaType={notesModal.mediaType}
        theme={theme}
        onSave={async (serieKey, value, noteText, audioUri, mediaUri, mediaType, trimStart, trimEnd) => {
          if (!serieKey) return;

          if (value === null && noteText === null && audioUri === null && mediaUri === null) {
            // Delete feedback
            setNotes(prev => {
              const copy = { ...prev };
              delete copy[serieKey];
              return copy;
            });
          } else {
            // Save feedback immediately (local first)
            setNotes(prev => ({
              ...prev,
              [serieKey]: {
                value,
                note: noteText,
                audioUri,
                mediaUri,
                mediaType,
                trimStart,
                trimEnd,
                uploadStatus: mediaUri ? 'pending' : null
              }
            }));
          }

          // 📹 Subir media a R2 en background si existe
          if ((mediaUri || audioUri) && token && API_URL) {
            console.log('[Entreno] 📤 Iniciando subida de media/audio a R2:', mediaType, audioUri ? '+audio' : '');

            try {
              let uploadResult;

              if (mediaUri && mediaType === 'video') {
                uploadResult = await uploadVideoFeedback({
                  videoUri: mediaUri,
                  exerciseId: notesModal.exerciseId,
                  exerciseName: notesModal.exerciseName,
                  serieKey,
                  athleteNote: noteText,
                  duration: 0, // Will be calculated on backend
                  thumbnailUri: null,
                  trimStart,
                  trimEnd
                });
              } else if (mediaUri && mediaType === 'photo') {
                uploadResult = await uploadPhotoFeedback({
                  photoUri: mediaUri,
                  exerciseId: notesModal.exerciseId,
                  exerciseName: notesModal.exerciseName,
                  serieKey,
                  athleteNote: noteText
                });
              }

              // 🆕 Subir AUDIO independientemente (puede ser solo audio o audio + media)
              if (audioUri && !audioUri.startsWith('http')) { // Solo si es local
                console.log('[Entreno] 📤 Iniciando subida de AUDIO a R2');
                const audioUploadResult = await uploadAudioFeedback({
                  audioUri: audioUri,
                  exerciseId: notesModal.exerciseId,
                  exerciseName: notesModal.exerciseName,
                  serieKey,
                  athleteNote: noteText
                });

                if (audioUploadResult?.success) {
                  console.log('[Entreno] ✅ Audio subido correctamente');
                  // Si no había uploadResult (solo audio), usamos este resultado
                  if (!uploadResult) uploadResult = audioUploadResult;
                } else {
                  console.error('[Entreno] ❌ Error subiendo audio:', audioUploadResult?.error);
                }
              }

              if (uploadResult?.success) {
                console.log('[Entreno] ✅ Media subida exitosamente a R2');
                // Actualizar el estado con la URL de R2
                setNotes(prev => ({
                  ...prev,
                  [serieKey]: {
                    ...prev[serieKey],
                    uploadStatus: 'completed',
                    r2FeedbackId: uploadResult.feedback?.feedbackId || uploadResult.feedback?._id
                  }
                }));
              } else if (audioUri || mediaUri) {
                console.error('[Entreno] ❌ Error subiendo media:', uploadResult?.error);
                setNotes(prev => ({
                  ...prev,
                  [serieKey]: {
                    ...prev[serieKey],
                    uploadStatus: 'failed',
                    uploadError: uploadResult?.error
                  }
                }));
              }
            } catch (uploadErr) {
              console.error('[Entreno] ❌ Error en subida a R2:', uploadErr);
              setNotes(prev => ({
                ...prev,
                [serieKey]: {
                  ...prev[serieKey],
                  uploadStatus: 'failed',
                  uploadError: uploadErr.message
                }
              }));
            }
          }

          // Persist locally
          const notesKey = `workout_notes_${activeId}`;
          try {
            const updatedNotes = value === null
              ? (() => { const copy = { ...notes }; delete copy[serieKey]; return copy; })()
              : { ...notes, [serieKey]: { value, note: noteText, audioUri, mediaUri, mediaType } };

            await AsyncStorage.setItem(notesKey, JSON.stringify(updatedNotes));
          } catch (e) {
            console.error('Error saving feedback:', e);
          }
        }}
      />

      {/* 🚪 Modal de Confirmación de Salida */}
      <Modal
        visible={showExitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={exitModalStyles.overlay}>
          <View style={[exitModalStyles.card, {
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border
          }]}>
            {/* Icono de advertencia */}
            <View style={exitModalStyles.iconContainer}>
              <Ionicons name="warning" size={48} color="#f59e0b" />
            </View>

            {/* Título */}
            <Text style={[exitModalStyles.title, { color: theme.text }]}>
              ¿Salir sin guardar?
            </Text>

            {/* Descripción */}
            <Text style={[exitModalStyles.description, { color: theme.textSecondary }]}>
              Tienes cambios sin guardar en tu entrenamiento. Si sales ahora, perderás el progreso de este día.
            </Text>

            {/* Botones */}
            <View style={exitModalStyles.buttonRow}>
              <TouchableOpacity
                style={[exitModalStyles.cancelBtn, { borderColor: theme.border }]}
                onPress={() => setShowExitModal(false)}
                activeOpacity={0.8}
              >
                <Text style={[exitModalStyles.cancelText, { color: theme.text }]}>
                  Continuar Editando
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[exitModalStyles.exitBtn, { backgroundColor: '#ef4444' }]}
                onPress={() => {
                  setShowExitModal(false);
                  setHasUnsavedChanges(false);
                  // Ejecutar la navegación pendiente (para React Navigation)
                  if (pendingNavigationRef.current) {
                    navigation.dispatch(pendingNavigationRef.current);
                    pendingNavigationRef.current = null;
                  } else if (Platform.OS === 'web') {
                    // Para el botón de retroceso del navegador, ir atrás en el historial
                    window.history.back();
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="exit-outline" size={18} color="#fff" />
                <Text style={exitModalStyles.exitText}>Salir</Text>
              </TouchableOpacity>
            </View>

            {/* Sugerencia de guardar */}
            <TouchableOpacity
              style={[exitModalStyles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={async () => {
                setShowExitModal(false);
                await saveAllDayData();
                // Navegar después de guardar exitosamente
                if (pendingNavigationRef.current) {
                  navigation.dispatch(pendingNavigationRef.current);
                  pendingNavigationRef.current = null;
                } else if (Platform.OS === 'web') {
                  // Para el botón de retroceso del navegador
                  window.history.back();
                }
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="save" size={18} color="#fff" />
              <Text style={exitModalStyles.saveText}>Guardar y Salir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            <View style={styles.imageModalHeader}>
              <Text style={[styles.imageModalTitle, { color: theme.text }]} numberOfLines={2}>
                {videoModal.title}
              </Text>
              <Pressable
                onPress={() =>
                  setVideoModal((s) => ({ ...s, visible: false, playing: false }))
                }
                style={styles.modalClose}
              >
                <Ionicons name="close-outline" size={24} color={theme.text} />
              </Pressable>
            </View>
            {videoModal.videoId ? (() => {
              const screenWidth = Dimensions.get('window').width;
              // En pantallas pequeñas (<600px) usar 90%, en grandes usar 50% con max 500px
              const videoWidth = screenWidth < 600
                ? screenWidth * 0.85
                : Math.min(screenWidth * 0.5, 500);
              const videoHeight = videoWidth * 9 / 16;

              // En web usamos iframe HTML nativo, en móvil usamos YoutubeIframe
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
                      setVideoModal((s) => ({ ...s, playing: false, visible: false }));
                    }
                  }}
                />
              );
            })() : (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Ionicons name="videocam-off-outline" size={48} color={theme.textSecondary} />
                <Text style={{ color: theme.textSecondary, marginTop: 12, fontSize: 16, textAlign: 'center' }}>
                  Vídeo no disponible
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Imagen del Ejercicio */}
      <Modal
        visible={imageModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModal({ visible: false, imageUrl: null, title: '' })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.imageModalCard, {
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border
          }]}>
            <View style={styles.imageModalHeader}>
              <Text style={[styles.imageModalTitle, { color: theme.text }]} numberOfLines={2}>
                {imageModal.title}
              </Text>
              <Pressable
                onPress={() => setImageModal({ visible: false, imageUrl: null, title: '' })}
                style={styles.modalClose}
              >
                <Ionicons name="close-outline" size={24} color={theme.text} />
              </Pressable>
            </View>
            {imageModal.imageUrl ? (
              <Image
                source={{ uri: imageModal.imageUrl }}
                style={styles.exerciseImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ color: theme.textSecondary, textAlign: 'center', padding: 20 }}>
                Imagen no disponible
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Upgrade */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showUpgradeModal}
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.upgradeModalOverlay}>
          <View style={styles.upgradeModalContent}>
            <Pressable onPress={() => setShowUpgradeModal(false)} style={styles.upgradeModalClose}>
              <Ionicons name="close-circle" size={32} color="#9CA3AF" />
            </Pressable>
            <Ionicons name="lock-closed" size={64} color="#10B981" style={{ marginBottom: 20 }} />
            <Text style={styles.upgradeModalTitle}>Sube de Nivel</Text>
            <Text style={styles.upgradeModalText}>
              Para ver esto sube de nivel
            </Text>
            <Pressable style={styles.upgradeButton} onPress={goToPayment}>
              <Ionicons name="add-circle" size={24} color="#FFF" />
              <Text style={styles.upgradeButtonText}>Ver Planes</Text>
            </Pressable>
            <Pressable style={styles.upgradeCancelButton} onPress={() => setShowUpgradeModal(false)}>
              <Text style={styles.upgradeCancelText}>Tal vez más tarde</Text>
            </Pressable>
          </View>
        </View>
      </Modal>


      {/* 🎓 Tutorial Modal (Primera Vez) */}
      <TutorialModal
        visible={showTutorial}
        onComplete={completeTutorial}
      />
    </KeyboardAvoidingView>
  );
}

/* ───────── styles ───────── */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, zIndex: 10 },
  headerSide: { flex: 1 },
  headerCenter: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: 'bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  cardTxt: { flex: 1, fontSize: 14, fontWeight: '600' },

  stateToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 8,
    gap: 8,
  },
  stateRow: { flexDirection: 'row', gap: 4, flexShrink: 1, flexWrap: 'nowrap' },
  toolsRow: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexShrink: 0,
  },

  radio: { borderWidth: 1, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, minWidth: 28 },
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
  inputCol: { width: 55, alignItems: 'center', marginRight: 20 },

  inputWithTrend: {
    position: 'relative',
    width: 75,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginRight: 0,
    flexShrink: 0,
  },
  trendIcon: {
    position: 'absolute',
    right: 2,
    top: '50%',
    transform: [{ translateY: -7 }],
  },
  serieInput: {
    width: 50,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 12,
    textAlign: 'center',
  },

  extraTxt: { fontSize: 11, fontWeight: '600', marginRight: 4 },
  sp: { marginLeft: 4, fontSize: 11, fontWeight: '700', flexShrink: 0 },
  noteBtn: {
    marginLeft: 'auto',
    padding: 6,
    borderRadius: 8,
  },
  // Grupo combinado de acciones (cámara + notas)
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 2,
    backgroundColor: 'rgba(67, 97, 238, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  actionBtn: {
    padding: 5,
    borderRadius: 6,
  },
  noteDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

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
    padding: 0
  },

  // 🔥 Estilos del Modal de Estadísticas ÉPICO 🔥
  statsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    maxHeight: Dimensions.get('window').height,

  },
  statsModalCard: {
    width: Platform.select({ web: '90%', default: '95%' }),
    minHeight: Platform.select({ web: Dimensions.get('window').height * 0.8, default: '80%' }),
    maxHeight: Platform.select({ web: Dimensions.get('window').height * 0.85, default: '92%' }),
    maxWidth: Platform.select({ web: 480, default: 500 }),
    borderRadius: Platform.select({ web: 20, default: 24 }),
    paddingHorizontal: Platform.select({ web: 20, default: 16 }),
    paddingVertical: Platform.select({ web: 16, default: 12 }),
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
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
  },
  statsScrollContent: {
    paddingBottom: 80,
  },
  statsHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  statsHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ web: 16, default: 12 }),
    marginBottom: Platform.select({ web: 12, default: 8 }),
    paddingHorizontal: Platform.select({ web: 12, default: 8 }),
  },
  statsHeaderText: {
    flex: 1,
  },
  statsTitleCompact: {
    fontSize: Platform.select({ web: 26, default: 22 }),
    fontWeight: '800',
  },
  statsSubtitleCompact: {
    fontSize: Platform.select({ web: 16, default: 14 }),
    fontWeight: '600',
  },
  rpeFeedbackSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 12,
    paddingVertical: 4,
  },
  motivationalSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  dumbbellContainer: {
    padding: 16,
  },
  statsSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionTitleCompact: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  statsRowHorizontal: {
    flexDirection: 'row',
    gap: 8,
  },
  statCardCompact: {
    flex: 1,
    padding: Platform.select({ web: 14, default: 10 }),
    borderRadius: Platform.select({ web: 16, default: 12 }),
    borderWidth: 1,
  },
  statHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statTitleCompact: {
    fontSize: 13,
    fontWeight: '600',
  },
  statDiffCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDiffTextCompact: {
    fontSize: 12,
    fontWeight: '600',
  },
  statCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
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
    marginBottom: 2,
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
    marginBottom: 2,
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
    marginBottom: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  bestImprovementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
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
    marginTop: 2,
    marginBottom: 50,
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

  // Modal Imagen del Ejercicio
  imageModalCard: {
    width: '94%',
    maxWidth: 500,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  imageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    paddingRight: 30,
  },
  imageModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  exerciseImage: {
    width: '100%',
    height: 300,
    borderRadius: 10,
  },

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
  upgradeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  upgradeModalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  upgradeModalClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  upgradeModalTitle: {
    color: '#E5E7EB',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  upgradeModalText: {
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,

  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginBottom: 15,
    gap: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  upgradeButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  upgradeCancelButton: {
    paddingVertical: 10,
  },
  upgradeCancelText: {
    color: '#6B7280',
    fontSize: 14,
  },

  // ═══════════════ BISERIES ═══════════════
  biserieBadge: {
    position: 'absolute',
    top: -6,
    right: 14,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    zIndex: 10,
  },
  biserieBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  biserieConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    marginHorizontal: 20,
    zIndex: 10,
    top: -6,
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
  // Espaciadores reutilizables
  spacer8: {
    height: 8,
  },
  spacer10: {
    height: 10,
  },
  spacer12: {
    height: 12,
  },
  spacer16: {
    height: 16,
  },
  spacer20: {
    height: 20,
  },
  // Estilos de texto comunes
  fontSize16: {
    fontSize: 16,
  },
});