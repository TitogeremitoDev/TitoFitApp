// app/_layout.tsx
import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
<<<<<<< HEAD
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
=======
import 'react-native-gesture-handler';
import 'react-native-reanimated';
>>>>>>> 5f1b8eda6ef10d87f4d5ced35f60636c46b4f368

// Mantén el splash visible hasta que el router + auth estén listos
try { SplashScreen.preventAutoHideAsync(); } catch {}

function RootLayoutNav() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState(); // router listo cuando tiene key
  const splashHidden = useRef(false);

  // Oculta el splash UNA SOLA VEZ cuando todo está listo
  useEffect(() => {
    const ready = !!navState?.key && !isLoading;
    if (ready && !splashHidden.current) {
      SplashScreen.hideAsync().catch(() => {});
      splashHidden.current = true;
    }
  }, [navState?.key, isLoading]);

  // Redirecciones de auth (sin navegar a grupos)
  useEffect(() => {
    if (isLoading || !navState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/login');   // p.ej. app/(auth)/login.tsx
    } else if (token && inAuthGroup) {
      router.replace('/');        // p.ej. app/(app)/index.tsx
    }
  }, [token, isLoading, navState?.key, segments, router]);

  if (isLoading || !navState?.key) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(app)" />
      <Stack.Screen name="(auth)" />
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
