import type { Spec } from '@json-render/core'

/**
 * Describes how a legacy spec element `type` should be rewritten when the
 * catalog changes. Only type renames and additive prop defaults are
 * supported. For value transformations or structural changes, add a proper
 * migration function pathway when an actual case demands it.
 */
export type TypeMigration = {
  /** New catalog type name. */
  to: string
  /**
   * Props merged into the migrated element when the corresponding key is
   * absent from the original element's props. Never overrides existing
   * values, so the migration remains safe to run against specs that were
   * authored against the new catalog.
   */
  defaultProps?: Record<string, unknown>
}

export type MigrationMap = Record<string, TypeMigration>

/**
 * Parse-time migration table for renamed or removed spec component types.
 *
 * Keep this minimal. Only add an entry when a real incompatibility must be
 * preserved for historical messages — this map is effectively a forever
 * compatibility promise. Purely additive catalog changes (new components,
 * new optional props) do NOT require an entry.
 */
export const typeMigrations: MigrationMap = {}

type SpecElement = {
  type: string
  props?: Record<string, unknown>
  children?: string[]
  on?: Record<string, unknown>
}

/**
 * Resolves a migration chain (`A -> B -> C`) to its final target so callers
 * always see the latest catalog name, even when a type has been renamed
 * multiple times. Default props accumulated along the chain are merged with
 * later entries taking precedence over earlier ones.
 */
function resolveMigration(
  type: string,
  migrations: MigrationMap
): TypeMigration | null {
  const first = migrations[type]
  if (!first) return null

  let current: TypeMigration = first
  const seen = new Set<string>([type])
  while (migrations[current.to]) {
    if (seen.has(current.to)) break // cycle guard
    seen.add(current.to)
    const next = migrations[current.to]
    current = {
      to: next.to,
      defaultProps: { ...current.defaultProps, ...next.defaultProps }
    }
  }
  return current
}

/**
 * Rewrites legacy element `type`s in a spec to their current catalog names
 * using the migration table. Pure and idempotent: running it multiple times
 * on the same spec yields the same result, so it is safe to apply on every
 * incremental parse of a streaming spec block.
 *
 * Unknown types (not in catalog and not in migrations) are left untouched;
 * the downstream renderer is responsible for logging/skipping them.
 */
export function migrateSpec(
  spec: Spec,
  migrations: MigrationMap = typeMigrations
): Spec {
  const elements = spec.elements as Record<string, SpecElement> | undefined
  if (!elements) return spec

  let changed = false
  const migrated: Record<string, SpecElement> = {}

  for (const [key, element] of Object.entries(elements)) {
    const migration = resolveMigration(element.type, migrations)
    if (!migration) {
      migrated[key] = element
      continue
    }

    changed = true
    migrated[key] = {
      ...element,
      type: migration.to,
      props: {
        ...migration.defaultProps,
        ...(element.props ?? {})
      }
    }
  }

  if (!changed) return spec
  return { ...spec, elements: migrated } as Spec
}
