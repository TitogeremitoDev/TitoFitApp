import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

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
  const { theme } = useTheme();
  const [musculo, setMusculo] = useState('');
  const [nombreEjercicio, setNombreEjercicio] = useState('');
  const [numeroSeries, setNumeroSeries] = useState('');
  const { id, dias } = useLocalSearchParams();
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.label, { color: theme.text }]}>Músculo</Text>
     
      <Picker
        selectedValue={musculo}
        onValueChange={(itemValue) => setMusculo(itemValue)}
        style={[styles.picker, { 
          borderColor: theme.inputBorder,
          backgroundColor: theme.inputBackground,
          color: theme.inputText
        }]}
      >
        <Picker.Item label="Selecciona un músculo..." value="" color={theme.placeholder} />
        {MUSCULOS.map((m) => (
          <Picker.Item key={m} label={m} value={m} color={theme.text} />
        ))}
      </Picker>

      <Text style={[styles.label, { color: theme.text }]}>Nombre del ejercicio</Text>
      <TextInput
        style={[styles.input, {
          borderColor: theme.inputBorder,
          backgroundColor: theme.inputBackground,
          color: theme.inputText
        }]}
        placeholder="Ej: Sentadilla con barra"
        placeholderTextColor={theme.placeholder}
        value={nombreEjercicio}
        onChangeText={setNombreEjercicio}
      />

      <Text style={[styles.label, { color: theme.text }]}>Número de series</Text>
      <TextInput
        style={[styles.input, {
          borderColor: theme.inputBorder,
          backgroundColor: theme.inputBackground,
          color: theme.inputText
        }]}
        placeholder="Ej: 4"
        placeholderTextColor={theme.placeholder}
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
    padding: 10,
    borderRadius: 8,
  },
  picker: {
    borderWidth: 1,
    borderRadius: 8,
  },
});