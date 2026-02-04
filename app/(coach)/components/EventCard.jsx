import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

const EVENT_TYPES = {
    'rutina': { color: '#3b82f6', icon: 'barbell', label: 'Rutina' },
    'dieta': { color: '#10b981', icon: 'nutrition', label: 'Dieta' },
    'llamada': { color: '#f59e0b', icon: 'call', label: 'Llamada' },
    'presencial': { color: '#8b5cf6', icon: 'people', label: 'Presencial' },
    'seguimiento': { color: '#ec4899', icon: 'analytics', label: 'Seguimiento' },
    'recordatorio': { color: '#ef4444', icon: 'alarm', label: 'Recordatorio' },
    'otro': { color: '#64748b', icon: 'bookmark', label: 'Otro' },
    'default': { color: '#94a3b8', icon: 'calendar', label: 'Evento' }
};

const EventCard = ({ event, onPress, isSuggestion = false }) => {
    const typeConfig = EVENT_TYPES[event.type] || EVENT_TYPES['default'];
    const time = moment(event.startDate).format('HH:mm');

    return (
        <TouchableOpacity
            style={[
                styles.card,
                isSuggestion && styles.suggestionCard,
                event.isVirtual && styles.virtualCard
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.indicator, { backgroundColor: typeConfig.color }]} />

            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.time}>{time}</Text>
                    {isSuggestion && (
                        <View style={styles.aiBadge}>
                            <Ionicons name="sparkles" size={10} color="#fff" />
                            <Text style={styles.aiText}>IA</Text>
                        </View>
                    )}
                </View>

                <Text style={styles.title} numberOfLines={1}>
                    {event.athleteId?.nombre || 'Atleta'}
                </Text>

                <View style={styles.typeRow}>
                    <Ionicons name={typeConfig.icon} size={12} color={typeConfig.color} />
                    <Text style={[styles.typeText, { color: typeConfig.color }]}>
                        {typeConfig.label}
                    </Text>
                </View>

                {event.description ? (
                    <Text style={styles.description} numberOfLines={2}>
                        {event.description}
                    </Text>
                ) : null}
            </View>

            <TouchableOpacity style={styles.actionBtn}>
                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    suggestionCard: {
        borderColor: '#a855f7', // Purple logic for AI
        backgroundColor: '#faf5ff'
    },
    virtualCard: {
        borderStyle: 'dashed',
        backgroundColor: '#f8fafc',
        opacity: 0.9
    },
    indicator: {
        width: 4,
        height: '100%',
    },
    content: {
        flex: 1,
        padding: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    time: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
        marginRight: 8,
    },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#a855f7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    aiText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    typeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    typeText: {
        fontSize: 11,
        marginLeft: 4,
        fontWeight: '500',
    },
    description: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 4,
    },
    actionBtn: {
        justifyContent: 'center',
        paddingHorizontal: 12,
        borderLeftWidth: 1,
        borderLeftColor: '#f1f5f9',
    }
});

export default EventCard;
