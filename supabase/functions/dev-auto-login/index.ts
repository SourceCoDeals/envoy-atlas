import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Require a secret token to prevent unauthorized access
    const devSecret = Deno.env.get('DEV_AUTO_LOGIN_SECRET');
    if (!devSecret) {
      console.error('DEV_AUTO_LOGIN_SECRET not configured - function disabled');
      return new Response(
        JSON.stringify({ error: 'Development auto-login is disabled' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, secret } = await req.json();

    // SECURITY: Validate the secret token
    if (!secret || secret !== devSecret) {
      console.warn('Unauthorized dev-auto-login attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Audit log the usage
    console.log(`[AUDIT] dev-auto-login used for email: ${email} at ${new Date().toISOString()}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Generate a magic link for the user
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (error) {
      console.error('Error generating link:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract the token from the link and verify it to create a session
    const token = data.properties?.hashed_token;
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the OTP to get a session
    const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: token,
      type: 'magiclink',
    });

    if (verifyError) {
      console.error('Error verifying token:', verifyError);
      return new Response(
        JSON.stringify({ error: verifyError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ session: sessionData.session }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
