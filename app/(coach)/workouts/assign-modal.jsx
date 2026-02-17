import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    Platform
} from 'react-native';
import { EnhancedTextInput } from '../../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

export default function AssignRoutineModal({ visible, onClose, routine, preselectedClient }) {
    const { token } = useAuth();
    const [clients, setClients] = useState([]);
    const [routines, setRoutines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [assigning, setAssigning] = useState(false);
    // Confirmation step state
    const [confirmStep, setConfirmStep] = useState(false);
    const [pendingRoutineId, setPendingRoutineId] = useState(null);
    const [pendingClientId, setPendingClientId] = useState(null);
    const [pendingRoutineName, setPendingRoutineName] = useState('');
    const [editedName, setEditedName] = useState('');

    const API_URL = process.env.EXPO_PUBLIC_API_URL;

    // Mode: 'selectClient' when routine is provided, 'selectRoutine' when preselectedClient is provided
    const mode = preselectedClient ? 'selectRoutine' : 'selectClient';

    useEffect(() => {
        if (visible) {
            setSearchQuery('');
            setConfirmStep(false);
            setPendingRoutineId(null);
            setPendingClientId(null);
            setPendingRoutineName('');
            setEditedName('');
            if (mode === 'selectClient') {
                fetchClients();
            } else {
                fetchRoutines();
            }
        }
    }, [visible, mode]);

    const fetchClients = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/trainers/clients`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setClients(data.clients || []);
            } else {
                if (Platform.OS === 'web') {
                    alert('No se pudieron cargar los clientes');
                } else {
                    Alert.alert('Error', 'No se pudieron cargar los clientes');
                }
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
            if (Platform.OS === 'web') {
                alert('Error de conexión');
            } else {
                Alert.alert('Error', 'Error de conexión');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchRoutines = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/routines`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setRoutines(data.routines || []);
            } else {
                if (Platform.OS === 'web') {
                    alert('No se pudieron cargar las rutinas');
                } else {
                    Alert.alert('Error', 'No se pudieron cargar las rutinas');
                }
            }
        } catch (error) {
            console.error('Error fetching routines:', error);
            if (Platform.OS === 'web') {
                alert('Error de conexión');
            } else {
                Alert.alert('Error', 'Error de conexión');
            }
        } finally {
            setLoading(false);
        }
    };

    const showConfirmation = (routineId, clientId, routineName) => {
        setPendingRoutineId(routineId);
        setPendingClientId(clientId);
        setPendingRoutineName(routineName);
        setEditedName(routineName);
        setConfirmStep(true);
    };

    const handleConfirmAssign = async () => {
        try {
            setAssigning(true);
            const finalName = editedName.trim() || pendingRoutineName;
            const response = await fetch(`${API_URL}/api/current-routines/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    routineId: pendingRoutineId,
                    clientId: pendingClientId,
                    customName: finalName !== pendingRoutineName ? finalName : undefined
                })
            });
            const data = await response.json();

            if (data.success) {
                if (Platform.OS === 'web') {
                    alert('Rutina asignada correctamente');
                } else {
                    Alert.alert('Éxito', 'Rutina asignada correctamente');
                }
                onClose();
            } else {
                if (Platform.OS === 'web') {
                    alert(data.message || 'No se pudo asignar la rutina');
                } else {
                    Alert.alert('Error', data.message || 'No se pudo asignar la rutina');
                }
            }
        } catch (error) {
            console.error('Error assigning routine:', error);
            if (Platform.OS === 'web') {
                alert('Error de conexión');
            } else {
                Alert.alert('Error', 'Error de conexión');
            }
        } finally {
            setAssigning(false);
        }
    };

    const handleSelectClient = (client) => {
        showConfirmation(routine._id, client._id, routine?.nombre || '');
    };

    const handleSelectRoutine = (selectedRoutine) => {
        showConfirmation(selectedRoutine._id, preselectedClient._id, selectedRoutine.nombre || '');
    };

    const filteredClients = clients.filter(client =>
        client.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredRoutines = routines.filter(r =>
        r.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderClientItem = ({ item }) => (
        <TouchableOpacity
            style={styles.clientCard}
            onPress={() => handleSelectClient(item)}
            disabled={assigning}
        >
            <View style={styles.clientAvatar}>
                <Text style={styles.avatarText}>{item.nombre.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{item.nombre}</Text>
                <Text style={styles.clientEmail}>{item.email}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
        </TouchableOpacity>
    );

    const renderRoutineItem = ({ item }) => (
        <TouchableOpacity
            style={styles.routineCard}
            onPress={() => handleSelectRoutine(item)}
            disabled={assigning}
        >
            <View style={styles.routineIcon}>
                <Ionicons name="fitness" size={20} color="#f59e0b" />
            </View>
            <View style={styles.routineInfo}>
                <Text style={styles.routineName}>{item.nombre}</Text>
                <Text style={styles.routineDetails}>
                    {item.dias} días • {item.enfoque || 'General'}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            {mode === 'selectClient' ? 'Asignar Rutina' : 'Seleccionar Rutina'}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {confirmStep ? (
                        <View style={styles.confirmContainer}>
                            <View style={styles.confirmIconWrap}>
                                <Ionicons name="alert-circle-outline" size={48} color="#f59e0b" />
                            </View>
                            <Text style={styles.confirmTitle}>
                                Esta rutina aparecerá con este nombre:
                            </Text>
                            <EnhancedTextInput
                                style={styles.confirmInputText}
                                containerStyle={styles.confirmInputContainer}
                                value={editedName}
                                onChangeText={setEditedName}
                                placeholder="Nombre de la rutina"
                                placeholderTextColor="#94a3b8"
                                selectTextOnFocus
                            />
                            <Text style={styles.confirmHint}>
                                Puedes modificar el nombre antes de asignarla para que el cliente la identifique correctamente.
                            </Text>
                            <TouchableOpacity
                                style={[styles.confirmButton, (!editedName.trim()) && styles.confirmButtonDisabled]}
                                onPress={handleConfirmAssign}
                                disabled={assigning || !editedName.trim()}
                            >
                                {assigning ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>Asignar rutina</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmBackButton}
                                onPress={() => setConfirmStep(false)}
                                disabled={assigning}
                            >
                                <Text style={styles.confirmBackText}>Volver</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.subtitle}>
                                {mode === 'selectClient'
                                    ? `Selecciona un cliente para asignarle "${routine?.nombre}"`
                                    : `Selecciona una rutina para ${preselectedClient?.nombre}`
                                }
                            </Text>

                            <View style={styles.searchContainer}>
                                <Ionicons name="search" size={20} color="#94a3b8" />
                                <EnhancedTextInput
                                    style={styles.searchInputText}
                                    containerStyle={styles.searchInputContainer}
                                    placeholder={mode === 'selectClient' ? "Buscar cliente..." : "Buscar rutina..."}
                                    placeholderTextColor="#94a3b8"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>

                            {loading ? (
                                <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />
                            ) : mode === 'selectClient' ? (
                                <FlatList
                                    data={filteredClients}
                                    renderItem={renderClientItem}
                                    keyExtractor={item => item._id}
                                    contentContainerStyle={styles.listContent}
                                    ListEmptyComponent={
                                        <Text style={styles.emptyText}>No se encontraron clientes</Text>
                                    }
                                />
                            ) : (
                                <FlatList
                                    data={filteredRoutines}
                                    renderItem={renderRoutineItem}
                                    keyExtractor={item => item._id}
                                    contentContainerStyle={styles.listContent}
                                    ListEmptyComponent={
                                        <View style={styles.emptyContainer}>
                                            <Ionicons name="barbell-outline" size={48} color="#cbd5e1" />
                                            <Text style={styles.emptyText}>No tienes rutinas creadas</Text>
                                            <Text style={styles.emptySubtext}>
                                                Ve a "Mis Rutinas" para crear una
                                            </Text>
                                        </View>
                                    }
                                />
                            )}
                        </>
                    )}

                    {assigning && (
                        <View style={styles.assigningOverlay}>
                            <ActivityIndicator size="large" color="#fff" />
                            <Text style={styles.assigningText}>Asignando...</Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '80%',
        padding: 20
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b'
    },
    closeButton: {
        padding: 4
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 16
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 16
    },
    searchInputContainer: {
        flex: 1,
        marginLeft: 8,
    },
    searchInputText: {
        fontSize: 16,
        color: '#1e293b',
    },
    listContent: {
        paddingBottom: 20
    },
    // Client styles
    clientCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    clientAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b'
    },
    clientInfo: {
        flex: 1
    },
    clientName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b'
    },
    clientEmail: {
        fontSize: 12,
        color: '#94a3b8'
    },
    // Routine styles
    routineCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        marginBottom: 8
    },
    routineIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fef3c7',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    routineInfo: {
        flex: 1
    },
    routineName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b'
    },
    routineDetails: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2
    },
    // Empty state
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40
    },
    emptyText: {
        textAlign: 'center',
        color: '#94a3b8',
        marginTop: 12,
        fontSize: 15
    },
    emptySubtext: {
        textAlign: 'center',
        color: '#cbd5e1',
        marginTop: 4,
        fontSize: 13
    },
    // Confirmation step
    confirmContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16
    },
    confirmIconWrap: {
        marginBottom: 16
    },
    confirmTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 20
    },
    confirmInputContainer: {
        width: '100%',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 12
    },
    confirmInputText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        textAlign: 'center'
    },
    confirmHint: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 18
    },
    confirmButton: {
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 32,
        width: '100%',
        alignItems: 'center',
        marginBottom: 12
    },
    confirmButtonDisabled: {
        opacity: 0.5
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700'
    },
    confirmBackButton: {
        paddingVertical: 10,
        paddingHorizontal: 20
    },
    confirmBackText: {
        color: '#64748b',
        fontSize: 15,
        fontWeight: '500'
    },
    // Assigning overlay
    assigningOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24
    },
    assigningText: {
        color: '#fff',
        marginTop: 10,
        fontWeight: '600'
    }
});
