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

const files = [...walk('components'), ...walk('app'), ...walk('lib')]

// List of standard UI components that had `size` props
const standardComponents = [
  'Button',
  'Skeleton',
  'Avatar',
  'Sheet',
  'Input',
  'Textarea',
  'PasswordInput',
  'Select',
  'DropdownMenu',
  'Section',
  'SearchModeSelector',
  'ChatMenuItem',
  'Carousel',
  'CarouselPrevious',
  'CarouselNext',
  'CarouselContent',
  'CarouselItem'
]

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')
  let changed = false

  for (const comp of standardComponents) {
    const regex1 = new RegExp(
      `(<${comp}[^>]*?)\\bwidth={([^}]+)}\\s*height={\\2}`,
      'g'
    )
    const regex2 = new RegExp(
      `(<${comp}[^>]*?)\\bwidth="([^"]+)"\\s*height="\\2"`,
      'g'
    )

    if (content.match(regex1)) {
      content = content.replace(regex1, '$1size={$2}')
      changed = true
    }
    if (content.match(regex2)) {
      content = content.replace(regex2, '$1size="$2"')
      changed = true
    }
  }

  // Also some icons that I didn't rename properly or that need manual sizing:
  // We need to fix the TS error where `size` does not exist on Iconoir components.
  // Wait, the TS error earlier was: `Property 'size' does not exist on type 'IntrinsicAttributes...`
  // This means my fix-icons script didn't catch ALL sizes on icons.
  // We'll replace size={...} with width={...} height={...} ONLY on lines containing `import { ... } from 'iconoir-react'` components? No, regex is hard.
  // A better regex: `<([A-Z][a-zA-Z0-9]*)[^>]*\bsize={([^}]+)}` where the tag name is NOT in standardComponents.

  const iconRegex = /(<[A-Z][a-zA-Z0-9]*[^>]*?)\bsize={([^}]+)}/g
  content = content.replace(iconRegex, (match, prefix, sizeVal) => {
    // extract tag name
    const tagMatch = prefix.match(/<([A-Z][a-zA-Z0-9]*)/)
    if (tagMatch) {
      const tagName = tagMatch[1]
      if (standardComponents.includes(tagName)) {
        return match // don't replace
      }
    }
    changed = true
    return `${prefix}width={${sizeVal}} height={${sizeVal}}`
  })

  if (changed) {
    fs.writeFileSync(file, content)
    console.log(`Reverted/Fixed sizes in ${file}`)
  }
}
