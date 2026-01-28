
# Fix "Failed to Link Campaigns" - Duplicate Campaign Constraint Violation

## Problem Identified

When trying to link campaigns to the "GP Partners" engagement, you're getting a "Failed to link campaigns" error. The root cause is a **duplicate key constraint violation**.

### Technical Details

The database has a unique constraint: `campaigns_engagement_datasource_external_unique` on `(engagement_id, data_source_id, external_id)`.

The issue is that **duplicate campaign records exist** in the database - the same SmartLead campaigns (identified by external_id) appear in multiple engagements:

| Campaign Name | External ID | Current Engagements |
|---------------|-------------|---------------------|
| GP Partners - Ria A/B Test | 2657896 | GP Partners + Sales Outreach |
| GP Partners - Collision 1 | 2744621 | GP Partners + Sales Outreach |
| GP Partners - Garage Doors | 2806965 | GP Partners + Sales Outreach |
| GP Partners - Restoration | 2806969 | GP Partners + Sales Outreach |
| GP Partners - CPA/Accounting (SmartProspect) | 2865454 | GP Partners + Sales Outreach |
| GP Partners - Electrical (SmartProspect) | 2874939 | GP Partners + Sales Outreach |
| GP Partners - Tires and Automotive (SmartProspect) | 2874989 | GP Partners + Sales Outreach |

When trying to link a campaign from "Sales Outreach" to "GP Partners", the constraint fails because a copy already exists there.

---

## Solution

### Two-Part Fix

**Part 1: Improve the linking function to handle conflicts gracefully**

Modify `useCampaignLinking.tsx` to:
1. Before bulk updating, check which campaigns would conflict
2. For conflicting campaigns (same external_id already exists in target engagement):
   - Delete the duplicate from the source (it's redundant anyway)
   - OR Skip it and report which ones were skipped
3. Provide detailed error messages showing which campaigns succeeded/failed

**Part 2: One-time data cleanup**

Delete the duplicate campaign records in "Sales Outreach" that are redundant copies of GP Partners campaigns. These exist in both engagements and should only exist in one.

---

## Implementation Details

### File: `src/hooks/useCampaignLinking.tsx`

**Changes to `linkCampaignsToEngagement` function (lines 73-97):**

```text
Before:
- Simple bulk update with `.in('id', campaignIds)`
- Single error handling that fails entire batch

After:
1. Fetch campaign details (external_id, data_source_id) for all selected campaigns
2. Check for existing campaigns in target engagement with same external_id/data_source_id
3. For each campaign:
   - If no conflict: add to "safe to link" list
   - If conflict exists: add to "conflict" list
4. Delete duplicate records (those in conflict list) since they're redundant
5. Link the remaining campaigns individually using a loop
6. Report: "Linked X campaigns, deleted Y duplicates"
```

### File: `src/components/engagements/LinkCampaignsDialog.tsx`

**Minor enhancement:**
- Update the `onLink` callback signature to return detailed results
- Show a more informative success/error message

---

## Code Changes

### `src/hooks/useCampaignLinking.tsx` - Enhanced `linkCampaignsToEngagement`:

```typescript
const linkCampaignsToEngagement = useCallback(async (
  campaignIds: string[],
  engagementId: string
): Promise<{ success: boolean; linked: number; duplicatesRemoved?: number }> => {
  if (campaignIds.length === 0) {
    return { success: false, linked: 0 };
  }

  try {
    // Step 1: Get details of campaigns being linked
    const { data: sourceCampaigns } = await supabase
      .from('campaigns')
      .select('id, external_id, data_source_id')
      .in('id', campaignIds);

    if (!sourceCampaigns || sourceCampaigns.length === 0) {
      throw new Error('No campaigns found');
    }

    // Step 2: Check for duplicates in target engagement
    const externalIds = sourceCampaigns
      .filter(c => c.external_id && c.data_source_id)
      .map(c => c.external_id);

    const { data: existingCampaigns } = await supabase
      .from('campaigns')
      .select('id, external_id, data_source_id')
      .eq('engagement_id', engagementId)
      .in('external_id', externalIds);

    // Build lookup of existing external_id + data_source_id in target
    const existingSet = new Set(
      (existingCampaigns || []).map(c => `${c.external_id}:${c.data_source_id}`)
    );

    // Step 3: Split campaigns into safe-to-link and duplicates
    const safeToLink: string[] = [];
    const duplicatesToDelete: string[] = [];

    for (const campaign of sourceCampaigns) {
      const key = `${campaign.external_id}:${campaign.data_source_id}`;
      if (existingSet.has(key)) {
        // This campaign already exists in target - delete the source duplicate
        duplicatesToDelete.push(campaign.id);
      } else {
        safeToLink.push(campaign.id);
      }
    }

    // Step 4: Delete duplicates
    if (duplicatesToDelete.length > 0) {
      await supabase
        .from('campaigns')
        .delete()
        .in('id', duplicatesToDelete);
    }

    // Step 5: Link safe campaigns
    if (safeToLink.length > 0) {
      const { error } = await supabase
        .from('campaigns')
        .update({ engagement_id: engagementId })
        .in('id', safeToLink);

      if (error) throw error;
    }

    const linked = safeToLink.length;
    const removed = duplicatesToDelete.length;
    
    if (removed > 0 && linked > 0) {
      toast.success(`Linked ${linked} campaign(s), removed ${removed} duplicate(s)`);
    } else if (removed > 0) {
      toast.success(`Removed ${removed} duplicate campaign(s)`);
    } else if (linked > 0) {
      toast.success(`Linked ${linked} campaign${linked !== 1 ? 's' : ''}`);
    }

    return { success: true, linked, duplicatesRemoved: removed };
  } catch (err) {
    console.error('Error linking campaigns:', err);
    toast.error('Failed to link campaigns');
    return { success: false, linked: 0 };
  }
}, []);
```

---

## Testing

After implementation:
1. Go to GP Partners engagement report
2. Click "Link Campaigns"
3. Select campaigns that were previously failing
4. Verify they link successfully (duplicates get cleaned up automatically)
5. Check that the engagement report shows correct campaign data

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/hooks/useCampaignLinking.tsx` | Rewrite `linkCampaignsToEngagement` to detect and handle duplicate campaigns by deleting redundant copies before linking |
