/**
 * Authorization Helpers for Edge Functions
 * 
 * Provides authentication and authorization checks for admin endpoints.
 * Based on RBAC system with roles: admin, analyst, viewer
 */
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AuthContext {
  userId: string;
  email: string | null;
  role: string | null;
  workspaceId?: string;
}

export interface AuthError {
  error: string;
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_TOKEN';
  status: number;
}

/**
 * Extract and validate JWT from Authorization header
 */
export async function requireAuth(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<AuthContext | AuthError> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return {
      error: 'Missing authorization header',
      code: 'UNAUTHORIZED',
      status: 401,
    };
  }

  // Handle service role calls (internal continuations)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (authHeader === `Bearer ${serviceRoleKey}`) {
    // Service role has full access, return a special context
    return {
      userId: 'service_role',
      email: 'system@internal',
      role: 'admin',
    };
  }

  // Create a client with the user's token
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: error?.message || 'Invalid or expired token',
      code: 'INVALID_TOKEN',
      status: 401,
    };
  }

  // Get user's global role
  const serviceClient = createClient(supabaseUrl, serviceRoleKey!);
  const { data: roleData } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email || null,
    role: roleData?.role || 'viewer',
  };
}

/**
 * Verify that user has access to a specific workspace
 */
export async function verifyWorkspaceAccess(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string
): Promise<{ hasAccess: boolean; role: string | null; error?: string }> {
  // Service role has full access
  if (userId === 'service_role') {
    return { hasAccess: true, role: 'admin' };
  }

  const { data: membership, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { hasAccess: false, role: null, error: error.message };
  }

  if (!membership) {
    // Try client_members (legacy/alternate workspace structure)
    const { data: clientMembership } = await supabase
      .from('client_members')
      .select('role')
      .eq('client_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!clientMembership) {
      return { hasAccess: false, role: null };
    }
    return { hasAccess: true, role: clientMembership.role };
  }

  return { hasAccess: true, role: membership.role };
}

/**
 * Verify user owns or has access to a specific engagement
 */
export async function verifyEngagementAccess(
  supabase: SupabaseClient,
  userId: string,
  engagementId: string
): Promise<{ hasAccess: boolean; workspaceId: string | null; role: string | null }> {
  // Service role has full access
  if (userId === 'service_role') {
    const { data: engagement } = await supabase
      .from('engagements')
      .select('client_id')
      .eq('id', engagementId)
      .maybeSingle();
    return { hasAccess: true, workspaceId: engagement?.client_id || null, role: 'admin' };
  }

  // Get the engagement's workspace
  const { data: engagement, error } = await supabase
    .from('engagements')
    .select('client_id')
    .eq('id', engagementId)
    .maybeSingle();

  if (error || !engagement) {
    return { hasAccess: false, workspaceId: null, role: null };
  }

  // Check workspace access
  const result = await verifyWorkspaceAccess(supabase, userId, engagement.client_id);
  return {
    hasAccess: result.hasAccess,
    workspaceId: engagement.client_id,
    role: result.role,
  };
}

/**
 * Check if user is workspace admin
 */
export async function isWorkspaceAdmin(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string
): Promise<boolean> {
  if (userId === 'service_role') return true;

  const result = await verifyWorkspaceAccess(supabase, userId, workspaceId);
  return result.hasAccess && result.role === 'admin';
}

/**
 * Require admin role for an endpoint
 */
export async function requireAdmin(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string
): Promise<AuthError | null> {
  const isAdmin = await isWorkspaceAdmin(supabase, userId, workspaceId);
  
  if (!isAdmin) {
    return {
      error: 'Admin access required for this operation',
      code: 'FORBIDDEN',
      status: 403,
    };
  }

  return null;
}

/**
 * Helper to check if result is an error
 */
export function isAuthError(result: AuthContext | AuthError): result is AuthError {
  return 'code' in result && 'status' in result;
}

/**
 * Create error response for auth failures
 */
export function createAuthErrorResponse(error: AuthError, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: error.error, code: error.code }),
    { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
