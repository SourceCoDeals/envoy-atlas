import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTeamMembers, TeamMember, TeamMemberFormData } from '@/hooks/useTeamMembers';
import { Loader2, Plus, Pencil, Trash2, Users } from 'lucide-react';

const TITLE_OPTIONS = [
  'Deal Lead',
  'Associate',
  'VP',
  'Analyst',
  'Research Lead',
  'Research Mid-Level',
  'Other',
];

export function TeamMembersSettings() {
  const {
    teamMembers,
    loading,
    createTeamMember,
    updateTeamMember,
    deleteTeamMember,
    getTeamMemberName,
  } = useTeamMembers();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm: TeamMemberFormData = {
    first_name: '',
    last_name: '',
    email: '',
    title: '',
    is_active: true,
  };

  const [formData, setFormData] = useState<TeamMemberFormData>(emptyForm);

  const openCreate = () => {
    setEditingMember(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({
      first_name: member.first_name,
      last_name: member.last_name || '',
      email: member.email || '',
      title: member.title || '',
      is_active: member.is_active,
    });
    setDialogOpen(true);
  };

  const openDelete = (member: TeamMember) => {
    setDeletingMember(member);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.first_name.trim()) return;

    setSaving(true);
    try {
      if (editingMember) {
        await updateTeamMember(editingMember.id, formData);
      } else {
        await createTeamMember(formData);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMember) return;
    await deleteTeamMember(deletingMember.id);
    setDeleteDialogOpen(false);
    setDeletingMember(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Team Members</CardTitle>
            <CardDescription>
              Manage team members who can be assigned to engagements
            </CardDescription>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No team members yet</p>
            <Button onClick={openCreate} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add First Member
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {getTeamMemberName(member)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.email || '—'}
                  </TableCell>
                  <TableCell>
                    {member.title ? (
                      <Badge variant="outline">{member.title}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.is_active ? 'default' : 'secondary'}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(member)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDelete(member)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMember ? 'Edit Team Member' : 'Add Team Member'}
            </DialogTitle>
            <DialogDescription>
              {editingMember
                ? 'Update team member details'
                : 'Add a new team member who can be assigned to engagements'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name || ''}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title/Role</Label>
              <Select
                value={formData.title || ''}
                onValueChange={(value) => setFormData({ ...formData, title: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a title" />
                </SelectTrigger>
                <SelectContent>
                  {TITLE_OPTIONS.map((title) => (
                    <SelectItem key={title} value={title}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive members won't appear in assignment dropdowns
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.first_name.trim() || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingMember ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deletingMember && getTeamMemberName(deletingMember)}?
              They will be unassigned from any engagements.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
