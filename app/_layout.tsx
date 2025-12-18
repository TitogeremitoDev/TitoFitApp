import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { StripeProvider } from '../utils/stripeWrapper';

// Mantén el splash visible hasta que el router + auth estén listos
try { SplashScreen.preventAutoHideAsync(); } catch { }

// CSS global para scrollbar estilizado en web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'custom-scrollbar-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Scrollbar estilizado para elementos con scroll horizontal */
      .custom-scrollbar::-webkit-scrollbar {
        height: 6px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #1f2937;
        border-radius: 3px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: linear-gradient(90deg, #6366f1, #8b5cf6);
        border-radius: 3px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(90deg, #818cf8, #a78bfa);
      }
      
      /* Scrollbar global más delgado */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: #0D1B2A;
      }
      ::-webkit-scrollbar-thumb {
        background: #374151;
        border-radius: 4px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #4B5563;
      }
    `;
    document.head.appendChild(style);
  }
}

function RootLayoutNav() {
  const { token, isLoading, user, refreshUser } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState(); // router listo cuando tiene key
  const splashHidden = useRef(false);

  // Cargar fuentes de iconos para web
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  // Oculta el splash UNA SOLA VEZ cuando todo está listo
  useEffect(() => {
    const ready = !!navState?.key && !isLoading && fontsLoaded;
    if (ready && !splashHidden.current) {
      SplashScreen.hideAsync().catch(() => { });
      splashHidden.current = true;
    }
  }, [navState?.key, isLoading, fontsLoaded]);

  // Redirecciones de auth (sin navegar a grupos)
  useEffect(() => {
    if (isLoading || !navState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const inModeSelect = (segments[0] as string) === 'mode-select';
    const isRoot = (segments as string[]).length === 0 || ((segments as string[]).length === 1 && (segments[0] as string) === 'index');
    const inLoginPage = segments[0] === '(auth)' && segments[1] === 'login';

    // Si estamos en login, verificar AsyncStorage directamente para evitar race conditions
    if (inLoginPage) {
      (async () => {
        const storedToken = await AsyncStorage.getItem('totalgains_token');
        if (!storedToken) {
          if (__DEV__) {
            console.log('[Navigation] En login sin token en AsyncStorage, no redirigiendo');
          }
          return;
        } else if (__DEV__) {
          console.log('[Navigation] En login CON token en AsyncStorage, continuando con redirección');
        }
      })();
      // Si no hay token en el estado de React, no redirigir
      if (!token) {
        return;
      }
    }

    // Usuario sin sesión → login
    if (!token && !inAuthGroup) {
      router.replace('/login');
      return;
    }

    // Usuario con sesión en auth o root → redirigir según rol
    if (token && (inAuthGroup || isRoot)) {
      // Acceso coach: es admin, tiene tipo ENTRENADOR, O tiene código de entrenador configurado
      const isAdminOrCoach = user?.tipoUsuario === 'ADMINISTRADOR' || user?.tipoUsuario === 'ENTRENADOR' || !!user?.trainerProfile?.trainerCode;

      if (isAdminOrCoach) {
        // Admin/Coach → mode-select para elegir
        if (__DEV__) {
          console.log('[Navigation] Redirecting admin/coach to mode-select');
        }
        router.replace('/mode-select');
      } else {
        // Usuario normal → verificar onboarding SOLO contra el backend (nube)
        (async () => {
          try {
            // Obtener datos frescos del usuario desde el backend
            const freshUser = await refreshUser();

            // Verificar el campo onboardingCompleted del backend
            // Si es true, el usuario ya completó (o saltó) el onboarding
            if (freshUser?.onboardingCompleted === true) {
              if (__DEV__) {
                console.log('[Navigation] Redirecting to home (onboardingCompleted=true)');
              }
              router.replace('/home');
            } else {
              // onboardingCompleted es false o undefined → mostrar onboarding
              if (__DEV__) {
                console.log('[Navigation] Redirecting to onboarding (onboardingCompleted !== true)');
              }
              router.replace('/onboarding');
            }
          } catch (error) {
            console.error('[Navigation] Error verificando onboarding:', error);
            // Si hay error obteniendo datos, ir a home para no bloquear
            router.replace('/home');
          }
        })();
      }
    }
  }, [token, isLoading, navState?.key, segments, router, user]);

  if (isLoading || !navState?.key || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{
        headerShown: false,
        // Habilitar gesto de swipe back en iOS
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        animation: 'slide_from_right',
      }}>
        <Stack.Screen name="mode-select" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(coach)" />
        <Stack.Screen name="(admin)" />
      </Stack>

      {/* StatusBar global: no translúcida en Android para que el contenido empiece debajo */}
      <StatusBar
        style="light"
        translucent={Platform.OS === 'android' ? false : undefined}
        backgroundColor="#000000"
      />
    </>
  );
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

  return (
    <AuthProvider>
      <StripeProvider
        publishableKey={publishableKey}
        merchantIdentifier="merchant.com.totalgains" // Opcional, para Apple Pay
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <RootLayoutNav />
        </GestureHandlerRootView>
      </StripeProvider>
    </AuthProvider>
  );
}
