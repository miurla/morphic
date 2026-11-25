/** LOCAL TEST DOUBLE ONLY. Deterministic plumbing checks, not an AI quality evaluation. */
import { createHash, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

function embedding(text) {
  const vector = Array(1536).fill(0)
  for (const token of String(text)
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? ['empty']) {
    const hash = createHash('sha256').update(token).digest()
    vector[hash.readUInt16BE(0) % vector.length] += 1
  }
  const norm = Math.sqrt(vector.reduce((sum, n) => sum + n * n, 0)) || 1
  return vector.map(n => n / norm)
}

function generate(body) {
  const content = message =>
    typeof message.content === 'string'
      ? message.content
      : message.content?.map(part => part.text ?? '').join('')
  const messages = body.messages ?? []
  const chinese = messages.some(message =>
    /Language: Simplified Chinese/.test(content(message))
  )
  const data = JSON.parse(
    content(messages.findLast(message => message.role === 'user'))
  )
  const t = (en, zh) => (chinese ? zh : en)
  if (data.units)
    return {
      topics: data.units.slice(0, 16).map((unit, index, units) => ({
        title: t('Atomic transactions', '事务的原子性'),
        summary: t(
          'Commit all changes together or roll back the entire transaction.',
          '事务中的修改全部提交，或在失败时全部回滚。'
        ),
        unitIds:
          index === units.length - 1
            ? data.units.slice(index).map(item => item.id)
            : [unit.id]
      }))
    }
  if (data.topics)
    return {
      title: t(
        'Database transactions · local test fixture',
        '数据库事务 · 本地测试资料'
      ),
      chapters: [
        {
          title: t('Understanding atomicity', '理解事务原子性'),
          summary: t(
            'Explain transaction boundaries and recover from a failed transfer.',
            '解释事务边界，并处理转账过程中的失败。'
          ),
          objectives: [
            t(
              'Explain why partial updates must be rolled back.',
              '解释为什么必须回滚部分完成的修改。'
            ),
            t('Design an atomic transfer.', '设计具有原子性的转账操作。')
          ],
          knowledgePoints: [
            {
              title: t('Commit and rollback', '提交与回滚'),
              topicIds: data.topics.map(item => item.id)
            }
          ]
        }
      ]
    }
  if (data.knowledgePoints && data.evidence) {
    const result = { concepts: [], examples: [], questions: [] }
    for (const point of data.knowledgePoints) {
      const sourceIds = data.evidence
        .filter(source => point.sourceIds.includes(source.id))
        .map(source => source.id)
        .slice(0, 2)
      if (!sourceIds.length) sourceIds.push(data.evidence[0].id)
      const base = { knowledgePointId: point.id, sourceIds }
      result.concepts.push({
        ...base,
        title: t('Atomicity: all or nothing', '原子性：全部完成或全部回滚'),
        explanation: t(
          'A transaction groups related changes into one unit. Commit makes the entire unit permanent. Rollback undoes the changes when an operation fails. This text is produced by a deterministic local test double.',
          '事务将相关修改组合为一个整体。提交让整组修改生效；发生错误时，回滚会撤销修改。此内容由确定性的本地测试替身生成，用于验证完整业务流程。'
        )
      })
      result.examples.push({
        ...base,
        title: t('Teaching example: a bank transfer', '教学示例：账户转账'),
        explanation: t(
          '**Invented teaching example.** 1. Begin a transaction. 2. Debit account A. 3. Credit account B. 4. Commit after both succeed. If the credit fails, roll back the debit as well.',
          '**虚构的教学示例。** 1. 开始事务。2. 从账户 A 扣款。3. 为账户 B 入账。4. 两步都成功后提交。如果入账失败，扣款也必须回滚。'
        )
      })
      for (const kind of ['concept', 'practice'])
        result.questions.push({
          ...base,
          kind,
          prompt:
            kind === 'concept'
              ? t(
                  'Why does atomicity require rolling back a partially completed transfer?',
                  '为什么原子性要求回滚仅完成一部分的转账？'
                )
              : t(
                  'A debit succeeds but the credit fails. Describe how your transaction should recover.',
                  '扣款成功但入账失败时，你设计的事务应如何恢复？'
                ),
          referenceAnswer: t(
            'Roll back the entire transfer so both balances remain unchanged. Commit only after both operations succeed.',
            '回滚整个转账，确保两个账户余额保持原状；仅在两步都成功后提交。'
          ),
          rubric: [
            {
              id: 'accuracy',
              criterion: t('Conceptual accuracy', '概念准确性'),
              maxScore: 60
            },
            {
              id: 'application',
              criterion: t('Application and reasoning', '应用与推理'),
              maxScore: 40
            }
          ]
        })
    }
    return result
  }
  if (data.rubric && typeof data.studentAnswer === 'string') {
    const scoreFactor = /rollback|roll back|回滚/i.test(data.studentAnswer)
      ? 0.8
      : 0.2
    return {
      assessable: true,
      feedback: t(
        'Local test assessment: review transaction boundaries and explain both outcomes.',
        '本地测试评分：请复习事务边界，并解释成功与失败两种情况。'
      ),
      strengths: [
        t('The answer was submitted successfully.', '答案已成功提交。')
      ],
      improvements: [
        t(
          'Explain when to commit and when to roll back.',
          '进一步解释何时提交、何时回滚。'
        )
      ],
      criteria: data.rubric.map(item => ({
        criterionId: item.id,
        score: Math.round(item.maxScore * scoreFactor),
        reason: t(
          'Deterministic fixture score; not an assessment of model quality.',
          '确定性测试分数，不用于评价模型教学质量。'
        )
      }))
    }
  }
  throw new Error('Unknown test task schema')
}

export async function startTestProvider() {
  const counts = { embeddings: 0, completions: 0 }
  const server = createServer(async (request, response) => {
    const send = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(data))
    }
    if (request.method === 'GET' && request.url === '/health')
      return send(200, { testDouble: true, ...counts })
    if (request.headers.authorization !== 'Bearer smoke-only')
      return send(401, { error: 'Test credential required' })
    try {
      const parts = []
      let bytes = 0
      for await (const part of request) {
        bytes += part.length
        if (bytes > 2_000_000) throw new Error('Test request too large')
        parts.push(part)
      }
      const body = JSON.parse(Buffer.concat(parts).toString('utf8'))
      if (request.url === '/v1/embeddings') {
        counts.embeddings++
        return send(200, {
          object: 'list',
          model: 'tutor-smoke-embedding',
          data: body.input.map((input, index) => ({
            object: 'embedding',
            index,
            embedding: embedding(input)
          })),
          usage: { prompt_tokens: 1, total_tokens: 1 }
        })
      }
      if (request.url === '/v1/chat/completions') {
        counts.completions++
        return send(200, {
          id: `test-${randomUUID()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'tutor-smoke',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify(generate(body))
              },
              finish_reason: 'stop'
            }
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        })
      }
      send(404, { error: 'Unsupported test endpoint' })
    } catch (error) {
      console.error('[Tutor TEST DOUBLE]', error.message)
      send(400, { error: 'Invalid test request' })
    }
  })
  await new Promise((resolve, reject) =>
    server.once('error', reject).listen(3106, '127.0.0.1', resolve)
  )
  console.log(
    '[Tutor TEST DOUBLE] Listening on 127.0.0.1:3106. Not a real model.'
  )
  return server
}
