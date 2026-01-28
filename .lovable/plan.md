
# Fix Plan: Campaign Linking Bug & AI-Powered Engagement Remapping

## Overview

This plan addresses two critical issues:
1. **Campaign linking dropdown causes page reload** - RLS policy conflict when updating `engagement_id`
2. **All campaigns incorrectly attributed to O2 Investment Auto Repair** - Need AI-powered remapping

---

## Phase 1: Fix Campaign Linking Dropdown Bug

### Root Cause
The `useCampaignLinking` hook passes `null` when "Unlinked" is selected, but:
- The RLS policy checks `engagement_id` relationship for permissions
- Setting to `null` breaks the relationship check
- The database update fails silently, causing a page state mismatch

### Solution
Update `useCampaignLinking.tsx` to use the "Unassigned" placeholder UUID instead of `null`:

```text
File: src/hooks/useCampaignLinking.tsx

Changes:
- Line 110: Change null handling to use sentinel UUID
- When "unlinked" selected, set engagement_id to '00000000-0000-0000-0000-000000000000'
- This maintains RLS relationship while marking as unassigned
```

### Also Fix EnhancedCampaignTable.tsx
- Line 574: Update `handleCampaignEngagementAssign` to pass the sentinel UUID instead of `null`

---

## Phase 2: Create AI-Powered Campaign Remapping Function

### New Edge Function: `ai-remap-campaigns`

Create a new edge function that uses **Lovable AI** (google/gemini-2.5-flash) to intelligently match campaigns to engagements.

```text
File: supabase/functions/ai-remap-campaigns/index.ts

Logic:
1. Fetch all campaigns currently linked to O2 Investment Auto Repair
2. Fetch all available engagements with their sponsor/portfolio data
3. For each campaign, use AI to:
   - Parse the campaign name structure
   - Identify sponsor keywords (Baum, Alpine, GP Partners, etc.)
   - Identify portfolio/client keywords
   - Match to the most appropriate engagement
4. Return proposed mappings for user review
5. On confirmation, execute batch update
```

### AI Prompt Design
```text
Given campaign name: "Baum - Property Management - SD - All Tiers"
Available engagements: [list with sponsor/portfolio data]

Task: Identify which engagement this campaign belongs to based on:
1. First segment usually = Sponsor name
2. Second segment usually = Portfolio company or service type
3. Remaining segments = Rep initials, tiers, variations

Return: { engagementId, confidence, reasoning }
```

---

## Phase 3: Add Remapping UI Component

### New Component: `CampaignRemapDialog.tsx`

A modal that:
1. Calls the AI remapping function
2. Shows proposed mappings in a reviewable table
3. Allows user to approve/reject individual mappings
4. Executes approved mappings in batch

```text
File: src/components/campaigns/CampaignRemapDialog.tsx

Features:
- Progress indicator during AI analysis
- Table showing: Campaign Name | Current | Proposed | Confidence | Approve checkbox
- "Apply Selected" button to execute approved mappings
- Color coding: Green (high confidence), Yellow (medium), Red (low/review needed)
```

---

## Phase 4: Update config.toml

Add the new edge function:
```text
[functions.ai-remap-campaigns]
verify_jwt = false
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useCampaignLinking.tsx` | Modify | Fix null handling, use sentinel UUID |
| `src/components/campaigns/EnhancedCampaignTable.tsx` | Modify | Pass sentinel UUID for unlink |
| `supabase/functions/ai-remap-campaigns/index.ts` | Create | AI-powered campaign matching |
| `src/components/campaigns/CampaignRemapDialog.tsx` | Create | UI for reviewing/approving mappings |
| `src/pages/Campaigns.tsx` | Modify | Add button to open remap dialog |
| `supabase/config.toml` | Modify | Register new edge function |

---

## Expected Outcomes

1. **Linking Fix**: Dropdown will work without page reload - campaigns can be linked/unlinked smoothly
2. **AI Remapping**: One-click solution to fix all 400+ misattributed campaigns
3. **Accuracy**: AI will correctly identify patterns like:
   - `"Baum - Property Management"` → Baum Capital Property Mgmt
   - `"Alpine - Windows & Doors"` → Alpine  
   - `"GP Partners - Collision"` → GP Partners
   - `"HTR Capital - Oilex"` → Oilex

---

## Technical Notes

- Uses **Lovable AI** (google/gemini-2.5-flash) - no additional API key required
- Batch processing to avoid rate limits
- Dry-run mode available for testing before applying changes
- All changes logged for audit trail
