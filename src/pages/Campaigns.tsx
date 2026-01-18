import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useSyncData } from '@/hooks/useSyncData';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useDataHealth } from '@/hooks/useDataHealth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CampaignPortfolioOverview } from '@/components/campaigns/CampaignPortfolioOverview';
import { EnhancedCampaignTable } from '@/components/campaigns/EnhancedCampaignTable';
import { SyncProgressBar } from '@/components/campaigns/SyncProgressBar';
import { AutoLinkPreviewModal } from '@/components/campaigns/AutoLinkPreviewModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DataHealthIndicator } from '@/components/ui/data-health-indicator';
import { Loader2, Mail, RefreshCw, ArrowRight, Plus, GitCompare, Download, Link2, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Engagement {
  id: string;
  engagement_name: string;
}

export default function Campaigns() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { campaigns, loading, error, refetch } = useCampaigns();
  const { syncing, progress, elapsedTime, triggerSync } = useSyncData();
  const { health: dataHealth } = useDataHealth();
  const [tierFilter, setTierFilter] = useState('all');
  const [engagementFilter, setEngagementFilter] = useState('all');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [autoLinkOpen, setAutoLinkOpen] = useState(false);
  const [autoLinking, setAutoLinking] = useState(false);

  // Fetch engagements
  useEffect(() => {
    if (!currentWorkspace?.id) return;
    
    const fetchEngagements = async () => {
      const { data } = await supabase
        .from('engagements')
        .select('id, engagement_name')
        .eq('workspace_id', currentWorkspace.id)
        .order('engagement_name');
      
      if (data) setEngagements(data);
    };
    
    fetchEngagements();
  }, [currentWorkspace?.id]);

  const handleRefresh = async () => {
    await triggerSync();
    refetch();
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Phase B: Determine platform statuses for status bar
  const smartleadStatus = dataHealth?.email.smartlead.status ?? 'empty';
  const replyioStatus = dataHealth?.email.replyio.status ?? 'empty';
  const hasReplyioBroken = replyioStatus === 'broken';
  const hasSmartleadBroken = smartleadStatus === 'broken';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
            <p className="text-muted-foreground">
              Portfolio analysis and performance breakdown
            </p>
          </div>
          {campaigns.length > 0 && (
            <div className="flex gap-2">
              {/* Phase B: Platform status bar */}
              <div className="flex items-center gap-3 mr-4 px-3 py-1.5 rounded-md bg-muted/50 border">
                <DataHealthIndicator
                  status={smartleadStatus}
                  label="Smartlead"
                  size="sm"
                  tooltip={dataHealth?.email.smartlead.details}
                />
                <div className="w-px h-4 bg-border" />
                <DataHealthIndicator
                  status={replyioStatus}
                  label="Reply.io"
                  size="sm"
                  tooltip={dataHealth?.email.replyio.details}
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh} 
                disabled={loading || syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Refresh Data'}
              </Button>
            </div>
          )}
        </div>

        {/* Sync Progress Bar */}
        <SyncProgressBar 
          progress={progress} 
          isActive={syncing} 
          elapsedTime={elapsedTime} 
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={refetch}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : campaigns.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Campaigns Yet</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Connect your Smartlead account and sync your data to see campaign performance here.
              </p>
              <Button asChild>
                <Link to="/connections">
                  Go to Connections
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Phase B: Critical Platform Broken Alert */}
            {hasReplyioBroken && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <XCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="flex items-center justify-between gap-4">
                  <div>
                    <span className="font-medium text-destructive">Reply.io metrics broken:</span>{' '}
                    <span>sent_count=0 across all campaigns. Trigger a full resync from </span>
                    <Link to="/connections" className="underline font-medium hover:text-primary">Settings → Connections</Link>
                    <span> with "Reset" enabled.</span>
                  </div>
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <Link to="/connections">Go to Connections</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Degraded warning (non-critical) */}
            {!hasReplyioBroken && smartleadStatus === 'degraded' && (
              <Alert className="border-warning/30 bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription>
                  Smartlead metrics partially available. Some opens may be missing due to API limitations.
                </AlertDescription>
              </Alert>
            )}

            {/* Portfolio Overview - clickable filters */}
            <CampaignPortfolioOverview 
              campaigns={campaigns} 
              onTierFilterChange={setTierFilter}
              activeTierFilter={tierFilter}
            />

            {/* Action Bar */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAutoLinkOpen(true)}
                disabled={loading || autoLinking || engagements.length === 0}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Auto-Link Campaigns
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
              <Button variant="outline" size="sm" disabled>
                <GitCompare className="h-4 w-4 mr-2" />
                Compare Selected
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </div>

            {/* Enhanced Campaign Table with tier + engagement filter sync */}
            <EnhancedCampaignTable 
              campaigns={campaigns} 
              tierFilter={tierFilter}
              onTierFilterChange={setTierFilter}
              engagementFilter={engagementFilter}
              onEngagementFilterChange={setEngagementFilter}
              engagements={engagements.map(e => ({ id: e.id, name: e.engagement_name }))}
            />

            {/* Auto-Link Modal */}
            <AutoLinkPreviewModal
              open={autoLinkOpen}
              onOpenChange={setAutoLinkOpen}
              campaigns={campaigns}
              engagements={engagements.map(e => ({ 
                id: e.id, 
                engagement_name: e.engagement_name 
              }))}
              onConfirm={async (matches) => {
                if (!currentWorkspace?.id) return;
                
                setAutoLinking(true);
                try {
                  const { data, error } = await supabase.functions.invoke('auto-link-campaigns', {
                    body: { matches, workspace_id: currentWorkspace.id }
                  });
                  
                  if (error) throw error;
                  
                  toast.success(`Successfully linked ${data.linked} campaigns`);
                  refetch();
                } catch (err: unknown) {
                  const message = err instanceof Error ? err.message : 'Failed to link campaigns';
                  toast.error(message);
                } finally {
                  setAutoLinking(false);
                }
              }}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}