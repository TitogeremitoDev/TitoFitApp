// utils/stripeWrapper.web.js
// Implementación de Stripe para Web - Usa redirección a Stripe Checkout
import React, { createContext, useContext, useRef, useCallback } from 'react';

// Contexto para compartir estado de Stripe
const StripeContext = createContext(null);

export function StripeProvider({ children }) {
  const paymentConfigRef = useRef(null);
  const resolveRef = useRef(null);

  // Para web, initPaymentSheet guarda la config y presentPaymentSheet 
  // devuelve un error especial que indica que debemos usar redirección
  const initPaymentSheet = useCallback(async (config) => {
    console.log('[StripeWeb] initPaymentSheet - guardando config para redirección');
    paymentConfigRef.current = config;
    return { error: null };
  }, []);

  const presentPaymentSheet = useCallback(async () => {
    console.log('[StripeWeb] presentPaymentSheet - indicando uso de redirección');

    // Devolver un código especial que indica que en web debemos usar redirección
    // El componente payment.jsx detectará esto y redirigirá a Stripe Checkout
    return {
      error: {
        code: 'WebRedirect',
        message: 'En web se debe usar Stripe Checkout redirect'
      },
      useWebRedirect: true
    };
  }, []);

  const value = {
    initPaymentSheet,
    presentPaymentSheet
  };

  return (
    <StripeContext.Provider value={value}>
      {children}
    </StripeContext.Provider>
  );
}

// Hook para usar Stripe
export function useStripe() {
  const context = useContext(StripeContext);

  if (!context) {
    console.warn('[StripeWeb] useStripe sin StripeProvider');
    return {
      initPaymentSheet: async () => ({ error: null }),
      presentPaymentSheet: async () => ({
        error: { code: 'WebRedirect', message: 'Usar redirección' },
        useWebRedirect: true
      })
    };
  }

  return context;
}

export function usePlatformPay() {
  return {
    isPlatformPaySupported: async () => false,
    confirmPlatformPayPayment: async () => ({ error: null })
  };
}
