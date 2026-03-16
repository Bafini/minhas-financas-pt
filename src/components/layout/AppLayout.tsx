import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { seedCategoriesForUser } from '@/lib/seeds';
import AppSidebar from '@/components/layout/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const [seeding, setSeeding] = useState(true);

  useEffect(() => {
    if (user) {
      seedCategoriesForUser(user.id).finally(() => setSeeding(false));
    }
  }, [user]);

  if (seeding) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">A preparar a sua conta...</span>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 items-center border-b px-4 md:hidden">
          <SidebarTrigger />
          <span className="ml-3 text-sm font-semibold">Finanças</span>
        </header>
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppLayout;
