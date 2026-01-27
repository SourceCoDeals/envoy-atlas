

# Fix Weekly Chart Data Source: Use Snapshot Deltas Instead of daily_metrics

## Problem Summary

The spike on Jan 24th comes from the `daily_metrics` table which has an anomalous entry of 278,619 emails sent on Jan 20, 2026. The weekly chart currently uses `daily_metrics` as its data source, but this table has:
- Sparse and inconsistent data
- Possible synthetic/estimated rows
- Large unexplained spikes

Meanwhile, the newly created `nocodb_campaign_daily_snapshots` system is not yet integrated into the weekly chart.

## Current Data Flow

```text
daily_metrics (sparse, some synthetic) → Weekly buckets → Chart

NOT USING:
nocodb_campaign_daily_snapshots → nocodb_campaign_daily_deltas → (unused)
```

## Proposed Data Flow

```text
PRIMARY:   nocodb_daily_totals (sent_delta, replied_delta) → Weekly buckets → Chart
FALLBACK:  daily_metrics → Weekly buckets → Chart (only when snapshots unavailable)
```

## Technical Changes

### 1. Update useOverviewDashboard.tsx

**Current behavior (lines 310-354):**
- Builds weekly buckets from `daily_metrics` rows
- Groups by week ending date
- Shows whatever is in `daily_metrics` (including synthetic data)

**New behavior:**
- Check if we have snapshot data for the date range
- If snapshots exist for multiple days, use `nocodb_daily_totals.sent_delta` for true daily activity
- Aggregate deltas into weekly buckets
- Fall back to `daily_metrics` only for weeks where no snapshots exist
- Set `dataSource: 'snapshots'` when using snapshot-based data

### 2. Handle First-Day Snapshot Edge Case

Since Jan 27 is the first snapshot:
- `sent_delta = emails_sent` (equals cumulative, no previous day)
- We should **skip** this delta for chart purposes until Day 2
- Add logic: `WHERE prev_snapshot_date IS NOT NULL` to filter out first-day entries

### 3. Add Weekly Aggregation from Deltas

```typescript
// Pseudocode for snapshot-based weekly aggregation
const deltaData = await supabase
  .from('nocodb_daily_totals')
  .select('snapshot_date, sent_delta, replied_delta, total_positive')
  .gte('snapshot_date', week12Start)
  .lte('snapshot_date', todayStr)
  .order('snapshot_date');

// Filter to only include rows with a previous snapshot
const validDeltas = deltaData.filter(d => d.sent_delta !== d.total_sent);

// Group by week
weeklyMap entries get populated with delta sums
```

### 4. Hybrid Weekly Breakdown

For the transition period (until we accumulate 12 weeks of snapshots):

| Week | Data Source | Logic |
|------|-------------|-------|
| Weeks with snapshots | `nocodb_daily_totals` deltas | Sum of `sent_delta` per week |
| Weeks before snapshots | `daily_metrics` | Existing aggregation |
| Partial weeks | Merged | Combine both sources |

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useOverviewDashboard.tsx` | Add snapshot delta fetching and weekly aggregation logic |

## Expected Results

**Immediate (after fix):**
- Chart will show no data for Jan 27 week (since first-day delta isn't meaningful)
- Existing `daily_metrics` weeks will still display
- The Jan 20 spike will remain until we decide how to handle legacy data

**After Day 2+ of snapshots:**
- Real daily activity will appear as deltas
- Weekly totals will reflect actual new emails sent that week
- Spike artifacts will gradually be replaced with accurate data

**Long-term (12+ weeks of snapshots):**
- Chart will be entirely snapshot-based
- No estimated or synthetic data needed
- "Snapshots" badge will appear on chart

## Additional Considerations

### Option A: Filter Out Suspicious daily_metrics Data
- Add logic to cap or filter extreme values in `daily_metrics`
- E.g., ignore rows where `emails_sent > 100,000` in a single day

### Option B: Mark Legacy Data as "Historical"
- Add visual indicator distinguishing legacy data from snapshot data
- Fade or gray out pre-snapshot weeks

### Option C: Clean Up daily_metrics
- Investigate and fix the anomalous Jan 20 entry
- Remove synthetic/backfilled rows that distort the chart

## Implementation Priority

1. **Phase 1**: Add logic to skip first-day snapshot deltas (immediate fix)
2. **Phase 2**: Integrate snapshot deltas into weekly breakdown (replaces daily_metrics)
3. **Phase 3**: Add hybrid logic for transition period
4. **Phase 4**: Clean up or deprecate legacy daily_metrics usage

