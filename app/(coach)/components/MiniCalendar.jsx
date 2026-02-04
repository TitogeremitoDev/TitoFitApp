import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/es';

moment.locale('es');

const COLORS = {
    primary: '#2563EB',
    text: '#1e293b',
    textMuted: '#94a3b8',
    surface: '#ffffff',
    border: '#e2e8f0',
    todayBg: '#eff6ff',
};

const TYPE_COLORS = {
    'rutina': '#3b82f6',
    'dieta': '#10b981',
    'llamada': '#f59e0b',
    'presencial': '#8b5cf6',
    'seguimiento': '#ec4899',
    'recordatorio': '#ef4444',
    'otro': '#64748b',
};

const MiniCalendar = ({ selectedDate, onSelectDate, events = [] }) => {
    const [currentMonth, setCurrentMonth] = useState(moment());

    // Generate days for the grid
    const startOfMonth = currentMonth.clone().startOf('month');
    const endOfMonth = currentMonth.clone().endOf('month');
    const startOfWeek = startOfMonth.clone().startOf('week');
    const endOfWeek = endOfMonth.clone().endOf('week');

    const days = [];
    let day = startOfWeek.clone();

    while (day.isSameOrBefore(endOfWeek, 'day')) {
        days.push(day.clone());
        day.add(1, 'd');
    }

    const weekDays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

    const getEventColors = (date) => {
        // Get unique types for this day
        const dayEvents = events.filter(e => moment(e.startDate).isSame(date, 'day'));
        const types = [...new Set(dayEvents.map(e => e.type))];
        // Take up to 3 for display
        return types.slice(0, 3).map(type => TYPE_COLORS[type] || '#94a3b8');
    };

    return (
        <View style={styles.container}>
            {/* Header: Month Year + Navigation */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => setCurrentMonth(prev => prev.clone().subtract(1, 'month'))}>
                    <Ionicons name="chevron-back" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                    {currentMonth.format('MMMM YYYY')}
                </Text>
                <TouchableOpacity onPress={() => setCurrentMonth(prev => prev.clone().add(1, 'month'))}>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
            </View>

            {/* Week Days Header */}
            <View style={styles.weekRow}>
                {weekDays.map((d, i) => (
                    <Text key={i} style={styles.weekDayText}>{d}</Text>
                ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
                {days.map((date, index) => {
                    const isSelected = selectedDate && date.isSame(selectedDate, 'day');
                    const isToday = date.isSame(moment(), 'day');
                    const isCurrentMonth = date.month() === currentMonth.month();

                    return (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.dayCell,
                                isSelected && styles.selectedDay,
                                isToday && !isSelected && styles.todayCell
                            ]}
                            onPress={() => onSelectDate(date.toDate())}
                        >
                            <Text style={[
                                styles.dayText,
                                !isCurrentMonth && styles.outsideMonthText,
                                isSelected && styles.selectedDayText
                            ]}>
                                {date.date()}
                            </Text>

                            <View style={styles.dotsContainer}>
                                {getEventColors(date).map((color, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.eventDot,
                                            { backgroundColor: isSelected ? '#fff' : color }
                                        ]}
                                    />
                                ))}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        // Shadow for elevation
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 1,
        borderColor: COLORS.border
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    monthTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        textTransform: 'capitalize'
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    weekDayText: {
        width: 32,
        fontSize: 10,
        fontWeight: 'bold',
        color: COLORS.textMuted,
        textAlign: 'center',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%', // 100% / 7
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        borderRadius: 20,
    },
    todayCell: {
        backgroundColor: COLORS.todayBg,
    },
    selectedDay: {
        backgroundColor: COLORS.primary,
    },
    dayText: {
        fontSize: 12,
        color: COLORS.text,
    },
    outsideMonthText: {
        color: '#cbd5e1',
    },
    selectedDayText: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
    dotsContainer: {
        flexDirection: 'row',
        marginTop: 2,
        gap: 2,
        justifyContent: 'center',
        height: 4
    },
    eventDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    }
});

export default MiniCalendar;
