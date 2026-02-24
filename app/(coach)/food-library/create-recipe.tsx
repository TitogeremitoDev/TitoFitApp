import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Alert,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../../../components/ui';
import { StatusBar } from 'expo-status-bar';
import { Stack, router } from 'expo-router';
import CoachHeader from '../components/CoachHeader';
import { searchFoods, saveFood, clearSearchCache, FoodItem } from '../../../src/services/foodService';
import SmartFoodDrawer from '../nutrition/components/SmartFoodDrawer';
import debounce from 'lodash/debounce';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://consistent-donna-titogeremito-29c943bc.koyeb.app/api';

// Helper to get auth token
const getAuthToken = async () => {
    return await AsyncStorage.getItem('totalgains_token');
};

const TAG_OPTIONS = [
    'Proteína', 'Carbo', 'Vegetal', 'Fruta', 'Lácteo', 'Grasa',
    'Desayuno', 'Almuerzo', 'Cena', 'Snack',
    'Vegano', 'Sin Gluten', 'Integral', 'Postre', 'Bebida'
];

// Helper to clean AI instructions - remove {{}} format for display
const cleanInstructionsForDisplay = (text: string): string => {
    if (!text) return '';
    // Convert {{Ingrediente|cantidad}} to "Ingrediente (cantidad)"
    return text.replace(/\{\{([^|]+)\|([^}]+)\}\}/g, '$1 ($2)');
};

// Helper to render instructions with auto-highlighted ingredients
// Matches ingredient names from the current list and highlights them
const renderInstructionsWithIngredients = (text: string, ingredientsList: any[]) => {
    if (!text || ingredientsList.length === 0) {
        return <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22 }}>{text}</Text>;
    }

    // Get ingredient names for matching
    const ingredientNames = ingredientsList
        .map(ing => ing.item?.name?.toLowerCase())
        .filter(Boolean);

    if (ingredientNames.length === 0) {
        return <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22 }}>{text}</Text>;
    }

    // Create regex pattern from ingredient names (escape special chars, sort by length desc)
    const sortedNames = [...ingredientNames].sort((a, b) => b.length - a.length);
    const escapedNames = sortedNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(${escapedNames.join('|')})`, 'gi');

    // Split text by ingredient matches
    const parts = text.split(pattern);

    return (
        <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22 }}>
            {parts.map((part, i) => {
                const isIngredient = ingredientNames.some(
                    name => part.toLowerCase() === name
                );
                if (isIngredient) {
                    return (
                        <Text key={i} style={{ color: '#8b5cf6', fontWeight: '700', backgroundColor: '#faf5ff' }}>
                            {part}
                        </Text>
                    );
                }
                return <Text key={i}>{part}</Text>;
            })}
        </Text>
    );
};

export default function CreateRecipeScreen() {
    // Recipe Metadata
    const [name, setName] = useState('');
    const [prepTime, setPrepTime] = useState('');
    const [instructions, setInstructions] = useState('');
    const [image, setImage] = useState<string | null>(null);

    // Ingredients State
    const [ingredients, setIngredients] = useState<any[]>([]); // { item: FoodItem, quantity: number, unit: string }
    const [showDrawer, setShowDrawer] = useState(false);

    // Image & AI State
    const [imageTab, setImageTab] = useState<'upload' | 'url' | 'ai'>('url');
    const [imageAiLoading, setImageAiLoading] = useState(false);
    const [imageAiRemaining, setImageAiRemaining] = useState(3);
    const [imageAiIndex, setImageAiIndex] = useState(0);

    // Saving State
    const [isSaving, setIsSaving] = useState(false);

    // Tags State
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [showTagPicker, setShowTagPicker] = useState(false);

    // AI Recipe Suggest State
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSuggested, setAiSuggested] = useState(false);
    const [aiStats, setAiStats] = useState<{ total: number; matched: number; estimated: number; duplicatesRemoved?: number } | null>(null);

    // AI Ingredient Images State
    const [ingredientImagesLoading, setIngredientImagesLoading] = useState(false);

    // Live Macros
    const totals = useMemo(() => {
        return ingredients.reduce((acc, ing) => {
            const ratio = (parseFloat(ing.quantity) || 0) / 100; // Base 100g
            const nutrients = ing.item?.nutrients || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
            return {
                kcal: acc.kcal + (nutrients.kcal || 0) * ratio,
                protein: acc.protein + (nutrients.protein || 0) * ratio,
                carbs: acc.carbs + (nutrients.carbs || 0) * ratio,
                fat: acc.fat + (nutrients.fat || 0) * ratio,
            };
        }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    }, [ingredients]);

    // Drawer Handler
    const handleDrawerAdd = (items: any[]) => {
        const newIngredients = items.map(sel => ({
            item: sel.food,
            quantity: String(sel.amount || 100),
            unit: sel.unit || 'g',
            id: Date.now().toString() + Math.random()
        }));
        setIngredients(prev => [...prev, ...newIngredients]);
        setShowDrawer(false);
    };

    const removeIngredient = (index: number) => {
        setIngredients(prev => prev.filter((_, i) => i !== index));
    };

    const updateQuantity = (index: number, qty: string) => {
        setIngredients(prev => {
            const newArr = [...prev];
            newArr[index].quantity = qty;
            return newArr;
        });
    };

    // Image Handlers
    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setImage(result.assets[0].uri);
        }
    };

    const handleAiGenerateImage = async () => {
        if (!name.trim() || name.trim().length < 2) {
            Alert.alert('Error', 'Escribe el nombre del plato primero');
            return;
        }

        const nextIndex = imageAiIndex + 1;
        setImageAiIndex(nextIndex);
        setImageAiLoading(true);

        try {
            const token = await getAuthToken();

            if (!token) {
                Alert.alert('Error', 'Sesión no válida');
                setImageAiLoading(false);
                return;
            }

            // Use the same API as FoodCreatorModal - /api/foods/ai-image
            const response = await fetch(`${API_BASE_URL}/foods/ai-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    foodName: name.trim(),
                    index: nextIndex - 1 // Send 0-based index for different images
                })
            });

            const data = await response.json();

            if (response.status === 429) {
                Alert.alert('Límite alcanzado', data.message || 'Demasiados intentos');
                setImageAiLoading(false);
                return;
            }

            if (!response.ok) {
                throw new Error(data.error || 'Error generando imagen');
            }

            if (data.success && (data.image?.dataUrl || data.image?.url)) {
                const imageUrl = data.image.dataUrl || data.image.url;
                console.log('[AI Image] Generated:', imageUrl);
                setImage(imageUrl);
            } else {
                throw new Error('No se encontró imagen');
            }

        } catch (error: any) {
            console.error('[Image Error]', error);
            Alert.alert('Error', error.message || 'No se pudo obtener la imagen. Intenta con URL manual.');
        } finally {
            setImageAiLoading(false);
        }
    };

    // Generate images for ingredients without images
    const handleAiGenerateIngredientImages = async () => {
        // Find ingredients without images (including virtual ones)
        const ingredientsWithoutImages = ingredients.filter(
            (ing) => !ing.item?.image && ing.item?.name
        );

        if (ingredientsWithoutImages.length === 0) {
            Alert.alert('Info', 'Todos los ingredientes ya tienen imagen');
            return;
        }

        setIngredientImagesLoading(true);

        try {
            const token = await getAuthToken();

            if (!token) {
                Alert.alert('Error', 'Sesión no válida');
                setIngredientImagesLoading(false);
                return;
            }

            let successCount = 0;
            let savedToDbCount = 0;
            let errorCount = 0;

            // Process each ingredient without image
            for (let i = 0; i < ingredients.length; i++) {
                const ing = ingredients[i];

                // Skip if already has image
                if (ing.item?.image) continue;

                const foodName = ing.item?.name;
                if (!foodName) continue;

                const isVirtual = ing.isVirtual || ing.item?.isVirtual || (typeof ing.item?._id === 'string' && ing.item._id.startsWith('virtual_'));

                try {
                    // Step 1: Get image from AI
                    const response = await fetch(`${API_BASE_URL}/foods/ai-image`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            foodName: foodName.trim(),
                            index: i
                        })
                    });

                    const data = await response.json();

                    if (data.success && (data.image?.dataUrl || data.image?.url)) {
                        const imageUrl = data.image.dataUrl || data.image.url;

                        // Step 2: For real DB items, save to database
                        if (!isVirtual && ing.item?._id) {
                            const updateResponse = await fetch(`${API_BASE_URL}/foods/${ing.item._id}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    image: imageUrl
                                })
                            });

                            if (updateResponse.ok) {
                                savedToDbCount++;
                                console.log(`[Ingredient Image] ✓ ${foodName}: saved to DB`);
                            } else {
                                console.warn(`[Ingredient Image] ⚠ ${foodName}: DB update failed`);
                            }
                        } else {
                            console.log(`[Ingredient Image] ✓ ${foodName}: saved locally (virtual)`);
                        }

                        // Step 3: Always update local state
                        setIngredients(prev => {
                            const newArr = [...prev];
                            if (newArr[i] && newArr[i].item) {
                                newArr[i] = {
                                    ...newArr[i],
                                    item: {
                                        ...newArr[i].item,
                                        image: imageUrl
                                    }
                                };
                            }
                            return newArr;
                        });
                        successCount++;
                    } else {
                        errorCount++;
                        console.log(`[Ingredient Image] ✗ ${foodName}: No image found`);
                    }
                } catch (err) {
                    errorCount++;
                    console.error(`[Ingredient Image] Error for ${foodName}:`, err);
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            if (successCount > 0) {
                const virtualNote = (successCount - savedToDbCount) > 0
                    ? `\n${successCount - savedToDbCount} se guardarán al crear la receta.`
                    : '';
                Alert.alert(
                    '✨ Imágenes generadas',
                    `Se generaron ${successCount} imagen${successCount > 1 ? 'es' : ''}.${savedToDbCount > 0 ? `\n${savedToDbCount} guardada${savedToDbCount > 1 ? 's' : ''} en BD.` : ''}${virtualNote}${errorCount > 0 ? `\n${errorCount} no se pudieron obtener.` : ''}`
                );
            } else {
                Alert.alert('Error', 'No se pudieron obtener imágenes para los ingredientes');
            }

        } catch (error: any) {
            console.error('[Ingredient Images Error]', error);
            Alert.alert('Error', 'Error al obtener imágenes de ingredientes');
        } finally {
            setIngredientImagesLoading(false);
        }
    };

    // Count ingredients without images (including virtual)
    const ingredientsWithoutImagesCount = useMemo(() => {
        return ingredients.filter(ing => !ing.item?.image && ing.item?.name).length;
    }, [ingredients]);

    const handleTagToggle = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    // ─────────────────────────────────────────────────────────
    // ✨ AI RECIPE SUGGEST - Auto-fill everything!
    // ─────────────────────────────────────────────────────────
    const handleAiSuggestRecipe = async () => {
        if (!name.trim() || name.trim().length < 3) {
            Alert.alert('Error', 'Escribe el nombre de la receta primero (mínimo 3 caracteres)');
            return;
        }

        setAiLoading(true);
        setAiSuggested(false);
        setAiStats(null);

        try {
            const token = await getAuthToken();
            if (!token) {
                Alert.alert('Error', 'Sesión no válida. Por favor, vuelve a iniciar sesión.');
                return;
            }

            console.log('[AI Recipe] Requesting suggestion for:', name.trim());

            const response = await fetch(`${API_BASE_URL}/foods/ai-recipe-suggest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ recipeName: name.trim() })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error en la sugerencia de IA');
            }

            if (data.success && data.recipe) {
                const { recipe, stats } = data;

                console.log('[AI Recipe] Received suggestion:', recipe);
                console.log('[AI Recipe] Stats:', stats);

                // Auto-fill all fields with slight delay for visual effect
                setTimeout(() => {
                    // Name (cleaned by AI)
                    if (recipe.name) setName(recipe.name);

                    // Prep Time
                    if (recipe.prepTime) setPrepTime(String(recipe.prepTime));

                    // Tags
                    if (recipe.tags && Array.isArray(recipe.tags)) {
                        const validTags = recipe.tags.filter((t: string) => TAG_OPTIONS.includes(t));
                        setSelectedTags(validTags);
                    }

                    // Instructions - Clean AI format for human-readable display
                    if (recipe.instructions) {
                        setInstructions(cleanInstructionsForDisplay(recipe.instructions));
                    }

                    // Ingredients - Map to the format expected by the component
                    if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
                        const mappedIngredients = recipe.ingredients.map((ing: any) => ({
                            item: ing.item,
                            quantity: String(ing.quantity || 100),
                            unit: ing.unit || 'g',
                            id: Date.now().toString() + Math.random(),
                            isVirtual: ing.item?.isVirtual || false,
                            matchSource: ing.matchSource
                        }));
                        setIngredients(mappedIngredients);
                    }

                    // Stats
                    setAiStats(stats);
                    setAiSuggested(true);
                }, 200);

                // Success feedback
                const matchInfo = stats
                    ? `${stats.matched} ingredientes encontrados en tu base de datos, ${stats.estimated} estimados por IA.`
                    : '';
                Alert.alert('✨ Receta Sugerida', `La receta ha sido rellenada automáticamente.\n\n${matchInfo}\n\nRevisa y ajusta los ingredientes si es necesario.`);
            }

        } catch (error: any) {
            console.error('[AI Recipe Suggest Error]', error);
            Alert.alert('Error', error.message || 'No se pudo generar la sugerencia de receta');
        } finally {
            setAiLoading(false);
        }
    };

    const addCustomTag = (tag: string) => {
        const cleanTag = tag.trim();
        if (cleanTag && !selectedTags.includes(cleanTag)) {
            setSelectedTags(prev => [...prev, cleanTag]);
        }
    };

    const handleSave = async () => {
        console.log('Guardando receta...');
        if (!name.trim()) return Alert.alert('Falta nombre', 'Ponle un nombre a tu receta');
        if (ingredients.length === 0) return Alert.alert('Vacío', 'Añade al menos un ingrediente');

        // Validate Quanitites
        const invalidIng = ingredients.find(i => isNaN(parseFloat(i.quantity)) || parseFloat(i.quantity) <= 0);
        if (invalidIng) {
            console.log('Ingrediente inválido:', invalidIng);
            return Alert.alert('Error', `Revisa la cantidad de: ${invalidIng.item?.name || 'Ingrediente'}`);
        }

        setIsSaving(true);

        try {
            const token = await getAuthToken();
            if (!token) {
                Alert.alert('Error', 'Sesión no válida');
                return;
            }

            // Handle virtual (AI-estimated) ingredients: create them in DB first
            const finalIngredients = [];

            for (const ing of ingredients) {
                const isVirtual = ing.isVirtual || ing.item?.isVirtual || (typeof ing.item?._id === 'string' && ing.item._id.startsWith('virtual_'));

                if (isVirtual) {
                    // Create this food in the database
                    console.log(`[Save] Creating virtual food: ${ing.item?.name}`);

                    const createResponse = await fetch(`${API_BASE_URL}/foods`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            name: ing.item?.name || 'Ingrediente',
                            nutrients: ing.item?.nutrients || { kcal: 0, protein: 0, carbs: 0, fat: 0 },
                            image: ing.item?.image || undefined, // Include image if ingredient has one
                            isComposite: false,
                            tags: [],
                            layer: 'CLOUD'
                        })
                    });

                    const createData = await createResponse.json();

                    if (!createResponse.ok || !createData.food?._id) {
                        console.warn(`Failed to create virtual food: ${ing.item?.name}`);
                        throw new Error(`No se pudo crear el ingrediente: ${ing.item?.name}`);
                    }

                    finalIngredients.push({
                        item: createData.food._id,
                        quantity: parseFloat(ing.quantity),
                        unit: ing.unit
                    });

                    console.log(`[Save] Created food with ID: ${createData.food._id}`);
                } else {
                    // Normal ingredient from DB
                    if (!ing.item || !ing.item._id) {
                        throw new Error(`Datos corruptos en ingrediente: ${ing.item?.name}`);
                    }
                    finalIngredients.push({
                        item: ing.item._id,
                        quantity: parseFloat(ing.quantity),
                        unit: ing.unit
                    });
                }
            }

            // Prepare Payload
            const payload = {
                name,
                prepTime: parseInt(prepTime) || 0,
                instructions,
                tags: selectedTags,
                image: image || undefined,
                isComposite: true,
                ingredients: finalIngredients,
                nutrients: totals
            };

            console.log('Sending Payload:', JSON.stringify(payload, null, 2));

            const savedFood = await saveFood(payload);
            console.log('[Save] Recipe saved successfully:', savedFood?._id || savedFood?.name);

            // Clear search cache so food library refetches fresh data
            clearSearchCache();

            // Success! Show confirmation
            if (Platform.OS === 'web') {
                // On web, use window.alert as backup
                window.alert('¡Receta Creada! Ya puedes usarla en tus planes.');
                router.back();
            } else {
                Alert.alert('¡Receta Creada!', 'Ya puedes usarla en tus planes.', [
                    { text: 'Genial', onPress: () => router.back() }
                ]);
            }

        } catch (error: any) {
            console.error('Save Error:', error);
            if (Platform.OS === 'web') {
                window.alert(`Error: ${error.message || 'No se pudo guardar la receta'}`);
            } else {
                Alert.alert('Error', error.message || 'No se pudo guardar la receta');
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Crear Receta Maestra</Text>
                <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                    {isSaving ? (
                        <ActivityIndicator color="#4f46e5" />
                    ) : (
                        <Text style={[styles.saveText, isSaving && { opacity: 0.5 }]}>Guardar</Text>
                    )}
                </TouchableOpacity>
            </View>

            <View style={{ flex: 1, flexDirection: 'row' }}>

                {/* LEFT: FORM */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>

                    {/* Basic Info */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Nombre del Plato</Text>
                        <View style={styles.nameInputRow}>
                            <EnhancedTextInput
                                containerStyle={[styles.inputContainer, styles.nameInput]}
                                style={styles.inputText}
                                placeholder="Ej: Arroz con Pollo al Curry"
                                value={name}
                                onChangeText={(text) => {
                                    setName(text);
                                    setAiSuggested(false);
                                }}
                            />
                            <TouchableOpacity
                                style={[styles.magicBtn, aiLoading && styles.magicBtnLoading]}
                                onPress={handleAiSuggestRecipe}
                                disabled={aiLoading || name.trim().length < 3}
                            >
                                {aiLoading ? (
                                    <ActivityIndicator size="small" color="#8b5cf6" />
                                ) : (
                                    <Ionicons name="sparkles" size={20} color={name.trim().length >= 3 ? "#8b5cf6" : "#cbd5e1"} />
                                )}
                            </TouchableOpacity>
                        </View>
                        {aiSuggested && aiStats && (
                            <View style={styles.aiStatsBadge}>
                                <Ionicons name="sparkles" size={12} color="#8b5cf6" />
                                <Text style={styles.aiStatsText}>
                                    {Math.round((aiStats.matched / aiStats.total) * 100)}% acierto
                                </Text>
                                <View style={styles.aiStatsDivider} />
                                <Text style={styles.aiStatsText}>
                                    {aiStats.matched} BD · {aiStats.estimated} IA
                                </Text>
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                            {/* Prep Time */}
                            <View style={{ flex: 0.3 }}>
                                <Text style={styles.label}>Tiempo (min)</Text>
                                <EnhancedTextInput
                                    containerStyle={styles.inputContainer}
                                    style={styles.inputText}
                                    placeholder="15"
                                    keyboardType="numeric"
                                    value={prepTime}
                                    onChangeText={setPrepTime}
                                />
                            </View>

                            {/* Tags Selector */}
                            <View style={{ flex: 0.7 }}>
                                <Text style={styles.label}>Etiquetas</Text>
                                <TouchableOpacity
                                    style={styles.tagSelector}
                                    onPress={() => setShowTagPicker(!showTagPicker)}
                                >
                                    <Text numberOfLines={1} style={selectedTags.length ? styles.tagText : styles.placeholderText}>
                                        {selectedTags.length > 0 ? selectedTags.join(', ') : 'Seleccionar...'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={16} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Tag Picker Expanding View */}
                        {showTagPicker && (
                            <View style={styles.tagContainer}>
                                {/* Custom Tag Input */}
                                <View style={styles.customTagRow}>
                                    <EnhancedTextInput
                                        containerStyle={styles.customTagInputContainer}
                                        style={styles.customTagInputText}
                                        placeholder="+ Añadir etiqueta..."
                                        onSubmitEditing={(e) => addCustomTag(e.nativeEvent.text)}
                                    />
                                </View>

                                {TAG_OPTIONS.map(tag => (
                                    <TouchableOpacity
                                        key={tag}
                                        style={[styles.tagChip, selectedTags.includes(tag) && styles.tagChipActive]}
                                        onPress={() => handleTagToggle(tag)}
                                    >
                                        <Text style={[styles.tagChipText, selectedTags.includes(tag) && { color: '#fff' }]}>{tag}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* ADVANCED IMAGE PICKER */}
                        <View style={{ marginTop: 16 }}>
                            <Text style={styles.label}>Foto de Portada</Text>
                            <View style={styles.imageSection}>
                                {/* Preview */}
                                <View style={styles.imagePreview}>
                                    {image ? (
                                        <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    ) : (
                                        <Ionicons name="image-outline" size={32} color="#cbd5e1" />
                                    )}
                                </View>

                                {/* Controls */}
                                <View style={{ flex: 1 }}>
                                    {/* Tabs */}
                                    <View style={styles.tabRow}>
                                        <TouchableOpacity onPress={() => setImageTab('upload')} style={[styles.tabBtn, imageTab === 'upload' && styles.tabActive]}>
                                            <Ionicons name="images" size={16} color={imageTab === 'upload' ? '#2563eb' : '#64748b'} />
                                            <Text style={[styles.tabText, imageTab === 'upload' && styles.tabTextActive]}>Galería</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setImageTab('url')} style={[styles.tabBtn, imageTab === 'url' && styles.tabActive]}>
                                            <Ionicons name="link" size={16} color={imageTab === 'url' ? '#2563eb' : '#64748b'} />
                                            <Text style={[styles.tabText, imageTab === 'url' && styles.tabTextActive]}>URL</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setImageTab('ai')} style={[styles.tabBtn, imageTab === 'ai' && styles.tabActive]}>
                                            <Ionicons name="sparkles" size={16} color={imageTab === 'ai' ? '#8b5cf6' : '#64748b'} />
                                            <Text style={[styles.tabText, imageTab === 'ai' && { color: '#8b5cf6', fontWeight: '700' }]}>IA</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Content */}
                                    <View style={styles.tabContent}>
                                        {imageTab === 'upload' && (
                                            <TouchableOpacity style={styles.actionBtn} onPress={handlePickImage}>
                                                <Text style={styles.actionBtnText}>Abrir Galería</Text>
                                            </TouchableOpacity>
                                        )}
                                        {imageTab === 'url' && (
                                            <EnhancedTextInput
                                                containerStyle={styles.inputContainer}
                                                style={styles.inputText}
                                                placeholder="https://..."
                                                value={image || ''}
                                                onChangeText={setImage}
                                            />
                                        )}
                                        {imageTab === 'ai' && (
                                            <TouchableOpacity
                                                style={[styles.aiBtn, imageAiLoading && { opacity: 0.7 }]}
                                                onPress={handleAiGenerateImage}
                                                disabled={imageAiLoading}
                                            >
                                                {imageAiLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.aiBtnText}>✨ Sugerir Imagen</Text>}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Ingredients List */}
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={styles.sectionTitle}>Ingredientes ({ingredients.length})</Text>
                            <TouchableOpacity
                                onPress={() => setShowDrawer(true)}
                                style={styles.addButton}
                            >
                                <Ionicons name="add" size={16} color="#fff" />
                                <Text style={styles.addButtonText}>Añadir</Text>
                            </TouchableOpacity>
                        </View>

                        {ingredients.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>🍳</Text>
                                <Text style={styles.emptyText}>Añade ingredientes para calcular los macros automáticamente</Text>
                                {name.trim().length >= 3 && (
                                    <TouchableOpacity
                                        style={styles.emptyAiBtn}
                                        onPress={handleAiSuggestRecipe}
                                        disabled={aiLoading}
                                    >
                                        {aiLoading ? (
                                            <ActivityIndicator size="small" color="#8b5cf6" />
                                        ) : (
                                            <>
                                                <Ionicons name="sparkles" size={16} color="#8b5cf6" />
                                                <Text style={styles.emptyAiBtnText}>Sugerir con IA</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <View style={{ gap: 10 }}>
                                {ingredients.map((ing, index) => {
                                    const qty = parseFloat(ing.quantity) || 0;
                                    const ratio = qty / 100;
                                    const cals = Math.round((ing.item?.nutrients?.kcal || 0) * ratio);
                                    const p = Math.round((ing.item?.nutrients?.protein || 0) * ratio);
                                    const c = Math.round((ing.item?.nutrients?.carbs || 0) * ratio);
                                    const f = Math.round((ing.item?.nutrients?.fat || 0) * ratio);
                                    const isVirtual = ing.isVirtual || ing.item?.isVirtual;

                                    return (
                                        <View key={ing.id} style={[styles.ingredientCard, isVirtual && styles.ingredientCardVirtual]}>
                                            {/* Image */}
                                            {ing.item?.image ? (
                                                <Image
                                                    source={{ uri: ing.item.image }}
                                                    style={styles.ingImage}
                                                />
                                            ) : (
                                                <View style={[styles.ingImage, styles.ingImagePlaceholder]}>
                                                    <Ionicons name="nutrition-outline" size={20} color="#94a3b8" />
                                                </View>
                                            )}

                                            {/* Content */}
                                            <View style={{ flex: 1, justifyContent: 'center' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={styles.ingName} numberOfLines={1}>{ing.item?.name || 'Ingrediente'}</Text>
                                                    {isVirtual && (
                                                        <View style={styles.virtualBadge}>
                                                            <Ionicons name="sparkles" size={10} color="#8b5cf6" />
                                                            <Text style={styles.virtualBadgeText}>IA</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.ingMacros}>
                                                    {cals} kcal • P: {p}g • C: {c}g • G: {f}g
                                                </Text>
                                            </View>

                                            {/* Input */}
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <EnhancedTextInput
                                                    containerStyle={styles.qtyInputContainer}
                                                    style={styles.qtyInputText}
                                                    value={ing.quantity}
                                                    onChangeText={(t) => updateQuantity(index, t)}
                                                    keyboardType="numeric"
                                                    selectTextOnFocus
                                                />
                                                {/* Fix: Allow text to expand properly */}
                                                <Text style={[styles.unitText, { minWidth: 20 }]}>{ing.unit}</Text>
                                            </View>

                                            {/* Delete */}
                                            <TouchableOpacity onPress={() => removeIngredient(index)} style={styles.deleteBtn}>
                                                <Ionicons name="close-circle" size={20} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}

                                {/* Button to add images to ingredients without images */}
                                {ingredientsWithoutImagesCount > 0 && (
                                    <TouchableOpacity
                                        style={[styles.ingredientImageBtn, ingredientImagesLoading && { opacity: 0.7 }]}
                                        onPress={handleAiGenerateIngredientImages}
                                        disabled={ingredientImagesLoading}
                                    >
                                        {ingredientImagesLoading ? (
                                            <ActivityIndicator size="small" color="#8b5cf6" />
                                        ) : (
                                            <>
                                                <Ionicons name="images-outline" size={16} color="#8b5cf6" />
                                                <Text style={styles.ingredientImageBtnText}>
                                                    Añadir imágenes ({ingredientsWithoutImagesCount} sin imagen)
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Instructions - Simple editable field */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Preparación / Instrucciones</Text>
                        <EnhancedTextInput
                            containerStyle={[styles.inputContainer, { minHeight: 100, paddingTop: 10 }]}
                            style={[styles.inputText, { textAlignVertical: 'top' }]}
                            placeholder="1. Mezclar los ingredientes...&#10;2. Cocinar a fuego medio..."
                            placeholderTextColor="#94a3b8"
                            multiline
                            value={instructions}
                            onChangeText={setInstructions}
                        />
                        {/* Small indicator of detected ingredients */}
                        {instructions && ingredients.length > 0 && (() => {
                            const detected = ingredients.filter(ing =>
                                ing.item?.name && instructions.toLowerCase().includes(ing.item.name.toLowerCase())
                            ).length;
                            return detected > 0 ? (
                                <View style={styles.ingredientDetectedBadge}>
                                    <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                                    <Text style={styles.ingredientDetectedText}>
                                        {detected} ingrediente{detected > 1 ? 's' : ''} mencionado{detected > 1 ? 's' : ''} en las instrucciones
                                    </Text>
                                </View>
                            ) : null;
                        })()}
                    </View>

                </ScrollView>
            </View>

            {/* BOTTOM: LIVE MACROS FOOTER */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
                <View style={styles.footer}>
                    <View style={styles.macroBlock}>
                        <Text style={styles.macroValue}>{Math.round(totals.kcal)}</Text>
                        <Text style={styles.macroLabel}>Kcal</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.macroBlock}>
                        <Text style={styles.macroValue}>{Math.round(totals.protein)}</Text>
                        <Text style={styles.macroLabel}>Prot</Text>
                    </View>
                    <View style={styles.macroBlock}>
                        <Text style={styles.macroValue}>{Math.round(totals.carbs)}</Text>
                        <Text style={styles.macroLabel}>Carb</Text>
                    </View>
                    <View style={styles.macroBlock}>
                        <Text style={styles.macroValue}>{Math.round(totals.fat)}</Text>
                        <Text style={styles.macroLabel}>Grasa</Text>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* SMART FOOD DRAWER */}
            <SmartFoodDrawer
                visible={showDrawer}
                onClose={() => setShowDrawer(false)}
                onAddFoods={handleDrawerAdd}
                context={{ mealName: name || 'Nueva Receta' }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    saveText: { color: '#4f46e5', fontWeight: '600', fontSize: 16 },

    section: { marginBottom: 24, backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    label: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6 },
    inputContainer: {
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1',
        borderRadius: 8, padding: 10,
    },
    inputText: {
        fontSize: 15, color: '#1e293b'
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },

    addButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#3b82f6',
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4
    },
    addButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    emptyState: { alignItems: 'center', padding: 20, gap: 8 },
    emptyIcon: { fontSize: 32 },
    emptyText: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },


    ingName: { fontWeight: '600', color: '#334155', fontSize: 14 },
    ingBrand: { fontSize: 12, color: '#94a3b8' },
    qtyInputContainer: {
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1',
        borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8,
        width: 60,
    },
    qtyInputText: {
        textAlign: 'center', fontSize: 14, fontWeight: '600'
    },

    footer: {
        flexDirection: 'row', backgroundColor: '#1e293b', padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        alignItems: 'center', justifyContent: 'space-around'
    },
    macroBlock: { alignItems: 'center' },
    macroValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
    macroLabel: { color: '#94a3b8', fontSize: 12 },
    divider: { width: 1, height: 20, backgroundColor: '#334155' },

    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
    },
    modalTitle: { fontSize: 18, fontWeight: '700' },
    modalSearchInput: {
        backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, fontSize: 16
    },
    tagSelector: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#f8fafc', padding: 10, borderRadius: 8,
        borderWidth: 1, borderColor: '#cbd5e1'
    },
    tagText: { color: '#1e293b', flex: 1, fontSize: 14 },
    placeholderText: { color: '#94a3b8', flex: 1, fontSize: 14 },
    tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    tagChip: {
        backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0'
    },
    tagChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    tagChipText: { fontSize: 12, color: '#64748b' },

    imageSection: { flexDirection: 'row', gap: 12, marginTop: 8 },
    imagePreview: {
        width: 80, height: 80, borderRadius: 8, overflow: 'hidden',
        backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: '#e2e8f0'
    },
    tabRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
    tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 4 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
    tabText: { fontSize: 13, color: '#64748b' },
    tabTextActive: { color: '#2563eb', fontWeight: '600' },
    tabContent: { flex: 1, justifyContent: 'center' },
    actionBtn: { backgroundColor: '#2563eb', padding: 8, borderRadius: 6, alignItems: 'center' },
    actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    aiBtn: { backgroundColor: '#8b5cf6', padding: 8, borderRadius: 6, alignItems: 'center' },
    aiBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    ingredientCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', padding: 8, borderRadius: 12,
        borderWidth: 1, borderColor: '#f1f5f9', gap: 12,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 2, elevation: 1
    },
    ingImage: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#f1f5f9' },
    ingMacros: { fontSize: 11, color: '#64748b', marginTop: 2 },
    unitText: { fontSize: 12, color: '#64748b' }, // Removed fixed width
    deleteBtn: { padding: 4 },

    // New Styles
    customTagRow: { width: '100%', marginBottom: 8 },
    customTagInputContainer: {
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    },
    customTagInputText: {
        fontSize: 13
    },

    // AI Magic Button Styles
    nameInputRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center'
    },
    nameInput: {
        flex: 1,
        marginBottom: 0
    },
    magicBtn: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: '#faf5ff',
        borderWidth: 2,
        borderColor: '#e9d5ff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3
    },
    magicBtnLoading: {
        backgroundColor: '#f3e8ff',
        borderColor: '#c4b5fd'
    },
    aiStatsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#faf5ff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e9d5ff',
        marginTop: 8,
        alignSelf: 'flex-start'
    },
    aiStatsText: {
        fontSize: 11,
        color: '#8b5cf6',
        fontWeight: '500'
    },
    aiStatsDivider: {
        width: 1,
        height: 12,
        backgroundColor: '#d8b4fe',
        marginHorizontal: 4
    },

    // Virtual/AI-estimated ingredient styles
    ingredientCardVirtual: {
        borderColor: '#e9d5ff',
        backgroundColor: '#fefbff'
    },
    ingImagePlaceholder: {
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center'
    },
    virtualBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#faf5ff',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9d5ff'
    },
    virtualBadgeText: {
        fontSize: 9,
        color: '#8b5cf6',
        fontWeight: '600'
    },
    emptyAiBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#faf5ff',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e9d5ff',
        marginTop: 12
    },
    emptyAiBtnText: {
        fontSize: 13,
        color: '#8b5cf6',
        fontWeight: '600'
    },

    // Button to add images to ingredients
    ingredientImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#faf5ff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e9d5ff',
        marginTop: 12
    },
    ingredientImageBtnText: {
        fontSize: 13,
        color: '#8b5cf6',
        fontWeight: '600'
    },

    // Instructions - detected ingredients badge
    ingredientDetectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#f0fdf4',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#bbf7d0'
    },
    ingredientDetectedText: {
        fontSize: 12,
        color: '#15803d',
        fontWeight: '500'
    }
});
