import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProfile } from '@/contexts/ActiveProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Undo2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: any;
  new_data: any;
  source: string;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  login: 'Acesso',
  insert: 'Criação',
  update: 'Edição',
  delete: 'Eliminação',
};

const actionColors: Record<string, string> = {
  login: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  insert: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  update: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const sourceLabels: Record<string, string> = {
  manual: 'Manual',
  import: 'Importação',
  recurring: 'Recorrência',
  telegram: 'Telegram',
  bulk: 'Lote',
  duplicate: 'Duplicação',
};

function getDescription(log: AuditLog): string {
  if (log.action === 'login') return 'Sessão iniciada';
  const data = log.new_data || log.old_data;
  if (!data) return '—';
  const parts: string[] = [];
  if (data.macro_group) parts.push(data.macro_group);
  if (data.notes) parts.push(data.notes);
  if (data.amount != null) parts.push(`${Number(data.amount).toFixed(2)} €`);
  if (data.date) parts.push(data.date);
  return parts.join(' · ') || '—';
}

const PAGE_SIZE = 50;

const LogsPage: React.FC = () => {
  const { user } = useAuth();
  const { activeUserId } = useActiveProfile();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterAction) query = query.eq('action', filterAction);
      if (filterEntity) query = query.eq('entity_type', filterEntity);
      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);

      const { data, count: total, error } = await query;
      if (error) throw error;
      setLogs((data as AuditLog[]) || []);
      setCount(total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, activeUserId, page, filterAction, filterEntity, startDate, endDate]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleRevert = async (log: AuditLog) => {
    if (log.entity_type !== 'transaction') {
      toast.error('Apenas movimentos podem ser revertidos');
      return;
    }
    try {
      if (log.action === 'insert' && log.entity_id) {
        const { error } = await supabase.from('transactions').delete().eq('id', log.entity_id);
        if (error) throw error;
        toast.success('Movimento criado foi eliminado');
      } else if (log.action === 'update' && log.entity_id && log.old_data) {
        const { id, created_at, updated_at, categories, subcategories, ...restoreData } = log.old_data;
        const { error } = await supabase.from('transactions').update(restoreData).eq('id', log.entity_id);
        if (error) throw error;
        toast.success('Movimento restaurado ao estado anterior');
      } else if (log.action === 'delete' && log.old_data) {
        const { id, created_at, updated_at, categories, subcategories, ...restoreData } = log.old_data;
        const { error } = await supabase.from('transactions').insert(restoreData);
        if (error) throw error;
        toast.success('Movimento re-inserido');
      } else {
        toast.error('Dados insuficientes para reverter');
        return;
      }
      loadLogs();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteLog = async (id: string) => {
    const { error } = await supabase.from('audit_logs').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Log apagado');
      loadLogs();
    }
  };

  const canRevert = (log: AuditLog) =>
    log.entity_type === 'transaction' && ['insert', 'update', 'delete'].includes(log.action);

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground">{count} registos encontrados</p>
      </div>

      <Card className="glass-surface">
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={filterAction} onValueChange={v => { setFilterAction(v === 'all' ? '' : v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Ação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="login">Acesso</SelectItem>
                <SelectItem value="insert">Criação</SelectItem>
                <SelectItem value="update">Edição</SelectItem>
                <SelectItem value="delete">Eliminação</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={v => { setFilterEntity(v === 'all' ? '' : v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="session">Sessão</SelectItem>
                <SelectItem value="transaction">Movimento</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(0); }} />
            <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(0); }} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Data/Hora</TableHead>
              <TableHead className="w-[100px]">Ação</TableHead>
              <TableHead className="w-[100px]">Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-[100px]">Origem</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem registos</TableCell></TableRow>
            ) : (
              logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm tabular-nums">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={actionColors[log.action] || ''}>
                      {actionLabels[log.action] || log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{log.entity_type === 'session' ? 'Sessão' : log.entity_type === 'transaction' ? 'Movimento' : log.entity_type}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{getDescription(log)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{sourceLabels[log.source] || log.source}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canRevert(log) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRevert(log)} title="Reverter">
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteLog(log.id)} title="Apagar log">
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
            <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
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
    </div>
  );
};

export default LogsPage;
