// Utility functions for text processing

/**
 * Strip HTML tags from text and return clean readable content
 */
export function stripHtml(html: string | null): string {
  if (!html) return '';
  
  // Create a temporary element to parse HTML
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Get text content, which strips all HTML tags
  let text = doc.body.textContent || '';
  
  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/\n\s*\n/g, '\n') // Multiple newlines to single
    .trim();
  
  return text;
}

/**
 * Get confidence level based on sample size
 */
export function getConfidenceLevel(sampleSize: number): 'low' | 'medium' | 'high' {
  if (sampleSize >= 500) return 'high';
  if (sampleSize >= 200) return 'medium';
  return 'low';
}

/**
 * Get confidence label
 */
export function getConfidenceLabel(level: 'low' | 'medium' | 'high'): string {
  const labels = {
    low: 'Low Confidence',
    medium: 'Medium Confidence',
    high: 'High Confidence',
  };
  return labels[level];
}

/**
 * Get margin of error for a rate based on sample size (95% CI)
 */
export function getMarginOfError(rate: number, sampleSize: number): number {
  if (sampleSize === 0) return 0;
  // Standard error for a proportion: sqrt(p * (1-p) / n)
  const p = rate / 100;
  const se = Math.sqrt((p * (1 - p)) / sampleSize);
  // 95% CI = 1.96 * SE
  return se * 1.96 * 100;
}

/**
 * Detect email step from variant/campaign name
 */
export function detectEmailStep(name: string): string {
  const lower = name.toLowerCase();
  
  if (lower.includes('step 1') || lower.includes('step1') || lower.includes('first touch') || lower.includes('initial')) {
    return 'first_touch';
  }
  if (lower.includes('step 2') || lower.includes('step2') || lower.includes('follow-up 1') || lower.includes('followup 1')) {
    return 'follow_up_1';
  }
  if (lower.includes('step 3') || lower.includes('step3') || lower.includes('follow-up 2') || lower.includes('followup 2')) {
    return 'follow_up_2';
  }
  if (lower.includes('step 4') || lower.includes('step4') || lower.includes('step 5') || lower.includes('step5')) {
    return 'later_follow_up';
  }
  if (lower.includes('breakup') || lower.includes('break-up') || lower.includes('final')) {
    return 'breakup';
  }
  if (lower.includes('re:') || lower.includes('re-engagement')) {
    return 're_engagement';
  }
  
  // Check for "Step X" pattern
  const stepMatch = lower.match(/step\s*(\d+)/);
  if (stepMatch) {
    const stepNum = parseInt(stepMatch[1]);
    if (stepNum === 1) return 'first_touch';
    if (stepNum === 2) return 'follow_up_1';
    if (stepNum === 3) return 'follow_up_2';
    return 'later_follow_up';
  }
  
  return 'unknown';
}

export const STEP_LABELS: Record<string, string> = {
  first_touch: 'First Touch',
  follow_up_1: 'Follow-up 1',
  follow_up_2: 'Follow-up 2',
  later_follow_up: 'Later Follow-up',
  breakup: 'Breakup',
  re_engagement: 'Re-engagement',
  unknown: 'Unknown',
};

/**
 * Analyze why a template works based on its content
 */
export function analyzeWhyItWorks(
  subjectLine: string,
  bodyPreview: string | null,
  wordCount: number,
  personalizationVars: string[]
): string[] {
  const insights: string[] = [];
  const subject = subjectLine.toLowerCase();
  const body = (bodyPreview || '').toLowerCase();
  
  // Subject line analysis
  if (subject.includes('?')) {
    insights.push('Question subject creates curiosity');
  }
  if (subject.includes('{{first_name}}') || subject.includes('{{name}}')) {
    insights.push('Personalized subject line with name');
  }
  if (subjectLine.length < 50) {
    insights.push('Short subject line (mobile-friendly)');
  }
  if (subject.includes('re:')) {
    insights.push('Re: format mimics existing thread');
  }
  
  // Personalization analysis
  if (personalizationVars.length >= 3) {
    insights.push(`Heavy personalization (${personalizationVars.length} variables)`);
  } else if (personalizationVars.length > 0) {
    insights.push(`Uses ${personalizationVars.length} personalization variable(s)`);
  }
  
  // Body length analysis
  if (wordCount > 0 && wordCount <= 100) {
    insights.push('Concise copy respects reader time');
  } else if (wordCount <= 150) {
    insights.push('Optimal length for cold email');
  }
  
  // Body content analysis
  if (body.includes('%') || body.includes('x ') || /\d+\s*(hours?|days?|weeks?|months?)/.test(body)) {
    insights.push('Specific metrics/results included');
  }
  if (body.includes('similar') || body.includes('like yours') || body.includes('companies like')) {
    insights.push('Social proof with similar companies');
  }
  if (body.includes('tuesday') || body.includes('thursday') || body.includes('or')) {
    insights.push('Choice-based CTA reduces friction');
  }
  if (body.includes('would you be open') || body.includes('thoughts?')) {
    insights.push('Soft CTA lowers barrier');
  }
  if (body.includes('noticed') || body.includes('saw that') || body.includes('congrats')) {
    insights.push('Trigger-based opening shows research');
  }
  
  // Limit to top 4 insights
  return insights.slice(0, 4);
}
