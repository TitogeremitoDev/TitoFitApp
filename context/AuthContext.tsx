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

const TOKEN_KEY = 'totalgains_token';
const USER_KEY = 'totalgains_user';

export type User = {
  _id: string;
  nombre: string;
  email: string;
  username: string;
  tipoUsuario: 'FREEUSER' | 'CLIENTE' | 'PREMIUM' | 'ADMINISTRADOR' | 'ENTRENADOR';
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
  refreshUser: () => Promise<User | undefined>;
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

      async refreshUser() {
        if (!token) return;
        try {
          // Asumimos que hay un endpoint /users/me o similar, o usamos el ID
          // Si no existe, podemos usar login con token o similar.
          // Generalmente se usa GET /users/me
          // Voy a verificar si existe ese endpoint en el backend, pero por ahora lo implemento asumiendo que sí o lo creo.
          // Mirando index.js del backend (step 16), no vi explícitamente /users/me para obtener datos del usuario, 
          // pero vi /api/routines/me. 
          // Voy a asumir que necesito crear o usar uno existente.
          // Espera, el backend tiene:
          // app.get('/api/users/check-username', ...)
          // app.post('/api/users/signup', ...)
          // app.post('/api/users/login', ...)
          // app.post('/api/users/google-login', ...)
          // app.post('/api/users/upgrade', ...)
          // No veo un GET /api/users/me o GET /api/users/:id protegido para auto-consulta.
          // PERO, puedo usar el endpoint de upgrade o crear uno nuevo en el backend.
          // Lo más limpio es añadir GET /api/users/me en el backend.

          // Como no puedo editar el backend "oficialmente" sin permiso (aunque el usuario dijo "tengo que subir de nuevo el backend?"),
          // voy a añadir el endpoint en el backend PRIMERO.
          // Pero el usuario dijo que NO quería subir el backend si no era necesario.
          // Sin embargo, para refrescar el usuario necesito obtener sus datos actualizados.
          // ¿Hay alguna otra forma?
          // Podría llamar a /api/users/login con token? No.

          // Voy a añadir `refreshUser` aquí pero necesito que el backend lo soporte.
          // Voy a comprobar si puedo añadir el endpoint al backend rápidamente.
          // Si no, tendré que hackearlo un poco, quizás llamando a algo que devuelva el usuario.

          // Miremos el backend index.js de nuevo.
          // ...
          // No hay endpoint de "get my profile".
          // Voy a añadirlo al backend. Es un cambio pequeño y necesario.

          const { data } = await axios.get<User>('/users/me');
          // Persistimos solo el usuario, mantenemos el token
          const s = await persistSession({ ...data, token });
          setUser(s.user);
          return s.user;
        } catch (error) {
          console.error('[Auth] Error refrescando usuario:', error);
          throw error;
        }
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
