# Native App Frontend Implementation Plan

This document turns `docs/FRONTEND_NATIVE_APP_ARCHITECTURE.md` into an implementation plan. The goal is to make Morphic feel like a native Apple-quality PWA while preserving the existing Next.js, React, Radix, Tailwind, and native-shell architecture.

The icon migration is a first-class priority. The current Tabler-heavy UI does not match the desired native Apple-like product feel closely enough. Iconoir should become the primary product icon language through a semantic wrapper, not through scattered direct imports.

## Non-negotiable principles

1. Do not introduce Framework7 as a core app dependency.
2. Do not introduce a second router, app shell, page system, or component framework.
3. Do not add new direct `@tabler/icons-react` imports in product UI after the icon wrapper lands.
4. Do not animate with random one-off values; use shared motion tokens.
5. Do not cache private chat, auth, upload, or sensitive search data in the service worker.
6. Do not degrade accessibility to achieve visual polish.
7. Do not fake native features. Use real capability detection and graceful fallbacks.
8. Do not treat platform detection as a substitute for feature detection.
9. Do not remove working behavior while changing the visual system.
10. Run typecheck, lint, and tests after each implementation slice.

## Phase 0 — Baseline audit and branch hygiene

### Purpose

Confirm the current frontend state and prevent accidental broad rewrites.

### Tasks

- Confirm the current default branch is clean before making changes.
- Identify all direct `@tabler/icons-react` imports.
- Identify all icon-only buttons without accessible labels.
- Identify existing animation locations in CSS and components.
- Confirm `public/manifest.webmanifest` does not exist before creating it.
- Confirm no existing service-worker file exists before adding one.

### Suggested commands

```bash
rg "@tabler/icons-react"
rg "transition-\[|animate-|duration-|ease-" app components lib hooks
find public -maxdepth 3 -type f | sort
bun run typecheck
bun run lint
bun test
```

### Deliverable

A short implementation note or PR description listing the current Tabler import sites and first migration targets.

## Phase 1 — Add Iconoir dependency and semantic icon wrapper

### Purpose

Make Iconoir the primary icon system without forcing a risky all-at-once rewrite.

### Dependency

```bash
bun add iconoir-react
```

### Files to add

```txt
lib/native/icon-map.ts
components/native/native-icon.tsx
tests/native-icon.test.tsx
```

### Icon map responsibilities

`lib/native/icon-map.ts` owns the mapping from Morphic semantic icon names to concrete icon components.

Start with the icons used in the most visible surfaces:

```ts
export const nativeIconNames = [
  'send',
  'stop',
  'newChat',
  'scrollDown',
  'sidebarOpen',
  'sidebarClosed',
  'search',
  'research',
  'compare',
  'latest',
  'summarize',
  'explain',
  'upload',
  'settings',
  'feedback',
  'copy',
  'share',
  'close',
  'chevronDown',
  'check',
  'warning',
  'error',
  'info'
] as const
```

Use names that reflect product meaning, not library names.

### NativeIcon component responsibilities

`components/native/native-icon.tsx` should:

- accept a semantic `name`
- accept `className`
- accept optional `size`
- default to `aria-hidden="true"`
- allow `aria-label` only when the icon itself is meaningful
- use consistent stroke/size behavior
- provide a safe fallback icon in development if a name is missing

Example shape:

```tsx
import { nativeIconMap, type NativeIconName } from '@/lib/native/icon-map'
import { cn } from '@/lib/utils'

interface NativeIconProps {
  name: NativeIconName
  className?: string
  size?: number | string
  'aria-label'?: string
}

export function NativeIcon({ name, className, size, ...props }: NativeIconProps) {
  const Icon = nativeIconMap[name]

  return (
    <Icon
      aria-hidden={props['aria-label'] ? undefined : true}
      className={cn('shrink-0', className)}
      width={size}
      height={size}
      {...props}
    />
  )
}
```

Adjust to the actual Iconoir React component API during implementation.

### Icon quality rules

For every mapped icon, verify:

- It reads clearly at 16px and 20px.
- It has the right metaphor for the action.
- It does not look too playful, heavy, thin, or dashboard-like.
- It aligns visually with adjacent icons.
- It works in light and dark mode.
- It works inside round icon buttons.
- It does not require text to compensate for a weak metaphor unless the UI already includes text.

### First migration targets

Migrate these first:

```txt
components/chat-panel.tsx
components/action-buttons.tsx
components/ui/sidebar.tsx
```

These are highly visible and currently import Tabler icons directly.

### Acceptance criteria

- `iconoir-react` is installed.
- `NativeIcon` exists.
- `nativeIconMap` exists.
- At least the chat composer, prompt action buttons, and sidebar trigger use `NativeIcon`.
- No new direct Tabler imports are introduced.
- Typecheck passes.
- Tests pass.

## Phase 2 — Icon migration across product UI

### Purpose

Remove visual drift and establish Iconoir as the product-wide icon language.

### Tasks

Search for all direct Tabler imports:

```bash
rg "@tabler/icons-react"
```

For each import:

1. Determine whether the icon is product UI, debug-only UI, or temporary/admin UI.
2. Add a semantic icon name to `nativeIconMap` if needed.
3. Replace direct icon usage with `NativeIcon`.
4. Remove unused direct imports.
5. Verify icon-only controls have accessible labels.
6. Verify visual consistency in light/dark mode and mobile/desktop sizes.

### Migration order

1. Chat composer and controls.
2. Sidebar and navigation.
3. Menus and dropdowns.
4. Search mode/model selector controls.
5. Message actions: copy, retry, edit, share, reload.
6. File upload and file list surfaces.
7. Error, auth, feedback, and settings modals.
8. Artifact and generative UI controls.
9. Any remaining product UI.

### Explicit exceptions

Direct third-party icon imports are allowed only when:

- the icon is embedded in a third-party-rendered object that cannot use `NativeIcon`; or
- a one-off fallback is documented in `nativeIconMap`; or
- a brand/logo mark is required and should not be represented by Iconoir.

### Acceptance criteria

- Product UI has no direct `@tabler/icons-react` imports.
- `@tabler/icons-react` can either be removed from dependencies or retained only with a documented fallback reason.
- Icon-only buttons have labels.
- The UI visually reads as one coherent icon system.

## Phase 3 — Add Motion dependency and motion tokens

### Purpose

Create a native-feeling interaction system without random animation drift.

### Dependency

```bash
bun add motion
```

### Files to add

```txt
lib/native/motion.ts
components/native/native-pressable.tsx
components/native/native-presence.tsx
tests/native-motion.test.ts
```

### Motion token contract

`lib/native/motion.ts` should define:

- durations
- easings
- springs
- reduced-motion helpers if useful
- named variants for common UI patterns

Suggested starting point:

```ts
export const nativeMotion = {
  duration: {
    instant: 0.08,
    fast: 0.14,
    normal: 0.22,
    sheet: 0.32
  },
  easing: {
    standard: [0.23, 1, 0.32, 1],
    emphasized: [0.32, 0.72, 0, 1],
    exit: [0.4, 0, 1, 1]
  },
  spring: {
    snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 },
    soft: { type: 'spring', stiffness: 320, damping: 34, mass: 1 },
    sheet: { type: 'spring', stiffness: 360, damping: 42, mass: 1 }
  }
} as const
```

Use exact values only after testing on device. These are starting defaults, not sacred constants.

### NativePressable responsibilities

`NativePressable` should provide:

- subtle press scale
- optional hover lift/tint where appropriate
- disabled state passthrough
- reduced-motion compliance
- no interference with accessible button/link semantics

### First motion targets

Start with low-risk, high-impact interactions:

1. Send button press.
2. Stop button press.
3. New chat button press.
4. Scroll-to-bottom button entrance/exit.
5. Composer focus ring/surface transition.
6. Prompt category button press.
7. Sidebar trigger press.

Do not animate streaming text or core message rendering heavily in this phase.

### Acceptance criteria

- `motion` dependency is installed.
- Motion tokens exist.
- Pressable wrapper exists.
- First target controls use shared motion wrappers/tokens.
- Reduced-motion behavior is respected.
- Typecheck, lint, and tests pass.

## Phase 4 — Native environment and capability layer

### Purpose

Move from platform detection alone to platform + capability detection.

### Files to add or evolve

```txt
lib/native/platform.ts
lib/native/capabilities.ts
lib/native/install-state.ts
lib/native/display-mode.ts
components/native/native-environment-provider.tsx
tests/native-capabilities.test.ts
```

The existing `lib/platform/platform.ts` can either be moved into `lib/native/platform.ts` or kept and re-exported. Avoid breaking imports in one large risky step.

### Capability model

Start with:

```ts
export interface NativeCapabilities {
  canShare: boolean
  canCanShare: boolean
  canClipboardRead: boolean
  canClipboardWrite: boolean
  canPush: boolean
  canBadge: boolean
  canInstallPrompt: boolean
  canUseFileSystemAccess: boolean
  canUseFilePicker: boolean
  canUseWebAuthn: boolean
  canUseWakeLock: boolean
  canUseWindowControlsOverlay: boolean
  canUseVirtualKeyboard: boolean
  canUseHaptics: boolean
}
```

Prefer capability checks like `canShare` over platform checks like `isIOS`.

### Provider model

Expose a single environment object:

```ts
export interface NativeEnvironment {
  platform: PlatformInfo
  capabilities: NativeCapabilities
  install: NativeInstallState
}
```

Then components can use:

```tsx
const { platform, capabilities, install } = useNativeEnvironment()
```

### Acceptance criteria

- Existing platform detection remains working.
- New capability detection is tested with mocked browser APIs.
- Components stop adding new ad hoc `navigator` checks.
- The provider can support browser, standalone, and SSR-safe defaults.

## Phase 5 — PWA manifest and app icons

### Purpose

Make Morphic properly installable and identifiable as a PWA.

### Files to add

```txt
public/manifest.webmanifest
public/icons/icon-192.png
public/icons/icon-512.png
public/icons/icon-maskable-512.png
public/apple-touch-icon.png
public/apple-touch-icon-180.png
```

### Manifest shape

```json
{
  "id": "/",
  "name": "Morphic",
  "short_name": "Morphic",
  "description": "An AI-powered answer engine with a native-feeling search and chat experience.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "display_override": ["window-controls-overlay", "standalone", "browser"],
  "background_color": "#000000",
  "theme_color": "#000000",
  "orientation": "any",
  "categories": ["productivity", "utilities", "news"],
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "New Search",
      "short_name": "Search",
      "url": "/",
      "description": "Start a new Morphic search"
    }
  ]
}
```

### Layout metadata update

Update `app/layout.tsx` icon metadata to include Apple touch icons and PNG app icons in addition to the existing SVG icon.

### Acceptance criteria

- `/manifest.webmanifest` resolves.
- Manifest validates in browser devtools/Lighthouse.
- App has correct icons on iOS/iPadOS Home Screen, Android, and desktop Chromium installs.
- No broken icon paths.

## Phase 6 — Privacy-safe service worker

### Purpose

Make Morphic resilient without leaking private data.

### Files to add

```txt
public/sw.js
components/native/service-worker-register.tsx
components/native/offline-banner.tsx
components/native/pwa-update-toast.tsx
```

### Registration policy

- Register only in production by default.
- Do not register during tests.
- Fail silently with console diagnostics in development if explicitly enabled.
- Surface user-facing offline/update state through UI, not raw browser errors.

### Caching policy

Cache allowed:

- static app shell assets
- public icons
- manifest
- immutable Next build assets where safe

Do not cache by default:

- `/api/chat`
- `/api/upload`
- auth/session endpoints
- private chat history
- private user records
- arbitrary API responses
- sensitive query-dependent search results

### Offline behavior

Initial offline behavior should be conservative:

- App shell loads if previously visited.
- User sees clear offline status.
- Composer can preserve local draft text in memory or privacy-safe local storage after explicit review.
- Chat submission should not pretend to work while offline.
- Queued submission can be added later only after privacy and duplication semantics are designed.

### Acceptance criteria

- App shell can load offline after first visit.
- Private API responses are not cached.
- Offline banner appears when network is unavailable.
- Update toast appears when a new service worker is waiting.
- Tests cover registration guards and URL caching exclusions where possible.

## Phase 7 — Native install, share, clipboard, and haptics adapters

### Purpose

Use native browser/PWA features where supported while maintaining graceful fallback.

### Files to add

```txt
lib/native/share.ts
lib/native/clipboard.ts
lib/native/haptics.ts
components/native/install-prompt.tsx
components/native/share-button.tsx
```

### Share behavior

- Use `navigator.share` when available.
- Use `navigator.canShare` for files or rich payloads where applicable.
- Fall back to clipboard copy.
- Show clear success/failure toast.

### Clipboard behavior

- Use `navigator.clipboard.writeText` when available and permitted.
- Provide fallback only where safe.
- Avoid silently failing.

### Haptics behavior

- Use vibration/haptic-like feedback only for appropriate platforms and only for small interaction confirmation.
- Do not vibrate repeatedly or during streaming.
- Respect user/device limitations.

### Install prompt behavior

- Chromium: use `beforeinstallprompt` when available.
- iOS/iPadOS: show concise Add to Home Screen guidance only when not standalone.
- Standalone: hide install prompts.
- Unsupported browser: hide install prompts.

### Acceptance criteria

- Share/copy behavior is capability-driven.
- Install prompt does not appear in standalone mode.
- Unsupported platforms degrade gracefully.
- No permission nagging.

## Phase 8 — Native-feeling sheets, panels, and app surfaces

### Purpose

Make Morphic feel spatial and tactile in the areas users open/close frequently.

### Targets

- sidebar mobile sheet
- user menu
- guest menu
- feedback modal
- model selector
- search mode selector
- artifact panel
- error/auth modals
- future Gist/discovery/news surfaces

### Rules

- Use Radix/Vaul for accessible primitives.
- Use Motion tokens for movement.
- Use native shell CSS variables for radius, shadows, hairlines, and safe areas.
- Do not import Framework7.
- Keep reduced-motion behavior excellent.

### Acceptance criteria

- Sheet/panel movement feels consistent.
- Dismiss behavior is reliable.
- Focus management remains correct.
- Scroll handoff works on mobile.
- Keyboard does not break the composer or sheets on iOS.

## Phase 9 — QA, tests, and CI hardening

### Unit tests

Add or expand tests for:

- iPhone detection
- iPad detection
- iPadOS masquerading as Mac detection
- Android detection
- Windows detection
- Linux/unknown fallback
- display-mode detection
- standalone detection through `navigator.standalone`
- capability detection with mocked browser APIs
- native icon fallback behavior
- service-worker registration guards
- service-worker private URL exclusion logic

### Manual QA matrix

Test at minimum:

- iPhone Safari browser
- iPhone installed Home Screen PWA
- iPad Safari browser
- iPad installed Home Screen PWA
- macOS Safari
- macOS Chrome/Edge installed PWA
- Android Chrome browser
- Android installed PWA
- Windows Edge/Chrome browser
- Windows installed PWA

### Commands

```bash
bun run typecheck
bun run lint
bun test
bun run build
```

### Lighthouse

After manifest and service worker exist, add a repeatable Lighthouse PWA audit. Treat it as a guardrail, not the only source of truth.

## Phase 10 — Remove legacy icon dependency if possible

### Purpose

Finish the icon migration instead of leaving permanent drift.

### Tasks

- Run `rg "@tabler/icons-react"`.
- If no imports remain, remove `@tabler/icons-react` from `package.json`.
- Run package install/update to refresh lockfile.
- Run typecheck, lint, tests, and build.
- Confirm bundle does not include Tabler icons.

### Acceptance criteria

- `@tabler/icons-react` is gone, or retained only with a written exception.
- Iconoir is the primary product icon language.
- The visual system is coherent.

## Suggested PR sequence

Avoid one giant PR. Use small slices:

1. Docs only: architecture and implementation plan.
2. Iconoir dependency + `NativeIcon` + migrate chat-panel/action-buttons/sidebar.
3. Continue icon migration across menus/modals/actions.
4. Motion dependency + motion tokens + `NativePressable` + first controls.
5. Capability provider.
6. Manifest and app icons.
7. Service worker + offline/update UI.
8. Native share/install adapters.
9. Sheet/panel motion polish.
10. Remove Tabler if no longer needed.

## Definition of done for the native frontend initiative

Morphic reaches the intended frontend direction when:

- It installs cleanly as a PWA on iOS/iPadOS, Android, and desktop Chromium.
- The app has correct manifest, icons, safe areas, and standalone behavior.
- Iconoir is the product icon system through `NativeIcon`.
- Direct Tabler usage is removed or explicitly exceptional.
- Motion is tokenized and restrained.
- Major interactions feel tactile and spatial.
- Reduced-motion users get a calm accessible experience.
- Platform features are capability-driven.
- Private data is not accidentally cached.
- Tests protect platform detection, capability detection, icon mapping, and PWA runtime behavior.
- The app looks and feels like a coherent native-quality product, not a web page with rounded corners.
