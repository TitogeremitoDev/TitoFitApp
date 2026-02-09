/* components/FeedbackReportModal.jsx - Feedback Modal Redesign */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Dimensions,
    Linking,
    useWindowDimensions,
    RefreshControl,
    Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useFeedbackDraft } from '../context/FeedbackDraftContext';
import { EnhancedTextInput } from './ui';
import { Image } from 'expo-image';
import { LineChart, PieChart } from 'react-native-chart-kit';
import VideoPreviewPlayer from '../src/components/coach/VideoPreviewPlayer';
import AvatarWithInitials from '../src/components/shared/AvatarWithInitials';

// KPI Utils
import {
    calcVolumeByWeek,
    calcPlanComplianceByWeek,
    filterByPeriod,
    calc1RM,
    calcIntensityByWeek,
    calcPlanComplianceTotal
} from '../src/utils/calculateKPIs';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';
const SCREEN_WIDTH = Dimensions.get('window').width;

const getObjetivoTag = (objetivo) => {
    if (!objetivo) return null;
    const lower = objetivo.toLowerCase();
    if (lower.includes('volumen') || lower.includes('masa')) return { text: 'Volumen', color: '#3b82f6', icon: 'trending-up' };
    if (lower.includes('definición') || lower.includes('perder')) return { text: 'Definición', color: '#ef4444', icon: 'trending-down' };
    if (lower.includes('mantener')) return { text: 'Mantener', color: '#f59e0b', icon: 'remove' };
    return { text: objetivo, color: '#64748b', icon: 'fitness' };
};

// ═══════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// 🆕 SEGMENTED CONTROL FOR STATUS - FIXED COLORS
const StatusSegmentedControl = ({ value, onChange }) => {
    const options = [
        { id: 'green', label: 'PROGRESO', color: '#10b981' }, // Green for Progress
        { id: 'yellow', label: 'CONSOLIDAR', color: '#f59e0b' },
        { id: 'red', label: 'AJUSTAR', color: '#ef4444' },
    ];

    return (
        <View style={styles.segmentedContainer}>
            {options.map((opt) => {
                const isActive = value === opt.id;
                return (
                    <TouchableOpacity
                        key={opt.id}
                        style={[
                            styles.segmentBtn,
                            isActive && {
                                backgroundColor: opt.color,
                                shadowColor: opt.color,
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.3,
                                shadowRadius: 4,
                                elevation: 3
                            }
                        ]}
                        onPress={() => onChange(opt.id)}
                    >
                        <Text style={[
                            styles.segmentText,
                            isActive ? { color: '#fff' } : { color: '#64748b' }
                        ]}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};




// 🆕 CLIENT NAVIGATION SIDEBAR (Collapsible)
const ClientSidebar = ({ clients, onSelect, onClose, currentClientId }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsed, setCollapsed] = useState(false);
    const { top, bottom } = useSafeAreaInsets();

    const filteredClients = useMemo(() => {
        if (!searchQuery) return clients;
        const lower = searchQuery.toLowerCase();
        return clients.filter(c => c.nombre?.toLowerCase().includes(lower));
    }, [clients, searchQuery]);

    return (
        <View style={[styles.sidebarPanel, { paddingTop: top, paddingBottom: bottom, width: collapsed ? 80 : 300 }]}>
            {/* Header */}
            <View style={[styles.sidebarHeader, collapsed && { justifyContent: 'center', paddingHorizontal: 0 }]}>
                {/* Back Button (Left) */}
                <TouchableOpacity onPress={onClose} style={styles.sidebarToggleBtn}>
                    <Ionicons name="arrow-back" size={20} color="#1e293b" />
                </TouchableOpacity>

                {!collapsed && <Text style={styles.sidebarTitle}>Clientes</Text>}

                {/* Collapse Toggle (Right) */}
                <TouchableOpacity
                    onPress={() => setCollapsed(!collapsed)}
                    style={[styles.sidebarToggleBtn, collapsed && { display: 'none' }]}
                >
                    <Ionicons name={collapsed ? "chevron-forward" : "chevron-back"} size={20} color="#64748b" />
                </TouchableOpacity>
            </View>

            {/* Search */}
            {!collapsed ? (
                <View style={styles.sidebarSearch}>
                    <Ionicons name="search" size={16} color="#94a3b8" />
                    <TextInput
                        style={styles.sidebarSearchInput}
                        placeholder="Buscar..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            ) : (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <Ionicons name="search" size={20} color="#cbd5e1" />
                </View>
            )}

            {/* List */}
            <ScrollView style={styles.sidebarList} contentContainerStyle={{ paddingBottom: 20 }}>
                {filteredClients.map(client => {
                    const isSelected = client._id === currentClientId;
                    return (
                        <TouchableOpacity
                            key={client._id}
                            style={[
                                styles.sidebarItem,
                                isSelected && styles.sidebarItemActive,
                                collapsed && { justifyContent: 'center', paddingHorizontal: 0, gap: 0 }
                            ]}
                            onPress={() => onSelect(client)}
                        >
                            <AvatarWithInitials
                                avatarUrl={client.avatarUrl}
                                name={client.nombre}
                                size={collapsed ? 40 : 36}
                            />
                            {!collapsed && (
                                <>
                                    <View style={styles.sidebarItemInfo}>
                                        <Text style={[styles.sidebarItemName, isSelected && styles.sidebarItemNameActive]} numberOfLines={1}>
                                            {client.nombre}
                                        </Text>
                                        <Text style={styles.sidebarItemStatus}>
                                            {client.currentRoutineName ? 'Activo' : 'Sin plan'}
                                        </Text>
                                    </View>
                                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />}
                                </>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};


// 🆕 METRICS DASHBOARD - PREMIUM REDESIGN
const MetricsDashboard = ({ sessions, history, loading, lastFeedbackDate }) => {
    // Helper: Get Week Number (Local version)
    const getWeekNumber = (dateStr) => {
        if (!dateStr) return -1;
        const date = new Date(dateStr);
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        return Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    };

    // Helper: Calculate % Delta
    const getPercentDelta = (current, previous) => {
        if (!previous || previous === 0) return { text: '--', color: '#94a3b8', icon: 'remove', positive: null };
        let diff = ((current - previous) / previous) * 100;
        if (Math.abs(diff) > 500) diff = 0;

        const positive = diff > 0;
        const color = diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#94a3b8';
        const icon = diff > 0 ? 'trending-up' : diff < 0 ? 'trending-down' : 'remove';
        return { text: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`, color, icon, positive };
    };

    // Helper: Format Large Numbers (e.g. 43169 -> 43.2k)
    const formatValue = (val) => {
        if (!val || val === '--') return '--';
        const num = parseFloat(val);
        if (isNaN(num)) return val;
        if (num > 9999) return (num / 1000).toFixed(1) + 'k';
        if (num % 1 !== 0) return num.toFixed(1);
        return num.toLocaleString();
    };

    // Helper: Get Date Label from Week Number
    const getDateLabelFromWeek = (weekNum, sessions) => {
        if (!sessions || sessions.length === 0) return '';
        const sessionInWeek = sessions.find(s => {
            const date = new Date(s.date);
            const startOfYear = new Date(date.getFullYear(), 0, 1);
            const w = Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
            return w === weekNum;
        });
        if (sessionInWeek) {
            const d = new Date(sessionInWeek.date);
            return `${d.getDate()}/${d.getMonth() + 1}`;
        }
        return `S${weekNum}`;
    };

    // 📊 Volume Data
    const volumeData = useMemo(() => {
        if (!sessions || sessions.length === 0) return null;

        // 1. Sort ALL sessions Ascending (Oldest -> Newest) first
        const allSorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));

        // 2. Filter by Last Feedback Date
        let filteredSessions = [...allSorted];
        if (lastFeedbackDate) {
            const cutoff = new Date(lastFeedbackDate);
            cutoff.setHours(0, 0, 0, 0);
            filteredSessions = allSorted.filter(s => new Date(s.date) >= cutoff);
        }

        // 3. Fallback: If no new data, show last 5 sessions from the SORTED array (Recent context)
        if (filteredSessions.length === 0) filteredSessions = allSorted.slice(-5);

        const data = calcVolumeByWeek(filteredSessions, 'TOTAL', '');
        if (data.length < 1) return null;

        const latestInfo = data[data.length - 1];
        const previousInfo = data.length > 1 ? data[data.length - 2] : null;

        return {
            current: latestInfo?.volume || 0,
            delta: getPercentDelta(latestInfo?.volume || 0, previousInfo?.volume || 0),
            data: data.map(d => d.volume),
            labels: data.map((d, index) => {
                // Show only every 3rd label to avoid clutter, but always show first and last
                if (index === 0 || index === data.length - 1 || index % 3 === 0) {
                    const date = new Date(d.date);
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    return `${day}/${month}`;
                }
                return '';
            }),
            highlightIndex: 0 // First point (Last Feedback) is Red
        };
    }, [sessions, lastFeedbackDate]);

    // ⚖️ Weight Data
    const weightData = useMemo(() => {
        if (!history || history.length === 0) return null;

        // 1. Sort ALL history Ascending (Oldest -> Newest)
        let validWeights = history.filter(d => d.peso && d.peso > 0);
        validWeights.sort((a, b) => new Date(a.date) - new Date(b.date));

        // 2. Filter
        let filteredWeights = [...validWeights];
        if (lastFeedbackDate) {
            const cutoff = new Date(lastFeedbackDate);
            cutoff.setHours(0, 0, 0, 0);
            filteredWeights = validWeights.filter(d => new Date(d.date) >= cutoff);
        }

        // 3. Fallback
        if (filteredWeights.length === 0) filteredWeights = validWeights.slice(-5);

        if (filteredWeights.length < 1) return null;

        const current = filteredWeights[filteredWeights.length - 1]?.peso || 0;
        const previous = filteredWeights.length > 1 ? filteredWeights[filteredWeights.length - 2]?.peso : filteredWeights[0]?.peso;

        return {
            current,
            delta: getPercentDelta(current, previous),
            data: filteredWeights.map(d => d.peso),
            labels: filteredWeights.map((d, index) => {
                if (index === 0 || index === filteredWeights.length - 1 || index % 3 === 0) {
                    const date = new Date(d.date);
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    return `${day}/${month}`;
                }
                return '';
            }),
            highlightIndex: 0 // First point Red
        };
    }, [history, lastFeedbackDate]);

    // 💪 Intensity Data  
    const intensityData = useMemo(() => {
        if (!sessions || sessions.length === 0) return null;

        // 1. Sort ALL sessions Ascending
        const allSorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));

        // 2. Filter
        let filteredSessions = [...allSorted];
        if (lastFeedbackDate) {
            const cutoff = new Date(lastFeedbackDate);
            cutoff.setHours(0, 0, 0, 0);
            filteredSessions = allSorted.filter(s => new Date(s.date) >= cutoff);
        }

        // 3. Fallback
        if (filteredSessions.length === 0) filteredSessions = allSorted.slice(-5);

        const weeklyData = calcIntensityByWeek(filteredSessions, 'TOTAL', '');

        if (!weeklyData || weeklyData.length === 0) return { current: 0, delta: null, data: [], labels: [] };

        const latest = weeklyData[weeklyData.length - 1];
        const previous = weeklyData.length > 1 ? weeklyData[weeklyData.length - 2] : null;

        const currentVal = latest.avgLoad || 0;
        const previousVal = previous ? previous.avgLoad : 0;

        return {
            current: currentVal.toFixed(1),
            delta: getPercentDelta(currentVal, previousVal),
            data: weeklyData.map(d => d.avgLoad || 0),
            labels: weeklyData.map((d, index) => {
                if (index === 0 || index === weeklyData.length - 1 || index % 3 === 0) {
                    const date = new Date(d.date);
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    return `${day}/${month}`;
                }
                return '';
            }),
            highlightIndex: 0 // First point Red
        };
    }, [sessions, lastFeedbackDate]);

    // ✅ Compliance Data (Sets)
    const complianceData = useMemo(() => {
        if (!sessions || sessions.length === 0) return null;

        // 1. Sort ALL sessions Ascending
        const allSorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));

        // 2. Filter
        let filteredSessions = [...allSorted];
        if (lastFeedbackDate) {
            const cutoff = new Date(lastFeedbackDate);
            cutoff.setHours(0, 0, 0, 0);
            filteredSessions = allSorted.filter(s => new Date(s.date) >= cutoff);
        }

        // 3. Fallback
        if (filteredSessions.length === 0) filteredSessions = allSorted.slice(-5);

        const { inRange, total, percentage } = calcPlanComplianceTotal(filteredSessions);

        if (total === 0) return { current: 0, delta: null, data: [] };

        // Pie Chart Data
        const pieData = [
            {
                name: 'Cumplido',
                population: inRange,
                color: '#8b5cf6', // Violet
                legendFontColor: '#7F7F7F',
                legendFontSize: 12
            },
            {
                name: 'No Cumplido',
                population: total - inRange,
                color: '#e2e8f0', // Light Gray
                legendFontColor: '#7F7F7F',
                legendFontSize: 12
            }
        ];

        return {
            current: percentage,
            data: pieData,
            totalSets: total,
            inRangeSets: inRange
        };
    }, [sessions, lastFeedbackDate]);


    if (loading) return <View style={styles.metricsLoading}><ActivityIndicator size="large" color="#3b82f6" /></View>;

    // Clean Sparkline Config
    const chartConfig = {
        backgroundGradientFrom: 'transparent',
        backgroundGradientTo: 'transparent',
        fillShadowGradientOpacity: 0.1, // Reduced opacity
        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        strokeWidth: 2, // Thinner stroke
        propsForDots: { r: '0' },
        propsForBackgroundLines: { stroke: 'transparent' },
    };

    // Premium Stat Card with Dynamic Props & Detailed Mode
    const PremiumStatCard = ({ icon, iconBg, title, value, unit, delta, accentColor, chartData, chartLabels, highlightIndex, cardStyle, customChartWidth, isDetailed, description }) => {
        const hasChart = chartData && chartData.length > 1;
        const displayLabels = isDetailed && chartLabels ? chartLabels : [];
        const chartHeight = isDetailed ? 120 : 60; // Reduced height for detailed view
        const [showTooltip, setShowTooltip] = useState(false);

        // Configuration for Detailed Full-Graph Mode
        const detailedChartConfig = {
            ...chartConfig,
            fillShadowGradientOpacity: 0.2,
            strokeWidth: 3,
            propsForDots: { r: '4', strokeWidth: '2', stroke: '#fff' },
            color: (opacity = 1) => accentColor.replace(')', `, ${opacity})`).replace('rgb', 'rgba'),
            decimalPlaces: 0,
            getDotColor: (dataPoint, dataPointIndex) => {
                if (highlightIndex !== undefined && highlightIndex !== -1 && dataPointIndex === highlightIndex) {
                    return '#ef4444';
                }
                return accentColor;
            },
            propsForLabels: { fontSize: 10, fontWeight: '600' },
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
        };

        return (
            <View style={[styles.premiumCard, cardStyle, isDetailed && styles.premiumCardDetailed]} zIndex={showTooltip ? 99 : 1}>

                {/* Header Section - DETAILED MODE */}
                {isDetailed && (
                    <View style={styles.premiumHeaderDetailed}>
                        <View style={styles.premiumHeaderLeft}>
                            <View style={[styles.premiumIconCircle, { backgroundColor: iconBg }]}>
                                <Ionicons name={icon} size={20} color={accentColor} />
                            </View>
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.premiumTitleDetailed}>{title}</Text>

                                    {/* DELTA CIRCLE (Percentage) */}
                                    {delta && (
                                        <View style={[styles.premiumDeltaCircle, { backgroundColor: delta.color + '20' }]}>
                                            <Ionicons name={delta.icon} size={10} color={delta.color} style={{ marginRight: 2 }} />
                                            <Text style={[styles.premiumDeltaTextCircle, { color: delta.color }]}>{delta.text}</Text>
                                        </View>
                                    )}

                                    {/* TOOLTIP ICON */}
                                    {description && (
                                        <Pressable
                                            onHoverIn={() => Platform.OS === 'web' && setShowTooltip(true)}
                                            onHoverOut={() => Platform.OS === 'web' && setShowTooltip(false)}
                                            onPress={() => setShowTooltip(!showTooltip)}
                                            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginLeft: 2 })}
                                        >
                                            <Ionicons name="information-circle-outline" size={14} color="#94a3b8" />
                                        </Pressable>
                                    )}
                                </View>
                                <Text style={styles.premiumValueDetailed}>
                                    {formatValue(value)} <Text style={styles.premiumUnitDetailed}>{unit}</Text>
                                </Text>
                            </View>
                        </View>
                        {/* Old Delta Removed */}
                    </View>
                )}

                {/* Header Section - COMPACT MODE (Mobile) */}
                {!isDetailed && (
                    <View>
                        <View style={[styles.premiumIconCircle, { backgroundColor: iconBg }]}>
                            <Ionicons name={icon} size={20} color={accentColor} />
                        </View>
                        <Text style={styles.premiumTitle}>{title}</Text>
                    </View>
                )}

                {/* GRAPH SECTION */}
                {hasChart && (
                    <View style={isDetailed ? styles.premiumChartDetailedContainer : styles.premiumChartBg}>
                        {title === 'CUMPLIMIENTO' ? (
                            <PieChart
                                data={chartData}
                                width={customChartWidth}
                                height={chartHeight}
                                chartConfig={chartConfig}
                                accessor={"population"}
                                backgroundColor={"transparent"}
                                paddingLeft={"15"}
                                center={[10, 0]}
                                absolute
                                hasLegend={isDetailed}
                            />
                        ) : (
                            <LineChart
                                data={{
                                    labels: isDetailed ? displayLabels : chartData.map(() => ''),
                                    datasets: [{ data: chartData.map(v => Math.max(0, v || 0)) }]
                                }}
                                width={customChartWidth || (isDetailed ? 200 : 160)}
                                height={chartHeight}
                                chartConfig={isDetailed ? detailedChartConfig : {
                                    ...chartConfig,
                                    color: (opacity = 1) => accentColor.replace(')', `, ${opacity})`).replace('rgb', 'rgba'),
                                    fillShadowGradient: accentColor,
                                }}
                                bezier
                                withInnerLines={isDetailed}
                                withOuterLines={false}
                                withVerticalLines={false}
                                withHorizontalLines={isDetailed}
                                withHorizontalLabels={false}
                                withVerticalLabels={isDetailed}
                                withDots={isDetailed}
                                style={isDetailed ? {
                                    marginTop: 8,
                                    paddingRight: 32,
                                    paddingLeft: 0,
                                    marginLeft: -20,
                                    paddingBottom: 20
                                } : {
                                    position: 'absolute', bottom: -10, right: -10, paddingRight: 0
                                }}
                            />
                        )}
                    </View>
                )}

                {/* TOOLTIP COMPONENT */}
                {showTooltip && description && (
                    <View style={styles.tooltipContainer}>
                        <Text style={styles.tooltipText}>{description}</Text>
                        <View style={styles.tooltipArrow} />
                    </View>
                )}

                {/* Footer Values - COMPACT MODE (Mobile) */}
                {!isDetailed && (
                    <View>
                        <View style={styles.premiumValueRow}>
                            <Text style={styles.premiumValue}>{formatValue(value)}</Text>
                            {unit && <Text style={styles.premiumUnit}>{unit}</Text>}
                        </View>

                        {delta && (
                            <View style={[styles.premiumDelta, { backgroundColor: delta.color + '15' }]}>
                                <Ionicons name={delta.icon} size={10} color={delta.color} />
                                <Text style={[styles.premiumDeltaText, { color: delta.color }]}>{delta.text}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    // Responsive Logic
    // Responsive Logic - USE onLayout for true width
    const [containerWidth, setContainerWidth] = useState(0);
    const isLargeScreen = containerWidth > 768; // Based on available space, not window

    // Calculate dynamic widths based on CONTAINER width
    const parentPadding = 0; // Padding is handled by parent container
    const gap = 12;

    // On Mobile: Full width card. On Desktop: 4 cols
    // If containerWidth is 0 (initial render), default to 0 to avoid errors
    const dynamicCardWidth = containerWidth > 0
        ? (isLargeScreen ? (containerWidth - (gap * 3)) / 4 : containerWidth)
        : 0;

    // Chart takes full width of card minus padding
    const chartWidth = dynamicCardWidth > 16 ? dynamicCardWidth - 16 : 0;

    return (
        <View
            style={styles.premiumDashboard}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >


            <View style={isLargeScreen ? styles.desktopGridContainer : styles.mobileStackContainer}>

                <PremiumStatCard
                    icon="barbell"
                    iconBg="#dbeafe"
                    title="VOLUMEN"
                    value={volumeData ? parseInt(volumeData.current).toLocaleString() : '--'}
                    unit="kg"
                    delta={volumeData?.delta}
                    accentColor="#3b82f6"
                    chartData={volumeData?.data}
                    chartLabels={volumeData?.labels}
                    highlightIndex={volumeData?.highlightIndex}
                    cardStyle={{ width: dynamicCardWidth, marginBottom: isLargeScreen ? 0 : 12 }}
                    customChartWidth={chartWidth}
                    isDetailed={true}
                    description="Volumen total de carga movida"
                />

                <PremiumStatCard
                    icon="scale"
                    iconBg="#d1fae5"
                    title="PESO"
                    value={weightData?.current || '--'}
                    unit="kg"
                    delta={weightData?.delta}
                    accentColor="#10b981"
                    chartData={weightData?.data}
                    chartLabels={weightData?.labels}
                    highlightIndex={weightData?.highlightIndex}
                    cardStyle={{ width: dynamicCardWidth, marginBottom: isLargeScreen ? 0 : 12 }}
                    customChartWidth={chartWidth}
                    isDetailed={true}
                    description="Peso corporal promedio"
                />

                <PremiumStatCard
                    icon="flame"
                    iconBg="#fef3c7"
                    title="INTENSIDAD"
                    value={intensityData?.current || '--'}
                    unit="kg/rep"
                    delta={intensityData?.delta}
                    accentColor="#f59e0b"
                    chartData={intensityData?.data}
                    chartLabels={intensityData?.labels}
                    highlightIndex={intensityData?.highlightIndex}
                    cardStyle={{ width: dynamicCardWidth, marginBottom: isLargeScreen ? 0 : 12 }}
                    customChartWidth={chartWidth}
                    isDetailed={true}
                    description="Carga media utilizada"
                />

                <PremiumStatCard
                    icon="checkmark-circle"
                    iconBg="#ede9fe"
                    title="CUMPLIMIENTO"
                    value={complianceData?.current || '--'}
                    unit="%"
                    delta={{
                        text: complianceData ? `${complianceData.inRangeSets}/${complianceData.totalSets} sets` : '--',
                        color: '#8b5cf6',
                        icon: 'list'
                    }}
                    accentColor="#8b5cf6"
                    chartData={complianceData?.data}
                    cardStyle={{ width: dynamicCardWidth, marginBottom: isLargeScreen ? 0 : 12 }}
                    customChartWidth={chartWidth}
                    isDetailed={true}
                    description="Sets en rango objetivo"
                />
            </View>
        </View>
    );
};



// 🆕 PRO TECH NOTES INPUT - RADICAL REDESIGN (GRID LAYOUT)
const ProTechnicalNoteInput = ({ items, setItems, placeholder, onViewMedia }) => {
    const [text, setText] = useState('');

    const addItem = () => {
        if (!text.trim()) return;
        setItems([...items, { text: text.trim(), id: Date.now().toString() }]);
        setText('');
    };

    const removeItem = (index) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    return (
        <View style={styles.proInputContainer}>
            {items.map((item, index) => (
                <View key={index} style={styles.proCard}>
                    <View style={styles.proCardContent}>
                        {/* Header Grid: Thumbnail | Info | Remove */}
                        <View style={styles.proCardHeaderGrid}>

                            {/* Thumbnail */}
                            {(item.thumbnail || item.sourceMediaUrl) ? (
                                <Image
                                    source={{ uri: item.thumbnail || item.sourceMediaUrl }}
                                    style={styles.proThumbnail}
                                    contentFit="cover"
                                />
                            ) : (
                                <View style={[styles.proThumbnail, { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }]}>
                                    <Ionicons name="barbell" size={24} color="#cbd5e1" />
                                </View>
                            )}

                            {/* Info */}
                            <View style={styles.proHeaderInfo}>
                                <Text style={styles.proExerciseTitle} numberOfLines={2}>
                                    {item.exerciseName || 'OBSERVACIÓN GENERAL'}
                                </Text>
                                {/* Optional Badge: Could be dynamic based on analysis status later */}
                                <View style={styles.proStatusBadge}>
                                    <Text style={styles.proStatusText}>ANÁLISIS</Text>
                                </View>
                            </View>

                            {/* Remove */}
                            <TouchableOpacity onPress={() => removeItem(index)} style={styles.proRemoveBtn}>
                                <Ionicons name="close" size={18} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        {/* Input Area (Read-only/Edit view for item) */}
                        <View style={styles.proInputArea}>
                            <Text style={styles.proTextInput}>{item.text}</Text>
                        </View>

                        {/* Media Link Footer */}
                        {(item.sourceMediaUrl || item.thumbnail) && onViewMedia && (
                            <TouchableOpacity
                                style={styles.proMediaLink}
                                onPress={() => onViewMedia(item)}
                            >
                                <Ionicons name={item.mediaType === 'photo' ? 'image' : 'videocam'} size={12} color="#fff" />
                                <Text style={styles.proMediaLinkText}>Ver archivo adjunto</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ))}

            <View style={styles.addItemRow}>
                <EnhancedTextInput
                    containerStyle={styles.addItemInputContainer}
                    style={styles.addItemInputText}
                    placeholder={placeholder}
                    placeholderTextColor="#94a3b8"
                    value={text}
                    onChangeText={setText}
                    onSubmitEditing={addItem}
                />
                <TouchableOpacity
                    style={[styles.addItemBtn, { backgroundColor: text.trim() ? '#3b82f6' : '#e2e8f0' }]}
                    onPress={addItem}
                    disabled={!text.trim()}
                >
                    <Ionicons name="arrow-up" size={24} color={text.trim() ? '#fff' : '#94a3b8'} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ... SectionHeader reused from before
const SectionHeader = ({ emoji, title, color, count }) => (
    <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
        <Text style={styles.sectionEmoji}>{emoji}</Text>
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        {count !== undefined && (
            <View style={[styles.countBadge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.countText, { color }]}>{count}</Text>
            </View>
        )}
    </View>
);

// ... ItemInput reused (supports photo items with thumbnails)
const ItemInput = ({ items, setItems, placeholder, color = '#3b82f6', onViewMedia }) => {
    const [text, setText] = useState('');
    const addItem = () => {
        if (!text.trim()) return;
        setItems([...items, { text: text.trim(), id: Date.now().toString() }]);
        setText('');
    };
    const removeItem = (index) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };
    return (
        <View style={styles.itemInputContainer}>
            {items.map((item, index) => {
                const hasMedia = item.mediaType === 'photo' && (item.thumbnail || item.sourceMediaUrl);
                const hasCompare = item.compareData;

                return (
                    <View key={item.id || index} style={[styles.itemRow, hasMedia && styles.itemRowMedia]}>
                        {/* Thumbnail for photo items */}
                        {hasMedia ? (
                            <TouchableOpacity
                                onPress={() => onViewMedia?.(item)}
                                style={styles.itemThumbnailWrap}
                            >
                                <Image
                                    source={{ uri: item.thumbnail || item.sourceMediaUrl }}
                                    style={styles.itemThumbnail}
                                    contentFit="cover"
                                />
                                {hasCompare && (
                                    <View style={styles.itemCompareBadge}>
                                        <Ionicons name="git-compare" size={10} color="#fff" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        ) : (
                            <View style={[styles.itemDot, { backgroundColor: color }]} />
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemText}>{item.text}</Text>
                            {hasCompare && (
                                <Text style={styles.itemCompareLabel}>
                                    {item.compareData.delta}
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={() => removeItem(index)} style={styles.itemRemove}>
                            <Ionicons name="close-circle" size={20} color="#cbd5e1" />
                        </TouchableOpacity>
                    </View>
                );
            })}
            <View style={styles.addItemRow}>
                <EnhancedTextInput
                    containerStyle={styles.addItemInputContainer}
                    style={styles.addItemInputText}
                    placeholder={placeholder}
                    placeholderTextColor="#94a3b8"
                    value={text}
                    onChangeText={setText}
                    onSubmitEditing={addItem}
                />
                <TouchableOpacity
                    style={[styles.addItemBtn, { backgroundColor: text.trim() ? color : '#e2e8f0' }]}
                    onPress={addItem}
                    disabled={!text.trim()}
                >
                    <Ionicons name="arrow-up" size={24} color={text.trim() ? '#fff' : '#94a3b8'} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function FeedbackReportModal({ visible, onClose, client, clients = [], onSwitchClient, prefillData = null }) {
    const { token } = useAuth();
    const { drafts, clearDrafts } = useFeedbackDraft();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    // Removed isSidebarVisible as it's now permanent split-view

    // Data State
    const [lastFeedbackDate, setLastFeedbackDate] = useState(null);
    const [recentWorkouts, setRecentWorkouts] = useState([]);
    const [monitoringHistory, setMonitoringHistory] = useState([]);
    const [loadingMetrics, setLoadingMetrics] = useState(false);

    // Form State
    const [trafficLight, setTrafficLight] = useState('green');
    const [weekNumber, setWeekNumber] = useState('');
    const [highlights, setHighlights] = useState([]);
    const [technicalNotes, setTechnicalNotes] = useState([]);
    const [actionPlan, setActionPlan] = useState([]);

    // Modals
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [mediaPreviewItem, setMediaPreviewItem] = useState(null);

    // Header Info State
    const [clientProgram, setClientProgram] = useState(null);

    // ─────────────────────────────────────────────────────────────────────────
    // DATA LOADING
    // ─────────────────────────────────────────────────────────────────────────

    const loadData = useCallback(async () => {
        if (!client?._id || !visible) return;

        setLoading(true);
        setLoadingMetrics(true);
        try {
            // 0. Fetch Last Feedback Date
            // We fetch the list and take the most recent one that is sent
            const feedbacksRes = await fetch(`${API_URL}/api/feedback-reports/client/${client._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const feedbacksJson = await feedbacksRes.json();
            let startDate = null;
            if (feedbacksJson.success && feedbacksJson.reports?.length > 0) {
                // Assuming sorted desc by backend or we sort here
                const sentReports = feedbacksJson.reports.filter(r => r.status === 'sent');
                if (sentReports.length > 0) {
                    startDate = sentReports[0].createdAt; // Date of last sent feedback
                }
            }
            setLastFeedbackDate(startDate);

            // A. Workouts (for Volume Chart) - Fetch enough history
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            const workoutsRes = await fetch(
                `${API_URL}/api/workouts/by-user/${client._id}?limit=50&startDate=${threeMonthsAgo.toISOString()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const workoutsJson = await workoutsRes.json();
            if (workoutsJson.success) setRecentWorkouts(workoutsJson.workouts || []);

            // B. Monitoring History (for Weight/Adherence)
            const historyRes = await fetch(`${API_URL}/api/monitoring/coach/client/${client._id}/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const historyJson = await historyRes.json();
            if (historyJson.success) setMonitoringHistory(historyJson.daily || []);

            // C. CLIENT PROGRAM INFO (Routine & Diet)
            let nutritionJson = { success: false };
            let userJson = { success: false };

            try {
                const [nutritionRes, userRes] = await Promise.all([
                    fetch(`${API_URL}/api/nutrition/${client._id}`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_URL}/api/users/${client._id}`, { headers: { Authorization: `Bearer ${token}` } })
                ]);

                if (nutritionRes.ok) nutritionJson = await nutritionRes.json();
                if (userRes.ok) userJson = await userRes.json();
            } catch (e) {
                console.log('Error fetching program info:', e);
            }

            const programInfo = {
                currentRoutine: { name: client.currentRoutineName || 'Consultar Perfil' },
                currentDiet: { name: 'Sin Dieta', type: '', calories: null },
                macroTargets: { calories: null, protein: null, carbs: null, fats: null }
            };

            // 1. Routine Name from User (if available)
            if (userJson.success && userJson.user?.currentRoutineName) {
                programInfo.currentRoutine.name = userJson.user.currentRoutineName;
            }

            // 2. Nutrition Info from Plan
            if (nutritionJson.success && nutritionJson.plan) {
                const plan = nutritionJson.plan;
                programInfo.currentDiet.name = plan.name || 'Personalizada';
                programInfo.currentDiet.type = plan.type || '';

                if (plan.dayTargets?.length > 0) {
                    const target = plan.dayTargets[0];
                    programInfo.macroTargets = {
                        calories: target.kcal,
                        protein: target.protein,
                        carbs: target.carbs,
                        fats: target.fat
                    };
                } else if (plan.calories) {
                    programInfo.macroTargets = {
                        calories: plan.calories,
                        protein: plan.protein,
                        carbs: plan.carbs,
                        fats: plan.fat
                    };
                }
            } else if (userJson.success && userJson.user?.info_user?.calories) {
                // Fallback to user info
                programInfo.macroTargets.calories = userJson.user.info_user.calories;
            }

            setClientProgram(programInfo);

        } catch (error) {
            console.log('[FeedbackModal] Error loading data:', error);
        } finally {
            setLoading(false);
            setLoadingMetrics(false);
        }
    }, [client?._id, visible, token]);

    useEffect(() => {
        if (visible) {
            loadData();
            if (prefillData) {
                // Prefill logic - preserve full highlight objects (photo data)
                setTrafficLight(prefillData.trafficLight || 'green');
                const logrosData = prefillData.highlights || [];
                setHighlights(logrosData.map((item, i) => {
                    if (typeof item === 'string') {
                        return { text: item, id: `prefill-h-${i}` };
                    }
                    // Preserve all media fields from rich highlight objects
                    return {
                        ...item,
                        id: item.id || `prefill-h-${i}`,
                        text: item.text || 'Foto de progreso',
                    };
                }));
                const analysisData = prefillData.analysis || '';
                setTechnicalNotes(analysisData ? [{ text: analysisData, id: 'prefill-n-0' }] : []);
                const actionData = prefillData.actionItems || [];
                setActionPlan(actionData.map((text, i) => ({ text: typeof text === 'string' ? text : text.text, id: `prefill-a-${i}` })));
            } else {
                setTrafficLight('green');
                // Load drafts...
                const draftHighlights = drafts.highlights.map(h => ({ ...h, id: h.id || Date.now() + Math.random() }));
                setHighlights(draftHighlights);
                const draftNotes = drafts.technicalNotes.map(n => ({ ...n, id: n.id || Date.now() + Math.random() }));
                setTechnicalNotes(draftNotes);
            }
        }
    }, [visible, loadData, prefillData, drafts]);

    const handleSave = async (send = false) => {
        if (highlights.length === 0 && technicalNotes.length === 0) {
            Alert.alert('⚠️ Campos requeridos', 'Añade al menos un logro o nota técnica');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                clientId: client._id,
                trafficLight,
                weekNumber: weekNumber || null,
                highlights: highlights.map(h => ({
                    text: h.text,
                    sourceMediaUrl: h.sourceMediaUrl || null,
                    sourceMediaKey: h.sourceMediaKey || null,
                    mediaType: h.mediaType || null,
                    exerciseName: h.exerciseName || null
                })),
                technicalNotes: technicalNotes.map(n => ({
                    text: n.text,
                    category: 'other',
                    sourceMediaUrl: n.sourceMediaUrl || null,
                    sourceMediaKey: n.sourceMediaKey || null,
                    sourceMediaType: n.sourceMediaType || n.mediaType || null,
                    exerciseName: n.exerciseName || null,
                    videoUrl: n.videoUrl || null
                })),
                actionPlan: actionPlan.map(a => ({ text: a.text })),
                status: send ? 'sent' : 'draft'
            };

            const res = await fetch(`${API_URL}/api/feedback-reports`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                if (send) clearDrafts();
                setShowSuccessModal(true);
                setTimeout(() => {
                    setShowSuccessModal(false);
                    onClose();
                }, 1500);
            } else {
                Alert.alert('Error', data.message || 'No se pudo guardar');
            }
        } catch (error) {
            Alert.alert('Error', 'Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    // 🆕 SPLIT VIEW LAYOUT
    const objetivoTag = getObjetivoTag(client?.info_user?.objetivoPrincipal);

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <View style={[styles.container, { paddingTop: insets.top, flexDirection: 'row' }]}>

                {/* 👈 LEFT PANEL: CLIENT SIDEBAR (Always Visible) */}
                <ClientSidebar
                    clients={clients}
                    onSelect={onSwitchClient}
                    onClose={onClose}
                    currentClientId={client?._id}
                />

                {/* 👉 RIGHT PANEL: CONTENT */}
                <View style={{ flex: 1 }}>
                    <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

                        {/* 🔝 UNIFIED CLIENT HEADER CARD */}
                        <View style={styles.headerContainer}>
                            {/* LEFT: Back Only (No Menu) - REMOVED (Moved to Sidebar) */}
                            {/* <View style={styles.headerLeftAction}>
                                <TouchableOpacity onPress={onClose} style={styles.headerBackBtn}>
                                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                                </TouchableOpacity>
                            </View> */}

                            <View style={styles.clientInfoCard}>
                                {/* Top: Avatar & Name */}
                                <View style={styles.cardHeaderRow}>
                                    <AvatarWithInitials avatarUrl={client?.avatarUrl} name={client?.nombre} size={46} />
                                    <View style={styles.cardHeaderText}>
                                        <Text style={styles.clientName}>{client?.nombre || 'Cliente'}</Text>
                                        {objetivoTag ? (
                                            <View style={styles.goalTag}>
                                                <Ionicons name={objetivoTag.icon} size={10} color={objetivoTag.color} />
                                                <Text style={[styles.goalText, { color: objetivoTag.color }]}>{objetivoTag.text}</Text>
                                            </View>
                                        ) : <Text style={styles.headerSubtitle}>Nuevo Reporte</Text>}
                                    </View>
                                </View>

                                {/* Divider */}
                                {!loading && clientProgram && <View style={styles.cardDivider} />}

                                {/* Bottom: Program Details */}
                                {!loading && clientProgram && (
                                    <View style={styles.cardProgramSection}>
                                        {/* Routine & Diet */}
                                        <View style={styles.programRow}>
                                            <View style={styles.programItem}>
                                                <Ionicons name="barbell-outline" size={14} color="#64748b" />
                                                <Text style={styles.programText} numberOfLines={1}>
                                                    {clientProgram.currentRoutine?.name || 'Sin Rutina'}
                                                </Text>
                                            </View>
                                            <View style={styles.programDot} />
                                            <View style={styles.programItem}>
                                                <Ionicons name="restaurant-outline" size={14} color="#64748b" />
                                                <Text style={styles.programText} numberOfLines={1}>
                                                    {clientProgram.currentDiet?.name || 'Sin Dieta'}
                                                    {clientProgram.currentDiet?.type && ` (${clientProgram.currentDiet.type})`}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Macros */}
                                        {(clientProgram.macroTargets || clientProgram.currentDiet?.calories) && (
                                            <View style={styles.macrosRow}>
                                                <View style={styles.macroBadge}>
                                                    <Text style={styles.macroEmoji}>🔥</Text>
                                                    <Text style={styles.macroValue}>
                                                        {clientProgram.currentDiet?.calories || clientProgram.macroTargets?.calories || '--'}
                                                    </Text>
                                                </View>
                                                <View style={styles.macroBadge}>
                                                    <Text style={styles.macroEmoji}>🥩</Text>
                                                    <Text style={styles.macroValue}>{clientProgram.macroTargets?.protein || '--'}g</Text>
                                                </View>
                                                <View style={styles.macroBadge}>
                                                    <Text style={styles.macroEmoji}>🍞</Text>
                                                    <Text style={styles.macroValue}>{clientProgram.macroTargets?.carbs || '--'}g</Text>
                                                </View>
                                                <View style={styles.macroBadge}>
                                                    <Text style={styles.macroEmoji}>🥑</Text>
                                                    <Text style={styles.macroValue}>{clientProgram.macroTargets?.fats || '--'}g</Text>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        </View>

                        {loading ? (
                            <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#3b82f6" /></View>
                        ) : (
                            <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>

                                {/* 📊 DASHBOARD */}
                                <View style={[styles.sectionHeader, { justifyContent: 'space-between', alignItems: 'center' }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.sectionEmoji}>📊</Text>
                                        <Text style={styles.sectionTitle}>
                                            {lastFeedbackDate ? 'DESDE EL ÚLTIMO FEEDBACK' : 'MÉTRICAS RECIENTES'}
                                        </Text>
                                        {lastFeedbackDate && (
                                            <View style={{ marginLeft: 8, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748b' }}>
                                                    {new Date(lastFeedbackDate).toLocaleDateString()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* 🚥 STATUS + WEEK (Moved Here) */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        {/* Week Input Pill */}
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 8,
                                            backgroundColor: '#fff',
                                            borderWidth: 1,
                                            borderColor: '#e2e8f0',
                                            borderRadius: 20,
                                            paddingVertical: 4,
                                            paddingHorizontal: 12,
                                            height: 40,
                                            shadowColor: '#64748b',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.05,
                                            shadowRadius: 4,
                                            elevation: 1
                                        }}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8' }}>SEM</Text>
                                            <View style={{ width: 1, height: 14, backgroundColor: '#e2e8f0' }} />
                                            <TextInput
                                                style={{ fontSize: 13, fontWeight: '700', color: '#0f172a', width: 24, textAlign: 'center', padding: 0 }}
                                                placeholder="#"
                                                placeholderTextColor="#cbd5e1"
                                                value={weekNumber}
                                                onChangeText={setWeekNumber}
                                                keyboardType="numeric"
                                            />
                                        </View>

                                        {/* Status Control */}
                                        <View style={{ width: 280 }}>
                                            <StatusSegmentedControl value={trafficLight} onChange={setTrafficLight} />
                                        </View>
                                    </View>
                                </View>
                                <MetricsDashboard
                                    sessions={recentWorkouts}
                                    history={monitoringHistory}
                                    loading={loadingMetrics}
                                    lastFeedbackDate={lastFeedbackDate}
                                />

                                {/* 📝 SECTIONS */}
                                <SectionHeader emoji="✨" title="Logros" color="#10b981" count={highlights.length} />
                                <ItemInput items={highlights} setItems={setHighlights} placeholder="¿Qué ha ido bien?" color="#10b981" onViewMedia={setMediaPreviewItem} />

                                <SectionHeader emoji="🔍" title="Análisis Técnico" color="#3b82f6" count={technicalNotes.length} />
                                <ProTechnicalNoteInput
                                    items={technicalNotes}
                                    setItems={setTechnicalNotes}
                                    placeholder="Añadir corrección o nota..."
                                    onViewMedia={setMediaPreviewItem}
                                />

                                <SectionHeader emoji="🎯" title="Plan de Acción" color="#f59e0b" count={actionPlan.length} />
                                <ItemInput items={actionPlan} setItems={setActionPlan} placeholder="Tareas para la semana..." color="#f59e0b" />

                                <View style={{ height: 40 }} />
                            </ScrollView>
                        )}

                        {/* FOOTER */}
                        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                            <TouchableOpacity style={styles.draftBtn} onPress={() => handleSave(false)} disabled={saving}>
                                <Text style={styles.draftBtnText}>Guardar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sendBtn} onPress={() => handleSave(true)} disabled={saving}>
                                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Enviar Reporte</Text>}
                            </TouchableOpacity>
                        </View>

                    </KeyboardAvoidingView>
                </View>
            </View >

            {/* Media Preview Modal */}
            < Modal visible={!!mediaPreviewItem} transparent animationType="fade" onRequestClose={() => setMediaPreviewItem(null)}>
                <View style={styles.mediaPreviewOverlay}>
                    <View style={styles.mediaPreviewContainer}>
                        <View style={styles.mediaPreviewHeader}>
                            <Text style={styles.mediaPreviewExercise}>{mediaPreviewItem?.exerciseName || 'Archivo'}</Text>
                            <TouchableOpacity onPress={() => setMediaPreviewItem(null)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
                        </View>
                        <View style={styles.mediaPreviewContent}>
                            {mediaPreviewItem?.mediaType === 'photo' ? (
                                <Image source={{ uri: mediaPreviewItem?.sourceMediaUrl }} style={styles.mediaPreviewImage} contentFit="contain" />
                            ) : (
                                <VideoPreviewPlayer uri={mediaPreviewItem?.sourceMediaUrl} style={styles.mediaPreviewVideo} />
                            )}
                        </View>
                    </View>
                </View>
            </Modal >
            {/* Success Modal */}
            {
                showSuccessModal && (
                    <View style={styles.successOverlay}>
                        <View style={styles.successCard}>
                            <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                            <Text style={styles.successText}>¡Feedback Enviado!</Text>
                        </View>
                    </View>
                )
            }
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' }, // White Lilac / Ice Grey
    keyboardView: { flex: 1 },
    content: { flex: 1 },
    contentInner: { padding: 16, paddingBottom: 40 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // CLIENT HEADER
    clientHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
        zIndex: 10
    },
    headerBackBtn: { padding: 4 },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
    headerTexts: { justifyContent: 'center' },
    clientName: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 13, color: '#64748b', fontWeight: '500', marginTop: 2 },
    goalTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 4, alignSelf: 'flex-start' },
    goalText: { fontSize: 11, fontWeight: '700', color: '#475569' },

    // PREMIUM METRICS DASHBOARD
    premiumDashboard: { marginBottom: 24, marginTop: 12 },
    desktopGridContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 24,
        width: '100%',
    },
    mobileStackContainer: {
        flexDirection: 'column',
        gap: 12,
        marginBottom: 24,
        width: '100%',
    },
    dashboardTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 1,
        marginBottom: 12,
        textTransform: 'uppercase',
        marginLeft: 4
    },
    premiumScrollContent: { paddingRight: 16, gap: 12 },
    premiumCard: {
        width: 156, // Compact width
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 12, // Reduced padding
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
        overflow: 'hidden',
        position: 'relative',
        height: 120, // Compact height
        justifyContent: 'space-between'
    },
    premiumCardDetailed: {
        height: 'auto',
        minHeight: 220,
        justifyContent: 'flex-start',
        padding: 16,
    },
    premiumHeaderDetailed: {
        flexDirection: 'row',
        alignItems: 'center', // Vertically center icon and text block
        marginBottom: 24, // More breathing room
        gap: 16 // Separation between icon and text
    },
    premiumHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flex: 1
    },

    premiumTitleDetailed: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: 1, // Professional spacing
        textTransform: 'uppercase',
        marginBottom: 4
    },
    premiumValueDetailed: {
        fontSize: 32, // MUCH larger value
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -1.5,
        lineHeight: 36
    },
    premiumUnitDetailed: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94a3b8',
        marginLeft: 4
    },

    premiumChartDetailedContainer: {
        marginTop: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 25,
        marginRight: -16,
    },
    premiumAccent: { display: 'none' },
    premiumDescription: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 4,
        fontStyle: 'italic',
        textAlign: 'center',
        display: 'none'
    },
    tooltipContainer: {
        position: 'absolute',
        top: 28,
        left: 20,
        right: 20,
        backgroundColor: '#1e293b',
        padding: 8,
        borderRadius: 8,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
        pointerEvents: 'none'
    },
    tooltipText: {
        fontSize: 11,
        color: '#fff',
        fontWeight: '500',
        textAlign: 'center'
    },
    tooltipArrow: {
        position: 'absolute',
        top: -6,
        left: 20,
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderBottomWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#1e293b'
    },
    premiumIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4
    },
    premiumTitle: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' },
    premiumValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginVertical: 0 },
    premiumValue: { fontSize: 18, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
    premiumUnit: { fontSize: 10, fontWeight: '600', color: '#64748b' },

    premiumDelta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 2
    },

    // NEW PRETTY CIRCLE / PILL FOR HEADER
    premiumDeltaCircle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        height: 20,
        borderRadius: 12, // More pill-like
        gap: 4,
        marginLeft: 8,
        borderWidth: 1, // Subtle border
        borderColor: 'rgba(0,0,0,0.05)'
    },
    premiumDeltaTextCircle: { fontSize: 9, fontWeight: '800' },
    premiumDeltaTextCircle: { fontSize: 9, fontWeight: '800' },

    premiumDeltaBadge: {
        display: 'none'
    },
    premiumDeltaTextDetailed: { fontSize: 11, fontWeight: '700' },
    premiumDeltaText: { fontSize: 9, fontWeight: '800' },
    premiumChartBg: { position: 'absolute', bottom: -5, right: -5, left: 0, height: 40, opacity: 0.1 },

    // CONTROLS ROW & SEGMENTED CONTROL
    controlsRow: {
        flexDirection: 'row',
        gap: 20,
        alignItems: 'center',
        marginBottom: 32,
        backgroundColor: '#fff',
        padding: 12, // Reduced padding
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 1,
        maxWidth: 700, // Constrain width on large screens
        alignSelf: 'center', // Center it
        width: '100%'
    },
    weekInputContainer: { width: 60 },
    inputLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' },
    simpleWeekInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        height: 32, // Smaller input
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '700',
        color: '#334155'
    },

    // SEGMENTED CONTROL
    segmentedWrapper: { flex: 1 },
    segmentedLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' },
    segmentedContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 20, padding: 4, height: 40 }, // Taller pill
    segmentBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
    segmentText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

    // SIDEBAR STYLES (SPLIT VIEW + COLLAPSIBLE)
    sidebarPanel: {
        // width: 300, -> Controlled inline
        backgroundColor: '#fff',
        borderRightWidth: 1,
        borderRightColor: '#e2e8f0',
        height: '100%',
        transition: 'width 0.3s ease' // Web enhancement, ignored on native but good for later
    },
    sidebarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
        paddingTop: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        height: 60
    },
    sidebarToggleBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sidebarTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b'
    },
    sidebarSearch: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        margin: 16,
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 8
    },
    sidebarSearchInput: {
        flex: 1,
        fontSize: 13,
        color: '#1e293b'
    },
    sidebarList: {
        flex: 1,
    },
    sidebarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc'
    },
    sidebarItemActive: {
        backgroundColor: '#eff6ff',
        borderLeftWidth: 3,
        borderLeftColor: '#3b82f6'
    },
    sidebarItemInfo: {
        flex: 1
    },
    sidebarItemName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155'
    },
    sidebarItemNameActive: {
        color: '#3b82f6',
        fontWeight: '700'
    },
    sidebarItemStatus: {
        fontSize: 11,
        color: '#94a3b8'
    },

    // UNIFIED HEADER STYLES
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
        gap: 12
    },
    headerLeftAction: {
        gap: 8
    },
    headerBackBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4
    },
    clientInfoCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    cardHeaderText: {
        flex: 1,
        gap: 2
    },
    clientName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b'
    },
    goalTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        alignSelf: 'flex-start',
        gap: 4
    },
    goalText: { fontSize: 10, fontWeight: '600' },

    cardDivider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 10
    },
    cardProgramSection: {
        gap: 8
    },
    programRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8
    },
    programItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5
    },
    programDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#cbd5e1'
    },
    programText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#475569',
        maxWidth: 160
    },
    macrosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6
    },
    macroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        gap: 4
    },
    macroEmoji: { fontSize: 10 },
    macroValue: { fontSize: 11, fontWeight: '700', color: '#334155' },

    // PRO TECH CARDS - RADICAL REDESIGN
    proInputContainer: { gap: 12, flex: 1 },
    proCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 0,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 }, // Lighter shadow
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        overflow: 'hidden'
    },
    proCardContent: { padding: 12 }, // Reduced padding

    proCardHeaderGrid: { flexDirection: 'row', gap: 12, flex: 1 },

    proThumbnail: {
        width: 56, // Smaller thumbnail (was 64)
        height: 56,
        borderRadius: 10,
        backgroundColor: '#f1f5f9'
    },
    proHeaderInfo: { flex: 1, justifyContent: 'center', gap: 2 },

    proExerciseTitle: {
        fontSize: 13, // Smaller title
        fontWeight: '800',
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.2
    },
    proStatusBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    proStatusText: { fontSize: 9, fontWeight: '700', color: '#64748b' },

    proRemoveBtn: { padding: 4, marginLeft: 4 },

    proInputArea: {
        marginTop: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        minHeight: 48, // Reduced height
        padding: 10
    },
    proTextInput: {
        fontSize: 13,
        color: '#334155',
        lineHeight: 18
    },
    proPlaceholderText: { color: '#94a3b8', fontStyle: 'italic' },


    proMediaLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: '#eff6ff'
    },
    proMediaLinkText: { fontSize: 10, fontWeight: '700', color: '#3b82f6' },

    // SECTION HEADERS
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginTop: 6 },
    sectionEmoji: { fontSize: 16, marginRight: 8 },
    sectionTitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2 },

    itemInputContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
    itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    itemRowMedia: { paddingVertical: 8, gap: 10 },
    itemDot: { width: 6, height: 6, borderRadius: 3, marginRight: 12 },
    itemText: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '500' },
    itemRemove: { padding: 4 },
    itemThumbnailWrap: { position: 'relative' },
    itemThumbnail: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#f1f5f9' },
    itemCompareBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    itemCompareLabel: { fontSize: 11, color: '#6366f1', fontWeight: '600', marginTop: 2 },
    addItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    addItemInputContainer: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 12, height: 44, justifyContent: 'center' },
    addItemInputText: { fontSize: 14, color: '#334155' },
    addItemBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

    // FOOTER
    footer: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 12 },
    draftBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1' },
    draftBtnText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    sendBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#3b82f6', borderRadius: 12, shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4 },
    sendBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

    // OVERLAYS
    mediaPreviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    mediaPreviewContainer: { width: '100%', maxWidth: 500, height: '70%', backgroundColor: '#000', borderRadius: 20, overflow: 'hidden' },
    mediaPreviewHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
    mediaPreviewContent: { flex: 1, justifyContent: 'center' },
    mediaPreviewImage: { width: '100%', height: '100%' },
    mediaPreviewVideo: { width: '100%', height: '100%' },
    mediaPreviewExercise: { color: '#fff', fontWeight: '700' },
    successOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)' },
    successCard: { alignItems: 'center', gap: 16 },
    successText: { fontSize: 20, fontWeight: '700', color: '#1e293b' }
});
