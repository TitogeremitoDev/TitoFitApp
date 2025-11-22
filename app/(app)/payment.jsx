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

// API URL
const API_URL = 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// BENEFICIOS COMUNES (estos se mantienen estáticos o también puedes cargarlos desde la API)
const COMMON_BENEFITS = [
  'Rutinas Premium actualizadas',
  'Tracking completo de progreso',
  'Biblioteca de videos y tips',
  'Soporte técnico 24/7',
  '1 Consulta mensual con Titogeremito'
];

// URL CUESTIONARIO HIGH TICKET
const COACHING_FORM_URL = 'https://docs.google.com/forms/d/1-KNo9I1GEeaoeIAegtyYoPG9BqaBAP5OmOvCllQ96Ck/edit';

export default function PaymentScreen() {
  const router = useRouter();
  
  // Estado para planes
  const [planes, setPlanes] = useState([]);
  const [loadingPlanes, setLoadingPlanes] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estado de UI
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [loading, setLoading] = useState(false);
  const [userToken, setUserToken] = useState(null);

  const [cardData, setCardData] = useState({
    number: '', expiry: '', cvc: '', name: ''
  });

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
        setPlanes(data.plans);
        
        // Seleccionar automáticamente el plan destacado o el primero
        const planDestacado = data.plans.find(p => p.destacado);
        setSelectedPlan(planDestacado || data.plans[0]);
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
        const token = await AsyncStorage.getItem('titofit_token');
        setUserToken(token);
      } catch (error) {
        console.error('Error token:', error);
      }
    })();
  }, []);

  useEffect(() => {
    cargarPlanes();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    cargarPlanes();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDACIÓN Y FORMATEO DE TARJETA
  // ═══════════════════════════════════════════════════════════════════════════
  
  const formatCardNumber = (text) => {
    const cleaned = text.replace(/\D/g, '').substring(0, 16);
    return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
  };

  const formatExpiry = (text) => {
    const cleaned = text.replace(/\D/g, '').substring(0, 4);
    return cleaned.length >= 2 ? `${cleaned.substring(0, 2)}/${cleaned.substring(2)}` : cleaned;
  };

  const validateCard = () => {
    const { number, expiry, cvc, name } = cardData;
    if (!name.trim()) { Alert.alert('Falta información', 'Ingresa el nombre del titular'); return false; }
    if (number.replace(/\s/g, '').length < 13) { Alert.alert('Tarjeta inválida', 'Revisa el número de la tarjeta'); return false; }
    const [m, y] = expiry.split('/');
    if (!m || !y || m > 12 || m < 1) { Alert.alert('Fecha inválida', 'Revisa la fecha de expiración'); return false; }
    if (cvc.length < 3) { Alert.alert('CVC inválido', 'Código de seguridad incompleto'); return false; }
    return true;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESAR PAGO
  // ═══════════════════════════════════════════════════════════════════════════
  
  const processPayment = async (endpoint, payload) => {
    setLoading(true);
    try {
      console.log(`[Payment] Procesando pago: ${endpoint}`);
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${userToken}` 
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          '¡Bienvenido al Team! 🚀',
          `Suscripción ${selectedPlan.nombre} activada correctamente.`,
          [{ text: 'Empezar a Entrenar', onPress: () => router.back() }]
        );
      } else {
        throw new Error(data.error?.message || 'Error procesando el pago');
      }
    } catch (error) {
      console.error('[Payment] Error:', error);
      Alert.alert('Error', error.message || 'No se pudo completar la transacción');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = () => {
    if (!userToken) {
      return Alert.alert('Acceso requerido', 'Inicia sesión para continuar');
    }

    if (!selectedPlan) {
      return Alert.alert('Selecciona un plan', 'Debes seleccionar un plan de suscripción');
    }
    
    if (paymentMethod === 'stripe') {
      if (!validateCard()) return;
      processPayment('/api/payments/stripe/create-intent', { 
        amount: selectedPlan.precioActual, 
        currency: selectedPlan.moneda.toLowerCase(), 
        planId: selectedPlan.id 
      });
    } else if (paymentMethod === 'paypal') {
      processPayment('/api/payments/paypal/create-order', {
        amount: selectedPlan.precioActual, 
        currency: selectedPlan.moneda, 
        planId: selectedPlan.id
      });
    } else {
      Alert.alert('Próximamente', 'Google Pay estará disponible en breve.');
    }
  };

  const openCoaching = () => {
    Linking.openURL(COACHING_FORM_URL).catch(err => console.error("Couldn't load page", err));
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
          <Pressable onPress={() => router.back()} style={styles.backButton}>
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
        <Pressable onPress={() => router.back()} style={styles.backButton}>
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
        
        {/* SECCIÓN 1: TITULO DE ALTO IMPACTO */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Desbloquea tu mejor versión</Text>
          <Text style={styles.heroSubtitle}>
            Elige el plan que se adapte a ti. Cancela cuando quieras.
          </Text>
        </View>

        {/* SECCIÓN 2: PLANES DINÁMICOS */}
        <View style={styles.plansContainer}>
          {planes.map((plan) => {
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
          <Text style={styles.benefitsTitle}>INCLUYE</Text>
          {COMMON_BENEFITS.map((benefit, idx) => (
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
            <View style={styles.cardForm}>
              <View style={styles.inputContainer}>
                <Ionicons name="card-outline" size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { paddingLeft: 40 }]}
                  placeholder="Número de tarjeta"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={cardData.number}
                  onChangeText={(t) => setCardData({...cardData, number: formatCardNumber(t)})}
                />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Nombre del titular"
                placeholderTextColor="#64748B"
                autoCapitalize="words"
                value={cardData.name}
                onChangeText={(t) => setCardData({...cardData, name: t})}
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, {flex: 1}]}
                  placeholder="MM/AA"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  maxLength={5}
                  value={cardData.expiry}
                  onChangeText={(t) => setCardData({...cardData, expiry: formatExpiry(t)})}
                />
                <TextInput
                  style={[styles.input, {flex: 1}]}
                  placeholder="CVC"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                  value={cardData.cvc}
                  onChangeText={(t) => setCardData({...cardData, cvc: t.replace(/\D/g, '')})}
                />
              </View>
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
            onPress={handlePay}
            disabled={loading}
            style={({pressed}) => [
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
                <Text style={styles.payButtonText}>CONFIRMAR SUSCRIPCIÓN</Text>
              )}
            </LinearGradient>
          </Pressable>
          
          <View style={styles.secureBadge}>
            <Ionicons name="lock-closed" size={12} color="#94A3B8" />
            <Text style={styles.secureText}>Pagos procesados de forma segura</Text>
          </View>
        </View>
        
        <View style={{height: 40}} />
      </ScrollView>
    </View>
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
  secureText: { color: '#64748B', fontSize: 12 }
});
