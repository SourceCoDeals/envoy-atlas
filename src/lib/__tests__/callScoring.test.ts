import { describe, it, expect } from 'vitest';
import {
  calculateScoreBreakdown,
  calculateEnhancedScore,
  shouldFlagForReview,
  getEnhancedScoreStatus,
  formatEnhancedScore,
} from '../callScoring';
import type { ColdCall } from '@/hooks/useColdCallAnalytics';

// Helper to create a mock cold call with all required fields
const createMockCall = (overrides: Partial<ColdCall> = {}): ColdCall => ({
  id: 'test-call-1',
  client_id: 'client-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  analyst: 'Test Rep',
  called_date: '2024-01-15T10:00:00Z',
  call_duration_sec: 300,
  category: 'connected',
  normalized_category: 'connected',
  is_connection: true,
  is_meeting: false,
  is_voicemail: false,
  is_bad_data: false,
  composite_score: null,
  seller_interest_score: null,
  objection_handling_score: null,
  script_adherence_score: null,
  quality_of_conversation_score: null,
  value_proposition_score: null,
  decision_maker_identified_score: null,
  referral_rate_score: null,
  rapport_building_score: null,
  engagement_score: null,
  next_step_clarity_score: null,
  gatekeeper_handling_score: null,
  resolution_rate: null,
  interest_rating_reasoning: null,
  objection_handling_reasoning: null,
  resolution_rate_reasoning: null,
  conversation_quality_reasoning: null,
  script_adherence_reasoning: null,
  decision_maker_reasoning: null,
  value_clarity_reasoning: null,
  referral_rate_reasoning: null,
  call_summary: null,
  objections: null,
  key_concerns: null,
  target_pain_points: null,
  opening_type: null,
  not_interested_reason: null,
  ...overrides,
} as ColdCall);

describe('calculateScoreBreakdown', () => {
  describe('Outcome-Based Scoring', () => {
    it('awards 2 points for DM reached (score >= 7)', () => {
      const call = createMockCall({ decision_maker_identified_score: 8 });
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.dmReached).toBe(2);
    });

    it('awards 0 points for DM not reached (score < 7)', () => {
      const call = createMockCall({ decision_maker_identified_score: 5 });
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.dmReached).toBe(0);
    });

    it('awards 3 points for meeting set', () => {
      const call = createMockCall({ is_meeting: true });
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.meetingSet).toBe(3);
    });

    it('awards 1.5 points for genuine interest (score >= 7)', () => {
      const call = createMockCall({ seller_interest_score: 8 });
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.genuineInterest).toBe(1.5);
    });

    it('awards 1 point for referral obtained (score >= 6)', () => {
      const call = createMockCall({ referral_rate_score: 7 });
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.referralObtained).toBe(1);
    });

    it('awards 1 point for follow-up requested in summary', () => {
      const call = createMockCall({
        call_summary: 'Great call! Will follow up next week.',
      });
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.followUpRequested).toBe(1);
    });
  });

  describe('Conversation Quality Scoring', () => {
    it('calculates duration score up to 2 points for 15+ min calls', () => {
      const call = createMockCall({ call_duration_sec: 900 }); // 15 minutes
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.durationScore).toBeCloseTo(2, 1);
    });

    it('calculates proportional duration score for shorter calls', () => {
      const call = createMockCall({ call_duration_sec: 450 }); // 7.5 minutes
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.durationScore).toBeCloseTo(1, 1);
    });

    it('returns 0 duration score for no duration', () => {
      const call = createMockCall({ call_duration_sec: 0 });
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.durationScore).toBe(0);
    });

    it('calculates qualifying info points from key concerns', () => {
      const call = createMockCall({
        key_concerns: ['budget', 'timeline', 'competition'],
      });
      const breakdown = calculateScoreBreakdown(call);
      // 3 concerns × 0.5 = 1.5 (capped)
      expect(breakdown.qualifyingInfo).toBe(1.5);
    });

    it('scales objection handling score to 0-1.5 range', () => {
      const call = createMockCall({ objection_handling_score: 10 });
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.objectionHandled).toBeCloseTo(1.5, 1);
    });
  });

  describe('Efficiency Scoring', () => {
    it('awards 0.5 points for optimal call time (9-11am)', () => {
      const call = createMockCall({
        called_date: '2024-01-15T10:30:00Z', // 10:30 AM
      });
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.optimalTime).toBe(0.5);
    });

    it('awards 0.5 points for optimal call time (2-4pm)', () => {
      const call = createMockCall({
        called_date: '2024-01-15T15:00:00Z', // 3 PM
      });
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.optimalTime).toBe(0.5);
    });

    it('awards 0 points for non-optimal call time', () => {
      const call = createMockCall({
        called_date: '2024-01-15T12:00:00Z', // 12 PM
      });
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.optimalTime).toBe(0);
    });
  });

  describe('Normalized Score', () => {
    it('returns score between 1 and 10', () => {
      const call = createMockCall();
      const breakdown = calculateScoreBreakdown(call);
      expect(breakdown.normalizedScore).toBeGreaterThanOrEqual(1);
      expect(breakdown.normalizedScore).toBeLessThanOrEqual(10);
    });

    it('calculates maximum score correctly with all points', () => {
      const call = createMockCall({
        decision_maker_identified_score: 10,
        is_meeting: true,
        seller_interest_score: 10,
        referral_rate_score: 10,
        call_summary: 'Will schedule follow up call next week',
        call_duration_sec: 900,
        key_concerns: ['a', 'b', 'c', 'd'],
        objection_handling_score: 10,
        called_date: '2024-01-15T10:00:00Z',
      });
      (call as any).is_first_attempt_dm = true;
      const breakdown = calculateScoreBreakdown(call);
      
      // Should be close to maximum
      expect(breakdown.normalizedScore).toBeGreaterThan(9);
    });

    it('calculates minimum score for empty call', () => {
      const call = createMockCall({
        decision_maker_identified_score: 0,
        is_meeting: false,
        seller_interest_score: 0,
        referral_rate_score: 0,
        call_summary: null,
        call_duration_sec: 0,
        key_concerns: null,
        objection_handling_score: 0,
        called_date: '2024-01-15T12:00:00Z',
      });
      const breakdown = calculateScoreBreakdown(call);
      
      // Should be minimum (1)
      expect(breakdown.normalizedScore).toBe(1);
    });
  });
});

describe('calculateEnhancedScore', () => {
  it('returns rounded score to 1 decimal', () => {
    const call = createMockCall({
      decision_maker_identified_score: 7,
      seller_interest_score: 5,
      call_duration_sec: 300,
    });
    const score = calculateEnhancedScore(call);
    expect(score).toBe(Math.round(score * 10) / 10);
  });
});

describe('shouldFlagForReview', () => {
  it('flags borderline scores (6-7)', () => {
    const call = createMockCall({ composite_score: 6.5 });
    const result = shouldFlagForReview(call);
    expect(result.flagged).toBe(true);
    expect(result.reason).toContain('Borderline');
  });

  it('flags long calls without meeting', () => {
    const call = createMockCall({
      call_duration_sec: 600, // 10 minutes
      is_meeting: false,
    });
    const result = shouldFlagForReview(call);
    expect(result.flagged).toBe(true);
    expect(result.reason).toContain('Long conversation');
  });

  it('flags high composite but low interest', () => {
    const call = createMockCall({
      composite_score: 8,
      seller_interest_score: 2,
    });
    const result = shouldFlagForReview(call);
    expect(result.flagged).toBe(true);
    expect(result.reason).toContain('low interest');
  });

  it('does not flag normal calls', () => {
    const call = createMockCall({
      composite_score: 8,
      seller_interest_score: 7,
      call_duration_sec: 200, // Under 480s, not a long call
      is_meeting: true,
      is_connection: false, // Not a connection, so won't trigger "no next steps" flag
    });
    const result = shouldFlagForReview(call);
    expect(result.flagged).toBe(false);
  });
});

describe('getEnhancedScoreStatus', () => {
  it('returns Excellent for score >= 8', () => {
    const status = getEnhancedScoreStatus(8.5);
    expect(status.label).toBe('Excellent');
    expect(status.color).toContain('emerald');
  });

  it('returns Good for score >= 6', () => {
    const status = getEnhancedScoreStatus(6.5);
    expect(status.label).toBe('Good');
    expect(status.color).toContain('blue');
  });

  it('returns Fair for score >= 4', () => {
    const status = getEnhancedScoreStatus(5);
    expect(status.label).toBe('Fair');
    expect(status.color).toContain('amber');
  });

  it('returns Needs Work for score < 4', () => {
    const status = getEnhancedScoreStatus(3);
    expect(status.label).toBe('Needs Work');
    expect(status.color).toContain('red');
  });
});

describe('formatEnhancedScore', () => {
  it('formats score with 1 decimal', () => {
    expect(formatEnhancedScore(7.5)).toBe('7.5');
    expect(formatEnhancedScore(8)).toBe('8.0');
  });

  it('returns dash for null/undefined', () => {
    expect(formatEnhancedScore(null)).toBe('-');
  });
});
