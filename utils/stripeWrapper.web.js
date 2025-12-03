// utils/stripeWrapper.web.js
import React from 'react';

export function StripeProvider({ children }) {
  return <>{children}</>;
}

// Dummy hooks for web - Stripe payments are handled by native
export function useStripe() {
  return {
    initPaymentSheet: async () => ({ error: null }),
    presentPaymentSheet: async () => ({ error: null })
  };
}

export function usePlatformPay() {
  return {
    isPlatformPaySupported: async () => false,
    confirmPlatformPayPayment: async () => ({ error: null })
  };
}