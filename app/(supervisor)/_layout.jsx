import { Stack, router, usePathname } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Alert, View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { useStableWindowDimensions } from '../../src/hooks/useStableBreakpoint';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useImpersonation } from '../../context/ImpersonationContext';
import AvatarWithInitials from '../../src/components/shared/AvatarWithInitials';

// Secciones del sidebar del supervisor (simplificado)
const SIDEBAR_SECTIONS = [
    {
        id: 'main',
        title: 'Principal',
        icon: 'home',
        color: '#8b5cf6',
        items: [
            { id: 'dashboard', icon: 'grid', label: 'Dashboard', route: '/(supervisor)' },
            { id: 'team', icon: 'people', label: 'Mi Equipo', route: '/(supervisor)/team' },
        ]
    },
];

// Componente Sidebar
const Sidebar = ({ currentPath, onNavigate, user }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const isActiveRoute = (route) => {
        const cleanPath = currentPath?.replace(/\/$/, '') || '';
        const cleanRoute = route?.replace(/\/$/, '') || '';
        return cleanPath === cleanRoute || cleanPath.startsWith(cleanRoute + '/');
    };

    return (
        <View style={[styles.sidebar, isCollapsed && styles.sidebarCollapsed]}>
            {/* Header */}
            <View style={styles.sidebarHeader}>
                {!isCollapsed && (
                    <View style={styles.sidebarBrand}>
                        <AvatarWithInitials
                            name={user?.nombre || 'S'}
                            avatarUrl={user?.avatarUrl}
                            size={36}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.sidebarBrandName} numberOfLines={1}>
                                {user?.nombre || 'Supervisor'}
                            </Text>
                            <Text style={styles.sidebarBrandSub}>Coordinador</Text>
                        </View>
                    </View>
                )}
                <TouchableOpacity
                    onPress={() => setIsCollapsed(!isCollapsed)}
                    style={styles.collapseButton}
                >
                    <Ionicons
                        name={isCollapsed ? 'chevron-forward' : 'chevron-back'}
                        size={18}
                        color="#94a3b8"
                    />
                </TouchableOpacity>
            </View>

            {/* Sections */}
            <ScrollView style={styles.sidebarContent} showsVerticalScrollIndicator={false}>
                {SIDEBAR_SECTIONS.map(section => (
                    <View key={section.id} style={styles.sidebarSection}>
                        {!isCollapsed && (
                            <View style={styles.sectionHeader}>
                                <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
                                <Text style={styles.sectionTitle}>{section.title}</Text>
                            </View>
                        )}
                        {section.items.map(item => {
                            const isActive = isActiveRoute(item.route);
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => onNavigate(item.route)}
                                    style={[
                                        styles.sidebarItem,
                                        isActive && styles.sidebarItemActive,
                                        isCollapsed && styles.sidebarItemCollapsed,
                                    ]}
                                >
                                    <Ionicons
                                        name={item.icon}
                                        size={20}
                                        color={isActive ? '#8b5cf6' : '#94a3b8'}
                                    />
                                    {!isCollapsed && (
                                        <Text style={[
                                            styles.sidebarItemLabel,
                                            isActive && styles.sidebarItemLabelActive
                                        ]}>
                                            {item.label}
                                        </Text>
                                    )}
                                    {isActive && <View style={styles.activeIndicator} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </ScrollView>

            {/* Footer - Volver a selección */}
            <TouchableOpacity
                style={styles.sidebarFooter}
                onPress={() => router.replace('/mode-select')}
            >
                <Ionicons name="arrow-back" size={20} color="#94a3b8" />
                {!isCollapsed && (
                    <Text style={styles.footerText}>Volver</Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

export default function SupervisorLayout() {
    const { user } = useAuth();
    const { isImpersonating } = useImpersonation();
    const insets = useSafeAreaInsets();
    const { width } = useStableWindowDimensions();
    const pathname = usePathname();

    const showSidebar = Platform.OS === 'web' && width >= 900;

    // Verificar acceso (skip durante impersonation - el ImpersonationContext maneja la nav)
    useEffect(() => {
        if (isImpersonating) return;
        if (!user || (!user.isCoordinator && user.tipoUsuario !== 'ADMINISTRADOR')) {
            Alert.alert('Acceso denegado', 'Solo coordinadores pueden acceder a este panel');
            router.replace('/mode-select');
        }
    }, [user?._id, user?.isCoordinator, user?.tipoUsuario, isImpersonating]);

    const handleNavigate = (route) => {
        router.push(route);
    };

    return (
        <View style={{
            flex: 1,
            flexDirection: 'row',
            backgroundColor: '#0f172a',
        }}>
            {/* Sidebar - Solo en pantallas grandes */}
            {showSidebar && (
                <Sidebar
                    currentPath={pathname}
                    onNavigate={handleNavigate}
                    user={user}
                />
            )}

            {/* Contenido principal */}
            <View style={{
                flex: 1,
                paddingTop: insets.top,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 0,
                backgroundColor: '#f1f5f9',
            }}>
                <Stack
                    screenOptions={{
                        headerShown: false,
                        gestureEnabled: true,
                        fullScreenGestureEnabled: true,
                        animation: 'slide_from_right',
                    }}
                >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="team" />
                </Stack>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    sidebar: {
        width: 260,
        backgroundColor: '#1e293b',
        borderRightWidth: 1,
        borderRightColor: '#334155',
    },
    sidebarCollapsed: {
        width: 64,
    },
    sidebarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    sidebarBrand: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    sidebarBrandName: {
        color: '#f8fafc',
        fontSize: 15,
        fontWeight: '700',
    },
    sidebarBrandSub: {
        color: '#8b5cf6',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 1,
    },
    collapseButton: {
        padding: 6,
    },
    sidebarContent: {
        flex: 1,
        paddingTop: 8,
    },
    sidebarSection: {
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 8,
        gap: 8,
    },
    sectionDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    sectionTitle: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sidebarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 12,
        position: 'relative',
    },
    sidebarItemActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
    },
    sidebarItemCollapsed: {
        justifyContent: 'center',
        paddingHorizontal: 0,
    },
    sidebarItemLabel: {
        color: '#cbd5e1',
        fontSize: 14,
        fontWeight: '500',
    },
    sidebarItemLabelActive: {
        color: '#8b5cf6',
        fontWeight: '600',
    },
    activeIndicator: {
        position: 'absolute',
        right: 0,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#8b5cf6',
    },
    sidebarFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#334155',
    },
    footerText: {
        color: '#94a3b8',
        fontSize: 14,
    },
});
