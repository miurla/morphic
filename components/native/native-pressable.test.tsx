import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NativePressable } from './native-pressable'

describe('NativePressable', () => {
  it('renders an accessible button', () => {
    render(<NativePressable>Tap me</NativePressable>)

    expect(screen.getByRole('button', { name: 'Tap me' })).toBeInTheDocument()
  })
})
