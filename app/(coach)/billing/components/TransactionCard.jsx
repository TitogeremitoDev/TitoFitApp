import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';

export default function TransactionCard({ transaction, client, onOptionsPress }) {
    if (!transaction || !client) return null;

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.clientInfo}>
                    <Image source={{ uri: client.avatar }} style={styles.avatar} />
                    <View>
                        <Text style={styles.name}>{client.name}</Text>
                        <Text style={styles.plan}>{transaction.planName}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={onOptionsPress} style={styles.optionsBtn}>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#94a3b8" />
                </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                    <Text style={styles.label}>Estado</Text>
                    <StatusBadge status={transaction.status} />
                </View>
                <View style={styles.detailItem}>
                    <Text style={styles.label}>Importe</Text>
                    <Text style={styles.amount}>{transaction.amount}{transaction.currency}</Text>
                </View>
            </View>

            <View style={styles.footer}>
                <View style={styles.dateInfo}>
                    <Ionicons name="calendar-outline" size={14} color="#64748b" />
                    <Text style={styles.dateText}>
                        Factura: {transaction.billingDate}
                    </Text>
                </View>
                {transaction.paymentDate && (
                    <View style={styles.dateInfo}>
                        <Ionicons name="checkmark-circle-outline" size={14} color="#10b981" />
                        <Text style={[styles.dateText, { color: '#10b981' }]}>
                            Pagado: {transaction.paymentDate}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    clientInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#e2e8f0',
    },
    name: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    plan: {
        fontSize: 13,
        color: '#64748b',
    },
    optionsBtn: {
        padding: 4,
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginBottom: 12,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    detailItem: {
        gap: 6,
    },
    label: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    amount: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1e293b',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        marginHorizontal: -16,
        marginBottom: -16,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    dateInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    dateText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
});
