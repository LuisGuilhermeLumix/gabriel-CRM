import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam variáveis de ambiente do Supabase. Verifique o .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Supabase corta qualquer SELECT em 1000 linhas. Para somar/agrupar é preciso
// paginar com .range() até acabar. `build` deve devolver uma query NOVA a cada
// chamada (o builder não é reutilizável). A ordenação por id é fixada aqui para
// a paginação ser estável.
export const PAGE_SIZE = 1000

export async function fetchAllRows<T = any>(
  build: () => any,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await build()
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    const chunk = (data ?? []) as T[]
    rows.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }
  return rows
}
