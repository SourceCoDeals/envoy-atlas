
# Include Paused Campaigns in Engagement Report Data

## Problem Identified

The Engagement Report currently excludes data from **Paused** (and **Completed**) campaigns in two ways:

1. **Snapshot Capture**: The `sync-nocodb-campaigns` Edge Function only captures daily snapshots for campaigns with `Status = "ACTIVE"` (line 234 and 256). Paused/Completed campaigns are excluded.

2. **Final Totals Selection**: When snapshot deltas exist, the report prioritizes them even for "All time" view (line 572-576), potentially missing cumulative data.

### Data Verification
The GP Partners engagement has:
- **7 Active campaigns**: 33,682 sent, 162 replies (in NocoDB)
- **2 Paused campaigns**: 0 sent, 0 replies (these happen to have no data)
- **4 Drafted campaigns**: 0 sent (not yet started)

While the specific paused GP Partners campaigns have 0 data, the fix ensures future paused campaigns with data are properly captured.

---

## Solution

### 1. Capture Snapshots for Paused and Completed Campaigns

**File**: `supabase/functions/sync-nocodb-campaigns/index.ts`

**Current behavior** (line 233-234 and 255-256):
```typescript
// Only captures ACTIVE campaigns
const activeSmartlead = smartleadRecords
  .filter(r => r.Status?.toUpperCase() === "ACTIVE")
  ...
const activeReplyio = replyioRecords
  .filter(r => r.Status === "Active")
```

**Change to include paused and completed**:
```typescript
// Capture snapshots for active, paused, and completed campaigns (with data)
const SNAPSHOT_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED'];

const includedSmartlead = smartleadRecords
  .filter(r => SNAPSHOT_STATUSES.includes(r.Status?.toUpperCase() || '') && (r["Total Emails Sent"] || 0) > 0)
  ...

const includedReplyio = replyioRecords
  .filter(r => ['Active', 'Paused', 'Finished'].includes(r.Status) && ((r["# of Deliveries"] || 0) + (r["# of Bounces"] || 0)) > 0)
```

This ensures campaigns with actual email data continue to have their snapshots captured even after being paused.

---

### 2. Fix "All Time" Total Selection Logic

**File**: `src/hooks/useEngagementReport.tsx`

**Current logic** (lines 572-576):
```typescript
const finalEmailTotals = hasSnapshotDeltas
  ? snapshotPeriodTotals  // Always uses snapshots if available - WRONG for "All time"
  : startDateStr
    ? (...)
    : allTimeEmailTotals;
```

**Fixed logic**:
```typescript
// For "All time" (no date range), always use campaignTotals from NocoDB
// For specific date ranges, prefer snapshot deltas if available
const finalEmailTotals = startDateStr
  ? (hasSnapshotDeltas 
      ? snapshotPeriodTotals 
      : (dailyTotals.sent > 0 ? rangeEmailTotals : allTimeEmailTotals))
  : allTimeEmailTotals;  // "All time" always uses campaign totals
```

This ensures:
- **"All time"**: Uses NocoDB cumulative totals (`campaignTotals`)
- **Date range with snapshots**: Uses snapshot deltas for period-specific metrics
- **Date range without snapshots**: Falls back to daily_metrics or campaign totals

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/sync-nocodb-campaigns/index.ts` | Expand snapshot capture to include PAUSED and COMPLETED campaigns with data (lines 233-252, 255-274) |
| `src/hooks/useEngagementReport.tsx` | Fix final totals selection to use campaign totals for "All time" view (lines 572-576) |

---

## Expected Results

| Scenario | Before | After |
|----------|--------|-------|
| "All time" view | May show snapshot deltas only (last 2 days: ~32k) | Shows full NocoDB totals (33,682 sent) |
| Date range view | Uses snapshots if available | Same - uses snapshots for period |
| Paused campaigns | No new snapshots captured | Daily snapshots continue until data stabilizes |
| Completed campaigns | No snapshots captured | Snapshots captured (historical accuracy) |

---

## Technical Notes

1. The fix adds a minimum data threshold (`total_emails_sent > 0`) to avoid capturing empty campaigns
2. For Reply.io, "Finished" is the equivalent of "Completed" status
3. The snapshot capture runs daily via the sync-nocodb-campaigns function
4. Existing historical data for paused campaigns is preserved in NocoDB tables and will be used for "All time" calculations
