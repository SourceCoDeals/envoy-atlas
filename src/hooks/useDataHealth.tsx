import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

export type DataHealthStatus = 'healthy' | 'degraded' | 'broken' | 'empty';

export interface DataSourceHealth {
  name: string;
  table: string;
  status: DataHealthStatus;
  rowCount: number;
  hasData: boolean;
  details: string;
  lastUpdated?: string;
}

export interface DataHealthSummary {
  email: {
    smartlead: DataSourceHealth;
    replyio: DataSourceHealth;
  };
  calling: {
    phoneburner: DataSourceHealth;
    coldCalls: DataSourceHealth;
  };
  insights: {
    copyVariants: DataSourceHealth;
    copyLibrary: DataSourceHealth;
    patterns: DataSourceHealth;
  };
  pipeline: {
    leads: DataSourceHealth;
    deals: DataSourceHealth;
    engagements: DataSourceHealth;
  };
  overall: {
    status: DataHealthStatus;
    healthyCount: number;
    totalCount: number;
    percentage: number;
  };
}

export function useDataHealth() {
  const { currentWorkspace } = useWorkspace();
  const [health, setHealth] = useState<DataHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch all counts in parallel
      const [
        smartleadCampaigns,
        replyioCampaigns,
        smartleadMetrics,
        replyioMetrics,
        phoneburnerCalls,
        coldCalls,
        leads,
        deals,
        engagements,
        copyVariants,
        copyLibrary,
        patterns,
      ] = await Promise.all([
        supabase.from('smartlead_campaigns').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
        supabase.from('replyio_campaigns').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
        supabase.from('smartlead_daily_metrics').select('sent_count', { count: 'exact' }).eq('workspace_id', currentWorkspace.id).gt('sent_count', 0).limit(1),
        supabase.from('replyio_daily_metrics').select('sent_count', { count: 'exact' }).eq('workspace_id', currentWorkspace.id).gt('sent_count', 0).limit(1),
        supabase.from('phoneburner_calls').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
        supabase.from('cold_calls').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
        supabase.from('calling_deals').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
        supabase.from('engagements').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
        supabase.from('campaign_variants').select('id', { count: 'exact', head: true }),
        supabase.from('copy_library').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
        supabase.from('copy_patterns').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
      ]);

      const smartleadCount = smartleadCampaigns.count || 0;
      const replyioCount = replyioCampaigns.count || 0;
      const smartleadMetricsCount = smartleadMetrics.count || 0;
      const replyioMetricsCount = replyioMetrics.count || 0;
      const phoneburnerCount = phoneburnerCalls.count || 0;
      const coldCallsCount = coldCalls.count || 0;
      const leadsCount = leads.count || 0;
      const dealsCount = deals.count || 0;
      const engagementsCount = engagements.count || 0;
      const copyVariantsCount = copyVariants.count || 0;
      const copyLibraryCount = copyLibrary.count || 0;
      const patternsCount = patterns.count || 0;

      // Phase A: Fix broken vs degraded classification
      // Reply.io is BROKEN (red) if campaigns exist but NO daily metrics have sent_count > 0
      // Smartlead uses 'degraded' for missing opens (API limitation) but 'healthy' for sent data
      const replyioStatus: DataHealthStatus = replyioCount > 0 
        ? (replyioMetricsCount > 0 ? 'healthy' : 'broken')  // broken if campaigns but no sent metrics
        : 'empty';
      
      const smartleadStatus: DataHealthStatus = smartleadCount > 0 
        ? (smartleadMetricsCount > 0 ? 'healthy' : 'degraded')  // degraded OK for Smartlead (opens missing is known)
        : 'empty';

      const healthData: DataHealthSummary = {
        email: {
          smartlead: {
            name: 'Smartlead',
            table: 'smartlead_campaigns',
            rowCount: smartleadCount,
            hasData: smartleadCount > 0,
            status: smartleadStatus,
            details: smartleadCount > 0 
              ? `${smartleadCount} campaigns${smartleadMetricsCount > 0 ? ', metrics OK' : ', metrics pending'}`
              : 'Not connected',
          },
          replyio: {
            name: 'Reply.io',
            table: 'replyio_campaigns',
            rowCount: replyioCount,
            hasData: replyioCount > 0,
            status: replyioStatus,
            details: replyioCount > 0 
              ? (replyioMetricsCount > 0 ? `${replyioCount} campaigns, metrics OK` : `${replyioCount} campaigns, sent_count=0 — resync required`)
              : 'Not connected',
          },
        },
        calling: {
          phoneburner: {
            name: 'PhoneBurner',
            table: 'phoneburner_calls',
            rowCount: phoneburnerCount,
            hasData: phoneburnerCount > 0,
            status: phoneburnerCount > 0 ? 'healthy' : 'empty',
            details: phoneburnerCount > 0 ? `${phoneburnerCount} calls` : 'Not connected',
          },
          coldCalls: {
            name: 'Cold Calls (NocoDB)',
            table: 'cold_calls',
            rowCount: coldCallsCount,
            hasData: coldCallsCount > 0,
            status: coldCallsCount > 0 ? 'healthy' : 'empty',
            details: coldCallsCount > 0 ? `${coldCallsCount} calls` : 'Not connected',
          },
        },
        insights: {
          copyVariants: {
            name: 'Copy Variants',
            table: 'campaign_variants',
            rowCount: copyVariantsCount,
            hasData: copyVariantsCount > 0,
            status: copyVariantsCount > 0 ? 'healthy' : 'empty',
            details: copyVariantsCount > 0 ? `${copyVariantsCount} variants` : 'No variants synced',
          },
          copyLibrary: {
            name: 'Copy Library',
            table: 'copy_library',
            rowCount: copyLibraryCount,
            hasData: copyLibraryCount > 0,
            status: copyLibraryCount > 0 ? 'healthy' : 'empty',
            details: copyLibraryCount > 0 ? `${copyLibraryCount} saved` : 'Empty library',
          },
          patterns: {
            name: 'Copy Patterns',
            table: 'copy_patterns',
            rowCount: patternsCount,
            hasData: patternsCount > 0,
            status: patternsCount > 0 ? 'healthy' : 'empty',
            details: patternsCount > 0 ? `${patternsCount} patterns` : 'Not computed',
          },
        },
        pipeline: {
          leads: {
            name: 'Leads',
            table: 'leads',
            rowCount: leadsCount,
            hasData: leadsCount > 0,
            status: leadsCount > 0 ? 'healthy' : 'empty',
            details: leadsCount > 0 ? `${leadsCount.toLocaleString()} leads` : 'No leads',
          },
          deals: {
            name: 'Deals',
            table: 'calling_deals',
            rowCount: dealsCount,
            hasData: dealsCount > 0,
            status: dealsCount > 0 ? 'healthy' : 'empty',
            details: dealsCount > 0 ? `${dealsCount} deals` : 'No deals',
          },
          engagements: {
            name: 'Engagements',
            table: 'engagements',
            rowCount: engagementsCount,
            hasData: engagementsCount > 0,
            status: engagementsCount > 0 ? 'healthy' : 'empty',
            details: engagementsCount > 0 ? `${engagementsCount} engagements` : 'No engagements',
          },
        },
        overall: {
          status: 'healthy',
          healthyCount: 0,
          totalCount: 0,
          percentage: 0,
        },
      };

      // Calculate overall health
      const allSources = [
        healthData.email.smartlead,
        healthData.email.replyio,
        healthData.calling.phoneburner,
        healthData.calling.coldCalls,
        healthData.insights.copyVariants,
        healthData.insights.copyLibrary,
        healthData.insights.patterns,
        healthData.pipeline.leads,
        healthData.pipeline.deals,
        healthData.pipeline.engagements,
      ];

      const healthyCount = allSources.filter(s => s.status === 'healthy').length;
      const degradedCount = allSources.filter(s => s.status === 'degraded').length;
      const totalWithData = allSources.filter(s => s.hasData).length;

      healthData.overall = {
        status: healthyCount >= 5 ? 'healthy' : healthyCount >= 2 ? 'degraded' : totalWithData > 0 ? 'broken' : 'empty',
        healthyCount,
        totalCount: allSources.length,
        percentage: Math.round((healthyCount / allSources.length) * 100),
      };

      setHealth(healthData);
      setError(null);
    } catch (err) {
      console.error('Error checking data health:', err);
      setError(err instanceof Error ? err.message : 'Failed to check data health');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return { health, loading, error, refetch: checkHealth };
}
