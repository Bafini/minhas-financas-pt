import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateSummary, calculateDelta } from '@/lib/calculations';
import { formatCurrency, formatPercentage, getMonthName } from '@/lib/formatters';
import KPICard from '@/components/finance/KPICard';
import { TrendingUp, TrendingDown, PiggyBank, Wallet, BarChart3, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // YTD current
      const { data: ytd } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', `${currentYear}-01-01`)
        .lte('date', now.toISOString().split('T')[0]);

      // YTD previous (same day last year)
      const prevDate = new Date(currentYear - 1, now.getMonth(), currentDay);
      const { data: ytdPrev } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', `${currentYear - 1}-01-01`)
        .lte('date', prevDate.toISOString().split('T')[0]);

      setTransactions(ytd || []);
      setPrevTransactions(ytdPrev || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const summary = useMemo(() => calculateSummary(transactions), [transactions]);
  const prevSummary = useMemo(() => calculateSummary(prevTransactions), [prevTransactions]);

  // Monthly evolution
  const monthlyData = useMemo(() => {
    const months: Record<string, { rendimentos: number; despesas: number; investimentos: number }> = {};
    for (let m = 1; m <= 12; m++) {
      months[m] = { rendimentos: 0, despesas: 0, investimentos: 0 };
    }
    transactions.forEach(t => {
      const m = new Date(t.date).getMonth() + 1;
      if (t.macro_group === 'Rendimentos') months[m].rendimentos += Number(t.amount);
      else if (t.macro_group === 'Despesas') months[m].despesas += Number(t.amount);
      else months[m].investimentos += Number(t.amount);
    });
    return Object.entries(months).map(([m, v]) => ({
      month: getMonthName(Number(m)),
      ...v,
    }));
  }, [transactions]);

  // Top expense categories
  const topCategories = useMemo(() => {
    const cats: Record<string, number> = {};
    transactions
      .filter(t => t.macro_group === 'Despesas')
      .forEach(t => {
        // We don't have category name here, use category_id
        const key = t.category_id || 'Sem categoria';
        cats[key] = (cats[key] || 0) + Number(t.amount);
      });
    return Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, value]) => ({ id, value }));
  }, [transactions]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">A carregar...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          YTD {currentYear} até {currentDay}/{currentMonth}/{currentYear}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Rendimentos"
          value={summary.rendimentos}
          previousValue={prevSummary.rendimentos}
          icon={TrendingUp}
          variant="income"
        />
        <KPICard
          title="Despesas"
          value={summary.despesas}
          previousValue={prevSummary.despesas}
          icon={TrendingDown}
          variant="expense"
        />
        <KPICard
          title="Investimentos"
          value={summary.investimentos}
          previousValue={prevSummary.investimentos}
          icon={PiggyBank}
          variant="investment"
        />
        <KPICard
          title="Saldo Líquido"
          value={summary.saldoLiquido}
          previousValue={prevSummary.saldoLiquido}
          icon={Wallet}
          variant="neutral"
        />
      </div>

      {/* Rates */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KPICard
          title="Taxa de Poupança"
          value={summary.taxaPoupanca}
          previousValue={prevSummary.taxaPoupanca}
          format="percentage"
          icon={Target}
          variant="income"
        />
        <KPICard
          title="Taxa de Investimento"
          value={summary.taxaInvestimento}
          previousValue={prevSummary.taxaInvestimento}
          format="percentage"
          icon={BarChart3}
          variant="investment"
        />
        <KPICard
          title="Poupança Líquida"
          value={summary.poupancaLiquida}
          previousValue={prevSummary.poupancaLiquida}
          icon={Wallet}
          variant="income"
        />
      </div>

      {/* Monthly Evolution Chart */}
      <Card className="glass-surface">
        <CardHeader>
          <CardTitle className="text-base font-medium">Evolução Mensal {currentYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
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
