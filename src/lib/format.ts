export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

// Converte "YYYY-MM-DD" em Date local (sem cair em UTC e voltar 1 dia)
function parseLocalDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(input);
}

export function formatDateShort(date: Date | string): string {
  const d = parseLocalDate(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export function formatDateLong(date: Date | string): string {
  const d = parseLocalDate(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
