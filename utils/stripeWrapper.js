// utils/stripeWrapper.js
import React from 'react';
import { StripeProvider as NativeStripeProvider, useStripe, usePlatformPay } from '@stripe/stripe-react-native';

export function StripeProvider({ children, publishableKey, merchantIdentifier }) {
  return (
    <NativeStripeProvider
      publishableKey={publishableKey}
      merchantIdentifier={merchantIdentifier}
    >
      {children}
    </NativeStripeProvider>
  );
}

// Re-export hooks
export { useStripe, usePlatformPay };