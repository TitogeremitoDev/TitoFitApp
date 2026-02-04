// src/components/coach/SmartFeedbackInput.jsx
// ═══════════════════════════════════════════════════════════════════════════
// SMART FEEDBACK INPUT - Autocompletado inteligente de snippets
// Sugerencias en flujo normal (no absolute) para evitar problemas de zIndex
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../../../components/ui';

function normalizeText(text) {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export default function SmartFeedbackInput({
    value,
    onChangeText,
    placeholder = 'Escribe tu feedback...',
    snippets = [],
    exerciseName = '',
    style,
    ...props
}) {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [baseTextLength, setBaseTextLength] = useState(0); // Desde dónde buscar
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 768;

    const exerciseWords = useMemo(() => {
        return normalizeText(exerciseName).split(' ').filter(w => w.length >= 3);
    }, [exerciseName]);

    const normalizedSnippets = useMemo(() => {
        return snippets.map(s => ({
            ...s,
            normalizedText: normalizeText(s.text || ''),
            normalizedLabel: normalizeText(s.shortLabel || ''),
            normalizedTags: (s.tags || []).map(t => normalizeText(t))
        }));
    }, [snippets]);

    const findMatches = useCallback((fullText) => {
        // Buscar solo en texto NUEVO (después del último snippet)
        const searchText = fullText.slice(baseTextLength).trim();

        if (!searchText || searchText.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const normalizedInput = normalizeText(searchText);
        const words = normalizedInput.split(' ').filter(w => w.length >= 2);

        const matches = normalizedSnippets.filter(s => {
            return words.some(word =>
                s.normalizedText.includes(word) ||
                s.normalizedLabel.includes(word)
            );
        });

        const scored = matches.map(s => {
            let score = 0;
            words.forEach(word => {
                if (s.normalizedLabel.includes(word)) score += 3;
                if (s.normalizedText.includes(word)) score += 1;
                if (s.normalizedText.startsWith(normalizedInput)) score += 5;
            });

            if (exerciseWords.length > 0 && s.normalizedTags) {
                exerciseWords.forEach(exWord => {
                    s.normalizedTags.forEach(tag => {
                        if (tag.includes(exWord) || exWord.includes(tag)) {
                            score += 10;
                        }
                    });
                });
            }

            return { ...s, score };
        }).sort((a, b) => b.score - a.score);

        setSuggestions(scored.slice(0, 4));
        setShowSuggestions(scored.length > 0);
        setSelectedIndex(0);
    }, [normalizedSnippets, exerciseWords, baseTextLength]);

    const handleChangeText = useCallback((text) => {
        onChangeText(text);
        findMatches(text);
    }, [onChangeText, findMatches]);

    const selectSuggestion = useCallback((snippet) => {
        // Mantener texto base + añadir snippet
        const baseText = value.slice(0, baseTextLength);
        const separator = baseText && !baseText.endsWith(' ') ? ' ' : '';
        const newText = baseText + separator + snippet.text;

        onChangeText(newText);
        setBaseTextLength(newText.length); // Próxima búsqueda desde aquí
        setSuggestions([]);
        setShowSuggestions(false);
        setSelectedIndex(0);
    }, [onChangeText, value, baseTextLength]);

    // 🆕 Navegación con teclado: Flechas + Enter
    const handleKeyPress = useCallback((e) => {
        if (!isLargeScreen || suggestions.length === 0) return;

        const key = e.nativeEvent.key;

        if (key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev =>
                prev < suggestions.length - 1 ? prev + 1 : 0
            );
        } else if (key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev =>
                prev > 0 ? prev - 1 : suggestions.length - 1
            );
        } else if (key === 'Enter' && showSuggestions) {
            e.preventDefault();
            selectSuggestion(suggestions[selectedIndex]);
        }
    }, [isLargeScreen, suggestions, selectedIndex, showSuggestions, selectSuggestion]);

    return (
        <View style={[styles.container, style]}>
            {/* Input */}
            <EnhancedTextInput
                containerStyle={styles.inputContainer}
                style={styles.inputText}
                value={value}
                onChangeText={handleChangeText}
                placeholder={placeholder}
                placeholderTextColor="#94a3b8"
                multiline
                maxLength={500}
                {...(Platform.OS === 'web' && { onKeyPress: handleKeyPress })}
                {...props}
            />

            {/* Sugerencias - En flujo normal, NO absolute */}
            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <View style={styles.suggestionsHeader}>
                        <Ionicons name="flash" size={14} color="#60a5fa" />
                        <Text style={styles.suggestionsTitle}>Sugerencias</Text>
                        {isLargeScreen && (
                            <Text style={styles.enterHint}>Enter para aceptar</Text>
                        )}
                        <TouchableOpacity
                            onPress={() => setShowSuggestions(false)}
                            style={styles.closeBtn}
                        >
                            <Ionicons name="close" size={16} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                    {suggestions.map((snippet, index) => (
                        <TouchableOpacity
                            key={snippet._id || index}
                            style={[
                                styles.suggestionItem,
                                index === selectedIndex && styles.suggestionItemSelected
                            ]}
                            onPress={() => selectSuggestion(snippet)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.suggestionLabel} numberOfLines={1}>
                                {snippet.shortLabel}
                            </Text>
                            <Text style={styles.suggestionText} numberOfLines={1}>
                                {snippet.text}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        // Sin position relative ni zIndex
    },
    inputContainer: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 14,
        minHeight: 100,
        borderWidth: 1,
        borderColor: '#333',
    },
    inputText: {
        color: '#fff',
        fontSize: 15,
        textAlignVertical: 'top',
    },
    suggestionsContainer: {
        marginTop: 8,
        backgroundColor: '#1e1e3f',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#4361ee',
        overflow: 'hidden',
    },
    suggestionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#4361ee20',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    suggestionsTitle: {
        color: '#60a5fa',
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },
    enterHint: {
        color: '#64748b',
        fontSize: 10,
    },
    closeBtn: {
        padding: 2,
    },
    suggestionItem: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    suggestionItemSelected: {
        backgroundColor: '#4361ee30',
        borderLeftWidth: 3,
        borderLeftColor: '#4361ee',
    },
    suggestionLabel: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 2,
    },
    suggestionText: {
        color: '#94a3b8',
        fontSize: 12,
    },
});
