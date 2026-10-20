import { describe, expect, test } from 'vitest'

import { parseAdminEmails } from '../admins'

describe('parseAdminEmails', () => {
  test.each([
    { name: 'unset yields an empty allowlist', env: {}, expected: [] },
    {
      name: 'empty string yields an empty allowlist',
      env: { MORPHIC_ADMIN_EMAILS: '' },
      expected: []
    },
    {
      name: 'single email',
      env: { MORPHIC_ADMIN_EMAILS: 'ops@example.com' },
      expected: ['ops@example.com']
    },
    {
      name: 'entries are trimmed and lowercased',
      env: { MORPHIC_ADMIN_EMAILS: ' Ops@Example.COM ' },
      expected: ['ops@example.com']
    },
    {
      name: 'multiple emails with empty segments ignored',
      env: { MORPHIC_ADMIN_EMAILS: 'a@example.com,, b@example.com ,' },
      expected: ['a@example.com', 'b@example.com']
    },
    {
      name: 'duplicates collapse',
      env: { MORPHIC_ADMIN_EMAILS: 'a@example.com,A@Example.com' },
      expected: ['a@example.com']
    }
  ])('$name', ({ env, expected }) => {
    expect([...parseAdminEmails(env)]).toEqual(expected)
  })
})
