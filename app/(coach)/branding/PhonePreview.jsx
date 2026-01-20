// app/(coach)/branding/PhonePreview.jsx
// ═══════════════════════════════════════════════════════════════════════════
// PHONE MOCKUP PREVIEW - Simula la UI de la app con los colores del tema
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const PhonePreview = ({ theme, fontName, logoUrl }) => {
    const { colors } = theme;

    return (
        <View style={styles.phoneFrame}>
            {/* Notch */}
            <View style={styles.notch}>
                <View style={styles.notchInner} />
            </View>

            {/* Screen Content */}
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        {logoUrl ? (
                            <Image source={{ uri: logoUrl }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
                                <Ionicons name="person" size={16} color={colors.text} />
                            </View>
                        )}
                    </View>
                    <Text style={[styles.greeting, { color: colors.text, fontFamily: fontName }]}>
                        Hola, Atleta
                    </Text>
                </View>

                {/* Training Card */}
                <View style={[styles.trainingCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.cardLabel, { color: colors.text }]}>
                        ENTRENAMIENTO DE HOY
                    </Text>
                    <Text style={[styles.cardTitle, { color: colors.text, fontFamily: fontName }]}>
                        Upper Body Power
                    </Text>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: '60%' }]} />
                    </View>
                </View>

                {/* CTA Button */}
                <View style={[styles.ctaButton, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.ctaText, { fontFamily: fontName, color: colors.primaryText || '#FFFFFF' }]}>
                        Empezar Sesión
                    </Text>
                </View>

                {/* Exercise List */}
                <View style={styles.exerciseList}>
                    {[1, 2].map((i) => (
                        <View key={i} style={[styles.exerciseRow, { backgroundColor: colors.surface }]}>
                            <View style={[styles.exerciseIcon, { backgroundColor: `${colors.primary}20` }]}>
                                <Ionicons name="barbell" size={14} color={colors.primary} />
                            </View>
                            <View style={styles.exerciseInfo}>
                                <View style={[styles.textLine, { backgroundColor: colors.text, width: 80 }]} />
                                <View style={[styles.textLine, { backgroundColor: colors.text, width: 50, opacity: 0.3, marginTop: 4 }]} />
                            </View>
                        </View>
                    ))}
                </View>

                {/* Tab Bar */}
                <View style={[styles.tabBar, { backgroundColor: `${colors.surface}EE` }]}>
                    <Ionicons name="home" size={20} color={colors.primary} />
                    <Ionicons name="flash" size={20} color={colors.text} style={{ opacity: 0.3 }} />
                    <Ionicons name="person" size={20} color={colors.text} style={{ opacity: 0.3 }} />
                </View>
            </View>

            {/* Home Indicator */}
            <View style={styles.homeIndicator} />
        </View>
    );
};

const styles = StyleSheet.create({
    phoneFrame: {
        width: 260,
        height: 540,
        backgroundColor: '#1a1a1a',
        borderRadius: 40,
        padding: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    notch: {
        position: 'absolute',
        top: 10,
        left: '50%',
        marginLeft: -50,
        width: 100,
        height: 28,
        backgroundColor: '#1a1a1a',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        zIndex: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notchInner: {
        width: 60,
        height: 5,
        backgroundColor: '#333',
        borderRadius: 3,
        marginTop: 8,
    },
    screen: {
        flex: 1,
        borderRadius: 30,
        overflow: 'hidden',
        paddingTop: 40,
        paddingHorizontal: 14,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
        marginRight: 10,
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    greeting: {
        fontSize: 13,
        fontWeight: '600',
        opacity: 0.8,
    },
    trainingCard: {
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
    },
    cardLabel: {
        fontSize: 9,
        letterSpacing: 1,
        opacity: 0.5,
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 10,
    },
    progressTrack: {
        height: 6,
        backgroundColor: 'rgba(128,128,128,0.2)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    ctaButton: {
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    ctaText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    exerciseList: {
        flex: 1,
        gap: 8,
    },
    exerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 10,
    },
    exerciseIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    exerciseInfo: {
        marginLeft: 10,
    },
    textLine: {
        height: 6,
        borderRadius: 3,
        opacity: 0.5,
    },
    tabBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 50,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    homeIndicator: {
        position: 'absolute',
        bottom: 14,
        left: '50%',
        marginLeft: -45,
        width: 90,
        height: 4,
        backgroundColor: '#666',
        borderRadius: 2,
    },
});

export default PhonePreview;
