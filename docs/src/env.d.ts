/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Pagefind's runtime is generated into dist/ by `astro build`, so it does not exist
// on disk at type-check time. Declare the slice of its API that SearchDialog uses.
declare module '*/pagefind/pagefind.js' {
  export interface PagefindSubResult {
    title: string
    url: string
    excerpt: string
  }

  export interface PagefindData {
    url: string
    meta: { title?: string }
    excerpt: string
    sub_results: PagefindSubResult[]
  }

  export interface PagefindResult {
    id: string
    data: () => Promise<PagefindData>
  }

  export function init(): Promise<void>
  export function debouncedSearch(
    query: string,
    options?: unknown,
    debounceMs?: number,
  ): Promise<{ results: PagefindResult[] } | null>
}
