import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { format, subDays, startOfDay } from 'date-fns';
import { toEasternHour, BUSINESS_HOURS_ARRAY, isBusinessHour } from '@/lib/timezone';

interface FunnelStage {
  stage: string;
  count: number;
}

interface HourlyData {
  hour: number;
  calls: number;
  connects: number;
}

interface RepPerformance {
  name: string;
  totalCalls: number;
  connects: number;
  connectRate: number;
  avgScore: number;
}

interface DailyTrend {
  date: string;
  calls: number;
  connects: number;
  avgScore: number;
}

interface CallAnalyticsData {
  funnel: FunnelStage[];
  hourlyData: HourlyData[];
  teamPerformance: RepPerformance[];
  weeklyTrends: DailyTrend[];
  totalCalls: number;
  totalConnects: number;
  avgConnectRate: number;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

export function useCallAnalytics() {
  const { currentWorkspace } = useWorkspace();
  const [data, setData] = useState<CallAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const fetchAnalytics = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Paginated fetch from cold_calls
        let allCalls: any[] = [];
        let page = 0;
        let hasMore = true;

        // Date filter: last 30 days
        const thirtyDaysAgo = format(startOfDay(subDays(new Date(), 30)), 'yyyy-MM-dd');

        while (hasMore && page < MAX_PAGES) {
          const { data: pageData, error: fetchError } = await supabase
            .from('cold_calls')
            .select('*')
            .eq('client_id', currentWorkspace.id)
            .gte('called_date', thirtyDaysAgo)
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
            .order('called_date', { ascending: false });

          if (fetchError) throw fetchError;

          if (pageData && pageData.length > 0) {
            allCalls = [...allCalls, ...pageData];
            hasMore = pageData.length === PAGE_SIZE;
            page++;
          } else {
            hasMore = false;
          }
        }

        if (!allCalls.length) {
          setData(null);
          setIsLoading(false);
          return;
        }

        // Build funnel data based on pre-computed flags
        const totalDials = allCalls.length;
        const connections = allCalls.filter(c => c.is_connection).length;
        const qualityConvos = allCalls.filter(c => 
          c.interest === 'yes' || c.interest === 'maybe'
        ).length;
        const meetingsSet = allCalls.filter(c => c.is_meeting).length;

        const funnel: FunnelStage[] = [
          { stage: 'Total Dials', count: totalDials },
          { stage: 'Connections', count: connections },
          { stage: 'Quality Conversations', count: qualityConvos },
          { stage: 'Meetings Set', count: meetingsSet },
        ];

        // Build hourly data - business hours only (8 AM - 7 PM ET)
        const hourlyMap = new Map<number, { calls: number; connects: number }>();
        BUSINESS_HOURS_ARRAY.forEach(h => {
          hourlyMap.set(h, { calls: 0, connects: 0 });
        });

        allCalls.forEach(call => {
          if (call.called_date_time) {
            // Use DST-aware Eastern Time conversion
            const dt = new Date(call.called_date_time);
            const hour = toEasternHour(dt);
            
            // Only track business hours
            if (isBusinessHour(hour) && hourlyMap.has(hour)) {
              const current = hourlyMap.get(hour)!;
              current.calls++;
              if (call.is_connection) {
                current.connects++;
              }
            }
          }
        });

        const hourlyData: HourlyData[] = BUSINESS_HOURS_ARRAY.map(hour => {
          const data = hourlyMap.get(hour) || { calls: 0, connects: 0 };
          return { hour, ...data };
        });

        // Build team performance using analyst field
        const repMap = new Map<string, { calls: number; connects: number; totalScore: number; displayName: string }>();
        allCalls.forEach(call => {
          const repKey = call.analyst || 'Unknown';
          const displayName = call.analyst || 'Unknown';
          
          if (!repMap.has(repKey)) {
            repMap.set(repKey, { calls: 0, connects: 0, totalScore: 0, displayName });
          }
          const current = repMap.get(repKey)!;
          current.calls++;
          current.totalScore += call.composite_score || 0;
          if (call.is_connection) {
            current.connects++;
          }
        });

        const teamPerformance: RepPerformance[] = Array.from(repMap.entries())
          .map(([_, data]) => ({
            name: data.displayName,
            totalCalls: data.calls,
            connects: data.connects,
            connectRate: data.calls > 0 ? (data.connects / data.calls) * 100 : 0,
            avgScore: data.calls > 0 ? data.totalScore / data.calls : 0,
          }))
          .sort((a, b) => b.totalCalls - a.totalCalls)
          .slice(0, 10);

        // Build daily trends using called_date
        const dailyMap = new Map<string, { calls: number; connects: number; totalScore: number }>();

        allCalls.forEach(call => {
          if (call.called_date) {
            const dateKey = call.called_date;
            if (!dailyMap.has(dateKey)) {
              dailyMap.set(dateKey, { calls: 0, connects: 0, totalScore: 0 });
            }
            const current = dailyMap.get(dateKey)!;
            current.calls++;
            current.totalScore += call.composite_score || 0;
            if (call.is_connection) {
              current.connects++;
            }
          }
        });

        const weeklyTrends: DailyTrend[] = Array.from(dailyMap.entries())
          .map(([date, data]) => ({
            date,
            calls: data.calls,
            connects: data.connects,
            avgScore: data.calls > 0 ? data.totalScore / data.calls : 0,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const totalConnects = connections;
        const avgConnectRate = totalDials > 0 ? (totalConnects / totalDials) * 100 : 0;

        setData({
          funnel,
          hourlyData,
          teamPerformance,
          weeklyTrends,
          totalCalls: totalDials,
          totalConnects,
          avgConnectRate,
        });
      } catch (err) {
        console.error('Error fetching call analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [currentWorkspace?.id]);

  return { data, isLoading, error };
}