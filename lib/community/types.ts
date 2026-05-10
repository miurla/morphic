export interface Prompt {
  id: string
  category: string
  objective: string
  persona: string
  title: string
  prompt: string
  tags: string[]
  level: string
  heartbeat: boolean
  expectedOutput: string
}

export const CATEGORIES = [
  'Networking & Relations',
  'Apprentissage & Carrière',
  'Création de contenu',
  'Veille & Intelligence économique',
  'Communauté & Événements',
  'Prospection commerciale',
  'Sourcing & Recrutement',
  "Recherche d'emploi",
  'Levée de fonds',
  'Business Development & Partenariats'
] as const

export const PERSONAS = [
  'Founder',
  'Sales',
  'Manager',
  'Recruteur',
  'Job seeker',
  'Investisseur',
  'Personal brander',
  'Consultant'
] as const

export const OBJECTIVES = [
  'Découvrir',
  'Activer',
  'Cibler',
  'Surveiller'
] as const

export const LEVELS = ['débutant', 'intermédiaire', 'avancé'] as const

export const CATEGORY_ICONS: Record<string, string> = {
  'Networking & Relations': '🤝',
  'Apprentissage & Carrière': '📚',
  'Création de contenu': '✍️',
  'Veille & Intelligence économique': '🔍',
  'Communauté & Événements': '🎪',
  'Prospection commerciale': '🎯',
  'Sourcing & Recrutement': '👥',
  "Recherche d'emploi": '💼',
  'Levée de fonds': '💰',
  'Business Development & Partenariats': '🤲'
}

export const OBJECTIVE_COLORS: Record<string, string> = {
  'Découvrir': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Activer': 'bg-green-500/10 text-green-500 border-green-500/20',
  'Cibler': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  'Surveiller': 'bg-purple-500/10 text-purple-500 border-purple-500/20'
}

export const LEVEL_COLORS: Record<string, string> = {
  'débutant': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'intermédiaire': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'avancé': 'bg-red-500/10 text-red-500 border-red-500/20'
}
