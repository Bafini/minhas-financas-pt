import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchCategories, fetchRecurringRules } from '@/lib/queries';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { parseBankFile, ParsedBankRow, BankSource } from '@/lib/bankParsers';
import { fetchImportRules, findMatchingRule, learnCategorizeRule, createIgnoreRule, normalizeDescription, ImportRule } from '@/lib/importRules';
import { MacroGroup } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle2, Loader2, AlertTriangle, Ban, Sparkles, Wand2, CalendarIcon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format } from 'date-fns';

interface PossibleDuplicate {
  id: string;
  date: string;
  amount: number;
  notes: string | null;
  categoryName: string | null;
  bankSource: string | null;
  daysDiff: number;
}

interface PreviewRow extends ParsedBankRow {
  rowId: number;
  ignore: boolean;
  isDuplicate: boolean;
  isExisting: boolean;
  matchedRuleId: string | null;
  matchedRuleField: string | null;
  matchedAuto: boolean;
  matchedIgnore: boolean;
  macroGroup: MacroGroup;
  categoryId: string | null;
  subcategoryId: string | null;
  recurringRuleId: string | null;
  replacesAutoId: string | null;
  recurringExpectedAmount: number | null;
  divergenceResolution: 'file' | 'rule' | null;
  matchExactAmount: boolean;
  possibleDuplicateOf: PossibleDuplicate | null;
  possibleDuplicateDismissed: boolean;
  forceImport: boolean;
}

const BANK_OPTIONS: { value: BankSource | 'auto'; label: string; accept: string }[] = [
  { value: 'auto', label: 'Auto-detetar', accept: '.csv,.xls,.xlsx' },
  { value: 'cgd', label: 'Caixa Geral de Depósitos (CSV)', accept: '.csv' },
  { value: 'revolut', label: 'Revolut (CSV)', accept: '.csv' },
  { value: 'wizink', label: 'Wizink (XLS)', accept: '.xls,.xlsx' },
  { value: 'manual', label: 'Formato genérico (CSV)', accept: '.csv' },
];

interface BankImportTabProps { userId: string }

const BankImportTab: React.FC<BankImportTabProps> = ({ userId }) => {
  const [bank, setBank] = useState<BankSource | 'auto'>('auto');
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [result, setResult] = useState<{ imported: number; ignored: number; duplicates: number; errors: number; skippedByDate: number } | null>(null);
  const [ignoreDialog, setIgnoreDialog] = useState<{ open: boolean; rowId: number | null; pattern: string }>({ open: false, rowId: null, pattern: '' });

  const [recurrings, setRecurrings] = useState<any[]>([]);
  const [autoByRulePeriod, setAutoByRulePeriod] = useState<Map<string, { id: string; amount: number }>>(new Map());

  const [cutoffMode, setCutoffMode] = useState<'last' | 'custom' | 'all'>('last');
  const [customCutoffDate, setCustomCutoffDate] = useState<Date | null>(null);
  const [bankDates, setBankDates] = useState<Record<string, string | null>>({});
  const [defaultDivergenceResolution, setDefaultDivergenceResolution] = useState<'file' | 'rule'>('file');
  const [previewBankSource, setPreviewBankSource] = useState<BankSource | null>(null);
  const [lastImported, setLastImported] = useState<Array<{ id: string; date: string; amount: number; notes: string | null; macro_group: MacroGroup; category_id: string | null }>>([]);

  useEffect(() => {
    fetchCategories(userId).then(setCategories);
    fetchImportRules(userId).then(setRules).catch(() => setRules([]));
    fetchRecurringRules(userId).then(setRecurrings).catch(() => setRecurrings([]));
    supabase.from('bank_update_dates').select('bank_source, last_date').eq('user_id', userId)
      .then(({ data }) => {
        const map: Record<string, string | null> = {};
        (data || []).forEach((r: any) => { map[r.bank_source] = r.last_date; });
        setBankDates(map);
      });
  }, [userId]);

  const currentBank = useMemo<BankSource | null>(() => {
    if (bank !== 'auto') return bank;
    return previewBankSource;
  }, [bank, previewBankSource]);

  const lastUpdatedDate = currentBank ? (bankDates[currentBank] || null) : null;

  const effectiveCutoff = useMemo<string | null>(() => {
    if (cutoffMode === 'all') return null;
    if (cutoffMode === 'last') return lastUpdatedDate;
    if (cutoffMode === 'custom' && customCutoffDate) {
      const y = customCutoffDate.getFullYear();
      const m = String(customCutoffDate.getMonth() + 1).padStart(2, '0');
      const d = String(customCutoffDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return null;
  }, [cutoffMode, customCutoffDate, lastUpdatedDate]);

  const isBeforeCutoff = useCallback((date: string) => {
    if (!effectiveCutoff) return false;
    return date < effectiveCutoff;
  }, [effectiveCutoff]);

  const accept = useMemo(() => BANK_OPTIONS.find(b => b.value === bank)?.accept || '.csv', [bank]);

  const handleFile = (f: File | null) => { setFile(f); };

  const handleParse = useCallback(async () => {
    if (!file) return;
    const parsed = await parseBankFile(file, bank);
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      toast.error(parsed.errors[0]);
      return;
    }
    if (parsed.errors.length > 0) {
      toast.warning(`${parsed.errors.length} avisos durante a leitura`);
    }

    const existing = await fetchAllRows((sb) =>
      sb.from('transactions')
        .select('id, date, amount, external_ref, notes, bank_source, category_id')
        .eq('user_id', userId)
        .order('id')
    );
    const existingSet = new Set<string>();
    const existingByDateAmount = new Map<string, any[]>();
    (existing || []).forEach((e: any) => {
      const ref = e.external_ref || e.notes || '';
      const absAmt = Math.abs(Number(e.amount)).toFixed(2);
      existingSet.add(`${e.date}|${absAmt}|${e.bank_source || 'manual'}|${ref}`);
      const k = `${e.date}|${absAmt}`;
      const arr = existingByDateAmount.get(k) || [];
      arr.push(e);
      existingByDateAmount.set(k, arr);
    });

    // Also index by amount alone, for ±3 days window
    const existingByAmount = new Map<string, any[]>();
    (existing || []).forEach((e: any) => {
      const k = Math.abs(Number(e.amount)).toFixed(2);
      const arr = existingByAmount.get(k) || [];
      arr.push(e);
      existingByAmount.set(k, arr);
    });

    const catNameById = new Map<string, string>();
    (categories || []).forEach((c: any) => catNameById.set(c.id, c.name));

    // Fetch auto-generated recurring transactions to detect replacements
    const autoGen = await fetchAllRows((sb) =>
      sb.from('transactions')
        .select('id, date, amount, recurring_rule_id')
        .eq('user_id', userId)
        .eq('auto_generated', true)
        .not('recurring_rule_id', 'is', null)
        .order('id')
    );
    const autoByRulePeriodLocal = new Map<string, { id: string; amount: number }>();
    (autoGen || []).forEach((t: any) => {
      const d = new Date(t.date);
      const key = `${t.recurring_rule_id}|${d.getFullYear()}-${d.getMonth()}`;
      autoByRulePeriodLocal.set(key, { id: t.id, amount: Number(t.amount) });
    });
    setAutoByRulePeriod(autoByRulePeriodLocal);

    const findPossibleDuplicate = (r: ParsedBankRow): PossibleDuplicate | null => {
      const amountKey = Math.abs(r.amount).toFixed(2);
      const refKey = r.externalRef || '';
      const strictKey = `${r.date}|${amountKey}|${r.bankSource}|${refKey}`;
      // Same date + amount, different ref/bank
      const sameDay = existingByDateAmount.get(`${r.date}|${amountKey}`) || [];
      for (const e of sameDay) {
        const eRef = e.external_ref || e.notes || '';
        const eKey = `${e.date}|${Math.abs(Number(e.amount)).toFixed(2)}|${e.bank_source || 'manual'}|${eRef}`;
        if (eKey === strictKey) continue;
        return {
          id: e.id, date: e.date, amount: Number(e.amount),
          notes: e.notes, bankSource: e.bank_source,
          categoryName: e.category_id ? (catNameById.get(e.category_id) || null) : null,
          daysDiff: 0,
        };
      }
      // ±3 days, same amount
      const sameAmount = existingByAmount.get(amountKey) || [];
      const rowDate = new Date(r.date);
      for (const e of sameAmount) {
        const eDate = new Date(e.date);
        const diffDays = Math.round((rowDate.getTime() - eDate.getTime()) / 86400000);
        if (diffDays === 0) continue;
        if (Math.abs(diffDays) > 3) continue;
        return {
          id: e.id, date: e.date, amount: Number(e.amount),
          notes: e.notes, bankSource: e.bank_source,
          categoryName: e.category_id ? (catNameById.get(e.category_id) || null) : null,
          daysDiff: diffDays,
        };
      }
      return null;
    };

    const preview: PreviewRow[] = parsed.rows.map((r, i) => {
      const match = findMatchingRule(r, rules);
      const isExisting = existingSet.has(`${r.date}|${Math.abs(r.amount).toFixed(2)}|${r.bankSource}|${r.externalRef}`);
      const macroGroup: MacroGroup =
        match?.rule.macro_group ||
        (r.amount >= 0 ? 'Rendimentos' : 'Despesas');
      const recurringRuleId = (match?.rule as any)?.recurring_rule_id || null;
      let replacesAutoId: string | null = null;
      let recurringExpectedAmount: number | null = null;
      if (recurringRuleId) {
        const d = new Date(r.date);
        const found = autoByRulePeriodLocal.get(`${recurringRuleId}|${d.getFullYear()}-${d.getMonth()}`);
        if (found) { replacesAutoId = found.id; recurringExpectedAmount = found.amount; }
        const rec = recurrings.find((x: any) => x.id === recurringRuleId);
        if (rec && recurringExpectedAmount === null) recurringExpectedAmount = Number(rec.amount);
      }
      const diverges = recurringRuleId && recurringExpectedAmount !== null && Math.abs(recurringExpectedAmount - Math.abs(r.amount)) > 0.005;
      const possibleDuplicateOf = isExisting ? null : findPossibleDuplicate(r);
      return {
        ...r,
        rowId: i,
        ignore: match?.rule.rule_type === 'ignore' || false,
        isDuplicate: false,
        isExisting,
        matchedRuleId: match?.rule.id || null,
        matchedRuleField: match?.rule.match_field || null,
        matchedAuto: match?.rule.auto_learned || false,
        matchedIgnore: match?.rule.rule_type === 'ignore' || false,
        macroGroup,
        categoryId: match?.rule.category_id || null,
        subcategoryId: match?.rule.subcategory_id || null,
        recurringRuleId,
        replacesAutoId,
        recurringExpectedAmount,
        divergenceResolution: diverges ? defaultDivergenceResolution : null,
        matchExactAmount: match?.rule.match_field === 'description+amount',
        possibleDuplicateOf,
        possibleDuplicateDismissed: false,
        forceImport: false,
      };
    });

    const seen = new Set<string>();
    preview.forEach(r => {
      const k = `${r.date}|${Math.abs(r.amount).toFixed(2)}|${r.bankSource}|${r.externalRef}`;
      if (seen.has(k)) r.isDuplicate = true;
      seen.add(k);
    });

    setRows(preview);
    setPreviewBankSource(parsed.bankSource);
    try {
      const { data: lastData } = await supabase
        .from('transactions')
        .select('id, date, amount, notes, macro_group, category_id')
        .eq('user_id', userId)
        .eq('bank_source', parsed.bankSource)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);
      setLastImported((lastData || []) as any);
    } catch {
      setLastImported([]);
    }
    setStep('preview');
  }, [file, bank, userId, rules, recurrings, defaultDivergenceResolution]);

  const updateRow = (rowId: number, patch: Partial<PreviewRow>) => {
    setRows(prev => prev.map(r => r.rowId === rowId ? { ...r, ...patch } : r));
  };

  const handleApplyToSimilar = (rowId: number) => {
    const src = rows.find(r => r.rowId === rowId);
    if (!src || !src.categoryId) return;
    const srcNorm = normalizeDescription(src.description);
    let count = 0;
    setRows(prev => prev.map(r => {
      if (r.rowId === rowId) return r;
      const norm = normalizeDescription(r.description);
      if (norm && srcNorm && norm.includes(srcNorm.split(' ').slice(0, 3).join(' '))) {
        count++;
        return { ...r, categoryId: src.categoryId, subcategoryId: src.subcategoryId, macroGroup: src.macroGroup };
      }
      return r;
    }));
    if (count > 0) toast.success(`Aplicado a ${count} linhas semelhantes`);
  };

  const openIgnoreDialog = (rowId: number) => {
    const r = rows.find(x => x.rowId === rowId);
    if (!r) return;
    setIgnoreDialog({ open: true, rowId, pattern: normalizeDescription(r.description) });
  };

  const confirmIgnoreRule = async () => {
    if (ignoreDialog.rowId === null) return;
    const row = rows.find(r => r.rowId === ignoreDialog.rowId);
    if (!row) return;
    await createIgnoreRule(userId, row.bankSource, ignoreDialog.pattern);
    toast.success('Regra de exclusão criada');
    setRows(prev => prev.map(r => {
      if (normalizeDescription(r.description).includes(ignoreDialog.pattern)) {
        return { ...r, ignore: true, matchedIgnore: true };
      }
      return r;
    }));
    const fresh = await fetchImportRules(userId);
    setRules(fresh);
    setIgnoreDialog({ open: false, rowId: null, pattern: '' });
  };

  const handleImport = async () => {
    setStep('importing');
    const detectedBank = rows[0]?.bankSource || (bank === 'auto' ? 'manual' : bank);

    const { data: importRecord } = await supabase.from('imports').insert({
      user_id: userId,
      filename: file?.name || 'import.csv',
      total_rows: rows.length,
      bank_source: detectedBank,
      status: 'processing',
    }).select().single();

    const toImport = rows.filter(r => !r.ignore && !isBeforeCutoff(r.date) && (r.forceImport || (!r.isDuplicate && !r.isExisting)));
    setImportTotal(toImport.length); setImportProgress(0);
    let imported = 0;
    let errors = 0;
    const ignored = rows.filter(r => r.ignore).length;
    const duplicates = rows.filter(r => (r.isDuplicate || r.isExisting) && !r.forceImport).length;
    const skippedByDate = rows.filter(r => isBeforeCutoff(r.date) && !r.ignore && !r.forceImport && !r.isDuplicate && !r.isExisting).length;

    const replacedAutoIds = new Set<string>();
    const updatedRuleIds = new Set<string>();
    let maxImportedDate: string | null = null;

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];

      const absAmount = Math.abs(row.amount);
      const diverges = row.recurringRuleId && row.recurringExpectedAmount !== null && Math.abs(row.recurringExpectedAmount - absAmount) > 0.005;
      const useRuleAmount = diverges && row.divergenceResolution === 'rule';
      const finalAmount = useRuleAmount ? (row.recurringExpectedAmount as number) : absAmount;
      let finalNotes = row.description;
      if (useRuleAmount) {
        const diff = absAmount - (row.recurringExpectedAmount as number);
        const sign = diff >= 0 ? '+' : '';
        finalNotes = `${row.description} | Diferença vs ficheiro: ${sign}${formatCurrency(diff)}`;
      }

      // Replace auto-generated transaction (only first occurrence per period)
      if (row.recurringRuleId && row.replacesAutoId && !replacedAutoIds.has(row.replacesAutoId)) {
        await supabase.from('transactions').delete().eq('id', row.replacesAutoId);
        replacedAutoIds.add(row.replacesAutoId);
      }

      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        date: row.date,
        amount: finalAmount,
        notes: finalNotes,
        category_id: row.categoryId,
        subcategory_id: row.subcategoryId,
        macro_group: row.macroGroup,
        bank_source: row.bankSource,
        external_ref: row.externalRef,
        import_id: importRecord?.id,
        is_recurring: !!row.recurringRuleId,
        recurring_rule_id: row.recurringRuleId,
        auto_generated: false,
      });
      if (error) errors++; else {
        imported++;
        if (!maxImportedDate || row.date > maxImportedDate) maxImportedDate = row.date;

        // Update recurring rule amount only when user chose 'file' resolution
        if (diverges && !useRuleAmount && row.recurringRuleId && !updatedRuleIds.has(row.recurringRuleId)) {
          const rec = recurrings.find((x: any) => x.id === row.recurringRuleId);
          await supabase.from('recurring_rules').update({ amount: absAmount }).eq('id', row.recurringRuleId);
          toast.info(`Valor da recorrência «${rec?.name || ''}» atualizado: ${formatCurrency(row.recurringExpectedAmount as number)} → ${formatCurrency(absAmount)}`);
          updatedRuleIds.add(row.recurringRuleId);
        }

        const matchedIsExact = row.matchedRuleField === 'description+amount';
        const shouldLearn = (row.categoryId || row.recurringRuleId) && (!row.matchedRuleId || (row.matchExactAmount && !matchedIsExact));
        if (shouldLearn) {
          await learnCategorizeRule(userId, row, row.categoryId, row.subcategoryId, row.macroGroup, row.recurringRuleId, row.matchExactAmount);
        }
      }
      setImportProgress(i + 1);
    }

    if (importRecord) {
      await supabase.from('imports').update({
        imported_rows: imported,
        duplicate_rows: duplicates,
        error_rows: errors,
        status: 'completed',
      }).eq('id', importRecord.id);
    }

    if (maxImportedDate && (!lastUpdatedDate || maxImportedDate > lastUpdatedDate)) {
      await supabase.from('bank_update_dates').upsert(
        { user_id: userId, bank_source: detectedBank, last_date: maxImportedDate },
        { onConflict: 'user_id,bank_source' }
      );
      setBankDates(prev => ({ ...prev, [detectedBank]: maxImportedDate }));
    }

    setResult({ imported, ignored, duplicates, errors, skippedByDate });
    setStep('done');
    toast.success(`${imported} movimentos importados`);
  };

  const counts = useMemo(() => {
    const skippedByDate = rows.filter(r => isBeforeCutoff(r.date)).length;
    return {
      total: rows.length,
      auto: rows.filter(r => r.matchedRuleId && !r.matchedIgnore).length,
      pending: rows.filter(r => !r.ignore && !r.categoryId && !r.isDuplicate && !r.isExisting && !isBeforeCutoff(r.date)).length,
      ignored: rows.filter(r => r.ignore).length,
      duplicates: rows.filter(r => (r.isDuplicate || r.isExisting) && !r.forceImport).length,
      possibleDuplicates: rows.filter(r => r.possibleDuplicateOf && !r.possibleDuplicateDismissed && !r.ignore && !r.isExisting).length,
      skippedByDate,
      importable: rows.filter(r => !r.ignore && !isBeforeCutoff(r.date) && (r.forceImport || (!r.isDuplicate && !r.isExisting))).length,
    };
  }, [rows, isBeforeCutoff]);

  if (step === 'upload') {
    return (
      <Card className="glass-surface">
        <CardHeader>
          <CardTitle className="text-base">Carregar Extrato Bancário</CardTitle>
          <CardDescription>Suporta CSV de CGD e Revolut. Wizink (PDF) em breve.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Banco / Formato</Label>
            <Select value={bank} onValueChange={(v) => setBank(v as any)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BANK_OPTIONS.map(b => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{file ? file.name : 'Clique para selecionar o ficheiro'}</span>
            <input type="file" accept={accept} onChange={(e) => handleFile(e.target.files?.[0] || null)} className="hidden" />
          </label>
          {file && (
            <Button onClick={handleParse} className="w-full">
              <FileText className="mr-2 h-4 w-4" />Analisar Ficheiro
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === 'importing') {
    const pct = importTotal > 0 ? Math.round((importProgress / importTotal) * 100) : 0;
    return (
      <Card className="glass-surface">
        <CardContent className="space-y-4 py-12">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">A importar...</span>
          </div>
          <div className="mx-auto max-w-md space-y-2">
            <Progress value={pct} className="h-3" />
            <p className="text-center text-sm tabular-nums text-muted-foreground">{importProgress} / {importTotal} ({pct}%)</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'done' && result) {
    return (
      <Card className="glass-surface">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-income" />Importação Concluída
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{result.imported} movimentos importados</p>
          {result.ignored > 0 && <p className="text-sm text-muted-foreground">{result.ignored} ignorados por regra</p>}
          {result.duplicates > 0 && <p className="text-sm text-muted-foreground">{result.duplicates} duplicados</p>}
          {result.skippedByDate > 0 && <p className="text-sm text-muted-foreground">{result.skippedByDate} ignorados por data de corte</p>}
          {result.errors > 0 && <p className="text-sm text-destructive">{result.errors} erros</p>}
          <Button className="mt-4" onClick={() => { setStep('upload'); setFile(null); setRows([]); setResult(null); }}>
            Nova Importação
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-surface">
        <CardContent className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Importar a partir de</Label>
              <RadioGroup value={cutoffMode} onValueChange={(v) => setCutoffMode(v as any)} className="gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="last" id="cut-last" />
                  <Label htmlFor="cut-last" className="text-sm font-normal cursor-pointer">
                    Última atualização {currentBank ? (lastUpdatedDate ? `(${formatDate(lastUpdatedDate, 'DD/MM/YYYY')})` : '(sem registo)') : '(seleciona o banco)'}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="custom" id="cut-custom" />
                  <Label htmlFor="cut-custom" className="text-sm font-normal cursor-pointer">Data específica</Label>
                  {cutoffMode === 'custom' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs ml-2">
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {customCutoffDate ? format(customCutoffDate, 'dd/MM/yyyy') : 'Escolher'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={customCutoffDate || undefined} onSelect={(d) => setCustomCutoffDate(d || null)} initialFocus className={cn('p-3 pointer-events-auto')} />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="cut-all" />
                  <Label htmlFor="cut-all" className="text-sm font-normal cursor-pointer">Importar todas</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quando valor diverge da recorrente (default)</Label>
              <RadioGroup
                value={defaultDivergenceResolution}
                onValueChange={(v) => {
                  const next = v as 'file' | 'rule';
                  setDefaultDivergenceResolution(next);
                  setRows(prev => prev.map(r => r.divergenceResolution !== null ? { ...r, divergenceResolution: next } : r));
                }}
                className="gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="file" id="div-file" />
                  <Label htmlFor="div-file" className="text-sm font-normal cursor-pointer">Usar valor do ficheiro (atualiza recorrente)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="rule" id="div-rule" />
                  <Label htmlFor="div-rule" className="text-sm font-normal cursor-pointer">Manter valor da recorrente (regista diferença)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{counts.total} linhas</Badge>
        <Badge className="bg-income-muted text-income border-0"><Sparkles className="mr-1 h-3 w-3" />{counts.auto} categorizadas</Badge>
        {counts.pending > 0 && <Badge variant="outline">{counts.pending} por categorizar</Badge>}
        {counts.ignored > 0 && <Badge className="bg-muted text-muted-foreground border-0"><Ban className="mr-1 h-3 w-3" />{counts.ignored} ignoradas</Badge>}
        {counts.duplicates > 0 && <Badge className="bg-warning-muted text-warning border-0"><AlertTriangle className="mr-1 h-3 w-3" />{counts.duplicates} duplicadas</Badge>}
        {counts.possibleDuplicates > 0 && <Badge className="bg-warning-muted text-warning border-0"><AlertTriangle className="mr-1 h-3 w-3" />{counts.possibleDuplicates} possíveis duplicados</Badge>}
        {counts.skippedByDate > 0 && <Badge className="bg-muted text-muted-foreground border-0">{counts.skippedByDate} antes do corte</Badge>}
      </div>

      {previewBankSource && (
        <Card className="glass-surface">
          <CardContent className="py-3 space-y-2">
            <div className="text-xs text-muted-foreground">
              Últimos 5 importados de <span className="text-foreground font-medium">{BANK_OPTIONS.find(b => b.value === previewBankSource)?.label || previewBankSource}</span>
            </div>
            {lastImported.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Sem movimentos importados deste banco ainda.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {lastImported.map(t => {
                  const cat = categories.find((c: any) => c.id === t.category_id);
                  return (
                    <div key={t.id} className="flex items-center gap-3 py-1 text-xs">
                      <span className="tabular-nums text-muted-foreground w-20">{formatDate(t.date, 'DD/MM/YYYY')}</span>
                      <span className="flex-1 truncate text-foreground">{t.notes || '—'}</span>
                      <span className="text-muted-foreground w-32 truncate text-right">{cat?.name || ''}</span>
                      <span className={cn('financial-value tabular-nums w-24 text-right', t.macro_group === 'Rendimentos' ? 'text-income' : 'text-expense')}>
                        {formatCurrency(Math.abs(Number(t.amount)))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="glass-surface overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Subcategoria</TableHead>
                <TableHead>Recorrente</TableHead>
                <TableHead className="text-center">Ignorar</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => {
                const cats = categories.filter(c => c.group_type === row.macroGroup);
                const cat = categories.find(c => c.id === row.categoryId);
                const subs = cat?.subcategories || [];
                return (
                  <TableRow key={row.rowId} className={cn(
                    row.ignore && 'opacity-50',
                    isBeforeCutoff(row.date) && 'opacity-60 bg-muted/40',
                    (row.isDuplicate || row.isExisting) && !row.forceImport && 'bg-warning-muted/50 opacity-70',
                    (row.isDuplicate || row.isExisting) && row.forceImport && 'bg-warning-muted/20',
                    row.possibleDuplicateOf && !row.possibleDuplicateDismissed && !row.isExisting && !row.isDuplicate && 'bg-warning-muted/25'
                  )}>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">{row.date}</TableCell>
                    <TableCell className="text-xs max-w-[260px]">
                      <div className="truncate" title={row.description}>{row.description}</div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {row.matchedRuleId && !row.matchedIgnore && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {row.matchedAuto ? 'auto' : 'regra'}
                          </Badge>
                        )}
                        {(row.isDuplicate || row.isExisting) && (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                              {row.forceImport ? 'duplicado — forçado' : 'duplicado'}
                            </Badge>
                            <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer" title="Importar mesmo sendo duplicado (ex: dois movimentos iguais no mesmo dia)">
                              <Checkbox
                                checked={row.forceImport}
                                onCheckedChange={(v) => updateRow(row.rowId, { forceImport: !!v })}
                                className="h-3 w-3"
                              />
                              importar mesmo assim
                            </label>
                          </div>
                        )}
                        {isBeforeCutoff(row.date) && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">antes do corte</Badge>
                        )}
                        {row.replacesAutoId && (
                          <Badge className="text-[10px] px-1 py-0 h-4 bg-primary/10 text-primary border-0">substitui auto-gerada</Badge>
                        )}
                        {row.recurringRuleId && row.recurringExpectedAmount !== null && Math.abs(row.recurringExpectedAmount - Math.abs(row.amount)) > 0.005 && (
                          <div className="flex items-center gap-1">
                            <Badge className="text-[10px] px-1 py-0 h-4 bg-warning-muted text-warning border-0">
                              difere: {formatCurrency(row.recurringExpectedAmount)} → {formatCurrency(Math.abs(row.amount))}
                            </Badge>
                            <Select
                              value={row.divergenceResolution || 'file'}
                              onValueChange={(v) => updateRow(row.rowId, { divergenceResolution: v as 'file' | 'rule' })}
                            >
                              <SelectTrigger className="h-5 text-[10px] px-1 w-[110px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="file" className="text-xs">Usar ficheiro</SelectItem>
                                <SelectItem value="rule" className="text-xs">Manter recorrente</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {row.categoryId && (
                          <label
                            className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer"
                            title={`Esta regra só aplica quando o valor é exactamente ${formatCurrency(Math.abs(row.amount))}. Útil para distinguir movimentos com a mesma descrição mas valores diferentes (ex: vários seguros).`}
                          >
                            <Checkbox
                              checked={row.matchExactAmount}
                              onCheckedChange={(v) => updateRow(row.rowId, { matchExactAmount: !!v })}
                              className="h-3 w-3"
                            />
                            valor exacto
                          </label>
                        )}
                        {row.possibleDuplicateOf && !row.possibleDuplicateDismissed && !row.isExisting && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Badge className="text-[10px] px-1 py-0 h-4 bg-warning-muted text-warning border-0 cursor-pointer">
                                <Info className="mr-0.5 h-2.5 w-2.5" />possível duplicado
                              </Badge>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 text-xs space-y-2" align="start">
                              <p className="font-medium">Já existe um movimento parecido:</p>
                              <div className="space-y-0.5 text-muted-foreground">
                                <div><span className="text-foreground tabular-nums">{formatDate(row.possibleDuplicateOf.date, 'DD/MM/YYYY')}</span> · <span className="text-foreground tabular-nums">{formatCurrency(row.possibleDuplicateOf.amount)}</span></div>
                                {row.possibleDuplicateOf.notes && <div className="truncate">«{row.possibleDuplicateOf.notes}»</div>}
                                <div>
                                  {row.possibleDuplicateOf.categoryName && <span>Categoria: {row.possibleDuplicateOf.categoryName} · </span>}
                                  {row.possibleDuplicateOf.bankSource && <span>Origem: {row.possibleDuplicateOf.bankSource}</span>}
                                </div>
                                {row.possibleDuplicateOf.daysDiff !== 0 && (
                                  <div>Diferença: {Math.abs(row.possibleDuplicateOf.daysDiff)} dia(s)</div>
                                )}
                              </div>
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => updateRow(row.rowId, { ignore: true, possibleDuplicateDismissed: true })}>É o mesmo — ignorar</Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs flex-1" onClick={() => updateRow(row.rowId, { possibleDuplicateDismissed: true })}>São diferentes</Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cn('text-right tabular-nums text-xs', row.macroGroup === 'Rendimentos' ? 'text-income' : 'text-expense')}>
                      {formatCurrency(Math.abs(row.amount))}
                    </TableCell>
                    <TableCell>
                      <Select value={row.macroGroup} onValueChange={(v) => updateRow(row.rowId, { macroGroup: v as MacroGroup, categoryId: null, subcategoryId: null })}>
                        <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Rendimentos">Rendimentos</SelectItem>
                          <SelectItem value="Despesas">Despesas</SelectItem>
                          <SelectItem value="Investimentos">Investimentos</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={row.categoryId || ''} onValueChange={(v) => updateRow(row.rowId, { categoryId: v, subcategoryId: null })}>
                        <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {cats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={row.subcategoryId || ''} onValueChange={(v) => updateRow(row.rowId, { subcategoryId: v })} disabled={!row.categoryId}>
                        <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {subs.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.recurringRuleId || '__none__'}
                        onValueChange={(v) => {
                          if (v === '__none__') {
                            updateRow(row.rowId, { recurringRuleId: null, replacesAutoId: null, recurringExpectedAmount: null, divergenceResolution: null });
                          } else {
                            const rec = recurrings.find((x: any) => x.id === v);
                            if (rec) {
                              const d = new Date(row.date);
                              const found = autoByRulePeriod.get(`${v}|${d.getFullYear()}-${d.getMonth()}`);
                              const expected = found ? found.amount : Number(rec.amount);
                              const diverges = Math.abs(expected - Math.abs(row.amount)) > 0.005;
                              updateRow(row.rowId, {
                                recurringRuleId: v,
                                categoryId: rec.category_id,
                                subcategoryId: rec.subcategory_id,
                                macroGroup: rec.macro_group,
                                replacesAutoId: found?.id || null,
                                recurringExpectedAmount: expected,
                                divergenceResolution: diverges ? defaultDivergenceResolution : null,
                              });
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Nenhuma —</SelectItem>
                          {recurrings.map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox checked={row.ignore} onCheckedChange={(v) => updateRow(row.rowId, { ignore: !!v })} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {row.categoryId && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleApplyToSimilar(row.rowId)} title="Aplicar a similares">
                            <Wand2 className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openIgnoreDialog(row.rowId)} title="Criar regra de exclusão">
                          <Ban className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleImport} disabled={counts.importable === 0}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Importar {counts.importable} movimentos
        </Button>
        <Button variant="outline" onClick={() => { setStep('upload'); setFile(null); setRows([]); }}>Cancelar</Button>
      </div>

      <Dialog open={ignoreDialog.open} onOpenChange={(o) => setIgnoreDialog(s => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar regra de exclusão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Movimentos cuja descrição (normalizada) contenha este padrão serão ignorados nas próximas importações.
            </p>
            <Label className="text-xs">Padrão</Label>
            <Input value={ignoreDialog.pattern} onChange={(e) => setIgnoreDialog(s => ({ ...s, pattern: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIgnoreDialog({ open: false, rowId: null, pattern: '' })}>Cancelar</Button>
            <Button onClick={confirmIgnoreRule} disabled={!ignoreDialog.pattern.trim()}>Criar regra</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BankImportTab;
