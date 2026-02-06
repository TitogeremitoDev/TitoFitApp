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
  '/rutinas',
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

    // Verify if current route is in hidden list
    const shouldHide = HIDDEN_ROUTES.some(route => pathname?.includes(route));

    // Verify if current route is a generic main route
    const isMainRoute = VISIBLE_ROUTES.some(route => {
      if (route === '/(tabs)') {
        return pathname === '/' || pathname === '/(tabs)' || pathname === '/(app)/(tabs)';
      }
      return pathname === route || pathname === `${route}/` || pathname === `/(app)${route}`;
    });

    // Monitor changes for debugging
    // console.log('[FloatingTabBar] Path:', pathname, 'Visible:', isVisible);

    // Lógica específica para Coach: SOLO mostrar en rutas principales exactas
    if (pathname?.includes('(coach)')) {
      const coachMainRoutes = [
        // REMOVED Dashboard from visible routes per user request
        // '/(coach)', 
        // '/(coach)/',
        // '/(coach)/index',
        '/(coach)/clients_coach',
        '/(coach)/clients_coach/index',
        '/(coach)/progress',
        '/(coach)/progress/index',
        '/(coach)/seguimiento_coach',
        '/(coach)/seguimiento_coach/index'
      ];

      // RELAXED CHECK: If it starts with one of the main routes and doesn't get deeper
      // This handles potential trailing slash issues or normalized paths
      const isCoachMain = coachMainRoutes.some(r => {
        return pathname === r || pathname === r + '/' || (pathname.startsWith(r) && pathname.split('/').length <= 4);
      });

      if (isCoachMain) {
        showTabBar();
      } else {
        hideTabBar();
      }
    }
    // Lógica estándar para User App
    else {
      if (shouldHide) {
        hideTabBar();
      } else if (isMainRoute) {
        showTabBar();
      }
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
