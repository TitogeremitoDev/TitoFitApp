import React, { useRef, useState } from 'react';
import { PanResponder, Animated, Text, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Calculate the scale used by the marketing preview container
const previewScale = Math.min((SCREEN_WIDTH - 20) / 1080, (SCREEN_HEIGHT - 320) / 1920);

// Sizes relative to 1080x1920 canvas
const SIZES = [150, 200, 250];

const DraggableSticker = ({
    emoji = '🦁',
    initialPosition = { x: 0, y: 0 },
}) => {
    const pan = useRef(new Animated.ValueXY(initialPosition)).current;
    const [sizeIndex, setSizeIndex] = useState(0);
    const scale = useRef(new Animated.Value(1)).current;
    const lastTap = useRef(0);

    // Inverse scale to compensate for container scaling
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

                Animated.spring(scale, {
                    toValue: 1.1,
                    friction: 5,
                    useNativeDriver: true
                }).start();
            },
            onPanResponderMove: (evt, gestureState) => {
                // Compensate for the container scale
                pan.x.setValue(gestureState.dx * scaleCompensation);
                pan.y.setValue(gestureState.dy * scaleCompensation);
            },
            onPanResponderRelease: (evt, gestureState) => {
                pan.flattenOffset();

                const wasTap = Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5;
                const now = Date.now();

                if (wasTap && now - lastTap.current < 300) {
                    setSizeIndex((prev) => (prev + 1) % SIZES.length);
                }
                lastTap.current = now;

                Animated.spring(scale, {
                    toValue: 1,
                    friction: 5,
                    useNativeDriver: true
                }).start();
            }
        })
    ).current;

    const currentSize = SIZES[sizeIndex];

    return (
        <Animated.View
            style={{
                transform: [
                    { translateX: pan.x },
                    { translateY: pan.y },
                    { scale: scale }
                ],
                position: 'absolute',
                zIndex: 100,
            }}
            {...panResponder.panHandlers}
        >
            <Text
                style={{
                    fontSize: currentSize,
                    userSelect: 'none',
                    cursor: 'grab',
                }}
                selectable={false}
            >
                {emoji}
            </Text>
        </Animated.View>
    );
};

export default DraggableSticker;
