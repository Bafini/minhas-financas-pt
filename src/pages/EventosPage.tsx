import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Tag, Plus, Search, MapPin } from 'lucide-react';

const EventosPage: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [eventTxs, setEventTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDesc, setEventDesc] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Get event labels
      const { data: labels } = await supabase
        .from('event_labels')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      // Get distinct event_labels from transactions
      const { data: txLabels } = await supabase
        .from('transactions')
        .select('event_label, amount, date, macro_group')
        .eq('user_id', user.id)
        .not('event_label', 'is', null);

      setEvents(labels || []);
      setTransactions(txLabels || []);
      setLoading(false);
    };
    load();
  }, [user]);

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
    return Object.entries(map)
      .map(([label, data]) => ({
        label,
        ...data,
        startDate: data.dates.sort()[0],
        endDate: data.dates.sort()[data.dates.length - 1],
      }))
      .filter(e => !search || e.label.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.total - a.total);
  }, [transactions, search]);

  // Also find frequent notes that aren't events yet
  const suggestedEvents = useMemo(() => {
    const noteCount: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.event_label) return;
    });
    // Get notes from all transactions
    return [];
  }, [transactions]);

  const loadEventTransactions = async (label: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('transactions')
      .select('*, categories(name), subcategories(name)')
      .eq('user_id', user.id)
      .eq('event_label', label)
      .order('date');
    setEventTxs(data || []);
    setSelectedEvent(label);
  };

  const handleCreateEvent = async () => {
    if (!user || !eventName) return;
    const { error } = await supabase.from('event_labels').insert({
      user_id: user.id,
      name: eventName,
      description: eventDesc || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Evento criado');
      setDialogOpen(false);
      setEventName('');
      setEventDesc('');
    }
  };

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

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar eventos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {eventSummaries.map(event => (
          <Card
            key={event.label}
            className="glass-surface cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => loadEventTransactions(event.label)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{event.label}</h3>
              </div>
              <p className="text-lg font-bold financial-value">{formatCurrency(event.total)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {event.count} transações · {formatDate(event.startDate)} — {formatDate(event.endDate)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {eventSummaries.length === 0 && !loading && (
        <Card className="glass-surface">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Sem eventos. Adicione o campo event_label às transações para agrupar por evento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Event detail */}
      {selectedEvent && (
        <Card className="glass-surface">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {selectedEvent}
            </CardTitle>
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
            <div className="mt-4 text-right">
              <span className="text-sm font-medium">Total: </span>
              <span className="text-lg font-bold financial-value">
                {formatCurrency(eventTxs.reduce((s, t) => s + Number(t.amount), 0))}
              </span>
            </div>
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
