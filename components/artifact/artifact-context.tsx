'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer
} from 'react'

import type { Part } from '@/lib/types/ai'

import { useLibrary } from '../library/library-context'
import { useSidebar } from '../ui/sidebar'

// Animation duration should match the inspector panel exit transition.
const ANIMATION_DURATION = 260

interface ArtifactState {
  part: Part | null
  isOpen: boolean
}

type ArtifactAction =
  | { type: 'OPEN'; payload: Part }
  | { type: 'CLOSE' }
  | { type: 'CLEAR_CONTENT' }

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
    case 'CLEAR_CONTENT':
      return { part: null, isOpen: false }
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
  const { isOpen: libraryOpen, closeLibrary } = useLibrary()

  const close = useCallback(() => {
    dispatch({ type: 'CLOSE' })
    // Keep content for animation purposes, clear after transition
    setTimeout(() => {
      dispatch({ type: 'CLEAR_CONTENT' })
    }, ANIMATION_DURATION)
  }, [])

  // Close artifact when sidebar opens
  useEffect(() => {
    if (sidebarOpen && state.isOpen) {
      close()
    }
    if (sidebarOpen && libraryOpen) {
      closeLibrary()
    }
  }, [sidebarOpen, state.isOpen, libraryOpen, close, closeLibrary])

  const open = (part: Part) => {
    closeLibrary()
    dispatch({ type: 'OPEN', payload: part })
    setOpen(false)
  }

  useEffect(() => {
    if (libraryOpen && state.isOpen) {
      close()
    }
  }, [libraryOpen, state.isOpen, close])

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
