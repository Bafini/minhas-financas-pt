import Papa from 'papaparse';
import { parseDateByFormat, toISODate } from '@/lib/formatters';
import { ParsedBankRow } from './index';

/**
 * Manual generic format: data,categoria,subcategoria,valor,notas
 * Kept for backward compatibility with previous import format.
 */
export function parseGenericCsv(text: string): { rows: ParsedBankRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: ParsedBankRow[] = [];
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });

  (result.data as any[]).forEach((r, idx) => {
    const date = parseDateByFormat(r.data, 'DD/MM/YYYY');
    const amount = parseFloat(String(r.valor || '').replace(',', '.').replace(/[^\d.\-]/g, ''));
    if (!date || isNaN(amount)) { errors.push(`Linha ${idx + 2}: dados inválidos`); return; }
    const description = r.notas || `${r.categoria || ''} ${r.subcategoria || ''}`.trim();
    rows.push({
      date: toISODate(date),
      amount,
      description,
      bankSource: 'manual',
      externalRef: description,
    });
  });
  return { rows, errors };
}
