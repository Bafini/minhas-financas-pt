import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProfile } from '@/contexts/ActiveProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchCategories, fetchBudgets } from '@/lib/queries';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Plus, Target, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const OrcamentosPage: React.FC = () => {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [actuals, setActuals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formCatId, setFormCatId] = useState('');
  const [formAmount, setFormAmount] = useState('');

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [budgetData, catData] = await Promise.all([
      fetchBudgets(user.id, month, year),
      fetchCategories(user.id),
    ]);

    // Get actual spending for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const { data: txData } = await supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('user_id', user.id)
      .eq('macro_group', 'Despesas')
      .gte('date', startDate)
      .lt('date', endDate);

    const actualMap: Record<string, number> = {};
    txData?.forEach(t => {
      if (t.category_id) {
        actualMap[t.category_id] = (actualMap[t.category_id] || 0) + Number(t.amount);
      }
    });

    setBudgets(budgetData || []);
    setCategories(catData?.filter(c => c.group_type === 'Despesas') || []);
    setActuals(actualMap);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user, month, year]);

  const handleSave = async () => {
    if (!user || !formCatId || !formAmount) return;
    try {
      const existing = budgets.find(b => b.category_id === formCatId);
      if (existing) {
        await supabase.from('budgets').update({ amount: parseFloat(formAmount) }).eq('id', existing.id);
      } else {
        await supabase.from('budgets').insert({
          user_id: user.id,
          category_id: formCatId,
          amount: parseFloat(formAmount),
          month,
          year,
        });
      }
      toast.success('Orçamento guardado');
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleDateString('pt-PT', { month: 'long' }),
  }));

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalActual = Object.values(actuals).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">Controlo mensal por categoria</p>
        </div>
        <Button onClick={() => { setFormCatId(''); setFormAmount(''); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Definir Orçamento
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2022, 2023, 2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <Card className="glass-surface">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Total Orçamentado vs Realizado</span>
            <span className="text-sm tabular-nums">
              {formatCurrency(totalActual)} / {formatCurrency(totalBudget)}
            </span>
          </div>
          <Progress value={totalBudget > 0 ? Math.min((totalActual / totalBudget) * 100, 100) : 0} className="h-2" />
          {totalActual > totalBudget && totalBudget > 0 && (
            <p className="mt-2 flex items-center text-xs text-destructive">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Acima do orçamento em {formatCurrency(totalActual - totalBudget)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Budget per category */}
      <div className="grid gap-4 sm:grid-cols-2">
        {budgets.map(budget => {
          const actual = actuals[budget.category_id] || 0;
          const pct = Number(budget.amount) > 0 ? (actual / Number(budget.amount)) * 100 : 0;
          const overBudget = actual > Number(budget.amount);
          return (
            <Card key={budget.id} className="glass-surface">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{budget.categories?.name || 'Categoria'}</span>
                  <span className={cn('text-sm font-medium tabular-nums', overBudget && 'text-destructive')}>
                    {formatCurrency(actual)} / {formatCurrency(Number(budget.amount))}
                  </span>
                </div>
                <Progress value={Math.min(pct, 100)} className={cn('h-2', overBudget && '[&>div]:bg-destructive')} />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{pct.toFixed(0)}% utilizado</span>
                  {overBudget && <span className="text-destructive">+{formatCurrency(actual - Number(budget.amount))}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {budgets.length === 0 && !loading && (
        <Card className="glass-surface">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum orçamento definido para este mês</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={formCatId} onValueChange={setFormCatId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor Mensal (€)</Label>
              <Input type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(e.target.value)} />
            </div>
            <Button onClick={handleSave} className="w-full">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrcamentosPage;
