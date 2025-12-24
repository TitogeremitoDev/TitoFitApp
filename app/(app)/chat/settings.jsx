/**
 * chat/settings.jsx - Ajustes del Chat
 * Permite seleccionar temas visuales (solo desbloqueados) y tamaño de letra
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Platform
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useChatTheme, CHAT_THEME_COLLECTIONS, DEFAULT_UNLOCKED_THEMES } from '../../../context/ChatThemeContext';
import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function ChatSettingsScreen() {
    const router = useRouter();
    const { chatTheme, chatThemeId, setChatThemeId, availableChatThemes, fontSize, setFontSize, fontSizeValue } = useChatTheme();
    const { user } = useAuth();

    // Estado para los temas desbloqueados (cargados de AsyncStorage y cloud)
    const [unlockedThemeIds, setUnlockedThemeIds] = useState(new Set(DEFAULT_UNLOCKED_THEMES));
    const isPremiumUser = ['PREMIUM', 'CLIENTE', 'ENTRENADOR', 'ADMIN'].includes(user?.tipoUsuario);

    // Cargar temas desbloqueados del usuario
    useEffect(() => {
        const loadUnlockedThemes = async () => {
            try {
                // Siempre cargar del local primero
                const saved = await AsyncStorage.getItem('totalgains_unlocked_themes');
                let localPurchases = saved ? JSON.parse(saved) : [];

                // Si es premium, también cargar del servidor y hacer merge
                if (isPremiumUser) {
                    const token = await AsyncStorage.getItem('totalgains_token');
                    if (token) {
                        try {
                            const response = await fetch(`${API_URL}/api/achievements`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            const data = await response.json();

                            if (data.purchases && Array.isArray(data.purchases)) {
                                // Merge local y cloud purchases
                                const cloudPurchases = data.purchases;
                                localPurchases = [...new Set([...localPurchases, ...cloudPurchases])];
                            }
                        } catch (cloudError) {
                            console.warn('[ChatSettings] Error loading purchases from cloud:', cloudError);
                        }
                    }
                }

                // Combinar básicos + purchases del usuario
                const allUnlocked = new Set([...DEFAULT_UNLOCKED_THEMES, ...localPurchases]);
                setUnlockedThemeIds(allUnlocked);

                console.log('[ChatSettings] Loaded purchases:', localPurchases);
                console.log('[ChatSettings] Unlocked IDs:', [...allUnlocked]);
            } catch (e) {
                console.warn('[ChatSettings] Error loading unlocked themes:', e);
            }
        };
        loadUnlockedThemes();
    }, [isPremiumUser]);

    // Filtrar temas que el usuario tiene desbloqueados
    const unlockedThemes = availableChatThemes.filter(t => unlockedThemeIds.has(t.id));
    console.log('[ChatSettings] Unlocked themes:', unlockedThemes.map(t => t.id));

    const getCollectionIcon = (collection) => {
        const icons = {
            'BASICO': '🎨',
            'POKEMON': '⚡',
            'STAR_WARS': '⚔️',
            'MARVEL': '🦸',
            'WARCRAFT': '🗡️'
        };
        return icons[collection] || '🎨';
    };

    const getCollectionName = (collection) => {
        const names = {
            'BASICO': 'Básicos',
            'POKEMON': 'Pokémon',
            'STAR_WARS': 'Star Wars',
            'MARVEL': 'Marvel',
            'WARCRAFT': 'Warcraft'
        };
        return names[collection] || collection;
    };

    const fontSizeOptions = [
        { id: 'small', label: 'Pequeño', size: 13 },
        { id: 'medium', label: 'Mediano', size: 15 },
        { id: 'large', label: 'Grande', size: 17 }
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: chatTheme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: chatTheme.cardBackground, borderBottomColor: chatTheme.border }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={chatTheme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: chatTheme.text }]}>Ajustes del Chat</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Preview */}
                <View style={[styles.previewCard, { backgroundColor: chatTheme.cardBackground, borderColor: chatTheme.border }]}>
                    <Text style={[styles.previewLabel, { color: chatTheme.textSecondary }]}>Vista previa</Text>
                    <View style={styles.previewChat}>
                        {/* Bubble other */}
                        <View style={[styles.previewBubble, styles.previewBubbleOther, { backgroundColor: chatTheme.bubbleOther, borderColor: chatTheme.border }]}>
                            <Text style={{ color: chatTheme.bubbleOtherText, fontSize: fontSizeValue }}>Hola! ¿Cómo va el entreno?</Text>
                        </View>
                        {/* Bubble own */}
                        <View style={[styles.previewBubble, styles.previewBubbleOwn, { backgroundColor: chatTheme.bubbleOwn }]}>
                            <Text style={{ color: chatTheme.bubbleOwnText, fontSize: fontSizeValue }}>¡Muy bien! 💪</Text>
                        </View>
                    </View>
                </View>

                {/* Font Size Selector */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: chatTheme.text }]}>
                        <Ionicons name="text" size={18} /> Tamaño de letra
                    </Text>
                    <View style={styles.fontSizeRow}>
                        {fontSizeOptions.map(opt => {
                            const isSelected = fontSize === opt.id;
                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    style={[
                                        styles.fontSizeBtn,
                                        {
                                            backgroundColor: chatTheme.cardBackground,
                                            borderColor: isSelected ? chatTheme.primary : chatTheme.border,
                                            borderWidth: isSelected ? 2 : 1
                                        }
                                    ]}
                                    onPress={() => setFontSize(opt.id)}
                                >
                                    <Text style={[
                                        styles.fontSizeLabel,
                                        { color: isSelected ? chatTheme.primary : chatTheme.text, fontSize: opt.size }
                                    ]}>
                                        Aa
                                    </Text>
                                    <Text style={[styles.fontSizeName, { color: chatTheme.textSecondary }]}>
                                        {opt.label}
                                    </Text>
                                    {isSelected && (
                                        <View style={[styles.selectedCheck, { backgroundColor: chatTheme.primary }]}>
                                            <Ionicons name="checkmark" size={10} color="#fff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Theme Selector by Collection - Solo temas desbloqueados */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: chatTheme.text }]}>
                        <Ionicons name="color-palette" size={18} /> Temas disponibles
                    </Text>

                    {unlockedThemes.length === 0 ? (
                        <View style={[styles.emptyState, { backgroundColor: chatTheme.cardBackground, borderColor: chatTheme.border }]}>
                            <Ionicons name="lock-closed" size={32} color={chatTheme.textTertiary} />
                            <Text style={[styles.emptyText, { color: chatTheme.textSecondary }]}>
                                Desbloquea temas en la tienda de logros
                            </Text>
                        </View>
                    ) : (
                        CHAT_THEME_COLLECTIONS.map(collection => {
                            const themesInCollection = unlockedThemes.filter(t => t.collection === collection);
                            if (themesInCollection.length === 0) return null;

                            return (
                                <View key={collection} style={styles.collectionSection}>
                                    <Text style={[styles.collectionTitle, { color: chatTheme.textSecondary }]}>
                                        {getCollectionIcon(collection)} {getCollectionName(collection)}
                                    </Text>
                                    <View style={styles.themesGrid}>
                                        {themesInCollection.map(theme => {
                                            const isSelected = chatThemeId === theme.id;
                                            return (
                                                <TouchableOpacity
                                                    key={theme.id}
                                                    style={[
                                                        styles.themeCard,
                                                        {
                                                            backgroundColor: theme.cardBackground,
                                                            borderColor: isSelected ? theme.primary : theme.border,
                                                            borderWidth: isSelected ? 3 : 1
                                                        }
                                                    ]}
                                                    onPress={() => setChatThemeId(theme.id)}
                                                >
                                                    {/* Color Preview */}
                                                    <View style={styles.colorPreview}>
                                                        <View style={[styles.colorDot, { backgroundColor: theme.header }]} />
                                                        <View style={[styles.colorDot, { backgroundColor: theme.bubbleOwn }]} />
                                                        <View style={[styles.colorDot, { backgroundColor: theme.bubbleOther, borderWidth: 1, borderColor: theme.border }]} />
                                                    </View>
                                                    <Text style={[styles.themeName, { color: theme.text }]} numberOfLines={1}>
                                                        {theme.name}
                                                    </Text>
                                                    {isSelected && (
                                                        <View style={[styles.selectedBadge, { backgroundColor: theme.primary }]}>
                                                            <Ionicons name="checkmark" size={12} color="#fff" />
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1
    },
    backBtn: {
        padding: 4
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 12
    },
    content: {
        padding: 16
    },

    // Preview
    previewCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1
    },
    previewLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    previewChat: {
        gap: 8
    },
    previewBubble: {
        padding: 10,
        borderRadius: 16,
        maxWidth: '70%'
    },
    previewBubbleOther: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderBottomLeftRadius: 4
    },
    previewBubbleOwn: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4
    },

    // Sections
    section: {
        marginBottom: 24
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12
    },

    // Font Size
    fontSizeRow: {
        flexDirection: 'row',
        gap: 12
    },
    fontSizeBtn: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        position: 'relative'
    },
    fontSizeLabel: {
        fontWeight: '700',
        marginBottom: 4
    },
    fontSizeName: {
        fontSize: 11
    },
    selectedCheck: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center'
    },

    // Empty State
    emptyState: {
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        gap: 8
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center'
    },

    // Collections
    collectionSection: {
        marginBottom: 16
    },
    collectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 10
    },
    themesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    themeCard: {
        width: Platform.OS === 'web' ? 140 : '30%',
        minWidth: 100,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        position: 'relative'
    },
    colorPreview: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8
    },
    colorDot: {
        width: 20,
        height: 20,
        borderRadius: 10
    },
    themeName: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center'
    },
    selectedBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
