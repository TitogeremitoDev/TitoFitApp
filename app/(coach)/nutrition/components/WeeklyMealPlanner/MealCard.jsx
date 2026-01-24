/* app/(coach)/nutrition/components/WeeklyMealPlanner/MealCard.jsx
 * 🎨 MEAL SECTION with HORIZONTAL OPTIONS CAROUSEL
 * - Each meal is a section header with horizontal scroll of option cards
 * - Add/Duplicate/Edit options
 * - No limit on options per meal
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    TextInput,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Meal icons
const MEAL_ICONS = {
    'Desayuno': { icon: 'sunny', color: '#f59e0b' },
    'Media Mañana': { icon: 'cafe', color: '#22c55e' },
    'Almuerzo': { icon: 'restaurant', color: '#3b82f6' },
    'Comida': { icon: 'restaurant', color: '#3b82f6' },
    'Merienda': { icon: 'nutrition', color: '#8b5cf6' },
    'Cena': { icon: 'moon', color: '#6366f1' },
    'Recena': { icon: 'bed', color: '#64748b' },
};

export default function MealCard({
    meal,
    templateColor = '#3b82f6',
    onAddFood,
    onAddSupplement,
    onRemoveFood,
    onUpdateFood,
    onRemoveSupplement,
    onAddOption,
    onRemoveOption,
    onDuplicateOption,
    onEditOptionName,
}) {
    const mealConfig = MEAL_ICONS[meal.name] || { icon: 'restaurant', color: '#64748b' };
    const optionsCount = meal.options?.length || 0;

    return (
        <View style={styles.mealSection}>
            {/* ══════════════════════════════════════════════════════════════ */}
            {/* SECTION HEADER */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                    <View style={[styles.mealIcon, { backgroundColor: mealConfig.color + '15' }]}>
                        <Ionicons name={mealConfig.icon} size={18} color={mealConfig.color} />
                    </View>
                    <Text style={styles.sectionTitle}>{meal.name.toUpperCase()}</Text>
                    <View style={styles.optionsBadge}>
                        <Text style={styles.optionsBadgeText}>
                            {optionsCount} {optionsCount === 1 ? 'opción' : 'opciones'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.addOptionBtn} onPress={onAddOption}>
                    <Ionicons name="add" size={16} color="#3b82f6" />
                    <Text style={styles.addOptionBtnText}>Añadir Opción</Text>
                </TouchableOpacity>
            </View>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* OPTIONS CAROUSEL (Horizontal Scroll) */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.optionsCarousel}
            >
                {meal.options?.map((option, index) => (
                    <OptionCard
                        key={option.id}
                        option={option}
                        index={index}
                        isOnlyOption={optionsCount === 1}
                        templateColor={templateColor}
                        onAddFood={() => onAddFood(option.id)}
                        onRemoveFood={(foodIdx) => onRemoveFood(option.id, foodIdx)}
                        onUpdateFood={(foodIdx, data) => onUpdateFood?.(option.id, foodIdx, data)}
                        onDuplicate={() => onDuplicateOption?.(option.id)}
                        onDelete={() => onRemoveOption?.(option.id)}
                        onEditName={(newName) => onEditOptionName?.(option.id, newName)}
                    />
                ))}


            </ScrollView>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// OPTION CARD (Individual option within carousel)
// ═══════════════════════════════════════════════════════════════════════════
function OptionCard({
    option,
    index,
    isOnlyOption,
    templateColor,
    onAddFood,
    onRemoveFood,
    onUpdateFood,
    onDuplicate,
    onDelete,
    onEditName,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editingFoodIdx, setEditingFoodIdx] = useState(null);
    const [editAmount, setEditAmount] = useState('');

    // Calculate macros
    const optionMacros = option.foods?.reduce(
        (acc, food) => ({
            kcal: acc.kcal + (food.kcal || 0),
            protein: acc.protein + (food.protein || 0),
            carbs: acc.carbs + (food.carbs || 0),
            fat: acc.fat + (food.fat || 0),
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    ) || { kcal: 0, protein: 0, carbs: 0, fat: 0 };

    const hasFoods = option.foods?.length > 0;

    return (
        <View style={styles.optionCard}>
            {/* Option Header */}
            <View style={[styles.optionHeader, { borderLeftColor: templateColor }]}>
                <View style={styles.optionTitleRow}>
                    <Text style={styles.optionNumber}>OPCIÓN {index + 1}</Text>
                    <Text style={styles.optionName} numberOfLines={1}>
                        {option.name || `Opción ${index + 1}`}
                    </Text>
                </View>

                {/* Action buttons */}
                <View style={styles.optionActions}>
                    <TouchableOpacity style={styles.optionActionBtn} onPress={onDuplicate}>
                        <Ionicons name="copy-outline" size={14} color="#64748b" />
                    </TouchableOpacity>
                    {!isOnlyOption && (
                        <TouchableOpacity style={styles.optionActionBtn} onPress={onDelete}>
                            <Ionicons name="trash-outline" size={14} color="#ef4444" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Macros Badge */}
            {optionMacros.kcal > 0 && (
                <View style={styles.optionMacros}>
                    <Text style={styles.optionMacrosText}>
                        {Math.round(optionMacros.kcal)} kcal
                        {' · '}
                        <Text style={{ color: '#3b82f6' }}>P:{Math.round(optionMacros.protein)}</Text>
                        {' · '}
                        <Text style={{ color: '#22c55e' }}>C:{Math.round(optionMacros.carbs)}</Text>
                        {' · '}
                        <Text style={{ color: '#f59e0b' }}>G:{Math.round(optionMacros.fat)}</Text>
                    </Text>
                </View>
            )}

            {/* Foods List */}
            <View style={styles.optionFoods}>
                {!hasFoods ? (
                    <TouchableOpacity style={styles.emptyOption} onPress={onAddFood}>
                        <Ionicons name="add" size={24} color="#d1d5db" />
                        <Text style={styles.emptyOptionText}>Añadir alimentos</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        {option.foods.map((food, foodIdx) => {
                            // Calculate percentage of total option kcal
                            const pct = optionMacros.kcal > 0
                                ? Math.round((food.kcal / optionMacros.kcal) * 100)
                                : 0;

                            return (
                                <View key={`${food.name}_${foodIdx}`} style={styles.foodCard}>
                                    {/* Left: Photo or Placeholder */}
                                    {food.image ? (
                                        <Image source={{ uri: food.image }} style={styles.foodPhoto} />
                                    ) : (
                                        <View style={styles.foodPhotoPlaceholder}>
                                            <Ionicons name="fast-food-outline" size={18} color="#94a3b8" />
                                        </View>
                                    )}

                                    {/* Center: Name + Macros */}
                                    <View style={styles.foodDetails}>
                                        <Text style={styles.foodName} numberOfLines={1}>{food.name}</Text>
                                        <View style={styles.foodMacrosRow}>
                                            <Text style={styles.foodKcal}>🔥 {Math.round(food.kcal || 0)}</Text>
                                            <Text style={[styles.foodMacro, { color: '#3b82f6' }]}>P:{Math.round(food.protein || 0)}</Text>
                                            <Text style={[styles.foodMacro, { color: '#22c55e' }]}>C:{Math.round(food.carbs || 0)}</Text>
                                            <Text style={[styles.foodMacro, { color: '#f59e0b' }]}>G:{Math.round(food.fat || 0)}</Text>
                                        </View>
                                    </View>

                                    {/* Right: Percentage + Portion */}
                                    <View style={styles.foodRightSection}>
                                        {/* Percentage Badge */}
                                        <View style={[styles.pctBadge, pct >= 50 && { backgroundColor: '#fee2e2' }]}>
                                            <Text style={[styles.pctText, pct >= 50 && { color: '#ef4444' }]}>{pct}%</Text>
                                        </View>

                                        {/* Editable Portion */}
                                        {editingFoodIdx === foodIdx ? (
                                            <View style={styles.foodAmountEdit}>
                                                <TextInput
                                                    style={styles.foodAmountInput}
                                                    value={editAmount}
                                                    onChangeText={setEditAmount}
                                                    keyboardType="numeric"
                                                    autoFocus
                                                    selectTextOnFocus
                                                    onBlur={() => {
                                                        const newAmount = parseFloat(editAmount);
                                                        if (newAmount && newAmount > 0 && newAmount !== food.amount) {
                                                            const ratio = newAmount / food.amount;
                                                            onUpdateFood?.(foodIdx, {
                                                                amount: newAmount,
                                                                kcal: Math.round(food.kcal * ratio),
                                                                protein: Math.round(food.protein * ratio * 10) / 10,
                                                                carbs: Math.round(food.carbs * ratio * 10) / 10,
                                                                fat: Math.round(food.fat * ratio * 10) / 10,
                                                            });
                                                        }
                                                        setEditingFoodIdx(null);
                                                    }}
                                                    onSubmitEditing={() => {
                                                        const newAmount = parseFloat(editAmount);
                                                        if (newAmount && newAmount > 0 && newAmount !== food.amount) {
                                                            const ratio = newAmount / food.amount;
                                                            onUpdateFood?.(foodIdx, {
                                                                amount: newAmount,
                                                                kcal: Math.round(food.kcal * ratio),
                                                                protein: Math.round(food.protein * ratio * 10) / 10,
                                                                carbs: Math.round(food.carbs * ratio * 10) / 10,
                                                                fat: Math.round(food.fat * ratio * 10) / 10,
                                                            });
                                                        }
                                                        setEditingFoodIdx(null);
                                                    }}
                                                />
                                                <Text style={styles.foodAmountUnit}>{food.unit}</Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                style={styles.foodAmount}
                                                onPress={() => {
                                                    setEditingFoodIdx(foodIdx);
                                                    setEditAmount(String(food.amount));
                                                }}
                                            >
                                                <Text style={styles.foodAmountText}>{food.amount}{food.unit}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {/* Remove Button */}
                                    <TouchableOpacity
                                        style={styles.foodRemove}
                                        onPress={() => onRemoveFood(foodIdx)}
                                    >
                                        <Ionicons name="close" size={14} color="#9ca3af" />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}

                        <TouchableOpacity style={styles.addFoodBtn} onPress={onAddFood}>
                            <Ionicons name="add-circle-outline" size={14} color="#3b82f6" />
                            <Text style={styles.addFoodBtnText}>Añadir</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {/* Supplements (if any) */}
            {option.supplements?.length > 0 && (
                <View style={styles.supplementsRow}>
                    {option.supplements.map((supp, idx) => (
                        <Text key={idx} style={styles.supplementPill}>💊 {supp.name}</Text>
                    ))}
                </View>
            )}
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    // Section
    mealSection: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    mealIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
        letterSpacing: 0.5,
    },
    optionsBadge: {
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    optionsBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    addOptionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#eff6ff',
    },
    addOptionBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3b82f6',
    },
    // Carousel
    optionsCarousel: {
        paddingLeft: 4,
        paddingRight: 20,
        gap: 12,
    },
    // Option Card
    optionCard: {
        width: 260,
        backgroundColor: '#fff',
        borderRadius: 14,
        overflow: 'hidden',
        ...Platform.select({
            web: {
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            },
            default: {
                elevation: 2,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
            }
        }),
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: '#f8fafc',
        borderLeftWidth: 4,
    },
    optionTitleRow: {
        flex: 1,
    },
    optionNumber: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 0.5,
    },
    optionName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 2,
    },
    optionActions: {
        flexDirection: 'row',
        gap: 6,
    },
    optionActionBtn: {
        padding: 6,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    // Macros
    optionMacros: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#fafafa',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    optionMacrosText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
    },
    // Foods
    optionFoods: {
        padding: 12,
        minHeight: 100,
    },
    emptyOption: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#e5e7eb',
        borderRadius: 10,
        padding: 20,
    },
    emptyOptionText: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 6,
    },
    foodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    foodIcon: {
        fontSize: 14,
        color: '#d1d5db',
        marginRight: 8,
    },
    foodName: {
        flex: 1,
        fontSize: 13,
        color: '#374151',
    },
    foodAmount: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 6,
    },
    foodAmountText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6b7280',
    },
    foodAmountEdit: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#3b82f6',
        borderRadius: 4,
        paddingHorizontal: 4,
    },
    foodAmountInput: {
        width: 40,
        fontSize: 11,
        fontWeight: '600',
        color: '#1e293b',
        textAlign: 'center',
        padding: 2,
    },
    foodAmountUnit: {
        fontSize: 10,
        color: '#64748b',
        marginRight: 2,
    },
    foodRemove: {
        padding: 6,
        marginLeft: 4,
    },

    // NEW: Rich Food Card Styles
    foodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fafafa',
        borderRadius: 8,
        padding: 8,
        marginBottom: 6,
        gap: 8,
    },
    foodPhoto: {
        width: 36,
        height: 36,
        borderRadius: 6,
    },
    foodPhotoPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    foodDetails: {
        flex: 1,
        minWidth: 0,
    },
    foodMacrosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    foodKcal: {
        fontSize: 10,
        fontWeight: '700',
        color: '#f97316',
    },
    foodMacro: {
        fontSize: 9,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    foodRightSection: {
        alignItems: 'flex-end',
        gap: 4,
    },
    pctBadge: {
        backgroundColor: '#e0f2fe',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    pctText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#0ea5e9',
    },
    addFoodBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        paddingVertical: 4,
    },
    addFoodBtnText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#3b82f6',
    },
    // Supplements
    supplementsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
    supplementPill: {
        fontSize: 11,
        color: '#6366f1',
        backgroundColor: '#f5f3ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    // Add Option Card
    addOptionCard: {
        width: 120,
        minHeight: 150,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#e5e7eb',
        borderRadius: 14,
        backgroundColor: '#fafafa',
    },
    addOptionCardText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 8,
    },
});
