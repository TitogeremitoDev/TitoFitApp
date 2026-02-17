/**
 * ChatMessageAudioPlayer.jsx
 * Simplified inline audio player for voice messages in chat bubbles
 * Based on ChatAudioPlayer.jsx but without exercise name, transcription, or AI features
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { useAuth } from '../../../context/AuthContext';
import {
    EnhancedTouchable as TouchableOpacity,
} from '../../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';
const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

const ChatMessageAudioPlayer = ({ r2Key, duration: durationProp, isOwn }) => {
    const { token } = useAuth();
    const [audioUrl, setAudioUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [speedIndex, setSpeedIndex] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState((durationProp || 0) / 1000); // Convert ms to seconds

    const audioPlayer = useAudioPlayer(audioUrl);
    const progressBarWidth = useRef(0);

    // Sync time with player
    useEffect(() => {
        if (audioPlayer) {
            const interval = setInterval(() => {
                if (audioPlayer.playing) {
                    setCurrentTime(audioPlayer.currentTime || 0);
                }
                if (audioPlayer.duration && audioPlayer.duration > 0) {
                    setDuration(audioPlayer.duration);
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [audioPlayer]);

    // Apply speed when changed
    useEffect(() => {
        if (audioPlayer && audioUrl) {
            try {
                audioPlayer.setPlaybackRate(SPEED_OPTIONS[speedIndex]);
            } catch (e) {
                // Ignore
            }
        }
    }, [speedIndex, audioPlayer, audioUrl]);

    // Fetch signed URL from R2 key
    const loadAudio = async () => {
        if (audioUrl || loading || !r2Key) return;
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/chat/media-url`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ key: r2Key }),
            });
            const data = await res.json();
            if (data.success) {
                setAudioUrl(data.url);
            } else {
                console.error('[ChatMessageAudioPlayer] Error:', data.message);
            }
        } catch (err) {
            console.error('[ChatMessageAudioPlayer] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Toggle play/pause
    const togglePlayback = async () => {
        if (!audioUrl) {
            await loadAudio();
            return;
        }

        if (audioPlayer?.playing) {
            audioPlayer.pause();
        } else {
            audioPlayer?.play();
        }
    };

    // Auto-play when URL loads
    useEffect(() => {
        if (audioUrl && audioPlayer) {
            setTimeout(() => {
                try {
                    audioPlayer.play();
                } catch (e) {
                    // Ignore
                }
            }, 150);
        }
    }, [audioUrl]);

    const cycleSpeed = () => {
        setSpeedIndex((prev) => (prev + 1) % SPEED_OPTIONS.length);
    };

    const formatTime = (seconds) => {
        const s = Math.floor(seconds || 0);
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const isPlaying = audioPlayer?.playing;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const accentColor = isOwn ? '#fff' : '#8b5cf6';
    const trackBg = isOwn ? 'rgba(255,255,255,0.3)' : '#e2e8f0';
    const textColor = isOwn ? 'rgba(255,255,255,0.8)' : '#64748b';

    return (
        <View style={styles.container}>
            {/* Play/Pause */}
            <TouchableOpacity
                style={[styles.playBtn, { backgroundColor: isOwn ? 'rgba(255,255,255,0.25)' : '#8b5cf620' }]}
                onPress={togglePlayback}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator size={16} color={accentColor} />
                ) : (
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={accentColor} />
                )}
            </TouchableOpacity>

            {/* Progress + Time */}
            <View style={styles.progressSection}>
                <Pressable
                    style={styles.progressTouchable}
                    onLayout={(e) => {
                        progressBarWidth.current = e.nativeEvent.layout.width;
                    }}
                    onPress={(event) => {
                        const width = progressBarWidth.current;
                        if (!audioPlayer || !duration || duration <= 0 || !width) return;
                        const { locationX } = event.nativeEvent;
                        const seekRatio = Math.min(Math.max(locationX / width, 0), 1);
                        const seekTime = seekRatio * duration;
                        if (Number.isFinite(seekTime) && seekTime >= 0 && seekTime <= duration) {
                            try {
                                audioPlayer.seekTo(seekTime);
                                setCurrentTime(seekTime);
                            } catch (e) {
                                // Ignore seek error
                            }
                        }
                    }}
                >
                    <View style={[styles.progressBar, { backgroundColor: trackBg }]}>
                        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: accentColor }]} />
                        <View style={[styles.seekHandle, { left: `${progress}%`, backgroundColor: accentColor }]} />
                    </View>
                </Pressable>

                <View style={styles.bottomRow}>
                    <Text style={[styles.timeText, { color: textColor }]}>
                        {formatTime(currentTime)}/{formatTime(duration)}
                    </Text>
                    <TouchableOpacity style={[styles.speedBtn, { backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : '#f1f5f9' }]} onPress={cycleSpeed}>
                        <Text style={[styles.speedText, { color: accentColor }]}>{SPEED_OPTIONS[speedIndex]}x</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        gap: 10,
        minWidth: 200,
    },
    playBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressSection: {
        flex: 1,
    },
    progressTouchable: {
        paddingVertical: 4,
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        position: 'relative',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    seekHandle: {
        position: 'absolute',
        top: -3,
        width: 10,
        height: 10,
        borderRadius: 5,
        marginLeft: -5,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    timeText: {
        fontSize: 10,
        fontWeight: '500',
    },
    speedBtn: {
        paddingVertical: 1,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    speedText: {
        fontSize: 10,
        fontWeight: '600',
    },
});

export default ChatMessageAudioPlayer;
