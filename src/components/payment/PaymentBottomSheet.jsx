import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Modal, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * PaymentBottomSheet - Level 2 Component
 * 
 * Medium friction modal on payment day
 * Shows payment options and can be dismissed for the day
 */
export function PaymentBottomSheet({
    visible,
    amount,
    bizumPhone,
    onCopyBizum,
    onReportPayment,
    onDismiss,
    isReporting
}) {
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 10,
                    useNativeDriver: true
                }),
                Animated.timing(backdropAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 250,
                    useNativeDriver: true
                }),
                Animated.timing(backdropAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true
                })
            ]).start();
        }
    }, [visible]);

    const handleCopyBizum = () => {
        onCopyBizum?.();
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleReportPayment = async () => {
        const result = await onReportPayment?.();
        if (result?.success) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 2000);
        }
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none">
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.backdrop,
                        { opacity: backdropAnim }
                    ]}
                />

                <Animated.View
                    style={[
                        styles.sheet,
                        { transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    {/* Handle */}
                    <View style={styles.handle} />

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.emoji}>🚀</Text>
                        <Text style={styles.title}>¡Hoy es el día!</Text>
                        <Text style={styles.subtitle}>Renueva tu plan para seguir progresando</Text>
                    </View>

                    {/* Amount */}
                    <View style={styles.amountContainer}>
                        <Text style={styles.amountLabel}>Importe</Text>
                        <Text style={styles.amount}>{amount}€</Text>
                    </View>

                    {/* Primary Action - Copy Bizum */}
                    {bizumPhone ? (
                        <TouchableOpacity style={styles.primaryBtn} onPress={handleCopyBizum}>
                            <Ionicons name="copy-outline" size={20} color="#fff" />
                            <Text style={styles.primaryBtnText}>Copiar Bizum ({bizumPhone})</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.noBizumNote}>
                            <Ionicons name="information-circle-outline" size={18} color="#64748b" />
                            <Text style={styles.noBizumText}>Realiza el pago a tu entrenador y contáctale para verificar.</Text>
                        </View>
                    )}

                    {/* Secondary Action - Report Payment */}
                    <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={handleReportPayment}
                        disabled={isReporting}
                    >
                        {isReporting ? (
                            <Text style={styles.secondaryBtnText}>Enviando...</Text>
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                                <Text style={styles.secondaryBtnText}>Ya he realizado el pago</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Dismiss */}
                    <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
                        <Text style={styles.dismissText}>Omitir por hoy</Text>
                    </TouchableOpacity>

                    {/* Success Animation */}
                    {showConfetti && (
                        <View style={styles.successOverlay}>
                            <View style={styles.successIcon}>
                                <Ionicons name="checkmark-circle" size={80} color="#10b981" />
                            </View>
                            <Text style={styles.successText}>¡Recibido!</Text>
                            <Text style={styles.successSubtext}>Tu entrenador lo verificará pronto</Text>
                        </View>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 20,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#e2e8f0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    emoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
    },
    amountContainer: {
        alignItems: 'center',
        marginBottom: 28,
        paddingVertical: 20,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
    },
    amountLabel: {
        fontSize: 13,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    amount: {
        fontSize: 48,
        fontWeight: '900',
        color: '#0f172a',
        letterSpacing: -1,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#3b82f6',
        paddingVertical: 16,
        borderRadius: 14,
        marginBottom: 12,
    },
    primaryBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    noBizumNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f1f5f9',
        padding: 14,
        borderRadius: 12,
        marginBottom: 12,
    },
    noBizumText: {
        flex: 1,
        fontSize: 13,
        color: '#64748b',
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#ecfdf5',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#a7f3d0',
        marginBottom: 16,
    },
    secondaryBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#059669',
    },
    dismissBtn: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    dismissText: {
        fontSize: 14,
        color: '#94a3b8',
    },
    successOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    successIcon: {
        marginBottom: 16,
    },
    successText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#10b981',
        marginBottom: 4,
    },
    successSubtext: {
        fontSize: 15,
        color: '#64748b',
    },
});

export default PaymentBottomSheet;
