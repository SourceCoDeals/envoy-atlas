
# Fix Lead Enrollment Status Incorrect Values

## Problem Identified
The "Lead Enrollment Status" section on the GP Partners engagement report is showing incorrect "Total Enrolled" values because of a **type coercion bug** in the enrollment metrics calculation.

### Root Cause
The `settings` JSON field in the `campaigns` table stores numeric values as **strings** for some campaigns (e.g., `"total_leads": "7024"` instead of `"total_leads": 7024`).

When the JavaScript code adds these values:
```javascript
totalLeads: acc.totalLeads + (settings?.total_leads || 0)
```

If `settings.total_leads` is a string `"7024"`, JavaScript performs string concatenation instead of numeric addition:
- `0 + "7024"` = `"07024"` (string)
- Then `"07024" + "7129"` = `"070247129"` (garbage)

### Expected Values (from database)
| Metric | Correct Value |
|--------|---------------|
| Total Enrolled | 28,730 |
| Not Started | 3,868 |
| In Progress | 708 |
| Completed | 94 |
| Blocked | 213 |

---

## Solution

### File: `src/hooks/useEngagementReport.tsx`

**Lines 754-763** - Fix the type coercion by explicitly parsing values as integers:

```typescript
// Current (buggy):
const campaignEnrollment = (campaigns || []).reduce((acc, c) => {
  const settings = c.settings as Record<string, number> | null;
  return {
    totalLeads: acc.totalLeads + (settings?.total_leads || 0),
    notStarted: acc.notStarted + (settings?.not_started || 0),
    inProgress: acc.inProgress + (settings?.in_progress || 0),
    completed: acc.completed + (settings?.completed || 0),
    blocked: acc.blocked + (settings?.blocked || 0),
  };
}, { totalLeads: 0, notStarted: 0, inProgress: 0, completed: 0, blocked: 0 });
```

```typescript
// Fixed:
const campaignEnrollment = (campaigns || []).reduce((acc, c) => {
  const settings = c.settings as Record<string, any> | null;
  // Parse all values as integers to handle string-typed JSON values
  const parseNum = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseInt(val, 10) || 0;
    return 0;
  };
  return {
    totalLeads: acc.totalLeads + parseNum(settings?.total_leads),
    notStarted: acc.notStarted + parseNum(settings?.not_started),
    inProgress: acc.inProgress + parseNum(settings?.in_progress),
    completed: acc.completed + parseNum(settings?.completed),
    blocked: acc.blocked + parseNum(settings?.blocked),
  };
}, { totalLeads: 0, notStarted: 0, inProgress: 0, completed: 0, blocked: 0 });
```

---

## Technical Implementation

1. **Create a helper function** `parseNum()` that safely converts string or number values to integers
2. **Update the reduce function** to use this helper for all enrollment metric fields
3. **Type the settings correctly** as `Record<string, any>` since values can be strings or numbers

---

## Testing

After the fix:
- Navigate to GP Partners engagement report
- Verify "Lead Enrollment Status" shows:
  - Total Enrolled: **28,730**
  - Backlog (Not Started): **3,868** (13.5% of enrolled)
  - In Progress: **708**
  - Completed: **94**

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/hooks/useEngagementReport.tsx` | Add `parseNum` helper and apply it to enrollment metric aggregation (lines 754-763) |
