// context/AuthContext.tsx
import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncRoutinesFromServer } from '../src/lib/syncRoutines';
import { handlePlanTransition, getSyncDirection, SyncResult } from '../src/lib/dataSyncService';

const DEFAULT_KOYEB = 'https://consistent-donna-titogeremito-29c943bc.koyeb.app'; // 'http://localhost:3000';
const API_BASE = ((process.env.EXPO_PUBLIC_API_URL as string) || DEFAULT_KOYEB).replace(/\/+$/, '');
axios.defaults.baseURL = `${API_BASE}/api`;


const TOKEN_KEY = 'totalgains_token';
const USER_KEY = 'totalgains_user';

export type User = {
  _id: string;
  nombre: string;
  email: string;
  username: string;
  tipoUsuario: 'FREEUSER' | 'CLIENTE' | 'PREMIUM' | 'ADMINISTRADOR' | 'ENTRENADOR';
  token?: string;
  // Flag de onboarding completado
  onboardingCompleted?: boolean;
  // Campos de referidos
  referralCode?: string;
  subscriptionExpiry?: string;
  referralPremiumDays?: number;
  referredUsersCount?: number;
  // ⭐ AGREGAR ESTE CAMPO:
  avatarUrl?: string; // URL de la foto de perfil
  info_user?: {
    edad?: number;
    peso?: number;
    altura?: number;
    genero?: string;
    objetivos?: string;
    compromiso?: string;
    experiencia?: number;
    conocimientoTecnico?: number;
    tipoEntreno?: string;
    lesiones?: string;
    ejerciciosFavoritos?: string;
    ejerciciosEvitados?: string;
    cardio?: string;
    dieta?: string;
    comidasDia?: number;
    alergias?: string;
    cocina?: string;
  };
  // Campos de entrenador
  trainerProfile?: {
    bio?: string;
    specialties?: string[];
    pricePerMonth?: number;
    maxClients?: number;
    isAcceptingClients?: boolean;
    instagramHandle?: string;
    logoUrl?: string;
    brandName?: string;
    trainerCode?: string;
  };
  currentTrainerId?: string;
  // Factor de actividad para cálculos nutricionales
  af?: number;
  subscriptionStatus?: string;
  // Campos de coordinador/supervisor
  isCoordinator?: boolean;
  supervisorId?: string;
  pendingSupervisorInvite?: {
    from: string | null;
    sentAt: string | null;
  };
  overQuota?: {
    currentClients: number;
    maxClients: number;
    overBy: number;
    daysFrozen: number;
  };
};

type AuthContextData = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<User>;
  register: (nombre: string, email: string, username: string, password: string, clientCode?: string) => Promise<User>;
  upgradeByCode: (clientCode: string) => Promise<User>;
  loginWithGoogle: (googleAccessToken: string) => Promise<User>;
  loginWithApple: (identityToken: string, fullName?: { givenName?: string; familyName?: string } | null) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: (force?: boolean) => Promise<User | undefined>;
  // 🔄 Recarga la sesión desde AsyncStorage (usado por impersonation)
  reloadSession: () => Promise<void>;
  // 🔄 Sincronización de datos al cambiar de plan
  syncDataOnPlanChange: (previousType: string | undefined, newType: string) => Promise<SyncResult | null>;
  pendingSyncResult: SyncResult | null;
  clearSyncResult: () => void;
};

const AuthContext = createContext<AuthContextData | null>(null);

async function persistSession(data: User & { token: string }) {
  const { token, ...u } = data;
  axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(u)],
  ]);
  return { token, user: u as User };
}

async function loadSession() {
  const [[, t], [, u]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
  const user = u ? (JSON.parse(u) as User) : null;
  const token = t || null;
  if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  return { token, user };
}

async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  delete axios.defaults.headers.common.Authorization;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [pendingSyncResult, setPendingSyncResult] = useState<SyncResult | null>(null);

  // ═══════════════════════════════════════════════════════════════════════
  // REFS: Permiten que las funciones accedan a valores actuales
  // sin necesidad de recrearse cuando user/token cambian.
  // Esto rompe la cascada de re-renders que causaba el API storm.
  // ═══════════════════════════════════════════════════════════════════════
  const tokenRef = useRef(token);
  const userRef = useRef(user);
  const lastRefreshRef = useRef(0);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const s = await loadSession();
        setToken(s.token);
        setUser(s.user);
      } catch (error) {
        console.error('[Auth] Error cargando sesión:', error);
      } finally {
        setLoading(false);
      }
    })();

    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          console.warn('[Auth] 401 detectado, cerrando sesión...');
          await clearSession();
          setToken(null);
          setUser(null);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES ESTABLES: useCallback con [] = nunca cambian de referencia.
  // Usan tokenRef/userRef para leer valores actuales.
  // ═══════════════════════════════════════════════════════════════════════

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const { data } = await axios.post<User & { token: string }>(
      '/users/login',
      { emailOrUsername, password }
    );
    const s = await persistSession(data);
    setToken(s.token);
    setUser(s.user);
    try {
      await syncRoutinesFromServer(API_BASE, s.token);
    } catch (syncError) {
      console.error('[Auth] Error sincronizando rutinas:', syncError);
    }
    return { ...s.user, token: s.token };
  }, []);

  const register = useCallback(async (nombre: string, email: string, username: string, password: string, clientCode?: string) => {
    const payload: any = { nombre, email, username, password };
    if (clientCode && clientCode.trim()) payload.clientCode = clientCode.trim();
    const { data } = await axios.post<User & { token: string }>('/users/signup', payload);
    const s = await persistSession(data);
    setToken(s.token);
    setUser(s.user);
    try {
      await syncRoutinesFromServer(API_BASE, s.token);
    } catch (syncError) {
      console.error('[Auth] Error sincronizando rutinas:', syncError);
    }
    return { ...s.user, token: s.token };
  }, []);

  const upgradeByCode = useCallback(async (clientCode: string) => {
    const { data } = await axios.post<User & { token: string }>(
      '/users/upgrade',
      { clientCode: clientCode.trim() }
    );
    const s = await persistSession(data);
    setToken(s.token);
    setUser(s.user);
    try {
      await syncRoutinesFromServer(API_BASE, s.token);
    } catch (syncError) {
      console.error('[Auth] Error sincronizando rutinas:', syncError);
    }
    return { ...s.user, token: s.token };
  }, []);

  const loginWithGoogle = useCallback(async (googleAccessToken: string) => {
    const { data } = await axios.post<User & { token: string }>(
      '/users/google-login',
      { accessToken: googleAccessToken }
    );
    const s = await persistSession(data);
    setToken(s.token);
    setUser(s.user);
    try {
      await syncRoutinesFromServer(API_BASE, s.token);
    } catch (syncError) {
      console.error('[Auth] Error sincronizando rutinas:', syncError);
    }
    return { ...s.user, token: s.token };
  }, []);

  const loginWithApple = useCallback(async (identityToken: string, fullName?: { givenName?: string; familyName?: string } | null) => {
    const { data } = await axios.post<User & { token: string }>(
      '/users/apple-login',
      {
        identityToken,
        fullName: fullName ? {
          givenName: fullName.givenName || '',
          familyName: fullName.familyName || ''
        } : null
      }
    );
    const s = await persistSession(data);
    setToken(s.token);
    setUser(s.user);
    try {
      await syncRoutinesFromServer(API_BASE, s.token);
    } catch (syncError) {
      console.error('[Auth] Error sincronizando rutinas:', syncError);
    }
    return { ...s.user, token: s.token };
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const REFRESH_TTL = 5 * 60 * 1000; // 5 minutes

  const refreshUser = useCallback(async (force?: boolean) => {
    const currentToken = tokenRef.current;
    if (!currentToken) {
      return undefined;
    }

    // If data is fresh and not forced, return cached user
    const elapsed = Date.now() - lastRefreshRef.current;
    if (!force && elapsed < REFRESH_TTL && userRef.current) {
      return userRef.current;
    }

    try {
      const { data } = await axios.get<User>('/users/me');
      lastRefreshRef.current = Date.now();

      const freshUser: User = {
        _id: data._id,
        nombre: data.nombre,
        email: data.email,
        username: data.username,
        tipoUsuario: data.tipoUsuario,
        onboardingCompleted: data.onboardingCompleted,
        info_user: data.info_user ? { ...data.info_user } : undefined,
        trainerProfile: data.trainerProfile ? { ...data.trainerProfile } : undefined,
        currentTrainerId: data.currentTrainerId,
        referralCode: data.referralCode,
        subscriptionExpiry: data.subscriptionExpiry,
        referralPremiumDays: data.referralPremiumDays,
        referredUsersCount: data.referredUsersCount,
        af: data.af,
        subscriptionStatus: data.subscriptionStatus,
        overQuota: data.overQuota,
        avatarUrl: data.avatarUrl,
      };

      // Si el servidor devuelve token renovado, actualizar storage y headers
      // pero NO llamar setToken() para evitar cascada de re-renders.
      // El estado token solo cambia en login/logout (null ↔ valor).
      if ((data as any).token) {
        const newToken = (data as any).token;
        if (newToken !== tokenRef.current) {
          tokenRef.current = newToken;
          await AsyncStorage.setItem(TOKEN_KEY, newToken);
          axios.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        }
      }

      await AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser));

      // Solo actualizar estado si los datos realmente cambiaron
      setUser(prevUser => {
        const prevJson = JSON.stringify(prevUser);
        const newJson = JSON.stringify(freshUser);
        if (prevJson === newJson) return prevUser;
        return freshUser;
      });

      return freshUser;
    } catch (error: any) {
      console.warn('[Auth] Error refrescando usuario:', error.message);

      if (error.response?.status === 401) {
        console.warn('[Auth] Token expirado (401), cerrando sesión...');
        await clearSession();
        setToken(null);
        setUser(null);
        return undefined;
      }

      if (!error.response) {
        return userRef.current || undefined;
      }

      throw error;
    }
  }, []);

  const syncDataOnPlanChange = useCallback(async (previousType: string | undefined, newType: string) => {
    const currentToken = tokenRef.current;
    if (!currentToken) {
      return null;
    }
    try {
      const result = await handlePlanTransition(previousType, newType, currentToken);
      if (result) {
        setPendingSyncResult(result);
      }
      return result;
    } catch (error) {
      console.error('[Auth] Error en sincronización:', error);
      return null;
    }
  }, []);

  const clearSyncResult = useCallback(() => {
    setPendingSyncResult(null);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RELOAD SESSION: Recarga la sesión desde AsyncStorage
  // Usado por impersonation para sincronizar el estado después del swap
  // ═══════════════════════════════════════════════════════════════════════════
  const reloadSession = useCallback(async () => {
    try {
      const s = await loadSession();
      setToken(s.token);
      setUser(s.user);
      console.log('[Auth] Session reloaded:', s.user?.email);
    } catch (error) {
      console.error('[Auth] Error reloading session:', error);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE: Solo cambia cuando los DATOS cambian.
  // Las funciones son estables (useCallback []) → no causan re-renders
  // innecesarios en los consumidores.
  // ═══════════════════════════════════════════════════════════════════════
  const value = useMemo<AuthContextData>(
    () => ({
      user,
      token,
      isLoading,
      login,
      register,
      upgradeByCode,
      loginWithGoogle,
      loginWithApple,
      logout,
      refreshUser,
      reloadSession,
      syncDataOnPlanChange,
      pendingSyncResult,
      clearSyncResult,
    }),
    [user, token, isLoading, pendingSyncResult,
      login, register, upgradeByCode, loginWithGoogle, loginWithApple,
      logout, refreshUser, reloadSession, syncDataOnPlanChange, clearSyncResult]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};
