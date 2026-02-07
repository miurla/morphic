#!/usr/bin/env bun

import { config } from 'dotenv'

config({ path: '.env.local' })

const API_URL = process.env.API_URL || 'http://localhost:3001/api/chat'
const COOKIES = process.env.MORPHIC_COOKIES

async function measureRequest(
  chatId: string,
  message: string,
  trigger: string = 'submit-user-message',
  messageId?: string
): Promise<number> {
  const startTime = performance.now()

  const payload: any = {
    chatId,
    trigger
  }

  if (trigger === 'submit-user-message') {
    payload.message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      role: 'user',
      content: message,
      parts: [{ type: 'text', text: message }],
      createdAt: new Date().toISOString()
    }
  } else if (trigger === 'regenerate-assistant-message' && messageId) {
    payload.messageId = messageId
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: COOKIES || ''
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  // Consume the stream
  const reader = response.body?.getReader()
  if (reader) {
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }
  }

  const endTime = performance.now()
  return endTime - startTime
}

async function runPerformanceTests() {
  console.log('🚀 Cache Performance Test Suite')
  console.log('================================\n')

  const results = {
    firstRequest: 0,
    cachedRequest: 0,
    regeneration: 0,
    consecutiveRequests: [] as number[]
  }

  // Test 1: First request (cold cache)
  console.log('Test 1: First request (cold cache)')
  const chatId1 = `chat_perf_${Date.now()}_1`
  results.firstRequest = await measureRequest(
    chatId1,
    'What is the capital of France?'
  )
  console.log(`✓ Time: ${results.firstRequest.toFixed(2)}ms\n`)

  // Test 2: Subsequent request (warm cache)
  console.log('Test 2: Subsequent request (warm cache)')
  results.cachedRequest = await measureRequest(chatId1, 'What about Germany?')
  console.log(`✓ Time: ${results.cachedRequest.toFixed(2)}ms\n`)

  // Test 3: Regeneration (should bypass cache)
  console.log('Test 3: Regeneration (bypass cache)')
  const messageId = `msg_${Date.now()}_test`
  results.regeneration = await measureRequest(
    chatId1,
    '',
    'regenerate-assistant-message',
    messageId
  )
  console.log(`✓ Time: ${results.regeneration.toFixed(2)}ms\n`)

  // Test 4: Multiple consecutive requests
  console.log('Test 4: Multiple consecutive requests')
  const chatId2 = `chat_perf_${Date.now()}_2`
  for (let i = 1; i <= 5; i++) {
    const time = await measureRequest(chatId2, `Message ${i}`)
    results.consecutiveRequests.push(time)
    console.log(`  Request ${i}: ${time.toFixed(2)}ms`)
  }

  // Summary
  console.log('\n================================')
  console.log('📊 Performance Summary')
  console.log('================================')
  console.log(`First Request:        ${results.firstRequest.toFixed(2)}ms`)
  console.log(`Cached Request:       ${results.cachedRequest.toFixed(2)}ms`)
  console.log(`Regeneration:         ${results.regeneration.toFixed(2)}ms`)

  const avgConsecutive =
    results.consecutiveRequests.reduce((a, b) => a + b, 0) /
    results.consecutiveRequests.length
  console.log(`Avg Consecutive:      ${avgConsecutive.toFixed(2)}ms`)

  // Cache effectiveness
  const cacheImprovement =
    ((results.firstRequest - results.cachedRequest) / results.firstRequest) *
    100
  console.log(`\nCache Improvement:    ${cacheImprovement.toFixed(1)}%`)

  // Check if cache is working effectively
  if (results.cachedRequest < results.firstRequest) {
    console.log('✅ Cache is working effectively!')
  } else {
    console.log('⚠️ Cache may not be working as expected')
  }
}

// Run tests
runPerformanceTests().catch(console.error)
