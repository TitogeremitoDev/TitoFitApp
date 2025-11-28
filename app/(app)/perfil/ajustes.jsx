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

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function AjustesScreen() {
  const router = useRouter();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { user, upgradeByCode } = useAuth();

  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  // Estados para cambio de contraseña
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  // Cancelar suscripción
  const handleCancelSubscription = async () => {
    Alert.alert(
      'Cancelar Suscripción',
      '¿Estás seguro de que deseas cancelar tu suscripción? Mantendrás el acceso hasta la fecha de expiración, pero no se renovará automáticamente.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
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
                Alert.alert('Cancelada', 'Tu suscripción ha sido cancelada.');
                loadSubscriptionStatus(); // Recargar estado
              } else {
                Alert.alert('Error', data.message || 'No se pudo cancelar la suscripción.');
              }
            } catch (error) {
              console.error('[Ajustes] Error cancelando suscripción:', error);
              Alert.alert('Error', 'No se pudo cancelar la suscripción.');
            }
          }
        }
      ]
    );
  };

  // Canjear código
  const handleRedeem = async () => {
    if (!redeemCode.trim()) {
      Alert.alert('Código vacío', 'Introduce tu código de cliente.');
      return;
    }
    setRedeeming(true);
    try {
      const updated = await upgradeByCode(redeemCode.trim());
      setShowRedeemModal(false);
      setRedeemCode('');
      Alert.alert('Hecho', `Tu cuenta ahora es: ${updated.tipoUsuario}`);
      loadSubscriptionStatus();
    } catch (e) {
      const msg = (e?.response?.data?.message) || e?.message || 'No se pudo canjear el código';
      Alert.alert('Error', String(msg));
    } finally {
      setRedeeming(false);
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

        {/* Sección de Suscripción */}
        {subscriptionData?.active && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { backgroundColor: theme.sectionHeader }]}>
              <Ionicons name="card-outline" size={20} color={theme.text} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Suscripción
              </Text>
            </View>

            <View style={[styles.sectionContent, { backgroundColor: theme.cardBackground }]}>
              <View style={styles.subsInfoContainer}>
                <Text style={[styles.subsInfoLabel, { color: theme.textSecondary }]}>
                  Plan Activo
                </Text>
                <Text style={[styles.subsInfoValue, { color: theme.text }]}>
                  {subscriptionData.plan}
                </Text>
              </View>

              {subscriptionData.expiresAt && (
                <>
                  <View style={[styles.subsInfoContainer, { borderTopWidth: 1, borderTopColor: theme.border }]}>
                    <Text style={[styles.subsInfoLabel, { color: theme.textSecondary }]}>
                      Próxima renovación
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
                      {subscriptionData.daysRemaining}
                    </Text>
                  </View>
                </>
              )}

              {subscriptionData.status === 'active' && (
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: theme.dangerLight, borderColor: theme.dangerBorder }]}
                  onPress={handleCancelSubscription}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle-outline" size={20} color={theme.danger} />
                  <Text style={[styles.cancelButtonText, { color: theme.danger }]}>
                    Cancelar Suscripción
                  </Text>
                </TouchableOpacity>
              )}

              {subscriptionData.status === 'cancelled' && (
                <View style={[styles.cancelledBanner, { backgroundColor: theme.warningLight }]}>
                  <Ionicons name="alert-circle-outline" size={20} color={theme.warning} />
                  <Text style={[styles.cancelledText, { color: theme.warning }]}>
                    Suscripción cancelada. Acceso hasta {new Date(subscriptionData.expiresAt).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Sección de Canje de Código (Siempre visible o solo si no es premium?) */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { backgroundColor: theme.sectionHeader }]}>
            <Ionicons name="key-outline" size={20} color={theme.text} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Código Promocional
            </Text>
          </View>
          <View style={[styles.sectionContent, { backgroundColor: theme.cardBackground }]}>
            <TouchableOpacity
              style={[styles.themeOption, { borderBottomWidth: 0 }]}
              onPress={() => setShowRedeemModal(true)}
            >
              <Text style={{ color: theme.text }}>Canjear código de cliente</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
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
                0.8.0
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

      {/* Modal Canjear Código */}
      <Modal
        visible={showRedeemModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRedeemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Canjear Código</Text>
            <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
              Introduce tu código de cliente para actualizar tu cuenta
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Código de cliente"
              placeholderTextColor={theme.textSecondary}
              value={redeemCode}
              onChangeText={setRedeemCode}
              autoCapitalize="characters"
              editable={!redeeming}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: theme.border }]}
                onPress={() => {
                  setShowRedeemModal(false);
                  setRedeemCode('');
                }}
                disabled={redeeming}
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
                onPress={handleRedeem}
                disabled={redeeming}
              >
                {redeeming ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                    Canjear
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    paddingTop: 12,
    paddingBottom: 8,
    fontSize: 13,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    paddingVertical: 12,
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
    paddingVertical: 14,
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
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
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
});