'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  defaultNativeCapabilities,
  detectCurrentNativeCapabilities,
  NativeCapabilities
} from '@/lib/native/capabilities'
import {
  buildPlatformInfo,
  getClientPlatformInfo,
  PlatformInfo
} from '@/lib/platform/platform'

export interface NativeEnvironment {
  platform: PlatformInfo
  capabilities: NativeCapabilities
}

const defaultNativeEnvironment: NativeEnvironment = {
  platform: buildPlatformInfo(),
  capabilities: defaultNativeCapabilities
}

const NativeEnvironmentContext = createContext<NativeEnvironment>(
  defaultNativeEnvironment
)

export function NativeEnvironmentProvider({
  children
}: {
  children: React.ReactNode
}) {
  const [environment, setEnvironment] = useState<NativeEnvironment>(
    defaultNativeEnvironment
  )

  useEffect(() => {
    setEnvironment({
      platform: getClientPlatformInfo(),
      capabilities: detectCurrentNativeCapabilities()
    })
  }, [])

  const value = useMemo(() => environment, [environment])

  return (
    <NativeEnvironmentContext.Provider value={value}>
      {children}
    </NativeEnvironmentContext.Provider>
  )
}

export function useNativeEnvironment(): NativeEnvironment {
  return useContext(NativeEnvironmentContext)
}

export function useNativeCapabilities(): NativeCapabilities {
  return useNativeEnvironment().capabilities
}
