import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Settings, User, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PartnershipSection from '@/components/settings/PartnershipSection';
import TelegramSection from '@/components/settings/TelegramSection';

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/AAAA (31/12/2025)' },
  { value: 'YYYY-MM-DD', label: 'AAAA-MM-DD (2025-12-31)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/AAAA (12/31/2025)' },
];

const DefinicoesPage: React.FC = () => {
  const { user, signOut, isDemo } = useAuth();
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('date_format')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.date_format) setDateFormat(data.date_format);
        setLoading(false);
      });
  }, [user]);

  const handleDateFormatChange = async (value: string) => {
    setDateFormat(value);
    const { error } = await supabase
      .from('profiles')
      .update({ date_format: value })
      .eq('user_id', user!.id);
    if (error) {
      toast.error('Erro ao guardar formato de data');
    } else {
      toast.success('Formato de data atualizado');
    }
  };

  const handleDeleteAllData = async () => {
    if (!user || confirmText !== 'APAGAR') return;
    setDeleting(true);
    try {
      // Delete in order respecting foreign keys
      const tables = [
        'import_rows',
        'transactions',
        'imports',
        'budgets',
        'recurring_rules',
        'event_labels',
        'saved_filters',
        'subcategories',
        'categories',
      ] as const;

      for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq('user_id', user.id);
        if (error) {
          console.error(`Error deleting ${table}:`, error);
          throw new Error(`Erro ao apagar ${table}`);
        }
      }

      toast.success('Todos os dados foram apagados com sucesso');
      setConfirmText('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao apagar dados');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Definições</h1>
        <p className="text-sm text-muted-foreground">Configurações da conta</p>
      </div>

      <Card className="glass-surface">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled />
          </div>
          <Separator />
          <Button variant="destructive" onClick={signOut}>Terminar Sessão</Button>
        </CardContent>
      </Card>

      {!isDemo && <PartnershipSection />}
      {!isDemo && user && <TelegramSection userId={user.id} />}

      <Card className="glass-surface">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Preferências
          </CardTitle>
          <CardDescription>Moeda: EUR · Idioma: Português (PT)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Formato de data</Label>
            <Select value={dateFormat} onValueChange={handleDateFormatChange} disabled={loading}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Este formato é usado na visualização e na importação de CSV.
            </p>
          </div>
        </CardContent>
      </Card>

      {!isDemo && (
        <Card className="border-destructive/30 glass-surface">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Zona de Perigo
            </CardTitle>
            <CardDescription>Ações irreversíveis</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Apagar todos os dados</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar todos os dados?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é <strong>irreversível</strong>. Todas as transações, categorias, subcategorias, 
                    orçamentos, recorrências, eventos, filtros guardados e histórico de importações serão 
                    permanentemente eliminados. A conta e o perfil serão mantidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-2">
                  <Label>Escreva <strong>APAGAR</strong> para confirmar</Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="APAGAR"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmText('')}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAllData}
                    disabled={confirmText !== 'APAGAR' || deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        A apagar...
                      </>
                    ) : (
                      'Apagar tudo'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DefinicoesPage;
