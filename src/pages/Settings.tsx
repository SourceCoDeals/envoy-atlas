import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useWorkspaceSettings } from '@/hooks/useWorkspaceSettings';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { InviteTeamMemberDialog } from '@/components/settings/InviteTeamMemberDialog';
import { TeamMembersList } from '@/components/settings/TeamMembersList';
import { Loader2, User, Building2, Users, Shield, Check } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { currentWorkspace, userRole } = useWorkspace();
  const {
    members,
    loadingMembers,
    updateWorkspaceName,
    inviteTeamMember,
    updateMemberRole,
    removeMember,
  } = useWorkspaceSettings();

  const [workspaceName, setWorkspaceName] = useState('');
  const [hasNameChanges, setHasNameChanges] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (currentWorkspace) {
      setWorkspaceName(currentWorkspace.name);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    setHasNameChanges(workspaceName !== currentWorkspace?.name);
  }, [workspaceName, currentWorkspace?.name]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-primary/20 text-primary',
    manager: 'bg-blue-500/20 text-blue-600',
    rep: 'bg-green-500/20 text-green-600',
    analyst: 'bg-purple-500/20 text-purple-600',
    viewer: 'bg-muted text-muted-foreground',
  };

  const handleUpdateWorkspaceName = async () => {
    if (!workspaceName.trim() || !hasNameChanges) return;
    await updateWorkspaceName.mutateAsync(workspaceName.trim());
  };

  const handleInvite = async (email: string, role: any) => {
    await inviteTeamMember.mutateAsync({ email, role });
  };

  const handleUpdateRole = async (memberId: string, newRole: any) => {
    await updateMemberRole.mutateAsync({ memberId, newRole });
  };

  const handleRemoveMember = async (memberId: string) => {
    await removeMember.mutateAsync(memberId);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and workspace settings
          </p>
        </div>

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg">Profile</CardTitle>
                <CardDescription>Your personal account information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input placeholder="Your name" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Workspace Settings */}
        {currentWorkspace && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">Workspace</CardTitle>
                    <CardDescription>Workspace settings and configuration</CardDescription>
                  </div>
                </div>
                {userRole && (
                  <Badge className={roleColors[userRole] || roleColors.viewer}>
                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {userRole === 'admin' ? (
                <>
                  <div className="space-y-2">
                    <Label>Workspace Name</Label>
                    <Input 
                      value={workspaceName} 
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Enter workspace name"
                    />
                  </div>
                  <Button 
                    onClick={handleUpdateWorkspaceName}
                    disabled={!hasNameChanges || updateWorkspaceName.isPending}
                  >
                    {updateWorkspaceName.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : hasNameChanges ? null : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    {hasNameChanges ? 'Update Workspace' : 'Saved'}
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Workspace Name</Label>
                  <Input value={currentWorkspace.name} disabled />
                  <p className="text-sm text-muted-foreground">
                    Contact a workspace admin to update workspace settings.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Team Members */}
        {currentWorkspace && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">Team Members</CardTitle>
                    <CardDescription>
                      {members.length} member{members.length !== 1 ? 's' : ''} in this workspace
                    </CardDescription>
                  </div>
                </div>
                {userRole === 'admin' && (
                  <InviteTeamMemberDialog 
                    onInvite={handleInvite}
                    isLoading={inviteTeamMember.isPending}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <TeamMembersList
                members={members}
                isLoading={loadingMembers}
                onUpdateRole={handleUpdateRole}
                onRemove={handleRemoveMember}
                isUpdating={updateMemberRole.isPending}
                isRemoving={removeMember.isPending}
              />
            </CardContent>
          </Card>
        )}

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg">Security</CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline">Change Password</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
