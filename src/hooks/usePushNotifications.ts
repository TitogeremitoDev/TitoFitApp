/**
 * usePushNotifications.ts
 * Gestiona notificaciones push (registro de token remoto + programación local).
 * 
 * Flujo completo:
 * 1. Login → permisos → getExpoPushTokenAsync() → POST /register-token (backend)
 * 2. Fetch eventos → scheduleNotificationAsync() (notificaciones locales del OS)
 * 3. El scheduler del backend también envía push remotos vía Expo Push API
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, AppState, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Foreground: push remotos (feedback, dieta, rutina) → alerta del sistema
// Locales (event_reminder) → NO alerta (ya se manejan con ActionToast en _layout.tsx)
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const trigger = notification.request.trigger as any;
        const isLocal = trigger?.type === 'calendar'
            || trigger?.type === 'date'
            || notification.request.identifier?.startsWith('evt-');
        return {
            shouldShowAlert: !isLocal, // Push remotos: alerta. Locales: solo toast.
            shouldShowBanner: !isLocal,
            shouldShowList: !isLocal,
            shouldPlaySound: true,
            shouldSetBadge: false,
        };
    },
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
    const lastSyncRef = useRef(0); // Timestamp del último sync exitoso
    const pushTokenRegisteredRef = useRef(false);

    useEffect(() => { tokenRef.current = token; }, [token]);

    // Reset registration flag on logout (token becomes null)
    useEffect(() => {
        if (!token) {
            pushTokenRegisteredRef.current = false;
        }
    }, [token]);

    // ═══════════════════════════════════════════════════════════════
    // REGISTRO DE PUSH TOKEN EN EL BACKEND (Expo Push API)
    // Se ejecuta una sola vez por sesión. Envía el Expo Push Token
    // al backend para que el scheduler pueda enviar push remotos.
    // ═══════════════════════════════════════════════════════════════
    const registerPushToken = useCallback(async (authToken: string) => {
        if (pushTokenRegisteredRef.current) return;

        try {
            // Obtener el projectId de la config de Expo
            const projectId = Constants.expoConfig?.extra?.eas?.projectId;
            if (!projectId) {
                if (__DEV__) console.warn('[PushToken] No se encontró projectId en expoConfig');
                return;
            }

            // Obtener el Expo Push Token (mapea a FCM en Android, APNs en iOS)
            const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            const expoPushToken = pushTokenData.data;

            if (__DEV__) {
                console.log(`[PushToken] 🔑 Token obtenido: ${expoPushToken.slice(0, 30)}...`);
            }

            // Registrar en el backend
            const res = await fetch(`${API_URL}/api/notifications/register-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ token: expoPushToken }),
            });

            const data = await res.json();

            if (data.success) {
                pushTokenRegisteredRef.current = true;
                if (__DEV__) {
                    console.log('[PushToken] ✅ Token registrado en el backend');
                }
            } else {
                if (__DEV__) {
                    console.warn('[PushToken] ⚠️ Backend rechazó el token:', data.message);
                }
            }
        } catch (error: any) {
            if (__DEV__) {
                console.error('[PushToken] ❌ Error registrando push token:', error.message);
            }
            // Reportar fallo al endpoint de debug (fire-and-forget)
            fetch(`${API_URL}/api/notifications/debug`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    step: 'registerPushToken',
                    error: error.message,
                    platform: Platform.OS,
                }),
            }).catch(() => { });
        }
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // SYNC: Descarga eventos y programa notificaciones locales
    // ═══════════════════════════════════════════════════════════════
    const SYNC_THROTTLE_MS = 5 * 60 * 1000; // No re-sincronizar más de 1 vez cada 5 min

    const syncEventReminders = useCallback(async (force = false) => {
        const authToken = tokenRef.current;
        if (!authToken || Platform.OS === 'web') return;
        if (syncingRef.current) return;

        // Throttle: evitar re-sync excesivo al cambiar entre apps
        const now = Date.now();
        if (!force && now - lastSyncRef.current < SYNC_THROTTLE_MS) return;

        syncingRef.current = true;

        try {
            // 1. Permisos
            let { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') {
                const result = await Notifications.requestPermissionsAsync();
                status = result.status;
            }
            if (status !== 'granted') return;

            // 2. Canales Android
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Notificaciones',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    sound: 'default',
                });
                await Notifications.setNotificationChannelAsync('event-reminders', {
                    name: 'Recordatorios de Eventos',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    sound: 'default',
                });
            }

            // 3. Registrar push token en el backend (una vez por sesión)
            await registerPushToken(authToken);

            // 4. Cancelar recordatorios anteriores (prefijo "evt-")
            const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
            const toCancel = allScheduled.filter(n => n.identifier.startsWith('evt-'));
            await Promise.all(
                toCancel.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
            );

            // 5. Fetch eventos próximos 30 días con estado pendiente
            const currentDate = new Date();
            const thirtyDays = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000);

            const response = await fetch(
                `${API_URL}/api/events?startDate=${currentDate.toISOString()}&endDate=${thirtyDays.toISOString()}&status=pendiente`,
                { headers: { Authorization: `Bearer ${authToken}` } }
            );
            const data = await response.json();
            if (!data.success || !data.events?.length) return;

            // 6. Programar notificaciones locales
            let count = 0;
            for (const event of data.events) {
                if (count >= MAX_SCHEDULED) break;
                if (!event.triggerReminders || !event.reminderOffsets?.length) continue;

                const eventDate = new Date(event.startDate);
                const eventTitle = event.title || EVENT_TYPE_LABELS[event.type] || 'Evento';

                for (const offset of event.reminderOffsets) {
                    if (count >= MAX_SCHEDULED) break;

                    const triggerDate = new Date(eventDate.getTime() - offset * 60 * 1000);
                    if (triggerDate <= currentDate) continue; // ya pasó

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

            lastSyncRef.current = Date.now();

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

    // Sync al hacer login (force=true para ignorar throttle)
    useEffect(() => {
        if (!token || Platform.OS === 'web') return;
        const timeout = setTimeout(() => syncEventReminders(true), 2000);
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
                Linking.openURL(data.url as string).catch(() => { });
            }
        });

        return () => {
            receivedSub.remove();
            tapSub.remove();
        };
    }, []);

    return { notification };
}
