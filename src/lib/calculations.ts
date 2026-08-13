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

// ============ Sankey (fluxo financeiro) ============

export type SankeyDetail = 'category' | 'subcategory';

export interface SankeyTxn {
  amount: number;
  macro_group: MacroGroup;
  category_id?: string | null;
  subcategory_id?: string | null;
  exclude_from_kpis?: boolean | null;
}

export interface SankeyNameMaps {
  categories: Record<string, string>;
  subcategories: Record<string, string>;
}

export interface SankeyNodeData {
  name: string;
  kind: 'income' | 'expense' | 'investment' | 'savings' | 'hub';
}

export interface SankeyLinkData {
  source: number;
  target: number;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNodeData[];
  links: SankeyLinkData[];
  totalIncome: number;
}

const TOP_N = 8;

function aggregate(
  txns: SankeyTxn[],
  group: MacroGroup,
  detail: SankeyDetail,
  maps: SankeyNameMaps
): Array<{ name: string; value: number }> {
  const acc: Record<string, number> = {};
  txns
    .filter((t) => t.macro_group === group)
    .forEach((t) => {
      let name: string;
      if (detail === 'subcategory' && t.subcategory_id) {
        name = maps.subcategories[t.subcategory_id] ?? 'Sem subcategoria';
      } else if (t.category_id) {
        name = maps.categories[t.category_id] ?? 'Sem categoria';
      } else {
        name = 'Sem categoria';
      }
      acc[name] = (acc[name] ?? 0) + Math.abs(Number(t.amount) || 0);
    });

  const sorted = Object.entries(acc)
    .map(([name, value]) => ({ name, value }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);

  if (sorted.length <= TOP_N) return sorted;
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N).reduce((s, e) => s + e.value, 0);
  if (rest > 0) top.push({ name: 'Outros', value: rest });
  return top;
}

export function buildSankeyData(
  transactions: SankeyTxn[],
  maps: SankeyNameMaps,
  detail: SankeyDetail = 'category'
): SankeyData {
  const txns = transactions.filter((t) => !t.exclude_from_kpis);

  const incomes = aggregate(txns, 'Rendimentos', detail, maps);
  const expenses = aggregate(txns, 'Despesas', detail, maps);
  const investments = aggregate(txns, 'Investimentos', detail, maps);

  const totalIncome = incomes.reduce((s, e) => s + e.value, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.value, 0);
  const totalInvest = investments.reduce((s, e) => s + e.value, 0);
  const savings = totalIncome - totalExpense - totalInvest;

  const nodes: SankeyNodeData[] = [];
  const links: SankeyLinkData[] = [];
  const push = (n: SankeyNodeData) => nodes.push(n) - 1;

  if (totalIncome <= 0) return { nodes: [], links: [], totalIncome: 0 };

  const incomeIdx = incomes.map((e) => push({ name: e.name, kind: 'income' }));
  const hubIdx = push({ name: 'Rendimentos', kind: 'hub' });
  incomes.forEach((e, i) => links.push({ source: incomeIdx[i], target: hubIdx, value: e.value }));

  if (totalExpense > 0) {
    const idx = push({ name: 'Despesas', kind: 'expense' });
    links.push({ source: hubIdx, target: idx, value: totalExpense });
    expenses.forEach((e) => {
      const leaf = push({ name: e.name, kind: 'expense' });
      links.push({ source: idx, target: leaf, value: e.value });
    });
  }

  if (totalInvest > 0) {
    const idx = push({ name: 'Investimentos', kind: 'investment' });
    links.push({ source: hubIdx, target: idx, value: totalInvest });
    investments.forEach((e) => {
      const leaf = push({ name: e.name, kind: 'investment' });
      links.push({ source: idx, target: leaf, value: e.value });
    });
  }

  if (savings > 0) {
    const idx = push({ name: 'Poupança', kind: 'savings' });
    links.push({ source: hubIdx, target: idx, value: savings });
  }

  return { nodes, links, totalIncome };
}
