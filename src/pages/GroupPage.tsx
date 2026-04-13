import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProfile } from '@/contexts/ActiveProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { calculateDelta, MacroGroup } from '@/lib/calculations';
import { formatCurrency, formatPercentage, getMonthName } from '@/lib/formatters';
import KPICard from '@/components/finance/KPICard';
import PeriodFilter, { PeriodFilterState, getDateRange } from '@/components/finance/PeriodFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, PiggyBank, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupPageProps {
  macroGroup: MacroGroup;
  title: string;
  icon: React.FC<any>;
  variant: 'income' | 'expense' | 'investment';
}

const now = new Date();

const GroupPage: React.FC<GroupPageProps> = ({ macroGroup, title, icon: Icon, variant }) => {
  const { user } = useAuth();
  const { activeUserId } = useActiveProfile();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [tableFilterCatId, setTableFilterCatId] = useState<string | null>(null);
  const [tableFilterSubcatId, setTableFilterSubcatId] = useState<string | null>(null);

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
      fetchAllRows((s) => s.from('transactions').select('*, categories(name), subcategories(name)')
        .eq('user_id', activeUserId).eq('macro_group', macroGroup).eq('is_duplicate', false).eq('exclude_from_kpis', false)
        .gte('date', range.start).lte('date', range.end)),
      fetchAllRows((s) => s.from('transactions').select('*, categories(name), subcategories(name)')
        .eq('user_id', activeUserId).eq('macro_group', macroGroup).eq('is_duplicate', false).eq('exclude_from_kpis', false)
        .gte('date', range.prevStart).lte('date', range.prevEnd)),
      supabase.from('categories').select('*, subcategories(*)')
        .eq('user_id', activeUserId).eq('group_type', macroGroup),
    ]).then(([current, prev, { data: cats }]) => {
      setTransactions(current);
      setPrevTransactions(prev);
      setCategories(cats || []);
      setLoading(false);
    });
  }, [user, activeUserId, range, macroGroup]);

  // Apply dropdown category filter first
  const dropdownFilteredTx = useMemo(() => {
    if (selectedCategory === 'all') return transactions;
    return transactions.filter(t => t.category_id === selectedCategory);
  }, [transactions, selectedCategory]);

  // Find the last date with data in current period and cap prev period accordingly
  const lastDataDate = useMemo(() => {
    if (transactions.length === 0) return null;
    return transactions.reduce((max, t) => t.date > max ? t.date : max, transactions[0].date);
  }, [transactions]);

  const cappedPrevTransactions = useMemo(() => {
    if (!lastDataDate || !['YTD', 'QTD', 'STD', 'MTD'].includes(period.preset)) return prevTransactions;
    const lastDate = new Date(lastDataDate);
    const capDate = `${period.compareYear}-${String(lastDate.getMonth() + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`;
    return prevTransactions.filter(t => t.date <= capDate);
  }, [prevTransactions, lastDataDate, period.compareYear, period.preset]);

  const dropdownFilteredPrevTx = useMemo(() => {
    if (selectedCategory === 'all') return cappedPrevTransactions;
    return cappedPrevTransactions.filter(t => t.category_id === selectedCategory);
  }, [cappedPrevTransactions, selectedCategory]);

  // Apply table click filter on top of dropdown filter
  const filteredTx = useMemo(() => {
    if (tableFilterSubcatId) return dropdownFilteredTx.filter(t => t.subcategory_id === tableFilterSubcatId);
    if (tableFilterCatId) return dropdownFilteredTx.filter(t => t.category_id === tableFilterCatId);
    return dropdownFilteredTx;
  }, [dropdownFilteredTx, tableFilterCatId, tableFilterSubcatId]);

  const filteredPrevTx = useMemo(() => {
    if (tableFilterSubcatId) return dropdownFilteredPrevTx.filter(t => t.subcategory_id === tableFilterSubcatId);
    if (tableFilterCatId) return dropdownFilteredPrevTx.filter(t => t.category_id === tableFilterCatId);
    return dropdownFilteredPrevTx;
  }, [dropdownFilteredPrevTx, tableFilterCatId, tableFilterSubcatId]);

  const total = useMemo(() => filteredTx.reduce((s, t) => s + Number(t.amount), 0), [filteredTx]);
  const prevTotal = useMemo(() => filteredPrevTx.reduce((s, t) => s + Number(t.amount), 0), [filteredPrevTx]);

  const activeMonths = useMemo(() => {
    const months = new Set(filteredTx.map(t => new Date(t.date).getMonth()));
    return Math.max(months.size, 1);
  }, [filteredTx]);
  const prevActiveMonths = useMemo(() => {
    const months = new Set(filteredPrevTx.map(t => new Date(t.date).getMonth()));
    return Math.max(months.size, 1);
  }, [filteredPrevTx]);

  // Build category + subcategory breakdown from unfiltered (dropdown-only) data
  const byCat = useMemo(() => {
    const map: Record<string, { catId: string; name: string; total: number; prevTotal: number; subs: Record<string, { subId: string; name: string; total: number; prevTotal: number }> }> = {};
    dropdownFilteredTx.forEach(t => {
      const catName = t.categories?.name || 'Sem categoria';
      const catId = t.category_id || 'none';
      if (!map[catId]) map[catId] = { catId, name: catName, total: 0, prevTotal: 0, subs: {} };
      map[catId].total += Number(t.amount);
      if (t.subcategory_id) {
        const subName = t.subcategories?.name || 'Sem subcategoria';
        if (!map[catId].subs[t.subcategory_id]) map[catId].subs[t.subcategory_id] = { subId: t.subcategory_id, name: subName, total: 0, prevTotal: 0 };
        map[catId].subs[t.subcategory_id].total += Number(t.amount);
      }
    });
    dropdownFilteredPrevTx.forEach(t => {
      const catName = t.categories?.name || 'Sem categoria';
      const catId = t.category_id || 'none';
      if (!map[catId]) map[catId] = { catId, name: catName, total: 0, prevTotal: 0, subs: {} };
      map[catId].prevTotal += Number(t.amount);
      if (t.subcategory_id) {
        const subName = t.subcategories?.name || 'Sem subcategoria';
        if (!map[catId].subs[t.subcategory_id]) map[catId].subs[t.subcategory_id] = { subId: t.subcategory_id, name: subName, total: 0, prevTotal: 0 };
        map[catId].subs[t.subcategory_id].prevTotal += Number(t.amount);
      }
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [dropdownFilteredTx, dropdownFilteredPrevTx]);

  const grandTotal = useMemo(() => dropdownFilteredTx.reduce((s, t) => s + Number(t.amount), 0), [dropdownFilteredTx]);

  const monthly = useMemo(() => {
    const months: Record<number, number> = {};
    const prevMonths: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) { months[i] = 0; prevMonths[i] = 0; }
    filteredTx.forEach(t => { months[new Date(t.date).getMonth() + 1] += Number(t.amount); });
    filteredPrevTx.forEach(t => { prevMonths[new Date(t.date).getMonth() + 1] += Number(t.amount); });
    return Array.from({ length: 12 }, (_, i) => ({
      month: getMonthName(i + 1),
      [period.year]: months[i + 1],
      [period.compareYear]: prevMonths[i + 1],
    }));
  }, [filteredTx, filteredPrevTx, period.year, period.compareYear]);

  const handleCatClick = useCallback((catId: string) => {
    if (tableFilterCatId === catId && !tableFilterSubcatId) {
      setTableFilterCatId(null);
    } else {
      setTableFilterCatId(catId);
      setTableFilterSubcatId(null);
    }
  }, [tableFilterCatId, tableFilterSubcatId]);

  const handleSubcatClick = useCallback((catId: string, subId: string) => {
    if (tableFilterSubcatId === subId) {
      setTableFilterSubcatId(null);
      setTableFilterCatId(null);
    } else {
      setTableFilterCatId(catId);
      setTableFilterSubcatId(subId);
    }
  }, [tableFilterSubcatId]);

  const clearTableFilter = useCallback(() => {
    setTableFilterCatId(null);
    setTableFilterSubcatId(null);
  }, []);

  const hasTableFilter = tableFilterCatId || tableFilterSubcatId;

  if (loading) return <div className="py-20 text-center text-muted-foreground">A carregar...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{period.preset} {period.year} vs {period.compareYear}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <PeriodFilter value={period} onChange={setPeriod} />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); clearTableFilter(); }}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard title={`Total ${title}`} value={total} previousValue={prevTotal} icon={Icon} variant={variant} />
        <KPICard title="Média Mensal" value={total / activeMonths} previousValue={prevTotal / prevActiveMonths} icon={Icon} variant={variant} />
        <KPICard title="Transações" value={filteredTx.length} previousValue={filteredPrevTx.length} format="number" variant="neutral" />
      </div>

      <Card className="glass-surface">
        <CardHeader><CardTitle className="text-base">Evolução Mensal — {period.year} vs {period.compareYear}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey={String(period.year)} name={String(period.year)} fill={`hsl(var(--${variant === 'income' ? 'income' : variant === 'expense' ? 'expense' : 'investment'}))`} radius={[4, 4, 0, 0]} />
                <Bar dataKey={String(period.compareYear)} name={String(period.compareYear)} fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-surface">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Por Categoria</CardTitle>
          {hasTableFilter && (
            <Button variant="ghost" size="sm" onClick={clearTableFilter} className="h-7 gap-1 text-xs text-muted-foreground">
              <X className="h-3 w-3" /> Limpar filtro
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">{period.year}</TableHead>
                <TableHead className="text-right">{period.compareYear}</TableHead>
                <TableHead className="text-right">Variação</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCat.map(cat => {
                const delta = calculateDelta(cat.total, cat.prevTotal);
                const weight = grandTotal > 0 ? (cat.total / grandTotal) * 100 : 0;
                const isCatActive = tableFilterCatId === cat.catId && !tableFilterSubcatId;
                const subs = Object.values(cat.subs).sort((a, b) => b.total - a.total);
                return (
                  <React.Fragment key={cat.catId}>
                    <TableRow
                      className={cn('cursor-pointer transition-colors', isCatActive && 'bg-muted')}
                      onClick={() => handleCatClick(cat.catId)}
                    >
                      <TableCell className="text-sm font-medium">{cat.name}</TableCell>
                      <TableCell className="text-right financial-value text-sm">{formatCurrency(cat.total)}</TableCell>
                      <TableCell className="text-right financial-value text-sm text-muted-foreground">{formatCurrency(cat.prevTotal)}</TableCell>
                      <TableCell className={cn('text-right text-sm font-medium', delta.percentage > 0 ? 'text-expense' : 'text-income')}>
                        {formatPercentage(delta.percentage)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{weight.toFixed(1)}%</TableCell>
                    </TableRow>
                    {subs.map(sub => {
                      const subDelta = calculateDelta(sub.total, sub.prevTotal);
                      const subWeight = grandTotal > 0 ? (sub.total / grandTotal) * 100 : 0;
                      const isSubActive = tableFilterSubcatId === sub.subId;
                      return (
                        <TableRow
                          key={sub.subId}
                          className={cn('cursor-pointer transition-colors', isSubActive ? 'bg-muted/50' : 'hover:bg-muted/30')}
                          onClick={(e) => { e.stopPropagation(); handleSubcatClick(cat.catId, sub.subId); }}
                        >
                          <TableCell className="text-sm pl-8 text-muted-foreground">{sub.name}</TableCell>
                          <TableCell className="text-right financial-value text-sm">{formatCurrency(sub.total)}</TableCell>
                          <TableCell className="text-right financial-value text-sm text-muted-foreground">{formatCurrency(sub.prevTotal)}</TableCell>
                          <TableCell className={cn('text-right text-sm font-medium', subDelta.percentage > 0 ? 'text-expense' : 'text-income')}>
                            {formatPercentage(subDelta.percentage)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{subWeight.toFixed(1)}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
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
