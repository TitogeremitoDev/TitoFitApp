import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface Mode {
    id: string;
    title: string;
    subtitle: string;
    icon: any;
    color: string;
    route: '/(app)/home' | '/(coach)' | '/(admin)';
    visible: boolean;
}

export default function ModeSelect() {
    const { user, logout } = useAuth();
    const { theme, isDark } = useTheme();

    const isAdmin = user?.tipoUsuario === 'ADMINISTRADOR';
    // Acceso coach: es admin, tiene tipo ENTRENADOR, O tiene código de entrenador configurado
    const isCoach = isAdmin || user?.tipoUsuario === 'ENTRENADOR' || !!user?.trainerProfile?.trainerCode;

    const modes: Mode[] = [
        {
            id: 'train',
            title: 'Entrenar',
            subtitle: 'Accede a tu rutina y entrena',
            icon: 'barbell' as any,
            color: '#3b82f6',
            route: '/(app)/home' as const,
            visible: true
        },
        {
            id: 'coach',
            title: 'Panel Coach',
            subtitle: 'Gestiona tus clientes',
            icon: 'people' as any,
            color: '#10b981',
            route: '/(coach)' as const,
            visible: isCoach
        },
        {
            id: 'admin',
            title: 'Administrador',
            subtitle: 'Panel de administración',
            icon: 'settings' as any,
            color: '#f97316',
            route: '/(admin)' as const,
            visible: isAdmin
        }
    ];

    const ModeCard = ({ mode }: { mode: Mode }) => {
        if (!mode.visible) return null;

        return (
            <TouchableOpacity
                style={[
                    styles.card,
                    {
                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                        borderColor: mode.color
                    }
                ]}
                onPress={() => router.push(mode.route as any)}
                activeOpacity={0.8}
            >
                <View style={[styles.iconContainer, { backgroundColor: mode.color }]}>
                    <Ionicons name={mode.icon} size={48} color="#ffffff" />
                </View>

                <Text style={[
                    styles.title,
                    { color: isDark ? '#ffffff' : '#1f2937' }
                ]}>
                    {mode.title}
                </Text>

                <Text style={[
                    styles.subtitle,
                    { color: isDark ? '#9ca3af' : '#6b7280' }
                ]}>
                    {mode.subtitle}
                </Text>

                <View style={[styles.arrow, { backgroundColor: mode.color }]}>
                    <Ionicons name="arrow-forward" size={20} color="#ffffff" />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[
            styles.container,
            { backgroundColor: isDark ? '#111827' : '#f3f4f6' }
        ]}>
            <View style={styles.header}>
                <Text style={[
                    styles.headerTitle,
                    { color: isDark ? '#ffffff' : '#1f2937' }
                ]}>
                    Bienvenido, {user?.nombre || 'Usuario'}
                </Text>
                <Text style={[
                    styles.headerSubtitle,
                    { color: isDark ? '#9ca3af' : '#6b7280' }
                ]}>
                    ¿Qué quieres hacer hoy?
                </Text>
            </View>

            <View style={styles.cardsContainer}>
                {modes.map(mode => (
                    <ModeCard key={mode.id} mode={mode} />
                ))}
            </View>

            <TouchableOpacity
                style={styles.logoutButton}
                onPress={async () => {
                    try {
                        console.log('[ModeSelect] Iniciando logout...');
                        await logout();
                        console.log('[ModeSelect] Logout completado, esperando limpieza de AsyncStorage...');
                        // Pequeño delay para asegurar que AsyncStorage se limpie completamente
                        await new Promise(resolve => setTimeout(resolve, 100));
                        console.log('[ModeSelect] Navegando a login...');
                        router.replace('/(auth)/login');
                    } catch (error) {
                        console.error('[ModeSelect] Error en logout:', error);
                    }
                }}
            >
                <Ionicons
                    name="log-out-outline"
                    size={20}
                    color={isDark ? '#9ca3af' : '#6b7280'}
                />
                <Text style={[
                    styles.logoutText,
                    { color: isDark ? '#9ca3af' : '#6b7280' }
                ]}>
                    Cerrar Sesión
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    header: {
        marginBottom: 40,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 16,
    },
    cardsContainer: {
        flex: 1,
        gap: 20,
    },
    card: {
        borderRadius: 20,
        padding: 24,
        borderWidth: 2,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        minHeight: 120,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        flex: 1,
    },
    subtitle: {
        fontSize: 14,
        position: 'absolute',
        left: 116,
        bottom: 24,
    },
    arrow: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
        marginBottom: 20,
    },
    logoutText: {
        fontSize: 16,
    },
});
