import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    Platform,
    ScrollView
} from 'react-native';
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

    // Safe Macros Access
    const baseMacros = useMemo(() => recipe?.nutrients || { kcal: 0, protein: 0, carbs: 0, fat: 0 }, [recipe]);

    // Calculate Scaled Macros
    const scaledMacros = useMemo(() => {
        const mul = parseFloat(factor) || 0;
        return {
            kcal: Math.round(baseMacros.kcal * mul),
            protein: Math.round(baseMacros.protein * mul * 10) / 10,
            carbs: Math.round(baseMacros.carbs * mul * 10) / 10,
            fat: Math.round(baseMacros.fat * mul * 10) / 10,
        };
    }, [baseMacros, factor]);

    // Handle Quick Factor Buttons
    const setFactorValue = (val) => setFactor(String(val));

    // Handle Add (Block Mode)
    const handleAddBlock = () => {
        const mul = parseFloat(factor) || 1;
        if (mul <= 0) return;

        // Create a single item (The Recipe itself) with scaled values
        const blockItem = {
            ...recipe,
            isBlock: true, // Marker
            // Scale the "amount" representation if needed, usually we just keep 1 unit of recipe but scaled nutrients?
            // Actually, in the plan, usually we store portions. 
            // If the recipe is "1 Bowl", scaling 1.5 means "1.5 Bowls".
            // So we set amount = 1.5, unit = "ración" (or whatever usage unit it has)
            // But for macros, the system usually recalculates from base. 
            // To ensure compatibility, we should return the Item with the *Correct Quantity*.
            // If the base recipe is 1 serving = 100g (unlikely for recipes).
            // Recipes usually have servingSize. 
            // Let's assume we treat it as "1.0 x Recipe".

            // For the callback structure expected by SmartFoodDrawer:
            // { food, amount, unit, calculatedMacros }

            // We pass the RAW food, and the amount = factor.
        };

        onAdd([
            {
                food: recipe,
                amount: mul,
                unit: recipe.servingSize?.unit || 'ración',
                calculatedMacros: scaledMacros
            }
        ], 'block');
    };

    // Handle Add (Explode Mode)
    const handleAddExplode = () => {
        const mul = parseFloat(factor) || 1;
        if (mul <= 0) return;

        // Iterate ingredients
        if (!recipe.ingredients || recipe.ingredients.length === 0) {
            // Fallback to block if no ingredients (shouldn't happen for valid recipes)
            handleAddBlock();
            return;
        }

        const explodedItems = recipe.ingredients.map(ing => {
            // ing structure: { item: FoodItem, quantity: number, unit: string, cachedName... }
            // We need to return an array of { food, amount, unit, calculatedMacros }

            // Reconstruct the "Food" object from the ingredient
            // Use cached data to ensure robustness
            const foodItem = {
                _id: ing.item?._id || ing.item, // Handle populated vs unpopulated
                name: ing.cachedName || ing.item?.name || 'Ingrediente desconocido',
                nutrients: ing.cachedMacros || ing.item?.nutrients || {},
                // Carry over other props if available
                image: ing.item?.image,
                brand: ing.item?.brand
            };

            const baseQty = parseFloat(ing.quantity) || 0;
            const scaledQty = baseQty * mul;

            // Calculate macros for this specific ingredient portion
            // Assuming cachedMacros are per 100g (standard)
            // Formula: (Qty / 100) * Per100
            const ratio = scaledQty / 100;
            const itemMacros = {
                kcal: (foodItem.nutrients.kcal || 0) * ratio,
                protein: (foodItem.nutrients.protein || 0) * ratio,
                carbs: (foodItem.nutrients.carbs || 0) * ratio,
                fat: (foodItem.nutrients.fat || 0) * ratio,
            };

            return {
                food: foodItem,
                amount: scaledQty,
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

                            <TextInput
                                style={styles.factorInput}
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
                                <Text style={styles.macroValue}>{Math.round(scaledMacros.kcal)}</Text>
                            </View>
                            <View style={styles.macroCol}>
                                <Text style={[styles.macroLabel, { color: '#3b82f6' }]}>Prot</Text>
                                <Text style={styles.macroValue}>{Math.round(scaledMacros.protein)}</Text>
                            </View>
                            <View style={styles.macroCol}>
                                <Text style={[styles.macroLabel, { color: '#22c55e' }]}>Carb</Text>
                                <Text style={styles.macroValue}>{Math.round(scaledMacros.carbs)}</Text>
                            </View>
                            <View style={styles.macroCol}>
                                <Text style={[styles.macroLabel, { color: '#f59e0b' }]}>Grasa</Text>
                                <Text style={styles.macroValue}>{Math.round(scaledMacros.fat)}</Text>
                            </View>
                        </View>

                        {/* 3. ACTIONS FORK */}
                        <Text style={[styles.label, { marginTop: 24 }]}>Modo de Asignación</Text>
                        <View style={styles.actionsBranch}>

                            {/* Option A: BLOCK */}
                            <TouchableOpacity style={styles.optionBtnPrimary} onPress={handleAddBlock}>
                                <View style={styles.optionIconContainer}>
                                    <Text style={{ fontSize: 24 }}>📦</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.optionTitle}>Añadir como Bloque</Text>
                                    <Text style={styles.optionDesc}>
                                        Añade "{recipe.name}" como un solo ítem. Ideal para ocultar la receta exacta.
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Option B: EXPLODE */}
                            <TouchableOpacity style={styles.optionBtnSecondary} onPress={handleAddExplode}>
                                <View style={styles.optionIconContainerSec}>
                                    <Text style={{ fontSize: 24 }}>📝</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.optionTitleSec}>Desglosar Ingredientes</Text>
                                    <Text style={styles.optionDescSec}>
                                        Añade {recipe.ingredients?.length || 0} ingredientes por separado, escalados x{factor}.
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
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
});
