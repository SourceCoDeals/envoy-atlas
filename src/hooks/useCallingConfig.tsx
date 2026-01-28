import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { 
  CallingMetricsConfig, 
  DEFAULT_CALLING_CONFIG,
  ScoreThresholds 
} from '@/lib/callingConfig';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface DbCallingConfig {
  id: string;
  client_id: string;
  seller_interest_thresholds: ScoreThresholds;
  objection_handling_thresholds: ScoreThresholds;
  valuation_discussion_thresholds: ScoreThresholds;
  rapport_building_thresholds: ScoreThresholds;
  value_proposition_thresholds: ScoreThresholds;
  conversation_quality_thresholds: ScoreThresholds;
  script_adherence_thresholds: ScoreThresholds;
  overall_quality_thresholds: ScoreThresholds;
  question_adherence_thresholds: ScoreThresholds;
  personal_insights_thresholds: ScoreThresholds;
  next_steps_clarity_thresholds: ScoreThresholds;
  objection_resolution_good_threshold: number;
  objection_resolution_warning_threshold: number;
  question_coverage_total: number;
  question_coverage_good_threshold: number;
  question_coverage_warning_threshold: number;
  call_duration_min_optimal: number;
  call_duration_max_optimal: number;
  call_duration_too_short: number;
  call_duration_too_long: number;
  interest_values_positive: string[];
  interest_values_negative: string[];
  top_calls_min_score: number;
  worst_calls_max_score: number;
  coaching_alert_overall_quality: number;
  coaching_alert_script_adherence: number;
  coaching_alert_question_adherence: number;
  coaching_alert_objection_handling: number;
  hot_lead_interest_score: number;
  hot_lead_requires_interest_yes: boolean;
  scores_decimal_places: number;
  show_score_justifications: boolean;
  created_at: string;
  updated_at: string;
}

function transformDbToConfig(data: DbCallingConfig): CallingMetricsConfig {
  return {
    sellerInterestThresholds: data.seller_interest_thresholds,
    objectionHandlingThresholds: data.objection_handling_thresholds,
    valuationDiscussionThresholds: data.valuation_discussion_thresholds,
    rapportBuildingThresholds: data.rapport_building_thresholds,
    valuePropositionThresholds: data.value_proposition_thresholds,
    conversationQualityThresholds: data.conversation_quality_thresholds,
    scriptAdherenceThresholds: data.script_adherence_thresholds,
    overallQualityThresholds: data.overall_quality_thresholds,
    questionAdherenceThresholds: data.question_adherence_thresholds,
    personalInsightsThresholds: data.personal_insights_thresholds,
    nextStepsClarityThresholds: data.next_steps_clarity_thresholds,
    
    objectionResolutionGoodThreshold: data.objection_resolution_good_threshold,
    objectionResolutionWarningThreshold: data.objection_resolution_warning_threshold,
    
    questionCoverageTotal: data.question_coverage_total,
    questionCoverageGoodThreshold: data.question_coverage_good_threshold,
    questionCoverageWarningThreshold: data.question_coverage_warning_threshold,
    
    callDurationMinOptimal: data.call_duration_min_optimal,
    callDurationMaxOptimal: data.call_duration_max_optimal,
    callDurationTooShort: data.call_duration_too_short,
    callDurationTooLong: data.call_duration_too_long,
    
    interestValuesPositive: data.interest_values_positive,
    interestValuesNegative: data.interest_values_negative,
    
    topCallsMinScore: data.top_calls_min_score,
    worstCallsMaxScore: data.worst_calls_max_score,
    
    coachingAlertOverallQuality: data.coaching_alert_overall_quality,
    coachingAlertScriptAdherence: data.coaching_alert_script_adherence,
    coachingAlertQuestionAdherence: data.coaching_alert_question_adherence,
    coachingAlertObjectionHandling: data.coaching_alert_objection_handling,
    
    hotLeadInterestScore: data.hot_lead_interest_score,
    hotLeadRequiresInterestYes: data.hot_lead_requires_interest_yes,
    
    scoresDecimalPlaces: data.scores_decimal_places,
    showScoreJustifications: data.show_score_justifications,
  };
}

function transformConfigToDb(updates: Partial<CallingMetricsConfig>): Record<string, unknown> {
  const dbUpdates: Record<string, unknown> = {};
  
  if (updates.sellerInterestThresholds !== undefined) dbUpdates.seller_interest_thresholds = updates.sellerInterestThresholds;
  if (updates.objectionHandlingThresholds !== undefined) dbUpdates.objection_handling_thresholds = updates.objectionHandlingThresholds;
  if (updates.valuationDiscussionThresholds !== undefined) dbUpdates.valuation_discussion_thresholds = updates.valuationDiscussionThresholds;
  if (updates.rapportBuildingThresholds !== undefined) dbUpdates.rapport_building_thresholds = updates.rapportBuildingThresholds;
  if (updates.valuePropositionThresholds !== undefined) dbUpdates.value_proposition_thresholds = updates.valuePropositionThresholds;
  if (updates.conversationQualityThresholds !== undefined) dbUpdates.conversation_quality_thresholds = updates.conversationQualityThresholds;
  if (updates.scriptAdherenceThresholds !== undefined) dbUpdates.script_adherence_thresholds = updates.scriptAdherenceThresholds;
  if (updates.overallQualityThresholds !== undefined) dbUpdates.overall_quality_thresholds = updates.overallQualityThresholds;
  if (updates.questionAdherenceThresholds !== undefined) dbUpdates.question_adherence_thresholds = updates.questionAdherenceThresholds;
  if (updates.personalInsightsThresholds !== undefined) dbUpdates.personal_insights_thresholds = updates.personalInsightsThresholds;
  if (updates.nextStepsClarityThresholds !== undefined) dbUpdates.next_steps_clarity_thresholds = updates.nextStepsClarityThresholds;
  
  if (updates.objectionResolutionGoodThreshold !== undefined) dbUpdates.objection_resolution_good_threshold = updates.objectionResolutionGoodThreshold;
  if (updates.objectionResolutionWarningThreshold !== undefined) dbUpdates.objection_resolution_warning_threshold = updates.objectionResolutionWarningThreshold;
  
  if (updates.questionCoverageTotal !== undefined) dbUpdates.question_coverage_total = updates.questionCoverageTotal;
  if (updates.questionCoverageGoodThreshold !== undefined) dbUpdates.question_coverage_good_threshold = updates.questionCoverageGoodThreshold;
  if (updates.questionCoverageWarningThreshold !== undefined) dbUpdates.question_coverage_warning_threshold = updates.questionCoverageWarningThreshold;
  
  if (updates.callDurationMinOptimal !== undefined) dbUpdates.call_duration_min_optimal = updates.callDurationMinOptimal;
  if (updates.callDurationMaxOptimal !== undefined) dbUpdates.call_duration_max_optimal = updates.callDurationMaxOptimal;
  if (updates.callDurationTooShort !== undefined) dbUpdates.call_duration_too_short = updates.callDurationTooShort;
  if (updates.callDurationTooLong !== undefined) dbUpdates.call_duration_too_long = updates.callDurationTooLong;
  
  if (updates.interestValuesPositive !== undefined) dbUpdates.interest_values_positive = updates.interestValuesPositive;
  if (updates.interestValuesNegative !== undefined) dbUpdates.interest_values_negative = updates.interestValuesNegative;
  
  if (updates.topCallsMinScore !== undefined) dbUpdates.top_calls_min_score = updates.topCallsMinScore;
  if (updates.worstCallsMaxScore !== undefined) dbUpdates.worst_calls_max_score = updates.worstCallsMaxScore;
  
  if (updates.coachingAlertOverallQuality !== undefined) dbUpdates.coaching_alert_overall_quality = updates.coachingAlertOverallQuality;
  if (updates.coachingAlertScriptAdherence !== undefined) dbUpdates.coaching_alert_script_adherence = updates.coachingAlertScriptAdherence;
  if (updates.coachingAlertQuestionAdherence !== undefined) dbUpdates.coaching_alert_question_adherence = updates.coachingAlertQuestionAdherence;
  if (updates.coachingAlertObjectionHandling !== undefined) dbUpdates.coaching_alert_objection_handling = updates.coachingAlertObjectionHandling;
  
  if (updates.hotLeadInterestScore !== undefined) dbUpdates.hot_lead_interest_score = updates.hotLeadInterestScore;
  if (updates.hotLeadRequiresInterestYes !== undefined) dbUpdates.hot_lead_requires_interest_yes = updates.hotLeadRequiresInterestYes;
  
  if (updates.scoresDecimalPlaces !== undefined) dbUpdates.scores_decimal_places = updates.scoresDecimalPlaces;
  if (updates.showScoreJustifications !== undefined) dbUpdates.show_score_justifications = updates.showScoreJustifications;

  dbUpdates.updated_at = new Date().toISOString();

  return dbUpdates;
}

export function useCallingConfig() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['calling-config', currentWorkspace?.id],
    queryFn: async (): Promise<CallingMetricsConfig> => {
      if (!currentWorkspace?.id) return DEFAULT_CALLING_CONFIG;

      // Use type assertion for the custom table
      const { data, error } = await supabase
        .from('calling_metrics_config' as any)
        .select('*')
        .eq('client_id', currentWorkspace.id)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching calling config', error);
        return DEFAULT_CALLING_CONFIG;
      }
      
      if (!data) {
        // Create default config for this workspace
        const { data: newConfig, error: insertError } = await supabase
          .from('calling_metrics_config' as any)
          .insert({ client_id: currentWorkspace.id })
          .select()
          .single();
          
        if (insertError || !newConfig) {
          logger.error('Error creating calling config', insertError);
          return DEFAULT_CALLING_CONFIG;
        }
        
        return transformDbToConfig(newConfig as unknown as DbCallingConfig);
      }

      return transformDbToConfig(data as unknown as DbCallingConfig);
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<CallingMetricsConfig>) => {
      if (!currentWorkspace?.id) throw new Error('No workspace');

      const dbUpdates = transformConfigToDb(updates);

      const { error } = await supabase
        .from('calling_metrics_config' as any)
        .update(dbUpdates)
        .eq('client_id', currentWorkspace.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calling-config'] });
      toast.success('Calling metrics configuration saved');
    },
    onError: (error) => {
      logger.error('Failed to update calling config', error);
      toast.error('Failed to save configuration');
    },
  });

  const resetToDefaults = useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id) throw new Error('No workspace');

      const dbUpdates = transformConfigToDb(DEFAULT_CALLING_CONFIG);

      const { error } = await supabase
        .from('calling_metrics_config' as any)
        .update(dbUpdates)
        .eq('client_id', currentWorkspace.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calling-config'] });
      toast.success('Configuration reset to defaults');
    },
    onError: (error) => {
      logger.error('Failed to reset calling config', error);
      toast.error('Failed to reset configuration');
    },
  });

  return {
    config: config ?? DEFAULT_CALLING_CONFIG,
    isLoading,
    updateConfig: updateConfig.mutate,
    isUpdating: updateConfig.isPending,
    resetToDefaults: resetToDefaults.mutate,
    isResetting: resetToDefaults.isPending,
  };
}
