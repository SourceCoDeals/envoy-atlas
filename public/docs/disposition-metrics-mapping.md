# Cold Calling Disposition → Metrics Mapping System
**Envoy Atlas - Complete Data Flow Documentation**

---

## Executive Summary

This document maps your PhoneBurner dispositions to Envoy Atlas metrics, ensuring accurate tracking across all reports, dashboards, and analytics. Every disposition affects specific metrics in specific ways - this is your single source of truth.

---

## 1. CURRENT DISPOSITIONS & THEIR CLASSIFICATIONS

### 1.1 Connection Dispositions
These count toward **totalCalls** AND **connections**

| Disposition | Connected? | Conversation? | DM? | Notes |
|------------|-----------|---------------|-----|-------|
| **Receptionist** | ✅ Yes | ❌ No | ❌ No | Connected but gatekeeper, not DM |
| **Callback Requested** | ✅ Yes | ✅ Yes | ✅ Yes | Implies conversation with DM |
| **Send Email** | ✅ Yes | ⚠️ Maybe | ⚠️ Maybe | Could be gatekeeper or DM asking for email |
| **Not Qualified** | ✅ Yes | ✅ Yes | ✅ Yes | Spoke with DM, determined not a fit |
| **Positive - Blacklist Co** | ✅ Yes | ✅ Yes | ✅ Yes | Meeting-level interest but company blacklisted |
| **Negative - Blacklist Co** | ✅ Yes | ✅ Yes | ✅ Yes | Had conversation, not interested, company blacklisted |
| **Negative - Blacklist Contact** | ✅ Yes | ✅ Yes | ✅ Yes | Had conversation, not interested, contact blacklisted |
| **Hung Up** | ✅ Yes | ❌ No | ❌ No | Connected but prospect hung up immediately |

### 1.2 Non-Connection Dispositions
These count toward **totalCalls** but NOT **connections**

| Disposition | Voicemail? | No Answer? | Bad Data? | Notes |
|------------|-----------|------------|-----------|-------|
| **Voicemail** | ✅ Yes | ❌ No | ❌ No | Standard voicemail |
| **Live Voicemail** | ✅ Yes | ❌ No | ❌ No | Used live voicemail drop feature |
| **No Answer** | ❌ No | ✅ Yes | ❌ No | Phone rang, no pickup |
| **Bad Phone** | ❌ No | ❌ No | ✅ Yes | Number doesn't work / disconnected |
| **Wrong Number** | ❌ No | ❌ No | ✅ Yes | Reached wrong person/company |
| **Do Not Call** | ⚠️ Special | ⚠️ Special | ⚠️ Special | Legal opt-out - track separately |

---

## 2. CORE METRICS CALCULATION FORMULAS

### 2.1 Primary Metrics (from Joey's recommendations + your system)

```typescript
// ============================================
// METRIC DEFINITIONS - SINGLE SOURCE OF TRUTH
// ============================================

/**
 * CONNECT RATE
 * Benchmark: 25-35% (below 20% = data quality issue)
 * Formula: (totalConnections / totalCalls) × 100
 */
totalConnections = COUNT(
  'Receptionist',
  'Callback Requested', 
  'Send Email',
  'Not Qualified',
  'Positive - Blacklist Co',
  'Negative - Blacklist Co', 
  'Negative - Blacklist Contact',
  'Hung Up'
)

connectRate = (totalConnections / totalCalls) × 100

/**
 * CONVERSATION RATE  
 * These are connections where meaningful dialogue occurred
 * Formula: (totalConversations / totalCalls) × 100
 */
totalConversations = COUNT(
  'Callback Requested',
  'Not Qualified',
  'Positive - Blacklist Co',
  'Negative - Blacklist Co',
  'Negative - Blacklist Contact'
  // Note: 'Send Email' is OPTIONAL - include if you determine it was a conversation
)

conversationRate = (totalConversations / totalCalls) × 100

/**
 * DM CONVERSATION RATE
 * Percentage of connections that were with actual decision makers
 * Formula: (dmConversations / totalConnections) × 100
 */
dmConversations = COUNT(
  'Callback Requested',
  'Not Qualified', 
  'Positive - Blacklist Co',
  'Negative - Blacklist Co',
  'Negative - Blacklist Contact'
  // Note: Explicitly EXCLUDE 'Receptionist' and 'Hung Up'
)

dmConversationRate = (dmConversations / totalConnections) × 100

/**
 * VOICEMAIL RATE
 * Formula: (totalVoicemails / totalCalls) × 100
 */
totalVoicemails = COUNT(
  'Voicemail',
  'Live Voicemail'
)

voicemailRate = (totalVoicemails / totalCalls) × 100

/**
 * MEETING RATE (from calls)
 * You currently track this via "Positive - Blacklist Co" 
 * This represents meeting-level interest regardless of blacklist status
 * Formula: (totalMeetingInterest / totalCalls) × 100
 */
totalMeetingInterest = COUNT(
  'Positive - Blacklist Co',  // Currently your only meeting-level indicator
  'Meeting Booked'            // RECOMMENDATION: Add explicit "Meeting Booked" for pursuable meetings
)

meetingRate = (totalMeetingInterest / totalCalls) × 100

// IMPORTANT DISTINCTION:
// "Positive - Blacklist Co" = Meeting-level interest but can't pursue (blacklisted company)
// "Meeting Booked" = Actual meeting you can pursue (company NOT blacklisted)
// 
// You may want to track both:
// - Total Meeting Interest Rate (includes blacklisted)
// - Pursuable Meeting Rate (excludes blacklisted)

/**
 * MEETING CONVERSION RATE
 * How good are your reps at converting conversations to meetings?
 * Formula: (totalMeetings / totalConversations) × 100
 * Benchmark: 25-33% (newer reps: 25%, experienced: 33%)
 */
meetingConversion = (totalMeetings / totalConversations) × 100

/**
 * AVERAGE CALL DURATION
 * Only for connected calls where you actually spoke
 * Formula: totalTalkTimeSeconds / totalConnections
 * Benchmark: 180-300 seconds (3-5 minutes optimal)
 */
avgCallDuration = totalTalkTimeSeconds / totalConnections
```

---

## 3. METRICS CLASSIFICATION MATRIX

### Quick Reference: Which dispositions affect which metrics?

| Disposition | Total Calls | Connections | Conversations | DM Conv | Voicemail | Meetings | No Answer | Bad Data |
|------------|------------|------------|--------------|---------|-----------|----------|-----------|----------|
| Voicemail | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Live Voicemail | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| No Answer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Bad Phone | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Callback Requested | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Send Email | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| Receptionist | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Not Qualified | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Positive - Blacklist Co | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Negative - Blacklist Co | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Negative - Blacklist Contact | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Wrong Number | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Do Not Call | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| Hung Up | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **RECOMMENDED ADD:** Meeting Booked | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |

**Legend:**
- ✅ = Always counts toward this metric
- ❌ = Never counts toward this metric
- ⚠️ = Conditional / requires judgment call
- * = Track separately for compliance

---

## 4. DATABASE SCHEMA MAPPING

### 4.1 How Dispositions Map to Database Fields

```typescript
// Example call record structure
interface CallRecord {
  // Raw data from PhoneBurner
  phoneburner_disposition: string;  // e.g., "Callback Requested"
  talk_duration: number;             // seconds of actual talk time
  
  // Computed classification fields
  disposition: 'connected' | 'voicemail' | 'no_answer' | 'bad_data';
  conversation_outcome: string | null;  // More granular than disposition
  is_dm_conversation: boolean;          // Was this with a decision maker?
  
  // Used in metric calculations
  counts_as_connection: boolean;
  counts_as_conversation: boolean;
  counts_as_voicemail: boolean;
  counts_as_bad_data: boolean;
  counts_as_meeting: boolean;  // Meeting-level interest (includes blacklisted)
}
```

### 4.2 Disposition → Database Field Mapping Table

| PhoneBurner Disposition | `disposition` | `conversation_outcome` | `is_dm_conversation` |
|------------------------|--------------|----------------------|---------------------|
| Voicemail | `voicemail` | `voicemail` | `false` |
| Live Voicemail | `voicemail` | `voicemail` | `false` |
| No Answer | `no_answer` | `no_answer` | `false` |
| Bad Phone | `bad_data` | `bad_phone` | `false` |
| Wrong Number | `bad_data` | `wrong_number` | `false` |
| Do Not Call | `no_answer` | `do_not_call` | `false` |
| Receptionist | `connected` | `gatekeeper` | `false` |
| Hung Up | `connected` | `hung_up` | `false` |
| Callback Requested | `connected` | `callback` | `true` |
| Send Email | `connected` | `send_email` | `⚠️ depends` |
| Not Qualified | `connected` | `not_qualified` | `true` |
| Positive - Blacklist Co | `connected` | `meeting_interest` | `true` |
| Negative - Blacklist Co | `connected` | `not_interested` | `true` |
| Negative - Blacklist Contact | `connected` | `not_interested` | `true` |
| **[NEW]** Meeting Booked | `connected` | `meeting_booked` | `true` |

---

## 5. IMPLEMENTATION CODE EXAMPLES

### 5.1 TypeScript Function: Classify Disposition

```typescript
/**
 * Classify a PhoneBurner disposition into standardized categories
 * This function should be called when syncing data from PhoneBurner
 */
function classifyDisposition(
  phoneBurnerDisposition: string,
  talkDuration: number = 0
): {
  disposition: 'connected' | 'voicemail' | 'no_answer' | 'bad_data';
  conversationOutcome: string;
  isDMConversation: boolean;
  countsAsConnection: boolean;
  countsAsConversation: boolean;
  countsAsVoicemail: boolean;
  countsAsBadData: boolean;
  countsAsMeeting: boolean;
} {
  const disp = phoneBurnerDisposition.toLowerCase().trim();
  
  // Connection dispositions
  if (disp.includes('callback') || disp === 'callback requested') {
    return {
      disposition: 'connected',
      conversationOutcome: 'callback',
      isDMConversation: true,
      countsAsConnection: true,
      countsAsConversation: true,
      countsAsVoicemail: false,
      countsAsBadData: false,
      countsAsMeeting: false,
    };
  }
  
  if (disp.includes('not qualified')) {
    return {
      disposition: 'connected',
      conversationOutcome: 'not_qualified',
      isDMConversation: true,
      countsAsConnection: true,
      countsAsConversation: true,
      countsAsVoicemail: false,
      countsAsBadData: false,
      countsAsMeeting: false,
    };
  }
  
  if (disp.includes('positive')) {
    return {
      disposition: 'connected',
      conversationOutcome: 'meeting_interest',  // Meeting-level interest (even if company blacklisted)
      isDMConversation: true,
      countsAsConnection: true,
      countsAsConversation: true,
      countsAsVoicemail: false,
      countsAsBadData: false,
      countsAsMeeting: true,  // ← This is meeting-level interest (even if company blacklisted)
    };
  }
  
  if (disp.includes('negative')) {
    return {
      disposition: 'connected',
      conversationOutcome: 'not_interested',
      isDMConversation: true,
      countsAsConnection: true,
      countsAsConversation: true,
      countsAsVoicemail: false,
      countsAsBadData: false,
      countsAsMeeting: false,
    };
  }
  
  if (disp === 'receptionist') {
    return {
      disposition: 'connected',
      conversationOutcome: 'gatekeeper',
      isDMConversation: false,
      countsAsConnection: true,
      countsAsConversation: false,
      countsAsVoicemail: false,
      countsAsBadData: false,
      countsAsMeeting: false,
    };
  }
  
  if (disp === 'hung up') {
    return {
      disposition: 'connected',
      conversationOutcome: 'hung_up',
      isDMConversation: false,
      countsAsConnection: true,
      countsAsConversation: false,
      countsAsVoicemail: false,
      countsAsBadData: false,
      countsAsMeeting: false,
    };
  }
  
  if (disp.includes('send email')) {
    // This one is tricky - you need to determine if it was DM or gatekeeper
    // For now, assume gatekeeper unless talk_duration > 60 seconds
    const isDM = talkDuration > 60;
    return {
      disposition: 'connected',
      conversationOutcome: 'send_email',
      isDMConversation: isDM,
      countsAsConnection: true,
      countsAsConversation: isDM,
      countsAsVoicemail: false,
      countsAsBadData: false,
      countsAsMeeting: false,
    };
  }
  
  if (disp.includes('meeting') || disp.includes('booked')) {
    return {
      disposition: 'connected',
      conversationOutcome: 'meeting_booked',
      isDMConversation: true,
      countsAsConnection: true,
      countsAsConversation: true,
      countsAsVoicemail: false,
      countsAsBadData: false,
      countsAsMeeting: true,  // ← Explicit meeting booked (pursuable)
    };
  }
  
  // Voicemail dispositions
  if (disp.includes('voicemail') || disp === 'vm') {
    return {
      disposition: 'voicemail',
      conversationOutcome: 'voicemail',
      isDMConversation: false,
      countsAsConnection: false,
      countsAsConversation: false,
      countsAsVoicemail: true,
      countsAsBadData: false,
      countsAsMeeting: false,
    };
  }
  
  if (disp.includes('live voicemail')) {
    return {
      disposition: 'voicemail',
      conversationOutcome: 'voicemail',
      isDMConversation: false,
      countsAsConnection: false,
      countsAsConversation: false,
      countsAsVoicemail: true,
      countsAsBadData: false,
      countsAsMeeting: false,
    };
  }
  
  // No answer dispositions
  if (disp.includes('no answer')) {
    return {
      disposition: 'no_answer',
      conversationOutcome: 'no_answer',
      isDMConversation: false,
      countsAsConnection: false,
      countsAsConversation: false,
      countsAsVoicemail: false,
      countsAsBadData: false,
      countsAsMeeting: false,
    };
  }
  
  if (disp.includes('do not call')) {
    return {
      disposition: 'no_answer',
      conversationOutcome: 'do_not_call',
      isDMConversation: false,
      countsAsConnection: false,
      countsAsConversation: false,
      countsAsVoicemail: false,
      countsAsBadData: false,
      countsAsMeeting: false,
    };
  }
  
  // Bad data dispositions
  if (disp.includes('bad phone') || disp.includes('disconnected')) {
    return {
      disposition: 'bad_data',
      conversationOutcome: 'bad_phone',
      isDMConversation: false,
      countsAsConnection: false,
      countsAsConversation: false,
      countsAsVoicemail: false,
      countsAsBadData: true,
      countsAsMeeting: false,
    };
  }
  
  if (disp.includes('wrong number')) {
    return {
      disposition: 'bad_data',
      conversationOutcome: 'wrong_number',
      isDMConversation: false,
      countsAsConnection: false,
      countsAsConversation: false,
      countsAsVoicemail: false,
      countsAsBadData: true,
      countsAsMeeting: false,
    };
  }
  
  // Default fallback
  return {
    disposition: 'no_answer',
    conversationOutcome: 'unknown',
    isDMConversation: false,
    countsAsConnection: false,
    countsAsConversation: false,
    countsAsVoicemail: false,
    countsAsBadData: false,
    countsAsMeeting: false,
  };
}
```

### 5.2 SQL Query: Calculate All Metrics

```sql
-- ============================================
-- MASTER METRICS CALCULATION QUERY
-- Run this to get all cold calling metrics
-- ============================================

WITH call_classifications AS (
  SELECT 
    id,
    phoneburner_disposition,
    talk_duration,
    
    -- Classify each call
    CASE
      WHEN LOWER(phoneburner_disposition) IN (
        'callback requested', 'not qualified', 'receptionist', 
        'hung up', 'send email'
      ) 
      OR LOWER(phoneburner_disposition) LIKE '%positive%'
      OR LOWER(phoneburner_disposition) LIKE '%negative%'
      OR LOWER(phoneburner_disposition) LIKE '%meeting%'
      THEN 1 ELSE 0 
    END AS is_connection,
    
    CASE
      WHEN LOWER(phoneburner_disposition) IN (
        'callback requested', 'not qualified'
      )
      OR LOWER(phoneburner_disposition) LIKE '%positive%'
      OR LOWER(phoneburner_disposition) LIKE '%negative%'
      OR (LOWER(phoneburner_disposition) = 'send email' AND talk_duration > 60)
      THEN 1 ELSE 0
    END AS is_conversation,
    
    CASE
      WHEN LOWER(phoneburner_disposition) IN (
        'callback requested', 'not qualified'
      )
      OR LOWER(phoneburner_disposition) LIKE '%positive%'
      OR LOWER(phoneburner_disposition) LIKE '%negative%'
      THEN 1 ELSE 0
    END AS is_dm_conversation,
    
    CASE
      WHEN LOWER(phoneburner_disposition) LIKE '%voicemail%'
      OR LOWER(phoneburner_disposition) = 'vm'
      THEN 1 ELSE 0
    END AS is_voicemail,
    
    CASE
      WHEN LOWER(phoneburner_disposition) LIKE '%meeting%'
      OR LOWER(phoneburner_disposition) LIKE '%booked%'
      OR LOWER(phoneburner_disposition) LIKE '%positive%'
      THEN 1 ELSE 0
    END AS is_meeting,
    
    CASE
      WHEN LOWER(phoneburner_disposition) IN ('bad phone', 'wrong number')
      THEN 1 ELSE 0
    END AS is_bad_data
    
  FROM calls
  WHERE created_at >= '2025-01-01'  -- Adjust date range as needed
),

aggregated_metrics AS (
  SELECT
    COUNT(*) AS total_calls,
    SUM(is_connection) AS total_connections,
    SUM(is_conversation) AS total_conversations,
    SUM(is_dm_conversation) AS total_dm_conversations,
    SUM(is_voicemail) AS total_voicemails,
    SUM(is_meeting) AS total_meetings,
    SUM(is_bad_data) AS total_bad_data,
    SUM(CASE WHEN is_connection = 1 THEN talk_duration ELSE 0 END) AS total_talk_time
  FROM call_classifications
)

SELECT
  -- Raw counts
  total_calls,
  total_connections,
  total_conversations,
  total_dm_conversations,
  total_voicemails,
  total_meetings,
  total_bad_data,
  
  -- Calculated rates (as percentages)
  ROUND((total_connections::NUMERIC / NULLIF(total_calls, 0)) * 100, 1) AS connect_rate,
  ROUND((total_conversations::NUMERIC / NULLIF(total_calls, 0)) * 100, 1) AS conversation_rate,
  ROUND((total_dm_conversations::NUMERIC / NULLIF(total_connections, 0)) * 100, 1) AS dm_conversation_rate,
  ROUND((total_voicemails::NUMERIC / NULLIF(total_calls, 0)) * 100, 1) AS voicemail_rate,
  ROUND((total_meetings::NUMERIC / NULLIF(total_calls, 0)) * 100, 1) AS meeting_rate,
  ROUND((total_meetings::NUMERIC / NULLIF(total_conversations, 0)) * 100, 1) AS meeting_conversion_rate,
  
  -- Average call duration (in seconds)
  ROUND(total_talk_time::NUMERIC / NULLIF(total_connections, 0), 0) AS avg_call_duration_seconds,
  
  -- Data quality
  ROUND((total_bad_data::NUMERIC / NULLIF(total_calls, 0)) * 100, 1) AS bad_data_rate
  
FROM aggregated_metrics;
```

---

## 6. CRITICAL RECOMMENDATIONS

### 6.1 Consider Adding Explicit "Meeting Booked" Disposition
**Priority: MEDIUM**

You currently track meeting-level interest via "Positive - Blacklist Co", but you may want to distinguish between:
- **Meeting-level interest** (would book if not blacklisted) = "Positive - Blacklist Co"
- **Actual pursuable meeting** (company NOT blacklisted) = "Meeting Booked"

**Current State:**
- "Positive - Blacklist Co" = they want a meeting, but you can't work with them
- No explicit disposition for meetings you CAN pursue

**Recommendation:**
Add "Meeting Booked" disposition for when someone books a meeting AND the company is not blacklisted. This lets you track:
1. **Total Meeting Interest Rate** (includes blacklisted companies)
2. **Pursuable Meeting Rate** (excludes blacklisted companies)

This distinction matters for pipeline forecasting and rep performance evaluation.

### 6.2 Clarify "Send Email" Disposition
**Priority: MEDIUM**

"Send Email" is ambiguous - could be gatekeeper asking for email OR prospect asking for email.

**Recommended Solution:**
- Use talk_duration as a proxy: >60 seconds = likely spoke with DM
- OR split into two dispositions: "Gatekeeper - Send Email" and "DM - Send Email"

### 6.3 Track "Do Not Call" Separately
**Priority: HIGH (Legal Compliance)**

"Do Not Call" requests must be tracked for legal compliance (TCPA).

**Action Items:**
1. Create separate table for DNC requests
2. Ensure these contacts are automatically suppressed from future calling lists
3. Generate compliance reports monthly

### 6.4 Verify Data Quality
**Priority: HIGH**

Bad data (Bad Phone, Wrong Number) should be <5% of total calls.

**Monitoring:**
```sql
-- Data quality health check
SELECT 
  ROUND((SUM(CASE WHEN disposition = 'bad_data' THEN 1 ELSE 0 END)::NUMERIC 
    / COUNT(*)) * 100, 1) AS bad_data_rate
FROM calls
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Alert if > 5%
```

---

## 7. DASHBOARD & REPORTING STRUCTURE

### 7.1 Key Metrics to Display (Priority Order)

**Primary Metrics (Always Show):**
1. Total Calls
2. Connect Rate (benchmark: 25-35%)
3. Conversation Rate
4. DM Conversation Rate
5. Meeting Rate (from calls)
6. Meeting Conversion Rate (benchmark: 25-33%)

**Secondary Metrics:**
7. Voicemail Rate
8. Average Call Duration (benchmark: 3-5 minutes)
9. Bad Data Rate (should be <5%)

**Tertiary Metrics (For Detailed Analysis):**
10. Gatekeeper Rate (Receptionist / Connections)
11. Hang-up Rate (Hung Up / Connections)
12. Callback Rate (Callback Requested / Conversations)

### 7.2 Example Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  DAILY CALLING PERFORMANCE                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Total Calls Today: 247                            │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ Connect     │  │ Conversation│  │ Meeting    │ │
│  │ Rate        │  │ Rate        │  │ Rate       │ │
│  │             │  │             │  │            │ │
│  │   28.3%  ✅ │  │   6.1%   ✅ │  │  1.2%   ✅ │ │
│  │ (70 connects│  │ (15 convos) │  │ (3 mtgs)   │ │
│  │             │  │             │  │            │ │
│  │ Target:     │  │ Target:     │  │ Target:    │ │
│  │ 25-35%      │  │ 4-8%        │  │ 0.5-2%     │ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ DM Conv     │  │ Meeting     │  │ Avg Call   │ │
│  │ Rate        │  │ Conversion  │  │ Duration   │ │
│  │             │  │             │  │            │ │
│  │   78.6%  ✅ │  │   20.0%  ⚠️ │  │  4m 12s ✅ │ │
│  │ (55 of 70)  │  │ (3 of 15)   │  │            │ │
│  │             │  │             │  │ Target:    │ │
│  │ Target: >70%│  │ Target:     │  │ 3-5 min    │ │
│  │             │  │ 25-33%      │  │            │ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘

BREAKDOWN BY DISPOSITION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Voicemail:                89  (36.0%)
No Answer:                51  (20.6%)
Receptionist (GK):        15  (6.1%)
Callback Requested:       12  (4.9%)
Not Qualified:             8  (3.2%)
Positive - Blacklist Co:   4  (1.6%)
Negative - Blacklist Co:  18  (7.3%)
Meeting Booked:            3  (1.2%)
Other:                    47  (19.0%)
```

---

## 8. DATA INTEGRITY VALIDATION

### 8.1 Automated Checks to Run Daily

```typescript
/**
 * Daily data quality checks
 * Run these every morning to catch sync/classification issues
 */
async function validateCallData(dateRange: { start: Date; end: Date }) {
  const checks = [];
  
  // Check 1: Verify all calls have a disposition
  const missingDisposition = await db.query(`
    SELECT COUNT(*) as count 
    FROM calls 
    WHERE phoneburner_disposition IS NULL 
      AND created_at BETWEEN $1 AND $2
  `, [dateRange.start, dateRange.end]);
  
  if (missingDisposition.count > 0) {
    checks.push({
      status: 'FAIL',
      check: 'Missing Dispositions',
      message: `${missingDisposition.count} calls have no disposition`,
    });
  }
  
  // Check 2: Connect rate sanity check
  const metrics = await calculateMetrics(dateRange);
  if (metrics.connectRate < 15 || metrics.connectRate > 50) {
    checks.push({
      status: 'WARNING',
      check: 'Connect Rate Out of Range',
      message: `Connect rate ${metrics.connectRate}% is outside normal range (15-50%)`,
    });
  }
  
  // Check 3: Bad data rate check
  if (metrics.badDataRate > 5) {
    checks.push({
      status: 'WARNING',
      check: 'High Bad Data Rate',
      message: `Bad data rate ${metrics.badDataRate}% exceeds 5% threshold`,
    });
  }
  
  // Check 4: Verify meeting conversions are classified correctly
  const meetingCheck = await db.query(`
    SELECT COUNT(*) as count
    FROM calls
    WHERE LOWER(phoneburner_disposition) LIKE '%meeting%'
      AND is_dm_conversation = false
      AND created_at BETWEEN $1 AND $2
  `, [dateRange.start, dateRange.end]);
  
  if (meetingCheck.count > 0) {
    checks.push({
      status: 'FAIL',
      check: 'Meeting Classification Error',
      message: `${meetingCheck.count} meetings not marked as DM conversations`,
    });
  }
  
  return checks;
}
```

### 8.2 Manual Spot Checks (Weekly)

**Every Monday Morning:**
1. Pull 10 random "Callback Requested" calls - verify they're actually DM conversations
2. Pull 10 random "Send Email" calls - check if talk_duration correctly indicates DM vs GK
3. Review any calls with >10 minute duration - ensure they're real conversations
4. Check for any new/unknown dispositions from PhoneBurner

---

## 9. MIGRATION PLAN

### Phase 1: Immediate (Week 1)
- [ ] Add classification logic to PhoneBurner webhook/sync
- [ ] Update database schema with classification fields
- [ ] Backfill last 30 days of calls with new classifications
- [ ] Add "Meeting Booked" disposition to PhoneBurner

### Phase 2: Validation (Week 2)
- [ ] Run data quality checks
- [ ] Compare old vs new metric calculations
- [ ] Spot check 50 random calls for accuracy
- [ ] Train team on new disposition usage

### Phase 3: Go Live (Week 3)
- [ ] Update all dashboards with new metrics
- [ ] Update reports to use new calculations
- [ ] Document disposition guide for team
- [ ] Set up automated alerts for data issues

### Phase 4: Optimization (Ongoing)
- [ ] Monitor metric accuracy weekly
- [ ] Gather feedback from team on disposition clarity
- [ ] Refine "Send Email" handling based on data
- [ ] Add more granular tracking as needed

---

## 10. FREQUENTLY ASKED QUESTIONS

### Q: Why can't connect rate be denominator for everything?
**A:** Connect rate measures reachability. But not all connections are conversations with decision makers. You need separate denominators to properly measure conversion efficiency at each stage:
- Calls → Connections (reachability)
- Connections → Conversations (getting past gatekeepers)
- Conversations → Meetings (conversion skill)

### Q: Should "Hung Up" count as a connection?
**A:** YES. You successfully reached a person (they answered). They just hung up immediately. This helps track if your opening is effective. High "Hung Up" rate indicates bad openers or poor list targeting.

### Q: What's the difference between "Conversation Rate" and "DM Conversation Rate"?
**A:**
- **Conversation Rate**: % of total calls that became meaningful dialogues
- **DM Conversation Rate**: % of connections that were with decision makers

Example: 100 calls → 30 connections (30% connect rate)
- 20 were gatekeepers, 10 were DM conversations
- DM Conversation Rate = 10/30 = 33.3%
- Conversation Rate = 10/100 = 10%

### Q: How do I handle "Send Email" disposition?
**A:** Use talk_duration as proxy:
- <60 seconds = likely gatekeeper asking for email → NOT a conversation
- >60 seconds = likely DM asking for follow-up → IS a conversation

Or split into two dispositions: "GK - Send Email" and "DM - Send Email"

### Q: What's the difference between "Positive - Blacklist Co" and "Meeting Booked"?
**A:** 
- **"Positive - Blacklist Co"**: Prospect showed meeting-level interest BUT the company is blacklisted, so you can't pursue it. Still counts as meeting-level interest for performance tracking.
- **"Meeting Booked"** (recommended to add): Prospect booked a meeting AND company is NOT blacklisted, so you can actually pursue it.

Think of it as:
- Total Meeting Interest = Positive - Blacklist Co + Meeting Booked
- Pursuable Meetings = Meeting Booked only

This distinction matters for:
1. **Rep performance**: Did they get the prospect interested? (counts both)
2. **Pipeline forecasting**: What can we actually pursue? (counts only Meeting Booked)

### Q: What if PhoneBurner adds new dispositions?
**A:** Your classification function should have a default case that:
1. Logs unknown dispositions for review
2. Defaults to conservative classification (no_answer)
3. Alerts you to update the mapping

---

## 11. LOVABLE PROMPT FOR IMPLEMENTATION

```
I need to implement disposition-to-metrics mapping for cold calling analytics.

CONTEXT:
- We use PhoneBurner for cold calling
- We sync call data to Supabase
- We display metrics in our Envoy Atlas dashboard

DISPOSITIONS TO MAP:
[paste your disposition list here]

REQUIRED IMPLEMENTATION:
1. Create a disposition classification service that maps PhoneBurner dispositions to:
   - disposition (connected/voicemail/no_answer/bad_data)
   - conversation_outcome (meeting_booked/interested/not_qualified/etc)
   - is_dm_conversation (boolean)
   - counts_as_connection (boolean)
   - counts_as_conversation (boolean)

2. Update the PhoneBurner sync function to call this classification service

3. Create SQL views for the following metrics:
   - Connect Rate: (connections / totalCalls) × 100
   - Conversation Rate: (conversations / totalCalls) × 100
   - DM Conversation Rate: (dmConversations / connections) × 100
   - Meeting Rate: (meetings / totalCalls) × 100
   - Meeting Conversion: (meetings / conversations) × 100
   - Voicemail Rate: (voicemails / totalCalls) × 100
   - Avg Call Duration: totalTalkTime / connections

4. Add data validation checks that run daily to ensure:
   - All calls have dispositions
   - Connect rate is between 15-50%
   - Bad data rate is below 5%
   - Meetings are marked as DM conversations

5. Update dashboard components to use new metrics calculations

FILES TO MODIFY:
- /src/lib/constants/dispositions.ts (add PhoneBurner mappings)
- /src/lib/metrics.ts (add calculation functions)
- /supabase/functions/phoneburner-sync/index.ts (add classification)
- /src/hooks/useCallingAnalytics.tsx (update queries)

IMPORTANT NOTES:
- Use the classification logic from the disposition-metrics-mapping.md file
- Ensure all metrics use the correct denominators (totalCalls vs connections vs conversations)
- Add proper TypeScript types for all new functions
- Include error handling for unknown dispositions
- Log any classification issues for manual review
```

---

## 12. SUMMARY CHECKLIST

Before deploying:
- [ ] All dispositions are mapped to classification fields
- [ ] Metrics calculations use correct denominators
- [ ] "Meeting Booked" disposition added
- [ ] "Send Email" ambiguity handled
- [ ] Data quality checks implemented
- [ ] Dashboard updated with new metrics
- [ ] Team trained on disposition usage
- [ ] Backfill completed for historical data
- [ ] Daily validation jobs scheduled
- [ ] Documentation shared with team

---

**Document Version:** 1.0  
**Last Updated:** January 22, 2026  
**Owner:** Tomos (SourceCo CTO)  
**For Questions:** Reference sections above or check /src/lib/metrics.ts

