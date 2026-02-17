/**
 * ChatAttachmentMenu.jsx
 * Cross-platform attachment menu for chat
 * iOS: ActionSheetIOS | Android: Modal bottom sheet
 */

import React from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    Platform,
    ActionSheetIOS,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const OPTIONS = [
    { key: 'camera', icon: 'camera-outline', label: 'Cámara', color: '#8b5cf6' },
    { key: 'gallery', icon: 'images-outline', label: 'Galería', color: '#3b82f6' },
    { key: 'document', icon: 'document-text-outline', label: 'Importar Archivo', color: '#f59e0b' },
];

/**
 * Show attachment menu on iOS (ActionSheet) - call this imperatively
 */
export const showAttachmentMenuIOS = ({ onCamera, onGallery, onDocument }) => {
    ActionSheetIOS.showActionSheetWithOptions(
        {
            options: ['Cancelar', 'Cámara', 'Galería', 'Importar Archivo'],
            cancelButtonIndex: 0,
        },
        (buttonIndex) => {
            if (buttonIndex === 1) onCamera();
            else if (buttonIndex === 2) onGallery();
            else if (buttonIndex === 3) onDocument();
        }
    );
};

/**
 * Android modal-based attachment menu
 */
const ChatAttachmentMenu = ({ visible, onClose, onCamera, onGallery, onDocument }) => {
    if (Platform.OS === 'ios') return null;

    const handlePress = (key) => {
        onClose();
        if (key === 'camera') onCamera();
        else if (key === 'gallery') onGallery();
        else if (key === 'document') onDocument();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <View style={styles.sheet}>
                    {OPTIONS.map(({ key, icon, label, color }) => (
                        <Pressable
                            key={key}
                            style={styles.row}
                            onPress={() => handlePress(key)}
                        >
                            <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
                                <Ionicons name={icon} size={22} color={color} />
                            </View>
                            <Text style={styles.label}>{label}</Text>
                        </Pressable>
                    ))}
                </View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingVertical: 16,
        paddingHorizontal: 20,
        paddingBottom: 32,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        gap: 16,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        fontSize: 16,
        color: '#1e293b',
        fontWeight: '500',
    },
});

export default ChatAttachmentMenu;
