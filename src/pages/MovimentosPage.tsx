import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProfile } from '@/contexts/ActiveProfileContext';
import { fetchTransactions, fetchCategories, TransactionRow } from '@/lib/queries';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { fetchFuelCards, recalculateFuelCardIncome, FuelCard, getCardsForSubcategory, hasCardsForSubcategory } from '@/lib/fuelCardHelpers';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, ChevronLeft, ChevronRight, Pencil, Trash2, Plus, Check, X, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MacroGroup } from '@/lib/calculations';

const MACRO_GROUPS: MacroGroup[] = ['Rendimentos', 'Despesas', 'Investimentos'];

const groupBadgeClass: Record<MacroGroup, string> = {
  Rendimentos: 'bg-income-muted text-income border-0',
  Despesas: 'bg-expense-muted text-expense border-0',
  Investimentos: 'bg-investment-muted text-investment border-0',
};

const MovimentosPage: React.FC = () => {
  const { user, isDemo } = useAuth();
  const { activeUserId, canWrite } = useActiveProfile();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [macroGroup, setMacroGroup] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sheet
  const [editTx, setEditTx] = useState<TransactionRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newTx, setNewTx] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [formMacroGroup, setFormMacroGroup] = useState<MacroGroup>('Despesas');
  const [formFuelCardId, setFormFuelCardId] = useState('');

  // Inline add row
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineDate, setInlineDate] = useState(new Date().toISOString().split('T')[0]);
  const [inlineMacroGroup, setInlineMacroGroup] = useState<MacroGroup>('Despesas');
  const [inlineCategory, setInlineCategory] = useState('');
  const [inlineSubcategory, setInlineSubcategory] = useState('');
  const [inlineAmount, setInlineAmount] = useState('');
  const [inlineNotes, setInlineNotes] = useState('');
  const [inlineFuelCardId, setInlineFuelCardId] = useState('');

  // Fuel cards
  const [fuelCards, setFuelCards] = useState<FuelCard[]>([]);

  const pageSize = 50;

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [txResult, cats, fc] = await Promise.all([
        fetchTransactions(activeUserId, {
          search: search || undefined,
          macroGroup: (macroGroup as MacroGroup) || undefined,
          categoryId: categoryId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          pageSize,
        }),
        fetchCategories(activeUserId),
        fetchFuelCards(activeUserId),
      ]);
      setTransactions(txResult.data);
      setCount(txResult.count);
      setCategories(cats || []);
      setFuelCards(fc);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, activeUserId, search, macroGroup, categoryId, startDate, endDate, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const openEdit = (tx: TransactionRow) => {
    setEditTx(tx);
    setNewTx(false);
    setFormDate(tx.date);
    setFormAmount(String(tx.amount));
    setFormNotes(tx.notes || '');
    setFormCategory(tx.category_id || '');
    setFormSubcategory(tx.subcategory_id || '');
    setFormMacroGroup(tx.macro_group);
    setFormFuelCardId(tx.fuel_card_id || '');
    setSheetOpen(true);
  };

  const openNew = () => {
    setEditTx(null);
    setNewTx(true);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormAmount('');
    setFormNotes('');
    setFormCategory('');
    setFormSubcategory('');
    setFormMacroGroup('Despesas');
    setFormFuelCardId('');
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const fuelCardIdValue = isFuelSubcategory(formSubcategory, formMacroGroup) && formFuelCardId ? formFuelCardId : null;
    const payload = {
      user_id: activeUserId,
      date: formDate,
      amount: parseFloat(formAmount),
      notes: formNotes || null,
      category_id: formCategory || null,
      subcategory_id: formSubcategory || null,
      macro_group: formMacroGroup as MacroGroup,
      fuel_card_id: fuelCardIdValue,
    };

    try {
      if (newTx) {
        const { error } = await supabase.from('transactions').insert(payload);
        if (error) throw error;
        toast.success('Movimento criado');
      } else if (editTx) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', editTx.id);
        if (error) throw error;
        toast.success('Movimento atualizado');
      }
      // Recalculate fuel card income for this month if a fuel card was involved
      if (fuelCardIdValue || (editTx && editTx.fuel_card_id)) {
        const d = new Date(formDate);
        await recalculateFuelCardIncome(activeUserId, d.getFullYear(), d.getMonth() + 1, fuelCardIdValue || editTx!.fuel_card_id!);
      }
      setSheetOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (isDemo) { toast.error('A conta demo não permite apagar dados'); return; }
    if (!confirm('Eliminar este movimento?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      // Check if deleted tx had a fuel card — recalculate
      const deletedTx = transactions.find(t => t.id === id);
      if (deletedTx && deletedTx.fuel_card_id) {
        const d = new Date(deletedTx.date);
        await recalculateFuelCardIncome(activeUserId, d.getFullYear(), d.getMonth() + 1, deletedTx.fuel_card_id);
      }
      toast.success('Movimento eliminado');
      loadData();
    }
  };

  const handleInlineSave = async () => {
    if (!user || !inlineAmount || !inlineDate) return;
    const fuelCardIdValue = isFuelSubcategory(inlineSubcategory, inlineMacroGroup) && inlineFuelCardId ? inlineFuelCardId : null;
    const payload = {
      user_id: activeUserId,
      date: inlineDate,
      amount: parseFloat(inlineAmount),
      notes: inlineNotes || null,
      category_id: inlineCategory || null,
      subcategory_id: inlineSubcategory || null,
      macro_group: inlineMacroGroup,
      fuel_card_id: fuelCardIdValue,
    };
    try {
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) throw error;
      toast.success('Movimento criado');
      if (fuelCardIdValue) {
        const d = new Date(inlineDate);
        await recalculateFuelCardIncome(activeUserId, d.getFullYear(), d.getMonth() + 1, fuelCardIdValue);
      }
      // Reset inline but keep it open for next entry
      setInlineAmount('');
      setInlineNotes('');
      setInlineSubcategory('');
      setInlineFuelCardId('');
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Helper: check if a subcategory name is "Combustível" under Despesas
  const isFuelSubcategory = (subcatId: string, mg: string) => {
    if (mg !== 'Despesas' || !subcatId) return false;
    for (const cat of categories) {
      if (cat.group_type !== 'Despesas') continue;
      const sub = (cat.subcategories || []).find((s: any) => s.id === subcatId);
      if (sub && sub.name.toLowerCase().includes('combustível')) return true;
    }
    return false;
  };

  const activeFuelCards = fuelCards.filter(fc => fc.is_active);

  const inlineCatOptions = categories.filter(c => c.group_type === inlineMacroGroup);
  const inlineSelectedCat = categories.find(c => c.id === inlineCategory);
  const inlineSubcats = inlineSelectedCat?.subcategories || [];
  const showInlineFuelCard = isFuelSubcategory(inlineSubcategory, inlineMacroGroup);

  const selectedCat = categories.find(c => c.id === formCategory);
  const subcats = selectedCat?.subcategories || [];
  const showFormFuelCard = isFuelSubcategory(formSubcategory, formMacroGroup);

  const totalPages = Math.ceil(count / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movimentos</h1>
          <p className="text-sm text-muted-foreground">{count} transações encontradas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setInlineOpen(!inlineOpen)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Rápido
          </Button>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Movimento
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass-surface">
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar notas..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={macroGroup} onValueChange={v => { setMacroGroup(v === 'all' ? '' : v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Grupo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {MACRO_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={v => { setCategoryId(v === 'all' ? '' : v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(0); }} />
            <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(0); }} />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Data</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Subcategoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Inline add row */}
            {inlineOpen && (
              <TableRow className="bg-muted/30">
                <TableCell>
                  <Input type="date" value={inlineDate} onChange={e => setInlineDate(e.target.value)} className="h-8 text-sm w-[130px]" />
                </TableCell>
                <TableCell>
                  <Select value={inlineMacroGroup} onValueChange={v => { setInlineMacroGroup(v as MacroGroup); setInlineCategory(''); setInlineSubcategory(''); }}>
                    <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MACRO_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={inlineCategory} onValueChange={v => { setInlineCategory(v); setInlineSubcategory(''); }}>
                    <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      {inlineCatOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={inlineSubcategory} onValueChange={setInlineSubcategory} disabled={inlineSubcats.length === 0}>
                    <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Subcat." /></SelectTrigger>
                    <SelectContent>
                      {inlineSubcats.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={inlineAmount}
                    onChange={e => setInlineAmount(e.target.value)}
                    className="h-8 text-sm text-right w-[100px]"
                    onKeyDown={e => { if (e.key === 'Enter') handleInlineSave(); }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Notas..."
                    value={inlineNotes}
                    onChange={e => setInlineNotes(e.target.value)}
                    className="h-8 text-sm"
                    onKeyDown={e => { if (e.key === 'Enter') handleInlineSave(); }}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-income" onClick={handleInlineSave}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setInlineOpen(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : transactions.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sem movimentos</TableCell></TableRow>
            ) : (
              transactions.map(tx => (
                <TableRow key={tx.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(tx)}>
                  <TableCell className="tabular-nums text-sm">{formatDate(tx.date)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn('text-xs', groupBadgeClass[tx.macro_group])}>
                      {tx.macro_group}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{tx.categories?.name || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{tx.subcategories?.name || '—'}</TableCell>
                  <TableCell className="text-right financial-value font-medium text-sm">
                    {formatCurrency(Number(tx.amount))}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{tx.notes || ''}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(tx); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); handleDelete(tx.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Edit/New Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{newTx ? 'Novo Movimento' : 'Editar Movimento'}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={formMacroGroup} onValueChange={v => setFormMacroGroup(v as MacroGroup)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MACRO_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={formCategory} onValueChange={v => { setFormCategory(v); setFormSubcategory(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {categories
                    .filter(c => c.group_type === formMacroGroup)
                    .map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {subcats.length > 0 && (
              <div className="space-y-2">
                <Label>Subcategoria</Label>
                <Select value={formSubcategory} onValueChange={setFormSubcategory}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {subcats.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showFormFuelCard && (
              <div className="space-y-2">
                <Label>Cartão de Combustível</Label>
                <Select value={formFuelCardId || 'none'} onValueChange={v => setFormFuelCardId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {activeFuelCards.map(fc => (
                      <SelectItem key={fc.id} value={fc.id}>{fc.card_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Valor (€)</Label>
              <Input type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="flex-1">Guardar</Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MovimentosPage;
