import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    RefreshControl
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import AssignRoutineModal from './assign-modal';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';
import { decode as atob } from 'base-64';

// Helpers for CSV
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(4);
const EXTRAS = ['Ninguno', 'Descendentes', 'Mio Reps', 'Parciales'];

const normalizeCSVRow = (row, ejId, sIdx) => ({
    id: `s-${ejId}-${sIdx}-${uid()}`,
    repMin: String(row.REPMIN ?? row.REPS ?? '6').trim(),
    repMax: String(row.REPMAX ?? row.REPS ?? '8').trim(),
    extra: EXTRAS.find((e) => e.toUpperCase() === String(row.EXTRA ?? '').toUpperCase()) || 'Ninguno',
});

const normalizeCSV = (parsedData) => {
    const rutina = {};
    const ejerciciosMap = new Map();

    parsedData.forEach((row) => {
        const diaKey = `dia${String(row.DIA ?? '1').trim()}`;
        if (!rutina[diaKey]) rutina[diaKey] = [];
        const nombre = String(row.EJERCICIO ?? 'Ejercicio sin nombre').trim();
        const musculo = String(row.MUSCULO ?? '').trim().toUpperCase();
        const extraEj = String(row.EXTRA_EJERCICIO ?? '').trim();
        const mapKey = `${diaKey}-${musculo}-${nombre}-${extraEj}`;

        if (!ejerciciosMap.has(mapKey)) {
            const ejId = `ej-${uid()}`;
            const newEj = { id: ejId, musculo, nombre, extra: extraEj, series: [] };
            ejerciciosMap.set(mapKey, newEj);
            rutina[diaKey].push(newEj);
        }
        const ej = ejerciciosMap.get(mapKey);
        ej.series.push(normalizeCSVRow(row, ej.id, ej.series.length));
    });

    // Convert object to array for backend: [[ej1, ej2], [ej3]]
    // We need to know max days to create the array structure
    const daysKeys = Object.keys(rutina);
    const maxDay = daysKeys.reduce((max, key) => {
        const num = parseInt(key.replace('dia', ''));
        return num > max ? num : max;
    }, 0);

    const daysArr = [];
    for (let i = 1; i <= maxDay; i++) {
        daysArr.push(rutina[`dia${i}`] || []);
    }

    return { daysArr, days: maxDay };
};

export default function WorkoutsScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const [routines, setRoutines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [assignModalVisible, setAssignModalVisible] = useState(false);
    const [selectedRoutine, setSelectedRoutine] = useState(null);

    const API_URL = process.env.EXPO_PUBLIC_API_URL;

    const fetchRoutines = async () => {
        try {
            const response = await fetch(`${API_URL}/api/routines`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setRoutines(data.routines);
            } else {
                Alert.alert('Error', 'No se pudieron cargar las rutinas');
            }
        } catch (error) {
            console.error('Error fetching routines:', error);
            Alert.alert('Error', 'Error de conexión');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchRoutines();
        }, [])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchRoutines();
    }, []);

    const handleDelete = async (id) => {
        console.log('🗑️ handleDelete called with id:', id);

        // En web, Alert.alert no funciona correctamente, usamos window.confirm
        const isWeb = typeof window !== 'undefined' && window.confirm;

        if (isWeb) {
            const confirmed = window.confirm('¿Estás seguro de que quieres eliminar esta rutina? Esta acción no se puede deshacer.');
            if (!confirmed) return;

            try {
                console.log('🗑️ Deleting routine:', id);
                const response = await fetch(`${API_URL}/api/routines/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log('🗑️ Delete response:', response.status, response.ok);
                if (response.ok) {
                    setRoutines(prev => prev.filter(r => r._id !== id));
                    window.alert('Rutina eliminada correctamente');
                } else {
                    const errorData = await response.json();
                    console.error('🗑️ Delete failed:', errorData);
                    window.alert('Error: No se pudo eliminar la rutina');
                }
            } catch (error) {
                console.error('🗑️ Error deleting routine:', error);
                window.alert('Error de conexión');
            }
        } else {
            // Mobile: usar Alert.alert normal
            Alert.alert(
                'Eliminar Rutina',
                '¿Estás seguro de que quieres eliminar esta rutina? Esta acción no se puede deshacer.',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                console.log('🗑️ Deleting routine:', id);
                                const response = await fetch(`${API_URL}/api/routines/${id}`, {
                                    method: 'DELETE',
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                console.log('🗑️ Delete response:', response.status, response.ok);
                                if (response.ok) {
                                    setRoutines(prev => prev.filter(r => r._id !== id));
                                    Alert.alert('Éxito', 'Rutina eliminada correctamente');
                                } else {
                                    const errorData = await response.json();
                                    console.error('🗑️ Delete failed:', errorData);
                                    Alert.alert('Error', 'No se pudo eliminar la rutina');
                                }
                            } catch (error) {
                                console.error('🗑️ Error deleting routine:', error);
                                Alert.alert('Error', 'Error de conexión');
                            }
                        }
                    }
                ]
            );
        }
    };

    const handleDuplicate = async (id) => {
        try {
            const response = await fetch(`${API_URL}/api/routines/${id}/duplicate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                Alert.alert('Éxito', 'Rutina duplicada correctamente');
                fetchRoutines();
            } else {
                Alert.alert('Error', 'No se pudo duplicar la rutina');
            }
        } catch (error) {
            console.error('Error duplicating routine:', error);
            Alert.alert('Error', 'Error de conexión');
        }
    };

    const handleImportCSV = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'text/comma-separated-values'],
                copyToCacheDirectory: true,
            });

            let fileUri = null;
            let fileName = 'Rutina importada';

            if (result.assets && result.assets.length > 0) {
                fileUri = result.assets[0].uri;
                fileName = result.assets[0].name;
            } else if (result.type === 'success' && result.uri) {
                fileUri = result.uri;
                fileName = result.name;
            }

            if (!fileUri) return;

            const fileContentBase64 = await FileSystem.readAsStringAsync(fileUri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            const fileContent = atob(fileContentBase64);
            const cleanContent = fileContent.startsWith('\uFEFF') ? fileContent.substring(1) : fileContent;

            Papa.parse(cleanContent, {
                header: true,
                skipEmptyLines: 'greedy',
                transformHeader: (h) => h.trim().toUpperCase(),
                complete: async (results) => {
                    if (results.errors.length > 0) {
                        Alert.alert('Error CSV', `Error al leer fila: ${results.errors[0].message}`);
                        return;
                    }

                    const { daysArr, days } = normalizeCSV(results.data);
                    const newRoutineName = fileName.replace(/\.(csv|txt)$/i, '') || 'Rutina Importada';

                    // Send to backend
                    try {
                        const response = await fetch(`${API_URL}/api/routines`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                nombre: newRoutineName,
                                dias: days,
                                diasArr: daysArr,
                                division: 'Importada',
                                enfoque: 'General',
                                nivel: 'Intermedio'
                            })
                        });
                        const data = await response.json();
                        if (data.success) {
                            Alert.alert('Éxito', `Rutina "${newRoutineName}" importada.`);
                            fetchRoutines();
                        } else {
                            Alert.alert('Error', data.message || 'No se pudo guardar la rutina importada');
                        }
                    } catch (e) {
                        Alert.alert('Error', 'Error al guardar en servidor');
                    }
                },
                error: (err) => Alert.alert('Error', `No se pudo procesar el CSV: ${err.message}`),
            });
        } catch (e) {
            Alert.alert('Error', `No se pudo importar el archivo: ${e.message}`);
        }
    };

    const handleImportIA = () => {
        Alert.alert('Próximamente', 'La importación por IA estará disponible en futuras actualizaciones. 🤖✨');
    };

    const openAssignModal = (routine) => {
        setSelectedRoutine(routine);
        setAssignModalVisible(true);
    };

    const renderRoutineItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.routineName}>{item.nombre}</Text>
                    <Text style={styles.routineInfo}>
                        {item.dias} Días • {item.enfoque || 'General'} • {item.nivel || 'Intermedio'}
                    </Text>
                </View>
                {item.isTemplate && <Ionicons name="copy-outline" size={16} color="#64748b" />}
            </View>

            <View style={styles.cardActions}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push({
                        pathname: '/(coach)/workouts/create',
                        params: {
                            id: item._id,
                            name: item.nombre,
                            days: item.dias,
                            enfoque: item.enfoque,
                            nivel: item.nivel
                        }
                    })}
                >
                    <Ionicons name="pencil" size={20} color="#3b82f6" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDuplicate(item._id)}
                >
                    <Ionicons name="duplicate-outline" size={20} color="#8b5cf6" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openAssignModal(item)}
                >
                    <Ionicons name="person-add-outline" size={20} color="#10b981" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDelete(item._id)}
                >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <Text style={styles.title}>Biblioteca de Rutinas</Text>
                <View style={styles.headerButtons}>
                    <TouchableOpacity onPress={handleImportCSV} style={styles.iconButton}>
                        <Ionicons name="document-text-outline" size={20} color="#334155" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleImportIA} style={styles.iconButton}>
                        <Ionicons name="sparkles-outline" size={20} color="#334155" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => router.push('/(coach)/workouts/create')}
                        style={styles.createButton}
                    >
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            ) : (
                <FlatList
                    data={routines}
                    renderItem={renderRoutineItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="barbell-outline" size={64} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No has creado ninguna rutina aún</Text>
                            <TouchableOpacity
                                style={styles.createEmptyButton}
                                onPress={() => router.push('/(coach)/workouts/create')}
                            >
                                <Text style={styles.createEmptyButtonText}>Crear mi primera rutina</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            <AssignRoutineModal
                visible={assignModalVisible}
                onClose={() => setAssignModalVisible(false)}
                routine={selectedRoutine}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    backButton: { padding: 8 },
    title: { fontSize: 20, fontWeight: '700', color: '#1e293b', flex: 1, marginLeft: 8 },
    iconButton: {
        padding: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 8
    },
    createButton: {
        backgroundColor: '#3b82f6',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 16 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16
    },
    routineName: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
    routineInfo: { fontSize: 14, color: '#64748b' },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 12
    },
    actionButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc'
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        marginTop: 60
    },
    emptyText: {
        fontSize: 16,
        color: '#94a3b8',
        marginTop: 16,
        marginBottom: 24,
        textAlign: 'center'
    },
    createEmptyButton: {
        backgroundColor: '#3b82f6',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12
    },
    createEmptyButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16
    }
});
