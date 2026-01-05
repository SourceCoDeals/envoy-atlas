import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Building2, Users, Shield } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { currentWorkspace, userRole } = useWorkspace();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const roleColors = {
    admin: 'bg-primary/20 text-primary',
    analyst: 'bg-info/20 text-info',
    viewer: 'bg-muted text-muted-foreground',
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
                    <CardDescription>{currentWorkspace.name}</CardDescription>
                  </div>
                </div>
                {userRole && (
                  <Badge className={roleColors[userRole]}>
                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {userRole === 'admin' && (
                <>
                  <div className="space-y-2">
                    <Label>Workspace Name</Label>
                    <Input value={currentWorkspace.name} />
                  </div>
                  <Button>Update Workspace</Button>
                </>
              )}
              {userRole !== 'admin' && (
                <p className="text-sm text-muted-foreground">
                  Contact a workspace admin to update workspace settings.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Team Members (Admin only) */}
        {userRole === 'admin' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-lg">Team Members</CardTitle>
                  <CardDescription>Manage who has access to this workspace</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Team management coming soon. You'll be able to invite team members 
                and assign roles (Admin, Analyst, Viewer).
              </p>
              <Button variant="outline" disabled>
                Invite Team Member
              </Button>
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