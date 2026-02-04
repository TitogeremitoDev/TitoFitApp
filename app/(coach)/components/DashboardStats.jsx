import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const StatCard = ({ title, value, subtext, icon, color, trend }) => (
    <View style={styles.card}>
        <View style={styles.headerRow}>
            <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            {trend && (
                <View style={[styles.trendBadge, { backgroundColor: trend > 0 ? '#dcfce7' : '#fee2e2' }]}>
                    <Ionicons
                        name={trend > 0 ? 'arrow-up' : 'arrow-down'}
                        size={12}
                        color={trend > 0 ? '#16a34a' : '#dc2626'}
                    />
                    <Text style={[styles.trendText, { color: trend > 0 ? '#16a34a' : '#dc2626' }]}>
                        {Math.abs(trend)}%
                    </Text>
                </View>
            )}
        </View>
        <View style={styles.content}>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.title}>{title}</Text>
            {subtext && <Text style={styles.subtext}>{subtext}</Text>}
        </View>
    </View>
);

const DashboardStats = ({ stats }) => {
    const {
        totalClients = 0,
        maxClients = 0,
        avgCompliance = 0,
        alertsCount = 0,
        renewalsCount = 0
    } = stats;

    return (
        <View style={styles.container}>
            <StatCard
                title="Atletas Activos"
                value={`${totalClients}/${maxClients}`}
                subtext="+3 esta semana"
                icon="people"
                color="#3b82f6"
                trend={5.2}
            />
            <StatCard
                title="Compliance Global"
                value={`${avgCompliance}%`}
                subtext="Promedio semanal"
                icon="checkmark-circle"
                color="#10b981"
                trend={1.2}
            />
            <StatCard
                title="Renovaciones"
                value={renewalsCount}
                subtext="Próximos 7 días"
                icon="card"
                color="#f59e0b"
            />
            <StatCard
                title="Requieren Atención"
                value={alertsCount}
                subtext="Sin check-in"
                icon="alert-circle"
                color="#ef4444"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8, // Reduced gap
        marginBottom: 24, // Increased bottom margin
    },
    card: {
        flex: 1,
        minWidth: 130, // Reduced min width
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12, // Reduced padding
        borderWidth: 1,
        borderColor: '#e2e8f0',
        // Shadow for premium feel
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03, // Softer shadow
        shadowRadius: 4,
        elevation: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8, // Reduced margin
    },
    iconContainer: {
        width: 32, // Smaller icon container
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 10,
        gap: 2,
    },
    trendText: {
        fontSize: 10,
        fontWeight: '600',
    },
    content: {
        gap: 2, // Reduced gap
    },
    value: {
        fontSize: 20, // Smaller font size
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    title: {
        fontSize: 10, // Smaller font size
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    subtext: {
        fontSize: 10, // Smaller font size
        color: '#94a3b8',
    }
});

export default DashboardStats;
