import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';

/**
 * ChurnIndicator - Visual risk indicator (dot) on client avatar
 *
 * Props:
 * - riskLevel: 'none' | 'medium' | 'high'
 * - size: number (default 12)
 */
export default function ChurnIndicator({ riskLevel, size = 12 }) {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        let animation = null;
        if (riskLevel === 'high') {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.4,
                        duration: 700,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: Platform.OS !== 'web',
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 700,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: Platform.OS !== 'web',
                    }),
                ])
            );
            animation.start();
        } else {
            pulseAnim.setValue(1);
        }
        return () => { if (animation) animation.stop(); };
    }, [riskLevel]);

    if (riskLevel === 'none') return null;

    const colors = {
        medium: '#f59e0b', // Orange
        high: '#ef4444',   // Red
    };

    return (
        <Animated.View
            style={[
                styles.indicator,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: colors[riskLevel] || colors.medium,
                    transform: [{ scale: riskLevel === 'high' ? pulseAnim : 1 }],
                },
            ]}
        />
    );
}

const styles = StyleSheet.create({
    indicator: {
        position: 'absolute',
        top: -2,
        right: -2,
        borderWidth: 2,
        borderColor: '#fff',
        zIndex: 10,
    },
});
