'use client'

import type { ToolInvocation } from 'ai'
import { createContext, ReactNode, useContext, useReducer } from 'react'

interface ArtifactState {
  artifact: ToolInvocation | null
  isOpen: boolean
}

type ArtifactAction =
  | { type: 'OPEN'; payload: ToolInvocation }
  | { type: 'CLOSE' }

const initialState: ArtifactState = {
  artifact: null,
  isOpen: false
}

function artifactReducer(
  state: ArtifactState,
  action: ArtifactAction
): ArtifactState {
  switch (action.type) {
    case 'OPEN':
      return { artifact: action.payload, isOpen: true }
    case 'CLOSE':
      return { ...state, isOpen: false }
    default:
      return state
  }
}

interface ArtifactContextValue {
  state: ArtifactState
  open: (artifact: ToolInvocation) => void
  close: () => void
}

const ArtifactContext = createContext<ArtifactContextValue | undefined>(
  undefined
)

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(artifactReducer, initialState)

  const open = (artifact: ToolInvocation) => {
    dispatch({ type: 'OPEN', payload: artifact })
  }

  const close = () => {
    dispatch({ type: 'CLOSE' })
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
