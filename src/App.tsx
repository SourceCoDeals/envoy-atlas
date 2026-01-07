import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { OnboardingProvider } from "@/hooks/useOnboarding";
import { OnboardingModal, HelpSidebar } from "@/components/onboarding";
import { ChannelProvider } from "@/hooks/useChannel";
import Dashboard from "./pages/Dashboard";
import DealHub from "./pages/DealHub";
import MonthlyReport from "./pages/MonthlyReport";
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
import CopywritingStudio from "./pages/CopywritingStudio";
import CallingDashboard from "./pages/CallingDashboard";
import CallSessions from "./pages/CallSessions";
import CallAnalytics from "./pages/CallAnalytics";
import CallSearch from "./pages/CallSearch";
import BestWorstCalls from "./pages/BestWorstCalls";
import RepInsights from "./pages/RepInsights";
import CallLibrary from "./pages/CallLibrary";
import PatternAnalysis from "./pages/PatternAnalysis";
import TimingInsights from "./pages/TimingInsights";
import TrainingQueue from "./pages/TrainingQueue";
import OnboardingProgress from "./pages/OnboardingProgress";
import Contacts from "./pages/Contacts";
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
            <OnboardingProvider>
              <OnboardingModal />
              <HelpSidebar />
              <Routes>
          <ChannelProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Email routes */}
                <Route path="/" element={<Dashboard />} />
                <Route path="/deal-hub" element={<DealHub />} />
                <Route path="/monthly-report" element={<MonthlyReport />} />
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
                <Route path="/copywriting-studio" element={<CopywritingStudio />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/settings" element={<Settings />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </OnboardingProvider>
          </BrowserRouter>
                
                {/* Calling routes */}
                <Route path="/calling" element={<CallingDashboard />} />
                <Route path="/calling/search" element={<CallSearch />} />
                <Route path="/calling/best-worst" element={<BestWorstCalls />} />
                <Route path="/calling/sessions" element={<CallSessions />} />
                <Route path="/calling/analytics" element={<CallAnalytics />} />
                <Route path="/calling/reps" element={<RepInsights />} />
                <Route path="/calling/library" element={<CallLibrary />} />
                <Route path="/calling/patterns" element={<PatternAnalysis />} />
                <Route path="/calling/timing" element={<TimingInsights />} />
                <Route path="/calling/training" element={<TrainingQueue />} />
                <Route path="/calling/onboarding" element={<OnboardingProgress />} />
                
                {/* Shared routes */}
                <Route path="/contacts" element={<Contacts />} />
                
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ChannelProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
