// src/components/coach/VideoSearchPicker.jsx
// ═══════════════════════════════════════════════════════════════════════════
// BUSCADOR DE VIDEOS YOUTUBE - Conexión directa con TrainerVideo
// Busca por nombre en la biblioteca del entrenador
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Image,
    StyleSheet,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function VideoSearchPicker({
    token,
    onSelectVideo,
    selectedVideo,
    onClear,
}) {
    const [query, setQuery] = useState('');
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const debounceRef = useRef(null);

    // Load all videos initially
    useEffect(() => {
        loadVideos('');
    }, []);

    // Debounced search
    const handleSearch = useCallback((text) => {
        setQuery(text);
        setShowResults(true);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            loadVideos(text);
        }, 300);
    }, []);

    const loadVideos = async (searchQuery) => {
        try {
            setLoading(true);
            const endpoint = searchQuery.length >= 2
                ? `${API_URL}/api/trainer-videos/search?q=${encodeURIComponent(searchQuery)}`
                : `${API_URL}/api/trainer-videos/trainer`;

            const res = await fetch(endpoint, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setVideos(data.results || data.videos || []);
            }
        } catch (error) {
            console.error('[VideoSearchPicker] Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (video) => {
        onSelectVideo({
            title: video.title,
            url: video.url,
            thumbnailUrl: video.thumbnailUrl,
            _id: video._id
        });
        setShowResults(false);
        setQuery('');

        // Increment usage count
        fetch(`${API_URL}/api/trainer-videos/use/${video._id}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        }).catch(() => { });
    };

    // If video already selected, show it
    if (selectedVideo) {
        return (
            <View style={styles.selectedContainer}>
                <Ionicons name="logo-youtube" size={24} color="#ef4444" />
                <Text style={styles.selectedTitle} numberOfLines={1}>
                    {selectedVideo.title}
                </Text>
                <TouchableOpacity onPress={onClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={22} color="#666" />
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Search Input */}
            <View style={styles.searchRow}>
                <View style={styles.inputContainer}>
                    <Ionicons name="search" size={18} color="#4361ee" style={styles.searchIcon} />
                    <EnhancedTextInput
                        containerStyle={styles.inputContainerStyle}
                        style={styles.inputText}
                        placeholder="Buscar video por nombre..."
                        placeholderTextColor="#666"
                        value={query}
                        onChangeText={handleSearch}
                        onFocus={() => setShowResults(true)}
                    />
                    {loading && <ActivityIndicator size="small" color="#4361ee" />}
                </View>
            </View>

            {/* Results */}
            {showResults && videos.length > 0 && (
                <View style={styles.resultsContainer}>
                    <ScrollView
                        style={styles.resultsList}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                    >
                        {videos.slice(0, 8).map((video) => (
                            <TouchableOpacity
                                key={video._id}
                                style={styles.resultItem}
                                onPress={() => handleSelect(video)}
                                activeOpacity={0.7}
                            >
                                {video.thumbnailUrl ? (
                                    <Image
                                        source={{ uri: video.thumbnailUrl }}
                                        style={styles.thumbnail}
                                    />
                                ) : (
                                    <View style={[styles.thumbnail, styles.placeholderThumb]}>
                                        <Ionicons name="play-circle" size={20} color="#4361ee" />
                                    </View>
                                )}
                                <View style={styles.videoInfo}>
                                    <Text style={styles.videoTitle} numberOfLines={2}>
                                        {video.title}
                                    </Text>
                                    {video.tags?.length > 0 && (
                                        <Text style={styles.videoTags} numberOfLines={1}>
                                            {video.tags.slice(0, 3).join(' • ')}
                                        </Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Empty state */}
            {showResults && query.length >= 2 && videos.length === 0 && !loading && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No se encontraron videos</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 8,
    },
    searchRow: {
        flexDirection: 'row',
        gap: 8,
    },
    inputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#4361ee50',
        paddingHorizontal: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    inputContainerStyle: {
        flex: 1,
        paddingVertical: 12,
    },
    inputText: {
        color: '#fff',
        fontSize: 14,
    },
    resultsContainer: {
        backgroundColor: '#1a1a2e',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333',
        maxHeight: 200,
        overflow: 'hidden',
    },
    resultsList: {
        maxHeight: 200,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    thumbnail: {
        width: 60,
        height: 40,
        borderRadius: 6,
        backgroundColor: '#333',
    },
    placeholderThumb: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoInfo: {
        flex: 1,
    },
    videoTitle: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    videoTags: {
        color: '#888',
        fontSize: 11,
        marginTop: 2,
    },
    selectedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#1a1a2e',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#4361ee30',
    },
    selectedTitle: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
    },
    emptyState: {
        padding: 16,
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 13,
    },
});
