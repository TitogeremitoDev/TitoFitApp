import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer from "react-native-youtube-iframe";

type Exercise = {
    _id: string;
    name: string;
    muscle: string;
    instructions?: string[];
    tecnicaCorrecta?: string[];
    videoId?: string;
    id_trainer?: string;
    imagen_ejercicio_ID?: string;
};

interface ExerciseListCardProps {
    item: Exercise;
    isLargeScreen: boolean;
    adminTrainerId: string;
    onEdit: (ex: Exercise) => void;
    onFork: (ex: Exercise) => void;
}

// Helper to extract YouTube ID (frontend)
const getYouTubeId = (urlOrId: string) => {
    if (!urlOrId) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
        return urlOrId;
    }
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = urlOrId.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const getYouTubeThumb = (id: string) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

// Optimized with React.memo to prevent unnecessary re-renders when parent list updates
export default React.memo(function ExerciseListCard({ item, isLargeScreen, adminTrainerId, onEdit, onFork }: ExerciseListCardProps) {
    const isCustom = item.id_trainer && item.id_trainer !== adminTrainerId;
    const videoId = getYouTubeId(item.videoId || '');
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <View style={styles.exerciseCard}>
            <View style={[styles.exerciseContentRow, { flexDirection: isLargeScreen ? 'row' : 'column', gap: 12 }]}>
                {/* Information Column */}
                <View style={{ flex: 1 }}>
                    <View style={styles.exerciseHeader}>
                        <Text style={styles.exerciseName} numberOfLines={1}>{item.name}</Text>
                        {isCustom && (
                            <View style={styles.customBadge}>
                                <Ionicons name="person" size={10} color="#667eea" />
                                <Text style={styles.customBadgeText}>Tuyo</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.exerciseMuscle}>{item.muscle}</Text>

                    {item.instructions && item.instructions.length > 0 && (
                        <View style={styles.techniqueContainer}>
                            <View style={styles.techniqueHeader}>
                                <Ionicons name="checkmark-circle" size={14} color="#10B981" style={styles.techniqueIcon} />
                                <Text style={styles.techniqueTitle}>Técnica:</Text>
                            </View>
                            {item.instructions.slice(0, 3).map((tip, idx) => (
                                <Text key={idx} style={styles.techniqueTip}>{`- ${tip}`}</Text>
                            ))}
                            {item.instructions.length > 3 && (
                                <Text style={styles.techniqueMore}>
                                    {`+${item.instructions.length - 3} más`}
                                </Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Media Column (Technique -> Video -> Image) */}
                {(item.imagen_ejercicio_ID || videoId) && (
                    isLargeScreen ? (
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                            {/* Video Player or Thumbnail */}
                            {videoId && (
                                <View style={{
                                    width: 270, // 16:9 for 150px height approx
                                    height: 150,
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    backgroundColor: '#000',
                                    justifyContent: 'center'
                                }}>
                                    {isPlaying ? (
                                        <YoutubePlayer
                                            height={150}
                                            width={270}
                                            play={true}
                                            videoId={videoId}
                                            onChangeState={(state: string) => {
                                                if (state === "ended") setIsPlaying(false);
                                            }}
                                            webViewStyle={{ opacity: 0.99 }} // Fix for some android glitches
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                                            onPress={() => setIsPlaying(true)}
                                            activeOpacity={0.8}
                                        >
                                            <Image
                                                source={{ uri: getYouTubeThumb(videoId) }}
                                                style={{ width: '100%', height: '100%' }}
                                                resizeMode="contain"
                                            />
                                            <View style={{ position: 'absolute', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30, padding: 10 }}>
                                                <Ionicons name="play" size={32} color="#fff" />
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {/* Image */}
                            {item.imagen_ejercicio_ID && (
                                <View style={{
                                    width: 270,
                                    height: 150,
                                    borderRadius: 8,
                                    backgroundColor: '#000',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}>
                                    <Image
                                        source={{ uri: item.imagen_ejercicio_ID }}
                                        style={{ width: '100%', height: '100%' }}
                                        resizeMode="contain"
                                    />
                                </View>
                            )}
                        </View>
                    ) : (
                        // Mobile: Stacked
                        <View style={{ gap: 12, marginTop: 12 }}>
                            {item.imagen_ejercicio_ID && (
                                <Image
                                    source={{ uri: item.imagen_ejercicio_ID }}
                                    style={{
                                        width: '100%',
                                        height: 200,
                                        borderRadius: 8,
                                        backgroundColor: '#1F2937'
                                    }}
                                    resizeMode="cover"
                                />
                            )}
                            {videoId && (
                                <View style={{
                                    width: '100%',
                                    height: 200,
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    backgroundColor: '#000',
                                    justifyContent: 'center'
                                }}>
                                    {isPlaying ? (
                                        <YoutubePlayer
                                            height={200}
                                            play={true}
                                            videoId={videoId}
                                            onChangeState={(state: string) => {
                                                if (state === "ended") setIsPlaying(false);
                                            }}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                                            onPress={() => setIsPlaying(true)}
                                            activeOpacity={0.8}
                                        >
                                            <Image
                                                source={{ uri: getYouTubeThumb(videoId) }}
                                                style={{ width: '100%', height: '100%' }}
                                                resizeMode="contain"
                                            />
                                            <View style={{ position: 'absolute', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30, padding: 10 }}>
                                                <Ionicons name="play" size={32} color="#fff" />
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    )
                )}
            </View>

            {/* Action buttons */}
            <View style={styles.cardActions}>
                {isCustom ? (
                    <TouchableOpacity
                        onPress={() => onEdit(item)}
                        style={styles.actionBtn}
                    >
                        <Ionicons name="create-outline" size={20} color="#667eea" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={() => onFork(item)}
                        style={styles.forkBtn}
                    >
                        <Ionicons name="git-branch-outline" size={16} color="#667eea" />
                        <Text style={styles.forkBtnText}>Mi versión</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    exerciseCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    exerciseContentRow: {
        flex: 1,
    },
    exerciseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        marginRight: 8,
    },
    customBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#667eea15',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#667eea40',
    },
    customBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#667eea',
    },
    exerciseMuscle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 8,
    },
    techniqueContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    techniqueHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    techniqueTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#10B981',
    },
    techniqueIcon: {
        marginRight: 4,
    },
    techniqueTip: {
        fontSize: 11,
        color: '#64748b',
        marginLeft: 18,
        marginBottom: 2,
        lineHeight: 16,
    },
    techniqueMore: {
        fontSize: 11,
        color: '#94a3b8',
        marginLeft: 18,
        fontStyle: 'italic',
        marginTop: 2,
    },
    cardActions: {
        justifyContent: 'center',
        paddingLeft: 10,
        borderLeftWidth: 1,
        borderLeftColor: '#f1f5f9',
        marginLeft: 10,
    },
    actionBtn: {
        padding: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
    },
    forkBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
    },
    forkBtnText: {
        fontSize: 9,
        color: '#667eea',
        marginTop: 2,
        fontWeight: '600',
        textAlign: 'center',
        width: 45,
    },
});
