/**
 * CoachHelpButton.jsx
 * Botón flotante "Ayuda del Entrenador" que aparece solo para:
 * - Usuarios con entrenador asignado (currentTrainerId)
 * - Entrenadores que tienen otro entrenador superior
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const CoachHelpButton = ({ style }) => {
    const router = useRouter();
    const { user } = useAuth();

    // Determinar si el usuario puede ver este botón
    const canSeeHelp = () => {
        if (!user) return false;

        // Caso 1: Usuario cliente con entrenador asignado
        if (user.currentTrainerId) return true;

        // Caso 2: Entrenador que tiene otro entrenador superior
        if (user.trainerProfile?.trainer) return true;

        // Caso 3: Coach que tiene currentTrainerId (es cliente de otro coach)
        if (user.tipoUsuario === 'ENTRENADOR' && user.currentTrainerId) return true;

        return false;
    };

    if (!canSeeHelp()) return null;

    const handlePress = () => {
        router.push('/(app)/coach-help');
    };

    return (
        <TouchableOpacity
            style={[styles.button, style]}
            onPress={handlePress}
            activeOpacity={0.8}
        >
            <View style={styles.iconContainer}>
                <Feather name="help-circle" size={20} color="#fff" />
            </View>
            <Text style={styles.text}>Ayuda del Entrenador</Text>
            <View style={styles.badge}>
                <Text style={styles.badgeText}>FAQ</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2196F3',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        shadowColor: '#2196F3',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    text: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
    },
    badge: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
});

export default CoachHelpButton;
