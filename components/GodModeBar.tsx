// ═══════════════════════════════════════════════════════════════════════════
// GOD MODE BAR
// ═══════════════════════════════════════════════════════════════════════════
// Barra flotante que aparece cuando un admin está usando "Modo Dios"
// Muestra el nombre del usuario que se está impersonando y botón para salir
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useImpersonation } from '../context/ImpersonationContext';

export const GodModeBar = () => {
    const { isImpersonating, impersonatedUser, impersonatorRole, exitImpersonation } = useImpersonation();
    const insets = useSafeAreaInsets();

    if (!isImpersonating || !impersonatedUser) {
        return null;
    }

    const exitLabel = impersonatorRole === 'coordinator' ? 'Volver a Supervisor' : 'Volver a Admin';

    return (
        <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? insets.top : 8 }]}>
            <View style={styles.content}>
                <View style={styles.leftSection}>
                    <Ionicons name="eye" size={20} color="#fff" />
                    <Text style={styles.text}>
                        Viendo como: <Text style={styles.userName}>{impersonatedUser.nombre}</Text>
                    </Text>
                </View>

                <TouchableOpacity style={styles.exitButton} onPress={exitImpersonation}>
                    <Ionicons name="exit-outline" size={18} color="#fff" />
                    <Text style={styles.exitText}>{exitLabel}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#DC2626', // Rojo distintivo
        paddingBottom: 8,
        paddingHorizontal: 16,
        zIndex: 9999,
        elevation: 999,
        // Sombra para destacar
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    text: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    userName: {
        fontWeight: 'bold',
    },
    exitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    exitText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
});
