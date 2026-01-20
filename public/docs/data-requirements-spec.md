# Data Requirements Specification
## SmartLead & Reply.io Integration

**Version:** 1.0  
**Last Updated:** January 2026  
**Purpose:** Complete field-level mapping of all data points required from SmartLead and Reply.io to power Atlas reporting, dashboards, and analytics.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [SmartLead API Requirements](#smartlead-api-requirements)
3. [Reply.io API Requirements](#replyio-api-requirements)
4. [PhoneBurner API Requirements](#phoneburner-api-requirements)
5. [Database Table Mappings](#database-table-mappings)
6. [Webhook Events](#webhook-events)
7. [Data Processing Notes](#data-processing-notes)

---

## Executive Summary

This document specifies all data fields that must be pulled from external platforms to power the Atlas reporting system. Each field includes:
- **Source API endpoint**
- **Source field name**
- **Destination database table/column**
- **Data type**
- **Required/Optional status**

### Platform Coverage

| Platform | Primary Use Case | API Version |
|----------|------------------|-------------|
| SmartLead | Email Campaigns | v1 |
| Reply.io | Email Sequences | v1 + v3 |
| PhoneBurner | Calling Activities | REST v1 |

---

## SmartLead API Requirements

### Base URL
```
https://server.smartlead.ai/api/v1
```

### Authentication
- Query parameter: `?api_key={API_KEY}`

---

### 1. Campaigns List
**Endpoint:** `GET /campaigns`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `id` | number | campaigns | external_id | ✅ | Cast to string |
| `name` | string | campaigns | name | ✅ | |
| `status` | string | campaigns | status | ✅ | Lowercase: active, paused, drafted, completed |
| `created_at` | datetime | campaigns | started_at | ✅ | |
| `scheduler_cron_value` | string | campaigns | schedule_config.scheduler_cron_value | ❌ | |
| `min_time_btwn_emails` | number | campaigns | min_time_between_emails | ❌ | |
| `max_leads_per_day` | number | campaigns | max_leads_per_day | ❌ | |
| `timezone` | string | campaigns | timezone | ❌ | |
| `user_id` | number | campaigns | owner_id | ❌ | Cast to string |
| `client_id` | number | campaigns | team_id | ❌ | Cast to string |
| `track_settings` | object | campaigns | track_settings | ❌ | JSON: {track_open, track_click, track_reply} |
| `stop_lead_settings` | object | campaigns | stop_lead_settings | ❌ | JSON: {stop_on_reply, stop_on_auto_reply, stop_on_meeting_booked} |

---

### 2. Campaign Analytics
**Endpoint:** `GET /campaigns/{campaign_id}/analytics`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `sent_count` | number | campaigns | total_sent | ✅ | Primary metric |
| `unique_sent_count` | number | - | - | ❌ | Not used |
| `open_count` | number | - | - | ❌ | Deprecated per data policy |
| `unique_open_count` | number | campaigns | total_opened | ❌ | De-emphasized |
| `click_count` | number | - | - | ❌ | Deprecated per data policy |
| `unique_click_count` | number | - | - | ❌ | Deprecated |
| `reply_count` | number | campaigns | total_replied | ✅ | **Critical metric** |
| `bounce_count` | number | campaigns | total_bounced | ✅ | |
| `unsubscribe_count` | number | campaigns | total_unsubscribed | ❌ | |
| `total_count` | number | enrollment_snapshots | total_leads | ❌ | Enrollment tracking |
| `drafted_count` | number | campaigns | settings.drafted_count | ❌ | |
| `campaign_lead_stats.total` | number | enrollment_snapshots | total_leads | ❌ | |
| `campaign_lead_stats.notStarted` | number | enrollment_snapshots | not_started | ❌ | |
| `campaign_lead_stats.inprogress` | number | enrollment_snapshots | in_progress | ❌ | |
| `campaign_lead_stats.completed` | number | enrollment_snapshots | completed | ❌ | |
| `campaign_lead_stats.blocked` | number | enrollment_snapshots | blocked | ❌ | |
| `campaign_lead_stats.paused` | number | enrollment_snapshots | paused | ❌ | |
| `campaign_lead_stats.unsubscribed` | number | enrollment_snapshots | unsubscribed | ❌ | |

**Derived Fields (calculated):**
- `total_delivered` = total_sent - total_bounced
- `reply_rate` = total_replied / total_delivered (stored as 0.0-1.0 decimal)
- `bounce_rate` = total_bounced / total_sent (stored as 0.0-1.0 decimal)
- `metrics_hash` = `{sent}-{opened}-{replied}-{bounced}` for skip-unchanged optimization

---

### 3. Campaign Analytics by Date
**Endpoint:** `GET /campaigns/{campaign_id}/analytics-by-date?start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}`

**Note:** Maximum 29-day window per request

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `date` | string | daily_metrics | date | ✅ | YYYY-MM-DD format |
| `sent_count` | number | daily_metrics | emails_sent | ✅ | |
| `open_count` | number | daily_metrics | emails_opened | ❌ | De-emphasized |
| `unique_open_count` | number | daily_metrics | unique_opens | ❌ | |
| `click_count` | number | daily_metrics | emails_clicked | ❌ | Deprecated |
| `reply_count` | number | daily_metrics | emails_replied | ✅ | |
| `bounce_count` | number | daily_metrics | emails_bounced | ✅ | |

---

### 4. Campaign Sequences (Email Templates)
**Endpoint:** `GET /campaigns/{campaign_id}/sequences`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `seq_id` | number | campaign_variants | external_id | ✅ | Cast to string |
| `seq_number` | number | campaign_variants | step_number | ✅ | |
| `subject` | string | campaign_variants | subject_line | ✅ | |
| `email_body` | string | campaign_variants | body_html | ✅ | |
| `seq_delay_details.delay_in_days` | number | campaign_variants | delay_days | ❌ | |
| `variant_label` | string | campaign_variants | variant_label | ❌ | A/B test variant |
| `send_as_reply` | boolean | campaign_variants | send_as_reply | ❌ | |
| `sequence_variants` | array | campaign_variants | (multiple rows) | ❌ | A/B variants |

**Derived Fields:**
- `body_plain` = HTML stripped to plain text
- `body_preview` = First 200 chars of body_plain
- `personalization_vars` = Extracted {{variable}} patterns

---

### 5. Lead Categories
**Endpoint:** `GET /leads/fetch-categories`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `id` | number/string | lead_categories | external_id | ✅ | |
| `name` | string | lead_categories | name | ✅ | |
| `color` | string | lead_categories | color | ❌ | |
| `is_positive` | boolean | lead_categories | is_positive | ❌ | Inferred if missing |
| `is_meeting` | boolean | lead_categories | is_meeting | ❌ | Inferred if missing |
| `is_ooo` | boolean | lead_categories | is_ooo | ❌ | Inferred if missing |
| `sort_order` | number | lead_categories | sort_order | ❌ | |

**Category Mapping (SmartLead → Internal):**

| SmartLead Category | reply_category | sentiment | is_positive |
|--------------------|----------------|-----------|-------------|
| Interested | interested | positive | ✅ |
| Meeting Booked | meeting_request | positive | ✅ |
| Meeting Scheduled | meeting_request | positive | ✅ |
| Positive | interested | positive | ✅ |
| Not Interested | not_interested | negative | ❌ |
| Out of Office | out_of_office | neutral | ❌ |
| OOO | out_of_office | neutral | ❌ |
| Wrong Person | referral | neutral | ❌ |
| Unsubscribed | unsubscribe | negative | ❌ |
| Do Not Contact | unsubscribe | negative | ❌ |
| Neutral | neutral | neutral | ❌ |
| Question | question | neutral | ❌ |
| Not Now | not_now | neutral | ❌ |

---

### 6. Campaign Leads (Optional - Disabled by Default)
**Endpoint:** `GET /campaigns/{campaign_id}/leads?offset={n}&limit=100`

**⚠️ Currently disabled** - Leads pagination is extremely slow. Enable with `sync_leads: true`.

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `id` | number | contacts | external_lead_id | ✅ | |
| `email` | string | contacts | email | ✅ | |
| `first_name` | string | contacts | first_name | ❌ | |
| `last_name` | string | contacts | last_name | ❌ | |
| `company_name` | string | companies | name | ❌ | Creates company record |
| `phone_number` | string | contacts | phone | ❌ | |
| `website` | string | companies | website | ❌ | |
| `linkedin_profile` | string | contacts | linkedin_url | ❌ | |
| `lead_status` | string | contacts | sequence_status | ❌ | |
| `email_status` | string | contacts | email_status | ❌ | |
| `is_interested` | boolean | contacts | is_interested | ❌ | |
| `is_unsubscribed` | boolean | contacts | is_unsubscribed | ❌ | |
| `last_email_sequence_sent` | number | contacts | current_step | ❌ | |
| `open_count` | number | contacts | open_count | ❌ | |
| `reply_count` | number | contacts | reply_count | ❌ | |
| `lead_category` | string | contacts | - | ❌ | Maps via lead_categories |
| `custom_fields` | object | - | - | ❌ | Not currently used |

---

### 7. Email Accounts
**Endpoint:** `GET /email-accounts` (or via campaign email accounts)

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `id` | number | email_accounts | external_id | ✅ | |
| `from_email` | string | email_accounts | from_email | ✅ | |
| `from_name` | string | email_accounts | from_name | ❌ | |
| `smtp_host` | string | email_accounts | smtp_host | ❌ | |
| `smtp_port` | number | email_accounts | smtp_port | ❌ | |
| `is_smtp_success` | boolean | email_accounts | is_smtp_success | ❌ | |
| `smtp_failure_error` | string | email_accounts | smtp_failure_error | ❌ | |
| `imap_host` | string | email_accounts | imap_host | ❌ | |
| `imap_port` | number | email_accounts | imap_port | ❌ | |
| `is_imap_success` | boolean | email_accounts | is_imap_success | ❌ | |
| `imap_failure_error` | string | email_accounts | imap_failure_error | ❌ | |
| `message_per_day` | number | email_accounts | message_per_day | ❌ | |
| `daily_sent_count` | number | email_accounts | daily_sent_count | ❌ | |
| `warmup_enabled` | boolean | email_accounts | warmup_enabled | ❌ | |
| `warmup_details.status` | string | email_accounts | warmup_status | ❌ | |
| `warmup_details.warmup_reputation` | number | email_accounts | warmup_reputation | ❌ | |
| `warmup_details.total_spam_count` | number | email_accounts | total_spam_count | ❌ | |
| `warmup_details.total_sent_count` | number | email_accounts | warmup_sent_count | ❌ | |
| `custom_tracking_domain` | string | email_accounts | tracking_domain | ❌ | |
| `type` | string | email_accounts | account_type | ❌ | |

---

## Reply.io API Requirements

### Base URLs
```
https://api.reply.io/v1  (legacy)
https://api.reply.io/v3  (current)
```

### Authentication
- Header: `x-api-key: {API_KEY}`

---

### 1. Sequences (Campaigns)
**Endpoint:** `GET /v3/sequences?top=100&skip={offset}`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `id` | number | campaigns | external_id | ✅ | |
| `name` | string | campaigns | name | ✅ | |
| `status` | string | campaigns | status | ✅ | Maps via statusMap |
| `ownerId` | number | campaigns | owner_id | ❌ | |
| `teamId` | number | campaigns | team_id | ❌ | |
| `isArchived` | boolean | campaigns | is_archived | ❌ | |
| `stepsCount` | number | sequences | step_count | ❌ | |

**Status Mapping (Reply.io → Internal):**

| Reply.io Status | Internal Status |
|-----------------|-----------------|
| Active | active |
| Paused | paused |
| Stopped | stopped |
| Draft | draft |
| Archived | archived |
| New | draft |

---

### 2. Sequence Steps (Email Templates)
**Endpoint:** `GET /v3/sequences/{sequence_id}/steps` or `/emails`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `id` | number | campaign_variants | external_id | ✅ | |
| `order` / `number` | number | campaign_variants | step_number | ✅ | |
| `subject` | string | campaign_variants | subject_line | ✅ | |
| `body` / `htmlBody` | string | campaign_variants | body_html | ✅ | |
| `textBody` | string | campaign_variants | body_plain | ❌ | |
| `waitDays` / `delayDays` | number | campaign_variants | delay_days | ❌ | |
| `variant` | string | campaign_variants | variant_label | ❌ | |

---

### 3. Email Accounts
**Endpoint:** `GET /v3/emailAccounts`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `id` / `emailAccountId` | number | email_accounts | external_id | ✅ | |
| `email` / `fromEmail` | string | email_accounts | from_email | ✅ | |
| `name` / `fromName` | string | email_accounts | from_name | ❌ | |
| `smtpHost` | string | email_accounts | smtp_host | ❌ | |
| `smtpPort` | number | email_accounts | smtp_port | ❌ | |
| `isSmtpConnected` | boolean | email_accounts | is_smtp_success | ❌ | |
| `imapHost` | string | email_accounts | imap_host | ❌ | |
| `imapPort` | number | email_accounts | imap_port | ❌ | |
| `isImapConnected` | boolean | email_accounts | is_imap_success | ❌ | |
| `dailyLimit` / `maxEmailsPerDay` | number | email_accounts | message_per_day | ❌ | |
| `sentToday` / `dailySentCount` | number | email_accounts | daily_sent_count | ❌ | |
| `warmupEnabled` | boolean | email_accounts | warmup_enabled | ❌ | |
| `warmupStatus` | string | email_accounts | warmup_status | ❌ | |
| `type` / `provider` | string | email_accounts | account_type | ❌ | |
| `isActive` | boolean | email_accounts | is_active | ❌ | |

---

### 4. Global Statistics
**Endpoint:** `GET /v3/statistics`

| Source Field | Type | Storage | Notes |
|-------------|------|---------|-------|
| `sequencesCount` | number | data_sources.additional_config | Account-wide metric |
| `peopleCount` | number | data_sources.additional_config | |
| `activeSequencesCount` | number | data_sources.additional_config | |
| `activeContactsCount` | number | data_sources.additional_config | |
| `deliveriesCount` / `sentCount` | number | data_sources.additional_config | |
| `opensCount` | number | data_sources.additional_config | De-emphasized |
| `repliesCount` | number | data_sources.additional_config | |
| `bouncesCount` | number | data_sources.additional_config | |
| `interestedCount` | number | data_sources.additional_config | |
| `notInterestedCount` | number | data_sources.additional_config | |
| `optOutsCount` | number | data_sources.additional_config | |

---

### 5. Sequence Statistics
**Endpoint:** `GET /v3/sequences/{sequence_id}/statistics`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `sent` / `delivered` | number | campaigns | total_sent | ✅ | |
| `opened` | number | campaigns | total_opened | ❌ | De-emphasized |
| `replied` | number | campaigns | total_replied | ✅ | **Critical** |
| `bounced` | number | campaigns | total_bounced | ✅ | |
| `interested` | number | campaigns | positive_replies | ✅ | |
| `notInterested` | number | - | - | ❌ | For context |

---

### 6. People (Contacts)
**Endpoint:** `GET /v3/people?sequenceId={id}&top=100&skip={offset}`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `id` | number | contacts | external_lead_id | ✅ | |
| `email` | string | contacts | email | ✅ | |
| `firstName` | string | contacts | first_name | ❌ | |
| `lastName` | string | contacts | last_name | ❌ | |
| `company` | string | companies | name | ❌ | |
| `title` | string | contacts | title | ❌ | |
| `phone` | string | contacts | phone | ❌ | |
| `linkedInUrl` | string | contacts | linkedin_url | ❌ | |
| `status` | string | contacts | sequence_status | ❌ | |
| `isInterested` | boolean | contacts | is_interested | ❌ | |
| `addedAt` | datetime | contacts | enrolled_at | ❌ | |

**Category Mapping (Reply.io → Internal):**

| Reply.io Category | reply_category | sentiment | is_positive |
|-------------------|----------------|-----------|-------------|
| Interested | interested | positive | ✅ |
| Meeting Booked | meeting_request | positive | ✅ |
| MeetingBooked | meeting_request | positive | ✅ |
| Positive | interested | positive | ✅ |
| Not Interested | not_interested | negative | ❌ |
| NotInterested | not_interested | negative | ❌ |
| Out of Office | out_of_office | neutral | ❌ |
| Auto-reply | out_of_office | neutral | ❌ |
| Referral | referral | neutral | ❌ |
| Unsubscribed | unsubscribe | negative | ❌ |
| OptedOut | unsubscribe | negative | ❌ |

---

## PhoneBurner API Requirements

### Base URL
```
https://www.phoneburner.com/rest/1
```

### Authentication
- Header: `Authorization: Bearer {ACCESS_TOKEN}`
- OAuth 2.0 with refresh token support

---

### 1. Team Members
**Endpoint:** `GET /members`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `user_id` / `member_user_id` | number | profiles | external_id | ✅ | |
| `first_name` | string | profiles | first_name | ❌ | |
| `last_name` | string | profiles | last_name | ❌ | |
| `email` | string | profiles | email | ❌ | |

---

### 2. Contacts
**Endpoint:** `GET /contacts?page={n}&page_size=100`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `contact_user_id` / `contact_id` | number | contacts | external_lead_id | ✅ | |
| `first_name` | string | contacts | first_name | ❌ | |
| `last_name` | string | contacts | last_name | ❌ | |
| `company` | string | companies | name | ❌ | |
| `email` | string | contacts | email | ❌ | |
| `phone` | string | contacts | phone | ❌ | |

---

### 3. Dial Sessions
**Endpoint:** `GET /dialsession?page={n}&page_size=50&date_start={YYYY-MM-DD}&date_end={YYYY-MM-DD}`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `dialsession_id` | number | call_sessions | external_id | ✅ | |
| `start_when` | datetime | call_sessions | started_at | ✅ | |
| `end_when` | datetime | call_sessions | ended_at | ❌ | |
| `member_id` | number | call_sessions | caller_user_id | ❌ | |
| `calls` | array | call_activities | (multiple rows) | ❌ | |

---

### 4. Contact Activities
**Endpoint:** `GET /contacts/{contact_id}/activities?page=1&page_size=100&days=180`

| Source Field | Type | DB Table | DB Column | Required | Notes |
|-------------|------|----------|-----------|----------|-------|
| `activity_id` | number | call_activities | external_id | ✅ | |
| `activity` | string | call_activities | disposition | ✅ | Call type |
| `date` | datetime | call_activities | started_at | ✅ | |
| `duration` | number | call_activities | duration_seconds | ❌ | |
| `notes` | string | call_activities | notes | ❌ | |

---

## Webhook Events

### SmartLead Webhooks
**Endpoint:** `POST /functions/v1/smartlead-webhook`

| Event Type | Description | Data Updated |
|------------|-------------|--------------|
| EMAIL_SENT | Email delivered | email_activities, daily_metrics, hourly_metrics |
| OPEN | Email opened | email_activities (de-emphasized) |
| CLICK | Link clicked | email_activities (deprecated) |
| REPLY | Reply received | email_activities, daily_metrics |
| BOUNCE | Email bounced | email_activities, daily_metrics |

### Reply.io Webhooks
**Endpoint:** `POST /functions/v1/replyio-webhook`

| Event Type | Description | Data Updated |
|------------|-------------|--------------|
| email.sent | Email delivered | email_activities, daily_metrics |
| email.opened | Email opened | email_activities (de-emphasized) |
| email.clicked | Link clicked | email_activities (deprecated) |
| email.replied | Reply received | email_activities, daily_metrics |
| email.bounced | Email bounced | email_activities, daily_metrics |
| contact.interested | Marked interested | contacts.is_interested |
| contact.optedOut | Unsubscribed | contacts.is_unsubscribed |

---

## Data Processing Notes

### Rate Limits

| Platform | Rate Limit | Implemented Delay |
|----------|------------|-------------------|
| SmartLead | 10 req / 2 seconds | 350ms between requests |
| Reply.io | 15,000 req / month, 10s between calls | 3000ms (list), 10500ms (stats) |
| PhoneBurner | Not specified | 500ms between requests |

### Sync Strategies

1. **Incremental Sync (Default)**
   - Uses `metrics_hash` to skip unchanged campaigns
   - Format: `{sent}-{opened}-{replied}-{bounced}`
   - Clears hash when data inconsistency detected

2. **Time Budget Management**
   - SmartLead: 120 seconds (2 minutes)
   - Reply.io: 150 seconds (2.5 minutes)
   - PhoneBurner: 50 seconds
   - Auto-continuation via `EdgeRuntime.waitUntil()`

3. **Batch Processing**
   - Database upserts: 50 records per batch
   - Lead pagination: 100 per page (disabled by default)

### Calculated Metrics

All rates stored as decimals (0.0-1.0), NOT percentages:

| Metric | Formula | Denominator |
|--------|---------|-------------|
| Reply Rate | total_replied / delivered | delivered |
| Bounce Rate | total_bounced / total_sent | total_sent |
| Positive Rate | positive_replies / delivered | delivered |

Where `delivered = total_sent - total_bounced`

### Post-Sync Processing

Triggered after sync completion:
1. `backfill-features` - Extract copy features
2. `compute-patterns` - Analyze copy patterns
3. `compute-variant-decay` - Track variant performance over time
4. `classify-replies` - AI classification of reply intent

---

## Appendix: Database Table Reference

### Primary Tables

| Table | Primary Source | Purpose |
|-------|----------------|---------|
| campaigns | SmartLead, Reply.io | Campaign/sequence metadata |
| campaign_variants | SmartLead, Reply.io | Email templates |
| daily_metrics | SmartLead, Reply.io | Daily aggregated metrics |
| hourly_metrics | Webhooks | Hourly time-of-day analysis |
| contacts | SmartLead, Reply.io | Lead/prospect data |
| companies | SmartLead, Reply.io | Company data (extracted from contacts) |
| email_activities | SmartLead, Reply.io | Individual email events |
| email_accounts | SmartLead, Reply.io | Sending infrastructure |
| lead_categories | SmartLead | Reply classification taxonomy |
| enrollment_snapshots | SmartLead | Daily enrollment funnel snapshots |
| call_activities | PhoneBurner | Individual call records |

### Support Tables

| Table | Purpose |
|-------|---------|
| data_sources | API connection configuration |
| sync_progress | Real-time sync status tracking |
| copy_patterns | Aggregated copy performance insights |
| campaign_variant_features | Extracted copy features |
| deliverability_alerts | Automated health alerts |

---

*Document generated for Atlas Reporting System - SourceCo*
