import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { logger } from '@/lib/logger';
export type DateRangeOption = 'today' | 'last_week' | 'last_2_weeks' | 'last_month' | 'all_time';

export const DATE_RANGE_OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last_week', label: 'Last 7 Days' },
  { value: 'last_2_weeks', label: 'Last 14 Days' },
  { value: 'last_month', label: 'Last 30 Days' },
  { value: 'all_time', label: 'All Time' },
];

export interface ExternalCall {
  id: string;
  engagement_id: string;
  call_title: string | null;
  date_time: string | null;
  contact_name: string | null;
  company_name: string | null;
  caller_name: string | null;
  disposition: string | null;
  talk_duration: number | null;
  recording_url: string | null;
  transcription: string | null;
  notes: string | null;
  conversation_outcome: string | null;
  voicemail_left: boolean | null;
}

interface UseExternalCallsOptions {
  requireTranscript?: boolean;
}

const BATCH_SIZE = 1000;

/**
 * Hook to fetch ALL call_activities with proper pagination (overcoming the 1000 row limit).
 * Returns calls, unique analysts, loading state, and a refresh function.
 */
export function useExternalCalls(options: UseExternalCallsOptions = {}) {
  const { currentWorkspace } = useWorkspace();
  const [allCalls, setAllCalls] = useState<ExternalCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllCalls = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setAllCalls([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = engagements?.map(e => e.id) || [];
      if (engagementIds.length === 0) {
        setAllCalls([]);
        setLoading(false);
        return;
      }

      const allData: ExternalCall[] = [];
      let offset = 0;
      let hasMore = true;

      // Fetch in batches to overcome the 1000 row limit
      while (hasMore) {
        let query = supabase
          .from('call_activities')
          .select('id, engagement_id, to_name, to_phone, caller_name, recording_url, transcription, talk_duration, disposition, notes, conversation_outcome, voicemail_left, started_at')
          .in('engagement_id', engagementIds)
          .range(offset, offset + BATCH_SIZE - 1)
          .order('started_at', { ascending: false, nullsFirst: false });

        if (options.requireTranscript) {
          query = query.not('transcription', 'is', null);
        }

        const { data, error: queryError } = await query;

        if (queryError) throw queryError;

        if (data && data.length > 0) {
          const mapped = data.map(c => ({
            id: c.id,
            engagement_id: c.engagement_id,
            call_title: c.to_name || c.to_phone,
            date_time: c.started_at,
            contact_name: c.to_name,
            company_name: null,
            caller_name: c.caller_name,
            disposition: c.disposition,
            talk_duration: c.talk_duration,
            recording_url: c.recording_url,
            transcription: c.transcription,
            notes: c.notes,
            conversation_outcome: c.conversation_outcome,
            voicemail_left: c.voicemail_left,
          }));
          allData.push(...mapped);
          offset += BATCH_SIZE;
          hasMore = data.length === BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }

      setAllCalls(allData);
    } catch (err) {
      logger.error('Error fetching calls', err);
      setError(err instanceof Error ? err.message : 'Failed to load calls');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, options.requireTranscript]);

  useEffect(() => {
    fetchAllCalls();
  }, [fetchAllCalls]);

  // Extract unique analysts from the data
  const analysts = useMemo(() => {
    const uniqueAnalysts = new Set<string>();
    allCalls.forEach(c => {
      if (c.caller_name) {
        uniqueAnalysts.add(c.caller_name);
      }
    });
    return Array.from(uniqueAnalysts).sort();
  }, [allCalls]);

  return { 
    calls: allCalls, 
    analysts, 
    loading, 
    error, 
    refresh: fetchAllCalls,
    totalCount: allCalls.length
  };
}

/**
 * Get the start date for a given date range option
 */
export function getDateRangeStart(range: DateRangeOption): Date | null {
  const now = new Date();
  switch (range) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'last_week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo;
    case 'last_2_weeks':
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      return twoWeeksAgo;
    case 'last_month':
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return monthAgo;
    case 'all_time':
      return null;
  }
}

/**
 * Filter calls by date range and analyst
 */
export function filterCalls(
  calls: ExternalCall[],
  dateRange: DateRangeOption,
  selectedAnalyst: string
): ExternalCall[] {
  const rangeStart = getDateRangeStart(dateRange);

  return calls.filter(call => {
    // Date filter
    if (rangeStart) {
      const callDate = call.date_time ? new Date(call.date_time) : null;
      if (!callDate || callDate < rangeStart) return false;
    }

    // Analyst filter
    if (selectedAnalyst !== 'all') {
      if (call.caller_name !== selectedAnalyst) return false;
    }

    return true;
  });
}

/**
 * Determine if a call is a "connection" based on talk duration
 */
export function isConnection(call: ExternalCall): boolean {
  return (call.talk_duration || 0) > 30;
}

/**
 * Determine if a call resulted in a meeting
 */
export function isMeeting(call: ExternalCall): boolean {
  const outcome = (call.conversation_outcome || '').toLowerCase();
  return outcome.includes('meeting') || outcome.includes('scheduled');
}

/**
 * Determine if a call is a quality conversation
 */
export function isQualityConversation(call: ExternalCall): boolean {
  return (call.talk_duration || 0) > 60;
}

/**
 * Determine if a call was a voicemail
 */
export function isVoicemail(call: ExternalCall): boolean {
  return call.voicemail_left === true;
}
