import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { FeedbackDraftProvider } from '../context/FeedbackDraftContext';
import { CoachBrandingProvider } from '../context/CoachBrandingContext';
import { NotificationProvider } from '../context/NotificationContext';
import { TrainerProvider } from '../context/TrainerContext';
import { SubscriptionProvider } from '../context/SubscriptionContext';
import { AlertProvider } from '../src/hooks/useAlert';
import { SupplementInventoryProvider } from '../src/context/SupplementInventoryContext';
import { ImpersonationProvider } from '../context/ImpersonationContext';
import { GodModeBar } from '../components/GodModeBar';
import { SupervisorInviteModal } from '../components/SupervisorInviteModal';
import { StripeProvider } from '../utils/stripeWrapper';
import SpInAppUpdates, { IAUUpdateKind } from 'sp-react-native-in-app-updates';

// Inicializar Sentry (debe estar antes de cualquier otro código)
Sentry.init({
  dsn: 'https://eada1174d268233f129af26ac9aa67d9@o4510812278816768.ingest.de.sentry.io/4510812311912528',
  // Solo enviar errores en producción
  enabled: !__DEV__,
  // Release para tracking de versiones
  release: 'totalgains@1.1.4',
  environment: __DEV__ ? 'development' : 'production',
  // Configuración de rendimiento
  tracesSampleRate: 1.0,
  // Capturar errores de navegación
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
  // Adjuntar stack traces a todos los mensajes
  attachStacktrace: true,
});

// Mantén el splash visible hasta que el router + auth estén listos
try { SplashScreen.preventAutoHideAsync(); } catch { }

// FIX: Emoji rendering en macOS Chrome
// React Native Web genera font stacks SIN fuentes emoji (e.g. "...Arial,sans-serif").
// En macOS Chrome, sin "Apple Color Emoji" explícito, los emojis se muestran como □.
// Parcheamos las reglas CSS vía CSSOM (NO textContent, que destruye reglas dinámicas).
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const emojiFonts = ', "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
  const patchEmojiFonts = () => {
    const rnwEl = document.getElementById('react-native-stylesheet');
    if (!rnwEl || !rnwEl.sheet) return;
    const rules = rnwEl.sheet.cssRules;
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule.style && rule.style.fontFamily &&
          rule.style.fontFamily.includes('sans-serif') &&
          !rule.style.fontFamily.includes('Apple Color Emoji')) {
        rule.style.fontFamily = rule.style.fontFamily + emojiFonts;
      }
    }
  };
  // Parchear tras primer render (cuando RNW ya insertó sus reglas)
  if (document.readyState === 'complete') {
    patchEmojiFonts();
  } else {
    window.addEventListener('load', patchEmojiFonts);
  }
  // Observer para reglas que RNW inyecte después dinámicamente
  const obs = new MutationObserver(patchEmojiFonts);
  const target = document.getElementById('react-native-stylesheet');
  if (target) obs.observe(target, { childList: true, characterData: true, subtree: true });
}

// CSS global para scrollbar estilizado y fix de inputs en web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'custom-scrollbar-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* ════════════════════════════════════════════════════════════════════════
       * FIX: Quitar outline/borde feo en inputs y elementos focusables
       * React Native Web añade outline por defecto que no se ve bien
       * ════════════════════════════════════════════════════════════════════════ */
      input, textarea, [data-focusable="true"] {
        outline: none !important;
        outline-width: 0 !important;
        -webkit-appearance: none;
      }

      input:focus, textarea:focus, [data-focusable="true"]:focus {
        outline: none !important;
        outline-width: 0 !important;
        box-shadow: none !important;
      }

      /* Fix para Pressable y otros elementos de React Native Web */
      [tabindex], button, [role="button"] {
        outline: none !important;
      }

      [tabindex]:focus, button:focus, [role="button"]:focus {
        outline: none !important;
      }

      /* Scrollbar estilizado para elementos con scroll horizontal */
      .custom-scrollbar::-webkit-scrollbar {
        height: 6px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #1f2937;
        border-radius: 3px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: linear-gradient(90deg, #6366f1, #8b5cf6);
        border-radius: 3px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(90deg, #818cf8, #a78bfa);
      }

      /* Scrollbar global más delgado */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: #0D1B2A;
      }
      ::-webkit-scrollbar-thumb {
        background: #374151;
        border-radius: 4px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #4B5563;
      }
    `;
    document.head.appendChild(style);
  }
}

function RootLayoutNav() {
  const { token, isLoading, user, refreshUser } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState(); // router listo cuando tiene key
  const splashHidden = useRef(false);
  const redirectingRef = useRef(false);

  // Reset redirect guard on logout
  useEffect(() => {
    if (!token) {
      redirectingRef.current = false;
    }
  }, [token]);

  // Cargar fuentes de iconos para web
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  // ====== IN-APP UPDATES (Android & iOS) ======
  useEffect(() => {
    // No ejecutar en web ni en desarrollo
    if (Platform.OS === 'web' || __DEV__) return;

    const checkForUpdates = async () => {
      try {
        const inAppUpdates = new SpInAppUpdates(
          __DEV__ // Mostrar logs solo en desarrollo
        );

        const result = await inAppUpdates.checkNeedsUpdate();

        if (result.shouldUpdate) {
          if (Platform.OS === 'android') {
            // Android: Usar actualización inmediata (pantalla completa bloqueante)
            await inAppUpdates.startUpdate({
              updateType: IAUUpdateKind.IMMEDIATE,
            });
          } else if (Platform.OS === 'ios') {
            // iOS: Mostrar alerta y abrir App Store
            Alert.alert(
              '¡Nueva versión disponible!',
              'Hay una actualización disponible para TotalGains. Por favor, actualiza para disfrutar de las últimas mejoras.',
              [
                {
                  text: 'Actualizar ahora',
                  onPress: () => {
                    // Intentar usar la URL dinámica que devuelve la librería (trackViewUrl)
                    // @ts-ignore - 'other' puede contener trackViewUrl en iOS
                    const dynamicUrl = result.other?.trackViewUrl;

                    // Fallback a la URL proporcionada si no hay dinámica
                    const appStoreUrl = dynamicUrl || 'https://apps.apple.com/us/app/totalgains/id6756856683';

                    if (__DEV__) {
                      console.log('[InAppUpdates] Opening URL:', appStoreUrl);
                    }

                    Linking.openURL(appStoreUrl);
                  },
                },
                {
                  text: 'Más tarde',
                  style: 'cancel',
                },
              ],
              { cancelable: false }
            );
          }
        }
      } catch (error) {
        // Silenciar errores en producción (pueden ocurrir si la app no está en la tienda)
        if (__DEV__) {
          console.log('[InAppUpdates] Error checking for updates:', error);
        }
      }
    };

    checkForUpdates();
  }, []);

  // Oculta el splash UNA SOLA VEZ cuando todo está listo
  useEffect(() => {
    const ready = !!navState?.key && !isLoading && fontsLoaded;
    if (ready && !splashHidden.current) {
      SplashScreen.hideAsync().catch(() => { });
      splashHidden.current = true;
    }
  }, [navState?.key, isLoading, fontsLoaded]);

  // Redirecciones de auth (sin navegar a grupos)
  useEffect(() => {
    if (isLoading || !navState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const isRoot = (segments as string[]).length === 0 || ((segments as string[]).length === 1 && (segments[0] as string) === 'index');
    const inLoginPage = segments[0] === '(auth)' && segments[1] === 'login';

    // Si estamos en login, verificar AsyncStorage directamente para evitar race conditions
    if (inLoginPage) {
      (async () => {
        const storedToken = await AsyncStorage.getItem('totalgains_token');
        if (!storedToken) {
          if (__DEV__) {
            console.log('[Navigation] En login sin token en AsyncStorage, no redirigiendo');
          }
          return;
        } else if (__DEV__) {
          console.log('[Navigation] En login CON token en AsyncStorage, continuando con redirección');
        }
      })();
      // Si no hay token en el estado de React, no redirigir
      if (!token) {
        return;
      }
    }

    // Usuario sin sesión → login
    if (!token && !inAuthGroup) {
      router.replace('/login');
      return;
    }

    // Si ya está en onboarding, no redirigir (evita expulsarlo cuando refreshUser actualiza el estado)
    if (inOnboarding) {
      return;
    }

    // Already redirected this session - don't re-run (prevents triple-mount)
    if (redirectingRef.current) return;

    // Usuario con sesión en auth o root → redirigir según rol
    if (token && (inAuthGroup || isRoot)) {
      redirectingRef.current = true;
      (async () => {
        try {
          const freshUser = await refreshUser(true);
          // Use fresh data when available, fall back to local user (e.g. right after login)
          const targetUser = freshUser?.tipoUsuario ? freshUser : user;

          const isFreshAdminOrCoach = targetUser?.tipoUsuario === 'ADMINISTRADOR' ||
            targetUser?.tipoUsuario === 'ENTRENADOR';

          const isEstablishedUser = ['CLIENTE', 'PREMIUM', 'ENTRENADOR', 'ADMINISTRADOR']
            .includes(targetUser?.tipoUsuario || '');

          if (isFreshAdminOrCoach) {
            // Admin/Coach → mode-select para elegir
            if (__DEV__) {
              console.log('[Navigation] Redirecting admin/coach to mode-select (fresh data)');
            }
            router.replace('/mode-select');
          } else if (targetUser?.onboardingCompleted === true || isEstablishedUser) {
            // Usuario con onboarding completado O usuario establecido (CLIENTE/PREMIUM) → home
            if (__DEV__) {
              console.log('[Navigation] Redirecting to home (onboardingCompleted=true or established user)');
            }
            router.replace('/home');
          } else {
            // Usuario FREEUSER sin onboarding → onboarding
            if (__DEV__) {
              console.log('[Navigation] Redirecting to onboarding (FREEUSER without onboarding)');
            }
            router.replace('/onboarding');
          }
        } catch (error) {
          console.error('[Navigation] Error verificando usuario:', error);
          // Si hay error obteniendo datos, verificar con datos locales como fallback
          const isLocalAdminOrCoach = user?.tipoUsuario === 'ADMINISTRADOR' ||
            user?.tipoUsuario === 'ENTRENADOR';
          if (isLocalAdminOrCoach) {
            router.replace('/mode-select');
          } else {
            router.replace('/home');
          }
        }
      })();
    }
  }, [token, isLoading, navState?.key, segments, router]);

  if (isLoading || !navState?.key || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{
        headerShown: false,
        // Habilitar gesto de swipe back en iOS
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        animation: 'slide_from_right',
      }}>
        <Stack.Screen name="mode-select" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(coach)" />
        <Stack.Screen name="(supervisor)" />
        <Stack.Screen name="(admin)" />
      </Stack>
    </>
  );
}


// Componente que aplica el tema al contenedor raíz
function ThemedRootView({ children }: { children: React.ReactNode }) {
  const { isDark, theme } = useTheme();

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
        {children}
      </GestureHandlerRootView>
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        translucent={Platform.OS === 'android' ? false : undefined}
        backgroundColor={theme.background}
      />
    </>
  );
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

  return (
    <AuthProvider>
      <NotificationProvider>
        <TrainerProvider>
          <SubscriptionProvider>
            <CoachBrandingProvider>
              <AlertProvider>
                <ThemeProvider>
                  <FeedbackDraftProvider>
                    <SupplementInventoryProvider>
                      <StripeProvider
                        publishableKey={publishableKey}
                        merchantIdentifier="merchant.com.totalgains"
                      >
                        <ImpersonationProvider>
                          <ThemedRootView>
                            <GodModeBar />
                            <SupervisorInviteModal />
                            <RootLayoutNav />
                          </ThemedRootView>
                        </ImpersonationProvider>
                      </StripeProvider>
                    </SupplementInventoryProvider>
                  </FeedbackDraftProvider>
                </ThemeProvider>
              </AlertProvider>
            </CoachBrandingProvider>
          </SubscriptionProvider>
        </TrainerProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
