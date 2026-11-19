import { useEffect } from 'react'

import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteSpace, listSpaces, saveSpace } from '@/lib/actions/spaces'
import { captureClient } from '@/lib/analytics/posthog-client'
import type { Space } from '@/lib/db/schema'

import { SpacesProvider, useSpaces } from '../spaces-provider'

vi.mock('@/lib/actions/spaces', () => ({
  listSpaces: vi.fn(),
  saveSpace: vi.fn(),
  deleteSpace: vi.fn()
}))
vi.mock('@/lib/analytics/posthog-client', () => ({ captureClient: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

function row(color: Space['color'], fields: Partial<Space> = {}): Space {
  return {
    id: `space-${color}`,
    userId: 'user-1',
    color,
    name: '',
    about: '',
    style: '',
    createdAt: new Date('2026-11-13T00:00:00Z'),
    updatedAt: new Date('2026-11-13T00:00:00Z'),
    ...fields
  }
}

const handle: { current: ReturnType<typeof useSpaces> | null } = {
  current: null
}
function api() {
  return handle.current!
}
function Probe() {
  const spaces = useSpaces()
  useEffect(() => {
    handle.current = spaces
  })
  return (
    <div data-testid="state">
      {JSON.stringify({
        loaded: spaces.loaded,
        active: spaces.active,
        editing: spaces.editor?.color ?? null,
        existing: spaces.existing
      })}
    </div>
  )
}

function state() {
  return JSON.parse(screen.getByTestId('state').textContent ?? '{}')
}

function renderProvider(initialColor?: string) {
  return render(
    <SpacesProvider enabled initialColor={initialColor}>
      <Probe />
    </SpacesProvider>
  )
}

describe('SpacesProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', '/')
    document.cookie = 'spaceColor=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
    vi.mocked(listSpaces).mockResolvedValue({ success: true, spaces: [] })
    vi.mocked(saveSpace).mockImplementation(async input => ({
      success: true,
      space: row(input.color as Space['color'], {
        name: input.name,
        about: input.about,
        style: input.style
      })
    }))
    vi.mocked(deleteSpace).mockResolvedValue({ success: true })
  })

  it('creates a space only once something is written in it', async () => {
    renderProvider()
    await waitFor(() => expect(state().loaded).toBe(true))

    act(() => api().openEditor('green'))
    expect(state().editing).toBe('green')
    expect(window.location.search).toBe('?space=edit')
    expect(saveSpace).not.toHaveBeenCalled()

    act(() => api().updateField('name', 'Blog'))
    await waitFor(() =>
      expect(saveSpace).toHaveBeenCalledWith({
        color: 'green',
        name: 'Blog',
        about: '',
        style: ''
      })
    )
    expect(captureClient).toHaveBeenCalledWith('space_created', {
      color: 'green'
    })
    expect(captureClient).toHaveBeenCalledWith(
      'space_instructions_saved',
      expect.objectContaining({ color: 'green', isDefault: false })
    )
    expect(api().colorForNewChat()).toBe('green')
  })

  it('leaves nothing behind when a draft is closed untouched', async () => {
    renderProvider()
    await waitFor(() => expect(state().loaded).toBe(true))

    act(() => api().openEditor('green'))
    act(() => api().closeEditor())
    await waitFor(() => expect(state().editing).toBeNull())

    expect(saveSpace).not.toHaveBeenCalled()
    expect(deleteSpace).not.toHaveBeenCalled()
    expect(state().active).toBe('black')
    expect(state().existing).toEqual(['black'])
  })

  it('deletes a space that was emptied before closing', async () => {
    vi.mocked(listSpaces).mockResolvedValue({
      success: true,
      spaces: [row('green', { name: 'Blog' })]
    })
    renderProvider('green')
    await waitFor(() => expect(state().loaded).toBe(true))

    act(() => api().openEditor())
    act(() => api().updateField('name', ''))
    act(() => api().closeEditor())

    await waitFor(() => expect(deleteSpace).toHaveBeenCalledWith('green'))
    await waitFor(() => expect(state().active).toBe('black'))
    expect(state().existing).toEqual(['black'])
  })

  it('falls back to the default space when the saved color is gone', async () => {
    renderProvider('blue')
    await waitFor(() => expect(state().loaded).toBe(true))
    expect(state().active).toBe('black')
    expect(api().colorForNewChat()).toBe('black')
  })

  it('records a switch from the home', async () => {
    vi.mocked(listSpaces).mockResolvedValue({
      success: true,
      spaces: [row('green')]
    })
    renderProvider()
    await waitFor(() => expect(state().loaded).toBe(true))

    act(() => api().switchTo('green'))
    await waitFor(() => expect(state().active).toBe('green'))
    expect(captureClient).toHaveBeenCalledWith('space_switched', {
      from: 'black',
      to: 'green',
      source: 'home'
    })
    expect(document.cookie).toContain('spaceColor=green')
  })

  it('keeps the editor closed until saved spaces load', async () => {
    let resolve: (value: Awaited<ReturnType<typeof listSpaces>>) => void
    vi.mocked(listSpaces).mockReturnValue(
      new Promise(done => {
        resolve = done
      })
    )
    renderProvider('green')

    act(() => api().openEditor())
    expect(state().editing).toBeNull()
    // A query sent on mount keeps the selected space; the server checks it.
    expect(api().colorForNewChat()).toBe('green')

    await act(async () => {
      resolve({
        success: true,
        spaces: [row('green', { style: 'Short paragraphs' })]
      })
    })
    act(() => api().openEditor())
    expect(state().editing).toBe('green')
    expect(api().fieldsOf('green').style).toBe('Short paragraphs')
  })
})
