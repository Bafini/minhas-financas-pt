import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProfile } from '@/contexts/ActiveProfileContext';
import { fetchRecurringRules, fetchCategories } from '@/lib/queries';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Repeat, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MacroGroup } from '@/lib/calculations';

const FREQUENCIES = [
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'yearly', label: 'Anual' },
];

const groupBadge: Record<string, string> = {
  Rendimentos: 'bg-income-muted text-income border-0',
  Despesas: 'bg-expense-muted text-expense border-0',
  Investimentos: 'bg-investment-muted text-investment border-0',
};

const RecorrenciasPage: React.FC = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formFreq, setFormFreq] = useState('monthly');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formGroup, setFormGroup] = useState<MacroGroup>('Despesas');
  const [formCatId, setFormCatId] = useState('');
  const [formSubId, setFormSubId] = useState('');
  const [formDay, setFormDay] = useState('1');

  const loadData = async () => {
    if (!user) return;
    const [r, c] = await Promise.all([fetchRecurringRules(user.id), fetchCategories(user.id)]);
    setRules(r || []);
    setCategories(c || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const openNew = () => {
    setEditing(null);
    setFormName(''); setFormAmount(''); setFormFreq('monthly');
    setFormStart(new Date().toISOString().split('T')[0]); setFormEnd('');
    setFormGroup('Despesas'); setFormCatId(''); setFormSubId('');
    setFormDay('1');
    setDialogOpen(true);
  };

  const openEdit = (rule: any) => {
    setEditing(rule);
    setFormName(rule.name); setFormAmount(String(rule.amount)); setFormFreq(rule.frequency);
    setFormStart(rule.start_date); setFormEnd(rule.end_date || '');
    setFormGroup(rule.macro_group); setFormCatId(rule.category_id || ''); setFormSubId(rule.subcategory_id || '');
    setFormDay(String(rule.day_of_period || 1));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formName || !formAmount || !formStart) return;
    const payload = {
      user_id: user.id,
      name: formName,
      amount: parseFloat(formAmount),
      frequency: formFreq as any,
      start_date: formStart,
      end_date: formEnd || null,
      macro_group: formGroup as MacroGroup,
      category_id: formCatId || null,
      subcategory_id: formSubId || null,
      day_of_period: parseInt(formDay) || 1,
    };
    try {
      if (editing) {
        await supabase.from('recurring_rules').update(payload).eq('id', editing.id);
        toast.success('Recorrência atualizada');
      } else {
        await supabase.from('recurring_rules').insert(payload);
        toast.success('Recorrência criada');
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta recorrência?')) return;
    await supabase.from('recurring_rules').delete().eq('id', id);
    toast.success('Recorrência eliminada');
    loadData();
  };

  const toggleActive = async (rule: any) => {
    await supabase.from('recurring_rules').update({ is_active: !rule.is_active }).eq('id', rule.id);
    loadData();
  };

  const generateOccurrences = async (rule: any) => {
    if (!user) return;
    const start = new Date(rule.start_date);
    const end = rule.end_date ? new Date(rule.end_date) : new Date();
    const txs: any[] = [];
    let current = new Date(start);

    while (current <= end) {
      txs.push({
        user_id: user.id,
        date: current.toISOString().split('T')[0],
        amount: Number(rule.amount),
        notes: rule.name,
        category_id: rule.category_id,
        subcategory_id: rule.subcategory_id,
        macro_group: rule.macro_group,
        is_recurring: true,
        recurring_rule_id: rule.id,
      });

      if (rule.frequency === 'daily') current.setDate(current.getDate() + 1);
      else if (rule.frequency === 'weekly') current.setDate(current.getDate() + 7);
      else if (rule.frequency === 'monthly') current.setMonth(current.getMonth() + 1);
      else if (rule.frequency === 'quarterly') current.setMonth(current.getMonth() + 3);
      else if (rule.frequency === 'yearly') current.setFullYear(current.getFullYear() + 1);
    }

    if (txs.length > 0) {
      const { error } = await supabase.from('transactions').insert(txs);
      if (error) toast.error(error.message);
      else toast.success(`${txs.length} ocorrências geradas`);
    }
  };

  const filteredCats = categories.filter(c => c.group_type === formGroup);
  const selectedCat = categories.find(c => c.id === formCatId);

  const dayLabel = formFreq === 'monthly' || formFreq === 'quarterly' ? 'Dia do mês' :
    formFreq === 'weekly' ? 'Dia da semana (1-7)' :
    formFreq === 'yearly' ? 'Dia do mês' : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recorrências</h1>
          <p className="text-sm text-muted-foreground">{rules.length} regras</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Recorrência
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rules.map(rule => (
          <Card key={rule.id} className={cn('glass-surface', !rule.is_active && 'opacity-50')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">{rule.name}</h3>
                <Badge className={cn('text-xs', groupBadge[rule.macro_group])}>{rule.macro_group}</Badge>
              </div>
              <p className="text-lg font-bold financial-value">{formatCurrency(Number(rule.amount))}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {FREQUENCIES.find(f => f.value === rule.frequency)?.label} · Dia {rule.day_of_period || '—'} · Desde {rule.start_date}
              </p>
              {rule.categories?.name && (
                <p className="text-xs text-muted-foreground">{rule.categories.name}{rule.subcategories?.name ? ` > ${rule.subcategories.name}` : ''}</p>
              )}
              <div className="mt-4 flex gap-2">
                <Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule)} />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(rule.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="ml-auto text-xs" onClick={() => generateOccurrences(rule)}>
                  Gerar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rules.length === 0 && !loading && (
        <Card className="glass-surface">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Repeat className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Sem recorrências definidas</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Recorrência' : 'Nova Recorrência'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={formName} onChange={e => setFormName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Valor (€)</Label><Input type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select value={formFreq} onValueChange={setFormFreq}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {formFreq !== 'daily' && (
                <div className="space-y-2">
                  <Label>{dayLabel}</Label>
                  <Input type="number" min="1" max={formFreq === 'weekly' ? '7' : '31'} value={formDay} onChange={e => setFormDay(e.target.value)} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={formGroup} onValueChange={v => { setFormGroup(v as MacroGroup); setFormCatId(''); setFormSubId(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rendimentos">Rendimentos</SelectItem>
                  <SelectItem value="Despesas">Despesas</SelectItem>
                  <SelectItem value="Investimentos">Investimentos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={formCatId} onValueChange={v => { setFormCatId(v); setFormSubId(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>{filteredCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedCat?.subcategories?.length > 0 && (
              <div className="space-y-2">
                <Label>Subcategoria</Label>
                <Select value={formSubId} onValueChange={setFormSubId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{selectedCat.subcategories.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Data Início</Label><Input type="date" value={formStart} onChange={e => setFormStart(e.target.value)} /></div>
              <div className="space-y-2"><Label>Data Fim (opc.)</Label><Input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} /></div>
            </div>
            <Button onClick={handleSave} className="w-full">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecorrenciasPage;
