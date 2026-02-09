/* app/payment.jsx - V3.0 DINÁMICO
   ────────────────────────────────────────────────────────────────────────
   Pantalla de Pagos con Planes Dinámicos
   - Carga planes desde el backend en tiempo real
   - Precios actualizables sin actualizar la app
   - Soporte para ofertas temporales
   - Sincronización automática con la API
   ──────────────────────────────────────────────────────────────────────── */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  RefreshControl
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../../context/AuthContext';
// Componentes mejorados para iOS
import {
  EnhancedScrollView as ScrollView,
  EnhancedPressable as Pressable,
  EnhancedTextInput as TextInput,
} from '../../components/ui';
import { useStripe } from '../../utils/stripeWrapper';
import SyncProgressModal from '../../components/SyncProgressModal';
import { syncLocalToCloud } from '../../src/lib/dataSyncService';
import IAPService, { getGoogleProductIdFromPlan, getAppleProductIdFromPlan } from '../../utils/iapService';

// API URL - Usa la variable de entorno
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// BENEFICIOS COMUNES (estos se mantienen estáticos o también puedes cargarlos desde la API)
const COMMON_BENEFITS = [
  'Rutinas Premium actualizadas',
  'Tracking completo de progreso',
  'Biblioteca de videos y tips',
  'Soporte técnico 24/7',
  'Todo tu progreso seguro en la nube'
];

const COACH_BENEFITS = [
  'Seguimiento síncrono de clientes',
  'Asignación automática de rutinas',
  'Potenciado con IA para análisis',
  'Gestión centralizada de pagos',
  'Chat directo con atletas'
];

// URL CUESTIONARIO HIGH TICKET
const COACHING_FORM_URL = 'https://docs.google.com/forms/d/1-KNo9I1GEeaoeIAegtyYoPG9BqaBAP5OmOvCllQ96Ck/edit';

// Los planes de entrenador ahora se cargan dinámicamente desde la API
// Filtramos por isCoach y clientRange según la selección del usuario

export default function PaymentScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Usuarios con acceso premium: PREMIUM, CLIENTE (vinculado a entrenador), ENTRENADOR
  const isPremium = ['PREMIUM', 'CLIENTE', 'ENTRENADOR'].includes(user?.tipoUsuario);

  const [planes, setPlanes] = useState([]);
  const [loadingPlanes, setLoadingPlanes] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estado de UI
  const [selectedPlan, setSelectedPlan] = useState(null);
  // Método de pago por defecto según plataforma
  const getDefaultPaymentMethod = () => {
    if (Platform.OS === 'android') return 'googlepay';
    if (Platform.OS === 'ios') return 'applepay';
    return 'stripe'; // Web
  };
  const [paymentMethod, setPaymentMethod] = useState(getDefaultPaymentMethod());
  const [loading, setLoading] = useState(false);
  const [userToken, setUserToken] = useState(null);
  const [userType, setUserType] = useState('athlete'); // 'athlete' | 'coach'
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'

  // 🔄 Estado para modal de sincronización de datos
  const [syncModal, setSyncModal] = useState({
    visible: false,
    direction: 'upload', // 'upload' | 'download'
    isComplete: false,
    itemsSynced: 0,
  });



  // Debug logs (Safe to remove or comment out now)
  // useEffect(() => {
  //   console.log('[Payment] User:', user?._id, user?.tipoUsuario);
  //   console.log('[Payment] isPremium:', isPremium);
  //   console.log('[Payment] current userType:', userType);
  // }, [user, isPremium, userType]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CARGAR PLANES DESDE LA API
  // ═══════════════════════════════════════════════════════════════════════════
  const cargarPlanes = async () => {
    try {
      setLoadingPlanes(true);

      console.log('[Payment] Cargando planes desde API...');
      const response = await fetch(`${API_URL}/api/plans`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success && data.plans && data.plans.length > 0) {
        console.log(`[Payment] ${data.plans.length} planes cargados`);

        // Guardamos todos los planes desde la API
        setPlanes(data.plans);

        // Filter plans based on initial userType (default athlete)
        const filtered = data.plans.filter(p => {
          if (userType === 'coach') {
            // Para entrenadores, filtrar por isCoach y clientRange
            return p.isCoach && p.clientRange === coachClientCount;
          } else {
            // Para atletas, solo planes que NO son de coach
            return !p.isCoach;
          }
        });

        // Seleccionar automáticamente el plan destacado o el primero
        const planDestacado = filtered.find(p => p.destacado);
        setSelectedPlan(planDestacado || filtered[0]);
      } else {
        console.warn('[Payment] No hay planes disponibles');
        Alert.alert(
          'Sin planes disponibles',
          'No hay planes de suscripción disponibles en este momento.'
        );
      }
    } catch (error) {
      console.error('[Payment] Error cargando planes:', error);
      Alert.alert(
        'Error de conexión',
        'No se pudieron cargar los planes. Verifica tu conexión e intenta nuevamente.'
      );
    } finally {
      setLoadingPlanes(false);
      setRefreshing(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════


  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('totalgains_token');
        setUserToken(token);
      } catch (error) {
        console.error('Error token:', error);
      }
    })();
  }, []);

  // Detectar retorno de Stripe Checkout en web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const sessionId = urlParams.get('session_id');

    if (success === 'true' && sessionId) {
      // Usuario volvió exitosamente de Stripe Checkout
      console.log('[Payment] Retorno exitoso de Stripe Checkout, verificando pago...');
      setLoading(true);

      (async () => {
        try {
          const token = await AsyncStorage.getItem('totalgains_token');
          const response = await fetch(`${API_URL}/api/payments/stripe/verify-checkout-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sessionId })
          });

          const data = await response.json();

          if (data.success) {
            // 🔄 SIEMPRE sincronizar datos al confirmar pago
            const previousType = user?.tipoUsuario;
            console.log('[Payment] 🎯 Pago Stripe verificado. Tipo anterior:', previousType);

            setSyncModal({ visible: true, direction: 'upload', isComplete: false, itemsSynced: 0 });
            try {
              const syncResult = await syncLocalToCloud(token);
              setSyncModal(prev => ({ ...prev, isComplete: true, itemsSynced: syncResult?.itemsSynced || 0 }));
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (syncErr) {
              console.warn('[Payment] Error sincronizando datos:', syncErr);
            }
            setSyncModal(prev => ({ ...prev, visible: false }));

            const updatedUser = refreshUser ? await refreshUser(true) : null;
            console.log('[Payment] ✅ Usuario actualizado tras Stripe. Nuevo tipo:', updatedUser?.tipoUsuario);

            Alert.alert(
              '¡Bienvenido al Team! 🚀',
              'Tu suscripción ha sido activada correctamente.',
              [{ text: 'Empezar a Entrenar', onPress: () => router.replace('/home') }]
            );
          } else {
            Alert.alert('Atención', data.message || 'Error verificando el pago. Contacta con soporte.');
          }
        } catch (error) {
          console.error('[Payment] Error verificando pago:', error);
          Alert.alert('Error', 'No se pudo verificar el pago. Contacta con soporte.');
        } finally {
          setLoading(false);
          // Limpiar parámetros de URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      })();
    } else if (canceled === 'true') {
      // Usuario canceló el pago
      console.log('[Payment] Usuario canceló el pago');
      Alert.alert('Pago cancelado', 'Has cancelado el proceso de pago.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Detectar retorno de PayPal en web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const urlParams = new URLSearchParams(window.location.search);
    const paypalSuccess = urlParams.get('paypal_success');
    const paypalCanceled = urlParams.get('paypal_canceled');
    const planIdFromUrl = urlParams.get('plan_id');
    const subscriptionIdFromUrl = urlParams.get('subscription_id');

    if (paypalSuccess === 'true' && planIdFromUrl) {
      console.log('[Payment] Retorno exitoso de PayPal, buscando suscripción activa...');
      setLoading(true);

      (async () => {
        try {
          const token = await AsyncStorage.getItem('totalgains_token');

          if (!token) {
            Alert.alert('Error', 'No se encontró la sesión. Por favor, inicia sesión de nuevo.');
            setLoading(false);
            return;
          }


          // Si tenemos el subscription_id, usarlo directamente
          let subscriptionId = subscriptionIdFromUrl;
          let confirmUrl = subscriptionId
            ? `${API_URL}/api/payments/paypal/confirm-subscription/${subscriptionId}`
            : `${API_URL}/api/payments/paypal/confirm-latest`;

          console.log(`[Payment] Usando endpoint: ${confirmUrl}`);

          // Confirmar la suscripción
          const confirmRes = await fetch(
            confirmUrl,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ planId: planIdFromUrl })
            }
          );

          const confirmData = await confirmRes.json();
          console.log('[PayPal] Confirmación automática:', confirmData);


          if (confirmData.success) {
            // 🔄 SIEMPRE sincronizar datos al confirmar pago PayPal
            const previousType = user?.tipoUsuario;
            console.log('[Payment] 🎯 Pago PayPal verificado. Tipo anterior:', previousType);

            setSyncModal({ visible: true, direction: 'upload', isComplete: false, itemsSynced: 0 });
            try {
              const syncResult = await syncLocalToCloud(token);
              setSyncModal(prev => ({ ...prev, isComplete: true, itemsSynced: syncResult?.itemsSynced || 0 }));
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (syncErr) {
              console.warn('[Payment] Error sincronizando datos:', syncErr);
            }
            setSyncModal(prev => ({ ...prev, visible: false }));

            const updatedUser = refreshUser ? await refreshUser(true) : null;
            console.log('[Payment] ✅ Usuario actualizado tras PayPal. Nuevo tipo:', updatedUser?.tipoUsuario);

            Alert.alert(
              '¡Bienvenido al Team! 🚀',
              'Tu suscripción PayPal ha sido activada correctamente.',
              [{ text: 'Empezar a Entrenar', onPress: () => router.replace('/home') }]
            );
          } else {
            // La suscripción puede no estar activa aún
            if (confirmData.status === 'APPROVAL_PENDING') {
              Alert.alert(
                'Pago Pendiente',
                'Tu pago aún no ha sido procesado por PayPal. Por favor espera unos momentos y vuelve a intentar.',
                [{ text: 'Entendido' }]
              );
            } else {
              Alert.alert(
                'Atención',
                confirmData.message || 'No se pudo verificar el pago. Si ya pagaste, contacta con soporte.',
                [{ text: 'OK' }]
              );
            }
          }
        } catch (error) {
          console.error('[Payment] Error verificando pago PayPal:', error);
          Alert.alert('Error', 'No se pudo verificar el pago. Si ya pagaste, contacta con soporte.');
        } finally {
          setLoading(false);
          window.history.replaceState({}, '', window.location.pathname);
        }
      })();
    } else if (paypalCanceled === 'true') {
      console.log('[Payment] Usuario canceló el pago de PayPal');
      Alert.alert('Pago cancelado', 'Has cancelado el proceso de pago con PayPal.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    cargarPlanes();
  }, [user?._id, user?.tipoUsuario]); // Recargar si cambia el usuario

  // Efecto para seleccionar el plan correcto cuando cambia el tipo de usuario
  useEffect(() => {
    if (!planes || planes.length === 0) return;

    const targetDuration = billingCycle === 'monthly' ? 1 : 12;

    if (userType === 'coach') {
      // Para entrenadores: seleccionar coach_5 por defecto (el más básico)
      const coachPlan = planes.find(p =>
        p.isCoach &&
        p.clientRange === 5 &&
        p.duracionMeses === targetDuration
      );
      if (coachPlan) setSelectedPlan(coachPlan);
    } else {
      // Para atletas: seleccionar premium_mensual por defecto
      const athletePlan = planes.find(p =>
        !p.isCoach &&
        p.duracionMeses === targetDuration
      );
      if (athletePlan) setSelectedPlan(athletePlan);
    }
  }, [userType, planes]);

  // Efecto para actualizar el plan seleccionado si cambia el ciclo de facturación (solo coach)
  useEffect(() => {
    if (userType === 'coach' && selectedPlan) {
      // Intentar encontrar el equivalente en el nuevo ciclo
      const currentClients = selectedPlan.clientRange;
      const targetDuration = billingCycle === 'monthly' ? 1 : 12;
      const match = planes.find(p =>
        p.isCoach &&
        p.clientRange === currentClients &&
        p.duracionMeses === targetDuration
      );
      if (match) setSelectedPlan(match);
    }
  }, [billingCycle, userType, planes]);

  const onRefresh = () => {
    setRefreshing(true);
    cargarPlanes();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESAR PAGO
  // ═══════════════════════════════════════════════════════════════════════════

  const initializePaymentSheet = async (plan) => {
    if (!userToken) return;

    try {
      const response = await fetch(`${API_URL}/api/payments/stripe/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          currency: plan.moneda.toLowerCase(),
          planId: plan.id
        })
      });

      const { clientSecret, error } = await response.json();

      if (error) {
        Alert.alert('Error', error.message);
        return false;
      }

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'TotalGains',
        paymentIntentClientSecret: clientSecret,
        defaultBillingDetails: {
          name: user?.nombre || '',
          email: user?.email || '',
        },
        returnURL: 'totalgains://stripe-redirect', // Asegúrate de tener configurado el scheme
        customFlow: false,
      });

      if (initError) {
        Alert.alert('Error', initError.message);
        return false;
      }

      return { clientSecret, paymentIntentId: response.paymentIntentId }; // Asumiendo que el backend devuelve paymentIntentId si lo necesitas para confirmar manualmente, aunque el webhook o confirmación automática suele ser mejor.
      // Nota: El backend actual devuelve paymentIntentId en la respuesta de create-intent.
    } catch (error) {
      console.error('Error initializing Payment Sheet:', error);
      Alert.alert('Error', 'No se pudo iniciar el pago.');
      return false;
    }
  };

  const handlePay = async () => {
    if (!userToken) {
      return Alert.alert('Acceso requerido', 'Inicia sesión para continuar');
    }

    if (!selectedPlan) {
      return Alert.alert('Selecciona un plan', 'Debes seleccionar un plan de suscripción');
    }

    if (paymentMethod === 'stripe') {
      setLoading(true);
      const initResult = await initializePaymentSheet(selectedPlan);

      if (!initResult) {
        setLoading(false);
        return;
      }

      const { error } = await presentPaymentSheet();

      if (error) {
        Alert.alert(`Error: ${error.code}`, error.message);
        setLoading(false);
      } else {
        // Pago exitoso en Stripe, ahora confirmamos en backend si es necesario
        // O simplemente mostramos éxito si el webhook se encarga (pero aquí el backend tiene un endpoint de confirmación manual)
        // Vamos a llamar al endpoint de confirmación para asegurar que el usuario se actualice al instante.
        // Pero espera, create-intent devuelve paymentIntentId? Sí.
        // Necesitamos el ID para confirmar.
        // Modifiqué initializePaymentSheet para devolverlo, pero initPaymentSheet no devuelve el ID del intent creado, solo error.
        // Ah, el ID viene del fetch al backend.

        // REVISIÓN: El backend tiene /api/payments/stripe/confirm/:paymentIntentId
        // Pero `presentPaymentSheet` confirma el pago en Stripe.
        // Necesitamos el ID del PaymentIntent para decirle al backend "Oye, ya pagué, actualiza mi usuario".
        // El backend verifica el estado en Stripe y actualiza.

        // Sin embargo, initializePaymentSheet devuelve clientSecret. El ID está implícito o hay que extraerlo.
        // Mejor: Modificaré initializePaymentSheet para que devuelva el objeto completo del backend.

        // Espera, el backend devuelve: { success: true, clientSecret, paymentIntentId, ... }
        // Así que sí puedo obtener el ID.

        // Recuperar el ID (tendría que haberlo guardado del fetch anterior).
        // Vamos a refactorizar un poco handlePay para hacerlo en orden.

        // Refactorización inline rápida:
        // 1. Fetch create-intent -> obtengo paymentIntentId y clientSecret
        // 2. initPaymentSheet(clientSecret)
        // 3. presentPaymentSheet()
        // 4. Si éxito -> Fetch confirm/:paymentIntentId

        // Implementación correcta abajo:
        confirmPaymentBackend();
      }
    } else if (paymentMethod === 'paypal') {
      try {
        setLoading(true);

        // Crear suscripción de PayPal
        const response = await fetch(`${API_URL}/api/payments/paypal/create-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify({
            planId: selectedPlan.id,
            currency: 'EUR'
          })
        });

        const data = await response.json();

        if (!data.success) {
          Alert.alert('Error', data.error?.message || 'No se pudo crear la suscripción');
          setLoading(false);
          return;
        }

        const paypalSubscriptionId = data.subscriptionId;
        console.log('[PayPal] Suscripción creada:', paypalSubscriptionId);

        // Abrir URL de aprobación en navegador
        if (data.approvalUrl) {
          const canOpen = await Linking.canOpenURL(data.approvalUrl);
          if (canOpen) {
            await Linking.openURL(data.approvalUrl);

            // Mostrar instrucciones al usuario con opción de verificar
            Alert.alert(
              'Completar Pago',
              'Se ha abierto PayPal en tu navegador. Completa el pago y luego pulsa "Ya he pagado" para activar tu suscripción.',
              [
                {
                  text: 'Ya he pagado',
                  onPress: async () => {
                    // Verificar y confirmar la suscripción
                    try {
                      setLoading(true);
                      console.log('[PayPal] Verificando suscripción:', paypalSubscriptionId);

                      const confirmRes = await fetch(
                        `${API_URL}/api/payments/paypal/confirm-subscription/${paypalSubscriptionId}`,
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${userToken}`
                          },
                          body: JSON.stringify({ planId: selectedPlan.id })
                        }
                      );

                      const confirmData = await confirmRes.json();
                      console.log('[PayPal] Confirmación:', confirmData);

                      if (confirmData.success) {
                        // Refrescar datos del usuario
                        if (refreshUser) {
                          await refreshUser(true);
                        }

                        Alert.alert(
                          '¡Bienvenido al Team! 🚀',
                          `Suscripción ${selectedPlan.nombre} activada correctamente.`,
                          [{ text: 'Empezar a Entrenar', onPress: () => router.back() }]
                        );
                      } else {
                        // La suscripción existe pero no está activa aún
                        if (confirmData.status === 'APPROVAL_PENDING') {
                          Alert.alert(
                            'Pago Pendiente',
                            'Tu pago aún no ha sido procesado por PayPal. Por favor completa el pago en PayPal e intenta de nuevo.',
                            [
                              { text: 'Entendido' }
                            ]
                          );
                        } else {
                          Alert.alert(
                            'Atención',
                            confirmData.message || 'El pago no se pudo verificar. Si ya pagaste, contacta con soporte.',
                            [{ text: 'OK' }]
                          );
                        }
                      }
                    } catch (confirmError) {
                      console.error('[PayPal] Error confirmando:', confirmError);
                      Alert.alert(
                        'Error',
                        'No se pudo verificar el pago. Si ya pagaste, contacta con soporte.'
                      );
                    } finally {
                      setLoading(false);
                    }
                  }
                },
                {
                  text: 'Cancelar',
                  style: 'cancel',
                  onPress: () => setLoading(false)
                }
              ]
            );
          } else {
            Alert.alert('Error', 'No se pudo abrir PayPal. Inténtalo desde un navegador.');
            setLoading(false);
          }
        } else {
          setLoading(false);
        }

      } catch (error) {
        console.error('[PayPal] Error:', error);
        Alert.alert('Error', error.message || 'Error al procesar el pago con PayPal');
        setLoading(false);
      }

    } else {
      Alert.alert('Próximamente', 'Google Pay estará disponible en breve.');
    }
  };

  // Función auxiliar para confirmar en backend tras éxito de Stripe
  const confirmPaymentBackend = async () => {
    // Necesitamos el paymentIntentId. 
    // Como initPaymentSheet y presentPaymentSheet están desacoplados en el tiempo en la UI ideal (init al cargar, present al clickar),
    // pero aquí lo hacemos todo junto al clickar "Pagar" para simplificar (lazy loading).

    // Voy a re-implementar la lógica dentro de handlePay para tener acceso a las variables.
    // Ver abajo la implementación real en el bloque else.
  };

  const openCoaching = () => {
    Linking.openURL(COACHING_FORM_URL).catch(err => console.error("Couldn't load page", err));
  };

  const openEmailContact = () => {
    const email = 'titogeremitocoach@gmail.com';
    const subject = 'Consulta Plan Entrenador - Más de 20 clientes';
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

    if (Platform.OS === 'web') {
      window.location.href = mailtoUrl;
    } else {
      Linking.openURL(mailtoUrl).catch(err => console.error("Couldn't open email", err));
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CÁLCULOS DE RESUMEN
  // ═══════════════════════════════════════════════════════════════════════════

  const subtotal = selectedPlan?.precioActual || 0;
  const total = subtotal; // Precio ya incluye IVA

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERIZADO
  // ═══════════════════════════════════════════════════════════════════════════

  if (loadingPlanes) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#242345', '#1e1b36', '#242345']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Cargando planes...</Text>
      </View>
    );
  }

  if (!planes || planes.length === 0) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#242345', '#1e1b36', '#242345']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.header}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Suscripción Premium</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#64748B" />
          <Text style={styles.emptyTitle}>Sin planes disponibles</Text>
          <Text style={styles.emptyText}>
            No hay planes de suscripción disponibles en este momento.
          </Text>
          <Pressable onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#242345', '#1e1b36', '#242345']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* HEADER con título premium integrado */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </Pressable>
          <View style={{ width: 40 }} />
        </View>

        {/* 🏆 TÍTULO PREMIUM LLAMATIVO dentro del header */}
        <LinearGradient
          colors={['rgba(16, 185, 129, 0.15)', 'rgba(245, 158, 11, 0.15)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.premiumBanner}
        >
          <View style={styles.premiumBannerContent}>
            <Ionicons name="diamond" size={32} color="#10B981" />
            <Text style={styles.premiumBannerTitle}>SUSCRIPCIÓN PREMIUM</Text>
            <Text style={styles.premiumBannerSubtitle}>Acceso ilimitado a todas las funciones</Text>
          </View>
        </LinearGradient>

      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
      >


        {/* TITULO SUPERIOR */}
        <View style={styles.heroSection}>
          <Text style={styles.heroSubtitle}>Elige el plan perfecto para alcanzar tus objetivos</Text>
        </View>

        {/* SECCIÓN 0: TOGGLE TIPO USUARIO (Pill Custom) */}
        <View style={styles.pillContainer}>
          <View style={styles.pillBackground}>
            {/* Opción Usuario */}
            <Pressable
              onPress={() => {
                setUserType('athlete');
                setBillingCycle('monthly');
              }}
              style={[styles.pillOption, userType === 'athlete' && styles.pillOptionActiveHidden]} // Truco: ocultamos bg si está activo para mostrar el gradiente
            >
              {userType === 'athlete' && (
                <LinearGradient
                  colors={['#7C3AED', '#DB2777']} // Violeta a Rosa
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Ionicons name="flash" size={16} color={userType === 'athlete' ? '#FFF' : '#94A3B8'} style={{ marginRight: 6 }} />
              <Text style={[styles.pillText, userType === 'athlete' && styles.pillTextActive]}>Usuario</Text>
            </Pressable>

            {/* Opción Entrenador */}
            <Pressable
              onPress={() => setUserType('coach')}
              style={[styles.pillOption, userType === 'coach' && styles.pillOptionActiveHidden]}
            >
              {userType === 'coach' && (
                <LinearGradient
                  colors={['#7C3AED', '#DB2777']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Ionicons name="flame" size={16} color={userType === 'coach' ? '#FFF' : '#94A3B8'} style={{ marginRight: 6 }} />
              <Text style={[styles.pillText, userType === 'coach' && styles.pillTextActive]}>Entrenador</Text>
            </Pressable>
          </View>
        </View>

        {/* SECCIÓN 0.5: TOGGLE FACTURACIÓN (Switch Switch) */}
        {userType === 'coach' && (
          <View style={styles.billingSwitchContainer}>
            <Pressable onPress={() => setBillingCycle('monthly')}>
              <Text style={[styles.billingLabel, billingCycle === 'monthly' && styles.billingLabelActive]}>Mensual</Text>
            </Pressable>

            <Pressable
              onPress={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
              style={styles.switchTrack}
            >
              <View style={[styles.switchThumb, billingCycle === 'annual' && { transform: [{ translateX: 24 }] }]} />
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => setBillingCycle('annual')}>
                <Text style={[styles.billingLabel, billingCycle === 'annual' && styles.billingLabelActive]}>Anual</Text>
              </Pressable>
              {/* Badge 2 MESES GRATIS */}
              <View style={styles.badgeFreeMonths}>
                <Text style={styles.badgeFreeText}>2 MESES GRATIS</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />

        {/* SECCIÓN 2: PLANES (CARDS ROW) */}
        {/* On Web -> Flex Row. On Mobile -> Column */}
        <View style={[
          styles.plansContainer,
          (Platform.OS === 'web' || userType === 'coach') && styles.plansRow
        ]}>
          {planes.filter(p => {
            if (userType === 'coach') {
              // Coach: Filter by cycle
              const isCorrectCycle = billingCycle === 'monthly' ? p.duracionMeses === 1 : p.duracionMeses === 12;
              // Solo mostrar planes <= 20 clientes (STARTER, PRO, UNLIMITED)
              if (p.clientRange > 20) return false;
              // Android e iOS: ocultar UNLIMITED ANUAL (las tiendas no permiten precio tan alto ~1999€)
              if ((Platform.OS === 'android' || Platform.OS === 'ios') && p.clientRange === 20 && p.duracionMeses === 12) return false;
              // Filtrar por ciclo de facturación
              return p.isCoach && isCorrectCycle;
            } else {
              // Athlete: Show all
              return !p.isCoach;
            }
          })
            .sort((a, b) => a.precioActual - b.precioActual)
            .map((plan, index) => {
              // LOGIC TO DETERMINE STYLE
              // We want Middle One to be "PRO" style (Coach view)
              // If Coach: Index 0=Start, Index 1=Pro (Highlighted), Index 2=Club

              // Map index to style type
              let cardType = 'standard'; // 'standard', 'pro', 'club'
              let isHighlighted = false;

              if (userType === 'coach') {
                if (index === 0) cardType = 'start';
                if (index === 1) { cardType = 'pro'; isHighlighted = true; } // The middle one
                if (index >= 2) cardType = 'club';
              } else {
                // Athlete
                cardType = index === 0 ? 'start' : 'pro';
                // Maybe highlight the second one?
              }

              const isSelected = selectedPlan?.id === plan.id;
              const isAnnual = plan.duracionMeses > 1;

              return (
                <Pressable
                  key={plan.id}
                  onPress={() => setSelectedPlan(plan)}
                  style={[
                    styles.cardBase,
                    cardType === 'pro' && styles.cardPro, // Scale up slightly?
                    isSelected && styles.cardSelectedBorder
                  ]}
                >
                  {/* Background: Gradient for PRO, Dark for others */}
                  {cardType === 'pro' ? (
                    <LinearGradient
                      colors={['#FF9C65', '#FFD036']} // Orange to Yellow gradient
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2E3246', opacity: 0.6 }]} />
                    // Dark blueish distinct from bg
                  )}

                  {/* Badge RECOMMENDED (only Pro) */}
                  {cardType === 'pro' && (
                    <View style={styles.badgeRecommended}>
                      <Text style={styles.badgeRecText}>RECOMENDADO</Text>
                    </View>
                  )}

                  <View style={styles.cardContentPadding}>
                    {/* Header: Title & Subtitle */}
                    <Text style={[styles.cardTitleRef, cardType === 'pro' ? { color: '#000' } : { color: '#FFF' }]}>
                      {userType === 'coach'
                        ? (index === 0 ? 'START' : index === 1 ? 'PRO' : 'CLUB / ELITE')
                        : plan.nombre}
                    </Text>
                    <Text style={[styles.cardSubtitleRef, cardType === 'pro' ? { color: '#1F2937' } : { color: '#9CA3AF' }]}>
                      {userType === 'coach'
                        ? (index === 0 ? 'Para probar la IA sin miedo.' : index === 1 ? 'Para entrenadores que valoran su tiempo.' : 'Para escalar sin límites.')
                        : plan.descripcion}
                    </Text>

                    {/* Price */}
                    <View style={styles.priceRowRef}>
                      <Text style={[styles.currencyRef, cardType === 'pro' ? { color: '#000' } : { color: '#7C3AED' }]}>
                        {plan.moneda === 'EUR' ? '€' : '$'}
                      </Text>
                      <Text style={[styles.priceValRef, cardType === 'pro' ? { color: '#000' } : { color: '#7C3AED' }]}>
                        {Platform.OS === 'ios' ? Math.round(plan.precioActual) : Math.floor(plan.precioActual)}
                      </Text>
                      {/* En iOS no mostrar decimales (Apple no permite .90) */}
                      {Platform.OS !== 'ios' && (
                        <Text style={[styles.priceDecimalsRef, cardType === 'pro' ? { color: '#000' } : { color: '#7C3AED' }]}>
                          {(plan.precioActual % 1).toFixed(2).substring(1)}
                        </Text>
                      )}
                      <Text style={[styles.perMonthRef, cardType === 'pro' ? { color: '#1F2937' } : { color: '#9CA3AF' }]}>
                        /mes
                      </Text>
                    </View>
                    {/* Annual tag if applies */}
                    {isAnnual && (
                      <Text style={{ fontSize: 10, color: cardType === 'pro' ? '#000' : '#FFF', opacity: 0.7 }}>
                      </Text>
                    )}

                    <View style={[styles.dividerRef, cardType === 'pro' ? { backgroundColor: 'rgba(0,0,0,0.1)' } : { backgroundColor: 'rgba(255,255,255,0.1)' }]} />

                    {/* Features List */}
                    <View style={styles.featuresContainerRef}>
                      {/* Custom Features mapping based on type */}
                      {(() => {
                        let features = [];
                        if (userType === 'coach') {
                          if (index === 0) {
                            features = [
                              'Hasta 25 Atletas',
                              'Suite Completa + IA Ilimitada (Dietas, Entrenos, Chat)',
                              'App para tus Clientes (iOS/Android)',
                              'Soporte Estándar (Email en < 48h)'
                            ];
                          } else if (index === 1) {
                            features = [
                              'Hasta 100 Atletas',
                              'Todo lo del Plan Starter',
                              'Facturación & Finanzas (Automatizadas)',
                              'Soporte Prioritario (Respuesta en < 24h)'
                            ];
                          } else {
                            features = [
                              'Atletas ILIMITADOS',
                              'Migración de Datos INCLUIDA\n"Mándanos tus Excel y nosotros te subimos a todos tus clientes."',
                              'Prioridad en Nuevas Funciones\n"Lo que tú pidas, lo desarrollamos antes."',
                              'Soporte VIP Dedicado'
                            ];
                          }
                        } else {
                          features = COMMON_BENEFITS;
                        }

                        return features.map((feat, i) => (
                          <View key={i} style={styles.featRowRef}>
                            <Ionicons name="checkmark-sharp" size={18} color={cardType === 'pro' ? '#000' : '#10B981'} style={{ marginTop: 2 }} />
                            <Text style={[
                              styles.featTextRef,
                              cardType === 'pro' ? { color: '#1F2937' } : { color: '#D1D5DB' },
                              i === 0 && userType === 'coach' && { fontWeight: '900', fontSize: 16, marginBottom: 4 } // First item bold/giant for coach
                            ]}>
                              {feat}
                            </Text>
                          </View>
                        ));
                      })()}

                      {/* Example Cross item for Start */}
                      {cardType === 'start' && userType === 'coach' && (
                        <View style={styles.featRowRef}>
                          <Ionicons name="close-sharp" size={18} color="#EF4444" style={{ marginTop: 2 }} />
                          <Text style={[styles.featTextRef, { color: '#6B7280' }]}>Sin soporte prioritario</Text>
                        </View>
                      )}
                    </View>

                    {/* Spacer */}
                    <View style={{ flex: 1 }} />

                    {/* Button */}
                    <Pressable
                      onPress={() => setSelectedPlan(plan)}
                      style={[
                        styles.btnRef,
                        isSelected && { opacity: 1 }, // Always active logic
                        cardType === 'pro' ? { backgroundColor: '#1F2937' } : { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#7C3AED' }
                      ]}
                    >
                      {/* Gradient for PRO Select ? No, image shows dark button */}
                      {cardType !== 'pro' && cardType !== 'start' ? (
                        // CLUB button in image is purple gradient
                        <LinearGradient colors={['#7C3AED', '#6D28D9']} style={StyleSheet.absoluteFill} />
                      ) : null}

                      <Text style={[styles.btnTextRef, cardType === 'pro' ? { color: '#FFF' } : { color: '#FFF' }]}>
                        {cardType === 'start' ? 'Empezar Gratis' : 'Seleccionar'}
                      </Text>
                    </Pressable>

                  </View>
                </Pressable>
              );
            })}
        </View>

        {/* SECCIÓN 5: MÉTODOS DE PAGO - Por plataforma */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionHeader}>Método de pago</Text>

          <View style={styles.methodsRow}>
            {/* WEB: Solo Stripe y PayPal */}
            {Platform.OS === 'web' && (
              <>
                <Pressable
                  onPress={() => setPaymentMethod('stripe')}
                  style={[styles.methodBadge, paymentMethod === 'stripe' && styles.methodBadgeActive]}
                >
                  <Ionicons
                    name="card-outline"
                    size={20}
                    color={paymentMethod === 'stripe' ? '#FFF' : '#94A3B8'}
                  />
                  <Text style={[styles.methodText, paymentMethod === 'stripe' && styles.methodTextActive]}>
                    Tarjeta
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setPaymentMethod('paypal')}
                  style={[styles.methodBadge, paymentMethod === 'paypal' && styles.methodBadgeActive]}
                >
                  <Ionicons
                    name="logo-paypal"
                    size={20}
                    color={paymentMethod === 'paypal' ? '#FFF' : '#94A3B8'}
                  />
                  <Text style={[styles.methodText, paymentMethod === 'paypal' && styles.methodTextActive]}>
                    PayPal
                  </Text>
                </Pressable>
              </>
            )}

            {/* ANDROID: Solo Google Play Billing */}
            {Platform.OS === 'android' && (
              <Pressable
                onPress={() => setPaymentMethod('googlepay')}
                style={[styles.methodBadge, styles.methodBadgeActive]}
              >
                <Ionicons
                  name="logo-google"
                  size={20}
                  color="#FFF"
                />
                <Text style={[styles.methodText, styles.methodTextActive]}>
                  Google Play
                </Text>
              </Pressable>
            )}

            {/* iOS: In-App Purchase (NO usar marca Apple Pay - Guideline 1.1.6) */}
            {Platform.OS === 'ios' && (
              <Pressable
                onPress={() => setPaymentMethod('applepay')}
                style={[styles.methodBadge, styles.methodBadgeActive]}
              >
                <Ionicons
                  name="card-outline"
                  size={20}
                  color="#FFF"
                />
                <Text style={[styles.methodText, styles.methodTextActive]}>
                  Suscribirse
                </Text>
              </Pressable>
            )}
          </View>

          {/* Formulario de tarjeta (solo si Stripe está seleccionado) */}
          {paymentMethod === 'stripe' && (
            <View style={{ marginTop: 16, padding: 16, backgroundColor: '#334155', borderRadius: 12 }}>
              <Text style={{ color: '#F8FAFC', textAlign: 'center' }}>
                Al pulsar "Pagar", se abrirá la pasarela segura de Stripe.
              </Text>
            </View>
          )}
        </View>

        {/* SECCIÓN 6: RESUMEN Y PAGO */}
        <View style={styles.summaryContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
            <Text style={styles.totalVal}>
              {selectedPlan?.moneda === 'EUR' ? '€' : '$'}{Platform.OS === 'ios' ? Math.round(total) : total.toFixed(2)}
            </Text>
          </View>
          <Text style={styles.taxIncludedText}>Impuestos incluidos</Text>

          <Pressable
            onPress={async () => {
              if (paymentMethod === 'stripe') {
                setLoading(true);
                try {
                  // 1. Crear Intent (Suscripción)
                  const response = await fetch(`${API_URL}/api/payments/stripe/create-intent`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify({
                      amount: selectedPlan.price,
                      currency: 'eur',
                      planId: selectedPlan.id
                    })
                  });

                  const data = await response.json();

                  if (!data.success) {
                    Alert.alert('Error', data.error?.message || 'No se pudo iniciar el pago');
                    setLoading(false);
                    return;
                  }

                  const { clientSecret, paymentIntentId, subscriptionId } = data;
                  console.log('[Payment] Intent creado:', paymentIntentId, 'Suscripción:', subscriptionId);

                  // 2. Inicializar Sheet
                  const { error: initError } = await initPaymentSheet({
                    merchantDisplayName: 'TotalGains',
                    paymentIntentClientSecret: clientSecret,
                    defaultBillingDetails: {
                      name: user?.nombre || '',
                      email: user?.email || '',
                    },
                    returnURL: 'totalgains://stripe-redirect',
                    customFlow: false,
                  });

                  if (initError) throw new Error(initError.message);

                  // 3. Presentar Sheet
                  const presentResult = await presentPaymentSheet();

                  // En WEB: detectar señal de redirección a Stripe Checkout
                  if (presentResult.useWebRedirect || presentResult.error?.code === 'WebRedirect') {
                    console.log('[Payment Web] Detectada web, redirigiendo a Stripe Checkout...');

                    // Llamar al endpoint de Checkout Session
                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://totalgains.es';
                    const checkoutResponse = await fetch(`${API_URL}/api/payments/stripe/create-checkout-session`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                      },
                      body: JSON.stringify({
                        planId: selectedPlan.id,
                        successUrl: `${baseUrl}/app/payment?success=true&session_id={CHECKOUT_SESSION_ID}`,
                        cancelUrl: `${baseUrl}/app/payment?canceled=true`
                      })
                    });

                    const checkoutData = await checkoutResponse.json();

                    if (checkoutData.success && checkoutData.url) {
                      console.log('[Payment Web] Redirigiendo a:', checkoutData.url);
                      window.location.href = checkoutData.url;
                      return; // Mantener loading mientras redirige
                    } else {
                      throw new Error(checkoutData.error?.message || 'Error al crear sesión de pago');
                    }
                  }

                  if (presentResult.error) {
                    // El usuario canceló o hubo error (en nativo)
                    if (presentResult.error.code !== 'Canceled') {
                      Alert.alert('Error', presentResult.error.message);
                    }
                  } else {
                    // 4. Confirmar en Backend (solo para flujo nativo)
                    const confirmRes = await fetch(`${API_URL}/api/payments/stripe/confirm/${paymentIntentId}`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                      },
                      body: JSON.stringify({ planId: selectedPlan.id })
                    });

                    const confirmData = await confirmRes.json();

                    if (confirmData.success) {
                      // Refrescar datos del usuario para actualizar estado a PREMIUM
                      if (refreshUser) {
                        await refreshUser(true);
                      }

                      Alert.alert(
                        '¡Bienvenido al Team! 🚀',
                        `Suscripción ${selectedPlan.nombre} activada correctamente.`,
                        [{ text: 'Empezar a Entrenar', onPress: () => router.back() }]
                      );
                    } else {
                      Alert.alert('Atención', 'El pago se realizó pero hubo un problema activando la suscripción. Contáctanos.');
                    }
                  }
                } catch (e) {
                  console.error(e);
                  Alert.alert('Error', e.message || 'Error desconocido');
                } finally {
                  setLoading(false);
                }
              } else if (paymentMethod === 'googlepay') {
                // Google Play Billing con expo-iap
                setLoading(true);
                try {
                  // 1. Iniciar conexión con Google Play
                  console.log('[GooglePlay] Iniciando flujo de compra...');
                  const connected = await IAPService.initConnection();
                  if (!connected) {
                    throw new Error('No se pudo conectar con Google Play');
                  }

                  // 2. Obtener el Product ID de Google Play para este plan
                  const googleProductId = getGoogleProductIdFromPlan(selectedPlan);
                  console.log('[GooglePlay] Product ID:', googleProductId);

                  if (!googleProductId) {
                    throw new Error('Este plan no tiene un Product ID de Google Play configurado');
                  }

                  // 3. Obtener la suscripción desde la tienda
                  let subscriptions = [];
                  let offerToken = null;

                  try {
                    subscriptions = await IAPService.getSubscriptions([googleProductId]);
                    console.log('[GooglePlay] Productos encontrados:', subscriptions?.length || 0);

                    if (subscriptions && subscriptions.length > 0) {
                      const subscription = subscriptions[0];
                      // En Android Billing v5+, necesitamos el offerToken
                      if (subscription.subscriptionOfferDetails && subscription.subscriptionOfferDetails.length > 0) {
                        offerToken = subscription.subscriptionOfferDetails[0].offerToken;
                      }
                    }
                  } catch (fetchError) {
                    console.warn('[GooglePlay] Error obteniendo producto:', fetchError.message);
                  }

                  // 4. Verificar que encontramos el producto
                  if (!subscriptions || subscriptions.length === 0) {
                    throw new Error(
                      `El producto "${googleProductId}" no está disponible en Google Play. ` +
                      'Contacta con soporte si el problema persiste.'
                    );
                  }

                  // 5. Iniciar la compra
                  console.log('[GooglePlay] Iniciando compra...');
                  const purchase = await IAPService.purchaseSubscription(googleProductId, offerToken);
                  console.log('[GooglePlay] Compra completada:', purchase);

                  // 6. Verificar el recibo en nuestro backend
                  const verifyResponse = await fetch(`${API_URL}/api/payments/google/verify-purchase`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify({
                      purchaseToken: purchase.purchaseToken,
                      productId: googleProductId,
                      planId: selectedPlan.id
                    })
                  });

                  const verifyData = await verifyResponse.json();
                  console.log('[GooglePlay] Verificación backend:', verifyData);

                  if (verifyData.success) {
                    // 7. Acknowledge la compra (requerido en Android)
                    await IAPService.acknowledgePurchase(purchase.purchaseToken);
                    await IAPService.finishTransaction(purchase);

                    // 8. Refrescar usuario
                    if (refreshUser) await refreshUser(true);

                    Alert.alert(
                      '¡Bienvenido al Team! 🚀',
                      `Suscripción ${selectedPlan.nombre} activada correctamente.`,
                      [{ text: 'Empezar a Entrenar', onPress: () => router.replace('/home') }]
                    );
                  } else {
                    throw new Error(verifyData.message || 'Error verificando la compra');
                  }

                } catch (error) {
                  console.error('[GooglePlay] Error:', error);

                  // Manejar errores específicos de IAP
                  if (error.code === 'E_USER_CANCELLED') {
                    Alert.alert('Compra cancelada', 'Has cancelado la compra.');
                  } else if (error.code === 'E_ITEM_UNAVAILABLE') {
                    Alert.alert(
                      'Producto no disponible',
                      'Este producto no está disponible en Google Play. Contacta con soporte.'
                    );
                  } else {
                    Alert.alert('Error', error.message || 'Error al procesar el pago');
                  }
                } finally {
                  setLoading(false);
                  await IAPService.endConnection();
                }
              } else if (paymentMethod === 'applepay') {
                // ═══════════════════════════════════════════════════════════════
                // APPLE IN-APP PURCHASE - StoreKit 2 con expo-iap
                // ═══════════════════════════════════════════════════════════════
                setLoading(true);
                try {
                  // 1. Conectar con App Store
                  console.log('[ApplePay] Iniciando conexión con App Store...');
                  const connected = await IAPService.initConnection();
                  if (!connected) {
                    Alert.alert(
                      'Conexión no disponible',
                      'No se pudo conectar con App Store. Por favor verifica tu conexión a internet e inténtalo de nuevo.',
                      [{ text: 'Entendido' }]
                    );
                    setLoading(false);
                    return;
                  }

                  // 2. Obtener Product ID de Apple
                  const appleProductId = getAppleProductIdFromPlan(selectedPlan);
                  console.log('[ApplePay] Product ID:', appleProductId);
                  if (!appleProductId) {
                    Alert.alert(
                      'Plan no disponible',
                      'Este plan no está disponible para compra en App Store en este momento.',
                      [{ text: 'Entendido' }]
                    );
                    setLoading(false);
                    return;
                  }

                  // 3. Verificar que el producto existe en App Store
                  const subscriptions = await IAPService.getSubscriptions([appleProductId]);
                  console.log('[ApplePay] Suscripciones disponibles:', subscriptions?.length || 0);
                  if (!subscriptions || subscriptions.length === 0) {
                    Alert.alert(
                      'Suscripción en proceso',
                      'Las suscripciones están siendo procesadas por App Store. Por favor intenta de nuevo en unos minutos.\n\nSi el problema persiste, contacta con soporte.',
                      [{ text: 'Entendido' }]
                    );
                    setLoading(false);
                    await IAPService.endConnection();
                    return;
                  }

                  // 4. Iniciar compra
                  console.log('[ApplePay] Iniciando flujo de compra...');
                  const purchase = await IAPService.purchaseSubscription(appleProductId);

                  // 5. Logging detallado del objeto purchase para debug
                  console.log('[ApplePay] ═══════════════════════════════════════');
                  console.log('[ApplePay] Compra completada. Objeto purchase:');
                  console.log('[ApplePay] - transactionId:', purchase?.transactionId);
                  console.log('[ApplePay] - productId:', purchase?.productId);
                  console.log('[ApplePay] - jwsRepresentationIos:', purchase?.jwsRepresentationIos ? 'PRESENTE (' + purchase.jwsRepresentationIos.length + ' chars)' : 'UNDEFINED');
                  console.log('[ApplePay] - transactionReceipt:', purchase?.transactionReceipt ? 'PRESENTE (' + purchase.transactionReceipt.length + ' chars)' : 'UNDEFINED');
                  console.log('[ApplePay] ═══════════════════════════════════════');

                  // 6. Validar datos de compra - StoreKit 2 usa jwsRepresentationIos
                  const jwsToken = purchase?.jwsRepresentationIos;
                  const legacyReceipt = purchase?.transactionReceipt;
                  const transactionId = purchase?.transactionId;

                  if (!jwsToken && !legacyReceipt) {
                    console.error('[ApplePay] ERROR: No hay ni jwsRepresentationIos ni transactionReceipt');
                    Alert.alert(
                      'Error en la compra',
                      'No se pudo obtener la confirmación de la compra. Si se realizó un cobro, contacta con soporte para verificar tu suscripción.',
                      [{ text: 'Entendido' }]
                    );
                    setLoading(false);
                    await IAPService.endConnection();
                    return;
                  }

                  // 7. Enviar al backend con campos SEPARADOS y claros
                  console.log('[ApplePay] Enviando a backend para verificación...');
                  const verifyPayload = {
                    // StoreKit 2 (preferente)
                    jwsToken: jwsToken || null,
                    // Legacy (fallback)
                    receiptData: legacyReceipt || null,
                    // Metadatos
                    transactionId: transactionId || null,
                    productId: appleProductId,
                    planId: selectedPlan.id
                  };
                  console.log('[ApplePay] Payload:', JSON.stringify({
                    hasJwsToken: !!verifyPayload.jwsToken,
                    hasReceiptData: !!verifyPayload.receiptData,
                    transactionId: verifyPayload.transactionId,
                    productId: verifyPayload.productId,
                    planId: verifyPayload.planId
                  }));

                  const verifyResponse = await fetch(`${API_URL}/api/payments/apple/verify-purchase`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify(verifyPayload)
                  });

                  const verifyData = await verifyResponse.json();
                  console.log('[ApplePay] Respuesta backend:', verifyResponse.status, verifyData);

                  // 8. Procesar respuesta
                  if (verifyData.success) {
                    await IAPService.finishTransaction(purchase);
                    if (refreshUser) await refreshUser(true);
                    Alert.alert(
                      '¡Bienvenido al Team! 🚀',
                      `Suscripción ${selectedPlan.nombre} activada.`,
                      [{ text: 'Empezar a Entrenar', onPress: () => router.replace('/home') }]
                    );
                  } else {
                    console.error('[ApplePay] Backend rechazó verificación:', verifyData.message || verifyData.error);
                    Alert.alert(
                      'Verificación pendiente',
                      'Tu compra está siendo procesada. Si no ves tu suscripción activa en unos minutos, contacta con soporte.',
                      [{ text: 'Entendido' }]
                    );
                  }
                } catch (error) {
                  console.error('[ApplePay] Error completo:', error);
                  console.error('[ApplePay] Error code:', error.code);
                  console.error('[ApplePay] Error message:', error.message);

                  // ═══════════════════════════════════════════════════════════════
                  // Manejo EXHAUSTIVO de estados - Evitar modal rojo genérico
                  // ═══════════════════════════════════════════════════════════════

                  const errorCode = error.code || '';
                  const errorMsg = (error.message || '').toLowerCase();

                  // 1. CANCELACIÓN - No es error, es acción del usuario
                  if (errorCode === 'E_USER_CANCELLED' || errorMsg.includes('cancel')) {
                    console.log('[ApplePay] Usuario canceló la compra (comportamiento normal)');
                    Alert.alert('Compra cancelada', 'Has cancelado la compra. Puedes intentarlo cuando quieras.');

                    // 2. PRODUCTO NO DISPONIBLE (IAP en revisión, región, etc.)
                  } else if (errorCode === 'E_ITEM_UNAVAILABLE' || errorMsg.includes('unavailable') || errorMsg.includes('not found')) {
                    Alert.alert(
                      'Suscripción no disponible',
                      'Este producto no está disponible en tu región o está siendo procesado. Intenta más tarde.',
                      [{ text: 'Entendido' }]
                    );

                    // 3. ERROR DE RED
                  } else if (errorCode === 'E_NETWORK_ERROR' || errorMsg.includes('network') || errorMsg.includes('internet') || errorMsg.includes('connection')) {
                    Alert.alert(
                      'Sin conexión',
                      'Verifica tu conexión a internet e inténtalo de nuevo.',
                      [{ text: 'Reintentar' }]
                    );

                    // 4. YA TIENE LA SUSCRIPCIÓN
                  } else if (errorCode === 'E_ALREADY_OWNED' || errorMsg.includes('already') || errorMsg.includes('owned')) {
                    Alert.alert(
                      'Ya tienes esta suscripción',
                      'Si no la ves activa, usa "Restaurar compras" en Ajustes o contacta soporte.',
                      [{ text: 'Entendido' }]
                    );

                    // 5. PAGO DIFERIDO (Ask to Buy / Control Parental)
                  } else if (errorCode === 'E_DEFERRED_PAYMENT' || errorCode === 'E_DEFERRED' || errorMsg.includes('deferred') || errorMsg.includes('pending')) {
                    Alert.alert(
                      'Aprobación pendiente',
                      'Tu compra requiere aprobación. Recibirás una notificación cuando se complete.',
                      [{ text: 'Entendido' }]
                    );

                    // 6. USUARIO NO LOGUEADO EN APPLE ID
                  } else if (errorCode === 'E_NOT_LOGGED_IN' || errorCode === 'E_SERVICE_ERROR' || errorMsg.includes('sign in') || errorMsg.includes('log in') || errorMsg.includes('apple id')) {
                    Alert.alert(
                      'Inicia sesión en App Store',
                      'Para realizar compras, inicia sesión con tu Apple ID en Ajustes > App Store.',
                      [{ text: 'Entendido' }]
                    );

                    // 7. COMPRAS NO PERMITIDAS (Restricciones del dispositivo)
                  } else if (errorCode === 'E_BILLING_UNAVAILABLE' || errorMsg.includes('not allowed') || errorMsg.includes('restricted') || errorMsg.includes('disabled')) {
                    Alert.alert(
                      'Compras no permitidas',
                      'Las compras dentro de la app están desactivadas en este dispositivo. Revisa Ajustes > Tiempo de uso > Restricciones.',
                      [{ text: 'Entendido' }]
                    );

                    // 8. STOREFRONT / REGIÓN DIFERENTE
                  } else if (errorCode === 'E_STOREFRONT_MISMATCH' || errorMsg.includes('storefront') || errorMsg.includes('country') || errorMsg.includes('region')) {
                    Alert.alert(
                      'Región no compatible',
                      'Tu cuenta de App Store está en una región donde este producto no está disponible.',
                      [{ text: 'Entendido' }]
                    );

                    // 9. SUSCRIPCIÓN EXPIRADA O INVÁLIDA
                  } else if (errorMsg.includes('expired') || errorMsg.includes('invalid') || errorMsg.includes('receipt')) {
                    Alert.alert(
                      'Error de verificación',
                      'Hubo un problema verificando tu compra. Si se realizó el cobro, contacta soporte.',
                      [{ text: 'Entendido' }]
                    );

                    // 10. FALLBACK GENÉRICO (último recurso)
                  } else {
                    console.warn('[ApplePay] Error no manejado específicamente:', errorCode, errorMsg);
                    Alert.alert(
                      'No se pudo completar',
                      'Hubo un problema con la compra. Por favor intenta de nuevo.',
                      [{ text: 'Reintentar' }]
                    );
                  }
                } finally {
                  setLoading(false);
                  await IAPService.endConnection();
                }
              } else {
                handlePay();
              }
            }}
            disabled={loading}
            style={({ pressed }) => [
              styles.payButton,
              (loading || pressed) && styles.payButtonDim
            ]}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.payButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.payButtonText}>¡SUBE AL SIGUIENTE NIVEL!</Text>
              )}
            </LinearGradient>
          </Pressable>

          <View style={styles.secureBadge}>
            <Ionicons name="lock-closed" size={12} color="#94A3B8" />
            <Text style={styles.secureText}>Pagos procesados de forma segura</Text>
          </View>
        </View>

        {/* SECCIÓN 7: CONTACTO */}
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>¿Dudas o Soporte? Escríbeme</Text>
          <Pressable onPress={() => Linking.openURL('mailto:titogeremitocoach@gmail.com')}>
            <Text style={styles.contactEmail}>titogeremitocoach@gmail.com</Text>
          </Pressable>
        </View>

        {/* SECCIÓN 8: LEGAL LINKS - Términos y Privacidad (Guideline 3.1.2) */}
        <View style={styles.legalSection}>
          <Text style={styles.legalText}>
            Al suscribirte, aceptas nuestros términos de servicio y política de privacidad.
          </Text>
          <Pressable onPress={() => Linking.openURL('https://totalgains.es/terms')}>
            <Text style={styles.legalLink}>Consulta nuestros Términos y Condiciones aquí</Text>
          </Pressable>
          {Platform.OS === 'ios' && (
            <Pressable onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
              <Text style={styles.legalLink}>Terminos y condiciones de apple</Text>
            </Pressable>
          )}
          <Pressable onPress={() => Linking.openURL('https://totalgains.es/privacy')}>
            <Text style={styles.legalLink}>Consulta nuestra Política de Privacidad aquí</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView >

      {/* 🔄 Modal de sincronización de datos */}
      <SyncProgressModal
        visible={syncModal.visible}
        direction={syncModal.direction}
        isComplete={syncModal.isComplete}
        itemsSynced={syncModal.itemsSynced}
        onDismiss={() => setSyncModal(prev => ({ ...prev, visible: false }))}
      />
    </View >
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingBottom: 16
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  backButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  refreshButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },

  // 🏆 Premium Banner Styles
  premiumBanner: {
    marginTop: 0,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    overflow: 'hidden',
  },
  premiumBannerContent: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  premiumBannerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 10,
    letterSpacing: 2,
    textShadowColor: 'rgba(16, 185, 129, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  premiumBannerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
  },

  // Loading y Empty States
  loadingText: { color: '#FFF' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8
  },
  emptyText: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10
  },
  retryButtonText: { color: '#FFF', fontWeight: '700' },

  // PILL TOGGLE (User Type)
  pillContainer: { alignItems: 'center', marginBottom: 25 },
  pillBackground: {
    flexDirection: 'row',
    backgroundColor: '#373656', // Darker violet
    borderRadius: 30,
    padding: 4,
    height: 50,
    width: 280,
  },
  pillOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    overflow: 'hidden',
  },
  pillOptionActiveHidden: {
    // Just a placeholder to attach logic, real style in render with absolute fill
  },
  pillText: { color: '#94A3B8', fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: '#FFF', fontWeight: '700' },

  // BILLING SWITCH
  billingSwitchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 30 },
  billingLabel: { color: '#E2E8F0', fontSize: 14, fontWeight: '600' },
  billingLabelActive: { color: '#FFF' },
  switchTrack: { width: 50, height: 28, backgroundColor: '#4B5563', borderRadius: 20, padding: 2, justifyContent: 'center' },
  switchThumb: { width: 24, height: 24, backgroundColor: '#FFF', borderRadius: 12 },
  badgeFreeMonths: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 6 },
  badgeFreeText: { color: '#000', fontSize: 10, fontWeight: '800' },

  // HERO
  heroSection: { alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  heroSubtitle: { color: '#9CA3AF', fontSize: 14 },

  // PLANS ROW
  plansContainer: { paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  plansRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'stretch'
  },

  // CARDS REF DESIGN
  cardBase: {
    backgroundColor: '#23263a', // Fallback
    borderRadius: 20,
    width: Platform.OS === 'web' ? 300 : '100%',
    minHeight: 450,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardPro: {
    width: Platform.OS === 'web' ? 320 : '100%',
    transform: Platform.OS === 'web' ? [{ scale: 1.05 }] : [],
    zIndex: 10,
    borderColor: 'transparent', // Gradient handles border visually or fill
  },
  cardSelectedBorder: {
    borderColor: '#7C3AED',
    borderWidth: 2
  },

  cardContentPadding: { padding: 24, flex: 1 },

  badgeRecommended: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 20
  },
  badgeRecText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },

  cardTitleRef: { fontSize: 22, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
  cardSubtitleRef: { fontSize: 13, lineHeight: 18, marginBottom: 24 },

  // PRICE
  priceRowRef: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  currencyRef: { fontSize: 24, fontWeight: '600', marginTop: 4 },
  priceValRef: { fontSize: 56, fontWeight: '800', marginHorizontal: 2, letterSpacing: -2 },
  priceDecimalsRef: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  perMonthRef: { fontSize: 14, alignSelf: 'flex-end', marginBottom: 10, marginLeft: 4 },

  dividerRef: { height: 1, width: '100%', marginVertical: 20 },

  // FEATURES
  featuresContainerRef: { gap: 14 },
  featRowRef: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  featTextRef: { fontSize: 13, lineHeight: 18, flex: 1 },

  // BUTTON
  btnRef: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    width: '100%',
    overflow: 'hidden'
  },
  btnTextRef: { fontWeight: '700', fontSize: 14 },

  // COACHING HIGH TICKET (Legacy, kept for reference if needed elsewhere)
  coachingCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#FCD34D'
  },
  coachingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  coachingTitle: { color: '#000', fontSize: 16, fontWeight: '900', flex: 1 },
  coachingDesc: { color: '#1F2937', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  coachingButton: { backgroundColor: '#000', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  coachingBtnText: { color: '#FFD700', fontWeight: 'bold', fontSize: 14 },

  // MÉTODOS PAGO
  paymentSection: { paddingHorizontal: 20, marginBottom: 40 },
  sectionHeader: { color: '#FFF', fontWeight: '700', marginBottom: 12 },
  methodsRow: { flexDirection: 'row', gap: 12 },
  methodBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#373656', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  methodBadgeActive: { backgroundColor: '#2E2D4D', borderColor: '#7C3AED' },
  methodText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  methodTextActive: { color: '#FFF' },

  // RESUMEN
  summaryContainer: { backgroundColor: '#1E293B', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#334155', marginHorizontal: 20, marginBottom: 40 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  totalLabel: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  totalVal: { color: '#10B981', fontSize: 24, fontWeight: '800' },
  taxIncludedText: { color: '#64748B', fontSize: 11, textAlign: 'center', marginTop: -12, marginBottom: 16 },

  payButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  payButtonDim: { opacity: 0.7 },
  payButtonGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  payButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  secureBadge: { flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' },
  secureText: { color: '#64748B', fontSize: 12 },

  // CONTACTO
  contactSection: { alignItems: 'center', marginTop: 10, marginBottom: 40 },
  contactTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  contactEmail: { color: '#10B981', fontSize: 16, textDecorationLine: 'underline' },

  // LEGAL LINKS
  legalSection: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 40,
    paddingHorizontal: 20
  },
  legalText: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12
  },
  legalLink: {
    color: '#7C3AED',
    fontSize: 12,
    textDecorationLine: 'underline',
    marginBottom: 8
  }
});
