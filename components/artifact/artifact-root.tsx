'use client'

import { ReactNode } from 'react'
import { ArtifactProvider } from './artifact-context'
import { ChatArtifactContainer } from './chat-artifact-container'

export default function ArtifactRoot({ children }: { children: ReactNode }) {
  return (
    <ArtifactProvider>
      <ChatArtifactContainer>{children}</ChatArtifactContainer>
    </ArtifactProvider>
  )
}
