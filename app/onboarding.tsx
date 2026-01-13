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
    Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Estado para el código de invitación universal (legacy, mantenemos por compatibilidad)
    const [invitationCode, setInvitationCode] = useState('');
    const [isRedeemingCode, setIsRedeemingCode] = useState(false);
    const [codeRedeemed, setCodeRedeemed] = useState<{ type: string; message: string } | null>(null);

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLE SELECTOR STATES
    // ═══════════════════════════════════════════════════════════════════════════
    const [expandedRole, setExpandedRole] = useState<'coach' | 'client' | 'free' | null>(null);

    // Coach card states
    const [coachPromoCode, setCoachPromoCode] = useState('');
    const [isActivatingTrial, setIsActivatingTrial] = useState(false);
    const [isRedeemingCoachCode, setIsRedeemingCoachCode] = useState(false);

    // Client card states
    const [trainerCode, setTrainerCode] = useState('');
    const [isLinkingTrainer, setIsLinkingTrainer] = useState(false);
    const [linkedTrainer, setLinkedTrainer] = useState<string | null>(null);

    // Free user card states
    const [freePromoCode, setFreePromoCode] = useState('');
    const [isRedeemingFreeCode, setIsRedeemingFreeCode] = useState(false);

    // Error modal for trainer linking
    const [trainerErrorModal, setTrainerErrorModal] = useState<{
        visible: boolean;
        errorCode: 'TRAINER_NOT_FOUND' | 'TRAINER_AT_CAPACITY' | null;
        trainerName?: string;
        message?: string;
    }>({ visible: false, errorCode: null });

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
        ejerciciosFavoritos: [] as string[],
        ejerciciosEvitados: [] as string[],
        lesiones: [] as string[],
        alergias: '',
        cocina: 'si',
    });

    // Helper function to toggle items in array fields (multi-select)
    const toggleArrayItem = (field: 'ejerciciosFavoritos' | 'ejerciciosEvitados' | 'lesiones', item: string) => {
        setFormData(prev => {
            const current = prev[field] || [];
            const isSelected = current.includes(item);
            return {
                ...prev,
                [field]: isSelected
                    ? current.filter((i: string) => i !== item)
                    : [...current, item]
            };
        });
    };

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
            // Refrescar usuario para obtener estado actualizado (incluyendo código canjeado)
            console.log('[Onboarding] ✅ Finalizando, refrescando usuario...');
            await refreshUser();
            router.replace('/home');
        } catch (error) {
            console.error('Error guardando datos:', error);
            Alert.alert('Error', 'No se pudieron guardar tus datos. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    // Función para saltar onboarding
    const handleSkipOnboarding = async () => {
        try {
            // Marcar como completado en el backend (con info_user vacío)
            // Así el usuario puede completar los datos después desde perfil
            await axios.put('/users/info', { info_user: {} });

            // Si se canjeó un código, refrescar para que los cambios persistan
            if (codeRedeemed) {
                console.log('[Onboarding] ✅ Saltando con código canjeado, refrescando usuario...');
                await refreshUser();
            }

            router.replace('/home');
        } catch (error) {
            console.error('Error saltando onboarding:', error);
            // Si falla, intentar ir a home de todas formas
            router.replace('/home');
        }
    };

    // Función para canjear el código de invitación universal
    // Detecta automáticamente si es: entrenador, referido, o promocional
    const handleRedeemInvitationCode = async () => {
        if (!invitationCode.trim()) return;

        setIsRedeemingCode(true);
        const codeToRedeem = invitationCode.trim().toUpperCase();

        try {
            // 1. Primero intentar como código de entrenador (vinculación)
            try {
                console.log('[Onboarding] 🎯 Intentando código de entrenador:', codeToRedeem);
                const trainerResponse = await axios.post('/clients/select-trainer', {
                    trainerCode: codeToRedeem
                });
                if (trainerResponse.data.success) {
                    const trainerName = trainerResponse.data.trainer?.nombre || trainerResponse.data.trainer?.profile?.brandName || 'tu entrenador';
                    setCodeRedeemed({
                        type: 'trainer',
                        message: `¡Vinculado con ${trainerName}! 🏋️`
                    });
                    const updatedUser = await refreshUser();
                    console.log('[Onboarding] ✅ Usuario actualizado tras vincular entrenador:', updatedUser?.tipoUsuario);
                    return;
                }
            } catch (e: any) {
                // No es código de entrenador, continuar
            }

            // 2. Intentar como código de referido
            try {
                console.log('[Onboarding] 🎯 Intentando código de referido:', codeToRedeem);
                const referralResponse = await axios.post('/referrals/redeem', {
                    code: codeToRedeem
                });
                if (referralResponse.data.success) {
                    setCodeRedeemed({
                        type: 'referral',
                        message: referralResponse.data.message || '¡7 días de Premium gratis! 🎉'
                    });
                    const updatedUser = await refreshUser();
                    console.log('[Onboarding] ✅ Usuario actualizado tras código referido:', updatedUser?.tipoUsuario);
                    return;
                }
            } catch (e: any) {
                // No es código de referido, continuar
            }

            // 3. Intentar como código promocional VIP
            try {
                console.log('[Onboarding] 🎯 Intentando código promocional:', codeToRedeem);
                const promoResponse = await axios.post('/promo-codes/redeem', {
                    code: codeToRedeem
                });
                if (promoResponse.data.success) {
                    setCodeRedeemed({
                        type: 'promo',
                        message: promoResponse.data.message || '¡Código VIP canjeado! 🌟'
                    });
                    const updatedUser = await refreshUser();
                    console.log('[Onboarding] ✅ Usuario actualizado tras código promo:', updatedUser?.tipoUsuario);
                    return;
                }
            } catch (e: any) {
                // No es código promocional
            }

            // Ninguno funcionó
            Alert.alert('Código no válido', 'Este código no existe o ya ha sido usado. Puedes continuar sin código.');

        } catch (error) {
            console.error('[Onboarding] Error redeeming code:', error);
            Alert.alert('Error', 'No se pudo verificar el código. Puedes continuar sin él.');
        } finally {
            setIsRedeemingCode(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLE SELECTOR HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════

    // Handler: Activar trial de 14 días como coach
    const handleActivateCoachTrial = async () => {
        setIsActivatingTrial(true);
        try {
            console.log('[Onboarding] 🚀 Activando trial de entrenador...');
            const response = await axios.post('/users/activate-coach-trial');

            if (response.data.success) {
                console.log('[Onboarding] ✅ Trial activado:', response.data.user?.trainerProfile?.trainerCode);
                await refreshUser();

                // Navegar directamente al dashboard de coach
                router.replace('/(coach)/profile');

                // Mostrar mensaje de bienvenida (no bloqueante)
                setTimeout(() => {
                    Alert.alert(
                        '¡Bienvenido, Entrenador!',
                        'Tu prueba de 14 días ha sido activada. Si al terminar tienes menos de 3 clientes, mantienes el acceso GRATIS para siempre.'
                    );
                }, 500);
            }
        } catch (error: any) {
            console.error('[Onboarding] Error activando trial:', error);
            const message = error.response?.data?.message || 'No se pudo activar el trial. Inténtalo de nuevo.';
            Alert.alert('Error', message);
        } finally {
            setIsActivatingTrial(false);
        }
    };

    // Handler: Vincular con entrenador
    const handleLinkWithTrainer = async () => {
        if (!trainerCode.trim()) {
            Alert.alert('Código requerido', 'Por favor introduce el código de tu entrenador');
            return;
        }

        setIsLinkingTrainer(true);
        try {
            console.log('[Onboarding] 🔗 Vinculando con entrenador:', trainerCode.trim().toUpperCase());
            const response = await axios.post('/clients/select-trainer', {
                trainerCode: trainerCode.trim().toUpperCase()
            });

            if (response.data.success) {
                const trainerName = response.data.trainer?.nombre || response.data.trainer?.profile?.brandName || 'tu entrenador';
                setLinkedTrainer(trainerName);
                await refreshUser();
                // Navegar directamente al siguiente paso
                setCurrentStep(1);
            }
        } catch (error: any) {
            console.error('[Onboarding] Error vinculando:', error);
            console.log('[Onboarding] Response data:', error.response?.data);
            console.log('[Onboarding] Response status:', error.response?.status);

            const errorCode = error.response?.data?.errorCode;
            const trainerName = error.response?.data?.trainerName;
            const message = error.response?.data?.message;
            const status = error.response?.status;

            // Mostrar modal visual para errores específicos
            if (errorCode === 'TRAINER_AT_CAPACITY' || errorCode === 'TRAINER_NOT_ACCEPTING' || status === 403) {
                setTrainerErrorModal({
                    visible: true,
                    errorCode: 'TRAINER_AT_CAPACITY',
                    trainerName: trainerName || 'Tu entrenador',
                    message: message
                });
            } else if (errorCode === 'TRAINER_NOT_FOUND' || status === 404) {
                setTrainerErrorModal({
                    visible: true,
                    errorCode: 'TRAINER_NOT_FOUND',
                    message: message || 'No hemos encontrado ningún entrenador con ese código.'
                });
            } else {
                // Fallback para otros errores - también mostrar modal
                setTrainerErrorModal({
                    visible: true,
                    errorCode: 'TRAINER_NOT_FOUND',
                    message: message || 'Ocurrió un error. Inténtalo de nuevo.'
                });
            }
        } finally {
            setIsLinkingTrainer(false);
        }
    };

    // Handler: Canjear código promocional de coach
    const handleRedeemCoachPromoCode = async () => {
        if (!coachPromoCode.trim()) return;

        setIsRedeemingCoachCode(true);
        try {
            console.log('[Onboarding] 🎫 Canjeando código de entrenador:', coachPromoCode.trim().toUpperCase());
            const response = await axios.post('/promo-codes/redeem', {
                code: coachPromoCode.trim().toUpperCase()
            });

            if (response.data.success) {
                console.log('[Onboarding] ✅ Código de coach canjeado');
                await refreshUser();
                Alert.alert(
                    '¡Código canjeado!',
                    response.data.message || 'Tu cuenta de entrenador ha sido activada.',
                    [{ text: 'Empezar', onPress: () => router.replace('/(coach)/profile') }]
                );
            }
        } catch (error: any) {
            console.error('[Onboarding] Error canjeando código coach:', error);
            const message = error.response?.data?.message || 'Código no válido o ya ha sido usado.';
            Alert.alert('Error', message);
        } finally {
            setIsRedeemingCoachCode(false);
        }
    };

    // Handler: Canjear código premium para usuario libre
    const handleRedeemFreePromoCode = async () => {
        if (!freePromoCode.trim()) {
            // Sin código, simplemente continuar al cuestionario
            setCurrentStep(1);
            return;
        }

        setIsRedeemingFreeCode(true);
        try {
            console.log('[Onboarding] 🎫 Canjeando código premium:', freePromoCode.trim().toUpperCase());
            const response = await axios.post('/promo-codes/redeem', {
                code: freePromoCode.trim().toUpperCase()
            });

            if (response.data.success) {
                console.log('[Onboarding] ✅ Código premium canjeado');
                await refreshUser();
                Alert.alert(
                    '¡Código canjeado!',
                    response.data.message || 'Tu cuenta ha sido mejorada.',
                    [{ text: 'Continuar', onPress: () => setCurrentStep(1) }]
                );
            }
        } catch (error: any) {
            console.error('[Onboarding] Error canjeando código free:', error);
            // Si falla el código, permitir continuar de todas formas
            Alert.alert(
                'Código no válido',
                'El código no existe o ya ha sido usado. Puedes continuar sin él.',
                [
                    { text: 'Intentar otro', style: 'cancel' },
                    { text: 'Continuar sin código', onPress: () => setCurrentStep(1) }
                ]
            );
        } finally {
            setIsRedeemingFreeCode(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 0: ROLE SELECTOR
    // ═══════════════════════════════════════════════════════════════════════════
    if (currentStep === 0) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <ScrollView
                    style={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >
                    <View style={styles.roleSelectorContent}>
                        {/* Header */}
                        <View style={styles.roleSelectorHeader}>
                            <Ionicons name="fitness" size={50} color={theme.primary} />
                            <Text style={[styles.roleSelectorTitle, { color: theme.text }]}>
                                ¿Cómo vas a usar TotalGains?
                            </Text>
                            <Text style={[styles.roleSelectorSubtitle, { color: theme.textSecondary }]}>
                                Selecciona tu rol para personalizar tu experiencia
                            </Text>
                        </View>

                        {/* CARD A: SOY ENTRENADOR */}
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        <View style={[
                            styles.roleCard,
                            {
                                backgroundColor: expandedRole === 'coach' ? '#FEF3C7' : theme.cardBackground,
                                borderColor: expandedRole === 'coach' ? '#F59E0B' : theme.border,
                                borderWidth: expandedRole === 'coach' ? 2 : 1
                            }
                        ]}>
                            {/* Solo el header es touchable para expand/collapse */}
                            <TouchableOpacity
                                style={styles.roleCardHeader}
                                onPress={() => setExpandedRole(expandedRole === 'coach' ? null : 'coach')}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.roleIconContainer, { backgroundColor: '#FEF3C7' }]}>
                                    <Ionicons name="school" size={28} color="#F59E0B" />
                                </View>
                                <View style={styles.roleCardTitleContainer}>
                                    <Text style={[styles.roleCardTitle, { color: expandedRole === 'coach' ? '#1e293b' : theme.text }]}>
                                        SOY ENTRENADOR
                                    </Text>
                                    <Text style={[styles.roleCardSubtitle, { color: expandedRole === 'coach' ? '#78350f' : theme.textSecondary }]}>
                                        Gestiona clientes y crea planes
                                    </Text>
                                </View>
                                <Ionicons
                                    name={expandedRole === 'coach' ? 'chevron-up' : 'chevron-down'}
                                    size={24}
                                    color={expandedRole === 'coach' ? '#78350f' : theme.textSecondary}
                                />
                            </TouchableOpacity>

                            {/* Contenido expandido - FUERA del TouchableOpacity para que no propague eventos */}
                            {expandedRole === 'coach' && (
                                <View style={styles.roleCardExpanded}>
                                    {/* CTA Principal: Trial 14 días */}
                                    <TouchableOpacity
                                        style={[styles.trialButton, { backgroundColor: '#F59E0B' }]}
                                        onPress={handleActivateCoachTrial}
                                        disabled={isActivatingTrial}
                                    >
                                        {isActivatingTrial ? (
                                            <ActivityIndicator color="#FFF" />
                                        ) : (
                                            <>
                                                <Ionicons name="rocket" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                                <Text style={styles.trialButtonText}>
                                                    ACTIVAR PRUEBA UNLIMITED (14 DÍAS)
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                    <Text style={[styles.trialMicrocopy, { color: '#78350f' }]}>
                                        Acceso total a todas las funciones PRO. Si al terminar tienes menos de 3 clientes, te quedas con todo GRATIS para siempre.
                                    </Text>

                                    {/* Botón secundario: Ir a pagos */}
                                    <TouchableOpacity
                                        style={[styles.secondaryActionButton, { borderColor: '#F59E0B', backgroundColor: '#ffffff' }]}
                                        onPress={() => router.push('/(app)/payment')}
                                    >
                                        <Ionicons name="card" size={18} color="#b45309" style={{ marginRight: 6 }} />
                                        <Text style={[styles.secondaryActionText, { color: '#b45309' }]}>
                                            SÉ LO QUE QUIERO
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Input: Código promocional de entrenador */}
                                    <View style={styles.promoCodeSection}>
                                        <Text style={[styles.promoCodeLabel, { color: '#78350f' }]}>
                                            ¿Tienes código promocional de entrenador?
                                        </Text>
                                        <View style={styles.promoCodeInputRow}>
                                            <TextInput
                                                style={[styles.promoCodeInput, {
                                                    color: '#1e293b',
                                                    borderColor: '#fcd34d',
                                                    backgroundColor: '#ffffff'
                                                }]}
                                                placeholder="CÓDIGO"
                                                placeholderTextColor="#92400e"
                                                value={coachPromoCode}
                                                onChangeText={setCoachPromoCode}
                                                autoCapitalize="characters"
                                                editable={!isRedeemingCoachCode}
                                            />
                                            <TouchableOpacity
                                                style={[
                                                    styles.promoCodeButton,
                                                    { backgroundColor: coachPromoCode.trim() ? '#F59E0B' : '#94a3b8' }
                                                ]}
                                                onPress={handleRedeemCoachPromoCode}
                                                disabled={!coachPromoCode.trim() || isRedeemingCoachCode}
                                            >
                                                {isRedeemingCoachCode ? (
                                                    <ActivityIndicator size="small" color="#FFF" />
                                                ) : (
                                                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* ═══════════════════════════════════════════════════════════════ */}
                        {/* CARD B: SOY CLIENTE DE UN ENTRENADOR */}
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        <View style={[
                            styles.roleCard,
                            {
                                backgroundColor: expandedRole === 'client' ? '#DBEAFE' : theme.cardBackground,
                                borderColor: expandedRole === 'client' ? '#3B82F6' : theme.border,
                                borderWidth: expandedRole === 'client' ? 2 : 1
                            }
                        ]}>
                            {/* Solo el header es touchable para expand/collapse */}
                            <TouchableOpacity
                                style={styles.roleCardHeader}
                                onPress={() => setExpandedRole(expandedRole === 'client' ? null : 'client')}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.roleIconContainer, { backgroundColor: '#DBEAFE' }]}>
                                    <Ionicons name="people" size={28} color="#3B82F6" />
                                </View>
                                <View style={styles.roleCardTitleContainer}>
                                    <Text style={[styles.roleCardTitle, { color: expandedRole === 'client' ? '#1e293b' : theme.text }]}>
                                        SOY CLIENTE DE UN ENTRENADOR
                                    </Text>
                                    <Text style={[styles.roleCardSubtitle, { color: expandedRole === 'client' ? '#1e40af' : theme.textSecondary }]}>
                                        Ya tengo un entrenador que me guía
                                    </Text>
                                </View>
                                <Ionicons
                                    name={expandedRole === 'client' ? 'chevron-up' : 'chevron-down'}
                                    size={24}
                                    color={expandedRole === 'client' ? '#1e40af' : theme.textSecondary}
                                />
                            </TouchableOpacity>

                            {/* Contenido expandido - FUERA del TouchableOpacity */}
                            {expandedRole === 'client' && (
                                <View style={styles.roleCardExpanded}>
                                    {linkedTrainer ? (
                                        <View style={[styles.linkedTrainerBadge, { backgroundColor: '#3B82F620' }]}>
                                            <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                                            <Text style={[styles.linkedTrainerText, { color: '#3B82F6' }]}>
                                                ¡Vinculado con {linkedTrainer}!
                                            </Text>
                                        </View>
                                    ) : (
                                        <>
                                            <Text style={[styles.clientInstructions, { color: '#1e293b' }]}>
                                                Introduce el código que te ha dado tu entrenador:
                                            </Text>
                                            <View style={styles.trainerCodeInputRow}>
                                                <TextInput
                                                    style={[styles.trainerCodeInput, {
                                                        color: '#1e293b',
                                                        borderColor: '#93c5fd',
                                                        backgroundColor: '#ffffff'
                                                    }]}
                                                    placeholder="Ej: COACHPRO123"
                                                    placeholderTextColor="#64748b"
                                                    value={trainerCode}
                                                    onChangeText={setTrainerCode}
                                                    autoCapitalize="characters"
                                                    editable={!isLinkingTrainer}
                                                />
                                            </View>
                                            <TouchableOpacity
                                                style={[
                                                    styles.linkTrainerButton,
                                                    { backgroundColor: trainerCode.trim() ? '#3B82F6' : '#94a3b8' }
                                                ]}
                                                onPress={handleLinkWithTrainer}
                                                disabled={!trainerCode.trim() || isLinkingTrainer}
                                            >
                                                {isLinkingTrainer ? (
                                                    <ActivityIndicator color="#FFF" />
                                                ) : (
                                                    <>
                                                        <Ionicons name="link" size={18} color="#FFF" style={{ marginRight: 6 }} />
                                                        <Text style={styles.linkTrainerButtonText}>VINCULAR CON MI ENTRENADOR</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                            <Text style={[styles.clientMicrocopy, { color: '#475569' }]}>
                                                Tu entrenador te dará un código único para vincularte. Después completarás tu perfil para que pueda crear tu plan.
                                            </Text>
                                        </>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* ═══════════════════════════════════════════════════════════════ */}
                        {/* CARD C: SOY USUARIO POR LIBRE */}
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        <View style={[
                            styles.roleCard,
                            {
                                backgroundColor: expandedRole === 'free' ? '#D1FAE5' : theme.cardBackground,
                                borderColor: expandedRole === 'free' ? '#10B981' : theme.border,
                                borderWidth: expandedRole === 'free' ? 2 : 1
                            }
                        ]}>
                            {/* Solo el header es touchable para expand/collapse */}
                            <TouchableOpacity
                                style={styles.roleCardHeader}
                                onPress={() => setExpandedRole(expandedRole === 'free' ? null : 'free')}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.roleIconContainer, { backgroundColor: '#D1FAE5' }]}>
                                    <Ionicons name="person" size={28} color="#10B981" />
                                </View>
                                <View style={styles.roleCardTitleContainer}>
                                    <Text style={[styles.roleCardTitle, { color: expandedRole === 'free' ? '#1e293b' : theme.text }]}>
                                        SOY USUARIO POR LIBRE
                                    </Text>
                                    <Text style={[styles.roleCardSubtitle, { color: expandedRole === 'free' ? '#065f46' : theme.textSecondary }]}>
                                        Entreno por mi cuenta con la app
                                    </Text>
                                </View>
                                <Ionicons
                                    name={expandedRole === 'free' ? 'chevron-up' : 'chevron-down'}
                                    size={24}
                                    color={expandedRole === 'free' ? '#065f46' : theme.textSecondary}
                                />
                            </TouchableOpacity>

                            {/* Contenido expandido - FUERA del TouchableOpacity */}
                            {expandedRole === 'free' && (
                                <View style={styles.roleCardExpanded}>
                                    <TouchableOpacity
                                        style={[styles.continueButton, { backgroundColor: '#10B981' }]}
                                        onPress={() => setCurrentStep(1)}
                                    >
                                        <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.continueButtonText}>CONTINUAR</Text>
                                    </TouchableOpacity>

                                    {/* Input opcional: Código premium */}
                                    <View style={styles.promoCodeSection}>
                                        <Text style={[styles.promoCodeLabel, { color: '#065f46' }]}>
                                            ¿Tienes un código premium? (Opcional)
                                        </Text>
                                        <View style={styles.promoCodeInputRow}>
                                            <TextInput
                                                style={[styles.promoCodeInput, {
                                                    color: '#1e293b',
                                                    borderColor: '#6ee7b7',
                                                    backgroundColor: '#ffffff'
                                                }]}
                                                placeholder="CÓDIGO PREMIUM"
                                                placeholderTextColor="#047857"
                                                value={freePromoCode}
                                                onChangeText={setFreePromoCode}
                                                autoCapitalize="characters"
                                                editable={!isRedeemingFreeCode}
                                            />
                                            <TouchableOpacity
                                                style={[
                                                    styles.promoCodeButton,
                                                    { backgroundColor: freePromoCode.trim() ? '#10B981' : '#94a3b8' }
                                                ]}
                                                onPress={handleRedeemFreePromoCode}
                                                disabled={isRedeemingFreeCode}
                                            >
                                                {isRedeemingFreeCode ? (
                                                    <ActivityIndicator size="small" color="#FFF" />
                                                ) : (
                                                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>

                    </View>
                </ScrollView>

                {/* Modal de error de vinculación con entrenador */}
                <Modal
                    visible={trainerErrorModal.visible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setTrainerErrorModal({ visible: false, errorCode: null })}
                >
                    <View style={styles.errorModalOverlay}>
                        <View style={[styles.errorModalContent, { backgroundColor: theme.cardBackground }]}>
                            {/* Icono según tipo de error */}
                            <View style={[
                                styles.errorModalIconContainer,
                                { backgroundColor: trainerErrorModal.errorCode === 'TRAINER_AT_CAPACITY' ? '#FEE2E2' : '#FEF3C7' }
                            ]}>
                                <Ionicons
                                    name={trainerErrorModal.errorCode === 'TRAINER_AT_CAPACITY' ? 'people' : 'search'}
                                    size={40}
                                    color={trainerErrorModal.errorCode === 'TRAINER_AT_CAPACITY' ? '#DC2626' : '#F59E0B'}
                                />
                            </View>

                            {/* Título */}
                            <Text style={[styles.errorModalTitle, { color: theme.text }]}>
                                {trainerErrorModal.errorCode === 'TRAINER_AT_CAPACITY'
                                    ? `${trainerErrorModal.trainerName} está al máximo`
                                    : 'No encontramos a tu entrenador'
                                }
                            </Text>

                            {/* Mensaje */}
                            <Text style={[styles.errorModalMessage, { color: theme.textSecondary }]}>
                                {trainerErrorModal.errorCode === 'TRAINER_AT_CAPACITY'
                                    ? `Habla con ${trainerErrorModal.trainerName} para ver opciones disponibles.`
                                    : 'Verifica que el código esté escrito correctamente e inténtalo de nuevo.'
                                }
                            </Text>

                            {/* Botón cerrar */}
                            <TouchableOpacity
                                style={[styles.errorModalButton, { backgroundColor: theme.primary }]}
                                onPress={() => setTrainerErrorModal({ visible: false, errorCode: null })}
                            >
                                <Text style={styles.errorModalButtonText}>Entendido</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    // STEP 1: BASIC INFO
    if (currentStep === 1) {
        const objetivos = [
            'Perder grasa',
            'Ganar músculo',
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

                <View style={[styles.footer, { backgroundColor: theme.background, paddingBottom: insets.bottom + 20 }]}>
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
            { label: 'Estoy empezando (0–1 años)', value: 2 },
            { label: 'Voy en serio (1–3 años)', value: 5 },
            { label: 'Llevo años dándole (3+ años)', value: 8 },
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

                <View style={[styles.footer, { backgroundColor: theme.background, paddingBottom: insets.bottom + 20 }]}>
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
        const tipoOpts = [
            { label: 'Hipertrofia', value: 'hipertrofia' },
            { label: 'Fuerza', value: 'fuerza' },
            { label: 'Pérdida de grasa', value: 'perdida_grasa' },
            { label: 'Rendimiento/Deporte', value: 'resistencia' },
            { label: 'Salud general', value: 'salud' },
        ];
        const cardioOpts = [
            { label: 'Mínimo, gracias', value: 'minimo' },
            { label: 'Algo moderado', value: 'moderado' },
            { label: 'Lo que haga falta', value: 'intenso' },
        ];
        const dietaOpts = [
            { label: 'Flexible', value: 'flexible' },
            { label: 'Bastante estricta', value: 'estricta' },
            { label: 'Voy un poco a lo loco', value: 'sin_control' },
        ];
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
                                    key={opt.value}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.tipoEntreno === opt.value ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.tipoEntreno === opt.value ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, tipoEntreno: opt.value })}
                                >
                                    <Text style={[styles.chipText, { color: formData.tipoEntreno === opt.value ? theme.primary : theme.text }]}>
                                        {opt.label}
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
                                    key={opt.value}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.cardio === opt.value ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.cardio === opt.value ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, cardio: opt.value })}
                                >
                                    <Text style={[styles.chipText, { color: formData.cardio === opt.value ? theme.primary : theme.text }]}>
                                        {opt.label}
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
                                    key={opt.value}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.dieta === opt.value ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.dieta === opt.value ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFormData({ ...formData, dieta: opt.value })}
                                >
                                    <Text style={[styles.chipText, { color: formData.dieta === opt.value ? theme.primary : theme.text }]}>
                                        {opt.label}
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
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Qué ejercicios disfrutas más? (puedes elegir varios)</Text>
                        <View style={styles.chipGrid}>
                            {ejerciciosFavOpts.map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.ejerciciosFavoritos.includes(opt) ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.ejerciciosFavoritos.includes(opt) ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => toggleArrayItem('ejerciciosFavoritos', opt)}
                                >
                                    <Text style={[styles.chipText, { color: formData.ejerciciosFavoritos.includes(opt) ? theme.primary : theme.text }]}>
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Qué sueles evitar? (puedes elegir varios)</Text>
                        <View style={styles.chipGrid}>
                            {ejerciciosEvitOpts.map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.ejerciciosEvitados.includes(opt) ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.ejerciciosEvitados.includes(opt) ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => toggleArrayItem('ejerciciosEvitados', opt)}
                                >
                                    <Text style={[styles.chipText, { color: formData.ejerciciosEvitados.includes(opt) ? theme.primary : theme.text }]}>
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: theme.background, paddingBottom: insets.bottom + 20 }]}>
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
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Tienes alguna lesión o molestia habitual? (puedes elegir varios)</Text>
                        <View style={styles.chipGrid}>
                            {lesionesOpts.map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: formData.lesiones.includes(opt) ? theme.primary + '20' : theme.cardBackground,
                                            borderColor: formData.lesiones.includes(opt) ? theme.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => toggleArrayItem('lesiones', opt)}
                                >
                                    <Text style={[styles.chipText, { color: formData.lesiones.includes(opt) ? theme.primary : theme.text }]}>
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

                <View style={[styles.footer, { backgroundColor: theme.background, paddingBottom: insets.bottom + 20 }]}>
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
        justifyContent: 'center',
        flexDirection: 'row',
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
    secondaryButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
        borderWidth: 1,
        backgroundColor: 'transparent',
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '500',
    },
    skipNote: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 18,
        paddingHorizontal: 20,
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
    // Estilos para el campo de código de invitación
    invitationSection: {
        width: '100%',
        marginTop: 24,
        marginBottom: 8,
        padding: 16,
        borderRadius: 14,
        borderWidth: 2,
    },
    invitationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    invitationTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    invitationInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    invitationInput: {
        flex: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 1,
        borderWidth: 1,
    },
    invitationButton: {
        width: 44,
        height: 44,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    invitationHint: {
        fontSize: 12,
        marginTop: 10,
        lineHeight: 16,
    },
    codeRedeemedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
    codeRedeemedText: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLE SELECTOR STYLES
    // ═══════════════════════════════════════════════════════════════════════════
    roleSelectorContent: {
        flex: 1,
        paddingVertical: 40,
        paddingHorizontal: 16,
    },
    roleSelectorHeader: {
        alignItems: 'center',
        marginBottom: 32,
    },
    roleSelectorTitle: {
        fontSize: 26,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 8,
    },
    roleSelectorSubtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    roleCard: {
        borderRadius: 16,
        marginBottom: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    roleCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    roleIconContainer: {
        width: 52,
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    roleCardTitleContainer: {
        flex: 1,
    },
    roleCardTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    roleCardSubtitle: {
        fontSize: 13,
    },
    roleCardExpanded: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    trialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 8,
    },
    trialButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    trialMicrocopy: {
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
        marginBottom: 16,
    },
    secondaryActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 2,
        backgroundColor: 'transparent',
        marginBottom: 16,
    },
    secondaryActionText: {
        fontSize: 14,
        fontWeight: '600',
    },
    promoCodeSection: {
        marginTop: 8,
    },
    promoCodeLabel: {
        fontSize: 12,
        marginBottom: 8,
    },
    promoCodeInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    promoCodeInput: {
        flex: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 1,
        borderWidth: 1,
    },
    promoCodeButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    linkedTrainerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    linkedTrainerText: {
        fontSize: 15,
        fontWeight: '600',
    },
    clientInstructions: {
        fontSize: 14,
        marginBottom: 12,
        textAlign: 'center',
    },
    trainerCodeInputRow: {
        marginBottom: 12,
    },
    trainerCodeInput: {
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 2,
        borderWidth: 1,
        textAlign: 'center',
    },
    linkTrainerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 12,
    },
    linkTrainerButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    clientMicrocopy: {
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 16,
    },
    continueButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    // Modal de error para vinculación con entrenador
    errorModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    errorModalContent: {
        width: '100%',
        maxWidth: 350,
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
    },
    errorModalIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    errorModalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    errorModalMessage: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    errorModalButton: {
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 12,
    },
    errorModalButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
