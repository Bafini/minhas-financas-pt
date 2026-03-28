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
import { Tag, Plus, Search, MapPin, Trash2, Lightbulb, EyeOff } from 'lucide-react';
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
        s.from('transactions').select('id, amount, date, macro_group, event_label, notes').eq('user_id', activeUserId)
      ),
      supabase.from('event_labels').select('*').eq('user_id', activeUserId).order('name').then(r => r.data || []),
    ]);
    setTransactions(txs);
    setEventLabels(labels);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [user, activeUserId]);

  // Aggregate events from transactions
  const eventSummaries = useMemo(() => {
    const map: Record<string, { total: number; count: number; dates: string[] }> = {};
    transactions.forEach(t => {
      if (!t.event_label) return;
      if (!map[t.event_label]) map[t.event_label] = { total: 0, count: 0, dates: [] };
      map[t.event_label].total += Number(t.amount);
      map[t.event_label].count++;
      map[t.event_label].dates.push(t.date);
    });

    // Merge with event_labels to get is_active status
    const labelMap = new Map(eventLabels.map(l => [l.name, l]));

    return Object.entries(map)
      .map(([label, data]) => {
        const labelRecord = labelMap.get(label);
        return {
          label,
          ...data,
          startDate: data.dates.sort()[0],
          endDate: data.dates.sort()[data.dates.length - 1],
          is_active: labelRecord?.is_active ?? true,
        };
      })
      .filter(e => !search || e.label.toLowerCase().includes(search.toLowerCase()))
      .filter(e => showInactive || e.is_active)
      .sort((a, b) => b.total - a.total);
  }, [transactions, search, eventLabels, showInactive]);

  // Also show event_labels with no transactions yet
  const labelsWithoutTxs = useMemo(() => {
    const txLabels = new Set(transactions.filter(t => t.event_label).map(t => t.event_label));
    return eventLabels
      .filter(l => !txLabels.has(l.name))
      .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()))
      .filter(l => showInactive || l.is_active);
  }, [eventLabels, transactions, search, showInactive]);

  // Suggest events from frequent notes
  const suggestedEvents = useMemo(() => {
    const noteCount: Record<string, { count: number; total: number }> = {};
    const existingLabels = new Set(eventLabels.map(e => e.name.toLowerCase()));
    transactions.forEach(t => {
      if (t.event_label || !t.notes) return;
      const note = t.notes.trim();
      if (note.length < 3) return;
      if (!noteCount[note]) noteCount[note] = { count: 0, total: 0 };
      noteCount[note].count++;
      noteCount[note].total += Number(t.amount);
    });
    return Object.entries(noteCount)
      .filter(([note, data]) => data.count >= 3 && !existingLabels.has(note.toLowerCase()))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([note, data]) => ({ note, ...data }));
  }, [transactions, eventLabels]);

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

  const handleToggleActive = async (label: string, currentActive: boolean) => {
    const record = eventLabels.find(l => l.name === label);
    if (!record) return;
    const { error } = await supabase
      .from('event_labels')
      .update({ is_active: !currentActive })
      .eq('id', record.id);
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

  const handleCreateFromNote = async (note: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('transactions')
      .update({ event_label: note })
      .eq('user_id', activeUserId)
      .eq('notes', note)
      .is('event_label', null);
    if (error) { toast.error(error.message); return; }
    await supabase.from('event_labels').insert({ user_id: activeUserId, name: note }).single();
    toast.success(`Evento "${note}" criado com transações associadas`);
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
            key={event.label}
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
                    onCheckedChange={() => handleToggleActive(event.label, event.is_active)}
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
              <p className="text-lg font-bold financial-value">{formatCurrency(event.total)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {event.count} transações · {formatDate(event.startDate)} — {formatDate(event.endDate)}
              </p>
            </CardContent>
          </Card>
        ))}
        {/* Event labels without transactions */}
        {labelsWithoutTxs.map(label => (
          <Card
            key={label.id}
            className={cn(
              'glass-surface transition-all',
              !label.is_active && 'opacity-50'
            )}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">{label.name}</h3>
                  {!label.is_active && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={label.is_active}
                    onCheckedChange={() => handleToggleActive(label.name, label.is_active)}
                    className="scale-75"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDeleteEvent(label.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Sem transações associadas</p>
              {label.description && <p className="text-xs text-muted-foreground mt-1">{label.description}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {eventSummaries.length === 0 && labelsWithoutTxs.length === 0 && !loading && suggestedEvents.length === 0 && (
        <Card className="glass-surface">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Sem eventos. Crie um evento para agrupar transações.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Suggested events from notes */}
      {suggestedEvents.length > 0 && (
        <Card className="glass-surface">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-warning" />
              Sugestões de Eventos (baseado nas notas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suggestedEvents.map(s => (
                <div key={s.note} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{s.note}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.count} transações · Total: <span className="financial-value">{formatCurrency(s.total)}</span>
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleCreateFromNote(s.note)}>
                    <Plus className="mr-1 h-3 w-3" />
                    Criar Evento
                  </Button>
                </div>
              ))}
            </div>
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
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventTxs.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="tabular-nums text-sm">{formatDate(tx.date)}</TableCell>
                    <TableCell className="text-sm">{tx.categories?.name || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.subcategories?.name || '—'}</TableCell>
                    <TableCell className="text-right financial-value text-sm">{formatCurrency(Number(tx.amount))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.notes}</TableCell>
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
