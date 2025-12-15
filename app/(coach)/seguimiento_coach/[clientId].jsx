/* app/(coach)/seguimiento/[clientId].jsx - Detalle de Seguimiento de un Cliente */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const MOOD_EMOJIS = ['', '😢', '😕', '😐', '🙂', '😄'];

const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (dateStr) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function ClientSeguimientoDetailScreen() {
    const { clientId, clientName } = useLocalSearchParams();
    const router = useRouter();
    const { token } = useAuth();

    const [dailyRecords, setDailyRecords] = useState([]);
    const [weeklyRecords, setWeeklyRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('daily');

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    // ─────────────────────────────────────────────────────────────────────────
    // CARGAR DATOS Y MARCAR COMO VISTO
    // ─────────────────────────────────────────────────────────────────────────
    const fetchClientHistory = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);

            const res = await fetch(`${API_URL}/api/monitoring/coach/client/${clientId}/history`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (data.success) {
                setDailyRecords(data.daily || []);
                setWeeklyRecords(data.weekly || []);
            }

            // Marcar como visto al entrar
            await fetch(`${API_URL}/api/monitoring/coach/mark-viewed`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ clientId, type: 'both' }),
            });
        } catch (error) {
            console.error('[Seguimiento Detail] Error:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [clientId, token, API_URL]);

    useEffect(() => {
        fetchClientHistory();
    }, [fetchClientHistory]);

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchClientHistory(true);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER DAILY RECORD
    // ─────────────────────────────────────────────────────────────────────────
    const renderDailyRecord = (record) => (
        <View key={record._id} style={styles.recordCard}>
            <View style={styles.recordHeader}>
                <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                {record.coachViewedAt && (
                    <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                )}
            </View>

            <View style={styles.recordGrid}>
                {record.peso && (
                    <View style={styles.recordItem}>
                        <Ionicons name="scale-outline" size={18} color="#64748b" />
                        <Text style={styles.recordValue}>{record.peso} kg</Text>
                        <Text style={styles.recordLabel}>Peso</Text>
                    </View>
                )}

                {record.sueno && (
                    <View style={styles.recordItem}>
                        <Ionicons name="bed-outline" size={18} color="#64748b" />
                        <Text style={styles.recordValue}>{record.sueno}h</Text>
                        <Text style={styles.recordLabel}>Sueño</Text>
                    </View>
                )}

                {record.animo && (
                    <View style={styles.recordItem}>
                        <Text style={styles.moodEmoji}>{MOOD_EMOJIS[record.animo]}</Text>
                        <Text style={styles.recordLabel}>Ánimo</Text>
                    </View>
                )}

                {record.energia && (
                    <View style={styles.recordItem}>
                        <Ionicons name="flash" size={18} color="#f59e0b" />
                        <Text style={styles.recordValue}>{record.energia}/5</Text>
                        <Text style={styles.recordLabel}>Energía</Text>
                    </View>
                )}

                {record.hambre && (
                    <View style={styles.recordItem}>
                        <Ionicons name="restaurant-outline" size={18} color="#64748b" />
                        <Text style={styles.recordValue}>{record.hambre}/5</Text>
                        <Text style={styles.recordLabel}>Hambre</Text>
                    </View>
                )}

                {record.pasos && (
                    <View style={styles.recordItem}>
                        <Ionicons name="footsteps-outline" size={18} color="#64748b" />
                        <Text style={styles.recordValue}>{record.pasos.toLocaleString()}</Text>
                        <Text style={styles.recordLabel}>Pasos</Text>
                    </View>
                )}
            </View>

            {record.haIdoBien && (
                <View style={styles.haIdoBienRow}>
                    <Text style={styles.haIdoBienLabel}>¿Ha ido bien?</Text>
                    <View style={[
                        styles.haIdoBienBadge,
                        {
                            backgroundColor: record.haIdoBien === 'si' ? '#10b98120' :
                                record.haIdoBien === 'medio' ? '#f59e0b20' : '#ef444420'
                        }
                    ]}>
                        <Text style={[
                            styles.haIdoBienText,
                            {
                                color: record.haIdoBien === 'si' ? '#10b981' :
                                    record.haIdoBien === 'medio' ? '#f59e0b' : '#ef4444'
                            }
                        ]}>
                            {record.haIdoBien === 'si' ? '✅ Sí' :
                                record.haIdoBien === 'medio' ? '🤔 Medio' : '❌ No'}
                        </Text>
                    </View>
                </View>
            )}

            {record.nota && (
                <View style={styles.notaContainer}>
                    <Text style={styles.notaLabel}>Nota:</Text>
                    <Text style={styles.notaText}>{record.nota}</Text>
                </View>
            )}
        </View>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER WEEKLY RECORD
    // ─────────────────────────────────────────────────────────────────────────
    const renderWeeklyRecord = (record) => (
        <View key={record._id} style={styles.recordCard}>
            <View style={styles.recordHeader}>
                <Text style={styles.recordDate}>Semana del {formatDate(record.weekStartDate)}</Text>
                {record.coachViewedAt && (
                    <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                )}
            </View>

            {/* Nutrición */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>🍽️</Text>
                <Text style={styles.sectionTitle}>Nutrición</Text>
            </View>
            <View style={styles.recordGrid}>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.nutriAdherencia || '--'}/10</Text>
                    <Text style={styles.recordLabel}>Adherencia</Text>
                </View>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.nutriSaciedad || '--'}/5</Text>
                    <Text style={styles.recordLabel}>Saciedad</Text>
                </View>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.nutriGI || '--'}/5</Text>
                    <Text style={styles.recordLabel}>Gastroint.</Text>
                </View>
            </View>
            {record.nutriComentario && (
                <Text style={styles.comentarioText}>{record.nutriComentario}</Text>
            )}

            {/* Entrenamiento */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>💪</Text>
                <Text style={styles.sectionTitle}>Entrenamiento</Text>
            </View>
            <View style={styles.recordGrid}>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.entrenoAdherencia || '--'}/10</Text>
                    <Text style={styles.recordLabel}>Adherencia</Text>
                </View>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.entrenoRendimiento || '--'}/10</Text>
                    <Text style={styles.recordLabel}>Rendimiento</Text>
                </View>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.entrenoFatiga || '--'}/5</Text>
                    <Text style={styles.recordLabel}>Fatiga</Text>
                </View>
            </View>
            {record.entrenoMolestias && (
                <View style={styles.alertBox}>
                    <Ionicons name="warning" size={16} color="#ef4444" />
                    <Text style={styles.alertText}>
                        Molestias: {record.entrenoMolestiasTexto || 'Sí'}
                    </Text>
                </View>
            )}

            {/* Sensaciones */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>🧠</Text>
                <Text style={styles.sectionTitle}>Sensaciones</Text>
            </View>
            <View style={styles.recordGrid}>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.sensMotivacion || '--'}/5</Text>
                    <Text style={styles.recordLabel}>Motivación</Text>
                </View>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.sensEstres || '--'}/5</Text>
                    <Text style={styles.recordLabel}>Estrés</Text>
                </View>
                <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{record.sensEmocional || '--'}/5</Text>
                    <Text style={styles.recordLabel}>Emocional</Text>
                </View>
            </View>

            {/* Reflexión */}
            {(record.topMejorar || record.topBien) && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionEmoji}>💭</Text>
                        <Text style={styles.sectionTitle}>Reflexión</Text>
                    </View>
                    {record.topMejorar && (
                        <View style={styles.reflexionItem}>
                            <Text style={styles.reflexionLabel}>🎯 A mejorar:</Text>
                            <Text style={styles.reflexionText}>{record.topMejorar}</Text>
                        </View>
                    )}
                    {record.topBien && (
                        <View style={styles.reflexionItem}>
                            <Text style={styles.reflexionLabel}>🏆 Lo hice bien:</Text>
                            <Text style={styles.reflexionText}>{record.topBien}</Text>
                        </View>
                    )}
                </>
            )}

            {/* Mediciones */}
            {(record.medCuello || record.medHombros || record.medPecho || record.medCintura) && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionEmoji}>📐</Text>
                        <Text style={styles.sectionTitle}>Mediciones</Text>
                    </View>
                    <View style={styles.recordGrid}>
                        {record.medCuello && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medCuello} cm</Text>
                                <Text style={styles.recordLabel}>Cuello</Text>
                            </View>
                        )}
                        {record.medHombros && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medHombros} cm</Text>
                                <Text style={styles.recordLabel}>Hombros</Text>
                            </View>
                        )}
                        {record.medPecho && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medPecho} cm</Text>
                                <Text style={styles.recordLabel}>Pecho</Text>
                            </View>
                        )}
                        {record.medCintura && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medCintura} cm</Text>
                                <Text style={styles.recordLabel}>Cintura</Text>
                            </View>
                        )}
                    </View>
                </>
            )}
        </View>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{clientName || 'Cliente'}</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0ea5e9" />
                    <Text style={styles.loadingText}>Cargando historial...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const records = activeTab === 'daily' ? dailyRecords : weeklyRecords;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{clientName || 'Cliente'}</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabsRow}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'daily' && styles.tabActive]}
                    onPress={() => setActiveTab('daily')}
                >
                    <Ionicons
                        name="calendar"
                        size={18}
                        color={activeTab === 'daily' ? '#0ea5e9' : '#64748b'}
                    />
                    <Text style={[styles.tabText, activeTab === 'daily' && styles.tabTextActive]}>
                        Diario ({dailyRecords.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'weekly' && styles.tabActive]}
                    onPress={() => setActiveTab('weekly')}
                >
                    <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={activeTab === 'weekly' ? '#0ea5e9' : '#64748b'}
                    />
                    <Text style={[styles.tabText, activeTab === 'weekly' && styles.tabTextActive]}>
                        Semanal ({weeklyRecords.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        colors={['#0ea5e9']}
                    />
                }
            >
                {records.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="document-text-outline" size={60} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>Sin registros</Text>
                        <Text style={styles.emptyText}>
                            {activeTab === 'daily'
                                ? 'Este cliente aún no ha registrado check-ins diarios.'
                                : 'Este cliente aún no ha registrado check-ins semanales.'}
                        </Text>
                    </View>
                ) : (
                    activeTab === 'daily'
                        ? dailyRecords.map(renderDailyRecord)
                        : weeklyRecords.map(renderWeeklyRecord)
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backBtn: {
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#64748b',
    },

    // Tabs
    tabsRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        gap: 6,
    },
    tabActive: {
        backgroundColor: '#0ea5e920',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    tabTextActive: {
        color: '#0ea5e9',
    },

    // Content
    scrollContent: {
        padding: 16,
    },

    // Record Card
    recordCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    recordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    recordDate: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    recordGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 8,
    },
    recordItem: {
        alignItems: 'center',
        minWidth: 70,
    },
    recordValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 4,
    },
    recordLabel: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    moodEmoji: {
        fontSize: 24,
    },

    // Ha ido bien
    haIdoBienRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    haIdoBienLabel: {
        fontSize: 13,
        color: '#64748b',
    },
    haIdoBienBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    haIdoBienText: {
        fontSize: 12,
        fontWeight: '600',
    },

    // Nota
    notaContainer: {
        marginTop: 12,
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 8,
    },
    notaLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 4,
    },
    notaText: {
        fontSize: 13,
        color: '#1e293b',
        lineHeight: 20,
    },

    // Sections
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
        gap: 6,
    },
    sectionEmoji: {
        fontSize: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    comentarioText: {
        fontSize: 13,
        color: '#64748b',
        fontStyle: 'italic',
        marginBottom: 8,
    },

    // Alert
    alertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        padding: 10,
        borderRadius: 8,
        marginTop: 8,
        gap: 8,
    },
    alertText: {
        fontSize: 13,
        color: '#ef4444',
        flex: 1,
    },

    // Reflexion
    reflexionItem: {
        marginBottom: 8,
    },
    reflexionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    reflexionText: {
        fontSize: 13,
        color: '#1e293b',
        marginTop: 2,
    },

    // Empty
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 16,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 32,
    },
});
