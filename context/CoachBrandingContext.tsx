// context/CoachBrandingContext.tsx
// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTO PARA BRANDING DE COACH (aplicado a clientes)
// ═══════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// Tipos
export interface CoachBrandingColors {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
}

// Tema individual disponible
export interface CoachTheme {
    id: 'dark' | 'vibrant' | 'balanced';
    displayName: string;
    colors: CoachBrandingColors;
    patternUrl?: string;
}

// Branding completo del coach (con múltiples temas)
export interface CoachBranding {
    isActive: boolean;
    activeThemes: CoachTheme[];
    defaultVariantId: 'dark' | 'vibrant' | 'balanced';
    fontFamily: string;
    mood?: string;
    brandName?: string;
    // Mantener compatibilidad con código antiguo
    variantId?: 'dark' | 'vibrant' | 'balanced';
    colors?: CoachBrandingColors;
    patternUrl?: string;
}

interface CoachBrandingContextType {
    branding: CoachBranding | null;
    activeTheme: CoachTheme | null; // Tema activo (considerando preferencia del cliente)
    loading: boolean;
    hasCoachBranding: boolean;
    clientPreference: string | null;
    setClientPreference: (variantId: string) => Promise<void>;
    refresh: () => Promise<void>;
}

const STORAGE_KEY = 'totalgains_client_theme_preference';

const CoachBrandingContext = createContext<CoachBrandingContextType>({
    branding: null,
    activeTheme: null,
    loading: false,
    hasCoachBranding: false,
    clientPreference: null,
    setClientPreference: async () => { },
    refresh: async () => { },
});

export const CoachBrandingProvider = ({ children }: { children: ReactNode }) => {
    const { user, token } = useAuth();
    const [branding, setBranding] = useState<CoachBranding | null>(null);
    const [loading, setLoading] = useState(false);
    const [clientPreference, setClientPreferenceState] = useState<string | null>(null);
    const hasFetched = useRef(false);

    // Cargar preferencia del cliente desde AsyncStorage
    useEffect(() => {
        (async () => {
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (saved) {
                setClientPreferenceState(saved);
            }
        })();
    }, []);

    // Guardar preferencia del cliente
    const setClientPreference = async (variantId: string) => {
        setClientPreferenceState(variantId);
        await AsyncStorage.setItem(STORAGE_KEY, variantId);
    };

    // ═══════════════════════════════════════════════════════════════
    // TEMA ACTIVO: Con fallback al default si la preferencia es inválida
    // ═══════════════════════════════════════════════════════════════
    const activeTheme = useMemo(() => {
        if (!branding || !branding.isActive || !branding.activeThemes?.length) {
            return null;
        }

        // 1. ¿El cliente tiene una preferencia guardada?
        if (clientPreference) {
            // 2. ¿Esa preferencia sigue estando permitida por el coach?
            const isVariantAllowed = branding.activeThemes.find(t => t.id === clientPreference);
            if (isVariantAllowed) {
                return isVariantAllowed; // ✅ Usar elección del cliente
            }
        }

        // 3. Fallback: Usar el default del coach
        const defaultTheme = branding.activeThemes.find(t => t.id === branding.defaultVariantId);
        return defaultTheme || branding.activeThemes[0]; // Último recurso
    }, [branding, clientPreference]);

    const fetchBranding = async (force = false) => {
        if (hasFetched.current && !force) {
            return;
        }
        if (!token) {
            setBranding(null);
            return;
        }

        setLoading(true);

        try {
            let response;

            // PRIORIDAD 1: Si el usuario tiene un coach asignado
            if (user?.currentTrainerId) {
                console.log('[CoachBranding] Loading from coach:', user.currentTrainerId);
                response = await fetch(
                    `${API_URL}/api/coach/branding/for-client/${user.currentTrainerId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
            // CASO 2: El usuario es ENTRENADOR o ADMIN - cargar su propio branding
            else if (user?.tipoUsuario === 'ENTRENADOR' || user?.tipoUsuario === 'ADMINISTRADOR') {
                console.log('[CoachBranding] Loading own branding (coach)');
                response = await fetch(
                    `${API_URL}/api/coach/branding/current`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
            // CASO 3: Usuario sin coach y no es entrenador
            else {
                setBranding(null);
                hasFetched.current = true;
                setLoading(false);
                return;
            }

            const data = await response.json();

            if (data.success && data.branding) {
                // Normalizar respuesta (el backend puede devolver formato antiguo o nuevo)
                let normalizedBranding: CoachBranding;

                if (data.branding.activeThemes) {
                    // Formato nuevo
                    normalizedBranding = data.branding;
                } else {
                    // Formato antiguo (fallback para SSR o caché)
                    const displayNames: Record<string, string> = {
                        dark: 'Modo Oscuro',
                        vibrant: 'Modo Claro',
                        balanced: 'Modo Suave'
                    };
                    normalizedBranding = {
                        isActive: data.branding.isActive,
                        activeThemes: [{
                            id: data.branding.variantId,
                            displayName: displayNames[data.branding.variantId] || data.branding.variantId,
                            colors: data.branding.colors,
                            patternUrl: data.branding.patternUrl
                        }],
                        defaultVariantId: data.branding.variantId,
                        fontFamily: data.branding.fontFamily,
                        mood: data.branding.mood,
                        brandName: data.branding.brandName,
                        // Compatibilidad
                        variantId: data.branding.variantId,
                        colors: data.branding.colors,
                        patternUrl: data.branding.patternUrl
                    };
                }

                console.log('[CoachBranding] Branding loaded:', normalizedBranding.defaultVariantId);
                setBranding(normalizedBranding);
                hasFetched.current = true;
            } else {
                setBranding(null);
                hasFetched.current = true;
            }
        } catch (err) {
            console.error('[CoachBranding] Error fetching branding:', err);
            setBranding(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranding();
    }, [user?.currentTrainerId, user?.tipoUsuario, token]);

    const value: CoachBrandingContextType = {
        branding,
        activeTheme,
        loading,
        hasCoachBranding: !!branding && branding.isActive,
        clientPreference,
        setClientPreference,
        refresh: () => fetchBranding(true),
    };

    return (
        <CoachBrandingContext.Provider value={value}>
            {children}
        </CoachBrandingContext.Provider>
    );
};

export const useCoachBranding = (): CoachBrandingContextType => {
    const context = useContext(CoachBrandingContext);
    if (!context) {
        throw new Error('useCoachBranding debe usarse dentro de <CoachBrandingProvider>');
    }
    return context;
};

export { CoachBrandingContext };
