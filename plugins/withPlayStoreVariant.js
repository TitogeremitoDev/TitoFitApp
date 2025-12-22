const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Config plugin para añadir missingDimensionStrategy para react-native-iap
 * Esto le dice a Gradle que use la variante 'play' (Google Play) en lugar de 'amazon'
 */
const withPlayStoreVariant = (config) => {
    return withAppBuildGradle(config, (config) => {
        const buildGradle = config.modResults.contents;

        // Buscar el bloque defaultConfig y añadir missingDimensionStrategy
        if (!buildGradle.includes("missingDimensionStrategy")) {
            const defaultConfigRegex = /defaultConfig\s*\{/;
            const match = buildGradle.match(defaultConfigRegex);

            if (match) {
                const insertPosition = match.index + match[0].length;
                const before = buildGradle.substring(0, insertPosition);
                const after = buildGradle.substring(insertPosition);

                config.modResults.contents =
                    before +
                    "\n        // Forzar variante Play Store para react-native-iap\n        missingDimensionStrategy 'store', 'play'" +
                    after;
            }
        }

        return config;
    });
};

module.exports = withPlayStoreVariant;
