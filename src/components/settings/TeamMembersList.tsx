import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2, Crown, UserCircle } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

type AppRole = Database['public']['Enums']['app_role'];

interface WorkspaceMember {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  profile: {
    email: string | null;
    full_name: string | null;
  } | null;
}

interface TeamMembersListProps {
  members: WorkspaceMember[];
  isLoading: boolean;
  onUpdateRole: (memberId: string, newRole: AppRole) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
  isUpdating: boolean;
  isRemoving: boolean;
}

const roleColors: Record<AppRole, string> = {
  admin: 'bg-primary/20 text-primary border-primary/30',
  manager: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  rep: 'bg-green-500/20 text-green-600 border-green-500/30',
  analyst: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
  viewer: 'bg-muted text-muted-foreground border-muted',
};

const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  rep: 'Rep',
  analyst: 'Analyst',
  viewer: 'Viewer',
};

export function TeamMembersList({
  members,
  isLoading,
  onUpdateRole,
  onRemove,
  isUpdating,
  isRemoving,
}: TeamMembersListProps) {
  const { user } = useAuth();
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No team members yet. Invite someone to get started.
      </div>
    );
  }

  const handleRoleChange = async (memberId: string, newRole: AppRole) => {
    setEditingMemberId(memberId);
    try {
      await onUpdateRole(memberId, newRole);
    } finally {
      setEditingMemberId(null);
    }
  };

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const isCurrentUser = member.user_id === user?.id;
        const displayName = member.profile?.full_name || member.profile?.email || 'Unknown User';
        const email = member.profile?.email || '';

        return (
          <div
            key={member.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                {member.role === 'admin' ? (
                  <Crown className="h-5 w-5 text-primary" />
                ) : (
                  <UserCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="font-medium flex items-center gap-2">
                  {displayName}
                  {isCurrentUser && (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{email}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isCurrentUser ? (
                <Badge variant="outline" className={roleColors[member.role]}>
                  {roleLabels[member.role]}
                </Badge>
              ) : (
                <Select
                  value={member.role}
                  onValueChange={(v) => handleRoleChange(member.id, v as AppRole)}
                  disabled={isUpdating && editingMemberId === member.id}
                >
                  <SelectTrigger className="w-32">
                    {isUpdating && editingMemberId === member.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SelectValue />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="rep">Rep</SelectItem>
                    <SelectItem value="analyst">Analyst</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {!isCurrentUser && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove {displayName} from this workspace? 
                        They will lose access to all workspace data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onRemove(member.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isRemoving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
