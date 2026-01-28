
# CTO-Level Fix Plan: Campaign Sorting, Email Count Discrepancy & Engagement Metrics

## Executive Summary

After a thorough investigation of the codebase and database, I've identified the root causes of all three issues:

| Issue | Root Cause | Impact | Fix Complexity |
|-------|-----------|--------|----------------|
| Campaign sorting | Missing status prioritization in `EnhancedCampaignTable` | UX - active campaigns buried | Low |
| 540K email count | Aggregating ALL campaigns (including those incorrectly attributed) | Inflated hero metrics | Medium |
| O2 Auto Repair data | 450 campaigns incorrectly linked (only 13 are actually O2 Auto) | Cascading data corruption | Data + Code |

---

## Issue 1: Campaign Dashboard Sorting

### Current State
The `EnhancedCampaignTable.tsx` (lines 173-267) has a generic sort that does NOT prioritize active campaigns. The older `CampaignTable.tsx` correctly prioritizes `['active', 'started', 'running']` statuses, but this logic was not carried over to the enhanced table.

### Fix
Add a two-tier sort that ALWAYS places active campaigns first, regardless of secondary sort field:

```text
┌─────────────────────────────────────────────┐
│  SORT PRIORITY                              │
├─────────────────────────────────────────────┤
│  1. Active Status (active, started, running)│
│  2. Secondary Sort Field (user-selected)    │
└─────────────────────────────────────────────┘
```

**File:** `src/components/campaigns/EnhancedCampaignTable.tsx`

**Changes:**
- Add `ACTIVE_STATUSES` constant at top of component
- Modify the `filteredAndSortedCampaigns` useMemo to apply two-tier sorting
- Active campaigns bubble to top, then sort by selected field within each tier

---

## Issue 2: Email Count Discrepancy (540K → ~170K Actual)

### Current State
The Overview Dashboard (`useOverviewDashboard.tsx` lines 290-297) aggregates ALL campaigns linked to the client's engagements:

```typescript
const campaignTotals = campaigns.reduce((acc, c) => ({
  sent: acc.sent + (c.total_sent || 0), // No status filter!
  ...
}), {...});
```

**Database Reality:**
- `campaigns` table total: **739,005** emails
- Active engagements campaigns: **738,512** emails
- BUT: **715,271** are from incorrectly attributed campaigns (O2 Investment Auto Repair)

### Fix
Filter aggregation to only include campaigns with `status IN ('active', 'started', 'running')`:

**File:** `src/hooks/useOverviewDashboard.tsx`

**Changes:**
- Add status filter when aggregating `campaignTotals`
- Only count emails from campaigns that are currently active
- Add data quality indicator showing paused/completed campaign totals separately

---

## Issue 3: O2 Investment Auto Repair Data Corruption

### Database Forensics
```text
┌──────────────────────────────────────────────────────────────┐
│  O2 Investment Auto Repair (f8ad6966-49ed-4394-8cec-...)    │
├──────────────────────────────────────────────────────────────┤
│  Total campaigns linked: 450                                 │
│  Correctly attributed (O2 Auto): 13 campaigns (68K emails)  │
│  WRONG - Trivest campaigns: 47 (121K emails)                │
│  WRONG - Stadion campaigns: 16 (75K emails)                 │
│  WRONG - Alpine campaigns: 20 (47K emails)                  │
│  WRONG - Trinity campaigns: 18 (44K emails)                 │
│  WRONG - GP Partners campaigns: 15 (35K emails)             │
│  WRONG - Other misattributed: 316+ campaigns                │
└──────────────────────────────────────────────────────────────┘
```

### Root Cause
The `auto-pair-engagements` function has been incorrectly linking campaigns from OTHER clients/sponsors to "O2 Investment Auto Repair" as a catch-all bucket.

### Fix Strategy (Two-Part)

**Part A: Code Fix** - Improve `EngagementDashboard.tsx` metrics aggregation
- Add validation in `fetchEngagementMetrics` to filter out obviously misattributed campaigns
- Add engagement name matching heuristics (e.g., "Trivest" campaigns shouldn't be in "O2 Investment")

**Part B: Data Remediation** - SQL cleanup (requires manual execution)
- Provide migration script to move misattributed campaigns to proper engagements or "Unassigned"
- This is a data governance issue that requires human review

**Files to modify:**
1. `src/pages/EngagementDashboard.tsx` - Add campaign filtering logic
2. Create data audit SQL for the user to review and execute

---

## Technical Implementation Plan

### Phase 1: Campaign Sorting Fix (EnhancedCampaignTable.tsx)

```typescript
// Add constant at top
const ACTIVE_STATUSES = ['active', 'started', 'running'];

// In filteredAndSortedCampaigns useMemo, after filtering:
result.sort((a, b) => {
  // TIER 1: Active status priority
  const aIsActive = ACTIVE_STATUSES.includes(a.status?.toLowerCase() || '');
  const bIsActive = ACTIVE_STATUSES.includes(b.status?.toLowerCase() || '');
  
  if (aIsActive && !bIsActive) return -1;
  if (!aIsActive && bIsActive) return 1;
  
  // TIER 2: User-selected sort field (existing logic)
  // ... existing switch statement ...
});
```

### Phase 2: Overview Dashboard Filter (useOverviewDashboard.tsx)

```typescript
// Filter to only active campaigns for hero metrics
const activeCampaigns = campaigns.filter(c => 
  ['active', 'started', 'running'].includes(c.status?.toLowerCase() || '')
);

const campaignTotals = activeCampaigns.reduce((acc, c) => ({
  sent: acc.sent + (c.total_sent || 0),
  replied: acc.replied + (c.total_replied || 0),
  positive: acc.positive + (c.positive_replies || 0),
  meetings: acc.meetings + (c.total_meetings || 0),
}), { sent: 0, replied: 0, positive: 0, meetings: 0 });
```

### Phase 3: Engagement Dashboard Validation (EngagementDashboard.tsx)

Add a validation heuristic to flag suspicious campaign attributions:

```typescript
// In fetchEngagementMetrics, before aggregating:
// Filter out campaigns that are clearly misattributed
const validCampaigns = allCampaigns.filter(campaign => {
  const engName = metricsMap[campaign.engagement_id]?.name?.toLowerCase() || '';
  const campName = campaign.name?.toLowerCase() || '';
  
  // Skip if campaign name contains a DIFFERENT sponsor/client name
  const knownSponsors = ['trivest', 'trinity', 'stadion', 'alpine', 'verde', 'arch city'];
  const hasOtherSponsor = knownSponsors.some(sponsor => 
    campName.includes(sponsor) && !engName.includes(sponsor)
  );
  
  return !hasOtherSponsor;
});
```

### Phase 4: Data Audit SQL (For Manual Review)

```sql
-- Identify misattributed campaigns
SELECT 
  c.id,
  c.name as campaign_name,
  e.name as current_engagement,
  CASE 
    WHEN c.name ILIKE '%Trivest%' THEN 'Trivest'
    WHEN c.name ILIKE '%Trinity%' THEN 'Trinity'
    WHEN c.name ILIKE '%Stadion%' THEN 'Stadion'
    WHEN c.name ILIKE '%Alpine%' THEN 'Alpine'
    WHEN c.name ILIKE '%GP Partners%' THEN 'GP Partners'
    ELSE 'Review Manually'
  END as suggested_engagement
FROM campaigns c
JOIN engagements e ON e.id = c.engagement_id
WHERE e.name = 'O2 Investment Auto Repair'
  AND (
    c.name NOT ILIKE '%O2%Auto%'
    AND c.name NOT ILIKE '%O2 Investment%'
  )
ORDER BY c.total_sent DESC;
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/campaigns/EnhancedCampaignTable.tsx` | Add active-first sorting logic |
| `src/hooks/useOverviewDashboard.tsx` | Filter hero metrics to active campaigns only |
| `src/pages/EngagementDashboard.tsx` | Add campaign validation heuristics for metrics |

---

## Expected Outcomes

After implementation:

1. **Campaign Dashboard**: Active campaigns (`status: active/started/running`) will ALWAYS appear at the top of the table, regardless of other sort criteria

2. **Overview Dashboard**: Hero metrics will show accurate email counts (~170K actual active vs 540K inflated), with proper attribution

3. **Engagement Tab**: O2 Investment Auto Repair will show only its legitimate 13 campaigns (~68K emails) with actual reply and call data, not the 450 incorrectly linked campaigns

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing sort preferences | Active-first is additive, secondary sort preserved |
| Hiding legitimate paused campaigns | Add filter option for "Include paused" |
| Data cleanup requires manual review | Provide SQL audit script, don't auto-delete |

