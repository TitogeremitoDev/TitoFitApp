/**
 * chat/index.jsx - Pantalla Principal de Chat Social
 * Lista de conversaciones con entrenador primero, amigos y grupos
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    ActivityIndicator,
    Modal,
    Animated,
    Dimensions,
    Alert,
    Vibration,
    Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useChatTheme } from '../../../context/ChatThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
// Componentes mejorados para iOS
import {
    EnhancedTouchable as TouchableOpacity,
    EnhancedTextInput as TextInput,
} from '../../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════
// TOAST COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Toast = ({ visible, message, type = 'success', onHide }) => {
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true
                })
            ]).start();

            // Auto hide after 3 seconds
            const timer = setTimeout(() => {
                hideToast();
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [visible]);

    const hideToast = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true
            })
        ]).start(() => onHide?.());
    };

    if (!visible) return null;

    const colors = {
        success: { bg: '#22c55e', icon: 'checkmark-circle' },
        error: { bg: '#ef4444', icon: 'close-circle' },
        warning: { bg: '#f59e0b', icon: 'warning' },
        info: { bg: '#3b82f6', icon: 'information-circle' }
    };

    const config = colors[type] || colors.success;

    return (
        <Animated.View
            style={[
                styles.toastContainer,
                {
                    transform: [{ translateY }],
                    opacity,
                    backgroundColor: config.bg
                }
            ]}
        >
            <Ionicons name={config.icon} size={22} color="#fff" />
            <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// ADD CONTACT MODAL
// ═══════════════════════════════════════════════════════════════════════════

const AddContactModal = ({ visible, onClose, token, onContactAdded, chatTheme, showToast, friendsVersion }) => {
    const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'code' | 'username'
    const [code, setCode] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchResult, setSearchResult] = useState(null);
    const [usernameResults, setUsernameResults] = useState([]);
    const [error, setError] = useState('');

    // 🎯 Nuevos estados para mostrar amigos existentes
    const [myContacts, setMyContacts] = useState([]);
    const [loadingContacts, setLoadingContacts] = useState(false);

    // Cargar contactos existentes cuando se abre el modal o cambia friendsVersion
    useEffect(() => {
        if (visible) {
            loadMyContacts();
        }
    }, [visible, friendsVersion]);

    // Función para cargar contactos existentes
    const loadMyContacts = async () => {
        setLoadingContacts(true);
        try {
            const res = await fetch(`${API_URL}/api/contacts?status=accepted`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setMyContacts(data.contacts || []);
            }
        } catch (err) {
            console.error('[AddContactModal] Error loading contacts:', err);
        } finally {
            setLoadingContacts(false);
        }
    };

    // Iniciar chat con un contacto existente
    const startChatWithContact = async (contactId) => {
        setLoading(true);
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
                onContactAdded({ user: { _id: contactId } });
                handleClose();
                showToast?.('¡Chat iniciado!', 'success');
            } else {
                showToast?.(data.message || 'Error al iniciar chat', 'error');
            }
        } catch (err) {
            showToast?.('Error de conexión', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Debounce para búsqueda por username
    useEffect(() => {
        if (activeTab !== 'username' || username.length < 2) {
            setUsernameResults([]);
            return;
        }

        const timer = setTimeout(() => {
            searchByUsername();
        }, 400);

        return () => clearTimeout(timer);
    }, [username]);

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

    const searchByUsername = async () => {
        if (!username || username.length < 2) return;

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_URL}/api/contacts/search-username?q=${username}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setUsernameResults(data.users || []);
            } else {
                setUsernameResults([]);
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const addContactByCode = async () => {
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
                handleClose();
                showToast?.(`¡Genial! @${data.contact?.user?.username || 'usuario'} ha sido añadido a tus contactos`, 'success');
            } else {
                setError(data.message || 'Error al añadir');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const addContactByUsername = async (targetUsername) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/contacts/add-by-username`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: targetUsername })
            });
            const data = await res.json();

            if (data.success) {
                if (data.contact.status === 'accepted') {
                    onContactAdded(data.contact);
                    handleClose();
                    showToast?.(`¡Genial! @${targetUsername} ha sido añadido a tus contactos`, 'success');
                } else {
                    // Solicitud enviada (pending)
                    showToast?.(`Solicitud enviada a @${targetUsername}. Esperando aceptación`, 'info');
                    // Actualizar la lista para reflejar el cambio
                    searchByUsername();
                }
            } else {
                if (data.message?.includes('pendiente')) {
                    showToast?.(`Ya existe una solicitud pendiente para @${targetUsername}`, 'warning');
                } else if (data.message?.includes('bloqueado')) {
                    showToast?.(`No puedes añadir a @${targetUsername}`, 'error');
                } else {
                    showToast?.(data.message || 'Error al añadir', 'error');
                }
            }
        } catch (err) {
            showToast?.('Error de conexión', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setCode('');
        setUsername('');
        setSearchResult(null);
        setUsernameResults([]);
        setError('');
        setActiveTab('code');
        onClose();
    };

    const renderStatusBadge = (user) => {
        if (user.isContact) {
            return (
                <View style={styles.alreadyContactBadge}>
                    <Text style={styles.alreadyContactText}>Amigo</Text>
                </View>
            );
        }
        if (user.contactStatus === 'pending_sent') {
            return (
                <View style={[styles.alreadyContactBadge, { backgroundColor: '#fef3c7' }]}>
                    <Text style={[styles.alreadyContactText, { color: '#d97706' }]}>Pendiente</Text>
                </View>
            );
        }
        if (user.contactStatus === 'pending_received') {
            return (
                <View style={[styles.alreadyContactBadge, { backgroundColor: '#dbeafe' }]}>
                    <Text style={[styles.alreadyContactText, { color: '#2563eb' }]}>Te envió solicitud</Text>
                </View>
            );
        }
        return (
            <TouchableOpacity
                style={styles.addBtn}
                onPress={() => addContactByUsername(user.username)}
                disabled={loading}
            >
                <Ionicons name="person-add" size={16} color="#fff" />
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Nuevo Chat</Text>
                        <TouchableOpacity onPress={handleClose}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs - 3 opciones */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
                            onPress={() => setActiveTab('friends')}
                        >
                            <Ionicons
                                name="people"
                                size={18}
                                color={activeTab === 'friends' ? '#8b5cf6' : '#94a3b8'}
                            />
                            <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
                                Mis Amigos
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'code' && styles.tabActive]}
                            onPress={() => setActiveTab('code')}
                        >
                            <Ionicons
                                name="qr-code"
                                size={18}
                                color={activeTab === 'code' ? '#8b5cf6' : '#94a3b8'}
                            />
                            <Text style={[styles.tabText, activeTab === 'code' && styles.tabTextActive]}>
                                Por Código
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'username' && styles.tabActive]}
                            onPress={() => setActiveTab('username')}
                        >
                            <Ionicons
                                name="at"
                                size={18}
                                color={activeTab === 'username' ? '#8b5cf6' : '#94a3b8'}
                            />
                            <Text style={[styles.tabText, activeTab === 'username' && styles.tabTextActive]}>
                                Buscar
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tab Content */}
                    {activeTab === 'friends' ? (
                        <>
                            <Text style={styles.modalSubtitle}>
                                Tus amigos disponibles para chatear
                            </Text>
                            {loadingContacts ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color="#8b5cf6" />
                                </View>
                            ) : myContacts.length === 0 ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Ionicons name="people-outline" size={48} color="#94a3b8" />
                                    <Text style={[styles.noResultsText, { marginTop: 12 }]}>
                                        No tienes amigos aún
                                    </Text>
                                    <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                                        Añade amigos por código o username
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.usernameResultsContainer}>
                                    {myContacts.map((contact) => (
                                        <TouchableOpacity
                                            key={contact._id}
                                            style={styles.usernameResultItem}
                                            onPress={() => startChatWithContact(contact.user?._id)}
                                            disabled={loading}
                                        >
                                            <View style={styles.resultAvatar}>
                                                <Text style={styles.resultAvatarText}>
                                                    {contact.user?.nombre?.charAt(0)?.toUpperCase() || '?'}
                                                </Text>
                                            </View>
                                            <View style={styles.resultInfo}>
                                                <Text style={styles.resultName}>{contact.user?.nombre || 'Usuario'}</Text>
                                                {contact.user?.username && (
                                                    <Text style={styles.resultUsername}>@{contact.user.username}</Text>
                                                )}
                                            </View>
                                            <TouchableOpacity
                                                style={styles.addBtn}
                                                onPress={() => startChatWithContact(contact.user?._id)}
                                                disabled={loading}
                                            >
                                                <Ionicons name="chatbubble" size={16} color="#fff" />
                                            </TouchableOpacity>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </>
                    ) : activeTab === 'code' ? (
                        <>
                            <Text style={styles.modalSubtitle}>
                                Introduce el código de referido de tu amigo
                            </Text>
                            <View style={styles.codeInputContainer}>
                                <TextInput
                                    style={styles.codeInput}
                                    value={code}
                                    onChangeText={setCode}
                                    placeholder="TOTALGAIN8B783"
                                    placeholderTextColor="#3b82f680"
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

                            {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
                                            onPress={addContactByCode}
                                            disabled={loading}
                                        >
                                            <Ionicons name="person-add" size={18} color="#fff" />
                                            <Text style={styles.addBtnText}>Añadir</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </>
                    ) : (
                        <>
                            <Text style={styles.modalSubtitle}>
                                Busca por nombre de usuario
                            </Text>
                            <View style={styles.codeInputContainer}>
                                <TextInput
                                    style={[styles.codeInput, { textAlign: 'left', letterSpacing: 0 }]}
                                    value={username}
                                    onChangeText={setUsername}
                                    placeholder="@usuario"
                                    placeholderTextColor="#3b82f680"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {loading && (
                                    <View style={[styles.searchBtn, { backgroundColor: 'transparent' }]}>
                                        <ActivityIndicator size="small" color="#8b5cf6" />
                                    </View>
                                )}
                            </View>

                            {/* Username Results */}
                            {usernameResults.length > 0 && (
                                <View style={styles.usernameResultsContainer}>
                                    {usernameResults.map((user) => (
                                        <View key={user._id} style={styles.usernameResultItem}>
                                            <View style={styles.resultAvatar}>
                                                <Text style={styles.resultAvatarText}>
                                                    {user.nombre?.charAt(0)?.toUpperCase() || '?'}
                                                </Text>
                                            </View>
                                            <View style={styles.resultInfo}>
                                                <Text style={styles.resultName}>{user.nombre}</Text>
                                                <Text style={styles.resultUsername}>@{user.username}</Text>
                                            </View>
                                            {renderStatusBadge(user)}
                                        </View>
                                    ))}
                                </View>
                            )}

                            {username.length >= 2 && usernameResults.length === 0 && !loading && (
                                <Text style={styles.noResultsText}>No se encontraron usuarios</Text>
                            )}
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// PENDING REQUESTS SECTION
// ═══════════════════════════════════════════════════════════════════════════

const PendingRequestsSection = ({ token, chatTheme, onRequestHandled, onFriendsUpdated, showToast }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPendingRequests();
    }, []);

    const loadPendingRequests = async () => {
        try {
            const res = await fetch(`${API_URL}/api/contacts/pending`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setRequests(data.requests || []);
            }
        } catch (err) {
            console.error('[PendingRequests] Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (userId) => {
        try {
            const res = await fetch(`${API_URL}/api/contacts/${userId}/accept`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setRequests(prev => prev.filter(r => r.user._id !== userId));
                onRequestHandled?.();
                onFriendsUpdated?.(); // Notificar que hay un nuevo amigo disponible
                showToast?.(`¡Ahora eres amigo de ${data.friend?.nombre}!`, 'success');
            }
        } catch (err) {
            showToast?.('No se pudo aceptar la solicitud', 'error');
        }
    };

    const handleReject = async (userId) => {
        try {
            const res = await fetch(`${API_URL}/api/contacts/${userId}/reject`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setRequests(prev => prev.filter(r => r.user._id !== userId));
                showToast?.('Solicitud rechazada', 'info');
            }
        } catch (err) {
            showToast?.('No se pudo rechazar la solicitud', 'error');
        }
    };

    if (loading || requests.length === 0) return null;

    return (
        <View style={[styles.pendingSection, { backgroundColor: chatTheme.cardBackground }]}>
            <View style={styles.pendingSectionHeader}>
                <Ionicons name="mail-unread" size={18} color={chatTheme.primary} />
                <Text style={[styles.pendingSectionTitle, { color: chatTheme.text }]}>
                    Solicitudes ({requests.length})
                </Text>
            </View>
            {requests.map((request) => (
                <View key={request._id} style={styles.pendingRequestItem}>
                    <View style={[styles.pendingAvatar, { backgroundColor: chatTheme.primary }]}>
                        <Text style={styles.pendingAvatarText}>
                            {request.user?.nombre?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                    </View>
                    <View style={styles.pendingInfo}>
                        <Text style={[styles.pendingName, { color: chatTheme.text }]}>
                            {request.user?.nombre}
                        </Text>
                        <Text style={[styles.pendingUsername, { color: chatTheme.textSecondary }]}>
                            @{request.user?.username}
                        </Text>
                    </View>
                    <View style={styles.pendingActions}>
                        <TouchableOpacity
                            style={[styles.pendingBtn, styles.acceptBtn]}
                            onPress={() => handleAccept(request.user._id)}
                        >
                            <Ionicons name="checkmark" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.pendingBtn, styles.rejectBtn]}
                            onPress={() => handleReject(request.user._id)}
                        >
                            <Ionicons name="close" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
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

    // 🔄 Contador para forzar la recarga de amigos sin bucles infinitos
    const [friendsVersion, setFriendsVersion] = useState(0);
    const incrementFriendsVersion = useCallback(() => {
        setFriendsVersion(v => v + 1);
    }, []);

    // Toast state
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
    };

    const hideToast = () => {
        setToast(prev => ({ ...prev, visible: false }));
    };

    // 🗑️ Estado para el modal de acciones (long press)
    const [actionModal, setActionModal] = useState({
        visible: false,
        conversation: null
    });
    const [actionLoading, setActionLoading] = useState(false);

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
                displayImage: conv.displayImage || '',
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
    // LONG PRESS HANDLERS (Eliminar chat/contacto)
    // ─────────────────────────────────────────────────────────────────────────

    const handleLongPress = (conversation) => {
        Vibration.vibrate(50); // Vibración táctil suave
        setActionModal({
            visible: true,
            conversation
        });
    };

    const closeActionModal = () => {
        setActionModal({ visible: false, conversation: null });
    };

    const handleDeleteChat = async (deleteContact = false) => {
        const conv = actionModal.conversation;
        if (!conv) return;

        setActionLoading(true);
        try {
            const url = deleteContact
                ? `${API_URL}/api/conversations/${conv._id}/contact`
                : `${API_URL}/api/conversations/${conv._id}`;

            const res = await fetch(url, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                closeActionModal();
                loadConversations();
                incrementFriendsVersion(); // Actualizar lista de amigos

                if (data.archived) {
                    showToast('Chat de entrenador archivado', 'info');
                } else if (deleteContact) {
                    showToast('Chat y contacto eliminados', 'success');
                } else {
                    showToast('Chat eliminado', 'success');
                }
            } else {
                showToast(data.message || 'Error al eliminar', 'error');
            }
        } catch (error) {
            console.error('[ChatHome] Error deleting:', error);
            showToast('Error de conexión', 'error');
        } finally {
            setActionLoading(false);
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
                onLongPress={() => handleLongPress(item)}
                delayLongPress={600}
                activeOpacity={0.7}
            >
                {/* Avatar */}
                <View style={[
                    styles.avatar,
                    { backgroundColor: chatTheme.textTertiary, overflow: 'hidden' },
                    item.isTrainerChat && { backgroundColor: chatTheme.primary },
                    item.type === 'group' && { backgroundColor: chatTheme.header }
                ]}>
                    {item.displayImage ? (
                        <Image
                            source={{ uri: item.displayImage }}
                            style={{ width: '100%', height: '100%', borderRadius: 25 }}
                            resizeMode="cover"
                        />
                    ) : item.isTrainerChat ? (
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

            {/* Pending Requests */}
            <PendingRequestsSection
                token={token}
                chatTheme={chatTheme}
                onRequestHandled={loadConversations}
                onFriendsUpdated={incrementFriendsVersion}
                showToast={showToast}
            />

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
                showToast={showToast}
                friendsVersion={friendsVersion}
            />

            {/* Toast Notification */}
            <Toast
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
                onHide={hideToast}
            />

            {/* Action Modal (Long Press) */}
            <Modal
                visible={actionModal.visible}
                transparent
                animationType="fade"
                onRequestClose={closeActionModal}
            >
                <TouchableOpacity
                    style={styles.actionModalOverlay}
                    activeOpacity={1}
                    onPress={closeActionModal}
                >
                    <View style={[styles.actionModalContent, { backgroundColor: chatTheme.cardBackground }]}>
                        {/* Header */}
                        <View style={styles.actionModalHeader}>
                            <View style={[
                                styles.actionModalAvatar,
                                { backgroundColor: actionModal.conversation?.isTrainerChat ? chatTheme.primary : chatTheme.textTertiary, overflow: 'hidden' }
                            ]}>
                                {actionModal.conversation?.displayImage ? (
                                    <Image
                                        source={{ uri: actionModal.conversation.displayImage }}
                                        style={{ width: '100%', height: '100%', borderRadius: 25 }}
                                        resizeMode="cover"
                                    />
                                ) : actionModal.conversation?.isTrainerChat ? (
                                    <Ionicons name="fitness" size={24} color="#fff" />
                                ) : (
                                    <Text style={styles.actionModalAvatarText}>
                                        {actionModal.conversation?.displayName?.charAt(0)?.toUpperCase() || '?'}
                                    </Text>
                                )}
                            </View>
                            <Text style={[styles.actionModalName, { color: chatTheme.text }]}>
                                {actionModal.conversation?.displayName}
                            </Text>
                            {actionModal.conversation?.isTrainerChat && (
                                <View style={[styles.trainerBadge, { backgroundColor: chatTheme.primary + '20' }]}>
                                    <Text style={[styles.trainerBadgeText, { color: chatTheme.primary }]}>Coach</Text>
                                </View>
                            )}
                        </View>

                        {/* Divider */}
                        <View style={[styles.actionModalDivider, { backgroundColor: chatTheme.border }]} />

                        {/* Actions */}
                        {actionLoading ? (
                            <View style={styles.actionModalLoading}>
                                <ActivityIndicator size="large" color={chatTheme.primary} />
                                <Text style={[styles.actionModalLoadingText, { color: chatTheme.textSecondary }]}>
                                    Eliminando...
                                </Text>
                            </View>
                        ) : (
                            <>
                                {/* Eliminar Chat */}
                                <TouchableOpacity
                                    style={styles.actionModalBtn}
                                    onPress={() => handleDeleteChat(false)}
                                >
                                    <Ionicons name="trash-outline" size={22} color="#ef4444" />
                                    <Text style={styles.actionModalBtnTextRed}>
                                        {actionModal.conversation?.isTrainerChat ? 'Archivar Chat' : 'Eliminar Chat'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Eliminar Chat + Contacto (solo para chats directos, no entrenador) */}
                                {actionModal.conversation?.type === 'direct' && !actionModal.conversation?.isTrainerChat && (
                                    <TouchableOpacity
                                        style={styles.actionModalBtn}
                                        onPress={() => handleDeleteChat(true)}
                                    >
                                        <Ionicons name="person-remove-outline" size={22} color="#ef4444" />
                                        <Text style={styles.actionModalBtnTextRed}>Eliminar Chat y Contacto</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Cancelar */}
                                <TouchableOpacity
                                    style={[styles.actionModalBtn, styles.actionModalBtnCancel]}
                                    onPress={closeActionModal}
                                >
                                    <Text style={[styles.actionModalBtnText, { color: chatTheme.text }]}>Cancelar</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
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
    },

    // Tabs
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10
    },
    tabActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#94a3b8'
    },
    tabTextActive: {
        color: '#8b5cf6',
        fontWeight: '600'
    },

    // Username Results
    usernameResultsContainer: {
        gap: 8
    },
    usernameResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 12,
        gap: 12
    },
    noResultsText: {
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 14,
        marginTop: 8
    },

    // Pending Requests Section
    pendingSection: {
        marginHorizontal: 16,
        marginTop: 12,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    pendingSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12
    },
    pendingSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b'
    },
    pendingRequestItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9'
    },
    pendingAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    pendingAvatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff'
    },
    pendingInfo: {
        flex: 1,
        marginLeft: 12
    },
    pendingName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b'
    },
    pendingUsername: {
        fontSize: 12,
        color: '#64748b'
    },
    pendingActions: {
        flexDirection: 'row',
        gap: 8
    },
    pendingBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center'
    },
    acceptBtn: {
        backgroundColor: '#22c55e'
    },
    rejectBtn: {
        backgroundColor: '#ef4444'
    },

    // Toast
    toastContainer: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 12,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 9999
    },
    toastText: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    },

    // Action Modal (Long Press)
    actionModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    actionModalContent: {
        width: '90%',
        maxWidth: 340,
        borderRadius: 20,
        paddingVertical: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10
    },
    actionModalHeader: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16
    },
    actionModalAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    actionModalAvatarText: {
        fontSize: 26,
        fontWeight: '700',
        color: '#fff'
    },
    actionModalName: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 4
    },
    actionModalDivider: {
        height: 1,
        marginHorizontal: 20,
        marginBottom: 8
    },
    actionModalLoading: {
        padding: 30,
        alignItems: 'center',
        gap: 12
    },
    actionModalLoadingText: {
        fontSize: 14
    },
    actionModalBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        gap: 12
    },
    actionModalBtnCancel: {
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        justifyContent: 'center'
    },
    actionModalBtnText: {
        fontSize: 16,
        fontWeight: '500'
    },
    actionModalBtnTextRed: {
        fontSize: 16,
        fontWeight: '500',
        color: '#ef4444'
    }
});
