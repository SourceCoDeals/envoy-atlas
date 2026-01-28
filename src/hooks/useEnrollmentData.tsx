import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { calculateRate } from '@/lib/metrics';
import { logger } from '@/lib/logger';

interface EnrollmentData {
  not_started: number;
  in_progress: number;
  completed: number;
  blocked: number;
  paused: number;
  total: number;
}

interface StepData {
  step_number: number;
  step_name: string;
  leads_at_step: number;
  sent: number;
  opened: number;
  replied: number;
  dropped_off: number;
}

interface FinishReasonData {
  reason: string;
  count: number;
}

interface ClickData {
  total_clicks: number;
  unique_clicks: number;
  click_to_reply_rate: number;
  top_links: Array<{ url: string; clicks: number; unique_clicks: number; replies_after_click: number }>;
  clicks_by_hour: Array<{ hour: number; clicks: number }>;
}

export function useEnrollmentData() {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData>({
    not_started: 0, in_progress: 0, completed: 0, blocked: 0, paused: 0, total: 0,
  });
  const [stepData, setStepData] = useState<StepData[]>([]);
  const [finishReasons, setFinishReasons] = useState<FinishReasonData[]>([]);
  const [clickData, setClickData] = useState<ClickData>({
    total_clicks: 0, unique_clicks: 0, click_to_reply_rate: 0, top_links: [], clicks_by_hour: [],
  });

  const fetchData = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Get engagement IDs for this client
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);

      if (engagementIds.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch enrollment snapshots - get latest for each campaign
      const { data: snapshots } = await supabase
        .from('enrollment_snapshots')
        .select('*')
        .in('engagement_id', engagementIds)
        .order('date', { ascending: false });

      // Aggregate enrollment data (latest snapshot per campaign)
      const latestByCampaign = new Map<string, typeof snapshots[0]>();
      for (const snap of (snapshots || [])) {
        if (!latestByCampaign.has(snap.campaign_id)) {
          latestByCampaign.set(snap.campaign_id, snap);
        }
      }

      const aggregated = { not_started: 0, in_progress: 0, completed: 0, blocked: 0, paused: 0, total: 0 };
      latestByCampaign.forEach(snap => {
        aggregated.not_started += snap.not_started || 0;
        aggregated.in_progress += snap.in_progress || 0;
        aggregated.completed += snap.completed || 0;
        aggregated.blocked += snap.blocked || 0;
        aggregated.paused += snap.paused || 0;
        aggregated.total += snap.total_leads || 0;
      });
      setEnrollmentData(aggregated);

      // Fetch contact step distribution from contacts table
      const { data: contacts } = await supabase
        .from('contacts')
        .select('current_step, sequence_status, finish_reason, open_count, click_count, reply_count')
        .in('engagement_id', engagementIds);

      if (contacts && contacts.length > 0) {
        // Build step data
        const stepMap = new Map<number, { sent: number; opened: number; replied: number; leads: number }>();
        const reasonMap = new Map<string, number>();

        for (const contact of contacts) {
          const step = contact.current_step || 1;
          const existing = stepMap.get(step) || { sent: 0, opened: 0, replied: 0, leads: 0 };
          stepMap.set(step, {
            sent: existing.sent + 1,
            opened: existing.opened + (contact.open_count > 0 ? 1 : 0),
            replied: existing.replied + (contact.reply_count > 0 ? 1 : 0),
            leads: existing.leads + 1,
          });

          if (contact.finish_reason) {
            reasonMap.set(contact.finish_reason, (reasonMap.get(contact.finish_reason) || 0) + 1);
          }
        }

        const steps: StepData[] = Array.from(stepMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([stepNum, data], idx, arr) => ({
            step_number: stepNum,
            step_name: `Email ${stepNum}`,
            leads_at_step: data.leads,
            sent: data.sent,
            opened: data.opened,
            replied: data.replied,
            dropped_off: idx > 0 ? Math.max(0, arr[idx - 1][1].leads - data.leads) : 0,
          }));
        setStepData(steps);

        const reasons: FinishReasonData[] = Array.from(reasonMap.entries())
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count);
        setFinishReasons(reasons);
      }

      // Fetch click data from email_activities
      const { data: clickActivities } = await supabase
        .from('email_activities')
        .select('click_count, clicked, replied, first_clicked_at')
        .in('engagement_id', engagementIds)
        .gt('click_count', 0);

      if (clickActivities && clickActivities.length > 0) {
        const totalClicks = clickActivities.reduce((sum, a) => sum + (a.click_count || 0), 0);
        const uniqueClicks = clickActivities.length;
        const repliesAfterClick = clickActivities.filter(a => a.replied).length;

        // Build clicks by hour
        const hourBuckets = new Array(24).fill(0);
        for (const activity of clickActivities) {
          if (activity.first_clicked_at) {
            const hour = new Date(activity.first_clicked_at).getHours();
            hourBuckets[hour]++;
          }
        }

        setClickData({
          total_clicks: totalClicks,
          unique_clicks: uniqueClicks,
          click_to_reply_rate: calculateRate(repliesAfterClick, uniqueClicks),
          top_links: [], // Would require link_clicks JSON parsing
          clicks_by_hour: hourBuckets.map((clicks, hour) => ({ hour, clicks })),
        });
      }

    } catch (err) {
      logger.error('Error fetching enrollment data', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    enrollmentData,
    stepData,
    finishReasons,
    clickData,
    refetch: fetchData,
  };
}
