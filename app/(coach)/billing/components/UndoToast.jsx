import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * UndoToast - Floating toast notification with undo button
 * 
 * Props:
 * - visible: boolean
 * - message: string
 * - onUndo: () => void
 * - onDismiss: () => void
 * - duration: number (ms, default 4000)
 */
export default function UndoToast({ visible, message, onUndo, onDismiss, duration = 4000 }) {
    const slideAnim = useRef(new Animated.Value(100)).current;
    const timerRef = useRef(null);

    useEffect(() => {
        if (visible) {
            // Slide in
            Animated.spring(slideAnim, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }).start();

            // Auto dismiss
            timerRef.current = setTimeout(() => {
                handleDismiss();
            }, duration);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [visible]);

    const handleDismiss = () => {
        Animated.timing(slideAnim, {
            toValue: 100,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            onDismiss?.();
        });
    };

    const handleUndo = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        handleDismiss();
        onUndo?.();
    };

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY: slideAnim }] },
            ]}
        >
            <View style={styles.content}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text style={styles.message} numberOfLines={1}>{message}</Text>
                <TouchableOpacity style={styles.undoBtn} onPress={handleUndo}>
                    <Text style={styles.undoText}>DESHACER</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: Platform.OS === 'web' ? 24 : 100,
        left: 16,
        right: 16,
        backgroundColor: '#1e293b',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 1000,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
    },
    message: {
        flex: 1,
        fontSize: 14,
        color: '#f1f5f9',
        fontWeight: '500',
    },
    undoBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 6,
    },
    undoText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#3b82f6',
        letterSpacing: 0.5,
    },
});
