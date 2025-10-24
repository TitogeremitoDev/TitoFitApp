import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            // ✅ Header transparente sin superponerse a la barra de estado
            headerTransparent: true,
            headerTopInsetEnabled: true,
            ...(Platform.OS === 'android'
              ? { statusBarTranslucent: false as any }
              : {}),

            headerTitle: '',
            headerBackTitleVisible: false,
            headerTintColor: 'black',
            headerShadowVisible: true, // sin línea bajo el header
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="entreno" />
          <Stack.Screen name="rutinas" />
          <Stack.Screen name="rutinas/[id]" />
          <Stack.Screen name="evolucion" />
          <Stack.Screen name="perfil" />
          <Stack.Screen name="videos" />
          <Stack.Screen name="+not-found" />
        </Stack>

        {/* Barra de estado visible y no translúcida (Android no dibuja debajo) */}
        <StatusBar
          style="auto"
          translucent={Platform.OS === 'android' ? false : undefined}
          backgroundColor="transparent"
        />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
