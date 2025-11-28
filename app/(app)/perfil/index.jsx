import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, Modal, Pressable, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import ActionButton from '../../../components/ActionButton';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';

const AVATARS = [
    { id: 'gorilla', emoji: '🦍', name: 'Gorila' },
    { id: 'lion', emoji: '🦁', name: 'León' },
    { id: 'wolf', emoji: '🐺', name: 'Lobo' },
    { id: 'eagle', emoji: '🦅', name: 'Águila' },
    { id: 'bull', emoji: '🐂', name: 'Toro' },
    { id: 'tiger', emoji: '🐅', name: 'Tigre' },
];

export default function PerfilScreen() {
    const router = useRouter();
    const { user, logout } = useAuth();
    const { theme, isDark } = useTheme();

    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);

    const handleLogout = async () => {
        await logout();
    };

    const menuItems = [
        { title: 'Información Personal', icon: 'person-outline', route: '/perfil/informacion-personal' },
        { title: 'Evolución', icon: 'trending-up-outline', route: '/perfil/evolucion' },
        { title: 'Mi Transformación', icon: 'body-outline', route: '/perfil/transformacion' },
        { title: 'Logros', icon: 'trophy-outline', route: '/perfil/logros' },
        { title: 'Comunidad', icon: 'people-outline', route: '/perfil/comunidad' },
        { title: 'Ajustes', icon: 'settings-outline', route: '/perfil/ajustes' },
    ];

    const gradientColors = isDark
        ? ['#0B1220', '#0D1B2A', '#111827']
        : ['#f0f4f8', '#e0e7ef', '#d1dce6'];

    const blobColorTop = isDark ? '#3B82F6' : '#93c5fd';
    const blobColorBottom = isDark ? '#10B981' : '#6ee7b7';

    return (
        <View style={styles.root}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View style={[styles.blob, styles.blobTop, { backgroundColor: blobColorTop }]} />
            <View style={[styles.blob, styles.blobBottom, { backgroundColor: blobColorBottom }]} />

            <ScrollView style={{ width: '100%' }} contentContainerStyle={styles.scrollContainer}>

                {/* Header Section */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setShowAvatarModal(true)} style={[styles.avatarContainer, { borderColor: theme.primary }]}>
                        <Text style={styles.avatarEmoji}>{selectedAvatar.emoji}</Text>
                        <View style={[styles.editIconBadge, { backgroundColor: theme.primary }]}>
                            <Ionicons name="pencil" size={12} color="#fff" />
                        </View>
                    </TouchableOpacity>

                    <View style={styles.userInfo}>
                        <Text style={[styles.name, { color: theme.text }]}>{user?.nombre || 'Usuario'}</Text>
                        <Text style={[styles.username, { color: theme.textSecondary }]}>@{user?.username || 'usuario'}</Text>

                        <View style={styles.badgesRow}>
                            <View style={[styles.badge, { backgroundColor: theme.primaryLight }]}>
                                <Text style={[styles.badgeText, { color: theme.primary }]}>{user?.role || 'ENTRENADOR'}</Text>
                            </View>
                            <View style={[styles.badge, { backgroundColor: theme.successLight }]}>
                                <Text style={[styles.badgeText, { color: theme.successText }]}>{user?.tipoUsuario || 'ADMINISTRADOR'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Menu Section */}
                <View style={styles.menuContainer}>
                    {menuItems.map((item, index) => (
                        <View key={index} style={styles.menuItemWrapper}>
                            <ActionButton
                                title={item.title}
                                icon={item.icon}
                                onPress={() => router.push(item.route)}
                                variant="secondary"
                                style={styles.menuButton}
                            />
                        </View>
                    ))}

                    <View style={[styles.divider, { marginVertical: 20 }]} />

                    <ActionButton
                        title="Cerrar Sesión"
                        icon="log-out-outline"
                        onPress={handleLogout}
                        variant="secondary"
                        style={{ borderColor: theme.error, borderWidth: 1 }}
                        textStyle={{ color: theme.error }}
                    />
                </View>

            </ScrollView>

            {/* Avatar Selector Modal */}
            <Modal visible={showAvatarModal} transparent animationType="fade" onRequestClose={() => setShowAvatarModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Elige tu Avatar</Text>
                        <View style={styles.avatarGrid}>
                            {AVATARS.map((avatar) => (
                                <TouchableOpacity
                                    key={avatar.id}
                                    style={[
                                        styles.avatarOption,
                                        selectedAvatar.id === avatar.id && { borderColor: theme.primary, backgroundColor: theme.primaryLight }
                                    ]}
                                    onPress={() => {
                                        setSelectedAvatar(avatar);
                                        setShowAvatarModal(false);
                                    }}
                                >
                                    <Text style={styles.avatarOptionEmoji}>{avatar.emoji}</Text>
                                    <Text style={[styles.avatarOptionName, { color: theme.textSecondary }]}>{avatar.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Pressable onPress={() => setShowAvatarModal(false)} style={[styles.closeBtn, { backgroundColor: theme.background }]}>
                            <Text style={{ color: theme.text }}>Cerrar</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? 36 : 0,
    },
    scrollContainer: {
        alignItems: 'center',
        paddingBottom: 40,
    },
    blob: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 160,
        opacity: 0.25,
        filter: Platform.OS === 'web' ? 'blur(70px)' : undefined,
    },
    blobTop: { top: -40, left: -40 },
    blobBottom: { bottom: -30, right: -30 },

    header: {
        alignItems: 'center',
        paddingVertical: 30,
        width: '100%',
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        marginBottom: 16,
        position: 'relative',
    },
    avatarEmoji: {
        fontSize: 50,
    },
    editIconBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    userInfo: {
        alignItems: 'center',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    username: {
        fontSize: 16,
        marginBottom: 12,
    },
    badgesRow: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    divider: {
        width: '90%',
        height: 1,
        backgroundColor: 'rgba(150,150,150,0.2)',
        marginVertical: 10,
    },
    menuContainer: {
        width: '100%',
        paddingHorizontal: 20,
        marginTop: 10,
        alignItems: 'center',
    },
    menuItemWrapper: {
        marginBottom: 12,
    },

    /* Modal */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    avatarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 20,
    },
    avatarOption: {
        width: 80,
        height: 80,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
        backgroundColor: 'rgba(150,150,150,0.1)',
    },
    avatarOptionEmoji: {
        fontSize: 32,
        marginBottom: 4,
    },
    avatarOptionName: {
        fontSize: 12,
        fontWeight: '500',
    },
    closeBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
});
