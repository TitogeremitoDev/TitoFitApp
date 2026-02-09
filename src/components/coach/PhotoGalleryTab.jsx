// src/components/coach/PhotoGalleryTab.jsx
// ═══════════════════════════════════════════════════════════════════════════
// GALERÍA CORPORAL - Grid de fotos de progreso del cliente
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    RefreshControl,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// Visibility badges
const VISIBILITY_CONFIG = {
    private: { icon: 'lock-closed', color: '#6b7280', label: 'Privada' },
    coach_only: { icon: 'eye', color: '#3b82f6', label: 'Solo coach' },
    shareable: { icon: 'share-social', color: '#10b981', label: 'Compartible' },
};

// Tag labels
const TAG_LABELS = {
    front: 'Frontal',
    side: 'Lateral',
    back: 'Espalda',
    'pose:relaxed': 'Relajado',
    'pose:flex': 'Flexión',
    'pose:vacuum': 'Vacuum',
};

/**
 * PhotoGalleryTab - Grid de fotos de progreso
 * @param {string} clientId - ID del cliente
 * @param {string} token - Token de autenticación
 * @param {function} onPhotoPress - Callback cuando se presiona una foto (abre CoachStudio)
 */
export default function PhotoGalleryTab({ clientId, token, onPhotoPress }) {
    const { width } = useWindowDimensions();
    const numColumns = width > 900 ? 10 : width > 600 ? 7 : width > 400 ? 4 : 3;
    const gap = width < 400 ? 4 : 6;
    const listPadding = width < 400 ? 8 : 16;
    const imageSize = (width - listPadding * 2 - (numColumns - 1) * gap) / numColumns;

    const [photos, setPhotos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedTags, setSelectedTags] = useState([]);
    const [visibilityFilter, setVisibilityFilter] = useState(null);
    const [groupedPhotos, setGroupedPhotos] = useState([]);

    // ─────────────────────────────────────────────────────────────────────────
    // CARGAR FOTOS
    // ─────────────────────────────────────────────────────────────────────────
    const fetchPhotos = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setIsLoading(true);

            let url = `${API_URL}/api/progress-photos/client/${clientId}?limit=100`;
            if (selectedTags.length > 0) {
                url += `&tags=${selectedTags.join(',')}`;
            }
            if (visibilityFilter) {
                url += `&visibility=${visibilityFilter}`;
            }

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (data.success) {
                setPhotos(data.photos || []);
                groupPhotosByMonth(data.photos || []);
            }
        } catch (error) {
            console.error('[PhotoGalleryTab] Error:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [clientId, token, selectedTags, visibilityFilter]);

    useEffect(() => {
        fetchPhotos();
    }, [fetchPhotos]);

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchPhotos(true);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // AGRUPAR POR MES Y DÍA
    // ─────────────────────────────────────────────────────────────────────────
    const groupPhotosByMonth = (photoList) => {
        const monthGroups = {};

        photoList.forEach(photo => {
            const date = new Date(photo.takenAt);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const dayKey = `${monthKey}-${String(date.getDate()).padStart(2, '0')}`;
            const monthLabel = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

            if (!monthGroups[monthKey]) {
                monthGroups[monthKey] = { key: monthKey, label: monthLabel, days: {}, photos: [] };
            }

            // Agrupar por día (para carrusel)
            if (!monthGroups[monthKey].days[dayKey]) {
                monthGroups[monthKey].days[dayKey] = [];
            }
            monthGroups[monthKey].days[dayKey].push(photo);
            monthGroups[monthKey].photos.push(photo);
        });

        // Ordenar por fecha descendente
        const sorted = Object.values(monthGroups).sort((a, b) => b.key.localeCompare(a.key));
        setGroupedPhotos(sorted);
    };

    // Helper: obtener grupo de fotos del mismo día
    const getPhotosFromSameDay = (photo) => {
        const date = new Date(photo.takenAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const dayKey = `${monthKey}-${String(date.getDate()).padStart(2, '0')}`;

        const monthGroup = groupedPhotos.find(g => g.key === monthKey);
        if (monthGroup?.days?.[dayKey]) {
            return monthGroup.days[dayKey];
        }
        return [photo]; // Fallback: solo esta foto
    };

    // ─────────────────────────────────────────────────────────────────────────
    // TOGGLE TAG FILTER
    // ─────────────────────────────────────────────────────────────────────────
    const toggleTag = (tag) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER PHOTO ITEM
    // ─────────────────────────────────────────────────────────────────────────
    const renderPhotoItem = ({ item: photo }) => {
        const visibility = VISIBILITY_CONFIG[photo.visibility] || VISIBILITY_CONFIG.coach_only;
        const hasAnnotations = photo.annotationVersions?.length > 0;
        const hasVoiceNotes = photo.voiceNotes?.length > 0;
        const photoDate = new Date(photo.takenAt);

        // Obtener grupo de fotos del mismo día
        const dayPhotos = getPhotosFromSameDay(photo);
        const photoIndex = dayPhotos.findIndex(p => p._id === photo._id);

        return (
            <TouchableOpacity
                style={[styles.photoItem, { width: imageSize, height: imageSize * (16 / 9), borderRadius: width < 400 ? 6 : 8 }]}
                onPress={() => onPhotoPress?.({
                    photos: dayPhotos,
                    initialIndex: Math.max(0, photoIndex),
                    selectedPhoto: photo
                })}
                activeOpacity={0.8}
            >
                {photo.thumbnailUrl || photo.fullUrl ? (
                    <Image
                        source={{ uri: photo.thumbnailUrl || photo.fullUrl }}
                        style={styles.photoImage}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={styles.photoPlaceholder}>
                        <Ionicons name="image-outline" size={32} color="#94a3b8" />
                    </View>
                )}

                {/* Overlay con badges */}
                <View style={styles.photoOverlay}>
                    {/* Fecha */}
                    <Text style={styles.photoDate}>
                        {photoDate.getDate()}/{photoDate.getMonth() + 1}
                    </Text>

                    {/* Badges row */}
                    <View style={styles.badgeRow}>
                        {/* Visibility badge */}
                        <View style={[styles.badge, { backgroundColor: visibility.color + '40', width: Math.max(16, imageSize * 0.22), height: Math.max(16, imageSize * 0.22), borderRadius: Math.max(8, imageSize * 0.11) }]}>
                            <Ionicons name={visibility.icon} size={Math.max(8, Math.round(imageSize * 0.12))} color={visibility.color} />
                        </View>

                        {/* Annotations badge */}
                        {hasAnnotations && (
                            <View style={[styles.badge, { backgroundColor: '#f59e0b40', width: Math.max(16, imageSize * 0.22), height: Math.max(16, imageSize * 0.22), borderRadius: Math.max(8, imageSize * 0.11) }]}>
                                <Ionicons name="pencil" size={Math.max(8, Math.round(imageSize * 0.12))} color="#f59e0b" />
                            </View>
                        )}

                        {/* Voice notes badge */}
                        {hasVoiceNotes && (
                            <View style={[styles.badge, { backgroundColor: '#8b5cf640', width: Math.max(16, imageSize * 0.22), height: Math.max(16, imageSize * 0.22), borderRadius: Math.max(8, imageSize * 0.11) }]}>
                                <Ionicons name="mic" size={Math.max(8, Math.round(imageSize * 0.12))} color="#8b5cf6" />
                            </View>
                        )}
                    </View>
                </View>

                {/* Tags */}
                {photo.tags?.length > 0 && (
                    <View style={styles.tagsRow}>
                        {photo.tags.slice(0, 2).map(tag => (
                            <Text key={tag} style={styles.tagChip}>
                                {TAG_LABELS[tag]?.charAt(0) || tag.charAt(0).toUpperCase()}
                            </Text>
                        ))}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER MONTH HEADER
    // ─────────────────────────────────────────────────────────────────────────
    const renderMonthSection = ({ item: group }) => (
        <View style={styles.monthSection}>
            <View style={styles.monthHeader}>
                <Text style={styles.monthLabel}>{group.label}</Text>
                <Text style={styles.monthCount}>{group.photos.length} fotos</Text>
            </View>
            <View style={[styles.photoGrid, { gap }]}>
                {group.photos.map((photo) => (
                    <View key={photo._id}>
                        {renderPhotoItem({ item: photo })}
                    </View>
                ))}
            </View>
        </View>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0ea5e9" />
                <Text style={styles.loadingText}>Cargando fotos...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Filtros */}
            <View style={styles.filtersContainer}>
                {/* Tag filters */}
                <View style={styles.filterRow}>
                    {['front', 'side', 'back'].map(tag => (
                        <TouchableOpacity
                            key={tag}
                            style={[
                                styles.filterChip,
                                selectedTags.includes(tag) && styles.filterChipActive
                            ]}
                            onPress={() => toggleTag(tag)}
                        >
                            <Text style={[
                                styles.filterChipText,
                                selectedTags.includes(tag) && styles.filterChipTextActive
                            ]}>
                                {TAG_LABELS[tag]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Visibility filter */}
                <View style={styles.filterRow}>
                    {['shareable', 'coach_only', 'private'].map(vis => (
                        <TouchableOpacity
                            key={vis}
                            style={[
                                styles.filterChip,
                                visibilityFilter === vis && {
                                    backgroundColor: VISIBILITY_CONFIG[vis].color + '20',
                                    borderColor: VISIBILITY_CONFIG[vis].color
                                }
                            ]}
                            onPress={() => setVisibilityFilter(
                                visibilityFilter === vis ? null : vis
                            )}
                        >
                            <Ionicons
                                name={VISIBILITY_CONFIG[vis].icon}
                                size={12}
                                color={visibilityFilter === vis
                                    ? VISIBILITY_CONFIG[vis].color
                                    : '#64748b'
                                }
                            />
                            <Text style={[
                                styles.filterChipText,
                                visibilityFilter === vis && {
                                    color: VISIBILITY_CONFIG[vis].color
                                }
                            ]}>
                                {VISIBILITY_CONFIG[vis].label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Grid de fotos agrupadas por mes */}
            {photos.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="images-outline" size={64} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>Sin fotos</Text>
                    <Text style={styles.emptyText}>
                        Este cliente aún no ha subido fotos de progreso.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={groupedPhotos}
                    renderItem={renderMonthSection}
                    keyExtractor={item => item.key}
                    contentContainerStyle={[styles.listContent, { padding: listPadding }]}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            colors={['#0ea5e9']}
                        />
                    }
                />
            )}
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        color: '#64748b',
        fontSize: 14,
    },

    // Filtros
    filtersContainer: {
        padding: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        gap: 8,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterChipActive: {
        backgroundColor: '#0ea5e920',
        borderColor: '#0ea5e9',
    },
    filterChipText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    filterChipTextActive: {
        color: '#0ea5e9',
    },

    // Lista
    listContent: {
        padding: 16,
    },

    // Sección de mes
    monthSection: {
        marginBottom: 24,
    },
    monthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    monthLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        textTransform: 'capitalize',
    },
    monthCount: {
        fontSize: 13,
        color: '#64748b',
    },

    // Grid de fotos
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    photoItem: {
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#e2e8f0',
    },
    photoImage: {
        width: '100%',
        height: '100%',
    },
    photoPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },

    // Overlay
    photoOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        padding: 6,
        justifyContent: 'space-between',
    },
    photoDate: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 4,
        alignSelf: 'flex-end',
    },
    badge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Tags
    tagsRow: {
        position: 'absolute',
        bottom: 6,
        left: 6,
        flexDirection: 'row',
        gap: 4,
    },
    tagChip: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
    },

    // Empty state
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        gap: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748b',
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
    },
});
