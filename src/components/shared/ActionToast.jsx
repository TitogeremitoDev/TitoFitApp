/**
 * ActionToast.jsx
 * Componente Toast no intrusivo con acción opcional
 * Para confirmaciones rápidas sin interrumpir el flujo de trabajo
 */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ActionToast({
    visible,
    message,
    submessage = '',
    icon = 'checkmark-circle',
    iconColor = '#10b981',
    actionLabel = null,
    onAction = null,
    onDismiss,
    duration = 4000, // Auto-dismiss after 4 seconds
    position = 'top' // 'top' or 'bottom'
}) {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef(null);

    useEffect(() => {
        if (visible) {
            // Slide in
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 80,
                    friction: 10,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-dismiss
            timerRef.current = setTimeout(() => {
                handleDismiss();
            }, duration);
        } else {
            // Reset position when hidden
            translateY.setValue(position === 'top' ? -100 : 100);
            opacity.setValue(0);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [visible]);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: position === 'top' ? -100 : 100,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss?.();
        });
    };

    const handleAction = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        onAction?.();
        handleDismiss();
    };

    if (!visible) return null;

    const positionStyle = position === 'top'
        ? { top: insets.top + 16 }
        : { bottom: insets.bottom + 16 };

    return (
        <Animated.View
            style={[
                styles.container,
                positionStyle,
                {
                    transform: [{ translateY }],
                    opacity,
                },
            ]}
        >
            <TouchableOpacity
                style={styles.toast}
                activeOpacity={0.9}
                onPress={handleDismiss}
            >
                {/* Icono */}
                <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
                    <Ionicons name={icon} size={24} color={iconColor} />
                </View>

                {/* Texto */}
                <View style={styles.textContainer}>
                    <Text style={styles.message} numberOfLines={1}>
                        {message}
                    </Text>
                    {submessage ? (
                        <Text style={styles.submessage} numberOfLines={1}>
                            {submessage}
                        </Text>
                    ) : null}
                </View>

                {/* Botón de acción (opcional) */}
                {actionLabel && onAction && (
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: iconColor }]}
                        onPress={handleAction}
                    >
                        <Text style={styles.actionButtonText}>{actionLabel}</Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9999,
        alignItems: 'center',
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
        maxWidth: 500,
        width: '100%',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
            web: {
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
        }),
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        gap: 2,
    },
    message: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    submessage: {
        fontSize: 13,
        color: '#94a3b8',
    },
    actionButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
});
