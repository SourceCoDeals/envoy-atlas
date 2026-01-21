/**
 * Role-Based Access Control (RBAC) Hook
 * 
 * Provides permission checks based on user roles and workspace membership.
 * Roles: admin, manager, rep, analyst, viewer
 */

import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { ReactNode } from 'react';

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY: Record<string, number> = {
  admin: 100,
  manager: 80,
  analyst: 60,
  rep: 40,
  viewer: 20,
};

// Permission definitions
export type Permission = 
  | 'manage_workspace'       // Rename workspace, delete, etc.
  | 'manage_team'            // Invite/remove members, change roles
  | 'manage_connections'     // Add/remove data sources
  | 'trigger_sync'           // Manually trigger syncs
  | 'reset_sync'             // Reset stuck syncs
  | 'view_analytics'         // View dashboards and reports
  | 'edit_campaigns'         // Create/edit campaigns
  | 'view_campaigns'         // View campaign data
  | 'edit_contacts'          // Create/edit contacts
  | 'view_contacts'          // View contact data
  | 'edit_calls'             // Add/edit call records
  | 'view_calls'             // View call data
  | 'export_data'            // Export to CSV/Excel
  | 'manage_thresholds'      // Configure metric thresholds
  | 'view_audit_log';        // View admin action history

// Role to permission mapping
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'manage_workspace', 'manage_team', 'manage_connections', 'trigger_sync', 
    'reset_sync', 'view_analytics', 'edit_campaigns', 'view_campaigns',
    'edit_contacts', 'view_contacts', 'edit_calls', 'view_calls',
    'export_data', 'manage_thresholds', 'view_audit_log'
  ],
  manager: [
    'manage_connections', 'trigger_sync', 'view_analytics', 
    'edit_campaigns', 'view_campaigns', 'edit_contacts', 'view_contacts',
    'edit_calls', 'view_calls', 'export_data'
  ],
  analyst: [
    'view_analytics', 'view_campaigns', 'view_contacts', 'view_calls', 'export_data'
  ],
  rep: [
    'view_analytics', 'view_campaigns', 'view_contacts', 'edit_calls', 'view_calls'
  ],
  viewer: [
    'view_analytics', 'view_campaigns', 'view_contacts', 'view_calls'
  ],
};

export interface RBACContext {
  role: string | null;
  isAdmin: boolean;
  isManager: boolean;
  isAnalyst: boolean;
  isRep: boolean;
  isViewer: boolean;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  roleLevel: number;
  canAccessAdminFeatures: boolean;
  canModifyData: boolean;
  canExport: boolean;
}

/**
 * Hook for checking user permissions
 */
export function useRBAC(): RBACContext {
  const { userRole } = useWorkspace();
  const { user } = useAuth();

  const role = userRole || 'viewer';
  const roleLevel = ROLE_HIERARCHY[role] || 0;

  const hasPermission = (permission: Permission): boolean => {
    if (!role) return false;
    return ROLE_PERMISSIONS[role]?.includes(permission) || false;
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some(p => hasPermission(p));
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every(p => hasPermission(p));
  };

  return {
    role,
    isAdmin: role === 'admin',
    isManager: role === 'manager' || role === 'admin',
    isAnalyst: role === 'analyst',
    isRep: role === 'rep',
    isViewer: role === 'viewer',
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    roleLevel,
    canAccessAdminFeatures: hasAnyPermission(['manage_workspace', 'manage_team', 'reset_sync']),
    canModifyData: hasAnyPermission(['edit_campaigns', 'edit_contacts', 'edit_calls']),
    canExport: hasPermission('export_data'),
  };
}

/**
 * Component wrapper that only renders children if user has required permission
 */
export function RequirePermission({ 
  permission, 
  children, 
  fallback = null 
}: { 
  permission: Permission; 
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasPermission } = useRBAC();
  
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Component wrapper that only renders for specific roles
 */
export function RequireRole({ 
  roles, 
  children, 
  fallback = null 
}: { 
  roles: string[]; 
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { role } = useRBAC();
  
  if (!role || !roles.includes(role)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Component wrapper for admin-only content
 */
export function AdminOnly({ 
  children, 
  fallback = null 
}: { 
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isAdmin } = useRBAC();
  
  if (!isAdmin) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Hook for checking minimum role level
 */
export function useMinRole(minRole: string): boolean {
  const { roleLevel } = useRBAC();
  const minLevel = ROLE_HIERARCHY[minRole] || 0;
  return roleLevel >= minLevel;
}

export default useRBAC;
