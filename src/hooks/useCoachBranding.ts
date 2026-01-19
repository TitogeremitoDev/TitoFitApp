// src/hooks/useCoachBranding.ts
// ═══════════════════════════════════════════════════════════════════════════
// HOOK PARA OBTENER BRANDING DEL COACH (para clientes)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

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

interface UseCoachBrandingResult {
    branding: CoachBranding | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

/**
 * Hook para obtener el branding del coach al que está vinculado el usuario
 * Solo funciona si el usuario tiene un currentTrainerId
 */
export const useCoachBranding = (): UseCoachBrandingResult => {
    const { user, token } = useAuth();
    const [branding, setBranding] = useState<CoachBranding | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBranding = async () => {
        // Solo buscar branding si el usuario tiene un coach asignado
        if (!user?.currentTrainerId || !token) {
            setBranding(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${API_URL}/api/coach/branding/for-client/${user.currentTrainerId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (data.success && data.branding) {
                setBranding(data.branding);
            } else {
                setBranding(null);
            }
        } catch (err) {
            console.error('[useCoachBranding] Error fetching branding:', err);
            setError(err instanceof Error ? err.message : 'Error loading branding');
            setBranding(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranding();
    }, [user?.currentTrainerId, token]);

    return {
        branding,
        loading,
        error,
        refresh: fetchBranding
    };
};

/**
 * Utilidad para aplicar branding del coach sobre un tema base
 * Retorna un objeto con los colores del coach que sobrescriben los del tema
 */
export const mergeWithCoachBranding = (
    baseTheme: any,
    coachBranding: CoachBranding | null
): any => {
    if (!coachBranding || !coachBranding.isActive) {
        return baseTheme;
    }

    const { colors, fontFamily, patternUrl } = coachBranding;

    return {
        ...baseTheme,
        // Override primary colors
        primary: colors.primary,
        background: colors.background,
        cardBackground: colors.surface,
        text: colors.text,
        // Add coach-specific properties
        fontFamily: fontFamily || baseTheme.fontFamily,
        backgroundPatternUrl: patternUrl,
        isCoachBranded: true,
    };
};
