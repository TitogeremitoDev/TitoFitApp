// app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext'; // Ajusta la ruta
import { ActivityIndicator, View } from 'react-native';

const RootLayoutNav = () => {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return; // No hagas nada mientras carga

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      // --- CORRECCIÓN 1 ---
      // Si no hay token y NO está en (auth), llévalo a /login
      router.replace('/login');
    } else if (token && inAuthGroup) {
      // --- CORRECCIÓN 2 (La de tu imagen) ---
      // Si hay token y SÍ está en (auth), llévalo al inicio: /
      router.replace('/');
    }
  }, [token, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Esto define los Stacks "principales" que puede ver el usuario
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(app)" />
      <Stack.Screen name="(auth)" />
      {/* Puedes añadir otras pantallas aquí si estuvieran fuera de los grupos */}
    </Stack>
  );
};

// El Layout Raíz
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}