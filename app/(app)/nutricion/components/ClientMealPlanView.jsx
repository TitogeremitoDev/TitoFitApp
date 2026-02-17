/* app/(app)/nutricion/components/ClientMealPlanView.jsx */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity, ActivityIndicator, Platform, Alert, Modal, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useMealTracking } from '../../../../src/context/MealTrackingContext';
import { useTheme } from '../../../../context/ThemeContext';
import { useAuth } from '../../../../context/AuthContext';
import { useCoachBranding } from '../../../../context/CoachBrandingContext';
import { generateAndShareNutritionPDF } from '../../../../src/services/pdfGenerator';

import { getRecipePlaceholder } from '../../../../src/utils/recipePlaceholder';

// Components
import NutritionHeaderTabs from './NutritionHeaderTabs';
import ClientWeeklyOverview from './ClientWeeklyOverview';
import ShoppingListScreen from './ShoppingListScreen';
import DailyMealList from './DailyMealList';
import RecipeWalkthroughModal from './RecipeWalkthroughModal';
import { getContrastColor } from '../../../../utils/colors';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

const ClientMealPlanView = ({ plan, todayTarget: initialTodayTarget, theme, user, clientSettings, coachInfo }) => {
    const { isMealCompleted, getDailyProgress, toggleMealCompletion } = useMealTracking();
    const { branding: coachBrandingCtx, activeTheme: activeCoachTheme } = useCoachBranding();
    const [activeTab, setActiveTab] = useState('TODAY'); // TODAY, WEEK, SHOPPING
    const [selectedOptions, setSelectedOptions] = useState({}); // { [mealId]: optionIndex }

    // Recipe Modal State
    const [recipeModalVisible, setRecipeModalVisible] = useState(false);
    const [activeRecipe, setActiveRecipe] = useState(null);
    const [activeRecipeMealId, setActiveRecipeMealId] = useState(null); // To toggle complete

    // PDF Export State
    const [isExporting, setIsExporting] = useState(false);

    // 📸 Meal Photo State
    const [mealPhotoModalVisible, setMealPhotoModalVisible] = useState(false);
    const [selectedMealForPhoto, setSelectedMealForPhoto] = useState(null);
    const [uploadingMealPhoto, setUploadingMealPhoto] = useState(false);

    // 📱 Story Share State
    const [storyModalVisible, setStoryModalVisible] = useState(false);
    const [storyPhotoUri, setStoryPhotoUri] = useState(null);
    const [storyMealName, setStoryMealName] = useState('');
    const storyViewRef = useRef(null);

    const { token } = useAuth();


    const hideMacros = clientSettings?.hideMacros || false;
    const dateKey = new Date().toISOString().split('T')[0];

    // --- PDF EXPORT HANDLER ---
    const handleExportPDF = async () => {
        if (isExporting) return;

        setIsExporting(true);
        try {
            // Use coachInfo from API (has nombre, logoUrl, brandColor)
            const coachBranding = {
                primaryColor: activeCoachTheme?.colors?.primary || coachInfo?.brandColor || theme?.primary || '#3b82f6',
                secondaryColor: activeCoachTheme?.colors?.secondary || coachInfo?.brandColor || theme?.primary || '#3b82f6',
                fontFamily: coachBrandingCtx?.fontFamily || 'System',
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

    // --- 📸 MEAL PHOTO HANDLERS ---
    const handleMealPhoto = useCallback((meal, activeOptionIdx, mealIndex) => {
        const rawOptions = meal.options || [];
        const activeOption = rawOptions[activeOptionIdx] || rawOptions[0];
        // Extraer lista de alimentos de la opción activa
        const foods = (activeOption?.foods || []).map(f => ({
            name: f.name,
            amount: f.amount,
            unit: f.unit,
        }));
        setSelectedMealForPhoto({
            mealName: meal.name || `Comida ${mealIndex + 1}`,
            mealIndex: mealIndex,
            optionName: activeOption?.name || null,
            foods,
            date: new Date().toISOString(),
        });
        setMealPhotoModalVisible(true);
    }, []);

    const showStoryPrompt = useCallback((photoUri, mealName) => {
        setStoryPhotoUri(photoUri);
        setStoryMealName(mealName || '');
        setStoryModalVisible(true);
    }, []);

    const handleShareToStories = useCallback(async () => {
        try {
            if (!storyViewRef.current) return;
            const uri = await storyViewRef.current.capture();

            const available = await Sharing.isAvailableAsync();
            if (!available) {
                Alert.alert('Error', 'Compartir no está disponible en este dispositivo.');
                return;
            }
            await Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                dialogTitle: 'Compartir en Stories',
            });
            setStoryModalVisible(false);
        } catch (error) {
            console.error('[Story] Share error:', error);
            Alert.alert('Error', 'No se pudo compartir la imagen.');
        }
    }, []);

    const handleOpenMealCamera = useCallback(async () => {
        setMealPhotoModalVisible(false);
        // Wait for modal to fully dismiss before presenting camera (iOS requirement)
        await new Promise(resolve => setTimeout(resolve, 500));
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permisos', 'Se necesitan permisos para usar la cámara.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
            allowsEditing: false,
        });
        if (result.canceled || !result.assets?.length) return;
        const photoUri = result.assets[0].uri;
        setUploadingMealPhoto(true);
        const ok = await uploadMealPhotoToBackend(photoUri, selectedMealForPhoto);
        setUploadingMealPhoto(false);
        if (ok) {
            showStoryPrompt(photoUri, selectedMealForPhoto?.mealName);
        } else {
            Alert.alert('Error', 'No se pudo subir la foto.');
        }
    }, [selectedMealForPhoto, uploadMealPhotoToBackend, showStoryPrompt]);

    const uploadMealPhotoToBackend = useCallback(async (photoUri, mealInfo) => {
        if (!token) return false;
        try {
            // Step 1: Prepare upload
            const prepRes = await fetch(`${API_URL}/api/progress-photos/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    category: 'nutrition',
                    mealInfo,
                    visibility: 'coach_only',
                    tags: [],
                    takenAt: new Date().toISOString(),
                }),
            });
            const prepData = await prepRes.json();
            if (!prepData.success) throw new Error(prepData.message);

            // Step 2: Upload to R2
            const blob = await fetch(photoUri).then(r => r.blob());
            await fetch(prepData.uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'image/jpeg' },
            });

            // Step 3: Confirm
            await fetch(`${API_URL}/api/progress-photos/${prepData.photoId}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });

            return true;
        } catch (error) {
            console.error('[MealPhoto] Upload error:', error);
            return false;
        }
    }, [token]);

    const handlePickMealPhotos = useCallback(async () => {
        setMealPhotoModalVisible(false);
        // Wait for modal to fully dismiss before presenting picker (iOS requirement)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Permission check for Android
        if (Platform.OS === 'android') {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permisos', 'Se necesitan permisos para acceder a la galería.');
                return;
            }
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.8,
            allowsEditing: false,
        });

        if (result.canceled || !result.assets?.length) return;

        setUploadingMealPhoto(true);
        let successCount = 0;

        for (const asset of result.assets) {
            const ok = await uploadMealPhotoToBackend(asset.uri, selectedMealForPhoto);
            if (ok) successCount++;
        }

        setUploadingMealPhoto(false);

        if (successCount > 0) {
            // Show story prompt with the first photo
            showStoryPrompt(result.assets[0].uri, selectedMealForPhoto?.mealName);
        } else {
            Alert.alert('Error', 'No se pudieron subir las fotos. Inténtalo de nuevo.');
        }
    }, [selectedMealForPhoto, uploadMealPhotoToBackend, showStoryPrompt]);

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
                        onMealPhoto={handleMealPhoto}
                        trackingDate={dateKey}
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

            {/* 📸 MEAL PHOTO MODAL */}
            <Modal
                visible={mealPhotoModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMealPhotoModalVisible(false)}
            >
                <View style={photoStyles.modalOverlay}>
                    <View style={[photoStyles.modalContent, { backgroundColor: theme.cardBackground }]}>
                        <TouchableOpacity
                            style={photoStyles.modalClose}
                            onPress={() => setMealPhotoModalVisible(false)}
                        >
                            <Ionicons name="close-circle" size={32} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <Text style={photoStyles.modalEmoji}>📸</Text>
                        <Text style={[photoStyles.modalTitle, { color: theme.text }]}>
                            Foto de comida
                        </Text>
                        <Text style={[photoStyles.modalText, { color: theme.textSecondary }]}>
                            {selectedMealForPhoto?.mealName
                                ? `Sube una foto de "${selectedMealForPhoto.mealName}"`
                                : 'Sube una foto de tu comida'}
                        </Text>

                        {Platform.OS !== 'web' && (
                            <TouchableOpacity
                                style={[photoStyles.modalBtn, { backgroundColor: theme.primary }]}
                                onPress={handleOpenMealCamera}
                            >
                                <Ionicons name="camera-outline" size={20} color="#FFF" />
                                <Text style={photoStyles.modalBtnText}>Hacer foto</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[photoStyles.modalBtn, { backgroundColor: '#6366f1' }]}
                            onPress={handlePickMealPhotos}
                        >
                            <Ionicons name="images-outline" size={20} color="#FFF" />
                            <Text style={photoStyles.modalBtnText}>Seleccionar de galería</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[photoStyles.modalBtn, { backgroundColor: theme.inputBackground, borderWidth: 1, borderColor: theme.inputBorder }]}
                            onPress={() => setMealPhotoModalVisible(false)}
                        >
                            <Text style={[photoStyles.modalBtnTextSecondary, { color: theme.textSecondary }]}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Upload indicator */}
            {uploadingMealPhoto && (
                <View style={photoStyles.uploadOverlay}>
                    <View style={photoStyles.uploadCard}>
                        <ActivityIndicator size="large" color="#0ea5e9" />
                        <Text style={photoStyles.uploadText}>Subiendo fotos...</Text>
                    </View>
                </View>
            )}

            {/* 📱 STORY SHARE MODAL */}
            <Modal
                visible={storyModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setStoryModalVisible(false)}
            >
                <View style={storyStyles.overlay}>
                    <View style={[storyStyles.container, { backgroundColor: theme.cardBackground }]}>
                        <TouchableOpacity
                            style={storyStyles.closeBtn}
                            onPress={() => setStoryModalVisible(false)}
                        >
                            <Ionicons name="close-circle" size={32} color={theme.textSecondary} />
                        </TouchableOpacity>

                        <Text style={[storyStyles.title, { color: theme.text }]}>
                            Foto subida correctamente
                        </Text>
                        <Text style={[storyStyles.subtitle, { color: theme.textSecondary }]}>
                            Comparte tu comida en Instagram Stories
                        </Text>

                        {/* Story Preview (captured by ViewShot) */}
                        <View style={storyStyles.previewWrapper}>
                            <ViewShot
                                ref={storyViewRef}
                                options={{ format: 'png', quality: 1, width: 1080, height: 1920 }}
                                style={storyStyles.storyCanvas}
                            >
                                {/* Background photo */}
                                {storyPhotoUri && (
                                    <Image
                                        source={{ uri: storyPhotoUri }}
                                        style={storyStyles.storyPhoto}
                                        resizeMode="cover"
                                    />
                                )}

                                {/* Dark gradient overlay at bottom */}
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                                    style={storyStyles.storyGradient}
                                />

                                {/* Top badge */}
                                <View style={storyStyles.storyTopBadge}>
                                    <Text style={storyStyles.storyTopBadgeText}>
                                        🍽️ {storyMealName || 'Mi comida'}
                                    </Text>
                                </View>

                                {/* Bottom content: message + logo */}
                                <View style={storyStyles.storyBottomContent}>
                                    <View style={storyStyles.storyTextBlock}>
                                        <Text style={storyStyles.storyMainText}>
                                            Siguiendo mi plan con{'\n'}
                                            <Text style={[storyStyles.storyCoachName, { color: coachInfo?.brandColor || '#60a5fa' }]}>
                                                {coachInfo?.nombre || 'mi entrenador'}
                                            </Text>
                                        </Text>
                                        <Text style={storyStyles.storyAppText}>
                                            Powered by TotalGains 💪
                                        </Text>
                                    </View>

                                    {/* Coach logo */}
                                    {coachInfo?.logoUrl ? (
                                        <Image
                                            source={{ uri: coachInfo.logoUrl }}
                                            style={[storyStyles.storyLogo, { borderColor: coachInfo?.brandColor || '#60a5fa' }]}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <View style={[storyStyles.storyLogoFallback, { backgroundColor: coachInfo?.brandColor || '#60a5fa' }]}>
                                            <Text style={storyStyles.storyLogoFallbackText}>
                                                {(coachInfo?.nombre || 'E').charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </ViewShot>
                        </View>

                        {/* Action buttons */}
                        <TouchableOpacity
                            style={storyStyles.shareBtn}
                            onPress={handleShareToStories}
                        >
                            <LinearGradient
                                colors={['#f09433', '#e6683c', '#dc2743', '#cc2366', '#bc1888']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={storyStyles.shareBtnGradient}
                            >
                                <Ionicons name="logo-instagram" size={22} color="#FFF" />
                                <Text style={storyStyles.shareBtnText}>Compartir en Stories</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[storyStyles.skipBtn, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}
                            onPress={() => setStoryModalVisible(false)}
                        >
                            <Text style={[storyStyles.skipBtnText, { color: theme.textSecondary }]}>
                                Ahora no
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const photoStyles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
    },
    modalClose: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
    },
    modalEmoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 8,
    },
    modalText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    modalBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 10,
    },
    modalBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
    modalBtnTextSecondary: {
        fontSize: 15,
        fontWeight: '600',
    },
    uploadOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
    uploadCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
        gap: 12,
    },
    uploadText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
    },
});

const SCREEN_WIDTH = Dimensions.get('window').width;
const PREVIEW_WIDTH = SCREEN_WIDTH - 80;
const PREVIEW_HEIGHT = PREVIEW_WIDTH * (16 / 9);

const storyStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    container: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
    },
    closeBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        marginTop: 8,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        marginBottom: 16,
    },
    previewWrapper: {
        width: PREVIEW_WIDTH,
        height: PREVIEW_HEIGHT,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    storyCanvas: {
        width: PREVIEW_WIDTH,
        height: PREVIEW_HEIGHT,
        backgroundColor: '#000',
    },
    storyPhoto: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    storyGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '45%',
    },
    storyTopBadge: {
        position: 'absolute',
        top: 16,
        left: 16,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    storyTopBadgeText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    storyBottomContent: {
        position: 'absolute',
        bottom: 20,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    storyTextBlock: {
        flex: 1,
        marginRight: 12,
    },
    storyMainText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 22,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    storyCoachName: {
        fontSize: 20,
        fontWeight: '900',
    },
    storyAppText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 6,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    storyLogo: {
        width: 56,
        height: 56,
        borderRadius: 14,
        borderWidth: 2,
    },
    storyLogoFallback: {
        width: 56,
        height: 56,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    storyLogoFallbackText: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '900',
    },
    shareBtn: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 10,
    },
    shareBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
    },
    shareBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
    },
    skipBtn: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 1,
    },
    skipBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

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
