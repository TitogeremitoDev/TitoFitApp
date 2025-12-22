// components/CoachOnboardingModal.jsx
// Sistema de Onboarding con posiciones fijas para compatibilidad web

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
    Linking,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORAGE_KEY = 'coach_onboarding_completed';

// ═══════════════════════════════════════════════════════════════════════════
// PASOS DEL TUTORIAL con descripción del elemento
// ═══════════════════════════════════════════════════════════════════════════
const TUTORIAL_STEPS = [
    {
        title: '🔗 Tu Código de Entrenador',
        description: 'Mira arriba a la izquierda → Es tu código único. Compártelo con tus clientes para que se vinculen automáticamente.',
        icon: 'key',
        color: '#10b981',
        area: 'Arriba izquierda',
    },
    {
        title: '👥 Control de Clientes',
        description: 'Justo debajo del código → Ves cuántos clientes tienes vs tu límite. Pulsa "+" para ampliar.',
        icon: 'people-circle',
        color: '#3b82f6',
        area: 'Cabecera',
    },
    {
        title: '🎨 Tu Logo de Marca',
        description: 'A la derecha del nombre → Tus clientes verán TU logo en su app. ¡Profesionaliza tu imagen!',
        icon: 'image',
        color: '#ec4899',
        area: 'Arriba derecha',
    },
    {
        title: '👤 Perfil Profesional',
        description: 'Primera tarjeta del panel → Configura tu marca, logo, nombre y contacto.',
        icon: 'person',
        color: '#3b82f6',
        area: 'Panel de Control',
    },
    {
        title: '📋 Gestión de Clientes',
        description: 'Segunda tarjeta → Fichas, historial, progresos y pagos de todos tus atletas.',
        icon: 'people',
        color: '#10b981',
        area: 'Panel de Control',
    },
    {
        title: '📊 Análisis de Progreso',
        description: 'Tercera tarjeta → Gráficas claras para ver la evolución de cada cliente.',
        icon: 'stats-chart',
        color: '#ef4444',
        area: 'Panel de Control',
    },
    {
        title: '🥗 Planes Nutricionales',
        description: 'Tarjeta Nutrición → Crea y asigna dietas personalizadas.',
        icon: 'nutrition',
        color: '#22c55e',
        area: 'Panel de Control',
    },
    {
        title: '💪 Creador de Rutinas',
        description: 'Tarjeta Rutinas → Diseña entrenamientos en minutos y asígnalos al instante.',
        icon: 'barbell',
        color: '#f59e0b',
        area: 'Panel de Control',
    },
    {
        title: '📚 Base de Ejercicios',
        description: 'Tarjeta BD Ejercicios → Tu biblioteca personal con vídeos de técnica.',
        icon: 'library',
        color: '#667eea',
        area: 'Panel de Control',
    },
    {
        title: '🚀 Próximamente...',
        description: 'Nuevas funciones premium en desarrollo:',
        icon: 'rocket',
        color: '#8b5cf6',
        isFuture: true,
        futureFeatures: ['Videollamadas', 'Foros privados', 'Chat grupal', 'Facturación auto.'],
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function CoachOnboardingModal({ visible, onComplete, onSkip }) {
    const [phase, setPhase] = useState('welcome');
    const [step, setStep] = useState(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setPhase('welcome');
            setStep(0);
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        }
    }, [visible]);

    const animateChange = (cb) => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
            cb();
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        });
    };

    const startTutorial = () => animateChange(() => setPhase('tutorial'));
    const skipToEnd = () => animateChange(() => setPhase('farewell'));

    const nextStep = () => {
        if (step < TUTORIAL_STEPS.length - 1) {
            animateChange(() => setStep(step + 1));
        } else {
            animateChange(() => setPhase('final'));
        }
    };

    const prevStep = () => {
        if (step > 0) animateChange(() => setStep(step - 1));
    };

    const complete = async () => {
        try { await AsyncStorage.setItem(STORAGE_KEY, 'true'); } catch { }
        onComplete?.();
    };

    const skip = async () => {
        try { await AsyncStorage.setItem(STORAGE_KEY, 'true'); } catch { }
        onSkip?.();
    };

    const currentStep = TUTORIAL_STEPS[step];
    const progress = ((step + 1) / TUTORIAL_STEPS.length) * 100;

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={styles.overlay}>
                <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }]}>

                    {/* ════════════════════════ WELCOME ════════════════════════ */}
                    {phase === 'welcome' && (
                        <>
                            <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.iconBig}>
                                <Ionicons name="rocket" size={44} color="#fff" />
                            </LinearGradient>
                            <Text style={styles.title}>Bienvenido a TotalGain</Text>
                            <Text style={styles.subtitle}>Tu negocio de entrenamiento, al siguiente nivel</Text>

                            <View style={styles.benefitsList}>
                                {[
                                    { icon: 'people', color: '#10b981', text: 'Centraliza todos tus clientes' },
                                    { icon: 'flash', color: '#f59e0b', text: 'Automatiza tus rutinas' },
                                    { icon: 'trending-up', color: '#3b82f6', text: 'Escala tus ingresos' },
                                ].map((b, i) => (
                                    <View key={i} style={styles.benefitRow}>
                                        <View style={[styles.benefitDot, { backgroundColor: b.color }]}>
                                            <Ionicons name={b.icon} size={16} color="#fff" />
                                        </View>
                                        <Text style={styles.benefitText}>{b.text}</Text>
                                    </View>
                                ))}
                            </View>

                            <Text style={styles.question}>¿Tour rápido de 1 minuto?</Text>

                            <TouchableOpacity style={styles.btnPrimary} onPress={startTutorial}>
                                <LinearGradient colors={['#10b981', '#059669']} style={styles.btnGradient}>
                                    <Ionicons name="play" size={18} color="#fff" />
                                    <Text style={styles.btnText}>Sí, enséñame</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnSecondary} onPress={skipToEnd}>
                                <Text style={styles.btnSecondaryText}>Explorar por mi cuenta</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* ════════════════════════ TUTORIAL ════════════════════════ */}
                    {phase === 'tutorial' && (
                        <>
                            {/* Progress Bar */}
                            <View style={styles.progressRow}>
                                <View style={styles.progressBg}>
                                    <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: currentStep.color }]} />
                                </View>
                                <Text style={styles.progressText}>{step + 1}/{TUTORIAL_STEPS.length}</Text>
                            </View>

                            {/* Indicador de área */}
                            {currentStep.area && (
                                <View style={[styles.areaBadge, { backgroundColor: currentStep.color + '20' }]}>
                                    <Ionicons name="location" size={14} color={currentStep.color} />
                                    <Text style={[styles.areaBadgeText, { color: currentStep.color }]}>{currentStep.area}</Text>
                                </View>
                            )}

                            {/* Icon */}
                            <View style={[styles.iconMedium, { backgroundColor: currentStep.color + '15' }]}>
                                <Ionicons name={currentStep.icon} size={36} color={currentStep.color} />
                            </View>

                            <Text style={styles.stepTitle}>{currentStep.title}</Text>
                            <Text style={styles.stepDesc}>{currentStep.description}</Text>

                            {/* Future features chips */}
                            {currentStep.isFuture && currentStep.futureFeatures && (
                                <View style={styles.chipsRow}>
                                    {currentStep.futureFeatures.map((f, i) => (
                                        <View key={i} style={[styles.chip, { backgroundColor: currentStep.color + '15' }]}>
                                            <Text style={[styles.chipText, { color: currentStep.color }]}>{f}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Navigation */}
                            <View style={styles.navRow}>
                                {step > 0 ? (
                                    <TouchableOpacity style={styles.navBack} onPress={prevStep}>
                                        <Ionicons name="chevron-back" size={18} color="#64748b" />
                                        <Text style={styles.navBackText}>Atrás</Text>
                                    </TouchableOpacity>
                                ) : <View style={{ width: 80 }} />}

                                <TouchableOpacity onPress={nextStep}>
                                    <LinearGradient colors={[currentStep.color, currentStep.color + 'dd']} style={styles.navNext}>
                                        <Text style={styles.navNextText}>{step < TUTORIAL_STEPS.length - 1 ? 'Siguiente' : 'Finalizar'}</Text>
                                        <Ionicons name={step < TUTORIAL_STEPS.length - 1 ? 'chevron-forward' : 'checkmark'} size={18} color="#fff" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity onPress={() => animateChange(() => setPhase('final'))} style={styles.skipLink}>
                                <Text style={styles.skipLinkText}>Saltar tutorial</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* ════════════════════════ FAREWELL ════════════════════════ */}
                    {phase === 'farewell' && (
                        <>
                            <Text style={styles.emoji}>🎯</Text>
                            <Text style={styles.title}>¡Entendido!</Text>
                            <Text style={styles.subtitle}>Tienes el control total.</Text>

                            <View style={styles.reminderBox}>
                                <Ionicons name="information-circle" size={18} color="#3b82f6" />
                                <Text style={styles.reminderText}>
                                    Para repetir: <Text style={styles.bold}>Ajustes → Reiniciar Tutorial</Text>
                                </Text>
                            </View>

                            <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://totalgains.es/')}>
                                <Ionicons name="globe-outline" size={16} color="#3b82f6" />
                                <Text style={styles.linkText}>Más info en totalgains.es</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.btnClose} onPress={skip}>
                                <Text style={styles.btnCloseText}>¡Vamos allá!</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* ════════════════════════ FINAL ════════════════════════ */}
                    {phase === 'final' && (
                        <>
                            <Text style={styles.confetti}>🎉</Text>
                            <LinearGradient colors={['#10b981', '#059669']} style={styles.iconBig}>
                                <Ionicons name="checkmark-done" size={44} color="#fff" />
                            </LinearGradient>
                            <Text style={styles.title}>¡Ya estás listo!</Text>
                            <Text style={styles.subtitle}>Todo el poder para hacer crecer tu negocio.</Text>

                            <View style={styles.statsRow}>
                                <View style={styles.statBox}><Text style={styles.statNum}>∞</Text><Text style={styles.statLabel}>Potencial</Text></View>
                                <View style={styles.statDivider} />
                                <View style={styles.statBox}><Text style={styles.statNum}>24/7</Text><Text style={styles.statLabel}>Acceso</Text></View>
                                <View style={styles.statDivider} />
                                <View style={styles.statBox}><Text style={styles.statNum}>Pro</Text><Text style={styles.statLabel}>Nivel</Text></View>
                            </View>

                            <View style={styles.reminderBox}>
                                <Ionicons name="refresh-circle" size={16} color="#64748b" />
                                <Text style={styles.reminderTextSmall}>Repetir tutorial: <Text style={styles.bold}>Ajustes</Text></Text>
                            </View>

                            <TouchableOpacity style={styles.btnPrimary} onPress={() => Linking.openURL('https://totalgains.es/')}>
                                <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.btnGradient}>
                                    <Ionicons name="globe" size={18} color="#fff" />
                                    <Text style={styles.btnText}>Más info en totalgains.es</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.startLink} onPress={complete}>
                                <Text style={styles.startLinkText}>Empezar a usar mi panel</Text>
                                <Ionicons name="arrow-forward" size={16} color="#10b981" />
                            </TouchableOpacity>
                        </>
                    )}

                </Animated.View>
            </View>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
export async function resetCoachOnboarding() {
    try { await AsyncStorage.removeItem(STORAGE_KEY); return true; } catch { return false; }
}

export async function hasCompletedCoachOnboarding() {
    try { return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true'; } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 28,
        width: '100%',
        maxWidth: 420,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 20,
    },

    // Icons
    iconBig: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    iconMedium: { width: 72, height: 72, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },

    // Titles
    title: { fontSize: 26, fontWeight: '800', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 20 },
    question: { fontSize: 16, color: '#1e293b', fontWeight: '600', textAlign: 'center', marginBottom: 20 },
    emoji: { fontSize: 64, marginBottom: 16 },
    confetti: { position: 'absolute', top: 16, right: 24, fontSize: 36 },

    // Benefits
    benefitsList: { width: '100%', marginBottom: 24, gap: 12 },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    benefitDot: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    benefitText: { fontSize: 15, color: '#475569', fontWeight: '500' },

    // Buttons
    btnPrimary: { width: '100%', marginBottom: 12 },
    btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, gap: 10 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    btnSecondary: { padding: 14 },
    btnSecondaryText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
    btnClose: { backgroundColor: '#10b981', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 14 },
    btnCloseText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Tutorial
    progressRow: { width: '100%', flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
    progressBg: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    progressText: { fontSize: 13, color: '#64748b', fontWeight: '700' },

    areaBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginBottom: 16, gap: 6 },
    areaBadgeText: { fontSize: 12, fontWeight: '700' },

    stepTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', textAlign: 'center', marginBottom: 10 },
    stepDesc: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 20 },

    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 },
    chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
    chipText: { fontSize: 13, fontWeight: '600' },

    navRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    navBack: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 4 },
    navBackText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
    navNext: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, gap: 8 },
    navNextText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    skipLink: { padding: 10 },
    skipLinkText: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },

    // Reminder
    reminderBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', padding: 14, borderRadius: 12, marginBottom: 16, gap: 10, width: '100%' },
    reminderText: { flex: 1, fontSize: 14, color: '#475569' },
    reminderTextSmall: { flex: 1, fontSize: 13, color: '#64748b' },
    bold: { color: '#3b82f6', fontWeight: '700' },

    linkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 },
    linkText: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },

    // Stats
    statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, paddingVertical: 20, paddingHorizontal: 24, marginBottom: 16, width: '100%', justifyContent: 'space-around' },
    statBox: { alignItems: 'center' },
    statNum: { fontSize: 24, fontWeight: '800', color: '#10b981', marginBottom: 4 },
    statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    statDivider: { width: 1, height: 36, backgroundColor: '#e2e8f0' },

    startLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 8 },
    startLinkText: { color: '#10b981', fontSize: 16, fontWeight: '700' },
});
