import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FoodItem, LAYER_ICONS } from '../src/services/foodService';

interface FoodListCardProps {
    item: FoodItem;
    isLargeScreen: boolean;
    onPress?: () => void;
    isFavorite?: boolean;
    onToggleFavorite?: () => void;
}

export default function FoodListCard({ item, isLargeScreen, onPress, isFavorite, onToggleFavorite }: FoodListCardProps) {
    const layerIcon = LAYER_ICONS[item.layer] || '📦';

    const handleFavoritePress = () => {
        onToggleFavorite?.();
    };

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
            <View style={[styles.contentRow, { flexDirection: isLargeScreen ? 'row' : 'column', gap: 12 }]}>

                {/* Image Section */}
                <View style={[styles.imageContainer, isLargeScreen ? { width: 120, height: 90 } : { width: '100%', height: 150 }]}>
                    {item.image ? (
                        <Image
                            source={{ uri: item.image }}
                            style={styles.image}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.placeholderImage}>
                            <Ionicons name="restaurant-outline" size={32} color="#94a3b8" />
                        </View>
                    )}

                    {/* Layer Badge */}
                    <View style={styles.layerBadge}>
                        <Text style={styles.layerIcon}>{layerIcon}</Text>
                    </View>

                    {/* Favorite Badge */}
                    <TouchableOpacity
                        style={[styles.favBadge, isFavorite && styles.favBadgeActive]}
                        onPress={handleFavoritePress}
                    >
                        <Ionicons
                            name={isFavorite ? "heart" : "heart-outline"}
                            size={16}
                            color={isFavorite ? "#ef4444" : "#94a3b8"}
                        />
                    </TouchableOpacity>
                </View>

                {/* Info Column */}
                <View style={{ flex: 1 }}>
                    <View style={styles.header}>
                        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                        {item.brand && <Text style={styles.brand} numberOfLines={1}>{item.brand}</Text>}
                    </View>

                    {/* Tags / Badges */}
                    <View style={styles.tagsRow}>
                        {item.tags?.slice(0, 3).map((tag, idx) => (
                            <View key={idx} style={styles.tagBadge}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                        {(!item.tags || item.tags.length === 0) && (
                            <View style={[styles.tagBadge, { backgroundColor: '#f1f5f9' }]}>
                                <Text style={[styles.tagText, { color: '#94a3b8' }]}>General</Text>
                            </View>
                        )}
                    </View>

                    {/* Macros Table (Compact) */}
                    <View style={styles.macrosContainer}>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>🔥 {Math.round(item.nutrients.kcal)}</Text>
                            <Text style={styles.macroLabel}>Kcal</Text>
                        </View>
                        <View style={styles.macroSeparator} />
                        <View style={styles.macroItem}>
                            <Text style={[styles.macroValue, { color: '#ef4444' }]}>🥩 {Math.round(item.nutrients.protein)}g</Text>
                            <Text style={styles.macroLabel}>Prot</Text>
                        </View>
                        <View style={styles.macroSeparator} />
                        <View style={styles.macroItem}>
                            <Text style={[styles.macroValue, { color: '#3b82f6' }]}>🍚 {Math.round(item.nutrients.carbs)}g</Text>
                            <Text style={styles.macroLabel}>Carb</Text>
                        </View>
                        <View style={styles.macroSeparator} />
                        <View style={styles.macroItem}>
                            <Text style={[styles.macroValue, { color: '#eab308' }]}>🥑 {Math.round(item.nutrients.fat)}g</Text>
                            <Text style={styles.macroLabel}>Grasa</Text>
                        </View>
                    </View>
                    <Text style={styles.per100g}>Valores por 100g</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    contentRow: {

    },
    imageContainer: {
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    layerBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    layerIcon: {
        fontSize: 14,
    },
    favBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 16,
        padding: 6,
    },
    favBadgeActive: {
        backgroundColor: '#fef2f2',
    },
    header: {
        marginBottom: 6,
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 2,
    },
    brand: {
        fontSize: 12,
        color: '#64748b',
        fontStyle: 'italic',
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    tagBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#d1fae5',
    },
    tagText: {
        fontSize: 10,
        color: '#059669',
        fontWeight: '600',
    },
    macrosContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 8,
        borderRadius: 8,
        justifyContent: 'space-between',
    },
    macroItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroSeparator: {
        width: 1,
        height: '80%',
        backgroundColor: '#e2e8f0',
    },
    macroValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    macroLabel: {
        fontSize: 10,
        color: '#94a3b8',
    },
    per100g: {
        fontSize: 9,
        color: '#cbd5e1',
        textAlign: 'right',
        marginTop: 4,
        fontStyle: 'italic',
    },
});
