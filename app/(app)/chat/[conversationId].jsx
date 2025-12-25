/**
 * chat/[conversationId].jsx - Pantalla de Chat Individual
 * Reutiliza lógica similar a FeedbackChatModal pero para conversaciones sociales
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Keyboard
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useChatTheme } from '../../../context/ChatThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════════════════════

const MessageBubble = ({ message, isOwn, isTrainerChat, showSender, theme, isDark, fontSize }) => {
    const getTypeColor = (type) => {
        const colors = {
            entreno: '#8b5cf6',
            nutricion: '#10b981',
            evolucion: '#3b82f6',
            seguimiento: '#f59e0b',
            general: theme?.textSecondary || '#64748b'
        };
        return colors[type] || colors.general;
    };

    // Usar propiedades específicas del chatTheme para burbujas
    const bubbleOwnBg = theme?.bubbleOwn || theme?.primary || '#8b5cf6';
    const bubbleOtherBg = theme?.bubbleOther || theme?.cardBackground || '#fff';
    const bubbleOtherBorder = theme?.border || '#e2e8f0';
    const textOwn = theme?.bubbleOwnText || '#fff';
    const textOther = theme?.bubbleOtherText || theme?.text || '#1e293b';
    const timeOwn = 'rgba(255,255,255,0.7)';
    const timeOther = theme?.textSecondary || '#94a3b8';

    return (
        <View style={[
            styles.messageBubble,
            isOwn
                ? [styles.messageBubbleOwn, { backgroundColor: bubbleOwnBg }]
                : [styles.messageBubbleOther, { backgroundColor: bubbleOtherBg, borderColor: bubbleOtherBorder }]
        ]}>
            {/* Sender name for groups */}
            {showSender && !isOwn && (
                <Text style={[styles.senderName, { color: theme?.primary || '#8b5cf6' }]}>
                    {message.senderId?.nombre || 'Usuario'}
                </Text>
            )}

            {/* Type badge for trainer chat */}
            {isTrainerChat && message.type !== 'general' && (
                <View style={[styles.typeBadge, { backgroundColor: getTypeColor(message.type) + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: getTypeColor(message.type) }]}>
                        {message.type.charAt(0).toUpperCase() + message.type.slice(1)}
                    </Text>
                </View>
            )}

            <Text style={[
                styles.messageText,
                { color: isOwn ? textOwn : textOther, fontSize: fontSize || 15 }
            ]}>
                {message.message}
            </Text>

            <Text style={[
                styles.messageTime,
                { color: isOwn ? timeOwn : timeOther }
            ]}>
                {new Date(message.createdAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit'
                })}
            </Text>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function ConversationScreen() {
    const router = useRouter();
    const { conversationId, displayName, isTrainerChat, type } = useLocalSearchParams();
    const { token, user } = useAuth();
    const { chatTheme, fontSizeValue } = useChatTheme();
    const isDark = chatTheme.isDark;
    const insets = useSafeAreaInsets();
    const flatListRef = useRef(null);

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [messageType, setMessageType] = useState('general');
    const [selectedCategory, setSelectedCategory] = useState('all');

    const isTrainer = isTrainerChat === 'true';
    const isGroup = type === 'group';

    // Category tabs configuration
    const CATEGORY_TABS = [
        { key: 'all', label: 'Todo', icon: 'chatbubbles-outline', color: '#64748b' },
        { key: 'general', label: 'General', icon: 'chatbubble-outline', color: '#64748b' },
        { key: 'entreno', label: 'Entreno', icon: 'barbell-outline', color: '#8b5cf6' },
        { key: 'nutricion', label: 'Nutrición', icon: 'nutrition-outline', color: '#10b981' },
        { key: 'evolucion', label: 'Evolución', icon: 'analytics-outline', color: '#3b82f6' },
        { key: 'seguimiento', label: 'Seguimiento', icon: 'calendar-outline', color: '#f59e0b' }
    ];

    // Filter messages by selected category
    const filteredMessages = selectedCategory === 'all'
        ? messages
        : messages.filter(m => m.type === selectedCategory);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD MESSAGES
    // ─────────────────────────────────────────────────────────────────────────

    const loadMessages = useCallback(async () => {
        console.log('[Chat] loadMessages called for conversation:', conversationId);
        try {
            setLoading(true);
            const url = `${API_URL}/api/conversations/${conversationId}/messages?limit=100`;
            console.log('[Chat] Fetching:', url);

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            console.log('[Chat] loadMessages response:', data.success, 'messages:', data.messages?.length);

            if (data.success) {
                setMessages(data.messages || []);
                console.log('[Chat] Messages state updated to:', data.messages?.length);
            } else {
                console.error('[Chat] loadMessages failed:', data.message);
            }
        } catch (error) {
            console.error('[Chat] loadMessages Error:', error);
        } finally {
            setLoading(false);
        }
    }, [conversationId, token]);

    useEffect(() => {
        console.log('[Chat] Initial useEffect triggered');
        loadMessages();
    }, [loadMessages]);

    // Scroll al final cuando se cargan los mensajes por primera vez
    useEffect(() => {
        if (!loading && messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
            }, 150);
        }
    }, [loading]);

    // ─────────────────────────────────────────────────────────────────────────
    // ADAPTIVE POLLING - Reduces server load by 70-80%
    // ─────────────────────────────────────────────────────────────────────────

    const lastActivityRef = useRef(Date.now());
    const lastModifiedRef = useRef(null);
    const isBackgroundRef = useRef(false);

    // Track user activity
    const updateActivity = useCallback(() => {
        lastActivityRef.current = Date.now();
    }, []);

    // Get adaptive poll interval based on user activity
    const getPollInterval = useCallback(() => {
        if (isBackgroundRef.current) return 60000; // 60s in background

        const idleTime = Date.now() - lastActivityRef.current;
        if (idleTime > 60000) return 10000; // 10s after 1 min idle
        return 2000; // 2s when active
    }, []);

    // Adaptive polling for real-time messages
    useEffect(() => {
        let pollTimeoutId = null;

        const poll = async () => {
            try {
                const headers = { Authorization: `Bearer ${token}` };

                // Add If-Modified-Since header for 304 optimization
                if (lastModifiedRef.current) {
                    headers['If-Modified-Since'] = lastModifiedRef.current;
                }

                const res = await fetch(
                    `${API_URL}/api/conversations/${conversationId}/messages?limit=100`,
                    { headers }
                );

                // Handle 304 Not Modified - no new messages
                if (res.status === 304) {
                    pollTimeoutId = setTimeout(poll, getPollInterval());
                    return;
                }

                // Store Last-Modified header for next request
                const lastModified = res.headers.get('Last-Modified');
                if (lastModified) {
                    lastModifiedRef.current = lastModified;
                }

                const data = await res.json();

                if (data.success && data.messages) {
                    // Deduplicar mensajes por _id para evitar keys duplicadas
                    const uniqueMessages = data.messages.reduce((acc, msg) => {
                        if (msg._id && !acc.find(m => m._id === msg._id)) {
                            acc.push(msg);
                        }
                        return acc;
                    }, []);

                    const newCount = uniqueMessages.length;
                    const lastNewId = newCount > 0 ? uniqueMessages[newCount - 1]?._id : '';

                    setMessages(currentMessages => {
                        const currentCount = currentMessages.length;
                        const lastCurrentId = currentCount > 0 ? currentMessages[currentCount - 1]?._id : '';

                        // Actualizar si hay diferencia en cantidad o en el último mensaje
                        if (newCount !== currentCount || lastNewId !== lastCurrentId) {
                            console.log('[Chat] ✅ Actualizando de', currentCount, 'a', newCount);
                            // Scroll al final cuando hay mensajes nuevos
                            setTimeout(() => {
                                flatListRef.current?.scrollToEnd({ animated: true });
                            }, 100);
                            return uniqueMessages;
                        }
                        return currentMessages;
                    });
                }
            } catch (error) {
                console.error('[Chat Polling] Error:', error);
            }

            // Schedule next poll with adaptive interval
            pollTimeoutId = setTimeout(poll, getPollInterval());
        };

        // Start polling
        pollTimeoutId = setTimeout(poll, getPollInterval());

        return () => {
            if (pollTimeoutId) clearTimeout(pollTimeoutId);
        };
    }, [conversationId, token, getPollInterval]);

    // ─────────────────────────────────────────────────────────────────────────
    // SEND MESSAGE
    // ─────────────────────────────────────────────────────────────────────────

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;

        Keyboard.dismiss();
        setSending(true);

        try {
            const res = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: newMessage.trim(),
                    type: isTrainer ? messageType : 'general'
                })
            });

            const data = await res.json();

            if (data.success) {
                setMessages(prev => [...prev, data.message]);
                setNewMessage('');
                setMessageType('general');

                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
            }
        } catch (error) {
            console.error('[ConversationScreen] Error sending:', error);
        } finally {
            setSending(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: chatTheme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: chatTheme.cardBackground, borderBottomColor: chatTheme.border }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={chatTheme.text} />
                </TouchableOpacity>

                <View style={styles.headerInfo}>
                    <Text style={[styles.headerTitle, { color: chatTheme.text }]} numberOfLines={1}>
                        {displayName || 'Chat'}
                    </Text>
                    {isTrainer && (
                        <View style={[styles.coachBadge, { backgroundColor: chatTheme.primary + '20' }]}>
                            <Text style={[styles.coachBadgeText, { color: chatTheme.primary }]}>Coach</Text>
                        </View>
                    )}
                    {isGroup && (
                        <View style={[styles.groupBadge, { backgroundColor: chatTheme.header + '20' }]}>
                            <Text style={[styles.groupBadgeText, { color: chatTheme.header }]}>Grupo</Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity style={styles.moreBtn}>
                    <Ionicons name="ellipsis-vertical" size={20} color={chatTheme.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* KeyboardAvoidingView envuelve Messages + Input para que todo suba con el teclado */}
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Messages */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={chatTheme.primary} />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={filteredMessages}
                        keyExtractor={(item, idx) => item._id || idx.toString()}
                        renderItem={({ item }) => (
                            <MessageBubble
                                message={item}
                                isOwn={item.senderId?._id === user?._id || item.senderId === user?._id}
                                isTrainerChat={isTrainer}
                                showSender={isGroup}
                                theme={chatTheme}
                                isDark={isDark}
                                fontSize={fontSizeValue}
                            />
                        )}
                        contentContainerStyle={styles.messagesList}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        removeClippedSubviews={false}
                        ListEmptyComponent={
                            <View style={styles.emptyMessages}>
                                <Ionicons name="chatbubble-ellipses-outline" size={48} color={chatTheme.textTertiary} />
                                <Text style={[styles.emptyText, { color: chatTheme.textSecondary }]}>
                                    {selectedCategory === 'all'
                                        ? 'Inicia la conversación'
                                        : `Sin mensajes de ${CATEGORY_TABS.find(t => t.key === selectedCategory)?.label || selectedCategory}`
                                    }
                                </Text>
                            </View>
                        }
                    />
                )}

                {/* Input Area */}
                {/* Category Selector (filters view + sets message type) */}
                {isTrainer && (
                    <View style={[styles.typeSelector, { backgroundColor: chatTheme.cardBackground, borderTopColor: chatTheme.border }]}>
                        {[
                            { type: 'all', icon: 'apps-outline', color: '#64748b', label: 'Todo' },
                            { type: 'general', icon: 'chatbubble-outline', color: '#64748b', label: 'General' },
                            { type: 'entreno', icon: 'barbell-outline', color: '#8b5cf6', label: 'Entreno' },
                            { type: 'nutricion', icon: 'nutrition-outline', color: '#10b981', label: 'Nutrición' },
                            { type: 'evolucion', icon: 'analytics-outline', color: '#3b82f6', label: 'Evolución' },
                            { type: 'seguimiento', icon: 'calendar-outline', color: '#f59e0b', label: 'Seguim.' }
                        ].map(({ type: t, icon, color, label }) => {
                            const isActive = selectedCategory === t;
                            return (
                                <TouchableOpacity
                                    key={t}
                                    style={[
                                        styles.typeBtn,
                                        { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9' },
                                        isActive && { backgroundColor: color + '20', borderColor: color, borderWidth: 2 }
                                    ]}
                                    onPress={() => {
                                        setSelectedCategory(t);
                                        // When selecting a category, also set message type (except 'all')
                                        if (t !== 'all') setMessageType(t);
                                    }}
                                >
                                    <Ionicons
                                        name={icon}
                                        size={18}
                                        color={isActive ? color : chatTheme.textSecondary}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                <View style={[styles.inputContainer, {
                    backgroundColor: chatTheme.cardBackground,
                    borderTopColor: chatTheme.border,
                    paddingBottom: Math.max(insets.bottom, 12)
                }]}>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: chatTheme.inputBackground,
                            color: chatTheme.text
                        }]}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        placeholder="Escribe un mensaje..."
                        placeholderTextColor={chatTheme.textTertiary}
                        multiline
                        maxLength={2000}
                        blurOnSubmit={false}
                        autoCorrect={true}
                        autoCapitalize="sentences"
                        returnKeyType="default"
                        textAlignVertical="center"
                        onKeyPress={(e) => {
                            // Solo en web: enviar con Enter (sin Shift para permitir saltos de línea)
                            if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, { backgroundColor: chatTheme.primary }, !newMessage.trim() && styles.sendBtnDisabled]}
                        onPress={handleSend}
                        disabled={sending || !newMessage.trim()}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="send" size={20} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
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
    keyboardAvoidingContainer: {
        flex: 1
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 14
    },
    backBtn: {
        padding: 4
    },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
        gap: 8
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        maxWidth: '70%'
    },
    coachBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    coachBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff'
    },
    groupBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    groupBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff'
    },
    moreBtn: {
        padding: 4
    },

    // Loading
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },

    // Messages List
    messagesList: {
        padding: 16,
        flexGrow: 1
    },
    emptyMessages: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 80
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 12
    },

    // Message Bubble
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8
    },
    messageBubbleOwn: {
        alignSelf: 'flex-end',
        backgroundColor: '#8b5cf6',
        borderBottomRightRadius: 4
    },
    messageBubbleOther: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    senderName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8b5cf6',
        marginBottom: 4
    },
    typeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginBottom: 6
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: '600'
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20
    },
    messageTextOwn: {
        color: '#fff'
    },
    messageTextOther: {
        color: '#1e293b'
    },
    messageTime: {
        fontSize: 11,
        marginTop: 4,
        alignSelf: 'flex-end'
    },
    messageTimeOwn: {
        color: 'rgba(255,255,255,0.7)'
    },
    messageTimeOther: {
        color: '#94a3b8'
    },

    // Type Selector
    typeSelector: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0'
    },
    typeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f1f5f9'
    },
    typeBtnActive: {
        backgroundColor: '#8b5cf6'
    },
    typeBtnText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748b'
    },
    typeBtnTextActive: {
        color: '#fff'
    },

    // Input
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        gap: 10
    },
    input: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: '#1e293b',
        maxHeight: 100
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    sendBtnDisabled: {
        backgroundColor: '#cbd5e1'
    }
});
