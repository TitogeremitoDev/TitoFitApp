import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Modal,
    Platform,
    Image,
    Animated,
    BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '../src/hooks/useAlert';
import { useCoachBranding } from '../context/CoachBrandingContext';
// Componentes mejorados para iOS
import {
    EnhancedScrollView as ScrollView,
    EnhancedTouchable as TouchableOpacity,
    EnhancedTextInput as TextInput,
} from '../components/ui';

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
    const { theme, isDark } = useTheme();
    const { user, refreshUser } = useAuth();
    const { branding, activeTheme, refresh: refreshBranding } = useCoachBranding();
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // ═══════════════════════════════════════════════════════════════════════════
    // SAFEGUARD: Expulsar usuarios que NO deberían estar en onboarding
    // ADMIN, ENTRENADOR → mode-select
    // CLIENTE, PREMIUM con onboardingCompleted → home
    // ═══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!user) return;

        const isAdminOrCoach = user.tipoUsuario === 'ADMINISTRADOR' || user.tipoUsuario === 'ENTRENADOR';
        const isEstablishedUser = ['CLIENTE', 'PREMIUM'].includes(user.tipoUsuario);

        if (isAdminOrCoach) {
            console.log('[Onboarding] ⚠️ Usuario ADMIN/COACH detectado, redirigiendo a mode-select');
            router.replace('/mode-select');
            return;
        }

        // CLIENTE/PREMIUM con onboarding ya completado → home
        if (isEstablishedUser && user.onboardingCompleted) {
            console.log('[Onboarding] ⚠️ Usuario establecido con onboarding completado, redirigiendo a home');
            router.replace('/home');
            return;
        }
    }, [user, router]);

    // ═══════════════════════════════════════════════════════════════════════════
    // TRAINER BRANDING - Use trainer colors when user is a client with assigned trainer
    // ═══════════════════════════════════════════════════════════════════════════
    const isClientWithTrainer = user?.tipoUsuario === 'CLIENTE' && user?.currentTrainerId;
    const brandedPrimary = activeTheme?.colors?.primary || theme.primary;
    const brandedBackground = activeTheme?.colors?.background || theme.background;
    // For properties not in activeTheme, use regular theme
    const brandedCardBg = theme.cardBackground;
    const brandedText = theme.text;
    const brandedTextSecondary = theme.textSecondary;
    const brandedBorder = theme.border;

    // ═══════════════════════════════════════════════════════════════════════════
    // WELCOME SCREEN STATE (Step 0 - Luxury White Label)
    // ═══════════════════════════════════════════════════════════════════════════
    const [trainerData, setTrainerData] = useState<{
        nombre?: string;
        profile?: { brandName?: string; logoUrl?: string };
    } | null>(null);
    const slideAnim = useRef(new Animated.Value(0)).current;

    // Fetch trainer data if user has a trainer assigned (for branding)
    useEffect(() => {
        const fetchTrainer = async () => {
            if (!user?.currentTrainerId) return;
            try {
                const response = await axios.get('/clients/my-trainer');
                if (response.data.success && response.data.trainer) {
                    setTrainerData(response.data.trainer);
                }
            } catch (err) {
                console.log('[Onboarding] Trainer fetch skipped - using TotalGains branding');
            }
        };
        fetchTrainer();
    }, [user?.currentTrainerId]);

    // Smooth transition when moving from Welcome Screen to Data Form
    const handleWelcomeContinue = () => {
        Animated.timing(slideAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setCurrentStep(2); // Go to Data Form (Step 2)
            slideAnim.setValue(0);
        });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ANDROID BACK BUTTON HANDLER
    // Step 0 (Role Selector): Let app close (return false)
    // Step 1 (Welcome Screen): Go back to Role Selector (return true)
    // Step 2+ (Data Form): Go to previous step
    // ═══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (currentStep === 0) {
                // Role Selector: allow app to close (default behavior)
                return false;
            } else if (currentStep === 1) {
                // Welcome Screen: go back to Role Selector
                setCurrentStep(0);
                return true; // Prevent default (don't close app)
            } else if (currentStep > 1) {
                // Data form and beyond: go to previous step
                setCurrentStep(currentStep - 1);
                return true;
            }
            return false;
        });

        return () => backHandler.remove();
    }, [currentStep]);

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

    // Hook universal para alertas (funciona en web y móvil)
    const { showAlert } = useAlert();

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
        tieneAlergias: false,
        alergias: '',
        cocina: 'si',
    });

    // Helper function to toggle items in array fields (multi-select)
    const toggleArrayItem = (field: 'ejerciciosFavoritos' | 'ejerciciosEvitados' | 'lesiones', item: string) => {
        setFormData(prev => {
            const current = prev[field] || [];
            const isSelected = current.includes(item);

            // Special logic for lesiones: "Ninguna" is mutually exclusive
            if (field === 'lesiones') {
                if (item === 'Ninguna') {
                    // If selecting Ninguna, clear all and just set Ninguna
                    return { ...prev, [field]: isSelected ? [] : ['Ninguna'] };
                } else {
                    // If selecting another option, remove Ninguna if present
                    const filtered = current.filter((i: string) => i !== 'Ninguna' && i !== item);
                    return { ...prev, [field]: isSelected ? filtered : [...filtered, item] };
                }
            }

            return {
                ...prev,
                [field]: isSelected
                    ? current.filter((i: string) => i !== item)
                    : [...current, item]
            };
        });
    };

    const totalSteps = 8;

    const handleNext = () => {
        // Validation now at step 2 (was step 1 before Welcome Screen)
        if (currentStep === 2) {
            if (!formData.edad || !formData.peso || !formData.altura || !formData.objetivos || !formData.genero) {
                showAlert('Campos requeridos', 'Por favor completa todos los campos');
                return;
            }
        }

        // Skip Premium Upsell (Step 6) for users who already have access
        // Only FREEUSER sees the upsell - everyone else already has full access
        if (currentStep === 5 && user?.tipoUsuario !== 'FREEUSER') {
            setCurrentStep(7); // Skip to final step
            return;
        }

        setCurrentStep(currentStep + 1);
    };

    const handleBack = () => {
        // Don't go back from Role Selector (step 1) - Welcome Screen doesn't need back button
        if (currentStep > 1) setCurrentStep(currentStep - 1);
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
            await refreshUser(true);
            router.replace('/home');
        } catch (error) {
            console.error('Error guardando datos:', error);
            showAlert('Error', 'No se pudieron guardar tus datos. Inténtalo de nuevo.');
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
                await refreshUser(true);
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
                    const updatedUser = await refreshUser(true);
                    await refreshBranding();
                    console.log('[Onboarding] ✅ Usuario y branding actualizados tras vincular entrenador:', updatedUser?.tipoUsuario);
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
                    const updatedUser = await refreshUser(true);
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
                    const updatedUser = await refreshUser(true);
                    console.log('[Onboarding] ✅ Usuario actualizado tras código promo:', updatedUser?.tipoUsuario);
                    return;
                }
            } catch (e: any) {
                // No es código promocional
            }

            // Ninguno funcionó
            showAlert('Código no válido', 'Este código no existe o ya ha sido usado. Puedes continuar sin código.');

        } catch (error) {
            console.error('[Onboarding] Error redeeming code:', error);
            showAlert('Error', 'No se pudo verificar el código. Puedes continuar sin él.');
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
                await refreshUser(true);

                // Navegar directamente al dashboard de coach
                router.replace('/(coach)/profile');

                // Mostrar mensaje de bienvenida (no bloqueante)
                setTimeout(() => {
                    showAlert(
                        '¡Bienvenido, Entrenador!',
                        'Tu prueba de 14 días ha sido activada. Si al terminar tienes menos de 3 clientes, mantienes el acceso GRATIS para siempre.'
                    );
                }, 500);
            }
        } catch (error: any) {
            console.error('[Onboarding] Error activando trial:', error);
            const message = error.response?.data?.message || 'No se pudo activar el trial. Inténtalo de nuevo.';
            showAlert('Error', message);
        } finally {
            setIsActivatingTrial(false);
        }
    };

    // Handler: Vincular con entrenador
    const handleLinkWithTrainer = async () => {
        if (!trainerCode.trim()) {
            showAlert('Código requerido', 'Por favor introduce el código de tu entrenador');
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
                await refreshUser(true);
                await refreshBranding();
                console.log('[Onboarding] ✅ Usuario y branding actualizados');
                // Navegar a Welcome Screen (Step 1)
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
                await refreshUser(true);

                // Navegar con showAlert (funciona en web y móvil)
                showAlert(
                    '¡Código canjeado!',
                    response.data.message || 'Tu cuenta de entrenador ha sido activada.',
                    [{ text: 'Empezar', onPress: () => router.replace('/(coach)') }]
                );
            }
        } catch (error: any) {
            console.error('[Onboarding] Error canjeando código coach:', error);
            const message = error.response?.data?.message || 'Código no válido o ya ha sido usado.';
            showAlert('Error', message);
        } finally {
            setIsRedeemingCoachCode(false);
        }
    };

    // Handler: Canjear código premium para usuario libre
    const handleRedeemFreePromoCode = async () => {
        if (!freePromoCode.trim()) {
            // Sin código, continuar a Welcome Screen (Step 1)
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
                await refreshUser(true);
                showAlert(
                    '¡Código canjeado!',
                    response.data.message || 'Tu cuenta ha sido mejorada.',
                    [{ text: 'Continuar', onPress: () => setCurrentStep(1) }]
                );
            }
        } catch (error: any) {
            console.error('[Onboarding] Error canjeando código free:', error);
            // Si falla el código, permitir continuar de todas formas
            showAlert(
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
    // STEP 1: WELCOME SCREEN (Luxury White Label - AFTER Role Selection)
    // ═══════════════════════════════════════════════════════════════════════════
    if (currentStep === 1) {
        // Determine branding: trainer logo/name if CLIENTE, otherwise TotalGains
        const displayName = trainerData?.profile?.brandName ||
            trainerData?.nombre ||
            'TotalGains';
        const logoUrl = trainerData?.profile?.logoUrl || null;
        const primaryColor = activeTheme?.colors?.primary || brandedPrimary;

        return (
            <Animated.View
                style={[
                    styles.container,
                    { backgroundColor: theme.background },
                    {
                        transform: [{
                            translateY: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -50]
                            })
                        }],
                        opacity: slideAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 0]
                        })
                    }
                ]}
            >
                <View style={styles.luxuryWelcomeContent}>
                    {/* ZONA SUPERIOR: BRANDING */}
                    <View style={styles.luxuryWelcomeBranding}>
                        {logoUrl ? (
                            <Image
                                source={{ uri: logoUrl }}
                                style={styles.luxuryWelcomeLogo}
                                resizeMode="contain"
                            />
                        ) : (
                            <Image
                                source={require('../assets/logo.png')}
                                style={styles.luxuryWelcomeLogo}
                                resizeMode="contain"
                            />
                        )}
                        <Text style={[styles.luxuryWelcomeTrainerName, { color: theme.text }]}>
                            {displayName}
                        </Text>
                    </View>

                    {/* ZONA CENTRAL: WELCOME CARD */}
                    <View style={[
                        styles.luxuryWelcomeCard,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'
                        }
                    ]}>
                        <Text style={[styles.luxuryWelcomeTitle, { color: theme.text }]}>
                            Bienvenido al equipo de {displayName}
                        </Text>
                        <Text style={[styles.luxuryWelcomeBody, { color: theme.textSecondary }]}>
                            Tu transformación empieza ahora. Para diseñarte la experiencia
                            más cercana y eficiente posible, necesito calibrar unos datos rápidos.
                        </Text>
                    </View>

                    {/* ZONA INFERIOR: CTA */}
                    <TouchableOpacity
                        style={[styles.luxuryWelcomeButton, { backgroundColor: primaryColor }]}
                        onPress={handleWelcomeContinue}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.luxuryWelcomeButtonText}>¡Vamos a ello!</Text>
                        <Ionicons name="arrow-forward" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </Animated.View>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 0: ROLE SELECTOR (First step - choose user type)
    // ═══════════════════════════════════════════════════════════════════════════
    if (currentStep === 0) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <ScrollView
                    style={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 200 }}
                >
                    <View style={styles.roleSelectorContent}>
                        {/* Header */}
                        <View style={styles.roleSelectorHeader}>
                            <Ionicons name="fitness" size={50} color={brandedPrimary} />
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
                                                Tu entrenador te dará un código único para vincularte. Este código es solo para enlazarte con tu entrenador, no es un servicio de pago externo.
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
                                style={[styles.errorModalButton, { backgroundColor: brandedPrimary }]}
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

    // STEP 2: BASIC INFO (age, weight, height, goals, gender)
    if (currentStep === 2) {
        const objetivos = [
            { label: 'Perder grasa', icon: 'flame' },
            { label: 'Ganar músculo', icon: 'barbell' },
            { label: 'Rendimiento deportivo', icon: 'trophy' },
            { label: 'Salud y bienestar', icon: 'heart' },
        ];
        const generos = [
            { label: 'Hombre', icon: 'male' },
            { label: 'Mujer', icon: 'female' },
            { label: 'Otro', icon: 'person' },
        ];
        const primaryColor = activeTheme?.colors?.primary || brandedPrimary;

        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[styles.header, { backgroundColor: theme.background }]}>
                    <Text style={[styles.progressText, { color: theme.textSecondary }]}>Paso 1 de 6</Text>
                </View>

                <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContentContainer}>
                    <Text style={[styles.screenTitle, { color: theme.text }]}>Tus datos básicos</Text>
                    <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>Para personalizar tu experiencia</Text>

                    {/* BIG DATA ROW: Edad / Peso / Altura */}
                    <View style={styles.bigDataRow}>
                        {/* EDAD */}
                        <View
                            style={[
                                styles.bigDataCard,
                                {
                                    backgroundColor: isDark ? '#1e293b' : '#FFFFFF',
                                    borderColor: formData.edad ? primaryColor : (isDark ? '#334155' : '#E5E7EB'),
                                    borderWidth: formData.edad ? 2 : 1,
                                }
                            ]}
                        >
                            <Text style={[styles.bigDataLabel, { color: theme.textSecondary }]}>EDAD</Text>
                            <TextInput
                                disableTouchWrapper
                                style={[styles.bigDataInput, { color: theme.text }]}
                                placeholder="--"
                                placeholderTextColor={theme.textSecondary}
                                keyboardType="numeric"
                                maxLength={2}
                                value={formData.edad}
                                onChangeText={(text) => setFormData({ ...formData, edad: text.replace(/[^0-9]/g, '') })}
                            />
                        </View>

                        {/* PESO */}
                        <View
                            style={[
                                styles.bigDataCard,
                                {
                                    backgroundColor: isDark ? '#1e293b' : '#FFFFFF',
                                    borderColor: formData.peso ? primaryColor : (isDark ? '#334155' : '#E5E7EB'),
                                    borderWidth: formData.peso ? 2 : 1,
                                }
                            ]}
                        >
                            <Text style={[styles.bigDataLabel, { color: theme.textSecondary }]}>PESO</Text>
                            <TextInput
                                disableTouchWrapper
                                style={[styles.bigDataInput, { color: theme.text }]}
                                placeholder="--"
                                placeholderTextColor={theme.textSecondary}
                                keyboardType="decimal-pad"
                                maxLength={5}
                                value={formData.peso}
                                onChangeText={(text) => setFormData({ ...formData, peso: text })}
                            />
                        </View>

                        {/* ALTURA */}
                        <View
                            style={[
                                styles.bigDataCard,
                                {
                                    backgroundColor: isDark ? '#1e293b' : '#FFFFFF',
                                    borderColor: formData.altura ? primaryColor : (isDark ? '#334155' : '#E5E7EB'),
                                    borderWidth: formData.altura ? 2 : 1,
                                }
                            ]}
                        >
                            <Text style={[styles.bigDataLabel, { color: theme.textSecondary }]}>ALTURA</Text>
                            <TextInput
                                disableTouchWrapper
                                style={[styles.bigDataInput, { color: theme.text }]}
                                placeholder="--"
                                placeholderTextColor={theme.textSecondary}
                                keyboardType="decimal-pad"
                                maxLength={4}
                                value={formData.altura}
                                onChangeText={(text) => setFormData({ ...formData, altura: text.replace(/,/g, '.') })}
                            />
                        </View>
                    </View>

                    {/* GÉNERO - Square Tinted Buttons */}
                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>Tu género</Text>
                        <View style={styles.genderButtonsRow}>
                            {generos.map((gen) => {
                                const isSelected = formData.genero === gen.label;
                                return (
                                    <TouchableOpacity
                                        key={gen.label}
                                        style={[
                                            styles.genderButton,
                                            {
                                                backgroundColor: isSelected ? primaryColor + '15' : (isDark ? '#1e293b' : '#FFFFFF'),
                                                borderColor: isSelected ? primaryColor : (isDark ? '#334155' : '#E5E7EB'),
                                                borderWidth: isSelected ? 2 : 1,
                                            },
                                        ]}
                                        onPress={() => setFormData({ ...formData, genero: gen.label })}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons
                                            name={gen.icon as any}
                                            size={28}
                                            color={isSelected ? primaryColor : theme.textSecondary}
                                        />
                                        <Text style={[
                                            styles.genderButtonText,
                                            { color: isSelected ? primaryColor : theme.text }
                                        ]}>
                                            {gen.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* OBJETIVO - Tinted Cards */}
                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Qué quieres lograr?</Text>
                        <View style={styles.objectiveGrid}>
                            {objetivos.map((obj) => {
                                const isSelected = formData.objetivos === obj.label;
                                return (
                                    <TouchableOpacity
                                        key={obj.label}
                                        style={[
                                            styles.objectiveCard,
                                            {
                                                backgroundColor: isSelected ? primaryColor + '15' : (isDark ? '#1e293b' : '#FFFFFF'),
                                                borderColor: isSelected ? primaryColor : (isDark ? '#334155' : '#E5E7EB'),
                                                borderWidth: isSelected ? 2 : 1,
                                            },
                                        ]}
                                        onPress={() => setFormData({ ...formData, objetivos: obj.label })}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons
                                            name={obj.icon as any}
                                            size={24}
                                            color={isSelected ? primaryColor : theme.textSecondary}
                                        />
                                        <Text style={[
                                            styles.objectiveText,
                                            { color: isSelected ? primaryColor : theme.text }
                                        ]}>
                                            {obj.label}
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
                        style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: brandedPrimary }]}
                        onPress={handleNext}
                    >
                        <Text style={styles.primaryButtonText}>Siguiente</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // STEP 3: LEVEL & COMMITMENT
    if (currentStep === 3) {
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

                <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContentContainer}>
                    <Text style={[styles.screenTitle, { color: theme.text }]}>Tu nivel y compromiso</Text>
                    <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>Sin presión, solo para ajustarte mejor</Text>

                    {/* EXPERIENCIA - Slim Cards (más finas) */}
                    <View style={styles.section}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Cuánto tiempo llevas entrenando?</Text>
                        <View style={styles.luxuryCardStack}>
                            {experienciaOpts.map((opt) => {
                                const isSelected = formData.experiencia === opt.value;
                                return (
                                    <TouchableOpacity
                                        key={opt.value}
                                        style={[
                                            styles.slimCard,
                                            {
                                                backgroundColor: isDark ? '#1e293b' : '#FFFFFF',
                                                borderColor: isSelected ? brandedPrimary : (isDark ? '#334155' : '#E5E7EB'),
                                                borderWidth: isSelected ? 2 : 1,
                                            },
                                        ]}
                                        onPress={() => setFormData({ ...formData, experiencia: opt.value })}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[
                                            styles.slimCardText,
                                            { color: isSelected ? brandedPrimary : theme.text }
                                        ]}>
                                            {opt.label}
                                        </Text>
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={22}
                                            color={isSelected ? brandedPrimary : (isDark ? '#475569' : '#D1D5DB')}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* COMPROMISO - Horizontal 3 Square Cards with Icons */}
                    <View style={[styles.section, { marginTop: 32 }]}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Cuánto te quieres comprometer ahora mismo?</Text>
                        <View style={styles.commitmentRow}>
                            {[
                                { label: 'Tranquilo', value: 'bajo', icon: '🐢' },
                                { label: 'Constante', value: 'medio', icon: '🏃' },
                                { label: 'A tope', value: 'alto', icon: '🚀' },
                            ].map((opt) => {
                                const isSelected = formData.compromiso === opt.value;
                                return (
                                    <TouchableOpacity
                                        key={opt.value}
                                        style={[
                                            styles.commitmentSquare,
                                            {
                                                backgroundColor: isSelected ? brandedPrimary + '15' : (isDark ? '#1e293b' : '#FFFFFF'),
                                                borderColor: isSelected ? brandedPrimary : (isDark ? '#334155' : '#E5E7EB'),
                                                borderWidth: isSelected ? 2 : 1,
                                            },
                                        ]}
                                        onPress={() => setFormData({ ...formData, compromiso: opt.value })}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.commitmentIcon}>{opt.icon}</Text>
                                        <Text style={[
                                            styles.commitmentLabel,
                                            { color: isSelected ? brandedPrimary : theme.text }
                                        ]}>
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* HERO NUMBER CONTROL - Technical Knowledge */}
                    <View style={[styles.section, { marginTop: 32 }]}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>¿Qué tanto control tienes de ejercicios, técnica, etc.?</Text>
                        <View style={[styles.heroNumberContainer, { backgroundColor: isDark ? '#1e293b' : '#F9FAFB' }]}>
                            {/* Minus Button */}
                            <TouchableOpacity
                                style={[
                                    styles.heroNumberBtn,
                                    {
                                        backgroundColor: isDark ? '#334155' : '#FFFFFF',
                                        borderColor: isDark ? '#475569' : '#E5E7EB',
                                    }
                                ]}
                                onPress={() => setFormData({ ...formData, conocimientoTecnico: Math.max(1, formData.conocimientoTecnico - 1) })}
                            >
                                <Ionicons name="remove" size={28} color={theme.text} />
                            </TouchableOpacity>

                            {/* Hero Number */}
                            <View style={styles.heroNumberCenter}>
                                <Text style={[styles.heroNumber, { color: brandedPrimary }]}>
                                    {formData.conocimientoTecnico}
                                </Text>
                                <Text style={[styles.heroNumberLabel, { color: theme.textSecondary }]}>
                                    {['Novato', 'Básico', 'Me defiendo', 'Soy bueno', 'Pro total'][formData.conocimientoTecnico - 1] || 'Medio'}
                                </Text>
                            </View>

                            {/* Plus Button */}
                            <TouchableOpacity
                                style={[
                                    styles.heroNumberBtn,
                                    {
                                        backgroundColor: isDark ? '#334155' : '#FFFFFF',
                                        borderColor: isDark ? '#475569' : '#E5E7EB',
                                    }
                                ]}
                                onPress={() => setFormData({ ...formData, conocimientoTecnico: Math.min(5, formData.conocimientoTecnico + 1) })}
                            >
                                <Ionicons name="add" size={28} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: theme.background, paddingBottom: insets.bottom + 20 }]}>
                    <TouchableOpacity style={[styles.footerButton, { borderColor: theme.border }]} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={20} color={theme.text} />
                        <Text style={[styles.footerButtonText, { color: theme.text }]}>Atrás</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: brandedPrimary }]}
                        onPress={handleNext}
                    >
                        <Text style={styles.primaryButtonText}>Siguiente</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // STEP 4: STYLE, CARDIO, DIET
    if (currentStep === 4) {
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

                <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContentContainer}>
                    <Text style={[styles.screenTitle, { color: theme.text }]}>Tu estilo de entreno y dieta</Text>
                    <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>Unas pocas más y ya está</Text>

                    {/* ══════════════ TARJETA 1: BLOQUE ENTRENAMIENTO ══════════════ */}
                    <View style={[styles.luxuryContainerCard, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF' }]}>
                        <Text style={[styles.luxuryContainerTitle, { color: theme.text }]}>🏋️ Entrenamiento</Text>

                        {/* Tipo de entreno */}
                        <View style={styles.luxuryContainerSection}>
                            <Text style={[styles.luxuryContainerLabel, { color: theme.textSecondary }]}>¿Qué tipo de entreno te va más?</Text>
                            <View style={styles.luxuryGrid2Col}>
                                {tipoOpts.map((opt) => {
                                    const isSelected = formData.tipoEntreno === opt.value;
                                    return (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.luxuryGridItem,
                                                {
                                                    backgroundColor: isSelected ? brandedPrimary + '15' : (isDark ? '#334155' : '#F9FAFB'),
                                                    borderColor: isSelected ? brandedPrimary : (isDark ? '#475569' : '#E5E7EB'),
                                                    borderWidth: isSelected ? 2 : 1,
                                                },
                                            ]}
                                            onPress={() => setFormData({ ...formData, tipoEntreno: opt.value })}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.luxuryGridText, { color: isSelected ? brandedPrimary : theme.text }]}>
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Cardio */}
                        <View style={[styles.luxuryContainerSection, { marginTop: 20 }]}>
                            <Text style={[styles.luxuryContainerLabel, { color: theme.textSecondary }]}>Sobre el cardio…</Text>
                            <View style={styles.luxuryCardStack}>
                                {cardioOpts.map((opt) => {
                                    const isSelected = formData.cardio === opt.value;
                                    return (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.luxuryOptionCard,
                                                {
                                                    backgroundColor: isSelected ? brandedPrimary + '15' : (isDark ? '#334155' : '#F9FAFB'),
                                                    borderColor: isSelected ? brandedPrimary : (isDark ? '#475569' : '#E5E7EB'),
                                                    borderWidth: isSelected ? 2 : 1,
                                                },
                                            ]}
                                            onPress={() => setFormData({ ...formData, cardio: opt.value })}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.luxuryOptionText, { color: isSelected ? brandedPrimary : theme.text }]}>
                                                {opt.label}
                                            </Text>
                                            {isSelected && <Ionicons name="checkmark-circle" size={22} color={brandedPrimary} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </View>

                    {/* ══════════════ TARJETA 2: BLOQUE NUTRICIÓN ══════════════ */}
                    <View style={[styles.luxuryContainerCard, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', marginTop: 20 }]}>
                        <Text style={[styles.luxuryContainerTitle, { color: theme.text }]}>🥗 Nutrición</Text>

                        {/* Estilo de dieta */}
                        <View style={styles.luxuryContainerSection}>
                            <Text style={[styles.luxuryContainerLabel, { color: theme.textSecondary }]}>Tu estilo de dieta ahora mismo es…</Text>
                            <View style={styles.luxuryCardStack}>
                                {dietaOpts.map((opt) => {
                                    const isSelected = formData.dieta === opt.value;
                                    return (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.luxuryOptionCard,
                                                {
                                                    backgroundColor: isSelected ? brandedPrimary + '15' : (isDark ? '#334155' : '#F9FAFB'),
                                                    borderColor: isSelected ? brandedPrimary : (isDark ? '#475569' : '#E5E7EB'),
                                                    borderWidth: isSelected ? 2 : 1,
                                                },
                                            ]}
                                            onPress={() => setFormData({ ...formData, dieta: opt.value })}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.luxuryOptionText, { color: isSelected ? brandedPrimary : theme.text }]}>
                                                {opt.label}
                                            </Text>
                                            {isSelected && <Ionicons name="checkmark-circle" size={22} color={brandedPrimary} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Comidas al día - Hero Number */}
                        <View style={[styles.luxuryContainerSection, { marginTop: 20 }]}>
                            <Text style={[styles.luxuryContainerLabel, { color: theme.textSecondary }]}>¿Cuántas comidas haces al día?</Text>
                            <View style={[styles.heroNumberContainer, { backgroundColor: isDark ? '#334155' : '#F9FAFB' }]}>
                                <TouchableOpacity
                                    style={[styles.heroNumberBtn, { backgroundColor: isDark ? '#475569' : '#FFFFFF', borderColor: isDark ? '#64748b' : '#E5E7EB' }]}
                                    onPress={() => setFormData({ ...formData, comidasDia: Math.max(2, formData.comidasDia - 1) })}
                                >
                                    <Ionicons name="remove" size={28} color={theme.text} />
                                </TouchableOpacity>
                                <View style={styles.heroNumberCenter}>
                                    <Text style={[styles.heroNumber, { color: brandedPrimary }]}>{formData.comidasDia}</Text>
                                    <Text style={[styles.heroNumberLabel, { color: theme.textSecondary }]}>comidas</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.heroNumberBtn, { backgroundColor: isDark ? '#475569' : '#FFFFFF', borderColor: isDark ? '#64748b' : '#E5E7EB' }]}
                                    onPress={() => setFormData({ ...formData, comidasDia: Math.min(6, formData.comidasDia + 1) })}
                                >
                                    <Ionicons name="add" size={28} color={theme.text} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* ══════════════ TARJETA 3: BLOQUE PREFERENCIAS ══════════════ */}
                    <View style={[styles.luxuryContainerCard, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', marginTop: 20, marginBottom: 20 }]}>
                        <Text style={[styles.luxuryContainerTitle, { color: theme.text }]}>💪 Preferencias</Text>

                        {/* Ejercicios que disfrutas - Grid 2 cols con checkmarks */}
                        <View style={styles.luxuryContainerSection}>
                            <Text style={[styles.luxuryContainerLabel, { color: theme.textSecondary }]}>¿Qué ejercicios disfrutas más?</Text>
                            <View style={styles.luxuryGrid2Col}>
                                {ejerciciosFavOpts.map((opt) => {
                                    const isSelected = formData.ejerciciosFavoritos.includes(opt);
                                    return (
                                        <TouchableOpacity
                                            key={opt}
                                            style={[
                                                styles.luxuryGridItemMulti,
                                                {
                                                    backgroundColor: isSelected ? brandedPrimary + '15' : (isDark ? '#334155' : '#F9FAFB'),
                                                    borderColor: isSelected ? brandedPrimary : (isDark ? '#475569' : '#E5E7EB'),
                                                    borderWidth: isSelected ? 2 : 1,
                                                },
                                            ]}
                                            onPress={() => toggleArrayItem('ejerciciosFavoritos', opt)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons
                                                name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                                                size={18}
                                                color={isSelected ? brandedPrimary : (isDark ? '#475569' : '#D1D5DB')}
                                                style={{ marginRight: 8 }}
                                            />
                                            <Text style={[styles.luxuryGridText, { color: isSelected ? brandedPrimary : theme.text, flex: 1 }]}>
                                                {opt}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Ejercicios que evitas */}
                        <View style={[styles.luxuryContainerSection, { marginTop: 20 }]}>
                            <Text style={[styles.luxuryContainerLabel, { color: theme.textSecondary }]}>¿Qué sueles evitar?</Text>
                            <View style={styles.luxuryGrid2Col}>
                                {ejerciciosEvitOpts.map((opt) => {
                                    const isSelected = formData.ejerciciosEvitados.includes(opt);
                                    return (
                                        <TouchableOpacity
                                            key={opt}
                                            style={[
                                                styles.luxuryGridItemMulti,
                                                {
                                                    backgroundColor: isSelected ? brandedPrimary + '15' : (isDark ? '#334155' : '#F9FAFB'),
                                                    borderColor: isSelected ? brandedPrimary : (isDark ? '#475569' : '#E5E7EB'),
                                                    borderWidth: isSelected ? 2 : 1,
                                                },
                                            ]}
                                            onPress={() => toggleArrayItem('ejerciciosEvitados', opt)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons
                                                name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                                                size={18}
                                                color={isSelected ? brandedPrimary : (isDark ? '#475569' : '#D1D5DB')}
                                                style={{ marginRight: 8 }}
                                            />
                                            <Text style={[styles.luxuryGridText, { color: isSelected ? brandedPrimary : theme.text, flex: 1 }]}>
                                                {opt}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </View>
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: theme.background, paddingBottom: insets.bottom + 20 }]}>
                    <TouchableOpacity style={[styles.footerButton, { borderColor: theme.border }]} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={20} color={theme.text} />
                        <Text style={[styles.footerButtonText, { color: theme.text }]}>Atrás</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: brandedPrimary }]}
                        onPress={handleNext}
                    >
                        <Text style={styles.primaryButtonText}>Siguiente</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // STEP 5: HEALTH & HABITS
    if (currentStep === 5) {
        const lesionesGrid = ['Rodilla', 'Espalda baja', 'Hombro', 'Codo/Muñeca'];

        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[styles.header, { backgroundColor: theme.background }]}>
                    <Text style={[styles.progressText, { color: theme.textSecondary }]}>Paso 4 de 6</Text>
                </View>

                <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContentContainer}>
                    <Text style={[styles.screenTitle, { color: theme.text }]}>Salud y hábitos</Text>
                    <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>
                        Esto es importante para cuidarte, no para juzgarte
                    </Text>

                    {/* ══════════════ TARJETA 1: LESIONES ══════════════ */}
                    <View style={[styles.luxuryContainerCard, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF' }]}>
                        <Text style={[styles.luxuryContainerTitle, { color: theme.text }]}>🩹 Lesiones o Molestias</Text>

                        <View style={styles.luxuryGrid2Col}>
                            {lesionesGrid.map((opt) => {
                                const isSelected = formData.lesiones.includes(opt);
                                return (
                                    <TouchableOpacity
                                        key={opt}
                                        style={[
                                            styles.luxuryGridItemMulti,
                                            {
                                                backgroundColor: isSelected ? brandedPrimary + '15' : (isDark ? '#334155' : '#F9FAFB'),
                                                borderColor: isSelected ? brandedPrimary : (isDark ? '#475569' : '#E5E7EB'),
                                                borderWidth: isSelected ? 2 : 1,
                                            },
                                        ]}
                                        onPress={() => toggleArrayItem('lesiones', opt)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons
                                            name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                                            size={18}
                                            color={isSelected ? brandedPrimary : (isDark ? '#475569' : '#D1D5DB')}
                                            style={{ marginRight: 8 }}
                                        />
                                        <Text style={[styles.luxuryGridText, { color: isSelected ? brandedPrimary : theme.text, flex: 1 }]}>
                                            {opt}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Ninguna - Full Width at bottom */}
                        <TouchableOpacity
                            style={[
                                styles.slimCard,
                                {
                                    marginTop: 10,
                                    backgroundColor: formData.lesiones.includes('Ninguna') ? brandedPrimary + '15' : (isDark ? '#334155' : '#F9FAFB'),
                                    borderColor: formData.lesiones.includes('Ninguna') ? brandedPrimary : (isDark ? '#475569' : '#E5E7EB'),
                                    borderWidth: formData.lesiones.includes('Ninguna') ? 2 : 1,
                                },
                            ]}
                            onPress={() => toggleArrayItem('lesiones', 'Ninguna')}
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                styles.slimCardText,
                                { color: formData.lesiones.includes('Ninguna') ? brandedPrimary : theme.text }
                            ]}>
                                ✨ Ninguna, estoy perfecto
                            </Text>
                            <Ionicons
                                name={formData.lesiones.includes('Ninguna') ? "checkmark-circle" : "ellipse-outline"}
                                size={22}
                                color={formData.lesiones.includes('Ninguna') ? brandedPrimary : (isDark ? '#475569' : '#D1D5DB')}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* ══════════════ TARJETA 2: ALERGIAS ══════════════ */}
                    <View style={[styles.luxuryContainerCard, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', marginTop: 12 }]}>
                        <Text style={[styles.luxuryContainerTitle, { color: theme.text }]}>⚠️ Intolerancias</Text>

                        <Text style={[styles.luxuryContainerLabel, { color: theme.textSecondary }]}>
                            ¿Tienes alguna alergia alimentaria?
                        </Text>

                        {/* Yes/No Selection */}
                        <View style={styles.commitmentRow}>
                            <TouchableOpacity
                                style={[
                                    styles.commitmentSquare,
                                    {
                                        backgroundColor: !formData.tieneAlergias ? brandedPrimary + '15' : (isDark ? '#334155' : '#F9FAFB'),
                                        borderColor: !formData.tieneAlergias ? brandedPrimary : (isDark ? '#475569' : '#E5E7EB'),
                                        borderWidth: !formData.tieneAlergias ? 2 : 1,
                                        paddingVertical: 14,
                                    },
                                ]}
                                onPress={() => setFormData({ ...formData, tieneAlergias: false, alergias: '' })}
                                activeOpacity={0.8}
                            >
                                <Text style={{ fontSize: 22, marginBottom: 4 }}>😊</Text>
                                <Text style={[
                                    styles.commitmentLabel,
                                    { color: !formData.tieneAlergias ? brandedPrimary : theme.text }
                                ]}>
                                    No
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.commitmentSquare,
                                    {
                                        backgroundColor: formData.tieneAlergias ? brandedPrimary + '15' : (isDark ? '#334155' : '#F9FAFB'),
                                        borderColor: formData.tieneAlergias ? brandedPrimary : (isDark ? '#475569' : '#E5E7EB'),
                                        borderWidth: formData.tieneAlergias ? 2 : 1,
                                        paddingVertical: 14,
                                    },
                                ]}
                                onPress={() => setFormData({ ...formData, tieneAlergias: true })}
                                activeOpacity={0.8}
                            >
                                <Text style={{ fontSize: 22, marginBottom: 4 }}>⚠️</Text>
                                <Text style={[
                                    styles.commitmentLabel,
                                    { color: formData.tieneAlergias ? brandedPrimary : theme.text }
                                ]}>
                                    Sí
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Conditional Text Input */}
                        {formData.tieneAlergias && (
                            <TextInput
                                style={[
                                    styles.textInput,
                                    {
                                        marginTop: 16,
                                        color: theme.text,
                                        borderColor: 'transparent',
                                        backgroundColor: isDark ? '#334155' : '#F5F5F5',
                                        borderRadius: 16,
                                        minHeight: 60,
                                        textAlignVertical: 'top',
                                        paddingTop: 14,
                                    }
                                ]}
                                placeholder="Ej: Gluten, Lactosa, Frutos secos..."
                                placeholderTextColor={theme.textSecondary}
                                value={formData.alergias}
                                onChangeText={(text) => setFormData({ ...formData, alergias: text })}
                                multiline
                            />
                        )}
                    </View>

                    {/* ══════════════ TARJETA 3: COCINA ══════════════ */}
                    <View style={[styles.luxuryContainerCard, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', marginTop: 12, marginBottom: 16 }]}>
                        <Text style={[styles.luxuryContainerTitle, { color: theme.text }]}>👨‍🍳 Cocina</Text>

                        <Text style={[styles.luxuryContainerLabel, { color: theme.textSecondary }]}>
                            ¿Sueles cocinar tú?
                        </Text>

                        <View style={styles.commitmentRow}>
                            <TouchableOpacity
                                style={[
                                    styles.commitmentSquare,
                                    {
                                        backgroundColor: formData.cocina === 'si' ? brandedPrimary + '15' : (isDark ? '#334155' : '#F9FAFB'),
                                        borderColor: formData.cocina === 'si' ? brandedPrimary : (isDark ? '#475569' : '#E5E7EB'),
                                        borderWidth: formData.cocina === 'si' ? 2 : 1,
                                        paddingVertical: 14,
                                    },
                                ]}
                                onPress={() => setFormData({ ...formData, cocina: 'si' })}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.commitmentIcon, { fontSize: 22, marginBottom: 4 }]}>🔥</Text>
                                <Text style={[
                                    styles.commitmentLabel,
                                    { color: formData.cocina === 'si' ? brandedPrimary : theme.text }
                                ]}>
                                    Casi siempre
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.commitmentSquare,
                                    {
                                        backgroundColor: formData.cocina === 'no' ? brandedPrimary + '15' : (isDark ? '#334155' : '#F9FAFB'),
                                        borderColor: formData.cocina === 'no' ? brandedPrimary : (isDark ? '#475569' : '#E5E7EB'),
                                        borderWidth: formData.cocina === 'no' ? 2 : 1,
                                        paddingVertical: 14,
                                    },
                                ]}
                                onPress={() => setFormData({ ...formData, cocina: 'no' })}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.commitmentIcon, { fontSize: 22, marginBottom: 4 }]}>🛵</Text>
                                <Text style={[
                                    styles.commitmentLabel,
                                    { color: formData.cocina === 'no' ? brandedPrimary : theme.text }
                                ]}>
                                    Casi nunca
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: theme.background, paddingBottom: insets.bottom + 20 }]}>
                    <TouchableOpacity style={[styles.footerButton, { borderColor: theme.border }]} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={20} color={theme.text} />
                        <Text style={[styles.footerButtonText, { color: theme.text }]}>Atrás</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: brandedPrimary }]}
                        onPress={handleNext}
                    >
                        <Text style={styles.primaryButtonText}>Siguiente</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // STEP 6: PREMIUM UPSELL
    if (currentStep === 6) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <ScrollView
                    style={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.centeredScrollContent}
                >
                    <View style={styles.upsellContent}>
                        <Ionicons name="trophy" size={80} color={brandedPrimary} />
                        <Text style={[styles.welcomeTitle, { color: theme.text }]}>
                            Para sacarle TODO el jugo a la app…
                        </Text>
                        <Text style={[styles.welcomeSubtitle, { color: theme.textSecondary }]}>
                            Con la versión Premium desbloqueas tu experiencia completa.
                        </Text>

                        <View style={styles.benefitsList}>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={24} color={brandedPrimary} />
                                <Text style={[styles.benefitText, { color: theme.text }]}>
                                    Rutinas personalizadas actualizadas por tu entrenador
                                </Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={24} color={brandedPrimary} />
                                <Text style={[styles.benefitText, { color: theme.text }]}>
                                    Histórico de cargas y seguimiento de progreso
                                </Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={24} color={brandedPrimary} />
                                <Text style={[styles.benefitText, { color: theme.text }]}>
                                    Acceso prioritario a soporte y ajustes de rutina
                                </Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={24} color={brandedPrimary} />
                                <Text style={[styles.benefitText, { color: theme.text }]}>
                                    Más herramientas de análisis y métricas de rendimiento
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: brandedPrimary }]}
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

    // STEP 7: FINAL MESSAGE
    if (currentStep === 7) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <ScrollView
                    style={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.centeredScrollContent}
                >
                    <View style={styles.finishContent}>
                        <Ionicons name="rocket" size={80} color={brandedPrimary} />
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
                            style={[styles.primaryButton, { backgroundColor: brandedPrimary }]}
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
        flex: 1,
    },
    scrollContentContainer: {
        padding: 20,
        paddingBottom: 20,
    },
    centeredScrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 40,
    },
    welcomeContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    upsellContent: {
        alignItems: 'center',
        paddingHorizontal: 20,
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
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 6,
        textAlign: 'center',
    },
    screenSubtitle: {
        fontSize: 14,
        marginBottom: 18,
        textAlign: 'center',
    },
    section: {
        marginBottom: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    fieldLabel: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8,
    },
    numericInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        minHeight: 48,
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 15,
        minHeight: 48,
    },
    inputHint: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1.5,
        marginBottom: 4,
        minHeight: 40,
    },
    chipText: {
        fontSize: 14,
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
        width: 44,
        height: 44,
        borderRadius: 22,
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
        alignItems: 'center',
        paddingHorizontal: 20,
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
        paddingVertical: 14,
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 1,
        borderWidth: 1,
        minHeight: 50, // iOS área táctil
    },
    invitationButton: {
        width: 50,
        height: 50,
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
        paddingTop: 60,
        paddingBottom: 40,
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
        paddingVertical: 14,
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 1,
        borderWidth: 1,
        minHeight: 50, // iOS área táctil
    },
    promoCodeButton: {
        width: 50,
        height: 50,
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
        paddingVertical: 16,
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 2,
        borderWidth: 1,
        textAlign: 'center',
        minHeight: 56, // iOS área táctil
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
    // LUXURY ROLE SELECTOR STYLES
    luxuryInputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        height: 56,
    },
    luxuryInput: {
        flex: 1,
        height: '100%',
        paddingHorizontal: 16,
        fontSize: 15,
        color: '#1e293b',
    },
    luxuryInputBtn: {
        width: 56,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(0,0,0,0.05)',
    },
    luxuryTrialContainer: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(0,0,0,0.1)',
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    luxuryTrialText: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 12,
        color: '#1e293b',
    },
    luxuryPillButton: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 100,
        minWidth: 140,
        alignItems: 'center',
    },
    luxuryPillText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFF',
    },
    // BIG DATA STYLES (Step 2 redesign)
    bigDataRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
        marginTop: 8,
    },
    bigDataCard: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    bigDataLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    bigDataValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    bigDataInput: {
        width: '100%',
        fontSize: 26,
        fontWeight: '800',
        textAlign: 'center',
        padding: 0,
    },
    bigDataUnit: {
        fontSize: 14,
        fontWeight: '500',
    },
    genderButtonsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    genderButton: {
        flex: 1,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    genderButtonText: {
        fontSize: 13,
        fontWeight: '600',
    },
    objectiveGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        width: '100%',
    },
    objectiveCard: {
        flexBasis: '46%',
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    objectiveText: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    // LUXURY CARD STACK STYLES (Step 3 redesign)
    luxuryCardStack: {
        gap: 10,
    },
    // SLIM CARD STYLES (más finas)
    slimCard: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    slimCardText: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    // COMMITMENT SQUARE STYLES (horizontal row)
    commitmentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    commitmentSquare: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        paddingVertical: 18,
        paddingHorizontal: 12,
    },
    commitmentIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    commitmentLabel: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    luxuryOptionCard: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    luxuryOptionText: {
        fontSize: 15,
        fontWeight: '600',
    },
    // HERO NUMBER CONTROL STYLES
    heroNumberContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        paddingHorizontal: 12,
        borderRadius: 20,
        gap: 16,
    },
    heroNumberBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    heroNumberCenter: {
        alignItems: 'center',
        minWidth: 80,
    },
    heroNumber: {
        fontSize: 44,
        fontWeight: '800',
        lineHeight: 52,
    },
    heroNumberLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginTop: 4,
    },
    // LUXURY CONTAINER CARD STYLES (Step 4 redesign)
    luxuryContainerCard: {
        padding: 18,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    luxuryContainerTitle: {
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 14,
    },
    luxuryContainerSection: {
        // Container section wrapper
    },
    luxuryContainerLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 10,
    },
    luxuryGrid2Col: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    luxuryGridItem: {
        flexBasis: '45%',
        flexGrow: 1,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    luxuryGridItemMulti: {
        flexBasis: '45%',
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    luxuryGridText: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    recommendedBadge: {
        position: 'absolute',
        top: -10,
        right: 16,
        backgroundColor: '#10B981',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    recommendedText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
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
    // ═══════════════════════════════════════════════════════════════════════════
    // LUXURY WELCOME SCREEN STYLES (Step 0 - White Label Premium)
    // ═══════════════════════════════════════════════════════════════════════════
    luxuryWelcomeContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    luxuryWelcomeBranding: {
        alignItems: 'center',
        marginBottom: 32,
    },
    luxuryWelcomeLogo: {
        width: 120,
        height: 120,
        borderRadius: 24,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 12,
    },
    luxuryWelcomeTrainerName: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    luxuryWelcomeCard: {
        width: '100%',
        maxWidth: 400,
        padding: 28,
        borderRadius: 24,
        borderWidth: 1,
        marginBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    luxuryWelcomeTitle: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 12,
    },
    luxuryWelcomeBody: {
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'center',
    },
    luxuryWelcomeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 36,
        borderRadius: 16,
        gap: 8,
        minWidth: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
    },
    luxuryWelcomeButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
});
