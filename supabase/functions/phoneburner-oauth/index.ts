import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHONEBURNER_AUTHORIZE_URL = "https://www.phoneburner.com/oauth/authorize";
const PHONEBURNER_TOKEN_URL = "https://www.phoneburner.com/oauth/accesstoken";
const PHONEBURNER_REFRESH_URL = "https://www.phoneburner.com/oauth/refreshtoken";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // PhoneBurner OAuth credentials from environment
    const clientId = Deno.env.get("PHONEBURNER_CLIENT_ID");
    const clientSecret = Deno.env.get("PHONEBURNER_CLIENT_SECRET");
    const redirectUri = Deno.env.get("PHONEBURNER_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      return new Response(
        JSON.stringify({
          error: "PhoneBurner OAuth not configured",
          details: "Missing PHONEBURNER_CLIENT_ID, PHONEBURNER_CLIENT_SECRET, or PHONEBURNER_REDIRECT_URI environment variables",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    // Determine the action: "authorize", "callback", or "refresh"
    const action = body.action || url.searchParams.get("action") || "authorize";

    // ==================== ACTION: AUTHORIZE ====================
    // Generate the OAuth authorization URL for the user to visit
    if (action === "authorize") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing authorization header" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate user
      const authed = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userRes, error: userErr } = await authed.auth.getUser();
      if (userErr || !userRes?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const workspaceId = body.workspace_id;
      if (!workspaceId) {
        return new Response(JSON.stringify({ error: "workspace_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate a state parameter that includes workspace_id and user_id for security
      const stateData = {
        workspace_id: workspaceId,
        user_id: userRes.user.id,
        timestamp: Date.now(),
      };
      const state = btoa(JSON.stringify(stateData));

      // Build the authorization URL
      const authUrl = new URL(PHONEBURNER_AUTHORIZE_URL);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", state);

      return new Response(
        JSON.stringify({
          authorization_url: authUrl.toString(),
          state,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== ACTION: CALLBACK ====================
    // Exchange the authorization code for access and refresh tokens
    if (action === "callback") {
      const code = body.code || url.searchParams.get("code");
      const state = body.state || url.searchParams.get("state");

      if (!code) {
        return new Response(JSON.stringify({ error: "Missing authorization code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!state) {
        return new Response(JSON.stringify({ error: "Missing state parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Decode and validate state
      let stateData: { workspace_id: string; user_id: string; timestamp: number };
      try {
        stateData = JSON.parse(atob(state));
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid state parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check state timestamp (valid for 10 minutes)
      if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
        return new Response(JSON.stringify({ error: "State expired, please try again" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Exchange code for tokens
      const tokenResponse = await fetch(PHONEBURNER_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to exchange authorization code", details: errorText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await tokenResponse.json();
      /*
        Expected response:
        {
          "access_token": "[token]",
          "token_type": "bearer",
          "expires": 1406411164,        // Unix timestamp
          "expires_in": 604800,         // Seconds (7 days)
          "refresh_token": "[refresh_token]"
        }
      */

      if (!tokenData.access_token) {
        return new Response(
          JSON.stringify({ error: "No access token in response", details: tokenData }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Calculate expiration timestamp
      const expiresAt = tokenData.expires
        ? new Date(tokenData.expires * 1000).toISOString()
        : tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Default 7 days

      // Store tokens as JSON in api_key_encrypted field
      const oauthTokens = JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        token_type: tokenData.token_type || "bearer",
        auth_type: "oauth",
      });

      // Upsert the connection
      const { error: upsertError } = await supabaseAdmin.from("api_connections").upsert(
        {
          workspace_id: stateData.workspace_id,
          platform: "phoneburner",
          api_key_encrypted: oauthTokens,
          is_active: true,
          sync_status: "pending",
          created_by: stateData.user_id,
        },
        { onConflict: "workspace_id,platform" }
      );

      if (upsertError) {
        console.error("Failed to store tokens:", upsertError);
        return new Response(
          JSON.stringify({ error: "Failed to store OAuth tokens", details: upsertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "PhoneBurner connected successfully",
          expires_at: expiresAt,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== ACTION: REFRESH ====================
    // Refresh an expired access token using the refresh token
    if (action === "refresh") {
      const workspaceId = body.workspace_id;
      if (!workspaceId) {
        return new Response(JSON.stringify({ error: "workspace_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get current connection
      const { data: connection, error: connErr } = await supabaseAdmin
        .from("api_connections")
        .select("id, api_key_encrypted")
        .eq("workspace_id", workspaceId)
        .eq("platform", "phoneburner")
        .eq("is_active", true)
        .maybeSingle();

      if (connErr || !connection) {
        return new Response(JSON.stringify({ error: "PhoneBurner connection not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Parse stored tokens
      let tokens: {
        access_token: string;
        refresh_token: string;
        expires_at: string;
        auth_type?: string;
      };
      try {
        tokens = JSON.parse(connection.api_key_encrypted);
      } catch (e) {
        // Legacy PAT format - cannot refresh
        return new Response(
          JSON.stringify({ error: "Connection uses Personal Access Token, cannot refresh. Please reconnect with OAuth." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!tokens.refresh_token) {
        return new Response(
          JSON.stringify({ error: "No refresh token available" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Request new tokens
      const refreshResponse = await fetch(PHONEBURNER_REFRESH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokens.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error("Token refresh failed:", errorText);

        // Mark connection as needing re-authorization
        await supabaseAdmin
          .from("api_connections")
          .update({ sync_status: "auth_expired" })
          .eq("id", connection.id);

        return new Response(
          JSON.stringify({ error: "Failed to refresh token, re-authorization required", details: errorText }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newTokenData = await refreshResponse.json();

      // Calculate new expiration
      const newExpiresAt = newTokenData.expires
        ? new Date(newTokenData.expires * 1000).toISOString()
        : newTokenData.expires_in
          ? new Date(Date.now() + newTokenData.expires_in * 1000).toISOString()
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Update stored tokens
      const updatedTokens = JSON.stringify({
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token || tokens.refresh_token, // Keep old if not provided
        expires_at: newExpiresAt,
        token_type: newTokenData.token_type || "bearer",
        auth_type: "oauth",
      });

      await supabaseAdmin
        .from("api_connections")
        .update({ api_key_encrypted: updatedTokens })
        .eq("id", connection.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Token refreshed successfully",
          expires_at: newExpiresAt,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("phoneburner-oauth error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
