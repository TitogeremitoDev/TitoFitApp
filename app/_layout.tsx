// app/_layout.tsx
import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';

// Mantén el splash visible hasta que el router + auth estén listos
try { SplashScreen.preventAutoHideAsync(); } catch { }

function RootLayoutNav() {
  const { token, isLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState(); // router listo cuando tiene key
  const splashHidden = useRef(false);

  // Oculta el splash UNA SOLA VEZ cuando todo está listo
  useEffect(() => {
    const ready = !!navState?.key && !isLoading;
    if (ready && !splashHidden.current) {
      SplashScreen.hideAsync().catch(() => { });
      splashHidden.current = true;
    }
  }, [navState?.key, isLoading]);

  // Redirecciones de auth (sin navegar a grupos)
  useEffect(() => {
    if (isLoading || !navState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inModeSelect = (segments[0] as string) === 'mode-select';

    // Usuario sin sesión → login
    if (!token && !inAuthGroup) {
      router.replace('/login');
      return;
    }

    // Usuario con sesión en auth → redirigir según rol
    if (token && inAuthGroup) {
      const isAdminOrCoach = user?.tipoUsuario === 'ADMINISTRADOR' || user?.tipoUsuario === 'ENTRENADOR';

      if (isAdminOrCoach) {
        // Admin/Coach → mode-select para elegir
        router.replace('mode-select' as any);
      } else {
        // Usuario normal → directo a entrenar
        router.replace('/(app)');
      }
    }
  }, [token, isLoading, navState?.key, segments, router, user]);

  if (isLoading || !navState?.key) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="mode-select" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(coach)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootLayoutNav />
      </GestureHandlerRootView>
    </AuthProvider>
  );
}
