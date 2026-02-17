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
    const [currentMonth, setCurrentMonth] = useState(moment(selectedDate || new Date()));

    useEffect(() => {
        if (selectedDate) {
            const dateMoment = moment(selectedDate);
            if (!dateMoment.isSame(currentMonth, 'month')) {
                setCurrentMonth(dateMoment.clone().startOf('month'));
            }
        }
    }, [selectedDate]);

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
        const dayEvents = events.filter(e => moment(e.startDate).isSame(date, 'day'));
        const types = [...new Set(dayEvents.map(e => e.type))];
        return types.slice(0, 3).map(type => TYPE_COLORS[type] || '#94a3b8');
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => setCurrentMonth(prev => prev.clone().subtract(1, 'month'))} style={{ padding: 4 }}>
                    <Ionicons name="chevron-back" size={16} color="#94a3b8" />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                    {currentMonth.format('MMMM YYYY')}
                </Text>
                <TouchableOpacity onPress={() => setCurrentMonth(prev => prev.clone().add(1, 'month'))} style={{ padding: 4 }}>
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
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
                            style={styles.dayCell}
                            onPress={() => onSelectDate(date.toDate())}
                        >
                            <View style={[
                                styles.dayContent,
                                isSelected && styles.selectedDay,
                                isToday && !isSelected && styles.todayCell
                            ]}>
                                <Text style={[
                                    styles.dayText,
                                    !isCurrentMonth && styles.outsideMonthText,
                                    isToday && !isSelected && { color: '#2563EB', fontWeight: 'bold' },
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
        backgroundColor: 'transparent',
        marginBottom: 4, // Reduced
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2, // Tighter
        paddingHorizontal: 4
    },
    monthTitle: {
        fontSize: 13, // Smaller
        fontWeight: '700',
        color: '#0f172a',
        textTransform: 'capitalize'
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2, // Tighter
    },
    weekDayText: {
        width: '14.28%',
        fontSize: 9,
        fontWeight: '700',
        color: '#94a3b8',
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        height: 28, // Shorter cells
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 0,
    },
    dayContent: {
        width: 24, // Smaller circle
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    todayCell: {
        // No background for today, just maybe bold or colored text if not selected
    },
    selectedDay: {
        backgroundColor: '#2563EB',
        borderRadius: 50,
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 2
    },
    dayText: {
        fontSize: 10, // Smaller text
        color: '#334155',
        fontWeight: '500'
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
        position: 'absolute',
        bottom: 1, // Tighter
        gap: 1,
        justifyContent: 'center',
    },
    eventDot: {
        width: 2.5, // Tiny dot
        height: 2.5,
        borderRadius: 1.25,
        backgroundColor: '#94a3b8',
    }
});

export default MiniCalendar;
