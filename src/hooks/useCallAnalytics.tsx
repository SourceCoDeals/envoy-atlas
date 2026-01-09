import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';

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
        const { data: calls, error: callsError } = await supabase
          .from('external_calls')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .not('composite_score', 'is', null);

        if (callsError) throw callsError;

        if (!calls || calls.length === 0) {
          setData(null);
          setIsLoading(false);
          return;
        }

        // Build funnel data
        const totalDials = calls.length;
        const connections = calls.filter(c => (c.seller_interest_score || 0) >= 3).length;
        const qualityConvos = calls.filter(c => (c.composite_score || 0) >= 5).length;
        const meetingsSet = calls.filter(c => (c.seller_interest_score || 0) >= 7).length;

        const funnel: FunnelStage[] = [
          { stage: 'Total Dials', count: totalDials },
          { stage: 'Connections', count: connections },
          { stage: 'Quality Conversations', count: qualityConvos },
          { stage: 'Meetings Set', count: meetingsSet },
        ];

        // Build hourly data
        const hourlyMap = new Map<number, { calls: number; connects: number }>();
        for (let h = 6; h <= 20; h++) {
          hourlyMap.set(h, { calls: 0, connects: 0 });
        }

        calls.forEach(call => {
          if (call.date_time) {
            const date = new Date(call.date_time);
            const hour = date.getHours();
            if (hourlyMap.has(hour)) {
              const current = hourlyMap.get(hour)!;
              current.calls++;
              if ((call.seller_interest_score || 0) >= 3) {
                current.connects++;
              }
            }
          }
        });

        const hourlyData: HourlyData[] = Array.from(hourlyMap.entries())
          .map(([hour, data]) => ({ hour, ...data }))
          .sort((a, b) => a.hour - b.hour);

        // Build team performance
        const repMap = new Map<string, { calls: number; connects: number; totalScore: number }>();
        calls.forEach(call => {
          const rep = call.host_email || 'Unknown';
          if (!repMap.has(rep)) {
            repMap.set(rep, { calls: 0, connects: 0, totalScore: 0 });
          }
          const current = repMap.get(rep)!;
          current.calls++;
          current.totalScore += call.composite_score || 0;
          if ((call.seller_interest_score || 0) >= 3) {
            current.connects++;
          }
        });

        const teamPerformance: RepPerformance[] = Array.from(repMap.entries())
          .map(([email, data]) => ({
            name: email.split('@')[0] || email,
            totalCalls: data.calls,
            connects: data.connects,
            connectRate: data.calls > 0 ? (data.connects / data.calls) * 100 : 0,
            avgScore: data.calls > 0 ? data.totalScore / data.calls : 0,
          }))
          .sort((a, b) => b.totalCalls - a.totalCalls)
          .slice(0, 10);

        // Build weekly trends (last 30 days)
        const dailyMap = new Map<string, { calls: number; connects: number; totalScore: number }>();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        calls.forEach(call => {
          if (call.date_time) {
            const callDate = new Date(call.date_time);
            if (callDate >= thirtyDaysAgo) {
              const dateKey = callDate.toISOString().split('T')[0];
              if (!dailyMap.has(dateKey)) {
                dailyMap.set(dateKey, { calls: 0, connects: 0, totalScore: 0 });
              }
              const current = dailyMap.get(dateKey)!;
              current.calls++;
              current.totalScore += call.composite_score || 0;
              if ((call.seller_interest_score || 0) >= 3) {
                current.connects++;
              }
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
