import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { 
  aggregateCallingMetrics, 
  aggregateCallingByRep,
  formatCallDuration,
  type CallingMetrics,
  type RepPerformance,
} from '@/lib/metrics';
import { startOfDay, subDays, parseISO, getHours, format } from 'date-fns';

export type DateRange = '7d' | '14d' | '30d' | '90d' | 'all';

interface HourlyData {
  hour: number;
  hourLabel: string;
  calls: number;
  connections: number;
  connectRate: number;
}

interface DailyTrend {
  date: string;
  dateLabel: string;
  calls: number;
  connections: number;
  meetings: number;
  connectRate: number;
}

interface FunnelStage {
  stage: string;
  count: number;
  rate: number;
}

export interface CallingAnalyticsData {
  metrics: CallingMetrics;
  repPerformance: RepPerformance[];
  hourlyData: HourlyData[];
  dailyTrends: DailyTrend[];
  funnel: FunnelStage[];
  topPerformers: RepPerformance[];
  isLoading: boolean;
  error: string | null;
}

function emptyData(): CallingAnalyticsData {
  return {
    metrics: {
      totalCalls: 0,
      connections: 0,
      conversations: 0,
      dmConversations: 0,
      meetings: 0,
      voicemails: 0,
      totalTalkTimeSeconds: 0,
      connectRate: 0,
      conversationRate: 0,
      meetingRate: 0,
      voicemailRate: 0,
      meetingConversion: 0,
      avgCallDuration: 0,
    },
    repPerformance: [],
    hourlyData: [],
    dailyTrends: [],
    funnel: [],
    topPerformers: [],
    isLoading: false,
    error: null,
  };
}

export function useCallingAnalytics(dateRange: DateRange = '30d') {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['calling-analytics', currentWorkspace?.id, dateRange],
    queryFn: async (): Promise<CallingAnalyticsData> => {
      if (!currentWorkspace?.id) {
        throw new Error('No workspace selected');
      }

      // Get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      if (!engagements?.length) {
        return emptyData();
      }

      const engagementIds = engagements.map(e => e.id);

      // Calculate date filter
      let dateFilter: Date | null = null;
      if (dateRange !== 'all') {
        const daysMap: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
        dateFilter = startOfDay(subDays(new Date(), daysMap[dateRange]));
      }

      // Fetch call activities
      let query = supabase
        .from('call_activities')
        .select('*')
        .in('engagement_id', engagementIds);

      if (dateFilter) {
        query = query.gte('started_at', dateFilter.toISOString());
      }

      const { data: calls, error } = await query;

      if (error) throw error;
      if (!calls?.length) return emptyData();

      // Calculate all metrics using UNIFIED LIBRARY
      const metrics = aggregateCallingMetrics(calls);
      const repPerformance = aggregateCallingByRep(calls);
      const topPerformers = repPerformance.slice(0, 5);

      // Build hourly data
      const hourlyMap = new Map<number, { calls: number; connections: number }>();
      for (let h = 6; h <= 20; h++) {
        hourlyMap.set(h, { calls: 0, connections: 0 });
      }

      calls.forEach(call => {
        if (call.started_at) {
          const hour = getHours(parseISO(call.started_at));
          if (hourlyMap.has(hour)) {
            const current = hourlyMap.get(hour)!;
            current.calls++;
            if (call.disposition === 'connected' || (call.talk_duration && call.talk_duration > 30)) {
              current.connections++;
            }
          }
        }
      });

      const hourlyData: HourlyData[] = Array.from(hourlyMap.entries())
        .map(([hour, data]) => ({
          hour,
          hourLabel: `${hour}:00`,
          calls: data.calls,
          connections: data.connections,
          connectRate: data.calls > 0 ? (data.connections / data.calls) * 100 : 0,
        }));

      // Build daily trends
      const dailyMap = new Map<string, { calls: number; connections: number; meetings: number }>();
      
      calls.forEach(call => {
        if (call.started_at) {
          const dateKey = format(parseISO(call.started_at), 'yyyy-MM-dd');
          if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, { calls: 0, connections: 0, meetings: 0 });
          }
          const current = dailyMap.get(dateKey)!;
          current.calls++;
          if (call.disposition === 'connected' || (call.talk_duration && call.talk_duration > 30)) {
            current.connections++;
          }
          if (call.conversation_outcome === 'meeting_booked' || call.callback_scheduled) {
            current.meetings++;
          }
        }
      });

      const dailyTrends: DailyTrend[] = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          dateLabel: format(parseISO(date), 'MMM d'),
          calls: data.calls,
          connections: data.connections,
          meetings: data.meetings,
          connectRate: data.calls > 0 ? (data.connections / data.calls) * 100 : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Build funnel
      const funnel: FunnelStage[] = [
        { stage: 'Total Dials', count: metrics.totalCalls, rate: 100 },
        { stage: 'Connections', count: metrics.connections, rate: metrics.connectRate },
        { stage: 'Conversations', count: metrics.conversations, rate: metrics.conversationRate },
        { 
          stage: 'DM Conversations', 
          count: metrics.dmConversations, 
          rate: metrics.totalCalls > 0 ? (metrics.dmConversations / metrics.totalCalls) * 100 : 0 
        },
        { stage: 'Meetings Set', count: metrics.meetings, rate: metrics.meetingRate },
      ];

      return {
        metrics,
        repPerformance,
        hourlyData,
        dailyTrends,
        funnel,
        topPerformers,
        isLoading: false,
        error: null,
      };
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000,
  });
}

// Re-export formatCallDuration for convenience
export { formatCallDuration };
