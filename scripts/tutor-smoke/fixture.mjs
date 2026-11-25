/** A real selectable-text PDF with explicit xref offsets, no external assets. */
export function createFixturePdf() {
  const lines = [
    'DATABASE TRANSACTIONS - LOCAL TEST MATERIAL',
    'Atomicity means that a transaction is treated as one indivisible unit.',
    'All changes succeed together, or all changes are rolled back.',
    'A transaction begins before the first related database modification.',
    'Commit makes every successful change in the transaction permanent.',
    'Rollback undoes the changes when a step fails before commit.',
    'For a transfer, debit account A and credit account B in one transaction.',
    'If the credit fails after the debit, roll back the entire transaction.',
    'Both balances must remain as they were before the failed transfer.',
    'Only commit after the debit and the credit have both succeeded.',
    'This PDF is a synthetic fixture for testing software integration.',
    'It is not a benchmark for retrieval relevance or teaching quality.'
  ]
  const escape = text => text.replace(/([\\()])/g, '\\$1')
  const stream = `BT /F1 11 Tf 40 748 Td ${lines.map((line, index) => `${index ? '0 -24 Td ' : ''}(${escape(line)}) Tj`).join('\n')} ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ]
  let file = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(file))
    file += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(file)
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  file += offsets
    .slice(1)
    .map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(file)
}
