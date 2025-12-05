// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  console.log("AUTH LAYOUT RENDER");
  
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}