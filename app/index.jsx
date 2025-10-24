/* app/index.jsx
    ────────────────────────────────────────────────────────────────────────
    Pantalla de inicio (Home)
    MODIFICADO: Añadido botón de "Videos"
    AÑADIDO: Banner inferior con frases motivadoras que rotan.
    MODIFICADO: Banner ahora se posiciona debajo de la tarjeta principal.
    MODIFICADO: Frase cambia solo al inicio, estilo del banner actualizado.
    ──────────────────────────────────────────────────────────────────────── */

import React, { useState, useEffect } from 'react';
// Eliminamos Animated ya que no se usa
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

// <--- Importamos el botón reutilizable
import ActionButton from '../components/ActionButton';

// --- FRASES MOTIVADORAS ---
const FRASES = [
  "La disciplina es el puente entre metas y logros.",
  "El dolor que sientes hoy será la fuerza que sientas mañana.",
  "No cuentes los días, haz que los días cuenten.",
  "La única mala sesión de entrenamiento es la que no se hizo.",
  "Cree en ti mismo y todo será posible.",
  "Tu cuerpo puede soportar casi cualquier cosa. Es tu mente la que tienes que convencer.",
  "NO FUN, NO GAIN.",
  "La intensidad no se negocia.",
  "Disfruta de cada repeticion, sufre cada entrenamiento.",
  "Lucha cada puta repetición como si fuera la última."
];
// --- FIN FRASES ---

export default function HomeScreen() {
  const [fraseActual, setFraseActual] = useState(''); // Inicializa vacía

  useEffect(() => {
    // --- CAMBIO LÓGICA ---
    // Selecciona una frase aleatoria solo una vez al montar el componente
    const randomIndex = Math.floor(Math.random() * FRASES.length);
    setFraseActual(FRASES[randomIndex]);
    // Ya no hay intervalo, el efecto solo se ejecuta una vez ([])
    // Ya no necesitamos la animación fadeAnim
    // --- FIN CAMBIO ---
  }, []); // Array de dependencias vacío para ejecutar solo al montar

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Fondo degradado + blobs */}
      <LinearGradient
        colors={['#0B1220', '#0D1B2A', '#111827']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      {/* Contenedor principal para centrar tarjeta y banner */}
      <View style={styles.contentContainer}>
          {/* Tarjeta “glass” central */}
          <View style={styles.card}>
            <Image
              source={require('../assets/logo.png')}
              resizeMode="contain"
              style={styles.logo}
            />
            <Text style={styles.title}>TitoGeremito</Text>
            <Text style={styles.subtitle}>Tu progreso, bien medido.</Text>

            {/* Botones */}
            <Link href="/entreno" asChild>
              <ActionButton title="Empezar entreno" icon="barbell-outline" />
            </Link>
            <View style={{ height: 10 }} />
            <Link href="/rutinas" asChild>
              <ActionButton title="Crear rutina" icon="construct-outline" variant="secondary"/>
            </Link>
            <View style={{ height: 10 }} />
            <Link href="/perfil" asChild>
              <ActionButton title="Perfil" icon="person-outline" variant="secondary"/>
            </Link>
            <View style={{ height: 10 }} />
            <Link href="/videos" asChild>
              <ActionButton title="Videos" icon="videocam-outline" variant="secondary"/>
            </Link>

            <Text style={styles.version}>v1.2 • APK Fitness</Text>
          </View>

          {/* --- BANNER DEBAJO DE LA TARJETA --- */}
          {/* Ya no usamos Animated.Text */}
          <View style={styles.bannerContainer}>
            <Text style={styles.bannerText}>
              {fraseActual}
            </Text>
          </View>
          {/* --- FIN BANNER --- */}
      </View>
    </View>
  );
}

/* ───────────── estilos ───────────── */
const CARD_BG = 'rgba(255,255,255,0.08)';
const BORDER = 'rgba(255,255,255,0.18)';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
      width: '86%',
      alignItems: 'center',
      
  },
  blob: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 160,
    opacity: 0.25,
    backgroundColor: '#3B82F6',
    filter: Platform.OS === 'web' ? 'blur(70px)' : undefined,
  },
  blobTop: { top: -40, left: -40 },
  blobBottom: { bottom: -30, right: -30, backgroundColor: '#10B981' },
  card: {
    width: '100%',
    alignItems: 'center',
    padding: 22,
    borderRadius: 24,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 12,
    borderRadius: 20,
    shadowColor: '#f7ecd8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    color: '#E5E7EB',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#9CA3AF',
    marginTop: 2,
    marginBottom: 16,
  },
  version: {
    marginTop: 16,
    color: '#93A3B3',
    fontSize: 12,
  },
  // --- ESTILOS DEL BANNER (MODIFICADOS) ---
  bannerContainer: {
    width: '100%',
    marginTop: 20,
    paddingVertical: 18, // Un poco más de padding vertical
    paddingHorizontal: 20,
    backgroundColor: 'rgba(31, 41, 55, 0.85)', // Un gris oscuro más sólido (#1F2937)
    borderWidth: 1, // Borde normal
    borderColor: 'rgba(75, 85, 99, 0.6)', // Borde más visible (#4B5563)
    borderRadius: 12,
    shadowColor: '#000', // Sombra sutil
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  bannerText: {
    color: '#F3F4F6', // Texto casi blanco para contraste
    fontSize: 15, // Más grande
    fontWeight: '600', // Semi-bold
    // fontStyle: 'italic', // Eliminado itálica, opcional
    textAlign: 'center',
  },
  // --- FIN ESTILOS BANNER ---
});

