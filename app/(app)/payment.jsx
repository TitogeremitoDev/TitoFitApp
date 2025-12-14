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
  ScrollView,
  Pressable,
  TextInput,
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
import { useStripe } from '../../utils/stripeWrapper';
import SyncProgressModal from '../../components/SyncProgressModal';
import { syncLocalToCloud } from '../../src/lib/dataSyncService';

// API URL - Usa la variable de entorno
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// BENEFICIOS COMUNES (estos se mantienen estáticos o también puedes cargarlos desde la API)
const COMMON_BENEFITS = [
  'Rutinas Premium actualizadas',
  'Tracking completo de progreso',
  'Biblioteca de videos y tips',
  'Soporte técnico 24/7',
  '1 Consulta mensual con Titogeremito'
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

  const isPremium = user?.tipoUsuario === 'PREMIUM';

  const [planes, setPlanes] = useState([]);
  const [loadingPlanes, setLoadingPlanes] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estado de UI
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [loading, setLoading] = useState(false);
  const [userToken, setUserToken] = useState(null);
  const [userType, setUserType] = useState('athlete'); // 'athlete' | 'coach'
  const [coachClientCount, setCoachClientCount] = useState(5); // 5, 10, 20 clientes

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
    if (isPremium && userType !== 'coach') {
      console.log('[Payment] Force switching to coach because user is PREMIUM');
      setUserType('coach');
    }
  }, [isPremium, userType]); // Added userType to dependency to ensure it sticks

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
            // 🔄 FREE → PREMIUM: Subir datos locales antes de cambiar de plan
            const previousType = user?.tipoUsuario;
            if (previousType === 'FREEUSER') {
              setSyncModal({ visible: true, direction: 'upload', isComplete: false, itemsSynced: 0 });
              try {
                const syncResult = await syncLocalToCloud(token);
                setSyncModal(prev => ({ ...prev, isComplete: true, itemsSynced: syncResult?.itemsSynced || 0 }));
                // Esperar a que el modal se cierre
                await new Promise(resolve => setTimeout(resolve, 2000));
              } catch (syncErr) {
                console.warn('[Payment] Error sincronizando datos:', syncErr);
              }
              setSyncModal(prev => ({ ...prev, visible: false }));
            }
            if (refreshUser) await refreshUser();
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
            // 🔄 FREE → PREMIUM: Subir datos locales antes de cambiar de plan
            const previousType = user?.tipoUsuario;
            if (previousType === 'FREEUSER') {
              setSyncModal({ visible: true, direction: 'upload', isComplete: false, itemsSynced: 0 });
              try {
                const syncResult = await syncLocalToCloud(token);
                setSyncModal(prev => ({ ...prev, isComplete: true, itemsSynced: syncResult?.itemsSynced || 0 }));
                await new Promise(resolve => setTimeout(resolve, 2000));
              } catch (syncErr) {
                console.warn('[Payment] Error sincronizando datos:', syncErr);
              }
              setSyncModal(prev => ({ ...prev, visible: false }));
            }
            if (refreshUser) await refreshUser();
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
  }, [user]); // Recargar si cambia el usuario

  // Efecto para actualizar el plan seleccionado cuando cambia el número de clientes
  useEffect(() => {
    if (userType === 'coach' && planes.length > 0) {
      const filtered = planes.filter(p => p.isCoach && p.clientRange === coachClientCount);
      const planDestacado = filtered.find(p => p.destacado);
      setSelectedPlan(planDestacado || filtered[0]);
    }
  }, [coachClientCount, userType, planes]);

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
                          await refreshUser();
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
  const tax = subtotal * 0.21; // IVA 21%
  const total = subtotal + tax;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERIZADO
  // ═══════════════════════════════════════════════════════════════════════════

  if (loadingPlanes) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#0f172a']}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Cargando planes...</Text>
      </View>
    );
  }

  if (!planes || planes.length === 0) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#0f172a']}
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
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={StyleSheet.absoluteFill}
      />

      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Suscripción Premium</Text>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
      >

        {/* SECCIÓN 0: TOGGLE TIPO USUARIO */}
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>¿Qué eres?</Text>
          <View style={styles.toggleWrapper}>
            {!isPremium && (
              <Pressable
                style={[styles.toggleOption, userType === 'athlete' && styles.toggleOptionActive]}
                onPress={() => {
                  setUserType('athlete');
                  const filtered = planes.filter(p => !p.isCoach);
                  const planDestacado = filtered.find(p => p.destacado);
                  setSelectedPlan(planDestacado || filtered[0]);
                }}
              >
                <Text style={[styles.toggleText, userType === 'athlete' && styles.toggleTextActive]}>Atleta</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.toggleOption, userType === 'coach' && styles.toggleOptionActive]}
              onPress={() => {
                setUserType('coach');
                const filtered = planes.filter(p => p.isCoach && p.clientRange === coachClientCount);
                const planDestacado = filtered.find(p => p.destacado);
                setSelectedPlan(planDestacado || filtered[0]);
              }}
            >
              <Text style={[styles.toggleText, userType === 'coach' && styles.toggleTextActive]}>Entrenador</Text>
            </Pressable>
          </View>
        </View>

        {/* SECCIÓN 0.5: NÚMERO DE CLIENTES (solo para entrenadores) */}
        {userType === 'coach' && (
          <View style={styles.clientCountContainer}>
            <Text style={styles.clientCountLabel}>Número de clientes</Text>
            <View style={styles.clientCountOptions}>
              <Pressable
                style={[styles.clientCountOption, coachClientCount === 5 && styles.clientCountOptionActive]}
                onPress={() => setCoachClientCount(5)}
              >
                <View style={[styles.radioOuter, coachClientCount === 5 && styles.radioOuterSelected]}>
                  {coachClientCount === 5 && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.clientCountText, coachClientCount === 5 && styles.clientCountTextActive]}>5</Text>
              </Pressable>
              <Pressable
                style={[styles.clientCountOption, coachClientCount === 10 && styles.clientCountOptionActive]}
                onPress={() => setCoachClientCount(10)}
              >
                <View style={[styles.radioOuter, coachClientCount === 10 && styles.radioOuterSelected]}>
                  {coachClientCount === 10 && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.clientCountText, coachClientCount === 10 && styles.clientCountTextActive]}>10</Text>
              </Pressable>
              <Pressable
                style={[styles.clientCountOption, coachClientCount === 20 && styles.clientCountOptionActive]}
                onPress={() => setCoachClientCount(20)}
              >
                <View style={[styles.radioOuter, coachClientCount === 20 && styles.radioOuterSelected]}>
                  {coachClientCount === 20 && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.clientCountText, coachClientCount === 20 && styles.clientCountTextActive]}>20</Text>
              </Pressable>
            </View>
            <Text style={styles.clientCountHint}>
              ¿Necesitas un plan mayor? <Text style={styles.clientCountHintLink} onPress={openEmailContact}>Contáctame</Text>
            </Text>
          </View>
        )}

        {/* SECCIÓN 1: TITULO DE ALTO IMPACTO */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            {userType === 'coach' ? 'Potencia tu Negocio de Coaching' : 'Desbloquea tu mejor versión'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {userType === 'coach'
              ? 'Herramientas profesionales para escalar, automatizar y fidelizar a tus atletas.'
              : 'Elige el plan que se adapte a ti. Cancela cuando quieras.'}
          </Text>
        </View>

        {/* SECCIÓN 2: PLANES DINÁMICOS */}
        <View style={styles.plansContainer}>
          {planes.filter(p => {
            if (userType === 'coach') {
              return p.isCoach && p.clientRange === coachClientCount;
            } else {
              return !p.isCoach;
            }
          }).map((plan) => {
            const isSelected = selectedPlan?.id === plan.id;
            const tieneDescuento = plan.precioOriginal > plan.precioActual;

            return (
              <Pressable
                key={plan.id}
                onPress={() => setSelectedPlan(plan)}
                style={[
                  styles.planCard,
                  isSelected && styles.planCardSelected,
                  plan.destacado && styles.planCardDestacado
                ]}
              >
                {/* Badge destacado */}
                {plan.destacado && (
                  <View style={styles.badgePopular}>
                    <Text style={styles.badgeText}>MÁS POPULAR</Text>
                  </View>
                )}

                {/* Badge de oferta */}
                {plan.etiquetaOferta && (
                  <View style={styles.badgeOffer}>
                    <Text style={styles.badgeText}>{plan.etiquetaOferta}</Text>
                  </View>
                )}

                <View style={styles.planContent}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, isSelected && styles.textActive]}>
                      {plan.nombre}
                    </Text>
                    <Text style={styles.planDesc}>{plan.descripcion}</Text>

                    {/* Texto de ahorro */}
                    {plan.textoAhorro && (
                      <View style={styles.saveTag}>
                        <Text style={styles.saveTagText}>{plan.textoAhorro}</Text>
                      </View>
                    )}
                  </View>

                  {/* Precios */}
                  <View style={styles.priceBlock}>
                    {tieneDescuento && (
                      <Text style={styles.priceOld}>
                        {plan.moneda === 'EUR' ? '€' : '$'}{plan.precioOriginal.toFixed(2)}
                      </Text>
                    )}
                    <Text style={styles.priceNew}>
                      {plan.moneda === 'EUR' ? '€' : '$'}{plan.precioActual.toFixed(2)}
                    </Text>
                    <Text style={styles.pricePeriod}>
                      {plan.duracionMeses === 1 ? '/mes' : `/${plan.duracionMeses} meses`}
                    </Text>
                  </View>
                </View>

                {/* Radio button */}
                <View style={styles.radioContainer}>
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioLabel}>
                    {isSelected ? 'Plan seleccionado' : 'Seleccionar plan'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* SECCIÓN 3: BENEFICIOS */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>INCLUYE {userType === 'coach' ? '(MODO ENTRENADOR)' : ''}</Text>
          {(userType === 'coach' ? COACH_BENEFITS : COMMON_BENEFITS).map((benefit, idx) => (
            <View key={idx} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>

        {/* SECCIÓN 4: COACHING (HIGH TICKET UPSELL) */}
        <LinearGradient
          colors={['#FCD34D', '#F59E0B']}
          style={styles.coachingCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.coachingHeader}>
            <Text style={styles.coachingTitle}>
              🔥 ¿Quieres resultados garantizados?
            </Text>
          </View>
          <Text style={styles.coachingDesc}>
            Coaching personalizado 1:1 con seguimiento semanal, plan de nutrición y
            asesoramiento directo conmigo.
          </Text>
          <Pressable onPress={openCoaching} style={styles.coachingButton}>
            <Text style={styles.coachingBtnText}>CONSULTAR DISPONIBILIDAD</Text>
          </Pressable>
        </LinearGradient>

        {/* SECCIÓN 5: MÉTODOS DE PAGO */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionHeader}>Método de pago</Text>

          <View style={styles.methodsRow}>
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

            <Pressable
              onPress={() => setPaymentMethod('googlepay')}
              style={[styles.methodBadge, paymentMethod === 'googlepay' && styles.methodBadgeActive]}
            >
              <Ionicons
                name="logo-google"
                size={20}
                color={paymentMethod === 'googlepay' ? '#FFF' : '#94A3B8'}
              />
              <Text style={[styles.methodText, paymentMethod === 'googlepay' && styles.methodTextActive]}>
                Google Pay
              </Text>
            </Pressable>
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
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal ({selectedPlan?.nombre})</Text>
            <Text style={styles.summaryVal}>
              {selectedPlan?.moneda === 'EUR' ? '€' : '$'}{subtotal.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>IVA (21%)</Text>
            <Text style={styles.summaryVal}>
              {selectedPlan?.moneda === 'EUR' ? '€' : '$'}{tax.toFixed(2)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
            <Text style={styles.totalVal}>
              {selectedPlan?.moneda === 'EUR' ? '€' : '$'}{total.toFixed(2)}
            </Text>
          </View>

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
                        await refreshUser();
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
          <Text style={styles.contactTitle}>¿Quieres contactar conmigo?</Text>
          <Pressable onPress={() => Linking.openURL('mailto:titogeremitocoach@gmail.com')}>
            <Text style={styles.contactEmail}>titogeremitocoach@gmail.com</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingBottom: 15
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12
  },
  refreshButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600'
  },
  scrollView: { flex: 1 },
  content: { padding: 20 },

  // Loading y Empty States
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 14 },
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

  // HERO
  heroSection: { marginBottom: 25, alignItems: 'center' },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#F8FAFC', textAlign: 'center', marginBottom: 8 },
  heroSubtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

  // PLANES
  plansContainer: { gap: 16, marginBottom: 25 },
  planCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderWidth: 2,
  },
  planCardDestacado: {
    borderColor: '#10B981',
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5
  },
  badgePopular: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    zIndex: 10
  },
  badgeOffer: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: '#F43F5E',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    zIndex: 10
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  planContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  planName: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  textActive: { color: '#10B981' },
  planDesc: { color: '#94A3B8', fontSize: 12, marginBottom: 8 },

  saveTag: { backgroundColor: '#F59E0B', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  saveTagText: { color: '#000', fontSize: 10, fontWeight: '800' },

  priceBlock: { alignItems: 'flex-end' },
  priceOld: { color: '#64748B', textDecorationLine: 'line-through', fontSize: 13 },
  priceNew: { color: '#F8FAFC', fontSize: 26, fontWeight: '800' },
  pricePeriod: { color: '#94A3B8', fontSize: 12 },

  radioContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: '#10B981' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },
  radioLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },

  // BENEFICIOS
  benefitsCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, marginBottom: 25 },
  benefitsTitle: { color: '#64748B', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  benefitRow: { flexDirection: 'row', gap: 12, marginBottom: 10, alignItems: 'center' },
  benefitText: { color: '#E2E8F0', fontSize: 14 },

  // COACHING HIGH TICKET
  coachingCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#FCD34D'
  },
  coachingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  coachingTitle: { color: '#000', fontSize: 16, fontWeight: '900', flex: 1 },
  coachingDesc: { color: '#1F2937', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  coachingButton: { backgroundColor: '#000', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  coachingBtnText: { color: '#FFD700', fontWeight: 'bold', fontSize: 14 },

  // MÉTODOS PAGO
  paymentSection: { marginBottom: 25 },
  sectionHeader: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  methodsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  methodBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1E293B', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  methodBadgeActive: { backgroundColor: '#334155', borderColor: '#475569' },
  methodText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  methodTextActive: { color: '#FFF' },

  cardForm: { gap: 12 },
  inputContainer: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 12, top: 14, zIndex: 1 },
  input: { backgroundColor: '#1E293B', color: '#FFF', borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  row: { flexDirection: 'row', gap: 12 },

  // RESUMEN
  summaryContainer: { backgroundColor: '#1E293B', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { color: '#94A3B8', fontSize: 14 },
  summaryVal: { color: '#E2E8F0', fontSize: 14 },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  totalLabel: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  totalVal: { color: '#10B981', fontSize: 24, fontWeight: '800' },

  payButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  payButtonDim: { opacity: 0.7 },
  payButtonGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  payButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  secureBadge: { flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' },
  secureText: { color: '#64748B', fontSize: 12 },

  // TOGGLE
  toggleContainer: { alignItems: 'center', marginBottom: 20 },
  toggleLabel: { color: '#94A3B8', marginBottom: 8, fontSize: 14, fontWeight: '600' },
  toggleWrapper: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#334155' },
  toggleOption: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: 8 },
  toggleOptionActive: { backgroundColor: '#10B981' },
  toggleText: { color: '#94A3B8', fontWeight: '600' },
  toggleTextActive: { color: '#FFF' },

  // CONTACTO
  contactSection: { alignItems: 'center', marginTop: 20, marginBottom: 40 },
  contactTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  contactEmail: { color: '#10B981', fontSize: 16, textDecorationLine: 'underline' },

  // CLIENT COUNT (para entrenadores)
  clientCountContainer: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  clientCountLabel: { color: '#94A3B8', marginBottom: 12, fontSize: 14, fontWeight: '600' },
  clientCountOptions: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 20 },
  clientCountOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8
  },
  clientCountOptionActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10B981'
  },
  clientCountText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  clientCountTextActive: { color: '#10B981' },
  clientCountHint: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20
  },
  clientCountHintLink: {
    color: '#10B981',
    fontWeight: '600',
    textDecorationLine: 'underline'
  }
});
