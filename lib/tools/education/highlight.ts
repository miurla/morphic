import { tool } from 'ai'
import { z } from 'zod'

const highlightSchema = z.object({
  target: z.enum(['code', 'text', 'element']),
  lines: z.array(z.number()).optional(), // Line numbers to highlight (1-indexed)
  color: z.enum(['yellow', 'blue', 'green', 'red', 'purple', 'orange']).default('yellow'),
  style: z.enum(['highlight', 'underline', 'border', 'glow']).default('highlight'),
  duration: z.number().default(3000), // Duration in milliseconds, 0 for permanent
  description: z.string().optional()
})

type HighlightParams = z.infer<typeof highlightSchema>

export const createHighlightTool = (model: string) => {
  return tool({
    description: `Highlight specific lines, text ranges, or elements to draw attention during educational instructions. Perfect for pointing out important code sections, syntax, or UI elements.`,
    parameters: highlightSchema,
    execute: async (params: HighlightParams) => {
      const {
        target,
        lines = [],
        color,
        style,
        duration,
        description
      } = params

      // Generate unique highlight ID
      const highlightId = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Create highlight configuration
      const highlightConfig = {
        id: highlightId,
        target,
        lines: lines.map((line: number) => ({
          line: line,
          type: 'full-line'
        })),
        style: {
          color,
          type: style
        },
        duration,
        description
      }

      // Color scheme definitions
      const colorSchemes = {
        yellow: { background: 'rgba(255, 255, 0, 0.3)', border: 'rgba(255, 255, 0, 0.8)' },
        blue: { background: 'rgba(0, 123, 255, 0.3)', border: 'rgba(0, 123, 255, 0.8)' },
        green: { background: 'rgba(40, 167, 69, 0.3)', border: 'rgba(40, 167, 69, 0.8)' },
        red: { background: 'rgba(220, 53, 69, 0.3)', border: 'rgba(220, 53, 69, 0.8)' },
        purple: { background: 'rgba(108, 117, 125, 0.3)', border: 'rgba(108, 117, 125, 0.8)' },
        orange: { background: 'rgba(255, 193, 7, 0.3)', border: 'rgba(255, 193, 7, 0.8)' }
      }

      const selectedColor = colorSchemes[color as keyof typeof colorSchemes]

      return {
        type: 'highlight',
        title: `Highlight: ${target.charAt(0).toUpperCase() + target.slice(1)}`,
        description: description || `Highlighting ${target} with ${color} ${style}`,
        config: highlightConfig,
        styles: {
          backgroundColor: selectedColor.background,
          borderColor: selectedColor.border,
          borderWidth: style === 'border' ? '2px' : '0px',
          textDecoration: style === 'underline' ? 'underline' : 'none',
          boxShadow: style === 'glow' ? `0 0 10px ${selectedColor.border}` : 'none'
        },
        actions: {
          clear: true,
          extend: true,
          modify: true
        },
        metadata: {
          createdAt: new Date().toISOString(),
          target,
          color,
          style,
          duration,
          highlightId,
          model
        }
      }
    }
  })
}

// Helper function to create common educational highlights
export const createEducationalHighlight = (type: string, lines: number[], description?: string) => {
  const presets = {
    error: {
      color: 'red' as const,
      style: 'border' as const,
      animation: 'pulse' as const,
      duration: 5000
    },
    important: {
      color: 'yellow' as const,
      style: 'highlight' as const,
      animation: 'fade' as const,
      duration: 3000
    },
    success: {
      color: 'green' as const,
      style: 'glow' as const,
      animation: 'fade' as const,
      duration: 2000
    },
    info: {
      color: 'blue' as const,
      style: 'highlight' as const,
      animation: 'none' as const,
      duration: 0
    },
    warning: {
      color: 'orange' as const,
      style: 'underline' as const,
      animation: 'pulse' as const,
      duration: 4000
    }
  }

  const preset = presets[type as keyof typeof presets] || presets.info

  return {
    target: 'code' as const,
    lines,
    color: preset.color,
    style: preset.style,
    animation: preset.animation,
    duration: preset.duration,
    description: description || `${type.charAt(0).toUpperCase() + type.slice(1)} highlight`
  }
}
