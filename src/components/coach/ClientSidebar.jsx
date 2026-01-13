/* ClientSidebar.jsx - Collapsible client list sidebar for wide screens */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const getDailyBadgeColor = (days) => {
    if (days === null) return '#94a3b8'; // Gray - no data
    if (days <= 1) return '#10b981'; // Green - today/yesterday
    if (days <= 3) return '#f59e0b'; // Yellow - 2-3 days
    return '#ef4444'; // Red - 4+ days
};

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
}) {
    // Sort clients: unread notes first, then by daysSinceDaily
    const sortedClients = [...(clients || [])].sort((a, b) => {
        // Priority 1: Unread notes first
        if ((a.unreadNotesCount || 0) > 0 && !(b.unreadNotesCount || 0)) return -1;
        if (!(a.unreadNotesCount || 0) && (b.unreadNotesCount || 0) > 0) return 1;

        // Priority 2: Unviewed records first
        const aUnviewed = !a.dailyViewed || !a.weeklyViewed;
        const bUnviewed = !b.dailyViewed || !b.weeklyViewed;
        if (aUnviewed && !bUnviewed) return -1;
        if (!aUnviewed && bUnviewed) return 1;

        // Priority 3: Days since last daily
        const aDays = a.daysSinceDaily ?? 999;
        const bDays = b.daysSinceDaily ?? 999;
        return aDays - bDays;
    });

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

            {/* Client list */}
            <ScrollView
                style={styles.clientList}
                showsVerticalScrollIndicator={false}
            >
                {sortedClients.map((client) => {
                    const isActive = client._id === currentClientId;
                    const hasUnreadNotes = (client.unreadNotesCount || 0) > 0;
                    const hasUnviewed = !client.dailyViewed || !client.weeklyViewed;
                    const dailyColor = getDailyBadgeColor(client.daysSinceDaily);

                    return (
                        <TouchableOpacity
                            key={client._id}
                            style={[
                                styles.clientItem,
                                isActive && styles.clientItemActive,
                                isCollapsed && styles.clientItemCollapsed,
                            ]}
                            onPress={() => onClientSelect(client)}
                            activeOpacity={0.7}
                        >
                            {/* Avatar with badges */}
                            <View style={styles.avatarWrapper}>
                                {client.profilePhoto ? (
                                    <Image
                                        source={{ uri: client.profilePhoto }}
                                        style={[
                                            styles.avatar,
                                            isActive && styles.avatarActive,
                                        ]}
                                    />
                                ) : (
                                    <View style={[
                                        styles.avatarPlaceholder,
                                        isActive && styles.avatarActive,
                                    ]}>
                                        <Ionicons
                                            name="person"
                                            size={isCollapsed ? 18 : 20}
                                            color="#94a3b8"
                                        />
                                    </View>
                                )}

                                {/* Unread notes badge (red dot) */}
                                {hasUnreadNotes && (
                                    <View style={styles.unreadDot}>
                                        {!isCollapsed && (
                                            <Text style={styles.unreadDotText}>
                                                {client.unreadNotesCount}
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {/* Status indicator */}
                                {!hasUnreadNotes && (
                                    <View style={[
                                        styles.statusDot,
                                        { backgroundColor: dailyColor }
                                    ]} />
                                )}
                            </View>

                            {/* Client info (hidden when collapsed) */}
                            {!isCollapsed && (
                                <View style={styles.clientInfo}>
                                    <Text
                                        style={[
                                            styles.clientName,
                                            isActive && styles.clientNameActive,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {client.nombre?.split(' ')[0] || 'Cliente'}
                                    </Text>

                                    {/* Mini stats row */}
                                    <View style={styles.miniStats}>
                                        {client.avgWeight7d && (
                                            <Text style={styles.miniStat}>
                                                {client.avgWeight7d}kg
                                            </Text>
                                        )}
                                        {client.daysSinceDaily !== null && (
                                            <Text style={[
                                                styles.miniStat,
                                                { color: dailyColor }
                                            ]}>
                                                {client.daysSinceDaily === 0 ? 'Hoy' :
                                                    client.daysSinceDaily === 1 ? 'Ayer' :
                                                        `${client.daysSinceDaily}d`}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Footer with count */}
            {!isCollapsed && (
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        {clients?.length || 0} clientes
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
        width: '15%',
        maxWidth: 200,
        minWidth: 180,
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

    // Client list
    clientList: {
        flex: 1,
    },
    clientItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
        gap: 10,
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

    // Avatar
    avatarWrapper: {
        position: 'relative',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#e2e8f0',
    },
    avatarActive: {
        borderColor: '#0ea5e9',
    },
    avatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#e2e8f0',
    },
    unreadDot: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        paddingHorizontal: 3,
    },
    unreadDotText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#fff',
    },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
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
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    clientNameActive: {
        color: '#0ea5e9',
    },
    miniStats: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 2,
    },
    miniStat: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
    },

    // Footer
    footer: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    footerText: {
        fontSize: 11,
        color: '#94a3b8',
        textAlign: 'center',
    },
});
