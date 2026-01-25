# Top Calls Screen Redesign & Enhancement

## Overview

Redesign the Top Calls screen to be a comprehensive cold calling performance dashboard. This screen should help managers identify winning behaviors, coach reps, and surface the best calls for learning and recognition.

---

## PART 1: Redesign the Scoring System

**Replace the single "Score" with a weighted composite score that factors in:**

### Outcome-Based (50% of total score):
- Decision Maker reached: +2 points
- Meeting/appointment set: +3 points
- Genuine interest expressed: +1.5 points
- Referral obtained: +1 point
- Request for follow-up/more info: +1 point

### Conversation Quality (30% of total score):
- Call duration: Scale from 0-2 points (longer = better, cap at ~15 min)
- Talk-to-listen ratio: +1 point if rep talked 40-60% of the time
- Qualifying info uncovered: +0.5 points per item (revenue, EBITDA, ownership, timeline)
- Objection handled well: +1 point per objection

### Efficiency (20% of total score):
- First-attempt DM connection: +1.5 points
- Optimal call time (9-11am or 2-4pm): +0.5 points

**Normalize the final score to a 1-10 scale for easy comparison.**

Show users a tooltip or info icon explaining how scores are calculated.

---

## PART 2: New Top Stats Row

**Add a stats bar at the very top of the screen showing:**

| Total Calls | DM Connect Rate | Meetings Set | Avg Duration | Avg Score |
|-------------|-----------------|--------------|--------------|-----------|
| 247         | 12.3%           | 8            | 4m 32s       | 5.4       |

**Include comparison to previous period:**
- Show green/red arrows with percentage change
- "↑ 15% vs last week" or "↓ 8% vs last week"

---

## PART 3: Expanded Call Details (Click to Expand)

**When a user clicks on any call in the leaderboard, expand to show:**

### Left Side - Call Info:
- Prospect full name
- Company name
- Phone number
- Date and time of call
- Duration
- Rep name
- Linked campaign name
- Linked engagement (Sponsor + Client)

### Center - Audio & Transcript:
- Audio player with playback speed controls (1x, 1.5x, 2x)
- Full transcript below (scrollable, searchable)
- AI-generated 2-3 sentence summary at the top

### Right Side - Analysis:
- Disposition (what the rep marked it as)
- Interest level
- Meeting set: Yes/No
- Follow-up date if scheduled
- Rep notes

### Score Breakdown Panel:
- Visual breakdown showing how the score was calculated
- Example: "DM Reached +2 | Duration (13m) +2 | Meeting Set +3 | Talk Ratio +1 = 8.0"
- Show which areas earned points and which didn't

### AI Insights:
- Key topics discussed (tags/chips)
- Objections raised
- Qualifying info uncovered
- Prospect sentiment (positive/neutral/negative with trajectory)

---

## PART 4: Improved Leaderboard

**Enhance the Top 10 Leaderboard:**

- Keep ranking numbers with trophy icons for top 3
- Show: Rank | Prospect Name | Company | Rep | Duration | Disposition | Score
- Add a "DM" badge (you have this, keep it)
- Add a "Meeting Set" badge (calendar icon) for calls that booked meetings
- Add a "Hot Lead" flame icon for high-interest prospects
- Make entire row clickable to expand

**Add tabs or toggle above leaderboard:**
- "Top Scored" (default)
- "Meetings Set"
- "Longest Conversations"
- "Hot Leads"

---

## PART 5: Rep Performance Section

**Add a "Rep Leaderboard" card showing:**

| Rep Name      | Calls | DMs | Meetings | Avg Score | Trend |
|---------------|-------|-----|----------|-----------|-------|
| Soji Adimula  | 82    | 14  | 3        | 6.2       | ↑     |
| Nikita Oleinik| 71    | 11  | 2        | 5.8       | ↓     |

- Sortable by any column
- Click rep name to filter the call list to just their calls
- Show sparkline or trend indicator for week-over-week

---

## PART 6: Enhanced Pattern Analysis

**Expand the Pattern Analysis section to include:**

### What's Working:
- "Top performers mention [specific phrase] 3x more often"
- "Calls over 8 minutes convert to meetings 40% more"
- "Best connection times: Tuesday 10am, Thursday 2pm"

### Common Objections This Week:
- List top 3-5 objections heard
- Link to example calls where objections were handled well

### Winning Phrases:
- AI-extracted phrases from high-scoring calls
- "Try asking: [question that led to meetings]"

---

## PART 7: Calls Needing Attention Section

**Add a card for "Review These Calls":**

Show calls that:
- Scored 6.0-7.0 (borderline, may have teachable moments)
- Were long (8+ min) but didn't convert (what went wrong?)
- Had negative sentiment shift (started good, ended bad)
- Rep flagged for manager review

Label each with WHY it's flagged:
- "Long call, no meeting"
- "Potential coaching opportunity"
- "Objection handling"

---

## PART 8: Filtering & Time Selection

**Enhance filters at the top:**

- Date range picker (This Week, Last Week, This Month, Custom)
- Rep dropdown (All Reps, or select specific)
- Campaign dropdown
- Engagement dropdown
- Disposition filter (DM only, All, Meetings only)
- Minimum score slider

**Add "Compare" mode:**
- Select two time periods side by side
- "This week vs Last week" comparison view

---

## PART 9: Trends Section

**Add a small trends card or section showing:**

- Line chart: Average call score over past 4-8 weeks
- Line chart: DM connect rate over time
- Bar chart: Meetings set per week

Keep these small/compact — detailed analytics can live on a separate screen.

---

## PART 10: Layout Structure

**Reorganize the page layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  STATS ROW: Total Calls | DM Rate | Meetings | Avg Duration │
├─────────────────────────────────────────────────────────────┤
│  FILTERS: Date Range | Rep | Campaign | Disposition | Score │
├─────────────────────────────────┬───────────────────────────┤
│                                 │  Rep Leaderboard          │
│  Top 10 Calls Leaderboard       ├───────────────────────────┤
│  (with tabs: Top/Meetings/Long) │  Pattern Analysis         │
│                                 │  (expanded insights)      │
│  [Expandable rows]              ├───────────────────────────┤
│                                 │  Trends Mini-Charts       │
├─────────────────────────────────┼───────────────────────────┤
│  Calls Needing Review           │  Hot Leads (keep this)    │
├─────────────────────────────────┴───────────────────────────┤
│  Call of the Week (keep this, move to bottom as highlight)  │
└─────────────────────────────────────────────────────────────┘
```

---

## PART 11: Keep & Improve Existing Features

**Call of the Week:** Keep as-is, it's good for recognition. Consider adding a "Nominate" button for managers.

**Hot Leads:** Keep this section. Add ability to click through to the lead record or call details.

**Create Training Module:** Keep this button. When clicked, it should pull patterns and examples from the currently filtered calls.

---

## Data Requirements

Make sure we're capturing/storing:
- All call metadata (duration, time, rep, disposition)
- Call recordings and transcripts
- AI analysis results (sentiment, topics, objections)
- Outcome tracking (meeting set, follow-up scheduled)
- Interest scores
- Link to campaign and engagement

If any of this data isn't currently being captured from Phone Burner, flag what's missing.
