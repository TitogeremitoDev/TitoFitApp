import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import DraggableSticker from './DraggableSticker';
import DraggablePhoto from './DraggablePhoto';

const { width } = Dimensions.get('window');
// 9:16 Aspect Ratio Target
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;

const MarketingCanvas = forwardRef(({
    photos = [],
    templateId = 'transformation',
    config = {},
    goal = 'loss',
}, ref) => {
    const viewShotRef = useRef();
    const webContainerRef = useRef();

    useImperativeHandle(ref, () => ({
        capture: async () => {
            if (Platform.OS === 'web') {
                // Web: use html2canvas
                try {
                    const html2canvas = (await import('html2canvas')).default;
                    const canvas = await html2canvas(webContainerRef.current, {
                        backgroundColor: '#000',
                        scale: 2,
                        useCORS: true,
                    });
                    return canvas.toDataURL('image/jpeg', 0.95);
                } catch (error) {
                    console.log('html2canvas error:', error);
                    return null;
                }
            } else {
                // Native: use ViewShot
                if (viewShotRef.current) {
                    return await viewShotRef.current.capture();
                }
            }
            return null;
        }
    }));

    // Theme Config based on goal
    const theme = {
        primary: goal === 'gain' ? '#4ade80' : '#22d3ee', // Green (Gain) or Blue (Loss/General)
        accent: goal === 'gain' ? '#166534' : '#0e7490',
        bg: '#0f0f13',
        text: '#ffffff'
    };

    // Privacy Stickers
    const renderPrivacyStickers = () => {
        if (!config.privacy) return null;

        // Return 2 stickers for dual-anchor
        return (
            <>
                <DraggableSticker emoji="🦁" initialPosition={{ x: -width / 4, y: -100 }} />
                {templateId === 'transformation' && (
                    <DraggableSticker emoji="🔥" initialPosition={{ x: width / 4, y: -100 }} />
                )}
            </>
        );
    };

    // Branding Overlay
    const renderBranding = () => {
        if (!config.branding) return null;
        return (
            <View style={styles.brandingContainer}>
                <Image
                    source={require('../../../../assets/logo.png')}
                    style={styles.brandLogo}
                />
                <Text style={styles.brandText}>TotalGains</Text>
            </View>
        );
    };

    // --- TEMPLATES ---

    const renderTransformation = () => {
        const [photoBefore, photoAfter] = photos;
        return (
            <View style={styles.splitLayout}>
                <View style={styles.splitCol}>
                    <DraggablePhoto uri={photoBefore?.fullUrl} zoom={config.zoomLeft || 1} />
                    <View style={styles.labelBadge}>
                        <Text style={styles.labelText}>INICIO</Text>
                        <Text style={styles.dateText}>
                            {new Date(photoBefore?.takenAt).toLocaleDateString()}
                        </Text>
                    </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.splitCol}>
                    <DraggablePhoto uri={photoAfter?.fullUrl} zoom={config.zoomRight || 1} />
                    <View style={[styles.labelBadge, { backgroundColor: theme.primary }]}>
                        <Text style={[styles.labelText, { color: '#000' }]}>ACTUAL</Text>
                        <Text style={[styles.dateText, { color: '#000' }]}>
                            {new Date(photoAfter?.takenAt).toLocaleDateString()}
                        </Text>
                    </View>
                </View>

                {/* Stats Overlay centered */}
                {config.stats && (
                    <View style={styles.statsFloater}>
                        <LinearGradient
                            colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)']}
                            style={styles.statsGradient}
                        >
                            <Text style={[styles.deltaText, { color: goal === 'loss' ? '#4ade80' : '#f87171' }]}>
                                {config.delta || "- 5 kg"}
                            </Text>
                            <Text style={styles.deltaLabel}>CAMBIO TOTAL</Text>
                        </LinearGradient>
                    </View>
                )}
            </View>
        );
    };

    const renderShowcase = () => {
        const photo = photos[0];
        return (
            <View style={styles.fullLayout}>
                <DraggablePhoto uri={photo?.fullUrl} zoom={config.zoom || 1} />
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
                    style={styles.bottomGradient}
                >
                    <Text style={[styles.showcaseTitle, { color: theme.primary }]}>SEMANA 12</Text>
                    <Text style={styles.showcaseDate}>
                        {new Date(photo?.takenAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
                    </Text>
                </LinearGradient>
            </View>
        );
    };

    return (
        <View ref={webContainerRef} style={{ flex: 1 }}>
            <ViewShot
                ref={viewShotRef}
                options={{ format: "jpg", quality: 0.9 }}
                script={false} // Disable script execution during capture
                style={[styles.container, { backgroundColor: theme.bg }]}
                collapsable={false} // Prevent optimization issues
            >
                {templateId === 'transformation' ? renderTransformation() : renderShowcase()}

                {/* Overlays */}
                {renderBranding()}

                {/* Stickers Area - Absolute on top */}
                <View style={styles.stickersLayer} pointerEvents="box-none">
                    {renderPrivacyStickers()}
                </View>
            </ViewShot>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    stickersLayer: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
    },
    splitLayout: {
        flex: 1,
        flexDirection: 'row',
    },
    splitCol: {
        flex: 1,
        position: 'relative',
    },
    fullLayout: {
        flex: 1,
    },
    fullImage: {
        width: '100%',
        height: '100%',
    },
    divider: {
        width: 2,
        backgroundColor: '#000',
    },
    labelBadge: {
        position: 'absolute',
        top: 40,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
    },
    labelText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 28,
        letterSpacing: 3,
    },
    dateText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 18,
        marginTop: 4,
    },
    statsFloater: {
        position: 'absolute',
        bottom: 100,
        alignSelf: 'center',
        zIndex: 20,
    },
    statsGradient: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
    },
    deltaText: {
        fontSize: 56,
        fontWeight: '900',
    },
    deltaLabel: {
        color: '#fff',
        fontSize: 18,
        letterSpacing: 3,
        marginTop: 4,
    },
    brandingContainer: {
        position: 'absolute',
        bottom: 30,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        opacity: 0.8,
        zIndex: 10,
    },
    brandLogo: {
        width: 48,
        height: 48,
        marginRight: 16,
        tintColor: '#fff'
    },
    brandText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 28,
        letterSpacing: 2,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 200,
        justifyContent: 'flex-end',
        padding: 30,
        paddingBottom: 50,
    },
    showcaseTitle: {
        fontSize: 48,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    showcaseDate: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
        marginTop: 4,
    }
});

export default MarketingCanvas;
