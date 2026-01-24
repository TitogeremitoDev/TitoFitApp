import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FoodItem } from '../src/services/foodService';

interface FoodMiniCardProps {
    item: FoodItem;
    onPress?: () => void;
}

export default function FoodMiniCard({ item, onPress }: FoodMiniCardProps) {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: item.image || 'https://via.placeholder.com/150' }}
                    style={styles.image}
                />
                <View style={styles.miniFav}>
                    <Ionicons name="heart" size={10} color="#fff" />
                </View>
            </View>
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        width: 100, // Fixed width
        alignItems: 'center',
        marginRight: 12,
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        // Subtle shadow
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
    },
    imageContainer: {
        position: 'relative',
        marginBottom: 8
    },
    image: {
        width: 60,
        height: 60,
        borderRadius: 30, // Circle
        backgroundColor: '#cbd5e1'
    },
    miniFav: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#3b82f6',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#fff'
    },
    name: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        textAlign: 'center',
        height: 32 // 2 lines approx
    }
});
