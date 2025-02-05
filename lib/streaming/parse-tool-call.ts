import { z } from 'zod'

export interface ToolCall<T = unknown> {
  tool: string
  parameters?: T
}

function getTagContent(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'))
  return match ? match[1].trim() : ''
}

export function parseToolCallXml<T>(
  xml: string,
  schema?: z.ZodType<T>
): ToolCall<T> {
  const toolCallContent = getTagContent(xml, 'tool_call')
  if (!toolCallContent) {
    console.warn('No tool_call tag found in response')
    return { tool: '' }
  }

  const tool = getTagContent(toolCallContent, 'tool')
  if (!tool) return { tool: '' }

  const parametersXml = getTagContent(toolCallContent, 'parameters')
  if (!parametersXml || !schema) return { tool }

  try {
    // Extract all parameter values using tag names from schema
    const rawParameters: Record<string, string> = {}
    if (schema instanceof z.ZodObject) {
      Object.keys(schema.shape).forEach(key => {
        const value = getTagContent(parametersXml, key)
        if (value) rawParameters[key] = value
      })
    }

    // Parse parameters using the provided schema
    const parameters = schema.parse({
      ...rawParameters,
      // Convert comma-separated strings to arrays for array fields with default empty arrays
      include_domains:
        rawParameters.include_domains
          ?.split(',')
          .map(d => d.trim())
          .filter(Boolean) ?? [],
      exclude_domains:
        rawParameters.exclude_domains
          ?.split(',')
          .map(d => d.trim())
          .filter(Boolean) ?? [],
      // Convert string to number for numeric fields
      max_results: rawParameters.max_results
        ? parseInt(rawParameters.max_results, 10)
        : undefined
    })

    return { tool, parameters }
  } catch (error) {
    console.error('Failed to parse parameters:', error)
    return { tool }
  }
}
