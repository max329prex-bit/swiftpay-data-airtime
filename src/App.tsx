import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/app/setup-pin" element={<PinSetup />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="bills" element={<Bills />} />
            <Route path="settings" element={<Settings />} />
            <Route path="airtime" element={<Airtime />} />
            <Route path="data" element={<Data />} />
            <Route path="electricity" element={<Electricity />} />
            <Route path="cable" element={<Cable />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="history" element={<History />} />
            <Route path="success" element={<Success />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
