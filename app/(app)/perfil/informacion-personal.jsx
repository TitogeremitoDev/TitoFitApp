import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, PanResponder, Platform } from 'react-native';
import { EnhancedTextInput } from '../../../components/ui';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useForm, Controller } from 'react-hook-form';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import axios from 'axios';

const CustomSlider = ({ label, value, onValueChange, min, max, leftIcon, rightIcon, descriptions }) => {
    const { theme } = useTheme();
    const percentage = ((value - min) / (max - min)) * 100;
    const trackWidthRef = useRef(0);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                if (trackWidthRef.current <= 0) return; // Guard against 0 width
                const locationX = evt.nativeEvent.locationX;
                const newPercentage = Math.max(0, Math.min(100, (locationX / trackWidthRef.current) * 100));
                const newValue = Math.round((newPercentage / 100) * (max - min) + min);
                onValueChange(Math.max(min, Math.min(max, newValue)));
            },
            onPanResponderMove: (evt) => {
                if (trackWidthRef.current <= 0) return; // Guard against 0 width
                const locationX = evt.nativeEvent.locationX;
                const newPercentage = Math.max(0, Math.min(100, (locationX / trackWidthRef.current) * 100));
                const newValue = Math.round((newPercentage / 100) * (max - min) + min);
                onValueChange(Math.max(min, Math.min(max, newValue)));
            },
        })
    ).current;

    const onTrackLayout = (event) => {
        trackWidthRef.current = event.nativeEvent.layout.width;
    };

    const isWeb = Platform.OS === 'web';

    return (
        <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
            <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
            <View style={styles.sliderContainer}>
                {!isWeb && Platform.OS !== 'ios' && (
                    <View
                        style={styles.sliderTouchArea}
                        onLayout={onTrackLayout}
                        {...panResponder.panHandlers}
                    >
                        <View style={styles.sliderTrack}>
                            <View style={[styles.sliderFill, { width: `${percentage}%`, backgroundColor: theme.primary, pointerEvents: 'none' }]} />
                        </View>
                    </View>
                )}

                <View style={[styles.sliderControls, isWeb && { justifyContent: 'center', gap: 20, marginBottom: 10 }]}>
                    <TouchableOpacity
                        onPress={() => onValueChange(Math.max(min, value - 1))}
                        style={[styles.sliderBtn, { backgroundColor: theme.background }]}
                    >
                        <Ionicons name={leftIcon} size={20} color={theme.text} />
                    </TouchableOpacity>
                    <View style={styles.sliderValueContainer}>
                        <Text style={[styles.sliderValue, { color: theme.primary }]}>{value}</Text>
                        <Text style={[styles.sliderValueLabel, { color: theme.textSecondary }]}>/ {max}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => onValueChange(Math.min(max, value + 1))}
                        style={[styles.sliderBtn, { backgroundColor: theme.background }]}
                    >
                        <Ionicons name={rightIcon} size={20} color={theme.text} />
                    </TouchableOpacity>
                </View>

                {descriptions && (
                    <Text style={[styles.sliderDescription, { color: theme.textSecondary }]}>
                        {descriptions[value - min] || ''}
                    </Text>
                )}
            </View>
        </View>
    );
};

const RadioGroup = ({ options, value, onChange, label }) => {
    const { theme } = useTheme();
    return (
        <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
            <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
            <View style={styles.radioGroup}>
                {options.map((opt) => (
                    <TouchableOpacity
                        key={opt.value}
                        style={[
                            styles.radioOption,
                            {
                                borderColor: value === opt.value ? theme.primary : theme.border,
                                backgroundColor: value === opt.value ? theme.primary + '20' : 'transparent'
                            }
                        ]}
                        onPress={() => onChange(opt.value)}
                    >
                        <View style={[
                            styles.radioCircle,
                            { borderColor: value === opt.value ? theme.primary : theme.textSecondary }
                        ]}>
                            {value === opt.value && <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />}
                        </View>
                        <Text style={[
                            styles.radioText,
                            { color: value === opt.value ? theme.primary : theme.text }
                        ]}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

// Multi-select chip component for array fields
const ChipMultiSelect = ({ options, value, onChange, label }) => {
    const { theme } = useTheme();
    const currentValue = Array.isArray(value) ? value : [];

    const toggle = (opt) => {
        const isSelected = currentValue.includes(opt);
        const newValue = isSelected
            ? currentValue.filter(i => i !== opt)
            : [...currentValue, opt];
        onChange(newValue);
    };

    return (
        <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
            <Text style={[styles.label, { color: theme.text }]}>{label} (puedes elegir varios)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {options.map((opt) => (
                    <TouchableOpacity
                        key={opt}
                        style={{
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            borderRadius: 20,
                            backgroundColor: currentValue.includes(opt) ? theme.primary + '20' : theme.background,
                            borderWidth: 2,
                            borderColor: currentValue.includes(opt) ? theme.primary : theme.border,
                        }}
                        onPress={() => toggle(opt)}
                    >
                        <Text style={{ color: currentValue.includes(opt) ? theme.primary : theme.text, fontSize: 14, fontWeight: '500' }}>
                            {opt}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

export default function InformacionPersonal() {
    const router = useRouter();
    const { theme } = useTheme();
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(false);

    const { control, handleSubmit, setValue, reset, formState: { errors } } = useForm({
        defaultValues: {
            edad: '',
            peso: '',
            altura: '',
            genero: '',
            objetivos: '',
            objetivoPrincipal: '',
            compromiso: 'medio',
            experiencia: 5,
            conocimientoTecnico: 3,
            tipoEntreno: 'hipertrofia',
            lesiones: [],
            ejerciciosFavoritos: [],
            ejerciciosEvitados: [],
            cardio: 'moderado',
            dieta: 'flexible',
            comidasDia: '4',
            alergias: '',
            cocina: 'si'
        }
    });

    useEffect(() => {
        if (user?.info_user) {
            // Pre-fill form with existing data
            const info = user.info_user;
            Object.keys(info).forEach(key => {
                // Convert numbers to strings for text inputs if needed, or keep as is for controllers
                let val = info[key];
                if (key === 'edad' || key === 'peso' || key === 'altura' || key === 'comidasDia') {
                    val = val ? String(val) : '';
                }
                // Handle backward compatibility for multi-select fields (old string values -> array)
                if (key === 'lesiones' || key === 'ejerciciosFavoritos' || key === 'ejerciciosEvitados') {
                    if (typeof val === 'string' && val) {
                        val = [val]; // Convert old string to array
                    } else if (!Array.isArray(val)) {
                        val = [];
                    }
                }
                setValue(key, val);
            });
        }
    }, [user?._id, setValue]);

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            // Convert numeric strings back to numbers
            const payload = {
                ...data,
                edad: data.edad ? Number(data.edad) : null,
                peso: data.peso ? Number(data.peso) : null,
                altura: data.altura ? Number(data.altura) : null,
                genero: data.genero,
                comidasDia: data.comidasDia ? Number(data.comidasDia) : 4,
            };

            console.log('[INFO-PERSONAL] Enviando payload:', JSON.stringify(payload, null, 2));
            const response = await axios.put('/users/info', { info_user: payload });
            console.log('[INFO-PERSONAL] Respuesta servidor:', JSON.stringify(response.data, null, 2));
            await refreshUser(true); // Update local user context
            Alert.alert('Éxito', 'Información actualizada correctamente');
        } catch (error) {
            console.error('Error updating info:', error);
            Alert.alert('Error', 'No se pudo actualizar la información');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <LinearGradient
                colors={[theme.primary, theme.background]}
                style={styles.headerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            />

            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>INFORMACIÓN PERSONAL</Text>
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: theme.primary }]}
                    onPress={handleSubmit(onSubmit)}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Guardar</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Tu Perfil Fitness</Text>
                    <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                        Esta información es crucial para que tu entrenador personalice tu plan al 100%.
                    </Text>
                </View>

                {/* Datos Básicos */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.primary }]}>Datos Básicos</Text>

                    <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
                        <Text style={[styles.label, { color: theme.text }]}>Nombre Completo</Text>
                        <EnhancedTextInput
                            style={[styles.inputText, { color: theme.text }]}
                            containerStyle={[styles.inputLayout, { borderColor: theme.border }]}
                            value={user?.nombre || ''}
                            editable={false}
                        />
                        <Text style={[styles.helperText, { color: theme.textSecondary }]}>No editable</Text>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputContainer, { flex: 1, marginRight: 8, backgroundColor: theme.card }]}>
                            <Text style={[styles.label, { color: theme.text }]}>Edad</Text>
                            <Controller
                                control={control}
                                name="edad"
                                rules={{ required: 'Requerido', pattern: { value: /^[0-9]+$/, message: 'Solo números' } }}
                                render={({ field: { onChange, value } }) => (
                                    <EnhancedTextInput
                                        style={[styles.inputText, { color: theme.text }]}
                                        containerStyle={[styles.inputLayout, { borderColor: errors.edad ? 'red' : theme.border }]}
                                        placeholder="Ej: 25"
                                        placeholderTextColor={theme.textSecondary}
                                        keyboardType="numeric"
                                        value={value}
                                        onChangeText={onChange}
                                    />
                                )}
                            />
                            {errors.edad && <Text style={styles.errorText}>{errors.edad.message}</Text>}
                        </View>
                        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8, backgroundColor: theme.card }]}>
                            <Text style={[styles.label, { color: theme.text }]}>Peso (kg)</Text>
                            <Controller
                                control={control}
                                name="peso"
                                rules={{ required: 'Requerido', pattern: { value: /^[0-9.]+$/, message: 'Solo números' } }}
                                render={({ field: { onChange, value } }) => (
                                    <EnhancedTextInput
                                        style={[styles.inputText, { color: theme.text }]}
                                        containerStyle={[styles.inputLayout, { borderColor: errors.peso ? 'red' : theme.border }]}
                                        placeholder="Ej: 75.5"
                                        placeholderTextColor={theme.textSecondary}
                                        keyboardType="numeric"
                                        value={value}
                                        onChangeText={onChange}
                                    />
                                )}
                            />
                            {errors.peso && <Text style={styles.errorText}>{errors.peso.message}</Text>}
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputContainer, { flex: 1, marginRight: 8, backgroundColor: theme.card }]}>
                            <Text style={[styles.label, { color: theme.text }]}>Altura (m)</Text>
                            <Controller
                                control={control}
                                name="altura"
                                rules={{ required: 'Requerido', pattern: { value: /^[0-9.]+$/, message: 'Solo números' } }}
                                render={({ field: { onChange, value } }) => (
                                    <EnhancedTextInput
                                        style={[styles.inputText, { color: theme.text }]}
                                        containerStyle={[styles.inputLayout, { borderColor: errors.altura ? 'red' : theme.border }]}
                                        placeholder="Ej: 1.75"
                                        placeholderTextColor={theme.textSecondary}
                                        keyboardType="numeric"
                                        value={value}
                                        onChangeText={(text) => onChange(text.replace(/,/g, '.'))}
                                    />
                                )}
                            />
                            {errors.altura && <Text style={styles.errorText}>{errors.altura.message}</Text>}
                        </View>
                        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8, backgroundColor: theme.card }]}>
                            <Text style={[styles.label, { color: theme.text }]}>Género</Text>
                            <Controller
                                control={control}
                                name="genero"
                                rules={{ required: 'Requerido' }}
                                render={({ field: { onChange, value } }) => (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                        {['Hombre', 'Mujer', 'No quiero definirlo'].map((gen) => (
                                            <TouchableOpacity
                                                key={gen}
                                                style={{
                                                    paddingVertical: 8,
                                                    paddingHorizontal: 12,
                                                    borderRadius: 20,
                                                    backgroundColor: value === gen ? theme.primary : theme.background,
                                                    borderWidth: 1,
                                                    borderColor: value === gen ? theme.primary : theme.border,
                                                }}
                                                onPress={() => onChange(gen)}
                                            >
                                                <Text style={{ color: value === gen ? '#fff' : theme.text, fontSize: 12 }}>{gen}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            />
                            {errors.genero && <Text style={styles.errorText}>{errors.genero.message}</Text>}
                        </View>
                    </View>

                    <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
                        <Text style={[styles.label, { color: theme.text }]}>Email</Text>
                        <EnhancedTextInput
                            style={[styles.inputText, { color: theme.text }]}
                            containerStyle={[styles.inputLayout, { borderColor: theme.border }]}
                            value={user?.email || ''}
                            editable={false}
                        />
                    </View>
                </View>

                {/* Objetivos */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.primary }]}>Objetivos</Text>

                    <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
                        <Text style={[styles.label, { color: theme.text }]}>¿Qué quieres lograr?</Text>
                        <Controller
                            control={control}
                            name="objetivos"
                            render={({ field: { onChange, value } }) => (
                                <EnhancedTextInput
                                    style={[styles.textAreaText, { color: theme.text }]}
                                    containerStyle={[styles.textAreaLayout, { borderColor: theme.border }]}
                                    placeholder="Ej: Ganar masa muscular, perder grasa, mejorar resistencia..."
                                    placeholderTextColor={theme.textSecondary}
                                    multiline
                                    numberOfLines={3}
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                    </View>

                    <Controller
                        control={control}
                        name="objetivoPrincipal"
                        render={({ field: { onChange, value } }) => (
                            <RadioGroup
                                label="Objetivo Principal"
                                value={value}
                                onChange={onChange}
                                options={[
                                    { label: '💪 Ganar peso / Volumen', value: 'ganar_peso' },
                                    { label: '🔥 Definir / Perder grasa', value: 'definir' },
                                    { label: '⚖️ Mantenerme', value: 'mantener' },
                                ]}
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name="compromiso"
                        render={({ field: { onChange, value } }) => (
                            <RadioGroup
                                label="Nivel de Compromiso"
                                value={value}
                                onChange={onChange}
                                options={[
                                    { label: 'Bajo (1-2 días/sem)', value: 'bajo' },
                                    { label: 'Medio (3-4 días/sem)', value: 'medio' },
                                    { label: 'Alto (5+ días/sem)', value: 'alto' },
                                ]}
                            />
                        )}
                    />
                </View>

                {/* Experiencia */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.primary }]}>Experiencia</Text>

                    <Controller
                        control={control}
                        name="experiencia"
                        render={({ field: { onChange, value } }) => (
                            <CustomSlider
                                label="Nivel de Experiencia"
                                value={value}
                                onValueChange={onChange}
                                min={1}
                                max={10}
                                leftIcon="walk"
                                rightIcon="trophy"
                                descriptions={[
                                    "Principiante absoluto", "Poco ejercicio", "Alguna experiencia", "Intermedio bajo",
                                    "Intermedio", "Intermedio alto", "Avanzado", "Muy avanzado", "Semi-pro", "Profesional"
                                ]}
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name="conocimientoTecnico"
                        render={({ field: { onChange, value } }) => (
                            <CustomSlider
                                label="Conocimiento Técnico"
                                value={value}
                                onValueChange={onChange}
                                min={1}
                                max={5}
                                leftIcon="book"
                                rightIcon="school"
                                descriptions={[
                                    "No sé nada", "Básico", "Medio", "Bueno", "Experto"
                                ]}
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name="tipoEntreno"
                        render={({ field: { onChange, value } }) => (
                            <RadioGroup
                                label="Tipo de Entrenamiento Preferido"
                                value={value}
                                onChange={onChange}
                                options={[
                                    { label: 'Hipertrofia (Masa Muscular)', value: 'hipertrofia' },
                                    { label: 'Fuerza (Powerlifting)', value: 'fuerza' },
                                    { label: 'Pérdida de grasa', value: 'perdida_grasa' },
                                    { label: 'Resistencia / Funcional', value: 'resistencia' },
                                    { label: 'Salud general', value: 'salud' },
                                    { label: 'Híbrido', value: 'hibrido' },
                                ]}
                            />
                        )}
                    />
                </View>

                {/* Salud y Limitaciones */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.primary }]}>Salud y Limitaciones</Text>

                    <Controller
                        control={control}
                        name="lesiones"
                        render={({ field: { onChange, value } }) => (
                            <ChipMultiSelect
                                label="Lesiones o Molestias"
                                value={value}
                                onChange={onChange}
                                options={['Rodilla', 'Espalda baja', 'Hombro', 'Codo/Muñeca', 'Cuello', 'Cadera', 'Ninguna']}
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name="ejerciciosFavoritos"
                        render={({ field: { onChange, value } }) => (
                            <ChipMultiSelect
                                label="Ejercicios Favoritos"
                                value={value}
                                onChange={onChange}
                                options={['Multiarticulares', 'Máquinas', 'Peso libre', 'Funcional', 'Calistenia', 'Cardio']}
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name="ejerciciosEvitados"
                        render={({ field: { onChange, value } }) => (
                            <ChipMultiSelect
                                label="Ejercicios a Evitar"
                                value={value}
                                onChange={onChange}
                                options={['Cardio', 'Piernas', 'Trabajo de core', 'Peso muerto', 'Sentadilla', 'Nada en especial']}
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name="cardio"
                        render={({ field: { onChange, value } }) => (
                            <RadioGroup
                                label="Preferencia de Cardio"
                                value={value}
                                onChange={onChange}
                                options={[
                                    { label: 'Nada / Mínimo', value: 'minimo' },
                                    { label: 'Moderado (Caminar/Bici)', value: 'moderado' },
                                    { label: 'Intenso (HIIT/Correr)', value: 'intenso' },
                                ]}
                            />
                        )}
                    />
                </View>

                {/* Nutrición */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.primary }]}>Nutrición y Hábitos</Text>

                    <Controller
                        control={control}
                        name="dieta"
                        render={({ field: { onChange, value } }) => (
                            <RadioGroup
                                label="Preferencia de Dieta"
                                value={value}
                                onChange={onChange}
                                options={[
                                    { label: 'Flexible (IIFYM)', value: 'flexible' },
                                    { label: 'Estricta (Clean Eating)', value: 'estricta' },
                                    { label: 'Sin control', value: 'sin_control' },
                                    { label: 'Vegetariana/Vegana', value: 'vegetariana' },
                                    { label: 'Keto/Low Carb', value: 'keto' },
                                ]}
                            />
                        )}
                    />

                    <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
                        <Text style={[styles.label, { color: theme.text }]}>Comidas al día</Text>
                        <Controller
                            control={control}
                            name="comidasDia"
                            rules={{ pattern: { value: /^[0-9]+$/, message: 'Solo números' } }}
                            render={({ field: { onChange, value } }) => (
                                <EnhancedTextInput
                                    style={[styles.inputText, { color: theme.text }]}
                                    containerStyle={[styles.inputLayout, { borderColor: theme.border }]}
                                    placeholder="Ej: 4"
                                    placeholderTextColor={theme.textSecondary}
                                    keyboardType="numeric"
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                    </View>

                    <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
                        <Text style={[styles.label, { color: theme.text }]}>Alergias o Intolerancias</Text>
                        <Controller
                            control={control}
                            name="alergias"
                            render={({ field: { onChange, value } }) => (
                                <EnhancedTextInput
                                    style={[styles.textAreaText, { color: theme.text }]}
                                    containerStyle={[styles.textAreaLayout, { borderColor: theme.border }]}
                                    placeholder="Ej: Lactosa, Gluten, Nueces..."
                                    placeholderTextColor={theme.textSecondary}
                                    multiline
                                    numberOfLines={2}
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                    </View>

                    <Controller
                        control={control}
                        name="cocina"
                        render={({ field: { onChange, value } }) => (
                            <RadioGroup
                                label="¿Cocinas tus alimentos?"
                                value={value}
                                onChange={onChange}
                                options={[
                                    { label: 'Sí, siempre', value: 'si' },
                                    { label: 'A veces / Fines de semana', value: 'a_veces' },
                                    { label: 'No, compro hecho', value: 'no' },
                                ]}
                            />
                        )}
                    />
                </View>



            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: 120,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    backButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        marginTop: 10,
        backgroundColor: 'transparent',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    card: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    cardSubtitle: {
        fontSize: 14,
        lineHeight: 20,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        marginBottom: 12,
        paddingLeft: 4,
    },
    inputContainer: {
        marginBottom: 12,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    inputLayout: {
        borderBottomWidth: 1,
        paddingVertical: 12,
        minHeight: 44, // iOS area tactil
    },
    inputText: {
        fontSize: 16,
    },
    textAreaLayout: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        minHeight: 60,
    },
    textAreaText: {
        fontSize: 15,
        textAlignVertical: 'top',
    },
    helperText: {
        fontSize: 12,
        marginTop: 4,
    },
    errorText: {
        color: 'red',
        fontSize: 12,
        marginTop: 4,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    // Slider Styles
    sliderContainer: {
        marginTop: 8,
    },
    sliderTouchArea: {
        // Invisible touch target - tall for easy tapping
        paddingVertical: Platform.OS === 'ios' ? 16 : 10,
        marginBottom: 12,
        justifyContent: 'center',
    },
    sliderTrack: {
        // Visual track - thin bar
        height: Platform.OS === 'ios' ? 8 : 6,
        backgroundColor: '#e0e0e0',
        borderRadius: Platform.OS === 'ios' ? 4 : 3,
        overflow: 'hidden',
    },
    sliderFill: {
        height: '100%',
        borderRadius: Platform.OS === 'ios' ? 4 : 3,
    },
    sliderControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sliderBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    sliderValueContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    sliderValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    sliderValueLabel: {
        fontSize: 14,
        marginLeft: 4,
    },
    sliderDescription: {
        textAlign: 'center',
        marginTop: 8,
        fontSize: 13,
        fontStyle: 'italic',
    },
    // Radio Styles
    radioGroup: {
        marginTop: 8,
    },
    radioOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 6,
        minHeight: 48, // iOS área táctil
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    radioText: {
        fontSize: 16,
    },
    footer: {
        marginTop: 12,
    },
    saveButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
