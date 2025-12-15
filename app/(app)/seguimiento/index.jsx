/* app/(app)/seguimiento/index.jsx - Sistema de Seguimiento Completo */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Pressable,
    Platform,
    useWindowDimensions,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useAchievements } from '../../../context/AchievementsContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES REUTILIZABLES
// ═══════════════════════════════════════════════════════════════════════════

// Sección expandible (Accordion)
const ExpandableSection = ({ title, icon, children, expanded, onToggle, color = '#3B82F6' }) => (
    <View style={styles.accordionContainer}>
        <TouchableOpacity
            style={[styles.accordionHeader, { borderLeftColor: color }]}
            onPress={onToggle}
            activeOpacity={0.7}
        >
            <View style={styles.accordionTitleRow}>
                <Text style={styles.accordionIcon}>{icon}</Text>
                <Text style={styles.accordionTitle}>{title}</Text>
            </View>
            <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#9CA3AF"
            />
        </TouchableOpacity>
        {expanded && (
            <View style={styles.accordionContent}>
                {children}
            </View>
        )}
    </View>
);

// Campo numérico simple
const NumberInput = ({ label, value, onChangeText, placeholder, suffix = '' }) => (
    <View style={styles.inputRow}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.inputWrapper}>
            <TextInput
                style={styles.numberInput}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
            />
            {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
        </View>
    </View>
);

// Campo de medición compacto (para filas de 2)
const MeasureInput = ({ label, value, onChangeText, placeholder }) => (
    <View style={styles.measureItem}>
        <Text style={styles.measureLabel}>{label}</Text>
        <View style={styles.measureInputRow}>
            <TextInput
                style={styles.measureInput}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
            />
            <Text style={styles.measureSuffix}>cm</Text>
        </View>
    </View>
);

// Selector de escala (1-5 o 1-10)
const ScaleSelector = ({ label, value, onChange, max = 5, labels = [] }) => (
    <View style={styles.scaleContainer}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.scaleRow}>
            {Array.from({ length: max }, (_, i) => i + 1).map((num) => (
                <TouchableOpacity
                    key={num}
                    style={[
                        styles.scaleBtn,
                        value === num && styles.scaleBtnActive
                    ]}
                    onPress={() => onChange(num)}
                >
                    <Text style={[
                        styles.scaleBtnText,
                        value === num && styles.scaleBtnTextActive
                    ]}>
                        {num}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
        {labels.length > 0 && (
            <View style={styles.scaleLabels}>
                <Text style={styles.scaleLabelText}>{labels[0]}</Text>
                <Text style={styles.scaleLabelText}>{labels[1]}</Text>
            </View>
        )}
    </View>
);

// Selector de ánimo con emojis
const MoodSelector = ({ value, onChange }) => {
    const moods = [
        { emoji: '😢', label: 'Mal', value: 1 },
        { emoji: '😕', label: 'Regular', value: 2 },
        { emoji: '😐', label: 'Normal', value: 3 },
        { emoji: '🙂', label: 'Bien', value: 4 },
        { emoji: '😄', label: 'Genial', value: 5 },
    ];

    return (
        <View style={styles.moodContainer}>
            <Text style={styles.inputLabel}>Ánimo</Text>
            <View style={styles.moodRow}>
                {moods.map((mood) => (
                    <TouchableOpacity
                        key={mood.value}
                        style={[
                            styles.moodBtn,
                            value === mood.value && styles.moodBtnActive
                        ]}
                        onPress={() => onChange(mood.value)}
                    >
                        <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                        <Text style={[
                            styles.moodLabel,
                            value === mood.value && styles.moodLabelActive
                        ]}>
                            {mood.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

// Selector Sí/Medio/No
const TripleChoice = ({ label, value, onChange }) => {
    const options = [
        { label: '✅ Sí', value: 'si', color: '#10B981' },
        { label: '🤔 Medio', value: 'medio', color: '#F59E0B' },
        { label: '❌ No', value: 'no', color: '#EF4444' },
    ];

    return (
        <View style={styles.tripleContainer}>
            <Text style={styles.inputLabel}>{label}</Text>
            <View style={styles.tripleRow}>
                {options.map((opt) => (
                    <TouchableOpacity
                        key={opt.value}
                        style={[
                            styles.tripleBtn,
                            value === opt.value && { backgroundColor: opt.color + '30', borderColor: opt.color }
                        ]}
                        onPress={() => onChange(opt.value)}
                    >
                        <Text style={[
                            styles.tripleBtnText,
                            value === opt.value && { color: opt.color }
                        ]}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

// Campo de texto para comentarios
const CommentInput = ({ label, value, onChangeText, placeholder }) => (
    <View style={styles.commentContainer}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TextInput
            style={styles.commentInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={2}
        />
    </View>
);

// Separador de subsección
const SubsectionTitle = ({ title, icon }) => (
    <View style={styles.subsectionHeader}>
        <Text style={styles.subsectionIcon}>{icon}</Text>
        <Text style={styles.subsectionTitle}>{title}</Text>
    </View>
);

// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function SeguimientoScreen() {
    const { user } = useAuth();
    const { processDailyCheckin, processWeeklyCheckin } = useAchievements();

    // Estados de secciones expandidas
    const [diarioExpanded, setDiarioExpanded] = useState(false);
    const [semanalExpanded, setSemanalExpanded] = useState(false);
    const [nutricionExpanded, setNutricionExpanded] = useState(false);

    // Modal cámara
    const [cameraModalVisible, setCameraModalVisible] = useState(false);

    // ─────────────────────────────────────────────────────────────────────────
    // ESTADOS CHECK-IN DIARIO
    // ─────────────────────────────────────────────────────────────────────────
    const [diario, setDiario] = useState({
        peso: '',
        sueno: '',
        animo: 3,
        energia: 3,
        hambre: 3,
        pasos: '',
        haIdoBien: '',
        nota: '',
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ESTADOS CHECK-IN SEMANAL
    // ─────────────────────────────────────────────────────────────────────────
    const [semanal, setSemanal] = useState({
        // Nutrición
        nutriAdherencia: 5,
        nutriSaciedad: 3,
        nutriGI: 3,
        nutriDeposiciones: 3,
        nutriComidasLibres: '',
        nutriComentario: '',
        // Entrenamiento
        entrenoAdherencia: 5,
        entrenoRendimiento: 5,
        entrenoFatiga: 3,
        entrenoMolestias: false,
        entrenoMolestiasTexto: '',
        entrenoComentario: '',
        // Sensaciones
        sensMotivacion: 3,
        sensEstres: 3,
        sensEmocional: 3,
        sensSuenoMedio: '',
        sensComentario: '',
        // Reflexión
        topMejorar: '',
        topBien: '',
        // Mediciones
        medCuello: '',
        medHombros: '',
        medPecho: '',
        medCintura: '',
        medPierna: '',
        medGemelo: '',
    });

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS
    // ─────────────────────────────────────────────────────────────────────────
    const updateDiario = (key, value) => setDiario(prev => ({ ...prev, [key]: value }));
    const updateSemanal = (key, value) => setSemanal(prev => ({ ...prev, [key]: value }));

    // Valores iniciales para resetear
    const initialDiario = {
        peso: '',
        sueno: '',
        animo: 3,
        energia: 3,
        hambre: 3,
        pasos: '',
        haIdoBien: '',
        nota: '',
    };

    const initialSemanal = {
        nutriAdherencia: 5,
        nutriSaciedad: 3,
        nutriGI: 3,
        nutriDeposiciones: 3,
        nutriComidasLibres: '',
        nutriComentario: '',
        entrenoAdherencia: 5,
        entrenoRendimiento: 5,
        entrenoFatiga: 3,
        entrenoMolestias: false,
        entrenoMolestiasTexto: '',
        entrenoComentario: '',
        sensMotivacion: 3,
        sensEstres: 3,
        sensEmocional: 3,
        sensSuenoMedio: '',
        sensComentario: '',
        topMejorar: '',
        topBien: '',
        medCuello: '',
        medHombros: '',
        medPecho: '',
        medCintura: '',
        medPierna: '',
        medGemelo: '',
    };

    const handleGuardarDiario = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const dataToSave = { ...diario, date: today };

            if (user?.tipoUsuario === 'FREEUSER') {
                // Guardar en local (AsyncStorage)
                const storageKey = `daily_monitoring_${today}`;
                await AsyncStorage.setItem(storageKey, JSON.stringify(dataToSave));

                // También guardar en lista de días registrados
                const daysKey = 'daily_monitoring_days';
                const existingDays = await AsyncStorage.getItem(daysKey);
                const days = existingDays ? JSON.parse(existingDays) : [];
                if (!days.includes(today)) {
                    days.push(today);
                    await AsyncStorage.setItem(daysKey, JSON.stringify(days));
                }

                // 📌 Sincronizar peso al perfil local del usuario
                if (diario.peso && parseFloat(diario.peso) > 0) {
                    await AsyncStorage.setItem('USER_PESO', String(diario.peso));
                }
            } else {
                // Guardar en la nube (backend sincroniza peso automáticamente)
                await axios.post('/monitoring/daily', dataToSave);
            }

            // 🏆 Procesar logros de seguimiento (siempre, independiente de donde se guarde)
            const unlockedAchievements = processDailyCheckin(diario);

            if (unlockedAchievements && unlockedAchievements.length > 0) {
                Alert.alert('🏆 ¡Logro desbloqueado!',
                    `Has desbloqueado: ${unlockedAchievements.map(a => a.name).join(', ')}`);
            } else {
                Alert.alert('✅ Guardado', 'Check-in diario guardado correctamente');
            }

            // Resetear campos
            setDiario(initialDiario);
        } catch (error) {
            console.error('[SEGUIMIENTO] Error guardando diario:', error);
            Alert.alert('Error', 'No se pudo guardar el check-in diario');
        }
    };

    const handleGuardarSemanal = async () => {
        try {
            // Calcular inicio de semana (lunes)
            const now = new Date();
            const dayOfWeek = now.getDay();
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - diff);
            const weekKey = weekStart.toISOString().split('T')[0];

            const dataToSave = { ...semanal, weekStartDate: weekKey };

            if (user?.tipoUsuario === 'FREEUSER') {
                // Guardar en local (AsyncStorage)
                const storageKey = `weekly_monitoring_${weekKey}`;
                await AsyncStorage.setItem(storageKey, JSON.stringify(dataToSave));

                // También guardar en lista de semanas registradas
                const weeksKey = 'weekly_monitoring_weeks';
                const existingWeeks = await AsyncStorage.getItem(weeksKey);
                const weeks = existingWeeks ? JSON.parse(existingWeeks) : [];
                if (!weeks.includes(weekKey)) {
                    weeks.push(weekKey);
                    await AsyncStorage.setItem(weeksKey, JSON.stringify(weeks));
                }

                // 📌 Recalcular AF localmente para FREEUSER
                try {
                    const { computeAF } = await import('../../../src/utils/afCalculator');

                    // Obtener pasos de los últimos 7 días
                    let totalPasos = 0;
                    let daysWithPasos = 0;
                    for (let i = 0; i < 7; i++) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const dateKey = d.toISOString().split('T')[0];
                        const dailyData = await AsyncStorage.getItem(`daily_monitoring_${dateKey}`);
                        if (dailyData) {
                            const parsed = JSON.parse(dailyData);
                            if (parsed.pasos && parseFloat(parsed.pasos) > 0) {
                                totalPasos += parseFloat(parsed.pasos);
                                daysWithPasos++;
                            }
                        }
                    }
                    const pasosMedia = daysWithPasos > 0 ? Math.round(totalPasos / daysWithPasos) : 0;

                    // Contar días de entreno (workouts guardados)
                    const workoutDaysStr = await AsyncStorage.getItem('workout_days_this_week');
                    const entrenosFuerzaSemana = workoutDaysStr ? JSON.parse(workoutDaysStr).length : 0;

                    // Cardio del perfil (usar valor por defecto si no existe)
                    const cardio = 'moderado'; // TODO: obtener de perfil local

                    const af = computeAF({ pasosMedia, cardio, entrenosFuerzaSemana });
                    await AsyncStorage.setItem('USER_AF', String(af));
                    await AsyncStorage.setItem('USER_PASOS_MEDIA', String(pasosMedia));
                } catch (afError) {
                    console.log('[AF] Error calculando AF local:', afError);
                }
            } else {
                // Guardar en la nube
                await axios.post('/monitoring/weekly', dataToSave);

                // 📌 Recalcular AF en el servidor
                try {
                    await axios.post('/monitoring/recalculate-af');
                } catch (afError) {
                    console.log('[AF] Error recalculando AF:', afError);
                }
            }

            // 🏆 Procesar logros de seguimiento semanal
            const unlockedAchievements = processWeeklyCheckin(semanal);

            if (unlockedAchievements && unlockedAchievements.length > 0) {
                Alert.alert('🏆 ¡Logro desbloqueado!',
                    `Has desbloqueado: ${unlockedAchievements.map(a => a.name).join(', ')}`);
            } else {
                Alert.alert('✅ Guardado', 'Check-in semanal guardado correctamente');
            }

            // Resetear campos
            setSemanal(initialSemanal);
        } catch (error) {
            console.error('[SEGUIMIENTO] Error guardando semanal:', error);
            Alert.alert('Error', 'No se pudo guardar el check-in semanal');
        }
    };

    return (
        <View style={styles.root}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#0B1220', '#0D1B2A', '#111827']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* Blobs decorativos */}
            <View style={[styles.blob, styles.blobTop]} />
            <View style={[styles.blob, styles.blobBottom]} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>📏 Seguimiento</Text>
                    <Text style={styles.headerSubtitle}>Registra tu progreso diario y semanal</Text>
                </View>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* SECCIÓN DIARIO */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <ExpandableSection
                    title="Check-in Diario 30s"
                    icon="📅"
                    expanded={diarioExpanded}
                    onToggle={() => setDiarioExpanded(!diarioExpanded)}
                    color="#10B981"
                >
                    <NumberInput
                        label="Peso Hoy"
                        value={diario.peso}
                        onChangeText={(v) => updateDiario('peso', v)}
                        placeholder="75.5"
                        suffix="kg"
                    />

                    <NumberInput
                        label="Horas de sueño"
                        value={diario.sueno}
                        onChangeText={(v) => updateDiario('sueno', v)}
                        placeholder="7.5"
                        suffix="h"
                    />

                    <MoodSelector
                        value={diario.animo}
                        onChange={(v) => updateDiario('animo', v)}
                    />

                    <ScaleSelector
                        label="Energía"
                        value={diario.energia}
                        onChange={(v) => updateDiario('energia', v)}
                        max={5}
                        labels={['Baja', 'Alta']}
                    />

                    <ScaleSelector
                        label="Hambre"
                        value={diario.hambre}
                        onChange={(v) => updateDiario('hambre', v)}
                        max={5}
                        labels={['Poca', 'Mucha']}
                    />

                    <NumberInput
                        label="Pasos"
                        value={diario.pasos}
                        onChangeText={(v) => updateDiario('pasos', v)}
                        placeholder="8000"
                    />

                    <TripleChoice
                        label="¿Hoy ha ido bien?"
                        value={diario.haIdoBien}
                        onChange={(v) => updateDiario('haIdoBien', v)}
                    />

                    <CommentInput
                        label="Nota opcional"
                        value={diario.nota}
                        onChangeText={(v) => updateDiario('nota', v)}
                        placeholder="Algo que quieras recordar..."
                    />

                    <TouchableOpacity style={styles.saveBtn} onPress={handleGuardarDiario}>
                        <Ionicons name="save-outline" size={20} color="#FFF" />
                        <Text style={styles.saveBtnText}>Guardar Diario</Text>
                    </TouchableOpacity>
                </ExpandableSection>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* SECCIÓN SEMANAL */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <ExpandableSection
                    title="Check-in Semanal 5min"
                    icon="📊"
                    expanded={semanalExpanded}
                    onToggle={() => setSemanalExpanded(!semanalExpanded)}
                    color="#3B82F6"
                >
                    {/* NUTRICIÓN */}
                    <SubsectionTitle title="Nutrición" icon="🍽️" />

                    <ScaleSelector
                        label="Adherencia a la dieta"
                        value={semanal.nutriAdherencia}
                        onChange={(v) => updateSemanal('nutriAdherencia', v)}
                        max={10}
                        labels={['Nada', 'Perfecto']}
                    />

                    <ScaleSelector
                        label="Saciedad general"
                        value={semanal.nutriSaciedad}
                        onChange={(v) => updateSemanal('nutriSaciedad', v)}
                        max={5}
                        labels={['Siempre hambre', 'Muy saciado']}
                    />

                    <ScaleSelector
                        label="Gastrointestinal"
                        value={semanal.nutriGI}
                        onChange={(v) => updateSemanal('nutriGI', v)}
                        max={5}
                        labels={['Mal', 'Perfecto']}
                    />

                    <ScaleSelector
                        label="Deposiciones"
                        value={semanal.nutriDeposiciones}
                        onChange={(v) => updateSemanal('nutriDeposiciones', v)}
                        max={5}
                        labels={['Mal', 'Regular']}
                    />

                    <NumberInput
                        label="Comidas libres"
                        value={semanal.nutriComidasLibres}
                        onChangeText={(v) => updateSemanal('nutriComidasLibres', v)}
                        placeholder="2"
                    />

                    <CommentInput
                        label="Comentario nutrición"
                        value={semanal.nutriComentario}
                        onChangeText={(v) => updateSemanal('nutriComentario', v)}
                        placeholder="¿Cómo te has sentido esta semana con la dieta?"
                    />

                    {/* ENTRENAMIENTO */}
                    <SubsectionTitle title="Entrenamiento" icon="💪" />

                    <ScaleSelector
                        label="Adherencia al plan"
                        value={semanal.entrenoAdherencia}
                        onChange={(v) => updateSemanal('entrenoAdherencia', v)}
                        max={10}
                        labels={['Nada', 'Todo']}
                    />

                    <ScaleSelector
                        label="Rendimiento"
                        value={semanal.entrenoRendimiento}
                        onChange={(v) => updateSemanal('entrenoRendimiento', v)}
                        max={10}
                        labels={['Muy bajo', 'Excelente']}
                    />

                    <ScaleSelector
                        label="Fatiga acumulada"
                        value={semanal.entrenoFatiga}
                        onChange={(v) => updateSemanal('entrenoFatiga', v)}
                        max={5}
                        labels={['Ninguna', 'Mucha']}
                    />

                    <View style={styles.toggleRow}>
                        <Text style={styles.inputLabel}>¿Molestias o lesión?</Text>
                        <TouchableOpacity
                            style={[
                                styles.toggleBtn,
                                semanal.entrenoMolestias && styles.toggleBtnActive
                            ]}
                            onPress={() => updateSemanal('entrenoMolestias', !semanal.entrenoMolestias)}
                        >
                            <Text style={styles.toggleBtnText}>
                                {semanal.entrenoMolestias ? 'Sí' : 'No'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {semanal.entrenoMolestias && (
                        <CommentInput
                            label="Describe la molestia"
                            value={semanal.entrenoMolestiasTexto}
                            onChangeText={(v) => updateSemanal('entrenoMolestiasTexto', v)}
                            placeholder="¿Qué zona? ¿Desde cuándo?"
                        />
                    )}

                    <CommentInput
                        label="Comentario entrenamiento"
                        value={semanal.entrenoComentario}
                        onChangeText={(v) => updateSemanal('entrenoComentario', v)}
                        placeholder="¿Cómo han ido los entrenos?"
                    />

                    {/* SENSACIONES */}
                    <SubsectionTitle title="Sensaciones" icon="🧠" />

                    <ScaleSelector
                        label="Motivación"
                        value={semanal.sensMotivacion}
                        onChange={(v) => updateSemanal('sensMotivacion', v)}
                        max={5}
                        labels={['Baja', 'Alta']}
                    />

                    <ScaleSelector
                        label="Estrés"
                        value={semanal.sensEstres}
                        onChange={(v) => updateSemanal('sensEstres', v)}
                        max={5}
                        labels={['Poco', 'Mucho']}
                    />

                    <ScaleSelector
                        label="Estado emocional"
                        value={semanal.sensEmocional}
                        onChange={(v) => updateSemanal('sensEmocional', v)}
                        max={5}
                        labels={['Mal', 'Genial']}
                    />

                    <NumberInput
                        label="Sueño medio"
                        value={semanal.sensSuenoMedio}
                        onChangeText={(v) => updateSemanal('sensSuenoMedio', v)}
                        placeholder="7"
                        suffix="h/noche"
                    />

                    <CommentInput
                        label="Comentario sensaciones"
                        value={semanal.sensComentario}
                        onChangeText={(v) => updateSemanal('sensComentario', v)}
                        placeholder="¿Cómo te has sentido en general?"
                    />

                    {/* REFLEXIÓN */}
                    <SubsectionTitle title="Reflexión" icon="💭" />

                    <CommentInput
                        label="🎯 Top 1 cosa a mejorar"
                        value={semanal.topMejorar}
                        onChangeText={(v) => updateSemanal('topMejorar', v)}
                        placeholder="¿Qué podrías hacer mejor la próxima semana?"
                    />

                    <CommentInput
                        label="🏆 Top 1 cosa que hice bien"
                        value={semanal.topBien}
                        onChangeText={(v) => updateSemanal('topBien', v)}
                        placeholder="¿De qué te sientes orgulloso/a?"
                    />

                    {/* MEDICIONES (Opcional) */}
                    <SubsectionTitle title="Mediciones (Opcional)" icon="📐" />

                    <View style={styles.measureRow}>
                        <MeasureInput label="Cuello" value={semanal.medCuello} onChangeText={(v) => updateSemanal('medCuello', v)} placeholder="38" />
                        <MeasureInput label="Hombros" value={semanal.medHombros} onChangeText={(v) => updateSemanal('medHombros', v)} placeholder="120" />
                    </View>
                    <View style={styles.measureRow}>
                        <MeasureInput label="Pecho" value={semanal.medPecho} onChangeText={(v) => updateSemanal('medPecho', v)} placeholder="100" />
                        <MeasureInput label="Cintura" value={semanal.medCintura} onChangeText={(v) => updateSemanal('medCintura', v)} placeholder="80" />
                    </View>
                    <View style={styles.measureRow}>
                        <MeasureInput label="Pierna" value={semanal.medPierna} onChangeText={(v) => updateSemanal('medPierna', v)} placeholder="60" />
                        <MeasureInput label="Gemelo" value={semanal.medGemelo} onChangeText={(v) => updateSemanal('medGemelo', v)} placeholder="38" />
                    </View>

                    <TouchableOpacity style={styles.saveBtn} onPress={handleGuardarSemanal}>
                        <Ionicons name="save-outline" size={20} color="#FFF" />
                        <Text style={styles.saveBtnText}>Guardar Semanal</Text>
                    </TouchableOpacity>
                </ExpandableSection>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* BOTONES ADICIONALES */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.feedbackBtn}>
                        <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFF" />
                        <Text style={styles.feedbackBtnText}>Feedback del Entrenador</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cameraBtn}
                        onPress={() => setCameraModalVisible(true)}
                    >
                        <Ionicons name="camera-outline" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* SECCIÓN NUTRICIÓN (Placeholder) */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <ExpandableSection
                    title="Nutrición"
                    icon="🍽️"
                    expanded={nutricionExpanded}
                    onToggle={() => setNutricionExpanded(!nutricionExpanded)}
                    color="#F59E0B"
                >
                    <View style={styles.placeholderContent}>
                        <Text style={styles.placeholderEmoji}>🚧</Text>
                        <Text style={styles.placeholderTitle}>Próximamente</Text>
                        <Text style={styles.placeholderText}>
                            Aquí encontrarás tu plan de nutrición personalizado,
                            recetas y seguimiento de macros.
                        </Text>
                    </View>
                </ExpandableSection>

                {/* Espaciado inferior */}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Modal Cámara - Building in Progress */}
            <Modal
                visible={cameraModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCameraModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Pressable
                            style={styles.modalClose}
                            onPress={() => setCameraModalVisible(false)}
                        >
                            <Ionicons name="close-circle" size={32} color="#9CA3AF" />
                        </Pressable>
                        <Text style={styles.modalEmoji}>🚧📷</Text>
                        <Text style={styles.modalTitle}>Building in Progress</Text>
                        <Text style={styles.modalText}>
                            La funcionalidad de fotos de progreso estará disponible próximamente.
                        </Text>
                        <TouchableOpacity
                            style={styles.modalBtn}
                            onPress={() => setCameraModalVisible(false)}
                        >
                            <Text style={styles.modalBtnText}>Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════

const CARD_BG = 'rgba(255,255,255,0.08)';
const BORDER = 'rgba(255,255,255,0.18)';

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    blob: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 160,
        opacity: 0.25,
        backgroundColor: '#3B82F6',
        filter: Platform.OS === 'web' ? 'blur(70px)' : undefined,
    },
    blobTop: { top: -40, left: -40 },
    blobBottom: { bottom: -30, right: -30, backgroundColor: '#10B981' },

    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        ...(Platform.OS === 'web' && {
            maxWidth: 600,
            alignSelf: 'center',
            width: '100%',
        }),
    },

    // Header
    header: {
        marginBottom: 24,
        alignItems: 'center',
    },
    headerTitle: {
        color: '#E5E7EB',
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    headerSubtitle: {
        color: '#9CA3AF',
        fontSize: 14,
    },

    // Accordion
    accordionContainer: {
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderColor: BORDER,
        overflow: 'hidden',
    },
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
        borderLeftWidth: 4,
    },
    accordionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    accordionIcon: {
        fontSize: 22,
    },
    accordionTitle: {
        color: '#E5E7EB',
        fontSize: 18,
        fontWeight: '700',
    },
    accordionContent: {
        padding: 18,
        paddingTop: 0,
    },

    // Section hint
    sectionHint: {
        color: '#9CA3AF',
        fontSize: 12,
        marginBottom: 16,
        textAlign: 'center',
        fontStyle: 'italic',
    },

    // Input Row
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 10,
    },
    inputLabel: {
        color: '#E5E7EB',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    numberInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#FFF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        fontSize: 16,
        minWidth: 70,
        textAlign: 'center',
    },
    inputSuffix: {
        color: '#9CA3AF',
        marginLeft: 8,
        fontSize: 14,
    },

    // Scale Selector
    scaleContainer: {
        marginBottom: 16,
    },
    scaleRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'flex-start',
    },
    scaleBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
        minWidth: 40,
        maxWidth: 50,
        alignItems: 'center',
    },
    scaleBtnActive: {
        backgroundColor: '#3B82F6',
    },
    scaleBtnText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
    },
    scaleBtnTextActive: {
        color: '#FFF',
    },
    scaleLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
        maxWidth: Platform.OS === 'web' ? 280 : '100%',
    },
    scaleLabelText: {
        color: '#6B7280',
        fontSize: 11,
    },

    // Mood Selector
    moodContainer: {
        marginBottom: 16,
    },
    moodRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    moodBtn: {
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        minWidth: 65,
        maxWidth: 90,
    },
    moodBtnActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    moodEmoji: {
        fontSize: 24,
        marginBottom: 4,
    },
    moodLabel: {
        color: '#9CA3AF',
        fontSize: 10,
    },
    moodLabelActive: {
        color: '#3B82F6',
        fontWeight: '600',
    },

    // Triple Choice
    tripleContainer: {
        marginBottom: 16,
    },
    tripleRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        flexWrap: 'wrap',
    },
    tripleBtn: {
        flex: 1,
        minWidth: 100,
        maxWidth: 180,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: BORDER,
    },
    tripleBtnText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
    },

    // Comment Input
    commentContainer: {
        marginBottom: 16,
    },
    commentInput: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        color: '#FFF',
        padding: 12,
        borderRadius: 10,
        fontSize: 14,
        minHeight: 60,
        textAlignVertical: 'top',
    },

    // Subsection
    subsectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 14,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    subsectionIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    subsectionTitle: {
        color: '#E5E7EB',
        fontSize: 16,
        fontWeight: '700',
    },

    // Toggle
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    toggleBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    toggleBtnActive: {
        backgroundColor: '#EF4444',
    },
    toggleBtnText: {
        color: '#FFF',
        fontWeight: '600',
    },

    // Measurements
    measureRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
        maxWidth: '100%',
    },
    measureItem: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 10,
    },
    measureLabel: {
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
    },
    measureInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    measureInput: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#FFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        fontSize: 16,
        textAlign: 'center',
        maxWidth: '80%',
    },
    measureSuffix: {
        color: '#6B7280',
        fontSize: 12,
        marginLeft: 6,
    },

    // Save Button
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10B981',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 16,
        gap: 8,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },

    // Action Buttons
    actionButtons: {
        flexDirection: 'row',
        marginTop: 8,
        marginBottom: 16,
        gap: 12,
    },
    feedbackBtn: {
        flex: 4, // 80%
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 10,
    },
    feedbackBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    cameraBtn: {
        flex: 1, // 20%
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F59E0B',
        paddingVertical: 16,
        borderRadius: 14,
    },

    // Placeholder
    placeholderContent: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    placeholderEmoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    placeholderTitle: {
        color: '#E5E7EB',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    placeholderText: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#374151',
    },
    modalClose: {
        position: 'absolute',
        top: 10,
        right: 10,
    },
    modalEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    modalTitle: {
        color: '#E5E7EB',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 10,
    },
    modalText: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    modalBtn: {
        backgroundColor: '#3B82F6',
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 10,
    },
    modalBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
