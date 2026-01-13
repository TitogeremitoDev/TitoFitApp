import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function MiniFinancialCalendar({ subscriptions = [] }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);

    // Get calendar data
    const calendarData = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // First day of month (adjust for Monday start)
        const firstDay = new Date(year, month, 1);
        let startDay = firstDay.getDay() - 1;
        if (startDay < 0) startDay = 6; // Sunday becomes 6

        // Days in month
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Create calendar grid
        const days = [];
        const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

        for (let i = 0; i < totalCells; i++) {
            const dayNum = i - startDay + 1;
            if (dayNum > 0 && dayNum <= daysInMonth) {
                days.push({ day: dayNum, date: new Date(year, month, dayNum) });
            } else {
                days.push(null);
            }
        }

        return { days, month, year };
    }, [currentDate]);

    // Get payments for a specific date
    const getPaymentsForDate = (date) => {
        if (!date) return { scheduled: [], overdue: [] };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const scheduled = [];
        const overdue = [];

        subscriptions.forEach(sub => {
            if (!sub.nextPaymentDate) return;
            const paymentDate = new Date(sub.nextPaymentDate);
            paymentDate.setHours(0, 0, 0, 0);

            if (paymentDate.getTime() === date.getTime()) {
                if (paymentDate < today) {
                    overdue.push(sub);
                } else {
                    scheduled.push(sub);
                }
            }
        });

        return { scheduled, overdue };
    };

    // Get indicator for a date
    const getIndicator = (date) => {
        const { scheduled, overdue } = getPaymentsForDate(date);
        if (overdue.length > 0) return 'overdue';
        if (scheduled.length > 0) return 'scheduled';
        return null;
    };

    // Navigate months
    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        setSelectedDate(null);
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        setSelectedDate(null);
    };

    // Selected date payments
    const selectedPayments = selectedDate ? getPaymentsForDate(selectedDate) : { scheduled: [], overdue: [] };
    const allSelectedPayments = [...selectedPayments.overdue, ...selectedPayments.scheduled];

    const isToday = (date) => {
        if (!date) return false;
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const isSelected = (date) => {
        if (!date || !selectedDate) return false;
        return date.getTime() === selectedDate.getTime();
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                    <Ionicons name="chevron-back" size={18} color="#64748b" />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                    {MONTHS[calendarData.month]} {calendarData.year}
                </Text>
                <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                    <Ionicons name="chevron-forward" size={18} color="#64748b" />
                </TouchableOpacity>
            </View>

            {/* Days Header */}
            <View style={styles.daysHeader}>
                {DAYS.map(day => (
                    <Text key={day} style={styles.dayLabel}>{day}</Text>
                ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.grid}>
                {calendarData.days.map((item, idx) => {
                    const indicator = item ? getIndicator(item.date) : null;
                    return (
                        <TouchableOpacity
                            key={idx}
                            style={[
                                styles.dayCell,
                                isToday(item?.date) && styles.todayCell,
                                isSelected(item?.date) && styles.selectedCell,
                            ]}
                            onPress={() => item && setSelectedDate(item.date)}
                            disabled={!item}
                        >
                            {item && (
                                <>
                                    <Text style={[
                                        styles.dayText,
                                        isToday(item.date) && styles.todayText,
                                        isSelected(item.date) && styles.selectedText,
                                    ]}>
                                        {item.day}
                                    </Text>
                                    {indicator && (
                                        <View style={[
                                            styles.indicator,
                                            indicator === 'overdue' ? styles.indicatorRed : styles.indicatorBlue
                                        ]} />
                                    )}
                                </>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Selected Day Events */}
            {selectedDate && (
                <View style={styles.eventsSection}>
                    {/* Daily Total - Big Number */}
                    {allSelectedPayments.length > 0 && (
                        <View style={styles.dailyTotalBox}>
                            <Text style={styles.dailyTotalAmount}>
                                {allSelectedPayments.reduce((sum, sub) => sum + (sub.amount || 0), 0)}€
                            </Text>
                            <Text style={styles.dailyTotalLabel}>
                                Total {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]}
                            </Text>
                        </View>
                    )}

                    <Text style={styles.eventsTitle}>
                        {allSelectedPayments.length} cobro{allSelectedPayments.length !== 1 ? 's' : ''} programado{allSelectedPayments.length !== 1 ? 's' : ''}
                    </Text>
                    {allSelectedPayments.length === 0 ? (
                        <Text style={styles.noEvents}>No hay cobros este día</Text>
                    ) : (
                        allSelectedPayments.map((sub, idx) => (
                            <View key={idx} style={styles.eventItem}>
                                <View style={styles.eventInfo}>
                                    <Text style={styles.eventName}>
                                        {sub.clientId?.nombre || 'Cliente'}
                                    </Text>
                                    <Text style={styles.eventPlan}>{sub.planName}</Text>
                                </View>
                                <Text style={styles.eventAmount}>{sub.amount}€</Text>
                            </View>
                        ))
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    navBtn: {
        padding: 4,
    },
    monthTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    daysHeader: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    dayLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    todayCell: {
        backgroundColor: '#eff6ff',
        borderRadius: 20,
    },
    selectedCell: {
        backgroundColor: '#3b82f6',
        borderRadius: 20,
    },
    dayText: {
        fontSize: 12,
        color: '#334155',
    },
    todayText: {
        fontWeight: '700',
        color: '#3b82f6',
    },
    selectedText: {
        fontWeight: '700',
        color: '#fff',
    },
    indicator: {
        position: 'absolute',
        bottom: 2,
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    indicatorBlue: {
        backgroundColor: '#3b82f6',
    },
    indicatorRed: {
        backgroundColor: '#ef4444',
    },
    eventsSection: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    eventsTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
    },
    noEvents: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
    },
    eventItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    eventInfo: {
        flex: 1,
    },
    eventName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    eventPlan: {
        fontSize: 11,
        color: '#94a3b8',
    },
    eventAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    dailyTotalBox: {
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        alignItems: 'center',
    },
    dailyTotalAmount: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1e40af',
        letterSpacing: -0.5,
    },
    dailyTotalLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
});
