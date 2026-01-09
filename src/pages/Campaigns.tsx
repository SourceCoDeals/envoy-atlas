import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useSyncData } from '@/hooks/useSyncData';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CampaignPortfolioOverview } from '@/components/campaigns/CampaignPortfolioOverview';
import { EnhancedCampaignTable } from '@/components/campaigns/EnhancedCampaignTable';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, RefreshCw, ArrowRight, Plus, GitCompare, Download } from 'lucide-react';

export default function Campaigns() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { campaigns, loading, error, refetch } = useCampaigns();
  const { syncing, triggerSync } = useSyncData();
  const [tierFilter, setTierFilter] = useState('all');

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
            {/* Portfolio Overview - clickable filters */}
            <CampaignPortfolioOverview 
              campaigns={campaigns} 
              onTierFilterChange={setTierFilter}
              activeTierFilter={tierFilter}
            />

            {/* Action Bar */}
            <div className="flex gap-2">
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

            {/* Enhanced Campaign Table with tier filter sync */}
            <EnhancedCampaignTable 
              campaigns={campaigns} 
              tierFilter={tierFilter}
              onTierFilterChange={setTierFilter}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}