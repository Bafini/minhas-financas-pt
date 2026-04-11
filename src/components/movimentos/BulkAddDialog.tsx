import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { MacroGroup } from '@/lib/calculations';

const MACRO_GROUPS: MacroGroup[] = ['Rendimentos', 'Despesas', 'Investimentos'];

interface BulkLine {
  date: string;
  macroGroup: MacroGroup;
  categoryId: string;
  subcategoryId: string;
  amount: string;
  eventLabel: string;
}

interface BulkAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: any[];
  eventLabels: any[];
  onSubmit: (lines: {
    date: string;
    macro_group: MacroGroup;
    category_id: string | null;
    subcategory_id: string | null;
    amount: number;
    event_label: string | null;
  }[]) => Promise<void>;
}

const emptyLine = (): BulkLine => ({
  date: new Date().toISOString().split('T')[0],
  macroGroup: 'Despesas',
  categoryId: '',
  subcategoryId: '',
  amount: '',
  eventLabel: '',
});

const adjustDate = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const BulkAddDialog: React.FC<BulkAddDialogProps> = ({ open, onOpenChange, categories, eventLabels, onSubmit }) => {
  const [lines, setLines] = useState<BulkLine[]>([]);
  const [saving, setSaving] = useState(false);

  // Shared defaults
  const [sharedGroup, setSharedGroup] = useState<string>('');
  const [sharedCategory, setSharedCategory] = useState<string>('');
  const [sharedEvent, setSharedEvent] = useState<string>('');

  useEffect(() => {
    if (open) {
      setLines([emptyLine(), emptyLine(), emptyLine()]);
      setSharedGroup('');
      setSharedCategory('');
      setSharedEvent('');
    }
  }, [open]);

  // Apply shared defaults when changed
  useEffect(() => {
    if (!sharedGroup) return;
    setLines(prev => prev.map(l => ({ ...l, macroGroup: sharedGroup as MacroGroup, categoryId: '', subcategoryId: '' })));
  }, [sharedGroup]);

  useEffect(() => {
    if (!sharedCategory) return;
    setLines(prev => prev.map(l => ({ ...l, categoryId: sharedCategory, subcategoryId: '' })));
  }, [sharedCategory]);

  useEffect(() => {
    if (!sharedEvent) return;
    setLines(prev => prev.map(l => ({ ...l, eventLabel: sharedEvent })));
  }, [sharedEvent]);

  const addLine = () => {
    const last = lines[lines.length - 1] || emptyLine();
    setLines(prev => [...prev, { ...emptyLine(), date: last.date, macroGroup: last.macroGroup, categoryId: last.categoryId, subcategoryId: last.subcategoryId, eventLabel: last.eventLabel }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, updates: Partial<BulkLine>) => {
    setLines(prev => prev.map((l, i) => {
      if (i < idx) return l;
      if (i === idx) {
        const updated = { ...l, ...updates };
        if ('macroGroup' in updates) { updated.categoryId = ''; updated.subcategoryId = ''; }
        if ('categoryId' in updates) { updated.subcategoryId = ''; }
        return updated;
      }
      // i > idx: propagar data para linhas seguintes
      if ('date' in updates) return { ...l, date: updates.date! };
      return l;
    }));
  };

  const getCatsForGroup = (group: MacroGroup) => categories.filter(c => c.group_type === group);
  const getSubcats = (catId: string) => categories.find(c => c.id === catId)?.subcategories || [];

  const validLines = lines.filter(l => l.date && l.amount && parseFloat(l.amount) > 0);

  const handleSubmit = async () => {
    if (validLines.length === 0) return;
    setSaving(true);
    try {
      await onSubmit(validLines.map(l => ({
        date: l.date,
        macro_group: l.macroGroup,
        category_id: l.categoryId || null,
        subcategory_id: l.subcategoryId || null,
        amount: parseFloat(l.amount),
        event_label: l.eventLabel || null,
      })));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const sharedCatOptions = sharedGroup ? getCatsForGroup(sharedGroup as MacroGroup) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Vários Movimentos</DialogTitle>
        </DialogHeader>

        {/* Shared defaults */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Pré-preencher todas as linhas:</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Grupo</Label>
              <Select value={sharedGroup || 'none'} onValueChange={v => setSharedGroup(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {MACRO_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={sharedCategory || 'none'} onValueChange={v => setSharedCategory(v === 'none' ? '' : v)} disabled={!sharedGroup}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {sharedCatOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Evento</Label>
              <Select value={sharedEvent || 'none'} onValueChange={v => setSharedEvent(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {eventLabels.map(el => <SelectItem key={el.id} value={el.name}>{el.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="space-y-2">
          <div className="grid grid-cols-[190px_110px_1fr_1fr_100px_130px_32px] gap-1.5 text-xs font-medium text-muted-foreground px-1">
            <span>Data</span>
            <span>Grupo</span>
            <span>Categoria</span>
            <span>Subcategoria</span>
            <span className="text-right">Valor (€)</span>
            <span>Evento</span>
            <span></span>
          </div>
          {lines.map((line, idx) => {
            const catOptions = getCatsForGroup(line.macroGroup);
            const subcatOptions = getSubcats(line.categoryId);
            return (
              <div key={idx} className="grid grid-cols-[190px_110px_1fr_1fr_100px_130px_32px] gap-1.5 items-center">
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => updateLine(idx, { date: adjustDate(line.date, -1) })}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Input type="date" value={line.date} onChange={e => updateLine(idx, { date: e.target.value })} className="h-8 text-xs px-1 min-w-0" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => updateLine(idx, { date: adjustDate(line.date, 1) })}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Select value={line.macroGroup} onValueChange={v => updateLine(idx, { macroGroup: v as MacroGroup })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MACRO_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={line.categoryId || 'none'} onValueChange={v => updateLine(idx, { categoryId: v === 'none' ? '' : v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cat." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {catOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={line.subcategoryId || 'none'} onValueChange={v => updateLine(idx, { subcategoryId: v === 'none' ? '' : v })} disabled={subcatOptions.length === 0}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Subcat." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {subcatOptions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={line.amount}
                  onChange={e => updateLine(idx, { amount: e.target.value })}
                  className="h-8 text-xs text-right"
                />
                <Select value={line.eventLabel || 'none'} onValueChange={v => updateLine(idx, { eventLabel: v === 'none' ? '' : v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Evento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {eventLabels.map(el => <SelectItem key={el.id} value={el.name}>{el.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={addLine} className="w-full">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Adicionar linha
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || validLines.length === 0}>
            {saving ? 'A criar...' : `Criar ${validLines.length} movimento${validLines.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAddDialog;
