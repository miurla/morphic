import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor hosted-shell configuration (Phase A).
 *
 * Architecture: Next.js App Router + React PWA → Capacitor → iOS / Android
 *
 * The native WebView loads the hosted Morphic app via server.url.
 * webDir ('out') is the target for future static export in Phase B.
 *
 * SECURITY NOTES (see docs/NATIVE_SAFETY.md):
 * - loggingBehavior is 'none' — never enable in production builds
 * - cleartext is false — HTTPS only, no plain HTTP
 * - No API keys or provider secrets should ever enter the native bundle
 *
 * App ID decision:
 *   appId becomes the iOS Bundle ID and Android Application ID.
 *   It cannot be changed after app store submission.
 *   Current value: 'social.morphic.app' — update before store submission.
 */
const config: CapacitorConfig = {
  appId: 'social.morphic.app',
  appName: 'Morphic',

  // Points to built static assets (needed by Capacitor; used in Phase B static export).
  // In hosted-shell mode (server.url set), this directory is not served locally.
  webDir: 'out',

  server: {
    // Native WebView loads the hosted production app.
    // For local dev testing, swap to: 'http://localhost:3000' and set cleartext: true.
    url: 'https://morphic.sh',
    cleartext: false // require HTTPS; never allow cleartext in production
  },

  // Never log in production — Capacitor docs warn logs are visible on-device.
  // Use 'debug' only during local development; revert to 'none' before any release.
  loggingBehavior: 'none',

  ios: {
    // iOS-specific overrides go here as needed.
    // Preferred content mode for iPad: 'mobile' keeps the phone layout on larger screens.
    preferredContentMode: 'mobile'
  },

  android: {
    // Android-specific overrides go here as needed.
  }
}

export default config
