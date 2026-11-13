import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as dbActions from '@/lib/db/actions'
import type { Space } from '@/lib/db/schema'

import { resolveChatSpace } from '../resolve-chat-space'

vi.mock('@/lib/db/actions')

function makeSpace(color: Space['color'], id = `${color}-id`): Space {
  return {
    id,
    userId: 'user-1',
    color,
    name: '',
    about: `${color} about`,
    style: '',
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

describe('resolveChatSpace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dbActions.getSpacesByColors).mockResolvedValue([])
    vi.mocked(dbActions.getSpaceById).mockResolvedValue(null)
  })

  it('assigns an owned space to a new chat', async () => {
    const green = makeSpace('green')
    vi.mocked(dbActions.getSpacesByColors).mockResolvedValue([
      makeSpace('black'),
      green
    ])

    const result = await resolveChatSpace({
      userId: 'user-1',
      isNewChat: true,
      requestedColor: 'green'
    })

    expect(result).toEqual({ spaceId: 'green-id', space: green })
    expect(dbActions.getSpacesByColors).toHaveBeenCalledWith('user-1', [
      'green',
      'black'
    ])
  })

  it('falls back to the default space when the user has no such space', async () => {
    const black = makeSpace('black')
    vi.mocked(dbActions.getSpacesByColors).mockResolvedValue([black])

    const result = await resolveChatSpace({
      userId: 'user-1',
      isNewChat: true,
      requestedColor: 'green'
    })

    expect(result).toEqual({ spaceId: null, space: black })
  })

  it('never stores the default space on a chat', async () => {
    const black = makeSpace('black')
    vi.mocked(dbActions.getSpacesByColors).mockResolvedValue([black])

    const result = await resolveChatSpace({
      userId: 'user-1',
      isNewChat: true,
      requestedColor: 'black'
    })

    expect(result).toEqual({ spaceId: null, space: black })
    expect(dbActions.getSpacesByColors).toHaveBeenCalledWith('user-1', [
      'black'
    ])
  })

  it.each([undefined, 'teal', 42])(
    'ignores an invalid color %s',
    async requestedColor => {
      const result = await resolveChatSpace({
        userId: 'user-1',
        isNewChat: true,
        requestedColor
      })

      expect(result).toEqual({ spaceId: null, space: null })
      expect(dbActions.getSpacesByColors).toHaveBeenCalledWith('user-1', [
        'black'
      ])
    }
  )

  it('keeps the stored space of an existing chat', async () => {
    const green = makeSpace('green', 'space-1')
    vi.mocked(dbActions.getSpaceById).mockResolvedValue(green)

    const result = await resolveChatSpace({
      userId: 'user-1',
      isNewChat: false,
      requestedColor: 'red',
      chatSpaceId: 'space-1'
    })

    expect(result).toEqual({ spaceId: 'space-1', space: green })
    expect(dbActions.getSpaceById).toHaveBeenCalledWith('user-1', 'space-1')
    expect(dbActions.getSpacesByColors).not.toHaveBeenCalled()
  })

  it('reads the default space for an existing chat without one', async () => {
    const black = makeSpace('black')
    vi.mocked(dbActions.getSpacesByColors).mockResolvedValue([black])

    const result = await resolveChatSpace({
      userId: 'user-1',
      isNewChat: false,
      requestedColor: 'green',
      chatSpaceId: null
    })

    expect(result).toEqual({ spaceId: null, space: black })
    expect(dbActions.getSpaceById).not.toHaveBeenCalled()
  })
})
