import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface DomainHealth {
  domain: string;
  mailboxCount: number;
  activeMailboxes: number;
  totalDailyCapacity: number;
  avgHealthScore: number;
  avgWarmupPercentage: number;
  warmingUpCount: number;
  avgBounceRate: number;
  avgReplyRate: number;
  spfValid: boolean;
  dkimValid: boolean;
  dmarcValid: boolean;
  isBulkSender: boolean;
  blacklistStatus: string;
  googlePostmasterReputation: string | null;
  domainStatus: string;
}

export interface MailboxHealth {
  id: string;
  email: string;
  domain: string;
  isActive: boolean;
  healthScore: number;
  warmupEnabled: boolean;
  warmupPercentage: number;
  warmupStatus: string;
  dailyLimit: number;
  bounceRate: number;
  replyRate: number;
  spamComplaintRate: number;
  sent30d: number;
  accountStatus: string;
  platform: string;
}

export interface DeliverabilityAlert {
  id: string;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  metricValue: number | null;
  thresholdValue: number | null;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
}

export interface DeliverabilityStats {
  totalMailboxes: number;
  activeMailboxes: number;
  totalDomains: number;
  totalDailyCapacity: number;
  totalSent30d: number;
  avgBounceRate: number;
  avgReplyRate: number;
  avgHealthScore: number;
  warmingUpCount: number;
  domainsWithFullAuth: number;
  blacklistedDomains: number;
  criticalAlerts: number;
  warningAlerts: number;
}

export interface CampaignBounceData {
  id: string;
  name: string;
  bounceRate: number;
  bounces: number;
  sent: number;
  platform: string;
}

export function useDeliverabilityData() {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<DomainHealth[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxHealth[]>([]);
  const [alerts, setAlerts] = useState<DeliverabilityAlert[]>([]);
  const [stats, setStats] = useState<DeliverabilityStats | null>(null);
  const [campaignBounces, setCampaignBounces] = useState<CampaignBounceData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get engagement IDs for this client
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);

      if (engagementIds.length === 0) {
        // No engagements, return empty data
        setStats({
          totalMailboxes: 0,
          activeMailboxes: 0,
          totalDomains: 0,
          totalDailyCapacity: 0,
          totalSent30d: 0,
          avgBounceRate: 0,
          avgReplyRate: 0,
          avgHealthScore: 0,
          warmingUpCount: 0,
          domainsWithFullAuth: 0,
          blacklistedDomains: 0,
          criticalAlerts: 0,
          warningAlerts: 0,
        });
        setMailboxes([]);
        setDomains([]);
        setAlerts([]);
        setCampaignBounces([]);
        setLoading(false);
        return;
      }

      // Fetch campaign bounce data from campaigns table
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('id, name, total_sent, total_bounced, campaign_type')
        .in('engagement_id', engagementIds);

      // Process campaign bounces
      const bounceData: CampaignBounceData[] = (campaignsData || [])
        .filter(c => (c.total_sent || 0) > 0)
        .map(c => ({
          id: c.id,
          name: c.name,
          bounceRate: ((c.total_bounced || 0) / (c.total_sent || 1)) * 100,
          bounces: c.total_bounced || 0,
          sent: c.total_sent || 0,
          platform: c.campaign_type,
        }))
        .sort((a, b) => b.bounceRate - a.bounceRate);

      // Calculate aggregate stats from campaigns
      const totalSent = bounceData.reduce((sum, c) => sum + c.sent, 0);
      const totalBounced = bounceData.reduce((sum, c) => sum + c.bounces, 0);
      const avgBounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;

      setStats({
        totalMailboxes: 0,
        activeMailboxes: 0,
        totalDomains: 0,
        totalDailyCapacity: 0,
        totalSent30d: totalSent,
        avgBounceRate,
        avgReplyRate: 0,
        avgHealthScore: 100 - avgBounceRate,
        warmingUpCount: 0,
        domainsWithFullAuth: 0,
        blacklistedDomains: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
      });
      
      setMailboxes([]);
      setDomains([]);
      setAlerts([]);
      setCampaignBounces(bounceData);
      
    } catch (err) {
      console.error('Error fetching deliverability data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  const dismissAlert = useCallback(async (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  const markAlertRead = useCallback(async (alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, isRead: true } : a
    ));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    error,
    domains,
    mailboxes,
    alerts,
    stats,
    campaignBounces,
    refetch: fetchData,
    dismissAlert,
    markAlertRead,
  };
}
