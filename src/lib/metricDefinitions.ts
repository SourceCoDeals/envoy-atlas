/**
 * Centralized metric definitions for tooltips
 * Single source of truth for all metric explanations across dashboards
 */

export interface MetricDefinition {
  name: string;
  formula: string;
  description: string;
  benchmark?: string;
  dataSource?: string;
  dispositions?: string[];
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  // ============================================================================
  // EMAIL METRICS
  // ============================================================================
  
  emails_sent: {
    name: 'Emails Sent',
    formula: 'COUNT(emails)',
    description: 'Total number of emails sent from all campaigns in the selected period.',
    dataSource: 'NocoDB sync from SmartLead/Reply.io',
  },
  
  reply_rate: {
    name: 'Reply Rate',
    formula: '(Replied ÷ Delivered) × 100',
    description: 'Percentage of delivered emails that received a reply. Uses delivered (sent - bounced) as denominator for accuracy.',
    benchmark: '> 5% good, 2-5% average, < 2% needs work',
    dataSource: 'NocoDB campaign totals',
  },
  
  positive_reply_rate: {
    name: 'Positive Reply Rate',
    formula: '(Positive Replies ÷ Delivered) × 100',
    description: 'Percentage of delivered emails that received an interested/meeting reply. Positive = "interested" or "meeting_request" categories.',
    benchmark: '> 2% excellent, 1-2% good, < 1% needs work',
    dataSource: 'NocoDB leads_interested field',
  },
  
  meeting_booked_rate: {
    name: 'Meeting Booked Rate',
    formula: '(Meetings ÷ Delivered) × 100',
    description: 'Percentage of delivered emails that resulted in a booked meeting.',
    benchmark: '> 1% excellent, 0.5-1% good',
    dataSource: 'campaigns.total_meetings',
  },
  
  bounce_rate: {
    name: 'Bounce Rate',
    formula: '(Bounced ÷ Sent) × 100',
    description: 'Percentage of sent emails that bounced. High bounce rates indicate list quality issues.',
    benchmark: '< 2% good, 2-5% warning, > 5% critical',
    dataSource: 'NocoDB campaign totals',
  },
  
  open_rate: {
    name: 'Open Rate',
    formula: '(Opened ÷ Delivered) × 100',
    description: 'Percentage of delivered emails that were opened. Note: Open tracking is increasingly unreliable due to privacy features.',
    benchmark: '> 50% good, 30-50% average',
    dataSource: 'Platform open tracking',
  },
  
  // ============================================================================
  // CALLING FUNNEL METRICS
  // ============================================================================
  
  dials: {
    name: 'Dials',
    formula: 'COUNT(calls)',
    description: 'Total number of call attempts made in the selected period.',
    dataSource: 'cold_calls table',
  },
  
  connects: {
    name: 'Connects',
    formula: 'calls WHERE talk_duration > 30s OR is_connection = true',
    description: 'Calls where a human answered and spoke for at least 30 seconds.',
    benchmark: '25-35% of dials',
    dispositions: ['connection', 'meeting booked', 'callback', 'send email', 'not interested'],
  },
  
  connect_rate: {
    name: 'Connect Rate',
    formula: '(Connects ÷ Dials) × 100',
    description: 'Percentage of dials that resulted in speaking with a human. A connection requires talk_duration > 30 seconds.',
    benchmark: '25-35% good, < 20% check data quality',
  },
  
  completed: {
    name: 'Completed Calls',
    formula: 'calls WHERE is_connection = true AND NOT hung_up_early',
    description: 'Connections where the full conversation was completed (not hung up early).',
  },
  
  meetings: {
    name: 'Meetings',
    formula: 'calls WHERE is_meeting = true',
    description: 'Calls that resulted in a meeting being scheduled.',
    benchmark: '3-5% of completed calls',
  },
  
  meeting_rate: {
    name: 'Meeting Rate',
    formula: '(Meetings ÷ Completed) × 100',
    description: 'Percentage of completed conversations that converted to meetings.',
    benchmark: '> 5% excellent, 3-5% good',
  },
  
  activated: {
    name: 'Activated',
    formula: 'calls WHERE seller_interest_score ≥ threshold',
    description: 'Contacts showing willingness to sell based on AI analysis of call content.',
    benchmark: 'Configurable via workspace settings',
  },
  
  talk_time: {
    name: 'Talk Time',
    formula: 'SUM(talk_duration)',
    description: 'Total time spent in actual conversations (excludes ring time, voicemails).',
  },
  
  avg_talk_time: {
    name: 'Avg Talk Time',
    formula: 'SUM(talk_duration) ÷ Connects',
    description: 'Average conversation duration per connected call.',
    benchmark: '2-5 minutes optimal for cold calls',
  },
  
  // ============================================================================
  // AI SCORE METRICS
  // ============================================================================
  
  composite_score: {
    name: 'Composite Score',
    formula: 'AVG(interest, quality, objection, value, script, dm, referral)',
    description: 'Weighted average of 7 AI-scored dimensions on a 1-10 scale. Evaluates overall call quality.',
    benchmark: '≥ 7 excellent, 5-6.9 good, < 5 needs coaching',
  },
  
  avg_score: {
    name: 'Average Score',
    formula: 'AVG(composite_score) across calls',
    description: 'Average AI quality score across all calls for a rep or period.',
    benchmark: '≥ 7 excellent, 5-6.9 good, < 5 needs coaching',
  },
  
  seller_interest: {
    name: 'Seller Interest Score',
    formula: 'AI analysis of call transcript',
    description: 'AI-assessed likelihood that the contact is willing to sell (1-10). Analyzes language, tone, and responses.',
    benchmark: '≥ 7 hot lead, 5-6 warm, < 5 cold',
  },
  
  quality_of_conversation: {
    name: 'Conversation Quality',
    formula: 'AI analysis of rapport, discovery, engagement',
    description: 'How well the rep built rapport and conducted discovery. Measures engagement quality.',
    benchmark: '≥ 7 excellent, 5-6.9 good, < 5 needs coaching',
  },
  
  objection_handling: {
    name: 'Objection Handling',
    formula: 'AI analysis of objection responses',
    description: 'How effectively the rep addressed objections raised during the call.',
    benchmark: '≥ 7 excellent, 5-6.9 good, < 5 needs coaching',
  },
  
  value_proposition: {
    name: 'Value Proposition',
    formula: 'AI analysis of value communication',
    description: 'How clearly and compellingly the rep communicated the value proposition.',
    benchmark: '≥ 7 excellent, 5-6.9 good, < 5 needs coaching',
  },
  
  script_adherence: {
    name: 'Script Adherence',
    formula: 'AI analysis of script compliance',
    description: 'How well the rep followed the approved call script and talking points.',
    benchmark: '≥ 7 excellent, 5-6.9 good, < 5 needs coaching',
  },
  
  // ============================================================================
  // INTEREST BREAKDOWN
  // ============================================================================
  
  interest_yes: {
    name: 'YES (Hot)',
    formula: 'calls WHERE conversation_outcome IN positive_values',
    description: 'Contacts actively interested in selling. Configured via workspace settings.',
    dispositions: ['interested', 'meeting booked', 'callback requested'],
  },
  
  interest_maybe: {
    name: 'MAYBE (Warm)',
    formula: 'calls WHERE outcome suggests potential interest',
    description: 'Contacts showing some interest but not ready to commit.',
    dispositions: ['timing', 'needs info', 'follow up'],
  },
  
  interest_no: {
    name: 'NO (Cold)',
    formula: 'calls WHERE outcome explicitly negative',
    description: 'Contacts not interested in selling at this time.',
    dispositions: ['not interested', 'do not call'],
  },
  
  interest_unknown: {
    name: 'UNKNOWN',
    formula: 'calls WHERE outcome not classified',
    description: 'Calls without enough information to determine interest level.',
  },
  
  // ============================================================================
  // DISPOSITION CATEGORIES
  // ============================================================================
  
  positive_outcomes: {
    name: 'Positive Outcomes',
    formula: 'COUNT(positive dispositions)',
    description: 'Calls resulting in meetings, callbacks, or positive interest.',
    dispositions: ['meeting booked', 'callback requested', 'send email', 'interested'],
  },
  
  contact_made: {
    name: 'Contact Made',
    formula: 'COUNT(contact made dispositions)',
    description: 'Calls where contact was made but outcome was neutral/negative.',
    dispositions: ['receptionist', 'gatekeeper', 'not interested', 'hung up'],
  },
  
  no_contact: {
    name: 'No Contact',
    formula: 'COUNT(no contact dispositions)',
    description: 'Calls where no human contact was made.',
    dispositions: ['voicemail', 'no answer', 'busy'],
  },
  
  data_issues: {
    name: 'Data Issues',
    formula: 'COUNT(bad data dispositions)',
    description: 'Calls where phone number was incorrect or disconnected.',
    dispositions: ['bad phone', 'wrong number', 'disconnected', 'do not call'],
  },
  
  // ============================================================================
  // CALLER PERFORMANCE METRICS
  // ============================================================================
  
  caller_calls: {
    name: 'Calls',
    formula: 'COUNT(calls by rep)',
    description: 'Total call attempts made by this rep in the period.',
  },
  
  caller_connects: {
    name: 'Connects',
    formula: 'COUNT(connects by rep)',
    description: 'Number of calls where rep spoke with a human (talk_duration > 30s).',
  },
  
  caller_connect_rate: {
    name: 'Connect Rate',
    formula: '(Connects ÷ Calls) × 100',
    description: 'Percentage of this rep\'s calls that resulted in connections.',
    benchmark: '25-35% good, < 20% below average',
  },
  
  caller_meetings: {
    name: 'Meetings',
    formula: 'COUNT(meetings by rep)',
    description: 'Meetings booked by this rep.',
  },
  
  caller_meeting_rate: {
    name: 'Meeting Rate',
    formula: '(Meetings ÷ Connects) × 100',
    description: 'Percentage of connections that converted to meetings for this rep.',
    benchmark: '> 5% excellent, 3-5% good',
  },
  
  caller_positive_pct: {
    name: 'Positive %',
    formula: '((Meetings + Activated) ÷ Connects) × 100',
    description: 'Percentage of connections with positive outcomes (meetings or activated leads).',
    benchmark: '> 60% top performer, 50-60% on track',
  },
  
  caller_status: {
    name: 'Status',
    formula: 'Based on score, positive%, meeting rate',
    description: 'Performance classification: Top Performer (score≥7, positive≥60%, meeting≥4%), On Track (score≥6, positive≥50%), Below Avg, Needs Review.',
  },
  
  // ============================================================================
  // ENGAGEMENT DASHBOARD METRICS
  // ============================================================================
  
  engagement_emails: {
    name: 'Emails',
    formula: 'SUM(campaign.total_emails_sent)',
    description: 'Total emails sent across all campaigns linked to this engagement.',
    dataSource: 'NocoDB SmartLead/Reply.io sync',
  },
  
  engagement_replies: {
    name: 'Replies',
    formula: 'SUM(campaign.total_replies)',
    description: 'Total replies received across all linked campaigns.',
    dataSource: 'NocoDB campaign totals',
  },
  
  engagement_positive_replies: {
    name: '+Replies',
    formula: 'SUM(campaign.leads_interested)',
    description: 'Positive/interested replies across linked campaigns.',
    dataSource: 'NocoDB leads_interested field',
  },
  
  engagement_calls: {
    name: 'Calls',
    formula: 'COUNT(call_activities) + COUNT(cold_calls)',
    description: 'Total call attempts associated with this engagement.',
  },
  
  engagement_meetings: {
    name: 'Meetings',
    formula: 'COUNT(meetings) + SUM(campaign.total_meetings)',
    description: 'Meetings booked from both email and calling activities.',
  },
  
  // ============================================================================
  // PULSE/TODAY METRICS
  // ============================================================================
  
  today_emails_sending: {
    name: 'Emails Sending',
    formula: 'COUNT(emails sent today)',
    description: 'Emails sent or scheduled to send today across all active campaigns.',
  },
  
  today_replies: {
    name: 'Replies',
    formula: 'COUNT(replies received today)',
    description: 'Reply emails received today.',
  },
  
  today_positive: {
    name: 'Positive',
    formula: 'COUNT(positive replies today)',
    description: 'Interested/meeting replies received today.',
  },
  
  today_meetings_booked: {
    name: 'Meetings Booked',
    formula: 'COUNT(meetings booked today)',
    description: 'New meetings scheduled today from any channel.',
  },
  
  active_campaigns: {
    name: 'Active Campaigns',
    formula: 'COUNT(campaigns WHERE status = active)',
    description: 'Number of campaigns currently sending emails.',
  },
  
  // ============================================================================
  // DATA INSIGHTS METRICS
  // ============================================================================
  
  best_time_to_call: {
    name: 'Best Time to Call',
    formula: 'Hour with highest connect rate',
    description: 'Optimal calling hour based on historical connection rates. All times in Eastern Time (DST-aware). Only business hours (8 AM - 7 PM ET) shown.',
    dataSource: 'nocodb_created_at timestamp analysis',
  },
  
  hourly_connects: {
    name: 'Hourly Connects',
    formula: 'COUNT(connects) grouped by hour',
    description: 'Number of connections made during each hour. Color intensity indicates relative performance.',
  },
};

/**
 * Get metric definition by key
 */
export const getMetricDefinition = (key: string): MetricDefinition | undefined => {
  return METRIC_DEFINITIONS[key];
};

/**
 * Get multiple metric definitions
 */
export const getMetricDefinitions = (keys: string[]): Record<string, MetricDefinition> => {
  const result: Record<string, MetricDefinition> = {};
  for (const key of keys) {
    const def = METRIC_DEFINITIONS[key];
    if (def) result[key] = def;
  }
  return result;
};
