/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 TOAST DE LOGROS ESTILO STEAM - TOTALGAINS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Notificación pequeña que aparece en la esquina inferior derecha cuando
 * se desbloquea un logro. Estilo inspirado en Steam.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
    Pressable,
} from 'react-native';
import { useAchievements } from '../context/AchievementsContext';
import { ACHIEVEMENT_CATEGORIES } from '../src/data/achievements';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOAST_WIDTH = Math.min(320, SCREEN_WIDTH - 32);
const TOAST_VISIBLE_DURATION = 1000; // 1 segundo visible
const ANIMATION_DURATION = 300;

const AchievementToast = () => {
    const { hasToasts, nextToast, popToast } = useAchievements();
    const [currentToast, setCurrentToast] = useState(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const hideTimerRef = useRef(null);
    const glowAnimRef = useRef(null);

    // Animaciones
    const slideAnim = useRef(new Animated.Value(TOAST_WIDTH + 20)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    // Función para ocultar el toast
    const dismissToast = useCallback(() => {
        // Cancelar timer si existe
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
        // Detener animación de brillo
        if (glowAnimRef.current) {
            glowAnimRef.current.stop();
            glowAnimRef.current = null;
        }

        // Animación de salida
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: TOAST_WIDTH + 20,
                duration: ANIMATION_DURATION,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: ANIMATION_DURATION,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setCurrentToast(null);
            setIsAnimating(false);
            // Reset para el siguiente toast
            slideAnim.setValue(TOAST_WIDTH + 20);
            opacityAnim.setValue(0);
            scaleAnim.setValue(0.8);
            glowAnim.setValue(0);
        });
    }, [slideAnim, opacityAnim, scaleAnim, glowAnim]);

    // Efecto para procesar la cola de toasts
    useEffect(() => {
        if (!hasToasts || isAnimating || currentToast) return;

        const toast = popToast();
        if (!toast) return;

        setCurrentToast(toast);
        setIsAnimating(true);

        // Animación de entrada
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: ANIMATION_DURATION,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: ANIMATION_DURATION,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 100,
                useNativeDriver: true,
            }),
        ]).start();

        // Animación de brillo pulsante
        glowAnimRef.current = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0.3,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ])
        );
        glowAnimRef.current.start();

        // Timer para auto-ocultar después de 1 segundo
        hideTimerRef.current = setTimeout(() => {
            dismissToast();
        }, TOAST_VISIBLE_DURATION);

        return () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
            if (glowAnimRef.current) {
                glowAnimRef.current.stop();
            }
        };
    }, [hasToasts, isAnimating, currentToast, popToast, slideAnim, opacityAnim, scaleAnim, glowAnim, dismissToast]);

    if (!currentToast) return null;

    const category = ACHIEVEMENT_CATEGORIES[currentToast.category] || {};
    const categoryColor = category.color || '#8b5cf6';

    return (
        <Pressable onPress={dismissToast} style={styles.touchableContainer}>
            <Animated.View
                style={[
                    styles.container,
                    {
                        transform: [
                            { translateX: slideAnim },
                            { scale: scaleAnim },
                        ],
                        opacity: opacityAnim,
                    },
                ]}
            >
                {/* Borde brillante animado */}
                <Animated.View
                    style={[
                        styles.glowBorder,
                        {
                            borderColor: categoryColor,
                            opacity: glowAnim,
                        },
                    ]}
                />

                {/* Contenido del toast */}
                <View style={styles.content}>
                    {/* Cabecera con icono de logro */}
                    <View style={styles.header}>
                        <View style={[styles.iconBadge, { backgroundColor: `${categoryColor}20` }]}>
                            <Text style={styles.emoji}>{currentToast.emoji}</Text>
                        </View>
                        <View style={styles.titleContainer}>
                            <Text style={styles.achievementLabel}>🏆 LOGRO DESBLOQUEADO</Text>
                            <Text style={styles.title} numberOfLines={1}>
                                {currentToast.name}
                            </Text>
                        </View>
                    </View>

                    {/* Descripción */}
                    <Text style={styles.description} numberOfLines={2}>
                        {currentToast.description}
                    </Text>

                    {/* Barra de categoría */}
                    <View style={[styles.categoryBar, { backgroundColor: categoryColor }]}>
                        <Text style={styles.categoryText}>
                            {category.emoji} {category.name}
                        </Text>
                    </View>

                    {/* Hint para cerrar */}
                    <Text style={styles.tapHint}>Toca para cerrar</Text>
                </View>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 16,
        bottom: Platform.OS === 'ios' ? 100 : 80,
        width: TOAST_WIDTH,
        zIndex: 9999,
        elevation: 999,
    },
    glowBorder: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: 18,
        borderWidth: 2,
    },
    content: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(75, 85, 99, 0.6)',
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    iconBadge: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    emoji: {
        fontSize: 28,
    },
    titleContainer: {
        flex: 1,
    },
    achievementLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#fbbf24',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        color: '#f1f5f9',
        letterSpacing: 0.3,
    },
    description: {
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 18,
        marginBottom: 10,
    },
    categoryBar: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    categoryText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },
    touchableContainer: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        left: 0,
        top: 0,
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        paddingRight: 16,
        paddingBottom: 80,
    },
    tapHint: {
        fontSize: 9,
        color: 'rgba(148, 163, 184, 0.6)',
        textAlign: 'center',
        marginTop: 8,
        fontStyle: 'italic',
    },
});

export default AchievementToast;
