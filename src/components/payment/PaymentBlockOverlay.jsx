import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Animated, Platform, Dimensions, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * PaymentBlockOverlay - Level 3 Component
 * 
 * High friction blocking overlay for overdue payments
 * Cannot be dismissed - must report payment or contact coach
 */
export function PaymentBlockOverlay({
    visible,
    isRejected,
    daysOverdue,
    amount,
    coachName,
    bizumPhone,
    onCopyBizum,
    onReportPayment,
    onOpenWhatsApp,
    isReporting
}) {
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [note, setNote] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true
                })
            ]).start();
        }
    }, [visible]);

    const handleReportPayment = async () => {
        const result = await onReportPayment?.(note);
        if (result?.success) {
            setShowSuccess(true);
        }
    };

    if (!visible) return null;

    const bgColor = isRejected ? '#dc2626' : '#ef4444';
    const headerIcon = isRejected ? 'alert-circle' : 'time-outline';
    const headerTitle = isRejected
        ? 'Pago no verificado'
        : 'Pago pendiente';
    const headerMessage = isRejected
        ? `${coachName} no ha podido verificar tu pago anterior. Por favor, inténtalo de nuevo o contáctale directamente.`
        : daysOverdue === 1
            ? 'Tu plan venció ayer. Regularízalo para desbloquear tu rutina.'
            : `Tu plan venció hace ${daysOverdue} días. Regularízalo para continuar.`;

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View style={styles.container}>
                {/* Blur Background */}
                {Platform.OS !== 'web' && (
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                )}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <Animated.View
                        style={[
                            styles.card,
                            {
                                transform: [{ scale: scaleAnim }],
                                opacity: opacityAnim
                            }
                        ]}
                    >
                        {showSuccess ? (
                            /* Success State */
                            <View style={styles.successContainer}>
                                <View style={styles.successIconContainer}>
                                    <Ionicons name="checkmark-circle" size={80} color="#10b981" />
                                </View>
                                <Text style={styles.successTitle}>¡Reportado!</Text>
                                <Text style={styles.successMessage}>
                                    Tu entrenador verificará el pago pronto. Tienes acceso temporal por 24 horas.
                                </Text>
                            </View>
                        ) : (
                            <>
                                {/* Header Icon */}
                                <View style={[styles.headerIcon, { backgroundColor: bgColor }]}>
                                    <Ionicons name={headerIcon} size={40} color="#fff" />
                                </View>

                                {/* Title & Message */}
                                <Text style={styles.title}>{headerTitle}</Text>
                                <Text style={styles.message}>{headerMessage}</Text>

                                {/* Amount Display */}
                                <View style={styles.amountBox}>
                                    <Text style={styles.amountLabel}>Importe pendiente</Text>
                                    <Text style={styles.amountValue}>{amount}€</Text>
                                </View>

                                {/* Bizum / Method Display */}
                                {bizumPhone ? (
                                    <TouchableOpacity style={styles.bizumBtn} onPress={onCopyBizum}>
                                        <Ionicons name="copy-outline" size={20} color="#3b82f6" />
                                        <Text style={styles.bizumText}>Copiar Bizum ({bizumPhone})</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.noBizumNote}>
                                        <Ionicons name="information-circle-outline" size={18} color="#64748b" />
                                        <Text style={styles.noBizumText}>Realiza el pago a tu entrenador y contáctale para verificar.</Text>
                                    </View>
                                )}

                                {/* Note Input (Optional) */}
                                {showNoteInput ? (
                                    <View style={styles.noteContainer}>
                                        <TextInput
                                            style={styles.noteInput}
                                            placeholder="Ej: Te hice Bizum desde la cuenta de mi madre"
                                            placeholderTextColor="#94a3b8"
                                            value={note}
                                            onChangeText={setNote}
                                            multiline
                                            maxLength={200}
                                        />
                                        <Text style={styles.noteHint}>{note.length}/200</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.addNoteBtn}
                                        onPress={() => setShowNoteInput(true)}
                                    >
                                        <Ionicons name="add-circle-outline" size={18} color="#64748b" />
                                        <Text style={styles.addNoteText}>Añadir nota (opcional)</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Primary Action */}
                                <TouchableOpacity
                                    style={[styles.primaryBtn, isReporting && styles.primaryBtnDisabled]}
                                    onPress={handleReportPayment}
                                    disabled={isReporting}
                                >
                                    {isReporting ? (
                                        <Text style={styles.primaryBtnText}>Enviando...</Text>
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={22} color="#fff" />
                                            <Text style={styles.primaryBtnText}>Ya he pagado</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {/* Panic Button - WhatsApp */}
                                <TouchableOpacity style={styles.panicBtn} onPress={onOpenWhatsApp}>
                                    <Ionicons name="logo-whatsapp" size={16} color="#64748b" />
                                    <Text style={styles.panicText}>Contactar por problema de facturación</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </Animated.View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 20,
    },
    headerIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 10,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    amountBox: {
        width: '100%',
        backgroundColor: '#fef2f2',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    amountLabel: {
        fontSize: 12,
        color: '#ef4444',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    amountValue: {
        fontSize: 40,
        color: '#dc2626',
    },
    bizumBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        backgroundColor: '#eff6ff',
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    bizumText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#2563eb',
    },
    noBizumNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f1f5f9',
        padding: 14,
        borderRadius: 12,
        marginBottom: 20,
    },
    noBizumText: {
        flex: 1,
        fontSize: 13,
        color: '#64748b',
    },
    addNoteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 20,
    },
    addNoteText: {
        fontSize: 14,
        color: '#64748b',
    },
    noteContainer: {
        width: '100%',
        marginBottom: 20,
    },
    noteInput: {
        width: '100%',
        minHeight: 80,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: '#0f172a',
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    noteHint: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'right',
        marginTop: 4,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
        backgroundColor: '#10b981',
        paddingVertical: 18,
        borderRadius: 14,
        marginBottom: 16,
    },
    primaryBtnDisabled: {
        opacity: 0.7,
    },
    primaryBtnText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#fff',
    },
    panicBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
    },
    panicText: {
        fontSize: 13,
        color: '#64748b',
        textDecorationLine: 'underline',
    },
    // Success state
    successContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    successIconContainer: {
        marginBottom: 20,
    },
    successTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#10b981',
        marginBottom: 12,
    },
    successMessage: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
    },
});

export default PaymentBlockOverlay;
