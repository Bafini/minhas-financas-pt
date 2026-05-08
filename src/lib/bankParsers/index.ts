import { parseCgdCsv } from './cgd';
import { parseRevolutCsv } from './revolut';
import { parseGenericCsv } from './generic';
import { parseWizinkXls } from './wizink';

export type BankSource = 'cgd' | 'revolut' | 'wizink' | 'manual';

export interface ParsedBankRow {
  date: string;          // ISO YYYY-MM-DD
  amount: number;        // signed, negative = expense
  description: string;   // raw description
  rawType?: string;      // bank's own type (Card Payment, Transfer...)
  bankSource: BankSource;
  externalRef: string;   // stable identifier for dedup (usually description)
}

export interface ParseResult {
  rows: ParsedBankRow[];
  bankSource: BankSource;
  errors: string[];
}

export async function parseBankFile(
  file: File,
  bankSource: BankSource | 'auto'
): Promise<ParseResult> {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const isSpreadsheet = ext === 'xls' || ext === 'xlsx';

  // Wizink (XLS) — caminho binário
  if (bankSource === 'wizink' || (bankSource === 'auto' && isSpreadsheet)) {
    const buf = await file.arrayBuffer();
    return { ...parseWizinkXls(buf), bankSource: 'wizink' };
  }

  const text = await readFileText(file);
  const detected = bankSource === 'auto' ? detectBank(text) : bankSource;

  switch (detected) {
    case 'cgd': return { ...parseCgdCsv(text), bankSource: 'cgd' };
    case 'revolut': return { ...parseRevolutCsv(text), bankSource: 'revolut' };
    case 'manual': return { ...parseGenericCsv(text), bankSource: 'manual' };
    default:
      return { rows: [], bankSource: detected, errors: ['Formato não reconhecido'] };
  }
}

function detectBank(text: string): BankSource {
  const head = text.slice(0, 500).toLowerCase();
  if (head.includes('type,product,started date') || head.includes('completed date')) return 'revolut';
  if (head.includes('consultar saldos') || head.includes('data mov') || head.includes('saldo contabil')) return 'cgd';
  if (head.startsWith('data,categoria') || head.includes('data,categoria,subcategoria')) return 'manual';
  return 'manual';
}

async function readFileText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  const replCount = (utf8.match(/\uFFFD/g) || []).length;
  if (replCount > 5) {
    return new TextDecoder('iso-8859-1').decode(buf);
  }
  return utf8;
}
