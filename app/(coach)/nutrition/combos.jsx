/* app/(coach)/nutrition/combos.jsx
 * Redirect to food-library combos tab (native integration)
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function CombosRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/(coach)/food-library?tab=combos');
    }, []);

    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
            <ActivityIndicator size="large" color="#d97706" />
        </View>
    );
}
