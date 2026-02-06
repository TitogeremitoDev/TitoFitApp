import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface NotificationContextType {
  unreadChat: number;
  unreadFeedbackReports: number;
  totalUnread: number;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadChat: 0,
  unreadFeedbackReports: 0,
  totalUnread: 0,
  refreshNotifications: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

const POLL_INTERVAL_FOREGROUND = 60000; // 60s when app is active
const POLL_INTERVAL_BACKGROUND = 0;     // No polling when in background

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadFeedbackReports, setUnreadFeedbackReports] = useState(0);
  const tokenRef = useRef(token);
  const appStateRef = useRef(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep tokenRef in sync without causing re-renders
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const fetchUnreadData = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;

    try {
      const [chatRes, feedbackRes] = await Promise.all([
        fetch(`${API_URL}/api/chat/total-unread`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        }),
        fetch(`${API_URL}/api/feedback-reports/unread-count`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        }).catch(() => null)
      ]);

      const isJsonResponse = (res: Response | null) =>
        res && res.ok && res.headers?.get('content-type')?.includes('application/json');

      const chatData = isJsonResponse(chatRes) ? await chatRes!.json() : { success: false };
      const feedbackData = isJsonResponse(feedbackRes) ? await feedbackRes!.json() : { success: false };

      if (chatData.success) {
        setUnreadChat(chatData.totalUnread || 0);
      }
      if (feedbackData.success) {
        setUnreadFeedbackReports(feedbackData.count || 0);
      }
    } catch {
      // Silent fail - network errors are expected
    }
  }, []);

  // Start/stop polling based on app state
  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    // Fetch immediately, then every 60s with jitter
    fetchUnreadData();
    const jitter = Math.floor(Math.random() * 5000);
    intervalRef.current = setInterval(fetchUnreadData, POLL_INTERVAL_FOREGROUND + jitter);
  }, [fetchUnreadData]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // Coming back to foreground: fetch immediately + restart polling
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        // Going to background: stop polling
        stopPolling();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  // Start polling when token is available
  useEffect(() => {
    if (token) {
      startPolling();
    } else {
      stopPolling();
      setUnreadChat(0);
      setUnreadFeedbackReports(0);
    }
    return () => stopPolling();
  }, [token, startPolling, stopPolling]);

  const value = useMemo(() => ({
    unreadChat,
    unreadFeedbackReports,
    totalUnread: unreadChat + unreadFeedbackReports,
    refreshNotifications: fetchUnreadData,
  }), [unreadChat, unreadFeedbackReports, fetchUnreadData]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
