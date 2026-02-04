import { Stack, router, usePathname, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Alert, View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { FeedbackBubbleProvider } from '../../context/FeedbackBubbleContext';
import OverQuotaBanner from '../../components/OverQuotaBanner';
import OverQuotaModal from '../../components/OverQuotaModal';
import { useOverQuotaInterceptor } from '../../hooks/useOverQuotaInterceptor';

// Configuración de secciones del sidebar (coincide con las cajas temáticas del dashboard)
const SIDEBAR_SECTIONS = [
    {
        id: 'athletes',
        title: 'Gestión de Atletas',
        icon: 'people',
        color: '#3b82f6',
        items: [
            { id: 'clients', icon: 'people', label: 'Clientes', route: '/(coach)/clients_coach' },
            { id: 'progress', icon: 'stats-chart', label: 'Progreso', route: '/(coach)/progress' },
            { id: 'seguimiento', icon: 'body', label: 'Seguimiento', route: '/(coach)/seguimiento_coach' },
        ]
    },
    {
        id: 'studio',
        title: 'Coach Studio',
        icon: 'fitness',
        color: '#10b981',
        items: [
            { id: 'workouts', icon: 'barbell', label: 'Rutinas', route: '/(coach)/workouts' },
            { id: 'nutrition', icon: 'nutrition', label: 'Nutrición', route: '/(coach)/nutrition' },
        ]
    },
    {
        id: 'library',
        title: 'Biblioteca',
        icon: 'library',
        color: '#8b5cf6',
        items: [
            { id: 'exercises', icon: 'library', label: 'BD Ejercicios', route: '/(coach)/exercises_coach' },
            { id: 'videos', icon: 'videocam', label: 'Videos', route: '/(coach)/video-library' },
            { id: 'snippets', icon: 'flash', label: 'Respuestas', route: '/(coach)/snippet-manager' },
            { id: 'faqs', icon: 'help-circle', label: 'FAQs', route: '/(coach)/faq-manager' },
            { id: 'food-library', icon: 'restaurant', label: 'BD Alimentos', route: '/(coach)/food-library' },
        ]
    },
    {
        id: 'admin',
        title: 'Administración',
        icon: 'settings',
        color: '#64748b',
        items: [
            { id: 'billing', icon: 'card', label: 'Facturación', route: '/(coach)/billing' },
            { id: 'settings', icon: 'settings', label: 'Configuración', route: '/(coach)/settings' },
            { id: 'branding', icon: 'color-palette', label: 'Branding', route: '/(coach)/branding' },
        ]
    }
];

// Componente Sidebar
const Sidebar = ({ currentPath, onNavigate, user, trainerProfile }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const isActiveRoute = (route) => {
        // Normalizar rutas para comparación
        if (route === '/(coach)' && (currentPath === '/(coach)' || currentPath === '/(coach)/index')) {
            return true;
        }
        return currentPath?.startsWith(route) && route !== '/(coach)';
    };

    return (
        <View style={[sidebarStyles.container, isCollapsed && sidebarStyles.containerCollapsed]}>
            {/* Header del Sidebar */}
            <View style={sidebarStyles.header}>
                {/* Marca TotalGains - Arriba */}
                <View style={sidebarStyles.brandSection}>
                    <View style={sidebarStyles.brandLogoContainer}>
                        <Image
                            source={require('../../assets/logo.png')}
                            style={sidebarStyles.brandLogo}
                        />
                    </View>
                    {!isCollapsed && (
                        <Text style={sidebarStyles.brandText}>TotalGains</Text>
                    )}
                </View>

                {/* Perfil del Entrenador - Debajo */}
                <TouchableOpacity
                    style={[
                        sidebarStyles.trainerSection,
                        isCollapsed && sidebarStyles.trainerSectionCollapsed
                    ]}
                    onPress={() => onNavigate('/(coach)/profile')}
                    activeOpacity={0.8}
                >
                    <View style={sidebarStyles.trainerLogoContainer}>
                        {trainerProfile?.logoUrl ? (
                            <Image
                                source={{ uri: trainerProfile.logoUrl }}
                                style={sidebarStyles.trainerLogoImage}
                            />
                        ) : (
                            <View style={sidebarStyles.trainerLogoPlaceholder}>
                                <Ionicons name="person" size={18} color="#94a3b8" />
                            </View>
                        )}
                    </View>
                    {!isCollapsed && (
                        <View style={sidebarStyles.trainerInfo}>
                            <Text style={sidebarStyles.trainerName} numberOfLines={1}>
                                {user?.nombre || 'Entrenador'}
                            </Text>
                            <Text style={sidebarStyles.trainerRole}>Coach</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Toggle collapse button - Separado debajo del header */}
            <TouchableOpacity
                style={[
                    sidebarStyles.collapseBtn,
                    isCollapsed && sidebarStyles.collapseBtnCollapsed
                ]}
                onPress={() => setIsCollapsed(!isCollapsed)}
            >
                <Ionicons
                    name={isCollapsed ? 'chevron-forward' : 'chevron-back'}
                    size={14}
                    color="#94a3b8"
                />
                {!isCollapsed && (
                    <Text style={sidebarStyles.collapseBtnText}>Contraer</Text>
                )}
            </TouchableOpacity>

            {/* Navegación por secciones */}
            <ScrollView
                style={sidebarStyles.nav}
                showsVerticalScrollIndicator={false}
            >
                {/* Dashboard - Item especial */}
                <TouchableOpacity
                    style={[
                        sidebarStyles.navItem,
                        (currentPath === '/(coach)' || currentPath === '/(coach)/index') && sidebarStyles.navItemActive,
                        isCollapsed && sidebarStyles.navItemCollapsed
                    ]}
                    onPress={() => onNavigate('/(coach)')}
                    activeOpacity={0.7}
                >
                    <View style={[
                        sidebarStyles.navItemIconContainer,
                        (currentPath === '/(coach)' || currentPath === '/(coach)/index') && sidebarStyles.navItemIconContainerActive
                    ]}>
                        <Ionicons
                            name={(currentPath === '/(coach)' || currentPath === '/(coach)/index') ? 'grid' : 'grid-outline'}
                            size={20}
                            color={(currentPath === '/(coach)' || currentPath === '/(coach)/index') ? '#6366f1' : '#94a3b8'}
                        />
                    </View>
                    {!isCollapsed && (
                        <Text style={[
                            sidebarStyles.navItemText,
                            (currentPath === '/(coach)' || currentPath === '/(coach)/index') && sidebarStyles.navItemTextActive
                        ]}>
                            Dashboard
                        </Text>
                    )}
                </TouchableOpacity>

                {/* Accesos Rápidos: Chat y Feedback */}
                <View style={[
                    sidebarStyles.quickAccessRow,
                    isCollapsed && sidebarStyles.quickAccessRowCollapsed
                ]}>
                    <TouchableOpacity
                        style={[
                            sidebarStyles.quickAccessBtn,
                            isCollapsed && sidebarStyles.quickAccessBtnCollapsed,
                            currentPath?.includes('/chat') && sidebarStyles.quickAccessBtnActive
                        ]}
                        onPress={() => onNavigate('/chat')}
                    >
                        <Ionicons name="chatbubbles-outline" size={18} color="#94a3b8" />
                        {!isCollapsed && <Text style={sidebarStyles.quickAccessText}>Chat</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            sidebarStyles.quickAccessBtn,
                            isCollapsed && sidebarStyles.quickAccessBtnCollapsed,
                            currentPath?.includes('/feedbacks') && sidebarStyles.quickAccessBtnActive
                        ]}
                        onPress={() => onNavigate('/(coach)/feedbacks')}
                    >
                        <Ionicons name="document-text-outline" size={18} color="#94a3b8" />
                        {!isCollapsed && <Text style={sidebarStyles.quickAccessText}>Feedback</Text>}
                    </TouchableOpacity>
                </View>

                {/* Secciones con títulos */}
                {SIDEBAR_SECTIONS.map((section) => (
                    <View key={section.id} style={sidebarStyles.sectionContainer}>
                        {/* Título de sección */}
                        {!isCollapsed && (
                            <View style={sidebarStyles.sectionHeader}>
                                <View style={[sidebarStyles.sectionIcon, { backgroundColor: section.color }]}>
                                    <Ionicons name={section.icon} size={12} color="#fff" />
                                </View>
                                <Text style={[sidebarStyles.sectionTitle, { color: section.color }]}>
                                    {section.title}
                                </Text>
                            </View>
                        )}
                        {isCollapsed && (
                            <View style={sidebarStyles.sectionDividerCollapsed} />
                        )}

                        {/* Items de la sección */}
                        {section.items.map((item) => {
                            const isActive = isActiveRoute(item.route);
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[
                                        sidebarStyles.navItem,
                                        isActive && sidebarStyles.navItemActive,
                                        isCollapsed && sidebarStyles.navItemCollapsed
                                    ]}
                                    onPress={() => onNavigate(item.route)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[
                                        sidebarStyles.navItemIconContainer,
                                        isActive && [sidebarStyles.navItemIconContainerActive, { backgroundColor: `${section.color}20` }]
                                    ]}>
                                        <Ionicons
                                            name={isActive ? item.icon : `${item.icon}-outline`}
                                            size={18}
                                            color={isActive ? section.color : '#94a3b8'}
                                        />
                                    </View>
                                    {!isCollapsed && (
                                        <Text style={[
                                            sidebarStyles.navItemText,
                                            isActive && sidebarStyles.navItemTextActive
                                        ]}>
                                            {item.label}
                                        </Text>
                                    )}
                                    {isActive && !isCollapsed && (
                                        <View style={[sidebarStyles.activeIndicator, { backgroundColor: section.color }]} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

export default function CoachLayout() {
    const { user, token, refreshUser } = useAuth();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const pathname = usePathname();
    const [trainerProfile, setTrainerProfile] = useState(null);
    const [showOverQuotaModal, setShowOverQuotaModal] = useState(false);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    // Mostrar sidebar solo en pantallas grandes (900px+)
    const showSidebar = Platform.OS === 'web' && width >= 900;

    // Obtener info de over-quota del usuario
    const overQuota = user?.overQuota;
    // Considerar congelado si el status es 'frozen' O si está excedido de cuota (isOverQuota es true)
    // Esto es más estricto y asegura que salte el modal si hay exceso.
    // Si queremos dar gracia, podríamos mirar daysFrozen, pero el usuario pidió bloqueo total.
    const isFrozen = user?.subscriptionStatus === 'frozen' || (overQuota?.isOverQuota === true);



    // Interceptor para mostrar modal automáticamente al recibir 403 OVER_QUOTA
    const handleOverQuotaError = useCallback((errorData) => {
        console.log('[CoachLayout] 🚫 Over-quota error intercepted:', errorData);
        setShowOverQuotaModal(true);
    }, []);

    useOverQuotaInterceptor(handleOverQuotaError);

    // 🔄 FORZAR REFRESH CADA VEZ QUE LA PANTALLA GANA FOCO (Counter Back-Button Spam)
    useFocusEffect(
        useCallback(() => {
            console.log('[CoachLayout] 🔄 Pantalla enfocada - Verificando estado...');
            refreshUser().then(u => {
                // Forzar reevaluación si cambió algo
                if (u?.subscriptionStatus === 'frozen' || u?.overQuota?.isOverQuota) {
                    setShowOverQuotaModal(true);
                }
            });
        }, [])
    );

    // Verificar acceso y redirigir si no es coach/admin
    useEffect(() => {
        if (!user || (user.tipoUsuario !== 'ADMINISTRADOR' && user.tipoUsuario !== 'ENTRENADOR')) {
            Alert.alert('Acceso denegado', 'Solo administradores y entrenadores pueden acceder');
            router.replace('/(app)');
        }
    }, [user?._id, user?.tipoUsuario]);

    // Redirigir a billing si está congelado y no está ya en billing/settings
    // Redirigir si está congelado y no está en una ruta permitida (pago)
    useEffect(() => {
        if (isFrozen && user?.tipoUsuario === 'ENTRENADOR') {
            // Permitir acceso solo a settings y payment
            // IMPORTANTE: /billing es para cobrar a clientes. Debe estar bloqueado.
            const allowedPaths = ['/settings', '/payment', '/perfil/ajustes', '/(app)/payment'];
            const isAllowedPath = allowedPaths.some(p => pathname.includes(p));

            if (!isAllowedPath) {
                console.log('[CoachLayout] 🔒 Coach congelado, redirigiendo a suscripción...');
                router.replace('/(app)/payment');
            }
        }
    }, [isFrozen, pathname, user?.tipoUsuario]);

    // Cargar perfil del entrenador desde la API para obtener el logoUrl
    useEffect(() => {
        const loadTrainerProfile = async () => {
            if (!token) return;
            try {
                const res = await fetch(`${API_URL}/api/trainers/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.profile) {
                    setTrainerProfile(data.profile);
                }
            } catch (error) {
                console.log('Error loading trainer profile for sidebar:', error);
            }
        };
        loadTrainerProfile();
    }, [token]);

    const handleNavigate = (route) => {
        router.push(route);
    };

    const handleBannerPress = () => {
        setShowOverQuotaModal(true);
    };

    return (
        <FeedbackBubbleProvider>
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
                        trainerProfile={trainerProfile}
                    />
                )}

                {/* Contenido principal */}
                <View style={{
                    flex: 1,
                    paddingTop: insets.top,
                    paddingBottom: insets.bottom > 0 ? insets.bottom : 0,
                    backgroundColor: '#f1f5f9',
                }}>
                    {/* Banner de Over-Quota - Visible en todas las pantallas */}
                    <OverQuotaBanner
                        overQuota={overQuota}
                        onPress={handleBannerPress}
                    />

                    <Stack
                        screenOptions={{
                            headerShown: false,
                            gestureEnabled: true,
                            fullScreenGestureEnabled: true,
                            animation: 'slide_from_right',
                        }}
                    >
                        <Stack.Screen name="index" />
                        <Stack.Screen name="clients_coach/index" />
                        <Stack.Screen name="workouts/create" />
                        <Stack.Screen name="feedbacks/index" />
                    </Stack>
                </View>

                {/* Modal de Over-Quota - Renderizado directamente sin wrapper bloqueante */}
                <OverQuotaModal
                    visible={(isFrozen || showOverQuotaModal) && !pathname.includes('/payment') && !pathname.includes('/perfil/ajustes')}
                    overQuota={overQuota}
                    onClose={isFrozen ? () => { } : () => setShowOverQuotaModal(false)}
                    canDismiss={!isFrozen}
                />
            </View>
        </FeedbackBubbleProvider>
    );
}

const sidebarStyles = StyleSheet.create({
    container: {
        width: 260,
        backgroundColor: '#1e293b',
        borderRightWidth: 1,
        borderRightColor: '#334155',
        paddingVertical: 16,
    },
    containerCollapsed: {
        width: 72,
        alignItems: 'center',
    },
    header: {
        paddingHorizontal: 14,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        marginBottom: 8,
        alignItems: 'center',
    },
    // Marca TotalGains - Arriba
    brandSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    brandLogoContainer: {
        width: 34,
        height: 34,
        borderRadius: 8,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    brandLogo: {
        width: 28,
        height: 28,
        resizeMode: 'contain',
    },
    brandText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#f8fafc',
        marginLeft: 10,
        letterSpacing: -0.3,
    },
    // Perfil del Entrenador - Debajo
    trainerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#334155',
        borderRadius: 12,
        padding: 10,
    },
    trainerSectionCollapsed: {
        backgroundColor: 'transparent',
        padding: 0,
        justifyContent: 'center',
    },
    trainerLogoContainer: {
        width: 38,
        height: 38,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#10b981',
    },
    trainerLogoImage: {
        width: '100%',
        height: '100%',
    },
    trainerLogoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#475569',
        alignItems: 'center',
        justifyContent: 'center',
    },
    trainerInfo: {
        marginLeft: 10,
        flex: 1,
    },
    trainerName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#f8fafc',
    },
    trainerRole: {
        fontSize: 11,
        color: '#10b981',
        fontWeight: '600',
    },
    collapseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginHorizontal: 14,
        marginBottom: 8,
        borderRadius: 8,
        backgroundColor: '#334155',
        gap: 6,
    },
    collapseBtnCollapsed: {
        paddingHorizontal: 8,
        marginHorizontal: 12,
    },
    collapseBtnText: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
    },
    nav: {
        flex: 1,
        paddingHorizontal: 12,
    },
    // Accesos rápidos Chat/Feedback
    quickAccessRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        marginTop: 4,
    },
    quickAccessRowCollapsed: {
        flexDirection: 'column',
        gap: 6,
    },
    quickAccessBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#334155',
    },
    quickAccessBtnCollapsed: {
        flex: 0,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    quickAccessBtnActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderWidth: 1,
        borderColor: '#3b82f6',
    },
    quickAccessText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 4,
        position: 'relative',
    },
    navItemCollapsed: {
        justifyContent: 'center',
        paddingHorizontal: 0,
    },
    navItemActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
    },
    navItemIconContainer: {
        width: 36,
        height: 20,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    navItemIconContainerActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
    },
    navItemText: {
        fontSize: 14,
        color: '#94a3b8',
        marginLeft: 10,
        fontWeight: '500',
    },
    navItemTextActive: {
        color: '#e2e8f0',
        fontWeight: '600',
    },
    activeIndicator: {
        position: 'absolute',
        right: 8,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#6366f1',
    },
    divider: {
        height: 1,
        backgroundColor: '#334155',
        marginVertical: 12,
        marginHorizontal: 8,
    },
    dividerCollapsed: {
        marginHorizontal: 16,
    },
    // Estilos para secciones
    sectionContainer: {
        marginTop: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        marginBottom: 8,
        gap: 8,
    },
    sectionIcon: {
        width: 20,
        height: 20,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sectionDividerCollapsed: {
        height: 1,
        backgroundColor: '#334155',
        marginVertical: 8,
        marginHorizontal: 12,
    },
    footer: {
        paddingHorizontal: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#334155',
    },
    profileBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 10,
        backgroundColor: '#334155',
        marginBottom: 8,
    },
    profileBtnCollapsed: {
        justifyContent: 'center',
        padding: 8,
    },
    profileAvatar: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    profileImage: {
        width: '100%',
        height: '100%',
    },
    profileInfo: {
        marginLeft: 10,
        flex: 1,
    },
    profileName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#f8fafc',
    },
    profileRole: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
    modeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(249, 115, 22, 0.3)',
    },
    modeBtnCollapsed: {
        padding: 8,
    },
    modeBtnText: {
        fontSize: 13,
        color: '#f97316',
        fontWeight: '600',
        marginLeft: 8,
    },
});
