import { create } from 'zustand'
import { todayStr, daysAgoStr, firstOfMonthStr } from '@/lib/dates'

export type Channel = 'Todos' | 'SMS' | 'Email'
export type RangeKey = 'hoje' | 'ontem' | '7d' | 'mes' | '90d' | 'custom'

interface FiltersState {
  dateFrom: string
  dateTo: string
  channel: Channel
  product: string
  activeRange: RangeKey
  setChannel: (v: Channel) => void
  setProduct: (v: string) => void
  setRange: (key: Exclude<RangeKey, 'custom'>) => void
  applyCustom: (from: string, to: string) => void
}

export const useFilters = create<FiltersState>((set) => ({
  dateFrom: firstOfMonthStr(),
  dateTo: todayStr(),
  channel: 'Todos',
  product: 'Todos',
  activeRange: 'mes',

  setChannel: (v) => set({ channel: v }),
  setProduct: (v) => set({ product: v }),

  applyCustom: (from, to) =>
    set({
      dateFrom: from,
      dateTo: to,
      activeRange: 'custom',
    }),

  setRange: (key) => {
    let from: string
    let to: string = todayStr()

    if (key === 'hoje') {
      from = todayStr()
    } else if (key === 'ontem') {
      from = daysAgoStr(1)
      to = daysAgoStr(1)
    } else if (key === '7d') {
      from = daysAgoStr(6)
    } else if (key === '90d') {
      from = daysAgoStr(89)
    } else {
      from = firstOfMonthStr() // 'mes'
    }

    set({ dateFrom: from, dateTo: to, activeRange: key })
  },
}))
