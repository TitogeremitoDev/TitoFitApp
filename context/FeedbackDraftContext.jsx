/**
 * FeedbackDraftContext.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * Contexto para acumular borradores de feedback antes de enviar
 * Permite al coach revisar múltiples videos/fotos y consolidar respuestas
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@feedback_drafts';

const FeedbackDraftContext = createContext(null);

export function FeedbackDraftProvider({ children }) {
    const [drafts, setDrafts] = useState({
        technicalNotes: [],
        highlights: [],
        actionPlan: []
    });
    const [loaded, setLoaded] = useState(false);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD FROM STORAGE
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const loadDrafts = async () => {
            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                if (stored) {
                    setDrafts(JSON.parse(stored));
                }
            } catch (error) {
                console.log('[FeedbackDraft] Error loading:', error);
            } finally {
                setLoaded(true);
            }
        };
        loadDrafts();
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // SAVE TO STORAGE
    // ─────────────────────────────────────────────────────────────────────────
    const saveDrafts = useCallback(async (newDrafts) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDrafts));
        } catch (error) {
            console.log('[FeedbackDraft] Error saving:', error);
        }
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // ADD TECHNICAL NOTE (from video/photo feedback)
    // ─────────────────────────────────────────────────────────────────────────
    const addTechnicalNote = useCallback((note) => {
        // Evitar duplicados
        setDrafts(prev => {
            if (prev.technicalNotes.some(n => n.id === note.id)) {
                return prev;
            }

            const newNote = {
                id: note.id || Date.now().toString(),
                text: note.text,
                exerciseName: note.exerciseName || 'Ejercicio',
                thumbnail: note.thumbnail || null,
                videoUrl: note.videoUrl || null,
                sourceMediaUrl: note.sourceMediaUrl || null, // URL del video/foto original del atleta
                sourceMediaKey: note.sourceMediaKey || null, // 🆕 Key de R2 para regenerar URL
                sourceMediaType: note.mediaType || 'video', // 🆕 Tipo de media
                mediaType: note.mediaType || 'video',
                timestamp: new Date().toISOString()
            };

            const updated = {
                ...prev,
                technicalNotes: [...prev.technicalNotes, newNote]
            };

            saveDrafts(updated);
            return updated;
        });
    }, [saveDrafts]);

    // ─────────────────────────────────────────────────────────────────────────
    // ADD HIGHLIGHT (supports media like photos)
    // ─────────────────────────────────────────────────────────────────────────
    const addHighlight = useCallback((highlight) => {
        setDrafts(prev => {
            if (prev.highlights.some(h => h.id === highlight.id)) {
                return prev;
            }

            const newHighlight = {
                id: highlight.id || Date.now().toString(),
                text: highlight.text,
                exerciseName: highlight.exerciseName || null,
                thumbnail: highlight.thumbnail || null,
                sourceMediaUrl: highlight.sourceMediaUrl || null,
                sourceMediaKey: highlight.sourceMediaKey || null,
                mediaType: highlight.mediaType || null,
                timestamp: new Date().toISOString()
            };

            const updated = {
                ...prev,
                highlights: [...prev.highlights, newHighlight]
            };

            saveDrafts(updated);
            return updated;
        });
    }, [saveDrafts]);

    // ─────────────────────────────────────────────────────────────────────────
    // REMOVE ITEM
    // ─────────────────────────────────────────────────────────────────────────
    const removeTechnicalNote = useCallback((id) => {
        setDrafts(prev => {
            const updated = {
                ...prev,
                technicalNotes: prev.technicalNotes.filter(n => n.id !== id)
            };
            saveDrafts(updated);
            return updated;
        });
    }, [saveDrafts]);

    // ─────────────────────────────────────────────────────────────────────────
    // CLEAR ALL DRAFTS
    // ─────────────────────────────────────────────────────────────────────────
    const clearDrafts = useCallback(async () => {
        const empty = { technicalNotes: [], highlights: [], actionPlan: [] };
        setDrafts(empty);
        await AsyncStorage.removeItem(STORAGE_KEY);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // GET TOTAL COUNT (for badge)
    // ─────────────────────────────────────────────────────────────────────────
    const getTotalCount = useCallback(() => {
        return drafts.technicalNotes.length + drafts.highlights.length + drafts.actionPlan.length;
    }, [drafts]);

    return (
        <FeedbackDraftContext.Provider value={{
            drafts,
            loaded,
            addTechnicalNote,
            addHighlight,
            removeTechnicalNote,
            clearDrafts,
            getTotalCount
        }}>
            {children}
        </FeedbackDraftContext.Provider>
    );
}

export function useFeedbackDraft() {
    const context = useContext(FeedbackDraftContext);
    if (!context) {
        throw new Error('useFeedbackDraft must be used within FeedbackDraftProvider');
    }
    return context;
}

export default FeedbackDraftContext;
