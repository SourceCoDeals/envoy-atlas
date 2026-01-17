/**
 * Email performance benchmarks based on industry standards
 */
export const EMAIL_BENCHMARKS = {
  deliveryRate: 98,
  openRate: 27.7,
  clickRate: 2.5,
  replyRate: 3.4,
  bounceRate: 2,
  positiveRate: 1.5,
  spamComplaintRate: 0.1,
} as const;

/**
 * Cold calling benchmarks
 */
export const CALLING_BENCHMARKS = {
  connectRate: { min: 15, max: 20 },
  conversationRate: 50,
  meetingRate: 5,
  avgDuration: 120, // seconds
  qualityScore: 70,
} as const;

/**
 * Infrastructure health thresholds
 */
export const INFRASTRUCTURE_THRESHOLDS = {
  healthScore: {
    good: 80,
    warning: 60,
  },
  utilizationRate: {
    warning: 60,
    critical: 80,
  },
  bounceRate: {
    warning: 5,
    critical: 10,
  },
  spamComplaintRate: {
    warning: 0.1,
    critical: 0.3,
  },
} as const;

/**
 * List quality thresholds
 */
export const LIST_QUALITY_THRESHOLDS = {
  emailValidRate: 90,
  phoneValidRate: 85,
  badDataRate: 5,
  decisionMakerRate: 80,
} as const;

/**
 * Health score calculation weights
 */
export const HEALTH_SCORE_WEIGHTS = {
  responseRate: 5,
  meetingRate: 10,
  progressToTarget: 0.3,
  activityBonus: 20,
} as const;

/**
 * Get threshold status based on value
 */
export function getThresholdStatus(
  value: number,
  threshold: { warning: number; critical?: number; good?: number },
  higherIsBetter = true
): 'good' | 'warning' | 'critical' {
  if (higherIsBetter) {
    if (threshold.good !== undefined && value >= threshold.good) return 'good';
    if (value >= threshold.warning) return threshold.good !== undefined ? 'warning' : 'good';
    return threshold.critical !== undefined && value < threshold.critical ? 'critical' : 'warning';
  } else {
    if (value <= threshold.warning) return 'good';
    if (threshold.critical !== undefined && value >= threshold.critical) return 'critical';
    return 'warning';
  }
}
