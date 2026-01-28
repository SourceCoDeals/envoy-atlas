import { describe, it, expect } from 'vitest';
import {
  calculateRate,
  calculateRateDecimal,
  calculateReplyRate,
  calculateReplyRateFromDelivered,
  calculateDelivered,
  calculateBounceRate,
  calculateOpenRate,
  calculateWoWChange,
  formatRate,
  formatNumber,
  isPositiveReply,
  isNegativeReply,
  isConnection,
  isVoicemail,
  isPositiveCallOutcome,
  validateMetricsConsistency,
  calculateCallConnectRate,
  calculateMeetingConversion,
} from '../metrics';

describe('calculateRate', () => {
  it('returns 0 when denominator is 0', () => {
    expect(calculateRate(10, 0)).toBe(0);
  });

  it('returns 0 when denominator is null', () => {
    expect(calculateRate(10, null)).toBe(0);
  });

  it('returns 0 when denominator is undefined', () => {
    expect(calculateRate(10, undefined)).toBe(0);
  });

  it('calculates percentage correctly', () => {
    expect(calculateRate(25, 100)).toBe(25);
  });

  it('handles null numerator as 0', () => {
    expect(calculateRate(null, 100)).toBe(0);
  });

  it('handles undefined numerator as 0', () => {
    expect(calculateRate(undefined, 100)).toBe(0);
  });

  it('calculates decimals correctly', () => {
    expect(calculateRate(1, 3)).toBeCloseTo(33.33, 1);
  });
});

describe('calculateRateDecimal', () => {
  it('returns decimal instead of percentage', () => {
    expect(calculateRateDecimal(25, 100)).toBe(0.25);
  });

  it('returns 0 for zero division', () => {
    expect(calculateRateDecimal(10, 0)).toBe(0);
  });
});

describe('calculateDelivered', () => {
  it('calculates sent minus bounced', () => {
    expect(calculateDelivered(1000, 50)).toBe(950);
  });

  it('returns 0 when bounced exceeds sent', () => {
    expect(calculateDelivered(100, 150)).toBe(0);
  });

  it('handles null values', () => {
    expect(calculateDelivered(null, 50)).toBe(0);
    expect(calculateDelivered(100, null)).toBe(100);
  });
});

describe('calculateReplyRateFromDelivered', () => {
  it('calculates reply rate using delivered as denominator', () => {
    // 50 replies out of 950 delivered = 5.26%
    expect(calculateReplyRateFromDelivered(950, 50)).toBeCloseTo(5.26, 1);
  });

  it('returns 0 when no delivered', () => {
    expect(calculateReplyRateFromDelivered(0, 10)).toBe(0);
  });
});

describe('calculateReplyRate (legacy)', () => {
  it('calculates reply rate using sent as denominator', () => {
    // 50 replies out of 1000 sent = 5%
    expect(calculateReplyRate(1000, 50)).toBe(5);
  });
});

describe('calculateBounceRate', () => {
  it('calculates bounce rate correctly', () => {
    expect(calculateBounceRate(1000, 30)).toBe(3);
  });

  it('returns 0 for no bounces', () => {
    expect(calculateBounceRate(1000, 0)).toBe(0);
  });
});

describe('calculateOpenRate', () => {
  it('calculates open rate correctly', () => {
    expect(calculateOpenRate(1000, 450)).toBe(45);
  });
});

describe('calculateWoWChange', () => {
  it('calculates positive change correctly', () => {
    expect(calculateWoWChange(150, 100)).toBe(50);
  });

  it('calculates negative change correctly', () => {
    expect(calculateWoWChange(80, 100)).toBe(-20);
  });

  it('returns 0 when previous is 0 and current is 0', () => {
    expect(calculateWoWChange(0, 0)).toBe(0);
  });

  it('caps at 999% for extreme increases', () => {
    expect(calculateWoWChange(10000, 1)).toBe(999);
  });

  it('caps at -999% for extreme decreases', () => {
    // This shouldn't happen mathematically but test the guard
    expect(calculateWoWChange(-10000, 1)).toBe(-999);
  });

  it('handles previous = 0 with positive current', () => {
    // When previous is 0 and current > 0, should cap at 999
    expect(calculateWoWChange(100, 0)).toBe(999);
  });
});

describe('formatRate', () => {
  it('formats rate with default 1 decimal', () => {
    expect(formatRate(12.5678)).toBe('12.6%');
  });

  it('formats with custom decimals', () => {
    expect(formatRate(12.5678, 2)).toBe('12.57%');
  });

  it('handles null/undefined', () => {
    expect(formatRate(null)).toBe('0%');
    expect(formatRate(undefined)).toBe('0%');
  });
});

describe('formatNumber', () => {
  it('formats thousands with K suffix', () => {
    expect(formatNumber(1500)).toBe('1.5K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1500000)).toBe('1.5M');
  });

  it('formats small numbers normally', () => {
    expect(formatNumber(999)).toBe('999');
  });

  it('handles null/undefined', () => {
    expect(formatNumber(null)).toBe('0');
    expect(formatNumber(undefined)).toBe('0');
  });
});

describe('Reply Classification', () => {
  describe('isPositiveReply', () => {
    it('returns true for meeting_request', () => {
      expect(isPositiveReply('meeting_request')).toBe(true);
    });

    it('returns true for interested', () => {
      expect(isPositiveReply('interested')).toBe(true);
    });

    it('returns false for not_interested', () => {
      expect(isPositiveReply('not_interested')).toBe(false);
    });

    it('handles null/undefined', () => {
      expect(isPositiveReply(null)).toBe(false);
      expect(isPositiveReply(undefined)).toBe(false);
    });
  });

  describe('isNegativeReply', () => {
    it('returns true for not_interested', () => {
      expect(isNegativeReply('not_interested')).toBe(true);
    });

    it('returns true for unsubscribe', () => {
      expect(isNegativeReply('unsubscribe')).toBe(true);
    });

    it('returns false for interested', () => {
      expect(isNegativeReply('interested')).toBe(false);
    });
  });
});

describe('Call Classification', () => {
  describe('isConnection', () => {
    it('returns true for connected disposition', () => {
      expect(isConnection('connected')).toBe(true);
    });

    it('returns true for conversation', () => {
      expect(isConnection('conversation')).toBe(true);
    });

    it('returns false for voicemail', () => {
      expect(isConnection('voicemail')).toBe(false);
    });

    it('handles null/undefined', () => {
      expect(isConnection(null)).toBe(false);
    });
  });

  describe('isVoicemail', () => {
    it('returns true for voicemail', () => {
      expect(isVoicemail('voicemail')).toBe(true);
    });

    it('returns true for vm', () => {
      expect(isVoicemail('vm')).toBe(true);
    });

    it('returns false for connected', () => {
      expect(isVoicemail('connected')).toBe(false);
    });
  });

  describe('isPositiveCallOutcome', () => {
    it('returns true for meeting_booked', () => {
      expect(isPositiveCallOutcome('meeting_booked')).toBe(true);
    });

    it('returns true for interested', () => {
      expect(isPositiveCallOutcome('interested')).toBe(true);
    });

    it('returns true for callback', () => {
      expect(isPositiveCallOutcome('callback')).toBe(true);
    });

    it('returns false for not interested', () => {
      expect(isPositiveCallOutcome('not_interested')).toBe(false);
    });
  });
});

describe('Cold Calling Metrics', () => {
  describe('calculateCallConnectRate', () => {
    it('calculates connect rate correctly', () => {
      // 30 connections out of 100 calls = 30%
      expect(calculateCallConnectRate(100, 30)).toBe(30);
    });

    it('returns 0 for no calls', () => {
      expect(calculateCallConnectRate(0, 10)).toBe(0);
    });
  });

  describe('calculateMeetingConversion', () => {
    it('calculates meeting conversion from conversations', () => {
      // 5 meetings from 25 conversations = 20%
      expect(calculateMeetingConversion(25, 5)).toBe(20);
    });

    it('returns 0 for no conversations', () => {
      expect(calculateMeetingConversion(0, 5)).toBe(0);
    });
  });
});

describe('validateMetricsConsistency', () => {
  it('returns valid for consistent metrics', () => {
    const result = validateMetricsConsistency({
      sent: 1000,
      delivered: 950,
      bounced: 50,
      opened: 400,
      replied: 50,
    });
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects when delivered + bounced exceeds sent', () => {
    const result = validateMetricsConsistency({
      sent: 100,
      delivered: 100,
      bounced: 50,
      opened: 40,
      replied: 10,
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Delivered + bounced exceeds sent count');
  });

  it('detects high bounce rate', () => {
    const result = validateMetricsConsistency({
      sent: 1000,
      delivered: 800,
      bounced: 200, // 20% bounce rate
      opened: 300,
      replied: 20,
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Bounce rate exceeds 10% threshold');
  });
});
