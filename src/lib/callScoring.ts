/**
 * Call Scoring Library
 * Implements weighted composite scoring for cold calls
 */

import { ColdCall } from '@/hooks/useColdCallAnalytics';

export interface ScoreBreakdown {
  // Outcome-Based (50% weight)
  dmReached: number;        // +2 pts if decision_maker_identified_score >= 7
  meetingSet: number;       // +3 pts if is_meeting = true
  genuineInterest: number;  // +1.5 pts if seller_interest_score >= 7
  referralObtained: number; // +1 pt if referral_rate_score >= 6
  followUpRequested: number; // +1 pt if parsed from summary/transcript

  // Conversation Quality (30% weight)
  durationScore: number;    // 0-2 pts scaled by duration (cap at 15 min)
  qualifyingInfo: number;   // +0.5 pts per key concern identified
  objectionHandled: number; // +1 pt scaled by objection_handling_score

  // Efficiency (20% weight)
  firstAttemptDm: number;   // +1.5 pts if is_first_attempt_dm
  optimalTime: number;      // +0.5 pts if called during 9-11am or 2-4pm

  // Totals
  outcomeTotal: number;
  qualityTotal: number;
  efficiencyTotal: number;
  rawTotal: number;
  normalizedScore: number;  // 1-10 scale
}

// Maximum possible points in each category
const MAX_OUTCOME = 8.5;     // 2 + 3 + 1.5 + 1 + 1
const MAX_QUALITY = 5;       // 2 + 1.5 + 1.5
const MAX_EFFICIENCY = 2;    // 1.5 + 0.5

// Weights for final calculation
const WEIGHT_OUTCOME = 0.5;
const WEIGHT_QUALITY = 0.3;
const WEIGHT_EFFICIENCY = 0.2;

/**
 * Check if call time is in optimal window (9-11am or 2-4pm)
 */
function isOptimalCallTime(calledDate: string | null): boolean {
  if (!calledDate) return false;
  
  try {
    const date = new Date(calledDate);
    const hour = date.getHours();
    return (hour >= 9 && hour < 11) || (hour >= 14 && hour < 16);
  } catch {
    return false;
  }
}

/**
 * Calculate duration score (0-2 points, capped at 15 minutes)
 */
function calculateDurationScore(durationSec: number | null): number {
  if (!durationSec || durationSec <= 0) return 0;
  
  const minutes = durationSec / 60;
  const cappedMinutes = Math.min(minutes, 15);
  
  // Linear scale: 0 min = 0 pts, 15 min = 2 pts
  return (cappedMinutes / 15) * 2;
}

/**
 * Count key concerns from JSON field
 */
function countKeyConcerns(keyConcerns: any): number {
  if (!keyConcerns) return 0;
  
  if (Array.isArray(keyConcerns)) {
    return keyConcerns.length;
  }
  
  if (typeof keyConcerns === 'object') {
    return Object.keys(keyConcerns).filter(k => keyConcerns[k]).length;
  }
  
  if (typeof keyConcerns === 'string') {
    try {
      const parsed = JSON.parse(keyConcerns);
      return Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
    } catch {
      // Count comma-separated items
      return keyConcerns.split(',').filter(s => s.trim()).length;
    }
  }
  
  return 0;
}

/**
 * Check if follow-up was requested (parse from summary/transcript)
 */
function hasFollowUpRequested(call: ColdCall): boolean {
  const searchText = [
    call.call_summary || '',
    (call as any).next_steps || '',
  ].join(' ').toLowerCase();
  
  const followUpIndicators = [
    'follow up',
    'follow-up',
    'callback',
    'call back',
    'schedule',
    'next week',
    'next month',
    'get back to',
    'reach out again',
    'touch base',
  ];
  
  return followUpIndicators.some(indicator => searchText.includes(indicator));
}

/**
 * Calculate complete score breakdown for a cold call
 */
export function calculateScoreBreakdown(call: ColdCall): ScoreBreakdown {
  // Outcome-Based Scores
  const dmReached = (call.decision_maker_identified_score || 0) >= 7 ? 2 : 0;
  const meetingSet = call.is_meeting ? 3 : 0;
  const genuineInterest = (call.seller_interest_score || 0) >= 7 ? 1.5 : 0;
  const referralObtained = (call.referral_rate_score || 0) >= 6 ? 1 : 0;
  const followUpRequested = hasFollowUpRequested(call) ? 1 : 0;
  
  const outcomeTotal = dmReached + meetingSet + genuineInterest + referralObtained + followUpRequested;

  // Conversation Quality Scores
  const durationScore = calculateDurationScore(call.call_duration_sec);
  const keyConcernCount = countKeyConcerns(call.key_concerns);
  const qualifyingInfo = Math.min(keyConcernCount * 0.5, 1.5); // Cap at 1.5 pts
  const objectionHandled = ((call.objection_handling_score || 0) / 10) * 1.5; // Scale to 0-1.5
  
  const qualityTotal = durationScore + qualifyingInfo + objectionHandled;

  // Efficiency Scores
  const firstAttemptDm = (call as any).is_first_attempt_dm ? 1.5 : 0;
  const optimalTime = isOptimalCallTime(call.called_date) ? 0.5 : 0;
  
  const efficiencyTotal = firstAttemptDm + optimalTime;

  // Calculate raw total
  const rawTotal = outcomeTotal + qualityTotal + efficiencyTotal;

  // Normalize to 1-10 scale using weighted approach
  const outcomeNorm = (outcomeTotal / MAX_OUTCOME) * WEIGHT_OUTCOME;
  const qualityNorm = (qualityTotal / MAX_QUALITY) * WEIGHT_QUALITY;
  const efficiencyNorm = (efficiencyTotal / MAX_EFFICIENCY) * WEIGHT_EFFICIENCY;
  
  // Convert weighted sum (0-1) to 1-10 scale
  const weightedSum = outcomeNorm + qualityNorm + efficiencyNorm;
  const normalizedScore = Math.max(1, Math.min(10, 1 + weightedSum * 9));

  return {
    dmReached,
    meetingSet,
    genuineInterest,
    referralObtained,
    followUpRequested,
    durationScore,
    qualifyingInfo,
    objectionHandled,
    firstAttemptDm,
    optimalTime,
    outcomeTotal,
    qualityTotal,
    efficiencyTotal,
    rawTotal,
    normalizedScore,
  };
}

/**
 * Calculate enhanced score (simple number output)
 */
export function calculateEnhancedScore(call: ColdCall): number {
  const breakdown = calculateScoreBreakdown(call);
  return Math.round(breakdown.normalizedScore * 10) / 10;
}

/**
 * Determine if a call should be flagged for review
 */
export function shouldFlagForReview(call: ColdCall): { flagged: boolean; reason: string | null } {
  const score = call.composite_score || 0;
  const duration = call.call_duration_sec || 0;
  const interestScore = call.seller_interest_score || 0;
  
  // Borderline score (6-7)
  if (score >= 6 && score <= 7) {
    return { flagged: true, reason: 'Borderline score - potential coaching opportunity' };
  }
  
  // Long call without meeting
  if (duration >= 480 && !call.is_meeting) { // 8+ minutes
    return { flagged: true, reason: 'Long conversation without meeting set' };
  }
  
  // High composite but low interest
  if (score >= 7 && interestScore < 4) {
    return { flagged: true, reason: 'High quality score but low interest - review approach' };
  }
  
  // Good conversation metrics but no next step
  if (call.is_connection && duration >= 300 && !(call as any).next_steps) {
    return { flagged: true, reason: 'Connection made but no clear next step captured' };
  }
  
  return { flagged: false, reason: null };
}

/**
 * Get score status label and color
 */
export function getEnhancedScoreStatus(score: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (score >= 8) {
    return { label: 'Excellent', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' };
  }
  if (score >= 6) {
    return { label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' };
  }
  if (score >= 4) {
    return { label: 'Fair', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' };
  }
  return { label: 'Needs Work', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' };
}

/**
 * Format score for display
 */
export function formatEnhancedScore(score: number | null): string {
  if (score === null || score === undefined) return '-';
  return score.toFixed(1);
}
