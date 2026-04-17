import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { BackgroundTasksProvider } from "@/contexts/BackgroundTasksContext";
import { WsSingleSearchStateProvider } from "@/contexts/WsSingleSearchStateContext";
import { useUserRole } from "@/hooks/useUserRole";
import AppLayout from "@/components/AppLayout";
import WsLayout from "@/components/WsLayout";
import Auth from "@/pages/Auth";
import LandingPage from "@/pages/LandingPage";
import WsSingleSearch from "@/pages/WsSingleSearch";
import MapPage from "@/pages/MapPage";
import ProvidersPage from "@/pages/ProvidersPage";
import FeasibilityPage from "@/pages/FeasibilityPage";
import HistoryPage from "@/pages/HistoryPage";
import BaseLMPage from "@/pages/BaseLMPage";
import WsUsersPage from "@/pages/WsUsersPage";
import WsUploadPage from "@/pages/WsUploadPage";
import WsSearchesPage from "@/pages/WsSearchesPage";
import WsBatchDetailPage from "@/pages/WsBatchDetailPage";
import WsDashboard from "@/pages/WsDashboard";
import PreProvidersPage from "@/pages/PreProvidersPage";
import NttNetworkUpdatePage from "@/pages/NttNetworkUpdatePage";
import AdminSettingsPage from "@/pages/AdminSettingsPage";
import UserSettingsPage from "@/pages/UserSettingsPage";
import SendHistoryPage from "@/pages/SendHistoryPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import DashboardPage from "@/pages/DashboardPage";
import DrilldownVolume from "@/pages/dashboard/DrilldownVolume";
import DrilldownSolicitantes from "@/pages/dashboard/DrilldownSolicitantes";
import DrilldownLoteUnitario from "@/pages/dashboard/DrilldownLoteUnitario";
import DrilldownComparativo from "@/pages/dashboard/DrilldownComparativo";
import DrilldownProvedores from "@/pages/dashboard/DrilldownProvedores";
import DrilldownRegioes from "@/pages/dashboard/DrilldownRegioes";
import PrecificacaoPage from "@/pages/admin/PrecificacaoPage";
import CalcularPage from "@/pages/admin/Calcular";
import PreViabilidadePage from "@/pages/PreViabilidadePage";
import AprovacaoDecisaoPage from "@/pages/AprovacaoDecisaoPage";
import LmLayout from "@/components/LmLayout";
import LmDashboardPage from "@/pages/lm/LmDashboardPage";
import LmBasePage from "@/pages/lm/LmBasePage";
import LmImportarPage from "@/pages/lm/LmImportarPage";
import LmAlertasPage from "@/pages/lm/LmAlertasPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading } = useAuth();
  const { isAdmin, isWsUser, isVendedor, isImplantacao, isLm, isLoading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/landing" replace />;
  if (!isAdmin && !isImplantacao) {
    if (isLm) return <Navigate to="/lm" replace />;
    return <Navigate to={(isWsUser || isVendedor) ? "/ws" : "/landing"} replace />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/volume" element={<DrilldownVolume />} />
        <Route path="/dashboard/solicitantes" element={<DrilldownSolicitantes />} />
        <Route path="/dashboard/lote-unitario" element={<DrilldownLoteUnitario />} />
        <Route path="/dashboard/comparativo" element={<DrilldownComparativo />} />
        <Route path="/dashboard/provedores" element={<DrilldownProvedores />} />
        <Route path="/dashboard/regioes" element={<DrilldownRegioes />} />
        <Route path="/ntt-update" element={<NttNetworkUpdatePage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/pre-providers" element={<PreProvidersPage />} />
        <Route path="/feasibility" element={<FeasibilityPage />} />
        <Route path="/base-lm" element={<BaseLMPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/ws-users" element={<WsUsersPage />} />
        <Route path="/ws-upload" element={<WsUploadPage />} />
        <Route path="/ws-single" element={<WsSingleSearch />} />
        <Route path="/settings" element={<AdminSettingsPage />} />
        <Route path="/account" element={<UserSettingsPage />} />
        <Route path="/send-history" element={<SendHistoryPage />} />
        <Route path="/admin/precificacao" element={<PrecificacaoPage />} />
        <Route path="/admin/precificacao/calcular" element={<CalcularPage />} />
        <Route path="/pre-viabilidade" element={<PreViabilidadePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function LmRoutes() {
  const { session, loading } = useAuth();
  const { isLm, isAdmin, isLoading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/landing" replace />;
  if (!isLm && !isAdmin) return <Navigate to="/" replace />;

  return (
    <LmLayout>
      <Routes>
        <Route path="/" element={<LmDashboardPage />} />
        <Route path="/base" element={<LmBasePage />} />
        <Route path="/importar" element={<LmImportarPage />} />
        <Route path="/alertas" element={<LmAlertasPage />} />
        <Route path="/account" element={<UserSettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </LmLayout>
  );
}

function WsRoutes() {
  const { session, loading } = useAuth();
  const { isWsUser, isAdmin, isVendedor, isImplantacao, isLoading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/ws/login" replace />;
  if (!isWsUser && !isAdmin && !isVendedor) return <Navigate to="/" replace />;

  return (
    <WsLayout>
      <Routes>
        <Route path="/" element={<WsUploadPage />} />
        <Route path="/searches" element={<WsSearchesPage />} />
        <Route path="/batch/:batchId" element={<WsBatchDetailPage />} />
        <Route path="/single" element={<WsSingleSearch />} />
        <Route path="/pre-providers" element={<PreProvidersPage />} />
        <Route path="/send-history" element={<SendHistoryPage />} />
        <Route path="/calcular" element={<CalcularPage />} />
        <Route path="/pre-viabilidade" element={<PreViabilidadePage />} />
        <Route path="/account" element={<UserSettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </WsLayout>
  );
}

/** Landing page — redirect logged-in users to their area */
function LandingRoute() {
  const { session, loading } = useAuth();
  const { isAdmin, isWsUser, isVendedor, isImplantacao, isLoading: roleLoading } = useUserRole();

  if (loading) return null;
  if (!session) return <LandingPage />;
  if (roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAdmin || isImplantacao) return <Navigate to="/" replace />;
  if (isWsUser || isVendedor) return <Navigate to="/ws" replace />;
  return <LandingPage />;
}

/** /auth — admin login only */
function AuthRoute() {
  const { session, loading, signOut } = useAuth();
  const { isWsUser, isAdmin, isVendedor, isImplantacao, isLoading: roleLoading } = useUserRole();

  if (loading) return null;
  if (!session) return <Auth />;
  if (roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAdmin || isImplantacao) return <Navigate to="/" replace />;
  if (isWsUser || isVendedor) return <Navigate to="/ws" replace />;
  signOut();
  return <Auth />;
}

/** /ws/login — WS login + signup */
function WsAuthRoute() {
  const { session, loading } = useAuth();
  const { isWsUser, isAdmin, isVendedor, isImplantacao, isLoading: roleLoading } = useUserRole();

  if (loading) return null;
  if (!session) return <Auth />;
  if (roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isWsUser || isVendedor) return <Navigate to="/ws" replace />;
  if (isAdmin || isImplantacao) return <Navigate to="/" replace />;
  return <Navigate to="/" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <CartProvider>
          <BackgroundTasksProvider>
            <WsSingleSearchStateProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/landing" element={<LandingRoute />} />
                <Route path="/aprovacao/:token" element={<AprovacaoDecisaoPage />} />
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/ws/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/ws/login" element={<WsAuthRoute />} />
                <Route path="/ws/*" element={<WsRoutes />} />
                <Route path="/*" element={<ProtectedRoutes />} />
              </Routes>
            </BrowserRouter>
            </WsSingleSearchStateProvider>
          </BackgroundTasksProvider>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
