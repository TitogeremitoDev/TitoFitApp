// app/(auth)/forgot-password.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Alert,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';

const API_URL = 'http://localhost:3000';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const [nombre, setNombre] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tempPassword, setTempPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async () => {
        if (!nombre.trim() || !username.trim() || !email.trim()) {
            setErrorMessage('Por favor completa todos los campos.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const response = await axios.post(`${API_URL}/api/auth/forgot-password`, {
                nombre: nombre.trim(),
                username: username.trim(),
                email: email.trim(),
            });

            console.log('[forgot-password] Response:', response.data);

            // Verificar que la respuesta tenga la contraseña temporal
            if (response.data.success && response.data.tempPassword) {
                setTempPassword(response.data.tempPassword);
                // No llamar setIsSubmitting(false) aquí porque cambiamos de vista
            } else {
                // Si no hay tempPassword, algo salió mal
                console.warn('[forgot-password] No tempPassword in response:', response.data);
                setErrorMessage(response.data.message || 'No se pudo generar la contraseña.');
                setIsSubmitting(false);
            }
        } catch (e) {
            console.error('[forgot-password] Error completo:', e);

            let msg = 'No se pudo recuperar la contraseña';

            if (axios.isAxiosError(e)) {
                console.log('[forgot-password] Axios error response:', e.response?.data);
                console.log('[forgot-password] Axios error status:', e.response?.status);

                if (e.response?.data?.message) {
                    msg = e.response.data.message;
                } else if (e.response?.status === 401) {
                    msg = 'Los datos no coinciden. Verifica tu nombre, usuario y email.';
                } else if (e.response?.status === 404) {
                    msg = 'No se encontró una cuenta con ese email.';
                }
            } else {
                console.log('[forgot-password] Error no es de axios:', e);
            }

            console.log('[forgot-password] Mostrando mensaje:', msg);
            setErrorMessage(msg);
            setIsSubmitting(false);
        }
    };

    const copyPassword = async () => {
        await Clipboard.setStringAsync(tempPassword);
        Alert.alert('Copiado', 'Contraseña copiada al portapapeles');
    };

    const goToLogin = () => {
        router.replace('/login');
    };

    return (
        <LinearGradient colors={['#0B1220', '#0D1B2A', '#111827']} style={styles.bg}>
            <KeyboardAvoidingView
                style={{ flex: 1, width: '100%' }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
                    {/* Botón volver */}
                    {!tempPassword && (
                        <View style={styles.backButtonContainer}>
                            <Pressable onPress={() => router.back()} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={24} color="#E5E7EB" />
                            </Pressable>
                        </View>
                    )}

                    {/* Marca / encabezado */}
                    <View style={styles.brandWrap}>
                        <Ionicons
                            name={tempPassword ? "checkmark-circle" : "key"}
                            size={64}
                            color={tempPassword ? "#10B981" : "#60A5FA"}
                            style={{ marginBottom: 16 }}
                        />
                        <Text style={styles.brand}>
                            {tempPassword ? "¡Contraseña Generada!" : "Recuperar Contraseña"}
                        </Text>
                        <Text style={styles.subtitle}>
                            {tempPassword
                                ? "Usa esta contraseña para iniciar sesión"
                                : "Verifica tu identidad con 3 datos"
                            }
                        </Text>
                    </View>

                    {/* Card */}
                    <View style={styles.card}>
                        {!tempPassword ? (
                            <>
                                {/* Input Nombre */}
                                <View style={styles.inputWrap}>
                                    <Ionicons name="person-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Nombre completo"
                                        placeholderTextColor="#6B7280"
                                        autoCapitalize="words"
                                        value={nombre}
                                        onChangeText={setNombre}
                                        editable={!isSubmitting}
                                    />
                                </View>

                                {/* Input Username */}
                                <View style={styles.inputWrap}>
                                    <Ionicons name="at-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Usuario"
                                        placeholderTextColor="#6B7280"
                                        autoCapitalize="none"
                                        value={username}
                                        onChangeText={setUsername}
                                        editable={!isSubmitting}
                                    />
                                </View>

                                {/* Input Email */}
                                <View style={styles.inputWrap}>
                                    <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Email"
                                        placeholderTextColor="#6B7280"
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        value={email}
                                        onChangeText={setEmail}
                                        editable={!isSubmitting}
                                    />
                                </View>

                                {/* Botón enviar */}
                                <Pressable
                                    onPress={handleSubmit}
                                    disabled={isSubmitting}
                                    style={({ pressed }) => [
                                        styles.primaryBtn,
                                        pressed && { opacity: 0.9 },
                                        isSubmitting && { opacity: 0.7 },
                                    ]}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                                            <Text style={styles.primaryTxt}>Recuperar Contraseña</Text>
                                        </>
                                    )}
                                </Pressable>

                                {/* Mensaje de error */}
                                {errorMessage && (
                                    <View style={styles.errorBox}>
                                        <Ionicons name="alert-circle" size={20} color="#EF4444" />
                                        <Text style={styles.errorText}>{errorMessage}</Text>
                                    </View>
                                )}

                                {/* Información adicional */}
                                <View style={styles.infoBox}>
                                    <Ionicons name="information-circle-outline" size={20} color="#60A5FA" />
                                    <Text style={styles.infoText}>
                                        Si al menos 2 de los 3 datos coinciden, generaremos una contraseña temporal para acceder.
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <View style={styles.successBox}>
                                {/* Contraseña generada */}
                                <Text style={styles.successTitle}>Contraseña Temporal</Text>
                                <Text style={styles.successSubtitle}>Cópiala y úsala para iniciar sesión</Text>

                                <Pressable onPress={copyPassword} style={styles.passwordBox}>
                                    <Text style={styles.passwordText}>{tempPassword}</Text>
                                    <Ionicons name="copy-outline" size={24} color="#60A5FA" />
                                </Pressable>

                                <View style={styles.warningBox}>
                                    <Ionicons name="warning-outline" size={20} color="#F59E0B" />
                                    <Text style={styles.warningText}>
                                        Cambia esta contraseña desde Ajustes después de iniciar sesión.
                                    </Text>
                                </View>

                                <Pressable onPress={goToLogin} style={styles.successBtn}>
                                    <Ionicons name="log-in-outline" size={18} color="#fff" />
                                    <Text style={styles.successBtnText}>Ir al Login</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>

                    {/* Link volver al login */}
                    {!tempPassword && (
                        <Pressable onPress={() => router.replace('/login')} style={styles.backToLoginBtn}>
                            <Ionicons name="arrow-back-outline" size={16} color="#60A5FA" />
                            <Text style={styles.backToLoginText}>Volver al login</Text>
                        </Pressable>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1 },
    center: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    backButtonContainer: {
        position: 'absolute',
        top: Platform.OS === 'android' ? 20 : 50,
        left: 20,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    brandWrap: { alignItems: 'center', marginBottom: 24 },
    brand: {
        color: '#F9FAFB',
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    subtitle: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        maxWidth: 320,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        padding: 24,
        borderRadius: 16,
        backgroundColor: 'rgba(17,24,39,0.65)',
        borderWidth: 1,
        borderColor: '#1F2937',
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: 10,
        backgroundColor: '#0B1220',
        marginBottom: 12,
        paddingHorizontal: 10,
        height: 46,
    },
    inputIcon: { marginRight: 8 },
    input: { flex: 1, color: '#E5E7EB' },
    primaryBtn: {
        height: 48,
        borderRadius: 12,
        backgroundColor: '#2563EB',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
        marginTop: 4,
    },
    primaryTxt: { color: '#fff', fontWeight: '700' },
    errorBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderRadius: 8,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
        marginBottom: 12,
    },
    errorText: {
        flex: 1,
        color: '#FCA5A5',
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(96,165,250,0.1)',
        borderRadius: 8,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(96,165,250,0.2)',
    },
    infoText: {
        flex: 1,
        color: '#93C5FD',
        fontSize: 13,
        lineHeight: 18,
    },
    successBox: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    successTitle: {
        color: '#10B981',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 6,
    },
    successSubtitle: {
        color: '#9CA3AF',
        fontSize: 14,
        marginBottom: 20,
    },
    passwordBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 16,
        gap: 12,
        borderWidth: 2,
        borderColor: '#60A5FA',
        marginBottom: 16,
        width: '100%',
    },
    passwordText: {
        flex: 1,
        color: '#60A5FA',
        fontSize: 24,
        fontWeight: '700',
        letterSpacing: 2,
        textAlign: 'center',
    },
    warningBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(245,158,11,0.1)',
        borderRadius: 8,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.3)',
        marginBottom: 20,
        width: '100%',
    },
    warningText: {
        flex: 1,
        color: '#FCD34D',
        fontSize: 13,
        lineHeight: 18,
    },
    successBtn: {
        height: 48,
        borderRadius: 12,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        width: '100%',
    },
    successBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    backToLoginBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 20,
        padding: 10,
    },
    backToLoginText: {
        color: '#60A5FA',
        fontSize: 14,
        fontWeight: '600',
    },
});
