'use client'

import Link from 'next/link'

import {
  IconBrandDiscord as SiDiscord,
  IconBrandGithub as SiGithub,
  IconBrandX as SiX
} from '@tabler/icons-react'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

const externalLinks = [
  {
    name: 'Coming Soon',
    href: 'https://ai-morphic.vercel.app',
    icon: <SiX className="size-4" />
  },
  {
    name: 'Coming Soon',
    href: 'https://ai-morphic.vercel.app',
    icon: <SiDiscord className="size-4" />
  },
  {
    name: 'GitHub',
    href: 'https://github.com/Siddhant-33',
    icon: <SiGithub className="size-4" />
  }
]

export function ExternalLinkItems() {
  return (
    <>
      {externalLinks.map(link => (
        <DropdownMenuItem key={link.name} asChild>
          <Link href={link.href} target="_blank" rel="noopener noreferrer">
            {link.icon}
            <span>{link.name}</span>
          </Link>
        </DropdownMenuItem>
      ))}
    </>
  )
}
