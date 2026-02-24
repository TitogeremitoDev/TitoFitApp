// app/(coach)/branding/index.jsx
// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA DE BRANDING CON IA - Experiencia inmersiva con vista previa
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    Modal,
    Image,
} from 'react-native';
import { useStableWindowDimensions } from '../../../src/hooks/useStableBreakpoint';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../../../components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { ImageCropper } from '../../../src/components/shared/ImageCropper';
import { coachLogoService } from '../../../src/services/coachLogoService';
import { useCoachBranding } from '../../../context/CoachBrandingContext';
import PhonePreview from './PhonePreview';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

export default function BrandingScreen() {
    const router = useRouter();
    const { token, user } = useAuth();
    const { refresh: refreshBranding } = useCoachBranding();
    const { width } = useStableWindowDimensions();
    const isLargeScreen = width > 720;

    // Estados
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [brandingData, setBrandingData] = useState(null);
    const [selectedVariantId, setSelectedVariantId] = useState(null); // Para preview
    const [selectedFont, setSelectedFont] = useState(null);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);

    // ═══════ Estados para Multi-Theme Selection ═══════
    const [activeVariants, setActiveVariants] = useState([]); // IDs de temas activos (1-3)
    const [defaultVariant, setDefaultVariant] = useState(null); // ID del tema por defecto

    // ═══════ Estados para Logo OFICIAL del Entrenador (se guarda en perfil) ═══════
    const [officialLogoSource, setOfficialLogoSource] = useState('url'); // 'url' | 'upload'
    const [officialLogoUrl, setOfficialLogoUrl] = useState('');
    const [croppingOfficialLogo, setCroppingOfficialLogo] = useState(null);
    const [tempOfficialLogoUri, setTempOfficialLogoUri] = useState(null);
    const [showOfficialPhotoOptions, setShowOfficialPhotoOptions] = useState(false);
    const [isUploadingOfficial, setIsUploadingOfficial] = useState(false);

    // ═══════ Estados para Imagen de Análisis IA (solo para generar temas) ═══════
    const [iaImageSource, setIaImageSource] = useState('url'); // 'url' | 'upload'
    const [iaImageUrl, setIaImageUrl] = useState('');
    const [croppingIaImage, setCroppingIaImage] = useState(null);
    const [tempIaImageUri, setTempIaImageUri] = useState(null);
    const [showIaPhotoOptions, setShowIaPhotoOptions] = useState(false);
    const [isUploadingIa, setIsUploadingIa] = useState(false);


    const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '', type: 'info' });

    // Función para mostrar alertas cross-platform
    const showAlert = (title, message, type = 'info') => {
        setAlertModal({ visible: true, title, message, type });
    };

    // Cargar branding actual
    useEffect(() => {
        loadCurrentBranding();
    }, []);

    const loadCurrentBranding = async () => {
        try {
            const response = await fetch(`${API_URL}/api/coach/branding/current`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && data.branding) {
                // Cargar configuración de multi-theme desde el servidor
                if (data.branding.activeThemes?.length > 0) {
                    // Nuevo formato: Usar activeThemes
                    const variantIds = data.branding.activeThemes.map(t => t.id);
                    setActiveVariants(variantIds);
                    setDefaultVariant(data.branding.defaultVariantId || variantIds[0]);
                    setSelectedVariantId(data.branding.defaultVariantId || variantIds[0]);
                } else if (data.branding.variantId) {
                    // Legacy format fallback
                    setActiveVariants([data.branding.variantId]);
                    setDefaultVariant(data.branding.variantId);
                    setSelectedVariantId(data.branding.variantId);
                }

                setSelectedFont(data.branding.fontFamily || 'System');
            }
            // Cargar logo oficial actual del usuario si existe
            if (user?.trainerProfile?.logoUrl) {
                setOfficialLogoUrl(user.trainerProfile.logoUrl);
            }

        } catch (error) {
            console.error('[Branding] Error loading:', error);
        } finally {
            setLoading(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // MULTI-THEME SELECTION HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    const toggleVariantActive = (variantId) => {
        setActiveVariants(prev => {
            if (prev.includes(variantId)) {
                // Desactivar - pero debe quedar al menos 1 activo
                if (prev.length <= 1) {
                    return prev; // No permitir desactivar el último
                }
                // Si estamos desactivando el default, cambiar el default
                if (defaultVariant === variantId) {
                    const remaining = prev.filter(id => id !== variantId);
                    setDefaultVariant(remaining[0]);
                }
                return prev.filter(id => id !== variantId);
            } else {
                // Activar
                return [...prev, variantId];
            }
        });
    };

    const setAsDefault = (variantId) => {
        // Primero asegurar que esté activo
        if (!activeVariants.includes(variantId)) {
            setActiveVariants(prev => [...prev, variantId]);
        }
        setDefaultVariant(variantId);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // OFFICIAL LOGO HANDLERS (para perfil del entrenador - rectangular)
    // ═══════════════════════════════════════════════════════════════════════════

    const handlePickOfficialLogo = async () => {
        setShowOfficialPhotoOptions(false);
        // iOS: esperar a que el modal se cierre antes de presentar el picker
        if (Platform.OS === 'ios') {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showAlert('Permiso necesario', 'Se necesita acceso a la galería.', 'warning');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 1,
            });
            if (!result.canceled) {
                // iOS: esperar a que el picker se cierre antes de presentar el cropper
                if (Platform.OS === 'ios') {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
                setCroppingOfficialLogo(result.assets[0].uri);
            }
        } catch (error) {
            console.error('[Branding] Error picking official logo:', error);
            showAlert('Error', 'No se pudo seleccionar la imagen', 'error');
        }
    };

    const handleOfficialCropComplete = async (croppedUri) => {
        setCroppingOfficialLogo(null);
        setIsUploadingOfficial(true);
        setTempOfficialLogoUri(croppedUri);

        try {
            const newLogoUrl = await coachLogoService.uploadLogo(croppedUri, token);
            console.log('[Branding] Official logo uploaded:', newLogoUrl);
            setOfficialLogoUrl(newLogoUrl);
            setTempOfficialLogoUri(null);
            showAlert('¡Logo guardado!', 'Tu logo oficial ha sido actualizado.', 'success');
        } catch (error) {
            console.error('[Branding] Official logo upload failed:', error);
            showAlert('Error', error.message || 'Falló la subida del logo.', 'error');
            setTempOfficialLogoUri(null);
        } finally {
            setIsUploadingOfficial(false);
        }
    };

    const handleSaveOfficialLogo = async () => {
        if (!officialLogoUrl) {
            showAlert('Error', 'Debes ingresar una URL o subir una imagen.', 'warning');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/trainers/profile/logo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ logoUrl: officialLogoUrl })
            });

            const data = await response.json();

            if (data.success) {
                showAlert('Guardado', 'Tu logo oficial se ha actualizado correctamente.', 'success');
            } else {
                throw new Error(data.message || 'Error al guardar');
            }
        } catch (error) {
            console.error('[Branding] Save logo error:', error);
            showAlert('Error', 'No se pudo guardar el logo.', 'error');
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // IA IMAGE HANDLERS (solo para análisis de IA - no afecta perfil)
    // ═══════════════════════════════════════════════════════════════════════════

    const handlePickIaImage = async () => {
        setShowIaPhotoOptions(false);
        // iOS: esperar a que el modal se cierre antes de presentar el picker
        if (Platform.OS === 'ios') {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showAlert('Permiso necesario', 'Se necesita acceso a la galería.', 'warning');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 1,
            });
            if (!result.canceled) {
                // iOS: esperar a que el picker se cierre antes de presentar el cropper
                if (Platform.OS === 'ios') {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
                setCroppingIaImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error('[Branding] Error picking IA image:', error);
            showAlert('Error', 'No se pudo seleccionar la imagen', 'error');
        }
    };

    const handleIaCropComplete = async (croppedUri) => {
        setCroppingIaImage(null);
        // Para la imagen IA, NO la subimos al perfil
        // Solo guardamos la URI local para usarla en handleGenerateBranding
        setIaImageUrl(croppedUri);
        setTempIaImageUri(null);
        // La imagen se subirá como FormData cuando el usuario pulse "Generar"
    };

    const handleGenerateBranding = async (sourceUrl) => {
        setGenerating(true);

        try {
            // Usar imagen de IA si se proporcionó, sino la URL manual
            const uriToFetch = sourceUrl || iaImageUrl;
            console.log('Generating branding from:', uriToFetch);

            if (!uriToFetch) {
                showAlert('Error', 'No hay una imagen seleccionada para generar el branding.', 'warning');
                setGenerating(false);
                return;
            }

            let response;

            // Lógica bifurcada: URL Remota vs Archivo Local
            if (uriToFetch.startsWith('http')) {
                // CASO A: URL REMOTA (Backend descarga para evitar CORS)
                console.log('[Branding] Sending URL to backend:', uriToFetch);
                response = await fetch(`${API_URL}/api/coach/branding/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ logoUrl: uriToFetch })
                });

            } else {
                // CASO B: ARCHIVO LOCAL (FormData multipart)
                const formData = new FormData();

                if (Platform.OS === 'web') {
                    // En Web necesitamos un Blob/File real
                    const res = await fetch(uriToFetch);
                    const blob = await res.blob();
                    const file = new File([blob], 'logo.png', { type: 'image/png' });
                    formData.append('logo', file);
                } else {
                    // En Native funciona con { uri, name, type }
                    formData.append('logo', {
                        uri: uriToFetch,
                        name: `logo_${Date.now()}.jpg`,
                        type: 'image/jpeg'
                    });
                }

                console.log('[Branding] Sending file to backend');
                response = await fetch(`${API_URL}/api/coach/branding/generate`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData
                });
            }

            const data = await response.json();

            if (data.success) {
                setBrandingData(data);
                setSelectedVariantId(data.options[0]?.id || 'dark');
                setSelectedFont(data.suggestedFont || 'System');
                // Inicializar multi-theme: todos activos, el primero como default
                const allVariantIds = data.options.map(opt => opt.id);
                setActiveVariants(allVariantIds);
                setDefaultVariant(allVariantIds[0] || 'dark');
            } else {
                throw new Error(data.message || 'Error generando branding');
            }
        } catch (error) {
            console.error('[Branding] Error generating:', error);
            showAlert('Error', error.message || 'No se pudo generar el branding', 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleConfirmActivate = async () => {
        setConfirmModalVisible(false);

        // Validar que hay al menos 1 tema activo
        if (activeVariants.length === 0) {
            showAlert('Error', 'Debes activar al menos 1 tema', 'warning');
            return;
        }

        // Validar que el default está entre los activos
        if (!activeVariants.includes(defaultVariant)) {
            showAlert('Error', 'El tema por defecto debe estar activo', 'warning');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/coach/branding/select`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    activeVariantIds: activeVariants,
                    defaultVariantId: defaultVariant,
                    fontOverride: selectedFont
                })
            });

            const data = await response.json();
            if (data.success) {
                await refreshBranding();
                const msg = activeVariants.length > 1
                    ? `Tus clientes podrán elegir entre ${activeVariants.length} temas.`
                    : 'Tu tema ha sido activado.';
                showAlert('¡Activado!', msg, 'success');
            } else {
                throw new Error(data.message || 'Error al activar');
            }
        } catch (error) {
            console.error('[Branding] Error activating:', error);
            showAlert('Error', error.message || 'No se pudo activar el branding', 'error');
        }
    };

    const handleDeactivate = async () => {
        try {
            await fetch(`${API_URL}/api/coach/branding/deactivate`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            await refreshBranding(); // Actualizar contexto global
            setSelectedVariantId(null);
            setBrandingData(null);
            showAlert('Desactivado', 'Los clientes verán el tema por defecto.', 'info');
        } catch (error) {
            showAlert('Error', 'No se pudo desactivar', 'error');
        }
    };

    // Tema seleccionado actual para preview
    // Helper para contraste simple (blanco/negro)
    const getContrastColor = (hexColor) => {
        // Convertir hex a RGB
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        // Calcular luminancia (fórmula estándar)
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#1e293b' : '#ffffff';
    };

    // Tema seleccionado actual para preview
    const rawTheme = brandingData?.options?.find(opt => opt.id === selectedVariantId)
        || brandingData?.options?.[0]
        || { colors: { primary: '#3b82f6', secondary: '#1e293b', background: '#f8fafc', surface: '#ffffff', text: '#1e293b' } };

    // Inyectar primaryText calculado
    const selectedTheme = {
        ...rawTheme,
        colors: {
            ...rawTheme.colors,
            primaryText: getContrastColor(rawTheme.colors.primary || '#3b82f6')
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Branding con IA</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Generating State */}
            {generating && (
                <View style={styles.generatingOverlay}>
                    <View style={styles.generatingCard}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <Text style={styles.generatingTitle}>Analizando tu marca...</Text>
                        <Text style={styles.generatingSubtitle}>
                            La IA está extrayendo colores, tipografía y mood de tu logo
                        </Text>
                    </View>
                </View>
            )}

            <ScrollView
                style={styles.content}
                contentContainerStyle={[
                    styles.scrollContent,
                    isLargeScreen && styles.scrollContentLarge
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Si no hay branding, mostrar UI inicial refinada */}
                {!brandingData && !generating && (
                    <View style={styles.initialStateContainer}>

                        {/* ═══════════════════════════════════════════════════════════════ */}
                        {/* SECCIÓN 1: LOGO OFICIAL DEL ENTRENADOR (se guarda en perfil) */}
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeaderRow}>
                                <View style={[styles.sectionIconContainer, { backgroundColor: '#10b981' }]}>
                                    <Ionicons name="business" size={24} color="#fff" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sectionTitle}>1. Logo Oficial (Perfil)</Text>
                                    <Text style={styles.sectionDescription}>Este logo lo verán tus clientes. Se guarda en tu perfil.</Text>
                                </View>
                            </View>

                            {/* Toggle URL/Upload */}
                            <View style={styles.segmentedControl}>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, officialLogoSource === 'url' && styles.segmentBtnActive]}
                                    onPress={() => setOfficialLogoSource('url')}
                                >
                                    <Text style={[styles.segmentText, officialLogoSource === 'url' && styles.segmentTextActive]}>Enlace URL</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, officialLogoSource === 'upload' && styles.segmentBtnActive]}
                                    onPress={() => setOfficialLogoSource('upload')}
                                >
                                    <Text style={[styles.segmentText, officialLogoSource === 'upload' && styles.segmentTextActive]}>Subir Imagen</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputArea}>
                                {officialLogoSource === 'url' ? (
                                    <View style={styles.urlInputContainer}>
                                        <Ionicons name="link-outline" size={20} color="#94a3b8" />
                                        <EnhancedTextInput
                                            containerStyle={styles.textInputContainer}
                                            style={styles.textInputText}
                                            value={officialLogoUrl}
                                            onChangeText={setOfficialLogoUrl}
                                            placeholder="https://ejemplo.com/mi-logo.png"
                                            placeholderTextColor="#cbd5e1"
                                            autoCapitalize="none"
                                        />
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.uploadBox}
                                        onPress={() => setShowOfficialPhotoOptions(true)}
                                    >
                                        {tempOfficialLogoUri || officialLogoUrl ? (
                                            <Image source={{ uri: tempOfficialLogoUri || officialLogoUrl }} style={styles.uploadedPreview} resizeMode="contain" />
                                        ) : (
                                            <View style={styles.uploadPlaceholder}>
                                                <Ionicons name="business-outline" size={32} color="#10b981" />
                                                <Text style={styles.uploadPlaceholderText}>Toca para subir logo oficial</Text>
                                            </View>
                                        )}
                                        {isUploadingOfficial && (
                                            <View style={styles.uploadingOverlay}>
                                                <ActivityIndicator color="#fff" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Botón Guardar Logo Manualmente */}
                            <TouchableOpacity
                                style={[styles.generateButton, { marginTop: 16, backgroundColor: '#10b981' }]}
                                onPress={handleSaveOfficialLogo}
                            >
                                <View style={styles.generateButtonGradient}>
                                    <Ionicons name="save-outline" size={20} color="#fff" />
                                    <Text style={styles.generateButtonText}>Guardar Logo</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.connectorLine} />

                        {/* ═══════════════════════════════════════════════════════════════ */}
                        {/* SECCIÓN 2: IMAGEN PARA IA + GENERAR (todo en un solo card) */}
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeaderRow}>
                                <View style={[styles.sectionIconContainer, { backgroundColor: '#8b5cf6' }]}>
                                    <Ionicons name="sparkles" size={24} color="#fff" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sectionTitle}>2. Generar Temas con IA</Text>
                                    <Text style={styles.sectionDescription}>Sube una imagen y la IA creará 3 variantes de tema únicas.</Text>
                                </View>
                            </View>

                            {/* Selector URL/Upload para IA */}
                            <View style={styles.segmentedControl}>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, iaImageSource === 'url' && styles.segmentBtnActive]}
                                    onPress={() => setIaImageSource('url')}
                                >
                                    <Text style={[styles.segmentText, iaImageSource === 'url' && styles.segmentTextActive]}>Enlace URL</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, iaImageSource === 'upload' && styles.segmentBtnActive]}
                                    onPress={() => setIaImageSource('upload')}
                                >
                                    <Text style={[styles.segmentText, iaImageSource === 'upload' && styles.segmentTextActive]}>Subir Imagen</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputArea}>
                                {iaImageSource === 'url' ? (
                                    <View style={styles.urlInputContainer}>
                                        <Ionicons name="link-outline" size={20} color="#94a3b8" />
                                        <EnhancedTextInput
                                            containerStyle={styles.textInputContainer}
                                            style={styles.textInputText}
                                            value={iaImageUrl}
                                            onChangeText={setIaImageUrl}
                                            placeholder="https://ejemplo.com/imagen.png"
                                            placeholderTextColor="#cbd5e1"
                                            autoCapitalize="none"
                                        />
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.uploadBox}
                                        onPress={() => setShowIaPhotoOptions(true)}
                                    >
                                        {iaImageUrl ? (
                                            <Image source={{ uri: iaImageUrl }} style={styles.uploadedPreview} resizeMode="contain" />
                                        ) : (
                                            <View style={styles.uploadPlaceholder}>
                                                <Ionicons name="color-palette-outline" size={32} color="#8b5cf6" />
                                                <Text style={styles.uploadPlaceholderText}>Toca para seleccionar imagen</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Botón Generar - dentro del mismo card */}
                            <TouchableOpacity
                                style={[styles.generateButton, { marginTop: 16 }, !iaImageUrl && styles.generateButtonDisabled]}
                                onPress={() => iaImageUrl && handleGenerateBranding(iaImageUrl)}
                                disabled={!iaImageUrl}
                            >
                                <LinearGradient
                                    colors={!iaImageUrl ? ['#e2e8f0', '#e2e8f0'] : ['#8b5cf6', '#7c3aed']}
                                    style={styles.generateButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Ionicons name="color-wand" size={24} color={!iaImageUrl ? '#94a3b8' : '#fff'} />
                                    <Text style={[styles.generateButtonText, !iaImageUrl && { color: '#94a3b8' }]}>
                                        Generar Branding con IA
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <Text style={styles.aiDisclaimer}>
                                La IA analizará colores y formas para crear 3 propuestas únicas.
                            </Text>
                        </View>

                    </View>
                )}

                {/* Si hay branding, mostrar selector + preview */}
                {brandingData && !generating && (
                    <View style={[styles.mainLayout, isLargeScreen && styles.mainLayoutLarge]}>
                        {/* COLUMNA IZQUIERDA: Selector de variantes */}
                        <View style={[styles.selectorColumn, isLargeScreen && styles.selectorColumnLarge]}>
                            <Text style={styles.sectionTitle}>Elige tu Variante</Text>
                            <Text style={styles.sectionSubtitle}>
                                Mood: <Text style={styles.bold}>{brandingData.mood}</Text>
                            </Text>

                            {/* Selector de Fuente */}
                            <View style={{ marginBottom: 24 }}>
                                <Text style={[styles.sectionTitle, { fontSize: 14, marginBottom: 8 }]}>Tipografía</Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {['System', 'Montserrat-Bold', 'PlayfairDisplay-Bold', 'Oswald-Bold', 'Roboto-Bold'].map(font => (
                                        <TouchableOpacity
                                            key={font}
                                            onPress={() => setSelectedFont(font)}
                                            style={{
                                                paddingHorizontal: 12,
                                                paddingVertical: 8,
                                                borderRadius: 8,
                                                backgroundColor: selectedFont === font ? '#3b82f6' : '#fff',
                                                borderWidth: 1,
                                                borderColor: selectedFont === font ? '#3b82f6' : '#e2e8f0',
                                            }}
                                        >
                                            <Text style={{
                                                color: selectedFont === font ? '#fff' : '#64748b',
                                                fontSize: 12,
                                                fontWeight: '600',
                                                fontFamily: font === 'System' ? undefined : font
                                            }}>
                                                {font === 'System' ? 'Default' : font.split('-')[0]}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Instrucciones para multi-theme */}
                            <View style={{ marginBottom: 16, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd' }}>
                                <Text style={{ fontSize: 13, color: '#0369a1', lineHeight: 18 }}>
                                    <Text style={{ fontWeight: '700' }}>✓ Activo:</Text> Tus clientes podrán elegir este tema{'\n'}
                                    <Text style={{ fontWeight: '700' }}>★ Default:</Text> Tema que verán por defecto
                                </Text>
                            </View>

                            {brandingData.options.map((option) => {
                                const isActive = activeVariants.includes(option.id);
                                const isDefault = defaultVariant === option.id;
                                const isPreviewing = selectedVariantId === option.id;

                                return (
                                    <View
                                        key={option.id}
                                        style={[
                                            styles.variantOption,
                                            isPreviewing && [styles.variantOptionSelected, { borderColor: option.colors.primary }],
                                            !isActive && { opacity: 0.5 }
                                        ]}
                                    >
                                        {/* Checkbox de activación */}
                                        <TouchableOpacity
                                            style={[
                                                styles.themeCheckbox,
                                                isActive && { backgroundColor: '#10b981', borderColor: '#10b981' }
                                            ]}
                                            onPress={() => toggleVariantActive(option.id)}
                                        >
                                            {isActive && <Ionicons name="checkmark" size={14} color="#fff" />}
                                        </TouchableOpacity>

                                        {/* Info del tema (toca para preview) */}
                                        <TouchableOpacity
                                            style={{ flex: 1 }}
                                            onPress={() => setSelectedVariantId(option.id)}
                                        >
                                            <View style={styles.variantInfo}>
                                                <Text style={styles.variantName}>{option.variantName}</Text>
                                                <View style={styles.colorDots}>
                                                    <View style={[styles.colorDot, { backgroundColor: option.colors.background, borderWidth: 1, borderColor: '#e2e8f0' }]} />
                                                    <View style={[styles.colorDot, { backgroundColor: option.colors.primary }]} />
                                                    <View style={[styles.colorDot, { backgroundColor: option.colors.secondary }]} />
                                                </View>
                                            </View>
                                        </TouchableOpacity>

                                        {/* Botón de default (estrella) */}
                                        <TouchableOpacity
                                            style={styles.defaultStarBtn}
                                            onPress={() => setAsDefault(option.id)}
                                        >
                                            <Ionicons
                                                name={isDefault ? "star" : "star-outline"}
                                                size={22}
                                                color={isDefault ? "#f59e0b" : "#cbd5e1"}
                                            />
                                        </TouchableOpacity>

                                        {/* Badge de preview */}
                                        {isPreviewing && (
                                            <View style={[styles.previewBadge, { backgroundColor: option.colors.primary + '20' }]}>
                                                <Text style={[styles.previewBadgeText, { color: option.colors.primary }]}>
                                                    Vista previa
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}

                            {/* Botón Confirmar */}
                            <TouchableOpacity
                                style={[styles.confirmButton, { backgroundColor: selectedTheme.colors.primary }]}
                                onPress={() => setConfirmModalVisible(true)}
                            >
                                <Text style={styles.confirmButtonText}>Confirmar y Activar Tema</Text>
                            </TouchableOpacity>

                            <Text style={styles.helperText}>
                                Podrás cambiar esto en cualquier momento.
                            </Text>

                            {/* Regenerar / Desactivar */}
                            {/* Regenerar / Desactivar */}
                            <View style={styles.actionsRow}>
                                <TouchableOpacity style={styles.secondaryAction} onPress={() => {
                                    setBrandingData(null); // Resetear para volver a subir/elegir logo
                                }}>
                                    <Ionicons name="refresh" size={18} color="#64748b" />
                                    <Text style={styles.secondaryActionText}>
                                        Cambiar Logo / Regenerar
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.dangerAction} onPress={handleDeactivate}>
                                    <Ionicons name="close-circle" size={18} color="#ef4444" />
                                    <Text style={styles.dangerActionText}>Desactivar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* COLUMNA DERECHA: Vista previa del móvil */}
                        <View style={[styles.previewColumn, isLargeScreen && styles.previewColumnLarge]}>
                            <Text style={styles.previewLabel}>VISTA PREVIA EN VIVO</Text>
                            <PhonePreview
                                theme={selectedTheme}
                                fontName={selectedFont || brandingData.suggestedFont}
                                logoUrl={user?.trainerProfile?.logoUrl}
                            />
                        </View>
                    </View>
                )}
            </ScrollView>


            {/* Modal de Confirmación */}
            <Modal
                visible={confirmModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setConfirmModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={[styles.modalIcon, { backgroundColor: selectedTheme.colors.primary + '20' }]}>
                            <Ionicons name="color-palette" size={32} color={selectedTheme.colors.primary} />
                        </View>
                        <Text style={styles.modalTitle}>¿Activar este tema?</Text>
                        <Text style={styles.modalSubtitle}>
                            Tus clientes verán la app en modo {selectedTheme.variantName || 'personalizado'}.
                        </Text>

                        {/* Preview de colores */}
                        <View style={styles.colorPreviewRow}>
                            <View style={[styles.colorPreviewDot, { backgroundColor: selectedTheme.colors.primary }]} />
                            <View style={[styles.colorPreviewDot, { backgroundColor: selectedTheme.colors.background, borderWidth: 1, borderColor: '#ccc' }]} />
                            <View style={[styles.colorPreviewDot, { backgroundColor: selectedTheme.colors.secondary }]} />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setConfirmModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.activateButton, { backgroundColor: selectedTheme.colors.primary }]}
                                onPress={handleConfirmActivate}
                            >
                                <Ionicons name="checkmark" size={18} color="#fff" />
                                <Text style={styles.activateButtonText}>Sí, Activar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal de Alerta (cross-platform) */}
            <Modal
                visible={alertModal.visible}
                transparent
                animationType="fade"
                onRequestClose={() => setAlertModal({ ...alertModal, visible: false })}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.alertModalCard}>
                        <View style={[
                            styles.alertIcon,
                            {
                                backgroundColor: alertModal.type === 'error' ? '#fee2e2'
                                    : alertModal.type === 'success' ? '#dcfce7'
                                        : alertModal.type === 'warning' ? '#fef3c7'
                                            : '#e0f2fe'
                            }
                        ]}>
                            <Ionicons
                                name={
                                    alertModal.type === 'error' ? 'alert-circle'
                                        : alertModal.type === 'success' ? 'checkmark-circle'
                                            : alertModal.type === 'warning' ? 'warning'
                                                : 'information-circle'
                                }
                                size={32}
                                color={
                                    alertModal.type === 'error' ? '#ef4444'
                                        : alertModal.type === 'success' ? '#22c55e'
                                            : alertModal.type === 'warning' ? '#f59e0b'
                                                : '#3b82f6'
                                }
                            />
                        </View>
                        <Text style={styles.alertTitle}>{alertModal.title}</Text>
                        <Text style={styles.alertMessage}>{alertModal.message}</Text>
                        <TouchableOpacity
                            style={[
                                styles.alertButton,
                                {
                                    backgroundColor: alertModal.type === 'error' ? '#ef4444'
                                        : alertModal.type === 'success' ? '#22c55e'
                                            : alertModal.type === 'warning' ? '#f59e0b'
                                                : '#3b82f6'
                                }
                            ]}
                            onPress={() => setAlertModal({ ...alertModal, visible: false })}
                        >
                            <Text style={styles.alertButtonText}>Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {/* Photo Options Modal - LOGO OFICIAL */}
            <Modal
                visible={showOfficialPhotoOptions}
                transparent
                animationType="fade"
                onRequestClose={() => setShowOfficialPhotoOptions(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowOfficialPhotoOptions(false)}
                >
                    <View style={styles.menuModalCard}>
                        <Text style={styles.menuModalTitle}>Logo Oficial</Text>

                        <TouchableOpacity style={styles.menuModalOption} onPress={handlePickOfficialLogo}>
                            <Ionicons name="images" size={24} color="#10b981" />
                            <Text style={styles.menuModalOptionText}>Elegir de Galería</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.menuModalOption, styles.menuModalCancelOption]}
                            onPress={() => setShowOfficialPhotoOptions(false)}
                        >
                            <Text style={styles.menuModalCancelText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Photo Options Modal - IMAGEN IA */}
            <Modal
                visible={showIaPhotoOptions}
                transparent
                animationType="fade"
                onRequestClose={() => setShowIaPhotoOptions(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowIaPhotoOptions(false)}
                >
                    <View style={styles.menuModalCard}>
                        <Text style={styles.menuModalTitle}>Imagen para IA</Text>

                        <TouchableOpacity style={styles.menuModalOption} onPress={handlePickIaImage}>
                            <Ionicons name="images" size={24} color="#3b82f6" />
                            <Text style={styles.menuModalOptionText}>Elegir de Galería</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.menuModalOption, styles.menuModalCancelOption]}
                            onPress={() => setShowIaPhotoOptions(false)}
                        >
                            <Text style={styles.menuModalCancelText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Image Cropper Modal - LOGO OFICIAL (rectangular) */}
            <ImageCropper
                visible={!!croppingOfficialLogo}
                imageUri={croppingOfficialLogo}
                onCancel={() => setCroppingOfficialLogo(null)}
                onCrop={handleOfficialCropComplete}
                shape="rectangle"
            />

            {/* Image Cropper Modal - IMAGEN IA (circular) */}
            <ImageCropper
                visible={!!croppingIaImage}
                imageUri={croppingIaImage}
                onCancel={() => setCroppingIaImage(null)}
                onCrop={handleIaCropComplete}
                shape="circle"
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    scrollContentLarge: {
        padding: 32,
    },
    // Generating Overlay
    generatingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(248, 250, 252, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    generatingCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 40,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    generatingTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 20,
    },
    generatingSubtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 8,
        maxWidth: 280,
    },
    // Layout Refinado
    initialStateContainer: {
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
        gap: 0,
    },
    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24,
    },
    sectionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    sectionDescription: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    // Segmented Control
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    segmentBtnActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    segmentTextActive: {
        color: '#3b82f6',
    },
    // Input Area
    inputArea: {
        minHeight: 80,
    },
    urlInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    textInputContainer: {
        flex: 1,
        height: '100%',
    },
    textInputText: {
        fontSize: 15,
        color: '#1e293b',
    },
    uploadBox: {
        borderWidth: 2,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    uploadPlaceholder: {
        alignItems: 'center',
        gap: 8,
    },
    uploadPlaceholderText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    uploadedPreview: {
        width: '100%',
        height: '100%',
    },
    uploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Connector
    connectorLine: {
        height: 40,
        width: 2,
        backgroundColor: '#e2e8f0',
        alignSelf: 'center',
        marginVertical: 4,
    },
    // AI Actions
    aiActionContainer: {
        alignItems: 'center',
    },
    generateButton: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 8,
    },
    generateButtonDisabled: {
        opacity: 0.8,
    },
    generateButtonGradient: {
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    generateButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    aiDisclaimer: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 16,
        fontStyle: 'italic',
    },
    // Main 2-Column Layout
    mainLayout: {
        flexDirection: 'column',
    },
    mainLayoutLarge: {
        flexDirection: 'row',
        gap: 32,
    },
    // Selector Column
    selectorColumn: {
        flex: 1,
    },
    selectorColumnLarge: {
        flex: 1,
        maxWidth: 500,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 20,
    },
    bold: {
        fontWeight: '700',
        color: '#3b82f6',
    },
    variantOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0',
    },
    variantOptionSelected: {
        backgroundColor: '#f0f9ff',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    themeCheckbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#cbd5e1',
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    defaultStarBtn: {
        padding: 8,
        marginLeft: 8,
    },
    variantInfo: {},
    variantName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
    },
    colorDots: {
        flexDirection: 'row',
        gap: 8,
    },
    colorDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    previewBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    previewBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    confirmButton: {
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    helperText: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 12,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginTop: 24,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    secondaryAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    secondaryActionText: {
        fontSize: 13,
        color: '#64748b',
    },
    dangerAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dangerActionText: {
        fontSize: 13,
        color: '#ef4444',
    },
    // Preview Column
    previewColumn: {
        alignItems: 'center',
        marginTop: 32,
    },
    previewColumnLarge: {
        flex: 1,
        marginTop: 0,
        position: 'sticky',
        top: 32,
    },
    previewLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
        letterSpacing: 2,
        marginBottom: 20,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
    },
    modalIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 20,
    },
    colorPreviewRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 28,
    },
    colorPreviewDot: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748b',
    },
    activateButton: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    activateButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    // Alert Modal
    alertModalCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
    },
    alertIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    alertTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
        textAlign: 'center',
    },
    alertMessage: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    alertButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    alertButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    // Menu Modal (Photo Options)
    menuModalCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        minWidth: 280,
        maxWidth: 340,
    },
    menuModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    menuModalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        gap: 14,
        borderRadius: 10,
    },
    menuModalOptionText: {
        fontSize: 16,
        color: '#1e293b',
        fontWeight: '500',
    },
    menuModalCancelOption: {
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 16,
        justifyContent: 'center',
    },
    menuModalCancelText: {
        fontSize: 16,
        color: '#ef4444',
        fontWeight: '600',
        textAlign: 'center',
    },
});
