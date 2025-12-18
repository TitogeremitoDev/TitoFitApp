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
import SubscriptionRetentionModal from '../../components/SubscriptionRetentionModal';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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
  const { user, token } = useAuth();
  const [fraseActual, setFraseActual] = useState('');
  const [showChangelog, setShowChangelog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPerfilUpgradeModal, setShowPerfilUpgradeModal] = useState(false);

  // Estado para el tooltip promocional de FREEUSER
  const [showPromoTooltip, setShowPromoTooltip] = useState(false);

  // Estado para el entrenador del cliente
  const [currentTrainer, setCurrentTrainer] = useState(null);

  // Estado para el modal de retención de suscripción
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [showRetentionModal, setShowRetentionModal] = useState(false);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * FRASES.length);
    setFraseActual(FRASES[randomIndex]);
  }, []);

  // Mostrar tooltip promocional para FREEUSER (solo una vez por sesión)
  useEffect(() => {
    const showPromo = async () => {
      if (user?.tipoUsuario === 'FREEUSER') {
        const lastPromoShown = await AsyncStorage.getItem('last_promo_session');
        const currentSession = new Date().toDateString();
        if (lastPromoShown !== currentSession) {
          // Delay de 1.5s para que no sea intrusivo
          setTimeout(() => {
            setShowPromoTooltip(true);
            AsyncStorage.setItem('last_promo_session', currentSession);
          }, 1500);
        }
      }
    };
    showPromo();
  }, [user?.tipoUsuario]);

  // Obtener datos del entrenador si el usuario es CLIENTE
  useEffect(() => {
    const fetchTrainer = async () => {
      if (user?.tipoUsuario === 'CLIENTE' && token) {
        try {
          const response = await fetch(`${API_URL}/api/clients/my-trainer`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.success && data.trainer) {
            setCurrentTrainer(data.trainer);
          }
        } catch (error) {
          console.error('[Home] Error fetching trainer:', error);
        }
      }
    };
    fetchTrainer();
  }, [user?.tipoUsuario, token]);

  // Verificar changelog
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

  // Cargar estado de suscripción para usuarios premium/cliente/entrenador
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      // Solo para usuarios no FREEUSER que tengan token
      if (!token || user?.tipoUsuario === 'FREEUSER' || !user) return;

      try {
        const response = await fetch(`${API_URL}/api/subscription/status`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (data.success && data.subscription) {
          setSubscriptionData(data.subscription);
        } else {
          // FALLBACK: Si no hay suscripción formal pero el usuario tiene subscriptionExpiry
          // (caso de códigos gratuitos / períodos de prueba)
          if (user.subscriptionExpiry) {
            const expiryDate = new Date(user.subscriptionExpiry);
            const now = new Date();
            const diffTime = expiryDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            setSubscriptionData({
              daysRemaining: diffDays,
              status: diffDays <= 0 ? 'expired' : 'trial', // 'trial' para códigos gratuitos
              active: diffDays > 0,
              expiresAt: user.subscriptionExpiry,
              isCodeBased: true, // Flag para identificar que es un código gratuito
            });
          }
        }
      } catch (error) {
        console.error('[Home] Error fetching subscription status:', error);
        // FALLBACK en caso de error: usar subscriptionExpiry del usuario
        if (user?.subscriptionExpiry) {
          const expiryDate = new Date(user.subscriptionExpiry);
          const now = new Date();
          const diffTime = expiryDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          setSubscriptionData({
            daysRemaining: diffDays,
            status: diffDays <= 0 ? 'expired' : 'trial',
            active: diffDays > 0,
            expiresAt: user.subscriptionExpiry,
            isCodeBased: true,
          });
        }
      }
    };

    checkSubscriptionStatus();
  }, [token, user?.tipoUsuario, user, user?.subscriptionExpiry]);

  // Lógica de trigger para el modal de retención
  useEffect(() => {
    const checkRetentionModal = async () => {
      if (!subscriptionData) return;

      const { daysRemaining, status, active, isCodeBased } = subscriptionData;

      // NO mostrar si tiene suscripción activa que se auto-renueva
      // (status === 'active' Y no está cancelada Y no tiene fecha de expiración próxima Y NO es código gratuito)
      if (status === 'active' && active && !subscriptionData.cancelAtPeriodEnd && !isCodeBased) {
        return;
      }

      // No tiene días restantes definidos o son indefinidos
      if (daysRemaining === undefined || daysRemaining === null) return;

      // No mostrar si quedan más de 7 días
      if (daysRemaining > 7) return;

      const lastShown = await AsyncStorage.getItem('retention_modal_last_shown');
      const now = Date.now();

      if (lastShown) {
        const elapsed = now - parseInt(lastShown, 10);
        const hoursElapsed = elapsed / (1000 * 60 * 60);

        // Reglas de frecuencia:
        // - 7-3 días: mostrar cada 48 horas
        // - < 3 días (pero > 0): mostrar cada 24 horas
        // - Día 0: mostrar siempre
        if (daysRemaining >= 3 && hoursElapsed < 48) return;
        if (daysRemaining > 0 && daysRemaining < 3 && hoursElapsed < 24) return;
        // daysRemaining === 0: siempre mostrar (no return)
      }

      // Delay de 2.5 segundos para no ser intrusivo al entrar
      setTimeout(() => {
        setShowRetentionModal(true);
        AsyncStorage.setItem('retention_modal_last_shown', now.toString());
      }, 2500);
    };

    checkRetentionModal();
  }, [subscriptionData]);

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

  // Mostrar botón de pagos: FREEUSER (para premium), PREMIUM/CLIENTE/ENTRENADOR (para plan coach)
  const showPaymentButton =
    user?.tipoUsuario === 'FREEUSER' ||
    user?.tipoUsuario === 'PREMIUM' ||
    user?.tipoUsuario === 'CLIENTE' ||
    user?.tipoUsuario === 'ENTRENADOR' ||
    user?.tipoUsuario === 'ADMINISTRADOR';

  // Determinar si es usuario premium para efectos VIP
  const isPremiumUser = user?.tipoUsuario === 'CLIENTE' ||
    user?.tipoUsuario === 'ENTRENADOR' ||
    user?.tipoUsuario === 'ADMINISTRADOR' ||
    user?.tipoUsuario === 'PREMIUM';

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
      {(user?.tipoUsuario === 'ADMINISTRADOR' || user?.tipoUsuario === 'ENTRENADOR' || !!user?.trainerProfile?.trainerCode) && (
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
            {/* Corona inclinada FUERA del botón */}
            <Text style={styles.crownOutside}>👑</Text>
            <LinearGradient
              colors={['#FFD700', '#FFA500', '#FF8C00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.paymentGradient}
            >
              <Text style={styles.paymentButtonText}>Subir de Nivel</Text>
              <Ionicons name="chevron-forward" size={16} color="#000" />
            </LinearGradient>
          </Pressable>
        </Link>
      )}

      {/* Tooltip promocional para FREEUSER */}
      {showPromoTooltip && user?.tipoUsuario === 'FREEUSER' && (
        <Pressable
          style={styles.promoTooltipContainer}
          onPress={() => setShowPromoTooltip(false)}
        >
          {/* Flecha apuntando al botón */}
          <View style={styles.promoArrow} />
          <View style={styles.promoTooltip}>
            <Text style={styles.promoEmoji}>🚀✨</Text>
            <Text style={styles.promoTitle}>¡Desbloquea tu potencial!</Text>
            <Text style={styles.promoText}>
              Rutinas ilimitadas • Videos HD • Sin límites
            </Text>
            <Text style={styles.promoSubtext}>
              Toca aquí para cerrar o ¡dale al botón dorado!
            </Text>
          </View>
        </Pressable>
      )}

      <View style={styles.contentContainer}>
        <View style={styles.card}>
          {/* Logo: mostrar logo del entrenador si es cliente con trainer */}
          {currentTrainer?.profile?.logoUrl ? (
            <Image
              source={{ uri: currentTrainer.profile.logoUrl }}
              resizeMode="contain"
              style={[styles.logo, styles.logoVIP]}
            />
          ) : (
            <Image
              source={require('../../assets/logo.png')}
              resizeMode="contain"
              style={[styles.logo, isPremiumUser && styles.logoVIP]}
            />
          )}
          {/* Título: mostrar nombre del entrenador si es cliente con trainer */}
          <Text style={styles.title}>
            {currentTrainer?.profile?.brandName || currentTrainer?.nombre || 'TotalGains'}
          </Text>
          <Text style={styles.subtitle}>Tu progreso, bien medido.</Text>

          <Link href="/entreno" asChild>
            <ActionButton title="Empezar entreno" icon="barbell-outline" />
          </Link>
          <View style={{ height: 10 }} />
          <Link href="/rutinas" asChild>
            <ActionButton title="Crear rutina" icon="construct-outline" variant="secondary" />
          </Link>
          <View style={{ height: 10 }} />
          <Link href="/seguimiento" asChild>
            <ActionButton title="Seguimiento" icon="analytics-outline" variant="secondary" />
          </Link>
          <View style={{ height: 10 }} />
          <Link href="/nutricion" asChild>
            <ActionButton title="Nutrición" icon="nutrition-outline" variant="secondary" />
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

          <Text style={styles.version}>v{APP_VERSION} • TotalGains</Text>
          {/* Enlace a la web */}
          <Link href="https://totalgains.es/app" asChild>
            <Text style={styles.website}>www.TotalGains.es</Text>
          </Link>
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

      {/* Modal de retención de suscripción */}
      <SubscriptionRetentionModal
        visible={showRetentionModal}
        onClose={() => setShowRetentionModal(false)}
        onRenew={() => {
          setShowRetentionModal(false);
          router.push('/payment');
        }}
        daysRemaining={subscriptionData?.daysRemaining || 0}
        userType={user?.tipoUsuario}
        subscriptionStatus={subscriptionData?.status}
      />
    </View>
  );
}

const CARD_BG = 'rgba(255,255,255,0.08)';
const BORDER = 'rgba(255,255,255,0.18)';

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contentContainer: { width: '86%', alignItems: 'center', bottom: -20 },
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
    borderRadius: 22,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  paymentGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  crownOutside: {
    position: 'absolute',
    top: -12,
    left: -8,
    fontSize: 24,
    transform: [{ rotate: '-20deg' }],
    zIndex: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // Estilos del tooltip promocional
  promoTooltipContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 95 : 85,
    right: 15,
    zIndex: 998,
    alignItems: 'flex-end',
  },
  promoArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 12,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#1F2937',
    marginRight: 30,
    marginBottom: -1,
  },
  promoTooltip: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  promoEmoji: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 6,
  },
  promoTitle: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  promoText: {
    color: '#E5E7EB',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 18,
  },
  promoSubtext: {
    color: '#9CA3AF',
    fontSize: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  paymentButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
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
  logoVIP: {
    // Sombra dorada difuminada profesional (glow effect)
    borderWidth: 3,
    borderRadius: 20,
    overflow: 'hidden',
    borderColor: '#ffd90079',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 25,
    elevation: 20,
    // Sin borde para look más limpio
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
  website: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    color: 'gold',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 20,
  },
});
