const pad = (n: number) => String(n).padStart(2, '0');

export const Format = {
  clp: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }),
  money(value: number) { return this.clp.format(value); },
  isoDate(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; },
  monthKey(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`; },
  parseMonth(key: string) { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1); },
  parseDate(iso: string) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); },
  monthLong(key: string) {
    return this.parseMonth(key).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
  },
  monthName(key: string) { return this.parseMonth(key).toLocaleDateString('es-CL', { month: 'long' }); },
  monthShort(key: string) {
    return this.parseMonth(key).toLocaleDateString('es-CL', { month: 'short' }).replace('.', '');
  },
  dayMonth(iso: string) {
    return this.parseDate(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');
  },
  capital(text: string) { return text.charAt(0).toUpperCase() + text.slice(1); },
  compact(value: number) { return value >= 1000 ? `$${Math.round(value / 1000)} mil` : this.money(value); },
};

export const lastMonths = (count: number, from = new Date()): string[] =>
  Array.from({ length: count }, (_, i) =>
    Format.monthKey(new Date(from.getFullYear(), from.getMonth() - (count - 1 - i), 1)));

export function getMonthDateRange(month: string) {
  const first = Format.parseMonth(month);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const today = new Date();
  return { min: Format.isoDate(first), max: Format.isoDate(last < today ? last : today) };
}
