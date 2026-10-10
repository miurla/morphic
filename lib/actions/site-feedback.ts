'use server'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { db } from '@/lib/db'
import { feedback, generateId } from '@/lib/db/schema'
import { withOptionalRLS } from '@/lib/db/with-rls'

export async function submitFeedback(data: {
  sentiment: 'positive' | 'neutral' | 'negative'
  message: string
  pageUrl: string
}) {
  try {
    // Get current user if logged in (provider-agnostic seam)
    const user = await getCurrentUser()
    const userId = user?.id
    const userEmail = user?.email ?? undefined

    // Get user agent from headers
    const { headers } = await import('next/headers')
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || undefined

    // Save to database with RLS context
    // Note: Avoid relying on RETURNING because RLS without a SELECT policy
    // can cause INSERT ... RETURNING to return zero rows.
    const id = generateId()
    await withOptionalRLS(userId || null, async tx => {
      await tx.insert(feedback).values({
        id,
        userId,
        sentiment: data.sentiment,
        message: data.message,
        pageUrl: data.pageUrl,
        userAgent
      })
    })

    // Send to Slack if webhook URL is configured
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL
    if (slackWebhookUrl) {
      try {
        const sentimentEmoji = {
          positive: '😊',
          neutral: '😐',
          negative: '😞'
        }[data.sentiment]

        const slackMessage = {
          text: `New feedback received ${sentimentEmoji}`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `New Feedback ${sentimentEmoji}`
              }
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Sentiment:*\n${data.sentiment}`
                },
                {
                  type: 'mrkdwn',
                  text: `*From:*\n${userEmail || 'Anonymous'}`
                }
              ]
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Message:*\n${data.message}`
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Page: ${data.pageUrl} | Time: ${new Date().toISOString()}`
                }
              ]
            }
          ]
        }

        // Add timeout to prevent hanging if Slack is unresponsive
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000) // 10 seconds

        try {
          await fetch(slackWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(slackMessage),
            signal: controller.signal
          })
        } finally {
          clearTimeout(timeout)
        }
      } catch (slackError) {
        // Log Slack error but don't fail the request
        console.error('Failed to send Slack notification:', slackError)
      }
    }

    return { success: true, id }
  } catch (error) {
    console.error('Failed to save feedback:', error)
    return { success: false, error: 'Failed to save feedback' }
  }
}
