// context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncRoutinesFromServer } from '../src/lib/syncRoutines';

const DEFAULT_KOYEB = 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';
const API_BASE = ((process.env.EXPO_PUBLIC_API_URL as string) || DEFAULT_KOYEB).replace(/\/+$/, '');
axios.defaults.baseURL = `${API_BASE}/api`;

if (__DEV__) {
  console.log('[Auth] API_BASE =', axios.defaults.baseURL);
}

const TOKEN_KEY = 'titofit_token';
const USER_KEY = 'titofit_user';

export type User = {_id: string;
  nombre: string;
  email: string;
  username: string;
  tipoUsuario: 'FREEUSER' | 'CLIENTE' | 'PREMIUM' | 'ADMINISTRADOR';
  token?: string;
};

type AuthContextData = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<User>;
  register: (nombre: string, email: string, username: string, password: string, clientCode?: string) => Promise<User>;
  upgradeByCode: (clientCode: string) => Promise<User>;
  loginWithGoogle: (googleAccessToken: string) => Promise<User>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    (async () => {
      try {
        const s = await loadSession();
        setToken(s.token);
        setUser(s.user);
        if (__DEV__ && s.user) {
          console.log('[Auth] Sesión restaurada:', s.user.email);
        }
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
        if (__DEV__) {
          console.log('[Auth] Login clásico iniciado');
        }
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
          if (__DEV__) {
            console.log('[Auth] Rutinas sincronizadas tras login');
          }
        } catch (syncError) {
          console.error('[Auth] Error sincronizando rutinas:', syncError);
        }

        return { ...s.user, token: s.token };
      },

      async register(nombre: string, email: string, username: string, password: string, clientCode?: string) {
        if (__DEV__) {
          console.log('[Auth] Registro iniciado');
        }
        const payload: any = { nombre, email, username, password };
        if (clientCode && clientCode.trim()) payload.clientCode = clientCode.trim();
        const { data } = await axios.post<User & { token: string }>('/users/signup', payload);
        const s = await persistSession(data);
        setToken(s.token);
        setUser(s.user);

        // Sincroniza rutinas tras registrarse
        try {
          await syncRoutinesFromServer(API_BASE, s.token);
          if (__DEV__) {
            console.log('[Auth] Rutinas sincronizadas tras registro');
          }
        } catch (syncError) {
          console.error('[Auth] Error sincronizando rutinas:', syncError);
        }

        return { ...s.user, token: s.token };
      },

      async upgradeByCode(clientCode: string) {
        if (__DEV__) {
          console.log('[Auth] Upgrade por código iniciado');
        }
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
          if (__DEV__) {
            console.log('[Auth] Rutinas sincronizadas tras upgrade');
          }
        } catch (syncError) {
          console.error('[Auth] Error sincronizando rutinas:', syncError);
        }

        return { ...s.user, token: s.token };
      },

      async loginWithGoogle(googleAccessToken: string) {
        if (__DEV__) {
          console.log('[Auth] Login con Google iniciado');
        }
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
          if (__DEV__) {
            console.log('[Auth] Rutinas sincronizadas tras login Google');
          }
        } catch (syncError) {
          console.error('[Auth] Error sincronizando rutinas:', syncError);
        }

        return { ...s.user, token: s.token };
      },

      async logout() {
        if (__DEV__) {
          console.log('[Auth] Cerrando sesión');
        }
        await clearSession();
        setToken(null);
        setUser(null);
      },
    }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};