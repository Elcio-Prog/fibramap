import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
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
import SettingsPage from "@/pages/SettingsPage";
import SendHistoryPage from "@/pages/SendHistoryPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading } = useAuth();
  const { isAdmin, isWsUser, isLoading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to={isWsUser ? "/ws" : "/"} replace />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/ntt-update" element={<NttNetworkUpdatePage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/pre-providers" element={<PreProvidersPage />} />
        <Route path="/feasibility" element={<FeasibilityPage />} />
        <Route path="/base-lm" element={<BaseLMPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/ws-users" element={<WsUsersPage />} />
        <Route path="/ws-upload" element={<WsUploadPage />} />
        <Route path="/ws-single" element={<WsSingleSearch />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/send-history" element={<SendHistoryPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function WsRoutes() {
  const { session, loading } = useAuth();
  const { isWsUser, isAdmin, isLoading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/ws/login" replace />;
  if (!isWsUser && !isAdmin) return <Navigate to="/" replace />;

  return (
    <WsLayout>
      <Routes>
        <Route path="/" element={<WsUploadPage />} />
        <Route path="/searches" element={<WsSearchesPage />} />
        <Route path="/batch/:batchId" element={<WsBatchDetailPage />} />
        <Route path="/single" element={<WsSingleSearch />} />
        <Route path="/pre-providers" element={<PreProvidersPage />} />
        <Route path="/send-history" element={<SendHistoryPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </WsLayout>
  );
}

/** Landing page — redirect logged-in users to their area */
function LandingRoute() {
  const { session, loading } = useAuth();
  const { isAdmin, isWsUser, isLoading: roleLoading } = useUserRole();

  if (loading) return null;
  if (!session) return <LandingPage />;
  if (roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isWsUser) return <Navigate to="/ws" replace />;
  return <LandingPage />;
}

/** /auth — admin login only */
function AuthRoute() {
  const { session, loading, signOut } = useAuth();
  const { isWsUser, isAdmin, isLoading: roleLoading } = useUserRole();

  if (loading) return null;
  if (!session) return <Auth />;
  if (roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isWsUser) return <Navigate to="/ws" replace />;
  signOut();
  return <Auth />;
}

/** /ws/login — WS login + signup */
function WsAuthRoute() {
  const { session, loading } = useAuth();
  const { isWsUser, isAdmin, isLoading: roleLoading } = useUserRole();

  if (loading) return null;
  if (!session) return <Auth />;
  if (roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isWsUser || isAdmin) return <Navigate to="/ws" replace />;
  return <Navigate to="/" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingRoute />} />
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/ws/login" element={<WsAuthRoute />} />
              <Route path="/ws/*" element={<WsRoutes />} />
              <Route path="/admin/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
