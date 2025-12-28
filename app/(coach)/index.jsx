// app/(coach)/index.jsx - Trainer Dashboard Principal
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Image,
    ActivityIndicator,
    Alert,
    Platform,
    Modal,
    FlatList,
    TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import CoachOnboardingModal, { hasCompletedCoachOnboarding } from '../../components/CoachOnboardingModal';
import FeedbackChatModal from '../../components/FeedbackChatModal';
import BroadcastModal from '../../components/BroadcastModal';

export default function TrainerDashboard() {
    const { token, user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [trainerProfile, setTrainerProfile] = useState(null);
    const [currentClients, setCurrentClients] = useState(0);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [messagesModalVisible, setMessagesModalVisible] = useState(false);
    const [clientsList, setClientsList] = useState([]);
    const [feedbackSummary, setFeedbackSummary] = useState({});
    const [chatModalVisible, setChatModalVisible] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'unread', 'replied'
    const [loadingClients, setLoadingClients] = useState(false);
    const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    useEffect(() => {
        loadTrainerData();
        checkOnboarding();
    }, []);

    const checkOnboarding = async () => {
        const completed = await hasCompletedCoachOnboarding();
        if (!completed) {
            setTimeout(() => setShowOnboarding(true), 800);
        }
    };

    const handleOnboardingComplete = () => setShowOnboarding(false);
    const handleOnboardingSkip = () => setShowOnboarding(false);

    const loadTrainerData = async () => {
        try {
            setLoading(true);
            const [profileRes, clientsRes, unreadRes] = await Promise.all([
                fetch(`${API_URL}/api/trainers/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_URL}/api/trainers/clients`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_URL}/api/chat/total-unread`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            const profileData = await profileRes.json();
            const clientsData = await clientsRes.json();
            const unreadData = await unreadRes.json();

            setTrainerProfile(profileData.profile || {});
            setCurrentClients(clientsData.count || 0);
            setUnreadMessages(unreadData.totalUnread || 0);
        } catch (error) {
            console.error('Error loading trainer data:', error);
            Alert.alert('Error', 'No se pudieron cargar los datos del entrenador');
        } finally {
            setLoading(false);
        }
    };

    const openMessagesModal = async () => {
        setMessagesModalVisible(true);
        try {
            const [clientsRes, summaryRes] = await Promise.all([
                fetch(`${API_URL}/api/trainers/clients-extended`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_URL}/api/chat/summary`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            const clientsData = await clientsRes.json();
            const summaryData = await summaryRes.json();
            setClientsList(clientsData.clients || []);
            setFeedbackSummary(summaryData.summary || {});
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    };

    const openClientChat = (client) => {
        setSelectedClient(client);
        setMessagesModalVisible(false);
        setChatModalVisible(true);
    };

    const closeClientChat = () => {
        setChatModalVisible(false);
        setSelectedClient(null);
        // Refresh unread count
        fetch(`${API_URL}/api/chat/total-unread`, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.json()).then(data => {
            setUnreadMessages(data.totalUnread || 0);
        }).catch(() => { });
    };

    const copyCodeToClipboard = () => {
        const code = trainerProfile?.trainerCode;

        if (!code || code === 'NO-CONFIGURADO') {
            window.alert('⚠️ No tienes un código configurado aún.\n\nVe a "Perfil Profesional" para generar tu código único.');
            return;
        }

        // Copiar al portapapeles
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code)
                .then(() => {
                    window.alert(`✅ Código copiado!\n\n${code}\n\nComparte este código con tus clientes para que se vinculen contigo.`);
                })
                .catch(() => {
                    // Fallback para navegadores antiguos
                    window.alert(`Tu código de entrenador:\n\n${code}\n\n(Cópialo manualmente)`);
                });
        } else {
            // Fallback si no hay clipboard API
            window.alert(`Tu código de entrenador:\n\n${code}\n\n(Cópialo manualmente)`);
        }
    };

    const dashboardSections = [
        { icon: 'person', name: 'Perfil Profesional', route: '/(coach)/profile', color: '#3b82f6' },
        { icon: 'people', name: 'Clientes', route: '/(coach)/clients_coach', color: '#10b981' },
        { icon: 'stats-chart', name: 'Progreso', route: '/(coach)/progress', color: '#ef4444' },
        { icon: 'resize-outline', name: 'Seguimiento', route: '/(coach)/seguimiento_coach', color: '#0ea5e9' },
        { icon: 'nutrition', name: 'Nutrición', route: '/(coach)/nutrition', color: '#22c55e' },
        { icon: 'barbell', name: 'Rutinas', route: '/(coach)/workouts', color: '#f59e0b' },
        { icon: 'library', name: 'BD Ejercicios', route: '/(coach)/exercises_coach', color: '#667eea' },
        { icon: 'chatbubbles', name: 'Comunicación', route: '/(coach)/communication', color: '#8b5cf6' },
        { icon: 'help-circle', name: 'Centro de Ayuda', route: '/(coach)/faq-manager', color: '#06b6d4' },
        { icon: 'people-circle', name: 'Comunidad', route: '/(coach)/community', color: '#06b6d4', webOnly: true },
        { icon: 'film', name: 'Multimedia', route: '/(coach)/multimedia', color: '#ec4899', webOnly: true },
        { icon: 'card', name: 'Facturación', route: '/(coach)/billing', color: '#14b8a6', webOnly: true },
        { icon: 'calendar', name: 'Calendario', route: '/(coach)/calendar', color: '#6366f1', webOnly: true },
        { icon: 'analytics', name: 'Análisis Técnico', route: '/(coach)/analysis', color: '#f97316', webOnly: true },
        { icon: 'trophy', name: 'Objetivos', route: '/(coach)/goals', color: '#eab308', webOnly: true },
        { icon: 'bar-chart', name: 'Analytics', route: '/(coach)/analytics', color: '#a855f7', webOnly: true },
        { icon: 'settings', name: 'Configuración', route: '/(coach)/settings', color: '#64748b' }
    ].filter(item => !item.webOnly || Platform.OS === 'web');

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    const maxClients = trainerProfile?.maxClients || 5;
    const canUpgrade = currentClients >= maxClients;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header con Información del Entrenador */}
                <LinearGradient
                    colors={['#1e293b', '#334155']}
                    style={styles.header}
                >
                    {/* Código de Entrenador */}
                    <View style={styles.codeSection}>
                        <Text style={styles.codeLabel}>CÓDIGO DE ENTRENADOR</Text>
                        <TouchableOpacity
                            style={styles.codeContainer}
                            onPress={copyCodeToClipboard}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.codeText}>
                                {trainerProfile?.trainerCode || 'NO-CONFIGURADO'}
                            </Text>
                            <Ionicons name="copy-outline" size={20} color="#10b981" />
                        </TouchableOpacity>
                    </View>

                    {/* Info del Entrenador */}
                    <View style={styles.profileSection}>
                        <View style={styles.profileInfo}>
                            <Text style={styles.trainerName}>{user?.nombre || 'Entrenador'}</Text>
                            <Text style={styles.brandName}>
                                {trainerProfile?.brandName || 'Configura tu marca'}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.profileImageContainer}
                            onPress={() => router.push('/(coach)/profile')}
                        >
                            {trainerProfile?.logoUrl ? (
                                <Image
                                    source={{ uri: trainerProfile.logoUrl }}
                                    style={styles.profileImage}
                                />
                            ) : (
                                <View style={styles.profileImagePlaceholder}>
                                    <Ionicons name="person" size={40} color="#94a3b8" />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Clientes Info */}
                    <View style={styles.clientsSection}>
                        <View style={styles.clientsInfo}>
                            <Text style={styles.clientsLabel}>CLIENTES</Text>
                            <View style={styles.clientsCount}>
                                <Text style={styles.currentClients}>{currentClients}</Text>
                                <Text style={styles.maxClients}> / {maxClients}</Text>
                            </View>
                        </View>

                        {/* Messages Button with Badge */}
                        <TouchableOpacity
                            style={styles.messagesButton}
                            onPress={openMessagesModal}
                        >
                            <Ionicons name="chatbubbles" size={22} color="#fff" />
                            <Text style={styles.buttonLabel}>Chat</Text>
                            {unreadMessages > 0 && (
                                <View style={styles.messageBadge}>
                                    <Text style={styles.messageBadgeText}>
                                        {unreadMessages > 99 ? '99+' : unreadMessages}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Feedbacks Button - NEW */}
                        <TouchableOpacity
                            style={styles.feedbacksButton}
                            onPress={() => router.push('/(coach)/feedbacks')}
                        >
                            <Ionicons name="document-text" size={22} color="#fff" />
                            <Text style={styles.buttonLabel}>Feedback</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.upgradeButton,
                                !canUpgrade && styles.upgradeButtonDisabled
                            ]}
                            onPress={() => router.push('/(app)/payment')}
                        >
                            <Ionicons name="add-circle" size={24} color={canUpgrade ? "#fff" : "#64748b"} />
                        </TouchableOpacity>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${Math.min((currentClients / maxClients) * 100, 100)}%` }
                                ]}
                            />
                        </View>
                        <Text style={styles.progressText}>
                            {currentClients >= maxClients ? '¡Límite alcanzado!' : `${maxClients - currentClients} slots disponibles`}
                        </Text>
                    </View>
                </LinearGradient>

                {/* Dashboard Sections */}
                <View style={styles.sectionsContainer}>
                    <Text style={styles.sectionsTitle}>Panel de Control</Text>

                    <View style={styles.grid}>
                        {dashboardSections.map((section, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.sectionCard}
                                onPress={() => router.push(section.route)}
                                activeOpacity={0.7}
                            >
                                <LinearGradient
                                    colors={[section.color, `${section.color}dd`]}
                                    style={styles.sectionGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name={section.icon} size={28} color="#fff" />
                                </LinearGradient>
                                <Text style={styles.sectionName}>{section.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Modal de Onboarding */}
            <CoachOnboardingModal
                visible={showOnboarding}
                onComplete={handleOnboardingComplete}
                onSkip={handleOnboardingSkip}
            />

            {/* Modal Lista de Mensajes - PANTALLA COMPLETA */}
            <Modal
                visible={messagesModalVisible}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setMessagesModalVisible(false)}
            >
                <SafeAreaView style={styles.fullScreenModal}>
                    {/* Header */}
                    <View style={styles.fullModalHeader}>
                        <TouchableOpacity
                            onPress={() => setMessagesModalVisible(false)}
                            style={styles.fullModalBackBtn}
                        >
                            <Ionicons name="arrow-back" size={24} color="#1e293b" />
                        </TouchableOpacity>
                        <Text style={styles.fullModalTitle}>💬 Centro de Mensajes</Text>
                        <TouchableOpacity
                            style={styles.broadcastBtn}
                            onPress={() => {
                                setMessagesModalVisible(false);
                                setBroadcastModalVisible(true);
                            }}
                        >
                            <Ionicons name="megaphone" size={20} color="#8b5cf6" />
                        </TouchableOpacity>
                    </View>

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
                    </View>

                    {/* Search Bar */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#94a3b8" />
                        <TextInput
                            style={styles.searchInput}
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
                    {loadingClients ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#3b82f6" />
                        </View>
                    ) : (
                        <FlatList
                            data={clientsList
                                .filter(client => {
                                    // Search filter
                                    const matchesSearch = client.nombre?.toLowerCase().includes(searchQuery.toLowerCase());

                                    // Tab filter
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
                                })
                            }
                            keyExtractor={item => item._id}
                            numColumns={1}
                            contentContainerStyle={styles.clientsListContent}
                            renderItem={({ item }) => {
                                const summary = feedbackSummary[item._id] || {};
                                const hasUnread = summary.unreadMessages > 0;
                                const totalMsgs = summary.totalMessages || 0;

                                // Calcular estado del cliente basado en última comunicación
                                let statusColor = '#6b7280'; // Gris - sin datos
                                let statusLabel = 'Sin contacto';
                                if (summary.lastFeedbackDate) {
                                    const daysSince = Math.floor(
                                        (new Date() - new Date(summary.lastFeedbackDate)) / (1000 * 60 * 60 * 24)
                                    );
                                    if (daysSince < 7) {
                                        statusColor = '#10b981'; // Verde
                                        statusLabel = 'Activo';
                                    } else if (daysSince < 14) {
                                        statusColor = '#f59e0b'; // Naranja
                                        statusLabel = 'Atención';
                                    } else {
                                        statusColor = '#ef4444'; // Rojo
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
                                                {/* Status Dot */}
                                                <View style={[
                                                    styles.statusDot,
                                                    { backgroundColor: statusColor }
                                                ]} />
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
                                <View style={styles.emptyFullScreen}>
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
                    )}
                </SafeAreaView>
            </Modal>

            {/* Modal Chat Individual */}
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc'
    },
    header: {
        padding: 24,
        paddingTop: 14,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32
    },
    codeSection: {
        marginBottom: 10
    },
    codeLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 1.5,
        marginBottom: 8
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1e293b',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155'
    },
    codeText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#10b981',
        letterSpacing: 2
    },
    profileSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    profileInfo: {
        flex: 1
    },
    trainerName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 4
    },
    brandName: {
        fontSize: 16,
        color: '#94a3b8',
        fontWeight: '500'
    },
    profileImageContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: '#10b981'
    },
    profileImage: {
        width: '100%',
        height: '100%'
    },
    profileImagePlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center'
    },
    clientsSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
    },
    clientsInfo: {
        flex: 1
    },
    clientsLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 1.5,
        marginBottom: 4
    },
    clientsCount: {
        flexDirection: 'row',
        alignItems: 'baseline'
    },
    currentClients: {
        fontSize: 36,
        fontWeight: '800',
        color: '#fff'
    },
    maxClients: {
        fontSize: 20,
        fontWeight: '600',
        color: '#64748b'
    },
    upgradeButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8
    },
    upgradeButtonDisabled: {
        backgroundColor: '#1e293b',
        shadowOpacity: 0
    },
    progressContainer: {
        marginTop: 8
    },
    progressBar: {
        height: 8,
        backgroundColor: '#1e293b',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#10b981',
        borderRadius: 4
    },
    progressText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
        textAlign: 'center'
    },
    sectionsContainer: {
        padding: 24
    },
    sectionsTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 20
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16
    },
    sectionCard: {
        width: '47%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    sectionGradient: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    sectionName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
        textAlign: 'center'
    },
    // Messages Button
    messagesButton: {
        width: 52,
        height: 58,
        borderRadius: 14,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        position: 'relative',
        paddingVertical: 6
    },
    messageBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#ef4444',
        borderRadius: 12,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        borderWidth: 2,
        borderColor: '#334155'
    },
    messageBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700'
    },
    // Feedbacks Button
    feedbacksButton: {
        width: 60,
        height: 58,
        borderRadius: 14,
        backgroundColor: '#f59e0b',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        position: 'relative',
        paddingVertical: 6
    },
    // Button Label
    buttonLabel: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '600',
        marginTop: 2
    },
    // Messages Modal
    messagesModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    messagesModalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingBottom: 32
    },
    messagesModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0'
    },
    messagesModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b'
    },
    clientMessageItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    clientMessageItemUnread: {
        backgroundColor: '#eff6ff'
    },
    clientMessageInfo: {
        flex: 1,
        marginLeft: 12
    },
    clientMessageName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b'
    },
    clientMessageDate: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },
    clientUnreadBadge: {
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8
    },
    clientUnreadText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700'
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
    broadcastBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f0ff',
        borderRadius: 20
    },
    emptyMessages: {
        padding: 40,
        alignItems: 'center'
    },
    emptyMessagesText: {
        color: '#94a3b8',
        marginTop: 12
    },
    // Full Screen Modal Styles
    fullScreenModal: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    fullModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0'
    },
    fullModalBackBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center'
    },
    fullModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b'
    },
    statsBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 24,
        justifyContent: 'space-around',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0'
    },
    statItem: {
        alignItems: 'center'
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1e293b'
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },
    statDivider: {
        width: 1,
        backgroundColor: '#e2e8f0'
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        margin: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 15,
        color: '#1e293b'
    },
    filterTabs: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 8
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 6
    },
    filterTabActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6'
    },
    filterTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b'
    },
    filterTabTextActive: {
        color: '#fff'
    },
    clientsListContent: {
        paddingHorizontal: 16,
        paddingBottom: 32
    },
    clientCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    clientCardUnread: {
        borderColor: '#3b82f6',
        borderWidth: 2,
        backgroundColor: '#eff6ff'
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
        backgroundColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center'
    },
    clientAvatarUnread: {
        backgroundColor: '#3b82f6'
    },
    clientAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#64748b'
    },
    clientCardInfo: {
        marginLeft: 12,
        flex: 1
    },
    clientCardName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b'
    },
    clientCardMeta: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },
    clientCardRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    unreadBadgeLarge: {
        backgroundColor: '#ef4444',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8
    },
    unreadBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700'
    },
    emptyFullScreen: {
        alignItems: 'center',
        paddingVertical: 60
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 16
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 4
    }
});
