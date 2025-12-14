// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  console.log("AUTH LAYOUT RENDER");

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Habilitar gesto de swipe back en iOS
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        animation: 'slide_from_right',
      }}
    />
  );
}