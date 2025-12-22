import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminLayout() {
    const insets = useSafeAreaInsets();

    return (
        <View style={{
            flex: 1,
            paddingTop: insets.top,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 0,
        }}>
            <Stack
                screenOptions={{
                    headerShown: false,
                    // Habilitar gesto de swipe back en iOS
                    gestureEnabled: true,
                    fullScreenGestureEnabled: true,
                    animation: 'slide_from_right',
                }}
            />
        </View>
    );
}
