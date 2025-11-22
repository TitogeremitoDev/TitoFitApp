/* app/ajustes.jsx
   ────────────────────────────────────────────────────────────────────────
   Pantalla de Ajustes - Configuración de la aplicación
   Incluye selección de tema (Automático, Modo Día, Modo Noche)
   ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';

export default function AjustesScreen() {
  const router = useRouter();
  const { theme, themeMode, setThemeMode } = useTheme();

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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >


        {/* Sección de Apariencia */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, {marginTop: 30, backgroundColor: theme.sectionHeader }]}>
            <Ionicons name="color-palette-outline" size={20} color={theme.text} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Apariencia
            </Text>
          </View>

          <View style={[styles.sectionContent, { backgroundColor: theme.cardBackground}]}>
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
});