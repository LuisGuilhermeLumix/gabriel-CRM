import { useEffect, useState } from 'react'
import { supabase, fetchAllRows } from '@/lib/supabase'
import { useFilters } from './useFilters'
import {
  startOfDayUTC,
  endOfDayUTC,
  utcToLocalDateStr,
  getDaysInRange,
} from '@/lib/dates'

const TABLE = 'gabriel_info_eua_CRM'

export interface ChartPoint {
  date: string
  sms: number
  email: number
  smsValue: number
  emailValue: number
}

function parseDollar(val: any): number {
  if (val === null || val === undefined || val === '') return 0
  const n = parseFloat(String(val).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}

export function useChartData() {
  const { dateFrom, dateTo, product, channel } = useFilters()
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const from = startOfDayUTC(dateFrom)
        const to = endOfDayUTC(dateTo)

        // Vendas recuperadas (order_paid via SMS/EMAIL), paginado para não
        // cortar em 1000 linhas. Os dois fluxos (carrinho + cartão) entram.
        const rows = await fetchAllRows<any>(() => {
          let q = supabase
            .from(TABLE)
            .select('id, created_at, utm_source, "($)"')
            .gte('created_at', from)
            .lte('created_at', to)
            .eq('Event', 'order_paid')
            .in('utm_source', ['SMS', 'EMAIL'])

          if (channel === 'SMS') q = q.eq('utm_source', 'SMS')
          if (channel === 'Email') q = q.eq('utm_source', 'EMAIL')
          if (product && product !== 'Todos') q = q.eq('product', product)
          return q
        })

        const map: Record<string, { sms: number; email: number; smsValue: number; emailValue: number }> = {}

        // Pré-popula todos os dias do período com zero para não sumir do gráfico
        for (const day of getDaysInRange(dateFrom, dateTo)) {
          map[day] = { sms: 0, email: 0, smsValue: 0, emailValue: 0 }
        }

        rows.forEach((r) => {
          const day = utcToLocalDateStr(String(r.created_at))
          if (!map[day]) map[day] = { sms: 0, email: 0, smsValue: 0, emailValue: 0 }
          if (r.utm_source === 'SMS') {
            map[day].sms++
            map[day].smsValue += parseDollar(r['($)'])
          }
          if (r.utm_source === 'EMAIL') {
            map[day].email++
            map[day].emailValue += parseDollar(r['($)'])
          }
        })

        const points: ChartPoint[] = Object.entries(map)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, vals]) => ({ date, ...vals }))

        setData(points)
      } catch {
        setData([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [dateFrom, dateTo, product, channel])

  return { data, loading }
}
