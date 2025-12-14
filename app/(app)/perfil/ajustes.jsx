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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function AjustesScreen() {
  const router = useRouter();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { user } = useAuth();

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

  const themeOptions = [
    {
      mode: 'auto',
      title: 'Automático',
      subtitle: 'Sigue el tema del sistema',
      icon: 'phone-portrait-outline',
    },
    {
      mode: 'light',
      title: 'Modo Día',
      subtitle: 'Tema claro siempre',
      icon: 'sunny-outline',
    },
    {
      mode: 'dark',
      title: 'Modo Noche',
      subtitle: 'Tema oscuro siempre',
      icon: 'moon-outline',
    },
  ];

  const handleThemeChange = async (mode) => {
    await setThemeMode(mode);
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
            <Ionicons name="color-palette-outline" size={20} color={theme.text} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Apariencia
            </Text>
          </View>

          <View style={[styles.sectionContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
              Personaliza cómo se ve la aplicación
            </Text>

            {/* Opciones de Tema */}
            {themeOptions.map((option, index) => {
              const isSelected = themeMode === option.mode;
              const isLast = index === themeOptions.length - 1;

              return (
                <TouchableOpacity
                  key={option.mode}
                  style={[
                    styles.themeOption,
                    { borderBottomColor: theme.border },
                    isLast && styles.themeOptionLast,
                  ]}
                  onPress={() => handleThemeChange(option.mode)}
                  activeOpacity={0.7}
                >
                  <View style={styles.themeOptionLeft}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: theme.iconButton },
                      ]}
                    >
                      <Ionicons
                        name={option.icon}
                        size={24}
                        color={isSelected ? theme.primary : theme.textSecondary}
                      />
                    </View>
                    <View style={styles.themeOptionText}>
                      <Text
                        style={[
                          styles.themeOptionTitle,
                          { color: theme.text },
                          isSelected && { color: theme.primary },
                        ]}
                      >
                        {option.title}
                      </Text>
                      <Text
                        style={[
                          styles.themeOptionSubtitle,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {option.subtitle}
                      </Text>
                    </View>
                  </View>

                  {/* Radio button */}
                  <View
                    style={[
                      styles.radioOuter,
                      { borderColor: isSelected ? theme.primary : theme.border },
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
                </TouchableOpacity>
              );
            })}
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

        {/* Sección de Suscripción - Visible para usuarios con plan activo o premium */}
        {(subscriptionData || user?.tipoUsuario === 'PREMIUM' || user?.tipoUsuario === 'CLIENTE') && (
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
});