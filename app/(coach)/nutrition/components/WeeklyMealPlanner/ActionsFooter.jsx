import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, TextInput, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * ACTIONS FOOTER
 * Sticky footer for main plan actions: Draft, Save Template, Activate.
 * Now includes Plan Name input.
 */
export default function ActionsFooter({
    planName,
    onChangePlanName,
    isSaving,
    isActivating,
    onSaveDraft,
    onSaveTemplate,
    onActivate
}) {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    return (
        <View style={styles.footerContainer}>
            <View style={styles.footerContent}>

                {/* 1. Name Input removed - now in Header */}
                <View style={{ flex: 1 }} />

                {/* 2. Actions (Right) */}
                <View style={styles.actionsRow}>

                    {/* Botón: Borrador */}
                    <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={onSaveDraft}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color="#64748b" />
                        ) : (
                            <Ionicons name="cloud-upload-outline" size={18} color="#64748b" />
                        )}
                        {isDesktop && (
                            <Text style={styles.secondaryBtnText}>
                                {isSaving ? 'Guardando...' : 'Borrador'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Botón: Guardar Plantilla */}
                    <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={onSaveTemplate}
                    >
                        <Ionicons name="library-outline" size={18} color="#64748b" />
                        {isDesktop && <Text style={styles.secondaryBtnText}>Plantilla</Text>}
                    </TouchableOpacity>

                    {/* Botón: Activar Plan */}
                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={onActivate}
                        disabled={isActivating}
                    >
                        {isActivating ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="rocket-outline" size={18} color="#fff" />
                        )}
                        <Text style={styles.primaryBtnText}>
                            {isActivating ? 'Activando...' : 'Activar Plan'}
                        </Text>
                    </TouchableOpacity>

                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    footerContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingBottom: Platform.OS === 'ios' ? 24 : 16, // Safe area bottom
        paddingTop: 16,
        paddingHorizontal: 24,
        zIndex: 50,
        ...Platform.select({
            web: { boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)' },
            default: { elevation: 8 }
        })
    },
    footerContent: {
        maxWidth: 1200, // Max width constraint
        alignSelf: 'center',
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    nameInputContainer: {
        flex: 1,
        marginRight: 24,
        maxWidth: 300,
    },
    inputLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    nameInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        color: '#1e293b',
        fontWeight: '600',
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    secondaryBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: '#22c55e', // Green for activation
        ...Platform.select({
            web: { boxShadow: '0 4px 6px -1px rgba(34, 197, 94, 0.2)' },
            default: { elevation: 2 }
        })
    },
    primaryBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },
});
