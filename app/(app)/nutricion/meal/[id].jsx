/* app/(app)/nutricion/meal/[id].jsx */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../context/ThemeContext';
import { useMealTracking } from '../../../../src/context/MealTrackingContext';
import { useAuth } from '../../../../context/AuthContext';
import axios from 'axios';
import RecipeWalkthroughModal from '../components/RecipeWalkthroughModal';

const MealDetailScreen = () => {
    const router = useRouter();
    const { id, mealData, dateKey, isCompleted: initialCompleted, hideMacros } = useLocalSearchParams();
    const { theme } = useTheme();
    const { toggleMealCompletion, isMealCompleted } = useMealTracking();

    const isSensitiveMode = hideMacros === 'true';

    const meal = useMemo(() => mealData ? JSON.parse(mealData) : null, [mealData]);
    const option = meal?.options?.[0]; // Support multiple options later if needed

    // Current completion status (reactive)
    const completed = isMealCompleted(dateKey, id, option?.id);

    // Calculate Macros
    const macros = useMemo(() => {
        let k = 0, p = 0, c = 0, f = 0;
        option?.foods?.forEach(food => {
            k += food.kcal || 0;
            p += food.protein || 0;
            c += food.carbs || 0;
            f += food.fat || 0;
        });
        return {
            kcal: Math.round(k),
            protein: Math.round(p),
            carbs: Math.round(c),
            fat: Math.round(f)
        };
    }, [option]);

    const handleToggleComplete = () => {
        toggleMealCompletion(dateKey, id, option?.id);
        // Optional: Go back after marking? User preference.
        // router.back(); 
    };

    // 👨‍🍳 COOK MODE LOGIC
    const { token } = useAuth();
    const [showCookModal, setShowCookModal] = useState(false);
    const [detailedRecipe, setDetailedRecipe] = useState(null);
    const [loadingRecipe, setLoadingRecipe] = useState(false);

    // Identify if this is a "Block" recipe assignment
    const isSingleRecipe = option?.foods?.length === 1 && (option.foods[0].isComposite || option.foods[0].instructions);
    const primaryFood = isSingleRecipe ? option.foods[0] : null;

    // Calculate scale factor (Assigned Amount / Base Serving)
    // Assuming base recipe is "1 unit" if not specified.
    // If unit is 'g', and recipe has weight, we calculate ratio.
    const scaleFactor = useMemo(() => {
        if (!primaryFood) return 1;
        // Simple case: Unit matching "unit" or "serving"
        // If amount is 1.5, factor is 1.5
        return primaryFood.amount || 1;
    }, [primaryFood]);

    const handleOpenCookMode = async () => {
        if (!primaryFood) return;

        // If we already have instructions, just open
        if (primaryFood.instructions) {
            setDetailedRecipe(primaryFood);
            setShowCookModal(true);
            return;
        }

        // Fetch full details
        try {
            setLoadingRecipe(true);
            const { data } = await axios.get(`/foods/${primaryFood._id || primaryFood.id}`);
            setDetailedRecipe(data);
            setShowCookModal(true);
        } catch (error) {
            console.error("Error fetching recipe details:", error);
            // Fallback: Show what we have, maybe modal handles missing instructions gracefully?
            setDetailedRecipe(primaryFood);
            setShowCookModal(true);
        } finally {
            setLoadingRecipe(false);
        }
    };

    if (!meal) return <View style={styles.container}><Text>Cargando...</Text></View>;

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Stack.Screen options={{
                headerTitle: meal.name,
                headerTintColor: theme.text,
                headerStyle: { backgroundColor: theme.background },
                headerShadowVisible: false, // Clean look
            }} />

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* 1. Hero Image / Icon Placeholer */}
                <View style={styles.heroContainer}>
                    {/* If we had a real photo URL in meal structure, we'd use it. For now, Icon or Food Images */}
                    {option?.foods?.[0]?.image ? (
                        <Image source={{ uri: option.foods[0].image }} style={styles.heroImage} resizeMode="cover" />
                    ) : (
                        <View style={[styles.heroPlaceholder, { backgroundColor: theme.inputBackground }]}>
                            <Text style={styles.heroEmoji}>{meal.icon || '🍽️'}</Text>
                        </View>
                    )}

                    {/* COOK MODE BUTTON (Floating over image or just below?) */}
                    {isSingleRecipe && (
                        <TouchableOpacity style={styles.cookModeBtn} onPress={handleOpenCookMode} disabled={loadingRecipe}>
                            <Ionicons name="restaurant" size={20} color="#fff" />
                            <Text style={styles.cookModeText}>
                                {loadingRecipe ? 'Cargando...' : 'Ver Preparación'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* 2. Header Info */}
                <View style={styles.headerInfo}>
                    <Text style={[styles.optionName, { color: theme.text, textAlign: isSensitiveMode ? 'center' : 'left' }]}>
                        {option?.name || 'Opción Estándar'}
                    </Text>

                    {!isSensitiveMode ? (
                        <View style={styles.macroRow}>
                            <View style={styles.macroBadge}>
                                <Text style={[styles.macroValue, { color: '#ef4444' }]}>{macros.protein}g</Text>
                                <Text style={styles.macroLabel}>Prot</Text>
                            </View>
                            <View style={styles.macroBadge}>
                                <Text style={[styles.macroValue, { color: '#3b82f6' }]}>{macros.carbs}g</Text>
                                <Text style={styles.macroLabel}>Carb</Text>
                            </View>
                            <View style={styles.macroBadge}>
                                <Text style={[styles.macroValue, { color: '#f59e0b' }]}>{macros.fat}g</Text>
                                <Text style={styles.macroLabel}>Gras</Text>
                            </View>
                            <View style={[styles.macroBadge, { backgroundColor: theme.cardBorder }]}>
                                <Text style={[styles.macroValue, { color: theme.text }]}>{macros.kcal}</Text>
                                <Text style={styles.macroLabel}>Kcal</Text>
                            </View>
                        </View>
                    ) : (
                        // 🛡️ SENSITIVE MODE: No Numbers, Just Vibes
                        <Text style={{ textAlign: 'center', color: theme.textSecondary, fontStyle: 'italic' }}>
                            Disfruta de tu comida consciente 🧘
                        </Text>
                    )}
                </View>

                {/* 3. Ingredients Table */}
                <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>INGREDIENTES</Text>

                    {option?.foods?.map((food, idx) => (
                        <View key={idx} style={[
                            styles.ingredientRow,
                            idx < option.foods.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }
                        ]}>
                            <View style={styles.ingredientInfo}>
                                <Text style={[styles.ingredientName, { color: theme.text }]}>{food.name}</Text>
                                {/* Micro-nutrients or notes could go here */}
                            </View>
                            <Text style={[styles.ingredientAmount, { color: theme.text }]}>
                                {food.amount}{food.unit}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* 4. Supplements (if any) */}
                {option?.supplements?.length > 0 && (
                    <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }]}>
                        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SUPLEMENTOS</Text>
                        {option.supplements.map((supp, idx) => (
                            <View key={idx} style={styles.ingredientRow}>
                                <Text style={[styles.ingredientName, { color: theme.text }]}>{supp.name}</Text>
                                <Text style={[styles.ingredientAmount, { color: theme.text }]}>{supp.dosage}</Text>
                            </View>
                        ))}
                    </View>
                )}

            </ScrollView>

            {/* 5. Sticky Action Button */}
            <View style={[styles.footer, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
                <TouchableOpacity
                    style={[
                        styles.completeBtn,
                        { backgroundColor: completed ? theme.inputBackground : theme.primary },
                        completed && { borderWidth: 1, borderColor: theme.success }
                    ]}
                    onPress={handleToggleComplete}
                >
                    <Ionicons
                        name={completed ? "checkmark-circle" : "checkbox-outline"}
                        size={24}
                        color={completed ? theme.success : "#fff"}
                    />
                    <Text style={[
                        styles.completeBtnText,
                        { color: completed ? theme.success : "#fff" }
                    ]}>
                        {completed ? 'Completado' : 'Marcar como Completado'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Cook Mode Modal */}
            <RecipeWalkthroughModal
                visible={showCookModal}
                recipe={detailedRecipe}
                scaleFactor={scaleFactor}
                onClose={() => setShowCookModal(false)}
                onComplete={() => {
                    setShowCookModal(false);
                    if (!completed) handleToggleComplete();
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100, // Space for footer
    },
    heroContainer: {
        height: 200,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroEmoji: {
        fontSize: 50,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    cookModeBtn: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        backgroundColor: 'rgba(0,0,0,0.7)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    cookModeText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14
    },
    headerInfo: {
        padding: 20,
    },
    optionName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    macroRow: {
        flexDirection: 'row',
        gap: 12,
    },
    macroBadge: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.05)',
        paddingVertical: 8,
        borderRadius: 12,
    },
    macroValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    macroLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    sectionCard: {
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 16,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 12,
    },
    ingredientRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    ingredientInfo: {
        flex: 1,
        marginRight: 16,
    },
    ingredientName: {
        fontSize: 16,
        fontWeight: '500',
    },
    ingredientAmount: {
        fontSize: 16,
        fontWeight: '700',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        borderTopWidth: 1,
    },
    completeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 10,
    },
    completeBtnText: {
        fontSize: 18,
        fontWeight: '700',
    }
});

export default MealDetailScreen;
