import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'fr.pfa.veille', appName: 'Vigilio', webDir: 'dist',
  server: { androidScheme: 'https' },
  android: { backgroundColor: '#f6f7f3' },
};
export default config;
