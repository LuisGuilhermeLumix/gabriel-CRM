import { useEffect, useState } from 'react'
import { supabase, fetchAllRows } from '@/lib/supabase'
import { useFilters } from './useFilters'
import { calcComissaoLumix } from '@/lib/metrics'
import { startOfDayUTC, endOfDayUTC } from '@/lib/dates'

const TABLE = 'gabriel_info_eua_CRM'

// Eventos de disparo: prefixo = fluxo, sufixo = canal.
//   abandoned_cart_01_SMS, abandoned_cart_02_EMAIL, ...  → carrinho abandonado
//   refused_card_01_SMS, ...                             → cartão recusado
// Vendas recuperadas: Event = 'order_paid' + utm_source SMS/EMAIL; o fluxo vem
// de recovery_type ('abandoned_cart' | 'refused_card'; NULL = abandoned_cart).
const FLOW_PREFIX = { cart: 'abandoned_cart', card: 'refused_card' } as const
const CHANNEL_SUFFIX = { sms: 'SMS', email: 'EMAIL' } as const

type Flow = keyof typeof FLOW_PREFIX
type Ch = keyof typeof CHANNEL_SUFFIX

function parseDollar(val: any): number {
  if (val === null || val === undefined || val === '') return 0
  const n = parseFloat(String(val).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}

/** Métrica de recuperação quebrada por canal (sms/email) e por fluxo (cart/card). */
export interface RecoveryMetric {
  total: number
  sms: number
  email: number
  cart: number
  card: number
}

export interface DashboardMetrics {
  carrinhosAbandonados: number
  cartoesRecusados: number
  disparosFeitos: RecoveryMetric
  vendasRecuperadas: RecoveryMetric
  taxaConversao: RecoveryMetric
  ticketMedio: RecoveryMetric
  receitaRecuperada: RecoveryMetric
  faturamentoFront: number
  comissaoLumix: number
  faturamentoSobFrontPct: number
}

const zeroMetric: RecoveryMetric = { total: 0, sms: 0, email: 0, cart: 0, card: 0 }

const zero: DashboardMetrics = {
  carrinhosAbandonados: 0,
  cartoesRecusados: 0,
  disparosFeitos: zeroMetric,
  vendasRecuperadas: zeroMetric,
  taxaConversao: zeroMetric,
  ticketMedio: zeroMetric,
  receitaRecuperada: zeroMetric,
  faturamentoFront: 0,
  comissaoLumix: 0,
  faturamentoSobFrontPct: 0,
}

function ratio(num: number, den: number, mult = 1): number {
  return den > 0 ? (num / den) * mult : 0
}

export function useMetrics() {
  const { dateFrom, dateTo, channel, product } = useFilters()
  const [metrics, setMetrics] = useState<DashboardMetrics>(zero)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const from = startOfDayUTC(dateFrom)
        const to = endOfDayUTC(dateTo)
        const productFilter = product && product !== 'Todos' ? product : null

        const base = (select: string, opts?: any) => {
          let q = supabase
            .from(TABLE)
            .select(select, opts)
            .gte('created_at', from)
            .lte('created_at', to)
          if (productFilter) q = q.eq('product', productFilter)
          return q
        }

        const countWhere = (apply: (q: any) => any) =>
          apply(base('id', { count: 'exact', head: true }))

        const includeSms = channel !== 'Email'
        const includeEmail = channel !== 'SMS'
        const noCount = Promise.resolve({ count: 0, error: null as any })

        // Contagem de disparos por fluxo × canal. Prefixo identifica o fluxo e
        // sufixo o canal, então refused_card_* nunca cai em carrinho.
        const disparosCount = (flow: Flow, ch: Ch) =>
          (ch === 'sms' ? includeSms : includeEmail)
            ? countWhere((q) => q.like('Event', `${FLOW_PREFIX[flow]}%${CHANNEL_SUFFIX[ch]}`))
            : noCount

        // "Carrinhos Abandonados" e "Cartões Recusados" ignoram o filtro de
        // canal (1º disparo do fluxo = 1 lead).
        const cartPromise = countWhere((q) => q.eq('Event', 'abandoned_cart_01_SMS'))
        const cardPromise = countWhere((q) => q.eq('Event', 'refused_card_01_SMS'))

        const salesPromise = fetchAllRows<any>(() =>
          base('"($)", utm_source, recovery_type')
            .eq('Event', 'order_paid')
            .in('utm_source', ['SMS', 'EMAIL']),
        )

        const frontPromise = fetchAllRows<any>(() =>
          base('"($)"').eq('Event', 'order_paid').eq('utm_source', 'FRONT'),
        )

        const cfgPromise = supabase
          .from('crm_config')
          .select('total_revenue_usd, sms_cost_usd, email_cost_usd')
          .eq('id', 1)
          .maybeSingle()

        const [
          cartRes,
          cardRes,
          cartSmsRes,
          cartEmailRes,
          cardSmsRes,
          cardEmailRes,
          allSales,
          frontSales,
          cfgRes,
        ] = await Promise.all([
          cartPromise,
          cardPromise,
          disparosCount('cart', 'sms'),
          disparosCount('cart', 'email'),
          disparosCount('card', 'sms'),
          disparosCount('card', 'email'),
          salesPromise,
          frontPromise,
          cfgPromise,
        ])

        for (const r of [cartRes, cardRes, cartSmsRes, cartEmailRes, cardSmsRes, cardEmailRes]) {
          if ((r as any).error) throw (r as any).error
        }
        if (cancelled) return

        const count = (r: any) => r.count ?? 0

        // ---- Disparos -------------------------------------------------------
        const dis = {
          cartSms: count(cartSmsRes),
          cartEmail: count(cartEmailRes),
          cardSms: count(cardSmsRes),
          cardEmail: count(cardEmailRes),
        }
        const disparos: RecoveryMetric = {
          total: dis.cartSms + dis.cartEmail + dis.cardSms + dis.cardEmail,
          sms: dis.cartSms + dis.cardSms,
          email: dis.cartEmail + dis.cardEmail,
          cart: dis.cartSms + dis.cartEmail,
          card: dis.cardSms + dis.cardEmail,
        }

        // ---- Vendas recuperadas --------------------------------------------
        const sales = allSales
          .filter((r) => (r.utm_source === 'SMS' ? includeSms : includeEmail))
          .map((r) => ({
            value: parseDollar(r['($)']),
            isSms: r.utm_source === 'SMS',
            isCard: r.recovery_type === 'refused_card', // NULL → carrinho
          }))

        const sum = (rows: { value: number }[]) => rows.reduce((a, r) => a + r.value, 0)
        const smsSales = sales.filter((r) => r.isSms)
        const emailSales = sales.filter((r) => !r.isSms)
        const cartSales = sales.filter((r) => !r.isCard)
        const cardSales = sales.filter((r) => r.isCard)

        const vendas: RecoveryMetric = {
          total: sales.length,
          sms: smsSales.length,
          email: emailSales.length,
          cart: cartSales.length,
          card: cardSales.length,
        }
        const receita: RecoveryMetric = {
          total: sum(sales),
          sms: sum(smsSales),
          email: sum(emailSales),
          cart: sum(cartSales),
          card: sum(cardSales),
        }
        const ticket: RecoveryMetric = {
          total: ratio(receita.total, vendas.total),
          sms: ratio(receita.sms, vendas.sms),
          email: ratio(receita.email, vendas.email),
          cart: ratio(receita.cart, vendas.cart),
          card: ratio(receita.card, vendas.card),
        }
        const taxa: RecoveryMetric = {
          total: ratio(vendas.total, disparos.total, 100),
          sms: ratio(vendas.sms, disparos.sms, 100),
          email: ratio(vendas.email, disparos.email, 100),
          cart: ratio(vendas.cart, disparos.cart, 100),
          card: ratio(vendas.card, disparos.card, 100),
        }

        // Comissão: 25% sobre o total recuperado (os dois fluxos).
        const comissao = calcComissaoLumix(receita.total)

        // Faturamento total do front (orgânico). Não sofre filtro de canal —
        // FRONT não é SMS nem Email.
        const frontTotal = frontSales.reduce((acc, r) => acc + parseDollar(r['($)']), 0)

        const cfg = (cfgRes as any).data
        const totalRevenueCfg = parseDollar(cfg?.total_revenue_usd)
        const smsCost = parseDollar(cfg?.sms_cost_usd)
        const emailCost = parseDollar(cfg?.email_cost_usd)

        let faturamentoPct = 0
        if (totalRevenueCfg > 0) {
          faturamentoPct = ((receita.total - smsCost - emailCost) / totalRevenueCfg) * 100
        } else {
          faturamentoPct = ratio(receita.total, frontTotal, 100)
        }

        setMetrics({
          carrinhosAbandonados: count(cartRes),
          cartoesRecusados: count(cardRes),
          disparosFeitos: disparos,
          vendasRecuperadas: vendas,
          taxaConversao: taxa,
          ticketMedio: ticket,
          receitaRecuperada: receita,
          faturamentoFront: frontTotal,
          comissaoLumix: comissao,
          faturamentoSobFrontPct: faturamentoPct,
        })
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? 'Erro ao buscar dados')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, channel, product])

  return { metrics, loading, error }
}
