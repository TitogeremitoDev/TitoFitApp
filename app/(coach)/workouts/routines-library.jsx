/* app/(coach)/workouts/routines-library.jsx - Biblioteca de Rutinas del Coach */

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
    RefreshControl,
    TextInput,
    Modal,
    ScrollView,
    Platform
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import AssignRoutineModal from './assign-modal';
import AIImportModal from './AIImportModal';
import CoachHeader from '../components/CoachHeader';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';
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

export default function RoutinesLibraryScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const [routines, setRoutines] = useState([]);
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [assignModalVisible, setAssignModalVisible] = useState(false);
    const [selectedRoutine, setSelectedRoutine] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [folderModalVisible, setFolderModalVisible] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [moveFolderModalVisible, setMoveFolderModalVisible] = useState(false);
    const [routineToMove, setRoutineToMove] = useState(null);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [routineToDelete, setRoutineToDelete] = useState(null);

    // AI Import Modal state
    const [aiModalVisible, setAiModalVisible] = useState(false);

    // Client management states
    const [expandedRoutines, setExpandedRoutines] = useState({});
    const [allClients, setAllClients] = useState([]);

    // Summary expansion states
    const [expandedSummaries, setExpandedSummaries] = useState({});
    const [expandedMuscleSummaries, setExpandedMuscleSummaries] = useState({});

    const API_URL = process.env.EXPO_PUBLIC_API_URL;

    const fetchRoutines = async () => {
        try {
            const response = await fetch(`${API_URL}/api/routines`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setRoutines(data.routines);
                const uniqueFolders = [...new Set(data.routines.map(r => r.folder).filter(Boolean))];
                setFolders(uniqueFolders);
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

    const fetchAllClients = async () => {
        try {
            const response = await fetch(`${API_URL}/api/trainers/clients`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setAllClients(data.clients || []);
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchRoutines();
            fetchAllClients();
        }, [])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchRoutines();
    }, []);

    const handleDelete = (id) => {
        setRoutineToDelete(id);
        setDeleteModalVisible(true);
    };

    const confirmDelete = async () => {
        if (!routineToDelete) return;

        try {
            const response = await fetch(`${API_URL}/api/routines/${routineToDelete}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                setRoutines(prev => prev.filter(r => r._id !== routineToDelete));
                setDeleteModalVisible(false);
                setRoutineToDelete(null);
                if (Platform.OS === 'web') {
                    alert('Rutina eliminada correctamente');
                } else {
                    Alert.alert('Éxito', 'Rutina eliminada correctamente');
                }
            } else {
                if (Platform.OS === 'web') {
                    alert('No se pudo eliminar la rutina');
                } else {
                    Alert.alert('Error', 'No se pudo eliminar la rutina');
                }
            }
        } catch (error) {
            console.error('Error deleting routine:', error);
            if (Platform.OS === 'web') {
                alert('Error de conexión');
            } else {
                Alert.alert('Error', 'Error de conexión');
            }
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
        setAiModalVisible(true);
    };

    const openAssignModal = (routine) => {
        setSelectedRoutine(routine);
        setAssignModalVisible(true);
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) {
            Alert.alert('Error', 'El nombre de la carpeta no puede estar vacío');
            return;
        }

        if (folders.includes(newFolderName.trim())) {
            Alert.alert('Error', 'Ya existe una carpeta con ese nombre');
            return;
        }

        setFolders(prev => [...prev, newFolderName.trim()]);
        setNewFolderName('');
        setFolderModalVisible(false);
        Alert.alert('Éxito', 'Carpeta creada correctamente');
    };

    const handleMoveToFolder = async (folder) => {
        if (!routineToMove) return;

        try {
            const response = await fetch(`${API_URL}/api/routines/${routineToMove._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...routineToMove,
                    folder: folder
                })
            });

            const data = await response.json();
            if (data.success) {
                setRoutines(prev => prev.map(r =>
                    r._id === routineToMove._id ? { ...r, folder } : r
                ));
                setMoveFolderModalVisible(false);
                setRoutineToMove(null);
                Alert.alert('Éxito', 'Rutina movida correctamente');
            } else {
                Alert.alert('Error', 'No se pudo mover la rutina');
            }
        } catch (error) {
            console.error('Error moving routine:', error);
            Alert.alert('Error', 'Error de conexión');
        }
    };

    const toggleRoutineExpansion = (routineId) => {
        setExpandedRoutines(prev => ({
            ...prev,
            [routineId]: !prev[routineId]
        }));
    };

    const getClientsForRoutine = (routineId) => {
        return allClients.filter(client =>
            client.rutinas && client.rutinas.some(r => r === routineId || r._id === routineId)
        );
    };

    const calculateRoutineSummary = (routine) => {
        const diasArr = routine.diasArr || [];
        let totalSeries = 0;
        const seriesPerDay = [];
        const seriesPerMuscle = {};

        diasArr.forEach((dayExercises, dayIdx) => {
            let dayTotal = 0;
            (dayExercises || []).forEach(exercise => {
                const numSeries = (exercise.series || []).length;
                dayTotal += numSeries;
                totalSeries += numSeries;

                const muscle = (exercise.musculo || 'SIN GRUPO').toUpperCase();
                seriesPerMuscle[muscle] = (seriesPerMuscle[muscle] || 0) + numSeries;
            });
            seriesPerDay.push({ day: dayIdx + 1, series: dayTotal });
        });

        const muscleList = Object.entries(seriesPerMuscle)
            .map(([muscle, series]) => ({ muscle, series }))
            .sort((a, b) => b.series - a.series);

        return { totalSeries, seriesPerDay, muscleList };
    };

    const toggleSummaryExpansion = (routineId) => {
        setExpandedSummaries(prev => ({
            ...prev,
            [routineId]: !prev[routineId]
        }));
    };

    const toggleMuscleSummaryExpansion = (routineId) => {
        setExpandedMuscleSummaries(prev => ({
            ...prev,
            [routineId]: !prev[routineId]
        }));
    };

    const handleRemoveRoutineFromClient = async (routineId, clientId, clientName) => {
        const doRemove = async () => {
            try {
                const clientResponse = await fetch(`${API_URL}/api/users/${clientId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const clientData = await clientResponse.json();

                if (clientData.success) {
                    const updatedRutinas = (clientData.user.rutinas || []).filter(
                        r => (r._id || r) !== routineId
                    );

                    const updateResponse = await fetch(`${API_URL}/api/users/${clientId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ rutinas: updatedRutinas })
                    });

                    if (updateResponse.ok) {
                        if (Platform.OS === 'web') {
                            alert('Rutina eliminada del cliente');
                        } else {
                            Alert.alert('Éxito', 'Rutina eliminada del cliente');
                        }
                        fetchAllClients();
                    } else {
                        if (Platform.OS === 'web') {
                            alert('No se pudo eliminar la rutina');
                        } else {
                            Alert.alert('Error', 'No se pudo eliminar la rutina');
                        }
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
            if (window.confirm(`¿Eliminar esta rutina de ${clientName}?`)) {
                doRemove();
            }
        } else {
            Alert.alert(
                'Eliminar Rutina',
                `¿Eliminar esta rutina de ${clientName}?`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: doRemove }
                ]
            );
        }
    };

    const openMoveModal = (routine) => {
        setRoutineToMove(routine);
        setMoveFolderModalVisible(true);
    };

    const filteredRoutines = routines.filter(routine => {
        const matchesSearch = routine.nombre.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFolder = selectedFolder === null || routine.folder === selectedFolder;
        return matchesSearch && matchesFolder;
    });

    const renderRoutineItem = ({ item }) => {
        const clientsWithRoutine = getClientsForRoutine(item._id);
        const isExpanded = expandedRoutines[item._id];
        const summary = calculateRoutineSummary(item);
        const isSummaryExpanded = expandedSummaries[item._id];
        const isMuscleExpanded = expandedMuscleSummaries[item._id];

        return (
            <View style={styles.card}>
                <TouchableOpacity
                    style={styles.cardContent}
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
                    <View style={styles.cardLeft}>
                        <Text style={styles.routineName}>{item.nombre}</Text>
                        <Text style={styles.routineInfo}>
                            {item.dias} Días • {item.enfoque || 'General'}
                        </Text>
                        {item.folder && (
                            <View style={styles.folderTag}>
                                <Ionicons name="folder" size={12} color="#64748b" />
                                <Text style={styles.folderText}>{item.folder}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.cardActions}>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={(e) => {
                                e.stopPropagation();
                                openMoveModal(item);
                            }}
                        >
                            <Ionicons name="folder-outline" size={18} color="#64748b" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleDuplicate(item._id);
                            }}
                        >
                            <Ionicons name="duplicate-outline" size={18} color="#8b5cf6" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={(e) => {
                                e.stopPropagation();
                                openAssignModal(item);
                            }}
                        >
                            <Ionicons name="person-add-outline" size={18} color="#10b981" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleDelete(item._id);
                            }}
                        >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>

                {/* Routine Summary */}
                {summary.totalSeries > 0 && (
                    <View style={styles.summarySection}>
                        <TouchableOpacity
                            style={styles.summaryHeader}
                            onPress={() => toggleSummaryExpansion(item._id)}
                        >
                            <View style={styles.summaryHeaderLeft}>
                                <Ionicons name="stats-chart" size={16} color="#8b5cf6" />
                                <Text style={styles.summaryTitle}>
                                    Resumen • {summary.totalSeries} Series
                                </Text>
                            </View>
                            <Ionicons
                                name={isSummaryExpanded ? "chevron-up" : "chevron-down"}
                                size={20}
                                color="#64748b"
                            />
                        </TouchableOpacity>

                        {isSummaryExpanded && (
                            <View style={styles.summaryContent}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.daySeriesScroll}
                                    contentContainerStyle={styles.daySeriesContainer}
                                >
                                    {summary.seriesPerDay.map((dayData) => (
                                        <View key={dayData.day} style={styles.daySeriesChip}>
                                            <Text style={styles.daySeriesLabel}>D{dayData.day}</Text>
                                            <Text style={styles.daySeriesValue}>{dayData.series}S</Text>
                                        </View>
                                    ))}
                                </ScrollView>

                                <TouchableOpacity
                                    style={styles.muscleDropdownHeader}
                                    onPress={() => toggleMuscleSummaryExpansion(item._id)}
                                >
                                    <View style={styles.muscleDropdownLeft}>
                                        <Ionicons name="body" size={14} color="#64748b" />
                                        <Text style={styles.muscleDropdownTitle}>Series por músculo</Text>
                                    </View>
                                    <Ionicons
                                        name={isMuscleExpanded ? "chevron-up" : "chevron-down"}
                                        size={16}
                                        color="#64748b"
                                    />
                                </TouchableOpacity>

                                {isMuscleExpanded && (
                                    <View style={styles.muscleList}>
                                        {summary.muscleList.map((muscleData, idx) => (
                                            <View key={idx} style={styles.muscleItem}>
                                                <Text style={styles.muscleName}>{muscleData.muscle}</Text>
                                                <Text style={styles.muscleSeries}>{muscleData.series}S</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}

                {/* Clients Section */}
                {clientsWithRoutine.length > 0 && (
                    <View style={styles.clientsSection}>
                        <TouchableOpacity
                            style={styles.clientsHeader}
                            onPress={() => toggleRoutineExpansion(item._id)}
                        >
                            <View style={styles.clientsHeaderLeft}>
                                <Ionicons name="people" size={16} color="#10b981" />
                                <Text style={styles.clientsCount}>
                                    {clientsWithRoutine.length} {clientsWithRoutine.length === 1 ? 'cliente' : 'clientes'}
                                </Text>
                            </View>
                            <Ionicons
                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                size={20}
                                color="#64748b"
                            />
                        </TouchableOpacity>

                        {isExpanded && (
                            <View style={styles.clientsList}>
                                {clientsWithRoutine.map((client) => (
                                    <View key={client._id} style={styles.clientItem}>
                                        <View style={styles.clientItemLeft}>
                                            <View style={{ marginRight: 8 }}>
                                                <AvatarWithInitials
                                                    avatarUrl={client.avatarUrl}
                                                    name={client.nombre}
                                                    size={30}
                                                />
                                            </View>
                                            <View style={styles.clientItemInfo}>
                                                <Text style={styles.clientItemName}>{client.nombre}</Text>
                                                <Text style={styles.clientItemEmail}>{client.email}</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.removeClientBtn}
                                            onPress={() => handleRemoveRoutineFromClient(item._id, client._id, client.nombre)}
                                        >
                                            <Ionicons name="close-circle" size={22} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}
            </View>
        )
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <CoachHeader
                title="Mis Rutinas"
                subtitle="Biblioteca de entrenamientos"
                icon="fitness"
                iconColor="#f59e0b"
                badge={`${filteredRoutines.length}`}
                badgeColor="#fef3c7"
                badgeTextColor="#d97706"
                showBack
                rightContent={
                    <View style={styles.headerButtons}>
                        <TouchableOpacity onPress={() => setFolderModalVisible(true)} style={styles.iconButton}>
                            <Ionicons name="folder-outline" size={20} color="#334155" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleImportIA} style={[styles.iconButton, { backgroundColor: '#8b5cf620', flexDirection: 'row', gap: 4 }]}>
                            <Ionicons name="sparkles" size={18} color="#8b5cf6" />
                            <Text style={{ color: '#8b5cf6', fontWeight: '600', fontSize: 13 }}>IA</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => router.push('/(coach)/workouts/create')}
                            style={styles.createButton}
                        >
                            <Ionicons name="add" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                }
            />

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar rutinas..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Folder Filter */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.folderScroll}
                contentContainerStyle={styles.folderScrollContent}
            >
                <TouchableOpacity
                    style={[styles.folderChip, selectedFolder === null && styles.folderChipActive]}
                    onPress={() => setSelectedFolder(null)}
                >
                    <Text style={[styles.folderChipText, selectedFolder === null && styles.folderChipTextActive]}>
                        Todas
                    </Text>
                </TouchableOpacity>
                {folders.map((folder, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.folderChip, selectedFolder === folder && styles.folderChipActive]}
                        onPress={() => setSelectedFolder(folder)}
                    >
                        <Ionicons name="folder" size={14} color={selectedFolder === folder ? '#3b82f6' : '#64748b'} />
                        <Text style={[styles.folderChipText, selectedFolder === folder && styles.folderChipTextActive]}>
                            {folder}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Routines List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            ) : (
                <FlatList
                    data={filteredRoutines}
                    renderItem={renderRoutineItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="barbell-outline" size={64} color="#cbd5e1" />
                            <Text style={styles.emptyText}>
                                {searchQuery ? 'No se encontraron rutinas' : 'No has creado ninguna rutina aún'}
                            </Text>
                            {!searchQuery && (
                                <TouchableOpacity
                                    style={styles.createEmptyButton}
                                    onPress={() => router.push('/(coach)/workouts/create')}
                                >
                                    <Text style={styles.createEmptyButtonText}>Crear mi primera rutina</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}

            {/* Create Folder Modal */}
            <Modal
                visible={folderModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setFolderModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Nueva Carpeta</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Nombre de la carpeta"
                            placeholderTextColor="#94a3b8"
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonCancel]}
                                onPress={() => {
                                    setFolderModalVisible(false);
                                    setNewFolderName('');
                                }}
                            >
                                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonConfirm]}
                                onPress={handleCreateFolder}
                            >
                                <Text style={styles.modalButtonText}>Crear</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Move to Folder Modal */}
            <Modal
                visible={moveFolderModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMoveFolderModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Mover a Carpeta</Text>
                        <ScrollView style={styles.folderList}>
                            <TouchableOpacity
                                style={styles.folderItem}
                                onPress={() => handleMoveToFolder(null)}
                            >
                                <Ionicons name="folder-outline" size={20} color="#64748b" />
                                <Text style={styles.folderItemText}>Sin carpeta</Text>
                            </TouchableOpacity>
                            {folders.map((folder, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.folderItem}
                                    onPress={() => handleMoveToFolder(folder)}
                                >
                                    <Ionicons name="folder" size={20} color="#3b82f6" />
                                    <Text style={styles.folderItemText}>{folder}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.modalButtonCancel, { marginTop: 16 }]}
                            onPress={() => {
                                setMoveFolderModalVisible(false);
                                setRoutineToMove(null);
                            }}
                        >
                            <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                visible={deleteModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDeleteModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Confirmar eliminación</Text>
                        <Text style={styles.modalDescription}>
                            ¿Estás seguro de que quieres eliminar esta rutina? Esta acción no se puede deshacer.
                        </Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonCancel]}
                                onPress={() => {
                                    setDeleteModalVisible(false);
                                    setRoutineToDelete(null);
                                }}
                            >
                                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonDelete]}
                                onPress={confirmDelete}
                            >
                                <Text style={styles.modalButtonText}>Eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <AssignRoutineModal
                visible={assignModalVisible}
                onClose={() => setAssignModalVisible(false)}
                routine={selectedRoutine}
            />

            <AIImportModal
                visible={aiModalVisible}
                onClose={() => setAiModalVisible(false)}
                onRoutineSaved={fetchRoutines}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    iconButton: {
        padding: 6,
        backgroundColor: '#f1f5f9',
        borderRadius: 6,
    },
    createButton: {
        backgroundColor: '#3b82f6',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#1e293b',
    },
    folderScroll: {
        marginTop: 12,
        maxHeight: 44,
    },
    folderScrollContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    folderChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        gap: 6,
    },
    folderChipActive: { backgroundColor: '#dbeafe' },
    folderChipText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    folderChipTextActive: { color: '#3b82f6' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 16 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
    },
    cardLeft: { flex: 1 },
    routineName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 2 },
    routineInfo: { fontSize: 13, color: '#64748b' },
    folderTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    folderText: { fontSize: 12, color: '#64748b' },
    cardActions: { flexDirection: 'row', gap: 8 },
    actionBtn: {
        padding: 6,
        borderRadius: 6,
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
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 12,
    },
    modalDescription: {
        fontSize: 15,
        lineHeight: 22,
        color: '#64748b',
        marginBottom: 20,
        textAlign: 'center',
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: '#1e293b',
        marginBottom: 20,
    },
    modalButtons: { flexDirection: 'row', gap: 12 },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalButtonCancel: { backgroundColor: '#f1f5f9' },
    modalButtonConfirm: { backgroundColor: '#3b82f6' },
    modalButtonDelete: { backgroundColor: '#ef4444' },
    modalButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    modalButtonTextCancel: { color: '#64748b', fontWeight: '600', fontSize: 15 },
    folderList: { maxHeight: 300 },
    folderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#f8fafc',
    },
    folderItemText: { fontSize: 15, color: '#1e293b', fontWeight: '500' },
    clientsSection: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 8,
    },
    clientsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    clientsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    clientsCount: { fontSize: 14, fontWeight: '600', color: '#10b981' },
    clientsList: { paddingHorizontal: 12, paddingBottom: 8 },
    clientItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        marginBottom: 6,
    },
    clientItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    clientItemInfo: { flex: 1 },
    clientItemName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    clientItemEmail: { fontSize: 12, color: '#64748b' },
    removeClientBtn: { padding: 4 },
    summarySection: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 4,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    summaryHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    summaryTitle: { fontSize: 14, fontWeight: '600', color: '#8b5cf6' },
    summaryContent: { paddingHorizontal: 12, paddingBottom: 8 },
    daySeriesScroll: { marginBottom: 8 },
    daySeriesContainer: { flexDirection: 'row', gap: 8 },
    daySeriesChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#f0e7fe',
        borderRadius: 16,
    },
    daySeriesLabel: { fontSize: 12, fontWeight: '700', color: '#7c3aed' },
    daySeriesValue: { fontSize: 12, fontWeight: '500', color: '#8b5cf6' },
    muscleDropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
    },
    muscleDropdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    muscleDropdownTitle: { fontSize: 13, fontWeight: '500', color: '#64748b' },
    muscleList: {
        marginTop: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 8,
    },
    muscleItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    muscleName: { fontSize: 12, fontWeight: '500', color: '#475569', flex: 1 },
    muscleSeries: { fontSize: 12, fontWeight: '700', color: '#7c3aed' },
});
