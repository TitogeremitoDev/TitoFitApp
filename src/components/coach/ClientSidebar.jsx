/* ClientSidebar.jsx - Enhanced collapsible sidebar with search, sorting, hover tooltips */

import React, { useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ScrollView,
    TouchableOpacity,
    Pressable,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../../../components/ui';
import AvatarWithInitials from '../shared/AvatarWithInitials';

// ═══════════════════════════════════════════════════════════════════════════
// STATUS HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
    critical: { emoji: '🔴', color: '#ef4444', bgColor: '#fef2f2' },
    warning: { emoji: '🟠', color: '#f59e0b', bgColor: '#fffbeb' },
    active: { emoji: '🟢', color: '#10b981', bgColor: '#ecfdf5' },
};

// Sort options
const SORT_OPTIONS = [
    { key: 'urgency', icon: 'alert-circle', label: 'Urgencia' },
    { key: 'date', icon: 'calendar', label: 'Fecha' },
    { key: 'name', icon: 'text', label: 'Nombre' },
];

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT SIDEBAR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function ClientSidebar({
    clients,
    isLoading,
    currentClientId,
    onClientSelect,
    isCollapsed,
    onToggleCollapse,
    context = 'seguimiento',
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('urgency'); // 'urgency' | 'date' | 'name'
    const [hoveredClientId, setHoveredClientId] = useState(null);

    // Filter and sort clients
    const sortedClients = useMemo(() => {
        if (!clients || clients.length === 0) return [];

        // Filter by search
        let filtered = clients;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = clients.filter(client =>
                client.nombre?.toLowerCase().includes(query)
            );
        }

        // Sort
        const sorted = [...filtered];
        switch (sortBy) {
            case 'name':
                sorted.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
                break;
            case 'date':
                sorted.sort((a, b) => {
                    const dateA = a.lastUpdate ? new Date(a.lastUpdate) : new Date(0);
                    const dateB = b.lastUpdate ? new Date(b.lastUpdate) : new Date(0);
                    return dateB - dateA; // Most recent first
                });
                break;
            case 'urgency':
            default:
                sorted.sort((a, b) => (b.urgencyScore || 0) - (a.urgencyScore || 0));
                break;
        }

        return sorted;
    }, [clients, searchQuery, sortBy]);

    // Group clients by status when sorted by urgency
    const { criticalClients, warningClients, activeClients } = useMemo(() => {
        if (sortBy !== 'urgency') {
            return { criticalClients: [], warningClients: [], activeClients: sortedClients };
        }

        const critical = [];
        const warning = [];
        const active = [];

        sortedClients.forEach(client => {
            if (client.status === 'critical') {
                critical.push(client);
            } else if (client.status === 'warning') {
                warning.push(client);
            } else {
                active.push(client);
            }
        });

        return { criticalClients: critical, warningClients: warning, activeClients: active };
    }, [sortedClients, sortBy]);

    // Build flat list data with section headers for urgency mode
    const flatListData = useMemo(() => {
        if (sortBy !== 'urgency') return sortedClients;

        const data = [];
        if (criticalClients.length > 0) {
            data.push({ _type: 'header', key: 'h-critical', label: '⚠️ Atención' });
            data.push(...criticalClients);
        }
        if (warningClients.length > 0) {
            if (criticalClients.length > 0) data.push({ _type: 'divider', key: 'd-warning' });
            data.push(...warningClients);
        }
        if (activeClients.length > 0) {
            if (criticalClients.length > 0 || warningClients.length > 0) data.push({ _type: 'divider', key: 'd-active' });
            data.push(...activeClients);
        }
        return data;
    }, [sortBy, sortedClients, criticalClients, warningClients, activeClients]);

    const renderClientItem = useCallback(({ item: client }) => {
        // Section header
        if (client._type === 'header') {
            if (isCollapsed) return null;
            return (
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{client.label}</Text>
                </View>
            );
        }
        // Divider
        if (client._type === 'divider') {
            if (isCollapsed) return null;
            return <View style={styles.sectionDivider} />;
        }

        const isActive = client._id === currentClientId;
        const statusConfig = STATUS_CONFIG[client.status] || STATUS_CONFIG.active;

        return (
            <Pressable
                focusable={false}
                style={[{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    gap: 8,
                    position: 'relative',
                    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
                },
                isActive && styles.clientItemActive,
                isCollapsed && styles.clientItemCollapsed,
                ]}
                onPress={() => onClientSelect(client)}
            >
                {/* Avatar with status indicator */}
                <View style={styles.avatarWrapper}>
                    <AvatarWithInitials
                        name={client.nombre}
                        avatarUrl={client.avatarUrl}
                        size={isCollapsed ? 28 : 32}
                    />
                    <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                </View>

                {/* Client info (hidden when collapsed) */}
                {!isCollapsed && (
                    <View style={styles.clientInfo}>
                        <Text
                            style={[styles.clientName, isActive && styles.clientNameActive]}
                            numberOfLines={1}
                        >
                            {client.nombre?.split(' ')[0] || 'Cliente'}
                        </Text>
                        <Text
                            style={[styles.statusLabel, { color: statusConfig.color }]}
                            numberOfLines={1}
                        >
                            {client.statusLabel || ''}
                        </Text>
                    </View>
                )}
            </Pressable>
        );
    }, [currentClientId, isCollapsed, onClientSelect]);

    const keyExtractor = useCallback((item) => item._id || item.key, []);

    if (isLoading) {
        return (
            <View style={[styles.container, isCollapsed && styles.containerCollapsed]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#0ea5e9" />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, isCollapsed && styles.containerCollapsed]}>
            {/* Header with collapse toggle */}
            <View style={styles.header}>
                {!isCollapsed && (
                    <Text style={styles.headerTitle}>Clientes</Text>
                )}
                <TouchableOpacity
                    style={styles.collapseBtn}
                    onPress={onToggleCollapse}
                >
                    <Ionicons
                        name={isCollapsed ? "chevron-forward" : "chevron-back"}
                        size={18}
                        color="#64748b"
                    />
                </TouchableOpacity>
            </View>

            {/* Search + Sort Row (hidden when collapsed) */}
            {!isCollapsed && (
                <View style={styles.controlsContainer}>
                    {/* Search input */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={14} color="#94a3b8" />
                        <EnhancedTextInput
                            containerStyle={styles.searchInputContainer}
                            style={styles.searchInputText}
                            placeholder="Buscar..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                                <Ionicons name="close-circle" size={14} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Sort buttons */}
                    <View style={styles.sortContainer}>
                        {SORT_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.key}
                                style={[
                                    styles.sortBtn,
                                    sortBy === opt.key && styles.sortBtnActive
                                ]}
                                onPress={() => setSortBy(opt.key)}
                            >
                                <Ionicons
                                    name={opt.icon}
                                    size={14}
                                    color={sortBy === opt.key ? '#0ea5e9' : '#94a3b8'}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Client list - ScrollView on web (avoids non-passive wheel handler from FlatList), FlatList on native */}
            {Platform.OS === 'web' ? (
                <ScrollView style={styles.clientList} showsVerticalScrollIndicator={false}>
                    {flatListData.length > 0 ? (
                        flatListData.map((item, index) => (
                            <React.Fragment key={keyExtractor(item, index)}>
                                {renderClientItem({ item, index })}
                            </React.Fragment>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>
                                {searchQuery ? 'Sin resultados' : 'Sin clientes'}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            ) : (
                <FlatList
                    style={styles.clientList}
                    data={flatListData}
                    renderItem={renderClientItem}
                    keyExtractor={keyExtractor}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={10}
                    maxToRenderPerBatch={5}
                    windowSize={5}
                    removeClippedSubviews
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>
                                {searchQuery ? 'Sin resultados' : 'Sin clientes'}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Footer with count */}
            {!isCollapsed && (
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        {sortedClients.length} de {clients?.length || 0}
                    </Text>
                </View>
            )}
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        width: 200,
        minWidth: 200,
        maxWidth: 200,
        backgroundColor: '#fff',
        borderRightWidth: 1,
        borderRightColor: '#e2e8f0',
        flexShrink: 0,
    },
    containerCollapsed: {
        width: 60,
        minWidth: 60,
        maxWidth: 60,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
    },
    collapseBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Controls (Search + Sort)
    controlsContainer: {
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        gap: 4,
    },
    searchInputContainer: {
        flex: 1,
        padding: 0,
        minWidth: 0,
    },
    searchInputText: {
        fontSize: 12,
        color: '#1e293b',
    },
    clearBtn: {
        padding: 2,
    },
    sortContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 6,
        gap: 4,
    },
    sortBtn: {
        width: 26,
        height: 26,
        borderRadius: 6,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sortBtnActive: {
        backgroundColor: '#0ea5e915',
    },

    // Section headers
    sectionHeader: {
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 4,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#ef4444',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 6,
        marginHorizontal: 12,
    },

    // Client list
    clientList: {
        flex: 1,
    },
    clientItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        gap: 8,
        position: 'relative',
    },
    clientItemActive: {
        backgroundColor: '#0ea5e910',
        borderLeftWidth: 3,
        borderLeftColor: '#0ea5e9',
    },
    clientItemCollapsed: {
        justifyContent: 'center',
        paddingHorizontal: 0,
    },
    clientItemHovered: {
        backgroundColor: '#f8fafc',
    },

    // Avatar
    avatarWrapper: {
        position: 'relative',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#e2e8f0',
    },
    avatarActive: {
        borderColor: '#0ea5e9',
    },
    avatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#e2e8f0',
    },
    statusDot: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#fff',
    },

    // Client info
    clientInfo: {
        flex: 1,
        minWidth: 0,
    },
    clientName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1e293b',
    },
    clientNameActive: {
        color: '#0ea5e9',
    },
    statusLabel: {
        fontSize: 10,
        fontWeight: '500',
        marginTop: 1,
    },

    // Tooltip (web only)
    tooltip: {
        position: 'absolute',
        left: '100%',
        top: '50%',
        transform: [{ translateY: -12 }],
        backgroundColor: '#1e293b',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 8,
        zIndex: 1000,
        maxWidth: 200,
        ...(Platform.OS === 'web' ? { whiteSpace: 'nowrap' } : {}),
    },
    tooltipText: {
        fontSize: 11,
        color: '#fff',
        fontWeight: '500',
    },

    // Empty state
    emptyState: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 12,
        color: '#94a3b8',
    },

    // Footer
    footer: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    footerText: {
        fontSize: 10,
        color: '#94a3b8',
        textAlign: 'center',
    },
});
