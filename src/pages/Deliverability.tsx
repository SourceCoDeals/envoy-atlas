import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Loader2, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { DeliverabilityRiskScore } from '@/components/deliverability/DeliverabilityRiskScore';
import { InboxPlacementEstimate } from '@/components/deliverability/InboxPlacementEstimate';
import { AuthenticationStatus } from '@/components/deliverability/AuthenticationStatus';
import { DeliverabilityAlerts, DeliverabilityAlert } from '@/components/deliverability/DeliverabilityAlerts';
import { BounceBreakdown } from '@/components/deliverability/BounceBreakdown';
import { EmailAccountHealth } from '@/components/deliverability/EmailAccountHealth';
import { DeliverabilityTrends } from '@/components/deliverability/DeliverabilityTrends';
import { BlacklistStatus } from '@/components/deliverability/BlacklistStatus';
import { SendingVolumeAnalysis } from '@/components/deliverability/SendingVolumeAnalysis';
import { subDays, format } from 'date-fns';

export default function Deliverability() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [alerts, setAlerts] = useState<DeliverabilityAlert[]>([]);

  // Risk score data
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

  // Inbox placement data
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

  // Authentication data
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

  // Bounce breakdown data
  const bounceData = {
    totalBounces: 127,
    bounceRate: 2.8,
    hardBounces: 89,
    softBounces: 38,
    threshold: 3.0,
    byCampaign: [
      { name: 'Q1 Outreach - Tech Sector', bounceRate: 3.8, bounces: 45, sent: 1184 },
      { name: 'SMB Direct Mail', bounceRate: 2.1, bounces: 32, sent: 1524 },
      { name: 'Enterprise Follow-up', bounceRate: 1.4, bounces: 18, sent: 1286 },
    ],
    byReason: [
      { reason: 'Invalid email address', count: 52, type: 'hard' as const },
      { reason: 'Mailbox not found', count: 37, type: 'hard' as const },
      { reason: 'Mailbox full', count: 22, type: 'soft' as const },
      { reason: 'Server temporarily unavailable', count: 16, type: 'soft' as const },
    ],
  };

  // Email account health data
  const accountsData = [
    { email: 'john@company.com', status: 'healthy' as const, healthScore: 92, sent7d: 1247, dailyLimit: 200, issues: [] },
    { email: 'sarah@company.com', status: 'warning' as const, healthScore: 68, sent7d: 2104, dailyLimit: 200, issues: ['High bounce rate'] },
    { email: 'mike@company.com', status: 'critical' as const, healthScore: 34, sent7d: 892, dailyLimit: 200, issues: ['Spam complaints', 'Low engagement'] },
    { email: 'outreach@company.com', status: 'warming' as const, healthScore: 78, sent7d: 312, dailyLimit: 50, issues: [], warmupDay: 14, warmupTotal: 30 },
  ];

  // Trend data
  const trendData = Array.from({ length: 30 }, (_, i) => {
    const date = subDays(new Date(), 29 - i);
    return {
      date: format(date, 'yyyy-MM-dd'),
      riskScore: 28 + Math.sin(i / 5) * 8 + (29 - i) * 0.2,
      bounceRate: 2.8 + Math.sin(i / 3) * 0.5,
      complaintRate: 0.08 + Math.sin(i / 4) * 0.02,
      inboxRate: 87 - Math.sin(i / 5) * 5,
    };
  });

  const keyEvents = [
    { date: format(subDays(new Date(), 18), 'yyyy-MM-dd'), description: 'Cleaned 2,400 invalid contacts', impact: 'positive' as const },
    { date: format(subDays(new Date(), 12), 'yyyy-MM-dd'), description: 'New campaign with unverified list', impact: 'negative' as const },
    { date: format(subDays(new Date(), 5), 'yyyy-MM-dd'), description: 'DKIM implemented', impact: 'positive' as const },
  ];

  // Sending volume data
  const volumeData = {
    totalSent7d: 4555,
    dailyAverage: 651,
    dailyCapacity: 850,
    utilizationPercent: 77,
    trend: 'increasing' as const,
    trendPercent: 12,
    volumeByDay: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
      day,
      sent: Math.floor(500 + Math.random() * 300),
      capacity: 850,
    })),
    peakHour: 10,
  };

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
      
      setAlerts([
        { 
          id: '1', 
          type: 'warning', 
          title: 'Bounce Rate Increasing', 
          description: 'Bounce rate increased from 2.4% to 2.8% over the last 7 days.',
          metric: '2.8%', 
          trend: 'up', 
          timestamp: '2 hours ago',
          threshold: '3.0%',
          thresholdPercent: 93,
          causes: [
            { description: 'List quality degradation in "Q1 Outreach" campaign', value: '3.8% bounce' },
            { description: '847 new contacts added with high bounce rate', value: '4.2%' },
          ],
          recommendations: [
            'Review and clean Q1 Outreach contact list',
            'Verify email addresses before next send',
            'Remove 124 hard bounces from active lists',
          ],
          actions: [
            { label: 'Clean Lists', onClick: () => {} },
            { label: 'View Bounced', onClick: () => {} },
          ],
        },
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
          <div className="space-y-6">
            {/* Trends Chart - Full Width */}
            <DeliverabilityTrends data={trendData} keyEvents={keyEvents} period="30d" />

            {/* Main Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              <DeliverabilityRiskScore {...riskData} />
              <InboxPlacementEstimate {...placementData} />
              <AuthenticationStatus domains={authData} />
              <DeliverabilityAlerts alerts={alerts} onDismiss={(id) => setAlerts(a => a.filter(x => x.id !== id))} />
              <BounceBreakdown data={bounceData} onCleanLists={() => {}} onViewBounced={() => {}} />
              <EmailAccountHealth accounts={accountsData} />
              <BlacklistStatus isListed={false} listedOn={[]} totalChecked={84} lastChecked="2 hours ago" />
              <SendingVolumeAnalysis {...volumeData} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
