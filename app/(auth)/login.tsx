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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';


// ═══════════════════════════════════════════════════════════════════════════
// WEB: Manejar OAuth en popup - Si estamos en un popup con token, enviar a padre y cerrar
// ═══════════════════════════════════════════════════════════════════════════
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // Verificar si estamos en un popup (tenemos window.opener)
  if (window.opener && window.location.hash) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');

    if (accessToken) {
      // Enviar el token a la ventana padre
      try {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_SUCCESS',
          accessToken: accessToken
        }, window.location.origin);
      } catch (e) {
        console.error('Error sending message to opener:', e);
      }
      // Cerrar este popup
      window.close();
    }
  }
}

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { login, loginWithGoogle, loginWithApple } = useAuth();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const processedResponseRef = useRef<string | null>(null); // ✅ Para trackear respuestas ya procesadas
  const urlTokenProcessedRef = useRef(false); // ✅ Para evitar procesar URL token múltiples veces

  // Estado para modal de error visual
  const [errorModal, setErrorModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: ''
  });

  // ════════════════════════════════════════════════════════════════════════
  // WEB: Detectar token de OAuth en URL hash al cargar la página
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (Platform.OS !== 'web' || urlTokenProcessedRef.current) return;

    // Verificar si hay token en el hash de la URL
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.substring(1); // Quitar el #
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');

      if (accessToken) {
        urlTokenProcessedRef.current = true;
        console.log('[Login] Token detectado en URL hash, procesando...');
        setIsGoogleLoading(true);

        // Limpiar el hash de la URL
        window.history.replaceState(null, '', window.location.pathname);

        // Procesar el token
        (async () => {
          try {
            await loginWithGoogle(accessToken);
            console.log('[Login] Login con Google desde URL completado');
          } catch (e) {
            console.error('[Login] Error procesando token de URL:', e);
            let msg = 'No se pudo completar el login con Google.';
            if (axios.isAxiosError(e)) {
              msg = e.response?.data?.message || e.message || msg;
            }
            Alert.alert('Error', msg);
          } finally {
            setIsGoogleLoading(false);
          }
        })();
      }
    }
  }, [loginWithGoogle]);

  // ════════════════════════════════════════════════════════════════════════
  // WEB: Escuchar mensajes del popup de OAuth
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleMessage = async (event: MessageEvent) => {
      // Verificar origen por seguridad
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data?.accessToken) {
        console.log('[Login] Token recibido desde popup');
        setIsGoogleLoading(true);

        try {
          await loginWithGoogle(event.data.accessToken);
          console.log('[Login] Login con Google desde popup completado');
        } catch (e) {
          console.error('[Login] Error procesando token de popup:', e);
          let msg = 'No se pudo completar el login con Google.';
          if (axios.isAxiosError(e)) {
            msg = e.response?.data?.message || e.message || msg;
          }
          Alert.alert('Error', msg);
        } finally {
          setIsGoogleLoading(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loginWithGoogle]);


  // ════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DE CLIENTES GOOGLE SEGÚN ENTORNO
  // ════════════════════════════════════════════════════════════════════════

  const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? 'dev' : 'prod');

  const ANDROID_DEV = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_DEV;
  const ANDROID_INTERNAL = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_INTERNAL;
  const ANDROID_PROD = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_PROD;
  const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  // iOS Client ID específico (diferente del Web Client ID)
  const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '915310517535-l8aclvjo3hqmh6frmb7otpge2ufqnaes.apps.googleusercontent.com';

  const androidClientId =
    APP_ENV === 'prod'
      ? ANDROID_PROD
      : APP_ENV === 'internal'
        ? ANDROID_INTERNAL
        : ANDROID_DEV;

  // ════════════════════════════════════════════════════════════════════════
  // INICIALIZACIÓN DE GOOGLE SIGN-IN NATIVO (Solo Android)
  // iOS usa expo-auth-session, no necesita el SDK nativo
  // ════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    // Solo Android necesita el SDK nativo de Google Sign-In
    // iOS usa expo-auth-session que no requiere esta configuración
    if (Platform.OS === 'android' && WEB_CLIENT_ID) {
      GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        offlineAccess: true,
        scopes: ['profile', 'email'],
      });
      console.log('[Login] GoogleSignin configurado para Android con webClientId:', WEB_CLIENT_ID);
    }
  }, []);

  // ════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DEL HOOK DE GOOGLE (solo para Web)
  // ════════════════════════════════════════════════════════════════════════

  // Determinar redirectUri para web
  const getRedirectUri = () => {
    if (Platform.OS === 'web') {
      // En producción, usar la URL con el baseUrl /app
      if (typeof window !== 'undefined' && window.location.hostname === 'totalgains.es') {
        return 'https://totalgains.es/app';
      }
      // En desarrollo local
      return undefined; // expo-auth-session lo maneja automáticamente
    }
    return undefined;
  };

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: Platform.OS === 'android' ? androidClientId : undefined,
    iosClientId: Platform.OS === 'ios' ? IOS_CLIENT_ID : undefined,
    webClientId: WEB_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: getRedirectUri(),
  });

  // ════════════════════════════════════════════════════════════════════════
  // LOGIN CLÁSICO (EMAIL/USERNAME + PASSWORD) - CORREGIDO
  // ════════════════════════════════════════════════════════════════════════

  const handleLogin = async () => {
    if (!emailOrUsername.trim() || !password.trim()) {
      setErrorModal({ visible: true, title: 'Datos incompletos', message: 'Introduce usuario/email y contraseña.' });
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

      setErrorModal({ visible: true, title: 'Error de inicio de sesión', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // LOGIN CON GOOGLE
  // ════════════════════════════════════════════════════════════════════════

  const handleGoogleLogin = async () => {
    // En Web e iOS, usar expo-auth-session
    if (Platform.OS === 'web' || Platform.OS === 'ios') {
      if (!request) {
        Alert.alert('No listo', 'La petición de Google aún no está inicializada. Intenta de nuevo.');
        return;
      }

      if (__DEV__) {
        console.log(`[Login] Iniciando Google Login (${Platform.OS === 'web' ? 'Web' : 'iOS'})...`);
        console.log('[Login] iOS Client ID:', IOS_CLIENT_ID);
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
      return;
    }

    // En Android, usar el SDK nativo de Google Sign-In
    if (__DEV__) {
      console.log('[Login] Iniciando Google Login (Android Nativo)...');
      console.log('[Login] Platform:', Platform.OS);
    }

    try {
      setIsGoogleLoading(true);

      // Verificar si Play Services está disponible (Android)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Iniciar el flujo de sign-in nativo
      const userInfo = await GoogleSignin.signIn();

      if (__DEV__) {
        console.log('[Login] Google Sign-In exitoso:', userInfo.data?.user?.email);
      }

      // Obtener el accessToken para enviar al backend
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

      if (__DEV__) {
        console.log('[Login] AccessToken obtenido:', accessToken ? 'SÍ' : 'NO');
      }

      if (!accessToken) {
        throw new Error('No se recibió accessToken de Google');
      }

      // Enviar al backend usando loginWithGoogle
      await loginWithGoogle(accessToken);

      if (__DEV__) {
        console.log('[Login] Login con Google completado exitosamente');
      }
    } catch (error: any) {
      console.error('[Login] Error en Google Sign-In nativo:', error);

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('[Login] Usuario canceló el login de Google');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('[Login] Login de Google ya en progreso');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services no está disponible');
      } else {
        let msg = 'No se pudo iniciar sesión con Google';
        if (axios.isAxiosError(error) && error.response?.data?.message) {
          msg = error.response.data.message;
        } else if (error.message) {
          msg = error.message;
        }
        Alert.alert('Error', msg);
      }
    } finally {
      setIsGoogleLoading(false);
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
  // LOGIN CON APPLE (SOLO iOS)
  // ════════════════════════════════════════════════════════════════════════

  const handleAppleLogin = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('No disponible', 'Sign in with Apple solo está disponible en iOS');
      return;
    }

    try {
      setIsAppleLoading(true);

      if (__DEV__) {
        console.log('[Login] Iniciando Apple Login...');
      }

      // Verificar si Apple Auth está disponible
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('No disponible', 'Sign in with Apple no está disponible en este dispositivo');
        setIsAppleLoading(false);
        return;
      }

      // Solicitar credenciales de Apple
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (__DEV__) {
        console.log('[Login] Credencial Apple recibida:', {
          user: credential.user,
          email: credential.email,
          fullName: credential.fullName,
          hasIdentityToken: !!credential.identityToken,
        });
      }

      if (!credential.identityToken) {
        Alert.alert('Error', 'No se recibió token de identidad de Apple');
        setIsAppleLoading(false);
        return;
      }

      const fullName = credential.fullName ? {
        givenName: credential.fullName.givenName ?? undefined,
        familyName: credential.fullName.familyName ?? undefined
      } : null;

      // Enviar al backend
      await loginWithApple(credential.identityToken, fullName);

      if (__DEV__) {
        console.log('[Login] Login con Apple completado exitosamente');
      }
    } catch (e: any) {
      console.error('[Login] Error en Apple Login:', e);

      // Si el usuario cancela, no mostrar error
      if (e.code === 'ERR_REQUEST_CANCELED') {
        if (__DEV__) {
          console.log('[Login] Usuario canceló el login de Apple');
        }
        setIsAppleLoading(false);
        return;
      }

      let msg = 'No se pudo iniciar sesión con Apple';
      if (axios.isAxiosError(e)) {
        msg = e.response?.data?.message || e.message || msg;
      } else if (e instanceof Error) {
        msg = e.message;
      }

      Alert.alert('Error', msg);
    } finally {
      setIsAppleLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // RENDER UI
  // ════════════════════════════════════════════════════════════════════════

  const isLoading = isSubmitting || isGoogleLoading || isAppleLoading;

  return (
    <LinearGradient colors={['#0B1220', '#0D1B2A', '#111827']} style={styles.bg}>
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          {/* Marca / encabezado */}
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>TotalGains</Text>
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
                  style={[styles.socialBtn, styles.apple, isAppleLoading && { opacity: 0.7 }]}
                  onPress={handleAppleLogin}
                  disabled={isLoading}
                >
                  {isAppleLoading ? (
                    <ActivityIndicator size="small" color="#111827" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={18} color="#111827" />
                      <Text style={[styles.socialTxt, { color: '#111827' }]}>Apple</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            {/* Link olvid contraseña */}
            <View style={styles.forgotPasswordRow}>
              <Link href="/forgot-password">
                <Text style={styles.forgotPasswordLink}>¿Olvidaste tu contraseña?</Text>
              </Link>
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

      {/* Modal de Error Visual */}
      <Modal
        visible={errorModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModal({ ...errorModal, visible: false })}
      >
        <View style={styles.errorModalOverlay}>
          <View style={styles.errorModalCard}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="close-circle" size={60} color="#EF4444" />
            </View>
            <Text style={styles.errorModalTitle}>{errorModal.title}</Text>
            <Text style={styles.errorModalMessage}>{errorModal.message}</Text>
            <Pressable
              style={styles.errorModalButton}
              onPress={() => setErrorModal({ ...errorModal, visible: false })}
            >
              <Text style={styles.errorModalButtonText}>Entendido</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    minHeight: 50, // iOS requiere mínimo 44pt para área táctil
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, color: '#E5E7EB', paddingVertical: 14 }, // Padding vertical para mejor área táctil en iOS
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
  forgotPasswordRow: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  forgotPasswordLink: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 6 },
  link: { color: '#60A5FA', fontWeight: '700' },
  // Error Modal Styles
  errorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorModalCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#374151',
  },
  errorIconContainer: {
    marginBottom: 16,
  },
  errorModalTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorModalMessage: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorModalButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  errorModalButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});