import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Video from 'react-native-video';

// Simple reusable video player for previews
export default function VideoPreviewPlayer({ uri, style }) {
    if (!uri) return null;

    if (Platform.OS === 'web') {
        return (
            <video
                src={uri}
                controls
                style={{
                    width: '100%',
                    height: '100%',
                    maxHeight: 300,
                    borderRadius: 12,
                    objectFit: 'contain',
                    ...style
                }}
            />
        );
    }

    return (
        <Video
            source={{ uri }}
            style={[styles.video, style]}
            controls={true}
            resizeMode="contain"
            paused={true}
        />
    );
}

const styles = StyleSheet.create({
    video: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        borderRadius: 12,
    }
});
