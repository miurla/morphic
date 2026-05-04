'use server'

import { submitSiteFeedback } from '@/lib/supabase/queries/feedback'
import { createClient } from '@/lib/supabase/server'
import { generateId } from '@/lib/utils/id'

export async function submitFeedback(data: {
  sentiment: 'positive' | 'neutral' | 'negative'
  message: string
  pageUrl: string
}) {
  try {
    // Get current user if logged in
    let userId: string | undefined
    let userEmail: string | undefined
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = await createClient()
      const {
        data: { user }
      } = await supabase.auth.getUser()
      userId = user?.id
      userEmail = user?.email
    }

    // Get user agent from headers
    const { headers } = await import('next/headers')
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || undefined

    // Save to database
    const id = generateId()
    await submitSiteFeedback({
      id,
      userId,
      sentiment: data.sentiment,
      message: data.message,
      pageUrl: data.pageUrl,
      userAgent
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
