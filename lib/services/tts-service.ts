import OpenAI from 'openai'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Configuration for TTS
const TTS_CONFIG = {
  model: 'tts-1' as const, // Use tts-1-hd for higher quality
  voice: 'nova' as const, // Available: alloy, echo, fable, onyx, nova, shimmer
  response_format: 'mp3' as const,
  speed: 1.0
}

// Directory for cached audio files
const AUDIO_CACHE_DIR = path.join(process.cwd(), 'public', 'audio', 'lessons')

/**
 * Generate a hash for text content to use as filename
 */
function generateAudioHash(text: string, voice: string = TTS_CONFIG.voice): string {
  const content = `${text}-${voice}-${TTS_CONFIG.speed}`
  return createHash('md5').update(content).digest('hex')
}

/**
 * Ensure audio cache directory exists
 */
async function ensureAudioCacheDir(): Promise<void> {
  try {
    await fs.access(AUDIO_CACHE_DIR)
  } catch {
    await fs.mkdir(AUDIO_CACHE_DIR, { recursive: true })
  }
}

/**
 * Check if audio file exists in cache
 */
async function isAudioCached(hash: string): Promise<boolean> {
  try {
    const filePath = path.join(AUDIO_CACHE_DIR, `${hash}.mp3`)
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Generate TTS audio and cache it
 */
export async function generateAndCacheAudio(
  text: string,
  options: {
    voice?: typeof TTS_CONFIG.voice
    speed?: number
    forceRegenerate?: boolean
  } = {}
): Promise<string> {
  const { voice = TTS_CONFIG.voice, speed = TTS_CONFIG.speed, forceRegenerate = false } = options
  
  // Generate hash for the text
  const hash = generateAudioHash(text, voice)
  const fileName = `${hash}.mp3`
  const filePath = path.join(AUDIO_CACHE_DIR, fileName)
  const publicUrl = `/audio/lessons/${fileName}`
  
  // Ensure cache directory exists
  await ensureAudioCacheDir()
  
  // Check if already cached (unless forcing regeneration)
  if (!forceRegenerate && await isAudioCached(hash)) {
    console.log(`Audio cache hit for hash: ${hash}`)
    return publicUrl
  }
  
  try {
    console.log(`Generating TTS for text (${text.length} chars): ${text.substring(0, 50)}...`)
    
    // Generate TTS using OpenAI
    const response = await openai.audio.speech.create({
      model: TTS_CONFIG.model,
      voice: voice,
      input: text,
      response_format: TTS_CONFIG.response_format,
      speed: speed
    })
    
    // Get audio buffer
    const audioBuffer = Buffer.from(await response.arrayBuffer())
    
    // Save to cache
    await fs.writeFile(filePath, audioBuffer)
    
    console.log(`Audio cached successfully: ${fileName}`)
    return publicUrl
    
  } catch (error) {
    console.error('Error generating TTS:', error)
    throw new Error(`Failed to generate TTS audio: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate TTS for multiple texts in batch
 */
export async function generateBatchAudio(
  texts: Array<{ id: string; text: string; voice?: typeof TTS_CONFIG.voice }>,
  options: { onProgress?: (completed: number, total: number) => void } = {}
): Promise<Array<{ id: string; audioUrl: string }>> {
  const results: Array<{ id: string; audioUrl: string }> = []
  
  for (let i = 0; i < texts.length; i++) {
    const { id, text, voice } = texts[i]
    
    try {
      const audioUrl = await generateAndCacheAudio(text, { voice })
      results.push({ id, audioUrl })
      
      // Report progress
      if (options.onProgress) {
        options.onProgress(i + 1, texts.length)
      }
      
      // Small delay to avoid rate limiting
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
    } catch (error) {
      console.error(`Failed to generate TTS for item ${id}:`, error)
      // Continue with other items
    }
  }
  
  return results
}

/**
 * Get cached audio URL if exists, otherwise return null
 */
export async function getCachedAudioUrl(text: string, voice: string = TTS_CONFIG.voice): Promise<string | null> {
  const hash = generateAudioHash(text, voice)
  const fileName = `${hash}.mp3`
  
  if (await isAudioCached(hash)) {
    return `/audio/lessons/${fileName}`
  }
  
  return null
}

/**
 * Clear audio cache for specific hash or all cache
 */
export async function clearAudioCache(hash?: string): Promise<void> {
  try {
    if (hash) {
      // Clear specific file
      const filePath = path.join(AUDIO_CACHE_DIR, `${hash}.mp3`)
      await fs.unlink(filePath)
      console.log(`Cleared audio cache for hash: ${hash}`)
    } else {
      // Clear all cache
      const files = await fs.readdir(AUDIO_CACHE_DIR)
      await Promise.all(
        files.map(file => fs.unlink(path.join(AUDIO_CACHE_DIR, file)))
      )
      console.log(`Cleared all audio cache (${files.length} files)`)
    }
  } catch (error) {
    console.error('Error clearing audio cache:', error)
  }
}

/**
 * Get cache statistics
 */
export async function getAudioCacheStats(): Promise<{
  totalFiles: number
  totalSize: number
  oldestFile?: string
  newestFile?: string
}> {
  try {
    await ensureAudioCacheDir()
    const files = await fs.readdir(AUDIO_CACHE_DIR)
    
    if (files.length === 0) {
      return { totalFiles: 0, totalSize: 0 }
    }
    
    let totalSize = 0
    let oldestTime = Infinity
    let newestTime = 0
    let oldestFile = ''
    let newestFile = ''
    
    for (const file of files) {
      const filePath = path.join(AUDIO_CACHE_DIR, file)
      const stats = await fs.stat(filePath)
      
      totalSize += stats.size
      
      if (stats.mtime.getTime() < oldestTime) {
        oldestTime = stats.mtime.getTime()
        oldestFile = file
      }
      
      if (stats.mtime.getTime() > newestTime) {
        newestTime = stats.mtime.getTime()
        newestFile = file
      }
    }
    
    return {
      totalFiles: files.length,
      totalSize,
      oldestFile,
      newestFile
    }
    
  } catch (error) {
    console.error('Error getting cache stats:', error)
    return { totalFiles: 0, totalSize: 0 }
  }
}

/**
 * Generate TTS for all content in a lesson
 */
export async function generateLessonTTS(
  lessonId: string, 
  lesson: any,
  options: { onProgress?: (completed: number, total: number) => void } = {}
): Promise<Array<{ stepId: string; audioUrl: string }>> {
  const textsToGenerate: Array<{ id: string; text: string; voice?: typeof TTS_CONFIG.voice }> = []
  
  // Add lesson introduction if exists
  if (lesson.description) {
    textsToGenerate.push({
      id: `${lessonId}-intro`,
      text: `Welcome to ${lesson.title}. ${lesson.description}`
    })
  }
  
  // Add TTS for each step
  lesson.steps?.forEach((step: any, index: number) => {
    if (step.content) {
      let stepText = `Step ${index + 1}: ${step.title}. ${step.content}`
      
      // Clean up text for better TTS
      stepText = stepText
        .replace(/```[\s\S]*?```/g, ' [Code example] ') // Replace code blocks
        .replace(/`[^`]+`/g, ' [Code] ') // Replace inline code
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
        .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
        .replace(/#{1,6}\s+/g, '') // Remove markdown headers
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .trim()
      
      textsToGenerate.push({
        id: step.id || `step-${index}`,
        text: stepText
      })
    }
  })
  
  // Generate TTS for all texts
  const results = await generateBatchAudio(textsToGenerate, {
    onProgress: options.onProgress
  })
  
  console.log(`Generated TTS for lesson ${lessonId}: ${results.length} audio files`)
  return results.map(result => ({ stepId: result.id, audioUrl: result.audioUrl }))
}
