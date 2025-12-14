import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl,
    Platform,
    Share,
    Modal,
    TextInput,
    Alert
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAchievements } from '../../../context/AchievementsContext';
import SyncProgressModal from '../../../components/SyncProgressModal';
import { syncLocalToCloud } from '../../../src/lib/dataSyncService';

// Constantes para cálculo de ahorro
const MONTHLY_PRICE_ORIGINAL = 4.99; // €/mes (precio sin descuento)
const DAILY_PRICE = MONTHLY_PRICE_ORIGINAL / 30; // ~0.166€/día
const REFERRAL_DAYS = 7; // Días regalados por referido
const SAVINGS_PER_REFERRAL = DAILY_PRICE * REFERRAL_DAYS; // ~1.16€

export default function Comunidad() {
    const { theme, isDark } = useTheme();
    const { user, token, refreshUser } = useAuth();
    const { updateStats, checkAchievements } = useAchievements();

    const [referredUsers, setReferredUsers] = useState([]);
    const [referralStats, setReferralStats] = useState({
        total: 0,
        premiumDays: 0,
        moneySaved: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);

    // Modal para canjear código de amigo
    const [showRedeemModal, setShowRedeemModal] = useState(false);
    const [redeemCode, setRedeemCode] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);

    // 🔄 Estado para modal de sincronización de datos
    const [syncModal, setSyncModal] = useState({
        visible: false,
        direction: 'upload',
        isComplete: false,
        itemsSynced: 0,
    });

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    const gradientColors = isDark
        ? ['#0B1220', '#0D1B2A', '#111827']
        : ['#f0f4f8', '#e0e7ef', '#d1dce6'];

    useEffect(() => {
        // Refrescar usuario para obtener código de referido actualizado
        refreshUser();
        fetchMyReferrals();
    }, []);

    const fetchMyReferrals = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API_URL}/api/referrals/my-referrals`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success) {
                setReferredUsers(data.referrals || []);
                const total = data.stats?.total || 0;
                const premiumDays = data.stats?.premiumDays || total * REFERRAL_DAYS;
                setReferralStats({
                    total,
                    premiumDays,
                    moneySaved: parseFloat((total * SAVINGS_PER_REFERRAL).toFixed(2))
                });

                // Sincronizar stats de referrals con el sistema de logros
                updateStats({ referrals: total });
                checkAchievements({ referrals: total });
            }
        } catch (error) {
            console.error('[Comunidad] Error fetching referrals:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchMyReferrals();
    };

    const handleCopyCode = async () => {
        if (user?.referralCode) {
            await Clipboard.setStringAsync(user.referralCode);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
        }
    };

    const handleShareCode = async () => {
        if (user?.referralCode) {
            try {
                await Share.share({
                    message: `¡Únete a TotalGains con mi código ${user.referralCode} y consigue 1 semana de premium gratis! 💪🔥`,
                });
            } catch (error) {
                console.error('[Comunidad] Error sharing:', error);
            }
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    // Función unificada: intenta canjear como referido, si falla intenta como código promocional
    const handleRedeemCode = async () => {
        if (!redeemCode.trim()) {
            Alert.alert('Error', 'Por favor ingresa un código');
            return;
        }

        setIsRedeeming(true);
        const codeToRedeem = redeemCode.trim().toUpperCase();

        try {
            // Primero intentar como código de referido
            const referralResponse = await fetch(`${API_URL}/api/referrals/redeem`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ code: codeToRedeem })
            });

            const referralData = await referralResponse.json();

            if (referralData.success) {
                // 🔄 FREE → PREMIUM: Subir datos locales antes de cambiar de plan
                const previousType = user?.tipoUsuario;
                if (previousType === 'FREEUSER') {
                    setSyncModal({ visible: true, direction: 'upload', isComplete: false, itemsSynced: 0 });
                    try {
                        const syncResult = await syncLocalToCloud(token);
                        setSyncModal(prev => ({ ...prev, isComplete: true, itemsSynced: syncResult?.itemsSynced || 0 }));
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (syncErr) {
                        console.warn('[Comunidad] Error sincronizando:', syncErr);
                    }
                    setSyncModal(prev => ({ ...prev, visible: false }));
                }
                await refreshUser();
                setShowRedeemModal(false);
                setRedeemCode('');
                Alert.alert('¡Genial! 🎉', referralData.message || '¡Has conseguido 7 días de premium gratis!');
                fetchMyReferrals();
                return;
            }

            // Si no es código de referido, intentar como código promocional
            console.log('[Comunidad] No es código de referido, probando como promo...');

            const promoResponse = await fetch(`${API_URL}/api/promo-codes/redeem`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ code: codeToRedeem })
            });

            const promoData = await promoResponse.json();

            if (promoData.success) {
                // 🔄 FREE → PREMIUM: Subir datos locales antes de cambiar de plan  
                const previousType = user?.tipoUsuario;
                if (previousType === 'FREEUSER') {
                    setSyncModal({ visible: true, direction: 'upload', isComplete: false, itemsSynced: 0 });
                    try {
                        const syncResult = await syncLocalToCloud(token);
                        setSyncModal(prev => ({ ...prev, isComplete: true, itemsSynced: syncResult?.itemsSynced || 0 }));
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (syncErr) {
                        console.warn('[Comunidad] Error sincronizando:', syncErr);
                    }
                    setSyncModal(prev => ({ ...prev, visible: false }));
                }
                await refreshUser();
                setShowRedeemModal(false);
                setRedeemCode('');
                Alert.alert('¡Felicidades! 🌟', promoData.message || '¡Código promocional canjeado con éxito!');
                return;
            }

            // Ninguno de los dos funcionó
            Alert.alert('Código inválido', promoData.message || referralData.message || 'Este código no existe o ya ha sido usado');

        } catch (error) {
            console.error('[Comunidad] Error redeeming:', error);
            Alert.alert('Error', 'No se pudo canjear el código. Verifica tu conexión.');
        } finally {
            setIsRedeeming(false);
        }
    };

    return (
        <View style={styles.root}>
            <Stack.Screen options={{ headerShown: false }} />
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Comunidad</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                    Invita amigos y gana premium gratis
                </Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.primary}
                    />
                }
            >
                {/* Your Code Section */}
                <View style={[styles.codeCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                    <View style={styles.codeHeader}>
                        <Ionicons name="gift" size={24} color={theme.primary} />
                        <Text style={[styles.codeTitle, { color: theme.text }]}>Tu código de invitación</Text>
                    </View>

                    <View style={[styles.codeBox, { backgroundColor: theme.background, borderColor: theme.primary }]}>
                        <Text style={[styles.codeText, { color: theme.primary }]}>
                            {user?.referralCode || 'Cargando...'}
                        </Text>
                    </View>

                    <View style={styles.codeActions}>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: codeCopied ? theme.success : theme.primary }]}
                            onPress={handleCopyCode}
                        >
                            <Ionicons name={codeCopied ? "checkmark" : "copy-outline"} size={20} color="#fff" />
                            <Text style={styles.actionButtonText}>{codeCopied ? 'Copiado' : 'Copiar'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: '#25D366' }]}
                            onPress={handleShareCode}
                        >
                            <Ionicons name="share-social" size={20} color="#fff" />
                            <Text style={styles.actionButtonText}>Compartir</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.codeHint, { color: theme.textSecondary }]}>
                        Por cada amigo que use tu código, ambos recibiréis 7 días de premium 🎉
                    </Text>

                    {/* VIP Button to redeem codes (referral or promo) */}
                    <TouchableOpacity
                        style={[styles.vipRedeemButton, {
                            borderColor: '#FFD700',
                            backgroundColor: 'rgba(255, 215, 0, 0.1)'
                        }]}
                        onPress={() => setShowRedeemModal(true)}
                    >
                        <Ionicons name="star" size={18} color="#FFD700" />
                        <Text style={[styles.vipRedeemButtonText, { color: '#FFD700' }]}>
                            Canjear código VIP
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color="#FFD700" />
                    </TouchableOpacity>
                </View>

                {/* Stats Section */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                        <View style={[styles.statIconBg, { backgroundColor: theme.primaryLight }]}>
                            <Ionicons name="people" size={24} color={theme.primary} />
                        </View>
                        <Text style={[styles.statValue, { color: theme.text }]}>{referralStats.total}</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Amigos invitados</Text>
                    </View>

                    <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                        <View style={[styles.statIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                            <Ionicons name="calendar" size={24} color="#10B981" />
                        </View>
                        <Text style={[styles.statValue, { color: theme.text }]}>{referralStats.premiumDays}</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Días premium</Text>
                    </View>

                    <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                        <View style={[styles.statIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                            <Ionicons name="cash" size={24} color="#F59E0B" />
                        </View>
                        <Text style={[styles.statValue, { color: theme.text }]}>{referralStats.moneySaved.toFixed(2)}€</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Ahorro total</Text>
                    </View>
                </View>

                {/* Friends List */}
                <View style={styles.friendsSection}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        <Ionicons name="trophy" size={18} color={theme.primary} /> Amigos invitados
                    </Text>

                    {isLoading ? (
                        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
                    ) : referredUsers.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIconBg, { backgroundColor: theme.backgroundSecondary }]}>
                                <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: theme.text }]}>
                                Aún no tienes amigos invitados
                            </Text>
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                Comparte tu código y empieza a ganar días de premium gratis para ti y tus amigos
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.friendsList}>
                            {referredUsers.map((friend, index) => (
                                <View
                                    key={friend.id || index}
                                    style={[styles.friendCard, {
                                        backgroundColor: theme.backgroundSecondary,
                                        borderColor: theme.border
                                    }]}
                                >
                                    <View style={[styles.friendAvatar, { backgroundColor: theme.primaryLight }]}>
                                        <Text style={styles.friendAvatarText}>
                                            {(friend.nombre || 'U').charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={styles.friendInfo}>
                                        <Text style={[styles.friendName, { color: theme.text }]}>
                                            {friend.nombre || 'Usuario'}
                                        </Text>
                                        {friend.username && (
                                            <Text style={[styles.friendUsername, { color: theme.textSecondary }]}>
                                                @{friend.username}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={styles.friendMeta}>
                                        <View style={[styles.friendBadge, { backgroundColor: theme.successLight }]}>
                                            <Text style={[styles.friendBadgeText, { color: theme.successText }]}>
                                                +7 días
                                            </Text>
                                        </View>
                                        <Text style={[styles.friendDate, { color: theme.textSecondary }]}>
                                            {formatDate(friend.referredAt)}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

            </ScrollView>

            {/* VIP Code Redemption Modal */}
            <Modal visible={showRedeemModal} transparent animationType="fade" onRequestClose={() => setShowRedeemModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.backgroundSecondary }]}>
                        {/* VIP Icon */}
                        <View style={[styles.modalVipIcon, { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]}>
                            <Ionicons name="star" size={32} color="#FFD700" />
                        </View>

                        <Text style={[styles.modalTitle, { color: '#FFD700' }]}>Canjear Código VIP</Text>
                        <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                            Introduce tu código de amigo o código promocional para obtener beneficios premium
                        </Text>

                        <TextInput
                            style={[styles.modalInput, {
                                backgroundColor: theme.background,
                                color: theme.text,
                                borderColor: '#FFD700'
                            }]}
                            value={redeemCode}
                            onChangeText={setRedeemCode}
                            placeholder="Ej: TOTALGAIN... o PROMO..."
                            placeholderTextColor={theme.textSecondary}
                            autoCapitalize="characters"
                            editable={!isRedeeming}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                                onPress={() => { setShowRedeemModal(false); setRedeemCode(''); }}
                                disabled={isRedeeming}
                            >
                                <Text style={{ color: theme.text }}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalSubmitBtn, { backgroundColor: '#FFD700', opacity: isRedeeming ? 0.6 : 1 }]}
                                onPress={handleRedeemCode}
                                disabled={isRedeeming}
                            >
                                {isRedeeming ? (
                                    <ActivityIndicator size="small" color="#000" />
                                ) : (
                                    <Text style={styles.modalSubmitText}>Canjear</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 🔄 Modal de sincronización de datos */}
            <SyncProgressModal
                visible={syncModal.visible}
                direction={syncModal.direction}
                isComplete={syncModal.isComplete}
                itemsSynced={syncModal.itemsSynced}
                onDismiss={() => setSyncModal(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? 36 : 50,
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },

    // Code Card
    codeCard: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        marginBottom: 20,
    },
    codeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    codeTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    codeBox: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        marginBottom: 16,
    },
    codeText: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: 2,
    },
    codeActions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
    },
    actionButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    codeHint: {
        fontSize: 13,
        textAlign: 'center',
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        alignItems: 'center',
    },
    statIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '800',
    },
    statLabel: {
        fontSize: 11,
        textAlign: 'center',
        marginTop: 2,
    },

    // Friends Section
    friendsSection: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    friendsList: {
        gap: 12,
    },
    friendCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    friendAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    friendAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#3B82F6',
    },
    friendInfo: {
        flex: 1,
        marginLeft: 12,
    },
    friendName: {
        fontSize: 15,
        fontWeight: '600',
    },
    friendUsername: {
        fontSize: 12,
        marginTop: 2,
    },
    friendMeta: {
        alignItems: 'flex-end',
    },
    friendBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    friendBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    friendDate: {
        fontSize: 10,
        marginTop: 4,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    emptyIconBg: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Redeem Button
    redeemButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1.5,
    },
    redeemButtonText: {
        fontSize: 13,
        fontWeight: '600',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
    },
    modalInput: {
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 10,
        borderWidth: 1,
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    modalSubmitBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    modalSubmitText: {
        color: '#000',
        fontWeight: '700',
    },

    // VIP Styles
    vipRedeemButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 10,
        borderWidth: 2,
    },
    vipRedeemButtonText: {
        fontSize: 14,
        fontWeight: '700',
        flex: 1,
        textAlign: 'center',
    },
    modalVipIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
});
