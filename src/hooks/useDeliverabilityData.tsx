import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { calculateRate } from '@/lib/metrics';
import { logger } from '@/lib/logger';

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

      // Fetch email accounts for mailbox and domain data
      const { data: emailAccountsData } = await supabase
        .from('email_accounts')
        .select('*')
        .in('engagement_id', engagementIds);

      const emailAccounts = emailAccountsData || [];

      // Fetch campaign bounce data from campaigns table
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('id, name, total_sent, total_bounced, total_replied, campaign_type')
        .in('engagement_id', engagementIds);

      // Process campaign bounces
      const bounceData: CampaignBounceData[] = (campaignsData || [])
        .filter(c => (c.total_sent || 0) > 0)
        .map(c => ({
          id: c.id,
          name: c.name,
          bounceRate: calculateRate(c.total_bounced || 0, c.total_sent || 1),
          bounces: c.total_bounced || 0,
          sent: c.total_sent || 0,
          platform: c.campaign_type,
        }))
        .sort((a, b) => b.bounceRate - a.bounceRate);

      // Calculate aggregate stats from campaigns
      const totalSent = bounceData.reduce((sum, c) => sum + c.sent, 0);
      const totalBounced = bounceData.reduce((sum, c) => sum + c.bounces, 0);
      const avgBounceRate = calculateRate(totalBounced, totalSent);

      // Build mailboxes list from email_accounts
      const mailboxesList: MailboxHealth[] = emailAccounts.map((a: any) => {
        const email = a.from_email || '';
        const domain = email.split('@')[1] || 'unknown';
        return {
          id: a.id,
          email,
          domain,
          isActive: a.is_active || false,
          healthScore: a.warmup_reputation || 0,
          warmupEnabled: a.warmup_enabled || false,
          warmupPercentage: a.warmup_reputation || 0,
          warmupStatus: a.warmup_status || 'unknown',
          dailyLimit: a.message_per_day || 0,
          bounceRate: 0,
          replyRate: 0,
          spamComplaintRate: 0,
          sent30d: a.daily_sent_count || 0,
          accountStatus: a.is_active ? 'active' : 'inactive',
          platform: 'email',
        };
      });

      // Build domains list from email_accounts
      const domainMap = new Map<string, {
        mailboxCount: number;
        activeMailboxes: number;
        totalDailyCapacity: number;
        warmingUpCount: number;
        healthScores: number[];
      }>();

      emailAccounts.forEach((a: any) => {
        const email = a.from_email || '';
        const domain = email.split('@')[1] || 'unknown';
        
        const existing = domainMap.get(domain) || {
          mailboxCount: 0,
          activeMailboxes: 0,
          totalDailyCapacity: 0,
          warmingUpCount: 0,
          healthScores: [],
        };

        existing.mailboxCount += 1;
        if (a.is_active) existing.activeMailboxes += 1;
        existing.totalDailyCapacity += a.message_per_day || 0;
        if (a.warmup_enabled) existing.warmingUpCount += 1;
        if (a.warmup_reputation !== null) existing.healthScores.push(a.warmup_reputation);
        
        domainMap.set(domain, existing);
      });

      const domainsList: DomainHealth[] = Array.from(domainMap.entries()).map(([domain, data]) => ({
        domain,
        mailboxCount: data.mailboxCount,
        activeMailboxes: data.activeMailboxes,
        totalDailyCapacity: data.totalDailyCapacity,
        avgHealthScore: data.healthScores.length > 0 
          ? data.healthScores.reduce((a, b) => a + b, 0) / data.healthScores.length 
          : 0,
        avgWarmupPercentage: 0,
        warmingUpCount: data.warmingUpCount,
        avgBounceRate: 0,
        avgReplyRate: 0,
        spfValid: false,
        dkimValid: false,
        dmarcValid: false,
        isBulkSender: false,
        blacklistStatus: 'clean',
        googlePostmasterReputation: null,
        domainStatus: 'active',
      }));

      // Calculate total replied for reply rate
      const totalReplied = (campaignsData || []).reduce((sum, c) => sum + (c.total_replied || 0), 0);
      const avgReplyRate = calculateRate(totalReplied, totalSent);

      // Calculate health scores
      const allHealthScores = emailAccounts
        .filter((a: any) => a.warmup_reputation !== null)
        .map((a: any) => a.warmup_reputation);
      const avgHealthScore = allHealthScores.length > 0 
        ? allHealthScores.reduce((a: number, b: number) => a + b, 0) / allHealthScores.length 
        : 0;

      setStats({
        totalMailboxes: emailAccounts.length,
        activeMailboxes: emailAccounts.filter((a: any) => a.is_active).length,
        totalDomains: domainMap.size,
        totalDailyCapacity: emailAccounts.reduce((sum: number, a: any) => sum + (a.message_per_day || 0), 0),
        totalSent30d: totalSent,
        avgBounceRate,
        avgReplyRate,
        avgHealthScore,
        warmingUpCount: emailAccounts.filter((a: any) => a.warmup_enabled).length,
        domainsWithFullAuth: 0, // Would need sending_domains table for auth validation
        blacklistedDomains: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
      });
      
      setMailboxes(mailboxesList);
      setDomains(domainsList);
      setAlerts([]);
      setCampaignBounces(bounceData);
      
    } catch (err) {
      logger.error('Error fetching deliverability data', err);
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
