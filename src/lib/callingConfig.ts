/**
 * CALLING METRICS CONFIGURATION
 * Single source of truth for all calling metric thresholds and calculations
 * All pages MUST use these functions - no hardcoded values
 */

export interface ScoreThresholds {
  excellent: number;
  good: number;
  average: number;
  poor: number;
}

export interface CallingMetricsConfig {
  // Score thresholds for each AI dimension
  sellerInterestThresholds: ScoreThresholds;
  objectionHandlingThresholds: ScoreThresholds;
  valuationDiscussionThresholds: ScoreThresholds;
  rapportBuildingThresholds: ScoreThresholds;
  valuePropositionThresholds: ScoreThresholds;
  conversationQualityThresholds: ScoreThresholds;
  scriptAdherenceThresholds: ScoreThresholds;
  overallQualityThresholds: ScoreThresholds;
  questionAdherenceThresholds: ScoreThresholds;
  personalInsightsThresholds: ScoreThresholds;
  nextStepsClarityThresholds: ScoreThresholds;
  
  // Objection resolution
  objectionResolutionGoodThreshold: number;
  objectionResolutionWarningThreshold: number;
  
  // Question coverage
  questionCoverageTotal: number;
  questionCoverageGoodThreshold: number;
  questionCoverageWarningThreshold: number;
  
  // Call duration (seconds)
  callDurationMinOptimal: number;
  callDurationMaxOptimal: number;
  callDurationTooShort: number;
  callDurationTooLong: number;
  
  // Interest classification
  interestValuesPositive: string[];
  interestValuesNegative: string[];
  
  // Top/Worst calls
  topCallsMinScore: number;
  worstCallsMaxScore: number;
  
  // Coaching alerts
  coachingAlertOverallQuality: number;
  coachingAlertScriptAdherence: number;
  coachingAlertQuestionAdherence: number;
  coachingAlertObjectionHandling: number;
  
  // Hot leads
  hotLeadInterestScore: number;
  hotLeadRequiresInterestYes: boolean;
  
  // Display
  scoresDecimalPlaces: number;
  showScoreJustifications: boolean;
}

// Default configuration (matches database defaults)
export const DEFAULT_CALLING_CONFIG: CallingMetricsConfig = {
  sellerInterestThresholds: { excellent: 8, good: 6, average: 4, poor: 2 },
  objectionHandlingThresholds: { excellent: 8, good: 6, average: 4, poor: 2 },
  valuationDiscussionThresholds: { excellent: 8, good: 6, average: 4, poor: 2 },
  rapportBuildingThresholds: { excellent: 8, good: 6, average: 4, poor: 2 },
  valuePropositionThresholds: { excellent: 8, good: 6, average: 4, poor: 2 },
  conversationQualityThresholds: { excellent: 8, good: 6, average: 4, poor: 2 },
  scriptAdherenceThresholds: { excellent: 8, good: 6, average: 4, poor: 2 },
  overallQualityThresholds: { excellent: 8, good: 6, average: 4, poor: 2 },
  questionAdherenceThresholds: { excellent: 8, good: 6, average: 4, poor: 2 },
  personalInsightsThresholds: { excellent: 8, good: 6, average: 4, poor: 2 },
  nextStepsClarityThresholds: { excellent: 8, good: 6, average: 4, poor: 2 },
  
  objectionResolutionGoodThreshold: 80,
  objectionResolutionWarningThreshold: 50,
  
  questionCoverageTotal: 17,
  questionCoverageGoodThreshold: 12,
  questionCoverageWarningThreshold: 6,
  
  callDurationMinOptimal: 180,
  callDurationMaxOptimal: 300,
  callDurationTooShort: 60,
  callDurationTooLong: 600,
  
  interestValuesPositive: ['yes', 'maybe'],
  interestValuesNegative: ['no'],
  
  topCallsMinScore: 7,
  worstCallsMaxScore: 3,
  
  coachingAlertOverallQuality: 4,
  coachingAlertScriptAdherence: 4,
  coachingAlertQuestionAdherence: 4,
  coachingAlertObjectionHandling: 4,
  
  hotLeadInterestScore: 8,
  hotLeadRequiresInterestYes: true,
  
  scoresDecimalPlaces: 1,
  showScoreJustifications: true,
};

/**
 * Get score status based on thresholds
 */
export type ScoreStatus = 'excellent' | 'good' | 'average' | 'poor' | 'none';

export function getScoreStatus(score: number | null | undefined, thresholds: ScoreThresholds): ScoreStatus {
  if (score === null || score === undefined) return 'none';
  if (score >= thresholds.excellent) return 'excellent';
  if (score >= thresholds.good) return 'good';
  if (score >= thresholds.average) return 'average';
  return 'poor';
}

/**
 * Get color class for score status using semantic tokens
 */
export function getScoreStatusColor(status: ScoreStatus): string {
  switch (status) {
    case 'excellent': return 'text-success bg-success/10';
    case 'good': return 'text-primary bg-primary/10';
    case 'average': return 'text-warning bg-warning/10';
    case 'poor': return 'text-destructive bg-destructive/10';
    default: return 'text-muted-foreground bg-muted';
  }
}

/**
 * Get badge variant for score status
 */
export function getScoreBadgeVariant(status: ScoreStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'excellent': return 'default';
    case 'good': return 'secondary';
    case 'average': return 'outline';
    case 'poor': return 'destructive';
    default: return 'outline';
  }
}

/**
 * Check if call is a "top call" based on config
 */
export function isTopCall(overallScore: number | null, config: CallingMetricsConfig): boolean {
  if (overallScore === null) return false;
  return overallScore >= config.topCallsMinScore;
}

/**
 * Check if call is a "worst call" based on config
 */
export function isWorstCall(overallScore: number | null, config: CallingMetricsConfig): boolean {
  if (overallScore === null) return false;
  return overallScore <= config.worstCallsMaxScore;
}

/**
 * Check if call needs coaching review
 */
export function needsCoachingReview(call: {
  overall_quality_score?: number | null;
  script_adherence_score?: number | null;
  question_adherence_score?: number | null;
  objection_handling_score?: number | null;
}, config: CallingMetricsConfig): boolean {
  return (
    (call.overall_quality_score !== null && call.overall_quality_score !== undefined && call.overall_quality_score < config.coachingAlertOverallQuality) ||
    (call.script_adherence_score !== null && call.script_adherence_score !== undefined && call.script_adherence_score < config.coachingAlertScriptAdherence) ||
    (call.question_adherence_score !== null && call.question_adherence_score !== undefined && call.question_adherence_score < config.coachingAlertQuestionAdherence) ||
    (call.objection_handling_score !== null && call.objection_handling_score !== undefined && call.objection_handling_score < config.coachingAlertObjectionHandling)
  );
}

/**
 * Check if call is a hot lead
 */
export function isHotLead(call: {
  seller_interest_score?: number | null;
  interest_in_selling?: string | null;
}, config: CallingMetricsConfig): boolean {
  const hasHighInterestScore = (call.seller_interest_score ?? 0) >= config.hotLeadInterestScore;
  
  if (config.hotLeadRequiresInterestYes) {
    const hasPositiveInterest = config.interestValuesPositive.includes(
      (call.interest_in_selling || '').toLowerCase()
    );
    return hasHighInterestScore && hasPositiveInterest;
  }
  
  return hasHighInterestScore;
}

/**
 * Check if interest value is positive
 */
export function isPositiveInterest(interest: string | null | undefined, config: CallingMetricsConfig): boolean {
  if (!interest) return false;
  return config.interestValuesPositive.includes(interest.toLowerCase());
}

/**
 * Check if interest value is negative
 */
export function isNegativeInterest(interest: string | null | undefined, config: CallingMetricsConfig): boolean {
  if (!interest) return false;
  return config.interestValuesNegative.includes(interest.toLowerCase());
}

/**
 * Get call duration status
 */
export type DurationStatus = 'optimal' | 'short' | 'long' | 'too_short' | 'too_long';

export function getDurationStatus(durationSeconds: number, config: CallingMetricsConfig): DurationStatus {
  if (durationSeconds < config.callDurationTooShort) return 'too_short';
  if (durationSeconds < config.callDurationMinOptimal) return 'short';
  if (durationSeconds <= config.callDurationMaxOptimal) return 'optimal';
  if (durationSeconds <= config.callDurationTooLong) return 'long';
  return 'too_long';
}

/**
 * Get color for duration status
 */
export function getDurationStatusColor(status: DurationStatus): string {
  switch (status) {
    case 'optimal': return 'text-success';
    case 'short': return 'text-warning';
    case 'long': return 'text-warning';
    case 'too_short': return 'text-destructive';
    case 'too_long': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
}

/**
 * Get question coverage status
 */
export function getQuestionCoverageStatus(
  covered: number, 
  config: CallingMetricsConfig
): ScoreStatus {
  if (covered >= config.questionCoverageGoodThreshold) return 'excellent';
  if (covered >= config.questionCoverageWarningThreshold) return 'average';
  return 'poor';
}

/**
 * Get objection resolution status
 */
export function getObjectionResolutionStatus(
  resolved: number, 
  total: number, 
  config: CallingMetricsConfig
): ScoreStatus {
  if (total === 0) return 'none';
  const rate = (resolved / total) * 100;
  if (rate >= config.objectionResolutionGoodThreshold) return 'excellent';
  if (rate >= config.objectionResolutionWarningThreshold) return 'average';
  return 'poor';
}

/**
 * Format score for display
 */
export function formatScore(score: number | null | undefined, config: CallingMetricsConfig): string {
  if (score === null || score === undefined) return '-';
  return score.toFixed(config.scoresDecimalPlaces);
}

/**
 * Format duration for display (uses centralized logic)
 */
export function formatCallingDuration(seconds: number | null | undefined): string {
  if (!seconds) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/**
 * Get all score dimension keys for iteration
 */
export const SCORE_DIMENSIONS = [
  { key: 'overall_quality_score', label: 'Overall Quality', thresholdKey: 'overallQualityThresholds' },
  { key: 'seller_interest_score', label: 'Seller Interest', thresholdKey: 'sellerInterestThresholds' },
  { key: 'script_adherence_score', label: 'Script Adherence', thresholdKey: 'scriptAdherenceThresholds' },
  { key: 'question_adherence_score', label: 'Question Adherence', thresholdKey: 'questionAdherenceThresholds' },
  { key: 'objection_handling_score', label: 'Objection Handling', thresholdKey: 'objectionHandlingThresholds' },
  { key: 'conversation_quality_score', label: 'Conversation Quality', thresholdKey: 'conversationQualityThresholds' },
  { key: 'rapport_building_score', label: 'Rapport Building', thresholdKey: 'rapportBuildingThresholds' },
  { key: 'value_proposition_score', label: 'Value Proposition', thresholdKey: 'valuePropositionThresholds' },
  { key: 'next_steps_clarity_score', label: 'Next Steps Clarity', thresholdKey: 'nextStepsClarityThresholds' },
  { key: 'personal_insights_score', label: 'Personal Insights', thresholdKey: 'personalInsightsThresholds' },
  { key: 'valuation_discussion_score', label: 'Valuation Discussion', thresholdKey: 'valuationDiscussionThresholds' },
] as const;

/**
 * Get threshold for a specific dimension
 */
export function getThresholdForDimension(
  dimensionKey: string, 
  config: CallingMetricsConfig
): ScoreThresholds {
  const dimension = SCORE_DIMENSIONS.find(d => d.key === dimensionKey);
  if (!dimension) return config.overallQualityThresholds;
  return config[dimension.thresholdKey as keyof CallingMetricsConfig] as ScoreThresholds;
}
