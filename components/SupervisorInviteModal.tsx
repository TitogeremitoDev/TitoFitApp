// ═══════════════════════════════════════════════════════════════════════════
// SUPERVISOR INVITE MODAL
// ═══════════════════════════════════════════════════════════════════════════
// Modal bloqueante que aparece cuando un entrenador tiene una invitación
// pendiente de un coordinador. No se puede cerrar sin aceptar o rechazar.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export const SupervisorInviteModal = () => {
    const { user, refreshUser } = useAuth();
    const [supervisorName, setSupervisorName] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [loadingName, setLoadingName] = useState(false);

    const pendingFrom = user?.pendingSupervisorInvite?.from;
    const isVisible = !!pendingFrom;

    // Fetch supervisor name
    useEffect(() => {
        if (!pendingFrom) {
            setSupervisorName('');
            return;
        }

        const fetchName = async () => {
            setLoadingName(true);
            try {
                const res = await axios.get(`/users/${pendingFrom}`);
                setSupervisorName(res.data?.nombre || 'Coordinador');
            } catch {
                setSupervisorName('Coordinador');
            } finally {
                setLoadingName(false);
            }
        };
        fetchName();
    }, [pendingFrom]);

    const handleAccept = async () => {
        setLoading(true);
        try {
            await axios.post('/supervisor/invite/accept');
            await refreshUser(true);
        } catch (error: any) {
            console.error('[SupervisorInvite] Accept error:', error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        setLoading(true);
        try {
            await axios.post('/supervisor/invite/reject');
            await refreshUser(true);
        } catch (error: any) {
            console.error('[SupervisorInvite] Reject error:', error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isVisible) return null;

    return (
        <Modal
            visible={true}
            transparent={true}
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="people" size={40} color="#8B5CF6" />
                    </View>

                    <Text style={styles.title}>Invitacion de equipo</Text>

                    {loadingName ? (
                        <ActivityIndicator size="small" color="#8B5CF6" style={{ marginVertical: 12 }} />
                    ) : (
                        <Text style={styles.description}>
                            <Text style={styles.bold}>{supervisorName}</Text> te ha invitado a unirte a su equipo como entrenador.
                            {'\n\n'}
                            Al aceptar, tendras acceso completo sin limites de clientes ni necesidad de pago.
                        </Text>
                    )}

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.button, styles.rejectButton]}
                            onPress={handleReject}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#EF4444" />
                            ) : (
                                <>
                                    <Ionicons name="close" size={18} color="#EF4444" />
                                    <Text style={styles.rejectText}>Rechazar</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.acceptButton]}
                            onPress={handleAccept}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark" size={18} color="#fff" />
                                    <Text style={styles.acceptText}>Aceptar</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#1f2937',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#8B5CF620',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'center',
    },
    description: {
        fontSize: 15,
        color: '#9ca3af',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    bold: {
        fontWeight: '700',
        color: '#8B5CF6',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 14,
    },
    rejectButton: {
        backgroundColor: '#EF444420',
        borderWidth: 1,
        borderColor: '#EF444440',
    },
    rejectText: {
        color: '#EF4444',
        fontWeight: '600',
        fontSize: 15,
    },
    acceptButton: {
        backgroundColor: '#8B5CF6',
    },
    acceptText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
});
