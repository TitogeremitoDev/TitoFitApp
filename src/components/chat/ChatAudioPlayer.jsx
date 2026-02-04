/**
 * ChatAudioPlayer.jsx
 * WhatsApp-style inline audio player for chat messages
 * Plays audio directly without opening any modal
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';
const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

/**
 * Inline audio player for chat - plays audio directly like WhatsApp
 */
const ChatAudioPlayer = ({
    feedbackId,
    exerciseName,
    setNumber,
    transcription,
    summary,
    onTranscriptionPress
}) => {
    const { token } = useAuth();
    const [audioUrl, setAudioUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [speedIndex, setSpeedIndex] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showTranscription, setShowTranscription] = useState(false);
    const [transcriptionData, setTranscriptionData] = useState({ text: transcription, summary });

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
                console.warn('Could not set playback rate:', e);
            }
        }
    }, [speedIndex, audioPlayer, audioUrl]);

    // Fetch audio URL
    const loadAudio = async () => {
        if (audioUrl || loading || !feedbackId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/api/video-feedback/${feedbackId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Error al cargar audio');

            const data = await response.json();
            setAudioUrl(data.mediaUrl);
            if (data.duration) setDuration(data.duration / 1000);

            // Update transcription data if available
            if (data.transcription || data.summary) {
                setTranscriptionData({
                    text: data.transcription,
                    summary: data.summary
                });
            }

        } catch (err) {
            console.error('[ChatAudioPlayer] Error:', err);
            setError(err.message);
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
                    console.warn('Could not auto-play:', e);
                }
            }, 150);
        }
    }, [audioUrl]);

    // Cycle speed
    const cycleSpeed = () => {
        setSpeedIndex((prev) => (prev + 1) % SPEED_OPTIONS.length);
    };

    // Format time
    const formatTime = (seconds) => {
        const s = Math.floor(seconds || 0);
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const isPlaying = audioPlayer?.playing;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const currentSpeed = SPEED_OPTIONS[speedIndex];
    const hasTranscription = transcriptionData.text || transcriptionData.summary;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={[styles.micIcon, isPlaying && styles.micIconPlaying]}>
                    <Ionicons name="mic" size={18} color="#fff" />
                </View>
                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={1}>
                        {exerciseName || 'Audio'}
                    </Text>
                    <Text style={styles.subtitle}>Serie {setNumber || 1}</Text>
                </View>
            </View>

            {/* Seekable Progress Bar */}
            <View style={styles.progressRow}>
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
                                console.warn('[ChatAudioPlayer] Seek error:', e);
                            }
                        }
                    }}
                >
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
                        {/* Seek Handle */}
                        <View style={[styles.seekHandle, { left: `${progress}%` }]} />
                    </View>
                </Pressable>
                <Text style={styles.timeText}>
                    {formatTime(currentTime)}/{formatTime(duration)}
                </Text>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                {/* Play/Pause Button */}
                <TouchableOpacity
                    style={[styles.playBtn, isPlaying && styles.playBtnActive]}
                    onPress={togglePlayback}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator size={16} color="#fff" />
                    ) : (
                        <Ionicons name={isPlaying ? "pause" : "play"} size={18} color="#fff" />
                    )}
                </TouchableOpacity>

                {/* Speed Control - always visible */}
                <TouchableOpacity style={styles.speedBtn} onPress={cycleSpeed}>
                    <Text style={styles.speedText}>{currentSpeed}x</Text>
                </TouchableOpacity>

                {/* AI Transcription Toggle - always visible */}
                <TouchableOpacity
                    style={[styles.aiBtn, showTranscription && styles.aiBtnActive]}
                    onPress={() => setShowTranscription(!showTranscription)}
                >
                    <Ionicons name="sparkles" size={14} color={showTranscription ? "#fff" : "#8b5cf6"} />
                    <Text style={[styles.aiText, showTranscription && styles.aiTextActive]}>IA</Text>
                </TouchableOpacity>

                {error && (
                    <TouchableOpacity style={styles.errorBtn} onPress={loadAudio}>
                        <Ionicons name="refresh" size={14} color="#ef4444" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Transcription Panel */}
            {showTranscription && (
                <View style={styles.transcriptionPanel}>
                    {hasTranscription ? (
                        <>
                            {transcriptionData.summary && (
                                <View style={styles.summaryBox}>
                                    <Text style={styles.summaryLabel}>RESUMEN</Text>
                                    <Text style={styles.summaryText}>{transcriptionData.summary}</Text>
                                </View>
                            )}
                            {transcriptionData.text && (
                                <View style={styles.fullTextBox}>
                                    <Text style={styles.fullTextLabel}>TRANSCRIPCIÓN</Text>
                                    <Text style={styles.fullText}>{transcriptionData.text}</Text>
                                </View>
                            )}
                        </>
                    ) : (
                        <View style={styles.noTranscription}>
                            <Ionicons name="sparkles-outline" size={24} color="#94a3b8" />
                            <Text style={styles.noTranscriptionText}>
                                {audioUrl
                                    ? 'Transcripción no disponible para este audio'
                                    : 'Reproduce el audio para cargar la transcripción'
                                }
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 8,
        padding: 8,
        marginBottom: 4
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6
    },
    micIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8
    },
    micIconPlaying: {
        backgroundColor: '#22c55e'
    },
    info: {
        flex: 1
    },
    title: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1e293b'
    },
    subtitle: {
        fontSize: 10,
        color: '#64748b'
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6
    },
    progressTouchable: {
        flex: 1,
        paddingVertical: 4,
        marginRight: 6
    },
    progressBar: {
        height: 4,
        backgroundColor: '#e2e8f0',
        borderRadius: 2,
        position: 'relative'
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#8b5cf6',
        borderRadius: 2
    },
    seekHandle: {
        position: 'absolute',
        top: -2,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#8b5cf6',
        marginLeft: -4
    },
    timeText: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: '500',
        minWidth: 40
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    playBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 6
    },
    playBtnActive: {
        backgroundColor: '#22c55e'
    },
    speedBtn: {
        paddingVertical: 2,
        paddingHorizontal: 6,
        backgroundColor: '#f1f5f9',
        borderRadius: 4,
        marginRight: 4
    },
    speedText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#8b5cf6'
    },
    aiBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 2,
        paddingHorizontal: 6,
        backgroundColor: '#f1f5f9',
        borderRadius: 4,
        marginLeft: 'auto'
    },
    aiBtnActive: {
        backgroundColor: '#8b5cf6',
        borderColor: '#8b5cf6'
    },
    aiText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8b5cf6',
        marginLeft: 4
    },
    aiTextActive: {
        color: '#fff'
    },
    errorBtn: {
        padding: 8,
        marginLeft: 8
    },
    transcriptionPanel: {
        marginTop: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    summaryBox: {
        marginBottom: 10
    },
    summaryLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#8b5cf6',
        marginBottom: 6,
        letterSpacing: 0.5
    },
    summaryText: {
        fontSize: 13,
        color: '#334155',
        lineHeight: 20
    },
    fullTextBox: {
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0'
    },
    fullTextLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 6,
        letterSpacing: 0.5
    },
    fullText: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 18
    },
    noTranscription: {
        alignItems: 'center',
        paddingVertical: 16
    },
    noTranscriptionText: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 8
    }
});

export default ChatAudioPlayer;
