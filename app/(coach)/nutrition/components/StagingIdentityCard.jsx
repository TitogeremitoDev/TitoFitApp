import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Confidence-based status config (0-1 range)
const getStatusFromConfidence = (confidence, validationWarning) => {
    if (validationWarning) {
        return { color: '#ef4444', icon: 'warning', label: 'Error', bg: '#fee2e2', level: 'red' };
    }
    if (confidence >= 0.8) {
        return { color: '#22c55e', icon: 'checkmark-circle', label: `${Math.round(confidence * 100)}%`, bg: '#dcfce7', level: 'green' };
    }
    if (confidence >= 0.5) {
        return { color: '#f59e0b', icon: 'alert-circle', label: `${Math.round(confidence * 100)}%`, bg: '#fef3c7', level: 'yellow' };
    }
    return { color: '#ef4444', icon: 'warning', label: `${Math.round(confidence * 100)}%`, bg: '#fee2e2', level: 'red' };
};

// Source type badges
const SOURCE_ICONS = {
    'DB_CLOUD': { icon: 'database', color: '#3b82f6', label: 'BD', fullLabel: 'Base de Datos' },
    'PDF_EXPLICIT': { icon: 'file-document', color: '#8b5cf6', label: 'PDF', fullLabel: 'Del PDF' },
    'API_EXTERNAL': { icon: 'web', color: '#06b6d4', label: 'API', fullLabel: 'API Externa' },
    'AI_GENERATED': { icon: 'robot', color: '#f59e0b', label: 'IA', fullLabel: 'Generado por IA' },
    'default': { icon: 'help-circle', color: '#94a3b8', label: '?', fullLabel: 'Desconocido' }
};

/**
 * StagingIdentityCard - Displays a food/recipe item in the staging modal
 * Enhanced for web with larger images, visible macros, and better sub-ingredients
 */
export default function StagingIdentityCard({ ingredient, onPress, onUpdate, onDelete, isWeb }) {
    const [expanded, setExpanded] = useState(false);
    const { width } = useWindowDimensions();
    const isLargeScreen = isWeb || width > 768;

    // Get confidence-based status
    const confidence = ingredient.matchConfidence ?? (ingredient.sourceType === 'DB_CLOUD' ? 0.95 : 0.5);
    const status = getStatusFromConfidence(confidence, ingredient.validationWarning);

    // Source badge config
    const sourceConfig = SOURCE_ICONS[ingredient.sourceType] || SOURCE_ICONS.default;

    // Display name
    const displayName = ingredient.name || ingredient.detectedName || ingredient.rawText || "Sin nombre";
    const originalName = ingredient.originalName || ingredient.rawText;
    const showOriginal = originalName && originalName !== displayName;

    // Recipe detection
    const isRecipe = ingredient.isRecipe === true || ingredient.isComposite === true;
    const hasSubIngredients = isRecipe && ingredient.subIngredients?.length > 0;

    // Photo URL
    const photoUrl = ingredient.image || ingredient.photo || null;

    // Handle card press
    const handlePress = () => {
        if (hasSubIngredients) {
            setExpanded(!expanded);
        } else if (onPress) {
            onPress();
        }
    };

    // Handle edit button
    const handleEditPress = () => {
        if (onPress) onPress();
    };

    // Web: Larger card layout with horizontal subingredients
    if (isLargeScreen) {
        return (
            <View style={[styles.webRowWrapper, ingredient.validationWarning && styles.cardWarning]}>
                {/* Main Recipe/Food Card */}
                <TouchableOpacity
                    style={[styles.webCard, isRecipe && styles.cardRecipe]}
                    onPress={handleEditPress}
                    activeOpacity={0.8}
                >
                    {/* Large Image */}
                    <View style={styles.webImageContainer}>
                        {photoUrl ? (
                            <Image source={{ uri: photoUrl }} style={styles.webImage} />
                        ) : (
                            <View style={[styles.webImagePlaceholder, { backgroundColor: status.bg }]}>
                                <Ionicons name={isRecipe ? 'restaurant' : 'nutrition'} size={32} color={status.color} />
                            </View>
                        )}

                        {/* Source Badge on Image */}
                        <View style={[styles.webSourceOverlay, { backgroundColor: sourceConfig.color }]}>
                            <MaterialCommunityIcons name={sourceConfig.icon} size={10} color="#fff" />
                            <Text style={styles.webSourceLabel}>{sourceConfig.label}</Text>
                        </View>
                    </View>

                    {/* Content */}
                    <View style={styles.webContent}>
                        <View style={styles.webNameRow}>
                            <Text style={styles.webName} numberOfLines={2}>
                                {displayName}
                            </Text>
                            {isRecipe && (
                                <View style={styles.recipeTagBadge}>
                                    <Ionicons name="restaurant" size={10} color="#d97706" />
                                    <Text style={styles.recipeTagText}>RECETA</Text>
                                </View>
                            )}
                        </View>

                        {/* Quantity */}
                        <Text style={styles.webQty}>
                            {ingredient.unit === 'a_gusto' ? '🎯 Libre' : `${ingredient.amount || ingredient.qty || 0} ${ingredient.unit || 'g'}`}
                        </Text>

                        {/* Macros Row */}
                        {ingredient.nutrients && (
                            <View style={styles.webMacrosRow}>
                                <View style={styles.webMacroItem}>
                                    <Text style={styles.webMacroValue}>{Math.round(ingredient.nutrients.kcal || 0)}</Text>
                                    <Text style={styles.webMacroLabel}>kcal</Text>
                                </View>
                                <View style={[styles.webMacroItem, styles.macroProtein]}>
                                    <Text style={styles.webMacroValue}>{Math.round(ingredient.nutrients.protein || 0)}g</Text>
                                    <Text style={styles.webMacroLabel}>Prot</Text>
                                </View>
                                <View style={[styles.webMacroItem, styles.macroCarbs]}>
                                    <Text style={styles.webMacroValue}>{Math.round(ingredient.nutrients.carbs || 0)}g</Text>
                                    <Text style={styles.webMacroLabel}>Carbs</Text>
                                </View>
                                <View style={[styles.webMacroItem, styles.macroFat]}>
                                    <Text style={styles.webMacroValue}>{Math.round(ingredient.nutrients.fat || 0)}g</Text>
                                    <Text style={styles.webMacroLabel}>Grasa</Text>
                                </View>
                            </View>
                        )}

                        {/* Original name diff */}
                        {showOriginal && (
                            <Text style={styles.webOriginalText} numberOfLines={1}>
                                ← "{originalName}"
                            </Text>
                        )}

                        {/* Validation warning */}
                        {ingredient.validationWarning && (
                            <Text style={styles.warningText}>⚠️ {ingredient.validationWarning}</Text>
                        )}
                    </View>

                    {/* Actions - Right side */}
                    <View style={styles.webActions}>
                        <View style={[styles.webConfidenceBadge, { borderColor: status.color, backgroundColor: status.bg }]}>
                            <Text style={[styles.webConfidenceText, { color: status.color }]}>{status.label}</Text>
                        </View>

                        <TouchableOpacity style={styles.webEditBtn} onPress={handleEditPress}>
                            <Ionicons name="create-outline" size={18} color="#64748b" />
                        </TouchableOpacity>

                        {/* Delete button */}
                        {onDelete && (
                            <TouchableOpacity style={styles.webDeleteBtn} onPress={onDelete}>
                                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                            </TouchableOpacity>
                        )}

                        {/* Expand button for recipes */}
                        {hasSubIngredients && (
                            <TouchableOpacity
                                style={[styles.webExpandBtn, expanded && styles.webExpandBtnActive]}
                                onPress={() => setExpanded(!expanded)}
                            >
                                <Ionicons name={expanded ? 'chevron-back' : 'chevron-forward'} size={18} color={expanded ? '#d97706' : '#64748b'} />
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>

                {/* Horizontal SubIngredients Panel - Shows to the RIGHT */}
                {expanded && hasSubIngredients && (
                    <View style={styles.webSubHorizontal}>
                        <Text style={styles.webSubHorizontalTitle}>
                            ≡ Ingredientes ({ingredient.subIngredients.length})
                        </Text>
                        <View style={styles.webSubHorizontalList}>
                            {ingredient.subIngredients.map((sub, idx) => {
                                const subSource = SOURCE_ICONS[sub.sourceType] || SOURCE_ICONS.default;
                                return (
                                    <View key={idx} style={styles.webSubHorizontalItem}>
                                        {sub.image ? (
                                            <Image source={{ uri: sub.image }} style={styles.webSubHorizontalImg} />
                                        ) : (
                                            <View style={styles.webSubHorizontalImgPlaceholder}>
                                                <Ionicons name="nutrition" size={20} color="#d97706" />
                                            </View>
                                        )}
                                        <View style={styles.webSubHorizontalContent}>
                                            <Text style={styles.webSubHorizontalName} numberOfLines={1}>{sub.name}</Text>
                                            <Text style={styles.webSubHorizontalQty}>{sub.amount || sub.qty || 0}{sub.unit || 'g'}</Text>
                                            {sub.nutrients && (
                                                <View style={styles.webSubHorizontalMacros}>
                                                    <Text style={styles.webSubHorizontalMacroItem}>{Math.round(sub.nutrients.kcal || 0)} kcal</Text>
                                                    <Text style={styles.webSubHorizontalMacroItem}>P: {Math.round(sub.nutrients.protein || 0)}g</Text>
                                                    <Text style={styles.webSubHorizontalMacroItem}>C: {Math.round(sub.nutrients.carbs || 0)}g</Text>
                                                    <Text style={styles.webSubHorizontalMacroItem}>G: {Math.round(sub.nutrients.fat || 0)}g</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={[styles.webSubHorizontalBadge, { backgroundColor: subSource.color }]}>
                                            <MaterialCommunityIcons name={subSource.icon} size={10} color="#fff" />
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}
            </View>
        );
    }

    // Mobile: Compact card layout
    return (
        <View style={[styles.cardWrapper, ingredient.validationWarning && styles.cardWarning]}>
            <TouchableOpacity
                style={[styles.card, isRecipe && styles.cardRecipe]}
                onPress={handlePress}
                activeOpacity={0.7}
            >
                {/* Photo Thumbnail */}
                {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.thumbnail} />
                ) : (
                    <View style={[styles.thumbnailPlaceholder, { backgroundColor: status.bg }]}>
                        <Ionicons name={isRecipe ? 'restaurant' : 'nutrition'} size={20} color={status.color} />
                    </View>
                )}

                {/* Content */}
                <View style={styles.content}>
                    <Text style={styles.name} numberOfLines={1}>
                        {displayName}
                        {isRecipe && <Text style={styles.recipeTag}> (RECETA)</Text>}
                    </Text>

                    <View style={styles.metaRow}>
                        <Text style={styles.qty}>
                            {ingredient.unit === 'a_gusto' ? 'Libre' : `${ingredient.amount || ingredient.qty || 0} ${ingredient.unit || 'g'}`}
                        </Text>
                        {showOriginal && (
                            <Text style={styles.originalText} numberOfLines={1}>
                                ← "{originalName}"
                            </Text>
                        )}
                    </View>

                    {ingredient.nutrients && (
                        <View style={styles.macrosPreview}>
                            <Text style={styles.macroText}>P:{Math.round(ingredient.nutrients.protein || 0)}g</Text>
                            <Text style={styles.macroText}>C:{Math.round(ingredient.nutrients.carbs || 0)}g</Text>
                            <Text style={styles.macroText}>G:{Math.round(ingredient.nutrients.fat || 0)}g</Text>
                        </View>
                    )}

                    {ingredient.validationWarning && (
                        <Text style={styles.warningText}>⚠️ {ingredient.validationWarning}</Text>
                    )}
                </View>

                {/* Right Column */}
                <View style={styles.rightCol}>
                    <View style={[styles.sourceBadge, { backgroundColor: sourceConfig.color + '20' }]}>
                        <MaterialCommunityIcons name={sourceConfig.icon} size={12} color={sourceConfig.color} />
                        <Text style={[styles.sourceLabel, { color: sourceConfig.color }]}>{sourceConfig.label}</Text>
                    </View>

                    <View style={[styles.confidenceBadge, { borderColor: status.color }]}>
                        <Text style={[styles.confidenceText, { color: status.color }]}>{status.label}</Text>
                    </View>

                    <TouchableOpacity style={styles.editBtn} onPress={handleEditPress}>
                        <Ionicons name="create-outline" size={16} color="#64748b" />
                    </TouchableOpacity>

                    {/* Delete button */}
                    {onDelete && (
                        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                    )}

                    {hasSubIngredients && (
                        <Ionicons
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color="#64748b"
                        />
                    )}
                </View>
            </TouchableOpacity>

            {/* Expanded SubIngredients - MOBILE */}
            {expanded && hasSubIngredients && (
                <View style={styles.subIngredientsContainer}>
                    <Text style={styles.subTitle}>Ingredientes de la receta:</Text>
                    {ingredient.subIngredients.map((sub, idx) => (
                        <View key={idx} style={styles.subItem}>
                            {sub.image ? (
                                <Image source={{ uri: sub.image }} style={styles.subThumbnail} />
                            ) : (
                                <View style={styles.subDot} />
                            )}
                            <Text style={styles.subName}>{sub.name}</Text>
                            <Text style={styles.subQty}>{sub.amount || sub.qty || 0}{sub.unit || 'g'}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // ============ MOBILE STYLES ============
    cardWrapper: {
        marginBottom: 8,
        borderRadius: 14,
        overflow: 'hidden',
    },
    cardWarning: {
        borderWidth: 2,
        borderColor: '#ef4444',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        gap: 10,
    },
    cardRecipe: {
        backgroundColor: '#fefce8',
        borderColor: '#fef08a',
    },
    thumbnail: {
        width: 44,
        height: 44,
        borderRadius: 10,
    },
    thumbnailPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    recipeTag: {
        fontSize: 11,
        fontWeight: '700',
        color: '#d97706',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    qty: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748b',
    },
    originalText: {
        fontSize: 11,
        fontStyle: 'italic',
        color: '#94a3b8',
    },
    macrosPreview: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    macroText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '500',
    },
    warningText: {
        fontSize: 11,
        color: '#ef4444',
        marginTop: 4,
        fontWeight: '500',
    },
    rightCol: {
        alignItems: 'flex-end',
        gap: 4,
    },
    sourceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    sourceLabel: {
        fontSize: 10,
        fontWeight: '700',
    },
    confidenceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    confidenceText: {
        fontSize: 10,
        fontWeight: '700',
    },
    editBtn: {
        padding: 4,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    deleteBtn: {
        padding: 4,
        borderRadius: 6,
        backgroundColor: '#fef2f2',
    },
    subIngredientsContainer: {
        backgroundColor: '#fefbeb',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#fef08a',
    },
    subTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400e',
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    subItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        gap: 8,
    },
    subThumbnail: {
        width: 20,
        height: 20,
        borderRadius: 4,
    },
    subDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#d97706',
    },
    subName: {
        flex: 1,
        fontSize: 12,
        color: '#78350f',
    },
    subQty: {
        fontSize: 11,
        color: '#92400e',
        fontWeight: '500',
    },

    // ============ WEB STYLES ============
    webCardWrapper: {
        width: 220,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    webCard: {
        width: 220,
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    webImageContainer: {
        position: 'relative',
        width: '100%',
        height: 120,
    },
    webImage: {
        width: '100%',
        height: '100%',
    },
    webImagePlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    webSourceOverlay: {
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    webSourceLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#fff',
    },
    webContent: {
        padding: 12,
    },
    webNameRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 6,
    },
    webName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        lineHeight: 18,
    },
    recipeTagBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    recipeTagText: {
        fontSize: 8,
        fontWeight: '800',
        color: '#d97706',
    },
    webQty: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 4,
    },
    webMacrosRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    webMacroItem: {
        alignItems: 'center',
    },
    webMacroValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
    webMacroLabel: {
        fontSize: 9,
        color: '#94a3b8',
        marginTop: 1,
    },
    macroProtein: {},
    macroCarbs: {},
    macroFat: {},
    webOriginalText: {
        fontSize: 10,
        fontStyle: 'italic',
        color: '#94a3b8',
        marginTop: 4,
    },
    webActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        paddingTop: 0,
        gap: 8,
    },
    webConfidenceBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    webConfidenceText: {
        fontSize: 11,
        fontWeight: '700',
    },
    webEditBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    webDeleteBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
    },
    webExpandBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    webExpandBtnActive: {
        backgroundColor: '#fef3c7',
    },
    // Web SubIngredients - Keep old styles for compatibility
    webSubContainer: {
        backgroundColor: '#fefbeb',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#fef08a',
    },
    webSubTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#92400e',
        marginBottom: 8,
    },
    webSubGrid: {
        gap: 8,
    },
    webSubItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 8,
        borderRadius: 10,
        gap: 10,
    },
    webSubImage: {
        width: 40,
        height: 40,
        borderRadius: 8,
    },
    webSubImagePlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#fef3c7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    webSubContent: {
        flex: 1,
    },
    webSubName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#78350f',
    },
    webSubQty: {
        fontSize: 11,
        color: '#92400e',
        marginTop: 1,
    },
    webSubMacros: {
        fontSize: 10,
        color: '#a16207',
        marginTop: 2,
    },
    webSubSourceBadge: {
        padding: 4,
        borderRadius: 6,
    },

    // ============ NEW: HORIZONTAL WEB SUBINGREDIENTS ============
    webRowWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    webSubHorizontal: {
        flex: 1,
        backgroundColor: '#fefbeb',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#fef08a',
        maxWidth: 400,
    },
    webSubHorizontalTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#92400e',
        marginBottom: 8,
    },
    webSubHorizontalList: {
        gap: 6,
    },
    webSubHorizontalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 8,
        borderRadius: 10,
        gap: 8,
        borderWidth: 1,
        borderColor: '#fef3c7',
    },
    webSubHorizontalImg: {
        width: 48,
        height: 48,
        borderRadius: 8,
    },
    webSubHorizontalImgPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#fef3c7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    webSubHorizontalContent: {
        flex: 1,
    },
    webSubHorizontalName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#78350f',
    },
    webSubHorizontalQty: {
        fontSize: 12,
        fontWeight: '500',
        color: '#92400e',
        marginTop: 2,
    },
    webSubHorizontalMacros: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 4,
    },
    webSubHorizontalMacroItem: {
        fontSize: 10,
        color: '#a16207',
        fontWeight: '500',
    },
    webSubHorizontalBadge: {
        padding: 4,
        borderRadius: 6,
    },
});

