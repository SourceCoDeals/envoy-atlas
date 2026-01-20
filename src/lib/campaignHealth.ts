/**
 * Campaign Health Score Calculator
 * Generates a 0-100 score based on deliverability, reply rate, positive rate, and sample size
 */

export interface CampaignHealthInput {
  bounce_rate: number;
  reply_rate: number;
  positive_rate: number;
  total_sent: number;
  open_rate?: number;
  status?: string;
}

export interface CampaignHealthResult {
  score: number;
  breakdown: {
    deliverability: number;
    replyRate: number;
    positiveRate: number;
    sampleSize: number;
  };
  level: 'excellent' | 'good' | 'warning' | 'critical';
  issues: string[];
}

/**
 * Calculate campaign health score (0-100)
 * 
 * Scoring breakdown:
 * - Deliverability (30 points): Based on bounce rate
 * - Reply Rate (35 points): Based on reply percentage
 * - Positive Rate (20 points): Based on positive reply percentage
 * - Sample Size (15 points): Based on total emails sent
 */
export function calculateCampaignHealthScore(campaign: CampaignHealthInput): CampaignHealthResult {
  const issues: string[] = [];
  
  // Deliverability (30 points) - Based on bounce rate
  let deliverability = 0;
  if (campaign.bounce_rate <= 2) {
    deliverability = 30;
  } else if (campaign.bounce_rate <= 5) {
    deliverability = 20;
    issues.push('Bounce rate slightly elevated');
  } else if (campaign.bounce_rate <= 10) {
    deliverability = 10;
    issues.push('High bounce rate damaging sender reputation');
  } else {
    deliverability = 0;
    issues.push('Critical bounce rate - clean your list immediately');
  }

  // Reply Rate (35 points) - Based on reply percentage
  let replyRate = 0;
  if (campaign.reply_rate >= 3) {
    replyRate = 35;
  } else if (campaign.reply_rate >= 2) {
    replyRate = 25;
    issues.push('Reply rate below 3% benchmark');
  } else if (campaign.reply_rate >= 1) {
    replyRate = 15;
    issues.push('Low reply rate - review messaging');
  } else if (campaign.reply_rate > 0) {
    replyRate = 5;
    issues.push('Very low reply rate - messaging not resonating');
  } else {
    replyRate = 0;
  }

  // Positive Rate (20 points) - Based on positive reply percentage
  let positiveRate = 0;
  if (campaign.positive_rate >= 1) {
    positiveRate = 20;
  } else if (campaign.positive_rate >= 0.5) {
    positiveRate = 15;
    issues.push('Positive rate could be improved');
  } else if (campaign.positive_rate > 0) {
    positiveRate = 10;
    issues.push('Low positive reply rate');
  } else {
    positiveRate = 0;
  }

  // Sample Size (15 points) - Based on total emails sent
  let sampleSize = 0;
  if (campaign.total_sent >= 1000) {
    sampleSize = 15;
  } else if (campaign.total_sent >= 500) {
    sampleSize = 10;
  } else if (campaign.total_sent >= 100) {
    sampleSize = 5;
    issues.push('Limited sample size for reliable metrics');
  } else {
    sampleSize = 0;
    issues.push('Insufficient data for reliable scoring');
  }

  const score = deliverability + replyRate + positiveRate + sampleSize;

  // Determine health level
  let level: CampaignHealthResult['level'];
  if (score >= 70) {
    level = 'excellent';
  } else if (score >= 50) {
    level = 'good';
  } else if (score >= 30) {
    level = 'warning';
  } else {
    level = 'critical';
  }

  return {
    score,
    breakdown: {
      deliverability,
      replyRate,
      positiveRate,
      sampleSize,
    },
    level,
    issues,
  };
}

/**
 * Generate action items from campaign data
 */
export interface CampaignActionItem {
  type: 'warning' | 'opportunity' | 'info';
  title: string;
  description: string;
  campaignId: string;
  campaignName: string;
  actionLabel: string;
  actionLink: string;
  priority: number; // 1 = highest
}

export function generateCampaignActions(
  campaigns: Array<CampaignHealthInput & { id: string; name: string; status: string }>
): CampaignActionItem[] {
  const actions: CampaignActionItem[] = [];

  for (const campaign of campaigns) {
    // Skip inactive campaigns
    const isActive = ['active', 'running', 'started'].includes(campaign.status.toLowerCase());
    if (!isActive) continue;

    // High bounce rate warning
    if (campaign.bounce_rate > 5) {
      actions.push({
        type: 'warning',
        title: `High bounce rate on ${campaign.name}`,
        description: `${campaign.bounce_rate.toFixed(1)}% bounce rate - check list quality and remove invalid emails`,
        campaignId: campaign.id,
        campaignName: campaign.name,
        actionLabel: 'View Campaign',
        actionLink: `/campaigns/${campaign.id}`,
        priority: 1,
      });
    }

    // High opens but low replies (CTA problem)
    if ((campaign.open_rate || 0) > 40 && campaign.reply_rate < 1) {
      actions.push({
        type: 'opportunity',
        title: `${campaign.name} has engagement but low replies`,
        description: `${(campaign.open_rate || 0).toFixed(0)}% opens but only ${campaign.reply_rate.toFixed(1)}% replies - try a different CTA`,
        campaignId: campaign.id,
        campaignName: campaign.name,
        actionLabel: 'View Copy Insights',
        actionLink: '/copy-insights',
        priority: 2,
      });
    }

    // Low positive rate relative to replies
    if (campaign.reply_rate >= 2 && campaign.positive_rate < 0.3) {
      actions.push({
        type: 'info',
        title: `${campaign.name}: replies not converting to positives`,
        description: `${campaign.reply_rate.toFixed(1)}% replies but only ${campaign.positive_rate.toFixed(1)}% positive - review follow-up approach`,
        campaignId: campaign.id,
        campaignName: campaign.name,
        actionLabel: 'View Replies',
        actionLink: '/inbox',
        priority: 3,
      });
    }
  }

  // Sort by priority and limit to top 5
  return actions.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
