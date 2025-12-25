import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, Modal, Pressable, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert, Share, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

import ActionButton from '../../../components/ActionButton';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { useAchievements } from '../../../context/AchievementsContext';
import SyncProgressModal from '../../../components/SyncProgressModal';
import { syncLocalToCloud } from '../../../src/lib/dataSyncService';

const AVATARS = [
    // Avatares Gratuitos
    { id: 'gorilla', emoji: '🦍', name: 'Gorila', premium: false },
    { id: 'lion', emoji: '🦁', name: 'León', premium: false },
    { id: 'wolf', emoji: '🐺', name: 'Lobo', premium: false },
    { id: 'bull', emoji: '🐂', name: 'Toro', premium: false },
    { id: 'bear', emoji: '🐻', name: 'Oso', premium: false },
    { id: 'tiger', emoji: '🐯', name: 'Tigre', premium: false },
    { id: 'eagle', emoji: '🦅', name: 'Águila', premium: false },
    { id: 'fox', emoji: '🦊', name: 'Zorro', premium: false },
    { id: 'parrot', emoji: '🦜', name: 'Loro', premium: false },
    { id: 'panda', emoji: '🐼', name: 'Panda', premium: false },

    // Avatares Premium (CLIENTES/ENTRENADORES)
    { id: 'dragon', emoji: '🐉', name: 'Dragón', premium: true },
    { id: 'phoenix', emoji: '🐦‍🔥', name: 'Fénix', premium: true },
    { id: 'ninja', emoji: '🥷', name: 'Ninja', premium: true },
    { id: 'valkyrie', emoji: '🧛🏿‍♀️', name: 'Valkyrie', premium: true },
    { id: 'crown', emoji: '👑', name: 'Corona', premium: true },
];

export default function PerfilScreen() {
    const router = useRouter();
    const { user, logout, token, refreshUser } = useAuth();
    const { theme, isDark } = useTheme();
    const { updateStats, checkAchievements, userStats } = useAchievements();

    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);

    // Trainer code states
    const [trainerCode, setTrainerCode] = useState('');
    const [currentTrainer, setCurrentTrainer] = useState(null);
    const [isLinkingTrainer, setIsLinkingTrainer] = useState(false);
    const [isLoadingTrainer, setIsLoadingTrainer] = useState(true);

    // Success modal state
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [linkedTrainerName, setLinkedTrainerName] = useState('');

    // Premium code modal states
    const [showPremiumCodeModal, setShowPremiumCodeModal] = useState(false);
    const [premiumCode, setPremiumCode] = useState('');
    const [isRedeemingCode, setIsRedeemingCode] = useState(false);
    const [showPremiumSuccessModal, setShowPremiumSuccessModal] = useState(false);

    // Referral code states
    const [showReferralModal, setShowReferralModal] = useState(false);
    const [referralCodeInput, setReferralCodeInput] = useState('');
    const [isRedeemingReferral, setIsRedeemingReferral] = useState(false);
    const [showReferralSuccessModal, setShowReferralSuccessModal] = useState(false);
    const [referralSuccessMessage, setReferralSuccessMessage] = useState('');
    const [codeCopied, setCodeCopied] = useState(false);

    // 🔄 Estado para modal de sincronización de datos
    const [syncModal, setSyncModal] = useState({
        visible: false,
        direction: 'upload',
        isComplete: false,
        itemsSynced: 0,
    });

    // Estado para modal de error de código
    const [codeErrorModal, setCodeErrorModal] = useState({ visible: false, message: '' });

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    // Determinar si es usuario premium
    const isPremiumUser = user?.tipoUsuario === 'CLIENTE' ||
        user?.tipoUsuario === 'ENTRENADOR' ||
        user?.tipoUsuario === 'ADMINISTRADOR' ||
        user?.tipoUsuario === 'PREMIUM';

    // Load saved avatar and fetch trainer on mount
    useEffect(() => {
        loadSavedAvatar();
        fetchCurrentTrainer();
    }, []);

    const loadSavedAvatar = async () => {
        try {
            const savedAvatarId = await AsyncStorage.getItem('user_avatar');
            if (savedAvatarId) {
                const avatar = AVATARS.find(a => a.id === savedAvatarId);
                if (avatar) {
                    // Solo cargar si el usuario tiene acceso a ese avatar
                    if (!avatar.premium || isPremiumUser) {
                        setSelectedAvatar(avatar);
                    }
                }
            }
        } catch (error) {
            console.error('[Perfil] Error loading saved avatar:', error);
        }
    };

    const handleSelectAvatar = async (avatar) => {
        setSelectedAvatar(avatar);
        setShowAvatarModal(false);
        try {
            await AsyncStorage.setItem('user_avatar', avatar.id);
        } catch (error) {
            console.error('[Perfil] Error saving avatar:', error);
        }
    };

    const fetchCurrentTrainer = async () => {
        try {
            setIsLoadingTrainer(true);
            const response = await fetch(`${API_URL}/api/clients/my-trainer`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && data.trainer) {
                setCurrentTrainer(data.trainer);
            }
        } catch (error) {
            console.error('[Perfil] Error fetching trainer:', error);
        } finally {
            setIsLoadingTrainer(false);
        }
    };

    const handleLinkTrainer = async () => {
        if (!trainerCode.trim()) {
            Alert.alert('Error', 'Por favor ingresa un código de entrenador');
            return;
        }

        setIsLinkingTrainer(true);
        try {
            const response = await fetch(`${API_URL}/api/clients/select-trainer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ trainerCode: trainerCode.trim() })
            });
            const data = await response.json();

            if (data.success) {
                // 🔄 FREE → CLIENTE: Subir datos locales antes de cambiar de plan
                const previousType = user?.tipoUsuario;
                if (previousType === 'FREEUSER') {
                    setSyncModal({ visible: true, direction: 'upload', isComplete: false, itemsSynced: 0 });
                    try {
                        const syncResult = await syncLocalToCloud(token);
                        setSyncModal(prev => ({ ...prev, isComplete: true, itemsSynced: syncResult?.itemsSynced || 0 }));
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (syncErr) {
                        console.warn('[Perfil] Error sincronizando:', syncErr);
                    }
                    setSyncModal(prev => ({ ...prev, visible: false }));
                }

                // Refrescar datos del usuario para actualizar tipoUsuario
                try {
                    await refreshUser();
                } catch (refreshError) {
                    console.error('[Perfil] Error refreshing user:', refreshError);
                }

                // Store trainer name and show success modal
                setLinkedTrainerName(data.trainer?.brandName || data.trainer?.nombre || 'tu entrenador');
                setTrainerCode('');
                setShowSuccessModal(true);
            } else {
                Alert.alert('Error', data.message || 'No se pudo vincular con el entrenador');
            }
        } catch (error) {
            console.error('[Perfil] Error linking trainer:', error);
            Alert.alert('Error', 'No se pudo completar la vinculación');
        } finally {
            setIsLinkingTrainer(false);
        }
    };

    const handleCloseSuccessModal = () => {
        setShowSuccessModal(false);
        fetchCurrentTrainer();
    };

    // Handle premium code redemption
    const handleRedeemCode = async () => {
        if (!premiumCode.trim()) {
            Alert.alert('Error', 'Por favor ingresa un código');
            return;
        }

        setIsRedeemingCode(true);
        try {
            const response = await fetch(`${API_URL}/api/promo-codes/redeem`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ code: premiumCode.trim() })
            });

            const data = await response.json();

            if (data.success) {
                // 🔄 FREE → PREMIUM: Subir datos locales antes de cambiar de plan
                const previousType = user?.tipoUsuario;
                if (previousType === 'FREEUSER') {
                    setSyncModal({ visible: true, direction: 'upload', isComplete: false, itemsSynced: 0 });
                    try {
                        const syncResult = await syncLocalToCloud(token);
                        setSyncModal(prev => ({ ...prev, isComplete: true, itemsSynced: syncResult?.itemsSynced || 0 }));
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (syncErr) {
                        console.warn('[Perfil] Error sincronizando:', syncErr);
                    }
                    setSyncModal(prev => ({ ...prev, visible: false }));
                }

                // Refresh user data to get updated tipoUsuario
                await refreshUser();
                setShowPremiumCodeModal(false);
                setPremiumCode('');
                // Show success modal instead of Alert
                setShowPremiumSuccessModal(true);
            } else {
                setCodeErrorModal({ visible: true, message: data.message || 'No se pudo canjear el código' });
            }
        } catch (e) {
            console.error('[Perfil] Error redeeming code:', e);
            setCodeErrorModal({ visible: true, message: 'No se pudo canjear el código. Verifica que sea correcto.' });
        } finally {
            setIsRedeemingCode(false);
        }
    };

    // Copiar código de referido al portapapeles
    const handleCopyReferralCode = async () => {
        if (user?.referralCode) {
            await Clipboard.setStringAsync(user.referralCode);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
        }
    };

    // Compartir código de referido
    const handleShareReferralCode = async () => {
        if (user?.referralCode) {
            try {
                await Share.share({
                    message: `¡Únete a TotalGains con mi código ${user.referralCode} y consigue 1 semana de premium gratis! 💪🔥`,
                });
            } catch (error) {
                console.error('[Perfil] Error sharing:', error);
            }
        }
    };

    // Canjear código de referido de otro usuario
    const handleRedeemReferralCode = async () => {
        if (!referralCodeInput.trim()) {
            Alert.alert('Error', 'Por favor ingresa un código de referido');
            return;
        }

        setIsRedeemingReferral(true);
        try {
            const response = await fetch(`${API_URL}/api/referrals/redeem`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ code: referralCodeInput.trim() })
            });

            const data = await response.json();

            if (data.success) {
                // 🔄 FREE → PREMIUM: Subir datos locales antes de cambiar de plan
                const previousType = user?.tipoUsuario;
                if (previousType === 'FREEUSER') {
                    setSyncModal({ visible: true, direction: 'upload', isComplete: false, itemsSynced: 0 });
                    try {
                        const syncResult = await syncLocalToCloud(token);
                        setSyncModal(prev => ({ ...prev, isComplete: true, itemsSynced: syncResult?.itemsSynced || 0 }));
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (syncErr) {
                        console.warn('[Perfil] Error sincronizando:', syncErr);
                    }
                    setSyncModal(prev => ({ ...prev, visible: false }));
                }

                await refreshUser();
                setShowReferralModal(false);
                setReferralCodeInput('');
                setReferralSuccessMessage(data.message);
                setShowReferralSuccessModal(true);
            } else {
                Alert.alert('Error', data.message || 'No se pudo canjear el código');
            }
        } catch (e) {
            console.error('[Perfil] Error redeeming referral:', e);
            Alert.alert('Error', 'No se pudo canjear el código');
        } finally {
            setIsRedeemingReferral(false);
        }
    };

    const handleLogout = async () => {
        try {
            console.log('[Perfil] Iniciando logout...');
            await logout();
            console.log('[Perfil] Logout completado, esperando limpieza de AsyncStorage...');
            // Pequeño delay para asegurar que AsyncStorage se limpie completamente
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log('[Perfil] Navegando a login...');
            router.replace('/(auth)/login');
        } catch (error) {
            console.error('[Perfil] Error en logout:', error);
        }
    };

    const { width: screenWidth } = useWindowDimensions();
    // Calculate card width for 2-column grid with proper spacing
    const cardPadding = 20; // horizontal padding of container
    const cardGap = 12; // gap between cards
    // Limit effective width on web for better layout
    const effectiveWidth = Math.min(screenWidth, 600) - (cardPadding * 2);
    const cardWidth = (effectiveWidth - cardGap) / 2;

    const menuItems = [
        { title: 'Información Personal', icon: 'person-outline', route: '/perfil/informacion-personal', color: '#3B82F6' },
        { title: 'Evolución', icon: 'trending-up-outline', route: '/perfil/evolucion', color: '#10B981' },
        { title: 'Mi Transformación', icon: 'body-outline', route: '/perfil/transformacion', color: '#8B5CF6' },
        { title: 'Logros', icon: 'trophy-outline', route: '/perfil/logros', color: '#F59E0B' },
        { title: 'Amigos', icon: 'people-outline', route: '/perfil/amigos', color: '#EC4899' },
        { title: 'Comunidad', icon: 'globe-outline', route: '/perfil/comunidad', color: '#06B6D4', webOnly: true },
        { title: 'Videoteca', icon: 'videocam-outline', route: '/perfil/videos', color: '#EF4444' },
        { title: 'Ajustes', icon: 'settings-outline', route: '/perfil/ajustes', color: '#6B7280' },
    ].filter(item => !item.webOnly || Platform.OS === 'web');

    const gradientColors = isDark
        ? ['#0B1220', '#0D1B2A', '#111827']
        : ['#f0f4f8', '#e0e7ef', '#d1dce6'];

    const blobColorTop = isDark ? '#3B82F6' : '#93c5fd';
    const blobColorBottom = isDark ? '#10B981' : '#6ee7b7';

    return (
        <View style={styles.root}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View style={[styles.blob, styles.blobTop, { backgroundColor: blobColorTop }]} />
            <View style={[styles.blob, styles.blobBottom, { backgroundColor: blobColorBottom }]} />

            <ScrollView style={{ width: '100%' }} contentContainerStyle={styles.scrollContainer}>

                {/* Header Section */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => setShowAvatarModal(true)}
                        style={[
                            styles.avatarContainer,
                            { borderColor: theme.primary },
                            isPremiumUser && styles.avatarContainerVIP
                        ]}
                    >
                        <Text style={styles.avatarEmoji}>{selectedAvatar.emoji}</Text>
                        <View style={[styles.editIconBadge, { backgroundColor: isPremiumUser ? '#FFD700' : theme.primary }]}>
                            <Ionicons name="pencil" size={12} color={isPremiumUser ? '#000' : '#fff'} />
                        </View>
                        {isPremiumUser && (
                            <View style={styles.vipBadge}>
                                <Ionicons name="star" size={12} color="#FFD700" />
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={styles.userInfo}>
                        <Text style={[styles.name, { color: theme.text }]}>{user?.nombre || 'Usuario'}</Text>
                        <Text style={[styles.username, { color: theme.textSecondary }]}>@{user?.username || 'usuario'}</Text>


                        <View style={styles.badgesRow}>
                            <View style={[styles.badge, { backgroundColor: theme.successLight }]}>
                                <Text style={[styles.badgeText, { color: theme.successText }]}>
                                    {user?.tipoUsuario === 'ENTRENADOR' && user?.currentTrainerId
                                        ? 'ENTRENADOR-CLIENTE'
                                        : (user?.tipoUsuario || 'FREEUSER')}
                                </Text>
                            </View>
                        </View>


                        {/* Subscription Expiry Info - Only show if subscription is expired or urgent (cancelled) */}
                        {user?.subscriptionExpiry && user?.tipoUsuario !== 'FREEUSER' && (() => {
                            const expiryDate = new Date(user.subscriptionExpiry);
                            const now = new Date();
                            const diffTime = expiryDate.getTime() - now.getTime();
                            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            const isExpired = daysRemaining <= 0;
                            const isUrgent = daysRemaining <= 7 && daysRemaining > 0;

                            // Solo mostrar si está expirada o próxima a expirar (cancelada)
                            // El estado "activo" normal se muestra solo en Ajustes
                            if (!isExpired && !isUrgent) {
                                return null;
                            }

                            const statusColor = isExpired ? '#EF4444' : '#F59E0B';
                            const statusBgColor = isExpired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
                            const statusText = isExpired
                                ? 'Suscripción expirada'
                                : `⚠️ Expira en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}`;

                            return (
                                <View style={[styles.subscriptionExpiryBanner, { backgroundColor: statusBgColor, borderColor: statusColor }]}>
                                    <Ionicons
                                        name={isExpired ? 'warning' : 'time'}
                                        size={18}
                                        color={statusColor}
                                    />
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                        <Text style={[styles.subscriptionExpiryText, { color: statusColor }]}>
                                            {statusText}
                                        </Text>
                                        <TouchableOpacity onPress={() => router.push('/payment')}>
                                            <Text style={[styles.subscriptionRenewLink, { color: statusColor }]}>
                                                Renovar ahora →
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })()}

                        {/* Simplified Referral Banner - Links to Amigos */}
                        <TouchableOpacity
                            style={[styles.referralBanner, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: theme.primary }]}
                            onPress={() => router.push('/perfil/amigos')}
                        >
                            <View style={styles.referralBannerContent}>
                                <Ionicons name="gift" size={22} color={theme.primary} />
                                <View style={styles.referralBannerText}>
                                    <Text style={[styles.referralBannerTitle, { color: theme.primary }]}>
                                        Codigos Premium o Referidos
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.primary} />
                        </TouchableOpacity>

                        {/* Trainer Section - Simplified */}
                        <View style={styles.trainerSection}>
                            {isLoadingTrainer ? (
                                <ActivityIndicator size="small" color={theme.primary} />
                            ) : currentTrainer ? (
                                <View style={[styles.currentTrainerCard, { backgroundColor: theme.successLight, borderColor: theme.success }]}>
                                    <Ionicons name="person-circle" size={24} color={theme.success} />
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                        <Text style={[styles.currentTrainerLabel, { color: theme.successText }]}>
                                            Entrenador
                                        </Text>
                                        <Text style={[styles.currentTrainerName, { color: theme.successText }]}>
                                            {currentTrainer.brandName || currentTrainer.nombre}
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.trainerInputRow}>
                                    <TextInput
                                        style={[styles.trainerInput, {
                                            backgroundColor: theme.backgroundSecondary,
                                            color: theme.text,
                                            borderColor: theme.border
                                        }]}
                                        value={trainerCode}
                                        onChangeText={setTrainerCode}
                                        placeholder="Vincular Entrenador"
                                        placeholderTextColor={theme.textSecondary}
                                        autoCapitalize="characters"
                                        editable={!isLinkingTrainer}
                                    />
                                    <TouchableOpacity
                                        style={[styles.linkButton, {
                                            backgroundColor: theme.primary,
                                            opacity: isLinkingTrainer ? 0.6 : 1
                                        }]}
                                        onPress={handleLinkTrainer}
                                        disabled={isLinkingTrainer}
                                    >
                                        {isLinkingTrainer ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Ionicons name="link" size={20} color="#fff" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Menu Section - Professional 2-Column Grid */}
                <View style={styles.menuContainer}>
                    <View style={styles.menuGrid}>
                        {menuItems.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.menuCard,
                                    {
                                        width: cardWidth,
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
                                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                                    }
                                ]}
                                onPress={() => router.push(item.route)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.menuCardIconContainer, { backgroundColor: `${item.color}15` }]}>
                                    <Ionicons name={item.icon} size={24} color={item.color} />
                                </View>
                                <Text
                                    style={[styles.menuCardTitle, { color: theme.text }]}
                                    numberOfLines={2}
                                >
                                    {item.title}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} style={styles.menuCardChevron} />
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={[styles.divider, { marginVertical: 20 }]} />

                    {/* Logout Button - Full Width */}
                    <TouchableOpacity
                        style={[
                            styles.logoutButton,
                            {
                                backgroundColor: '#EF4444',
                                borderColor: '#EF4444',
                            }
                        ]}
                        onPress={handleLogout}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
                        <Text style={[styles.logoutButtonText, { color: '#FFFFFF' }]}>Cerrar Sesión</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* Avatar Selector Modal */}
            <Modal visible={showAvatarModal} transparent animationType="fade" onRequestClose={() => setShowAvatarModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Elige tu Avatar</Text>

                        <ScrollView style={{ maxHeight: 400, width: '100%' }}>
                            <View style={styles.avatarGrid}>
                                {AVATARS
                                    .filter(avatar => {
                                        if (avatar.premium) {
                                            return isPremiumUser;
                                        }
                                        return true;
                                    })
                                    .map((avatar) => (
                                        <TouchableOpacity
                                            key={avatar.id}
                                            style={[
                                                styles.avatarOption,
                                                selectedAvatar.id === avatar.id && {
                                                    borderColor: theme.primary,
                                                    backgroundColor: theme.primaryLight
                                                },
                                                avatar.premium && {
                                                    borderWidth: 2,
                                                    borderColor: '#FFD700'
                                                }
                                            ]}
                                            onPress={() => handleSelectAvatar(avatar)}
                                        >
                                            <Text style={styles.avatarOptionEmoji}>{avatar.emoji}</Text>
                                            <Text style={[styles.avatarOptionName, { color: theme.textSecondary }]}>
                                                {avatar.name}
                                            </Text>
                                            {avatar.premium && (
                                                <View style={styles.premiumBadge}>
                                                    <Ionicons name="star" size={10} color="#FFD700" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    ))
                                }
                            </View>
                        </ScrollView>

                        <Pressable onPress={() => setShowAvatarModal(false)} style={[styles.closeBtn, { backgroundColor: theme.background }]}>
                            <Text style={{ color: theme.text }}>Cerrar</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal >

            {/* Success Modal */}
            < Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={handleCloseSuccessModal} >
                <View style={styles.modalOverlay}>
                    <View style={[styles.successModalCard, { backgroundColor: theme.backgroundSecondary }]}>
                        {/* Trophy Icon */}
                        <View style={[styles.successIconContainer, { backgroundColor: theme.primaryLight }]}>
                            <Ionicons name="trophy" size={60} color={theme.primary} />
                        </View>

                        {/* Congratulations Text */}
                        <Text style={[styles.successTitle, { color: theme.primary }]}>
                            ¡ENHORABUENA!
                        </Text>

                        <Text style={[styles.successMessage, { color: theme.text }]}>
                            HAS ENTRADO EN EL TEAM DE
                        </Text>

                        <Text style={[styles.trainerNameText, { color: theme.primary }]}>
                            {linkedTrainerName.toUpperCase()}
                        </Text>

                        <View style={[styles.divider, { marginVertical: 20, width: '80%' }]} />

                        <View style={styles.benefitsContainer}>
                            <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                            <Text style={[styles.benefitsText, { color: theme.text }]}>
                                AHORA DISFRUTARÁS DE TODOS LOS
                            </Text>
                        </View>

                        <Text style={[styles.premiumText, { color: theme.primary }]}>
                            BENEFICIOS PREMIUM DE LA APP
                        </Text>

                        {/* Confetti decoration */}
                        <View style={styles.confettiContainer}>
                            <Text style={styles.confettiEmoji}>🎉</Text>
                            <Text style={styles.confettiEmoji}>🎊</Text>
                            <Text style={styles.confettiEmoji}>✨</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.successButton, { backgroundColor: theme.primary }]}
                            onPress={handleCloseSuccessModal}
                        >
                            <Text style={styles.successButtonText}>¡COMENZAR!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal >

            {/* Premium Code Modal */}
            < Modal visible={showPremiumCodeModal} transparent animationType="fade" onRequestClose={() => setShowPremiumCodeModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                        <View style={[styles.premiumCodeIconContainer, { backgroundColor: theme.primaryLight }]}>
                            <Ionicons name="gift" size={40} color={theme.primary} />
                        </View>

                        <Text style={[styles.modalTitle, { color: theme.text }]}>Canjear Código Premium</Text>
                        <Text style={[styles.premiumCodeDescription, { color: theme.textSecondary }]}>
                            Introduce tu código para desbloquear los beneficios premium de la app
                        </Text>

                        <TextInput
                            style={[styles.premiumCodeInput, {
                                backgroundColor: theme.background,
                                color: theme.text,
                                borderColor: theme.border
                            }]}
                            value={premiumCode}
                            onChangeText={setPremiumCode}
                            placeholder="CÓDIGO PREMIUM"
                            placeholderTextColor={theme.textSecondary}
                            autoCapitalize="characters"
                            editable={!isRedeemingCode}
                        />

                        <View style={styles.premiumCodeButtons}>
                            <Pressable
                                onPress={() => {
                                    setShowPremiumCodeModal(false);
                                    setPremiumCode('');
                                }}
                                style={[styles.premiumCodeCancelBtn, { borderColor: theme.border }]}
                                disabled={isRedeemingCode}
                            >
                                <Text style={{ color: theme.text }}>Cancelar</Text>
                            </Pressable>

                            <Pressable
                                onPress={handleRedeemCode}
                                style={[styles.premiumCodeSubmitBtn, { backgroundColor: theme.primary, opacity: isRedeemingCode ? 0.6 : 1 }]}
                                disabled={isRedeemingCode}
                            >
                                {isRedeemingCode ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.premiumCodeSubmitText}>Canjear</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal >

            {/* Premium Success Modal */}
            < Modal visible={showPremiumSuccessModal} transparent animationType="fade" onRequestClose={() => setShowPremiumSuccessModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.premiumSuccessModalCard, { backgroundColor: theme.backgroundSecondary }]}>
                        {/* Confetti decoration */}
                        <View style={styles.premiumConfettiTop}>
                            <Text style={styles.confettiEmoji}>🎉</Text>
                            <Text style={styles.confettiEmoji}>✨</Text>
                            <Text style={styles.confettiEmoji}>🎊</Text>
                        </View>

                        {/* Crown Icon */}
                        <View style={[styles.premiumCrownContainer, { backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}>
                            <Ionicons name="trophy" size={60} color="#FFD700" />
                        </View>

                        {/* Congratulations Text */}
                        <Text style={[styles.premiumSuccessTitle, { color: '#FFD700' }]}>
                            ¡ENHORABUENA!
                        </Text>

                        <Text style={[styles.premiumSuccessSubtitle, { color: theme.text }]}>
                            AHORA ERES PREMIUM
                        </Text>

                        <View style={[styles.premiumDivider, { backgroundColor: 'rgba(255, 215, 0, 0.3)' }]} />

                        <Text style={[styles.premiumBenefitsTitle, { color: theme.textSecondary }]}>
                            Disfruta de todas las ventajas:
                        </Text>

                        {/* Benefits List */}
                        <View style={styles.premiumBenefitsList}>
                            <View style={styles.premiumBenefitItem}>
                                <Ionicons name="cloud-done" size={24} color="#10B981" />
                                <Text style={[styles.premiumBenefitText, { color: theme.text }]}>
                                    Guardado en la nube
                                </Text>
                            </View>
                            <View style={styles.premiumBenefitItem}>
                                <Ionicons name="sparkles" size={24} color="#8B5CF6" />
                                <Text style={[styles.premiumBenefitText, { color: theme.text }]}>
                                    Asistente IA personalizado
                                </Text>
                            </View>
                            <View style={styles.premiumBenefitItem}>
                                <Ionicons name="videocam" size={24} color="#EF4444" />
                                <Text style={[styles.premiumBenefitText, { color: theme.text }]}>
                                    Videos de ejercicios
                                </Text>
                            </View>
                            <View style={styles.premiumBenefitItem}>
                                <Ionicons name="analytics" size={24} color="#3B82F6" />
                                <Text style={[styles.premiumBenefitText, { color: theme.text }]}>
                                    Estadísticas avanzadas
                                </Text>
                            </View>
                            <View style={styles.premiumBenefitItem}>
                                <Ionicons name="star" size={24} color="#F59E0B" />
                                <Text style={[styles.premiumBenefitText, { color: theme.text }]}>
                                    Rutinas premium exclusivas
                                </Text>
                            </View>
                        </View>

                        {/* More confetti */}
                        <View style={styles.premiumConfettiBottom}>
                            <Text style={styles.confettiEmoji}>💪</Text>
                            <Text style={styles.confettiEmoji}>🔥</Text>
                            <Text style={styles.confettiEmoji}>⭐</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.premiumSuccessButton, { backgroundColor: '#FFD700' }]}
                            onPress={() => setShowPremiumSuccessModal(false)}
                        >
                            <Text style={styles.premiumSuccessButtonText}>¡A ENTRENAR!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal >

            {/* Code Error Modal */}
            <Modal visible={codeErrorModal.visible} transparent animationType="fade" onRequestClose={() => setCodeErrorModal({ visible: false, message: '' })}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.premiumSuccessCard, { borderColor: '#EF4444' }]}>
                        <View style={{ marginBottom: 16 }}>
                            <Ionicons name="close-circle" size={70} color="#EF4444" />
                        </View>
                        <Text style={styles.premiumSuccessTitle}>❌ Código no válido</Text>
                        <Text style={[styles.premiumSuccessSubtitle, { color: '#9CA3AF' }]}>
                            {codeErrorModal.message}
                        </Text>
                        <TouchableOpacity
                            style={[styles.premiumSuccessButton, { backgroundColor: '#EF4444', marginTop: 20 }]}
                            onPress={() => setCodeErrorModal({ visible: false, message: '' })}
                        >
                            <Text style={styles.premiumSuccessButtonText}>Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            < Modal visible={showReferralModal} transparent animationType="fade" onRequestClose={() => setShowReferralModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                        <View style={[styles.premiumCodeIconContainer, { backgroundColor: theme.primaryLight }]}>
                            <Ionicons name="people" size={40} color={theme.primary} />
                        </View>

                        <Text style={[styles.modalTitle, { color: theme.text }]}>Código de Amigo</Text>
                        <Text style={[styles.premiumCodeDescription, { color: theme.textSecondary }]}>
                            Introduce el código de referido de un amigo y ambos recibiréis 1 semana de premium gratis
                        </Text>

                        <TextInput
                            style={[styles.premiumCodeInput, {
                                backgroundColor: theme.background,
                                color: theme.text,
                                borderColor: theme.border
                            }]}
                            value={referralCodeInput}
                            onChangeText={setReferralCodeInput}
                            placeholder="TOTALGAINXXXXX"
                            placeholderTextColor={theme.textSecondary}
                            autoCapitalize="characters"
                            editable={!isRedeemingReferral}
                        />

                        <View style={styles.premiumCodeButtons}>
                            <Pressable
                                onPress={() => {
                                    setShowReferralModal(false);
                                    setReferralCodeInput('');
                                }}
                                style={[styles.premiumCodeCancelBtn, { borderColor: theme.border }]}
                                disabled={isRedeemingReferral}
                            >
                                <Text style={{ color: theme.text }}>Cancelar</Text>
                            </Pressable>

                            <Pressable
                                onPress={handleRedeemReferralCode}
                                style={[styles.premiumCodeSubmitBtn, { backgroundColor: theme.primary, opacity: isRedeemingReferral ? 0.6 : 1 }]}
                                disabled={isRedeemingReferral}
                            >
                                {isRedeemingReferral ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.premiumCodeSubmitText}>Canjear</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal >

            {/* Referral Success Modal */}
            < Modal visible={showReferralSuccessModal} transparent animationType="fade" onRequestClose={() => setShowReferralSuccessModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.successModalCard, { backgroundColor: theme.backgroundSecondary }]}>
                        {/* Trophy Icon */}
                        <View style={[styles.successIconContainer, { backgroundColor: theme.primaryLight }]}>
                            <Ionicons name="people" size={60} color={theme.primary} />
                        </View>

                        {/* Congratulations Text */}
                        <Text style={[styles.successTitle, { color: theme.primary }]}>
                            ¡GENIAL!
                        </Text>

                        <Text style={[styles.successMessage, { color: theme.text }]}>
                            {referralSuccessMessage || '¡Código canjeado correctamente!'}
                        </Text>

                        <View style={[styles.divider, { marginVertical: 20, width: '80%' }]} />

                        <View style={styles.benefitsContainer}>
                            <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                            <Text style={[styles.benefitsText, { color: theme.text }]}>
                                +7 días de Premium activados
                            </Text>
                        </View>

                        {/* Confetti decoration */}
                        <View style={styles.confettiContainer}>
                            <Text style={styles.confettiEmoji}>🎉</Text>
                            <Text style={styles.confettiEmoji}>🤝</Text>
                            <Text style={styles.confettiEmoji}>✨</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.successButton, { backgroundColor: theme.primary }]}
                            onPress={() => setShowReferralSuccessModal(false)}
                        >
                            <Text style={styles.successButtonText}>¡PERFECTO!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal >

            {/* 🔄 Modal de sincronización de datos */}
            <SyncProgressModal
                visible={syncModal.visible}
                direction={syncModal.direction}
                isComplete={syncModal.isComplete}
                itemsSynced={syncModal.itemsSynced}
                onDismiss={() => setSyncModal(prev => ({ ...prev, visible: false }))}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? 36 : 0,
    },
    scrollContainer: {
        alignItems: 'center',
        paddingBottom: 40,
    },
    blob: {
        position: 'absolute',
        width: Platform.OS === 'android' ? 220 : 280,
        height: Platform.OS === 'android' ? 220 : 280,
        borderRadius: 160,
        opacity: Platform.OS === 'android' ? 0.12 : 0.25,
        filter: Platform.OS === 'web' ? 'blur(70px)' : undefined,
        // En Android, simular difuminado con bordes suaves
        ...(Platform.OS === 'android' && {
            borderWidth: 40,
            borderColor: 'rgba(59, 130, 246, 0.05)',
        }),
    },
    blobTop: { top: -60, left: -60 },
    blobBottom: {
        bottom: -50,
        right: -50,
        ...(Platform.OS === 'android' && {
            borderColor: 'rgba(16, 185, 129, 0.05)',
        }),
    },

    header: {
        alignItems: 'center',
        paddingTop: 30,
        paddingBottom: 10,
        width: '100%',
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        marginBottom: 16,
        position: 'relative',
    },
    avatarContainerVIP: {
        borderWidth: 3,
        borderColor: '#FFD700',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
        elevation: 10,
    },
    vipBadge: {
        position: 'absolute',
        top: -5,
        right: -5,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFD700',
    },
    avatarEmoji: {
        fontSize: 50,
    },
    editIconBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    userInfo: {
        alignItems: 'center',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    username: {
        fontSize: 16,
        marginBottom: 12,
    },
    badgesRow: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    // Subscription Expiry Banner
    subscriptionExpiryBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        width: '100%',
    },
    subscriptionExpiryText: {
        fontSize: 13,
        fontWeight: '600',
    },
    subscriptionRenewLink: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
        textDecorationLine: 'underline',
    },

    // Referral Code Styles
    referralSection: {
        marginTop: 16,
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 20,
    },
    referralLabel: {
        fontSize: 12,
        marginBottom: 8,
    },
    referralCodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    referralCodeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 2,
    },
    referralCodeText: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
    },
    referralButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    enterReferralButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    enterReferralButtonText: {
        fontSize: 13,
        fontWeight: '600',
    },

    // Referral Banner Styles (simplified)
    referralBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        marginHorizontal: 20,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    referralBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    referralBannerText: {
        gap: 2,
    },
    referralBannerTitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    referralBannerSubtitle: {
        fontSize: 12,
    },

    divider: {
        width: '90%',
        height: 1,
        backgroundColor: 'rgba(150,150,150,0.2)',
        marginVertical: 8,
    },
    menuContainer: {
        width: '100%',
        maxWidth: 600,
        paddingHorizontal: 20,
        marginTop: 4,
        alignItems: 'center',
        alignSelf: 'center',
    },
    menuGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '100%',
        ...Platform.select({
            web: {
                gap: 1,
            },
            default: {},
        }),
    },
    menuCard: {
        marginVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        paddingVertical: 16,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 120,
        marginBottom: Platform.OS === 'web' ? 0 : 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
            web: {
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            },
        }),
    },
    menuCardIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    menuCardTitle: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 18,
    },
    menuCardChevron: {
        position: 'absolute',
        top: 10,
        right: 10,
        opacity: 0.5,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        maxWidth: 280,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1.5,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
            },
            default: {},
        }),
    },
    logoutButtonText: {
        fontSize: 15,
        fontWeight: '700',
    },
    menuItemWrapper: {
        marginBottom: 12,
    },

    /* Modal */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    avatarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 20,
    },
    avatarOption: {
        width: 80,
        height: 80,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
        backgroundColor: 'rgba(150,150,150,0.1)',
    },
    avatarOptionEmoji: {
        fontSize: 32,
        marginBottom: 4,
    },
    avatarOptionName: {
        fontSize: 12,
        fontWeight: '500',
    },
    closeBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },

    // Gender Selector Styles
    genderSelector: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
        width: '100%',
        justifyContent: 'center',
    },
    genderButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: 'center',
    },
    genderButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    premiumBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 10,
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Trainer Section Styles
    trainerSection: {
        width: '100%',
        minWidth: '60%',
        marginTop: 16,
        paddingHorizontal: 16,
    },
    currentTrainerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    currentTrainerLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    currentTrainerName: {
        fontSize: 14,
        fontWeight: '700',
        marginTop: 2,
    },
    trainerInputSection: {
        width: '100%',
        minWidth: '60%',
    },
    trainerInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    trainerInput: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 14,
        fontWeight: '600',
    },
    linkButton: {
        width: 44,
        height: 44,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Success Modal Styles
    successModalCard: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    successIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    successTitle: {
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 16,
        textAlign: 'center',
    },
    successMessage: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: 1,
    },
    trainerNameText: {
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: 1.5,
    },
    benefitsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    benefitsText: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        letterSpacing: 0.8,
    },
    premiumText: {
        fontSize: 18,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: 1.2,
        marginBottom: 24,
    },
    confettiContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 24,
    },
    confettiEmoji: {
        fontSize: 32,
    },
    successButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    successButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1.5,
    },

    // Premium Code Modal Styles
    premiumCodeIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    premiumCodeDescription: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    premiumCodeInput: {
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 20,
    },
    premiumCodeButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    premiumCodeCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    premiumCodeSubmitBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    premiumCodeSubmitText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    premiumCodeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 2,
        marginTop: 12,
    },
    premiumCodeButtonText: {
        fontWeight: '700',
        fontSize: 14,
    },

    // Premium Success Modal Styles
    premiumSuccessModalCard: {
        width: '90%',
        maxWidth: 360,
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    premiumConfettiTop: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
        marginBottom: 16,
    },
    premiumConfettiBottom: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
        marginTop: 16,
        marginBottom: 16,
    },
    premiumCrownContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    premiumSuccessTitle: {
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: 2,
        textAlign: 'center',
    },
    premiumSuccessSubtitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: 1.5,
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 16,
    },
    premiumDivider: {
        height: 2,
        width: '80%',
        marginBottom: 16,
    },
    premiumBenefitsTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 16,
        textAlign: 'center',
    },
    premiumBenefitsList: {
        width: '100%',
        gap: 12,
    },
    premiumBenefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255, 215, 0, 0.08)',
        borderRadius: 10,
    },
    premiumBenefitText: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
    },
    premiumSuccessButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    premiumSuccessButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
});
