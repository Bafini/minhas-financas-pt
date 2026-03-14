export type MacroGroup = 'Rendimentos' | 'Investimentos' | 'Despesas';

export interface FinancialSummary {
  rendimentos: number;
  despesas: number;
  investimentos: number;
  saldoLiquido: number;
  poupancaLiquida: number;
  taxaPoupanca: number;
  taxaInvestimento: number;
}

export function calculateSummary(
  transactions: Array<{ amount: number; macro_group: MacroGroup; exclude_from_kpis?: boolean | null }>
): FinancialSummary {
  const filtered = transactions.filter(t => !t.exclude_from_kpis);
  
  const rendimentos = filtered
    .filter(t => t.macro_group === 'Rendimentos')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const despesas = filtered
    .filter(t => t.macro_group === 'Despesas')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const investimentos = filtered
    .filter(t => t.macro_group === 'Investimentos')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const saldoLiquido = rendimentos - despesas - investimentos;
  const poupancaLiquida = rendimentos - despesas;
  const taxaPoupanca = rendimentos > 0 ? ((rendimentos - despesas - investimentos) / rendimentos) * 100 : 0;
  const taxaInvestimento = rendimentos > 0 ? (investimentos / rendimentos) * 100 : 0;

  return { rendimentos, despesas, investimentos, saldoLiquido, poupancaLiquida, taxaPoupanca, taxaInvestimento };
}

export function calculateDelta(current: number, previous: number): { absolute: number; percentage: number } {
  const absolute = current - previous;
  const percentage = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;
  return { absolute, percentage };
}

export function getCategoryWeight(categoryTotal: number, groupTotal: number): number {
  return groupTotal > 0 ? (categoryTotal / groupTotal) * 100 : 0;
}

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

export function getYTDRange(year: number): PeriodRange {
  return {
    start: new Date(year, 0, 1),
    end: new Date(),
    label: `YTD ${year}`,
  };
}

export function getYTDComparableRange(year: number): PeriodRange {
  const now = new Date();
  return {
    start: new Date(year, 0, 1),
    end: new Date(year, now.getMonth(), now.getDate()),
    label: `YTD ${year} (até ${now.getDate()}/${now.getMonth() + 1})`,
  };
}

export function getMTDRange(year: number, month: number): PeriodRange {
  const now = new Date();
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month - 1, now.getDate()),
    label: `MTD`,
  };
}
