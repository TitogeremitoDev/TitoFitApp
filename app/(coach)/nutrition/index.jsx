import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CoachHeader from '../components/CoachHeader';

export default function NutritionScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Nutrición"
                subtitle="Planes y macros"
                icon="nutrition"
                iconColor="#22c55e"
            />
            <View style={styles.content}>
                <Ionicons name="nutrition-outline" size={80} color="#22c55e" />
                <Text style={styles.placeholderText}>Planes Nutricionales</Text>
                <Text style={styles.subText}>Crea y asigna dietas y macros a tus clientes.</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backButton: { padding: 8, marginRight: 8 },
    title: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    placeholderText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 16,
    },
    subText: {
        fontSize: 16,
        color: '#64748b',
        marginTop: 8,
        textAlign: 'center',
    },
});
