import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import { getTutorDocumentFormat } from '../document-formats'
import { decodeDocumentText, parseTutorDocument } from '../documents'

const encode = (text: string) => new TextEncoder().encode(text)
const namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function zip(files: Record<string, string>, claimedSize?: number): Uint8Array {
  const entries: Buffer[] = []
  const directory: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const filename = Buffer.from(name)
    const bytes = Buffer.from(text)
    const compressed = deflateRawSync(bytes)
    let crc = 0xffffffff
    for (const byte of bytes) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    crc = (crc ^ 0xffffffff) >>> 0
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(8, 8)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(compressed.length, 18)
    header.writeUInt32LE(claimedSize ?? bytes.length, 22)
    header.writeUInt16LE(filename.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(claimedSize ?? bytes.length, 24)
    central.writeUInt16LE(filename.length, 28)
    central.writeUInt32LE(offset, 42)
    entries.push(header, filename, compressed)
    directory.push(central, filename)
    offset += header.length + filename.length + compressed.length
  }
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(Buffer.concat(directory).length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...entries, ...directory, end])
}

function docx(body: string, claimedSize?: number) {
  return zip(
    {
      '[Content_Types].xml':
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      'word/document.xml': `<w:document xmlns:w="${namespace}"><w:body>${body}</w:body></w:document>`
    },
    claimedSize
  )
}

describe('Tutor document extraction', () => {
  it.each([
    ['notes.PDF', 'pdf'],
    ['笔记.TXT', 'txt'],
    ['notes.md', 'md'],
    ['notes.markdown', 'md'],
    ['notes.DOCX', 'docx'],
    ['notes.doc', null],
    ['notes.pdf.exe', null]
  ])('recognizes %s from its final extension', (name, format) => {
    expect(getTutorDocumentFormat(name)).toBe(format)
  })

  it('preserves Chinese text and Markdown headings for retrieval', async () => {
    const result = await parseTutorDocument(
      encode(
        '# 事务\n原子性：全部成功或全部失败。\n\n## 隔离性\n并发事务相互隔离。'
      ),
      '笔记.markdown'
    )
    expect(result.blocks.map(block => block.text)).toEqual([
      '# 事务',
      '原子性：全部成功或全部失败。',
      '## 隔离性',
      '并发事务相互隔离。'
    ])
    expect(result.blocks[0].heading).toBe(true)
    expect(result.blocks[2].heading).toBe(true)
    expect(result.pageCount).toBe(1)
  })

  it('accepts UTF-8 and Windows UTF-16 BOM text, while rejecting renamed binary files', async () => {
    const text = '中文学习材料\r\n第二行'
    const utf16 = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(text, 'utf16le')
    ])
    expect(decodeDocumentText(utf16)).toBe('中文学习材料\n第二行')
    expect(decodeDocumentText(encode('\ufeff中文'))).toBe('中文')
    await expect(
      parseTutorDocument(Uint8Array.from([0xff, 0x12]), 'a.txt')
    ).rejects.toMatchObject({ code: 'INVALID_TEXT' })
    await expect(
      parseTutorDocument(encode('MZ\0binary'), 'a.txt')
    ).rejects.toMatchObject({ code: 'INVALID_TEXT' })
    await expect(
      parseTutorDocument(encode(' \n\t'), 'a.txt')
    ).rejects.toMatchObject({ code: 'NO_TEXT' })
  })

  it('extracts DOCX paragraphs, tables, entities, breaks and heading styles', async () => {
    const bytes = docx(
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>事务 &amp; 数据库</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>原子性</w:t><w:tab/><w:t>全部成功</w:t><w:br/><w:t>或全部失败</w:t></w:r><w:del><w:r><w:delText>删除的文本</w:delText></w:r></w:del></w:p></w:tc></w:tr></w:tbl>'
    )
    const result = await parseTutorDocument(bytes, '学习.docx')
    expect(result.blocks.map(block => block.text)).toEqual([
      '事务 & 数据库',
      '原子性\t全部成功\n或全部失败'
    ])
    expect(result.blocks[0].heading).toBe(true)
  })

  it('rejects arbitrary ZIPs, corrupt XML, entity declarations and oversized decompression', async () => {
    for (const bytes of [
      encode('not a zip'),
      zip({ 'word/document.xml': '<document/>' }),
      docx('<w:p>'),
      docx(
        '<!DOCTYPE x [<!ENTITY external SYSTEM "file:///etc/passwd">]><w:p/>'
      ),
      docx('<w:p><w:r><w:t>text</w:t></w:r></w:p>', 100 * 1024 * 1024),
      docx(`<w:p><w:r><w:t>${'a'.repeat(8 * 1024 * 1024)}</w:t></w:r></w:p>`)
    ]) {
      await expect(parseTutorDocument(bytes, 'bad.docx')).rejects.toMatchObject(
        { code: 'INVALID_DOCX' }
      )
    }
  })

  it('extracts nested text-box paragraphs only once', async () => {
    const result = await parseTutorDocument(
      docx(
        '<w:p><w:r><w:t>正文</w:t></w:r><w:r><w:txbxContent><w:p><w:r><w:t>文本框</w:t></w:r></w:p></w:txbxContent></w:r></w:p>'
      ),
      'notes.docx'
    )
    expect(result.blocks.map(block => block.text)).toEqual(['正文', '文本框'])
  })

  it('bounds text size and splits large text into logical segments without losing content', async () => {
    const text = '学习事务。'.repeat(3000)
    const result = await parseTutorDocument(encode(text), 'notes.txt')
    expect(result.pageCount).toBe(2)
    expect(result.blocks.map(block => block.text).join('')).toBe(text)
    await expect(
      parseTutorDocument(encode('a'.repeat(2_000_001)), 'notes.txt')
    ).rejects.toMatchObject({ code: 'DOCUMENT_TEXT_LIMIT' })
  })
})
