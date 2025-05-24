import React from 'react'
import { AttachmentPreview } from './attachment-preview'

interface UserFileSectionProps {
  file: {
    name: string
    url: string
    contentType: string
  }
}

export const UserFileSection: React.FC<UserFileSectionProps> = ({ file }) => {
  return <AttachmentPreview attachments={[file]} />
}
