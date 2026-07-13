/**
 * Minimal defense-in-depth sanitiser applied to rich-text HTML before it is
 * stored. Tiptap's schema already restricts output to a safe tag subset; this
 * strips anything dangerous that could arrive via a crafted paste.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, "")
    .replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, "")
    .replace(/\s on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "");
}
