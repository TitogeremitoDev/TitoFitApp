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

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {
        if (!email.trim()) {
            Alert.alert('Email requerido', 'Por favor introduce tu email.');
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await axios.post(`${API_URL}/api/auth/forgot-password`, {
                email: email.trim(),
            });

            console.log('[forgot-password] Response:', response.data);

            setSuccess(true);

            // Mostrar mensaje de éxito
            Alert.alert(
                'Email enviado',
                response.data.message || 'Si el email existe, recibirás instrucciones para recuperar tu contraseña.',
                [
                    {
                        text: 'Volver al login',
                        onPress: () => router.replace('/login'),
                    },
                ]
            );

            // Si es desarrollo y devuelve tempPassword, mostrarlo
            if (response.data.tempPassword) {
                console.log('[forgot-password] Contraseña temporal:', response.data.tempPassword);
            }
        } catch (e) {
            console.error('[forgot-password] error:', e);

            let msg = 'No se pudo enviar el email de recuperación';
            if (axios.isAxiosError(e) && e.response?.data?.message) {
                msg = e.response.data.message;
            }

            Alert.alert('Error', msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <LinearGradient colors={['#0B1220', '#0D1B2A', '#111827']} style={styles.bg}>
            <KeyboardAvoidingView
                style={{ flex: 1, width: '100%' }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
                    {/* Botón volver */}
                    <View style={styles.backButtonContainer}>
                        <Pressable onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#E5E7EB" />
                        </Pressable>
                    </View>

                    {/* Marca / encabezado */}
                    <View style={styles.brandWrap}>
                        <Ionicons name="key" size={64} color="#60A5FA" style={{ marginBottom: 16 }} />
                        <Text style={styles.brand}>Recuperar Contraseña</Text>
                        <Text style={styles.subtitle}>
                            Introduce tu email y te enviaremos una nueva contraseña
                        </Text>
                    </View>

                    {/* Card */}
                    <View style={styles.card}>
                        {!success ? (
                            <>
                                {/* Input email */}
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
                                            <Ionicons name="send-outline" size={18} color="#fff" />
                                            <Text style={styles.primaryTxt}>Enviar</Text>
                                        </>
                                    )}
                                </Pressable>

                                {/* Información adicional */}
                                <View style={styles.infoBox}>
                                    <Ionicons name="information-circle-outline" size={20} color="#60A5FA" />
                                    <Text style={styles.infoText}>
                                        Te enviaremos una contraseña temporal a tu email. Podrás cambiarla desde los ajustes de tu perfil.
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <View style={styles.successBox}>
                                <Ionicons name="checkmark-circle" size={64} color="#10B981" style={{ marginBottom: 16 }} />
                                <Text style={styles.successTitle}>Email enviado</Text>
                                <Text style={styles.successText}>
                                    Si el email existe en nuestro sistema, recibirás un correo con tu nueva contraseña temporal.
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Link volver al login */}
                    <Pressable onPress={() => router.replace('/login')} style={styles.backToLoginBtn}>
                        <Ionicons name="arrow-back-outline" size={16} color="#60A5FA" />
                        <Text style={styles.backToLoginText}>Volver al login</Text>
                    </Pressable>
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
        marginBottom: 16,
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
    },
    primaryTxt: { color: '#fff', fontWeight: '700' },
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
        paddingVertical: 20,
    },
    successTitle: {
        color: '#10B981',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 8,
    },
    successText: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
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
