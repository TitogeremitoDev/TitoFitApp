/**
 * video-library/index.jsx
 * Biblioteca de videos del entrenador
 * Permite guardar y organizar videos de YouTube para compartir con atletas
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
    ActivityIndicator, SafeAreaView, Modal, RefreshControl,
    Platform, useWindowDimensions, Image, Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function VideoLibraryScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const { width: screenWidth } = useWindowDimensions();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [videos, setVideos] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalUsage, setTotalUsage] = useState(0);
    const [favorites, setFavorites] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [editingVideo, setEditingVideo] = useState(null);

    // Modales de confirmación
    const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: null, confirmText: 'Confirmar', danger: false });
    const [infoModal, setInfoModal] = useState({ visible: false, title: '', message: '' });

    // Form state
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formTags, setFormTags] = useState('');
    const [saving, setSaving] = useState(false);
    const [fetchingMetadata, setFetchingMetadata] = useState(false);
    const [previewData, setPreviewData] = useState(null); // { videoId, thumbnailUrl, author }

    // Responsive
    const isLargeScreen = screenWidth > 768;
    const cardWidth = isLargeScreen ? (screenWidth - 80) / 3 : (screenWidth - 48) / 2;

    // Helpers para modales
    const showInfo = (title, message) => {
        setInfoModal({ visible: true, title, message });
    };

    const showConfirm = (title, message, onConfirm, confirmText = 'Confirmar', danger = false) => {
        setConfirmModal({ visible: true, title, message, onConfirm, confirmText, danger });
    };

    // Cargar videos
    const loadVideos = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/trainer-videos/trainer`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setVideos(data.videos || []);
                setTotal(data.total || 0);
                setTotalUsage(data.totalUsage || 0);
                setFavorites(data.favorites || 0);
            }
        } catch (error) {
            console.error('[VideoLibrary] Error:', error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { loadVideos(); }, [loadVideos]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadVideos();
        setRefreshing(false);
    };

    // Filtrar videos por búsqueda
    const filteredVideos = searchQuery.trim()
        ? videos.filter(v =>
            v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : videos;

    // Abrir modal para crear/editar
    const openModal = (video = null) => {
        if (video) {
            setEditingVideo(video);
            setFormTitle(video.title);
            setFormDescription(video.description || '');
            setFormUrl(video.url);
            setFormTags(video.tags?.join(', ') || '');
            setPreviewData({
                videoId: video.videoId,
                thumbnailUrl: video.thumbnailUrl,
                author: ''
            });
        } else {
            setEditingVideo(null);
            setFormTitle('');
            setFormDescription('');
            setFormUrl('');
            setFormTags('');
            setPreviewData(null);
        }
        setModalVisible(true);
    };

    // ═════════════════════════════════════════════════════════════════════════════
    // AUTO-FETCH: Detectar URL y obtener metadatos automáticamente
    // ═════════════════════════════════════════════════════════════════════════════
    const handleUrlChange = async (url) => {
        setFormUrl(url);

        // Detectar si parece una URL de YouTube
        if (!url || url.length < 10) {
            setPreviewData(null);
            return;
        }

        // Patrones de YouTube
        const youtubePatterns = ['youtube.com', 'youtu.be', 'youtube'];
        const isYouTube = youtubePatterns.some(p => url.toLowerCase().includes(p));

        if (!isYouTube) return;

        // Auto-fetch metadatos
        setFetchingMetadata(true);
        try {
            const res = await fetch(
                `${API_URL}/api/trainer-videos/fetch-metadata?url=${encodeURIComponent(url)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json();

            if (data.success && data.metadata) {
                // Auto-rellenar
                if (!formTitle.trim() && data.metadata.title) {
                    setFormTitle(data.metadata.title);
                }
                if (!formDescription.trim() && data.metadata.description) {
                    setFormDescription(data.metadata.description);
                }
                // Auto-add tags (inteligente)
                if (data.metadata.tags && data.metadata.tags.length > 0) {
                    const currentTags = formTags ? formTags.split(',').map(t => t.trim()) : [];
                    const newTags = data.metadata.tags.filter(t => !currentTags.includes(t));
                    if (newTags.length > 0) {
                        setFormTags(currentTags.concat(newTags).join(', '));
                    }
                }

                setPreviewData({
                    videoId: data.metadata.videoId,
                    thumbnailUrl: data.metadata.thumbnailUrl,
                    author: data.metadata.author || ''
                });
            } else {
                setPreviewData(null);
            }
        } catch (error) {
            console.error('[VideoLibrary] Error fetching metadata:', error);
            setPreviewData(null);
        } finally {
            setFetchingMetadata(false);
        }
    };

    // Guardar video
    const handleSave = async () => {
        if (!formTitle.trim() || !formUrl.trim()) {
            showInfo('Error', 'Título y URL son obligatorios');
            return;
        }

        setSaving(true);
        const tags = formTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

        try {
            const url = editingVideo
                ? `${API_URL}/api/trainer-videos/${editingVideo._id}`
                : `${API_URL}/api/trainer-videos`;

            const res = await fetch(url, {
                method: editingVideo ? 'PUT' : 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: formTitle.trim(),
                    description: formDescription.trim(),
                    url: formUrl.trim(),
                    tags
                })
            });
            const data = await res.json();
            if (data.success) {
                setModalVisible(false);
                loadVideos();
            } else {
                showInfo('Error', data.message);
            }
        } catch (error) {
            showInfo('Error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    // Eliminar video
    const handleDelete = (video) => {
        showConfirm(
            'Eliminar Video',
            `¿Eliminar "${video.title}"?`,
            async () => {
                try {
                    await fetch(`${API_URL}/api/trainer-videos/${video._id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    loadVideos();
                } catch (error) {
                    showInfo('Error', 'No se pudo eliminar');
                }
            },
            'Eliminar',
            true
        );
    };

    // Toggle favorito
    const handleToggleFavorite = async (video) => {
        try {
            await fetch(`${API_URL}/api/trainer-videos/favorite/${video._id}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            loadVideos();
        } catch (error) {
            console.error('[VideoLibrary] Error toggling favorite:', error);
        }
    };

    // Abrir video en YouTube
    const handleOpenVideo = async (video) => {
        try {
            // Incrementar uso
            fetch(`${API_URL}/api/trainer-videos/use/${video._id}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            await Linking.openURL(video.url);
        } catch (error) {
            showInfo('Error', 'No se pudo abrir el video');
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8b5cf6" />
                    <Text style={styles.loadingText}>Cargando videos...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Videos Propios"
                subtitle="Biblioteca de recursos"
                icon="videocam"
                iconColor="#8b5cf6"
            />

            {/* Stats Bar */}
            <View style={styles.statsBar}>
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{total}</Text>
                    <Text style={styles.statLabel}>Videos</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{favorites}</Text>
                    <Text style={styles.statLabel}>Favoritos</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#22c55e' }]}>{totalUsage}</Text>
                    <Text style={styles.statLabel}>Usos</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
                    <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="#94a3b8" />
                <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Buscar por título o tags..."
                    placeholderTextColor="#94a3b8"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Video Grid */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}
            >
                {filteredVideos.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="videocam-outline" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No hay videos</Text>
                        <Text style={styles.emptySubtitle}>Pulsa + para añadir tu primer video de YouTube</Text>
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {filteredVideos.map((video) => (
                            <View key={video._id} style={[styles.videoCard, { width: cardWidth }]}>
                                {/* Thumbnail */}
                                <TouchableOpacity onPress={() => handleOpenVideo(video)} style={styles.thumbnailContainer}>
                                    <Image
                                        source={{ uri: video.thumbnailUrl }}
                                        style={styles.thumbnail}
                                        resizeMode="cover"
                                    />
                                    <View style={styles.playOverlay}>
                                        <Ionicons name="play-circle" size={44} color="rgba(255,255,255,0.9)" />
                                    </View>
                                    {video.isFavorite && (
                                        <View style={styles.favoriteBadge}>
                                            <Ionicons name="star" size={14} color="#f59e0b" />
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {/* Info */}
                                <View style={styles.videoInfo}>
                                    <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
                                    {video.tags?.length > 0 && (
                                        <View style={styles.tagRow}>
                                            {video.tags.slice(0, 2).map((tag, i) => (
                                                <View key={i} style={styles.tag}>
                                                    <Text style={styles.tagText}>{tag}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>

                                {/* Actions */}
                                <View style={styles.videoActions}>
                                    <TouchableOpacity onPress={() => handleToggleFavorite(video)} style={styles.videoActionBtn}>
                                        <Ionicons name={video.isFavorite ? "star" : "star-outline"} size={18} color={video.isFavorite ? "#f59e0b" : "#64748b"} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => openModal(video)} style={styles.videoActionBtn}>
                                        <Ionicons name="create-outline" size={18} color="#3b82f6" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(video)} style={styles.videoActionBtn}>
                                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Create/Edit Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, isLargeScreen && { maxWidth: 600 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingVideo ? 'Editar Video' : 'Añadir Video'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.inputLabel}>URL de YouTube *</Text>
                            <TextInput
                                style={styles.input}
                                value={formUrl}
                                onChangeText={handleUrlChange}
                                placeholder="Pega el enlace de YouTube aquí..."
                                placeholderTextColor="#94a3b8"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />

                            <Text style={styles.inputLabel}>Título *</Text>
                            <TextInput
                                style={styles.input}
                                value={formTitle}
                                onChangeText={setFormTitle}
                                placeholder="Ej: Cómo corregir el Butt Wink"
                                placeholderTextColor="#94a3b8"
                                maxLength={200}
                            />

                            <Text style={styles.inputLabel}>Descripción (Opcional)</Text>
                            <TextInput
                                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                                value={formDescription}
                                onChangeText={setFormDescription}
                                placeholder="Notas o descripción del video..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                numberOfLines={3}
                                maxLength={2000}
                            />



                            {/* Loading indicator */}
                            {fetchingMetadata && (
                                <View style={styles.fetchingRow}>
                                    <ActivityIndicator size="small" color="#8b5cf6" />
                                    <Text style={styles.fetchingText}>Cargando metadatos...</Text>
                                </View>
                            )}

                            {/* Preview Card */}
                            {previewData && !fetchingMetadata && (
                                <View style={styles.previewCard}>
                                    <Image
                                        source={{ uri: previewData.thumbnailUrl }}
                                        style={styles.previewThumb}
                                        resizeMode="cover"
                                    />
                                    <View style={styles.previewInfo}>
                                        <Text style={styles.previewCheck}>✅ Video detectado</Text>
                                        {previewData.author && (
                                            <Text style={styles.previewAuthor}>Canal: {previewData.author}</Text>
                                        )}
                                    </View>
                                </View>
                            )}

                            <Text style={styles.inputHint}>
                                Formatos aceptados: youtube.com, youtu.be, embed...
                            </Text>

                            <Text style={styles.inputLabel}>Tags (separados por coma)</Text>
                            <TextInput
                                style={styles.input}
                                value={formTags}
                                onChangeText={setFormTags}
                                placeholder="sentadilla, movilidad, cadera"
                                placeholderTextColor="#94a3b8"
                            />
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.saveButton, saving && { opacity: 0.6 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveButtonText}>{editingVideo ? 'Guardar Cambios' : 'Añadir Video'}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Info Modal */}
            <Modal visible={infoModal.visible} animationType="fade" transparent>
                <View style={styles.alertOverlay}>
                    <View style={styles.alertCard}>
                        <Text style={styles.alertTitle}>{infoModal.title}</Text>
                        <Text style={styles.alertMessage}>{infoModal.message}</Text>
                        <TouchableOpacity
                            style={styles.alertBtn}
                            onPress={() => setInfoModal({ visible: false, title: '', message: '' })}
                        >
                            <Text style={styles.alertBtnText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Confirm Modal */}
            <Modal visible={confirmModal.visible} animationType="fade" transparent>
                <View style={styles.alertOverlay}>
                    <View style={styles.alertCard}>
                        <Text style={styles.alertTitle}>{confirmModal.title}</Text>
                        <Text style={styles.alertMessage}>{confirmModal.message}</Text>
                        <View style={styles.alertBtns}>
                            <TouchableOpacity
                                style={[styles.alertBtn, styles.alertBtnCancel]}
                                onPress={() => setConfirmModal({ ...confirmModal, visible: false })}
                            >
                                <Text style={styles.alertBtnCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.alertBtn, confirmModal.danger && styles.alertBtnDanger]}
                                onPress={() => {
                                    setConfirmModal({ ...confirmModal, visible: false });
                                    confirmModal.onConfirm?.();
                                }}
                            >
                                <Text style={styles.alertBtnText}>{confirmModal.confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: '#64748b' },

    // Stats Bar
    statsBar: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0'
    },
    statItem: { alignItems: 'center', paddingHorizontal: 16 },
    statNumber: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
    statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
    statDivider: { width: 1, height: 32, backgroundColor: '#e2e8f0' },
    addBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: '#8b5cf6',
        justifyContent: 'center', alignItems: 'center', marginLeft: 'auto'
    },

    // Search Bar
    searchBar: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 12
    },
    searchInput: {
        flex: 1, fontSize: 15, color: '#1e293b',
        ...(Platform.OS === 'web' && { outlineStyle: 'none' })
    },

    // Content
    content: { flex: 1 },
    contentContainer: { padding: 16 },

    // Grid
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

    // Empty
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#64748b', marginTop: 16 },
    emptySubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 8, textAlign: 'center' },

    // Video Card
    videoCard: {
        backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
        borderWidth: 1, borderColor: '#e2e8f0'
    },
    thumbnailContainer: { position: 'relative', aspectRatio: 16 / 9 },
    thumbnail: { width: '100%', height: '100%', backgroundColor: '#1e293b' },
    playOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)'
    },
    favoriteBadge: {
        position: 'absolute', top: 8, right: 8,
        backgroundColor: '#fff', borderRadius: 12, padding: 4
    },
    videoInfo: { padding: 12 },
    videoTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', lineHeight: 18 },
    tagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
    tag: { backgroundColor: '#f3e8ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    tagText: { fontSize: 11, color: '#8b5cf6' },
    videoActions: {
        flexDirection: 'row', justifyContent: 'space-around',
        borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: 8
    },
    videoActionBtn: { padding: 8 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalContent: { backgroundColor: '#fff', borderRadius: 24, maxHeight: '90%', width: '100%', alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
    modalCloseBtn: { padding: 4 },
    modalBody: { padding: 20 },

    inputLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8, marginTop: 16 },
    inputHint: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
    input: {
        backgroundColor: '#f8fafc', color: '#1e293b', padding: 14, borderRadius: 12, fontSize: 15,
        borderWidth: 1, borderColor: '#e2e8f0', ...(Platform.OS === 'web' && { outlineStyle: 'none' })
    },

    saveButton: { backgroundColor: '#8b5cf6', padding: 16, margin: 20, borderRadius: 12, alignItems: 'center' },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Alert modals
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    alertCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
    alertTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12, textAlign: 'center' },
    alertMessage: { fontSize: 15, color: '#64748b', lineHeight: 22, textAlign: 'center', marginBottom: 24 },
    alertBtns: { flexDirection: 'row', gap: 12 },
    alertBtn: { flex: 1, backgroundColor: '#8b5cf6', padding: 14, borderRadius: 12, alignItems: 'center' },
    alertBtnCancel: { backgroundColor: '#f1f5f9' },
    alertBtnDanger: { backgroundColor: '#ef4444' },
    alertBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    alertBtnCancelText: { color: '#64748b', fontSize: 15, fontWeight: '600' },

    // Preview Card (Auto-import)
    fetchingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    fetchingText: { fontSize: 13, color: '#8b5cf6' },
    previewCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4',
        borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#bbf7d0'
    },
    previewThumb: { width: 80, height: 45, borderRadius: 8, backgroundColor: '#e2e8f0' },
    previewInfo: { flex: 1, marginLeft: 12 },
    previewCheck: { fontSize: 14, fontWeight: '600', color: '#16a34a' },
    previewAuthor: { fontSize: 12, color: '#64748b', marginTop: 2 }
});
