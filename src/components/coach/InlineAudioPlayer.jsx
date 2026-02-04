import React, { useState, useEffect } from 'react';
import { View, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app/api';

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

/**
 * Compact inline audio player for coach progress view
 */
const InlineAudioPlayer = ({ feedback, onViewed }) => {
    const { token } = useAuth();
    const [audioUrl, setAudioUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [speedIndex, setSpeedIndex] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const audioPlayer = useAudioPlayer(audioUrl);

    // Sync state with player
    useEffect(() => {
        if (audioPlayer) {
            const interval = setInterval(() => {
                if (audioPlayer.playing) {
                    setCurrentTime(audioPlayer.currentTime || 0);
                }
                if (audioPlayer.duration && audioPlayer.duration > 0) {
                    setDuration(audioPlayer.duration);
                }
            }, 200);
            return () => clearInterval(interval);
        }
    }, [audioPlayer]);

    // Apply speed when it changes
    useEffect(() => {
        if (audioPlayer && audioUrl) {
            audioPlayer.setPlaybackRate(SPEED_OPTIONS[speedIndex]);
        }
    }, [speedIndex, audioPlayer, audioUrl]);

    // Fetch audio URL when needed
    const loadAudioUrl = async () => {
        if (audioUrl || loading) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/api/video-feedback/${feedback._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Error al cargar audio');

            const data = await response.json();
            setAudioUrl(data.mediaUrl);
            if (data.duration) setDuration(data.duration / 1000); // Convert ms to seconds

            if (onViewed) onViewed(feedback._id);

        } catch (err) {
            console.error('[InlineAudioPlayer] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Toggle play/pause
    const togglePlayback = async () => {
        if (!audioUrl) {
            await loadAudioUrl();
            // Will auto-play when URL loads
            return;
        }

        if (audioPlayer.playing) {
            audioPlayer.pause();
        } else {
            audioPlayer.play();
        }
    };

    // Auto-play when URL loads
    useEffect(() => {
        if (audioUrl && audioPlayer) {
            setTimeout(() => {
                audioPlayer.play();
            }, 100);
        }
    }, [audioUrl]);

    // Cycle through speeds
    const cycleSpeed = () => {
        setSpeedIndex((prev) => (prev + 1) % SPEED_OPTIONS.length);
    };

    // Format time (seconds to mm:ss)
    const formatTime = (seconds) => {
        const s = Math.floor(seconds || 0);
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const isPending = !feedback.viewedByCoach && !feedback.coachResponse?.respondedAt;
    const isPlaying = audioPlayer?.playing;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const currentSpeed = SPEED_OPTIONS[speedIndex];

    return (
        <View style={styles.container}>
            {/* Play/Pause button */}
            <Pressable
                style={[
                    styles.playButton,
                    isPending && !audioUrl && styles.playButtonPending,
                    isPlaying && styles.playButtonPlaying
                ]}
                onPress={togglePlayback}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator size={10} color={isPending ? '#fff' : '#4361ee'} />
                ) : (
                    <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={10}
                        color={isPending && !audioUrl ? '#fff' : isPlaying ? '#fff' : '#4361ee'}
                    />
                )}
            </Pressable>

            {/* Progress bar */}
            <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>

            {/* Time display */}
            <Text style={styles.timeText}>
                {formatTime(currentTime)}/{formatTime(duration)}
            </Text>

            {/* Speed button */}
            {audioUrl && (
                <Pressable style={styles.speedButton} onPress={cycleSpeed}>
                    <Text style={styles.speedText}>{currentSpeed}x</Text>
                </Pressable>
            )}

            {error && (
                <Ionicons name="alert-circle" size={10} color="#ef4444" />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 3,
        paddingHorizontal: 6,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        marginTop: 4,
        height: 24,
    },
    playButton: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#e0e7ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButtonPending: {
        backgroundColor: '#4361ee',
    },
    playButtonPlaying: {
        backgroundColor: '#22c55e',
    },
    progressBar: {
        flex: 1,
        height: 3,
        backgroundColor: '#cbd5e1',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#4361ee',
        borderRadius: 2,
    },
    timeText: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: '500',
        minWidth: 42,
        textAlign: 'center',
    },
    speedButton: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        backgroundColor: '#e0e7ff',
        borderRadius: 4,
    },
    speedText: {
        fontSize: 8,
        color: '#4361ee',
        fontWeight: '600',
    },
});

export default InlineAudioPlayer;
