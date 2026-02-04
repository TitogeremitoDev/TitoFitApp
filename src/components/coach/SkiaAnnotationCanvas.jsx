// src/components/coach/SkiaAnnotationCanvas.jsx
// ═══════════════════════════════════════════════════════════════════════════
// CANVAS DE ANOTACIONES - Solo HTML Canvas (web-only, funciona sin rebuild)
// Para móvil nativo, se necesita rebuild con SKIA
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Platform,
    Text,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../../../components/ui';

// Colores neón reducidos
const NEON_COLORS = [
    { id: 'cyan', color: '#00FFFF' },
    { id: 'yellow', color: '#FFFF00' },
    { id: 'magenta', color: '#FF00FF' },
    { id: 'green', color: '#00FF00' },
    { id: 'white', color: '#FFFFFF' },
];

const STROKE_WIDTHS = [2, 4, 8];
const MAX_UNDO_LEVELS = 10;

/**
 * SkiaAnnotationCanvas - Canvas para dibujar anotaciones sobre fotos
 * Solo funciona en web (HTML Canvas). En móvil muestra fallback.
 */
const SkiaAnnotationCanvas = React.forwardRef(function SkiaAnnotationCanvas({
    imageUri,
    initialStrokes = [],
    initialNote = '',
    onStrokesChange,
    onNoteChange,
    style,
}, ref) {
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const [strokes, setStrokes] = useState(initialStrokes);
    const [currentStroke, setCurrentStroke] = useState(null);
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [selectedColor, setSelectedColor] = useState(NEON_COLORS[0].color);
    const [strokeWidth, setStrokeWidth] = useState(4);
    const [isDrawing, setIsDrawing] = useState(false);
    const [note, setNote] = useState(initialNote);

    // Expose getAnnotatedImageBlob to parent via ref
    React.useImperativeHandle(ref, () => ({
        getAnnotatedImageBlob: () => {
            return new Promise((resolve, reject) => {
                try {
                    const canvas = canvasRef.current;
                    const img = imgRef.current;
                    if (!canvas || !img) {
                        reject(new Error('Canvas or image not ready'));
                        return;
                    }

                    // Create a new canvas to merge image + annotations
                    const exportCanvas = document.createElement('canvas');
                    const imgWidth = img.naturalWidth || 600;
                    const imgHeight = img.naturalHeight || 500;
                    exportCanvas.width = imgWidth;
                    exportCanvas.height = imgHeight;
                    const ctx = exportCanvas.getContext('2d');

                    // Draw the original image
                    ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

                    // Scale and draw annotations on top
                    const scaleX = imgWidth / canvas.width;
                    const scaleY = imgHeight / canvas.height;

                    strokes.forEach(stroke => {
                        if (stroke.points.length < 2) return;
                        ctx.beginPath();
                        ctx.strokeStyle = stroke.color;
                        ctx.lineWidth = stroke.width * Math.max(scaleX, scaleY);
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';

                        const [firstX, firstY] = stroke.points[0];
                        ctx.moveTo(firstX * scaleX, firstY * scaleY);
                        for (let i = 1; i < stroke.points.length; i++) {
                            const [x, y] = stroke.points[i];
                            ctx.lineTo(x * scaleX, y * scaleY);
                        }
                        ctx.stroke();
                    });

                    // Convert to blob
                    exportCanvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to create blob'));
                        }
                    }, 'image/jpeg', 0.9);
                } catch (err) {
                    reject(err);
                }
            });
        },
        hasStrokes: () => strokes.length > 0
    }));

    // Solo web
    if (Platform.OS !== 'web') {
        return (
            <View style={[styles.container, style]}>
                <View style={styles.fallback}>
                    <Ionicons name="construct-outline" size={48} color="#64748b" />
                    <Text style={styles.fallbackText}>
                        Anotaciones requieren rebuild nativo
                    </Text>
                    <Text style={styles.fallbackSubtext}>
                        Ejecuta: npx expo run:android
                    </Text>
                </View>
            </View>
        );
    }

    // Redraw canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw strokes
        const allStrokes = [...strokes];
        if (currentStroke) allStrokes.push(currentStroke);

        allStrokes.forEach(stroke => {
            if (!stroke.points || stroke.points.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
            }
            ctx.stroke();
        });
    }, [strokes, currentStroke]);

    const getMousePos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
    };

    const handleMouseDown = (e) => {
        setIsDrawing(true);
        const pos = getMousePos(e);
        setCurrentStroke({ color: selectedColor, width: strokeWidth, points: [pos] });
    };

    const handleMouseMove = (e) => {
        if (!isDrawing) return;
        const pos = getMousePos(e);
        setCurrentStroke(prev => ({ ...prev, points: [...prev.points, pos] }));
    };

    const handleMouseUp = () => {
        if (!currentStroke || currentStroke.points.length < 2) {
            setCurrentStroke(null);
            setIsDrawing(false);
            return;
        }
        setUndoStack(prev => [...prev, strokes].slice(-MAX_UNDO_LEVELS));
        setRedoStack([]);
        const newStrokes = [...strokes, currentStroke];
        setStrokes(newStrokes);
        onStrokesChange?.(newStrokes);
        setCurrentStroke(null);
        setIsDrawing(false);
    };

    const handleUndo = () => {
        if (undoStack.length === 0) return;
        const prev = undoStack[undoStack.length - 1];
        setUndoStack(s => s.slice(0, -1));
        setRedoStack(s => [...s, strokes]);
        setStrokes(prev);
        onStrokesChange?.(prev);
    };

    const handleRedo = () => {
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        setRedoStack(s => s.slice(0, -1));
        setUndoStack(s => [...s, strokes].slice(-MAX_UNDO_LEVELS));
        setStrokes(next);
        onStrokesChange?.(next);
    };

    const handleClear = () => {
        if (strokes.length === 0) return;
        setUndoStack(prev => [...prev, strokes].slice(-MAX_UNDO_LEVELS));
        setRedoStack([]);
        setStrokes([]);
        onStrokesChange?.([]);
    };

    const handleNoteChange = (text) => {
        setNote(text);
        onNoteChange?.(text);
    };

    return (
        <View style={[styles.container, style]}>
            {/* Image + Canvas */}
            <View style={styles.canvasArea}>
                <img
                    ref={imgRef}
                    src={imageUri}
                    alt=""
                    crossOrigin="anonymous"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                    }}
                />
                <canvas
                    ref={canvasRef}
                    width={500}
                    height={400}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        cursor: 'crosshair',
                        backgroundColor: 'transparent',
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                />
            </View>

            {/* Compact Toolbar */}
            <View style={styles.toolbar}>
                <View style={styles.toolRow}>
                    {NEON_COLORS.map(c => (
                        <TouchableOpacity
                            key={c.id}
                            style={[
                                styles.colorBtn,
                                { backgroundColor: c.color },
                                selectedColor === c.color && styles.colorBtnActive
                            ]}
                            onPress={() => setSelectedColor(c.color)}
                        />
                    ))}
                    <View style={styles.divider} />
                    {STROKE_WIDTHS.map(w => (
                        <TouchableOpacity
                            key={w}
                            style={[styles.widthBtn, strokeWidth === w && styles.widthBtnActive]}
                            onPress={() => setStrokeWidth(w)}
                        >
                            <View style={[styles.widthDot, { width: w * 2, height: w * 2 }]} />
                        </TouchableOpacity>
                    ))}
                    <View style={styles.divider} />
                    <TouchableOpacity
                        style={[styles.actionBtn, !undoStack.length && styles.disabled]}
                        onPress={handleUndo}
                    >
                        <Ionicons name="arrow-undo" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, !redoStack.length && styles.disabled]}
                        onPress={handleRedo}
                    >
                        <Ionicons name="arrow-redo" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.clearBtn, !strokes.length && styles.disabled]}
                        onPress={handleClear}
                    >
                        <Ionicons name="trash-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Note Input - Estilo similar a referencia */}
            <View style={styles.noteSection}>
                <Text style={styles.noteLabel}>📝 Tu Feedback</Text>
                <EnhancedTextInput
                    containerStyle={styles.noteInputContainer}
                    style={styles.noteInputText}
                    placeholder="Escribe tu feedback aquí..."
                    placeholderTextColor="#6b7280"
                    value={note}
                    onChangeText={handleNoteChange}
                    multiline
                    numberOfLines={3}
                />
            </View>
        </View>
    );
});

export default SkiaAnnotationCanvas;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f14',
    },
    canvasArea: {
        flex: 1,
        position: 'relative',
        minHeight: 300,
    },
    toolbar: {
        backgroundColor: '#1a1a20',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderTopWidth: 1,
        borderTopColor: '#2a2a35',
    },
    toolRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    colorBtn: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorBtnActive: {
        borderColor: '#fff',
        transform: [{ scale: 1.15 }],
    },
    divider: {
        width: 1,
        height: 18,
        backgroundColor: '#3a3a45',
        marginHorizontal: 6,
    },
    widthBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#2a2a35',
        alignItems: 'center',
        justifyContent: 'center',
    },
    widthBtnActive: {
        backgroundColor: '#6366f1',
    },
    widthDot: {
        borderRadius: 10,
        backgroundColor: '#fff',
    },
    actionBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#3a3a45',
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearBtn: {
        backgroundColor: '#dc2626',
    },
    disabled: {
        opacity: 0.3,
    },
    noteSection: {
        backgroundColor: '#1a1a20',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#2a2a35',
    },
    noteLabel: {
        color: '#9ca3af',
        fontSize: 13,
        marginBottom: 8,
    },
    noteInputContainer: {
        backgroundColor: '#252530',
        borderRadius: 8,
        padding: 12,
        minHeight: 60,
    },
    noteInputText: {
        color: '#fff',
        fontSize: 14,
        textAlignVertical: 'top',
    },
    fallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 12,
    },
    fallbackText: {
        color: '#9ca3af',
        fontSize: 16,
        textAlign: 'center',
    },
    fallbackSubtext: {
        color: '#6b7280',
        fontSize: 12,
        fontFamily: 'monospace',
    },
});
