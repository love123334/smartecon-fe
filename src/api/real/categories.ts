import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'
import type { SpringPage } from '@/api/real/products'

export interface Category {
  id: string
  name: string
  slug: string
}

interface BackendCategory {
  id: number
  name: string
  slug: string
}

let cache: Category[] | null = null

function mapCategory(c: BackendCategory): Category {
  return { id: String(c.id), name: c.name, slug: c.slug }
}

export async function listCategories(force = false): Promise<Category[]> {
  if (cache && !force) return cache
  const page = await http.get<SpringPage<BackendCategory>>(
    `${apiPaths.categories.list}?page=0&size=100`,
  )
  cache = page.content.map(mapCategory)
  return cache
}

export async function createCategory(name: string, parentId?: number): Promise<Category> {
  const data = await http.post<BackendCategory>(apiPaths.categories.list, {
    name: name.trim(),
    parentId: parentId ?? null,
  })
  cache = null
  return mapCategory(data)
}

export async function categoryNames(): Promise<string[]> {
  const cats = await listCategories()
  return [...new Set(cats.map((c) => c.name))].sort((a, b) => a.localeCompare(b, 'vi'))
}

export function resolveCategoryId(
  categories: Category[],
  nameOrSlug: string,
): number | undefined {
  const key = nameOrSlug.trim().toLowerCase()
  const hit = categories.find(
    (c) =>
      c.name.toLowerCase() === key || c.slug.toLowerCase() === key,
  )
  return hit ? Number(hit.id) : undefined
}
