/**
 * coach-help/index.jsx
 * Pantalla de ayuda del entrenador para clientes
 * Compatible con iOS, Android y Web
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, SafeAreaView, StatusBar, RefreshControl, Platform,
    Linking
} from 'react-native';
import { useStableWindowDimensions } from '../../../src/hooks/useStableBreakpoint';
import { useRouter } from 'expo-router';
import { EnhancedTextInput } from '../../../components/ui';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// Configuración de categorías con iconos y colores
const CATEGORIES_CONFIG = {
    nutricion: { name: '🍎 Nutrición', icon: 'apple', color: '#4CAF50' },
    entrenamiento: { name: '🏋️ Entreno', icon: 'activity', color: '#2196F3' },
    lifestyle: { name: '🧠 Mindset', icon: 'heart', color: '#9C27B0' },
    suplementos: { name: '💊 Suplem.', icon: 'package', color: '#FF9800' },
    app: { name: '❓ App', icon: 'help-circle', color: '#607D8B' },
    pagos: { name: '💳 Pagos', icon: 'credit-card', color: '#E91E63' }
};

export default function CoachHelpScreen() {
    const router = useRouter();
    const { token, user } = useAuth();
    const { width: screenWidth } = useStableWindowDimensions();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [faqs, setFaqs] = useState([]);
    const [grouped, setGrouped] = useState({});
    const [topFaqs, setTopFaqs] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [expandedFaq, setExpandedFaq] = useState(null);
    const [votedFaqs, setVotedFaqs] = useState({}); // Trackéa qué FAQs ya fueron votadas { faqId: 'helpful' | 'not-helpful' }

    // Responsive: calcular ancho de categorías
    const isWeb = Platform.OS === 'web';
    const isLargeScreen = screenWidth > 768;
    const categoryWidth = isLargeScreen ? '15%' : '30%';
    const contentMaxWidth = isLargeScreen ? 800 : '100%';

    // Cargar FAQs
    const loadFaqs = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/coach-faq`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setFaqs(data.faqs || []);
                setGrouped(data.grouped || {});
            }
        } catch (error) {
            console.error('[CoachHelp] Error loading FAQs:', error);
        }
    }, [token]);

    // Cargar Top 5
    const loadTop = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/coach-faq/top`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setTopFaqs(data.top || []);
            }
        } catch (error) {
            console.error('[CoachHelp] Error loading top:', error);
        }
    }, [token]);

    // Búsqueda fuzzy
    const searchFaqs = useCallback(async (query) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await fetch(`${API_URL}/api/coach-faq/search?q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setSearchResults(data.results || []);
            }
        } catch (error) {
            console.error('[CoachHelp] Error searching:', error);
        } finally {
            setSearching(false);
        }
    }, [token]);

    // Registrar vista
    const registerView = async (faqId) => {
        try {
            await fetch(`${API_URL}/api/coach-faq/view/${faqId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            // Silent fail
        }
    };

    // Inicial load
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([loadFaqs(), loadTop()]);
            setLoading(false);
        };
        init();
    }, [loadFaqs, loadTop]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            searchFaqs(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, searchFaqs]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadFaqs(), loadTop()]);
        setRefreshing(false);
    };

    const handleFaqPress = (faq) => {
        if (expandedFaq === faq._id) {
            setExpandedFaq(null);
        } else {
            setExpandedFaq(faq._id);
            registerView(faq._id);
        }
    };

    // URL del formulario de contacto para usuarios sin entrenador
    const CONTACT_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSca4SqUuyDKe_hQGRqfES467zF16Wb_jDvb7hob_E3ht8PRlg/viewform';

    // Determinar si el usuario tiene entrenador
    const hasTrainer = !!user?.currentTrainerId;

    const openContact = () => {
        if (hasTrainer) {
            // Si tiene entrenador, abrir chat
            router.push('/(app)/chat');
        } else {
            // Si no tiene entrenador, abrir formulario de Google
            Linking.openURL(CONTACT_FORM_URL);
        }
    };

    // Votar FAQ como útil
    const voteFaqHelpful = async (faqId) => {
        if (votedFaqs[faqId]) return; // Ya votó
        try {
            await fetch(`${API_URL}/api/coach-faq/helpful/${faqId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            setVotedFaqs(prev => ({ ...prev, [faqId]: 'helpful' }));
        } catch (error) {
            console.error('[CoachHelp] Error voting helpful:', error);
        }
    };

    // Votar FAQ como no útil
    const voteFaqNotHelpful = async (faqId) => {
        if (votedFaqs[faqId]) return; // Ya votó
        try {
            await fetch(`${API_URL}/api/coach-faq/not-helpful/${faqId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            setVotedFaqs(prev => ({ ...prev, [faqId]: 'not-helpful' }));
        } catch (error) {
            console.error('[CoachHelp] Error voting not helpful:', error);
        }
    };

    // Renderizar FAQ item
    const renderFaqItem = (faq) => {
        const isExpanded = expandedFaq === faq._id;
        const catConfig = CATEGORIES_CONFIG[faq.category] || {};

        return (
            <TouchableOpacity
                key={faq._id}
                style={[styles.faqItem, isExpanded && styles.faqItemExpanded]}
                onPress={() => handleFaqPress(faq)}
                activeOpacity={0.7}
            >
                <View style={styles.faqHeader}>
                    <View style={[styles.categoryDot, { backgroundColor: catConfig.color || '#666' }]} />
                    <Text style={styles.faqQuestion} numberOfLines={isExpanded ? undefined : 2}>
                        {faq.question}
                    </Text>
                    <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
                </View>
                {isExpanded && (
                    <View style={styles.faqAnswerContainer}>
                        <Text style={styles.faqAnswer}>{faq.answer}</Text>
                        {faq.tags?.length > 0 && (
                            <View style={styles.tagsRow}>
                                {faq.tags.slice(0, 4).map((tag, i) => (
                                    <View key={i} style={styles.tag}>
                                        <Text style={styles.tagText}>{tag}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                        {/* Botones de Like/Dislike solo para usuarios con entrenador */}
                        {hasTrainer && (
                            <View style={styles.feedbackRow}>
                                <Text style={styles.feedbackLabel}>¿Te ayudó esta respuesta?</Text>
                                <View style={styles.feedbackButtons}>
                                    <TouchableOpacity
                                        style={[
                                            styles.feedbackBtn,
                                            styles.feedbackBtnLike,
                                            votedFaqs[faq._id] === 'helpful' && styles.feedbackBtnActive
                                        ]}
                                        onPress={() => voteFaqHelpful(faq._id)}
                                        disabled={!!votedFaqs[faq._id]}
                                    >
                                        <Feather name="thumbs-up" size={16} color={votedFaqs[faq._id] === 'helpful' ? '#fff' : '#4CAF50'} />
                                        <Text style={[styles.feedbackBtnText, votedFaqs[faq._id] === 'helpful' && styles.feedbackBtnTextActive]}>Sí</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.feedbackBtn,
                                            styles.feedbackBtnDislike,
                                            votedFaqs[faq._id] === 'not-helpful' && styles.feedbackBtnActiveRed
                                        ]}
                                        onPress={() => voteFaqNotHelpful(faq._id)}
                                        disabled={!!votedFaqs[faq._id]}
                                    >
                                        <Feather name="thumbs-down" size={16} color={votedFaqs[faq._id] === 'not-helpful' ? '#fff' : '#EF4444'} />
                                        <Text style={[styles.feedbackBtnText, styles.feedbackBtnTextRed, votedFaqs[faq._id] === 'not-helpful' && styles.feedbackBtnTextActive]}>No</Text>
                                    </TouchableOpacity>
                                </View>
                                {votedFaqs[faq._id] && (
                                    <Text style={styles.feedbackThanks}>¡Gracias por tu feedback!</Text>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2196F3" />
                    <Text style={styles.loadingText}>Cargando ayuda...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const displayFaqs = searchQuery.length >= 2
        ? searchResults
        : selectedCategory
            ? (grouped[selectedCategory] || [])
            : faqs;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ayuda del Entrenador</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Search Bar - Sticky */}
            <View style={[styles.searchContainer, isLargeScreen && { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}>
                <Feather name="search" size={20} color="#888" style={styles.searchIcon} />
                <EnhancedTextInput
                    style={{ color: '#fff', fontSize: 15, ...(Platform.OS === 'web' && { outlineStyle: 'none' }) }}
                    containerStyle={{ flex: 1 }}
                    placeholder="Busca tu duda (ej. Creatina, Ayuno...)"
                    placeholderTextColor="#888"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searching && <ActivityIndicator size="small" color="#2196F3" />}
                {searchQuery.length > 0 && !searching && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Feather name="x" size={20} color="#888" />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={isLargeScreen && { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2196F3" />}
            >
                {/* Categories Grid */}
                {!searchQuery && (
                    <View style={styles.categoriesSection}>
                        <Text style={styles.sectionTitle}>Categorías</Text>
                        <View style={styles.categoriesGrid}>
                            {Object.entries(CATEGORIES_CONFIG).map(([key, config]) => (
                                <TouchableOpacity
                                    key={key}
                                    style={[
                                        styles.categoryCard,
                                        { width: categoryWidth },
                                        selectedCategory === key && styles.categoryCardSelected,
                                        { borderColor: config.color }
                                    ]}
                                    onPress={() => setSelectedCategory(selectedCategory === key ? null : key)}
                                >
                                    <Text style={styles.categoryEmoji}>{config.name.split(' ')[0]}</Text>
                                    <Text style={[styles.categoryName, selectedCategory === key && { color: config.color }]}>
                                        {config.name.split(' ').slice(1).join(' ')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Top 5 */}
                {!searchQuery && !selectedCategory && topFaqs.length > 0 && (
                    <View style={styles.topSection}>
                        <Text style={styles.sectionTitle}>🔥 Más consultadas</Text>
                        {topFaqs.map(renderFaqItem)}
                    </View>
                )}

                {/* FAQs List */}
                <View style={styles.faqsSection}>
                    {searchQuery.length >= 2 && (
                        <Text style={styles.sectionTitle}>
                            {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
                        </Text>
                    )}
                    {selectedCategory && (
                        <Text style={styles.sectionTitle}>
                            {CATEGORIES_CONFIG[selectedCategory]?.name}
                        </Text>
                    )}
                    {displayFaqs.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Feather name="inbox" size={48} color="#555" />
                            <Text style={styles.emptyText}>
                                {searchQuery ? 'No se encontraron resultados' : 'No hay FAQs disponibles'}
                            </Text>
                        </View>
                    ) : (
                        displayFaqs.map(renderFaqItem)
                    )}
                </View>

                {/* Contact Button - Chat para clientes con entrenador, Formulario para FREEUSER/PREMIUM */}
                <TouchableOpacity style={styles.contactButton} onPress={openContact}>
                    <Feather name={hasTrainer ? 'message-circle' : 'external-link'} size={20} color="#fff" />
                    <Text style={styles.contactButtonText}>
                        {hasTrainer ? '¿No resolvió tu duda? Contactar Coach' : '¿No resolvió tu duda? Enviar consulta'}
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#888', marginTop: 12 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1a1a1a'
    },
    backButton: { padding: 8 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

    searchContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e',
        marginHorizontal: 16, marginVertical: 12, borderRadius: 12, paddingHorizontal: 12, height: 48
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: '#fff', fontSize: 15, ...(Platform.OS === 'web' && { outlineStyle: 'none' }) },

    content: { flex: 1 },

    sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12, marginHorizontal: 16 },

    categoriesSection: { marginBottom: 20 },
    categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, justifyContent: 'center' },
    categoryCard: {
        margin: '1.5%', backgroundColor: '#1e1e1e', borderRadius: 12,
        padding: 12, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', minWidth: 90
    },
    categoryCardSelected: { backgroundColor: '#252525' },
    categoryEmoji: { fontSize: 24, marginBottom: 4 },
    categoryName: { color: '#ccc', fontSize: 11, textAlign: 'center' },

    topSection: { marginBottom: 20 },

    faqsSection: { marginBottom: 20 },
    faqItem: {
        backgroundColor: '#1e1e1e', marginHorizontal: 16, marginBottom: 8,
        borderRadius: 12, padding: 14
    },
    faqItemExpanded: { backgroundColor: '#252525' },
    faqHeader: { flexDirection: 'row', alignItems: 'center' },
    categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    faqQuestion: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
    faqAnswerContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#333' },
    faqAnswer: { color: '#ccc', fontSize: 14, lineHeight: 22 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
    tag: { backgroundColor: '#333', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 6, marginBottom: 4 },
    tagText: { color: '#888', fontSize: 11 },

    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#666', marginTop: 12, fontSize: 14 },

    contactButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#4CAF50', marginHorizontal: 16, padding: 14, borderRadius: 12
    },
    contactButtonText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },

    // Estilos para botones de feedback
    feedbackRow: {
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#333',
        alignItems: 'center'
    },
    feedbackLabel: {
        color: '#888',
        fontSize: 13,
        marginBottom: 10
    },
    feedbackButtons: {
        flexDirection: 'row',
        gap: 12
    },
    feedbackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        gap: 6
    },
    feedbackBtnLike: {
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)'
    },
    feedbackBtnDislike: {
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)'
    },
    feedbackBtnActive: {
        backgroundColor: '#4CAF50',
        borderColor: '#4CAF50'
    },
    feedbackBtnActiveRed: {
        backgroundColor: '#EF4444',
        borderColor: '#EF4444'
    },
    feedbackBtnText: {
        color: '#4CAF50',
        fontSize: 13,
        fontWeight: '600'
    },
    feedbackBtnTextRed: {
        color: '#EF4444'
    },
    feedbackBtnTextActive: {
        color: '#fff'
    },
    feedbackThanks: {
        color: '#4CAF50',
        fontSize: 12,
        marginTop: 8,
        fontStyle: 'italic'
    }
});
