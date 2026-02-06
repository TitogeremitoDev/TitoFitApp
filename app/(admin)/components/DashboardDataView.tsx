import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import KPIGrid from './KPIGrid';
import RetentionChart from './RetentionChart';
import SimpleLogFeed from './SimpleLogFeed';
import DevActions from './DevActions';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

export default function DashboardDataView() {
    const [loading, setLoading] = useState(true);
    // Remove old kpiData state
    const [chartData, setChartData] = useState({
        labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
        new_users: [0, 0, 0, 0],
        churned_users: [0, 0, 0, 0]
    });
    const [feedData, setFeedData] = useState<any[]>([]);
    const [selectedRange, setSelectedRange] = useState<'WEEK' | 'MONTH' | 'YEAR' | 'ALL'>('ALL');
    const [userFilter, setUserFilter] = useState<'ALL' | 'CLIENTE' | 'ENTRENADOR' | 'ABONAN' | 'GRATIS'>('ALL');
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [kpiItems, setKpiItems] = useState<any[]>([]);
    const [allFeedbackCount, setAllFeedbackCount] = useState(0);
    const [debugInfo, setDebugInfo] = useState<any>(null);

    const filterRanges = {
        'WEEK': { label: '7D', days: 7 },
        'MONTH': { label: '30D', days: 30 },
        'YEAR': { label: '1A', days: 365 },
        'ALL': { label: 'TOTAL', days: 99999 }
    };

    // Recalculate KPIs when Range, User Filter or Data changes
    useEffect(() => {
        if (!allUsers.length) return;

        const now = new Date();
        const days = filterRanges[selectedRange].days;
        const cutoffDate = new Date(now.setDate(now.getDate() - days));

        // 1. Time Filter
        let filtered = selectedRange === 'ALL'
            ? allUsers
            : allUsers.filter((u: any) => new Date(u.createdAt) >= cutoffDate);

        // 2. User Type/Status Filter
        if (userFilter === 'CLIENTE' || userFilter === 'ENTRENADOR') {
            filtered = filtered.filter((u: any) => u.tipoUsuario === userFilter);
        } else if (userFilter === 'ABONAN') {
            // "ABONAN" = Entrenadores OR Clientes Premium (Active)
            filtered = filtered.filter((u: any) => u.tipoUsuario === 'ENTRENADOR' || u.subscriptionStatus === 'active');
        } else if (userFilter === 'GRATIS') {
            // "GRATIS" = Clientes Free (NOT Premium)
            filtered = filtered.filter((u: any) => u.tipoUsuario === 'CLIENTE' && u.subscriptionStatus !== 'active');
        }

        // --- CALCULATION ON FILTERED SET ---
        const totalCount = filtered.length;

        // "ABONAN" Count in current view (Trainers + Active)
        const abonanCount = filtered.filter((u: any) => u.tipoUsuario === 'ENTRENADOR' || u.subscriptionStatus === 'active').length;
        // "GRATIS" Count in current view (Clients + Inactive)
        const gratisCount = filtered.filter((u: any) => u.tipoUsuario === 'CLIENTE' && u.subscriptionStatus !== 'active').length;

        const revenue = filtered.reduce((acc: number, u: any) => acc + (Number(u.totalSpent) || 0), 0);

        const churnRisk = filtered.filter((u: any) =>
            u.tipoUsuario === 'CLIENTE' &&
            (u.subscriptionStatus !== 'active' || u.posibleAbandono)
        ).length;

        // Dynamic Label based on filter
        let scopeLabel = 'USUARIOS';
        if (userFilter === 'CLIENTE') scopeLabel = 'CLIENTES';
        else if (userFilter === 'ENTRENADOR') scopeLabel = 'COACHES';
        else if (userFilter === 'ABONAN') scopeLabel = 'ABONAN';
        else if (userFilter === 'GRATIS') scopeLabel = 'GRATIS';

        setKpiItems([
            { label: `TOTAL ${scopeLabel}`, value: totalCount },
            { label: 'ABONAN (COACH+PREM)', value: abonanCount, color: '#00ff00' },
            { label: 'GRATIS (FREE)', value: gratisCount, color: '#ffaa00' },
            { label: 'INGRESOS (MRR)', value: `$${revenue.toFixed(0)}`, color: '#00ffff' },
            { label: 'RIESGO ABANDONO', value: churnRisk, color: '#ff4444', borderColor: '#ff4444' },
            { label: 'TICKETS ABIERTOS', value: allFeedbackCount }
        ]);

        // Logs Generation
        const rangeLogs: any[] = [];
        const sorted = [...filtered].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
        sorted.forEach((u: any) => {
            rangeLogs.push({
                id: u._id,
                type: 'SUCCESS',
                msg: `Alta: ${u.nombre} (${u.tipoUsuario === 'ENTRENADOR' ? 'Coach' : 'Cliente'})`,
                ts: new Date(u.createdAt).toLocaleDateString()
            });
        });

        setFeedData(rangeLogs.length > 0 ? rangeLogs : [{ id: 0, type: 'INFO', msg: `No hay registros en este filtro`, ts: '-' }]);

    }, [selectedRange, userFilter, allUsers, allFeedbackCount]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const token = await AsyncStorage.getItem('totalgains_token');
                if (!token) throw new Error("No Token");

                // 1. Fetch Users (Real Data Only)
                const usersResponse = await fetch(`${API_URL}/api/users`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                // 2. Fetch Unread Feedbacks (Real Tickets Data Only)
                const feedbackResponse = await fetch(`${API_URL}/api/feedback-reports/unread-count`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).catch(() => null);

                const usersData = await usersResponse.json();
                const feedbackData = feedbackResponse ? await feedbackResponse.json() : { count: 0 };

                let activeUsers = 0;
                let churnRisk = 0;
                let realRevenue = 0; // Strict sum of totalSpent
                const recentLogs: any[] = [];
                // Chart Data Arrays
                const last4Weeks = [0, 0, 0, 0];
                const churned4Weeks = [0, 0, 0, 0];

                if (usersResponse.ok) {
                    const usersList = Array.isArray(usersData) ? usersData : (usersData.users || []);
                    setAllUsers(usersList);
                    setAllFeedbackCount(feedbackData.count || 0);

                    // DEBUG CAPTURE
                    const countClients = usersList.filter((u: any) => u.tipoUsuario === 'CLIENTE').length;
                    const countTrainers = usersList.filter((u: any) => u.tipoUsuario === 'ENTRENADOR').length;
                    const countActiveTotal = usersList.filter((u: any) => u.subscriptionStatus === 'active').length;

                    setDebugInfo({
                        totalFound: usersList.length,
                        countClients,
                        countTrainers,
                        countActiveTotal,
                        firstUser: usersList.length > 0 ? usersList[0] : "No users found",
                        rangeMode: selectedRange
                    });

                    // --- Chart Data Approximate (From DB Dates) ---
                    // Simple bucketing of creation dates for "New Users"
                    // Week 0 = This week, Week 3 = 4 weeks ago
                    const now = new Date();
                    usersList.forEach((u: any) => {
                        const created = new Date(u.createdAt);
                        const diffTime = Math.abs(now.getTime() - created.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays <= 7) last4Weeks[3]++;
                        else if (diffDays <= 14) last4Weeks[2]++;
                        else if (diffDays <= 21) last4Weeks[1]++;
                        else if (diffDays <= 28) last4Weeks[0]++;
                    });
                }

                // Note: KPI setting moved to useEffect [selectedRange]

                setChartData({
                    labels: ["-3 Sem", "-2 Sem", "-1 Sem", "Actual"],
                    new_users: last4Weeks,
                    churned_users: churned4Weeks
                });

            } catch (error) {
                console.error("Fetch Error:", error);
                setDebugInfo({ error: JSON.stringify(error) });
                setDebugInfo({ error: JSON.stringify(error) });
                setKpiItems([]);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []); // Only on mount. Range changes handled by separate effect.


    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00ff00" />
                <Text style={styles.loadingText}>CARGANDO DATOS EN TIEMPO REAL...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerControls}>
                <Text style={{ color: '#666', fontSize: 10, marginBottom: 5 }}>API: {API_URL}</Text>

                {/* TIME FILTER BUTTONS */}
                <View style={[styles.filterRow, { marginBottom: 5 }]}>
                    {(['WEEK', 'MONTH', 'YEAR', 'ALL'] as const).map((r) => (
                        <Text
                            key={r}
                            onPress={() => setSelectedRange(r)}
                            style={[styles.filterBtn, selectedRange === r && styles.filterBtnActive]}
                        >
                            {filterRanges[r].label}
                        </Text>
                    ))}
                </View>

                {/* USER TYPE FILTER BUTTONS */}
                <View style={[styles.filterRow, { flexWrap: 'wrap' }]}>
                    {(['ALL', 'CLIENTE', 'ENTRENADOR', 'ABONAN', 'GRATIS'] as const).map((t) => (
                        <Text
                            key={t}
                            onPress={() => setUserFilter(t)}
                            style={[styles.filterBtn, userFilter === t && styles.filterBtnActive, { fontSize: 10 }]}
                        >
                            {t === 'ALL' ? 'TODOS' : (t === 'ABONAN' ? 'ABONAN' : (t === 'GRATIS' ? 'GRATIS' : (t === 'CLIENTE' ? 'CLIENTES' : 'COACHES')))}
                        </Text>
                    ))}
                </View>

                <DevActions />
                <View style={{ marginTop: 10 }}>
                    <Text style={{ color: 'cyan', textAlign: 'center' }} onPress={() => { }}>[ RECARGAR (Auto) ]</Text>
                </View>
            </View>

            <KPIGrid data={kpiItems} />
            <RetentionChart data={chartData} />
            <SimpleLogFeed data={feedData} />

            {/* DEBUG PANEL */}
            {debugInfo && (
                <View style={styles.debugPanel}>
                    <Text style={styles.debugTitle}>--- DEBUG DATA DIAGNOSTIC ---</Text>
                    <Text style={styles.debugText}>Range: {debugInfo.rangeMode}</Text>
                    <Text style={styles.debugText}>Total Users fetched: {debugInfo.totalFound}</Text>
                    <Text style={styles.debugText}>Clients: {debugInfo.countClients} | Trainers: {debugInfo.countTrainers}</Text>
                    <Text style={styles.debugText}>Total Active Subs (All Types): {debugInfo.countActiveTotal}</Text>
                    <View style={styles.divider} />
                    <Text style={styles.debugText}>First User Object Sample ({debugInfo.firstUser?.tipoUsuario}):</Text>
                    <Text style={styles.debugJson}>
                        {JSON.stringify(debugInfo.firstUser, null, 2)}
                    </Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111',
    },
    content: {
        padding: 20,
        paddingBottom: 50,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    loadingText: {
        color: '#00ff00',
        marginTop: 20,
        fontFamily: 'monospace',
        fontWeight: 'bold',
    },
    headerControls: {
        marginBottom: 20,
        padding: 10,
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333'
    },
    debugPanel: {
        marginTop: 30,
        padding: 15,
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: '#f00',
        borderRadius: 8
    },
    debugTitle: {
        color: '#f00',
        fontWeight: 'bold',
        marginBottom: 10,
        fontSize: 12
    },
    debugText: {
        color: '#ccc',
        fontSize: 12,
        marginBottom: 4,
        fontFamily: 'monospace'
    },
    debugJson: {
        color: '#0f0',
        fontSize: 10,
        fontFamily: 'monospace',
        marginTop: 5
    },
    divider: {
        height: 1,
        backgroundColor: '#333',
        marginVertical: 10
    },
    filterRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 10,
        backgroundColor: '#000',
        padding: 5,
        borderRadius: 8
    },
    filterBtn: {
        color: '#666',
        fontWeight: 'bold',
        padding: 8,
    },
    filterBtnActive: {
        color: '#00ff00',
        textDecorationLine: 'underline'
    }
});
