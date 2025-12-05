/* app/index.jsx - HOME SCREEN CON MODAL DE UPGRADE PARA FREE */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import ActionButton from '../../components/ActionButton';
import { useAuth } from '../../context/AuthContext';

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

const APP_VERSION = Constants?.expoConfig?.version ?? '0.9.0';

const CAMBIOS_131 = [
  'Nuevo acceso con interfaz de inicio de sesión (versión visual inicial).',
  'Cronómetro integrado en Entreno con persistencia durante la sesión.',
  'Mejoras globales de UI/UX: tipografías, espaciados y consistencia visual.',
  'Sección de Vídeos renovada: reproductor incrustado y catálogo por músculo.',
  'Evolución del rendimiento: indicadores de tendencia por serie y exportación semanal a Excel.',
  'Dos rutinas genéricas incorporadas y alineadas con la base de ejercicios (técnica y vídeo).',
  'Acceso a espacio de promoción personal desde la aplicación.',
  'Constructor de rutinas optimizado: crear, modificar, reordenar e importar CSV con validación y normalización.',
  'Botones en Entreno: "Técnica correcta (TC)" y vídeo incrustado por ejercicio.',
  'Memoria de sesión: vuelve automáticamente a la última semana y día utilizados.',
  'Estado "OE (Otro Ejercicio)" con compatibilidad retroactiva para datos antiguos.',
];

const SUBTITULO_CHANGELOG = `Estas son las principales novedades y mejoras de la versión ${APP_VERSION}.`;

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [fraseActual, setFraseActual] = useState('');
  const [showChangelog, setShowChangelog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPerfilUpgradeModal, setShowPerfilUpgradeModal] = useState(false);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * FRASES.length);
    setFraseActual(FRASES[randomIndex]);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const lastSeen = await AsyncStorage.getItem('last_seen_version');
        if (lastSeen !== APP_VERSION) {
          setShowChangelog(true);
        }
      } catch { }
    })();
  }, []);

  const closeChangelog = async () => {
    setShowChangelog(false);
    try {
      await AsyncStorage.setItem('last_seen_version', APP_VERSION);
    } catch { }
  };

  const handleVideosPress = () => {
    if (user?.tipoUsuario === 'FREEUSER') {
      setShowUpgradeModal(true);
    } else {
      router.push('/videos');
    }
  };

  const handlePerfilPress = () => {
    router.push('/perfil');
  };

  const closeUpgradeModal = () => {
    setShowUpgradeModal(false);
  };

  const closePerfilUpgradeModal = () => {
    setShowPerfilUpgradeModal(false);
  };

  const goToPayment = () => {
    setShowUpgradeModal(false);
    router.push('/payment');
  };

  const goToPaymentFromPerfil = () => {
    setShowPerfilUpgradeModal(false);
    router.push('/payment');
  };

  const showPaymentButton =
    user?.tipoUsuario === 'FREEUSER' ||
    user?.tipoUsuario === 'PREMIUM' ||
    user?.tipoUsuario === 'ADMIN';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0B1220', '#0D1B2A', '#111827']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      {/* Botón Mode Select para Admin/Entrenador */}
      {(user?.tipoUsuario === 'ADMINISTRADOR' || user?.tipoUsuario === 'ENTRENADOR') && (
        <Link href="/mode-select" asChild>
          <Pressable style={styles.modeSelectorButton}>
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modeSelectorGradient}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color="#FFF" />
              <Text style={styles.modeSelectorButtonText}>Cambiar Modo</Text>
            </LinearGradient>
          </Pressable>
        </Link>
      )}

      {showPaymentButton && (
        <Link href="/payment" asChild>
          <Pressable style={styles.paymentButton}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.paymentGradient}
            >
              <Ionicons name={user?.tipoUsuario === 'PREMIUM' || "ADMIN" || "ENTRENADOR" || "CLIENTE" ? "trending-up-outline" : "card-outline"} size={20} color="#FFF" />
              <Text style={styles.paymentButtonText}>Subir de Nivel</Text>
            </LinearGradient>
          </Pressable>
        </Link>
      )}

      <View style={styles.contentContainer}>
        <View style={styles.card}>
          <Image
            source={require('../../assets/logo.png')}
            resizeMode="contain"
            style={styles.logo}
          />
          <Text style={styles.title}>TitoGeremito</Text>
          <Text style={styles.subtitle}>Tu progreso, bien medido.</Text>

          <Link href="/entreno" asChild>
            <ActionButton title="Empezar entreno" icon="barbell-outline" />
          </Link>
          <View style={{ height: 10 }} />
          <Link href="/rutinas" asChild>
            <ActionButton title="Crear rutina" icon="construct-outline" variant="secondary" />
          </Link>
          <View style={{ height: 10 }} />
          <ActionButton
            title="Perfil"
            icon="person-outline"
            variant="secondary"
            onPress={handlePerfilPress}
          />
          <View style={{ height: 10 }} />
          <ActionButton
            title="Videos"
            icon="videocam-outline"
            variant="secondary"
            onPress={handleVideosPress}
          />

          <Text style={styles.version}>v{APP_VERSION} • APK Fitness</Text>
        </View>

        <View style={styles.bannerContainer}>
          <Text style={styles.bannerText}>{fraseActual}</Text>
        </View>
      </View>

      <Modal
        visible={showChangelog}
        transparent
        animationType={Platform.OS === 'android' ? 'slide' : 'fade'}
        onRequestClose={closeChangelog}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable onPress={closeChangelog} style={styles.modalClose}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.modalTitle}>Novedades {APP_VERSION}</Text>
            <Text style={styles.modalSubtitle}>{SUBTITULO_CHANGELOG}</Text>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 10 }}>
              {CAMBIOS_131.map((line, i) => (
                <View key={i} style={styles.changeRow}>
                  <Text style={styles.changeBullet}>•</Text>
                  <Text style={styles.changeText}>{line}</Text>
                </View>
              ))}
              <View style={styles.modalFooter}>
                <Image
                  source={require('../../assets/logo.png')}
                  resizeMode="contain"
                  style={styles.modalLogo}
                />
              </View>
            </ScrollView>
            <Pressable onPress={closeChangelog} style={styles.modalCta}>
              <Text style={styles.modalCtaText}>ENTENDIDO</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showUpgradeModal}
        onRequestClose={closeUpgradeModal}
      >
        <View style={styles.upgradeModalOverlay}>
          <View style={styles.upgradeModalContent}>
            <Pressable onPress={closeUpgradeModal} style={styles.upgradeModalClose}>
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
            <Pressable style={styles.upgradeCancelButton} onPress={closeUpgradeModal}>
              <Text style={styles.upgradeCancelText}>Tal vez más tarde</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showPerfilUpgradeModal}
        onRequestClose={closePerfilUpgradeModal}
      >
        <View style={styles.upgradeModalOverlay}>
          <View style={styles.upgradeModalContent}>
            <Pressable onPress={closePerfilUpgradeModal} style={styles.upgradeModalClose}>
              <Ionicons name="close-circle" size={32} color="#9CA3AF" />
            </Pressable>
            <Ionicons name="rocket" size={64} color="#10B981" style={{ marginBottom: 20 }} />
            <Text style={styles.upgradeModalTitle}>¡SUBE AL SIGUIENTE NIVEL!</Text>
            <Text style={styles.upgradeModalText}>
              Si quieres subir al siguiente nivel ven por aquí
            </Text>
            <Pressable style={styles.upgradeButton} onPress={goToPaymentFromPerfil}>
              <Ionicons name="add-circle" size={24} color="#FFF" />
              <Text style={styles.upgradeButtonText}>Ver Planes</Text>
            </Pressable>
            <Pressable style={styles.upgradeCancelButton} onPress={closePerfilUpgradeModal}>
              <Text style={styles.upgradeCancelText}>Tal vez más tarde</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CARD_BG = 'rgba(255,255,255,0.08)';
const BORDER = 'rgba(255,255,255,0.18)';

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contentContainer: { width: '86%', alignItems: 'center' },
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
  paymentButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    right: 20,
    zIndex: 999,
    borderRadius: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  paymentGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  paymentButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modeSelectorButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 20,
    zIndex: 999,
    borderRadius: 20,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  modeSelectorGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  modeSelectorButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
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
  title: { color: '#E5E7EB', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { color: '#9CA3AF', marginTop: 2, marginBottom: 16 },
  version: { marginTop: 16, color: '#93A3B3', fontSize: 12 },
  bannerContainer: {
    width: '100%',
    marginTop: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(31, 41, 55, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(75, 85, 99, 0.6)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  bannerText: { color: '#F3F4F6', fontSize: 15, fontWeight: '600', textAlign: 'center' },
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
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
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
  modalTitle: { color: '#E5E7EB', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  modalSubtitle: { color: '#9CA3AF', fontSize: 12, marginBottom: 12 },
  changeRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  changeBullet: { color: '#93C5FD', fontSize: 16, lineHeight: 18, marginTop: 2 },
  changeText: { color: '#E5E7EB', fontSize: 14, lineHeight: 20, flex: 1 },
  modalFooter: { marginTop: 10, alignItems: 'center' },
  modalLogo: { width: 110, height: 110, opacity: 0.9 },
  modalCta: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  modalCtaText: { color: '#fff', fontWeight: '800', letterSpacing: 0.3 },
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
});
