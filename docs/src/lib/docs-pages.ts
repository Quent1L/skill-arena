/**
 * The Markdown pages under src/pages/docs/ are real routes using the `layout:`
 * frontmatter pattern, not a content collection — `getCollection` cannot see
 * them. This reads them off the filesystem instead, for the consumers that need
 * the documentation as data rather than as rendered pages (llms.txt).
 *
 * Two globs: the eager one carries `frontmatter` and the built `url`, the `?raw`
 * one carries the source body, and they are joined on the module path.
 */
const modules = import.meta.glob<{
  frontmatter: { title: string; description?: string }
  url?: string
}>('../pages/docs/*.md', { eager: true })

const sources = import.meta.glob<string>('../pages/docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export interface DocsPage {
  title: string
  description: string
  path: string
  body: string
}

/** Strip the leading `---\n…\n---` frontmatter block from a raw Markdown file. */
function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim()
}

/** Route path for a docs module, e.g. `../pages/docs/mmr.md` -> `/docs/mmr`. */
function routeFor(modulePath: string): string {
  const slug = modulePath.replace(/^.*\/pages\/docs\//, '').replace(/\.md$/, '')
  return slug === 'index' ? '/docs' : `/docs/${slug}`
}

/**
 * Docs pages, overview first then alphabetical — the sidebar in DocsLayout is a
 * hand-ordered array and duplicating it here would be a second thing to update.
 */
export function getDocsPages(): DocsPage[] {
  return Object.entries(modules)
    .map(([modulePath, mod]) => ({
      title: mod.frontmatter.title,
      description: mod.frontmatter.description ?? '',
      path: routeFor(modulePath),
      body: stripFrontmatter(sources[modulePath] ?? ''),
    }))
    .sort((a, b) => {
      if (a.path === '/docs') return -1
      if (b.path === '/docs') return 1
      return a.path.localeCompare(b.path)
    })
}
