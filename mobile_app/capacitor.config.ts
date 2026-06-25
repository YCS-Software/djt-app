import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ycssoftware.djtapp',
  appName: 'DJT HAIKA',
  webDir: 'out',
  server: {
    androidScheme: 'http',
    hostname: 'localhost',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  }
};

export default config;
