# Native App Frontend Architecture

Morphic is a PWA-first answer engine. The frontend must feel like a high-quality native Apple app while still adapting correctly to Android, Windows, Linux, desktop browsers, and installed PWA environments. The target is not merely an Apple-looking website. The target is a system that feels responsive, spatial, tactile, calm, and platform-aware.

This document defines the architectural direction for the frontend shell, icons, motion, native capabilities, and design-system boundaries.

## Current baseline

The current frontend is a Next.js App Router application using React, Tailwind CSS, Radix primitives, Vaul, Sonner, AI SDK React, Supabase UI/client pieces, and Tabler icons. The existing app already has several important native-shell foundations:

- `app/layout.tsx` declares PWA-facing metadata, Apple web app metadata, viewport fit support, safe root layout, and the native shell CSS imports.
- `lib/platform/platform.ts` detects platform kind, platform family, display mode, standalone mode, and emits stable platform/display classes.
- `components/platform/platform-provider.tsx` corrects platform information on the client and writes classes/data attributes onto `<html>`.
- `app/native-shell.css` defines native app tokens for safe areas, radii, touch targets, toolbar height, hairlines, translucent surfaces, shadows, font stacks, and standalone behavior.
- `app/ui-phase-2.css` contains early native surface polish for composer and menu surfaces.
- The main chat surface already behaves like an app workspace rather than a normal document page: fixed shell, internal scrolling, sticky composer, app-level keyboard shortcuts, and platform-aware shortcut display.

These foundations should be kept and evolved. The frontend should not be restarted around a competing mobile UI framework.

## Architecture doctrine

Morphic should be Apple-inspired by default, platform-adaptive by capability, and graceful everywhere.

The architectural target is:

```txt
Next.js App Router
+ React
+ Radix/Vaul accessible primitives
+ Tailwind/native CSS tokens
+ Iconoir primary icon language
+ Motion interaction layer
+ platform and capability detection
+ privacy-safe PWA runtime
```

The frontend should not become:

```txt
Next.js App Router
+ a second app/router framework
+ scattered one-off animation rules
+ mixed icon sets without an icon contract
+ platform checks copied throughout components
+ broad service-worker caching of private data
```

## Product feel goals

Morphic should feel native in the areas users touch constantly:

1. Launch and install behavior: correct manifest, icons, splash behavior, theme colors, standalone detection, and install/update/offline affordances.
2. Touch response: controls should respond instantly with subtle press, hover, focus, and disabled states.
3. Spatial continuity: sheets, panels, composer expansion, message transitions, search cards, and source cards should move through space instead of appearing abruptly.
4. Platform awareness: keyboard shortcuts, touch targets, share behavior, file picking, install prompts, notifications, window controls, and emoji rendering should use native capabilities when available.
5. Visual calm: surfaces should use consistent radius, translucent materials where supported, hairline borders, soft shadows, restrained motion, and clean hierarchy.
6. Accessibility: motion must respect reduced-motion preferences, components must remain keyboard reachable, screen-reader semantics must not be sacrificed for visual polish.
7. Privacy and safety: PWA caching and local persistence must not leak private chats, uploads, auth state, or sensitive search history.

## Icons

### Decision

Iconoir is the primary icon set for Morphic product UI.

Tabler icons are a legacy/current implementation detail and may remain only as a temporary fallback during migration. New product UI should not add direct imports from `@tabler/icons-react` unless an explicit exception is documented in the icon map.

### Why Iconoir

Iconoir is close to the Apple-adjacent visual direction Morphic needs: outline-first, quiet, balanced, simple, and suitable for consumer-grade interfaces. It is open source, MIT licensed, React-compatible, and based around a 24x24 SVG icon grid. It is a better primary choice than Tabler for the desired native Apple-like feel.

### Why not SF Symbols directly

Morphic should not depend on SF Symbols as the general web icon system. SF Symbols are part of Apple's design ecosystem and are not the right open, cross-platform, web-primary icon dependency. The visual direction can be inspired by Apple system clarity without copying Apple's proprietary icon system into a general PWA.

### Icon architecture

Create a native icon abstraction:

```txt
components/native/native-icon.tsx
lib/native/icon-map.ts
```

Product components should render icons through semantic names:

```tsx
<NativeIcon name="send" />
<NativeIcon name="stop" />
<NativeIcon name="newChat" />
<NativeIcon name="search" />
<NativeIcon name="sources" />
<NativeIcon name="settings" />
```

The icon map owns library-specific choices:

```ts
export const nativeIconMap = {
  send: IconoirSend,
  stop: IconoirStop,
  newChat: IconoirChatPlus,
  search: IconoirSearch,
  sources: IconoirPage,
  settings: IconoirSettings
} as const
```

This prevents icon drift, makes migration mechanical, and allows selective fallback if one Iconoir glyph is weak.

### Icon rules

1. Use semantic icon names in app code.
2. Do not import icon libraries directly inside feature components after the icon wrapper exists.
3. Prefer 24x24 icons with optical consistency.
4. Default interactive icon size should be tokenized, usually 16px, 18px, 20px, or 24px depending on context.
5. Use stroke width consistently. Do not mix heavy, filled, thin, and outline icons arbitrarily.
6. Filled icons are allowed only for selected/active states or strong semantic states.
7. Icon-only buttons must have accessible labels.
8. Avoid decorative icons where text or hierarchy is enough.
9. Keep icons calm. Morphic should not look like a developer dashboard.
10. Delete replaced direct Tabler imports as migration progresses.

## Motion

### Decision

Use Motion as the React interaction and animation layer.

Do not adopt Framework7 as the frontend framework. Framework7 may be used as a reference for mobile interaction patterns, but it should not own routing, layout, components, panels, sheets, pages, or app initialization.

### Why Motion

Motion integrates directly with the current React/Next architecture. It supports declarative animation, gestures, layout animation, presence/exit animation, and spring-based interaction while allowing the existing component system to remain intact.

### Why not Framework7 as a dependency

Framework7 is a full mobile app UI framework with its own app initialization, view/router model, page system, components, and styling assumptions. Morphic already has Next.js App Router, Radix, Vaul, Tailwind, and a native shell. Adding Framework7 as a core dependency would create a competing frontend architecture and increase drift.

Use Framework7 only as inspiration for:

- sheet behavior
- side panels
- pull-to-refresh references
- mobile toolbar/tabbar patterns
- message bar ergonomics
- iOS/Android interaction comparisons

Do not use Framework7 as the app framework.

### Motion architecture

Create a motion contract:

```txt
lib/native/motion.ts
components/native/native-pressable.tsx
components/native/native-presence.tsx
```

The motion contract should define shared durations, easings, and springs. Components should import tokens instead of inventing animation settings locally.

Example:

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

Motion should be restrained. Native feel comes from responsiveness, continuity, and consistency, not from excessive movement.

### Motion rules

1. Always respect `prefers-reduced-motion`.
2. Prefer subtle press scale for tappable controls.
3. Use layout animation for elements whose position/size changes.
4. Use presence animation for sheets, popovers, transient controls, panels, and empty states.
5. Keep exit animations faster than enter animations.
6. Avoid spring bounce unless it matches the user action.
7. Do not animate text while it is streaming if it harms readability.
8. Avoid long animations on primary chat/send flows.
9. Avoid per-component custom easing unless the motion token contract is missing something.
10. Test motion on touch devices, pointer devices, reduced-motion environments, and installed PWA mode.

## Platform and native capability layer

The existing platform layer should evolve into a native environment layer.

Platform detection answers:

- What family is this environment likely in?
- Is the app installed or browser-hosted?
- Which display mode is active?

Capability detection answers:

- What can the browser actually do?
- Can this device share?
- Can it write to clipboard?
- Can it install?
- Can it show notifications?
- Can it use file picker APIs?
- Can it use window controls overlay?
- Can it use haptics/vibration?
- Can it use virtual keyboard APIs?

Components should generally use capabilities, not platform assumptions.

Recommended structure:

```txt
lib/native/platform.ts
lib/native/capabilities.ts
lib/native/install-state.ts
lib/native/display-mode.ts
lib/native/share.ts
lib/native/clipboard.ts
lib/native/haptics.ts
lib/native/keyboard.ts
components/native/native-environment-provider.tsx
```

The provider should expose:

```ts
interface NativeEnvironment {
  platform: PlatformInfo
  capabilities: NativeCapabilities
  install: NativeInstallState
}
```

Platform-specific styling should still be mostly token-driven through CSS classes and variables, not scattered conditionals.

## PWA runtime

A native-feeling PWA requires more than metadata. The app needs a real manifest, icon set, service-worker registration, offline/update UX, and careful caching policy.

### Manifest and icons

The app should provide:

```txt
public/manifest.webmanifest
public/icons/icon-192.png
public/icons/icon-512.png
public/icons/icon-maskable-512.png
public/apple-touch-icon.png
public/apple-touch-icon-180.png
```

The manifest should define:

- `id`
- `name`
- `short_name`
- `description`
- `start_url`
- `scope`
- `display`
- `display_override`
- `background_color`
- `theme_color`
- `orientation`
- `categories`
- `icons`
- `shortcuts`

### Service worker policy

The service worker must be privacy-safe.

Cache:

- static assets
- immutable build assets
- app shell resources required for startup
- public icon/manifest resources

Do not broadly cache:

- `/api/chat`
- auth/session endpoints
- upload endpoints
- private chat history
- private user data
- arbitrary search results containing sensitive queries

Offline support should start with safe shell resilience, not aggressive data persistence.

## Component-system boundaries

Morphic's component system should remain built around:

- Next.js App Router for routing and server/client boundaries
- React for components/state
- Radix for accessible primitives
- Vaul for drawer/sheet-style primitives where appropriate
- Tailwind and CSS custom properties for design tokens
- Iconoir through `NativeIcon`
- Motion through native motion wrappers/tokens

Framework-level decisions should remain centralized. Feature components should not introduce new component frameworks, icon libraries, animation systems, or platform detection mechanisms without an architecture update.

## Native feel checklist

A UI change should satisfy this checklist before it lands:

- Does it use the native token system instead of hard-coded visual values?
- Does it use Iconoir through the icon abstraction?
- Does it avoid new direct Tabler imports?
- Does it feel good with touch and pointer input?
- Does it preserve keyboard accessibility?
- Does it respect reduced motion?
- Does it work in browser and standalone PWA display modes?
- Does it avoid caching or persisting sensitive data accidentally?
- Does it avoid introducing a second framework or routing model?
- Does it make Morphic feel calmer, faster, and more app-like?

## References

These references are for implementation guidance and design review. They are not a license to copy proprietary assets or platform-specific UI wholesale.

- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Apple HIG, Icons: https://developer.apple.com/design/human-interface-guidelines/icons
- Apple HIG, Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Apple Safari web app meta tags: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html
- Apple Safari web app configuration: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
- WebKit, Web Push for web apps on iOS and iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- MDN, Web app manifests: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
- MDN, Service Worker API: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- MDN, Window Controls Overlay API: https://developer.mozilla.org/en-US/docs/Web/API/Window_Controls_Overlay_API
- web.dev, PWA capabilities: https://web.dev/learn/pwa/capabilities
- Motion for React: https://motion.dev/docs/react
- Iconoir: https://iconoir.com/
- Iconoir GitHub repository: https://github.com/iconoir-icons/iconoir
- Framework7 documentation: https://framework7.io/docs/
- WAI-ARIA Authoring Practices Guide: https://www.w3.org/WAI/ARIA/apg/
