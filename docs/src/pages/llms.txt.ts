import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { SITE, canonicalUrl } from '../lib/site'
import { getDocsPages } from '../lib/docs-pages'
import { getPosts } from '../lib/posts'

/**
 * The llmstxt.org index: a curated, link-only map of the site in Markdown, so a
 * model answering a question about Skol Arena can find the right page in one
 * fetch instead of crawling HTML. Generated entirely from existing frontmatter —
 * nothing here is written twice.
 */
export const GET: APIRoute = async ({ site }) => {
  const url = (path: string) => canonicalUrl(path, site)

  const docs = getDocsPages()

  // Showcase entries are page *fragments* pulled into /features — they have no
  // routes of their own, so they are listed as anchors on that page.
  const features = (await getCollection('showcase', ({ id }) => id.startsWith('features/'))).sort(
    (a, b) => a.data.order - b.data.order,
  )
  const modes = (await getCollection('showcase', ({ id }) => id.startsWith('modes/'))).sort(
    (a, b) => a.data.order - b.data.order,
  )
  const posts = await getPosts()

  const line = (title: string, href: string, note?: string) =>
    `- [${title}](${href})${note ? `: ${note}` : ''}`

  const body = `# ${SITE.name}

> ${SITE.description}

${SITE.name} ("${SITE.tagline}") is AGPL-3.0 licensed and self-hosted from a single Docker
image containing the API, the frontend and automatic database migrations; it needs only a
PostgreSQL database. It offers three independent competition modes — championship leagues,
elimination brackets, and ranked ladders with per-discipline MMR — and is built around
players reporting their own matches, with configurable validation per tournament.

- Source: ${SITE.repo}
- Container image: ${SITE.docker}
- Full documentation as one file: ${url('/llms-full.txt')}

## Documentation

${docs.map((page) => line(page.title, url(page.path), page.description)).join('\n')}

## Competition modes

${modes.map((mode) => line(mode.data.title, `${url('/features')}#${mode.id.split('/').pop()}`, mode.data.tagline)).join('\n')}

## Features

${features.map((feature) => line(feature.data.title, `${url('/features')}#${feature.id.split('/').pop()}`, feature.data.summary)).join('\n')}

## Blog

${posts.map((post) => line(post.data.title, url(`/blog/${post.id}`), post.data.description)).join('\n')}

## Other pages

${line('Home', url('/'), 'Overview of the three modes, screenshots, and FAQ')}
${line('Features', url('/features'), 'Every feature, grouped by the mode it belongs to')}
${line('About', url('/about'), 'Why Skol Arena exists, who it is for, and what it is built with')}
`

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
