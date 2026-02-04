/* app/index.jsx - HOME SCREEN CON MODAL DE UPGRADE PARA FREE */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Modal,
  Pressable,
  useWindowDimensions,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { EnhancedScrollView } from '../../components/ui';
import { Link, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import ActionButton from '../../components/ActionButton';
import BrandBackground from '../../components/BrandBackground';
import SubscriptionRetentionModal from '../../components/SubscriptionRetentionModal';
import RescueOfferModal from '../../components/RescueOfferModal';
import { PaymentNotificationManager } from '../../src/components/payment';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

// Import condicional: Solo en móvil cargamos el layout flotante
let HomeMobileLayout = null;
if (Platform.OS !== 'web') {
  HomeMobileLayout = require('../../components/HomeMobileLayout').default;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

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

// Forzar la versión actual ya que Constants puede estar cacheando un valor antiguo
const APP_VERSION = '1.1.5';

const CAMBIOS_112 = [
  '🍎 Sistema Integral de Nutrición: Control total de dietas y macros.',
  '📲 Importación Automática: Base de datos de alimentos mejorada.',
  '🧑‍🍳 Creador Pro & IA: Recetas inteligentes con importación artificial.',
  '💊 Suplementación Avanzada: Nuevo módulo de gestión de suplementos.',
  '🛒 Lista Inteligente: Genera tu compra automáticamente.',
  '👥 Nuevo Panel de Clientes: Gestión visual y eficiente.',
  '✨ UI/UX Renovado: Mejor experiencia en nutrición y entrenos.',
];

const SUBTITULO_CHANGELOG = `Estas son las principales novedades y mejoras de la versión ${APP_VERSION}.`;


export default function HomeScreen() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuth();
  const { theme, isDark } = useTheme();
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

  // Estado para mensajes no leídos del chat
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Estado para feedbacks del entrenador sin leer
  const [unreadFeedbackReports, setUnreadFeedbackReports] = useState(0);

  // Estado para el modal de rescate (coach congelado >10 días)
  const [rescueOffer, setRescueOffer] = useState(null);
  const [showRescueModal, setShowRescueModal] = useState(false);

  // Ref para evitar que el changelog se verifique múltiples veces durante re-mounts
  const changelogCheckedRef = useRef(false);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * FRASES.length);
    setFraseActual(FRASES[randomIndex]);
  }, []);

  // 🔄 Refrescar datos del usuario cuando home recibe foco
  // Esto asegura que el tipoUsuario siempre esté actualizado
  // Usamos un ref para evitar múltiples llamadas en el mismo ciclo de foco
  const hasRefreshedThisFocus = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // Evitar múltiples llamadas en el mismo ciclo de foco
      if (hasRefreshedThisFocus.current) return;

      if (token && refreshUser) {
        hasRefreshedThisFocus.current = true;
        refreshUser().catch(() => {
          // Error silencioso - ya manejado en AuthContext
        });
      }

      // Cleanup: resetear el flag cuando se pierde el foco
      return () => {
        hasRefreshedThisFocus.current = false;
      };
    }, []) // Sin deps - solo al ganar foco, evita loop si backend renueva tokens
  );

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

  // Obtener datos del entrenador si el usuario es CLIENTE o ENTRENADOR con currentTrainerId
  useEffect(() => {
    const fetchTrainer = async () => {
      // Buscar entrenador si es CLIENTE, o si es ENTRENADOR con otro entrenador asignado
      const shouldFetchTrainer = user?.tipoUsuario === 'CLIENTE' ||
        (user?.tipoUsuario === 'ENTRENADOR' && user?.currentTrainerId);

      if (shouldFetchTrainer && token) {
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
  }, [user?.tipoUsuario, user?.currentTrainerId, token]);

  // Verificar oferta de rescate (coach congelado >10 días)
  useEffect(() => {
    const checkRescueOffer = async () => {
      // Solo para clientes con entrenador asignado
      if (!token || !user?.currentTrainerId) return;
      if (user?.tipoUsuario !== 'CLIENTE') return;

      try {
        const response = await fetch(`${API_URL}/api/clients/rescue-offer`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.hasOffer) {
          console.log('[Home] 🚨 Rescue offer available:', data);
          setRescueOffer(data);
          // Mostrar modal después de un pequeño delay para no ser intrusivo
          setTimeout(() => {
            setShowRescueModal(true);
          }, 2000);
        }
      } catch (error) {
        console.error('[Home] Error checking rescue offer:', error);
      }
    };
    checkRescueOffer();
  }, [token, user?.currentTrainerId, user?.tipoUsuario]);

  // Obtener mensajes no leídos del chat y feedbacks (con jitter para desincronizar usuarios)
  useEffect(() => {
    const fetchUnreadData = async () => {
      if (!token) return;
      try {
        // Fetch chat unread y feedback reports en paralelo
        const [chatRes, feedbackRes] = await Promise.all([
          fetch(`${API_URL}/api/chat/total-unread`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/feedback-reports/unread-count`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null)
        ]);

        // Validar que las respuestas sean JSON antes de parsear
        const isJsonResponse = (res) =>
          res && res.ok && res.headers?.get('content-type')?.includes('application/json');

        const chatData = isJsonResponse(chatRes) ? await chatRes.json() : { success: false };
        const feedbackData = isJsonResponse(feedbackRes) ? await feedbackRes.json() : { success: false };

        if (chatData.success) {
          setUnreadChatCount(chatData.totalUnread || 0);
        }
        if (feedbackData.success) {
          setUnreadFeedbackReports(feedbackData.count || 0);
        }
      } catch (error) {
        console.error('[Home] Error fetching unread data:', error);
      }
    };
    fetchUnreadData();

    // Jitter: 30s base + 0-5s aleatorio para evitar picos de carga
    const baseInterval = 30000;
    const jitter = Math.floor(Math.random() * 5000);
    const interval = setInterval(fetchUnreadData, baseInterval + jitter);

    return () => clearInterval(interval);
  }, [token]);

  // Verificar changelog - solo una vez por sesión de montaje
  useEffect(() => {
    // Evitar verificaciones duplicadas durante re-mounts
    if (changelogCheckedRef.current) return;
    changelogCheckedRef.current = true;

    (async () => {
      try {
        const lastSeen = await AsyncStorage.getItem('last_seen_version');
        if (lastSeen !== APP_VERSION) {
          // Guardar inmediatamente para evitar race conditions
          await AsyncStorage.setItem('last_seen_version', APP_VERSION);
          setShowChangelog(true);
        }
      } catch { }
    })();
  }, []);

  // Cargar estado de suscripción para usuarios premium/cliente/entrenador
  // NOTA: Dependencias son solo valores primitivos para evitar re-ejecuciones
  // innecesarias cuando 'user' cambia de referencia (refreshUser, etc.)
  const userSubscriptionExpiry = user?.subscriptionExpiry;
  const userTipoUsuario = user?.tipoUsuario;

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      // Solo para usuarios no FREEUSER que tengan token
      if (!token || userTipoUsuario === 'FREEUSER' || !userTipoUsuario) return;

      try {
        const response = await fetch(`${API_URL}/api/subscription/status`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType?.includes('application/json')) {
          throw new Error(`Server returned ${response.status}`);
        }
        const data = await response.json();
        if (data.success && data.subscription) {
          setSubscriptionData(data.subscription);
        } else if (userSubscriptionExpiry) {
          // FALLBACK: Si no hay suscripción formal pero el usuario tiene subscriptionExpiry
          // (caso de códigos gratuitos / períodos de prueba)
          const expiryDate = new Date(userSubscriptionExpiry);
          const now = new Date();
          const diffTime = expiryDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          setSubscriptionData({
            daysRemaining: diffDays,
            status: diffDays <= 0 ? 'expired' : 'trial',
            active: diffDays > 0,
            expiresAt: userSubscriptionExpiry,
            isCodeBased: true,
          });
        }
      } catch (error) {
        console.warn('[Home] Subscription status unavailable, using fallback:', error.message);
        // FALLBACK en caso de error: usar subscriptionExpiry del usuario
        if (userSubscriptionExpiry) {
          const expiryDate = new Date(userSubscriptionExpiry);
          const now = new Date();
          const diffTime = expiryDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          setSubscriptionData({
            daysRemaining: diffDays,
            status: diffDays <= 0 ? 'expired' : 'trial',
            active: diffDays > 0,
            expiresAt: userSubscriptionExpiry,
            isCodeBased: true,
          });
        }
      }
    };

    checkSubscriptionStatus();
  }, [token, userTipoUsuario, userSubscriptionExpiry]);

  // Lógica de trigger para el modal de retención
  useEffect(() => {
    const checkRetentionModal = async () => {
      if (!subscriptionData) return;

      // CLIENTE NO DEBE VER ESTE MODAL - su acceso depende del entrenador, no de su propia suscripción
      if (user?.tipoUsuario === 'CLIENTE') return;

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

  const closeChangelog = () => {
    setShowChangelog(false);
    // La versión ya se guarda al mostrar el modal para evitar loops
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

  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  // "Pequeño" si es < 700px de alto (iPhone SE/8/Mini y similares)
  const isSmallHeight = height < 700 && !isWeb;
  // "Muy pequeño" para pantallas extremadamente pequeñas
  const isVerySmallHeight = height < 600 && !isWeb;

  // Calculamos márgenes dinámicos para evitar solapamiento con botones flotantes
  // Aumentados para dar más espacio a los botones de Cambiar Modo y Subir de Nivel
  const topMargin = isWeb ? 100 : (Platform.OS === 'ios' ? 120 : 105);

  // Colores dinámicos para glassmorphism
  const glassCardBg = isDark
    ? 'rgba(30, 41, 59, 0.85)'
    : 'rgba(255, 255, 255, 0.92)';
  const glassCardBorder = isDark
    ? 'rgba(255, 255, 255, 0.10)'
    : 'rgba(255, 255, 255, 0.60)';
  const bannerBg = isDark ? '#1E293B' : '#0F172A';

  // Estilos dinámicos memoizados para optimización
  const dynamicStyles = useMemo(() => ({
    titleText: {
      color: theme.text,
      ...(isSmallHeight && { fontSize: 20 }),
    },
    subtitleText: {
      color: theme.textSecondary,
      ...(isSmallHeight && { marginBottom: 12 }),
    },
  }), [theme.text, theme.textSecondary, isSmallHeight]);

  // ═══════════════════════════════════════════════════════════════
  // MÓVIL: Usa el layout flotante separado
  // WEB: Usa el layout clásico con card (definido abajo)
  // ═══════════════════════════════════════════════════════════════
  const renderMobileContent = () => HomeMobileLayout ? (
    <HomeMobileLayout
      theme={theme}
      isDark={isDark}
      topMargin={topMargin}
      currentTrainer={currentTrainer}
      user={user}
      handlePerfilPress={handlePerfilPress}
      unreadFeedbackReports={unreadFeedbackReports}
      bannerBg={bannerBg}
      fraseActual={fraseActual}
      APP_VERSION={APP_VERSION}
      seguimientoBadgeLargeStyle={styles.seguimientoBadgeLarge}
      seguimientoBadgeTextStyle={styles.seguimientoBadgeText}
      seguimientoBtnGoldenStyle={styles.seguimientoBtnGolden}
    />
  ) : null;

  // Layout clásico con card (usado en web y como fallback)
  const renderWebContent = () => (
    <>
      <View style={[
        styles.card,
        {
          marginTop: topMargin,
          // Glassmorphism dinámico
          backgroundColor: glassCardBg,
          borderColor: glassCardBorder,
        },
        !isWeb ? {
          width: '100%',
          maxWidth: 500,
          alignSelf: 'center',
          paddingVertical: isVerySmallHeight ? 12 : (isSmallHeight ? 16 : 24),
        } : null
      ]}>
        {/* Logo: mostrar logo según la jerarquía:
            1. Si tiene entrenador asignado → logo del entrenador
            2. Si es ENTRENADOR sin entrenador propio → su propio logo de trainerProfile
            3. Fallback → logo de TotalGains
        */}
        {/* Contenedor del logo */}
        <View style={styles.logoContainer}>
          {currentTrainer?.profile?.logoUrl ? (
            <Image
              source={{ uri: currentTrainer.profile.logoUrl }}
              resizeMode="contain"
              style={[styles.logo, styles.logoVIP, !isWeb ? {
                width: isVerySmallHeight ? width * 0.22 : width * 0.28,
                height: isVerySmallHeight ? width * 0.22 : width * 0.28,
                maxHeight: isVerySmallHeight ? 70 : (isSmallHeight ? 90 : 130),
                maxWidth: isVerySmallHeight ? 70 : (isSmallHeight ? 90 : 130),
                marginBottom: isVerySmallHeight ? 6 : (isSmallHeight ? 8 : 12)
              } : null]}
            />
          ) : user?.trainerProfile?.logoUrl && !user?.currentTrainerId ? (
            // Entrenador sin otro entrenador: mostrar su propio logo
            <Image
              source={{ uri: user.trainerProfile.logoUrl }}
              resizeMode="contain"
              style={[styles.logo, styles.logoVIP, !isWeb ? {
                width: isVerySmallHeight ? width * 0.22 : width * 0.28,
                height: isVerySmallHeight ? width * 0.22 : width * 0.28,
                maxHeight: isVerySmallHeight ? 70 : (isSmallHeight ? 90 : 130),
                maxWidth: isVerySmallHeight ? 70 : (isSmallHeight ? 90 : 130),
                marginBottom: isVerySmallHeight ? 6 : (isSmallHeight ? 8 : 12)
              } : null]}
            />
          ) : (
            <Image
              source={require('../../assets/logo.png')}
              resizeMode="contain"
              style={[styles.logo, isPremiumUser ? styles.logoVIP : null, !isWeb ? {
                width: isVerySmallHeight ? width * 0.22 : width * 0.28,
                height: isVerySmallHeight ? width * 0.22 : width * 0.28,
                maxHeight: isVerySmallHeight ? 70 : (isSmallHeight ? 90 : 130),
                maxWidth: isVerySmallHeight ? 70 : (isSmallHeight ? 90 : 130),
                marginBottom: isVerySmallHeight ? 6 : (isSmallHeight ? 8 : 12)
              } : null]}
            />
          )}
        </View>
        {/* Título: mostrar nombre según la jerarquía:
            1. Si tiene entrenador asignado → nombre del entrenador
            2. Si es ENTRENADOR sin entrenador propio → su brandName
            3. Fallback → TotalGains
        */}
        <Text style={[styles.title, dynamicStyles.titleText]}>
          {currentTrainer?.profile?.brandName || currentTrainer?.nombre ||
            (user?.trainerProfile?.brandName && !user?.currentTrainerId ? user.trainerProfile.brandName : 'TotalGains')}
        </Text>
        <Text style={[styles.subtitle, dynamicStyles.subtitleText]}>Tu progreso, bien medido.</Text>

        {/* Botón Principal */}
        <Link href="/entreno" asChild>
          <ActionButton title="Empezar entreno" icon="barbell-outline" variant="secondary" compact={isSmallHeight} />
        </Link>
        <View style={isSmallHeight ? styles.spacer10 : styles.spacer12} />

        {/* Grid para botones secundarios en pantallas pequeñas, Lista en grandes */}
        {isSmallHeight ? (
          <View style={styles.gridContainer}>
            {/* Fila 1 */}
            <View style={styles.gridColumn}>
              <Link href="/rutinas" asChild>
                <ActionButton title="Rutina" icon="construct-outline" variant="secondary" compact={true} style={styles.compactButton} />
              </Link>
            </View>
            <View style={styles.gridColumnRelative}>
              <Link href="/seguimiento" asChild>
                <ActionButton
                  title="Seguimiento"
                  icon="analytics-outline"
                  variant="secondary"
                  compact={true}
                  style={[
                    styles.compactButton,
                    unreadFeedbackReports > 0 ? styles.seguimientoBtnGolden : null
                  ]}
                />
              </Link>
              {unreadFeedbackReports > 0 && (
                <View style={styles.seguimientoBadge}>
                  <Text style={styles.seguimientoBadgeText}>+{unreadFeedbackReports}</Text>
                </View>
              )}
            </View>

            {/* Fila 2 */}
            <View style={styles.gridColumn}>
              <Link href="/nutricion" asChild>
                <ActionButton title="Nutrición" icon="nutrition-outline" variant="secondary" compact={true} style={styles.compactButton} />
              </Link>
            </View>
            <View style={styles.gridColumn}>
              <ActionButton
                title="Perfil"
                icon="person-outline"
                variant="secondary"
                onPress={handlePerfilPress}
                compact={true}
                style={styles.compactButton}
              />
            </View>
          </View>
        ) : (
          <>
            <Link href="/rutinas" asChild>
              <ActionButton title="Crear rutina" icon="construct-outline" variant="secondary" />
            </Link>
            <View style={styles.spacer10} />
            <View style={styles.badgeContainer}>
              <Link href="/seguimiento" asChild>
                <ActionButton
                  title="Seguimiento"
                  icon="analytics-outline"
                  variant="secondary"
                  style={unreadFeedbackReports > 0 ? styles.seguimientoBtnGolden : undefined}
                />
              </Link>
              {unreadFeedbackReports > 0 && (
                <View style={styles.seguimientoBadgeLarge}>
                  <Text style={styles.seguimientoBadgeText}>+{unreadFeedbackReports}</Text>
                </View>
              )}
            </View>
            <View style={styles.spacer10} />
            <Link href="/nutricion" asChild>
              <ActionButton title="Nutrición" icon="nutrition-outline" variant="secondary" />
            </Link>
            <View style={styles.spacer10} />
            <ActionButton
              title="Perfil"
              icon="person-outline"
              variant="secondary"
              onPress={handlePerfilPress}
            />
          </>
        )}

        <View style={isSmallHeight ? styles.spacer8 : styles.spacer10} />

        <Text style={styles.version}>v{APP_VERSION} • TotalGains</Text>
        {/* Enlace a la web */}
        <Link href="https://totalgains.es/app" asChild>
          <Text style={styles.website}>www.TotalGains.es</Text>
        </Link>
      </View>

      <View style={[
        styles.bannerContainer,
        { backgroundColor: bannerBg },
        isSmallHeight ? { marginTop: 10, paddingVertical: 12 } : null
      ]}>
        <Text style={styles.bannerText}>{fraseActual}</Text>
      </View>
    </>
  );

  // Elegir layout según plataforma
  const renderContent = () => isWeb ? renderWebContent() : renderMobileContent();

  return (
    <PaymentNotificationManager>
      <View style={[styles.root, !isWeb ? { justifyContent: 'flex-start' } : null]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {/* Fondo dinámico con blobs del color del tema */}
        <BrandBackground
          primaryColor={theme.primary}
          accentColor={theme.premium || theme.accentBorder || '#10B981'}
          isDark={isDark}
          backgroundColor={theme.background}
        />

        {/* Botón Mode Select para Admin/Entrenador - Solo emoji de flechas */}
        {/* Solo mostrar si el usuario ES actualmente ADMINISTRADOR o ENTRENADOR (no basarse en trainerCode residual) */}
        {(user?.tipoUsuario === 'ADMINISTRADOR' || user?.tipoUsuario === 'ENTRENADOR') && (
          <Link href="/mode-select" asChild>
            <Pressable
              style={styles.modeSelectorButtonCompact}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modeSelectorGradientCompact}
              >
                <Text style={styles.modeSelectorEmoji}>🔄</Text>
              </LinearGradient>
            </Pressable>
          </Link>
        )}

        {/* Botón de FAQs - A la izquierda de Subir de Nivel */}
        {showPaymentButton && (
          <Link href="/coach-help" asChild>
            <Pressable
              style={styles.faqButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <LinearGradient
                colors={['#6B7280', '#4B5563']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.faqGradient}
              >
                <Text style={styles.faqEmoji}>❓</Text>
              </LinearGradient>
            </Pressable>
          </Link>
        )}

        {/* Botón Payment - Solo corona */}
        {showPaymentButton && (
          <Link href="/payment" asChild>
            <Pressable
              style={styles.paymentButtonCompact}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <LinearGradient
                colors={['#FFD700', '#FFA500', '#FF8C00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.paymentGradientCompact}
              >
                <Text style={styles.paymentEmoji}>👑</Text>
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
              {/* Botón de código VIP */}
              <Pressable
                style={styles.promoVipButton}
                onPress={() => {
                  setShowPromoTooltip(false);
                  router.push('/payment');
                }}
              >
                <Ionicons name="star" size={14} color="#000" />
                <Text style={styles.promoVipButtonText}>¿TIENES CÓDIGO VIP? ENTRA AQUÍ</Text>
              </Pressable>
              <Text style={styles.promoSubtext}>
                Toca fuera para cerrar
              </Text>
            </View>
          </Pressable>
        )}

        <EnhancedScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
        >
          <SafeAreaView style={styles.contentContainer}>
            {renderContent()}
          </SafeAreaView>
        </EnhancedScrollView>

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
                {CAMBIOS_112.map((line, i) => (
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

        {/* FAB de Chat */}
        <Pressable
          style={styles.chatFab}
          onPress={() => router.push('/chat')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <LinearGradient
            colors={['#8B5CF6', '#6366F1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.chatFabGradient}
          >
            <Ionicons name="chatbubbles" size={26} color="#FFF" />
            {unreadChatCount > 0 && (
              <View style={styles.chatFabBadge}>
                <Text style={styles.chatFabBadgeText}>
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </Text>
              </View>
            )}
          </LinearGradient>
        </Pressable>

        {/* Modal de rescate para clientes cuyo coach está congelado >10 días */}
        <RescueOfferModal
          visible={showRescueModal}
          rescueOffer={rescueOffer}
          onClose={() => setShowRescueModal(false)}
        />
      </View>
    </PaymentNotificationManager>
  );
}

const CARD_BG = 'rgba(255,255,255,0.08)';
const BORDER = 'rgba(255,255,255,0.18)';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      minHeight: '100vh',
      minWidth: '100vw',
      overflow: 'hidden',
    }),
  },
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      width: '100%',
    }),
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : (Platform.OS === 'web' ? 40 : 100),
    ...(Platform.OS === 'web' && {
      minHeight: '100vh',
      width: '100%',
    }),
  },
  contentContainer: {
    width: Platform.OS === 'web' ? '92%' : '86%',
    alignItems: 'center',
    maxWidth: 500,
  },
  blob: {
    position: 'absolute',
    width: Platform.OS === 'android' ? 220 : 280,
    height: Platform.OS === 'android' ? 220 : 280,
    borderRadius: 160,
    opacity: Platform.OS === 'android' ? 0.12 : 0.25,
    backgroundColor: '#3B82F6',
    filter: Platform.OS === 'web' ? 'blur(70px)' : undefined,
    // En Android, simular difuminado con bordes suaves
    ...(Platform.OS === 'android' && {
      borderWidth: 40,
      borderColor: 'rgba(59, 130, 246, 0.05)',
    }),
  },
  blobTop: { top: -60, left: -60 },
  blobBottom: {
    bottom: -50,
    right: -50,
    backgroundColor: '#10B981',
    ...(Platform.OS === 'android' && {
      borderColor: 'rgba(16, 185, 129, 0.05)',
    }),
  },
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
  promoVipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFD700',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  promoVipButtonText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
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
  // Estilos compactos para botones superiores
  paymentButtonCompact: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    right: 20,
    zIndex: 999,
    borderRadius: 18,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  paymentGradientCompact: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentEmoji: {
    fontSize: 22,
  },
  modeSelectorButtonCompact: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 20,
    zIndex: 999,
    borderRadius: 18,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  modeSelectorGradientCompact: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeSelectorEmoji: {
    fontSize: 22,
  },
  faqButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    right: 72,
    zIndex: 999,
    borderRadius: 18,
    shadowColor: '#6B7280',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#6B7280',
  },
  faqGradient: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faqEmoji: {
    fontSize: 22,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    padding: 22,
    borderRadius: 32,
    // backgroundColor y borderColor se aplican dinámicamente
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 12,
    borderRadius: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
  },
  title: { color: '#E5E7EB', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { color: '#9CA3AF', marginTop: 2, marginBottom: 16 },
  version: { marginTop: 16, color: '#93A3B3', fontSize: 12 },
  bannerContainer: {
    width: '100%',
    marginTop: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    // backgroundColor se aplica dinámicamente
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
  // FAB de Chat
  chatFab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : Platform.OS === 'web' ? 30 : 190,
    right: 20,
    zIndex: 999,
    borderRadius: 30,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  chatFabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatFabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#0B1220',
  },
  chatFabBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  // Estilos para badge dorado en botón Seguimiento
  seguimientoBtnGolden: {
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
  },
  seguimientoBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    minWidth: 28,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFF',
    zIndex: 10,
  },
  seguimientoBadgeLarge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#FFD700',
    borderRadius: 14,
    minWidth: 32,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: '#FFF',
    zIndex: 10,
  },
  seguimientoBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
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
  // Grid layout para pantallas pequeñas
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  gridColumn: {
    width: '48%',
  },
  gridColumnRelative: {
    width: '48%',
    position: 'relative',
  },
  compactButton: {
    height: 50,
    justifyContent: 'center',
  },
  badgeContainer: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
  },
});
