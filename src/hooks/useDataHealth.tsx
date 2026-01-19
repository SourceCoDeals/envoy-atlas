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
    contacts: DataSourceHealth;
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

      // Get engagements for this client first
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);
      const engagementsCount = engagementIds.length;

      // Fetch counts for tables that use engagement_id
      let campaignsCount = 0;
      let metricsCount = 0;
      let callsCount = 0;
      let contactsCount = 0;
      let dealsCount = 0;
      let copyVariantsCount = 0;
      let copyLibraryCount = 0;
      let patternsCount = 0;

      if (engagementIds.length > 0) {
        const [
          campaignsResult,
          metricsResult,
          callsResult,
          contactsResult,
          dealsResult,
          variantsResult,
          libraryResult,
          patternsResult,
        ] = await Promise.all([
          supabase.from('campaigns').select('id', { count: 'exact', head: true }).in('engagement_id', engagementIds),
          supabase.from('daily_metrics').select('id', { count: 'exact', head: true }).in('engagement_id', engagementIds),
          supabase.from('call_activities').select('id', { count: 'exact', head: true }).in('engagement_id', engagementIds),
          supabase.from('contacts').select('id', { count: 'exact', head: true }).in('engagement_id', engagementIds),
          supabase.from('deals').select('id', { count: 'exact', head: true }).in('engagement_id', engagementIds),
          supabase.from('campaign_variants').select('id, campaign_id', { count: 'exact', head: true }),
          supabase.from('copy_library').select('id', { count: 'exact', head: true }).in('engagement_id', engagementIds),
          supabase.from('copy_patterns').select('id', { count: 'exact', head: true }).in('engagement_id', engagementIds),
        ]);

        campaignsCount = campaignsResult.count || 0;
        metricsCount = metricsResult.count || 0;
        callsCount = callsResult.count || 0;
        contactsCount = contactsResult.count || 0;
        dealsCount = dealsResult.count || 0;
        copyVariantsCount = variantsResult.count || 0;
        copyLibraryCount = libraryResult.count || 0;
        patternsCount = patternsResult.count || 0;
      }

      // Determine campaign status
      const campaignsStatus: DataHealthStatus = campaignsCount > 0 ? 'healthy' : 'empty';
      
      // Metrics are healthy if we have data, broken if campaigns exist but no metrics
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
            name: 'Daily Metrics',
            table: 'daily_metrics',
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
            table: 'call_activities',
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
          contacts: {
            name: 'Contacts',
            table: 'contacts',
            rowCount: contactsCount,
            hasData: contactsCount > 0,
            status: contactsCount > 0 ? 'healthy' : 'empty',
            details: contactsCount > 0 ? `${contactsCount.toLocaleString()} contacts` : 'No contacts',
          },
          deals: {
            name: 'Deals',
            table: 'deals',
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
        healthData.pipeline.contacts,
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
