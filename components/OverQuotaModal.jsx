/**
 * OverQuotaModal.jsx
 * Modal bloqueante NON-DISMISSIBLE para coaches que exceden su cuota
 * Se activa automáticamente al recibir error 403 OVER_QUOTA o al tocar el banner
 */

import React from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function OverQuotaModal({ visible, overQuota, onClose, canDismiss = true }) {
    const router = useRouter();

    // Si no está visible, no renderizar
    if (!visible) return null;

    // Valores por defecto si overQuota es null (pero el modal está forzado visible)
    const {
        currentClients = 0,
        maxClients = 3,
        overBy = currentClients - maxClients,
        daysFrozen = 0
    } = overQuota || {};

    const handleUpgrade = () => {
        if (canDismiss) onClose?.();
        router.push('/(app)/payment');
    };

    const handleManageClients = () => {
        if (canDismiss) onClose?.();
        router.push('/(coach)/clients_coach'); // Corregida ruta a clients_coach
    };

    const content = (
        <View style={[styles.overlay, Platform.OS === 'web' && StyleSheet.absoluteFill]}>
            <View style={styles.modal}>
                {/* Header con icono de alerta */}
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="lock-closed" size={32} color="#DC2626" />
                    </View>
                </View>

                {/* Título */}
                <Text style={styles.title}>
                    {canDismiss ? '🛑 Tu periodo de prueba ha terminado' : '🔒 Cuenta Congelada'}
                </Text>

                {/* Stats */}
                <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                        <Text style={styles.statNumber}>{currentClients}</Text>
                        <Text style={styles.statLabel}>Clientes actuales</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                        <Text style={styles.statNumber}>{maxClients}</Text>
                        <Text style={styles.statLabel}>Límite plan gratuito</Text>
                    </View>
                </View>

                {/* Mensaje */}
                <Text style={styles.message}>
                    {canDismiss
                        ? 'Has superado el límite de tu plan gratuito.'
                        : 'Para reactivar tu cuenta, necesitas regularizar tu suscripción.'}
                    {overBy > 0 && <Text style={styles.highlight}>{'\n'}Tienes {overBy} clientes extra.</Text>}
                </Text>

                {daysFrozen >= 1 && (
                    <View style={styles.warningBox}>
                        <Ionicons name="time-outline" size={16} color="#F59E0B" />
                        <Text style={styles.warningText}>
                            {daysFrozen >= 7
                                ? `Llevas ${daysFrozen} días sin operar. El día 11 tus clientes recibirán ofertas.`
                                : `Llevas ${daysFrozen} días congelado. Evita perder tus clientes.`
                            }
                        </Text>
                    </View>
                )}

                {/* Botones */}
                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleUpgrade}
                    activeOpacity={0.8}
                >
                    <Ionicons name="rocket" size={20} color="#fff" />
                    <Text style={styles.primaryButtonText}>ACTUALIZAR PLAN AHORA</Text>
                </TouchableOpacity>

                {canDismiss && (
                    <>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={handleManageClients}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="archive-outline" size={18} color="#6B7280" />
                            <Text style={styles.secondaryButtonText}>GESTIONAR CLIENTES</Text>
                        </TouchableOpacity>

                        <Text style={styles.hint}>
                            Archiva {overBy > 0 ? overBy : 'exceso de'} cliente{overBy !== 1 ? 's' : ''} para recuperar acceso gratuito
                        </Text>
                    </>
                )}
            </View>
        </View>
    );

    // En web, devolvemos el contenido directo con position fixed
    // En native, usamos Modal para asegurar que cubra status bar y bottom tabs si es necesario
    if (Platform.OS === 'web') {
        return (
            <View style={styles.webOverlay}>
                {content}
            </View>
        );
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={canDismiss ? onClose : () => { }}
        >
            {content}
        </Modal>
    );
}

const styles = StyleSheet.create({
    webOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 9999, // Asegurar que esté por encima de todo en Web
    },
    modal: {
        backgroundColor: '#1F2937',
        borderRadius: 20,
        padding: 24,
        width: width - 40,
        maxWidth: 400,
        alignItems: 'center',
    },
    header: {
        marginBottom: 16,
    },
    iconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(220, 38, 38, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(220, 38, 38, 0.3)',
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 20,
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        width: '100%',
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 16,
    },
    statNumber: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
    },
    statLabel: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 4,
    },
    message: {
        fontSize: 15,
        color: '#D1D5DB',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 16,
    },
    highlight: {
        color: '#F87171',
        fontWeight: '600',
    },
    warningBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        alignItems: 'flex-start',
        gap: 8,
    },
    warningText: {
        flex: 1,
        fontSize: 12,
        color: '#F59E0B',
        lineHeight: 18,
    },
    primaryButton: {
        flexDirection: 'row',
        backgroundColor: '#10B981',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 12,
        gap: 8,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        flexDirection: 'row',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#4B5563',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 12,
        gap: 6,
    },
    secondaryButtonText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
    },
    hint: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
    },
});
