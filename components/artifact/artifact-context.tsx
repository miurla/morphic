'use client'

import type { ToolInvocation } from 'ai'
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer
} from 'react'
import { useSidebar } from '../ui/sidebar'

// Part types as seen in render-message.tsx
export type TextPart = {
  type: 'text'
  text: string
}

export type ReasoningPart = {
  type: 'reasoning'
  reasoning: string
}

export type ToolInvocationPart = {
  type: 'tool-invocation'
  toolInvocation: ToolInvocation
}

export type Part = TextPart | ReasoningPart | ToolInvocationPart

interface ArtifactState {
  part: Part | null
  isOpen: boolean
}

type ArtifactAction = { type: 'OPEN'; payload: Part } | { type: 'CLOSE' }

const initialState: ArtifactState = {
  part: null,
  isOpen: false
}

function artifactReducer(
  state: ArtifactState,
  action: ArtifactAction
): ArtifactState {
  switch (action.type) {
    case 'OPEN':
      return { part: action.payload, isOpen: true }
    case 'CLOSE':
      return { ...state, isOpen: false }
    default:
      return state
  }
}

interface ArtifactContextValue {
  state: ArtifactState
  open: (part: Part) => void
  close: () => void
}

const ArtifactContext = createContext<ArtifactContextValue | undefined>(
  undefined
)

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(artifactReducer, initialState)
  const { setOpen, open: sidebarOpen } = useSidebar()

  const close = useCallback(() => {
    dispatch({ type: 'CLOSE' })
  }, [])

  // Close artifact when sidebar opens
  useEffect(() => {
    if (sidebarOpen && state.isOpen) {
      close()
    }
  }, [sidebarOpen, state.isOpen, close])

  const open = (part: Part) => {
    dispatch({ type: 'OPEN', payload: part })
    setOpen(false)
  }

  return (
    <ArtifactContext.Provider value={{ state, open, close }}>
      {children}
    </ArtifactContext.Provider>
  )
}

export function useArtifact() {
  const context = useContext(ArtifactContext)
  if (context === undefined) {
    throw new Error('useArtifact must be used within an ArtifactProvider')
  }
  return context
}
