import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Image,
    Linking,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useTrainer } from '../../../context/TrainerContext';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/es';
import {
    EnhancedScrollView as ScrollView,
    EnhancedTouchable as TouchableOpacity,
} from '../../../components/ui';

moment.locale('es');

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

const EVENT_TYPE_META = {
    rutina: { icon: 'barbell', label: 'Rutina' },
    dieta: { icon: 'nutrition', label: 'Dieta' },
    llamada: { icon: 'call', label: 'Llamada' },
    presencial: { icon: 'people', label: 'Sesión Presencial' },
    seguimiento: { icon: 'analytics', label: 'Revisión de Progreso' },
    recordatorio: { icon: 'alarm', label: 'Recordatorio' },
    otro: { icon: 'calendar', label: 'Evento' },
};

const formatEventDate = (date) => {
    const m = moment(date);
    const isToday = m.isSame(moment(), 'day');
    const isTomorrow = m.isSame(moment().add(1, 'day'), 'day');
    if (isToday) return `Hoy a las ${m.format('HH:mm')}`;
    if (isTomorrow) return `Mañana a las ${m.format('HH:mm')}`;
    return m.format('dddd D [de] MMMM [a las] HH:mm');
};

const URL_PATTERN = /(https?:\/\/[^\s]+)/;

function LinkedText({ text, style, linkColor }) {
    const parts = text.split(URL_PATTERN);
    return (
        <Text style={style}>
            {parts.map((part, i) =>
                part.match(/^https?:\/\//) ? (
                    <Text
                        key={i}
                        style={{ color: linkColor, textDecorationLine: 'underline' }}
                        onPress={() => Linking.openURL(part)}
                    >
                        {part}
                    </Text>
                ) : (
                    <Text key={i}>{part}</Text>
                )
            )}
        </Text>
    );
}

function EventCard({ event, theme }) {
    const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.otro;
    const eventDate = moment(event.startDate);
    const isToday = eventDate.isSame(moment(), 'day');

    return (
        <View style={[styles.eventCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={[styles.dateBadge, { backgroundColor: isToday ? '#EF444420' : `${theme.primary}15` }]}>
                <Text style={[styles.dateBadgeDay, { color: isToday ? '#EF4444' : theme.primary }]}>
                    {eventDate.format('DD')}
                </Text>
                <Text style={[styles.dateBadgeMonth, { color: isToday ? '#EF4444' : theme.primary }]}>
                    {eventDate.format('MMM').toUpperCase()}
                </Text>
            </View>
            <View style={styles.eventDetails}>
                <View style={styles.eventTypeRow}>
                    <Ionicons name={meta.icon} size={14} color={theme.textSecondary} />
                    <Text style={[styles.eventTypeLabel, { color: theme.textSecondary }]}>
                        {meta.label}
                    </Text>
                </View>
                <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={2}>
                    {event.title || meta.label}
                </Text>
                <Text style={[styles.eventDateText, { color: theme.textSecondary }]}>
                    {formatEventDate(event.startDate)}
                </Text>
                {event.reminderMessage ? (
                    <View style={[styles.messageBubble, { backgroundColor: `${theme.primary}10` }]}>
                        <Ionicons name="chatbubble-outline" size={12} color={theme.primary} style={{ marginRight: 6 }} />
                        <LinkedText
                            text={event.reminderMessage}
                            style={[styles.messageText, { color: theme.textSecondary }]}
                            linkColor={theme.primary}
                        />
                    </View>
                ) : null}
            </View>
        </View>
    );
}

export default function Entrenador() {
    const { theme } = useTheme();
    const { token } = useAuth();
    const { trainer } = useTrainer();
    const router = useRouter();

    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchEvents = useCallback(async () => {
        if (!token) return;
        try {
            const now = new Date().toISOString();
            const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

            const response = await fetch(
                `${API_URL}/api/events?startDate=${now}&endDate=${thirtyDaysLater}&status=pendiente`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await response.json();

            if (data.success && data.events?.length > 0) {
                setEvents(data.events);
            } else {
                setEvents([]);
            }
        } catch (err) {
            console.error('[Entrenador] Error fetching events:', err);
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    return (
        <View style={[styles.root, { backgroundColor: theme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>MI ENTRENADOR</Text>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Trainer Info Card */}
                {trainer ? (
                    <View style={[styles.trainerCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                        <View style={styles.trainerRow}>
                            {trainer.avatarUrl || trainer.profile?.logoUrl ? (
                                <Image
                                    source={{ uri: trainer.avatarUrl || trainer.profile?.logoUrl }}
                                    style={styles.trainerAvatar}
                                />
                            ) : (
                                <View style={[styles.trainerAvatarPlaceholder, { backgroundColor: `${theme.primary}20` }]}>
                                    <Ionicons name="person" size={28} color={theme.primary} />
                                </View>
                            )}
                            <View style={styles.trainerInfo}>
                                <Text style={[styles.trainerName, { color: theme.text }]}>
                                    {trainer.nombre || 'Entrenador'}
                                </Text>
                                {trainer.profile?.brandName ? (
                                    <Text style={[styles.trainerBrand, { color: theme.textSecondary }]}>
                                        {trainer.profile.brandName}
                                    </Text>
                                ) : null}
                                <Text style={[styles.trainerEmail, { color: theme.textTertiary }]}>
                                    {trainer.email}
                                </Text>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={[styles.trainerCard, { backgroundColor: theme.cardBackground, borderColor: theme.border, padding: 24 }]}>
                        <ActivityIndicator size="small" color={theme.primary} />
                    </View>
                )}

                {/* Events Section */}
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Próximos eventos
                </Text>

                {isLoading ? (
                    <View style={[styles.loadingCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                        <ActivityIndicator size="small" color={theme.primary} />
                    </View>
                ) : events.length > 0 ? (
                    <View style={styles.eventsList}>
                        {events.map((event) => (
                            <EventCard key={event._id} event={event} theme={theme} />
                        ))}
                    </View>
                ) : (
                    <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                        <Ionicons name="calendar-outline" size={40} color={theme.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>
                            Sin eventos próximos
                        </Text>
                        <Text style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
                            Tu entrenador aún no ha programado eventos para los próximos 30 días
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 0,
        paddingBottom: 40,
    },
    trainerCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 24,
    },
    trainerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    trainerAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    trainerAvatarPlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    trainerInfo: {
        flex: 1,
        marginLeft: 14,
    },
    trainerName: {
        fontSize: 17,
        fontWeight: '700',
    },
    trainerBrand: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    trainerEmail: {
        fontSize: 12,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    eventsList: {
        gap: 10,
    },
    eventCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    loadingCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateBadge: {
        width: 52,
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    dateBadgeDay: {
        fontSize: 20,
        fontWeight: '800',
        lineHeight: 22,
    },
    dateBadgeMonth: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    eventDetails: {
        flex: 1,
    },
    eventTypeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    eventTypeLabel: {
        fontSize: 11,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    eventTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    eventDateText: {
        fontSize: 13,
    },
    messageBubble: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 8,
        padding: 8,
        borderRadius: 8,
    },
    messageText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 16,
    },
    emptyCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 32,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginTop: 12,
    },
    emptySubtitle: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
    },
});
