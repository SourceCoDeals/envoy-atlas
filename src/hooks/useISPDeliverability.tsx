import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { calculateRate } from '@/lib/metrics';
import { logger } from '@/lib/logger';

interface ISPData {
  isp_name: string;
  sent_count: number;
  delivered_count: number;
  bounced_count: number;
  opened_count: number;
  replied_count: number;
  delivery_rate: number;
  open_rate: number;
  reply_rate: number;
  bounce_rate: number;
}

export function useISPDeliverability(engagementId?: string, dateRange?: { from: Date; to: Date }) {
  const { currentWorkspace } = useWorkspace();
  const [data, setData] = useState<ISPData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Get engagement IDs
      let engagementIds: string[] = [];
      if (engagementId) {
        engagementIds = [engagementId];
      } else {
        const { data: engagements } = await supabase
          .from('engagements')
          .select('id')
          .eq('client_id', currentWorkspace.id);
        engagementIds = (engagements || []).map(e => e.id);
      }

      if (engagementIds.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('isp_deliverability')
        .select('*')
        .in('engagement_id', engagementIds);

      if (dateRange?.from) {
        query = query.gte('metric_date', dateRange.from.toISOString().split('T')[0]);
      }
      if (dateRange?.to) {
        query = query.lte('metric_date', dateRange.to.toISOString().split('T')[0]);
      }

      const { data: ispData, error } = await query;

      if (error) throw error;

      // Aggregate by ISP
      const aggregated: Record<string, ISPData> = {};
      
      for (const row of (ispData || [])) {
        if (!aggregated[row.isp_name]) {
          aggregated[row.isp_name] = {
            isp_name: row.isp_name,
            sent_count: 0,
            delivered_count: 0,
            bounced_count: 0,
            opened_count: 0,
            replied_count: 0,
            delivery_rate: 0,
            open_rate: 0,
            reply_rate: 0,
            bounce_rate: 0,
          };
        }
        
        aggregated[row.isp_name].sent_count += row.sent_count || 0;
        aggregated[row.isp_name].delivered_count += row.delivered_count || 0;
        aggregated[row.isp_name].bounced_count += row.bounced_count || 0;
        aggregated[row.isp_name].opened_count += row.opened_count || 0;
        aggregated[row.isp_name].replied_count += row.replied_count || 0;
      }

      // Calculate rates
      const result = Object.values(aggregated).map(isp => ({
        ...isp,
        delivery_rate: calculateRate(isp.delivered_count, isp.sent_count),
        open_rate: calculateRate(isp.opened_count, isp.delivered_count),
        reply_rate: calculateRate(isp.replied_count, isp.delivered_count),
        bounce_rate: calculateRate(isp.bounced_count, isp.sent_count),
      }));

      // Sort by volume
      result.sort((a, b) => b.sent_count - a.sent_count);

      setData(result);
    } catch (err) {
      logger.error('Error fetching ISP deliverability', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, engagementId, dateRange?.from, dateRange?.to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refetch: fetchData };
}