// Mock para sp-react-native-in-app-updates durante desarrollo
// En producción (builds con EAS), se usa el paquete real

const IAUUpdateKind = {
    FLEXIBLE: 0,
    IMMEDIATE: 1,
};

class SpInAppUpdates {
    constructor(isDebug) {
        if (isDebug) {
            console.log('[InAppUpdates Mock] Inicializado en modo desarrollo');
        }
    }

    async checkNeedsUpdate() {
        // En desarrollo, siempre retornar que no hay actualización
        return {
            shouldUpdate: false,
            storeVersion: '1.0.0',
            currentVersion: '1.0.0',
        };
    }

    async startUpdate(options) {
        console.log('[InAppUpdates Mock] startUpdate llamado con:', options);
        return Promise.resolve();
    }
}

module.exports = {
    default: SpInAppUpdates,
    IAUUpdateKind,
};
