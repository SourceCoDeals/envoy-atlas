import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

export interface Alert {
  id: string;
  type: 'bounce_spike' | 'stalled' | 'reply_drop' | 'deliverability' | 'opportunity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  campaign_id: string | null;
  campaign_name: string | null;
  message: string;
  details: Record<string, unknown> | null;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export function useAlerts() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['alerts', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // Get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      if (!engagements || engagements.length === 0) return [];

      const engagementIds = engagements.map(e => e.id);

      // Get alerts for campaigns in these engagements
      const { data: alertsData, error: alertsError } = await supabase
        .from('campaign_alerts')
        .select(`
          id,
          type,
          severity,
          campaign_id,
          message,
          details,
          is_resolved,
          resolved_at,
          created_at,
          campaigns!inner(name, engagement_id)
        `)
        .in('campaigns.engagement_id', engagementIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (alertsError) {
        console.error('Error fetching alerts:', alertsError);
        return [];
      }

      return (alertsData || []).map((alert: any) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        campaign_id: alert.campaign_id,
        campaign_name: alert.campaigns?.name || null,
        message: alert.message,
        details: alert.details,
        is_resolved: alert.is_resolved,
        resolved_at: alert.resolved_at,
        created_at: alert.created_at,
      })) as Alert[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 60000, // 1 minute
  });

  const resolveAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('campaign_alerts')
        .update({ 
          is_resolved: true, 
          resolved_at: new Date().toISOString() 
        })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', currentWorkspace?.id] });
      toast.success('Alert resolved');
    },
    onError: (error) => {
      console.error('Error resolving alert:', error);
      toast.error('Failed to resolve alert');
    },
  });

  const unresolvedAlerts = alerts.filter(a => !a.is_resolved);
  const resolvedAlerts = alerts.filter(a => a.is_resolved);

  const criticalCount = unresolvedAlerts.filter(a => a.severity === 'critical').length;
  const highCount = unresolvedAlerts.filter(a => a.severity === 'high').length;

  return {
    alerts,
    unresolvedAlerts,
    resolvedAlerts,
    criticalCount,
    highCount,
    totalUnresolved: unresolvedAlerts.length,
    isLoading,
    error,
    refetch,
    resolveAlert: resolveAlert.mutate,
    isResolving: resolveAlert.isPending,
  };
}
