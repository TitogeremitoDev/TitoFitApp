import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Modal,
    Alert,
    ActivityIndicator,
    FlatList,
    Dimensions,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../../context/AuthContext';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_API_URL;

type Exercise = {
    _id: string;
    name: string;
    muscle: string;
    instructions?: string[];
    tecnicaCorrecta?: string[]; // Mantener por compatibilidad si es necesario
    videoId?: string;
};

export default function ExercisesAdmin() {
    const { token } = useAuth();
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
    const [muscles, setMuscles] = useState<string[]>([]);
    const [selectedMuscle, setSelectedMuscle] = useState<string>('Todos');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

    // Form states
    const [formName, setFormName] = useState('');
    const [formMuscle, setFormMuscle] = useState('');
    const [formTips, setFormTips] = useState('');
    const [formVideoId, setFormVideoId] = useState('');
    const [saving, setSaving] = useState(false);

    // Fetch all exercises
    const fetchExercises = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/exercises`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setExercises(data.exercises);
                setFilteredExercises(data.exercises);
            }
        } catch (error) {
            console.error('Error fetching exercises:', error);
            Alert.alert('Error', 'No se pudieron cargar los ejercicios');
        } finally {
            setLoading(false);
        }
    }, [token]);

    // Fetch muscles list
    const fetchMuscles = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/api/exercises/muscles`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setMuscles(['Todos', ...data.muscles]);
            }
        } catch (error) {
            console.error('Error fetching muscles:', error);
        }
    }, [token]);

    useEffect(() => {
        fetchExercises();
        fetchMuscles();
    }, [fetchExercises, fetchMuscles]);

    // Filter exercises
    useEffect(() => {
        let filtered = exercises;

        // Filter by muscle
        if (selectedMuscle !== 'Todos') {
            filtered = filtered.filter(ex => ex.muscle === selectedMuscle);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(ex =>
                ex.name.toLowerCase().includes(query)
            );
        }

        setFilteredExercises(filtered);
    }, [exercises, selectedMuscle, searchQuery]);

    // Open modal for creating new exercise
    const handleAddNew = () => {
        setEditingExercise(null);
        setFormName('');
        setFormMuscle('');
        setFormTips('');
        setFormVideoId('');
        setModalVisible(true);
    };

    // Open modal for editing exercise
    const handleEdit = (exercise: Exercise) => {
        console.log('📝 Editing exercise:', exercise.name);
        console.log('🔧 Instructions data:', exercise.instructions);
        console.log('🎬 Video data:', exercise.videoId);

        setEditingExercise(exercise);
        setFormName(exercise.name);
        setFormMuscle(exercise.muscle);

        // Convert array to newline-separated string
        // Usar instructions preferentemente, fallback a tecnicaCorrecta
        const tipsArray = exercise.instructions || exercise.tecnicaCorrecta || [];
        const tipsText = tipsArray.join('\n');

        console.log('📄 Tips text to set:', tipsText);
        setFormTips(tipsText);

        setFormVideoId(exercise.videoId || '');
        setModalVisible(true);
    };

    // Save exercise (create or update)
    const handleSave = async () => {
        if (!formName.trim() || !formMuscle.trim()) {
            Alert.alert('Error', 'El nombre y el músculo son obligatorios');
            return;
        }

        const exerciseData = {
            name: formName.trim(),
            muscle: formMuscle.trim(),
            instructions: formTips.trim() ? formTips.split('\n').filter(t => t.trim()) : [],
            // Mantener tecnicaCorrecta sincronizado por si acaso
            tecnicaCorrecta: formTips.trim() ? formTips.split('\n').filter(t => t.trim()) : [],
            videoId: formVideoId.trim() || undefined,
        };

        try {
            setSaving(true);
            const url = editingExercise
                ? `${API_URL}/api/exercises/${editingExercise._id}`
                : `${API_URL}/api/exercises`;

            const method = editingExercise ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(exerciseData),
            });

            const data = await response.json();

            if (data.success) {
                Alert.alert(
                    'Éxito',
                    editingExercise ? 'Ejercicio actualizado' : 'Ejercicio creado'
                );
                setModalVisible(false);
                fetchExercises();
                if (!editingExercise) {
                    fetchMuscles(); // Refresh muscles if new muscle added
                }
            } else {
                Alert.alert('Error', data.message || 'No se pudo guardar el ejercicio');
            }
        } catch (error) {
            console.error('Error saving exercise:', error);
            Alert.alert('Error', 'No se pudo guardar el ejercicio');
        } finally {
            setSaving(false);
        }
    };

    // Delete exercise
    const handleDelete = (exercise: Exercise) => {
        Alert.alert(
            'Confirmar',
            `¿Eliminar "${exercise.name}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await fetch(
                                `${API_URL}/api/exercises/${exercise._id}`,
                                {
                                    method: 'DELETE',
                                    headers: { Authorization: `Bearer ${token}` },
                                }
                            );

                            const data = await response.json();

                            if (data.success) {
                                Alert.alert('Éxito', 'Ejercicio eliminado');
                                fetchExercises();
                            } else {
                                Alert.alert('Error', data.message || 'No se pudo eliminar');
                            }
                        } catch (error) {
                            console.error('Error deleting exercise:', error);
                            Alert.alert('Error', 'No se pudo eliminar el ejercicio');
                        }
                    },
                },
            ]
        );
    };

    const renderExerciseCard = ({ item }: { item: Exercise }) => (
        <View style={styles.exerciseCard}>
            <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{item.name}</Text>
                <Text style={styles.exerciseMuscle}>{item.muscle}</Text>

                {item.instructions && item.instructions.length > 0 ? (
                    <View style={styles.techniqueContainer}>
                        <View style={styles.techniqueHeader}>
                            <Ionicons name="checkmark-circle" size={14} color="#10B981" style={styles.techniqueIcon} />
                            <Text style={styles.techniqueTitle}>Técnica:</Text>
                        </View>
                        {item.instructions.slice(0, 2).map((tip, idx) => (
                            <Text key={idx} style={styles.techniqueTip}>{`- ${tip}`}</Text>
                        ))}
                        {item.instructions.length > 2 ? (
                            <Text style={styles.techniqueMore}>
                                {`+${item.instructions.length - 2} más`}
                            </Text>
                        ) : null}
                    </View>
                ) : null}

                {item.videoId ? (
                    <View style={styles.videoContainer}>
                        <Ionicons name="videocam" size={14} color="#3B82F6" style={styles.videoIcon} />
                        <Text style={styles.videoText}>{`Video: ${item.videoId}`}</Text>
                    </View>
                ) : null}
            </View>
            <View style={styles.exerciseActions}>
                <TouchableOpacity
                    onPress={() => handleEdit(item)}
                    style={[styles.actionBtn, styles.editBtn]}
                >
                    <Ionicons name="pencil" size={18} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={[styles.actionBtn, styles.deleteBtn]}
                >
                    <Ionicons name="trash" size={18} color="#EF4444" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.header}
            >
                <Text style={styles.headerTitle}>BD Ejercicios</Text>
                <Text style={styles.headerSubtitle}>
                    {filteredExercises.length} ejercicio{filteredExercises.length !== 1 ? 's' : ''}
                </Text>
            </LinearGradient>

            {/* Filters */}
            <View style={styles.filtersContainer}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#9CA3AF" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar por nombre..."
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.muscleFilters}
                    contentContainerStyle={styles.muscleFiltersContent}
                >
                    {muscles.map((muscle) => (
                        <TouchableOpacity
                            key={muscle}
                            onPress={() => setSelectedMuscle(muscle)}
                            style={[
                                styles.muscleChip,
                                selectedMuscle === muscle && styles.muscleChipActive
                            ]}
                        >
                            <Text
                                style={[
                                    styles.muscleChipText,
                                    selectedMuscle === muscle && styles.muscleChipTextActive
                                ]}
                            >
                                {muscle}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Exercise List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#667eea" />
                </View>
            ) : (
                <FlatList
                    data={filteredExercises}
                    renderItem={renderExerciseCard}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="barbell-outline" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>No hay ejercicios</Text>
                        </View>
                    }
                />
            )}

            {/* Add Button */}
            <TouchableOpacity
                onPress={handleAddNew}
                style={styles.fab}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.fabGradient}
                >
                    <Ionicons name="add" size={28} color="#FFF" />
                </LinearGradient>
            </TouchableOpacity>

            {/* Modal for Add/Edit */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingExercise ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={28} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.label}>Nombre *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: Press Banca"
                                placeholderTextColor="#6B7280"
                                value={formName}
                                onChangeText={setFormName}
                            />

                            <Text style={styles.label}>Músculo *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: Pecho"
                                placeholderTextColor="#6B7280"
                                value={formMuscle}
                                onChangeText={setFormMuscle}
                            />

                            <Text style={styles.label}>Técnica Correcta (1 por línea)</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder={"Ej: Mantén la espalda recta\nControla el descenso"}
                                placeholderTextColor="#6B7280"
                                value={formTips}
                                onChangeText={setFormTips}
                                multiline
                                numberOfLines={4}
                            />

                            <Text style={styles.label}>Video ID (YouTube)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: dQw4w9WgXcQ"
                                placeholderTextColor="#6B7280"
                                value={formVideoId}
                                onChangeText={setFormVideoId}
                            />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                style={[styles.modalBtn, styles.cancelBtn]}
                            >
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSave}
                                style={[styles.modalBtn, styles.saveBtn]}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Guardar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 30,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 5,
    },
    headerSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
    },
    filtersContainer: {
        padding: 15,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1F2937',
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
        marginBottom: 15,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        color: '#E5E7EB',
        fontSize: 16,
    },
    muscleFilters: {
        flexGrow: 0,
    },
    muscleFiltersContent: {
        paddingRight: 8,
    },
    muscleChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1F2937',
        borderWidth: 1,
        borderColor: '#374151',
        marginRight: 8,
    },
    muscleChipActive: {
        backgroundColor: '#667eea',
        borderColor: '#667eea',
    },
    muscleChipText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
    },
    muscleChipTextActive: {
        color: '#FFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 15,
        paddingBottom: 100,
    },
    exerciseCard: {
        flexDirection: 'row',
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#374151',
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#E5E7EB',
        marginBottom: 4,
    },
    exerciseMuscle: {
        fontSize: 14,
        color: '#9CA3AF',
        marginBottom: 8,
    },
    techniqueContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#374151',
    },
    techniqueHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    techniqueTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#10B981',
    },
    techniqueIcon: {
        marginRight: 4,
    },
    techniqueTip: {
        fontSize: 11,
        color: '#D1D5DB',
        marginLeft: 18,
        marginBottom: 2,
        lineHeight: 16,
    },
    techniqueMore: {
        fontSize: 11,
        color: '#6B7280',
        marginLeft: 18,
        fontStyle: 'italic',
        marginTop: 2,
    },
    videoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#374151',
    },
    videoText: {
        fontSize: 12,
        color: '#3B82F6',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    videoIcon: {
        marginRight: 6,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    badgeText: {
        fontSize: 12,
        color: '#9CA3AF',
        marginLeft: 4,
    },
    exerciseActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    editBtn: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    deleteBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#9CA3AF',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    fabGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1F2937',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#E5E7EB',
    },
    modalBody: {
        padding: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#9CA3AF',
        marginBottom: 8,
        marginTop: 12,
    },
    input: {
        backgroundColor: '#111827',
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        color: '#E5E7EB',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#374151',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#374151',
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginLeft: 6,
    },
    cancelBtn: {
        backgroundColor: '#374151',
        marginLeft: 0,
    },
    cancelBtnText: {
        color: '#9CA3AF',
        fontSize: 16,
        fontWeight: '600',
    },
    saveBtn: {
        backgroundColor: '#667eea',
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
