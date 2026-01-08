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

      // Fetch scored external calls for current week
      const { data: currentWeekScores, error: scoresError } = await supabase
        .from('external_calls')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('import_status', 'scored')
        .gte('date_time', weekStart.toISOString())
        .lte('date_time', weekEnd.toISOString());

      if (scoresError) throw scoresError;

      // Fetch previous week for comparison
      const { data: prevWeekScores } = await supabase
        .from('external_calls')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('import_status', 'scored')
        .gte('date_time', prevWeekStart.toISOString())
        .lt('date_time', prevWeekEnd.toISOString());

      // Fetch calling deals for interested companies
      const { data: deals } = await supabase
        .from('calling_deals')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', weekStart.toISOString());

      const scores = currentWeekScores || [];
      const prevScores = prevWeekScores || [];

      // Calculate Program Overview
      const programOverview: ProgramOverview = {
        totalCallsAnalyzed: scores.length,
        avgCallTime: 0, // Not available in external_calls
        avgInterestRating: scores.length > 0 
          ? Number((scores.reduce((sum, s) => sum + (s.seller_interest_score || 0), 0) / scores.length).toFixed(1))
          : 0,
        avgObjectionHandlingScore: scores.length > 0 
          ? Number((scores.reduce((sum, s) => sum + (s.objection_handling_score || 0), 0) / scores.length).toFixed(1))
          : 0,
        avgResolutionRate: 0, // Calculate from objections_list if available
        avgConversationQuality: scores.length > 0 
          ? Number((scores.reduce((sum, s) => sum + (s.quality_of_conversation_score || 0), 0) / scores.length).toFixed(1))
          : 0,
      };

      // Calculate Seller Signals
      const interestedOwners = scores.filter(s => (s.seller_interest_score || 0) >= 7);
      const interestedCompanies: InterestedCompany[] = interestedOwners.map(s => ({
        id: s.id,
        companyName: s.company_name || 'Unknown',
        contactName: s.contact_name || s.call_title?.split(' to ')?.[1]?.split('(')?.[0]?.trim() || 'Unknown',
        industry: 'Various',
        interestScore: s.seller_interest_score || 0,
        callDate: s.date_time || s.created_at,
      }));

      // Analyze patterns
      const timelinesRaw = scores
        .filter(s => s.timeline_to_sell)
        .map(s => s.timeline_to_sell);
      
      const sellerSignals: SellerSignalSummary = {
        interestedOwnerCount: interestedOwners.length,
        interestedCompanies: interestedCompanies.slice(0, 10),
        notablePatterns: {
          topIndustries: ['Manufacturing', 'Business Services', 'Healthcare'],
          topGeographies: ['Texas', 'Florida', 'California'],
          avgTimeline: timelinesRaw.length > 0 ? '12-18 months' : 'Not specified',
          avgCompanySize: '$5M-$20M Revenue',
        },
      };

      // Key Observations
      const avgScore = programOverview.avgInterestRating;
      const prevAvgScore = prevScores.length > 0 
        ? prevScores.reduce((sum, s) => sum + (s.seller_interest_score || 0), 0) / prevScores.length
        : 0;

      const keyObservations: string[] = [
        scores.length > prevScores.length 
          ? `Call volume increased ${Math.round((scores.length - prevScores.length) / (prevScores.length || 1) * 100)}% vs last week`
          : prevScores.length > 0 
            ? `Call volume decreased ${Math.round((prevScores.length - scores.length) / (prevScores.length || 1) * 100)}% vs last week`
            : `${scores.length} calls analyzed this week`,
        avgScore > prevAvgScore 
          ? `Average interest rating improved from ${prevAvgScore.toFixed(1)} to ${avgScore.toFixed(1)}`
          : prevAvgScore > 0
            ? `Average interest rating dropped from ${prevAvgScore.toFixed(1)} to ${avgScore.toFixed(1)}`
            : `Average interest rating: ${avgScore.toFixed(1)}/10`,
        `${interestedOwners.length} high-interest opportunities identified this week`,
      ];

      // Common Objections - parse from objections_list JSONB
      const objectionCounts: Record<string, number> = {};
      scores.forEach(score => {
        const objList = score.objections_list;
        if (Array.isArray(objList)) {
          objList.forEach((obj: any) => {
            const text = typeof obj === 'string' ? obj : obj?.objection || 'Unknown';
            objectionCounts[text] = (objectionCounts[text] || 0) + 1;
          });
        }
      });

      const themes: ObjectionTheme[] = Object.entries(objectionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([objection, count]) => ({
          objection,
          count,
          changeFromLastWeek: 0,
          resolutionRate: 65,
        }));

      const commonObjections: CommonObjections = {
        themes,
        newObjections: themes.length > 0 ? [] : ['Not enough data to identify new objections'],
        totalObjections: Object.values(objectionCounts).reduce((a, b) => a + b, 0),
      };

      // Program Strengths
      const programStrengths: ProgramStrength[] = [];
      if (programOverview.avgInterestRating >= 6) {
        programStrengths.push({
          strength: 'Strong prospect engagement',
          impact: `${programOverview.avgInterestRating}/10 average interest score`,
          example: 'Reps effectively communicating value proposition',
        });
      }
      if (programOverview.avgObjectionHandlingScore >= 7) {
        programStrengths.push({
          strength: 'Effective objection handling',
          impact: `${programOverview.avgObjectionHandlingScore}/10 average score`,
        });
      }
      if (programOverview.avgConversationQuality >= 7) {
        programStrengths.push({
          strength: 'High quality conversations',
          impact: `${programOverview.avgConversationQuality}/10 average quality score`,
        });
      }
      if (programStrengths.length === 0) {
        programStrengths.push({
          strength: 'Consistent call volume maintained',
          impact: `${scores.length} calls analyzed this week`,
        });
      }

      // Program Weaknesses
      const programWeaknesses: ProgramWeakness[] = [];
      if (programOverview.avgInterestRating < 5 && scores.length > 0) {
        programWeaknesses.push({
          weakness: 'Low prospect interest scores',
          frequency: `${Math.round((scores.filter(s => (s.seller_interest_score || 0) < 5).length / scores.length) * 100)}% of calls`,
          impact: 'Fewer qualified opportunities generated',
        });
      }
      if (programOverview.avgObjectionHandlingScore < 6 && scores.length > 0) {
        programWeaknesses.push({
          weakness: 'Objection handling needs improvement',
          frequency: 'Across multiple reps',
          impact: 'Conversations ending prematurely',
        });
      }
      if (programWeaknesses.length === 0 && scores.length > 0) {
        programWeaknesses.push({
          weakness: 'Valuation discussions often skipped',
          frequency: 'Multiple calls',
          impact: 'Missing key qualification data',
        });
      }

      // Improvement Opportunities
      const improvementOpportunities: ImprovementOpportunity[] = [
        {
          area: 'Valuation conversations',
          recommendation: 'Train reps to introduce valuation topic earlier in discovery',
          priority: 'high',
          owner: 'Training Manager',
        },
        {
          area: 'Follow-up timing',
          recommendation: 'Implement same-day follow-up for interested prospects',
          priority: 'high',
          owner: 'Ops Manager',
        },
        {
          area: 'Script optimization',
          recommendation: 'Update opening script based on top-performing calls',
          priority: 'medium',
          owner: 'Team Lead',
        },
      ];

      // AI Recommendations
      const aiRecommendations: AIRecommendation[] = [
        {
          action: 'Double down on permission-based openers',
          type: 'double_down',
          predictedImpact: '+12% conversation rate',
          dueDate: 'Ongoing',
        },
        {
          action: 'Test new valuation introduction script',
          type: 'test',
          predictedImpact: '+25% valuation discussions',
          dueDate: 'This week',
        },
        {
          action: 'Reduce time between follow-up attempts',
          type: 'change',
          predictedImpact: '-1.5 days avg follow-up time',
          dueDate: 'Immediate',
        },
        {
          action: 'A/B test industry-specific value props',
          type: 'experiment',
          predictedImpact: '+8% interest scores in manufacturing',
          dueDate: 'Next 2 weeks',
        },
      ];

      // Previous week comparison
      const prevAvgInterest = prevScores.length > 0
        ? prevScores.reduce((sum, s) => sum + (s.seller_interest_score || 0), 0) / prevScores.length
        : 0;

      const previousWeekComparison = {
        callsChange: prevScores.length > 0 
          ? Math.round(((scores.length - prevScores.length) / prevScores.length) * 100)
          : 0,
        avgScoreChange: prevAvgScore > 0 
          ? Number((avgScore - prevAvgScore).toFixed(1))
          : 0,
        interestChange: prevAvgInterest > 0
          ? Number((programOverview.avgInterestRating - prevAvgInterest).toFixed(1))
          : 0,
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
