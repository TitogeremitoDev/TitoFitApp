/* ClientSidebar.jsx - Enhanced collapsible sidebar with search, sorting, hover tooltips */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Pressable,
    Image,
    TextInput,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

    const renderClientItem = (client) => {
        const isActive = client._id === currentClientId;
        const isHovered = hoveredClientId === client._id;
        const statusConfig = STATUS_CONFIG[client.status] || STATUS_CONFIG.active;

        return (
            <Pressable
                key={client._id}
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
                isHovered && styles.clientItemHovered,
                ]}
                onPress={() => onClientSelect(client)}
                onHoverIn={() => setHoveredClientId(client._id)}
                onHoverOut={() => setHoveredClientId(null)}
            >
                {/* Avatar with status indicator */}
                <View style={styles.avatarWrapper}>
                    {client.avatarUrl ? (
                        <Image
                            source={{ uri: client.avatarUrl }}
                            style={[styles.avatar, isActive && styles.avatarActive]}
                        />
                    ) : (
                        <View style={[styles.avatarPlaceholder, isActive && styles.avatarActive]}>
                            <Ionicons
                                name="person"
                                size={isCollapsed ? 18 : 20}
                                color="#94a3b8"
                            />
                        </View>
                    )}

                    {/* Status dot */}
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

                {/* Hover tooltip (web only) */}
                {Platform.OS === 'web' && isHovered && !isCollapsed && client.statusLabel && (
                    <View style={styles.tooltip}>
                        <Text style={styles.tooltipText}>
                            {client.nombre}: {client.statusLabel}
                        </Text>
                    </View>
                )}
            </Pressable>
        );
    };

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
                        <TextInput
                            style={styles.searchInput}
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

            {/* Client list */}
            <ScrollView
                style={styles.clientList}
                showsVerticalScrollIndicator={false}
            >
                {sortBy === 'urgency' ? (
                    <>
                        {/* CRITICAL Section */}
                        {criticalClients.length > 0 && (
                            <>
                                {!isCollapsed && (
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionTitle}>⚠️ Atención</Text>
                                    </View>
                                )}
                                {criticalClients.map(renderClientItem)}
                            </>
                        )}

                        {/* WARNING Section */}
                        {warningClients.length > 0 && (
                            <>
                                {!isCollapsed && criticalClients.length > 0 && (
                                    <View style={styles.sectionDivider} />
                                )}
                                {warningClients.map(renderClientItem)}
                            </>
                        )}

                        {/* ACTIVE Section */}
                        {activeClients.length > 0 && (
                            <>
                                {!isCollapsed && (criticalClients.length > 0 || warningClients.length > 0) && (
                                    <View style={styles.sectionDivider} />
                                )}
                                {activeClients.map(renderClientItem)}
                            </>
                        )}
                    </>
                ) : (
                    // Simple list for name/date sorting
                    sortedClients.map(renderClientItem)
                )}

                {/* Empty state */}
                {sortedClients.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                            {searchQuery ? 'Sin resultados' : 'Sin clientes'}
                        </Text>
                    </View>
                )}
            </ScrollView>

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
    searchInput: {
        flex: 1,
        fontSize: 12,
        color: '#1e293b',
        padding: 0,
        minWidth: 0,
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
