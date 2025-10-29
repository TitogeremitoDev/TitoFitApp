/* app/perfil.jsx
    ────────────────────────────────────────────────────────────────────────
    Tu nueva pantalla de Perfil.
    Usa el mismo fondo y los mismos botones que la pantalla de inicio.
    ──────────────────────────────────────────────────────────────────────── */

import { View, Text, StyleSheet, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

// <--- ¡Importamos el botón reutilizable!
import ActionButton from '../../components/ActionButton';

export default function PerfilScreen() {
  const router = useRouter();

  // Función para navegar a la nueva pantalla de Evolución
  const handleEvolucion = () => {
    router.push('/evolucion'); // Navega a app/evolucion.jsx
  };

  const handleAjustes = () => {
    alert('Ajustes (Próximamente)');
  };

  const handleCerrarSesion = () => {
    alert('Cerrar Sesión (Próximamente)');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Fondo degradado (igual que el index) */}
      <LinearGradient
        colors={['#0B1220', '#0D1B2A', '#111827']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      {/* Usamos ScrollView por si añades más botones */}
      <ScrollView
        style={{ width: '100%' }}
        contentContainerStyle={styles.scrollContainer}
      >
        <Text style={styles.title}>Mi Perfil</Text>
        <Text style={styles.subtitle}>Gestiona tu cuenta y tu progreso</Text>

        {/* El botón que pediste */}
        <ActionButton
          title="Ver Evolución"
          onPress={handleEvolucion}
          variant="primary" // Botón principal (azul)
          icon="trending-up-outline"
        />

        <View style={{ height: 10 }} />

        {/* Otros botones de ejemplo */}
        <ActionButton
          title="Ajustes de la Cuenta"
          onPress={handleAjustes}
          variant="secondary" // Botón secundario (borde)
          icon="settings-outline"
        />

        <View style={{ height: 10 }} />

        <ActionButton
          title="Cerrar Sesión"
          onPress={handleCerrarSesion}
          variant="secondary"
          icon="log-out-outline"
        />
      </ScrollView>
    </View>
  );
}

/* ───────────── estilos ───────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 36 : 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 60,
  },
  /* Blobs decorativos (copiados de index.jsx) */
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

  /* Títulos (copiados de index.jsx) */
  title: {
    color: '#E5E7EB',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#9CA3AF',
    marginTop: 2,
    marginBottom: 24, // Más espacio antes de los botones
  },
});
