// app/(auth)/login.tsx
import React, { useEffect, useState, useRef } from 'react';
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
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';


WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { login, loginWithGoogle } = useAuth();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const processedResponseRef = useRef<string | null>(null); // ✅ Para trackear respuestas ya procesadas


  // ════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DE CLIENTES GOOGLE SEGÚN ENTORNO
  // ════════════════════════════════════════════════════════════════════════
  
  const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? 'dev' : 'prod');

  const ANDROID_DEV = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_DEV;
  const ANDROID_INTERNAL = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_INTERNAL;
  const ANDROID_PROD = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_PROD;
  const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const androidClientId =
    APP_ENV === 'prod'
      ? ANDROID_PROD
      : APP_ENV === 'internal'
      ? ANDROID_INTERNAL
      : ANDROID_DEV;

  // Logging para debugging
  useEffect(() => {
    if (__DEV__) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[Auth Config] Platform:', Platform.OS);
      console.log('[Auth Config] DEV Mode:', __DEV__);
      console.log('[Auth Config] APP_ENV:', APP_ENV);
      console.log('[Auth Config] Android Client ID:', androidClientId);
      console.log('[Auth Config] Web Client ID:', WEB_CLIENT_ID);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }, []);

  // ════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DEL HOOK DE GOOGLE
  // ════════════════════════════════════════════════════════════════════════

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: Platform.OS === 'android' ? androidClientId : undefined,
    iosClientId: Platform.OS === 'ios' ? WEB_CLIENT_ID : undefined,
    webClientId: WEB_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
  });

  // ════════════════════════════════════════════════════════════════════════
  // LOGIN CLÁSICO (EMAIL/USERNAME + PASSWORD) - CORREGIDO
  // ════════════════════════════════════════════════════════════════════════

  const handleLogin = async () => {
    if (!emailOrUsername.trim() || !password.trim()) {
      Alert.alert('Datos incompletos', 'Introduce usuario/email y contraseña.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (__DEV__) {
        console.log('[Login] Intentando login clásico con:', emailOrUsername);
      }
      
      await login(emailOrUsername.trim(), password.trim());
      
      if (__DEV__) {
        console.log('[Login] Login clásico exitoso');
      }
    } catch (e) {
      console.error('[Login] Error en login clásico:', e);
      
      let msg = 'No se pudo iniciar sesión';
      if (axios.isAxiosError(e)) {
        if (e.response?.data?.message) {
          msg = e.response.data.message;
        } else if (e.message) {
          msg = e.message;
        }
      } else if (e instanceof Error) {
        msg = e.message;
      }
      
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // LOGIN CON GOOGLE
  // ════════════════════════════════════════════════════════════════════════

  const handleGoogleLogin = async () => {
    if (Platform.OS === 'android' && !androidClientId) {
      Alert.alert(
        'Configuración incompleta',
        `Falta el GOOGLE_ANDROID_CLIENT_ID para el entorno: ${APP_ENV}`
      );
      return;
    }

    if (!request) {
      Alert.alert(
        'No listo',
        'La petición de Google aún no está inicializada. Intenta de nuevo.'
      );
      return;
    }

    if (__DEV__) {
      console.log('[Login] Iniciando Google Login...');
      console.log('[Login] Platform:', Platform.OS);
      console.log('[Login] Android Client ID en uso:', androidClientId);
      console.log('[Login] Web Client ID:', WEB_CLIENT_ID);
    }

    try {
      setIsGoogleLoading(true);
      await promptAsync();
    } catch (e) {
      console.error('[Login] Error en promptAsync:', e);
      setIsGoogleLoading(false);
      
      let msg = 'No se pudo iniciar sesión con Google';
      if (axios.isAxiosError(e) && e.response?.data?.message) {
        msg = e.response.data.message;
      }
      Alert.alert('Error', msg);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // EFECTO: PROCESAR RESPUESTA DE GOOGLE
  // ════════════════════════════════════════════════════════════════════════

 useEffect(() => {
  if (!response) return;

  // ✅ CRÍTICO: Evitar procesar la misma respuesta múltiples veces
  const responseId = response.type === 'success' 
    ? (response as any)?.params?.state || (response as any)?.authentication?.issuedAt?.toString()
    : `${response.type}-${Date.now()}`;

  if (processedResponseRef.current === responseId) {
    if (__DEV__) {
      console.log('[Login] Respuesta ya procesada, ignorando:', responseId);
    }
    return; // Ya procesamos esta respuesta
  }

  // Marcar como procesada INMEDIATAMENTE
  processedResponseRef.current = responseId;

  const stopLoading = () => setIsGoogleLoading(false);

  if (__DEV__) {
    console.log('[Login] Google Response Type:', response.type);
    console.log('[Login] Response ID:', responseId);
  }

  if (response.type === 'success') {
    (async () => {
      try {
        const anyResponse: any = response;
        const accessToken: string | undefined =
          anyResponse?.authentication?.accessToken ||
          anyResponse?.params?.access_token;

        if (__DEV__) {
          console.log('[Login] Access Token recibido:', accessToken ? 'SÍ' : 'NO');
          if (accessToken) {
            console.log('[Login] Token (primeros 20 chars):', accessToken.substring(0, 20) + '...');
          }
        }

        if (!accessToken) {
          Alert.alert(
            'Error',
            'No se recibió accessToken de Google. Revisa la configuración OAuth.'
          );
          stopLoading();
          return;
        }

        if (__DEV__) {
          console.log('[Login] Enviando accessToken al backend...');
        }

        await loginWithGoogle(accessToken);

        if (__DEV__) {
          console.log('[Login] Login con Google completado exitosamente');
        }
      } catch (e) {
        console.error('[Login] Error en loginWithGoogle:', e);
        
        let msg = 'No se pudo completar el login con Google.';
        if (axios.isAxiosError(e)) {
          msg = e.response?.data?.message || e.message || msg;
        }
        
        Alert.alert('Error', msg);
      } finally {
        stopLoading();
      }
    })();
  } else if (response.type === 'cancel' || response.type === 'dismiss') {
    if (__DEV__) {
      console.log('[Login] Usuario canceló el login de Google');
    }
    stopLoading();
  } else if (response.type === 'error') {
    console.error('[Login] Error de Google:', response.error);
    Alert.alert(
      'Error',
      `Error en Google Login: ${response.error?.message || 'Desconocido'}`
    );
    stopLoading();
  }
}, [response]); // ✅ Solo depende de 'response', NO de loginWithGoogle

  // ════════════════════════════════════════════════════════════════════════
  // PLACEHOLDERS PARA OTROS PROVIDERS
  // ════════════════════════════════════════════════════════════════════════

  const socialSoon = (provider: string) => {
    Alert.alert('Próximamente', `Inicio de sesión con ${provider} aún no disponible.`);
  };

  // ════════════════════════════════════════════════════════════════════════
  // RENDER UI
  // ════════════════════════════════════════════════════════════════════════

  const isLoading = isSubmitting || isGoogleLoading;

  return (
    <LinearGradient colors={['#0B1220', '#0D1B2A', '#111827']} style={styles.bg}>
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          {/* Marca / encabezado */}
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>TitoFitApp</Text>
            <Text style={styles.subtitle}>Entrena mejor. Progresa siempre.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar sesión</Text>

            {/* Input usuario/email */}
            <View style={styles.inputWrap}>
              <Ionicons name="at-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email o usuario"
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
                value={emailOrUsername}
                onChangeText={setEmailOrUsername}
                editable={!isLoading}
              />
            </View>

            {/* Input contraseña */}
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor="#6B7280"
                secureTextEntry={secure}
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
              />
              <Pressable onPress={() => setSecure((s) => !s)} style={styles.eyeBtn}>
                <Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Botón entrar */}
            <Pressable
              onPress={handleLogin}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.9 },
                isLoading && { opacity: 0.7 },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={18} color="#fff" />
                  <Text style={styles.primaryTxt}>Entrar</Text>
                </>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <View style={styles.divider} />
            </View>

            {/* Botones sociales */}
            <View style={styles.socialRow}>
              <Pressable
                style={[
                  styles.socialBtn,
                  styles.google,
                  (!request || isLoading) && { opacity: 0.7 },
                ]}
                onPress={handleGoogleLogin}
                disabled={!request || isLoading}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator size="small" color="#111827" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={18} color="#111827" />
                    <Text style={[styles.socialTxt, { color: '#111827' }]}>Google</Text>
                  </>
                )}
              </Pressable>

              {Platform.OS === 'ios' && (
                <Pressable
                  style={[styles.socialBtn, styles.apple]}
                  onPress={() => socialSoon('Apple')}
                  disabled={isLoading}
                >
                  <Ionicons name="logo-apple" size={18} color="#111827" />
                  <Text style={[styles.socialTxt, { color: '#111827' }]}>Apple</Text>
                </Pressable>
              )}
            </View>

            {/* Link registro */}
            <View style={styles.bottomRow}>
              <Text style={{ color: '#9CA3AF' }}>¿No tienes cuenta? </Text>
              <Link href="/register">
                <Text style={styles.link}>Regístrate</Text>
              </Link>
            </View>
          </View>
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
  brandWrap: { alignItems: 'center', marginBottom: 16 },
  brand: { color: '#F9FAFB', fontSize: 28, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { color: '#9CA3AF', marginTop: 4, fontSize: 13 },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(17,24,39,0.65)',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardTitle: { color: '#E5E7EB', fontSize: 18, fontWeight: '700', marginBottom: 12 },
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
  eyeBtn: { padding: 6, marginLeft: 4 },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryTxt: { color: '#fff', fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  divider: { flex: 1, height: 1, backgroundColor: '#1F2937' },
  dividerTxt: { color: '#6B7280', marginHorizontal: 8, fontSize: 12 },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  socialBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  socialTxt: { fontWeight: '700' },
  google: { backgroundColor: '#FCD34D' },
  apple: { backgroundColor: '#D1D5DB' },
  facebook: { backgroundColor: '#93C5FD' },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  link: { color: '#60A5FA', fontWeight: '700' },
});