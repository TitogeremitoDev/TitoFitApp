/* app/(app)/nutricion/components/ClientMealPlanView.jsx */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMealTracking } from '../../../../src/context/MealTrackingContext';
import { DAY_COLORS } from '../../../../src/constants/nutrition';

// Constants
const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const ClientMealPlanView = ({ plan, todayTarget, theme, user, clientSettings }) => {
    const router = useRouter();
    const { isMealCompleted, getDailyProgress } = useMealTracking();

    const hideMacros = clientSettings?.hideMacros || false;

    // Calculate current date key for tracking
    const dateKey = new Date().toISOString().split('T')[0];

    // Determine displayed day (today or selected) - for now assuming todayTarget is passed correctly depending on logic
    // We might want to allow day selection here too, similar to existing view

    // Sort meals by order
    const orderedMeals = useMemo(() => {
        if (!todayTarget?.meals) return [];
        return [...todayTarget.meals].sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [todayTarget]);

    // Calculate daily totals from planned meals
    const dayTotals = useMemo(() => {
        let k = 0, p = 0, c = 0, f = 0;
        orderedMeals.forEach(meal => {
            // Assume first option unless we have selection logic
            const opt = meal.options?.[0];
            if (opt?.foods) {
                opt.foods.forEach(food => {
                    k += food.kcal || 0;
                    p += food.protein || 0;
                    c += food.carbs || 0;
                    f += food.fat || 0;
                });
            }
        });
        return {
            kcal: Math.round(k),
            protein: Math.round(p),
            carbs: Math.round(c),
            fat: Math.round(f)
        };
    }, [orderedMeals]);

    // Progress
    const completionProgress = getDailyProgress(dateKey, orderedMeals.length);

    // Helpers
    const getMacroPercent = (val, total) => total > 0 ? (val / total) * 100 : 0;

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* 1. Header Card: Daily Summary & Progress */}
            {hideMacros ? (
                // 🛡️ SENSITIVE MODE HEADER
                <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder, padding: 20 }]}>
                    <Text style={[styles.dayTitle, { color: theme.text, fontSize: 20, marginBottom: 8 }]}>
                        {todayTarget?.name || 'Tu día de hoy'}
                    </Text>
                    <Text style={[styles.daySubtitle, { color: theme.textSecondary, marginBottom: 20 }]}>
                        Concéntrate en la calidad de tus hábitos y en escuchar a tu cuerpo.
                    </Text>

                    {/* Simple Progress Bar */}
                    <View style={{ gap: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: theme.text, fontWeight: '600' }}>Progreso Diario</Text>
                            <Text style={{ color: theme.primary, fontWeight: '700' }}>{completionProgress}%</Text>
                        </View>
                        <View style={{ height: 12, backgroundColor: theme.inputBackground, borderRadius: 6, overflow: 'hidden' }}>
                            <View style={{
                                width: `${completionProgress}%`,
                                height: '100%',
                                backgroundColor: theme.primary,
                                borderRadius: 6
                            }} />
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}>
                            {orderedMeals.filter(m => {
                                const opt = m.options?.[0];
                                return isMealCompleted(dateKey, m.id, opt?.id);
                            }).length} de {orderedMeals.length} comidas completadas
                        </Text>
                    </View>
                </View>
            ) : (
                // 📊 STANDARD HEADER
                <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>

                    {/* Day Header */}
                    <View style={[styles.dayHeader, { backgroundColor: todayTarget?.color || '#3b82f6' }]}>
                        <View>
                            <Text style={styles.dayTitle}>{todayTarget?.name || 'Mi Plan'}</Text>
                            <Text style={styles.daySubtitle}>
                                Objetivo: {dayTotals.kcal} kcal
                            </Text>
                        </View>
                        <View style={styles.progressBadge}>
                            <Text style={styles.progressText}>{completionProgress}% Completado</Text>
                        </View>
                    </View>

                    {/* Macro Distribution Bar */}
                    <View style={styles.macroBarContainer}>
                        <View style={styles.macroTrack}>
                            <View style={[styles.macroSegment, { backgroundColor: '#ef4444', flex: dayTotals.protein || 1 }]} />
                            <View style={[styles.macroSegment, { backgroundColor: '#3b82f6', flex: dayTotals.carbs || 1 }]} />
                            <View style={[styles.macroSegment, { backgroundColor: '#f59e0b', flex: dayTotals.fat || 1 }]} />
                        </View>
                        <View style={styles.macroLegend}>
                            <View style={styles.legendItem}>
                                <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
                                <Text style={[styles.legendText, { color: theme.textSecondary }]}>{dayTotals.protein}g Prot</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.dot, { backgroundColor: '#3b82f6' }]} />
                                <Text style={[styles.legendText, { color: theme.textSecondary }]}>{dayTotals.carbs}g Carb</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.dot, { backgroundColor: '#f59e0b' }]} />
                                <Text style={[styles.legendText, { color: theme.textSecondary }]}>{dayTotals.fat}g Gras</Text>
                            </View>
                        </View>
                    </View>
                </View>
            )}

            {/* 2. Meals List */}
            <View style={styles.mealsContainer}>
                {orderedMeals.map((meal, index) => {
                    // Check completion of the FIRST option (default) or handle multiple options logic
                    // For now, checks against mealId and first optionId
                    const option = meal.options?.[0];
                    const isCompleted = isMealCompleted(dateKey, meal.id, option?.id);

                    // Calc meal macros
                    let mKcal = 0;
                    option?.foods?.forEach(f => mKcal += f.kcal || 0);

                    return (
                        <TouchableOpacity
                            key={meal.id || index}
                            style={[
                                styles.mealCard,
                                { backgroundColor: theme.cardBackground, borderColor: isCompleted ? theme.success : theme.cardBorder }
                            ]}
                            onPress={() => {
                                // Navigate to Detail View with Meal and Option ID
                                router.push({
                                    pathname: '/(app)/nutricion/meal/[id]',
                                    params: {
                                        id: meal.id,
                                        mealData: JSON.stringify(meal),
                                        dateKey: dateKey,
                                        isCompleted: isCompleted ? 'true' : 'false',
                                        hideMacros: hideMacros ? 'true' : 'false'
                                    }
                                });
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={styles.mealHeader}>
                                <View style={styles.mealTitleRow}>
                                    <View style={[styles.mealIconContainer, { backgroundColor: theme.inputBackground }]}>
                                        <Text style={styles.mealIcon}>{meal.icon || '🍽️'}</Text>
                                    </View>
                                    <View>
                                        <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
                                        {!hideMacros && (
                                            <Text style={[styles.mealTime, { color: theme.textSecondary }]}>
                                                {meal.suggestedTime || 'Sin hora'} • {Math.round(mKcal)} kcal
                                            </Text>
                                        )}
                                        {hideMacros && meal.suggestedTime && (
                                            <Text style={[styles.mealTime, { color: theme.textSecondary }]}>
                                                {meal.suggestedTime}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                {isCompleted ? (
                                    <View style={[styles.checkCircle, { backgroundColor: theme.success }]}>
                                        <Ionicons name="checkmark" size={16} color="#fff" />
                                    </View>
                                ) : (
                                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                                )}
                            </View>

                            {/* Brief Food List (Preview) */}
                            <View style={styles.foodPreview}>
                                {option?.foods?.slice(0, 3).map((food, i) => (
                                    <Text key={i} style={[styles.foodItemText, { color: theme.textSecondary }]} numberOfLines={1}>
                                        • {food.name}
                                    </Text>
                                ))}
                                {(option?.foods?.length > 3) && (
                                    <Text style={[styles.moreFoodText, { color: theme.textSecondary }]}>
                                        +{option.foods.length - 3} más...
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}

                {orderedMeals.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay comidas configuradas para hoy.</Text>

                        {/* DEBUG INFO */}
                        <View style={{ marginTop: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8 }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>DEBUG DIAGNOSTIC:</Text>
                            <Text style={{ color: '#fff', fontSize: 10 }}>Day: {new Date().getDay()} (0=Sun, 1=Mon...)</Text>
                            <Text style={{ color: '#fff', fontSize: 10 }}>Mode: {plan?.mode || 'N/A'}</Text>
                            <Text style={{ color: '#fff', fontSize: 10 }}>Plan Type: {plan?.planType || 'N/A'}</Text>
                            <Text style={{ color: '#fff', fontSize: 10 }}>WeekMap Mon: {plan?.weekMap?.monday || 'missing'}</Text>
                            <Text style={{ color: '#fff', fontSize: 10 }}>Templates: {plan?.dayTemplates?.length || 0}</Text>
                            {plan?.dayTemplates?.map(dt => (
                                <Text key={dt.id} style={{ color: '#fff', fontSize: 10 }}>
                                    - {dt.name} ({dt.id})
                                </Text>
                            ))}
                        </View>
                    </View>
                )}
            </View>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    summaryCard: {
        margin: 16,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
    },
    dayHeader: {
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dayTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    daySubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
    },
    progressBadge: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    progressText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    macroBarContainer: {
        padding: 16,
        backgroundColor: 'transparent',
    },
    macroTrack: {
        height: 8,
        borderRadius: 4,
        flexDirection: 'row',
        overflow: 'hidden',
        backgroundColor: '#e2e8f0',
        marginBottom: 12,
    },
    macroSegment: {
        height: '100%',
    },
    macroLegend: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 12,
        fontWeight: '500',
    },
    mealsContainer: {
        paddingHorizontal: 16,
        paddingBottom: 40,
        gap: 12,
    },
    mealCard: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    mealTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    mealIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mealIcon: {
        fontSize: 20,
    },
    mealName: {
        fontSize: 16,
        fontWeight: '700',
    },
    mealTime: {
        fontSize: 13,
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    foodPreview: {
        paddingLeft: 52, // Align with text
    },
    foodItemText: {
        fontSize: 13,
        marginBottom: 2,
    },
    moreFoodText: {
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: 2,
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        fontStyle: 'italic',
    }
});

export default ClientMealPlanView;
