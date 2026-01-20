import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface DataQualityMetrics {
  // Contact completeness
  totalContacts: number;
  contactsWithTitles: number;
  contactsWithCompanies: number;
  contactsWithEmail: number;
  contactsWithPhone: number;
  contactCompleteness: number; // 0-100
  
  // Reply classification
  totalReplies: number;
  repliesClassified: number;
  classificationRate: number; // 0-100
  
  // Sync freshness
  lastSyncBySource: Record<string, { lastSync: string; status: string }>;
  staleSources: string[];
  
  // Data issues
  missingDataAlerts: DataAlert[];
  
  // Overall score
  overallScore: number; // 0-100
  scoreBreakdown: ScoreBreakdown;
}

export interface DataAlert {
  id: string;
  type: 'missing' | 'stale' | 'inconsistent' | 'warning';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedCount?: number;
  suggestion?: string;
}

export interface ScoreBreakdown {
  contactCompleteness: number;
  classificationRate: number;
  syncFreshness: number;
  dataConsistency: number;
}

export interface SyncStatus {
  sourceType: string;
  sourceName: string;
  lastSyncAt: string | null;
  status: 'healthy' | 'stale' | 'failed' | 'never';
  recordsProcessed: number | null;
  errorMessage: string | null;
}

export function useDataQuality() {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DataQualityMetrics | null>(null);
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);

  const fetchDataQuality = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    
    setLoading(true);
    
    try {
      // Get engagement IDs for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);
      
      const engagementIds = (engagements || []).map(e => e.id);
      
      if (engagementIds.length === 0) {
        setLoading(false);
        return;
      }
      
      // Fetch contacts for completeness metrics
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, title, company_id, email, phone')
        .in('engagement_id', engagementIds);
      
      const allContacts = contacts || [];
      const totalContacts = allContacts.length;
      const contactsWithTitles = allContacts.filter(c => c.title).length;
      const contactsWithCompanies = allContacts.filter(c => c.company_id).length;
      const contactsWithEmail = allContacts.filter(c => c.email).length;
      const contactsWithPhone = allContacts.filter(c => c.phone).length;
      
      // Calculate contact completeness (average of key fields)
      const contactCompleteness = totalContacts > 0 
        ? ((contactsWithTitles + contactsWithCompanies + contactsWithEmail) / (totalContacts * 3)) * 100 
        : 0;
      
      // Fetch email activities for classification rate
      const { data: activities } = await supabase
        .from('email_activities')
        .select('id, replied, reply_category')
        .in('engagement_id', engagementIds)
        .eq('replied', true);
      
      const repliedActivities = activities || [];
      const totalReplies = repliedActivities.length;
      const repliesClassified = repliedActivities.filter(a => 
        a.reply_category && a.reply_category !== 'unknown'
      ).length;
      const classificationRate = totalReplies > 0 
        ? (repliesClassified / totalReplies) * 100 
        : 100; // 100% if no replies to classify
      
      // Fetch data sources for sync freshness
      const { data: dataSources } = await supabase
        .from('data_sources')
        .select('id, name, source_type, last_sync_at, last_sync_status, last_sync_error, last_sync_records_processed')
        .order('last_sync_at', { ascending: false, nullsFirst: false });
      
      const sources = dataSources || [];
      const now = new Date();
      const staleSources: string[] = [];
      const lastSyncBySource: Record<string, { lastSync: string; status: string }> = {};
      
      const statuses: SyncStatus[] = sources.map(s => {
        const lastSync = s.last_sync_at ? new Date(s.last_sync_at) : null;
        const hoursSinceSync = lastSync 
          ? (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60) 
          : Infinity;
        
        let status: 'healthy' | 'stale' | 'failed' | 'never' = 'never';
        if (s.last_sync_status === 'failed') {
          status = 'failed';
        } else if (lastSync) {
          status = hoursSinceSync > 24 ? 'stale' : 'healthy';
        }
        
        if (status === 'stale' || status === 'failed') {
          staleSources.push(s.name);
        }
        
        lastSyncBySource[s.source_type] = {
          lastSync: s.last_sync_at || 'Never',
          status: s.last_sync_status || 'unknown',
        };
        
        return {
          sourceType: s.source_type,
          sourceName: s.name,
          lastSyncAt: s.last_sync_at,
          status,
          recordsProcessed: s.last_sync_records_processed,
          errorMessage: s.last_sync_error,
        };
      });
      
      setSyncStatuses(statuses);
      
      // Calculate sync freshness score
      const healthySources = statuses.filter(s => s.status === 'healthy').length;
      const totalSources = statuses.length;
      const syncFreshness = totalSources > 0 ? (healthySources / totalSources) * 100 : 100;
      
      // Build alerts
      const alerts: DataAlert[] = [];
      
      if (contactCompleteness < 50) {
        alerts.push({
          id: 'low-contact-completeness',
          type: 'missing',
          severity: 'medium',
          title: 'Low Contact Data Completeness',
          description: `Only ${contactCompleteness.toFixed(0)}% of contacts have complete information (title, company, email).`,
          affectedCount: totalContacts - contactsWithTitles,
          suggestion: 'Consider enriching contact data or improving data collection.',
        });
      }
      
      if (classificationRate < 80 && totalReplies > 10) {
        alerts.push({
          id: 'unclassified-replies',
          type: 'missing',
          severity: 'medium',
          title: 'Unclassified Replies',
          description: `${totalReplies - repliesClassified} replies are not classified, affecting reporting accuracy.`,
          affectedCount: totalReplies - repliesClassified,
          suggestion: 'Run the reply classification function to categorize responses.',
        });
      }
      
      staleSources.forEach(source => {
        alerts.push({
          id: `stale-${source}`,
          type: 'stale',
          severity: 'high',
          title: `Stale Data Source: ${source}`,
          description: `This data source has not synced in over 24 hours.`,
          suggestion: 'Check the connection and trigger a manual sync.',
        });
      });
      
      // Calculate data consistency (check for campaigns with metrics that don't match daily_metrics)
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, total_sent, total_replied, positive_replies')
        .in('engagement_id', engagementIds)
        .gt('total_sent', 0);
      
      let consistencyScore = 100;
      if (campaigns && campaigns.length > 0) {
        // Simple check: campaigns should have positive_replies if they have replies
        const campaignsWithReplies = campaigns.filter(c => (c.total_replied || 0) > 0);
        const campaignsWithPositive = campaignsWithReplies.filter(c => (c.positive_replies || 0) > 0);
        
        if (campaignsWithReplies.length > 0) {
          // If we have replies but no positive classifications, something might be wrong
          const positiveCoverage = campaignsWithPositive.length / campaignsWithReplies.length;
          consistencyScore = positiveCoverage * 100;
          
          if (consistencyScore < 50) {
            alerts.push({
              id: 'missing-positive-classification',
              type: 'inconsistent',
              severity: 'medium',
              title: 'Missing Positive Reply Data',
              description: `${campaignsWithReplies.length - campaignsWithPositive.length} campaigns have replies but no positive reply classification.`,
              suggestion: 'Run the recalculate-metrics function to backfill positive reply counts.',
            });
          }
        }
      }
      
      // Calculate overall score
      const scoreBreakdown: ScoreBreakdown = {
        contactCompleteness: Math.min(100, contactCompleteness),
        classificationRate: Math.min(100, classificationRate),
        syncFreshness: Math.min(100, syncFreshness),
        dataConsistency: Math.min(100, consistencyScore),
      };
      
      const overallScore = (
        scoreBreakdown.contactCompleteness * 0.2 +
        scoreBreakdown.classificationRate * 0.3 +
        scoreBreakdown.syncFreshness * 0.3 +
        scoreBreakdown.dataConsistency * 0.2
      );
      
      setMetrics({
        totalContacts,
        contactsWithTitles,
        contactsWithCompanies,
        contactsWithEmail,
        contactsWithPhone,
        contactCompleteness,
        totalReplies,
        repliesClassified,
        classificationRate,
        lastSyncBySource,
        staleSources,
        missingDataAlerts: alerts,
        overallScore,
        scoreBreakdown,
      });
      
    } catch (error) {
      console.error('Error fetching data quality metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchDataQuality();
  }, [fetchDataQuality]);

  return {
    loading,
    metrics,
    syncStatuses,
    refetch: fetchDataQuality,
  };
}
