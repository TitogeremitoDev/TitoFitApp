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
    TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

export default function AssignRoutineModal({ visible, onClose, routine }) {
    const { token } = useAuth();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [assigning, setAssigning] = useState(false);

    const API_URL = process.env.EXPO_PUBLIC_API_URL;

    useEffect(() => {
        if (visible) {
            fetchClients();
        }
    }, [visible]);

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
                Alert.alert('Error', 'No se pudieron cargar los clientes');
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
            Alert.alert('Error', 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (client) => {
        try {
            setAssigning(true);
            const response = await fetch(`${API_URL}/api/routines/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    routineId: routine._id,
                    clientId: client._id
                })
            });
            const data = await response.json();

            if (data.success) {
                Alert.alert('Éxito', `Rutina asignada a ${client.nombre}`);
                onClose();
            } else {
                Alert.alert('Error', data.message || 'No se pudo asignar la rutina');
            }
        } catch (error) {
            console.error('Error assigning routine:', error);
            Alert.alert('Error', 'Error de conexión');
        } finally {
            setAssigning(false);
        }
    };

    const filteredClients = clients.filter(client =>
        client.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderClientItem = ({ item }) => (
        <TouchableOpacity
            style={styles.clientCard}
            onPress={() => handleAssign(item)}
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
                        <Text style={styles.title}>Asignar Rutina</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>
                        Selecciona un cliente para asignarle "{routine?.nombre}"
                    </Text>

                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#94a3b8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar cliente..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={filteredClients}
                            renderItem={renderClientItem}
                            keyExtractor={item => item._id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No se encontraron clientes</Text>
                            }
                        />
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
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: '#1e293b'
    },
    listContent: {
        paddingBottom: 20
    },
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
    emptyText: {
        textAlign: 'center',
        color: '#94a3b8',
        marginTop: 20
    },
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
