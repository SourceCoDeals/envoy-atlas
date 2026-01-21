# ENVOY ATLAS REMEDIATION TRACKER

**Updated:** January 21, 2026  
**Status:** 🟠 NOT PRODUCTION READY  
**Target:** 🟢 PRODUCTION READY by Week 3

---

## CRITICAL ISSUES - MUST FIX (Phase 1)

### 🔴 CRITICAL-1: API Credentials Exposed
- **Status:** ⏳ NOT STARTED
- **Owner:** Security Lead
- **Timeline:** 2 hours
- **Deadline:** BEFORE ANY PROD DEPLOYMENT
- **Checklist:**
  - [ ] Rotate Supabase project API key
  - [ ] Regenerate publishable key at https://app.supabase.com/settings
  - [ ] Verify .env in .gitignore
  - [ ] Run `git filter-branch` to remove from history
  - [ ] Verify RLS policies are strict (test data access)
  - [ ] Document new key in 1Password
  - [ ] Require env var injection in all deploys
  - [ ] Verify production uses env vars, not hardcoded values
- **Verification:** ✅ Keys changed, ❌ No exposed secrets in git

---

### 🔴 CRITICAL-2: Webhook Signature Validation Missing
- **Status:** ⏳ NOT STARTED
- **Owner:** Backend Lead
- **Timeline:** 8-12 hours
- **Deadline:** BEFORE GOING LIVE
- **Subtasks:**
  - [ ] Create `supabase/functions/shared/webhook-validation.ts`
  - [ ] Implement HMAC-SHA256 validation function
  - [ ] Update `smartlead-webhook` with signature check
  - [ ] Update `replyio-webhook` with signature check
  - [ ] Store webhook secrets in Supabase env (not .env)
  - [ ] Test with valid signature (should pass)
  - [ ] Test with invalid signature (should fail)
  - [ ] Add rate limiting to both webhooks
  - [ ] Document webhook secret setup
  - [ ] Security review before deployment
- **Verification:** ✅ Webhook rejects unsigned requests, ✅ Valid sigs accepted

**Test Command:**
```bash
curl -X POST https://webhook.local/smartlead-webhook \
  -H "x-smartlead-signature: invalid" \
  -d '{"event_type":"EMAIL_REPLY"}' \
# Should return 401 Unauthorized
```

---

### 🔴 CRITICAL-3: Reply.io Integration Incomplete
- **Status:** ⏳ NOT STARTED
- **Owner:** Backend Engineer
- **Timeline:** 16-24 hours
- **Deadline:** BEFORE GOING LIVE
- **Subtasks:**
  - [ ] Create `supabase/functions/shared/replyio-mappings.ts`
  - [ ] Implement all event handler functions:
    - [ ] `processEmailOpen`
    - [ ] `processEmailClick`
    - [ ] `processEmailReply`
    - [ ] `processEmailBounce`
    - [ ] `processUnsubscribe`
    - [ ] `processCategoryUpdate`
  - [ ] Implement contact creation logic
  - [ ] Test end-to-end with real Reply.io webhook
  - [ ] Verify metrics flow to dashboard
  - [ ] Load test with 100+ webhooks
  - [ ] Compare SmartLead vs Reply.io metrics (should match)
- **Verification:** ✅ Email metrics visible in dashboard, ✅ Metrics match SmartLead

**Acceptance Criteria:**
- Send test Reply.io webhook → Metrics update in database ✅
- Dashboard shows Reply.io and SmartLead data together ✅
- No "Unknown" values for Reply.io campaigns ✅

---

### 🔴 CRITICAL-4: Race Conditions in Metric Updates
- **Status:** ⏳ NOT STARTED
- **Owner:** Backend Lead
- **Timeline:** 24-32 hours
- **Deadline:** BEFORE GOING LIVE
- **Subtasks:**
  - [ ] Create migration: `add_atomic_metric_functions.sql`
  - [ ] Implement `increment_campaign_metric()` RPC function
  - [ ] Implement `upsert_hourly_metric()` RPC function
  - [ ] Replace all application-level counting with RPC calls
  - [ ] Remove `updatePositiveReplyCounts()` function
  - [ ] Remove application-level `incrementHourlyMetric()` logic
  - [ ] Test with concurrent webhooks (spawn 100 simultaneously)
  - [ ] Verify: positive_replies count is exact match
  - [ ] Verify: no "Unknown" reps in dashboards
  - [ ] Verify: all metric values are correct (not NaN)
- **Verification:** ✅ Concurrent test shows correct counts, ✅ Dashboard metrics accurate

**Load Test:**
```bash
# Spin up 100 concurrent webhook calls
for i in {1..100}; do
  curl -X POST https://webhook/smartlead-webhook \
    -H "x-smartlead-signature: [valid_sig]" \
    -d '{"event_type":"EMAIL_REPLY","reply_category":"interested"}' &
done

# Verify count is exactly 100 (not 99, not 101)
SELECT positive_replies FROM campaigns WHERE id = 'test-id';
# Should be 100
```

---

### 🔴 CRITICAL-5: Database Connection Pooling
- **Status:** ⏳ NOT STARTED
- **Owner:** DevOps / Backend
- **Timeline:** 4-8 hours
- **Deadline:** BEFORE PRODUCTION
- **Subtasks:**
  - [ ] Enable PgBouncer in Supabase:
    - Go to https://app.supabase.com/project/[ID]/settings/database
    - [ ] Set Connection Pooling Mode to "Transaction"
    - [ ] Set Pool Size to 25
  - [ ] Update client code to use pooled connection
  - [ ] Create singleton Supabase client (only one per browser)
  - [ ] Test with load generator (100 concurrent users)
  - [ ] Monitor connection count in Supabase dashboard
  - [ ] Verify: no "Connection pool exhausted" errors
  - [ ] Set up alerts for > 80% pool usage
- **Verification:** ✅ 100 concurrent users, no connection errors

**Load Test:**
```bash
# Use k6 or Artillery
- 100 virtual users
- Each makes 10 requests per second for 5 minutes
- Monitor connection count (should stay < 30)
# PASS if: no connection errors, response time < 500ms
```

---

## HIGH-PRIORITY ISSUES - Phase 2 (30 Days)

### 🟠 HIGH-1: Authorization Checks on Admin Endpoints
- **Status:** ⏳ NOT STARTED
- **Owner:** Backend Engineer
- **Timeline:** 6-8 hours
- **Deadline:** Week 3-4
- **Checklist:**
  - [ ] Create `supabase/functions/shared/auth-helpers.ts`
  - [ ] Implement `requireAuth()` function
  - [ ] Implement `verifyEngagementOwnership()` function
  - [ ] Add authorization to `sync-reset` function
  - [ ] Add authorization to `nocodb-sync` function
  - [ ] Add authorization to all admin functions
  - [ ] Test: User A cannot access User B's data
  - [ ] Security review
- **Verification:** ✅ Cross-account access rejected

---

### 🟠 HIGH-2: Input Validation on Webhooks
- **Status:** ⏳ NOT STARTED
- **Owner:** Backend Engineer
- **Timeline:** 4-6 hours
- **Deadline:** Week 3-4
- **Checklist:**
  - [ ] Create `supabase/functions/shared/webhook-schemas.ts`
  - [ ] Define Zod schemas for all webhook events
  - [ ] Add validation to smartlead-webhook
  - [ ] Add validation to replyio-webhook
  - [ ] Test: Invalid data rejected
  - [ ] Test: XSS payloads sanitized
  - [ ] Error messages don't expose internals
- **Verification:** ✅ Malformed payloads rejected

---

### 🟠 HIGH-3: Admin Panel Access Controls
- **Status:** ⏳ NOT STARTED
- **Owner:** Full-Stack
- **Timeline:** 8-12 hours
- **Deadline:** Week 3-4
- **Checklist:**
  - [ ] Implement role-based access control
  - [ ] Add admin role enforcement
  - [ ] Add confirmation dialogs for destructive operations
  - [ ] Add audit logging for admin changes
  - [ ] Restrict metric changes after data exists
  - [ ] Test: Non-admins cannot access settings
- **Verification:** ✅ Non-admins see "Access Denied"

---

### 🟠 HIGH-4: NocoDB Error Handling
- **Status:** ⏳ NOT STARTED
- **Owner:** Backend Engineer
- **Timeline:** 6-8 hours
- **Deadline:** Week 3-4
- **Checklist:**
  - [ ] Add retry logic with exponential backoff
  - [ ] Create dead-letter queue for failed syncs
  - [ ] Add status tracking (pending/in_progress/failed/success)
  - [ ] Implement manual retry mechanism
  - [ ] Add alerting when sync fails
  - [ ] Test: Handle NocoDB being down
- **Verification:** ✅ Failed syncs logged, ✅ Can retry manually

---

### 🟠 HIGH-5: Data Freshness Indicators
- **Status:** ⏳ NOT STARTED
- **Owner:** Frontend Engineer
- **Timeline:** 4-6 hours
- **Deadline:** Week 3-4
- **Checklist:**
  - [ ] Add `synced_at` to metric tables
  - [ ] Calculate freshness score (age of data)
  - [ ] Display freshness badge on dashboards
  - [ ] Gray out metrics older than 24 hours
  - [ ] Alert if sync hasn't run in 24 hours
  - [ ] Test: Badge updates correctly
- **Verification:** ✅ Freshness badge visible and accurate

---

### 🟠 HIGH-6: Configurable Metric Thresholds
- **Status:** ⏳ NOT STARTED
- **Owner:** Full-Stack
- **Timeline:** 8-10 hours
- **Deadline:** Week 3-4
- **Checklist:**
  - [ ] Create `workspace_settings` table
  - [ ] Move all hardcoded thresholds to database
  - [ ] Create admin UI for threshold configuration
  - [ ] Add sensible defaults per industry
  - [ ] Version threshold changes for audit trail
  - [ ] Recalculate historical metrics on change
  - [ ] Test: Changing thresholds updates dashboard
- **Verification:** ✅ Admin can change thresholds, ✅ Dashboard updates

---

### 🟠 HIGH-7: Call Data Deduplication
- **Status:** ⏳ NOT STARTED
- **Owner:** Backend Engineer
- **Timeline:** 4-6 hours
- **Deadline:** Week 3-4
- **Checklist:**
  - [ ] Add unique constraint on (engagement_id, external_call_id, platform)
  - [ ] Use UPSERT for calls (don't INSERT if exists)
  - [ ] Test: Re-running sync doesn't duplicate records
  - [ ] Verify: Metrics don't double-count
- **Verification:** ✅ Duplicate syncs don't create duplicate records

---

### 🟠 HIGH-8: Structured Logging & Monitoring
- **Status:** ⏳ NOT STARTED
- **Owner:** DevOps Engineer
- **Timeline:** 8-12 hours
- **Deadline:** Week 3-4
- **Checklist:**
  - [ ] Integrate Sentry or Datadog
  - [ ] Add structured JSON logging to functions
  - [ ] Log all webhook events
  - [ ] Log all database errors
  - [ ] Set up alerting for critical errors
  - [ ] Create dashboard for key metrics
  - [ ] Test: Errors appear in monitoring system
- **Verification:** ✅ Error visible in monitoring within 5 seconds

---

## MEDIUM-PRIORITY ISSUES - Phase 3 (90 Days)

| Issue | Status | Owner | Hours | Deadline |
|---|---|---|---|---|
| Comprehensive test suite | ⏳ | QA | 20-30 | Month 2 |
| PhoneBurner OAuth refresh | ⏳ | Backend | 6-8 | Month 2 |
| Fireflies error handling | ⏳ | Backend | 4-6 | Month 2 |
| Database indexes | ⏳ | DevOps | 2-4 | Month 2 |
| Tenant isolation verification | ⏳ | Security | 4-6 | Month 2 |
| Disposition mapping | ⏳ | Backend | 4-6 | Month 2 |
| Campaign linking validation | ⏳ | Backend | 2-4 | Month 2 |
| Error message improvements | ⏳ | UX | 4-6 | Month 3 |
| Backup/DR procedures | ⏳ | DevOps | 4-8 | Month 3 |
| Dependency audit | ⏳ | DevOps | 2-4 | Month 3 |

---

## VERIFICATION TESTS

### Test 1: Metric Accuracy
```
Prerequisite: Fix CRITICAL-4 (race conditions)
Test: Send 100 concurrent webhook events
Expected: Exactly 100 metrics recorded (not 99, not 101)
Status: ⏳ NOT RUN
Result: [Record result here]
```

### Test 2: Webhook Signature Validation
```
Prerequisite: Fix CRITICAL-2
Test 1: Send webhook with invalid signature
Expected: Returns 401 Unauthorized
Test 2: Send webhook with valid signature
Expected: Processes successfully
Status: ⏳ NOT RUN
Result: [Record result here]
```

### Test 3: Load Test (100 Concurrent Users)
```
Prerequisite: Fix CRITICAL-5 (connection pooling)
Test: Spin up 100 virtual users, 10 req/sec for 5 mins
Expected: Zero connection errors, response time < 500ms
Status: ⏳ NOT RUN
Result: [Record result here]
Tool: k6 / Artillery
Command: [Record command used]
```

### Test 4: Reply.io Integration
```
Prerequisite: Fix CRITICAL-3
Test: Send test Reply.io webhook
Expected: Metrics appear in dashboard
Expected: Metrics match SmartLead calculations
Status: ⏳ NOT RUN
Result: [Record result here]
```

### Test 5: Data Isolation (Tenant Security)
```
Test: Log in as User A, try to access User B's campaigns
Expected: Returns 403 Forbidden / No data visible
Status: ⏳ NOT RUN
Result: [Record result here]
```

---

## DEPLOYMENT GATES

### Gate 1: CRITICAL Issues Fixed (Week 1)
- [ ] API credentials rotated
- [ ] Webhook signatures verified
- [ ] Reply.io processing working
- [ ] Race conditions fixed
- [ ] Connection pooling enabled

**Go/No-Go:** ✅ GO / ❌ NO-GO

### Gate 2: HIGH Issues Fixed (Week 3)
- [ ] Authorization checks added
- [ ] Input validation added
- [ ] Admin access controls working
- [ ] NocoDB error handling working
- [ ] Data freshness visible
- [ ] Thresholds configurable

**Go/No-Go:** ✅ GO / ❌ NO-GO

### Gate 3: Production Readiness (Week 4)
- [ ] 100-user load test passed
- [ ] Security audit completed
- [ ] All tests passing
- [ ] Monitoring configured
- [ ] Runbooks documented

**Go/No-Go:** ✅ GO / ❌ NO-GO

---

## DAILY STANDUP TEMPLATE

**Date:** ___________  
**Sprint:** Phase _____ (CRITICAL / HIGH / MEDIUM)

### COMPLETED
- [ ] Task 1: _____ (✅ Done)
- [ ] Task 2: _____ (✅ Done)

### IN PROGRESS
- [ ] Task 3: _____ (⏳ 60% complete)
- [ ] Task 4: _____ (⏳ 30% complete)

### BLOCKERS
- [ ] Blocker 1: _____ (assigned to: _____)

### NEXT 24 HOURS
- [ ] Task 5: _____
- [ ] Task 6: _____

### RISKS
- [ ] Risk 1: _____

---

## RESOURCE ALLOCATION

**Week 1-2 (Phase 1):**
- Backend Lead: 50% (CRITICAL-2, CRITICAL-4)
- Backend Engineer: 50% (CRITICAL-1, CRITICAL-5)
- DevOps: 25% (CRITICAL-5, CRITICAL-1)
- QA: 25% (Testing all fixes)

**Week 3-4 (Phase 2):**
- Backend Engineer (2x): 50% each (HIGH-1 through HIGH-8)
- Frontend Engineer: 25% (HIGH-5)
- DevOps: 25% (HIGH-8)

**Month 2 (Phase 3):**
- Backend/Full-Stack: 50% (MEDIUM issues)
- QA: 50% (test coverage)
- DevOps: 25% (monitoring, indexes)

**Total Estimate:** 40-50 person-weeks

---

## SUCCESS METRICS

| Metric | Target | Current | Week 1 | Week 2 | Week 3 | Week 4 |
|---|---|---|---|---|---|---|
| CRITICAL issues fixed | 5/5 | 0/5 | 2/5 | 5/5 | 5/5 | 5/5 |
| HIGH issues fixed | 8/8 | 0/8 | 0/8 | 2/8 | 5/8 | 8/8 |
| Dashboard accuracy | 100% | 70% | 80% | 90% | 100% | 100% |
| Concurrent users supported | 100+ | <50 | <50 | 75 | 100 | 100+ |
| Test coverage | 70% | 0% | 10% | 20% | 40% | 70% |
| Security audit | Pass | Fail | Fail | Pass | Pass | Pass |
| Load test (100 users) | Pass | N/A | N/A | N/A | Fail | Pass |

---

## SIGN-OFF

**Project Manager:** ________________  
**Engineering Lead:** ________________  
**Security Lead:** ________________  
**Date:** ________________

---

**Questions or updates?** Update this tracker daily and share in team standup.
