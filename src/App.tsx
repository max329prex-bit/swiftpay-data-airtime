import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import AdminLogin from "./pages/AdminLogin.tsx";
import { AppShell } from "./components/swift/AppShell.tsx";
import Dashboard from "./pages/app/Dashboard.tsx";
import Airtime from "./pages/app/Airtime.tsx";
import Data from "./pages/app/Data.tsx";
import Wallet from "./pages/app/Wallet.tsx";
import History from "./pages/app/History.tsx";
import Success from "./pages/app/Success.tsx";
import Electricity from "./pages/app/Electricity.tsx";
import Cable from "./pages/app/Cable.tsx";
import PinSetup from "./pages/app/PinSetup.tsx";
import Bills from "./pages/app/Bills.tsx";
import Settings from "./pages/app/Settings.tsx";
import Support from "./pages/app/Support.tsx";
import TransactionDetail from "./pages/app/TransactionDetail.tsx";
import Receipt from "./pages/app/Receipt.tsx";
import ProviderStatus from "./pages/app/ProviderStatus.tsx";
import Ledger from "./pages/app/Ledger.tsx";
import DepositStatus from "./pages/app/DepositStatus.tsx";
import TreasuryDashboard from "./pages/app/admin/TreasuryDashboard.tsx";
import SupportCenter from "./pages/app/admin/SupportCenter.tsx";
import FraudMonitor from "./pages/app/admin/FraudMonitor.tsx";
import Broadcast from "./pages/app/admin/Broadcast.tsx";
import { useAdminRole } from "./hooks/useAdminRole.tsx";
import { BoltLoader } from "./components/swift/BoltLoader.tsx";

const queryClient = new QueryClient();

/**
 * Protects admin routes — redirects non-admins to /admin login.
 */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAdminRole();
  if (loading) return (
    <div className="py-24 grid place-items-center">
      <BoltLoader size={40} label="Checking access..." />
    </div>
  );
  if (!isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner theme="dark" />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            {/* Standalone admin login — password + OTP, no email field */}
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/app/setup-pin" element={<PinSetup />} />
            <Route path="/app" element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="bills" element={<Bills />} />
              <Route path="support" element={<Support />} />
              <Route path="settings" element={<Settings />} />
              <Route path="airtime" element={<Airtime />} />
              <Route path="data" element={<Data />} />
              <Route path="electricity" element={<Electricity />} />
              <Route path="cable" element={<Cable />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="history" element={<History />} />
              <Route path="success" element={<Success />} />
              <Route path="transaction/:id" element={<TransactionDetail />} />
              <Route path="receipt/:id" element={<Receipt />} />
              <Route path="provider-status" element={<ProviderStatus />} />
              <Route path="ledger" element={<Ledger />} />
              <Route path="deposit-status" element={<DepositStatus />} />
              {/* Admin-only routes — non-admins redirect to /admin login */}
              <Route path="admin/treasury" element={<RequireAdmin><TreasuryDashboard /></RequireAdmin>} />
              <Route path="admin/support" element={<RequireAdmin><SupportCenter /></RequireAdmin>} />
              <Route path="admin/fraud" element={<RequireAdmin><FraudMonitor /></RequireAdmin>} />
              <Route path="admin/broadcast" element={<RequireAdmin><Broadcast /></RequireAdmin>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
