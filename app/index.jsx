import { View, Text, StyleSheet, Image } from 'react-native';
import { Link } from 'expo-router';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Image source={require('../assets/logo.png')} style={styles.logo} />

      {/* Placeholder: más adelante definiremos a dónde va */}
      <Link href="/entreno" asChild>
        <Text style={styles.mainBtn}>EMPEZAR ENTRENO</Text>
      </Link>

      {/* Ahora apunta a /rutinas */}
      <Link href="/rutinas" asChild>
        <Text style={styles.secBtn}>CREAR RUTINA</Text>
      </Link>

      <Link href="/perfil" asChild>
        <Text style={styles.secBtn}>PERFIL</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
  logo: { width: 160, height: 160, marginBottom: 40 },
  mainBtn: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 10,
    overflow: 'hidden',
    fontWeight: 'bold',
  },
  secBtn: {
    backgroundColor: '#94a3b8',
    color: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    overflow: 'hidden',
    fontWeight: '600',
  },
});
