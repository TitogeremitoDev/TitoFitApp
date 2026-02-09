import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';

const COLORS = {
    primary: '#2563EB',        // Azul
    success: '#10b981',        // Verde
    warning: '#f59e0b',        // Amarillo/Naranja
    danger: '#ef4444',         // Rojo
    neutral: '#64748b',        // Gris Slate 500
    textPrimary: '#1e293b',    // Slate 800
    textSecondary: '#64748b',  // Slate 500
    border: '#e2e8f0',         // Slate 200
    bg: '#ffffff'
};

const ProgressListRow = ({ client, progress, onPress }) => {
    // 1. Identity Data
    const { nombre, email, avatarUrl, currentRoutineName, currentRoutineType } = client;

    // 2. Metrics Data (from progress prop or client prop)
    // Fuerza (Estimado) - Usamos Tendencia de Volumen o Intensidad si existe
    // Si tenemos calculated progress, lo usamos.
    const volumeTrend = progress?.tendencia || 0;
    const isVolumePositive = volumeTrend >= 0;

    // Volumen Total
    const totalVolume = progress?.volumenSemanaActual || 0;
    const formattedVolume = totalVolume > 1000
        ? `${(totalVolume / 1000).toFixed(1)}k`
        : totalVolume.toString();

    // Asistencia
    const completedSessions = progress?.sesionesSemana || 0;
    const targetSessions = client.targetWorkoutsPerWeek || 4; // Default to 4 if missing

    // Alertas
    const daysSinceLast = progress?.diasSinEntrenar;
    const isInactive = daysSinceLast !== null && daysSinceLast > 4;
    const isRecord = volumeTrend > 10; // Simple logic for "Record" visual

    return (
        <View style={styles.cardContainer}>
            <TouchableOpacity
                style={styles.card}
                onPress={onPress}
                activeOpacity={0.7}
            >
                {/* ═══════════════════════════════════════════════════════════ */}
                {/* SECCIÓN 1: PERFIL (IZQUIERDA)                             */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <View style={styles.identityZone}>
                    <AvatarWithInitials
                        avatarUrl={avatarUrl}
                        name={nombre}
                        size={48}
                    />
                    <View style={styles.identityText}>
                        <Text style={styles.name} numberOfLines={1}>{nombre}</Text>
                        <Text style={styles.email} numberOfLines={1}>{email}</Text>
                        {currentRoutineName && (
                            <View style={styles.routineBadge}>
                                {currentRoutineType === 'strength' && (
                                    <Ionicons name="flash" size={10} color={COLORS.primary} style={{ marginRight: 4 }} />
                                )}
                                <Text style={styles.routineText} numberOfLines={1}>
                                    {currentRoutineName.toUpperCase()}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* SECCIÓN 2: KPIs (CENTRO) - GRID DE 3 COLUMNAS             */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <View style={styles.metricsZone}>
                    {/* KPI 1: FUERZA / PROGRESO */}
                    <View style={styles.kpiItem}>
                        <Text style={styles.kpiLabel}>FUERZA</Text>
                        <View style={styles.trendRow}>
                            <Text style={[
                                styles.kpiValueLarge,
                                { color: isVolumePositive ? COLORS.success : COLORS.neutral }
                            ]}>
                                {volumeTrend > 0 ? '+' : ''}{volumeTrend}%
                            </Text>
                            <Ionicons
                                name={isVolumePositive ? "trending-up" : "trending-down"}
                                size={16}
                                color={isVolumePositive ? COLORS.success : COLORS.neutral}
                            />
                        </View>

                        {/* Progress Bar Visual */}
                        <View style={styles.miniProgressBarBg}>
                            <View
                                style={[
                                    styles.miniProgressBarFill,
                                    {
                                        width: `${Math.min(Math.abs(volumeTrend), 100)}%`,
                                        backgroundColor: isVolumePositive ? COLORS.primary : COLORS.neutral
                                    }
                                ]}
                            />
                        </View>
                    </View>

                    {/* KPI 2: VOLUMEN TOTAL */}
                    <View style={styles.kpiItem}>
                        <Text style={styles.kpiLabel}>VOLUMEN TOTAL</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                            <Text style={styles.kpiValueLarge}>{formattedVolume}</Text>
                            <Text style={styles.kpiUnit}>kg / sem</Text>
                        </View>
                        <Text style={styles.kpiSubtext}>
                            {volumeTrend >= 0 ? 'En alza ' : 'Bajando '}
                            <Ionicons name={volumeTrend >= 0 ? "arrow-up" : "arrow-down"} size={10} color={COLORS.textSecondary} />
                        </Text>
                    </View>

                    {/* KPI 3: ASISTENCIA */}
                    <View style={styles.kpiItem}>
                        <Text style={styles.kpiLabel}>ASISTENCIA</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                            <Text style={styles.kpiValueLarge}>{completedSessions}/{targetSessions}</Text>
                            <Text style={styles.kpiUnit}>sesiones</Text>
                        </View>
                        {/* Session Dots */}
                        <View style={styles.dotsRow}>
                            {[...Array(targetSessions)].map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.dot,
                                        i < completedSessions ? { backgroundColor: '#4f46e5' } : { backgroundColor: '#e2e8f0' }
                                    ]}
                                />
                            ))}
                        </View>
                    </View>
                </View>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* SECCIÓN 3: ACCIONES Y ALERTAS (DERECHA)                   */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <View style={styles.actionsZone}>
                    <View style={styles.alertsContainer}>
                        {isInactive && (
                            <View style={[styles.alertChip, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
                                <Ionicons name="warning" size={12} color={COLORS.warning} />
                                <Text style={[styles.alertText, { color: '#b45309' }]}>
                                    {daysSinceLast}d sin gym
                                </Text>
                            </View>
                        )}
                        {isRecord && !isInactive && (
                            <View style={[styles.alertChip, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
                                <Ionicons name="trophy" size={12} color={COLORS.primary} />
                                <Text style={[styles.alertText, { color: '#1e40af' }]}>
                                    Récord Roto
                                </Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity style={styles.detailButton} onPress={onPress}>
                        <Text style={styles.detailButtonText}>Ver análisis detallado</Text>
                        <Ionicons name="stats-chart" size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        marginBottom: 16,
        backgroundColor: COLORS.bg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: "#64748b",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    card: {
        flexDirection: 'row',
        padding: 18,
        alignItems: 'center',
        flexWrap: 'wrap', // Allow wrapping on mobile
    },

    // Identity Zone
    identityZone: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '28%', // Desktop width
        paddingRight: 10,
        gap: 12,
        minWidth: 200,
    },
    identityText: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    email: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 6,
    },
    routineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    routineText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#4f46e5',
        letterSpacing: 0.5,
    },

    // Metrics Zone
    metricsZone: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderLeftWidth: 1,
        borderLeftColor: '#f1f5f9',
        borderRightWidth: 1,
        borderRightColor: '#f1f5f9',
        minWidth: 300,
    },
    kpiItem: {
        flex: 1,
        paddingHorizontal: 8,
        justifyContent: 'center',
    },
    kpiLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 0.8,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    kpiValueLarge: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    kpiUnit: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    kpiSubtext: {
        fontSize: 11,
        color: '#10b981', // green for "En alza" default
        fontWeight: '600',
        fontStyle: 'italic',
    },

    // Progress Bars & Dots
    miniProgressBarBg: {
        height: 6,
        backgroundColor: '#f1f5f9',
        borderRadius: 3,
        width: '100%',
        maxWidth: 80,
    },
    miniProgressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 2,
    },

    // Actions Zone
    actionsZone: {
        width: '25%',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingLeft: 16,
        gap: 12,
        minWidth: 180,
    },
    alertsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: 6,
    },
    alertChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        gap: 4,
        marginBottom: 4,
    },
    alertText: {
        fontSize: 10,
        fontWeight: '700',
    },
    detailButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 8,
    },
    detailButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
});

export default ProgressListRow;
