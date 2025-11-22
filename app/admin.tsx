import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function AdminPanel() {
    const { isDark } = useTheme();

    return (
        <View style={[
            styles.container,
            { backgroundColor: isDark ? '#111827' : '#f3f4f6' }
        ]}>
            <Text style={[
                styles.title,
                { color: isDark ? '#ffffff' : '#1f2937' }
            ]}>
                Panel de Administración
            </Text>
            <Text style={[
                styles.subtitle,
                { color: isDark ? '#9ca3af' : '#6b7280' }
            ]}>
                Próximamente...
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
    },
});
