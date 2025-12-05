import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      
      {/* Logo */}
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Botón principal */}
      <TouchableOpacity style={styles.mainButton}>
        <Text style={styles.mainButtonText}>EMPEZAR ENTRENO</Text>
      </TouchableOpacity>

      {/* Botones secundarios */}
      <View style={styles.secondaryButtons}>
        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>CREAR RUTINA</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>PERFIL</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 80,
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 40,
  },
  mainButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginBottom: 30,
    width: '80%',
    alignItems: 'center',
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  secondaryButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    gap: 20,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#94a3b8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
