/**
 * FoodCreatorModal.tsx
 * Modal profesional para dar de alta un alimento/ingrediente nuevo.
 * 
 * Features:
 * - Unified Image Uploader (Tabs: Upload, URL, IA)
 * - 2-Zone Layout (Identity + Nutrition)
 * - Horizontal Macro Inputs
 * - Professional Blue styling
 * - ✨ AI Autocomplete Magic (Gemini 2.0 Flash)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions,
    Animated,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { FoodItem, saveFood } from '../src/services/foodService';

// ─────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────
interface FoodCreatorModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (foodData: Partial<FoodItem>) => void;
    initialData?: FoodItem | null;
}

type ImageTab = 'upload' | 'url' | 'ai';

const TAG_OPTIONS = [
    'Proteína', 'Carbo', 'Vegetal', 'Fruta', 'Lácteo', 'Grasa',
    'Desayuno', 'Almuerzo', 'Cena', 'Snack',
    'Vegano', 'Sin Gluten', 'Integral'
];

const API_BASE_URL = 'https://consistent-donna-titogeremito-29c943bc.koyeb.app/api';

// ─────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────
export default function FoodCreatorModal({ visible, onClose, onSave, initialData }: FoodCreatorModalProps) {
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 600;

    // Form State
    const [name, setName] = useState('');
    const [brand, setBrand] = useState('');
    const [image, setImage] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    // Nutrients (per 100g)
    const [kcal, setKcal] = useState('');
    const [protein, setProtein] = useState('');
    const [carbs, setCarbs] = useState('');
    const [fat, setFat] = useState('');

    // Serving Size (Smart Portions)
    const [servingUnit, setServingUnit] = useState('g');
    const [servingWeight, setServingWeight] = useState('100');

    // Image Tab
    const [imageTab, setImageTab] = useState<ImageTab>('upload');
    const [showTagPicker, setShowTagPicker] = useState(false);

    // AI Magic State
    const [aiLoading, setAiLoading] = useState(false);
    const [aiEstimated, setAiEstimated] = useState(false);
    const [aiConfidence, setAiConfidence] = useState<number | null>(null);

    // AI Image Generation State
    const [imageAiLoading, setImageAiLoading] = useState(false);
    const [imageAiIndex, setImageAiIndex] = useState(0);
    const [imageAiRemaining, setImageAiRemaining] = useState(3);

    // Animation refs
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    // Init with data if editing
    useEffect(() => {
        if (visible) {
            if (initialData) {
                setName(initialData.name || '');
                setBrand(initialData.brand || '');
                setImage(initialData.image || '');
                setSelectedTags(initialData.tags || []);
                setKcal(String(initialData.nutrients?.kcal || ''));
                setProtein(String(initialData.nutrients?.protein || ''));
                setCarbs(String(initialData.nutrients?.carbs || ''));
                setFat(String(initialData.nutrients?.fat || ''));
                setServingUnit(initialData.servingSize?.unit || 'g');
                setServingWeight(String(initialData.servingSize?.weight || 100));
                setAiEstimated(false);
                setAiConfidence(null);
            } else {
                resetForm();
            }
        }
    }, [visible, initialData]);

    // Shimmer animation
    useEffect(() => {
        if (aiLoading) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(shimmerAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                    Animated.timing(shimmerAnim, { toValue: 0, duration: 800, useNativeDriver: true })
                ])
            ).start();
        } else {
            shimmerAnim.setValue(0);
        }
    }, [aiLoading]);

    const resetForm = () => {
        setName('');
        setBrand('');
        setImage('');
        setImageUrl('');
        setSelectedTags([]);
        setKcal('');
        setProtein('');
        setCarbs('');
        setFat('');
        setServingUnit('g');
        setServingWeight('100');
        setImageTab('upload');
        setAiEstimated(false);
        setAiConfidence(null);
        setImageAiRemaining(3);
        setImageAiIndex(0);
    };

    // ─────────────────────────────────────────────────────────
    // 🖼️ AI IMAGE GENERATION
    // ─────────────────────────────────────────────────────────
    const handleAiGenerateImage = async () => {
        if (!name.trim() || name.trim().length < 2) {
            Alert.alert('Error', 'Escribe el nombre del alimento primero');
            return;
        }

        if (imageAiRemaining <= 0) {
            Alert.alert('Límite alcanzado', 'Has usado tus 3 intentos de IA para este alimento. Espera 24h para intentar de nuevo.');
            return;
        }

        // Calculate next index to cycle through images
        const nextIndex = (imageAiIndex || 0) + 1;
        setImageAiIndex(nextIndex); // Update for next time
        setImageAiLoading(true);

        try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const token = await AsyncStorage.getItem('totalgains_token');

            if (!token) {
                Alert.alert('Error', 'Sesión no válida');
                return;
            }

            // Send index to backend to get different images
            const response = await fetch(`${API_BASE_URL}/foods/ai-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    foodName: name.trim(),
                    index: nextIndex - 1 // Send 0-based index
                })
            });

            const data = await response.json();

            if (response.status === 429) {
                Alert.alert('Límite alcanzado', data.message || 'Demasiados intentos');
                setImageAiRemaining(0);
                return;
            }

            if (!response.ok) {
                throw new Error(data.error || 'Error generando imagen');
            }

            if (data.success && (data.image?.dataUrl || data.image?.url)) {
                const imageUrl = data.image.dataUrl || data.image.url;
                setImage(imageUrl);
                setImageAiRemaining(data.remaining ?? 0);

                // Show toast or subtle alert instead of full alert for better flow
                // Alert.alert('✨ Imagen encontrada', `Te quedan ${data.remaining ?? 0} intentos para este alimento.`);
            } else {
                throw new Error('No se encontró imagen');
            }
        } catch (error: any) {
            console.error('AI Image Gen error:', error);
            Alert.alert('Error', error.message || 'No se pudo generar la imagen');
        } finally {
            setImageAiLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────
    // HANDLERS
    // ─────────────────────────────────────────────────────────
    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setImage(result.assets[0].uri);
        }
    };

    const handleUrlSubmit = () => {
        if (imageUrl.trim()) {
            setImage(imageUrl.trim());
        }
    };

    const handleTagToggle = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    // ─────────────────────────────────────────────────────────
    // ✨ AI MAGIC AUTOCOMPLETE
    // ─────────────────────────────────────────────────────────
    const handleAiEstimate = async () => {
        if (!name.trim() || name.trim().length < 2) {
            Alert.alert('Error', 'Escribe el nombre del alimento primero (mínimo 2 caracteres)');
            return;
        }

        setAiLoading(true);
        setAiEstimated(false);

        try {
            // Get auth token from storage
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const token = await AsyncStorage.getItem('totalgains_token');

            if (!token) {
                Alert.alert('Error', 'Sesión no válida. Por favor, vuelve a iniciar sesión.');
                return;
            }

            const response = await fetch(`${API_BASE_URL}/foods/ai-estimate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ foodName: name.trim() })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error en la estimación');
            }

            if (data.success && data.estimation) {
                const { estimation } = data;

                // Animate fill with slight delay
                setTimeout(() => {
                    if (estimation.name) setName(estimation.name);
                    if (estimation.brand) setBrand(estimation.brand);
                    if (estimation.image) setImage(estimation.image);
                    setKcal(String(Math.round(estimation.nutrients?.kcal || 0)));
                    setProtein(String(Math.round((estimation.nutrients?.protein || 0) * 10) / 10));
                    setCarbs(String(Math.round((estimation.nutrients?.carbs || 0) * 10) / 10));
                    setFat(String(Math.round((estimation.nutrients?.fat || 0) * 10) / 10));

                    // Auto-select tags
                    if (estimation.tags && Array.isArray(estimation.tags)) {
                        const validTags = estimation.tags.filter((t: string) => TAG_OPTIONS.includes(t));
                        setSelectedTags(validTags);
                    }

                    setAiConfidence(estimation.confidence || 0.9);
                    setAiEstimated(true);
                }, 200);
            }
        } catch (error: any) {
            console.error('AI Estimate error:', error);
            Alert.alert('Error', error.message || 'No se pudo estimar los nutrientes');
        } finally {
            setAiLoading(false);
        }
    };

    const handleSave = () => {
        // Validation
        if (!name.trim()) {
            Alert.alert('Error', 'El nombre del alimento es obligatorio');
            return;
        }
        if (!kcal || !protein || !carbs || !fat) {
            Alert.alert('Error', 'Completa todos los valores nutricionales');
            return;
        }

        const foodData: Partial<FoodItem> = {
            name: name.trim(),
            brand: brand.trim() || undefined,
            image: image || undefined,
            tags: selectedTags.length > 0 ? selectedTags : undefined,
            nutrients: {
                kcal: parseFloat(kcal) || 0,
                protein: parseFloat(protein) || 0,
                carbs: parseFloat(carbs) || 0,
                fat: parseFloat(fat) || 0,
            },
            servingSize: {
                unit: servingUnit || 'g',
                weight: parseFloat(servingWeight) || 100
            },
            layer: 'CLOUD',
            isSystem: false,
        };

        onSave(foodData);
        onClose();
    };

    // ─────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────
    const shimmerOpacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7]
    });

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.centeredView}
                >
                    <View style={[styles.modalCard, isLargeScreen && { maxWidth: 750, minWidth: 650 }]}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerTitle}>
                                <Ionicons name="restaurant-outline" size={20} color="#2563eb" />
                                <Text style={styles.title}>
                                    {initialData ? 'Editar Alimento' : 'Nuevo Alimento'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.content}
                            contentContainerStyle={styles.contentContainer}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* ═══════════════════════════════════════════════════════
                                ZONA SUPERIOR: IDENTIDAD
                            ═══════════════════════════════════════════════════════ */}
                            <View style={[styles.identityZone, !isLargeScreen && styles.identityZoneMobile]}>
                                {/* Image Preview + Tabs */}
                                <View style={[styles.imageSection, !isLargeScreen && styles.imageSectionMobile]}>
                                    {/* Mobile: Row with image + vertical tabs */}
                                    {!isLargeScreen ? (
                                        <>
                                            <View style={styles.mobileImageRow}>
                                                <View style={[styles.imagePreview, styles.imagePreviewMobile]}>
                                                    {image ? (
                                                        <Image source={{ uri: image }} style={styles.previewImg} />
                                                    ) : (
                                                        <View style={styles.placeholderImg}>
                                                            <Ionicons name="image-outline" size={32} color="#cbd5e1" />
                                                            <Text style={styles.placeholderText}>Vista Previa</Text>
                                                        </View>
                                                    )}
                                                </View>

                                                {/* Vertical Tabs on Right */}
                                                <View style={styles.mobileTabsColumn}>
                                                    <TouchableOpacity
                                                        style={[styles.mobileTabBtn, imageTab === 'upload' && styles.mobileTabBtnActive]}
                                                        onPress={() => setImageTab('upload')}
                                                    >
                                                        <Ionicons name="folder-outline" size={20} color={imageTab === 'upload' ? '#2563eb' : '#94a3b8'} />
                                                        <Text style={[styles.mobileTabLabel, imageTab === 'upload' && styles.mobileTabLabelActive]}>Subir</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.mobileTabBtn, imageTab === 'url' && styles.mobileTabBtnActive]}
                                                        onPress={() => setImageTab('url')}
                                                    >
                                                        <Ionicons name="link-outline" size={20} color={imageTab === 'url' ? '#2563eb' : '#94a3b8'} />
                                                        <Text style={[styles.mobileTabLabel, imageTab === 'url' && styles.mobileTabLabelActive]}>URL</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.mobileTabBtn, imageTab === 'ai' && styles.mobileTabBtnActiveAi]}
                                                        onPress={() => setImageTab('ai')}
                                                    >
                                                        <Ionicons name="sparkles" size={20} color={imageTab === 'ai' ? '#8b5cf6' : '#94a3b8'} />
                                                        <Text style={[styles.mobileTabLabel, imageTab === 'ai' && styles.mobileTabLabelActiveAi]}>IA</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* Tab Content Below - Full Width */}
                                            <View style={styles.mobileTabContent}>
                                                {imageTab === 'upload' && (
                                                    <TouchableOpacity style={styles.mobileUploadBtn} onPress={handlePickImage}>
                                                        <Ionicons name="cloud-upload-outline" size={18} color="#2563eb" />
                                                        <Text style={styles.mobileUploadBtnText}>Seleccionar de galería</Text>
                                                    </TouchableOpacity>
                                                )}
                                                {imageTab === 'url' && (
                                                    <TextInput
                                                        style={styles.mobileUrlInput}
                                                        placeholder="Pega la URL de la imagen..."
                                                        placeholderTextColor="#94a3b8"
                                                        value={imageUrl}
                                                        onChangeText={setImageUrl}
                                                        onBlur={handleUrlSubmit}
                                                        autoCapitalize="none"
                                                        autoCorrect={false}
                                                    />
                                                )}
                                                {imageTab === 'ai' && (
                                                    <View style={styles.mobileAiSection}>
                                                        <TouchableOpacity
                                                            style={[styles.mobileAiBtn, imageAiLoading && styles.mobileAiBtnLoading]}
                                                            onPress={handleAiGenerateImage}
                                                            disabled={imageAiLoading || imageAiRemaining <= 0}
                                                        >
                                                            {imageAiLoading ? (
                                                                <ActivityIndicator size="small" color="#8b5cf6" />
                                                            ) : (
                                                                <>
                                                                    <Ionicons name="sparkles" size={18} color={imageAiRemaining > 0 ? "#8b5cf6" : "#cbd5e1"} />
                                                                    <Text style={[styles.mobileAiBtnText, imageAiRemaining <= 0 && { color: '#cbd5e1' }]}>
                                                                        Generar imagen con IA
                                                                    </Text>
                                                                </>
                                                            )}
                                                        </TouchableOpacity>
                                                        <Text style={styles.mobileAiRemaining}>
                                                            {imageAiRemaining > 0
                                                                ? `${imageAiRemaining} intentos restantes`
                                                                : 'Sin intentos (espera 24h)'}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </>
                                    ) : (
                                        /* Desktop: Original Layout */
                                        <>
                                            <View style={styles.imagePreview}>
                                                {image ? (
                                                    <Image source={{ uri: image }} style={styles.previewImg} />
                                                ) : (
                                                    <View style={styles.placeholderImg}>
                                                        <Ionicons name="image-outline" size={32} color="#cbd5e1" />
                                                        <Text style={styles.placeholderText}>Vista Previa</Text>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Image Tabs */}
                                            <View style={styles.imageTabs}>
                                                <TouchableOpacity
                                                    style={[styles.imageTabBtn, imageTab === 'upload' && styles.imageTabActive]}
                                                    onPress={() => setImageTab('upload')}
                                                >
                                                    <Ionicons name="folder-outline" size={16} color={imageTab === 'upload' ? '#2563eb' : '#94a3b8'} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.imageTabBtn, imageTab === 'url' && styles.imageTabActive]}
                                                    onPress={() => setImageTab('url')}
                                                >
                                                    <Ionicons name="link-outline" size={16} color={imageTab === 'url' ? '#2563eb' : '#94a3b8'} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.imageTabBtn, imageTab === 'ai' && styles.imageTabActive]}
                                                    onPress={() => setImageTab('ai')}
                                                >
                                                    <Ionicons name="sparkles" size={16} color={imageTab === 'ai' ? '#8b5cf6' : '#94a3b8'} />
                                                </TouchableOpacity>
                                            </View>

                                            {/* Tab Content */}
                                            {imageTab === 'upload' && (
                                                <TouchableOpacity style={styles.uploadBtn} onPress={handlePickImage}>
                                                    <Text style={styles.uploadBtnText}>Seleccionar archivo</Text>
                                                </TouchableOpacity>
                                            )}
                                            {imageTab === 'url' && (
                                                <View style={styles.urlInputRow}>
                                                    <TextInput
                                                        style={styles.urlInput}
                                                        placeholder="https://..."
                                                        value={imageUrl}
                                                        onChangeText={setImageUrl}
                                                        onBlur={handleUrlSubmit}
                                                        autoCapitalize="none"
                                                        autoCorrect={false}
                                                    />
                                                </View>
                                            )}
                                            {imageTab === 'ai' && (
                                                <View style={styles.aiImageSection}>
                                                    <TouchableOpacity
                                                        style={[styles.aiImageBtn, imageAiLoading && styles.aiImageBtnLoading]}
                                                        onPress={handleAiGenerateImage}
                                                        disabled={imageAiLoading || imageAiRemaining <= 0}
                                                    >
                                                        {imageAiLoading ? (
                                                            <ActivityIndicator size="small" color="#8b5cf6" />
                                                        ) : (
                                                            <>
                                                                <Ionicons name="sparkles" size={14} color={imageAiRemaining > 0 ? "#8b5cf6" : "#cbd5e1"} />
                                                                <Text style={[styles.aiImageBtnText, imageAiRemaining <= 0 && { color: '#cbd5e1' }]}>
                                                                    Generar con IA
                                                                </Text>
                                                            </>
                                                        )}
                                                    </TouchableOpacity>
                                                    <Text style={styles.aiImageRemaining}>
                                                        {imageAiRemaining > 0
                                                            ? `${imageAiRemaining} intentos restantes`
                                                            : 'Sin intentos (espera 24h)'}
                                                    </Text>
                                                </View>
                                            )}
                                        </>
                                    )}
                                </View>

                                {/* Form Fields */}
                                <View style={styles.formFields}>
                                    <Text style={styles.fieldLabel}>Nombre del Alimento</Text>
                                    <View style={styles.nameInputRow}>
                                        <TextInput
                                            style={[styles.textInput, styles.nameInput]}
                                            placeholder="Ej: Pechuga de Pollo"
                                            placeholderTextColor="#94a3b8"
                                            value={name}
                                            onChangeText={(text) => {
                                                setName(text);
                                                setAiEstimated(false); // Reset AI state when typing
                                            }}
                                        />
                                        <TouchableOpacity
                                            style={[styles.magicBtn, aiLoading && styles.magicBtnLoading]}
                                            onPress={handleAiEstimate}
                                            disabled={aiLoading || name.trim().length < 2}
                                        >
                                            {aiLoading ? (
                                                <ActivityIndicator size="small" color="#8b5cf6" />
                                            ) : (
                                                <Ionicons name="sparkles" size={18} color={name.trim().length >= 2 ? "#8b5cf6" : "#cbd5e1"} />
                                            )}
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.fieldLabel}>Marca <Text style={styles.optional}>(Opcional)</Text></Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Ej: Mercadona, Hacendado..."
                                        placeholderTextColor="#94a3b8"
                                        value={brand}
                                        onChangeText={setBrand}
                                    />

                                    <Text style={styles.fieldLabel}>Categoría / Tags</Text>
                                    <TouchableOpacity
                                        style={styles.tagSelector}
                                        onPress={() => setShowTagPicker(!showTagPicker)}
                                    >
                                        <Text style={selectedTags.length > 0 ? styles.tagSelectorText : styles.tagSelectorPlaceholder}>
                                            {selectedTags.length > 0 ? selectedTags.join(', ') : 'Selecciona etiquetas...'}
                                        </Text>
                                        <Ionicons name="chevron-down" size={16} color="#94a3b8" />
                                    </TouchableOpacity>

                                    {showTagPicker && (
                                        <View style={styles.tagPickerContainer}>
                                            {TAG_OPTIONS.map(tag => (
                                                <TouchableOpacity
                                                    key={tag}
                                                    style={[
                                                        styles.tagChip,
                                                        selectedTags.includes(tag) && styles.tagChipActive
                                                    ]}
                                                    onPress={() => handleTagToggle(tag)}
                                                >
                                                    <Text style={[
                                                        styles.tagChipText,
                                                        selectedTags.includes(tag) && styles.tagChipTextActive
                                                    ]}>
                                                        {tag}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* ═══════════════════════════════════════════════════════
                                ZONA INFERIOR: INFORMACIÓN NUTRICIONAL
                            ═══════════════════════════════════════════════════════ */}
                            <View style={styles.nutritionZone}>
                                <View style={styles.nutritionHeader}>
                                    <View style={styles.nutritionTitleRow}>
                                        <Text style={styles.nutritionTitle}>INFORMACIÓN NUTRICIONAL</Text>
                                        {aiEstimated && (
                                            <View style={styles.aiEstimatedBadge}>
                                                <Ionicons name="sparkles" size={10} color="#8b5cf6" />
                                                <Text style={styles.aiEstimatedText}>
                                                    Estimado por IA ({Math.round((aiConfidence || 0) * 100)}%)
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.per100gBadge}>
                                        <Text style={styles.per100gText}>por 100g</Text>
                                    </View>
                                </View>

                                <View style={[styles.macrosGrid, !isLargeScreen && styles.macrosGridMobile]}>
                                    {/* Kcal */}
                                    <View style={[styles.macroCard, aiLoading && styles.macroCardLoading]}>
                                        {aiLoading ? (
                                            <Animated.View style={[styles.shimmer, { opacity: shimmerOpacity }]} />
                                        ) : (
                                            <>
                                                <Text style={styles.macroIcon}>🔥</Text>
                                                <Text style={styles.macroLabel}>Kcal</Text>
                                                <TextInput
                                                    style={[styles.macroInput, aiEstimated && styles.macroInputAi]}
                                                    placeholder="0"
                                                    placeholderTextColor="#cbd5e1"
                                                    value={kcal}
                                                    onChangeText={setKcal}
                                                    keyboardType="numeric"
                                                />
                                            </>
                                        )}
                                    </View>

                                    {/* Protein */}
                                    <View style={[styles.macroCard, aiLoading && styles.macroCardLoading]}>
                                        {aiLoading ? (
                                            <Animated.View style={[styles.shimmer, { opacity: shimmerOpacity }]} />
                                        ) : (
                                            <>
                                                <Text style={styles.macroIcon}>🥩</Text>
                                                <Text style={styles.macroLabel}>Proteína (g)</Text>
                                                <TextInput
                                                    style={[styles.macroInput, aiEstimated && styles.macroInputAi]}
                                                    placeholder="0"
                                                    placeholderTextColor="#cbd5e1"
                                                    value={protein}
                                                    onChangeText={setProtein}
                                                    keyboardType="numeric"
                                                />
                                            </>
                                        )}
                                    </View>

                                    {/* Carbs */}
                                    <View style={[styles.macroCard, aiLoading && styles.macroCardLoading]}>
                                        {aiLoading ? (
                                            <Animated.View style={[styles.shimmer, { opacity: shimmerOpacity }]} />
                                        ) : (
                                            <>
                                                <Text style={styles.macroIcon}>🍞</Text>
                                                <Text style={styles.macroLabel}>Carbos (g)</Text>
                                                <TextInput
                                                    style={[styles.macroInput, aiEstimated && styles.macroInputAi]}
                                                    placeholder="0"
                                                    placeholderTextColor="#cbd5e1"
                                                    value={carbs}
                                                    onChangeText={setCarbs}
                                                    keyboardType="numeric"
                                                />
                                            </>
                                        )}
                                    </View>

                                    {/* Fat */}
                                    <View style={[styles.macroCard, aiLoading && styles.macroCardLoading]}>
                                        {aiLoading ? (
                                            <Animated.View style={[styles.shimmer, { opacity: shimmerOpacity }]} />
                                        ) : (
                                            <>
                                                <Text style={styles.macroIcon}>🥑</Text>
                                                <Text style={styles.macroLabel}>Grasas (g)</Text>
                                                <TextInput
                                                    style={[styles.macroInput, aiEstimated && styles.macroInputAi]}
                                                    placeholder="0"
                                                    placeholderTextColor="#cbd5e1"
                                                    value={fat}
                                                    onChangeText={setFat}
                                                    keyboardType="numeric"
                                                />
                                            </>
                                        )}
                                    </View>
                                </View>

                                {/* ═══════════════════════════════════════════════ */}
                                {/*   RACIÓN HABITUAL (Smart Portions)              */}
                                {/* ═══════════════════════════════════════════════ */}
                                <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>🥄 RACIÓN HABITUAL</Text>
                                        <View style={{ backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                                            <Text style={{ fontSize: 10, color: '#0284c7', fontWeight: '600' }}>Opcional</Text>
                                        </View>
                                    </View>
                                    <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                                        Define una unidad de medida común (ej: "1 Rebanada = 28g")
                                    </Text>

                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        {/* Unit Name */}
                                        <View style={{ flex: 2 }}>
                                            <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>Nombre de la unidad</Text>
                                            <TextInput
                                                style={{ height: 44, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: '#1e293b', backgroundColor: '#f8fafc' }}
                                                placeholder="Ej: Rebanada, Unidad, Scoop..."
                                                placeholderTextColor="#94a3b8"
                                                value={servingUnit}
                                                onChangeText={setServingUnit}
                                            />
                                        </View>

                                        {/* Weight */}
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>Peso (g)</Text>
                                            <TextInput
                                                style={{ height: 44, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: '#1e293b', backgroundColor: '#f8fafc', textAlign: 'center' }}
                                                placeholder="100"
                                                placeholderTextColor="#94a3b8"
                                                value={servingWeight}
                                                onChangeText={setServingWeight}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                    </View>

                                    {/* Dynamic Preview */}
                                    {servingUnit !== 'g' && parseFloat(servingWeight) > 0 && parseFloat(kcal) > 0 && (
                                        <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1, borderColor: '#86efac' }}>
                                            <Text style={{ fontSize: 13, color: '#166534', fontWeight: '600' }}>
                                                1 {servingUnit} ({servingWeight}g) aportará:
                                            </Text>
                                            <Text style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
                                                {Math.round((parseFloat(kcal) * parseFloat(servingWeight)) / 100)} kcal • {Math.round((parseFloat(protein) * parseFloat(servingWeight)) / 100 * 10) / 10}g prot • {Math.round((parseFloat(carbs) * parseFloat(servingWeight)) / 100 * 10) / 10}g carbs • {Math.round((parseFloat(fat) * parseFloat(servingWeight)) / 100 * 10) / 10}g grasas
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Ionicons name="save-outline" size={18} color="#fff" />
                                <Text style={styles.saveBtnText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    centeredView: {
        width: '100%',
        maxWidth: 800,
        maxHeight: '90%',
    },
    modalCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 25,
        elevation: 10,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    closeBtn: {
        padding: 4,
    },

    // Content
    content: {
        maxHeight: 700,
    },
    contentContainer: {
        padding: 24,
    },

    // Identity Zone
    identityZone: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 24,
        flexWrap: 'wrap',
    },
    identityZoneMobile: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        width: '100%',
    },
    imageSection: {
        width: 140,
    },
    imageSectionMobile: {
        width: '90%',
        alignItems: 'stretch',
    },
    imagePreview: {
        width: 140,
        height: 140,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        overflow: 'hidden',
        marginBottom: 8,
    },
    imagePreviewMobile: {
        width: 140,
        height: 140,
        marginBottom: 0,
    },
    // Mobile Image Layout
    mobileImageRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    mobileTabsColumn: {
        flexDirection: 'column',
        gap: 8,
        flex: 1,
        justifyContent: 'space-between',
    },
    mobileTabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    mobileTabBtnActive: {
        backgroundColor: '#eff6ff',
        borderColor: '#2563eb',
    },
    mobileTabBtnActiveAi: {
        backgroundColor: '#faf5ff',
        borderColor: '#8b5cf6',
    },
    mobileTabLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#94a3b8',
    },
    mobileTabLabelActive: {
        color: '#2563eb',
        fontWeight: '600',
    },
    mobileTabLabelActiveAi: {
        color: '#8b5cf6',
        fontWeight: '600',
    },
    mobileTabContent: {
        marginTop: 12,
        width: '100%',
    },
    mobileUploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#eff6ff',
        borderRadius: 8,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    mobileUploadBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2563eb',
    },
    mobileUrlInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 14,
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    mobileAiSection: {
        alignItems: 'center',
    },
    mobileAiBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#faf5ff',
        borderRadius: 8,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#e9d5ff',
        width: '100%',
    },
    mobileAiBtnLoading: {
        backgroundColor: '#f3e8ff',
    },
    mobileAiBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8b5cf6',
    },
    mobileAiRemaining: {
        fontSize: 11,
        color: '#a78bfa',
        marginTop: 8,
        textAlign: 'center',
    },
    previewImg: {
        width: '100%',
        height: '100%',
    },
    placeholderImg: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    placeholderText: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 4,
    },
    imageTabs: {
        flexDirection: 'row',
        gap: 4,
        marginBottom: 8,
    },
    imageTabBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
        backgroundColor: '#f8fafc',
    },
    imageTabActive: {
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    uploadBtn: {
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        paddingVertical: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    uploadBtnText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    urlInputRow: {
        flexDirection: 'row',
    },
    urlInput: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    aiImageSection: {
        alignItems: 'center',
    },
    aiImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#faf5ff',
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#e9d5ff',
        width: '100%',
    },
    aiImageBtnLoading: {
        backgroundColor: '#f3e8ff',
    },
    aiImageBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8b5cf6',
    },
    aiImageRemaining: {
        fontSize: 10,
        color: '#a78bfa',
        marginTop: 6,
        textAlign: 'center',
    },

    // Form Fields
    formFields: {
        flex: 1,
        minWidth: 280,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 6,
    },
    optional: {
        fontWeight: '400',
        color: '#94a3b8',
    },
    textInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#1e293b',
        marginBottom: 12,
    },
    nameInputRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    nameInput: {
        flex: 1,
        marginBottom: 0,
    },
    magicBtn: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: '#faf5ff',
        borderWidth: 1,
        borderColor: '#e9d5ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    magicBtnLoading: {
        backgroundColor: '#f3e8ff',
    },
    tagSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    tagSelectorText: {
        fontSize: 14,
        color: '#1e293b',
    },
    tagSelectorPlaceholder: {
        fontSize: 14,
        color: '#94a3b8',
    },
    tagPickerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
    },
    tagChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    tagChipActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    tagChipText: {
        fontSize: 12,
        color: '#64748b',
    },
    tagChipTextActive: {
        color: '#fff',
        fontWeight: '600',
    },

    // Nutrition Zone
    nutritionZone: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 16,
    },
    nutritionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    nutritionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    nutritionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: 0.5,
    },
    aiEstimatedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#faf5ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e9d5ff',
    },
    aiEstimatedText: {
        fontSize: 10,
        color: '#8b5cf6',
        fontWeight: '500',
    },
    per100gBadge: {
        backgroundColor: '#dbeafe',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    per100gText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#2563eb',
    },
    macrosGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    macrosGridMobile: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    macroCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 6,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minHeight: 80,
        justifyContent: 'center',
    },
    macroCardLoading: {
        backgroundColor: '#f1f5f9',
    },
    shimmer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#e2e8f0',
        borderRadius: 10,
    },
    macroIcon: {
        fontSize: 18,
        marginBottom: 4,
    },
    macroLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
        textAlign: 'center',
    },
    macroInput: {
        width: '100%',
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        paddingVertical: 4,
    },
    macroInputAi: {
        color: '#8b5cf6',
    },

    // Footer
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        backgroundColor: '#fff',
    },
    cancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#2563eb',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    saveBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
});
