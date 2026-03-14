import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { calculateSummary } from '@/lib/calculations';
import { formatCurrency, getMonthName } from '@/lib/formatters';
import KPICard from '@/components/finance/KPICard';
import PeriodFilter, { PeriodFilterState, getDateRange } from '@/components/finance/PeriodFilter';
import { TrendingUp, TrendingDown, PiggyBank, Wallet, BarChart3, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const now = new Date();

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<PeriodFilterState>({
    preset: 'YTD',
    year: now.getFullYear(),
    compareYear: now.getFullYear() - 1,
  });

  const range = useMemo(() => getDateRange(period), [period]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetchAllRows((s) => s.from('transactions').select('*').eq('user_id', user.id).eq('is_duplicate', false)
        .gte('date', range.start).lte('date', range.end)),
      fetchAllRows((s) => s.from('transactions').select('*').eq('user_id', user.id).eq('is_duplicate', false)
        .gte('date', range.prevStart).lte('date', range.prevEnd)),
    ]).then(([ytd, ytdPrev]) => {
      setTransactions(ytd);
      setPrevTransactions(ytdPrev);
      setLoading(false);
    });
  }, [user, range]);

  const summary = useMemo(() => calculateSummary(transactions), [transactions]);
  const prevSummary = useMemo(() => calculateSummary(prevTransactions), [prevTransactions]);

  const monthlyData = useMemo(() => {
    const months: Record<number, { rendimentos: number; despesas: number; investimentos: number }> = {};
    for (let m = 1; m <= 12; m++) months[m] = { rendimentos: 0, despesas: 0, investimentos: 0 };
    transactions.forEach(t => {
      const m = new Date(t.date).getMonth() + 1;
      if (t.macro_group === 'Rendimentos') months[m].rendimentos += Number(t.amount);
      else if (t.macro_group === 'Despesas') months[m].despesas += Number(t.amount);
      else months[m].investimentos += Number(t.amount);
    });
    return Object.entries(months).map(([m, v]) => ({ month: getMonthName(Number(m)), ...v }));
  }, [transactions]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">A carregar...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {period.preset} {period.year} vs {period.compareYear} · {range.start} a {range.end}
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Rendimentos" value={summary.rendimentos} previousValue={prevSummary.rendimentos} icon={TrendingUp} variant="income" />
        <KPICard title="Despesas" value={summary.despesas} previousValue={prevSummary.despesas} icon={TrendingDown} variant="expense" />
        <KPICard title="Investimentos" value={summary.investimentos} previousValue={prevSummary.investimentos} icon={PiggyBank} variant="investment" />
        <KPICard title="Saldo Líquido" value={summary.saldoLiquido} previousValue={prevSummary.saldoLiquido} icon={Wallet} variant="neutral" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KPICard title="Taxa de Poupança" value={summary.taxaPoupanca} previousValue={prevSummary.taxaPoupanca} format="percentage" icon={Target} variant="income" />
        <KPICard title="Taxa de Investimento" value={summary.taxaInvestimento} previousValue={prevSummary.taxaInvestimento} format="percentage" icon={BarChart3} variant="investment" />
        <KPICard title="Poupança Líquida" value={summary.poupancaLiquida} previousValue={prevSummary.poupancaLiquida} icon={Wallet} variant="income" />
      </div>

      <Card className="glass-surface">
        <CardHeader>
          <CardTitle className="text-base font-medium">Evolução Mensal {period.year}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="rendimentos" name="Rendimentos" fill="hsl(var(--income))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="investimentos" name="Investimentos" fill="hsl(var(--investment))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
