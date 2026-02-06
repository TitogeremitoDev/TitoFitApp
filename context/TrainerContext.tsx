import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface Trainer {
  _id: string;
  nombre?: string;
  email?: string;
  logoUrl?: string;
  trainerCode?: string;
  [key: string]: any;
}

interface TrainerContextType {
  trainer: Trainer | null;
  refreshTrainer: (force?: boolean) => Promise<Trainer | null>;
}

const TrainerContext = createContext<TrainerContextType>({
  trainer: null,
  refreshTrainer: async () => null,
});

export const useTrainer = () => useContext(TrainerContext);

const TRAINER_TTL = 10 * 60 * 1000; // 10 minutes

export function TrainerProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const tokenRef = useRef(token);
  const lastFetchRef = useRef(0);
  const fetchingRef = useRef(false);

  useEffect(() => { tokenRef.current = token; }, [token]);

  const shouldFetchTrainer = user?.tipoUsuario === 'CLIENTE' ||
    (user?.tipoUsuario === 'ENTRENADOR' && !!user?.currentTrainerId);

  const fetchTrainer = useCallback(async (force?: boolean): Promise<Trainer | null> => {
    const currentToken = tokenRef.current;
    if (!currentToken) return null;

    // TTL check
    const elapsed = Date.now() - lastFetchRef.current;
    if (!force && elapsed < TRAINER_TTL && trainer) {
      return trainer;
    }

    // Prevent concurrent fetches
    if (fetchingRef.current) return trainer;
    fetchingRef.current = true;

    try {
      const response = await fetch(`${API_URL}/api/clients/my-trainer`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      const data = await response.json();
      lastFetchRef.current = Date.now();

      if (data.success && data.trainer) {
        setTrainer(data.trainer);
        return data.trainer;
      }
      return null;
    } catch {
      return trainer;
    } finally {
      fetchingRef.current = false;
    }
  }, [trainer]);

  // Auto-fetch when user has a trainer
  useEffect(() => {
    if (shouldFetchTrainer && token) {
      fetchTrainer();
    } else {
      setTrainer(null);
      lastFetchRef.current = 0;
    }
  }, [user?.currentTrainerId, token]);

  // Invalidate cache when trainer changes
  useEffect(() => {
    lastFetchRef.current = 0;
  }, [user?.currentTrainerId]);

  const value = useMemo(() => ({
    trainer,
    refreshTrainer: fetchTrainer,
  }), [trainer, fetchTrainer]);

  return (
    <TrainerContext.Provider value={value}>
      {children}
    </TrainerContext.Provider>
  );
}
