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
} from 'react-native';
import { useStableWindowDimensions } from '../../../src/hooks/useStableBreakpoint';
import { Image } from 'expo-image';
import { EnhancedTextInput } from '../../../components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import MuscleSelector from '../../../components/MuscleSelector';
import ExerciseListCard from '../../../components/ExerciseListCard';

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

// ─────────────────────────────────────────────────────────────
// Section Header Component (for modal sections)
// ─────────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, rightContent }: { icon: string; title: string; rightContent?: React.ReactNode }) => (
    <View style={modalStyles.sectionHeader}>
        <View style={modalStyles.sectionHeaderLeft}>
            <View style={modalStyles.sectionIconContainer}>
                <Ionicons name={icon as any} size={16} color="#667eea" />
            </View>
            <Text style={modalStyles.sectionTitle}>{title}</Text>
        </View>
        {rightContent}
    </View>
);

export default function ExercisesCoach() {
    const { width, height } = useStableWindowDimensions();
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
    const [showManualImageUrl, setShowManualImageUrl] = useState(false);
    const [imageSearchOffset, setImageSearchOffset] = useState(0);
    const [hasMoreImages, setHasMoreImages] = useState(false);
    const imageSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch all exercises (filtered by trainerId to avoid duplicates)
    const fetchExercises = useCallback(async () => {
        try {
            setLoading(true);
            const url = user?._id
                ? `${API_URL}/api/exercises?trainerId=${user._id}`
                : `${API_URL}/api/exercises`;
            const response = await fetch(url, {
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
                setFormVideoId(data.videoId);
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

        if (youtubeDebounceRef.current) {
            clearTimeout(youtubeDebounceRef.current);
        }

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

        if (duplicateDebounceRef.current) {
            clearTimeout(duplicateDebounceRef.current);
        }

        if (isEditMode) return;

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
                const techniqueText = data.instructions.join('\n');
                setFormTips(techniqueText);

                const sourceMsg = data.cached
                    ? 'Técnica del ejercicio oficial'
                    : 'Generado con IA';
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

    // Search for exercise images (offset=0 replaces, offset>0 appends next page)
    const handleSearchImages = useCallback(async (name?: string, muscle?: string, nextPage = false) => {
        const searchName = name || formName;
        const searchMuscle = muscle || formMuscle;

        if (!searchName.trim()) return;

        const currentOffset = nextPage ? imageSearchOffset : 0;
        setSearchedImages([]);
        if (!nextPage) {
            setImageSearchOffset(0);
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
                    name: searchName.trim(),
                    muscle: searchMuscle.trim(),
                    offset: currentOffset
                })
            });
            const data = await response.json();

            if (data.success && data.images?.length > 0) {
                setSearchedImages(data.images);
                setImageSearchOffset(data.nextOffset || currentOffset + 6);
                setHasMoreImages(!!data.hasMore);
            } else {
                setHasMoreImages(false);
            }
        } catch (error) {
            console.error('Error searching images:', error);
        } finally {
            setSearchingImages(false);
        }
    }, [token, formName, formMuscle, imageSearchOffset]);

    // Auto-search images when name + muscle are filled (debounced)
    useEffect(() => {
        if (!modalVisible) return;
        if (!formName.trim() || formName.trim().length < 3 || !formMuscle.trim()) return;

        if (imageSearchDebounceRef.current) {
            clearTimeout(imageSearchDebounceRef.current);
        }

        imageSearchDebounceRef.current = setTimeout(() => {
            handleSearchImages(formName, formMuscle);
        }, 1200);

        return () => {
            if (imageSearchDebounceRef.current) {
                clearTimeout(imageSearchDebounceRef.current);
            }
        };
    }, [formName, formMuscle, modalVisible]);

    useEffect(() => {
        fetchExercises();
        fetchMuscles();
        fetchValidMuscles();
    }, [fetchExercises, fetchMuscles, fetchValidMuscles]);

    // Filter exercises
    useEffect(() => {
        let filtered = exercises;

        if (selectedMuscle !== 'Todos') {
            filtered = filtered.filter(ex => ex.muscle === selectedMuscle);
        }

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
        setShowManualImageUrl(false);
        setImageSearchOffset(0);
        setHasMoreImages(false);
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
        setShowManualImageUrl(!!exercise.imagen_ejercicio_ID);
        setImageSearchOffset(0);
        setHasMoreImages(false);
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
        setShowManualImageUrl(false);
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

    // ─────────────────────────────────────────────────────────────
    // Modal Content Sections (extracted for clarity)
    // ─────────────────────────────────────────────────────────────

    const renderBasicInfoSection = () => (
        <View style={modalStyles.section}>
            <SectionHeader icon="information-circle" title="Información Básica" />

            <Text style={modalStyles.label}>Nombre del ejercicio *</Text>
            <EnhancedTextInput
                style={modalStyles.inputText}
                containerStyle={modalStyles.inputContainer}
                placeholder="Ej: Press Banca Inclinado Mancuernas"
                placeholderTextColor="#6B7280"
                value={formName}
                onChangeText={handleNameChange}
            />
            {checkingDuplicates && (
                <View style={modalStyles.inlineStatus}>
                    <ActivityIndicator size="small" color="#667eea" />
                    <Text style={modalStyles.inlineStatusText}>Buscando similares...</Text>
                </View>
            )}

            <Text style={[modalStyles.label, { marginTop: 16 }]}>Grupo muscular *</Text>
            {validMuscles.length > 0 ? (
                <MuscleSelector
                    muscles={validMuscles}
                    selected={formMuscle}
                    onSelect={setFormMuscle}
                />
            ) : (
                <ActivityIndicator size="small" color="#667eea" />
            )}
        </View>
    );

    const renderTechniqueSection = () => (
        <View style={modalStyles.section}>
            <SectionHeader
                icon="fitness"
                title="Técnica Correcta"
                rightContent={
                    <TouchableOpacity
                        style={modalStyles.aiButton}
                        onPress={handleGenerateWithAI}
                        disabled={generatingAI || !formName.trim() || !formMuscle.trim()}
                    >
                        {generatingAI ? (
                            <ActivityIndicator size="small" color="#667eea" />
                        ) : (
                            <>
                                <Ionicons name="sparkles" size={14} color="#667eea" />
                                <Text style={modalStyles.aiButtonText}>Generar con IA</Text>
                            </>
                        )}
                    </TouchableOpacity>
                }
            />
            <EnhancedTextInput
                style={[modalStyles.inputText, { textAlignVertical: 'top' }]}
                containerStyle={[modalStyles.inputContainer, { minHeight: 100 }]}
                placeholder={"Escribe un consejo por línea:\nMantén la espalda recta\nControla el descenso"}
                placeholderTextColor="#6B7280"
                value={formTips}
                onChangeText={setFormTips}
                multiline
                numberOfLines={4}
            />
        </View>
    );

    const renderVideoSection = () => (
        <View style={modalStyles.section}>
            <SectionHeader icon="videocam" title="Video Demostrativo" />

            <EnhancedTextInput
                style={modalStyles.inputText}
                containerStyle={modalStyles.inputContainer}
                placeholder="Pega cualquier URL de YouTube o el ID"
                placeholderTextColor="#6B7280"
                value={formVideoId}
                onChangeText={handleVideoIdChange}
            />

            {validatingYoutube && (
                <View style={modalStyles.inlineStatus}>
                    <ActivityIndicator size="small" color="#667eea" />
                    <Text style={modalStyles.inlineStatusText}>Validando...</Text>
                </View>
            )}

            {youtubeError && (
                <View style={modalStyles.errorBanner}>
                    <Ionicons name="alert-circle" size={14} color="#ef4444" />
                    <Text style={modalStyles.errorBannerText}>{youtubeError}</Text>
                </View>
            )}

            {!!youtubeThumbnail && (
                <View style={modalStyles.videoPreview}>
                    <Image
                        source={{ uri: youtubeThumbnail }}
                        style={modalStyles.videoThumbnail}
                        contentFit="cover"
                    />
                    <View style={modalStyles.videoOverlayBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={modalStyles.videoOverlayText}>Video válido</Text>
                    </View>
                </View>
            )}
        </View>
    );

    const renderImageSection = () => (
        <View style={modalStyles.section}>
            <SectionHeader
                icon="image"
                title="Imagen del Ejercicio"
                rightContent={
                    <TouchableOpacity
                        style={modalStyles.aiButton}
                        onPress={() => handleSearchImages(undefined, undefined, false)}
                        disabled={searchingImages || !formName.trim()}
                    >
                        {searchingImages ? (
                            <ActivityIndicator size="small" color="#667eea" />
                        ) : (
                            <>
                                <Ionicons name="search" size={14} color="#667eea" />
                                <Text style={modalStyles.aiButtonText}>Buscar</Text>
                            </>
                        )}
                    </TouchableOpacity>
                }
            />

            {/* Auto-search hint */}
            {searchedImages.length === 0 && !searchingImages && formName.trim().length >= 3 && !!formMuscle.trim() && (
                <View style={modalStyles.imageHint}>
                    <Ionicons name="information-circle-outline" size={14} color="#6B7280" />
                    <Text style={modalStyles.imageHintText}>
                        Las imágenes se buscan automáticamente al completar nombre y músculo
                    </Text>
                </View>
            )}

            {/* Loading state */}
            {searchingImages && searchedImages.length === 0 && (
                <View style={modalStyles.imageLoadingContainer}>
                    <ActivityIndicator size="small" color="#667eea" />
                    <Text style={modalStyles.imageLoadingText}>Buscando imágenes recomendadas...</Text>
                </View>
            )}

            {/* Image Results Grid */}
            {searchedImages.length > 0 && (
                <View style={modalStyles.imageGridContainer}>
                    <View style={[
                        modalStyles.imageGrid,
                        isLargeScreen && { gap: 12 }
                    ]}>
                        {searchedImages.map((img) => {
                            const isSelected = formImageUrl === img.url;
                            return (
                                <TouchableOpacity
                                    key={img.id}
                                    style={[
                                        modalStyles.imageOption,
                                        isLargeScreen ? modalStyles.imageOptionLarge : modalStyles.imageOptionSmall,
                                        isSelected && modalStyles.imageOptionSelected,
                                        !isSelected && formImageUrl ? { opacity: 0.5 } : null,
                                    ]}
                                    onPress={() => setFormImageUrl(isSelected ? '' : img.url)}
                                    activeOpacity={0.8}
                                >
                                    <Image
                                        source={{ uri: img.thumb || img.url }}
                                        style={modalStyles.imageOptionImg}
                                        contentFit="cover"
                                    />
                                    {isSelected && (
                                        <View style={modalStyles.imageSelectedOverlay}>
                                            <View style={modalStyles.imageSelectedBadge}>
                                                <Ionicons name="checkmark" size={18} color="#fff" />
                                            </View>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Load more button */}
                    {hasMoreImages && (
                        <TouchableOpacity
                            style={modalStyles.loadMoreBtn}
                            onPress={() => handleSearchImages(undefined, undefined, true)}
                            disabled={searchingImages}
                        >
                            {searchingImages ? (
                                <ActivityIndicator size="small" color="#667eea" />
                            ) : (
                                <>
                                    <Ionicons name="refresh" size={14} color="#667eea" />
                                    <Text style={modalStyles.loadMoreText}>Más resultados</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Selected image preview */}
            {!!formImageUrl && !showManualImageUrl && (
                <View style={modalStyles.selectedImagePreview}>
                    <Image
                        source={{ uri: formImageUrl }}
                        style={modalStyles.selectedImagePreviewImg}
                        contentFit="contain"
                    />
                    <TouchableOpacity
                        style={modalStyles.removeImageBtn}
                        onPress={() => setFormImageUrl('')}
                    >
                        <Ionicons name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            )}

            {/* Manual URL toggle */}
            <TouchableOpacity
                style={modalStyles.manualUrlToggle}
                onPress={() => setShowManualImageUrl(!showManualImageUrl)}
            >
                <Ionicons
                    name={showManualImageUrl ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#6B7280"
                />
                <Text style={modalStyles.manualUrlToggleText}>
                    {showManualImageUrl ? 'Ocultar URL manual' : 'Pegar URL de imagen manualmente'}
                </Text>
            </TouchableOpacity>

            {showManualImageUrl && (
                <View style={{ marginTop: 8 }}>
                    <EnhancedTextInput
                        style={modalStyles.inputText}
                        containerStyle={modalStyles.inputContainer}
                        placeholder="https://ejemplo.com/imagen.jpg"
                        placeholderTextColor="#6B7280"
                        value={formImageUrl}
                        onChangeText={setFormImageUrl}
                    />
                    {!!formImageUrl && (
                        <View style={[modalStyles.selectedImagePreview, { marginTop: 8 }]}>
                            <Image
                                source={{ uri: formImageUrl }}
                                style={modalStyles.selectedImagePreviewImg}
                                contentFit="contain"
                            />
                        </View>
                    )}
                </View>
            )}
        </View>
    );

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
                    renderItem={({ item }) => (
                        <ExerciseListCard
                            item={item}
                            isLargeScreen={isLargeScreen}
                            adminTrainerId={ADMIN_TRAINER_ID}
                            onEdit={handleEditExercise}
                            onFork={handleForkExercise}
                        />
                    )}
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

            {/* ════════════════════════════════════════════════════════════
                Modal for Add/Edit/Fork — Responsive layout
               ════════════════════════════════════════════════════════════ */}
            <Modal
                visible={modalVisible}
                animationType={isLargeScreen ? 'fade' : 'slide'}
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={[
                    modalStyles.overlay,
                    isLargeScreen ? modalStyles.overlayLarge : modalStyles.overlaySmall,
                ]}>
                    <View style={[
                        modalStyles.content,
                        isLargeScreen ? modalStyles.contentLarge : modalStyles.contentSmall,
                        isLargeScreen ? { maxHeight: height * 0.9 } : { maxHeight: height * 0.92 },
                    ]}>
                        {/* Header */}
                        <View style={modalStyles.header}>
                            <View style={modalStyles.headerTitleRow}>
                                <View style={modalStyles.headerIcon}>
                                    <Ionicons
                                        name={isEditMode ? 'create' : editingExercise ? 'git-branch' : 'add-circle'}
                                        size={20}
                                        color="#667eea"
                                    />
                                </View>
                                <Text style={modalStyles.headerTitle}>
                                    {isEditMode ? 'Editar Ejercicio' : editingExercise ? 'Crear Mi Versión' : 'Nuevo Ejercicio'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                style={modalStyles.closeButton}
                            >
                                <Ionicons name="close" size={22} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        {/* Body — 2 columns on large, single scroll on mobile */}
                        <ScrollView
                            style={modalStyles.body}
                            contentContainerStyle={[
                                modalStyles.bodyContent,
                                isLargeScreen && modalStyles.bodyContentLarge,
                            ]}
                            showsVerticalScrollIndicator={true}
                        >
                            {isLargeScreen ? (
                                // ── Large Screen: 2 Columns ──
                                <View style={modalStyles.twoColumnLayout}>
                                    <View style={modalStyles.leftColumn}>
                                        {renderBasicInfoSection()}
                                        {renderTechniqueSection()}
                                    </View>
                                    <View style={modalStyles.rightColumn}>
                                        {renderVideoSection()}
                                        {renderImageSection()}
                                    </View>
                                </View>
                            ) : (
                                // ── Mobile: Single Column ──
                                <>
                                    {renderBasicInfoSection()}
                                    {renderTechniqueSection()}
                                    {renderVideoSection()}
                                    {renderImageSection()}
                                </>
                            )}
                        </ScrollView>

                        {/* Footer */}
                        <View style={modalStyles.footer}>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                style={modalStyles.cancelBtn}
                            >
                                <Text style={modalStyles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSave}
                                style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark" size={18} color="#fff" />
                                        <Text style={modalStyles.saveBtnText}>
                                            {isEditMode ? 'Actualizar' : 'Guardar'}
                                        </Text>
                                    </>
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
                            <Text style={styles.duplicateTitle}>Ejercicio similar encontrado</Text>
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

// ═══════════════════════════════════════════════════════════════════════════
// Modal Styles (separated for clarity)
// ═══════════════════════════════════════════════════════════════════════════
const modalStyles = StyleSheet.create({
    // ── Overlay ──
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    overlaySmall: {
        justifyContent: 'flex-end',
    },
    overlayLarge: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },

    // ── Content Container ──
    content: {
        backgroundColor: '#1F2937',
        overflow: 'hidden',
    },
    contentSmall: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    contentLarge: {
        borderRadius: 20,
        width: '100%',
        maxWidth: 880,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 16,
    },

    // ── Header ──
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#667eea15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#F3F4F6',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#374151',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Body ──
    body: {
        flex: 1,
    },
    bodyContent: {
        padding: 20,
        paddingBottom: 8,
    },
    bodyContentLarge: {
        padding: 24,
    },

    // ── Two Column Layout ──
    twoColumnLayout: {
        flexDirection: 'row',
        gap: 24,
    },
    leftColumn: {
        flex: 1,
        minWidth: 0,
    },
    rightColumn: {
        flex: 1,
        minWidth: 0,
    },

    // ── Section ──
    section: {
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2D3748',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionIconContainer: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#667eea15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#D1D5DB',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // ── Inputs ──
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#9CA3AF',
        marginBottom: 6,
    },
    inputContainer: {
        backgroundColor: '#111827',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderWidth: 1,
        borderColor: '#374151',
    },
    inputText: {
        color: '#E5E7EB',
        fontSize: 15,
    },

    // ── Inline Status ──
    inlineStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
    },
    inlineStatusText: {
        fontSize: 12,
        color: '#9CA3AF',
    },

    // ── Error Banner ──
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        backgroundColor: '#ef444415',
        padding: 8,
        borderRadius: 8,
    },
    errorBannerText: {
        fontSize: 12,
        color: '#ef4444',
        flex: 1,
    },

    // ── AI Button ──
    aiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#667eea15',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#667eea40',
    },
    aiButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#667eea',
    },

    // ── Video Preview ──
    videoPreview: {
        marginTop: 10,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#111827',
    },
    videoThumbnail: {
        width: '100%',
        height: 140,
    },
    videoOverlayBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 8,
    },
    videoOverlayText: {
        fontSize: 12,
        color: '#10B981',
        fontWeight: '500',
    },

    // ── Image Search ──
    imageHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: '#111827',
        borderRadius: 8,
        marginBottom: 8,
    },
    imageHintText: {
        fontSize: 11,
        color: '#6B7280',
        flex: 1,
    },
    imageLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 24,
        backgroundColor: '#111827',
        borderRadius: 10,
    },
    imageLoadingText: {
        fontSize: 13,
        color: '#9CA3AF',
    },

    // ── Image Grid ──
    imageGridContainer: {
        marginBottom: 12,
    },
    loadMoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        marginTop: 8,
        backgroundColor: '#1F2937',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
    },
    loadMoreText: {
        fontSize: 13,
        color: '#667eea',
        fontWeight: '600',
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    imageOption: {
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: '#374151',
        backgroundColor: '#111827',
    },
    imageOptionSmall: {
        width: '31%',
        aspectRatio: 4 / 3,
    },
    imageOptionLarge: {
        width: '31%',
        aspectRatio: 4 / 3,
    },
    imageOptionSelected: {
        borderColor: '#667eea',
        borderWidth: 3,
    },
    imageOptionImg: {
        width: '100%',
        height: '100%',
    },
    imageSelectedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(102, 126, 234, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageSelectedBadge: {
        backgroundColor: '#667eea',
        borderRadius: 16,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },

    // ── Selected Image Preview ──
    selectedImagePreview: {
        marginTop: 8,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#111827',
        position: 'relative',
    },
    selectedImagePreviewImg: {
        width: '100%',
        height: 160,
    },
    removeImageBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 2,
    },

    // ── Manual URL Toggle ──
    manualUrlToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        marginTop: 4,
    },
    manualUrlToggleText: {
        fontSize: 12,
        color: '#6B7280',
    },

    // ── Footer ──
    footer: {
        flexDirection: 'row',
        padding: 16,
        paddingHorizontal: 20,
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#374151',
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#374151',
    },
    cancelBtnText: {
        color: '#9CA3AF',
        fontSize: 15,
        fontWeight: '600',
    },
    saveBtn: {
        flex: 1.5,
        paddingVertical: 13,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#667eea',
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// Page Styles (list, filters, etc.)
// ═══════════════════════════════════════════════════════════════════════════
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
    // Duplicate Warning Modal
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
});
