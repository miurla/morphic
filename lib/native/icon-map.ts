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
  Link as LinkIcon,
  LogIn,
  LogOut,
  Message,
  NavArrowDown,
  Page,
  Palette,
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
  UserCircle,
  WarningTriangle,
  Xmark,
  XmarkCircle
} from 'iconoir-react'

import { IconLogoOutline } from '@/components/ui/icons'

export type NativeIconComponent = ComponentType<SVGProps<SVGSVGElement>>

export const nativeIconMap = {
  account: UserCircle,
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
  link: LinkIcon,
  login: LogIn,
  logout: LogOut,
  message: Message,
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
  theme: Palette,
  upload: Upload,
  warning: WarningTriangle,
  adaptive: IconLogoOutline
} satisfies Record<string, NativeIconComponent>

export type NativeIconName = keyof typeof nativeIconMap
