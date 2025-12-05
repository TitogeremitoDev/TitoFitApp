import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Definir el tipo del tema
type Theme = {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  inputBackground: string;
  inputText: string;
  inputBorder: string;
  placeholder: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryText: string;
  success: string;
  successLight: string;
  successBorder: string;
  successText: string;
  danger: string;
  dangerLight: string;
  cardBackground: string;
  cardBorder: string;
  cardHeaderBorder: string;
  sectionHeader: string;
  iconButton: string;
  premium: string;
  premiumLight: string;
  premiumDark: string;
};

// Tipo para el modo de tema
export type ThemeMode = 'auto' | 'light' | 'dark';

// Definir el tipo del contexto
type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
};

// Definir el tipo de las props del Provider
type ThemeProviderProps = {
  children: ReactNode;
};

// Definición de colores para tema claro
export const lightTheme: Theme = {
  // Backgrounds
  background: '#f5f7fb',
  backgroundSecondary: '#ffffff',
  backgroundTertiary: '#f9fafb',
  
  // Text
  text: '#111827',
  textSecondary: '#4b5563',
  textTertiary: '#6b7280',
  
  // Inputs
  inputBackground: '#ffffff',
  inputText: '#111827',
  inputBorder: '#d1d5db',
  placeholder: '#9ca3af',
  
  // Borders
  border: '#e5e7eb',
  borderLight: '#eef2f7',
  
  // Buttons y acciones
  primary: '#3b82f6',
  primaryText: '#ffffff',
  success: '#10b981',
  successLight: '#ecfdf5',
  successBorder: '#d1fae5',
  successText: '#065f46',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  
  // Cards
  cardBackground: '#ffffff',
  cardBorder: '#e5e7eb',
  cardHeaderBorder: '#eef2f7',
  
  // Special
  sectionHeader: '#f3f4f6',
  iconButton: '#f3f4f6',
  
  // Premium colors
  premium: '#f59e0b',
  premiumLight: 'rgba(245, 158, 11, 0.08)',
  premiumDark: '#b45309',
};

// Definición de colores para tema oscuro
export const darkTheme: Theme = {
  // Backgrounds
  background: '#0f172a',
  backgroundSecondary: '#1e293b',
  backgroundTertiary: '#334155',
  
  // Text
  text: '#f1f5f9',
  textSecondary: '#ffffffff',
  textTertiary: '#94a3b8',
  
  // Inputs
  inputBackground: '#1e293b',
  inputText: '#f1f5f9',
  inputBorder: '#475569',
  placeholder: '#64748b',
  
  // Borders
  border: '#334155',
  borderLight: '#475569',
  
  // Buttons y acciones
  primary: '#3b82f6',
  primaryText: '#ffffff',
  success: '#10b981',
  successLight: '#064e3b',
  successBorder: '#065f46',
  successText: '#6ee7b7',
  danger: '#ef4444',
  dangerLight: '#7f1d1d',
  
  // Cards
  cardBackground: '#1e293b',
  cardBorder: '#334155',
  cardHeaderBorder: '#334155',
  
  // Special
  sectionHeader: '#334155',
  iconButton: '#334155',
  
  // Premium colors
  premium: '#f59e0b',
  premiumLight: 'rgba(245, 158, 11, 0.15)',
  premiumDark: '#fbbf24',
};

const THEME_STORAGE_KEY = 'app_theme_mode';

// Crear el contexto con valor por defecto
const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDark: false,
  themeMode: 'auto',
  setThemeMode: async () => {},
});

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  const [isDark, setIsDark] = useState(false);
  const [theme, setTheme] = useState<Theme>(lightTheme);

  // Cargar la preferencia guardada al inicio
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode && (savedMode === 'auto' || savedMode === 'light' || savedMode === 'dark')) {
          setThemeModeState(savedMode as ThemeMode);
        }
      } catch (error) {
        console.warn('Error loading theme preference:', error);
      }
    };
    loadThemePreference();
  }, []);

  // Actualizar el tema cuando cambie el modo o el tema del sistema
  useEffect(() => {
    let shouldBeDark = false;

    if (themeMode === 'auto') {
      // Modo automático: seguir el sistema
      shouldBeDark = systemColorScheme === 'dark';
    } else if (themeMode === 'dark') {
      // Forzar modo oscuro
      shouldBeDark = true;
    } else if (themeMode === 'light') {
      // Forzar modo claro
      shouldBeDark = false;
    }

    setIsDark(shouldBeDark);
    setTheme(shouldBeDark ? darkTheme : lightTheme);
  }, [themeMode, systemColorScheme]);

  // Función para cambiar el modo del tema
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.warn('Error saving theme preference:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }
  return context;
};