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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';

const YEARS = [2022, 2023, 2024, 2025, 2026];

const ComparacoesPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const [yearA, setYearA] = useState(new Date().getFullYear());
  const [yearB, setYearB] = useState(new Date().getFullYear() - 1);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetchAllRows((s) => s.from('transactions').select('*, categories(name), subcategories(name)').eq('user_id', user.id).order('date')),
      supabase.from('categories').select('*, subcategories(*)').eq('user_id', user.id),
    ]).then(([tx, { data: cats }]) => {
      setAllTransactions(tx);
      setCategories(cats || []);
      setLoading(false);
    });
  }, [user]);

  const txA = useMemo(() => allTransactions.filter(t => new Date(t.date).getFullYear() === yearA), [allTransactions, yearA]);
  const txB = useMemo(() => allTransactions.filter(t => new Date(t.date).getFullYear() === yearB), [allTransactions, yearB]);

  const filterByGroupAndCat = (tx: any[]) => {
    let filtered = tx;
    if (selectedGroup !== 'all') filtered = filtered.filter(t => t.macro_group === selectedGroup);
    if (selectedCategory !== 'all') filtered = filtered.filter(t => t.category_id === selectedCategory);
    return filtered;
  };

  const fA = useMemo(() => filterByGroupAndCat(txA), [txA, selectedGroup, selectedCategory]);
  const fB = useMemo(() => filterByGroupAndCat(txB), [txB, selectedGroup, selectedCategory]);

  const totalA = useMemo(() => fA.reduce((s, t) => s + Number(t.amount), 0), [fA]);
  const totalB = useMemo(() => fB.reduce((s, t) => s + Number(t.amount), 0), [fB]);

  // Monthly comparison
  const monthlyData = useMemo(() => {
    const months: Record<number, { a: number; b: number }> = {};
    for (let m = 1; m <= 12; m++) months[m] = { a: 0, b: 0 };
    fA.forEach(t => { months[new Date(t.date).getMonth() + 1].a += Number(t.amount); });
    fB.forEach(t => { months[new Date(t.date).getMonth() + 1].b += Number(t.amount); });
    return Object.entries(months).map(([m, v]) => ({
      month: getMonthName(Number(m)),
      [yearA]: v.a,
      [yearB]: v.b,
    }));
  }, [fA, fB, yearA, yearB]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const map: Record<string, { name: string; group: string; a: number; b: number }> = {};
    fA.forEach(t => {
      const name = t.categories?.name || 'Sem categoria';
      if (!map[name]) map[name] = { name, group: t.macro_group, a: 0, b: 0 };
      map[name].a += Number(t.amount);
    });
    fB.forEach(t => {
      const name = t.categories?.name || 'Sem categoria';
      if (!map[name]) map[name] = { name, group: t.macro_group, a: 0, b: 0 };
      map[name].b += Number(t.amount);
    });
    return Object.values(map).sort((a, b) => b.a - a.b);
  }, [fA, fB]);

  // Subcategory breakdown
  const subcategoryData = useMemo(() => {
    const map: Record<string, { name: string; category: string; a: number; b: number }> = {};
    fA.forEach(t => {
      const name = t.subcategories?.name || 'Sem subcategoria';
      const cat = t.categories?.name || 'Sem categoria';
      const key = `${cat}__${name}`;
      if (!map[key]) map[key] = { name, category: cat, a: 0, b: 0 };
      map[key].a += Number(t.amount);
    });
    fB.forEach(t => {
      const name = t.subcategories?.name || 'Sem subcategoria';
      const cat = t.categories?.name || 'Sem categoria';
      const key = `${cat}__${name}`;
      if (!map[key]) map[key] = { name, category: cat, a: 0, b: 0 };
      map[key].b += Number(t.amount);
    });
    return Object.values(map).sort((a, b) => b.a - a.b);
  }, [fA, fB]);

  // Macro group summary
  const groupSummary = useMemo(() => {
    const groups = ['Rendimentos', 'Despesas', 'Investimentos'] as const;
    return groups.map(g => ({
      name: g,
      a: txA.filter(t => t.macro_group === g).reduce((s, t) => s + Number(t.amount), 0),
      b: txB.filter(t => t.macro_group === g).reduce((s, t) => s + Number(t.amount), 0),
    }));
  }, [txA, txB]);

  // Cumulative monthly for line chart
  const cumulativeData = useMemo(() => {
    let cumA = 0, cumB = 0;
    return monthlyData.map(d => {
      cumA += d[yearA] as number;
      cumB += d[yearB] as number;
      return { month: d.month, [yearA]: cumA, [yearB]: cumB };
    });
  }, [monthlyData, yearA, yearB]);

  const filteredCategories = useMemo(() => {
    if (selectedGroup === 'all') return categories;
    return categories.filter(c => c.group_type === selectedGroup);
  }, [categories, selectedGroup]);

  if (loading) return <div className="py-20 text-center text-muted-foreground">A carregar...</div>;

  const delta = calculateDelta(totalA, totalB);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comparações</h1>
        <p className="text-sm text-muted-foreground">Análise comparativa entre anos, categorias e subcategorias</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ano A</Label>
          <Select value={String(yearA)} onValueChange={v => setYearA(Number(v))}>
            <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ano B</Label>
          <Select value={String(yearB)} onValueChange={v => setYearB(Number(v))}>
            <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
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
      </div>

      {/* Group Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {groupSummary.map(g => {
          const d = calculateDelta(g.a, g.b);
          const color = g.name === 'Rendimentos' ? 'text-income' : g.name === 'Despesas' ? 'text-expense' : 'text-investment';
          return (
            <Card key={g.name} className="glass-surface">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{g.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className={cn('text-lg font-bold financial-value', color)}>{formatCurrency(g.a)}</p>
                    <p className="text-xs text-muted-foreground financial-value">{formatCurrency(g.b)}</p>
                  </div>
                  <span className={cn('text-sm font-semibold', d.percentage > 0 ? 'text-income' : d.percentage < 0 ? 'text-expense' : 'text-muted-foreground')}>
                    {formatPercentage(d.percentage)}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Totals bar */}
      <Card className="glass-surface">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Filtrado</p>
              <p className="text-2xl font-bold financial-value">{formatCurrency(totalA)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">vs {yearB}</p>
              <p className="text-lg text-muted-foreground financial-value">{formatCurrency(totalB)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Variação</p>
              <p className={cn('text-lg font-bold', delta.percentage > 0 ? 'text-income' : delta.percentage < 0 ? 'text-expense' : '')}>
                {formatPercentage(delta.percentage)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly">Mensal</TabsTrigger>
          <TabsTrigger value="cumulative">Acumulado</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="subcategories">Subcategorias</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card className="glass-surface">
            <CardHeader><CardTitle className="text-base">Evolução Mensal — {yearA} vs {yearB}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey={String(yearA)} name={String(yearA)} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(yearB)} name={String(yearB)} fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cumulative">
          <Card className="glass-surface">
            <CardHeader><CardTitle className="text-base">Acumulado Mensal — {yearA} vs {yearB}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey={String(yearA)} name={String(yearA)} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey={String(yearB)} name={String(yearB)} stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="glass-surface">
            <CardHeader><CardTitle className="text-base">Comparação por Categoria</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="text-right">{yearA}</TableHead>
                    <TableHead className="text-right">{yearB}</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead className="text-right">Δ %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryData.map(cat => {
                    const d = calculateDelta(cat.a, cat.b);
                    const groupColor = cat.group === 'Rendimentos' ? 'text-income' : cat.group === 'Despesas' ? 'text-expense' : 'text-investment';
                    return (
                      <TableRow key={cat.name}>
                        <TableCell className="text-sm font-medium">{cat.name}</TableCell>
                        <TableCell className={cn('text-xs', groupColor)}>{cat.group}</TableCell>
                        <TableCell className="text-right financial-value text-sm">{formatCurrency(cat.a)}</TableCell>
                        <TableCell className="text-right financial-value text-sm text-muted-foreground">{formatCurrency(cat.b)}</TableCell>
                        <TableCell className={cn('text-right financial-value text-sm', d.absolute > 0 ? 'text-income' : d.absolute < 0 ? 'text-expense' : '')}>
                          {formatCurrency(d.absolute)}
                        </TableCell>
                        <TableCell className={cn('text-right text-sm font-medium', d.percentage > 0 ? 'text-income' : d.percentage < 0 ? 'text-expense' : '')}>
                          {formatPercentage(d.percentage)}
                        </TableCell>
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
            <CardHeader><CardTitle className="text-base">Comparação por Subcategoria</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subcategoria</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">{yearA}</TableHead>
                    <TableHead className="text-right">{yearB}</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead className="text-right">Δ %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subcategoryData.map(sub => {
                    const d = calculateDelta(sub.a, sub.b);
                    return (
                      <TableRow key={`${sub.category}__${sub.name}`}>
                        <TableCell className="text-sm font-medium">{sub.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{sub.category}</TableCell>
                        <TableCell className="text-right financial-value text-sm">{formatCurrency(sub.a)}</TableCell>
                        <TableCell className="text-right financial-value text-sm text-muted-foreground">{formatCurrency(sub.b)}</TableCell>
                        <TableCell className={cn('text-right financial-value text-sm', d.absolute > 0 ? 'text-income' : d.absolute < 0 ? 'text-expense' : '')}>
                          {formatCurrency(d.absolute)}
                        </TableCell>
                        <TableCell className={cn('text-right text-sm font-medium', d.percentage > 0 ? 'text-income' : d.percentage < 0 ? 'text-expense' : '')}>
                          {formatPercentage(d.percentage)}
                        </TableCell>
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
