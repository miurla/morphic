import fs from 'fs'
import path from 'path'

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

const files = [
  ...walk('components'),
  ...walk('app'),
  ...walk('lib')
]

const renames: Record<string, string> = {
  'Cancel': 'Xmark',
  'VolumeHigh': 'SoundHigh',
  'VolumeMute': 'SoundOff',
  'BookmarkEmpty': 'Bookmark',
  'EmojiTalking': 'EmojiTalkingHappy',
  'News': 'JournalPage'
}

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')
  let changed = false
  
  // 1. Rename bad icon imports from iconoir-react
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"]iconoir-react['"]/m
  const match = content.match(importRegex)
  if (match) {
    const imports = match[1].split(',').map(s => s.trim()).filter(Boolean)
    const newImports = []
    
    for (const imp of imports) {
      const parts = imp.split(' as ')
      const originalName = parts[0].trim()
      const alias = parts.length > 1 ? parts[1].trim() : originalName
      
      const newName = renames[originalName] || originalName
      
      if (newName === alias) {
        newImports.push(newName)
      } else {
        newImports.push(`${newName} as ${alias}`)
      }
    }
    
    const newImportString = `import { ${newImports.join(', ')} } from 'iconoir-react'`
    if (match[0] !== newImportString) {
      content = content.replace(importRegex, newImportString)
      changed = true
    }
  }

  // 2. Fix size={...} props for JSX Elements whose names match our imported Iconoir icons.
  // Actually, to be safe, any size={...} or size="..." inside a JSX tag that looks like an icon can be replaced.
  // We'll just replace size={expr} -> width={expr} height={expr} globally for anything that looks like an icon component.
  // A simpler global regex since `size` is generally used for icons in this codebase.
  if (content.match(/<[A-Z][a-zA-Z0-9]*[^>]*\bsize={([^}]+)}/g)) {
    content = content.replace(/(<[A-Z][a-zA-Z0-9]*[^>]*?)\bsize={([^}]+)}/g, '$1width={$2} height={$2}')
    changed = true
  }
  if (content.match(/<[A-Z][a-zA-Z0-9]*[^>]*\bsize="([^"]+)"/g)) {
    content = content.replace(/(<[A-Z][a-zA-Z0-9]*[^>]*?)\bsize="([^"]+)"/g, '$1width="$2" height="$2"')
    changed = true
  }

  if (changed) {
    fs.writeFileSync(file, content)
    console.log(`Fixed ${file}`)
  }
}
