import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Line } from 'react-native-svg';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';
import { useRouter } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

const COLORS = {
    primary: '#2563EB',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    neutral: '#64748b',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
};

// ═══════════════════════════════════════════════════════════════════════════
// DIET TYPE BADGE COLORS
// ═══════════════════════════════════════════════════════════════════════════
const DIET_TYPE_STYLES = {
    auto: { bg: '#dbeafe', text: '#2563EB' },
    flex: { bg: '#fef3c7', text: '#d97706' },
    complete: { bg: '#dcfce7', text: '#16a34a' },
};

const getDietTypeLabel = (type) => {
    if (type === 'auto') return 'Auto';
    if (type === 'flex') return 'Flex';
    if (type === 'complete') return 'Completa';
    return type;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE DOT COLOR
// ═══════════════════════════════════════════════════════════════════════════
const getComplianceColor = (level) => {
    if (level === 'green') return COLORS.success;
    if (level === 'yellow') return COLORS.warning;
    if (level === 'red') return COLORS.danger;
    return '#d1d5db';
};

const getComplianceLabel = (level) => {
    if (level === 'green') return 'Bien';
    if (level === 'yellow') return 'Regular';
    if (level === 'red') return 'Baja';
    return 'Sin datos';
};

// ═══════════════════════════════════════════════════════════════════════════
// MOOD EMOJI
// ═══════════════════════════════════════════════════════════════════════════
const getMoodEmoji = (mood) => {
    if (mood === null || mood === undefined) return { emoji: '❓', color: COLORS.neutral };
    if (mood >= 4.5) return { emoji: '😄', color: COLORS.success };
    if (mood >= 3.5) return { emoji: '🙂', color: '#22c55e' };
    if (mood >= 2.5) return { emoji: '😐', color: COLORS.warning };
    return { emoji: '😢', color: COLORS.danger };
};

// ═══════════════════════════════════════════════════════════════════════════
// TOOLTIP TEXTS
// ═══════════════════════════════════════════════════════════════════════════
const TOOLTIPS = {
    nutricion: 'Delta = media peso 7d actual - media peso 7d anterior',
    entreno: 'Int = Carga media por repetición (kg/rep). Vol = Volumen total semanal. Flecha = tendencia vs semana anterior.',
    feedback: 'Semaforo = 40% adherencia nutricional + 40% adherencia entreno + 20% animo',
};

// ═══════════════════════════════════════════════════════════════════════════
// AI INSIGHT ROW (lazy loaded on expand)
// ═══════════════════════════════════════════════════════════════════════════
const AIInsightRow = ({ clientId }) => {
    const { token } = useAuth();
    const [insight, setInsight] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch(`${API_URL}/api/trainers/clients/${clientId}/ai-summary`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => {
                if (!cancelled) {
                    setInsight(data.insight);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [clientId]);

    if (loading) {
        return (
            <View style={styles.aiInsightRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.aiInsightLoading}>Generando resumen...</Text>
            </View>
        );
    }

    if (!insight) return null;

    return (
        <View style={styles.aiInsightRow}>
            <Ionicons name="sparkles" size={14} color={COLORS.primary} />
            <Text style={styles.aiInsightText}>{insight}</Text>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Find index in history for vertical line
// ═══════════════════════════════════════════════════════════════════════════
const findAssignmentIndex = (historyDates, assignedAt) => {
    if (!historyDates || !assignedAt || historyDates.length === 0) return -1;
    const assignDate = new Date(assignedAt).getTime();
    for (let i = 0; i < historyDates.length; i++) {
        if (new Date(historyDates[i]).getTime() >= assignDate) return i;
    }
    return -1;
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Format date for payment
// ═══════════════════════════════════════════════════════════════════════════
const formatPaymentDate = (dateStr) => {
    if (!dateStr) return 'Sin suscripcion';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((d - now) / 86400000);
    const day = d.getDate();
    const month = d.toLocaleString('es', { month: 'short' });
    if (diffDays < 0) return `Vencido (${day} ${month})`;
    if (diffDays === 0) return 'Hoy';
    if (diffDays <= 7) return `En ${diffDays}d`;
    return `${day} ${month}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const ClientListRow = ({ client, onPress, onAction, isExpanded, onToggleExpand }) => {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    // ── Identity Data ──
    const { nombre, avatarUrl, isNew, status, hasUnreadMessages } = client;

    // ── Training Data ──
    const completedWorkouts = client.workoutsThisWeek || 0;
    const targetWorkouts = client.targetWorkoutsPerWeek || 5;
    const trainingRatio = targetWorkouts > 0 ? Math.round((completedWorkouts / targetWorkouts) * 100) : 0;
    const trainingRatioColor = trainingRatio >= 80 ? COLORS.success : trainingRatio >= 50 ? COLORS.warning : COLORS.danger;

    // ── Weight / Trend ──
    const weightTrend = client.weightTrend || 0;
    const weightDeltaColor = weightTrend < 0 ? COLORS.success : (weightTrend > 0 ? COLORS.danger : COLORS.neutral);

    // ── Last Activity ──
    const lastActivity = client.daysSinceLastTracking === 0 ? 'Hoy'
        : client.daysSinceLastTracking === 1 ? 'Ayer'
            : `Hace ${client.daysSinceLastTracking ?? '--'} d`;

    // ── Mood ──
    const moodInfo = getMoodEmoji(client.avgMood);

    // ── Compliance ──
    const complianceColor = getComplianceColor(client.complianceTrafficLight);

    // ── Chart dimensions ──
    const chartWidth = isMobile ? width - 60 : (width * 0.7) / 3 - 30;

    // ── Safe chart data (min 2 points required by LineChart) ──
    const weightData = client.weightHistory?.length >= 2 ? client.weightHistory : null;
    const moodData = client.moodHistory?.length >= 2 ? client.moodHistory : null;
    const intensityData = client.intensityHistory?.length >= 2 ? client.intensityHistory : null;

    // ── Vertical line decorator factory ──
    const createVerticalLineDecorator = (historyDates, assignedAt, dataLength, color = '#2563EB') => {
        if (!historyDates || !assignedAt || dataLength < 2) return undefined;
        const idx = findAssignmentIndex(historyDates, assignedAt);
        if (idx < 0) return undefined;

        return () => {
            const paddingLeft = 64;
            const paddingRight = 16;
            const usableWidth = chartWidth - paddingLeft - paddingRight;
            const xPos = paddingLeft + (idx / (dataLength - 1)) * usableWidth;

            return (
                <Line
                    x1={xPos}
                    y1={0}
                    x2={xPos}
                    y2={110}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeDasharray="4,3"
                />
            );
        };
    };

    // ── Tooltip state (web-compatible, no Alert.alert) ──
    const [activeTooltip, setActiveTooltip] = useState(null);
    const showTooltip = (key) => {
        setActiveTooltip(activeTooltip === key ? null : key);
    };

    return (
        <View style={styles.cardContainer}>
            <Pressable
                style={({ pressed }) => [
                    styles.card,
                    isExpanded && styles.cardExpanded,
                    isMobile && styles.cardMobile,
                    pressed && { opacity: 0.7 }
                ]}
                onPress={() => onToggleExpand && onToggleExpand()}
            >
                {/* ═══════════════════════════════════════════════════════════ */}
                {/* ZONE 1: IDENTITY                                          */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <View style={[styles.identityZone, isMobile && styles.identityZoneMobile]}>
                    <View style={styles.avatarContainer}>
                        <AvatarWithInitials
                            avatarUrl={avatarUrl}
                            name={nombre}
                            size={48}
                        />
                        {isNew && (
                            <View style={styles.badgeNew}>
                                <Text style={styles.badgeNewText}>NEW</Text>
                            </View>
                        )}
                        {hasUnreadMessages > 0 && (
                            <View style={styles.badgeMessage} />
                        )}
                    </View>
                    <View style={styles.identityText}>
                        <Text style={styles.name} numberOfLines={1}>{nombre}</Text>
                        {/* Tags fila 1: Status + Rutina */}
                        <View style={styles.tagRow}>
                            {status === 'active' && <View style={[styles.statusTag, { backgroundColor: '#dcfce7' }]}><Text style={[styles.statusTagText, { color: '#16a34a' }]}>Activo</Text></View>}
                            {status === 'pending' && <View style={[styles.statusTag, { backgroundColor: '#fef9c3' }]}><Text style={[styles.statusTagText, { color: '#ca8a04' }]}>Pendiente</Text></View>}
                            <View style={[styles.statusTag, { backgroundColor: '#f1f5f9' }]}>
                                <Text style={[styles.statusTagText, { color: '#64748b' }]}>{client.currentRoutineName || 'Sin Rutina'}</Text>
                            </View>
                        </View>
                        {/* Tags fila 2: Dieta + Tipo de dieta */}
                        <View style={styles.tagRow}>
                            {client.currentDietName ? (
                                <>
                                    <View style={[styles.statusTag, { backgroundColor: '#f0fdf4' }]}>
                                        <Text style={[styles.statusTagText, { color: '#16a34a' }]} numberOfLines={1}>{client.currentDietName}</Text>
                                    </View>
                                    {client.currentDietType && (
                                        <View style={[styles.statusTag, {
                                            backgroundColor: DIET_TYPE_STYLES[client.currentDietType]?.bg || '#f1f5f9'
                                        }]}>
                                            <Text style={[styles.statusTagText, {
                                                color: DIET_TYPE_STYLES[client.currentDietType]?.text || '#64748b'
                                            }]}>{getDietTypeLabel(client.currentDietType)}</Text>
                                        </View>
                                    )}
                                </>
                            ) : (
                                <View style={[styles.statusTag, { backgroundColor: '#fef2f2' }]}>
                                    <Text style={[styles.statusTagText, { color: '#ef4444' }]}>Sin Dieta</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* ZONE 2: THREE INDICATOR BLOCKS (Nutricion/Entreno/Feedback) */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <View style={[styles.indicatorsZone, isMobile && styles.indicatorsZoneMobile]}>
                    {/* ── BLOQUE NUTRICION ── */}
                    <View style={[styles.indicatorBlock, { flex: 1.3, borderRightWidth: 1, borderRightColor: '#f1f5f9' }]}>
                        <View style={styles.blockHeader}>
                            <Text style={styles.blockLabel}>NUTRICION</Text>
                            <Pressable onPress={(e) => { e.stopPropagation(); showTooltip('nutricion'); }} hitSlop={10} style={{ padding: 4 }}>
                                <Ionicons name="information-circle-outline" size={14} color={activeTooltip === 'nutricion' ? '#2563EB' : '#94a3b8'} />
                            </Pressable>
                        </View>
                        {activeTooltip === 'nutricion' && (
                            <View style={styles.tooltipBubble}>
                                <Text style={styles.tooltipText}>{TOOLTIPS.nutricion}</Text>
                            </View>
                        )}
                        <Text style={styles.blockWeeks}>
                            {client.weeksSinceDietChange != null ? `${client.weeksSinceDietChange} sem` : '--'}
                        </Text>
                        <Text style={styles.blockDetail} numberOfLines={1}>
                            {client.initialWeight ?? '--'} → {client.currentWeight ?? '--'} kg
                        </Text>
                        <View style={styles.deltaRow}>
                            <Ionicons
                                name={weightTrend > 0 ? 'arrow-up' : weightTrend < 0 ? 'arrow-down' : 'remove'}
                                size={12}
                                color={weightDeltaColor}
                            />
                            <Text style={[styles.deltaText, { color: weightDeltaColor }]}>
                                {client.weightTrend != null ? `${weightTrend > 0 ? '+' : ''}${weightTrend.toFixed(1)}kg` : '--'}
                            </Text>
                        </View>
                    </View>

                    {/* ── BLOQUE ENTRENO ── */}
                    <View style={[styles.indicatorBlock, { flex: 1.3, borderRightWidth: 1, borderRightColor: '#f1f5f9' }]}>
                        <View style={styles.blockHeader}>
                            <Text style={styles.blockLabel}>ENTRENO</Text>
                            <Pressable onPress={(e) => { e.stopPropagation(); showTooltip('entreno'); }} hitSlop={10} style={{ padding: 4 }}>
                                <Ionicons name="information-circle-outline" size={14} color={activeTooltip === 'entreno' ? '#2563EB' : '#94a3b8'} />
                            </Pressable>
                        </View>
                        {activeTooltip === 'entreno' && (
                            <View style={styles.tooltipBubble}>
                                <Text style={styles.tooltipText}>{TOOLTIPS.entreno}</Text>
                            </View>
                        )}
                        <Text style={styles.blockWeeks}>
                            {client.weeksSinceRoutineChange != null ? `${client.weeksSinceRoutineChange} sem` : '--'}
                        </Text>
                        <Text style={styles.blockDetail} numberOfLines={1}>
                            Int: {client.lastAvgLoad ? `${client.lastAvgLoad} kg/rep` : '--'}
                        </Text>
                        {(() => {
                            const ih = client.intensityHistory;
                            const hasDelta = ih && ih.length >= 2;
                            const delta = hasDelta ? Math.round((ih[ih.length - 1] - ih[ih.length - 2]) * 10) / 10 : null;
                            const deltaColor = delta > 0 ? COLORS.success : delta < 0 ? COLORS.danger : COLORS.neutral;
                            const deltaIcon = delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'remove';
                            return (
                                <View style={styles.deltaRow}>
                                    <Ionicons name={deltaIcon} size={14} color={deltaColor} />
                                    <Text style={[styles.deltaText, { color: deltaColor }]}>
                                        {delta != null ? `${delta > 0 ? '+' : ''}${delta}%` : '--'}
                                    </Text>
                                </View>
                            );
                        })()}
                    </View>

                    {/* ── BLOQUE FEEDBACK ── */}
                    <View style={[styles.indicatorBlock, { flex: 0.7 }]}>
                        <View style={styles.blockHeader}>
                            <Text style={styles.blockLabel}>FEEDBACK</Text>
                            <Pressable onPress={(e) => { e.stopPropagation(); showTooltip('feedback'); }} hitSlop={10} style={{ padding: 4 }}>
                                <Ionicons name="information-circle-outline" size={14} color={activeTooltip === 'feedback' ? '#2563EB' : '#94a3b8'} />
                            </Pressable>
                        </View>
                        {activeTooltip === 'feedback' && (
                            <View style={styles.tooltipBubble}>
                                <Text style={styles.tooltipText}>{TOOLTIPS.feedback}</Text>
                            </View>
                        )}
                        <Text style={styles.moodEmoji}>{moodInfo.emoji}</Text>
                        <View style={styles.complianceRow}>
                            <View style={[styles.complianceDot, { backgroundColor: complianceColor }]} />
                            <Text style={[styles.complianceLabel, { color: complianceColor }]}>
                                {getComplianceLabel(client.complianceTrafficLight)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* ZONE 3: ACTIONS                                           */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <View style={[styles.actionsZone, isMobile && styles.actionsZoneMobile]}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: COLORS.danger, backgroundColor: '#fef2f2' }]}
                        onPress={() => onAction && onAction('alert', client)}
                    >
                        <Ionicons name="notifications-outline" size={20} color={COLORS.danger} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => onAction && onAction('chat', client)}
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.neutral} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, isExpanded && { backgroundColor: '#2563EB', borderColor: COLORS.primary }]}
                        onPress={() => onToggleExpand && onToggleExpand()}
                    >
                        <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color={isExpanded ? '#fff' : COLORS.neutral}
                        />
                    </TouchableOpacity>
                </View>
            </Pressable>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* EXPANDED CONTENT AREA                                         */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {isExpanded && (
                <View style={styles.expandedContent}>
                    {/* 1. Mini Cards Grid (3 columns) */}
                    <View style={styles.miniCardsRow}>
                        {/* Card 1: SEGUIMIENTO */}
                        <TouchableOpacity
                            style={styles.miniCard}
                            onPress={() => router.push({ pathname: '/(coach)/seguimiento_coach/[clientId]', params: { clientId: client._id } })}
                        >
                            <Text style={styles.miniCardLabel}>ULTIMO SEGUIMIENTO</Text>
                            <Text style={styles.miniCardValue}>{lastActivity}</Text>
                        </TouchableOpacity>

                        {/* Card 2: ENTRENOS */}
                        <TouchableOpacity
                            style={styles.miniCard}
                            onPress={() => router.push({ pathname: '/(coach)/progress/[clientId]', params: { clientId: client._id } })}
                        >
                            <Text style={styles.miniCardLabel}>ENTRENOS</Text>
                            <Text style={[styles.miniCardValue, { color: trainingRatioColor }]}>
                                {trainingRatio}%
                            </Text>
                            <Text style={styles.miniCardSub}>{completedWorkouts}/{targetWorkouts} esta sem</Text>
                        </TouchableOpacity>

                        {/* Card 3: PROXIMO PAGO */}
                        <TouchableOpacity
                            style={styles.miniCard}
                            onPress={() => router.push({ pathname: '/(coach)/billing' })}
                        >
                            <Text style={styles.miniCardLabel}>PROXIMO PAGO</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                {client.paymentStatus === 'overdue' && (
                                    <Ionicons name="warning" size={13} color={COLORS.danger} />
                                )}
                                <Text style={[
                                    styles.miniCardValue,
                                    client.paymentStatus === 'overdue' && { color: COLORS.danger }
                                ]}>
                                    {formatPaymentDate(client.nextPaymentDate)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* 2. Charts Section (3 Columns) */}
                    <View style={styles.chartsContainer}>
                        {/* Chart 1: Weight */}
                        <View style={styles.chartWrapper}>
                            <Text style={styles.chartTitle}>PESO (kg)</Text>
                            {weightData ? (
                                <LineChart
                                    data={{
                                        labels: weightData.map(() => ''),
                                        datasets: [{ data: weightData }]
                                    }}
                                    width={chartWidth}
                                    height={110}
                                    chartConfig={{
                                        backgroundColor: "#ffffff",
                                        backgroundGradientFrom: "#ffffff",
                                        backgroundGradientTo: "#ffffff",
                                        decimalPlaces: 1,
                                        color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                                        labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                                        style: { borderRadius: 16 },
                                        propsForDots: { r: "3", strokeWidth: "2", stroke: "#2563EB" },
                                        propsForBackgroundLines: { strokeDasharray: "" }
                                    }}
                                    bezier
                                    withInnerLines={true}
                                    withOuterLines={false}
                                    withVerticalLabels={false}
                                    withHorizontalLabels={true}
                                    style={styles.chartStyle}
                                    decorator={createVerticalLineDecorator(
                                        client.weightHistoryDates,
                                        client.dietAssignedAt,
                                        weightData.length
                                    )}
                                />
                            ) : (
                                <View style={styles.chartPlaceholder}>
                                    <Ionicons name="analytics-outline" size={24} color="#e2e8f0" />
                                    <Text style={styles.chartPlaceholderText}>Sin datos</Text>
                                </View>
                            )}
                        </View>

                        {/* Chart 2: Mood */}
                        <View style={styles.chartWrapper}>
                            <Text style={styles.chartTitle}>ANIMO</Text>
                            {moodData ? (
                                <LineChart
                                    data={{
                                        labels: moodData.map(() => ''),
                                        datasets: [{ data: moodData }]
                                    }}
                                    width={chartWidth}
                                    height={110}
                                    chartConfig={{
                                        backgroundColor: "#ffffff",
                                        backgroundGradientFrom: "#ffffff",
                                        backgroundGradientTo: "#ffffff",
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                                        labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                                        style: { borderRadius: 16 },
                                        propsForDots: { r: "3", strokeWidth: "2", stroke: "#10B981" }
                                    }}
                                    bezier
                                    withInnerLines={true}
                                    withOuterLines={false}
                                    withVerticalLabels={false}
                                    style={styles.chartStyle}
                                />
                            ) : (
                                <View style={styles.chartPlaceholder}>
                                    <Ionicons name="happy-outline" size={24} color="#e2e8f0" />
                                    <Text style={styles.chartPlaceholderText}>Sin datos</Text>
                                </View>
                            )}
                        </View>

                        {/* Chart 3: Intensidad (carga media/rep vs semana 1) */}
                        <View style={styles.chartWrapper}>
                            <Text style={styles.chartTitle}>INTENSIDAD</Text>
                            {intensityData ? (
                                <LineChart
                                    data={{
                                        labels: intensityData.map((_, i) => `S${i + 1}`),
                                        datasets: [{ data: intensityData }]
                                    }}
                                    width={chartWidth}
                                    height={110}
                                    yAxisSuffix="%"
                                    chartConfig={{
                                        backgroundColor: "#ffffff",
                                        backgroundGradientFrom: "#ffffff",
                                        backgroundGradientTo: "#ffffff",
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                                        labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                                        style: { borderRadius: 16 },
                                        propsForDots: { r: "3", strokeWidth: "2", stroke: "#8B5CF6" }
                                    }}
                                    bezier
                                    withInnerLines={true}
                                    withOuterLines={false}
                                    withVerticalLabels={true}
                                    withHorizontalLabels={true}
                                    style={styles.chartStyle}
                                    decorator={createVerticalLineDecorator(
                                        client.weightHistoryDates,
                                        client.routineAssignedAt,
                                        intensityData.length,
                                        '#8B5CF6'
                                    )}
                                />
                            ) : (
                                <View style={styles.chartPlaceholder}>
                                    <Ionicons name="barbell-outline" size={24} color="#e2e8f0" />
                                    <Text style={styles.chartPlaceholderText}>Sin datos</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* 3. AI Predictive Summary */}
                    <AIInsightRow clientId={client._id} />

                    {/* 4. Quick Actions Tab Bar */}
                    <View style={styles.tabBar}>
                        <TouchableOpacity style={styles.tabButton} onPress={() => router.push({ pathname: '/(coach)/client-detail/[clientId]', params: { clientId: client._id, tab: 'edit' } })}>
                            <Ionicons name="person-circle-outline" size={20} color={COLORS.textSecondary} />
                            <Text style={styles.tabText}>Perfil</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.tabButton} onPress={() => router.push({ pathname: '/(coach)/nutrition/[clientId]', params: { clientId: client._id } })}>
                            <Ionicons name="restaurant-outline" size={20} color={COLORS.textSecondary} />
                            <Text style={styles.tabText}>Nutricion</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.tabButton} onPress={() => router.push({ pathname: '/(coach)/seguimiento_coach/[clientId]', params: { clientId: client._id } })}>
                            <Ionicons name="clipboard-outline" size={20} color={COLORS.textSecondary} />
                            <Text style={styles.tabText}>Seguimiento</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.tabButton} onPress={() => router.push({ pathname: '/(coach)/progress/[clientId]', params: { clientId: client._id } })}>
                            <Ionicons name="bar-chart-outline" size={20} color={COLORS.textSecondary} />
                            <Text style={styles.tabText}>Progreso</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.tabButton} onPress={() => router.push({ pathname: '/(coach)/billing' })}>
                            <Ionicons name="card-outline" size={20} color={COLORS.textSecondary} />
                            <Text style={styles.tabText}>Pagos</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    cardContainer: {
        marginBottom: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
        overflow: 'hidden',
    },
    card: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    cardMobile: {
        flexDirection: 'column',
        alignItems: 'stretch',
        paddingVertical: 12,
    },
    cardExpanded: {
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },

    // ── ZONE 1: Identity ──
    identityZone: {
        flex: 2.5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    identityZoneMobile: {
        width: '100%',
        flex: 0,
        flexBasis: 'auto',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingRight: 0,
    },
    avatarContainer: {
        position: 'relative',
    },
    badgeNew: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 4,
        borderRadius: 4,
        zIndex: 10,
    },
    badgeNewText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: 'bold',
    },
    badgeMessage: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.danger,
        borderWidth: 2,
        borderColor: '#fff',
    },
    identityText: {
        flex: 1,
        gap: 2,
    },
    name: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    tagRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 3,
        flexWrap: 'wrap',
    },
    statusTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        maxWidth: 150,
    },
    statusTagText: {
        fontSize: 10,
        fontWeight: '600',
    },

    // ── ZONE 2: Indicator Blocks ──
    indicatorsZone: {
        flex: 4,
        flexDirection: 'row',
        paddingHorizontal: 8,
        borderLeftWidth: 1,
        borderLeftColor: '#f1f5f9',
    },
    indicatorsZoneMobile: {
        flex: 0,
        flexBasis: 'auto',
        width: '100%',
        paddingHorizontal: 0,
        paddingVertical: 10,
        borderLeftWidth: 0,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    indicatorBlock: {
        flex: 1,
        paddingHorizontal: 10,
        justifyContent: 'center',
        gap: 2,
        overflow: 'visible',
        position: 'relative',
    },
    blockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    blockLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 0.5,
    },
    blockWeeks: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    blockDetail: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    blockSubtext: {
        fontSize: 9,
        color: '#94a3b8',
    },
    deltaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 1,
    },
    deltaText: {
        fontSize: 11,
        fontWeight: '700',
    },
    tooltipBubble: {
        backgroundColor: '#1e293b',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 5,
        position: 'absolute',
        top: 22,
        left: 4,
        right: 4,
        zIndex: 100,
    },
    tooltipText: {
        fontSize: 10,
        color: '#fff',
        lineHeight: 14,
    },
    moodEmoji: {
        fontSize: 22,
        textAlign: 'center',
    },
    complianceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        marginTop: 2,
    },
    complianceDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    complianceLabel: {
        fontSize: 10,
        fontWeight: '700',
    },

    // ── ZONE 3: Actions ──
    actionsZone: {
        flex: 1.5,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingLeft: 16,
        gap: 8,
    },
    actionsZoneMobile: {
        position: 'relative',
        top: 0,
        right: 0,
        width: 'auto',
        flex: 0,
        paddingLeft: 0,
        marginTop: 8,
    },
    actionBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginLeft: 8,
    },

    // ── EXPANDED STYLES ──
    expandedContent: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    miniCardsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    miniCard: {
        flex: 1,
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    miniCardLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
    },
    miniCardValue: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    miniCardSub: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    chartsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        marginBottom: 8,
        gap: 12,
        flexWrap: 'wrap',
    },
    chartWrapper: {
        flex: 1,
        minWidth: 140,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    chartTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94a3b8',
        marginBottom: 4,
        alignSelf: 'flex-start',
    },
    chartStyle: {
        borderRadius: 8,
    },
    chartPlaceholder: {
        height: 110,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    chartPlaceholderText: {
        fontSize: 11,
        color: '#cbd5e1',
        fontWeight: '500',
    },

    // ── AI INSIGHT ──
    aiInsightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#eff6ff',
        borderRadius: 8,
        marginTop: 12,
        marginBottom: 4,
        borderWidth: 1,
        borderColor: '#dbeafe',
    },
    aiInsightText: {
        fontSize: 12,
        color: '#1e40af',
        fontWeight: '500',
        flex: 1,
        lineHeight: 18,
    },
    aiInsightLoading: {
        fontSize: 11,
        color: '#93c5fd',
        fontStyle: 'italic',
    },

    // ── TAB BAR ──
    tabBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    tabButton: {
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
    },
    tabText: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
});

export default ClientListRow;
