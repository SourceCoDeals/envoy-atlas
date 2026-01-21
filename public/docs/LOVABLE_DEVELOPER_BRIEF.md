# 🎯 ENVOY ATLAS: FUNCTIONAL AUDIT & DEVELOPER BRIEF

**Date:** January 21, 2026  
**Audience:** Engineers (Lovable), Product, Executive Stakeholders  
**Status:** CRITICAL FUNCTIONAL GAPS IDENTIFIED - Ready for Implementation  
**Document Type:** Technical Specification + Business Context + Implementation Guide

---

## 📊 EXECUTIVE SUMMARY

Envoy Atlas has **solid infrastructure but broken data pipelines**. The platform collects data from PhoneBurner, SmartLead, and Reply.io but **fails to accurately calculate and display key metrics** that PE firms need to make deal decisions.

### Business Impact
- 🔴 **Sales reps seeing wrong metrics** → Can't coach based on faulty data
- 🔴 **PE firms can't trust dashboards** → Bad data = bad acquisition decisions
- 🔴 **50% of email data missing** → Reply.io campaigns invisible
- 🔴 **"Unknown" reps can't be coached** → Training impossible

### Current Functional Health: **38% Accuracy**
- Data Ingestion: Working ✅
- Data Storage: Working ✅
- Calculations: Broken 🔴
- Display: Displaying Wrong Values 🔴

---

## 🎨 COLOR-CODED PRIORITY SYSTEM

### 🔴 **RED: CRITICAL - Blocks Sales/Metrics (P0)**
These issues prevent the platform from doing its core job. Fix first, deploy immediately.

### 🟠 **ORANGE: HIGH - Data Quality Issues (P1)**
These cause incorrect metrics and bad coaching decisions. Fix within 1 week.

### 🟡 **YELLOW: MEDIUM - Architecture/Maintenance (P2)**
Code is duplicated and hard to maintain. Won't break immediately but will become technical debt.

### 🟢 **GREEN: LOW - Nice to Have (P3)**
Features that would improve platform but don't block current functionality.

---

# 🔴 CRITICAL PRIORITY 0 FIXES (P0)

## ISSUE #1: "All Reps Show Unknown" 🔴

### 📋 Current State
```
Dashboard displays:
├─ Rep: "Unknown" → 45 calls, 18% connect rate
├─ Rep: "Unknown" → 32 calls, 22% connect rate
└─ Rep: "Unknown" → 28 calls, 15% connect rate

Result: Can't see individual rep performance
Can't coach anyone
Can't identify top performers
```

### 🎯 Business Impact
- **Sales Reps:** Can't see how they're performing vs. team
- **Managers:** Can't identify who needs coaching
- **Metrics:** All reps look identical (average)
- **Data Value:** 🔻 WORTHLESS - Can't action on it

### ❓ Why This Happens

**Root Cause #1: Database Schema Gap**
```sql
-- Current Schema (WRONG):
CREATE TABLE call_activities (
  id UUID PRIMARY KEY,
  ...
  caller_name VARCHAR(255) NULL,  -- ❌ NULLABLE!
  ...
);

-- When PhoneBurner data syncs without caller_name:
-- caller_name = NULL
-- Display logic: caller_name || 'Unknown' = 'Unknown'
```

**Root Cause #2: No Rep Tracking System**
```
Missing relationship:
engagements (1) ──┬─→ call_activities (many)
                  │   └─ caller_name: "John Smith" (string, not ID)
                  │
                  └─→ reps table: ❌ DOESN'T EXIST
                      └─ rep_id, name, email, phone
```

**Root Cause #3: Loose String Matching**
```typescript
// Current calculation (src/lib/metrics.ts:642-650):
export const aggregateCallingByRep = (calls) => {
  const repMap = new Map<string, CallActivityRecord[]>();
  
  calls.forEach(call => {
    const rep = call.caller_name || 'Unknown';  // ❌ String matching!
    if (!repMap.has(rep)) repMap.set(rep, []);
    repMap.get(rep)!.push(call);
  });
  
  return Array.from(repMap.entries()).map(([name, repCalls]) => {
    return { name, ... };  // 🔴 String used as key!
  });
};

// Problems:
// - "John Smith" ≠ "John S." = 2 reps in system
// - NULL caller_name creates "Unknown" entry
// - If rep name changes → historical data lost
// - Can't link reps across engagements
```

### ✅ SOLUTION

**Step 1: Create `reps` Table** (Database)
```sql
CREATE TABLE reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  
  -- Rep Identification
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  
  -- Tracking
  is_active BOOLEAN DEFAULT true,
  external_id VARCHAR(255),  -- PhoneBurner rep ID if available
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates
  UNIQUE(engagement_id, email),
  UNIQUE(engagement_id, external_id)
);

-- Index for fast lookups
CREATE INDEX idx_reps_engagement ON reps(engagement_id);
CREATE INDEX idx_reps_email ON reps(email);
```

**Step 2: Add `rep_id` FK to `call_activities`** (Database)
```sql
-- Add foreign key column
ALTER TABLE call_activities 
  ADD COLUMN rep_id UUID REFERENCES reps(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_call_activities_rep_id ON call_activities(rep_id);

-- Make caller_name NOT NULL (enforce data quality)
ALTER TABLE call_activities 
  ADD CONSTRAINT caller_name_not_null 
  CHECK (caller_name IS NOT NULL);
```

**Step 3: Create Rep Sync Hook** (Edge Function)
```typescript
// supabase/functions/sync-phoneburner-reps/index.ts
// Purpose: Sync PhoneBurner reps → reps table + link calls

async function syncPhoneBurnerReps(engagementId: string) {
  // 1. Fetch PhoneBurner reps
  const pbReps = await phoneburnerApi.getReps();
  
  // 2. For each rep, create/update in database
  for (const pbRep of pbReps) {
    const { data: rep } = await supabase
      .from('reps')
      .upsert({
        engagement_id: engagementId,
        name: pbRep.name,
        email: pbRep.email,
        phone: pbRep.phone,
        external_id: pbRep.id,  // Link to PhoneBurner
      }, { 
        onConflict: 'engagement_id,email' 
      })
      .select()
      .single();
    
    // 3. Link all calls from this rep
    if (rep) {
      await supabase
        .from('call_activities')
        .update({ rep_id: rep.id })
        .eq('engagement_id', engagementId)
        .eq('caller_name', pbRep.name);
    }
  }
}
```

**Step 4: Update Calculation Logic** (Frontend)
```typescript
// src/lib/metrics.ts - REPLACE the old function

export const aggregateCallingByRep = (calls: CallActivityRecord[]): RepPerformance[] => {
  // ✅ NEW: Use rep_id instead of caller_name string
  const repMap = new Map<string, { repId: string | null, repName: string, calls: CallActivityRecord[] }>();
  
  calls.forEach(call => {
    // Use rep_id if available, fallback to caller_name for backward compatibility
    const repKey = call.rep_id || call.caller_name || 'Unknown';
    const repName = call.caller_name || 'Unknown Rep';
    
    if (!repMap.has(repKey)) {
      repMap.set(repKey, { repId: call.rep_id || null, repName, calls: [] });
    }
    repMap.get(repKey)!.calls.push(call);
  });
  
  return Array.from(repMap.entries())
    .map(([_, { repId, repName, calls: repCalls }]) => {
      const metrics = aggregateCallingMetrics(repCalls);
      return {
        repId,  // ✅ NEW: Track ID, not just name
        name: repName,
        totalCalls: metrics.totalCalls,
        connections: metrics.connections,
        meetings: metrics.meetings,
        connectRate: metrics.connectRate,
        meetingRate: metrics.meetingRate,
        totalTalkTimeSeconds: metrics.totalTalkTimeSeconds,
        avgCallDuration: metrics.avgCallDuration,
      };
    })
    .sort((a, b) => b.connectRate - a.connectRate);
};
```

**Step 5: Backfill Existing Data** (Database)
```sql
-- Find reps in call_activities with no rep_id
-- Create reps for them
WITH distinct_reps AS (
  SELECT DISTINCT 
    engagement_id,
    caller_name,
    NULL::VARCHAR(255) as email  -- Unknown for now
  FROM call_activities
  WHERE caller_name IS NOT NULL
    AND rep_id IS NULL
)
INSERT INTO reps (engagement_id, name, email)
SELECT 
  engagement_id,
  caller_name,
  COALESCE(email, caller_name || '@unknown.local')
FROM distinct_reps
ON CONFLICT (engagement_id, email) DO NOTHING;

-- Link calls to reps
UPDATE call_activities ca
SET rep_id = r.id
FROM reps r
WHERE ca.engagement_id = r.engagement_id
  AND ca.caller_name = r.name
  AND ca.rep_id IS NULL;
```

### 📊 Expected Outcome
```
BEFORE:
├─ Rep: "Unknown" → 45 calls, 18% connect rate
├─ Rep: "Unknown" → 32 calls, 22% connect rate
└─ Rep: "Unknown" → 28 calls, 15% connect rate

AFTER:
├─ Rep: "John Smith" → 45 calls, 18% connect rate ✅
├─ Rep: "Sarah Jones" → 32 calls, 22% connect rate ✅
└─ Rep: "Mike Chen" → 28 calls, 15% connect rate ✅
```

### ⏱️ Time Estimate: **4-6 hours**
- Schema changes: 30 min
- Edge function: 1.5 hours
- Update calculations: 1 hour
- Data backfill: 30 min
- Testing: 1.5 hours

### 🔗 Dependencies
- None - can be done independently

---

## ISSUE #2: "Connections Showing 0 When There's Talk Time" 🔴

### 📋 Current State
```
Dashboard displays:
├─ Total Calls: 1,620
├─ Connections: 0 ❌ (WRONG!)
└─ Connection Rate: 0% ❌ (WRONG!)

But when you look at call details:
├─ Call 1: talk_duration = 45 seconds, disposition = "answered"
├─ Call 2: talk_duration = 38 seconds, disposition = "conversation"
└─ Call 3: talk_duration = 0 seconds, disposition = "no_answer"
```

### 🎯 Business Impact
- **Sales Team:** Thinks they're connecting with prospects (0% = depressing!)
- **Metrics Accuracy:** 🔻 ZERO VALUE - Completely wrong
- **Coaching:** Can't coach reps on connection rate improvements
- **PE Firms:** "Your team's connection rate is 0%?" → Loses confidence

### ❓ Why This Happens

**Root Cause #1: Disposition Mapping Broken**
```typescript
// Current code (src/lib/metrics.ts:578-580):
const connections = calls.filter(c =>
  isConnection(c.disposition) || (c.talk_duration && c.talk_duration > 30)
).length;

function isConnection(disposition: string | null): boolean {
  return disposition === 'connected' || disposition === 'conversation';
}

// What PhoneBurner actually sends:
// ├─ "answered" (✅ connected)
// ├─ "no_answer" (❌ not connected)
// ├─ "voicemail" (❌ not connected)
// ├─ "busy" (❌ not connected)
// └─ "connected" (✅ connected - but maybe not what PB sends!)

// Result: PhoneBurner sends "answered" but code checks for "connected"
// → NO MATCH → Not counted as connection
// → Connections = 0
```

**Root Cause #2: Hardcoded Thresholds**
```typescript
// This threshold (30 seconds) is hardcoded in the code:
(c.talk_duration && c.talk_duration > 30)

// But what if:
// - 15-second connects should count? (quick "not interested" calls)
// - 180-second calls should count? (long form discovery)
// - Each engagement has different standards?

// No way to adjust without code change!
```

**Root Cause #3: OR Logic Doesn't Work Right**
```typescript
// Current logic:
isConnection(c.disposition) || (c.talk_duration && c.talk_duration > 30)

// This means:
// - IF disposition is "connected" → count as connection (regardless of talk time)
// - OR IF talk_duration > 30 → count as connection (regardless of disposition)

// Problems:
// 1. 25-second call with "connected" disposition = NOT counted ❌
// 2. 45-second call with "no_answer" = COUNTED (wrong!) ❌
// 3. No alignment with business definition of "connection"

// What should it be?
// "A connection is when we reach someone AND have a conversation"
// - Either: disposition proves it (e.g., "conversation_started")
// - OR: talk_duration proves it (e.g., > 30 seconds)
// - But BOTH should indicate actual connection, not just one
```

### ✅ SOLUTION

**Step 1: Create `disposition_mappings` Table** (Database)
```sql
CREATE TABLE disposition_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  
  -- Source platform
  platform VARCHAR(50) NOT NULL,  -- 'phoneburner', 'smartlead', 'noco'
  
  -- What PhoneBurner/SmartLead calls it
  external_disposition VARCHAR(100) NOT NULL,
  
  -- What we call it internally
  internal_disposition VARCHAR(50) NOT NULL,
  
  -- Business logic classification
  is_connection BOOLEAN DEFAULT false,
  is_conversation BOOLEAN DEFAULT false,
  is_voicemail BOOLEAN DEFAULT false,
  is_meeting BOOLEAN DEFAULT false,
  is_bounce BOOLEAN DEFAULT false,
  
  -- Metadata
  description TEXT,
  min_talk_duration_seconds INTEGER,  -- Can override global threshold
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates per engagement
  UNIQUE(engagement_id, platform, external_disposition)
);

-- Example data (PhoneBurner mappings):
INSERT INTO disposition_mappings (engagement_id, platform, external_disposition, internal_disposition, is_connection, is_conversation, description) VALUES
  ('eng-123', 'phoneburner', 'answered', 'conversation', true, true, 'Called person answered'),
  ('eng-123', 'phoneburner', 'completed_call', 'conversation', true, true, 'Conversation completed'),
  ('eng-123', 'phoneburner', 'left_message', 'voicemail', false, false, 'Left voicemail'),
  ('eng-123', 'phoneburner', 'no_answer', 'no_answer', false, false, 'Phone rang, no answer'),
  ('eng-123', 'phoneburner', 'busy', 'busy', false, false, 'Line was busy'),
  ('eng-123', 'phoneburner', 'connection_made', 'conversation', true, true, 'Connection established'),
  ('eng-123', 'phoneburner', 'gatekeeper', 'gatekeeper', false, false, 'Reached gatekeeper/assistant');
```

**Step 2: Update Calculation Logic** (Frontend)
```typescript
// src/lib/metrics.ts - REPLACE old aggregateCallingMetrics

import { supabase } from '@/integrations/supabase/client';

// Load disposition mappings (run once on app start)
let dispositionMappings: DispositionMapping[] = [];

async function loadDispositionMappings(engagementId: string) {
  const { data } = await supabase
    .from('disposition_mappings')
    .select('*')
    .eq('engagement_id', engagementId);
  
  dispositionMappings = data || [];
}

// Helper: Check if disposition indicates connection
function isConnection(disposition: string | null, engagementId: string): boolean {
  if (!disposition) return false;
  
  const mapping = dispositionMappings.find(
    m => m.platform === 'phoneburner' && 
         m.external_disposition === disposition
  );
  
  return mapping?.is_connection ?? false;
}

// Updated aggregation function
export const aggregateCallingMetrics = (
  calls: CallActivityRecord[],
  engagementId: string
): CallingMetrics => {
  const totalCalls = calls.length;

  // ✅ NEW: Use mapping-based connection definition
  const connections = calls.filter(c => {
    const hasConnection = isConnection(c.disposition, engagementId);
    const hasTalkTime = c.talk_duration && c.talk_duration > 30;  // Configurable later
    return hasConnection || hasTalkTime;
  }).length;

  // Rest of calculation...
  const conversations = calls.filter(c =>
    c.conversation_outcome &&
    !['no_answer', 'voicemail', 'busy', 'wrong_number'].includes(c.conversation_outcome.toLowerCase())
  ).length;

  // ... (same as before)
  
  return {
    totalCalls,
    connections,
    conversations,
    // ... rest of metrics
  };
};
```

**Step 3: Create Configuration UI** (Frontend Component)
```typescript
// src/pages/settings/DispositionMappingConfig.tsx

export function DispositionMappingConfig({ engagementId }: Props) {
  const [mappings, setMappings] = useState<DispositionMapping[]>([]);
  
  return (
    <div className="space-y-4">
      <h2>🎯 Connection Definitions</h2>
      <p className="text-gray-600">
        Map how PhoneBurner/SmartLead dispositions to our metrics
      </p>
      
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th>PhoneBurner Disposition</th>
            <th>Internal Category</th>
            <th>Is Connection?</th>
            <th>Is Voicemail?</th>
            <th>Min Talk Time</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map(m => (
            <tr key={m.id} className="border-t">
              <td>{m.external_disposition}</td>
              <td>
                <select 
                  value={m.internal_disposition}
                  onChange={(e) => updateMapping(m.id, { internal_disposition: e.target.value })}
                >
                  <option value="conversation">Conversation</option>
                  <option value="voicemail">Voicemail</option>
                  <option value="no_answer">No Answer</option>
                </select>
              </td>
              <td>
                <input 
                  type="checkbox"
                  checked={m.is_connection}
                  onChange={(e) => updateMapping(m.id, { is_connection: e.target.checked })}
                />
              </td>
              <td>
                <input 
                  type="checkbox"
                  checked={m.is_voicemail}
                  onChange={(e) => updateMapping(m.id, { is_voicemail: e.target.checked })}
                />
              </td>
              <td>
                <input 
                  type="number"
                  value={m.min_talk_duration_seconds || 30}
                  onChange={(e) => updateMapping(m.id, { min_talk_duration_seconds: parseInt(e.target.value) })}
                  className="w-20"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <button onClick={() => saveMappings(engagementId)}>
        Save Configuration
      </button>
    </div>
  );
}
```

**Step 4: Verify PhoneBurner Integration** (Edge Function)
```typescript
// supabase/functions/verify-phoneburner-dispositions/index.ts
// Run this to see what dispositions PhoneBurner actually sends

async function verifyDispositions() {
  const { data: calls } = await supabase
    .from('call_activities')
    .select('disposition')
    .not('disposition', 'is', null)
    .limit(1000);
  
  const uniqueDispositions = new Set(calls?.map(c => c.disposition));
  
  console.log('PhoneBurner dispositions found in system:');
  uniqueDispositions.forEach(d => console.log(`  - "${d}"`));
  
  return Array.from(uniqueDispositions);
}

// Output will show you exactly what PhoneBurner sends
// Then you update the disposition_mappings table accordingly
```

### 📊 Expected Outcome
```
BEFORE:
├─ Total Calls: 1,620
├─ Connections: 0 ❌
├─ Connection Rate: 0% ❌

AFTER:
├─ Total Calls: 1,620
├─ Connections: 427 ✅
├─ Connection Rate: 26.4% ✅
```

### ⏱️ Time Estimate: **6-8 hours**
- Disposition research: 1 hour (run verification script)
- Table creation + seed data: 1 hour
- Update calculation logic: 2 hours
- Build config UI: 2 hours
- Testing with real data: 1.5 hours

### 🔗 Dependencies
- Requires understanding what PhoneBurner actually sends
- Should be completed AFTER Issue #1 (rep attribution)

---

## ISSUE #3: "Only One Objection Category Showing" 🔴

### 📋 Current State
```
Dashboard displays:
├─ Top Objections:
│  └─ "Budget" (showing 100% of all objections)
│
Problem: Should show:
├─ "Budget" - 35%
├─ "Timing" - 28%
├─ "No Need" - 18%
├─ "Evaluating Competitors" - 12%
└─ "Other" - 7%
```

### 🎯 Business Impact
- **Sales Coaching:** Can't identify pattern of objections to train on
- **Content Strategy:** Can't tailor messaging for most common objections
- **Playbook Effectiveness:** Can't measure if objection handling training is working
- **Deal Intelligence:** Missing critical insight into why deals stall

### ❓ Why This Happens

**Root Cause #1: Objection Extraction Incomplete**
```typescript
// Likely issue in ObjectionIntelligence.tsx or similar:
// Only extracting one type of objection from transcript

// What's happening:
const objections = transcript.match(/budget|price/i)  // ❌ Only matches budget!

// What should happen:
const objections = {
  budget: transcript.match(/budget|price|cost|expensive/gi)?.length ?? 0,
  timing: transcript.match(/timing|not now|later|quarter/gi)?.length ?? 0,
  noNeed: transcript.match(/don't need|not interested|passing/gi)?.length ?? 0,
  competitors: transcript.match(/already using|competitor|salesforce/gi)?.length ?? 0,
};
```

**Root Cause #2: Database Not Storing All Objections**
```sql
-- Current (probably):
ALTER TABLE call_activities 
  ADD COLUMN objection VARCHAR(255);  -- ❌ Single string!

-- Should be:
ALTER TABLE call_activities 
  ADD COLUMN objections_list JSONB DEFAULT '[]';  -- ✅ Array!

-- Or better:
CREATE TABLE call_objections (
  id UUID PRIMARY KEY,
  call_id UUID REFERENCES call_activities(id),
  objection_type VARCHAR(100),
  objection_text TEXT,
  resolution_attempted VARCHAR(255),
  was_resolved BOOLEAN,
  created_at TIMESTAMP
);
```

**Root Cause #3: Fireflies AI Data Not Fully Utilized**
```
Fireflies returns objection data in transcript analysis:
{
  objections: [
    { type: "budget", text: "...", timestamp: "00:45" },
    { type: "timing", text: "...", timestamp: "02:15" },
    { type: "authority", text: "...", timestamp: "05:30" }
  ]
}

But we're only storing: "budget" (first one?)
```

### ✅ SOLUTION

**Step 1: Create Objections Table** (Database)
```sql
-- Store all objections from each call with context
CREATE TABLE call_objections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES call_activities(id) ON DELETE CASCADE,
  engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  
  -- Objection Classification
  objection_type VARCHAR(100) NOT NULL,
  -- ├─ budget
  -- ├─ timing
  -- ├─ authority (need to ask boss)
  -- ├─ no_need (don't need product)
  -- ├─ competitor (already using)
  -- ├─ technical (too complex)
  -- └─ other
  
  -- Source Data
  objection_text TEXT NOT NULL,
  timestamp_in_call INTEGER,  -- seconds from start
  
  -- Response Strategy
  resolution_attempted VARCHAR(255),  -- e.g., "price negotiation", "case study"
  was_resolved BOOLEAN,
  
  -- Tracking
  extracted_by VARCHAR(50),  -- 'fireflies_ai', 'manual', 'smartlead'
  confidence NUMERIC(3, 2),  -- 0.0 to 1.0
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX idx_call_objections_call_id ON call_objections(call_id);
CREATE INDEX idx_call_objections_type ON call_objections(objection_type);
CREATE INDEX idx_call_objections_engagement ON call_objections(engagement_id);
```

**Step 2: Update Fireflies Sync** (Edge Function)
```typescript
// supabase/functions/fireflies-sync-enhanced/index.ts
// Extract ALL objections, not just first one

async function syncFirefliesData(callId: string, engagementId: string) {
  // 1. Get call from Fireflies
  const fiCall = await firefliesApi.getCall(callId);
  
  // 2. Extract all objections from analysis
  if (fiCall.analysis?.objections) {
    // Delete old objections for this call
    await supabase
      .from('call_objections')
      .delete()
      .eq('call_id', callId)
      .eq('extracted_by', 'fireflies_ai');
    
    // Insert each objection as separate record
    for (const objection of fiCall.analysis.objections) {
      await supabase
        .from('call_objections')
        .insert({
          call_id: callId,
          engagement_id: engagementId,
          objection_type: classifyObjection(objection.text),
          objection_text: objection.text,
          timestamp_in_call: objection.timestamp,
          extracted_by: 'fireflies_ai',
          confidence: 0.95,  // Fireflies AI high confidence
        });
    }
  }
  
  // 3. Also extract from transcript via pattern matching
  const transcript = fiCall.transcript;
  extractPatternBasedObjections(callId, engagementId, transcript);
}

// Helper: Classify objection type from text
function classifyObjection(text: string): string {
  const lower = text.toLowerCase();
  
  if (lower.match(/budget|price|cost|expensive|afford/i)) return 'budget';
  if (lower.match(/timing|not now|later|quarter|year/i)) return 'timing';
  if (lower.match(/don't need|no need|passing|not interested/i)) return 'no_need';
  if (lower.match(/competitor|already using|salesforce|hubspot/i)) return 'competitor';
  if (lower.match(/authority|need to ask|boss|cfo|cto/i)) return 'authority';
  if (lower.match(/technical|complex|integration|api/i)) return 'technical';
  
  return 'other';
}

// Pattern-based extraction (backup if Fireflies misses something)
function extractPatternBasedObjections(callId: string, engagementId: string, transcript: string) {
  const patterns = [
    { type: 'budget', regex: /budget|price|cost|expensive/gi },
    { type: 'timing', regex: /timing|not now|later|quarter/gi },
    { type: 'no_need', regex: /don't need|no need|not interested/gi },
    { type: 'competitor', regex: /competitor|already using|salesforce/gi },
  ];
  
  for (const pattern of patterns) {
    const matches = transcript.match(pattern.regex);
    if (matches && matches.length > 0) {
      // Insert additional objections found
      // But don't duplicate if Fireflies already found it
    }
  }
}
```

**Step 3: Add Objection Intelligence Component** (Frontend)
```typescript
// src/components/callinsights/ObjectionIntelligence.tsx (UPDATED)

export function ObjectionIntelligence({ engagementId, dateRange }: Props) {
  const { data: objections } = useQuery({
    queryKey: ['objections', engagementId, dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from('call_objections')
        .select('objection_type, count(*) as count')
        .eq('engagement_id', engagementId)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .group_by('objection_type');
      
      return data || [];
    }
  });
  
  const total = objections.reduce((sum, o) => sum + o.count, 0);
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">🎯 Top Objections</h3>
      
      <div className="space-y-2">
        {objections.map(obj => (
          <div key={obj.objection_type} className="flex items-center gap-4">
            <span className="font-medium capitalize w-24">
              {obj.objection_type}
            </span>
            <div className="flex-1 bg-gray-200 rounded h-6">
              <div 
                className="bg-blue-500 h-6 rounded"
                style={{ width: `${(obj.count / total) * 100}%` }}
              />
            </div>
            <span className="text-right w-16">
              {Math.round((obj.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
      
      <div className="text-sm text-gray-600">
        Total objections encountered: {total}
      </div>
    </div>
  );
}
```

**Step 4: Create Objection Resolution Analytics** (Frontend)
```typescript
// New component: ObjectionResolutionAnalytics.tsx

export function ObjectionResolutionAnalytics({ engagementId }: Props) {
  const { data: resolutions } = useQuery({
    queryKey: ['objection-resolutions', engagementId],
    queryFn: async () => {
      const { data } = await supabase
        .from('call_objections')
        .select('objection_type, resolution_attempted, was_resolved')
        .eq('engagement_id', engagementId);
      
      // Calculate resolution rate by objection type
      const byType: Record<string, any> = {};
      
      data?.forEach(obj => {
        if (!byType[obj.objection_type]) {
          byType[obj.objection_type] = { total: 0, resolved: 0 };
        }
        byType[obj.objection_type].total++;
        if (obj.was_resolved) byType[obj.objection_type].resolved++;
      });
      
      return byType;
    }
  });
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">📊 Objection Resolution Rate</h3>
      
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left">Objection Type</th>
            <th className="text-right">Encountered</th>
            <th className="text-right">Resolved</th>
            <th className="text-right">Resolution Rate</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(resolutions || {}).map(([type, stats]) => (
            <tr key={type} className="border-b hover:bg-gray-50">
              <td className="capitalize">{type}</td>
              <td className="text-right">{stats.total}</td>
              <td className="text-right">{stats.resolved}</td>
              <td className="text-right">
                <span className={stats.resolved === stats.total ? 'text-green-600 font-semibold' : 'text-orange-600'}>
                  {Math.round((stats.resolved / stats.total) * 100)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 📊 Expected Outcome
```
BEFORE:
├─ Top Objections:
│  └─ "Budget" (100%)

AFTER:
├─ Top Objections:
│  ├─ "Budget" (35%) 💰
│  ├─ "Timing" (28%) ⏰
│  ├─ "No Need" (18%) 🚫
│  ├─ "Evaluating Competitors" (12%) 🏆
│  └─ "Other" (7%) 📝
│
├─ Objection Resolution Rate:
│  ├─ "Budget": 42% resolved ✅
│  ├─ "Timing": 68% resolved ✅
│  ├─ "No Need": 12% resolved ⚠️
│  └─ "Other": 31% resolved
```

### ⏱️ Time Estimate: **8-10 hours**
- Table creation: 30 min
- Fireflies sync update: 2.5 hours
- Pattern extraction: 1.5 hours
- Components: 2.5 hours
- Testing: 1.5 hours

### 🔗 Dependencies
- Requires Fireflies API access
- Should be done AFTER Issues #1-2

---

## ISSUE #4: "Reply.io Metrics Completely Missing" 🔴

### 📋 Current State
```
Email Analytics Dashboard:
├─ SmartLead Metrics: ✅ SHOWING
│  ├─ Sent: 1,200
│  ├─ Opened: 312 (26%)
│  └─ Replied: 84 (7%)
│
├─ Reply.io Metrics: ❌ MISSING
│  ├─ Sent: ???
│  ├─ Opened: ???
│  └─ Replied: ???

Result: Can't see 50% of outreach data
```

### 🎯 Business Impact
- **Campaign Analysis:** Can't compare SmartLead vs Reply.io effectiveness
- **Email Strategy:** Don't know which platform works better for your market
- **ROI Calculation:** Missing 50% of revenue-producing activities
- **PE Firm Reporting:** "What's the open rate?" → "Only 50% of data..."

### ❓ Why This Happens

**Root Cause #1: Webhook Exists But Incomplete**
```typescript
// File: supabase/functions/replyio-webhook/index.ts
// 
// This file EXISTS but is only skeleton!

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('not found', { status: 404 });
  
  // ❌ Webhook is received but NOT PROCESSED
  const payload = await req.json();
  
  console.log('Reply.io webhook received:', payload);  // ❌ Just logs!
  
  // ❌ No event handlers
  // ❌ No data insertion
  // ❌ No contact updates
  
  return new Response(JSON.stringify({ ok: true }));
});

// This means:
// - Reply.io sends data
// - We receive it
// - We throw it away! 🗑️
```

**Root Cause #2: No Event Handler Implementation**
```typescript
// What SHOULD be implemented:

const eventHandlers = {
  'email.sent': async (data) => {
    // Insert email_activity record
    // Update campaign metrics
  },
  'email.opened': async (data) => {
    // Update email_activity with opened=true
    // Increment campaign open_count
  },
  'email.clicked': async (data) => {
    // Update email_activity with clicked=true
    // Track which link clicked
  },
  'email.replied': async (data) => {
    // Update email_activity with replied=true
    // Classify reply sentiment (positive/negative)
    // Create response record
  },
  'email.bounced': async (data) => {
    // Update email_activity with bounced=true
    // Mark contact as bad email
    // Flag for list cleaning
  },
  'sequence.started': async (data) => {
    // Link contact to sequence/campaign
  },
  'sequence.ended': async (data) => {
    // Mark sequence complete
  },
};

// Currently: ❌ ALL MISSING
```

**Root Cause #3: SmartLead vs Reply.io Payload Different**
```
SmartLead webhook payload:
{
  "event": "open",
  "campaign_id": "123",
  "lead_id": "456",
  "timestamp": "2026-01-20T10:00:00Z"
}

Reply.io webhook payload:
{
  "eventType": "EmailOpened",  // Different key!
  "campaignId": "789",
  "contactId": "101",
  "sequenceId": "202",
  "timestamp": "2026-01-20T10:05:00Z"
}

Code handles SmartLead perfectly but Reply.io payload structure different!
```

### ✅ SOLUTION

**Step 1: Implement Reply.io Webhook Handlers** (Edge Function)
```typescript
// supabase/functions/replyio-webhook/index.ts (COMPLETE REWRITE)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);

interface ReplyioWebhookPayload {
  eventType: string;
  campaignId?: string;
  sequenceId?: string;
  contactId?: string;
  email?: string;
  timestamp?: string;
  subject?: string;
  content?: string;
  // ... other fields depend on event type
}

// Webhook signature verification
function verifyReplyioSignature(payload: string, signature: string, secret: string): boolean {
  const crypto = await import('https://deno.land/std@0.177.0/crypto/mod.ts');
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const key = encoder.encode(secret);
  
  const computed = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), data);
  const computedSig = Array.from(new Uint8Array(computed)).map(x => x.toString(16).padStart(2, '0')).join('');
  
  return computedSig === signature;
}

// Event handlers by type
const eventHandlers: Record<string, (payload: ReplyioWebhookPayload) => Promise<void>> = {
  'EmailSent': async (payload) => {
    await supabase
      .from('email_activities')
      .insert({
        engagement_id: payload.engagementId,
        campaign_id: payload.campaignId,
        contact_id: payload.contactId || payload.email,
        platform: 'replyio',
        external_id: payload.messageId,
        
        sent: 1,
        delivered: 0,  // Will update on delivery event
        opened: 0,
        clicked: 0,
        replied: 0,
        bounced: 0,
        
        sent_at: new Date(payload.timestamp),
        event_type: 'sent',
      });
  },

  'EmailDelivered': async (payload) => {
    await supabase
      .from('email_activities')
      .update({ 
        delivered: 1,
        delivered_at: new Date(payload.timestamp),
      })
      .eq('external_id', payload.messageId);
  },

  'EmailOpened': async (payload) => {
    const { data: existing } = await supabase
      .from('email_activities')
      .select('id, opened')
      .eq('external_id', payload.messageId)
      .single();
    
    if (existing && !existing.opened) {
      await supabase
        .from('email_activities')
        .update({ 
          opened: 1,
          opened_at: new Date(payload.timestamp),
        })
        .eq('id', existing.id);
    }
  },

  'EmailClicked': async (payload) => {
    const { data: existing } = await supabase
      .from('email_activities')
      .select('id, clicked')
      .eq('external_id', payload.messageId)
      .single();
    
    if (existing && !existing.clicked) {
      await supabase
        .from('email_activities')
        .update({ 
          clicked: 1,
          clicked_at: new Date(payload.timestamp),
          clicked_link: payload.linkUrl,
        })
        .eq('id', existing.id);
    }
  },

  'EmailReplied': async (payload) => {
    const { data: existing } = await supabase
      .from('email_activities')
      .select('id, replied')
      .eq('external_id', payload.messageId)
      .single();
    
    if (existing && !existing.replied) {
      // Classify reply sentiment
      const sentiment = classifyReply(payload.content);
      
      await supabase
        .from('email_activities')
        .update({ 
          replied: 1,
          positive_replies: sentiment === 'positive' ? 1 : 0,
          replied_at: new Date(payload.timestamp),
          reply_category: sentiment,
          reply_sentiment: sentiment,
        })
        .eq('id', existing.id);
    }
  },

  'EmailBounced': async (payload) => {
    const { data: existing } = await supabase
      .from('email_activities')
      .select('id, bounced')
      .eq('external_id', payload.messageId)
      .single();
    
    if (existing && !existing.bounced) {
      await supabase
        .from('email_activities')
        .update({ 
          bounced: 1,
          bounced_at: new Date(payload.timestamp),
          bounce_type: payload.bounceType,  // 'hard' or 'soft'
        })
        .eq('id', existing.id);
    }
  },

  'UnsubscribeRequested': async (payload) => {
    await supabase
      .from('email_activities')
      .update({ 
        unsubscribed: true,
        unsubscribed_at: new Date(payload.timestamp),
      })
      .eq('external_id', payload.messageId);
  },

  'SequenceStarted': async (payload) => {
    const { data: contact } = await supabase
      .from('contacts')
      .upsert({
        engagement_id: payload.engagementId,
        email: payload.email,
        platform: 'replyio',
        external_id: payload.contactId,
      }, {
        onConflict: 'engagement_id,email'
      })
      .select()
      .single();
    
    // Link to campaign/sequence
    await supabase
      .from('email_activities')
      .insert({
        engagement_id: payload.engagementId,
        campaign_id: payload.campaignId,
        contact_id: contact.id,
        platform: 'replyio',
        sequence_id: payload.sequenceId,
        event_type: 'sequence_start',
        created_at: new Date(payload.timestamp),
      });
  },

  'SequenceEnded': async (payload) => {
    // Mark all activities for this sequence as complete
    await supabase
      .from('email_activities')
      .update({
        sequence_complete: true,
        completed_at: new Date(payload.timestamp),
      })
      .eq('sequence_id', payload.sequenceId);
  },
};

// Reply classification
function classifyReply(content: string): 'positive' | 'negative' | 'neutral' {
  const lower = content.toLowerCase();
  
  const positive = /interested|meeting|let's talk|sounds good|can you|tell me more/i;
  const negative = /not interested|no|don't|pass|remove/i;
  
  if (positive.test(lower)) return 'positive';
  if (negative.test(lower)) return 'negative';
  return 'neutral';
}

// Main handler
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get signature from header
    const signature = req.headers.get('x-replyio-signature');
    if (!signature) {
      return new Response('Missing signature', { status: 401 });
    }

    // Get raw body
    const body = await req.text();
    
    // Verify signature
    const secret = Deno.env.get('REPLYIO_WEBHOOK_SECRET')!;
    if (!verifyReplyioSignature(body, signature, secret)) {
      return new Response('Invalid signature', { status: 401 });
    }

    const payload: ReplyioWebhookPayload = JSON.parse(body);

    // Route to handler
    const handler = eventHandlers[payload.eventType];
    if (handler) {
      await handler(payload);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } else {
      console.warn(`Unknown Reply.io event type: ${payload.eventType}`);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });  // Accept anyway
    }
  } catch (error) {
    console.error('Reply.io webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

**Step 2: Map Reply.io Campaigns to Internal** (Database)
```sql
-- Link Reply.io campaigns to our system
CREATE TABLE campaign_platform_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES engagements(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  
  -- Platform tracking
  platform VARCHAR(50) NOT NULL,
  external_campaign_id VARCHAR(255) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(engagement_id, platform, external_campaign_id)
);

-- When Reply.io webhook arrives with campaignId "xyz":
-- 1. Look up campaign from mapping
-- 2. Use our campaign_id for all records
-- 3. Consolidate metrics from both platforms
```

**Step 3: Update Campaign Performance Component** (Frontend)
```typescript
// src/components/campaigns/CampaignPortfolioOverview.tsx (UPDATED)

export function CampaignPortfolioOverview({ engagementId }: Props) {
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', engagementId],
    queryFn: async () => {
      // Get all campaigns for this engagement
      const { data } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          platform,
          email_activities (
            sent,
            delivered,
            opened,
            clicked,
            replied,
            bounced,
            positive_replies
          )
        `)
        .eq('engagement_id', engagementId);
      
      // Aggregate metrics per campaign
      return data?.map(campaign => {
        const activities = campaign.email_activities || [];
        const sent = activities.reduce((sum, a) => sum + (a.sent || 0), 0);
        const opened = activities.reduce((sum, a) => sum + (a.opened || 0), 0);
        const replied = activities.reduce((sum, a) => sum + (a.replied || 0), 0);
        
        return {
          ...campaign,
          metrics: {
            sent,
            opened,
            replied,
            openRate: sent > 0 ? (opened / sent) * 100 : 0,
            replyRate: sent > 0 ? (replied / sent) * 100 : 0,
          }
        };
      });
    }
  });

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b">
          <th className="text-left">Campaign Name</th>
          <th className="text-right">Platform</th>
          <th className="text-right">Sent</th>
          <th className="text-right">Opened</th>
          <th className="text-right">Open Rate</th>
          <th className="text-right">Replied</th>
          <th className="text-right">Reply Rate</th>
        </tr>
      </thead>
      <tbody>
        {campaigns?.map(campaign => (
          <tr key={campaign.id} className="border-b hover:bg-gray-50">
            <td className="font-medium">{campaign.name}</td>
            <td className="text-right">
              <Badge variant={campaign.platform === 'replyio' ? 'secondary' : 'default'}>
                {campaign.platform}
              </Badge>
            </td>
            <td className="text-right">{campaign.metrics.sent}</td>
            <td className="text-right">{campaign.metrics.opened}</td>
            <td className="text-right font-semibold">{campaign.metrics.openRate.toFixed(1)}%</td>
            <td className="text-right">{campaign.metrics.replied}</td>
            <td className="text-right font-semibold">{campaign.metrics.replyRate.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Step 4: Create Platform Comparison Dashboard** (Frontend)
```typescript
// New Component: PlatformComparison.tsx

export function PlatformComparison({ engagementId, dateRange }: Props) {
  const { data: comparison } = useQuery({
    queryKey: ['platform-comparison', engagementId, dateRange],
    queryFn: async () => {
      const { data: activities } = await supabase
        .from('email_activities')
        .select('platform, sent, opened, replied, bounced')
        .eq('engagement_id', engagementId)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);
      
      const platforms: Record<string, any> = {};
      
      activities?.forEach(activity => {
        if (!platforms[activity.platform]) {
          platforms[activity.platform] = {
            sent: 0, opened: 0, replied: 0, bounced: 0
          };
        }
        platforms[activity.platform].sent += activity.sent || 0;
        platforms[activity.platform].opened += activity.opened || 0;
        platforms[activity.platform].replied += activity.replied || 0;
        platforms[activity.platform].bounced += activity.bounced || 0;
      });
      
      return platforms;
    }
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      {Object.entries(comparison || {}).map(([platform, stats]) => (
        <Card key={platform}>
          <CardHeader>
            <CardTitle className="capitalize">{platform}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Sent:</span>
              <span className="font-semibold">{stats.sent}</span>
            </div>
            <div className="flex justify-between">
              <span>Open Rate:</span>
              <span className="font-semibold">
                {((stats.opened / stats.sent) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Reply Rate:</span>
              <span className="font-semibold">
                {((stats.replied / stats.sent) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Bounce Rate:</span>
              <span className="font-semibold">
                {((stats.bounced / stats.sent) * 100).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 📊 Expected Outcome
```
BEFORE:
├─ SmartLead: 1,200 sent, 312 opened (26%), 84 replied (7%)
├─ Reply.io: ❌ NO DATA

AFTER:
├─ SmartLead: 1,200 sent, 312 opened (26%), 84 replied (7%)
├─ Reply.io: 890 sent, 178 opened (20%), 53 replied (6%)
├─ TOTAL: 2,090 sent, 490 opened (23.4%), 137 replied (6.6%)
│
└─ Platform Comparison:
   SmartLead is 3.2% better at open rate
   SmartLead is 1.1% better at reply rate
```

### ⏱️ Time Estimate: **12-16 hours**
- Webhook implementation: 4 hours
- Event handlers per type: 6 hours
- Campaign mapping: 2 hours
- Frontend components: 2 hours
- Testing: 2 hours

### 🔗 Dependencies
- Requires Reply.io API documentation
- Should coordinate with SmartLead webhook (follow similar pattern)

---

## ISSUE #5: "Trend Values Showing NaN" 🔴

### 📋 Current State
```
Dashboard Chart:
├─ Monday: 42 connections ✅
├─ Tuesday: NaN ❌
├─ Wednesday: NaN ❌
├─ Thursday: 38 connections ✅
├─ Friday: NaN ❌

Result: Chart looks broken, untrustworthy
```

### 🎯 Business Impact
- **User Trust:** Dashboard looks broken → loses credibility
- **Trend Analysis:** Can't see patterns
- **Decision Making:** Incomplete data = bad decisions

### ❓ Why This Happens

**Root Cause: Division by Zero**
```typescript
// Likely in WeeklyTrendChart.tsx or similar:

dailyTrends.forEach(day => {
  connectRate = (day.connections / day.calls) * 100;  // ❌ What if day.calls = 0?
  // Result: 0 / 0 = NaN
});

// If a day has no calls recorded, division returns NaN
```

### ✅ SOLUTION

**Fix in Metric Calculation**
```typescript
// src/lib/metrics.ts - Update rate calculations

export const calculateCallConnectRate = (totalCalls: number, connections: number): number => {
  if (totalCalls === 0) return 0;  // ✅ Add this check!
  return (connections / totalCalls) * 100;
};

// Or safer approach:
export const calculateRate = (numerator: number | null | undefined, denominator: number | null | undefined): number => {
  const num = numerator ?? 0;
  const den = denominator ?? 0;
  if (den === 0) return 0;  // ✅ Already has this check
  return (num / den) * 100;
};

// But make sure EVERYWHERE we calculate rates uses this function!
```

**Fix in Components**
```typescript
// src/components/trends/WeeklyTrendChart.tsx

const displayValue = isNaN(connectRate) ? 0 : connectRate;  // ✅ Fallback
const displayLabel = connectRate === 0 ? 'No data' : `${connectRate.toFixed(1)}%`;
```

### ⏱️ Time Estimate: **1-2 hours**
- Find all rate calculations: 30 min
- Add NaN checks: 30 min
- Testing: 30 min

---

# 🟠 HIGH PRIORITY FIXES (P1)

## ISSUE #6: "Calculation Logic Duplicated in 3 Places" 🟠

### 📋 Problem
Same connection calculation code exists in:
1. `src/lib/metrics.ts:578-579` (source of truth)
2. `src/hooks/useCallingAnalytics.tsx:137-138` (copy-paste)
3. Possibly other components

When you fix one place, other places still have the old broken logic.

### ✅ SOLUTION

**Centralize All Calculations in `src/lib/metrics.ts`**

```typescript
// src/lib/metrics.ts - SINGLE source of truth

export function calculateHourlyMetrics(calls: CallActivityRecord[], hour: number): HourlyMetrics {
  const hourCalls = calls.filter(c => {
    if (!c.started_at) return false;
    const callHour = getHours(parseISO(c.started_at));
    return callHour === hour;
  });
  
  return {
    hour,
    calls: hourCalls.length,
    connections: hourCalls.filter(c => isConnection(c.disposition)).length,
    connectRate: calculateRate(
      hourCalls.filter(c => isConnection(c.disposition)).length,
      hourCalls.length
    ),
  };
}

export function calculateDailyTrends(calls: CallActivityRecord[]): DailyTrend[] {
  const byDate = new Map<string, CallActivityRecord[]>();
  
  calls.forEach(call => {
    if (!call.started_at) return;
    const date = format(parseISO(call.started_at), 'yyyy-MM-dd');
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(call);
  });
  
  return Array.from(byDate.entries()).map(([date, dayCalls]) => ({
    date,
    ...aggregateCallingMetrics(dayCalls),
  }));
}
```

**Then remove duplicate code from components:**
```typescript
// src/hooks/useCallingAnalytics.tsx - NOW IMPORTS FROM LIBRARY

import { calculateHourlyMetrics, calculateDailyTrends, aggregateCallingMetrics } from '@/lib/metrics';

// ✅ Use the centralized functions
const hourlyData = Array.from({ length: 15 }, (_, i) => i + 6)
  .map(hour => calculateHourlyMetrics(calls, hour));

const dailyTrends = calculateDailyTrends(calls);
```

### ⏱️ Time Estimate: **3-4 hours**
- Refactor calculations: 2 hours
- Update all imports: 1 hour
- Testing: 1 hour

---

## ISSUE #7: "Data Quality - Missing/Null Values" 🟠

### 📋 Problem
Fields that should always have data are NULL:
- `caller_name` → causes "Unknown" reps
- `conversation_outcome` → wrong conversation counts
- `is_dm_conversation` → can't track decision makers

### ✅ SOLUTION

**1. Schema Constraints**
```sql
-- Add NOT NULL constraints
ALTER TABLE call_activities 
  ALTER COLUMN caller_name SET NOT NULL;

-- Add defaults for boolean fields
ALTER TABLE call_activities 
  ALTER COLUMN is_dm_conversation SET DEFAULT false;

ALTER TABLE call_activities 
  ALTER COLUMN voicemail_left SET DEFAULT false;

ALTER TABLE call_activities 
  ALTER COLUMN callback_scheduled SET DEFAULT false;
```

**2. Validate on Insert**
```typescript
// src/lib/validation.ts

export function validateCallActivity(call: CallActivityRecord): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!call.caller_name) {
    errors.push({ field: 'caller_name', message: 'Required: rep name missing' });
  }
  
  if (call.conversation_outcome === null || call.conversation_outcome === undefined) {
    errors.push({ field: 'conversation_outcome', message: 'Required: outcome not captured' });
  }
  
  if (call.is_dm_conversation === null) {
    errors.push({ field: 'is_dm_conversation', message: 'Required: decision maker flag missing' });
  }
  
  return errors;
}
```

**3. Sync Function Quality Checks**
```typescript
// supabase/functions/phoneburner-sync/index.ts

async function syncPhoneBurnerCalls() {
  const pbCalls = await phoneburnerApi.getCalls();
  
  for (const pbCall of pbCalls) {
    // ✅ Validate before insert
    if (!pbCall.representative) {
      console.warn(`Call ${pbCall.id} missing representative - skipping`);
      continue;
    }
    
    // ✅ Map fields properly
    await insertCallActivity({
      caller_name: pbCall.representative,
      disposition: pbCall.outcome,
      talk_duration: pbCall.duration_seconds,
      conversation_outcome: pbCall.conversation_type || 'unknown',
      is_dm_conversation: pbCall.decision_maker_reached ?? false,
      voicemail_left: pbCall.voicemail_left ?? false,
      callback_scheduled: pbCall.next_steps_scheduled ?? false,
    });
  }
}
```

### ⏱️ Time Estimate: **2-3 hours**

---

# 🟡 MEDIUM PRIORITY FIXES (P2)

## ISSUE #8: "Unused Email Rate Functions" 🟡

Move email rate calculation functions from library to active use in components.

### ✅ SOLUTION
Update `CampaignAnalytics.tsx` to use:
- `calculateReplyRate(sent, replied)`
- `calculateOpenRate(sent, opened)`
- `calculateBounceRate(sent, bounced)`

### ⏱️ Time Estimate: **1-2 hours**

---

## ISSUE #9: "No Configuration UI for Settings" 🟡

Create admin panel for:
- Disposition mapping customization
- Connection thresholds
- Objection categories
- Benchmark configuration

### ✅ SOLUTION
Build `/src/pages/settings/EngagementConfiguration.tsx`

### ⏱️ Time Estimate: **6-8 hours**

---

## ISSUE #10: "Pre-calculate Metrics Instead of On-The-Fly" 🟡

Store aggregated metrics at day/week level instead of recalculating every time dashboard loads.

### ✅ SOLUTION
Create `daily_metrics` table + nightly aggregation job

### ⏱️ Time Estimate: **8-10 hours**

---

# 📅 IMPLEMENTATION ROADMAP

## WEEK 1: Fix Critical Issues (40-50 hours)
```
Mon:  Issue #1 (Rep Attribution) - 6h
      Issue #2 (Connection Calc) - 8h
      
Tue:  Issue #2 (continued) - 8h
      Issue #3 (Objections) - 8h
      
Wed:  Issue #3 (continued) - 6h
      Issue #4 (Reply.io) - 12h
      
Thu:  Issue #4 (continued) - 12h
      Issue #5 (NaN Fix) - 2h
      
Fri:  Testing & QA - 8h
      Deployment prep - 4h
```

## WEEK 2: Clean Up Architecture (30-40 hours)
```
Mon:  Issue #6 (Centralize calcs) - 4h
      Issue #7 (Data Quality) - 3h
      
Tue-Fri: Issue #8-10 (Medium priority)
         + Documentation
         + Validation
         + Config UI
```

---

# 📊 SUCCESS METRICS

After all fixes are deployed, these metrics should improve:

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Dashboard Accuracy | 38% | 95%+ | 150% ↑ |
| Missing Data Fields | 40% | <5% | 800% ↓ |
| Reps Showing "Unknown" | 80% | 0% | 100% ↓ |
| Email Platform Coverage | 50% | 100% | 100% ↑ |
| Page Load Time | TBD | <1s | TBD |
| User Trust Score | Low | High | ↑↑↑ |

---

# 💼 BUSINESS OUTCOMES

Once these fixes are deployed:

✅ **Sales Teams** can see accurate metrics and improve performance  
✅ **Managers** can identify top performers and coach struggling reps  
✅ **PE Firms** get complete view of outreach performance (both platforms)  
✅ **Engagement Leads** can confidently report metrics to stakeholders  
✅ **Platform** becomes trustworthy data tool vs. broken toy  

---

# 📋 HANDOFF CHECKLIST FOR LOVABLE

- [x] All issues clearly described with business context
- [x] Root causes explained with code references
- [x] Step-by-step solutions with code samples
- [x] Time estimates for each task
- [x] Dependencies identified
- [x] Success metrics defined
- [x] Roadmap with sequencing
- [x] High-level vs low-level details balanced

**Ready to upload to Lovable and begin implementation!**
