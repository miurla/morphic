import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { userMemories, type UserMemory } from '@/lib/db/schema'

const CATEGORY_LABELS: Record<string, string> = {
  identity: 'Identité & rôle',
  business: 'Entreprise & secteur',
  icp: 'Cibles & ICP',
  positioning: 'Positionnement & ton',
  goals: 'Objectifs en cours',
  relationships: 'Relations clés',
  preferences: 'Préférences',
  constraints: 'À ne pas faire'
}

const MAX_FACTS_PER_CATEGORY = 10
const MAX_TOTAL_FACTS = 30

export async function loadUserMemory(
  userId: string
): Promise<string | null> {
  const memories = await db
    .select()
    .from(userMemories)
    .where(eq(userMemories.userId, userId))
    .orderBy(userMemories.category, userMemories.updatedAt)

  if (memories.length === 0) return null

  // Filter expired
  const now = Date.now()
  const active = memories.filter(
    m => !m.expiresAt || new Date(m.expiresAt).getTime() > now
  )

  if (active.length === 0) return null

  // Group by category, cap per category
  const grouped: Record<string, UserMemory[]> = {}
  for (const m of active) {
    if (!grouped[m.category]) grouped[m.category] = []
    if (grouped[m.category].length < MAX_FACTS_PER_CATEGORY) {
      grouped[m.category].push(m)
    }
  }

  // Build prompt section, cap total
  const sections: string[] = []
  let totalFacts = 0

  for (const [category, label] of Object.entries(CATEGORY_LABELS)) {
    const facts = grouped[category]
    if (!facts || facts.length === 0) continue

    const lines = facts
      .slice(0, MAX_TOTAL_FACTS - totalFacts)
      .map(f => `- ${f.content}`)

    if (lines.length > 0) {
      sections.push(`## ${label}\n${lines.join('\n')}`)
      totalFacts += lines.length
    }

    if (totalFacts >= MAX_TOTAL_FACTS) break
  }

  if (sections.length === 0) return null

  return `CE QUE TU SAIS DE L'UTILISATEUR (mémoire persistante — peut être incomplète ou datée) :

${sections.join('\n\n')}

RÈGLES MÉMOIRE :
- N'annonce pas que tu utilises la mémoire ("d'après ce que je sais...")
- Agis comme un collègue qui connaît naturellement le contexte
- Si un fait semble obsolète, demande confirmation avant d'agir dessus`
}
