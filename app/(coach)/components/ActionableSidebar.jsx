import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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

    return (
        <View style={styles.container}>
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
                {/* AI Suggestions Section - Always visible if relevant */}
                {suggestions.length > 0 && selectedDate && moment(selectedDate).isSame(new Date(), 'day') && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Sugerencias IA</Text>
                        {suggestions.map((suggestion, index) => (
                            <EventCard
                                key={`sugg-${index}`}
                                event={{
                                    type: 'seguimiento', // hardcoded for now based on logic
                                    startDate: new Date(),
                                    athleteId: suggestion.client,
                                    description: suggestion.description
                                }}
                                isSuggestion={true}
                                onPress={() => handleCreateSuggestion(suggestion)}
                            />
                        ))}
                    </View>
                )}

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
            </ScrollView>

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
                initialEvent={selectedEvent} // Pass the event for editing
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
        padding: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    addButton: {
        backgroundColor: '#2563EB',
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterScroll: {
        maxHeight: 40,
        marginBottom: 16,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        paddingBottom: 8,
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 8,
        marginBottom: 8,
    },
    filterChipActive: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
    },
    filterText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
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
    }
});

export default ActionableSidebar;
