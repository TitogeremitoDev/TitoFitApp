import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useStableWindowDimensions } from '../../../../src/hooks/useStableBreakpoint';

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
    const { width } = useStableWindowDimensions();
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

    // Web: Dense Vertical Card Layout (Reverted by request)
    if (isLargeScreen) {
        return (
            <View style={[styles.webCardWrapper, ingredient.validationWarning && styles.cardWarning]}>
                {/* Main Recipe/Food Card */}
                <TouchableOpacity
                    style={[styles.webCard, isRecipe && styles.cardRecipe]}
                    onPress={handleEditPress}
                    activeOpacity={0.8}
                >
                    {/* Image Header */}
                    <View style={styles.webImageContainer}>
                        {photoUrl ? (
                            <Image source={{ uri: photoUrl }} style={styles.webImage} />
                        ) : (
                            <View style={[styles.webImagePlaceholder, { backgroundColor: status.bg }]}>
                                <Ionicons name={isRecipe ? 'restaurant' : 'nutrition'} size={28} color={status.color} />
                            </View>
                        )}

                        {/* Source Badge */}
                        <View style={[styles.webSourceOverlay, { backgroundColor: sourceConfig.color }]}>
                            <MaterialCommunityIcons name={sourceConfig.icon} size={10} color="#fff" />
                        </View>

                        {/* Confidence Badge */}
                        <View style={[styles.webConfidenceOverlay, { backgroundColor: status.color }]}>
                            <Text style={styles.webConfidenceTextOverlay}>{status.label}</Text>
                        </View>
                    </View>

                    {/* Content */}
                    <View style={styles.webContent}>
                        <View style={styles.webNameRow}>
                            <Text style={styles.webName} numberOfLines={2} ellipsizeMode="tail">
                                {displayName}
                            </Text>
                        </View>

                        {/* Quantity */}
                        <Text style={styles.webQty}>
                            {ingredient.unit === 'a_gusto' ? '🎯 Libre' : `${ingredient.amount || ingredient.qty || 0} ${ingredient.unit || 'g'}`}
                        </Text>

                        {/* Compact Macros */}
                        {ingredient.nutrients && (
                            <View style={styles.webMacrosCompact}>
                                <Text style={styles.webMacroText}>⚡ {Math.round(ingredient.nutrients.kcal || 0)}</Text>
                                <Text style={styles.webMacroText}>P {Math.round(ingredient.nutrients.protein || 0)}</Text>
                            </View>
                        )}

                        {/* Actions Row */}
                        <View style={styles.webActionsData}>
                            <TouchableOpacity style={styles.webEditBtnSmall} onPress={handleEditPress}>
                                <Ionicons name="create-outline" size={14} color="#64748b" />
                            </TouchableOpacity>

                            {onDelete && (
                                <TouchableOpacity style={styles.webDeleteBtnSmall} onPress={onDelete}>
                                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                </TouchableOpacity>
                            )}

                            {hasSubIngredients && (
                                <TouchableOpacity
                                    style={[styles.webExpandBtnSmall, expanded && styles.webExpandBtnActive]}
                                    onPress={() => setExpanded(!expanded)}
                                >
                                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#64748b" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Vertical SubIngredients Panel */}
                {expanded && hasSubIngredients && (
                    <View style={styles.webSubVertical}>
                        {ingredient.subIngredients.map((sub, idx) => (
                            <View key={idx} style={styles.webSubVerticalItem}>
                                <View style={styles.webSubDot} />
                                <Text style={styles.webSubVerticalName} numberOfLines={1}>{sub.name}</Text>
                                <Text style={styles.webSubVerticalQty}>{sub.amount}{sub.unit}</Text>
                            </View>
                        ))}
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

    // ============ WEB STYLES (DENSE VERTICAL) ============
    webCardWrapper: {
        width: 160,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    webCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
    },
    webImageContainer: {
        position: 'relative',
        width: '100%',
        height: 100,
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
        top: 6,
        left: 6,
        padding: 4,
        borderRadius: 6,
    },
    webConfidenceOverlay: {
        position: 'absolute',
        top: 6,
        right: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    webConfidenceTextOverlay: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700'
    },
    webContent: {
        padding: 8,
    },
    webNameRow: {
        marginBottom: 2,
        height: 36, // Fixed height for 2 lines
    },
    webName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
        lineHeight: 16,
    },
    webQty: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
        fontWeight: '500',
    },
    webMacrosCompact: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    webMacroText: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '500',
    },
    webActionsData: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 6,
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 6,
    },
    webEditBtnSmall: {
        padding: 4,
        borderRadius: 4,
        backgroundColor: '#f1f5f9',
    },
    webDeleteBtnSmall: {
        padding: 4,
        borderRadius: 4,
        backgroundColor: '#fef2f2',
    },
    webExpandBtnSmall: {
        padding: 4,
        borderRadius: 4,
        backgroundColor: '#f1f5f9',
    },
    webExpandBtnActive: {
        backgroundColor: '#fff7ed',
    },

    // Vertical SubIngredients (Collapsed list inside card)
    webSubVertical: {
        backgroundColor: '#fffbef',
        padding: 8,
        borderTopWidth: 1,
        borderTopColor: '#fef3c7',
    },
    webSubVerticalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 6,
    },
    webSubDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#d97706',
    },
    webSubVerticalName: {
        flex: 1,
        fontSize: 10,
        color: '#92400e',
    },
    webSubVerticalQty: {
        fontSize: 10,
        color: '#b45309',
        fontWeight: '500',
    },
});

