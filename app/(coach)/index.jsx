import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, ScrollView, SafeAreaView
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function CoachDashboard() {
    const { token } = useAuth();
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState([]);
    const [codes, setCodes] = useState([]);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            const [clientsRes, codesRes] = await Promise.all([
                fetch(`${API_URL}/api/coach/clients`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_URL}/api/coach/codes`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            const clientsData = await clientsRes.json();
            const codesData = await codesRes.json();

            setClients(clientsData.clients || []);
            setCodes(codesData.codes || []);
        } catch (error) {
            console.error('Error loading data:', error);
            Alert.alert('Error', 'No se pudieron cargar los datos');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateCode = async () => {
        try {
            const res = await fetch(`${API_URL}/api/coach/generate-code`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    maxUses: 10,
                    expiresInDays: 30
                })
            });

            const data = await res.json();

            if (data.success) {
                await loadData();
                Alert.alert('¡Código Generado!', `Código: ${data.code}`, [
                    {
                        text: 'Copiar',
                        onPress: () => {
                            Clipboard.setStringAsync(data.code);
                            Alert.alert('Copiado', 'Código copiado al portapapeles');
                        }
                    },
                    { text: 'OK' }
                ]);
            } else {
                Alert.alert('Error', data.message || 'No se pudo generar el código');
            }
        } catch (error) {
            Alert.alert('Error', 'Error al generar código');
        }
    };

    const copyToClipboard = (code) => {
        Clipboard.setStringAsync(code);
        Alert.alert('Copiado', `Código ${code} copiado al portapapeles`);
    };

    const renderClient = (item) => (
        <View key={item._id} style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.cardContent}>
                <Ionicons name="person-circle" size={40} color={theme.primary} />
                <View style={styles.clientInfo}>
                    <Text style={[styles.clientName, { color: theme.text }]}>{item.nombre}</Text>
                    <Text style={[styles.clientEmail, { color: theme.textSecondary }]}>{item.email}</Text>
                    <Text style={[styles.clientDate, { color: theme.textTertiary }]}>
                        Desde: {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                </View>
            </View>
        </View>
    );

    const renderCode = (item) => {
        const isActive = item.active && new Date(item.expiresAt) > new Date();

        return (
            <View key={item._id} style={[styles.codeCard, {
                backgroundColor: theme.cardBackground,
                borderColor: isActive ? theme.success : theme.danger,
                borderWidth: 2
            }]}>
                <View style={styles.codeHeader}>
                    <View style={styles.codeInfo}>
                        <Text style={[styles.codeText, { color: theme.text, fontFamily: 'monospace' }]}>
                            {item.code}
                        </Text>
                        <Text style={[styles.codeStatus, { color: isActive ? theme.success : theme.danger }]}>
                            {isActive ? '✓ Activo' : '✗ Inactivo'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.copyBtn, { backgroundColor: theme.primary }]}
                        onPress={() => copyToClipboard(item.code)}
                    >
                        <Ionicons name="copy" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
                <Text style={[styles.codeDetail, { color: theme.textSecondary }]}>
                    Usos: {item.usedCount}/{item.maxUses} | Expira: {new Date(item.expiresAt).toLocaleDateString()}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.loading, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView>
                {/* Estadísticas */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: theme.primary }]}>
                        <Text style={styles.statNumber}>{clients.length}</Text>
                        <Text style={styles.statLabel}>Clientes</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: theme.success }]}>
                        <Text style={styles.statNumber}>{codes.filter(c => c.active).length}</Text>
                        <Text style={styles.statLabel}>Códigos Activos</Text>
                    </View>
                </View>

                {/* Botón Generar Código */}
                <TouchableOpacity
                    style={[styles.generateBtn, { backgroundColor: theme.primary }]}
                    onPress={handleGenerateCode}
                >
                    <Ionicons name="add-circle" size={24} color="#fff" />
                    <Text style={styles.generateBtnText}>Generar Código de Invitación</Text>
                </TouchableOpacity>

                {/* Códigos */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Códigos de Invitación</Text>
                    {codes.length === 0 ? (
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                            No has generado códigos todavía
                        </Text>
                    ) : (
                        codes.slice(0, 5).map(code => renderCode(code))
                    )}
                </View>

                {/* Clientes */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Mis Clientes</Text>
                    {clients.length === 0 ? (
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                            Aún no tienes clientes asociados
                        </Text>
                    ) : (
                        clients.map(client => renderClient(client))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
    statCard: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
    statNumber: { fontSize: 32, fontWeight: '700', color: '#fff' },
    statLabel: { fontSize: 14, color: '#fff', marginTop: 4 },
    generateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        margin: 16,
        padding: 16,
        borderRadius: 12
    },
    generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    section: { padding: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    emptyText: { textAlign: 'center', marginTop: 20 },
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        marginBottom: 8
    },
    cardContent: { flexDirection: 'row', alignItems: 'center' },
    clientInfo: { marginLeft: 12, flex: 1 },
    clientName: { fontSize: 16, fontWeight: '600' },
    clientEmail: { fontSize: 14, marginTop: 2 },
    clientDate: { fontSize: 12, marginTop: 4 },
    codeCard: {
        borderRadius: 12,
        padding: 12,
        marginBottom: 8
    },
    codeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    codeInfo: { flex: 1 },
    codeText: { fontSize: 20, fontWeight: '700', letterSpacing: 2 },
    codeStatus: { fontSize: 12, fontWeight: '600', marginTop: 4 },
    copyBtn: { padding: 10, borderRadius: 8 },
    codeDetail: { fontSize: 12, marginTop: 8 }
});
