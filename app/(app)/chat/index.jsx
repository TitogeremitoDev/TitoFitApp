/**
 * chat/index.jsx - Pantalla Principal de Chat Social
 * Lista de conversaciones con entrenador primero, amigos y grupos
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Modal,
    Alert,
    Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useChatTheme } from '../../../context/ChatThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// ═══════════════════════════════════════════════════════════════════════════
// ADD CONTACT MODAL
// ═══════════════════════════════════════════════════════════════════════════

const AddContactModal = ({ visible, onClose, token, onContactAdded, chatTheme }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchResult, setSearchResult] = useState(null);
    const [error, setError] = useState('');

    const searchByCode = async () => {
        if (!code || code.length < 4) {
            setError('Código muy corto');
            return;
        }

        setLoading(true);
        setError('');
        setSearchResult(null);

        try {
            const res = await fetch(`${API_URL}/api/contacts/search?code=${code.toUpperCase()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setSearchResult(data.user);
            } else {
                setError(data.message || 'Usuario no encontrado');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const addContact = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/contacts/add`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: code.toUpperCase() })
            });
            const data = await res.json();

            if (data.success) {
                onContactAdded(data.contact);
                onClose();
                setCode('');
                setSearchResult(null);
            } else {
                setError(data.message || 'Error al añadir');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Añadir Amigo</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.modalSubtitle}>
                        Introduce el código de referido de tu amigo.{"\n"}
                        perfil/amigos
                    </Text>
                    <View style={styles.codeInputContainer}>
                        <TextInput
                            style={styles.codeInput}
                            value={code}
                            onChangeText={setCode}
                            placeholder="TOTALGAIN8B783"
                            placeholderTextColor="#3b82f6"
                            autoCapitalize="characters"
                            maxLength={20}
                        />
                        <TouchableOpacity
                            style={styles.searchBtn}
                            onPress={searchByCode}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="search" size={20} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {error ? (
                        <Text style={styles.errorText}>{error}</Text>
                    ) : null}

                    {searchResult && (
                        <View style={styles.searchResultCard}>
                            <View style={styles.resultAvatar}>
                                <Text style={styles.resultAvatarText}>
                                    {searchResult.nombre?.charAt(0)?.toUpperCase() || '?'}
                                </Text>
                            </View>
                            <View style={styles.resultInfo}>
                                <Text style={styles.resultName}>{searchResult.nombre}</Text>
                                <Text style={styles.resultUsername}>@{searchResult.username}</Text>
                            </View>
                            {searchResult.isContact ? (
                                <View style={styles.alreadyContactBadge}>
                                    <Text style={styles.alreadyContactText}>Ya es amigo</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.addBtn}
                                    onPress={addContact}
                                    disabled={loading}
                                >
                                    <Ionicons name="person-add" size={18} color="#fff" />
                                    <Text style={styles.addBtnText}>Añadir</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function ChatHomeScreen() {
    const router = useRouter();
    const { token, user } = useAuth();
    const { chatTheme } = useChatTheme();

    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [addModalVisible, setAddModalVisible] = useState(false);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD CONVERSATIONS
    // ─────────────────────────────────────────────────────────────────────────

    const loadConversations = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/conversations`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setConversations(data.conversations || []);
            }
        } catch (error) {
            console.error('[ChatHome] Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadConversations();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS
    // ─────────────────────────────────────────────────────────────────────────

    const openConversation = (conv) => {
        router.push({
            pathname: '/(app)/chat/[conversationId]',
            params: {
                conversationId: conv._id,
                displayName: conv.displayName,
                isTrainerChat: conv.isTrainerChat ? 'true' : 'false',
                type: conv.type
            }
        });
    };

    const handleContactAdded = (contact) => {
        // Iniciar chat con el nuevo contacto
        startDirectChat(contact.user._id);
    };

    const startDirectChat = async (contactId) => {
        try {
            const res = await fetch(`${API_URL}/api/conversations/direct`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ contactId })
            });
            const data = await res.json();

            if (data.success) {
                loadConversations();
            }
        } catch (error) {
            console.error('[ChatHome] Error starting chat:', error);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER CONVERSATION ITEM
    // ─────────────────────────────────────────────────────────────────────────

    const renderConversation = ({ item }) => {
        const hasUnread = item.unreadCount > 0;
        const lastMsgTime = item.lastMessage?.timestamp
            ? new Date(item.lastMessage.timestamp).toLocaleDateString('es-ES', {
                hour: '2-digit',
                minute: '2-digit'
            })
            : '';

        return (
            <TouchableOpacity
                style={[
                    styles.conversationItem,
                    { backgroundColor: chatTheme.cardBackground, borderBottomColor: chatTheme.border },
                    hasUnread && { backgroundColor: chatTheme.primary + '10' }
                ]}
                onPress={() => openConversation(item)}
                activeOpacity={0.7}
            >
                {/* Avatar */}
                <View style={[
                    styles.avatar,
                    { backgroundColor: chatTheme.textTertiary },
                    item.isTrainerChat && { backgroundColor: chatTheme.primary },
                    item.type === 'group' && { backgroundColor: chatTheme.header }
                ]}>
                    {item.isTrainerChat ? (
                        <Ionicons name="fitness" size={24} color="#fff" />
                    ) : item.type === 'group' ? (
                        <Ionicons name="people" size={22} color="#fff" />
                    ) : (
                        <Text style={styles.avatarText}>
                            {item.displayName?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                    )}
                </View>

                {/* Content */}
                <View style={styles.conversationContent}>
                    <View style={styles.conversationHeader}>
                        <View style={styles.nameRow}>
                            <Text style={[
                                styles.conversationName,
                                { color: chatTheme.text },
                                hasUnread && styles.textBold
                            ]}>
                                {item.displayName}
                            </Text>
                            {item.isTrainerChat && (
                                <View style={[styles.trainerBadge, { backgroundColor: chatTheme.primary + '20' }]}>
                                    <Text style={[styles.trainerBadgeText, { color: chatTheme.primary }]}>Coach</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.conversationTime, { color: chatTheme.textTertiary }]}>{lastMsgTime}</Text>
                    </View>

                    <View style={styles.conversationPreview}>
                        <Text
                            style={[
                                styles.previewText,
                                { color: chatTheme.textSecondary },
                                hasUnread && { color: chatTheme.text, fontWeight: '700' }
                            ]}
                            numberOfLines={1}
                        >
                            {item.lastMessage?.text || 'Sin mensajes aún'}
                        </Text>
                        {hasUnread && (
                            <View style={[styles.unreadBadge, { backgroundColor: chatTheme.primary }]}>
                                <Text style={styles.unreadBadgeText}>
                                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8b5cf6" />
                    <Text style={styles.loadingText}>Cargando chats...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: chatTheme.background }]}>
            {/* Header */}
            <LinearGradient colors={[chatTheme.header, chatTheme.headerSecondary]} style={styles.header}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Mensajes</Text>
                <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => setAddModalVisible(true)}
                >
                    <Ionicons name="person-add-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => router.push('/(app)/chat/settings')}
                >
                    <Ionicons name="settings-outline" size={22} color="#fff" />
                </TouchableOpacity>
            </LinearGradient>

            {/* Conversations List */}
            <FlatList
                data={conversations}
                keyExtractor={item => item._id}
                renderItem={renderConversation}
                contentContainerStyle={styles.listContent}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={64} color={chatTheme.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: chatTheme.textSecondary }]}>Sin conversaciones</Text>
                        <Text style={[styles.emptySubtitle, { color: chatTheme.textTertiary }]}>
                            Añade amigos para empezar a chatear
                        </Text>
                    </View>
                }
            />

            {/* Add Contact Modal */}
            <AddContactModal
                visible={addModalVisible}
                onClose={() => setAddModalVisible(false)}
                token={token}
                onContactAdded={handleContactAdded}
                chatTheme={chatTheme}
            />
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

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16
    },
    backBtn: {
        padding: 4
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginLeft: 12
    },
    headerBtn: {
        padding: 8,
        marginLeft: 4
    },

    // List
    listContent: {
        flexGrow: 1
    },

    // Conversation Item
    conversationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    conversationItemUnread: {
        backgroundColor: '#f5f3ff'
    },

    // Avatar
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center'
    },
    avatarTrainer: {
        backgroundColor: '#8b5cf6'
    },
    avatarGroup: {
        backgroundColor: '#3b82f6'
    },
    avatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#64748b'
    },

    // Content
    conversationContent: {
        flex: 1,
        marginLeft: 12
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1
    },
    conversationName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1e293b'
    },
    trainerBadge: {
        backgroundColor: '#8b5cf620',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    trainerBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#8b5cf6'
    },
    conversationTime: {
        fontSize: 12,
        color: '#94a3b8'
    },
    conversationPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    previewText: {
        fontSize: 14,
        color: '#64748b',
        flex: 1,
        marginRight: 8
    },
    textBold: {
        fontWeight: '700',
        color: '#1e293b'
    },

    // Unread Badge
    unreadBadge: {
        backgroundColor: '#8b5cf6',
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6
    },
    unreadBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff'
    },

    // Empty
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 48,
        marginTop: 80
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
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b'
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 24
    },

    // Code Input - Estilo oscuro con borde azul
    codeInputContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16
    },
    codeInput: {
        flex: 1,
        backgroundColor: '#0f172a',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#3b82f6',
        paddingHorizontal: 20,
        paddingVertical: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#3b82f6',
        letterSpacing: 1,
        textAlign: 'center'
    },
    searchBtn: {
        width: 52,
        height: 52,
        borderRadius: 12,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    errorText: {
        color: '#ef4444',
        fontSize: 13,
        marginBottom: 16
    },

    // Search Result
    searchResultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 16,
        gap: 12
    },
    resultAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    resultAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff'
    },
    resultInfo: {
        flex: 1
    },
    resultName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b'
    },
    resultUsername: {
        fontSize: 13,
        color: '#64748b'
    },
    alreadyContactBadge: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12
    },
    alreadyContactText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#16a34a'
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#8b5cf6',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12
    },
    addBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff'
    }
});
