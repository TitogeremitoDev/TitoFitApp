// FIX: Polyfill localStorage for SSR/Node.js context
// Node.js 25 provides an experimental localStorage that is BROKEN without --localstorage-file
// (localStorage exists but getItem is not a function). We must replace it entirely.
// expo-notifications calls localStorage.getItem at module load time.
if (typeof globalThis !== 'undefined' &&
    (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function')) {
    const _data = {};
    globalThis.localStorage = {
        getItem(key) { return _data[key] ?? null; },
        setItem(key, value) { _data[key] = String(value); },
        removeItem(key) { delete _data[key]; },
        clear() { Object.keys(_data).forEach(k => delete _data[k]); },
        key(i) { return Object.keys(_data)[i] ?? null; },
        get length() { return Object.keys(_data).length; },
    };
}

import { registerRootComponent } from 'expo';
import 'react-native-gesture-handler';
import App from './app';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
