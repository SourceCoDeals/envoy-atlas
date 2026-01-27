

# Updated Integration Plan: NocoDB Campaign Snapshots into Email Dashboard Reports

## Data Analysis Summary

Based on the newly synced snapshot data from January 27, 2026:

### Snapshot Metrics Available

| Metric | SmartLead | Reply.io | Combined |
|--------|-----------|----------|----------|
| Active Campaigns | 47 | 62 | 109 |
| Emails Sent | 107,436 | 115,789 | 223,225 |
| Emails Replied | 1,251 | 1,770 | 3,021 |
| Positive Replies | 470 | 0* | 470 |
| Total Leads | 37,386 | 26,659 | 64,045 |

*Reply.io doesn't track "positive" sentiment directly in NocoDB

### Data Linkage Status

- **110 snapshot records** captured for active campaigns
- **110 matched** to internal `campaigns` table via `external_id`
- **39 matched** to specific engagements (non-unassigned)
- Remaining 71 are "Unassigned Campaigns"

### Current Data Gap Analysis

| Source | Sent | Replied | Positive | Days Coverage |
|--------|------|---------|----------|---------------|
| `daily_metrics` (30d) | 297,290 | 3,446 | 699 | 7 days with data |
| Snapshots (Jan 27) | 223,225 | 3,021 | 470 | 1 day (first sync) |

**Key Insight**: The snapshot system now captures daily cumulative totals. As syncs continue over time, the deltas will show real day-over-day changes. Currently, since this is the first snapshot, all deltas equal the cumulative values (no previous snapshot to compare against).

---

## Updated Implementation Strategy

### Phase 1: Enhance the Trends Hook with Engagement Filtering

The `useNocoDBCampaignTrends` hook currently fetches global snapshot data. We need to add the ability to filter by engagement via the campaign join path.

**Changes to `src/hooks/useNocoDBCampaignTrends.tsx`:**

1. Add `engagementId` filter option
2. Add helper to aggregate snapshots by week
3. Add helper to convert snapshots to `WeeklyData` format for chart compatibility
4. Add method to get engagement-specific totals via campaign join

```text
New filter option:
engagementId?: string  // Filter snapshots to campaigns linked to this engagement
```

**Join Logic**:
```text
nocodb_campaign_daily_snapshots.campaign_id
   → campaigns.external_id
   → campaigns.engagement_id
   → engagements.id
```

---

### Phase 2: Overview Dashboard Integration

**File**: `src/hooks/useOverviewDashboard.tsx`

The Overview Dashboard currently:
- Uses `campaigns` table for hero metrics (lines 216-221)
- Uses `daily_metrics` for weekly chart (lines 275-298) - but this data is sparse
- Uses `daily_metrics` for Today's Pulse (lines 205-212)

**Proposed Changes**:

1. **Today's Pulse Enhancement**
   - Add parallel fetch for today's `nocodb_daily_totals`
   - Use snapshot-based totals when available, falling back to `daily_metrics`
   - Show "109 active campaigns" context from snapshot data

2. **Weekly Chart Improvement** (Future - after multi-day snapshots accumulate)
   - Once we have 7+ days of snapshots, aggregate delta values by week
   - Replace sparse `daily_metrics` weekly buckets with snapshot-based deltas
   - Add data source indicator: "Snapshot Trends" badge

3. **Data Completeness Indicator**
   - Show snapshot coverage: "39 of 109 campaigns linked to engagements"
   - Alert if many campaigns are unassigned

**New Data Flow**:
```text
Current:    campaigns → hero metrics
            daily_metrics → weekly chart (sparse)
            
Proposed:   campaigns → hero metrics (unchanged)
            nocodb_daily_totals → today's pulse (enhanced)
            nocodb_campaign_daily_deltas (by week) → weekly chart (after multi-day data)
```

---

### Phase 3: Engagement Report Integration

**File**: `src/hooks/useEngagementReport.tsx`

Currently:
- Fetches `daily_metrics` by `engagement_id` (line 304-309)
- Falls back to campaign totals when date range returns empty (lines 406-428)
- Weekly breakdown uses historical daily_metrics (line 387)

**Proposed Changes**:

1. **Add Snapshot Fetching for Linked Campaigns**
   - Join `nocodb_campaign_daily_snapshots` to campaigns via `external_id`
   - Filter by `campaigns.engagement_id`
   - This gives engagement-specific snapshot data

2. **Email Metrics Hybrid Source**
   - Primary: Sum of snapshots for linked campaigns (when available)
   - Secondary: `daily_metrics` aggregation
   - Tertiary: Campaign totals fallback

3. **Weekly Performance from Snapshots**
   - When snapshots span multiple weeks, use delta aggregation
   - Remove "Estimated" banner when using real snapshot data

4. **Data Source Indicator**
   - "Snapshot Data" (green) when using real daily snapshots
   - "Campaign Totals" (blue) when using cumulative fallback
   - "Estimated" (amber) only for synthetic data

**Sample Query for Engagement Snapshots**:
```sql
SELECT s.*
FROM nocodb_campaign_daily_snapshots s
JOIN campaigns c ON c.external_id = s.campaign_id
WHERE c.engagement_id = '<engagement_uuid>'
  AND s.snapshot_date BETWEEN '<start>' AND '<end>'
ORDER BY s.snapshot_date;
```

---

### Phase 4: Monthly Report Integration

**File**: `src/hooks/useMonthlyReportData.tsx`

Currently:
- Fetches `daily_metrics` for month range (lines 118-123)
- Builds daily trend chart from `daily_metrics` rows (line 174)
- Uses `daily_metrics` for MoM comparison (lines 134-146)

**Proposed Changes**:

1. **Monthly KPIs from Snapshots**
   - Fetch `nocodb_daily_totals` for all dates in selected month
   - Sum `sent_delta`, `replied_delta` columns for true monthly new activity
   - Compare to previous month's delta sums for MoM

2. **Daily Trend Chart**
   - Build from `nocodb_daily_totals` (one row per date per platform)
   - Show actual daily volumes instead of sparse daily_metrics

3. **Campaign Performance Table**
   - Enhanced with snapshot-based metrics per campaign
   - Show which campaigns have snapshot data vs estimates

**Note**: This becomes valuable after 30+ days of snapshots are collected. Initial implementation can fall back to current logic while snapshots accumulate.

---

### Phase 5: Campaign Detail Enhancement

**File**: `src/hooks/useCampaignSummary.ts`

Currently:
- Fetches campaign from `campaigns` table
- Uses `daily_metrics` for performance chart (often empty)

**Proposed Changes**:

1. **Campaign History Chart**
   - Fetch `nocodb_campaign_daily_snapshots` for this `campaign_id`
   - Build progression chart showing cumulative growth over time
   - Show sent, replied, positive as stacked or multi-line chart

2. **Delta Analysis**
   - Fetch from `nocodb_campaign_daily_deltas` for this campaign
   - Show "Yesterday: +150 sent, +3 replies" type metrics

---

## Technical Implementation Details

### New Hook Enhancement: `useNocoDBCampaignTrends`

Add these methods:

```typescript
// New filter
interface TrendFilters {
  startDate?: Date;
  endDate?: Date;
  platform?: 'smartlead' | 'replyio' | 'all';
  campaignId?: string;
  engagementId?: string;  // NEW: Filter via campaign join
}

// New helpers
aggregateByWeek(deltas: CampaignDelta[]): WeeklyData[]
getTotalsForEngagement(engagementId: string): Promise<DailyTotals[]>
convertToWeeklyChartData(totals: DailyTotals[]): WeeklyData[]
```

### Database Query: Engagement-Filtered Snapshots

```sql
-- Create a reusable query or view
SELECT 
  s.snapshot_date,
  SUM(s.emails_sent) as total_sent,
  SUM(s.emails_replied) as total_replied,
  SUM(s.positive_replies) as total_positive,
  SUM(s.emails_bounced) as total_bounced,
  COUNT(DISTINCT s.campaign_id) as campaign_count
FROM nocodb_campaign_daily_snapshots s
JOIN campaigns c ON c.external_id = s.campaign_id
WHERE c.engagement_id = $1
  AND s.snapshot_date BETWEEN $2 AND $3
GROUP BY s.snapshot_date
ORDER BY s.snapshot_date;
```

### Fallback Strategy

Each integration point should implement:

1. **Check snapshot availability** - Are there snapshots for the date range?
2. **Primary: Use snapshots** - When available, use real snapshot data
3. **Secondary: Use daily_metrics** - Fall back to existing sparse data
4. **Tertiary: Use campaign totals** - Final fallback for "All Time" view

### Data Source Badge Component

Create a reusable indicator showing data provenance:

| Badge | Color | Meaning |
|-------|-------|---------|
| "Live Snapshots" | Green | Using real `nocodb_campaign_daily_snapshots` |
| "NocoDB Sync" | Blue | Using aggregate campaign totals from NocoDB |
| "Estimated" | Amber | Using synthetic/backfilled data |
| "Activity Log" | Green | Using real `email_activities` data |

---

## Files to Create/Modify

| File | Action | Priority |
|------|--------|----------|
| `src/hooks/useNocoDBCampaignTrends.tsx` | Enhance with engagement filter & aggregation helpers | High |
| `src/hooks/useOverviewDashboard.tsx` | Add snapshot-based Today's Pulse | High |
| `src/hooks/useEngagementReport.tsx` | Add engagement-snapshot join | Medium |
| `src/hooks/useMonthlyReportData.tsx` | Add monthly snapshot aggregation | Medium |
| `src/hooks/useCampaignSummary.ts` | Add campaign-specific snapshots | Low |
| `src/components/ui/data-source-badge.tsx` | Create reusable indicator | High |

---

## Implementation Phases Summary

### Phase 1: Foundation (Immediate)
- Enhance `useNocoDBCampaignTrends` with engagement filtering
- Create `DataSourceBadge` component
- Estimated: 1-2 hours

### Phase 2: Overview Dashboard (After Phase 1)
- Add snapshot-based Today's Pulse data
- Add data source indicator to weekly chart
- Estimated: 2 hours

### Phase 3: Engagement Report (After Phase 1)
- Add snapshot join for linked campaigns
- Update weekly breakdown source
- Estimated: 2-3 hours

### Phase 4: Monthly Report (After 30+ days of snapshots)
- Convert to snapshot-based monthly aggregation
- Estimated: 2 hours

### Phase 5: Campaign Detail (Lower priority)
- Add campaign progression chart from snapshots
- Estimated: 1-2 hours

---

## Expected Benefits

1. **Real-time accuracy** - Snapshot data reflects actual NocoDB sync, not estimates
2. **Day-over-day tracking** - Delta views show true daily activity
3. **Platform visibility** - Filter by SmartLead vs Reply.io easily
4. **Engagement attribution** - 39 engagements already linked to snapshot data
5. **Historical trends** - As snapshots accumulate, rich trend analysis becomes possible
6. **Reduced "Estimated" labels** - Real data replaces synthetic backfills

---

## Notes & Considerations

1. **First Day of Snapshots**: Since this is the first sync, deltas equal cumulative values. After tomorrow's sync, we'll have real day-over-day changes.

2. **Unassigned Campaigns**: 71 of 110 campaigns are unassigned to engagements. These won't appear in engagement-filtered reports but will appear in global Overview dashboard.

3. **Reply.io Positive Replies**: NocoDB doesn't track positive sentiment for Reply.io campaigns (shows as 0). This is a data source limitation, not a bug.

4. **Gradual Rollout**: Start with Today's Pulse (Phase 2), then expand as snapshot history accumulates.

