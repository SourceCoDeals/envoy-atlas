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
    campaigns: DataSourceHealth;
    metrics: DataSourceHealth;
  };
  calling: {
    calls: DataSourceHealth;
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

      // Fetch all counts in parallel using unified tables
      // Fetch counts sequentially to avoid deep type instantiation
      const campaignsResult = await supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id);
      const metricsResult = await supabase.from('campaign_metrics').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id);
      const callsResult = await supabase.from('calls').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id);
      const leadsResult = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id);
      const dealsResult = await supabase.from('calling_deals').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id);
      const engagementsResult = await supabase.from('engagements').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id);
      const variantsResult = await supabase.from('campaign_variants').select('id', { count: 'exact', head: true });
      const libraryResult = await supabase.from('copy_library').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id);
      const patternsResult = await supabase.from('copy_patterns').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id);

      const campaignsCount = campaignsResult.count || 0;
      const metricsCount = metricsResult.count || 0;
      const callsCount = callsResult.count || 0;
      const leadsCount = leadsResult.count || 0;
      const dealsCount = dealsResult.count || 0;
      const engagementsCount = engagementsResult.count || 0;
      const copyVariantsCount = variantsResult.count || 0;
      const copyLibraryCount = libraryResult.count || 0;
      const patternsCount = patternsResult.count || 0;

      // Determine campaign status
      const campaignsStatus: DataHealthStatus = campaignsCount > 0 ? 'healthy' : 'empty';
      
      // Metrics are healthy if we have sent_count > 0, broken if campaigns exist but no metrics
      const metricsStatus: DataHealthStatus = campaignsCount > 0
        ? (metricsCount > 0 ? 'healthy' : 'broken')
        : 'empty';

      const healthData: DataHealthSummary = {
        email: {
          campaigns: {
            name: 'Campaigns',
            table: 'campaigns',
            rowCount: campaignsCount,
            hasData: campaignsCount > 0,
            status: campaignsStatus,
            details: campaignsCount > 0 ? `${campaignsCount} campaigns` : 'Not connected',
          },
          metrics: {
            name: 'Campaign Metrics',
            table: 'campaign_metrics',
            rowCount: metricsCount,
            hasData: metricsCount > 0,
            status: metricsStatus,
            details: metricsCount > 0 
              ? `Metrics OK (${metricsCount} days with sends)`
              : (campaignsCount > 0 ? 'No metrics data — resync required' : 'No campaigns'),
          },
        },
        calling: {
          calls: {
            name: 'Calls',
            table: 'calls',
            rowCount: callsCount,
            hasData: callsCount > 0,
            status: callsCount > 0 ? 'healthy' : 'empty',
            details: callsCount > 0 ? `${callsCount} calls` : 'Not connected',
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
        healthData.email.campaigns,
        healthData.email.metrics,
        healthData.calling.calls,
        healthData.insights.copyVariants,
        healthData.insights.copyLibrary,
        healthData.insights.patterns,
        healthData.pipeline.leads,
        healthData.pipeline.deals,
        healthData.pipeline.engagements,
      ];

      const healthyCount = allSources.filter(s => s.status === 'healthy').length;
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
