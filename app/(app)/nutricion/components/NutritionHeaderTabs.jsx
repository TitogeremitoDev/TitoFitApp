import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import { getContrastColor } from '../../../../utils/colors';

const TABS = [
    { id: 'TODAY', label: '🍽️ Hoy' },
    { id: 'WEEK', label: '📅 Semana' },
    { id: 'SHOPPING', label: '🛒 Lista' },
];

const NutritionHeaderTabs = ({ activeTab, onTabChange }) => {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
            {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <TouchableOpacity
                        key={tab.id}
                        style={[
                            styles.tab,
                            isActive && { backgroundColor: theme.primary, borderColor: theme.primary }
                        ]}
                        onPress={() => onTabChange(tab.id)}
                    >
                        <Text style={[
                            styles.tabText,
                            { color: isActive ? getContrastColor(theme.primary) : theme.textSecondary, fontWeight: isActive ? '700' : '500' }
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: 4,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        // Basic shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    tabText: {
        fontSize: 14,
    }
});

export default NutritionHeaderTabs;
