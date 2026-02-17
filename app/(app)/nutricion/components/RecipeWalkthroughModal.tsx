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
import { formatUnitWithAmount, calculateMacrosForAmount } from '../../../../src/constants/units';

/**
 * RecipeWalkthroughModal
 * 
 * Re-designed to be a single scroll view.
 * Header: Close (Left), Check (Right).
 * Content: Ingredients -> Instructions.
 */
interface ScaledIngredient {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    originalString: string;
    image?: string | null;
    macros: {
        p: number;
        c: number;
        f: number;
        kcal: number;
    };
}

export default function RecipeWalkthroughModal({
    visible,
    onClose,
    recipe,
    subtitle,
    scaleFactor = 1,
    hideMacros = false, // Default to false
    onComplete
}: {
    visible: boolean;
    onClose: () => void;
    recipe: any; // Contains name, image, ingredients[], instructions
    subtitle?: string; // e.g. "Opción 3"
    scaleFactor?: number;
    hideMacros?: boolean;
    onComplete: () => void;
}) {
    const { theme } = useTheme();
    const [checkedIngredients, setCheckedIngredients] = useState<{ [key: string]: boolean }>({});

    // Toggle Ingredient Checkbox
    const toggleIngredient = (id: string) => {
        setCheckedIngredients(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // ─────────────────────────────────────────────────────────
    // SCALED INGREDIENTS CALCULATION
    // ─────────────────────────────────────────────────────────
    const scaledIngredients = useMemo<ScaledIngredient[]>(() => {
        if (!recipe?.ingredients) return [];
        return recipe.ingredients.map((ing: any, index: number) => {
            const baseQty = parseFloat(ing.quantity) || 0;
            const finalQty = baseQty * scaleFactor;

            // Name fallback logic
            const name = ing.cachedName || ing.name || ing.item?.name || 'Ingrediente';
            const unit = ing.unit || 'g';

            // Image fallback logic
            const image = ing.item?.image || ing.image || null;

            // Get nutrients per 100g (from cachedMacros or item)
            const nutrientsPer100g = ing.cachedMacros || ing.item?.nutrients || ing.nutrients || {};

            // Get servingSize from item if available
            const servingSize = ing.item?.servingSize || ing.servingSize || null;

            // Calculate macros correctly using the unit conversion system
            const calculatedMacros = calculateMacrosForAmount(
                finalQty,
                unit,
                nutrientsPer100g,
                name,
                servingSize
            );

            // Use Composite ID to guarantee uniqueness in UI even if ingredient is repeated
            const uniqueId = `${ing.item?._id || 'custom'}_${index}`;

            return {
                id: uniqueId,
                name,
                unit,
                image,
                quantity: finalQty,
                originalString: formatUnitWithAmount(finalQty, unit),
                macros: {
                    p: calculatedMacros.protein,
                    c: calculatedMacros.carbs,
                    f: calculatedMacros.fat,
                    kcal: calculatedMacros.kcal
                }
            };
        });
    }, [recipe, scaleFactor]);

    const isAllChecked = useMemo(() => {
        if (scaledIngredients.length === 0) return true;
        return scaledIngredients.every(ing => checkedIngredients[ing.id]);
    }, [scaledIngredients, checkedIngredients]);

    // Calculate total macros from ingredients if recipe.nutrients doesn't exist
    const totalMacros = useMemo(() => {
        // Helper para redondear y evitar errores de punto flotante
        const round1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

        // If recipe has nutrients, use those (scaled)
        if (recipe?.nutrients?.kcal) {
            return {
                kcal: Math.round(recipe.nutrients.kcal * scaleFactor),
                p: round1((recipe.nutrients.protein || 0) * scaleFactor),
                c: round1((recipe.nutrients.carbs || 0) * scaleFactor),
                f: round1((recipe.nutrients.fat || 0) * scaleFactor),
            };
        }
        // Otherwise, sum from scaled ingredients and round the final result
        const summed = scaledIngredients.reduce((acc, ing) => ({
            kcal: acc.kcal + ing.macros.kcal,
            p: acc.p + ing.macros.p,
            c: acc.c + ing.macros.c,
            f: acc.f + ing.macros.f,
        }), { kcal: 0, p: 0, c: 0, f: 0 });

        return {
            kcal: Math.round(summed.kcal),
            p: round1(summed.p),
            c: round1(summed.c),
            f: round1(summed.f),
        };
    }, [recipe, scaleFactor, scaledIngredients]);

    if (!visible || !recipe) return null;

    // Resolve Titles
    // If subtitle is provided (e.g. "Opción 3"), make it the MAIN title visually?
    // User said: "SI ES RECETA PON OPCION 3 DEBAJO, CARBONARA"
    // "DEBAJO" might mean subtitle. "CARBONARA" (recipe.name) should be main?
    // User text: "PON OPCION 3 DEBAJO, CARBONARA" -> "Put Option 3 below, Carbonara".
    // Or "Put Option 3, below Carbonara".
    // Let's assume:
    // Large Title: recipe.name (Carbonara)
    // Small Subtitle: subtitle (Opción 3)

    // Wait, let's re-read: "SI ES RECETA PON OPCION 3 DEBAJO, CARBONARA"
    // Usually "Option 3" is the generic name, "Carbonara" is the specific.
    // I will put "Opción 3" as a small label above, and "Carbonara" as the big title.
    // Or if the user meant "Under the title", I will put it under.
    // I'll put generic name (subtitle) small above, Specific name (recipe.name) big below.

    const mainTitle = recipe.name || 'Receta';
    const subTitleLabel = subtitle || 'Comida';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.container, { backgroundColor: theme.background }]}>

                    {/* 1. HERO HEADER */}
                    <View style={styles.hero}>
                        {/* Background Image */}
                        {recipe.image ? (
                            <Image
                                source={{ uri: recipe.image }}
                                style={styles.heroImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <Image
                                source={{ uri: getRecipePlaceholder(recipe.name) }}
                                style={styles.heroImage}
                                resizeMode="cover"
                            />
                        )}

                        {/* Overlay & Content */}
                        <View style={styles.heroOverlay}>

                            {/* HEADER BUTTONS ROW */}
                            <View style={styles.headerRow}>
                                {/* Left: Close */}
                                <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
                                    <Ionicons name="close" size={24} color="#fff" />
                                </TouchableOpacity>

                                {/* Right: Check (Complete) */}
                                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.primary }]} onPress={onComplete}>
                                    <Ionicons name="checkmark" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {/* BOTTOM TEXT CONTENT */}
                            <View style={styles.heroContent}>
                                {/* Option Name (Subtitle) */}
                                {subtitle && (
                                    <Text style={styles.subTitleText}>{subtitle.toUpperCase()}</Text>
                                )}
                                {/* Recipe Name (Title) */}
                                <Text style={styles.recipeTitle}>{mainTitle}</Text>

                                {/* Metadata Badges */}
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                                    {recipe.prepTime ? (
                                        <View style={styles.timeBadge}>
                                            <Ionicons name="time-outline" size={14} color="#fff" />
                                            <Text style={styles.timeText}>
                                                {recipe.prepTime} {String(recipe.prepTime).toLowerCase().includes('min') ? '' : 'min'}
                                            </Text>
                                        </View>
                                    ) : null}
                                    {!hideMacros && totalMacros.kcal > 0 && (
                                        <>
                                            <View style={[styles.timeBadge, { backgroundColor: 'rgba(239, 68, 68, 0.85)' }]}>
                                                <Ionicons name="flame" size={14} color="#fff" />
                                                <Text style={styles.timeText}>{totalMacros.kcal} kcal</Text>
                                            </View>
                                            <View style={[styles.timeBadge, { backgroundColor: 'rgba(34, 197, 94, 0.85)' }]}>
                                                <Text style={styles.timeText}>P {totalMacros.p}g</Text>
                                            </View>
                                            <View style={[styles.timeBadge, { backgroundColor: 'rgba(234, 179, 8, 0.85)' }]}>
                                                <Text style={styles.timeText}>C {totalMacros.c}g</Text>
                                            </View>
                                            <View style={[styles.timeBadge, { backgroundColor: 'rgba(168, 85, 247, 0.85)' }]}>
                                                <Text style={styles.timeText}>F {totalMacros.f}g</Text>
                                            </View>
                                        </>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* 2. MAIN SCROLL CONTENT (NO TABS) */}
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                        {/* SECTION 1: INGREDIENTS */}
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Mise en Place</Text>
                            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                                {scaleFactor !== 1 ? `Cantidades x${scaleFactor}` : 'Ingredientes necesarios'}
                            </Text>
                        </View>

                        <View style={styles.ingredientsList}>
                            {scaledIngredients.map((ing, idx) => {
                                const isChecked = checkedIngredients[ing.id];
                                const placeholder = getRecipePlaceholder(ing.name);

                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[
                                            styles.ingredientCard,
                                            {
                                                backgroundColor: theme.cardBackground,
                                                borderColor: isChecked ? theme.success : theme.cardBorder,
                                                opacity: isChecked ? 0.5 : 1
                                            }
                                        ]}
                                        onPress={() => toggleIngredient(ing.id)}
                                        activeOpacity={0.7}
                                    >
                                        {/* Image */}
                                        <View style={styles.ingImageContainer}>
                                            {ing.image ? (
                                                <Image source={{ uri: ing.image }} style={styles.ingImage} />
                                            ) : (
                                                <Image
                                                    source={{ uri: placeholder }}
                                                    style={styles.ingImage}
                                                />
                                            )}
                                        </View>

                                        {/* Text */}
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.ingredientText, { color: theme.text, textDecorationLine: isChecked ? 'line-through' : 'none' }]}>
                                                {ing.name}
                                            </Text>
                                            <Text style={[styles.ingredientQty, { color: theme.primary }]}>
                                                {formatUnitWithAmount(ing.quantity, ing.unit)}
                                            </Text>
                                            {!hideMacros && ing.macros.kcal > 0 && (
                                                <Text style={[styles.ingredientMacros, { color: theme.textSecondary }]}>
                                                    {ing.macros.kcal} kcal · P{ing.macros.p} · C{ing.macros.c} · F{ing.macros.f}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Checkbox */}
                                        <View style={[
                                            styles.checkbox,
                                            isChecked ? { backgroundColor: theme.success, borderColor: theme.success } : { borderColor: theme.border }
                                        ]}>
                                            {isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* COACH NOTE (If any) */}
                        {recipe.coachNote ? (
                            <View style={[styles.coachNoteBox, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '25' }]}>
                                <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.primary} style={{ marginRight: 10, marginTop: 2 }} />
                                <Text style={[styles.coachNoteText, { color: theme.text }]}>
                                    {recipe.coachNote}
                                </Text>
                            </View>
                        ) : null}

                        {/* SECTION 2: INSTRUCTIONS (If any) */}
                        {recipe.instructions && (
                            <View style={styles.instructionsSection}>
                                <View style={styles.sectionHeader}>
                                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Instrucciones</Text>
                                </View>
                                <Markdown style={markdownStyles(theme)}>
                                    {recipe.instructions}
                                </Markdown>
                            </View>
                        )}

                        {/* FOOTER SPACE */}
                        <View style={{ height: 40 }} />



                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end', // Align to bottom
        backgroundColor: 'rgba(0,0,0,0.0)', // Let standard slide anim handle opacity or keep clear
    },
    container: {
        height: '94%', // ✨ Leave 6% top space (Requested "Un poquito de espacio")
        width: '100%',
        borderTopLeftRadius: 24, // ✨ Rounded top corners
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    hero: { height: 280, position: 'relative' },
    heroImage: { width: '100%', height: '100%' },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 20,
        justifyContent: 'space-between'
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Platform.OS === 'ios' ? 0 : 10,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)', // iOS only, implies smooth look
    },
    heroContent: {
        gap: 4
    },
    subTitleText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
    },
    recipeTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowRadius: 10,
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    timeText: { color: '#fff', fontSize: 13, fontWeight: '600' },

    content: {
        padding: 20,
        paddingBottom: 50,
    },
    sectionHeader: { marginBottom: 16, marginTop: 8 },
    sectionTitle: { fontSize: 22, fontWeight: '800' },
    sectionSubtitle: { fontSize: 13, fontStyle: 'italic', marginTop: 2 },

    ingredientsList: { gap: 10 },
    ingredientCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
    },
    ingImageContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#f1f5f9'
    },
    ingImage: { width: '100%', height: '100%' },
    ingredientText: { fontSize: 16, fontWeight: '600' },
    ingredientQty: { fontSize: 14, fontWeight: '700', marginTop: 2 },
    ingredientMacros: { fontSize: 11, marginTop: 2 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

    coachNoteBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 24,
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
    },
    coachNoteText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        fontStyle: 'italic',
        lineHeight: 22,
    },
    instructionsSection: { marginTop: 32 },
    finishBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        borderRadius: 16,
        marginTop: 20,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5
    },
    finishBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' }
});

const markdownStyles = (theme: any) => ({
    body: { color: theme.text, fontSize: 16, lineHeight: 26 },
    heading1: { color: theme.text, fontSize: 24, fontWeight: '700' as const, marginVertical: 10 },
    heading2: { color: theme.text, fontSize: 20, fontWeight: '700' as const, marginVertical: 8 },
    strong: { fontWeight: '700' as const, color: theme.primary },
});
