// Extrai data local no formato YYYY-MM-DD usando Intl (confiável em qualquer timezone)
function getLocalDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA').format(date) // en-CA = YYYY-MM-DD
}

// Converte timestamp UTC do Supabase para data LOCAL do usuário (YYYY-MM-DD)
export function utcToLocalDateStr(utcStr: string): string {
  const date = new Date(utcStr)
  return getLocalDateStr(date)
}

// Data local de hoje (YYYY-MM-DD)
export function todayStr(): string {
  return getLocalDateStr(new Date())
}

// Data local N dias atrás (YYYY-MM-DD)
export function daysAgoStr(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return getLocalDateStr(d)
}

// Primeiro dia do mês atual (YYYY-MM-DD)
export function firstOfMonthStr(): string {
  const d = new Date()
  d.setDate(1)
  return getLocalDateStr(d)
}

// Converte YYYY-MM-DD para ISO UTC início do dia LOCAL (para query Supabase)
export function startOfDayUTC(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString() // sem Z = local time
}

// Converte YYYY-MM-DD para ISO UTC fim do dia LOCAL (para query Supabase)
export function endOfDayUTC(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999`).toISOString() // sem Z = local time
}

// Gera todos os dias do período (inclusive) no formato YYYY-MM-DD
export function getDaysInRange(fromStr: string, toStr: string): string[] {
  const days: string[] = []
  const cur = new Date(`${fromStr}T12:00:00`)
  const end = new Date(`${toStr}T12:00:00`)
  while (cur <= end) {
    days.push(getLocalDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}
