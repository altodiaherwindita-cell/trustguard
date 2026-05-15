import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { VendorsPage } from "@/pages/VendorsPage";
import { AssessmentsPage } from "@/pages/AssessmentsPage";
import { QuestionnairePage } from "@/pages/QuestionnairePage";
import { QuestionnaireManagementPage } from "@/pages/QuestionnaireManagementPage";
import { AIAssistantPage } from "@/pages/AIAssistantPage";
import { SettingsPage } from "@/pages/SettingsPage";
import AuthPage from "@/pages/AuthPage";
import InvitePage from "@/pages/InvitePage";
import NotFound from "./pages/NotFound";
import UserManagementPage from "@/pages/UserManagementPage";
import AuditLogsPage from "@/pages/AuditLogsPage";
import EvidenceManagementPage from "@/pages/EvidenceManagementPage";

const queryClient = new QueryClient();

const Protected = ({ children, role }: { children: React.ReactNode; role?: 'tprm' | 'admin' }) => (
  <RequireAuth role={role}>
    <AppLayout>{children}</AppLayout>
  </RequireAuth>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/vendors" element={<Protected role="tprm"><VendorsPage /></Protected>} />
            <Route path="/assessments" element={<Protected role="tprm"><AssessmentsPage /></Protected>} />
            <Route path="/questionnaire/:assessmentId" element={<Protected><QuestionnairePage /></Protected>} />
            <Route path="/questionnaires" element={<Protected role="tprm"><QuestionnaireManagementPage /></Protected>} />
            <Route path="/ai-assistant" element={<Protected role="tprm"><AIAssistantPage /></Protected>} />
            <Route path="/users" element={<Protected role="admin"><UserManagementPage /></Protected>} />
            <Route path="/audit-logs" element={<Protected><AuditLogsPage /></Protected>} />
            <Route path="/evidence" element={<Protected><EvidenceManagementPage /></Protected>} />
            <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
