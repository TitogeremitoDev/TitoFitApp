// app/(coach)/index.jsx - Trainer Dashboard Principal - Sistema de Cajas Temáticas v2
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    Image,
    ActivityIndicator,
    Alert,
    Platform,
    Modal,
    Animated,
    Share,
    Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useStableWindowDimensions } from '../../src/hooks/useStableBreakpoint';
import { useNotifications } from '../../context/NotificationContext';
import { useRouter } from 'expo-router';
import CoachOnboardingModal, { hasCompletedCoachOnboarding } from '../../components/CoachOnboardingModal';
import BroadcastModal from '../../components/BroadcastModal';
// Componentes mejorados para iOS
import {
    EnhancedScrollView as ScrollView,
    EnhancedTouchable as TouchableOpacity,
    EnhancedTextInput as TextInput,
} from '../../components/ui';

// Configuración de las cajas temáticas
const THEMED_BOXES = [
    {
        id: 'athletes',
        title: 'Gestión de Atletas',
        icon: 'people',
        accentColor: '#3b82f6',
        headerBg: 'rgba(59, 130, 246, 0.1)',
        borderColor: '#3b82f6',
        items: [
            { icon: 'people', name: 'Clientes', route: '/(coach)/clients_coach', color: '#10b981', badgeKey: 'clients' },
            //{ icon: 'calendar', name: 'Calendario', route: '/(coach)/calendar', color: '#6366f1', webOnly: true },
            //{ icon: 'chatbubbles', name: 'Comunicación', route: '/(coach)/communication', color: '#8b5cf6', badgeKey: 'messages' },
            { icon: 'stats-chart', name: 'Progreso', route: '/(coach)/progress', color: '#ef4444', badgeKey: 'progress' },
            { icon: 'resize-outline', name: 'Seguimiento', route: '/(coach)/seguimiento_coach', color: '#0ea5e9' }
        ]
    },
    {
        id: 'studio',
        title: 'Coach Studio',
        icon: 'fitness',
        accentColor: '#10b981',
        headerBg: 'rgba(16, 185, 129, 0.08)',
        borderColor: '#10b981',
        items: [
            { icon: 'barbell', name: 'Rutinas', route: '/(coach)/workouts', color: '#f59e0b' },
            { icon: 'nutrition', name: 'Nutrición', route: '/(coach)/nutrition', color: '#22c55e' },
            //{ icon: 'trophy', name: 'Objetivos', route: '/(coach)/goals', color: '#eab308', webOnly: true },
            //{ icon: 'analytics', name: 'Análisis Técnico', route: '/(coach)/analysis', color: '#f97316', webOnly: true }
        ]
    },
    {
        id: 'library',
        title: 'Biblioteca & Recursos',
        icon: 'library',
        accentColor: '#8b5cf6',
        headerBg: 'rgba(139, 92, 246, 0.08)',
        borderColor: '#8b5cf6',
        items: [
            { icon: 'library', name: 'BD Ejercicios', route: '/(coach)/exercises_coach', color: '#667eea' },
            { icon: 'restaurant', name: 'BD Alimentos', route: '/(coach)/food-library', color: '#10b981' },
            { icon: 'videocam', name: 'Videos Propios', route: '/(coach)/video-library', color: '#8b5cf6' },
            //{ icon: 'film', name: 'Multimedia', route: '/(coach)/multimedia', color: '#ec4899', webOnly: true },
            { icon: 'flash', name: 'Respuestas Rápidas', route: '/(coach)/snippet-manager', color: '#f59e0b' },
            { icon: 'help-circle', name: 'Centro de Ayuda', route: '/(coach)/faq-manager', color: '#06b6d4' }
        ]
    },
    {
        id: 'admin',
        title: 'Administración',
        icon: 'settings',
        accentColor: '#64748b',
        headerBg: 'rgba(100, 116, 139, 0.08)',
        borderColor: '#94a3b8',
        items: [
            { icon: 'card', name: 'Facturación', route: '/(coach)/billing', color: '#14b8a6' },
            { icon: 'people-circle', name: 'Comunidad', route: '/(coach)/community', color: '#06b6d4', webOnly: true },
            //{ icon: 'bar-chart', name: 'Analytics', route: '/(coach)/analytics', color: '#a855f7', webOnly: true },
            { icon: 'settings', name: 'Configuración', route: '/(coach)/settings', color: '#64748b' },
            { icon: 'color-palette', name: 'Branding', route: '/(coach)/branding', color: '#8b5cf6' }

        ]
    }
];

// Componente de Caja Colapsable
const ThemedBox = ({ box, isExpanded, onToggle, badges, router, isMobile, desktopWidth }) => {
    const [animation] = useState(new Animated.Value(isExpanded ? 1 : 0));

    useEffect(() => {
        Animated.timing(animation, {
            toValue: isExpanded ? 1 : 0,
            duration: 250,
            useNativeDriver: false
        }).start();
    }, [isExpanded]);

    // Filtrar items según plataforma
    const visibleItems = box.items.filter(item => !item.webOnly || Platform.OS === 'web');

    // Calcular badge total de la caja
    const totalBadge = visibleItems.reduce((sum, item) => {
        if (item.badgeKey && badges[item.badgeKey]) {
            return sum + badges[item.badgeKey];
        }
        return sum;
    }, 0);

    const contentHeight = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, visibleItems.length * 62 + 12] // 62px por item + padding
    });

    return (
        <View style={[
            styles.themedBox,
            { borderColor: box.borderColor },
            isMobile ? styles.themedBoxMobile : styles.themedBoxDesktop
        ]}>
            {/* Header de la caja - Siempre visible y clickable solo en móvil */}
            <TouchableOpacity
                style={[styles.boxHeader, { backgroundColor: box.headerBg }]}
                onPress={onToggle}
                activeOpacity={isMobile ? 0.7 : 1}
                disabled={!isMobile}
            >
                <View style={styles.boxHeaderLeft}>
                    <View style={[styles.boxIconContainer, { backgroundColor: box.accentColor }]}>
                        <Ionicons name={box.icon} size={20} color="#fff" />
                    </View>
                    <Text style={[styles.boxTitle, { color: box.accentColor }]}>{box.title}</Text>
                </View>
                <View style={styles.boxHeaderRight}>
                    {totalBadge > 0 && (
                        <View style={styles.boxBadge}>
                            <Text style={styles.boxBadgeText}>{totalBadge > 99 ? '99+' : totalBadge}</Text>
                        </View>
                    )}
                    {isMobile && (
                        <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={22}
                            color={box.accentColor}
                        />
                    )}
                </View>
            </TouchableOpacity>

            {/* Contenido colapsable - Solo renderizar si está expandido en móvil */}
            {(isExpanded || !isMobile) && (
                <Animated.View style={[
                    styles.boxContent,
                    isMobile && { height: contentHeight, overflow: 'hidden' },
                    !isMobile && { height: 'auto' }
                ]}>
                    <View style={styles.boxItemsGrid}>
                        {visibleItems.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.boxItem}
                                onPress={() => router.push(item.route)}
                                activeOpacity={0.7}
                            >
                                <LinearGradient
                                    colors={[item.color, `${item.color}dd`]}
                                    style={styles.boxItemIcon}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name={item.icon} size={22} color="#fff" />
                                </LinearGradient>
                                <Text style={styles.boxItemName}>{item.name}</Text>
                                {item.badgeKey && badges[item.badgeKey] > 0 && (
                                    <View style={styles.itemBadge}>
                                        <Text style={styles.itemBadgeText}>
                                            {badges[item.badgeKey] > 99 ? '99+' : badges[item.badgeKey]}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>
            )}
        </View>
    );
};

// Componente FAB (Floating Action Button)
const FAB = ({ onNewAthlete, onNewRoutine }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <View style={styles.fabContainer}>
            {isOpen && (
                <View style={styles.fabActions}>
                    <TouchableOpacity
                        style={[styles.fabAction, { backgroundColor: '#10b981' }]}
                        onPress={() => { setIsOpen(false); onNewAthlete(); }}
                    >
                        <Ionicons name="person-add" size={20} color="#fff" />
                        <Text style={styles.fabActionText}>Nuevo Atleta</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.fabAction, { backgroundColor: '#f59e0b' }]}
                        onPress={() => { setIsOpen(false); onNewRoutine(); }}
                    >
                        <Ionicons name="barbell" size={20} color="#fff" />
                        <Text style={styles.fabActionText}>Nueva Rutina</Text>
                    </TouchableOpacity>
                </View>
            )}
            <TouchableOpacity
                style={[styles.fabButton, isOpen && styles.fabButtonOpen]}
                onPress={() => setIsOpen(!isOpen)}
                activeOpacity={0.8}
            >
                <Ionicons name={isOpen ? 'close' : 'add'} size={28} color="#fff" />
            </TouchableOpacity>
        </View>
    );
};

export default function TrainerDashboard() {
    const { token, user } = useAuth();
    const { unreadChat: unreadMessages, refreshNotifications } = useNotifications();
    const router = useRouter();
    const { width } = useStableWindowDimensions();
    const isMobile = width <= 768;
    // Removido: La visibilidad del CoachFloatingTabBar ahora se controla en _layout.jsx


    const [loading, setLoading] = useState(true);
    const [trainerProfile, setTrainerProfile] = useState(null);
    const [currentClients, setCurrentClients] = useState(0);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);

    // 🚀 Estados para Sistema de Invitación Atletas
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState(false);

    // Estado de acordeón: en móvil solo la primera abierta, en PC todas abiertas
    const [expandedBoxes, setExpandedBoxes] = useState(
        isMobile ? { athletes: true } : { athletes: true, studio: true, library: true, admin: true }
    );

    // Badges para notificaciones - messages viene del NotificationContext
    const badges = {
        messages: unreadMessages,
        progress: 0,
        clients: 0
    };

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    useEffect(() => {
        loadTrainerData();
        checkOnboarding();
    }, []);

    // Actualizar estado de acordeón cuando cambia el tamaño de pantalla
    useEffect(() => {
        if (!isMobile) {
            setExpandedBoxes({ athletes: true, studio: true, library: true, admin: true });
        }
    }, [isMobile]);

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
            const [profileRes, clientsRes] = await Promise.all([
                fetch(`${API_URL}/api/trainers/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_URL}/api/trainers/clients`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            const profileData = await profileRes.json();
            const clientsData = await clientsRes.json();

            setTrainerProfile(profileData.profile || {});
            setCurrentClients(clientsData.count || 0);
        } catch (error) {
            console.error('Error loading trainer data:', error);
            Alert.alert('Error', 'No se pudieron cargar los datos del entrenador');
        } finally {
            setLoading(false);
        }
    };

    const toggleBox = (boxId) => {
        if (!isMobile) return; // En PC siempre expandido
        setExpandedBoxes(prev => ({
            ...prev,
            [boxId]: !prev[boxId]
        }));
    };


    const copyCodeToClipboard = () => {
        const code = trainerProfile?.trainerCode;

        if (!code || code === 'NO-CONFIGURADO') {
            if (Platform.OS === 'web') {
                window.alert('⚠️ No tienes un código configurado aún.\n\nVe a "Perfil Profesional" para generar tu código único.');
            } else {
                Alert.alert('Sin código', 'Ve a "Perfil Profesional" para generar tu código único.');
            }
            return;
        }

        if (Platform.OS === 'web' && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code)
                .then(() => {
                    window.alert(`✅ Código copiado!\n\n${code}\n\nComparte este código con tus clientes para que se vinculen contigo.`);
                })
                .catch(() => {
                    window.alert(`Tu código de entrenador:\n\n${code}\n\n(Cópialo manualmente)`);
                });
        } else {
            Alert.alert('Tu código', code, [{ text: 'OK' }]);
        }
    };

    // 🚀 === SISTEMA DE INVITACIÓN DE ATLETAS ===

    // Generar mensaje de invitación
    const getInviteMessage = () => {
        const code = trainerProfile?.trainerCode || 'TU-CODIGO';
        const coachName = user?.nombre || 'tu entrenador';

        return `Hola! Soy ${coachName} y quiero invitarte a entrenar conmigo en TotalGains.

--- COMO EMPEZAR ---

1. Descarga la app o entra desde la web:
   - Web: https://totalgains.es/app/login
   - iOS: https://apps.apple.com/app/id6756856683
   - Android: https://play.google.com/store/apps/details?id=com.german92.titofitapp

2. Crea tu cuenta (es gratis)

3. En la primera pantalla, selecciona "Soy Cliente/Atleta"

4. Introduce mi codigo de entrenador: ${code}

--- TE ESPERO! ---

Cualquier duda me escribes. Vamos a por tus objetivos!`;
    };


    // Manejar invitación - diferente según slots disponibles
    const handleInviteAthlete = () => {
        if (currentClients >= maxClients) {
            setShowLimitModal(true);
        } else {
            // En móvil: Share nativo | En web: Modal con opciones
            if (Platform.OS === 'web') {
                setShowInviteModal(true);
            } else {
                handleNativeShare();
            }
        }
    };

    // Share nativo para iOS/Android
    const handleNativeShare = async () => {
        const message = getInviteMessage();
        try {
            await Share.share({
                message: message,
                title: '¡Entrena conmigo! 💪'
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    // Compartir por WhatsApp (Web)
    const handleWhatsAppShare = () => {
        const message = getInviteMessage();
        const encoded = encodeURIComponent(message);
        const url = `https://wa.me/?text=${encoded}`;

        if (Platform.OS === 'web') {
            window.open(url, '_blank');
        } else {
            Linking.openURL(url);
        }
        setShowInviteModal(false);
    };

    // Compartir por Email (Web)
    const handleEmailShare = () => {
        const message = getInviteMessage();
        const subject = encodeURIComponent('¡Entrena conmigo! 💪 - Tu Plan de Entrenamiento');
        const body = encodeURIComponent(message);
        const url = `mailto:?subject=${subject}&body=${body}`;

        if (Platform.OS === 'web') {
            window.open(url);
        } else {
            Linking.openURL(url);
        }
        setShowInviteModal(false);
    };

    // Copiar invitación al portapapeles
    const handleCopyInvite = async () => {
        const message = getInviteMessage();

        if (Platform.OS === 'web' && navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(message);
                setCopyFeedback(true);
                setTimeout(() => setCopyFeedback(false), 2000);
            } catch (err) {
                console.error('Error copying:', err);
            }
        } else {
            // En móvil, usar el Share sheet si no hay clipboard
            handleNativeShare();
        }
    };

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
                {/* Header con Información del Entrenador - Rediseño Minimalista */}
                <LinearGradient
                    colors={['#0f172a', '#1e293b']}
                    style={styles.header}
                >
                    {/* Fila Superior: Perfil + Código discreto */}
                    <View style={styles.topRow}>
                        {/* Perfil del Entrenador */}
                        <TouchableOpacity
                            style={styles.profileSection}
                            onPress={() => router.push('/(coach)/profile')}
                            activeOpacity={0.8}
                        >
                            <View style={styles.profileImageContainer}>
                                {trainerProfile?.logoUrl ? (
                                    <Image
                                        source={{ uri: trainerProfile.logoUrl }}
                                        style={styles.profileImage}
                                    />
                                ) : (
                                    <View style={styles.profileImagePlaceholder}>
                                        <Ionicons name="person" size={28} color="#64748b" />
                                    </View>
                                )}
                            </View>
                            <View style={styles.profileInfo}>
                                <Text style={styles.trainerName}>{user?.nombre || 'Entrenador'}</Text>
                                <View style={styles.codeRow}>
                                    <Text style={styles.trainerCode}>
                                        {trainerProfile?.trainerCode || 'SIN-CÓDIGO'}
                                    </Text>
                                    <TouchableOpacity onPress={copyCodeToClipboard} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                        <Ionicons name="copy-outline" size={14} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* Botones de Acción - Cambiar Modo y Editar Perfil */}
                        <View style={styles.topRowActions}>
                            <TouchableOpacity
                                style={styles.editProfileBtn}
                                onPress={() => router.replace('/mode-select')}
                            >
                                <Ionicons name="swap-horizontal" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.editProfileBtn}
                                onPress={() => router.push('/(coach)/profile')}
                            >
                                <Ionicons name="pencil" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Sección Clientes - Reorganizada */}
                    <View style={styles.clientsCard}>
                        {/* Header de la tarjeta */}
                        <View style={styles.clientsHeader}>
                            <Text style={styles.clientsTitle}>Clientes</Text>
                            <Text style={styles.clientsStats}>
                                {currentClients} de {maxClients} ocupados
                            </Text>
                        </View>

                        {/* Barra de Progreso - CLICKEABLE → Facturación */}
                        <TouchableOpacity
                            style={styles.progressContainer}
                            onPress={() => router.push('/(app)/payment')}
                            activeOpacity={0.7}
                        >
                            <View style={styles.progressBar}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        { width: `${Math.min((currentClients / maxClients) * 100, 100)}%` },
                                        currentClients >= maxClients && { backgroundColor: '#f59e0b' }
                                    ]}
                                />
                            </View>
                            <View style={styles.progressTextRow}>
                                <Text style={styles.progressText}>
                                    {currentClients >= maxClients ? '¡Límite alcanzado!' : `${maxClients - currentClients} slots disponibles`}
                                </Text>
                                <View style={styles.upgradeHint}>
                                    <Ionicons name="flash" size={12} color="#f59e0b" />
                                    <Text style={styles.upgradeHintText}>Gestionar</Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* Botones de Acción */}
                        <View style={styles.actionsRow}>
                            {/* Botón Principal: Invitar Atleta */}
                            <TouchableOpacity
                                style={styles.addClientBtn}
                                onPress={handleInviteAthlete}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="person-add" size={20} color="#fff" />
                                <Text style={styles.addClientBtnText}>Invitar Atleta</Text>
                            </TouchableOpacity>


                            {/* Botones Secundarios */}
                            <TouchableOpacity
                                style={styles.secondaryBtn}
                                onPress={() => router.push('/(coach)/communication')}
                            >
                                <Ionicons name="chatbubbles-outline" size={20} color="#94a3b8" />
                                {unreadMessages > 0 && (
                                    <View style={styles.messageBadge}>
                                        <Text style={styles.messageBadgeText}>
                                            {unreadMessages > 99 ? '99+' : unreadMessages}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryBtn}
                                onPress={() => router.push('/(coach)/feedbacks')}
                            >
                                <Ionicons name="document-text-outline" size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>

                {/* Cajas Temáticas */}
                <View style={[
                    styles.boxesContainer,
                    !isMobile && styles.boxesContainerDesktop
                ]}>
                    {THEMED_BOXES.map((box) => (
                        <ThemedBox
                            key={box.id}
                            box={box}
                            isExpanded={expandedBoxes[box.id] || !isMobile}
                            onToggle={() => toggleBox(box.id)}
                            badges={badges}
                            router={router}
                            isMobile={isMobile}
                            desktopWidth={(width - 48) / 2} // 2 columnas con padding
                        />
                    ))}
                </View>
            </ScrollView>

            {/* FAB - Solo en móvil */}
            {isMobile && (
                <FAB
                    onNewAthlete={() => router.push('/(coach)/clients_coach?action=new')}
                    onNewRoutine={() => router.push('/(coach)/workouts?action=new')}
                />
            )}

            {/* Modal de Onboarding */}
            <CoachOnboardingModal
                visible={showOnboarding}
                onComplete={handleOnboardingComplete}
                onSkip={handleOnboardingSkip}
            />

            {/* Broadcast Modal */}
            <BroadcastModal
                visible={broadcastModalVisible}
                onClose={() => setBroadcastModalVisible(false)}
            />

            {/* 🚀 Modal Invitar Atleta (Solo Web) */}
            <Modal
                visible={showInviteModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowInviteModal(false)}
            >
                <View style={styles.inviteModalOverlay}>
                    <View style={styles.inviteModalContent}>
                        {/* Header */}
                        <View style={styles.inviteModalHeader}>
                            <Text style={styles.inviteModalTitle}>📤 Invitar Atleta</Text>
                            <TouchableOpacity
                                onPress={() => setShowInviteModal(false)}
                                style={styles.inviteModalClose}
                            >
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {/* Código del entrenador */}
                        <View style={styles.inviteCodeBox}>
                            <Text style={styles.inviteCodeLabel}>Tu código de entrenador</Text>
                            <Text style={styles.inviteCodeValue}>
                                {trainerProfile?.trainerCode || 'SIN-CÓDIGO'}
                            </Text>
                        </View>

                        {/* Opciones de compartir */}
                        <View style={styles.inviteOptions}>
                            {/* WhatsApp */}
                            <TouchableOpacity
                                style={[styles.inviteOption, styles.inviteOptionWhatsApp]}
                                onPress={handleWhatsAppShare}
                            >
                                <Ionicons name="logo-whatsapp" size={24} color="#fff" />
                                <Text style={styles.inviteOptionText}>Enviar por WhatsApp</Text>
                            </TouchableOpacity>

                            {/* Email */}
                            <TouchableOpacity
                                style={[styles.inviteOption, styles.inviteOptionEmail]}
                                onPress={handleEmailShare}
                            >
                                <Ionicons name="mail" size={24} color="#fff" />
                                <Text style={styles.inviteOptionText}>Enviar por Email</Text>
                            </TouchableOpacity>

                            {/* Copiar */}
                            <TouchableOpacity
                                style={[
                                    styles.inviteOption,
                                    styles.inviteOptionCopy,
                                    copyFeedback && styles.inviteOptionCopied
                                ]}
                                onPress={handleCopyInvite}
                            >
                                <Ionicons
                                    name={copyFeedback ? "checkmark-circle" : "copy"}
                                    size={24}
                                    color={copyFeedback ? "#10b981" : "#3b82f6"}
                                />
                                <Text style={[
                                    styles.inviteOptionTextCopy,
                                    copyFeedback && { color: '#10b981' }
                                ]}>
                                    {copyFeedback ? '¡Copiado!' : 'Copiar invitación'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 🚫 Modal Límite Alcanzado */}
            <Modal
                visible={showLimitModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowLimitModal(false)}
            >
                <View style={styles.inviteModalOverlay}>
                    <View style={styles.limitModalContent}>
                        {/* Icono */}
                        <View style={styles.limitModalIcon}>
                            <Ionicons name="rocket" size={48} color="#f59e0b" />
                        </View>

                        {/* Título */}
                        <Text style={styles.limitModalTitle}>¡Has alcanzado tu límite!</Text>

                        {/* Mensaje */}
                        <Text style={styles.limitModalSubtitle}>
                            Tu equipo está a tope ({currentClients}/{maxClients}).{'\n'}
                            Para invitar a tu próximo atleta, amplía tu capacidad.
                        </Text>

                        {/* Botones */}
                        <View style={styles.limitModalButtons}>
                            <TouchableOpacity
                                style={styles.limitModalPrimaryBtn}
                                onPress={() => {
                                    setShowLimitModal(false);
                                    router.push('/(app)/payment');
                                }}
                            >
                                <Ionicons name="flash" size={20} color="#fff" />
                                <Text style={styles.limitModalPrimaryText}>Mejorar mi Plan</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.limitModalSecondaryBtn}
                                onPress={() => setShowLimitModal(false)}
                            >
                                <Text style={styles.limitModalSecondaryText}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9'
    },
    header: {
        padding: 20,
        paddingTop: 14,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    profileImageContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#3b82f6'
    },
    profileImage: {
        width: '100%',
        height: '100%',
        borderRadius: 26
    },
    profileImagePlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 26
    },
    profileInfo: {
        marginLeft: 12,
        flex: 1
    },
    trainerName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#f8fafc',
        marginBottom: 2
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    trainerCode: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
        letterSpacing: 0.5
    },
    editProfileBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155'
    },
    topRowActions: {
        flexDirection: 'row',
        gap: 8
    },
    // Tarjeta de Clientes - Diseño Limpio
    clientsCard: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 16
    },
    clientsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    clientsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#f8fafc'
    },
    clientsStats: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500'
    },
    progressContainer: {
        marginBottom: 16
    },
    progressBar: {
        height: 8,
        backgroundColor: '#334155',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#3b82f6',
        borderRadius: 4
    },
    progressText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
        textAlign: 'right'
    },
    // Botones de Acción
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    addClientBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3b82f6',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        gap: 6,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
    },
    addClientBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700'
    },
    secondaryBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
    },
    messageBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#1e293b'
    },
    messageBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700'
    },
    // Estilos para Cajas Temáticas
    boxesContainer: {
        padding: 16,
        gap: 12
    },
    boxesContainerDesktop: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12
    },
    themedBox: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 2,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 0
    },
    themedBoxMobile: {
        width: '100%'
    },
    themedBoxDesktop: {
        width: '48.5%',
        marginBottom: 0
    },
    boxHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14
    },
    boxHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    boxIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    boxTitle: {
        fontSize: 14,
        fontWeight: '700'
    },
    boxHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    boxBadge: {
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 22,
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6
    },
    boxBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700'
    },
    boxContent: {
        paddingHorizontal: 10,
        paddingBottom: 10
    },
    boxItemsGrid: {
        gap: 6
    },
    boxItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 10,
        gap: 10,
        position: 'relative'
    },
    boxItemIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    boxItemName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#334155',
        flex: 1
    },
    itemBadge: {
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 22,
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6
    },
    itemBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700'
    },
    // FAB Styles
    fabContainer: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        alignItems: 'flex-end'
    },
    fabActions: {
        marginBottom: 12,
        gap: 10
    },
    fabAction: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 24,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4
    },
    fabActionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    },
    fabButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8
    },
    fabButtonOpen: {
        backgroundColor: '#64748b',
        transform: [{ rotate: '45deg' }]
    },
    // Modal Styles
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
    broadcastBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f0ff',
        borderRadius: 20
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
    },
    // 🚀 === ESTILOS SISTEMA DE INVITACIÓN ===
    progressTextRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    upgradeHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    upgradeHintText: {
        fontSize: 11,
        color: '#f59e0b',
        fontWeight: '600'
    },
    // Modal Invitar Atleta
    inviteModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    inviteModalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10
    },
    inviteModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    inviteModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b'
    },
    inviteModalClose: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center'
    },
    inviteCodeBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed'
    },
    inviteCodeLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 6
    },
    inviteCodeValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#3b82f6',
        letterSpacing: 2
    },
    inviteOptions: {
        gap: 12
    },
    inviteOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        gap: 12
    },
    inviteOptionWhatsApp: {
        backgroundColor: '#25D366'
    },
    inviteOptionEmail: {
        backgroundColor: '#475569'
    },
    inviteOptionCopy: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#3b82f6'
    },
    inviteOptionCopied: {
        borderColor: '#10b981',
        backgroundColor: '#f0fdf4'
    },
    inviteOptionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff'
    },
    inviteOptionTextCopy: {
        fontSize: 16,
        fontWeight: '600',
        color: '#3b82f6'
    },
    // Modal Límite Alcanzado
    limitModalContent: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 32,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10
    },
    limitModalIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fef3c7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20
    },
    limitModalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 12
    },
    limitModalSubtitle: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24
    },
    limitModalButtons: {
        width: '100%',
        gap: 12
    },
    limitModalPrimaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f59e0b',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
    },
    limitModalPrimaryText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff'
    },
    limitModalSecondaryBtn: {
        alignItems: 'center',
        paddingVertical: 12
    },
    limitModalSecondaryText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748b'
    }
});
