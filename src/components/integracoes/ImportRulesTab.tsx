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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Sparkles, Ban, Equal, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';

interface Props { userId: string }

function parsePattern(rule: ImportRule): { desc: string; amount: number | null; sign: string | null } {
  const p = rule.match_pattern || '';
  if (rule.match_field === 'description+amount') {
    const idx = p.lastIndexOf('|=');
    if (idx >= 0) {
      const amt = parseFloat(p.slice(idx + 2));
      return { desc: p.slice(0, idx), amount: isNaN(amt) ? null : amt, sign: null };
    }
  }
  if (rule.match_field === 'description+sign') {
    if (p.endsWith('|+')) return { desc: p.slice(0, -2), amount: null, sign: '+' };
    if (p.endsWith('|-')) return { desc: p.slice(0, -2), amount: null, sign: '-' };
  }
  return { desc: p, amount: null, sign: null };
}

const ImportRulesTab: React.FC<Props> = ({ userId }) => {
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [recurrings, setRecurrings] = useState<any[]>([]);
  const [filterBank, setFilterBank] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [exactDialog, setExactDialog] = useState<{ open: boolean; rule: ImportRule | null; amount: string }>({ open: false, rule: null, amount: '' });

  const reload = async () => {
    setLoading(true);
    const [r, c, rec] = await Promise.all([
      fetchImportRules(userId),
      fetchCategories(userId),
      fetchRecurringRules(userId).catch(() => []),
    ]);
    setRules(r); setCategories(c || []); setRecurrings(rec || []);
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

  const convertToGeneric = async (r: ImportRule) => {
    const { desc } = parsePattern(r);
    await supabase.from('import_rules').update({
      match_field: 'description',
      match_pattern: desc,
      priority: 100,
    }).eq('id', r.id);
    toast.success('Regra convertida para descrição genérica');
    reload();
  };

  const convertToExact = (r: ImportRule) => {
    setExactDialog({ open: true, rule: r, amount: '' });
  };

  const confirmConvertToExact = async () => {
    if (!exactDialog.rule) return;
    const amt = parseFloat(exactDialog.amount.replace(',', '.'));
    if (isNaN(amt)) { toast.error('Valor inválido'); return; }
    const { desc } = parsePattern(exactDialog.rule);
    await supabase.from('import_rules').update({
      match_field: 'description+amount',
      match_pattern: `${desc}|=${amt.toFixed(2)}`,
      priority: 150,
    }).eq('id', exactDialog.rule.id);
    toast.success('Regra agora exige valor exacto');
    setExactDialog({ open: false, rule: null, amount: '' });
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
                <TableHead>Match</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Subcategoria</TableHead>
                <TableHead>Recorrente</TableHead>
                <TableHead className="text-right">Usos</TableHead>
                <TableHead className="text-center">Ativa</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">A carregar...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">Sem regras. Cria regras a partir das tuas importações.</TableCell></TableRow>
              ) : filtered.map(r => {
                const parsed = parsePattern(r);
                const isExact = r.match_field === 'description+amount';
                return (
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
                  <TableCell className="text-xs font-mono max-w-[260px] truncate" title={parsed.desc}>{parsed.desc}</TableCell>
                  <TableCell>
                    {isExact && parsed.amount !== null ? (
                      <Badge className="text-[10px] bg-primary/10 text-primary border-0" title="Esta regra só aplica quando o valor coincide exactamente">
                        <Equal className="mr-1 h-2.5 w-2.5" />{formatCurrency(parsed.amount)}
                      </Badge>
                    ) : parsed.sign ? (
                      <Badge variant="outline" className="text-[10px]">desc + sinal {parsed.sign}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]"><Hash className="mr-1 h-2.5 w-2.5" />descrição</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{catName(r.category_id)}</TableCell>
                  <TableCell className="text-xs">{subName(r.category_id, r.subcategory_id)}</TableCell>
                  <TableCell className="text-xs">{(r as any).recurring_rule_id ? (recurrings.find((x: any) => x.id === (r as any).recurring_rule_id)?.name || '—') : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{r.hit_count}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      {r.rule_type === 'categorize' && (
                        isExact ? (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => convertToGeneric(r)} title="Converter para match só por descrição">
                            <Hash className="h-3 w-3" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => convertToExact(r)} title="Exigir também valor exacto">
                            <Equal className="h-3 w-3" />
                          </Button>
                        )
                      )}
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => remove(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );})}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={exactDialog.open} onOpenChange={(o) => setExactDialog(s => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exigir valor exacto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A regra só será aplicada quando o valor do movimento for exactamente este. Útil para distinguir vários movimentos com a mesma descrição mas valores diferentes (ex: vários seguros).
            </p>
            <Label className="text-xs">Valor (€)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="ex: -45,00"
              value={exactDialog.amount}
              onChange={(e) => setExactDialog(s => ({ ...s, amount: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExactDialog({ open: false, rule: null, amount: '' })}>Cancelar</Button>
            <Button onClick={confirmConvertToExact} disabled={!exactDialog.amount.trim()}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImportRulesTab;
