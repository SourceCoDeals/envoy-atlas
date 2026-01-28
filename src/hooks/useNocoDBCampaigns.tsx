import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateRate } from '@/lib/metrics';
import { logger } from '@/lib/logger';
export interface NocoDBCampaign {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  platform: 'smartlead' | 'replyio';
  createdDate: string | null;
  
  // Core metrics
  sent: number;
  delivered: number;
  bounced: number;
  replied: number;
  positiveReplies: number;
  
  // Calculated rates
  replyRate: number;
  bounceRate: number;
  positiveRate: number;
  deliveryRate: number;
  
  // Enrollment/lead metrics
  totalLeads: number;
  leadsActive: number;
  leadsCompleted: number;
  leadsInterested: number;
  leadsPaused: number;
  
  // Other
  optouts: number;
  ooos: number;
  stepsCount: number;
  
  // Sequence copy
  steps: Array<{
    stepNumber: number;
    subject: string | null;
    body: string | null;
  }>;
}

export interface NocoDBCampaignStats {
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  totalReplied: number;
  totalPositive: number;
  totalLeads: number;
  totalOptouts: number;
  
  replyRate: number;
  bounceRate: number;
  positiveRate: number;
  deliveryRate: number;
  
  smartleadCount: number;
  replyioCount: number;
  activeCampaigns: number;
}

// Use centralized calculateRate from @/lib/metrics

export function useNocoDBCampaigns() {
  const [campaigns, setCampaigns] = useState<NocoDBCampaign[]>([]);
  const [stats, setStats] = useState<NocoDBCampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch both SmartLead and Reply.io campaigns in parallel
      const [smartleadRes, replyioRes] = await Promise.all([
        supabase
          .from('nocodb_smartlead_campaigns')
          .select('*')
          .order('total_emails_sent', { ascending: false }),
        supabase
          .from('nocodb_replyio_campaigns')
          .select('*')
          .order('deliveries', { ascending: false }),
      ]);

      if (smartleadRes.error) throw smartleadRes.error;
      if (replyioRes.error) throw replyioRes.error;

      const smartleadCampaigns = (smartleadRes.data || []).map((row): NocoDBCampaign => {
        const sent = row.total_emails_sent || 0;
        const replied = row.total_replies || 0;
        // Use the new total_bounces column from NocoDB
        const bounced = row.total_bounces || 0;
        const delivered = Math.max(0, sent - bounced);
        const positive = row.leads_interested || 0;

        return {
          id: row.id,
          campaignId: row.campaign_id,
          name: row.campaign_name,
          status: row.status || 'unknown',
          platform: 'smartlead',
          createdDate: row.campaign_created_date,
          
          sent,
          delivered,
          bounced,
          replied,
          positiveReplies: positive,
          
          replyRate: calculateRate(replied, delivered > 0 ? delivered : sent),
          bounceRate: calculateRate(bounced, sent),
          positiveRate: calculateRate(positive, delivered > 0 ? delivered : sent),
          deliveryRate: calculateRate(delivered, sent),
          
          totalLeads: row.total_leads || 0,
          leadsActive: row.leads_in_progress || 0,
          leadsCompleted: row.leads_completed || 0,
          leadsInterested: row.leads_interested || 0,
          leadsPaused: row.leads_paused || 0,
          
          optouts: 0,
          ooos: 0,
          stepsCount: row.steps_count || 0,
          
          steps: buildSteps(row, 9),
        };
      });

      const replyioCampaigns = (replyioRes.data || []).map((row): NocoDBCampaign => {
        const delivered = row.deliveries || 0;
        const bounced = row.bounces || 0;
        const sent = delivered + bounced; // Total sent = delivered + bounced
        const replied = row.replies || 0;
        // Reply.io doesn't have "positive" flag - use replies for now
        const positive = 0;

        return {
          id: row.id,
          campaignId: row.campaign_id,
          name: row.campaign_name,
          status: row.status || 'unknown',
          platform: 'replyio',
          createdDate: row.campaign_created_date,
          
          sent,
          delivered,
          bounced,
          replied,
          positiveReplies: positive,
          
          replyRate: calculateRate(replied, delivered),
          bounceRate: calculateRate(bounced, sent),
          positiveRate: calculateRate(positive, delivered),
          deliveryRate: calculateRate(delivered, sent),
          
          totalLeads: row.people_count || 0,
          leadsActive: row.people_active || 0,
          leadsCompleted: row.people_finished || 0,
          leadsInterested: 0,
          leadsPaused: row.people_paused || 0,
          
          optouts: row.optouts || 0,
          ooos: row.ooos || 0,
          stepsCount: countSteps(row),
          
          steps: buildSteps(row, 9),
        };
      });

      const allCampaigns = [...smartleadCampaigns, ...replyioCampaigns];
      
      // Sort by sent volume
      allCampaigns.sort((a, b) => b.sent - a.sent);
      
      setCampaigns(allCampaigns);

      // Calculate aggregate stats
      const aggregateStats = allCampaigns.reduce(
        (acc, c) => ({
          totalSent: acc.totalSent + c.sent,
          totalDelivered: acc.totalDelivered + c.delivered,
          totalBounced: acc.totalBounced + c.bounced,
          totalReplied: acc.totalReplied + c.replied,
          totalPositive: acc.totalPositive + c.positiveReplies,
          totalLeads: acc.totalLeads + c.totalLeads,
          totalOptouts: acc.totalOptouts + c.optouts,
          smartleadCount: acc.smartleadCount + (c.platform === 'smartlead' ? 1 : 0),
          replyioCount: acc.replyioCount + (c.platform === 'replyio' ? 1 : 0),
          activeCampaigns: acc.activeCampaigns + 
            (['active', 'started', 'running'].includes(c.status.toLowerCase()) ? 1 : 0),
        }),
        {
          totalSent: 0,
          totalDelivered: 0,
          totalBounced: 0,
          totalReplied: 0,
          totalPositive: 0,
          totalLeads: 0,
          totalOptouts: 0,
          smartleadCount: 0,
          replyioCount: 0,
          activeCampaigns: 0,
        }
      );

      const delivered = aggregateStats.totalDelivered || (aggregateStats.totalSent - aggregateStats.totalBounced);
      
      setStats({
        ...aggregateStats,
        replyRate: calculateRate(aggregateStats.totalReplied, delivered),
        bounceRate: calculateRate(aggregateStats.totalBounced, aggregateStats.totalSent),
        positiveRate: calculateRate(aggregateStats.totalPositive, delivered),
        deliveryRate: calculateRate(delivered, aggregateStats.totalSent),
      });
    } catch (err) {
      logger.error('Error fetching NocoDB campaigns', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  return { campaigns, stats, loading, error, refetch: fetchCampaigns };
}

// Helper to build steps array from row
function buildSteps(row: any, maxSteps: number) {
  const steps: Array<{ stepNumber: number; subject: string | null; body: string | null }> = [];
  for (let i = 1; i <= maxSteps; i++) {
    const subject = row[`step${i}_subject`];
    const body = row[`step${i}_body`];
    if (subject || body) {
      steps.push({ stepNumber: i, subject, body });
    }
  }
  return steps;
}

// Helper to count non-empty steps
function countSteps(row: any): number {
  let count = 0;
  for (let i = 1; i <= 9; i++) {
    if (row[`step${i}_subject`] || row[`step${i}_body`]) {
      count++;
    }
  }
  return count;
}
