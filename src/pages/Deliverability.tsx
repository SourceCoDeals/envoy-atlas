import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Loader2, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';
import { DeliverabilityRiskScore } from '@/components/deliverability/DeliverabilityRiskScore';
import { InboxPlacementEstimate } from '@/components/deliverability/InboxPlacementEstimate';
import { AuthenticationStatus } from '@/components/deliverability/AuthenticationStatus';
import { DeliverabilityAlerts } from '@/components/deliverability/DeliverabilityAlerts';

export default function Deliverability() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  // Simulated data for the new components
  const riskData = {
    riskScore: 28,
    riskLevel: 'low' as const,
    riskFactors: [
      { factor: 'Domain age under 90 days', severity: 'medium' as const, value: '45 days' },
      { factor: 'DMARC policy is relaxed', severity: 'low' as const },
    ],
    components: { bounceRisk: 4, complaintRisk: 6, reputationRisk: 10, authRisk: 8 },
    trend: 'improving' as const,
    trendValue: 5,
  };

  const placementData = {
    overallInboxRate: 0.87,
    breakdown: { inbox: 0.74, promotions: 0.13, spam: 0.08, blocked: 0.05 },
    byISP: [
      { name: 'Gmail', estimatedInboxRate: 0.82, volume: 4500, deliveryRate: 0.96 },
      { name: 'Outlook', estimatedInboxRate: 0.91, volume: 2800, deliveryRate: 0.98 },
      { name: 'Yahoo', estimatedInboxRate: 0.78, volume: 800, deliveryRate: 0.94 },
      { name: 'Corporate', estimatedInboxRate: 0.94, volume: 3200, deliveryRate: 0.99 },
    ],
    confidence: 'estimated' as const,
  };

  const authData = [
    {
      domain: 'company.com',
      records: [
        { type: 'SPF' as const, status: 'pass' as const, details: 'v=spf1 include:_spf.google.com ~all', lastChecked: '2 hours ago' },
        { type: 'DKIM' as const, status: 'pass' as const, details: 'Signature valid (2048-bit)', lastChecked: '2 hours ago' },
        { type: 'DMARC' as const, status: 'partial' as const, details: 'p=none (monitoring only)', lastChecked: '2 hours ago' },
      ],
      overallScore: 85,
      isBulkSender: true,
    },
  ];

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) fetchData();
  }, [currentWorkspace?.id]);

  const fetchData = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const { data: accounts } = await supabase
        .from('email_accounts')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .limit(1);
      setHasData((accounts?.length || 0) > 0);
      
      // Set sample alerts
      setAlerts([
        { id: '1', type: 'warning', title: 'Bounce Rate Increasing', description: 'Bounce rate has increased 0.4% over the last 7 days.', metric: '2.8%', trend: 'up', timestamp: '2 hours ago' },
      ]);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deliverability</h1>
          <p className="text-muted-foreground">Predictive risk management – Are we safe to send?</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !hasData ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4"><Shield className="h-8 w-8 text-success" /></div>
              <h2 className="text-xl font-semibold mb-2">No Email Accounts Yet</h2>
              <p className="text-muted-foreground text-center max-w-md">Sync your data to monitor deliverability health.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <DeliverabilityRiskScore {...riskData} />
            <InboxPlacementEstimate {...placementData} />
            <AuthenticationStatus domains={authData} />
            <DeliverabilityAlerts alerts={alerts} onDismiss={(id) => setAlerts(a => a.filter(x => x.id !== id))} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
