import * as XLSX from 'xlsx';
import { ParsedBankRow } from './index';

interface WizinkParseResult {
  rows: ParsedBankRow[];
  errors: string[];
}

/**
 * Wizink XLS format (cartão de crédito):
 * Columns: Data da transação | Número do cartão | Descrição da transação | Cidade | Montante transação (€) | Montante original
 * Datas: DD/MM/YYYY
 * Sinais: positivo = compra (despesa), negativo = pagamento/crédito.
 * Convenção interna do app: invertemos o sinal (despesa fica negativa).
 */
export function parseWizinkXls(buffer: ArrayBuffer): WizinkParseResult {
  const errors: string[] = [];
  const rows: ParsedBankRow[] = [];

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  } catch (e: any) {
    return { rows: [], errors: [`Erro ao ler XLS: ${e?.message || e}`] };
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: ['Ficheiro sem folhas'] };
  const sheet = wb.Sheets[sheetName];
  const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  // Localiza linha de cabeçalho
  const norm = (s: any) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  let headerIdx = -1;
  let colDate = -1, colCard = -1, colDesc = -1, colCity = -1, colAmount = -1;
  for (let i = 0; i < Math.min(matrix.length, 20); i++) {
    const r = matrix[i].map(norm);
    const idxDate = r.findIndex(c => c.includes('data da transacao') || c === 'data');
    const idxAmt = r.findIndex(c => c.includes('montante transacao') || c.startsWith('montante'));
    if (idxDate >= 0 && idxAmt >= 0) {
      headerIdx = i;
      colDate = idxDate;
      colAmount = idxAmt;
      colCard = r.findIndex(c => c.includes('numero do cartao') || c.includes('cartao'));
      colDesc = r.findIndex(c => c.includes('descricao'));
      colCity = r.findIndex(c => c === 'cidade' || c.includes('cidade'));
      break;
    }
  }

  if (headerIdx === -1) {
    return { rows: [], errors: ['Cabeçalho Wizink não encontrado'] };
  }

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.every(c => String(c || '').trim() === '')) continue;

    const dateStr = String(row[colDate] || '').trim();
    const date = parseDate(dateStr);
    if (!date) continue; // ignora linhas de totais/rodapé

    const rawAmount = parseAmount(row[colAmount]);
    if (rawAmount === null) {
      errors.push(`Linha ${i + 1}: valor inválido`);
      continue;
    }

    const desc = String(row[colDesc] ?? '').trim();
    const city = colCity >= 0 ? String(row[colCity] ?? '').trim() : '';
    const description = city && !desc.toLowerCase().includes(city.toLowerCase())
      ? `${desc} ${city}`.trim()
      : desc;

    // Inverter sinal: positivo no extracto = despesa => negativo internamente
    const amount = -rawAmount;

    rows.push({
      date,
      amount,
      description,
      rawType: undefined,
      bankSource: 'wizink',
      externalRef: description,
    });
  }

  return { rows, errors };
}

function parseDate(s: string): string | null {
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseAmount(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  if (!s) return null;
  // Remove separador de milhares (vírgula no formato 1,136.48 ou ponto no formato 1.136,48)
  // Heurística: se tem vírgula como decimal (último separador é vírgula com 1-2 dígitos)
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  s = s.replace(/[^\d.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
