import { promises as fs } from 'fs'
import path from 'path'
import { Lesson } from './schema'

const LESSONS_DIR = path.join(process.cwd(), 'data', 'lessons')
const DRAFTS_DIR = path.join(LESSONS_DIR, 'drafts')
const PUBLISHED_DIR = path.join(LESSONS_DIR, 'published')

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir(DRAFTS_DIR, { recursive: true })
  await fs.mkdir(PUBLISHED_DIR, { recursive: true })
}

export async function saveLessonDraft(lesson: Lesson): Promise<string> {
  await ensureDirectories()
  
  const lessonId = lesson.id || `lesson_${Date.now()}`
  const filename = `${lessonId}.json`
  const filepath = path.join(DRAFTS_DIR, filename)
  
  const lessonWithId = { ...lesson, id: lessonId }
  await fs.writeFile(filepath, JSON.stringify(lessonWithId, null, 2))
  
  return lessonId
}

export async function publishLesson(lessonId: string): Promise<void> {
  await ensureDirectories()
  
  const draftPath = path.join(DRAFTS_DIR, `${lessonId}.json`)
  const publishedPath = path.join(PUBLISHED_DIR, `${lessonId}.json`)
  
  try {
    const draftContent = await fs.readFile(draftPath, 'utf-8')
    const lesson = JSON.parse(draftContent) as Lesson
    
    // Mark as published
    const publishedLesson = {
      ...lesson,
      status: 'published',
      publishedAt: new Date().toISOString(),
      version: lesson.version || 1
    }
    
    // Write to published directory
    await fs.writeFile(publishedPath, JSON.stringify(publishedLesson, null, 2))
    
    console.log(`Lesson ${lessonId} published successfully`)
  } catch (error) {
    console.error(`Error publishing lesson ${lessonId}:`, error)
    throw error
  }
}

export async function getLessonDraft(lessonId: string): Promise<Lesson | null> {
  try {
    const filepath = path.join(DRAFTS_DIR, `${lessonId}.json`)
    const content = await fs.readFile(filepath, 'utf-8')
    return JSON.parse(content) as Lesson
  } catch (error) {
    return null
  }
}

export async function getPublishedLesson(lessonId: string): Promise<Lesson | null> {
  try {
    const filepath = path.join(PUBLISHED_DIR, `${lessonId}.json`)
    const content = await fs.readFile(filepath, 'utf-8')
    return JSON.parse(content) as Lesson
  } catch (error) {
    return null
  }
}

export async function listLessonDrafts(): Promise<Lesson[]> {
  await ensureDirectories()
  
  try {
    const files = await fs.readdir(DRAFTS_DIR)
    const lessons = await Promise.all(
      files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          const content = await fs.readFile(path.join(DRAFTS_DIR, file), 'utf-8')
          return JSON.parse(content) as Lesson
        })
    )
    return lessons
  } catch (error) {
    return []
  }
}

export async function listPublishedLessons(): Promise<Lesson[]> {
  await ensureDirectories()
  
  try {
    const files = await fs.readdir(PUBLISHED_DIR)
    const lessons = await Promise.all(
      files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          const content = await fs.readFile(path.join(PUBLISHED_DIR, file), 'utf-8')
          return JSON.parse(content) as Lesson
        })
    )
    return lessons
  } catch (error) {
    return []
  }
}

export async function deleteLessonDraft(lessonId: string): Promise<void> {
  try {
    const filepath = path.join(DRAFTS_DIR, `${lessonId}.json`)
    await fs.unlink(filepath)
  } catch (error) {
    console.error(`Error deleting lesson draft ${lessonId}:`, error)
    throw error
  }
}
