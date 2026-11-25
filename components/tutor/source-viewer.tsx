'use client'

import { useEffect, useRef, useState } from 'react'

import {
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
  IconLoader2
} from '@tabler/icons-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

import { getTutorDocumentFormat } from '@/lib/tutor/document-formats'
import type { SourceCitation } from '@/lib/tutor/types'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

import { useI18n } from '@/components/language-provider'

interface SourceViewerProps {
  source: SourceCitation
  onClose: () => void
}

export default function SourceViewer(props: SourceViewerProps) {
  return getTutorDocumentFormat(props.source.filename) === 'pdf' ? (
    <PdfSourceViewer {...props} />
  ) : (
    <TextSourceViewer {...props} />
  )
}

function TextSourceViewer({ source, onClose }: SourceViewerProps) {
  const { t } = useI18n()
  const fileUrl = `/api/tutor/documents/${encodeURIComponent(source.documentId)}/file`

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="flex max-h-[85dvh] max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <DialogHeader className="pr-7 text-left">
          <DialogTitle className="truncate">{source.filename}</DialogTitle>
          <DialogDescription>
            {t('Original source · This passage supports the lesson.')}
          </DialogDescription>
        </DialogHeader>
        <blockquote className="min-h-0 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
          {source.quote}
        </blockquote>
        <Button asChild variant="outline" className="self-start">
          <a href={fileUrl} download={source.filename}>
            <IconExternalLink className="mr-2 size-4" aria-hidden />
            {t('Download original file')}
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function PdfSourceViewer({ source, onClose }: SourceViewerProps) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(source.regions[0]?.page ?? 1)
  const [width, setWidth] = useState(700)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState(false)
  const fileUrl = `/api/tutor/documents/${encodeURIComponent(source.documentId)}/file`

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(200, entry.contentRect.width))
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let disposed = false
    let destroy: (() => void) | undefined
    async function load() {
      try {
        const pdfjs = await import('pdfjs-dist')
        if (disposed) return
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const task = pdfjs.getDocument({
          url: fileUrl,
          withCredentials: true,
          enableXfa: false
        })
        destroy = () => {
          void task.destroy()
        }
        const document = await task.promise
        if (!disposed) setPdf(document)
      } catch {
        if (!disposed) {
          setError(true)
          setRendering(false)
        }
      }
    }
    void load()
    return () => {
      disposed = true
      destroy?.()
    }
  }, [fileUrl])

  useEffect(() => {
    if (!pdf) return
    let disposed = false
    let task: RenderTask | undefined
    async function renderPage() {
      setRendering(true)
      setError(false)
      try {
        const pdfPage = await pdf!.getPage(page)
        if (disposed || !canvasRef.current) return
        const canvas = canvasRef.current
        const original = pdfPage.getViewport({ scale: 1 })
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = pdfPage.getViewport({
          scale: (width / original.width) * ratio
        })
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        task = pdfPage.render({ canvas, viewport })
        await task.promise
        if (!disposed) setRendering(false)
      } catch {
        if (!disposed) {
          setError(true)
          setRendering(false)
        }
      }
    }
    void renderPage()
    return () => {
      disposed = true
      task?.cancel()
    }
  }, [pdf, page, width])

  const sourcePages = [...new Set(source.regions.map(region => region.page))]

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="flex h-[92dvh] max-w-5xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
        <DialogHeader className="pr-7 text-left">
          <DialogTitle className="truncate">{source.filename}</DialogTitle>
          <DialogDescription>
            {t('Original source · Highlighted passages support this lesson.')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              disabled={!pdf || page <= 1}
              aria-label={t('Previous page')}
              onClick={() => setPage(value => value - 1)}
            >
              <IconChevronLeft className="size-4" />
            </Button>
            <span className="min-w-20 text-center text-sm tabular-nums">
              {t('Page {page} of {total}', {
                page,
                total: pdf?.numPages ?? '…'
              })}
            </span>
            <Button
              size="icon"
              variant="ghost"
              disabled={!pdf || page >= pdf.numPages}
              aria-label={t('Next page')}
              onClick={() => setPage(value => value + 1)}
            >
              <IconChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {sourcePages.map(number => (
              <Button
                key={number}
                variant={page === number ? 'secondary' : 'ghost'}
                size="sm"
                disabled={!pdf}
                onClick={() => setPage(number)}
              >
                {t('Source p. {page}', { page: number })}
              </Button>
            ))}
            <Button asChild size="icon" variant="ghost">
              <a
                href={`${fileUrl}#page=${page}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('Open original PDF')}
              >
                <IconExternalLink className="size-4" />
              </a>
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-muted/40 p-2 md:p-4">
          <div ref={containerRef} className="mx-auto max-w-3xl">
            {error && (
              <p
                role="alert"
                className="mb-3 rounded-lg border bg-background p-4 text-sm"
              >
                {t(
                  'The PDF preview could not be loaded. You can open the original PDF instead.'
                )}
              </p>
            )}
            <div className="relative min-h-48 bg-white shadow-sm">
              {rendering && (
                <div
                  role="status"
                  className="absolute inset-0 z-10 flex min-h-48 items-center justify-center bg-background/85"
                >
                  <IconLoader2
                    className="size-5 animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                  <span className="sr-only">{t('Loading source…')}</span>
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="block h-auto w-full"
                role="img"
                aria-label={t('PDF page {page}', { page })}
              />
              {!rendering &&
                !error &&
                source.regions
                  .filter(region => region.page === page)
                  .map((region, index) => (
                    <span
                      key={index}
                      aria-hidden
                      className="pointer-events-none absolute border border-amber-600/60 bg-amber-300/35 mix-blend-multiply"
                      style={{
                        left: `${region.x * 100}%`,
                        top: `${region.y * 100}%`,
                        width: `${region.width * 100}%`,
                        height: `${region.height * 100}%`
                      }}
                    />
                  ))}
            </div>
          </div>
        </div>
        <details className="shrink-0 rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {t('Read the cited passage')}
          </summary>
          <blockquote className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed text-muted-foreground">
            {source.quote}
          </blockquote>
        </details>
      </DialogContent>
    </Dialog>
  )
}
