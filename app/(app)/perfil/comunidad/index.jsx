import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import { useAuth } from '../../../../context/AuthContext';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function Comunidad() {
    const { theme, isDark } = useTheme();
    const { user } = useAuth();

    const gradientColors = isDark
        ? ['#0B1220', '#0D1B2A', '#111827']
        : ['#f0f4f8', '#e0e7ef', '#d1dce6'];

    return (
        <View style={styles.root}>
            <Stack.Screen options={{ headerShown: false }} />
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Comunidad</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                    Conecta con otros atletas
                </Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Placeholder content - to be expanded */}
                <View style={[styles.comingSoonCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.primaryLight }]}>
                        <Ionicons name="globe" size={48} color={theme.primary} />
                    </View>
                    <Text style={[styles.comingSoonTitle, { color: theme.text }]}>
                        ¡Próximamente!
                    </Text>
                    <Text style={[styles.comingSoonText, { color: theme.textSecondary }]}>
                        Estamos trabajando en una experiencia de comunidad increíble donde podrás:
                    </Text>

                    <View style={styles.featuresList}>
                        <View style={styles.featureItem}>
                            <Ionicons name="chatbubbles" size={20} color={theme.primary} />
                            <Text style={[styles.featureText, { color: theme.text }]}>
                                Chatear con otros atletas
                            </Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="podium" size={20} color={theme.primary} />
                            <Text style={[styles.featureText, { color: theme.text }]}>
                                Competir en retos semanales
                            </Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="share-social" size={20} color={theme.primary} />
                            <Text style={[styles.featureText, { color: theme.text }]}>
                                Compartir tu progreso
                            </Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="search" size={20} color={theme.primary} />
                            <Text style={[styles.featureText, { color: theme.text }]}>
                                Descubrir nuevas rutinas
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? 36 : 50,
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    comingSoonCard: {
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    comingSoonTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 8,
    },
    comingSoonText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    featuresList: {
        width: '100%',
        gap: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    featureText: {
        fontSize: 15,
        fontWeight: '500',
    },
});
