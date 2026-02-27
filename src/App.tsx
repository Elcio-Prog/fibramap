import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import AppLayout from "@/components/AppLayout";
import WsLayout from "@/components/WsLayout";
import Auth from "@/pages/Auth";
import WsSingleSearch from "@/pages/WsSingleSearch";
import MapPage from "@/pages/MapPage";
import ProvidersPage from "@/pages/ProvidersPage";
import FeasibilityPage from "@/pages/FeasibilityPage";
import HistoryPage from "@/pages/HistoryPage";
import BaseLMPage from "@/pages/BaseLMPage";
import WsUsersPage from "@/pages/WsUsersPage";
import WsUploadPage from "@/pages/WsUploadPage";
import WsDashboard from "@/pages/WsDashboard";
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

  if (!session) return <Navigate to="/auth" replace />;

  // ws_user without admin role → redirect to WS area
  if (isWsUser && !isAdmin) return <Navigate to="/ws" replace />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/feasibility" element={<FeasibilityPage />} />
        <Route path="/base-lm" element={<BaseLMPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/ws-users" element={isAdmin ? <WsUsersPage /> : <Navigate to="/" replace />} />
        <Route path="/ws-upload" element={isAdmin ? <WsUploadPage /> : <Navigate to="/" replace />} />
        <Route path="/ws-single" element={isAdmin ? <WsSingleSearch /> : <Navigate to="/" replace />} />
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

  // Admin accessing /ws → let them through too
  if (!isWsUser && !isAdmin) return <Navigate to="/" replace />;

  return (
    <WsLayout>
      <Routes>
        <Route path="/" element={<WsUploadPage />} />
        <Route path="/single" element={<WsSingleSearch />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </WsLayout>
  );
}

function AuthRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) {
    const chosenView = sessionStorage.getItem("login_view");
    sessionStorage.removeItem("login_view");
    if (chosenView === "ws") return <Navigate to="/ws" replace />;
    return <Navigate to="/" replace />;
  }
  return <Auth />;
}

function WsAuthRoute() {
  const { session, loading } = useAuth();
  const { isWsUser, isLoading: roleLoading } = useUserRole();
  if (loading) return null;
  if (session && !roleLoading && isWsUser) return <Navigate to="/ws" replace />;
  if (session) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/ws/login" element={<WsAuthRoute />} />
            <Route path="/ws/*" element={<WsRoutes />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
