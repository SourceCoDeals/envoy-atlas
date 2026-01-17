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
      // Fetch email accounts with all metrics
      const { data: accountsData, error: accountsError } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);
      
      if (accountsError) throw accountsError;
      
      // Fetch sending domains
      const { data: domainsData, error: domainsError } = await supabase
        .from('sending_domains')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);
      
      if (domainsError) throw domainsError;
      
      // Fetch deliverability alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('deliverability_alerts')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (alertsError) throw alertsError;
      
      // Fetch campaign bounce data from SmartLead
      const { data: smartleadCampaigns, error: slError } = await supabase
        .from('smartlead_campaigns')
        .select('id, name, sent_count, bounce_count')
        .eq('workspace_id', currentWorkspace.id);
      
      if (slError) throw slError;
      
      // Fetch campaign bounce data from Reply.io
      const { data: replyioCampaigns, error: rError } = await supabase
        .from('replyio_campaigns')
        .select('id, name, contacted, bounced')
        .eq('workspace_id', currentWorkspace.id);
      
      if (rError) throw rError;
      
      // Process mailboxes
      const processedMailboxes: MailboxHealth[] = (accountsData || []).map(a => ({
        id: a.id,
        email: a.email_address,
        domain: a.email_address.split('@')[1] || '',
        isActive: a.is_active,
        healthScore: a.health_score * 100,
        warmupEnabled: a.warmup_enabled,
        warmupPercentage: a.warmup_percentage || 0,
        warmupStatus: a.warmup_status || 'not_started',
        dailyLimit: a.daily_limit,
        bounceRate: a.bounce_rate || 0,
        replyRate: a.reply_rate || 0,
        spamComplaintRate: a.spam_complaint_rate || 0,
        sent30d: a.sent_30d || 0,
        accountStatus: a.account_status || 'active',
        platform: a.platform,
      }));
      
      // Aggregate to domain level
      const domainMap = new Map<string, DomainHealth>();
      
      processedMailboxes.forEach(m => {
        if (!domainMap.has(m.domain)) {
          const domainData = domainsData?.find(d => d.domain === m.domain);
          domainMap.set(m.domain, {
            domain: m.domain,
            mailboxCount: 0,
            activeMailboxes: 0,
            totalDailyCapacity: 0,
            avgHealthScore: 0,
            avgWarmupPercentage: 0,
            warmingUpCount: 0,
            avgBounceRate: 0,
            avgReplyRate: 0,
            spfValid: domainData?.spf_valid || false,
            dkimValid: domainData?.dkim_valid || false,
            dmarcValid: domainData?.dmarc_valid || false,
            isBulkSender: domainData?.is_bulk_sender || false,
            blacklistStatus: domainData?.blacklist_status || 'clean',
            googlePostmasterReputation: domainData?.google_postmaster_reputation,
            domainStatus: domainData?.domain_status || 'active',
          });
        }
        
        const d = domainMap.get(m.domain)!;
        d.mailboxCount++;
        if (m.isActive) d.activeMailboxes++;
        d.totalDailyCapacity += m.dailyLimit;
        d.avgHealthScore += m.healthScore;
        d.avgWarmupPercentage += m.warmupPercentage;
        if (m.warmupEnabled) d.warmingUpCount++;
        d.avgBounceRate += m.bounceRate;
        d.avgReplyRate += m.replyRate;
      });
      
      // Calculate averages
      domainMap.forEach(d => {
        if (d.mailboxCount > 0) {
          d.avgHealthScore /= d.mailboxCount;
          d.avgWarmupPercentage /= d.mailboxCount;
          d.avgBounceRate /= d.mailboxCount;
          d.avgReplyRate /= d.mailboxCount;
        }
      });
      
      const processedDomains = Array.from(domainMap.values());
      
      // Process alerts
      const processedAlerts: DeliverabilityAlert[] = (alertsData || []).map(a => ({
        id: a.id,
        alertType: a.alert_type,
        severity: a.severity as 'info' | 'warning' | 'critical',
        title: a.title,
        message: a.message,
        entityType: a.entity_type,
        entityId: a.entity_id,
        entityName: a.entity_name,
        metricValue: a.metric_value,
        thresholdValue: a.threshold_value,
        isRead: a.is_read,
        isResolved: a.is_resolved,
        createdAt: a.created_at,
      }));
      
      // Process campaign bounces
      const bounceData: CampaignBounceData[] = [];
      
      (smartleadCampaigns || []).forEach(c => {
        if (c.sent_count && c.sent_count > 0) {
          const bounceRate = ((c.bounce_count || 0) / c.sent_count) * 100;
          bounceData.push({
            id: c.id,
            name: c.name,
            bounceRate,
            bounces: c.bounce_count || 0,
            sent: c.sent_count,
            platform: 'smartlead',
          });
        }
      });
      
      (replyioCampaigns || []).forEach(c => {
        if (c.contacted && c.contacted > 0) {
          const bounceRate = ((c.bounced || 0) / c.contacted) * 100;
          bounceData.push({
            id: c.id,
            name: c.name,
            bounceRate,
            bounces: c.bounced || 0,
            sent: c.contacted,
            platform: 'replyio',
          });
        }
      });
      
      // Sort by bounce rate descending
      bounceData.sort((a, b) => b.bounceRate - a.bounceRate);
      
      // Calculate aggregate stats
      const totalMailboxes = processedMailboxes.length;
      const activeMailboxes = processedMailboxes.filter(m => m.isActive).length;
      const totalDomains = processedDomains.length;
      const totalDailyCapacity = processedMailboxes.reduce((sum, m) => sum + m.dailyLimit, 0);
      const totalSent30d = processedMailboxes.reduce((sum, m) => sum + m.sent30d, 0);
      const avgBounceRate = totalMailboxes > 0 
        ? processedMailboxes.reduce((sum, m) => sum + m.bounceRate, 0) / totalMailboxes 
        : 0;
      const avgReplyRate = totalMailboxes > 0
        ? processedMailboxes.reduce((sum, m) => sum + m.replyRate, 0) / totalMailboxes
        : 0;
      const avgHealthScore = totalMailboxes > 0
        ? processedMailboxes.reduce((sum, m) => sum + m.healthScore, 0) / totalMailboxes
        : 0;
      const warmingUpCount = processedMailboxes.filter(m => m.warmupEnabled).length;
      const domainsWithFullAuth = processedDomains.filter(d => d.spfValid && d.dkimValid && d.dmarcValid).length;
      const blacklistedDomains = processedDomains.filter(d => d.blacklistStatus !== 'clean').length;
      const criticalAlerts = processedAlerts.filter(a => a.severity === 'critical').length;
      const warningAlerts = processedAlerts.filter(a => a.severity === 'warning').length;
      
      setStats({
        totalMailboxes,
        activeMailboxes,
        totalDomains,
        totalDailyCapacity,
        totalSent30d,
        avgBounceRate,
        avgReplyRate,
        avgHealthScore,
        warmingUpCount,
        domainsWithFullAuth,
        blacklistedDomains,
        criticalAlerts,
        warningAlerts,
      });
      
      setMailboxes(processedMailboxes);
      setDomains(processedDomains);
      setAlerts(processedAlerts);
      setCampaignBounces(bounceData);
      
    } catch (err) {
      console.error('Error fetching deliverability data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      await supabase
        .from('deliverability_alerts')
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', alertId);
      
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      console.error('Error dismissing alert:', err);
    }
  }, []);

  const markAlertRead = useCallback(async (alertId: string) => {
    try {
      await supabase
        .from('deliverability_alerts')
        .update({ is_read: true })
        .eq('id', alertId);
      
      setAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, isRead: true } : a
      ));
    } catch (err) {
      console.error('Error marking alert read:', err);
    }
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
