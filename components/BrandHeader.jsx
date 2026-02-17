/**
 * components/BrandHeader.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * Brand Header sólido para la pantalla Home.
 * 
 * Crea una barra de encabezado de marca sólida y premium en la parte
 * superior, consolidando logo, nombre, eslogan y botones de acción
 * (Refresh, FAQ, Premium) en una única zona dedicada.
 * 
 * Usa los colores del tema para mantener consistencia con el branding.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    Platform,
    Pressable,
    useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';

/**
 * BrandHeader - Encabezado sólido de marca
 *
 * @param {object} theme - Objeto de tema actual
 * @param {boolean} isDark - Si el tema es oscuro
 * @param {object} currentTrainer - Datos del entrenador actual
 * @param {object} user - Datos del usuario actual
 * @param {boolean} showModeSelector - Mostrar botón de cambio de modo (admin/entrenador)
 * @param {boolean} showPaymentButton - Mostrar botones de FAQ y Premium
 */
export default function BrandHeader({
    theme,
    isDark,
    currentTrainer,
    user,
    showModeSelector = false,
    showPaymentButton = false,
}) {
    const { width } = useWindowDimensions();

    // ═══════════════════════════════════════════════════════════════
    // DATOS DE MARCA
    // ═══════════════════════════════════════════════════════════════

    // Logo URL: jerarquía de prioridad
    const logoUrl = currentTrainer?.profile?.logoUrl ||
        (user?.trainerProfile?.logoUrl && !user?.currentTrainerId ? user.trainerProfile.logoUrl : null);

    // Nombre a mostrar
    const displayName = currentTrainer?.profile?.brandName || currentTrainer?.nombre ||
        (user?.trainerProfile?.brandName && !user?.currentTrainerId ? user.trainerProfile.brandName : 'TotalGains');

    // ═══════════════════════════════════════════════════════════════
    // COLORES DEL HEADER
    // ═══════════════════════════════════════════════════════════════
    // Fondo: usamos el color primario del tema para crear sensación de marca
    // Si es oscuro, usamos un tono más oscuro/profundo; si es claro, un tono rico
    const headerBg = isDark
        ? '#0B1120'  // Azul noche ultra profundo
        : '#1A1F36'; // Azul oscuro elegante

    // Gradiente sutil para profundidad
    const gradientColors = isDark
        ? ['#0B1120', '#111B2E', '#0F1729']
        : ['#1A1F36', '#1E2442', '#1A1F36'];

    // Logo size
    const logoSize = Math.min(width * 0.16, 64);

    return (
        <View style={styles.container}>
            {/* Gradiente de fondo del header */}
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* Fila Superior: Botones de acción */}
            <View style={styles.topRow}>
                {/* Izquierda: Botón Mode Select */}
                <View style={styles.topRowLeft}>
                    {showModeSelector ? (
                        <Link href="/mode-select" asChild>
                            <Pressable
                                style={styles.iconButton}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Text style={styles.iconEmoji}>🔄</Text>
                            </Pressable>
                        </Link>
                    ) : (
                        <View style={styles.iconPlaceholder} />
                    )}
                </View>

                {/* Derecha: FAQ + Premium */}
                <View style={styles.topRowRight}>
                    {showPaymentButton && (
                        <>
                            <Link href="/coach-help" asChild>
                                <Pressable
                                    style={styles.iconButton}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={styles.iconEmoji}>❓</Text>
                                </Pressable>
                            </Link>
                            <Link href="/payment" asChild>
                                <Pressable
                                    style={[styles.iconButton, styles.premiumButton]}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={styles.iconEmoji}>👑</Text>
                                </Pressable>
                            </Link>
                        </>
                    )}
                </View>
            </View>

            {/* Fila Inferior: Logo + Textos de marca */}
            <View style={styles.brandRow}>
                {/* Logo */}
                <View style={[styles.logoWrapper, { width: logoSize, height: logoSize }]}>
                    {logoUrl ? (
                        <Image
                            source={{ uri: logoUrl }}
                            resizeMode="contain"
                            style={[styles.logoImage, { width: logoSize, height: logoSize }]}
                        />
                    ) : (
                        <Image
                            source={require('../assets/logo.png')}
                            resizeMode="contain"
                            style={[styles.logoImage, { width: logoSize, height: logoSize }]}
                        />
                    )}
                </View>

                {/* Nombre + Eslogan */}
                <View style={styles.brandText}>
                    <Text style={styles.brandName} numberOfLines={1}>
                        {displayName}
                    </Text>
                    <Text style={styles.brandSlogan} numberOfLines={1}>
                        Tu progreso, bien medido.
                    </Text>
                </View>
            </View>

            {/* Línea decorativa sutil en el borde inferior */}
            <View style={[styles.bottomAccent, { backgroundColor: theme.primary }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        // En iOS incluir padding para safe area (notch)
        paddingTop: Platform.OS === 'ios' ? 54 : (Platform.OS === 'android' ? 40 : 20),
        paddingBottom: 16,
        paddingHorizontal: 20,
        overflow: 'hidden',
        // Sombra suave inferior
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 12,
    },

    // ═══════════════════════════════════════════════════════════════
    // FILA SUPERIOR: Botones de acción
    // ═══════════════════════════════════════════════════════════════
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    topRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    topRowRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.10)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    premiumButton: {
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        borderColor: 'rgba(255, 215, 0, 0.25)',
    },
    iconEmoji: {
        fontSize: 18,
    },
    iconPlaceholder: {
        width: 40,
        height: 40,
    },

    // ═══════════════════════════════════════════════════════════════
    // FILA INFERIOR: Logo + Marca
    // ═══════════════════════════════════════════════════════════════
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    logoWrapper: {
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    logoImage: {
        borderRadius: 12,
    },
    brandText: {
        flex: 1,
        justifyContent: 'center',
    },
    brandName: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    brandSlogan: {
        color: 'rgba(255, 255, 255, 0.65)',
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
        letterSpacing: 0.3,
    },

    // ═══════════════════════════════════════════════════════════════
    // DETALLE DECORATIVO
    // ═══════════════════════════════════════════════════════════════
    bottomAccent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2.5,
        opacity: 0.6,
    },
});
