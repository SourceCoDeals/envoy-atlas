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
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import DealHub from "./pages/DealHub";
import MonthlyReport from "./pages/MonthlyReport";
import Auth from "./pages/Auth";
import Connections from "./pages/Connections";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import CampaignSummary from "./pages/CampaignSummary";
import Inbox from "./pages/Inbox";
import InboxDetail from "./pages/InboxDetail";
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
import CallerDashboard from "./pages/CallerDashboard";
import EngagementDashboard from "./pages/EngagementDashboard";
import TopCallsWeek from "./pages/TopCallsWeek";
import DataInsights from "./pages/DataInsights";
import CallLibrary from "./pages/CallLibrary";
import CallInsights from "./pages/CallInsights";

import EngagementReport from "./pages/EngagementReport";
import { Navigate } from "react-router-dom";
import CallSessions from "./pages/CallSessions";
import CallSearch from "./pages/CallSearch";
import BestWorstCalls from "./pages/BestWorstCalls";
import RepInsights from "./pages/RepInsights";
import PatternAnalysis from "./pages/PatternAnalysis";
import TrainingQueue from "./pages/TrainingQueue";
import OnboardingProgress from "./pages/OnboardingProgress";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import ContactsSearch from "./pages/ContactsSearch";
import Team from "./pages/Team";
import PhoneBurnerCallback from "./pages/PhoneBurnerCallback";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary section="Application">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <ChannelProvider>
              <BrowserRouter>
                <OnboardingProvider>
                  <OnboardingModal />
                  <HelpSidebar />

                  <Toaster />
                  <Sonner />

                  <Routes>
                    {/* Email routes */}
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/deal-hub" element={<DealHub />} />
                    <Route path="/monthly-report" element={<MonthlyReport />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/connections" element={<Navigate to="/settings?tab=connections" replace />} />
                    <Route path="/oauth/phoneburner/callback" element={<PhoneBurnerCallback />} />
                    <Route path="/campaigns" element={<Campaigns />} />
                    <Route path="/campaigns/:campaignId" element={<CampaignDetail />} />
                    <Route path="/campaigns/:platform/:campaignId/summary" element={<CampaignSummary />} />
                    <Route path="/inbox" element={<Inbox />} />
                    <Route path="/inbox/:inboxId" element={<InboxDetail />} />
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

                    {/* Engagements routes - Top-level channel */}
                    <Route path="/engagements" element={<EngagementDashboard />} />
                    <Route path="/engagements/performance" element={<EngagementDashboard />} />
                    <Route path="/engagements/:engagementId/report" element={<EngagementReport />} />

                    {/* Calling routes - Consolidated structure */}
                    <Route path="/calling" element={<CallerDashboard />} />
                    <Route path="/calling/top-calls" element={<TopCallsWeek />} />
                    <Route path="/calling/insights" element={<DataInsights />} />
                    <Route path="/calling/call-insights" element={<CallInsights />} />
                    <Route path="/calling/library" element={<CallLibrary />} />
                    
                    {/* Redirects for removed pages */}
                    <Route path="/calling/deals" element={<Navigate to="/calling" replace />} />
                    <Route path="/calling/analytics" element={<Navigate to="/calling/insights" replace />} />
                    <Route path="/calling/timing" element={<Navigate to="/calling/insights" replace />} />
                    <Route path="/calling/chatbot" element={<Navigate to="/calling" replace />} />
                    <Route path="/calling/engagements" element={<Navigate to="/engagements" replace />} />
                    
                    {/* Legacy calling routes */}
                    <Route path="/calling/search" element={<CallSearch />} />
                    <Route path="/calling/best-worst" element={<BestWorstCalls />} />
                    <Route path="/calling/sessions" element={<CallSessions />} />
                    <Route path="/calling/reps" element={<RepInsights />} />
                    <Route path="/calling/patterns" element={<PatternAnalysis />} />
                    <Route path="/calling/training" element={<TrainingQueue />} />
                    <Route path="/calling/onboarding" element={<OnboardingProgress />} />
                    <Route path="/calling/team" element={<Team />} />

                    {/* Shared routes */}
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/contacts/:contactId" element={<ContactDetail />} />
                    <Route path="/contacts/search" element={<ContactsSearch />} />

                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </OnboardingProvider>
              </BrowserRouter>
            </ChannelProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;