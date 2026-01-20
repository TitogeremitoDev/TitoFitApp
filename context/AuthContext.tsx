// context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncRoutinesFromServer } from '../src/lib/syncRoutines';
import { handlePlanTransition, getSyncDirection, SyncResult } from '../src/lib/dataSyncService';

const DEFAULT_KOYEB = 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';
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
  refreshUser: () => Promise<User | undefined>;
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
  // 🔄 Estado para resultado de sincronización pendiente
  const [pendingSyncResult, setPendingSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await loadSession();
        setToken(s.token);
        setUser(s.user);
        // Sesión restaurada silenciosamente
      } catch (error) {
        console.error('[Auth] Error cargando sesión:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextData>(
    () => ({
      user,
      token,
      isLoading,

      async login(emailOrUsername: string, password: string) {

        const { data } = await axios.post<User & { token: string }>(
          '/users/login',
          { emailOrUsername, password }
        );
        const s = await persistSession(data);
        setToken(s.token);
        setUser(s.user);

        // Sincroniza rutinas desde servidor
        try {
          await syncRoutinesFromServer(API_BASE, s.token);

        } catch (syncError) {
          console.error('[Auth] Error sincronizando rutinas:', syncError);
        }

        return { ...s.user, token: s.token };
      },

      async register(nombre: string, email: string, username: string, password: string, clientCode?: string) {

        const payload: any = { nombre, email, username, password };
        if (clientCode && clientCode.trim()) payload.clientCode = clientCode.trim();
        const { data } = await axios.post<User & { token: string }>('/users/signup', payload);
        const s = await persistSession(data);
        setToken(s.token);
        setUser(s.user);

        // Sincroniza rutinas tras registrarse
        try {
          await syncRoutinesFromServer(API_BASE, s.token);

        } catch (syncError) {
          console.error('[Auth] Error sincronizando rutinas:', syncError);
        }

        return { ...s.user, token: s.token };
      },

      async upgradeByCode(clientCode: string) {

        const { data } = await axios.post<User & { token: string }>(
          '/users/upgrade',
          { clientCode: clientCode.trim() }
        );
        const s = await persistSession(data);
        setToken(s.token);
        setUser(s.user);

        // Re-sincroniza por si el upgrade asigna rutinas
        try {
          await syncRoutinesFromServer(API_BASE, s.token);

        } catch (syncError) {
          console.error('[Auth] Error sincronizando rutinas:', syncError);
        }

        return { ...s.user, token: s.token };
      },

      async loginWithGoogle(googleAccessToken: string) {

        const { data } = await axios.post<User & { token: string }>(
          '/users/google-login',
          { accessToken: googleAccessToken }
        );
        const s = await persistSession(data);
        setToken(s.token);
        setUser(s.user);

        // Sincroniza rutinas al entrar con Google
        try {
          await syncRoutinesFromServer(API_BASE, s.token);

        } catch (syncError) {
          console.error('[Auth] Error sincronizando rutinas:', syncError);
        }

        return { ...s.user, token: s.token };
      },

      async loginWithApple(identityToken: string, fullName?: { givenName?: string; familyName?: string } | null) {

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

        // Sincroniza rutinas al entrar con Apple
        try {
          await syncRoutinesFromServer(API_BASE, s.token);

        } catch (syncError) {
          console.error('[Auth] Error sincronizando rutinas:', syncError);
        }

        return { ...s.user, token: s.token };
      },

      async logout() {

        await clearSession();
        setToken(null);
        setUser(null);
      },

      async refreshUser() {
        if (!token) {
          console.warn('[Auth] No hay token, no se puede refrescar usuario');
          return undefined;
        }
        try {
          const { data } = await axios.get<User>('/users/me');

          // Crear un objeto completamente nuevo para forzar re-render
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
            // 🛑 CRITICAL: Add subscription fields for frozen/over-quota check
            subscriptionStatus: data.subscriptionStatus,
            overQuota: data.overQuota,
            avatarUrl: data.avatarUrl, // Persist avatarUrl
          };

          // Persistir y actualizar estado
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser));

          // IMPORTANTE: Crear nuevo objeto con spread para forzar re-render
          setUser({ ...freshUser });


          return freshUser;
        } catch (error) {
          console.error('[Auth] ❌ Error refrescando usuario:', error);
          throw error;
        }
      },

      // 🔄 Sincronización de datos al cambiar de plan
      async syncDataOnPlanChange(previousType: string | undefined, newType: string) {
        if (!token) {
          console.warn('[Auth] No hay token para sincronizar');
          return null;
        }
        try {

          const result = await handlePlanTransition(previousType, newType, token);
          if (result) {
            setPendingSyncResult(result);
          }
          return result;
        } catch (error) {
          console.error('[Auth] Error en sincronización:', error);
          return null;
        }
      },

      pendingSyncResult,

      clearSyncResult() {
        setPendingSyncResult(null);
      },
    }),
    [user, token, isLoading, pendingSyncResult]

  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};
