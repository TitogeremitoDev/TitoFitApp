import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, PanResponder, Platform } from 'react-native';
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
    const [trackWidth, setTrackWidth] = useState(0);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const locationX = evt.nativeEvent.locationX;
                const newPercentage = Math.max(0, Math.min(100, (locationX / trackWidth) * 100));
                const newValue = Math.round((newPercentage / 100) * (max - min) + min);
                onValueChange(Math.max(min, Math.min(max, newValue)));
            },
            onPanResponderMove: (evt) => {
                const locationX = evt.nativeEvent.locationX;
                const newPercentage = Math.max(0, Math.min(100, (locationX / trackWidth) * 100));
                const newValue = Math.round((newPercentage / 100) * (max - min) + min);
                onValueChange(Math.max(min, Math.min(max, newValue)));
            },
        })
    ).current;

    const onTrackLayout = (event) => {
        setTrackWidth(event.nativeEvent.layout.width);
    };

    const isWeb = Platform.OS === 'web';

    return (
        <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
            <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
            <View style={styles.sliderContainer}>
                {!isWeb && (
                    <View
                        style={styles.sliderTrack}
                        onLayout={onTrackLayout}
                        {...panResponder.panHandlers}
                    >
                        <View pointerEvents="none" style={[styles.sliderFill, { width: `${percentage}%`, backgroundColor: theme.primary }]} />
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
            compromiso: 'medio',
            experiencia: 5,
            conocimientoTecnico: 3,
            tipoEntreno: 'hipertrofia',
            lesiones: '',
            ejerciciosFavoritos: '',
            ejerciciosEvitados: '',
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
                setValue(key, val);
            });
        }
    }, [user, setValue]);

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

            await axios.put('/users/info', { info_user: payload });
            await refreshUser(); // Update local user context
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
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Información Personal</Text>
                <View style={{ width: 24 }} />
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
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
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
                                    <TextInput
                                        style={[styles.input, { color: theme.text, borderColor: errors.edad ? 'red' : theme.border }]}
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
                                    <TextInput
                                        style={[styles.input, { color: theme.text, borderColor: errors.peso ? 'red' : theme.border }]}
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
                                    <TextInput
                                        style={[styles.input, { color: theme.text, borderColor: errors.altura ? 'red' : theme.border }]}
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
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
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
                                <TextInput
                                    style={[styles.textArea, { color: theme.text, borderColor: theme.border }]}
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
                                    { label: 'Resistencia / Funcional', value: 'resistencia' },
                                    { label: 'Híbrido', value: 'hibrido' },
                                ]}
                            />
                        )}
                    />
                </View>

                {/* Salud y Limitaciones */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.primary }]}>Salud y Limitaciones</Text>

                    <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
                        <Text style={[styles.label, { color: theme.text }]}>Lesiones o Molestias</Text>
                        <Controller
                            control={control}
                            name="lesiones"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[styles.textArea, { color: theme.text, borderColor: theme.border }]}
                                    placeholder="Describe cualquier lesión actual o pasada relevante..."
                                    placeholderTextColor={theme.textSecondary}
                                    multiline
                                    numberOfLines={2}
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                    </View>

                    <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
                        <Text style={[styles.label, { color: theme.text }]}>Ejercicios Favoritos</Text>
                        <Controller
                            control={control}
                            name="ejerciciosFavoritos"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                                    placeholder="Ej: Sentadilla, Press Banca..."
                                    placeholderTextColor={theme.textSecondary}
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                    </View>

                    <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
                        <Text style={[styles.label, { color: theme.text }]}>Ejercicios a Evitar</Text>
                        <Controller
                            control={control}
                            name="ejerciciosEvitados"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                                    placeholder="Ej: Correr, Saltos..."
                                    placeholderTextColor={theme.textSecondary}
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                    </View>

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
                                <TextInput
                                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
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
                                <TextInput
                                    style={[styles.textArea, { color: theme.text, borderColor: theme.border }]}
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

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: theme.primary }]}
                        onPress={handleSubmit(onSubmit)}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                        )}
                    </TouchableOpacity>
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
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
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
        paddingBottom: 24,
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
    input: {
        fontSize: 16,
        borderBottomWidth: 1,
        paddingVertical: 8,
    },
    textArea: {
        fontSize: 15,
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        textAlignVertical: 'top',
        minHeight: 60,
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
    sliderTrack: {
        height: 6,
        backgroundColor: '#e0e0e0',
        borderRadius: 3,
        marginBottom: 12,
        overflow: 'hidden',
        paddingVertical: 10,
    },
    sliderFill: {
        height: '100%',
        borderRadius: 3,
    },
    sliderControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sliderBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
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
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 6,
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
        paddingVertical: 16,
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
        fontSize: 18,
        fontWeight: 'bold',
    },
});
