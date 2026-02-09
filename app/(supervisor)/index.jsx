import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import AvatarWithInitials from '../../src/components/shared/AvatarWithInitials';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

export default function SupervisorDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDashboard = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('totalgains_token');
            const res = await fetch(`${API_URL}/api/supervisor/dashboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (e) {
            console.error('[SupervisorDashboard] Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboard();
    };

    const StatCard = ({ icon, label, value, color, subtext }) => (
        <View style={[styles.statCard, { borderLeftColor: color }]}>
            <View style={[styles.statIconBox, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={22} color={color} />
            </View>
            <View style={styles.statContent}>
                <Text style={styles.statLabel}>{label}</Text>
                {loading ? (
                    <ActivityIndicator size="small" color={color} />
                ) : (
                    <Text style={[styles.statValue, { color }]}>{value ?? '-'}</Text>
                )}
                {subtext && <Text style={styles.statSubtext}>{subtext}</Text>}
            </View>
        </View>
    );

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}
        >
            {/* Header */}
            <View style={styles.header}>
                <AvatarWithInitials
                    name={user?.nombre || 'S'}
                    avatarUrl={user?.avatarUrl}
                    size={56}
                />
                <View style={styles.headerText}>
                    <Text style={styles.greeting}>Hola, {user?.nombre || 'Supervisor'}</Text>
                    <Text style={styles.subtitle}>Panel de Supervisor</Text>
                </View>
            </View>

            {/* KPI Stats */}
            <Text style={styles.sectionTitle}>Resumen del equipo</Text>
            <View style={styles.statsRow}>
                <StatCard
                    icon="people"
                    label="Clientes totales"
                    value={stats?.totalTeamClients}
                    color="#3b82f6"
                />
                <StatCard
                    icon="checkmark-circle"
                    label="Coaches activos"
                    value={stats?.activeTrainers}
                    color="#10B981"
                    subtext={stats ? `de ${stats.totalCoaches}` : null}
                />
                <StatCard
                    icon="alert-circle"
                    label="Riesgo de baja"
                    value={stats?.churnRiskClients}
                    color="#EF4444"
                    subtext="clientes >7d inactivos"
                />
            </View>

            {/* Navigation Cards */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Accesos rapidos</Text>
            <View style={styles.cardsContainer}>
                <TouchableOpacity
                    style={styles.card}
                    onPress={() => router.push('/(supervisor)/team')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.cardIcon, { backgroundColor: '#8b5cf620' }]}>
                        <Ionicons name="people" size={28} color="#8b5cf6" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>Mi Equipo</Text>
                        <Text style={styles.cardDesc}>Gestiona tus entrenadores</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#64748b" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.card}
                    onPress={() => router.replace('/mode-select')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.cardIcon, { backgroundColor: '#3b82f620' }]}>
                        <Ionicons name="grid" size={28} color="#3b82f6" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>Cambiar modo</Text>
                        <Text style={styles.cardDesc}>Volver a seleccion de modo</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#64748b" />
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    content: {
        padding: 24,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 28,
        paddingTop: Platform.OS === 'web' ? 16 : 0,
    },
    headerText: {
        flex: 1,
    },
    greeting: {
        fontSize: 24,
        fontWeight: '700',
        color: '#f8fafc',
    },
    subtitle: {
        fontSize: 14,
        color: '#8b5cf6',
        fontWeight: '600',
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        flexWrap: 'wrap',
    },
    statCard: {
        flex: 1,
        minWidth: 140,
        backgroundColor: '#1e293b',
        borderRadius: 14,
        padding: 16,
        borderLeftWidth: 3,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statContent: {
        flex: 1,
    },
    statLabel: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    statValue: {
        fontSize: 22,
        fontWeight: '800',
        marginTop: 2,
    },
    statSubtext: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
    cardsContainer: {
        gap: 12,
    },
    card: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderWidth: 1,
        borderColor: '#334155',
    },
    cardIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#f8fafc',
    },
    cardDesc: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 2,
    },
});
