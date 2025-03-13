// Referenced from Vercel's AI Chatbot and modified to fit the needs of this project
// https://github.com/vercel/ai-chatbot/blob/c2757f87f986b7f15fdf75c4c89cb2219745c53f/components/ui/codeblock.tsx

'use client'

import { FC, memo } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard'
import { generateId } from 'ai'
import { Check, Copy, Download } from 'lucide-react'

interface Props {
  language: string
  value: string
}

interface languageMap {
  [key: string]: string | undefined
}

export const programmingLanguages: languageMap = {
  javascript: '.js',
  python: '.py',
  java: '.java',
  c: '.c',
  cpp: '.cpp',
  'c++': '.cpp',
  'c#': '.cs',
  ruby: '.rb',
  php: '.php',
  swift: '.swift',
  'objective-c': '.m',
  kotlin: '.kt',
  typescript: '.ts',
  go: '.go',
  perl: '.pl',
  rust: '.rs',
  scala: '.scala',
  haskell: '.hs',
  lua: '.lua',
  shell: '.sh',
  sql: '.sql',
  html: '.html',
  css: '.css'
  // add more file extensions here, make sure the key is same as language prop in CodeBlock.tsx component
}

const CodeBlock: FC<Props> = memo(({ language, value }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 })

  const downloadAsFile = () => {
    if (typeof window === 'undefined') {
      return
    }
    const fileExtension = programmingLanguages[language] || '.file'
    const suggestedFileName = `file-${generateId()}${fileExtension}`
    const fileName = window.prompt('Enter file name', suggestedFileName)

    if (!fileName) {
      // User pressed cancel on prompt.
      return
    }

    const blob = new Blob([value], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = fileName
    link.href = url
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const onCopy = () => {
    if (isCopied) return
    copyToClipboard(value)
  }

  return (
    <div className="relative w-full font-sans codeblock rounded-lg overflow-hidden border border-neutral-700/50">
      <div className="flex items-center justify-between w-full px-6 py-2 bg-neutral-800/50 text-zinc-100 border-b border-neutral-700/50">
        <span className="text-xs lowercase opacity-75">{language}</span>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            className="focus-visible:ring-1 hover:bg-neutral-700/50 transition-colors"
            onClick={downloadAsFile}
            size="icon"
          >
            <Download className="w-4 h-4" />
            <span className="sr-only">Download</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-xs focus-visible:ring-1 focus-visible:ring-offset-0 hover:bg-neutral-700/50 transition-colors"
            onClick={onCopy}
          >
            {isCopied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span className="sr-only">Copy code</span>
          </Button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language}
        style={coldarkDark}
        PreTag="div"
        showLineNumbers
        customStyle={{
          margin: 0,
          width: '100%',
          background: 'transparent',
          padding: '1.5rem 1rem',
          fontSize: '0.9rem'
        }}
        lineNumberStyle={{
          userSelect: 'none',
          opacity: 0.5,
          paddingRight: '1rem',
          borderRight: '1px solid rgba(115, 115, 115, 0.2)'
        }}
        codeTagProps={{
          style: {
            fontSize: '0.9rem',
            fontFamily: 'var(--font-mono)',
            lineHeight: '1.7'
          }
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
})
CodeBlock.displayName = 'CodeBlock'

export { CodeBlock }
