import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Animated, Share, Platform } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useShoppingList } from '../../../../src/context/ShoppingListContext';
import SupplementManagerScreen from './supplements/SupplementManagerScreen';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app').replace(/\/+$/, '') + '/api';

const MOCK_REPLACEMENTS = {
    'fruta': [
        { name: 'Manzana', emoji: '🍎' },
        { name: 'Plátano', emoji: '🍌' },
        { name: 'Pera', emoji: '🍐' },
        { name: 'Mix Frutos Rojos', emoji: '🍓' },
        { name: 'Kiwi', emoji: '🥝' }
    ],
    'verdura': [
        { name: 'Brécol', emoji: '🥦' },
        { name: 'Espinacas', emoji: '🥬' },
        { name: 'Calabacín', emoji: '🥒' },
        { name: 'Judías Verdes', emoji: '🥬' }
    ],
    'frutos secos': [
        { name: 'Nueces', emoji: '🌰' },
        { name: 'Almendras', emoji: '🥜' },
        { name: 'Anacardos', emoji: '🥜' }
    ]
};

// Emojis por categoría de pasillo
const CATEGORY_EMOJIS = {
    'Frutas': '🍎',
    'Verduras': '🥬',
    'Tubérculos': '🥔',
    'Panadería': '🍞',
    'Carnes': '🍗',
    'Pescados': '🐟',
    'Huevos y Lácteos': '🥚',
    'Cereales y Legumbres': '🌾',
    'Conservas': '🥫',
    'Aceites y Condimentos': '🧴',
    'Frutos Secos': '🥜',
    'Endulzantes': '🍯',
    'Snacks': '🍫',
    'Bebidas': '🥤',
    'Suplementos': '💪',
    'Congelados': '🧊',
    'Otros': '📦'
};

const ShoppingListScreen = ({ plan }) => {
    const { theme } = useTheme();
    const {
        activeList,
        stats,
        isLoading: contextLoading,
        setList: saveListToContext,
        toggleItem,
        completeList,
        clearList
    } = useShoppingList();

    // Sub-tab state: 'food' | 'supplements'
    const [activeSubTab, setActiveSubTab] = useState('food');

    // Si hay lista guardada, ir directo al resultado
    const [step, setStep] = useState(activeList ? 3 : 0); // 0: Intro, 1: Allocations, 2: Generics, 3: Result
    const [loading, setLoading] = useState(false);

    // State for Allocations: { "mealId_optionId": frequency }
    // Or better: { [mealId]: { [optionId]: count } }
    const [allocations, setAllocations] = useState({});

    // State for Substitutions: { "GenericTerm": "SelectedSpecificItem" }
    const [substitutions, setSubstitutions] = useState({});

    // 1. Parse Plan Options
    const groupedOptions = useMemo(() => {
        if (!plan?.dayTemplates) return {};
        const groups = {};

        // Iterate all templates to find all unique meal definitions
        // Assumption: Meals with same ID across templates are the same structure
        plan.dayTemplates.forEach(template => {
            template.meals.forEach(meal => {
                // Use ID if available, otherwise fallback to Name as grouping key
                const groupKey = meal.id || meal.name;

                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        key: groupKey, // UI Key
                        id: meal.id,   // Real ID (might be undefined)
                        name: meal.name,
                        options: (meal.options || []).map((opt, idx) => ({
                            ...opt,
                            _safeId: opt.id || opt._id || `opt_${idx}` // UI Safe ID for counter
                        }))
                    };
                }
            });
        });
        return groups;
    }, [plan]);

    // 2. Initialize Allocations (Default: Even distribution if Plan is "Option" type)
    // For now, start empty or 0.
    useEffect(() => {
        const initial = {};
        Object.values(groupedOptions).forEach(group => {
            initial[group.key] = {};
            // If only 1 option, auto-fill full week (7 days)
            const isSingle = group.options.length === 1;
            group.options.forEach(opt => {
                initial[group.key][opt._safeId] = isSingle ? 7 : 0;
            });
        });
        setAllocations(initial);
    }, [groupedOptions]);

    const handleStep1Next = () => {
        // Validation: Check if days sum to 7 (or intended cycle)
        // For MVP, just warning if < 7
        const totalDays = Object.values(allocations).reduce((sum, mealAlloc) => {
            return sum + Object.values(mealAlloc).reduce((a, b) => a + b, 0);
        }, 0);

        // Actually we should check per meal group? 
        // If I have 3 meals/day, total should be 21?
        // Let's assume the user configures "How many times I eat Option A of Breakfast".
        // The sum of Breakfast Options should be 7.

        const errors = [];
        Object.values(groupedOptions).forEach(group => {
            const groupSum = Object.values(allocations[group.key] || {}).reduce((a, b) => a + b, 0);
            if (groupSum !== 7) {
                errors.push(`${group.name}: ${groupSum}/7 días asignados`);
            }
        });

        if (errors.length > 0) {
            Alert.alert("Revisa tu planificación", `Para completar la semana, asegúrate de asignar 7 días a cada comida.\n\n${errors.join('\n')}`);
            return;
        }

        setStep(2);
    };

    const handleStep2Next = async () => {
        setLoading(true);
        try {
            // Flatten allocations for API
            // API expects: [{ mealId, optionId, frequency }]
            const apiAllocations = [];

            // Reconstruct based on safe keys
            Object.values(groupedOptions).forEach(group => {
                const groupAlloc = allocations[group.key] || {};

                group.options.forEach((opt, idx) => {
                    const count = groupAlloc[opt._safeId] || 0;
                    if (count > 0) {
                        // Fallback logic: If real IDs are missing, we might have issues backend side, 
                        // but at least frontend is consistent.
                        // Ideally backend handles missing IDs by creating new day entries? 
                        // Or maybe we send the NAME if ID is missing?
                        // For now, send what we have.
                        apiAllocations.push({
                            mealId: group.id, // Can be undefined
                            mealName: group.name, // NEW: Fallback for ID-less meals
                            optionId: opt.id || opt._id, // Can be undefined
                            optionIndex: idx, // NEW: Fallback for ID-less options
                            frequency: count
                        });
                    }
                });
            });

            // Format substitutions
            // substitutions state: { "fruta": "Manzana" }
            const apiSubstitutions = Object.entries(substitutions).map(([term, item]) => ({
                genericTerm: term,
                selectedItem: item
            }));

            const token = await AsyncStorage.getItem('totalgains_token');
            const response = await fetch(`${API_BASE_URL}/shopping-list/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    planId: plan._id,
                    allocations: apiAllocations,
                    substitutions: apiSubstitutions
                })
            });

            const data = await response.json();
            if (data.success) {
                // Guardar en contexto (persiste en AsyncStorage)
                saveListToContext(data.shoppingList, plan._id);
                setStep(3);
            } else {
                Alert.alert("Error", data.message || "No se pudo generar la lista");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", e.message || "Ocurrió un error de conexión");
        } finally {
            setLoading(false);
        }
    };

    // --- RENDER HELPERS ---

    const renderStepper = (groupKey, optionSafeId, currentVal) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBackground, borderRadius: 8 }}>
            <TouchableOpacity
                onPress={() => updateAllocation(groupKey, optionSafeId, -1)}
                style={{ padding: 10 }}>
                <Ionicons name="remove" size={20} color={theme.text} />
            </TouchableOpacity>
            <Text style={{ width: 30, textAlign: 'center', fontWeight: 'bold', color: theme.text }}>{currentVal}</Text>
            <TouchableOpacity
                onPress={() => updateAllocation(groupKey, optionSafeId, 1)}
                style={{ padding: 10 }}>
                <Ionicons name="add" size={20} color={theme.text} />
            </TouchableOpacity>
        </View>
    );

    const updateAllocation = (groupKey, optionSafeId, delta) => {
        setAllocations(prev => {
            const current = prev[groupKey]?.[optionSafeId] || 0;
            const newVal = Math.max(0, current + delta);
            return {
                ...prev,
                [groupKey]: {
                    ...prev[groupKey],
                    [optionSafeId]: newVal
                }
            };
        });
    };

    // Calculate generics for Step 2
    const detectedGenerics = useMemo(() => {
        if (Object.keys(allocations).length === 0) return [];
        const genericsSet = new Set();

        Object.values(groupedOptions).forEach(group => {
            group.options.forEach(opt => {
                const count = allocations[group.key]?.[opt._safeId] || 0;
                if (count > 0) {
                    opt.foods.forEach(f => {
                        // Check explicit flag OR name match
                        if (f.isGeneric || MOCK_REPLACEMENTS[f.name.toLowerCase()]) {
                            genericsSet.add(f.name.toLowerCase()); // Store lower case key
                        }
                    });
                }
            });
        });
        return Array.from(genericsSet);
    }, [allocations, groupedOptions]);

    // --- STEPS ---

    // Sub-tab selector renderer
    const renderSubTabs = () => (
        <View style={[styles.subTabContainer, { backgroundColor: theme.inputBackground }]}>
            <TouchableOpacity
                style={[
                    styles.subTab,
                    activeSubTab === 'food' && { backgroundColor: theme.primary }
                ]}
                onPress={() => setActiveSubTab('food')}
            >
                <Ionicons
                    name="cart-outline"
                    size={16}
                    color={activeSubTab === 'food' ? '#fff' : theme.textSecondary}
                />
                <Text style={[
                    styles.subTabText,
                    { color: activeSubTab === 'food' ? '#fff' : theme.textSecondary }
                ]}>
                    Alimentos
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.subTab,
                    activeSubTab === 'supplements' && { backgroundColor: theme.primary }
                ]}
                onPress={() => setActiveSubTab('supplements')}
            >
                <Ionicons
                    name="fitness-outline"
                    size={16}
                    color={activeSubTab === 'supplements' ? '#fff' : theme.textSecondary}
                />
                <Text style={[
                    styles.subTabText,
                    { color: activeSubTab === 'supplements' ? '#fff' : theme.textSecondary }
                ]}>
                    Suplementos
                </Text>
            </TouchableOpacity>
        </View>
    );

    // Si estamos en la tab de suplementos, mostrar el gestor de suplementos
    if (activeSubTab === 'supplements') {
        return (
            <View style={{ flex: 1 }}>
                {renderSubTabs()}
                <SupplementManagerScreen plan={plan} />
            </View>
        );
    }

    if (loading) {
        return (
            <View style={[styles.centerContent, { flex: 1 }]}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.subtitle, { color: theme.textSecondary, marginTop: 16 }]}>Generando lista inteligente...</Text>
            </View>
        );
    }

    // STEP 0: INTRO / START
    if (step === 0) {
        return (
            <View style={styles.container}>
                {renderSubTabs()}
                <View style={styles.centerContent}>
                    <View style={[styles.iconCircle, { backgroundColor: theme.inputBackground }]}>
                        <Ionicons name="cart-outline" size={48} color={theme.primary} />
                    </View>
                    <Text style={[styles.title, { color: theme.text }]}>Lista de Compra Inteligente</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                        Planifica tus comidas de la semana y te diremos exactamente qué comprar.
                    </Text>

                    {/* Si hay lista guardada, mostrar opción de verla */}
                    {activeList && (
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: theme.primary, marginTop: 32 }]}
                            onPress={() => setStep(3)}
                        >
                            <Ionicons name="list-outline" size={18} color="white" />
                            <Text style={[styles.buttonText, { marginLeft: 6 }]}>
                                Ver Lista Guardada ({activeList.items.filter(i => !i.checked).length} pendientes)
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.button,
                            {
                                backgroundColor: activeList ? 'transparent' : theme.primary,
                                borderWidth: activeList ? 1 : 0,
                                borderColor: theme.borderLight,
                                marginTop: activeList ? 12 : 32
                            }
                        ]}
                        onPress={() => setStep(1)}
                    >
                        <Text style={[styles.buttonText, { color: activeList ? theme.text : 'white' }]}>
                            {activeList ? 'Crear Nueva Lista' : 'Planificar Semana'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // STEP 1: ALLOCATIONS
    if (step === 1) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
                {renderSubTabs()}
                <Text style={[styles.headerTitle, { color: theme.text }]}>Planifica tu Semana</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Asigna cuántas veces comerás cada opción.</Text>

                {Object.values(groupedOptions).map(group => {
                    const currentSum = Object.values(allocations[group.key] || {}).reduce((a, b) => a + b, 0);
                    const isComplete = currentSum === 7;

                    return (
                        <View key={group.key} style={[styles.card, { backgroundColor: theme.cardBackground }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>{group.name}</Text>
                                <Text style={{ color: isComplete ? '#22c55e' : theme.textSecondary, fontWeight: '700' }}>
                                    {currentSum}/7
                                </Text>
                            </View>

                            {group.options.map((opt, idx) => (
                                <View key={opt._safeId} style={styles.optionRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: theme.text, fontWeight: '600' }}>{opt.name || `Opción ${idx + 1}`}</Text>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                                            {opt.foods.map(f => f.name).join(', ').slice(0, 30)}...
                                        </Text>
                                    </View>
                                    {renderStepper(group.key, opt._safeId, allocations[group.key]?.[opt._safeId] || 0)}
                                </View>
                            ))}
                        </View>
                    );
                })}

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.primary, margin: 16 }]}
                    onPress={handleStep1Next}
                >
                    <Text style={styles.buttonText}>Siguiente: Ingredientes</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    // STEP 2: GENERICS
    if (step === 2) {
        // If no generics detected, auto skip? 
        // Can't auto-skip in render. Better check in useEffect or handleStep1Next.
        // For now, let's show success message if none.
        if (detectedGenerics.length === 0) {
            return (
                <View style={styles.centerContent}>
                    {renderSubTabs()}
                    <View style={[styles.iconCircle, { backgroundColor: theme.inputBackground }]}>
                        <Ionicons name="checkmark-done-circle-outline" size={48} color={theme.primary} />
                    </View>
                    <Text style={[styles.title, { color: theme.text }]}>¡Todo listo!</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary, marginBottom: 24 }]}>
                        No hay ingredientes genéricos que configurar. Podemos generar tu lista directamente.
                    </Text>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.primary }]}
                        onPress={handleStep2Next}
                    >
                        <Text style={styles.buttonText}>Generar Lista</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <ScrollView style={styles.container}>
                {renderSubTabs()}
                <Text style={[styles.headerTitle, { color: theme.text }]}>Personaliza</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Define tus ingredientes genéricos.</Text>

                {detectedGenerics.map(term => {
                    const options = MOCK_REPLACEMENTS[term] || [];
                    if (options.length === 0) return null;

                    return (
                        <View key={term} style={[styles.card, { backgroundColor: theme.cardBackground }]}>
                            <Text style={[styles.cardTitle, { color: theme.text, textTransform: 'capitalize' }]}>{term}</Text>
                            <Text style={{ color: theme.textSecondary, marginBottom: 12 }}>¿Qué prefieres comprar?</Text>

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {options.map(opt => {
                                    const isSelected = substitutions[term] === opt.name;
                                    return (
                                        <TouchableOpacity
                                            key={opt.name}
                                            onPress={() => setSubstitutions({ ...substitutions, [term]: opt.name })}
                                            style={{
                                                paddingHorizontal: 16, paddingVertical: 8,
                                                borderRadius: 20,
                                                backgroundColor: isSelected ? theme.primary : theme.inputBackground,
                                                borderWidth: 1, borderColor: isSelected ? theme.primary : theme.borderLight
                                            }}
                                        >
                                            <Text style={{ color: isSelected ? '#FFF' : theme.text }}>
                                                {opt.emoji} {opt.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    );
                })}

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.primary, margin: 16 }]}
                    onPress={handleStep2Next}
                >
                    <Text style={styles.buttonText}>Generar Lista</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    // STEP 3: RESULT
    if (step === 3 && activeList) {
        if (activeList.items.length === 0) {
            return (
                <View style={styles.centerContent}>
                    {renderSubTabs()}
                    <View style={[styles.iconCircle, { backgroundColor: theme.inputBackground }]}>
                        <Ionicons name="receipt-outline" size={48} color={theme.textSecondary} />
                    </View>
                    <Text style={[styles.title, { color: theme.text }]}>Lista Vacía</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                        No se han encontrado ingredientes para añadir. Verifica que el plan tenga alimentos configurados.
                    </Text>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.primary, marginTop: 24 }]}
                        onPress={() => setStep(1)}
                    >
                        <Text style={styles.buttonText}>Volver a Planificar</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        const handleComplete = () => {
            Alert.alert(
                "Completar Lista",
                "¿Has terminado tu compra? La lista se guardará en el historial.",
                [
                    { text: "Cancelar", style: "cancel" },
                    {
                        text: "Completar",
                        onPress: () => {
                            completeList();
                            setStep(0);
                        }
                    }
                ]
            );
        };

        const handleNewList = () => {
            Alert.alert(
                "Nueva Lista",
                "¿Descartar la lista actual y crear una nueva?",
                [
                    { text: "Cancelar", style: "cancel" },
                    {
                        text: "Descartar",
                        style: "destructive",
                        onPress: () => {
                            clearList();
                            setStep(1);
                        }
                    }
                ]
            );
        };

        const handleShare = async () => {
            try {
                // Agrupar por categoría para el texto
                const grouped = activeList.items.reduce((acc, item) => {
                    const cat = item.category || 'Otros';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(item);
                    return acc;
                }, {});

                // Generar texto formateado
                let text = '🛒 LISTA DE COMPRA\n';
                text += '━━━━━━━━━━━━━━━━━━━━\n\n';

                for (const [category, items] of Object.entries(grouped)) {
                    const emoji = CATEGORY_EMOJIS[category] || '📦';
                    text += `${emoji} ${category.toUpperCase()}\n`;

                    items.forEach(item => {
                        const check = item.checked ? '✅' : '☐';
                        text += `${check} ${item.name} - ${item.amount} ${item.unit}\n`;
                    });
                    text += '\n';
                }

                text += `━━━━━━━━━━━━━━━━━━━━\n`;
                text += `📊 Progreso: ${stats.checked}/${stats.total} (${stats.progress}%)\n`;
                text += `\n📱 Generado con TotalGains`;

                await Share.share({
                    message: text,
                    title: 'Lista de Compra'
                });
            } catch (error) {
                if (error.message !== 'User did not share') {
                    Alert.alert('Error', 'No se pudo compartir la lista');
                }
            }
        };

        return (
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
                {renderSubTabs()}
                {/* Header con progreso y compartir */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Tu Lista de Compra</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                            onPress={handleShare}
                            style={[styles.iconButton, { backgroundColor: theme.inputBackground }]}
                        >
                            <Ionicons name="share-outline" size={20} color={theme.primary} />
                        </TouchableOpacity>
                        {stats && (
                            <View style={[styles.progressBadge, { backgroundColor: theme.primary + '20' }]}>
                                <Text style={{ color: theme.primary, fontWeight: '700' }}>
                                    {stats.checked}/{stats.total}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Barra de progreso */}
                {stats && (
                    <View style={[styles.progressBar, { backgroundColor: theme.inputBackground }]}>
                        <View style={[styles.progressFill, { width: `${stats.progress}%`, backgroundColor: theme.primary }]} />
                    </View>
                )}

                {/* Items agrupados por categoría/pasillo */}
                {(() => {
                    // Agrupar items por categoría
                    const grouped = activeList.items.reduce((acc, item) => {
                        const cat = item.category || 'Otros';
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(item);
                        return acc;
                    }, {});

                    return Object.entries(grouped).map(([category, items]) => (
                        <View key={category} style={[styles.categorySection, { backgroundColor: theme.cardBackground }]}>
                            {/* Header de categoría */}
                            <View style={styles.categoryHeader}>
                                <Text style={styles.categoryEmoji}>
                                    {CATEGORY_EMOJIS[category] || '📦'}
                                </Text>
                                <Text style={[styles.categoryTitle, { color: theme.text }]}>
                                    {category}
                                </Text>
                                <Text style={[styles.categoryCount, { color: theme.textSecondary }]}>
                                    {items.filter(i => i.checked).length}/{items.length}
                                </Text>
                            </View>

                            {/* Items de esta categoría */}
                            {items.map((item) => (
                                <ShoppingListItem
                                    key={item.id}
                                    item={item}
                                    theme={theme}
                                    onToggle={() => toggleItem(item.id)}
                                />
                            ))}
                        </View>
                    ));
                })()}

                {/* Acciones */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                    <TouchableOpacity
                        style={[styles.button, styles.secondaryButton, { flex: 1, borderColor: theme.borderLight }]}
                        onPress={handleNewList}
                    >
                        <Ionicons name="refresh-outline" size={18} color={theme.text} />
                        <Text style={[styles.buttonText, { color: theme.text, marginLeft: 6 }]}>Nueva</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, { flex: 2, backgroundColor: stats?.progress === 100 ? '#22c55e' : theme.primary }]}
                        onPress={handleComplete}
                    >
                        <Ionicons name="checkmark-done-outline" size={18} color="white" />
                        <Text style={[styles.buttonText, { marginLeft: 6 }]}>
                            {stats?.progress === 100 ? '¡Completada!' : 'Terminar Compra'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    }

    return null;
};

const ShoppingListItem = ({ item, theme, onToggle }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(item.checked ? 0.5 : 1)).current;

    const handleToggle = () => {
        const nextState = !item.checked;

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

        onToggle?.();
    };

    return (
        <TouchableOpacity onPress={handleToggle} activeOpacity={0.8}>
            <Animated.View
                style={[
                    styles.itemRow,
                    {
                        borderBottomColor: theme.borderLight,
                        transform: [{ scale: scaleAnim }],
                        opacity: opacityAnim,
                        backgroundColor: item.checked ? theme.inputBackground : 'transparent',
                        borderRadius: 8,
                        paddingHorizontal: 8
                    }
                ]}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <Ionicons
                        name={item.checked ? "checkbox" : "square-outline"}
                        size={24}
                        color={item.checked ? theme.textSecondary : theme.primary}
                    />
                    <Text style={{
                        flex: 1,
                        fontSize: 16,
                        color: item.checked ? theme.textSecondary : theme.text,
                        fontWeight: item.checked ? '400' : '600',
                        textDecorationLine: item.checked ? 'line-through' : 'none'
                    }}>
                        {item.name}
                    </Text>
                </View>
                <Text style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: item.checked ? theme.textSecondary : theme.primary,
                    textDecorationLine: item.checked ? 'line-through' : 'none'
                }}>
                    {item.amount} {item.unit}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    centerContent: {
        alignItems: 'center',
        marginVertical: 32,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        maxWidth: 300,
        lineHeight: 20,
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center'
    },
    buttonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        marginTop: 10
    },
    headerSubtitle: {
        fontSize: 14,
        marginBottom: 20
    },
    card: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 16
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700'
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1
    },
    progressBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
        marginVertical: 12,
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        borderRadius: 3
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'center'
    },
    categorySection: {
        borderRadius: 16,
        marginBottom: 12,
        padding: 12,
        paddingTop: 8
    },
    categoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)'
    },
    categoryEmoji: {
        fontSize: 20,
        marginRight: 8
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: '700',
        flex: 1
    },
    categoryCount: {
        fontSize: 13,
        fontWeight: '600'
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center'
    },
    subTabContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    subTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    subTabText: {
        fontSize: 14,
        fontWeight: '700',
    },
});

export default ShoppingListScreen;
