import React from 'react'

import { render } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Image } from '../components/image'

vi.mock('@/lib/analytics/posthog-client', () => ({
  captureClient: vi.fn(),
  chatIdFromPath: vi.fn()
}))

const SpecImage = Image as unknown as React.FC<{ props: { src: string } }>

function renderImage(src: string) {
  return render(<SpecImage props={{ src }} />)
}

describe('render Image', () => {
  test('renders a web image', () => {
    const { container } = renderImage('https://example.org/photo.jpg')

    expect(container.querySelector('img')).not.toBeNull()
  })

  test('drops a source that is not a web url', () => {
    const { container } = renderImage('EXAMPLE_IMAGE_1')

    expect(container.querySelector('img')).toBeNull()
  })
})
