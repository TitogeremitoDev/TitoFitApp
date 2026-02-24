// CoachGuideModal.jsx — Modal para que el coach gestione guías per-client

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import EnhancedTextInput from '@/components/ui/EnhancedTextInput';
import { useTheme } from '../../../context/ThemeContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

const CoachGuideModal = ({ visible, client, category, onClose, token }) => {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [textContent, setTextContent] = useState('');
    const [existingGuide, setExistingGuide] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [existingFileName, setExistingFileName] = useState(null);

    const categoryLabel = category === 'training' ? 'Entrenamiento' : 'Nutrición';

    useEffect(() => {
        if (visible && client?._id) fetchGuide();
    }, [visible, client?._id]);

    const fetchGuide = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/coach-guides/client/${client._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                const guide = data[category];
                if (guide) {
                    setExistingGuide(guide);
                    setTextContent(guide.textContent || '');
                    setExistingFileName(guide.fileName || null);
                } else {
                    setExistingGuide(null);
                    setTextContent('');
                    setExistingFileName(null);
                }
            }
        } catch (err) {
            console.error('[CoachGuideModal] Error fetching:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/pdf',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/msword',
                    'text/plain'
                ],
                copyToCacheDirectory: true,
            });

            if (result.assets && result.assets.length > 0) {
                setSelectedFile(result.assets[0]);
            } else if (result.type === 'success') {
                setSelectedFile(result);
            }
        } catch (err) {
            console.error('[CoachGuideModal] Error picking file:', err);
        }
    };

    const handleSave = async () => {
        const hasText = textContent.trim().length > 0;
        const hasNewFile = !!selectedFile;
        const hasExistingFile = !!existingFileName;

        // Necesita al menos texto O un archivo (nuevo o existente)
        if (!hasText && !hasNewFile && !hasExistingFile) {
            Alert.alert('Aviso', 'Escribe algo o adjunta un archivo');
            return;
        }

        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('textContent', textContent.trim());

            if (selectedFile) {
                if (Platform.OS === 'web') {
                    // Web: usar File object directamente o convertir a Blob
                    if (selectedFile.file) {
                        formData.append('file', selectedFile.file);
                    } else {
                        const response = await fetch(selectedFile.uri);
                        const blob = await response.blob();
                        formData.append('file', blob, selectedFile.name || 'guide.pdf');
                    }
                } else {
                    // Native: usar { uri, name, type }
                    formData.append('file', {
                        uri: selectedFile.uri,
                        name: selectedFile.name,
                        type: selectedFile.mimeType || 'application/octet-stream',
                    });
                }
            }

            console.log('[CoachGuideModal] Saving →', {
                textLength: textContent.trim().length,
                hasNewFile,
                hasExistingFile,
                fileName: selectedFile?.name || existingFileName,
            });

            const res = await fetch(
                `${API_URL}/api/coach-guides/client/${client._id}/${category}`,
                {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                }
            );

            const data = await res.json();
            if (data.success) {
                Alert.alert('Guardado', `Guía de ${categoryLabel} guardada correctamente`);
                onClose();
            } else {
                Alert.alert('Error', data.message || 'No se pudo guardar');
            }
        } catch (err) {
            console.error('[CoachGuideModal] Error saving:', err);
            Alert.alert('Error', 'Error al guardar la guía');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Eliminar guía',
            `¿Seguro que quieres eliminar la guía de ${categoryLabel} para ${client.nombre}?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await fetch(
                                `${API_URL}/api/coach-guides/client/${client._id}/${category}`,
                                {
                                    method: 'DELETE',
                                    headers: { Authorization: `Bearer ${token}` },
                                }
                            );
                            const data = await res.json();
                            if (data.success) {
                                Alert.alert('Eliminada', 'Guía eliminada correctamente');
                                onClose();
                            }
                        } catch (err) {
                            Alert.alert('Error', 'No se pudo eliminar');
                        }
                    }
                }
            ]
        );
    };

    const displayFileName = selectedFile?.name || existingFileName;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
                        <View style={styles.headerLeft}>
                            <Ionicons name="document-text-outline" size={22} color={theme.primary} />
                            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                                Guía {categoryLabel}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.clientName, { color: theme.textSecondary }]}>
                        {client?.nombre}
                    </Text>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={theme.primary} />
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Resumen de lo guardado */}
                            {existingGuide && (existingGuide.textContent || existingGuide.fileName) ? (
                                <View style={[styles.savedSummary, { backgroundColor: '#22c55e10', borderColor: '#22c55e30' }]}>
                                    <View style={styles.savedHeader}>
                                        <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                                        <Text style={[styles.savedTitle, { color: '#22c55e' }]}>Guía guardada</Text>
                                        <Text style={[styles.savedDate, { color: theme.textSecondary }]}>
                                            {new Date(existingGuide.updatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </Text>
                                    </View>
                                    {existingGuide.fileName ? (
                                        <View style={styles.savedFileRow}>
                                            <Ionicons
                                                name={existingGuide.fileContentType === 'application/pdf' ? 'document' :
                                                    existingGuide.fileContentType?.includes('word') ? 'document-text' : 'document-outline'}
                                                size={16}
                                                color={theme.primary}
                                            />
                                            <Text style={[styles.savedFileName, { color: theme.primary }]} numberOfLines={1}>
                                                {existingGuide.fileName}
                                            </Text>
                                        </View>
                                    ) : null}
                                    {existingGuide.textContent ? (
                                        <Text style={[styles.savedPreview, { color: theme.text }]} numberOfLines={3}>
                                            {existingGuide.textContent}
                                        </Text>
                                    ) : null}
                                    {!existingGuide.textContent && !existingGuide.fileName ? (
                                        <Text style={[styles.savedPreview, { color: theme.textSecondary }]}>
                                            Sin contenido
                                        </Text>
                                    ) : null}
                                </View>
                            ) : null}

                            {/* Texto de la guía */}
                            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                                {existingGuide ? 'Editar instrucciones' : 'Instrucciones'}
                            </Text>
                            <EnhancedTextInput
                                value={textContent}
                                onChangeText={setTextContent}
                                placeholder="Escribe las instrucciones para tu cliente... (tempos, cómo pesar comida, metodología, etc.)"
                                placeholderTextColor={theme.textSecondary + '80'}
                                multiline
                                numberOfLines={8}
                                style={[styles.textInput, { color: theme.text }]}
                                containerStyle={[styles.textInputContainer, {
                                    backgroundColor: theme.background,
                                    borderColor: theme.cardBorder,
                                }]}
                                maxLength={10000}
                            />

                            {/* Archivo adjunto */}
                            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                                Archivo adjunto (opcional)
                            </Text>

                            {displayFileName ? (
                                <View style={[styles.fileChip, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                                    <Ionicons name="document-attach" size={18} color={theme.primary} />
                                    <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                                        {displayFileName}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setSelectedFile(null);
                                            setExistingFileName(null);
                                        }}
                                    >
                                        <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.attachBtn, { borderColor: theme.primary + '40' }]}
                                onPress={handlePickFile}
                            >
                                <Ionicons name="attach" size={20} color={theme.primary} />
                                <Text style={[styles.attachBtnText, { color: theme.primary }]}>
                                    {displayFileName ? 'Cambiar archivo' : 'Adjuntar archivo (PDF/Word/TXT)'}
                                </Text>
                            </TouchableOpacity>

                            {/* Acciones */}
                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                        <Text style={styles.saveBtnText}>Guardar Guía</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            {existingGuide && (
                                <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={handleDelete}
                                >
                                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                    <Text style={styles.deleteBtnText}>Eliminar guía</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
        minHeight: 400,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    closeBtn: {
        padding: 4,
    },
    clientName: {
        fontSize: 14,
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    savedSummary: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        marginBottom: 20,
    },
    savedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    savedTitle: {
        fontSize: 14,
        fontWeight: '700',
        flex: 1,
    },
    savedDate: {
        fontSize: 12,
    },
    savedPreview: {
        fontSize: 13,
        lineHeight: 19,
        marginTop: 8,
        opacity: 0.85,
    },
    savedFileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    savedFileName: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginTop: 4,
    },
    textInputContainer: {
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 20,
    },
    textInput: {
        fontSize: 15,
        lineHeight: 22,
        minHeight: 160,
        textAlignVertical: 'top',
        padding: 14,
    },
    fileChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 10,
    },
    fileName: {
        flex: 1,
        fontSize: 14,
    },
    attachBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        marginBottom: 24,
    },
    attachBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 12,
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
    },
    deleteBtnText: {
        color: '#ef4444',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default CoachGuideModal;
