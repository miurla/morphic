# Technical Design: Mobile Shell UX Hardening / App Navigation Consolidation

## Overview

This document describes the technical design for Mobile Shell UX Hardening and App Navigation Consolidation. The shell is the outermost layout structure wrapping all page content, providing a stable, non-scrolling viewport frame with platform-adaptive navigation, overlay surfaces, and consistent UX primitives. This design addresses all 14 requirements from the specification.

## Architecture

The shell renders inside the existing `app/layout.tsx` provider tree and replaces the current `Header` component with a richer, platform-aware component hierarchy.

### Architecture Principles

- **Incremental extraction** — no broad rewrites of existing layouts; new components compose alongside existing code
- **Platform-first rendering** — component behavior adapts at render time based on `PlatformProvider` and `getRuntime()` context
- **CSS-driven safe areas** — all inset handling flows through CSS custom properties from `native-shell.css`
- **Single overlay history model** — all overlay surfaces (Sheet, Panel, Dialog) participate in a unified history stack
- **Reduced-motion as first-class** — all animated components read `prefers-reduced-motion` and degrade gracefully

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  app/layout.tsx (Server Component - Root)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ PlatformProvider → NativeEnvironmentProvider           │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ ShellFrame (client component, root layout)      │  │  │
│  │  │  ├── AppNavBar (top)                            │  │  │
│  │  │  ├── ScrollContainer (middle, flex-grow)        │  │  │
│  │  │  │    └── {children} (page content)             │  │  │
│  │  │  └── TabBar (bottom, <768px only)               │  │  │
│  │  │                                                 │  │  │
│  │  │  [Overlay Layer]                                │  │  │
│  │  │  ├── ShellSheet (vaul bottom sheet)             │  │  │
│  │  │  └── ShellPanel (sidebar overlay / inline)      │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
app/layout.tsx
 └─ PlatformProvider (context: PlatformInfo)
     └─ NativeEnvironmentProvider (context: RuntimeInfo)
         └─ ThemeProvider
             └─ ShellFrame ← NEW (replaces current flex container)
                 ├─ AppNavBar ← NEW (replaces Header)
                 │   ├─ BackButton (conditional, NativeIcon arrowLeft)
                 │   ├─ Title (large/inline, platform-adaptive)
                 │   └─ TrailingActions (max 3 + overflow)
                 │
                 ├─ ScrollContainer ← NEW (scroll tracking wrapper)
                 │   ├─ SkeletonLoader (conditional, loading state)
                 │   ├─ EmptyState (conditional, zero-item state)
                 │   └─ {children} (page content)
                 │
                 ├─ TabBar ← NEW (bottom nav, mobile only)
                 │   └─ TabItem[] (3-5 items, NativeIcon + label)
                 │
                 └─ [Overlay Portal]
                     ├─ ShellSheet ← NEW (vaul Drawer wrapper)
                     └─ ShellPanel ← NEW (side panel)

hooks/
 ├─ useBackButton ← NEW
 ├─ useKeyboardState ← NEW
 ├─ useScrollRestoration ← NEW
 └─ useOverlayStack ← NEW
```

## Components and Interfaces

### 3.1 ShellFrame

**File:** `components/shell/shell-frame.tsx`
**Role:** Root layout wrapper that establishes the fixed viewport frame.

| Responsibility         | Detail                                                                            |
| ---------------------- | --------------------------------------------------------------------------------- |
| Viewport lock          | `height: 100dvh`, `overflow: hidden` on self                                      |
| Zone layout            | CSS Grid or flex column: AppNavBar (auto) → ScrollContainer (1fr) → TabBar (auto) |
| Safe-area padding      | `padding-top: var(--native-safe-top)`, landscape left/right insets                |
| Overscroll suppression | `overscroll-behavior: none` on root scroll container                              |
| Keyboard response      | Collapses TabBar when keyboard is open (via `useKeyboardState`)                   |

```tsx
// Simplified interface
interface ShellFrameProps {
  children: React.ReactNode
  navBar?: React.ReactNode // AppNavBar slot
  tabBar?: React.ReactNode // TabBar slot (hidden ≥768px)
}
```

### 3.2 AppNavBar

**File:** `components/shell/app-nav-bar.tsx`
**Role:** Adaptive top navigation bar with platform-specific behavior.

| Platform                  | Behavior                                                                       |
| ------------------------- | ------------------------------------------------------------------------------ |
| iOS / Apple-like (<768px) | Large title (34px, 96px height) → collapses to inline (52px) after 60px scroll |
| Android (<768px)          | Fixed 56px bar, bottom elevation shadow `0 2px 4px rgba(0,0,0,0.08)`           |
| Desktop (≥768px)          | Fixed bar at `--native-toolbar-height`, inline title, all platforms            |

**Props:**

```tsx
interface AppNavBarProps {
  title: string
  leadingAction?: React.ReactNode // defaults to back button when stack > 1
  trailingActions?: React.ReactNode[] // max 3, overflow → moreHoriz menu
  scrollOffset?: number // from ScrollContainer, drives collapse
}
```

**Collapse logic:**

- Receives `scrollOffset` from `useScrollRestoration` or a shared scroll context
- iOS large title uses CSS `transform: translateY()` with `nativeMotion.spring.snappy`
- When `prefers-reduced-motion` is active: opacity-only transition, no translateY

### 3.3 TabBar

**File:** `components/shell/tab-bar.tsx`
**Role:** Persistent bottom navigation on mobile viewports.

| Responsibility | Detail                                                                      |
| -------------- | --------------------------------------------------------------------------- |
| Visibility     | Rendered only when viewport < 768px (CSS `@media` + conditional render)     |
| Height         | `--native-bottom-bar-height` (72px) inclusive of bottom safe-area padding   |
| Haptics        | Fires `hapticLight()` on tab selection when runtime is `capacitor` or `pwa` |
| Scroll-to-top  | Tapping active tab scrolls ScrollContainer to top instead of navigating     |
| Keyboard hide  | Collapses to 0 height when keyboard is open                                 |
| Navigation     | Uses Next.js `router.push()` for tab changes                                |

```tsx
interface TabItem {
  icon: NativeIconName
  label: string
  href: string
}

interface TabBarProps {
  items: TabItem[] // 3-5 items
  activeHref: string
  onScrollToTop: () => void
  hidden?: boolean // keyboard open state
}
```

### 3.4 ShellSheet

**File:** `components/shell/shell-sheet.tsx`
**Role:** Bottom sheet surface wrapping `vaul` (already installed).

| Responsibility | Detail                                                                    |
| -------------- | ------------------------------------------------------------------------- |
| Animation      | Open: spring from `nativeMotion.spring.sheet` (stiffness 360, damping 42) |
| Dismiss        | Drag past 40% height → dismiss with `easing.exit` curve, 320ms            |
| Backdrop       | `rgba(0,0,0,0.8)`, tap-to-dismiss                                         |
| Max height     | 90dvh, internal content scrolls                                           |
| Focus trap     | Keyboard focus trapped within sheet content                               |
| History        | Pushes one history entry on open via `useOverlayStack`                    |
| Reduced motion | Opacity-only transition, 1ms duration                                     |
| Border radius  | `--native-radius-sheet` top corners, 0px bottom                           |

```tsx
interface ShellSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  snapPoints?: number[] // optional vaul snap points
}
```

### 3.5 ShellPanel

**File:** `components/shell/shell-panel.tsx`
**Role:** Side panel for history/navigation, adaptive between overlay and inline.

| Viewport | Behavior                                                      |
| -------- | ------------------------------------------------------------- |
| < 768px  | Overlay from left, max 85vw, backdrop, slide-in animation     |
| ≥ 768px  | Persistent inline column, 240–320px, adjacent to main content |

| Responsibility | Detail                                                                       |
| -------------- | ---------------------------------------------------------------------------- |
| Safe-area      | Left-edge padding `var(--native-safe-left)`                                  |
| History        | Pushes one history entry on open (mobile overlay mode) via `useOverlayStack` |
| Focus return   | On dismiss, returns focus to previously focused element                      |
| Backdrop tap   | Dismisses panel on mobile                                                    |
| Reduced motion | Opacity-only, no translateX                                                  |

```tsx
interface ShellPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: 'left' | 'right'
  children: React.ReactNode
}
```

### 3.6 ScrollContainer

**File:** `components/shell/scroll-container.tsx`
**Role:** Scroll tracking wrapper that drives scroll restoration and nav bar collapse.

| Responsibility  | Detail                                                                         |
| --------------- | ------------------------------------------------------------------------------ |
| Scroll tracking | Reports `scrollTop` to parent context (throttled, ~60fps via rAF)              |
| Restoration     | Integrates with `useScrollRestoration` hook                                    |
| Overflow        | `overflow-y: auto`, sole scrollable region in shell                            |
| Nested scrolls  | Child elements with `data-scroll-region` are permitted to scroll independently |
| Focus scroll    | When keyboard opens, scrolls focused input into view within 300ms              |

```tsx
interface ScrollContainerProps {
  children: React.ReactNode
  className?: string
  onScrollOffsetChange?: (offset: number) => void
}
```

### 3.7 SkeletonLoader

**File:** `components/shell/skeleton-loader.tsx`
**Role:** Consistent loading placeholder rendered during page transitions.

| Responsibility  | Detail                                                  |
| --------------- | ------------------------------------------------------- |
| Display trigger | Shown when page transition exceeds 100ms without render |
| Max duration    | Auto-hides after 10s timeout                            |
| Animation       | CSS `@keyframes` shimmer (no JS-driven animation)       |
| Reduced motion  | Static blocks, no shimmer                               |
| Replacement     | Swaps to real content without intermediate blank frames |

```tsx
interface SkeletonLoaderProps {
  variant?: 'list' | 'card' | 'content' // layout preset
  blocks?: number // number of placeholder blocks
}
```

### 3.8 EmptyState

**File:** `components/shell/empty-state.tsx`
**Role:** Informative zero-content view with optional CTA.

| Responsibility | Detail                                                                         |
| -------------- | ------------------------------------------------------------------------------ |
| Layout         | Centered vertically and horizontally in parent ScrollContainer                 |
| Icon           | NativeIcon at 48px size                                                        |
| Title          | Max 60 characters, single line                                                 |
| Description    | Max 200 characters                                                             |
| Action button  | Optional, 16px below description, min touch target `--native-min-touch-target` |

```tsx
interface EmptyStateProps {
  icon: NativeIconName
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}
```

### 3.9 NativeList / NativeListItem

**File:** `components/shell/native-list.tsx`
**Role:** Platform-native-feeling list with proper touch targets and separators.

| Responsibility | Detail                                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| Touch target   | Min height `--native-min-touch-target` (44px iOS, 48px Android)                        |
| Separators     | 1px border, `--native-hairline` color, inset from leading edge                         |
| Slots          | Leading icon (NativeIcon), title (truncated), subtitle (truncated), trailing accessory |
| Press feedback | `NativePressable` scale via `nativeMotion.press.scale`                                 |
| Reduced motion | Background-color change to `--native-hairline` opacity, no scale                       |

```tsx
interface NativeListItemProps {
  icon?: NativeIconName
  title: string
  subtitle?: string
  trailing?: React.ReactNode
  onPress?: () => void
}

interface NativeListProps {
  children: React.ReactNode
  separators?: boolean // default true
}
```

### 3.10 Hooks

#### useBackButton

**File:** `hooks/use-back-button.ts`
**Role:** Unifies Android hardware back, browser back, and in-app back button behavior.

```tsx
interface UseBackButtonOptions {
  onBack?: () => void // custom handler, defaults to router.back() or navigate to '/'
}

function useBackButton(options?: UseBackButtonOptions): void
```

- Listens for `popstate` events
- Checks `useOverlayStack` — if overlays are open, closes topmost instead of navigating
- Falls back to `router.back()` when stack depth > 1, else navigates to `/`

#### useKeyboardState

**File:** `hooks/use-keyboard-state.ts`
**Role:** Tracks virtual keyboard open/close state via `visualViewport` API.

```tsx
interface KeyboardState {
  isOpen: boolean
  height: number // keyboard height in px
}

function useKeyboardState(): KeyboardState
```

- Primary: `window.visualViewport.resize` event → compares `viewport.height` to `window.innerHeight`
- Fallback: `window.resize` event when `visualViewport` is unavailable
- Restores TabBar within 100ms of keyboard close
- Does not trigger CLS > 0.1 (uses `transform` not `height` for TabBar hide)

#### useScrollRestoration

**File:** `hooks/use-scroll-restoration.ts`
**Role:** Saves and restores scroll positions keyed by route path.

```tsx
interface UseScrollRestorationOptions {
  containerRef: React.RefObject<HTMLElement>
  deferUntilReady?: boolean // wait for dynamic content
  timeout?: number // default 2000ms
}

function useScrollRestoration(options: UseScrollRestorationOptions): {
  scrollOffset: number
  scrollToTop: () => void
}
```

- In-memory `Map<string, number>` with LRU eviction at 50 entries
- On back navigation: restores within 5px accuracy
- On forward navigation: resets to (0, 0)
- Deferred restoration: waits for content render up to 2s timeout
- Keyed by `pathname` (excludes query params)

#### useOverlayStack

**File:** `hooks/use-overlay-stack.ts`
**Role:** Manages overlay history entries for sheets, panels, and dialogs.

```tsx
interface OverlayEntry {
  id: string
  type: 'sheet' | 'panel' | 'dialog'
  close: () => void
}

function useOverlayStack(): {
  push: (entry: OverlayEntry) => void
  pop: () => void
  peek: () => OverlayEntry | null
  size: number
}
```

- On `push`: calls `history.pushState()` with overlay marker
- On `popstate` (back button): calls `close()` on topmost entry
- Maintains LIFO order — multiple overlays close last-opened-first
- Prevents history entry accumulation: closing removes the corresponding entry
- Repeated open/close does not stack extra history entries

## Data Models

### 4.1 Platform Detection → Component Rendering

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│ User Agent / │────▶│ lib/platform/        │────▶│ PlatformProvider │
│ window APIs  │     │ platform.ts          │     │ (React Context)  │
└──────────────┘     │ → PlatformInfo       │     └────────┬─────────┘
                     └─────────────────────┘              │
┌──────────────┐     ┌─────────────────────┐              │
│ window.      │────▶│ lib/native/          │              │
│ Capacitor    │     │ runtime.ts           │              ▼
└──────────────┘     │ → RuntimeInfo        │     ┌──────────────────┐
                     └─────────────────────┘     │ ShellFrame        │
                                                  │ ├─ AppNavBar      │
                                                  │ │  (reads family, │
                                                  │ │   isAppleLike)  │
                                                  │ ├─ TabBar         │
                                                  │ │  (reads runtime │
                                                  │ │   for haptics)  │
                                                  │ └─ ShellSheet     │
                                                  │    (reads motion  │
                                                  │     prefs)        │
                                                  └──────────────────┘
```

### 4.2 Scroll Position Tracking & Restoration

```
┌────────────────┐    scroll event    ┌────────────────────────┐
│ ScrollContainer│───────────────────▶│ useScrollRestoration   │
│ (onScroll, rAF)│                    │ ┌────────────────────┐ │
└────────────────┘                    │ │ positionMap (LRU)  │ │
                                      │ │ key: pathname      │ │
        ┌─────────────────────────────│ │ val: scrollTop     │ │
        │ scrollOffset (number)       │ └────────────────────┘ │
        ▼                             └────────────────────────┘
┌────────────────┐                              │
│ AppNavBar      │                              │ on back nav:
│ (collapse at   │                              │ restore position
│  offset ≥ 60)  │                              ▼
└────────────────┘                    ┌────────────────────────┐
                                      │ ScrollContainer        │
                                      │ .scrollTo(0, stored)   │
                                      └────────────────────────┘
```

### 4.3 Keyboard State → TabBar Visibility

```
┌───────────────────┐   resize    ┌──────────────────┐
│ visualViewport    │────────────▶│ useKeyboardState │
│ (or window.resize │             │ { isOpen, height}│
│  as fallback)     │             └────────┬─────────┘
└───────────────────┘                      │
                                           │ isOpen = true
                                           ▼
                                  ┌──────────────────┐
                                  │ TabBar           │
                                  │ hidden={isOpen}  │
                                  │ (transform:      │
                                  │  translateY to   │
                                  │  avoid CLS)      │
                                  └──────────────────┘
```

### 4.4 Overlay Stack → History State Management

```
┌─────────────┐  open   ┌──────────────────┐  history.pushState  ┌─────────┐
│ ShellSheet  │────────▶│ useOverlayStack  │────────────────────▶│ History │
│ ShellPanel  │         │ (LIFO stack)     │                     │ API     │
└─────────────┘         └──────────────────┘                     └────┬────┘
                                 ▲                                     │
                                 │ popstate event                      │
                                 │ (Android back / browser back)       │
                                 └─────────────────────────────────────┘
                                           │
                                           ▼
                                  close topmost overlay
                                  (no route navigation)
```

### 4.5 Reduced Motion → Animation Behavior

```
┌────────────────────────────┐
│ prefers-reduced-motion:    │
│ reduce (OS setting)        │
└──────────┬─────────────────┘
           │
           ├──▶ CSS: native-shell.css sets --motion-ease-* to linear,
           │         animation-duration to 0.01ms
           │
           ├──▶ JS: useReducedMotion() from motion/react
           │    └──▶ NativePressable: no scale/hover transforms
           │    └──▶ ShellSheet: opacity-only, 1ms
           │    └──▶ ShellPanel: opacity-only, no translateX
           │    └──▶ AppNavBar: opacity-only collapse, no translateY
           │
           └──▶ Haptics: animation-triggered haptics disabled
                         user-action haptics (tap/drag) remain
```

## CSS Strategy

### 5.1 Custom Properties (from native-shell.css)

All shell components consume tokens from the existing `app/native-shell.css`:

| Token                        | Default                            | Android Override | Purpose             |
| ---------------------------- | ---------------------------------- | ---------------- | ------------------- |
| `--native-safe-top`          | `env(safe-area-inset-top, 0px)`    | —                | Status bar / notch  |
| `--native-safe-bottom`       | `env(safe-area-inset-bottom, 0px)` | —                | Home indicator      |
| `--native-safe-left`         | `env(safe-area-inset-left, 0px)`   | —                | Landscape left      |
| `--native-safe-right`        | `env(safe-area-inset-right, 0px)`  | —                | Landscape right     |
| `--native-toolbar-height`    | 52px                               | 56px             | AppNavBar height    |
| `--native-bottom-bar-height` | 72px                               | —                | TabBar total height |
| `--native-min-touch-target`  | 44px                               | 48px             | Min tap target      |
| `--native-radius-sheet`      | 28px (30px apple)                  | —                | Sheet corner radius |
| `--native-hairline`          | border at 72% opacity              | —                | List separators     |

### 5.2 Safe-Area Inset Application

```css
/* ShellFrame root */
.shell-frame {
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-top: var(--native-safe-top);
}

/* Landscape insets applied on orientation */
@media (orientation: landscape) {
  .shell-frame {
    padding-left: var(--native-safe-left);
    padding-right: var(--native-safe-right);
  }
}

/* TabBar safe-area */
.shell-tab-bar {
  padding-bottom: var(--native-safe-bottom);
}
```

### 5.3 Responsive Breakpoints

Single breakpoint at **768px** controls the mobile ↔ desktop split:

```css
/* TabBar: mobile only */
@media (min-width: 768px) {
  .shell-tab-bar {
    display: none;
  }
}

/* Panel: overlay on mobile, inline on desktop */
@media (min-width: 768px) {
  .shell-panel {
    position: static;
    width: clamp(240px, 25vw, 320px);
  }
}
```

### 5.4 Reduced-Motion Media Queries

Already defined in `native-shell.css`. Shell components extend:

```css
@media (prefers-reduced-motion: reduce) {
  .shell-sheet,
  .shell-panel {
    transition: opacity 0.01ms linear !important;
    transform: none !important;
  }

  .skeleton-shimmer {
    animation: none !important;
  }

  .shell-nav-bar--large-title {
    transition: opacity 0.01ms linear !important;
    transform: none !important;
  }
}
```

## Integration Points

### 6.1 lib/native/runtime.ts

- `getRuntime()` → determines if haptics should fire (capacitor/pwa contexts)
- `isNative()` → used by TabBar to decide haptic feedback on tab selection
- `isCapacitor()` → used by ShellFrame to confirm `viewport-fit: cover` is active

### 6.2 lib/platform/platform.ts

- `PlatformInfo.isAppleLike` → drives AppNavBar large-title behavior on iOS
- `PlatformInfo.family` → drives Android-specific toolbar height and elevation
- Platform classes (`.platform-family-android`, `.platform-apple-like`) → CSS token overrides in native-shell.css cascade naturally

### 6.3 lib/native/haptics.ts

- `hapticLight()` → called on TabBar tab selection (fire-and-forget, respects reduced-motion internally)
- `hapticSelection()` → available for continuous gesture feedback in lists
- No changes to haptics.ts required — it already handles platform detection and reduced-motion

### 6.4 lib/native/motion.ts

- `nativeMotion.spring.sheet` → ShellSheet open animation config
- `nativeMotion.spring.snappy` → NativePressable and AppNavBar collapse spring
- `nativeMotion.easing.exit` → ShellSheet dismiss curve
- `nativeMotion.duration.sheet` → 320ms dismiss duration
- `nativeMotion.press.scale` → NativeListItem press feedback

### 6.5 components/native/native-icon.tsx

- All shell icons route through `<NativeIcon name={...} />` — no direct SVG or iconoir-react imports
- New icons needed for shell (e.g., `home`, `moreHoriz`) must be added to `lib/native/icon-map.ts` first
- Existing accessibility pattern (`aria-hidden` default, `role="img"` with `aria-label`) is preserved

### 6.6 app/layout.tsx

- ShellFrame replaces the current `<div className="flex flex-col flex-1 ...">` and `<Header>` block
- Remains inside the existing provider tree (`PlatformProvider` → `NativeEnvironmentProvider` → `ThemeProvider`)
- `app/layout.tsx` continues to be a Server Component; ShellFrame is a Client Component rendered as a child
- `AppSidebar` migrates into `ShellPanel` for mobile overlay behavior

### 6.7 app/native-shell.css

- No breaking changes — existing tokens are consumed as-is
- New additions: `.shell-frame`, `.shell-tab-bar`, `.shell-nav-bar`, `.shell-sheet`, `.shell-panel` class rules
- Reduced-motion rules extended (not overwritten)

## Scope Guardrails

| Constraint                                     | Rationale                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| No search architecture changes                 | Search is a separate domain; shell only wraps it                                        |
| No broad App.tsx rewrites                      | Incremental extraction: ShellFrame wraps existing content, Header → AppNavBar is a swap |
| No new dependencies unless justified           | Stack is Next.js + Radix + Tailwind + motion + vaul; all present                        |
| vaul for sheet surfaces                        | Already installed (`vaul@^1.1.2` in package.json)                                       |
| No Framework7                                  | This is a Next.js App Router project; native feel via CSS/motion, not a framework swap  |
| NativeIcon only for icons                      | No raw SVG, no direct iconoir-react imports in shell components                         |
| Capacitor plugin access via global bridge only | No static imports of `@capacitor/*` plugins in shell code                               |
| Session-only scroll map                        | No localStorage/IndexedDB for scroll positions — in-memory LRU only                     |

## Error Handling

Shell components follow defensive patterns:

- **Runtime detection failure**: `getRuntime()` returns `'browser'` defaults on SSR or when globals are unavailable. All components render safe fallbacks.
- **Overlay stack corruption**: If `popstate` fires without a matching stack entry, `useOverlayStack` no-ops rather than throwing. Stack is reconciled on next push.
- **Scroll restoration miss**: If the stored scroll position exceeds document height (content changed), clamp to max scrollable offset. Timeout (2s) prevents indefinite waiting for content that never loads.
- **Keyboard detection failure**: If neither `visualViewport` nor `window.resize` produce events, `useKeyboardState` returns `{ isOpen: false, height: 0 }` — TabBar remains visible.
- **Icon map miss**: If `NativeIcon` receives a `name` not in `nativeIconMap`, it renders nothing and does not throw (already implemented in existing component).
- **Platform context unavailable**: Components consuming `usePlatform()` receive the SSR-safe default (`buildPlatformInfo()` with no input), rendering Apple-like defaults.

## Correctness Properties

### Property 1: Single Scroll Region

At any point in time, exactly one element within ShellFrame has `overflow-y: auto` (the ScrollContainer), unless a child is marked with `data-scroll-region`.

**Validates: Requirements 1.2, 1.5**

### Property 2: Overlay Stack Consistency

The number of history entries pushed by overlays equals the current `useOverlayStack.size`. Closing all overlays returns history to the pre-overlay state.

**Validates: Requirements 11.5, 11.6, 11.7**

### Property 3: TabBar Visibility Invariant

`TabBar.hidden === true` if and only if `useKeyboardState().isOpen === true` OR viewport width ≥ 768px.

**Validates: Requirements 3.5, 9.2**

### Property 4: Scroll Restoration Accuracy

For any back navigation to a previously visited route, `|restoredPosition - storedPosition| ≤ 5px`.

**Validates: Requirements 10.1**

### Property 5: Icon Discipline

No shell component file (`components/shell/**`) contains a direct import from `iconoir-react` or renders a raw `<svg>` element.

**Validates: Requirements 13.1, 13.2**

### Property 6: Reduced-Motion Compliance

When `prefers-reduced-motion: reduce` is active, no shell component applies `transform: translate*`, `transform: scale*`, or `transform: rotate*` during transitions.

**Validates: Requirements 12.1, 12.3**

### Property 7: Safe-Area Coverage

The ShellFrame root always applies `padding-top: var(--native-safe-top)`, and when in landscape, applies left/right safe-area padding.

**Validates: Requirements 8.1, 8.4**

### Property 8: Touch Target Minimum

Every interactive element in TabBar, AppNavBar, NativeList, and EmptyState has a computed min-height/min-width ≥ `--native-min-touch-target`.

**Validates: Requirements 2.5, 3.2, 14.1**

## Testing Strategy

### 8.1 Unit Tests (Vitest)

| Hook                   | Key Test Cases                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useBackButton`        | Closes topmost overlay on popstate; navigates back when no overlay; navigates to `/` when stack depth = 1                                                 |
| `useKeyboardState`     | Reports `isOpen: true` when visualViewport shrinks; falls back to window.resize; reports correct height                                                   |
| `useScrollRestoration` | Stores position keyed by pathname; restores within 5px on back nav; resets to 0 on forward nav; LRU evicts at 50 entries; defers restoration with timeout |
| `useOverlayStack`      | Push adds entry and calls pushState; pop removes entry; LIFO ordering; no duplicate history entries on repeated open/close                                |

### 8.2 Component Tests (Vitest + Testing Library)

| Component        | Key Test Cases                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ShellFrame`     | Renders three zones; hides TabBar at ≥768px; applies safe-area padding; sets overscroll-behavior                                      |
| `AppNavBar`      | Large title on Apple-like platforms; collapses after 60px scroll; shows back button when depth > 1; max 3 trailing actions + overflow |
| `TabBar`         | Renders 3-5 items with NativeIcon + label; active tab highlight; scroll-to-top on active tab tap; hidden when keyboard open           |
| `ShellSheet`     | Renders via vaul with correct border-radius; backdrop tap dismisses; focus trapped; respects reduced-motion                           |
| `ShellPanel`     | Overlay mode at <768px; inline at ≥768px; left safe-area padding; backdrop dismiss; focus return                                      |
| `SkeletonLoader` | CSS animation class present; no shimmer when reduced-motion; correct block count                                                      |
| `EmptyState`     | Renders icon at 48px, title, description; action button optional; centered layout                                                     |
| `NativeList`     | Touch target heights per platform; separator rendering; press feedback; reduced-motion fallback                                       |

### 8.3 Integration Tests

| Scenario                                                                       | Verification                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------- |
| Sheet open → Android back → sheet closes (no navigation)                       | `useOverlayStack` + `history.popstate` integration |
| Panel open → Sheet open over panel → back → sheet closes → back → panel closes | LIFO overlay ordering                              |
| Navigate away → navigate back → scroll restored                                | `useScrollRestoration` + router event coordination |
| Keyboard open → TabBar hidden → keyboard close → TabBar restored               | `useKeyboardState` + ShellFrame re-render          |
| Tab tap → haptic fires (mocked) → navigation occurs                            | `hapticLight` call + `router.push` call            |

### 8.4 Manual Verification Checklist

- [ ] iOS Capacitor: large title collapse, safe-area insets, haptics
- [ ] Android Capacitor: toolbar elevation, 48px touch targets, hardware back
- [ ] PWA standalone: no pull-to-refresh, correct safe-area behavior
- [ ] Desktop browser ≥768px: no TabBar, inline panel, standard nav bar
- [ ] Reduced motion ON: no spring animations, opacity-only transitions, no shimmer

## File Structure

```
components/shell/
  ├── shell-frame.tsx
  ├── app-nav-bar.tsx
  ├── tab-bar.tsx
  ├── shell-sheet.tsx
  ├── shell-panel.tsx
  ├── scroll-container.tsx
  ├── skeleton-loader.tsx
  ├── empty-state.tsx
  ├── native-list.tsx
  └── __tests__/
       ├── shell-frame.test.tsx
       ├── app-nav-bar.test.tsx
       ├── tab-bar.test.tsx
       ├── shell-sheet.test.tsx
       ├── shell-panel.test.tsx
       ├── skeleton-loader.test.tsx
       ├── empty-state.test.tsx
       └── native-list.test.tsx

hooks/
  ├── use-back-button.ts
  ├── use-keyboard-state.ts
  ├── use-scroll-restoration.ts
  ├── use-overlay-stack.ts
  └── __tests__/
       ├── use-back-button.test.ts
       ├── use-keyboard-state.test.ts
       ├── use-scroll-restoration.test.ts
       └── use-overlay-stack.test.ts
```

## Requirements Traceability

| Requirement                 | Primary Components                  | Hooks                               |
| --------------------------- | ----------------------------------- | ----------------------------------- |
| R1: Shell Page Structure    | ShellFrame, ScrollContainer         | —                                   |
| R2: Adaptive Navigation Bar | AppNavBar                           | useScrollRestoration (scrollOffset) |
| R3: Tab Bar Navigation      | TabBar                              | useKeyboardState                    |
| R4: Sheet Surface           | ShellSheet                          | useOverlayStack                     |
| R5: Panel Surface           | ShellPanel                          | useOverlayStack                     |
| R6: Loading States          | SkeletonLoader                      | —                                   |
| R7: Empty States            | EmptyState                          | —                                   |
| R8: Safe-Area Behavior      | ShellFrame (CSS), native-shell.css  | —                                   |
| R9: Keyboard Handling       | ShellFrame, TabBar, ScrollContainer | useKeyboardState                    |
| R10: Scroll Restoration     | ScrollContainer                     | useScrollRestoration                |
| R11: Back Button / History  | AppNavBar, ShellSheet, ShellPanel   | useBackButton, useOverlayStack      |
| R12: Reduced-Motion         | All animated components             | useReducedMotion (motion/react)     |
| R13: Icon Discipline        | All shell components via NativeIcon | —                                   |
| R14: List Component         | NativeList, NativeListItem          | —                                   |
