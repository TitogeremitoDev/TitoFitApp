import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const STATUS_CONFIG = {
    active: { label: 'Activo', color: '#10b981', bg: '#d1fae5' },
    paid: { label: 'Pagado', color: '#10b981', bg: '#d1fae5' },
    pending: { label: 'Pendiente', color: '#f59e0b', bg: '#fef3c7' },
    overdue: { label: 'Retrasado', color: '#ef4444', bg: '#fee2e2' },
    paused: { label: 'Pausado', color: '#6366f1', bg: '#e0e7ff' },
    cancelled: { label: 'Cancelado', color: '#64748b', bg: '#f1f5f9' },
};

export default function StatusBadge({ status }) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.cancelled;

    return (
        <View style={[styles.badge, { backgroundColor: config.bg }]}>
            <Text style={[styles.text, { color: config.color }]}>
                {config.label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    text: {
        fontSize: 12,
        fontWeight: '600',
    },
});
