import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  FolderTree,
  Target,
  Repeat,
  Tag,
  Upload,
  Settings,
  LogOut,
  BarChart3,
  EyeOff,
  Eye,
  Fuel,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePrivacy } from '@/contexts/PrivacyContext';

const mainNav = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { title: 'Movimentos', icon: ArrowLeftRight, path: '/movimentos' },
  { title: 'Comparações', icon: BarChart3, path: '/comparacoes' },
];

const groupNav = [
  { title: 'Rendimentos', icon: TrendingUp, path: '/rendimentos' },
  { title: 'Despesas', icon: TrendingDown, path: '/despesas' },
  { title: 'Investimentos', icon: PiggyBank, path: '/investimentos' },
];

const manageNav = [
  { title: 'Categorias', icon: FolderTree, path: '/categorias' },
  { title: 'Orçamentos', icon: Target, path: '/orcamentos' },
  { title: 'Recorrências', icon: Repeat, path: '/recorrencias' },
  { title: 'Cartões Combustível', icon: Fuel, path: '/cartoes-combustivel' },
  { title: 'Eventos', icon: Tag, path: '/eventos' },
  { title: 'Integrações', icon: Upload, path: '/integracoes' },
  { title: 'Definições', icon: Settings, path: '/definicoes' },
];

const AppSidebar: React.FC = () => {
  const { signOut } = useAuth();
  const { hidden, toggle } = usePrivacy();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <h1 className="text-lg font-bold tracking-tight">Finanças</h1>
        <p className="text-xs text-muted-foreground">Soberania Financeira</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map(item => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Grupos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupNav.map(item => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {manageNav.map(item => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-1">
        <Button variant="ghost" className="w-full justify-start" onClick={toggle}>
          {hidden ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
          {hidden ? 'Mostrar Valores' : 'Esconder Valores'}
        </Button>
        <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Terminar Sessão
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
