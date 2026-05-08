import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchCategories, fetchRecurringRules } from '@/lib/queries';
import { fetchImportRules, ImportRule } from '@/lib/importRules';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Sparkles, Ban } from 'lucide-react';
import { toast } from 'sonner';

interface Props { userId: string }

const ImportRulesTab: React.FC<Props> = ({ userId }) => {
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [filterBank, setFilterBank] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const [r, c] = await Promise.all([fetchImportRules(userId), fetchCategories(userId)]);
    setRules(r); setCategories(c || []);
    setLoading(false);
  };
  useEffect(() => { reload(); }, [userId]);

  const filtered = rules.filter(r =>
    (filterBank === 'all' || r.bank_source === filterBank) &&
    (filterType === 'all' || r.rule_type === filterType)
  );

  const toggle = async (r: ImportRule) => {
    await supabase.from('import_rules').update({ is_active: !r.is_active }).eq('id', r.id);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('Apagar esta regra?')) return;
    await supabase.from('import_rules').delete().eq('id', id);
    toast.success('Regra apagada');
    reload();
  };

  const catName = (id: string | null) => {
    if (!id) return '—';
    const c = categories.find((c: any) => c.id === id);
    return c?.name || '—';
  };
  const subName = (catId: string | null, subId: string | null) => {
    if (!subId) return '—';
    const c = categories.find((c: any) => c.id === catId);
    return c?.subcategories?.find((s: any) => s.id === subId)?.name || '—';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Banco</span>
          <Select value={filterBank} onValueChange={setFilterBank}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="cgd">CGD</SelectItem>
              <SelectItem value="revolut">Revolut</SelectItem>
              <SelectItem value="wizink">Wizink</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Tipo</span>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="categorize">Categorizar</SelectItem>
              <SelectItem value="ignore">Ignorar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="glass-surface overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Subcategoria</TableHead>
                <TableHead className="text-right">Usos</TableHead>
                <TableHead className="text-center">Ativa</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">A carregar...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Sem regras. Cria regras a partir das tuas importações.</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id} className={!r.is_active ? 'opacity-50' : ''}>
                  <TableCell>
                    {r.rule_type === 'ignore' ? (
                      <Badge variant="outline" className="text-xs"><Ban className="mr-1 h-3 w-3" />Ignorar</Badge>
                    ) : (
                      <Badge className="bg-income-muted text-income border-0 text-xs">
                        <Sparkles className="mr-1 h-3 w-3" />{r.auto_learned ? 'Auto' : 'Manual'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs uppercase">{r.bank_source}</TableCell>
                  <TableCell className="text-xs font-mono max-w-[260px] truncate" title={r.match_pattern}>{r.match_pattern}</TableCell>
                  <TableCell className="text-xs">{catName(r.category_id)}</TableCell>
                  <TableCell className="text-xs">{subName(r.category_id, r.subcategory_id)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{r.hit_count}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default ImportRulesTab;
