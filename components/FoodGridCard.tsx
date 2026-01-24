import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FoodItem, LAYER_ICONS } from '../src/services/foodService';

interface FoodGridCardProps {
    item: FoodItem;
    onPress?: () => void;
    isFavorite?: boolean;
    onToggleFavorite?: () => void;
}

export default function FoodGridCard({ item, onPress, isFavorite, onToggleFavorite }: FoodGridCardProps) {
    const layerIcon = LAYER_ICONS[item.layer] || '📦';

    const handleFavoritePress = (e: any) => {
        e.stopPropagation?.();
        onToggleFavorite?.();
    };

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.9}
        >
            {/* Header Image */}
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: item.image || 'https://via.placeholder.com/150' }}
                    style={styles.image}
                    resizeMode="cover"
                />

                {/* Layer Badge (Top-Left) */}
                <View style={styles.layerBadge}>
                    <Text style={styles.layerIcon}>{layerIcon}</Text>
                </View>

                {/* Tags Overlay */}
                <View style={styles.badgesContainer}>
                    {item.tags?.slice(0, 2).map((tag, index) => (
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
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.subtext} numberOfLines={1}>
                    {item.brand || (item.isSystem ? 'Sistema' : 'Personalizado')} • 100g
                </Text>

                {/* Macro Boxes */}
                <View style={styles.macrosRow}>
                    <MacroBox label="Kcal" value={Math.round(item.nutrients?.kcal || 0)} unit="" color="#3b82f6" />
                    <MacroBox label="Prot" value={Math.round(item.nutrients?.protein || 0)} unit="g" color="#3b82f6" />
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
