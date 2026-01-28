import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Image,
    SafeAreaView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../../../../context/ThemeContext';
import { getRecipePlaceholder } from '../../../../src/utils/recipePlaceholder';

/**
 * RecipeWalkthroughModal
 * 
 * A "Cook Mode" experience for athletes.
 * Shows ingredients (scaled) and step-by-step instructions.
 */
interface ScaledIngredient {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    originalString: string;
}

export default function RecipeWalkthroughModal({
    visible,
    onClose,
    recipe,
    scaleFactor = 1,
    onComplete
}: {
    visible: boolean;
    onClose: () => void;
    recipe: any;
    scaleFactor?: number;
    onComplete: () => void;
}) {
    const { theme } = useTheme();
    const [activeTab, setActiveTab] = useState('ingredients'); // 'ingredients' | 'instructions'
    const [checkedIngredients, setCheckedIngredients] = useState<{ [key: string]: boolean }>({});

    // Toggle Ingredient Checkbox
    const toggleIngredient = (id: string) => {
        setCheckedIngredients(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Scaled Ingredients Calculation
    const scaledIngredients = useMemo<ScaledIngredient[]>(() => {
        if (!recipe?.ingredients) return [];
        return recipe.ingredients.map((ing: any, index: number) => {
            const baseQty = parseFloat(ing.quantity) || 0;
            const finalQty = baseQty * scaleFactor;

            // Name fallback logic
            const name = ing.cachedName || ing.item?.name || 'Ingrediente';
            const unit = ing.unit || '';

            return {
                id: ing.item?._id || `ing-${index}`,
                name,
                quantity: finalQty,
                unit,
                originalString: `${finalQty.toFixed(1)} ${unit} ${name}`
            };
        });
    }, [recipe, scaleFactor]);

    const isAllChecked = useMemo(() => {
        if (scaledIngredients.length === 0) return true;
        return scaledIngredients.every(ing => checkedIngredients[ing.id]);
    }, [scaledIngredients, checkedIngredients]);

    if (!visible || !recipe) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>

                {/* HERO HEADER */}
                <View style={styles.hero}>
                    {recipe.image ? (
                        <Image
                            source={{ uri: recipe.image }}
                            style={styles.heroImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.heroImage, {
                            backgroundColor: getRecipePlaceholder(recipe.name).backgroundColor,
                            alignItems: 'center',
                            justifyContent: 'center'
                        }]}>
                            <Text style={{ fontSize: 80 }}>
                                {getRecipePlaceholder(recipe.name).icon}
                            </Text>
                        </View>
                    )}
                    <View style={styles.heroOverlay}>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.heroContent}>
                            <Text style={styles.recipeTitle}>{recipe.name}</Text>
                            {recipe.prepTime && (
                                <View style={styles.timeBadge}>
                                    <Ionicons name="time-outline" size={14} color="#fff" />
                                    <Text style={styles.timeText}>{recipe.prepTime} min</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* TABS */}
                <View style={[styles.tabs, { borderBottomColor: theme.cardBorder }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'ingredients' && styles.tabActive]}
                        onPress={() => setActiveTab('ingredients')}
                    >
                        <Text style={[styles.tabText, activeTab === 'ingredients' && { color: theme.primary }]}>
                            Mise en Place
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'instructions' && styles.tabActive]}
                        onPress={() => setActiveTab('instructions')}
                    >
                        <Text style={[styles.tabText, activeTab === 'instructions' && { color: theme.primary }]}>
                            Instrucciones
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* CONTENT */}
                <ScrollView contentContainerStyle={styles.content}>

                    {/* INGREDIENTS TAB */}
                    {activeTab === 'ingredients' && (
                        <View>
                            <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
                                {scaleFactor !== 1
                                    ? `⚠️ Cantidades ajustadas (x${scaleFactor})`
                                    : 'Prepara estos ingredientes antes de empezar.'}
                            </Text>

                            {scaledIngredients.map((ing, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.ingredientRow, { borderBottomColor: theme.cardBorder }]}
                                    onPress={() => toggleIngredient(ing.id)}
                                >
                                    <View style={[
                                        styles.checkbox,
                                        checkedIngredients[ing.id] ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: theme.textSecondary }
                                    ]}>
                                        {checkedIngredients[ing.id] && <Ionicons name="checkmark" size={14} color="#fff" />}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[
                                            styles.ingredientText,
                                            { color: theme.text },
                                            checkedIngredients[ing.id] && { textDecorationLine: 'line-through', color: theme.textSecondary }
                                        ]}>
                                            {ing.name}
                                        </Text>
                                        <Text style={[styles.ingredientQty, { color: theme.primary }]}>
                                            {Number.isInteger(ing.quantity) ? ing.quantity : ing.quantity.toFixed(1)} {ing.unit}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}

                            {/* CTA to Next Step */}
                            <TouchableOpacity
                                style={[styles.nextStepBtn, { backgroundColor: theme.primary }]}
                                onPress={() => setActiveTab('instructions')}
                            >
                                <Text style={styles.nextStepText}>Ir a Instrucciones</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* INSTRUCTIONS TAB */}
                    {activeTab === 'instructions' && (
                        <View style={styles.markdownContainer}>
                            <Markdown style={markdownStyles(theme)}>
                                {recipe.instructions || 'No hay instrucciones detalladas para esta receta.'}
                            </Markdown>

                            <TouchableOpacity
                                style={[styles.finishBtn, { backgroundColor: theme.success }]}
                                onPress={onComplete}
                            >
                                <Ionicons name="restaurant" size={24} color="#fff" />
                                <Text style={styles.finishBtnText}>¡Plato Terminado!</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    hero: { height: 250, position: 'relative' },
    heroImage: { width: '100%', height: '100%' },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: 20,
        justifyContent: 'space-between'
    },
    closeBtn: { alignSelf: 'flex-end', padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)' },
    heroContent: { gap: 8 },
    recipeTitle: { fontSize: 28, fontWeight: '800', color: '#fff' },
    timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    timeText: { color: '#fff', fontSize: 13, fontWeight: '600' },

    tabs: { flexDirection: 'row', borderBottomWidth: 1 },
    tab: { flex: 1, paddingVertical: 16, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: '#3b82f6' },
    tabText: { fontSize: 14, fontWeight: '700', color: '#64748b' },

    content: { padding: 20, paddingBottom: 50 },
    sectionHint: { fontSize: 13, marginBottom: 16, fontStyle: 'italic' },

    ingredientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    ingredientText: { fontSize: 16, fontWeight: '600' },
    ingredientQty: { fontSize: 14, fontWeight: '700' },

    nextStepBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 32, gap: 8 },
    nextStepText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    finishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 16, marginTop: 40, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
    finishBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

    markdownContainer: { paddingBottom: 40 }
});

const markdownStyles = (theme: any) => ({
    body: { color: theme.text, fontSize: 16, lineHeight: 26 },
    heading1: { color: theme.text, fontSize: 24, fontWeight: '700' as const, marginVertical: 10 },
    heading2: { color: theme.text, fontSize: 20, fontWeight: '700' as const, marginVertical: 8 },
    strong: { fontWeight: '700' as const, color: theme.primary },
});
