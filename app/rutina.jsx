import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams } from 'expo-router';

const MUSCULOS = [
  'BICEPS',
  'CUADRICEPS',
  'DELTOIDES',
  'ESPALDA',
  'FEMORAL',
  'GEMELOS',
  'GLUTEO',
  'PECTORAL',
  'TRICEPS',
  'OTROS',
];

export default function CrearRutina() {
  const [musculo, setMusculo] = useState('');
  const [nombreEjercicio, setNombreEjercicio] = useState('');
  const [numeroSeries, setNumeroSeries] = useState('');
const { id, dias } = useLocalSearchParams();   // ← ahora llega, ej. "2"
const diasTotales = Number(dias) > 0 ? Number(dias) : 1;

  const handleGuardar = () => {
    console.log({
      musculo,
      nombreEjercicio,
      numeroSeries,
    });
    // Aquí iría el guardado en Firebase o en el estado global
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Músculo</Text>
      
      <Picker
        selectedValue={musculo}
        onValueChange={(itemValue) => setMusculo(itemValue)}
        style={styles.picker}
      >
        <Picker.Item label="Selecciona un músculo..." value="" />
        {MUSCULOS.map((m) => (
          <Picker.Item key={m} label={m} value={m} />
        ))}
      </Picker>

      <Text style={styles.label}>Nombre del ejercicio</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Sentadilla con barra"
        value={nombreEjercicio}
        onChangeText={setNombreEjercicio}
      />

      <Text style={styles.label}>Número de series</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 4"
        keyboardType="numeric"
        value={numeroSeries}
        onChangeText={setNumeroSeries}
      />

      <Button title="Guardar ejercicio" onPress={handleGuardar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 15 },
  label: { fontWeight: 'bold', fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    borderRadius: 8,
  },
});
