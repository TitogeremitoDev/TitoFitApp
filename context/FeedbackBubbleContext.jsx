/**
 * FeedbackBubbleContext.jsx - FAB Global de Feedback
 * Burbuja flotante persistente en todas las pantallas de coach
 * Muestra un mini-formulario de feedback (Highlights + Análisis + Plan)
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Pressable,
    Animated,
    PanResponder,
    Dimensions,
    ScrollView,
    Platform,
    useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConfirmModal from '../components/ConfirmModal';

// Valores por defecto iniciales (se actualizan dinámicamente)
const { width: INITIAL_WIDTH, height: INITIAL_HEIGHT } = Dimensions.get('window');
const BUBBLE_SIZE = 56;

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const FeedbackBubbleContext = createContext(null);

export const useFeedbackBubble = () => {
    const context = useContext(FeedbackBubbleContext);
    if (!context) {
        return {
            setActiveClient: () => { },
            showBubble: () => { },
            hideBubble: () => { },
            activeClient: null,
            isVisible: false
        };
    }
    return context;
};

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function FeedbackBubbleProvider({ children }) {
    const router = useRouter();

    // Dimensiones dinámicas de la pantalla
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
    const EXPANDED_WIDTH = Math.min(340, SCREEN_WIDTH - 32);
    const EXPANDED_HEIGHT = Math.min(480, SCREEN_HEIGHT - 200);

    // State
    const [activeClient, setActiveClientState] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Modal states for confirmations (cross-platform)
    const [showClearModal, setShowClearModal] = useState(false);
    const [showEmptyModal, setShowEmptyModal] = useState(false);

    // Feedback form state
    const [highlights, setHighlights] = useState([]);
    const [newHighlight, setNewHighlight] = useState('');
    const [analysis, setAnalysis] = useState('');
    const [analysisNotes, setAnalysisNotes] = useState([]);
    const [newAnalysis, setNewAnalysis] = useState('');
    const [actionItems, setActionItems] = useState([]);
    const [newAction, setNewAction] = useState('');
    const [trafficLight, setTrafficLight] = useState('green');

    // Refs for pan responder
    const isExpandedRef = useRef(false);
    const isDragging = useRef(false);
    // Posición inicial: izquierda, centro vertical
    const lastPosition = useRef({ x: 16, y: INITIAL_HEIGHT * 0.4 });
    const positionY = useRef(new Animated.Value(lastPosition.current.y)).current;
    const positionX = useRef(new Animated.Value(lastPosition.current.x)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // ─────────────────────────────────────────────────────────────────────────
    // SYNC REF & ADJUST POSITION ON EXPAND
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        isExpandedRef.current = isExpanded;

        // When expanding, adjust position to fit on screen
        if (isExpanded) {
            const currentX = lastPosition.current.x;
            const currentY = lastPosition.current.y;

            // Calculate bounds for expanded size
            const maxX = SCREEN_WIDTH - EXPANDED_WIDTH - 16;
            const maxY = SCREEN_HEIGHT - EXPANDED_HEIGHT - 120;

            // Clamp position
            const newX = Math.max(16, Math.min(maxX, currentX));
            const newY = Math.max(80, Math.min(maxY, currentY));

            // Update position if needed
            if (newX !== currentX || newY !== currentY) {
                lastPosition.current = { x: newX, y: newY };
                Animated.parallel([
                    Animated.spring(positionX, {
                        toValue: newX,
                        useNativeDriver: false,
                        friction: 8
                    }),
                    Animated.spring(positionY, {
                        toValue: newY,
                        useNativeDriver: false,
                        friction: 8
                    })
                ]).start();
            }
        }
    }, [isExpanded]);

    // ─────────────────────────────────────────────────────────────────────────
    // STORAGE
    // ─────────────────────────────────────────────────────────────────────────
    const storageKey = activeClient?.id ? `feedback_draft_${activeClient.id}` : null;

    useEffect(() => {
        if (storageKey) loadDraft();
    }, [storageKey]);

    const loadDraft = async () => {
        if (!storageKey) return;
        try {
            const stored = await AsyncStorage.getItem(storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                setHighlights(data.highlights || []);
                // Migrar análisis antiguo a nuevo formato
                if (data.analysis && typeof data.analysis === 'string') {
                    setAnalysisNotes([{ id: Date.now(), text: data.analysis }]);
                } else {
                    setAnalysisNotes(data.analysisNotes || []);
                }
                setActionItems(data.actionItems || []);
                setTrafficLight(data.trafficLight || 'green');
            } else {
                clearForm();
            }
        } catch (e) {
            console.log('[FeedbackBubble] Load error:', e);
        }
    };

    const saveDraft = async () => {
        if (!storageKey) return;
        try {
            await AsyncStorage.setItem(storageKey, JSON.stringify({
                highlights,
                analysisNotes,
                actionItems,
                trafficLight
            }));
        } catch (e) {
            console.log('[FeedbackBubble] Save error:', e);
        }
    };

    const clearForm = async () => {
        setHighlights([]);
        setAnalysisNotes([]);
        setNewAnalysis('');
        setActionItems([]);
        setNewHighlight('');
        setNewAction('');
        setTrafficLight('green');

        // También eliminar el borrador de AsyncStorage
        if (storageKey) {
            try {
                await AsyncStorage.removeItem(storageKey);
                console.log('[FeedbackBubble] Borrador eliminado de storage');
            } catch (e) {
                console.log('[FeedbackBubble] Error al eliminar borrador:', e);
            }
        }
    };

    // Auto-save on changes
    useEffect(() => {
        if (storageKey && (highlights.length > 0 || analysisNotes.length > 0 || actionItems.length > 0)) {
            saveDraft();
        }
    }, [highlights, analysisNotes, actionItems, trafficLight]);

    // ─────────────────────────────────────────────────────────────────────────
    // CONTEXT METHODS
    // ─────────────────────────────────────────────────────────────────────────

    const setActiveClient = useCallback((id, name) => {
        if (id) {
            setActiveClientState({ id, name });
            setIsVisible(true);
        } else {
            setActiveClientState(null);
            setIsVisible(false);
            setIsExpanded(false);
        }
    }, []);

    // Show bubble without a specific client (for browsing mode)
    const showBubble = useCallback(() => {
        setIsVisible(true);
    }, []);

    // Hide bubble
    const hideBubble = useCallback(() => {
        setIsVisible(false);
        setIsExpanded(false);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // FORM HANDLERS
    // ─────────────────────────────────────────────────────────────────────────

    const addHighlight = (itemOrUndefined) => {
        // Support both text input (from FAB form) and rich objects (from CoachStudioModal photos)
        if (itemOrUndefined && typeof itemOrUndefined === 'object') {
            // Rich highlight with photo/media data
            setHighlights(prev => {
                if (prev.some(h => h.id === itemOrUndefined.id)) return prev;
                return [...prev, itemOrUndefined];
            });
            return;
        }
        // Text-only highlight from the input field
        if (!newHighlight.trim()) return;
        setHighlights([...highlights, { id: Date.now(), text: newHighlight.trim() }]);
        setNewHighlight('');
    };

    const removeHighlight = (id) => {
        setHighlights(highlights.filter(h => h.id !== id));
    };

    const addAnalysis = () => {
        if (!newAnalysis.trim()) return;
        setAnalysisNotes([...analysisNotes, { id: Date.now(), text: newAnalysis.trim() }]);
        setNewAnalysis('');
    };

    const removeAnalysis = (id) => {
        setAnalysisNotes(analysisNotes.filter(a => a.id !== id));
    };

    const addAction = () => {
        if (!newAction.trim()) return;
        setActionItems([...actionItems, { id: Date.now(), text: newAction.trim() }]);
        setNewAction('');
    };

    const removeAction = (id) => {
        setActionItems(actionItems.filter(a => a.id !== id));
    };

    const handleSendFeedback = () => {
        if (highlights.length === 0 && analysisNotes.length === 0 && actionItems.length === 0) {
            setShowEmptyModal(true);
            return;
        }

        // Combinar notas de análisis en un string para el informe
        const analysisText = analysisNotes.map(a => a.text).join('\n');

        // Preserve full highlight objects (including photo data) instead of just text
        const highlightsData = highlights.map(h => ({
            text: h.text,
            ...(h.mediaType && {
                id: h.id,
                thumbnail: h.thumbnail,
                sourceMediaUrl: h.sourceMediaUrl,
                mediaType: h.mediaType,
                exerciseName: h.exerciseName,
                compareData: h.compareData || null,
            }),
        }));

        console.log('[FeedbackBubble] Enviando datos:', {
            highlights: highlightsData,
            analysis: analysisText,
            actionItems: actionItems.map(a => a.text),
            trafficLight
        });

        // Navigate to full feedbacks screen with prefill
        router.push({
            pathname: '/(coach)/feedbacks',
            params: {
                clientId: activeClient?.id,
                prefillData: JSON.stringify({
                    highlights: highlightsData,
                    analysis: analysisText,
                    actionItems: actionItems.map(a => a.text),
                    trafficLight
                })
            }
        });

        setIsExpanded(false);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // PAN RESPONDER - Simplified approach without offsets
    // ─────────────────────────────────────────────────────────────────────────

    const startPosition = useRef({ x: 0, y: 0 });
    const lastDragTime = useRef(0);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gs) => {
                return Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 8;
            },
            onPanResponderGrant: () => {
                isDragging.current = true;
                // Store starting position
                startPosition.current = {
                    x: lastPosition.current.x,
                    y: lastPosition.current.y
                };
            },
            onPanResponderMove: (_, gs) => {
                const currentWidth = isExpandedRef.current ? EXPANDED_WIDTH : BUBBLE_SIZE;
                const currentHeight = isExpandedRef.current ? EXPANDED_HEIGHT : BUBBLE_SIZE;

                // Calculate new position
                let newX = startPosition.current.x + gs.dx;
                let newY = startPosition.current.y + gs.dy;

                // Clamp to screen bounds
                const minX = 8;
                const maxX = SCREEN_WIDTH - currentWidth - 8;
                const minY = 60;
                const maxY = SCREEN_HEIGHT - currentHeight - 120;

                newX = Math.max(minX, Math.min(maxX, newX));
                newY = Math.max(minY, Math.min(maxY, newY));

                // Update animated values directly (absolute position)
                positionX.setValue(newX);
                positionY.setValue(newY);
            },
            onPanResponderRelease: (_, gs) => {
                // Mark drag end time before resetting flag
                if (isDragging.current) {
                    lastDragTime.current = Date.now();
                }
                isDragging.current = false;

                const currentWidth = isExpandedRef.current ? EXPANDED_WIDTH : BUBBLE_SIZE;
                const currentHeight = isExpandedRef.current ? EXPANDED_HEIGHT : BUBBLE_SIZE;

                // Calculate final position
                let endX = startPosition.current.x + gs.dx;
                let endY = startPosition.current.y + gs.dy;

                // Clamp Y
                const minY = 80;
                const maxY = SCREEN_HEIGHT - currentHeight - 120;
                endY = Math.max(minY, Math.min(maxY, endY));

                // Snap X to edges
                const snapX = endX > SCREEN_WIDTH / 2
                    ? SCREEN_WIDTH - currentWidth - 16
                    : 16;

                // Save new position
                lastPosition.current = { x: snapX, y: endY };

                // Animate to snapped position
                Animated.parallel([
                    Animated.spring(positionX, {
                        toValue: snapX,
                        useNativeDriver: false,
                        friction: 7,
                        tension: 40
                    }),
                    Animated.spring(positionY, {
                        toValue: endY,
                        useNativeDriver: false,
                        friction: 7,
                        tension: 40
                    })
                ]).start();
            },
            onPanResponderTerminate: () => {
                isDragging.current = false;
                // Reset to last good position
                positionX.setValue(lastPosition.current.x);
                positionY.setValue(lastPosition.current.y);
            }
        })
    ).current;

    // ─────────────────────────────────────────────────────────────────────────
    // PULSE ANIMATION
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        const hasContent = highlights.length > 0 || analysisNotes.length > 0 || actionItems.length > 0;
        if (hasContent && !isExpanded && isVisible) {
            const anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
                ])
            );
            anim.start();
            return () => anim.stop();
        } else {
            pulseAnim.setValue(1);
        }
    }, [highlights.length, analysisNotes.length, actionItems.length, isExpanded, isVisible]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    const contentCount = highlights.length + analysisNotes.length + actionItems.length;
    const trafficColors = { green: '#22c55e', yellow: '#eab308', red: '#ef4444' };

    return (
        <FeedbackBubbleContext.Provider value={{ setActiveClient, showBubble, hideBubble, activeClient, isVisible }}>
            {children}

            {/* FAB con cliente activo - Formulario completo */}
            {isVisible && activeClient && (
                <Animated.View
                    style={[
                        styles.container,
                        {
                            left: positionX,
                            top: positionY,
                            width: isExpanded ? EXPANDED_WIDTH : BUBBLE_SIZE,
                            height: isExpanded ? EXPANDED_HEIGHT : BUBBLE_SIZE,
                            borderRadius: isExpanded ? 20 : BUBBLE_SIZE / 2,
                            transform: [{ scale: isExpanded ? 1 : pulseAnim }]
                        }
                    ]}
                    {...(!isExpanded ? panResponder.panHandlers : {})}
                >
                    {/* MINIMIZED */}
                    {!isExpanded ? (
                        <Pressable
                            style={styles.bubble}
                            onPress={() => {
                                // Only expand if we haven't been dragging recently (within 200ms)
                                const timeSinceDrag = Date.now() - (lastDragTime.current || 0);
                                if (!isDragging.current && timeSinceDrag > 200) {
                                    setIsExpanded(true);
                                }
                            }}
                        >
                            <LinearGradient
                                colors={['#8b5cf6', '#7c3aed']}
                                style={styles.bubbleGradient}
                            >
                                <Ionicons name="document-text" size={24} color="#fff" />
                                {contentCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{contentCount}</Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </Pressable>
                    ) : (
                        /* EXPANDED */
                        <View style={styles.expanded}>
                            {/* Header - Draggable zone when expanded */}
                            <Animated.View
                                style={styles.header}
                                {...panResponder.panHandlers}
                            >
                                <View style={styles.dragHandle} />
                                <Text style={styles.headerTitle}>
                                    📋 {activeClient?.name || 'Cliente'}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setIsExpanded(false)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="chevron-down" size={24} color="#94a3b8" />
                                </TouchableOpacity>
                            </Animated.View>

                            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                                {/* Traffic Light */}
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>Estado</Text>
                                    <View style={styles.trafficRow}>
                                        {['green', 'yellow', 'red'].map(color => (
                                            <TouchableOpacity
                                                key={color}
                                                style={[
                                                    styles.trafficBtn,
                                                    { backgroundColor: trafficColors[color] },
                                                    trafficLight === color && styles.trafficBtnActive
                                                ]}
                                                onPress={() => setTrafficLight(color)}
                                            >
                                                {trafficLight === color && (
                                                    <Ionicons name="checkmark" size={16} color="#fff" />
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Logros */}
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>✨ Logros</Text>
                                    {highlights.map(h => (
                                        <View key={h.id} style={styles.chip}>
                                            {h.mediaType === 'photo' && (
                                                <Ionicons name="image" size={14} color="#6366f1" style={{ marginRight: 4 }} />
                                            )}
                                            <Text style={styles.chipText} numberOfLines={2}>{h.text}</Text>
                                            <TouchableOpacity onPress={() => removeHighlight(h.id)}>
                                                <Ionicons name="close-circle" size={18} color="#94a3b8" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    <View style={styles.inputRow}>
                                        <EnhancedTextInput
                                            containerStyle={styles.inputContainer}
                                            style={styles.inputText}
                                            value={newHighlight}
                                            onChangeText={setNewHighlight}
                                            placeholder="Añadir logro..."
                                            placeholderTextColor="#64748b"
                                            onSubmitEditing={addHighlight}
                                        />
                                        <TouchableOpacity style={styles.addBtn} onPress={addHighlight}>
                                            <Ionicons name="add" size={18} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Analysis - Ahora consistente con los demás usando botón + */}
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>🔍 Análisis</Text>
                                    {analysisNotes.map(a => (
                                        <View key={a.id} style={styles.chip}>
                                            <Text style={styles.chipText}>{a.text}</Text>
                                            <TouchableOpacity onPress={() => removeAnalysis(a.id)}>
                                                <Ionicons name="close-circle" size={18} color="#94a3b8" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    <View style={styles.inputRow}>
                                        <EnhancedTextInput
                                            containerStyle={styles.inputContainer}
                                            style={styles.inputText}
                                            value={newAnalysis}
                                            onChangeText={setNewAnalysis}
                                            placeholder="Añadir nota técnica..."
                                            placeholderTextColor="#64748b"
                                            onSubmitEditing={addAnalysis}
                                        />
                                        <TouchableOpacity style={styles.addBtn} onPress={addAnalysis}>
                                            <Ionicons name="add" size={18} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Actions */}
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>🎯 Plan de Acción</Text>
                                    {actionItems.map(a => (
                                        <View key={a.id} style={styles.chip}>
                                            <Text style={styles.chipText}>{a.text}</Text>
                                            <TouchableOpacity onPress={() => removeAction(a.id)}>
                                                <Ionicons name="close-circle" size={18} color="#94a3b8" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    <View style={styles.inputRow}>
                                        <EnhancedTextInput
                                            containerStyle={styles.inputContainer}
                                            style={styles.inputText}
                                            value={newAction}
                                            onChangeText={setNewAction}
                                            placeholder="Añadir acción..."
                                            placeholderTextColor="#64748b"
                                            onSubmitEditing={addAction}
                                        />
                                        <TouchableOpacity style={styles.addBtn} onPress={addAction}>
                                            <Ionicons name="add" size={18} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </ScrollView>

                            {/* Footer */}
                            <View style={styles.footer}>
                                <TouchableOpacity
                                    style={styles.clearBtn}
                                    onPress={() => setShowClearModal(true)}
                                >
                                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.sendBtn} onPress={handleSendFeedback}>
                                    <Text style={styles.sendBtnText}>🚀 GENERAR INFORME</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </Animated.View>
            )}

            {/* Modal de confirmación para limpiar */}
            <ConfirmModal
                visible={showClearModal}
                onClose={() => setShowClearModal(false)}
                onConfirm={clearForm}
                title="¿Limpiar borrador?"
                message="Se eliminarán todos los logros, análisis y acciones."
                confirmText="Limpiar"
                confirmStyle="destructive"
                icon="trash-outline"
            />

            {/* Modal de formulario vacío */}
            <ConfirmModal
                visible={showEmptyModal}
                onClose={() => setShowEmptyModal(false)}
                onConfirm={() => { }}
                title="Formulario vacío"
                message="Añade al menos un logro, análisis o acción antes de generar el informe."
                confirmText="Entendido"
                cancelText=""
                icon="information-circle-outline"
            />
        </FeedbackBubbleContext.Provider>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        zIndex: 9999,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 15
    },
    bubble: {
        flex: 1,
        borderRadius: BUBBLE_SIZE / 2,
        overflow: 'hidden'
    },
    bubbleGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    badge: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700'
    },
    expanded: {
        flex: 1,
        backgroundColor: '#1e293b',
        borderRadius: 20,
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 12,
        backgroundColor: '#0f172a',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        minHeight: 50
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#475569',
        borderRadius: 2,
        position: 'absolute',
        top: 6,
        left: '50%',
        marginLeft: -20
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        flex: 1,
        marginLeft: 8
    },
    scrollContent: {
        flex: 1,
        padding: 12
    },
    section: {
        marginBottom: 16
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94a3b8',
        marginBottom: 8
    },
    trafficRow: {
        flexDirection: 'row',
        gap: 12
    },
    trafficBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.5
    },
    trafficBtnActive: {
        opacity: 1,
        borderWidth: 2,
        borderColor: '#fff'
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: 8,
        marginBottom: 6,
        gap: 8
    },
    chipText: {
        flex: 1,
        color: '#e2e8f0',
        fontSize: 13
    },
    inputRow: {
        flexDirection: 'row',
        gap: 8
    },
    inputContainer: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    inputText: {
        color: '#fff',
        fontSize: 13
    },
    textArea: {
        minHeight: 60,
        textAlignVertical: 'top'
    },
    addBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    footer: {
        flexDirection: 'row',
        padding: 12,
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)'
    },
    clearBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(239,68,68,0.15)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    sendBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#8b5cf6',
        borderRadius: 12,
        paddingVertical: 12
    },
    sendBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    }
});

export default FeedbackBubbleContext;
