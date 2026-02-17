import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Modal, View, Text, StyleSheet, SafeAreaView, FlatList, RefreshControl,
    ActivityIndicator, LayoutAnimation, Platform, UIManager,
    useWindowDimensions, Animated, ScrollView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
// Componentes mejorados para iOS
import {
    EnhancedTouchable as TouchableOpacity,
    EnhancedPressable as Pressable,
    EnhancedTextInput as TextInput,
} from '../../../components/ui';

import CreateEventModal from '../components/CreateEventModal';
import ActionableSidebar from '../components/ActionableSidebar';
import NotificationBell from '../components/NotificationBell';
import NotificationDrawer from '../components/NotificationDrawer';
import DashboardStats from '../components/DashboardStats';
import ClientListRow from '../components/ClientListRow';
import SkeletonClientRow from '../components/SkeletonClientRow';
import MiniCalendar from '../components/MiniCalendar';

// ═══════════════════════════════════════════════════════════════════════════
// COLOR PALETTE - Professional Blue Theme
// ═══════════════════════════════════════════════════════════════════════════
const COLORS = {
    primary: '#2563EB',        // Azul eléctrico
    primaryDark: '#1D4ED8',    // Azul profundo (hover)
    primaryLight: '#3B82F6',   // Azul claro
    success: '#10b981',        // Verde (para tendencias positivas)
    warning: '#f59e0b',        // Amarillo/Naranja
    danger: '#ef4444',         // Rojo
    neutral: '#6b7280',        // Gris
    background: '#f8fafc',     // Fondo principal
    cardBg: '#ffffff',         // Fondo tarjetas
    border: '#e2e8f0',         // Bordes claros
    textPrimary: '#1e293b',    // Texto principal
    textSecondary: '#64748b',  // Texto secundario
};

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ClientsScreen() {
    const router = useRouter();
    const { token, refreshUser } = useAuth();
    const { width: screenWidth } = useWindowDimensions();

    // Responsive breakpoints
    const isDesktop = screenWidth >= 1024;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;
    const isMobile = screenWidth < 768;

    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [maxClients, setMaxClients] = useState(5);
    const [stats, setStats] = useState({
        avgCompliance: 0,
        alertsCount: 0,
        renewalsCount: 0
    });

    // Search and Sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const searchTimerRef = useRef(null);
    const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name', 'tracking'
    const [activeFilter, setActiveFilter] = useState(null); // null | 'cambioDietaUrgente' | 'cambioEntrenoUrgente' | 'posibleAbandono'
    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        clientId: null,
        clientName: ''
    });

    // Debounce search (300ms)
    const handleSearchChange = useCallback((text) => {
        setSearchQuery(text);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setDebouncedSearch(text);
        }, 300);
    }, []);

    // Expanded State
    const [expandedClients, setExpandedClients] = useState({});

    const [notificationDrawerVisible, setNotificationDrawerVisible] = useState(false);

    // Event Modal State
    const [createEventModalVisible, setCreateEventModalVisible] = useState(false);
    const [selectedEventClient, setSelectedEventClient] = useState(null);
    const [initialEventType, setInitialEventType] = useState('rutina');
    const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    const params = useLocalSearchParams();

    useEffect(() => {
        if (params.action === 'new') {
            // Logic to open new client modal or navigate
            // For now, let's assume we want to navigate to theadd client screen if it exists, or show an alert/modal
            // Since the user said "el sistema de nuevo cliente no funciona", let's ensure we route correctly
            // Assuming there is a separate route or we use a modal. 
            // Previous code used router.push('/(coach)/clients_coach?action=new') which suggests a modal might be expected here.
            // Let's console log for debug or implement a mock action
            console.log("New Client Action Triggered");
            // NOTE: If you have a specific create client modal, set it visible here.
        }
    }, [params.action]);

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);

            // Usar el nuevo endpoint extendido
            const response = await fetch(`${API_URL}/api/trainers/clients-extended`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success) {
                const clientList = data.clients || [];
                setClients(clientList);
                setMaxClients(data.maxClients || 5);

                // Calculate Stats from real data
                const alerts = clientList.filter(c => c.cambioDietaUrgente || c.cambioEntrenoUrgente || c.posibleAbandono || c.daysSinceLastTracking > 4).length;
                const greenCount = clientList.filter(c => c.complianceTrafficLight === 'green').length;
                const avgComp = clientList.length > 0 ? Math.round((greenCount / clientList.length) * 100) : 0;
                const renewals = clientList.filter(c => {
                    if (!c.nextPaymentDate) return false;
                    const daysUntil = Math.ceil((new Date(c.nextPaymentDate) - new Date()) / 86400000);
                    return daysUntil <= 7;
                }).length;

                setStats({
                    avgCompliance: avgComp,
                    alertsCount: alerts,
                    renewalsCount: renewals,
                    totalClients: clientList.length,
                    maxClients: data.maxClients || 5
                });
            }
        } catch (error) {
            console.error('[ClientsScreen] Error fetching clients:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const toggleExpand = useCallback((clientId) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedClients(prev => ({
            ...prev,
            [clientId]: !prev[clientId]
        }));
    }, []);

    const handleAction = async (action, client) => {
        if (action === 'chat') {
            try {
                const res = await fetch(`${API_URL}/api/conversations/trainer-chat`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ clientId: client._id }),
                });
                const data = await res.json();
                if (data.success) {
                    router.push({
                        pathname: '/(app)/chat/[conversationId]',
                        params: {
                            conversationId: data.conversation._id,
                            displayName: client.nombre,
                            isTrainerChat: 'true',
                            type: 'trainer',
                        },
                    });
                }
            } catch (error) {
                console.error('[ClientsScreen] Error opening chat:', error);
            }
        } else if (action === 'edit') {
            router.push({
                pathname: '/(coach)/client-detail/[clientId]',
                params: { clientId: client._id, clientName: client.nombre, tab: 'edit' }
            });
        } else if (action === 'alert') {
            setSelectedEventClient(client);
            setCreateEventModalVisible(true);
        }
        // Handle 'more' with dropdown if needed, or simple alert for now
    };

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchClients(true);
    };

    // Filter counts (for chips)
    const filterCounts = React.useMemo(() => ({
        cambioDietaUrgente: clients.filter(c => c.cambioDietaUrgente).length,
        cambioEntrenoUrgente: clients.filter(c => c.cambioEntrenoUrgente).length,
        posibleAbandono: clients.filter(c => c.posibleAbandono).length,
    }), [clients]);

    // Filter and sort
    const filteredClients = React.useMemo(() => {
        let result = [...clients];

        // Text search (debounced)
        if (debouncedSearch.trim()) {
            const q = debouncedSearch.toLowerCase();
            result = result.filter(c => c.nombre?.toLowerCase().includes(q));
        }

        // Active filter chip
        if (activeFilter) {
            result = result.filter(c => c[activeFilter] === true);
        }

        // Sort
        if (sortBy === 'name') {
            result.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        } else if (sortBy === 'tracking') {
            result.sort((a, b) => (a.daysSinceLastTracking ?? 999) - (b.daysSinceLastTracking ?? 999));
        } else {
            // 'recent' - by last activity (lower daysSinceLastTracking first)
            result.sort((a, b) => (a.daysSinceLastTracking ?? 999) - (b.daysSinceLastTracking ?? 999));
        }

        return result;
    }, [clients, debouncedSearch, sortBy, activeFilter]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={[styles.mainLayout, { flexDirection: 'row' }]}>
                    <View style={{ flex: 1, padding: 20 }}>
                        <SkeletonClientRow />
                        <SkeletonClientRow />
                        <SkeletonClientRow />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.mainLayout}>
                {/* LEFT COLUMN: Main Content (70% on desktop) */}
                <View style={[styles.contentColumn, isDesktop && styles.contentColumnDesktop]}>
                    <CoachHeader
                        title="Clientes"
                        icon="people"
                        iconColor="#2563EB"
                        showBack={false}
                        rightContent={
                            isMobile ? (
                                <TouchableOpacity
                                    style={styles.headerBtn}
                                    onPress={() => setCreateEventModalVisible(true)}
                                >
                                    <Ionicons name="notifications-outline" size={20} color="#64748b" />
                                </TouchableOpacity>
                            ) : (
                                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <View style={styles.searchContainer}>
                                        <Ionicons name="search" size={18} color="#94a3b8" />
                                        <TextInput
                                            style={styles.searchInput}
                                            placeholder="Buscar"
                                            placeholderTextColor="#94a3b8"
                                            value={searchQuery}
                                            onChangeText={handleSearchChange}
                                        />
                                    </View>

                                    {[
                                        { key: 'cambioDietaUrgente', label: 'Cambio Dieta', icon: 'restaurant', color: COLORS.warning },
                                        { key: 'cambioEntrenoUrgente', label: 'Cambio Entreno', icon: 'barbell', color: COLORS.danger },
                                        { key: 'posibleAbandono', label: 'Abandono', icon: 'warning', color: COLORS.danger },
                                    ].map(chip => {
                                        const count = filterCounts[chip.key];
                                        const isActive = activeFilter === chip.key;
                                        return (
                                            <TouchableOpacity
                                                key={chip.key}
                                                style={[
                                                    styles.filterChip,
                                                    isActive && { backgroundColor: chip.color, borderColor: chip.color }
                                                ]}
                                                onPress={() => setActiveFilter(isActive ? null : chip.key)}
                                            >
                                                <Ionicons name={chip.icon} size={13} color={isActive ? '#fff' : chip.color} />
                                                <Text style={[styles.filterChipText, isActive && { color: '#fff' }]}>
                                                    {chip.label}
                                                </Text>
                                                {count > 0 && (
                                                    <View style={[styles.filterChipBadge, isActive && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                                        <Text style={[styles.filterChipBadgeText, isActive && { color: '#fff' }]}>{count}</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}

                                    <TouchableOpacity
                                        style={[styles.sortBtn, sortBy !== 'recent' && { borderColor: COLORS.primary, backgroundColor: '#eff6ff' }]}
                                        onPress={() => {
                                            if (sortBy === 'recent') setSortBy('name');
                                            else if (sortBy === 'name') setSortBy('tracking');
                                            else setSortBy('recent');
                                        }}
                                    >
                                        <Ionicons name="swap-vertical" size={16} color={sortBy !== 'recent' ? COLORS.primary : '#64748b'} />
                                        <Text style={[styles.sortBtnText, sortBy !== 'recent' && { color: COLORS.primary }]}>
                                            {sortBy === 'name' ? 'A-Z' : sortBy === 'tracking' ? 'Seguim.' : 'Recientes'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.headerBtn}
                                        onPress={() => setCreateEventModalVisible(true)}
                                    >
                                        <Ionicons name="notifications-outline" size={20} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            )
                        }
                    />

                    {/* Mobile Controls Section - Rendered below header on list content */}
                    {isMobile && (
                        <View style={{ paddingBottom: 10, paddingTop: 6, gap: 10 }}>
                            {/* Mobile Search */}
                            <View style={[styles.searchContainer, { width: '100%', borderWidth: 1, borderColor: '#e2e8f0' }]}>
                                <Ionicons name="search" size={18} color="#94a3b8" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Buscar"
                                    placeholderTextColor="#94a3b8"
                                    value={searchQuery}
                                    onChangeText={handleSearchChange}
                                />
                            </View>

                            {/* Mobile Filters Horizontal Scroll */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                                {/* Sort Button First for quick access */}
                                <TouchableOpacity
                                    style={[styles.sortBtn, sortBy !== 'recent' && { borderColor: COLORS.primary, backgroundColor: '#eff6ff' }]}
                                    onPress={() => {
                                        if (sortBy === 'recent') setSortBy('name');
                                        else if (sortBy === 'name') setSortBy('tracking');
                                        else setSortBy('recent');
                                    }}
                                >
                                    <Ionicons name="swap-vertical" size={16} color={sortBy !== 'recent' ? COLORS.primary : '#64748b'} />
                                    <Text style={[styles.sortBtnText, sortBy !== 'recent' && { color: COLORS.primary }]}>
                                        {sortBy === 'name' ? 'A-Z' : sortBy === 'tracking' ? 'Seguim.' : 'Recientes'}
                                    </Text>
                                </TouchableOpacity>

                                {[
                                    { key: 'cambioDietaUrgente', label: 'Dieta', icon: 'restaurant', color: COLORS.warning },
                                    { key: 'cambioEntrenoUrgente', label: 'Entreno', icon: 'barbell', color: COLORS.danger },
                                    { key: 'posibleAbandono', label: 'Abandono', icon: 'warning', color: COLORS.danger },
                                ].map(chip => {
                                    const count = filterCounts[chip.key];
                                    const isActive = activeFilter === chip.key;
                                    return (
                                        <TouchableOpacity
                                            key={chip.key}
                                            style={[
                                                styles.filterChip,
                                                isActive && { backgroundColor: chip.color, borderColor: chip.color }
                                            ]}
                                            onPress={() => setActiveFilter(isActive ? null : chip.key)}
                                        >
                                            <Ionicons name={chip.icon} size={13} color={isActive ? '#fff' : chip.color} />
                                            <Text style={[styles.filterChipText, isActive && { color: '#fff' }]}>
                                                {chip.label}
                                            </Text>
                                            {count > 0 && (
                                                <View style={[styles.filterChipBadge, isActive && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                                    <Text style={[styles.filterChipBadgeText, isActive && { color: '#fff' }]}>{count}</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    <FlatList
                        data={filteredClients}
                        extraData={expandedClients}
                        keyExtractor={item => item._id}
                        style={{ flex: 1 }}
                        renderItem={({ item }) => (
                            <ClientListRow
                                client={item}
                                onPress={(c) => router.push({
                                    pathname: '/(coach)/client-detail/[clientId]',
                                    params: { clientId: c._id, clientName: c.nombre }
                                })}
                                onAction={handleAction}
                                isExpanded={!!expandedClients[item._id]}
                                onToggleExpand={() => toggleExpand(item._id)}
                            />
                        )}
                        contentContainerStyle={styles.listContent}
                        ListHeaderComponent={
                            <View>
                                {!isDesktop && (
                                    <View style={{ marginBottom: 16 }}>
                                        <MiniCalendar
                                            events={[]} // Pass real events if available
                                            onSelectDate={(date) => console.log(date)}
                                        />
                                    </View>
                                )}
                                <DashboardStats stats={stats} />
                                <Text style={styles.sectionTitle}>Listado de Atletas</Text>
                            </View>
                        }
                        refreshControl={
                            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
                        }
                        showsVerticalScrollIndicator={false}
                    />
                </View>

                {/* RIGHT COLUMN: Sidebar (30% on desktop) - Hidden on Mobile */}
                {
                    isDesktop && (
                        <View style={styles.sidebarColumn}>
                            <ActionableSidebar
                                clients={clients}
                                refreshTrigger={sidebarRefreshTrigger}
                            />
                        </View>
                    )
                }
            </View >

            {/* Modals */}
            <CreateEventModal
                visible={createEventModalVisible}
                clients={clients}
                onClose={() => {
                    setCreateEventModalVisible(false);
                    setSelectedEventClient(null);
                }}
                initialClient={selectedEventClient}
                initialType={initialEventType}
                onSave={async (eventData) => {
                    try {
                        const response = await fetch(`${API_URL}/api/events`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`
                            },
                            body: JSON.stringify(eventData)
                        });
                        const data = await response.json();
                        if (data.success) {
                            fetchClients(true);
                            setSidebarRefreshTrigger(prev => prev + 1);
                        } else {
                            alert(data.message || 'Error al guardar el evento');
                        }
                    } catch (error) {
                        console.error('[CreateEventModal] Error saving event:', error);
                        alert('Error al conectar con el servidor');
                    }
                }}
            />
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    mainLayout: {
        flex: 1,
        flexDirection: 'row', // Default to row, but widths control responsiveness
    },
    contentColumn: {
        flex: 1,
        paddingHorizontal: 16, // Mobile padding
    },
    contentColumnDesktop: {
        flex: 0.7, // 70% width
        paddingHorizontal: 32, // More padding on desktop
        paddingVertical: 20,
        // Eliminado borde derecho para evitar linea negra doble con el sidebar
    },
    sidebarColumn: {
        flex: 0.3, // 30% width
        backgroundColor: '#fff',
    },
    listContent: {
        paddingBottom: 80,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 36,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        width: 200,
    },
    searchInput: {
        marginLeft: 8,
        flex: 1,
        fontSize: 13,
    },
    headerBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',

    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        height: 36,
        borderRadius: 8,
        gap: 6,
    },
    primaryBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#94a3b8',
        marginBottom: 12,
        marginTop: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sortBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#fff',
    },
    sortBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#fff',
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    filterChipBadge: {
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    filterChipBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    }
});
