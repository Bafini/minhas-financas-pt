import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, Link2, Unlink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TelegramSectionProps {
  userId: string;
}

const TelegramSection: React.FC<TelegramSectionProps> = ({ userId }) => {
  const [linked, setLinked] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('telegram-link', {
        body: { action: 'status' },
      });
      if (error) throw error;
      setLinked(data.linked);
      setPendingCode(data.pending_code);
    } catch (err) {
      console.error('Failed to fetch telegram status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [userId]);

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-link', {
        body: { action: 'generate_code' },
      });
      if (error) throw error;
      if (data.error === 'already_linked') {
        setLinked(true);
        toast.info('Conta já está vinculada ao Telegram');
      } else {
        setPendingCode(data.code);
        toast.success('Código gerado! Válido por 10 minutos.');
      }
    } catch (err) {
      toast.error('Erro ao gerar código');
    } finally {
      setGenerating(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      const { error } = await supabase.functions.invoke('telegram-link', {
        body: { action: 'unlink' },
      });
      if (error) throw error;
      setLinked(false);
      setPendingCode(null);
      toast.success('Conta desvinculada do Telegram');
    } catch (err) {
      toast.error('Erro ao desvincular');
    } finally {
      setUnlinking(false);
    }
  };

  if (loading) {
    return (
      <Card className="glass-surface">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-surface">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Bot Telegram
          {linked && <Badge variant="secondary" className="ml-2">Vinculado</Badge>}
        </CardTitle>
        <CardDescription>
          Registe despesas enviando mensagens pelo Telegram
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {linked ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A sua conta está vinculada ao Telegram. Envie um valor (ex: <code className="bg-muted px-1 rounded">25.50 Supermercado</code>) para registar uma despesa.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlink}
              disabled={unlinking}
            >
              {unlinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
              Desvincular
            </Button>
          </div>
        ) : pendingCode ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Envie o seguinte comando ao bot no Telegram:
            </p>
            <div className="bg-muted rounded-md p-3 font-mono text-center text-lg tracking-widest select-all">
              /vincular {pendingCode}
            </div>
            <p className="text-xs text-muted-foreground">
              Código válido por 10 minutos. Após vincular, recarregue esta página.
            </p>
            <Button variant="outline" size="sm" onClick={handleGenerateCode} disabled={generating}>
              Gerar novo código
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Vincule a sua conta para registar transações via Telegram. Após vincular, envie valores como <code className="bg-muted px-1 rounded">15.90 Almoço</code> para registar despesas rapidamente.
            </p>
            <Button onClick={handleGenerateCode} disabled={generating} size="sm">
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Vincular conta Telegram
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TelegramSection;
