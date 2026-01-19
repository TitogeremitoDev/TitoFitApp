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
    Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import PhonePreview from './PhonePreview';

const { width } = Dimensions.get('window');
const isLargeScreen = width > 900;
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function BrandingScreen() {
    const router = useRouter();
    const { token, user } = useAuth();

    // Estados
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [brandingData, setBrandingData] = useState(null);
    const [selectedVariantId, setSelectedVariantId] = useState(null);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
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
                setSelectedVariantId(data.branding.variantId);
            }
        } catch (error) {
            console.error('[Branding] Error loading:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePickLogo = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showAlert('Permiso necesario', 'Se necesita acceso a la galería para subir tu logo.', 'warning');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
            });

            if (!result.canceled) {
                handleGenerateBranding(result.assets[0].uri);
            }
        } catch (error) {
            console.error('[Branding] Error picking image:', error);
            showAlert('Error', 'No se pudo seleccionar la imagen', 'error');
        }
    };

    const handleGenerateBranding = async (imageUri) => {
        setGenerating(true);

        try {
            const formData = new FormData();
            const isWeb = typeof window !== 'undefined' && window.document;

            if (isWeb) {
                const response = await fetch(imageUri);
                const blob = await response.blob();
                formData.append('logo', blob, `logo_${Date.now()}.jpg`);
            } else {
                formData.append('logo', {
                    uri: imageUri,
                    name: `logo_${Date.now()}.jpg`,
                    type: 'image/jpeg'
                });
            }

            const apiResponse = await fetch(`${API_URL}/api/coach/branding/generate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            const data = await apiResponse.json();

            if (data.success) {
                setBrandingData(data);
                setSelectedVariantId(data.options[0]?.id || 'dark');
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
        try {
            const response = await fetch(`${API_URL}/api/coach/branding/select`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ variantId: selectedVariantId })
            });

            const data = await response.json();
            if (data.success) {
                showAlert('¡Activado!', 'Tus clientes verán ahora tu branding personalizado.', 'success');
            }
        } catch (error) {
            showAlert('Error', 'No se pudo activar el branding', 'error');
        }
    };

    const handleDeactivate = async () => {
        try {
            await fetch(`${API_URL}/api/coach/branding/deactivate`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedVariantId(null);
            setBrandingData(null);
            showAlert('Desactivado', 'Los clientes verán el tema por defecto.', 'info');
        } catch (error) {
            showAlert('Error', 'No se pudo desactivar', 'error');
        }
    };

    // Tema seleccionado actual para preview
    const selectedTheme = brandingData?.options?.find(opt => opt.id === selectedVariantId)
        || brandingData?.options?.[0]
        || { colors: { primary: '#3b82f6', secondary: '#1e293b', background: '#f8fafc', surface: '#ffffff', text: '#1e293b' } };

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
                {/* Si no hay branding, mostrar upload */}
                {!brandingData && !generating && (
                    <View style={styles.uploadSection}>
                        <View style={styles.heroIcon}>
                            <Ionicons name="color-palette" size={48} color="#3b82f6" />
                        </View>
                        <Text style={styles.heroTitle}>Identidad Visual para tus Clientes</Text>
                        <Text style={styles.heroSubtitle}>
                            Sube tu logo y la IA creará un tema personalizado que tus clientes verán en su app.
                        </Text>
                        <TouchableOpacity style={styles.uploadCard} onPress={handlePickLogo}>
                            <Ionicons name="cloud-upload" size={40} color="#3b82f6" />
                            <Text style={styles.uploadTitle}>Subir Logo</Text>
                            <Text style={styles.uploadSubtitle}>JPG, PNG o WebP • Máximo 5MB</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Si hay branding, mostrar selector + preview */}
                {brandingData && !generating && (
                    <View style={[styles.mainLayout, isLargeScreen && styles.mainLayoutLarge]}>
                        {/* COLUMNA IZQUIERDA: Selector de variantes */}
                        <View style={[styles.selectorColumn, isLargeScreen && styles.selectorColumnLarge]}>
                            <Text style={styles.sectionTitle}>Elige tu Variante</Text>
                            <Text style={styles.sectionSubtitle}>
                                Fuente: <Text style={styles.bold}>{brandingData.suggestedFont}</Text> •
                                Mood: <Text style={styles.bold}>{brandingData.mood}</Text>
                            </Text>

                            {brandingData.options.map((option) => (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[
                                        styles.variantOption,
                                        selectedVariantId === option.id && [
                                            styles.variantOptionSelected,
                                            { borderColor: option.colors.primary }
                                        ]
                                    ]}
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
                                    {selectedVariantId === option.id && (
                                        <View style={[styles.previewBadge, { backgroundColor: option.colors.primary + '20' }]}>
                                            <Text style={[styles.previewBadgeText, { color: option.colors.primary }]}>
                                                Previsualizando
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}

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
                            <View style={styles.actionsRow}>
                                <TouchableOpacity style={styles.secondaryAction} onPress={handlePickLogo}>
                                    <Ionicons name="refresh" size={18} color="#64748b" />
                                    <Text style={styles.secondaryActionText}>
                                        Regenerar ({brandingData.regenerationsRemaining} restantes)
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
                                fontName={brandingData.suggestedFont}
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
    // Upload Section
    uploadSection: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    heroIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 12,
    },
    heroSubtitle: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 400,
        marginBottom: 32,
    },
    uploadCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        width: '100%',
        maxWidth: 400,
    },
    uploadTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 16,
    },
    uploadSubtitle: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
    },
    // Main 2-Column Layout
    mainLayout: {
        flexDirection: 'column',
    },
    mainLayoutLarge: {
        flexDirection: 'row',
        gap: 48,
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
});
