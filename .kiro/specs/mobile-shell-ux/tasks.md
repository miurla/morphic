# Implementation Plan

## Overview

Implementation tasks for Mobile Shell UX Hardening / App Navigation Consolidation. Tasks are ordered by dependency: foundation hooks → shell primitives → navigation components → overlay surfaces → content primitives → integration. Each task produces working, testable code without breaking existing behavior.

## Tasks

- [ ] 1. Implement useKeyboardState hook
  - [ ] 1.1 Create `hooks/use-keyboard-state.ts` implementing the `KeyboardState` interface (`isOpen: boolean`, `height: number`)
  - [ ] 1.2 Implement primary detection via `window.visualViewport` resize events comparing `viewport.height` to `window.innerHeight`
  - [ ] 1.3 Implement fallback detection via `window.resize` when `visualViewport` is unavailable
  - [ ] 1.4 Ensure the hook returns `{ isOpen: false, height: 0 }` during SSR and when detection APIs are unavailable
  - [ ] 1.5 Add cleanup of event listeners on unmount
  - [ ] 1.6 Create `hooks/__tests__/use-keyboard-state.test.ts` with tests: reports `isOpen: true` when visualViewport shrinks; falls back to window.resize; reports correct height; returns safe defaults when APIs unavailable

- [ ] 2. Implement useScrollRestoration hook
  - [ ] 2.1 Create `hooks/use-scroll-restoration.ts` implementing the `UseScrollRestorationOptions` interface with `containerRef`, `deferUntilReady`, and `timeout` (default 2000ms)
  - [ ] 2.2 Implement in-memory `Map<string, number>` with LRU eviction at 50 entries, keyed by `pathname` (excluding query params)
  - [ ] 2.3 On back navigation (`popstate`): restore scroll position within 5px accuracy, with deferred restoration waiting for content render up to timeout
  - [ ] 2.4 On forward navigation: reset scroll to `(0, 0)`
  - [ ] 2.5 Export `scrollOffset` (current scroll position via rAF-throttled tracking) and `scrollToTop()` method
  - [ ] 2.6 Create `hooks/__tests__/use-scroll-restoration.test.ts` with tests: stores position keyed by pathname; restores within 5px on back nav; resets to 0 on forward nav; LRU evicts at 50 entries; defers restoration with timeout

- [ ] 3. Implement useOverlayStack hook
  - [ ] 3.1 Create `hooks/use-overlay-stack.ts` implementing the `OverlayEntry` interface (`id`, `type`, `close`) and stack API (`push`, `pop`, `peek`, `size`)
  - [ ] 3.2 On `push`: call `history.pushState()` with an overlay marker identifying the entry
  - [ ] 3.3 On `popstate`: call `close()` on the topmost entry (LIFO order) without navigating
  - [ ] 3.4 Prevent history entry accumulation: closing an overlay removes its corresponding history entry
  - [ ] 3.5 Handle edge case: if `popstate` fires without a matching stack entry, no-op rather than throwing
  - [ ] 3.6 Create `hooks/__tests__/use-overlay-stack.test.ts` with tests: push adds entry and calls pushState; pop removes entry; LIFO ordering; no duplicate history entries on repeated open/close; graceful handling of orphan popstate

- [ ] 4. Implement useBackButton hook
  - [ ] 4.1 Create `hooks/use-back-button.ts` implementing the `UseBackButtonOptions` interface with optional `onBack` handler
  - [ ] 4.2 Listen for `popstate` events; if `useOverlayStack` has open overlays, close topmost instead of navigating
  - [ ] 4.3 When no overlay is open: call `router.back()` if stack depth > 1, else navigate to `/`
  - [ ] 4.4 Support custom `onBack` handler override
  - [ ] 4.5 Create `hooks/__tests__/use-back-button.test.ts` with tests: closes topmost overlay on popstate; navigates back when no overlay; navigates to `/` when stack depth = 1; custom handler invoked when provided

- [ ] 5. Implement ScrollContainer component
  - [ ] 5.1 Create `components/shell/scroll-container.tsx` as a client component with `ScrollContainerProps` interface (`children`, `className`, `onScrollOffsetChange`)
  - [ ] 5.2 Set `overflow-y: auto` as the sole scrollable region; integrate with `useScrollRestoration` hook for position tracking
  - [ ] 5.3 Implement rAF-throttled scroll event reporting (~60fps) calling `onScrollOffsetChange` with current `scrollTop`
  - [ ] 5.4 Allow nested scrolls on children marked with `data-scroll-region`
  - [ ] 5.5 Add focus-into-view behavior: when keyboard opens, scroll focused input into view within 300ms
  - [ ] 5.6 Create `components/shell/__tests__/scroll-container.test.tsx` with tests: renders children; reports scroll offset; allows nested scroll regions; applies className prop

- [ ] 6. Implement ShellFrame component
  - [ ] 6.1 Create `components/shell/shell-frame.tsx` as a client component with `ShellFrameProps` interface (`children`, `navBar`, `tabBar`)
  - [ ] 6.2 Apply `height: 100dvh`, `overflow: hidden`, flex column layout with three zones: navBar (auto) → children (1fr) → tabBar (auto)
  - [ ] 6.3 Apply `padding-top: var(--native-safe-top)` and landscape insets via CSS media query
  - [ ] 6.4 Set `overscroll-behavior: none` on the root scroll container
  - [ ] 6.5 Consume `useKeyboardState` to pass `hidden` prop to TabBar slot when keyboard is open
  - [ ] 6.6 Create `components/shell/__tests__/shell-frame.test.tsx` with tests: renders three zones; applies safe-area padding; sets overscroll-behavior; passes keyboard state to TabBar

- [ ] 7. Implement AppNavBar component
  - [ ] 7.1 Create `components/shell/app-nav-bar.tsx` as a client component with `AppNavBarProps` interface (`title`, `leadingAction`, `trailingActions`, `scrollOffset`)
  - [ ] 7.2 Implement Apple-like large title (34px, 96px height) collapsing to inline (52px) after 60px scroll using CSS transform with `nativeMotion.spring.snappy`
  - [ ] 7.3 Implement Android variant: fixed 56px height with bottom elevation shadow `0 2px 4px rgba(0,0,0,0.08)`
  - [ ] 7.4 Implement desktop (≥768px): fixed bar at `--native-toolbar-height` with inline title
  - [ ] 7.5 Render leading back button (NativeIcon `arrowLeft`) when navigation stack depth > 1; render max 3 trailing actions with overflow to NativeIcon `moreHoriz` menu
  - [ ] 7.6 Ensure all interactive elements meet `--native-min-touch-target` minimum size
  - [ ] 7.7 When `prefers-reduced-motion` is active: opacity-only collapse transition, no translateY
  - [ ] 7.8 Create `components/shell/__tests__/app-nav-bar.test.tsx` with tests: large title on Apple-like; collapses after 60px scroll; Android elevation; back button when depth > 1; max 3 trailing actions + overflow; reduced-motion compliance

- [ ] 8. Implement TabBar component
  - [ ] 8.1 Create `components/shell/tab-bar.tsx` as a client component with `TabBarProps` interface (`items`, `activeHref`, `onScrollToTop`, `hidden`)
  - [ ] 8.2 Render 3–5 `TabItem` elements (NativeIcon + label) with min touch target `--native-min-touch-target`
  - [ ] 8.3 Set total height to `--native-bottom-bar-height` (72px) inclusive of `padding-bottom: var(--native-safe-bottom)`
  - [ ] 8.4 Hide via CSS `@media (min-width: 768px)` and via `hidden` prop (keyboard state) using `transform: translateY` to avoid CLS
  - [ ] 8.5 Navigate via `router.push()` on tab tap; apply distinct active/inactive foreground colors
  - [ ] 8.6 On tapping the already-active tab: call `onScrollToTop` instead of navigating
  - [ ] 8.7 Fire `hapticLight()` on tab selection when runtime is `capacitor` or `pwa`
  - [ ] 8.8 Create `components/shell/__tests__/tab-bar.test.tsx` with tests: renders items with NativeIcon + label; active tab highlight; scroll-to-top on active tab tap; hidden when keyboard open; haptic fires in capacitor runtime

- [ ] 9. Implement ShellSheet component
  - [ ] 9.1 Create `components/shell/shell-sheet.tsx` as a client component wrapping `vaul` Drawer with `ShellSheetProps` interface (`open`, `onOpenChange`, `children`, `snapPoints`)
  - [ ] 9.2 Apply spring animation from `nativeMotion.spring.sheet` (stiffness 360, damping 42) on open
  - [ ] 9.3 Dismiss on drag past 40% height using `nativeMotion.easing.exit` curve at 320ms duration
  - [ ] 9.4 Render backdrop `rgba(0,0,0,0.8)` with tap-to-dismiss; max height 90dvh with internal scroll
  - [ ] 9.5 Apply `--native-radius-sheet` to top corners, 0px bottom
  - [ ] 9.6 Integrate with `useOverlayStack`: push history entry on open, remove on close
  - [ ] 9.7 Trap keyboard focus within sheet content
  - [ ] 9.8 When `prefers-reduced-motion` is active: opacity-only transition, 1ms duration
  - [ ] 9.9 Create `components/shell/__tests__/shell-sheet.test.tsx` with tests: renders via vaul with correct border-radius; backdrop tap dismisses; focus trapped; overlay stack integration; reduced-motion compliance

- [ ] 10. Implement ShellPanel component
  - [ ] 10.1 Create `components/shell/shell-panel.tsx` as a client component with `ShellPanelProps` interface (`open`, `onOpenChange`, `side`, `children`)
  - [ ] 10.2 Mobile (<768px): overlay from left, max 85vw, backdrop, slide-in animation
  - [ ] 10.3 Desktop (≥768px): persistent inline column `clamp(240px, 25vw, 320px)`, no overlay
  - [ ] 10.4 Apply `padding-left: var(--native-safe-left)` on left-edge panel
  - [ ] 10.5 Integrate with `useOverlayStack`: push history entry on open in mobile overlay mode
  - [ ] 10.6 On backdrop tap or back button: dismiss and return focus to previously focused element
  - [ ] 10.7 When `prefers-reduced-motion` is active: opacity-only, no translateX
  - [ ] 10.8 Create `components/shell/__tests__/shell-panel.test.tsx` with tests: overlay mode at <768px; inline at ≥768px; left safe-area padding; backdrop dismiss; focus return; reduced-motion compliance

- [ ] 11. Implement SkeletonLoader component
  - [ ] 11.1 Create `components/shell/skeleton-loader.tsx` with `SkeletonLoaderProps` interface (`variant`: 'list' | 'card' | 'content', `blocks`: number)
  - [ ] 11.2 Implement CSS `@keyframes` shimmer animation (no JS-driven animation) for placeholder blocks
  - [ ] 11.3 Display after 100ms delay if page hasn't rendered; auto-hide after 10s timeout
  - [ ] 11.4 Swap to real content without intermediate blank frames
  - [ ] 11.5 When `prefers-reduced-motion` is active: static blocks, no shimmer
  - [ ] 11.6 Create `components/shell/__tests__/skeleton-loader.test.tsx` with tests: CSS animation class present; no shimmer when reduced-motion; correct block count per variant

- [ ] 12. Implement EmptyState component
  - [ ] 12.1 Create `components/shell/empty-state.tsx` with `EmptyStateProps` interface (`icon`: NativeIconName, `title`, `description`, `action?`)
  - [ ] 12.2 Render NativeIcon at 48px, title (max 60 chars), description (max 200 chars), centered vertically and horizontally in parent
  - [ ] 12.3 Optional action button 16px below description with min touch target `--native-min-touch-target`
  - [ ] 12.4 Create `components/shell/__tests__/empty-state.test.tsx` with tests: renders icon at 48px; renders title and description; action button optional and correctly spaced; centered layout

- [ ] 13. Implement NativeList component
  - [ ] 13.1 Create `components/shell/native-list.tsx` with `NativeListProps` (`children`, `separators`) and `NativeListItemProps` (`icon?`, `title`, `subtitle?`, `trailing?`, `onPress?`)
  - [ ] 13.2 Set min touch target height `--native-min-touch-target` (44px iOS, 48px Android) per item
  - [ ] 13.3 Render 1px separators using `--native-hairline` color, inset from leading edge
  - [ ] 13.4 Support slots: leading NativeIcon, title (truncated ellipsis), subtitle (truncated ellipsis), trailing accessory
  - [ ] 13.5 Apply NativePressable scale feedback via `nativeMotion.press.scale` on press
  - [ ] 13.6 When `prefers-reduced-motion` is active: background-color change instead of scale, no transition
  - [ ] 13.7 Create `components/shell/__tests__/native-list.test.tsx` with tests: touch target heights per platform; separator rendering; press feedback; slots render correctly; reduced-motion fallback

- [ ] 14. Add shell icons to icon-map registry
  - [ ] 14.1 Add `home` icon entry to `lib/native/icon-map.ts` mapping to appropriate `iconoir-react` export (e.g., `Home`)
  - [ ] 14.2 Add `moreHoriz` icon entry to `lib/native/icon-map.ts` mapping to appropriate `iconoir-react` export (e.g., `MoreHoriz` or `Menu`)
  - [ ] 14.3 Add any other icons needed by TabBar items (e.g., `library`, `discover`) that aren't already in the map
  - [ ] 14.4 Verify all new entries satisfy the `NativeIconName` type and render correctly via `<NativeIcon name={...} />`
  - [ ] 14.5 Update `components/native/native-icon.test.tsx` to cover the new icon entries (renders without error, returns null for unknown names)

- [ ] 15. Integration — Wire ShellFrame into app/layout.tsx
  - [ ] 15.1 Import `ShellFrame`, `AppNavBar`, `TabBar`, and `ScrollContainer` into `app/layout.tsx`
  - [ ] 15.2 Replace the current `<div className="flex flex-col flex-1 ... native-app-frame">` wrapper with `<ShellFrame>` containing the appropriate slot props
  - [ ] 15.3 Replace `<Header user={user} />` with `<AppNavBar>` configured with title and trailing actions matching current Header functionality
  - [ ] 15.4 Wrap the `<main>` / `<ArtifactRoot>{children}</ArtifactRoot>` content inside `<ScrollContainer>`
  - [ ] 15.5 Add `<TabBar>` with items for primary navigation routes (home, search, library, discovery, settings) using NativeIcon names from the icon-map
  - [ ] 15.6 Ensure existing `SidebarProvider` + `AppSidebar` continue to work (they will be migrated to ShellPanel in the next task)
  - [ ] 15.7 Verify the app builds (`bun run build`) and renders without breaking existing behavior
  - [ ] 15.8 Run existing tests (`bun run test`) to ensure no regressions

- [ ] 16. Integration — Migrate Sidebar to ShellPanel
  - [ ] 16.1 Import `ShellPanel` into `app/layout.tsx` and wire it to replace the current `AppSidebar` overlay behavior on mobile
  - [ ] 16.2 On mobile (<768px): `AppSidebar` content renders inside `ShellPanel` as a left overlay
  - [ ] 16.3 On desktop (≥768px): `ShellPanel` renders as an inline persistent column (current sidebar behavior preserved)
  - [ ] 16.4 Connect `ShellPanel` open/close to existing sidebar toggle trigger (hamburger / `sidebarOpen` icon in AppNavBar)
  - [ ] 16.5 Verify back button dismisses the panel on mobile without navigating away (via `useOverlayStack` integration)
  - [ ] 16.6 Run `bun run build` and `bun run test` to confirm no regressions
  - [ ] 16.7 Test manually: sidebar opens/closes on mobile, persists inline on desktop, focus returns on dismiss

## Task Dependency Graph

```json
{
  "waves": [
    {
      "description": "Foundation hooks and icon-map (no dependencies, parallelizable)",
      "tasks": [1, 2, 3, 4, 14]
    },
    {
      "description": "Shell primitives (depend on hooks from wave 1)",
      "tasks": [5, 6]
    },
    {
      "description": "Navigation components (depend on hooks and icon-map)",
      "tasks": [7, 8]
    },
    {
      "description": "Overlay surfaces (depend on useOverlayStack)",
      "tasks": [9, 10]
    },
    {
      "description": "Content primitives (no hook dependencies, parallelizable)",
      "tasks": [11, 12, 13]
    },
    {
      "description": "Integration — wire shell into layout",
      "tasks": [15]
    },
    {
      "description": "Integration — migrate sidebar to ShellPanel",
      "tasks": [16]
    }
  ]
}
```

## Notes

- All shell components live under `components/shell/` with tests in `components/shell/__tests__/`
- All hooks live under `hooks/` with tests in `hooks/__tests__/`
- No shell component imports directly from `iconoir-react`; all icons go through `NativeIcon` + `lib/native/icon-map.ts`
- No new npm dependencies required; `vaul`, `motion/react`, and `iconoir-react` are already installed
- Task 14 (icon-map additions) can be executed at any point before Tasks 7 and 8 that consume the new icons
- Each task is independently testable via `bun run test` — no task leaves the build in a broken state
