import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StagingIdentityCard from './StagingIdentityCard';
import FoodCreatorModal from '../../../../components/FoodCreatorModal';
import { useAlert } from '../../../../src/hooks/useAlert';
import { useStableWindowDimensions } from '../../../../src/hooks/useStableBreakpoint';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

export default function DietStagingModal({ visible, onClose, plan, onConfirm, isSaving }) {
    if (!plan) return null;

    const { width } = useStableWindowDimensions();
    const isWeb = width > 768;
    const { showAlert } = useAlert();

    const [activeDayId, setActiveDayId] = useState(null);
    const [editedPlan, setEditedPlan] = useState(null);

    // FoodCreatorModal state
    const [creatorModalVisible, setCreatorModalVisible] = useState(false);
    const [creatorContext, setCreatorContext] = useState(null);
    const [creatorInitialData, setCreatorInitialData] = useState(null);

    // Auto-image state
    const [isAutoFetchingImages, setIsAutoFetchingImages] = useState(false);
    const [imageFetchProgress, setImageFetchProgress] = useState({ current: 0, total: 0 });

    // Inline confirmation dialog (instead of nested modal)
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Initialize plan state for editing
    useEffect(() => {
        if (plan?.dayTemplates?.length > 0) {
            setActiveDayId(0);
            setEditedPlan(structuredClone(plan));
        }
    }, [plan]);

    // Helper: Calculate Stats based on matchConfidence (0-1)
    const stats = useMemo(() => {
        const s = { green: 0, yellow: 0, red: 0, total: 0, hasBlockingError: false, missingImages: 0 };
        const sourcePlan = editedPlan || plan;
        if (!sourcePlan?.dayTemplates) return s;

        sourcePlan.dayTemplates.forEach(day => {
            day.meals?.forEach(meal => {
                const options = meal.options || (meal.ingredients ? [{ ingredients: meal.ingredients }] : []);

                options.forEach(option => {
                    option.ingredients?.forEach(ing => {
                        s.total++;
                        const confidence = ing.matchConfidence ?? 0.5;

                        // Count missing images
                        if (!ing.image && !ing.photo) {
                            s.missingImages++;
                        }

                        if (ing.validationWarning) {
                            s.red++;
                            s.hasBlockingError = true;
                        } else if (confidence >= 0.8) {
                            s.green++;
                        } else if (confidence >= 0.5) {
                            s.yellow++;
                        } else {
                            s.red++;
                        }
                    });
                });
            });
        });
        return s;
    }, [editedPlan, plan]);

    // Handler: Update ingredient in edited plan
    const handleIngredientUpdate = (dayIdx, mealIdx, optIdx, ingIdx, updatedIngredient) => {
        if (!editedPlan) return;

        const newPlan = structuredClone(editedPlan);
        const meal = newPlan.dayTemplates[dayIdx].meals[mealIdx];
        const options = meal.options || [{ ingredients: meal.ingredients }];
        options[optIdx].ingredients[ingIdx] = updatedIngredient;

        if (!meal.options) {
            meal.ingredients = options[0].ingredients;
        } else {
            meal.options = options;
        }

        setEditedPlan(newPlan);
    };

    // Get current day data
    const currentDay = (editedPlan || plan).dayTemplates?.[activeDayId] || (editedPlan || plan).dayTemplates?.[0];

    // Handler: Confirm with edited plan
    const handleConfirm = () => {
        console.log('[DietStaging] handleConfirm called');
        console.log('[DietStaging] hasBlockingError:', stats.hasBlockingError);

        if (stats.hasBlockingError) {
            // Show inline confirmation dialog (not nested modal)
            setShowConfirmDialog(true);
        } else {
            console.log('[DietStaging] No blocking errors, calling onConfirm');
            onConfirm(editedPlan || plan);
        }
    };

    // Handler: Force confirm with errors
    const handleForceConfirm = () => {
        console.log('[DietStaging] User confirmed import with errors');
        setShowConfirmDialog(false);
        onConfirm(editedPlan || plan);
    };

    // ============ AUTO-FETCH IMAGES FOR ALL MISSING ============
    const handleAutoFetchImages = async () => {
        if (!editedPlan) return;

        // Collect all ingredients without images
        const missingImageItems = [];
        editedPlan.dayTemplates.forEach((day, dayIdx) => {
            day.meals?.forEach((meal, mealIdx) => {
                const options = meal.options || [{ ingredients: meal.ingredients }];
                options.forEach((option, optIdx) => {
                    option.ingredients?.forEach((ing, ingIdx) => {
                        if (!ing.image && !ing.photo && ing.name) {
                            missingImageItems.push({
                                dayIdx,
                                mealIdx,
                                optIdx,
                                ingIdx,
                                name: ing.name
                            });
                        }
                    });
                });
            });
        });

        if (missingImageItems.length === 0) {
            showAlert('✅ Todo listo', 'Todos los alimentos ya tienen imagen.');
            return;
        }

        // Run directly without confirmation - faster UX
        console.log(`[Auto-Images] Starting batch for ${missingImageItems.length} items`);
        fetchImagesForItems(missingImageItems);
    };

    const fetchImagesForItems = async (items) => {
        setIsAutoFetchingImages(true);
        setImageFetchProgress({ current: 0, total: items.length });

        const token = await AsyncStorage.getItem('totalgains_token');
        const newPlan = structuredClone(editedPlan);
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            setImageFetchProgress({ current: i + 1, total: items.length });

            try {
                const response = await fetch(`${API_URL}/api/foods/ai-image`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ foodName: item.name, index: 0 })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && (data.image?.url || data.image?.dataUrl)) {
                        // Update the ingredient in the plan
                        const meal = newPlan.dayTemplates[item.dayIdx].meals[item.mealIdx];
                        const options = meal.options || [{ ingredients: meal.ingredients }];
                        options[item.optIdx].ingredients[item.ingIdx].image = data.image.dataUrl || data.image.url;

                        if (!meal.options) {
                            meal.ingredients = options[0].ingredients;
                        } else {
                            meal.options = options;
                        }

                        successCount++;
                    } else {
                        failCount++;
                    }
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`Error fetching image for ${item.name}:`, error);
                failCount++;
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        setEditedPlan(newPlan);
        setIsAutoFetchingImages(false);
        setImageFetchProgress({ current: 0, total: 0 });

        showAlert(
            '🖼️ Imágenes completadas',
            `✅ ${successCount} imágenes encontradas\n❌ ${failCount} sin resultados`
        );
    };

    // ============ OPEN FOOD CREATOR MODAL ============
    const handleEditFood = (ingredient, dayIdx, mealIdx, optIdx, ingIdx) => {
        setCreatorContext({ dayIdx, mealIdx, optIdx, ingIdx, mode: 'edit' });

        setCreatorInitialData({
            _id: ingredient.sourceId,
            name: ingredient.name || '',
            brand: ingredient.brand || '',
            image: ingredient.image || ingredient.photo || '',
            tags: ingredient.tags || [],
            isComposite: ingredient.isRecipe || ingredient.isComposite || false,
            nutrients: ingredient.nutrients || { kcal: 0, protein: 0, carbs: 0, fat: 0 },
            servingSize: {
                unit: ingredient.unit || 'g',
                weight: ingredient.amount || ingredient.qty || 100
            },
            ingredients: ingredient.subIngredients?.map(sub => ({
                item: { _id: sub.sourceId, name: sub.name, nutrients: sub.nutrients, image: sub.image },
                quantity: String(sub.amount || sub.qty || 100),
                unit: sub.unit || 'g',
                cachedName: sub.name
            })) || []
        });

        setCreatorModalVisible(true);
    };

    const handleCreateRecipeFromOption = (optionName, ingredients, dayIdx, mealIdx, optIdx) => {
        setCreatorContext({
            dayIdx,
            mealIdx,
            optIdx,
            mode: 'recipe',
            originalIngredients: ingredients
        });

        setCreatorInitialData({
            name: optionName || 'Nueva Receta',
            isComposite: true,
            ingredients: ingredients.map(ing => ({
                item: {
                    _id: ing.sourceId,
                    name: ing.name,
                    nutrients: ing.nutrients,
                    image: ing.image
                },
                quantity: String(ing.amount || ing.qty || 100),
                unit: ing.unit || 'g',
                cachedName: ing.name
            }))
        });

        setCreatorModalVisible(true);
    };

    // Handler: Delete individual ingredient
    const handleDeleteIngredient = (dayIdx, mealIdx, optIdx, ingIdx) => {
        if (!editedPlan) return;

        const newPlan = structuredClone(editedPlan);
        const meal = newPlan.dayTemplates[dayIdx].meals[mealIdx];
        const options = meal.options || [{ ingredients: meal.ingredients }];

        // Remove the ingredient at ingIdx
        options[optIdx].ingredients = options[optIdx].ingredients.filter((_, idx) => idx !== ingIdx);

        if (!meal.options) {
            meal.ingredients = options[0].ingredients;
        } else {
            meal.options = options;
        }

        setEditedPlan(newPlan);
    };

    const handleCreatorSave = (foodData) => {
        if (!editedPlan || !creatorContext) return;

        const { dayIdx, mealIdx, optIdx, ingIdx, mode, originalIngredients } = creatorContext;
        const newPlan = structuredClone(editedPlan);
        const meal = newPlan.dayTemplates[dayIdx].meals[mealIdx];
        const options = meal.options || [{ ingredients: meal.ingredients }];

        if (mode === 'recipe') {
            // Build the recipe item with all ingredients from the modal
            const recipeItem = {
                name: foodData.name,
                image: foodData.image,
                isRecipe: true,
                isComposite: true,
                sourceType: 'AI_GENERATED',
                matchConfidence: 0.9,
                matchMethod: 'created',
                amount: foodData.servingSize?.weight || 1,
                unit: foodData.servingSize?.unit || 'ración',
                nutrients: foodData.nutrients,
                subIngredients: foodData.ingredients?.map(ing => ({
                    name: ing.cachedName || ing.item?.name || ing.name || 'Ingrediente',
                    amount: parseFloat(ing.quantity) || parseFloat(ing.amount) || 100,
                    unit: ing.unit || 'g',
                    nutrients: ing.cachedNutrients || ing.item?.nutrients || ing.nutrients || {},
                    image: ing.cachedImage || ing.item?.image || ing.image || null,
                    sourceType: ing.item?.sourceType || ing.sourceType || 'DB_CLOUD'
                })) || []
            };

            console.log('[Recipe] Created recipe with', recipeItem.subIngredients.length, 'subIngredients');

            // Get the names of ingredients used in the recipe
            const usedIngredientNames = new Set(
                foodData.ingredients?.map(ing =>
                    (ing.cachedName || ing.item?.name || ing.name || '').toLowerCase()
                ) || []
            );

            // Keep ingredients that were NOT used in the recipe
            const currentIngredients = options[optIdx].ingredients || [];
            const unusedIngredients = currentIngredients.filter(ing => {
                const ingName = (ing.name || '').toLowerCase();
                return !usedIngredientNames.has(ingName);
            });

            // Replace with recipe + unused ingredients
            options[optIdx].ingredients = [recipeItem, ...unusedIngredients];

            const unusedCount = unusedIngredients.length;
            showAlert(
                '✅ Receta Creada',
                `"${foodData.name}" agrupa ${recipeItem.subIngredients.length} ingredientes.${unusedCount > 0 ? `\n${unusedCount} alimento(s) no usados se mantienen en la opción.` : ''}`
            );
        } else if (typeof ingIdx === 'number') {
            const existingIng = options[optIdx].ingredients[ingIdx];

            options[optIdx].ingredients[ingIdx] = {
                ...existingIng,
                name: foodData.name,
                image: foodData.image,
                nutrients: foodData.nutrients,
                amount: foodData.servingSize?.weight || existingIng.amount,
                unit: foodData.servingSize?.unit || existingIng.unit,
                isRecipe: foodData.isComposite,
                isComposite: foodData.isComposite,
                subIngredients: foodData.ingredients?.map(ing => ({
                    name: ing.item?.name || ing.cachedName,
                    amount: parseFloat(ing.quantity) || 100,
                    unit: ing.unit || 'g',
                    nutrients: ing.item?.nutrients,
                    image: ing.item?.image
                })) || existingIng.subIngredients,
                matchConfidence: 0.95,
                sourceType: existingIng.sourceType
            };
        }

        if (!meal.options) {
            meal.ingredients = options[0].ingredients;
        } else {
            meal.options = options;
        }

        setEditedPlan(newPlan);
        setCreatorModalVisible(false);
        setCreatorInitialData(null);
        setCreatorContext(null);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Revisión de Dieta IA</Text>
                        <Text style={styles.subtitle}>Verifica los alimentos antes de importar</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {/* Stats Bar */}
                <View style={styles.statsBar}>
                    <View style={styles.statItem}>
                        <View style={[styles.statDot, { backgroundColor: '#22c55e' }]} />
                        <Text style={[styles.statValue, { color: '#22c55e' }]}>{stats.green}</Text>
                        <Text style={styles.statLabel}>Verificados</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statItem}>
                        <View style={[styles.statDot, { backgroundColor: '#f59e0b' }]} />
                        <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.yellow}</Text>
                        <Text style={styles.statLabel}>Revisar</Text>
                    </View>
                    {stats.red > 0 && (
                        <>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <View style={[styles.statDot, { backgroundColor: '#ef4444' }]} />
                                <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.red}</Text>
                                <Text style={styles.statLabel}>Atención</Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Legend + Auto-Image Bar */}
                <View style={styles.legendBar}>
                    <View style={styles.legendItem}>
                        <MaterialCommunityIcons name="database" size={14} color="#3b82f6" />
                        <Text style={styles.legendText}>Base de Datos</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <MaterialCommunityIcons name="robot" size={14} color="#f59e0b" />
                        <Text style={styles.legendText}>Generado IA</Text>
                    </View>

                    {/* AUTO-FETCH IMAGES BUTTON */}
                    {stats.missingImages > 0 && (
                        <TouchableOpacity
                            style={styles.autoImageBtn}
                            onPress={handleAutoFetchImages}
                            disabled={isAutoFetchingImages}
                        >
                            {isAutoFetchingImages ? (
                                <>
                                    <ActivityIndicator size="small" color="#8b5cf6" />
                                    <Text style={styles.autoImageBtnText}>
                                        {imageFetchProgress.current}/{imageFetchProgress.total}
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="images" size={14} color="#8b5cf6" />
                                    <Text style={styles.autoImageBtnText}>
                                        🖼️ Auto-imágenes ({stats.missingImages})
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Day Tabs */}
                {(editedPlan || plan).dayTemplates?.length > 1 && (
                    <View style={styles.tabsContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
                            {(editedPlan || plan).dayTemplates.map((day, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.tab, activeDayId === index && styles.tabActive]}
                                    onPress={() => setActiveDayId(index)}
                                >
                                    <Text style={[styles.tabText, activeDayId === index && styles.tabTextActive]}>
                                        {day.name || `Día ${index + 1}`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Content */}
                <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
                    {currentDay && (
                        <View style={styles.daySection}>
                            {(editedPlan || plan).dayTemplates.length <= 1 && (
                                <View style={styles.dayHeader}>
                                    <Text style={styles.dayTitle}>{currentDay.name || 'Plan General'}</Text>
                                </View>
                            )}

                            {currentDay.meals?.map((meal, mealIndex) => {
                                const options = meal.options?.length > 0
                                    ? meal.options
                                    : (meal.ingredients ? [{ name: 'Única Opción', ingredients: meal.ingredients }] : []);

                                return (
                                    <View key={mealIndex} style={styles.mealSection}>
                                        <View style={styles.mealHeader}>
                                            <Ionicons name="restaurant-outline" size={18} color="#64748b" />
                                            <Text style={styles.mealTitle}>{meal.name}</Text>
                                            {meal.time && <Text style={styles.mealTime}>{meal.time}</Text>}
                                        </View>

                                        {options.map((option, optIndex) => {
                                            const hasMultipleIngredients = (option.ingredients?.length || 0) > 1;
                                            const optionName = option.name || `Opción ${optIndex + 1}`;

                                            return (
                                                <View key={optIndex} style={styles.optionBlock}>
                                                    <View style={styles.optionHeader}>
                                                        <Text style={styles.optionTitle}>{optionName}</Text>

                                                        {hasMultipleIngredients && (
                                                            <TouchableOpacity
                                                                style={styles.createRecipeBtn}
                                                                onPress={() => handleCreateRecipeFromOption(
                                                                    optionName,
                                                                    option.ingredients,
                                                                    activeDayId,
                                                                    mealIndex,
                                                                    optIndex
                                                                )}
                                                            >
                                                                <Ionicons name="restaurant" size={14} color="#8b5cf6" />
                                                                <Text style={styles.createRecipeBtnText}>Crear Receta</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>

                                                    <View style={isWeb ? styles.ingredientsGrid : null}>
                                                        {option.ingredients?.map((ing, ingIndex) => (
                                                            <StagingIdentityCard
                                                                key={ingIndex}
                                                                ingredient={ing}
                                                                isWeb={isWeb}
                                                                onPress={() => handleEditFood(
                                                                    ing,
                                                                    activeDayId,
                                                                    mealIndex,
                                                                    optIndex,
                                                                    ingIndex
                                                                )}
                                                                onUpdate={(updated) => handleIngredientUpdate(activeDayId, mealIndex, optIndex, ingIndex, updated)}
                                                                onDelete={() => handleDeleteIngredient(activeDayId, mealIndex, optIndex, ingIndex)}
                                                            />
                                                        ))}
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    {stats.hasBlockingError && (
                        <View style={styles.warningBanner}>
                            <Ionicons name="warning" size={16} color="#ef4444" />
                            <Text style={styles.warningBannerText}>Hay errores de validación</Text>
                        </View>
                    )}
                    <TouchableOpacity
                        style={[
                            styles.confirmBtn,
                            isSaving && { opacity: 0.7 },
                            stats.hasBlockingError && styles.confirmBtnWarning
                        ]}
                        onPress={handleConfirm}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="save-outline" size={20} color="#fff" />
                                <Text style={styles.confirmText}>
                                    {stats.hasBlockingError ? 'Importar con Advertencias' : 'Confirmar e Importar'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* INLINE CONFIRMATION DIALOG */}
                {showConfirmDialog && (
                    <View style={styles.confirmDialogOverlay}>
                        <View style={styles.confirmDialogBox}>
                            <Ionicons name="warning" size={40} color="#f59e0b" style={{ marginBottom: 12 }} />
                            <Text style={styles.confirmDialogTitle}>Errores de Validación</Text>
                            <Text style={styles.confirmDialogMessage}>
                                Hay {stats.red} ingrediente(s) con errores críticos. ¿Importar de todos modos?
                            </Text>
                            <View style={styles.confirmDialogButtons}>
                                <TouchableOpacity
                                    style={[styles.confirmDialogBtn, styles.confirmDialogBtnCancel]}
                                    onPress={() => setShowConfirmDialog(false)}
                                >
                                    <Text style={styles.confirmDialogBtnTextCancel}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.confirmDialogBtn, styles.confirmDialogBtnConfirm]}
                                    onPress={handleForceConfirm}
                                >
                                    <Text style={styles.confirmDialogBtnText}>Importar Igualmente</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </SafeAreaView>

            {/* FOOD CREATOR MODAL */}
            <FoodCreatorModal
                visible={creatorModalVisible}
                onClose={() => {
                    setCreatorModalVisible(false);
                    setCreatorInitialData(null);
                    setCreatorContext(null);
                }}
                onSave={handleCreatorSave}
                initialData={creatorInitialData}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 2,
    },
    closeBtn: {
        padding: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
    },
    statsBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    divider: {
        width: 1,
        height: 20,
        backgroundColor: '#e2e8f0',
    },
    legendBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        flexWrap: 'wrap',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendText: {
        fontSize: 11,
        color: '#64748b',
    },
    autoImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f5f3ff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ddd6fe',
    },
    autoImageBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8b5cf6',
    },
    tabsContainer: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tabsContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    tab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
    },
    tabActive: {
        backgroundColor: '#3b82f6',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    tabTextActive: {
        color: '#fff',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    daySection: {
        marginBottom: 24,
    },
    dayHeader: {
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#3b82f6',
        paddingLeft: 10,
    },
    dayTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    mealSection: {
        marginBottom: 16,
    },
    mealHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        paddingTop: 8,
        gap: 8,
    },
    mealTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#334155',
        flex: 1,
    },
    mealTime: {
        fontSize: 13,
        color: '#94a3b8',
    },
    optionBlock: {
        marginBottom: 12,
        paddingLeft: 8,
        borderLeftWidth: 2,
        borderLeftColor: '#e2e8f0',
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
        marginTop: 4,
    },
    optionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        flex: 1,
    },
    createRecipeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f5f3ff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd6fe',
    },
    createRecipeBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8b5cf6',
    },
    ingredientsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingBottom: 40,
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
        padding: 8,
        backgroundColor: '#fee2e2',
        borderRadius: 8,
    },
    warningBannerText: {
        color: '#ef4444',
        fontWeight: '600',
        fontSize: 13,
    },
    confirmBtn: {
        backgroundColor: '#22c55e',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 14,
        gap: 8,
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmBtnWarning: {
        backgroundColor: '#f59e0b',
        shadowColor: '#f59e0b',
    },
    confirmText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    // Inline confirmation dialog styles
    confirmDialogOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    confirmDialogBox: {
        backgroundColor: '#1f2937',
        borderRadius: 16,
        padding: 24,
        width: '90%',
        maxWidth: 400,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    confirmDialogTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    confirmDialogMessage: {
        fontSize: 15,
        color: '#9ca3af',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 22,
    },
    confirmDialogButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    confirmDialogBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        minWidth: 120,
        alignItems: 'center',
    },
    confirmDialogBtnCancel: {
        backgroundColor: '#374151',
    },
    confirmDialogBtnConfirm: {
        backgroundColor: '#ef4444',
    },
    confirmDialogBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    confirmDialogBtnTextCancel: {
        color: '#9ca3af',
        fontWeight: '600',
        fontSize: 14,
    },
});
