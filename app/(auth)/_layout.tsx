// app/(auth)/_layout.tsx
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}