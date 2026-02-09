import React, { useState, useEffect, useMemo } from 'react';
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
import { EnhancedTextInput } from '../../../components/ui';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useImpersonation } from '../../../context/ImpersonationContext';
import { usePathname } from 'expo-router';
import moment from 'moment';
import 'moment/locale/es';

moment.locale('es');

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

interface Client {
    _id: string;
    nombre: string;
    email: string;
    username: string;
    tipoUsuario: string;
    isCoordinator?: boolean;
    currentPlan: string;
    totalSpent: number;
    totalPayments: number;
    subscriptionStatus: string | null;
    createdAt: string;
    updatedAt: string;
}

type SortOption = 'DATE_DESC' | 'DATE_ASC' | 'SPENT_DESC' | 'PAYMENTS_DESC';
type RoleFilter = 'ALL' | 'FREEUSER' | 'PREMIUM' | 'ENTRENADOR' | 'CLIENTE' | 'ADMINISTRADOR' | 'SUPERVISOR';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export default function ClientsScreen() {
    const { isDark } = useTheme();
    const { user } = useAuth();
    const router = useRouter();

    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRole, setSelectedRole] = useState<RoleFilter>('ALL');
    const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('ALL');
    const [sortBy, setSortBy] = useState<SortOption>('DATE_DESC');
    const [showSortModal, setShowSortModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

    const { startImpersonation } = useImpersonation();
    const pathname = usePathname();

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const token = await AsyncStorage.getItem('totalgains_token');
            if (!token) {
                Alert.alert('Error', 'No se encontró token de autenticación');
                return;
            }

            const response = await fetch(`${API_URL}/api/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                const usersList = Array.isArray(data) ? data : (data.users || []);
                setClients(usersList);
            } else {
                console.error('Error fetching clients:', data);
                Alert.alert('Error', 'No se pudieron cargar los clientes');
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
            Alert.alert('Error', 'Ocurrió un error al cargar los clientes');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchClients();
    };

    const deleteClient = async (clientId: string, clientName: string) => {
        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`¿Estás seguro de que quieres eliminar a ${clientName}? Esta acción no se puede deshacer.`);
            if (confirmed) {
                await performDelete(clientId);
            }
        } else {
            Alert.alert(
                "Eliminar Usuario",
                `¿Estás seguro de que quieres eliminar a ${clientName}? Esta acción no se puede deshacer.`,
                [
                    { text: "Cancelar", style: "cancel" },
                    {
                        text: "Eliminar",
                        style: "destructive",
                        onPress: () => performDelete(clientId)
                    }
                ]
            );
        }
    };

    const performDelete = async (clientId: string) => {
        try {
            const token = await AsyncStorage.getItem('totalgains_token');
            const response = await fetch(`${API_URL}/api/users/${clientId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                if (Platform.OS !== 'web') Alert.alert("Éxito", "Usuario eliminado correctamente");
                else window.alert("Usuario eliminado correctamente");

                // Update local state to remove the deleted user
                setClients(prev => prev.filter(c => c._id !== clientId));
            } else {
                const errData = await response.json();
                const msg = errData.message || "No se pudo eliminar el usuario";
                if (Platform.OS !== 'web') Alert.alert("Error", msg);
                else window.alert(`Error: ${msg}`);
            }
        } catch (error) {
            console.error("Delete Error:", error);
            if (Platform.OS !== 'web') Alert.alert("Error", "Ocurrió un error de red al intentar eliminar");
            else window.alert("Ocurrió un error de red al intentar eliminar");
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // IMPERSONATION (God Mode)
    // ═══════════════════════════════════════════════════════════════════════════
    const handleImpersonate = async (clientId: string, clientName: string) => {
        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`¿Entrar como ${clientName}? Podrás ver y editar su cuenta.`);
            if (!confirmed) return;
        } else {
            // En mobile usamos Alert pero no esperamos confirmación inline
            Alert.alert(
                "🕵️ Modo Dios",
                `¿Entrar como ${clientName}? Podrás ver y editar su cuenta.`,
                [
                    { text: "Cancelar", style: "cancel" },
                    {
                        text: "Entrar",
                        onPress: async () => {
                            setImpersonatingId(clientId);
                            const success = await startImpersonation(clientId, pathname);
                            if (!success) {
                                Alert.alert("Error", "No se pudo iniciar la impersonación");
                            }
                            setImpersonatingId(null);
                        }
                    }
                ]
            );
            return;
        }

        // Web flow (ya confirmó arriba)
        setImpersonatingId(clientId);
        const success = await startImpersonation(clientId, pathname);
        if (!success) {
            window.alert("Error: No se pudo iniciar la impersonación");
        }
        setImpersonatingId(null);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // TOGGLE COORDINATOR
    // ═══════════════════════════════════════════════════════════════════════════
    const toggleCoordinator = async (clientId: string, clientName: string, currentValue: boolean) => {
        const action = currentValue ? 'quitar coordinador a' : 'hacer coordinador a';
        const confirmMsg = `¿${currentValue ? 'Quitar rol de coordinador a' : 'Hacer coordinador a'} ${clientName}?`;

        const doToggle = async () => {
            try {
                const token = await AsyncStorage.getItem('totalgains_token');
                const response = await fetch(`${API_URL}/api/users/${clientId}/coordinator`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ isCoordinator: !currentValue })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Update local state
                    setClients(prev => prev.map(c =>
                        c._id === clientId
                            ? { ...c, isCoordinator: !currentValue, tipoUsuario: data.user?.tipoUsuario || c.tipoUsuario }
                            : c
                    ));
                    const msg = data.message || 'Actualizado correctamente';
                    if (Platform.OS !== 'web') Alert.alert('Exito', msg);
                    else window.alert(msg);
                } else {
                    const msg = data.message || 'Error al actualizar';
                    if (Platform.OS !== 'web') Alert.alert('Error', msg);
                    else window.alert(`Error: ${msg}`);
                }
            } catch (error) {
                console.error('[ToggleCoordinator] Error:', error);
                if (Platform.OS !== 'web') Alert.alert('Error', 'Error de red');
                else window.alert('Error de red');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) await doToggle();
        } else {
            Alert.alert('Coordinador', confirmMsg, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Confirmar', onPress: doToggle }
            ]);
        }
    };

    // Advanced Filtering & Sorting Logic
    const filteredClients = useMemo(() => {
        let result = [...clients];

        // 1. Text Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(client =>
                (client.nombre && client.nombre.toLowerCase().includes(query)) ||
                (client.email && client.email.toLowerCase().includes(query)) ||
                (client.username && client.username.toLowerCase().includes(query))
            );
        }

        // 2. Role Filter
        if (selectedRole === 'SUPERVISOR') {
            result = result.filter(client => client.isCoordinator === true);
        } else if (selectedRole !== 'ALL') {
            result = result.filter(client => client.tipoUsuario === selectedRole);
        }

        // 3. Status Filter
        if (selectedStatus !== 'ALL') {
            result = result.filter(client => {
                if (selectedStatus === 'ACTIVE') return client.subscriptionStatus === 'active';
                if (selectedStatus === 'INACTIVE') return client.subscriptionStatus !== 'active';
                return true;
            });
        }

        // 4. Sorting
        result.sort((a, b) => {
            switch (sortBy) {
                case 'DATE_DESC':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'DATE_ASC':
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                case 'SPENT_DESC':
                    return (b.totalSpent || 0) - (a.totalSpent || 0);
                case 'PAYMENTS_DESC':
                    return (b.totalPayments || 0) - (a.totalPayments || 0);
                default:
                    return 0;
            }
        });

        return result;
    }, [clients, searchQuery, selectedRole, selectedStatus, sortBy]);

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'ADMINISTRADOR': return '#EF4444';
            case 'ENTRENADOR': return '#8B5CF6';
            case 'PREMIUM': return '#F59E0B';
            case 'CLIENTE': return '#3B82F6';
            default: return '#10B981';
        }
    };

    const renderClientItem = ({ item }: { item: Client }) => (
        <View style={[styles.card, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
            <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                    <View style={[styles.avatarPlaceholder, { backgroundColor: getRoleColor(item.tipoUsuario) }]}>
                        <Text style={styles.avatarText}>
                            {item.nombre ? item.nombre.charAt(0).toUpperCase() : '?'}
                        </Text>
                    </View>
                    <View>
                        <Text style={[styles.name, { color: isDark ? '#fff' : '#000' }]}>{item.nombre || 'Sin nombre'}</Text>
                        <Text style={[styles.username, { color: isDark ? '#9ca3af' : '#6b7280' }]}>@{item.username}</Text>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.tipoUsuario) + '20' }]}>
                            <Text style={[styles.roleText, { color: getRoleColor(item.tipoUsuario) }]}>{item.tipoUsuario}</Text>
                        </View>
                        {item.isCoordinator && (
                            <View style={[styles.roleBadge, { backgroundColor: '#8B5CF620' }]}>
                                <Text style={[styles.roleText, { color: '#8B5CF6' }]}>COORD</Text>
                            </View>
                        )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        {/* Toggle Coordinator - Solo para ENTRENADOR */}
                        {item.tipoUsuario === 'ENTRENADOR' && (
                            <TouchableOpacity
                                onPress={() => toggleCoordinator(item._id, item.nombre || 'Usuario', !!item.isCoordinator)}
                            >
                                <Ionicons
                                    name={item.isCoordinator ? 'shield-checkmark' : 'shield-outline'}
                                    size={20}
                                    color={item.isCoordinator ? '#8B5CF6' : '#9ca3af'}
                                />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            onPress={() => handleImpersonate(item._id, item.nombre || 'Usuario')}
                            disabled={impersonatingId === item._id}
                        >
                            {impersonatingId === item._id ? (
                                <ActivityIndicator size="small" color="#8B5CF6" />
                            ) : (
                                <Ionicons name="eye" size={20} color="#8B5CF6" />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteClient(item._id, item.nombre || 'Usuario')}>
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                    <Ionicons name="mail-outline" size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                    <Text style={[styles.detailText, { color: isDark ? '#d1d5db' : '#374151' }]}>{item.email}</Text>
                </View>

                <View style={styles.statsGrid}>
                    <View style={[styles.statBox, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                        <Text style={[styles.statLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Gastado</Text>
                        <Text style={[styles.statValue, { color: isDark ? '#fff' : '#000' }]}>${item.totalSpent || 0}</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                        <Text style={[styles.statLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Pagos</Text>
                        <Text style={[styles.statValue, { color: isDark ? '#fff' : '#000' }]}>{item.totalPayments || 0}</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                        <Text style={[styles.statLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Plan</Text>
                        <Text style={[styles.statValue, { color: item.currentPlan === 'free' ? '#9ca3af' : '#F59E0B' }]}>
                            {item.currentPlan ? item.currentPlan.toUpperCase() : 'N/A'}
                        </Text>
                    </View>
                </View>

                <View style={styles.footerRow}>
                    <View style={[styles.statusIndicator, { backgroundColor: item.subscriptionStatus === 'active' ? '#10B981' : '#9ca3af' }]} />
                    <Text style={[styles.footerText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                        {item.subscriptionStatus === 'active' ? 'Suscripción Activa' : 'Sin Suscripción Activa'}
                    </Text>
                    <Text style={[styles.dateText, { color: isDark ? '#6b7280' : '#9ca3af' }]}>
                        • {moment(item.createdAt).format('D MMM YYYY')}
                    </Text>
                </View>
            </View>
        </View>
    );

    const FilterChip = ({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) => (
        <TouchableOpacity
            style={[
                styles.filterChip,
                {
                    backgroundColor: active ? (isDark ? '#3B82F6' : '#2563EB') : (isDark ? '#374151' : '#e5e7eb'),
                    borderColor: active ? 'transparent' : (isDark ? '#4B5563' : '#d1d5db')
                }
            ]}
            onPress={onPress}
        >
            <Text style={[styles.filterChipText, { color: active ? '#fff' : (isDark ? '#d1d5db' : '#374151') }]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#121212' : '#f3f4f6' }]}>
            <Stack.Screen options={{
                title: 'Gestión de Clientes',
                headerShown: true,
                headerStyle: { backgroundColor: isDark ? '#1a1a1a' : '#fff' },
                headerTintColor: isDark ? '#fff' : '#000',
                headerRight: () => (
                    <TouchableOpacity onPress={() => setShowSortModal(true)} style={{ marginRight: 10 }}>
                        <MaterialIcons name="sort" size={24} color={isDark ? '#fff' : '#000'} />
                    </TouchableOpacity>
                )
            }} />

            <View style={[styles.headerContainer, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
                {/* Search Bar */}
                <View style={[styles.searchContainer, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                    <Ionicons name="search" size={20} color={isDark ? '#9ca3af' : '#6b7280'} style={styles.searchIcon} />
                    <EnhancedTextInput
                        style={[styles.searchInputText, { color: isDark ? '#fff' : '#000' }]}
                        containerStyle={styles.searchInputContainer}
                        placeholder="Buscar cliente..."
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

                {/* Filters ScrollView */}
                <View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                        <FilterChip label="Todos" active={selectedRole === 'ALL'} onPress={() => setSelectedRole('ALL')} />
                        <FilterChip label="Free" active={selectedRole === 'FREEUSER'} onPress={() => setSelectedRole('FREEUSER')} />
                        <FilterChip label="Premium" active={selectedRole === 'PREMIUM'} onPress={() => setSelectedRole('PREMIUM')} />
                        <FilterChip label="Entrenador" active={selectedRole === 'ENTRENADOR'} onPress={() => setSelectedRole('ENTRENADOR')} />
                        <FilterChip label="Supervisor" active={selectedRole === 'SUPERVISOR'} onPress={() => setSelectedRole('SUPERVISOR')} />
                        <FilterChip label="Cliente" active={selectedRole === 'CLIENTE'} onPress={() => setSelectedRole('CLIENTE')} />
                    </ScrollView>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filtersScroll, { marginTop: 8 }]}>
                        <Text style={[styles.filterLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Estado:</Text>
                        <FilterChip label="Todos" active={selectedStatus === 'ALL'} onPress={() => setSelectedStatus('ALL')} />
                        <FilterChip label="Activos" active={selectedStatus === 'ACTIVE'} onPress={() => setSelectedStatus('ACTIVE')} />
                        <FilterChip label="Inactivos" active={selectedStatus === 'INACTIVE'} onPress={() => setSelectedStatus('INACTIVE')} />
                    </ScrollView>
                </View>

                <View style={styles.resultsInfo}>
                    <Text style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                        Mostrando {filteredClients.length} de {clients.length} clientes
                    </Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10B981" />
                </View>
            ) : (
                <FlatList
                    data={filteredClients}
                    renderItem={renderClientItem}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={64} color={isDark ? '#374151' : '#d1d5db'} />
                            <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                                No se encontraron resultados
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Sort Modal */}
            <Modal
                visible={showSortModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowSortModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
                        <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>Ordenar por</Text>

                        <TouchableOpacity style={styles.sortOption} onPress={() => { setSortBy('DATE_DESC'); setShowSortModal(false); }}>
                            <Text style={[styles.sortText, { color: isDark ? '#d1d5db' : '#374151', fontWeight: sortBy === 'DATE_DESC' ? 'bold' : 'normal' }]}>Más recientes</Text>
                            {sortBy === 'DATE_DESC' && <Ionicons name="checkmark" size={20} color="#10B981" />}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.sortOption} onPress={() => { setSortBy('DATE_ASC'); setShowSortModal(false); }}>
                            <Text style={[styles.sortText, { color: isDark ? '#d1d5db' : '#374151', fontWeight: sortBy === 'DATE_ASC' ? 'bold' : 'normal' }]}>Más antiguos</Text>
                            {sortBy === 'DATE_ASC' && <Ionicons name="checkmark" size={20} color="#10B981" />}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.sortOption} onPress={() => { setSortBy('SPENT_DESC'); setShowSortModal(false); }}>
                            <Text style={[styles.sortText, { color: isDark ? '#d1d5db' : '#374151', fontWeight: sortBy === 'SPENT_DESC' ? 'bold' : 'normal' }]}>Mayor Gasto</Text>
                            {sortBy === 'SPENT_DESC' && <Ionicons name="checkmark" size={20} color="#10B981" />}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.sortOption} onPress={() => { setSortBy('PAYMENTS_DESC'); setShowSortModal(false); }}>
                            <Text style={[styles.sortText, { color: isDark ? '#d1d5db' : '#374151', fontWeight: sortBy === 'PAYMENTS_DESC' ? 'bold' : 'normal' }]}>Más Pagos</Text>
                            {sortBy === 'PAYMENTS_DESC' && <Ionicons name="checkmark" size={20} color="#10B981" />}
                        </TouchableOpacity>
                    </View>
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
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        zIndex: 10,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 12,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInputContainer: {
        flex: 1,
    },
    searchInputText: {
        fontSize: 16,
    },
    filtersScroll: {
        alignItems: 'center',
        gap: 8,
        paddingRight: 16,
    },
    filterLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginRight: 4,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '500',
    },
    resultsInfo: {
        marginTop: 12,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    listContent: {
        padding: 16,
        paddingTop: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    username: {
        fontSize: 13,
    },
    roleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    roleText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        marginBottom: 12,
    },
    detailsContainer: {
        gap: 12,
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
        padding: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 11,
        marginBottom: 2,
    },
    statValue: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    statusIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    footerText: {
        fontSize: 12,
    },
    dateText: {
        fontSize: 12,
        marginLeft: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    sortOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(156, 163, 175, 0.1)',
    },
    sortText: {
        fontSize: 16,
    }
});
