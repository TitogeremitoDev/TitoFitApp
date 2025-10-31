// app/(auth)/login.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text, Alert, StyleSheet, ActivityIndicator } from 'react-native'; // 1. Importa ActivityIndicator
import { useAuth } from '../../context/AuthContext'; // Ajusta la ruta si es necesario
import { Link } from 'expo-router';
import axios from 'axios';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
export default function LoginScreen() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  
  // --- 2. AÑADE ESTE ESTADO ---
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    // Validación simple para no enviar peticiones vacías
    if (!emailOrUsername || !password) {
        Alert.alert('Error', 'Por favor, introduce tu email/usuario y contraseña');
        return;
    }

    // --- 3. MARCA COMO "ENVIANDO" ---
    setIsSubmitting(true);

    try {
      await login(emailOrUsername, password);
      // El _layout raíz se encargará de la redirección
    } catch (e) {
      let errorMessage = 'No se pudo iniciar sesión';
      if (axios.isAxiosError(e) && e.response?.data?.message) {
        errorMessage = e.response.data.message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      // --- 4. VUELVE A ACTIVAR EL BOTÓN (PASE LO QUE PASE) ---
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar Sesión</Text>
      <TextInput
        style={styles.input}
        placeholder="Email o Nombre de Usuario"
        value={emailOrUsername}
        onChangeText={setEmailOrUsername}
        autoCapitalize="none"
        editable={!isSubmitting} // Opcional: deshabilita inputs mientras carga
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isSubmitting} // Opcional: deshabilita inputs mientras carga
      />
      
      {/* --- 5. MODIFICA EL BOTÓN --- */}
      {isSubmitting ? (
        <ActivityIndicator size="large" color="#0000ff" style={{ marginVertical: 10 }} />
      ) : (
        <Button 
          title="Entrar" 
          onPress={handleLogin} 
          disabled={isSubmitting} // Deshabilita el botón
        />
      )}
      
      <Link href="/register" style={styles.link}>
        <Text>¿No tienes cuenta? Regístrate aquí</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  title: { fontSize: 24, marginBottom: 16, textAlign: 'center' },
  input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 12, padding: 10 },
  link: { marginTop: 16, textAlign: 'center', color: 'blue' },
});