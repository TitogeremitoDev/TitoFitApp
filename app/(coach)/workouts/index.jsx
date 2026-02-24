/* app/(coach)/workouts/index.jsx - Lista de Clientes para Rutinas (Estilo Nutrición) */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Platform,
} from 'react-native';
import { EnhancedTextInput } from '../../../components/ui';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import CoachHeader from '../components/CoachHeader';
import AssignRoutineModal from './assign-modal';
import CoachGuideModal from '../../../src/components/coach/CoachGuideModal';

export default function WorkoutsClientsScreen() {
    const router = useRouter();
    const { token } = useAuth();

    const [clients, setClients] = useState([]);
    const [routines, setRoutines] = useState([]);
    const [currentRoutines, setCurrentRoutines] = useState([]); // Rutinas asignadas a clientes
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [assignModalVisible, setAssignModalVisible] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [guideModalVisible, setGuideModalVisible] = useState(false);
    const [guideModalClient, setGuideModalClient] = useState(null);
    const [guideSummary, setGuideSummary] = useState({}); // { clientId: { training: true } }

    // Search and Sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name'); // 'name', 'hasRoutine'

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    const fetchData = async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);

            // Fetch clients
            const clientsRes = await fetch(`${API_URL}/api/trainers/clients`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const clientsData = await clientsRes.json();

            if (clientsData.success) {
                setClients(clientsData.clients || []);
            }

            // Fetch routines (plantillas del coach)
            const routinesRes = await fetch(`${API_URL}/api/routines`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const routinesData = await routinesRes.json();

            if (routinesData.success) {
                setRoutines(routinesData.routines || []);
            }

            // Fetch current routines (rutinas asignadas a clientes)
            const currentRoutinesRes = await fetch(`${API_URL}/api/current-routines/coach/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const currentRoutinesData = await currentRoutinesRes.json();

            if (currentRoutinesData.success) {
                setCurrentRoutines(currentRoutinesData.routines || []);
            }

            // Fetch guide summary (qué clientes tienen guía)
            const guidesRes = await fetch(`${API_URL}/api/coach-guides/summary`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const guidesData = await guidesRes.json();
            if (guidesData.success) {
                setGuideSummary(guidesData.summary || {});
            }

        } catch (error) {
            console.error('[WorkoutsClients] Error:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchData(true);
    };

    // Get routine info for a client using CurrentRoutines
    const getClientRoutineSummary = (client) => {
        // Buscar en currentRoutines (el nuevo sistema)
        const clientCurrentRoutines = currentRoutines.filter(
            cr => String(cr.userId?._id || cr.userId) === String(client._id) && cr.isActive
        );

        if (clientCurrentRoutines.length === 0) {
            // Fallback: buscar en el array legacy de rutinas del cliente
            const legacyRoutines = client.rutinas || [];
            if (legacyRoutines.length === 0) {
                return {
                    hasRoutine: false,
                    routineName: null,
                    routineDays: null,
                    routineId: null,
                    currentRoutineId: null,
                    count: 0,
                    isModified: false,
                };
            }

            // Usar legacy data
            const routineRef = legacyRoutines[0];
            const routineId = typeof routineRef === 'string' ? routineRef : routineRef?._id;
            const routineData = routines.find(r => r._id === routineId);

            return {
                hasRoutine: true,
                routineName: routineData?.nombre || 'Rutina asignada',
                routineDays: routineData?.dias || null,
                routineId: routineId,
                currentRoutineId: null, // No hay currentRoutine
                count: legacyRoutines.length,
                enfoque: routineData?.enfoque || null,
                isModified: false,
            };
        }

        // Usar el nuevo sistema CurrentRoutine
        const mainRoutine = clientCurrentRoutines[0];

        return {
            hasRoutine: true,
            routineName: mainRoutine.nombre,
            routineDays: mainRoutine.dias,
            routineId: mainRoutine.sourceRoutineId,
            currentRoutineId: mainRoutine._id, // ID de la CurrentRoutine
            count: clientCurrentRoutines.length,
            enfoque: mainRoutine.enfoque || null,
            isModified: mainRoutine.isModified || false,
        };
    };

    const openAssignModal = (client) => {
        setSelectedClient(client);
        setAssignModalVisible(true);
    };

    const handleClientPress = (client) => {
        const summary = getClientRoutineSummary(client);

        if (summary.hasRoutine && summary.routineId) {
            // Navigate to routine editor
            const routineData = routines.find(r => r._id === summary.routineId);
            router.push({
                pathname: '/(coach)/workouts/create',
                params: {
                    id: summary.routineId,
                    name: routineData?.nombre,
                    days: routineData?.dias,
                    enfoque: routineData?.enfoque,
                    nivel: routineData?.nivel
                }
            });
        } else {
            // Open assign modal
            openAssignModal(client);
        }
    };

    const handleEditRoutine = (client) => {
        const summary = getClientRoutineSummary(client);
        if (!summary.hasRoutine) return;

        // 🆕 Si hay currentRoutineId, buscar en currentRoutines para obtener los datos correctos
        if (summary.currentRoutineId) {
            const currentRoutine = currentRoutines.find(cr => cr._id === summary.currentRoutineId);
            if (currentRoutine) {
                router.push({
                    pathname: '/(coach)/workouts/create',
                    params: {
                        id: currentRoutine.sourceRoutineId, // ID de la plantilla original para referencia
                        currentRoutineId: summary.currentRoutineId, // 🆕 ID de la CurrentRoutine a editar
                        name: currentRoutine.nombre,
                        days: currentRoutine.dias,
                        enfoque: currentRoutine.enfoque,
                        nivel: currentRoutine.nivel,
                        clientId: client._id,
                        clientName: client.nombre,
                        isCurrentRoutine: 'true' // Flag para indicar que es edición de CurrentRoutine
                    }
                });
                return;
            }
        }

        // Fallback: usar rutina original (legacy)
        if (summary.routineId) {
            const routineData = routines.find(r => r._id === summary.routineId);
            router.push({
                pathname: '/(coach)/workouts/create',
                params: {
                    id: summary.routineId,
                    name: routineData?.nombre,
                    days: routineData?.dias,
                    enfoque: routineData?.enfoque,
                    nivel: routineData?.nivel
                }
            });
        }
    };

    const handleRemoveRoutine = async (client) => {
        const summary = getClientRoutineSummary(client);
        if (!summary.hasRoutine) return;

        const doRemove = async () => {
            try {
                let response;

                // Si hay currentRoutineId, usar el nuevo sistema
                if (summary.currentRoutineId) {
                    response = await fetch(`${API_URL}/api/current-routines/${summary.currentRoutineId}/archive`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        }
                    });
                } else {
                    // Fallback: usar el sistema legacy
                    const updatedRutinas = (client.rutinas || []).filter(
                        r => (typeof r === 'string' ? r : r._id) !== summary.routineId
                    );

                    response = await fetch(`${API_URL}/api/users/${client._id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ rutinas: updatedRutinas })
                    });
                }

                if (response.ok) {
                    if (Platform.OS === 'web') {
                        alert('Rutina eliminada del cliente');
                    } else {
                        Alert.alert('Éxito', 'Rutina eliminada del cliente');
                    }
                    fetchData(true);
                } else {
                    if (Platform.OS === 'web') {
                        alert('No se pudo eliminar la rutina');
                    } else {
                        Alert.alert('Error', 'No se pudo eliminar la rutina');
                    }
                }
            } catch (error) {
                console.error('Error removing routine:', error);
                if (Platform.OS === 'web') {
                    alert('Error de conexión');
                } else {
                    Alert.alert('Error', 'Error de conexión');
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`¿Quitar la rutina "${summary.routineName}" de ${client.nombre}?`)) {
                doRemove();
            }
        } else {
            Alert.alert(
                'Eliminar Rutina',
                `¿Quitar la rutina "${summary.routineName}" de ${client.nombre}?`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: doRemove }
                ]
            );
        }
    };

    const renderClientCard = ({ item }) => {
        const summary = getClientRoutineSummary(item);

        return (
            <View style={styles.clientCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                    <View style={[styles.avatarContainer, { backgroundColor: summary.hasRoutine ? '#f59e0b' : '#94a3b8' }]}>
                        <Text style={styles.avatarText}>
                            {item.nombre?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                    </View>
                    <View style={styles.clientInfo}>
                        <Text style={styles.clientName}>{item.nombre}</Text>
                        {summary.hasRoutine ? (
                            <View style={[styles.statusBadge, { backgroundColor: '#10b98120' }]}>
                                <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                                <Text style={[styles.statusText, { color: '#10b981' }]}>
                                    Rutina actual
                                </Text>
                            </View>
                        ) : (
                            <View style={[styles.statusBadge, { backgroundColor: '#94a3b820' }]}>
                                <Ionicons name="alert-circle" size={12} color="#94a3b8" />
                                <Text style={[styles.statusText, { color: '#94a3b8' }]}>
                                    Sin rutina
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Routine Info */}
                <View style={styles.routineInfoSection}>
                    {summary.hasRoutine ? (
                        <>
                            <View style={styles.routineMainInfo}>
                                <Ionicons name="fitness" size={18} color="#f59e0b" />
                                <Text style={styles.routineName}>{summary.routineName}</Text>
                                {summary.isModified && (
                                    <View style={[styles.statusBadge, { backgroundColor: '#8b5cf620', marginLeft: 8 }]}>
                                        <Ionicons name="pencil" size={10} color="#8b5cf6" />
                                        <Text style={[styles.statusText, { color: '#8b5cf6', fontSize: 10 }]}>
                                            Modificada
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.routineStats}>
                                <View style={styles.statItem}>
                                    <Ionicons name="calendar-outline" size={14} color="#64748b" />
                                    <Text style={styles.statValue}>
                                        {summary.routineDays || '---'} días
                                    </Text>
                                </View>
                                {summary.enfoque && (
                                    <View style={styles.statItem}>
                                        <Ionicons name="flash-outline" size={14} color="#64748b" />
                                        <Text style={styles.statValue}>{summary.enfoque}</Text>
                                    </View>
                                )}
                                {summary.count > 1 && (
                                    <View style={styles.statItem}>
                                        <Ionicons name="layers-outline" size={14} color="#64748b" />
                                        <Text style={styles.statValue}>+{summary.count - 1} más</Text>
                                    </View>
                                )}
                            </View>

                            {/* Action Buttons */}
                            <View style={styles.actionButtonsRow}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.actionBtnAssign]}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        openAssignModal(item);
                                    }}
                                >
                                    <Ionicons name="swap-horizontal" size={16} color="#3b82f6" />
                                    <Text style={[styles.actionBtnText, { color: '#3b82f6' }]}>Cambiar</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.actionBtnEdit]}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleEditRoutine(item);
                                    }}
                                >
                                    <Ionicons name="create-outline" size={16} color="#f59e0b" />
                                    <Text style={[styles.actionBtnText, { color: '#f59e0b' }]}>Editar</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.actionBtnDelete]}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleRemoveRoutine(item);
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                    <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Quitar</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <View style={styles.noRoutineContainer}>
                            <TouchableOpacity
                                style={styles.assignButton}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    openAssignModal(item);
                                }}
                            >
                                <Ionicons name="add-circle" size={18} color="#f59e0b" />
                                <Text style={styles.assignButtonText}>Asignar rutina</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Botón Guía de Entrenamiento */}
                    {(() => {
                        const hasGuide = guideSummary[item._id]?.training;
                        return (
                            <TouchableOpacity
                                style={[styles.guideBtn, hasGuide && styles.guideBtnActive]}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    setGuideModalClient(item);
                                    setGuideModalVisible(true);
                                }}
                            >
                                <Ionicons
                                    name={hasGuide ? 'checkmark-circle' : 'document-text-outline'}
                                    size={15}
                                    color={hasGuide ? '#22c55e' : '#8b5cf6'}
                                />
                                <Text style={[styles.guideBtnText, hasGuide && { color: '#22c55e' }]}>
                                    Guía Entreno
                                </Text>
                            </TouchableOpacity>
                        );
                    })()}
                </View>
            </View>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={80} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Sin Clientes</Text>
            <Text style={styles.emptyText}>
                No tienes clientes asignados. Comparte tu código de entrenador para que se vinculen.
            </Text>
        </View>
    );

    // Filter and sort clients (MUST be before any early return)
    const filteredClients = React.useMemo(() => {
        let result = [...clients];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(c => c.nombre?.toLowerCase().includes(q));
        }
        switch (sortBy) {
            case 'hasRoutine':
                result.sort((a, b) => {
                    const aHas = getClientRoutineSummary(a).hasRoutine ? 1 : 0;
                    const bHas = getClientRoutineSummary(b).hasRoutine ? 1 : 0;
                    return bHas - aHas;
                });
                break;
            case 'name':
            default:
                result.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        }
        return result;
    }, [clients, currentRoutines, routines, searchQuery, sortBy]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{ headerShown: false }} />
                <CoachHeader
                    title="Rutinas"
                    subtitle="Asignación de entrenamientos"
                    icon="fitness"
                    iconColor="#f59e0b"
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#f59e0b" />
                    <Text style={styles.loadingText}>Cargando clientes...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <CoachHeader
                title="Rutinas"
                subtitle={`${clients.length} clientes`}
                icon="fitness"
                iconColor="#f59e0b"
            />

            {/* Search and Sort Bar */}
            <View style={styles.searchSortBar}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color="#94a3b8" />
                    <EnhancedTextInput
                        style={styles.searchInput}
                        containerStyle={{ flex: 1 }}
                        placeholder="Buscar cliente..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.sortButtons}>
                    <TouchableOpacity
                        style={[styles.sortBtn, sortBy === 'name' && styles.sortBtnActive]}
                        onPress={() => setSortBy('name')}
                    >
                        <Ionicons name="text-outline" size={16} color={sortBy === 'name' ? '#fff' : '#64748b'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.sortBtn, sortBy === 'hasRoutine' && styles.sortBtnActive]}
                        onPress={() => setSortBy('hasRoutine')}
                    >
                        <Ionicons name="fitness-outline" size={16} color={sortBy === 'hasRoutine' ? '#fff' : '#64748b'} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Mis Rutinas Button */}
            <TouchableOpacity
                style={styles.libraryBtn}
                onPress={() => router.push('/(coach)/workouts/routines-library')}
            >
                <View style={styles.libraryBtnLeft}>
                    <Ionicons name="barbell" size={20} color="#f59e0b" />
                    <Text style={styles.libraryBtnText}>Mis Rutinas</Text>
                    <View style={styles.libraryBtnBadge}>
                        <Text style={styles.libraryBtnBadgeText}>{routines.length}</Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#f59e0b" />
            </TouchableOpacity>

            <FlatList
                data={filteredClients}
                keyExtractor={(item) => item._id}
                renderItem={renderClientCard}
                ListEmptyComponent={renderEmpty}
                style={{ flex: 1 }}
                contentContainerStyle={clients.length === 0 ? styles.emptyList : styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        colors={['#f59e0b']}
                    />
                }
            />

            <AssignRoutineModal
                visible={assignModalVisible}
                onClose={() => {
                    setAssignModalVisible(false);
                    setSelectedClient(null);
                    fetchData(true); // Refresh after assignment
                }}
                routine={null}
                preselectedClient={selectedClient}
            />

            {guideModalVisible && guideModalClient && (
                <CoachGuideModal
                    visible={guideModalVisible}
                    client={guideModalClient}
                    category="training"
                    onClose={() => {
                        setGuideModalVisible(false);
                        setGuideModalClient(null);
                        // Refresh summary para actualizar el check
                        fetch(`${API_URL}/api/coach-guides/summary`, {
                            headers: { Authorization: `Bearer ${token}` }
                        })
                            .then(r => r.json())
                            .then(d => { if (d.success) setGuideSummary(d.summary || {}); })
                            .catch(() => {});
                    }}
                    token={token}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#64748b',
    },
    // Search and Sort
    searchSortBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 38,
        gap: 8,
    },
    searchInput: {
        fontSize: 14,
        color: '#1e293b',
    },
    sortButtons: {
        flexDirection: 'row',
        gap: 6,
    },
    sortBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    sortBtnActive: {
        backgroundColor: '#f59e0b',
    },
    list: {
        padding: 16,
    },
    emptyList: {
        flex: 1,
    },

    // Library Button
    libraryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fef3c715',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f59e0b30',
    },
    libraryBtnLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    libraryBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#f59e0b',
    },
    libraryBtnBadge: {
        backgroundColor: '#f59e0b20',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    libraryBtnBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#f59e0b',
    },

    // Client Card
    clientCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    clientInfo: {
        flex: 1,
    },
    clientName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1e293b',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 4,
        marginTop: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },

    // Routine Info Section
    routineInfoSection: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
    },
    routineMainInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    routineName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
        flex: 1,
    },
    routineStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statValue: {
        fontSize: 13,
        color: '#64748b',
    },

    // Action Buttons
    actionButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    actionBtnAssign: {
        backgroundColor: '#eff6ff',
    },
    actionBtnEdit: {
        backgroundColor: '#fef3c7',
    },
    actionBtnDelete: {
        backgroundColor: '#fef2f2',
    },
    actionBtnText: {
        fontSize: 12,
        fontWeight: '600',
    },

    guideBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        marginTop: 10,
        paddingVertical: 7,
        backgroundColor: '#f5f3ff',
        borderRadius: 8,
    },
    guideBtnActive: {
        backgroundColor: '#f0fdf4',
    },
    guideBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8b5cf6',
    },

    // No Routine
    noRoutineContainer: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    assignButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#fef3c7',
        borderRadius: 20,
    },
    assignButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#f59e0b',
    },

    // Empty state
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 16,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 22,
    },
});