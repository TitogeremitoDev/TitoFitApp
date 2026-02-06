import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth, User } from './AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface SubscriptionData {
  daysRemaining?: number;
  status?: string;
  active?: boolean;
  expiresAt?: string;
  isCodeBased?: boolean;
  cancelAtPeriodEnd?: boolean;
  plan?: string;
  [key: string]: any;
}

interface SubscriptionContextType {
  subscriptionData: SubscriptionData | null;
  loadingSub: boolean;
  refreshSubscription: (force?: boolean) => Promise<SubscriptionData | null>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscriptionData: null,
  loadingSub: true,
  refreshSubscription: async () => null,
});

export const useSubscription = () => useContext(SubscriptionContext);

const SUBSCRIPTION_TTL = 5 * 60 * 1000; // 5 minutes

// Fallback when API returns no subscription but user has subscriptionExpiry
// (free codes, trial periods, etc.)
function buildFallback(user: User | null): SubscriptionData | null {
  if (!user?.subscriptionExpiry) return null;
  const expiryDate = new Date(user.subscriptionExpiry);
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return {
    daysRemaining: diffDays,
    status: diffDays <= 0 ? 'expired' : 'trial',
    active: diffDays > 0,
    expiresAt: user.subscriptionExpiry,
    isCodeBased: true,
  };
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const tokenRef = useRef(token);
  const lastFetchRef = useRef(0);
  const fetchingRef = useRef(false);

  const userRef = useRef(user);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { userRef.current = user; }, [user]);

  // Only fetch for users that might have a subscription
  const shouldFetch = !!token && !!user?.tipoUsuario && user.tipoUsuario !== 'FREEUSER';

  const fetchSubscription = useCallback(async (force?: boolean): Promise<SubscriptionData | null> => {
    const currentToken = tokenRef.current;
    if (!currentToken) return null;

    // TTL check
    const elapsed = Date.now() - lastFetchRef.current;
    if (!force && elapsed < SUBSCRIPTION_TTL && subscriptionData) {
      return subscriptionData;
    }

    // Prevent concurrent fetches
    if (fetchingRef.current) return subscriptionData;
    fetchingRef.current = true;

    try {
      const response = await fetch(`${API_URL}/api/subscription/status`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
      });
      const contentType = response.headers.get('content-type');
      if (!response.ok || !contentType?.includes('application/json')) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      lastFetchRef.current = Date.now();

      if (data.success && data.subscription) {
        setSubscriptionData(data.subscription);
        setLoadingSub(false);
        return data.subscription;
      }
      // Fallback: use subscriptionExpiry from user if no formal subscription
      const fallback = buildFallback(userRef.current);
      if (fallback) {
        setSubscriptionData(fallback);
        setLoadingSub(false);
        return fallback;
      }
      setLoadingSub(false);
      return null;
    } catch {
      // Fallback on error too
      const fallback = buildFallback(userRef.current);
      if (fallback && !subscriptionData) {
        setSubscriptionData(fallback);
      }
      setLoadingSub(false);
      return subscriptionData || fallback;
    } finally {
      fetchingRef.current = false;
    }
  }, [subscriptionData]);

  // Auto-fetch when user has a subscription-eligible type
  useEffect(() => {
    if (shouldFetch) {
      fetchSubscription();
    } else {
      setSubscriptionData(null);
      setLoadingSub(false);
      lastFetchRef.current = 0;
    }
  }, [user?.tipoUsuario, token]);

  // Reset cache when user type changes (e.g. upgrade)
  useEffect(() => {
    lastFetchRef.current = 0;
  }, [user?.tipoUsuario]);

  const value = useMemo(() => ({
    subscriptionData,
    loadingSub,
    refreshSubscription: fetchSubscription,
  }), [subscriptionData, loadingSub, fetchSubscription]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}
