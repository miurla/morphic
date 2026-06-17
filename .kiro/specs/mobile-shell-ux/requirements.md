# Requirements Document

## Introduction

This specification covers Mobile Shell UX Hardening and App Navigation Consolidation for Morphic. The work focuses on establishing a robust, platform-adaptive shell structure that behaves correctly across iOS (Capacitor), Android (Capacitor), and desktop PWA contexts. It addresses page/view structure, adaptive navigation, overlay surfaces (sheets, panels), safe-area insets, keyboard handling, scroll restoration, back-button/history behavior, reduced-motion compliance, and icon discipline through the existing NativeIcon system.

The scope is limited to shell-level UX infrastructure. It does not include search architecture, local-first data, activity/feature wiring beyond the shell, broad App.tsx rewrites, or unrelated product features.

## Glossary

- **Shell**: The outermost layout structure rendered by `app/layout.tsx` that wraps all page content, including the header, main content area, and any persistent navigation surfaces.
- **AppNavBar**: The adaptive top navigation bar component that replaces the current `Header` component with platform-aware behavior (large title collapse on iOS, elevated bar on Android, standard bar on desktop).
- **TabBar**: A persistent bottom tab bar for primary navigation on mobile viewports, rendered inside the safe-area boundary.
- **Sheet**: A modal bottom sheet surface (using `vaul`) that slides up from the bottom with drag-to-dismiss behavior.
- **Panel**: A side panel surface (left or right) for secondary navigation or contextual content, replacing the current sidebar on mobile.
- **Safe_Area**: The region inside the device's physical insets (notch, home indicator, status bar) as reported by `env(safe-area-inset-*)` CSS environment variables.
- **NativeIcon**: The `components/native/native-icon.tsx` component that renders icons exclusively through `iconoir-react` via the centralized `lib/native/icon-map.ts` registry.
- **Platform_Provider**: The existing `components/platform/platform-provider.tsx` that exposes `PlatformInfo` (kind, family, displayMode, isAppleLike, isStandalone) to the component tree.
- **Runtime**: The detected execution context (capacitor, pwa, browser) from `lib/native/runtime.ts`.
- **Scroll_Container**: A designated scrollable element within the shell whose scroll position is tracked and restored on navigation.
- **Navigation_Stack**: The ordered history of routes managed by Next.js App Router and the browser History API, including modal/sheet layers.
- **Reduced_Motion**: The user preference indicated by the `prefers-reduced-motion: reduce` media query, which disables non-essential animations and transitions.

## Requirements

### Requirement 1: Shell Page Structure

**User Story:** As a mobile user, I want the app shell to provide a stable, non-scrolling frame around scrollable page content, so that navigation elements remain accessible while I scroll.

#### Acceptance Criteria

1. THE Shell SHALL render a fixed viewport frame (`100dvh`) with `overflow: hidden` that contains exactly three vertical zones: AppNavBar (top), Scroll_Container (middle, flex-grow), and TabBar (bottom on viewports below 768px width).
2. THE Scroll_Container SHALL be the sole scrollable region within the shell; nested scroll containers SHALL only be permitted on elements marked with the `data-scroll-region` attribute (e.g., chat message lists).
3. WHILE the viewport width is 768px or greater, THE Shell SHALL hide the TabBar and display primary navigation within the AppNavBar.
4. THE Shell SHALL apply the `overscroll-behavior: none` property to the root scroll container to prevent pull-to-refresh interference on mobile.
5. THE Shell frame SHALL apply `overflow-y: auto` to the Scroll_Container and `overflow: hidden` to both the AppNavBar and TabBar zones to ensure only the Scroll_Container produces scrollable content.

### Requirement 2: Adaptive Navigation Bar

**User Story:** As a user on different platforms, I want the navigation bar to match my platform's conventions, so that the app feels native to my device.

#### Acceptance Criteria

1. WHILE the Platform_Provider reports `isAppleLike: true` and the viewport is below 768px, THE AppNavBar SHALL render a large title (34px font size) at an expanded height of 96px that collapses to an inline title at the standard `--native-toolbar-height` (52px) once the Scroll_Container has scrolled 60px or more from the top.
2. WHILE the Platform_Provider reports `family: 'android'` and the viewport is below 768px, THE AppNavBar SHALL render with a fixed height of `--native-toolbar-height` (56px) and a bottom elevation shadow of `0 2px 4px rgba(0, 0, 0, 0.08)`.
3. WHILE the viewport width is 768px or greater, THE AppNavBar SHALL render a bar at the height defined by `--native-toolbar-height` for the current platform with an inline title, regardless of platform family.
4. IF the Navigation_Stack depth is greater than 1 and the current route is not the root, THEN THE AppNavBar SHALL render a leading back button using NativeIcon `arrowLeft` with a touch target of at least `--native-min-touch-target`.
5. THE AppNavBar SHALL render trailing action buttons with a minimum touch target of `--native-min-touch-target` (44px on iOS, 48px on Android) and SHALL display a maximum of 3 trailing action buttons; any additional actions SHALL be accessible via an overflow menu triggered by a NativeIcon `moreHoriz` button.
6. WHILE the Platform_Provider reports `isAppleLike: true` and Reduced_Motion is active, THE AppNavBar SHALL transition between large-title and collapsed states without vertical translation animation, using opacity-only changes.

### Requirement 3: Tab Bar Navigation

**User Story:** As a mobile user, I want a persistent bottom tab bar for primary navigation, so that I can switch between main sections with one tap.

#### Acceptance Criteria

1. WHILE the viewport width is below 768px, THE TabBar SHALL be visible and fixed to the bottom of the shell above the Safe_Area bottom inset.
2. THE TabBar SHALL render between 3 and 5 tab items, each consisting of a NativeIcon component from the icon-map registry and a text label, with each tab item maintaining a minimum touch target size of `--native-min-touch-target` (44px on iOS, 48px on Android).
3. WHEN a tab item is tapped, THE TabBar SHALL navigate to the corresponding route using Next.js `router.push()` and indicate the active tab by applying a distinct foreground color to the active item's icon and label while inactive items use a muted foreground color.
4. THE TabBar SHALL have a total height of `--native-bottom-bar-height` (72px) inclusive of bottom safe-area padding.
5. WHEN the viewport width is 768px or greater, THE TabBar SHALL not render.
6. IF the Runtime is `capacitor` or `pwa`, THEN THE TabBar SHALL trigger a light haptic (`hapticLight` from `lib/native/haptics.ts`) on tab selection.
7. WHEN the user taps the tab item corresponding to the currently active route, THE TabBar SHALL scroll the active view's Scroll_Container to the top instead of performing a navigation.

### Requirement 4: Sheet Surface

**User Story:** As a mobile user, I want bottom sheets to provide contextual actions and content without leaving my current view, so that I can interact with supplementary information in place.

#### Acceptance Criteria

1. WHEN a Sheet is opened, THE Sheet SHALL animate in from the bottom with the spring configuration defined in `nativeMotion.spring.sheet` (stiffness: 360, damping: 42, mass: 1).
2. THE Sheet SHALL render with border-radius `--native-radius-sheet` at its top-left and top-right corners and square (0px) corners at the bottom.
3. WHEN the user drags the Sheet downward past 40% of its height, THE Sheet SHALL dismiss with a downward slide-out animation using the `nativeMotion.easing.exit` timing curve and a duration of `nativeMotion.duration.sheet` (320ms).
4. WHILE a Sheet is open, THE Shell SHALL render a backdrop overlay with background color `rgba(0, 0, 0, 0.8)` covering the full viewport behind the Sheet.
5. WHEN the user taps the backdrop overlay while a Sheet is open, THE Sheet SHALL dismiss.
6. WHEN the Android back button or browser back button is pressed while a Sheet is open, THE Sheet SHALL close without navigating away from the current route.
7. WHILE a Sheet is open, THE Sheet SHALL trap keyboard focus within its content, preventing focus from moving to elements behind the backdrop until the Sheet is dismissed.
8. THE Sheet SHALL have a maximum height of 90% of the viewport height (90dvh), and its content area SHALL scroll vertically if content exceeds the available space.
9. WHILE Reduced_Motion is active, THE Sheet SHALL open and close with opacity-only transitions (no vertical translation animation), completing within 1ms.

### Requirement 5: Panel Surface

**User Story:** As a user, I want side panels to provide access to history and navigation without obscuring my primary content on larger screens, so that I can multitask effectively.

#### Acceptance Criteria

1. WHILE the viewport width is below 768px, THE Panel SHALL render as an overlay that slides in from the left edge with a backdrop, occupying no more than 85% of the viewport width.
2. WHILE the viewport width is 768px or greater, THE Panel SHALL render as a persistent inline column between 240px and 320px wide, adjacent to the main content without overlapping it.
3. WHEN the Panel is open on mobile and the user taps the backdrop, THE Panel SHALL dismiss and return focus to the previously focused element.
4. WHEN the Android back button is pressed while the Panel overlay is open, THE Panel SHALL close without navigating away.
5. WHILE the Panel is rendered on the left edge, THE Panel SHALL apply padding equal to `var(--native-safe-left)` so that content is not obscured by device insets.
6. WHILE Reduced_Motion is active, THE Panel SHALL open and close with opacity-only transitions (no horizontal translation animation).

### Requirement 6: Loading States

**User Story:** As a user, I want consistent loading indicators across the app, so that I know the app is working when content is being fetched.

#### Acceptance Criteria

1. THE Shell SHALL provide a skeleton loading component that renders rectangular placeholder blocks whose count and arrangement correspond to the target content area (at minimum one block per distinct content region).
2. WHEN a page transition begins and the new page has not rendered within 100ms, THE Shell SHALL display the skeleton loading state until the page renders or a maximum of 10 seconds elapses, whichever comes first.
3. THE Shell SHALL use CSS animations (not JavaScript-driven animations) for skeleton shimmer effects to maintain 60fps during loading.
4. WHILE Reduced_Motion is active, THE Shell SHALL display static placeholder blocks without shimmer animation.
5. WHEN the loading state is displayed and the page renders, THE Shell SHALL replace the skeleton with the page content without intermediate blank frames.

### Requirement 7: Empty States

**User Story:** As a user, I want clear and helpful empty states when there is no content to display, so that I understand what action to take next.

#### Acceptance Criteria

1. WHEN a content list has zero items, THE Shell SHALL render an empty state view containing an icon (via NativeIcon at 48px size), a title (maximum 60 characters), and a description (maximum 200 characters).
2. THE Shell empty state component SHALL accept an optional action button with a label and a callback, rendering the button with a minimum touch target of `--native-min-touch-target`.
3. THE Shell empty state SHALL be vertically and horizontally centered within its parent Scroll_Container.
4. WHEN the empty state action button is provided, THE Shell SHALL render it below the description with 16px spacing from the description text.

### Requirement 8: Safe-Area Behavior

**User Story:** As a user on a device with a notch, rounded corners, or home indicator, I want the app content to remain within the visible safe area, so that nothing is obscured by hardware features.

#### Acceptance Criteria

1. THE Shell SHALL apply `padding-top: var(--native-safe-top)` to the root frame to account for the status bar and notch.
2. THE Shell SHALL apply `padding-bottom: var(--native-safe-bottom)` to the TabBar container so that tab items are not obscured by the home indicator.
3. WHILE the Runtime is `capacitor` on iOS, THE Shell SHALL set `viewport-fit: cover` in the viewport meta tag to enable access to the full screen area behind device insets.
4. WHILE the device is in landscape orientation, THE Shell SHALL apply `padding-left: var(--native-safe-left)` and `padding-right: var(--native-safe-right)` to the root frame.
5. WHEN the device orientation changes between portrait and landscape, THE Shell SHALL update safe-area padding using CSS environment variables without causing a Cumulative Layout Shift greater than 0.1 as measured by the Layout Instability API.

### Requirement 9: Keyboard Handling and Focus Behavior

**User Story:** As a mobile user, I want the app to handle keyboard appearance gracefully, so that input fields remain visible and interactive when typing.

#### Acceptance Criteria

1. WHEN the virtual keyboard opens on a mobile device, THE Shell SHALL adjust the visible viewport so that the focused input element is not obscured by the keyboard.
2. WHILE the keyboard is open, THE TabBar SHALL collapse to zero height and become hidden so that it does not overlap the keyboard.
3. WHEN an input element receives focus inside a Scroll_Container, THE Shell SHALL scroll the container to bring the input into view within 300ms.
4. WHEN the keyboard closes, THE Shell SHALL restore the original viewport height and re-display the TabBar within 100ms of the `visualViewport` resize event.
5. THE Shell SHALL use the `visualViewport` API for detecting keyboard-driven viewport resize events, and SHALL not trigger layout reflow that causes a Cumulative Layout Shift greater than 0.1 when the keyboard opens or closes.
6. IF the `visualViewport` API is unavailable, THEN THE Shell SHALL fall back to listening for `window.resize` events to detect keyboard appearance and disappearance.

### Requirement 10: Scroll Restoration

**User Story:** As a user navigating between pages, I want my scroll position to be remembered and restored, so that I don't lose my place when returning to a previous view.

#### Acceptance Criteria

1. WHEN the user navigates away from a page and then returns via back navigation (browser back button, Android hardware back, or in-app back button triggering `router.back()`), THE Shell SHALL restore the Scroll_Container to its previous scroll position within 5px of the stored value.
2. WHEN the user navigates to a new page via forward navigation (link click, tab tap, or programmatic `router.push()`), THE Shell SHALL reset the Scroll_Container scroll position to the top (0, 0).
3. THE Shell SHALL store scroll positions keyed by route path (excluding query parameters) in a session-lifetime in-memory map that retains a maximum of 50 entries, evicting the least recently accessed entry when the limit is exceeded.
4. WHEN a page includes dynamically loaded content that changes document height, THE Shell SHALL defer scroll restoration until the content has rendered (within a 2-second timeout, after which it restores to the stored position regardless).

### Requirement 11: Back Button and History Behavior

**User Story:** As a user, I want the back button (hardware, browser, or in-app) to behave predictably, so that I can always return to where I came from without confusion.

#### Acceptance Criteria

1. WHEN the Android hardware back button is pressed and one or more overlay surfaces (Sheet, Panel, or Dialog) are open, THE Shell SHALL close only the topmost overlay surface without navigating back in the Navigation_Stack.
2. WHEN the Android hardware back button is pressed and no overlay is open, THE Shell SHALL navigate to the previous route in the Navigation_Stack if the stack depth is greater than 1, otherwise remain on the current route.
3. WHEN the browser back button is pressed, THE Shell SHALL follow standard History API behavior (popstate) including closing overlays that pushed a history entry.
4. WHEN the in-app back button (AppNavBar leading button) is tapped, THE Shell SHALL call `router.back()` if the Navigation_Stack depth is greater than 1, otherwise navigate to the root route (`/`).
5. WHEN a Sheet or Panel opens, THE Shell SHALL push exactly one history state entry so that browser/Android back closes the surface before navigating away.
6. WHEN an overlay is opened and closed repeatedly without other navigation, THE Shell SHALL not accumulate additional history entries beyond the single entry pushed on open; closing the overlay SHALL remove its corresponding history entry.
7. IF multiple overlays are open simultaneously (e.g., a Dialog presented over a Sheet), THEN THE Shell SHALL close them in last-opened-first-closed order, one per back action.

### Requirement 12: Reduced-Motion Compliance

**User Story:** As a user who is sensitive to motion, I want the app to respect my reduced-motion preference, so that I can use the app without discomfort.

#### Acceptance Criteria

1. WHILE Reduced_Motion is active, THE Shell SHALL disable all spring and eased transitions, replacing them with opacity-only state changes that complete within 1ms (no translate, scale, or rotate transforms).
2. WHILE Reduced_Motion is active, THE Shell SHALL disable haptic feedback triggered by animations; selection haptics (`hapticSelection`) triggered by explicit user actions (tap, drag) SHALL remain allowed.
3. WHILE Reduced_Motion is active, THE NativePressable component SHALL not apply scale transforms on press and SHALL not apply hover lift transforms.
4. THE Shell SHALL read the `prefers-reduced-motion` preference via the `useReducedMotion()` hook from `motion/react` for all animated components, and re-evaluate when the system preference changes at runtime.
5. WHILE Reduced_Motion is active, THE Shell SHALL set CSS custom properties `--motion-ease-out`, `--motion-ease-in-out`, and `--motion-ease-drawer` to `linear` and all `animation-duration` values to `0.01ms` (as defined in `native-shell.css`).

### Requirement 13: Icon Discipline via NativeIcon

**User Story:** As a developer, I want all icons to flow through a single component backed by the icon-map registry, so that icon usage is consistent, tree-shakeable, and auditable.

#### Acceptance Criteria

1. THE Shell SHALL render all icons exclusively through the NativeIcon component (from `components/native/native-icon.tsx`); no shell-level component file SHALL render an SVG element or icon component directly.
2. THE Shell SHALL not import icon components directly from `iconoir-react` in any shell-level component file; all icon imports SHALL go through `lib/native/icon-map.ts`.
3. WHEN a new icon is needed for the shell, THE icon-map registry SHALL be extended with a named entry (key of type `NativeIconName`) mapping to the corresponding `iconoir-react` export before the icon can be used.
4. THE NativeIcon component SHALL apply `aria-hidden="true"` by default unless an `aria-label` prop is provided, in which case it SHALL apply `role="img"` and omit `aria-hidden`.
5. THE NativeIcon component SHALL accept `size` (number or string applied to width and height), `className`, and `strokeWidth` (defaulting to 1.75) props for consistent styling control across all usage sites.
6. IF a `name` prop value is passed that does not exist in `nativeIconMap`, THEN THE NativeIcon component SHALL not render any output and SHALL not throw a runtime error.

### Requirement 14: List Component

**User Story:** As a mobile user, I want list views to feel native and responsive, so that scrolling through items is smooth and interactions are clear.

#### Acceptance Criteria

1. THE Shell SHALL provide a list component that renders each item with a minimum touch target height of `--native-min-touch-target` (44px on iOS/desktop, 48px on Android).
2. THE Shell list component SHALL support separator lines between items using a 1px border in the `--native-hairline` color token, inset from the leading edge to align with the item text content.
3. THE Shell list component SHALL support leading icon (via NativeIcon), title (single line, truncated with ellipsis if overflow), subtitle (single line, truncated with ellipsis if overflow), and trailing accessory slots per item.
4. WHEN a list item is pressed on a touch device, THE Shell list component SHALL display a press highlight state using NativePressable scale feedback with the default `pressScale` value from `nativeMotion.press.scale`.
5. WHILE Reduced_Motion is active, THE Shell list component SHALL use a background-color change (to `--native-hairline` opacity) instead of scale for press feedback, with no transition animation.
