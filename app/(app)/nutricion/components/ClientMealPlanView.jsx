/* app/(app)/nutricion/components/ClientMealPlanView.jsx */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMealTracking } from '../../../../src/context/MealTrackingContext';
import { useTheme } from '../../../../context/ThemeContext';
import { generateAndShareNutritionPDF } from '../../../../src/services/pdfGenerator';

import { getRecipePlaceholder } from '../../../../src/utils/recipePlaceholder';

// Components
import NutritionHeaderTabs from './NutritionHeaderTabs';
import ClientWeeklyOverview from './ClientWeeklyOverview';
import ShoppingListScreen from './ShoppingListScreen';
import DailyMealList from './DailyMealList';
import RecipeWalkthroughModal from './RecipeWalkthroughModal';
import { getContrastColor } from '../../../../utils/colors';

const ClientMealPlanView = ({ plan, todayTarget: initialTodayTarget, theme, user, clientSettings, coachInfo }) => {
    const router = useRouter();
    const { isMealCompleted, getDailyProgress, toggleMealCompletion } = useMealTracking();
    const [activeTab, setActiveTab] = useState('TODAY'); // TODAY, WEEK, SHOPPING
    const [selectedOptions, setSelectedOptions] = useState({}); // { [mealId]: optionIndex }

    // Recipe Modal State
    const [recipeModalVisible, setRecipeModalVisible] = useState(false);
    const [activeRecipe, setActiveRecipe] = useState(null);
    const [activeRecipeMealId, setActiveRecipeMealId] = useState(null); // To toggle complete

    // PDF Export State
    const [isExporting, setIsExporting] = useState(false);

    const hideMacros = clientSettings?.hideMacros || false;
    const dateKey = new Date().toISOString().split('T')[0];

    // --- PDF EXPORT HANDLER ---
    const handleExportPDF = async () => {
        if (isExporting) return;

        setIsExporting(true);
        try {
            // Use coachInfo from API (has nombre, logoUrl, brandColor)
            const coachBranding = {
                primaryColor: coachInfo?.brandColor || theme?.primary || '#3b82f6',
                coachName: coachInfo?.nombre || 'Entrenador',
                logoUrl: coachInfo?.logoUrl || null,
            };

            const clientName = user?.nombre || user?.name || 'Cliente';

            // IMPORTANT: Pass hideMacros for TCA/sensitive mode clients
            await generateAndShareNutritionPDF({
                plan,
                coachBranding,
                clientName,
                hideMacros, // From clientSettings
            });

        } catch (error) {
            console.error('[ClientMealPlanView] PDF Export error:', error);
            if (Platform.OS === 'web') {
                window.alert('Error al generar el PDF. Por favor, inténtalo de nuevo.');
            } else {
                Alert.alert('Error', 'No se pudo generar el PDF. Por favor, inténtalo de nuevo.');
            }
        } finally {
            setIsExporting(false);
        }
    };

    // --- 1. RESOLVE TODAY TARGET (Local Timezone Logic) ---
    const todayTarget = useMemo(() => {
        try {
            const dayIndex = new Date().getDay();
            const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const currentDayKey = dayKeys[dayIndex];

            const map = plan?.weekMap || plan?.customPlan?.weekSchedule;
            if (!map) return initialTodayTarget;

            const targetId = map[currentDayKey];
            if (!targetId) return initialTodayTarget;

            const templates = plan.dayTemplates || plan.customPlan?.dayTargets;
            if (!templates?.length) return initialTodayTarget;

            const found = templates.find(t => (t.id || t._id) === targetId);
            return found || (templates.length === 1 ? templates[0] : initialTodayTarget);
        } catch (e) {
            console.error("ClientMealPlanView: Error calculating todayTarget", e);
            return initialTodayTarget;
        }
    }, [plan, initialTodayTarget]);

    // --- 2. PREPARE DATA ---
    // --- 2. PREPARE DATA ---
    const orderedMeals = useMemo(() => {
        if (!todayTarget?.meals) return [];
        return [...todayTarget.meals].sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [todayTarget]);

    // Prepare Completed Map (Moved Up for Progress Calc)
    const completedMealsMap = useMemo(() => {
        const map = {};
        orderedMeals.forEach((m, idx) => {
            const stableId = m.id || idx;
            // Lookup using the same key logic
            const lookupKey = m.id || idx;

            const idxOpt = selectedOptions[lookupKey] || 0;
            const opt = m.options?.[idxOpt];

            if (isMealCompleted(dateKey, stableId, opt?.id)) {
                map[stableId] = true;
            }
        });
        return map;
    }, [orderedMeals, selectedOptions, isMealCompleted, dateKey]);

    // Calculate Progress based on VISIBLE completed meals (WYSIWYG)
    const completionProgress = useMemo(() => {
        if (orderedMeals.length === 0) return 0;
        const completedCount = Object.keys(completedMealsMap).length;
        return Math.round((completedCount / orderedMeals.length) * 100);
    }, [completedMealsMap, orderedMeals.length]);

    // Calculate Totals for Header
    const dayTotals = useMemo(() => {
        let k = 0, p = 0, c = 0, f = 0;
        orderedMeals.forEach((meal, idx) => {
            const stableId = meal.id || idx;
            const selIdx = selectedOptions[stableId] || 0;
            const opt = meal.options?.[selIdx] || meal.options?.[0]; // Fallback
            if (opt?.foods) {
                opt.foods.forEach(x => {
                    k += x.kcal || 0;
                    p += x.protein || 0;
                    c += x.carbs || 0;
                    f += x.fat || 0;
                });
            }
        });
        return { kcal: Math.round(k), protein: Math.round(p), carbs: Math.round(c), fat: Math.round(f) };
    }, [orderedMeals, selectedOptions]);

    // --- 3. HANDLERS ---
    const handleToggleComplete = (mealIdOrIndex) => {
        const idx = selectedOptions[mealIdOrIndex] || 0;

        // Find meal: handle ID vs Index fallback logic
        let meal = orderedMeals.find(m => m.id === mealIdOrIndex);
        if (!meal && typeof mealIdOrIndex === 'number') {
            meal = orderedMeals[mealIdOrIndex];
        }

        if (!meal) return;

        const opt = meal?.options?.[idx];
        const stableId = meal.id || mealIdOrIndex; // Ensure we use the same key for context

        // Toggle in context
        toggleMealCompletion(dateKey, stableId, opt?.id);
    };

    const handleOptionSelect = (mealId, optionIndex) => {
        setSelectedOptions(prev => ({ ...prev, [mealId]: optionIndex }));
    };

    // Navigation Handler (Now Opens Recipe Modal)
    const handleNavigate = (mealId, optionIndex) => {
        const idx = optionIndex ?? (selectedOptions[mealId] || 0);

        // Find meal: handle ID vs Index fallback logic matching DailyMealList
        let meal = orderedMeals.find(m => m.id === mealId);
        if (!meal && typeof mealId === 'number') {
            meal = orderedMeals[mealId];
        }

        const option = meal?.options?.[idx] || meal?.options?.[0]; // Fallback

        if (!meal || !option) {
            console.warn("ClientMealPlanView: Cannot navigate, meal or option missing", { mealId, idx });
            return;
        }

        // Prepare Recipe Data for Modal
        // The Modal expects 'ingredients' (with 'quantity' prop) and 'instructions'.
        // We must MAP 'foods' (with 'amount' prop) to this schema.

        const rawFoods = option.foods || [];

        // 🚀 UNWRAP RECIPE LOGIC:
        // If the option contains a SINGLE food that is a Recipe (has nested elements), 
        // we must display those nested elements, not the "Container" food (e.g. "Pasta Carbonara").
        let sourceIngredients = rawFoods;
        if (rawFoods.length === 1) {
            const singleItem = rawFoods[0];
            // Check if it has nested ingredients (from population or local structure)
            if (singleItem.ingredients && Array.isArray(singleItem.ingredients) && singleItem.ingredients.length > 0) {
                sourceIngredients = singleItem.ingredients;
            } else if (singleItem.item?.ingredients && Array.isArray(singleItem.item.ingredients) && singleItem.item.ingredients.length > 0) {
                sourceIngredients = singleItem.item.ingredients;
            }
        }

        const ingredients = sourceIngredients.map(f => ({
            ...f,
            // Schema Adaptation:
            quantity: f.amount || f.quantity || 0,
            name: f.name || f.cachedName || f.item?.name || 'Alimento',
            image: f.image || f.item?.image,
            item: f.item || { name: f.name, image: f.image },
            cachedName: f.name || f.cachedName,
            // Build cachedMacros from direct properties if not already an object
            cachedMacros: f.cachedMacros || f.nutrients || f.item?.nutrients || {
                protein: f.protein ?? f.item?.protein ?? 0,
                carbs: f.carbs ?? f.item?.carbs ?? 0,
                fat: f.fat ?? f.item?.fat ?? 0,
                kcal: f.kcal ?? f.item?.kcal ?? 0,
            },
            unit: f.unit || 'g'
        }));

        // 🚀 UNWRAP RECIPE LOGIC IMPROVED:
        // Try to find instructions in:
        // 1. The option itself (if it's a "Recipe" type option)
        // 2. The first food if it's a composite/recipe
        // 3. Any food in the list that has instructions (aggregator?) -> No, usually just the main dish.

        const mainFood = rawFoods.find(f => f.instructions || f.item?.instructions) || rawFoods[0];

        const instructions = option.instructions
            || mainFood?.instructions
            || mainFood?.item?.instructions
            || null;

        const prepTime = option.prepTime
            || mainFood?.prepTime
            || mainFood?.item?.prepTime;

        // Resolve Names
        // User Request: "PON OPCION 3 DEBAJO, CARBONARA"
        // We put "Option 3" as subtitle, "Carbonara" as main Title.
        const subtitleStr = option.name;
        const mainName = mainFood?.name
            || mainFood?.item?.name
            || meal.name;

        setActiveRecipe({
            ...option,
            name: mainName,
            subtitle: subtitleStr,
            image: option.image
                || mainFood?.image
                || mainFood?.item?.image
                || null,
            ingredients: ingredients,
            instructions: instructions,
            prepTime: prepTime
        });
        setActiveRecipeMealId(meal.id || mealId); // Pass stable ID used to navigate
        setRecipeModalVisible(true);
    };



    // --- 4. RENDER ---
    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>

            {/* Header Card (Only visible on TODAY tab usually, but let's keep it sticky or top for context?) 
                Actually, usually "Week" view has its own header context. 
                Let's show the Summary Card ONLY if Tab === TODAY.
            */}

            {activeTab === 'TODAY' && (
                <View style={{ paddingHorizontal: 0, marginTop: 10, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
                        {/* LEFT: TITLE */}
                        <Text style={{ fontSize: 28, fontWeight: '900', color: theme.text, letterSpacing: -0.5 }}>
                            Nutrición
                        </Text>

                        {/* RIGHT: PROGRESS */}
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' }}>
                                Progreso Diario
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 80, height: 8, backgroundColor: theme.inputBackground, borderRadius: 4, overflow: 'hidden' }}>
                                    <View style={{ width: `${completionProgress}%`, height: '100%', backgroundColor: theme.primary, borderRadius: 4 }} />
                                </View>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>
                                    {completionProgress}%
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* MACROS SUB-BAR */}
                    {!hideMacros && (
                        <View style={{ marginHorizontal: 20, marginTop: 16, padding: 12, backgroundColor: theme.cardBackground, borderRadius: 12, borderWidth: 1, borderColor: theme.cardBorder }}>
                            {/* Mini Macro Bar */}
                            <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                                <View style={{ flex: dayTotals.protein || 1, backgroundColor: '#ef4444' }} />
                                <View style={{ flex: dayTotals.carbs || 1, backgroundColor: '#3b82f6' }} />
                                <View style={{ flex: dayTotals.fat || 1, backgroundColor: '#f59e0b' }} />
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>🔥 {dayTotals.kcal} kcal</Text>
                                <Text style={{ fontSize: 11, color: theme.textSecondary }}>P: {dayTotals.protein}g  C: {dayTotals.carbs}g  G: {dayTotals.fat}g</Text>
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* TAB SELECTOR */}
            <NutritionHeaderTabs activeTab={activeTab} onTabChange={setActiveTab} />

            {/* TAB CONTENT */}
            <View style={{ flex: 1 }}>

                {/* 1. TODAY */}
                {activeTab === 'TODAY' && (
                    <DailyMealList
                        meals={orderedMeals}
                        hideMacros={hideMacros}
                        completedMeals={completedMealsMap}
                        onToggleComplete={handleToggleComplete}
                        activeOptions={selectedOptions}
                        onOptionSelect={handleOptionSelect}
                        onNavigate={handleNavigate}
                        trackingDate={dateKey} // ✨ Pass specific date for storage unique keys
                        // ✨ Pass current day key for day-specific option filtering
                        dayKey={
                            ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()]
                        }
                    />
                )}

                {/* 2. WEEK */}
                {activeTab === 'WEEK' && (
                    <View style={{ flex: 1 }}>
                        {/* Export Button Header */}
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'flex-end',
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            backgroundColor: theme.background,
                        }}>
                            <TouchableOpacity
                                onPress={handleExportPDF}
                                disabled={isExporting}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    backgroundColor: isExporting ? theme.inputBackground : theme.primary,
                                    borderRadius: 8,
                                    opacity: isExporting ? 0.7 : 1,
                                }}
                            >
                                {isExporting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="download-outline" size={18} color={getContrastColor(theme.primary)} />
                                )}
                                <Text style={{
                                    color: getContrastColor(theme.primary),
                                    fontSize: 13,
                                    fontWeight: '600'
                                }}>
                                    {isExporting ? 'Generando...' : 'Exportar PDF'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <ClientWeeklyOverview
                            embed={true}
                            plan={plan}
                            hideMacros={hideMacros}
                            // We don't need visible/onClose since it's embedded
                            visible={true}
                        />
                    </View>
                )}

                {/* 3. SHOPPING */}
                {activeTab === 'SHOPPING' && (
                    <ShoppingListScreen plan={plan} />
                )}

            </View>

            {/* RECIPE MODAL */}
            <RecipeWalkthroughModal
                visible={recipeModalVisible}
                onClose={() => setRecipeModalVisible(false)}
                recipe={activeRecipe}
                subtitle={activeRecipe?.subtitle}
                hideMacros={hideMacros}
                onComplete={() => {
                    if (activeRecipeMealId) {
                        handleToggleComplete(activeRecipeMealId);
                    }
                    setRecipeModalVisible(false);
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    summaryCard: {
        borderRadius: 16,
        borderWidth: 1,
    },
    dayTitle: {
        fontSize: 16,
        fontWeight: '700',
    }
});

export default ClientMealPlanView;
