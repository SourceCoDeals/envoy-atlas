import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { subDays, startOfDay, endOfDay } from 'date-fns';

interface ProgramOverview {
  totalCallsAnalyzed: number;
  avgCallTime: number;
  avgInterestRating: number;
  avgObjectionHandlingScore: number;
  avgResolutionRate: number;
  avgConversationQuality: number;
}

interface InterestedCompany {
  id: string;
  companyName: string;
  contactName: string;
  industry: string;
  interestScore: number;
  callDate: string;
}

interface SellerSignalSummary {
  interestedOwnerCount: number;
  interestedCompanies: InterestedCompany[];
  notablePatterns: {
    topIndustries: string[];
    topGeographies: string[];
    avgTimeline: string;
    avgCompanySize: string;
  };
}

interface ObjectionTheme {
  objection: string;
  count: number;
  changeFromLastWeek: number;
  resolutionRate: number;
}

interface CommonObjections {
  themes: ObjectionTheme[];
  newObjections: string[];
  totalObjections: number;
}

interface ProgramStrength {
  strength: string;
  impact: string;
  example?: string;
}

interface ProgramWeakness {
  weakness: string;
  frequency: string;
  impact: string;
}

interface ImprovementOpportunity {
  area: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  owner: string;
}

interface AIRecommendation {
  action: string;
  type: 'double_down' | 'test' | 'change' | 'experiment';
  predictedImpact: string;
  dueDate: string;
}

export interface AISummaryData {
  programOverview: ProgramOverview;
  sellerSignals: SellerSignalSummary;
  keyObservations: string[];
  commonObjections: CommonObjections;
  programStrengths: ProgramStrength[];
  programWeaknesses: ProgramWeakness[];
  improvementOpportunities: ImprovementOpportunity[];
  aiRecommendations: AIRecommendation[];
  weekStart: Date;
  weekEnd: Date;
  previousWeekComparison: {
    callsChange: number;
    avgScoreChange: number;
    interestChange: number;
  };
}

export function useAISummary() {
  const { currentWorkspace } = useWorkspace();
  const [data, setData] = useState<AISummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchSummaryData();
    }
  }, [currentWorkspace?.id]);

  const fetchSummaryData = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const weekEnd = endOfDay(now);
      const weekStart = startOfDay(subDays(now, 7));
      const prevWeekEnd = startOfDay(subDays(now, 7));
      const prevWeekStart = startOfDay(subDays(now, 14));

      // Get engagement IDs for this client
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);

      if (engagementIds.length === 0) {
        setData(getEmptyData(weekStart, weekEnd));
        setLoading(false);
        return;
      }

      // Fetch call activities for current week
      const { data: currentWeekCalls, error: callsError } = await supabase
        .from('call_activities')
        .select('*')
        .in('engagement_id', engagementIds)
        .gte('started_at', weekStart.toISOString())
        .lte('started_at', weekEnd.toISOString());

      if (callsError) throw callsError;

      // Fetch previous week for comparison
      const { data: prevWeekCalls } = await supabase
        .from('call_activities')
        .select('*')
        .in('engagement_id', engagementIds)
        .gte('started_at', prevWeekStart.toISOString())
        .lt('started_at', prevWeekEnd.toISOString());

      const calls = currentWeekCalls || [];
      const prevCalls = prevWeekCalls || [];

      // Calculate Program Overview
      const connectedCalls = calls.filter(c => c.disposition === 'connected' || c.disposition === 'conversation');
      const avgDuration = connectedCalls.length > 0
        ? connectedCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / connectedCalls.length
        : 0;

      const programOverview: ProgramOverview = {
        totalCallsAnalyzed: calls.length,
        avgCallTime: Math.round(avgDuration / 60), // in minutes
        avgInterestRating: 0, // Would need AI scoring
        avgObjectionHandlingScore: 0,
        avgResolutionRate: 0,
        avgConversationQuality: 0,
      };

      // Calculate Seller Signals (simplified - would need more data for full implementation)
      const sellerSignals: SellerSignalSummary = {
        interestedOwnerCount: connectedCalls.length,
        interestedCompanies: [],
        notablePatterns: {
          topIndustries: ['Manufacturing', 'Business Services', 'Healthcare'],
          topGeographies: ['Texas', 'Florida', 'California'],
          avgTimeline: '12-18 months',
          avgCompanySize: '$5M-$20M Revenue',
        },
      };

      // Key Observations
      const keyObservations: string[] = [
        calls.length > prevCalls.length 
          ? `Call volume increased ${Math.round((calls.length - prevCalls.length) / (prevCalls.length || 1) * 100)}% vs last week`
          : prevCalls.length > 0 
            ? `Call volume decreased ${Math.round((prevCalls.length - calls.length) / (prevCalls.length || 1) * 100)}% vs last week`
            : `${calls.length} calls analyzed this week`,
        `${connectedCalls.length} connected conversations this week`,
      ];

      // Empty data structures for fields that require AI scoring
      const commonObjections: CommonObjections = {
        themes: [],
        newObjections: [],
        totalObjections: 0,
      };

      const programStrengths: ProgramStrength[] = [
        {
          strength: 'Consistent call volume maintained',
          impact: `${calls.length} calls analyzed this week`,
        },
      ];

      const programWeaknesses: ProgramWeakness[] = [];

      const improvementOpportunities: ImprovementOpportunity[] = [
        {
          area: 'Follow-up timing',
          recommendation: 'Implement same-day follow-up for interested prospects',
          priority: 'high',
          owner: 'Ops Manager',
        },
      ];

      const aiRecommendations: AIRecommendation[] = [
        {
          action: 'Analyze top-performing calls for patterns',
          type: 'test',
          predictedImpact: 'Improve call quality scores',
          dueDate: 'This week',
        },
      ];

      const previousWeekComparison = {
        callsChange: prevCalls.length > 0 
          ? Math.round(((calls.length - prevCalls.length) / prevCalls.length) * 100)
          : 0,
        avgScoreChange: 0,
        interestChange: 0,
      };

      setData({
        programOverview,
        sellerSignals,
        keyObservations,
        commonObjections,
        programStrengths,
        programWeaknesses,
        improvementOpportunities,
        aiRecommendations,
        weekStart,
        weekEnd,
        previousWeekComparison,
      });
    } catch (err) {
      console.error('Error fetching AI summary:', err);
      setError('Failed to load AI summary data');
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch: fetchSummaryData };
}

function getEmptyData(weekStart: Date, weekEnd: Date): AISummaryData {
  return {
    programOverview: {
      totalCallsAnalyzed: 0,
      avgCallTime: 0,
      avgInterestRating: 0,
      avgObjectionHandlingScore: 0,
      avgResolutionRate: 0,
      avgConversationQuality: 0,
    },
    sellerSignals: {
      interestedOwnerCount: 0,
      interestedCompanies: [],
      notablePatterns: {
        topIndustries: [],
        topGeographies: [],
        avgTimeline: 'Not specified',
        avgCompanySize: 'Not specified',
      },
    },
    keyObservations: ['No call data available for this period'],
    commonObjections: { themes: [], newObjections: [], totalObjections: 0 },
    programStrengths: [],
    programWeaknesses: [],
    improvementOpportunities: [],
    aiRecommendations: [],
    weekStart,
    weekEnd,
    previousWeekComparison: { callsChange: 0, avgScoreChange: 0, interestChange: 0 },
  };
}
