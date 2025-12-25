const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Interceptar la resolución de sp-react-native-in-app-updates
// y redirigir al mock porque el paquete requiere código nativo
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Solo usar el mock en web - en Android/iOS usar el paquete real
    if (moduleName === 'sp-react-native-in-app-updates' && platform === 'web') {
        return {
            filePath: path.resolve(__dirname, 'mocks/sp-react-native-in-app-updates.js'),
            type: 'sourceFile',
        };
    }

    // Para todo lo demás, usar la resolución normal
    if (originalResolveRequest) {
        return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;