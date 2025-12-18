/* components/SubscriptionRetentionModal.jsx 
   Modal de retención para usuarios con suscripción próxima a expirar */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    StyleSheet,
    Animated,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

/**
 * Modal de retención de suscripción
 * @param {Object} props
 * @param {boolean} props.visible - Si el modal está visible
 * @param {Function} props.onClose - Callback al cerrar
 * @param {Function} props.onRenew - Callback al presionar renovar
 * @param {number} props.daysRemaining - Días restantes de suscripción
 * @param {string} props.userType - 'PREMIUM' | 'CLIENTE' | 'ENTRENADOR'
 * @param {string} props.subscriptionStatus - 'cancelled' | 'expired' | 'active'
 */
export default function SubscriptionRetentionModal({
    visible,
    onClose,
    onRenew,
    daysRemaining = 0,
    userType = 'PREMIUM',
    subscriptionStatus = 'cancelled',
}) {
    // Animaciones
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const iconPulse = useRef(new Animated.Value(1)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;

    // Determinar urgencia basada en días
    const isUrgent = daysRemaining <= 3;
    const isCritical = daysRemaining <= 1;

    useEffect(() => {
        if (visible) {
            // Animación de entrada
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();

            // Pulso del icono
            Animated.loop(
                Animated.sequence([
                    Animated.timing(iconPulse, {
                        toValue: 1.15,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(iconPulse, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Shake si es crítico
            if (isCritical) {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
                        Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
                        Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
                        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
                        Animated.delay(2000),
                    ])
                ).start();
            }
        } else {
            scaleAnim.setValue(0.8);
            opacityAnim.setValue(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, isCritical]);

    // Determinar si es entrenador
    const isTrainer = userType === 'ENTRENADOR';

    // Colores según urgencia
    const urgencyColors = {
        primary: isCritical ? '#EF4444' : isUrgent ? '#F59E0B' : '#F97316',
        secondary: isCritical ? '#DC2626' : isUrgent ? '#D97706' : '#EA580C',
        glow: isCritical ? 'rgba(239, 68, 68, 0.4)' : isUrgent ? 'rgba(245, 158, 11, 0.4)' : 'rgba(249, 115, 22, 0.4)',
    };

    // Contenido diferenciado
    const content = isTrainer
        ? {
            icon: 'briefcase',
            title: `⏳ Tu licencia de Entrenador expira en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}`,
            subtitle: 'Para garantizar el servicio a tus clientes, es vital mantener tu suscripción activa.',
            losses: [
                { icon: 'cloud-offline', text: 'Perderás el acceso a los perfiles de tus alumnos en la nube' },
                { icon: 'create-outline', text: 'No podrás asignar nuevas rutinas ni ver su progreso' },
                { icon: 'star-outline', text: 'Tu perfil dejará de ser visible como "Pro"' },
            ],
            cta: '🚀 Renovar Licencia Ahora',
            ctaSecondary: 'Recordar más tarde',
            footerText: 'Evita interrupciones en tu negocio y mantén el control.',
        }
        : {
            icon: 'shield-checkmark',
            title: `⚠️ ¡Atención! Te quedan ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''} de Premium`,
            subtitle: 'Notamos que tu periodo actual está por finalizar. Si tu cuenta pasa a la versión gratuita:',
            losses: [
                { icon: 'cloud-offline', text: 'Perderás el respaldo en la nube de tus entrenamientos' },
                { icon: 'stats-chart', text: 'Dejarás de tener acceso a las estadísticas avanzadas' },
                { icon: 'phone-portrait-outline', text: 'Tu historial podría borrarse si cambias de dispositivo' },
            ],
            cta: '🔒 Renovar y Proteger mis Datos',
            ctaSecondary: 'Entendido, correré el riesgo',
            footerText: 'No dejes que tu esfuerzo se pierda. Mantén tus datos seguros.',
        };

    // Mensaje especial para "códigos gratuitos" (período de prueba)
    const trialMessage = subscriptionStatus === 'trial' || subscriptionStatus === 'active'
        ? 'Esperamos que hayas disfrutado tu acceso de regalo. Tu periodo de prueba finaliza pronto.'
        : null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                {Platform.OS !== 'web' ? (
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]} />
                )}

                <Animated.View
                    style={[
                        styles.modalContainer,
                        {
                            transform: [
                                { scale: scaleAnim },
                                { translateX: shakeAnim },
                            ],
                            opacity: opacityAnim,
                        },
                    ]}
                >
                    {/* Glow effect */}
                    <View style={[styles.glowEffect, { shadowColor: urgencyColors.primary }]} />

                    <LinearGradient
                        colors={['#1F2937', '#111827']}
                        style={styles.modalContent}
                    >
                        {/* Botón de cerrar */}
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#9CA3AF" />
                        </Pressable>

                        {/* Header con icono animado */}
                        <View style={styles.header}>
                            <Animated.View
                                style={[
                                    styles.iconContainer,
                                    {
                                        backgroundColor: `${urgencyColors.primary}20`,
                                        borderColor: urgencyColors.primary,
                                        transform: [{ scale: iconPulse }],
                                        shadowColor: urgencyColors.primary,
                                    },
                                ]}
                            >
                                <Ionicons name={content.icon} size={40} color={urgencyColors.primary} />
                            </Animated.View>

                            {/* Contador de días prominente */}
                            <View style={[styles.daysCounterBadge, { backgroundColor: urgencyColors.primary }]}>
                                <Text style={styles.daysCounterNumber}>{daysRemaining}</Text>
                                <Text style={styles.daysCounterLabel}>día{daysRemaining !== 1 ? 's' : ''}</Text>
                            </View>
                        </View>

                        {/* Título */}
                        <Text style={[styles.title, isCritical && { color: '#EF4444' }]}>
                            {content.title}
                        </Text>

                        {/* Mensaje de prueba si aplica */}
                        {trialMessage && (
                            <View style={styles.trialBanner}>
                                <Text style={styles.trialText}>🎁 {trialMessage}</Text>
                            </View>
                        )}

                        {/* Subtítulo */}
                        <Text style={styles.subtitle}>{content.subtitle}</Text>

                        {/* Lista de pérdidas */}
                        <View style={styles.lossesList}>
                            {content.losses.map((loss, index) => (
                                <View key={index} style={styles.lossItem}>
                                    <View style={[styles.lossIconContainer, { backgroundColor: `${urgencyColors.primary}15` }]}>
                                        <Ionicons name={loss.icon} size={20} color={urgencyColors.primary} />
                                    </View>
                                    <Text style={styles.lossText}>{loss.text}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Mensaje de cierre */}
                        <Text style={styles.footerText}>{content.footerText}</Text>

                        {/* Botón principal CTA */}
                        <Pressable onPress={onRenew} style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}>
                            <LinearGradient
                                colors={[urgencyColors.primary, urgencyColors.secondary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.ctaGradient}
                            >
                                <Text style={styles.ctaText}>{content.cta}</Text>
                            </LinearGradient>
                        </Pressable>

                        {/* Botón secundario */}
                        <Pressable onPress={onClose} style={styles.secondaryButton}>
                            <Text style={styles.secondaryButtonText}>{content.ctaSecondary}</Text>
                        </Pressable>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
    },
    glowEffect: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: 22,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 15,
    },
    modalContent: {
        borderRadius: 20,
        padding: 24,
        paddingTop: 28,
        borderWidth: 1,
        borderColor: 'rgba(75, 85, 99, 0.5)',
    },
    closeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        gap: 16,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    daysCounterBadge: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        minWidth: 70,
    },
    daysCounterNumber: {
        color: '#FFF',
        fontSize: 28,
        fontWeight: '900',
    },
    daysCounterLabel: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    title: {
        color: '#F3F4F6',
        fontSize: 20,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 26,
    },
    trialBanner: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    trialText: {
        color: '#10B981',
        fontSize: 13,
        textAlign: 'center',
        fontWeight: '600',
    },
    subtitle: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    lossesList: {
        marginBottom: 16,
        gap: 12,
    },
    lossItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    lossIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lossText: {
        color: '#E5E7EB',
        fontSize: 14,
        flex: 1,
        lineHeight: 20,
    },
    footerText: {
        color: '#6B7280',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 20,
        fontStyle: 'italic',
    },
    ctaButton: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
    ctaButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    ctaGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        borderRadius: 14,
    },
    ctaText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    secondaryButton: {
        marginTop: 14,
        paddingVertical: 10,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#6B7280',
        fontSize: 13,
        fontWeight: '500',
    },
});
