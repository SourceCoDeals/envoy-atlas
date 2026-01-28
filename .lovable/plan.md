
# Add Explanatory Tooltips to All Dashboard/Report Metrics

## Overview
Add informative tooltips to every metric value and column header across all dashboards and reports in both email and calling tabs. These tooltips will explain how each value is calculated, what data source it uses, and what thresholds/benchmarks apply.

## Scope Analysis

### Components Requiring Tooltips

**Email Dashboards:**
| Component | File | Metrics Needing Tooltips |
|-----------|------|-------------------------|
| HeroMetricsGrid | `src/components/dashboard/HeroMetricsGrid.tsx` | Emails Sent, Reply Rate, Positive Reply Rate, Meeting Booked Rate |
| WeeklyPerformanceChart | `src/components/dashboard/WeeklyPerformanceChart.tsx` | Chart legend items (already has data source tooltip) |
| CampaignAlertsTable | `src/components/dashboard/CampaignAlertsTable.tsx` | Column headers |
| TopPerformersTable | `src/components/dashboard/TopPerformersTable.tsx` | Column headers |
| TodaysPulseBar | `src/components/dashboard/TodaysPulseBar.tsx` | Today's metrics |

**Calling Dashboards:**
| Component | File | Metrics Needing Tooltips |
|-----------|------|-------------------------|
| FunnelMetrics | `src/components/calling/FunnelMetrics.tsx` | Dials, Connects, Completed, Meetings, Activated, Talk Time, Avg Score |
| CallerPerformanceTable | `src/components/calling/CallerPerformanceTable.tsx` | All column headers (Calls, Connects, Connect Rate, Meetings, Meeting Rate, Positive %, Avg Score, Status) |
| InterestBreakdownCards | `src/components/calling/InterestBreakdownCards.tsx` | Yes/Maybe/No/Unknown cards |
| DispositionPieChart | `src/components/calling/DispositionPieChart.tsx` | Category labels |
| WeeklyTrendChart | `src/components/calling/WeeklyTrendChart.tsx` | Legend items |
| CoachingInsightsPanel | `src/components/calling/CoachingInsightsPanel.tsx` | Top Calls, Needs Coaching thresholds |
| ScoreCard | `src/components/callinsights/ScoreCard.tsx` | Score descriptions |

**Data Insights:**
| Component | File | Metrics Needing Tooltips |
|-----------|------|-------------------------|
| MetricCardWithBenchmark | `src/components/datainsights/MetricCardWithBenchmark.tsx` | All metric cards with benchmark context |
| ConversionFunnel | `src/components/datainsights/ConversionFunnel.tsx` | Already has popover (recently added) |
| CallTimingHeatmap | `src/components/datainsights/CallTimingHeatmap.tsx` | Hour cells, day labels |

**Engagement Dashboard:**
| Component | File | Metrics Needing Tooltips |
|-----------|------|-------------------------|
| EngagementDashboard | `src/pages/EngagementDashboard.tsx` | Table headers: Emails, Replies, +Replies, Calls, Meetings |
| EngagementReport | `src/pages/EngagementReport.tsx` | All metric cards and chart labels |

---

## Implementation Strategy

### 1. Create Reusable MetricTooltip Component
Create a new shared component that wraps any metric label/value with a standardized tooltip format.

**File:** `src/components/ui/metric-tooltip.tsx`

```text
Props:
- metricKey: string (e.g., 'connect_rate', 'reply_rate')
- children: ReactNode (the label/value to wrap)
- variant?: 'label' | 'value' | 'icon' (display style)

Behavior:
- Looks up metric definition from a centralized METRIC_DEFINITIONS map
- Shows on hover: name, formula, description, benchmark (if applicable)
- Optional info icon indicator
```

### 2. Create Centralized Metric Definitions
Consolidate all metric explanations in one file, leveraging existing `src/lib/metrics.ts` documentation.

**File:** `src/lib/metricDefinitions.ts`

```text
Structure:
{
  [metricKey]: {
    name: string,
    formula: string,
    description: string,
    benchmark?: string,
    dataSource?: string,
    dispositions?: string[] // for calling metrics
  }
}

Categories:
- Email metrics (reply_rate, bounce_rate, positive_rate, etc.)
- Calling metrics (connect_rate, meeting_rate, conversation_rate, etc.)
- AI score metrics (composite_score, seller_interest, etc.)
- Engagement metrics (emails_sent, total_replies, positive_replies)
```

### 3. Update Individual Components

**Phase 1 - High Priority (most visible):**
1. `HeroMetricsGrid.tsx` - Add tooltip to each metric label
2. `FunnelMetrics.tsx` - Add tooltip to each funnel card label
3. `CallerPerformanceTable.tsx` - Add tooltip to each column header
4. `MetricCardWithBenchmark.tsx` - Add tooltip with formula explanation
5. `ScoreCard.tsx` - Enhance description to show score thresholds

**Phase 2 - Medium Priority:**
6. `InterestBreakdownCards.tsx` - Add tooltip explaining Yes/Maybe/No thresholds
7. `DispositionPieChart.tsx` - Add tooltip to category labels
8. `EngagementDashboard.tsx` - Add tooltip to table column headers
9. `TodaysPulseBar.tsx` - Add tooltip to pulse metrics

**Phase 3 - Lower Priority:**
10. Various chart legends and axis labels
11. Report-specific metrics in EngagementReport

---

## Technical Details

### MetricTooltip Component Structure

```text
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex items-center gap-1 cursor-help">
        {children}
        {showIcon && <Info className="h-3 w-3 text-muted-foreground" />}
      </span>
    </TooltipTrigger>
    <TooltipContent className="max-w-xs">
      <div className="space-y-1">
        <p className="font-medium">{definition.name}</p>
        <p className="text-xs text-muted-foreground">{definition.description}</p>
        <code className="text-xs bg-muted px-1 rounded">{definition.formula}</code>
        {definition.benchmark && (
          <p className="text-xs text-success">Benchmark: {definition.benchmark}</p>
        )}
      </div>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Metric Definitions Sample

```text
// Email
'reply_rate': {
  name: 'Reply Rate',
  formula: '(replied / delivered) × 100',
  description: 'Percentage of delivered emails that received a reply. Uses delivered (sent - bounced) as denominator for accuracy.',
  benchmark: '> 5% good, > 2% average'
}

// Calling  
'connect_rate': {
  name: 'Connect Rate',
  formula: '(connections / totalCalls) × 100',
  description: 'Percentage of calls that resulted in speaking with a human. Connections are calls with talk_duration > 30 seconds or specific dispositions.',
  benchmark: '25-35% good, < 20% warning',
  dispositions: ['Meeting Booked', 'Callback Requested', 'Send Email', 'Not Interested', ...]
}

// AI Scores
'composite_score': {
  name: 'Composite Score',
  formula: 'avg(interest, quality, objection, value, script, dm, referral)',
  description: 'Average of 7 AI-scored dimensions on a 1-10 scale.',
  benchmark: '≥ 7 excellent, 5-6.9 good, < 5 needs coaching'
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/metricDefinitions.ts` | Centralized metric definitions (~150 lines) |
| `src/components/ui/metric-tooltip.tsx` | Reusable tooltip wrapper (~50 lines) |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/HeroMetricsGrid.tsx` | Wrap metric labels with MetricTooltip |
| `src/components/calling/FunnelMetrics.tsx` | Wrap card labels with MetricTooltip |
| `src/components/calling/CallerPerformanceTable.tsx` | Wrap TableHead cells with MetricTooltip |
| `src/components/datainsights/MetricCardWithBenchmark.tsx` | Add info icon + tooltip to label |
| `src/components/callinsights/ScoreCard.tsx` | Add threshold info to tooltip |
| `src/components/calling/InterestBreakdownCards.tsx` | Add threshold explanations |
| `src/components/calling/DispositionPieChart.tsx` | Add category tooltips |
| `src/pages/EngagementDashboard.tsx` | Add tooltips to table headers (~10 lines) |
| `src/components/dashboard/TodaysPulseBar.tsx` | Wrap metrics with tooltips |

---

## Example Usage After Implementation

```text
// Before:
<TableHead>Connect Rate</TableHead>

// After:
<TableHead>
  <MetricTooltip metricKey="connect_rate">
    Connect Rate
  </MetricTooltip>
</TableHead>
```

This approach ensures:
1. **Consistency**: All metrics use the same tooltip format
2. **Maintainability**: Definitions live in one place, easy to update
3. **Discoverability**: Users can learn about any metric by hovering
4. **No UI clutter**: Tooltips appear on hover, not always visible
