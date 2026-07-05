import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
  import { ThemeProvider } from "next-themes";
  import { Toaster as Sonner } from "@/components/ui/sonner";
  import { Toaster } from "@/components/ui/toaster";
  import { TooltipProvider } from "@/components/ui/tooltip";
  import HomeRedirect from "./pages/HomeRedirect.tsx";
  import NotFound from "./pages/NotFound.tsx";
  import Auth from "./pages/Auth.tsx";
  import AdminLogin from "./pages/AdminLogin.tsx";
  import { AppShell } from "./components/swift/AppShell.tsx";
  import { AdminShell } from "./components/swift/AdminShell.tsx";
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
  import Schedules from "./pages/app/Schedules.tsx";
  import ScheduleNew from "./pages/app/ScheduleNew.tsx";
  import Settings from "./pages/app/Settings.tsx";
  import Support from "./pages/app/Support.tsx";
  import TransactionDetail from "./pages/app/TransactionDetail.tsx";
  import Receipt from "./pages/app/Receipt.tsx";
  import ProviderStatus from "./pages/app/ProviderStatus.tsx";
  import Ledger from "./pages/app/Ledger.tsx";
  import DepositStatus from "./pages/app/DepositStatus.tsx";
  import TreasuryDashboard from "./pages/app/admin/TreasuryDashboard.tsx";
  import UserManagement from "./pages/app/admin/UserManagement.tsx";
  import SupportCenter from "./pages/app/admin/SupportCenter.tsx";
  import FraudMonitor from "./pages/app/admin/FraudMonitor.tsx";
  import Broadcast from "./pages/app/admin/Broadcast.tsx";
  import ProviderMarginReport from "./pages/app/admin/ProviderMarginReport.tsx";

  const queryClient = new QueryClient();

  const App = () => (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner theme="dark" />
          <BrowserRouter>
            <Routes>
              {/* Root route: logged-in → /app, guest → landing page */}
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/app/setup-pin" element={<PinSetup />} />
              {/* Admin panel — MUST come BEFORE /app so /app/admin/* matches here */}
              <Route path="/app/admin" element={<AdminShell />}>
                <Route path="treasury" element={<TreasuryDashboard />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="support" element={<SupportCenter />} />
                <Route path="fraud" element={<FraudMonitor />} />
                <Route path="broadcast" element={<Broadcast />} />
                <Route path="margin" element={<ProviderMarginReport />} />
              </Route>
              {/* User app — comes AFTER /app/admin */}
              <Route path="/app" element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="bills" element={<Bills />} />
                <Route path="schedules" element={<Schedules />} />
                <Route path="schedules/new" element={<ScheduleNew />} />
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
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );

  export default App;
