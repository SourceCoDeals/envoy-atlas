

# Daily Campaign Metrics Snapshot Tracking

## Overview

This plan creates a system to track daily snapshots of NocoDB campaign metrics, enabling trend analysis and historical progress tracking for both SmartLead and Reply.io campaigns.

## Current State

**Existing Tables (to remain unchanged):**
- `nocodb_smartlead_campaigns` - 189 campaigns (47 ACTIVE, 89 COMPLETED, 30 PAUSED)
- `nocodb_replyio_campaigns` - 643 campaigns (62 Active, 547 Paused)

**Sync Process:**
- The `sync-nocodb-campaigns` edge function runs daily
- Uses upsert on `campaign_id` - overwrites previous values
- No historical data is preserved

**Key Metrics to Track:**

| Platform | Metric Columns |
|----------|---------------|
| SmartLead | `total_emails_sent`, `total_replies`, `total_bounces`, `leads_interested`, `leads_in_progress`, `leads_completed`, `leads_paused` |
| Reply.io | `deliveries`, `bounces`, `replies`, `people_count`, `people_active`, `people_finished`, `people_paused`, `optouts`, `ooos` |

---

## Implementation Plan

### 1. Create Unified Daily Snapshot Table

A single table to track both platforms with a normalized schema:

```text
nocodb_campaign_daily_snapshots
+------------------------+----------+----------------------------------------+
| Column                 | Type     | Description                            |
+------------------------+----------+----------------------------------------+
| id                     | uuid     | Primary key                            |
| snapshot_date          | date     | Date of the snapshot                   |
| platform               | text     | 'smartlead' or 'replyio'               |
| campaign_id            | text     | External campaign ID (matches source)  |
| campaign_name          | text     | Campaign name at time of snapshot      |
| status                 | text     | Campaign status                        |
+------------------------+----------+----------------------------------------+
| emails_sent            | integer  | Cumulative emails sent                 |
| emails_delivered       | integer  | Cumulative delivered                   |
| emails_bounced         | integer  | Cumulative bounces                     |
| emails_replied         | integer  | Cumulative replies                     |
| positive_replies       | integer  | Positive/interested count              |
+------------------------+----------+----------------------------------------+
| total_leads            | integer  | Total leads enrolled                   |
| leads_active           | integer  | Currently in progress                  |
| leads_completed        | integer  | Finished sequence                      |
| leads_paused           | integer  | Paused leads                           |
+------------------------+----------+----------------------------------------+
| optouts                | integer  | Opt-outs (Reply.io)                    |
| ooos                   | integer  | Out of office (Reply.io)               |
+------------------------+----------+----------------------------------------+
| created_at             | timestamptz | Record creation time                |
+------------------------+----------+----------------------------------------+
| UNIQUE                 |          | (snapshot_date, platform, campaign_id) |
+------------------------+----------+----------------------------------------+
```

**Deduplication Strategy:** Unique constraint on `(snapshot_date, platform, campaign_id)` prevents duplicate entries for the same campaign on the same day.

---

### 2. Modify Sync Function

Update `sync-nocodb-campaigns` to capture snapshots after each sync:

```text
Sync Flow (Updated)
+------------------+     +------------------------+     +---------------------------+
| Fetch from       | --> | Upsert to main         | --> | Insert into daily         |
| NocoDB API       |     | campaign tables        |     | snapshots table           |
+------------------+     +------------------------+     +---------------------------+
                                                               |
                                                               v
                                                        Only for campaigns
                                                        with status = ACTIVE
```

**Logic:**
1. After upserting to the main tables, iterate through synced campaigns
2. Filter to only `ACTIVE` (SmartLead) or `Active` (Reply.io) status
3. Insert snapshot row with today's date
4. Use upsert with conflict on `(snapshot_date, platform, campaign_id)` to handle re-runs

---

### 3. Create Delta Calculation View

A database view to calculate daily changes (deltas) between snapshots:

```text
nocodb_campaign_daily_deltas (VIEW)
+------------------------+----------------------------------------+
| Column                 | Description                            |
+------------------------+----------------------------------------+
| snapshot_date          | Current snapshot date                  |
| platform               | Platform identifier                    |
| campaign_id            | Campaign ID                            |
| campaign_name          | Campaign name                          |
+------------------------+----------------------------------------+
| emails_sent_delta      | Change from previous day               |
| emails_replied_delta   | Change from previous day               |
| bounced_delta          | Change from previous day               |
| positive_delta         | Change from previous day               |
+------------------------+----------------------------------------+
| prev_snapshot_date     | Date of previous snapshot              |
| days_since_last        | Days between snapshots                 |
+------------------------+----------------------------------------+
```

This view uses `LAG()` window functions to compare each snapshot with the previous one for the same campaign.

---

### 4. Create Aggregate Trend View

A view for overall daily totals across all campaigns:

```text
nocodb_daily_totals (VIEW)
+------------------------+----------------------------------------+
| Column                 | Description                            |
+------------------------+----------------------------------------+
| snapshot_date          | Date                                   |
| platform               | 'smartlead', 'replyio', or 'all'       |
+------------------------+----------------------------------------+
| total_campaigns        | Count of active campaigns              |
| total_sent             | Sum of emails sent                     |
| total_replied          | Sum of replies                         |
| total_bounced          | Sum of bounces                         |
| total_positive         | Sum of positive replies                |
| total_leads            | Sum of all leads                       |
+------------------------+----------------------------------------+
| sent_delta             | Change from previous day               |
| replied_delta          | Change from previous day               |
+------------------------+----------------------------------------+
```

---

### 5. Create React Hook for Trend Data

New hook `useNocoDBCampaignTrends` to fetch and display trend data:

**Features:**
- Fetch daily snapshots for a date range
- Calculate daily deltas client-side or use view
- Support filtering by platform and campaign
- Aggregate data for charts

---

### 6. Backfill Historical Data (Optional)

Since snapshots start from implementation date, consider:
- Creating an initial snapshot with current cumulative data
- Documenting that trend history begins from implementation date

---

## Technical Details

### Database Migration SQL

```sql
-- Create the daily snapshots table
CREATE TABLE public.nocodb_campaign_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('smartlead', 'replyio')),
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT,
  
  -- Email metrics (cumulative)
  emails_sent INTEGER DEFAULT 0,
  emails_delivered INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  positive_replies INTEGER DEFAULT 0,
  
  -- Lead/people metrics
  total_leads INTEGER DEFAULT 0,
  leads_active INTEGER DEFAULT 0,
  leads_completed INTEGER DEFAULT 0,
  leads_paused INTEGER DEFAULT 0,
  
  -- Reply.io specific
  optouts INTEGER DEFAULT 0,
  ooos INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(snapshot_date, platform, campaign_id)
);

-- Indexes for common queries
CREATE INDEX idx_snapshots_date ON nocodb_campaign_daily_snapshots(snapshot_date);
CREATE INDEX idx_snapshots_campaign ON nocodb_campaign_daily_snapshots(campaign_id);
CREATE INDEX idx_snapshots_platform_date ON nocodb_campaign_daily_snapshots(platform, snapshot_date);
```

### Edge Function Updates

The `sync-nocodb-campaigns` function will be updated to:

1. Accept an optional `capture_snapshot` parameter (default: true)
2. After main sync, filter active campaigns
3. Insert snapshot records using upsert
4. Log snapshot capture counts in response

### React Hook Structure

```typescript
// New file: src/hooks/useNocoDBCampaignTrends.tsx
interface CampaignSnapshot {
  date: string;
  platform: 'smartlead' | 'replyio';
  campaignId: string;
  campaignName: string;
  sent: number;
  replied: number;
  bounced: number;
  positive: number;
  // ... deltas
}

interface TrendFilters {
  startDate?: Date;
  endDate?: Date;
  platform?: 'smartlead' | 'replyio' | 'all';
  campaignId?: string;
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | Add `nocodb_campaign_daily_snapshots` table |
| `supabase/functions/sync-nocodb-campaigns/index.ts` | Modify | Add snapshot capture logic |
| `src/hooks/useNocoDBCampaignTrends.tsx` | Create | Hook for fetching trend data |
| `src/hooks/useNocoDBCampaigns.tsx` | Modify | Add optional trend data integration |

---

## Benefits

1. **Historical Tracking** - See how campaigns progress over time
2. **Trend Visualization** - Build charts showing sent/reply growth
3. **Performance Analysis** - Identify which days have best engagement
4. **No Data Loss** - Main tables remain unchanged with cumulative view
5. **Efficient Storage** - Only active campaigns create daily rows
6. **Deduplication** - Unique constraint prevents duplicate snapshots

