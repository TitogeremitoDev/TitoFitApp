import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NotificationDrawer = ({ visible, onClose }) => {
    // const insets = useSafeAreaInsets();

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.drawer}
                    onPress={e => e.stopPropagation()}
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>Notificaciones</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        <View style={styles.emptyState}>
                            <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No tienes nuevas notificaciones</Text>
                        </View>
                        {/* 
                            ToDo: Map notifications here
                            <NotificationItem ... />
                        */}
                    </ScrollView>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    drawer: {
        width: 320, // max width on mobile?
        maxWidth: '85%',
        height: '100%',
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        padding: 16,
        paddingTop: 50, // simplified safe area
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    content: {
        flex: 1,
    },
    emptyState: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
    },
    emptyText: {
        marginTop: 16,
        color: '#94a3b8',
        textAlign: 'center',
    }
});

export default NotificationDrawer;
