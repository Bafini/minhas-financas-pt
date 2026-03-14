import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PrivacyProvider } from "@/contexts/PrivacyContext";
import AuthPage from "./pages/AuthPage";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import MovimentosPage from "./pages/MovimentosPage";
import ImportacoesPage from "./pages/ImportacoesPage";
import CategoriasPage from "./pages/CategoriasPage";
import OrcamentosPage from "./pages/OrcamentosPage";
import RecorrenciasPage from "./pages/RecorrenciasPage";
import EventosPage from "./pages/EventosPage";
import DefinicoesPage from "./pages/DefinicoesPage";
import { RendimentosPage, DespesasPage, InvestimentosPage } from "./pages/GroupPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">A carregar...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout />;
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/movimentos" element={<MovimentosPage />} />
              <Route path="/rendimentos" element={<RendimentosPage />} />
              <Route path="/despesas" element={<DespesasPage />} />
              <Route path="/investimentos" element={<InvestimentosPage />} />
              <Route path="/categorias" element={<CategoriasPage />} />
              <Route path="/orcamentos" element={<OrcamentosPage />} />
              <Route path="/recorrencias" element={<RecorrenciasPage />} />
              <Route path="/eventos" element={<EventosPage />} />
              <Route path="/importacoes" element={<ImportacoesPage />} />
              <Route path="/definicoes" element={<DefinicoesPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
