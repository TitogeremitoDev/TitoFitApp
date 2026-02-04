import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, LayoutAnimation, Platform, UIManager, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../context/ThemeContext';
import { getRecipePlaceholder } from '../../../../src/utils/recipePlaceholder';
import { formatUnitWithAmount, calculateMacrosForAmount } from '../../../../src/constants/units';
import SupplementFooter from './supplements/SupplementFooter';
import { getContrastColor } from '../../../../utils/colors';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const DailyMealList = ({ meals, hideMacros, completedMeals = {}, onToggleComplete, activeOptions = {}, onOptionSelect, onNavigate, dayKey, trackingDate }) => {
    return (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            {meals.map((meal, index) => (
                <MealItem
                    key={meal.id || index}
                    meal={meal}
                    mealIndex={index}
                    hideMacros={hideMacros}
                    isCompleted={completedMeals[meal.id || index]} // Match parent logic
                    onToggleComplete={() => onToggleComplete(meal.id || index)}
                    activeOptionIndex={activeOptions[meal.id || index]}
                    onOptionSelect={onOptionSelect}
                    onNavigate={onNavigate}
                    dayKey={dayKey}
                    trackingDate={trackingDate}
                />
            ))}
            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

const MealItem = ({ meal, mealIndex, hideMacros, isCompleted, onToggleComplete, activeOptionIndex, onOptionSelect, onNavigate, dayKey, trackingDate }) => {
    const { theme } = useTheme();

    // Animations for completion
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    const opacityAnim = React.useRef(new Animated.Value(1)).current;

    // --- DAY SPECIFIC LOGIC ---
    const rawOptions = meal.options || [];

    // 1. Tag options
    const indexedOptions = rawOptions.map((opt, i) => ({ ...opt, _idx: i }));

    // 2. Filter by Day
    let visibleOptions = indexedOptions;
    if (dayKey) {
        const hasDayTags = indexedOptions.some(o => o.assignedDay || o.day || (o.days && o.days.length));
        if (hasDayTags) {
            visibleOptions = indexedOptions.filter(o => {
                const d = (o.assignedDay || o.day || '').toLowerCase();
                const ds = (o.days || []).map(x => x.toLowerCase());
                return d === dayKey || ds.includes(dayKey);
            });
            if (visibleOptions.length === 0) visibleOptions = indexedOptions;
        }
    }

    // 3. Determine Active Option
    const defaultOptionIdx = visibleOptions.length > 0 ? visibleOptions[0]._idx : 0;
    const activeOptionIdx = activeOptionIndex !== undefined ? activeOptionIndex : defaultOptionIdx;
    const activeOption = rawOptions[activeOptionIdx] || rawOptions[0];

    if (!activeOption) return null;

    // Calculate total macros from foods array with proper unit conversion
    const optionKcal = activeOption.foods?.reduce((sum, f) => {
        // If food has pre-calculated kcal that seems correct (> 0), use it
        // Otherwise, calculate using the unit conversion system
        if (f.kcal && f.kcal > 0) {
            return sum + f.kcal;
        }

        // Get nutrients per 100g
        const nutrientsPer100g = f.cachedMacros || f.item?.nutrients || f.nutrients || {};
        if (!nutrientsPer100g.kcal) return sum;

        // Calculate properly with unit conversion
        const calculated = calculateMacrosForAmount(
            f.amount || f.quantity || 0,
            f.unit || 'g',
            nutrientsPer100g,
            f.name || f.cachedName || '',
            f.item?.servingSize || f.servingSize
        );

        return sum + calculated.kcal;
    }, 0) || 0;

    // Resolve Image
    const foodItem = activeOption.foods?.[0];
    let heroImage = activeOption.image
        || foodItem?.image
        || (typeof foodItem?.item === 'object' && foodItem?.item?.image)
        || (typeof foodItem?.food === 'object' && foodItem?.food?.image);

    if (!heroImage) {
        heroImage = getRecipePlaceholder(activeOption.name || foodItem?.name);
    }

    // Handler for Check Button
    const handleCheck = () => {
        // 1. Animate Contraction
        Animated.parallel([
            Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 200,
                useNativeDriver: true
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true
            })
        ]).start(() => {
            // 2. Trigger actual completion logic after animation
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onToggleComplete();

            // Reset animations silently for next time it expands
            scaleAnim.setValue(1);
            opacityAnim.setValue(1);
        });
    };

    // If completed (persistent state), render compact view directly (no animation needed here usually, unless unchecking)
    // But if we want to animate *out*, we handle it in handleCheck. 
    // If isCompleted is TRUE, we show the collapsed card.
    if (isCompleted) {
        return (
            <TouchableOpacity
                style={[styles.completedCard, { backgroundColor: theme.cardBackground, opacity: 0.6 }]}
                onPress={() => {
                    // Restore
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    onToggleComplete();
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={[styles.checkCircle, { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                            <Ionicons name="checkmark" size={16} color={getContrastColor(theme.primary)} />
                        </View>
                        <Text style={[styles.completedText, { color: theme.textSecondary, textDecorationLine: 'line-through' }]}>
                            {meal.name}
                        </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>Restaurar</Text>
                </View>
            </TouchableOpacity>
        );
    }

    const ingredientsToRender = activeOption.foods || [];

    return (
        <Animated.View style={[styles.mealContainer, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
            {/* Meal Header */}
            <View style={styles.headerRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>{meal.icon || '🍽️'}</Text>
                    <Text style={[styles.mealTitle, { color: theme.text }]}>{meal.name}</Text>
                </View>

                {/* Check Button with Animation */}
                <TouchableOpacity
                    onPress={handleCheck}
                    style={[styles.checkBtn, { borderColor: theme.borderLight }]}
                >
                    <Ionicons name="checkmark" size={20} color={theme.textTertiary} />
                </TouchableOpacity>
            </View>

            {/* Options Buttons */}
            {visibleOptions.length > 1 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {visibleOptions.map((opt) => (
                        <TouchableOpacity
                            key={opt._idx}
                            onPress={() => onOptionSelect(meal.id || mealIndex, opt._idx)}
                            style={[
                                styles.optionPill,
                                {
                                    backgroundColor: opt._idx === activeOptionIdx ? theme.text : theme.inputBackground,
                                }
                            ]}
                        >
                            <Text style={{
                                color: opt._idx === activeOptionIdx ? getContrastColor(theme.text) : theme.textSecondary,
                                fontSize: 12, fontWeight: '600'
                            }}>
                                {opt.name || `Opción ${opt._idx + 1}`}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Hero Card */}
            <View style={[styles.heroCard, { backgroundColor: theme.cardBackground }]}>
                {/* Image Header */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => onNavigate && onNavigate(meal.id || mealIndex, activeOptionIdx)}
                    style={styles.imageContainer}
                >
                    <Image source={{ uri: heroImage }} style={styles.heroImage} />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)']}
                        style={styles.imageOverlay}
                    />
                    <View style={styles.imageContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <Text style={[styles.heroTitle, { flex: 1 }]} numberOfLines={2}>
                                {activeOption.name || 'Comida Saludable'}
                            </Text>
                            <Ionicons name="open-outline" size={20} color="#fff" style={{ marginBottom: 6, marginLeft: 8 }} />
                        </View>
                        {!hideMacros && optionKcal > 0 && (
                            <View style={styles.heroMacros}>
                                <Text style={styles.heroMacroText}>
                                    🔥 {Math.round(optionKcal)} kcal
                                </Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>

                {/* Ingredients List */}
                <View style={styles.cardBody}>
                    <View style={styles.ingredientsList}>
                        {ingredientsToRender.map((food, idx) => (
                            <IngredientRow
                                key={idx}
                                food={food}
                                theme={theme}
                                storageKey={`ing_check_${trackingDate || dayKey || 'today'}_${meal.id || mealIndex}_${activeOptionIdx}_${idx}`}
                            />
                        ))}
                        {(!ingredientsToRender.length) && <Text style={{ color: theme.textSecondary, fontStyle: 'italic' }}>Sin ingredientes</Text>}
                    </View>

                    {/* 💊 Supplements Footer (a nivel de meal, no de option) */}
                    {meal.supplements && meal.supplements.length > 0 && (
                        <SupplementFooter supplements={meal.supplements} showAlerts={true} />
                    )}
                </View>
            </View>
        </Animated.View>
    );
};


import { LinearGradient } from 'expo-linear-gradient';

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingTop: 8,
    },
    mealContainer: {
        marginBottom: 24,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    mealTitle: {
        fontSize: 18,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    checkBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    completedCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    completedText: {
        fontSize: 16,
        fontWeight: '500',
    },
    optionPill: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    heroCard: {
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    imageContainer: {
        height: 180,
        width: '100%',
        position: 'relative',
    },
    heroImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60%',
    },
    imageContent: {
        position: 'absolute',
        bottom: 12,
        left: 16,
        right: 16,
    },
    heroTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 4,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowRadius: 4,
    },
    heroMacros: {
        flexDirection: 'row',
    },
    heroMacroText: {
        color: '#eee',
        fontWeight: '600',
        fontSize: 14,
    },
    cardBody: {
        padding: 16,
    },
    ingredientsList: {
        gap: 8,
    },
    ingredientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    ingredientText: {
        fontSize: 14,
        fontWeight: '500',
    },
    ingredientAmount: {
        fontSize: 14,
        fontWeight: '600',
    }
});

const IngredientRow = ({ food, theme, storageKey }) => {
    const [checked, setChecked] = useState(false);
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    const opacityAnim = React.useRef(new Animated.Value(1)).current;

    // Load initial state
    React.useEffect(() => {
        const loadState = async () => {
            try {
                const val = await AsyncStorage.getItem(storageKey);
                if (val === 'true') {
                    setChecked(true);
                    scaleAnim.setValue(0.95);
                    opacityAnim.setValue(0.5);
                }
            } catch (e) { }
        };
        loadState();
    }, [storageKey]);

    const toggleCheck = async () => {
        const nextState = !checked;
        setChecked(nextState);
        AsyncStorage.setItem(storageKey, String(nextState));

        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: nextState ? 0.95 : 1,
                useNativeDriver: true,
                friction: 8,
                tension: 40
            }),
            Animated.timing(opacityAnim, {
                toValue: nextState ? 0.5 : 1,
                duration: 200,
                useNativeDriver: true
            })
        ]).start();
    };

    return (
        <TouchableOpacity onPress={toggleCheck} activeOpacity={0.8} hitSlop={{ top: 5, bottom: 5, left: 10, right: 10 }}>
            <Animated.View style={[
                styles.ingredientRow,
                {
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                }
            ]}>
                {/* Checkbox or Dot */}
                {checked ? (
                    <Ionicons name="checkmark-circle" size={16} color={theme.textSecondary} style={{ marginRight: 6 }} />
                ) : (
                    <View style={[styles.dot, { backgroundColor: theme.primary, marginRight: 6 }]} />
                )}

                <Text style={[
                    styles.ingredientText,
                    {
                        color: checked ? theme.textSecondary : theme.text,
                        flex: 1,
                        textDecorationLine: checked ? 'line-through' : 'none'
                    }
                ]}>
                    {food.name}
                </Text>
                <Text style={[
                    styles.ingredientAmount,
                    {
                        color: theme.textSecondary,
                        textDecorationLine: checked ? 'line-through' : 'none',
                        fontSize: checked ? 12 : 14
                    }
                ]}>
                    {formatUnitWithAmount(
                        food.amount,
                        (food.isRecipe || food.isComposite) && ['g', 'gramos'].includes((food.unit || '').toLowerCase())
                            ? 'Ración'
                            : food.unit
                    )}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
};

export default DailyMealList;

