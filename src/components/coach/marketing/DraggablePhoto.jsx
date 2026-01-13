import React, { useRef } from 'react';
import { PanResponder, Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const previewScale = Math.min((SCREEN_WIDTH - 20) / 1080, (SCREEN_HEIGHT - 320) / 1920);

const CANVAS_HEIGHT = 1920;

const DraggablePhoto = ({
    uri,
    zoom = 1, // Controlled from parent
}) => {
    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

    const scaleCompensation = 1 / previewScale;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                pan.setOffset({
                    x: pan.x._value,
                    y: pan.y._value
                });
                pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: (evt, gestureState) => {
                pan.x.setValue(gestureState.dx * scaleCompensation);
                pan.y.setValue(gestureState.dy * scaleCompensation);
            },
            onPanResponderRelease: () => {
                pan.flattenOffset();
            }
        })
    ).current;

    // Base image size (portrait photo)
    const baseHeight = CANVAS_HEIGHT * 1.2;
    const baseWidth = baseHeight * 0.75;

    // Apply zoom from prop
    const imageHeight = baseHeight * zoom;
    const imageWidth = baseWidth * zoom;

    return (
        <View style={styles.container} {...panResponder.panHandlers}>
            <Animated.Image
                source={{ uri }}
                style={{
                    width: imageWidth,
                    height: imageHeight,
                    transform: [
                        { translateX: pan.x },
                        { translateY: pan.y },
                    ],
                }}
                resizeMode="cover"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default DraggablePhoto;
