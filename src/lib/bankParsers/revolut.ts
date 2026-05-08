import Papa from 'papaparse';
import { ParsedBankRow } from './index';

interface RevolutParseResult {
  rows: ParsedBankRow[];
  errors: string[];
}

/**
 * Revolut CSV: Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
 */
export function parseRevolutCsv(text: string): RevolutParseResult {
  const errors: string[] = [];
  const rows: ParsedBankRow[] = [];

  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    errors.push(`Erro CSV: ${result.errors[0].message}`);
  }

  (result.data as any[]).forEach((row, idx) => {
    const state = (row['State'] || '').toUpperCase();
    if (state && state !== 'COMPLETED') return; // skip pending/reverted

    const dateRaw = row['Started Date'] || row['Completed Date'] || '';
    const date = parseDate(dateRaw);
    if (!date) { errors.push(`Linha ${idx + 2}: data inválida`); return; }

    const amount = parseFloat(String(row['Amount'] || '').replace(',', '.'));
    const fee = parseFloat(String(row['Fee'] || '0').replace(',', '.')) || 0;
    if (isNaN(amount)) { errors.push(`Linha ${idx + 2}: valor inválido`); return; }

    const total = amount - (fee > 0 ? fee : 0);
    const description = row['Description'] || '';
    const rawType = row['Type'] || '';

    rows.push({
      date,
      amount: total,
      description,
      rawType,
      bankSource: 'revolut',
      externalRef: `${rawType}|${description}`,
    });
  });

  return { rows, errors };
}

function parseDate(s: string): string | null {
  // "2026-04-01 3:18:20" or "2026-04-01"
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
