// app/(coach)/index.jsx - Trainer Dashboard Principal
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Image,
    ActivityIndicator,
    Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function TrainerDashboard() {
    const { token, user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [trainerProfile, setTrainerProfile] = useState(null);
    const [currentClients, setCurrentClients] = useState(0);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    useEffect(() => {
        loadTrainerData();
    }, []);

    const loadTrainerData = async () => {
        try {
            setLoading(true);
            const [profileRes, clientsRes] = await Promise.all([
                fetch(`${API_URL}/api/trainers/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_URL}/api/trainers/clients`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            const profileData = await profileRes.json();
            const clientsData = await clientsRes.json();

            setTrainerProfile(profileData.profile || {});
            setCurrentClients(clientsData.count || 0);
        } catch (error) {
            console.error('Error loading trainer data:', error);
            Alert.alert('Error', 'No se pudieron cargar los datos del entrenador');
        } finally {
            setLoading(false);
        }
    };

    const copyCodeToClipboard = () => {
        const code = trainerProfile?.trainerCode;

        if (!code || code === 'NO-CONFIGURADO') {
            window.alert('⚠️ No tienes un código configurado aún.\n\nVe a "Perfil Profesional" para generar tu código único.');
            return;
        }

        // Copiar al portapapeles
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code)
                .then(() => {
                    window.alert(`✅ Código copiado!\n\n${code}\n\nComparte este código con tus clientes para que se vinculen contigo.`);
                })
                .catch(() => {
                    // Fallback para navegadores antiguos
                    window.alert(`Tu código de entrenador:\n\n${code}\n\n(Cópialo manualmente)`);
                });
        } else {
            // Fallback si no hay clipboard API
            window.alert(`Tu código de entrenador:\n\n${code}\n\n(Cópialo manualmente)`);
        }
    };

    const dashboardSections = [
        { icon: 'person', name: 'Perfil Profesional', route: '/(coach)/profile', color: '#3b82f6' },
        { icon: 'people', name: 'Clientes', route: '/(coach)/clients', color: '#10b981' },
        { icon: 'chatbubbles', name: 'Comunicación', route: '/(coach)/communication', color: '#8b5cf6' },
        { icon: 'barbell', name: 'Rutinas', route: '/(coach)/workouts', color: '#f59e0b' },
        { icon: 'film', name: 'Multimedia', route: '/(coach)/multimedia', color: '#ec4899' },
        { icon: 'card', name: 'Facturación', route: '/(coach)/billing', color: '#14b8a6' },
        { icon: 'calendar', name: 'Calendario', route: '/(coach)/calendar', color: '#6366f1' },
        { icon: 'stats-chart', name: 'Progreso', route: '/(coach)/progress', color: '#ef4444' },
        { icon: 'nutrition', name: 'Nutrición', route: '/(coach)/nutrition', color: '#22c55e' },
        { icon: 'people-circle', name: 'Comunidad', route: '/(coach)/community', color: '#06b6d4' },
        { icon: 'analytics', name: 'Análisis Técnico', route: '/(coach)/analysis', color: '#f97316' },
        { icon: 'trophy', name: 'Objetivos', route: '/(coach)/goals', color: '#eab308' },
        { icon: 'bar-chart', name: 'Analytics', route: '/(coach)/analytics', color: '#a855f7' },
        { icon: 'settings', name: 'Configuración', route: '/(coach)/settings', color: '#64748b' }
    ];

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    const maxClients = trainerProfile?.maxClients || 5;
    const canUpgrade = currentClients >= maxClients;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header con Información del Entrenador */}
                <LinearGradient
                    colors={['#1e293b', '#334155']}
                    style={styles.header}
                >
                    {/* Código de Entrenador */}
                    <View style={styles.codeSection}>
                        <Text style={styles.codeLabel}>CÓDIGO DE ENTRENADOR</Text>
                        <TouchableOpacity
                            style={styles.codeContainer}
                            onPress={copyCodeToClipboard}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.codeText}>
                                {trainerProfile?.trainerCode || 'NO-CONFIGURADO'}
                            </Text>
                            <Ionicons name="copy-outline" size={20} color="#10b981" />
                        </TouchableOpacity>
                    </View>

                    {/* Info del Entrenador */}
                    <View style={styles.profileSection}>
                        <View style={styles.profileInfo}>
                            <Text style={styles.trainerName}>{user?.nombre || 'Entrenador'}</Text>
                            <Text style={styles.brandName}>
                                {trainerProfile?.brandName || 'Configura tu marca'}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.profileImageContainer}
                            onPress={() => router.push('/(coach)/profile')}
                        >
                            {trainerProfile?.logoUrl ? (
                                <Image
                                    source={{ uri: trainerProfile.logoUrl }}
                                    style={styles.profileImage}
                                />
                            ) : (
                                <View style={styles.profileImagePlaceholder}>
                                    <Ionicons name="person" size={40} color="#94a3b8" />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Clientes Info */}
                    <View style={styles.clientsSection}>
                        <View style={styles.clientsInfo}>
                            <Text style={styles.clientsLabel}>CLIENTES</Text>
                            <View style={styles.clientsCount}>
                                <Text style={styles.currentClients}>{currentClients}</Text>
                                <Text style={styles.maxClients}> / {maxClients}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.upgradeButton,
                                !canUpgrade && styles.upgradeButtonDisabled
                            ]}
                            onPress={() => router.push('/(app)/payment')}
                        >
                            <Ionicons name="add-circle" size={24} color={canUpgrade ? "#fff" : "#64748b"} />
                        </TouchableOpacity>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${Math.min((currentClients / maxClients) * 100, 100)}%` }
                                ]}
                            />
                        </View>
                        <Text style={styles.progressText}>
                            {currentClients >= maxClients ? '¡Límite alcanzado!' : `${maxClients - currentClients} slots disponibles`}
                        </Text>
                    </View>
                </LinearGradient>

                {/* Dashboard Sections */}
                <View style={styles.sectionsContainer}>
                    <Text style={styles.sectionsTitle}>Panel de Control</Text>

                    <View style={styles.grid}>
                        {dashboardSections.map((section, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.sectionCard}
                                onPress={() => router.push(section.route)}
                                activeOpacity={0.7}
                            >
                                <LinearGradient
                                    colors={[section.color, `${section.color}dd`]}
                                    style={styles.sectionGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name={section.icon} size={28} color="#fff" />
                                </LinearGradient>
                                <Text style={styles.sectionName}>{section.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc'
    },
    header: {
        padding: 24,
        paddingTop: 14,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32
    },
    codeSection: {
        marginBottom: 10
    },
    codeLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 1.5,
        marginBottom: 8
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1e293b',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155'
    },
    codeText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#10b981',
        letterSpacing: 2
    },
    profileSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    profileInfo: {
        flex: 1
    },
    trainerName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 4
    },
    brandName: {
        fontSize: 16,
        color: '#94a3b8',
        fontWeight: '500'
    },
    profileImageContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: '#10b981'
    },
    profileImage: {
        width: '100%',
        height: '100%'
    },
    profileImagePlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center'
    },
    clientsSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
    },
    clientsInfo: {
        flex: 1
    },
    clientsLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 1.5,
        marginBottom: 4
    },
    clientsCount: {
        flexDirection: 'row',
        alignItems: 'baseline'
    },
    currentClients: {
        fontSize: 36,
        fontWeight: '800',
        color: '#fff'
    },
    maxClients: {
        fontSize: 20,
        fontWeight: '600',
        color: '#64748b'
    },
    upgradeButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8
    },
    upgradeButtonDisabled: {
        backgroundColor: '#1e293b',
        shadowOpacity: 0
    },
    progressContainer: {
        marginTop: 8
    },
    progressBar: {
        height: 8,
        backgroundColor: '#1e293b',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#10b981',
        borderRadius: 4
    },
    progressText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
        textAlign: 'center'
    },
    sectionsContainer: {
        padding: 24
    },
    sectionsTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 20
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16
    },
    sectionCard: {
        width: '47%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    sectionGradient: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    sectionName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
        textAlign: 'center'
    }
});
