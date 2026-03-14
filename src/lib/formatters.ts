export type DateFormatType = 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: string | Date, format: DateFormatType = 'DD/MM/YYYY'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  switch (format) {
    case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
    case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
    case 'DD/MM/YYYY':
    default: return `${day}/${month}/${year}`;
  }
}

export function formatDateShort(date: string | Date, format: DateFormatType = 'DD/MM/YYYY'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  switch (format) {
    case 'YYYY-MM-DD': return `${month}-${day}`;
    case 'MM/DD/YYYY': return `${month}/${day}`;
    case 'DD/MM/YYYY':
    default: return `${day}/${month}`;
  }
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatMonth(month: number, year: number): string {
  const d = new Date(year, month - 1);
  return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
}

export function getMonthName(month: number): string {
  const d = new Date(2024, month - 1);
  return d.toLocaleDateString('pt-PT', { month: 'short' });
}

/**
 * Parse a date string according to the given format.
 * Falls back to ISO parsing if format-specific parsing fails.
 */
export function parseDateByFormat(dateStr: string, format: DateFormatType = 'DD/MM/YYYY'): Date | null {
  const parts = dateStr.trim().split(/[\/\-\.]/);
  if (parts.length === 3) {
    let day: number, month: number, year: number;
    switch (format) {
      case 'YYYY-MM-DD':
        year = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        day = parseInt(parts[2]);
        break;
      case 'MM/DD/YYYY':
        month = parseInt(parts[0]) - 1;
        day = parseInt(parts[1]);
        year = parseInt(parts[2]);
        break;
      case 'DD/MM/YYYY':
      default:
        day = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        year = parseInt(parts[2]);
        break;
    }
    if (year > 100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime()) && d.getDate() === day) return d;
    }
  }
  // Fallback: try ISO
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

/** @deprecated Use parseDateByFormat instead */
export function parsePTDate(dateStr: string): Date | null {
  return parseDateByFormat(dateStr, 'DD/MM/YYYY');
}

export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}
