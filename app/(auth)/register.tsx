// app/(auth)/register.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator,
  Alert, Platform, KeyboardAvoidingView, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).toLowerCase());
}

type UStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Username availability
  const [uStatus, setUStatus] = useState<UStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Comprueba disponibilidad con debounce
  useEffect(() => {
    const u = username.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!u || u.length < 3) { setUStatus('idle'); return; }

    setUStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await axios.get<{ available: boolean }>(`/users/check-username`, {
          params: { username: u },
        });
        setUStatus(data.available ? 'available' : 'taken');
      } catch {
        setUStatus('error');
      }
    }, 450);
  }, [username]);

  const emailOk = useMemo(() => isValidEmail(email), [email]);
  const passOk = useMemo(() => password.length >= 8, [password]);
  const userOk = useMemo(() => uStatus === 'available' || (username.trim().length >= 3 && uStatus === 'idle'), [uStatus, username]);

  const canSubmit = useMemo(
    () => nombre.trim() && emailOk && userOk && passOk && !isSubmitting && uStatus !== 'checking',
    [nombre, emailOk, userOk, passOk, isSubmitting, uStatus]
  );

  const handleRegister = async () => {
    if (!canSubmit) {
      Alert.alert('Revisa los datos', 'Comprueba email, usuario disponible y contraseña (mínimo 8).');
      return;
    }
    setIsSubmitting(true);
    try {
      await register(nombre.trim(), email.trim().toLowerCase(), username.trim(), password);
      // ✅ Registro exitoso - redirigir al onboarding para completar perfil
      router.replace('/onboarding');
    } catch (e) {
      let msg = 'No se pudo registrar';
      if (axios.isAxiosError(e) && e.response?.data?.message) msg = e.response.data.message;
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hintColor = (ok: boolean) => (ok ? '#10B981' : '#F59E0B');

  return (
    <LinearGradient colors={['#0B1220', '#0D1B2A', '#111827']} style={styles.bg}>
      <KeyboardAvoidingView style={{ flex: 1, width: '100%' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          {/* Marca */}
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>TotalGains</Text>
            <Text style={styles.subtitle}>Crea tu cuenta y empieza hoy.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Crear cuenta</Text>

            {/* Nombre */}
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nombre completo"
                placeholderTextColor="#6B7280"
                value={nombre}
                onChangeText={setNombre}
                editable={!isSubmitting}
              />
            </View>

            {/* Email (solo emails válidos) */}
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
            <Text style={[styles.hint, { color: hintColor(emailOk) }]}>
              {email.length === 0 ? 'Introduce tu email' : emailOk ? 'Email válido' : 'Formato de email inválido'}
            </Text>

            {/* Username (disponible/ocupado en vivo) */}
            <View style={styles.inputWrap}>
              <Ionicons name="at-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Usuario (mín. 3)"
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                editable={!isSubmitting}
              />
              <View style={{ paddingLeft: 6 }}>
                {uStatus === 'checking' && <ActivityIndicator size="small" />}
                {uStatus === 'available' && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
                {uStatus === 'taken' && <Ionicons name="close-circle" size={18} color="#EF4444" />}
                {uStatus === 'error' && <Ionicons name="warning-outline" size={18} color="#F59E0B" />}
              </View>
            </View>
            <Text style={[styles.hint, { color: uStatus === 'taken' ? '#EF4444' : '#9CA3AF' }]}>
              {username.trim().length < 3
                ? 'Mínimo 3 caracteres'
                : uStatus === 'available'
                  ? 'Nombre de usuario disponible'
                  : uStatus === 'taken'
                    ? 'Usuario ocupado'
                    : uStatus === 'checking'
                      ? 'Comprobando...'
                      : 'Introduce un nombre de usuario'}
            </Text>

            {/* Password (mínimo 8) */}
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Contraseña (mín. 8)"
                placeholderTextColor="#6B7280"
                secureTextEntry={secure}
                value={password}
                onChangeText={setPassword}
                editable={!isSubmitting}
              />
              <Pressable onPress={() => setSecure(s => !s)} style={styles.eyeBtn}>
                <Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: hintColor(passOk) }]}>
              {password.length === 0 ? 'Introduce tu contraseña' : passOk ? 'Contraseña válida' : 'Mínimo 8 caracteres'}
            </Text>

            {/* Botón registro */}
            <Pressable
              onPress={handleRegister}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.9 },
                (!canSubmit || isSubmitting) && { opacity: 0.6 },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text style={styles.primaryTxt}>Crear cuenta</Text>
                </>
              )}
            </Pressable>

            {/* Divider sociales (placeholders) */}


            {/* Link login */}
            <View style={styles.bottomRow}>
              <Text style={{ color: '#9CA3AF' }}>¿Ya tienes cuenta? </Text>
              <Link href="/login">
                <Text style={styles.link}>Inicia sesión</Text>
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
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  brandWrap: { alignItems: 'center', marginBottom: 16 },
  brand: { color: '#F9FAFB', fontSize: 28, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { color: '#9CA3AF', marginTop: 4, fontSize: 13 },
  card: {
    width: '100%', maxWidth: 520, padding: 18, borderRadius: 16,
    backgroundColor: 'rgba(17,24,39,0.65)', borderWidth: 1, borderColor: '#1F2937'
  },
  cardTitle: { color: '#E5E7EB', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#374151', borderRadius: 10,
    backgroundColor: '#0B1220', marginBottom: 8, paddingHorizontal: 10, height: 46,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, color: '#E5E7EB' },
  eyeBtn: { padding: 6, marginLeft: 4 },
  hint: { fontSize: 12, marginBottom: 6, color: '#9CA3AF' },
  primaryBtn: {
    height: 48, borderRadius: 12, backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 6
  },
  primaryTxt: { color: '#fff', fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  divider: { flex: 1, height: 1, backgroundColor: '#1F2937' },
  dividerTxt: { color: '#6B7280', marginHorizontal: 8, fontSize: 12 },
  socialRow: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginBottom: 4 },
  socialBtn: {
    flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#374151',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8
  },
  socialTxt: { fontWeight: '700' },
  google: { backgroundColor: '#FCD34D' },
  apple: { backgroundColor: '#D1D5DB' },
  facebook: { backgroundColor: '#93C5FD' },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  link: { color: '#60A5FA', fontWeight: '700' },
});
