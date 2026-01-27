

# Multi-Part Dashboard Audit and Enhancement Plan

This plan addresses your five requests regarding reply rate consistency, campaigns table sorting, disposition simplification, and metric documentation.

---

## Part 1: Reply Rate Calculation Audit

### Current State Analysis

I found **inconsistent reply rate calculations** across the codebase. Here's what I discovered:

| Location | Denominator Used | Formula |
|----------|-----------------|---------|
| `useCampaigns.tsx` (SmartLead) | `delivered > 0 ? delivered : sent` | `replied / delivered` |
| `useCampaigns.tsx` (Reply.io) | `delivered` | `replied / delivered` |
| `useOverviewDashboard.tsx` | `sent` | `replied / sent` |
| `useEngagementReport.tsx` | `delivered` | `replied / delivered` |
| `useNocoDBCampaigns.tsx` | `delivered > 0 ? delivered : sent` | Inconsistent fallback |
| `src/lib/metrics.ts` | `sent` | `calculateReplyRate(sent, replied)` |
| `EnhancedCampaignTable.tsx` | Uses pre-computed `reply_rate` from hook | Varies by source |

### Recommended Standard

The industry-standard approach for **email reply rate** should use:

```text
Reply Rate = (Replies / Delivered) × 100
Where: Delivered = Sent - Bounced
```

This is the correct formula because:
- Bounced emails can't be replied to
- Using "sent" inflates the denominator unfairly for campaigns with high bounce rates
- It matches what SmartLead and Reply.io report in their UIs

### Changes Required

1. **Update `src/lib/metrics.ts`** - Add a new `calculateReplyRateFromDelivered` function and update documentation
2. **Update `useOverviewDashboard.tsx`** - Change hero metrics and weekly chart to use `delivered` as denominator
3. **Add documentation comment** in all calculation locations to enforce consistency
4. **Update Settings Metrics Reference** to reflect the correct formula

---

## Part 2: Campaigns Tab - Active Campaigns First

### Current State
The campaigns table in `useCampaigns.tsx` (lines 313-322) already sorts active campaigns first:

```typescript
const activeStatuses = ['active', 'started', 'running'];
allCampaigns.sort((a, b) => {
  const aIsActive = activeStatuses.includes(a.status.toLowerCase());
  const bIsActive = activeStatuses.includes(b.status.toLowerCase());
  if (aIsActive && !bIsActive) return -1;
  if (!aIsActive && bIsActive) return 1;
  return b.total_sent - a.total_sent;
});
```

### Issue Identified
However, `EnhancedCampaignTable.tsx` defaults to sorting by `score` (line 98):
```typescript
const [sortField, setSortField] = useState<SortField>('score');
```

This overrides the hook's sort order when users first load the page.

### Fix Required
Change the default sort field in `EnhancedCampaignTable.tsx` from `'score'` to `'name'` or add a "status" sort option that preserves the active-first ordering from the hook.

---

## Part 3: Cold Calls Disposition Breakdown Simplification

### Current Dispositions (15 categories)

From `src/lib/constants/dispositions.ts`:

| Category | Display Name | Connection? | Meeting? |
|----------|-------------|-------------|----------|
| receptionist | Receptionist | ✓ | |
| callback requested | Callback Requested | ✓ | ✓ |
| send email | Send Email | ✓ | |
| not qualified | Not Qualified | ✓ | |
| positive - blacklist co | Positive - Blacklist Co | ✓ | ✓ |
| negative - blacklist co | Negative - Blacklist Co | ✓ | |
| negative - blacklist contact | Negative - Blacklist Contact | ✓ | |
| hung up | Hung Up | ✓ | |
| meeting booked | Meeting Booked | ✓ | ✓ |
| voicemail | Voicemail | | |
| live voicemail | Live Voicemail | | |
| voicemail drop | Voicemail Drop | | |
| no answer | No Answer | | |
| bad phone | Bad Phone | | |
| wrong number | Wrong Number | | |
| do not call | Do Not Call | | |

### Proposed Simplified Categories (4 groups)

| Simplified Group | Color | Included Dispositions |
|-----------------|-------|----------------------|
| **Positive Outcomes** | Green | Meeting Booked, Callback Requested, Positive - Blacklist Co |
| **Contact Made** | Blue | Receptionist, Send Email, Not Qualified, Hung Up, Negative - Blacklist Co/Contact |
| **No Contact** | Gray | Voicemail, Live Voicemail, Voicemail Drop, No Answer |
| **Data Issues** | Red | Bad Phone, Wrong Number, Do Not Call |

### Pie Chart Changes

Replace the current detailed 9-slice pie chart in `DispositionPieChart.tsx` with a **simplified 4-slice donut chart** with a detailed breakdown table beside it.

---

## Part 4: Calling Dashboard Metric Calculations

### How Connections are Calculated

**Source:** `cold_calls.is_connection` flag (pre-computed during sync)

**Logic** (from `src/lib/constants/dispositions.ts`):
```text
Connection = TRUE when normalized_category matches:
- receptionist, callback requested, send email, not qualified
- positive/negative - blacklist co/contact
- hung up, meeting booked
```

Special case: `Voicemail Drop` is **never** counted as a connection, regardless of duration.

### How Completed Meetings are Calculated

**Source:** `cold_calls.is_meeting` flag (pre-computed during sync)

**Logic:**
```text
Meeting = TRUE when normalized_category matches:
- meeting booked
- callback requested  
- positive - blacklist co
```

### Funnel Metrics Display (from `FunnelMetrics.tsx`)

| Metric | Calculation |
|--------|-------------|
| Dials | Total calls in date range |
| Connects | `calls.filter(c => c.is_connection).length` |
| Completed | Same as Connects (approximate) |
| Meetings | `calls.filter(c => c.is_meeting).length` |
| Activated | Calls where `seller_interest_score >= 4` (maybe + yes) |
| Connect Rate | `(connections / totalCalls) × 100` |
| Meeting Rate | `(meetings / completed) × 100` |

---

## Part 5: Conversion Funnel Redesign (Data Insights Tab)

### Current State
The `ConversionFunnel.tsx` component uses horizontal progress bars, not a visual funnel shape.

### Proposed Changes
Replace with an actual **funnel visualization** using progressively narrower bars:
- Use trapezoid/funnel shape CSS
- Simplify to 4 stages: Dials → Connections → Quality Conversations → Meetings

---

## Part 6: Call Insights Metric Documentation

### How Each Score is Calculated

All scores are **AI-extracted** from call transcripts via the `score-external-calls` edge function. They are stored in the `cold_calls` table.

| Metric | Field | Scale | Calculation Method |
|--------|-------|-------|-------------------|
| **Overall Quality** | `composite_score` | 0-10 | Average of 7 AI dimensions |
| **Seller Interest** | `seller_interest_score` | 0-10 | AI analysis of prospect's selling intent |
| **Script Adherence** | `script_adherence_score` | 0-10 | How closely rep followed the script |
| **Objection Handling** | `objection_handling_score` | 0-10 | How well rep addressed concerns |
| **Conversation Quality** | `quality_of_conversation_score` | 0-10 | Overall flow and engagement |
| **Value Proposition** | `value_proposition_score` | 0-10 | Clarity of offer presented |
| **Rapport Building** | `rapport_building_score` | 0-10 | Connection established with prospect |
| **Next Steps Clarity** | `next_step_clarity_score` | 0-10 | Clear action items defined |

### Composite Score Formula
```text
composite_score = AVG(
  seller_interest_score,
  objection_handling_score, 
  script_adherence_score,
  quality_of_conversation_score,
  value_proposition_score,
  rapport_building_score,
  next_step_clarity_score
)
```

### Interest Classification (from `seller_interest_score`)
```text
Yes (Hot):    score >= 7
Maybe (Warm): score >= 4 and < 7  
No (Cold):    score < 4
```

---

## Technical Implementation Summary

### Files to Modify

1. **Reply Rate Consistency**
   - `src/lib/metrics.ts` - Add delivered-based reply rate function
   - `src/hooks/useOverviewDashboard.tsx` - Update hero metrics calculation
   - `src/components/settings/MetricsReferenceSection.tsx` - Update documentation

2. **Campaigns Table Sorting**
   - `src/components/campaigns/EnhancedCampaignTable.tsx` - Change default sort

3. **Disposition Pie Chart Simplification**
   - `src/components/calling/DispositionPieChart.tsx` - Simplify to 4 categories

4. **Conversion Funnel Redesign**
   - `src/components/datainsights/ConversionFunnel.tsx` - Create actual funnel shape

5. **Metrics Documentation**
   - Add inline documentation in `CallInsights.tsx`
   - Update Settings reference sections

### No Database Changes Required
All changes are frontend-only.

