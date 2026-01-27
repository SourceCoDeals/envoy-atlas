
# Change Week Labels to Show Monday Start Date

## Current Behavior
The chart currently displays week **end** dates (Saturdays) as labels, using `weekStartsOn: 0` (Sunday-based weeks). For example, "Nov 15" represents Saturday, the end of that week.

## Requested Change
Display the **Monday start date** of each week as the label instead of the Saturday end date.

## Technical Changes

### File: `src/hooks/useOverviewDashboard.tsx`

**Lines 333-337** - Update the week label generation:

```typescript
// Current code:
const weekEnd = endOfWeek(subWeeks(today, i), { weekStartsOn: 0 });
const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 0 });
const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
const weekLabel = format(weekEnd, 'MMM d');  // Shows Saturday

// New code:
const weekEnd = endOfWeek(subWeeks(today, i), { weekStartsOn: 1 });   // Week ends Sunday
const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 }); // Week starts Monday
const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
const weekLabel = format(weekStart, 'MMM d');  // Shows Monday (start of week)
```

**Lines 357-376** - Update snapshot delta aggregation to use Monday-based weeks:

```typescript
// Update weekStartsOn from 0 to 1 in all endOfWeek/startOfWeek calls
const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
```

**Lines 383-386** - Update daily_metrics fallback to use Monday-based weeks:

```typescript
const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
```

## Summary of Changes

| Location | Change |
|----------|--------|
| Week bucket creation (line 334-337) | Use `weekStartsOn: 1` and format `weekStart` for label |
| Snapshot aggregation (line 359, 375) | Use `weekStartsOn: 1` for consistency |
| Daily metrics fallback (line 385) | Use `weekStartsOn: 1` for consistency |

## Result

The chart x-axis will display Monday dates like:
- "Nov 11" (Monday) instead of "Nov 15" (Saturday)
- "Nov 18" (Monday) instead of "Nov 22" (Saturday)
- etc.

This creates a more intuitive business week representation (Mon-Sun).
