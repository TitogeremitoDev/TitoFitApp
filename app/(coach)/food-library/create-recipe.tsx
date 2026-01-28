import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    Alert,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Stack, router } from 'expo-router';
import CoachHeader from '../components/CoachHeader';
import { searchFoods, saveFood, FoodItem } from '../../../src/services/foodService';
import SmartFoodDrawer from '../nutrition/components/SmartFoodDrawer';
import debounce from 'lodash/debounce';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Animated } from 'react-native';

const API_BASE_URL = 'https://consistent-donna-titogeremito-29c943bc.koyeb.app/api';

const TAG_OPTIONS = [
    'Proteína', 'Carbo', 'Vegetal', 'Fruta', 'Lácteo', 'Grasa',
    'Desayuno', 'Almuerzo', 'Cena', 'Snack',
    'Vegano', 'Sin Gluten', 'Integral', 'Postre', 'Bebida'
];

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

    // Live Macros
    const totals = useMemo(() => {
        return ingredients.reduce((acc, ing) => {
            const ratio = (parseFloat(ing.quantity) || 0) / 100; // Base 100g
            const nutrients = ing.item.nutrients;
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

        setImageAiLoading(true);

        try {
            // Use Lorem Flickr (Redundant & reliable)
            // https://loremflickr.com/width/height/keywords
            const encodedName = encodeURIComponent(name.trim());
            const imageUrl = `https://loremflickr.com/800/600/food,${encodedName}/all?lock=${Math.floor(Math.random() * 1000)}`;

            console.log('Fetching Image:', imageUrl);
            setImage(imageUrl);

            // Simular carga
            setTimeout(() => setImageAiLoading(false), 500);

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo generar la imagen');
            setImageAiLoading(false);
        }
    };

    const handleTagToggle = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
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
            const finalIngredients = ingredients.map(ing => {
                if (!ing.item || !ing.item._id) {
                    throw new Error(`Datos corruptos en ingrediente: ${ing.item?.name}`);
                }
                return {
                    item: ing.item._id,
                    quantity: parseFloat(ing.quantity),
                    unit: ing.unit
                };
            });

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

            await saveFood(payload);

            Alert.alert('¡Receta Creada!', 'Ya puedes usarla en tus planes.', [
                { text: 'Genial', onPress: () => router.back() }
            ]);

        } catch (error: any) {
            console.error('Save Error:', error);
            Alert.alert('Error', error.message || 'No se pudo guardar la receta');
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
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: Arroz con Pollo al Curry"
                            value={name}
                            onChangeText={setName}
                        />

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                            {/* Prep Time */}
                            <View style={{ flex: 0.3 }}>
                                <Text style={styles.label}>Tiempo (min)</Text>
                                <TextInput
                                    style={styles.input}
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
                                    <TextInput
                                        style={styles.customTagInput}
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
                                            <TextInput
                                                style={styles.input}
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
                                                {imageAiLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.aiBtnText}>✨ Generar Imagen</Text>}
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
                            </View>
                        ) : (
                            <View style={{ gap: 10 }}>
                                {ingredients.map((ing, index) => {
                                    const qty = parseFloat(ing.quantity) || 0;
                                    const ratio = qty / 100;
                                    const cals = Math.round((ing.item.nutrients?.kcal || 0) * ratio);
                                    const p = Math.round((ing.item.nutrients?.protein || 0) * ratio);
                                    const c = Math.round((ing.item.nutrients?.carbs || 0) * ratio);
                                    const f = Math.round((ing.item.nutrients?.fat || 0) * ratio);

                                    return (
                                        <View key={ing.id} style={styles.ingredientCard}>
                                            {/* Image */}
                                            <Image
                                                source={ing.item.image ? { uri: ing.item.image } : { uri: 'https://via.placeholder.com/50' }}
                                                style={styles.ingImage}
                                            />

                                            {/* Content */}
                                            <View style={{ flex: 1, justifyContent: 'center' }}>
                                                <Text style={styles.ingName} numberOfLines={1}>{ing.item.name}</Text>
                                                <Text style={styles.ingMacros}>
                                                    {cals} kcal • P: {p}g • C: {c}g • G: {f}g
                                                </Text>
                                            </View>

                                            {/* Input */}
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <TextInput
                                                    style={styles.qtyInput}
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
                            </View>
                        )}
                    </View>

                    {/* Instructions */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Preparación / Instrucciones</Text>
                        <TextInput
                            style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 10 }]}
                            placeholder="1. Hervir el arroz...&#10;2. Cortar el pollo..." // multiline hint
                            multiline
                            value={instructions}
                            onChangeText={setInstructions}
                        />
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
    input: {
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1',
        borderRadius: 8, padding: 10, fontSize: 15, color: '#1e293b'
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
    qtyInput: {
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1',
        borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8,
        width: 60, textAlign: 'center', fontSize: 14, fontWeight: '600'
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
    customTagInput: {
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13
    }
});
