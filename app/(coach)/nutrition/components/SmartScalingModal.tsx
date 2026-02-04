import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Platform,
    ScrollView
} from 'react-native';
import { EnhancedTextInput } from '../../../../components/ui';
import { Ionicons } from '@expo/vector-icons';

/**
 * SmartScalingModal
 * 
 * A specialized modal for adding Recipes/Composite Foods.
 * Allows scaling (via multiplier) and choosing between "Block" and "Explode" modes.
 * 
 * @param visible
 * @param recipe - The FoodItem with isComposite: true
 * @param onClose
 * @param onAdd - (items: [], mode: 'block' | 'explode') => void
 */
export default function SmartScalingModal({ visible, recipe, onClose, onAdd }) {
    const [factor, setFactor] = useState('1.0');
    const [overrides, setOverrides] = useState({}); // { [index]: string_qty }

    // Safe Macros Access
    const baseMacros = useMemo(() => recipe?.nutrients || { kcal: 0, protein: 0, carbs: 0, fat: 0 }, [recipe]);

    // Calculate Scaled Macros (Global Factor Only - for preview base)
    const scaledMacros = useMemo(() => {
        const mul = parseFloat(factor) || 0;
        return {
            kcal: Math.round(baseMacros.kcal * mul),
            protein: Math.round(baseMacros.protein * mul * 10) / 10,
            carbs: Math.round(baseMacros.carbs * mul * 10) / 10,
            fat: Math.round(baseMacros.fat * mul * 10) / 10,
        };
    }, [baseMacros, factor]);

    // Helper: Get final quantity for an ingredient (Override > Factor)
    const getFinalQty = (ing, idx) => {
        if (overrides[idx] !== undefined) return parseFloat(overrides[idx]) || 0;
        const base = parseFloat(ing.quantity) || 0;
        const mul = parseFloat(factor) || 1;
        return Math.round(base * mul * 10) / 10;
    };

    // Calculate Total Macros dynamically (taking overrides into account)
    const totalCurrentMacros = useMemo(() => {
        if (!recipe?.ingredients) return scaledMacros; // Fallback

        // Sum of all ingredients with current quantities
        let total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

        recipe.ingredients.forEach((ing, idx) => {
            const qty = getFinalQty(ing, idx);
            // Nutrients per 100g usually
            const cached = ing.cachedMacros || ing.item?.nutrients || {};
            const ratio = qty / 100;

            total.kcal += (cached.kcal || 0) * ratio;
            total.protein += (cached.protein || 0) * ratio;
            total.carbs += (cached.carbs || 0) * ratio;
            total.fat += (cached.fat || 0) * ratio;
        });

        return {
            kcal: Math.round(total.kcal),
            protein: Math.round(total.protein * 10) / 10,
            carbs: Math.round(total.carbs * 10) / 10,
            fat: Math.round(total.fat * 10) / 10,
        };
    }, [recipe, factor, overrides, scaledMacros]);

    // Handle Quick Factor Buttons
    const setFactorValue = (val) => {
        setFactor(String(val));
        setOverrides({}); // Reset overrides on factory change? Yes, safer.
    };

    // Handle Ingredient Override
    const handleOverride = (amount, idx) => {
        setOverrides(prev => ({ ...prev, [idx]: amount }));
    };

    const hasOverrides = Object.keys(overrides).length > 0;

    // Handle Add (Block Mode)
    const handleAddBlock = () => {
        if (hasOverrides) {
            // Block mode technically should ignore overrides or be disabled.
            // We'll trust the UI to handle visual disablement, but here we enforce standard scaling.
        }
        const mul = parseFloat(factor) || 1;
        if (mul <= 0) return;

        // 🧠 SMART UNIT LOGIC
        // For recipes/composite foods: use 'Ración' as the natural unit
        // For regular foods: use servingSize unit or default to grams

        let finalAmount = mul;
        let finalUnit = (recipe.isComposite || recipe.isRecipe)
            ? (recipe.servingSize?.unit || 'Ración')
            : (recipe.servingSize?.unit || 'g');

        // Normalize unit check
        const isWeightUnit = ['g', 'gramos', 'gramo'].includes(finalUnit.toLowerCase());

        // Deep clone food to avoid mutating original and to scale ingredients
        const scaledFood = JSON.parse(JSON.stringify(recipe));

        if (isWeightUnit) {
            // Calculate total weight from ingredients
            const totalWeight = recipe.ingredients?.reduce((sum, ing) => {
                return sum + (parseFloat(ing.quantity) || 0);
            }, 0) || 100;

            finalAmount = totalWeight * mul;
            finalUnit = 'gramos';
        }

        // 🟢 CRITICAL: Scale Ingredients Snapshot
        if (scaledFood.ingredients) {
            scaledFood.ingredients.forEach(ing => {
                // Determine base quantity (support 'amount' or 'quantity' prop)
                const baseQty = parseFloat(ing.quantity || ing.amount) || 0;
                const newQty = baseQty * mul;

                // Update quantity/amount
                ing.quantity = newQty;
                ing.amount = newQty; // Ensure 'amount' prop exists for MealCard compatibility

                // Update cached macros
                if (ing.cachedMacros) {
                    ing.cachedMacros.kcal *= mul;
                    ing.cachedMacros.protein *= mul;
                    ing.cachedMacros.carbs *= mul;
                    ing.cachedMacros.fat *= mul;
                }
                // Update direct nutrients if present (snapshot)
                if (ing.nutrients) {
                    ing.nutrients.kcal *= mul;
                    ing.nutrients.protein *= mul;
                    ing.nutrients.carbs *= mul;
                    ing.nutrients.fat *= mul;
                }
            });
        }

        onAdd([
            {
                food: scaledFood,
                amount: Math.round(finalAmount * 10) / 10,
                unit: finalUnit,
                calculatedMacros: scaledMacros
            }
        ], 'block');
    };

    // Handle Add (Explode Mode)
    const handleAddExplode = () => {
        if (!recipe.ingredients || recipe.ingredients.length === 0) {
            handleAddBlock();
            return;
        }

        const explodedItems = recipe.ingredients.map((ing, idx) => {
            const foodItem = {
                _id: ing.item?._id || ing.item,
                name: ing.cachedName || ing.item?.name || 'Ingrediente desconocido',
                nutrients: ing.cachedMacros || ing.item?.nutrients || {},
                image: ing.item?.image,
                brand: ing.item?.brand
            };

            const finalQty = getFinalQty(ing, idx);

            const ratio = finalQty / 100;
            const itemMacros = {
                kcal: (foodItem.nutrients.kcal || 0) * ratio,
                protein: (foodItem.nutrients.protein || 0) * ratio,
                carbs: (foodItem.nutrients.carbs || 0) * ratio,
                fat: (foodItem.nutrients.fat || 0) * ratio,
            };

            return {
                food: foodItem,
                amount: finalQty,
                unit: ing.unit || 'g',
                calculatedMacros: itemMacros
            };
        });

        onAdd(explodedItems, 'explode');
    };

    if (!visible || !recipe) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>⚖️ Asignación Inteligente</Text>
                            <Text style={styles.recipeName}>{recipe.name}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.body}>
                        {/* 1. SCALING INPUT */}
                        <Text style={styles.label}>Raciones / Multiplicador</Text>
                        <View style={styles.inputRow}>
                            <TouchableOpacity onPress={() => setFactorValue((parseFloat(factor) - 0.1).toFixed(1))} style={styles.stepBtn}>
                                <Ionicons name="remove" size={20} color="#3b82f6" />
                            </TouchableOpacity>

                            <EnhancedTextInput
                                containerStyle={styles.factorInputContainer}
                                style={styles.factorInputText}
                                value={factor}
                                onChangeText={setFactor}
                                keyboardType="numeric"
                                selectTextOnFocus
                            />

                            <TouchableOpacity onPress={() => setFactorValue((parseFloat(factor) + 0.1).toFixed(1))} style={styles.stepBtn}>
                                <Ionicons name="add" size={20} color="#3b82f6" />
                            </TouchableOpacity>
                        </View>

                        {/* Quick Factors */}
                        <View style={styles.quickFactors}>
                            {[0.5, 1.0, 1.5, 2.0].map(val => (
                                <TouchableOpacity
                                    key={val}
                                    style={[styles.quickFactorBtn, parseFloat(factor) === val && styles.quickFactorBtnActive]}
                                    onPress={() => setFactorValue(val)}
                                >
                                    <Text style={[styles.quickFactorText, parseFloat(factor) === val && styles.quickFactorTextActive]}>
                                        x{val}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* 2. PREVIEW MACROS */}
                        <View style={styles.macrosPreview}>
                            <View style={styles.macroCol}>
                                <Text style={styles.macroLabel}>Kcal</Text>
                                <Text style={styles.macroValue}>{Math.round(totalCurrentMacros.kcal)}</Text>
                            </View>
                            <View style={styles.macroCol}>
                                <Text style={[styles.macroLabel, { color: '#3b82f6' }]}>Prot</Text>
                                <Text style={styles.macroValue}>{Math.round(totalCurrentMacros.protein)}</Text>
                            </View>
                            <View style={styles.macroCol}>
                                <Text style={[styles.macroLabel, { color: '#22c55e' }]}>Carb</Text>
                                <Text style={styles.macroValue}>{Math.round(totalCurrentMacros.carbs)}</Text>
                            </View>
                            <View style={styles.macroCol}>
                                <Text style={[styles.macroLabel, { color: '#f59e0b' }]}>Grasa</Text>
                                <Text style={styles.macroValue}>{Math.round(totalCurrentMacros.fat)}</Text>
                            </View>
                        </View>

                        {/* 2b. INGREDIENTS EDITOR */}
                        {recipe.ingredients && recipe.ingredients.length > 0 && (
                            <View style={styles.ingredientsSection}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={styles.label}>Ingredientes ({recipe.ingredients.length})</Text>
                                    {hasOverrides && (
                                        <TouchableOpacity onPress={() => setOverrides({})}>
                                            <Text style={{ fontSize: 11, color: '#3b82f6', fontWeight: '600' }}>Restablecer</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <ScrollView style={styles.ingredientsList} nestedScrollEnabled>
                                    {recipe.ingredients.map((ing, idx) => {
                                        const finalQty = getFinalQty(ing, idx);
                                        const name = ing.cachedName || ing.item?.name || ing.name || 'Ingrediente';
                                        const isOverridden = overrides[idx] !== undefined;

                                        return (
                                            <View key={idx} style={[styles.ingredientRow, isOverridden && { backgroundColor: '#eff6ff' }]}>
                                                <Text style={[styles.ingName, isOverridden && { color: '#1e40af', fontWeight: '600' }]} numberOfLines={1}>
                                                    • {name}
                                                </Text>

                                                <View style={styles.ingInputContainer}>
                                                    <EnhancedTextInput
                                                        containerStyle={styles.ingInputContainer}
                                                        style={[styles.ingInputText, isOverridden && { color: '#2563eb', fontWeight: '700' }]}
                                                        value={String(finalQty)}
                                                        onChangeText={(v) => handleOverride(v, idx)}
                                                        keyboardType="numeric"
                                                        selectTextOnFocus
                                                    />
                                                    <Text style={styles.ingUnit}>{ing.unit || 'g'}</Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}

                        {/* 3. ACTIONS FORK */}
                        <Text style={[styles.label, { marginTop: 24 }]}>Modo de Asignación</Text>
                        <View style={styles.actionsBranch}>

                            {/* Option A: BLOCK (Disabled if Overrides exist) */}
                            <TouchableOpacity
                                style={[styles.optionBtnPrimary, hasOverrides && { opacity: 0.5, backgroundColor: '#f1f5f9' }]}
                                onPress={() => hasOverrides ? alert('Restablece los ingredientes para añadir como bloque, o usa Desglosar.') : handleAddBlock()}
                            >
                                <View style={styles.optionIconContainer}>
                                    <Text style={{ fontSize: 24 }}>📦</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.optionTitle, hasOverrides && { color: '#94a3b8' }]}>Añadir como Bloque</Text>
                                    <Text style={styles.optionDesc}>
                                        {hasOverrides
                                            ? "No disponible con ediciones manuales"
                                            : `Añade "${recipe.name}" como un solo ítem.`}
                                    </Text>
                                </View>
                                {!hasOverrides && <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />}
                            </TouchableOpacity>

                            {/* Option B: EXPLODE (Primary if Overrides exist) */}
                            <TouchableOpacity
                                style={[styles.optionBtnSecondary, hasOverrides && { borderColor: '#3b82f6', backgroundColor: '#f0f9ff' }]}
                                onPress={handleAddExplode}
                            >
                                <View style={[styles.optionIconContainerSec, hasOverrides && { backgroundColor: '#dbeafe' }]}>
                                    <Text style={{ fontSize: 24 }}>📝</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.optionTitleSec, hasOverrides && { color: '#1e40af', fontWeight: '700' }]}>
                                        {hasOverrides ? 'Añadir Personalizado' : 'Desglosar Ingredientes'}
                                    </Text>
                                    <Text style={[styles.optionDescSec, hasOverrides && { color: '#1e3a8a' }]}>
                                        Añade {recipe.ingredients?.length || 0} ingredientes con tus cantidades.
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={hasOverrides ? '#3b82f6' : "#cbd5e1"} />
                            </TouchableOpacity>

                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20
    },
    modalContent: {
        backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 450,
        ...Platform.select({
            web: { boxShadow: '0 10px 25px rgba(0,0,0,0.1)' },
            default: { elevation: 5 }
        })
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
    },
    title: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
    recipeName: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginTop: 4 },
    body: { padding: 20 },

    label: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 12 },

    // Input Row
    inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 },
    factorInput: {
        backgroundColor: '#f8fafc', fontSize: 32, fontWeight: '800',
        color: '#1e293b', textAlign: 'center', width: 120, height: 60,
        borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0'
    },
    factorInputContainer: {
        backgroundColor: '#f8fafc', width: 120, height: 60,
        borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0'
    },
    factorInputText: {
        fontSize: 32, fontWeight: '800',
        color: '#1e293b', textAlign: 'center',
    },
    stepBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: '#eff6ff',
        alignItems: 'center', justifyContent: 'center'
    },

    quickFactors: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
    quickFactorBtn: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0'
    },
    quickFactorBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    quickFactorText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    quickFactorTextActive: { color: '#fff' },

    // Macros Preview
    macrosPreview: {
        flexDirection: 'row', justifyContent: 'space-around',
        backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 8
    },
    macroCol: { alignItems: 'center' },
    macroLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 2 },
    macroValue: { fontSize: 16, fontWeight: '700', color: '#1e293b' },

    // Branch Options
    actionsBranch: { gap: 12 },
    optionBtnPrimary: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
        gap: 16
    },
    optionBtnSecondary: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9',
        gap: 16
    },
    optionIconContainer: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: '#e2e8f0'
    },
    optionIconContainerSec: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: '#f8fafc',
        alignItems: 'center', justifyContent: 'center',
    },
    optionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    optionDesc: { fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 16 },
    optionTitleSec: { fontSize: 16, fontWeight: '600', color: '#475569' },
    optionDescSec: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

    // Ingredients List (Enhanced)
    ingredientsSection: { marginTop: 16, maxHeight: 150 },
    ingredientsList: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12 },
    ingredientRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
        borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 6, paddingTop: 2,
        paddingHorizontal: 4, borderRadius: 6
    },
    ingName: { fontSize: 13, color: '#475569', flex: 1, marginRight: 8 },
    ingInputContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ingInput: {
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6,
        width: 60, height: 28, textAlign: 'center', fontSize: 13, color: '#334155', padding: 0
    },
    ingInputContainer: {
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6,
        width: 60, height: 28, padding: 0
    },
    ingInputText: {
        textAlign: 'center', fontSize: 13, color: '#334155',
    },
    ingUnit: { fontSize: 11, color: '#64748b', width: 40 },
});
