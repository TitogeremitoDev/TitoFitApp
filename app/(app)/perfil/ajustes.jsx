/* app/ajustes.jsx
   ────────────────────────────────────────────────────────────────────────
   Pantalla de Ajustes - Configuración de la aplicación
   Incluye selección de tema (Automático, Modo Día, Modo Noche)
   ──────────────────────────────────────────────────────────────────────── */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useAchievements } from '../../../context/AchievementsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import SyncProgressModal from '../../../components/SyncProgressModal';
import { syncLocalToCloud } from '../../../src/lib/dataSyncService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

// ═══════════════════════════════════════════════════════════════════════════
// SISTEMA DE TIERS DE TEMAS
// ═══════════════════════════════════════════════════════════════════════════

const THEME_TIERS = {
  pokeball: 'normal',
  pikachu: 'pro',
  gengar: 'legend',
  galactic_empire: 'pro',
  jedi_master: 'pro',
  stark_industries: 'pro',
  captain_america: 'pro',
  horde: 'pro',
  alliance: 'pro',
};

const TIER_PRICES = {
  normal: { free: 1500, premium: 1000 },
  pro: { free: 3000, premium: 2000 },
  legend: { free: 5000, premium: 3000 },
};

const TIER_COLORS = {
  normal: '#22c55e',  // Verde
  pro: '#a855f7',     // Morado
  legend: '#fbbf24',  // Dorado
};

const TIER_LABELS = {
  normal: 'NORMAL',
  pro: 'PRO',
  legend: 'LEGEND',
};

export default function AjustesScreen() {
  const router = useRouter();
  const { theme, themeMode, currentThemeId, setThemeId } = useTheme();
  const { user, logout, refreshUser, token } = useAuth();
  const { serverPoints } = useAchievements();

  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loadingSub, setLoadingSub] = useState(true);

  // Estados para cambio de contraseña
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estado para modal de cancelar suscripción
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);

  // Estado para exportar datos
  const [exportingData, setExportingData] = useState(false);

  // Estado para sincronización manual a la nube
  const [syncingToCloud, setSyncingToCloud] = useState(false);
  const [syncModal, setSyncModal] = useState({
    visible: false,
    direction: 'upload',
    isComplete: false,
    itemsSynced: 0,
  });

  // Estado para secciones de temas expandidas (solo Básicos abierto por defecto)
  const [expandedSections, setExpandedSections] = useState({ 'Básicos': true });

  // Estados para tienda de temas
  const [unlockedThemes, setUnlockedThemes] = useState([]);
  const [userPoints, setUserPoints] = useState(0);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedThemeToPurchase, setSelectedThemeToPurchase] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  // Estados para eliminar cuenta (Apple Guideline 5.1.1(v))
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Estados para desvincular entrenador
  const [showLeaveTrainerModal, setShowLeaveTrainerModal] = useState(false);
  const [leavingTrainer, setLeavingTrainer] = useState(false);


  // Determinar si el usuario es premium/cliente/entrenador/admin
  const isPremiumUser = ['PREMIUM', 'CLIENTE', 'ENTRENADOR', 'ADMIN'].includes(user?.tipoUsuario);
  const isAdmin = user?.tipoUsuario === 'ADMIN';

  // Cargar temas desbloqueados al inicio (local para FREEUSER, cloud para premium)
  useEffect(() => {
    const loadUnlockedThemes = async () => {
      try {
        // Siempre cargar del local primero
        const saved = await AsyncStorage.getItem('totalgains_unlocked_themes');
        if (saved) {
          setUnlockedThemes(JSON.parse(saved));
        }

        // Si es premium, también cargar del servidor y hacer merge
        if (isPremiumUser) {
          const token = await AsyncStorage.getItem('totalgains_token');
          if (token) {
            try {
              const response = await fetch(`${API_URL}/api/achievements`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const data = await response.json();

              if (data.purchases && Array.isArray(data.purchases)) {
                // Merge local y cloud purchases
                const cloudPurchases = data.purchases;
                const localPurchases = saved ? JSON.parse(saved) : [];
                const merged = [...new Set([...localPurchases, ...cloudPurchases])];

                setUnlockedThemes(merged);
                // Actualizar local storage con el merge
                await AsyncStorage.setItem('totalgains_unlocked_themes', JSON.stringify(merged));
              }

              // También actualizar puntos desde el servidor
              if (typeof data.points === 'number') {
                setUserPoints(data.points);
              }
            } catch (cloudError) {
              console.warn('[Ajustes] Error loading purchases from cloud:', cloudError);
            }
          }
        }
      } catch (e) {
        console.warn('[Ajustes] Error loading unlocked themes:', e);
      }
    };
    loadUnlockedThemes();
  }, [isPremiumUser]);

  // Sincronizar puntos con serverPoints
  useEffect(() => {
    if (serverPoints !== null) {
      setUserPoints(serverPoints);
    }
  }, [serverPoints]);

  // Función para verificar si un tema está desbloqueado
  const isThemeUnlocked = (themeMode) => {
    // Admin tiene todo desbloqueado
    if (isAdmin) return true;
    // Temas básicos siempre desbloqueados
    if (!THEME_TIERS[themeMode]) return true;
    // Verificar si fue comprado
    return unlockedThemes.includes(themeMode);
  };

  // Función para obtener el precio de un tema
  const getThemePrice = (themeMode) => {
    const tier = THEME_TIERS[themeMode];
    if (!tier) return null;
    const priceType = isPremiumUser ? 'premium' : 'free';
    return TIER_PRICES[tier][priceType];
  };

  // Función para comprar un tema
  const handlePurchaseTheme = async () => {
    if (!selectedThemeToPurchase) return;

    const price = getThemePrice(selectedThemeToPurchase.mode);
    if (userPoints < price) {
      Alert.alert('Puntos insuficientes', 'No tienes suficientes puntos para comprar este tema.');
      return;
    }

    setPurchasing(true);
    try {
      const themeId = selectedThemeToPurchase.mode;
      let newPoints = userPoints - price;
      let newUnlockedThemes = [...unlockedThemes, themeId];

      // Para usuarios premium, usar API cloud
      if (isPremiumUser) {
        const token = await AsyncStorage.getItem('totalgains_token');
        if (token) {
          const response = await fetch(`${API_URL}/api/achievements/purchase`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              itemId: themeId,
              price: price,
              itemType: 'theme'
            })
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            if (data.alreadyOwned) {
              Alert.alert('Ya lo tienes', 'Este tema ya está desbloqueado.');
              setShowPurchaseModal(false);
              return;
            }
            throw new Error(data.error || 'Error al comprar');
          }

          // Usar los valores actualizados del servidor
          newPoints = data.remaining;
          newUnlockedThemes = data.purchases;
        }
      }

      // Siempre guardar en local (backup y para users free)
      await AsyncStorage.setItem('totalgains_unlocked_themes', JSON.stringify(newUnlockedThemes));

      setUnlockedThemes(newUnlockedThemes);
      setUserPoints(newPoints);
      setShowPurchaseModal(false);
      setSelectedThemeToPurchase(null);

      // Aplicar el tema recién comprado
      await handleThemeChange(themeId);

      Alert.alert('¡Tema desbloqueado!', `Has desbloqueado el tema ${selectedThemeToPurchase.title}`);
    } catch (error) {
      console.error('[Ajustes] Error purchasing theme:', error);
      Alert.alert('Error', 'No se pudo completar la compra.');
    } finally {
      setPurchasing(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Función para exportar todos los datos del usuario
  const handleExportData = async () => {
    setExportingData(true);
    try {
      const token = await AsyncStorage.getItem('totalgains_token');
      const exportData = {
        exportDate: new Date().toISOString(),
        userId: user?._id || user?.id,
        userEmail: user?.email,
        userName: user?.nombre,
        localData: {},
        cloudData: {}
      };

      // 1. Obtener datos locales de AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const userRelatedKeys = allKeys.filter(key =>
        key.startsWith('routine_') ||
        key.startsWith('rutinas') ||
        key.startsWith('progress_') ||
        key.startsWith('workout_') ||
        key.startsWith('exercises_') ||
        key.startsWith('info_user') ||
        key.startsWith('totalgains_') ||
        key.startsWith('activeRoutineId')
      );

      for (const key of userRelatedKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            try {
              exportData.localData[key] = JSON.parse(value);
            } catch {
              exportData.localData[key] = value;
            }
          }
        } catch (e) {
          console.warn(`Error reading key ${key}:`, e);
        }
      }

      // 2. Obtener datos de la nube si hay token
      if (token) {
        try {
          // Obtener rutinas del usuario
          const routinesRes = await fetch(`${API_URL}/api/routines`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const routinesData = await routinesRes.json();
          if (routinesData.success) {
            exportData.cloudData.routines = routinesData.routines;
          }

          // Obtener workouts/sesiones de entrenamiento
          const workoutsRes = await fetch(`${API_URL}/api/workouts`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const workoutsData = await workoutsRes.json();
          if (workoutsData.success) {
            exportData.cloudData.workouts = workoutsData.workouts;
          }

          // Obtener ejercicios creados por el usuario
          const exercisesRes = await fetch(`${API_URL}/api/exercises`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const exercisesData = await exercisesRes.json();
          if (exercisesData.success) {
            exportData.cloudData.exercises = exercisesData.exercises;
          }

          // Obtener info del usuario
          const userRes = await fetch(`${API_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const userData = await userRes.json();
          if (userData.success || userData.user) {
            exportData.cloudData.userProfile = userData.user || userData;
          }
        } catch (cloudError) {
          console.warn('Error fetching cloud data:', cloudError);
          exportData.cloudData.error = 'No se pudieron obtener algunos datos de la nube';
        }
      }

      // 3. Guardar como archivo JSON
      const fileName = `TotalGains_Export_${new Date().toISOString().split('T')[0]}.json`;
      const jsonString = JSON.stringify(exportData, null, 2);

      // Detectar si estamos en web
      if (Platform.OS === 'web') {
        // Web: Crear un Blob y descargarlo
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        Alert.alert(
          'Exportación completada',
          `Archivo "${fileName}" descargado correctamente.`,
          [{ text: 'OK' }]
        );
      } else {
        // Mobile: Usar FileSystem y Sharing
        const fileUri = FileSystem.documentDirectory + fileName;

        await FileSystem.writeAsStringAsync(
          fileUri,
          jsonString,
          { encoding: FileSystem.EncodingType.UTF8 }
        );

        // 4. Compartir el archivo
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Exportar datos de TotalGains'
          });
        } else {
          Alert.alert(
            'Archivo guardado',
            `Tus datos han sido exportados a: ${fileName}`,
            [{ text: 'OK' }]
          );
        }
      }

    } catch (error) {
      console.error('[Ajustes] Error exportando datos:', error);
      Alert.alert('Error', 'No se pudieron exportar los datos. Inténtalo de nuevo.');
    } finally {
      setExportingData(false);
    }
  };

  // Función para sincronizar datos locales a la nube manualmente
  const handleSyncToCloud = async () => {
    if (!isPremiumUser) return;

    setSyncingToCloud(true);
    setSyncModal({ visible: true, direction: 'upload', isComplete: false, itemsSynced: 0 });

    try {
      const token = await AsyncStorage.getItem('totalgains_token');
      if (!token) {
        Alert.alert('Error', 'No se encontró la sesión. Por favor, reinicia la app.');
        return;
      }

      const syncResult = await syncLocalToCloud(token);
      setSyncModal(prev => ({ ...prev, isComplete: true, itemsSynced: syncResult?.itemsSynced || 0 }));

      // Esperar un momento para que el usuario vea el resultado
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (syncResult?.success) {
        Alert.alert('✅ Sincronización completada', `Se sincronizaron ${syncResult.itemsSynced} registros a la nube.`);
      } else {
        Alert.alert('Atención', 'No había datos nuevos para sincronizar o hubo un error.');
      }
    } catch (error) {
      console.error('[Ajustes] Error sincronizando a la nube:', error);
      Alert.alert('Error', 'No se pudieron sincronizar los datos.');
    } finally {
      setSyncModal(prev => ({ ...prev, visible: false }));
      setSyncingToCloud(false);
    }
  };

  const themeOptions = [
    // ═══════════════════════════════════════════════════════════════
    // BÁSICOS
    // ═══════════════════════════════════════════════════════════════
    { section: 'Básicos' },
    {
      mode: 'auto',
      title: '🔄 Automático',
      subtitle: 'Sigue el tema del sistema',
      icon: 'phone-portrait-outline',
    },
    {
      mode: 'light',
      title: '☀️ Modo Día',
      subtitle: 'Tema claro siempre',
      icon: 'sunny-outline',
    },
    {
      mode: 'dark',
      title: '🌙 Modo Noche',
      subtitle: 'Tema oscuro siempre',
      icon: 'moon-outline',
    },
    // ═══════════════════════════════════════════════════════════════
    // POKÉMON
    // ═══════════════════════════════════════════════════════════════
    { section: 'Monsters' },
    {
      mode: 'pokeball',
      title: '🔴 Poké',
      subtitle: 'Rojo y blanco clásico de Pokéball',
      icon: 'ellipse-outline',
    },
    {
      mode: 'pikachu',
      title: '⚡ Pika',
      subtitle: 'Amarillo eléctrico con fondo oscuro',
      icon: 'flash-outline',
    },
    {
      mode: 'gengar',
      title: '👻 Fantasma',
      subtitle: 'Púrpura fantasmal, oscuro y misterioso',
      icon: 'skull-outline',
    },

    // ═══════════════════════════════════════════════════════════════
    // STAR WARS
    // ═══════════════════════════════════════════════════════════════
    { section: 'GuerraGalactica' },
    {
      mode: 'galactic_empire',
      title: '👹 Lord Oscuro',
      subtitle: 'El lado oscuro de la fuerza',
      icon: 'planet-outline',
    },
    {
      mode: 'jedi_master',
      title: '🟢 The Force',
      subtitle: 'Verde Jedi, equilibrio y serenidad',
      icon: 'leaf-outline',
    },
    // ═══════════════════════════════════════════════════════════════
    // MARVEL
    // ═══════════════════════════════════════════════════════════════
    { section: 'Heroes' },
    {
      mode: 'stark_industries',
      title: '🤖 Iron Tech',
      subtitle: 'Tecnología de Stark Industries',
      icon: 'hardware-chip-outline',
    },
    {
      mode: 'captain_america',
      title: '🛡️ First Heroe',
      subtitle: 'Azul patriótico y rojo',
      icon: 'shield-outline',
    },
    // ═══════════════════════════════════════════════════════════════
    // WARCRAFT
    // ═══════════════════════════════════════════════════════════════
    { section: 'Warcraft' },
    {
      mode: 'horde',
      title: '⚔️ The Horde',
      subtitle: 'Rojo sangre, honor orco',
      icon: 'flame-outline',
    },
    {
      mode: 'alliance',
      title: '🦁 The Alliance',
      subtitle: 'Azul real, nobleza humana',
      icon: 'flag-outline',
    },
  ];

  const handleThemeChange = async (mode) => {
    // Mapeamos los modos básicos a sus IDs de tema correspondientes
    const modeToThemeId = {
      'auto': 'default_light', // Por ahora auto = light (el sistema lo manejará internamente si lo necesitamos)
      'light': 'default_light',
      'dark': 'default_dark',
    };

    const themeId = modeToThemeId[mode] || mode;
    await setThemeId(themeId);
  };

  // Cargar estado de suscripción
  const loadSubscriptionStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('totalgains_token');
      if (!token || !user) return;

      const response = await fetch(`${API_URL}/api/subscription/status`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setSubscriptionData(data.subscription);
      }
    } catch (error) {
      console.error('[Ajustes] Error cargando suscripción:', error);
    } finally {
      setLoadingSub(false);
    }
  };

  // Cancelar suscripción - abre el modal de confirmación
  const handleCancelSubscription = () => {
    setShowCancelModal(true);
  };

  // Confirmar cancelación de suscripción
  const confirmCancelSubscription = async () => {
    setCancellingSubscription(true);
    try {
      const token = await AsyncStorage.getItem('totalgains_token');
      const response = await fetch(`${API_URL}/api/subscription/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setShowCancelModal(false);
        loadSubscriptionStatus(); // Recargar estado
      } else {
        // Mostrar error en consola, el modal permanece abierto
        console.error('[Ajustes] Error:', data.message);
      }
    } catch (error) {
      console.error('[Ajustes] Error cancelando suscripción:', error);
    } finally {
      setCancellingSubscription(false);
    }
  };



  // Cambiar contraseña
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Campos vacíos', 'Por favor completa todos los campos.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setChangingPassword(true);
    try {
      const token = await AsyncStorage.getItem('totalgains_token');
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert('Éxito', 'Contraseña actualizada correctamente.');
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('Error', data.message || 'No se pudo cambiar la contraseña.');
      }
    } catch (error) {
      console.error('[Ajustes] Error cambiando contraseña:', error);
      Alert.alert('Error', 'No se pudo cambiar la contraseña.');
    } finally {
      setChangingPassword(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ELIMINAR CUENTA (Apple Guideline 5.1.1(v))
  // ═══════════════════════════════════════════════════════════════════════════
  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const token = await AsyncStorage.getItem('totalgains_token');
      const response = await fetch(`${API_URL}/api/users/delete-account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        // Cerrar modal
        setShowDeleteAccountModal(false);

        // Cerrar sesión (limpia AsyncStorage y estado)
        await logout();

        Alert.alert(
          '✅ Cuenta Eliminada',
          'Tu cuenta y todos tus datos han sido eliminados correctamente.',
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
      } else {
        Alert.alert('Error', data.message || 'No se pudo eliminar la cuenta.');
      }
    } catch (error) {
      console.error('[Ajustes] Error eliminando cuenta:', error);
      Alert.alert('Error', 'No se pudo eliminar la cuenta. Inténtalo de nuevo.');
    } finally {
      setDeletingAccount(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DESVINCULAR ENTRENADOR
  // ═══════════════════════════════════════════════════════════════════════════
  const handleLeaveTrainer = async () => {
    setLeavingTrainer(true);
    try {
      const authToken = await AsyncStorage.getItem('totalgains_token');
      const response = await fetch(`${API_URL}/api/users/leave-trainer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setShowLeaveTrainerModal(false);

        // Refrescar usuario para obtener el nuevo estado
        await refreshUser();

        Alert.alert(
          '✅ Desvinculado',
          'Ya no eres cliente de este entrenador. Ahora eres usuario gratuito.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', data.message || 'No se pudo desvincular del entrenador.');
      }
    } catch (error) {
      console.error('[Ajustes] Error desvinculando entrenador:', error);
      Alert.alert('Error', 'No se pudo desvincular del entrenador. Inténtalo de nuevo.');
    } finally {
      setLeavingTrainer(false);
    }
  };

  // Cargar suscripción al montar

  useEffect(() => {
    if (user) {
      loadSubscriptionStatus();
    }
  }, [user]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >


        {/* Sección de Apariencia */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { marginTop: 30, backgroundColor: theme.sectionHeader }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="color-palette-outline" size={20} color={theme.text} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Apariencia
              </Text>
            </View>
            {/* Puntos actuales */}
            <View style={styles.headerPointsContainer}>
              <Text style={styles.headerCoinIcon}>🪙</Text>
              <Text style={[styles.headerPointsText, { color: theme.primary }]}>
                {userPoints?.toLocaleString() || 0}
              </Text>
            </View>
          </View>

          <View style={[styles.sectionContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
              Personaliza cómo se ve la aplicación
            </Text>

            {/* Opciones de Tema */}
            {(() => {
              let currentSection = null;

              return themeOptions.map((option, index) => {
                // Si es un separador de sección
                if (option.section) {
                  currentSection = option.section;
                  const isExpanded = expandedSections[option.section] || false;
                  const isBasicSection = option.section === 'Básicos';

                  // Mostrar título de Tienda de Temas antes de la sección Monsters (primera sección de temas comprables)
                  const showStoreHeader = option.section === 'Monsters';

                  return (
                    <React.Fragment key={`section-${option.section}`}>
                      {showStoreHeader && (
                        <View style={{
                          marginTop: 24,
                          marginBottom: 12,
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          backgroundColor: `${theme.primary}15`,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: `${theme.primary}30`,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                        }}>
                          <Text style={{ fontSize: 20 }}>🏪</Text>
                          <Text style={{
                            color: theme.primary,
                            fontWeight: '700',
                            fontSize: 16,
                            letterSpacing: 0.5,
                          }}>
                            Tienda de Temas
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => !isBasicSection && toggleSection(option.section)}
                        activeOpacity={isBasicSection ? 1 : 0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: isBasicSection ? 8 : 6,
                          marginBottom: 10,
                          paddingHorizontal: 14,
                          paddingVertical: isBasicSection ? 4 : 12,
                          backgroundColor: isBasicSection ? 'transparent' : `${theme.background}`,
                          borderRadius: isBasicSection ? 0 : 10,
                          borderWidth: isBasicSection ? 0 : 1,
                          borderColor: isBasicSection ? 'transparent' : theme.border,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {!isBasicSection && (
                            <Ionicons
                              name="pricetag"
                              size={16}
                              color={theme.textSecondary}
                            />
                          )}
                          <Text
                            style={{
                              color: isBasicSection ? theme.textSecondary : theme.text,
                              fontWeight: '700',
                              fontSize: isBasicSection ? 12 : 14,
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                            }}
                          >
                            {option.section}
                          </Text>
                        </View>
                        {!isBasicSection && (
                          <View style={{
                            backgroundColor: `${theme.primary}20`,
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}>
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={theme.primary}
                            />
                          </View>
                        )}
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                }

                // Determinar la sección actual para saber si mostrar o no
                const themeSection = (() => {
                  // Buscar la sección a la que pertenece este tema
                  for (let i = index - 1; i >= 0; i--) {
                    if (themeOptions[i].section) {
                      return themeOptions[i].section;
                    }
                  }
                  return 'Básicos';
                })();

                // Si la sección no está expandida y no es Básicos, no renderizar
                if (themeSection !== 'Básicos' && !expandedSections[themeSection]) {
                  return null;
                }

                // Determinar si está seleccionado comparando con currentThemeId
                // Mapeamos los modos básicos a sus IDs
                const modeToId = {
                  'auto': 'default_light',
                  'light': 'default_light',
                  'dark': 'default_dark',
                };
                const expectedId = modeToId[option.mode] || option.mode;
                const isSelected = currentThemeId === expectedId;

                // Datos del tier
                const tier = THEME_TIERS[option.mode];
                const tierColor = tier ? TIER_COLORS[tier] : null;
                const tierLabel = tier ? TIER_LABELS[tier] : null;
                const unlocked = isThemeUnlocked(option.mode);
                const price = getThemePrice(option.mode);
                const premiumPrice = tier ? TIER_PRICES[tier].premium : null;
                const freePrice = tier ? TIER_PRICES[tier].free : null;
                const savingsPercent = tier && !isPremiumUser ? Math.round(((freePrice - premiumPrice) / freePrice) * 100) : null;

                const handlePress = () => {
                  if (unlocked) {
                    handleThemeChange(option.mode);
                  } else {
                    setSelectedThemeToPurchase(option);
                    setShowPurchaseModal(true);
                  }
                };

                return (
                  <TouchableOpacity
                    key={option.mode}
                    style={[
                      styles.themeOption,
                      { borderBottomColor: theme.border },
                      // Colored borders and inset shadows for tiered themes
                      tier && {
                        borderLeftWidth: 4,
                        borderLeftColor: tierColor,
                        shadowColor: tierColor,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 2,
                      },
                      !unlocked && { opacity: 0.85 },
                    ]}
                    onPress={handlePress}
                    activeOpacity={0.7}
                  >
                    <View style={styles.themeOptionLeft}>
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: tier ? `${tierColor}20` : theme.iconButton },
                          tier && { borderWidth: 2, borderColor: tierColor },
                        ]}
                      >
                        {!unlocked && (
                          <View style={styles.lockOverlay}>
                            <Ionicons name="lock-closed" size={14} color="#fff" />
                          </View>
                        )}
                        <Ionicons
                          name={option.icon}
                          size={24}
                          color={isSelected ? theme.primary : (tier ? tierColor : theme.textSecondary)}
                        />
                      </View>
                      <View style={styles.themeOptionText}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.themeOptionTitle,
                              { color: theme.text },
                              isSelected && { color: theme.primary },
                            ]}
                          >
                            {option.title}
                          </Text>
                          {/* Tier Badge */}
                          {tierLabel && (
                            <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
                              <Text style={styles.tierBadgeText}>{tierLabel}</Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.themeOptionSubtitle,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {option.subtitle}
                        </Text>
                        {/* Price info for locked themes */}
                        {!unlocked && price && (
                          isPremiumUser ? (
                            // Premium users: just show their price
                            <View style={styles.priceRow}>
                              <Text style={styles.coinIcon}>🪙</Text>
                              <Text style={[styles.priceText, { color: tierColor }]}>
                                {price.toLocaleString()} pts
                              </Text>
                            </View>
                          ) : (
                            // Free users: show comparison FREE vs PREMIUM
                            <View style={styles.priceComparisonContainer}>
                              <View style={styles.priceComparisonColumn}>
                                <Text style={[styles.priceComparisonLabel, { color: theme.textSecondary }]}>FREE</Text>
                                <View style={styles.priceWithCoin}>
                                  <Text style={styles.coinIcon}>🪙</Text>
                                  <Text style={[styles.priceComparisonValue, { color: tierColor }]}>
                                    {freePrice.toLocaleString()}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.priceComparisonDivider} />
                              <View style={styles.priceComparisonColumn}>
                                <Text style={[styles.priceComparisonLabel, { color: '#a855f7' }]}>PREMIUM</Text>
                                <View style={styles.priceWithCoin}>
                                  <Text style={styles.coinIcon}>🪙</Text>
                                  <Text style={[styles.priceComparisonValue, { color: '#a855f7' }]}>
                                    {premiumPrice.toLocaleString()}
                                  </Text>
                                </View>
                              </View>
                              <View style={[styles.savingsBadge, { backgroundColor: `${tierColor}30` }]}>
                                <Text style={[styles.savingsText, { color: tierColor }]}>
                                  -{savingsPercent}%
                                </Text>
                              </View>
                            </View>
                          )
                        )}
                      </View>
                    </View>

                    {/* Radio button or lock icon */}
                    {unlocked ? (
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: isSelected ? theme.primary : (tier ? tierColor : theme.border) },
                        ]}
                      >
                        {isSelected && (
                          <View
                            style={[
                              styles.radioInner,
                              { backgroundColor: theme.primary },
                            ]}
                          />
                        )}
                      </View>
                    ) : (
                      <View style={[styles.buyButton, { backgroundColor: tierColor }]}>
                        <Text style={styles.buyButtonText}>🪙</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              });
            })()}

            {/* Coming Soon Placeholder */}
            <View style={styles.comingSoonContainer}>
              <Ionicons name="sparkles" size={24} color={theme.textSecondary} />
              <Text style={[styles.comingSoonText, { color: theme.textSecondary }]}>
                🎨 Próximamente más temas...
              </Text>
            </View>
          </View>
        </View>

        {/* Sección de Seguridad */}
        {user && !user.googleId && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { backgroundColor: theme.sectionHeader }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={theme.text} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Seguridad
              </Text>
            </View>

            <View style={[styles.sectionContent, { backgroundColor: theme.cardBackground }]}>
              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => setShowPasswordModal(true)}
                activeOpacity={0.7}
              >
                <View style={styles.settingItemLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: theme.iconButton }]}>
                    <Ionicons name="key-outline" size={20} color={theme.primary} />
                  </View>
                  <View>
                    <Text style={[styles.settingItemTitle, { color: theme.text }]}>
                      Cambiar Contraseña
                    </Text>
                    <Text style={[styles.settingItemSubtitle, { color: theme.textSecondary }]}>
                      Actualiza tu contraseña de acceso
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sección de Suscripción - Visible para usuarios con plan activo (premium/entrenador) */}
        {(subscriptionData || user?.tipoUsuario === 'PREMIUM' || user?.tipoUsuario === 'ENTRENADOR') && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { backgroundColor: theme.sectionHeader }]}>
              <Ionicons name="card-outline" size={20} color={theme.text} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Suscripción
              </Text>
            </View>

            <View style={[styles.sectionContent, { backgroundColor: theme.cardBackground }]}>
              {loadingSub ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[{ color: theme.textSecondary, marginTop: 8 }]}>Cargando...</Text>
                </View>
              ) : subscriptionData ? (
                <>
                  <View style={styles.subsInfoContainer}>
                    <Text style={[styles.subsInfoLabel, { color: theme.textSecondary }]}>
                      Plan Activo
                    </Text>
                    <Text style={[styles.subsInfoValue, { color: theme.text }]}>
                      {subscriptionData.plan || user?.tipoUsuario || 'Premium'}
                    </Text>
                  </View>

                  {subscriptionData.expiresAt && (
                    <>
                      <View style={[styles.subsInfoContainer, { borderTopWidth: 1, borderTopColor: theme.border }]}>
                        <Text style={[styles.subsInfoLabel, { color: theme.textSecondary }]}>
                          {subscriptionData.status === 'cancelled' ? 'Acceso hasta' : 'Próxima renovación'}
                        </Text>
                        <Text style={[styles.subsInfoValue, { color: theme.text }]}>
                          {new Date(subscriptionData.expiresAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={[styles.subsInfoContainer, { borderTopWidth: 1, borderTopColor: theme.border }]}>
                        <Text style={[styles.subsInfoLabel, { color: theme.textSecondary }]}>
                          Días restantes
                        </Text>
                        <Text style={[styles.subsInfoValue, { color: theme.text }]}>
                          {subscriptionData.daysRemaining || 0}
                        </Text>
                      </View>
                    </>
                  )}

                  {/* Botón Cancelar - Solo si la suscripción está activa */}
                  {subscriptionData.active && subscriptionData.status === 'active' && (
                    <TouchableOpacity
                      style={[styles.cancelButton, { backgroundColor: theme.dangerLight || '#FEE2E2', borderColor: theme.dangerBorder || '#FECACA' }]}
                      onPress={handleCancelSubscription}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle-outline" size={20} color={theme.danger || '#EF4444'} />
                      <Text style={[styles.cancelButtonText, { color: theme.danger || '#EF4444' }]}>
                        Cancelar Suscripción
                      </Text>
                    </TouchableOpacity>
                  )}

                  {subscriptionData.status === 'cancelled' && (
                    <View style={[styles.cancelledBanner, { backgroundColor: theme.warningLight || '#FEF3C7' }]}>
                      <Ionicons name="alert-circle-outline" size={20} color={theme.warning || '#F59E0B'} />
                      <Text style={[styles.cancelledText, { color: theme.warning || '#F59E0B' }]}>
                        Suscripción cancelada. Acceso hasta {new Date(subscriptionData.expiresAt).toLocaleDateString()}
                      </Text>
                    </View>
                  )}

                  {subscriptionData.status === 'expired' && (
                    <View style={[styles.cancelledBanner, { backgroundColor: theme.dangerLight || '#FEE2E2' }]}>
                      <Ionicons name="alert-circle-outline" size={20} color={theme.danger || '#EF4444'} />
                      <Text style={[styles.cancelledText, { color: theme.danger || '#EF4444' }]}>
                        Suscripción expirada. Renueva para mantener el acceso.
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Ionicons name="card-outline" size={32} color={theme.textSecondary} />
                  <Text style={[{ color: theme.textSecondary, marginTop: 8, textAlign: 'center' }]}>
                    No tienes una suscripción activa
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}



        {/* Sección de Datos */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { backgroundColor: theme.sectionHeader }]}>
            <Ionicons name="download-outline" size={20} color={theme.text} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Mis Datos
            </Text>
          </View>

          <View style={[styles.sectionContent, { backgroundColor: theme.cardBackground }]}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleExportData}
              activeOpacity={0.7}
              disabled={exportingData}
            >
              <View style={styles.settingItemLeft}>
                <View style={[styles.iconCircle, { backgroundColor: theme.iconButton }]}>
                  {exportingData ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={20} color={theme.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingItemTitle, { color: theme.text }]}>
                    Exportar Datos
                  </Text>
                  <Text style={[styles.settingItemSubtitle, { color: theme.textSecondary }]}>
                    Descarga todos tus datos en formato JSON
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.exportDescription, { color: theme.textSecondary }]}>
              Incluye rutinas, entrenamientos, ejercicios y perfil (local + nube)
            </Text>

            {/* Botón de Guardar en la Nube - Solo para usuarios premium */}
            {isPremiumUser && (
              <>
                <View style={[styles.dividerLine, { backgroundColor: theme.border, marginVertical: 16 }]} />

                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={handleSyncToCloud}
                  activeOpacity={0.7}
                  disabled={syncingToCloud}
                >
                  <View style={styles.settingItemLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                      {syncingToCloud ? (
                        <ActivityIndicator size="small" color="#10B981" />
                      ) : (
                        <Ionicons name="cloud-upload-outline" size={20} color="#10B981" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingItemTitle, { color: theme.text }]}>
                        Guardar en la Nube
                      </Text>
                      <Text style={[styles.settingItemSubtitle, { color: theme.textSecondary }]}>
                        Sincroniza tus datos locales con el servidor
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>

                <Text style={[styles.exportDescription, { color: theme.textSecondary }]}>
                  Sube entrenamientos y progreso al servidor para no perderlos
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Sección de Información */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { backgroundColor: theme.sectionHeader }]}>
            <Ionicons name="information-circle-outline" size={20} color={theme.text} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Información
            </Text>
          </View>

          <View style={[styles.sectionContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Versión de la app
              </Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                0.9.0
              </Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Tema activo
              </Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {themeOptions.find((opt) => opt.mode === themeMode)?.title}
              </Text>
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            SECCIÓN DE CUENTA - Eliminar Cuenta (Apple Guideline 5.1.1(v))
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { backgroundColor: theme.sectionHeader }]}>
            <Ionicons name="person-outline" size={20} color={theme.text} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Cuenta
            </Text>
          </View>

          <View style={[styles.sectionContent, { backgroundColor: theme.cardBackground }]}>
            {/* Entrenador Actual - Solo si tiene entrenador */}
            {user?.currentTrainerId && (
              <>
                <View style={styles.trainerInfoContainer}>
                  <View style={styles.settingItemLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight || 'rgba(59, 130, 246, 0.15)' }]}>
                      <Ionicons name="person-circle-outline" size={20} color={theme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingItemTitle, { color: theme.text }]}>
                        Entrenado por
                      </Text>
                      <Text style={[styles.settingItemSubtitle, { color: theme.primary, fontWeight: '600' }]}>
                        {user?.trainerName || 'Tu Entrenador'}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.leaveTrainerButton, {
                    backgroundColor: theme.warningLight || '#FEF3C7',
                    borderColor: theme.warningBorder || '#FCD34D'
                  }]}
                  onPress={() => setShowLeaveTrainerModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.deleteAccountButtonContent}>
                    <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                      <Ionicons name="exit-outline" size={20} color={theme.warning || '#F59E0B'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.deleteAccountTitle, { color: theme.warning || '#F59E0B' }]}>
                        Dejar Entrenador
                      </Text>
                      <Text style={[styles.deleteAccountSubtitle, { color: theme.textSecondary }]}>
                        Desvincularte y pasar a usuario gratuito
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.warning || '#F59E0B'} />
                  </View>
                </TouchableOpacity>

                <View style={{ height: 12 }} />
              </>
            )}


            <TouchableOpacity
              style={[styles.deleteAccountButton, {
                backgroundColor: theme.dangerLight || '#FEE2E2',
                borderColor: theme.dangerBorder || '#FECACA'
              }]}
              onPress={() => setShowDeleteAccountModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.deleteAccountButtonContent}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Ionicons name="trash-outline" size={20} color={theme.danger || '#EF4444'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.deleteAccountTitle, { color: theme.danger || '#EF4444' }]}>
                    Eliminar Cuenta
                  </Text>
                  <Text style={[styles.deleteAccountSubtitle, { color: theme.textSecondary }]}>
                    Borra permanentemente tu cuenta y todos tus datos
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.danger || '#EF4444'} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Espacio final */}
        <View style={{ height: 40 }} />
      </ScrollView>



      {/* Modal Cambiar Contraseña */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Cambiar Contraseña</Text>
            <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
              Introduce tu contraseña actual y la nueva contraseña
            </Text>

            {/* Contraseña Actual */}
            <View style={[styles.passwordInputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.passwordInput, { color: theme.text }]}
                placeholder="Contraseña actual"
                placeholderTextColor={theme.textSecondary}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                editable={!changingPassword}
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                <Ionicons
                  name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Nueva Contraseña */}
            <View style={[styles.passwordInputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons name="key-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.passwordInput, { color: theme.text }]}
                placeholder="Nueva contraseña (mín. 8 caracteres)"
                placeholderTextColor={theme.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                editable={!changingPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                <Ionicons
                  name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Confirmar Contraseña */}
            <View style={[styles.passwordInputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.passwordInput, { color: theme.text }]}
                placeholder="Confirmar nueva contraseña"
                placeholderTextColor={theme.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!changingPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: theme.border }]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={changingPassword}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                    Cambiar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Cancelar Suscripción */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.cancelModalIconContainer}>
              <Ionicons name="warning-outline" size={48} color={theme.danger || '#EF4444'} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Cancelar Suscripción
            </Text>

            <Text style={[styles.modalDescription, { color: theme.textSecondary, textAlign: 'center' }]}>
              ¿Estás seguro de que deseas cancelar tu suscripción?{'\n\n'}
              IMPORTANTE: Mantendrás tu estatus PREMIUM y todos los beneficios hasta el final de tu periodo actual. No se te volverá a cobrar.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: theme.border }]}
                onPress={() => setShowCancelModal(false)}
                disabled={cancellingSubscription}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>
                  No, mantener
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  { backgroundColor: theme.danger || '#EF4444' },
                ]}
                onPress={confirmCancelSubscription}
                disabled={cancellingSubscription}
              >
                {cancellingSubscription ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                    Sí, cancelar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Comprar Tema */}
      <Modal
        visible={showPurchaseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPurchaseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            {selectedThemeToPurchase && (() => {
              const tier = THEME_TIERS[selectedThemeToPurchase.mode];
              const tierColor = tier ? TIER_COLORS[tier] : theme.primary;
              const tierLabel = tier ? TIER_LABELS[tier] : '';
              const price = getThemePrice(selectedThemeToPurchase.mode);
              const canAfford = userPoints >= price;

              return (
                <>
                  {/* Icon Container */}
                  <View style={[styles.purchaseModalIconContainer, { backgroundColor: `${tierColor}20`, borderColor: tierColor }]}>
                    <Ionicons name={selectedThemeToPurchase.icon} size={48} color={tierColor} />
                  </View>

                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {selectedThemeToPurchase.title}
                  </Text>

                  {/* Tier Badge */}
                  {tierLabel && (
                    <View style={[styles.purchaseTierBadge, { backgroundColor: tierColor }]}>
                      <Text style={styles.tierBadgeText}>{tierLabel}</Text>
                    </View>
                  )}

                  <Text style={[styles.modalDescription, { color: theme.textSecondary, textAlign: 'center' }]}>
                    {selectedThemeToPurchase.subtitle}
                  </Text>

                  {/* Price */}
                  <View style={styles.purchasePriceContainer}>
                    <Text style={styles.purchaseCoinIcon}>🪙</Text>
                    <Text style={[styles.purchasePrice, { color: tierColor }]}>
                      {price?.toLocaleString()}
                    </Text>
                    <Text style={[styles.purchasePtsLabel, { color: theme.textSecondary }]}>pts</Text>
                  </View>

                  {/* Current Balance */}
                  <View style={[styles.balanceContainer, { backgroundColor: theme.backgroundSecondary || theme.background }]}>
                    <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>Tu saldo:</Text>
                    <Text style={[styles.balanceValue, { color: canAfford ? theme.success || '#22c55e' : theme.danger || '#ef4444' }]}>
                      🪙 {userPoints?.toLocaleString()} pts
                    </Text>
                  </View>

                  {!canAfford && (
                    <View style={styles.notEnoughContainer}>
                      <Ionicons name="warning" size={16} color={theme.danger || '#ef4444'} />
                      <Text style={[styles.notEnoughText, { color: theme.danger || '#ef4444' }]}>
                        ¡Necesitas {(price - userPoints).toLocaleString()} puntos más!
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonCancel, { borderColor: theme.border }]}
                      onPress={() => {
                        setShowPurchaseModal(false);
                        setSelectedThemeToPurchase(null);
                      }}
                      disabled={purchasing}
                    >
                      <Text style={[styles.modalButtonText, { color: theme.text }]}>
                        Cancelar
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        styles.modalButtonPrimary,
                        { backgroundColor: canAfford ? tierColor : theme.textSecondary },
                      ]}
                      onPress={handlePurchaseTheme}
                      disabled={purchasing || !canAfford}
                    >
                      {purchasing ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                          {canAfford ? '¡Comprar!' : 'Sin fondos'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL ELIMINAR CUENTA (Apple Guideline 5.1.1(v))
      ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showDeleteAccountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteAccountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.cancelModalIconContainer}>
              <Ionicons name="warning-outline" size={48} color={theme.danger || '#EF4444'} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Eliminar Cuenta
            </Text>

            <Text style={[styles.modalDescription, { color: theme.textSecondary, textAlign: 'center' }]}>
              ¿Estás seguro de que deseas eliminar tu cuenta?{'\n\n'}
              <Text style={{ fontWeight: '700', color: theme.danger || '#EF4444' }}>
                ⚠️ Esta acción es IRREVERSIBLE
              </Text>
              {'\n\n'}
              Se eliminarán permanentemente:{'\n'}
              • Todos tus entrenamientos{'\n'}
              • Tus rutinas y progreso{'\n'}
              • Datos de seguimiento{'\n'}
              • Tu información personal
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: theme.border }]}
                onPress={() => setShowDeleteAccountModal(false)}
                disabled={deletingAccount}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  { backgroundColor: theme.danger || '#EF4444' },
                ]}
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                    Eliminar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL DESVINCULAR ENTRENADOR
      ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showLeaveTrainerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLeaveTrainerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.cancelModalIconContainer}>
              <Ionicons name="exit-outline" size={48} color={theme.warning || '#F59E0B'} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>
              ¿Dejar a tu entrenador?
            </Text>

            <Text style={[styles.modalDescription, { color: theme.textSecondary, textAlign: 'center' }]}>
              ¿Estás seguro de que deseas desvincularte de tu entrenador?{'\n\n'}
              <Text style={{ fontWeight: '700', color: theme.warning || '#F59E0B' }}>
                ⚠️ Perderás tu estado de CLIENTE
              </Text>
              {'\n\n'}
              Al confirmar:{'\n'}
              • Pasarás a ser usuario GRATUITO{'\n'}
              • Ya no verás las rutinas asignadas{'\n'}
              • Perderás acceso al chat con tu entrenador
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: theme.border }]}
                onPress={() => setShowLeaveTrainerModal(false)}
                disabled={leavingTrainer}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  { backgroundColor: theme.warning || '#F59E0B' },
                ]}
                onPress={handleLeaveTrainer}
                disabled={leavingTrainer}
              >
                {leavingTrainer ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                    Confirmar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔄 Modal de sincronización de datos */}

      <SyncProgressModal
        visible={syncModal.visible}
        direction={syncModal.direction}
        isComplete={syncModal.isComplete}
        itemsSynced={syncModal.itemsSynced}
        onDismiss={() => setSyncModal(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 60,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  section: {
    marginTop: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    marginTop: 8,
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionDescription: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    fontSize: 13,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  themeOptionLast: {
    borderBottomWidth: 0,
  },
  themeOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeOptionText: {
    flex: 1,
  },
  themeOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  themeOptionSubtitle: {
    fontSize: 13,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
  },
  modalButtonPrimary: {
    // backgroundColor set dynamically
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingItemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingItemSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  subsInfoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  subsInfoLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  subsInfoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelledText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputContainer: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  input: {
    height: 44,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnSolid: {
    // backgroundColor set inline
  },
  cancelModalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'center',
  },
  exportDescription: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    fontStyle: 'italic',
  },
  dividerLine: {
    height: 1,
    marginHorizontal: 16,
  },
  // ═══════════════════════════════════════════════════════════════
  // ESTILOS TIENDA DE TEMAS
  // ═══════════════════════════════════════════════════════════════
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lockOverlay: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  coinIcon: {
    fontSize: 12,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  savingsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  savingsText: {
    fontSize: 9,
    fontWeight: '600',
  },
  buyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyButtonText: {
    fontSize: 16,
  },
  comingSoonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  comingSoonText: {
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  // Purchase Modal styles
  purchaseModalIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  purchaseTierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
    alignSelf: 'center',
  },
  purchasePriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  purchaseCoinIcon: {
    fontSize: 28,
  },
  purchasePrice: {
    fontSize: 32,
    fontWeight: '900',
  },
  purchasePtsLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  notEnoughContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  notEnoughText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Points display in header
  headerPointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  headerCoinIcon: {
    fontSize: 14,
  },
  headerPointsText: {
    fontSize: 14,
    fontWeight: '800',
  },
  // Price comparison for free users
  priceComparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingVertical: 4,
  },
  priceComparisonColumn: {
    alignItems: 'center',
  },
  priceComparisonLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  priceComparisonValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  priceComparisonDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(128,128,128,0.3)',
  },
  priceWithCoin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // ESTILOS PARA ELIMINAR CUENTA (Apple Guideline 5.1.1(v))
  // ═══════════════════════════════════════════════════════════════════════════
  deleteAccountButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteAccountButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteAccountTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccountSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  // Estilos para desvincular entrenador
  trainerInfoContainer: {
    padding: 12,
    marginBottom: 8,
  },
  leaveTrainerButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
});