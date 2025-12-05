import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

export default function ClientsScreen() {
    const router = useRouter();
    const { token } = useAuth();

    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [maxClients, setMaxClients] = useState(5);

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
            <View style={styles.clientAvatar}>
                <Ionicons name="person" size={32} color="#10b981" />
            </View>
            <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{item.nombre}</Text>
                <Text style={styles.clientEmail}>{item.email}</Text>
                <Text style={styles.clientMeta}>
                    @{item.username} • {item.tipoUsuario}
                </Text>
                <Text style={styles.clientDate}>
                    Vinculado: {formatDate(item.createdAt)}
                </Text>
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
                <View style={styles.header}>
                    <Text style={styles.title}>Clientes</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={styles.loadingText}>Cargando clientes...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Clientes</Text>
                <View style={styles.statsRow}>
                    <Text style={styles.statsText}>
                        {clients.length} / {maxClients}
                    </Text>
                </View>
            </View>

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
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b'
    },
    statsRow: {
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#86efac',
    },
    statsText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#10b981',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#64748b',
    },
    list: {
        padding: 16,
    },
    emptyList: {
        flex: 1,
    },
    clientCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    clientAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#f0fdf4',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    clientInfo: {
        flex: 1,
        justifyContent: 'center',
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
    clientMeta: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 2,
    },
    clientDate: {
        fontSize: 12,
        color: '#10b981',
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
    },
});
