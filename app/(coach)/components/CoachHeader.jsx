import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function CoachHeader({
    title,
    subtitle,
    icon,
    iconColor = '#3b82f6',
    badge,
    badgeColor = '#dbeafe',
    badgeTextColor = '#3b82f6',
    rightContent,
    onBackPress = undefined,
    showBackOnWeb = true // Auto-show back button on web by default
}) {
    const router = useRouter();

    // Convert hex color to rgba with 10% opacity for background
    const getIconBackgroundColor = (color) => {
        // Remove # if present
        const hex = color.replace('#', '');

        // Parse hex to RGB
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, 0.1)`;
    };

    // Show back button: if onBackPress is provided OR if on web with showBackOnWeb enabled
    const shouldShowBack = onBackPress || (Platform.OS === 'web' && showBackOnWeb);

    const handleBack = () => {
        if (onBackPress) {
            onBackPress();
        } else {
            router.back();
        }
    };

    return (
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                {shouldShowBack && (
                    <TouchableOpacity
                        onPress={handleBack}
                        style={styles.backButton}
                    >
                        <Ionicons name="arrow-back" size={24} color="#1e293b" />
                    </TouchableOpacity>
                )}
                {icon && (
                    <View style={[styles.iconContainer, { backgroundColor: getIconBackgroundColor(iconColor) }]}>
                        <Ionicons name={icon} size={24} color={iconColor} />
                    </View>
                )}
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                    {subtitle && <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text>}
                </View>
            </View>

            <View style={styles.headerRight}>
                {badge && (
                    <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                        <Text style={[styles.badgeText, { color: badgeTextColor }]}>
                            {badge}
                        </Text>
                    </View>
                )}
                {rightContent}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        minHeight: 56,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
    },
    backButton: {
        padding: 4,
        flexShrink: 0,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    headerTextContainer: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    badgeText: {
        fontSize: 13,
        fontWeight: '600',
    },
});

