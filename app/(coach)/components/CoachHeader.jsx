import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CoachHeader({
    title,
    subtitle,
    icon,
    iconColor = '#3b82f6',
    badge,
    badgeColor = '#dbeafe',
    badgeTextColor = '#3b82f6',
    rightContent,
    onBackPress = undefined
}) {
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

    return (
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                {onBackPress && (
                    <TouchableOpacity
                        onPress={onBackPress}
                        style={styles.backButton}
                    >
                        <Ionicons name="arrow-back" size={24} color="#1e293b" />
                    </TouchableOpacity>
                )}
                {icon && (
                    <View style={[styles.iconContainer, { backgroundColor: getIconBackgroundColor(iconColor) }]}>
                        <Ionicons name={icon} size={28} color={iconColor} />
                    </View>
                )}
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>{title}</Text>
                    {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
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
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    backButton: {
        padding: 4,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
