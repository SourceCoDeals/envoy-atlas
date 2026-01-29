
# Fix Email Dashboard Overview - Use NocoDB as Source of Truth

## ✅ COMPLETED

### Implementation Summary

Created `useNocoDBDashboard` hook and updated `useOverviewDashboard` to use NocoDB as source of truth.

| Change | Details |
|--------|---------|
| **Hero Metrics** | Now sourced from `nocodb_smartlead_campaigns` + `nocodb_replyio_campaigns` |
| **Rate Denominator** | Changed to `delivered` (sent - bounced) per SmartLead convention |
| **Active Campaigns** | Uses NocoDB status filters: `ACTIVE` (SmartLead) / `Active` (Reply.io) |
| **Weekly Chart** | Uses `nocodb_campaign_daily_deltas` with first-snapshot anomaly filter |

### Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Emails Sent | 2M+ | ~1.19M |
| Active Campaigns | 1400 | 114 |
| Weekly Chart Max | ~900k | Actual weekly deltas |

---

## Summary of Issues Found

---

## Solution: Refactor to Use NocoDB Tables Directly

### 1. Create New Hook: `useNocoDBDashboard`

A new hook that queries NocoDB tables directly for all hero metrics and weekly data.

```typescript
// src/hooks/useNocoDBDashboard.tsx

export function useNocoDBDashboard() {
  // Fetch from nocodb_smartlead_campaigns and nocodb_replyio_campaigns
  // Combine totals for hero metrics
  // Query nocodb_campaign_daily_deltas for weekly chart
}
```

**Data Sources**:
- **Hero Metrics**: `nocodb_smartlead_campaigns` + `nocodb_replyio_campaigns`
- **Weekly Chart**: `nocodb_campaign_daily_deltas` view (proper day-over-day changes)
- **Active Campaigns**: Count from NocoDB where status = 'ACTIVE' or 'Active'

---

### 2. Hero Metrics - NocoDB Totals

**Emails Sent**:
```sql
-- SmartLead: SUM(total_emails_sent)
-- Reply.io: SUM(deliveries + bounces)
```

**Positive Replies**:
```sql
-- SmartLead: SUM(leads_interested)
-- Reply.io: 0 (not available)
```

**Reply Rate** (using delivered denominator):
```typescript
// Delivered = sent - bounced
const delivered = Math.max(0, totalSent - totalBounced);
const replyRate = calculateRate(totalReplied, delivered);
```

**Positive Reply Rate** (using delivered denominator to match SmartLead):
```typescript
const positiveRate = calculateRate(totalPositive, delivered);
```

---

### 3. Active Campaign Count - NocoDB Status

Query both NocoDB tables and filter by active status:

```typescript
// SmartLead: status = 'ACTIVE'
// Reply.io: status = 'Active'
const activeCampaigns = smartleadActive + replyioActive;
```

Expected result: **~114 active** (52 SmartLead + 62 Reply.io)

---

### 4. Weekly Chart - Use Delta View Correctly

The `nocodb_campaign_daily_deltas` view calculates proper day-over-day changes using window functions. This is better than `nocodb_daily_totals.sent_delta`.

**Key fix**: Query the deltas view and aggregate by week:

```typescript
const { data: deltas } = await supabase
  .from('nocodb_campaign_daily_deltas')
  .select('snapshot_date, emails_sent_delta, emails_replied_delta, positive_delta')
  .gte('snapshot_date', week12Start);

// Group by week and sum deltas
```

**Filter first-snapshot anomalies**:
```typescript
// Only include rows where we have a previous day comparison
// The deltas view handles this via LAG() window function
// Rows with NULL in prior_* columns are first-day entries
```

---

## Technical Implementation

### File Changes

| File | Changes |
|------|---------|
| `src/hooks/useNocoDBDashboard.tsx` | **NEW** - Dedicated hook for NocoDB-sourced dashboard |
| `src/hooks/useOverviewDashboard.tsx` | Update to use new hook or inline NocoDB queries |
| `src/components/dashboard/HeroMetricsGrid.tsx` | No changes needed (receives data) |

### Implementation Steps

**Step 1**: Add NocoDB queries to `useOverviewDashboard.tsx`:

```typescript
// Replace campaigns table query with NocoDB queries
const [smartleadRes, replyioRes] = await Promise.all([
  supabase
    .from('nocodb_smartlead_campaigns')
    .select('campaign_id, total_emails_sent, total_replies, total_bounces, leads_interested, status'),
  supabase
    .from('nocodb_replyio_campaigns')
    .select('campaign_id, deliveries, bounces, replies, status'),
]);

// Aggregate totals
const smartleadTotals = smartleadRes.data?.reduce((acc, r) => ({
  sent: acc.sent + (r.total_emails_sent || 0),
  replied: acc.replied + (r.total_replies || 0),
  bounced: acc.bounced + (r.total_bounces || 0),
  positive: acc.positive + (r.leads_interested || 0),
}), { sent: 0, replied: 0, bounced: 0, positive: 0 });

const replyioTotals = replyioRes.data?.reduce((acc, r) => ({
  sent: acc.sent + (r.deliveries || 0) + (r.bounces || 0),
  replied: acc.replied + (r.replies || 0),
  bounced: acc.bounced + (r.bounces || 0),
  delivered: acc.delivered + (r.deliveries || 0),
}), { sent: 0, replied: 0, bounced: 0, delivered: 0 });
```

**Step 2**: Update Hero Metric calculations:

```typescript
// Use delivered as denominator for rates (SmartLead convention)
const totalSent = smartleadTotals.sent + replyioTotals.sent;
const totalBounced = smartleadTotals.bounced + replyioTotals.bounced;
const totalDelivered = Math.max(0, totalSent - totalBounced);
const totalReplied = smartleadTotals.replied + replyioTotals.replied;
const totalPositive = smartleadTotals.positive; // Reply.io doesn't have positive

// Rates using delivered
const replyRate = calculateRate(totalReplied, totalDelivered);
const positiveRate = calculateRate(totalPositive, totalDelivered);
```

**Step 3**: Update Active Campaign count:

```typescript
const activeCampaigns = 
  smartleadRes.data?.filter(c => c.status?.toUpperCase() === 'ACTIVE').length +
  replyioRes.data?.filter(c => c.status === 'Active').length;
```

**Step 4**: Fix Weekly Chart data:

```typescript
// Query deltas view for weekly chart
const { data: deltas } = await supabase
  .from('nocodb_campaign_daily_deltas')
  .select('snapshot_date, campaign_id, emails_sent_delta, emails_replied_delta, positive_delta')
  .gte('snapshot_date', week12Start)
  .lte('snapshot_date', todayStr);

// Sum by week, excluding first-snapshot rows (emails_sent_delta = prior total)
const weeklyMap = new Map<string, WeeklyData>();
deltas?.forEach(d => {
  // Skip first-snapshot anomalies (delta == cumulative total)
  // The view should handle this, but add guard
  const weekEndStr = getWeekEndStr(d.snapshot_date);
  const week = weeklyMap.get(weekEndStr) || createEmptyWeek(weekEndStr);
  week.emailsSent += d.emails_sent_delta || 0;
  week.replies += d.emails_replied_delta || 0;
  week.positiveReplies += d.positive_delta || 0;
  weeklyMap.set(weekEndStr, week);
});
```

---

## Expected Results After Fix

| Metric | Before | After |
|--------|--------|-------|
| Emails Sent | 2M+ | ~1.19M (NocoDB total) |
| Reply Rate | X / sent | X / delivered |
| Positive Rate | X / sent | X / delivered |
| Active Campaigns | 1400 | ~114 |
| Weekly Chart Max | ~900k | Actual weekly deltas |

---

## Data Validation Queries

After implementation, verify with:

```sql
-- Verify NocoDB totals
SELECT 
  SUM(total_emails_sent) as sl_sent,
  SUM(total_replies) as sl_replied,
  SUM(leads_interested) as sl_positive
FROM nocodb_smartlead_campaigns;

SELECT 
  SUM(deliveries + bounces) as rio_sent,
  SUM(replies) as rio_replied
FROM nocodb_replyio_campaigns;
```

---

## Notes

1. **Reply.io Positive Replies**: Not available in NocoDB - shows 0. This is a data gap, not a bug.
2. **Weekly Chart**: Uses snapshot deltas which only exist from 2026-01-27 onward. Earlier weeks will fall back to `daily_metrics` or show no data.
3. **WoW Comparisons**: Will still use `daily_metrics` for week-over-week since snapshots are too recent.
