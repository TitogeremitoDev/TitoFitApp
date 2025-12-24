/**
 * FeedbackNoteBubble.jsx - FAB Widget para Notas del Entrenador
 * Burbuja flotante tipo Messenger Heads para anotar mientras navegas
 * 
 * USO:
 * 1. Importar en (coach)/_layout.jsx o en cada pantalla del coach
 * 2. Pasar clientId del cliente actualmente visualizado
 * 3. Las notas se guardan como draft y se pueden convertir en feedback
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Animated,
    PanResponder,
    Dimensions,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUBBLE_SIZE = 56;
const EXPANDED_WIDTH = Math.min(320, SCREEN_WIDTH - 40);
const EXPANDED_HEIGHT = 400;

// ═══════════════════════════════════════════════════════════════════════════
// NOTE ITEM
// ═══════════════════════════════════════════════════════════════════════════

const NoteItem = ({ note, onDelete }) => (
    <View style={styles.noteItem}>
        <View style={styles.noteContent}>
            <Text style={styles.noteText}>{note.text}</Text>
            {note.context && (
                <View style={styles.noteContext}>
                    <Ionicons name="location-outline" size={12} color="#8b5cf6" />
                    <Text style={styles.noteContextText}>{note.context.screen}</Text>
                </View>
            )}
        </View>
        <TouchableOpacity onPress={() => onDelete(note.id)} style={styles.noteDelete}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
    </View>
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function FeedbackNoteBubble({ clientId, clientName, currentScreen }) {
    const { token } = useAuth();
    const router = useRouter();

    const [isExpanded, setIsExpanded] = useState(false);
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [isVisible, setIsVisible] = useState(true);

    // Animaciones
    const expandAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const positionY = useRef(new Animated.Value(SCREEN_HEIGHT * 0.6)).current;
    const positionX = useRef(new Animated.Value(SCREEN_WIDTH - BUBBLE_SIZE - 20)).current;

    // Storage key
    const storageKey = `feedback_notes_${clientId}`;

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD/SAVE NOTES
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        loadNotes();
    }, [clientId]);

    const loadNotes = async () => {
        try {
            const stored = await AsyncStorage.getItem(storageKey);
            if (stored) {
                setNotes(JSON.parse(stored));
            } else {
                setNotes([]);
            }
        } catch (error) {
            console.log('[FeedbackBubble] Error loading notes:', error);
        }
    };

    const saveNotes = async (updatedNotes) => {
        try {
            await AsyncStorage.setItem(storageKey, JSON.stringify(updatedNotes));
        } catch (error) {
            console.log('[FeedbackBubble] Error saving notes:', error);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // ANIMATIONS
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        Animated.timing(expandAnim, {
            toValue: isExpanded ? 1 : 0,
            duration: 250,
            useNativeDriver: false
        }).start();
    }, [isExpanded]);

    // Pulse animation when notes > 0
    useEffect(() => {
        if (notes.length > 0 && !isExpanded) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 800,
                        useNativeDriver: true
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true
                    })
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [notes.length, isExpanded]);

    // ─────────────────────────────────────────────────────────────────────────
    // DRAG HANDLER
    // ─────────────────────────────────────────────────────────────────────────

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !isExpanded,
            onMoveShouldSetPanResponder: () => !isExpanded,
            onPanResponderGrant: () => {
                positionX.setOffset(positionX._value);
                positionY.setOffset(positionY._value);
                positionX.setValue(0);
                positionY.setValue(0);
            },
            onPanResponderMove: Animated.event(
                [null, { dx: positionX, dy: positionY }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (_, gesture) => {
                positionX.flattenOffset();
                positionY.flattenOffset();

                // Snap to edges
                const finalX = gesture.moveX > SCREEN_WIDTH / 2
                    ? SCREEN_WIDTH - BUBBLE_SIZE - 20
                    : 20;

                Animated.spring(positionX, {
                    toValue: finalX,
                    useNativeDriver: false
                }).start();

                // Keep within bounds
                const clampedY = Math.max(100, Math.min(SCREEN_HEIGHT - BUBBLE_SIZE - 100, positionY._value));
                if (clampedY !== positionY._value) {
                    Animated.spring(positionY, {
                        toValue: clampedY,
                        useNativeDriver: false
                    }).start();
                }
            }
        })
    ).current;

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS
    // ─────────────────────────────────────────────────────────────────────────

    const handleAddNote = () => {
        if (!newNote.trim()) return;

        const note = {
            id: Date.now().toString(),
            text: newNote.trim(),
            context: currentScreen ? { screen: currentScreen } : null,
            createdAt: new Date().toISOString()
        };

        const updatedNotes = [...notes, note];
        setNotes(updatedNotes);
        saveNotes(updatedNotes);
        setNewNote('');
    };

    const handleDeleteNote = (noteId) => {
        const updatedNotes = notes.filter(n => n.id !== noteId);
        setNotes(updatedNotes);
        saveNotes(updatedNotes);
    };

    const handleClearAll = () => {
        Alert.alert(
            '¿Eliminar todas las notas?',
            'Esta acción no se puede deshacer',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: () => {
                        setNotes([]);
                        saveNotes([]);
                    }
                }
            ]
        );
    };

    const handleCreateFeedback = () => {
        if (notes.length === 0) {
            Alert.alert('Sin notas', 'Añade algunas notas primero');
            return;
        }

        // Navigate to feedbacks screen with notes pre-populated
        router.push({
            pathname: '/(coach)/feedbacks',
            params: {
                clientId,
                prefillNotes: JSON.stringify(notes.map(n => n.text))
            }
        });

        setIsExpanded(false);
    };

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    if (!clientId || !isVisible) return null;

    const bubbleWidth = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [BUBBLE_SIZE, EXPANDED_WIDTH]
    });

    const bubbleHeight = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [BUBBLE_SIZE, EXPANDED_HEIGHT]
    });

    const bubbleRadius = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [BUBBLE_SIZE / 2, 20]
    });

    const contentOpacity = expandAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0, 1]
    });

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [
                        { translateX: positionX },
                        { translateY: positionY },
                        { scale: isExpanded ? 1 : pulseAnim }
                    ],
                    width: bubbleWidth,
                    height: bubbleHeight,
                    borderRadius: bubbleRadius
                }
            ]}
            {...(isExpanded ? {} : panResponder.panHandlers)}
        >
            <BlurView intensity={90} tint="dark" style={styles.blur}>
                {/* Minimized State */}
                {!isExpanded && (
                    <TouchableOpacity
                        style={styles.bubbleButton}
                        onPress={toggleExpand}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="create-outline" size={24} color="#fff" />
                        {notes.length > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{notes.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}

                {/* Expanded State */}
                <Animated.View style={[styles.expandedContent, { opacity: contentOpacity }]}>
                    {isExpanded && (
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            style={{ flex: 1 }}
                        >
                            {/* Header */}
                            <View style={styles.header}>
                                <View style={styles.headerInfo}>
                                    <Text style={styles.headerTitle}>📝 Notas</Text>
                                    <Text style={styles.headerSubtitle}>{clientName || 'Cliente'}</Text>
                                </View>
                                <View style={styles.headerActions}>
                                    {notes.length > 0 && (
                                        <TouchableOpacity onPress={handleClearAll} style={styles.headerBtn}>
                                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={toggleExpand} style={styles.headerBtn}>
                                        <Ionicons name="close" size={20} color="#94a3b8" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Notes List */}
                            <ScrollView
                                style={styles.notesList}
                                contentContainerStyle={styles.notesContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {notes.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="document-text-outline" size={32} color="#475569" />
                                        <Text style={styles.emptyText}>Sin notas aún</Text>
                                        <Text style={styles.emptyHint}>Añade notas mientras analizas los datos</Text>
                                    </View>
                                ) : (
                                    notes.map(note => (
                                        <NoteItem
                                            key={note.id}
                                            note={note}
                                            onDelete={handleDeleteNote}
                                        />
                                    ))
                                )}
                            </ScrollView>

                            {/* Input */}
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    value={newNote}
                                    onChangeText={setNewNote}
                                    placeholder="Nueva nota..."
                                    placeholderTextColor="#64748b"
                                    multiline
                                    maxLength={200}
                                    onSubmitEditing={handleAddNote}
                                />
                                <TouchableOpacity
                                    style={[styles.addBtn, !newNote.trim() && styles.addBtnDisabled]}
                                    onPress={handleAddNote}
                                    disabled={!newNote.trim()}
                                >
                                    <Ionicons name="add" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {/* Create Feedback Button */}
                            {notes.length > 0 && (
                                <TouchableOpacity
                                    style={styles.createBtn}
                                    onPress={handleCreateFeedback}
                                >
                                    <Ionicons name="document-text" size={18} color="#fff" />
                                    <Text style={styles.createBtnText}>Crear Feedback ({notes.length})</Text>
                                </TouchableOpacity>
                            )}
                        </KeyboardAvoidingView>
                    )}
                </Animated.View>
            </BlurView>
        </Animated.View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        zIndex: 9999,
        overflow: 'hidden',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10
    },
    blur: {
        flex: 1,
        overflow: 'hidden'
    },

    // Minimized Bubble
    bubbleButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(139, 92, 246, 0.9)'
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700'
    },

    // Expanded Content
    expandedContent: {
        flex: 1,
        backgroundColor: 'rgba(30, 41, 59, 0.95)'
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)'
    },
    headerInfo: {
        flex: 1
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff'
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8
    },
    headerBtn: {
        padding: 6
    },

    // Notes List
    notesList: {
        flex: 1
    },
    notesContent: {
        padding: 12
    },
    noteItem: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8
    },
    noteContent: {
        flex: 1
    },
    noteText: {
        fontSize: 14,
        color: '#e2e8f0',
        lineHeight: 20
    },
    noteContext: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6
    },
    noteContextText: {
        fontSize: 11,
        color: '#8b5cf6'
    },
    noteDelete: {
        padding: 4,
        marginLeft: 8
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: 30
    },
    emptyText: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 8
    },
    emptyHint: {
        fontSize: 12,
        color: '#475569',
        marginTop: 4,
        textAlign: 'center'
    },

    // Input
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        gap: 8
    },
    input: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: '#fff',
        maxHeight: 80
    },
    addBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    addBtnDisabled: {
        backgroundColor: '#475569'
    },

    // Create Button
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        margin: 12,
        marginTop: 0,
        padding: 14,
        backgroundColor: '#8b5cf6',
        borderRadius: 12
    },
    createBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff'
    }
});
