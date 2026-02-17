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
import ExerciseCard from '../../components/entreno/ExerciseCard';
import { isBiserie } from '../../components/entreno/ExerciseCardUtils';


const { width } = Dimensions.get('window');
const ARROW_W = 56;
const ESTADOS = ['C', 'NC', 'OE']; // ← OJ → OE
const SEMANAS_MAX = 200;
const DEBOUNCE_SAVE_MS = 600; // Debounce para guardado de series (evita writes en cada tecla)

// EXTRA_ABBR and getTrendIcon moved to ExerciseCardUtils

const sessionKeyFor = (routineId) => `last_session_${routineId || 'global'}`;

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

/* ───────── Cambio de estado SIN guardado inmediato ───────── */
  const setEstadoEjLocal = useCallback((clave, val) => {
    // Solo cambio local del estado, NO guardamos en AsyncStorage aquí
    const nextVal = val === 'OJ' ? 'OE' : val;
    setProg((prev) => ({ ...prev, [clave]: nextVal }));
    // 🚪 Marcar que hay cambios sin guardar
    setHasUnsavedChanges(true);
  }, []);

  const handleToggleExpand = useCallback((id) => {
    setOpenId(prevId => (prevId === id ? null : id));
  }, []);

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
  }, [user, findExerciseInIndex]);

  const onOpenNotes = useCallback(async (serieKey, exerciseId, exerciseName) => {
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
      exerciseId: exerciseId,
      exerciseName: exerciseName,
      value: existingNote?.value || 'low',
      note: existingNote?.note || '',
      audioUri: existingNote?.audioUri || null,
      mediaUri: pendingMediaUri,
      mediaType: pendingMediaType,
    });
  }, [notes]);

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

  const handleFocus = useCallback((index) => {
    try {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.3,
      });
    } catch { }
  }, []);

  const renderItem = useCallback(({ item, index }) => {
    if (!item) return null;

    const currentIsBiserie = isBiserie(item);
    const nextItem = ejerciciosDia[index + 1];
    const nextIsBiserie = isBiserie(nextItem);
    const showBiserieConnector = currentIsBiserie && nextIsBiserie;

    return (
      <ExerciseCard
        item={item}
        index={index}
        semana={semana}
        diaIdx={diaIdx}
        prog={prog}
        notes={notes}
        isExpanded={openId === item.id}
        isBiserie={currentIsBiserie}
        showBiserieConnector={showBiserieConnector}
        onToggleExpand={handleToggleExpand}
        onSetEstado={setEstadoEjLocal}
        onSetSerieDato={setSerieDato}
        onOpenTC={onOpenTC}
        onOpenImage={onOpenImage}
        onOpenVideo={onOpenVideo}
        onOpenNotes={onOpenNotes}
        exerciseDetails={exerciseDetailsMap.get(item.id)}
        theme={theme}
        onFocus={handleFocus}
        flushProgress={flushProgress}
      />
    );
  }, [semana, diaIdx, prog, notes, openId, ejerciciosDia, handleToggleExpand, setEstadoEjLocal, setSerieDato, onOpenTC, onOpenImage, onOpenVideo, onOpenNotes, exerciseDetailsMap, theme, handleFocus, flushProgress]);
