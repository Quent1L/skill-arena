import type { CollectionEntry } from 'astro:content'
import { getCollection } from 'astro:content'

/**
 * Blog posts, newest first. Drafts are visible while developing and dropped from
 * the build, so an unfinished post can be previewed without shipping it.
 */
export async function getPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft)
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
