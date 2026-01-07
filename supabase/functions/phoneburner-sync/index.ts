import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHONEBURNER_BASE_URL = "https://www.phoneburner.com/rest/1";
const RATE_LIMIT_DELAY_MS = 500;
const TIME_BUDGET_MS = 50_000;
const SYNC_LOCK_TIMEOUT_MS = 30_000;
const DAYS_TO_SYNC = 180;

const DIALSESSION_PAGE_SIZE = 50;
const CONTACT_PAGE_SIZE = 100;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDateYMD(date: Date): string {
  return date.toISOString().split("T")[0];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function phoneburnerRequest(endpoint: string, apiKey: string, retries = 3): Promise<any> {
  const url = `${PHONEBURNER_BASE_URL}${endpoint}`;

  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (res.status === 429) {
      await delay(1000 * (i + 1));
      continue;
    }

    if (res.status === 401) {
      const text = await res.text();
      throw new Error(`PhoneBurner authentication failed: ${text}`);
    }

    if (!res.ok) {
      const text = await res.text();
      if (i === retries - 1) throw new Error(`PhoneBurner API error (${res.status}): ${text}`);
      await delay(1000 * (i + 1));
      continue;
    }

    await delay(RATE_LIMIT_DELAY_MS);
    return await res.json();
  }

  throw new Error("PhoneBurner request failed after retries");
}

type SyncProgress = {
  heartbeat?: string;
  phase?: "dialsessions" | "contacts" | "metrics" | "linking" | "complete";
  session_page?: number;
  contacts_page?: number;
  contact_offset?: number;
  sessions_synced?: number;
  contacts_synced?: number;
  calls_synced?: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Validate the JWT and get the user
    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: userErr } = await authed.auth.getUser();
    if (userErr || !userRes?.user) throw new Error("Unauthorized");
    const user = userRes.user;

    const body = await req.json().catch(() => ({}));
    const workspaceId: string | undefined = body.workspace_id ?? body.workspaceId;
    const reset: boolean = !!body.reset;
    const diagnostic: boolean = !!body.diagnostic;

    if (!workspaceId) throw new Error("workspace_id is required");

    // Verify workspace membership
    const { data: membership, error: memberErr } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !membership) throw new Error("Access denied to workspace");

    // Get connection
    const { data: connection, error: connErr } = await supabaseAdmin
      .from("api_connections")
      .select("id, api_key_encrypted, sync_status, sync_progress, last_sync_at")
      .eq("workspace_id", workspaceId)
      .eq("platform", "phoneburner")
      .eq("is_active", true)
      .maybeSingle();

    if (connErr) throw connErr;
    if (!connection) throw new Error("PhoneBurner is not connected");

    const apiKey: string = connection.api_key_encrypted;

    if (diagnostic) {
      const end = formatDateYMD(new Date());
      const start = formatDateYMD(daysAgo(DAYS_TO_SYNC));

      let sessionsFound = 0;
      try {
        const list = await phoneburnerRequest(
          `/dialsession?page=1&page_size=5&date_start=${start}&date_end=${end}`,
          apiKey
        );
        const arr = list?.dialsessions?.dialsessions ?? list?.dialsessions ?? list?.dial_sessions ?? [];
        sessionsFound = Array.isArray(arr) ? arr.length : 0;
      } catch (_e) {
        sessionsFound = 0;
      }

      return new Response(
        JSON.stringify({
          ok: true,
          auth: "ok",
          scope_days: DAYS_TO_SYNC,
          dialsession_list_sample_count: sessionsFound,
          note:
            sessionsFound === 0
              ? "No dial sessions returned for this token in the date range. If you expect team-wide sessions, a PAT may not have access."
              : "Dial sessions endpoint returned data for this token.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Locking: if another run is active and fresh heartbeat, bail
    const now = Date.now();
    const prevProgress = (connection.sync_progress ?? {}) as SyncProgress;
    const heartbeatMs = prevProgress.heartbeat ? Date.parse(prevProgress.heartbeat) : 0;
    const heartbeatFresh = heartbeatMs && now - heartbeatMs < SYNC_LOCK_TIMEOUT_MS;

    if (!reset && connection.sync_status === "syncing" && heartbeatFresh) {
      return new Response(JSON.stringify({ status: "already_syncing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reset progress if requested
    if (reset) {
      await supabaseAdmin
        .from("api_connections")
        .update({ sync_status: "pending", sync_progress: null })
        .eq("id", connection.id);
    }

    // Initialize / resume
    let phase: SyncProgress["phase"] = (prevProgress.phase as any) || "dialsessions";
    let sessionPage = prevProgress.session_page || 1;
    let contactsPage = prevProgress.contacts_page || 1;
    let contactOffset = prevProgress.contact_offset || 0;

    let sessionsSynced = prevProgress.sessions_synced || 0;
    let contactsSynced = prevProgress.contacts_synced || 0;
    let callsSynced = prevProgress.calls_synced || 0;

    const startedAt = Date.now();

    const persistProgress = async (p: Partial<SyncProgress>) => {
      await supabaseAdmin
        .from("api_connections")
        .update({
          sync_status: "syncing",
          sync_progress: {
            heartbeat: new Date().toISOString(),
            phase,
            session_page: sessionPage,
            contacts_page: contactsPage,
            contact_offset: contactOffset,
            sessions_synced: sessionsSynced,
            contacts_synced: contactsSynced,
            calls_synced: callsSynced,
            ...p,
          },
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", connection.id);
    };

    await persistProgress({});

    const endYmd = formatDateYMD(new Date());
    const startYmd = formatDateYMD(daysAgo(DAYS_TO_SYNC));

    // ================== PHASE 1: DIAL SESSIONS ==================
    while (phase === "dialsessions" && Date.now() - startedAt < TIME_BUDGET_MS) {
      const list = await phoneburnerRequest(
        `/dialsession?page=${sessionPage}&page_size=${DIALSESSION_PAGE_SIZE}&date_start=${startYmd}&date_end=${endYmd}`,
        apiKey
      );

      const sessions = list?.dialsessions?.dialsessions ?? list?.dialsessions ?? list?.dial_sessions ?? [];
      const sessionArr: any[] = Array.isArray(sessions) ? sessions : [];

      if (sessionArr.length === 0) {
        phase = "contacts";
        await persistProgress({ phase });
        break;
      }

      for (const s of sessionArr) {
        if (Date.now() - startedAt >= TIME_BUDGET_MS) break;

        const externalSessionId = String(s?.id ?? s?.dial_session_id ?? s?.dialsession_id ?? "");
        if (!externalSessionId) continue;

        const { data: sessionRow, error: sessionUpsertErr } = await supabaseAdmin
          .from("phoneburner_dial_sessions")
          .upsert(
            {
              workspace_id: workspaceId,
              external_session_id: externalSessionId,
              member_id: s?.member_id ? String(s.member_id) : null,
              member_name: s?.member_name ?? null,
              start_at: s?.start_when ?? s?.start_at ?? null,
              end_at: s?.end_when ?? s?.end_at ?? null,
              call_count: s?.call_count ?? s?.calls_count ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "workspace_id,external_session_id" }
          )
          .select("id")
          .single();

        if (sessionUpsertErr) {
          console.error("Dial session upsert error", sessionUpsertErr);
          continue;
        }

        sessionsSynced += 1;

        // Fetch detail to get calls array
        let detail: any = null;
        try {
          detail = await phoneburnerRequest(`/dialsession/${externalSessionId}`, apiKey);
        } catch (e) {
          console.error("Dial session detail fetch error", e);
          continue;
        }

        const calls = detail?.calls ?? detail?.dial_session?.calls ?? detail?.dialsession?.calls ?? [];
        const callArr: any[] = Array.isArray(calls) ? calls : [];

        for (const c of callArr) {
          const externalCallId = String(c?.id ?? c?.call_id ?? c?.callId ?? "");
          if (!externalCallId) continue;

          const { error: callErr } = await supabaseAdmin.from("phoneburner_calls").upsert(
            {
              workspace_id: workspaceId,
              dial_session_id: sessionRow.id,
              external_call_id: externalCallId,
              external_contact_id: c?.contact_id ? String(c.contact_id) : null,
              phone_number: c?.phone ?? c?.phone_number ?? null,
              start_at: c?.start_when ?? c?.start_at ?? null,
              end_at: c?.end_when ?? c?.end_at ?? null,
              duration_seconds: c?.duration_seconds ?? c?.duration ?? null,
              disposition: c?.disposition ?? null,
              disposition_id: c?.disposition_id ? String(c.disposition_id) : null,
              is_connected: typeof c?.connected === "boolean" ? c.connected : null,
              is_voicemail: typeof c?.voicemail === "boolean" ? c.voicemail : null,
              notes: c?.notes ?? null,
              recording_url: c?.recording_url ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "workspace_id,external_call_id" }
          );

          if (!callErr) callsSynced += 1;
        }

        await persistProgress({});
      }

      sessionPage += 1;
      await persistProgress({});

      // Conservative exit: page forward until time budget, continuation will resume
      if (Date.now() - startedAt >= TIME_BUDGET_MS) break;
    }

    // ================== PHASE 2: CONTACTS (light) ==================
    while (phase === "contacts" && Date.now() - startedAt < TIME_BUDGET_MS) {
      const list = await phoneburnerRequest(
        `/contacts?page=${contactsPage}&page_size=${CONTACT_PAGE_SIZE}`,
        apiKey
      );

      const contacts = list?.contacts ?? list?.contacts?.contacts ?? [];
      const contactArr: any[] = Array.isArray(contacts) ? contacts : [];

      if (contactArr.length === 0) {
        phase = "metrics";
        await persistProgress({ phase });
        break;
      }

      for (let i = contactOffset; i < contactArr.length; i++) {
        if (Date.now() - startedAt >= TIME_BUDGET_MS) {
          contactOffset = i;
          await persistProgress({});
          break;
        }

        const c = contactArr[i];
        const externalContactId = String(c?.contact_user_id ?? c?.contact_id ?? c?.id ?? "");
        if (!externalContactId) continue;

        const email = c?.primary_email?.email_address ?? c?.email ?? null;
        const phone = c?.primary_phone?.raw_phone ?? c?.primary_phone?.phone ?? c?.primary_phone ?? null;

        const { error: upsertErr } = await supabaseAdmin.from("phoneburner_contacts").upsert(
          {
            workspace_id: workspaceId,
            external_contact_id: externalContactId,
            first_name: c?.first_name ?? null,
            last_name: c?.last_name ?? null,
            email,
            phone,
            company: c?.company ?? null,
            category_id: c?.category_id ? String(c.category_id) : null,
            date_added: c?.date_added ?? null,
            tags: c?.tags ?? null,
          },
          { onConflict: "workspace_id,external_contact_id" }
        );

        if (!upsertErr) contactsSynced += 1;
      }

      if (Date.now() - startedAt >= TIME_BUDGET_MS) break;

      // next page
      contactsPage += 1;
      contactOffset = 0;
      await persistProgress({});
    }

    // ================== PHASE 3: METRICS (team aggregate) ==================
    if (phase === "metrics" && Date.now() - startedAt < TIME_BUDGET_MS) {
      try {
        const usageEnd = formatDateYMD(new Date());
        const usageStart = formatDateYMD(daysAgo(Math.min(DAYS_TO_SYNC, 90)));

        const usageRes = await phoneburnerRequest(
          `/dialsession/usage?date_start=${usageStart}&date_end=${usageEnd}`,
          apiKey
        );

        const usage = usageRes?.usage ?? {};
        const memberIds = Object.keys(usage);

        for (const memberId of memberIds) {
          const stats = usage[memberId];
          await supabaseAdmin.from("phoneburner_daily_metrics").upsert(
            {
              workspace_id: workspaceId,
              date: usageEnd,
              member_id: memberId,
              total_sessions: stats?.sessions ?? 0,
              total_calls: stats?.calls ?? 0,
              calls_connected: stats?.connected ?? 0,
              voicemails_left: stats?.voicemail ?? 0,
              emails_sent: stats?.emails ?? 0,
              total_talk_time_seconds: (stats?.talktime ?? 0) * 60,
            },
            { onConflict: "workspace_id,date,member_id" }
          );
        }
      } catch (e) {
        console.error("Usage metrics fetch failed", e);
      }

      phase = "linking";
      await persistProgress({ phase });
    }

    // ================== PHASE 4: LINKING ==================
    if (phase === "linking" && Date.now() - startedAt < TIME_BUDGET_MS) {
      try {
        const { data: pbContacts } = await supabaseAdmin
          .from("phoneburner_contacts")
          .select("external_contact_id, email")
          .eq("workspace_id", workspaceId)
          .not("email", "is", null);

        if (pbContacts?.length) {
          for (const pb of pbContacts) {
            if (!pb.email) continue;
            await supabaseAdmin
              .from("leads")
              .update({ phoneburner_contact_id: pb.external_contact_id })
              .eq("workspace_id", workspaceId)
              .eq("email", pb.email);
          }
        }
      } catch (e) {
        console.error("Linking failed", e);
      }

      phase = "complete";
      await persistProgress({ phase });
    }

    const isComplete = phase === "complete";

    await supabaseAdmin
      .from("api_connections")
      .update({
        sync_status: isComplete ? "complete" : "syncing",
        last_sync_at: new Date().toISOString(),
        last_full_sync_at: isComplete ? new Date().toISOString() : undefined,
        sync_progress: isComplete
          ? {
              sessions_synced: sessionsSynced,
              contacts_synced: contactsSynced,
              calls_synced: callsSynced,
              completed_at: new Date().toISOString(),
            }
          : {
              heartbeat: new Date().toISOString(),
              phase,
              session_page: sessionPage,
              contacts_page: contactsPage,
              contact_offset: contactOffset,
              sessions_synced: sessionsSynced,
              contacts_synced: contactsSynced,
              calls_synced: callsSynced,
            },
      })
      .eq("id", connection.id);

    return new Response(
      JSON.stringify({
        status: isComplete ? "complete" : "in_progress",
        phase,
        sessions_synced: sessionsSynced,
        contacts_synced: contactsSynced,
        calls_synced: callsSynced,
        needsContinuation: !isComplete,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("phoneburner-sync error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
