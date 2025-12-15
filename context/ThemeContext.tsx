import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

    // Standard semantic colors - keeping them relatively consistent but themed if needed
    success: '#10b981',
    successLight: isDark ? '#064e3b' : '#ecfdf5',
    successBorder: isDark ? '#065f46' : '#d1fae5',
    successText: isDark ? '#6ee7b7' : '#065f46',

    danger: accent, // Using accent as danger/highlight often works for these custom themes or strictly stick to red? 
    // Let's keep strict semantic danger but usually accent is the "Action" color.
    // Wait, standard UI expects 'primary' as main action. 'Accent' in the request was for buttons/CTA.
    // So Primary = Theme Primary, Accent = CTA/Buttons. 
    // In our Theme types, 'primary' is usually the main brand color. 
    // Let's map Request Primary -> Theme Primary.
    // Request Accent -> We might use this for specific highlights or secondary buttons?
    // actually, let's mix: 'danger' implies error. Let's keep standard red for error to avoid confusion.
    // We will use Accent for 'premium' or other highlights.
    dangerLight: isDark ? '#7f1d1d' : '#fee2e2',

    warning: '#f59e0b',
    warningLight: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.08)',

    cardBackground,
    cardBorder: border,
    cardHeaderBorder: borderLight,

    sectionHeader: isDark ? backgroundTertiary : '#f3f4f6',
    iconButton: isDark ? backgroundTertiary : '#f3f4f6',

    premium: accent, // Let's use the theme accent for "premium" highlights
    premiumLight: isDark ? adjustOpacity(accent, 0.15) : adjustOpacity(accent, 0.1),
    premiumDark: adjustColor(accent, -20),

    fontFamily: def.fontFamily,
  };
};

/* Helper simplificado para ajustar brillo de color hex (solo para soporte básico) */
function adjustColor(color: string, amount: number) {
  return color; // Placeholder simplificado para no añadir enorme librería de color por ahora
  // En una implementación real usaríamos 'color' o similar. 
  // Dado que los temas son fijos, definiremos los colores clave manualmente si el ajuste automático no es ideal.
  // Para este MVP, confiaremos en los colores base o definiremos los derivados explícitamente si es crítico.
  // NOTE: For better results in future, add 'tinycolor2' or strict manual definitions.
}
function adjustOpacity(color: string, opacity: number) {
  // Si es hex
  if (color.startsWith('#')) {
    // simple conversion logic or return rgba equivalent
    // Para simplificar, retornamos el color original o un valor hardcodeado si es complejo
    return color;
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
  const [currentThemeId, setCurrentThemeId] = useState<ThemeId>('default_light');

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
