import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateRate } from '@/lib/metrics';

export interface CallObjection {
  id: string;
  call_id: string;
  engagement_id: string;
  objection_type: string;
  objection_text: string;
  timestamp_in_call: number | null;
  resolution_attempted: string | null;
  was_resolved: boolean;
  extracted_by: string;
  confidence: number;
  created_at: string;
}

export interface ObjectionSummary {
  type: string;
  count: number;
  resolved: number;
  resolutionRate: number;
  percentage: number;
}

export interface ObjectionAnalytics {
  totalObjections: number;
  totalResolved: number;
  overallResolutionRate: number;
  byType: ObjectionSummary[];
  recentObjections: CallObjection[];
}

/**
 * Hook to fetch objection analytics for an engagement
 */
export function useCallObjections(engagementId?: string, dateRange?: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ['call-objections', engagementId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<ObjectionAnalytics> => {
      if (!engagementId) {
        return {
          totalObjections: 0,
          totalResolved: 0,
          overallResolutionRate: 0,
          byType: [],
          recentObjections: [],
        };
      }

      let query = supabase
        .from('call_objections')
        .select('*')
        .eq('engagement_id', engagementId)
        .order('created_at', { ascending: false });

      if (dateRange?.start) {
        query = query.gte('created_at', dateRange.start.toISOString());
      }
      if (dateRange?.end) {
        query = query.lte('created_at', dateRange.end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const objections = (data || []) as CallObjection[];
      const totalObjections = objections.length;
      const totalResolved = objections.filter(o => o.was_resolved).length;
      const overallResolutionRate = calculateRate(totalResolved, totalObjections);

      // Group by type
      const byTypeMap = new Map<string, { count: number; resolved: number }>();
      objections.forEach(obj => {
        const type = obj.objection_type || 'other';
        if (!byTypeMap.has(type)) {
          byTypeMap.set(type, { count: 0, resolved: 0 });
        }
        const stats = byTypeMap.get(type)!;
        stats.count++;
        if (obj.was_resolved) stats.resolved++;
      });

      const byType: ObjectionSummary[] = Array.from(byTypeMap.entries())
        .map(([type, stats]) => ({
          type,
          count: stats.count,
          resolved: stats.resolved,
          resolutionRate: calculateRate(stats.resolved, stats.count),
          percentage: calculateRate(stats.count, totalObjections),
        }))
        .sort((a, b) => b.count - a.count);

      return {
        totalObjections,
        totalResolved,
        overallResolutionRate,
        byType,
        recentObjections: objections.slice(0, 50),
      };
    },
    enabled: !!engagementId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Objection type definitions with labels
 */
export const OBJECTION_TYPES = {
  budget: { label: 'Budget/Price', color: 'bg-red-500', icon: '💰' },
  timing: { label: 'Timing', color: 'bg-amber-500', icon: '⏰' },
  no_need: { label: 'No Need', color: 'bg-slate-500', icon: '🚫' },
  competitor: { label: 'Using Competitor', color: 'bg-purple-500', icon: '🏆' },
  authority: { label: 'Need Authority', color: 'bg-blue-500', icon: '👔' },
  technical: { label: 'Technical Concerns', color: 'bg-cyan-500', icon: '⚙️' },
  trust: { label: 'Trust/Credibility', color: 'bg-orange-500', icon: '🤝' },
  other: { label: 'Other', color: 'bg-gray-500', icon: '📝' },
} as const;

export type ObjectionType = keyof typeof OBJECTION_TYPES;

/**
 * Get objection type info
 */
export function getObjectionTypeInfo(type: string) {
  return OBJECTION_TYPES[type as ObjectionType] || OBJECTION_TYPES.other;
}
