/* app/(coach)/nutrition/components/WeeklyMealPlanner/DayNavigator.jsx
 * Barra de navegación horizontal de días (LUN - DOM)
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';

export default function DayNavigator({ days, selectedDay, onSelectDay, getDaySummary }) {
    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {days.map((day) => {
                    const isSelected = selectedDay === day.key;
                    const { hasFood, foodCount } = getDaySummary(day.key);

                    return (
                        <TouchableOpacity
                            key={day.key}
                            style={[
                                styles.dayButton,
                                isSelected && styles.dayButtonSelected,
                            ]}
                            onPress={() => onSelectDay(day.key)}
                        >
                            <Text style={[
                                styles.dayShort,
                                isSelected && styles.dayShortSelected,
                            ]}>
                                {day.short}
                            </Text>
                            <Text style={[
                                styles.dayLabel,
                                isSelected && styles.dayLabelSelected,
                            ]} numberOfLines={1}>
                                {day.label.substring(0, 3)}
                            </Text>

                            {/* Indicador de contenido */}
                            {hasFood && (
                                <View style={[
                                    styles.contentIndicator,
                                    isSelected && styles.contentIndicatorSelected,
                                ]}>
                                    <Text style={[
                                        styles.contentIndicatorText,
                                        isSelected && styles.contentIndicatorTextSelected,
                                    ]}>
                                        {foodCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    scrollContent: {
        paddingHorizontal: 12,
        gap: 8,
    },
    dayButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#fff',
        minWidth: 54,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        position: 'relative',
    },
    dayButtonSelected: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    dayShort: {
        fontSize: 18,
        fontWeight: '700',
        color: '#64748b',
    },
    dayShortSelected: {
        color: '#fff',
    },
    dayLabel: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 2,
    },
    dayLabelSelected: {
        color: 'rgba(255,255,255,0.8)',
    },
    contentIndicator: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#22c55e',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    contentIndicatorSelected: {
        backgroundColor: '#fff',
    },
    contentIndicatorText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    contentIndicatorTextSelected: {
        color: '#3b82f6',
    },
});
