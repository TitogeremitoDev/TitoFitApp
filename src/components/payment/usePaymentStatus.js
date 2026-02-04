import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Clipboard, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';
const CACHE_KEY = 'cached_subscription_data';

/**
 * usePaymentStatus - Hook for the Payment Turnstile System
 * 
 * Returns the current payment level (0-3) and actions for the athlete
 * 
 * Level 0: No action needed (current or pending_verification)
 * Level 1: 2 days before payment (dismissable toast)
 * Level 2: Day of payment (friendly reminder)
 * Level 3: 1-5 days overdue (friendly reminder)
 * Level 4: >5 days overdue (blocking overlay with delay)
 */
export function usePaymentStatus() {
    const { token, user } = useAuth();

    const [state, setState] = useState({
        level: 0,
        status: 'current',
        subscription: null,
        coach: null,
        daysUntilPayment: null,
        daysOverdue: 0,
        amount: 0,
        isLoading: true,
        isReporting: false,
        isOnline: true,
        isCached: false,
        shouldShowWarning: false,
        error: null,
        dismissed: false
    });

    // Check if Level 2 was dismissed today
    const checkDismissedToday = useCallback(async (subscriptionId) => {
        if (!subscriptionId) return false;
        const today = new Date().toISOString().split('T')[0];
        const key = `payment_dismissed_${subscriptionId}_${today}`;
        const dismissed = await AsyncStorage.getItem(key);
        return dismissed === 'true';
    }, []);

    // Check if payment was reported recently (24h grace period)
    const checkReportedRecently = useCallback(async (subscriptionId) => {
        if (!subscriptionId) return false;
        const key = `payment_reported_${subscriptionId}`;
        const reported = await AsyncStorage.getItem(key);
        if (!reported) return false;

        const reportedTime = new Date(reported);
        const now = new Date();
        const hoursSinceReport = (now - reportedTime) / (1000 * 60 * 60);
        return hoursSinceReport < 24;
    }, []);

    // Fetch subscription data from API or cache
    const fetchSubscriptionData = useCallback(async () => {
        if (!token) {
            setState(prev => ({ ...prev, isLoading: false }));
            return { subscription: null, coach: null, shouldShowWarning: false, isCached: false, isOnline: false };
        }

        try {
            const response = await fetch(`${API_URL}/api/billing/my-subscription`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            // Cache successful response
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
                ...data,
                cachedAt: new Date().toISOString()
            }));

            return { ...data, isCached: false, isOnline: true };
        } catch (error) {
            console.log('[usePaymentStatus] API Error, trying cache:', error.message);

            // Try to load from cache
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                const data = JSON.parse(cached);
                console.log('[usePaymentStatus] Using cached data from:', data.cachedAt);
                return { ...data, isCached: true, isOnline: false };
            }

            // No cache available - default to safe state (Level 0)
            console.log('[usePaymentStatus] No cache, defaulting to Level 0');
            return {
                subscription: null,
                coach: null,
                shouldShowWarning: false,
                isCached: false,
                isOnline: false
            };
        }
    }, [token]);

    // Calculate payment level based on status and dates
    const calculateLevel = useCallback(async (data) => {
        if (!data || !data.subscription || !data.shouldShowWarning) {
            return 0; // No subscription or warnings disabled
        }

        const { paymentStatus, daysUntilPayment } = data.subscription;

        // Check for pending verification (24h grace)
        if (paymentStatus === 'pending_verification') {
            const recentlyReported = await checkReportedRecently(data.subscription._id);
            if (recentlyReported) return 0; // Grace period active
        }

        // Overdue Handling (Split into Level 3 and 4)
        if (paymentStatus === 'overdue' || paymentStatus === 'rejected' || daysUntilPayment < 0) {
            const overdueDays = Math.abs(daysUntilPayment);

            // Level 4: Aggressive (> 5 days)
            if (overdueDays > 5) return 4;

            // Level 3: Reminder (1-5 days)
            return 3;
        }

        // Level 2: Due today (check if dismissed)
        if (paymentStatus === 'due_today' || daysUntilPayment === 0) {
            const dismissed = await checkDismissedToday(data.subscription._id);
            return dismissed ? 0 : 2;
        }

        // Level 1: Upcoming (2 days or less)
        if (paymentStatus === 'upcoming' || (daysUntilPayment > 0 && daysUntilPayment <= 2)) {
            return 1;
        }

        return 0; // Current, no action needed
    }, [checkDismissedToday, checkReportedRecently]);

    // Main effect - fetch and calculate
    useEffect(() => {
        const init = async () => {
            setState(prev => ({ ...prev, isLoading: true }));

            const data = await fetchSubscriptionData();
            const level = await calculateLevel(data);

            setState({
                level,
                status: data.subscription?.paymentStatus || 'current',
                subscription: data.subscription,
                coach: data.coach,
                daysUntilPayment: data.subscription?.daysUntilPayment || null,
                daysOverdue: data.subscription?.daysUntilPayment < 0 ? Math.abs(data.subscription.daysUntilPayment) : 0,
                amount: data.subscription?.amount || 0,
                isLoading: false,
                isReporting: false,
                isOnline: data.isOnline !== false,
                isCached: data.isCached || false,
                shouldShowWarning: data.shouldShowWarning || false,
                error: null,
                dismissed: false
            });
        };

        init();
    }, [token, fetchSubscriptionData, calculateLevel]);

    // Actions
    const dismissToday = useCallback(async () => {
        if (!state.subscription?._id) return;

        const today = new Date().toISOString().split('T')[0];
        const key = `payment_dismissed_${state.subscription._id}_${today}`;
        await AsyncStorage.setItem(key, 'true');

        setState(prev => ({ ...prev, level: 0, dismissed: true }));
    }, [state.subscription]);

    const reportPayment = useCallback(async (note = '') => {
        if (!state.subscription?._id || !token) return;

        setState(prev => ({ ...prev, isReporting: true }));

        try {
            const response = await fetch(`${API_URL}/api/billing/report-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    subscriptionId: state.subscription._id,
                    note
                })
            });

            const data = await response.json();

            if (data.success) {
                // Store report time for 24h grace period
                await AsyncStorage.setItem(
                    `payment_reported_${state.subscription._id}`,
                    new Date().toISOString()
                );

                // Trigger haptic success
                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }

                setState(prev => ({
                    ...prev,
                    level: 0,
                    status: 'pending_verification',
                    isReporting: false
                }));

                return { success: true, message: data.message };
            } else {
                throw new Error(data.message || 'Error reporting payment');
            }
        } catch (error) {
            setState(prev => ({ ...prev, isReporting: false, error: error.message }));
            return { success: false, message: error.message };
        }
    }, [state.subscription, token]);

    const copyBizum = useCallback(() => {
        if (!state.coach?.bizumPhone) return;

        Clipboard.setString(state.coach.bizumPhone);

        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    }, [state.coach]);

    const openWhatsApp = useCallback(() => {
        if (!state.coach?.whatsappPhone) return;

        const phone = state.coach.whatsappPhone.replace(/[^0-9]/g, '');
        const message = encodeURIComponent(
            'Hola Coach, tengo un problema para renovar la suscripción en la app...'
        );

        Linking.openURL(`https://wa.me/${phone}?text=${message}`);
    }, [state.coach]);

    const refresh = useCallback(async () => {
        const data = await fetchSubscriptionData();
        const level = await calculateLevel(data);

        setState(prev => ({
            ...prev,
            level,
            status: data.subscription?.paymentStatus || 'current',
            subscription: data.subscription,
            coach: data.coach,
            isOnline: data.isOnline !== false,
            isCached: data.isCached || false,
            shouldShowWarning: data.shouldShowWarning || false
        }));
    }, [fetchSubscriptionData, calculateLevel]);

    return {
        // State
        ...state,
        userName: user?.nombre || 'Atleta',
        coachName: state.coach?.nombre || 'tu entrenador',
        bizumPhone: state.coach?.bizumPhone,

        // Actions
        dismissToday,
        reportPayment,
        copyBizum,
        openWhatsApp,
        refresh
    };
}

export default usePaymentStatus;
