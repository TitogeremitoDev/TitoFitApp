import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { useStableWindowDimensions } from '../../../hooks/useStableBreakpoint';
import { Ionicons } from '@expo/vector-icons';

const MarketingControls = ({
    config,
    setConfig,
    onExport,
    isExporting
}) => {
    const { width } = useStableWindowDimensions();
    const isMobile = width < 600;

    const updateConfig = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <View style={[styles.container, isMobile && styles.containerMobile]}>
            {/* Single row layout */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Template Toggle */}
                <View style={styles.inlineGroup}>
                    <TouchableOpacity
                        style={[styles.miniChip, config.templateId === 'transformation' && styles.miniChipActive]}
                        onPress={() => updateConfig('templateId', 'transformation')}
                    >
                        <Ionicons name="git-compare" size={14} color={config.templateId === 'transformation' ? '#000' : '#94a3b8'} />
                        {!isMobile && <Text style={[styles.miniChipText, config.templateId === 'transformation' && styles.miniChipTextActive]}>Split</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.miniChip, config.templateId === 'showcase' && styles.miniChipActive]}
                        onPress={() => updateConfig('templateId', 'showcase')}
                    >
                        <Ionicons name="image" size={14} color={config.templateId === 'showcase' ? '#000' : '#94a3b8'} />
                        {!isMobile && <Text style={[styles.miniChipText, config.templateId === 'showcase' && styles.miniChipTextActive]}>Solo</Text>}
                    </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                {/* Goal Toggle */}
                <View style={styles.inlineGroup}>
                    <TouchableOpacity
                        style={[styles.miniChip, config.goal === 'loss' && { backgroundColor: '#22d3ee', borderColor: '#22d3ee' }]}
                        onPress={() => updateConfig('goal', 'loss')}
                    >
                        <Ionicons name="trending-down" size={14} color={config.goal === 'loss' ? '#000' : '#94a3b8'} />
                        {!isMobile && <Text style={[styles.miniChipText, config.goal === 'loss' && { color: '#000' }]}>Cut</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.miniChip, config.goal === 'gain' && { backgroundColor: '#4ade80', borderColor: '#4ade80' }]}
                        onPress={() => updateConfig('goal', 'gain')}
                    >
                        <Ionicons name="trending-up" size={14} color={config.goal === 'gain' ? '#000' : '#94a3b8'} />
                        {!isMobile && <Text style={[styles.miniChipText, config.goal === 'gain' && { color: '#000' }]}>Bulk</Text>}
                    </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                {/* Quick Toggles */}
                <View style={styles.inlineGroup}>
                    <TouchableOpacity
                        style={[styles.iconBtn, config.privacy && styles.iconBtnActive]}
                        onPress={() => updateConfig('privacy', !config.privacy)}
                    >
                        <Ionicons name={config.privacy ? "eye-off" : "eye"} size={16} color={config.privacy ? '#fff' : '#64748b'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.iconBtn, config.stats && styles.iconBtnActive]}
                        onPress={() => updateConfig('stats', !config.stats)}
                    >
                        <Ionicons name="stats-chart" size={16} color={config.stats ? '#fff' : '#64748b'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.iconBtn, config.branding && styles.iconBtnActive]}
                        onPress={() => updateConfig('branding', !config.branding)}
                    >
                        <Ionicons name="pricetag" size={16} color={config.branding ? '#fff' : '#64748b'} />
                    </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                {/* Weight Input */}
                {config.stats && (
                    <View style={styles.weightInputContainer}>
                        <input
                            type="text"
                            value={config.delta || ''}
                            onChange={(e) => updateConfig('delta', e.target.value)}
                            placeholder="-5 kg"
                            style={{
                                width: 60,
                                backgroundColor: '#0f0f13',
                                border: '1px solid #333',
                                borderRadius: 6,
                                color: '#fff',
                                fontSize: 12,
                                padding: '4px 8px',
                                textAlign: 'center',
                                outline: 'none',
                            }}
                        />
                    </View>
                )}
            </ScrollView>

            {/* Export Button - Always visible */}
            <TouchableOpacity
                style={styles.exportBtn}
                onPress={onExport}
                disabled={isExporting}
            >
                <Ionicons name="share-outline" size={18} color="#000" />
                {!isMobile && <Text style={styles.exportText}>{isExporting ? '...' : 'Compartir'}</Text>}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1a1a1f',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderTopWidth: 1,
        borderTopColor: '#2a2a35',
        // Account for Android nav buttons
        paddingBottom: Platform.OS === 'android' ? 12 : 8,
    },
    containerMobile: {
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    scrollContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    inlineGroup: {
        flexDirection: 'row',
        gap: 4,
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: '#333',
        marginHorizontal: 4,
    },
    miniChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: '#0f0f13',
        borderWidth: 1,
        borderColor: '#333',
        gap: 4,
    },
    miniChipActive: {
        backgroundColor: '#fff',
        borderColor: '#fff',
    },
    miniChipText: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: '600',
    },
    miniChipTextActive: {
        color: '#000',
    },
    iconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#0f0f13',
        borderWidth: 1,
        borderColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconBtnActive: {
        backgroundColor: '#22d3ee',
        borderColor: '#22d3ee',
    },
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginLeft: 12,
        gap: 6,
    },
    exportText: {
        color: '#000',
        fontWeight: '700',
        fontSize: 12,
    },
    weightInputContainer: {
        justifyContent: 'center',
    },
});

export default MarketingControls;
