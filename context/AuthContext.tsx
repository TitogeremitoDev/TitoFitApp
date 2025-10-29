// context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

// ----------------------------------------------------
// ¡RECUERDA PONER TU IP LOCAL AQUÍ!
const API_URL = 'http://192.168.1.38:3000/api';
// ----------------------------------------------------

axios.defaults.baseURL = API_URL;
const TOKEN_KEY = 'titofit_token';

// --- 1. Definimos los "tipos" ---

// El tipo para un objeto Usuario (basado en lo que devuelve tu API)
interface User {
  _id: string;
  nombre: string;
  email: string;
  username: string;
  tipoUsuario: 'FREEUSER' | 'CLIENTE' | 'PREMIUM' | 'ADMINISTRADOR';
}

// El tipo para el "valor" de nuestro contexto
interface AuthContextData {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<any>;
  register: (nombre: string, email: string, username: string, password: string) => Promise<any>;
  logout: () => void;
}

// --- 2. Creamos el Contexto con el tipo ---
// Le decimos a TS que el contexto puede ser AuthContextData o null
const AuthContext = createContext<AuthContextData | null>(null);

// --- 3. Creamos el Proveedor (Provider) ---
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // --- 4. Estados con Tipos ---
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null); // <- ¡Arreglado!
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (storedToken) {
          setToken(storedToken); // <- ¡Arreglado!
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          // Aquí podríamos cargar los datos del usuario, pero por ahora simple
        }
      } catch (e) {
        console.error('Failed to load token', e);
      }
      setIsLoading(false);
    };
    loadToken();
  }, []);

  // --- 5. Funciones con Parámetros Tipados ---
  const login = async (emailOrUsername: string, password: string) => {
    
    // --- INICIO DE LA "PUERTA TRASERA DE DESARROLLADOR" ---
    // Estas son tus "credenciales mágicas"
    const DEV_USER = 'admin';
    const DEV_PASS = 'admin';

    if (emailOrUsername === DEV_USER && password === DEV_PASS) {
      console.warn('--- MODO DESARROLLADOR: Saltando login real ---');
      
      // 1. Creamos un token y usuario falsos
      const fakeToken = 'admin-token-local'; // Es solo un string, no importa qué sea
      const fakeUser: User = { // Un objeto User falso
        _id: 'admin-id-001',
        nombre: 'Administrador (Local)',
        email: 'admin@local.com',
        username: 'admin',
        tipoUsuario: 'ADMINISTRADOR' // ¡Para probar todo!
      };

      // 2. Simulamos todo lo que hace un login exitoso
      setToken(fakeToken);
      setUser(fakeUser);
      axios.defaults.headers.common['Authorization'] = `Bearer ${fakeToken}`;
      await SecureStore.setItemAsync(TOKEN_KEY, fakeToken);
      
      console.warn('--- MODO DESARROLLADOR: Logueado con éxito ---');
      return { token: fakeToken, ...fakeUser }; // Devuelve los datos falsos
    }
    // --- FIN DE LA "PUERTA TRASERA DE DESARROLLADOR" ---


    // --- INICIO DEL CÓDIGO DE LOGIN REAL (SOLO SE EJECUTA SI NO ERES DEV) ---
    try {
      const response = await axios.post('/users/login', {
        emailOrUsername,
        password,
      });

      const { token: newToken, ...userData } = response.data;

      setToken(newToken);
      setUser(userData as User); // Le decimos a TS que userData es de tipo User
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      await SecureStore.setItemAsync(TOKEN_KEY, newToken);
      
      return response.data;
    } catch (e) {
      console.error('Login failed', e);
      throw e;
    }
  };

  const register = async (nombre: string, email: string, username: string, password: string) => { // <- ¡Arreglado!
    try {
      const response = await axios.post('/users/signup', {
        nombre,
        email,
        username,
        password,
      });

      const { token: newToken, ...userData } = response.data;

      setToken(newToken);
      setUser(userData as User);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      await SecureStore.setItemAsync(TOKEN_KEY, newToken);

      return response.data;
    } catch (e) {
      console.error('Register failed', e);
      throw e;
    }
  };

  const logout = async () => {
    try {
      setToken(null);
      setUser(null);
      delete axios.defaults.headers.common['Authorization'];
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout }} // <- 'isLoading' (con L)
    >
      {children}
    </AuthContext.Provider>
  );
};

// --- 6. Hook para usar el contexto ---
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};