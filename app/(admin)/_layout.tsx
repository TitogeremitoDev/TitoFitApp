import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminLayout() {
    return (
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <Stack
                screenOptions={{
                    headerShown: false,
                    // Habilitar gesto de swipe back en iOS
                    gestureEnabled: true,
                    fullScreenGestureEnabled: true,
                    animation: 'slide_from_right',
                }}
            />
        </SafeAreaView>
    );
}
