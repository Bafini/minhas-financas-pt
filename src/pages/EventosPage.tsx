import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProfile } from '@/contexts/ActiveProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Tag, Plus, Search, MapPin, Trash2, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const EventosPage: React.FC = () => {
  const { user } = useAuth();
  const { activeUserId } = useActiveProfile();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [eventLabels, setEventLabels] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [eventTxs, setEventTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDesc, setEventDesc] = useState('');

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const [txs, labels] = await Promise.all([
      fetchAllRows((s) =>
        s.from('transactions').select('id, amount, date, macro_group, event_label').eq('user_id', activeUserId)
      ),
      supabase.from('event_labels').select('*').eq('user_id', activeUserId).order('name').then(r => r.data || []),
    ]);
    setTransactions(txs);
    setEventLabels(labels);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [user, activeUserId]);

  // Build event list from event_labels (source of truth), enriched with transaction aggregates
  const eventSummaries = useMemo(() => {
    // Aggregate transactions by event_label
    const txMap: Record<string, { total: number; count: number; dates: string[] }> = {};
    transactions.forEach(t => {
      if (!t.event_label) return;
      if (!txMap[t.event_label]) txMap[t.event_label] = { total: 0, count: 0, dates: [] };
      txMap[t.event_label].total += Number(t.amount);
      txMap[t.event_label].count++;
      txMap[t.event_label].dates.push(t.date);
    });

    return eventLabels
      .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()))
      .filter(l => showInactive || l.is_active)
      .map(label => {
        const data = txMap[label.name];
        const sortedDates = data?.dates.sort() || [];
        return {
          label: label.name,
          id: label.id,
          is_active: label.is_active,
          description: label.description,
          total: data?.total || 0,
          count: data?.count || 0,
          startDate: sortedDates[0] || null,
          endDate: sortedDates[sortedDates.length - 1] || null,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [eventLabels, transactions, search, showInactive]);

  const loadEventTransactions = async (label: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('transactions')
      .select('*, categories(name), subcategories(name)')
      .eq('user_id', activeUserId)
      .eq('event_label', label)
      .order('date');
    setEventTxs(data || []);
    setSelectedEvent(label);
  };

  const handleCreateEvent = async () => {
    if (!user || !eventName) return;
    const { error } = await supabase.from('event_labels').insert({
      user_id: activeUserId,
      name: eventName,
      description: eventDesc || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Evento criado');
      setDialogOpen(false);
      setEventName('');
      setEventDesc('');
      loadAll();
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('event_labels')
      .update({ is_active: !currentActive })
      .eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success(currentActive ? 'Evento desativado' : 'Evento ativado');
      loadAll();
    }
  };

  const handleDeleteEvent = async (label: string) => {
    if (!user) return;
    if (!confirm(`Eliminar evento "${label}"? As transações serão desassociadas mas não eliminadas.`)) return;
    const { error: txError } = await supabase
      .from('transactions')
      .update({ event_label: null })
      .eq('user_id', activeUserId)
      .eq('event_label', label);
    if (txError) { toast.error(txError.message); return; }
    await supabase.from('event_labels').delete().eq('user_id', activeUserId).eq('name', label);
    toast.success('Evento eliminado');
    setSelectedEvent(null);
    setEventTxs([]);
    loadAll();
  };

  const eventTotal = useMemo(() => eventTxs.reduce((s, t) => s + Number(t.amount), 0), [eventTxs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Eventos e Viagens</h1>
          <p className="text-sm text-muted-foreground">Agrupamento de transações por evento</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Evento
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar eventos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer">Mostrar inativos</Label>
          <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {eventSummaries.map(event => (
          <Card
            key={event.id}
            className={cn(
              'glass-surface cursor-pointer hover:shadow-md transition-all',
              selectedEvent === event.label && 'ring-2 ring-primary',
              !event.is_active && 'opacity-50'
            )}
            onClick={() => loadEventTransactions(event.label)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">{event.label}</h3>
                  {!event.is_active && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={event.is_active}
                    onCheckedChange={() => handleToggleActive(event.id, event.is_active)}
                    onClick={e => e.stopPropagation()}
                    className="scale-75"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={e => { e.stopPropagation(); handleDeleteEvent(event.label); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {event.count > 0 ? (
                <>
                  <p className="text-lg font-bold financial-value">{formatCurrency(event.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {event.count} transações · {formatDate(event.startDate!)} — {formatDate(event.endDate!)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Sem transações associadas</p>
                  {event.description && <p className="text-xs text-muted-foreground mt-1">{event.description}</p>}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {eventSummaries.length === 0 && !loading && (
        <Card className="glass-surface">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Sem eventos. Crie um evento para agrupar transações.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Event detail */}
      {selectedEvent && (
        <Card className="glass-surface">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {selectedEvent}
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Custo Total</p>
                  <p className="text-lg font-bold financial-value">{formatCurrency(eventTotal)}</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteEvent(selectedEvent)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Eliminar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Subcategoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventTxs.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="tabular-nums text-sm">{formatDate(tx.date)}</TableCell>
                    <TableCell className="text-sm">{tx.categories?.name || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.subcategories?.name || '—'}</TableCell>
                    <TableCell className="text-right financial-value text-sm">{formatCurrency(Number(tx.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Evento</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Ex: Viagem Açores" /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} /></div>
            <Button onClick={handleCreateEvent} className="w-full">Criar Evento</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventosPage;
