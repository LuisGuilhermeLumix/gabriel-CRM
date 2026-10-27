import { useEffect, useState } from 'react'
import { supabase, fetchAllRows } from '@/lib/supabase'
import { useFilters } from './useFilters'
import { startOfDayUTC, endOfDayUTC } from '@/lib/dates'

const TABLE = 'gabriel_info_eua_CRM'

export type LeadStatus = 'Recuperado' | 'Disparado' | 'Pendente' | 'Cartão Recusado'

export interface LeadRow {
  id: string
  date: string
  name: string
  email: string
  product: string
  channel: 'SMS' | 'Email'
  recoveredValue: number
  status: LeadStatus
}

const PER_PAGE = 20
const SELECT = 'id, created_at, name, email, product, utm_source, "Event", "($)"'

function parseDollar(val: any): number {
  if (val === null || val === undefined || val === '') return 0
  const n = parseFloat(String(val).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}

// Canal de um disparo vem do sufixo do Event (_SMS / _EMAIL)
function channelFromEvent(event: string): 'SMS' | 'Email' {
  return /_EMAIL$/i.test(event) ? 'Email' : 'SMS'
}

export function useLeads(tab: 'Todos' | 'SMS' | 'Email', search: string, page: number) {
  const { dateFrom, dateTo, product } = useFilters()
  const [rows, setRows] = useState<LeadRow[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const from = startOfDayUTC(dateFrom)
        const to = endOfDayUTC(dateTo)

        const base = () => {
          let q = supabase
            .from(TABLE)
            .select(SELECT)
            .gte('created_at', from)
            .lte('created_at', to)
          if (product && product !== 'Todos') q = q.eq('product', product)
          if (search) q = q.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
          return q
        }

        // Vendas recuperadas (order_paid via SMS/EMAIL)
        const salesPromise = fetchAllRows<any>(() => {
          let q = base().eq('Event', 'order_paid').in('utm_source', ['SMS', 'EMAIL'])
          if (tab === 'SMS') q = q.eq('utm_source', 'SMS')
          if (tab === 'Email') q = q.eq('utm_source', 'EMAIL')
          return q
        })

        // Disparos de cartão recusado (Event refused_card_*). Hoje só existe
        // SMS, então a aba Email não os inclui.
        const refusedPromise =
          tab === 'Email'
            ? Promise.resolve([] as any[])
            : fetchAllRows<any>(() => {
                let q = base().like('Event', 'refused_card%')
                if (tab === 'SMS') q = q.like('Event', '%SMS')
                return q
              })

        const [sales, refused] = await Promise.all([salesPromise, refusedPromise])
        if (cancelled) return

        const all: LeadRow[] = [
          ...sales.map((r) => ({
            id: String(r.id),
            date: String(r.created_at),
            name: r.name ?? '—',
            email: r.email ?? '—',
            product: r.product ?? '—',
            channel: (r.utm_source === 'SMS' ? 'SMS' : 'Email') as 'SMS' | 'Email',
            recoveredValue: parseDollar(r['($)']),
            status: 'Recuperado' as LeadStatus,
          })),
          ...refused.map((r) => ({
            id: String(r.id),
            date: String(r.created_at),
            name: r.name ?? '—',
            email: r.email ?? '—',
            product: r.product ?? '—',
            channel: channelFromEvent(String(r.Event ?? '')),
            recoveredValue: 0,
            status: 'Cartão Recusado' as LeadStatus,
          })),
        ].sort((a, b) => b.date.localeCompare(a.date))

        setTotalPages(Math.max(1, Math.ceil(all.length / PER_PAGE)))
        setRows(all.slice((page - 1) * PER_PAGE, page * PER_PAGE))
      } catch (e) {
        console.error(e)
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, tab, search, page, product])

  return { rows, totalPages, loading }
}
