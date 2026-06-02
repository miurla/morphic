'use client'

import * as React from 'react'

import { assessExternalNavigation } from '@/lib/security/external-navigation'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

import { LeavingMorphicDialog } from './leaving-morphic-dialog'

type GuardedExternalLinkProps =
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
  }

export function GuardedExternalLink({
  href,
  target = '_blank',
  rel = 'noopener noreferrer',
  onClick,
  children,
  ...props
}: GuardedExternalLinkProps) {
  const [open, setOpen] = React.useState(false)
  const [appOrigin, setAppOrigin] = React.useState('https://morphic.sh')
  const assessment = React.useMemo(
    () => assessExternalNavigation(href, appOrigin),
    [appOrigin, href]
  )

  React.useEffect(() => {
    setAppOrigin(window.location.origin)
  }, [])

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return

    const currentOrigin = window.location.origin
    const currentAssessment = assessExternalNavigation(href, currentOrigin)
    if (currentAssessment.risk === 'none') {
      return
    }

    event.preventDefault()
    setAppOrigin(currentOrigin)
    setOpen(true)
  }

  const continueNavigation = () => {
    setOpen(false)
    window.open(
      assessment.normalizedHref ?? href,
      target,
      'noopener,noreferrer'
    )
  }

  return (
    <>
      <a href={href} target={target} rel={rel} onClick={handleClick} {...props}>
        {children}
      </a>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-0 bg-transparent p-0 shadow-none sm:max-w-md">
          <DialogTitle className="sr-only">Leaving Morphic</DialogTitle>
          <LeavingMorphicDialog
            href={href}
            appOrigin={appOrigin}
            onCancel={() => setOpen(false)}
            onContinue={continueNavigation}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
