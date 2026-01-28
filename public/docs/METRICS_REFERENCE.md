# ENVOY ATLAS - METRICS REFERENCE TABLE

## Single Source of Truth for All Metric Calculations

This document defines the **canonical formula** for every metric in Envoy Atlas. All code should reference these definitions to ensure consistency across the platform.

---

## 📧 EMAIL CAMPAIGN METRICS

| Metric | Formula | Denominator | Unit | Notes |
|--------|---------|-------------|------|-------|
| **Delivered** | `total_sent - total_bounced` | N/A | Count | Base for rate calculations |
| **Reply Rate** | `(total_replied / delivered) × 100` | Delivered | % | **Industry standard** - use delivered, not sent |
| **Positive Reply Rate** | `(positive_replies / delivered) × 100` | Delivered | % | Interested + meeting requests |
| **Bounce Rate** | `(total_bounced / total_sent) × 100` | Sent | % | Bounces happen before delivery |
| **Delivery Rate** | `(delivered / total_sent) × 100` | Sent | % | Should be 95%+ for healthy lists |
| **Meeting Booked Rate** | `(total_meetings / delivered) × 100` | Delivered | % | Meetings from email campaigns |
| **Open Rate** | `(total_opened / delivered) × 100` | Delivered | % | Less reliable due to tracking pixels |
| **Click Rate** | `(total_clicked / delivered) × 100` | Delivered | % | Clicks on links in emails |
| **Positive-to-Reply Ratio** | `(positive_replies / total_replied) × 100` | Replied | % | Quality indicator of replies |

### Email Metric Data Sources

| Field | Database Column | Source |
|-------|-----------------|--------|
| total_sent | `campaigns.total_sent` | SmartLead/Reply.io via NocoDB |
| total_replied | `campaigns.total_replied` | SmartLead/Reply.io via NocoDB |
| total_bounced | `campaigns.total_bounced` | SmartLead/Reply.io via NocoDB |
| positive_replies | `campaigns.positive_replies` | NocoDB `leads_interested` field |
| total_meetings | `campaigns.total_meetings` | Manual or NocoDB |
| total_opened | `campaigns.total_opens` | SmartLead/Reply.io (when available) |
| total_clicked | `campaigns.total_clicks` | SmartLead/Reply.io (when available) |

---

## 📞 COLD CALLING METRICS

| Metric | Formula | Denominator | Unit | Notes |
|--------|---------|-------------|------|-------|
| **Connect Rate** | `(connections / total_calls) × 100` | Total Calls | % | Calls where someone answered |
| **Conversation Rate** | `(conversations / total_calls) × 100` | Total Calls | % | Calls with meaningful dialogue (>180 sec) |
| **DM Conversation Rate** | `(dm_conversations / connections) × 100` | Connections | % | Decision makers reached |
| **Meeting Rate** | `(meetings / total_calls) × 100` | Total Calls | % | Meetings booked per dial |
| **Meeting Conversion** | `(meetings / conversations) × 100` | Conversations | % | Conversion from conversation to meeting |
| **Voicemail Rate** | `(voicemails / total_calls) × 100` | Total Calls | % | Calls that went to voicemail |
| **Bad Data Rate** | `(bad_data / total_calls) × 100` | Total Calls | % | Invalid numbers, wrong contacts |
| **Avg Call Duration** | `total_talk_time_sec / connections` | Connections | Seconds | Only connected calls count |

### Call Classification Rules

| Classification | Criteria | Database Field |
|----------------|----------|----------------|
| **Connection** | `talk_duration > 30` OR `disposition IN ('connected', 'conversation', 'dm_conversation')` | `cold_calls.is_connection` |
| **Conversation** | `talk_duration >= 180` OR `conversation_outcome NOT IN ('no_answer', 'voicemail', 'busy', 'wrong_number')` | `cold_calls.is_conversation` |
| **DM Conversation** | `is_dm_conversation = true` OR `normalized_category = 'DM Conversation'` | `cold_calls.is_dm_conversation` |
| **Meeting** | `is_meeting = true` OR `normalized_category = 'Meeting Set'` | `cold_calls.is_meeting` |
| **Voicemail** | `is_voicemail = true` OR `voicemail_left = true` OR `disposition = 'voicemail'` | `cold_calls.is_voicemail` |
| **Bad Data** | `is_bad_data = true` OR `normalized_category = 'Bad Data'` | `cold_calls.is_bad_data` |

### Call Metric Data Sources

| Field | Database Column | Source |
|-------|-----------------|--------|
| total_calls | COUNT(*) from `cold_calls` | PhoneBurner/NocoDB |
| connections | COUNT(*) WHERE `is_connection = true` | Calculated |
| conversations | COUNT(*) WHERE `is_conversation = true` | Calculated |
| dm_conversations | COUNT(*) WHERE `is_dm_conversation = true` | PhoneBurner |
| meetings | COUNT(*) WHERE `is_meeting = true` | PhoneBurner/Manual |
| voicemails | COUNT(*) WHERE `is_voicemail = true` | PhoneBurner |
| bad_data | COUNT(*) WHERE `is_bad_data = true` | PhoneBurner |
| talk_duration | `cold_calls.call_duration_sec` | PhoneBurner |

---

## 🤖 AI CALL SCORING METRICS

All AI scores are on a **0-10 scale** where:
- **0-3**: Poor / Needs improvement
- **4-6**: Average / Acceptable
- **7-10**: Good / Excellent

| Metric | Description | Score Range | Threshold: Hot Lead |
|--------|-------------|-------------|---------------------|
| **Composite Score** | Overall call quality (weighted average) | 0-10 | ≥7.0 |
| **Seller Interest Score** | Prospect's interest in selling | 0-10 | ≥7.0 (Hot Lead) |
| **Decision Maker Score** | Confirmed speaking with DM | 0-10 | ≥7.0 |
| **Objection Handling Score** | How well objections were addressed | 0-10 | ≥7.0 |
| **Script Adherence Score** | Following the call script | 0-10 | ≥6.0 |
| **Value Proposition Score** | Clarity of value communication | 0-10 | ≥7.0 |
| **Rapport Building Score** | Connection established with prospect | 0-10 | ≥6.0 |
| **Conversation Quality Score** | Overall quality of dialogue | 0-10 | ≥7.0 |
| **Gatekeeper Handling Score** | Navigating past gatekeepers | 0-10 | ≥6.0 |
| **Engagement Score** | Prospect engagement level | 0-10 | ≥7.0 |
| **Enhanced Score** | Weighted composite with business rules | 0-10 | ≥7.5 |

### Interest Classification (from seller_interest_score)

| Classification | Score Range | Description |
|----------------|-------------|-------------|
| **Yes (Hot Lead)** | ≥ 7.0 | Strong interest in selling |
| **Maybe (Warm Lead)** | 4.0 - 6.9 | Some interest, needs nurturing |
| **No (Cold)** | < 4.0 | Not interested |
| **Unknown** | null | Score not available |

### AI Score Data Sources

| Field | Database Column | Source |
|-------|-----------------|--------|
| composite_score | `cold_calls.composite_score` | AI scoring (score-call function) |
| seller_interest_score | `cold_calls.seller_interest_score` | AI scoring |
| decision_maker_identified_score | `cold_calls.decision_maker_identified_score` | AI scoring |
| objection_handling_score | `cold_calls.objection_handling_score` | AI scoring |
| script_adherence_score | `cold_calls.script_adherence_score` | AI scoring |
| value_proposition_score | `cold_calls.value_proposition_score` | AI scoring |
| rapport_building_score | `cold_calls.rapport_building_score` | AI scoring |
| quality_of_conversation_score | `cold_calls.quality_of_conversation_score` | AI scoring |
| gatekeeper_handling_score | `cold_calls.gatekeeper_handling_score` | AI scoring |
| engagement_score | `cold_calls.engagement_score` | AI scoring |
| enhanced_score | `cold_calls.enhanced_score` | Calculated with business rules |

---

## 📊 COPY/CONTENT ANALYTICS METRICS

| Metric | Formula | Denominator | Unit | Notes |
|--------|---------|-------------|------|-------|
| **Subject Line Reply Rate** | `(replied / sent_with_subject) × 100` | Sent | % | Per subject line variant |
| **Body Reply Rate** | `(replied / sent_with_body) × 100` | Sent | % | Per body copy variant |
| **Personalization Lift** | `(personalized_rate - baseline_rate) / baseline_rate × 100` | Baseline | % | Impact of personalization |
| **Question Impact** | `(question_rate - no_question_rate) / no_question_rate × 100` | No Question | % | Impact of questions in subject |

### Copy Feature Analysis

| Feature | Calculation | Recommended Range |
|---------|-------------|-------------------|
| Subject Length (chars) | `subject.length` | 30-60 chars |
| Subject Word Count | `subject.split(/\s+/).length` | 5-10 words |
| Body Word Count | `body.split(/\s+/).length` | 50-150 words |
| Body Sentence Count | `body.match(/[.!?]+/g).length` | 3-7 sentences |
| Body Paragraph Count | `body.split(/\n\n+/).length` | 2-4 paragraphs |
| Has Question | `subject.includes('?')` | Yes (improves engagement) |
| Has Personalization | `subject.includes('{{') OR body.includes('{{')` | Yes |
| Has Link | `body.includes('http')` | Depends on goal |

---

## 📈 DASHBOARD AGGREGATE METRICS

### Hero Metrics (7-day rolling)

| Metric | Formula | Data Source |
|--------|---------|-------------|
| **Total Emails Sent (7d)** | SUM of emails sent in last 7 days | `daily_metrics.emails_sent` |
| **Total Replies (7d)** | SUM of replies in last 7 days | `daily_metrics.emails_replied` |
| **Positive Replies (7d)** | SUM of positive replies in last 7 days | `daily_metrics.positive_replies` |
| **Meetings Booked (7d)** | SUM of meetings in last 7 days | `daily_metrics.meetings_booked` |
| **Reply Rate (7d)** | `(replies_7d / sent_7d) × 100` | Calculated |
| **Positive Reply Rate (7d)** | `(positive_7d / sent_7d) × 100` | Calculated |

### Week-over-Week Change

| Metric | Formula | Cap |
|--------|---------|-----|
| **WoW Change** | `((current_week - previous_week) / previous_week) × 100` | **±999%** |
| **Trend** | `current > previous ? 'up' : current < previous ? 'down' : 'neutral'` | N/A |

⚠️ **IMPORTANT**: WoW changes are capped at ±999% to prevent display issues from data anomalies.

---

## 🏥 CAMPAIGN HEALTH SCORE

| Factor | Weight | Scoring Logic |
|--------|--------|---------------|
| Reply Rate | 30% | >3%: 100, 2-3%: 75, 1-2%: 50, <1%: 25 |
| Positive Rate | 25% | >1%: 100, 0.5-1%: 75, 0.25-0.5%: 50, <0.25%: 25 |
| Bounce Rate | 20% | <2%: 100, 2-5%: 75, 5-10%: 50, >10%: 25 |
| Activity (7d) | 15% | Recent sends: 100, None: 0 |
| Data Freshness | 10% | <24h: 100, 24-72h: 75, >72h: 50 |

**Health Score** = Σ (Factor Score × Weight)

| Score Range | Status | Action |
|-------------|--------|--------|
| 80-100 | Healthy | Maintain current approach |
| 60-79 | Warning | Review and optimize |
| 40-59 | At Risk | Immediate attention needed |
| 0-39 | Critical | Pause and diagnose |

---

## ⚠️ DATA QUALITY INDICATORS

### Freshness Thresholds

| Status | Hours Since Sync | Indicator |
|--------|------------------|-----------|
| **Fresh** | < 24 hours | ✅ Green |
| **Stale** | 24-72 hours | ⚠️ Yellow |
| **Critical** | > 72 hours | 🔴 Red |

### Estimated vs. Actual Data

| Data Type | Indicator | Notes |
|-----------|-----------|-------|
| **Actual** | `is_estimated = false` | Direct from API with timestamps |
| **Estimated** | `is_estimated = true` | Distributed from aggregate totals |

When `is_estimated = true`, daily breakdowns are synthetic distributions of campaign totals - actual reply dates may vary.

---

## 🔧 IMPLEMENTATION REFERENCE

### TypeScript Helper Functions

All rate calculations should use the centralized functions in `src/lib/metrics.ts`:

```typescript
// CORRECT - Use centralized functions
import { calculateRate, calculateDelivered } from '@/lib/metrics';

const delivered = calculateDelivered(total_sent, total_bounced);
const replyRate = calculateRate(total_replied, delivered);
const bounceRate = calculateRate(total_bounced, total_sent);

// INCORRECT - Don't calculate inline
const replyRate = (total_replied / total_sent) * 100; // ❌ Wrong denominator
const replyRate = total_replied / delivered * 100;    // ❌ Missing null checks
```

### Safe Division Pattern

Always use safe division to prevent NaN/Infinity:

```typescript
const safeDivide = (num: number, den: number): number => {
  if (den === 0 || !isFinite(den)) return 0;
  const result = num / den;
  return isFinite(result) ? result : 0;
};
```

### WoW Change with Cap

```typescript
const calculateWoWChange = (current: number, previous: number) => {
  if (previous === 0) return { change: 0, trend: 'neutral' };
  
  const pctChange = ((current - previous) / previous) * 100;
  const cappedChange = Math.min(Math.abs(pctChange), 999); // Cap at 999%
  
  return {
    change: cappedChange,
    trend: pctChange > 1 ? 'up' : pctChange < -1 ? 'down' : 'neutral',
  };
};
```

---

## 📋 METRIC CONSISTENCY CHECKLIST

Before adding or modifying any metric calculation:

- [ ] Check this document for the canonical formula
- [ ] Use `calculateRate()` from `src/lib/metrics.ts`
- [ ] Use correct denominator (delivered for reply rates, sent for bounce rates)
- [ ] Handle null/undefined values with `?? 0`
- [ ] Cap WoW changes at ±999%
- [ ] Add `is_estimated` flag if using synthetic data
- [ ] Update this document if adding new metrics

---

## 🔄 REVISION HISTORY

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-28 | 1.0 | Initial metrics reference created |

---

**Owner**: Engineering Team  
**Last Updated**: January 28, 2026  
**Status**: Active - Single Source of Truth
