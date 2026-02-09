/**
 * context/ChatThemeContext.jsx
 * Contexto de temas EXCLUSIVO para el chat, aislado del tema general de la app
 * Permite al usuario personalizar solo la apariencia del chat
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_THEME_KEY = 'chat_theme_id';

// ═══════════════════════════════════════════════════════════════════════════
// DEFINICIONES DE TEMAS DE CHAT
// ═══════════════════════════════════════════════════════════════════════════

const CHAT_THEMES = {
    // --- BÁSICOS ---
    default_light: {
        id: 'default_light',
        name: 'Clásico Claro',
        collection: 'BASICO',
        isDark: false,
        background: '#f8fafc',
        cardBackground: '#ffffff',
        header: '#8b5cf6',
        headerSecondary: '#7c3aed',
        primary: '#8b5cf6',
        text: '#1e293b',
        textSecondary: '#64748b',
        textTertiary: '#94a3b8',
        border: '#e2e8f0',
        inputBackground: '#f1f5f9',
        bubbleOwn: '#8b5cf6',
        bubbleOther: '#ffffff',
        bubbleOwnText: '#ffffff',
        bubbleOtherText: '#1e293b'
    },
    default_dark: {
        id: 'default_dark',
        name: 'Clásico Oscuro',
        collection: 'BASICO',
        isDark: true,
        background: '#0f172a',
        cardBackground: '#1e293b',
        header: '#8b5cf6',
        headerSecondary: '#7c3aed',
        primary: '#8b5cf6',
        text: '#f1f5f9',
        textSecondary: '#94a3b8',
        textTertiary: '#64748b',
        border: '#334155',
        inputBackground: '#334155',
        bubbleOwn: '#8b5cf6',
        bubbleOther: '#1e293b',
        bubbleOwnText: '#ffffff',
        bubbleOtherText: '#f1f5f9'
    },

    // --- POKEMON ---
    pikachu: {
        id: 'pikachu',
        name: 'Pikachu',
        collection: 'POKEMON',
        isDark: true,
        background: '#1a1a2e',
        cardBackground: '#16213e',
        header: '#FFD700',
        headerSecondary: '#FFA500',
        primary: '#FFD700',
        text: '#ffffff',
        textSecondary: '#ffd70099',
        textTertiary: '#94a3b8',
        border: '#FFD70030',
        inputBackground: '#0f3460',
        bubbleOwn: '#FFD700',
        bubbleOther: '#16213e',
        bubbleOwnText: '#000000',
        bubbleOtherText: '#ffffff'
    },
    gengar: {
        id: 'gengar',
        name: 'Gengar',
        collection: 'POKEMON',
        isDark: true,
        background: '#121212',
        cardBackground: '#1a1a2e',
        header: '#7B1FA2',
        headerSecondary: '#6A1B9A',
        primary: '#7B1FA2',
        text: '#E1BEE7',
        textSecondary: '#CE93D8',
        textTertiary: '#9575CD',
        border: '#7B1FA230',
        inputBackground: '#2d1f3d',
        bubbleOwn: '#7B1FA2',
        bubbleOther: '#2d1f3d',
        bubbleOwnText: '#ffffff',
        bubbleOtherText: '#E1BEE7'
    },

    // --- STAR WARS ---
    sith_lord: {
        id: 'sith_lord',
        name: 'Sith Lord',
        collection: 'STAR_WARS',
        isDark: true,
        background: '#000000',
        cardBackground: '#1a0000',
        header: '#B71C1C',
        headerSecondary: '#8B0000',
        primary: '#B71C1C',
        text: '#ffffff',
        textSecondary: '#ff6b6b',
        textTertiary: '#b71c1c99',
        border: '#B71C1C30',
        inputBackground: '#2a0a0a',
        bubbleOwn: '#B71C1C',
        bubbleOther: '#1a0000',
        bubbleOwnText: '#ffffff',
        bubbleOtherText: '#ffffff'
    },
    jedi_master: {
        id: 'jedi_master',
        name: 'Jedi Master',
        collection: 'STAR_WARS',
        isDark: false,
        background: '#F5F5DC',
        cardBackground: '#FFFEF7',
        header: '#558B2F',
        headerSecondary: '#7CB342',
        primary: '#558B2F',
        text: '#33691E',
        textSecondary: '#689F38',
        textTertiary: '#8BC34A',
        border: '#558B2F30',
        inputBackground: '#E8F5E9',
        bubbleOwn: '#558B2F',
        bubbleOther: '#ffffff',
        bubbleOwnText: '#ffffff',
        bubbleOtherText: '#33691E'
    },

    // --- MARVEL ---
    iron_man: {
        id: 'iron_man',
        name: 'Iron Man',
        collection: 'MARVEL',
        isDark: true,
        background: '#0a0a0a',
        cardBackground: '#1a1a1a',
        header: '#B71C1C',
        headerSecondary: '#FFD700',
        primary: '#B71C1C',
        text: '#FFD700',
        textSecondary: '#FFC107',
        textTertiary: '#FF9800',
        border: '#FFD70030',
        inputBackground: '#2a2a2a',
        bubbleOwn: '#B71C1C',
        bubbleOther: '#1a1a1a',
        bubbleOwnText: '#FFD700',
        bubbleOtherText: '#FFD700'
    },

    // --- WARCRAFT ---
    horde: {
        id: 'horde',
        name: 'La Horda',
        collection: 'WARCRAFT',
        isDark: true,
        background: '#261616',
        cardBackground: '#3d1f1f',
        header: '#8B0000',
        headerSecondary: '#FF4500',
        primary: '#8B0000',
        text: '#FFCDD2',
        textSecondary: '#EF9A9A',
        textTertiary: '#E57373',
        border: '#8B000030',
        inputBackground: '#4d2a2a',
        bubbleOwn: '#8B0000',
        bubbleOther: '#3d1f1f',
        bubbleOwnText: '#ffffff',
        bubbleOtherText: '#FFCDD2'
    },
    alliance: {
        id: 'alliance',
        name: 'La Alianza',
        collection: 'WARCRAFT',
        isDark: false,
        background: '#E3F2FD',
        cardBackground: '#ffffff',
        header: '#003366',
        headerSecondary: '#1565C0',
        primary: '#003366',
        text: '#1A237E',
        textSecondary: '#3F51B5',
        textTertiary: '#7986CB',
        border: '#00336630',
        inputBackground: '#BBDEFB',
        bubbleOwn: '#003366',
        bubbleOther: '#ffffff',
        bubbleOwnText: '#FFD700',
        bubbleOtherText: '#1A237E'
    }
};

// Lista de temas disponibles agrupados por colección
export const CHAT_THEMES_LIST = Object.values(CHAT_THEMES);
export const CHAT_THEME_COLLECTIONS = ['BASICO', 'POKEMON', 'STAR_WARS', 'MARVEL', 'WARCRAFT'];

// IDs de temas que vienen desbloqueados por defecto (básicos)
export const DEFAULT_UNLOCKED_THEMES = ['default_light', 'default_dark'];

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTO
// ═══════════════════════════════════════════════════════════════════════════

const CHAT_FONT_SIZE_KEY = 'chat_font_size';

const ChatThemeContext = createContext({
    chatTheme: CHAT_THEMES.default_light,
    chatThemeId: 'default_light',
    setChatThemeId: async () => { },
    availableChatThemes: CHAT_THEMES_LIST,
    fontSize: 'medium',
    setFontSize: async () => { }
});

export const useChatTheme = () => {
    const context = useContext(ChatThemeContext);
    if (!context) {
        throw new Error('useChatTheme debe usarse dentro de ChatThemeProvider');
    }
    return context;
};

export const ChatThemeProvider = ({ children }) => {
    const [chatThemeId, setChatThemeIdState] = useState('default_light');
    const [fontSize, setFontSizeState] = useState('medium'); // 'small', 'medium', 'large'

    // Cargar tema y tamaño de letra guardados
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [[, savedId], [, savedFontSize]] = await AsyncStorage.multiGet([
                    CHAT_THEME_KEY, CHAT_FONT_SIZE_KEY,
                ]);
                if (savedId && CHAT_THEMES[savedId]) {
                    setChatThemeIdState(savedId);
                }
                if (savedFontSize) {
                    setFontSizeState(savedFontSize);
                }
            } catch (error) {
                console.warn('[ChatTheme] Error loading:', error);
            }
        };
        loadSettings();
    }, []);

    const setChatThemeId = async (id) => {
        try {
            if (CHAT_THEMES[id]) {
                await AsyncStorage.setItem(CHAT_THEME_KEY, id);
                setChatThemeIdState(id);
            }
        } catch (error) {
            console.warn('[ChatTheme] Error saving:', error);
        }
    };

    const setFontSize = async (size) => {
        try {
            await AsyncStorage.setItem(CHAT_FONT_SIZE_KEY, size);
            setFontSizeState(size);
        } catch (error) {
            console.warn('[ChatTheme] Error saving font size:', error);
        }
    };

    const chatTheme = CHAT_THEMES[chatThemeId] || CHAT_THEMES.default_light;

    // Calcular tamaño de fuente en píxeles
    const fontSizeValue = fontSize === 'small' ? 13 : fontSize === 'large' ? 17 : 15;

    return (
        <ChatThemeContext.Provider value={{
            chatTheme,
            chatThemeId,
            setChatThemeId,
            availableChatThemes: CHAT_THEMES_LIST,
            fontSize,
            fontSizeValue,
            setFontSize
        }}>
            {children}
        </ChatThemeContext.Provider>
    );
};

export default ChatThemeContext;
