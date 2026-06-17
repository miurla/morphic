import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor hosted-shell configuration (Phase A).
 *
 * Architecture: Next.js App Router + React PWA → Capacitor → iOS / Android
 *
 * The native WebView loads the hosted Morphic app via server.url.
 * webDir ('capacitor-shell') is a committed placeholder; see docs/NATIVE_RUNTIME_ARCHITECTURE.md.
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

  // Committed placeholder shell directory — satisfies Capacitor's webDir requirement.
  // In hosted-shell mode (server.url set), this directory is not served to users.
  // See capacitor-shell/index.html for details.
  webDir: 'capacitor-shell',

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
