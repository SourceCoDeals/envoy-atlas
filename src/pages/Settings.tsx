import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useWorkspaceSettings } from '@/hooks/useWorkspaceSettings';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InviteTeamMemberDialog } from '@/components/settings/InviteTeamMemberDialog';
import { TeamMembersList } from '@/components/settings/TeamMembersList';
import { TeamMembersSettings } from '@/components/settings/TeamMembersSettings';
import { ConnectionsSection } from '@/components/settings/ConnectionsSection';
import { Loader2, User, Building2, Users, Shield, Plug, Check, UserCircle } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  const initialTab = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [workspaceName, setWorkspaceName] = useState('');
  const [hasNameChanges, setHasNameChanges] = useState(false);

  // Settings page still allows auth check but doesn't force it
  // Some settings may require login to modify

  useEffect(() => {
    if (currentWorkspace) {
      setWorkspaceName(currentWorkspace.name);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    setHasNameChanges(workspaceName !== currentWorkspace?.name);
  }, [workspaceName, currentWorkspace?.name]);

  // Update tab when URL changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['profile', 'workspace', 'team', 'connections', 'security'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

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
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account, workspace, and connections
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="workspace" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Workspace</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Access</span>
            </TabsTrigger>
            <TabsTrigger value="team-members" className="flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
            <TabsTrigger value="connections" className="flex items-center gap-2">
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">Connections</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profile</CardTitle>
                <CardDescription>Your personal account information</CardDescription>
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
          </TabsContent>

          {/* Workspace Tab */}
          <TabsContent value="workspace" className="mt-6">
            {currentWorkspace ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Workspace</CardTitle>
                      <CardDescription>Workspace settings and configuration</CardDescription>
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
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No workspace selected
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Team Access Tab */}
          <TabsContent value="team" className="mt-6">
            {currentWorkspace ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Workspace Access</CardTitle>
                      <CardDescription>
                        {members.length} member{members.length !== 1 ? 's' : ''} with login access
                      </CardDescription>
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
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No workspace selected
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Team Members Tab (for engagement assignments) */}
          <TabsContent value="team-members" className="mt-6">
            {currentWorkspace ? (
              <TeamMembersSettings />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No workspace selected
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Connections Tab */}
          <TabsContent value="connections" className="mt-6">
            {currentWorkspace ? (
              <ConnectionsSection workspaceId={currentWorkspace.id} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No workspace selected
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Security</CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline">Change Password</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
