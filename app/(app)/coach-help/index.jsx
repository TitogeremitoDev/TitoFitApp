/**
 * coach-help/index.jsx
 * Pantalla de ayuda del entrenador para clientes
 * Compatible con iOS, Android y Web
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, SafeAreaView, StatusBar, RefreshControl, Platform,
    useWindowDimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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
    const { token } = useAuth();
    const { width: screenWidth } = useWindowDimensions();

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

    const openChat = () => {
        router.push('/(app)/chat');
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
                <TextInput
                    style={styles.searchInput}
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

                {/* Contact Coach Button */}
                <TouchableOpacity style={styles.contactButton} onPress={openChat}>
                    <Feather name="message-circle" size={20} color="#fff" />
                    <Text style={styles.contactButtonText}>¿No resolvió tu duda? Contactar Coach</Text>
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
    contactButtonText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 }
});
