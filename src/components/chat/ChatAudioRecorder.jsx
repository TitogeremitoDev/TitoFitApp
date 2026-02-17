/**
 * ChatAudioRecorder.jsx
 * WhatsApp-style voice recording bar that replaces the input bar during recording
 * Tap mic to start → shows timer + cancel/send → tap send to finish
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import {
    EnhancedTouchable as TouchableOpacity,
} from '../../../components/ui';

const ChatAudioRecorder = ({ onRecordingComplete, onCancel, theme, insets }) => {
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const [phase, setPhase] = useState('starting'); // 'starting' | 'recording' | 'stopping'
    const [recordingTime, setRecordingTime] = useState(0);
    const timerRef = useRef(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Start recording immediately on mount
    useEffect(() => {
        startRecording();
        return () => {
            clearInterval(timerRef.current);
        };
    }, []);

    // Pulsing dot animation
    useEffect(() => {
        if (phase === 'recording') {
            const loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 0.3,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );
            loop.start();
            return () => loop.stop();
        }
    }, [phase]);

    const startRecording = async () => {
        try {
            const status = await AudioModule.requestRecordingPermissionsAsync();
            if (!status.granted) {
                Alert.alert('Permiso requerido', 'Necesitamos acceso al micrófono');
                onCancel();
                return;
            }

            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });

            await recorder.prepareToRecordAsync();
            recorder.record();
            setPhase('recording');
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(t => t + 1);
            }, 1000);
        } catch (err) {
            console.error('[ChatAudioRecorder] Error starting:', err);
            Alert.alert('Error', 'No se pudo iniciar la grabación');
            onCancel();
        }
    };

    const stopAndSend = async () => {
        if (phase !== 'recording' || !recorder.isRecording) return;
        setPhase('stopping');
        clearInterval(timerRef.current);

        try {
            await recorder.stop();
            const uri = recorder.uri;
            const durationMs = recordingTime * 1000;

            if (durationMs < 500) {
                Alert.alert('Muy corto', 'Mantén presionado para grabar un mensaje más largo');
                onCancel();
                return;
            }

            onRecordingComplete(uri, durationMs);
        } catch (err) {
            console.error('[ChatAudioRecorder] Error stopping:', err);
            Alert.alert('Error', 'No se pudo guardar la grabación');
            onCancel();
        }
    };

    const cancelRecording = async () => {
        clearInterval(timerRef.current);
        try {
            if (recorder.isRecording) {
                await recorder.stop();
            }
        } catch (e) {
            // Ignore stop errors on cancel
        }
        onCancel();
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const primaryColor = theme?.primary || '#8b5cf6';

    return (
        <View style={[styles.container, {
            backgroundColor: theme?.cardBackground || '#fff',
            borderTopColor: theme?.border || '#e2e8f0',
            paddingBottom: Math.max(insets?.bottom || 0, 12),
        }]}>
            {/* Cancel Button */}
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelRecording}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>

            {/* Recording indicator */}
            <View style={styles.recordingInfo}>
                <Animated.View style={[styles.redDot, { opacity: pulseAnim }]} />
                <Text style={[styles.timeText, { color: theme?.text || '#1e293b' }]}>
                    {formatTime(recordingTime)}
                </Text>
                <Text style={[styles.recordingLabel, { color: theme?.textSecondary || '#64748b' }]}>
                    Grabando...
                </Text>
            </View>

            {/* Send Button */}
            <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: primaryColor }]}
                onPress={stopAndSend}
                disabled={phase !== 'recording'}
            >
                <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
        gap: 12,
    },
    cancelBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordingInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    redDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
    },
    timeText: {
        fontSize: 18,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    recordingLabel: {
        fontSize: 14,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ChatAudioRecorder;
