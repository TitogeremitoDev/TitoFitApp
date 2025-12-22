/* app/_layout.tsx */

// --- 1. IMPORTACIONES AÑADIDAS ---
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
// --- ¡CAMBIO! Importamos el ARRAY COMPLETO de rutinas ---
import { predefinedRoutines } from '../../src/data/predefinedRoutines'; // Ajusta la ruta si es necesario

// --- 2. IMPORTACIONES EXISTENTES ---
// ThemeProvider de @react-navigation/native removido para evitar múltiples NavigationContainers
// Expo Router ya maneja la navegación internamente
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// Asegúrate de que la importación de Ionicons sea correcta para tu proyecto
// Puede ser '@expo/vector-icons' o '@react-vector-icons/ionicons'
import { Ionicons } from '@expo/vector-icons';

// useColorScheme ya no es necesario aquí

// AÑADIDO: Importar nuestro ThemeProvider personalizado
import { ThemeProvider as CustomThemeProvider, useTheme } from '../../context/ThemeContext';

// AÑADIDO: Sistema de logros estilo Steam
import AchievementToast from '../../components/AchievementToast';
import { AchievementsProvider, useAchievements } from '../../context/AchievementsContext';
import { useAuth } from '../../context/AuthContext';

// --- 3. CLAVES Y FUNCIÓN DE SEEDING (¡ACTUALIZADA!) ---
const RUTINAS_LIST_KEY = 'rutinas'; // Clave para la lista de metadatos

// Mantenemos el Splash Screen visible
//SplashScreen.preventAutoHideAsync();

// Helper para parsear JSON de forma segura devolviendo siempre un array
const safeParseArray = (jsonString: string | null): any[] => {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("safeParseArray error:", e);
    return [];
  }
};

// --- FUNCIÓN DE SEEDING ACTUALIZADA ---
const checkAndSeedPredefinedRoutines = async () => {
  console.log('Checking for predefined routines seeding...');
  try {
    const currentRoutinesJson = await AsyncStorage.getItem(RUTINAS_LIST_KEY);
    const currentRoutinesList = safeParseArray(currentRoutinesJson);
    const existingIds = new Set(currentRoutinesList.map(r => r?.id).filter(Boolean)); // Set con IDs existentes

    let routinesMetadataToAdd: any[] = []; // Metadatos a añadir a la lista 'rutinas'
    let routinesDataToSave: [string, string][] = []; // Datos completos a guardar [key, value] con multiSet

    // Iteramos sobre CADA rutina predefinida importada
    for (const routine of predefinedRoutines) {
      // Validar datos básicos de la rutina predefinida
      if (!routine || !routine.id || !routine.nombre || typeof routine.dias !== 'number' || !Array.isArray(routine.diasArr)) {
        console.warn('Skipping invalid predefined routine object:', routine?.nombre || 'Unknown ID');
        continue; // Saltar esta rutina si le faltan datos esenciales o no es válida
      }

      // Si la rutina NO existe ya en AsyncStorage
      if (!existingIds.has(routine.id)) {
        console.log(`Seeding routine: ${routine.nombre} (ID: ${routine.id})`);

        // 1. Preparamos los metadatos (sin diasArr) para la lista principal 'rutinas'
        //    Usamos destructuring para quitar diasArr
        const { diasArr, ...metadata } = routine;
        // Aseguramos que los metadatos básicos estén presentes antes de añadir
        if (metadata.id && metadata.nombre && metadata.dias) {
          routinesMetadataToAdd.push(metadata);
        } else {
          console.warn(`Metadata incomplete for predefined routine ID ${routine.id}. Skipping metadata addition.`);
          continue; // No añadir metadatos si falta algo esencial
        }


        // 2. Preparamos los datos completos (diasArr) para guardar bajo su clave específica 'routine_ID'
        const dataKey = `routine_${routine.id}`;
        // Validar que diasArr sea un array antes de guardar
        if (Array.isArray(diasArr)) {
          routinesDataToSave.push([dataKey, JSON.stringify(diasArr)]);
        } else {
          console.warn(`Exercise data (diasArr) is missing or invalid for routine ID ${routine.id}. Skipping data save.`);
          // Opcional: ¿Deberíamos eliminar los metadatos si los datos fallan?
          routinesMetadataToAdd.pop(); // Quitamos los metadatos si los datos son inválidos
          continue; // Saltar si los datos no son válidos
        }

      } else {
        console.log(`Routine already exists: ${routine.nombre} (ID: ${routine.id})`);
      }
    }

    // Si hay rutinas nuevas para añadir...
    if (routinesMetadataToAdd.length > 0) {
      console.log(`Adding ${routinesMetadataToAdd.length} new predefined routines to list and storage...`);
      const updatedRoutinesList = [...currentRoutinesList, ...routinesMetadataToAdd];

      // Guardamos la nueva lista de metadatos
      await AsyncStorage.setItem(RUTINAS_LIST_KEY, JSON.stringify(updatedRoutinesList));

      // Guardamos todos los datos completos de las nuevas rutinas
      if (routinesDataToSave.length > 0) {
        await AsyncStorage.multiSet(routinesDataToSave);
      }
      console.log('Predefined routines seeded successfully.');
      return true; // Indicamos que se hizo seeding

    } else {
      console.log('No new predefined routines to seed.');
      return false; // No se hizo seeding
    }

  } catch (error) {
    console.error('Error during predefined routines seeding:', error);
    // Podríamos lanzar una alerta aquí si es crítico
    // Alert.alert('Error', 'No se pudieron inicializar las rutinas predefinidas.');
    return false; // Error durante el seeding
  }
};
// --- FIN FUNCIÓN SEEDING ---


// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PARA SINCRONIZAR ACHIEVEMENTS CON ESTADO PREMIUM
// ═══════════════════════════════════════════════════════════════════════════
function AchievementsSyncWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { setIsPremium, loadFromCloud, isLoading: achievementsLoading } = useAchievements();

  useEffect(() => {
    // Determinar si el usuario es premium
    const isPremium = user?.tipoUsuario && user.tipoUsuario !== 'FREEUSER';

    // Configurar el estado premium en el contexto de achievements
    setIsPremium(isPremium);

    // Si es premium y no estamos cargando, sincronizar con la nube
    if (isPremium && !achievementsLoading) {
      loadFromCloud();
    }
  }, [user?.tipoUsuario, achievementsLoading, setIsPremium, loadFromCloud]);

  return <>{children}</>;
}

// Componente SafeAreaView con tema aplicado
// Usa useSafeAreaInsets para manejar correctamente tanto navegación por botones como por gestos
function ThemedSafeAreaView({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: insets.top,
      // Solo aplicar padding bottom si hay un inset real (navegación por botones)
      // En navegación por gestos, insets.bottom es muy pequeño (~20-30px) o 0
      paddingBottom: insets.bottom > 0 ? insets.bottom : 0,
    }}>
      {children}
    </View>
  );
}

export default function RootLayout() {
  const [loaded, fontError] = useFonts({ // Capturamos error de fuentes
    SpaceMono: require('../../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const router = useRouter();
  const [appIsReady, setAppIsReady] = useState(false); // Estado para controlar el Splash

  // --- useEffect para Cargar Fuentes y Ejecutar Seeding ---
  useEffect(() => {
    async function prepareApp() {
      try {
        // Carga de fuentes (ya estaba)
        // Esperar a que las fuentes estén cargadas O haya un error
        if (!loaded && !fontError) {
          // console.log("Fuentes aún no cargadas, esperando...");
          return; // Esperar al siguiente renderizado
        }
        if (fontError) {
          console.error("Error cargando fuentes:", fontError);
          throw fontError; // Lanzar error si las fuentes fallan
        }
        // console.log("Fuentes cargadas.");


        // Ejecutar el seeding de rutinas predefinidas
        await checkAndSeedPredefinedRoutines();

        // Puedes añadir otras tareas asíncronas aquí si las necesitas (ej: cargar sesión de usuario)

      } catch (e) {
        console.warn("Error preparing app:", e);
        // Manejar el error (quizás mostrar un mensaje al usuario o reintentar?)
      } finally {
        // Marcamos la app como lista SOLO si las fuentes están cargadas (o fallaron)
        if (loaded || fontError) {
          // console.log("App is ready, setting state.");
          setAppIsReady(true);
        }
      }
    }

    prepareApp();
  }, [loaded, fontError]); // Depende de 'loaded' y 'fontError'

  // --- useEffect para Ocultar el Splash Screen ---
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // console.log("Layout rendered and app is ready, hiding splash screen.");
      // Ocultar el splash screen una vez que la app está lista y el layout renderizado
      await SplashScreen.hideAsync();
    } else {
      // console.log("Layout rendered but app not ready yet.");
    }
  }, [appIsReady]);

  // Si la app no está lista (fuentes cargando, seeding en proceso), no renderizar nada
  // Esto evita el "flicker" antes de que el splash se oculte
  if (!appIsReady) {
    // console.log("App not ready, returning null.");
    return null; // O un componente de carga global si prefieres
  }

  // console.log("App is ready, rendering main layout.");
  // --- Renderizado Principal (cuando la app está lista) ---
  return (
    // AÑADIDO: Envolvemos todo con CustomThemeProvider
    <CustomThemeProvider>
      <AchievementsProvider>
        <AchievementsSyncWrapper>
          <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
            <SafeAreaProvider>
              <ThemedSafeAreaView>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    // Habilitar gesto de swipe back en iOS
                    gestureEnabled: true,
                    // Permitir swipe desde cualquier parte de la pantalla (solo iOS)
                    fullScreenGestureEnabled: true,
                    animation: 'slide_from_right',
                    // Tus screenOptions existentes para el header
                    headerTransparent: true,
                    ...(Platform.OS === 'android'
                      ? { statusBarTranslucent: false as any } // Ajusta 'as any' si no usas TS
                      : {}),
                    headerTitle: '',
                    headerTintColor: 'black',
                    headerShadowVisible: true,
                    headerLeft: (props) => { // Tu headerLeft personalizado
                      if (!props.canGoBack) return null;
                      return (
                        <View style={{ marginTop: Platform.OS === 'android' ? 10 : 5, marginLeft: Platform.OS === 'ios' ? 10 : 0 }}>
                          <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 5 })}>
                            <Ionicons name="arrow-back" size={24} color="black" />
                          </Pressable>
                        </View>
                      );
                    },
                  }}
                >
                  {/* Tus Stack.Screen existentes */}
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="home" options={{ headerShown: false }} />
                  <Stack.Screen name="entreno" />
                  <Stack.Screen
                    name="rutinas/[id]"
                    options={{
                      gestureEnabled: true,
                      fullScreenGestureEnabled: true,
                      animation: 'slide_from_right',
                    }}
                  />
                  <Stack.Screen name="perfil/evolucion" />
                  <Stack.Screen name="videos" />
                  <Stack.Screen name="+not-found" />

                </Stack>
              </ThemedSafeAreaView>

              {/* 🏆 Toast de logros estilo Steam */}
              <AchievementToast />
            </SafeAreaProvider>
          </View>
        </AchievementsSyncWrapper>
      </AchievementsProvider>
    </CustomThemeProvider >
  );
}