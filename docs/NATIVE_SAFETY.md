# Native Safety Policy

This document defines the security constraints for the Morphic Capacitor native shell.

## Why This Exists

Capacitor wraps the Morphic web app in a native iOS/Android WebView. Without explicit constraints,
it is easy to accidentally introduce security regressions (logging sensitive data, caching secrets,
or distributing API keys in the app bundle).

---

## Rules

### 1. No Production Logging

**`loggingBehavior` must be `'none'` in `capacitor.config.ts` for any release build.**

Capacitor logs are visible via `adb logcat` on Android and `Console.app` on iOS. Any sensitive data
(auth tokens, search queries, user content, API responses) that flows through the WebView console
will be readable by anyone with device access or a connected debugger.

- `'debug'` is permitted **only** during local development on a personal device.
- **Revert to `'none'` before committing a release config.**

### 2. No API Keys in the Native Bundle

The Morphic architecture routes all AI provider calls through server-side API routes.
This must remain true for the native shell.

- No AI provider secrets (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, etc.) in the app bundle.
- No `.env` files or secret config committed inside `ios/` or `android/`.
- Server-side secrets stay on the server (Vercel env vars, Railway, etc.).

### 3. No Caching Sensitive Data in Native Storage

Capacitor provides access to native storage plugins (`@capacitor/preferences`, `@capacitor/filesystem`).
Until an explicit encryption policy is defined and reviewed, **do not store**:

- Auth tokens or session cookies via native storage
- Chat/search history or query terms
- Uploaded file content or metadata
- AI provider responses

Persistent state for the app continues to be managed by the server-side database and the web session
(cookie-based auth). Native storage is only permitted for non-sensitive UX preferences (e.g. last-visited
tab) after explicit review.

### 4. HTTPS Only (`cleartext: false`)

`server.cleartext` must remain `false` in all release configs.

Setting `cleartext: true` allows the WebView to make unencrypted HTTP requests, which exposes
auth tokens and user content to network interception.

Exception: `cleartext: true` may be set for `localhost`-only testing via `server.url: 'http://localhost:3000'`
**in a local development override only, never committed as the release config.**

### 5. Plugin Allowlist

Before adding any new Capacitor plugin:

1. Review the plugin's permission requirements for iOS (`Info.plist`) and Android (`AndroidManifest.xml`).
2. Confirm no sensitive data flows through the plugin API.
3. Document the addition and rationale in this file under the "Approved Plugins" section.
4. Add the plugin to `capacitor.config.ts` under the appropriate platform block.

#### Approved Plugins

| Plugin       | Reason                       | Added |
| ------------ | ---------------------------- | ----- |
| _(none yet)_ | Phase A is hosted-shell only | —     |

---

## Local Dev Override (Safe Pattern)

To test against a local Next.js server, create a **local-only, gitignored** override:

```ts
// capacitor.config.local.ts — NOT committed (gitignored)
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'social.morphic.app',
  appName: 'Morphic (Dev)',
  webDir: 'out',
  server: {
    url: 'http://localhost:3000',
    cleartext: true
  },
  loggingBehavior: 'debug'
}

export default config
```

Never commit this file. Rename `capacitor.config.ts` to activate local testing and rename back before any release commit.

---

## Verification Checklist (Before Any Store Release)

- [ ] `loggingBehavior` is `'none'` in `capacitor.config.ts`
- [ ] `server.cleartext` is `false`
- [ ] No API keys or `.env` secrets in `ios/` or `android/`
- [ ] `server.url` points to the production HTTPS URL
- [ ] All native storage calls reviewed and approved
- [ ] Plugin allowlist is current
