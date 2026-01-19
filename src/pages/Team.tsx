import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTeam, RepProfile } from "@/hooks/useTeam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  Briefcase,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "rep", label: "Rep" },
  { value: "analyst", label: "Analyst" },
  { value: "viewer", label: "Viewer" },
];

export default function Team() {
  const {
    repProfiles,
    isLoadingReps,
    engagements,
    createRep,
    updateRep,
    deleteRep,
    assignToEngagement,
    removeAssignment,
    getRepAssignments,
  } = useTeam();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<RepProfile | null>(null);
  const [assigningRep, setAssigningRep] = useState<RepProfile | null>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "rep",
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      role: "rep",
      is_active: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRep) {
      updateRep.mutate();
      setEditingRep(null);
    } else {
      createRep.mutate();
    }
    resetForm();
    setIsAddOpen(false);
  };

  const handleEdit = (rep: RepProfile) => {
    setEditingRep(rep);
    setFormData({
      first_name: rep.first_name || "",
      last_name: rep.last_name || "",
      email: rep.email || "",
      role: rep.role || "rep",
      is_active: rep.is_active,
    });
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Remove this team member?")) {
      deleteRep.mutate();
    }
  };

  const handleAssign = async (engagementId: string) => {
    if (!assigningRep) return;
    assignToEngagement.mutate();
    setAssigningRep(null);
  };

  const activeReps = repProfiles.filter((r) => r.is_active);
  const inactiveReps = repProfiles.filter((r) => !r.is_active);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team</h1>
            <p className="text-muted-foreground">
              Manage team members and client assignments
            </p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setEditingRep(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Team Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingRep ? "Edit Team Member" : "Add Team Member"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) =>
                        setFormData({ ...formData, first_name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) =>
                        setFormData({ ...formData, last_name: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(v) => setFormData({ ...formData, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) =>
                      setFormData({ ...formData, is_active: v })
                    }
                  />
                  <Label>Active</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddOpen(false);
                      setEditingRep(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingRep ? "Save" : "Add"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{activeReps.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inactive
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{inactiveReps.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Client Engagements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{engagements.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Table */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingReps ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : repProfiles.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No team members yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsAddOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add First Member
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Clients</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repProfiles.map((rep) => {
                    const assignments = getRepAssignments(rep.id);
                    return (
                      <TableRow key={rep.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {(rep.first_name?.[0] || "") +
                                  (rep.last_name?.[0] || "")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {rep.first_name} {rep.last_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {rep.email || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {rep.role || "rep"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {assignments.length === 0 ? (
                              <span className="text-muted-foreground text-sm">-</span>
                            ) : (
                              assignments.map((a) => (
                                <Badge
                                  key={a.id}
                                  variant="secondary"
                                  className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={() => removeAssignment.mutate()}
                                  title="Click to remove"
                                >
                                  {a.engagement_id}
                                </Badge>
                              ))
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => setAssigningRep(rep)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={rep.is_active ? "default" : "secondary"}
                          >
                            {rep.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(rep)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(rep.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Assign to Client Dialog */}
        <Dialog open={!!assigningRep} onOpenChange={() => setAssigningRep(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Assign {assigningRep?.first_name} to Client
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {engagements.length === 0 ? (
                <p className="text-muted-foreground">No engagements available</p>
              ) : (
                <div className="space-y-2">
                  {engagements.map((eng: any) => {
                    const isAssigned = getRepAssignments(assigningRep?.id || "").some(
                      (a) => a.engagement_id === eng.id
                    );
                    return (
                      <Button
                        key={eng.id}
                        variant={isAssigned ? "secondary" : "outline"}
                        className="w-full justify-start"
                        disabled={isAssigned}
                        onClick={() => handleAssign(eng.id)}
                      >
                        <Briefcase className="h-4 w-4 mr-2" />
                        {eng.name || eng.id}
                        {isAssigned && (
                          <Badge className="ml-auto" variant="outline">
                            Assigned
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
