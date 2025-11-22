/* app/perfil.jsx
   ────────────────────────────────────────────────────────────────────────
   Pantalla de Perfil con canje de código cliente.
   Mantiene mismo fondo/estilo. Añade botón y modal para introducir código.
   ──────────────────────────────────────────────────────────────────────── */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, Modal, TextInput, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

// Botón reutilizable
import ActionButton from '../../components/ActionButton';
import { useAuth } from '../../context/AuthContext'; // 👈 acceso a user y upgradeByCode
import { useTheme } from '../../context/ThemeContext';

export default function PerfilScreen() {
  const router = useRouter();
  const { user, upgradeByCode, logout } = useAuth();
  const { theme, isDark } = useTheme();

  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleEvolucion = () => {
    router.push('perfil/evolucion');
  };

  const handleAjustes = () => {
    router.push('perfil/ajustes');
  };

  const handleCerrarSesion = async () => {
    await logout();
    Alert.alert('Sesión cerrada');
  };

  const openRedeem = () => setShowModal(true);
  const closeRedeem = () => { if (!submitting) { setShowModal(false); setCode(''); } };

  const redeem = async () => {
    if (!code.trim()) {
      Alert.alert('Código vacío', 'Introduce tu código de cliente.');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await upgradeByCode(code.trim());
      setShowModal(false);
      setCode('');
      Alert.alert('Hecho', `Tu cuenta ahora es: ${updated.tipoUsuario}`);
    } catch (e) {
      const msg = (e?.response?.data?.message) || e?.message || 'No se pudo canjear el código';
      Alert.alert('Error', String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  // Colores del degradado adaptados al tema
  const gradientColors = isDark 
    ? ['#0B1220', '#0D1B2A', '#111827']
    : ['#f0f4f8', '#e0e7ef', '#d1dce6'];

  const blobColorTop = isDark ? '#3B82F6' : '#93c5fd';
  const blobColorBottom = isDark ? '#10B981' : '#6ee7b7';

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Fondo degradado */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, styles.blobTop, { backgroundColor: blobColorTop }]} />
      <View style={[styles.blob, styles.blobBottom, { backgroundColor: blobColorBottom }]} />

      <ScrollView style={{ width: '100%' }} contentContainerStyle={styles.scrollContainer}>
        <Text style={[styles.title, { color: theme.text }]}>Mi Perfil</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Gestiona tu cuenta y tu progreso</Text>

        {/* Estado actual */}
        {user && (
          <Text style={[styles.badge, { 
            color: theme.successText,
            backgroundColor: theme.successLight,
            borderColor: theme.successBorder,
            borderWidth: 1
          }]}>
            Estado: {user.tipoUsuario}
          </Text>
        )}

        {/* Ver Evolución */}
        <ActionButton
          title="Ver Evolución"
          onPress={handleEvolucion}
          variant="primary"
          icon="trending-up-outline"
        />

        <View style={{ height: 10 }} />

        {/* Canjear código cliente */}
        <ActionButton
          title="Canjear código cliente"
          onPress={openRedeem}
          variant="secondary"
          icon="key-outline"
        />

        <View style={{ height: 10 }} />

        {/* Ajustes de perfil */}
        <ActionButton
          title="Ajustes de tu perfil"
          onPress={handleAjustes}
          variant="secondary"
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

      {/* Modal canje */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={closeRedeem}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { 
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border
          }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Introduce tu código</Text>
            <TextInput
              style={[styles.input, {
                borderColor: theme.inputBorder,
                color: theme.inputText,
                backgroundColor: theme.inputBackground
              }]}
              placeholder="Código de cliente"
              placeholderTextColor={theme.placeholder}
              autoCapitalize="characters"
              value={code}
              onChangeText={setCode}
            />
            <View style={styles.modalRow}>
              <Pressable 
                onPress={closeRedeem} 
                disabled={submitting} 
                style={[styles.btn, styles.btnGhost, { borderColor: theme.border }]}
              >
                <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
              </Pressable>
              <Pressable 
                onPress={redeem} 
                disabled={submitting} 
                style={[styles.btn, styles.btnSolid, { backgroundColor: theme.primary }]}
              >
                <Text style={styles.btnSolidText}>{submitting ? 'Canjeando…' : 'Canjear'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  blob: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 160,
    opacity: 0.25,
    filter: Platform.OS === 'web' ? 'blur(70px)' : undefined,
  },
  blobTop: { top: -40, left: -40 },
  blobBottom: { bottom: -30, right: -30 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 2,
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
    fontWeight: '600',
  },
  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnGhostText: {},
  btnSolid: {},
  btnSolidText: { color: '#fff', fontWeight: '700' },
});