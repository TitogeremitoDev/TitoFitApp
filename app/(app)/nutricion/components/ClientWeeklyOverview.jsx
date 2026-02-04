import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../context/ThemeContext';
import { getContrastColor } from '../../../../utils/colors';
import SupplementFooter from './supplements/SupplementFooter';

const DAY_LABELS_MAP = {
    monday: 'Lu', tuesday: 'Ma', wednesday: 'Mi', thursday: 'Ju', friday: 'Vi', saturday: 'Sá', sunday: 'Do'
};

const ClientWeeklyOverview = ({ visible, onClose, plan, hideMacros, embed = false }) => {
    const { theme } = useTheme();
    const [activeTemplateId, setActiveTemplateId] = useState(null);
    const [selectedOptions, setSelectedOptions] = useState({}); // { [mealId]: optionIndex }

    // Helpers
    const toggleOption = (mealId, index) => {
        setSelectedOptions(prev => ({ ...prev, [mealId]: index }));
    };

    // Prepare templates and usage
    const { templates, templateUsage } = useMemo(() => {
        if (!plan) return { templates: [], templateUsage: {} };

        const _templates = plan.dayTemplates || plan.customPlan?.dayTargets || [];
        const _weekMap = plan.weekMap || plan.customPlan?.weekSchedule || {};

        const _usage = {};
        Object.entries(_weekMap).forEach(([day, tId]) => {
            if (!_usage[tId]) _usage[tId] = [];
            _usage[tId].push(day);
        });

        return { templates: _templates, templateUsage: _usage };
    }, [plan]);

    React.useEffect(() => {
        if ((visible || embed) && templates.length > 0 && !activeTemplateId) {
            setActiveTemplateId(templates[0].id || templates[0]._id);
        }
    }, [visible, embed, templates]);


    if (!plan && !embed && !visible) return null;
    if (!plan) return null;

    const activeTemplate = templates.find(t => (t.id || t._id) === activeTemplateId) || templates[0];
    const orderedMeals = activeTemplate?.meals ? [...activeTemplate.meals].sort((a, b) => (a.order || 0) - (b.order || 0)) : [];

    const Content = (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header - Only render if NOT embedded, usually embedded has its own header context or doesn't need this specific one */}
            {!embed && (
                <>
                    {/* SafeArea Spacer handled by Modal usually, if embedded parent handles it */}
                    {Platform.OS === 'ios' && <View style={{ height: 48, backgroundColor: theme.background }} />}

                    <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
                        <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.inputBackground, marginRight: 16 }]}>
                            <Ionicons name="arrow-back" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: theme.text, flex: 1 }]}>Visión Semanal</Text>
                    </View>
                </>
            )}

            {/* Template Tabs (if > 1) */}
            {templates.length > 1 && (
                <View style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {templates.map((tmpl) => {
                            const tId = tmpl.id || tmpl._id;
                            const isActive = tId === activeTemplateId;
                            const days = templateUsage[tId] || [];
                            const dayStr = days.map(d => DAY_LABELS_MAP[d]).join(', ');

                            return (
                                <TouchableOpacity
                                    key={tId}
                                    onPress={() => setActiveTemplateId(tId)}
                                    style={[
                                        styles.tabBtn,
                                        isActive
                                            ? { backgroundColor: theme.primary, borderColor: theme.primary }
                                            : { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }
                                    ]}
                                >
                                    <Text style={[styles.tabTitle, { color: isActive ? getContrastColor(theme.primary) : theme.text }]}>
                                        {tmpl.name}
                                    </Text>
                                    {days.length > 0 && (
                                        <Text style={[styles.tabSubtitle, { color: isActive ? getContrastColor(theme.primary) : theme.textSecondary }]}>
                                            {dayStr}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}
            {/* Single Template Label */}
            {templates.length === 1 && (
                <View style={{ padding: 16, paddingBottom: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
                        {activeTemplate?.name} <Text style={{ fontWeight: '400', color: theme.textSecondary }}>(Todos los días)</Text>
                    </Text>
                </View>
            )}

            {/* Content: List of Meals */}
            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                {orderedMeals.map((meal, index) => {
                    const mealId = meal.id || index;
                    const activeOptionIdx = selectedOptions[mealId] || 0;
                    const activeOption = meal.options?.[activeOptionIdx] || meal.options?.[0];
                    const hasMultipels = meal.options?.length > 1;

                    // Calculate Macros
                    const activeMacros = activeOption?.foods?.reduce((acc, f) => ({
                        kcal: acc.kcal + (f.kcal || 0),
                        p: acc.p + (f.protein || 0),
                        c: acc.c + (f.carbs || 0),
                        g: acc.g + (f.fat || 0),
                    }), { kcal: 0, p: 0, c: 0, g: 0 }) || { kcal: 0, p: 0, c: 0, g: 0 };


                    return (
                        <View key={mealId} style={[styles.mealCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>

                            {/* Meal Header */}
                            <View style={[styles.mealHeader, { borderBottomColor: theme.borderLight }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={{ fontSize: 18 }}>{meal.icon || '🍽️'}</Text>
                                    <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
                                </View>
                                {!hideMacros && (
                                    <View style={[styles.mealKcalBadge, { backgroundColor: theme.inputBackground }]}>
                                        <Text style={[styles.mealKcalText, { color: theme.textSecondary }]}>{Math.round(activeMacros.kcal)} kcal</Text>
                                    </View>
                                )}
                            </View>

                            {/* Segmented Control (Scrollable Tabs) */}
                            {hasMultipels && (
                                <View>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={[styles.segmentedScroll, { backgroundColor: theme.inputBackground }]}
                                        contentContainerStyle={styles.segmentedScrollContent}
                                    >
                                        {meal.options.map((opt, i) => {
                                            const isActive = i === activeOptionIdx;
                                            return (
                                                <TouchableOpacity
                                                    key={i}
                                                    style={[styles.segmentBtn, isActive && { backgroundColor: theme.cardBackground, ...styles.shadow }]}
                                                    onPress={() => toggleOption(mealId, i)}
                                                >
                                                    <Text style={[styles.segmentText, { color: isActive ? theme.text : theme.textSecondary, fontWeight: isActive ? '600' : '400' }]}>
                                                        {opt.name || `Opción ${i + 1}`}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Selected Option Content */}
                            <View style={styles.optionContent}>

                                {/* Macros Row */}
                                {!hideMacros ? (
                                    <View style={styles.macrosRow}>
                                        <MacroBox label="CALS" value={Math.round(activeMacros.kcal)} color={theme.text} theme={theme} />
                                        <MacroBox label="PROT" value={`${Math.round(activeMacros.p)}g`} color="#3b82f6" theme={theme} />
                                        <MacroBox label="CARB" value={`${Math.round(activeMacros.c)}g`} color="#22c55e" theme={theme} />
                                        <MacroBox label="GRASA" value={`${Math.round(activeMacros.g)}g`} color="#f59e0b" theme={theme} />
                                    </View>
                                ) : (
                                    <View style={{ height: 16 }} />
                                )}

                                {/* Food List */}
                                <View style={styles.foodList}>
                                    {activeOption?.foods?.map((food, fIdx) => {
                                        const isRecipe = food.isRecipe || food.isComposite;
                                        // Resolve thumbnail
                                        let thumbUri = food.image
                                            || (typeof food.item === 'object' && food.item?.image)
                                            || (typeof food.food === 'object' && food.food?.image);

                                        // Fallback to pretty placeholders if no image
                                        if (!thumbUri) {
                                            thumbUri = getPlaceholderImage(food.name);
                                        }

                                        return (
                                            <View key={fIdx} style={[styles.foodRow, { borderBottomColor: theme.borderLight }]}>
                                                {/* Image */}
                                                <Image source={{ uri: thumbUri }} style={styles.foodThumb} />

                                                {/* Text */}
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.foodName, { color: theme.text }]}>{food.name}</Text>
                                                    <Text style={[styles.foodAmount, { color: theme.textSecondary }]}>{food.unit === 'a_gusto' ? 'libre' : `${food.amount}${food.unit}`}</Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                                    {(!activeOption?.foods?.length) && (
                                        <Text style={{ fontStyle: 'italic', color: theme.textSecondary, padding: 8 }}>Sin alimentos</Text>
                                    )}
                                </View>

                                {/* 💊 Supplements (a nivel de meal, no de option) */}
                                {meal.supplements && meal.supplements.length > 0 && (
                                    <SupplementFooter supplements={meal.supplements} showAlerts={true} />
                                )}

                            </View>

                        </View>
                    );
                })}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );

    if (embed) {
        return Content;
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            {Content}
        </Modal>
    );
};

const MacroBox = ({ label, value, color, theme }) => (
    <View style={[styles.macroBox, { backgroundColor: theme.inputBackground }]}>
        <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.macroValue, { color: color }]}>{value}</Text>
    </View>
);

const getPlaceholderImage = (name) => {
    if (!name) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'; // Generic Healthy
    const n = name.toLowerCase();

    // Fruits
    if (n.includes('manzana') || n.includes('platano') || n.includes('fruta') || n.includes('naranja') || n.includes('pera') || n.includes('fruit'))
        return 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400';

    // Vegetables / Salad
    if (n.includes('ensalada') || n.includes('lechuga') || n.includes('tomate') || n.includes('verdura') || n.includes('pepino') || n.includes('salad'))
        return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400';

    // Protein (Chicken/Meat)
    if (n.includes('pollo') || n.includes('pavo') || n.includes('carne') || n.includes('ternera') || n.includes('cerdo') || n.includes('chicken') || n.includes('meat'))
        return 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400';

    // Fish
    if (n.includes('pescado') || n.includes('atun') || n.includes('salmon') || n.includes('merluza') || n.includes('fish'))
        return 'https://images.unsplash.com/photo-1519708227418-c8fd9a3a277d?w=400'; // Salmon/Fish

    // Carbs (Rice/Pasta/Potato)
    if (n.includes('arroz') || n.includes('pasta') || n.includes('patata') || n.includes('pan') || n.includes('tostada') || n.includes('rice'))
        return 'https://images.unsplash.com/photo-1598965675045-45c5e72c77a6?w=400';

    // Eggs / Breakfast
    if (n.includes('huevo') || n.includes('clara') || n.includes('tortilla') || n.includes('egg'))
        return 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400';

    // Default Healthy
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: Platform.OS === 'android' ? 50 : 16,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        minWidth: 100,
        marginRight: 8,
    },
    tabTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 2,
    },
    tabSubtitle: {
        fontSize: 10,
    },
    contentContainer: {
        padding: 16,
        paddingTop: 8, // Less padding top since we have tabs above usually
        gap: 24,
    },
    mealCard: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(59, 130, 246, 0.05)', // Subtle blue tint
        borderBottomWidth: 1,
    },
    mealName: {
        fontSize: 16,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    mealKcalBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    mealKcalText: {
        fontSize: 11,
        fontWeight: '700',
    },
    segmentedScroll: {
        margin: 16,
        marginBottom: 8,
        borderRadius: 10,
        maxHeight: 50,
    },
    segmentedScrollContent: {
        padding: 4,
        alignItems: 'center',
        gap: 6,
    },
    segmentBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        minWidth: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentText: {
        fontSize: 12,
    },
    shadow: {
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 2,
    },
    optionContent: {
        padding: 16,
        paddingTop: 0,
    },
    macrosRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
        marginBottom: 16,
    },
    macroBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
    },
    macroLabel: {
        fontSize: 9,
        fontWeight: '700',
        marginBottom: 2,
    },
    macroValue: {
        fontSize: 13,
        fontWeight: '800',
    },
    foodList: {
        gap: 12,
    },
    foodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    foodThumb: {
        width: 56,
        height: 56,
        borderRadius: 12,
        backgroundColor: '#eee',
    },
    foodThumbPlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    foodName: {
        fontSize: 14,
        fontWeight: '600',
    },
    foodAmount: {
        fontSize: 12,
        marginTop: 2,
    }
});

export default ClientWeeklyOverview;
