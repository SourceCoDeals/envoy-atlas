# Migration Guide: Lovable Cloud to Personal Supabase

This guide walks you through migrating the Envoy Atlas project from Lovable Cloud to your personal Supabase project.

## Prerequisites

1. **Supabase Account**: Create one at [supabase.com](https://supabase.com)
2. **Supabase CLI**: Install via `npm install -g supabase`
3. **Node.js**: Version 18+ recommended

---

## Phase 1: Create Your Personal Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Choose your organization
4. Set a project name (e.g., `envoy-atlas`)
5. Generate a secure database password (save it!)
6. Select your region (US East or EU West recommended)
7. Wait for the project to initialize (~2 minutes)

### Save Your Credentials

Once created, go to **Settings > API** and note:

| Credential | Where to Find |
|------------|---------------|
| **Project URL** | Settings > API > Project URL |
| **Anon Key** | Settings > API > `anon` `public` key |
| **Service Role Key** | Settings > API > `service_role` key |
| **Project ID** | The alphanumeric string in your URL |

---

## Phase 2: Run Schema Migrations

### Option A: Via Supabase CLI (Recommended)

```bash
# 1. Login to Supabase
supabase login

# 2. Link to your new project
supabase link --project-ref YOUR_PROJECT_ID

# 3. Push all migrations
supabase db push
```

This will apply all 127 migration files from `supabase/migrations/` to your new project.

### Option B: Manual SQL Editor

1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Run each migration file in order (by timestamp)
4. Alternatively, use the consolidated `full-schema-export.sql` if generated

---

## Phase 3: Export Data from Lovable Cloud

Use the `export-table-data` edge function to download data.

### List All Tables with Row Counts

```bash
curl "https://qaedjtdwishtcrfjhmvu.supabase.co/functions/v1/export-table-data?action=list"
```

### Export a Single Table

```bash
# Export first 1000 rows
curl "https://qaedjtdwishtcrfjhmvu.supabase.co/functions/v1/export-table-data?table=cold_calls&limit=1000&offset=0" > cold_calls_0.json

# Export next 1000 rows
curl "https://qaedjtdwishtcrfjhmvu.supabase.co/functions/v1/export-table-data?table=cold_calls&limit=1000&offset=1000" > cold_calls_1.json
```

### Export All Tables Script

```bash
#!/bin/bash
BASE_URL="https://qaedjtdwishtcrfjhmvu.supabase.co/functions/v1/export-table-data"

# Get list of tables
tables=$(curl -s "$BASE_URL?action=list" | jq -r '.tables | to_entries[] | select(.value > 0) | .key')

for table in $tables; do
  echo "Exporting $table..."
  offset=0
  page=0
  
  while true; do
    response=$(curl -s "$BASE_URL?table=$table&limit=1000&offset=$offset")
    hasMore=$(echo $response | jq -r '.pagination.hasMore')
    
    echo $response | jq '.data' > "${table}_${page}.json"
    
    if [ "$hasMore" != "true" ]; then
      break
    fi
    
    offset=$((offset + 1000))
    page=$((page + 1))
  done
done
```

---

## Phase 4: Import Data to New Supabase

### Using SQL Editor

For each exported JSON file:

```sql
-- Example: Import contacts
INSERT INTO contacts 
SELECT * FROM json_populate_recordset(null::contacts, 
  '[YOUR JSON DATA HERE]'::json
);
```

### Using Supabase CLI

```bash
# Import using psql
psql $DATABASE_URL -c "\copy cold_calls FROM 'cold_calls.csv' CSV HEADER"
```

### Using Node.js Script

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'YOUR_NEW_PROJECT_URL',
  'YOUR_SERVICE_ROLE_KEY'
);

async function importTable(tableName, jsonFile) {
  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  
  // Insert in batches of 100
  for (let i = 0; i < data.length; i += 100) {
    const batch = data.slice(i, i + 100);
    const { error } = await supabase.from(tableName).upsert(batch);
    if (error) console.error(`Error importing ${tableName}:`, error);
  }
  
  console.log(`Imported ${data.length} rows to ${tableName}`);
}

// Run imports
importTable('cold_calls', './cold_calls_0.json');
```

---

## Phase 5: Configure Secrets

In your new Supabase dashboard, go to **Settings > Edge Functions** and add these secrets:

| Secret Name | Purpose |
|-------------|---------|
| `LOVABLE_API_KEY` | AI gateway access |
| `OPENROUTER_API_KEY` | AI model routing |
| `NOCODB_API_TOKEN` | NocoDB integration |
| `PHONEBURNER_API_KEY` | PhoneBurner API |
| `PHONEBURNER_CLIENT_ID` | PhoneBurner OAuth |
| `PHONEBURNER_CLIENT_SECRET` | PhoneBurner OAuth |
| `PHONEBURNER_REDIRECT_URI` | PhoneBurner callback (update to new URL!) |
| `DEV_AUTO_LOGIN_SECRET` | Dev authentication |
| `FIRECRAWL_API_KEY` | Web scraping |

---

## Phase 6: Deploy Edge Functions

All 47 edge functions are in `supabase/functions/`.

```bash
# Deploy all functions at once
supabase functions deploy --all

# Or deploy individually
supabase functions deploy smartlead-sync
supabase functions deploy cold-calls-sync
# etc.
```

### Functions List

- `auto-link-campaigns`
- `auto-pair-engagements`
- `backfill-daily-metrics`
- `backfill-enrollment`
- `backfill-features`
- `calls-sync`
- `check-alerts`
- `check-domain-auth`
- `classify-replies`
- `cold-calls-sync`
- `compute-patterns`
- `compute-variant-decay`
- `contact-search`
- `copy-insights-chat`
- `dev-auto-login`
- `email-sync`
- `enrich-leads`
- `export-table-data`
- `fetch-transcripts`
- `generate-copy`
- `generate-copy-recommendations`
- `generate-copy-tags`
- `import-fireflies-calls`
- `link-data-entities`
- `nightly-reconciliation`
- `nocodb-discover`
- `nocodb-sync`
- `phoneburner-oauth`
- `phoneburner-sync`
- `process-calls-batch`
- `process-industry-documents`
- `process-retry-queue`
- `recalculate-health-scores`
- `recalculate-metrics`
- `reclassify-inbox`
- `redistribute-contacts`
- `replyio-sync`
- `replyio-webhook`
- `score-call`
- `score-external-calls`
- `smartlead-inbox-webhook`
- `smartlead-sync`
- `smartlead-webhook`
- `sync-nocodb-campaigns`
- `sync-recovery`
- `sync-reset`
- `transcribe-call`

---

## Phase 7: Update Application Configuration

### Update `.env` File

Create a `.env.local` file (or update `.env`):

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### Update Edge Function URLs

If any external services call your edge functions (webhooks, etc.), update them:

**Old URL:**
```
https://qaedjtdwishtcrfjhmvu.supabase.co/functions/v1/smartlead-webhook
```

**New URL:**
```
https://YOUR-PROJECT-ID.supabase.co/functions/v1/smartlead-webhook
```

### Services to Update

- SmartLead webhook URL
- Reply.io webhook URL  
- PhoneBurner OAuth redirect URI

---

## Phase 8: Create Storage Bucket

```sql
-- In SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('industry-documents', 'industry-documents', false);

-- Add policies as needed
CREATE POLICY "Authenticated users can read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'industry-documents');
```

---

## Phase 9: Verify Migration

### Test Authentication

1. Open your app with new Supabase credentials
2. Try to sign up / log in
3. Verify user appears in `auth.users`

### Test Data Access

1. Navigate to dashboards
2. Verify data loads correctly
3. Check for any RLS policy errors in console

### Test Edge Functions

```bash
# Test cold-calls-sync
curl -X POST "https://YOUR-PROJECT-ID.supabase.co/functions/v1/cold-calls-sync" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

---

## Troubleshooting

### Common Issues

**"Permission denied" errors**
- Check RLS policies are properly migrated
- Verify user is in `workspace_members` table

**Edge function deployment fails**
- Ensure Supabase CLI is logged in
- Check function has valid `index.ts`
- Review logs: `supabase functions logs FUNCTION_NAME`

**Data import fails**
- Check for foreign key constraints
- Import tables in correct order (parents before children)
- Disable triggers temporarily if needed

### Import Order for Foreign Keys

```
1. clients
2. profiles
3. workspaces
4. workspace_members
5. client_members
6. engagements
7. data_sources
8. campaigns
9. contacts
10. companies
11. (all other tables)
```

---

## Rollback Plan

If migration fails, Lovable Cloud remains operational. Simply revert your `.env` to the original credentials:

```env
VITE_SUPABASE_URL=https://qaedjtdwishtcrfjhmvu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=qaedjtdwishtcrfjhmvu
```

---

## Post-Migration Checklist

- [ ] All tables created with correct schema
- [ ] All data imported successfully
- [ ] All 47 edge functions deployed
- [ ] All 9 secrets configured
- [ ] Storage bucket created
- [ ] Authentication working
- [ ] RLS policies active
- [ ] External webhooks updated
- [ ] OAuth redirect URIs updated
- [ ] Application tested end-to-end

---

## Support

If you encounter issues:

1. Check Supabase logs: **Logs > Edge Functions**
2. Check database logs: **Logs > Postgres**
3. Verify RLS policies in **Authentication > Policies**
4. Test queries in **SQL Editor**
