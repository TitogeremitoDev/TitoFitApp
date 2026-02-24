/* app/(coach)/seguimiento/[clientId].jsx - Detalle de Seguimiento de un Cliente */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
    Platform,
    Image,
    Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import Svg, { Circle as SvgCircle, Rect as SvgRect } from 'react-native-svg';
import { useAuth } from '../../../context/AuthContext';
import { useFeedbackBubble } from '../../../context/FeedbackBubbleContext';
import { calculateFullNutrition } from '../../../src/utils/nutritionCalculator';
import PhotoGalleryTab from '../../../src/components/coach/PhotoGalleryTab';
import CoachStudioModal from '../../../src/components/coach/CoachStudioModal';
import ClientSidebar from '../../../src/components/coach/ClientSidebar';
import LazySection from '../../../src/components/ui/LazySection';
import { useStableBreakpoint } from '../../../src/hooks/useStableBreakpoint';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';

import { cacheClientAvatars } from '../../../src/utils/avatarCache';

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
// RESPONSIVE CHART WRAPPER — measures parent width for react-native-chart-kit
// ═══════════════════════════════════════════════════════════════════════════
const ResponsiveChart = ({ children, fallbackWidth }) => {
    const [width, setWidth] = useState(fallbackWidth || 300);
    return (
        <View style={{ width: '100%' }} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
            {typeof children === 'function' ? children(width) : children}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// WEB CHART OPTIMIZATION — downsample data points to reduce SVG DOM nodes
// ═══════════════════════════════════════════════════════════════════════════
const MAX_CHART_POINTS = Platform.OS === 'web' ? 15 : 50;

const downsampleChartData = (chartData) => {
    if (!chartData || !chartData.labels) return chartData;
    const len = chartData.labels.length;
    if (len <= MAX_CHART_POINTS) return chartData;
    const indices = [0];
    const step = (len - 1) / (MAX_CHART_POINTS - 1);
    for (let i = 1; i < MAX_CHART_POINTS - 1; i++) {
        indices.push(Math.round(i * step));
    }
    indices.push(len - 1);
    return {
        ...chartData,
        labels: indices.map(i => chartData.labels[i]),
        datasets: chartData.datasets.map(ds => ({
            ...ds,
            data: indices.map(i => ds.data[i]),
        })),
    };
};

// ═══════════════════════════════════════════════════════════════════════════
// CHART CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
    labelColor: () => '#64748b',
    propsForLabels: { fontSize: 10 },
    propsForDots: { r: '2.5', strokeWidth: '1.5', stroke: '#fff' },
    fillShadowGradient: '#0ea5e9',
    fillShadowGradientOpacity: 0.08,
    propsForBackgroundLines: {
        strokeDasharray: '4 4',
        stroke: '#e5e7eb',
        strokeWidth: 0.5,
    },
};

const barChartConfig = {
    ...chartConfig,
    color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
    fillShadowGradient: '#8b5cf6',
    fillShadowGradientOpacity: 0.15,
};

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS RING COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const ProgressRing = ({ percentage, color, size = 70 }) => {
    const strokeWidth = 8;
    const normalizedPercentage = Math.min(100, Math.max(0, percentage));

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
                position: 'absolute',
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: '#e2e8f0',
            }} />
            <View style={{
                width: size - strokeWidth * 2,
                height: size - strokeWidth * 2,
                borderRadius: (size - strokeWidth * 2) / 2,
                backgroundColor: `${color}20`,
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color }}>
                    {Math.round(normalizedPercentage)}%
                </Text>
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// SPARKLINE COMPONENT (CSS Flexbox - lightweight)
// ═══════════════════════════════════════════════════════════════════════════

const Sparkline = ({ data = [], height = 32, color = '#3b82f6', highlightLast = true }) => {
    if (!data || data.length === 0) return null;
    const maxValue = Math.max(...data.filter(v => v > 0), 1);

    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 2 }}>
            {data.slice(-7).map((value, index, arr) => {
                const barHeight = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const isLast = highlightLast && index === arr.length - 1;
                return (
                    <View
                        key={index}
                        style={{
                            width: 6,
                            height: `${Math.max(barHeight, 8)}%`,
                            backgroundColor: isLast ? color : `${color}50`,
                            borderRadius: 2,
                        }}
                    />
                );
            })}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// DOT INDICATOR COMPONENT (Energy/Mood visualization)
// ═══════════════════════════════════════════════════════════════════════════

const DotIndicator = ({ value = 0, maxValue = 5, activeColor = '#3b82f6' }) => {
    return (
        <View style={{ flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: maxValue }).map((_, i) => (
                <View
                    key={i}
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: i < value ? activeColor : '#e2e8f0',
                    }}
                />
            ))}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// STATUS BADGE HELPER
// ═══════════════════════════════════════════════════════════════════════════

const getStatusBadge = (record) => {
    // Determine status based on record data
    if (record.haIdoBien === 'no' || record.animo <= 2 || record.energia <= 2) {
        return { text: 'INCIDENCIAS', color: '#ef4444', bgColor: '#fef2f2' };
    }
    if (record.haIdoBien === 'medio' || record.animo === 3 || record.energia === 3) {
        return { text: 'MEDIA', color: '#f59e0b', bgColor: '#fffbeb' };
    }
    return { text: 'TODO OK', color: '#10b981', bgColor: '#ecfdf5' };
};

// ═══════════════════════════════════════════════════════════════════════════
// NUTRITION GALLERY TAB (fotos de comida del cliente)
// ═══════════════════════════════════════════════════════════════════════════

const NutritionGalleryTab = ({ clientId, token }) => {
    const [photos, setPhotos] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedPhoto, setSelectedPhoto] = React.useState(null);

    const API_URL_GALLERY = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    React.useEffect(() => {
        fetchNutritionPhotos();
    }, [clientId]);

    const fetchNutritionPhotos = async () => {
        try {
            setLoading(true);
            const res = await fetch(
                `${API_URL_GALLERY}/api/progress-photos/client/${clientId}?category=nutrition&limit=100`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json();
            if (data.success) {
                setPhotos(data.photos || []);
            }
        } catch (e) {
            console.error('[NutritionGallery] Error:', e);
        } finally {
            setLoading(false);
        }
    };

    // Agrupar fotos por fecha
    const groupedPhotos = React.useMemo(() => {
        const groups = {};
        photos.forEach(p => {
            const dateKey = new Date(p.takenAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(p);
        });
        return Object.entries(groups);
    }, [photos]);

    if (loading) {
        return (
            <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0ea5e9" />
                <Text style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>Cargando fotos de nutrición...</Text>
            </View>
        );
    }

    if (photos.length === 0) {
        return (
            <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="restaurant-outline" size={60} color="#cbd5e1" />
                <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '700', color: '#334155' }}>Sin fotos de comida</Text>
                <Text style={{ marginTop: 6, fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                    Las fotos que el cliente suba desde su sección de nutrición aparecerán aquí.
                </Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={{ padding: 12 }}>
            {groupedPhotos.map(([dateLabel, datePhotos]) => (
                <View key={dateLabel} style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 10 }}>
                        📅 {dateLabel}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {datePhotos.map((photo) => (
                            <View key={photo._id} style={{ width: 160 }}>
                                <TouchableOpacity
                                    onPress={() => setSelectedPhoto(selectedPhoto?._id === photo._id ? null : photo)}
                                    style={{
                                        width: 160, height: 120, borderRadius: 12, overflow: 'hidden',
                                        borderWidth: selectedPhoto?._id === photo._id ? 2 : 0,
                                        borderColor: '#0ea5e9',
                                    }}
                                >
                                    <Image
                                        source={{ uri: photo.fullUrl || photo.thumbnailUrl }}
                                        style={{ width: '100%', height: '100%' }}
                                    />
                                </TouchableOpacity>
                                {photo.mealInfo?.mealName && (
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 6 }} numberOfLines={1}>
                                        {photo.mealInfo.mealName}
                                    </Text>
                                )}
                                {photo.mealInfo?.optionName && (
                                    <Text style={{ fontSize: 10, color: '#64748b', marginTop: 1 }} numberOfLines={1}>
                                        {photo.mealInfo.optionName}
                                    </Text>
                                )}
                                {photo.mealInfo?.foods?.length > 0 && (
                                    <View style={{ marginTop: 4 }}>
                                        {photo.mealInfo.foods.slice(0, 4).map((f, fi) => (
                                            <Text key={fi} style={{ fontSize: 9, color: '#94a3b8', lineHeight: 14 }} numberOfLines={1}>
                                                {f.name}{f.amount ? ` · ${f.amount}${f.unit || ''}` : ''}
                                            </Text>
                                        ))}
                                        {photo.mealInfo.foods.length > 4 && (
                                            <Text style={{ fontSize: 9, color: '#cbd5e1' }}>+{photo.mealInfo.foods.length - 4} más</Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                </View>
            ))}

            {/* Fullscreen preview */}
            {selectedPhoto && (
                <Modal visible={true} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
                    <View style={{
                        flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
                        justifyContent: 'center', alignItems: 'center',
                    }}>
                        <TouchableOpacity
                            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}
                            onPress={() => setSelectedPhoto(null)}
                        >
                            <Ionicons name="close-circle" size={36} color="#fff" />
                        </TouchableOpacity>
                        <Image
                            source={{ uri: selectedPhoto.fullUrl }}
                            style={{ width: '90%', height: '70%', borderRadius: 12 }}
                            resizeMode="contain"
                        />
                        {selectedPhoto.mealInfo?.mealName && (
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 16 }}>
                                {selectedPhoto.mealInfo.mealName}
                                {selectedPhoto.mealInfo.optionName ? ` - ${selectedPhoto.mealInfo.optionName}` : ''}
                            </Text>
                        )}
                        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                            {new Date(selectedPhoto.takenAt).toLocaleDateString('es-ES', {
                                weekday: 'long', day: 'numeric', month: 'long',
                            })}
                        </Text>
                        {selectedPhoto.mealInfo?.foods?.length > 0 && (
                            <View style={{ marginTop: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 12, maxWidth: 300 }}>
                                {selectedPhoto.mealInfo.foods.map((f, fi) => (
                                    <Text key={fi} style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 20 }}>
                                        {f.name}{f.amount ? `  ·  ${f.amount} ${f.unit || ''}` : ''}
                                    </Text>
                                ))}
                            </View>
                        )}
                    </View>
                </Modal>
            )}
            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function ClientSeguimientoDetailScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const { token } = useAuth();
    const { isWide: isWideScreen, windowWidth } = useStableBreakpoint(1024);

    // 🛡️ Active client managed as state to avoid router.replace screen stacking on web
    const [activeClientId, setActiveClientId] = useState(params.clientId);
    const [activeClientName, setActiveClientName] = useState(params.clientName);
    const clientId = activeClientId;
    const clientName = activeClientName;

    // Estados principales
    const [dailyRecords, setDailyRecords] = useState([]);
    const [weeklyRecords, setWeeklyRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    // 📊 Navegación principal: GRAFICOS | DATOS | GALERIA
    const [mainTab, setMainTab] = useState('graficos');
    const [datosSubTab, setDatosSubTab] = useState('daily');
    const [galeriaSubTab, setGaleriaSubTab] = useState('corporal');

    // 📊 NUEVO: Client info and nutrition targets for stats
    const [clientInfo, setClientInfo] = useState(null);
    const [nutritionTargets, setNutritionTargets] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

    // 📂 NUEVO: Estado para meses expandidos (histórico colapsado por mes)
    const [expandedMonths, setExpandedMonths] = useState({});

    // 📷 NUEVO: Estado para galería de fotos y Coach Studio (con carrusel)
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [photoGroup, setPhotoGroup] = useState([]); // Grupo de fotos del mismo día
    const [photoIndex, setPhotoIndex] = useState(0);  // Índice actual en el carrusel
    const [studioVisible, setStudioVisible] = useState(false);

    // 📊 SEGUIMIENTO 2.0: New states
    const [timeRange, setTimeRange] = useState('30d');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [expandedZone, setExpandedZone] = useState(null);

    // 🆕 NEW: Single expanded row for accordion behavior
    const [expandedRowId, setExpandedRowId] = useState(null);

    // Toggle row expansion (one at a time)
    const toggleRowExpansion = (id) => {
        setExpandedRowId(prev => prev === id ? null : id);
    };

    // 🖥️ SIDEBAR: State for collapsible client list on wide screens
    const [sidebarClients, setSidebarClients] = useState([]);
    const [sidebarLoading, setSidebarLoading] = useState(true);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // isWideScreen already defined by useStableBreakpoint above

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    // Chart dimensions — responsive for grid layout
    const isWeb = Platform.OS === 'web';
    const sidebarW = isWideScreen ? (sidebarCollapsed ? 60 : 260) : 0;
    const contentW = windowWidth - sidebarW;
    // scrollContent padding=12*2, card padding=12*2, tierRow gap=10
    const chartWidth = isWeb ? Math.min(contentW - 48, 700) : windowWidth - 48;
    const halfChartWidth = isWideScreen ? Math.floor((contentW - 34) / 2 - 24) : chartWidth;

    // ─────────────────────────────────────────────────────────────────────────
    // CARGAR DATOS Y MARCAR COMO VISTO
    // ─────────────────────────────────────────────────────────────────────────
    const fetchClientHistory = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);

            // Cargar historial de seguimiento (365 daily + 52 weekly for full chart ranges)
            const res = await fetch(`${API_URL}/api/monitoring/coach/client/${clientId}/history?dailyLimit=365&weeklyLimit=52`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (data.success) {
                setDailyRecords(data.daily || []);
                setWeeklyRecords(data.weekly || []);
            }

            // 📊 NUEVO: Cargar info del cliente para estadísticas
            try {
                const clientRes = await fetch(`${API_URL}/api/users/${clientId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const clientData = await clientRes.json();
                if (clientData.success && clientData.user) {
                    setClientInfo(clientData.user);

                    // Calcular objetivos de nutrición del cliente
                    const info = clientData.user.info_user;
                    if (info) {
                        const nutrition = calculateFullNutrition(
                            info,
                            info.objetivoPrincipal || 'volumen',
                            info.af || 1.55
                        );
                        if (nutrition) {
                            setNutritionTargets({
                                kcal: nutrition.training.kcal,
                                protein: nutrition.training.protein,
                                carbs: nutrition.training.carbs,
                                fat: nutrition.training.fat,
                            });
                        }
                    }
                }
            } catch (e) {
                console.log('[Seguimiento Detail] Error cargando info cliente:', e.message);
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
    // 🖥️ SIDEBAR: Fetch all clients for sidebar navigation
    // ─────────────────────────────────────────────────────────────────────────
    const fetchSidebarClients = useCallback(async () => {
        if (!isWideScreen) return; // Only fetch if on wide screen

        try {
            setSidebarLoading(true);
            const res = await fetch(`${API_URL}/api/monitoring/coach/sidebar-status?context=seguimiento`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (data.success) {
                setSidebarClients(cacheClientAvatars(data.clients || []));
            }
        } catch (error) {
            console.error('[Sidebar] Error fetching clients:', error);
        } finally {
            setSidebarLoading(false);
        }
    }, [token, API_URL, isWideScreen]);

    useEffect(() => {
        if (isWideScreen) {
            fetchSidebarClients();
        }
    }, [isWideScreen, fetchSidebarClients]);

    // Handle sidebar client selection — NO router navigation to avoid screen stacking on web
    // Two-phase: 1) destroy all heavy content, 2) after DOM freed, switch client
    const handleSidebarClientSelect = (client) => {
        if (client._id === clientId) return;
        // Phase 1: Kill all heavy content immediately
        setDailyRecords([]);
        setWeeklyRecords([]);
        setClientInfo(null);
        setIsLoading(true);
        setMainTab('graficos');
        setExpandedMonths({});
        setSelectedPhoto(null);
        // Phase 2: Wait for React to commit the empty render, THEN switch client
        requestAnimationFrame(() => {
            setActiveClientId(client._id);
            setActiveClientName(client.nombre);
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.history.replaceState(null, '', `/seguimiento_coach/${client._id}?clientName=${encodeURIComponent(client.nombre)}`);
            }
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 📊 CHART DATA CALCULATIONS (para vista de estadísticas)
    // ─────────────────────────────────────────────────────────────────────────

    // Ordenar dailyRecords por fecha (full dataset — used by data view)
    const sortedDailyData = useMemo(() => {
        return [...dailyRecords].sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [dailyRecords]);

    // 📊 SEGUIMIENTO 2.0: Filtered data for charts based on timeRange
    const chartDailyData = useMemo(() => {
        if (timeRange === 'all') return sortedDailyData;
        const days = { '7d': 7, '30d': 30, '3m': 90, '6m': 180 };
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (days[timeRange] || 30));
        return sortedDailyData.filter(d => new Date(d.date) >= cutoff);
    }, [sortedDailyData, timeRange]);

    const chartWeeklyData = useMemo(() => {
        if (timeRange === 'all') return weeklyRecords;
        const days = { '7d': 7, '30d': 30, '3m': 90, '6m': 180 };
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (days[timeRange] || 30));
        return [...weeklyRecords]
            .sort((a, b) => new Date(a.weekStartDate) - new Date(b.weekStartDate))
            .filter(w => new Date(w.weekStartDate) >= cutoff);
    }, [weeklyRecords, timeRange]);

    // Peso objetivo del cliente
    const targetWeight = useMemo(() => {
        return clientInfo?.info_user?.pesoObjetivo || null;
    }, [clientInfo?.info_user?.pesoObjetivo]);

    // Peso actual (latest from full dataset)
    const currentWeight = useMemo(() => {
        const weightEntries = sortedDailyData.filter(d => d.peso && d.peso > 0);
        return weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].peso : null;
    }, [sortedDailyData]);

    // Weight chart data (uses chartDailyData for time range filtering)
    const weightChartData = useMemo(() => {
        const weightEntries = chartDailyData.filter(d => d.peso && d.peso > 0);
        if (weightEntries.length < 2) return null;

        const labels = weightEntries.map(d => {
            const date = new Date(d.date);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        });

        // Target weight line as second dataset
        const datasets = [{
            data: weightEntries.map(d => d.peso),
            color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
            strokeWidth: 3,
        }];

        if (targetWeight) {
            datasets.push({
                data: weightEntries.map(() => targetWeight),
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity * 0.3})`,
                strokeWidth: 2,
                withDots: false,
            });
        }

        return {
            labels: labels.length > 10 ? labels.filter((_, i) => i % Math.ceil(labels.length / 10) === 0) : labels,
            datasets,
        };
    }, [chartDailyData, targetWeight]);

    // Unified wellbeing chart: Ánimo + Energía on same axes (1-5)
    const wellbeingChartData = useMemo(() => {
        // Build unified timeline: entries that have at least animo OR energia
        const entries = chartDailyData.filter(d => (d.animo && d.animo > 0) || (d.energia && d.energia > 0));
        if (entries.length < 2) return null;

        const labels = entries.map(d => {
            const date = new Date(d.date);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        });
        const filteredLabels = labels.length > 10
            ? labels.map((l, i) => i % Math.ceil(labels.length / 10) === 0 ? l : '')
            : labels;

        return {
            labels: filteredLabels,
            datasets: [
                {
                    data: entries.map(d => d.animo || 0),
                    color: (opacity = 1) => `rgba(251, 191, 36, ${opacity})`,
                    strokeWidth: 2,
                },
                {
                    data: entries.map(d => d.energia || 0),
                    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                    strokeWidth: 2,
                },
            ],
            legend: ['Ánimo', 'Energía'],
        };
    }, [chartDailyData]);

    const avgMood = useMemo(() => {
        const m = chartDailyData.filter(d => d.animo && d.animo > 0);
        if (m.length === 0) return null;
        return (m.reduce((a, d) => a + d.animo, 0) / m.length).toFixed(1);
    }, [chartDailyData]);

    const avgEnergy = useMemo(() => {
        const e = chartDailyData.filter(d => d.energia && d.energia > 0);
        if (e.length === 0) return null;
        return (e.reduce((a, d) => a + d.energia, 0) / e.length).toFixed(1);
    }, [chartDailyData]);

    // Macro compliance percentages
    const macroCompliance = useMemo(() => {
        const entriesWithMacros = chartDailyData.filter(d => d.kcalConsumed && d.kcalConsumed > 0);
        if (entriesWithMacros.length === 0) return null;

        const avgKcal = entriesWithMacros.reduce((acc, d) => acc + (d.kcalConsumed || 0), 0) / entriesWithMacros.length;
        const avgProtein = entriesWithMacros.reduce((acc, d) => acc + (d.proteinConsumed || 0), 0) / entriesWithMacros.length;
        const avgCarbs = entriesWithMacros.reduce((acc, d) => acc + (d.carbsConsumed || 0), 0) / entriesWithMacros.length;
        const avgFat = entriesWithMacros.reduce((acc, d) => acc + (d.fatConsumed || 0), 0) / entriesWithMacros.length;

        return {
            kcal: nutritionTargets.kcal > 0 ? (avgKcal / nutritionTargets.kcal) * 100 : 0,
            protein: nutritionTargets.protein > 0 ? (avgProtein / nutritionTargets.protein) * 100 : 0,
            carbs: nutritionTargets.carbs > 0 ? (avgCarbs / nutritionTargets.carbs) * 100 : 0,
            fat: nutritionTargets.fat > 0 ? (avgFat / nutritionTargets.fat) * 100 : 0,
        };
    }, [chartDailyData, nutritionTargets]);

    // Sleep chart data
    const sleepChartData = useMemo(() => {
        const sleepEntries = chartDailyData.filter(d => d.sueno && d.sueno > 0);
        if (sleepEntries.length < 2) return null;

        const labels = sleepEntries.map(d => {
            const date = new Date(d.date);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        });

        return {
            labels: labels.length > 10 ? labels.filter((_, i) => i % Math.ceil(labels.length / 10) === 0) : labels,
            datasets: [{ data: sleepEntries.map(d => d.sueno) }],
        };
    }, [chartDailyData]);

    // Average sleep
    const avgSleep = useMemo(() => {
        const sleepEntries = chartDailyData.filter(d => d.sueno && d.sueno > 0);
        if (sleepEntries.length === 0) return null;
        const sum = sleepEntries.reduce((acc, d) => acc + d.sueno, 0);
        return (sum / sleepEntries.length).toFixed(1);
    }, [chartDailyData]);

    // Hunger vs Adherence data
    const hungerAdherenceData = useMemo(() => {
        if (chartWeeklyData.length === 0) return null;

        const dataPoints = [];
        chartWeeklyData.forEach(week => {
            if (!week.nutriAdherencia) return;

            const weekStart = new Date(week.weekStartDate);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);

            const weekDailyData = chartDailyData.filter(d => {
                const date = new Date(d.date);
                return date >= weekStart && date < weekEnd && d.hambre;
            });

            if (weekDailyData.length > 0) {
                const avgHunger = weekDailyData.reduce((acc, d) => acc + d.hambre, 0) / weekDailyData.length;
                dataPoints.push({
                    hunger: avgHunger,
                    adherence: week.nutriAdherencia,
                });
            }
        });

        return dataPoints.length >= 2 ? dataPoints : null;
    }, [chartDailyData, chartWeeklyData]);

    // ─────────────────────────────────────────────────────────────────────────
    // 📊 SEGUIMIENTO 2.0: HERO CARD CALCULATIONS
    // ─────────────────────────────────────────────────────────────────────────

    // Weight delta (first vs last in current time range)
    const weightDelta = useMemo(() => {
        const weightEntries = chartDailyData.filter(d => d.peso && d.peso > 0);
        if (weightEntries.length < 2) return null;
        const first = weightEntries[0].peso;
        const last = weightEntries[weightEntries.length - 1].peso;
        return Math.round((last - first) * 10) / 10;
    }, [chartDailyData]);

    // Client Score (0-100)
    const clientScore = useMemo(() => {
        // a) Adherence score (from weekly nutriAdherencia 1-10 → 0-100)
        const recentWeeklies = chartWeeklyData.slice(-4);
        let adherenceScore = 50;
        if (recentWeeklies.length > 0) {
            const adherenceValues = recentWeeklies.filter(w => w.nutriAdherencia).map(w => w.nutriAdherencia);
            if (adherenceValues.length > 0) {
                adherenceScore = (adherenceValues.reduce((s, v) => s + v, 0) / adherenceValues.length) * 10;
            }
        }

        // b) Weight score (proximity to target)
        let weightScore = 50;
        if (targetWeight && currentWeight) {
            const distPct = Math.abs(currentWeight - targetWeight) / targetWeight * 100;
            if (distPct < 2) weightScore = 100;
            else if (distPct < 5) weightScore = 80;
            else if (distPct < 10) weightScore = 60;
            else weightScore = 40;
        }

        // c) Consistency score (check-in days in last 7 days)
        const last7Days = sortedDailyData.filter(d => {
            const daysDiff = (new Date() - new Date(d.date)) / (1000 * 60 * 60 * 24);
            return daysDiff <= 7;
        });
        const consistencyScore = Math.min(100, (last7Days.length / 7) * 100);

        // d) Mood score (1-5 → 0-100)
        const moodVal = avgMood ? parseFloat(avgMood) : 3;
        const moodScoreVal = ((moodVal - 1) / 4) * 100;

        return Math.round(
            adherenceScore * 0.30 +
            weightScore * 0.25 +
            consistencyScore * 0.25 +
            moodScoreVal * 0.20
        );
    }, [chartWeeklyData, targetWeight, currentWeight, sortedDailyData, avgMood]);

    // Score state info
    const scoreState = useMemo(() => {
        if (clientScore >= 75) return { color: '#10b981', bg: '#10b98110', label: 'En buena linea' };
        if (clientScore >= 50) return { color: '#f59e0b', bg: '#f59e0b10', label: 'Necesita atencion' };
        return { color: '#ef4444', bg: '#ef444410', label: 'Intervenir' };
    }, [clientScore]);

    // Auto-generated summary phrase
    const summaryPhrase = useMemo(() => {
        const parts = [];
        if (currentWeight) {
            const deltaStr = weightDelta
                ? (weightDelta > 0 ? `subio ${weightDelta}kg` : weightDelta < 0 ? `bajo ${Math.abs(weightDelta)}kg` : 'estable')
                : '';
            parts.push(`Peso ${currentWeight}kg${deltaStr ? ` (${deltaStr})` : ''}`);
        }
        const recentWeeklies = chartWeeklyData.slice(-4);
        const adherenceValues = recentWeeklies.filter(w => w.nutriAdherencia).map(w => w.nutriAdherencia);
        if (adherenceValues.length > 0) {
            const avg = Math.round(adherenceValues.reduce((s, v) => s + v, 0) / adherenceValues.length * 10);
            parts.push(`Adherencia ${avg}%`);
        }
        if (avgMood) {
            parts.push(`Animo ${MOOD_EMOJIS[Math.round(avgMood)]} ${avgMood}`);
        }
        return parts.join(' · ') || 'Sin datos suficientes';
    }, [currentWeight, weightDelta, chartWeeklyData, avgMood]);

    // Adherence average for KPI
    const adherenceAvg = useMemo(() => {
        const recentWeeklies = chartWeeklyData.slice(-4);
        const vals = recentWeeklies.filter(w => w.nutriAdherencia).map(w => w.nutriAdherencia);
        if (vals.length === 0) return null;
        return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10);
    }, [chartWeeklyData]);

    // Check-in streak (consecutive days)
    const checkinStreak = useMemo(() => {
        const last7 = sortedDailyData.filter(d => {
            const daysDiff = (new Date() - new Date(d.date)) / (1000 * 60 * 60 * 24);
            return daysDiff <= 7;
        });
        return last7.length;
    }, [sortedDailyData]);

    // ─────────────────────────────────────────────────────────────────────────
    // 📊 SEGUIMIENTO 2.0: ALERTS
    // ─────────────────────────────────────────────────────────────────────────

    const alerts = useMemo(() => {
        const result = [];
        const objetivo = clientInfo?.info_user?.objetivoPrincipal;

        // a) Weight spike/drop
        if (weightDelta !== null) {
            const pctChange = currentWeight ? Math.abs(weightDelta / currentWeight * 100) : 0;
            if (weightDelta > 0 && pctChange > 1 && objetivo !== 'volumen') {
                result.push({ type: 'weight_spike', severity: 'warning', text: `Peso ↑${pctChange.toFixed(1)}% esta semana`, icon: 'scale-outline' });
            }
            if (weightDelta < 0 && pctChange > 1.5 && objetivo !== 'definicion' && objetivo !== 'perdida') {
                result.push({ type: 'weight_drop', severity: 'warning', text: `Peso ↓${pctChange.toFixed(1)}% esta semana`, icon: 'scale-outline' });
            }
        }

        // b) Inactive client
        if (sortedDailyData.length > 0) {
            const lastDate = new Date(sortedDailyData[sortedDailyData.length - 1].date);
            const daysSince = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
            if (daysSince > 5) {
                result.push({ type: 'inactive', severity: 'critical', text: `${daysSince}d sin check-in`, icon: 'alert-circle-outline' });
            } else if (daysSince > 3) {
                result.push({ type: 'inactive', severity: 'warning', text: `${daysSince}d sin check-in`, icon: 'time-outline' });
            }
        } else {
            result.push({ type: 'inactive', severity: 'critical', text: 'Sin check-ins', icon: 'alert-circle-outline' });
        }

        // c) Low mood sustained
        const last14Days = sortedDailyData.filter(d => {
            return (new Date() - new Date(d.date)) / (1000 * 60 * 60 * 24) <= 14 && d.animo;
        });
        if (last14Days.length >= 5) {
            const avgMood14 = last14Days.reduce((s, d) => s + d.animo, 0) / last14Days.length;
            if (avgMood14 < 3) {
                result.push({ type: 'mood_low', severity: 'warning', text: 'Animo bajo sostenido', icon: 'sad-outline' });
            }
        }

        // d) High fatigue
        if (weeklyRecords.length > 0) {
            const lastWeekly = weeklyRecords[0]; // most recent (sorted desc)
            if (lastWeekly.entrenoFatiga >= 4) {
                result.push({ type: 'high_fatigue', severity: 'warning', text: `Fatiga alta (${lastWeekly.entrenoFatiga}/5)`, icon: 'battery-dead-outline' });
            }
            if (lastWeekly.entrenoMolestias) {
                result.push({ type: 'molestias', severity: 'critical', text: `Molestias: ${lastWeekly.entrenoMolestiasTexto || 'Si'}`, icon: 'medkit-outline' });
            }
        }

        // Sort: critical first, then warning. Max 3.
        result.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));
        return result;
    }, [sortedDailyData, weeklyRecords, weightDelta, currentWeight, clientInfo?.info_user?.objetivoPrincipal]);

    // ─────────────────────────────────────────────────────────────────────────
    // 📊 SEGUIMIENTO 2.0: BODY MEASUREMENTS
    // ─────────────────────────────────────────────────────────────────────────

    const BODY_ZONES = [
        { key: 'medCuello', label: 'Cuello', svgPos: { cx: 80, cy: 60 } },
        { key: 'medHombros', label: 'Hombros', svgPos: { cx: 80, cy: 78 } },
        { key: 'medPecho', label: 'Pecho', svgPos: { cx: 80, cy: 105 } },
        { key: 'medBrazo', label: 'Brazo', svgPos: { cx: 22, cy: 115 } },
        { key: 'medCintura', label: 'Cintura', svgPos: { cx: 80, cy: 148 } },
        { key: 'medCadera', label: 'Cadera', svgPos: { cx: 80, cy: 178 } },
        { key: 'medPierna', label: 'Pierna', svgPos: { cx: 56, cy: 245 } },
        { key: 'medGemelo', label: 'Gemelo', svgPos: { cx: 56, cy: 300 } },
    ];

    const bodyMeasurements = useMemo(() => {
        const sortedWeekly = [...chartWeeklyData].sort((a, b) => new Date(a.weekStartDate) - new Date(b.weekStartDate));
        const objetivo = clientInfo?.info_user?.objetivoPrincipal;

        const zones = BODY_ZONES.map(zone => {
            const values = sortedWeekly
                .filter(w => w[zone.key] != null && w[zone.key] > 0)
                .map(w => ({ value: w[zone.key], date: w.weekStartDate }));

            if (values.length === 0) return null;

            const current = values[values.length - 1].value;
            // Cambio neto: primer valor del rango vs último (no últimos 2)
            const first = values.length >= 2 ? values[0].value : null;
            const delta = first != null ? Math.round((current - first) * 10) / 10 : null;

            // Determine trend
            let trend = 'stable';
            if (delta !== null) {
                if (delta > 0.3) trend = 'up';
                else if (delta < -0.3) trend = 'down';
            }

            // Determine color based on objective
            let trendColor = '#3b82f6'; // default blue
            const isWaistHip = zone.key === 'medCintura' || zone.key === 'medCadera';
            const isMuscle = ['medPecho', 'medBrazo', 'medHombros', 'medPierna'].includes(zone.key);

            if (objetivo === 'definicion' || objetivo === 'perdida') {
                if (isWaistHip) trendColor = trend === 'down' ? '#10b981' : trend === 'up' ? '#ef4444' : '#94a3b8';
                else if (isMuscle) trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#f59e0b' : '#94a3b8';
            } else if (objetivo === 'volumen') {
                if (isMuscle) trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#94a3b8';
                else if (isWaistHip) trendColor = trend === 'up' ? '#f59e0b' : '#94a3b8';
            } else {
                trendColor = trend === 'stable' ? '#94a3b8' : '#3b82f6';
            }

            return {
                ...zone,
                current,
                previous: first,
                delta,
                trend,
                trendColor,
                sparklineData: values.slice(-8).map(v => v.value),
                history: values,
            };
        }).filter(Boolean);

        return zones.length > 0 ? zones : null;
    }, [chartWeeklyData, clientInfo?.info_user?.objetivoPrincipal]);

    // ─────────────────────────────────────────────────────────────────────────
    // 📂 AGRUPAR REGISTROS POR MES (mes actual suelto, anteriores colapsados)
    // ─────────────────────────────────────────────────────────────────────────
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const groupRecordsByMonth = (records, dateField = 'date') => {
        const currentMonthRecords = [];
        const historicalGroups = {};

        records.forEach(record => {
            const recordDate = new Date(dateField === 'weekStartDate' ? record.weekStartDate : record.date);
            const year = recordDate.getFullYear();
            const month = recordDate.getMonth();

            if (year === currentYear && month === currentMonth) {
                currentMonthRecords.push(record);
            } else {
                const key = `${year}-${String(month + 1).padStart(2, '0')}`;
                if (!historicalGroups[key]) {
                    historicalGroups[key] = {
                        key,
                        year,
                        month,
                        label: recordDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
                        records: [],
                    };
                }
                historicalGroups[key].records.push(record);
            }
        });

        // Ordenar grupos por fecha descendente
        const sortedGroups = Object.values(historicalGroups).sort((a, b) => {
            if (b.year !== a.year) return b.year - a.year;
            return b.month - a.month;
        });

        return { currentMonthRecords, historicalGroups: sortedGroups };
    };

    const groupedDailyRecords = useMemo(() => {
        return groupRecordsByMonth(dailyRecords, 'date');
    }, [dailyRecords, currentYear, currentMonth]);

    const groupedWeeklyRecords = useMemo(() => {
        return groupRecordsByMonth(weeklyRecords, 'weekStartDate');
    }, [weeklyRecords, currentYear, currentMonth]);

    const toggleMonth = (key) => {
        setExpandedMonths(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 📊 MONTHLY SUMMARY STATS (for Este mes RESUMEN card)
    // ─────────────────────────────────────────────────────────────────────────
    const monthlySummary = useMemo(() => {
        const currentRecords = groupedDailyRecords.currentMonthRecords;
        if (currentRecords.length === 0) return null;

        // Get last 7 days of data for sparklines
        const last7 = currentRecords.slice(0, 7);

        // Average weight
        const weightRecords = currentRecords.filter(r => r.peso && r.peso > 0);
        const avgWeight = weightRecords.length > 0
            ? (weightRecords.reduce((sum, r) => sum + r.peso, 0) / weightRecords.length).toFixed(1)
            : null;
        const weightData = last7.map(r => r.peso || 0).reverse();

        // Average steps
        const stepsRecords = currentRecords.filter(r => r.pasos && r.pasos > 0);
        const avgSteps = stepsRecords.length > 0
            ? Math.round(stepsRecords.reduce((sum, r) => sum + r.pasos, 0) / stepsRecords.length)
            : null;
        const stepsData = last7.map(r => r.pasos || 0).reverse();

        // Adherence (based on haIdoBien responses)
        const adherenceRecords = currentRecords.filter(r => r.haIdoBien);
        const goodCount = adherenceRecords.filter(r => r.haIdoBien === 'si').length;
        const adherencePercent = adherenceRecords.length > 0
            ? Math.round((goodCount / adherenceRecords.length) * 100)
            : null;
        const adherenceData = last7.map(r => {
            if (r.haIdoBien === 'si') return 100;
            if (r.haIdoBien === 'medio') return 50;
            if (r.haIdoBien === 'no') return 20;
            return 0;
        }).reverse();

        return { avgWeight, weightData, avgSteps, stepsData, adherencePercent, adherenceData };
    }, [groupedDailyRecords.currentMonthRecords]);

    // Render monthly summary card
    const renderMonthlySummary = () => {
        if (!monthlySummary) return null;

        return (
            <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                    <Ionicons name="calendar" size={16} color="#0ea5e9" />
                    <Text style={styles.summaryTitle}>Este mes</Text>
                    <View style={styles.summaryBadge}>
                        <Text style={styles.summaryBadgeText}>RESUMEN</Text>
                    </View>
                </View>
                <View style={styles.summaryGrid}>
                    {/* Average Weight */}
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>PESO PROMEDIO</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                            <Text style={styles.summaryValue}>
                                {monthlySummary.avgWeight || '--'}
                                <Text style={styles.summaryUnit}> KG</Text>
                            </Text>
                            <Sparkline data={monthlySummary.weightData} color="#3b82f6" height={28} />
                        </View>
                    </View>

                    {/* Average Steps */}
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>PASOS DIARIOS</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                            <Text style={styles.summaryValue}>
                                {monthlySummary.avgSteps ? `${(monthlySummary.avgSteps / 1000).toFixed(1)}k` : '--'}
                            </Text>
                            <Sparkline data={monthlySummary.stepsData} color="#10b981" height={28} />
                        </View>
                    </View>

                    {/* Adherence */}
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>ADHERENCIA</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                            <Text style={styles.summaryValue}>
                                {monthlySummary.adherencePercent ?? '--'}
                                <Text style={styles.summaryUnit}>%</Text>
                            </Text>
                            <Sparkline data={monthlySummary.adherenceData} color="#8b5cf6" height={28} />
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER DAILY RECORD - NEW COMPACT ROW DESIGN
    // ─────────────────────────────────────────────────────────────────────────
    const renderDailyRecord = (record) => {
        const isExpanded = expandedRowId === record._id;
        const status = getStatusBadge(record);
        const recordDate = new Date(record.date);
        const dayNum = recordDate.getDate();
        const monthName = recordDate.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();

        return (
            <View key={record._id} style={styles.compactCard}>
                {/* Compact Row - Always visible */}
                <TouchableOpacity
                    style={styles.compactRow}
                    onPress={() => toggleRowExpansion(record._id)}
                    activeOpacity={0.7}
                >
                    {/* Status indicator line */}
                    <View style={[styles.statusLine, { backgroundColor: status.color }]} />

                    {/* Date + Weight */}
                    <View style={styles.dateWeightCol}>
                        <Text style={styles.dateSmall}>{dayNum} {monthName}</Text>
                        <Text style={styles.weightBig}>{record.peso || '--'}kg</Text>
                    </View>

                    {/* Steps */}
                    <View style={styles.metricCol}>
                        <Ionicons name="footsteps" size={14} color="#64748b" />
                        <Text style={styles.metricValue}>
                            {record.pasos ? `${(record.pasos / 1000).toFixed(1)}k` : '--'}
                        </Text>
                    </View>

                    {/* Sleep */}
                    <View style={styles.metricCol}>
                        <Ionicons name="moon" size={14} color="#64748b" />
                        <Text style={styles.metricValue}>{record.sueno ? `${record.sueno}h` : '--'}</Text>
                    </View>

                    {/* Energy dots */}
                    <View style={styles.dotsCol}>
                        <Ionicons name="flash" size={12} color="#f59e0b" />
                        <DotIndicator value={record.energia || 0} maxValue={5} activeColor="#f59e0b" />
                    </View>

                    {/* Mood dots */}
                    <View style={styles.dotsCol}>
                        <Text style={{ fontSize: 12 }}>🎭</Text>
                        <DotIndicator value={record.animo || 0} maxValue={5} activeColor="#8b5cf6" />
                    </View>

                    {/* Status badge */}
                    <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                        <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                        <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                    </View>

                    {/* Notes icon */}
                    {record.nota && (
                        <TouchableOpacity style={styles.notesIconBtn}>
                            <Ionicons name="document-text" size={18} color="#8b5cf6" />
                        </TouchableOpacity>
                    )}

                    {/* Expand arrow */}
                    <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#94a3b8"
                    />
                </TouchableOpacity>

                {/* Expanded Details */}
                {isExpanded && (
                    <View style={styles.expandedSection}>
                        <View style={styles.expandedGrid}>
                            {record.hambre && (
                                <View style={styles.expandedItem}>
                                    <Ionicons name="restaurant-outline" size={16} color="#64748b" />
                                    <Text style={styles.expandedValue}>{record.hambre}/5</Text>
                                    <Text style={styles.expandedLabel}>Hambre</Text>
                                </View>
                            )}
                            {record.animo && (
                                <View style={styles.expandedItem}>
                                    <Text style={styles.moodEmoji}>{MOOD_EMOJIS[record.animo]}</Text>
                                    <Text style={styles.expandedLabel}>Ánimo</Text>
                                </View>
                            )}
                            {record.energia && (
                                <View style={styles.expandedItem}>
                                    <Ionicons name="flash" size={16} color="#f59e0b" />
                                    <Text style={styles.expandedValue}>{record.energia}/5</Text>
                                    <Text style={styles.expandedLabel}>Energía</Text>
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
                                <Text style={styles.notaLabel}>📝 Nota del cliente:</Text>
                                <Text style={styles.notaText}>{record.nota}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

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
            {(record.medCuello || record.medHombros || record.medPecho || record.medBrazo || record.medCintura || record.medCadera || record.medPierna || record.medGemelo) && (
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
                        {record.medBrazo && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medBrazo} cm</Text>
                                <Text style={styles.recordLabel}>Brazo</Text>
                            </View>
                        )}
                        {record.medCintura && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medCintura} cm</Text>
                                <Text style={styles.recordLabel}>Cintura</Text>
                            </View>
                        )}
                        {record.medCadera && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medCadera} cm</Text>
                                <Text style={styles.recordLabel}>Cadera</Text>
                            </View>
                        )}
                        {record.medPierna && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medPierna} cm</Text>
                                <Text style={styles.recordLabel}>Pierna</Text>
                            </View>
                        )}
                        {record.medGemelo && (
                            <View style={styles.recordItem}>
                                <Text style={styles.recordValue}>{record.medGemelo} cm</Text>
                                <Text style={styles.recordLabel}>Gemelo</Text>
                            </View>
                        )}
                    </View>
                </>
            )}
        </View>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 📊 SEGUIMIENTO 2.0: RENDER STATS VIEW (Rediseñado)
    // ─────────────────────────────────────────────────────────────────────────

    // Helper: get chart width based on grid context
    const getChartW = (inGrid) => inGrid && isWideScreen ? halfChartWidth : chartWidth;

    // Macro color helper
    const getMacroColor = (val) =>
        val >= 90 && val <= 105 ? '#10B981' : val >= 80 && val <= 115 ? '#F59E0B' : '#EF4444';

    const renderStatsView = () => (
        <ScrollView
            contentContainerStyle={styles.statsScrollContent}
            refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#0ea5e9']} />
            }
        >
            {/* ═══════════════════ TIER 2: TENDENCIAS CLAVE ═══════════════════ */}
            <LazySection height={250}>
            <View style={isWideScreen ? styles.tierRow : null}>
                {/* EVOLUCIÓN DEL PESO */}
                <View style={[styles.statsCard, isWideScreen && { flex: 1 }]}>
                    <View style={styles.statsCardHeader}>
                        <Text style={styles.statsCardIcon}>📊</Text>
                        <Text style={styles.statsCardTitle}>Evolucion del Peso</Text>
                        {targetWeight && (
                            <View style={[styles.avgBadge, { backgroundColor: '#10b98120' }]}>
                                <Text style={[styles.avgBadgeText, { color: '#10b981' }]}>Meta: {targetWeight}kg</Text>
                            </View>
                        )}
                    </View>
                    {weightChartData ? (
                        <ResponsiveChart fallbackWidth={getChartW(true)}>
                            {(w) => (
                                <LineChart
                                    data={downsampleChartData(weightChartData)}
                                    width={w}
                                    height={160}
                                    chartConfig={{
                                        ...chartConfig,
                                        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                                        fillShadowGradient: '#10b981',
                                        fillShadowGradientOpacity: 0.1,
                                    }}
                                    bezier
                                    withDots={Platform.OS !== 'web'}
                                    style={styles.chart}
                                    yAxisSuffix=" kg"
                                />
                            )}
                        </ResponsiveChart>
                    ) : (
                        <View style={styles.noChartData}>
                            <Ionicons name="scale-outline" size={40} color="#cbd5e1" />
                            <Text style={styles.noDataText}>Datos insuficientes de peso</Text>
                        </View>
                    )}
                </View>

                {/* ESTADO GENERAL — Ánimo + Energía multilínea */}
                <View style={[styles.statsCard, isWideScreen && { flex: 1 }]}>
                    <View style={styles.statsCardHeader}>
                        <Text style={styles.statsCardIcon}>🧠</Text>
                        <Text style={styles.statsCardTitle}>Estado General</Text>
                        {(avgMood || avgEnergy) && (
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {avgMood && (
                                    <View style={[styles.avgBadge, { backgroundColor: '#fbbf2420' }]}>
                                        <Text style={[styles.avgBadgeText, { color: '#d97706' }]}>
                                            {MOOD_EMOJIS[Math.round(avgMood)]} {avgMood}
                                        </Text>
                                    </View>
                                )}
                                {avgEnergy && (
                                    <View style={[styles.avgBadge, { backgroundColor: '#6366f120' }]}>
                                        <Text style={[styles.avgBadgeText, { color: '#6366f1' }]}>
                                            ⚡ {avgEnergy}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                    {wellbeingChartData ? (
                        <>
                            <View style={styles.legendRow}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: '#fbbf24' }]} />
                                    <Text style={styles.legendText}>Ánimo</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: '#6366f1' }]} />
                                    <Text style={styles.legendText}>Energía</Text>
                                </View>
                            </View>
                            <ResponsiveChart fallbackWidth={getChartW(true)}>
                                {(w) => (
                                    <LineChart
                                        data={downsampleChartData(wellbeingChartData)}
                                        width={w}
                                        height={160}
                                        chartConfig={{
                                            ...chartConfig,
                                            fillShadowGradientOpacity: 0,
                                        }}
                                        bezier
                                        withDots={Platform.OS !== 'web'}
                                        style={styles.chart}
                                        fromZero
                                        segments={4}
                                    />
                                )}
                            </ResponsiveChart>
                        </>
                    ) : (
                        <View style={styles.noChartData}>
                            <Ionicons name="happy-outline" size={32} color="#cbd5e1" />
                            <Text style={styles.noDataText}>Sin datos de bienestar</Text>
                        </View>
                    )}
                </View>
            </View>

            </LazySection>
            {/* ═══════════════════ TIER 3: PROFUNDIZACIÓN ═══════════════════ */}
            <LazySection height={300}>
            <View style={isWideScreen ? styles.tierRow : null}>
                {/* HORAS DE SUEÑO */}
                <View style={[styles.statsCard, isWideScreen && { flex: 1 }]}>
                    <View style={styles.statsCardHeader}>
                        <Text style={styles.statsCardIcon}>😴</Text>
                        <Text style={styles.statsCardTitle}>Horas de Sueno</Text>
                        {avgSleep && (
                            <View style={[styles.avgBadge, { backgroundColor: parseFloat(avgSleep) >= 7 ? '#10b98120' : '#f59e0b20' }]}>
                                <Text style={[styles.avgBadgeText, { color: parseFloat(avgSleep) >= 7 ? '#10b981' : '#f59e0b' }]}>
                                    ⌀ {avgSleep}h
                                </Text>
                            </View>
                        )}
                    </View>
                    {sleepChartData ? (
                        <ResponsiveChart fallbackWidth={getChartW(true)}>
                            {(w) => (
                                <BarChart
                                    data={downsampleChartData(sleepChartData)}
                                    width={w}
                                    height={200}
                                    chartConfig={barChartConfig}
                                    style={styles.chart}
                                    yAxisSuffix="h"
                                    showValuesOnTopOfBars
                                    fromZero
                                />
                            )}
                        </ResponsiveChart>
                    ) : (
                        <View style={styles.noChartData}>
                            <Ionicons name="bed-outline" size={40} color="#cbd5e1" />
                            <Text style={styles.noDataText}>Datos insuficientes de sueno</Text>
                        </View>
                    )}
                </View>

                {/* BODY MAP — MEDICIONES CORPORALES */}
                <View style={[styles.statsCard, isWideScreen && { flex: 1 }]}>
                    <View style={styles.statsCardHeader}>
                        <Text style={styles.statsCardIcon}>📐</Text>
                        <Text style={styles.statsCardTitle}>Mediciones Corporales</Text>
                    </View>
                    {bodyMeasurements ? (
                        <View style={isWideScreen ? styles.bodyMapLayout : undefined}>
                            {/* SVG Silhouette con puntos coloreados — solo desktop */}
                            {isWideScreen && (
                                <View style={styles.bodyMapSvgContainer}>
                                    <Svg width={120} height={260} viewBox="0 0 160 340">
                                        <SvgCircle cx="80" cy="28" r="20" fill="#e2e8f0" />
                                        <SvgRect x="70" y="48" width="20" height="14" fill="#e2e8f0" rx="4" />
                                        <SvgRect x="35" y="62" width="90" height="70" fill="#e2e8f0" rx="8" />
                                        <SvgRect x="12" y="68" width="24" height="60" fill="#e2e8f0" rx="8" />
                                        <SvgRect x="124" y="68" width="24" height="60" fill="#e2e8f0" rx="8" />
                                        <SvgRect x="40" y="132" width="80" height="52" fill="#e2e8f0" rx="6" />
                                        <SvgRect x="42" y="184" width="30" height="90" fill="#e2e8f0" rx="8" />
                                        <SvgRect x="88" y="184" width="30" height="90" fill="#e2e8f0" rx="8" />
                                        <SvgRect x="44" y="274" width="26" height="40" fill="#e2e8f0" rx="6" />
                                        <SvgRect x="90" y="274" width="26" height="40" fill="#e2e8f0" rx="6" />
                                        {bodyMeasurements.map(z => (
                                            <SvgCircle key={z.key} cx={z.svgPos.cx} cy={z.svgPos.cy} r={6} fill={z.trendColor} />
                                        ))}
                                    </Svg>
                                </View>
                            )}
                            {/* Lista de zonas — a la derecha en desktop */}
                            <View style={isWideScreen ? styles.bodyMapList : undefined}>
                                <View style={styles.measureSummaryList}>
                                    {bodyMeasurements.map(zone => {
                                        const isExpZone = expandedZone === zone.key;
                                        return (
                                            <View key={zone.key}>
                                                <TouchableOpacity
                                                    style={[styles.measureSummaryRow, isExpZone && { backgroundColor: '#f8fafc' }]}
                                                    onPress={() => setExpandedZone(isExpZone ? null : zone.key)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={styles.measureSummaryLabel}>{zone.label}</Text>
                                                    <Text style={styles.measureSummaryValue}>{zone.current} cm</Text>
                                                    <Text style={[styles.measureSummaryDelta, { color: zone.trendColor }]}>
                                                        {zone.delta != null
                                                            ? `${zone.delta > 0 ? '+' : ''}${zone.delta}`
                                                            : '--'}
                                                    </Text>
                                                    <View style={{ width: 50 }}>
                                                        <Sparkline data={zone.sparklineData} height={18} color={zone.trendColor} />
                                                    </View>
                                                    <Ionicons name={isExpZone ? 'chevron-up' : 'chevron-down'} size={14} color="#94a3b8" />
                                                </TouchableOpacity>
                                                {isExpZone && zone.history.length >= 2 && (
                                                    <View style={{ paddingHorizontal: 4, paddingBottom: 8 }}>
                                                        <ResponsiveChart fallbackWidth={halfChartWidth - 40}>
                                                            {(w) => <LineChart
                                                                data={{
                                                                    labels: zone.history.slice(-10).map(h => {
                                                                        const d = new Date(h.date);
                                                                        return `${d.getDate()}/${d.getMonth() + 1}`;
                                                                    }),
                                                                    datasets: [{
                                                                        data: zone.history.slice(-10).map(h => h.value),
                                                                        color: () => zone.trendColor,
                                                                        strokeWidth: 2,
                                                                    }],
                                                                }}
                                                                width={w}
                                                                height={100}
                                                                chartConfig={{
                                                                    ...chartConfig,
                                                                    color: () => zone.trendColor,
                                                                }}
                                                                bezier
                                                                withDots={Platform.OS !== 'web'}
                                                                style={styles.chart}
                                                                yAxisSuffix=" cm"
                                                            />}
                                                        </ResponsiveChart>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>
                    ) : (
                        /* Preview generico — SVG izquierda + lista derecha en desktop, grid compacto en mobile */
                        <View style={isWideScreen ? styles.bodyMapLayout : undefined}>
                            {/* SVG Silhouette preview — solo desktop, al lado izquierdo */}
                            {isWideScreen && (
                                <View style={styles.bodyMapSvgContainer}>
                                    <Svg width={120} height={260} viewBox="0 0 160 340">
                                        <SvgCircle cx="80" cy="28" r="20" fill="#e2e8f0" />
                                        <SvgRect x="70" y="48" width="20" height="14" fill="#e2e8f0" rx="4" />
                                        <SvgRect x="35" y="62" width="90" height="70" fill="#e2e8f0" rx="8" />
                                        <SvgRect x="12" y="68" width="24" height="60" fill="#e2e8f0" rx="8" />
                                        <SvgRect x="124" y="68" width="24" height="60" fill="#e2e8f0" rx="8" />
                                        <SvgRect x="40" y="132" width="80" height="52" fill="#e2e8f0" rx="6" />
                                        <SvgRect x="42" y="184" width="30" height="90" fill="#e2e8f0" rx="8" />
                                        <SvgRect x="88" y="184" width="30" height="90" fill="#e2e8f0" rx="8" />
                                        <SvgRect x="44" y="274" width="26" height="40" fill="#e2e8f0" rx="6" />
                                        <SvgRect x="90" y="274" width="26" height="40" fill="#e2e8f0" rx="6" />
                                        {BODY_ZONES.map(z => (
                                            <SvgCircle key={z.key} cx={z.svgPos.cx} cy={z.svgPos.cy} r={5} fill="#cbd5e1" />
                                        ))}
                                    </Svg>
                                </View>
                            )}
                            {/* Lista de zonas — derecha en desktop, grid compacto en mobile */}
                            <View style={isWideScreen ? styles.bodyMapList : undefined}>
                                {isWideScreen ? (
                                    <View style={styles.measureSummaryList}>
                                        {BODY_ZONES.map(zone => (
                                            <View key={zone.key} style={styles.measureSummaryRow}>
                                                <Text style={styles.measureSummaryLabel}>{zone.label}</Text>
                                                <Text style={[styles.measureSummaryValue, { color: '#cbd5e1' }]}>-- cm</Text>
                                                <Text style={[styles.measureSummaryDelta, { color: '#cbd5e1' }]}>--</Text>
                                                <View style={{ width: 50, height: 18, backgroundColor: '#f1f5f9', borderRadius: 4 }} />
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.bodyMapMobileGrid}>
                                        {BODY_ZONES.map(zone => (
                                            <View key={zone.key} style={styles.bodyMapMobileItem}>
                                                <Text style={styles.bodyMapMobileLabel}>{zone.label}</Text>
                                                <Text style={[styles.bodyMapMobileValue, { color: '#cbd5e1' }]}>-- cm</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                                <View style={{ alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                                    <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                                        El cliente puede registrar mediciones desde su check-in semanal
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}
                </View>

            </View>

            </LazySection>
            {/* ═══════════════════ CUMPLIMIENTO DE DIETA (full width, horizontal) ═══════════════════ */}
            <LazySection height={200}>
            <View style={styles.statsCard}>
                <View style={styles.statsCardHeader}>
                    <Text style={styles.statsCardIcon}>🍽️</Text>
                    <Text style={styles.statsCardTitle}>Cumplimiento de Dieta</Text>
                </View>
                {macroCompliance ? (
                    <View style={styles.macroHorizontalRow}>
                        {[
                            { emoji: '🔥', val: macroCompliance.kcal, label: 'Kcal', flex: 2 },
                            { emoji: '🥩', val: macroCompliance.protein, label: 'Proteína', flex: 1 },
                            { emoji: '🍞', val: macroCompliance.carbs, label: 'Carbos', flex: 1 },
                            { emoji: '🥑', val: macroCompliance.fat, label: 'Grasa', flex: 1 },
                        ].map((m, i) => {
                            const color = getMacroColor(m.val);
                            const pct = Math.min(m.val, 100);
                            return (
                                <View key={i} style={[styles.macroHorizontalItem, { flex: m.flex }]}>
                                    <Text style={styles.macroHorizontalEmoji}>{m.emoji}</Text>
                                    <Text style={styles.macroHorizontalLabel}>{m.label}</Text>
                                    <View style={styles.macroHorizontalTrack}>
                                        <View style={[styles.macroHorizontalFill, { height: `${pct}%`, backgroundColor: color }]} />
                                    </View>
                                    <Text style={[styles.macroHorizontalValue, { color }]}>{Math.round(m.val)}%</Text>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.noChartData}>
                        <Ionicons name="nutrition-outline" size={32} color="#cbd5e1" />
                        <Text style={styles.noDataText}>Sin datos de macros</Text>
                    </View>
                )}
            </View>

            </LazySection>
            {/* ═══════════════════ TIER 4: ANÁLISIS AVANZADO (colapsable) ═══════════════════ */}
            <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)}>
                <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={18} color="#64748b" />
                <Text style={styles.advancedToggleText}>
                    {showAdvanced ? 'Ocultar analisis avanzado' : 'Ver analisis avanzado'}
                </Text>
            </TouchableOpacity>

            {showAdvanced && (
                <View style={isWideScreen ? styles.tierRow : null}>
                    {/* HAMBRE VS ADHERENCIA */}
                    <View style={[styles.statsCard, isWideScreen && { flex: 1 }]}>
                        <View style={styles.statsCardHeader}>
                            <Text style={styles.statsCardIcon}>📈</Text>
                            <Text style={styles.statsCardTitle}>Hambre vs Adherencia</Text>
                        </View>
                        {hungerAdherenceData ? (
                            <View style={styles.correlationContainer}>
                                <View style={styles.correlationGrid}>
                                    {hungerAdherenceData.slice(-6).map((point, index) => (
                                        <View key={index} style={styles.correlationPoint}>
                                            <Text style={styles.correlationHunger}>🍽️ {point.hunger.toFixed(1)}</Text>
                                            <View style={[
                                                styles.correlationBar,
                                                {
                                                    height: point.adherence * 8,
                                                    backgroundColor: point.adherence >= 7 ? '#10b981' :
                                                        point.adherence >= 5 ? '#f59e0b' : '#ef4444'
                                                }
                                            ]} />
                                            <Text style={styles.correlationAdherence}>{point.adherence}/10</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : (
                            <View style={styles.noChartData}>
                                <Ionicons name="analytics-outline" size={40} color="#cbd5e1" />
                                <Text style={styles.noDataText}>Datos insuficientes para correlacion</Text>
                            </View>
                        )}
                    </View>

                    {/* PESO OBJETIVO */}
                    <View style={[styles.statsCard, isWideScreen && { flex: 1 }]}>
                        <View style={styles.statsCardHeader}>
                            <Text style={styles.statsCardIcon}>🎯</Text>
                            <Text style={styles.statsCardTitle}>Peso Objetivo</Text>
                        </View>
                        {targetWeight ? (
                            <View style={styles.targetContent}>
                                <Text style={styles.targetWeight}>{targetWeight} kg</Text>
                                <Text style={styles.targetSubtext}>
                                    Peso actual: <Text style={styles.targetValue}>{currentWeight || '--'} kg</Text>
                                </Text>
                                {currentWeight && targetWeight && (
                                    <Text style={[styles.targetDiff, { color: currentWeight <= targetWeight ? '#10b981' : '#f59e0b' }]}>
                                        {currentWeight > targetWeight
                                            ? `↓ ${(currentWeight - targetWeight).toFixed(1)} kg para meta`
                                            : currentWeight < targetWeight
                                                ? `↑ ${(targetWeight - currentWeight).toFixed(1)} kg para meta`
                                                : '✅ Meta alcanzada!'}
                                    </Text>
                                )}
                            </View>
                        ) : (
                            <Text style={styles.noDataText}>El cliente no tiene peso objetivo configurado</Text>
                        )}
                    </View>
                </View>
            )}

            <View style={{ height: 24 }} />
        </ScrollView>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    // 🧊 Web: unmount content when screen loses focus (prevents DOM accumulation crash)
    const isFocused = useIsFocused();
    if (Platform.OS === 'web' && !isFocused) return <View />;

    // 🛡️ Render guard: if clientId changed but data hasn't loaded yet, show loading
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.mainWrapper}>
                    {isWideScreen && (
                        <ClientSidebar
                            clients={sidebarClients}
                            isLoading={sidebarLoading}
                            currentClientId={clientId}
                            onClientSelect={handleSidebarClientSelect}
                            isCollapsed={sidebarCollapsed}
                            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                            context="seguimiento"
                        />
                    )}
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0ea5e9" />
                        <Text style={styles.loadingText}>Cargando historial...</Text>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    const records = datosSubTab === 'daily' ? dailyRecords : weeklyRecords;

    return (
        <SafeAreaView style={styles.container}>
            {/* Wrapper for sidebar + content on wide screens */}
            <View style={styles.mainWrapper}>
                {/* 🖥️ SIDEBAR: Show only on wide screens */}
                {isWideScreen && (
                    <ClientSidebar
                        clients={sidebarClients}
                        isLoading={sidebarLoading}
                        currentClientId={clientId}
                        onClientSelect={handleSidebarClientSelect}
                        isCollapsed={sidebarCollapsed}
                        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                        context="seguimiento"
                    />
                )}

                {/* Main content area */}
                <View style={styles.contentArea}>
                    {/* Header Card — info completa del cliente */}
                    <View style={[styles.headerCard, { borderLeftColor: scoreState.color }]}>
                        {/* Fila 1: Back + Avatar + Nombre + Score */}
                        <View style={styles.headerTopRow}>
                            <TouchableOpacity onPress={() => router.push('/(coach)/seguimiento_coach')} style={styles.backBtn}>
                                <Ionicons name="arrow-back" size={22} color="#1e293b" />
                            </TouchableOpacity>
                            <AvatarWithInitials
                                avatarUrl={clientInfo?.avatarUrl}
                                name={clientName || 'C'}
                                size={36}
                            />
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={styles.headerTitle}>{clientName || 'Cliente'}</Text>
                                <Text style={[styles.headerSubtitle, { color: scoreState.color }]} numberOfLines={1}>
                                    {scoreState.label}
                                </Text>
                            </View>
                            <View style={[styles.scoreBadge, { backgroundColor: scoreState.bg, borderColor: scoreState.color }]}>
                                <Text style={[styles.scoreBadgeValue, { color: scoreState.color }]}>{clientScore}</Text>
                                <Text style={styles.scoreBadgeUnit}>/100</Text>
                            </View>
                        </View>
                        {/* Resumen */}
                        {summaryPhrase ? (
                            <Text style={styles.headerSummary} numberOfLines={2}>{summaryPhrase}</Text>
                        ) : null}
                        {/* Alertas */}
                        {alerts.length > 0 && (
                            <View style={styles.alertChipsRow}>
                                {alerts.slice(0, 3).map((alert, i) => (
                                    <View key={i} style={[
                                        styles.alertChip,
                                        alert.severity === 'critical' ? styles.alertChipCritical : styles.alertChipWarning,
                                    ]}>
                                        <Ionicons name={alert.icon} size={10}
                                            color={alert.severity === 'critical' ? '#ef4444' : '#f59e0b'} />
                                        <Text style={[
                                            styles.alertChipText,
                                            { color: alert.severity === 'critical' ? '#ef4444' : '#f59e0b' },
                                        ]}>{alert.text}</Text>
                                    </View>
                                ))}
                                {alerts.length > 3 && (
                                    <Text style={{ fontSize: 10, color: '#94a3b8' }}>+{alerts.length - 3}</Text>
                                )}
                            </View>
                        )}
                        {/* KPIs */}
                        <View style={styles.headerKpiRow}>
                            <View style={styles.headerKpiItem}>
                                <Text style={styles.headerKpiValue}>{currentWeight || '--'}<Text style={styles.headerKpiUnit}> kg</Text></Text>
                                {weightDelta != null && (
                                    <Text style={[styles.headerKpiDelta, { color: weightDelta <= 0 ? '#10b981' : '#f59e0b' }]}>
                                        {weightDelta > 0 ? '↑' : weightDelta < 0 ? '↓' : '='}{Math.abs(weightDelta)}
                                    </Text>
                                )}
                            </View>
                            <View style={styles.headerKpiItem}>
                                <Text style={styles.headerKpiValue}>{adherenceAvg != null ? `${adherenceAvg}%` : '--'}</Text>
                                <Text style={styles.headerKpiLabel}>Adher.</Text>
                            </View>
                            <View style={styles.headerKpiItem}>
                                <Text style={styles.headerKpiValue}>{checkinStreak}<Text style={styles.headerKpiUnit}>/7</Text></Text>
                                <Text style={styles.headerKpiLabel}>Check-in</Text>
                            </View>
                        </View>
                    </View>

                    {/* 📊 MAIN TAB SELECTOR: GRÁFICOS | DATOS | GALERÍA */}
                    <View style={styles.viewModeRow}>
                        <TouchableOpacity
                            style={[styles.viewModeBtn, mainTab === 'graficos' && styles.viewModeBtnActive]}
                            onPress={() => setMainTab('graficos')}
                            activeOpacity={0.7}
                        >
                            <View style={styles.viewModeBtnInner}>
                                <Ionicons
                                    name="stats-chart"
                                    size={15}
                                    color={mainTab === 'graficos' ? '#fff' : '#64748b'}
                                />
                                <Text style={[styles.viewModeText, mainTab === 'graficos' && styles.viewModeTextActive]}>
                                    Gráficos
                                </Text>
                            </View>
                            {/* Time Range DENTRO del botón */}
                            {mainTab === 'graficos' && (
                                <View style={styles.timeRangeInside}>
                                    {[
                                        { key: '7d', label: '7D' },
                                        { key: '30d', label: '30D' },
                                        { key: '3m', label: '3M' },
                                        { key: '6m', label: '6M' },
                                        { key: 'all', label: 'All' },
                                    ].map(opt => (
                                        <TouchableOpacity
                                            key={opt.key}
                                            style={[styles.timeRangeBtn, timeRange === opt.key && styles.timeRangeBtnActive]}
                                            onPress={(e) => { e.stopPropagation(); setTimeRange(opt.key); }}
                                        >
                                            <Text style={[styles.timeRangeText, timeRange === opt.key && styles.timeRangeTextActive]}>
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.viewModeBtn, mainTab === 'datos' && styles.viewModeBtnActive]}
                            onPress={() => setMainTab('datos')}
                        >
                            <View style={styles.viewModeBtnInner}>
                                <Ionicons
                                    name="list"
                                    size={15}
                                    color={mainTab === 'datos' ? '#fff' : '#64748b'}
                                />
                                <Text style={[styles.viewModeText, mainTab === 'datos' && styles.viewModeTextActive]}>
                                    Datos
                                </Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.viewModeBtn, mainTab === 'galeria' && styles.viewModeBtnActive]}
                            onPress={() => setMainTab('galeria')}
                        >
                            <View style={styles.viewModeBtnInner}>
                                <Ionicons
                                    name="images"
                                    size={15}
                                    color={mainTab === 'galeria' ? '#fff' : '#64748b'}
                                />
                                <Text style={[styles.viewModeText, mainTab === 'galeria' && styles.viewModeTextActive]}>
                                    Galería
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* ═══════════ CONTENIDO POR TAB ═══════════ */}

                    {/* TAB GRÁFICOS (default) */}
                    {mainTab === 'graficos' && renderStatsView()}

                    {/* TAB DATOS */}
                    {mainTab === 'datos' && (
                        <>
                            {/* Sub-tabs Diario/Semanal */}
                            <View style={styles.tabsRow}>
                                <TouchableOpacity
                                    style={[styles.tab, datosSubTab === 'daily' && styles.tabActive]}
                                    onPress={() => setDatosSubTab('daily')}
                                >
                                    <Ionicons
                                        name="calendar"
                                        size={18}
                                        color={datosSubTab === 'daily' ? '#0ea5e9' : '#64748b'}
                                    />
                                    <Text style={[styles.tabText, datosSubTab === 'daily' && styles.tabTextActive]}>
                                        Diario ({dailyRecords.length})
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tab, datosSubTab === 'weekly' && styles.tabActive]}
                                    onPress={() => setDatosSubTab('weekly')}
                                >
                                    <Ionicons
                                        name="calendar-outline"
                                        size={18}
                                        color={datosSubTab === 'weekly' ? '#0ea5e9' : '#64748b'}
                                    />
                                    <Text style={[styles.tabText, datosSubTab === 'weekly' && styles.tabTextActive]}>
                                        Semanal ({weeklyRecords.length})
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Content - Daily/Weekly */}
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
                                            {datosSubTab === 'daily'
                                                ? 'Este cliente aún no ha registrado check-ins diarios.'
                                                : 'Este cliente aún no ha registrado check-ins semanales.'}
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        {datosSubTab === 'daily' ? (
                                            <>
                                                {renderMonthlySummary()}

                                                {groupedDailyRecords.currentMonthRecords.length > 0 && (
                                                    <View style={styles.monthSection}>
                                                        <View style={styles.monthHeaderCurrent}>
                                                            <Text style={styles.monthLabel}>📅 Este mes</Text>
                                                            <Text style={styles.monthCount}>
                                                                {groupedDailyRecords.currentMonthRecords.length} registros
                                                            </Text>
                                                        </View>
                                                        {groupedDailyRecords.currentMonthRecords.map(renderDailyRecord)}
                                                    </View>
                                                )}
                                                {groupedDailyRecords.historicalGroups.map((group) => (
                                                    <View key={`daily-${group.key}`} style={styles.monthSectionCollapsible}>
                                                        <TouchableOpacity
                                                            style={styles.monthHeaderCollapsible}
                                                            onPress={() => toggleMonth(`daily-${group.key}`)}
                                                        >
                                                            <Ionicons
                                                                name={expandedMonths[`daily-${group.key}`] ? 'chevron-down' : 'chevron-forward'}
                                                                size={18}
                                                                color="#64748b"
                                                            />
                                                            <Text style={styles.monthLabelCollapsible}>
                                                                📁 {group.label}
                                                            </Text>
                                                            <Text style={styles.monthCount}>{group.records.length}</Text>
                                                        </TouchableOpacity>
                                                        {expandedMonths[`daily-${group.key}`] && (
                                                            <View style={styles.monthRecords}>
                                                                {group.records.map(renderDailyRecord)}
                                                            </View>
                                                        )}
                                                    </View>
                                                ))}
                                            </>
                                        ) : (
                                            <>
                                                {groupedWeeklyRecords.currentMonthRecords.length > 0 && (
                                                    <View style={styles.monthSection}>
                                                        <View style={styles.monthHeaderCurrent}>
                                                            <Text style={styles.monthLabel}>📅 Este mes</Text>
                                                            <Text style={styles.monthCount}>
                                                                {groupedWeeklyRecords.currentMonthRecords.length} registros
                                                            </Text>
                                                        </View>
                                                        {groupedWeeklyRecords.currentMonthRecords.map(renderWeeklyRecord)}
                                                    </View>
                                                )}
                                                {groupedWeeklyRecords.historicalGroups.map((group) => (
                                                    <View key={`weekly-${group.key}`} style={styles.monthSectionCollapsible}>
                                                        <TouchableOpacity
                                                            style={styles.monthHeaderCollapsible}
                                                            onPress={() => toggleMonth(`weekly-${group.key}`)}
                                                        >
                                                            <Ionicons
                                                                name={expandedMonths[`weekly-${group.key}`] ? 'chevron-down' : 'chevron-forward'}
                                                                size={18}
                                                                color="#64748b"
                                                            />
                                                            <Text style={styles.monthLabelCollapsible}>
                                                                📁 {group.label}
                                                            </Text>
                                                            <Text style={styles.monthCount}>{group.records.length}</Text>
                                                        </TouchableOpacity>
                                                        {expandedMonths[`weekly-${group.key}`] && (
                                                            <View style={styles.monthRecords}>
                                                                {group.records.map(renderWeeklyRecord)}
                                                            </View>
                                                        )}
                                                    </View>
                                                ))}
                                            </>
                                        )}
                                    </>
                                )}
                            </ScrollView>
                        </>
                    )}

                    {/* TAB GALERÍA */}
                    {mainTab === 'galeria' && (
                        <>
                            {/* Sub-tabs Corporal/Nutrición */}
                            <View style={styles.tabsRow}>
                                <TouchableOpacity
                                    style={[styles.tab, galeriaSubTab === 'corporal' && styles.tabActive]}
                                    onPress={() => setGaleriaSubTab('corporal')}
                                >
                                    <Ionicons
                                        name="body"
                                        size={18}
                                        color={galeriaSubTab === 'corporal' ? '#0ea5e9' : '#64748b'}
                                    />
                                    <Text style={[styles.tabText, galeriaSubTab === 'corporal' && styles.tabTextActive]}>
                                        Corporal
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tab, galeriaSubTab === 'nutricion' && styles.tabActive]}
                                    onPress={() => setGaleriaSubTab('nutricion')}
                                >
                                    <Ionicons
                                        name="restaurant"
                                        size={18}
                                        color={galeriaSubTab === 'nutricion' ? '#0ea5e9' : '#64748b'}
                                    />
                                    <Text style={[styles.tabText, galeriaSubTab === 'nutricion' && styles.tabTextActive]}>
                                        Nutrición
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Galería Corporal */}
                            {galeriaSubTab === 'corporal' && (
                                <View style={{ flex: 1 }}>
                                    <PhotoGalleryTab
                                        clientId={clientId}
                                        token={token}
                                        onPhotoPress={({ photos, initialIndex, selectedPhoto: photo }) => {
                                            setPhotoGroup(photos || [photo]);
                                            setPhotoIndex(initialIndex || 0);
                                            setSelectedPhoto(photo);
                                            setStudioVisible(true);
                                        }}
                                    />
                                </View>
                            )}

                            {/* Galería Nutrición */}
                            {galeriaSubTab === 'nutricion' && (
                                <NutritionGalleryTab
                                    clientId={clientId}
                                    token={token}
                                />
                            )}
                        </>
                    )}

                    {/* Coach Studio Modal */}
                    <CoachStudioModal
                        visible={studioVisible}
                        onClose={() => {
                            setStudioVisible(false);
                            setSelectedPhoto(null);
                            setPhotoGroup([]);
                            setPhotoIndex(0);
                        }}
                        photo={selectedPhoto}
                        photos={photoGroup}
                        initialIndex={photoIndex}
                        onIndexChange={(idx) => {
                            setPhotoIndex(idx);
                            setSelectedPhoto(photoGroup[idx]);
                        }}
                        token={token}
                        clientId={clientId}
                    />
                </View>
            </View>
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
    // 🖥️ SIDEBAR LAYOUT
    mainWrapper: {
        flex: 1,
        flexDirection: 'row',
    },
    contentArea: {
        flex: 1,
    },
    headerCard: {
        backgroundColor: '#fff',
        marginHorizontal: 8,
        marginTop: 8,
        borderRadius: 14,
        padding: 12,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    headerSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 1,
    },
    headerSummary: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 6,
        lineHeight: 16,
        marginLeft: 30,
    },
    scoreBadge: {
        flexDirection: 'row',
        alignItems: 'baseline',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    scoreBadgeValue: {
        fontSize: 18,
        fontWeight: '800',
    },
    scoreBadgeUnit: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '600',
    },
    headerKpiRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 8,
    },
    headerKpiItem: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        paddingVertical: 4,
        paddingHorizontal: 6,
        alignItems: 'center',
    },
    headerKpiValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    headerKpiUnit: {
        fontSize: 10,
        color: '#94a3b8',
    },
    headerKpiDelta: {
        fontSize: 10,
        fontWeight: '600',
    },
    headerKpiLabel: {
        fontSize: 9,
        color: '#94a3b8',
        fontWeight: '500',
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

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW MODE SELECTOR
    // ═══════════════════════════════════════════════════════════════════════════
    viewModeRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
        alignItems: 'stretch',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    viewModeBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        gap: 4,
    },
    viewModeBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    viewModeBtnActive: {
        backgroundColor: '#0ea5e9',
    },
    viewModeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    viewModeTextActive: {
        color: '#fff',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // STATS VIEW
    // ═══════════════════════════════════════════════════════════════════════════
    statsScrollContent: {
        padding: 12,
        gap: 10,
    },
    statsCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    statsCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    statsCardIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    statsCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
    },

    // Target Weight
    targetContent: {
        alignItems: 'center',
    },
    targetWeight: {
        fontSize: 40,
        fontWeight: '800',
        color: '#0ea5e9',
    },
    targetSubtext: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 8,
    },
    targetValue: {
        fontWeight: '600',
        color: '#1e293b',
    },
    targetDiff: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 6,
    },
    noDataText: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        paddingVertical: 16,
    },
    noChartData: {
        alignItems: 'center',
        paddingVertical: 16,
    },

    // Charts
    chart: {
        marginLeft: -16,
        marginRight: -8,
    },
    avgBadge: {
        backgroundColor: '#fbbf2420',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    avgBadgeText: {
        color: '#fbbf24',
        fontSize: 12,
        fontWeight: '600',
    },

    // Macro Grid
    macroBarList: {
        gap: 10,
    },
    macroBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    macroBarEmoji: {
        fontSize: 14,
        width: 20,
        textAlign: 'center',
    },
    macroBarLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        width: 58,
    },
    macroBarTrack: {
        flex: 1,
        height: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 4,
        overflow: 'hidden',
    },
    macroBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    macroBarValue: {
        fontSize: 12,
        fontWeight: '700',
        width: 36,
        textAlign: 'right',
    },

    // Macros horizontal (full width card)
    macroHorizontalRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        paddingTop: 4,
    },
    macroHorizontalItem: {
        alignItems: 'center',
        gap: 4,
    },
    macroHorizontalEmoji: {
        fontSize: 16,
    },
    macroHorizontalLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
    },
    macroHorizontalTrack: {
        width: '100%',
        height: 50,
        backgroundColor: '#f1f5f9',
        borderRadius: 6,
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    macroHorizontalFill: {
        width: '100%',
        borderRadius: 6,
    },
    macroHorizontalValue: {
        fontSize: 13,
        fontWeight: '800',
    },

    // Correlation Chart
    correlationContainer: {
        paddingVertical: 8,
    },
    correlationGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        height: 100,
        marginBottom: 8,
    },
    correlationPoint: {
        alignItems: 'center',
    },
    correlationHunger: {
        color: '#64748b',
        fontSize: 10,
        marginBottom: 4,
    },
    correlationBar: {
        width: 24,
        borderRadius: 4,
        minHeight: 8,
    },
    correlationAdherence: {
        color: '#1e293b',
        fontSize: 10,
        marginTop: 4,
        fontWeight: '600',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // MONTH GROUPING (Historical records collapsed by month)
    // ═══════════════════════════════════════════════════════════════════════════
    monthSection: {
        marginBottom: 8,
    },
    monthHeaderCurrent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#0ea5e910',
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#0ea5e9',
    },
    monthLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0ea5e9',
    },
    monthCount: {
        fontSize: 12,
        color: '#64748b',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    monthHeaderCollapsible: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 14,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 8,
    },
    monthLabelCollapsible: {
        fontSize: 15,
        fontWeight: '600',
        color: '#475569',
        flex: 1,
    },
    monthRecords: {
        marginTop: 12,
        paddingLeft: 4,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPACT ROW DESIGN (New accordion-style daily records)
    // ═══════════════════════════════════════════════════════════════════════════
    compactCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    compactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 8,
    },
    statusLine: {
        width: 4,
        height: 40,
        borderRadius: 2,
        marginRight: 4,
    },
    dateWeightCol: {
        minWidth: 65,
    },
    dateSmall: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '500',
    },
    weightBig: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    metricCol: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minWidth: 50,
    },
    metricValue: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    dotsCol: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    notesIconBtn: {
        padding: 4,
    },
    expandedSection: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fafafa',
    },
    expandedGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 8,
    },
    expandedItem: {
        alignItems: 'center',
        minWidth: 60,
    },
    expandedValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 4,
    },
    expandedLabel: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 2,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // MONTHLY SUMMARY CARD
    // ═══════════════════════════════════════════════════════════════════════════
    summaryCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    summaryBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    summaryBadgeText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
    },
    summaryGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    summaryItem: {
        alignItems: 'center',
        flex: 1,
    },
    summaryLabel: {
        fontSize: 10,
        color: '#94a3b8',
        marginBottom: 4,
        fontWeight: '500',
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b',
    },
    summaryUnit: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // WEEK HEADER
    // ═══════════════════════════════════════════════════════════════════════════
    weekHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        marginTop: 8,
        marginBottom: 4,
    },
    weekTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: 0.5,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // SEGUIMIENTO 2.0 STYLES
    // ═══════════════════════════════════════════════════════════════════════════

    // Alert chips (header)
    alertChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
        marginLeft: 30,
    },

    // Time Range Selector — dentro del botón Gráficos
    timeRangeInside: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 5,
        padding: 1,
        marginTop: 2,
    },
    timeRangeBtn: {
        paddingVertical: 2,
        paddingHorizontal: 5,
        alignItems: 'center',
        borderRadius: 4,
    },
    timeRangeBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.35)',
    },
    timeRangeText: {
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.6)',
    },
    timeRangeTextActive: {
        color: '#fff',
    },

    // Grid layouts
    tierRow: {
        flexDirection: 'row',
        gap: 10,
    },
    tierWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    tierHalfCard: {
        width: '49%',
    },

    // Sub chart labels
    subChartLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
        marginLeft: 4,
    },
    legendRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 4,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
    },

    // Alert chips
    alertChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    alertChipCritical: {
        backgroundColor: '#fef2f2',
    },
    alertChipWarning: {
        backgroundColor: '#fffbeb',
    },
    alertChipText: {
        fontSize: 10,
        fontWeight: '600',
    },

    // Advanced toggle
    advancedToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        marginTop: 4,
        marginBottom: 4,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        gap: 6,
    },
    advancedToggleText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },

    // Body Map
    bodyMapLayout: {
        flexDirection: 'row',
        gap: 12,
    },
    bodyMapSvgContainer: {
        width: '35%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    measureSummaryList: {
        gap: 2,
    },
    measureSummaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 8,
    },
    measureSummaryLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
        width: 70,
    },
    measureSummaryValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
        width: 55,
    },
    measureSummaryDelta: {
        fontSize: 12,
        fontWeight: '600',
        width: 40,
        textAlign: 'center',
    },
    emptyMediciones: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 6,
    },
    emptyMedicionesText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    emptyMedicionesHint: {
        fontSize: 11,
        color: '#94a3b8',
        textAlign: 'center',
    },
    bodyMapList: {
        flex: 1,
    },
    bodyMapRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 8,
    },
    bodyMapRowActive: {
        backgroundColor: '#f0f9ff',
        borderRadius: 8,
    },
    bodyMapZoneLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
        width: 65,
    },
    bodyMapValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        width: 60,
    },
    bodyMapDelta: {
        fontSize: 12,
        fontWeight: '600',
    },
    bodyMapSparkline: {
        flex: 1,
        alignItems: 'flex-end',
    },
    bodyMapMobileGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    bodyMapMobileItem: {
        width: '48%',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 12,
    },
    bodyMapMobileLabel: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    bodyMapMobileValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    expandedZoneChart: {
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        marginTop: 4,
    },
});

