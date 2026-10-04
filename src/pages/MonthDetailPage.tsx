import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProfile } from '@/contexts/ActiveProfileContext';
import { useDateFormat } from '@/contexts/DateFormatContext';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { calculateDelta } from '@/lib/calculations';
import { formatCurrency, formatPercentage, getMonthName } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026, 2027];
const pad = (n: number) => String(n).padStart(2, '0');

const MonthDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { activeUserId } = useActiveProfile();
  const { fd } = useDateFormat() as any;

  const month = Number(params.get('month')) || new Date().getMonth() + 1;
  const years = (params.get('years') || `${new Date().getFullYear()},${new Date().getFullYear() - 1}`)
    .split(',').map(Number).filter(Boolean).slice(0, 4);
  const group = params.get('group') || 'all';
  const category = params.get('category') || 'all';
  const subcategory = params.get('subcategory') || '';
  const ytdDay = params.get('ytdDay') ? Number(params.get('ytdDay')) : null;

  const [txByYear, setTxByYear] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<string | null>(null);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    p.set(k, v);
    setParams(p, { replace: true });
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all(years.map(y => {
      const last = new Date(y, month, 0).getDate();
      const end = ytdDay ? Math.min(ytdDay, last) : last;
      return fetchAllRows((s) => {
        let q = s.from('transactions').select('*, categories(name), subcategories(name)')
          .eq('user_id', activeUserId).eq('is_duplicate', false).eq('exclude_from_kpis', false)
          .gte('date', `${y}-${pad(month)}-01`).lte('date', `${y}-${pad(month)}-${pad(end)}`);
        if (group !== 'all') q = q.eq('macro_group', group as any);
        if (category !== 'all') q = q.eq('category_id', category);
        if (subcategory) q = q.eq('subcategory_id', subcategory);
        return q.order('id');
      });
    })).then(res => {
      const m: Record<number, any[]> = {};
      years.forEach((y, i) => { m[y] = (res[i] as any[]).sort((a, b) => a.date.localeCompare(b.date)); });
      setTxByYear(m);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeUserId, month, years.join(','), group, category, subcategory, ytdDay]);

  const totals = years.map(y => (txByYear[y] || []).reduce((s, t) => s + Number(t.amount), 0));

  const breakdown = useMemo(() => {
    const map: Record<string, any> = {};
    years.forEach(y => (txByYear[y] || []).forEach(t => {
      const cat = t.categories?.name || 'Sem categoria';
      const sub = t.subcategories?.name || '—';
      const key = `${cat}__${sub}`;
      if (!map[key]) { map[key] = { key, cat, sub, catId: t.category_id || 'none' }; years.forEach(yy => { map[key][yy] = 0; }); }
      map[key][y] += Number(t.amount);
    }));
    return Object.values(map).sort((a: any, b: any) =>
      Math.abs((b[years[0]] || 0) - (b[years[1]] || 0)) - Math.abs((a[years[0]] || 0) - (a[years[1]] || 0)));
  }, [txByYear, years.join(',')]);

  const visible = (y: number) => (txByYear[y] || []).filter(t =>
    !catFilter || `${t.categories?.name || 'Sem categoria'}__${t.subcategories?.name || '—'}` === catFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Detalhe do Mês — {getMonthName(month)}</h1>
          <p className="text-sm text-muted-foreground">
            {group === 'all' ? 'Todos os grupos' : group}{ytdDay ? ` · até dia ${ytdDay}` : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={String(month)} onValueChange={v => setParam('month', v)}>
            <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i} value={String(i + 1)}>{getMonthName(i + 1)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {years.map((y, idx) => (
          <div key={idx} className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ano {String.fromCharCode(65 + idx)}</Label>
            <Select value={String(y)} onValueChange={v => { const n = [...years]; n[idx] = Number(v); setParam('years', n.join(',')); }}>
              <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map(yy => <SelectItem key={yy} value={String(yy)}>{yy}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {loading ? <div className="py-20 text-center text-muted-foreground">A carregar...</div> : (
        <>
          <div className={cn('grid gap-4', years.length > 1 && 'sm:grid-cols-2', years.length > 2 && 'lg:grid-cols-4')}>
            {years.map((y, i) => {
              const d = i > 0 ? calculateDelta(totals[0], totals[i]) : null;
              return (
                <Card key={y} className="glass-surface">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{getMonthName(month)} {y}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold financial-value tabular-nums">{formatCurrency(totals[i])}</div>
                    <div className="text-xs text-muted-foreground">{(txByYear[y] || []).length} movimentos</div>
                    {d && <div className="text-xs mt-1">{years[0]} vs {y}: <span className="financial-value font-medium">{formatCurrency(totals[0] - totals[i])}</span> ({formatPercentage(d.percentage)})</div>}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="glass-surface">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">O que explica a diferença</CardTitle>
              {catFilter && <Button variant="ghost" size="sm" onClick={() => setCatFilter(null)}><X className="mr-1 h-3 w-3" />Limpar filtro</Button>}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Categoria</TableHead><TableHead>Subcategoria</TableHead>
                  {years.map(y => <TableHead key={y} className="text-right">{y}</TableHead>)}
                  {years.length >= 2 && <TableHead className="text-right">Diferença</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {breakdown.map((r: any) => {
                    const diff = years.length >= 2 ? (r[years[0]] || 0) - (r[years[1]] || 0) : 0;
                    return (
                      <TableRow key={r.key} onClick={() => setCatFilter(catFilter === r.key ? null : r.key)}
                        className={cn('cursor-pointer', catFilter === r.key && 'bg-primary/10')}>
                        <TableCell className="text-sm font-medium">{r.cat}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.sub}</TableCell>
                        {years.map(y => <TableCell key={y} className="text-right financial-value tabular-nums text-sm">{formatCurrency(r[y] || 0)}</TableCell>)}
                        {years.length >= 2 && <TableCell className={cn('text-right financial-value tabular-nums text-sm font-medium', diff > 0 ? 'text-income' : diff < 0 ? 'text-expense' : '')}>{formatCurrency(diff)}</TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className={cn('grid gap-4', years.length > 1 && 'lg:grid-cols-2')}>
            {years.map(y => (
              <Card key={y} className="glass-surface">
                <CardHeader><CardTitle className="text-base">Movimentos — {getMonthName(month)} {y}</CardTitle></CardHeader>
                <CardContent>
                  {visible(y).length === 0 ? <p className="text-sm text-muted-foreground">Sem movimentos.</p> : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Valor</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {visible(y).map(t => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs whitespace-nowrap">{fd ? fd(t.date) : t.date}</TableCell>
                            <TableCell className="text-sm">{t.description || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{t.categories?.name || '—'}{t.subcategories?.name ? ` › ${t.subcategories.name}` : ''}</TableCell>
                            <TableCell className="text-right financial-value tabular-nums text-sm">{formatCurrency(Number(t.amount))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default MonthDetailPage;
