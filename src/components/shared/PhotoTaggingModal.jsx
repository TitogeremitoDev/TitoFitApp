// src/components/shared/PhotoTaggingModal.jsx
// ═══════════════════════════════════════════════════════════════════════════
// MODAL PARA ETIQUETAR FOTOS DE PROGRESO
// El usuario puede añadir: pose (frontal/lateral/espalda), visibilidad, etc.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Image,
    ScrollView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

const POSE_TAGS = [
    { id: 'front', label: 'Frontal', icon: '🧍', description: 'Vista de frente' },
    { id: 'side', label: 'Lateral', icon: '🚶', description: 'Vista de lado' },
    { id: 'back', label: 'Espalda', icon: '🔙', description: 'Vista trasera' },
];

const POSE_TYPES = [
    { id: 'pose:relaxed', label: 'Relajado', icon: '😌' },
    { id: 'pose:flex', label: 'Flexión', icon: '💪' },
    { id: 'pose:vacuum', label: 'Vacuum', icon: '🔥' },
];

const VISIBILITY_OPTIONS = [
    {
        id: 'coach_only',
        label: 'Solo mi coach',
        icon: 'eye',
        color: '#3b82f6',
        description: 'Solo tu entrenador verá esta foto'
    },
    {
        id: 'shareable',
        label: 'Compartible',
        icon: 'share-social',
        color: '#10b981',
        description: 'Permites que tu coach la use en redes (antes/después)'
    },
    {
        id: 'private',
        label: 'Privada',
        icon: 'lock-closed',
        color: '#6b7280',
        description: 'Solo tú puedes verla'
    },
];

/**
 * PhotoTaggingModal - Modal para etiquetar una foto de progreso
 * @param {boolean} visible - Si el modal está visible
 * @param {function} onClose - Cerrar sin guardar
 * @param {object} photo - Objeto foto con {uri}
 * @param {function} onSave - Callback con {uri, tags, visibility}
 */
export default function PhotoTaggingModal({ visible, onClose, photo, onSave }) {
    const insets = useSafeAreaInsets();
    const [selectedPose, setSelectedPose] = useState(null);
    const [selectedPoseType, setSelectedPoseType] = useState(null);
    const [visibility, setVisibility] = useState('coach_only');

    // Reset al abrir
    useEffect(() => {
        if (visible) {
            setSelectedPose(null);
            setSelectedPoseType(null);
            setVisibility('coach_only');
        }
    }, [visible]);

    const handleSave = () => {
        const tags = [];
        if (selectedPose) tags.push(selectedPose);
        if (selectedPoseType) tags.push(selectedPoseType);

        onSave({
            uri: photo?.uri,
            tags,
            visibility,
        });
    };

    const canSave = selectedPose !== null; // Al menos necesitamos pose

    if (!photo) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <StatusBar style="dark" />
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={28} color="#64748b" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Etiquetar foto</Text>
                    <TouchableOpacity
                        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={!canSave}
                    >
                        <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
                            Guardar
                        </Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Preview de foto */}
                    <View style={styles.previewContainer}>
                        <Image source={{ uri: photo.uri }} style={styles.preview} />
                    </View>

                    {/* Selector de pose */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📷 ¿Qué vista es?</Text>
                        <Text style={styles.sectionSubtitle}>Selecciona una</Text>

                        <View style={styles.optionsRow}>
                            {POSE_TAGS.map(pose => (
                                <TouchableOpacity
                                    key={pose.id}
                                    style={[
                                        styles.poseCard,
                                        selectedPose === pose.id && styles.poseCardActive
                                    ]}
                                    onPress={() => setSelectedPose(pose.id)}
                                >
                                    <Text style={styles.poseEmoji}>{pose.icon}</Text>
                                    <Text style={[
                                        styles.poseLabel,
                                        selectedPose === pose.id && styles.poseLabelActive
                                    ]}>
                                        {pose.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Selector de tipo de pose (opcional) */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>💪 Tipo de pose (opcional)</Text>

                        <View style={styles.optionsRow}>
                            {POSE_TYPES.map(type => (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[
                                        styles.typeChip,
                                        selectedPoseType === type.id && styles.typeChipActive
                                    ]}
                                    onPress={() => setSelectedPoseType(
                                        selectedPoseType === type.id ? null : type.id
                                    )}
                                >
                                    <Text style={styles.typeEmoji}>{type.icon}</Text>
                                    <Text style={[
                                        styles.typeLabel,
                                        selectedPoseType === type.id && styles.typeLabelActive
                                    ]}>
                                        {type.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Selector de visibilidad */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🔐 Visibilidad</Text>
                        <Text style={styles.sectionSubtitle}>¿Quién puede ver esta foto?</Text>

                        <View style={styles.visibilityList}>
                            {VISIBILITY_OPTIONS.map(option => (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[
                                        styles.visibilityCard,
                                        visibility === option.id && {
                                            borderColor: option.color,
                                            backgroundColor: option.color + '10'
                                        }
                                    ]}
                                    onPress={() => setVisibility(option.id)}
                                >
                                    <View style={[
                                        styles.visibilityIcon,
                                        { backgroundColor: option.color + '20' }
                                    ]}>
                                        <Ionicons
                                            name={option.icon}
                                            size={20}
                                            color={option.color}
                                        />
                                    </View>
                                    <View style={styles.visibilityInfo}>
                                        <Text style={[
                                            styles.visibilityLabel,
                                            visibility === option.id && { color: option.color }
                                        ]}>
                                            {option.label}
                                        </Text>
                                        <Text style={styles.visibilityDesc}>
                                            {option.description}
                                        </Text>
                                    </View>
                                    {visibility === option.id && (
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={24}
                                            color={option.color}
                                        />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Info sobre consentimiento */}
                    {visibility === 'shareable' && (
                        <View style={styles.consentInfo}>
                            <Ionicons name="information-circle" size={20} color="#10b981" />
                            <Text style={styles.consentText}>
                                Al marcar como "Compartible", autorizas a tu coach a usar esta
                                foto para crear contenido motivacional (siempre con tu cara
                                cubierta si lo deseas).
                            </Text>
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#fff',
    },
    closeBtn: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
    },
    saveBtn: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    saveBtnDisabled: {
        backgroundColor: '#e2e8f0',
    },
    saveBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    saveBtnTextDisabled: {
        color: '#94a3b8',
    },

    content: {
        flex: 1,
    },

    // Preview
    previewContainer: {
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
    },
    preview: {
        width: 140,
        height: 180,
        borderRadius: 12,
        backgroundColor: '#e2e8f0',
    },

    // Secciones
    section: {
        padding: 16,
        backgroundColor: '#fff',
        marginTop: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 12,
    },

    // Pose cards
    optionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
    },
    poseCard: {
        minWidth: 90,
        maxWidth: 110,
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    poseCardActive: {
        borderColor: '#3b82f6',
        backgroundColor: '#eff6ff',
    },
    poseEmoji: {
        fontSize: 28,
        marginBottom: 4,
    },
    poseLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748b',
    },
    poseLabelActive: {
        color: '#3b82f6',
    },

    // Type chips
    typeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    typeChipActive: {
        borderColor: '#8b5cf6',
        backgroundColor: '#f5f3ff',
    },
    typeEmoji: {
        fontSize: 18,
    },
    typeLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748b',
    },
    typeLabelActive: {
        color: '#8b5cf6',
    },

    // Visibility
    visibilityList: {
        gap: 10,
    },
    visibilityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#e2e8f0',
        gap: 12,
    },
    visibilityIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    visibilityInfo: {
        flex: 1,
    },
    visibilityLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    visibilityDesc: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },

    // Consent info
    consentInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        margin: 16,
        padding: 14,
        backgroundColor: '#ecfdf5',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#a7f3d0',
    },
    consentText: {
        flex: 1,
        fontSize: 12,
        color: '#065f46',
        lineHeight: 18,
    },
});
