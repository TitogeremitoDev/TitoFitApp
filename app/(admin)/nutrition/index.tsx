import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

export default function NutritionScreen() {
    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Nutrición', headerShown: true, headerStyle: { backgroundColor: '#1a1a1a' }, headerTintColor: '#fff' }} />
            <Text style={styles.text}>Gestión de Nutrición - Próximamente</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212',
    },
    text: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    }
});
