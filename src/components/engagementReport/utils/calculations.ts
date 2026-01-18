import { HEALTH_SCORE_WEIGHTS } from '../constants/thresholds';

interface HealthScoreInputs {
  responseRate: number;
  meetingRate: number;
  meetingsScheduled: number;
  meetingsTarget: number | null;
  totalTouchpoints: number;
}

/**
 * Calculate engagement health score (0-100)
 */
export function calculateHealthScore(inputs: HealthScoreInputs): number {
  const {
    responseRate,
    meetingRate,
    meetingsScheduled,
    meetingsTarget,
    totalTouchpoints,
  } = inputs;

  const meetingProgress = meetingsTarget
    ? (meetingsScheduled / meetingsTarget) * 100
    : 50;

  const score = Math.round(
    responseRate * HEALTH_SCORE_WEIGHTS.responseRate +
    meetingRate * HEALTH_SCORE_WEIGHTS.meetingRate +
    meetingProgress * HEALTH_SCORE_WEIGHTS.progressToTarget +
    (totalTouchpoints > 0 ? HEALTH_SCORE_WEIGHTS.activityBonus : 0)
  );

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate meeting progress percentage
 */
export function calculateMeetingProgress(
  scheduled: number,
  target: number | null
): number {
  if (!target || target === 0) return 50;
  return Math.min(100, (scheduled / target) * 100);
}

/**
 * Calculate funnel conversion rate between stages
 */
export function calculateFunnelConversion(
  currentStage: number,
  previousStage: number
): number {
  if (previousStage === 0) return 0;
  return (currentStage / previousStage) * 100;
}

// NOTE: The following functions have been REMOVED because they produced 
// hardcoded/estimated data that was displayed as if it were real:
//
// - calculateMeetingBreakdown() - was hardcoding 75% completed, 20% scheduled, 5% cancelled
// - calculateChannelAttribution() - was hardcoding 30% multi-channel
//
// These functions were removed to prevent fake data from being shown.
// If meeting tracking is implemented in the future, these should be 
// replaced with actual data queries.
