import type { KnowledgeGraphEntity } from '@/lib/entities/knowledge-graph'

import { GuardedExternalLink } from '@/components/navigation/guarded-external-link'

interface GistEntityChipsProps {
  entities: KnowledgeGraphEntity[]
}

function entityHref(entity: KnowledgeGraphEntity): string | undefined {
  return entity.wikidataUrl || entity.dbpediaUrl
}

function entityTitle(entity: KnowledgeGraphEntity): string {
  const sourceLabel =
    entity.source === 'both'
      ? 'Wikidata and DBpedia'
      : entity.source === 'wikidata'
        ? 'Wikidata'
        : 'DBpedia'

  return [entity.description, sourceLabel].filter(Boolean).join(' - ')
}

export function GistEntityChips({ entities }: GistEntityChipsProps) {
  const visibleEntities = entities.slice(0, 4)

  if (visibleEntities.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Gist entities">
      {visibleEntities.map(entity => {
        const href = entityHref(entity)
        const className =
          'max-w-full rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] leading-5 text-foreground underline-offset-4 hover:underline'

        if (!href) {
          return (
            <span
              key={`${entity.source}-${entity.label}`}
              className={className}
              title={entityTitle(entity)}
            >
              {entity.label}
            </span>
          )
        }

        return (
          <GuardedExternalLink
            key={href}
            href={href}
            target="_blank"
            className={className}
            title={entityTitle(entity)}
          >
            {entity.label}
          </GuardedExternalLink>
        )
      })}
    </div>
  )
}
