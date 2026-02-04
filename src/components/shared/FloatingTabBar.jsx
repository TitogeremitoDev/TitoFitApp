/**
 * FloatingTabBar.jsx - Tab Bar Flotante Premium
 *
 * Barra de navegación flotante con animaciones premium para móviles.
 * Orden de tabs: Perfil | Dieta | Entreno | Home
 *
 * Características:
 * - Diseño flotante con border-radius 24px y sombra premium
 * - Animación de escala (0.95 → 1.0) al pulsar
 * - Indicador visual activo (punto + cambio de color)
 * - Integración completa con ThemeContext
 * - Haptic feedback en iOS/Android
 * - Se oculta automáticamente en pantallas de detalle
 */

import React, { useCallback, useRef, memo } from 'react';
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

// Configuración de tabs (izquierda a derecha según requisitos)
// Orden: Perfil (menos frecuente) → Dieta → Entreno → Home (más accesible al pulgar derecho)
const TABS = [
  {
    key: 'perfil',
    icon: 'person-outline',
    iconActive: 'person',
    route: '/perfil',
    label: 'Perfil',
  },
  {
    key: 'dieta',
    icon: 'nutrition-outline',
    iconActive: 'nutrition',
    route: '/nutricion',
    label: 'Dieta',
  },
  {
    key: 'entreno',
    icon: 'barbell-outline',
    iconActive: 'barbell',
    route: '/entreno',
    label: 'Entreno',
  },
  {
    key: 'home',
    icon: 'home-outline',
    iconActive: 'home',
    route: '/home',
    label: 'Home',
  },
];

// Constantes de diseño
const TAB_BAR_HEIGHT = 64;
const TAB_BAR_MARGIN = 12;
const BORDER_RADIUS = 24;
const INDICATOR_SIZE = 6;
const ICON_SIZE = 26;

function FloatingTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, isDark } = useTheme();
  const { isVisible, slideAnim, setActiveTab, activeTab } = useFloatingTabBar();

  // Refs para animaciones de escala individuales por tab
  const scaleAnims = useRef(TABS.map(() => new Animated.Value(1))).current;

  // Handler de press con animación y haptic feedback
  const handleTabPress = useCallback((tab, index) => {
    // Haptic feedback (solo en móviles)
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Animación de escala: 1 → 0.95 → 1 (spring)
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

    // Actualizar tab activo y navegar
    setActiveTab(tab.key);
    router.push(tab.route);
  }, [router, scaleAnims, setActiveTab]);

  // No renderizar en web o si no es visible
  if (Platform.OS === 'web' || !isVisible) {
    return null;
  }

  // Calcular bottom position considerando safe area
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
          // Sombra dinámica según el tema
          shadowColor: isDark ? theme.primary : '#000',
        },
      ]}
    >
      {TABS.map((tab, index) => {
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
              {/* Icono del tab */}
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={ICON_SIZE}
                color={isActive ? theme.primary : theme.textSecondary}
              />

              {/* Indicador activo (punto debajo del icono) */}
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
    // Sombra iOS
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    // Elevación Android
    elevation: 8,
    // Z-index alto para estar sobre el contenido
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

// Memoizar el componente para evitar re-renders innecesarios
export default memo(FloatingTabBar);
