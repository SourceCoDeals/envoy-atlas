

# Fix Email Performance Summary - Use Snapshot Deltas as Source of Truth

## Problem Identified

The GP Partners engagement report is showing **incorrect totals** because:

1. **Current behavior**: When a date range is selected, the code prioritizes `daily_metrics` (which is sparse/empty for GP Partners)
2. **Data mismatch**: The `nocodb_campaign_daily_deltas` view has the correct data (33,682 sent, 162 replied, 43 positive, 53 bounced) but isn't being used for period calculations
3. **Rate calculation issue**: Per-campaign rates use `sent` as denominator instead of `delivered` (misaligned with SmartLead's convention)

---

## Solution Overview

| Step | Change | File |
|------|--------|------|
| 1 | Fetch snapshot deltas and compute `snapshotTotals` | `useEngagementReport.tsx` |
| 2 | Prioritize snapshot totals over daily_metrics | `useEngagementReport.tsx` |
| 3 | Fix per-campaign rates to use delivered denominator | `useEngagementReport.tsx` |
| 4 | Add data source badge showing "Snapshots" | `EmailReportTab.tsx` |

---

## Technical Implementation

### 1. Fetch Snapshot Deltas (lines 309-323)

**Current**: Only fetches `nocodb_campaign_daily_snapshots` (cumulative totals)

**Change**: Also fetch `nocodb_campaign_daily_deltas` (day-over-day changes)

```typescript
// Add after existing snapshot query
let deltasQuery = supabase
  .from('nocodb_campaign_daily_deltas')
  .select('campaign_id, snapshot_date, emails_sent_delta, emails_replied_delta, emails_bounced_delta, positive_delta')
  .in('campaign_id', externalCampaignIds);

if (startDateStr) deltasQuery = deltasQuery.gte('snapshot_date', startDateStr);
if (endDateStr) deltasQuery = deltasQuery.lte('snapshot_date', endDateStr);
```

### 2. Compute Snapshot Totals (new code after line 475)

```typescript
// Sum snapshot deltas for period totals
const snapshotTotals = snapshotDeltasData.reduce((acc, d) => ({
  sent: acc.sent + (d.emails_sent_delta || 0),
  replied: acc.replied + (d.emails_replied_delta || 0),
  bounced: acc.bounced + (d.emails_bounced_delta || 0),
  positive: acc.positive + (d.positive_delta || 0),
}), { sent: 0, replied: 0, bounced: 0, positive: 0 });

const hasSnapshotDeltas = snapshotDeltasData.length > 0 && snapshotTotals.sent > 0;
```

### 3. Update Final Totals Selection Logic (lines 534-536)

**Current logic**:
```typescript
const finalEmailTotals = startDateStr
  ? (isCampaignFallbackInRange ? allTimeEmailTotals : rangeEmailTotals)
  : allTimeEmailTotals;
```

**New logic** (prioritize snapshots):
```typescript
// Build snapshot-derived period totals
const snapshotPeriodTotals = {
  sent: snapshotTotals.sent,
  replied: snapshotTotals.replied,
  positive: snapshotTotals.positive,
  bounced: snapshotTotals.bounced,
  delivered: Math.max(0, snapshotTotals.sent - snapshotTotals.bounced),
};

// Priority: 1) Snapshot deltas, 2) Daily metrics, 3) Campaign totals
const finalEmailTotals = hasSnapshotDeltas
  ? snapshotPeriodTotals
  : startDateStr
    ? (dailyTotals.sent > 0 ? rangeEmailTotals : allTimeEmailTotals)
    : allTimeEmailTotals;

// Track which source was actually used
const actualDataSource = hasSnapshotDeltas 
  ? 'snapshots' 
  : dailyTotals.sent > 0 
    ? 'daily_metrics' 
    : 'campaign_totals';
```

### 4. Fix Per-Campaign Rate Denominators (lines 360-371)

**Current**: Uses `sent` for rate calculations
```typescript
replyRate: calculateRate(replied, sent),
positiveRate: calculateRate(positive, sent),
```

**Change**: Use `delivered` (sent - bounced) to match SmartLead convention
```typescript
// Calculate delivered for denominator
const delivered = Math.max(0, sent - bounced);

return {
  // ...
  replyRate: calculateRate(replied, delivered > 0 ? delivered : sent),
  positiveRate: calculateRate(positive, delivered > 0 ? delivered : sent),
};
```

### 5. Add Data Source Badge to Email Tab

**File**: `src/components/engagementReport/EmailReportTab.tsx`

Add to the Email Performance Summary card header:
```tsx
import { DataSourceBadge } from '@/components/ui/data-source-badge';

// In the Card header (around line 479)
<CardTitle className="text-lg flex items-center gap-2">
  Email Performance Summary
  {dataAvailability?.dataSource && (
    <DataSourceBadge source={dataAvailability.dataSource} compact />
  )}
</CardTitle>
```

Update the interface to include the new dataSource field:
```typescript
interface DataAvailability {
  // ... existing fields
  dataSource?: 'snapshots' | 'daily_metrics' | 'campaign_totals' | 'estimated';
  snapshotDateRange?: { min: string; max: string } | null;
}
```

---

## Expected Results

| Metric | Before (Wrong) | After (Correct) |
|--------|----------------|-----------------|
| Emails Sent | ~0 or small number | 33,682 |
| Delivered | ~0 | 33,629 |
| Replied | 0 | 162 |
| Positive Replies | 0 or low | 43 |
| Reply Rate | 0% | ~0.48% (162/33,629) |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useEngagementReport.tsx` | Add snapshot delta query, compute snapshotTotals, update selection logic, fix rate denominators, update dataAvailability |
| `src/components/engagementReport/EmailReportTab.tsx` | Add DataSourceBadge import and display, update interface |

---

## Edge Cases Handled

1. **New campaigns (1 snapshot)**: Delta equals first observed total - works correctly
2. **No snapshot data**: Falls back to daily_metrics, then campaign_totals (existing behavior)
3. **Mixed sources**: prioritizes most accurate source (snapshots > daily_metrics > campaign_totals)

