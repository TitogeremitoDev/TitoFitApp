import { Stack } from 'expo-router';

export default function AdminLayout() {
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
