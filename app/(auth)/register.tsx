// app/(auth)/register.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text, Alert, StyleSheet, ActivityIndicator } from 'react-native'; // 1. Importa ActivityIndicator
import { useAuth } from '../../context/AuthContext';
import { Link, useRouter } from 'expo-router';
import axios from 'axios';

export default function RegisterScreen() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { register } = useAuth();
  
  // --- 2. AÑADE ESTE ESTADO ---
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!nombre || !email || !username || !password) {
      Alert.alert('Error', 'Todos los campos son obligatorios');
      return;
    }

    // --- 3. MARCA COMO "ENVIANDO" ---
    setIsSubmitting(true); 

    try {
      await register(nombre, email, username, password);
      // El _layout se encargará de redirigir
    } catch (e) {
      let errorMessage = 'No se pudo registrar';
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
      <Text style={styles.title}>Crear Cuenta</Text>
      <TextInput style={styles.input} placeholder="Nombre Completo" value={nombre} onChangeText={setNombre} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Nombre de Usuario" value={username} onChangeText={setUsername} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
      
      {/* --- 5. MODIFICA EL BOTÓN --- */}
      {isSubmitting ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button 
          title="Registrarse" 
          onPress={handleRegister} 
          disabled={isSubmitting} // Deshabilitado
        />
      )}
      
      <Link href="/login" style={styles.link}>
        <Text>¿Ya tienes cuenta? Inicia sesión</Text>
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