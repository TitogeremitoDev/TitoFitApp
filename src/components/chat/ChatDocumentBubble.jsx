/**
 * ChatDocumentBubble.jsx
 * Tappable document card for document messages in chat bubbles
 * Fetches signed URL on tap and opens in system viewer
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Linking, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import {
    EnhancedTouchable as TouchableOpacity,
} from '../../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

const getDocIcon = (fileName) => {
    const ext = (fileName || '').split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'pdf':
            return { icon: 'document-text', color: '#ef4444' };
        case 'doc':
        case 'docx':
            return { icon: 'document', color: '#3b82f6' };
        case 'xls':
        case 'xlsx':
            return { icon: 'document', color: '#10b981' };
        case 'txt':
            return { icon: 'document-text-outline', color: '#64748b' };
        default:
            return { icon: 'document-attach', color: '#8b5cf6' };
    }
};

const ChatDocumentBubble = ({ r2Key, fileName, isOwn }) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);

    const { icon, color: iconColor } = getDocIcon(fileName);
    const textColor = isOwn ? '#fff' : '#1e293b';
    const subtextColor = isOwn ? 'rgba(255,255,255,0.7)' : '#64748b';
    const bgColor = isOwn ? 'rgba(255,255,255,0.15)' : '#f1f5f9';

    const handlePress = async () => {
        if (loading || !r2Key) return;
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/chat/media-url`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ key: r2Key }),
            });
            const data = await res.json();

            if (data.success && data.url) {
                await Linking.openURL(data.url);
            } else {
                Alert.alert('Error', 'No se pudo abrir el archivo');
            }
        } catch (err) {
            console.error('[ChatDocumentBubble] Error:', err);
            Alert.alert('Error', 'No se pudo abrir el archivo');
        } finally {
            setLoading(false);
        }
    };

    return (
        <TouchableOpacity
            style={[styles.container, { backgroundColor: bgColor }]}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            <View style={[styles.iconCircle, { backgroundColor: iconColor + '20' }]}>
                {loading ? (
                    <ActivityIndicator size={18} color={iconColor} />
                ) : (
                    <Ionicons name={icon} size={22} color={iconColor} />
                )}
            </View>
            <View style={styles.info}>
                <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>
                    {fileName || 'Documento'}
                </Text>
                <Text style={[styles.subtext, { color: subtextColor }]}>
                    Pulsa para abrir
                </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={subtextColor} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        padding: 10,
        gap: 10,
        marginBottom: 4,
        minWidth: 200,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        flex: 1,
    },
    fileName: {
        fontSize: 13,
        fontWeight: '600',
    },
    subtext: {
        fontSize: 11,
        marginTop: 2,
    },
});

export default ChatDocumentBubble;
