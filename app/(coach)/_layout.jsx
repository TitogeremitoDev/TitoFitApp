import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function CoachLayout() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user || user.tipoUsuario !== 'ADMINISTRADOR') {
            Alert.alert('Acceso denegado', 'Solo administradores pueden acceder');
            router.replace('/(app)');
        }
    }, [user]);

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: '#3b82f6' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' }
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Panel Entrenador' }} />
        </Stack>
    );
}
