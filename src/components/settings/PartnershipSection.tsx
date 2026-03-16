import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Loader2, Send, Check, X, Unlink } from 'lucide-react';
import { toast } from 'sonner';
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

interface Partnership {
  id: string;
  requester_id: string;
  target_email: string;
  target_id: string | null;
  status: string;
  permission_level: string;
  created_at: string;
}

const PartnershipSection: React.FC = () => {
  const { user } = useAuth();
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('read');
  const [partnerProfiles, setPartnerProfiles] = useState<Record<string, string>>({});

  const fetchPartnerships = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('partnerships' as any)
      .select('*')
      .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`)
      .in('status', ['pending', 'accepted']);
    
    const items = (data || []) as unknown as Partnership[];
    setPartnerships(items);

    // Fetch partner display names
    const partnerIds = items.map(p => p.requester_id === user.id ? p.target_id : p.requester_id).filter(Boolean) as string[];
    if (partnerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', partnerIds);
      const map: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { map[p.user_id] = p.display_name || ''; });
      setPartnerProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPartnerships(); }, [user]);

  const activePartnership = partnerships.find(p => p.status === 'accepted');
  const pendingSent = partnerships.find(p => p.status === 'pending' && p.requester_id === user?.id);
  const pendingReceived = partnerships.find(p => p.status === 'pending' && p.target_id === user?.id);

  const handleSendInvite = async () => {
    if (!user || !email.trim()) return;
    if (email.toLowerCase() === user.email?.toLowerCase()) {
      toast.error('Não pode convidar-se a si próprio');
      return;
    }
    setSending(true);
    try {
      // Find target user
      const { data: targetId, error: rpcError } = await supabase.rpc('find_user_id_by_email' as any, { _email: email.trim().toLowerCase() });
      if (rpcError) throw rpcError;
      if (!targetId) {
        toast.error('Não foi encontrada nenhuma conta com esse email');
        setSending(false);
        return;
      }

      const { error } = await supabase.from('partnerships' as any).insert({
        requester_id: user.id,
        target_email: email.trim().toLowerCase(),
        target_id: targetId,
        permission_level: permission,
        status: 'pending',
      });

      if (error) {
        if (error.message?.includes('already has an active or pending partnership')) {
          toast.error('Já existe uma associação ativa ou pendente');
        } else {
          throw error;
        }
      } else {
        toast.success('Pedido de associação enviado');
        setEmail('');
        await fetchPartnerships();
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar pedido');
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async (id: string) => {
    const { error } = await supabase.from('partnerships' as any).update({ status: 'accepted' }).eq('id', id);
    if (error) { toast.error('Erro ao aceitar'); return; }
    toast.success('Associação aceite');
    await fetchPartnerships();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from('partnerships' as any).update({ status: 'rejected' }).eq('id', id);
    if (error) { toast.error('Erro ao rejeitar'); return; }
    toast.success('Pedido rejeitado');
    await fetchPartnerships();
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from('partnerships' as any).delete().eq('id', id);
    if (error) { toast.error('Erro ao cancelar'); return; }
    toast.success('Pedido cancelado');
    await fetchPartnerships();
  };

  const handleDissolve = async (id: string) => {
    const { error } = await supabase.from('partnerships' as any).update({ status: 'dissolved' }).eq('id', id);
    if (error) { toast.error('Erro ao terminar associação'); return; }
    toast.success('Associação terminada');
    await fetchPartnerships();
  };

  const getPartnerName = (p: Partnership) => {
    const partnerId = p.requester_id === user?.id ? p.target_id : p.requester_id;
    const name = partnerId ? partnerProfiles[partnerId] : null;
    return name || (p.requester_id === user?.id ? p.target_email : user?.email || '');
  };

  const getPermissionLabel = (p: Partnership) => {
    if (p.requester_id === user?.id) {
      return p.permission_level === 'full' ? 'Acesso total' : 'Apenas leitura';
    }
    return p.permission_level === 'full' ? 'Acesso total (concedido)' : 'Apenas leitura (concedido)';
  };

  if (loading) {
    return (
      <Card className="glass-surface">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-surface">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Conta Partilhada
        </CardTitle>
        <CardDescription>Associe outra conta para partilhar dados financeiros</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active partnership */}
        {activePartnership && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{getPartnerName(activePartnership)}</p>
                <p className="text-xs text-muted-foreground">{getPermissionLabel(activePartnership)}</p>
              </div>
              <Badge variant="default" className="bg-income/20 text-income border-income/30">
                Ativa
              </Badge>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Unlink className="mr-2 h-3 w-3" />
                  Terminar Associação
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Terminar associação?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ambas as contas deixarão de ver os dados uma da outra. Os dados de cada um permanecem intactos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDissolve(activePartnership.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Terminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Pending received invite */}
        {pendingReceived && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">
                Pedido de <span className="text-primary">{pendingReceived.target_email !== user?.email ? pendingReceived.target_email : getPartnerName(pendingReceived)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Permissão: {pendingReceived.permission_level === 'full' ? 'Acesso total' : 'Apenas leitura'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleAccept(pendingReceived.id)}>
                <Check className="mr-1 h-3 w-3" /> Aceitar
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleReject(pendingReceived.id)}>
                <X className="mr-1 h-3 w-3" /> Rejeitar
              </Button>
            </div>
          </div>
        )}

        {/* Pending sent invite */}
        {pendingSent && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Pedido enviado para {pendingSent.target_email}</p>
                <p className="text-xs text-muted-foreground">A aguardar resposta</p>
              </div>
              <Badge variant="secondary">Pendente</Badge>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleCancel(pendingSent.id)}>
              Cancelar pedido
            </Button>
          </div>
        )}

        {/* Invite form - only if no active/pending partnership */}
        {!activePartnership && !pendingSent && !pendingReceived && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Email do parceiro</Label>
                <Input
                  type="email"
                  placeholder="parceiro@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Permissão concedida</Label>
                <Select value={permission} onValueChange={setPermission}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Apenas leitura</SelectItem>
                    <SelectItem value="full">Acesso total (criar, editar, apagar)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O parceiro terá acesso aos seus dados. Você terá sempre acesso total aos dados do parceiro.
                </p>
              </div>
              <Button onClick={handleSendInvite} disabled={!email.trim() || sending}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar Pedido
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PartnershipSection;
