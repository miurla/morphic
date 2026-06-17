# Native Runtime Architecture

This document defines the implementation contract for native capabilities in Morphic.

## Architecture Summary

Morphic is a **hosted Capacitor shell** first. The native WebView loads the production
web app from `server.url` (HTTPS). There is no bundled static app logic in the native
binary — the shell exists only to provide native platform access and app store distribution.

```
Next.js / React app (hosted at morphic.sh)
    ↓
PWA / native-feeling web foundation
    ↓
Capacitor hosted-shell WebView
    ↓
iOS / Android native container
```

## Core Rules

### 1. No Direct Capacitor Imports in UI Components

Components must never `import` from `@capacitor/*` directly. All native capability
access goes through the bridge modules in `lib/native/`.

```ts
// ✗ Bad — component directly depends on Capacitor
import { Share } from '@capacitor/share'

// ✓ Good — component uses the abstraction
import { nativeShare } from '@/lib/native/share'
```

### 2. Every Native Function Must No-Op Safely on Web

All `lib/native/*` modules must work correctly in three contexts:

- Server-side rendering (no `window`)
- Desktop browser (no native APIs)
- Mobile browser without Capacitor

Functions must never throw when native APIs are unavailable. They return safe
defaults or no-op silently.

### 3. No Sensitive Data Through Native Bridges

Until an explicit security review is completed:

- Do not pass auth tokens through native storage
- Do not pass API keys through native share or clipboard
- Do not cache search/chat content in native filesystem
- See `docs/NATIVE_SAFETY.md` for the full policy

### 4. Capacitor Detection Uses Ambient Globals Only

Runtime detection (`lib/native/runtime.ts`) checks for `window.Capacitor` which
is injected by the Capacitor runtime before any web code executes. This avoids
import-time side effects and works without bundling Capacitor core in web builds.

### 5. Respect User Preferences

Native interactions (haptics, animations, sounds) must respect:

- `prefers-reduced-motion` — disable haptics and non-essential animations
- System accessibility settings propagated through the WebView

---

## Module Map

| Module                                | Purpose                                                                       | Fallback                                 |
| ------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| `lib/native/runtime.ts`               | Detect runtime (Capacitor / PWA / browser) and platform (iOS / Android / web) | Returns `browser` / `web`                |
| `lib/native/haptics.ts`               | Haptic feedback (light, medium, heavy, selection)                             | `navigator.vibrate()` or no-op           |
| `lib/native/share.ts`                 | Native share sheet                                                            | Web Share API → clipboard → no-op        |
| `lib/native/capabilities.ts`          | Feature detection for PWA/native APIs                                         | All capabilities default to `false`      |
| `lib/native/motion.ts`                | Native-feeling animation constants                                            | Constants only, no runtime dependency    |
| `lib/native/service-worker-policy.ts` | Cache eligibility decisions for SW                                            | Policy logic only, no runtime dependency |
| `lib/platform/platform.ts`            | OS/device/display-mode detection                                              | Returns `unknown` defaults               |

---

## Runtime Detection Priority

```
1. window.Capacitor.isNativePlatform() === true  → kind: 'capacitor'
2. display-mode: standalone/fullscreen           → kind: 'pwa'
   OR navigator.standalone === true
3. Otherwise                                     → kind: 'browser'
```

Capacitor takes priority over PWA detection because the Capacitor WebView also
reports `display-mode: standalone`. The global bridge check is more specific.

---

## Capacitor Shell Strategy

### Current: Hosted Shell (Phase A)

The `capacitor.config.ts` points `server.url` at the production HTTPS app.
The committed `capacitor-shell/` directory contains only a placeholder HTML file
to satisfy Capacitor's `webDir` requirement during `cap sync`.

**Implications:**

- No offline support in native shell (requires network)
- No bundled app logic or secrets in the binary
- App updates deploy via web — no app store review needed
- Native shell updates only needed for platform config changes

### Future: Static/Hybrid Surfaces (Phase B — not yet planned)

Selected offline-capable surfaces (saved articles, settings, error pages) may
eventually be statically bundled. This requires:

- `output: 'export'` in Next.js config for targeted routes
- Service worker cache-first strategy for those routes
- Threat model review for any bundled content

This is not currently implemented and should not be assumed.

---

## Deterministic Shell Sync

The `cap:sync` script runs verification before syncing:

```bash
bun run cap:verify && cap sync
```

The verify script (`scripts/native/verify-capacitor-config.ts`) checks:

- `loggingBehavior` is `'none'`
- `server.cleartext` is `false`
- `server.url` starts with `https://`
- `webDir` directory exists on disk
- No `.env` files in native directories

This runs in CI as the `native-verify` job.

---

## Adding New Native Capabilities

When adding a new native capability:

1. Create `lib/native/<capability>.ts` with the abstraction
2. Ensure it no-ops safely on web and during SSR
3. Add `lib/native/<capability>.test.ts` testing browser fallback behavior
4. Use dynamic `import()` for Capacitor plugins (tree-shaking)
5. Add the plugin to the "Approved Plugins" table in `docs/NATIVE_SAFETY.md`
6. Update this document's Module Map

---

## What This Architecture Does NOT Cover Yet

These capabilities are planned for later phases and require their own design:

- Deep links / universal links (Phase 12.1)
- Push notifications (Phase 12.2)
- Secure storage (Phase 12.3)
- Offline/static mobile surfaces (Phase 12.4)
- App lifecycle management
- Background task handling
- Biometric authentication

Each of these requires a security review and architecture decision before implementation.
