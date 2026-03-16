import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProfile } from '@/contexts/ActiveProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchCategories } from '@/lib/queries';
import { formatCurrency } from '@/lib/formatters';
import { FuelCard, fetchFuelCards, getFuelCardMonthlySummary } from '@/lib/fuelCardHelpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Fuel, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

const CartoesCombustivelPage: React.FC = () => {
  const { user } = useAuth();
  const { activeUserId, canWrite } = useActiveProfile();
  const [cards, setCards] = useState<FuelCard[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCard, setEditCard] = useState<FuelCard | null>(null);
  const [summaries, setSummaries] = useState<any[]>([]);

  // Form state
  const [formName, setFormName] = useState('');
  const [formLimit, setFormLimit] = useState('');
  const [formSubcategoryId, setFormSubcategoryId] = useState('');
  const [formFrom, setFormFrom] = useState(new Date().toISOString().split('T')[0]);
  const [formTo, setFormTo] = useState('');
  const [formActive, setFormActive] = useState(true);

  // Month/year for summary
  const now = new Date();
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [cardsData, cats, summ] = await Promise.all([
        fetchFuelCards(activeUserId),
        fetchCategories(activeUserId),
        getFuelCardMonthlySummary(activeUserId, summaryYear, summaryMonth),
      ]);
      setCards(cardsData);
      setCategories(cats || []);
      setSummaries(summ);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, summaryYear, summaryMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const incomeSubcategories = categories
    .filter(c => c.group_type === 'Rendimentos')
    .flatMap(c => (c.subcategories || []).map((s: any) => ({
      ...s,
      categoryName: c.name,
    })));

  const openNew = () => {
    setEditCard(null);
    setFormName('');
    setFormLimit('');
    setFormSubcategoryId('');
    setFormFrom(new Date().toISOString().split('T')[0]);
    setFormTo('');
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEdit = (card: FuelCard) => {
    setEditCard(card);
    setFormName(card.card_name);
    setFormLimit(String(card.monthly_limit));
    setFormSubcategoryId(card.income_subcategory_id || '');
    setFormFrom(card.effective_from);
    setFormTo(card.effective_to || '');
    setFormActive(card.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formName || !formLimit) return;
    const payload = {
      user_id: user.id,
      card_name: formName,
      monthly_limit: parseFloat(formLimit),
      income_subcategory_id: formSubcategoryId || null,
      effective_from: formFrom,
      effective_to: formTo || null,
      is_active: formActive,
    };

    try {
      if (editCard) {
        const { error } = await supabase.from('fuel_cards').update(payload).eq('id', editCard.id);
        if (error) throw error;
        toast.success('Cartão atualizado');
      } else {
        const { error } = await supabase.from('fuel_cards').insert(payload);
        if (error) throw error;
        toast.success('Cartão criado');
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este cartão de combustível?')) return;
    const { error } = await supabase.from('fuel_cards').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Cartão eliminado');
      loadData();
    }
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cartões de Combustível</h1>
          <p className="text-sm text-muted-foreground">Gestão de cartões e plafonds mensais</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cartão
        </Button>
      </div>

      {/* Monthly Summary */}
      <Card className="glass-surface">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5" />
              Resumo Mensal
            </CardTitle>
            <div className="flex gap-2">
              <Select value={String(summaryMonth)} onValueChange={v => setSummaryMonth(Number(v))}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthNames.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(summaryYear)} onValueChange={v => setSummaryYear(Number(v))}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, i) => 2021 + i).map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem cartões configurados</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {summaries.map(s => {
                const pct = s.monthlyLimit > 0 ? Math.min(100, (s.totalSpent / s.monthlyLimit) * 100) : 0;
                return (
                  <Card key={s.card.id} className="border">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{s.card.card_name}</span>
                        </div>
                        {!s.card.is_active && (
                          <Badge variant="secondary" className="text-xs">Inativo</Badge>
                        )}
                      </div>
                      <Progress value={pct} className="h-2" />
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Plafond</p>
                          <p className="financial-value font-medium">{formatCurrency(s.monthlyLimit)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Gasto</p>
                          <p className="financial-value font-medium">{formatCurrency(s.totalSpent)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Rendimento</p>
                          <p className="financial-value font-medium text-income">{formatCurrency(s.recognized)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Disponível</p>
                          <p className={cn("financial-value font-medium", s.remaining > 0 ? "text-income" : "text-muted-foreground")}>
                            {formatCurrency(s.remaining)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards List */}
      <Card className="glass-surface">
        <CardHeader>
          <CardTitle>Cartões Configurados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar...</p>
          ) : cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cartão de combustível configurado.</p>
          ) : (
            <div className="space-y-3">
              {cards.map(card => (
                <div key={card.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{card.card_name}</span>
                      {!card.is_active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Plafond: {formatCurrency(Number(card.monthly_limit))}</span>
                      <span>Subcategoria: {card.subcategories?.name || '—'}</span>
                      <span>Desde: {card.effective_from}</span>
                      {card.effective_to && <span>Até: {card.effective_to}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(card)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(card.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCard ? 'Editar Cartão' : 'Novo Cartão de Combustível'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome do Cartão</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Cartão X" />
            </div>
            <div className="space-y-2">
              <Label>Plafond Mensal (€)</Label>
              <Input type="number" step="0.01" value={formLimit} onChange={e => setFormLimit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Subcategoria de Rendimento</Label>
              <Select value={formSubcategoryId} onValueChange={setFormSubcategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {incomeSubcategories.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.categoryName} › {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={formFrom} onChange={e => setFormFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim (opcional)</Label>
                <Input type="date" value={formTo} onChange={e => setFormTo(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formActive} onCheckedChange={setFormActive} />
              <Label>Ativo</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} className="flex-1">Guardar</Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CartoesCombustivelPage;
