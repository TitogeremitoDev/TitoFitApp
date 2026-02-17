/**
 * usePushNotifications.ts
 * Programa notificaciones LOCALES para recordatorios de eventos.
 * No necesita FCM, APNs, ni google-services.json.
 * Flujo: login → fetch eventos → scheduleNotificationAsync() → el OS dispara la notif.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, AppState, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Foreground: mostrar ActionToast (en _layout.tsx), NO alerta nativa
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const REMINDER_LABELS: Record<number, string> = {
    1440: '1 día',
    120: '2 horas',
    60: '1 hora',
    30: '30 minutos',
    15: '15 minutos',
    10: '10 minutos',
    5: '5 minutos',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
    rutina: 'Rutina',
    dieta: 'Dieta',
    llamada: 'Llamada',
    presencial: 'Sesión Presencial',
    seguimiento: 'Revisión de Progreso',
    recordatorio: 'Recordatorio',
    otro: 'Evento',
};

// iOS permite max 64 notificaciones programadas
const MAX_SCHEDULED = 50;

interface PushNotificationState {
    notification: Notifications.Notification | null;
}

export function usePushNotifications(): PushNotificationState {
    const { token } = useAuth();
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const tokenRef = useRef(token);
    const syncingRef = useRef(false);

    useEffect(() => { tokenRef.current = token; }, [token]);

    // ═══════════════════════════════════════════════════════════════
    // SYNC: Descarga eventos y programa notificaciones locales
    // ═══════════════════════════════════════════════════════════════
    const syncEventReminders = useCallback(async () => {
        const authToken = tokenRef.current;
        if (!authToken || Platform.OS === 'web') return;
        if (syncingRef.current) return;
        syncingRef.current = true;

        try {
            // 1. Permisos
            let { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') {
                const result = await Notifications.requestPermissionsAsync();
                status = result.status;
            }
            if (status !== 'granted') return;

            // 2. Canal Android
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('event-reminders', {
                    name: 'Recordatorios de Eventos',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    sound: 'default',
                });
            }

            // 3. Cancelar recordatorios anteriores (prefijo "evt-")
            const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
            const toCancel = allScheduled.filter(n => n.identifier.startsWith('evt-'));
            await Promise.all(
                toCancel.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
            );

            // 4. Fetch eventos próximos 30 días con estado pendiente
            const now = new Date();
            const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const response = await fetch(
                `${API_URL}/api/events?startDate=${now.toISOString()}&endDate=${thirtyDays.toISOString()}&status=pendiente`,
                { headers: { Authorization: `Bearer ${authToken}` } }
            );
            const data = await response.json();
            if (!data.success || !data.events?.length) return;

            // 5. Programar notificaciones locales
            let count = 0;
            for (const event of data.events) {
                if (count >= MAX_SCHEDULED) break;
                if (!event.triggerReminders || !event.reminderOffsets?.length) continue;

                const eventDate = new Date(event.startDate);
                const eventTitle = event.title || EVENT_TYPE_LABELS[event.type] || 'Evento';

                for (const offset of event.reminderOffsets) {
                    if (count >= MAX_SCHEDULED) break;

                    const triggerDate = new Date(eventDate.getTime() - offset * 60 * 1000);
                    if (triggerDate <= now) continue; // ya pasó

                    const label = REMINDER_LABELS[offset] || `${offset} min`;
                    let body = `Tienes "${eventTitle}" en ${label}`;
                    if (event.reminderMessage) {
                        body += `\n${event.reminderMessage}`;
                    }

                    // Extraer URL del reminderMessage si existe
                    const urlMatch = event.reminderMessage?.match(/https?:\/\/[^\s]+/);

                    await Notifications.scheduleNotificationAsync({
                        identifier: `evt-${event._id}-${offset}`,
                        content: {
                            title: '📅 Recordatorio',
                            body,
                            sound: 'default',
                            data: {
                                type: 'event_reminder',
                                eventId: event._id,
                                eventType: event.type,
                                ...(urlMatch ? { url: urlMatch[0] } : {}),
                            },
                        },
                        trigger: {
                            type: Notifications.SchedulableTriggerInputTypes.DATE,
                            date: triggerDate,
                            ...(Platform.OS === 'android' ? { channelId: 'event-reminders' } : {}),
                        },
                    });
                    count++;
                }
            }

            if (__DEV__) {
                console.log(`[EventReminders] ✅ ${count} notificaciones locales programadas`);
            }
        } catch (err) {
            if (__DEV__) {
                console.error('[EventReminders] Error:', err);
            }
        } finally {
            syncingRef.current = false;
        }
    }, []);

    // Sync al hacer login (con delay para que auth se estabilice)
    useEffect(() => {
        if (!token || Platform.OS === 'web') return;
        const timeout = setTimeout(() => syncEventReminders(), 2000);
        return () => clearTimeout(timeout);
    }, [token, syncEventReminders]);

    // Re-sync al volver al foreground
    useEffect(() => {
        if (!token || Platform.OS === 'web') return;
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') syncEventReminders();
        });
        return () => sub.remove();
    }, [token, syncEventReminders]);

    // ═══════════════════════════════════════════════════════════════
    // LISTENERS: notificación recibida + tap
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (Platform.OS === 'web') return;

        const receivedSub = Notifications.addNotificationReceivedListener((n) => {
            setNotification(n);
        });

        const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data;
            // Si la notificación tiene URL, abrirla al tocar
            if (data?.url) {
                Linking.openURL(data.url as string).catch(() => {});
            }
        });

        return () => {
            receivedSub.remove();
            tapSub.remove();
        };
    }, []);

    return { notification };
}
