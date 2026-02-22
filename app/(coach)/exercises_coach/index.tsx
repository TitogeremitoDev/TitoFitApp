import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Modal,
    Alert,
    ActivityIndicator,
    FlatList,
    Dimensions,
    Platform,
    SafeAreaView,
    Image,
    useWindowDimensions,
} from 'react-native';
import { EnhancedTextInput } from '../../../components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import MuscleSelector from '../../../components/MuscleSelector';
import ExerciseListCard from '../../../components/ExerciseListCard';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_API_URL;

// ID del admin para distinguir ejercicios oficiales
const ADMIN_TRAINER_ID = '690907725e4460bbbedbae7b';

type Exercise = {
    _id: string;
    name: string;
    muscle: string;
    instructions?: string[];
    tecnicaCorrecta?: string[];
    videoId?: string;
    id_trainer?: string;
    imagen_ejercicio_ID?: string;
};

export default function ExercisesCoach() {
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 720;
    const { token, user } = useAuth();
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
    const [muscles, setMuscles] = useState<string[]>([]);
    const [validMuscles, setValidMuscles] = useState<string[]>([]);
    const [selectedMuscle, setSelectedMuscle] = useState<string>('Todos');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    // Form states
    const [formName, setFormName] = useState('');
    const [formMuscle, setFormMuscle] = useState('');
    const [formTips, setFormTips] = useState('');
    const [formVideoId, setFormVideoId] = useState('');
    const [saving, setSaving] = useState(false);

    // Smart Exercise Creator states
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
    const [youtubeThumbnail, setYoutubeThumbnail] = useState<string | null>(null);
    const [youtubeError, setYoutubeError] = useState<string | null>(null);
    const [validatingYoutube, setValidatingYoutube] = useState(false);
    const [generatingAI, setGeneratingAI] = useState(false);
    const youtubeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Duplicate detection states
    const [duplicates, setDuplicates] = useState<Exercise[]>([]);
    const [duplicateWarningVisible, setDuplicateWarningVisible] = useState(false);
    const [checkingDuplicates, setCheckingDuplicates] = useState(false);
    const duplicateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Image search states
    const [formImageUrl, setFormImageUrl] = useState('');
    const [searchedImages, setSearchedImages] = useState<{ id: string, url: string, thumb: string }[]>([]);
    const [searchingImages, setSearchingImages] = useState(false);

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

    // Fetch muscles list (for filter chips)
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

    // Fetch valid muscles list (for MuscleSelector in modal)
    const fetchValidMuscles = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/api/exercises/valid-muscles`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setValidMuscles(data.muscles);
            }
        } catch (error) {
            console.error('Error fetching valid muscles:', error);
        }
    }, [token]);

    // Validate YouTube URL with debounce
    const validateYouTube = useCallback(async (url: string) => {
        if (!url || url.length < 5) {
            setYoutubeThumbnail(null);
            setYoutubeError(null);
            return;
        }

        setValidatingYoutube(true);
        try {
            const response = await fetch(`${API_URL}/api/exercises/validate-youtube`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ url })
            });
            const data = await response.json();

            if (data.success) {
                setFormVideoId(data.videoId); // Auto-clean to just ID
                setYoutubeThumbnail(data.thumbnail);
                setYoutubeError(null);
            } else {
                setYoutubeThumbnail(null);
                setYoutubeError(data.message);
            }
        } catch (error) {
            console.error('Error validating YouTube:', error);
        } finally {
            setValidatingYoutube(false);
        }
    }, [token]);

    // Handle video input with debounce
    const handleVideoIdChange = (text: string) => {
        setFormVideoId(text);
        setYoutubeError(null);

        // Clear previous timeout
        if (youtubeDebounceRef.current) {
            clearTimeout(youtubeDebounceRef.current);
        }

        // Debounce validation
        youtubeDebounceRef.current = setTimeout(() => {
            validateYouTube(text);
        }, 500);
    };

    // Check for duplicate exercises
    const checkDuplicates = useCallback(async (name: string) => {
        if (!name || name.length < 3) {
            setDuplicates([]);
            return;
        }

        setCheckingDuplicates(true);
        try {
            const response = await fetch(`${API_URL}/api/exercises/check-duplicates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name })
            });
            const data = await response.json();

            if (data.success && data.duplicates?.length > 0) {
                setDuplicates(data.duplicates);
                // Solo mostrar warning si hay match exacto o muy similar
                if (data.exactMatch) {
                    setDuplicateWarningVisible(true);
                }
            } else {
                setDuplicates([]);
            }
        } catch (error) {
            console.error('Error checking duplicates:', error);
        } finally {
            setCheckingDuplicates(false);
        }
    }, [token]);

    // Handle name input with duplicate check
    const handleNameChange = (text: string) => {
        setFormName(text);

        // Clear previous timeout
        if (duplicateDebounceRef.current) {
            clearTimeout(duplicateDebounceRef.current);
        }

        // No check duplicates if editing
        if (isEditMode) return;

        // Debounce duplicate check
        duplicateDebounceRef.current = setTimeout(() => {
            checkDuplicates(text);
        }, 600);
    };

    // Generate technique with AI
    const handleGenerateWithAI = async () => {
        if (!formName.trim() || !formMuscle.trim()) {
            Alert.alert('Error', 'Introduce primero el nombre y selecciona el músculo');
            return;
        }

        setGeneratingAI(true);
        try {
            const response = await fetch(`${API_URL}/api/exercises/generate-technique`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: formName.trim(),
                    muscle: formMuscle.trim()
                })
            });
            const data = await response.json();

            if (data.success && data.instructions?.length > 0) {
                // Format instructions as text lines
                const techniqueText = data.instructions.join('\n');
                setFormTips(techniqueText);

                // Show success feedback
                const sourceMsg = data.cached
                    ? '📚 Técnica del ejercicio oficial'
                    : '✨ Generado con IA';
                Alert.alert('Técnica generada', sourceMsg);
            } else {
                Alert.alert('Error', data.message || 'No se pudo generar la técnica');
            }
        } catch (error) {
            console.error('Error generating technique:', error);
            Alert.alert('Error', 'No se pudo conectar con el servicio de IA');
        } finally {
            setGeneratingAI(false);
        }
    };

    // Search for exercise images with AI
    const handleSearchImages = async () => {
        if (!formName.trim()) {
            Alert.alert('Error', 'Introduce primero el nombre del ejercicio');
            return;
        }

        setSearchingImages(true);
        try {
            const response = await fetch(`${API_URL}/api/exercises/search-images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: formName.trim(),
                    muscle: formMuscle.trim()
                })
            });
            const data = await response.json();

            if (data.success && data.images?.length > 0) {
                setSearchedImages(data.images);
            } else {
                Alert.alert('Sin resultados', 'No se encontraron imágenes. Prueba con otro nombre.');
            }
        } catch (error) {
            console.error('Error searching images:', error);
            Alert.alert('Error', 'No se pudieron buscar imágenes');
        } finally {
            setSearchingImages(false);
        }
    };

    useEffect(() => {
        fetchExercises();
        fetchMuscles();
        fetchValidMuscles();
    }, [fetchExercises, fetchMuscles, fetchValidMuscles]);


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
        setIsEditMode(false);
        setEditingExercise(null);
        setFormName('');
        setFormMuscle('');
        setFormTips('');
        setFormVideoId('');
        setYoutubeThumbnail(null);
        setYoutubeError(null);
        setDuplicates([]);
        setDuplicateWarningVisible(false);
        setFormImageUrl('');
        setSearchedImages([]);
        setModalVisible(true);
    };

    // Open modal for editing own exercise
    const handleEditExercise = useCallback((exercise: Exercise) => {
        setIsEditMode(true);
        setEditingExercise(exercise);
        setFormName(exercise.name);
        setFormMuscle(exercise.muscle);
        setFormTips(exercise.instructions?.join('\n') || '');
        setFormVideoId(exercise.videoId || '');
        if (exercise.videoId) {
            setYoutubeThumbnail(`https://img.youtube.com/vi/${exercise.videoId}/hqdefault.jpg`);
        } else {
            setYoutubeThumbnail(null);
        }
        setYoutubeError(null);
        setFormImageUrl(exercise.imagen_ejercicio_ID || '');
        setSearchedImages([]);
        setModalVisible(true);
    }, []);

    // Open modal for forking official exercise
    const handleForkExercise = useCallback((exercise: Exercise) => {
        setIsEditMode(false);
        setEditingExercise(exercise);
        setFormName(exercise.name);
        setFormMuscle(exercise.muscle);
        setFormTips(exercise.instructions?.join('\n') || '');
        setFormVideoId('');
        setYoutubeThumbnail(null);
        setYoutubeError(null);
        setFormImageUrl(exercise.imagen_ejercicio_ID || '');
        setSearchedImages([]);
        setModalVisible(true);
    }, []);

    // Save exercise using upsert endpoint
    const handleSave = async () => {
        if (!formName.trim() || !formMuscle.trim()) {
            Alert.alert('Error', 'El nombre y el músculo son obligatorios');
            return;
        }

        const exerciseData = {
            name: formName.trim(),
            muscle: formMuscle.trim().toUpperCase(),
            instructions: formTips.trim() ? formTips.split('\n').filter(t => t.trim()) : [],
            videoId: formVideoId.trim() || '',
            imagen_ejercicio_ID: formImageUrl.trim() || '',
            trainerId: user?._id,
        };

        try {
            setSaving(true);

            const response = await fetch(`${API_URL}/api/exercises/upsert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(exerciseData),
            });

            const data = await response.json();

            if (data.success) {
                const actionMsg = data.action === 'updated'
                    ? 'Ejercicio actualizado'
                    : data.action === 'customized'
                        ? 'Versión personalizada creada'
                        : 'Ejercicio creado';
                Alert.alert('Éxito', actionMsg);
                setModalVisible(false);
                fetchExercises();
                fetchMuscles();
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



    const renderItem = useCallback(({ item }: { item: Exercise }) => (
        <ExerciseListCard
            item={item}
            isLargeScreen={isLargeScreen}
            adminTrainerId={ADMIN_TRAINER_ID}
            onEdit={handleEditExercise}
            onFork={handleForkExercise}
        />
    ), [isLargeScreen, handleEditExercise, handleForkExercise]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <CoachHeader
                title="Base de Datos"
                subtitle="Biblioteca de ejercicios"
                icon="library"
                iconColor="#667eea"
                badge={`${filteredExercises.length}`}
                badgeColor="#ede9fe"
                badgeTextColor="#7c3aed"
                rightContent={
                    <TouchableOpacity
                        onPress={handleAddNew}
                        style={styles.addButton}
                    >
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                }
            />

            {/* Filters */}
            <View style={styles.filtersContainer}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#9CA3AF" />
                    <EnhancedTextInput
                        style={styles.searchInputText}
                        containerStyle={styles.searchInputContainer}
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
                    renderItem={renderItem}
                    keyExtractor={(item) => item._id}
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="barbell-outline" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>No hay ejercicios</Text>
                        </View>
                    }
                />
            )}



            {/* Modal for Add/Edit/Fork */}
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
                                {isEditMode ? 'Editar Ejercicio' : editingExercise ? 'Crear Mi Versión' : 'Nuevo Ejercicio'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={28} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.label}>Nombre *</Text>
                            <EnhancedTextInput
                                style={styles.inputText}
                                containerStyle={styles.inputContainer}
                                placeholder="Ej: Press Banca"
                                placeholderTextColor="#6B7280"
                                value={formName}
                                onChangeText={handleNameChange}
                            />
                            {checkingDuplicates && (
                                <View style={styles.duplicateChecking}>
                                    <ActivityIndicator size="small" color="#667eea" />
                                    <Text style={styles.duplicateCheckingText}>Buscando similares...</Text>
                                </View>
                            )}

                            <Text style={styles.label}>Músculo *</Text>
                            {validMuscles.length > 0 ? (
                                <MuscleSelector
                                    muscles={validMuscles}
                                    selected={formMuscle}
                                    onSelect={setFormMuscle}
                                />
                            ) : (
                                <ActivityIndicator size="small" color="#667eea" />
                            )}

                            <View style={styles.techniqueHeaderModal}>
                                <Text style={styles.label}>Técnica Correcta (1 por línea)</Text>
                                <TouchableOpacity
                                    style={styles.aiButton}
                                    onPress={handleGenerateWithAI}
                                    disabled={generatingAI || !formName.trim() || !formMuscle.trim()}
                                >
                                    {generatingAI ? (
                                        <ActivityIndicator size="small" color="#667eea" />
                                    ) : (
                                        <>
                                            <Ionicons name="sparkles" size={14} color="#667eea" />
                                            <Text style={styles.aiButtonText}>Generar con IA</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                            <EnhancedTextInput
                                style={[styles.inputText, styles.textAreaText]}
                                containerStyle={[styles.inputContainer, styles.textAreaContainer]}
                                placeholder={"Ej: Mantén la espalda recta\nControla el descenso"}
                                placeholderTextColor="#6B7280"
                                value={formTips}
                                onChangeText={setFormTips}
                                multiline
                                numberOfLines={4}
                            />

                            <Text style={styles.label}>Video de YouTube</Text>
                            <View style={[styles.videoInputRow, { flexDirection: isLargeScreen ? 'row' : 'column' }]}>
                                <View style={styles.videoInputCol}>
                                    <EnhancedTextInput
                                        style={styles.inputText}
                                        containerStyle={styles.inputContainer}
                                        placeholder="Pega cualquier URL de YouTube o el ID"
                                        placeholderTextColor="#6B7280"
                                        value={formVideoId}
                                        onChangeText={handleVideoIdChange}
                                    />

                                    {/* YouTube Validation Feedback */}
                                    {validatingYoutube && (
                                        <View style={styles.youtubeLoading}>
                                            <ActivityIndicator size="small" color="#667eea" />
                                            <Text style={styles.youtubeLoadingText}>Validando...</Text>
                                        </View>
                                    )}

                                    {youtubeError && (
                                        <View style={styles.youtubeError}>
                                            <Ionicons name="alert-circle" size={14} color="#ef4444" />
                                            <Text style={styles.youtubeErrorText}>{youtubeError}</Text>
                                        </View>
                                    )}
                                </View>

                                {youtubeThumbnail && (
                                    <View style={styles.videoPreviewCol}>
                                        <Image
                                            source={{ uri: youtubeThumbnail }}
                                            style={styles.youtubeThumbnail}
                                            resizeMode="contain"
                                        />
                                        <View style={styles.youtubeSuccess}>
                                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                            <Text style={styles.youtubeSuccessText}>Video válido</Text>
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Image Search Section */}
                            <View style={styles.imageSection}>
                                <View style={styles.imageSectionHeader}>
                                    <Text style={styles.label}>Imagen del Ejercicio</Text>
                                    <TouchableOpacity
                                        style={styles.searchImagesBtn}
                                        onPress={handleSearchImages}
                                        disabled={searchingImages || !formName.trim()}
                                    >
                                        {searchingImages ? (
                                            <ActivityIndicator size="small" color="#667eea" />
                                        ) : (
                                            <>
                                                <Ionicons name="images" size={14} color="#667eea" />
                                                <Text style={styles.searchImagesBtnText}>Buscar imágenes</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {/* Image Results Grid */}
                                {searchedImages.length > 0 && (
                                    <View style={styles.imageGrid}>
                                        {searchedImages.map((img, idx) => (
                                            <TouchableOpacity
                                                key={img.id}
                                                style={[
                                                    styles.imageOption,
                                                    formImageUrl === img.url && styles.imageOptionSelected
                                                ]}
                                                onPress={() => setFormImageUrl(img.url)}
                                            >
                                                <Image
                                                    source={{ uri: img.thumb }}
                                                    style={styles.imageOptionImg}
                                                    resizeMode="cover"
                                                />
                                                {formImageUrl === img.url && (
                                                    <View style={styles.imageSelectedBadge}>
                                                        <Ionicons name="checkmark" size={14} color="#fff" />
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                {/* URL Input + Preview Row (responsive) */}
                                <View style={[styles.imageInputRow, { flexDirection: isLargeScreen ? 'row' : 'column', alignItems: isLargeScreen ? 'flex-start' : 'stretch' }]}>
                                    <View style={styles.imageInputCol}>
                                        <EnhancedTextInput
                                            style={styles.inputText}
                                            containerStyle={styles.inputContainer}
                                            placeholder="O pega una URL de imagen directamente"
                                            placeholderTextColor="#6B7280"
                                            value={formImageUrl}
                                            onChangeText={setFormImageUrl}
                                        />
                                    </View>
                                    {formImageUrl && (
                                        <View style={styles.imagePreviewCol}>
                                            <Image
                                                source={{ uri: formImageUrl }}
                                                style={styles.imagePreview}
                                                resizeMode="contain"
                                            />
                                        </View>
                                    )}
                                </View>
                            </View>
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

            {/* Duplicate Warning Modal */}
            <Modal
                visible={duplicateWarningVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setDuplicateWarningVisible(false)}
            >
                <View style={styles.duplicateOverlay}>
                    <View style={styles.duplicateModal}>
                        <View style={styles.duplicateHeader}>
                            <Ionicons name="alert-circle" size={32} color="#f59e0b" />
                            <Text style={styles.duplicateTitle}>¡Ejercicio similar encontrado!</Text>
                        </View>

                        <Text style={styles.duplicateText}>
                            Ya existe un ejercicio oficial con este nombre. Puedes usar el oficial o crear tu propia versión personalizada.
                        </Text>

                        {duplicates.length > 0 && (
                            <View style={styles.duplicateExercise}>
                                <Text style={styles.duplicateExerciseName}>{duplicates[0].name}</Text>
                                <Text style={styles.duplicateExerciseMuscle}>{duplicates[0].muscle}</Text>
                            </View>
                        )}

                        <View style={styles.duplicateButtons}>
                            <TouchableOpacity
                                style={styles.duplicateUseBtn}
                                onPress={() => {
                                    if (duplicates[0]) {
                                        handleForkExercise(duplicates[0]);
                                    }
                                    setDuplicateWarningVisible(false);
                                }}
                            >
                                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                                <Text style={styles.duplicateUseBtnText}>Usar oficial</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.duplicateContinueBtn}
                                onPress={() => setDuplicateWarningVisible(false)}
                            >
                                <Ionicons name="create" size={18} color="#667eea" />
                                <Text style={styles.duplicateContinueBtnText}>Seguir editando</Text>
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
        backgroundColor: '#f8fafc',
    },
    addButton: {
        backgroundColor: '#667eea',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
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
    searchInputContainer: {
        flex: 1,
        marginLeft: 10,
    },
    searchInputText: {
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
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    exerciseContentRow: {
        flex: 1,
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    exerciseMuscle: {
        fontSize: 14,
        color: '#64748b',
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748b',
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
        maxHeight: Dimensions.get('window').height * 0.9,
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
    inputContainer: {
        backgroundColor: '#111827',
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#374151',
    },
    inputText: {
        color: '#E5E7EB',
        fontSize: 16,
    },
    textAreaContainer: {
        height: 100,
    },
    textAreaText: {
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
    // New styles for Smart Exercise Creator
    exerciseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    customBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#667eea15',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#667eea40',
    },
    customBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#667eea',
    },
    cardActions: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 12,
    },
    actionBtn: {
        padding: 8,
    },
    forkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#667eea15',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#667eea40',
    },
    forkBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#667eea',
    },
    youtubeLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    youtubeLoadingText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    youtubeError: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        backgroundColor: '#ef444415',
        padding: 8,
        borderRadius: 8,
    },
    youtubeErrorText: {
        fontSize: 12,
        color: '#ef4444',
        flex: 1,
    },
    youtubeThumbnailContainer: {
        marginTop: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    youtubeThumbnail: {
        width: '100%',
        height: 120,
        borderRadius: 8,
    },
    youtubeSuccess: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    youtubeSuccessText: {
        fontSize: 12,
        color: '#10B981',
        fontWeight: '500',
    },
    // AI Button styles
    techniqueHeaderModal: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        marginBottom: 8,
    },
    aiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#667eea15',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#667eea40',
    },
    aiButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#667eea',
    },
    // Duplicate detection styles
    duplicateChecking: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
    },
    duplicateCheckingText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    duplicateOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    duplicateModal: {
        backgroundColor: '#1F2937',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    duplicateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    duplicateTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#E5E7EB',
        flex: 1,
    },
    duplicateText: {
        fontSize: 14,
        color: '#9CA3AF',
        lineHeight: 20,
        marginBottom: 16,
    },
    duplicateExercise: {
        backgroundColor: '#374151',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    duplicateExerciseName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#E5E7EB',
        marginBottom: 4,
    },
    duplicateExerciseMuscle: {
        fontSize: 13,
        color: '#9CA3AF',
        textTransform: 'uppercase',
    },
    duplicateButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    duplicateUseBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#10B98120',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#10B98150',
    },
    duplicateUseBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
    },
    duplicateContinueBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#667eea20',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#667eea50',
    },
    duplicateContinueBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#667eea',
    },
    // Image search styles
    imageSection: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#374151',
    },
    imageSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    searchImagesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#667eea15',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#667eea40',
    },
    searchImagesBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#667eea',
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 12,
    },
    imageOption: {
        width: '31%',
        height: 100,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: 'transparent',
    },
    imageOptionSelected: {
        borderColor: '#667eea',
    },
    imageOptionImg: {
        width: '100%',
        height: '100%',
    },
    imageSelectedBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: '#667eea',
        borderRadius: 10,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Responsive image input row
    imageInputRow: {
        gap: 12,
        marginTop: 12,
    },
    imageInputCol: {
        flex: 1,
        minWidth: 200,
        width: '100%',
    },
    imagePreviewCol: {
        flex: 1,
        maxWidth: 400,
        width: '100%',
    },
    imagePreview: {
        width: '100%',
        height: 180,
        maxHeight: 200,
        borderRadius: 10,
        backgroundColor: '#374151',
    },
    // Responsive Video Section
    videoInputRow: {
        gap: 12,
        marginTop: 12,
        alignItems: 'flex-start',
    },
    videoInputCol: {
        flex: 1,
        minWidth: 200,
        width: '100%',
    },
    videoPreviewCol: {
        flex: 1,
        maxWidth: 400,
        width: '100%',
    },
});
