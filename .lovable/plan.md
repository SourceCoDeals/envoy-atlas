

# Envoy Atlas Remediation Plan - Implementation Roadmap

Based on the CTO audit report and detailed remediation prompt, this plan organizes work into three phases by priority.

---

## Current State Assessment

### Already Completed
| Item | Status | Location |
|------|--------|----------|
| Reply Rate Standardization | Done | `src/lib/metrics.ts` - `calculateReplyRateFromDelivered()` |
| Data Source Badges | Done | `src/components/ui/data-source-badge.tsx` |
| WoW Cap at 999% | Done | `useOverviewDashboard.tsx` |
| Positive Replies Sync | Done | Edge function sync |
| Disposition Simplification | Done | `DispositionPieChart.tsx` |

### Not Yet Implemented
| Item | Priority | Effort |
|------|----------|--------|
| Testing Framework (Vitest) | Critical | 4-6 hours |
| Error Boundaries | High | 2 hours |
| Logger Utility | Medium | 1 hour |
| Webhook Retry Queue | High | 4 hours |
| call_analysis Table | Medium | 3 hours |
| Performance Indexes | Medium | 1 hour |

---

## Phase 1: Critical Fixes (Week 1-2)

### 1.1 Add Testing Framework

**Files to Create:**
- `vitest.config.ts` - Vitest configuration with jsdom environment
- `src/test/setup.ts` - Global test setup with Supabase mocks
- `src/test/mocks/handlers.ts` - MSW handlers for API mocking

**Package.json Updates:**
Add devDependencies:
- `@testing-library/react: ^14.1.0`
- `@testing-library/jest-dom: ^6.1.0`  
- `@testing-library/user-event: ^14.5.0`
- `vitest: ^1.2.0`
- `@vitest/coverage-v8: ^1.2.0`
- `jsdom: ^23.0.0`
- `msw: ^2.0.0`

Add scripts:
- `"test": "vitest"`
- `"test:coverage": "vitest --coverage"`
- `"test:ui": "vitest --ui"`

### 1.2 Initial Test Suite

**Files to Create:**
- `src/lib/__tests__/metrics.test.ts` - Unit tests for metrics calculations
- `src/lib/__tests__/callScoring.test.ts` - Call scoring logic tests
- `src/hooks/__tests__/useOverviewDashboard.test.tsx` - Dashboard hook tests

Test coverage targets:
- `calculateRate()` - zero division, normal cases
- `calculateReplyRateFromDelivered()` - standard formula
- `calculateWoWChange()` - cap at 999%, trend detection
- `calculateEnhancedScore()` - scoring breakdown validation

### 1.3 Error Boundary Component

**File to Create:** `src/components/error/ErrorBoundary.tsx`

Features:
- Catches React render errors
- Displays friendly error card with retry button
- Logs errors to console (later: external service)
- Optional custom fallback UI

**Wrap Major Sections:**
- Dashboard pages
- Data tables
- Chart components

---

## Phase 2: High Priority Fixes (Week 3-4)

### 2.1 Logger Utility

**File to Create:** `src/lib/logger.ts`

```text
logger.debug() - Dev only
logger.info()  - Dev only  
logger.warn()  - Always
logger.error() - Always + future external tracking
```

Systematically replace 109 console statements with appropriate logger calls.

### 2.2 Webhook Retry Queue

**Database Migration:**
Create `webhook_retry_queue` table with:
- `id`, `webhook_type`, `payload` (JSONB)
- `attempt_count`, `max_attempts` (default 5)
- `status` ('pending', 'processing', 'completed', 'failed')
- `idempotency_key` (UNIQUE)
- `next_attempt_at`, `last_attempt_at`

**Edge Function Updates:**
- Add idempotency key generation
- Wrap processing in try-catch
- Queue failed webhooks for retry
- Mark successful webhooks as completed

### 2.3 Sync Status Hook

**File to Create:** `src/hooks/useSyncStatus.tsx`

Features:
- Subscribe to `sync_status` table changes via realtime
- Show toast notifications on sync failures
- Provide `triggerSync(platform)` function
- Track last sync time per platform

---

## Phase 3: Medium Priority (Month 2)

### 3.1 Normalize cold_calls Schema

**Database Migration:**
Create `call_analysis` table to extract 25+ AI scoring columns:
- Composite and individual scores
- Reasoning fields
- Analyzer metadata

This reduces `cold_calls` from 66 columns to ~40 core columns.

### 3.2 Performance Indexes

**Indexes to Create:**
- `idx_campaigns_engagement_status` - Campaign queries
- `idx_daily_metrics_date_engagement` - Time-series queries
- `idx_cold_calls_date` - Date range filtering
- `idx_cold_calls_analyst` - Rep performance queries
- `idx_campaigns_active` - Partial index for active only

### 3.3 Component Refactoring

Split `EnhancedCampaignTable.tsx` (724 lines) into:
- `CampaignTableHeader.tsx`
- `CampaignTableRow.tsx`
- `useCampaignTableSort.ts`
- `CampaignBulkActions.tsx`

---

## Implementation Summary

### File Creations (9 files)
| File | Purpose |
|------|---------|
| `vitest.config.ts` | Test framework config |
| `src/test/setup.ts` | Test environment setup |
| `src/test/mocks/handlers.ts` | MSW API mocks |
| `src/lib/__tests__/metrics.test.ts` | Metrics unit tests |
| `src/lib/__tests__/callScoring.test.ts` | Scoring tests |
| `src/hooks/__tests__/useOverviewDashboard.test.tsx` | Hook tests |
| `src/components/error/ErrorBoundary.tsx` | Error boundary |
| `src/lib/logger.ts` | Production logger |
| `src/hooks/useSyncStatus.tsx` | Realtime sync status |

### Database Migrations (3 migrations)
| Migration | Tables/Indexes |
|-----------|----------------|
| Webhook Retry Queue | `webhook_retry_queue` table + indexes |
| Call Analysis Normalization | `call_analysis` table |
| Performance Optimization | 5-6 new indexes |

### Package.json Updates
- 7 new devDependencies for testing
- 3 new npm scripts

---

## Validation Checklist

### Phase 1 Completion
- `npm test` runs successfully
- Test coverage > 30% for `src/lib/*.ts`
- Error boundaries wrap all dashboard pages
- No TypeScript errors in new files

### Phase 2 Completion
- Sync failures show toast notifications
- Failed webhooks queued for retry
- Console statements replaced with logger
- Idempotency prevents duplicate processing

### Phase 3 Completion  
- `call_analysis` table populated from existing data
- Dashboard queries under 500ms
- `EnhancedCampaignTable` split into 4+ files

---

## Estimated Effort

| Phase | Duration | Person-Hours |
|-------|----------|--------------|
| Phase 1 | Week 1-2 | 12-16 hours |
| Phase 2 | Week 3-4 | 10-14 hours |
| Phase 3 | Month 2 | 8-10 hours |
| **Total** | **6 weeks** | **30-40 hours** |

This matches the CTO audit's estimate of 30-40 person-weeks for full remediation.

