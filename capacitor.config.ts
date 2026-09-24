import type { CapacitorConfig } from '@capacitor/cli';

// Saturday Foundry iOS wrapper.
// Loads the live production site so every push to main updates the app instantly.
// No bundled web copy: webDir is required by the CLI but unused when server.url is set.
const config: CapacitorConfig = {
  appId: 'com.saturdayfoundry.app',
  appName: 'Saturday Foundry',
  webDir: 'www',
  server: {
    url: 'https://carp09-ops.github.io/Saturday-Foundry-App/',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
