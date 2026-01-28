
# Engagement Metrics Fix: Use NocoDB Data Source


Right now it seems like it's fetching only the positive replies, but I want you to have two sections: one for positive replies and the other for all replies, added to the UI as well. 

## Problem Summary
The Engagement Dashboard's "+Replies" column shows **0** for most engagements because the `fetchEngagementMetrics` function in `EngagementDashboard.tsx` queries the internal `campaigns` table, which has `positive_replies = 0` for almost all records. 

The actual positive reply data lives in the **NocoDB sync tables**:
- `nocodb_smartlead_campaigns.leads_interested` (SmartLead positive replies)
- `nocodb_replyio_campaigns.replies` (Reply.io replies - no positive flag)

### Evidence from Database
| Engagement | NocoDB Positive | NocoDB Replies | Currently Displayed |
|------------|-----------------|----------------|---------------------|
| Alpine | 37 | 948 (replyio) | 0 |
| O2 Investment Auto | 0 | 1,360 (replyio) | 0 |
| LLCP | 0 | 328 (replyio) | 0 |
| Arch City | 0 | 236 (replyio) | 0 |
| New Heritage | 0 | 417 (replyio) | 0 |

## Solution Overview
Rewrite the `fetchEngagementMetrics` function to join internal campaigns with NocoDB tables via the `external_id` field, pulling real metrics from the source of truth.

---

## Technical Implementation

### Step 1: Modify fetchEngagementMetrics Function

**File:** `src/pages/EngagementDashboard.tsx` (lines 213-333)

**Current Logic (broken):**
```text
1. Query campaigns table for engagement_id
2. Read campaigns.total_sent, campaigns.positive_replies (both are 0)
3. Sum and display
```

**New Logic (correct):**
```text
1. Query campaigns table to get id, external_id, engagement_id, name
2. Query nocodb_smartlead_campaigns with all external_ids
3. Query nocodb_replyio_campaigns with all external_ids
4. Build a lookup map: external_id → NocoDB metrics
5. For each engagement:
   - Find linked campaigns via engagement_id
   - Sum NocoDB metrics (leads_interested, total_emails_sent, total_replies, etc.)
   - Calculate positiveReplies as: smartlead.leads_interested (Reply.io has no positive flag)
```

### Step 2: Update Query Strategy

**New parallel queries:**
```text
[campaignsRes, smartleadRes, replyioRes, callsRes, meetingsRes, coldCallsRes]
```

Add two new queries to fetch NocoDB data:
- `supabase.from('nocodb_smartlead_campaigns').select('campaign_id, total_emails_sent, total_replies, leads_interested, total_bounces')`
- `supabase.from('nocodb_replyio_campaigns').select('campaign_id, deliveries, bounces, replies')`

### Step 3: Build External ID Lookup Maps

After fetching, create maps for O(1) lookups:
```text
smartleadByExternalId: Map<string, { sent, replies, positive }>
replyioByExternalId: Map<string, { sent, replies }>
campaignsByEngagement: Map<engagementId, Array<{ external_id }>>
```

### Step 4: Aggregate Metrics Per Engagement

For each engagement:
1. Get all campaigns linked to it
2. For each campaign, look up its `external_id` in NocoDB maps
3. Sum:
   - `emailsSent` = SmartLead.total_emails_sent + Reply.io.(deliveries + bounces)
   - `positiveReplies` = SmartLead.leads_interested
   - `totalReplies` = SmartLead.total_replies + Reply.io.replies (for context)

### Step 5: Remove Attribution Mismatch Filter

The current code has a `KNOWN_SPONSORS` filter that skips campaigns based on name matching. This should be removed or refined since campaign-to-engagement linking is now done properly via database relationships.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/EngagementDashboard.tsx` | Rewrite `fetchEngagementMetrics` function (~100 lines) |

---

## Detailed Code Changes

### EngagementDashboard.tsx - fetchEngagementMetrics

The function will be rewritten to:

1. **Fetch campaigns with external_id:**
   ```text
   Query: campaigns.id, campaigns.name, campaigns.engagement_id, campaigns.external_id
   Filter: engagement_id IN (list of engagement IDs)
   ```

2. **Fetch NocoDB data (all records, not filtered):**
   ```text
   nocodb_smartlead_campaigns: campaign_id, total_emails_sent, total_replies, leads_interested
   nocodb_replyio_campaigns: campaign_id, deliveries, bounces, replies
   ```

3. **Build lookup maps:**
   ```text
   smartleadMap[campaign_id] = { sent, replies, positive }
   replyioMap[campaign_id] = { sent, delivered, replies }
   ```

4. **Aggregate per engagement:**
   ```text
   For each engagement:
     - Filter campaigns where engagement_id matches
     - For each campaign.external_id, lookup in smartleadMap OR replyioMap
     - Sum emailsSent, positiveReplies, etc.
   ```

5. **Keep existing call/meeting aggregation unchanged** (call_activities, meetings, cold_calls work fine)

---

## Expected Outcome

After implementation:

| Engagement | Expected +Replies |
|------------|-------------------|
| Alpine | 37 (from leads_interested) |
| O2 Investment Auto | 0 (Reply.io has no positive flag) |
| LLCP | 0 (Reply.io only) |
| Arch City | 0 (Reply.io only) |
| New Heritage | 0 (Reply.io only) |

**Note:** Reply.io campaigns don't have a "positive" classification, so their positiveReplies will remain 0. Only SmartLead campaigns have `leads_interested` data.

---

## Testing Checklist

1. Verify Alpine engagement shows 37+ positive replies
2. Verify email counts match NocoDB totals
3. Confirm Reply.io-only engagements show 0 positive (expected behavior)
4. Confirm call/meeting metrics still work correctly
5. Verify weekly comparison trends still function
