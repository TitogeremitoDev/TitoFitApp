/**
 * components/BrandBackground.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * Componente de fondo dinámico con "Blobs" que usa los colores del tema.
 * 
 * ESTRATEGIA HÍBRIDA:
 * - Web: View con CSS gradients (evita react-native-svg que rompe el bundler)
 * - Nativo: react-native-svg con RadialGradient para efectos más suaves
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';

// Solo importar SVG en nativo para evitar crash en web
let Svg, Defs, RadialGradient, Stop, Rect;
if (Platform.OS !== 'web') {
    const SvgModule = require('react-native-svg');
    Svg = SvgModule.Svg;
    Defs = SvgModule.Defs;
    RadialGradient = SvgModule.RadialGradient;
    Stop = SvgModule.Stop;
    Rect = SvgModule.Rect;
}

/**
 * Convierte color hex a rgba
 */
const hexToRgba = (hex, alpha) => {
    if (!hex || typeof hex !== 'string') return `rgba(59, 130, 246, ${alpha})`;
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 59;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 130;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 246;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * BrandBackground - Fondo con blobs dinámicos
 * 
 * @param {string} primaryColor - Color primario para blob superior-izq (default: #3B82F6)
 * @param {string} accentColor - Color accent para blob inferior-der (default: #10B981)
 * @param {boolean} isDark - Si es modo oscuro (afecta opacidad)
 * @param {string} backgroundColor - Color base del fondo
 */
export default function BrandBackground({
    primaryColor = '#3B82F6',
    accentColor = '#10B981',
    isDark = true,
    backgroundColor,
}) {
    // Opacidades según modo
    const blobOpacity = isDark ? 0.35 : 0.20;

    // Color de fondo base
    const bgColor = backgroundColor || (isDark ? '#0F172A' : '#F8FAFC');

    // ═══════════════════════════════════════════════════════════════
    // WEB: CSS puro, sin SVG
    // ═══════════════════════════════════════════════════════════════
    if (Platform.OS === 'web') {
        const primaryRgba = hexToRgba(primaryColor, blobOpacity);
        const accentRgba = hexToRgba(accentColor, blobOpacity);

        return (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]}>
                {/* Blob superior izquierdo */}
                <View
                    style={{
                        position: 'absolute',
                        top: -100,
                        left: -100,
                        width: 400,
                        height: 400,
                        borderRadius: 200,
                        background: `radial-gradient(circle, ${primaryRgba} 0%, transparent 70%)`,
                    }}
                />
                {/* Blob inferior derecho */}
                <View
                    style={{
                        position: 'absolute',
                        bottom: -100,
                        right: -100,
                        width: 400,
                        height: 400,
                        borderRadius: 200,
                        background: `radial-gradient(circle, ${accentRgba} 0%, transparent 70%)`,
                    }}
                />
            </View>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // NATIVO: SVG con RadialGradient - usando dimensiones de pantalla
    // ═══════════════════════════════════════════════════════════════
    const { width, height } = Dimensions.get('window');

    return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]} pointerEvents="none">
            <Svg
                width={width}
                height={height}
                style={StyleSheet.absoluteFill}
            >
                <Defs>
                    {/* Gradiente para blob superior-izquierdo */}
                    <RadialGradient
                        id="blobTop"
                        cx="0"
                        cy="0"
                        r={width * 0.8}
                        gradientUnits="userSpaceOnUse"
                    >
                        <Stop offset="0" stopColor={primaryColor || '#3B82F6'} stopOpacity={blobOpacity} />
                        <Stop offset="1" stopColor={primaryColor || '#3B82F6'} stopOpacity={0} />
                    </RadialGradient>

                    {/* Gradiente para blob inferior-derecho */}
                    <RadialGradient
                        id="blobBottom"
                        cx={width}
                        cy={height}
                        r={width * 0.8}
                        gradientUnits="userSpaceOnUse"
                    >
                        <Stop offset="0" stopColor={accentColor || '#10B981'} stopOpacity={blobOpacity} />
                        <Stop offset="1" stopColor={accentColor || '#10B981'} stopOpacity={0} />
                    </RadialGradient>
                </Defs>

                {/* Rectángulo con gradiente superior-izquierdo */}
                <Rect
                    x="0"
                    y="0"
                    width={width}
                    height={height}
                    fill="url(#blobTop)"
                />

                {/* Rectángulo con gradiente inferior-derecho */}
                <Rect
                    x="0"
                    y="0"
                    width={width}
                    height={height}
                    fill="url(#blobBottom)"
                />
            </Svg>
        </View>
    );
}

