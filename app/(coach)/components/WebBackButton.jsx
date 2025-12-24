/**
 * WebBackButton.jsx - Botón de retroceso solo para web
 * Aparece solo en Platform.OS === 'web' para navegación
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function WebBackButton({ title = 'Volver', style = {} }) {
    const router = useRouter();

    // Solo mostrar en web
    if (Platform.OS !== 'web') {
        return null;
    }

    return (
        <TouchableOpacity
            style={[styles.container, style]}
            onPress={() => router.back()}
        >
            <Ionicons name="arrow-back" size={20} color="#64748b" />
            <Text style={styles.text}>{title}</Text>
        </TouchableOpacity>
    );
}

// Versión con título de página
export function WebHeader({ title, subtitle }) {
    const router = useRouter();

    if (Platform.OS !== 'web') {
        return null;
    }

    return (
        <View style={styles.headerContainer}>
            <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.back()}
            >
                <Ionicons name="arrow-back" size={22} color="#1e293b" />
            </TouchableOpacity>
            <View style={styles.headerText}>
                <Text style={styles.headerTitle}>{title}</Text>
                {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8,
        gap: 8
    },
    text: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500'
    },
    // Header styles
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        gap: 12
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerText: {
        flex: 1
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b'
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2
    }
});
