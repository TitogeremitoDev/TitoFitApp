/**
 * FeedbackHistoryModal.jsx - Historial de Feedbacks del Cliente
 * Vista tipo "mailbox" con carpetas año/mes
 * Usado desde seguimiento/index.jsx por clientes y entrenadores-clientes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackReportView from './FeedbackReportView';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// ═══════════════════════════════════════════════════════════════════════════
// FOLDER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const FolderItem = ({ year, months, expandedMonths, toggleMonth, onSelectReport }) => {
    const [yearExpanded, setYearExpanded] = useState(true);
    const totalReports = Object.values(months).reduce((sum, m) => sum + m.reports.length, 0);

    return (
        <View style={styles.folderContainer}>
            {/* Year Header */}
            <TouchableOpacity
                style={styles.yearHeader}
                onPress={() => setYearExpanded(!yearExpanded)}
            >
                <Ionicons
                    name={yearExpanded ? 'folder-open' : 'folder'}
                    size={24}
                    color="#f59e0b"
                />
                <Text style={styles.yearText}>{year}</Text>
                <View style={styles.countBadge}>
                    <Text style={styles.countText}>{totalReports}</Text>
                </View>
                <Ionicons
                    name={yearExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#94a3b8"
                />
            </TouchableOpacity>

            {/* Months */}
            {yearExpanded && Object.entries(months)
                .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Newest first
                .map(([monthNum, monthData]) => (
                    <View key={monthNum} style={styles.monthContainer}>
                        <TouchableOpacity
                            style={styles.monthHeader}
                            onPress={() => toggleMonth(`${year}-${monthNum}`)}
                        >
                            <Ionicons
                                name="calendar"
                                size={18}
                                color="#8b5cf6"
                            />
                            <Text style={styles.monthText}>{monthData.name}</Text>
                            <View style={[styles.countBadge, { backgroundColor: '#8b5cf620' }]}>
                                <Text style={[styles.countText, { color: '#8b5cf6' }]}>
                                    {monthData.reports.length}
                                </Text>
                            </View>
                            <Ionicons
                                name={expandedMonths[`${year}-${monthNum}`] ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color="#94a3b8"
                            />
                        </TouchableOpacity>

                        {/* Reports in month */}
                        {expandedMonths[`${year}-${monthNum}`] && (
                            <View style={styles.reportsContainer}>
                                {monthData.reports.map(report => (
                                    <TouchableOpacity
                                        key={report._id}
                                        style={[
                                            styles.reportItem,
                                            !report.readAt && styles.reportItemUnread
                                        ]}
                                        onPress={() => onSelectReport(report)}
                                    >
                                        <Text style={styles.reportIcon}>
                                            {report.trafficLight === 'green' ? '🟢' :
                                                report.trafficLight === 'yellow' ? '🟡' : '🔴'}
                                        </Text>
                                        <View style={styles.reportInfo}>
                                            <Text style={[
                                                styles.reportTitle,
                                                !report.readAt && styles.reportTitleUnread
                                            ]}>
                                                {report.weekNumber ? `Semana ${report.weekNumber}` : 'Feedback'}
                                            </Text>
                                            <Text style={styles.reportDate}>
                                                {new Date(report.sentAt).toLocaleDateString('es-ES', {
                                                    day: 'numeric',
                                                    month: 'short'
                                                })}
                                            </Text>
                                        </View>
                                        {!report.readAt && (
                                            <View style={styles.unreadDot} />
                                        )}
                                        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                ))
            }
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function FeedbackHistoryModal({ visible, onClose }) {
    const { token } = useAuth();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [reports, setReports] = useState([]);
    const [expandedMonths, setExpandedMonths] = useState({});
    const [selectedReport, setSelectedReport] = useState(null);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD REPORTS
    // ─────────────────────────────────────────────────────────────────────────

    const loadReports = useCallback(async () => {
        if (!visible) return;

        try {
            const res = await fetch(`${API_URL}/api/feedback-reports/my-reports`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setReports(data.reports || []);
                // Expand current month by default
                const now = new Date();
                setExpandedMonths({
                    [`${now.getFullYear()}-${now.getMonth() + 1}`]: true
                });
            }
        } catch (error) {
            console.error('[FeedbackHistory] Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [visible, token]);

    useEffect(() => {
        if (visible) {
            setLoading(true);
            loadReports();
        }
    }, [visible, loadReports]);

    // ─────────────────────────────────────────────────────────────────────────
    // ORGANIZE BY YEAR/MONTH
    // ─────────────────────────────────────────────────────────────────────────

    const organizedReports = React.useMemo(() => {
        const organized = {};
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        reports.forEach(report => {
            const date = new Date(report.sentAt);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;

            if (!organized[year]) {
                organized[year] = {};
            }
            if (!organized[year][month]) {
                organized[year][month] = {
                    name: monthNames[month - 1],
                    reports: []
                };
            }
            organized[year][month].reports.push(report);
        });

        return organized;
    }, [reports]);

    const toggleMonth = (key) => {
        setExpandedMonths(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleSelectReport = async (report) => {
        setSelectedReport(report);
        // Mark as read
        if (!report.readAt) {
            try {
                await fetch(`${API_URL}/api/feedback-reports/${report._id}/read`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}` }
                });
                // Update local state
                setReports(prev => prev.map(r =>
                    r._id === report._id ? { ...r, readAt: new Date() } : r
                ));
            } catch (error) {
                console.log('[FeedbackHistory] Error marking as read');
            }
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadReports();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    // If viewing a specific report
    if (selectedReport) {
        return (
            <FeedbackReportView
                visible={true}
                report={selectedReport}
                onClose={() => setSelectedReport(null)}
                onReportUpdated={(updated) => {
                    setReports(prev => prev.map(r => r._id === updated._id ? updated : r));
                }}
            />
        );
    }

    const unreadCount = reports.filter(r => !r.readAt).length;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="arrow-back" size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>📬 Mis Feedbacks</Text>
                    {unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{unreadCount} nuevos</Text>
                        </View>
                    )}
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#8b5cf6" />
                        <Text style={styles.loadingText}>Cargando feedbacks...</Text>
                    </View>
                ) : reports.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="mail-open-outline" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>Sin feedbacks aún</Text>
                        <Text style={styles.emptySubtitle}>
                            Cuando tu entrenador te envíe un feedback aparecerá aquí
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={styles.contentInner}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                colors={['#8b5cf6']}
                            />
                        }
                    >
                        {Object.entries(organizedReports)
                            .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Newest year first
                            .map(([year, months]) => (
                                <FolderItem
                                    key={year}
                                    year={year}
                                    months={months}
                                    expandedMonths={expandedMonths}
                                    toggleMonth={toggleMonth}
                                    onSelectReport={handleSelectReport}
                                />
                            ))
                        }
                        <View style={{ height: 40 }} />
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12
    },
    loadingText: {
        color: '#64748b',
        fontSize: 14
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0'
    },
    closeBtn: {
        padding: 4
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginLeft: 12
    },
    unreadBadge: {
        backgroundColor: '#8b5cf6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16
    },
    unreadBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600'
    },

    // Content
    content: {
        flex: 1
    },
    contentInner: {
        padding: 16
    },

    // Folder
    folderContainer: {
        marginBottom: 16
    },
    yearHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    yearText: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b'
    },
    countBadge: {
        backgroundColor: '#f59e0b20',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    countText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#f59e0b'
    },

    // Month
    monthContainer: {
        marginLeft: 20,
        marginTop: 8
    },
    monthHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 12,
        gap: 10
    },
    monthText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b'
    },

    // Reports
    reportsContainer: {
        marginLeft: 20,
        marginTop: 8
    },
    reportItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
        gap: 12
    },
    reportItemUnread: {
        backgroundColor: '#f5f3ff',
        borderWidth: 1,
        borderColor: '#8b5cf6'
    },
    reportIcon: {
        fontSize: 16
    },
    reportInfo: {
        flex: 1
    },
    reportTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b'
    },
    reportTitleUnread: {
        fontWeight: '700'
    },
    reportDate: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#8b5cf6'
    },

    // Empty
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 16
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
        textAlign: 'center'
    }
});
