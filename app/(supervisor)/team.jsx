import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    RefreshControl,
    ScrollView,
    Modal,
    Pressable,
    Platform
} from 'react-native';
import { EnhancedTextInput } from '../../components/ui';
import { Stack, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useImpersonation } from '../../context/ImpersonationContext';
import AvatarWithInitials from '../../src/components/shared/AvatarWithInitials';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

export default function SupervisorTeamScreen() {
    const { isDark } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const [coaches, setCoaches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, PENDING
    const [impersonatingId, setImpersonatingId] = useState(null);

    // Invite modal state
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);

    const { startImpersonation } = useImpersonation();

    useEffect(() => {
        fetchTeam();
    }, []);

    const fetchTeam = async () => {
        try {
            const token = await AsyncStorage.getItem('totalgains_token');
            if (!token) return;

            const response = await fetch(`${API_URL}/api/supervisor/team`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (response.ok) {
                const list = data.users || [];
                setCoaches(list);
            } else {
                console.error('[SupervisorTeam] Error:', data);
                Alert.alert('Error', data.message || 'No se pudo cargar el equipo');
            }
        } catch (error) {
            console.error('[SupervisorTeam] Fetch error:', error);
            Alert.alert('Error', 'Error de conexión');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchTeam();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // INVITE
    // ═══════════════════════════════════════════════════════════════════════════
    const handleInvite = async () => {
        if (!inviteEmail.trim()) {
            Alert.alert('Error', 'Introduce el email del entrenador');
            return;
        }

        setInviteLoading(true);
        try {
            const token = await AsyncStorage.getItem('totalgains_token');
            const response = await fetch(`${API_URL}/api/supervisor/invite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: inviteEmail.trim() })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                Alert.alert('Invitacion enviada', data.message);
                setShowInviteModal(false);
                setInviteEmail('');
                fetchTeam(); // Refresh to show pending
            } else {
                Alert.alert('Error', data.message || 'No se pudo enviar la invitacion');
            }
        } catch (error) {
            console.error('[SupervisorTeam] Invite error:', error);
            Alert.alert('Error', 'Error de conexion');
        } finally {
            setInviteLoading(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // IMPERSONATION
    // ═══════════════════════════════════════════════════════════════════════════
    const handleImpersonate = useCallback(async (coachId, coachName) => {
        const doImpersonate = async () => {
            setImpersonatingId(coachId);
            const success = await startImpersonation(coachId, pathname, '/supervisor/impersonate');
            if (!success) {
                Alert.alert('Error', 'No se pudo iniciar la supervision');
            }
            setImpersonatingId(null);
        };

        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`Entrar como ${coachName}? Podras ver y editar su cuenta.`);
            if (confirmed) await doImpersonate();
        } else {
            Alert.alert(
                'Modo Supervisor',
                `Entrar como ${coachName}? Podras ver y editar su cuenta.`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Entrar', onPress: doImpersonate }
                ]
            );
        }
    }, [pathname, startImpersonation]);

    // ═══════════════════════════════════════════════════════════════════════════
    // FILTER & SEARCH
    // ═══════════════════════════════════════════════════════════════════════════
    const filteredCoaches = useMemo(() => {
        let result = [...coaches];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c =>
                (c.nombre && c.nombre.toLowerCase().includes(query)) ||
                (c.email && c.email.toLowerCase().includes(query)) ||
                (c.username && c.username.toLowerCase().includes(query))
            );
        }

        if (statusFilter !== 'ALL') {
            result = result.filter(c => {
                if (statusFilter === 'ACTIVE') return c.teamStatus === 'active';
                if (statusFilter === 'PENDING') return c.teamStatus === 'pending';
                return true;
            });
        }

        // Activos primero, luego pendientes
        result.sort((a, b) => {
            if (a.teamStatus === 'active' && b.teamStatus === 'pending') return -1;
            if (a.teamStatus === 'pending' && b.teamStatus === 'active') return 1;
            return 0;
        });

        return result;
    }, [coaches, searchQuery, statusFilter]);

    const activeCount = coaches.filter(c => c.teamStatus === 'active').length;
    const pendingCount = coaches.filter(c => c.teamStatus === 'pending').length;

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER COACH CARD
    // ═══════════════════════════════════════════════════════════════════════════
    const getActivityInfo = (lastActive) => {
        if (!lastActive) return { color: '#6b7280', label: 'Sin datos' };
        const hoursAgo = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60);
        if (hoursAgo < 1) return { color: '#10B981', label: 'Hace menos de 1h' };
        if (hoursAgo <= 48) return { color: '#10B981', label: `Hace ${Math.floor(hoursAgo)}h` };
        const daysAgo = Math.floor(hoursAgo / 24);
        if (daysAgo <= 7) return { color: '#F59E0B', label: `Hace ${daysAgo}d` };
        return { color: '#6b7280', label: `Hace ${daysAgo}d` };
    };

    const renderCoachCard = ({ item }) => {
        const isPending = item.teamStatus === 'pending';
        const activity = !isPending ? getActivityInfo(item.lastActive) : null;

        return (
            <View style={[styles.card, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <View>
                            <AvatarWithInitials
                                name={item.nombre || '?'}
                                avatarUrl={item.avatarUrl}
                                size={40}
                            />
                            {activity && (
                                <View style={[styles.activityDot, { backgroundColor: activity.color, borderColor: isDark ? '#1f2937' : '#fff' }]} />
                            )}
                        </View>
                        <View style={{ marginLeft: 12 }}>
                            <Text style={[styles.name, { color: isDark ? '#fff' : '#000' }]}>
                                {item.nombre || 'Sin nombre'}
                            </Text>
                            <Text style={[styles.username, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                                @{item.username || item.email}
                            </Text>
                        </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 5 }}>
                        {/* Status badge */}
                        <View style={[
                            styles.statusBadge,
                            { backgroundColor: isPending ? '#F59E0B20' : '#10B98120' }
                        ]}>
                            <View style={[
                                styles.statusDot,
                                { backgroundColor: isPending ? '#F59E0B' : '#10B981' }
                            ]} />
                            <Text style={[
                                styles.statusText,
                                { color: isPending ? '#F59E0B' : '#10B981' }
                            ]}>
                                {isPending ? 'Pendiente' : 'Activo'}
                            </Text>
                        </View>
                        {/* Impersonate button - only for active coaches */}
                        {!isPending && (
                            <TouchableOpacity
                                onPress={() => handleImpersonate(item._id, item.nombre || 'Entrenador')}
                                disabled={impersonatingId === item._id}
                                style={styles.eyeButton}
                            >
                                {impersonatingId === item._id ? (
                                    <ActivityIndicator size="small" color="#8B5CF6" />
                                ) : (
                                    <Ionicons name="eye" size={22} color="#8B5CF6" />
                                )}
                            </TouchableOpacity>
                        )}
                        {isPending && (
                            <Ionicons name="eye-off" size={22} color="#4B5563" />
                        )}
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                        <Ionicons name="mail-outline" size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                        <Text style={[styles.detailText, { color: isDark ? '#d1d5db' : '#374151' }]}>
                            {item.email}
                        </Text>
                    </View>

                    {activity && (
                        <View style={styles.detailRow}>
                            <Ionicons name="time-outline" size={16} color={activity.color} />
                            <Text style={[styles.detailText, { color: activity.color, fontSize: 13 }]}>
                                {activity.label}
                            </Text>
                        </View>
                    )}

                    {!isPending && (
                        <View style={styles.statsGrid}>
                            <View style={[styles.statBox, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                                <Text style={[styles.statLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Clientes</Text>
                                <Text style={[styles.statValue, { color: isDark ? '#fff' : '#000' }]}>
                                    {item.clientCount || 0}
                                </Text>
                            </View>
                            <View style={[styles.statBox, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                                <Text style={[styles.statLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Max Clientes</Text>
                                <Text style={[styles.statValue, { color: isDark ? '#fff' : '#000' }]}>
                                    {item.trainerProfile?.maxClients || 0}
                                </Text>
                            </View>
                            <View style={[styles.statBox, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                                <Text style={[styles.statLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Estado</Text>
                                <Text style={[styles.statValue, {
                                    color: item.subscriptionStatus === 'active' ? '#10B981' : '#9ca3af'
                                }]}>
                                    {item.subscriptionStatus === 'active' ? 'Activo' : 'Inactivo'}
                                </Text>
                            </View>
                        </View>
                    )}

                    {isPending && (
                        <View style={styles.pendingMessage}>
                            <Ionicons name="time-outline" size={16} color="#F59E0B" />
                            <Text style={[styles.pendingText, { color: '#F59E0B' }]}>
                                Esperando aceptacion del entrenador
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // FILTER CHIP
    // ═══════════════════════════════════════════════════════════════════════════
    const FilterChip = ({ label, active, onPress, count }) => (
        <TouchableOpacity
            style={[
                styles.filterChip,
                {
                    backgroundColor: active ? '#8B5CF6' : (isDark ? '#374151' : '#e5e7eb'),
                    borderColor: active ? 'transparent' : (isDark ? '#4B5563' : '#d1d5db')
                }
            ]}
            onPress={onPress}
        >
            <Text style={[styles.filterChipText, { color: active ? '#fff' : (isDark ? '#d1d5db' : '#374151') }]}>
                {label}{count !== undefined ? ` (${count})` : ''}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#121212' : '#f3f4f6' }]}>
            <Stack.Screen options={{
                title: 'Mi Equipo',
                headerShown: true,
                headerStyle: { backgroundColor: isDark ? '#1a1a1a' : '#fff' },
                headerTintColor: isDark ? '#fff' : '#000',
                headerRight: () => (
                    <TouchableOpacity
                        onPress={() => setShowInviteModal(true)}
                        style={styles.headerInviteButton}
                    >
                        <Ionicons name="person-add" size={20} color="#8B5CF6" />
                        {Platform.OS === 'web' && (
                            <Text style={styles.headerInviteText}>Invitar</Text>
                        )}
                    </TouchableOpacity>
                )
            }} />

            <View style={[styles.headerContainer, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
                {/* Search */}
                <View style={[styles.searchContainer, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                    <Ionicons name="search" size={20} color={isDark ? '#9ca3af' : '#6b7280'} style={styles.searchIcon} />
                    <EnhancedTextInput
                        style={[styles.searchInputText, { color: isDark ? '#fff' : '#000' }]}
                        containerStyle={styles.searchInputContainer}
                        placeholder="Buscar entrenador..."
                        placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                    <FilterChip label="Todos" active={statusFilter === 'ALL'} onPress={() => setStatusFilter('ALL')} count={coaches.length} />
                    <FilterChip label="Activos" active={statusFilter === 'ACTIVE'} onPress={() => setStatusFilter('ACTIVE')} count={activeCount} />
                    <FilterChip label="Pendientes" active={statusFilter === 'PENDING'} onPress={() => setStatusFilter('PENDING')} count={pendingCount} />
                </ScrollView>

                <View style={styles.resultsInfo}>
                    <Text style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                        {filteredCoaches.length} entrenador{filteredCoaches.length !== 1 ? 'es' : ''}
                    </Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8B5CF6" />
                </View>
            ) : (
                <FlatList
                    data={filteredCoaches}
                    renderItem={renderCoachCard}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="people-outline" size={64} color={isDark ? '#374151' : '#d1d5db'} />
                            <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                                {coaches.length === 0
                                    ? 'No tienes entrenadores en tu equipo.\nInvita a uno para empezar.'
                                    : 'No se encontraron resultados'
                                }
                            </Text>
                            {coaches.length === 0 && (
                                <TouchableOpacity
                                    style={styles.emptyInviteButton}
                                    onPress={() => setShowInviteModal(true)}
                                >
                                    <Ionicons name="person-add" size={18} color="#fff" />
                                    <Text style={styles.emptyInviteText}>Invitar Entrenador</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}

            {/* Invite Modal */}
            <Modal
                visible={showInviteModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowInviteModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowInviteModal(false)}>
                    <Pressable
                        style={[styles.modalContent, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>
                            Invitar Entrenador
                        </Text>
                        <Text style={[styles.modalSubtitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                            Introduce el email del entrenador que quieres agregar a tu equipo.
                        </Text>

                        <EnhancedTextInput
                            style={[styles.inviteInput, { color: isDark ? '#fff' : '#000' }]}
                            containerStyle={[styles.inviteInputContainer, {
                                backgroundColor: isDark ? '#374151' : '#f3f4f6',
                                borderColor: isDark ? '#4B5563' : '#d1d5db'
                            }]}
                            placeholder="email@ejemplo.com"
                            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                            value={inviteEmail}
                            onChangeText={setInviteEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => { setShowInviteModal(false); setInviteEmail(''); }}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.inviteButton]}
                                onPress={handleInvite}
                                disabled={inviteLoading}
                            >
                                {inviteLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.inviteButtonText}>Enviar Invitacion</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInputContainer: {
        flex: 1,
        backgroundColor: 'transparent',
        borderWidth: 0,
        paddingHorizontal: 0,
        paddingVertical: 0,
        margin: 0,
    },
    searchInputText: {
        fontSize: 15,
    },
    filtersScroll: {
        gap: 8,
        paddingVertical: 2,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '600',
    },
    resultsInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
    },
    username: {
        fontSize: 13,
        marginTop: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 5,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    activityDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    eyeButton: {
        padding: 4,
    },
    divider: {
        height: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 12,
    },
    detailsContainer: {
        gap: 10,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailText: {
        fontSize: 14,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    statBox: {
        flex: 1,
        padding: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 2,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    pendingMessage: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 4,
    },
    pendingText: {
        fontSize: 13,
        fontWeight: '500',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 80,
        gap: 12,
    },
    emptyText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    emptyInviteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 8,
    },
    emptyInviteText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    headerInviteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginRight: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#8B5CF620',
    },
    headerInviteText: {
        color: '#8B5CF6',
        fontWeight: '600',
        fontSize: 14,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 440,
        borderRadius: 20,
        padding: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        marginBottom: 20,
        lineHeight: 20,
    },
    inviteInputContainer: {
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 0,
        marginBottom: 20,
    },
    inviteInput: {
        fontSize: 16,
        paddingVertical: 12,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#e5e7eb',
    },
    cancelButtonText: {
        color: '#374151',
        fontWeight: '600',
        fontSize: 15,
    },
    inviteButton: {
        backgroundColor: '#8B5CF6',
    },
    inviteButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
});
