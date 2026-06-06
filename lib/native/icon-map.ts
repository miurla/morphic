import type { ComponentType, SVGProps } from 'react'

import {
  Attachment,
  Check,
  Copy,
  EditPencil,
  GitCompare,
  HelpCircle,
  InfoCircle,
  JournalPage,
  NavArrowDown,
  Page,
  Plus,
  Refresh,
  Search,
  Send,
  Settings,
  ShareIos,
  SidebarCollapse,
  SidebarExpand,
  Square,
  Upload,
  WarningTriangle,
  Xmark,
  XmarkCircle
} from 'iconoir-react'

import { IconLogoOutline } from '@/components/ui/icons'

export type NativeIconComponent = ComponentType<SVGProps<SVGSVGElement>>

export const nativeIconMap = {
  attachment: Attachment,
  check: Check,
  chevronDown: NavArrowDown,
  close: Xmark,
  closeCircle: XmarkCircle,
  compare: GitCompare,
  copy: Copy,
  error: XmarkCircle,
  explain: HelpCircle,
  feedback: EditPencil,
  info: InfoCircle,
  latest: JournalPage,
  newChat: Plus,
  refresh: Refresh,
  research: Search,
  scrollDown: NavArrowDown,
  search: Search,
  send: Send,
  settings: Settings,
  share: ShareIos,
  sidebarClosed: SidebarExpand,
  sidebarOpen: SidebarCollapse,
  stop: Square,
  summarize: Page,
  upload: Upload,
  warning: WarningTriangle,
  adaptive: IconLogoOutline
} satisfies Record<string, NativeIconComponent>

export type NativeIconName = keyof typeof nativeIconMap
