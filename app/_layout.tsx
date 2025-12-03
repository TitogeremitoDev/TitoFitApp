// app/_layout.tsx
import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { StripeProvider } from '../utils/stripeWrapper';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mantén el splash visible hasta que el router + auth estén listos
try { SplashScreen.preventAutoHideAsync(); } catch { }

function RootLayoutNav() {
  const { token, isLoading, user } = useAuth();
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

    // Usuario sin sesión → login
    if (!token && !inAuthGroup) {
      router.replace('/login');
      return;
    }

    // Usuario con sesión en auth o root → redirigir según rol
    if (token && (inAuthGroup || isRoot)) {
      const isAdminOrCoach = user?.tipoUsuario === 'ADMINISTRADOR' || user?.tipoUsuario === 'ENTRENADOR';

      if (isAdminOrCoach) {
        // Admin/Coach → mode-select para elegir
        if (__DEV__) {
          console.log('[Navigation] Redirecting admin/coach to mode-select');
        }
        router.replace('/mode-select');
      } else {
        // Usuario normal → verificar onboarding
        (async () => {
          try {
            const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');

            if (!hasCompletedOnboarding) {
              if (__DEV__) {
                console.log('[Navigation] Redirecting to onboarding');
              }
              router.replace('/onboarding');
            } else {
              if (__DEV__) {
                console.log('[Navigation] Redirecting to home');
              }
              router.replace('/home');
            }
          } catch (error) {
            console.error('Error verificando onboarding:', error);
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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="mode-select" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(coach)" />
      <Stack.Screen name="(admin)" />
    </Stack>
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
