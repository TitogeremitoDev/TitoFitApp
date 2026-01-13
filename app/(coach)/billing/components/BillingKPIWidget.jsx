import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BillingKPIWidget({ title, amount, currency = '€', subtitle, icon, color = '#3b82f6', trend, accent }) {
    return (
        <View style={[styles.card, accent && { borderLeftWidth: 4, borderLeftColor: accent }]}>
            <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                    <Ionicons name={icon} size={20} color={color} />
                </View>
                {trend && (
                    <View style={styles.trendContainer}>
                        <Text style={styles.trendText}>{trend}</Text>
                        <Ionicons name="trending-up" size={12} color="#10b981" />
                    </View>
                )}
            </View>

            <View style={styles.content}>
                <Text style={[styles.amount, { color: color === '#3b82f6' ? '#1e40af' : '#0f172a' }]}>
                    {amount}{currency}
                </Text>
                <Text style={styles.title}>{title}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    trendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#d1fae5',
        borderRadius: 20,
        gap: 4,
    },
    trendText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#10b981',
    },
    content: {
        gap: 4,
    },
    amount: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    subtitle: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
});
