import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CoachHeader from '../components/CoachHeader';

export default function BillingScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Facturación"
                subtitle="Pagos y suscripciones"
                icon="card"
                iconColor="#14b8a6"
            />

            <View style={styles.content}>
                <Ionicons name="card-outline" size={80} color="#14b8a6" />
                <Text style={styles.placeholderText}>Pagos y Suscripciones</Text>
                <Text style={styles.subText}>Gestiona tus ingresos, planes de suscripción y pagos de clientes.</Text>
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
