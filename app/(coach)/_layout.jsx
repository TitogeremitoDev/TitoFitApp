import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function CoachLayout() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user || (user.tipoUsuario !== 'ADMINISTRADOR' && user.tipoUsuario !== 'ENTRENADOR')) {
            Alert.alert('Acceso denegado', 'Solo administradores y entrenadores pueden acceder');
            router.replace('/(app)');
        }
    }, [user]);

    return (
        <Stack
            screenOptions={{
                headerShown: false
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="clients_coach/index" />
            <Stack.Screen name="workouts/create" />
        </Stack>
    );
}
