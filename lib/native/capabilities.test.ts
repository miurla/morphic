import { describe, expect, it } from 'vitest'

import {
  defaultNativeCapabilities,
  detectNativeCapabilities
} from './capabilities'

describe('detectNativeCapabilities', () => {
  it('returns deny-by-default capabilities without browser signals', () => {
    expect(detectNativeCapabilities()).toEqual(defaultNativeCapabilities)
  })

  it('detects share and clipboard support', () => {
    const capabilities = detectNativeCapabilities({
      navigator: {
        share: () => Promise.resolve(),
        canShare: data => Boolean(data?.files),
        clipboard: {
          writeText: () => Promise.resolve()
        }
      }
    })

    expect(capabilities.canShare).toBe(true)
    expect(capabilities.canShareFiles).toBe(true)
    expect(capabilities.canClipboardRead).toBe(false)
    expect(capabilities.canClipboardWrite).toBe(true)
  })

  it('treats throwing file-share probes as unsupported', () => {
    const capabilities = detectNativeCapabilities({
      navigator: {
        canShare: () => {
          throw new Error('unsupported share payload')
        }
      }
    })

    expect(capabilities.canShareFiles).toBe(false)
  })

  it('detects native browser feature surfaces from mocked objects', () => {
    const capabilities = detectNativeCapabilities({
      navigator: {
        vibrate: () => true,
        virtualKeyboard: {},
        wakeLock: {},
        windowControlsOverlay: {}
      },
      window: {
        BeforeInstallPromptEvent: {},
        FileSystemFileHandle: {},
        PublicKeyCredential: {},
        showOpenFilePicker: () => Promise.resolve([])
      }
    })

    expect(capabilities.canInstallPrompt).toBe(true)
    expect(capabilities.canUseFileSystemAccess).toBe(true)
    expect(capabilities.canUseFilePicker).toBe(true)
    expect(capabilities.canUseWebAuthn).toBe(true)
    expect(capabilities.canUseWakeLock).toBe(true)
    expect(capabilities.canUseWindowControlsOverlay).toBe(true)
    expect(capabilities.canUseVirtualKeyboard).toBe(true)
    expect(capabilities.canUseHaptics).toBe(true)
  })

  it('requires a service worker push manager for push support', () => {
    const capabilities = detectNativeCapabilities({
      notification: {} as typeof Notification,
      pushManager: {} as typeof PushManager,
      serviceWorkerRegistration: {
        pushManager: {}
      }
    })

    expect(capabilities.canPush).toBe(true)
  })
})
