/* app/(app)/perfil/tutoriales.jsx
   ────────────────────────────────────────────────────────────────────────
   Pantalla de Tutoriales - Centro de ayuda con tutoriales de la app
   - Tutorial del sistema de entrenamiento (mismo modal de entreno.jsx)
   - Videos guía de YouTube (próximamente)
   ──────────────────────────────────────────────────────────────────────── */

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    Image,
    TextInput,
    Dimensions,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/* ───────── 🎓 TUTORIAL/ONBOARDING MODAL (copiado de entreno.jsx) ───────── */
const TOTAL_TUTORIAL_SLIDES = 5;

function TutorialEntrenoModal({ visible, onComplete }) {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const [currentSlide, setCurrentSlide] = useState(0);
    const scrollViewRef = useRef(null);

    // Estados para el tutorial interactivo
    const [tutorialReps, setTutorialReps] = useState('');
    const [tutorialKg, setTutorialKg] = useState('');

    // Reset slide cuando se abre el modal
    useEffect(() => {
        if (visible) {
            setCurrentSlide(0);
            setTutorialReps('');
            setTutorialKg('');
            scrollViewRef.current?.scrollTo({ x: 0, animated: false });
        }
    }, [visible]);

    // Calcular color del fondo según rango 8-12
    const getTutorialBgColor = () => {
        const repsNum = Number(tutorialReps);
        if (tutorialReps === '' || isNaN(repsNum)) return theme.cardBackground;
        if (repsNum < 8) return '#fecaca'; // rojo - por debajo
        if (repsNum > 12) return '#bfdbfe'; // azul - supera
        return '#bbf7d0'; // verde - en rango
    };

    const goToSlide = (index) => {
        if (index < 0 || index >= TOTAL_TUTORIAL_SLIDES) return;
        setCurrentSlide(index);
        scrollViewRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    };

    const handleScroll = (event) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const newIndex = Math.round(offsetX / screenWidth);
        if (newIndex !== currentSlide && newIndex >= 0 && newIndex < TOTAL_TUTORIAL_SLIDES) {
            setCurrentSlide(newIndex);
        }
    };

    const getCoachMessage = () => {
        switch (currentSlide) {
            case 0: return "¡Bienvenido, recluta! Soy tu coach. Aquí no venimos a jugar, venimos a subir de nivel.";
            case 1: return "Esto nos ayudara a medir tu progreso y tu evolucion. Sin excusas.";
            case 2: return "¡Eso es! Practica aquí. El color te indica si vas bien. ¡Simple!";
            case 3: return "Cada repetición que hagas tiene significado. El sistema analiza todo.";
            case 4: return "Ya tienes las herramientas. Ahora solo falta tu sudor. ¿Estás listo?";
            default: return "A entrenar.";
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={currentSlide === TOTAL_TUTORIAL_SLIDES - 1 ? onComplete : undefined}
        >
            <View style={[tutorialStyles.container, { backgroundColor: theme.background }]}>
                {/* Efectos de fondo */}
                <View style={[tutorialStyles.bgGradientTop, { backgroundColor: theme.primary + '10' }]} />
                <View style={[tutorialStyles.bgGradientBottom, { backgroundColor: theme.success + '10' }]} />

                {/* Header con botón cerrar */}
                <View style={[tutorialStyles.header, { paddingTop: insets.top + 10 }]}>
                    <TouchableOpacity
                        onPress={onComplete}
                        style={[tutorialStyles.closeButton, { backgroundColor: theme.iconButton }]}
                    >
                        <Ionicons name="close" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[tutorialStyles.headerTitle, { color: theme.text }]}>Tutorial de Entrenamiento</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Barra de progreso */}
                <View style={tutorialStyles.progressBar}>
                    {Array.from({ length: TOTAL_TUTORIAL_SLIDES }).map((_, idx) => (
                        <View
                            key={idx}
                            style={[
                                tutorialStyles.progressSegment,
                                {
                                    backgroundColor: idx <= currentSlide ? theme.primary : theme.border,
                                },
                            ]}
                        />
                    ))}
                </View>

                {/* Contenido de slides */}
                <ScrollView
                    ref={scrollViewRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    style={tutorialStyles.slidesContainer}
                >
                    {/* SLIDE 1: BIENVENIDA */}
                    <View style={[tutorialStyles.slide, { width: screenWidth }]}>
                        <View style={tutorialStyles.slideContent}>
                            <View style={tutorialStyles.logoContainer}>
                                <Image
                                    source={require('../../../assets/logo.png')}
                                    style={tutorialStyles.logo}
                                    resizeMode="contain"
                                />
                            </View>

                            <Text style={[tutorialStyles.mainTitle, { color: theme.text }]}>
                                SISTEMA{'\n'}
                                <Text style={{ color: theme.primary }}>TOTALGAINS</Text>
                            </Text>
                            <Text style={[tutorialStyles.subtitle, { color: theme.textSecondary }]}>
                                Tu progreso, medido al milímetro.
                            </Text>

                            <TouchableOpacity
                                style={[tutorialStyles.startButton, { backgroundColor: theme.primary }]}
                                onPress={() => goToSlide(1)}
                                activeOpacity={0.85}
                            >
                                <Text style={tutorialStyles.startButtonText}>INICIAR TUTORIAL</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {/* SLIDE 2: TUTORIAL INTERACTIVO - Rellena tus primeros datos */}
                    <View style={[tutorialStyles.slide, { width: screenWidth }]}>
                        <ScrollView style={tutorialStyles.slideScroll} showsVerticalScrollIndicator={false}>
                            <View style={tutorialStyles.slideContent}>
                                <Ionicons name="create-outline" size={48} color={theme.primary} style={{ alignSelf: 'center', marginBottom: 16 }} />
                                <Text style={[tutorialStyles.slideTitle, { color: theme.text, textAlign: 'center' }]}>
                                    Rellena tus{'\n'}primeros datos
                                </Text>
                                <Text style={[tutorialStyles.slideDescription, { color: theme.textSecondary, textAlign: 'center' }]}>
                                    Prueba cómo funciona el sistema de colores. Introduce tus repeticiones y observa el cambio.
                                </Text>

                                {/* Tarjeta de ejercicio simulado */}
                                <View style={[tutorialStyles.interactiveCard, {
                                    backgroundColor: theme.cardBackground,
                                    borderColor: theme.cardBorder
                                }]}>
                                    {/* Header del ejercicio */}
                                    <View style={[tutorialStyles.interactiveHeader, { borderColor: theme.cardBorder }]}>
                                        <Text style={[tutorialStyles.interactiveExerciseName, { color: theme.text }]}>
                                            Pecho — Press Banca
                                        </Text>
                                    </View>

                                    {/* Fila de Serie */}
                                    <View style={[tutorialStyles.interactiveSerieRow, {
                                        backgroundColor: getTutorialBgColor(),
                                        borderColor: theme.border
                                    }]}>
                                        {/* Etiqueta Serie + Rango */}
                                        <View style={tutorialStyles.interactiveSerieLabel}>
                                            <Text style={{ fontSize: 12, color: theme.textSecondary }}>Serie 1</Text>
                                            <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>8-12</Text>
                                        </View>

                                        {/* Input Reps */}
                                        <View style={tutorialStyles.interactiveInputCol}>
                                            <Text style={[tutorialStyles.interactiveColLabel, { color: theme.textSecondary }]}>Reps</Text>
                                            <TextInput
                                                style={[tutorialStyles.interactiveInput, {
                                                    borderColor: theme.inputBorder,
                                                    backgroundColor: theme.inputBackground,
                                                    color: theme.inputText
                                                }]}
                                                placeholder="10"
                                                placeholderTextColor={theme.placeholder}
                                                keyboardType="numeric"
                                                value={tutorialReps}
                                                onChangeText={setTutorialReps}
                                            />
                                        </View>

                                        {/* Input Kg */}
                                        <View style={tutorialStyles.interactiveInputCol}>
                                            <Text style={[tutorialStyles.interactiveColLabel, { color: theme.textSecondary }]}>Kg</Text>
                                            <TextInput
                                                style={[tutorialStyles.interactiveInput, {
                                                    borderColor: theme.inputBorder,
                                                    backgroundColor: theme.inputBackground,
                                                    color: theme.inputText
                                                }]}
                                                placeholder="60"
                                                placeholderTextColor={theme.placeholder}
                                                keyboardType="numeric"
                                                value={tutorialKg}
                                                onChangeText={setTutorialKg}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Leyenda de colores */}
                                <View style={[tutorialStyles.colorLegend, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                                    <Text style={[tutorialStyles.colorLegendTitle, { color: theme.text }]}>Lógica de colores:</Text>

                                    <View style={tutorialStyles.colorLegendRow}>
                                        <View style={[tutorialStyles.colorDot, { backgroundColor: '#fecaca' }]} />
                                        <Text style={[tutorialStyles.colorLegendText, { color: theme.textSecondary }]}>
                                            Rojo: por debajo del rango (menos de 8)
                                        </Text>
                                    </View>

                                    <View style={tutorialStyles.colorLegendRow}>
                                        <View style={[tutorialStyles.colorDot, { backgroundColor: '#bbf7d0' }]} />
                                        <Text style={[tutorialStyles.colorLegendText, { color: theme.textSecondary }]}>
                                            Verde: en el rango (8-12)
                                        </Text>
                                    </View>

                                    <View style={tutorialStyles.colorLegendRow}>
                                        <View style={[tutorialStyles.colorDot, { backgroundColor: '#bfdbfe' }]} />
                                        <Text style={[tutorialStyles.colorLegendText, { color: theme.textSecondary }]}>
                                            Azul: supera el rango (más de 12)
                                        </Text>
                                    </View>
                                </View>

                                <Text style={[tutorialStyles.slideDescription, { color: theme.textSecondary, marginTop: 16, textAlign: 'center', fontStyle: 'italic' }]}>
                                    ¡Prueba escribiendo diferentes números de repeticiones! {'\n'}
                                    ¡Cada semana lucharas contra tu yo anterior!
                                </Text>
                            </View>
                        </ScrollView>
                    </View>

                    {/* SLIDE 3: LOS BOTONES - Versión equilibrada */}
                    <View style={[tutorialStyles.slide, { width: screenWidth }]}>
                        <ScrollView style={tutorialStyles.slideScroll} showsVerticalScrollIndicator={false}>
                            <View style={[tutorialStyles.slideContent, { paddingBottom: 140 }]}>
                                <Text style={[tutorialStyles.slideTitle, { color: theme.text, fontSize: 26, marginBottom: 6 }]}>
                                    Lógica del Sistema
                                </Text>
                                <Text style={[tutorialStyles.slideDescription, { color: theme.textSecondary, marginBottom: 16, fontSize: 14 }]}>
                                    Cada serie se clasifica con uno de estos estados:
                                </Text>

                                {/* Cards estados - en fila horizontal con más info */}
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                                    {/* C */}
                                    <View style={[tutorialStyles.miniCard, { backgroundColor: theme.success + '20', borderColor: theme.success + '40', flex: 1, paddingVertical: 16 }]}>
                                        <Ionicons name="checkmark-circle" size={28} color={theme.success} />
                                        <Text style={[tutorialStyles.miniCardTitle, { color: theme.success }]}>C</Text>
                                        <Text style={[tutorialStyles.miniCardSubtitle, { color: theme.textSecondary }]}>Completado</Text>
                                    </View>
                                    {/* NC */}
                                    <View style={[tutorialStyles.miniCard, { backgroundColor: '#ef4444' + '20', borderColor: '#ef4444' + '40', flex: 1, paddingVertical: 16 }]}>
                                        <Ionicons name="close-circle" size={28} color="#ef4444" />
                                        <Text style={[tutorialStyles.miniCardTitle, { color: '#ef4444' }]}>NC</Text>
                                        <Text style={[tutorialStyles.miniCardSubtitle, { color: theme.textSecondary }]}>No Completado</Text>
                                    </View>
                                    {/* OE */}
                                    <View style={[tutorialStyles.miniCard, { backgroundColor: '#f59e0b' + '20', borderColor: '#f59e0b' + '40', flex: 1, paddingVertical: 16 }]}>
                                        <Ionicons name="swap-horizontal" size={28} color="#f59e0b" />
                                        <Text style={[tutorialStyles.miniCardTitle, { color: '#f59e0b' }]}>OE</Text>
                                        <Text style={[tutorialStyles.miniCardSubtitle, { color: theme.textSecondary }]}>Otro Ejercicio</Text>
                                    </View>
                                </View>

                                {/* Descripción breve de estados */}
                                <Text style={{ color: theme.textSecondary, fontSize: 18, marginBottom: 20, lineHeight: 18, fontWeight: '600', paddingVertical: 20 }}>
                                    C = Guardas datos y sumas progreso{'\n'}
                                    NC = No se guarda, repites la próxima semana{'\n'}
                                    OE = Cambiaste de ejercicio por algún motivo
                                </Text>

                                {/* Separador visual */}
                                <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 16 }} />

                                {/* Título herramientas */}
                                <Text style={[tutorialStyles.slideDescription, { color: theme.textSecondary, marginBottom: 12, fontSize: 14 }]}>
                                    Cada ejercicio tiene botones de ayuda:
                                </Text>

                                {/* Botones de ayuda en fila */}
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    {/* TC */}
                                    <View style={[tutorialStyles.miniCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, flex: 1, paddingVertical: 14 }]}>
                                        <View style={{ backgroundColor: theme.backgroundTertiary, padding: 8, borderRadius: 8 }}>
                                            <Text style={{ fontWeight: '800', fontSize: 13, color: theme.text }}>TC</Text>
                                        </View>
                                        <Text style={[tutorialStyles.miniCardSubtitle, { color: theme.textSecondary }]}>Técnica</Text>
                                    </View>
                                    {/* Imagen */}
                                    <View style={[tutorialStyles.miniCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, flex: 1, paddingVertical: 14 }]}>
                                        <View style={{ backgroundColor: theme.backgroundTertiary, padding: 8, borderRadius: 8 }}>
                                            <Text style={{ fontSize: 16 }}>🖼️</Text>
                                        </View>
                                        <Text style={[tutorialStyles.miniCardSubtitle, { color: theme.textSecondary }]}>Imagen</Text>
                                    </View>
                                    {/* Video */}
                                    <View style={[tutorialStyles.miniCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, flex: 1, paddingVertical: 14 }]}>
                                        <View style={{ backgroundColor: theme.backgroundTertiary, padding: 8, borderRadius: 8 }}>
                                            <Ionicons name="videocam" size={18} color={theme.text} />
                                        </View>
                                        <Text style={[tutorialStyles.miniCardSubtitle, { color: theme.textSecondary }]}>Video</Text>
                                    </View>
                                </View>

                                {/* Descripción breve herramientas */}
                                <Text style={{ color: theme.textSecondary, fontSize: 20, textAlign: 'center', marginTop: 8, lineHeight: 18, fontWeight: '600' }}>
                                    Ver tips de técnica, fotos del ejercicio o video tutorial
                                </Text>
                            </View>
                        </ScrollView>
                    </View>



                    {/* SLIDE 4: TUS DATOS */}
                    <View style={[tutorialStyles.slide, { width: screenWidth }]}>
                        <ScrollView style={tutorialStyles.slideScroll} showsVerticalScrollIndicator={false}>
                            <View style={tutorialStyles.slideContent}>
                                <Ionicons name="analytics" size={48} color={theme.primary} style={{ alignSelf: 'center', marginBottom: 16 }} />
                                <Text style={[tutorialStyles.slideTitle, { color: theme.text, textAlign: 'center' }]}>
                                    Tus Datos Cuentan
                                </Text>
                                <Text style={[tutorialStyles.slideDescription, { color: theme.textSecondary }]}>
                                    Cada vez que entrenes, el sistema guardará:
                                </Text>

                                <View style={[tutorialStyles.dataCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                                    <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                                    <Text style={[tutorialStyles.dataText, { color: theme.text }]}>Repeticiones por serie</Text>
                                </View>

                                <View style={[tutorialStyles.dataCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                                    <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                                    <Text style={[tutorialStyles.dataText, { color: theme.text }]}>Peso levantado</Text>
                                </View>

                                <View style={[tutorialStyles.dataCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                                    <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                                    <Text style={[tutorialStyles.dataText, { color: theme.text }]}>Volumen total</Text>
                                </View>

                                <View style={[tutorialStyles.dataCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                                    <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                                    <Text style={[tutorialStyles.dataText, { color: theme.text }]}>1RM estimado</Text>
                                </View>

                                <Text style={[tutorialStyles.slideDescription, { color: theme.textSecondary, marginTop: 24, textAlign: 'center' }]}>
                                    Podrás ver tu evolución completa en tu perfil en la sección de evolución.
                                </Text>
                            </View>
                        </ScrollView>
                    </View>

                    {/* SLIDE 5: MOTIVACIÓN FINAL */}
                    <View style={[tutorialStyles.slide, { width: screenWidth }]}>
                        <View style={tutorialStyles.slideContent}>
                            <View style={tutorialStyles.finalImageContainer}>
                                <Image
                                    source={require('../../../assets/images/fitness/IMAGEN1.jpg')}
                                    style={tutorialStyles.finalImage}
                                    resizeMode="cover"
                                />
                                <View style={tutorialStyles.finalImageOverlay} />
                                <Text style={tutorialStyles.finalImageText}>
                                    NOFUN{'\n'}
                                    <Text style={tutorialStyles.finalImageTextAccent}>NOGAIN</Text>
                                </Text>
                            </View>

                            <Text style={[tutorialStyles.finalText, { color: theme.text }]}>
                                El sistema está listo. El camino está marcado. Lo único que falta es tu voluntad.
                            </Text>

                            {/* Nota de recordatorio */}
                            <View style={[tutorialStyles.reminderNote, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                                <Ionicons name="information-circle" size={18} color={theme.primary} />
                                <Text style={[tutorialStyles.reminderText, { color: theme.primary }]}>
                                    Puedes volver a ver este tutorial desde Ajustes → Tutoriales
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={[tutorialStyles.finalButton, { backgroundColor: theme.success }]}
                                onPress={onComplete}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="trophy" size={28} color="#fff" />
                                <Text style={tutorialStyles.finalButtonText}>¡A DARLE CAÑA!</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>

                {/* Profesor Coach (fijo abajo) */}
                <View style={[tutorialStyles.coachContainer, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
                    <View style={tutorialStyles.coachContent}>
                        <View style={tutorialStyles.coachAvatarContainer}>
                            <View style={[tutorialStyles.coachAvatarGlow, { backgroundColor: theme.primary + '20' }]} />
                            <Image
                                source={require('../../../assets/images/fitness/IMAGEN1.jpg')}
                                style={tutorialStyles.coachAvatar}
                                resizeMode="cover"
                            />
                        </View>

                        <View style={[tutorialStyles.coachBubble, {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder
                        }]}>
                            <Text style={[tutorialStyles.coachText, { color: theme.text }]}>
                                {getCoachMessage()}
                            </Text>
                        </View>
                    </View>

                    {/* Navegación */}
                    <View style={tutorialStyles.navigation}>
                        <TouchableOpacity
                            onPress={() => goToSlide(currentSlide - 1)}
                            disabled={currentSlide === 0}
                            style={[
                                tutorialStyles.navButton,
                                { backgroundColor: theme.iconButton },
                                currentSlide === 0 && tutorialStyles.navButtonDisabled
                            ]}
                        >
                            <Ionicons
                                name="chevron-back"
                                size={24}
                                color={currentSlide === 0 ? theme.border : theme.text}
                            />
                        </TouchableOpacity>

                        <Text style={[tutorialStyles.navCounter, { color: theme.textSecondary }]}>
                            {currentSlide + 1} / {TOTAL_TUTORIAL_SLIDES}
                        </Text>

                        <TouchableOpacity
                            onPress={() => currentSlide === TOTAL_TUTORIAL_SLIDES - 1 ? onComplete() : goToSlide(currentSlide + 1)}
                            style={[tutorialStyles.navButton, { backgroundColor: theme.primary }]}
                        >
                            <Ionicons
                                name={currentSlide === TOTAL_TUTORIAL_SLIDES - 1 ? "checkmark" : "chevron-forward"}
                                size={24}
                                color="#fff"
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

/* ───────── Estilos del Tutorial Modal ───────── */
const tutorialStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bgGradientTop: {
        position: 'absolute',
        top: -100,
        left: 0,
        width: '100%',
        height: 300,
        borderRadius: 9999,
        opacity: 0.3,
    },
    bgGradientBottom: {
        position: 'absolute',
        bottom: -100,
        right: 0,
        width: '100%',
        height: 300,
        borderRadius: 9999,
        opacity: 0.3,
    },
    progressBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        gap: 8,
    },
    progressSegment: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    slidesContainer: {
        flex: 1,
    },
    slide: {
        flex: 1,
    },
    slideScroll: {
        flex: 1,
    },
    slideContent: {
        flex: 1,
        padding: 20,
        paddingBottom: 140,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 20,
    },
    logo: {
        width: 160,
        height: 160,
        borderRadius: 80,
    },
    mainTitle: {
        fontSize: 36,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 32,
        fontWeight: '600',
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
    startButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    slideTitle: {
        fontSize: 28,
        fontWeight: '900',
        marginBottom: 12,
    },
    slideDescription: {
        fontSize: 15,
        marginBottom: 24,
        lineHeight: 22,
    },
    interactiveCard: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 16,
    },
    interactiveHeader: {
        padding: 14,
        borderBottomWidth: 1,
    },
    interactiveExerciseName: {
        fontSize: 15,
        fontWeight: '700',
    },
    interactiveSerieRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12,
        borderRadius: 8,
        margin: 8,
    },
    interactiveSerieLabel: {
        alignItems: 'center',
        minWidth: 50,
    },
    interactiveInputCol: {
        flex: 1,
        alignItems: 'center',
    },
    interactiveColLabel: {
        fontSize: 11,
        marginBottom: 4,
        fontWeight: '600',
    },
    interactiveInput: {
        width: '100%',
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
    },
    colorLegend: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    colorLegendTitle: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 12,
    },
    colorLegendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    colorDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    colorLegendText: {
        fontSize: 13,
        flex: 1,
    },
    miniCard: {
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        gap: 6,
    },
    miniCardTitle: {
        fontSize: 20,
        fontWeight: '900',
    },
    miniCardSubtitle: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
    },
    dataCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
    },
    dataText: {
        fontSize: 15,
        fontWeight: '600',
    },
    finalImageContainer: {
        width: '100%',
        height: 180,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 24,
        position: 'relative',
    },
    finalImage: {
        width: '100%',
        height: '100%',
    },
    finalImageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    finalImageText: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        color: '#fff',
        fontSize: 32,
        fontWeight: '900',
        lineHeight: 36,
    },
    finalImageTextAccent: {
        color: '#10b981',
    },
    finalText: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 16,
        fontWeight: '600',
        lineHeight: 24,
    },
    reminderNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 24,
    },
    reminderText: {
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },
    finalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 18,
        paddingHorizontal: 40,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
    finalButtonText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    coachContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    coachContent: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        marginBottom: 10,
    },
    coachAvatarContainer: {
        position: 'relative',
        width: 52,
        height: 52,
    },
    coachAvatarGlow: {
        position: 'absolute',
        inset: 0,
        borderRadius: 26,
        opacity: 0.3,
    },
    coachAvatar: {
        width: 52,
        height: 52,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#334155',
    },
    coachBubble: {
        flex: 1,
        padding: 10,
        borderRadius: 14,
        borderTopLeftRadius: 4,
        borderWidth: 1,
    },
    coachText: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
    },
    navigation: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    navButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navButtonDisabled: {
        opacity: 0.3,
    },
    navCounter: {
        fontSize: 14,
        fontWeight: '800',
    },
});

/* ───────── Pantalla Principal de Tutoriales ───────── */
export default function TutorialesScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [showEntrenoTutorial, setShowEntrenoTutorial] = useState(false);

    // Lista de tutoriales disponibles
    const tutoriales = [
        {
            id: 'entreno',
            title: 'Sistema de Entrenamiento',
            description: 'Aprende cómo funciona el registro de series, repeticiones y el sistema de colores',
            icon: 'barbell-outline',
            color: '#10b981',
            type: 'modal', // Abre el modal
        },
        {
            id: 'rutinas',
            title: 'Gestión de Rutinas',
            description: 'Cómo crear, editar y organizar tus rutinas de entrenamiento',
            icon: 'calendar-outline',
            color: '#3b82f6',
            type: 'video',
            videoId: null, // Próximamente
        },
        {
            id: 'progreso',
            title: 'Seguimiento de Progreso',
            description: 'Visualiza tu evolución con gráficos y estadísticas detalladas',
            icon: 'trending-up-outline',
            color: '#8b5cf6',
            type: 'video',
            videoId: null, // Próximamente
        },
        {
            id: 'logros',
            title: 'Sistema de Logros',
            description: 'Desbloquea logros mientras entrenas y gana puntos',
            icon: 'trophy-outline',
            color: '#f59e0b',
            type: 'video',
            videoId: null, // Próximamente
        },
        {
            id: 'nutricion',
            title: 'Plan Nutricional',
            description: 'Configura y gestiona tu plan de comidas',
            icon: 'nutrition-outline',
            color: '#ef4444',
            type: 'video',
            videoId: null, // Próximamente
        },
    ];

    const handleTutorialPress = (tutorial) => {
        if (tutorial.type === 'modal' && tutorial.id === 'entreno') {
            setShowEntrenoTutorial(true);
        } else if (tutorial.type === 'video' && tutorial.videoId) {
            // Abrir video de YouTube
            Linking.openURL(`https://www.youtube.com/watch?v=${tutorial.videoId}`);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={[styles.backButton, { backgroundColor: theme.iconButton }]}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Tutoriales</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
            >
                {/* Intro */}
                <View style={[styles.introCard, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                    <Ionicons name="school-outline" size={32} color={theme.primary} />
                    <Text style={[styles.introTitle, { color: theme.text }]}>Centro de Ayuda</Text>
                    <Text style={[styles.introText, { color: theme.textSecondary }]}>
                        Aprende a usar todas las funciones de TotalGains con estos tutoriales interactivos y videos guía.
                    </Text>
                </View>

                {/* Lista de Tutoriales */}
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Tutoriales Disponibles</Text>

                {tutoriales.map((tutorial, index) => {
                    const isAvailable = tutorial.type === 'modal' || (tutorial.type === 'video' && tutorial.videoId);

                    return (
                        <TouchableOpacity
                            key={tutorial.id}
                            style={[
                                styles.tutorialCard,
                                {
                                    backgroundColor: theme.cardBackground,
                                    borderColor: theme.cardBorder,
                                    opacity: isAvailable ? 1 : 0.6,
                                }
                            ]}
                            onPress={() => handleTutorialPress(tutorial)}
                            disabled={!isAvailable}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.tutorialIcon, { backgroundColor: tutorial.color + '20' }]}>
                                <Ionicons name={tutorial.icon} size={28} color={tutorial.color} />
                            </View>

                            <View style={styles.tutorialContent}>
                                <View style={styles.tutorialHeader}>
                                    <Text style={[styles.tutorialTitle, { color: theme.text }]}>{tutorial.title}</Text>
                                    {!isAvailable && (
                                        <View style={[styles.comingSoonBadge, { backgroundColor: theme.primary + '20' }]}>
                                            <Text style={[styles.comingSoonText, { color: theme.primary }]}>Próximamente</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.tutorialDescription, { color: theme.textSecondary }]}>
                                    {tutorial.description}
                                </Text>

                                {/* Tipo de tutorial */}
                                <View style={styles.tutorialMeta}>
                                    <View style={[styles.tutorialType, { backgroundColor: theme.backgroundSecondary }]}>
                                        <Ionicons
                                            name={tutorial.type === 'modal' ? 'book-outline' : 'play-circle-outline'}
                                            size={14}
                                            color={theme.textSecondary}
                                        />
                                        <Text style={[styles.tutorialTypeText, { color: theme.textSecondary }]}>
                                            {tutorial.type === 'modal' ? 'Tutorial Interactivo' : 'Video Guía'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <Ionicons
                                name={isAvailable ? "chevron-forward" : "lock-closed"}
                                size={20}
                                color={theme.textSecondary}
                            />
                        </TouchableOpacity>
                    );
                })}

                {/* Nota Final */}
                <View style={[styles.noteCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                    <Ionicons name="bulb-outline" size={24} color={theme.primary} />
                    <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                        Estamos trabajando para añadir más tutoriales en video. ¡Mantente atento a las actualizaciones!
                    </Text>
                </View>
            </ScrollView>

            {/* Modal del Tutorial de Entrenamiento */}
            <TutorialEntrenoModal
                visible={showEntrenoTutorial}
                onComplete={() => setShowEntrenoTutorial(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    introCard: {
        alignItems: 'center',
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 24,
    },
    introTitle: {
        fontSize: 20,
        fontWeight: '800',
        marginTop: 12,
        marginBottom: 8,
    },
    introText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    tutorialCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 12,
        gap: 14,
    },
    tutorialIcon: {
        width: 56,
        height: 56,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tutorialContent: {
        flex: 1,
    },
    tutorialHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    tutorialTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    comingSoonBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    comingSoonText: {
        fontSize: 10,
        fontWeight: '700',
    },
    tutorialDescription: {
        fontSize: 12,
        lineHeight: 16,
        marginBottom: 8,
    },
    tutorialMeta: {
        flexDirection: 'row',
    },
    tutorialType: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    tutorialTypeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    noteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 8,
    },
    noteText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
});
