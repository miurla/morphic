'use client'

import { useEffect, useState, ViewTransition } from 'react'
import Textarea from 'react-textarea-autosize'

import {
  SPACE_NAME_MAX_LENGTH,
  SPACE_TEXT_MAX_LENGTH
} from '@/lib/spaces/space'
import { cn } from '@/lib/utils'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { IconLogo } from '@/components/ui/icons'

import {
  DEFAULT_SPACE_COLOR,
  SPACE_COLORS,
  type SpaceColor,
  spaceColorLabel,
  spaceColorValue,
  spaceLogoColor,
  spaceTransitionName
} from './space-colors'
import { useIsVisibleSurface } from './space-surface'
import { useSpaces } from './spaces-provider'

const fieldClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/30'

/** Space settings, shown over the home in place of the input. */
export function SpaceSettings() {
  const spaces = useSpaces()
  const visible = useIsVisibleSurface()
  if (!spaces.editor || !visible) return null
  return (
    <ViewTransition>
      <SpaceSettingsView />
    </ViewTransition>
  )
}

function SpaceSettingsView() {
  const spaces = useSpaces()
  const color = spaces.editor!.color
  const isDefault = color === DEFAULT_SPACE_COLOR
  const fields = spaces.fieldsOf(color)
  const [expandedDefault, setExpandedDefault] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Default stays folded while it has no instructions, so doing nothing
  // is the obvious choice.
  const folded =
    isDefault &&
    !expandedDefault &&
    !fields.about.trim() &&
    !fields.style.trim()

  const { closeEditor } = spaces
  useEffect(() => {
    if (confirmDelete) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) closeEditor()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeEditor, confirmDelete])

  return (
    <div
      role="dialog"
      aria-label="Space settings"
      className="absolute inset-0 z-20 overflow-y-auto bg-background"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={closeEditor}
        className="absolute top-3 right-3 text-muted-foreground"
      >
        Close
        <kbd className="ml-1 hidden font-sans text-[10px] text-muted-foreground md:inline">
          Esc
        </kbd>
      </Button>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-8 px-4 pt-16 pb-24">
        <ViewTransition key={color} name={spaceTransitionName(color)}>
          <IconLogo className="size-14" bodyColor={spaceLogoColor(color)} />
        </ViewTransition>

        <div
          role="radiogroup"
          aria-label="Spaces"
          className="flex flex-wrap items-center justify-center gap-2.5"
        >
          {SPACE_COLORS.map(option => (
            <ColorOption
              key={option}
              color={option}
              selected={option === color}
              exists={spaces.existing.includes(option)}
              name={spaces.nameOf(option)}
              onSelect={() => spaces.editColor(option)}
            />
          ))}
        </div>

        {folded ? (
          <div className="flex w-full flex-col gap-3">
            <h2 className="text-2xl font-semibold">Default</h2>
            <p className="text-sm text-muted-foreground">
              Morphic&apos;s standard behavior. Add instructions only if you
              want them in every chat.
            </p>
            <button
              type="button"
              onClick={() => setExpandedDefault(true)}
              className="self-start text-sm font-medium underline-offset-4 hover:underline"
            >
              Add instructions
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-6">
            <h2 className="text-2xl font-semibold">{spaces.nameOf(color)}</h2>
            {!isDefault && (
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Name</span>
                <input
                  value={fields.name}
                  maxLength={SPACE_NAME_MAX_LENGTH}
                  placeholder={spaceColorLabel(color)}
                  onChange={event =>
                    spaces.updateField('name', event.target.value)
                  }
                  className={cn(fieldClass, 'h-10')}
                />
              </label>
            )}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                What do you work on in this space?
              </span>
              <Textarea
                value={fields.about}
                minRows={3}
                maxRows={12}
                maxLength={SPACE_TEXT_MAX_LENGTH}
                autoFocus={isDefault && expandedDefault}
                placeholder={
                  isDefault
                    ? undefined
                    : 'Researching and writing articles for my blog'
                }
                onChange={event =>
                  spaces.updateField('about', event.target.value)
                }
                className={cn(fieldClass, 'resize-none')}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                How should Morphic write?
              </span>
              <Textarea
                value={fields.style}
                minRows={4}
                maxRows={12}
                maxLength={SPACE_TEXT_MAX_LENGTH}
                placeholder={
                  isDefault
                    ? undefined
                    : 'Lead with the key point. Short paragraphs under H2 headings. Cite sources inline.'
                }
                onChange={event =>
                  spaces.updateField('style', event.target.value)
                }
                className={cn(fieldClass, 'resize-none')}
              />
            </label>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {isDefault ? (
                <p>
                  Applies to all chats in Default, including existing ones from
                  their next message. Citation rules stay the same.
                </p>
              ) : (
                <p>
                  Applies to new chats in this space. Citation rules stay the
                  same.
                </p>
              )}
            </div>
            {!isDefault && spaces.isSaved(color) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="self-start text-destructive hover:text-destructive"
              >
                Delete space
              </Button>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {spaces.nameOf(color)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its instructions are removed. Chats in this space are kept and
              move to Default.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void spaces.removeSpace(color)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ColorOption({
  color,
  selected,
  exists,
  name,
  onSelect
}: {
  color: SpaceColor
  selected: boolean
  exists: boolean
  name: string
  onSelect: () => void
}) {
  const label = exists ? name : `New ${spaceColorLabel(color)} space`
  const dot = exists ? (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className={cn(
        'size-8 rounded-full transition-[scale] duration-150 ease-out hover:scale-110',
        selected &&
          'ring-2 ring-foreground/40 ring-offset-2 ring-offset-background'
      )}
      style={{ background: spaceColorValue(color) }}
    />
  ) : (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className={cn(
        'grid size-8 place-items-center rounded-full border-2 border-dashed text-sm leading-none transition-opacity duration-150',
        selected
          ? 'opacity-100 ring-2 ring-foreground/40 ring-offset-2 ring-offset-background'
          : 'opacity-55 hover:opacity-100'
      )}
      style={{
        borderColor: spaceColorValue(color),
        color: spaceColorValue(color)
      }}
    >
      +
    </button>
  )
  // The selected space is the large logo above, so only the others morph.
  if (selected || !exists) return dot
  return (
    <ViewTransition name={spaceTransitionName(color)}>{dot}</ViewTransition>
  )
}
