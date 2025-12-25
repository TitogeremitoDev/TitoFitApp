import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// expo-navigation-bar es opcional - solo funciona en Android native builds
let NavigationBar: typeof import('expo-navigation-bar') | null = null;
if (Platform.OS === 'android') {
  try {
    NavigationBar = require('expo-navigation-bar');
  } catch (e) {
    console.log('[ThemeContext] expo-navigation-bar not available (this is OK in Expo Go)');
  }
}

// Definir el tipo del tema completo usado en la app
export type Theme = {
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
  warning: string;
  warningLight: string;
  cardBackground: string;
  cardBorder: string;
  cardHeaderBorder: string;
  sectionHeader: string;
  iconButton: string;
  premium: string;
  premiumLight: string;
  premiumDark: string;
  // ═══════════════════════════════════════════════════════════════
  // NUEVOS BORDES DECORATIVOS - Para hacer los temas más espectaculares
  // ═══════════════════════════════════════════════════════════════
  accentBorder: string;       // Borde con color accent para destacar elementos
  primaryBorder: string;      // Borde con color primario
  borderGlow: string;         // Color para efectos de sombra/glow en bordes
  borderAccentLight: string;  // Borde accent con opacidad reducida para sutileza
  cardBorderAccent: string;   // Borde de tarjeta con toque de color accent
  // Font family suggestion (optional usage in UI components)
  fontFamily?: string;
};

// Tipo para el modo de tema base
export type ThemeMode = 'auto' | 'light' | 'dark';

// Identificadores de temas predefinidos
export type ThemeId =
  | 'default_light' | 'default_dark'
  // Pokemon
  | 'pikachu' | 'gengar' | 'pokeball'
  // Star Wars
  | 'galactic_empire' | 'jedi_master'
  // Marvel
  | 'stark_industries' | 'captain_america'
  // WoW
  | 'horde' | 'alliance';

export type ThemeCollection = 'PROPIO' | 'POKEMON' | 'STAR_WARS' | 'MARVEL' | 'WARCRAFT';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  collection: ThemeCollection;
  colors: {
    primary: string;
    background: string;
    accent: string;
    text: string;
  };
  fontFamily?: string;
  isDark: boolean; // Para determinar status bar, etc.
}

// Interfaz para definir un tema simplificado
interface SimpleThemeDefinition {
  id: ThemeId;
  name: string;
  collection: ThemeCollection;
  primary: string;
  background: string; // Main background
  accent: string;     // Buttons/CTA/Highlights
  textPrimary: string;
  textSecondary?: string; // Optional, defaults to opacity of primary
  fontFamily: string;
  isDark: boolean;    // Helps auto-generate other shades
}

// Función helper para generar el tema completo desde la definición simple
const createTheme = (def: SimpleThemeDefinition): Theme => {
  const { primary, background, accent, textPrimary, isDark } = def;

  // Basic derivations
  const textSecondary = def.textSecondary || (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)');
  const textTertiary = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';

  // Background variations
  // For dark themes, secondary usually lighter. For light themes, secondary usually white or slightly different.
  const backgroundSecondary = isDark
    ? adjustColor(background, 10) // Lighter for dark mode
    : '#ffffff'; // Verify if background is white, if so, maybe make this slightly gray? or stick to white. 
  // Let's assume standard card background behavior.

  const backgroundTertiary = isDark
    ? adjustColor(background, 20)
    : '#f9fafb';

  const cardBackground = isDark ? backgroundSecondary : '#ffffff';
  const inputBackground = isDark ? backgroundTertiary : '#ffffff';

  const border = isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb';
  const borderLight = isDark ? 'rgba(255,255,255,0.06)' : '#eef2f7';

  // ═══════════════════════════════════════════════════════════════
  // NUEVOS BORDES DECORATIVOS - Colores vibrantes y espectaculares
  // ═══════════════════════════════════════════════════════════════
  // Convertir hex a rgba para crear efectos con opacidad
  const hexToRgba = (hex: string, alpha: number): string => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Borde accent con diferentes intensidades
  const accentBorder = accent;
  const primaryBorder = primary;
  const borderGlow = hexToRgba(accent, isDark ? 0.6 : 0.4);
  const borderAccentLight = hexToRgba(accent, isDark ? 0.25 : 0.15);
  const cardBorderAccent = hexToRgba(primary, isDark ? 0.35 : 0.2);

  return {
    background,
    backgroundSecondary,
    backgroundTertiary,

    text: textPrimary,
    textSecondary,
    textTertiary,

    inputBackground,
    inputText: textPrimary,
    inputBorder: border,
    placeholder: textTertiary,

    border,
    borderLight,

    primary: primary,
    primaryText: isDark ? '#ffffff' : '#ffffff', // Usually white on primary

    // Standard semantic colors - keeping them relatively consistent for predictability
    success: '#10b981',
    successLight: isDark ? '#064e3b' : '#ecfdf5',
    successBorder: isDark ? '#065f46' : '#d1fae5',
    successText: isDark ? '#6ee7b7' : '#065f46',

    // Danger uses semantic red for consistency (not theme accent) 
    danger: '#ef4444',
    dangerLight: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',

    warning: '#f59e0b',
    warningLight: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.08)',

    cardBackground,
    cardBorder: cardBorderAccent, // 🎨 Borde colorido según el tema (antes era border neutral)
    cardHeaderBorder: borderLight,

    sectionHeader: isDark ? backgroundTertiary : '#f3f4f6',
    iconButton: isDark ? backgroundTertiary : '#f3f4f6',

    premium: accent, // Let's use the theme accent for "premium" highlights
    premiumLight: isDark ? adjustOpacity(accent, 0.15) : adjustOpacity(accent, 0.1),
    premiumDark: adjustColor(accent, -20),

    // ═══════════════════════════════════════════════════════════════
    // BORDES DECORATIVOS - Hacen los temas más espectaculares
    // ═══════════════════════════════════════════════════════════════
    accentBorder,           // Color accent puro para bordes destacados
    primaryBorder,          // Color primario puro para bordes
    borderGlow,             // Con opacidad para efectos de sombra/glow
    borderAccentLight,      // Accent sutil para bordes de fondo
    cardBorderAccent,       // Borde de tarjeta con toque de color primario

    fontFamily: def.fontFamily,
  };
};

/* Helper para ajustar brillo de color hex */
function adjustColor(color: string, amount: number): string {
  if (!color.startsWith('#')) return color;

  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);

  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00FF) + amount;
  let b = (num & 0x0000FF) + amount;

  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function adjustOpacity(color: string, opacity: number): string {
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
}

// --- CATALOGO DE TEMAS ---

// 0. Default Light
const defaultLightDef: SimpleThemeDefinition = {
  id: 'default_light', name: 'Modo Día', collection: 'PROPIO',
  primary: '#3b82f6', background: '#f5f7fb', accent: '#f59e0b',
  textPrimary: '#111827', textSecondary: '#4b5563',
  fontFamily: 'System', isDark: false
};

// 0. Default Dark
const defaultDarkDef: SimpleThemeDefinition = {
  id: 'default_dark', name: 'Modo Noche', collection: 'PROPIO',
  primary: '#3b82f6', background: '#0f172a', accent: '#f59e0b',
  textPrimary: '#f1f5f9', textSecondary: '#94a3b8',
  fontFamily: 'System', isDark: true
};

// --- POKÉMON ---
const pikachuDef: SimpleThemeDefinition = {
  id: 'pikachu', name: 'Pikachu', collection: 'POKEMON',
  primary: '#FFD700', background: '#212121', accent: '#FF5252',
  textPrimary: '#FFFFFF', fontFamily: 'Poppins-Bold', isDark: true
};

const gengarDef: SimpleThemeDefinition = {
  id: 'gengar', name: 'Gengar', collection: 'POKEMON',
  primary: '#7B1FA2', background: '#121212', accent: '#FF3D00',
  textPrimary: '#E1BEE7', fontFamily: 'Creepster-Regular', isDark: true
};

const pokeballDef: SimpleThemeDefinition = {
  id: 'pokeball', name: 'Trainer Classic', collection: 'POKEMON',
  primary: '#D50000', background: '#FFFFFF', accent: '#263238', // Accent used for details
  textPrimary: '#212121', fontFamily: 'Montserrat-Bold', isDark: false
};

// --- STAR WARS ---
const galacticEmpireDef: SimpleThemeDefinition = {
  id: 'galactic_empire', name: 'Sith Lord', collection: 'STAR_WARS',
  primary: '#B71C1C', background: '#000000', accent: '#ECEFF1',
  textPrimary: '#FFFFFF', fontFamily: 'Oswald-Bold', isDark: true
};

const jediMasterDef: SimpleThemeDefinition = {
  id: 'jedi_master', name: 'The Force', collection: 'STAR_WARS',
  primary: '#558B2F', background: '#F5F5DC', accent: '#795548',
  textPrimary: '#33691E', fontFamily: 'Lato-Regular', isDark: false
};

// --- MARVEL ---
const starkIndustriesDef: SimpleThemeDefinition = {
  id: 'stark_industries', name: 'Iron Tech', collection: 'MARVEL',
  primary: '#800000', background: '#1C1C1C', accent: '#FFD700', // Gold accent
  textPrimary: '#FFFFFF', fontFamily: 'Orbitron-Bold', isDark: true
};

const captainAmericaDef: SimpleThemeDefinition = {
  id: 'captain_america', name: 'First Avenger', collection: 'MARVEL',
  primary: '#002147', background: '#ECEFF1', accent: '#B71C1C',
  textPrimary: '#0D47A1', fontFamily: 'Anton-Regular', isDark: false
};

// --- WOW ---
const hordeDef: SimpleThemeDefinition = {
  id: 'horde', name: 'The Horde', collection: 'WARCRAFT',
  primary: '#8B0000', background: '#261616', accent: '#FF8C00',
  textPrimary: '#FFCDD2', fontFamily: 'Cinzel-Bold', isDark: true
};

const allianceDef: SimpleThemeDefinition = {
  id: 'alliance', name: 'The Alliance', collection: 'WARCRAFT',
  primary: '#003366', background: '#FAFAFA', accent: '#FFD700',
  textPrimary: '#1A237E', fontFamily: 'PlayfairDisplay-Bold', isDark: false
};

// Lista de TODOS los definiciones simples
export const THEMES_LIST: SimpleThemeDefinition[] = [
  defaultLightDef, defaultDarkDef,
  pikachuDef, gengarDef, pokeballDef,
  galacticEmpireDef, jediMasterDef,
  starkIndustriesDef, captainAmericaDef,
  hordeDef, allianceDef
];

// Helper para convertir definition a ThemeInfo público
const toThemeInfo = (def: SimpleThemeDefinition): ThemeInfo => ({
  id: def.id,
  name: def.name,
  collection: def.collection,
  colors: {
    primary: def.primary,
    background: def.background,
    accent: def.accent,
    text: def.textPrimary
  },
  fontFamily: def.fontFamily,
  isDark: def.isDark
});

export const AVAILABLE_THEMES: ThemeInfo[] = THEMES_LIST.map(toThemeInfo);

// Mapa de id -> Theme Object completo
const THEME_OBJECTS: Record<ThemeId, Theme> = THEMES_LIST.reduce((acc, def) => {
  acc[def.id] = createTheme(def);
  return acc;
}, {} as Record<ThemeId, Theme>);

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  themeMode: ThemeMode; // Mantenemos para compatibilidad con 'auto'
  currentThemeId: ThemeId;
  //   setThemeMode: (mode: ThemeMode) => Promise<void>; // Deprecated but kept for backward compat if needed logic mapping
  setThemeId: (id: ThemeId) => Promise<void>;
  availableThemes: ThemeInfo[];
};

const THEME_STORAGE_KEY = 'app_theme_id';
// const THEME_MODE_KEY = 'app_theme_mode'; // Vamos a migrar a usar ID principalmente

const ThemeContext = createContext<ThemeContextType>({
  theme: THEME_OBJECTS.default_light,
  isDark: false,
  themeMode: 'light',
  currentThemeId: 'default_light',
  setThemeId: async () => { },
  availableThemes: AVAILABLE_THEMES,
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useColorScheme();
  // Usar el tema del sistema por defecto para evitar problemas de visibilidad
  const [currentThemeId, setCurrentThemeId] = useState<ThemeId>(
    systemColorScheme === 'dark' ? 'default_dark' : 'default_light'
  );

  // Derivados
  const themeDef = THEMES_LIST.find(t => t.id === currentThemeId) || defaultLightDef;
  const theme = THEME_OBJECTS[currentThemeId] || THEME_OBJECTS.default_light;
  const isDark = themeDef.isDark;

  // Compatibilidad con el concepto 'themeMode'. 
  // Si estamos en un tema custom, el 'mode' es fijo según el tema.
  // Si estamos en default_light/dark, podríamos querer comportamiento AUTO.
  // POR SIMPLICIDAD: Vamos a tratar 'auto' seleccionando default_light o default_dark según sistema.
  // Pero el estado principal será 'currentThemeId'.
  const themeMode: ThemeMode = currentThemeId === 'default_light' ? 'light' : (currentThemeId === 'default_dark' ? 'dark' : (isDark ? 'dark' : 'light'));

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedId = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedId && THEME_OBJECTS[savedId as ThemeId]) {
          setCurrentThemeId(savedId as ThemeId);
        } else {
          // Si no hay ID guardado, chequear si había modo guardado antiguo
          const savedMode = await AsyncStorage.getItem('app_theme_mode');
          if (savedMode === 'dark') setCurrentThemeId('default_dark');
          else if (savedMode === 'light') setCurrentThemeId('default_light');
          else if (savedMode === 'auto') {
            // Auto init logic
            setCurrentThemeId(systemColorScheme === 'dark' ? 'default_dark' : 'default_light');
          }
        }
      } catch (error) {
        console.warn('Error loading theme:', error);
      }
    };
    loadTheme();
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 🎨 ACTUALIZAR COLOR DE BARRA DE NAVEGACIÓN ANDROID SEGÚN TEMA
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const updateNavigationBar = async () => {
      // Solo en Android y si el módulo está disponible
      if (Platform.OS !== 'android' || !NavigationBar) return;

      try {
        // Usar el color de fondo del tema para la barra de navegación
        await NavigationBar.setBackgroundColorAsync(theme.background);

        // Ajustar el estilo de los botones (iconos) según si el tema es claro u oscuro
        await NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');

        console.log(`[ThemeContext] Navigation bar updated: ${theme.background}, style: ${isDark ? 'light' : 'dark'}`);
      } catch (error) {
        console.warn('[ThemeContext] Error updating navigation bar:', error);
      }
    };

    updateNavigationBar();
  }, [theme.background, isDark]);

  // Listener para cambios de sistema SI el usuario está usando temas default (o un modo "auto" explícito si lo tuviéramos)
  // Por ahora, para simplificar, si el usuario elige un tema, se queda con ese.
  // Podríamos agregar un "Tema ID = 'auto'" virtual que despache a default_light/dark.
  // Para este requerimiento, el usuario elige temas específicos.

  const setThemeId = async (id: ThemeId) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, id);
      setCurrentThemeId(id);
    } catch (error) {
      console.warn('Error saving theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      isDark,
      themeMode,
      currentThemeId,
      setThemeId,
      availableThemes: AVAILABLE_THEMES
    }}>
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
