// GuideViewerModal.jsx — Modal read-only para que el cliente vea la guía del coach

import React, { useState } from 'react';
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
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../context/ThemeContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

const GuideViewerModal = ({ visible, guide, category, title, token, onClose }) => {
    const { theme } = useTheme();
    const [downloading, setDownloading] = useState(false);
    const [viewingFile, setViewingFile] = useState(false);
    const [fileViewUrl, setFileViewUrl] = useState(null);
    const [loadingFile, setLoadingFile] = useState(false);

    // Web usa proxy (signed URLs no resuelven en localhost), native usa signed URL directa
    const proxyUrl = `${API_URL}/api/coach-guides/my/${category}/download`;
    const signedUrlEndpoint = `${API_URL}/api/coach-guides/my/${category}/download-url`;

    // Obtener signed URL (para native)
    const getSignedUrl = async () => {
        const res = await fetch(signedUrlEndpoint, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.success || !data.downloadUrl) {
            throw new Error('No se pudo obtener el enlace');
        }
        return data;
    };

    const handleCloseFileView = () => {
        setViewingFile(false);
        setFileViewUrl(null);
    };

    // Leer: muestra el PDF dentro de la app
    const handleOpen = async () => {
        if (!guide?.fileKey) return;

        setLoadingFile(true);
        try {
            if (Platform.OS === 'web') {
                // Web: fetch via proxy → blob → abrir en nueva pestaña
                const res = await fetch(proxyUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 10000);
                return;
            } else {
                // Native: obtener signed URL → Google Docs Viewer para PDF
                const data = await getSignedUrl();
                const encodedUrl = encodeURIComponent(data.downloadUrl);
                setFileViewUrl(`https://docs.google.com/gview?embedded=true&url=${encodedUrl}`);
                setViewingFile(true);
            }
        } catch (err) {
            console.error('[GuideViewer] Open error:', err);
            Alert.alert('Error', 'No se pudo abrir el archivo');
        } finally {
            setLoadingFile(false);
        }
    };

    // Descargar: guarda el archivo en el dispositivo
    const handleDownload = async () => {
        if (!guide?.fileKey) return;

        setDownloading(true);
        try {
            if (Platform.OS === 'web') {
                // Web: fetch via proxy → blob → forzar descarga
                const res = await fetch(proxyUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = guide.fileName || 'guia.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                return;
            }

            // Native: obtener signed URL → descargar → share
            const data = await getSignedUrl();
            const fileName = guide.fileName || 'guia.pdf';
            const localUri = FileSystem.documentDirectory + fileName;
            const download = await FileSystem.downloadAsync(data.downloadUrl, localUri);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(download.uri, {
                    mimeType: guide.fileContentType || 'application/pdf',
                    dialogTitle: `Guardar ${fileName}`,
                    UTI: 'public.data',
                });
            } else {
                Alert.alert('Descargado', 'Archivo guardado correctamente');
            }
        } catch (err) {
            console.error('[GuideViewer] Download error:', err);
            Alert.alert('Error', 'No se pudo descargar el archivo');
        } finally {
            setDownloading(false);
        }
    };

    // Vista de lectura del archivo (fullscreen)
    if (viewingFile && fileViewUrl) {
        return (
            <Modal
                visible={visible}
                animationType="slide"
                onRequestClose={handleCloseFileView}
            >
                <View style={[styles.fileViewContainer, { backgroundColor: theme.background }]}>
                    {/* Header del visor */}
                    <View style={[styles.fileViewHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
                        <TouchableOpacity onPress={handleCloseFileView} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.fileViewTitle, { color: theme.text }]} numberOfLines={1}>
                            {guide.fileName || 'Documento'}
                        </Text>
                        <View style={{ width: 32 }} />
                    </View>

                    {/* Visor PDF (solo native — en web se abre en nueva pestaña) */}
                    <WebView
                        originWhitelist={['*']}
                        source={{ uri: fileViewUrl }}
                        style={{ flex: 1 }}
                        scalesPageToFit={true}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        startInLoadingState
                        renderLoading={() => (
                            <View style={styles.webviewLoading}>
                                <ActivityIndicator size="large" color={theme.primary} />
                            </View>
                        )}
                    />
                </View>
            </Modal>
        );
    }

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
                                {title || `Guía de ${category === 'training' ? 'Entrenamiento' : 'Nutrición'}`}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* Texto de la guía */}
                        {guide?.textContent ? (
                            <Text style={[styles.guideText, { color: theme.text }]}>
                                {guide.textContent}
                            </Text>
                        ) : null}

                        {/* Archivo adjunto */}
                        {guide?.fileKey ? (
                            <View style={styles.fileSection}>
                                {guide?.textContent ? (
                                    <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
                                ) : null}

                                <View style={[styles.fileCard, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '25' }]}>
                                    <View style={styles.fileInfo}>
                                        <Ionicons name="document-attach" size={24} color={theme.primary} />
                                        <View style={styles.fileDetails}>
                                            <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={2}>
                                                {guide.fileName || 'Documento adjunto'}
                                            </Text>
                                            <Text style={[styles.fileType, { color: theme.textSecondary }]}>
                                                {guide.fileContentType === 'application/pdf' ? 'PDF' :
                                                    guide.fileContentType?.includes('word') ? 'Word' : 'Archivo'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.fileActions}>
                                        <TouchableOpacity
                                            style={[styles.fileActionBtn, { backgroundColor: theme.primary }]}
                                            onPress={handleOpen}
                                            disabled={loadingFile}
                                        >
                                            {loadingFile ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <>
                                                    <Ionicons name="eye-outline" size={18} color="#fff" />
                                                    <Text style={styles.fileActionBtnText}>Leer</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.fileActionBtn, { backgroundColor: theme.primary + '20', borderWidth: 1, borderColor: theme.primary + '40' }]}
                                            onPress={handleDownload}
                                            disabled={downloading}
                                        >
                                            {downloading ? (
                                                <ActivityIndicator size="small" color={theme.primary} />
                                            ) : (
                                                <>
                                                    <Ionicons name="download-outline" size={18} color={theme.primary} />
                                                    <Text style={[styles.fileActionBtnText, { color: theme.primary }]}>Descargar</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ) : null}

                        {/* Empty state */}
                        {!guide?.textContent && !guide?.fileKey ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="document-outline" size={48} color={theme.textSecondary + '50'} />
                                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                    Tu entrenador no ha añadido contenido a esta guía aún
                                </Text>
                            </View>
                        ) : null}
                    </ScrollView>
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
        maxHeight: '80%',
        minHeight: 300,
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    guideText: {
        fontSize: 15,
        lineHeight: 24,
    },
    fileSection: {
        marginTop: 8,
    },
    divider: {
        height: 1,
        marginVertical: 16,
    },
    fileCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
    },
    fileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    fileDetails: {
        flex: 1,
    },
    fileName: {
        fontSize: 14,
        fontWeight: '600',
    },
    fileType: {
        fontSize: 12,
        marginTop: 2,
    },
    fileActions: {
        flexDirection: 'row',
        gap: 10,
    },
    fileActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 10,
    },
    fileActionBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },
    // File viewer (fullscreen)
    fileViewContainer: {
        flex: 1,
    },
    fileViewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 56 : 40,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    backBtn: {
        padding: 4,
    },
    fileViewTitle: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 8,
    },
    webviewLoading: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default GuideViewerModal;
