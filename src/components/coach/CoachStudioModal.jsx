// src/components/coach/CoachStudioModal.jsx
// ═══════════════════════════════════════════════════════════════════════════
// COACH STUDIO - Full-screen photo review with annotation tools
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Image,
    Pressable,
    Animated,
    Easing,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
} from 'react-native';
import { useStableWindowDimensions } from '../../hooks/useStableBreakpoint';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../../../components/ui';
import { StatusBar } from 'expo-status-bar';
import SkiaAnnotationCanvas from './SkiaAnnotationCanvas';
import { useFeedbackDraft } from '../../../context/FeedbackDraftContext';
import MarketingCanvas from './marketing/MarketingCanvas';
import MarketingControls from './marketing/MarketingControls';
import DraggableSticker from './marketing/DraggableSticker';
import * as Sharing from 'expo-sharing';


// ═══════════════════════════════════════════════════════════════════════════
// TOOLBAR BUTTONS
// ═══════════════════════════════════════════════════════════════════════════

const TOOLS = [
    { id: 'annotate', icon: 'pencil', label: 'Anotar', color: '#f59e0b', hidden: true }, // HIDDEN: Feature not ready
    { id: 'voice', icon: 'mic', label: 'Voz', color: '#8b5cf6', hidden: true }, // HIDDEN: Removed per user request
    { id: 'compare', icon: 'git-compare', label: 'Comparar', color: '#06b6d4' },
    { id: 'marketing', icon: 'share-social', label: 'Marketing', color: '#10b981' },
];

// ═══════════════════════════════════════════════════════════════════════════
// NEON COLORS FOR ANNOTATIONS
// ═══════════════════════════════════════════════════════════════════════════

const NEON_COLORS = [
    { name: 'Cyan', hex: '#00FFFF' },
    { name: 'Yellow', hex: '#FFFF00' },
    { name: 'Magenta', hex: '#FF00FF' },
    { name: 'Green', hex: '#00FF00' },
    { name: 'Red', hex: '#FF4444' },
];

/**
 * CoachStudioModal - Smart Drawer side panel with dark theme (Modified)
 * Slides in from right, variable width based on context.
 */
export default function CoachStudioModal({
    visible,
    onClose,
    photo,
    photos = [],           // Photo group for carousel
    initialIndex = 0,      // Starting index
    onIndexChange,         // Callback for parent sync
    token,
    clientId,
}) {
    const [activeTool, setActiveTool] = useState(null);
    const [selectedColor, setSelectedColor] = useState(NEON_COLORS[0].hex);
    const [isLoading, setIsLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Carousel state
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const photoList = photos.length > 0 ? photos : (photo ? [photo] : []);
    const currentPhoto = photoList[currentIndex] || photo;
    const totalPhotos = photoList.length;
    const hasMultiplePhotos = totalPhotos > 1;

    // Responsive
    const { width: windowWidth, height: windowHeight } = useStableWindowDimensions();
    const isLargeScreen = windowWidth >= 768; // Only use Smart Drawer on Tablets+
    const isMobile = !isLargeScreen;

    // Animation & Drawer State
    const slideAnim = useRef(new Animated.Value(windowWidth)).current; // Start off-screen right
    const widthAnim = useRef(new Animated.Value(isMobile ? windowWidth : 650)).current; // Base width

    useEffect(() => {
        if (visible) {
            // Slide In
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: false, // width change requires false
                easing: Easing.out(Easing.poly(4)),
            }).start();
        } else {
            // Slide Out (handled by onClose wrapper usually, but init state needs reset)
            slideAnim.setValue(windowWidth);
        }
    }, [visible, slideAnim, windowWidth]);

    // Dynamic Width based on Active Tool
    useEffect(() => {
        let targetWidth = isMobile ? windowWidth : 650; // Base width (Standard Mode)

        if (!isMobile && (activeTool === 'marketing' || activeTool === 'compare')) {
            targetWidth = Math.min(windowWidth * 0.95, 1600); // Expanded Mode (95% width or max 1600px)
        }

        Animated.timing(widthAnim, {
            toValue: targetWidth,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.inOut(Easing.ease),
        }).start();

    }, [activeTool, isMobile, widthAnim, windowWidth]);

    const closeDrawer = () => {
        if (isLargeScreen) {
            // Desktop: Slide out animation manually
            Animated.timing(slideAnim, {
                toValue: windowWidth,
                duration: 250,
                useNativeDriver: false,
                easing: Easing.in(Easing.poly(4)),
            }).start(() => {
                onClose();
            });
        } else {
            // Mobile: Standard Close (Modal handles animation)
            onClose();
        }
    };


    // Canvas ref for export
    const canvasRef = useRef(null);

    // Annotation state
    const [strokes, setStrokes] = useState(currentPhoto?.annotationVersions?.[0]?.strokes || []);
    const [annotationNote, setAnnotationNote] = useState(currentPhoto?.annotationVersions?.[0]?.note || '');

    // Compare state
    const [comparePhoto, setComparePhoto] = useState(null);
    const [clientPhotos, setClientPhotos] = useState([]); // Raw fetched photos
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [isSwapped, setIsSwapped] = useState(false);
    const [compareTagFilter, setCompareTagFilter] = useState(null); // 'front'|'side'|'back'|null
    const compareNoteRef = useRef(''); // Coach comment on comparison (ref to avoid re-renders)
    const allClientPhotosRef = useRef([]); // Store unfiltered list

    // Auto-set tag filter when entering compare mode based on current photo's tag
    useEffect(() => {
        if (activeTool === 'compare' && currentPhoto?.tags?.length > 0) {
            const primaryTag = currentPhoto.tags.find(t => ['front', 'side', 'back'].includes(t));
            if (primaryTag) setCompareTagFilter(primaryTag);
        }
    }, [activeTool, currentPhoto?._id]);

    // Tag labels for display
    const TAG_DISPLAY = { front: 'Frontal', side: 'Lateral', back: 'Espalda' };

    // Filtered compare photos: exclude current, apply tag filter, sort by date desc
    const filteredComparePhotos = useMemo(() => {
        let photos = allClientPhotosRef.current.filter(p => p._id !== currentPhoto?._id);
        if (compareTagFilter) {
            photos = photos.filter(p => p.tags?.includes(compareTagFilter));
        }
        // Sort descending (most recent first)
        photos.sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt));
        return photos;
    }, [currentPhoto?._id, clientPhotos, compareTagFilter]);

    // Group filtered photos by month for the picker
    const groupedComparePhotos = useMemo(() => {
        const groups = [];
        let currentGroup = null;
        filteredComparePhotos.forEach(p => {
            const date = new Date(p.takenAt);
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            const label = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
            if (!currentGroup || currentGroup.key !== key) {
                currentGroup = { key, label, photos: [] };
                groups.push(currentGroup);
            }
            currentGroup.photos.push(p);
        });
        return groups;
    }, [filteredComparePhotos]);

    // Available tags across all client photos (for filter chips)
    const availableCompareTags = useMemo(() => {
        const tags = new Set();
        allClientPhotosRef.current.forEach(p => {
            p.tags?.forEach(t => {
                if (['front', 'side', 'back'].includes(t)) tags.add(t);
            });
        });
        return Array.from(tags);
    }, [clientPhotos]);

    // Relative date helper for picker items
    const getRelativeDate = useCallback((dateStr) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Hoy';
        if (diffDays === 1) return 'Ayer';
        if (diffDays < 7) return `${diffDays}d`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}m`;
        return `${Math.floor(diffDays / 365)}a`;
    }, []);

    // Time delta between compared photos
    const compareDelta = useMemo(() => {
        if (!comparePhoto || !currentPhoto) return null;
        const dateA = new Date(isSwapped ? currentPhoto.takenAt : comparePhoto.takenAt);
        const dateB = new Date(isSwapped ? comparePhoto.takenAt : currentPhoto.takenAt);
        const diffMs = Math.abs(dateB - dateA);
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Mismo día';
        if (diffDays < 7) return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
        const diffWeeks = Math.floor(diffDays / 7);
        if (diffWeeks < 5) return `${diffWeeks} semana${diffWeeks > 1 ? 's' : ''}`;
        const diffMonths = Math.floor(diffDays / 30);
        return `${diffMonths} mes${diffMonths > 1 ? 'es' : ''}`;
    }, [comparePhoto, currentPhoto, isSwapped]);

    // Determine which photo is left/right based on swap
    const leftPhoto = isSwapped ? currentPhoto : comparePhoto;
    const rightPhoto = isSwapped ? comparePhoto : currentPhoto;

    // Marketing State
    const marketingRef = useRef(null);
    const [isExporting, setIsExporting] = useState(false);
    const [marketingConfig, setMarketingConfig] = useState({
        templateId: 'transformation', // 'transformation', 'showcase'
        privacy: false,
        stats: true,
        goal: 'loss', // 'loss' | 'gain'
        branding: true,
        delta: '- 2.5 kg' // Calculated later
    });

    const handleMarketingExport = async () => {
        if (!marketingRef.current) return;
        setIsExporting(true);
        try {
            if (Platform.OS === 'web') {
                // Web: show instructions for manual screenshot
                // html2canvas can't capture external images due to CORS
                Alert.alert(
                    'Compartir en Web',
                    'Para compartir desde el navegador:\n\n1. Haz screenshot del canvas (Cmd+Shift+4 en Mac o Win+Shift+S en Windows)\n\n2. Comparte la imagen guardada\n\nEn la app móvil el botón funciona automáticamente.',
                    [{ text: 'Entendido', style: 'default' }]
                );
            } else {
                // Native: capture and share
                const uri = await marketingRef.current.capture();
                if (uri) {
                    const isAvailable = await Sharing.isAvailableAsync();
                    if (isAvailable) {
                        await Sharing.shareAsync(uri, {
                            mimeType: 'image/jpeg',
                            dialogTitle: 'Compartir Progreso'
                        });
                    } else {
                        Alert.alert('Error', 'Compartir no disponible en este dispositivo');
                    }
                }
            }
        } catch (error) {
            console.log('Export error:', error);
        } finally {
            setIsExporting(false);
        }
    };


    // Feedback draft context - para guardar borradores en Logros
    const { addHighlight } = useFeedbackDraft();

    // Filter tools for web (hide voice) and hidden tools
    const visibleTools = useMemo(() => {
        return TOOLS.filter(tool => !tool.hidden && (!tool.mobileOnly || Platform.OS !== 'web'));
    }, []);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    // ─────────────────────────────────────────────────────────────────────────
    // CAROUSEL NAVIGATION
    // ─────────────────────────────────────────────────────────────────────────
    const goNext = useCallback(() => {
        if (currentIndex < totalPhotos - 1) {
            const newIndex = currentIndex + 1;
            setCurrentIndex(newIndex);
            onIndexChange?.(newIndex);
            // Reset annotation state for new photo
            const newPhoto = photoList[newIndex];
            setStrokes(newPhoto?.annotationVersions?.[0]?.strokes || []);
            setAnnotationNote(newPhoto?.annotationVersions?.[0]?.note || '');
            setHasChanges(false);
        }
    }, [currentIndex, totalPhotos, photoList, onIndexChange]);

    const goPrev = useCallback(() => {
        if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            setCurrentIndex(newIndex);
            onIndexChange?.(newIndex);
            // Reset annotation state for new photo
            const newPhoto = photoList[newIndex];
            setStrokes(newPhoto?.annotationVersions?.[0]?.strokes || []);
            setAnnotationNote(newPhoto?.annotationVersions?.[0]?.note || '');
            setHasChanges(false);
        }
    }, [currentIndex, photoList, onIndexChange]);

    // Wrapper for toolbar navigation
    const navigatePhoto = useCallback((direction) => {
        if (direction > 0) {
            goNext();
        } else {
            goPrev();
        }
    }, [goNext, goPrev]);

    // Keyboard navigation (web)
    useEffect(() => {
        if (Platform.OS !== 'web' || !visible || !hasMultiplePhotos) return;

        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') {
                goNext();
            } else if (e.key === 'ArrowLeft') {
                goPrev();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, hasMultiplePhotos, goNext, goPrev]);

    // Reset index when photos change
    useEffect(() => {
        setCurrentIndex(initialIndex);
    }, [initialIndex, photos]);

    // ─────────────────────────────────────────────────────────────────────────
    // UPLOAD ANNOTATED IMAGE
    // ─────────────────────────────────────────────────────────────────────────
    const uploadAnnotatedImage = async () => {
        try {
            // Check if canvas has strokes
            if (!canvasRef.current?.hasStrokes()) {
                // No annotations, return original URL
                return currentPhoto.fullUrl;
            }

            // Get annotated image blob
            const blob = await canvasRef.current.getAnnotatedImageBlob();

            // Create FormData
            const formData = new FormData();
            formData.append('file', blob, `annotated_${currentPhoto._id}_${Date.now()}.jpg`);
            formData.append('clientId', clientId);
            formData.append('type', 'annotated-photo');

            // Upload to R2
            const response = await fetch(`${API_URL}/api/trainers/upload-annotated`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            const data = await response.json();
            if (data.success && data.url) {
                return data.url;
            } else {
                console.error('[CoachStudio] Upload failed:', data.message);
                return currentPhoto.fullUrl; // Fallback to original
            }
        } catch (error) {
            console.error('[CoachStudio] Upload error:', error);
            return currentPhoto.fullUrl; // Fallback to original
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS
    // ─────────────────────────────────────────────────────────────────────────

    const handleToolPress = async (toolId) => {
        if (activeTool === toolId) {
            setActiveTool(null);
        } else {
            setActiveTool(toolId);

            // Handle tool-specific actions
            switch (toolId) {
                case 'voice':
                    // TODO: Open voice recording (Phase 4)
                    Alert.alert('🎤 Próximamente', 'Notas de voz en desarrollo');
                    break;
                case 'compare':
                    // Load client photos if not already loaded
                    if (allClientPhotosRef.current.length === 0) {
                        setLoadingPhotos(true);
                        try {
                            const res = await fetch(`${API_URL}/api/progress-photos/client/${clientId}?limit=50`, {
                                headers: { Authorization: `Bearer ${token}` },
                            });
                            const data = await res.json();
                            if (data.success && data.photos) {
                                allClientPhotosRef.current = data.photos;
                                setClientPhotos(data.photos); // Trigger filteredComparePhotos recalc
                            }
                        } catch (error) {
                            console.error('[Compare] Error loading photos:', error);
                            Alert.alert('Error', 'No se pudieron cargar las fotos anteriores');
                        } finally {
                            setLoadingPhotos(false);
                        }
                    }
                    break;
                case 'marketing':
                    // TODO: Open marketing pipeline (Phase 6)
                    if (photo?.visibility !== 'shareable') {
                        Alert.alert(
                            '⚠️ Consentimiento requerido',
                            'Esta foto no tiene permiso para compartir. Cambia la visibilidad a "Compartible" primero.',
                            [{ text: 'Entendido' }]
                        );
                    } else {
                        Alert.alert('📸 Próximamente', 'Generador de marketing en desarrollo');
                    }
                    break;
            }
        }
    };

    const handleSave = async () => {
        if (!hasChanges || (strokes.length === 0 && !annotationNote)) {
            onClose();
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(
                `${API_URL}/api/progress-photos/${photo._id}/annotation`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ strokes, note: annotationNote }),
                }
            );

            const data = await response.json();
            if (data.success) {
                Alert.alert('✅ Guardado', 'Anotaciones guardadas correctamente');
                onClose();
            } else {
                Alert.alert('Error', data.message || 'No se pudieron guardar las anotaciones');
            }
        } catch (error) {
            console.error('[CoachStudio] Save error:', error);
            Alert.alert('Error', 'Error al guardar anotaciones');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (hasChanges) {
            // Alert.alert no funciona en web, usar confirm
            if (Platform.OS === 'web') {
                if (window.confirm('¿Salir sin guardar? Tienes anotaciones sin guardar.')) {
                    closeDrawer();
                }
            } else {
                Alert.alert(
                    '¿Salir sin guardar?',
                    'Tienes anotaciones sin guardar.',
                    [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Descartar', style: 'destructive', onPress: closeDrawer },
                        { text: 'Guardar', onPress: handleSave },
                    ]
                );
            }
        } else {
            closeDrawer();
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    if (!photo && photoList.length === 0) return null;

    // Helper to wrap content conditionally (Drawer vs Full Screen)
    const ContentWrapper = ({ children }) => {
        if (isLargeScreen) {
            return (
                <Animated.View
                    style={[
                        styles.drawerContainer,
                        {
                            width: widthAnim,
                            transform: [{ translateX: slideAnim }]
                        }
                    ]}
                >
                    {children}
                </Animated.View>
            );
        }
        return children;
    };

    return (
        <Modal
            visible={visible}
            transparent={isLargeScreen}
            animationType={isLargeScreen ? "none" : "slide"}
            presentationStyle={isLargeScreen ? "overFullScreen" : "fullScreen"}
            onRequestClose={handleClose}
        >
            <StatusBar style="light" />

            {/* DESKTOP: Backdrop */}
            {isLargeScreen && (
                <Animated.View
                    style={[
                        styles.backdrop,
                        {
                            opacity: slideAnim.interpolate({
                                inputRange: [0, windowWidth],
                                outputRange: [1, 0],
                            })
                        }
                    ]}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
                </Animated.View>
            )}

            {/* CONTENT */}
            <ContentWrapper>
                <SafeAreaView style={styles.container}>
                    {/* Header */}
                    <View style={[
                        styles.header,
                        isMobile && styles.headerMobile
                    ]}>
                        <TouchableOpacity
                            style={styles.headerBtn}
                            onPress={handleClose}
                            disabled={isLoading}
                        >
                            <Ionicons name="close" size={28} color="#fff" />
                        </TouchableOpacity>

                        <View style={styles.headerCenter}>
                            <Text style={styles.dateText}>{formatDate(photo.takenAt)}</Text>
                            {photo.tags?.length > 0 && (
                                <View style={styles.tagsRow}>
                                    {photo.tags.map(tag => (
                                        <Text key={tag} style={styles.tagChip}>
                                            {tag}
                                        </Text>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Compare Mode - Responsive (Side by side on desktop, stacked on mobile) */}
                    {activeTool === 'compare' && (
                        <View style={styles.compareContainer}>
                            {/* Top bar: close + swap + delta badge */}
                            <View style={styles.compareTopBar}>
                                <TouchableOpacity
                                    style={styles.closeCompareBtn}
                                    onPress={() => {
                                        setComparePhoto(null);
                                        setIsSwapped(false);
                                        compareNoteRef.current = '';
                                        setActiveTool(null);
                                    }}
                                >
                                    <Ionicons name="close" size={22} color="#fff" />
                                </TouchableOpacity>

                                {/* Time delta badge */}
                                {compareDelta && (
                                    <View style={styles.compareDeltaBadge}>
                                        <Ionicons name="time-outline" size={14} color="#0ea5e9" />
                                        <Text style={styles.compareDeltaText}>{compareDelta}</Text>
                                        {leftPhoto && rightPhoto && (
                                            <Text style={styles.compareDeltaSubtext}>
                                                {new Date(Math.min(new Date(leftPhoto.takenAt), new Date(rightPhoto.takenAt)))
                                                    .toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                                {' \u2192 '}
                                                {new Date(Math.max(new Date(leftPhoto.takenAt), new Date(rightPhoto.takenAt)))
                                                    .toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {/* Swap button */}
                                {comparePhoto && (
                                    <TouchableOpacity
                                        style={styles.compareSwapBtn}
                                        onPress={() => setIsSwapped(prev => !prev)}
                                    >
                                        <Ionicons name="swap-horizontal" size={20} color="#fff" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Layout Container */}
                            <View style={{ flex: 1, flexDirection: 'column' }}>

                                {/* Photos Area */}
                                <View style={[
                                    styles.comparePhotosRow,
                                    !isLargeScreen && styles.comparePhotosColumn,
                                    { flex: 1, marginBottom: 8 }
                                ]}>
                                    {/* LEFT photo */}
                                    <View style={[
                                        styles.comparePhotoWrapper,
                                        !isLargeScreen && styles.comparePhotoWrapperMobile
                                    ]}>
                                        <Text style={styles.compareLabel}>
                                            {leftPhoto ? (new Date(leftPhoto.takenAt) <= new Date(rightPhoto?.takenAt || currentPhoto.takenAt) ? 'Anterior' : 'Actual') : 'Anterior'}
                                            {compareTagFilter ? ` (${TAG_DISPLAY[compareTagFilter]})` : ''}
                                        </Text>
                                        {leftPhoto ? (
                                            <>
                                                <Image
                                                    source={{ uri: leftPhoto.fullUrl }}
                                                    style={[
                                                        styles.comparePhoto,
                                                        !isLargeScreen && [styles.comparePhotoMobile, { maxHeight: windowHeight < 700 ? 150 : 220 }]
                                                    ]}
                                                    resizeMode="contain"
                                                />
                                                <View style={styles.compareDateRow}>
                                                    <Ionicons name="calendar-outline" size={12} color="#94a3b8" />
                                                    <Text style={styles.compareDateLabel}>
                                                        {new Date(leftPhoto.takenAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </Text>
                                                    <Text style={styles.compareDateRelative}>
                                                        ({getRelativeDate(leftPhoto.takenAt)})
                                                    </Text>
                                                </View>
                                            </>
                                        ) : (
                                            <View style={[
                                                styles.comparePlaceholder,
                                                !isLargeScreen && [styles.comparePhotoMobile, { maxHeight: windowHeight < 700 ? 150 : 220 }]
                                            ]}>
                                                <Ionicons name="images-outline" size={32} color="#64748b" />
                                                <Text style={styles.comparePlaceholderText}>Seleccionar del historial</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Divider */}
                                    <View style={[
                                        styles.compareDivider,
                                        !isLargeScreen && { transform: [{ rotate: '90deg' }], marginVertical: 4 }
                                    ]} />

                                    {/* RIGHT photo */}
                                    <View style={[
                                        styles.comparePhotoWrapper,
                                        !isLargeScreen && styles.comparePhotoWrapperMobile
                                    ]}>
                                        <Text style={styles.compareLabel}>
                                            {rightPhoto ? (new Date(rightPhoto.takenAt) >= new Date(leftPhoto?.takenAt || currentPhoto.takenAt) ? 'Actual' : 'Anterior') : 'Actual'}
                                            {compareTagFilter ? ` (${TAG_DISPLAY[compareTagFilter]})` : ''}
                                        </Text>
                                        <Image
                                            source={{ uri: (rightPhoto || currentPhoto).fullUrl }}
                                            style={[
                                                styles.comparePhoto,
                                                !isLargeScreen && [styles.comparePhotoMobile, { maxHeight: windowHeight < 700 ? 150 : 220 }]
                                            ]}
                                            resizeMode="contain"
                                        />
                                        <View style={styles.compareDateRow}>
                                            <Ionicons name="calendar-outline" size={12} color="#94a3b8" />
                                            <Text style={styles.compareDateLabel}>
                                                {new Date((rightPhoto || currentPhoto).takenAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </Text>
                                            <Text style={styles.compareDateRelative}>
                                                ({getRelativeDate((rightPhoto || currentPhoto).takenAt)})
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Compare note input */}
                                {comparePhoto && (
                                    <View style={styles.compareNoteContainer}>
                                        <EnhancedTextInput
                                            defaultValue=""
                                            onChangeText={(text) => { compareNoteRef.current = text; }}
                                            placeholder="Añadir comentario a la comparativa..."
                                            placeholderTextColor="#64748b"
                                            style={styles.compareNoteInput}
                                            containerStyle={styles.compareNoteInputContainer}
                                            multiline
                                            numberOfLines={2}
                                        />
                                    </View>
                                )}

                                {/* Save comparison to feedback button */}
                                {comparePhoto && (
                                    <TouchableOpacity
                                        style={styles.compareAddFeedbackBtn}
                                        onPress={() => {
                                            const older = new Date(leftPhoto.takenAt) <= new Date(rightPhoto.takenAt) ? leftPhoto : rightPhoto;
                                            const newer = older === leftPhoto ? rightPhoto : leftPhoto;
                                            addHighlight({
                                                id: `compare_${older._id}_${newer._id}_${Date.now()}`,
                                                text: compareNoteRef.current || `Comparativa: ${compareDelta || 'progreso'}`,
                                                exerciseName: 'Comparativa de progreso',
                                                thumbnail: newer.thumbnailUrl || newer.fullUrl,
                                                sourceMediaUrl: newer.fullUrl,
                                                mediaType: 'photo',
                                                compareData: {
                                                    olderPhotoUrl: older.fullUrl,
                                                    olderPhotoKey: older.r2Key,
                                                    olderDate: older.takenAt,
                                                    newerPhotoUrl: newer.fullUrl,
                                                    newerPhotoKey: newer.r2Key,
                                                    newerDate: newer.takenAt,
                                                    delta: compareDelta,
                                                    note: compareNoteRef.current,
                                                },
                                            });
                                            if (Platform.OS === 'web') {
                                                alert('Comparativa añadida al feedback');
                                            } else {
                                                Alert.alert('Borrador', 'Comparativa guardada en el feedback');
                                            }
                                        }}
                                    >
                                        <Ionicons name="git-compare" size={16} color="#fff" />
                                        <Text style={styles.compareAddFeedbackText}>Añadir comparativa al feedback</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Photo picker strip */}
                                <View style={[
                                    styles.comparePickerContainer,
                                    !isLargeScreen && { maxHeight: windowHeight < 700 ? 150 : 170, padding: 8, marginTop: 0 },
                                    { flexShrink: 0 }
                                ]}>
                                    {/* Header: title + tag filter chips */}
                                    <View style={styles.comparePickerHeader}>
                                        <Text style={styles.comparePickerTitle}>
                                            Historial ({filteredComparePhotos.length})
                                        </Text>
                                        <View style={styles.compareTagFilters}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.compareTagChip,
                                                    !compareTagFilter && styles.compareTagChipActive
                                                ]}
                                                onPress={() => setCompareTagFilter(null)}
                                            >
                                                <Text style={[
                                                    styles.compareTagChipText,
                                                    !compareTagFilter && styles.compareTagChipTextActive
                                                ]}>Todas</Text>
                                            </TouchableOpacity>
                                            {availableCompareTags.map(tag => (
                                                <TouchableOpacity
                                                    key={tag}
                                                    style={[
                                                        styles.compareTagChip,
                                                        compareTagFilter === tag && styles.compareTagChipActive
                                                    ]}
                                                    onPress={() => setCompareTagFilter(
                                                        compareTagFilter === tag ? null : tag
                                                    )}
                                                >
                                                    <Text style={[
                                                        styles.compareTagChipText,
                                                        compareTagFilter === tag && styles.compareTagChipTextActive
                                                    ]}>{TAG_DISPLAY[tag] || tag}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                    {loadingPhotos ? (
                                        <ActivityIndicator color="#0ea5e9" />
                                    ) : (
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            contentContainerStyle={styles.comparePickerScroll}
                                        >
                                            {groupedComparePhotos.map((group) => (
                                                <View key={group.key} style={styles.comparePickerGroup}>
                                                    <Text style={styles.comparePickerMonthLabel}>
                                                        {group.label}
                                                    </Text>
                                                    <View style={styles.comparePickerGroupPhotos}>
                                                        {group.photos.map((p) => (
                                                            <TouchableOpacity
                                                                key={p._id}
                                                                style={[
                                                                    styles.comparePickerItem,
                                                                    comparePhoto?._id === p._id && styles.comparePickerItemActive
                                                                ]}
                                                                onPress={() => setComparePhoto(p)}
                                                            >
                                                                <Image
                                                                    source={{ uri: p.thumbnailUrl || p.fullUrl }}
                                                                    style={[
                                                                        styles.comparePickerImage,
                                                                        comparePhoto?._id === p._id && styles.comparePickerImageActive
                                                                    ]}
                                                                    resizeMode="cover"
                                                                />
                                                                <Text style={[
                                                                    styles.comparePickerDate,
                                                                    comparePhoto?._id === p._id && { color: '#0ea5e9' }
                                                                ]}>
                                                                    {new Date(p.takenAt).toLocaleDateString('es-ES', {
                                                                        day: '2-digit',
                                                                        month: 'short',
                                                                        ...(new Date(p.takenAt).getFullYear() !== new Date().getFullYear()
                                                                            ? { year: '2-digit' } : {})
                                                                    })}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>
                                            ))}
                                        </ScrollView>
                                    )}
                                </View>

                            </View>
                        </View>
                    )
                    }

                    {/* Marketing Mode */}
                    {
                        activeTool === 'marketing' && (
                            <View style={styles.marketingMainContainer}>

                                {/* Zoom Toolbar - Above Preview */}
                                <View style={styles.zoomToolbarContainer}>
                                    {marketingConfig.templateId === 'transformation' ? (
                                        <View style={styles.zoomToolbarRow}>
                                            {/* INICIO */}
                                            <View style={styles.zoomControlGroup}>
                                                <Text style={styles.zoomLabel}>INICIO</Text>
                                                <View style={styles.zoomButtonsRow}>
                                                    <TouchableOpacity
                                                        style={styles.zoomBtnSmall}
                                                        onPress={() => setMarketingConfig(prev => ({ ...prev, zoomLeft: Math.max((prev.zoomLeft || 1) - 0.1, 0.5) }))}
                                                    >
                                                        <Ionicons name="remove" size={16} color="#fff" />
                                                    </TouchableOpacity>
                                                    <Text style={styles.zoomValueText}>
                                                        {Math.round((marketingConfig.zoomLeft || 1) * 100)}%
                                                    </Text>
                                                    <TouchableOpacity
                                                        style={styles.zoomBtnSmall}
                                                        onPress={() => setMarketingConfig(prev => ({ ...prev, zoomLeft: Math.min((prev.zoomLeft || 1) + 0.1, 2) }))}
                                                    >
                                                        <Ionicons name="add" size={16} color="#fff" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* ACTUAL */}
                                            <View style={styles.zoomControlGroup}>
                                                <Text style={styles.zoomLabel}>ACTUAL</Text>
                                                <View style={styles.zoomButtonsRow}>
                                                    <TouchableOpacity
                                                        style={styles.zoomBtnSmall}
                                                        onPress={() => setMarketingConfig(prev => ({ ...prev, zoomRight: Math.max((prev.zoomRight || 1) - 0.1, 0.5) }))}
                                                    >
                                                        <Ionicons name="remove" size={16} color="#fff" />
                                                    </TouchableOpacity>
                                                    <Text style={styles.zoomValueText}>
                                                        {Math.round((marketingConfig.zoomRight || 1) * 100)}%
                                                    </Text>
                                                    <TouchableOpacity
                                                        style={styles.zoomBtnSmall}
                                                        onPress={() => setMarketingConfig(prev => ({ ...prev, zoomRight: Math.min((prev.zoomRight || 1) + 0.1, 2) }))}
                                                    >
                                                        <Ionicons name="add" size={16} color="#fff" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    ) : (
                                        /* Single Photo Zoom */
                                        <View style={styles.zoomControlGroup}>
                                            <Text style={styles.zoomLabel}>ZOOM</Text>
                                            <View style={styles.zoomButtonsRow}>
                                                <TouchableOpacity
                                                    style={styles.zoomBtnSmall}
                                                    onPress={() => setMarketingConfig(prev => ({ ...prev, zoomRight: Math.max((prev.zoomRight || 1) - 0.1, 0.5) }))}
                                                >
                                                    <Ionicons name="remove" size={16} color="#fff" />
                                                </TouchableOpacity>
                                                <Text style={styles.zoomValueText}>
                                                    {Math.round((marketingConfig.zoomRight || 1) * 100)}%
                                                </Text>
                                                <TouchableOpacity
                                                    style={styles.zoomBtnSmall}
                                                    onPress={() => setMarketingConfig(prev => ({ ...prev, zoomRight: Math.min((prev.zoomRight || 1) + 0.1, 2) }))}
                                                >
                                                    <Ionicons name="add" size={16} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </View>

                                {/* Preview Area - Centered */}
                                <View style={styles.marketingPreviewContainer}>
                                    <View
                                        style={{
                                            width: 1080,
                                            height: 1920,
                                            transform: [{ scale: Math.min((windowWidth - 20) / 1080, (windowHeight - 280) / 1920) }],
                                        }}
                                    >
                                        <MarketingCanvas
                                            ref={marketingRef}
                                            photos={
                                                marketingConfig.templateId === 'showcase'
                                                    ? [currentPhoto]
                                                    : [
                                                        comparePhoto || currentPhoto,
                                                        currentPhoto
                                                    ]
                                            }
                                            templateId={marketingConfig.templateId}
                                            config={marketingConfig}
                                            goal={marketingConfig.goal}
                                        />
                                    </View>
                                </View>

                                {/* Controls - Bottom Sheet Style */}
                                <MarketingControls
                                    config={marketingConfig}
                                    setConfig={setMarketingConfig}
                                    onExport={handleMarketingExport}
                                    isExporting={isExporting}
                                />
                            </View>
                        )
                    }

                    {/* Photo Container - hide when annotating, comparing or marketing */}
                    {
                        activeTool !== 'annotate' && activeTool !== 'compare' && activeTool !== 'marketing' && (
                            <View style={styles.photoContainer}>
                                <Image
                                    source={{ uri: currentPhoto.fullUrl }}
                                    style={[styles.photo, {
                                        width: windowWidth,
                                        height: windowHeight < 700 ? windowHeight * 0.50 : windowHeight * 0.60,
                                    }]}
                                    resizeMode="contain"
                                />



                                {/* Photo Counter */}
                                {hasMultiplePhotos && (
                                    <View style={styles.photoCounter}>
                                        <Text style={styles.photoCounterText}>
                                            {currentIndex + 1} / {totalPhotos}
                                        </Text>
                                    </View>
                                )}

                                {/* Mobile Navigation - Simple Arrows (small screens) */}
                                {!isLargeScreen && hasMultiplePhotos && currentIndex > 0 && (
                                    <TouchableOpacity
                                        style={[styles.mobileArrow, styles.mobileArrowLeft]}
                                        onPress={goPrev}
                                    >
                                        <Ionicons name="chevron-back" size={28} color="#fff" />
                                    </TouchableOpacity>
                                )}
                                {!isLargeScreen && hasMultiplePhotos && currentIndex < totalPhotos - 1 && (
                                    <TouchableOpacity
                                        style={[styles.mobileArrow, styles.mobileArrowRight]}
                                        onPress={goNext}
                                    >
                                        <Ionicons name="chevron-forward" size={28} color="#fff" />
                                    </TouchableOpacity>
                                )}

                                {/* Side Preview - Left (previous photo) - LARGE SCREENS ONLY */}
                                {isLargeScreen && hasMultiplePhotos && currentIndex > 0 && (
                                    <TouchableOpacity
                                        style={styles.sidePreview}
                                        onPress={goPrev}
                                    >
                                        <Image
                                            source={{ uri: photoList[currentIndex - 1]?.thumbnailUrl || photoList[currentIndex - 1]?.fullUrl }}
                                            style={styles.sidePreviewImage}
                                            resizeMode="cover"
                                        />
                                        <View style={styles.sidePreviewOverlay}>
                                            <Ionicons name="chevron-back" size={24} color="#fff" />
                                        </View>
                                    </TouchableOpacity>
                                )}

                                {/* Side Preview - Right (next photo) - LARGE SCREENS ONLY */}
                                {isLargeScreen && hasMultiplePhotos && currentIndex < totalPhotos - 1 && (
                                    <TouchableOpacity
                                        style={[styles.sidePreview, styles.sidePreviewRight]}
                                        onPress={goNext}
                                    >
                                        <Image
                                            source={{ uri: photoList[currentIndex + 1]?.thumbnailUrl || photoList[currentIndex + 1]?.fullUrl }}
                                            style={styles.sidePreviewImage}
                                            resizeMode="cover"
                                        />
                                        <View style={styles.sidePreviewOverlay}>
                                            <Ionicons name="chevron-forward" size={24} color="#fff" />
                                        </View>
                                    </TouchableOpacity>
                                )}

                                {/* Visibility Badge */}
                                <View style={[
                                    styles.visibilityBadge,
                                    currentPhoto.visibility === 'shareable' && styles.visibilityShareable,
                                    currentPhoto.visibility === 'private' && styles.visibilityPrivate,
                                    isMobile && styles.visibilityBadgeMobile
                                ]}>
                                    <Ionicons
                                        name={
                                            currentPhoto.visibility === 'shareable' ? 'share-social' :
                                                currentPhoto.visibility === 'private' ? 'lock-closed' : 'eye'
                                        }
                                        size={14}
                                        color="#fff"
                                    />
                                    <Text style={styles.visibilityText}>
                                        {currentPhoto.visibility === 'shareable' ? 'Compartible' :
                                            currentPhoto.visibility === 'private' ? 'Privada' : 'Solo coach'}
                                    </Text>
                                </View>
                            </View>
                        )
                    }

                    {/* Annotation Canvas (replaces photo when annotating) */}
                    {
                        activeTool === 'annotate' && (
                            <View style={styles.annotationContainer}>
                                <SkiaAnnotationCanvas
                                    ref={canvasRef}
                                    imageUri={photo.fullUrl}
                                    initialStrokes={strokes}
                                    initialNote={annotationNote}
                                    onStrokesChange={(newStrokes) => {
                                        setStrokes(newStrokes);
                                        setHasChanges(true);
                                    }}
                                    onNoteChange={(newNote) => {
                                        setAnnotationNote(newNote);
                                        setHasChanges(true);
                                    }}
                                />
                            </View>
                        )
                    }

                    {/* Floating Toolbar - Centered Pill Design */}
                    <View style={[
                        styles.toolbar,
                        isMobile && [styles.toolbarMobile, windowHeight < 700 && { bottom: 110 }],
                        isLargeScreen && styles.toolbarDesktop
                    ]}>
                        <View style={[
                            styles.toolbarInner,
                            isMobile && styles.toolbarInnerMobile
                        ]}>
                            {/* Photo Navigation - Left side */}
                            {hasMultiplePhotos && (
                                <View style={styles.navContainer}>
                                    <TouchableOpacity
                                        style={styles.navArrowBtn}
                                        onPress={() => navigatePhoto(-1)}
                                        disabled={currentIndex === 0}
                                    >
                                        <Ionicons
                                            name="chevron-back"
                                            size={18}
                                            color={currentIndex === 0 ? '#4b5563' : '#fff'}
                                        />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setActiveTool(null)}>
                                        <Text style={styles.photoIndexText}>
                                            {currentIndex + 1}/{totalPhotos}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.navArrowBtn}
                                        onPress={() => navigatePhoto(1)}
                                        disabled={currentIndex === totalPhotos - 1}
                                    >
                                        <Ionicons
                                            name="chevron-forward"
                                            size={18}
                                            color={currentIndex === totalPhotos - 1 ? '#4b5563' : '#fff'}
                                        />
                                    </TouchableOpacity>
                                    <View style={styles.toolbarDivider} />
                                </View>
                            )}

                            {/* Tool Buttons */}
                            {visibleTools.map(tool => (
                                <TouchableOpacity
                                    key={tool.id}
                                    style={[
                                        styles.toolBtn,
                                        isLargeScreen && styles.toolBtnDesktop,
                                        activeTool === tool.id && { backgroundColor: tool.color + '25' },
                                    ]}
                                    onPress={() => handleToolPress(tool.id)}
                                >
                                    <Ionicons
                                        name={tool.icon}
                                        size={isLargeScreen ? 20 : 22}
                                        color={activeTool === tool.id ? tool.color : '#9ca3af'}
                                    />
                                    {isLargeScreen && (
                                        <Text style={[
                                            styles.toolLabel,
                                            isLargeScreen && styles.toolLabelDesktop,
                                            activeTool === tool.id && { color: tool.color },
                                        ]}>
                                            {tool.label}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Annotation History Badge */}
                    {
                        photo.annotationVersions?.length > 0 && (
                            <View style={styles.historyBadge}>
                                <Ionicons name="git-commit" size={14} color="#f59e0b" />
                                <Text style={styles.historyText}>
                                    {photo.annotationVersions.length} versiones
                                </Text>
                            </View>
                        )
                    }

                    {/* Voice Notes Badge */}
                    {
                        photo.voiceNotes?.length > 0 && (
                            <View style={styles.voiceNotesBadge}>
                                <Ionicons name="mic" size={14} color="#8b5cf6" />
                                <Text style={styles.voiceNotesText}>
                                    {photo.voiceNotes.length} notas
                                </Text>
                            </View>
                        )
                    }

                    {/* Note Input - hide in marketing mode */}
                    {
                        activeTool !== 'marketing' && (
                            <View style={styles.noteSection}>
                                <View style={styles.noteInputContainer}>
                                    <Ionicons name="chatbubble-outline" size={16} color="#9ca3af" />
                                    <EnhancedTextInput
                                        placeholder="Añadir nota para el cliente..."
                                        placeholderTextColor="#9ca3af"
                                        value={annotationNote}
                                        onChangeText={(text) => {
                                            setAnnotationNote(text);
                                            setHasChanges(true);
                                        }}
                                        containerStyle={{
                                            flex: 1,
                                            marginLeft: 10,
                                        }}
                                        style={{
                                            color: '#fff',
                                            fontSize: 14,
                                        }}
                                    />
                                </View>
                            </View>
                        )
                    }

                    {/* Action Buttons - siempre visibles */}
                    <View style={[
                        styles.actionButtonsRow,
                        isMobile && styles.actionButtonsRowMobile
                    ]}>
                        {/* Add single photo */}
                        <TouchableOpacity
                            style={[
                                styles.addToFeedbackBtn,
                                isMobile && styles.btnMobile
                            ]}
                            onPress={async () => {
                                setIsLoading(true);
                                try {
                                    if (hasChanges) await handleSave();
                                    const annotatedUrl = await uploadAnnotatedImage();
                                    addHighlight({
                                        id: `photo_${currentPhoto._id}_${Date.now()}`,
                                        text: annotationNote || 'Foto de progreso',
                                        exerciseName: 'Foto de progreso',
                                        thumbnail: currentPhoto.thumbnailUrl || currentPhoto.fullUrl,
                                        sourceMediaUrl: annotatedUrl,
                                        mediaType: 'photo',
                                    });
                                    if (Platform.OS === 'web') {
                                        alert('Foto añadida al feedback');
                                    } else {
                                        Alert.alert('Borrador', 'Foto guardada como borrador');
                                    }
                                    onClose();
                                } catch (error) {
                                    console.error('[CoachStudio] Error:', error);
                                    if (Platform.OS === 'web') {
                                        alert('Error al guardar');
                                    } else {
                                        Alert.alert('Error', 'No se pudo guardar');
                                    }
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="image-outline" size={18} color="#fff" />
                                    <Text style={[
                                        styles.addToFeedbackText,
                                        isMobile && styles.btnTextMobile
                                    ]}>
                                        {hasMultiplePhotos ? 'Añadir esta foto' : 'Añadir al Feedback'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Add all photos (only if multiple) */}
                        {hasMultiplePhotos && (
                            <TouchableOpacity
                                style={[
                                    styles.addToFeedbackBtn,
                                    { backgroundColor: '#0ea5e9' },
                                    isMobile && styles.btnMobile
                                ]}
                                onPress={async () => {
                                    setIsLoading(true);
                                    try {
                                        // Add all photos in the group
                                        for (const p of photoList) {
                                            addHighlight({
                                                id: `photo_${p._id}_${Date.now()}`,
                                                text: `Grupo de ${totalPhotos} fotos`,
                                                exerciseName: 'Fotos de progreso',
                                                thumbnail: p.thumbnailUrl || p.fullUrl,
                                                sourceMediaUrl: p.fullUrl,
                                                mediaType: 'photo',
                                            });
                                        }
                                        if (Platform.OS === 'web') {
                                            alert(`${totalPhotos} fotos añadidas al feedback`);
                                        } else {
                                            Alert.alert('Borrador', `${totalPhotos} fotos guardadas`);
                                        }
                                        onClose();
                                    } catch (error) {
                                        console.error('[CoachStudio] Error:', error);
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                disabled={isLoading}
                            >
                                <Ionicons name="images-outline" size={18} color="#fff" />
                                <Text style={[
                                    styles.addToFeedbackText,
                                    isMobile && styles.btnTextMobile
                                ]}>
                                    Añadir {totalPhotos} fotos
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.sendNowBtn,
                                isMobile && styles.btnMobile
                            ]}
                            onPress={async () => {
                                setIsLoading(true);
                                try {
                                    if (activeTool === 'compare' && comparePhoto) {
                                        // Send comparison directly to chat
                                        const older = new Date(leftPhoto.takenAt) <= new Date(rightPhoto.takenAt) ? leftPhoto : rightPhoto;
                                        const newer = older === leftPhoto ? rightPhoto : leftPhoto;
                                        const payload = {
                                            clientId,
                                            message: compareNoteRef.current || `Comparativa de progreso (${compareDelta || 'evolución'})`,
                                            type: 'evolucion',
                                            isCoach: true,
                                            metadata: {
                                                isComparison: true,
                                                compareData: {
                                                    olderPhotoUrl: older.fullUrl,
                                                    olderPhotoKey: older.r2Key,
                                                    olderDate: older.takenAt,
                                                    newerPhotoUrl: newer.fullUrl,
                                                    newerPhotoKey: newer.r2Key,
                                                    newerDate: newer.takenAt,
                                                    delta: compareDelta,
                                                    note: compareNoteRef.current,
                                                },
                                            },
                                        };
                                        const res = await fetch(`${API_URL}/api/chat`, {
                                            method: 'POST',
                                            headers: {
                                                Authorization: `Bearer ${token}`,
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify(payload),
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            if (Platform.OS === 'web') {
                                                alert('Comparativa enviada al cliente');
                                            } else {
                                                Alert.alert('Enviado', 'Comparativa enviada al chat del cliente');
                                            }
                                            compareNoteRef.current = '';
                                            onClose();
                                        } else {
                                            throw new Error(data.message || 'Error al enviar');
                                        }
                                    } else {
                                        // Normal photo send
                                        if (hasChanges) await handleSave();
                                        const annotatedUrl = await uploadAnnotatedImage();
                                        const payload = {
                                            clientId,
                                            message: annotationNote || 'Foto de progreso',
                                            type: 'evolucion',
                                            isCoach: true,
                                            mediaUrl: annotatedUrl || currentPhoto.r2Key || currentPhoto.fullUrl,
                                            mediaType: 'image',
                                        };
                                        const res = await fetch(`${API_URL}/api/chat`, {
                                            method: 'POST',
                                            headers: {
                                                Authorization: `Bearer ${token}`,
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify(payload),
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            if (Platform.OS === 'web') {
                                                alert('Foto enviada al cliente');
                                            } else {
                                                Alert.alert('Enviado', 'Foto enviada al chat del cliente');
                                            }
                                            onClose();
                                        } else {
                                            throw new Error(data.message || 'Error al enviar');
                                        }
                                    }
                                } catch (error) {
                                    console.error('[CoachStudio] Send error:', error);
                                    if (Platform.OS === 'web') {
                                        alert('Error al enviar');
                                    } else {
                                        Alert.alert('Error', 'No se pudo enviar');
                                    }
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="send" size={18} color="#fff" />
                                    <Text style={[
                                        styles.sendNowText,
                                        isMobile && styles.btnTextMobile
                                    ]}>Enviar ahora</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView >
            </ContentWrapper>
        </Modal >
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    // Smart Drawer Styles
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 1,
    },
    drawerContainer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        backgroundColor: '#0a0a0f',
        zIndex: 2,
        shadowColor: "#000",
        shadowOffset: {
            width: -2,
            height: 0,
        },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 25,
        overflow: 'hidden', // Ensure content doesn't spill out during resize
    },

    container: {
        flex: 1,
        // backgroundColor: '#0a0a0f', // Use drawer bg
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#0a0a0f',
    },
    headerMobile: {
        paddingTop: Platform.OS === 'ios' ? 54 : 40,
    },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtn: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    dateText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    tagsRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    tagChip: {
        fontSize: 11,
        color: '#9ca3af',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        textTransform: 'capitalize',
    },

    // Photo
    photoContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    photo: {
        // Dimensions set inline (dynamic based on windowWidth/windowHeight)
    },
    annotationOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    annotationPlaceholder: {
        fontSize: 16,
        color: '#00FFFF',
        textAlign: 'center',
        padding: 24,
        borderWidth: 2,
        borderColor: '#00FFFF',
        borderStyle: 'dashed',
        borderRadius: 12,
    },
    annotationContainer: {
        flex: 1,
        width: '100%',
    },

    // Visibility Badge
    visibilityBadge: {
        position: 'absolute',
        top: 16,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    visibilityBadgeMobile: {
        top: Platform.OS === 'ios' ? 54 : 40,
    },
    visibilityShareable: {
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
    },
    visibilityPrivate: {
        backgroundColor: 'rgba(107, 114, 128, 0.8)',
    },
    visibilityText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },

    // Color Picker
    colorPicker: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        paddingVertical: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    colorDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorDotActive: {
        borderColor: '#fff',
        transform: [{ scale: 1.2 }],
    },

    // Toolbar - Compact Floating Pill
    toolbar: {
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
        pointerEvents: 'box-none', // Allow clicks to pass through empty space
    },
    toolbarMobile: {
        top: undefined, // Remove top positioning
        bottom: 130, // Just above note input + action buttons (~125px)
        width: '50%', // Constrain width
        left: '25%', // Center it
        paddingHorizontal: 0,
    },
    toolbarInner: {
        flexDirection: 'row',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderRadius: 28,
        paddingVertical: 8,
        paddingHorizontal: 12,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    toolbarInnerMobile: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        gap: 2,
        borderRadius: 20,
    },
    toolbarDesktop: {
        top: 60, // Adjusted for desktop (was 80)
        paddingVertical: 6,
        paddingHorizontal: 6,
        gap: 2,
    },
    toolBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
    },
    toolBtnDesktop: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 4,
    },
    toolLabel: {
        fontSize: 12,
        color: '#9ca3af',
        fontWeight: '600',
    },
    toolLabelDesktop: {
        fontSize: 11,
    },
    navArrowBtn: {
        padding: 6,
        borderRadius: 8,
    },
    navContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    photoIndexText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        minWidth: 32,
        textAlign: 'center',
    },
    toolbarDivider: {
        width: 1,
        height: 20,
        backgroundColor: '#374151',
        marginHorizontal: 8,
    },

    // History & Voice Notes Badges
    historyBadge: {
        position: 'absolute',
        bottom: 100,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    historyText: {
        fontSize: 11,
        color: '#f59e0b',
        fontWeight: '500',
    },
    voiceNotesBadge: {
        position: 'absolute',
        bottom: 100,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    voiceNotesText: {
        fontSize: 11,
        color: '#8b5cf6',
        fontWeight: '500',
    },

    // Action Buttons
    actionButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#1a1a1f',
        borderTopWidth: 1,
        borderTopColor: '#2a2a35',
    },
    actionButtonsRowMobile: {
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        paddingHorizontal: 8,
        gap: 8,
    },
    addToFeedbackBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#6366f1',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnMobile: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 4,
    },
    addToFeedbackText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    btnTextMobile: {
        fontSize: 12,
    },
    sendNowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#8b5cf6',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    sendNowText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },

    // Note Input
    noteSection: {
        backgroundColor: '#1a1a1f',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#2a2a35',
    },
    noteInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#252530',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },

    photoCounter: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    photoCounterText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    // Mobile navigation arrows (simple, no preview)
    // Mobile navigation arrows (simple, no preview)
    mobileArrow: {
        position: 'absolute',
        top: '50%',
        marginTop: -24,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    mobileArrowLeft: {
        left: 4, // Moved closer to edge
    },
    mobileArrowRight: {
        right: 4, // Moved closer to edge
    },
    // Side Preview (3D carousel effect - large side panels)
    sidePreview: {
        position: 'absolute',
        left: '5%',
        top: '15%',
        bottom: '15%',
        width: 30,
        borderRadius: 8,
        overflow: 'hidden',
        transform: [{ perspective: 1000 }, { rotateY: '30deg' }],
        opacity: 0.9,
        zIndex: 5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    sidePreviewRight: {
        left: 'auto',
        right: '5%',
        transform: [{ perspective: 1000 }, { rotateY: '-30deg' }],
    },
    sidePreviewImage: {
        width: '100%',
        height: '100%',
    },
    sidePreviewOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Compare Mode
    compareContainer: {
        flex: 1,
        backgroundColor: '#0f0f13',
        paddingHorizontal: 8,
        paddingVertical: 12,
    },
    compareTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
        gap: 12,
    },
    closeCompareBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    compareDeltaBadge: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(14, 165, 233, 0.15)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },
    compareDeltaText: {
        color: '#0ea5e9',
        fontSize: 13,
        fontWeight: '700',
    },
    compareSwapBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    compareAddFeedbackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#6366f1',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginBottom: 8,
    },
    compareAddFeedbackText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    comparePickerImageActive: {
        borderColor: '#0ea5e9',
    },
    comparePhotosRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'stretch', // Changed from center to stretch so children take full height
        justifyContent: 'center',
        gap: 12,
        overflow: 'hidden', // Add overflow hidden here too
    },
    comparePhotoWrapper: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        overflow: 'hidden',
    },
    compareLabel: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
        flexShrink: 0,
        textAlign: 'center', // Center text explicitly
    },
    comparePhoto: {
        flex: 1,           // Use flex 1 instead of height 100% to fill remaining space
        width: '100%',
        borderRadius: 12,
        backgroundColor: '#1a1a1f',
    },
    compareDateLabel: {
        color: '#cbd5e1',
        fontSize: 13,
        fontWeight: '600',
    },
    compareDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        justifyContent: 'center',
    },
    compareDateRelative: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '400',
    },
    compareDeltaSubtext: {
        color: 'rgba(14, 165, 233, 0.6)',
        fontSize: 11,
        fontWeight: '400',
    },
    compareDivider: {
        paddingHorizontal: 4,
    },
    comparePlaceholder: {
        width: '100%',
        aspectRatio: 3 / 4,
        borderRadius: 12,
        backgroundColor: '#1a1a1f',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#2a2a35',
        borderStyle: 'dashed',
    },
    comparePlaceholderText: {
        color: '#64748b',
        fontSize: 14,
        marginTop: 8,
    },
    comparePickerContainer: {
        backgroundColor: '#1a1a1f',
        borderRadius: 12,
        padding: 12,
        marginTop: 16,
        // Default height for desktop/tablet
    },
    comparePhotosColumn: {
        flexDirection: 'column',
    },
    comparePhotoWrapperMobile: {
        maxWidth: '100%',
        width: '100%',
        flex: 1,
    },
    comparePhotoMobile: {
        width: '100%',
        height: '100%',
        aspectRatio: undefined, // Let flex handle it
        // maxHeight set inline based on windowHeight
    },
    comparePickerTitle: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 12,
    },
    comparePickerScroll: {
        gap: 10,
    },
    comparePickerItem: {
        alignItems: 'center',
        opacity: 0.7,
    },
    comparePickerItemActive: {
        opacity: 1,
    },
    comparePickerImage: {
        width: 72,
        height: 96,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    comparePickerDate: {
        color: '#94a3b8',
        fontSize: 11,
        marginTop: 4,
        textAlign: 'center',
    },
    compareNoteContainer: {
        marginBottom: 8,
    },
    compareNoteInputContainer: {
        backgroundColor: '#1a1a1f',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    compareNoteInput: {
        color: '#e2e8f0',
        fontSize: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 44,
        maxHeight: 80,
    },
    comparePickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        flexWrap: 'wrap',
        gap: 8,
    },
    compareTagFilters: {
        flexDirection: 'row',
        gap: 6,
    },
    compareTagChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    compareTagChipActive: {
        backgroundColor: 'rgba(14, 165, 233, 0.2)',
        borderColor: '#0ea5e9',
    },
    compareTagChipText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
    },
    compareTagChipTextActive: {
        color: '#0ea5e9',
    },
    comparePickerGroup: {
        marginRight: 16,
    },
    comparePickerMonthLabel: {
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    comparePickerGroupPhotos: {
        flexDirection: 'row',
        gap: 10,
    },

    // Marketing
    marketingMainContainer: {
        flex: 1,
        backgroundColor: '#0f0f13',
    },
    marketingPreviewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    zoomToolbarContainer: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#1e1e24',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        marginBottom: 8,
    },
    zoomToolbarRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
    },
    zoomControlGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    zoomLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
    },
    zoomButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: 4,
    },
    zoomBtnSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomValueText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        minWidth: 40,
        textAlign: 'center',
    },
});
