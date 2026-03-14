import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateSummary, calculateDelta, MacroGroup } from '@/lib/calculations';
import { formatCurrency, formatPercentage, getMonthName } from '@/lib/formatters';
import KPICard from '@/components/finance/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupPageProps {
  macroGroup: MacroGroup;
  title: string;
  icon: React.ElementType;
  variant: 'income' | 'expense' | 'investment';
}

const GroupPage: React.FC<GroupPageProps> = ({ macroGroup, title, icon: Icon, variant }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: current }, { data: prev }, { data: cats }] = await Promise.all([
        supabase.from('transactions').select('*, categories(name), subcategories(name)')
          .eq('user_id', user.id).eq('macro_group', macroGroup)
          .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`),
        supabase.from('transactions').select('*, categories(name), subcategories(name)')
          .eq('user_id', user.id).eq('macro_group', macroGroup)
          .gte('date', `${year - 1}-01-01`).lte('date', `${year - 1}-12-31`),
        supabase.from('categories').select('*, subcategories(*)')
          .eq('user_id', user.id).eq('group_type', macroGroup),
      ]);
      setTransactions(current || []);
      setPrevTransactions(prev || []);
      setCategories(cats || []);
      setLoading(false);
    };
    load();
  }, [user, year, macroGroup]);

  const total = useMemo(() => transactions.reduce((s, t) => s + Number(t.amount), 0), [transactions]);
  const prevTotal = useMemo(() => prevTransactions.reduce((s, t) => s + Number(t.amount), 0), [prevTransactions]);

  // By category
  const byCat = useMemo(() => {
    const map: Record<string, { name: string; total: number; prevTotal: number }> = {};
    transactions.forEach(t => {
      const name = t.categories?.name || 'Sem categoria';
      if (!map[name]) map[name] = { name, total: 0, prevTotal: 0 };
      map[name].total += Number(t.amount);
    });
    prevTransactions.forEach(t => {
      const name = t.categories?.name || 'Sem categoria';
      if (!map[name]) map[name] = { name, total: 0, prevTotal: 0 };
      map[name].prevTotal += Number(t.amount);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [transactions, prevTransactions]);

  // Monthly
  const monthly = useMemo(() => {
    const months: Record<number, number> = {};
    const prevMonths: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) { months[i] = 0; prevMonths[i] = 0; }
    transactions.forEach(t => { months[new Date(t.date).getMonth() + 1] += Number(t.amount); });
    prevTransactions.forEach(t => { prevMonths[new Date(t.date).getMonth() + 1] += Number(t.amount); });
    return Array.from({ length: 12 }, (_, i) => ({
      month: getMonthName(i + 1),
      [year]: months[i + 1],
      [year - 1]: prevMonths[i + 1],
    }));
  }, [transactions, prevTransactions, year]);

  if (loading) return <div className="py-20 text-center text-muted-foreground">A carregar...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">Análise detalhada — {year}</p>
        </div>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2022, 2023, 2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard title={`Total ${title}`} value={total} previousValue={prevTotal} icon={Icon} variant={variant} />
        <KPICard title="Média Mensal" value={total / 12} previousValue={prevTotal / 12} icon={Icon} variant={variant} />
        <KPICard title="Transações" value={transactions.length} previousValue={prevTransactions.length} format="number" variant="neutral" />
      </div>

      {/* Comparison chart */}
      <Card className="glass-surface">
        <CardHeader><CardTitle className="text-base">Evolução Mensal — {year} vs {year - 1}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey={String(year)} name={String(year)} fill={`hsl(var(--${variant === 'income' ? 'income' : variant === 'expense' ? 'expense' : 'investment'}))`} radius={[4, 4, 0, 0]} />
                <Bar dataKey={String(year - 1)} name={String(year - 1)} fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* By category */}
      <Card className="glass-surface">
        <CardHeader><CardTitle className="text-base">Por Categoria</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">{year}</TableHead>
                <TableHead className="text-right">{year - 1}</TableHead>
                <TableHead className="text-right">Variação</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCat.map(cat => {
                const delta = calculateDelta(cat.total, cat.prevTotal);
                const weight = total > 0 ? (cat.total / total) * 100 : 0;
                return (
                  <TableRow key={cat.name}>
                    <TableCell className="text-sm font-medium">{cat.name}</TableCell>
                    <TableCell className="text-right financial-value text-sm">{formatCurrency(cat.total)}</TableCell>
                    <TableCell className="text-right financial-value text-sm text-muted-foreground">{formatCurrency(cat.prevTotal)}</TableCell>
                    <TableCell className={cn('text-right text-sm font-medium', delta.percentage > 0 ? 'text-expense' : 'text-income')}>
                      {formatPercentage(delta.percentage)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{weight.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export const RendimentosPage = () => <GroupPage macroGroup="Rendimentos" title="Rendimentos" icon={TrendingUp} variant="income" />;
export const DespesasPage = () => <GroupPage macroGroup="Despesas" title="Despesas" icon={TrendingDown} variant="expense" />;
export const InvestimentosPage = () => <GroupPage macroGroup="Investimentos" title="Investimentos" icon={PiggyBank} variant="investment" />;
