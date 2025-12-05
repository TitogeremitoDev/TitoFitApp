import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Simple Slider Component
const SimpleSlider = ({ value, onValueChange, min, max, labels }: any) => {
    const { theme } = useTheme();
    return (
        <View style={styles.sliderContainer}>
            <View style={styles.sliderControls}>
                <TouchableOpacity
                    onPress={() => onValueChange(Math.max(min, value - 1))}
                    style={[styles.sliderBtn, { backgroundColor: theme.cardBackground }]}
                >
                    <Ionicons name="remove" size={20} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.sliderValueContainer}>
                    <Text style={[styles.sliderValue, { color: theme.primary }]}>{value}</Text>
                    {labels && <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>{labels[value - min]}</Text>}
                </View>
                <TouchableOpacity
                    onPress={() => onValueChange(Math.min(max, value + 1))}
                    style={[styles.sliderBtn, { backgroundColor: theme.cardBackground }]}
                >
                    <Ionicons name="add" size={20} color={theme.text} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default function Onboarding() {
    const router = useRouter();
    const { theme } = useTheme();
    const { refreshUser } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        edad: '',
        peso: '',
        altura: '',
        genero: '',
        objetivos: '',
        experiencia: 2,
        compromiso: 'medio',
        conocimientoTecnico: 3,
        tipoEntreno: '',
        cardio: '',
        dieta: '',
        comidasDia: 4,
        ejerciciosFavoritos: '',
        ejerciciosEvitados: '',
        lesiones: '',
        alergias: '',
        cocina: 'si',
    });

    const totalSteps = 7;

    const handleNext = () => {
        if (currentStep === 1) {
            if (!formData.edad || !formData.peso || !formData.altura || !formData.objetivos || !formData.genero) {
                Alert.alert('Campos requeridos', 'Por favor completa todos los campos');
                return;
            }
        }
        setCurrentStep(currentStep + 1);
    };

    const handleBack = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1);
    };

    const handleFinish = async () => {
        setLoading(true);
        try {
            const info_user = {
                edad: parseInt(formData.edad) || 0,
                peso: parseFloat(formData.peso.replace(',', '.')) || 0,
                altura: parseFloat(formData.altura.replace(',', '.')) || 0,
                genero: formData.genero,
                objetivos: formData.objetivos,
                compromiso: formData.compromiso,
                experiencia: formData.experiencia,
                conocimientoTecnico: formData.conocimientoTecnico,
                tipoEntreno: formData.tipoEntreno,
                lesiones: formData.lesiones || 'Ninguna',
                ejerciciosFavoritos: formData.ejerciciosFavoritos,
                ejerciciosEvitados: formData.ejerciciosEvitados,
                cardio: formData.cardio,
                dieta: formData.dieta,
                comidasDia: formData.comidasDia,
                alergias: formData.alergias,
                cocina: formData.cocina,
            };

            await axios.put('/users/info', { info_user });
            await refreshUser();
            await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
            router.replace('/home');
        } catch (error) {
            console.error('Error guardando datos:', error);
            Alert.alert('Error', 'No se pudieron guardar tus datos. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    // STEP 0: WELCOME
    if (currentStep === 0) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.welcomeContent}>
                        <Ionicons name="barbell" size={80} color={theme.primary} />
                        <Text style={[styles.welcomeTitle, { color: theme.text }]}>
                            Bienvenido a tu plataforma fitness entrenador–entrenado
                        </Text>
                        <Text style={[styles.welcomeSubtitle, { color: theme.textSecondary }]}>
                            Aquí vas a tener tus rutinas, progresos y comunicación con tu entrenador en un solo lugar.
                        </Text>

                        <View style={styles.benefitsList}>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                                <Text style={[styles.benefitText, { color: theme.text }]}>
                                    Centraliza tus entrenos y progresos
                                </Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                                <Text style={[styles.benefitText, { color: theme.text }]}>
                                    Conecta con tu entrenador en segundos
                                </Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                                <Text style={[styles.benefitText, { color: theme.text }]}>
                                    Ten siempre claro qué toca hacer hoy
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                            onPress={handleNext}
                        >
                            <Text style={styles.primaryButtonText}>Empezar en 30 segundos</Text>
                        </TouchableOpacity>

                        <Text style={[styles.helperText, { color: theme.textSecondary }]}>
                            Sin formularios eternos, solo lo básico para afinar tu plan 😉
                        </Text>
                    </View>
                </ScrollView>
            </View>
        );
    }

    // STEP 1: BASIC INFO
    if (currentStep === 1) {
        const objetivos = [
            'Perder grasa',
            'Ganar músculo',
            'Ponerme fit para verano',
            'Rendimiento deportivo',
            'Salud y bienestar',
        ];
        const generos = ['Hombre', 'Mujer', 'No quiero definirlo'];

        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[styles.header, { backgroundColor: theme.background }]}>
                    <Text style={[styles.progressText, { color: theme.textSecondary }]}>Paso 1 de 6</Text>
                </View>

                <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.screenTitle, { color: theme.text }]}>Vamos a ajustar la app a ti</Text>
                    <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>Solo 3 cosas rápidas</Text>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>Tu edad</Text>
                        <TextInput
                            style={[styles.numericInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                            placeholder="Ej: 25"
                            placeholderTextColor={theme.textSecondary}
                            keyboardType="numeric"
                            value={formData.edad}
                            onChangeText={(text) => setFormData({ ...formData, edad: text.replace(/[^0-9]/g, '') })}
                        />
                        <Text style={[styles.inputHint, { color: theme.textSecondary }]}>años</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>Tu peso</Text>
                        <TextInput
                            style={[styles.numericInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                            placeholder="Ej: 75.5"
                            placeholderTextColor={theme.textSecondary}
                            keyboardType="decimal-pad"
                            value={formData.peso}
                            onChangeText={(text) => setFormData({ ...formData, peso: text })}
                        />
                        <Text style={[styles.inputHint, { color: theme.textSecondary }]}>kg</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>Tu altura</Text>
                        <TextInput
                            style={[styles.numericInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                            placeholder="Ej: 1.75"
                            placeholderTextColor={theme.textSecondary}
                            keyboardType="decimal-pad"
                            value={formData.altura}
                            onChangeText={(text) => setFormData({ ...formData, altura: text.replace(/,/g, '.') })}
                        />
                        <Text style={[styles.inputHint, { color: theme.textSecondary }]}>metros</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>Tu género</Text>
                        <View style={styles.chipGrid}>
                            {generos.map((gen) => (
                                <TouchableOpacity
                                    key={gen}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.genero === gen ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.genero === gen ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, genero: gen })}
                                >
                                    <Text style={[styles.chipText, { color: formData.genero === gen ? theme.primary : theme.text }]}>
                                        {gen}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Qué quieres lograr?</Text>
                        <View style={styles.chipGrid}>
                            {objetivos.map((obj) => (
                                <TouchableOpacity
                                    key={obj}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.objetivos === obj ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.objetivos === obj ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, objetivos: obj })}
                                >
                                    <Text style={[styles.chipText, { color: formData.objetivos === obj ? theme.primary : theme.text }]}>
                                        {obj}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: theme.background }]}>
                    <TouchableOpacity style={[styles.footerButton, { borderColor: theme.border }]} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={20} color={theme.text} />
                        <Text style={[styles.footerButtonText, { color: theme.text }]}>Atrás</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: theme.primary }]}
                        onPress={handleNext}
                    >
                        <Text style={styles.primaryButtonText}>Siguiente</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // STEP 2: LEVEL & COMMITMENT
    if (currentStep === 2) {
        const experienciaOpts = [
            { label: 'Estoy empezando (0–1 años)', value: 0 },
            { label: 'Voy en serio (1–3 años)', value: 2 },
            { label: 'Llevo años dándole (3+ años)', value: 6 },
        ];
        const compromisoOpts = [
            { label: 'Tranquilo', value: 'bajo' },
            { label: 'Constante', value: 'medio' },
            { label: 'A tope', value: 'alto' },
        ];

        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[styles.header, { backgroundColor: theme.background }]}>
                    <Text style={[styles.progressText, { color: theme.textSecondary }]}>Paso 2 de 6</Text>
                </View>

                <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.screenTitle, { color: theme.text }]}>Tu nivel y compromiso</Text>
                    <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>Sin presión, solo para ajustarte mejor</Text>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Cuánto tiempo llevas entrenando?</Text>
                        <View style={styles.chipGrid}>
                            {experienciaOpts.map((opt) => (
                                <TouchableOpacity
                                    key={opt.value}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.experiencia === opt.value ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.experiencia === opt.value ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, experiencia: opt.value })}
                                >
                                    <Text style={[styles.chipText, { color: formData.experiencia === opt.value ? theme.primary : theme.text }]}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Cuánto te quieres comprometer ahora mismo?</Text>
                        <View style={styles.chipGrid}>
                            {compromisoOpts.map((opt) => (
                                <TouchableOpacity
                                    key={opt.value}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.compromiso === opt.value ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.compromiso === opt.value ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, compromiso: opt.value })}
                                >
                                    <Text style={[styles.chipText, { color: formData.compromiso === opt.value ? theme.primary : theme.text }]}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Qué tanto control tienes de ejercicios, técnica, etc.?</Text>
                        <SimpleSlider
                            value={formData.conocimientoTecnico}
                            onValueChange={(val: number) => setFormData({ ...formData, conocimientoTecnico: val })}
                            min={1}
                            max={5}
                            labels={['Casi cero', 'Básico', 'Me defiendo', 'Bueno', 'Nivel friki del gym']}
                        />
                    </View>
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: theme.background }]}>
                    <TouchableOpacity style={[styles.footerButton, { borderColor: theme.border }]} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={20} color={theme.text} />
                        <Text style={[styles.footerButtonText, { color: theme.text }]}>Atrás</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: theme.primary }]}
                        onPress={handleNext}
                    >
                        <Text style={styles.primaryButtonText}>Siguiente</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // STEP 3: STYLE, CARDIO, DIET
    if (currentStep === 3) {
        const tipoOpts = ['Hipertrofia', 'Fuerza', 'Pérdida de grasa', 'Rendimiento/Deporte', 'Salud general'];
        const cardioOpts = ['Mínimo, gracias', 'Algo moderado', 'Lo que haga falta'];
        const dietaOpts = ['Flexible', 'Bastante estricta', 'Voy un poco a lo loco'];
        const ejerciciosFavOpts = ['Multiarticulares', 'Máquinas', 'Peso libre', 'Funcional', 'No lo sé aún'];
        const ejerciciosEvitOpts = ['Cardio', 'Piernas', 'Trabajo de core', 'Nada en especial'];

        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[styles.header, { backgroundColor: theme.background }]}>
                    <Text style={[styles.progressText, { color: theme.textSecondary }]}>Paso 3 de 6</Text>
                </View>

                <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.screenTitle, { color: theme.text }]}>Tu estilo de entreno y dieta</Text>
                    <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>Unas pocas más y ya está</Text>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Qué tipo de entreno te va más?</Text>
                        <View style={styles.chipGrid}>
                            {tipoOpts.map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.tipoEntreno === opt ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.tipoEntreno === opt ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, tipoEntreno: opt })}
                                >
                                    <Text style={[styles.chipText, { color: formData.tipoEntreno === opt ? theme.primary : theme.text }]}>
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>Sobre el cardio…</Text>
                        <View style={styles.chipGrid}>
                            {cardioOpts.map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.cardio === opt ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.cardio === opt ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, cardio: opt })}
                                >
                                    <Text style={[styles.chipText, { color: formData.cardio === opt ? theme.primary : theme.text }]}>
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>Tu estilo de dieta ahora mismo es…</Text>
                        <View style={styles.chipGrid}>
                            {dietaOpts.map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.dieta === opt ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.dieta === opt ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, dieta: opt })}
                                >
                                    <Text style={[styles.chipText, { color: formData.dieta === opt ? theme.primary : theme.text }]}>
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Cuántas comidas haces al día?</Text>
                        <SimpleSlider
                            value={formData.comidasDia}
                            onValueChange={(val: number) => setFormData({ ...formData, comidasDia: val })}
                            min={2}
                            max={6}
                            labels={null}
                        />
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Qué ejercicios disfrutas más?</Text>
                        <View style={styles.chipGrid}>
                            {ejerciciosFavOpts.map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.ejerciciosFavoritos === opt ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.ejerciciosFavoritos === opt ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, ejerciciosFavoritos: opt })}
                                >
                                    <Text style={[styles.chipText, { color: formData.ejerciciosFavoritos === opt ? theme.primary : theme.text }]}>
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Qué sueles evitar?</Text>
                        <View style={styles.chipGrid}>
                            {ejerciciosEvitOpts.map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.ejerciciosEvitados === opt ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.ejerciciosEvitados === opt ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, ejerciciosEvitados: opt })}
                                >
                                    <Text style={[styles.chipText, { color: formData.ejerciciosEvitados === opt ? theme.primary : theme.text }]}>
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: theme.background }]}>
                    <TouchableOpacity style={[styles.footerButton, { borderColor: theme.border }]} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={20} color={theme.text} />
                        <Text style={[styles.footerButtonText, { color: theme.text }]}>Atrás</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: theme.primary }]}
                        onPress={handleNext}
                    >
                        <Text style={styles.primaryButtonText}>Siguiente</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // STEP 4: HEALTH & HABITS
    if (currentStep === 4) {
        const lesionesOpts = ['Rodilla', 'Espalda baja', 'Hombro', 'Codo/Muñeca', 'Ninguna'];
        const cocinaOpts = ['Sí, casi siempre', 'No, casi nunca'];

        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[styles.header, { backgroundColor: theme.background }]}>
                    <Text style={[styles.progressText, { color: theme.textSecondary }]}>Paso 4 de 6</Text>
                </View>

                <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.screenTitle, { color: theme.text }]}>Salud y hábitos</Text>
                    <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>
                        Esto es importante para cuidarte, no para juzgarte
                    </Text>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Tienes alguna lesión o molestia habitual?</Text>
                        <View style={styles.chipGrid}>
                            {lesionesOpts.map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.lesiones === opt ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.lesiones === opt ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, lesiones: opt })}
                                >
                                    <Text style={[styles.chipText, { color: formData.lesiones === opt ? theme.primary : theme.text }]}>
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Alguna alergia o intolerancia importante?</Text>
                        <TextInput
                            style={[styles.textInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                            placeholder="Ninguna relevante"
                            placeholderTextColor={theme.textSecondary}
                            value={formData.alergias}
                            onChangeText={(text) => setFormData({ ...formData, alergias: text })}
                        />
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Sueles cocinar tú?</Text>
                        <View style={styles.chipGrid}>
                            {cocinaOpts.map((opt) => {
                                const val = opt.includes('Sí') ? 'si' : 'no';
                                return (
                                    <TouchableOpacity
                                        key={opt}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor: formData.cocina === val ? theme.primary + '20' : theme.cardBackground,
                                                borderColor: formData.cocina === val ? theme.primary : theme.border,
                                            },
                                        ]}
                                        onPress={() => setFormData({ ...formData, cocina: val })}
                                    >
                                        <Text style={[styles.chipText, { color: formData.cocina === val ? theme.primary : theme.text }]}>
                                            {opt}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: theme.background }]}>
                    <TouchableOpacity style={[styles.footerButton, { borderColor: theme.border }]} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={20} color={theme.text} />
                        <Text style={[styles.footerButtonText, { color: theme.text }]}>Atrás</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: theme.primary }]}
                        onPress={handleNext}
                    >
                        <Text style={styles.primaryButtonText}>Siguiente</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // STEP 5: PREMIUM UPSELL
    if (currentStep === 5) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.upsellContent}>
                        <Ionicons name="trophy" size={80} color={theme.primary} />
                        <Text style={[styles.welcomeTitle, { color: theme.text }]}>
                            Para sacarle TODO el jugo a la app…
                        </Text>
                        <Text style={[styles.welcomeSubtitle, { color: theme.textSecondary }]}>
                            Con la versión Premium desbloqueas tu experiencia completa.
                        </Text>

                        <View style={styles.benefitsList}>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                                <Text style={[styles.benefitText, { color: theme.text }]}>
                                    Rutinas personalizadas actualizadas por tu entrenador
                                </Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                                <Text style={[styles.benefitText, { color: theme.text }]}>
                                    Histórico de cargas y seguimiento de progreso
                                </Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                                <Text style={[styles.benefitText, { color: theme.text }]}>
                                    Acceso prioritario a soporte y ajustes de rutina
                                </Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                                <Text style={[styles.benefitText, { color: theme.text }]}>
                                    Más herramientas de análisis y métricas de rendimiento
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                            onPress={() => router.push('/(app)/payment')}
                        >
                            <Text style={styles.primaryButtonText}>Ver beneficios Premium</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleNext}>
                            <Text style={[styles.linkText, { color: theme.textSecondary }]}>
                                Hacerlo más tarde
                            </Text>
                        </TouchableOpacity>

                        <Text style={[styles.helperText, { color: theme.textSecondary, marginTop: 16 }]}>
                            Puedes subir a Premium cuando quieras desde el menú. No hay presión.
                        </Text>
                    </View>
                </ScrollView>
            </View>
        );
    }

    // STEP 6: FINAL MESSAGE
    if (currentStep === 6) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.finishContent}>
                        <Ionicons name="rocket" size={80} color={theme.primary} />
                        <Text style={[styles.welcomeTitle, { color: theme.text }]}>
                            Listo. Ya tengo lo que necesito para entrenarte mejor.
                        </Text>
                        <Text style={[styles.welcomeSubtitle, { color: theme.textSecondary }]}>
                            A partir de ahora, cada entreno será una oportunidad de subir de nivel.
                        </Text>
                        <Text style={[styles.welcomeSubtitle, { color: theme.textSecondary, marginTop: 8 }]}>
                            No hace falta que seas perfecto, solo constante. Vamos a por ello 💪
                        </Text>

                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                            onPress={handleFinish}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Entrar en la app</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    progressText: {
        fontSize: 14,
        fontWeight: '600',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    welcomeContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    upsellContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 24,
        marginBottom: 12,
    },
    welcomeSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
        paddingHorizontal: 10,
    },
    benefitsList: {
        width: '100%',
        gap: 16,
        marginBottom: 32,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    benefitText: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
    },
    primaryButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: 'bold',
    },
    helperText: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 8,
    },
    linkText: {
        fontSize: 15,
        textAlign: 'center',
        marginTop: 8,
        textDecorationLine: 'underline',
    },
    screenTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    screenSubtitle: {
        fontSize: 15,
        marginBottom: 24,
        textAlign: 'center',
    },
    section: {
        marginBottom: 5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    fieldLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    numericInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 16,
        paddingHorizontal: 16,
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 15,
    },
    inputHint: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 6,
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 2,
        marginBottom: 8,
    },
    chipText: {
        fontSize: 15,
        fontWeight: '500',
    },
    sliderContainer: {
        marginTop: 8,
    },
    sliderControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
    },
    sliderBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sliderValueContainer: {
        alignItems: 'center',
        minWidth: 120,
    },
    sliderValue: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    sliderLabel: {
        fontSize: 13,
        marginTop: 4,
        textAlign: 'center',
    },
    finishContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80,
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    footerButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        borderWidth: 2,
    },
    footerButtonPrimary: {
        borderWidth: 0,
    },
    footerButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
