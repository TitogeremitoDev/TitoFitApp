import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FoodItem, LAYER_ICONS } from '../src/services/foodService';

interface FoodGridCardProps {
    item: FoodItem | any;
    onPress?: (item: FoodItem | any) => void;
    isFavorite?: boolean;
    onToggleFavorite?: (item: FoodItem | any) => void;
    onDelete?: (item: FoodItem | any) => void;
    itemType?: 'ingredient' | 'recipe' | 'combo';
    isDeletable?: boolean;
}

function FoodGridCard({ item, onPress, isFavorite, onToggleFavorite, onDelete, itemType }: FoodGridCardProps) {
    const layerIcon = LAYER_ICONS[item.layer as keyof typeof LAYER_ICONS] || '📦';
    const isRecipe = itemType === 'recipe' || (!itemType && item.isComposite);
    const isCombo = itemType === 'combo';

    const handleFavoritePress = (e: any) => {
        e.stopPropagation?.();
        onToggleFavorite?.(item);
    };

    const handleDeletePress = (e: any) => {
        e.stopPropagation?.();
        onDelete?.(item);
    };

    const handleMainPress = () => {
        onPress?.(item);
    };

    return (
        <TouchableOpacity
            style={[
                styles.card,
                isRecipe && { borderColor: '#bbf7d0', borderWidth: 1.5 },
                isCombo && { borderColor: '#fde68a', borderWidth: 1.5 },
            ]}
            onPress={handleMainPress}
            activeOpacity={0.9}
        >
            {/* Header Image */}
            <View style={styles.imageContainer}>
                {item.image ? (
                    <Image
                        source={{ uri: item.image }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.image, {
                        backgroundColor: isCombo ? '#fef9c3' : isRecipe ? '#dcfce7' : '#e2e8f0',
                        alignItems: 'center', justifyContent: 'center'
                    }]}>
                        <Ionicons
                            name={isCombo ? "layers" : isRecipe ? "restaurant" : "fast-food-outline"}
                            size={40}
                            color={isCombo ? "#d97706" : isRecipe ? "#22c55e" : "#94a3b8"}
                        />
                    </View>
                )}

                {/* Type Badge (Top-Left) */}
                {isCombo ? (
                    <View style={[styles.layerBadge, { backgroundColor: '#fef3c7' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#d97706' }}>COMBO</Text>
                    </View>
                ) : isRecipe ? (
                    <View style={[styles.layerBadge, { backgroundColor: '#dcfce7' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#16a34a' }}>RECETA</Text>
                    </View>
                ) : (
                    <View style={styles.layerBadge}>
                        <Text style={styles.layerIcon}>{layerIcon}</Text>
                    </View>
                )}

                {/* Tags Overlay */}
                <View style={styles.badgesContainer}>
                    {item.tags?.slice(0, 2).map((tag: string, index: number) => (
                        <View key={index} style={styles.tagBadge}>
                            <Text style={styles.tagText}>{tag}</Text>
                        </View>
                    ))}
                </View>

                {/* Favorite Icon (Overlay) */}
                <TouchableOpacity
                    style={[styles.favIcon, isFavorite && styles.favIconActive]}
                    onPress={handleFavoritePress}
                >
                    <Ionicons
                        name={isFavorite ? "heart" : "heart-outline"}
                        size={18}
                        color={isFavorite ? "#ef4444" : "#fff"}
                    />
                </TouchableOpacity>

                {/* Delete Icon (Overlay - only for coach-owned items) */}
                {onDelete && isDeletable && (
                    <TouchableOpacity
                        style={styles.deleteIcon}
                        onPress={handleDeletePress}
                    >
                        <Ionicons name="trash-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.subtext} numberOfLines={1}>
                    {isCombo
                        ? `${(item as any)._comboFoodCount || item.ingredients?.length || 0} alimentos • ${Math.round(item.nutrients?.kcal || 0)} kcal`
                        : isRecipe
                            ? `${item.ingredients?.length || 0} ingredientes • Total`
                            : `${item.brand || (item.isSystem ? 'Sistema' : 'Personalizado')} • 100g`
                    }
                </Text>

                {/* Macro Boxes */}
                <View style={styles.macrosRow}>
                    <MacroBox label="Kcal" value={Math.round(item.nutrients?.kcal || 0)} unit="" color={isCombo ? "#d97706" : isRecipe ? "#16a34a" : "#3b82f6"} />
                    <MacroBox label="Prot" value={Math.round(item.nutrients?.protein || 0)} unit="g" color={isCombo ? "#d97706" : isRecipe ? "#16a34a" : "#3b82f6"} />
                    <MacroBox label="Carb" value={Math.round(item.nutrients?.carbs || 0)} unit="g" textColor="#64748b" bgColor="#f1f5f9" />
                    <MacroBox label="Grasa" value={Math.round(item.nutrients?.fat || 0)} unit="g" textColor="#64748b" bgColor="#f1f5f9" />
                </View>
            </View>
        </TouchableOpacity>
    );
}

const MacroBox = ({ label, value, unit, color, textColor, bgColor }: any) => (
    <View style={[styles.macroBox, { backgroundColor: bgColor || (color + '20') }]}>
        <Text style={[styles.macroLabel, { color: textColor || color }]}>{label}</Text>
        <Text style={[styles.macroValue, { color: textColor || color }]}>{value}{unit}</Text>
    </View>
);

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        overflow: 'hidden',
        flex: 1,
        marginHorizontal: 6,
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    imageContainer: {
        height: 140,
        width: '100%',
        backgroundColor: '#e2e8f0',
        position: 'relative'
    },
    image: {
        width: '100%',
        height: '100%',
    },
    badgesContainer: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        flexDirection: 'row',
        gap: 6
    },
    tagBadge: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    tagText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase'
    },
    layerBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    layerIcon: {
        fontSize: 14,
    },
    favIcon: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
        padding: 6
    },
    favIconActive: {
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    deleteIcon: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(239,68,68,0.75)',
        borderRadius: 20,
        padding: 6,
    },
    content: {
        padding: 12,
    },
    name: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 2
    },
    subtext: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 12
    },
    macrosRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 4,
    },
    macroBox: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 6,
        borderRadius: 6,
    },
    macroLabel: {
        fontSize: 9,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 1
    },
    macroValue: {
        fontSize: 12,
        fontWeight: '700',
    },
});

export default React.memo(FoodGridCard);
