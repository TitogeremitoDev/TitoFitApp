/**
 * FloatingTabBarContext.jsx
 * Contexto para gestionar la visibilidad y estado del Tab Bar flotante
 *
 * Funcionalidades:
 * - Controla si el tab bar es visible o no
 * - Maneja animaciones de entrada/salida (slide up/down)
 * - Permite que pantallas de detalle oculten el tab bar
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Animated, Platform } from 'react-native';
import { usePathname } from 'expo-router';

const FloatingTabBarContext = createContext(null);

// Hook para usar el contexto del tab bar flotante
export const useFloatingTabBar = () => {
  const context = useContext(FloatingTabBarContext);
  if (!context) {
    // Valores por defecto si se usa fuera del provider
    return {
      isVisible: false,
      activeTab: 'home',
      showTabBar: () => { },
      hideTabBar: () => { },
      setActiveTab: () => { },
      slideAnim: new Animated.Value(0),
    };
  }
  return context;
};

// Rutas donde el tab bar debe ocultarse (pantallas de detalle)
const HIDDEN_ROUTES = [
  '/home',                    // Home tiene flujo especial
  '/rutinas/',                // Detalle de rutina
  '/nutricion/meal/',         // Detalle de comida
  '/chat/',                   // Conversaciones de chat
  '/video-feedback/',         // Flujo de video feedback
  '/payment',                 // Pantalla de pago
];

// Rutas principales donde el tab bar debe mostrarse
const VISIBLE_ROUTES = [
  '/(tabs)',
  '/entreno',
  '/nutricion',
  '/perfil',
  '/seguimiento',
];

export function FloatingTabBarProvider({ children }) {
  const [isVisible, setIsVisible] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pathname = usePathname();

  // Mostrar el tab bar con animación
  const showTabBar = useCallback(() => {
    setIsVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [slideAnim]);

  // Ocultar el tab bar con animación slide-down
  const hideTabBar = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 120, // Slide hacia abajo (fuera de la pantalla)
      duration: 200,
      useNativeDriver: true,
    }).start(() => setIsVisible(false));
  }, [slideAnim]);

  // Determinar automáticamente si mostrar/ocultar basado en la ruta actual
  useEffect(() => {
    // No aplicar en web
    if (Platform.OS === 'web') return;

    // Verificar si la ruta actual está en la lista de rutas ocultas
    const shouldHide = HIDDEN_ROUTES.some(route => pathname?.includes(route));

    // Verificar si la ruta actual es una ruta principal visible
    const isMainRoute = VISIBLE_ROUTES.some(route => {
      if (route === '/(tabs)') {
        return pathname === '/' || pathname === '/(tabs)' || pathname === '/(app)/(tabs)';
      }
      // Para rutas principales, solo coincidir exactamente o con trailing slash
      return pathname === route || pathname === `${route}/` || pathname === `/(app)${route}`;
    });

    if (shouldHide) {
      hideTabBar();
    } else if (isMainRoute) {
      showTabBar();
    }
  }, [pathname, hideTabBar, showTabBar]);

  // Actualizar el tab activo basado en la ruta
  useEffect(() => {
    if (!pathname) return;

    if (pathname.includes('/perfil')) {
      setActiveTab('perfil');
    } else if (pathname.includes('/nutricion') || pathname.includes('/dieta')) {
      setActiveTab('dieta');
    } else if (pathname.includes('/entreno') || pathname.includes('/rutinas')) {
      setActiveTab('entreno');
    } else if (pathname.includes('/seguimiento')) {
      setActiveTab('seguimiento');
    } else {
      setActiveTab('home');
    }
  }, [pathname]);

  return (
    <FloatingTabBarContext.Provider
      value={{
        isVisible,
        activeTab,
        showTabBar,
        hideTabBar,
        setActiveTab,
        slideAnim,
      }}
    >
      {children}
    </FloatingTabBarContext.Provider>
  );
}

export default FloatingTabBarContext;
