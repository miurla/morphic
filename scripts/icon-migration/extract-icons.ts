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

const iconSet = new Set<string>()

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  const match = content.match(
    /import\s+{([^}]+)}\s+from\s+['"]@tabler\/icons-react['"]/m
  )
  if (match) {
    const imports = match[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    for (const imp of imports) {
      const [name] = imp.split(' as ')
      iconSet.add(name.trim())
    }
  }
}

console.log(Array.from(iconSet).sort().join('\n'))
