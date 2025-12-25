/**
 * ConfirmModal.jsx - Modal de confirmación cross-platform
 * Reemplaza Alert.alert para funcionar correctamente en Web
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ConfirmModal({
    visible,
    onClose,
    onConfirm,
    title = '¿Estás seguro?',
    message = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    confirmStyle = 'default', // 'default' | 'destructive'
    icon = 'alert-circle-outline'
}) {
    const isDestructive = confirmStyle === 'destructive';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.container} onPress={e => e.stopPropagation()}>
                    {/* Icon */}
                    <View style={[
                        styles.iconContainer,
                        { backgroundColor: isDestructive ? '#fef2f2' : '#f0f9ff' }
                    ]}>
                        <Ionicons
                            name={icon}
                            size={32}
                            color={isDestructive ? '#ef4444' : '#3b82f6'}
                        />
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>{title}</Text>

                    {/* Message */}
                    {message ? (
                        <Text style={styles.message}>{message}</Text>
                    ) : null}

                    {/* Buttons */}
                    <View style={styles.buttonRow}>
                        {cancelText ? (
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={onClose}
                            >
                                <Text style={styles.cancelBtnText}>{cancelText}</Text>
                            </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity
                            style={[
                                styles.confirmBtn,
                                isDestructive && styles.confirmBtnDestructive,
                                !cancelText && styles.confirmBtnFull
                            ]}
                            onPress={() => {
                                onConfirm?.();
                                onClose?.();
                            }}
                        >
                            <Text style={[
                                styles.confirmBtnText,
                                isDestructive && styles.confirmBtnTextDestructive
                            ]}>
                                {confirmText}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 8
    },
    message: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 8
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        width: '100%'
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center'
    },
    cancelBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748b'
    },
    confirmBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#8b5cf6',
        alignItems: 'center'
    },
    confirmBtnDestructive: {
        backgroundColor: '#ef4444'
    },
    confirmBtnFull: {
        flex: 1
    },
    confirmBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff'
    },
    confirmBtnTextDestructive: {
        color: '#fff'
    }
});
