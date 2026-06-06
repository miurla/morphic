'use client'

import Link from 'next/link'

import { OpenNewWindow } from 'iconoir-react'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

const externalLinks = [
  {
    name: 'X',
    href: 'https://x.com/morphic_ai'
  },
  {
    name: 'Discord',
    href: 'https://discord.gg/zRxaseCuGq'
  },
  {
    name: 'GitHub',
    href: 'https://git.new/morphic'
  }
]

export function ExternalLinkItems() {
  return (
    <>
      {externalLinks.map(link => (
        <DropdownMenuItem key={link.name} asChild>
          <Link href={link.href} target="_blank" rel="noopener noreferrer">
            <OpenNewWindow className="size-4" />
            <span>{link.name}</span>
          </Link>
        </DropdownMenuItem>
      ))}
    </>
  )
}
