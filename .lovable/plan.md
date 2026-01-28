
# Fix Email Metrics Data Source - Use NocoDB Instead of Stale campaigns Table

## Problem Identified

The Engagement Report is showing **incorrect email metrics** because it reads from the `campaigns` table, which has **stale or missing data** for many GP Partners campaigns.

### Data Comparison

| Campaign | NocoDB (Correct) | campaigns table (Shown) |
|----------|------------------|-------------------------|
| GP Partners - Ria A/B Test | 21,204 sent, 73 replied | 0 sent, 0 replied |
| GP Partners - Collision 1 | 7,285 sent, 51 replied | 0 sent, 0 replied |
| GP Partners - Restoration | 3,028 sent, 17 replied | 0 sent, 0 replied |
| GP Partners - Garage Doors | 1,519 sent, 13 replied | 0 sent, 0 replied |
| **Totals** | **~33,000 sent, ~160 replied** | **~1,917 sent, 0 replied** |

### Root Cause

The `useEngagementReport` hook (lines 424-429) calculates email metrics by summing `total_sent`, `total_replied`, etc. from the `campaigns` table. However:
1. The `campaigns` table is not being updated with NocoDB data for many campaigns
2. Only `positive_replies` appears to sync correctly (via a different process)
3. The live data in `nocodb_smartlead_campaigns` is accurate but not being used

---

## Solution

Modify `useEngagementReport.tsx` to fetch and merge NocoDB data for accurate email metrics:

1. After fetching campaigns (which gives us `external_id` values)
2. Fetch matching rows from `nocodb_smartlead_campaigns` and `nocodb_replyio_campaigns`
3. Build a lookup map by `external_id`
4. When calculating campaign totals, prefer NocoDB values over stale `campaigns` values

---

## Technical Changes

### File: `src/hooks/useEngagementReport.tsx`

**After line 271 (after fetching campaigns):** Add NocoDB data fetch

```typescript
// Fetch NocoDB live metrics for linked campaigns
const externalCampaignIds = (campaigns || []).map(c => c.external_id).filter(Boolean) as string[];

let nocodbSmartleadData: any[] = [];
let nocodbReplyioData: any[] = [];

if (externalCampaignIds.length > 0) {
  const [smartleadRes, replyioRes] = await Promise.all([
    supabase
      .from('nocodb_smartlead_campaigns')
      .select('campaign_id, total_emails_sent, total_replies, leads_interested, total_bounces')
      .in('campaign_id', externalCampaignIds),
    supabase
      .from('nocodb_replyio_campaigns')
      .select('campaign_id, deliveries, bounces, replies')
      .in('campaign_id', externalCampaignIds),
  ]);
  nocodbSmartleadData = smartleadRes.data || [];
  nocodbReplyioData = replyioRes.data || [];
}

// Build lookup maps
const nocodbSmartleadMap = new Map(
  nocodbSmartleadData.map(n => [n.campaign_id, n])
);
const nocodbReplyioMap = new Map(
  nocodbReplyioData.map(n => [n.campaign_id, n])
);
```

**Replace lines 424-429 (campaign totals calculation):** Use NocoDB data preferentially

```typescript
// Calculate campaign totals - PREFER NocoDB live data over stale campaigns table
const campaignTotals = (campaigns || []).reduce((acc, c) => {
  const externalId = c.external_id;
  
  // Check for NocoDB data first (SmartLead)
  const smartlead = externalId ? nocodbSmartleadMap.get(externalId) : null;
  if (smartlead) {
    return {
      sent: acc.sent + (smartlead.total_emails_sent || 0),
      replied: acc.replied + (smartlead.total_replies || 0),
      positive: acc.positive + (smartlead.leads_interested || 0),
      bounced: acc.bounced + (smartlead.total_bounces || 0),
    };
  }
  
  // Check for Reply.io data
  const replyio = externalId ? nocodbReplyioMap.get(externalId) : null;
  if (replyio) {
    const delivered = replyio.deliveries || 0;
    const bounced = replyio.bounces || 0;
    return {
      sent: acc.sent + delivered + bounced,
      replied: acc.replied + (replyio.replies || 0),
      positive: acc.positive, // Reply.io doesn't track positive
      bounced: acc.bounced + bounced,
    };
  }
  
  // Fallback to campaigns table data
  return {
    sent: acc.sent + (c.total_sent || 0),
    replied: acc.replied + (c.total_replied || 0),
    positive: acc.positive + (c.positive_replies || 0),
    bounced: acc.bounced + (c.total_bounced || 0),
  };
}, { sent: 0, replied: 0, positive: 0, bounced: 0 });
```

**Update linkedCampaignsWithStats (lines 304-318):** Also use NocoDB for the campaigns table

```typescript
const linkedCampaignsWithStats: LinkedCampaignWithStats[] = (campaigns || []).map(c => {
  const settings = c.settings as Record<string, any> | null;
  const externalId = c.external_id;
  
  // Prefer NocoDB data
  const smartlead = externalId ? nocodbSmartleadMap.get(externalId) : null;
  const replyio = externalId ? nocodbReplyioMap.get(externalId) : null;
  
  let sent = c.total_sent || 0;
  let replied = c.total_replied || 0;
  let positive = c.positive_replies || 0;
  
  if (smartlead) {
    sent = smartlead.total_emails_sent || 0;
    replied = smartlead.total_replies || 0;
    positive = smartlead.leads_interested || 0;
  } else if (replyio) {
    sent = (replyio.deliveries || 0) + (replyio.bounces || 0);
    replied = replyio.replies || 0;
  }
  
  const parseNum = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseInt(val, 10) || 0;
    return 0;
  };
  
  return {
    id: c.id,
    name: c.name,
    platform: c.campaign_type,
    status: c.status,
    enrolled: parseNum(settings?.total_leads) || sent,
    sent,
    replied,
    replyRate: calculateRate(replied, sent),
    positiveReplies: positive,
    positiveRate: calculateRate(positive, sent),
  };
});
```

---

## Expected Results After Fix

| Metric | Before (Wrong) | After (Correct) |
|--------|----------------|-----------------|
| Emails Sent | ~1,917 | ~33,682 |
| Delivered | ~1,808 | ~33,631 |
| Replied | 0 | 162 |
| Positive Replies | 43 | 43 |

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/hooks/useEngagementReport.tsx` | Fetch NocoDB data and use it preferentially over stale `campaigns` table for email metrics (affects lines 271-280, 304-318, 424-429) |

This ensures the Engagement Report shows live, accurate data from NocoDB (the source of truth synced from SmartLead) rather than potentially stale data in the campaigns table.
