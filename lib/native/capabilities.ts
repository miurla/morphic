export interface NativeCapabilitySignals {
  navigator?: Partial<Navigator> & {
    canShare?: Navigator['canShare']
    clipboard?: Partial<Clipboard>
    standalone?: boolean
    userActivation?: { isActive?: boolean; hasBeenActive?: boolean }
    virtualKeyboard?: unknown
    wakeLock?: unknown
  }
  notification?: typeof Notification
  pushManager?: typeof PushManager
  serviceWorkerRegistration?: Partial<ServiceWorkerRegistration>
  window?: Partial<Window> & {
    BeforeInstallPromptEvent?: unknown
    FileSystemFileHandle?: unknown
    PublicKeyCredential?: unknown
    showOpenFilePicker?: unknown
  }
}

export interface NativeCapabilities {
  canShare: boolean
  canShareFiles: boolean
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

export const defaultNativeCapabilities: NativeCapabilities = {
  canShare: false,
  canShareFiles: false,
  canClipboardRead: false,
  canClipboardWrite: false,
  canPush: false,
  canBadge: false,
  canInstallPrompt: false,
  canUseFileSystemAccess: false,
  canUseFilePicker: false,
  canUseWebAuthn: false,
  canUseWakeLock: false,
  canUseWindowControlsOverlay: false,
  canUseVirtualKeyboard: false,
  canUseHaptics: false
}

function hasFunction(value: unknown): boolean {
  return typeof value === 'function'
}

function hasObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null
}

function canShareFiles(nav: NativeCapabilitySignals['navigator']): boolean {
  const canShare = nav?.canShare
  if (typeof canShare !== 'function') return false

  try {
    return canShare({ files: [] })
  } catch {
    return false
  }
}

export function detectNativeCapabilities(
  signals: NativeCapabilitySignals = {}
): NativeCapabilities {
  const nav = signals.navigator
  const win = signals.window
  const serviceWorkerRegistration = signals.serviceWorkerRegistration

  if (!nav && !win && !serviceWorkerRegistration && !signals.notification) {
    return defaultNativeCapabilities
  }

  const clipboard = nav?.clipboard

  return {
    canShare: hasFunction(nav?.share),
    canShareFiles: canShareFiles(nav),
    canClipboardRead: hasFunction(clipboard?.readText) || hasFunction(clipboard?.read),
    canClipboardWrite:
      hasFunction(clipboard?.writeText) || hasFunction(clipboard?.write),
    canPush:
      Boolean(signals.notification) &&
      Boolean(signals.pushManager) &&
      hasObject(serviceWorkerRegistration?.pushManager),
    canBadge:
      hasFunction(serviceWorkerRegistration?.setAppBadge) &&
      hasFunction(serviceWorkerRegistration?.clearAppBadge),
    canInstallPrompt: Boolean(win?.BeforeInstallPromptEvent),
    canUseFileSystemAccess: Boolean(win?.FileSystemFileHandle),
    canUseFilePicker: hasFunction(win?.showOpenFilePicker),
    canUseWebAuthn: Boolean(win?.PublicKeyCredential),
    canUseWakeLock: hasObject(nav?.wakeLock),
    canUseWindowControlsOverlay: hasObject(nav?.windowControlsOverlay),
    canUseVirtualKeyboard: hasObject(nav?.virtualKeyboard),
    canUseHaptics: hasFunction(nav?.vibrate)
  }
}

export function detectCurrentNativeCapabilities(): NativeCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return defaultNativeCapabilities
  }

  return detectNativeCapabilities({
    navigator,
    notification: typeof Notification === 'undefined' ? undefined : Notification,
    pushManager: typeof PushManager === 'undefined' ? undefined : PushManager,
    serviceWorkerRegistration:
      typeof ServiceWorkerRegistration === 'undefined'
        ? undefined
        : ServiceWorkerRegistration.prototype,
    window
  })
}
