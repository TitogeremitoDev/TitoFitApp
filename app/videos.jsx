/* app/videos.jsx
    ────────────────────────────────────────────────────────────────────────
    ¡NUEVO! Videoteca de Ejercicios.
    - Muestra videos de YouTube asociados a ejercicios, agrupados por músculo.
    - Utiliza un acordeón para mostrar/ocultar ejercicios.
    - Requiere: npx expo install react-native-webview
    MODIFICADO: El video ahora se muestra en un Modal pantalla casi completa.
    CORREGIDO: Usar solo VIDEO_ID (no URL completa) y deshabilitar WebView en web.
    MODIFICADO: Añadido soporte para Web usando <iframe> en lugar de WebView.
    CORREGIDO: Error "Unexpected token" en import condicional de WebView.
    AÑADIDO: Autoplay (silenciado) para videos en web y nativo.
    ──────────────────────────────────────────────────────────────────────── */

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
  SafeAreaView,
  // Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// Importar WebView siempre. Si es web, no se usará en el render.
import { WebView } from 'react-native-webview';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// --- ¡TU BASE DE DATOS DE VIDEOS AQUÍ! ---
const VIDEO_DATA = {
  PECTORAL: {
    'Press Banca con Barra': 'qmb-6KOXvJI',
    'Press Inclinado Mancuerna': 'VIDEO_ID_INCLINADO_MANCUERNA',
    'Aperturas Cable': 'VIDEO_ID_APERTURAS_CABLE',
  },
  ESPALDA: {
    'Dominadas': 'VIDEO_ID_DOMINADAS',
    'Remo con Barra': 'VIDEO_ID_REMO_BARRA',
    'Jalon al Pecho': 'VIDEO_ID_JALON_PECHO',
  },
  CUADRICEPS: {
     'Sentadilla Trasera': 'VIDEO_ID_SENTADILLA',
     'Prensa': 'VIDEO_ID_PRENSA',
     'Extension Cuadriceps': 'VIDEO_ID_EXTENSION_CUAD',
  },
  // ... Añade más músculos y ejercicios con sus IDs
};
// --- FIN DE LA BASE DE DATOS ---

const screenWidth = Dimensions.get('window').width;

export default function VideosScreen() {
  const router = useRouter();
  const [openMuscle, setOpenMuscle] = useState(null);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  const toggleMuscle = (muscle) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenMuscle(openMuscle === muscle ? null : muscle);
  };

  const handleExercisePress = (videoId) => {
    if (!videoId || videoId.startsWith('VIDEO_ID_')) {
      alert('Video no disponible', 'Video aún no añadido para este ejercicio.');
      return;
    }
    setSelectedVideoId(videoId);
    setIsVideoLoading(true);
  };

  const closeModal = () => {
      setSelectedVideoId(null);
      setIsVideoLoading(false);
  };

  const listaMusculos = Object.keys(VIDEO_DATA).sort();

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Videoteca',
          headerTitleStyle: { color: '#E5E7EB' },
          headerStyle: { backgroundColor: '#0D1B2A' },
          headerTintColor: '#E5E7EB',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}>
              <Ionicons name="arrow-back" size={24} color="#E5E7EB" />
            </Pressable>
          ),
        }}
      />

      {/* --- Lista de Músculos (Acordeón) --- */}
      <Text style={styles.instructionText}>
        Selecciona un grupo muscular y luego un ejercicio:
      </Text>

      {listaMusculos.map((muscle) => {
        const isOpen = openMuscle === muscle;
        return (
          <View key={muscle} style={styles.muscleGroup}>
            {/* Botón del Músculo */}
            <Pressable
              style={({ pressed }) => [ styles.muscleButton, pressed && styles.muscleButtonPressed ]}
              onPress={() => toggleMuscle(muscle)}
            >
              <Text style={styles.muscleButtonText}>{muscle}</Text>
              <Ionicons
                name={isOpen ? 'chevron-down-outline' : 'chevron-forward-outline'}
                size={20}
                color="#E5E7EB"
              />
            </Pressable>

            {/* Lista de Ejercicios (si está abierto) */}
            {isOpen && (
              <View style={styles.exerciseList}>
                {Object.entries(VIDEO_DATA[muscle]).map(([exercise, videoId]) => (
                  <Pressable
                    key={exercise}
                    style={({ pressed }) => [ styles.exerciseButton, pressed && styles.exerciseButtonPressed ]}
                    onPress={() => handleExercisePress(videoId)}
                  >
                    <Ionicons name="play-circle-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }}/>
                    <Text style={styles.exerciseButtonText}>{exercise}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}

       <View style={{ height: 64 }} />

       {/* --- MODAL PARA EL VIDEO (AHORA CON IFRAME PARA WEB Y AUTOPLAY) --- */}
       <Modal
          animationType="fade"
          transparent={true}
          visible={!!selectedVideoId}
          onRequestClose={closeModal}
       >
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Pressable onPress={closeModal} style={styles.closeButton}>
                      <Ionicons name="close-outline" size={30} color="#FFFFFF" />
                  </Pressable>
                  <View style={styles.videoContainerModal}>
                      {isVideoLoading && (
                          <ActivityIndicator size="large" color="#FFFFFF" style={styles.videoLoader} />
                      )}

                      {/* --- LÓGICA CONDICIONAL WEB vs NATIVO --- */}
                      {selectedVideoId && Platform.OS === 'web' && (
                           <iframe
                              // --- AUTOPLAY WEB ---
                              src={`https://www.youtube.com/embed/${selectedVideoId}?autoplay=1&mute=1`}
                              style={styles.iframe}
                              frameBorder="0"
                              // Añadimos 'autoplay' a los permisos
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              onLoad={() => setIsVideoLoading(false)}
                           ></iframe>
                      )}

                      {selectedVideoId && Platform.OS !== 'web' && (
                           <WebView
                                style={[styles.webview, isVideoLoading && { opacity: 0 }]}
                                containerStyle={{ backgroundColor: 'black' }}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                allowsInlineMediaPlayback={true}
                                // Asegurar que no requiera acción del usuario
                                mediaPlaybackRequiresUserAction={false}
                                // --- AUTOPLAY NATIVO ---
                                source={{ uri: `https://www.youtube.com/embed/${selectedVideoId}?playsinline=1&autoplay=1&mute=1` }}
                                onLoadEnd={() => setIsVideoLoading(false)}
                                onError={(syntheticEvent) => {
                                    const { nativeEvent } = syntheticEvent;
                                    console.warn('WebView error: ', nativeEvent);
                                    setIsVideoLoading(false);
                                    alert('Error', 'Error al cargar el video.');
                                    closeModal();
                                }}
                            />
                      )}
                      {/* --- FIN LÓGICA CONDICIONAL --- */}
                  </View>
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
      width: '95%',
      height: '80%',
      backgroundColor: '#000',
      borderRadius: 15,
      overflow: 'hidden',
      position: 'relative',
      paddingTop: 40,
  },
  closeButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 10,
      padding: 5,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 15,
  },
  videoContainerModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
   videoLoader: {
       position: 'absolute',
   },
  webview: { // Estilo para WebView (Nativo)
    flex: 1,
    width: '100%',
    opacity: 1,
    backgroundColor: '#000',
  },
  iframe: { // Estilo para Iframe (Web)
      width: '100%',
      height: '100%',
      borderWidth: 0,
  },
});

