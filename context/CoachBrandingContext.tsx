// context/CoachBrandingContext.tsx
// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTO PARA BRANDING DE COACH (aplicado a clientes)
// ═══════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

export interface CoachBranding {
    isActive: boolean;
    variantId: 'dark' | 'vibrant' | 'balanced';
    colors: CoachBrandingColors;
    patternUrl?: string;
    fontFamily: string;
    mood: string;
    brandName?: string;
}

interface CoachBrandingContextType {
    branding: CoachBranding | null;
    loading: boolean;
    hasCoachBranding: boolean;
    refresh: () => Promise<void>;
}

const CoachBrandingContext = createContext<CoachBrandingContextType>({
    branding: null,
    loading: false,
    hasCoachBranding: false,
    refresh: async () => { },
});

export const CoachBrandingProvider = ({ children }: { children: ReactNode }) => {
    const { user, token } = useAuth();
    const [branding, setBranding] = useState<CoachBranding | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchBranding = async () => {
        // No token = no branding
        if (!token) {
            setBranding(null);
            return;
        }

        setLoading(true);

        try {
            let response;

            // PRIORIDAD 1: Si el usuario tiene un coach asignado - usar branding del coach superior
            // (Esto aplica tanto para clientes como para entrenadores que son clientes de otro)
            if (user?.currentTrainerId) {
                console.log('[CoachBranding] Loading from coach:', user.currentTrainerId);
                response = await fetch(
                    `${API_URL}/api/coach/branding/for-client/${user.currentTrainerId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );
            }
            // CASO 2: El usuario es ENTRENADOR sin coach superior - cargar su propio branding
            else if (user?.tipoUsuario === 'ENTRENADOR') {
                console.log('[CoachBranding] Loading own branding (coach)');
                response = await fetch(
                    `${API_URL}/api/coach/branding/current`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );
            }
            // CASO 3: Usuario sin coach y no es entrenador - no hay branding
            else {
                setBranding(null);
                setLoading(false);
                return;
            }

            const data = await response.json();

            if (data.success && data.branding) {
                console.log('[CoachBranding] Branding loaded:', data.branding.variantId,
                    user?.tipoUsuario === 'ENTRENADOR' ? '(own)' : '(from coach)');
                setBranding(data.branding);
            } else {
                setBranding(null);
            }
        } catch (err) {
            console.error('[CoachBranding] Error fetching branding:', err);
            setBranding(null);
        } finally {
            setLoading(false);
        }
    };

    // Cargar branding cuando cambia el usuario o su trainer
    useEffect(() => {
        fetchBranding();
    }, [user?.currentTrainerId, user?.tipoUsuario, token]);

    const value: CoachBrandingContextType = {
        branding,
        loading,
        hasCoachBranding: !!branding && branding.isActive,
        refresh: fetchBranding,
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

// Exportar para uso en ThemeContext
export { CoachBrandingContext };
