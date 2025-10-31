// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // (si usas expo-router)
      'expo-router/babel',
      // SIEMPRE el último: requerido por Reanimated
      'react-native-reanimated/plugin',
    ],
  };
};

