/**
 * faq-manager/index.jsx
 * CMS para que el entrenador gestione sus FAQs
 * Incluye onboarding modal, contador de tiempo ahorrado, y plantilla de difusión
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, SafeAreaView, Modal, RefreshControl,
    Platform, useWindowDimensions, Animated, Clipboard, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

const CATEGORIES = {
    nutricion: { name: '🍎 Nutrición', color: '#22c55e' },
    entrenamiento: { name: '🏋️ Entrenamiento', color: '#3b82f6' },
    lifestyle: { name: '🧠 Mindset', color: '#8b5cf6' },
    suplementos: { name: '💊 Suplementos', color: '#f59e0b' },
    app: { name: '❓ App', color: '#64748b' },
    pagos: { name: '💳 Pagos', color: '#ec4899' }
};

const BROADCAST_TEMPLATE = `¡Equipo! 📢 Noticia importante.

Acabo de activar una nueva sección de AYUDA en vuestro perfil (abajo del todo).

Antes de escribirme una duda por el chat, buscadla ahí. Tenéis respuestas inmediatas sobre dieta, entreno y suplementos sin tener que esperar a que yo conteste.

Si el sistema no sabe la respuesta, entonces escribidme. ¡A darle caña!`;

export default function FAQManagerScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const { width: screenWidth } = useWindowDimensions();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [faqs, setFaqs] = useState([]);
    const [grouped, setGrouped] = useState({});
    const [total, setTotal] = useState(0);
    const [totalViews, setTotalViews] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [sortBy, setSortBy] = useState(null); // null, 'views', 'likes'
    const [modalVisible, setModalVisible] = useState(false);
    const [editingFaq, setEditingFaq] = useState(null);
    const [cloning, setCloning] = useState(false);

    // Onboarding modal
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Modales de confirmación
    const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: null, confirmText: 'Confirmar', danger: false });
    const [infoModal, setInfoModal] = useState({ visible: false, title: '', message: '' });

    // Form state
    const [formCategory, setFormCategory] = useState('nutricion');
    const [formQuestion, setFormQuestion] = useState('');
    const [formAnswer, setFormAnswer] = useState('');
    const [formTags, setFormTags] = useState('');
    const [saving, setSaving] = useState(false);

    // Responsive
    const isLargeScreen = screenWidth > 768;

    // Calcular tiempo ahorrado (5 min por pregunta respondida)
    const timeSavedMinutes = totalViews * 5;
    const timeSavedHours = Math.floor(timeSavedMinutes / 60);
    const timeSavedMins = timeSavedMinutes % 60;

    // Animación de pulso para el botón de ayuda
    useEffect(() => {
        if (!hasSeenOnboarding) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true })
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [hasSeenOnboarding, pulseAnim]);

    // Verificar si ya vio el onboarding
    useEffect(() => {
        const checkOnboarding = async () => {
            const seen = await AsyncStorage.getItem('faq_onboarding_seen');
            setHasSeenOnboarding(seen === 'true');
        };
        checkOnboarding();
    }, []);

    // Helper para mostrar alertas
    const showInfo = (title, message) => {
        setInfoModal({ visible: true, title, message });
    };

    const showConfirm = (title, message, onConfirm, confirmText = 'Confirmar', danger = false) => {
        setConfirmModal({ visible: true, title, message, onConfirm, confirmText, danger });
    };

    // Cargar FAQs
    const loadFaqs = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/coach-faq/trainer`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setFaqs(data.faqs || []);
                setGrouped(data.grouped || {});
                setTotal(data.total || 0);
                // Sumar todas las vistas
                const views = (data.faqs || []).reduce((acc, faq) => acc + (faq.viewCount || 0), 0);
                setTotalViews(views);
            }
        } catch (error) {
            console.error('[FAQManager] Error:', error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { loadFaqs(); }, [loadFaqs]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadFaqs();
        setRefreshing(false);
    };

    // Marcar onboarding como visto
    const markOnboardingSeen = async () => {
        await AsyncStorage.setItem('faq_onboarding_seen', 'true');
        setHasSeenOnboarding(true);
        setShowOnboarding(false);
    };

    // Abrir onboarding
    const openOnboarding = () => {
        setShowOnboarding(true);
    };

    // Copiar texto de difusión
    const copyBroadcast = async () => {
        try {
            if (Platform.OS === 'web') {
                await navigator.clipboard.writeText(BROADCAST_TEMPLATE);
            } else {
                await Clipboard.setStringAsync(BROADCAST_TEMPLATE);
            }
            showInfo('✅ Copiado', 'Texto copiado. ¡Pégalo en tu grupo de clientes!');
        } catch (e) {
            showInfo('Texto para copiar', BROADCAST_TEMPLATE);
        }
    };

    // Clonar plantillas
    const handleCloneTemplates = () => {
        showConfirm(
            'Importar Plantillas',
            total > 0
                ? '¿Añadir 180 FAQs base a tus existentes? Podrás editarlas después.'
                : '¿Importar 180 FAQs base? Podrás editarlas después.',
            async () => {
                setCloning(true);
                try {
                    const res = await fetch(`${API_URL}/api/coach-faq/clone-templates`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.success) {
                        showInfo('✅ Éxito', data.message);
                        loadFaqs();
                    } else {
                        showInfo('Error', data.message);
                    }
                } catch (error) {
                    showInfo('Error', 'No se pudieron importar las plantillas');
                } finally {
                    setCloning(false);
                }
            },
            'Importar'
        );
    };

    // Abrir modal para crear/editar
    const openModal = (faq = null) => {
        if (faq) {
            setEditingFaq(faq);
            setFormCategory(faq.category);
            setFormQuestion(faq.question);
            setFormAnswer(faq.answer);
            setFormTags(faq.tags?.join(', ') || '');
        } else {
            setEditingFaq(null);
            setFormCategory('nutricion');
            setFormQuestion('');
            setFormAnswer('');
            setFormTags('');
        }
        setModalVisible(true);
    };

    // Guardar FAQ
    const handleSave = async () => {
        if (!formQuestion.trim() || !formAnswer.trim()) {
            showInfo('Error', 'Pregunta y respuesta son obligatorias');
            return;
        }

        setSaving(true);
        const tags = formTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

        try {
            const url = editingFaq
                ? `${API_URL}/api/coach-faq/${editingFaq._id}`
                : `${API_URL}/api/coach-faq`;

            const res = await fetch(url, {
                method: editingFaq ? 'PUT' : 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    category: formCategory,
                    question: formQuestion.trim(),
                    answer: formAnswer.trim(),
                    tags
                })
            });
            const data = await res.json();
            if (data.success) {
                setModalVisible(false);
                loadFaqs();
            } else {
                showInfo('Error', data.message);
            }
        } catch (error) {
            showInfo('Error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    // Eliminar FAQ
    const handleDelete = (faq) => {
        showConfirm(
            'Eliminar FAQ',
            `¿Eliminar "${faq.question.substring(0, 50)}..."?`,
            async () => {
                try {
                    await fetch(`${API_URL}/api/coach-faq/${faq._id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    loadFaqs();
                } catch (error) {
                    showInfo('Error', 'No se pudo eliminar');
                }
            },
            'Eliminar',
            true
        );
    };
    // Cambiar ordenación
    const toggleSort = () => {
        if (!sortBy) setSortBy('views');
        else if (sortBy === 'views') setSortBy('likes');
        else setSortBy(null);
    };

    // Obtener FAQs filtradas y ordenadas
    const getDisplayFaqs = () => {
        let list = selectedCategory ? (grouped[selectedCategory] || []) : faqs;
        if (sortBy === 'views') {
            list = [...list].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        } else if (sortBy === 'likes') {
            list = [...list].sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0));
        }
        return list;
    };

    const displayFaqs = getDisplayFaqs();

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#06b6d4" />
                    <Text style={styles.loadingText}>Cargando FAQs...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Centro de Ayuda"
                subtitle="FAQs para tus clientes"
                icon="help-circle"
                iconColor="#06b6d4"
            />

            {/* Help Button - Pulsing if not seen */}
            <View style={styles.helpButtonRow}>
                <Animated.View style={{ transform: [{ scale: hasSeenOnboarding ? 1 : pulseAnim }] }}>
                    <TouchableOpacity
                        style={[styles.helpButton, !hasSeenOnboarding && styles.helpButtonPulsing]}
                        onPress={openOnboarding}
                    >
                        <Ionicons name="help-circle" size={28} color="#fff" />
                        <Text style={styles.helpButtonText}>AYUDA</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Time Saved Counter */}
                {totalViews > 0 && (
                    <View style={styles.timeSavedCard}>
                        <Ionicons name="time-outline" size={18} color="#22c55e" />
                        <Text style={styles.timeSavedText}>
                            {timeSavedHours > 0 ? `${timeSavedHours}h ${timeSavedMins}min` : `${timeSavedMins}min`} ahorrados
                        </Text>
                        <Text style={styles.timeSavedSub}>({totalViews} consultas)</Text>
                    </View>
                )}
            </View>

            {/* Stats Bar */}
            <View style={styles.statsBar}>
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{total}</Text>
                    <Text style={styles.statLabel}>FAQs</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#22c55e' }]}>{Object.keys(grouped).length}</Text>
                    <Text style={styles.statLabel}>Categorías</Text>
                </View>
                <TouchableOpacity
                    style={[styles.actionBtn, cloning && { opacity: 0.6 }]}
                    onPress={handleCloneTemplates}
                    disabled={cloning}
                >
                    {cloning ? (
                        <ActivityIndicator size="small" color="#06b6d4" />
                    ) : (
                        <>
                            <Ionicons name="download-outline" size={18} color="#06b6d4" />
                            <Text style={styles.actionBtnText}>Importar Base</Text>
                        </>
                    )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
                    <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Category Filter + Sort */}
            <View style={styles.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
                    <TouchableOpacity
                        style={[styles.filterBtn, !selectedCategory && styles.filterBtnActive]}
                        onPress={() => setSelectedCategory(null)}
                    >
                        <Text style={[styles.filterBtnText, !selectedCategory && styles.filterBtnTextActive]}>Todas</Text>
                    </TouchableOpacity>
                    {Object.entries(CATEGORIES).map(([key, config]) => (
                        <TouchableOpacity
                            key={key}
                            style={[styles.filterBtn, selectedCategory === key && { backgroundColor: config.color, borderColor: config.color }]}
                            onPress={() => setSelectedCategory(selectedCategory === key ? null : key)}
                        >
                            <Text style={[styles.filterBtnText, selectedCategory === key && { color: '#fff' }]}>{config.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                <TouchableOpacity style={[styles.sortBtn, sortBy && styles.sortBtnActive]} onPress={toggleSort}>
                    <Ionicons name={sortBy === 'views' ? 'eye' : sortBy === 'likes' ? 'thumbs-up' : 'swap-vertical'} size={18} color={sortBy ? '#fff' : '#64748b'} />
                    {sortBy && <Text style={styles.sortBtnText}>{sortBy === 'views' ? 'Vistas' : 'Likes'}</Text>}
                </TouchableOpacity>
            </View>

            {/* FAQ List */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06b6d4" />}
            >
                {displayFaqs.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="help-circle-outline" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No hay FAQs</Text>
                        <Text style={styles.emptySubtitle}>Pulsa "Importar Base" para cargar 180 FAQs predefinidas</Text>
                    </View>
                ) : (
                    displayFaqs.map((faq) => (
                        <View key={faq._id} style={styles.faqCard}>
                            <View style={[styles.faqCatIndicator, { backgroundColor: CATEGORIES[faq.category]?.color || '#64748b' }]} />
                            <View style={styles.faqContent}>
                                <Text style={styles.faqQuestion} numberOfLines={2}>{faq.question}</Text>
                                <Text style={styles.faqAnswer} numberOfLines={1}>{faq.answer}</Text>
                                <View style={styles.faqMeta}>
                                    <View style={styles.metaItem}>
                                        <Ionicons name="eye-outline" size={14} color="#94a3b8" />
                                        <Text style={styles.metaText}>{faq.viewCount || 0}</Text>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <Ionicons name="thumbs-up-outline" size={14} color="#22c55e" />
                                        <Text style={[styles.metaText, { color: '#22c55e' }]}>{faq.helpfulCount || 0}</Text>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <Ionicons name="thumbs-down-outline" size={14} color="#ef4444" />
                                        <Text style={[styles.metaText, { color: '#ef4444' }]}>{faq.notHelpfulCount || 0}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.faqActions}>
                                <TouchableOpacity onPress={() => openModal(faq)} style={styles.faqActionBtn}>
                                    <Ionicons name="create-outline" size={20} color="#3b82f6" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(faq)} style={styles.faqActionBtn}>
                                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* ONBOARDING MODAL - Marketing Copy */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={showOnboarding} animationType="fade" transparent>
                <View style={styles.onboardingOverlay}>
                    <View style={[styles.onboardingCard, isLargeScreen && { maxWidth: 600 }]}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.onboardingEmoji}>🧠</Text>
                            <Text style={styles.onboardingTitle}>ACTIVA TU "CLON DIGITAL"</Text>
                            <Text style={styles.onboardingSubtitle}>(Y DEJA DE SER UNA SECRETARIA)</Text>

                            <View style={styles.onboardingSection}>
                                <Text style={styles.onboardingSectionTitle}>❌ El Problema:</Text>
                                <Text style={styles.onboardingText}>
                                    ¿Cuántas veces has respondido esta semana "¿puedo cambiar el arroz por pasta?" o "¿cómo subo las fotos?"?
                                    {'\n\n'}Si respondes tú mismo a todo, tienes un <Text style={styles.bold}>techo de cristal</Text>. No puedes escalar.
                                </Text>
                            </View>

                            <View style={styles.onboardingSection}>
                                <Text style={styles.onboardingSectionTitle}>✅ La Solución:</Text>
                                <Text style={styles.onboardingText}>
                                    Acabamos de activar en el perfil de tus clientes un <Text style={styles.bold}>Buscador Inteligente</Text>.
                                    {'\n\n'}He cargado para ti más de 150 respuestas base (Nutrición, Entreno, Suplementos...). Es como tener a un <Text style={styles.bold}>"Mini-Tú"</Text> respondiendo dudas a las 3:00 AM.
                                </Text>
                            </View>

                            <View style={[styles.onboardingSection, styles.missionSection]}>
                                <Text style={styles.onboardingSectionTitle}>⚠️ TU MISIÓN (IMPORTANTE):</Text>
                                <Text style={styles.onboardingText}>
                                    Las respuestas que hay ahora son buenas, pero son <Text style={styles.bold}>genéricas</Text>. Tus clientes te pagan por TI.
                                </Text>
                                <View style={styles.missionList}>
                                    <Text style={styles.missionItem}>1️⃣ Entra ahora al gestor</Text>
                                    <Text style={styles.missionItem}>2️⃣ Revisa las respuestas</Text>
                                    <Text style={styles.missionItem}>3️⃣ Cámbialas. Pon tus expresiones, tus insultos cariñosos, tus normas.</Text>
                                </View>
                                <Text style={[styles.onboardingText, { marginTop: 12, fontStyle: 'italic', color: '#ef4444' }]}>
                                    Si no lo haces, sonarás como un robot de Wikipedia.
                                </Text>
                            </View>

                            <View style={styles.onboardingSection}>
                                <Text style={styles.onboardingSectionTitle}>🎯 El Resultado:</Text>
                                <Text style={styles.onboardingText}>
                                    Si educas a tus clientes para que usen esto primero, eliminarás el <Text style={styles.bold}>80% de los mensajes paja</Text> y solo te llegarán los importantes.
                                </Text>
                            </View>

                            <Text style={styles.onboardingCTA}>¿Listo para recuperar tus domingos? 🏖️</Text>

                            {/* Broadcast Template */}
                            <View style={styles.broadcastSection}>
                                <Text style={styles.broadcastTitle}>📢 Copia y pega esto en el Chat Grupal de tus clientes:</Text>
                                <View style={styles.broadcastBox}>
                                    <Text style={styles.broadcastText}>{BROADCAST_TEMPLATE}</Text>
                                </View>
                                <TouchableOpacity style={styles.copyBtn} onPress={copyBroadcast}>
                                    <Ionicons name="copy-outline" size={18} color="#fff" />
                                    <Text style={styles.copyBtnText}>COPIAR TEXTO</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={styles.onboardingBtn} onPress={markOnboardingSeen}>
                            <Text style={styles.onboardingBtnText}>VAMOS A PERSONALIZARLO 🚀</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Create/Edit Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, isLargeScreen && { maxWidth: 600 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingFaq ? 'Editar FAQ' : 'Nueva FAQ'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.inputLabel}>Categoría</Text>
                            <View style={styles.catGrid}>
                                {Object.entries(CATEGORIES).map(([key, config]) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={[styles.catOption, formCategory === key && { backgroundColor: config.color, borderColor: config.color }]}
                                        onPress={() => setFormCategory(key)}
                                    >
                                        <Text style={[styles.catOptionText, formCategory === key && { color: '#fff' }]}>{config.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Pregunta *</Text>
                            <EnhancedTextInput
                                containerStyle={styles.inputContainer}
                                style={styles.inputText}
                                value={formQuestion}
                                onChangeText={setFormQuestion}
                                placeholder="Ej: ¿Qué puedo comer en volumen?"
                                placeholderTextColor="#94a3b8"
                                multiline
                            />

                            <Text style={styles.inputLabel}>Respuesta *</Text>
                            <EnhancedTextInput
                                containerStyle={[styles.inputContainer, styles.textAreaContainer]}
                                style={[styles.inputText, styles.textAreaText]}
                                value={formAnswer}
                                onChangeText={setFormAnswer}
                                placeholder="Tu respuesta detallada..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                numberOfLines={6}
                            />

                            <Text style={styles.inputLabel}>Tags (separados por coma)</Text>
                            <EnhancedTextInput
                                containerStyle={styles.inputContainer}
                                style={styles.inputText}
                                value={formTags}
                                onChangeText={setFormTags}
                                placeholder="volumen, hambre, calorías"
                                placeholderTextColor="#94a3b8"
                            />
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.saveButton, saving && { opacity: 0.6 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveButtonText}>{editingFaq ? 'Guardar Cambios' : 'Crear FAQ'}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Info Modal */}
            <Modal visible={infoModal.visible} animationType="fade" transparent>
                <View style={styles.alertOverlay}>
                    <View style={styles.alertCard}>
                        <Text style={styles.alertTitle}>{infoModal.title}</Text>
                        <Text style={styles.alertMessage}>{infoModal.message}</Text>
                        <TouchableOpacity
                            style={styles.alertBtn}
                            onPress={() => setInfoModal({ visible: false, title: '', message: '' })}
                        >
                            <Text style={styles.alertBtnText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Confirm Modal */}
            <Modal visible={confirmModal.visible} animationType="fade" transparent>
                <View style={styles.alertOverlay}>
                    <View style={styles.alertCard}>
                        <Text style={styles.alertTitle}>{confirmModal.title}</Text>
                        <Text style={styles.alertMessage}>{confirmModal.message}</Text>
                        <View style={styles.alertBtns}>
                            <TouchableOpacity
                                style={[styles.alertBtn, styles.alertBtnCancel]}
                                onPress={() => setConfirmModal({ ...confirmModal, visible: false })}
                            >
                                <Text style={styles.alertBtnCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.alertBtn, confirmModal.danger && styles.alertBtnDanger]}
                                onPress={() => {
                                    setConfirmModal({ ...confirmModal, visible: false });
                                    confirmModal.onConfirm?.();
                                }}
                            >
                                <Text style={styles.alertBtnText}>{confirmModal.confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: '#64748b' },

    // Help Button Row
    helpButtonRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0'
    },
    helpButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#8b5cf6',
        paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, gap: 8
    },
    helpButtonPulsing: { backgroundColor: '#7c3aed' },
    helpButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    timeSavedCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4',
        paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, gap: 6
    },
    timeSavedText: { color: '#22c55e', fontSize: 14, fontWeight: '700' },
    timeSavedSub: { color: '#86efac', fontSize: 11 },

    // Stats Bar
    statsBar: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0'
    },
    statItem: { alignItems: 'center', paddingHorizontal: 16 },
    statNumber: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
    statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
    statDivider: { width: 1, height: 32, backgroundColor: '#e2e8f0' },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#f0fdfa', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginLeft: 12, gap: 6
    },
    actionBtnText: { color: '#06b6d4', fontSize: 12, fontWeight: '600' },
    addBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: '#06b6d4',
        justifyContent: 'center', alignItems: 'center', marginLeft: 8
    },

    // Filter
    filterRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingRight: 8 },
    filterContent: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
    filterBtn: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8
    },
    filterBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    filterBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    filterBtnTextActive: { color: '#fff' },
    sortBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
        backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0'
    },
    sortBtnActive: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' },
    sortBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Content
    content: { flex: 1 },
    contentContainer: { padding: 16 },

    // Empty
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#64748b', marginTop: 16 },
    emptySubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 8, textAlign: 'center' },

    // FAQ Card
    faqCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8
    },
    faqCatIndicator: { width: 4, height: 50, borderRadius: 2, alignSelf: 'stretch' },
    faqContent: { flex: 1, marginLeft: 12 },
    faqQuestion: { fontSize: 15, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
    faqAnswer: { fontSize: 13, color: '#64748b' },
    faqMeta: { flexDirection: 'row', marginTop: 8, gap: 16 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: '#94a3b8' },
    faqActions: { flexDirection: 'row', gap: 4 },
    faqActionBtn: { padding: 8 },

    // ═══════════════════════════════════════════════════════════════════
    // ONBOARDING MODAL STYLES
    // ═══════════════════════════════════════════════════════════════════
    onboardingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    onboardingCard: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, width: '100%', maxHeight: Dimensions.get('window').height * 0.9 },
    onboardingEmoji: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
    onboardingTitle: { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center' },
    onboardingSubtitle: { fontSize: 14, fontWeight: '600', color: '#94a3b8', textAlign: 'center', marginBottom: 20 },
    onboardingSection: { marginBottom: 20 },
    onboardingSectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 8 },
    onboardingText: { fontSize: 14, color: '#cbd5e1', lineHeight: 22 },
    bold: { fontWeight: '700', color: '#fff' },
    missionSection: { backgroundColor: '#334155', padding: 16, borderRadius: 12 },
    missionList: { marginTop: 12, gap: 8 },
    missionItem: { fontSize: 14, color: '#fbbf24', fontWeight: '600' },
    onboardingCTA: { fontSize: 18, fontWeight: '700', color: '#22c55e', textAlign: 'center', marginVertical: 20 },
    broadcastSection: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, marginTop: 8 },
    broadcastTitle: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 12 },
    broadcastBox: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
    broadcastText: { fontSize: 13, color: '#e2e8f0', lineHeight: 20 },
    copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6', padding: 12, borderRadius: 10, marginTop: 12, gap: 8 },
    copyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    onboardingBtn: { backgroundColor: '#22c55e', padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 16 },
    onboardingBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalContent: { backgroundColor: '#fff', borderRadius: 24, maxHeight: Dimensions.get('window').height * 0.9, width: '100%', alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
    modalCloseBtn: { padding: 4 },
    modalBody: { padding: 20 },

    inputLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8, marginTop: 8 },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catOption: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 4 },
    catOptionText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    inputContainer: {
        backgroundColor: '#f8fafc', padding: 14, borderRadius: 12,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    inputText: {
        color: '#1e293b', fontSize: 15,
        ...(Platform.OS === 'web' && { outlineStyle: 'none' })
    },
    textAreaContainer: { minHeight: 100, maxHeight: 200 },
    textAreaText: { textAlignVertical: 'top' },

    saveButton: { backgroundColor: '#06b6d4', padding: 16, margin: 20, borderRadius: 12, alignItems: 'center' },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Alert modals
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    alertCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
    alertTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12, textAlign: 'center' },
    alertMessage: { fontSize: 15, color: '#64748b', lineHeight: 22, textAlign: 'center', marginBottom: 24 },
    alertBtns: { flexDirection: 'row', gap: 12 },
    alertBtn: { flex: 1, backgroundColor: '#06b6d4', padding: 14, borderRadius: 12, alignItems: 'center' },
    alertBtnCancel: { backgroundColor: '#f1f5f9' },
    alertBtnDanger: { backgroundColor: '#ef4444' },
    alertBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    alertBtnCancelText: { color: '#64748b', fontSize: 15, fontWeight: '600' }
});
