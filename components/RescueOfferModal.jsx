/**
 * RescueOfferModal.jsx
 * Modal de pantalla completa para clientes cuyo entrenador está congelado >10 días
 * Ofrece 3 meses de premium gratis para desvincularse
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const { width, height } = Dimensions.get('window');

export default function RescueOfferModal({ visible, rescueOffer, onClose }) {
    const { token, logout, refreshUser } = useAuth();
    const [isAccepting, setIsAccepting] = useState(false);
    const [error, setError] = useState(null);

    if (!rescueOffer) return null;

    const { coachName, daysFrozen, offer } = rescueOffer;

    const handleAcceptRescue = async () => {
        try {
            setIsAccepting(true);
            setError(null);

            const response = await axios.post(
                `${process.env.EXPO_PUBLIC_API_URL || 'https://fitai-api.com'}/api/clients/accept-rescue`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                // Refrescar usuario para obtener nuevo estado de premium
                await refreshUser();
                onClose?.();
            } else {
                setError(response.data.message || 'Error al procesar');
            }
        } catch (err) {
            console.error('[RescueModal] Error:', err);
            setError('No se pudo procesar la solicitud. Inténtalo de nuevo.');
        } finally {
            setIsAccepting(false);
        }
    };

    const handleDecline = async () => {
        // Cerrar sesión si prefiere esperar
        await logout();
        onClose?.();
    };

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="slide"
            statusBarTranslucent
        >
            <View style={styles.container}>
                {/* Background gradient effect */}
                <View style={styles.backgroundGradient} />

                {/* Content */}
                <View style={styles.content}>
                    {/* Icon */}
                    <View style={styles.iconContainer}>
                        <Ionicons name="alert-circle" size={60} color="#F59E0B" />
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>
                        ⚠️ Servicio Pausado Temporalmente
                    </Text>

                    {/* Coach info */}
                    <View style={styles.coachBadge}>
                        <Ionicons name="person-outline" size={16} color="#9CA3AF" />
                        <Text style={styles.coachName}>{coachName}</Text>
                        <Text style={styles.coachStatus}>• Inactivo hace {daysFrozen} días</Text>
                    </View>

                    {/* Message */}
                    <Text style={styles.message}>
                        Tu entrenador actual no tiene el servicio activo en la plataforma.{'\n\n'}
                        Para que no pierdas tu progreso, te ofrecemos seguir con nosotros.
                    </Text>

                    {/* Offer Card */}
                    <View style={styles.offerCard}>
                        <View style={styles.offerHeader}>
                            <Ionicons name="gift" size={24} color="#10B981" />
                            <Text style={styles.offerTitle}>OFERTA ESPECIAL</Text>
                        </View>

                        <Text style={styles.offerText}>
                            Te regalamos{' '}
                            <Text style={styles.offerHighlight}>3 MESES DE PREMIUM</Text>
                            {' '}con nuestra IA para que sigas entrenando por tu cuenta.
                        </Text>

                        <View style={styles.offerFeatures}>
                            <View style={styles.feature}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={styles.featureText}>Conservas todos tus datos</Text>
                            </View>
                            <View style={styles.feature}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={styles.featureText}>Historial y progreso intactos</Text>
                            </View>
                            <View style={styles.feature}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={styles.featureText}>Dietas y rutinas con IA</Text>
                            </View>
                        </View>

                        <Text style={styles.offerValue}>
                            Valorado en {offer?.premiumValue || '29,99€'}
                        </Text>
                    </View>

                    {error && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Primary Button */}
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleAcceptRescue}
                        disabled={isAccepting}
                        activeOpacity={0.8}
                    >
                        {isAccepting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="sparkles" size={20} color="#fff" />
                                <Text style={styles.primaryButtonText}>
                                    SÍ, QUIERO MIS 3 MESES GRATIS
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Secondary Button */}
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={handleDecline}
                        disabled={isAccepting}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.secondaryButtonText}>
                            No, prefiero esperar
                        </Text>
                    </TouchableOpacity>

                    <Text style={styles.disclaimer}>
                        Tu entrenador se ha ido, pero tus logros se quedan contigo.{'\n'}
                        Todo tu historial, fotos y marcas estarán siempre disponibles.
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
    },
    backgroundGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: height * 0.4,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderBottomLeftRadius: 100,
        borderBottomRightRadius: 100,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 2,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
    },
    coachBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 20,
        gap: 6,
    },
    coachName: {
        color: '#D1D5DB',
        fontSize: 13,
        fontWeight: '500',
    },
    coachStatus: {
        color: '#F87171',
        fontSize: 12,
    },
    message: {
        fontSize: 15,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
        paddingHorizontal: 10,
    },
    offerCard: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    offerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    offerTitle: {
        color: '#10B981',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
    },
    offerText: {
        color: '#D1D5DB',
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 16,
    },
    offerHighlight: {
        color: '#10B981',
        fontWeight: '700',
    },
    offerFeatures: {
        gap: 8,
        marginBottom: 12,
    },
    feature: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    featureText: {
        color: '#D1D5DB',
        fontSize: 13,
    },
    offerValue: {
        color: '#6EE7B7',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'right',
    },
    errorBox: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        width: '100%',
    },
    errorText: {
        color: '#F87171',
        fontSize: 13,
        textAlign: 'center',
    },
    primaryButton: {
        flexDirection: 'row',
        backgroundColor: '#10B981',
        borderRadius: 14,
        paddingVertical: 18,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 16,
        gap: 10,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        paddingVertical: 12,
        marginBottom: 16,
    },
    secondaryButtonText: {
        color: '#6B7280',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    disclaimer: {
        fontSize: 11,
        color: '#4B5563',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
});
