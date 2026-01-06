import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Connections from "./pages/Connections";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import Inbox from "./pages/Inbox";
import Deliverability from "./pages/Deliverability";
import Audience from "./pages/Audience";
import AudienceInsights from "./pages/AudienceInsights";
import CopyInsights from "./pages/CopyInsights";
import CopyLibrary from "./pages/CopyLibrary";
import Experiments from "./pages/Experiments";
import Playbook from "./pages/Playbook";
import Alerts from "./pages/Alerts";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/connections" element={<Connections />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/:campaignId" element={<CampaignDetail />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/deliverability" element={<Deliverability />} />
              <Route path="/audience" element={<Audience />} />
              <Route path="/audience-insights" element={<AudienceInsights />} />
              <Route path="/copy-insights" element={<CopyInsights />} />
              <Route path="/copy-library" element={<CopyLibrary />} />
              <Route path="/experiments" element={<Experiments />} />
              <Route path="/playbook" element={<Playbook />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/settings" element={<Settings />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
