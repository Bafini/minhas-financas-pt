import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatPercentage, getMonthName } from '@/lib/formatters';
import { calculateDelta } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
const YEAR_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--income))',
  'hsl(var(--investment))',
];
const YEAR_OPACITIES = [1, 0.4, 0.7, 0.5];
const NONE = '__none__';

const ComparacoesPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const now = new Date();
  const [years, setYears] = useState<(number | null)[]>([
    now.getFullYear(), now.getFullYear() - 1, null, null,
  ]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [tableGroup, setTableGroup] = useState<string>('all');
  const [ytdMode, setYtdMode] = useState(false);

  const activeYears = useMemo(() => years.filter((y): y is number => y !== null), [years]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetchAllRows((s) => s.from('transactions').select('*, categories(name), subcategories(name)').eq('user_id', user.id).eq('is_duplicate', false).eq('exclude_from_kpis', false).order('date')),
      supabase.from('categories').select('*, subcategories(*)').eq('user_id', user.id),
    ]).then(([tx, { data: cats }]) => {
      setAllTransactions(tx);
      setCategories(cats || []);
      setLoading(false);
    });
  }, [user]);

  // Filter transactions per year, optionally YTD
  const txByYear = useMemo(() => {
    const map: Record<number, any[]> = {};
    const ytdMonth = now.getMonth();
    const ytdDay = now.getDate();
    activeYears.forEach(y => {
      let yearTx = allTransactions.filter(t => new Date(t.date).getFullYear() === y);
      if (ytdMode) {
        yearTx = yearTx.filter(t => {
          const d = new Date(t.date);
          return d.getMonth() < ytdMonth || (d.getMonth() === ytdMonth && d.getDate() <= ytdDay);
        });
      }
      map[y] = yearTx;
    });
    return map;
  }, [allTransactions, activeYears, ytdMode]);

  const filterByGroupAndCat = (tx: any[]) => {
    let filtered = tx;
    if (selectedGroup !== 'all') filtered = filtered.filter(t => t.macro_group === selectedGroup);
    if (selectedCategory !== 'all') filtered = filtered.filter(t => t.category_id === selectedCategory);
    return filtered;
  };

  const filteredByYear = useMemo(() => {
    const map: Record<number, any[]> = {};
    activeYears.forEach(y => { map[y] = filterByGroupAndCat(txByYear[y] || []); });
    return map;
  }, [txByYear, activeYears, selectedGroup, selectedCategory]);

  // Monthly data
  const monthlyData = useMemo(() => {
    const data: any[] = [];
    for (let m = 1; m <= 12; m++) {
      const row: any = { month: getMonthName(m) };
      activeYears.forEach(y => {
        row[y] = (filteredByYear[y] || [])
          .filter(t => new Date(t.date).getMonth() + 1 === m)
          .reduce((s: number, t: any) => s + Number(t.amount), 0);
      });
      data.push(row);
    }
    return data;
  }, [filteredByYear, activeYears]);

  // Cumulative
  const cumulativeData = useMemo(() => {
    const cum: Record<number, number> = {};
    activeYears.forEach(y => { cum[y] = 0; });
    return monthlyData.map(d => {
      const row: any = { month: d.month };
      activeYears.forEach(y => { cum[y] += d[y] as number; row[y] = cum[y]; });
      return row;
    });
  }, [monthlyData, activeYears]);

  // Group summary (always uses unfiltered year tx)
  const groupSummary = useMemo(() => {
    const groups = ['Rendimentos', 'Despesas', 'Investimentos'] as const;
    return groups.map(g => {
      const row: any = { name: g };
      activeYears.forEach(y => {
        row[y] = (txByYear[y] || []).filter(t => t.macro_group === g).reduce((s: number, t: any) => s + Number(t.amount), 0);
      });
      return row;
    });
  }, [txByYear, activeYears]);

  // Category breakdown with table group filter
  const categoryData = useMemo(() => {
    const map: Record<string, any> = {};
    activeYears.forEach(y => {
      let tx = filteredByYear[y] || [];
      if (tableGroup !== 'all') tx = tx.filter(t => t.macro_group === tableGroup);
      tx.forEach(t => {
        const name = t.categories?.name || 'Sem categoria';
        if (!map[name]) { map[name] = { name, group: t.macro_group }; activeYears.forEach(yr => { map[name][yr] = 0; }); }
        map[name][y] += Number(t.amount);
      });
    });
    return Object.values(map).sort((a: any, b: any) => (b[activeYears[0]] || 0) - (a[activeYears[0]] || 0));
  }, [filteredByYear, activeYears, tableGroup]);

  // Subcategory breakdown with table group filter
  const subcategoryData = useMemo(() => {
    const map: Record<string, any> = {};
    activeYears.forEach(y => {
      let tx = filteredByYear[y] || [];
      if (tableGroup !== 'all') tx = tx.filter(t => t.macro_group === tableGroup);
      tx.forEach(t => {
        const name = t.subcategories?.name || 'Sem subcategoria';
        const cat = t.categories?.name || 'Sem categoria';
        const key = `${cat}__${name}`;
        if (!map[key]) { map[key] = { name, category: cat }; activeYears.forEach(yr => { map[key][yr] = 0; }); }
        map[key][y] += Number(t.amount);
      });
    });
    return Object.values(map).sort((a: any, b: any) => (b[activeYears[0]] || 0) - (a[activeYears[0]] || 0));
  }, [filteredByYear, activeYears, tableGroup]);

  const filteredCategories = useMemo(() => {
    if (selectedGroup === 'all') return categories;
    return categories.filter(c => c.group_type === selectedGroup);
  }, [categories, selectedGroup]);

  const setYear = (idx: number, val: string) => {
    const newYears = [...years];
    newYears[idx] = val === NONE ? null : Number(val);
    setYears(newYears);
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">A carregar...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comparações</h1>
        <p className="text-sm text-muted-foreground">
          Análise comparativa entre anos, categorias e subcategorias
          {ytdMode && <span className="ml-1 text-primary font-medium">(YTD até {now.getDate()}/{now.getMonth() + 1})</span>}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {[0, 1, 2, 3].map(idx => (
          <div key={idx} className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ano {String.fromCharCode(65 + idx)}</Label>
            <Select value={years[idx] !== null ? String(years[idx]) : NONE} onValueChange={v => setYear(idx, v)}>
              <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {idx >= 2 && <SelectItem value={NONE}>—</SelectItem>}
                {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Grupo</Label>
          <Select value={selectedGroup} onValueChange={v => { setSelectedGroup(v); setSelectedCategory('all'); }}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Rendimentos">Rendimentos</SelectItem>
              <SelectItem value="Despesas">Despesas</SelectItem>
              <SelectItem value="Investimentos">Investimentos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Categoria</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant={ytdMode ? 'default' : 'outline'}
          size="sm"
          className="h-9"
          onClick={() => setYtdMode(!ytdMode)}
        >
          YTD
        </Button>
      </div>

      {/* Group Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {groupSummary.map(g => {
          const color = g.name === 'Rendimentos' ? 'text-income' : g.name === 'Despesas' ? 'text-expense' : 'text-investment';
          return (
            <Card key={g.name} className="glass-surface">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{g.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {activeYears.map((y, i) => (
                    <div key={y} className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">{y}</span>
                      <span className={cn('font-bold financial-value', i === 0 ? `text-base ${color}` : 'text-sm text-muted-foreground')}>
                        {formatCurrency(g[y])}
                      </span>
                    </div>
                  ))}
                  {activeYears.length >= 2 && (
                    <div className="flex items-baseline justify-end pt-1 border-t border-border/50">
                      <span className={cn('text-xs font-semibold', (() => { const d = calculateDelta(g[activeYears[0]], g[activeYears[1]]); return d.percentage > 0 ? 'text-income' : d.percentage < 0 ? 'text-expense' : 'text-muted-foreground'; })())}>
                        {formatPercentage(calculateDelta(g[activeYears[0]], g[activeYears[1]]).percentage)} vs {activeYears[1]}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly">Mensal</TabsTrigger>
          <TabsTrigger value="cumulative">Acumulado</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="subcategories">Subcategorias</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card className="glass-surface">
            <CardHeader><CardTitle className="text-base">Evolução Mensal — {activeYears.join(' vs ')}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend />
                    {activeYears.map((y, i) => (
                      <Bar key={y} dataKey={String(y)} name={String(y)} fill={YEAR_COLORS[i]} opacity={YEAR_OPACITIES[i]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cumulative">
          <Card className="glass-surface">
            <CardHeader><CardTitle className="text-base">Acumulado Mensal — {activeYears.join(' vs ')}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend />
                    {activeYears.map((y, i) => (
                      <Line key={y} type="monotone" dataKey={String(y)} name={String(y)} stroke={YEAR_COLORS[i]} strokeWidth={2} strokeDasharray={i > 0 ? '5 5' : undefined} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="glass-surface">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Comparação por Categoria</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={tableGroup} onValueChange={setTableGroup}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os grupos</SelectItem>
                    <SelectItem value="Rendimentos">Rendimentos</SelectItem>
                    <SelectItem value="Despesas">Despesas</SelectItem>
                    <SelectItem value="Investimentos">Investimentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Grupo</TableHead>
                    {activeYears.map(y => <TableHead key={y} className="text-right">{y}</TableHead>)}
                    {activeYears.length >= 2 && <TableHead className="text-right">Δ %</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryData.map((cat: any) => {
                    const d = activeYears.length >= 2 ? calculateDelta(cat[activeYears[0]], cat[activeYears[1]]) : null;
                    const groupColor = cat.group === 'Rendimentos' ? 'text-income' : cat.group === 'Despesas' ? 'text-expense' : 'text-investment';
                    return (
                      <TableRow key={cat.name}>
                        <TableCell className="text-sm font-medium">{cat.name}</TableCell>
                        <TableCell className={cn('text-xs', groupColor)}>{cat.group}</TableCell>
                        {activeYears.map((y, i) => (
                          <TableCell key={y} className={cn('text-right financial-value text-sm', i > 0 && 'text-muted-foreground')}>
                            {formatCurrency(cat[y] || 0)}
                          </TableCell>
                        ))}
                        {d && (
                          <TableCell className={cn('text-right text-sm font-medium', d.percentage > 0 ? 'text-income' : d.percentage < 0 ? 'text-expense' : '')}>
                            {formatPercentage(d.percentage)}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subcategories">
          <Card className="glass-surface">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Comparação por Subcategoria</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={tableGroup} onValueChange={setTableGroup}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os grupos</SelectItem>
                    <SelectItem value="Rendimentos">Rendimentos</SelectItem>
                    <SelectItem value="Despesas">Despesas</SelectItem>
                    <SelectItem value="Investimentos">Investimentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subcategoria</TableHead>
                    <TableHead>Categoria</TableHead>
                    {activeYears.map(y => <TableHead key={y} className="text-right">{y}</TableHead>)}
                    {activeYears.length >= 2 && <TableHead className="text-right">Δ %</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subcategoryData.map((sub: any) => {
                    const d = activeYears.length >= 2 ? calculateDelta(sub[activeYears[0]], sub[activeYears[1]]) : null;
                    return (
                      <TableRow key={`${sub.category}__${sub.name}`}>
                        <TableCell className="text-sm font-medium">{sub.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{sub.category}</TableCell>
                        {activeYears.map((y, i) => (
                          <TableCell key={y} className={cn('text-right financial-value text-sm', i > 0 && 'text-muted-foreground')}>
                            {formatCurrency(sub[y] || 0)}
                          </TableCell>
                        ))}
                        {d && (
                          <TableCell className={cn('text-right text-sm font-medium', d.percentage > 0 ? 'text-income' : d.percentage < 0 ? 'text-expense' : '')}>
                            {formatPercentage(d.percentage)}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ComparacoesPage;
