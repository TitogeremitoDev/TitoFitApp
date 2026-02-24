/**
 * withUnmountOnBlur - HOC that unmounts screen content when not focused (web only)
 *
 * On web, Expo Router's NativeStackNavigator never unmounts screens — they
 * accumulate with display:none. Two heavy screens (5000+ DOM nodes each)
 * crash Chrome's renderer. This HOC forces a null render when the screen
 * loses focus, freeing all DOM nodes.
 *
 * On native, screens are managed properly by the OS, so this is a no-op.
 */
import React from 'react';
import { Platform, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

export function withUnmountOnBlur(WrappedComponent) {
    if (Platform.OS !== 'web') return WrappedComponent;

    return function UnmountOnBlurWrapper(props) {
        const isFocused = useIsFocused();
        if (!isFocused) return <View />;
        return <WrappedComponent {...props} />;
    };
}
