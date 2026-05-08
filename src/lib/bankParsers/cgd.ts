import { ParsedBankRow } from './index';

interface CgdParseResult {
  rows: ParsedBankRow[];
  errors: string[];
}

/**
 * CGD CSV format:
 * - Separator: ';'
 * - Header rows before "Data mov.;Data valor;Descrição;Débito;Crédito;..."
 * - Date format: DD-MM-YYYY
 * - Amounts use comma as decimal
 */
export function parseCgdCsv(text: string): CgdParseResult {
  const errors: string[] = [];
  const rows: ParsedBankRow[] = [];
  const lines = text.split(/\r?\n/);

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/data\s*mov/i.test(lines[i]) && lines[i].includes(';')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return { rows: [], errors: ['Cabeçalho CGD não encontrado'] };
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(';').map(s => s.trim());
    if (cols.length < 5) continue;

    const dateStr = cols[0];
    const description = cols[2] || '';
    const debit = parseAmount(cols[3]);
    const credit = parseAmount(cols[4]);

    const date = parseDate(dateStr);
    if (!date) { errors.push(`Linha ${i + 1}: data inválida (${dateStr})`); continue; }

    let amount = 0;
    if (credit && credit > 0) amount = credit;
    else if (debit && debit > 0) amount = -debit;
    else { errors.push(`Linha ${i + 1}: sem valor`); continue; }

    rows.push({
      date,
      amount,
      description,
      rawType: cols[7] || undefined,
      bankSource: 'cgd',
      externalRef: description,
    });
  }

  return { rows, errors };
}

function parseDate(s: string): string | null {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseAmount(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}
