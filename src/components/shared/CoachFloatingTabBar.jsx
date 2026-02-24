/**
 * CoachFloatingTabBar.jsx - Tab Bar Flotante para Entrenadores
 *
 * Barra de navegación flotante exclusiva para la vista móvil del sistema Coach.
 * Orden de tabs: Seguimiento | Evolución | Clientes | Home
 *
 * Características:
 * - Diseño consistente con el User FloatingTabBar
 * - Utiliza FloatingTabBarContext para animaciones y visibilidad
 * - Solo visible en rutas principales de Coach
 */

import React, { useCallback, useRef, memo, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Animated,
    Pressable,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../context/ThemeContext';
import { useFloatingTabBar } from '../../../context/FloatingTabBarContext';
import { useStableWindowDimensions } from '../../hooks/useStableBreakpoint';

// Configuración de tabs Coach
const COACH_TABS = [
    {
        key: 'seguimiento',
        icon: 'body-outline',
        iconActive: 'body',
        route: '/(coach)/seguimiento_coach',
        label: 'Seguimiento',
    },
    {
        key: 'evolucion',
        icon: 'stats-chart-outline',
        iconActive: 'stats-chart',
        route: '/(coach)/progress',
        label: 'Evolución',
    },
    {
        key: 'clientes',
        icon: 'people-outline',
        iconActive: 'people',
        route: '/(coach)/clients_coach',
        label: 'Clientes',
    },
    {
        key: 'home',
        icon: 'home-outline',
        iconActive: 'home',
        route: '/(coach)',
        label: 'Home',
    },
];

// Constantes de diseño
const TAB_BAR_HEIGHT = 64;
const TAB_BAR_MARGIN = 12;
const BORDER_RADIUS = 24;
const INDICATOR_SIZE = 6;
const ICON_SIZE = 26;

function CoachFloatingTabBar() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();
    const { width } = useStableWindowDimensions();
    const { theme, isDark } = useTheme();
    const { isVisible, slideAnim, setActiveTab, activeTab } = useFloatingTabBar();

    // Refs para animaciones de escala
    const scaleAnims = useRef(COACH_TABS.map(() => new Animated.Value(1))).current;

    // Sync active tab with pathname explicitly for Coach (as context might lag or miss some)
    useEffect(() => {
        if (!pathname) return;
        if (pathname.includes('/seguimiento_coach')) setActiveTab('seguimiento');
        else if (pathname.includes('/progress')) setActiveTab('evolucion');
        else if (pathname.includes('/clients_coach')) setActiveTab('clientes');
        // Fix: Handle index path for Home tab
        else if (pathname === '/(coach)' || pathname === '/(coach)/' || pathname === '/(coach)/index') setActiveTab('home');
    }, [pathname, setActiveTab]);

    const handleTabPress = useCallback((tab, index) => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        Animated.sequence([
            Animated.timing(scaleAnims[index], {
                toValue: 0.95,
                duration: 50,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnims[index], {
                toValue: 1,
                friction: 4,
                tension: 200,
                useNativeDriver: true,
            }),
        ]).start();

        setActiveTab(tab.key);
        router.push(tab.route);
    }, [router, scaleAnims, setActiveTab]);

    // Lógica de visibilidad
    // 1. Ocultar si es web desktop (width > 768) o si el context dice invisible
    const isMobile = width < 768; // Tablet breakpoint usually

    // Debug Log
    // console.log('[CoachFloatingTabBar] Path:', pathname, 'Visible:', isVisible, 'Mobile:', isMobile);

    if (Platform.OS === 'web' && !isMobile) return null;
    if (!isVisible) return null;
    // Removed strict isCoachRoute check to rely on Context and Layout placement


    const bottomPosition = Math.max(insets.bottom, 8) + TAB_BAR_MARGIN;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    bottom: bottomPosition,
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorderAccent || theme.border,
                    transform: [{ translateY: slideAnim }],
                    shadowColor: isDark ? theme.primary : '#000',
                },
            ]}
        >
            {COACH_TABS.map((tab, index) => {
                const isActive = activeTab === tab.key;

                return (
                    <Pressable
                        key={tab.key}
                        onPress={() => handleTabPress(tab, index)}
                        style={styles.tabButton}
                        accessibilityLabel={tab.label}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                    >
                        <Animated.View
                            style={[
                                styles.tabContent,
                                { transform: [{ scale: scaleAnims[index] }] },
                            ]}
                        >
                            <Ionicons
                                name={isActive ? tab.iconActive : tab.icon}
                                size={ICON_SIZE}
                                color={isActive ? theme.primary : theme.textSecondary}
                            />
                            {isActive && (
                                <View
                                    style={[
                                        styles.indicator,
                                        { backgroundColor: theme.primary },
                                    ]}
                                />
                            )}
                        </Animated.View>
                    </Pressable>
                );
            })}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: TAB_BAR_MARGIN,
        right: TAB_BAR_MARGIN,
        height: TAB_BAR_HEIGHT,
        borderRadius: BORDER_RADIUS,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        borderWidth: 1,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 1000,
    },
    tabButton: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    indicator: {
        width: INDICATOR_SIZE,
        height: INDICATOR_SIZE,
        borderRadius: INDICATOR_SIZE / 2,
        marginTop: 4,
    },
});

export default memo(CoachFloatingTabBar);
