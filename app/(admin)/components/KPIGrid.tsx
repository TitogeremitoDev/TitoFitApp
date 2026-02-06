import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface KPIItem {
    label: string;
    value: string | number;
    color?: string;
    borderColor?: string;
}

interface KPIProps {
    data: KPIItem[];
}

export default function KPIGrid({ data }: KPIProps) {
    if (!data || !Array.isArray(data)) return null;

    return (
        <View style={styles.container}>
            {data.map((item, index) => (
                <View key={index} style={[styles.card, item.borderColor ? { borderColor: item.borderColor } : {}]}>
                    <Text style={[styles.label, item.color ? { color: item.color } : {}]}>{item.label}</Text>
                    <Text style={[styles.value, item.color ? { color: item.color } : {}]}>{item.value}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    card: {
        flex: 1,
        minWidth: 150,
        padding: 15,
        backgroundColor: '#1a1a1a', // Slightly lighter than background
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        justifyContent: 'center'
    },
    label: {
        color: '#888',
        fontSize: 11,
        marginBottom: 5,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: '600'
    },
    value: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        fontFamily: 'monospace'
    },
});
