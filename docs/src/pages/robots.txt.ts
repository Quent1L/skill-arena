import type { APIRoute } from 'astro'
import { canonicalUrl } from '../lib/site'

/**
 * An endpoint rather than a file in public/, so the Sitemap line is derived from
 * `site` in astro.config.mjs and cannot drift out of sync with it.
 *
 * The AI crawlers are listed explicitly even though `User-agent: *` already
 * allows them. Being explicit is the point: it is an unambiguous statement that
 * the documentation may be read and cited by generative engines, and it survives
 * a host that ships a restrictive default.
 */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Bingbot',
  'CCBot',
  'Meta-ExternalAgent',
  'DuckAssistBot',
]

export const GET: APIRoute = ({ site }) => {
  const agents = ['*', ...AI_CRAWLERS].map((agent) => `User-agent: ${agent}\nAllow: /`).join('\n\n')

  const body = `${agents}

# A curated index of this site in Markdown, for language models.
# ${canonicalUrl('/llms.txt', site)}
# ${canonicalUrl('/llms-full.txt', site)}

Sitemap: ${canonicalUrl('/sitemap-index.xml', site)}
`

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
