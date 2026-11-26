const fs = require('node:fs')
process.once('message', ({ userId, documentId }) => {
  fs.writeFileSync(userId, String(process.pid))
  if (documentId === 'hang') {
    while (true) {
      /* Deliberately block the child event loop. */
    }
  }
  process.send({
    result: {
      parsed: { pageCount: 1, blocks: [], warnings: [] },
      chunks: [],
      tokenCount: 1,
      chunkCount: 1
    }
  })
})
