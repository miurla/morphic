import { generateAndCacheAudio, getAudioCacheStats } from '@/lib/services/tts-service'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'nova' } = await req.json()
    
    if (!text) {
      return Response.json({ error: 'Text is required' }, { status: 400 })
    }

    const audioUrl = await generateAndCacheAudio(text, { voice })
    
    return Response.json({ 
      success: true, 
      audioUrl,
      message: 'TTS audio generated successfully' 
    })
  } catch (error) {
    console.error('TTS test error:', error)
    return Response.json(
      { success: false, error: 'Failed to generate TTS audio' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const stats = await getAudioCacheStats()
    return Response.json({ success: true, stats })
  } catch (error) {
    console.error('TTS stats error:', error)
    return Response.json(
      { success: false, error: 'Failed to get cache stats' },
      { status: 500 }
    )
  }
}
