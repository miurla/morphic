import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as dbActions from '@/lib/db/actions'
import type { Space } from '@/lib/db/schema'

import { getChatSpaceForViewer } from '../chat-space'

vi.mock('@/lib/db/actions')

function row(color: Space['color'], fields: Partial<Space> = {}): Space {
  return {
    id: `space-${color}`,
    userId: 'owner',
    color,
    name: '',
    about: '',
    style: '',
    createdAt: new Date('2026-11-13T00:00:00Z'),
    updatedAt: new Date('2026-11-13T00:00:00Z'),
    ...fields
  }
}

const blog = row('green', {
  name: 'Blog',
  about: 'Writing articles',
  style: 'Short paragraphs'
})

describe('getChatSpaceForViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dbActions.getSpaceById).mockResolvedValue(blog)
    vi.mocked(dbActions.getSpacesByColors).mockResolvedValue([])
  })

  it('gives the owner the color and name, without the notice', async () => {
    await expect(
      getChatSpaceForViewer(
        { userId: 'owner', spaceId: 'space-green' },
        'owner'
      )
    ).resolves.toEqual({
      space: { color: 'green', name: 'Blog' },
      ownerInstructions: false
    })
    expect(dbActions.getSpaceById).toHaveBeenCalledWith('owner', 'space-green')
  })

  it('gives other viewers the color and the notice, never the text', async () => {
    for (const viewer of ['viewer', undefined]) {
      const result = await getChatSpaceForViewer(
        { userId: 'owner', spaceId: 'space-green' },
        viewer
      )
      expect(result).toEqual({
        space: { color: 'green' },
        ownerInstructions: true
      })
      const text = JSON.stringify(result)
      expect(text).not.toContain('Writing articles')
      expect(text).not.toContain('Short paragraphs')
      expect(text).not.toContain('Blog')
    }
  })

  it('shows the notice for a default chat when Default has instructions', async () => {
    vi.mocked(dbActions.getSpacesByColors).mockResolvedValue([
      row('black', { style: 'Answer in English' })
    ])
    const result = await getChatSpaceForViewer(
      { userId: 'owner', spaceId: null },
      'viewer'
    )
    expect(result).toEqual({ space: null, ownerInstructions: true })
    expect(JSON.stringify(result)).not.toContain('Answer in English')
    expect(dbActions.getSpacesByColors).toHaveBeenCalledWith('owner', ['black'])
  })

  it('shows no notice when Default has no instructions', async () => {
    vi.mocked(dbActions.getSpacesByColors).mockResolvedValue([row('black')])
    await expect(
      getChatSpaceForViewer({ userId: 'owner', spaceId: null }, 'viewer')
    ).resolves.toEqual({ space: null, ownerInstructions: false })
  })

  it('shows no notice when the owner has no default space row', async () => {
    await expect(
      getChatSpaceForViewer({ userId: 'owner', spaceId: null }, 'viewer')
    ).resolves.toEqual({ space: null, ownerInstructions: false })
  })

  it('shows no notice to the owner of a default chat', async () => {
    vi.mocked(dbActions.getSpacesByColors).mockResolvedValue([
      row('black', { style: 'Answer in English' })
    ])
    await expect(
      getChatSpaceForViewer({ userId: 'owner', spaceId: null }, 'owner')
    ).resolves.toEqual({ space: null, ownerInstructions: false })
  })

  it('shows no notice for a space whose instructions are blank', async () => {
    vi.mocked(dbActions.getSpaceById).mockResolvedValue(
      row('green', { name: 'Blog', about: '  ', style: '' })
    )
    await expect(
      getChatSpaceForViewer(
        { userId: 'owner', spaceId: 'space-green' },
        'viewer'
      )
    ).resolves.toEqual({ space: { color: 'green' }, ownerInstructions: false })
  })

  it('falls back quietly when the lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(dbActions.getSpaceById).mockRejectedValue(new Error('db'))
    await expect(
      getChatSpaceForViewer(
        { userId: 'owner', spaceId: 'space-green' },
        'owner'
      )
    ).resolves.toEqual({ space: null, ownerInstructions: false })
  })
})
