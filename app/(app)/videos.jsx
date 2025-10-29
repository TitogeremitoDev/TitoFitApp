/* app/videos.jsx
    ... (comentarios anteriores) ...
    
    >>> ¡ARREGLO 14.0!: Arreglado el tamaño de los Shorts.
    >>> - 'VIDEO_DATA' ahora incluye el 'formato' (16:9 o 9:16).
    >>> - El modal calcula la altura dinámicamente.
    ──────────────────────────────────────────────────────────────────────── */
import rawDB from '../../src/data/exercises.json'; // ajusta la ruta si este archivo cambia

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import YoutubeIframe from 'react-native-youtube-iframe';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- ¡¡CAMBIO IMPORTANTE EN VIDEO_DATA!! ---
// Tienes que especificar el formato de cada vídeo
// Convierte el JSON (array por músculo) a { [musculo]: { [nombreEjercicio]: { id, formato } } }
function buildVideoIndex(db) {
  // db: [{ musculo: string, ejercicios: Array<{ nombre, videoId, ... }> }, ...]
  const out = {};
  for (const grupo of db) {
    const musculo = String(grupo.musculo || '').trim();
    if (!musculo) continue;
    if (!out[musculo]) out[musculo] = {};
    for (const ej of grupo.ejercicios || []) {
      const nombre = String(ej.nombre || '').trim();
      if (!nombre) continue;

      const id = (ej.videoId || '').trim(); // puede venir vacío
      // Heurística simple: si más adelante guardas shorts como "short: true" en el JSON,
      // aquí puedes leer ej.short y poner '9:16'. Por ahora, todo 16:9 por defecto.
      const formato = '16:9';

      // En caso de duplicados de nombre dentro del mismo músculo,
      // el último sobrescribe (intencional para mantenerlo simple).
      out[musculo][nombre] = { id, formato };
    }
  }
  return out;
}
const VIDEO_DATA = buildVideoIndex(rawDB);

// --- CÁLCULOS DE TAMAÑO ---
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const modalWidth = screenWidth * 0.95; // Ancho del modal (95% de la pantalla)

export default function VideosScreen() {
  const router = useRouter();
  const [openMuscle, setOpenMuscle] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null); // <-- Ahora es un objeto
  const [playing, setPlaying] = useState(false); 
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  const toggleMuscle = (muscle) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenMuscle(openMuscle === muscle ? null : muscle);
  };

  // --- ¡CAMBIO EN handleExercisePress! ---
  const handleExercisePress = (videoData) => { // Recibe el objeto {id, formato}
    if (!videoData || !videoData.id || videoData.id.startsWith('VIDEO_ID_')) {
      alert('Video no disponible aún para este ejercicio.');
      return;
    }
    setSelectedVideo(videoData); // Guarda el objeto entero
    setShowVideoPlayer(true); 
    setTimeout(() => {
        setPlaying(true); 
    }, 100); 
  };

  const closeModal = () => {
    setPlaying(false); 
    setShowVideoPlayer(false); 
    setSelectedVideo(null); // Limpia el objeto
  };

  const onStateChange = (state) => {
    if (state === 'ended') {
      setPlaying(false);
      closeModal();
    }
    if (state === 'error') {
      alert('Error al reproducir el video');
      closeModal();
    }
  };

  const listaMusculos = Object.keys(VIDEO_DATA).sort();
  
  // --- ¡CÁLCULO DE ALTURA DINÁMICO! ---
  let videoHeight = (modalWidth * 9) / 16; // Default 16:9
  if (selectedVideo?.formato === '9:16') {
    // Si es 9:16 (Short), lo hacemos alto
    videoHeight = (modalWidth * 16) / 9;
    // Pero nunca más alto que el 85% de la pantalla
    const maxHeight = screenHeight * 0.85;
    if (videoHeight > maxHeight) {
      videoHeight = maxHeight;
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Videoteca',
          headerTitleStyle: { color: '#E5E7EB' },
          headerStyle: { backgroundColor: '#0D1B2A' },
          headerTintColor: '#E5E7EB',
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
            >
              <Ionicons name="arrow-back" size={24} color="#E5E7EB" />
            </Pressable>
          ),
        }}
      />

      <Text style={styles.instructionText}>
        Selecciona un grupo muscular y luego un ejercicio:
      </Text>

      {listaMusculos.map((muscle) => {
        const isOpen = openMuscle === muscle;
        return (
          <View key={muscle} style={styles.muscleGroup}>
            <Pressable
              style={({ pressed }) => [styles.muscleButton, pressed && styles.muscleButtonPressed]}
              onPress={() => toggleMuscle(muscle)}
            >
              <Text style={styles.muscleButtonText}>{muscle}</Text>
              <Ionicons
                name={isOpen ? 'chevron-down-outline' : 'chevron-forward-outline'}
                size={20}
                color="#E5E7EB"
              />
            </Pressable>

            {isOpen && (
              <View style={styles.exerciseList}>
                {/* --- ¡CAMBIO EN EL .MAP! --- */}
                {Object.entries(VIDEO_DATA[muscle]).map(([exercise, videoData]) => (
                  <Pressable
                    key={exercise}
                    style={({ pressed }) => [styles.exerciseButton, pressed && styles.exerciseButtonPressed]}
                    onPress={() => handleExercisePress(videoData)} // <-- Pasamos el objeto
                  >
                    <Ionicons name="play-circle-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                    <Text style={styles.exerciseButtonText}>{exercise}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={{ height: 64 }} />

      {/* --- MODAL --- */}
      <Modal
        animationType={Platform.OS === 'android' ? 'slide' : 'fade'}
        transparent={true}
        visible={showVideoPlayer}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          {/* --- ¡CAMBIO! El estilo 'height' es dinámico --- */}
          <View style={[styles.modalContent, { height: videoHeight }]}>
            
            {selectedVideo && (
              <YoutubeIframe
                height={videoHeight}
                width={modalWidth}
                play={playing}
                videoId={selectedVideo.id} // <-- Usamos .id
                onChangeState={onStateChange}
              />
            )}
            
            <Pressable onPress={closeModal} style={styles.closeButton}>
              <Ionicons name="close-outline" size={30} color="#FFFFFF" />
            </Pressable>

          </View>
        </View>
      </Modal>
      {/* --- FIN MODAL --- */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B2A',
    paddingHorizontal: 16,
  },
  headerButton: {
    padding: 10,
  },
  headerButtonPressed: {
    opacity: 0.6,
  },
  instructionText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 20,
  },
  muscleGroup: {
    marginBottom: 8,
    backgroundColor: '#111827',
    borderRadius: 12,
    overflow: 'hidden',
  },
  muscleButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: '#1F2937',
  },
  muscleButtonPressed: {
    backgroundColor: '#374151',
  },
  muscleButtonText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  exerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  exerciseButtonPressed: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  exerciseButtonText: {
    color: '#D1D5DB',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: modalWidth, // Ancho fijo
    backgroundColor: '#000',
    borderRadius: 15,
    overflow: 'hidden', 
    position: 'relative',
    // ¡La altura ('height') se aplica dinámicamente!
  },
  closeButton: {
    position: 'absolute',
    top: -10, 
    right: -10,
    zIndex: 10, 
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
  },
});