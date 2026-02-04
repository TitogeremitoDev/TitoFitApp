import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * PaymentToast - Level 1 Component
 * 
 * Friendly reminder 2 days before payment
 * Dismissible banner that appears at the top
 */
export function PaymentToast({ visible, level = 1, userName, daysUntil, daysOverdue, onDismiss }) {
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: Platform.OS !== 'web'
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: Platform.OS !== 'web'
                })
            ]).start();

            // Auto dismiss after 10 seconds
            const timer = setTimeout(() => {
                handleDismiss();
            }, 10000);

            return () => clearTimeout(timer);
        }
    }, [visible]);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true
            })
        ]).start(() => {
            onDismiss?.();
        });
    };

    if (!visible) return null;

    const firstName = userName?.split(' ')[0] || 'Atleta';

    let messageContent;

    if (level === 1) {
        // Upcoming (2 days before)
        const daysText = daysUntil === 1 ? 'mañana' : `en ${daysUntil} días`;
        messageContent = (
            <>
                Hola <Text style={styles.bold}>{firstName}</Text>, recuerda que en {daysText} dias tocar renovar tu plan con tu entrenador.
                ¡Prepárate para seguir subiendo de nivel! 💪
            </>
        );
    } else if (level === 2) {
        // Due Today
        messageContent = (
            <>
                Hola <Text style={styles.bold}>{firstName}</Text>, hoy toca pagar a tu entrenador. ¡Hazlo hoy para mantener tu plan al día y seguir dándole caña! 🔥
            </>
        );
    } else if (level === 3) {
        // Overdue 1-5 days
        messageContent = (
            <>
                Recordatorio: hace {daysOverdue} días que tenías que pagar a tu entrenador. ¡Hazlo pronto para seguir con tu ritmo de entrenamiento! ⚡️
            </>
        );
    } else {
        // Default / Fallback
        messageContent = (
            <>
                Hola <Text style={styles.bold}>{firstName}</Text>, recuerda renovar tu plan con tu entrenador.
            </>
        );
    }

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim
                }
            ]}
        >
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="calendar-outline" size={20} color="#10b981" />
                </View>
                <Text style={styles.message}>
                    {messageContent}
                </Text>
                <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss}>
                    <Ionicons name="close" size={18} color="#64748b" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        paddingHorizontal: 16,
        paddingTop: 60, // Safe area
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#a7f3d0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#d1fae5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    message: {
        flex: 1,
        fontSize: 14,
        color: '#065f46',
        lineHeight: 20,
    },
    bold: {
        fontWeight: '700',
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#d1fae5',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
});

export default PaymentToast;
