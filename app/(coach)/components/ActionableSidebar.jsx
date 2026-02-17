import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import MiniCalendar from './MiniCalendar';
import EventCard from './EventCard';
import CreateEventModal from './CreateEventModal';
import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

const FILTERS = [
    { id: 'all', label: 'Todo' },
    { id: 'rutina', label: 'Rutinas' },
    { id: 'dieta', label: 'Dietas' },
    { id: 'llamada', label: 'Llamadas' },
    { id: 'presencial', label: 'Presencial' },
    { id: 'seguimiento', label: 'Seguimiento' },
];

const ActionableSidebar = ({ clients = [], refreshTrigger = 0 }) => {
    const { token } = useAuth();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [createModalVisible, setCreateModalVisible] = useState(false);

    // Fetch events for the month (to populate dots) and selected date
    const fetchEvents = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            // Get range for current month view ? simplified: get range of +/- 1 month
            // Actually, for dots we need month data.
            // For now, let's fetch current month + selected date events.
            const startOfMonth = moment(selectedDate).startOf('month').toISOString();
            const endOfMonth = moment(selectedDate).endOf('month').toISOString();

            const response = await fetch(`${API_URL}/api/events?startDate=${startOfMonth}&endDate=${endOfMonth}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setEvents(data.events);
            }
        } catch (error) {
            console.error('Error fetching events:', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate, token]);

    const fetchSuggestions = useCallback(async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/api/events/suggestions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setSuggestions(data.suggestions);
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }, [token]);

    useEffect(() => {
        fetchEvents();
        fetchSuggestions();
    }, [fetchEvents, fetchSuggestions, refreshTrigger]);

    // Filter events for display
    const filteredEvents = events.filter(event => {
        const isSameDay = moment(event.startDate).isSame(selectedDate, 'day');
        const matchesType = activeFilter === 'all' || event.type === activeFilter;
        return isSameDay && matchesType;
    });

    const handleCreateSuggestion = async (suggestion) => {
        // Implement logic to quick-create event from suggestion
        try {
            const eventData = {
                ...suggestion.suggestedAction,
                startDate: new Date(), // Default to now? or ask user?
                endDate: moment().add(1, 'hour').toDate()
            };
            // Ideally open a modal pre-filled. For now, just log or simple create.
            console.log('Create suggestion:', eventData);
            alert('Funcionalidad de creación rápida en desarrollo');
        } catch (error) {
            console.error(error);
        }
    };

    const [selectedEvent, setSelectedEvent] = useState(null);

    // ... (fetchEvents, fetchSuggestions, filteredEvents logic unchanged)

    const handleEventPress = (event) => {
        setSelectedEvent(event);
        setCreateModalVisible(true);
    };

    const handleSaveEvent = async (eventData) => {
        try {
            const method = selectedEvent ? 'PUT' : 'POST';
            const url = selectedEvent
                ? `${API_URL}/api/events/${selectedEvent.originalEventId || selectedEvent._id}` // Handle virtual IDs
                : `${API_URL}/api/events`;

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(eventData)
            });
            const data = await response.json();
            if (data.success) {
                fetchEvents();
                fetchSuggestions();
            } else {
                alert(data.message || 'Error al guardar');
            }
        } catch (error) {
            console.error(error);
            alert('Error al conectar con servidor');
        }
    };

    const handleDeleteEvent = async (deleteSeries = false) => {
        if (!selectedEvent) return;

        try {
            // For virtual events, we need the ID + the specific date for exclusion
            const eventId = selectedEvent._id; // This might be "realID_timestamp" if virtual
            const url = `${API_URL}/api/events/${eventId}?deleteSeries=${deleteSeries}&date=${selectedEvent.startDate}`;

            const response = await fetch(url, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await response.json();
            if (data.success) {
                setCreateModalVisible(false);
                setSelectedEvent(null);
                fetchEvents();
            } else {
                alert(data.message || 'Error al eliminar');
            }
        } catch (error) {
            console.error(error);
            alert('Error al eliminar');
        }
    };

    const [expandedAI, setExpandedAI] = useState(false);

    // Find next day with events
    const nextDateWithEvents = React.useMemo(() => {
        if (!events.length) return null;

        const startOfNextDay = moment(selectedDate).add(1, 'day').startOf('day');
        // Filter events strictly after selected date (next day onwards)
        // Sort by date ascending
        const futureEvents = events
            .filter(e => moment(e.startDate).isSameOrAfter(startOfNextDay))
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        if (futureEvents.length > 0) {
            const firstNextEvent = futureEvents[0];
            const nextDayMoment = moment(firstNextEvent.startDate);
            // Get events for that specific day
            const dayEvents = futureEvents.filter(e => moment(e.startDate).isSame(nextDayMoment, 'day'));

            return {
                date: nextDayMoment.toDate(),
                events: dayEvents,
                count: dayEvents.length,
                label: nextDayMoment.calendar(null, {
                    sameDay: '[Hoy]',
                    nextDay: '[Mañana]',
                    nextWeek: 'dddd D',
                    lastDay: '[Ayer]',
                    lastWeek: '[El] dddd [pasado]',
                    sameElse: 'DD/MM/YYYY'
                })
            };
        }
        return null;
    }, [events, selectedDate]);

    return (
        <View style={styles.container}>
            {/* ... (Header, Calendar, Filters, Divider) */}
            <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Agenda Inteligente</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => {
                        setSelectedEvent(null);
                        setCreateModalVisible(true);
                    }}
                >
                    <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            <MiniCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                events={events}
            />

            {/* Filters */}
            <View style={{ marginBottom: 16 }}>
                <View style={styles.filterRow}>
                    {FILTERS.map(filter => (
                        <TouchableOpacity
                            key={filter.id}
                            style={[
                                styles.filterChip,
                                activeFilter === filter.id && styles.filterChipActive
                            ]}
                            onPress={() => setActiveFilter(filter.id)}
                        >
                            <Text style={[
                                styles.filterText,
                                activeFilter === filter.id && styles.filterTextActive
                            ]}>{filter.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.divider} />

            <ScrollView style={styles.eventList} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionTitle}>
                    Eventos del {moment(selectedDate).format('D MMMM')}
                </Text>

                {isLoading ? (
                    <ActivityIndicator color="#2563EB" />
                ) : filteredEvents.length > 0 ? (
                    filteredEvents.map(event => (
                        <EventCard
                            key={event._id}
                            event={event}
                            onPress={() => handleEventPress(event)}
                        />
                    ))
                ) : (
                    <Text style={styles.emptyText}>No hay eventos para este día.</Text>
                )}

                {/* Next Day Events List*/}
                {nextDateWithEvents && (
                    <View style={{ marginTop: 24, paddingBottom: 16 }}>
                        <Text style={styles.sectionTitle}>
                            Eventos del {nextDateWithEvents.label}
                        </Text>
                        {nextDateWithEvents.events.map(event => (
                            <EventCard
                                key={event._id}
                                event={event}
                                onPress={() => handleEventPress(event)}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* AI Suggestions Footer */}
            {suggestions.length > 0 && selectedDate && moment(selectedDate).isSame(new Date(), 'day') && (
                <View style={styles.aiFooterContainer}>
                    <TouchableOpacity
                        style={styles.aiHeader}
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setExpandedAI(!expandedAI);
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="sparkles" size={16} color="#9333ea" />
                            <Text style={styles.aiTitle}>Sugerencias IA</Text>
                            <View style={styles.aiBadge}>
                                <Text style={styles.aiBadgeText}>{suggestions.length}</Text>
                            </View>
                        </View>
                        <Ionicons name={expandedAI ? "chevron-down" : "chevron-up"} size={16} color="#64748b" />
                    </TouchableOpacity>

                    {expandedAI && (
                        <ScrollView style={styles.aiContent} nestedScrollEnabled>
                            {suggestions.map((suggestion, index) => (
                                <EventCard
                                    key={`sugg-${index}`}
                                    event={{
                                        type: 'seguimiento', // hardcoded for now
                                        startDate: new Date(),
                                        athleteId: suggestion.client,
                                        description: suggestion.description
                                    }}
                                    isSuggestion={true}
                                    onPress={() => handleCreateSuggestion(suggestion)}
                                />
                            ))}
                        </ScrollView>
                    )}
                </View>
            )}

            <CreateEventModal
                visible={createModalVisible}
                onClose={() => {
                    setCreateModalVisible(false);
                    setSelectedEvent(null);
                }}
                onSave={handleSaveEvent}
                onDelete={handleDeleteEvent}
                initialDate={selectedDate}
                clients={clients}
                initialEvent={selectedEvent}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff', // White background
        padding: 24, // More padding
        borderLeftWidth: 1,
        borderLeftColor: '#f1f5f9'
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800', // Boldest
        color: '#0f172a',
        letterSpacing: -0.5
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    addButton: {
        backgroundColor: '#3b82f6', // Bright blue
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#3b82f6",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
    },
    // ...
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6, // Reduced gap
        marginBottom: 24,
    },
    filterChip: {
        paddingHorizontal: 10, // Reduced padding
        paddingVertical: 6, // Reduced padding
        borderRadius: 100, // Pill shape
        backgroundColor: '#f8fafc',
        borderWidth: 0, // No border by default
    },
    filterChipActive: {
        backgroundColor: '#2563EB',
    },
    filterText: {
        fontSize: 11, // Smaller font
        fontWeight: '600',
        color: '#64748b',
    },
    filterTextActive: {
        color: '#ffffff',
    },
    divider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        marginBottom: 16,
    },
    eventList: {
        flex: 1,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94a3b8',
        textTransform: 'uppercase',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 20,
    },
    aiFooterContainer: {
        marginTop: 'auto',
        marginHorizontal: -24,
        marginBottom: -24,
        paddingHorizontal: 24,
        paddingBottom: 24, // Restore padding
        backgroundColor: '#faf5ff',
        borderTopWidth: 1,
        borderTopColor: '#f3e8ff',
    },
    aiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
    },
    aiTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#9333ea'
    },
    aiBadge: {
        backgroundColor: '#d8b4fe',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: 'center'
    },
    aiBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#fff'
    },
    aiContent: {
        maxHeight: 250,
        paddingBottom: 12
    }
});

export default ActionableSidebar;
