import { useEffect, useState } from 'react'
import { supabase, fetchAllRows } from '@/lib/supabase'

export function useProducts() {
  const [products, setProducts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // Paginado: o Supabase corta em 1000 linhas por requisição, então um
        // .limit(5000) só traria os 1000 primeiros produtos.
        const data = await fetchAllRows<{ product: string | null }>(() =>
          supabase.from('gabriel_info_eua_CRM').select('id, product').not('product', 'is', null),
        )
        if (cancelled) return

        const set = new Set<string>()
        data.forEach((r) => {
          if (r.product) set.add(r.product)
        })
        setProducts(Array.from(set).sort((a, b) => a.localeCompare(b)))
      } catch {
        if (!cancelled) setProducts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { products, loading }
}
