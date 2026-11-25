import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { createTranslator } from '@/lib/i18n/translate'

import { TutorDocumentList } from '../document-list'

vi.mock('@/components/language-provider', () => ({
  useI18n: () => ({ t: createTranslator('zh-CN') })
}))

it('shows sparse-page notices in Chinese without treating covers as a blocking error', () => {
  render(
    <TutorDocumentList
      documents={[
        {
          id: 'doc-1',
          filename: 'lesson.pdf',
          size: 123,
          pageCount: 5,
          status: 'ready',
          error: null,
          warnings: ['Pages with little or no extracted text: 2, 5']
        }
      ]}
    />
  )
  expect(
    screen.getByText('以下页面提取到的文字较少或没有文字：2, 5')
  ).toBeInTheDocument()
  expect(screen.getByText(/这些页面可能是封面/)).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('does not label logical text segments as physical pages', () => {
  render(
    <TutorDocumentList
      documents={[
        {
          id: 'doc-text',
          filename: 'lesson.docx',
          size: 123,
          pageCount: 5,
          status: 'ready',
          error: null
        }
      ]}
    />
  )
  expect(screen.getByText('lesson.docx')).toBeInTheDocument()
  expect(screen.queryByText('5 页')).not.toBeInTheDocument()
})
