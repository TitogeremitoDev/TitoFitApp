import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    PanResponder,
    Animated,
    Image,
    Platform,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import Slider from '@react-native-community/slider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CROP_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.8;

export const ImageCropper = ({ visible, imageUri, onCancel, onCrop }) => {
    const [scale, setScale] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);

    // Animated values for smooth interaction
    const pan = useRef(new Animated.ValueXY()).current;

    // We keep track of the latest values for calculation
    const currentPan = useRef({ x: 0, y: 0 });
    const currentScale = useRef(1);

    // PanResponder for drag gestures
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                pan.setOffset({
                    x: currentPan.current.x,
                    y: currentPan.current.y
                });
                pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: Animated.event(
                [null, { dx: pan.x, dy: pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: () => {
                pan.flattenOffset();
                // Store limits will be checked here if we want to enforce boundaries
                // For now, simpler is better (let user move freely)
                currentPan.current.x = pan.x._value;
                currentPan.current.y = pan.y._value;
            }
        })
    ).current;

    const handleZoom = (val) => {
        setScale(val);
        currentScale.current = val;
    };

    const handleSave = async () => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            // 1. Calculate Crop Rect relative to the ORIGINAL image
            // We need the original image dimensions
            // Since we can't easily get them synchronously, we rely on the displayed logic
            // Ideally we would measure the Image view or fetch dimensions first.

            // To simplify: We'll take a snapshot or use simple math if we assume displayed size
            // But 'manipulateAsync' needs coordinates relative to the original image resolution.

            // Let's get original size
            Image.getSize(imageUri, async (origW, origH) => {
                try {
                    // Display Logic:
                    // The "Crop Area" is centered: CROP_SIZE x CROP_SIZE
                    // The Image is centered initially, then translated by (pan.x, pan.y) and scaled by scale.
                    // Initial displayed dimensions: contain or cover? 
                    // Let's assume we render image "contain" into the screen first, or specific size?

                    // Let's define: base displayed width/height (before zoom)
                    // If we fit width:
                    const fitRatio = Math.min(SCREEN_WIDTH / origW, SCREEN_HEIGHT / origH);
                    const displayW = origW * fitRatio; // This is how big it would be 
                    // But actually, we usually want to start 'covering' the crop area.

                    // EASIER APPROACH: 
                    // Crop visible area.
                    // The crop window is fixed at center.
                    // The image moves.

                    // rect visible on screen (relative to Image View center):
                    // cropLeft = (ScreenCenterX - CropSize/2) - (ImageCenterX + PanX) 
                    // NO, this math is hard to get robust cross-device without glitches.

                    // ALTERNATIVE: 
                    // Just accept the user's pan/zoom and map it.

                    // Let's rely on standard logic:
                    // cropX = ( (VisibleCenterX - ImageCenterX) / Scale ) + (OrigWidth/2) - (CropWidth/Scale/2)
                    // ... complicated.

                    // ROBUST APPROACH:
                    // 1. Just fix the image preview to a known frame (e.g. CROP_SIZE).
                    // 2. User scales image *inside* that frame? No, Image needs to be bigger.

                    // Let's use a simplified logical model:
                    // Image is rendered at 'displayW' x 'displayH'.
                    // It is shifted by 'x' and 'y' (from center) and scaled by 's'.
                    // The "Window" is at center, size CROP_SIZE.

                    // Let's calculate the "visible rectangle" in displayed units.
                    // Center of Crop Window is (0,0) relative to screen center.
                    // Center of Image is (panX, panY) relative to screen center.

                    // Vector from ImageCenter to WindowCenter: V = (-panX, -panY).
                    // This vector V is in "scaled pixels".
                    // In "unscaled pixels", it is V/s.

                    // So, center of crop window relative to image center (unscaled) is (-panX/s, -panY/s).
                    // The crop window size in "unscaled pixels" is CROP_SIZE/s.

                    // So, the TopLeft of the crop window relative to Image Center (unscaled) is:
                    // X = (-panX/s) - (CROP_SIZE/s)/2
                    // Y = (-panY/s) - (CROP_SIZE/s)/2

                    // Now map Image Center to (0,0) of the original coordinate system?
                    // Original Image has center at (origW/2, origH/2).

                    // The image is displayed inside a SCREEN_WIDTH x SCREEN_WIDTH container with resizeMode: 'contain'.
                    // This means the image scales uniformly to fit within that square while maintaining aspect ratio.
                    //
                    // For resizeMode: 'contain' within a square (SCREEN_WIDTH x SCREEN_WIDTH):
                    // - The image scales to fit the SMALLER dimension constraint
                    // - If origW > origH (landscape): width fills container, height is smaller
                    // - If origH > origW (portrait): height fills container, width is smaller

                    const containerSize = SCREEN_WIDTH; // The square container size
                    const imageAspect = origW / origH;

                    let baseWidth, baseHeight;
                    if (imageAspect >= 1) {
                        // Landscape or square image - width fills container
                        baseWidth = containerSize;
                        baseHeight = containerSize / imageAspect;
                    } else {
                        // Portrait image - height fills container
                        baseHeight = containerSize;
                        baseWidth = containerSize * imageAspect;
                    }

                    // Conversion ratio from displayed pixels to original pixels
                    const ratioX = origW / baseWidth;
                    const ratioY = origH / baseHeight;
                    // Since we maintain aspect ratio, ratioX === ratioY, but we use both for clarity
                    const ratio = ratioX; // They should be equal

                    // The crop window size in "unscaled" displayed pixels (before user zoom)
                    const cropSizeUnscaled = CROP_SIZE / currentScale.current;

                    // User's pan values are offsets from center, in scaled pixels
                    // We need to convert to unscaled pixels, then to original image coordinates
                    // 
                    // The center of the visible crop window (screen center) maps to:
                    // Image position = -(pan) since positive pan moves image right, which means crop window moves left on image
                    const offsetX = -currentPan.current.x / currentScale.current;
                    const offsetY = -currentPan.current.y / currentScale.current;

                    // Calculate top-left of crop window relative to displayed image center
                    const cropLeftFromCenter = offsetX - (cropSizeUnscaled / 2);
                    const cropTopFromCenter = offsetY - (cropSizeUnscaled / 2);

                    // Convert to coordinates relative to top-left of displayed image
                    const cropLeftBase = (baseWidth / 2) + cropLeftFromCenter;
                    const cropTopBase = (baseHeight / 2) + cropTopFromCenter;

                    // Convert to original image pixel coordinates
                    const finalX = cropLeftBase * ratio;
                    const finalY = cropTopBase * ratio;
                    const finalW = cropSizeUnscaled * ratio;
                    const finalH = cropSizeUnscaled * ratio;

                    // Validate
                    const actions = [];
                    // We must clamp or fill if out of bounds?
                    // manip works best if we pass valid rects.

                    const cropRect = {
                        originX: Math.max(0, finalX),
                        originY: Math.max(0, finalY),
                        width: Math.min(origW - Math.max(0, finalX), finalW),
                        height: Math.min(origH - Math.max(0, finalY), finalH)
                    };

                    // Only crop if valid
                    if (cropRect.width > 0 && cropRect.height > 0) {
                        actions.push({ crop: cropRect });
                    }

                    // Resize to 800x800 for consistency
                    actions.push({ resize: { width: 800, height: 800 } });

                    const result = await manipulateAsync(
                        imageUri,
                        actions,
                        { compress: 0.8, format: SaveFormat.JPEG }
                    );

                    onCrop(result.uri);

                } catch (e) {
                    console.error("Calculation Error", e);
                    Alert.alert("Error", "No se pudo recortar la imagen.");
                    setIsProcessing(false);
                }
            }, (err) => {
                console.error("GetSize Error", err);
                Alert.alert("Error", "No se pudo cargar la imagen.");
                setIsProcessing(false);
            });

        } catch (error) {
            console.error(error);
            setIsProcessing(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={true} animationType="slide" onRequestClose={onCancel}>
            <View style={styles.container}>
                <View style={[styles.cropArea, { width: CROP_SIZE, height: CROP_SIZE }]}>
                    <Animated.View
                        {...panResponder.panHandlers}
                        style={{
                            transform: [
                                { translateX: pan.x },
                                { translateY: pan.y },
                                { scale: scale }
                            ],
                            width: SCREEN_WIDTH,
                            // Height will be determined by image aspect ratio but view is constrained
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Image
                            source={{ uri: imageUri }}
                            style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH, resizeMode: 'contain' }}
                        // Warning: resizeMode contain with square size might skew aspect ratio calculation
                        // Better to use adjustResize or explicit calculation.
                        // For simplicity, we assume square images usually or centered fit.
                        // Actually, let's allow 'contain' behavior but better style:
                        // We set generic style and let user move it around.
                        />
                    </Animated.View>
                </View>

                {/* Overlay Mask (Inverse) - Just visual borders */}
                <View style={styles.maskContainer} pointerEvents="none">
                    <View style={[styles.maskFrame, { width: CROP_SIZE, height: CROP_SIZE, borderRadius: CROP_SIZE / 2 }]} />
                </View>

                <View style={styles.controls}>
                    <Text style={styles.instruct}>Desliza y pellizca para ajustar</Text>
                    <Slider
                        style={{ width: '80%', height: 40 }}
                        minimumValue={1}
                        maximumValue={3}
                        minimumTrackTintColor="#3b82f6"
                        maximumTrackTintColor="#ffffff"
                        onValueChange={handleZoom}
                        value={scale}
                    />

                    <View style={styles.buttons}>
                        <TouchableOpacity onPress={onCancel} style={styles.btnCancel}>
                            <Text style={styles.btnTextCancel}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSave} style={styles.btnSave}>
                            {isProcessing ? (
                                <Text style={styles.btnText}>Procesando...</Text>
                            ) : (
                                <Text style={styles.btnText}>Guardar Foto</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cropArea: {
        borderColor: '#fff',
        borderWidth: 1,
        overflow: 'visible', // Visible so we can see image outside crop area while dragging
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1
    },
    maskContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    maskFrame: {
        borderWidth: 2,
        borderColor: '#3b82f6', // Premium Blue
        backgroundColor: 'transparent',
    },
    controls: {
        position: 'absolute',
        bottom: 50,
        width: '100%',
        alignItems: 'center',
        zIndex: 10
    },
    instruct: {
        color: '#fff',
        marginBottom: 20,
        fontSize: 14
    },
    buttons: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 20
    },
    btnCancel: {
        paddingVertical: 12,
        paddingHorizontal: 30,
        backgroundColor: '#333',
        borderRadius: 25
    },
    btnSave: {
        paddingVertical: 12,
        paddingHorizontal: 30,
        backgroundColor: '#3b82f6',
        borderRadius: 25
    },
    btnText: {
        color: '#fff',
        fontWeight: 'bold'
    },
    btnTextCancel: {
        color: '#ccc'
    }
});
