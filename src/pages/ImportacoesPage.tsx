import React, { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchCategories } from '@/lib/queries';
import { parseDateByFormat, toISODate, DateFormatType } from '@/lib/formatters';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import Papa from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MacroGroup } from '@/lib/calculations';
import { SEED_CATEGORIES } from '@/lib/seeds';

interface ParsedRow {
  rowNum: number;
  data: string;
  categoria: string;
  subcategoria: string;
  valor: string;
  notas: string;
  parsedDate: string | null;
  parsedAmount: number | null;
  error: string | null;
  isDuplicate: boolean;
  macroGroup: MacroGroup;
}

function determineMacroGroup(categoryName: string): MacroGroup {
  const cat = SEED_CATEGORIES.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
  if (cat) return cat.group_type;
  if (categoryName.toLowerCase() === 'rendimentos') return 'Rendimentos';
  if (categoryName.toLowerCase() === 'investimentos') return 'Investimentos';
  return 'Despesas';
}

const ImportacoesPage: React.FC = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(true);
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number; errors: number } | null>(null);
  const [dateFormat, setDateFormat] = useState<DateFormatType>('DD/MM/YYYY');

  // Load user's date format preference
  useEffect(() => {
    if (!user) return;
    supabaseClient
      .from('profiles')
      .select('date_format')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.date_format) setDateFormat(data.date_format as DateFormatType);
      });
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleParse = useCallback(async () => {
    if (!file || !user) return;

    const text = await file.text();
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });

    if (result.errors.length > 0) {
      toast.error('Erro ao ler CSV: ' + result.errors[0].message);
      return;
    }

    const requiredCols = ['data', 'categoria', 'subcategoria', 'valor', 'notas'];
    const headers = result.meta.fields || [];
    const missing = requiredCols.filter(c => !headers.includes(c));
    if (missing.length > 0) {
      toast.error(`Colunas em falta: ${missing.join(', ')}`);
      return;
    }

    // Parse rows
    const parsed: ParsedRow[] = (result.data as any[]).map((row, idx) => {
      const date = parseDateByFormat(row.data, dateFormat);
      const amount = parseFloat(String(row.valor).replace(',', '.').replace(/[^\d.\-]/g, ''));
      let error: string | null = null;
      if (!date) error = 'Data inválida';
      else if (isNaN(amount)) error = 'Valor inválido';

      return {
        rowNum: idx + 1,
        data: row.data,
        categoria: row.categoria?.trim() || '',
        subcategoria: row.subcategoria?.trim() || '',
        valor: row.valor,
        notas: row.notas?.trim() || '',
        parsedDate: date ? toISODate(date) : null,
        parsedAmount: isNaN(amount) ? null : amount,
        error,
        isDuplicate: false,
        macroGroup: determineMacroGroup(row.categoria?.trim() || ''),
      };
    });

    // Check duplicates
    const validRows = parsed.filter(r => !r.error);
    if (validRows.length > 0) {
      const { data: existing } = await supabase
        .from('transactions')
        .select('date, amount, notes')
        .eq('user_id', user.id);

      if (existing) {
        const existingSet = new Set(
          existing.map(e => `${e.date}|${e.amount}|${e.notes || ''}`)
        );
        validRows.forEach(row => {
          const key = `${row.parsedDate}|${row.parsedAmount}|${row.notas}`;
          if (existingSet.has(key)) row.isDuplicate = true;
        });
      }
    }

    setRows(parsed);
    setStep('preview');
  }, [file, user]);

  const handleImport = async () => {
    if (!user) return;
    setStep('importing');

    // Create import record
    const { data: importRecord, error: importError } = await supabase
      .from('imports')
      .insert({
        user_id: user.id,
        filename: file?.name || 'import.csv',
        total_rows: rows.length,
        status: 'processing',
      })
      .select()
      .single();

    if (importError || !importRecord) {
      toast.error('Erro ao criar registo de importação');
      setStep('preview');
      return;
    }

    // Fetch existing categories
    const cats = await fetchCategories(user.id);

    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    for (const row of rows) {
      if (row.error) { errors++; continue; }
      if (row.isDuplicate && ignoreDuplicates) { duplicates++; continue; }

      // Find or create category
      let categoryId: string | null = null;
      let subcategoryId: string | null = null;

      if (row.categoria) {
        let cat = cats?.find(c => c.name.toLowerCase() === row.categoria.toLowerCase());
        if (!cat) {
          const { data: newCat } = await supabase
            .from('categories')
            .insert({ user_id: user.id, name: row.categoria, group_type: row.macroGroup })
            .select()
            .single();
          if (newCat) {
            cat = { ...newCat, subcategories: [] };
            cats?.push(cat);
          }
        }
        if (cat) {
          categoryId = cat.id;
          if (row.subcategoria) {
            let subcat = cat.subcategories?.find((s: any) => s.name.toLowerCase() === row.subcategoria.toLowerCase());
            if (!subcat) {
              const { data: newSub } = await supabase
                .from('subcategories')
                .insert({ category_id: cat.id, user_id: user.id, name: row.subcategoria })
                .select()
                .single();
              if (newSub) {
                subcat = newSub;
                cat.subcategories?.push(subcat);
              }
            }
            if (subcat) subcategoryId = subcat.id;
          }
        }
      }

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        date: row.parsedDate!,
        amount: row.parsedAmount!,
        notes: row.notas || null,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        macro_group: row.macroGroup,
        import_id: importRecord.id,
        is_duplicate: row.isDuplicate,
      });

      if (error) { errors++; } else { imported++; }
    }

    // Update import record
    await supabase.from('imports').update({
      imported_rows: imported,
      duplicate_rows: duplicates,
      error_rows: errors,
      status: 'completed',
    }).eq('id', importRecord.id);

    setImportResult({ imported, duplicates, errors });
    setStep('done');
    toast.success(`Importação concluída: ${imported} movimentos importados`);
  };

  const duplicateCount = rows.filter(r => r.isDuplicate).length;
  const errorCount = rows.filter(r => r.error).length;
  const validCount = rows.filter(r => !r.error && !(r.isDuplicate && ignoreDuplicates)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importação CSV</h1>
        <p className="text-sm text-muted-foreground">Importar transações a partir de ficheiro CSV</p>
      </div>

      {step === 'upload' && (
        <Card className="glass-surface">
          <CardHeader>
            <CardTitle className="text-base">Carregar Ficheiro</CardTitle>
            <CardDescription>Formato: data,categoria,subcategoria,valor,notas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {file ? file.name : 'Clique para selecionar ou arraste o ficheiro CSV'}
              </span>
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </label>
            {file && (
              <Button onClick={handleParse} className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                Analisar Ficheiro
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <Badge variant="secondary">{rows.length} linhas</Badge>
            <Badge className="bg-income-muted text-income border-0">{validCount} válidas</Badge>
            {duplicateCount > 0 && (
              <Badge className="bg-warning-muted text-warning border-0">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {duplicateCount} duplicados
              </Badge>
            )}
            {errorCount > 0 && (
              <Badge variant="destructive">{errorCount} erros</Badge>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Switch checked={ignoreDuplicates} onCheckedChange={setIgnoreDuplicates} id="ignore-dup" />
              <Label htmlFor="ignore-dup" className="text-sm">Ignorar duplicados</Label>
            </div>
          </div>

          <Card className="glass-surface overflow-hidden">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Subcategoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow
                      key={row.rowNum}
                      className={cn(
                        row.error && 'bg-destructive/5',
                        row.isDuplicate && !row.error && 'bg-warning-muted'
                      )}
                    >
                      <TableCell className="text-xs text-muted-foreground">{row.rowNum}</TableCell>
                      <TableCell className="tabular-nums text-sm">{row.data}</TableCell>
                      <TableCell className="text-sm">{row.categoria}</TableCell>
                      <TableCell className="text-sm">{row.subcategoria}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{row.valor}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-sm">{row.notas}</TableCell>
                      <TableCell>
                        {row.error ? (
                          <Badge variant="destructive" className="text-xs">{row.error}</Badge>
                        ) : row.isDuplicate ? (
                          <Badge className="bg-warning-muted text-warning border-0 text-xs">Duplicado</Badge>
                        ) : (
                          <Badge className="bg-income-muted text-income border-0 text-xs">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleImport} disabled={validCount === 0}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Importar {validCount} movimentos
            </Button>
            <Button variant="outline" onClick={() => { setStep('upload'); setFile(null); setRows([]); }}>
              Cancelar
            </Button>
          </div>
        </>
      )}

      {step === 'importing' && (
        <Card className="glass-surface">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">A importar movimentos...</span>
          </CardContent>
        </Card>
      )}

      {step === 'done' && importResult && (
        <Card className="glass-surface">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-income" />
              Importação Concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{importResult.imported} movimentos importados</p>
            {importResult.duplicates > 0 && <p className="text-sm text-muted-foreground">{importResult.duplicates} duplicados ignorados</p>}
            {importResult.errors > 0 && <p className="text-sm text-destructive">{importResult.errors} erros</p>}
            <Button className="mt-4" onClick={() => { setStep('upload'); setFile(null); setRows([]); setImportResult(null); }}>
              Nova Importação
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportacoesPage;
