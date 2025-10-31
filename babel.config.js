<<<<<<< HEAD
// babel.config.js
=======
>>>>>>> 5f1b8eda6ef10d87f4d5ced35f60636c46b4f368
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
<<<<<<< HEAD
    plugins: [
      // (si usas expo-router)
      'expo-router/babel',
      // SIEMPRE el último: requerido por Reanimated
      'react-native-reanimated/plugin',
    ],
  };
};

=======
    plugins: ['react-native-reanimated/plugin'], // ¡último!
  };
};
>>>>>>> 5f1b8eda6ef10d87f4d5ced35f60636c46b4f368
