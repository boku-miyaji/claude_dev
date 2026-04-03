import { marked } from 'marked'

/**
 * Render markdown to sanitized HTML string.
 * Strips script tags and event handlers for safety.
 */
export function renderMarkdownSafe(md: string): string {
  const html = marked.parse(md, { async: false }) as string
  // Basic sanitization: strip script tags and on* handlers
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
}
