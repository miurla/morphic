import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NativeIcon } from './native-icon'

describe('NativeIcon', () => {
  it('renders decorative icons as hidden by default', () => {
    const { container } = render(<NativeIcon name="search" className="size-4" />)
    const svg = container.querySelector('svg')

    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveClass('size-4')
  })

  it('exposes an accessible name when aria-label is provided', () => {
    render(<NativeIcon name="send" aria-label="Send" />)

    expect(screen.getByLabelText('Send')).toBeInTheDocument()
  })
})
