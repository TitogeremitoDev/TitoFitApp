import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { FeedbackBubbleProvider } from '../../context/FeedbackBubbleContext';

export default function CoachLayout() {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (!user || (user.tipoUsuario !== 'ADMINISTRADOR' && user.tipoUsuario !== 'ENTRENADOR')) {
            Alert.alert('Acceso denegado', 'Solo administradores y entrenadores pueden acceder');
            router.replace('/(app)');
        }
    }, [user]);

    return (
        <FeedbackBubbleProvider>
            <View style={{
                flex: 1,
                paddingTop: insets.top,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 0,
            }}>
                <Stack
                    screenOptions={{
                        headerShown: false,
                        gestureEnabled: true,
                        fullScreenGestureEnabled: true,
                        animation: 'slide_from_right',
                    }}
                >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="clients_coach/index" />
                    <Stack.Screen name="workouts/create" />
                    <Stack.Screen name="feedbacks/index" />
                </Stack>
            </View>
        </FeedbackBubbleProvider>
    );
}
