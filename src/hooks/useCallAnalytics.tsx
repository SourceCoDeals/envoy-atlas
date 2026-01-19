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
        // First get engagements for this client
        const { data: engagements } = await supabase
          .from('engagements')
          .select('id')
          .eq('client_id', currentWorkspace.id);

        if (!engagements || engagements.length === 0) {
          setData(null);
          setIsLoading(false);
          return;
        }

        const engagementIds = engagements.map(e => e.id);

        // Fetch call activities for these engagements
        const { data: calls, error: callsError } = await supabase
          .from('call_activities')
          .select('*')
          .in('engagement_id', engagementIds);

        if (callsError) throw callsError;

        if (!calls || calls.length === 0) {
          setData(null);
          setIsLoading(false);
          return;
        }

        // Build funnel data based on call dispositions
        const totalDials = calls.length;
        const connections = calls.filter(c => 
          c.disposition === 'connected' || 
          c.disposition === 'conversation' ||
          (c.talk_duration && c.talk_duration > 30)
        ).length;
        const qualityConvos = calls.filter(c => 
          c.conversation_outcome === 'interested' ||
          c.conversation_outcome === 'qualified'
        ).length;
        const meetingsSet = calls.filter(c => 
          c.conversation_outcome === 'meeting_booked' ||
          c.callback_scheduled
        ).length;

        const funnel: FunnelStage[] = [
          { stage: 'Total Dials', count: totalDials },
          { stage: 'Connections', count: connections },
          { stage: 'Quality Conversations', count: qualityConvos },
          { stage: 'Meetings Set', count: meetingsSet },
        ];

        // Build hourly data using started_at
        const hourlyMap = new Map<number, { calls: number; connects: number }>();
        for (let h = 6; h <= 20; h++) {
          hourlyMap.set(h, { calls: 0, connects: 0 });
        }

        calls.forEach(call => {
          const dateField = call.started_at || call.created_at;
          if (dateField) {
            const date = new Date(dateField);
            const hour = date.getHours();
            if (hourlyMap.has(hour)) {
              const current = hourlyMap.get(hour)!;
              current.calls++;
              if (call.disposition === 'connected' || call.disposition === 'conversation') {
                current.connects++;
              }
            }
          }
        });

        const hourlyData: HourlyData[] = Array.from(hourlyMap.entries())
          .map(([hour, data]) => ({ hour, ...data }))
          .sort((a, b) => a.hour - b.hour);

        // Build team performance using caller_name
        const repMap = new Map<string, { calls: number; connects: number; totalDuration: number; displayName: string }>();
        calls.forEach(call => {
          const repKey = call.caller_name || 'Unknown';
          const displayName = call.caller_name || 'Unknown';
          
          if (!repMap.has(repKey)) {
            repMap.set(repKey, { calls: 0, connects: 0, totalDuration: 0, displayName });
          }
          const current = repMap.get(repKey)!;
          current.calls++;
          current.totalDuration += call.talk_duration || 0;
          if (call.disposition === 'connected' || call.disposition === 'conversation') {
            current.connects++;
          }
        });

        const teamPerformance: RepPerformance[] = Array.from(repMap.entries())
          .map(([_, data]) => ({
            name: data.displayName,
            totalCalls: data.calls,
            connects: data.connects,
            connectRate: data.calls > 0 ? (data.connects / data.calls) * 100 : 0,
            avgScore: data.calls > 0 ? data.totalDuration / data.calls : 0,
          }))
          .sort((a, b) => b.totalCalls - a.totalCalls)
          .slice(0, 10);

        // Build weekly trends (last 30 days)
        const dailyMap = new Map<string, { calls: number; connects: number; totalDuration: number }>();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        calls.forEach(call => {
          const dateField = call.started_at || call.created_at;
          if (dateField) {
            const callDate = new Date(dateField);
            if (callDate >= thirtyDaysAgo) {
              const dateKey = callDate.toISOString().split('T')[0];
              if (!dailyMap.has(dateKey)) {
                dailyMap.set(dateKey, { calls: 0, connects: 0, totalDuration: 0 });
              }
              const current = dailyMap.get(dateKey)!;
              current.calls++;
              current.totalDuration += call.talk_duration || 0;
              if (call.disposition === 'connected' || call.disposition === 'conversation') {
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
            avgScore: data.calls > 0 ? data.totalDuration / data.calls : 0,
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
