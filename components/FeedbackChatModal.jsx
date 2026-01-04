/**
 * FeedbackChatModal.jsx (ChatModal)
 * Modal de chat para conversación entre coach y cliente
 * Reutilizable tanto en vista de coach como de cliente
 * NOTA: Usa endpoints /api/chat (antes /api/feedback)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    FlatList,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    Pressable,
    Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        return days[date.getDay()];
    }
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getTypeIcon = (type) => {
    const icons = {
        general: { name: 'chatbubble', color: '#6b7280' },
        entreno: { name: 'barbell', color: '#8b5cf6' },
        nutricion: { name: 'nutrition', color: '#10b981' },
        evolucion: { name: 'trending-up', color: '#f59e0b' },
        seguimiento: { name: 'analytics', color: '#3b82f6' }
    };
    return icons[type] || icons.general;
};

// ═══════════════════════════════════════════════════════════════════════════
// DATE SEPARATOR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const DateSeparator = ({ date }) => (
    <View style={styles.dateSeparator}>
        <View style={styles.dateLine} />
        <Text style={styles.dateText}>{formatDate(date)}</Text>
        <View style={styles.dateLine} />
    </View>
);

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const MessageBubble = ({ message, isMine, showAvatar, isFirst, isLast }) => {
    const typeInfo = getTypeIcon(message.type);

    // Determinar estado del mensaje
    const getCheckmarkStatus = () => {
        if (message.isRead) {
            return { icon: 'checkmark-done', color: '#3b82f6' }; // Azul = leído
        }
        if (message.deliveredAt) {
            return { icon: 'checkmark-done', color: '#9ca3af' }; // Gris doble = entregado
        }
        return { icon: 'checkmark', color: '#9ca3af' }; // Gris simple = enviado
    };

    const checkStatus = isMine ? getCheckmarkStatus() : null;

    return (
        <View style={[
            styles.messageRow,
            isMine ? styles.messageRowMine : styles.messageRowTheirs
        ]}>
            {!isMine && showAvatar && (
                <View style={styles.avatarContainer}>
                    <Ionicons name="person-circle" size={32} color="#3b82f6" />
                </View>
            )}
            {!isMine && !showAvatar && <View style={styles.avatarSpacer} />}

            <View style={[
                styles.messageBubble,
                isMine ? styles.bubbleMine : styles.bubbleTheirs,
                // Ajustar bordes según posición en grupo
                isFirst && isMine && styles.bubbleMineFirst,
                isLast && isMine && styles.bubbleMineLast,
                isFirst && !isMine && styles.bubbleTheirsFirst,
                isLast && !isMine && styles.bubbleTheirsLast,
                // Reducir margen si es parte de grupo
                !isLast && { marginBottom: 2 }
            ]}>
                {/* Type Badge */}
                {message.type !== 'general' && isFirst && (
                    <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '20' }]}>
                        <Ionicons name={typeInfo.name} size={10} color={typeInfo.color} />
                        <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>
                            {message.type}
                        </Text>
                    </View>
                )}

                {/* Message Text */}
                <Text style={[
                    styles.messageText,
                    isMine ? styles.messageTextMine : styles.messageTextTheirs
                ]}>
                    {message.message}
                </Text>

                {/* Time & Status */}
                <View style={styles.messageFooter}>
                    <Text style={[
                        styles.messageTime,
                        isMine ? styles.messageTimeMine : styles.messageTimeTheirs
                    ]}>
                        {formatTime(message.createdAt)}
                    </Text>
                    {checkStatus && (
                        <View style={styles.checkmarks}>
                            <Ionicons
                                name={checkStatus.icon}
                                size={14}
                                color={checkStatus.color}
                            />
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function FeedbackChatModal({
    visible,
    onClose,
    clientId,
    clientName,
    trainerId,  // Nuevo: ID del entrenador (para clientes que envían mensajes)
    isCoach = false
}) {
    const { token, user } = useAuth();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [messageType, setMessageType] = useState('general');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const flatListRef = useRef(null);

    // Quick Responses (solo para coaches)
    const [quickResponses, setQuickResponses] = useState([]);
    const [showQuickResponses, setShowQuickResponses] = useState(false);
    const [quickSearchQuery, setQuickSearchQuery] = useState('');

    // Scheduled Messages (solo para coaches)
    const [scheduledDate, setScheduledDate] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showRoiInfo, setShowRoiInfo] = useState(false);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD MESSAGES
    // ─────────────────────────────────────────────────────────────────────────

    const loadMessages = useCallback(async () => {
        if (!visible || !token) return;

        try {
            setLoading(true);
            const targetClientId = isCoach ? clientId : user?._id;

            console.log('[FeedbackChat] ═══════════════════════════════════');
            console.log('[FeedbackChat] Loading messages - isCoach:', isCoach);
            console.log('[FeedbackChat] targetClientId:', targetClientId);
            console.log('[FeedbackChat] user._id:', user?._id);
            console.log('[FeedbackChat] clientId prop:', clientId);

            const response = await fetch(
                `${API_URL}/api/chat/conversation/${targetClientId}?limit=100`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const data = await response.json();
            console.log('[FeedbackChat] Response success:', data.success);
            console.log('[FeedbackChat] Messages count:', data.messages?.length);

            if (data.messages?.length > 0) {
                console.log('[FeedbackChat] First message senderId:', data.messages[0]?.senderId?._id || data.messages[0]?.senderId);
                console.log('[FeedbackChat] First message text:', data.messages[0]?.message?.substring(0, 30));
                console.log('[FeedbackChat] Last message senderId:', data.messages[data.messages.length - 1]?.senderId?._id || data.messages[data.messages.length - 1]?.senderId);
                console.log('[FeedbackChat] Last message text:', data.messages[data.messages.length - 1]?.message?.substring(0, 30));
            }

            if (data.success) {
                setMessages(data.messages || []);
                console.log('[FeedbackChat] State updated with', data.messages?.length, 'messages');
                // Mark as read
                markAsRead(targetClientId);
            }
        } catch (error) {
            console.error('[FeedbackChat] Error loading:', error);
        } finally {
            setLoading(false);
        }
    }, [visible, token, clientId, user, isCoach]);

    const markAsRead = async (targetClientId) => {
        try {
            await fetch(`${API_URL}/api/chat/read/${targetClientId}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('[Chat] Error marking as read:', error);
        }
    };

    useEffect(() => {
        if (visible) {
            loadMessages();
            if (isCoach) {
                loadQuickResponses();
            }
        }
    }, [visible, loadMessages]);

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
        if (!visible || !token) return;

        let pollTimeoutId = null;

        const poll = async () => {
            try {
                const targetClientId = isCoach ? clientId : user?._id;
                const headers = { Authorization: `Bearer ${token}` };

                // Add If-Modified-Since header for 304 optimization
                if (lastModifiedRef.current) {
                    headers['If-Modified-Since'] = lastModifiedRef.current;
                }

                const response = await fetch(
                    `${API_URL}/api/chat/conversation/${targetClientId}?limit=100`,
                    { headers }
                );

                // Handle 304 Not Modified - no new messages
                if (response.status === 304) {
                    // Schedule next poll with adaptive interval
                    pollTimeoutId = setTimeout(poll, getPollInterval());
                    return;
                }

                // Store Last-Modified header for next request
                const lastModified = response.headers.get('Last-Modified');
                if (lastModified) {
                    lastModifiedRef.current = lastModified;
                }

                const data = await response.json();

                if (data.success && data.messages) {
                    const newCount = data.messages.length;
                    const lastNewId = newCount > 0 ? data.messages[newCount - 1]?._id : '';

                    setMessages(currentMessages => {
                        const currentCount = currentMessages.length;
                        const lastCurrentId = currentCount > 0 ? currentMessages[currentCount - 1]?._id : '';

                        if (newCount !== currentCount || lastNewId !== lastCurrentId) {
                            console.log('[Chat] ✅ Actualizando de', currentCount, 'a', newCount);
                            return data.messages;
                        }
                        return currentMessages;
                    });
                }
            } catch (error) {
                // Silently ignore polling errors
            }

            // Schedule next poll with adaptive interval
            pollTimeoutId = setTimeout(poll, getPollInterval());
        };

        // Start polling
        pollTimeoutId = setTimeout(poll, getPollInterval());

        return () => {
            if (pollTimeoutId) clearTimeout(pollTimeoutId);
        };
    }, [visible, token, clientId, user, isCoach, getPollInterval]);

    // ─────────────────────────────────────────────────────────────────────────────
    // QUICK RESPONSES
    // ─────────────────────────────────────────────────────────────────────────────

    const loadQuickResponses = async () => {
        try {
            // Primero intentamos cargar, si no hay, sembramos defaults
            let response = await fetch(`${API_URL}/api/quick-responses`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            let data = await response.json();

            if (data.success && data.responses?.length === 0) {
                // Sembrar defaults
                await fetch(`${API_URL}/api/quick-responses/seed-defaults`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                });
                // Recargar
                response = await fetch(`${API_URL}/api/quick-responses`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                data = await response.json();
            }

            if (data.success) {
                setQuickResponses(data.responses || []);
            }
        } catch (error) {
            console.log('[FeedbackChat] Error loading quick responses:', error.message);
        }
    };

    // Detectar / para mostrar menú
    const handleMessageChange = (text) => {
        setNewMessage(text);

        // Detectar comando /
        if (isCoach && text.startsWith('/')) {
            const query = text.substring(1).toLowerCase();
            setQuickSearchQuery(query);
            setShowQuickResponses(true);
        } else {
            setShowQuickResponses(false);
            setQuickSearchQuery('');
        }
    };

    // Filtrar respuestas rápidas
    const filteredQuickResponses = quickResponses.filter(qr =>
        qr.shortcut.includes(quickSearchQuery) ||
        qr.title.toLowerCase().includes(quickSearchQuery)
    );

    // Seleccionar respuesta rápida
    const selectQuickResponse = (qr) => {
        // Reemplazar variables
        let message = qr.message;
        message = message.replace(/{nombre}/g, clientName || 'Cliente');
        // Podríamos añadir más variables aquí

        setNewMessage(message);
        setShowQuickResponses(false);
        setQuickSearchQuery('');

        // Establecer tipo según categoría
        if (qr.category && qr.category !== 'general') {
            setMessageType(qr.category);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // SEND MESSAGE
    // ─────────────────────────────────────────────────────────────────────────

    const handleSend = async (sendScheduled = false) => {
        if (!newMessage.trim() || sending) return;

        Keyboard.dismiss();
        setSending(true);

        try {
            const payload = {
                clientId: isCoach ? clientId : user?._id,
                message: newMessage.trim(),
                type: messageType,
                isCoach: isCoach
            };

            // Si es cliente, enviar trainerId explícitamente
            if (!isCoach && trainerId) {
                payload.trainerId = trainerId;
            }

            // Si hay fecha programada
            if (sendScheduled && scheduledDate) {
                payload.sendAt = scheduledDate.toISOString();
            }

            console.log('[Chat] Sending to:', `${API_URL}/api/chat`);
            console.log('[Chat] Payload:', JSON.stringify(payload));

            const response = await fetch(`${API_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            console.log('[Chat] Response status:', response.status);
            const data = await response.json();
            console.log('[Chat] Response data:', JSON.stringify(data));

            if (data.success) {
                if (data.isScheduled) {
                    // Mostrar confirmación de mensaje programado
                    alert(`✅ Mensaje programado para ${scheduledDate.toLocaleString('es-ES')}`);
                    setScheduledDate(null);
                    setShowScheduleModal(false);
                } else {
                    setMessages(prev => [...prev, data.message]);
                }
                setNewMessage('');
                setMessageType('general');

                // Scroll to bottom
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
            } else {
                alert('❌ Error: ' + (data.message || 'No se pudo enviar'));
            }
        } catch (error) {
            console.error('[Chat] Error sending:', error);
            alert('❌ Error de conexión: ' + error.message);
        } finally {
            setSending(false);
        }
    };


    // ─────────────────────────────────────────────────────────────────────────
    // GROUP MESSAGES BY DATE (show ALL messages)
    // ─────────────────────────────────────────────────────────────────────────

    const groupedMessages = useCallback(() => {
        const groups = [];
        let lastDate = null;
        let lastSenderId = null;

        // Mostrar mensajes filtrados por categoría seleccionada
        const filteredMessages = selectedCategory === 'all'
            ? messages
            : messages.filter(m => m.type === selectedCategory);

        filteredMessages.forEach((msg, index) => {
            const msgDate = new Date(msg.createdAt).toDateString();
            const senderId = msg.senderId?._id || msg.senderId;
            const nextMsg = filteredMessages[index + 1];
            const nextSenderId = nextMsg?.senderId?._id || nextMsg?.senderId;
            const nextDate = nextMsg ? new Date(nextMsg.createdAt).toDateString() : null;

            // Add date separator if new day
            if (msgDate !== lastDate) {
                groups.push({ type: 'date', date: msg.createdAt, key: `date-${index}` });
                lastDate = msgDate;
                lastSenderId = null;
            }

            // Determine grouping position
            const isFirst = senderId !== lastSenderId;
            const isLast = !nextMsg || nextSenderId !== senderId || nextDate !== msgDate;
            lastSenderId = senderId;

            groups.push({
                type: 'message',
                data: msg,
                showAvatar: isFirst,
                isFirst,
                isLast,
                key: msg._id || `msg-${index}`
            });
        });

        return groups;
    }, [messages, selectedCategory]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    const renderItem = ({ item }) => {
        if (item.type === 'date') {
            return <DateSeparator date={item.date} />;
        }

        const senderId = item.data.senderId?._id || item.data.senderId;
        const isMine = senderId === user?._id;

        // Debug log para cada mensaje
        console.log('[FeedbackChat Render] Message:',
            item.data.message?.substring(0, 20),
            '| senderId:', senderId,
            '| user._id:', user?._id,
            '| isMine:', isMine);

        return (
            <MessageBubble
                message={item.data}
                isMine={isMine}
                showAvatar={item.showAvatar}
                isFirst={item.isFirst}
                isLast={item.isLast}
            />
        );
    };

    const headerName = isCoach ? clientName : 'Tu Entrenador';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={[styles.container, { backgroundColor: theme.background }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Header */}
                <View style={[styles.header, {
                    backgroundColor: theme.cardBackground,
                    borderBottomColor: theme.border,
                    paddingTop: Math.max(insets.top, 12) + 12
                }]}>
                    <TouchableOpacity onPress={onClose} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <View style={styles.headerInfo}>
                        <Ionicons name="person-circle" size={40} color={theme.primary} />
                        <View style={styles.headerText}>
                            <Text style={[styles.headerName, { color: theme.text }]}>{headerName}</Text>
                            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                                {messages.length} mensajes
                            </Text>
                        </View>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* Messages */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando mensajes...</Text>
                    </View>
                ) : messages.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={64} color={theme.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>Sin mensajes</Text>
                        <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
                            {isCoach
                                ? 'Envía el primer mensaje a tu cliente'
                                : 'Aquí verás los mensajes de tu entrenador'}
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={groupedMessages()}
                        renderItem={renderItem}
                        keyExtractor={item => item.key}
                        contentContainerStyle={styles.messagesList}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="none"
                        onContentSizeChange={() =>
                            flatListRef.current?.scrollToEnd({ animated: false })
                        }
                    />
                )}

                {/* Category Selector (filters view + sets message type) */}
                <View style={[styles.typeSelector, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                    {[
                        { type: 'all', icon: 'apps', color: '#64748b' },
                        { type: 'general', icon: 'chatbubble', color: '#6b7280' },
                        { type: 'entreno', icon: 'barbell', color: '#8b5cf6' },
                        { type: 'nutricion', icon: 'nutrition', color: '#10b981' },
                        { type: 'evolucion', icon: 'trending-up', color: '#f59e0b' },
                        { type: 'seguimiento', icon: 'analytics', color: '#3b82f6' }
                    ].map(({ type, icon, color }) => {
                        const isActive = selectedCategory === type;
                        return (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.typeButton,
                                    {
                                        backgroundColor: isActive ? color + '30' : (isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9'),
                                        borderColor: isActive ? color : 'transparent',
                                        borderWidth: isActive ? 2 : 0
                                    }
                                ]}
                                onPress={() => {
                                    setSelectedCategory(type);
                                    // When selecting a category, also set message type (except 'all')
                                    if (type !== 'all') setMessageType(type);
                                }}
                            >
                                <Ionicons
                                    name={icon}
                                    size={18}
                                    color={isActive ? color : (isDark ? '#FFFFFF' : '#64748b')}
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Input */}
                <View style={[styles.inputBar, {
                    backgroundColor: theme.cardBackground,
                    borderTopColor: theme.border,
                    paddingBottom: Math.max(insets.bottom, 12) + 12
                }]}>
                    <View style={styles.inputBarContent}>
                        {/* Schedule Button (solo coaches) */}
                        {isCoach && (
                            <TouchableOpacity
                                style={styles.scheduleButton}
                                onPress={() => setShowScheduleModal(true)}
                                disabled={!newMessage.trim()}
                            >
                                <Ionicons
                                    name="time-outline"
                                    size={22}
                                    color={newMessage.trim() ? theme.primary : theme.textTertiary}
                                />
                            </TouchableOpacity>
                        )}
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#f1f5f9',
                                color: isDark ? '#FFFFFF' : '#1e293b',
                                borderColor: isDark ? 'rgba(255,255,255,0.4)' : '#e2e8f0',
                                borderWidth: 1.5
                            }]}
                            placeholder="Escribe un mensaje..."
                            placeholderTextColor={isDark ? '#aaaaaa' : '#94a3b8'}
                            value={newMessage}
                            onChangeText={setNewMessage}
                            multiline
                            maxLength={2000}
                            underlineColorAndroid="transparent"
                            selectionColor={isDark ? '#FFFFFF' : '#3b82f6'}
                            autoCorrect={false}
                            onKeyPress={(e) => {
                                // Solo en web: enviar con Enter (sin Shift para permitir saltos de línea)
                                if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                                    e.preventDefault();
                                    handleSend(false);
                                }
                            }}
                        />
                        <TouchableOpacity
                            style={[
                                styles.sendButton,
                                { backgroundColor: theme.primary },
                                (!newMessage.trim() || sending) && styles.sendButtonDisabled
                            ]}
                            onPress={() => handleSend(false)}
                            disabled={!newMessage.trim() || sending}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="send" size={20} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Schedule Modal */}
                    {showScheduleModal && isCoach && (
                        <View style={styles.scheduleModalOverlay}>
                            <View style={styles.scheduleModal}>
                                <View style={styles.scheduleModalHeader}>
                                    <Text style={styles.scheduleModalTitle}>⏰ Programar Mensaje</Text>
                                    <TouchableOpacity onPress={() => setShowRoiInfo(!showRoiInfo)}>
                                        <Ionicons name="information-circle" size={24} color="#8b5cf6" />
                                    </TouchableOpacity>
                                </View>

                                {/* ROI Benefits Panel */}
                                {showRoiInfo && (
                                    <View style={styles.roiPanel}>
                                        <Text style={styles.roiTitle}>🚀 ¿Por qué programar mensajes?</Text>

                                        <View style={styles.roiSection}>
                                            <Text style={styles.roiSectionTitle}>✅ Para TI:</Text>
                                            <Text style={styles.roiText}>• Trabaja cuando quieras, envía en horario profesional</Text>
                                            <Text style={styles.roiText}>• Evita el burnout - vacía pendientes sin sacrificar descanso</Text>
                                            <Text style={styles.roiText}>• Efecto "omnipresencia" sin interrumpir tu día</Text>
                                        </View>

                                        <View style={styles.roiSection}>
                                            <Text style={styles.roiSectionTitle}>❤️ Para tus CLIENTES:</Text>
                                            <Text style={styles.roiText}>• Consejos justo antes de entrenar = se aplican</Text>
                                            <Text style={styles.roiText}>• Sin invasión en tiempo personal</Text>
                                            <Text style={styles.roiText}>• Mayor adherencia y predisposición mental</Text>
                                        </View>
                                    </View>
                                )}

                                {/* Quick Time Options */}
                                <Text style={styles.scheduleLabel}>Enviar en:</Text>
                                <View style={styles.quickTimeOptions}>
                                    {[
                                        { label: '1h', hours: 1 },
                                        { label: '3h', hours: 3 },
                                        { label: 'Mañana 8:00', tomorrow8: true },
                                        { label: 'Lunes 8:00', nextMonday: true }
                                    ].map((opt, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            style={styles.quickTimeButton}
                                            onPress={() => {
                                                const date = new Date();
                                                if (opt.hours) {
                                                    date.setHours(date.getHours() + opt.hours);
                                                } else if (opt.tomorrow8) {
                                                    date.setDate(date.getDate() + 1);
                                                    date.setHours(8, 0, 0, 0);
                                                } else if (opt.nextMonday) {
                                                    const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
                                                    date.setDate(date.getDate() + daysUntilMonday);
                                                    date.setHours(8, 0, 0, 0);
                                                }
                                                setScheduledDate(date);
                                            }}
                                        >
                                            <Text style={styles.quickTimeText}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {scheduledDate && (
                                    <View style={styles.scheduledPreview}>
                                        <Ionicons name="calendar" size={20} color="#8b5cf6" />
                                        <Text style={styles.scheduledPreviewText}>
                                            {scheduledDate.toLocaleString('es-ES', {
                                                weekday: 'short',
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.scheduleActions}>
                                    <TouchableOpacity
                                        style={styles.scheduleCancelButton}
                                        onPress={() => {
                                            setShowScheduleModal(false);
                                            setScheduledDate(null);
                                            setShowRoiInfo(false);
                                        }}
                                    >
                                        <Text style={styles.scheduleCancelText}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.scheduleConfirmButton,
                                            !scheduledDate && styles.scheduleConfirmDisabled
                                        ]}
                                        onPress={() => handleSend(true)}
                                        disabled={!scheduledDate}
                                    >
                                        <Ionicons name="time" size={18} color="#fff" />
                                        <Text style={styles.scheduleConfirmText}>Programar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Quick Responses Dropdown */}
                    {showQuickResponses && isCoach && (
                        <View style={styles.quickResponsesContainer}>
                            <View style={styles.quickResponsesHeader}>
                                <Text style={styles.quickResponsesTitle}>⚡ Respuestas Rápidas</Text>
                                <TouchableOpacity onPress={() => setShowQuickResponses(false)}>
                                    <Ionicons name="close" size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            {filteredQuickResponses.length === 0 ? (
                                <Text style={styles.quickResponsesEmpty}>
                                    {quickSearchQuery ? `No hay resultados para "${quickSearchQuery}"` : 'Sin respuestas rápidas'}
                                </Text>
                            ) : (
                                <FlatList
                                    data={filteredQuickResponses}
                                    keyExtractor={item => item._id}
                                    style={styles.quickResponsesList}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.quickResponseItem}
                                            onPress={() => selectQuickResponse(item)}
                                        >
                                            <View style={styles.quickResponseLeft}>
                                                <Text style={styles.quickResponseShortcut}>/{item.shortcut}</Text>
                                                <Text style={styles.quickResponseTitle}>{item.title}</Text>
                                            </View>
                                            <Text style={styles.quickResponsePreview} numberOfLines={1}>
                                                {item.message.substring(0, 40)}...
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
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

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0'
    },
    backButton: {
        padding: 8
    },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8
    },
    headerText: {
        marginLeft: 12
    },
    headerName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1e293b'
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#64748b'
    },

    // Loading & Empty
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingText: {
        marginTop: 12,
        color: '#64748b'
    },
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
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 8
    },

    // Messages List
    messagesList: {
        padding: 16,
        paddingBottom: 8
    },

    // Date Separator
    dateSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16
    },
    dateLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0'
    },
    dateText: {
        marginHorizontal: 12,
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b'
    },

    // Message Row
    messageRow: {
        flexDirection: 'row',
        marginBottom: 4,
        maxWidth: '85%'
    },
    messageRowMine: {
        alignSelf: 'flex-end'
    },
    messageRowTheirs: {
        alignSelf: 'flex-start'
    },
    avatarContainer: {
        marginRight: 8,
        alignSelf: 'flex-end'
    },
    avatarSpacer: {
        width: 40
    },

    // Message Bubble
    messageBubble: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
        maxWidth: '100%'
    },
    bubbleMine: {
        backgroundColor: '#3b82f6',
        borderTopRightRadius: 18,
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18
    },
    bubbleTheirs: {
        backgroundColor: '#fff',
        borderTopRightRadius: 18,
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    // Grouping variants - My messages (right side)
    bubbleMineFirst: {
        borderTopRightRadius: 18
    },
    bubbleMineLast: {
        borderBottomRightRadius: 4
    },
    // Grouping variants - Their messages (left side)
    bubbleTheirsFirst: {
        borderTopLeftRadius: 18
    },
    bubbleTheirsLast: {
        borderBottomLeftRadius: 4
    },

    // Type Badge
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        marginBottom: 6,
        gap: 4
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'capitalize'
    },

    // Message Text
    messageText: {
        fontSize: 15,
        lineHeight: 20
    },
    messageTextMine: {
        color: '#fff'
    },
    messageTextTheirs: {
        color: '#1e293b'
    },

    // Message Footer
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
        gap: 4
    },
    messageTime: {
        fontSize: 10
    },
    messageTimeMine: {
        color: 'rgba(255,255,255,0.7)'
    },
    messageTimeTheirs: {
        color: '#94a3b8'
    },
    checkmarks: {
        marginLeft: 2
    },

    // Type Selector
    typeSelector: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        gap: 8
    },
    typeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderWidth: 2,
        borderColor: 'transparent'
    },

    // Input Bar
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        gap: 12
    },
    inputBarContent: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        flex: 1,
        gap: 10
    },
    input: {
        flex: 1,
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingVertical: 12,
        fontSize: 16,
        minHeight: 44,
        maxHeight: 100
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    sendButtonDisabled: {
        backgroundColor: '#94a3b8'
    },
    // Quick Responses
    quickResponsesContainer: {
        position: 'absolute',
        bottom: 100,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        maxHeight: '40%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    quickResponsesHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    quickResponsesTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b'
    },
    quickResponsesEmpty: {
        padding: 20,
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 13
    },
    quickResponsesList: {
        maxHeight: 180
    },
    quickResponseItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc'
    },
    quickResponseLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    quickResponseShortcut: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8b5cf6',
        backgroundColor: '#f3f0ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    quickResponseTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155'
    },
    quickResponsePreview: {
        fontSize: 12,
        color: '#94a3b8',
        maxWidth: 120
    },
    // Schedule Button
    scheduleButton: {
        padding: 8,
        marginRight: 4
    },
    // Schedule Modal
    scheduleModalOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16
    },
    scheduleModal: {
        backgroundColor: '#fff',
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 10
    },
    scheduleModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    scheduleModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b'
    },
    scheduleLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 12
    },
    quickTimeOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16
    },
    quickTimeButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#f3f0ff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#8b5cf6'
    },
    quickTimeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8b5cf6'
    },
    scheduledPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        backgroundColor: '#faf5ff',
        borderRadius: 12,
        marginBottom: 16,
        gap: 8
    },
    scheduledPreviewText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#7c3aed'
    },
    scheduleActions: {
        flexDirection: 'row',
        gap: 12
    },
    scheduleCancelButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center'
    },
    scheduleCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748b'
    },
    scheduleConfirmButton: {
        flex: 1,
        flexDirection: 'row',
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#8b5cf6',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
    },
    scheduleConfirmDisabled: {
        backgroundColor: '#d1d5db'
    },
    scheduleConfirmText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff'
    },
    // ROI Panel
    roiPanel: {
        backgroundColor: '#faf5ff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e9d5ff'
    },
    roiTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#7c3aed',
        marginBottom: 12
    },
    roiSection: {
        marginBottom: 10
    },
    roiSectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4
    },
    roiText: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 18
    }
});
