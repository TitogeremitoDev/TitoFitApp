/**
 * SupplementFooter.jsx
 * Footer que muestra los suplementos a tomar con una comida (Vista Cliente)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../../../context/ThemeContext';
import { useSupplementInventory } from '../../../../../src/context/SupplementInventoryContext';
import { calculateDaysRemaining, getStockStatus } from '../../../../../src/utils/supplementCalculator';
import { SUPPLEMENT_TIMINGS } from '../../../../../src/constants/commonSupplements';

export default function SupplementFooter({ supplements, showAlerts = true }) {
    const { theme } = useTheme();

    // Intentar usar inventario si está disponible (puede no estar en el provider)
    let inventory = [];
    try {
        const ctx = useSupplementInventory();
        inventory = ctx?.inventory || [];
    } catch {
        // Context no disponible, continuar sin alertas de stock
    }

    if (!supplements || supplements.length === 0) return null;

    // Obtener label de timing
    const getTimingInfo = (timingId) => {
        const timing = SUPPLEMENT_TIMINGS.find(t => t.id === timingId);
        return timing || { icon: '🍽️', label: 'Con la comida' };
    };

    // Calcular alerta de stock para un suplemento
    const getStockAlert = (suppName) => {
        if (!showAlerts || inventory.length === 0) return null;

        const stockItem = inventory.find(item =>
            item.name.toLowerCase().trim() === suppName.toLowerCase().trim()
        );

        if (!stockItem) return null;

        // Asumimos 1 dosis por día para cálculo simple
        const consumption = { dailyAmount: 1 };
        const daysRemaining = calculateDaysRemaining(stockItem, consumption);

        if (daysRemaining <= 7) {
            const status = getStockStatus(daysRemaining);
            return {
                daysRemaining,
                ...status
            };
        }

        return null;
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.cardBackground, borderTopColor: theme.borderLight }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerIcon}>💊</Text>
                <Text style={[styles.headerText, { color: theme.textSecondary }]}>
                    SUPLEMENTOS
                </Text>
            </View>

            {/* Lista de suplementos */}
            <View style={styles.list}>
                {supplements.map((supp, idx) => {
                    const timingInfo = getTimingInfo(supp.timing);
                    const stockAlert = getStockAlert(supp.name);

                    return (
                        <View key={supp.id || idx} style={styles.item}>
                            <View style={styles.itemMain}>
                                <Text style={styles.timingIcon}>{timingInfo.icon}</Text>
                                <View style={styles.itemInfo}>
                                    <Text style={[styles.itemDose, { color: theme.text }]}>
                                        {supp.amount} {supp.unit}
                                    </Text>
                                    <Text style={[styles.itemName, { color: theme.textSecondary }]}>
                                        {supp.name}
                                    </Text>
                                </View>
                            </View>

                            {/* Alerta de stock bajo */}
                            {stockAlert && (
                                <View style={[styles.alertBadge, { backgroundColor: stockAlert.color + '20' }]}>
                                    <Text style={[styles.alertText, { color: stockAlert.color }]}>
                                        {stockAlert.statusIcon} {stockAlert.daysRemaining}d
                                    </Text>
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderTopWidth: 1,
        borderStyle: 'dashed',
        marginTop: 8,
        paddingTop: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    headerIcon: {
        fontSize: 12,
    },
    headerText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    list: {
        gap: 6,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    itemMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    timingIcon: {
        fontSize: 14,
    },
    itemInfo: {
        flex: 1,
    },
    itemDose: {
        fontSize: 13,
        fontWeight: '700',
    },
    itemName: {
        fontSize: 11,
    },
    alertBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    alertText: {
        fontSize: 10,
        fontWeight: '700',
    },
});
