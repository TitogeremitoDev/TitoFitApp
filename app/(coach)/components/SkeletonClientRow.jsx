import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';

const SkeletonClientRow = () => {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: Platform.OS !== 'web',
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: Platform.OS !== 'web',
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    return (
        <View style={styles.card}>
            {/* Identity */}
            <View style={styles.identityZone}>
                <Animated.View style={[styles.avatar, { opacity }]} />
                <View style={styles.textGroup}>
                    <Animated.View style={[styles.line, { width: '80%', height: 14, opacity }]} />
                    <Animated.View style={[styles.line, { width: '50%', height: 10, marginTop: 6, opacity }]} />
                </View>
            </View>

            {/* Metrics */}
            <View style={styles.metricsZone}>
                <Animated.View style={[styles.line, { width: '100%', height: 10, marginBottom: 8, opacity }]} />
                <Animated.View style={[styles.line, { width: '100%', height: 10, opacity }]} />
            </View>

            {/* Status */}
            <View style={styles.statusZone}>
                <Animated.View style={[styles.line, { width: '60%', height: 12, opacity }]} />
            </View>

            {/* Actions */}
            <View style={styles.actionsZone}>
                <Animated.View style={[styles.actionBtn, { opacity }]} />
                <Animated.View style={[styles.actionBtn, { opacity }]} />
                <Animated.View style={[styles.actionBtn, { opacity }]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    identityZone: {
        flex: 3,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#cbd5e1',
    },
    textGroup: {
        flex: 1,
    },
    line: {
        backgroundColor: '#cbd5e1',
        borderRadius: 4,
    },
    metricsZone: {
        flex: 2,
        paddingHorizontal: 16,
    },
    statusZone: {
        flex: 2,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    actionsZone: {
        flex: 1.5,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#cbd5e1',
    },
});

export default SkeletonClientRow;
