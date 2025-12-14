/**
 * SyncProgressModal.jsx
 * Modal de progreso visual para sincronización de datos
 * - Animación de 0% a 90% en 3 segundos (fake progress)
 * - Cuando la sincronización real termina, salta a 100%
 * - Mensajes dinámicos según dirección (upload/download)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    Animated,
    Easing,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const MESSAGES = {
    upload: {
        title: 'Sincronizando a la nube',
        subtitle: 'Tus datos locales se están subiendo...',
        icon: 'cloud-upload',
        completedTitle: '¡Sincronización completada!',
        completedSubtitle: 'Tus datos ahora están seguros en la nube',
    },
    download: {
        title: 'Descargando tus datos',
        subtitle: 'Guardando tu historial localmente...',
        icon: 'cloud-download',
        completedTitle: '¡Descarga completada!',
        completedSubtitle: 'Tus datos están guardados en tu dispositivo',
    },
};

export default function SyncProgressModal({
    visible,
    direction = 'upload',
    isComplete = false,
    onDismiss,
    itemsSynced = 0,
}) {
    const [displayProgress, setDisplayProgress] = useState(0);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const [showComplete, setShowComplete] = useState(false);

    // Animación de "fake progress" hasta 90% en 3 segundos
    useEffect(() => {
        if (visible && !isComplete) {
            progressAnim.setValue(0);
            setDisplayProgress(0);
            setShowComplete(false);

            // Animar de 0 a 90 en 3 segundos
            Animated.timing(progressAnim, {
                toValue: 90,
                duration: 3000,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                useNativeDriver: false,
            }).start();

            // Listener para actualizar el estado de display
            const listener = progressAnim.addListener(({ value }) => {
                setDisplayProgress(Math.round(value));
            });

            return () => {
                progressAnim.removeListener(listener);
            };
        }
    }, [visible, isComplete, progressAnim]);

    // Cuando isComplete cambia a true, saltar a 100%
    useEffect(() => {
        if (isComplete && visible) {
            // Animar de donde esté a 100
            Animated.timing(progressAnim, {
                toValue: 100,
                duration: 500,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }).start(() => {
                setDisplayProgress(100);
                setShowComplete(true);

                // Auto-cerrar después de 1.5 segundos
                setTimeout(() => {
                    if (onDismiss) onDismiss();
                }, 1500);
            });
        }
    }, [isComplete, visible, progressAnim, onDismiss]);

    // Animación de pulso para el icono
    useEffect(() => {
        if (visible && !showComplete) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [visible, showComplete, pulseAnim]);

    const messages = MESSAGES[direction] || MESSAGES.upload;
    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <LinearGradient
                    colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.98)']}
                    style={styles.container}
                >
                    {/* Icono animado */}
                    <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
                        <LinearGradient
                            colors={showComplete ? ['#10B981', '#059669'] : ['#3B82F6', '#2563EB']}
                            style={styles.iconGradient}
                        >
                            <Ionicons
                                name={showComplete ? 'checkmark-circle' : messages.icon}
                                size={48}
                                color="#FFF"
                            />
                        </LinearGradient>
                    </Animated.View>

                    {/* Título y subtítulo */}
                    <Text style={styles.title}>
                        {showComplete ? messages.completedTitle : messages.title}
                    </Text>
                    <Text style={styles.subtitle}>
                        {showComplete ? messages.completedSubtitle : messages.subtitle}
                    </Text>

                    {/* Barra de progreso */}
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBackground}>
                            <Animated.View style={[styles.progressBar, { width: progressWidth }]}>
                                <LinearGradient
                                    colors={showComplete ? ['#10B981', '#34D399'] : ['#3B82F6', '#60A5FA']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.progressGradient}
                                />
                            </Animated.View>
                        </View>
                        <Text style={styles.progressText}>{displayProgress}%</Text>
                    </View>

                    {/* Indicador de actividad (solo mientras no está completo) */}
                    {!showComplete && (
                        <View style={styles.activityContainer}>
                            <ActivityIndicator size="small" color="#60A5FA" />
                            <Text style={styles.activityText}>
                                {direction === 'upload' ? 'Subiendo' : 'Descargando'} datos...
                            </Text>
                        </View>
                    )}

                    {/* Contador de items sincronizados */}
                    {showComplete && itemsSynced > 0 && (
                        <View style={styles.statsContainer}>
                            <Ionicons name="stats-chart" size={16} color="#10B981" />
                            <Text style={styles.statsText}>
                                {itemsSynced} registros sincronizados
                            </Text>
                        </View>
                    )}
                </LinearGradient>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        marginBottom: 24,
    },
    iconGradient: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#F1F5F9',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 20,
    },
    progressContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    progressBackground: {
        flex: 1,
        height: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressGradient: {
        flex: 1,
    },
    progressText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#F1F5F9',
        width: 45,
        textAlign: 'right',
    },
    activityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        gap: 8,
    },
    activityText: {
        fontSize: 13,
        color: '#64748B',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        gap: 6,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statsText: {
        fontSize: 13,
        color: '#10B981',
        fontWeight: '500',
    },
});
