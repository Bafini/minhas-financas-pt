import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { TransactionRow } from '@/lib/queries';

interface DuplicateLine {
  date: string;
  amount: string;
}

interface DuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionRow | null;
  onSubmit: (lines: { date: string; amount: number }[]) => Promise<void>;
}

const groupBadgeClass: Record<string, string> = {
  Rendimentos: 'bg-income-muted text-income border-0',
  Despesas: 'bg-expense-muted text-expense border-0',
  Investimentos: 'bg-investment-muted text-investment border-0',
};

const DuplicateDialog: React.FC<DuplicateDialogProps> = ({ open, onOpenChange, transaction, onSubmit }) => {
  const [lines, setLines] = useState<DuplicateLine[]>([
    { date: new Date().toISOString().split('T')[0], amount: '' },
  ]);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open && transaction) {
      setLines([
        { date: transaction.date, amount: String(transaction.amount) },
        { date: transaction.date, amount: String(transaction.amount) },
      ]);
    }
  }, [open, transaction]);

  const addLine = () => {
    const lastLine = lines[lines.length - 1];
    setLines(prev => [...prev, { date: lastLine?.date || new Date().toISOString().split('T')[0], amount: lastLine?.amount || '' }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof DuplicateLine, value: string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const validLines = lines.filter(l => l.date && l.amount && parseFloat(l.amount) > 0);

  const handleSubmit = async () => {
    if (validLines.length === 0) return;
    setSaving(true);
    try {
      await onSubmit(validLines.map(l => ({ date: l.date, amount: parseFloat(l.amount) })));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicar Movimento</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={cn('text-xs', groupBadgeClass[transaction.macro_group])}>
                {transaction.macro_group}
              </Badge>
              <span>{transaction.categories?.name || '—'}</span>
              {transaction.subcategories?.name && (
                <span className="text-muted-foreground">› {transaction.subcategories.name}</span>
              )}
            </div>
            {transaction.event_label && (
              <p className="text-muted-foreground">Evento: {transaction.event_label}</p>
            )}
            <p className="text-muted-foreground">Original: {formatCurrency(Number(transaction.amount))}</p>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_120px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Data</span>
              <span className="text-right">Valor (€)</span>
              <span></span>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_120px_32px] gap-2 items-center">
                <Input
                  type="date"
                  value={line.date}
                  onChange={e => updateLine(idx, 'date', e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={line.amount}
                  onChange={e => updateLine(idx, 'amount', e.target.value)}
                  className="h-8 text-sm text-right"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeLine(idx)}
                  disabled={lines.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addLine} className="w-full">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Adicionar linha
            </Button>
          </div>
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

export default DuplicateDialog;
