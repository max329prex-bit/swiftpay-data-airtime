import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.936f2282ca934c98a7c5acf89ba63eb0',
  appName: 'SwiftlyPay',
  webDir: 'dist',
  server: {
    url: 'https://936f2282-ca93-4c98-a7c5-acf89ba63eb0.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
