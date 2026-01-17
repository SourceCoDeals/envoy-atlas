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

/**
 * Calculate estimated meeting breakdown
 */
export function calculateMeetingBreakdown(totalMeetings: number) {
  return {
    completed: Math.floor(totalMeetings * 0.75),
    scheduled: Math.floor(totalMeetings * 0.2),
    cancelled: Math.max(0, totalMeetings - Math.floor(totalMeetings * 0.75) - Math.floor(totalMeetings * 0.2)),
  };
}

/**
 * Calculate channel attribution for meetings
 */
export function calculateChannelAttribution(
  totalMeetings: number,
  emailMeetings: number,
  callMeetings: number
) {
  const multiChannel = Math.floor(totalMeetings * 0.3);
  return {
    emailOnly: emailMeetings,
    callOnly: callMeetings,
    multiChannel,
  };
}
