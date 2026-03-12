import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import Debts from "./pages/Debts";
import Construction from "./pages/Construction";
import Library from "./pages/Library";
import Categories from "./pages/Categories";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import FinancialDashboard from "./pages/FinancialDashboard";
import ExchangeRate from "./pages/ExchangeRate";
import RecurringPayments from "./pages/RecurringPayments";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/accounts/:id" element={<AccountDetail />} />
              <Route path="/transfers" element={<Transactions />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/debts" element={<Debts />} />
              <Route path="/recurring" element={<RecurringPayments />} />
              <Route path="/construction" element={<Construction />} />
              <Route path="/emergency-fund" element={<Construction />} />
              <Route path="/financial-dashboard" element={<FinancialDashboard />} />
              <Route path="/exchange-rate" element={<ExchangeRate />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/library" element={<Library />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
