import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, ScrollView, Platform, Switch, ActivityIndicator, LayoutAnimation, UIManager } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CoachHeader from '../components/CoachHeader';
import { resetCoachOnboarding } from '../../../components/CoachOnboardingModal';
import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NOTIFICATION_OPTIONS = [
    { key: 'videoFeedback', label: 'Videos, fotos y audios', description: 'Cuando un cliente sube contenido de entreno', icon: '🎬' },
    { key: 'progressPhotos', label: 'Fotos de progreso', description: 'Fotos corporales y de comida de clientes', icon: '📸' },
    { key: 'weeklyCheckin', label: 'Check-ins semanales', description: 'Cuando un cliente completa su seguimiento', icon: '📋' },
];

export default function SettingsScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const [resettingTutorial, setResettingTutorial] = useState(false);
    const [notifExpanded, setNotifExpanded] = useState(false);
    const [notifPrefs, setNotifPrefs] = useState(null);
    const [notifLoading, setNotifLoading] = useState(false);
    const [notifError, setNotifError] = useState(null);

    // Cargar preferencias de notificación al expandir
    const loadNotifPrefs = useCallback(async () => {
        if (notifPrefs) return; // Ya cargadas
        setNotifLoading(true);
        setNotifError(null);
        try {
            const response = await fetch(`${API_URL}/api/notifications/preferences`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setNotifPrefs(data.preferences);
            } else {
                setNotifError('Error al cargar preferencias');
            }
        } catch (err) {
            console.error('[Settings] Error loading notification prefs:', err);
            setNotifError('Error de conexión');
        } finally {
            setNotifLoading(false);
        }
    }, [token, notifPrefs]);

    // Toggle una preferencia individual
    const togglePref = async (key, newValue) => {
        // Optimistic update
        const oldPrefs = { ...notifPrefs };
        setNotifPrefs(prev => ({ ...prev, [key]: newValue }));

        try {
            const response = await fetch(`${API_URL}/api/notifications/preferences`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ preferences: { [key]: newValue } })
            });
            const data = await response.json();
            if (!data.success) {
                // Revert on failure
                setNotifPrefs(oldPrefs);
            }
        } catch (err) {
            console.error('[Settings] Error updating notification pref:', err);
            setNotifPrefs(oldPrefs);
        }
    };

    // Manejar expand/collapse con animación
    const handleNotifToggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const newExpanded = !notifExpanded;
        setNotifExpanded(newExpanded);
        if (newExpanded) {
            loadNotifPrefs();
        }
    };

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

    // Contar notificaciones activas
    const activeCount = notifPrefs
        ? NOTIFICATION_OPTIONS.filter(opt => notifPrefs[opt.key] !== false).length
        : null;

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

                    {/* Notificaciones - Expandible */}
                    <TouchableOpacity
                        style={[styles.settingCard, notifExpanded && styles.settingCardExpanded]}
                        onPress={handleNotifToggle}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.settingIcon, { backgroundColor: '#f59e0b15' }]}>
                            <Ionicons name="notifications-outline" size={24} color="#f59e0b" />
                        </View>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingTitle}>
                                Notificaciones
                            </Text>
                            <Text style={styles.settingDescription}>
                                {activeCount !== null
                                    ? `${activeCount} de ${NOTIFICATION_OPTIONS.length} activas`
                                    : 'Configura qué alertas recibes'
                                }
                            </Text>
                        </View>
                        <Ionicons
                            name={notifExpanded ? 'chevron-up' : 'chevron-down'}
                            size={22}
                            color="#64748b"
                        />
                    </TouchableOpacity>

                    {/* Panel expandido de notificaciones */}
                    {notifExpanded && (
                        <View style={styles.notifPanel}>
                            {notifLoading ? (
                                <View style={styles.notifLoadingContainer}>
                                    <ActivityIndicator size="small" color="#f59e0b" />
                                    <Text style={styles.notifLoadingText}>Cargando preferencias...</Text>
                                </View>
                            ) : notifError ? (
                                <View style={styles.notifErrorContainer}>
                                    <Ionicons name="warning-outline" size={20} color="#ef4444" />
                                    <Text style={styles.notifErrorText}>{notifError}</Text>
                                    <TouchableOpacity onPress={() => { setNotifPrefs(null); loadNotifPrefs(); }}>
                                        <Text style={styles.notifRetryText}>Reintentar</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : notifPrefs ? (
                                <>
                                    <Text style={styles.notifSectionLabel}>Notificaciones de clientes</Text>
                                    {NOTIFICATION_OPTIONS.map((opt, index) => (
                                        <View
                                            key={opt.key}
                                            style={[
                                                styles.notifRow,
                                                index < NOTIFICATION_OPTIONS.length - 1 && styles.notifRowBorder
                                            ]}
                                        >
                                            <Text style={styles.notifEmoji}>{opt.icon}</Text>
                                            <View style={styles.notifRowInfo}>
                                                <Text style={styles.notifRowLabel}>{opt.label}</Text>
                                                <Text style={styles.notifRowDesc}>{opt.description}</Text>
                                            </View>
                                            <Switch
                                                value={notifPrefs[opt.key] !== false}
                                                onValueChange={(val) => togglePref(opt.key, val)}
                                                trackColor={{ false: '#e2e8f0', true: '#fbbf24' }}
                                                thumbColor={notifPrefs[opt.key] !== false ? '#f59e0b' : '#94a3b8'}
                                                ios_backgroundColor="#e2e8f0"
                                            />
                                        </View>
                                    ))}
                                    <Text style={styles.notifHint}>
                                        Las notificaciones desactivadas no se enviarán a tu dispositivo, pero seguirás viendo el contenido en la app.
                                    </Text>
                                </>
                            ) : null}
                        </View>
                    )}

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
                    <Text style={styles.footerVersion}>v1.1.10</Text>
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
    settingCardExpanded: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        marginBottom: 0,
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
    // ═══════════════════════════════════════
    // NOTIFICATION PANEL STYLES
    // ═══════════════════════════════════════
    notifPanel: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 14,
        borderBottomRightRadius: 14,
        paddingHorizontal: 16,
        paddingBottom: 16,
        marginBottom: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    notifSectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 12,
        marginBottom: 8,
    },
    notifRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    notifRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    notifEmoji: {
        fontSize: 20,
        marginRight: 12,
        width: 28,
        textAlign: 'center',
    },
    notifRowInfo: {
        flex: 1,
        marginRight: 12,
    },
    notifRowLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 2,
    },
    notifRowDesc: {
        fontSize: 12,
        color: '#94a3b8',
    },
    notifHint: {
        fontSize: 11,
        color: '#94a3b8',
        fontStyle: 'italic',
        marginTop: 12,
        lineHeight: 16,
    },
    notifLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        gap: 8,
    },
    notifLoadingText: {
        fontSize: 13,
        color: '#94a3b8',
    },
    notifErrorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    notifErrorText: {
        fontSize: 13,
        color: '#ef4444',
    },
    notifRetryText: {
        fontSize: 13,
        color: '#3b82f6',
        fontWeight: '600',
    },
    // ═══════════════════════════════════════
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
