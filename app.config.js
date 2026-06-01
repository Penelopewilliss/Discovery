// Dynamic Expo config — reads secrets from environment variables.
// Copy .env.example → .env and fill in your keys before running expo prebuild.
export default ({ config }) => ({
  ...config,
  scheme: ['hiddengems', 'com.travlora.app'],
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'cover',
    backgroundColor: '#0A0A0F',
  },
  plugins: [
    'expo-video',
    'expo-system-ui',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow Discovery to use your location to show you nearby destinations.',
      },
    ],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        iosGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    ],
  ],
  ios: {
    ...config.ios,
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    },
  },
  android: {
    ...config.android,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0A0F',
    },
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
  },
});
