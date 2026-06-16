import fs from 'fs'
import path from 'path'

const iconMap: Record<string, string> = {
  IconAdjustments: 'Settings',
  IconAlertCircle: 'WarningCircle',
  IconArrowLeft: 'ArrowLeft',
  IconArrowRight: 'ArrowRight',
  IconArrowUp: 'ArrowUp',
  IconBan: 'Cancel',
  IconBook: 'Book',
  IconBookmark: 'BookmarkEmpty',
  IconBrandDiscord: 'Discord',
  IconBrandGithub: 'Github',
  IconBrandX: 'X',
  IconBulb: 'Lightbulb',
  IconCheck: 'Check',
  IconChecklist: 'List',
  IconChevronDown: 'NavArrowDown',
  IconChevronLeft: 'NavArrowLeft',
  IconChevronRight: 'NavArrowRight',
  IconChevronUp: 'NavArrowUp',
  IconCircle: 'Circle',
  IconCircleCheck: 'CheckCircle',
  IconCirclePlus: 'PlusCircle',
  IconClock: 'Clock',
  IconCloudUpload: 'CloudUpload',
  IconCompass: 'Compass',
  IconCopy: 'Copy',
  IconDeviceLaptop: 'Laptop',
  IconDots: 'MoreHoriz',
  IconExternalLink: 'OpenNewWindow',
  IconEye: 'EyeSolid',
  IconEyeOff: 'EyeClosed',
  IconFile: 'Page',
  IconFileText: 'PageEdit',
  IconFilter: 'Filter',
  IconHeadphones: 'Headset',
  IconHelpCircle: 'QuestionMark',
  IconKey: 'Key',
  IconLanguage: 'Language',
  IconLayoutSidebar: 'SidebarCollapse',
  IconLayoutSidebarFilled: 'SidebarExpand',
  IconLink: 'Link',
  IconListCheck: 'List',
  IconLoader2: 'Refresh',
  IconLogin: 'LogIn',
  IconLogout: 'LogOut',
  IconMapPin: 'MapPin',
  IconMessage: 'MessageText',
  IconMessageCircle: 'ChatBubble',
  IconMessageCirclePlus: 'ChatBubbleEmpty',
  IconMoodNeutral: 'EmojiTalking',
  IconMoodSad: 'EmojiSad',
  IconMoodSmile: 'Emoji',
  IconMoon: 'HalfMoon',
  IconMovie: 'Movie',
  IconNews: 'News',
  IconPalette: 'Palette',
  IconPaperclip: 'Attachment',
  IconPencil: 'EditPencil',
  IconPhoto: 'MediaImage',
  IconPlayerTrackNext: 'FastArrowRight',
  IconPlus: 'Plus',
  IconRefresh: 'Refresh',
  IconRepeat: 'Repeat',
  IconRoute: 'MapsGoStraight',
  IconRss: 'RssFeed',
  IconScale: 'Scale',
  IconSearch: 'Search',
  IconSettings: 'Settings',
  IconShare: 'ShareIos',
  IconShieldCheck: 'ShieldCheck',
  IconSpeakerphone: 'Megaphone',
  IconSquare: 'Square',
  IconSun: 'SunLight',
  IconThumbDown: 'ThumbsDown',
  IconThumbUp: 'ThumbsUp',
  IconTrash: 'Trash',
  IconUser: 'User',
  IconUserCircle: 'ProfileCircle',
  IconVolume: 'VolumeHigh',
  IconVolumeOff: 'VolumeMute',
  IconWorld: 'Globe',
  IconX: 'Cancel'
}

function walk(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const filePath = path.join(dir, file)
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, fileList)
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      fileList.push(filePath)
    }
  }
  return fileList
}

const files = [...walk('components'), ...walk('app'), ...walk('lib')]

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')

  // Replace the import statement completely
  // We need to parse the import to get the aliases
  const importRegex =
    /import\s+{([^}]+)}\s+from\s+['"]@tabler\/icons-react['"]/m
  const match = content.match(importRegex)

  if (match) {
    const imports = match[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const newImports = []

    for (const imp of imports) {
      if (imp === 'type TablerIcon') continue // we don't need this anymore
      const parts = imp.split(' as ')
      const tablerName = parts[0].trim()
      const alias = parts.length > 1 ? parts[1].trim() : tablerName

      const iconoirName = iconMap[tablerName] || tablerName

      if (iconoirName === alias) {
        newImports.push(iconoirName)
      } else {
        newImports.push(`${iconoirName} as ${alias}`)
      }
    }

    if (newImports.length > 0) {
      const newImportString = `import { ${newImports.join(', ')} } from 'iconoir-react'`
      content = content.replace(importRegex, newImportString)
    } else {
      content = content.replace(importRegex, '') // Removed completely if only `type TablerIcon`
    }

    // Replace `type TablerIcon` usages if any with `React.ComponentType<any>` or `any`
    content = content.replace(/TablerIcon/g, 'React.ComponentType<any>')

    // One specific case for `status-indicator.tsx` which uses `type TablerIcon`
    if (
      content.includes("import { type TablerIcon } from '@tabler/icons-react'")
    ) {
      content = content.replace(
        "import { type TablerIcon } from '@tabler/icons-react'",
        ''
      )
    }

    fs.writeFileSync(file, content)
    console.log(`Updated ${file}`)
  }
}
