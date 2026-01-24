import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { 
  formatCallDuration,
  calculateRate,
  type CallingMetrics,
  type RepPerformance,
} from '@/lib/metrics';
import { startOfDay, subDays, format } from 'date-fns';

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
      badData: 0,
      totalTalkTimeSeconds: 0,
      connectRate: 0,
      conversationRate: 0,
      dmConversationRate: 0,
      meetingRate: 0,
      voicemailRate: 0,
      badDataRate: 0,
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

const safeRate = (numerator: number, denominator: number): number => {
  return calculateRate(numerator, denominator);
};

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

export function useCallingAnalytics(dateRange: DateRange = '30d') {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['calling-analytics', currentWorkspace?.id, dateRange],
    queryFn: async (): Promise<CallingAnalyticsData> => {
      if (!currentWorkspace?.id) {
        throw new Error('No workspace selected');
      }

      // Calculate date filter
      let dateFilterStr: string | null = null;
      if (dateRange !== 'all') {
        const daysMap: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
        const startDate = startOfDay(subDays(new Date(), daysMap[dateRange]));
        dateFilterStr = format(startDate, 'yyyy-MM-dd');
      }

      // Paginated fetch from cold_calls
      let allCalls: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore && page < MAX_PAGES) {
        let query = supabase
          .from('cold_calls')
          .select('*')
          .eq('client_id', currentWorkspace.id)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
          .order('called_date', { ascending: false });

        if (dateFilterStr) {
          query = query.gte('called_date', dateFilterStr);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allCalls = [...allCalls, ...data];
          hasMore = data.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      if (!allCalls.length) return emptyData();

      // Calculate metrics using pre-computed flags
      const totalCalls = allCalls.length;
      const connections = allCalls.filter(c => c.is_connection).length;
      const conversations = connections;
      const dmConversations = allCalls.filter(c => 
        c.is_connection && (c.interest === 'yes' || c.interest === 'maybe')
      ).length;
      const meetings = allCalls.filter(c => c.is_meeting).length;
      const voicemails = allCalls.filter(c => c.is_voicemail).length;
      const badData = allCalls.filter(c => c.is_bad_data).length;
      const totalTalkTimeSeconds = allCalls.reduce((sum, c) => sum + (c.call_duration_sec || 0), 0);

      const metrics: CallingMetrics = {
        totalCalls,
        connections,
        conversations,
        dmConversations,
        meetings,
        voicemails,
        badData,
        totalTalkTimeSeconds,
        connectRate: safeRate(connections, totalCalls),
        conversationRate: safeRate(conversations, totalCalls),
        dmConversationRate: safeRate(dmConversations, connections),
        meetingRate: safeRate(meetings, totalCalls),
        voicemailRate: safeRate(voicemails, totalCalls),
        badDataRate: safeRate(badData, totalCalls),
        meetingConversion: safeRate(meetings, conversations),
        avgCallDuration: totalCalls > 0 ? totalTalkTimeSeconds / totalCalls : 0,
      };

      // Rep performance using analyst field
      const repMap = new Map<string, any[]>();
      allCalls.forEach(call => {
        const rep = call.analyst || 'Unknown';
        if (!repMap.has(rep)) repMap.set(rep, []);
        repMap.get(rep)!.push(call);
      });

      const repPerformance: RepPerformance[] = Array.from(repMap.entries())
        .map(([name, repCalls]) => {
          const repConnections = repCalls.filter((c: any) => c.is_connection).length;
          const repMeetings = repCalls.filter((c: any) => c.is_meeting).length;
          const repTotalTime = repCalls.reduce((sum: number, c: any) => sum + (c.call_duration_sec || 0), 0);

          return {
            name,
            totalCalls: repCalls.length,
            connections: repConnections,
            meetings: repMeetings,
            connectRate: safeRate(repConnections, repCalls.length),
            meetingRate: safeRate(repMeetings, repCalls.length),
            totalTalkTimeSeconds: repTotalTime,
            avgCallDuration: repCalls.length > 0 ? repTotalTime / repCalls.length : 0,
          };
        })
        .sort((a, b) => b.totalCalls - a.totalCalls);

      const topPerformers = repPerformance.slice(0, 5);

      // Build hourly data
      const hourlyMap = new Map<number, { calls: number; connections: number }>();
      for (let h = 6; h <= 20; h++) {
        hourlyMap.set(h, { calls: 0, connections: 0 });
      }

      allCalls.forEach(call => {
        if (call.called_date_time) {
          const hour = new Date(call.called_date_time).getHours();
          if (hourlyMap.has(hour)) {
            const current = hourlyMap.get(hour)!;
            current.calls++;
            if (call.is_connection) {
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
          connectRate: safeRate(data.connections, data.calls),
        }));

      // Build daily trends
      const dailyMap = new Map<string, { calls: number; connections: number; meetings: number }>();
      
      allCalls.forEach(call => {
        if (call.called_date) {
          const dateKey = call.called_date;
          if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, { calls: 0, connections: 0, meetings: 0 });
          }
          const current = dailyMap.get(dateKey)!;
          current.calls++;
          if (call.is_connection) {
            current.connections++;
          }
          if (call.is_meeting) {
            current.meetings++;
          }
        }
      });

      const dailyTrends: DailyTrend[] = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          dateLabel: format(new Date(date), 'MMM d'),
          calls: data.calls,
          connections: data.connections,
          meetings: data.meetings,
          connectRate: safeRate(data.connections, data.calls),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Build funnel
      const funnel: FunnelStage[] = [
        { stage: 'Total Dials', count: metrics.totalCalls, rate: 100 },
        { stage: 'Connections', count: metrics.connections, rate: metrics.connectRate },
        { stage: 'Conversations', count: metrics.conversations, rate: metrics.conversationRate },
        { stage: 'DM Conversations', count: metrics.dmConversations, rate: safeRate(metrics.dmConversations, metrics.totalCalls) },
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

export { formatCallDuration };