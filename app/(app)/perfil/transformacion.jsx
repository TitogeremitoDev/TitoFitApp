import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Stack } from 'expo-router';

export default function Transformacion() {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Stack.Screen options={{ title: 'Mi Transformación' }} />
            <Text style={[styles.text, { color: theme.text }]}>Mi Transformación</Text>
            <Text style={[styles.subtext, { color: theme.textSecondary }]}>Próximamente...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    subtext: {
        fontSize: 16,
        marginTop: 8,
    },
});
