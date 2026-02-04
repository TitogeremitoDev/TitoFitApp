/**
 * communication/index.jsx - Coach Communication Center
 * Sistema de comunicación con tabs: Chat, Feedbacks, Comunidad
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    FlatList,
    ActivityIndicator
} from 'react-native';
import { EnhancedTextInput } from '../../../components/ui';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import FeedbackChatModal from '../../../components/FeedbackChatModal';
import BroadcastModal from '../../../components/BroadcastModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// ═══════════════════════════════════════════════════════════════════════════
// TABS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const TABS = [
    { id: 'chat', label: 'Chat', icon: 'chatbubbles' },
    { id: 'feedbacks', label: 'Feedbacks', icon: 'document-text' },
    { id: 'comunidad', label: 'Comunidad', icon: 'people' }
];

// ═══════════════════════════════════════════════════════════════════════════
// CHAT TAB COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const ChatTab = ({ token }) => {
    const [clientsList, setClientsList] = useState([]);
    const [feedbackSummary, setFeedbackSummary] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [unreadMessages, setUnreadMessages] = useState(0);

    // Chat Modal
    const [chatModalVisible, setChatModalVisible] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);

    // Broadcast Modal
    const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [clientsRes, summaryRes, unreadRes] = await Promise.all([
                fetch(`${API_URL}/api/trainers/clients-extended`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_URL}/api/chat/summary`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_URL}/api/chat/total-unread`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            const clientsData = await clientsRes.json();
            const summaryData = await summaryRes.json();
            const unreadData = await unreadRes.json();

            setClientsList(clientsData.clients || []);
            setFeedbackSummary(summaryData.summary || {});
            setUnreadMessages(unreadData.totalUnread || 0);
        } catch (error) {
            console.error('Error loading chat data:', error);
        } finally {
            setLoading(false);
        }
    };

    const openClientChat = (client) => {
        setSelectedClient(client);
        setChatModalVisible(true);
    };

    const closeClientChat = () => {
        setChatModalVisible(false);
        setSelectedClient(null);
        loadData(); // Refresh data after closing chat
    };

    // Filter and sort clients
    const filteredClients = clientsList
        .filter(client => {
            const matchesSearch = client.nombre?.toLowerCase().includes(searchQuery.toLowerCase());
            const summary = feedbackSummary[client._id] || {};

            if (activeFilter === 'unread') {
                return matchesSearch && summary.unreadMessages > 0;
            } else if (activeFilter === 'replied') {
                return matchesSearch && summary.unreadMessages === 0 && summary.totalMessages > 0;
            }
            return matchesSearch;
        })
        .sort((a, b) => {
            const aUnread = feedbackSummary[a._id]?.unreadMessages || 0;
            const bUnread = feedbackSummary[b._id]?.unreadMessages || 0;
            return bUnread - aUnread;
        });

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8b5cf6" />
                <Text style={styles.loadingText}>Cargando conversaciones...</Text>
            </View>
        );
    }

    return (
        <View style={styles.tabContent}>
            {/* Stats Bar */}
            <View style={styles.statsBar}>
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{clientsList.length}</Text>
                    <Text style={styles.statLabel}>Clientes</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#3b82f6' }]}>{unreadMessages}</Text>
                    <Text style={styles.statLabel}>Pendientes</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#10b981' }]}>
                        {clientsList.filter(c => {
                            const s = feedbackSummary[c._id];
                            return s && s.unreadMessages === 0 && s.totalMessages > 0;
                        }).length}
                    </Text>
                    <Text style={styles.statLabel}>Al día</Text>
                </View>
                {/* Broadcast Button */}
                <TouchableOpacity
                    style={styles.broadcastBtn}
                    onPress={() => setBroadcastModalVisible(true)}
                >
                    <Ionicons name="megaphone" size={20} color="#8b5cf6" />
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#94a3b8" />
                <EnhancedTextInput
                    style={styles.searchInputText}
                    containerStyle={styles.searchInputContainer}
                    placeholder="Buscar cliente..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterTabs}>
                {[
                    { id: 'all', label: 'Todos', icon: 'people' },
                    { id: 'unread', label: 'Pendientes', icon: 'mail-unread' },
                    { id: 'replied', label: 'Respondidos', icon: 'checkmark-done' }
                ].map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.filterTab, activeFilter === tab.id && styles.filterTabActive]}
                        onPress={() => setActiveFilter(tab.id)}
                    >
                        <Ionicons
                            name={tab.icon}
                            size={16}
                            color={activeFilter === tab.id ? '#fff' : '#64748b'}
                        />
                        <Text style={[
                            styles.filterTabText,
                            activeFilter === tab.id && styles.filterTabTextActive
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Clients List */}
            <FlatList
                data={filteredClients}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.clientsListContent}
                renderItem={({ item }) => {
                    const summary = feedbackSummary[item._id] || {};
                    const hasUnread = summary.unreadMessages > 0;
                    const totalMsgs = summary.totalMessages || 0;

                    // Calculate status
                    let statusColor = '#6b7280';
                    let statusLabel = 'Sin contacto';
                    if (summary.lastFeedbackDate) {
                        const daysSince = Math.floor(
                            (new Date() - new Date(summary.lastFeedbackDate)) / (1000 * 60 * 60 * 24)
                        );
                        if (daysSince < 7) {
                            statusColor = '#10b981';
                            statusLabel = 'Activo';
                        } else if (daysSince < 14) {
                            statusColor = '#f59e0b';
                            statusLabel = 'Atención';
                        } else {
                            statusColor = '#ef4444';
                            statusLabel = 'Urgente';
                        }
                    }

                    return (
                        <TouchableOpacity
                            style={[styles.clientCard, hasUnread && styles.clientCardUnread]}
                            onPress={() => openClientChat(item)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.clientCardLeft}>
                                <View style={[
                                    styles.clientAvatar,
                                    hasUnread && styles.clientAvatarUnread
                                ]}>
                                    <Text style={[
                                        styles.clientAvatarText,
                                        hasUnread && { color: '#fff' }
                                    ]}>
                                        {item.nombre?.charAt(0)?.toUpperCase() || '?'}
                                    </Text>
                                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                </View>
                                <View style={styles.clientCardInfo}>
                                    <Text style={styles.clientCardName}>{item.nombre}</Text>
                                    <Text style={styles.clientCardMeta}>
                                        {totalMsgs > 0
                                            ? `${totalMsgs} msgs • ${statusLabel}`
                                            : 'Sin conversación aún'
                                        }
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.clientCardRight}>
                                {hasUnread && (
                                    <View style={styles.unreadBadgeLarge}>
                                        <Text style={styles.unreadBadgeText}>{summary.unreadMessages}</Text>
                                    </View>
                                )}
                                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>
                            {activeFilter === 'unread' ? 'Sin mensajes pendientes' :
                                activeFilter === 'replied' ? 'Sin conversaciones respondidas' :
                                    searchQuery ? 'Sin resultados' : 'Sin clientes'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {activeFilter === 'unread' ? '¡Excelente! Estás al día con todos' :
                                searchQuery ? 'Intenta con otro nombre' : ''}
                        </Text>
                    </View>
                }
            />

            {/* Chat Modal */}
            <FeedbackChatModal
                visible={chatModalVisible}
                onClose={closeClientChat}
                clientId={selectedClient?._id}
                clientName={selectedClient?.nombre}
                isCoach={true}
            />

            {/* Broadcast Modal */}
            <BroadcastModal
                visible={broadcastModalVisible}
                onClose={() => setBroadcastModalVisible(false)}
            />
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// PLACEHOLDER TAB COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const PlaceholderTab = ({ title, icon, description }) => (
    <View style={styles.placeholderContainer}>
        <Ionicons name={icon} size={80} color="#cbd5e1" />
        <Text style={styles.placeholderTitle}>{title}</Text>
        <Text style={styles.placeholderDescription}>{description}</Text>
        <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>🚧 Próximamente</Text>
        </View>
    </View>
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function CommunicationScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState('chat');

    const renderContent = () => {
        switch (activeTab) {
            case 'chat':
                return <ChatTab token={token} />;
            case 'feedbacks':
                return (
                    <PlaceholderTab
                        title="Sistema de Feedbacks"
                        icon="document-text-outline"
                        description="Recibe y gestiona los feedbacks estructurados de tus clientes sobre entrenos, nutrición y progreso."
                    />
                );
            case 'comunidad':
                return (
                    <PlaceholderTab
                        title="Comunidad"
                        icon="people-outline"
                        description="Foros, grupos y canales de comunicación masiva para mantener conectados a todos tus clientes."
                    />
                );
            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Comunicación"
                subtitle="Chat, feedbacks y comunidad"
                icon="chatbubbles"
                iconColor="#8b5cf6"
            />

            {/* Tab Selector */}
            <View style={styles.tabSelector}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[
                            styles.tabButton,
                            activeTab === tab.id && styles.tabButtonActive
                        ]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <Ionicons
                            name={activeTab === tab.id ? tab.icon : `${tab.icon}-outline`}
                            size={20}
                            color={activeTab === tab.id ? '#fff' : '#64748b'}
                        />
                        <Text style={[
                            styles.tabButtonText,
                            activeTab === tab.id && styles.tabButtonTextActive
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            {renderContent()}
        </SafeAreaView>
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

    // Tab Selector
    tabSelector: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        gap: 8
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#f1f5f9'
    },
    tabButtonActive: {
        backgroundColor: '#8b5cf6'
    },
    tabButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b'
    },
    tabButtonTextActive: {
        color: '#fff'
    },

    // Tab Content
    tabContent: {
        flex: 1
    },

    // Loading
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12
    },
    loadingText: {
        fontSize: 14,
        color: '#64748b'
    },

    // Stats Bar
    statsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0'
    },
    statItem: {
        flex: 1,
        alignItems: 'center'
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1e293b'
    },
    statLabel: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#e2e8f0'
    },
    broadcastBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12
    },

    // Search
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        margin: 16,
        marginBottom: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    searchInputContainer: {
        flex: 1,
        marginLeft: 12,
    },
    searchInputText: {
        fontSize: 15,
        color: '#1e293b',
    },

    // Filter Tabs
    filterTabs: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
        marginBottom: 8
    },
    filterTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    filterTabActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6'
    },
    filterTabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b'
    },
    filterTabTextActive: {
        color: '#fff'
    },

    // Clients List
    clientsListContent: {
        padding: 16,
        paddingTop: 8,
        gap: 8
    },
    clientCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    clientCardUnread: {
        backgroundColor: '#eff6ff',
        borderColor: '#3b82f6'
    },
    clientCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    clientAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
    },
    clientAvatarUnread: {
        backgroundColor: '#3b82f6'
    },
    clientAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#64748b'
    },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#fff'
    },
    clientCardInfo: {
        marginLeft: 12,
        flex: 1
    },
    clientCardName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b'
    },
    clientCardMeta: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2
    },
    clientCardRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    unreadBadgeLarge: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        minWidth: 24,
        alignItems: 'center'
    },
    unreadBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700'
    },

    // Empty State
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 48
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 16,
        textAlign: 'center'
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
        textAlign: 'center'
    },

    // Placeholder Tab
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32
    },
    placeholderTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 20,
        textAlign: 'center'
    },
    placeholderDescription: {
        fontSize: 15,
        color: '#64748b',
        marginTop: 12,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 300
    },
    comingSoonBadge: {
        marginTop: 24,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#fef3c7',
        borderRadius: 20
    },
    comingSoonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#92400e'
    }
});
