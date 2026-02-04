import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CoachHeader from '../components/CoachHeader';
import { resetCoachOnboarding } from '../../../components/CoachOnboardingModal';

export default function SettingsScreen() {
    const router = useRouter();
    const [resettingTutorial, setResettingTutorial] = useState(false);

    // Reiniciar el tutorial de onboarding
    const handleResetTutorial = async () => {
        if (Platform.OS === 'web') {
            const confirmed = window.confirm('¿Reiniciar Tutorial?\n\nEl tutorial de bienvenida aparecerá la próxima vez que entres al panel de coach.');
            if (confirmed) {
                setResettingTutorial(true);
                const success = await resetCoachOnboarding();
                setResettingTutorial(false);

                if (success) {
                    window.alert('✅ Tutorial Reiniciado\n\nEl tutorial aparecerá cuando vuelvas al panel principal.');
                    router.replace('/(coach)');
                } else {
                    window.alert('Error: No se pudo reiniciar el tutorial.');
                }
            }
        } else {
            Alert.alert(
                '¿Reiniciar Tutorial?',
                'El tutorial de bienvenida aparecerá la próxima vez que entres al panel de coach.',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                        text: 'Reiniciar',
                        onPress: async () => {
                            setResettingTutorial(true);
                            const success = await resetCoachOnboarding();
                            setResettingTutorial(false);

                            if (success) {
                                Alert.alert(
                                    '✅ Tutorial Reiniciado',
                                    'El tutorial aparecerá cuando vuelvas al panel principal.',
                                    [{ text: 'Ir al Panel', onPress: () => router.replace('/(coach)') }]
                                );
                            } else {
                                Alert.alert('Error', 'No se pudo reiniciar el tutorial.');
                            }
                        }
                    }
                ]
            );
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Configuración"
                subtitle="Ajustes del sistema"
                icon="settings"
                iconColor="#64748b"
            />

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Sección de Ayuda y Soporte */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Ayuda y Soporte</Text>

                    {/* Botón Reiniciar Tutorial */}
                    <TouchableOpacity
                        style={styles.settingCard}
                        onPress={handleResetTutorial}
                        disabled={resettingTutorial}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.settingIcon, { backgroundColor: '#3b82f615' }]}>
                            <Ionicons name="school-outline" size={24} color="#3b82f6" />
                        </View>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingTitle}>Reiniciar Tutorial de Entrenador</Text>
                            <Text style={styles.settingDescription}>
                                Vuelve a ver el tour guiado del panel de control
                            </Text>
                        </View>
                        <Ionicons name="refresh-outline" size={22} color="#64748b" />
                    </TouchableOpacity>

                    {/* Botón Visitar Web */}
                    <TouchableOpacity
                        style={styles.settingCard}
                        onPress={() => {
                            const { Linking } = require('react-native');
                            Linking.openURL('https://www.totalgain.es');
                        }}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.settingIcon, { backgroundColor: '#10b98115' }]}>
                            <Ionicons name="globe-outline" size={24} color="#10b981" />
                        </View>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingTitle}>Visitar TotalGain.es</Text>
                            <Text style={styles.settingDescription}>
                                Trucos avanzados, tutoriales y soporte
                            </Text>
                        </View>
                        <Ionicons name="open-outline" size={22} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {/* Sección de Personalización */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personalización</Text>

                    {/* Botón Branding con IA */}
                    <TouchableOpacity
                        style={styles.settingCard}
                        onPress={() => router.push('/(coach)/branding')}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.settingIcon, { backgroundColor: '#8b5cf615' }]}>
                            <Ionicons name="color-palette" size={24} color="#8b5cf6" />
                        </View>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingTitle}>Branding con IA ✨</Text>
                            <Text style={styles.settingDescription}>
                                Genera tu identidad visual desde tu logo
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {/* Sección de Configuración General */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Configuración General</Text>

                    {/* Notificaciones - Placeholder */}
                    <TouchableOpacity
                        style={[styles.settingCard, styles.settingCardDisabled]}
                        activeOpacity={1}
                    >
                        <View style={[styles.settingIcon, { backgroundColor: '#f59e0b15' }]}>
                            <Ionicons name="notifications-outline" size={24} color="#f59e0b" />
                        </View>
                        <View style={styles.settingInfo}>
                            <Text style={[styles.settingTitle, styles.settingTitleDisabled]}>
                                Notificaciones
                                <Text style={styles.comingSoon}> 🚧</Text>
                            </Text>
                            <Text style={styles.settingDescription}>
                                Configura alertas y recordatorios
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color="#94a3b8" />
                    </TouchableOpacity>

                    {/* Privacidad - Placeholder */}
                    <TouchableOpacity
                        style={[styles.settingCard, styles.settingCardDisabled]}
                        activeOpacity={1}
                    >
                        <View style={[styles.settingIcon, { backgroundColor: '#8b5cf615' }]}>
                            <Ionicons name="shield-outline" size={24} color="#8b5cf6" />
                        </View>
                        <View style={styles.settingInfo}>
                            <Text style={[styles.settingTitle, styles.settingTitleDisabled]}>
                                Privacidad
                                <Text style={styles.comingSoon}> 🚧</Text>
                            </Text>
                            <Text style={styles.settingDescription}>
                                Gestiona la visibilidad de tu perfil
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color="#94a3b8" />
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>TotalGain Coach Panel</Text>
                    <Text style={styles.footerVersion}>v1.1.5</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginLeft: 4,
    },
    settingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 14,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    settingCardDisabled: {
        opacity: 0.6,
    },
    settingIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    settingInfo: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 3,
    },
    settingTitleDisabled: {
        color: '#64748b',
    },
    settingDescription: {
        fontSize: 13,
        color: '#94a3b8',
    },
    comingSoon: {
        fontSize: 12,
    },
    footer: {
        alignItems: 'center',
        marginTop: 24,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    footerText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    footerVersion: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
    },
});
