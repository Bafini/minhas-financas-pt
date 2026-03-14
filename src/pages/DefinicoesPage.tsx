import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Settings, User } from 'lucide-react';

const DefinicoesPage: React.FC = () => {
  const { user, signOut } = useAuth();

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

      <Card className="glass-surface">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Preferências
          </CardTitle>
          <CardDescription>Moeda: EUR · Formato de data: DD/MM/AAAA · Idioma: Português (PT)</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};

export default DefinicoesPage;
