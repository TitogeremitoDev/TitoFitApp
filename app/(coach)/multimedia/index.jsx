import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CoachHeader from '../components/CoachHeader';

export default function MultimediaScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Multimedia"
                subtitle="Videos y demostraciones"
                icon="film"
                iconColor="#ec4899"
            />
            <View style={styles.content}>
                <Ionicons name="film-outline" size={80} color="#ec4899" />
                <Text style={styles.placeholderText}>Biblioteca Multimedia</Text>
                <Text style={styles.subText}>Videos, fotos y demostraciones de ejercicios.</Text>
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
