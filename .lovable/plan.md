
Goal
- Make the “Email Performance Summary” for the GP Partners engagement match what you see in SmartLead by ensuring the Engagement Report uses the correct underlying data source and the correct time-window.

What’s happening (root cause)
- The Engagement Report currently computes the Email Performance Summary primarily from `daily_metrics` when a date range is selected (e.g., “Last 30 days”).
- For GP Partners, there are a few `daily_metrics` rows (often estimated/backfilled), so the report treats them as “real” and uses those small totals.
- At the same time, the report is already fetching NocoDB snapshot data (`nocodb_campaign_daily_snapshots`) and even marks `dataAvailability.dataSource` as `snapshots`, but it does not actually use snapshots to calculate the summary totals.
- Result: the UI shows snapshot-backed labeling, but the numbers are coming from `daily_metrics`, so the totals are not aligned with SmartLead.

High-level fix
- When snapshot data exists for the linked campaigns, compute period totals from snapshot deltas (day-over-day changes) and use that for:
  - Emails Sent
  - Delivered (derived)
  - Replied
  - Positive Replies
  - Bounced
- Only fall back to `daily_metrics` when snapshot data is missing.

Implementation plan (code changes)

1) Update `useEngagementReport` to compute email totals from snapshot deltas
File: `src/hooks/useEngagementReport.tsx`

A. Fetch snapshot deltas (filtered) in addition to snapshots
- Add a query to the view `nocodb_campaign_daily_deltas` filtered by:
  - `campaign_id in externalCampaignIds`
  - `snapshot_date >= startDateStr` when a start date exists
  - `snapshot_date <= endDateStr` when an end date exists
- This view already has:
  - `emails_sent_delta`
  - `emails_replied_delta`
  - `emails_bounced_delta`
  - `positive_delta`

B. Build `snapshotTotals` from the deltas
- Reduce deltas into:
  - `sent = sum(emails_sent_delta)`
  - `replied = sum(emails_replied_delta)`
  - `bounced = sum(emails_bounced_delta)`
  - `positive = sum(positive_delta)`
  - `delivered = max(0, sent - bounced)`

C. Change the “final totals selection” logic to prefer snapshots when available
- Current behavior:
  - If date range is selected and `dailyTotals.sent > 0`, it uses `daily_metrics` totals even if snapshots exist.
- New behavior:
  - If snapshot deltas exist for the engagement’s linked campaigns in the selected date range:
    - Use `snapshotTotals` for the Email Performance Summary and key metrics calculations (touchpoints, response rate, etc.).
  - Else, if no snapshot deltas:
    - Use `daily_metrics` totals if present
    - Else fall back to all-time campaign totals (current logic)

D. Make `dataAvailability` consistent with the actual source used
- Update `dataAvailability.dataSource` to reflect what we truly used:
  - `snapshots` if snapshot deltas were used
  - `daily_metrics` if daily totals were used
  - `campaign_totals` / `estimated` only if those were used
- Update `emailCampaignFallback` so it no longer checks only `(campaigns.total_sent > 0)` (which can be stale/zero for SmartLead-synced rows). Instead:
  - Use `campaignTotals.sent > 0` or `snapshotTotals.sent > 0` to decide if fallback should be offered.

2) Fix per-campaign rate math to match the “delivered-denominator” convention
File: `src/hooks/useEngagementReport.tsx`

- In `linkedCampaignsWithStats`, rates are currently computed using `sent` as the denominator:
  - `replyRate: calculateRate(replied, sent)`
  - `positiveRate: calculateRate(positive, sent)`
- Update to match the rest of the app’s rule (“delivered is the denominator for engagement rates”):
  - For SmartLead:
    - delivered = sent - total_bounces
    - replyRate = replied / delivered
    - positiveRate = positive / delivered
  - For Reply.io:
    - delivered = deliveries
    - replyRate = replies / delivered
    - (positive remains untracked)

This makes the per-campaign list and the summary consistent and closer to SmartLead’s view.

3) (Optional but recommended) Add a small “Data Source” badge to the Email tab summary
File: `src/components/engagementReport/EmailReportTab.tsx`

- Add a compact badge near “Email Performance Summary” that shows something like:
  - “Source: Snapshots” (and ideally “as of {latest snapshot date}”)
- This reduces confusion and makes it obvious why a number might differ (e.g., if SmartLead has updated in the last few hours and the latest snapshot is from yesterday).

Edge cases to handle
- Engagements with very new campaigns (only 1 snapshot):
  - Delta logic should still work (first delta typically equals the first observed total).
- Engagements with snapshot data but sparse `daily_metrics` (estimated rows):
  - We will now prefer snapshots, preventing estimated `daily_metrics` from overriding accurate snapshot-derived totals.
- Engagements with no snapshot data:
  - Behavior remains as-is (use daily_metrics if available, else campaign totals).

How we’ll verify (quick acceptance tests)
1) Open /engagements/432cd24b-a1f4-4f64-a0eb-82e2ac5f1e26/report
2) On “Last 30 days”:
   - Email Performance Summary should reflect the snapshot-based deltas in that date window (not the small estimated daily_metrics totals).
3) Switch to “All time”:
   - Totals should align closely with SmartLead totals for the same campaigns (accounting for last snapshot timestamp).
4) Confirm per-campaign list rates look reasonable and use delivered denominators (reply/positive rates shouldn’t be artificially low/high due to bounces).

Files expected to change
- `src/hooks/useEngagementReport.tsx` (primary fix: snapshot-delta totals selection + per-campaign rate denominator fixes + dataAvailability consistency)
- `src/components/engagementReport/EmailReportTab.tsx` (optional: show data source badge/last snapshot date)

Non-goals (for this iteration)
- Perfect real-time parity with SmartLead minute-by-minute (snapshots are periodic).
- Rebuilding estimated daily_metrics logic; we’ll simply ensure it doesn’t override snapshot truth when snapshots exist.
