'use client'

import Link from 'next/link'

import {
  IconLink as Link2,
  IconLogin as LogIn,
  IconPalette as Palette,
  IconSettings as Settings2
} from '@tabler/icons-react'
import { IconLanguage } from '@tabler/icons-react'

import { normalizePreference } from '@/lib/i18n/config'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from './ui/dropdown-menu'
import { ExternalLinkItems } from './external-link-items'
import { useI18n } from './language-provider'
import { ThemeMenuItems } from './theme-menu-items'

export default function GuestMenu() {
  const { t, preference, setPreference } = useI18n()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6">
          <Settings2 className="size-4" />
          <span className="sr-only">{t('Open menu')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuItem asChild>
          <Link href="/auth/login">
            <LogIn className="size-4" />
            <span>{t('Sign In')}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="size-4" />
            <span>{t('Theme')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ThemeMenuItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconLanguage className="size-4" />
            <span>{t('Language')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={preference}
              onValueChange={value => setPreference(normalizePreference(value))}
            >
              <DropdownMenuRadioItem value="auto">
                {t('Follow browser')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="zh-CN">
                简体中文
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Link2 className="size-4" />
            <span>{t('Links')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ExternalLinkItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
