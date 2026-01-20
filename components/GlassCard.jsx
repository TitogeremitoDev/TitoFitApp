/**
 * components/GlassCard.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * Componente de tarjeta con efecto Glassmorphism que usa colores del tema.
 * 
 * USO:
 * <GlassCard>
 *   <Text>Contenido</Text>
 * </GlassCard>
 * 
 * VARIANTES:
 * - default: Tarjeta estándar con bordes muy redondeados
 * - compact: Tarjeta más pequeña con menos padding
 * - flat: Sin sombra, para uso dentro de otras cards
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * GlassCard - Tarjeta con efecto Glassmorphism dinámico
 * 
 * @param {React.ReactNode} children - Contenido de la tarjeta
 * @param {string} variant - 'default' | 'compact' | 'flat'
 * @param {object} style - Estilos adicionales
 */
export default function GlassCard({
    children,
    variant = 'default',
    style,
    ...props
}) {
    const { theme, isDark } = useTheme();

    // Colores de fondo según modo
    const glassBackground = isDark
        ? 'rgba(30, 41, 59, 0.85)'    // Slate-800 al 85%
        : 'rgba(255, 255, 255, 0.92)'; // Blanco al 92%

    // Borde según modo
    const glassBorder = isDark
        ? 'rgba(255, 255, 255, 0.10)'
        : 'rgba(0, 0, 0, 0.08)';

    // Estilos por variante
    const variantStyles = {
        default: {
            padding: 20,
            borderRadius: 24,
            shadowOpacity: 0.12,
            shadowRadius: 20,
        },
        compact: {
            padding: 14,
            borderRadius: 16,
            shadowOpacity: 0.08,
            shadowRadius: 12,
        },
        flat: {
            padding: 16,
            borderRadius: 16,
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0,
        },
    };

    const v = variantStyles[variant] || variantStyles.default;

    return (
        <View
            style={[
                styles.base,
                {
                    backgroundColor: glassBackground,
                    borderColor: glassBorder,
                    padding: v.padding,
                    borderRadius: v.borderRadius,
                    shadowOpacity: v.shadowOpacity,
                    shadowRadius: v.shadowRadius,
                    elevation: variant === 'flat' ? 0 : 8,
                },
                style,
            ]}
            {...props}
        >
            {children}
        </View>
    );
}

/**
 * Hook para obtener estilos de glass manualmente (para casos especiales)
 */
export function useGlassStyles() {
    const { isDark } = useTheme();

    return {
        background: isDark
            ? 'rgba(30, 41, 59, 0.85)'
            : 'rgba(255, 255, 255, 0.92)',
        border: isDark
            ? 'rgba(255, 255, 255, 0.10)'
            : 'rgba(0, 0, 0, 0.08)',
        borderRadius: 24,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
    };
}

const styles = StyleSheet.create({
    base: {
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        // Los demás valores se aplican dinámicamente
    },
});
