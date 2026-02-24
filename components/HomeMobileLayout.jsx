/**
 * components/HomeMobileLayout.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * Layout flotante para Home en móvil (iOS/Android)
 * Logo en card separada + botones flotantes
 * 
 * ESTE ARCHIVO SOLO SE USA EN MÓVIL - NO SE CARGA EN WEB
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useStableWindowDimensions } from '../src/hooks/useStableBreakpoint';
import { Link } from 'expo-router';
import ActionButton from './ActionButton';

/**
 * HomeMobileLayout - Layout flotante para móvil
 */
export default function HomeMobileLayout({
    theme,
    isDark,
    topMargin,
    currentTrainer,
    user,
    handlePerfilPress,
    unreadFeedbackReports,
    bannerBg,
    fraseActual,
    APP_VERSION,
    seguimientoBadgeLargeStyle,
    seguimientoBadgeTextStyle,
    seguimientoBtnGoldenStyle,
}) {
    const { width } = useStableWindowDimensions();

    // Colores glassmorphism
    const glassCardBg = isDark
        ? 'rgba(30, 41, 59, 0.85)'
        : 'rgba(255, 255, 255, 0.92)';
    const glassCardBorder = isDark
        ? 'rgba(255, 255, 255, 0.10)'
        : 'rgba(255, 255, 255, 0.60)';

    // Logo URL
    const logoUrl = currentTrainer?.profile?.logoUrl ||
        (user?.trainerProfile?.logoUrl && !user?.currentTrainerId ? user.trainerProfile.logoUrl : null);

    // Nombre a mostrar
    const displayName = currentTrainer?.profile?.brandName || currentTrainer?.nombre ||
        (user?.trainerProfile?.brandName && !user?.currentTrainerId ? user.trainerProfile.brandName : 'TotalGains');

    return (
        <>
            {/* Card del Logo */}
            <View style={[
                styles.logoCard,
                {
                    marginTop: topMargin,
                    backgroundColor: glassCardBg,
                    borderColor: glassCardBorder,
                }
            ]}>
                <View style={styles.logoContainer}>
                    {logoUrl ? (
                        <Image
                            source={{ uri: logoUrl }}
                            resizeMode="contain"
                            style={[styles.logoImage, {
                                width: width * 0.3,
                                height: width * 0.3,
                                maxHeight: 140,
                                maxWidth: 140,
                            }]}
                        />
                    ) : (
                        <Image
                            source={require('../assets/logo.png')}
                            resizeMode="contain"
                            style={[styles.logoImage, {
                                width: width * 0.3,
                                height: width * 0.3,
                                maxHeight: 140,
                                maxWidth: 140,
                            }]}
                        />
                    )}
                </View>
            </View>

            {/* Título y subtítulo flotantes */}
            <Text style={[styles.title, { color: theme.text }]}>
                {displayName}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Tu progreso, bien medido.
            </Text>

            {/* Botones flotantes */}
            <View style={styles.buttonWrapper}>
                <Link href="/entreno" asChild>
                    <ActionButton title="Empezar entreno" icon="barbell-outline" variant="primary" />
                </Link>
            </View>



            <View style={styles.buttonWrapper}>
                <Link href="/nutricion" asChild>
                    <ActionButton title="Nutrición" icon="nutrition-outline" variant="secondary" />
                </Link>
            </View>

            <View style={[styles.buttonWrapper, { position: 'relative' }]}>
                <Link href="/seguimiento" asChild>
                    <ActionButton
                        title="Seguimiento"
                        icon="analytics-outline"
                        variant="secondary"
                        style={unreadFeedbackReports > 0 ? seguimientoBtnGoldenStyle : undefined}
                    />
                </Link>
                {unreadFeedbackReports > 0 ? (
                    <View style={seguimientoBadgeLargeStyle}>
                        <Text style={seguimientoBadgeTextStyle}>+{unreadFeedbackReports}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.buttonWrapper}>
                <ActionButton
                    title="Perfil"
                    icon="person-outline"
                    variant="secondary"
                    onPress={handlePerfilPress}
                />
            </View>

            {/* Version */}
            <Text style={[styles.version, { color: theme.textSecondary }]}>
                V{APP_VERSION} • TOTALGAINS
            </Text>
            <Link href="https://totalgains.es/app" asChild>
                <Text style={[styles.website, { color: theme.primary }]}>
                    www.TotalGains.es
                </Text>
            </Link>

            {/* Banner */}
            <View style={[styles.bannerContainer, { backgroundColor: bannerBg }]}>
                <Text style={styles.bannerText}>{fraseActual}</Text>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    logoCard: {
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoImage: {
        borderRadius: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginTop: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        marginTop: 4,
        marginBottom: 20,
        textAlign: 'center',
    },
    buttonWrapper: {
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
        marginBottom: 12,
    },
    version: {
        marginTop: 16,
        fontSize: 11,
    },
    website: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 4,
        marginBottom: 16,
    },
    bannerContainer: {
        width: '100%',
        marginTop: 20,
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    bannerText: {
        color: '#D1D5DB',
        fontSize: 14,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 20,
    },
});
