// app/(app)/video-feedback/_layout.jsx
// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT PARA EL FLUJO DE VIDEO FEEDBACK
// ═══════════════════════════════════════════════════════════════════════════

import { Stack } from 'expo-router';

export default function VideoFeedbackLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: { backgroundColor: '#0a0a14' },
            }}
        >
            <Stack.Screen name="record" />
            <Stack.Screen name="preview" />
            <Stack.Screen name="success" />
        </Stack>
    );
}
