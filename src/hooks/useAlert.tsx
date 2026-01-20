// src/hooks/useAlert.tsx
// Hook universal para alertas: usa Alert.alert en móvil, Modal en web

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Alert,
} from 'react-native';

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'cancel' | 'default' | 'destructive';
}

interface AlertState {
    visible: boolean;
    title: string;
    message: string;
    buttons: AlertButton[];
}

interface AlertContextType {
    showAlert: (title: string, message: string, buttons?: AlertButton[]) => void;
}

// Contexto para el modal de alertas (solo necesario en web)
const AlertContext = createContext<AlertContextType | null>(null);

// Provider que debe envolver la app
export function AlertProvider({ children }: { children: ReactNode }) {
    const [alertState, setAlertState] = useState<AlertState>({
        visible: false,
        title: '',
        message: '',
        buttons: [],
    });

    const showAlert = useCallback((title: string, message: string, buttons: AlertButton[] = [{ text: 'OK' }]) => {
        if (Platform.OS === 'web') {
            // En web, mostrar modal
            setAlertState({ visible: true, title, message, buttons });
        } else {
            // En móvil, usar Alert nativo
            Alert.alert(title, message, buttons);
        }
    }, []);

    const hideAlert = useCallback(() => {
        setAlertState({ visible: false, title: '', message: '', buttons: [] });
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert }}>
            {children}
            {/* Modal solo se renderiza en web */}
            {Platform.OS === 'web' && (
                <Modal
                    visible={alertState.visible}
                    transparent
                    animationType="fade"
                    onRequestClose={hideAlert}
                >
                    <View style={styles.overlay}>
                        <View style={styles.modalContainer}>
                            {alertState.title ? (
                                <Text style={styles.title}>{alertState.title}</Text>
                            ) : null}
                            {alertState.message ? (
                                <Text style={styles.message}>{alertState.message}</Text>
                            ) : null}
                            <View style={styles.buttonsContainer}>
                                {alertState.buttons.map((button, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.button,
                                            button.style === 'cancel' && styles.cancelButton,
                                            button.style === 'destructive' && styles.destructiveButton,
                                            alertState.buttons.length === 1 && styles.singleButton,
                                        ]}
                                        onPress={() => {
                                            hideAlert();
                                            if (button.onPress) {
                                                button.onPress();
                                            }
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.buttonText,
                                                button.style === 'cancel' && styles.cancelButtonText,
                                                button.style === 'destructive' && styles.destructiveButtonText,
                                            ]}
                                        >
                                            {button.text}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </AlertContext.Provider>
    );
}

// Hook para usar alertas
export function useAlert(): AlertContextType {
    const context = useContext(AlertContext);

    if (!context) {
        // Fallback si no hay provider (para compatibilidad)
        return {
            showAlert: (title: string, message: string, buttons: AlertButton[] = [{ text: 'OK' }]) => {
                if (Platform.OS === 'web') {
                    // Fallback simple para web sin provider
                    window.alert(`${title}\n\n${message}`);
                    // Ejecutar el primer botón si existe
                    if (buttons.length > 0 && buttons[0].onPress) {
                        buttons[0].onPress();
                    }
                } else {
                    Alert.alert(title, message, buttons);
                }
            }
        };
    }

    return context;
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#1a1a2e',
        borderRadius: 16,
        padding: 24,
        maxWidth: 400,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 12,
    },
    message: {
        fontSize: 15,
        color: '#a0a0a0',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
    },
    button: {
        flex: 1,
        backgroundColor: '#6366f1',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
        minWidth: 100,
    },
    singleButton: {
        flex: 0,
        minWidth: 150,
    },
    cancelButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#4a4a5a',
    },
    destructiveButton: {
        backgroundColor: '#ef4444',
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
    },
    cancelButtonText: {
        color: '#a0a0a0',
    },
    destructiveButtonText: {
        color: '#ffffff',
    },
});

export default useAlert;
