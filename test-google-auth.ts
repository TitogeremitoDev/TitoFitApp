// test-google-auth.ts
import * as Crypto from 'expo-crypto';

async function testGoogleAuthConfig() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TESTING GOOGLE AUTH CONFIGURATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || 'dev';
  const ANDROID_DEV = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_DEV;
  const ANDROID_INTERNAL = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_INTERNAL;
  const ANDROID_PROD = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_PROD;
  const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  
  console.log('Environment:', APP_ENV);
  console.log('Android DEV ID:', ANDROID_DEV);
  console.log('Android INTERNAL ID:', ANDROID_INTERNAL);
  console.log('Android PROD ID:', ANDROID_PROD);
  console.log('Web Client ID:', WEB_CLIENT_ID);
  
  const androidClientId =
    APP_ENV === 'prod'
      ? ANDROID_PROD
      : APP_ENV === 'internal'
      ? ANDROID_INTERNAL
      : ANDROID_DEV;
  
  console.log('\nSelected Android Client:', androidClientId);
  
  // Test redirect URI format
  const redirectUri = `com.german92.titofitapp:/oauthredirect`;
  console.log('Redirect URI:', redirectUri);
  
  // Test URL encoding
  const encodedRedirectUri = encodeURIComponent(redirectUri);
  console.log('Encoded Redirect URI:', encodedRedirectUri);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

testGoogleAuthConfig();