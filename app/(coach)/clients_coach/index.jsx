import React, { useState, useEffect } from 'react';
import {
    Modal, Alert, View, Text, StyleSheet, SafeAreaView, FlatList, RefreshControl,
    ActivityIndicator, TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';

export default function ClientsScreen() {
    const router = useRouter();
    const { token } = useAuth();

    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [maxClients, setMaxClients] = useState(5);
    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        clientId: null,
        clientName: ''
    });
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);

            const response = await fetch(`${API_URL}/api/trainers/clients`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success) {
                setClients(data.clients || []);
                setMaxClients(data.maxClients || 5);
            }
        } catch (error) {
            console.error('[ClientsScreen] Error fetching clients:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleDeleteClient = (clientId, clientName) => {
        console.log('[DELETE CLIENT] Button pressed for:', clientId, clientName);
        setConfirmModal({
            visible: true,
            clientId,
            clientName
        });
    };

    const confirmDelete = async () => {
        const { clientId, clientName } = confirmModal;

        // Cerrar modal
        setConfirmModal({ visible: false, clientId: null, clientName: '' });

        try {
            console.log('[DELETE] Making DELETE request to:', `${API_URL}/api/trainers/clients/${clientId}`);
            const response = await fetch(
                `${API_URL}/api/trainers/clients/${clientId}`,
                {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            console.log('[DELETE] Response status:', response.status);
            const data = await response.json();
            console.log('[DELETE] Response data:', data);

            if (data.success) {
                fetchClients();
            }
        } catch (error) {
            console.error('[DELETE] Error deleting client:', error);
        }
    };

    const cancelDelete = () => {
        setConfirmModal({ visible: false, clientId: null, clientName: '' });
    };

    const handleMessageClient = (client) => {
        router.push({
            pathname: '/(coach)/communication',
            params: { preselectedClient: client._id }
        });
    };

    const handleClientPayments = (client) => {
        router.push({
            pathname: '/(coach)/payments',
            params: { clientId: client._id }
        });
    };

    const handleClientEvolution = (client) => {
        router.push({
            pathname: '/(coach)/evolution',
            params: { clientId: client._id }
        });
    };

    const handleClientNutrition = (client) => {
        router.push({
            pathname: '/(coach)/nutrition',
            params: { clientId: client._id }
        });
    };
    const onRefresh = () => {
        setIsRefreshing(true);
        fetchClients(true);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const renderClientCard = ({ item }) => (
        <View style={styles.clientCard}>
            <View style={styles.clientInfo}>
                <View style={styles.clientHeader}>
                    <Ionicons name="person-circle" size={40} color="#3b82f6" />
                    <View style={styles.clientDetails}>
                        <Text style={styles.clientName}>{item.nombre}</Text>
                        <Text style={styles.clientEmail}>{item.email}</Text>
                        <Text style={styles.clientUsername}>@{item.username}</Text>
                    </View>
                </View>

                <View style={styles.clientMeta}>
                    <View style={styles.metaItem}>
                        <Ionicons name="fitness" size={14} color="#64748b" />
                        <Text style={styles.metaText}>{item.tipoUsuario}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Ionicons name="calendar" size={14} color="#64748b" />
                        <Text style={styles.metaText}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.messageButton]}
                    onPress={() => handleMessageClient(item)}
                >
                    <Ionicons name="chatbubble-outline" size={18} color="#3b82f6" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.paymentsButton]}
                    onPress={() => handleClientPayments(item)}
                >
                    <Ionicons name="card-outline" size={18} color="#10b981" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.evolutionButton]}
                    onPress={() => router.push({
                        pathname: '/(coach)/progress/[clientId]',
                        params: { clientId: item._id, clientName: item.nombre }
                    })}
                >
                    <Ionicons name="trending-up-outline" size={18} color="#8b5cf6" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.nutritionButton]}

                >
                    <Ionicons name="nutrition-outline" size={18} color="#f59e0b" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteClient(item._id, item.nombre)}
                >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={80} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Sin Clientes Asignados</Text>
            <Text style={styles.emptyText}>
                Comparte tu código de entrenador para que los usuarios puedan vincularse contigo.
            </Text>
        </View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <CoachHeader
                    title="Clientes"
                    icon="people"
                    iconColor="#10b981"
                    badge={`0 / ${maxClients}`}
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={styles.loadingText}>Cargando clientes...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (

        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Clientes"
                icon="people"
                iconColor="#10b981"
                badge={`${clients.length} / ${maxClients}`}
            />

            <FlatList
                data={clients}
                keyExtractor={(item) => item._id}
                renderItem={renderClientCard}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={clients.length === 0 ? styles.emptyList : styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        colors={['#10b981']}
                    />
                }
            />

            {/* Modal de Confirmación */}
            <Modal
                transparent={true}
                visible={confirmModal.visible}
                animationType="fade"
                onRequestClose={cancelDelete}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Ionicons name="warning" size={48} color="#ef4444" />
                            <Text style={styles.modalTitle}>Eliminar Cliente</Text>
                        </View>

                        <Text style={styles.modalMessage}>
                            ¿Desvincular a {confirmModal.clientName}? El cliente podrá volver a vincularse con otro entrenador.
                        </Text>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={cancelDelete}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.deleteButtonModal]}
                                onPress={confirmDelete}
                            >
                                <Text style={styles.deleteButtonText}>Eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b'
    },
    headerBadge: {
        backgroundColor: '#dbeafe',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    headerBadgeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3b82f6',
    },
    listContent: {
        padding: 16
    },
    clientCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    clientInfo: {
        marginBottom: 12,
    },
    clientHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    clientDetails: {
        flex: 1,
    },
    clientName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    clientEmail: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 2,
    },
    clientUsername: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '500',
    },
    clientMeta: {
        flexDirection: 'row',
        gap: 16,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    actionButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
    },
    messageButton: {
        borderColor: '#93c5fd',
        backgroundColor: '#eff6ff',
    },
    paymentsButton: {
        borderColor: '#86efac',
        backgroundColor: '#f0fdf4',
    },
    evolutionButton: {
        borderColor: '#c4b5fd',
        backgroundColor: '#faf5ff',
    },
    nutritionButton: {
        borderColor: '#fcd34d',
        backgroundColor: '#fffbeb',
    },
    deleteButton: {
        borderColor: '#fca5a5',
        backgroundColor: '#fef2f2',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        color: '#94a3b8',
        marginTop: 16,
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '90%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 12,
    },
    modalMessage: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
    },
    deleteButtonModal: {
        backgroundColor: '#ef4444',
    },
    deleteButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 16,
    }
});
