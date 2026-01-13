/**
 * OverQuotaBanner.jsx
 * Banner rojo persistente para coaches que exceden su cuota de clientes
 * Visible en TODAS las pantallas del dashboard
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OverQuotaBanner({ overQuota, onPress }) {
    if (!overQuota?.isOverQuota) return null;

    const { currentClients, maxClients, daysFrozen } = overQuota;

    return (
        <TouchableOpacity
            style={styles.banner}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.content}>
                <Ionicons name="warning" size={20} color="#fff" style={styles.icon} />
                <View style={styles.textContainer}>
                    <Text style={styles.title}>
                        ⚠️ Límite Excedido: {currentClients}/{maxClients} clientes activos
                    </Text>
                    <Text style={styles.subtitle}>
                        Tu cuenta está en modo lectura. Toca para resolver.
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
            </View>

            {daysFrozen >= 7 && (
                <View style={styles.urgentBadge}>
                    <Text style={styles.urgentText}>
                        ⏰ Día {daysFrozen} - Tus clientes pronto recibirán ofertas alternativas
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    banner: {
        backgroundColor: '#DC2626', // Red-600
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#B91C1C', // Red-700
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        marginRight: 10,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        marginTop: 2,
    },
    urgentBadge: {
        marginTop: 8,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    urgentText: {
        color: '#FEF08A', // Yellow-200
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
});
